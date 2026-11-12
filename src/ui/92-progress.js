/* ============================================================================
   Interface de progression : carte de profil, ticket du jour, écran Arbre / Maîtrises / Succès, bilan d'XP du débrief,
   objectifs bonus du ticket, coffre-fort d'identifiants (remplissage automatique), carnet de bord.
   Règle de conception : aucun avantage ne change la note ; le coffre et le carnet sont coupés en évaluation chronométrée.
   Icônes et textes originaux.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h, Game = SIM.game, P = SIM.prog;
const UP = UI.prog = {};

/* ------------------------------------------------------------------ icônes supplémentaires */
const C = UI.C;
const ico = body => '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
Object.assign(UI.icons, {
  note: ico(`<rect x="6" y="4" width="20" height="24" rx="2" fill="${C.yellow}" stroke="${C.dark}" stroke-width="1.5"/><rect x="10" y="10" width="12" height="1.6" fill="${C.dark}"/><rect x="10" y="15" width="12" height="1.6" fill="${C.dark}"/><rect x="10" y="20" width="8" height="1.6" fill="${C.dark}"/>`),
  spark: ico(`<path d="M16 3l3.2 9.3L29 16l-9.8 3.7L16 29l-3.2-9.3L3 16l9.8-3.7z" fill="${C.amber}" stroke="${C.dark}" stroke-width="1.4"/>`),
  target: ico(`<circle cx="16" cy="16" r="12" fill="${C.white}" stroke="${C.dark}" stroke-width="1.5"/><circle cx="16" cy="16" r="8" fill="${C.red}"/><circle cx="16" cy="16" r="4" fill="${C.white}"/><circle cx="16" cy="16" r="1.6" fill="${C.red}"/>`),
  badge: ico(`<path d="M16 3l3 2.4 3.8-.2 1.4 3.6 3.2 2-.9 3.7 1.3 3.5-3 2.4-.7 3.8-3.8.6L16 29l-3.3-3.2-3.8-.6-.7-3.8-3-2.4 1.3-3.5-.9-3.7 3.2-2 1.4-3.6 3.8.2z" fill="${C.amber}" stroke="${C.dark}" stroke-width="1.3"/><path d="M11 16l3.4 3.4L21 12.8" fill="none" stroke="${C.dark}" stroke-width="2"/>`),
  palette: ico(`<path d="M16 4C9 4 4 9 4 15s5 12 11 12c2 0 3-1 3-2.6 0-1.6-1.2-2-1.2-3.4 0-1.2 1-2 2.4-2H22c3.3 0 6-2.2 6-5.4C28 8 22.6 4 16 4z" fill="${C.light}" stroke="${C.dark}" stroke-width="1.4"/><circle cx="10" cy="14" r="2" fill="${C.red}"/><circle cx="15" cy="9.5" r="2" fill="${C.blue}"/><circle cx="21.5" cy="11" r="2" fill="${C.green}"/>`),
  flame: ico(`<path d="M16 3c1 5 7 7 7 14a7 7 0 0 1-14 0c0-3 2-4.600 3-6.600 1 1.600 2 2.200 3 2.600C15.500 10 15 6 16 3z" fill="${C.amber}" stroke="${C.dark}" stroke-width="1.3"/><path d="M16 17c3 2 3 7 0 9-3-2-3-7 0-9z" fill="${C.yellow}"/>`),
  medal: ico(`<path d="M10 3h5l2 8h-5zM22 3h-5l-2 8h5z" fill="${C.blue}" stroke="${C.dark}" stroke-width="1.2"/><circle cx="16" cy="20" r="8" fill="${C.amber}" stroke="${C.dark}" stroke-width="1.5"/><path d="M16 15l1.600 3.300 3.600.5-2.600 2.500.6 3.600-3.200-1.700-3.200 1.700.6-3.600-2.600-2.500 3.600-.5z" fill="${C.white}"/>`)
});
const I = (n, s) => UI.icon(n, s || 18);

