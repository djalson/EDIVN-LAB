/* Séries d'essais par PERSONAS : des profils d'apprenants simulés (modèles stochastiques à graine fixe) jouent des tickets
   à travers la vraie couche de jeu (SIM.game : mission, indices, clôture, score, débrief) et les corrections scriptées des pannes.
   But : stresser le moteur et le barème (anomalies, pannes mal calibrées, seuil de validation 75) — PAS valider la pédagogie :
   ce sont des modèles que nous avons écrits, pas des humains.
   Usage : node tests/personas.js [--quick] [--out docs/PERSONAS-ESSAIS.md] [--seed N]
   Note équivalente /100 = 100 × total / (base × 1,25), c'est-à-dire la fraction qui détermine déjà les étoiles (4★ ≥ 70, 5★ ≥ 85). */
const fs = require('fs');
const SIM = require('./load')(); const G = SIM.game, F = SIM.fault, U = SIM.U;
const argv = process.argv.slice(2);
const QUICK = argv.indexOf('--quick') >= 0;
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = arg('--out', 'docs/PERSONAS-ESSAIS.md'); const SEED = arg('--seed', '2026');
const PASS = 75;
const sig = x => 1 / (1 + Math.exp(-x));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const f1 = x => Number.isFinite(x) ? x.toFixed(1) : '–';
const pct = x => Number.isFinite(x) ? Math.round(100 * x) + ' %' : '–';

/* ------------------------------------------------------------------ archétypes
   theta : aisance de départ (logit) ; learn : vitesse d'apprentissage par ticket sur les compétences touchées ;
   sec : secondes par étape « optimale » de la panne ; pHint : appétence pour les indices ; pTest : vérifie depuis le poste avant de clôturer ;
   pDanger : tente un raccourci dangereux ; pWork : se contente d'un contournement ; pPartial : s'arrête après une correction partielle (multi-causes) ;
   pQuit : abandonne quand il est bloqué. */
const PERSONAS = [
  { id: 'expert', label: 'Expert (habitué à 90–100)', n: 6, theta: 3.2, learn: 0.02, sec: 72, secSd: 0.15, pHint: 0, pTest: 0.99, pDanger: 0.005, pWork: 0.02, pPartial: 0.05, pQuit: 0.01, modes: ['timed', 'free', 'free'] },
  { id: 'solide', label: 'Solide (80–90)', n: 6, theta: 2.1, learn: 0.04, sec: 100, secSd: 0.2, pHint: 0.08, pTest: 0.95, pDanger: 0.02, pWork: 0.05, pPartial: 0.12, pQuit: 0.03, modes: ['free', 'free', 'timed'] },
  { id: 'limite', label: 'Limite (≈ 75, doit parfois repasser)', n: 8, theta: 1.25, learn: 0.05, sec: 110, secSd: 0.25, pHint: 0.3, pTest: 0.85, pDanger: 0.05, pWork: 0.1, pPartial: 0.2, pQuit: 0.06, modes: ['free', 'free', 'guided'] },
  { id: 'progressif', label: 'Progressif (40–50 au départ, 75 à force d’essais)', n: 8, theta: -0.1, learn: 0.075, sec: 120, secSd: 0.3, pHint: 0.6, pTest: 0.7, pDanger: 0.08, pWork: 0.18, pPartial: 0.35, pQuit: 0.1, modes: ['guided', 'guided', 'free', 'free'] },
  { id: 'lent', label: 'Méthodique mais lent', n: 5, theta: 2.0, learn: 0.04, sec: 150, secSd: 0.2, pHint: 0.05, pTest: 0.99, pDanger: 0.01, pWork: 0.03, pPartial: 0.08, pQuit: 0.02, modes: ['free', 'free', 'guided'] },
  { id: 'presse', label: 'Pressé / imprudent', n: 6, theta: 1.8, learn: 0.03, sec: 32, secSd: 0.25, pHint: 0.1, pTest: 0.4, pDanger: 0.3, pWork: 0.4, pPartial: 0.3, pQuit: 0.02, modes: ['free', 'timed', 'free'] },
  { id: 'decroche', label: 'Décrocheur (abandonne quand bloqué)', n: 5, theta: 0.6, learn: 0.04, sec: 100, secSd: 0.3, pHint: 0.4, pTest: 0.7, pDanger: 0.06, pWork: 0.15, pPartial: 0.3, pQuit: 0.45, modes: ['free', 'guided', 'free'] }
];
const DIFF = { 1: 0.0, 2: 0.7, 3: 1.4, 4: 2.1, 5: 2.8 };
const DANGER_STEPS = [
  [{ do: 'lx.ufw', dev: 'SRV-LNX', op: 'disable' }],
  [{ do: 'lx.chmod', dev: 'SRV-LNX', path: '/srv/echanges', mode: '0777' }],
  [{ do: 'set', path: 'SRV-FIC.win.fw.profiles.domain.enabled', value: false }]
];

