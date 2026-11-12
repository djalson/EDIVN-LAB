/* ============================================================================
   Progression : expérience (XP) et niveaux, points de compétence et arbre, succès, maîtrise par compétence,
   série quotidienne, ticket du jour, objectifs bonus par ticket.
   Aucune dépendance au DOM : testable sous Node.

   Règle de conception (arbitrée) : RIEN de ce qui est gagné ici ne change la NOTE d'un ticket. L'XP, les points
   et l'arbre n'apportent que du confort (coffre-fort d'identifiants, carnet), du style (thèmes), de l'XP
   supplémentaire ou une tolérance sur la série. Les notes restent ainsi comparables d'un élève à l'autre ;
   les avantages de confort sont coupés en évaluation chronométrée (voir `P.perkActive`).
   Les points disponibles ne sont jamais stockés : ils se déduisent du niveau et de l'arbre acheté.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, Game = SIM.game;
const P = SIM.prog = {};

/* ------------------------------------------------------------------ niveaux */
P.MAX_LEVEL = 40;
/* XP cumulée pour ATTEINDRE le niveau n (niveau 1 = 0). Courbe en puissance : ~17 tickets pour le niveau 10, ~110 pour le niveau 30. */
P.cum = n => n <= 1 ? 0 : Math.round(100 * Math.pow(Math.min(n, P.MAX_LEVEL) - 1, 1.6));
P.levelOf = function (xp) {
  xp = Math.max(0, Math.floor(xp || 0)); let lv = 1;
  while (lv < P.MAX_LEVEL && xp >= P.cum(lv + 1)) lv++;
  const from = P.cum(lv), to = lv >= P.MAX_LEVEL ? from : P.cum(lv + 1);
  return { level: lv, xp, from, to, into: xp - from, need: to - from, pct: lv >= P.MAX_LEVEL ? 100 : Math.round(100 * (xp - from) / (to - from)), max: lv >= P.MAX_LEVEL };
};
P.TITLES = [[1, 'Stagiaire'], [3, 'Technicien N1'], [6, 'Technicien N2'], [10, 'Administrateur'], [14, 'Administrateur confirmé'], [18, 'Ingénieur systèmes'],
  [22, 'Ingénieur réseaux et sécurité'], [26, 'Référent infrastructure'], [30, 'Architecte'], [35, 'Responsable SI'], [40, 'Légende du datacenter']];
P.titleOf = level => { let t = P.TITLES[0][1]; P.TITLES.forEach(x => { if (level >= x[0]) t = x[1]; }); return t; };
/* Points de compétence gagnés en atteignant le niveau n (cumul) : 1 par niveau + 1 de plus aux paliers 10, 20, 30, 40. */
P.pointsEarned = level => Math.max(0, level - 1) + Math.floor(level / 10);

