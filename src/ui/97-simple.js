/* ============================================================================
   Interface V3 allégée : chaque écran montre d'abord l'essentiel et UNE action principale, bien visible ;
   le détail reste disponible, replié.
   - Débrief : bandeau de résultat (note, étoiles, XP) avec le bouton « Ticket suivant » tout de suite visible,
     puis « ce qu'il fallait trouver » (la panne et ta fiche côte à côte), puis le détail en sections repliables.
   - Accueil : colonne de droite réduite à la carrière, trois chiffres et les derniers tickets ; les outils sont repliés.
   Le mode d'origine (#legacy) garde l'assemblage complet d'avant : les tests antérieurs le voient inchangé.
   Styles : src/css/42-simple.css (portés par la classe .v3ui sur <html>).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, P = SIM.prog, h = UI.h;
const US = UI.simple = {};

/* section repliable du débrief */
const fold = (title, sub, body, open) => {
  const parts = [].concat(body).filter(Boolean); if (!parts.length) return null;
  return h('details.dfold', open ? { open: true } : {}, h('summary', h('span.dft', title), sub ? h('span.dfs', sub) : null), h('div.dfb', parts));
};

/* ------------------------------------------------------------------ débrief */
US.debrief = function (app, m, rec, d, r, B) {
  const pg = rec && rec.prog; const camp = rec && rec.camp;
  const state = r.perfect ? 'perfect' : r.passed ? 'ok' : 'ko';
  const sub = r.passed ? (r.perfect ? 'Parfait' : 'Validé') : 'Seuil : ' + Game.PASS;
  /* titre court : le détail (seuil, raisons) est dans le barème */
  const title = r.perfect ? 'Ticket parfait !' : r.passed ? 'Ticket validé' : r.kind === 'resolved' ? 'Réparé, pas assez propre' : r.kind === 'timeout' ? 'Temps écoulé' : 'Ticket abandonné';
  /* XP : chiffre et barre, le détail est plus bas */
  let xp = null;
  if (pg) {
    const bar = h('div.xpbar', h('i', { style: { width: pg.from.level === pg.to.level ? pg.from.pct + '%' : '0%' } }));
    setTimeout(() => { if (bar.firstChild) bar.firstChild.style.width = pg.to.pct + '%'; }, 150);
    xp = h('div.dhxp', h('div.dhxpn', '+' + pg.xp, h('small', ' XP')), h('div.dhxpl', 'Niveau ' + pg.to.level), bar,
      pg.levelUps.length ? h('div.dhup', '★ Niveau ' + pg.levelUps[pg.levelUps.length - 1] + ' atteint') : null);
  }
  /* actions : une principale, deux discrètes */
  const main = m.camp ? B.next : B.replay;
  if (main && main.classList) { main.classList.add('primary', 'dgo'); }
  const second = [m.camp ? B.replay : null, B.home].filter(Boolean);
  second.forEach(b => { if (b.classList) b.classList.remove('primary'); });
  const hero = h('section.dhero.' + state,
    h('div.dhres',
      h('div.stars.dhstars', { 'aria-label': (r.stars || 0) + ' étoile(s) sur 3' }, UI.stars(r.stars || 0)),
      h('div.dhnote', String(r.total), h('small', ' / 100')),
      h('div.dhsub', sub)),
    h('div.dhmid',
      h('h1', title),
      h('div.dhfault', d.fault.title),
      h('div.dhchips',
        h('span.dchip', UI.icon('clock', 14), ' ' + UI.fmtDur(d.mttrSec), h('small', ' / cible ' + UI.fmtDur(d.parSec))),
        h('span.dchip', d.path.actions + ' action' + (d.path.actions > 1 ? 's' : '')),
        h('span.dchip' + (d.hints.length ? '.warn' : ''), d.hints.length + ' indice' + (d.hints.length > 1 ? 's' : '')),
        d.dangers.length ? h('span.dchip.bad', d.dangers.length + ' action' + (d.dangers.length > 1 ? 's' : '') + ' dangereuse' + (d.dangers.length > 1 ? 's' : '')) : null)),
    xp,
    h('div.dhact', [].concat(main || []), h('div.dhact2', second)));
  /* ce qu'il fallait trouver : la panne, et ta fiche quand il y en a une */
  const report = B.report ? [].concat(B.report).filter(x => x && x.classList && x.classList.contains('dfiche'))[0] : null;
  const found = h('section.dfound' + (report ? '.two' : ''),
    h('div.dfcol', h('h2', d.fault.parts.length > 1 ? 'Les pannes' : 'La panne'), B.causeCard),
    report ? h('div.dfcol', h('h2', 'Ta fiche'), report) : null);
  const seed = h('div.muted.dseed', 'Graine de l’incident : ', h('code', m.seed), ' ', B.exp);
  const failed = !r.passed;
  return h('div.screen.dsimple',
    hero,
    camp ? B.camp : null,
    B.unlocks,
    found,
    failed ? fold('À revoir', 'notions et cours', [B.review, B.courses, B.skills], true) : null,
    fold('Expérience gagnée', pg ? '+' + pg.xp + ' XP' : '', B.prog),
    fold('Ta démarche', d.path.actions + ' actions · chemin optimal', [B.stats, B.refusals, B.traps, B.path, B.sideFx, B.aids, B.dangers]),
    failed ? null : fold('Compétences', d.skills.length + ' travaillée' + (d.skills.length > 1 ? 's' : ''), [B.skills, B.review]),
    fold('Barème et historique', 'note détaillée, actions, graine', [B.bareme, B.hist, seed]));
};