/* ------------------------------------------------------------------ utilitaires */
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const MEDAL_C = { 0: 'var(--line)', 1: '#b07a45', 2: '#aeb7c4', 3: '#e8b923' };
UP.profile = () => Game.profile();
UP.xpBar = (lv, o) => { o = o || {}; return h('div.xpbar' + (o.big ? '.big' : ''), { title: lv.max ? 'Niveau maximal' : num(lv.into) + ' / ' + num(lv.need) + ' XP' }, h('i', { style: { width: lv.pct + '%' } }), h('span', lv.max ? 'MAX' : num(lv.into) + ' / ' + num(lv.need) + ' XP')); };
UP.levelChip = level => h('span.lvchip', h('small', 'NIV'), h('b', String(level)));
/* Toasts après un compteur hors ticket (saisies, notes) : succès, montée de niveau. */
UP.toastBump = function (res) {
  if (!res) return;
  (res.newBadges || []).forEach(b => UI.toast('Succès débloqué : ' + b.label + ' (+' + (b.xp || 0) + ' XP)' + (b.id === 'fingers' ? '. Ouvre l’arbre de compétences : le coffre-fort d’identifiants est à toi.' : b.id === 'fingers2' ? '. Le coffre peut maintenant remplir les terminaux (à acheter dans l’arbre).' : ''), 'ok', 9000));
  (res.levelUps || []).forEach(l => UI.toast('Niveau ' + l + ' atteint : ' + P.titleOf(l) + '. Un point de compétence t’attend.', 'ok', 9000));
};

/* ------------------------------------------------------------------ carte de profil (accueil) */
UP.profileCard = function (prof, app) {
  const lv = P.levelOf(prof.xp); const pts = P.pointsLeft(prof); const st = P.streakInfo(prof);
  const streakTxt = st.alive ? (st.n + ' jour' + (st.n > 1 ? 's' : '') + (st.state === 'pending' ? ' — joue aujourd’hui pour la garder' : st.state === 'shield' ? ' — le Joker te couvre' : '')) : (st.best ? 'perdue (record : ' + st.best + ')' : 'aucune pour l’instant');
  return h('div.hcard.pcard',
    h('h3', 'Carrière'),
    h('div.prow', UP.levelChip(lv.level), h('div.grow', h('div.ptitle', P.displayTitle(prof)), UP.xpBar(lv))),
    h('div.pchips',
      h('span.pchip' + (pts ? '.glow' : ''), { title: 'Un point par niveau, +1 aux niveaux 10, 20, 30 et 40' }, I('spark', 14), pts + ' point' + (pts > 1 ? 's' : '') + ' de compétence'),
      h('span.pchip', { title: 'Jours consécutifs avec au moins un ticket validé' }, I('flame', 14), 'Série : ' + streakTxt)),
    h('div.hbtns', { style: { marginTop: '8px' } },
      h('button.btn' + (pts ? '.primary' : ''), { on: { click: () => UP.screen(app, 'tree') } }, 'Arbre de compétences'),
      h('button.btn', { on: { click: () => UP.screen(app, 'mastery') } }, 'Maîtrises par compétence'),
      h('button.btn', { on: { click: () => UP.screen(app, 'ach') } }, 'Succès (' + prof.badges.length + ' / ' + Game.BADGES.length + ')')));
};

/* ------------------------------------------------------------------ ticket du jour (accueil) */
UP.dailyOpts = function () {
  const d = P.daily(); const o = { level: d.level, mode: 'free', seed: d.seed, daily: true };
  if (d.level <= 2) o.faultId = Game.pick(d.level, d.seed, null).id;     /* même panne pour tout le monde, quel que soit le profil */
  return o;
};
UP.dailyCard = function (prof, app) {
  const d = P.daily(); const done = P.dailyDone(prof); const L = Game.levelOf(d.level); const st = P.streakInfo(prof);
  return h('div.pdaily' + (done ? '.done' : ''),
    h('div.pdi', I('target', 34)),
    h('div.grow', h('b', 'Ticket du jour'), h('div.muted', done ? 'Validé aujourd’hui. Reviens demain : un nouvel incident, le même pour tout le monde.' : 'Niveau ' + L.label + ' · même incident pour tous les élèves aujourd’hui · XP ×1,5' + (st.alive ? ' · ta série de ' + st.n + ' jour' + (st.n > 1 ? 's' : '') + ' compte sur toi' : ''))),
    h('button.btn' + (done ? '' : '.primary'), { on: { click: () => app.begin(UP.dailyOpts()) } }, done ? 'Le rejouer' : 'Relever le défi'));
};

