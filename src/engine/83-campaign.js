/* ============================================================================
   Campagne : progression par chapitres. Chaque chapitre élargit le périmètre d'intervention (équipements visibles),
   propose les pannes de ce périmètre, puis un examen de chapitre (chronométré) qui ouvre le suivant.
   Aucune dépendance au DOM : testable sous Node (tests/campaign.js).

   - Le monde simulé n'est JAMAIS modifié par la campagne : seul change ce que la carte montre (périmètre) et
     ce que le tirage propose (pannes du chapitre). Le bac à sable reste donc strictement le jeu d'origine.
   - Rien n'est stocké qui puisse se déduire : le chapitre atteint se lit sur les examens réussis.
   - Révision espacée : une panne ratée (ou réparée sans avoir compris la cause) revient deux tickets plus tard.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, F = SIM.fault, Game = SIM.game;
const C = SIM.camp = {};

C.REVIEW_GAP = 2;          /* une panne à revoir revient après ce nombre de tickets */
C.EXAM_XP = 150;           /* XP d'un examen de chapitre réussi pour la première fois */
C.chapters = () => SIM.CHAPTERS || [];
C.chapter = n => C.chapters().find(c => c.n === n) || null;
C.last = () => C.chapters().length;

/* ------------------------------------------------------------------ périmètre */
let devCh = null;
C.devChapter = function (id) {
  if (!devCh) { devCh = {}; C.chapters().forEach(c => c.devices.forEach(d => { if (devCh[d] === undefined) devCh[d] = c.n; })); }
  return devCh[id] === undefined ? C.last() : devCh[id];
};
/* équipements visibles jusqu'au chapitre n inclus */
C.scope = function (n) { const out = []; C.chapters().forEach(c => { if (c.n <= n) c.devices.forEach(d => { if (out.indexOf(d) < 0) out.push(d); }); }); return out; };
C.sites = function (n) { const out = []; C.chapters().forEach(c => { if (c.n <= n) c.sites.forEach(s => { if (out.indexOf(s) < 0) out.push(s); }); }); return out; };

/* équipements nommés par une panne instanciée (injection, corrections, sondes, ticket) */
let devRe = null;
C.devsOf = function (inst) {
  if (!devRe) { const ids = Object.keys(SIM.buildHealthyWorld().dev); devRe = ids.map(id => [id, new RegExp('(^|[^A-Za-z0-9-])' + id.replace(/-/g, '\\-') + '([^A-Za-z0-9-]|$)')]); }
  const js = JSON.stringify([inst.inject, inst.fix, inst.fixes, inst.probes, inst.roots, inst.ticket && inst.ticket.from, inst.verify]);
  return devRe.filter(x => x[1].test(js)).map(x => x[0]);
};
const maxCh = devs => devs.reduce((a, d) => Math.max(a, C.devChapter(d)), 1);

/* ------------------------------------------------------------------ rattachement panne → chapitre (calculé, mis en cache) */
let faultCh = null;
C.faultChapter = function (def) {
  if (!faultCh) faultCh = {};
  if (faultCh[def.id] !== undefined) return faultCh[def.id];
  const R = SIM.CHAPTER_RULES || { skills: {}, prefix: {} };
  let n = Infinity;
  F.variantCombos(def, 24).forEach(c => { n = Math.min(n, maxCh(C.devsOf(F.instantiate(def, 'ch', c)))); });
  if (!isFinite(n)) n = 1;
  (def.skills || []).forEach(s => { if (R.skills[s]) n = Math.max(n, R.skills[s]); });
  Object.keys(R.prefix).forEach(p => { if (def.id.indexOf(p) === 0) n = R.prefix[p]; });
  return (faultCh[def.id] = Math.min(C.last(), n));
};
C.isBase = def => !SIM.BASE_FAULT_IDS || SIM.BASE_FAULT_IDS.indexOf(def.id) >= 0;
/* la campagne ne propose que des pannes qu'un joueur peut réparer */
C.pool = function (n) { return SIM.faults.filter(d => C.isBase(d) && C.faultChapter(d) === n && !(SIM.isRetiredFault && SIM.isRetiredFault(d.id))); };
C.resetCache = function () { faultCh = null; devCh = null; devRe = null; };