/* ------------------------------------------------------------------ accueil : colonne de droite */
US.side = function (app, prof, theme, o) {
  const card = UI.prog.profileCard(prof, app);
  const pts = P.pointsLeft(prof); const st = P.streakInfo(prof);
  const btns = card.querySelector('.hbtns');
  if (btns) { UI.clear(btns); btns.append(h('button.btn' + (pts ? '.primary' : ''), { 'data-act': 'career', on: { click: () => UI.prog.screen(app, 'tree') } }, pts ? 'Ma carrière · ' + pts + ' point' + (pts > 1 ? 's' : '') + ' à dépenser' : 'Ma carrière')); }
  /* les pastilles ne restent que si elles disent quelque chose : la série en cours */
  const chips = card.querySelector('.pchips'); if (chips) { UI.clear(chips); if (st.alive) chips.append(h('span.pchip', UI.icon('flame', 14), 'Série : ' + st.n + ' jour' + (st.n > 1 ? 's' : ''))); else chips.remove(); }
  const tools = h('details.hcard.htools', h('summary', 'Outils et options'), h('div.hbtns',
    h('button.btn', { on: { click: () => app.startTour() } }, 'Revoir le tutoriel'),
    h('button.btn', { on: { click: () => app.vaultModal() } }, 'Mots de passe de l’infra'),
    h('button.btn', { on: { click: () => app.planModal() } }, 'Plan d’adressage'),
    h('button.btn', { on: { click: () => app.scenarioModal() } }, 'Scénarios formateur'),
    h('button.btn', { on: { click: () => UI.prog.backupModal(app) } }, 'Sauvegarde du profil'),
    h('button.btn.hthemebtn', { on: { click: () => app.themeModal() } }, 'Thème : ' + theme.name),
    h('button.btn', { on: { click: () => app.aboutModal() } }, 'À propos et limites')));
  const passed = o.passed;
  return h('aside.hside',
    card,
    passed.length ? h('div.hcard.hmini', h('div.hstats', o.stat(String(passed.length), 'validés'), o.stat(o.avgNote + '', 'note moy.'), o.stat(o.avgMttr ? UI.fmtDur(o.avgMttr) : '—', 'MTTR moy.')),
      o.hist.slice(0, 3).map(x => h('div.hhist', o.tagOf(x), h('span.grow', (SIM.faults.find(f => f.id === x.id) || { title: 'Ticket' }).title), h('b', x.total ? String(x.total) : '—')))) : null,
    tools);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
