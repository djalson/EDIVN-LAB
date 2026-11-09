/* Campagne : rattachement des pannes aux chapitres, périmètre, tirage, examen, déblocage, révision espacée, profils hostiles.
   Joue la campagne entière (du chapitre 1 à la fin) avec les corrections de test. */
'use strict';
const SIM = require('./load.js')(); const G = SIM.game, F = SIM.fault, C = SIM.camp, P = SIM.prog;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
let now = 0; const clock = () => now;
const solve = m => {
  m.parts.forEach(p => { F.runSteps(m.W, p.fix || p.fixes[Object.keys(p.fixes)[0]], { inst: p }); now += 5000; m.act({ kind: 'ui', dev: 'x', text: 'correction ' + p.id, mutates: true }); });
  m.parts.forEach(p => { const pats = ((p.verify && p.verify.length) ? p.verify : F.defaultVerify(p)); m.W.observe(pats[0].replace(/\*/g, 'test'), true); });
  m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'test client' });
};
const good = m => { const a = {}; m.reportSpec().questions.forEach(q => { a[q.id] = q.answer; }); return a; };
const play = (p, spec, o) => { o = o || {}; now = 0; const m = G.create(Object.assign({ clock, profile: p, mode: 'free' }, spec)); if (o.giveUp) m.giveUp(); else { solve(m); if (m.state !== 'done') throw new Error('non résolue : ' + m.fault.id); m.fileReport(o.wrong ? {} : good(m)); } return { m, rec: G.record(m, p) }; };

/* --- chapitres et rattachement --- */
const chs = C.chapters();
ok(chs.length === 11 && chs.every((c, i) => c.n === i + 1), '11 chapitres numérotés de 1 à 11');
const world = Object.keys(SIM.buildHealthyWorld().dev);
const declared = [].concat.apply([], chs.map(c => c.devices));
ok(world.every(d => declared.indexOf(d) >= 0), 'chaque équipement du monde appartient à un chapitre : manquants ' + world.filter(d => declared.indexOf(d) < 0).join(','));
ok(declared.filter(d => d !== 'PATCH-T').every(d => world.indexOf(d) >= 0), 'aucun équipement inconnu dans les chapitres : ' + declared.filter(d => d !== 'PATCH-T' && world.indexOf(d) < 0).join(','));
ok(new Set(declared).size === declared.length, 'aucun équipement dans deux chapitres');
let total = 0; chs.forEach(c => { const pool = C.pool(c.n); total += pool.length; ok(pool.length >= c.need, 'chapitre ' + c.n + ' : ' + pool.length + ' pannes pour ' + c.need + ' à valider'); });
ok(total === SIM.faults.length, 'toute panne du catalogue a un chapitre (' + total + ' / ' + SIM.faults.length + ')');
Object.keys(SIM.CHAPTER_RULES.skills).forEach(s => ok(!!SIM.skills[s], 'règle de chapitre sur une compétence existante : ' + s));
ok(C.faultChapter(SIM.faults.find(d => d.id === 'phys_eth')) === 1 && C.faultChapter(SIM.faults.find(d => d.id === 'ospf_timers')) === 10 && C.faultChapter(SIM.faults.find(d => d.id === 'multi_share')) === 11, 'rattachements témoins');
/* une panne n'exige jamais un équipement hors du périmètre de son chapitre (graine dérivée) */
let out = 0; SIM.faults.forEach(d => { const ch = C.faultChapter(d); const s = C.seedInScope(d, 'x', ch); const scope = C.scope(ch); if (!C.devsOf(F.instantiate(d, s)).every(x => scope.indexOf(x) >= 0)) out++; });
ok(out === 0, 'toute panne a une variante jouable dans le périmètre de son chapitre (hors périmètre : ' + out + ')');
ok(C.scope(1).length === 7 && C.scope(11).length === declared.length && C.sites(1).join() === 'toulouse' && C.sites(11).length === 6, 'périmètre : 7 équipements au chapitre 1, tout au dernier');

/* --- profil neuf --- */
let p = G.cleanProfile(null);
ok(p.camp && C.unlocked(p) === 1 && !C.finished(p), 'profil neuf : chapitre 1');
let st = C.chapterState(p, 1); ok(st.unlocked && !st.examReady && st.validated === 0, 'chapitre 1 ouvert, examen fermé');
ok(!C.chapterState(p, 2).unlocked, 'chapitre 2 fermé');

/* --- tirage : les plus simples d'abord, déterministe --- */
const t1 = C.next(p, 1, 's1'), t1b = C.next(p, 1, 's1');
ok(t1.faultId === t1b.faultId && t1.seed === t1b.seed, 'tirage déterministe');
ok(t1.level === 1 && C.faultChapter(t1.def) === 1, 'premier ticket : niveau 1 du chapitre 1');

/* --- échec → révision espacée --- */
let r = play(p, C.next(p, 1, 'a'), { giveUp: true });
ok(r.rec.camp && !r.rec.camp.passed && p.camp.review.length === 1 && p.camp.review[0].due === 1 + C.REVIEW_GAP, 'abandon : panne mise en révision');
const failed = r.m.fault.id;
ok(C.dueReviews(p).length === 0, 'pas encore à échéance');
r = play(p, C.next(p, 1, 'b')); r = play(p, C.next(p, 1, 'c'));
ok(C.dueReviews(p).some(d => d.id === failed), 'à échéance deux tickets plus tard');
const rv = C.next(p, 1, 'd'); ok(rv.faultId === failed && rv.camp.review, 'la panne à revoir est servie');
r = play(p, rv); ok(!p.camp.review.some(x => x.id === failed), 'réussie et comprise : retirée de la révision');
/* réparée sans avoir compris : validée, mais revient */
r = play(p, C.next(p, 1, 'e'), { wrong: true });
ok(r.m.result.passed && p.camp.ok[r.m.fault.id] >= G.PASS && p.camp.review.some(x => x.id === r.m.fault.id), 'fiche fausse : ticket validé, panne mise en révision');
ok((p.skills[r.m.fault.skills[0]] || {}).ko >= 1, 'fiche fausse : compétence non comptée comme maîtrisée');