/* Graine dérivée dont la variante tient dans le périmètre du chapitre (une panne à variantes peut viser un serveur
   qui n'est pas encore au programme) ; à défaut, la graine d'origine : la carte ajoutera les équipements manquants. */
C.seedInScope = function (def, seed, n) {
  const scope = C.scope(n);
  for (let k = 0; k < 24; k++) { const s = k ? seed + '~' + k : String(seed); if (C.devsOf(F.instantiate(def, s)).every(d => scope.indexOf(d) >= 0)) return s; }
  return String(seed);
};

/* ------------------------------------------------------------------ état de la campagne (lu sur le profil) */
C.blank = () => ({ ok: {}, exams: {}, seen: {}, review: [], n: 0, examTk: {}, examLast: {}, ev: 2 });
C.clean = function (c) {
  const out = C.blank(); if (!c || typeof c !== 'object' || Array.isArray(c)) return out;
  const okKey = k => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  const note = v => (typeof v === 'number' && isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0);
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  if (obj(c.ok)) Object.keys(c.ok).filter(okKey).slice(0, 600).forEach(k => { const v = note(c.ok[k]); if (v) out.ok[k.slice(0, 60)] = v; });
  if (obj(c.exams)) Object.keys(c.exams).filter(okKey).slice(0, 40).forEach(k => { const i = parseInt(k, 10), v = note(c.exams[k]); if (i >= 1 && i <= 40 && v) out.exams[i] = v; });
  if (obj(c.seen)) Object.keys(c.seen).filter(okKey).slice(0, 40).forEach(k => { const i = parseInt(k, 10); if (i >= 1 && i <= 40 && c.seen[k]) out.seen[i] = 1; });
  if (Array.isArray(c.review)) out.review = c.review.filter(obj).slice(0, 60).filter(x => typeof x.id === 'string').map(x => ({ id: x.id.slice(0, 60), due: typeof x.due === 'number' && isFinite(x.due) ? Math.max(0, Math.floor(x.due)) : 0 }));
  out.n = typeof c.n === 'number' && isFinite(c.n) ? Math.min(1e6, Math.max(0, Math.floor(c.n))) : 0;
  /* tickets d'examen : meilleure note par chapitre et par ticket ; dernier ticket joué (pour « refaire le même ») */
  if (obj(c.examTk)) Object.keys(c.examTk).filter(okKey).slice(0, 40).forEach(k => { const i = parseInt(k, 10); if (!(i >= 1 && i <= 40) || !obj(c.examTk[k])) return; const row = {}; Object.keys(c.examTk[k]).slice(0, 12).forEach(j => { const t = parseInt(j, 10), v = note(c.examTk[k][j]); if (t >= 0 && t < 12 && v) row[t] = v; }); if (Object.keys(row).length) out.examTk[i] = row; });
  if (obj(c.examLast)) Object.keys(c.examLast).filter(okKey).slice(0, 40).forEach(k => { const i = parseInt(k, 10), t = c.examLast[k]; if (i >= 1 && i <= 40 && typeof t === 'number' && t >= 0 && t < 12) out.examLast[i] = Math.floor(t); });
  /* profils d'avant le réordonnancement des séries (ev absent) : les numéros de ticket suivaient l'ordre « plus difficile d'abord » (= t.sk) */
  if (c.ev !== 2) {
    Object.keys(out.examTk).forEach(i => { const set = C.examSet(+i); const row = {}; Object.keys(out.examTk[i]).forEach(j => { const t = set.find(x => x.sk === +j); if (t) row[t.k] = out.examTk[i][j]; }); out.examTk[i] = row; });
    Object.keys(out.examLast).forEach(i => { const t = C.examSet(+i).find(x => x.sk === out.examLast[i]); if (t) out.examLast[i] = t.k; else delete out.examLast[i]; });
  }
  return out;
};
const campOf = p => (p.camp = p.camp || C.blank());
C.examPassed = (p, n) => (campOf(p).exams[n] || 0) >= Game.PASS;
/* chapitre le plus avancé ouvert : 1 + nombre d'examens réussis à la suite */
C.unlocked = function (p) { let n = 1; while (n < C.last() && C.examPassed(p, n)) n++; return n; };
C.finished = p => C.examPassed(p, C.last());
C.chapterState = function (p, n) {
  const ch = C.chapter(n), pool = C.pool(n), c = campOf(p);
  const validated = pool.filter(d => (c.ok[d.id] || 0) >= Game.PASS).length;
  const need = Math.min(ch.need, pool.length);
  const unlocked = n <= C.unlocked(p);
  return { n, ch, pool: pool.length, validated, need, unlocked, examReady: unlocked && validated >= need, examBest: c.exams[n] || 0, done: C.examPassed(p, n), seen: !!c.seen[n] };
};
C.state = function (p) { const cur = C.unlocked(p); return { current: cur, finished: C.finished(p), chapters: C.chapters().map(c => C.chapterState(p, c.n)), review: C.dueReviews(p).length }; };
C.markSeen = function (p, n) { campOf(p).seen[n] = 1; };

