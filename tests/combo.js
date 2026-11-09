// Génère des pannes composées sur plusieurs seeds, vérifie la réussite de la génération et la résolution complète.
const SIM = require('./load')(); const F = SIM.fault;
const N = +process.argv[2] || 24; let bad = 0; const t0 = Date.now(); const stats = {};
for (let s = 1; s <= N; s++) {
  const count = s % 3 === 0 ? 2 : 3;
  try {
    const b = F.bundle('t' + s, { count, mode: 'auto' });
    const W = SIM.buildHealthyWorld({ seed: 't' + s }); const base = W.sem();
    F.bundleInject(W, b); let ev = F.bundleEvaluate(W, b, base);
    if (ev.status !== 'active') { bad++; console.log('✗ t' + s, 'statut après injection', ev.status); continue; }
    b.parts.forEach(i => F.runSteps(W, i.fix, { inst: i }));
    b.parts.forEach(i => { const k = ((i.verify && i.verify.length) ? i.verify : F.defaultVerify(i))[0].replace(/\*/g, 'x'); W.observe(k, true); });
    ev = F.bundleEvaluate(W, b, base);
    if (ev.status !== 'resolved') { bad++; console.log('✗ t' + s, 'statut final', ev.status, JSON.stringify(ev.parts.map(p => [p.id, p.rt.status]))); continue; }
    stats[b.mode] = (stats[b.mode] || 0) + 1;
    console.log('✓ t' + s, b.mode, b.partIds.join(' + '));
  } catch (e) { bad++; console.log('✗ t' + s, e.message.slice(0, 200)); }
}
/* Niveaux Admin (2 pannes), Cyber (3) et Chaos (4) créés par le jeu : actifs au départ, résolus par l'ensemble des corrections, déterministes */
const G = SIM.game;
for (let s = 1; s <= N; s++) {
  for (const [lv, n] of [['admin', 2], ['cyber', 3], ['chaos', 4]]) {
    const seed = 'lv' + s;
    try {
      const mk = () => G.create({ seed, level: lv, mode: 'free', clock: () => 0, profile: { done: {}, skills: {}, badges: [], history: [], best: {} } });
      const m = mk();
      if (m.parts.length !== n) { bad++; console.log('✗', lv, seed, m.parts.length + ' panne(s) au lieu de ' + n); continue; }
      if (m.check().status !== 'active') { bad++; console.log('✗', lv, seed, 'pas actif au départ'); continue; }
      const m2 = mk(); if (m2.parts.map(p => p.id).join() !== m.parts.map(p => p.id).join()) { bad++; console.log('✗', lv, seed, 'non déterministe'); continue; }
      m.parts.forEach(i => F.runSteps(m.W, i.fix, { inst: i }));
      m.parts.forEach(i => m.W.observe(((i.verify && i.verify.length) ? i.verify : F.defaultVerify(i))[0].replace(/\*/g, 'x'), true));
      const st = m.check();
      if (st.status !== 'resolved') { bad++; console.log('✗', lv, seed, 'statut final', st.status, m.parts.map(p => p.id).join('+')); continue; }
      stats[lv] = (stats[lv] || 0) + 1;
    } catch (e) { bad++; console.log('✗', lv, seed, e.message.slice(0, 200)); }
  }
}
console.log(JSON.stringify(stats), (Date.now() - t0) + ' ms', bad + ' échec(s)');
process.exit(bad ? 1 : 0);
