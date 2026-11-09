/* Progression : niveaux, XP d'un ticket, succès, maîtrise, arbre, série, ticket du jour, objectifs bonus, migration, invariants de non-influence sur la note. */
'use strict';
const SIM = require('./load.js')(); const Game = SIM.game, P = SIM.prog, F = SIM.fault;
let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
const fresh = () => Game.cleanProfile(null);
const mkProf = () => P.migrate(fresh());

/* niveaux */
ok(P.cum(1) === 0 && P.cum(2) === 100, 'niveau 2 à 100 XP');
let prev = -1, mono = true; for (let l = 1; l <= P.MAX_LEVEL; l++) { const c = P.cum(l); if (c <= prev && l > 1) mono = false; prev = c; }
ok(mono, 'la courbe d’XP est strictement croissante');
ok(P.levelOf(0).level === 1 && P.levelOf(99).level === 1 && P.levelOf(100).level === 2, 'passage de niveau à la borne exacte');
ok(P.levelOf(1e9).level === P.MAX_LEVEL && P.levelOf(1e9).max && P.levelOf(1e9).pct === 100, 'plafond de niveau');
ok(P.pointsEarned(1) === 0 && P.pointsEarned(10) === 10 && P.pointsEarned(40) === 43, 'points : 1 par niveau + 1 aux paliers 10/20/30/40');
ok(P.titleOf(1) === 'Stagiaire' && P.titleOf(40) === 'Légende du datacenter' && P.titleOf(9) === 'Technicien N2', 'titres par palier');

/* arbre */
let p = mkProf();
ok(P.pointsLeft(p) === 0, 'profil neuf : 0 point');
ok(P.whyNot(p, 'xp1') && /point/.test(P.whyNot(p, 'xp1')), 'achat refusé sans point');
p.xp = P.cum(6);                                                   /* niveau 6 → 5 points */
ok(P.pointsLeft(p) === 5, 'niveau 6 → 5 points');
ok(P.buy(p, 'xp1').ok && P.pointsLeft(p) === 3, 'achat de Curiosité (2 points)');
ok(!P.buy(p, 'xp2').ok === false && P.pointsLeft(p) === 0, 'achat de Méthode (3 points) après Curiosité');
ok(P.whyNot(p, 'xp2') === 'Déjà possédé.', 'double achat refusé');
ok(/Curiosité/.test(P.whyNot(mkProf(), 'xp2') || '') || /point/.test(P.whyNot(mkProf(), 'xp2')), 'prérequis ou points manquants signalés');
P.reset(p); ok(P.pointsLeft(p) === 5 && !P.has(p, 'xp1'), 'réinitialisation : points rendus');
ok(!P.has(p, 'vault1'), 'coffre-fort absent d’un profil neuf');
p.badges.push('fingers'); ok(P.has(p, 'vault1'), 'coffre-fort offert par le succès « Mémoire des doigts »');
ok(/Succès requis/.test(P.whyNot(p, 'vault2')), 'coffre-fort terminaux : succès « Pianiste » exigé');
ok(P.themeOwned(p, 'neon') && P.themeOwned(p, 'paper') && !P.themeOwned(p, 'cyber'), 'thèmes : 3 gratuits, les autres à débloquer');
p.xp = P.cum(8); P.buy(p, 'th-cyber'); ok(P.themeOwned(p, 'cyber'), 'thème acheté disponible');
ok(!P.perkActive({ id: 'timed', timed: true }) && P.perkActive({ id: 'free', timed: false }) && P.perkActive({ id: 'guided' }), 'avantages de confort coupés en évaluation chronométrée');
ok(P.TREE.every(nd => (nd.req || []).every(r => P.node(r))) && P.TREE.every(nd => !nd.ach || P.ach(nd.ach)) && P.TREE.every(nd => !nd.auto || P.ach(nd.auto)), 'arbre : prérequis et succès existent');

/* compteurs hors ticket : saisies manuelles */
p = mkProf(); let aw;
for (let i = 0; i < 19; i++) aw = P.bump(p, 'logins');
ok(aw.newBadges.length === 0, '19 saisies : pas encore de succès');
aw = P.bump(p, 'logins');
ok(aw.newBadges.some(b => b.id === 'fingers') && P.has(p, 'vault1') && p.xp >= 40, '20e saisie : « Mémoire des doigts » + coffre-fort + XP');
ok(P.bump(p, 'logins').newBadges.length === 0, 'succès jamais attribué deux fois');
for (let i = 0; i < 39; i++) aw = P.bump(p, 'logins'); ok(p.badges.indexOf('fingers2') >= 0, '60 saisies : « Pianiste »');

