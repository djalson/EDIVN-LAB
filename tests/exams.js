/* Examens de chapitre : une série fixe de tickets différents par chapitre, « refaire le même » / « ticket suivant »,
   progression par ticket, badge à 100 %. Régression : le chapitre 1 retombait toujours sur la même panne (fichier hosts). */
const SIM = require('./load.js')(); const C = SIM.camp, Game = SIM.game, F = SIM.fault;
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const prof = () => Game.cleanProfile({});
for (const ch of SIM.CHAPTERS) {
  const set = C.examSet(ch.n); const ids = set.map(t => t.anchor);
  ok(set.length >= Math.min(4, C.pool(ch.n).length) && new Set(ids).size === ids.length, 'chapitre ' + ch.n + ' : ' + set.length + ' tickets d’examen, pannes toutes différentes (' + ids.join(', ') + ')');
  /* chaque ticket se construit, contient sa panne d'ancrage, et se rejoue à l'identique */
  const bad = [];
  set.forEach(t => { let sp, m, m2; try { sp = C.exam(prof(), ch.n, 'x', { k: t.k }); m = Game.create(Object.assign({}, sp)); m2 = Game.create(Object.assign({}, C.exam(prof(), ch.n, 'autre graine', { k: t.k }))); } catch (e) { bad.push(t.anchor + ' : ' + e.message); return; }
    if (!m.parts.some(x => x.id === t.anchor)) bad.push(t.anchor + ' absente du ticket');
    if (JSON.stringify(m.parts.map(x => x.id + JSON.stringify(x.vars || {}).length)) !== JSON.stringify(m2.parts.map(x => x.id + JSON.stringify(x.vars || {}).length)) || m.fault.ticket.body !== m2.fault.ticket.body) bad.push(t.anchor + ' : le ticket change d’une fois sur l’autre');
    if (m.camp.examK !== t.k || !m.mode.timed) bad.push(t.anchor + ' : mode ou numéro de ticket');
    if (m.parts.length !== (ch.examParts || 2) && m.parts.length !== 1) bad.push(t.anchor + ' : ' + m.parts.length + ' pannes'); });
  ok(!bad.length, 'chapitre ' + ch.n + ' : chaque ticket se construit, contient sa panne, se rejoue à l’identique' + (bad.length ? ' — ' + bad.join(' ; ') : ''));
}
/* progression : suivant = premier non réussi, jamais le dernier joué tant qu'il reste du choix ; 100 % → badge */
{ const p = prof(); const set = C.examSet(1);
  ok(C.examNext(p, 1, 's') === 0, 'premier examen : ticket 1');
  const play = (k, note) => { const sp = C.exam(p, 1, 's', { k }); const m = Game.create(Object.assign({ profile: p }, sp)); C.record(p, m, { passed: note >= Game.PASS, total: note }); };
  play(0, 60); ok(C.examNext(p, 1, 's') === 1, 'ticket 1 raté : le suivant proposé est le ticket 2 (un autre)');
  ok(C.examProgress(p, 1).last === 0, '« refaire le même » connaît le dernier ticket joué (1)');
  play(1, 90); ok(C.examPassed(p, 1) && C.unlocked(p) === 2, 'un ticket réussi ouvre le chapitre 2');
  ok(C.examNext(p, 1, 's') === 0, 'ensuite : le ticket 1, toujours pas réussi');
  for (let k = 0; k < set.length; k++) if (k !== 1) play(k, 80);
  const pr = C.examProgress(p, 1); ok(pr.all && pr.passed === set.length, 'tous les tickets réussis : ' + pr.passed + ' / ' + pr.total);
  const b = Game.BADGES.find(x => x.id === 'exam100_1'); ok(b && b.test(p), 'badge « Examen à 100 % : Le bureau »');
  ok(!Game.BADGES.find(x => x.id === 'exam100_2').test(p), 'pas de badge pour le chapitre 2');
  const q = Game.cleanProfile(JSON.parse(JSON.stringify(p))); ok(C.examProgress(q, 1).all && C.examProgress(q, 1).last === p.camp.examLast[1], 'progression conservée après sauvegarde et relecture du profil'); }
/* ordre de la série : du plus simple au plus difficile (chapitre 1 : le fichier hosts en dernier) ; examens à plusieurs pannes : jamais d'ancrage seul */
{ const s1 = C.examSet(1); ok(s1[s1.length - 1].anchor === 'dns_hosts' && s1.every((t, i) => !i || t.level >= s1[i - 1].level), 'chapitre 1 : série du plus simple au plus difficile, fichier hosts en dernier (' + s1.map(t => t.anchor).join(', ') + ')');
  const solo = []; SIM.CHAPTERS.filter(ch => (ch.examParts || 2) >= 2).forEach(ch => C.examSet(ch.n).forEach(t => { if (C.exam(prof(), ch.n, 'x', { k: t.k }).parts < 2) solo.push(ch.n + ':' + t.anchor); }));
  ok(!solo.length, 'examens à plusieurs pannes : chaque ticket en assemble bien plusieurs' + (solo.length ? ' — ' + solo.join(', ') : ''));
  /* profil d'avant le réordonnancement (pas de « ev ») : les notes suivent leur panne, pas leur ancien numéro */
  const hosts = s1.find(t => t.anchor === 'dns_hosts'); const old = { examTk: { 1: { [hosts.sk]: 100 } }, examLast: { 1: hosts.sk } };
  const c = C.clean(old); ok(c.examTk[1][hosts.k] === 100 && Object.keys(c.examTk[1]).length === 1 && c.examLast[1] === hosts.k && c.ev === 2, 'ancien profil : la note du ticket hosts reste sur le ticket hosts après réordonnancement');
  const c2 = C.clean(JSON.parse(JSON.stringify(c))); ok(JSON.stringify(c2.examTk) === JSON.stringify(c.examTk), 'migration appliquée une seule fois'); }
/* historique : numéro d'essai par panne (échecs et abandons compris) */
{ const p = prof(); const sp = C.exam(p, 1, 'x', { k: 0 }); const t = () => { const m = Game.create(Object.assign({}, sp)); m.giveUp(); Game.record(m, p); return p.history[p.history.length - 1].try; };
  const a = t(), b = t(), c = t(); ok(a === 1 && b === 2 && c === 3, 'historique : essais numérotés 1, 2, 3 sur la même panne');
  ok(Game.cleanProfile(JSON.parse(JSON.stringify(p))).history[2].try === 3, 'numéro d’essai conservé dans le profil sauvegardé'); }
console.log(fails ? '✗ ' + fails + ' échec(s)' : 'OK'); process.exit(fails ? 1 : 0);