/* ------------------------------------------------------------------ une partie */
const ANOM = []; const anom = (kind, ctx, msg) => ANOM.push({ kind, ctx, msg });
function play(ind, def, level, mode, seed, rng) {
  let now = 0; const clock = () => now;
  const opts = { seed, level, mode, clock, profile: ind.profile };
  if (def) opts.faultId = def.id;
  const m = G.create(opts);
  const isChaos = level === 5; const nOpt = Math.max(3, (m.fault.optimal || []).length * (isChaos ? 1 : 1));
  const u = ind.sec * clamp(1 + (rng.next() - 0.5) * 2 * ind.secSd, 0.5, 1.8);
  const adv = s => { now += Math.round(s * 1000); };
  const sk = m.fault.skills || []; const ms = () => sk.length ? mean(sk.map(s => ind.mastery[s] || 0)) : 0;
  const guided = mode === 'guided'; const ctx0 = (def ? def.id : 'niv' + level) + '/' + ind.name + '/' + seed;
  let hintsTaken = 0, rounds = 0, done = false, quit = false; const MAXR = 6;
  adv(u * 0.8); m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'lecture du ticket / premier constat' });
  while (!done && m.state === 'running' && rounds < MAXR) {
    rounds++;
    let pId = sig(ind.theta + 4 * ms() - DIFF[level] + (guided ? 0.9 : 0) + 0.7 * hintsTaken);
    if (!guided && mode !== 'timed' && hintsTaken < 3 && rng.chance(ind.pHint * (1 - pId) * (rounds === 1 ? 0.6 : 1.2))) {
      const h = m.hint(); if (h && h.text) { hintsTaken++; adv(40); }
    }
    const nd = 1 + rng.int(3); for (let i = 0; i < nd; i++) { adv(u * 0.5); m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'diagnostic ' + rounds + '.' + i }); }
    if (m.state !== 'running') break;
    if (rng.chance(pId)) {
      /* a trouvé la cause : applique la correction ou un contournement, parfois un raccourci dangereux */
      if (rng.chance(ind.pDanger)) { F.runSteps(m.W, rng.pick(DANGER_STEPS)); adv(20); m.act({ kind: 'cmd', dev: 'SRV-LNX', text: 'raccourci dangereux', mutates: true }); }
      /* panne composée : le technicien traite les causes l'une après l'autre (sous-ensemble à chaque tour de diagnostic fructueux) */
      let todo = m.parts.filter(p => (p._applied || 0) < p.fix.length || p._wk);
      if (m.parts.length > 1 && todo.length > 1) { const pick = todo.filter(() => rng.chance(0.6)); todo = pick.length ? pick : [todo[0]]; }
      for (const p of todo) {
        const wk = Object.keys(p.workarounds || {});
        const alt = Object.keys(p.fixes || {});
        adv(u * Math.max(2, nOpt / m.parts.length * 0.6));
        if (wk.length && rng.chance(ind.pWork * (1 - pId * 0.5))) { p._wk = true; F.runSteps(m.W, p.workarounds[rng.pick(wk)], { inst: p }); m.act({ kind: 'ui', dev: 'PC-ADM', text: 'contournement ' + p.id, mutates: true }); }
        else {
          /* les étapes déjà appliquées ne sont pas rejouées (un joueur réel ne refait pas une correction déjà faite) */
          p._applied = p._applied || 0;
          const useAlt = p._applied === 0 && alt.length && rng.chance(0.3);
          const steps = useAlt ? p.fixes[rng.pick(alt)] : p.fix;
          const from = useAlt ? 0 : p._applied;
          const partial = steps.length - from > 1 && rng.chance(ind.pPartial * (1 - pId * 0.5)) && !m.fault.bundle;
          const to = partial ? from + Math.max(1, Math.floor((steps.length - from) / 2)) : steps.length;
          try { F.runSteps(m.W, steps.slice(from, to), { inst: p }); } catch (e) { anom('correction scriptée non rejouable', ctx0 + '/' + p.id, String(e.message).slice(0, 160)); }
          p._applied = useAlt ? p.fix.length : to; if (p._applied >= p.fix.length) p._wk = false;
          m.act({ kind: 'ui', dev: 'PC-ADM', text: 'correction ' + p.id + (partial ? ' (partielle)' : ''), mutates: true });
        }
        if (m.state !== 'running') break;
      }
      if (m.state !== 'running') break;
      const tested = rng.chance(ind.pTest);
      if (tested) {
        adv(u * 0.6);
        for (const p of m.parts) { const pats = (p.verify && p.verify.length) ? p.verify : F.defaultVerify(p); m.W.observe(pats[0].replace(/\*/g, 'test'), true); }
        m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'test depuis le poste de l’utilisateur' });
      }
      if (m.state !== 'running') break;
      adv(15); const c = m.close(); if (c && c.ok) done = true;
      if (m.state !== 'running') break;
    } else {
      /* fausse piste : modification sans effet, parfois régressive */
      adv(u * 1.2); m.act({ kind: 'ui', dev: 'PC-ADM', text: 'essai sans effet ' + rounds, mutates: true });
      if (rng.chance(ind.pQuit * rounds / 3)) { quit = true; break; }
    }
    if (m.state === 'running' && m.remainingSec() !== null) { m.check(); }
  }
  if (m.state === 'running') {
    if (mode === 'timed' && m.deadlineSec !== null) { now = Math.max(now, (m.deadlineSec + 1) * 1000); m.check(); }
    if (m.state === 'running') m.giveUp();
  }
  const r = m.result; const note = r ? r.note : 0;
  /* invariants */
  const ctx = (def ? def.id : 'niv' + level) + '/' + ind.name + '/' + seed;
  if (!r) anom('pas de résultat', ctx, 'mission terminée sans result');
  else {
    if (!(r.note >= 0 && r.note <= 100 && Number.isInteger(r.note))) anom('note hors 0–100', ctx, String(r.note));
    if (r.kind !== 'resolved' && (r.stars !== 0 || r.note >= PASS || r.passed)) anom('validation sans résolution', ctx, r.kind + ' ' + r.note + ' ' + r.stars);
    if (r.passed !== (r.kind === 'resolved' && r.note >= PASS) || (r.stars > 0) !== r.passed) anom('validation incohérente avec la note', ctx, r.note + ' ' + r.stars + ' ' + r.passed);
    if (r.stars !== G.starsOf(r.passed ? r.note : 0)) anom('étoiles incohérentes avec la note', ctx, r.note + ' → ' + r.stars);
    if (r.perfect !== (r.kind === 'resolved' && r.note === 100)) anom('« parfait » incohérent', ctx, String(r.note));
    if (r.kind === 'resolved' && !m.hintLog.length && !m.dangers.length && !m.impacts.length && !m.wrongCloses && r.note < PASS) anom('résolution propre sous le seuil (le temps seul ne doit jamais faire échouer)', ctx, r.note + ' (mttr ' + r.mttrSec + ' / cible ' + m.parSec + ')');
    if (r.kind === 'resolved' && r.mttrSec > m.parSec * G.TIMED_FACTOR + 1 && mode === 'timed') anom('résolu après l’échéance', ctx, r.mttrSec + ' > ' + m.parSec * G.TIMED_FACTOR);
    const d = m.debrief(); if (!d || !d.skills || !d.path) anom('débrief incomplet', ctx, '');
    if (r.kind === 'resolved' && m.trace.some((x, i, a) => i && a[i].t < a[i - 1].t - 1e-6)) anom('trace non monotone', ctx, '');
  }
  const rec = G.record(m, ind.profile); if (!rec) anom('record nul', ctx, '');
  /* apprentissage */
  sk.forEach(s => { const g = ind.learn * (1 - (ind.mastery[s] || 0)) * (r && r.kind === 'resolved' ? 1 : 0.6) * (guided || hintsTaken ? 1.15 : 1); ind.mastery[s] = clamp((ind.mastery[s] || 0) + g, 0, 1); });
  return { persona: ind.pid, ind: ind.name, id: m.fault.id, level, mode, kind: r ? r.kind : 'none', total: r ? r.total : 0, note, ids: m.parts.map(p => p.id), nParts: m.parts.length, stars: r ? r.stars : 0, mttr: r ? r.mttrSec : 0, par: m.parSec, hints: m.hintLog.length, dangers: m.dangers.length, wrongCloses: m.wrongCloses, falseRes: m.falseRes, skills: sk, seed, quit };
}