/* ------------------------------------------------------------------ arbre de compétences */
/* auto : propriété offerte dès que le succès est obtenu (aucun point). ach : succès exigé pour pouvoir acheter. req : nœuds exigés. */
P.TREE = [
  { id: 'vault1', branch: 'confort', label: 'Coffre-fort d’identifiants', desc: 'Un bouton clé apparaît à côté des champs identifiant / mot de passe des fenêtres (ouverture de session Windows, élévation de privilèges, bureau à distance, pfSense) et les remplit à ta place. Offert dès le succès « Mémoire des doigts ».', cost: 0, auto: 'fingers', icon: 'key' },
  { id: 'vault2', branch: 'confort', label: 'Coffre-fort : terminaux', desc: 'Le coffre remplit aussi les invites « Password: » des terminaux (SSH, sudo, su, enable) : Ctrl + Espace à l’invite.', cost: 2, req: ['vault1'], ach: 'fingers2', icon: 'terminal' },
  { id: 'notes', branch: 'confort', label: 'Carnet de bord', desc: 'Un bloc-notes par ticket, conservé dans ton profil : hypothèses, commandes utiles, ce qui a marché.', cost: 1, icon: 'note' },
  { id: 'xp1', branch: 'xp', label: 'Curiosité', desc: '+5 % d’XP sur chaque ticket validé.', cost: 2, icon: 'spark' },
  { id: 'xp2', branch: 'xp', label: 'Méthode', desc: '+5 % d’XP supplémentaires (cumulable avec Curiosité).', cost: 3, req: ['xp1'], icon: 'spark' },
  { id: 'goals4', branch: 'xp', label: 'Chasseur de primes', desc: 'Un quatrième objectif bonus par ticket.', cost: 3, icon: 'target' },
  { id: 'shield', branch: 'xp', label: 'Joker de série', desc: 'Un jour sans jouer ne casse pas ta série (une fois toutes les deux semaines).', cost: 2, icon: 'shield' },
  { id: 'titles', branch: 'style', label: 'Titres à la carte', desc: 'Choisis le titre affiché parmi tous ceux que tu as déjà mérités.', cost: 1, icon: 'badge' },
  { id: 'th-rain', branch: 'style', label: 'Thème : Pluie de code', desc: 'Débloque le thème Pluie de code.', cost: 1, theme: 'rain', icon: 'palette' },
  { id: 'th-synth', branch: 'style', label: 'Thème : Synthwave 80s', desc: 'Débloque le thème Synthwave 80s.', cost: 1, theme: 'synth', icon: 'palette' },
  { id: 'th-cyber', branch: 'style', label: 'Thème : Cyberpunk', desc: 'Débloque le thème Cyberpunk.', cost: 1, theme: 'cyber', icon: 'palette' },
  { id: 'th-bit', branch: 'style', label: 'Thème : Console 8-bit', desc: 'Débloque le thème Console 8-bit.', cost: 1, theme: 'bit', icon: 'palette' },
  { id: 'th-amber', branch: 'style', label: 'Thème : Terminal Ambre', desc: 'Débloque le thème Terminal Ambre.', cost: 1, theme: 'amber', icon: 'palette' }
];
P.BRANCHES = [{ id: 'confort', label: 'Confort' }, { id: 'xp', label: 'Réputation' }, { id: 'style', label: 'Style' }];
P.FREE_THEMES = ['neon', 'dev', 'paper'];
P.node = id => P.TREE.find(n => n.id === id);
P.ach = id => Game.BADGES.find(b => b.id === id);
P.hasAch = (p, id) => (p.badges || []).indexOf(id) >= 0;
/* Un nœud est possédé s'il est acheté, ou offert par son succès. */
P.has = function (p, id) {
  const n = P.node(id); if (!n) return false;
  return !!(p.tree && p.tree[id]) || !!(n.auto && P.hasAch(p, n.auto));
};
P.spent = p => P.TREE.reduce((a, n) => a + ((p.tree && p.tree[n.id]) ? n.cost : 0), 0);
P.pointsLeft = p => P.pointsEarned(P.levelOf(p.xp).level) - P.spent(p);
/* Pourquoi on ne peut pas acheter un nœud (null = achat possible). */
P.whyNot = function (p, id) {
  const n = P.node(id); if (!n) return 'Nœud inconnu.';
  if (P.has(p, id)) return 'Déjà possédé.';
  for (const r of n.req || []) if (!P.has(p, r)) return 'Il faut d’abord « ' + P.node(r).label + ' ».';
  if (n.ach && !P.hasAch(p, n.ach)) return 'Succès requis : « ' + (P.ach(n.ach) || { label: n.ach }).label + ' ».';
  if (n.auto && !P.hasAch(p, n.auto)) return 'Se débloque avec le succès « ' + (P.ach(n.auto) || { label: n.auto }).label + ' ».';
  if (P.pointsLeft(p) < n.cost) return 'Il manque ' + (n.cost - P.pointsLeft(p)) + ' point(s) de compétence.';
  return null;
};
P.buy = function (p, id) { const why = P.whyNot(p, id); if (why) return { ok: false, why }; p.tree = p.tree || {}; p.tree[id] = 1; return { ok: true }; };
/* Remise à zéro de l'arbre : les points sont rendus (ils se déduisent de l'arbre acheté). */
P.reset = function (p) { p.tree = {}; if (p.title && !P.has(p, 'titles')) delete p.title; return { ok: true }; };
P.themeOwned = function (p, themeId) {
  if (P.FREE_THEMES.indexOf(themeId) >= 0 || p.giftTheme === themeId) return true;
  if (SIM.rewards && SIM.rewards.THEMES[themeId] !== undefined) return SIM.rewards.themeOwned(p, themeId);   /* thèmes de prestige : au niveau, pas dans l'arbre */
  const n = P.TREE.find(x => x.theme === themeId); return !!n && P.has(p, n.id);
};
/* Les avantages de confort sont coupés en évaluation chronométrée : les notes restent comparables. */
P.perkActive = (mode) => !(mode && (mode.timed === true || mode.id === 'timed'));
P.titlesOwned = level => P.TITLES.filter(t => level >= t[0]).map(t => t[1]);
P.displayTitle = function (p) {
  const lv = P.levelOf(p.xp).level; const owned = P.titlesOwned(lv);
  return (p.title && P.has(p, 'titles') && owned.indexOf(p.title) >= 0) ? p.title : P.titleOf(lv);
};

