/* Balayage « réparable au terminal » — Cisco IOS (commutateurs et routeurs). Pour CHAQUE panne dont la correction ne touche que des équipements IOS × CHAQUE variante :
   monde sain → injection → l'état attendu est lu comme un admin le lirait : « show running-config » du monde sain comparé à celui du monde en panne,
   puis la différence est rejouée en vraies commandes de configuration (« no … » d'abord, ajouts ensuite) → la panne doit passer à « réparée ».
   Un échec = une commande réelle refusée / sans effet, OU un état fautif invisible dans « show running-config » (à réparer avec d'autres « show » : listé à part). */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const F = SIM.fault;
const only = process.argv[2] || '';
const text = r => r.out.map(x => x.t).join('\n');
const parse = cfg => { const top = []; let cur = null; cfg.split('\n').forEach(l => { if (!l.trim() || /^(!|Building|Current configuration|end$)/.test(l.trim()) && l[0] !== ' ') { cur = null; return; } if (l[0] !== ' ') { cur = { line: l.trim(), kids: [] }; top.push(cur); } else if (cur) cur.kids.push(l.trim()); }); return top; };
const show = (sh) => text(sh.exec('show running-config'));
const tok = l => l.split(/\s+/);
const sameFamily = (a, b) => { const x = tok(a), y = tok(b); let k = 0; while (k < x.length && k < y.length && x[k] === y[k]) k++; return k >= Math.max(1, Math.min(x.length, y.length) - 2) && k < Math.max(x.length, y.length); };
const diff = (good, bad) => {   /* commandes qui amènent « bad » à « good » : suppressions d'abord, ajouts ensuite */
  const g = parse(good), b = parse(bad); const rem = [], add = []; const gm = new Map(g.map(x => [x.line, x])), bm = new Map(b.map(x => [x.line, x]));
  /* ACL numérotées : « no access-list N » retire toute la liste (IOS ne retire pas une ligne seule) → on la recrée */
  const nacl = new Set(); [g, b].forEach(L => L.forEach(x => { const m = x.line.match(/^access-list (\d+) /); if (m) nacl.add(m[1]); }));
  nacl.forEach(n => { const gl = g.filter(x => x.line.indexOf('access-list ' + n + ' ') === 0).map(x => x.line), bl = b.filter(x => x.line.indexOf('access-list ' + n + ' ') === 0).map(x => x.line);
    if (JSON.stringify(gl) !== JSON.stringify(bl)) { rem.push(['no access-list ' + n]); gl.forEach(l => add.push([l])); } });
  const isNacl = l => /^access-list \d+ /.test(l);
  b.forEach(x => { if (!gm.has(x.line) && !isNacl(x.line)) rem.push([/^no /.test(x.line) ? x.line.slice(3) : 'no ' + x.line]); });
  g.forEach(x => { if (isNacl(x.line)) return; const y = bm.get(x.line); if (!y) { add.push([x.line].concat(x.kids)); return; }
    const ordered = /^ip access-list/.test(x.line); const same = ordered ? JSON.stringify(x.kids) === JSON.stringify(y.kids) : (x.kids.every(k => y.kids.indexOf(k) >= 0) && y.kids.every(k => x.kids.indexOf(k) >= 0));
    if (same) return;
    if (ordered) { rem.push(['no ' + x.line]); add.push([x.line].concat(x.kids)); return; }
    const a = x.kids.filter(k => y.kids.indexOf(k) < 0);
    /* une ligne fautive remplacée par une ligne de la même famille (ip address, channel-group, trunk allowed…) : la nouvelle ligne l'écrase, pas de « no » */
    const r = y.kids.filter(k => x.kids.indexOf(k) < 0 && !a.some(n2 => sameFamily(k, n2))).map(k => 'no ' + k);
    if (r.length) rem.push([x.line].concat(r)); if (a.length) add.push([x.line].concat(a)); });
  return rem.concat(add);
};
/* Cas où l'état fautif n'est pas (ou pas seulement) dans « show running-config », ou où la différence avec le monde sain n'est qu'un contournement :
   la réparation d'un admin est écrite ici, en vraies commandes (clé RSA, ACL d'accès SSH, port désactivé par la sécurité de port). */