/* ------------------------------------------------------------------ tirage du prochain ticket */
C.dueReviews = function (p) { const c = campOf(p), cur = C.unlocked(p); return c.review.filter(r => r.due <= c.n).map(r => SIM.faults.find(d => d.id === r.id)).filter(d => d && C.faultChapter(d) <= cur); };
/* Prochain ticket du chapitre n : d'abord une panne à revoir arrivée à échéance, sinon une panne pas encore validée
   (les plus simples d'abord), sinon la moins bien réussie. Renvoie de quoi créer la mission. */
C.next = function (p, n, seed, opts) {
  opts = opts || {}; const c = campOf(p); const rng = U.rng('camp|' + n + '|' + seed);
  let def = null, review = false;
  if (!opts.noReview) { const due = C.dueReviews(p).filter(d => C.faultChapter(d) === n || opts.anyChapter); if (due.length) { def = due[0]; review = true; } }
  if (!def) {
    const pool = C.pool(n); if (!pool.length) return null;
    const todo = pool.filter(d => (c.ok[d.id] || 0) < Game.PASS);
    if (todo.length) { const lv = Math.min.apply(null, todo.map(d => d.level)); const played = d => ((p.done || {})[d.id] || {}).count || 0; const easy = todo.filter(d => d.level === lv); const min = Math.min.apply(null, easy.map(played)); def = rng.pick(easy.filter(d => played(d) === min)); }
    else { const worst = Math.min.apply(null, pool.map(d => c.ok[d.id] || 0)); def = rng.pick(pool.filter(d => (c.ok[d.id] || 0) === worst)); }
  }
  const ch = C.faultChapter(def);
  return { faultId: def.id, level: def.level, seed: C.seedInScope(def, seed, Math.max(n, ch)), camp: { ch: n, review }, def };
};
/* Examen du chapitre n : deux pannes de natures différentes prises dans le périmètre connu, dont une au moins du chapitre ;
   chronométré, sans indice. Si le chapitre ne permet pas d'assembler deux pannes (chapitre 1 : pannes de niveau 1), une seule panne, la plus difficile. */
/* ------------------------------------------------------------------ examens : une série fixe de tickets par chapitre
   Chaque chapitre a jusqu'à C.EXAM_TICKETS tickets d'examen, chacun ancré sur une panne DIFFÉRENTE du chapitre (les plus difficiles d'abord,
   compétences variées), puis présentée du plus simple au plus difficile : la panne la plus dure ferme la série au lieu de l'ouvrir
   (chapitre 1 : le fichier hosts, qui demandait plusieurs essais, est le dernier ticket). Un ticket d'examen est fixe : le rejouer redonne exactement le même incident. Réussir n'importe lequel ouvre le
   chapitre suivant ; les réussir tous donne le badge du chapitre. Avant : un seul tirage « parmi les plus difficiles », qui retombait
   toujours sur la même panne quand le chapitre n'en avait qu'une au niveau le plus haut (chapitre 1 : toujours le fichier hosts). */
