/* Calendrier du jeu (src/engine/78-calendar.js) : à une autre date et une autre heure, chaque panne se comporte comme au mardi 27/10/2026 07:12.
   Pour chaque panne × variante et plusieurs dates : monde sain → sondes au vert ; injection → en panne ; correction de référence → cause corrigée.
   Les statuts doivent être identiques à ceux du monde non décalé. */
const SIM = require('./load.js')(); const F = SIM.fault, CAL = SIM.calendar;
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const run = (def, combo, cal) => {
  const W = SIM.buildHealthyWorld({ seed: 1 }); if (cal) CAL.apply(W, cal); const base = W.sem(); const inst = F.instantiate(def, 7, combo); if (cal) CAL.shiftFault(inst, W);
  const h = F.evaluate(W, inst, base).probes.every(p => p.ok); F.runSteps(W, inst.inject, { inst }); const a = F.evaluate(W, inst, base).status;
  F.runSteps(W, inst.fix || inst.fixes[Object.keys(inst.fixes)[0]], { inst }); const rt = F.evaluate(W, inst, base); return [h ? 'sain' : 'SONDES-KO', a, rt.rootsFixed ? 'racines-ok' : 'RACINES-KO', rt.probes.every(p => p.ok) ? 'sondes-ok' : 'SONDES-KO'].join(' ');
};
/* dates : jamais un week-end, heure de bureau, nuit le lendemain */
const c1 = CAL.make(1, 'a'), c4 = CAL.make(4, 'b'), c40 = CAL.make(40, 'c'), cn = CAL.make(12, 'd', { night: true });
const dayOf = c => { const W = SIM.buildHealthyWorld({ seed: 1 }); CAL.apply(W, c); return W.now(); };
[c1, c4, c40].forEach((c, i) => { const d = dayOf(c); ok(d.getUTCDay() >= 1 && d.getUTCDay() <= 5 && d.getUTCHours() >= 8 && d.getUTCHours() < 18, 'date ' + (i + 1) + ' : ' + d.toISOString().slice(0, 16) + ' (jour ouvré, heure de bureau)'); });
{ const d = dayOf(cn); ok(d.getUTCHours() >= 1 && d.getUTCHours() < 5, 'astreinte de nuit : ' + d.toISOString().slice(0, 16)); }
ok(dayOf(c4).getTime() > dayOf(c1).getTime() && dayOf(c40).getTime() - CAL.BASE > 50 * 86400000, 'les dates avancent avec les tickets joués (40 jours ouvrés ≈ 8 semaines)');
{ const W = SIM.buildHealthyWorld({ seed: 1 }); const before = JSON.stringify(Object.keys(W.dev['SRV-LNX'].fs).filter(k => /intranet-2026/.test(k))); CAL.apply(W, c4); const after = Object.keys(W.dev['SRV-LNX'].fs).filter(k => /intranet-20/.test(k)); const last = after.sort().pop(); ok(last && last.indexOf(new Date(W.now().getTime() - 86400000).toISOString().slice(0, 10)) > 0, 'les fichiers datés suivent (dernière sauvegarde : la veille) ' + (last || '').split('/').pop()); }
let n = 0; const diff = [];
for (const def of SIM.faults) { if (SIM.isRetiredFault && SIM.isRetiredFault(def.id)) continue;
  for (const combo of F.variantCombos(def, 3)) { let ref; try { ref = run(def, combo, null); } catch (e) { ref = 'EXC ' + e.message; }
    for (const [name, cal] of [['J+1', c1], ['J+4', c4], ['J+40', c40], ['nuit', cn]]) { n++; let r; try { r = run(def, combo, cal); } catch (e) { r = 'EXC ' + e.message; } if (r !== ref) diff.push(def.id + ' ' + JSON.stringify(combo) + ' [' + name + '] ' + r + '  (référence : ' + ref + ')'); } } }
ok(!diff.length, n + ' essais panne × variante × date : même comportement qu’à la date d’origine' + (diff.length ? ' — ' + diff.length + ' écart(s)' : '')); diff.slice(0, 30).forEach(x => console.log('    ' + x));
console.log(fails ? '✗ ' + fails + ' échec(s)' : 'OK'); process.exit(fails ? 1 : 0);
