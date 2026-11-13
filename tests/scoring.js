/* Barème sur 100 : seuil de validation à 75, étoiles, plancher du temps, pénalités, abandon/échéance, temps cible par panne,
   composition des niveaux (Admin 2 pannes, Cyber 3, Chaos 4), migration d'un ancien profil. */
const SIM = require('./load')(); const G = SIM.game, F = SIM.fault;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const EMPTY = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
let now = 0; const clock = () => now;
function mk(level, mode, seed, faultId) { now = 0; return G.create({ seed, level, mode, clock, faultId, profile: EMPTY() }); }
function fixAll(m) {
  m.parts.forEach(p => { F.runSteps(m.W, p.fix, { inst: p }); m.act({ kind: 'ui', dev: 'x', text: 'correction ' + p.id, mutates: true }); });
  m.parts.forEach(p => m.W.observe(((p.verify && p.verify.length) ? p.verify : F.defaultVerify(p))[0].replace(/\*/g, 'test'), true));
  m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'test client' });
}
console.log('== seuils et étoiles');
ok(G.PASS === 75, 'seuil de validation = 75');
[[0, 0], [74, 0], [75, 1], [84, 1], [85, 2], [94, 2], [95, 3], [99, 3], [100, 3]].forEach(([n, s]) => ok(G.starsOf(n) === s, 'note ' + n + ' → ' + s + ' étoile(s)'));
ok(G.tierOf(74) === 'À repasser' && G.tierOf(75) === 'Validé' && G.tierOf(85) === 'Solide' && G.tierOf(95) === 'Expert' && G.tierOf(100) === 'Parfait', 'libellés de palier');

console.log('== résolution propre');
let m = mk('confirme', 'free', 's1'); now = (m.parSec - 10) * 1000; fixAll(m);
ok(m.result.kind === 'resolved' && m.result.note === 100 && m.result.perfect && m.result.stars === 3 && m.result.passed, 'dans le temps cible, sans faute → 100 / parfait (' + m.result.note + ')');
m = mk('confirme', 'free', 's1'); now = m.parSec * 2.5 * 1000; fixAll(m);
ok(m.result.note === 75 && m.result.passed && m.result.stars === 1, 'à 2,5 × le temps cible → 75 pile, validé 1★ (' + m.result.note + ')');
m = mk('confirme', 'free', 's1'); now = m.parSec * 10 * 1000; fixAll(m);
ok(m.result.note === 75 && m.result.passed, 'très long mais propre → jamais sous 75 (' + m.result.note + ')');
m = mk('confirme', 'free', 's1'); now = m.parSec * 1.5 * 1000; fixAll(m);
ok(m.result.note >= 75 && m.result.note < 100, 'au temps cible × 1,5 → entre 75 et 99 (' + m.result.note + ')');

console.log('== pénalités');
m = mk('confirme', 'free', 's1'); now = 1000; m.hint(); fixAll(m);
ok(m.result.note === 92 && m.result.score.hints === -8, '1 indice (libre) = −8 → 92 (' + m.result.note + ')');
m = mk('confirme', 'guided', 's1'); now = 1000; m.hint(); m.hint(); m.hint(); fixAll(m);
ok(m.result.note === 100 && m.result.score.hints === 0, 'indices gratuits en guidé');
m = mk('confirme', 'free', 's1'); now = 1000; m.hint(); m.hint(); m.hint(); fixAll(m);
ok(m.result.note === 52 && !m.result.passed && m.result.stars === 0 && m.result.tier === 'À repasser', '3 indices = −48 → 52, à repasser (' + m.result.note + ')');
m = mk('confirme', 'free', 's1'); now = 1000; m.close(); fixAll(m);
ok(m.result.note === 95 && m.result.score.wrongClose === -5, 'clôture prématurée = −5');
m = mk('confirme', 'free', 'd1', 'lx_perm'); now = 1000;
F.runSteps(m.W, [{ do: 'lx.chmod', dev: 'SRV-LNX', path: '/srv/echanges', mode: '0777' }]); m.act({ kind: 'cmd', dev: 'SRV-LNX', text: 'chmod 777 /srv/echanges', mutates: true });
F.runSteps(m.W, [{ do: 'lx.ufw', dev: 'SRV-LNX', op: 'disable' }]); m.act({ kind: 'cmd', dev: 'SRV-LNX', text: 'ufw disable', mutates: true });
fixAll(m);
ok(m.result.score.danger === -30 && m.result.note === 70 && !m.result.passed && m.result.stars === 0, 'deux actions dangereuses = −30 → 70, à repasser (' + m.result.note + ')');

console.log('== échec');
m = mk('confirme', 'free', 's1'); now = 5000; m.giveUp();
ok(m.result.kind === 'abandoned' && m.result.note < 75 && m.result.stars === 0 && !m.result.passed && m.result.note >= 0, 'abandon : à repasser (' + m.result.note + ')');
m = mk('admin', 'free', 's2'); now = 5000; F.runSteps(m.W, m.parts[0].fix, { inst: m.parts[0] }); m.act({ kind: 'ui', dev: 'x', text: 'c', mutates: true }); m.giveUp();
ok(m.result.note > 0 && m.result.note < 75 && m.result.note <= G.PARTIAL_GIVEUP, 'abandon avec une cause sur deux réparée : note partielle plafonnée (' + m.result.note + ')');
m = mk('admin', 'timed', 's2'); now = (m.deadlineSec + 1) * 1000; m.check();
ok(m.result.kind === 'timeout' && m.result.note === 0 && !m.result.passed, 'échéance sans rien réparé → 0');
m = mk('admin', 'timed', 's2'); F.runSteps(m.W, m.parts[0].fix, { inst: m.parts[0] }); m.act({ kind: 'ui', dev: 'x', text: 'c', mutates: true }); now = (m.deadlineSec + 1) * 1000; m.check();
ok(m.result.kind === 'timeout' && m.result.note <= G.PARTIAL_TIMEOUT && m.result.note > 0, 'échéance avec une cause sur deux réparée : ≤ ' + G.PARTIAL_TIMEOUT + ' (' + m.result.note + ')');