C.EXAM_TICKETS = 5;
const examSetCache = {};
C.examSet = function (n) {
  if (examSetCache[n]) return examSetCache[n];
  const unproven = (SIM.UNPROVEN_FAULTS || []).map(u => u.fault);
  let pool = C.pool(n).filter(d => unproven.indexOf(d.id) < 0 && !(SIM.isRetiredFault && SIM.isRetiredFault(d.id)));
  /* examen à plusieurs pannes : une panne d'ancrage trop simple pour être assemblée (niveau < F.COMBO_MIN_LEVEL) donnerait un examen
     à une seule panne ; on la laisse de côté tant qu'il en reste d'autres (chapitre 9 : phys_eth_rv, ipv4_gw_rv) */
  const ch = C.chapter(n); const combo = pool.filter(d => d.level >= F.COMBO_MIN_LEVEL);
  if ((ch && ch.examParts || 2) >= 2 && combo.length) pool = combo;
  /* les plus difficiles d'abord ; à niveau égal, des compétences différentes */
  const sorted = pool.slice().sort((a, b) => (b.level - a.level) || (U.hash8(a.id) < U.hash8(b.id) ? -1 : 1));
  const pick = [], skills = [];
  sorted.forEach(d => { if (pick.length >= C.EXAM_TICKETS) return; const k = (d.skills || [])[0]; if (skills.indexOf(k) < 0) { pick.push(d); skills.push(k); } });
  sorted.forEach(d => { if (pick.length < C.EXAM_TICKETS && pick.indexOf(d) < 0) pick.push(d); });
  /* sk : rang dans la sélection (« plus difficile d'abord ») ; il fixe la graine du ticket, qui reste donc le même incident qu'avant */
  const order = pick.map((d, sk) => ({ d, sk })).sort((a, b) => (a.d.level - b.d.level) || (b.sk - a.sk));
  return (examSetCache[n] = order.map((o, k) => ({ k, sk: o.sk, anchor: o.d.id, level: o.d.level, title: o.d.title })));
};
C.examProgress = function (p, n) { const set = C.examSet(n); const row = campOf(p).examTk[n] || {}; const passed = set.filter(t => (row[t.k] || 0) >= Game.PASS).length; return { total: set.length, passed, all: set.length > 0 && passed === set.length, notes: set.map(t => row[t.k] || 0), last: campOf(p).examLast[n] }; };
/* le ticket proposé par défaut : le premier pas encore réussi ; tous réussis → un ticket au hasard */
C.examNext = function (p, n, seed) { const pr = C.examProgress(p, n); const todo = pr.notes.map((v, k) => v >= Game.PASS ? -1 : k).filter(k => k >= 0); if (todo.length) { const notLast = todo.filter(k => k !== pr.last); return (notLast.length ? notLast : todo)[0]; } return U.rng('examany|' + n + '|' + seed).int(pr.total); };
/* la spécification d'un ticket d'examen (opts.k : numéro du ticket ; défaut : C.examNext) */
C.exam = function (p, n, seed, opts) {
  opts = opts || {}; const ch = C.chapter(n); const set = C.examSet(n); if (!set.length) throw new Error('aucune panne d’examen dans ce chapitre');
  const k = typeof opts.k === 'number' && opts.k >= 0 && opts.k < set.length ? opts.k : C.examNext(p, n, seed); const tk = set[k];
  const known = []; for (let i = 1; i <= n; i++) C.pool(i).forEach(d => known.push(d.id));
  const unproven = (SIM.UNPROVEN_FAULTS || []).map(u => u.fault); const count = ch.examParts || 2;
  const camp = { ch: n, exam: true, examK: k, examN: set.length };
  if (count >= 2) {
    /* assemblage figé pour ce ticket : la panne d'ancrage + des pannes déjà vues, validé par simulation (quelques graines dérivées) */
    for (let j = 0; j < 6; j++) { const s = 'exam|' + n + '|t' + tk.sk + (j ? '~' + j : ''); try { const b = F.bundle(s, { count, pool: known, anchor: [tk.anchor], exclude: unproven, mode: 'indep' }); if (b.parts.some(x => x.id === tk.anchor)) return { level: 3, mode: 'timed', seed: s, parts: count, bundle: { count, pool: known, anchor: [tk.anchor], exclude: unproven, mode: 'indep', seed: s }, camp }; } catch (e) { /* graine suivante */ } }
  }
  const def = SIM.faults.find(d => d.id === tk.anchor);
  return { level: def.level, mode: 'timed', seed: C.seedInScope(def, 'exam|' + n + '|t' + tk.sk, n), parts: 1, faultId: def.id, camp };
};
/* périmètre affiché pendant une mission de campagne : celui du chapitre, complété des équipements que la panne nomme */
C.missionScope = function (m) {
  if (!m.camp) return null;
  const n = Math.max(m.camp.ch, 1); const devs = C.scope(n).slice(); const sites = C.sites(n).slice();
  m.parts.forEach(pt => C.devsOf(pt).forEach(d => { if (devs.indexOf(d) < 0) devs.push(d); }));
  return { devs, sites, n };
};