/* ------------------------------------------------------------------ écran Arbre / Maîtrises / Succès */
const ACH_PROG = {
  fingers: p => [(p.stats || {}).logins || 0, 20], fingers2: p => [(p.stats || {}).logins || 0, 60], fingers3: p => [(p.stats || {}).logins || 0, 150],
  cmds500: p => [(p.stats || {}).cmds || 0, 500], cmds3000: p => [(p.stats || {}).cmds || 0, 3000], five: p => [(p.stats || {}).passed || 0, 5], twenty: p => [(p.stats || {}).passed || 0, 20],
  fifty: p => [(p.stats || {}).passed || 0, 50], hundred: p => [(p.stats || {}).passed || 0, 100], perfect5: p => [(p.stats || {}).perfect || 0, 5], clean10: p => [(p.stats || {}).clean || 0, 10],
  goals30: p => [(p.stats || {}).goals || 0, 30], root10: p => [(p.stats || {}).root || 0, 10], daily7: p => [(p.stats || {}).dailies || 0, 7],
  explorer: p => [Object.keys(p.done || {}).filter(k => p.done[k].count > 0).length, 10], cartographer: p => [Object.keys(p.done || {}).filter(k => p.done[k].count > 0).length, 50], encyclopedia: p => [Object.keys(p.done || {}).filter(k => p.done[k].count > 0).length, 100]
};
UP.screen = function (app, tab) {
  let cur = tab || 'tree'; let prof = Game.profile(); const ov = h('div.overlay.pgov'); const box = h('div.pgscr'); ov.append(box);
  const close = () => { ov.remove(); if (app && app.run === null && app.root && app.root.querySelector('.screen.home')) app.home(); };
  const save = () => { Game.saveProfile(prof); };
  const head = () => { const lv = P.levelOf(prof.xp); const pts = P.pointsLeft(prof);
    return h('div.pghead', UP.levelChip(lv.level), h('div.grow', h('div.ptitle', P.displayTitle(prof)), UP.xpBar(lv, { big: true })),
      h('div.pgpts' + (pts ? '.glow' : ''), h('b', String(pts)), h('span', 'point' + (pts > 1 ? 's' : '') + ' à dépenser')),
      h('button.btn', { on: { click: close } }, 'Fermer')); };
  const tabsEl = () => h('div.pgtabs', [['tree', 'Arbre de compétences'], ['rewards', 'Récompenses'], ['mastery', 'Maîtrises'], ['ach', 'Succès']].map(t => h('button.pgtab.pgtab-' + t[0] + (cur === t[0] ? '.on' : ''), { on: { click: () => { cur = t[0]; draw(); } } }, t[1])));
  /* --- arbre --- */
  const treeView = () => {
    const cols = P.BRANCHES.map(br => h('div.pgcol', h('h3', br.label), h('div.pgchain', P.TREE.filter(n => n.branch === br.id).map(n => {
      const owned = P.has(prof, n.id); const why = owned ? null : P.whyNot(prof, n.id);
      const auto = n.auto && !(prof.tree && prof.tree[n.id]);
      const state = owned ? 'owned' : why ? 'locked' : 'buy';
      const extra = [];
      if (n.theme && owned) extra.push(h('button.btn.small', { on: { click: () => { UI.themes.apply(n.theme, true); UI.toast('Thème appliqué.', 'ok', 2500); } } }, 'Appliquer'));
      if (n.id === 'titles' && owned) { const owns = P.titlesOwned(P.levelOf(prof.xp).level); extra.push(h('select.txt', { on: { change: e => { prof.title = e.target.value; save(); draw(); } } }, owns.map(t => h('option', { value: t, selected: P.displayTitle(prof) === t }, t)))); }
      return h('div.pgnode.' + state, h('div.pgni', I(n.icon, 26)),
        h('div.grow', h('b', n.label), h('div.muted.pgdesc', { title: n.desc }, n.desc),
          owned ? h('div.pgown', auto ? 'Offert par un succès' : 'Débloqué') : h('div.pgcost', n.cost ? n.cost + ' point' + (n.cost > 1 ? 's' : '') : 'Gratuit'),
          why && !owned ? h('div.pgwhy', why) : null, extra.length ? h('div.row', { style: { gap: '6px', marginTop: '4px' } }, extra) : null),
        !owned && !why ? h('button.btn.primary', { on: { click: () => { const r = P.buy(prof, n.id); if (r.ok) { save(); UI.toast('« ' + n.label + ' » débloqué.', 'ok', 3500); draw(); } else UI.toast(r.why, 'warn'); } } }, 'Débloquer') : null);
    }))));
    return h('div', h('p.muted', 'Tu choisis : un point par niveau, à dépenser ici. Rien ne change ta note.'),
      h('div.pgcols', cols),
      h('div.row', { style: { marginTop: '10px' } }, h('button.btn', { on: { click: () => UI.modal('Réinitialiser l’arbre ?', h('p', 'Tous les nœuds achetés sont rendus et tes points te sont restitués. Les nœuds offerts par un succès restent à toi. Aucune XP n’est perdue.'), [{ label: 'Annuler' }, { label: 'Réinitialiser', danger: true, fn: () => { P.reset(prof); save(); draw(); } }]) } }, 'Réinitialiser l’arbre')));
  };
  /* --- maîtrises --- */
  const masteryView = () => {
    const doms = {}; Object.keys(SIM.skills).forEach(id => { const s = SIM.skills[id]; if (!s.domaine || s.domaine === 'Méthode') return; (doms[s.domaine] = doms[s.domaine] || []).push(id); });
    const cnt = P.masteryCounts(prof);
    return h('div', h('p.muted', 'Chaque ticket validé sans indice ni action risquée compte pour ses compétences : 1 fois = Bronze, 3 fois = Argent, 6 fois = Or. ', h('b', cnt[1] + ' bronze · ' + cnt[2] + ' argent · ' + cnt[3] + ' or')),
      h('div.pgmast', Object.keys(doms).map(d => h('div.pgdom', h('h3', d, h('span.muted', ' — ' + doms[d].filter(id => P.masteryOf(prof, id).rank > 0).length + ' / ' + doms[d].length)),
        doms[d].map(id => { const m = P.masteryOf(prof, id); const sk = SIM.skills[id];
          return h('div.pgsk', h('span.pgmed', { style: { background: MEDAL_C[m.rank] }, title: m.label }, m.rank ? ['', 'B', 'A', 'O'][m.rank] : ''), h('div.grow', sk.label),
            h('span.muted', m.next ? m.ok + ' / ' + m.next : m.ok + ' ✓')); })))));
  };
  /* --- succès --- */
  let catF = 'Tous';
  const achView = () => {
    const cats = ['Tous'].concat(Array.from(new Set(Game.BADGES.map(b => b.cat))));
    const own = id => prof.badges.indexOf(id) >= 0;
    const list = Game.BADGES.filter(b => catF === 'Tous' || b.cat === catF);
    return h('div', h('div.pgfilter', cats.map(c => h('button.pgtab' + (catF === c ? '.on' : ''), { on: { click: () => { catF = c; draw(); } } }, c))),
      h('div.pgach', list.map(b => { const o = own(b.id); const pr = ACH_PROG[b.id] ? ACH_PROG[b.id](prof) : null; const hidden = b.secret && !o;
        return h('div.pgac' + (o ? '.on' : ''), h('div.pgai', I(o ? 'medal' : 'lock', 26)), h('div.grow', h('b', hidden ? 'Succès secret' : b.label), h('div.muted', hidden ? 'À découvrir en jouant.' : b.desc),
          pr && !o ? h('div.xpbar.small', h('i', { style: { width: Math.min(100, Math.round(100 * pr[0] / pr[1])) + '%' } }), h('span', Math.min(pr[0], pr[1]) + ' / ' + pr[1])) : null),
          h('span.pgxp', '+' + (b.xp || 0) + ' XP')); })));
  };
  const draw = () => { UI.clear(box); box.append(head(), tabsEl(), h('div.pgbody', cur === 'tree' ? treeView() : cur === 'rewards' ? UI.rewards.view(app, prof, save, draw) : cur === 'mastery' ? masteryView() : achView())); };
  document.body.appendChild(ov); draw();
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }); ov.tabIndex = -1; ov.focus();
  return { close };
};