/* ------------------------------------------------------------------ maîtrise par compétence */
P.MASTERY = [{ rank: 1, label: 'Bronze', need: 1 }, { rank: 2, label: 'Argent', need: 3 }, { rank: 3, label: 'Or', need: 6 }];
/* Une résolution « propre » (validée, sans indice ni action dangereuse) compte pour la compétence (Game.record, champ skills[].ok). */
P.masteryOf = function (p, skillId) {
  const ok = ((p.skills || {})[skillId] || {}).ok || 0; let rank = 0; P.MASTERY.forEach(m => { if (ok >= m.need) rank = m.rank; });
  const nxt = P.MASTERY.find(m => m.rank === rank + 1);
  return { rank, label: rank ? P.MASTERY[rank - 1].label : 'Aucune', ok, next: nxt ? nxt.need : null };
};
P.masteryCounts = function (p) {
  const c = { 1: 0, 2: 0, 3: 0 }; Object.keys(SIM.skills || {}).forEach(id => { const m = P.masteryOf(p, id).rank; for (let r = 1; r <= m; r++) c[r]++; });
  return c;
};
P.domainMastery = function (p) {
  const d = {}; Object.keys(SIM.skills || {}).forEach(id => {
    const s = SIM.skills[id]; if (!s.domaine || s.domaine === 'Méthode') return;
    const o = d[s.domaine] = d[s.domaine] || { domain: s.domaine, total: 0, bronze: 0, silver: 0, gold: 0 };
    const r = P.masteryOf(p, id).rank; o.total++; if (r >= 1) o.bronze++; if (r >= 2) o.silver++; if (r >= 3) o.gold++;
  });
  return Object.keys(d).map(k => d[k]);
};

/* ------------------------------------------------------------------ dates : série et ticket du jour */
P.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
P.dayNum = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; };
P.weekday = s => { const n = P.dayNum(s); return n === null ? 0 : (n + 4) % 7; };       /* 0 = dimanche */
/* Niveau du ticket du jour : lundi → samedi montent en difficulté, le dimanche est un Chaos. */
P.DAILY_LEVELS = [5, 1, 2, 3, 2, 4, 3];
P.daily = function (dateStr) { dateStr = dateStr || P.today(); return { date: dateStr, seed: 'jour-' + dateStr, level: P.DAILY_LEVELS[P.weekday(dateStr)], mode: 'free' }; };
P.dailyDone = (p, dateStr) => !!(p.daily && p.daily.date === (dateStr || P.today()) && p.daily.done);
/* Série : jours consécutifs avec au moins un ticket validé. Le Joker pardonne UN jour manqué, au plus une fois tous les 14 jours. */
P.streakInfo = function (p, dateStr) {
  dateStr = dateStr || P.today(); const s = p.streak || { n: 0, last: '', best: 0 };
  const gap = s.last ? P.dayNum(dateStr) - P.dayNum(s.last) : null;
  let alive = s.n > 0 && gap !== null && gap >= 0;
  let state = 'none';
  if (alive && gap === 0) state = 'today';
  else if (alive && gap === 1) state = 'pending';      /* à jouer aujourd'hui pour la prolonger */
  else if (alive && gap === 2 && P.has(p, 'shield') && P.dayNum(dateStr) - (s.shieldAt || -99) >= 14) state = 'shield';
  else alive = false;
  return { n: alive ? s.n : 0, best: s.best || 0, state, alive };
};
P.streakBonus = n => n >= 2 ? Math.min(0.30, 0.05 * (n - 1)) : 0;