/* ------------------------------------------------------------------ enregistrement d'une mission */
/* Appelé par Game.record pour TOUTE mission (la révision espacée vaut aussi hors campagne). Renvoie ce que le débrief affiche. */
C.record = function (p, m, r) {
  const c = campOf(p); const before = C.unlocked(p); c.n++;
  const understood = !(r.report && r.report.causeOk === false);
  /* révision espacée : ratée ou cause non comprise → reviendra ; validée et comprise → retirée de la liste */
  m.parts.forEach(pt => {
    if (!C.isBase(pt)) return; const i = c.review.findIndex(x => x.id === pt.id);
    if (r.passed && understood) { if (i >= 0) c.review.splice(i, 1); }
    else if (i >= 0) c.review[i].due = c.n + C.REVIEW_GAP; else { c.review.push({ id: pt.id, due: c.n + C.REVIEW_GAP }); if (c.review.length > 60) c.review.shift(); }
  });
  if (!m.camp) return null;
  const n = m.camp.ch; const out = { ch: n, exam: !!m.camp.exam, review: !!m.camp.review, passed: !!r.passed };
  const readyBefore = C.chapterState(p, n).examReady;
  if (m.camp.exam) {
    const first = !C.examPassed(p, n); const allBefore = C.examProgress(p, n).all;
    if (typeof m.camp.examK === 'number') { const row = c.examTk[n] = c.examTk[n] || {}; row[m.camp.examK] = Math.max(row[m.camp.examK] || 0, r.total || 0); c.examLast[n] = m.camp.examK; }
    if (r.passed) { c.exams[n] = Math.max(c.exams[n] || 0, r.total); if (first) { out.examFirst = true; m.camp.examFirst = true; } }
    const pr = C.examProgress(p, n); out.examK = m.camp.examK; out.examPassedN = pr.passed; out.examTotal = pr.total; if (pr.all && !allBefore) out.examAll = true;
  }
  else if (r.passed) m.parts.forEach(pt => { if (C.isBase(pt)) c.ok[pt.id] = Math.max(c.ok[pt.id] || 0, r.total); });
  const st = C.chapterState(p, n); out.validated = st.validated; out.need = st.need; out.pool = st.pool; out.examReady = st.examReady; out.examNowReady = st.examReady && !readyBefore && !st.done;
  const after = C.unlocked(p); if (after > before) out.unlocked = after;
  if (m.camp.exam && r.passed && n === C.last() && out.examFirst) out.finished = true;
  return out;
};
/* le profil porte la campagne : nettoyée comme le reste (un profil lu dans le stockage n'est jamais de confiance) */
const cleanBase = Game.cleanProfile;
Game.cleanProfile = function (p) { const out = cleanBase(p); out.camp = C.clean(p && typeof p === 'object' ? p.camp : null); return out; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