/* ------------------------------------------------------------------ programme d'une série */
const ALL = SIM.faults.filter(f => f.level >= 1 && f.level <= 4);
const rows = []; const t0 = Date.now();
const nTickets = QUICK ? 24 : 70;
PERSONAS.forEach(P => {
  const nInd = QUICK ? Math.min(2, P.n) : P.n;
  for (let k = 0; k < nInd; k++) {
    const rng = U.rng('persona|' + SEED + '|' + P.id + '|' + k);
    const th = P.theta + (rng.next() - 0.5) * 0.5;
    const ind = Object.assign({}, P, { theta: th, pid: P.id, name: P.id + '-' + (k + 1), mastery: {}, profile: { name: P.id + '-' + (k + 1), done: {}, skills: {}, badges: [], history: [], best: {} } });
    /* ordre de parcours : niveau croissant, panne tirée au sort dans chaque niveau, un chaos tous les 12 tickets */
    const pool = rng.shuffle(ALL).sort((a, b) => a.level - b.level);
    const picks = []; for (let i = 0; i < nTickets; i++) picks.push(pool[Math.floor(i * pool.length / nTickets) + rng.int(Math.max(1, Math.floor(pool.length / nTickets)))] || pool[pool.length - 1]);
    let attempt = 0;
    for (let i = 0; i < picks.length; i++) {
      const pk = picks[i]; const level = (i % 12 === 11) ? 5 : pk.level; const def = level <= 2 ? pk : null;   /* Admin, Cyber et Chaos : pannes composées tirées par le jeu */
      let tries = 0, passed = false;
      while (!passed && tries < 3) {
        tries++; attempt++;
        const mode = tries === 1 ? rng.pick(P.modes) : (P.modes.indexOf('guided') >= 0 && tries === 3 ? 'guided' : 'free');
        const seed = 'p-' + P.id + '-' + k + '-' + i + '-' + tries;
        let r;
        try { r = play(ind, def, level, mode, seed, rng); } catch (e) { anom('exception', (def ? def.id : 'niv' + level) + '/' + ind.name + '/' + seed, e.stack.split('\n').slice(0, 3).join(' / ')); break; }
        r.tries = tries; r.attempt = attempt; r.ticket = i; rows.push(r);
        passed = r.kind === 'resolved' && r.note >= PASS;
      }
    }
  }
  process.stderr.write(P.id + ' terminé (' + rows.length + ' parties, ' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
});

/* ------------------------------------------------------------------ déterminisme : même graine + même comportement = même résultat */
let detOk = 0, detKo = 0;
for (let i = 0; i < (QUICK ? 6 : 20); i++) {
  const P = PERSONAS[i % PERSONAS.length]; const def0 = ALL[(i * 7) % ALL.length]; const dlevel = def0.level; const def = i % 3 === 2 ? null : def0; const detLevel = def ? def.level : [3, 4, 5][i % 3];
  const runOnce = () => { const rng = U.rng('det|' + i); const ind = Object.assign({}, P, { pid: P.id, name: 'det', mastery: {}, profile: { name: 'det', done: {}, skills: {}, badges: [], history: [], best: {} } }); const r = play(ind, def, detLevel, 'free', 'det-' + i, rng); return JSON.stringify([r.kind, r.total, r.mttr, r.hints, r.dangers, r.wrongCloses]); };
  const a = runOnce(), b = runOnce(); if (a === b) detOk++; else { detKo++; anom('non déterministe', def ? def.id : 'niv' + detLevel, a + ' ≠ ' + b); }
}

/* ------------------------------------------------------------------ agrégats et rapport */
const by = (arr, f) => { const o = {}; arr.forEach(x => { const k = f(x); (o[k] = o[k] || []).push(x); }); return o; };
const ok1 = r => r.kind === 'resolved' && r.note >= PASS;
const L = []; const w = s => L.push(s);
w('# Essais par personas — série lourde sur le moteur de jeu');
w('');
w('> Généré par `node tests/personas.js' + (QUICK ? ' --quick' : '') + '` (graine ' + SEED + '). ' + rows.length + ' parties jouées à travers la vraie couche de jeu (missions, indices, clôture, score, débrief, profil), ' + (Date.now() - t0 > 0 ? Math.round((Date.now() - t0) / 1000) + ' s' : '') + '.');
w('');
w('## Ce que cette série est (et n’est pas)');
w('');
w('- Les « apprenants » sont des **modèles stochastiques écrits par nous** (aisance de départ, vitesse, appétence pour les indices, imprudence, abandon, apprentissage par compétence). Ils ne prouvent rien sur la pédagogie ni sur de vrais élèves.');
w('- Ils servent à **stresser le moteur et le barème** : anomalies (exceptions, scores incohérents, non-déterminisme), pannes qui ne peuvent jamais être validées, effet des indices / dangers / clôtures prématurées sur la note, position du seuil de 75.');
w('- Les parties passent par les corrections scriptées des pannes (comme `tests/faults.js`), pas par l’interface graphique ni le terminal : cela ne teste **pas** la jouabilité des consoles (couverte par les tests `tests/ui`).');
w('- **La note est la vraie note /100 du jeu** (départ 100, moins indices, actions dangereuses, clôtures prématurées, durée au-delà du temps cible ; la durée seule ne peut pas descendre sous ' + PASS + '). Validé à partir de **' + PASS + '** : 1★ 75–84, 2★ 85–94, 3★ 95–99, 100 = Parfait. Ce n’est pas la grille de notation de la formation : le seuil est une décision (voir « Décisions »). Une série de « repassage » est jouée : après une note < ' + PASS + ', le même ticket est rejoué (3 essais maximum). **Admin = 2 pannes, Cyber = 3, Chaos = 4** par ticket.');
w('');
w('## Archétypes');
w('');
w('| Archétype | Individus | Aisance de départ | Vitesse (s / étape optimale) | Indices | Teste avant de clôturer | Raccourci dangereux | Contournement | Abandon |');
w('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
PERSONAS.forEach(P => w('| ' + P.label + ' | ' + (QUICK ? Math.min(2, P.n) : P.n) + ' | ' + P.theta + ' | ' + P.sec + ' | ' + pct(P.pHint) + ' | ' + pct(P.pTest) + ' | ' + pct(P.pDanger) + ' | ' + pct(P.pWork) + ' | ' + pct(P.pQuit) + ' |'));
w('');
w('## Résultats par archétype');
w('');
w('| Archétype | Parties | Note moyenne | Note médiane | Validé du 1er coup | Validé en ≤ 3 essais | Jamais validé | Essais pour valider (moy.) | MTTR / cible | Indices / partie | Dangers / partie | Clôtures prématurées / partie | Abandons ou échéances |');
w('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
const byP = by(rows, r => r.persona);
PERSONAS.forEach(P => {
  const rs = byP[P.id] || []; if (!rs.length) return;
  const first = rs.filter(r => r.tries === 1); const tickets = by(rs, r => r.ind + '|' + r.ticket);
  const tk = Object.values(tickets); const passedTk = tk.filter(t => t.some(ok1)); const tr = passedTk.map(t => t.findIndex(ok1) + 1);
  const res = rs.filter(r => r.kind === 'resolved');
  w('| ' + P.label + ' | ' + rs.length + ' | ' + f1(mean(first.map(r => r.note))) + ' | ' + f1(median(first.map(r => r.note))) + ' | ' + pct(first.filter(ok1).length / first.length) + ' | ' + pct(passedTk.length / tk.length) + ' | ' + pct(1 - passedTk.length / tk.length) + ' | ' + f1(mean(tr)) + ' | ' + f1(mean(res.map(r => r.mttr / r.par))) + ' | ' + f1(mean(rs.map(r => r.hints))) + ' | ' + f1(mean(rs.map(r => r.dangers))) + ' | ' + f1(mean(rs.map(r => r.wrongCloses))) + ' | ' + pct(rs.filter(r => r.kind !== 'resolved').length / rs.length) + ' |');
});
w('');
w('Les colonnes « Note » portent sur le **premier essai** de chaque ticket (le repassage fausserait la moyenne).');
w('');
w('## Note moyenne au premier essai, par niveau');
w('');
w('| Archétype | Junior | Confirmé | Admin | Cyber | Chaos |');
w('|---|---:|---:|---:|---:|---:|');
PERSONAS.forEach(P => {
  const rs = (byP[P.id] || []).filter(r => r.tries === 1); const bl = by(rs, r => r.level);
  w('| ' + P.label + ' | ' + [1, 2, 3, 4, 5].map(l => (bl[l] ? f1(mean(bl[l].map(r => r.note))) + ' (' + pct(bl[l].filter(ok1).length / bl[l].length) + ')' : '–')).join(' | ') + ' |');
});
w('');
w('Entre parenthèses : part des parties validées (note ≥ ' + PASS + ') du premier coup.');
w('');
/* courbe d'apprentissage du progressif */
w('## Courbe d’apprentissage (archétype « Progressif »)');
w('');
const prog = (byP.progressif || []).slice().sort((a, b) => a.attempt - b.attempt);
if (prog.length) {
  const indivs = by(prog, r => r.ind); const BK = 10; const nb = Math.max(...Object.values(indivs).map(a => a.length));
  w('| Parties jouées (tranche) | Note moyenne | Part validée (≥ ' + PASS + ') | Indices / partie | Mode guidé |');
  w('|---|---:|---:|---:|---:|');
  for (let s = 0; s < nb; s += BK) {
    const sl = [].concat.apply([], Object.values(indivs).map(a => a.slice(s, s + BK))); if (!sl.length) continue;
    w('| ' + (s + 1) + '–' + Math.min(nb, s + BK) + ' | ' + f1(mean(sl.map(r => r.note))) + ' | ' + pct(sl.filter(ok1).length / sl.length) + ' | ' + f1(mean(sl.map(r => r.hints))) + ' | ' + pct(sl.filter(r => r.mode === 'guided').length / sl.length) + ' |');
  }
  w('');
  const reach = Object.keys(indivs).map(n => { const a = indivs[n]; for (let i = 4; i < a.length; i++) { if (mean(a.slice(i - 4, i + 1).map(r => r.note)) >= PASS) return i + 1; } return null; });
  w('Rang de partie à partir duquel la moyenne glissante (5 parties) atteint ' + PASS + ' : ' + reach.map((x, i) => 'individu ' + (i + 1) + ' → ' + (x === null ? 'jamais' : x)).join(' ; ') + '.');
  w('');
}
/* effet des indices et des erreurs */
w('## Effet des indices, dangers et clôtures prématurées sur la note');
w('');
w('Parties résolues, tous archétypes confondus (premier essai) :');
w('');
w('| Situation | Parties | Note moyenne | Part ≥ ' + PASS + ' |');
w('|---|---:|---:|---:|');
const res1 = rows.filter(r => r.kind === 'resolved' && r.tries === 1);
const situ = [['Aucun indice, aucune erreur', r => !r.hints && !r.dangers && !r.wrongCloses], ['1 indice seul', r => r.hints === 1 && !r.dangers && !r.wrongCloses], ['2 indices ou plus', r => r.hints >= 2], ['1 action dangereuse', r => r.dangers === 1], ['2 actions dangereuses ou plus', r => r.dangers >= 2], ['1 clôture prématurée', r => r.wrongCloses === 1 && !r.falseRes], ['Contournement pris pour une résolution', r => r.falseRes >= 1]];
situ.forEach(([n, f]) => { const rs = res1.filter(f); w('| ' + n + ' | ' + rs.length + ' | ' + f1(mean(rs.map(r => r.note))) + ' | ' + pct(rs.filter(r => r.note >= PASS).length / (rs.length || 1)) + ' |'); });
w('');
/* position du seuil : note vs MTTR/par pour résolutions propres */
const clean = res1.filter(r => !r.hints && !r.dangers && !r.wrongCloses);
w('### Le seuil de ' + PASS + ' en fonction du temps (résolutions propres : sans indice, sans erreur)');
w('');
w('| MTTR / temps cible | Parties | Note moyenne | Part ≥ ' + PASS + ' |');
w('|---|---:|---:|---:|');
[[0, 0.5], [0.5, 0.75], [0.75, 1], [1, 1.25], [1.25, 1.5], [1.5, 9]].forEach(([a, b]) => { const rs = clean.filter(r => r.mttr / r.par >= a && r.mttr / r.par < b); w('| ' + (b > 5 ? '≥ ' + a : a + ' – ' + b) + ' | ' + rs.length + ' | ' + f1(mean(rs.map(r => r.note))) + ' | ' + pct(rs.filter(r => r.note >= PASS).length / (rs.length || 1)) + ' |'); });
w('');
/* pannes */
w('## Pannes : calibrage');
w('');
const single = rows.filter(r => r.nParts === 1); const byF = by(single, r => r.id); const seen = new Set(); rows.forEach(r => r.ids.forEach(i => seen.add(i)));
const stat = Object.keys(byF).map(id => { const rs = byF[id]; const ex = rs.filter(r => (r.persona === 'expert' || r.persona === 'solide') && r.tries === 1); return { id, level: rs[0].level, n: rs.length, exN: ex.length, exPass: ex.length ? ex.filter(ok1).length / ex.length : NaN, exNote: mean(ex.map(r => r.note)), allPass: rs.filter(r => r.tries === 1).filter(ok1).length / rs.filter(r => r.tries === 1).length, retries: mean(rs.map(r => r.tries)), par: rs[0].par, opt: (SIM.faults.find(f => f.id === id).optimal || []).length }; });
const covered = ALL.filter(f => seen.has(f.id)).length;
w('- Pannes jouées au moins une fois (seules ou comme cause d’un ticket composé) : **' + covered + ' / ' + ALL.length + '** ; tickets composés : Admin ' + rows.filter(r => r.level === 3).length + ', Cyber ' + rows.filter(r => r.level === 4).length + ', Chaos ' + rows.filter(r => r.level === 5).length + ' parties.');
const never = ALL.filter(f => !seen.has(f.id)).map(f => f.id);
if (never.length) w('- Jamais tirées dans cette série : ' + never.join(', ') + ' (augmenter le nombre de tickets ou relancer avec une autre graine).');
const hard = stat.filter(s => s.exN >= 2).sort((a, b) => a.exPass - b.exPass || a.exNote - b.exNote).slice(0, 12);
w('');
w('### Pannes les moins validées par les experts et solides (premier essai)');
w('');
w('| Panne | Niveau | Étapes optimales | Temps cible | Experts/solides (parties) | Part ≥ ' + PASS + ' | Note moyenne |');
w('|---|---:|---:|---:|---:|---:|---:|');
hard.forEach(s => w('| `' + s.id + '` | ' + s.level + ' | ' + s.opt + ' | ' + s.par + ' s | ' + s.exN + ' | ' + pct(s.exPass) + ' | ' + f1(s.exNote) + ' |'));
w('');
w('### Temps cible par panne : où le rapport MTTR / cible des experts dépasse 1');
w('');
w('Le temps cible est **calculé par panne** à partir de son chemin optimal (étapes × 110 s + 120 s, arrondi à 30 s, borné 6–20 min ; panne composée : somme − 15 %). Résolutions propres des archétypes expert et solide :');
w('');
const cleanEx = single.filter(r => r.kind === 'resolved' && !r.hints && !r.dangers && !r.wrongCloses && (r.persona === 'expert' || r.persona === 'solide'));
const ratioBy = by(cleanEx, r => r.id); const tight = Object.keys(ratioBy).filter(id => ratioBy[id].length >= 2).map(id => ({ id, n: ratioBy[id].length, ratio: mean(ratioBy[id].map(r => r.mttr / r.par)), par: ratioBy[id][0].par })).sort((a, b) => b.ratio - a.ratio);
w(tight.length ? '| Panne | Parties | MTTR / cible (moy.) | Temps cible |\n|---|---:|---:|---:|\n' + tight.slice(0, 10).map(t => '| `' + t.id + '` | ' + t.n + ' | ' + t.ratio.toFixed(2) + ' | ' + t.par + ' s |').join('\n') : 'Pas assez de résolutions propres de panne simple.');
w('');
w('Rapport moyen toutes pannes (experts et solides, résolutions propres) : **' + f1(mean(cleanEx.map(r => r.mttr / r.par))) + '**. Les modèles d’apprenants fixent leur vitesse en secondes par étape optimale : ce rapport vérifie surtout la **cohérence interne** du temps cible, pas sa justesse pour de vrais élèves (à mesurer).');
w('');
const reps = stat.filter(s => s.n >= 4).sort((a, b) => b.retries - a.retries).slice(0, 10);
w('### Pannes qui obligent le plus à repasser (nombre moyen d’essais pour valider)');
w('');
w('| Panne | Niveau | Parties | Essais moyens | Validées du 1er coup (tous archétypes) |');
w('|---|---:|---:|---:|---:|');
reps.forEach(s => w('| `' + s.id + '` | ' + s.level + ' | ' + s.n + ' | ' + f1(s.retries) + ' | ' + pct(s.allPass) + ' |'));
w('');
/* compétences */
w('## Compétences : où les apprenants simulés restent faibles');
w('');
const sk = {}; rows.filter(r => r.persona === 'progressif' || r.persona === 'limite').forEach(r => r.skills.forEach(s => { (sk[s] = sk[s] || []).push(r); }));
const sks = Object.keys(sk).map(s => ({ s, n: sk[s].length, note: mean(sk[s].map(r => r.note)), pass: sk[s].filter(ok1).length / sk[s].length })).filter(x => x.n >= 8).sort((a, b) => a.note - b.note);
w('Notes moyennes (archétypes Limite + Progressif, tous essais) par compétence du référentiel, les 10 plus basses :');
w('');
w('| Compétence | Parties | Note moyenne | Part ≥ ' + PASS + ' |');
w('|---|---:|---:|---:|');
sks.slice(0, 10).forEach(x => w('| ' + ((SIM.skills[x.s] || {}).label || x.s) + ' (`' + x.s + '`) | ' + x.n + ' | ' + f1(x.note) + ' | ' + pct(x.pass) + ' |'));
w('');
w('> Ce classement reflète surtout **le niveau des pannes rattachées** à chaque compétence (une compétence dont toutes les pannes sont de niveau 4 sort basse) et le nombre d’étapes : ce n’est pas un diagnostic de difficulté intrinsèque.');
w('');
/* déterminisme et anomalies */
w('## Contrôles d’intégrité');
w('');
w('- Déterminisme : **' + detOk + ' / ' + (detOk + detKo) + '** rejeux identiques (même graine, même comportement).');
const kinds = by(ANOM, a => a.kind);
w('- Anomalies relevées : **' + ANOM.length + '**' + (ANOM.length ? '' : ' (aucune)'));
Object.keys(kinds).forEach(k => { w('  - ' + k + ' : ' + kinds[k].length + ' — ex. ' + kinds[k].slice(0, 3).map(a => '`' + a.ctx + '` ' + a.msg).join(' ; ')); });
w('- Issues des parties : ' + Object.entries(by(rows, r => r.kind)).map(([k, v]) => k + ' ' + v.length).join(', ') + '.');
w('');
w('## Décisions que cette série met sur la table');
w('');
w('1. **Seuil de validation à ' + PASS + ' / 100** (validé dans la conversation) ; paliers 1★ 75–84, 2★ 85–94, 3★ 95–99 et 100 = Parfait : proposés par le jeu, à confirmer ou ajuster. Le plancher du temps (une résolution propre ne descend jamais sous ' + PASS + ') est vérifié ici à chaque partie.');
w('2. **Temps cible par panne** (dérivé des étapes optimales) : voir « Temps cible par panne ». Le rapport MTTR / cible des experts doit rester ≲ 1 ; sinon allonger la formule.');
w('3. Les paramètres des archétypes (`tests/personas.js`) sont des hypothèses : à ajuster si tu as des mesures réelles d’élèves (temps de résolution, nombre d’indices).');
fs.writeFileSync(OUT, L.join('\n') + '\n');
console.log(rows.length + ' parties, ' + ANOM.length + ' anomalie(s), déterminisme ' + detOk + '/' + (detOk + detKo) + ' → ' + OUT);
process.exit(ANOM.length ? 1 : 0);