/* ------------------------------------------------------------------ bilan d'XP du débrief */
UP.debriefPanel = function (pg) {
  if (!pg) return null;
  const multTxt = pg.mult.map(x => h('tr', h('td', x.label), h('td.r', '× ' + String(x.f).replace('.', ','))));
  const partsTxt = pg.parts.map(x => h('tr', h('td', x.label), h('td.r', '+' + x.xp)));
  const goals = pg.goals || [];
  const bar = h('div.xpbar.big', h('i', { style: { width: pg.from.level === pg.to.level ? pg.from.pct + '%' : '0%' } }), h('span'));
  const fill = bar.firstChild; const lab = bar.lastChild;
  lab.textContent = pg.to.max ? 'Niveau maximal' : num(pg.to.into) + ' / ' + num(pg.to.need) + ' XP';
  setTimeout(() => { fill.style.width = pg.to.pct + '%'; }, 120);
  return h('div.pgdeb',
    h('h2', 'Expérience'),
    h('div.card.pgxpcard',
      h('div.prow', UP.levelChip(pg.to.level), h('div.grow', h('div.ptitle', pg.title), bar), h('div.pgxpbig', h('b', '+' + num(pg.xp)), h('span', 'XP'))),
      pg.levelUps.length ? h('div.pglevelup', I('spark', 18), ' Niveau ' + pg.levelUps[pg.levelUps.length - 1] + ' atteint' + (pg.newTitle ? ' — nouveau titre : ' + pg.title : '') + ' · +' + pg.pointsGain + ' point' + (pg.pointsGain > 1 ? 's' : '') + ' de compétence') : null,
      h('table.tbl.pgxpt', h('tbody', partsTxt, multTxt, pg.xpBadges ? h('tr', h('td', 'Succès débloqués'), h('td.r', '+' + pg.xpBadges)) : null)),
      goals.length ? h('div.pggoals', h('h3', 'Objectifs bonus'), goals.map(x => h('div.pgg' + (x.done ? '.ok' : ''), h('span.pgchk', x.done ? '✓' : '✗'), h('span.grow', x.label), h('span.muted', (x.done ? '+' : '') + x.xp + ' XP')))) : null,
      pg.streak && pg.streak.alive ? h('div.muted', { style: { marginTop: '6px' } }, I('flame', 14), ' Série : ' + pg.streak.n + ' jour' + (pg.streak.n > 1 ? 's' : '') + (pg.streak.note ? ' — ' + pg.streak.note : '')) : null,
      pg.newBadges.length ? h('div.pgnewb', pg.newBadges.map(b => h('span.tag.ok', { style: { fontSize: '13px', padding: '3px 10px' }, title: b.desc }, 'Succès : ' + b.label + ' (+' + (b.xp || 0) + ')'))) : null));
};

