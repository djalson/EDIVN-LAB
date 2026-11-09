/* Aide-mémoire des commandes : l'index vient des registres réels des émulateurs ; chaque commande a une description ; chaque EXEMPLE est exécuté dans le simulateur
   et ne doit jamais répondre « commande introuvable » / « n'est pas reconnu » / « non gérée » (sinon l'aide-mémoire mentirait à l'élève). */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const E = SIM.emu; const H = SIM.CMDHELP;
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W); const txt = r => r.out.map(x => x.t).join('\n');
const FAIL = /command not found|n’est pas reconnu|n'est pas reconnu|non gérée? par le simulateur|invalid option|unrecognized option|Applet de commande réelle/i;
const SKIP = new Set(['nano', 'vi', 'vim', 'vim.tiny', 'editor', 'sensible-editor', 'less', 'more', 'top', 'ssh', 'mstsc', 'reboot', 'shutdown', 'poweroff', 'halt', 'logout', 'exit', 'logoff', 'powershell', 'pwsh', 'cmd', 'bash', 'sh', 'read', 'wait', 'sleep', 'timeout', 'pause', 'Restart-Computer', 'reset', 'clear', 'cls', 'Clear-Host', 'su', 'passwd', 'mysql', 'mariadb', 'scp', 'ssh-keygen']);
const index = {}; ['bash', 'cmd', 'ps', 'ios'].forEach(k => { index[k] = E.cmdIndex(k, W.d('SW-T1')); });
ok(index.bash.missing.length === 0 && index.cmd.missing.length === 0 && index.ps.missing.length === 0, 'chaque commande émulée a une description : ' + ['bash', 'cmd', 'ps'].map(k => index[k].missing.join(',')).join(' / '));
/* aucune fiche orpheline : tout ce qui est décrit existe dans l'émulateur */
const reg = { bash: new Set(Object.keys(E.lx.cmds).concat(Object.keys(E.lx.sbin))), cmd: new Set(Object.keys(E.win.cmds)), ps: new Set(E.win.psIndex().cmdlets.map(c => c.name)) };
['bash', 'cmd', 'ps'].forEach(k => Object.keys(H[k]).forEach(nm => ok(reg[k].has(nm), 'fiche orpheline ' + k + ' : ' + nm + ' n’existe pas dans l’émulateur')));
ok(index.ios.groups.length >= 8 && index.ios.groups.every(g => g.items.every(i => i.desc)), 'IOS : 8 modes ou plus, toutes les commandes décrites');
const sw = E.cmdIndex('ios', W.d('SW-T1')), rt = E.cmdIndex('ios', W.d('R-RV1')); const has = (idx, spec) => idx.groups.some(g => g.items.some(i => i.name === spec));
ok(has(rt, 'ip nat inside source static <ip> <ip>') || rt.groups.some(g => g.items.some(i => /^ip nat/.test(i.name))), 'routeur : commandes NAT présentes'); ok(!sw.groups.some(g => g.items.some(i => /^ip nat/.test(i.name))), 'commutateur : pas de commandes NAT');
/* exemples exécutés */
const lx = E.openLxShell(env, 'SRV-LNX', { user: 'root', tty: 'tty1' });
const idxB = E.cmdIndex('bash', W.d('SRV-LNX')); const notes = {}; idxB.groups.forEach(g => g.items.forEach(i => { if (i.note) notes[i.name] = i.note; }));
ok(notes.netstat && notes.ifconfig && notes.traceroute && /apt install net-tools/.test(notes.netstat), 'les commandes non installées par défaut portent la note « apt install … »');
Object.keys(H.bash).forEach(nm => { const ex = H.bash[nm][2]; if (!ex || SKIP.has(nm) || notes[nm]) return; const o = txt(lx.exec(ex)); ok(!FAIL.test(o), 'bash « ' + ex + ' » : ' + o.split('\n')[0]); });
const winSh = dev => E.openWinShell(env, dev, { elevated: true, user: 'Administrateur' });
const cmdSh = winSh('PC-01'); Object.keys(H.cmd).forEach(nm => { const ex = H.cmd[nm][2]; if (!ex || SKIP.has(nm)) return; const o1 = txt(cmdSh.exec(ex)); const o = FAIL.test(o1) ? txt(winSh('SRV-FIC').exec(ex)) : o1; ok(!FAIL.test(o), 'cmd « ' + ex + ' » : ' + o.split('\n')[0]); });
const psDC = winSh('SRV-DC1').exec('powershell').push, psFIC = winSh('SRV-FIC').exec('powershell').push;
Object.keys(H.ps).forEach(nm => { const ex = H.ps[nm][2]; if (!ex || SKIP.has(nm)) return; const o1 = txt(psDC.exec(ex)); const o = FAIL.test(o1) ? txt(psFIC.exec(ex)) : o1; ok(!FAIL.test(o), 'ps « ' + ex + ' » : ' + o.split('\n')[0]); });
/* D-95 — INVARIANT : la liste de l'aide-mémoire ne dépend jamais du scénario. Même équipement, même mode → listes identiques sur le monde sain et sur chaque monde en panne
   (une panne qui ferait apparaître ou disparaître une commande de la liste donnerait le diagnostic au joueur). */