/* ------------------------------------------------------------------ objectifs bonus (graine du ticket) */
const clean = m => !m.hintLog.length && !m.dangers.length && !m.wrongCloses;
P.GOALS = [
  { id: 'nohint', label: 'Résoudre sans demander d’indice', xp: 30, test: m => m.hintLog.length === 0 },
  { id: 'speed', label: 'Résoudre en moins de 75 % du temps cible', xp: 30, test: (m, r) => r.mttrSec <= m.parSec * 0.75 },
  { id: 'nodanger', label: 'Aucune action risquée ni coupure inutile', xp: 25, test: m => m.dangers.length === 0 && m.impacts.length === 0 },
  { id: 'firstclose', label: 'Clôturer du premier coup (aucune clôture prématurée)', xp: 20, test: m => m.wrongCloses === 0 },
  { id: 'precise', label: 'Aucune fausse manip : chaque modification fait avancer le diagnostic', xp: 35, test: m => m.counters.detour === 0 && m.counters.regress === 0 },
  { id: 'rootcause', label: 'Traiter la cause racine : aucun contournement pris pour une résolution', xp: 15, test: m => m.falseRes === 0 }
];
P.goalsFor = function (seed, profile, faultId) {
  const rng = U.rng('goals|' + seed + '|' + (faultId || '')); const n = (profile && P.has(profile, 'goals4')) ? 4 : 3;
  return rng.shuffle(P.GOALS.map(x => x.id)).slice(0, n).map(id => { const g0 = P.GOALS.find(x => x.id === id); return { id, label: g0.label, xp: g0.xp }; });
};
/* Objectifs encore atteignables en cours de ticket (tous sont monotones : une fois perdus, ils le restent). */
P.goalLive = m => (m.goals || []).map(gl => { const def = P.GOALS.find(x => x.id === gl.id); let alive = true; try { alive = !!(def && def.test(m, { mttrSec: m.elapsedSec() })); } catch (e) { alive = true; } return { id: gl.id, label: gl.label, xp: gl.xp, alive }; });
P.goalResults = (m, r) => (m.goals || []).map(gl => { const def = P.GOALS.find(x => x.id === gl.id); return { id: gl.id, label: gl.label, xp: gl.xp, done: !!(r.kind === 'resolved' && def && def.test(m, r)) }; });