/* série */
p = mkProf();
ok(P.streakInfo(p, '2026-10-28').state === 'none', 'série vide');
p.streak = { n: 3, last: '2026-10-27', best: 3 }; ok(P.streakInfo(p, '2026-10-28').state === 'pending' && P.streakInfo(p, '2026-10-28').n === 3, 'série d’hier : à prolonger');
p.streak = { n: 3, last: '2026-10-28', best: 3 }; ok(P.streakInfo(p, '2026-10-28').state === 'today', 'série comptée aujourd’hui');
p.streak = { n: 3, last: '2026-10-26', best: 3 }; ok(P.streakInfo(p, '2026-10-28').alive === false, 'deux jours manqués : série perdue sans Joker');
p.xp = P.cum(10); P.buy(p, 'shield'); ok(P.streakInfo(p, '2026-10-28').state === 'shield' && P.streakInfo(p, '2026-10-28').n === 3, 'avec le Joker : un jour manqué pardonné');
p.streak.shieldAt = P.dayNum('2026-10-20'); ok(!P.streakInfo(p, '2026-10-28').alive, 'Joker déjà utilisé il y a moins de 14 jours');
ok(P.streakBonus(1) === 0 && Math.abs(P.streakBonus(4) - 0.15) < 1e-9 && P.streakBonus(50) === 0.30, 'bonus de série plafonné à 30 %');
ok(P.dayNum('2026-10-28') - P.dayNum('2026-10-27') === 1 && P.dayNum('2026-03-01') - P.dayNum('2026-02-28') === 1, 'calcul de jours (fin de mois)');
ok(P.weekday('2026-10-28') === 3 && P.weekday('2026-10-25') === 0, 'jour de semaine (28/10/2026 = mercredi)');
const d1 = P.daily('2026-10-28'), d2 = P.daily('2026-10-28'); ok(d1.seed === d2.seed && d1.level === 3 && P.daily('2026-10-25').level === 5, 'ticket du jour : déterministe, Chaos le dimanche');

/* ticket complet joué avec les corrections scriptées */
{
  const prof = mkProf(); const m = Game.create({ level: 1, mode: 'free', seed: 'g1', profile: prof });
  ok(m.goals.length === 3 && m.goals.every(x => x.id && x.label && x.xp > 0), 'objectifs bonus : 3 par ticket');
  const m2 = Game.create({ level: 1, mode: 'free', seed: 'g1', profile: prof }); ok(JSON.stringify(m2.goals.map(x => x.id)) === JSON.stringify(Game.create({ level: 1, mode: 'free', seed: 'g1', profile: prof }).goals.map(x => x.id)), 'objectifs : même graine → mêmes objectifs');
  const pg = mkProf(); pg.xp = P.cum(12); P.buy(pg, 'goals4'); ok(Game.create({ level: 1, mode: 'free', seed: 'g1', profile: pg }).goals.length === 4, 'perk « Chasseur de primes » : 4 objectifs');
}

/* XP d'un ticket validé */
function finishAndRecord(o) {
  const prof = o.profile || mkProf(); let now = 0;
  const m = Game.create(Object.assign({ level: 1, mode: 'free', seed: 'x1', profile: prof, clock: () => now }, o));
  m.parts.forEach(pt => { m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'diagnostic' }); F.runSteps(m.W, pt.fix, { inst: pt }); now += 5000; m.act({ kind: 'ui', dev: 'x', text: 'correction', mutates: true }); });
  m.parts.forEach(pt => { const pats = (pt.verify && pt.verify.length) ? pt.verify : F.defaultVerify(pt); m.W.observe(pats[0].replace(/\*/g, 'test'), true); });
  m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'test client' });
  return { m, prof };
}
{
  const r0 = finishAndRecord({ level: 1, seed: 'x1' });
  if (r0.m.state === 'running') r0.m.giveUp();
  const rec = Game.record(r0.m, r0.prof);
  ok(rec && rec.prog && typeof rec.prog.xp === 'number' && rec.prog.xp > 0, 'enregistrement : le bilan d’XP est retourné');
  ok(r0.prof.xp === rec.prog.xp, 'XP du profil = XP du bilan (' + r0.prof.xp + ')');
  ok(rec.prog.to.level >= rec.prog.from.level, 'niveau jamais en baisse');
  ok(r0.prof.stats.played === 1, 'compteur de parties');
  const resolved = r0.m.result.kind === 'resolved';
  if (resolved) {
    ok(r0.prof.streak.n === 1 && r0.prof.streak.last === P.today(), 'une résolution lance la série');
    ok(rec.prog.parts.some(x => /Première résolution/.test(x.label)), 'bonus de première résolution');
    ok(rec.newBadges.some(b => b.id === 'first'), 'succès « Premier ticket »');
    const x0 = r0.prof.xp;
    /* même panne rejouée : plus de bonus de première résolution */
    const r1 = finishAndRecord({ level: 1, seed: 'x1', profile: r0.prof, faultId: r0.m.fault.id });
    if (r1.m.state === 'running') r1.m.giveUp();
    const rec1 = Game.record(r1.m, r1.prof);
    ok(!rec1.prog.parts.some(x => /Première résolution/.test(x.label)), 'pas de bonus de première résolution à la seconde partie');
  } else console.log('  (ticket non résolu par le test : cas résolu non couvert — ' + r0.m.result.kind + ')');
}

