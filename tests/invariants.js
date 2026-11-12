/* Invariants de gameplay vérifiés sur TOUTES les pannes × variantes (chasse automatique aux familles de bugs trouvées en jouant).
   1. Une panne ne se répare jamais toute seule : 45 min de jeu sans rien toucher → toujours en panne.
   2. Regarder un écran ne prouve rien : correction appliquée + tous les écrans affichés → pas « résolu » (sauf panne d'écran, verify explicite).
   3. Le ticket est signé par l'utilisateur du poste en panne (pas Bruno pour le poste d'Alice).
   4. Une panne de connexion laisse l'utilisateur devant l'écran de connexion (sa session n'est pas déjà ouverte). */
const SIM = require('./load.js')(); const F = SIM.fault;
const bad = { heal: [], screen: [], author: [], session: [] };
const OWNER = { 'PC-01': /Alice Martin/, 'PC-02': /Bruno Durand/ }; const NAMES = [/Alice Martin/, /Bruno Durand/];
const WAIT_OK = { ad_locked_bdx: 1 };   /* même panne que ad_locked, à Bordeaux */
let n = 0;
for (const def of SIM.faults) {
  if (SIM.isRetiredFault && SIM.isRetiredFault(def.id)) continue;
  for (const combo of F.variantCombos(def, 6)) {
    n++; const tag = def.id + (Object.keys(combo).length ? ' ' + JSON.stringify(combo) : '');
    try {
      /* 1. pas d'auto-réparation */
      let W = SIM.buildHealthyWorld({ seed: 1 }), base = W.sem(), inst = F.instantiate(def, 7, combo);
      F.runSteps(W, inst.inject, { inst }); let rt = F.evaluate(W, inst, base);
      /* 45 min de jeu : au-delà de toute partie. Exception déclarée : une panne qui prévoit la correction « attendre » (verrouillage de compte, levé seul après la durée de verrouillage). */
      if (rt.status === 'active' && !(inst.fixes && inst.fixes.attendre) && !WAIT_OK[def.id]) { for (let i = 0; i < 45; i++) SIM.sched.advance(W, 60); rt = F.evaluate(W, inst, base); if (rt.status !== 'active') bad.heal.push(tag + ' → ' + rt.status + ' après 45 min sans action'); }
      /* 2. écran ≠ preuve */
      W = SIM.buildHealthyWorld({ seed: 1 }); base = W.sem(); inst = F.instantiate(def, 7, combo);
      F.runSteps(W, inst.inject, { inst }); F.runSteps(W, inst.fix || inst.fixes[Object.keys(inst.fixes)[0]], { inst }); F.evaluate(W, inst, base);
      Object.keys(W.dev).forEach(id => W.observe('use:' + id + ':screen', true)); rt = F.evaluate(W, inst, base);
      const explicitUse = (inst.verify || []).some(v => /^use:/.test(v));
      if (rt.status === 'resolved' && !explicitUse) bad.screen.push(tag);
      /* 3. auteur du ticket cohérent avec le poste */
      const hosts = (inst.probes || []).map(p => p.from || p.host || p.client).filter(h => OWNER[h]); const from = String(inst.ticket.from || '');
      if (hosts.length && NAMES.some(r => r.test(from)) && !hosts.some(h => OWNER[h].test(from))) bad.author.push(tag + ' : « ' + from + ' » pour ' + hosts.filter((h, i) => hosts.indexOf(h) === i).join(', '));
      /* 4. panne de connexion : session fermée au départ */
      if (!(inst.probes || []).some(pr => pr.t === 'login')) continue;
      const m = SIM.game.create({ level: def.level || 1, mode: 'free', faultId: def.id, seed: 'inv' });
      m.parts.forEach(p => (p.probes || []).forEach(pr => { if (pr.t !== 'login' || !pr.host) return; const ss = m.W.d(pr.host)._rt.session; let r = { ok: true }; try { r = SIM.probes.login(m.W, pr, p); } catch (e) { /* rien */ } if (!r.ok && ss && String(ss.user).toLowerCase() === String(pr.user).toLowerCase()) bad.session.push(def.id + ' : session de ' + pr.user + ' ouverte sur ' + pr.host); }));
    } catch (e) { bad.heal.push(tag + ' : exception ' + e.message); }
  }
}
const rep = (k, title) => { console.log((bad[k].length ? '✗ ' : '✓ ') + title + (bad[k].length ? ' — ' + bad[k].length + ' cas' : '')); bad[k].slice(0, 40).forEach(x => console.log('    ' + x)); };
console.log(n + ' pannes × variantes');
rep('heal', 'aucune panne ne se répare toute seule en 45 min de jeu'); rep('screen', 'afficher un écran ne clôture aucun ticket'); rep('author', 'ticket signé par l’utilisateur du poste en panne'); rep('session', 'panne de connexion : l’utilisateur est devant l’écran de connexion');
const total = Object.keys(bad).reduce((a, k) => a + bad[k].length, 0); console.log(total ? '✗ ' + total + ' anomalie(s)' : 'OK'); process.exit(total ? 1 : 0);