/* ------------------------------------------------------------------ XP d'un ticket */
P.BASE_XP = { 1: 60, 2: 100, 3: 160, 4: 230, 5: 300 };
/* prev : { counts: {partId: nombre de parties avant celle-ci}, bests: {partId: meilleure note avant}, } relevé AVANT l'enregistrement. */
P.xpFor = function (m, r, p, prev) {
  const parts = []; const add = (label, xp, kind) => { if (xp) parts.push({ label, xp: Math.round(xp), kind: kind || 'bonus' }); };
  prev = prev || { counts: {}, bests: {} };
  if (!r.passed) {
    add('Participation (chaque échec apprend quelque chose)', 10, 'base');
    return { total: 10, subtotal: 10, parts, mult: [], goals: P.goalResults(m, r) };
  }
  const lvl = m.lv.level; let base = P.BASE_XP[lvl] || 100;
  const ids = m.parts.map(x => x.id); const reps = ids.every(id => (prev.counts[id] || 0) >= 3);
  if (reps) { base = Math.round(base * 0.6); add('Niveau ' + m.lv.label + ' (panne déjà bien connue : 60 %)', base, 'base'); } else add('Niveau ' + m.lv.label, base, 'base');
  if (r.stars === 3) add('Trois étoiles', base * 0.2); else if (r.stars === 2) add('Deux étoiles', base * 0.1);
  if (ids.some(id => !(prev.counts[id] > 0))) add('Première résolution de cette panne', 25);
  else if (ids.some(id => r.total > (prev.bests[id] || 0))) add('Record personnel battu', 20);
  if (clean(m)) add('Sans faute (aucun indice, aucune action risquée)', 20);
  if (r.mttrSec <= m.parSec * 0.5) add('Éclair (moins de la moitié du temps cible)', 20); else if (r.mttrSec <= m.parSec * 0.75) add('Rapide (moins de 75 % du temps cible)', 10);
  if (r.report && r.report.allOk) add('Fiche d’intervention juste', 15);
  if (m.camp && m.camp.examFirst) add('Examen de chapitre réussi', SIM.camp.EXAM_XP);
  const goals = P.goalResults(m, r); goals.filter(x => x.done).forEach(x => add('Objectif : ' + x.label, x.xp, 'goal'));
  let sub = parts.reduce((a, x) => a + x.xp, 0); const mult = [];
  const mul = (label, f) => { if (f !== 1) { mult.push({ label, f }); } };
  if (m.mode && m.mode.id === 'guided') mul('Mode guidé (non classé)', 0.6);
  if (m.daily && !P.dailyDone(p, P.today())) mul('Ticket du jour', 1.5);
  if (m.mystery) mul('Panne mystère', 2);
  const st = P.streakInfo(p, P.today()); const nextStreak = st.state === 'today' ? st.n : (st.alive ? st.n + 1 : 1);
  const sb = P.streakBonus(nextStreak); if (sb) mul('Série de ' + nextStreak + ' jours', 1 + sb);
  /* contrats (85-rewards.js) : uniquement de l'XP, uniquement sur un ticket validé ; « Tout ou rien » annule l'XP sous 90 */
  if (r.passed && m.contracts && m.contracts.length && SIM.rewards) m.contracts.forEach(id => { const c = SIM.rewards.contract(id); if (!c) return; if (id === 'allin') mul('Contrat « ' + c.label + ' »' + (r.total >= 90 ? '' : ' : moins de 90'), r.total >= 90 ? c.f : 0); else mul('Contrat « ' + c.label + ' »', c.f); });
  let perk = 0; if (P.has(p, 'xp1')) perk += 0.05; if (P.has(p, 'xp2')) perk += 0.05; if (perk) mul('Réputation', 1 + perk);
  let total = sub; mult.forEach(x => { total *= x.f; });
  return { total: Math.round(total), subtotal: sub, parts, mult, goals };
};