m = mk('confirme', 'timed', 's1'); now = (m.deadlineSec + 2) * 1000; fixAll(m);
ok(m.result.kind === 'timeout' && !m.result.passed, 'chronométré : une résolution constatée après l’échéance est un temps écoulé');
m = mk('confirme', 'timed', 's1'); now = (m.deadlineSec - 5) * 1000; fixAll(m);
ok(m.result.kind === 'resolved', 'chronométré : résolution juste avant l’échéance acceptée (' + m.result.note + ')');

console.log('== temps cible par panne');
const pars = SIM.faults.map(d => G.parOf(F.instantiate(d, 'x')));
ok(pars.every(p => p >= 240 && p <= 1320 && p % 30 === 0), 'toutes les pannes ont un temps cible entre 4 et 22 min (' + Math.min.apply(null, pars) + '–' + Math.max.apply(null, pars) + ' s)');
{ /* le niveau compte : chaque niveau a une cible médiane plus longue que le précédent, et les plages ne se recouvrent pas */
  const med = lv => { const a = SIM.faults.filter(d => d.level === lv).map(d => G.parOf(d)).sort((x, y) => x - y); return a[a.length >> 1]; };
  const ranges = [1, 2, 3, 4].map(lv => { const a = SIM.faults.filter(d => d.level === lv).map(d => G.parOf(d)); return [Math.min.apply(null, a), Math.max.apply(null, a)]; });
  ok(med(1) < med(2) && med(2) < med(3) && med(3) < med(4) && ranges.every((r, i) => i === 0 || r[0] > ranges[i - 1][1]), 'temps cible croissant avec le niveau (médianes ' + [1, 2, 3, 4].map(med).join(' < ') + ' s)'); }
ok(new Set(pars).size > 2, 'temps cible différencié selon la panne (' + Array.from(new Set(pars)).sort((a, b) => a - b).join(', ') + ')');
m = mk('admin', 'free', 's3'); ok(m.parSec === G.parOfParts(m.parts) && m.parSec > G.parOf(m.parts[0]), 'panne composée : temps cible = somme des causes − recouvrement');
m = mk('admin', 'timed', 's3'); ok(m.deadlineSec === Math.round(m.parSec * G.TIMED_FACTOR), 'échéance du mode chronométré = 1,5 × temps cible');

console.log('== composition des niveaux');
const cnt = {}; const domainsOk = [];
for (const [lv, n] of [['junior', 1], ['confirme', 1], ['admin', 2], ['cyber', 3], ['chaos', 4]]) {
  let allOk = true; const lens = new Set();
  for (let i = 1; i <= 6; i++) { const mm = mk(lv, 'free', 'k' + i); lens.add(mm.parts.length); if (mm.parts.length !== n) allOk = false; if (n > 1) { if (lv === 'admin' && !mm.parts.some(p => p.level === 3)) allOk = false; if (lv === 'cyber' && !mm.parts.some(p => p.level === 4)) allOk = false; if (new Set(mm.parts.map(p => p.id)).size !== n) allOk = false; } }
  ok(allOk, lv + ' : ' + n + ' panne(s) par ticket (' + Array.from(lens).join(',') + ')');
}
m = mk('admin', 'free', 'k1'); ok(/Bonjour/.test(m.fault.ticket.body) && m.fault.ticket.body.split('\n').length <= 12, 'ticket composé lisible (' + m.fault.ticket.body.split('\n').length + ' lignes)');
m = mk('cyber', 'free', 'k1'); ok(m.fault.ticket.body.split('\n').length <= 16, 'ticket Cyber lisible (' + m.fault.ticket.body.split('\n').length + ' lignes)');
const a = mk('admin', 'free', 'rej'), b = mk('admin', 'free', 'rej');
ok(a.parts.map(p => p.id).join() === b.parts.map(p => p.id).join() && a.fault.ticket.body === b.fault.ticket.body, 'même graine → même incident (rejeu à l’identique)');

console.log('== profil');
const legacy = G.cleanProfile({ name: 'x', best: { l1: 4200 }, done: { a: { count: 2, best: 3100 } }, history: [{ at: 1, seed: 's', level: 3, mode: 'free', id: 'a', kind: 'resolved', total: 3300, mttr: 400, stars: 4, skills: [] }] });
ok(legacy.v === 2 && legacy.best.l1 === 0 && legacy.done.a.best === 0 && legacy.history[0].total === 0 && legacy.history[0].stars === 0 && legacy.done.a.count === 2, 'ancien profil (points ouverts) : meilleurs scores remis à zéro, compteurs conservés');
const fresh = G.cleanProfile({ v: 2, best: { l1: 88, l2: 400 }, history: [{ at: 1, seed: 's', level: 2, mode: 'free', id: 'a', kind: 'resolved', total: 91, mttr: 40, stars: 9, perfect: true, skills: [] }] });
ok(fresh.best.l1 === 88 && fresh.best.l2 === 100 && fresh.history[0].stars === 3 && fresh.history[0].perfect === true, 'profil v2 : notes bornées à 100, étoiles à 3');
m = mk('confirme', 'free', 's1'); now = 1000; fixAll(m);
const rec = G.record(m, EMPTY()); ok(rec.profile.history[0].total === 100 && rec.profile.history[0].perfect && rec.newBadges.some(b => b.id === 'perfect'), 'enregistrement : note 100, badge Parfait');

console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
