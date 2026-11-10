/* Pannes écartées du tirage (SIM.UNPROVEN_FAULTS, src/content/09-unproven.js).
   Depuis le 10/11/2026 : les 17 pannes proxy sont prouvées réparables par l'interface (tests/ui/proxy-sweep.js) et reviennent partout ;
   multi_vitrine est établie irréparable (certificat expiré, aucun renouvellement émulé) et sort de TOUS les tirages.
   Une panne choisie explicitement reste servie. Neutralisation : liste vidée → elle revient au tirage. */
const SIM = require('./load')(); const G = SIM.game, C = SIM.camp;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
const LIST = SIM.UNPROVEN_FAULTS.slice(); const ids = LIST.map(u => u.fault);
console.log('== la liste');
ok(LIST.length === 1 && ids[0] === 'multi_vitrine' && LIST[0].retired === true, 'une seule entrée : multi_vitrine, retirée de tous les tirages');
ok(ids.every(i => SIM.faults.some(d => d.id === i)) && LIST.every(u => u.why && u.why.length > 20), 'entrée valide, avec son motif');
ok(!SIM.faults.some(d => /^px_/.test(d.id) && SIM.isUnproven(d.id)) && SIM.faults.filter(d => /^px_/.test(d.id)).length === 21, 'les 21 pannes proxy sont toutes en jeu');
/* le motif est vrai : aucune étape de correction autre que l'écriture directe du modèle ne touche la date du certificat */
{ const d = SIM.faults.find(x => x.id === 'multi_vitrine'); ok(d.fix.some(s => s.do === 'set' && /notAfter/.test(s.path)), 'multi_vitrine : la correction du certificat est une écriture directe du modèle (rien d’émulé ne la produit)'); }
const levels = G.LEVELS.map(l => l.id);
console.log('== tirage : jamais, quel que soit le mode');
const draw = (level, mode, n) => { const out = []; for (let s = 1; s <= n; s++) { try { const m = G.create({ seed: 'u' + s, level, mode, clock: () => 0, profile: prof() }); (m.parts || []).forEach(p => out.push(p.id)); } catch (e) { out.push('ERR:' + e.message); } } return out; };
const NS = l => (G.levelOf(l).faults > 1 ? 8 : 150);
let hits = 0, errs = 0, total = 0, pxTimed = 0;
levels.forEach(l => ['timed', 'free', 'guided'].forEach(mode => { const t = draw(l, mode, NS(l)); total += t.length; hits += t.filter(i => ids.indexOf(i) >= 0).length; errs += t.filter(i => /^ERR/.test(i)).length; if (mode === 'timed') pxTimed += t.filter(i => /^px_/.test(i)).length; }));
ok(errs === 0, 'aucune erreur de tirage (' + total + ' pannes tirées sur ' + levels.length + ' niveaux × 3 modes)');
ok(hits === 0, 'multi_vitrine jamais tirée, ni en chronométré, ni en libre, ni en guidé');
ok(pxTimed > 0, 'les pannes proxy sont de nouveau tirées en chronométré (' + pxTimed + ')');
{ let n = 0; for (let s = 0; s < 400; s++) if (G.pick(4, 'p' + s, prof(), {}).id === 'multi_vitrine') n++; ok(n === 0, 'tirage direct au niveau 4 : jamais (400 graines)'); }
ok(!C.pool(11).some(d => d.id === 'multi_vitrine') && C.pool(11).length >= C.chapter(11).need, 'campagne : absente du chapitre 11, qui garde assez de pannes (' + C.pool(11).length + ')');
console.log('== panne choisie explicitement');
{ const m = G.create({ seed: 'u1', level: 'cyber', mode: 'free', clock: () => 0, faultId: 'multi_vitrine', profile: prof() }); ok(m.fault.id === 'multi_vitrine', 'faultId explicite (formateur) : toujours servie'); }
console.log('== neutralisation');
SIM.UNPROVEN_FAULTS.length = 0;
{ let n = 0; for (let s = 0; s < 400; s++) if (G.pick(4, 'p' + s, prof(), {}).id === 'multi_vitrine') n++; SIM.UNPROVEN_FAULTS.push(...LIST); ok(n > 0, 'liste vidée : elle revient au tirage (' + n + ' / 400) — le contrôle « jamais » ci-dessus virerait au rouge'); }
ok(SIM.UNPROVEN_FAULTS.length === 1, 'liste restaurée');
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