/* ------------------------------------------------------------------ succès supplémentaires (les 9 d'origine restent dans Game.BADGES) */
/* mission : true = évalué à la fin d'un ticket (m et r fournis) ; sinon évalué aussi hors ticket (compteurs). cat : famille d'affichage. */
const S = p => p.stats || {};
const nDone = p => Object.keys(p.done || {}).filter(k => p.done[k].count > 0).length;
const META = {
  first: { cat: 'Progression', xp: 20, mission: true }, clean: { cat: 'Maîtrise', xp: 30, mission: true }, fast: { cat: 'Maîtrise', xp: 30, mission: true },
  chaos: { cat: 'Progression', xp: 80, mission: true }, cyber: { cat: 'Progression', xp: 60, mission: true }, rootcause: { cat: 'Maîtrise', xp: 40, mission: true },
  perfect: { cat: 'Maîtrise', xp: 60, mission: true }, five: { cat: 'Progression', xp: 30 }, twenty: { cat: 'Progression', xp: 80 }
};
Object.keys(META).forEach(id => { const b = Game.BADGES.find(x => x.id === id); if (b) Object.assign(b, META[id]); });
const addB = (id, cat, label, desc, xp, test, o) => { Game.BADGES.push(Object.assign({ id, cat, label, desc, xp, test }, o || {})); };
/* Progression */
addB('fifty', 'Progression', 'Cinquante tickets validés', 'Cinquante tickets validés, tous niveaux confondus.', 120, p => S(p).passed >= 50);
addB('hundred', 'Progression', 'Cent tickets validés', 'La centaine : tu peux former les autres.', 250, p => S(p).passed >= 100);
addB('explorer', 'Progression', 'Explorateur', 'Dix pannes différentes résolues.', 40, p => nDone(p) >= 10);
addB('cartographer', 'Progression', 'Cartographe', 'Cinquante pannes différentes rencontrées.', 120, p => nDone(p) >= 50);
addB('encyclopedia', 'Progression', 'Encyclopédie vivante', 'Cent pannes différentes rencontrées.', 250, p => nDone(p) >= 100);
addB('lvl10', 'Progression', 'Niveau 10', 'Atteindre le niveau 10.', 50, p => P.levelOf(p.xp).level >= 10);
addB('lvl20', 'Progression', 'Niveau 20', 'Atteindre le niveau 20.', 100, p => P.levelOf(p.xp).level >= 20);
addB('lvl30', 'Progression', 'Niveau 30', 'Atteindre le niveau 30.', 200, p => P.levelOf(p.xp).level >= 30);
/* Maîtrise */
addB('perfect5', 'Maîtrise', 'Perfectionniste', 'Cinq notes de 100 / 100.', 150, p => S(p).perfect >= 5);
addB('clean10', 'Maîtrise', 'Mains propres', 'Dix tickets résolus sans faute.', 100, p => S(p).clean >= 10);
addB('chaosclean', 'Maîtrise', 'Calme dans la tempête', 'Un Chaos résolu sans aucun indice.', 120, (p, m, r) => r.kind === 'resolved' && r.passed && m.lv.level === 5 && !m.hintLog.length, { mission: true });
addB('lightning', 'Maîtrise', 'Foudroyant', 'Un ticket validé en moins de 60 secondes.', 60, (p, m, r) => r.passed && r.mttrSec < 60, { mission: true, secret: true });
addB('goals3', 'Maîtrise', 'Chasseur de primes', 'Tous les objectifs bonus d’un ticket remplis.', 50, (p, m, r) => r.passed && P.goalResults(m, r).every(x => x.done), { mission: true });
addB('goals30', 'Maîtrise', 'Collectionneur d’objectifs', 'Trente objectifs bonus remplis au total.', 120, p => S(p).goals >= 30);
addB('root10', 'Maîtrise', 'Chasseur de causes racines', 'Dix tickets de niveau Admin ou plus sans jamais prendre un contournement pour une résolution.', 100, p => S(p).root >= 10);
addB('bronze10', 'Maîtrise', 'Dix bronzes', 'Dix compétences au moins au rang Bronze.', 60, p => P.masteryCounts(p)[1] >= 10);
addB('silver10', 'Maîtrise', 'Dix argents', 'Dix compétences au moins au rang Argent.', 120, p => P.masteryCounts(p)[2] >= 10);
addB('gold5', 'Maîtrise', 'Cinq ors', 'Cinq compétences au rang Or.', 200, p => P.masteryCounts(p)[3] >= 5);
addB('domaingold', 'Maîtrise', 'Spécialiste', 'Au moins trois compétences au rang Or dans un même domaine.', 150, p => P.domainMastery(p).some(d => d.gold >= 3));
/* Persévérance */
addB('comeback', 'Persévérance', 'Revanche', 'Valider une panne que tu avais échouée.', 40, (p, m, r) => r.passed && m.parts.some(pt => p.history.some(h => h.id === pt.id && h.stars === 0)), { mission: true });
addB('streak3', 'Persévérance', 'Trois jours d’affilée', 'Une série de 3 jours.', 30, p => (p.streak ? Math.max(p.streak.n, p.streak.best || 0) : 0) >= 3);
addB('streak7', 'Persévérance', 'Une semaine d’affilée', 'Une série de 7 jours.', 100, p => (p.streak ? Math.max(p.streak.n, p.streak.best || 0) : 0) >= 7);
addB('streak14', 'Persévérance', 'Quinze jours d’affilée', 'Une série de 14 jours.', 220, p => (p.streak ? Math.max(p.streak.n, p.streak.best || 0) : 0) >= 14);
addB('daily1', 'Persévérance', 'Ticket du jour', 'Valider un ticket du jour.', 30, p => S(p).dailies >= 1);
addB('daily7', 'Persévérance', 'Assidu', 'Sept tickets du jour validés.', 120, p => S(p).dailies >= 7);
/* Habitudes (compteurs hors ticket) */
addB('fingers', 'Habitudes', 'Mémoire des doigts', 'Taper à la main vingt fois un identifiant ou un mot de passe. Les doigts commencent à connaître la musique : un coffre-fort d’identifiants se débloque dans l’arbre.', 40, p => S(p).logins >= 20);
addB('fingers2', 'Habitudes', 'Pianiste', 'Soixante saisies manuelles d’identifiants : le coffre peut remplir aussi les terminaux.', 60, p => S(p).logins >= 60);
addB('fingers3', 'Habitudes', 'Virtuose du clavier', 'Cent cinquante saisies manuelles. Sérieusement, pense au gestionnaire de mots de passe.', 100, p => S(p).logins >= 150, { secret: true });
addB('cmds500', 'Habitudes', 'Cinq cents commandes', 'Cinq cents commandes tapées dans les terminaux.', 60, p => S(p).cmds >= 500);
addB('cmds3000', 'Habitudes', 'Trois mille commandes', 'Trois mille commandes tapées dans les terminaux.', 160, p => S(p).cmds >= 3000);
addB('tour', 'Habitudes', 'Bien orienté', 'Avoir suivi le tutoriel jusqu’au bout.', 15, p => p.tourDone === true);
addB('notes1', 'Habitudes', 'Documentaliste', 'Écrire dans le carnet de bord.', 20, p => S(p).notes >= 1);