const F = SIM.fault; const KIND_OF = d => d.win ? ['cmd', 'ps'] : /^ios-/.test(d.kind) ? ['ios'] : (d.kind === 'linux' ? ['bash'] : []);
const sig = (idx, W2) => JSON.stringify(idx);
const snapshot = (Wx, idxFn) => { const o = {}; Object.keys(Wx.dev).forEach(id => KIND_OF(Wx.dev[id]).forEach(k => { o[id + '|' + k] = JSON.stringify(idxFn(k, Wx.dev[id])); })); return o; };
const diffCount = (A, B) => Object.keys(A).filter(k => A[k] !== B[k]).length;
const healthySnap = snapshot(W, E.cmdIndex);
let worlds = 0, drift = 0; const driftIds = [];
for (const def of SIM.faults) { const Wf = SIM.buildHealthyWorld({ seed: 1 }); const inst = F.instantiate(def, 7); F.runSteps(Wf, inst.inject); worlds++; const d = diffCount(healthySnap, snapshot(Wf, E.cmdIndex)); if (d) { drift++; driftIds.push(def.id); } }
ok(drift === 0, 'D-95 invariant : listes de l’aide-mémoire identiques sur le monde sain et sur les ' + worlds + ' mondes en panne (' + Object.keys(healthySnap).length + ' équipement×mode)' + (drift ? ' — écarts : ' + driftIds.slice(0, 5).join(', ') : ''));
/* neutralisation (D-70) : une liste qui lit l'état du monde (ici : retire « systemctl » quand un service est arrêté) DOIT faire virer l'invariant au rouge */
{ const leaky = (k, dev) => { const idx = JSON.parse(JSON.stringify(E.cmdIndex(k, dev))); const down = Object.keys(dev.svc || {}).some(s => dev.svc[s] && dev.svc[s].state === 'stopped') || (dev.win && Object.keys(dev.win.svc || {}).some(s => dev.win.svc[s].state === 'stopped')); if (down) idx.groups.forEach(g => { g.items = g.items.filter(i => !/^(systemctl|Get-Service|sc)\b/.test(i.name)); }); return idx; };
  const def = SIM.faults.find(x => x.id === 'dns_svc'); const Wf = SIM.buildHealthyWorld({ seed: 1 }); F.runSteps(Wf, F.instantiate(def, 7).inject);
  const leakHealthy = snapshot(W, leaky); ok(diffCount(leakHealthy, snapshot(Wf, leaky)) > 0, 'D-95 neutralisation : une liste qui lit l’état du monde (service arrêté → commande retirée) fait virer l’invariant au rouge'); }
console.log(n + ' assertions, ' + bad + ' échec(s)'); process.exit(bad ? 1 : 0);