const psecFix = (W, dev, port) => { const p = W.d(dev).ports[port].psec; return { [dev]: ['configure terminal', 'interface ' + port].concat((p.macs || []).map(m => 'no switchport port-security mac-address sticky ' + m.replace(/[^0-9a-f]/gi, '').toLowerCase().replace(/(.{4})(?=.)/g, '$1.')), ['shutdown', 'no shutdown', 'end']) }; };
const OVERRIDE = {
  'c_portsec#0': W => psecFix(W, 'SW-T2', 'FastEthernet0/2'),
  'c_ssh#0': () => ({ 'SW-T2': ['configure terminal', 'crypto key generate rsa modulus 2048', 'end'] }),
  'c_ssh_auth#0': () => ({ 'SW-T2': ['configure terminal', 'no access-list 10', 'access-list 10 permit host 10.10.30.10', 'end'] }),
  'c_portsec_imp#0': W => psecFix(W, 'SW-T3', 'FastEthernet0/5'),
};
const SKIP = process.env.SWEEP_SKIP || '', BREAK = process.env.SWEEP_BREAK || '';   /* crochets de neutralisation (tests/sweep-coverage.js) */
/* Variantes dont la correction touche l'IOS mais qui ne sont pas réparables au terminal seul : exemptées, avec la raison (dette déclarée, jamais silencieuse). */
const EXEMPT = { 'phys_patch#0': 'geste physique (câble de brassage dans la baie) : réparé depuis le dos du poste, pas au terminal' };
const res = []; const invisible = []; const touched = [];
for (const def of SIM.faults) {
  if (only && def.id.indexOf(only) < 0) continue;
  const keys = Object.keys(def.vary || {}); const n = Math.max(1, ...keys.map(k => def.vary[k].length));
  for (let i = 0; i < n; i++) {
    const forced = {}; keys.forEach(k => { forced[k] = i % def.vary[k].length; });
    const inst = F.instantiate(def, 7, forced); const all = inst.fix || []; const CLIENT = ['renew', 'release', 'flushdns', 'relogon', 'tick', 'dnscache']; const steps = all.filter(x => CLIENT.indexOf(x.do) < 0); const clientSteps = all.filter(x => CLIENT.indexOf(x.do) >= 0);
    const devs = [...new Set(steps.map(s => s.dev || String(s.path || '').split('.')[0]))]; const Wh = SIM.buildHealthyWorld({ seed: 1 });
    if (devs.some(d => Wh.dev[d] && /^ios-/.test(Wh.dev[d].kind))) touched.push(def.id + '#' + i);   /* toute variante dont la correction touche un équipement IOS doit être balayée ou exemptée avec sa raison */
    if (!devs.length || !devs.every(d => Wh.dev[d] && /^ios-/.test(Wh.dev[d].kind))) continue;
    if (SKIP && def.id === SKIP) continue;   /* crochet de neutralisation (tests/sweep-coverage.js) : retire une panne du balayage, le contrôle de couverture doit virer au rouge */
    const tag = def.id + '#' + i; const W = SIM.buildHealthyWorld({ seed: 1 }); const base = W.sem(); const envH = T.mk(Wh);
    F.runSteps(W, inst.inject); const pre = F.evaluate(W, inst, base).status; const env = T.mk(W); T.guard.arm(W, inst); const log = []; let fail = null; let any = false;
    const ov = OVERRIDE[tag] && OVERRIDE[tag](W);
    if (ov) { for (const dev of Object.keys(ov)) { const sb = SIM.emu.openIos(env, dev, { via: 'console' }); sb.exec('enable'); for (const c of ov[dev]) { const o = text(sb.exec(c)); log.push(dev + '# ' + c + (o ? '\n' + o : '')); if (/% (Invalid|Incomplete|Ambiguous|Unknown)|Invalid input/.test(o)) fail = fail || ('« ' + c + ' » → ' + o.split('\n')[0]); } } any = true; }
    else for (const dev of devs) {
      const sg = SIM.emu.openIos(envH, dev, { via: 'console' }); sg.exec('enable'); const sb = SIM.emu.openIos(env, dev, { via: 'console' }); sb.exec('enable');
      const cmds = diff(show(sg), show(sb)); if (BREAK && def.id === BREAK) cmds.length = 0;   /* recette volontairement cassée : le balayage doit virer au rouge */ if (!cmds.length) { log.push(dev + ' : aucune différence dans show running-config'); continue; } any = true;
      sb.exec('configure terminal');
      for (const blk of cmds) { const ctx = blk.length === 1; for (const c of blk) { let r = sb.exec(c); let o = text(r);
          /* « no <ligne> » : on essaie la forme complète, puis sans les valeurs finales (forme canonique de la plupart des « no ») ; la forme retenue est consignée */
          if (/^no /.test(c) && /% (Invalid|Incomplete)|Invalid input/.test(o)) { const t = c.split(/\s+/); for (let k = 1; k <= 2 && /% (Invalid|Incomplete)|Invalid input/.test(o) && t.length - k >= 3; k++) { const c2 = t.slice(0, t.length - k).join(' '); r = sb.exec(c2); o = text(r); log.push(dev + '(config)# ' + c + '  → refusée ; essai : ' + c2); } } log.push(dev + '(config)# ' + c + (o ? '\n' + o : '')); if (/% (Invalid|Incomplete|Ambiguous|Unknown)|Invalid input/.test(o)) fail = fail || ('« ' + c + ' » → ' + o.split('\n')[0]); }
        if (!ctx) sb.exec('exit'); }
      sb.exec('end');
      if (cmds.some(bl => bl.some(c => /router-id/.test(c)))) { const r = sb.exec('clear ip ospf process'); log.push(dev + '# clear ip ospf process\n' + text(r)); if (r.ask) log.push(dev + '# ' + text(sb.exec('yes'))); }
    }
    /* côté client : ce que ferait l'admin sur le poste après la réparation de l'équipement */
    for (const st of clientSteps) { const cmd = st.do === 'renew' ? 'ipconfig /renew' : st.do === 'flushdns' ? 'ipconfig /flushdns' : null; if (!cmd) continue;
      const w = SIM.emu.openWinShell(env, st.dev, { elevated: true, user: 'Administrateur' }); const o = text(w.exec(cmd)); log.push(st.dev + '> ' + cmd + (o ? '\n' + o : '')); }
    const gd = T.guard.disarm();   /* D-109 : un chemin déclaré ne coûte aucun malus (ni danger, ni impact) */
    if (!fail && (gd.dangers.length || gd.impacts.length)) fail = 'malus sur un chemin déclaré : ' + gd.dangers.map(x => 'danger ' + x.id + ' (' + x.text + ')').concat(gd.impacts.map(x => 'impact ' + x.kind + ' (' + x.text + ')')).join(' ; ');
    const post = F.evaluate(W, inst, base).status; const ok = !fail && ['fixed', 'resolved'].indexOf(post) >= 0;
    if (!ok && !any) invisible.push(tag); res.push({ tag, ok, pre, post, fail, any, log });
  }
}
let bad = 0;
if (!only) { const done = new Set(res.map(r => r.tag)); touched.filter(t => !done.has(t) && !EXEMPT[t]).forEach(t => { bad++; console.log('✗ non couverte par le balayage IOS : ' + t + ' (sa correction touche un équipement IOS : l\'ajouter au balayage ou l\'exempter avec sa raison)'); }); }
res.forEach(r => { if (!r.ok) { bad++; console.log('✗ ' + r.tag + ' : ' + (r.fail || (r.any ? 'après réparation : ' + r.post : 'état fautif invisible dans show running-config (' + r.post + ')'))); if (process.env.VERBOSE) console.log(r.log.join('\n').replace(/^/gm, '    ')); } else if (process.env.VERBOSE) console.log('✓ ' + r.tag); });
console.log(res.length + ' combinaisons IOS, ' + (res.length - bad) + ' réparées au terminal, ' + bad + ' échec(s)' + (only ? '' : ', ' + touched.length + ' variantes touchant l\'IOS dont ' + Object.keys(EXEMPT).filter(t => touched.indexOf(t) >= 0).length + ' exemptée(s)') + (invisible.length ? ' dont ' + invisible.length + ' invisibles dans show run' : '')); process.exit(bad ? 1 : 0);