/* ------------------------------------------------------------------ comptage et enregistrement */
/* Compteurs hors ticket (saisies d'identifiants, notes) : renvoie les succès et niveaux gagnés. */
P.bump = function (p, key, n) {
  p.stats = p.stats || {}; p.stats[key] = (p.stats[key] || 0) + (n || 1);
  return P.award(p);
};
/* Succès « de ticket » vrais AVANT l'ajout du ticket à l'historique (ex. « premier ticket », « revanche »). N'écrit rien. */
P.collectMission = function (p, m, r) {
  return Game.BADGES.filter(b => b.mission && p.badges.indexOf(b.id) < 0 && (() => { try { return !!b.test(p, m, r); } catch (e) { return false; } })());
};
/* Attribue les succès devenus vrais hors ticket (compteurs, niveaux, historique) ; chacun ajoute son XP. */
P.award = function (p, pre) {
  const before = P.levelOf(p.xp).level; const got = []; let guard = 0, changed = true;
  (pre || []).forEach(b => { if (p.badges.indexOf(b.id) < 0) { p.badges.push(b.id); p.xp = (p.xp || 0) + (b.xp || 0); got.push(b); } });
  while (changed && guard++ < 5) {
    changed = false;
    Game.BADGES.forEach(b => {
      if (b.mission || p.badges.indexOf(b.id) >= 0) return;
      let ok = false; try { ok = !!b.test(p); } catch (e) { ok = false; }
      if (ok) { p.badges.push(b.id); p.xp = (p.xp || 0) + (b.xp || 0); got.push(b); changed = true; }
    });
  }
  const after = P.levelOf(p.xp).level;
  return { newBadges: got, levelUps: after > before ? range(before + 1, after) : [], xpFromBadges: got.reduce((a, b) => a + (b.xp || 0), 0) };
};
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