/* --- campagne entière --- */
p = G.cleanProfile(null); let tickets = 0; const seenFaults = new Set();
for (const c of chs) {
  ok(C.unlocked(p) === c.n, 'chapitre ' + c.n + ' atteint');
  let guard = 0;
  while (!C.chapterState(p, c.n).examReady && guard++ < 40) { const sp = C.next(p, c.n, 'run' + tickets); const res = play(p, sp); tickets++; seenFaults.add(res.m.fault.id);
    const sc = C.missionScope(res.m); ok(res.m.parts.every(pt => C.devsOf(pt).every(d => sc.devs.indexOf(d) >= 0)), 'périmètre de mission couvre la panne ' + res.m.fault.id); }
  st = C.chapterState(p, c.n); ok(st.examReady && st.validated === st.need, 'chapitre ' + c.n + ' : examen ouvert après ' + st.need + ' tickets validés (' + st.validated + ')');
  const ex = C.exam(p, c.n, 'e' + c.n); ok(ex.mode === 'timed' && ex.camp.exam, 'examen chronométré');
  /* examen raté : rien ne s'ouvre */
  let res = play(p, ex, { giveUp: true }); ok(C.unlocked(p) === c.n && !res.rec.camp.unlocked, 'examen raté : chapitre suivant fermé');
  const xp0 = p.xp; res = play(p, ex);
  ok(res.m.result.passed, 'examen ' + c.n + ' réussi (' + res.m.result.total + ')');
  ok(res.m.mode.id === 'timed' && res.m.parts.length === (c.examParts || 2), 'examen ' + c.n + ' : ' + res.m.parts.length + ' panne(s)');
  if (res.m.parts.length > 1) ok(res.m.parts.some(pt => C.faultChapter(pt.def) === c.n) && res.m.parts.every(pt => C.faultChapter(pt.def) <= c.n), 'examen ' + c.n + ' : pannes du périmètre connu, dont une du chapitre');
  ok(res.rec.prog.parts.some(x => /Examen de chapitre/.test(x.label)) && p.xp - xp0 >= C.EXAM_XP, 'bonus d’XP du premier examen réussi');
  if (c.n < chs.length) ok(res.rec.camp.unlocked === c.n + 1, 'chapitre ' + (c.n + 1) + ' débloqué'); else ok(res.rec.camp.finished && C.finished(p), 'campagne terminée');
  const xp1 = p.xp; res = play(p, ex); ok(!res.rec.prog.parts.some(x => /Examen de chapitre/.test(x.label)), 'pas de second bonus en repassant l’examen');
}
console.log('  campagne jouée en ' + tickets + ' tickets + ' + chs.length + ' examens ; niveau atteint ' + P.levelOf(p.xp).level);
ok(tickets === chs.reduce((a, c) => a + c.need, 0), 'nombre de tickets = somme des objectifs');
/* après la fin : le tirage continue (pannes pas encore validées, puis les moins bien réussies) */
const more = C.next(p, 3, 'z'); ok(more && !seenFaults.has(more.faultId), 'après l’examen, le chapitre propose encore des pannes non jouées');

/* --- le bac à sable n'écrit rien dans la campagne --- */
{ const q = G.cleanProfile(null); now = 0; const m = G.create({ clock, profile: q, level: 1, mode: 'free', seed: 'sb', faultId: 'phys_eth' }); solve(m); m.fileReport(good(m)); const rec = G.record(m, q);
  ok(rec.camp === null && Object.keys(q.camp.ok).length === 0 && C.unlocked(q) === 1, 'bac à sable : aucune progression de campagne'); }

/* --- profils hostiles --- */
const evil = G.cleanProfile({ v: 2, camp: { ok: JSON.parse('{"__proto__":100,"phys_eth":"abc","phys_wall":9999,"x":-4}'), exams: { 1: 100, 2: 'oui', 99: 100, '-1': 100 }, seen: 'non', review: [{ id: 5 }, null, { id: 'phys_eth', due: 'demain' }], n: 1e99 } });
ok(evil.camp.ok.phys_wall === 100 && evil.camp.ok.phys_eth === undefined && evil.camp.ok.x === undefined && Object.keys(evil.camp.ok).indexOf('__proto__') < 0, 'notes bornées et typées');
ok(evil.camp.exams[1] === 100 && evil.camp.exams[2] === undefined && evil.camp.exams[99] === undefined, 'examens bornés');
ok(evil.camp.review.length === 1 && evil.camp.review[0].due === 0 && evil.camp.n === 1e6, 'révision et compteur nettoyés');
ok(C.unlocked(G.cleanProfile({ v: 2, camp: { exams: { 3: 100 } } })) === 1, 'un examen réussi « au milieu » n’ouvre rien');
ok(JSON.stringify(G.cleanProfile({ v: 2, camp: 'x' }).camp) === JSON.stringify(C.blank()), 'campagne illisible → vierge');

console.log(n + ' contrôles, ' + bad + ' échec' + (bad > 1 ? 's' : ''));
process.exit(bad ? 1 : 0);
