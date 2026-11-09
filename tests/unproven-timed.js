/* Pannes non prouvées par l'interface (SIM.UNPROVEN_FAULTS) : jamais tirées en évaluation chronométrée, tous niveaux, missions composées comprises ;
   toujours tirées en guidé et en libre ; une panne choisie explicitement reste servie. Arbitrage du porteur du projet du 30/10/2026 (option 1).
   Neutralisation (D-70) : liste vidée → elles reviennent au tirage chronométré ; mode libre → elles sortent. */
const SIM = require('./load')(); const G = SIM.game;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
const LIST = SIM.UNPROVEN_FAULTS.slice(); const ids = LIST.map(u => u.fault);
console.log('== la liste');
ok(LIST.length === 18 && ids.filter(i => /^px_/.test(i)).length === 17 && ids.indexOf('multi_vitrine') >= 0, '18 pannes : 17 px + multi_vitrine (' + LIST.length + ')');
ok(ids.every(i => SIM.faults.some(d => d.id === i)), 'chaque entrée désigne une panne du catalogue');
ok(!['px_subnet_denied', 'px_cache_unsaved', 'px_sg_default_deny', 'px_sg_nolist'].some(i => ids.indexOf(i) >= 0), 'les 4 pannes px qui ont un parcours (tests/ui/proxy-faults.js) ne sont pas dans la liste');
ok(LIST.every(u => u.why && u.why.length > 20), 'chaque entrée porte son motif');
const levels = G.LEVELS.map(l => l.id);
console.log('== tirage selon le mode (niveaux : ' + levels.join(', ') + ')');
const draw = (level, mode, n) => { const out = []; for (let s = 1; s <= n; s++) { try { const m = G.create({ seed: 'u' + s, level, mode, clock: () => 0, profile: prof() }); (m.parts || []).forEach(p => out.push(p.id)); } catch (e) { out.push('ERR:' + e.message); } } return out; };
/* niveaux à une panne : tirage bon marché, beaucoup de graines ; niveaux composés (assemblage validé par simulation, coûteux) : peu de graines */
const NS = l => (G.levelOf(l).faults > 1 ? 8 : 150);
let timedHits = 0, timedErr = 0, freeHits = 0, total = 0;
levels.forEach(l => { const t = draw(l, 'timed', NS(l)), f = draw(l, 'free', NS(l)); total += t.length; timedHits += t.filter(i => ids.indexOf(i) >= 0).length; timedErr += t.filter(i => /^ERR/.test(i)).length; freeHits += f.filter(i => ids.indexOf(i) >= 0).length; });
ok(timedErr === 0, 'aucune erreur de tirage (' + total + ' pannes tirées en chronométré sur ' + levels.length + ' niveaux)');
ok(timedHits === 0, 'chronométré : 0 panne non prouvée tirée (' + timedHits + ')');
ok(freeHits > 0, 'libre : les mêmes graines tirent des pannes non prouvées (' + freeHits + ') — elles restent jouables');
{ const g = draw('junior', 'guided', 150).concat(draw('confirme', 'guided', 150)); ok(g.some(i => ids.indexOf(i) >= 0), 'guidé : elles restent tirées'); }
console.log('== panne choisie explicitement et ancrage par compétence');
{ const m = G.create({ seed: 'u1', level: 'confirme', mode: 'timed', clock: () => 0, faultId: 'px_down', profile: prof() }); ok(m.fault.id === 'px_down', 'faultId explicite (formateur) : servie même en chronométré'); }
{ let hit = 0; Object.keys(SIM.skills).slice(0, 6).forEach(sk => { levels.forEach(l => { try { const m = G.create({ seed: 'k' + sk, level: l, mode: 'timed', skill: sk, clock: () => 0, profile: prof() }); m.parts.forEach(p => { if (ids.indexOf(p.id) >= 0) hit++; }); } catch (e) { } }); }); ok(hit === 0, 'chronométré avec compétence ciblée : 0 panne non prouvée (' + hit + ')'); }
console.log('== neutralisation');
SIM.UNPROVEN_FAULTS.length = 0;
{ let hit = 0; levels.forEach(l => { draw(l, 'timed', NS(l)).forEach(i => { if (ids.indexOf(i) >= 0) hit++; }); }); SIM.UNPROVEN_FAULTS.push(...LIST); ok(hit > 0, 'liste vidée : les pannes reviennent au tirage chronométré (' + hit + ') — le contrôle « 0 tirée » ci-dessus virerait au rouge'); }
ok(SIM.UNPROVEN_FAULTS.length === 18, 'liste restaurée');
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