/* ------------------------------------------------------------------ objectifs bonus dans le ticket */
UP.goalsBox = function (run) {
  const m = run.m; if (!m.goals || !m.goals.length) return null;
  const box = h('div.pgoalbox'); const draw = () => {
    UI.clear(box); box.append(h('div.pgoalh', I('target', 14), ' Objectifs bonus', m.daily ? h('span.tag.ok', { style: { marginLeft: '6px' } }, 'ticket du jour ×1,5') : null));
    P.goalLive(m).forEach(x => box.append(h('div.pgg' + (x.alive ? '' : '.lost'), h('span.pgchk', x.alive ? '◇' : '✗'), h('span.grow', x.label), h('span.muted', '+' + x.xp))));
  };
  draw(); run.on('act', draw); run.on('clock', () => { if (!run.ended) draw(); }); return box;
};

/* ------------------------------------------------------------------ coffre-fort d'identifiants */
const V = UI.vault = {};
V.profile = () => Game.profile();
V.mode = () => (g.SIM_APP && g.SIM_APP.run && g.SIM_APP.run.m && g.SIM_APP.run.m.mode) || null;
/* Le coffre répond-il ? Palier 1 : formulaires graphiques ; palier 2 : terminaux. Coupé en évaluation chronométrée. */
V.active = function (tier) {
  const run = g.SIM_APP && g.SIM_APP.run; if (!run) return false;
  const p = V.profile(); return P.perkActive(V.mode()) && P.has(p, tier === 2 ? 'vault2' : 'vault1');
};
/* Une saisie manuelle de mot de passe : compte pour le succès « Mémoire des doigts ». Les mots de passe vides ou trop courts ne comptent pas. */
V.manual = function (secret) {
  if (!g.SIM_APP || !g.SIM_APP.run || typeof secret !== 'string' || secret.length < 3) return;
  const p = V.profile(); const res = P.bump(p, 'logins'); Game.saveProfile(p); UP.toastBump(res);
};
V.pick = function (kinds, userHint, cb, strict) {
  let list = SIM.VAULT.filter(c => kinds.some(k => c.tags.indexOf(k) >= 0));
  const tail = s => String(s).replace(/^.*\\/, '').toLowerCase();
  if (userHint) { const only = list.filter(c => tail(c.user) === tail(userHint)); if (only.length || strict) list = only; }
  if (!list.length) { UI.toast(strict && userHint ? 'Le coffre n’a pas de mot de passe pour « ' + userHint + ' ».' : 'Le coffre n’a aucun identifiant pour cet usage.', 'warn', 4500); return; }
  if (list.length === 1) { cb(list[0]); return; }
  let mm; mm = UI.modal('Coffre-fort d’identifiants', h('div', h('p.muted', 'Choisis le compte à utiliser. Dans la vraie vie : le moins privilégié qui suffit.'),
    h('table.tbl', h('tbody', list.map(c => h('tr', h('td', c.scope), h('td', h('code', c.user)), h('td', h('button.btn.small.primary', { on: { click: () => { mm.close(); cb(c); } } }, 'Remplir'))))))), [{ label: 'Annuler' }]);
};
/* Champs d'un formulaire graphique : bouton clé + comptage des saisies manuelles. opts : { user: <input>|null, pwd: <input>, kinds: [...], userHint?: string }. */
V.field = function (opts) {
  const state = { filled: null };
  opts.pwd.addEventListener('input', () => { if (state.filled !== null && opts.pwd.value !== state.filled) state.filled = null; });
  const btn = V.active(1) ? h('button.btn.small.vkey', { type: 'button', title: 'Coffre-fort : remplir l’identifiant et le mot de passe', on: { click: ev => { ev.preventDefault(); V.pick(opts.kinds, opts.userHint || (opts.user && opts.user.value.trim()) || '', c => {
    if (opts.user) { opts.user.value = c.user; opts.user.dispatchEvent(new Event('input')); }
    opts.pwd.value = c.secret; state.filled = c.secret; opts.pwd.dispatchEvent(new Event('input')); state.filled = c.secret; opts.pwd.focus();
  }); } } }, I('key', 14), ' Coffre') : null;
  return { btn, submit: () => { if (state.filled !== null && opts.pwd.value === state.filled) return; V.manual(opts.pwd.value); } };
};
/* Invites de mot de passe des terminaux : Ctrl + Espace. Retourne true si la touche a été traitée. */
V.termKey = function (term, s) {
  const a = s && s.ask; if (!a || a.echo !== false) return false;
  if (!V.active(2)) { UI.toast(V.profile() && P.has(V.profile(), 'vault1') ? 'Le coffre ne remplit pas les terminaux : débloque « Coffre-fort : terminaux » dans l’arbre (ou il est coupé en évaluation chronométrée).' : 'Tu n’as pas (encore) de coffre-fort : tape le mot de passe à la main.', 'warn', 5000); return true; }
  const pr = String(a.prompt || ''); let kinds = ['ssh', 'sudo', 'enable'], hint = a.user || '';
  let m = /^\[sudo\] password for ([\w.-]+):/.exec(pr); if (m) { kinds = ['sudo']; hint = m[1]; }
  else { m = /^([\w.-]+)@.*'s password:/.exec(pr); if (m) { kinds = ['ssh']; hint = m[1]; } else if (s.kind === 'ios') kinds = ['enable', 'ssh']; }
  if (hint && kinds.length === 3) kinds = ['ssh', 'sudo'];
  V.pick(kinds, hint, c => { term.buf = c.secret; term.pos = c.secret.length; term._vaultFilled = c.secret; term.render(); term.focus(); UI.toast('Mot de passe inséré depuis le coffre.', 'ok', 2500); }, !!hint);
  return true;
};

/* Bouton clé dans les terminaux : visible seulement à une invite de mot de passe, si le palier 2 du coffre est actif (même action que Ctrl + Espace). Élément ajouté, pas une réplique de console réelle. */
V.termShown = function (term) { const s = term.session && term.session(); return !!(s && s.secret && s.secret() && s.ask && s.ask.echo === false && V.active(2)); };
V.termRefresh = function (term) { if (term.vaultBtn) term.vaultBtn.style.display = V.termShown(term) ? '' : 'none'; };
V.termAttach = function (term) {
  if (term.vaultBtn || ['ios', 'ps', 'cmd', 'bash'].indexOf(term.theme) < 0) return;
  term.vaultBtn = h('button.tvault', { type: 'button', title: 'Coffre-fort : insérer le mot de passe (Ctrl + Espace)', 'aria-label': 'Coffre-fort d’identifiants', on: { click: e => { e.stopPropagation(); V.termKey(term, term.session()); }, mousedown: e => { e.preventDefault(); e.stopPropagation(); } } }, I('key', 12), ' Coffre');
  term.el.append(term.vaultBtn); V.termRefresh(term);
};

/* ------------------------------------------------------------------ carnet de bord */
UP.notesAvailable = function (run) { const p = Game.profile(); return !!run && P.perkActive(run.m.mode) && P.has(p, 'notes'); };
UP.notesModal = function (run) {
  const p = Game.profile(); const key = run.id; const ta = h('textarea.pgnotes', { rows: 14, maxlength: 4000, placeholder: 'Hypothèses, commandes utiles, ce qui a marché…\n\nCe carnet est conservé dans ton profil (30 derniers tickets).' });
  ta.value = (p.notes && p.notes[key]) || '';
  const save = () => { const q = Game.profile(); q.notes = q.notes || {}; const v = ta.value.slice(0, 4000); const had = !!q.notes[key]; if (v.trim()) q.notes[key] = v; else delete q.notes[key];
    const ks = Object.keys(q.notes); while (ks.length > 30) delete q.notes[ks.shift()];
    let res = null; if (v.trim() && !had) res = P.bump(q, 'notes'); Game.saveProfile(q); UP.toastBump(res); };
  UI.modal('Carnet de bord — ticket ' + key, h('div', ta), [{ label: 'Enregistrer et fermer', primary: true, fn: save }]);
  setTimeout(() => ta.focus(), 30);
};

/* ------------------------------------------------------------------ sauvegarde du profil */
UP.backupModal = function (app) {
  const ta = h('textarea.pgnotes', { rows: 6, spellcheck: false, placeholder: 'Colle ici le contenu d’une sauvegarde pour la restaurer.' });
  const msg = h('div.muted', { style: { marginTop: '6px' } });
  let mm = null;
  const restore = () => {
    let o; try { o = JSON.parse(ta.value); } catch (e) { msg.textContent = 'Contenu illisible : ce n’est pas du JSON.'; return; }
    const cur = Game.profile(); const nw = Game.cleanProfile(o);
    if (nw.v !== 2 || (!nw.history.length && !nw.xp && !nw.badges.length)) { msg.textContent = 'Ce profil est vide ou d’un ancien format : rien n’a été restauré.'; return; }
    if (P.levelOf(nw.xp).level < P.levelOf(cur.xp).level && !g.confirm('La sauvegarde est moins avancée que ton profil actuel. La restaurer quand même ?')) return;
    Game.saveProfile(P.migrate(nw)); mm.close(); UI.toast('Profil restauré.', 'ok', 3500); app.home();
  };
  mm = UI.modal('Sauvegarde du profil', h('div', UI.paras('Ton profil (XP, arbre, succès, historique, carnet) vit dans le stockage du navigateur : il disparaît si tu le vides ou si tu changes de poste. Exporte-le pour le conserver, puis restaure-le ici.'),
    h('div.row', h('button.btn.primary', { on: { click: () => app.downloadJson('profil-edivn-lab.json', Game.profile()) } }, 'Exporter mon profil (JSON)')),
    h('h3', { style: { marginTop: '12px' } }, 'Restaurer'), ta, h('div.row', { style: { marginTop: '6px' } }, h('button.btn', { on: { click: restore } }, 'Restaurer ce profil')), msg),
    [{ label: 'Fermer' }]);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
