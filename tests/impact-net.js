/* Impact « par le résultat » (arbitrage du porteur du projet, 30/10/2026) : un arrêt de service coûte −4 tant que le service reste arrêté.
   « stop » suivi d'un « start » du MÊME service (= un redémarrage fait à la main) ne coûte rien ; reboot / poweroff / liaison coupée ne sont jamais remboursés.
   Ce test joue de VRAIS terminaux (Linux, cmd, PowerShell) et des actions d'interface dans une VRAIE mission.
   Neutralisations (D-70) : stop jamais relancé → impact conservé ; autre service relancé → impact conservé ; reboot → jamais remboursé ;
   la même séquence sur un service qui ne revient pas (démarrage refusé par la panne) → impact conservé. */
const SIM = require('./load')(); const G = SIM.game; const WIN = SIM.win;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
let now = 0; const clock = () => now; const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
const mission = faultId => { now = 0; const m = G.create({ seed: 'in1', level: 'confirme', mode: 'free', clock, faultId, profile: prof() }); m.env = new SIM.emu.Env(m.W, { act: e => { m.act(e); } }); return m; };
const lx = (cmds, faultId) => { const m = mission(faultId || 'dns_svc'); const sh = SIM.emu.openLxShell(m.env, 'SRV-LNX', { user: 'root', tty: 'tty1' }); cmds.forEach(c => sh.exec(c)); return m; };
const wincmd = (cmds, dev) => { const m = mission('dns_svc'); let sh = SIM.emu.openWinShell(m.env, dev || 'PC-01', { elevated: true, user: 'Administrateur' }); cmds.forEach(c => { const r = sh.exec(c); if (r && r.push) sh = r.push; }); return m; };
const kinds = m => m.impacts.map(x => x.kind).join(',');

console.log('== terminal Linux');
ok(kinds(lx(['systemctl stop apache2'])) === 'svc-stop', 'stop seul : impact conservé (le service reste arrêté)');
{ const m = lx(['systemctl stop apache2', 'systemctl start apache2']); ok(m.impacts.length === 0 && m.refunded.length === 1, 'stop puis start du même service : 0 impact, 1 remboursé (' + kinds(m) + ' / ' + m.refunded.length + ')'); }
{ const m = lx(['systemctl stop apache2', 'systemctl restart apache2']); ok(m.impacts.length === 0, 'stop puis restart : 0 impact'); }
{ const m = lx(['systemctl stop apache2', 'systemctl start ssh']); ok(m.impacts.length === 1, 'stop apache2 puis start d’un AUTRE service (ssh) : impact conservé'); }
{ const m = lx(['systemctl stop apache2', 'systemctl start apache2', 'systemctl stop apache2']); ok(m.impacts.length === 1, 'stop, start, stop : le compte net est 1 (le service est de nouveau arrêté)'); }
{ const m = lx(['systemctl stop apache2', 'systemctl start apache2', 'systemctl stop apache2', 'systemctl start apache2']); ok(m.impacts.length === 0, 'deux cycles stop / start : 0'); }
{ const m = lx(['systemctl stop apache2', 'systemctl stop ssh', 'systemctl start apache2']); ok(m.impacts.length === 1 && m.impacts[0].svc.some(k => /ssh/.test(k)), 'deux arrêts, un seul relancé : il reste l’impact du service encore arrêté (ssh)'); }
{ const m = lx(['reboot']); ok(kinds(m) === 'reboot', 'reboot : impact, jamais remboursé'); }
{ const m = lx(['systemctl stop apache2', 'reboot']); ok(m.impacts.some(i => i.kind === 'reboot'), 'stop puis reboot : l’impact du reboot reste (le service redémarre tout seul, mais le reboot est coupé net)'); }

console.log('== cmd et PowerShell (PC-01, service NlaSvc)');
{ const m = wincmd(['net stop NlaSvc']); ok(kinds(m) === 'svc-stop', 'net stop seul : impact conservé'); }
{ const m = wincmd(['net stop NlaSvc', 'net start NlaSvc']); ok(m.impacts.length === 0 && m.refunded.length === 1, 'net stop puis net start : 0 impact (' + kinds(m) + ')'); }
{ const m = wincmd(['powershell', 'Stop-Service NlaSvc -Force', 'Start-Service NlaSvc']); ok(m.impacts.length === 0, 'PowerShell Stop-Service puis Start-Service : 0 impact (' + kinds(m) + ')'); }
{ const m = wincmd(['powershell', 'Stop-Service NlaSvc -Force']); ok(kinds(m) === 'svc-stop', 'PowerShell Stop-Service seul : impact conservé'); }
{ const m = wincmd(['net stop NlaSvc && net start NlaSvc']); ok(m.impacts.length === 0, 'cmd « net stop x && net start x » sur une ligne : 0 impact'); }
{ const m = wincmd(['shutdown /r /t 0']); ok(kinds(m) === 'reboot', 'cmd shutdown /r : impact reboot (le tag était perdu par le shell avant le 30/10/2026) (' + kinds(m) + ')'); }

console.log('== interface graphique (actions marquées svc-stop, monde réellement modifié)');
{ const m = mission('dns_svc'); const d = 'PC-01';
  WIN.setSvc(m.W, d, 'NlaSvc', 'stopped'); m.act({ kind: 'ui', dev: d, text: 'Services : arrêt de « Informations sur les connexions réseau »', mutates: true, impact: 'svc-stop' });
  ok(m.impacts.length === 1, 'arrêt par la console Services : impact enregistré');
  WIN.setSvc(m.W, d, 'NlaSvc', 'running'); m.act({ kind: 'ui', dev: d, text: 'Services : démarrage de « Informations sur les connexions réseau »', mutates: true });
  ok(m.impacts.length === 0 && m.refunded.length === 1, 'démarrage par la console Services : impact remboursé'); }
{ const m = mission('dns_svc');
  WIN.setSvc(m.W, 'PC-01', 'NlaSvc', 'stopped'); m.act({ kind: 'ui', dev: 'PC-01', text: 'arrêt', mutates: true, impact: 'svc-stop' });
  WIN.setSvc(m.W, 'PC-02', 'NlaSvc', 'stopped'); WIN.setSvc(m.W, 'PC-02', 'NlaSvc', 'running'); m.act({ kind: 'ui', dev: 'PC-02', text: 'démarrage sur un autre poste', mutates: true });
  ok(m.impacts.length === 1, 'même service sur un AUTRE poste redémarré : l’impact de PC-01 est conservé'); }

console.log('== note et débrief');
{ const m = lx(['systemctl stop apache2', 'systemctl start apache2']); const r = m.giveUp(); ok(r.score.impact === 0, 'note : composante impact = 0 (' + r.score.impact + ')'); ok(m.debrief().refundedImpacts.length === 1, 'le débrief garde la trace du remboursement'); }
{ const m = lx(['systemctl stop apache2']); const r = m.giveUp(); ok(r.score.impact === -4, 'stop jamais relancé : −4 (' + r.score.impact + ')'); }
{ const m = lx(['systemctl stop apache2', 'systemctl start apache2', 'reboot']); const r = m.giveUp(); ok(r.score.impact === -4, 'cycle stop / start puis reboot : seul le reboot coûte (−4) (' + r.score.impact + ')'); }
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