/* Appelé par Game.record APRÈS la mise à jour de l'historique. prev : relevé d'avant partie. Retourne le bilan affiché au débrief. */
P.apply = function (p, m, r, prev, pre, lvBefore, stBefore) {
  const today = P.today();
  const gx = P.xpFor(m, r, p, prev);
  p.stats = p.stats || {};
  const st = p.stats;
  st.played = (st.played || 0) + 1;
  st.cmds = (st.cmds || 0) + m.trace.filter(x => x.kind === 'cmd').length;
  if (r.passed) {
    st.passed = (st.passed || 0) + 1;
    if (r.perfect) st.perfect = (st.perfect || 0) + 1;
    if (clean(m)) st.clean = (st.clean || 0) + 1;
    if (m.lv.level >= 3 && m.falseRes === 0) st.root = (st.root || 0) + 1;
    st.goals = (st.goals || 0) + gx.goals.filter(x => x.done).length;
  }
  /* série et ticket du jour (compteurs mis à jour avant l'attribution des succès) */
  let streakNote = null;
  if (r.passed) {
    const s = p.streak = p.streak || { n: 0, last: '', best: 0 };
    if (stBefore.state === 'today') { /* déjà comptée aujourd'hui */ }
    else if (stBefore.alive && (stBefore.state === 'pending' || stBefore.state === 'shield')) { s.n = stBefore.n + 1; if (stBefore.state === 'shield') { s.shieldAt = P.dayNum(today); streakNote = 'Joker de série utilisé : ta série continue.'; } s.last = today; }
    else { s.n = 1; s.last = today; }
    s.best = Math.max(s.best || 0, s.n);
    if (m.daily && !P.dailyDone(p, today)) { p.daily = { date: today, done: true, note: r.total }; st.dailies = (st.dailies || 0) + 1; }
  }
  p.xp = (p.xp || 0) + gx.total;
  const aw = P.award(p, pre);
  const lvAfter = P.levelOf(p.xp);
  const ups = []; for (let l = lvBefore.level + 1; l <= lvAfter.level; l++) ups.push(l);
  return {
    xp: gx.total + aw.xpFromBadges, xpTicket: gx.total, xpBadges: aw.xpFromBadges, parts: gx.parts, mult: gx.mult, goals: gx.goals,
    from: lvBefore, to: lvAfter, levelUps: ups, pointsGain: P.pointsEarned(lvAfter.level) - P.pointsEarned(lvBefore.level),
    title: P.titleOf(lvAfter.level), newTitle: P.titleOf(lvAfter.level) !== P.titleOf(lvBefore.level),
    streak: Object.assign({}, P.streakInfo(p, today), { note: streakNote }), daily: !!m.daily, newBadges: aw.newBadges
  };
};

/* Profil antérieur à la progression : XP rétroactive d'après l'historique (validés : base du niveau ; autres : participation), compteurs recalculés. */
P.migrate = function (p) {
  if (p.pv === 1) return p;
  p.pv = 1; p.stats = p.stats || {}; p.tree = p.tree || {}; p.xp = p.xp || 0; p.streak = p.streak || { n: 0, last: '', best: 0 }; p.daily = p.daily || { date: '', done: false }; p.notes = p.notes || {};
  p.badges = p.badges || []; p.history = p.history || []; p.done = p.done || {}; p.skills = p.skills || {}; p.best = p.best || {};
  try { const th = Game.store.get('theme'); if ((p.history.length || p.badges.length) && typeof th === 'string' && P.FREE_THEMES.indexOf(th) < 0 && P.TREE.some(n => n.theme === th)) p.giftTheme = th; } catch (e) { /* stockage indisponible */ }
  if (!p.history.length) return p;
  const passed = p.history.filter(h => h.stars > 0);
  p.stats.passed = p.stats.passed || passed.length; p.stats.played = p.stats.played || p.history.length;
  p.stats.perfect = p.stats.perfect || passed.filter(h => h.perfect).length;
  p.xp = p.history.reduce((a, h) => a + (h.stars > 0 ? Math.round((P.BASE_XP[h.level] || 100) * (1 + (h.stars === 3 ? 0.2 : h.stars === 2 ? 0.1 : 0))) : 10), 0);
  /* succès déjà obtenus : leur XP est comptée, sans déclencher de réattribution */
  p.badges.forEach(id => { const b = Game.BADGES.find(x => x.id === id); if (b) p.xp += b.xp || 0; });
  return p;
};

/* Récapitulatif pour l'écran de profil. */
P.summary = function (p) {
  const lv = P.levelOf(p.xp);
  return { level: lv, title: P.displayTitle(p), points: P.pointsLeft(p), streak: P.streakInfo(p), badges: p.badges.length, badgesTotal: Game.BADGES.length, daily: P.daily(), dailyDone: P.dailyDone(p) };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