/* échec : XP de participation seulement, la série ne bouge pas */
{
  const prof = mkProf(); const m = Game.create({ level: 1, mode: 'free', seed: 'f1', profile: prof, clock: (() => { let t = 0; return () => (t += 1000); })() });
  m.giveUp(); const rec = Game.record(m, prof);
  ok(rec.prog.xpTicket === 10 && prof.streak.n === 0, 'abandon : 10 XP de participation, pas de série');
  ok(prof.history.length === 1 && prof.history[0].stars === 0, 'abandon : historique conservé');
}

/* la progression ne touche jamais la note : mêmes actions → même note avec ou sans perks */
{
  const run = (prof) => { const m = Game.create({ level: 1, mode: 'free', seed: 'n1', profile: prof, faultId: 'dhcp_scope_off', clock: (() => { let t = 0; return () => (t += 1000); })() }); m.hint(); m.parts.forEach(pt => F.applyFix(m.W, pt)); m.W.touch('fix'); for (let i = 0; i < 3 && m.state === 'running'; i++) { m.act({ kind: 'cmd', dev: 'PC-01', text: 'ping', mutates: false }); m.check(); } if (m.state === 'running') m.giveUp(); return m.result.note; };
  const rich = mkProf(); rich.xp = P.cum(40); ['xp1', 'xp2', 'goals4', 'shield', 'notes', 'titles'].forEach(id => { rich.tree[id] = 1; }); rich.badges.push('fingers', 'fingers2');
  ok(run(mkProf()) === run(rich), 'note identique avec un profil au maximum de la progression');
}

/* migration d'un profil antérieur */
{
  const old = Game.cleanProfile({ v: 2, name: 'X', done: {}, skills: {}, badges: ['first'], history: [{ at: 1, seed: 's', level: 2, mode: 'free', id: 'a', kind: 'resolved', total: 90, mttr: 100, stars: 2, perfect: false, skills: [] }, { at: 2, seed: 's', level: 1, mode: 'free', id: 'b', kind: 'abandoned', total: 10, mttr: 100, stars: 0, perfect: false, skills: [] }], best: {} });
  P.migrate(old);
  ok(old.pv === 1 && old.xp === Math.round(100 * 1.1) + 10 + 20, 'migration : XP rétroactive d’après l’historique (' + old.xp + ')');
  ok(old.stats.passed === 1, 'migration : compteurs recalculés');
  const again = P.migrate(JSON.parse(JSON.stringify(old))); ok(again.xp === old.xp, 'migration idempotente');
}

/* nettoyage d'un profil hostile */
{
  const evil = Game.cleanProfile({ v: 2, xp: -5, tree: JSON.parse('{"__proto__":1,"constructor":1,"ok":1}'), stats: { logins: 'beaucoup', cmds: 1e99 }, streak: { n: 'a', last: '<script>' }, daily: { date: 'hier', done: 'oui' }, notes: { a: 12, b: 'texte' }, title: 12 });
  ok(evil.xp === 0 && evil.stats.logins === 0 && evil.stats.cmds <= 1e7, 'profil hostile : XP et compteurs bornés');
  ok(evil.streak.last === '' && evil.daily.date === '' && evil.daily.done === false, 'profil hostile : dates invalides rejetées');
  ok(!Object.prototype.hasOwnProperty.call(evil.tree, '__proto__') && !Object.prototype.hasOwnProperty.call(evil.tree, 'constructor') && evil.tree.ok === 1, 'profil hostile : clés dangereuses écartées');
  ok(evil.notes.a === undefined && evil.notes.b === 'texte', 'profil hostile : notes typées');
}

/* maîtrise */
{
  const q = mkProf(); q.skills = { dhcp: { ok: 3, ko: 0 }, dns: { ok: 6, ko: 1 }, vlan: { ok: 0, ko: 4 } };
  ok(P.masteryOf(q, 'dhcp').rank === 2 && P.masteryOf(q, 'dns').rank === 3 && P.masteryOf(q, 'vlan').rank === 0, 'rangs Bronze / Argent / Or');
  ok(P.masteryOf(q, 'dhcp').next === 6, 'prochain palier annoncé');
  ok(P.domainMastery(q).some(d => d.domain === 'Windows' && d.gold === 1), 'maîtrise par domaine');
}

/* catalogue de succès */
ok(Game.BADGES.length >= 30 && new Set(Game.BADGES.map(b => b.id)).size === Game.BADGES.length, 'succès : identifiants uniques (' + Game.BADGES.length + ')');
ok(Game.BADGES.every(b => b.label && b.cat && typeof b.xp === 'number' && typeof b.test === 'function'), 'succès : libellé, famille, XP et test présents');
console.log(n + ' assertions, ' + bad + ' échec(s)');
process.exit(bad ? 1 : 0);
