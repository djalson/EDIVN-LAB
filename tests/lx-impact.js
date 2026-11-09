/* Le terminal Linux marque les actions à impact (D-109, point 2 : « action marquée d'un tag par l'interface ou le terminal »).
   Avant cette séance, Windows et IOS émettaient svc-stop / nic-down / poweroff / reboot, pas le terminal Linux : un redémarrage
   ou un arrêt de service y étaient gratuits, et l'invariant « zéro malus sur un chemin déclaré » ne pouvait pas virer au rouge pour lx_fstab.
   Ce test joue le VRAI terminal dans une VRAIE mission. Neutralisation : lecture seule → aucun tag ; needsReboot retiré → malus. */
const SIM = require('./load')(); const G = SIM.game;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
let now = 0; const clock = () => now; const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
const play = (faultId, cmds, dev) => {
  now = 0; const m = G.create({ seed: 'li1', level: 'confirme', mode: 'free', clock, faultId, profile: prof() });
  const env = new SIM.emu.Env(m.W, { act: e => { m.act(e); } });
  const sh = SIM.emu.openLxShell(env, dev || 'SRV-LNX', { user: 'root', tty: 'tty1' });
  cmds.forEach(c => sh.exec(c)); return m;
};
console.log('== terminal Linux : tags d’impact dans une mission réelle');
const kinds = m => m.impacts.map(x => x.kind).join(',');
ok(kinds(play('dns_svc', ['systemctl status ssh', 'df -h', 'ls /etc'])) === '', 'lecture seule (status, df, ls) : aucun impact');
ok(kinds(play('dns_svc', ['systemctl stop apache2'])) === 'svc-stop', 'systemctl stop <service> : impact svc-stop');
ok(kinds(play('dns_svc', ['systemctl restart apache2'])) === '', 'systemctl restart : pas d’impact (cas courant de réparation)');
ok(kinds(play('dns_svc', ['reboot'])) === 'reboot', 'reboot : impact reboot');
ok(kinds(play('dns_svc', ['systemctl stop apache2 && echo ok'])) === 'svc-stop', 'tag conservé à travers « && »');
ok(play('dns_svc', ['reboot']).debrief().impacts.length === 1, 'le débrief liste l’impact');
console.log('== needsReboot : le redémarrage de la correction ne coûte rien');
ok(play('lx_fstab', ['reboot']).impacts.length === 0, 'lx_fstab : redémarrage réel du terminal → 0 impact');
{ const def = SIM.faults.find(d => d.id === 'lx_fstab'); const keep = def.needsReboot; delete def.needsReboot;
  const n = play('lx_fstab', ['reboot']).impacts.length; def.needsReboot = keep;
  ok(n === 1, 'neutralisation : indicateur retiré → le même redémarrage coûte un impact (le contrôle ci-dessus virerait au rouge)'); }
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
