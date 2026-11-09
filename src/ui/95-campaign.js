/* ============================================================================
   Campagne et fiche d'intervention : accueil à trois entrées (Campagne, Astreinte, Bac à sable), écran « chantier »
   d'un chapitre, fiche d'intervention après un ticket résolu, blocs du débrief.
   Moteur : src/engine/83-campaign.js et 84-report.js. Chapitres : src/content/31-chapters.js.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, C = SIM.camp, h = UI.h;
const UC = UI.camp = {};
const P = UI.App.prototype;
const randomSeed = () => String(Math.floor(Math.random() * 900000000) + 100000000);
const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
const TYPE_ICON = { cloud: 'cloud', firewall: 'firewall', switch: 'switch', router: 'router', server: 'server', linux: 'linux', pc: 'pc', printer: 'printer', patch: 'patch' };
const nodeOf = id => { for (const sid of Object.keys(UI.SITES)) { const n = UI.SITES[sid].nodes.find(x => x[0] === id); if (n) return { type: n[3], sub: n[4], site: UI.SITES[sid].label }; } return { type: 'pc', sub: '', site: '' }; };

/* ------------------------------------------------------------------ lancement */
P.campMode = function () { const v = this._campMode || Game.store.get('campmode'); return v === 'free' || v === 'guided' ? v : 'guided'; };
P.setCampMode = function (v) { this._campMode = v; Game.store.set('campmode', v); };
/* périmètre montré par la fiche de l'infra depuis l'accueil : celui de la campagne, sauf dans le bac à sable */
P.infraScope = function () { if (this.legacy || this.homeTab !== 'camp') return null; const n = C.unlocked(Game.profile()); return { n, devs: C.scope(n), sites: C.sites(n) }; };
P.campTicket = function (n) {
  const self = this; const p = Game.profile();
  if (!C.chapterState(p, n).seen) { UC.chantier(this, n, () => self.campTicket(n)); return; }
  const sp = C.next(p, n, randomSeed()); if (!sp) { UI.toast('Aucune panne dans ce chapitre.', 'warn'); return; }
  this.begin({ level: sp.level, mode: this.campMode(), seed: sp.seed, faultId: sp.faultId, camp: sp.camp });
};
P.campExam = function (n) {
  const self = this; const ch = C.chapter(n);
  let sp; try { sp = C.exam(Game.profile(), n, randomSeed()); } catch (e) { UI.toast('Examen indisponible : ' + e.message, 'warn'); return; }
  const what = sp.parts > 1 ? 'un ticket qui cache ' + sp.parts + ' pannes prises dans tout ce que tu as vu jusqu’ici, dont au moins une de ce chapitre' : 'un ticket tiré parmi les pannes les plus difficiles de ce chapitre';
  UI.modal('Examen du chapitre ' + n, h('div', UI.paras('« ' + ch.title + ' » : ' + what + '.\n\nChronométré, sans indice ni assistant. Il faut ' + Game.PASS + ' / 100 pour ouvrir ' + (n < C.last() ? 'le chapitre suivant' : 'la fin de la campagne') + '. Tu peux le repasser autant de fois que tu veux : chaque tentative tire un nouvel incident.')),
    [{ label: 'Pas maintenant' }, { label: 'Commencer l’examen', primary: true, fn: () => self.begin(sp) }]);
};

/* ------------------------------------------------------------------ écran « chantier » : ce que le chapitre ajoute */
UC.chantier = function (app, n, then) {
  const ch = C.chapter(n); const p = Game.profile(); const st = C.chapterState(p, n);
  C.markSeen(p, n); Game.saveProfile(p);
  const devs = ch.devices.map(id => { const nd = nodeOf(id); return h('div.chdev', h('span.chdi', UI.icon(TYPE_ICON[nd.type] || 'pc', 26)), h('div', h('b', nd.type === 'patch' ? 'Baie de brassage' : id), h('small', nd.sub + (nd.site && n > 7 ? ' · ' + nd.site : '')))); });
  const body = h('div.chantier',
    h('div.chkick', 'Chapitre ' + n + ' / ' + C.last() + ' · ' + ch.kicker),
    h('p.chstory', ch.story),
    devs.length ? [h('h3', n === 1 ? 'Ton périmètre' : 'Nouveau dans ton périmètre'), h('div.chdevs', devs)] : [h('h3', 'Ton périmètre'), h('p.muted', 'Aucun nouvel équipement : tu approfondis ceux que tu connais déjà.')],
    h('h3', 'Au programme'), h('ul.chlearn', ch.learn.map(x => h('li', x))),
    h('h3', 'Objectif'), h('p', 'Valider ' + plural(st.need, 'ticket') + ' (' + Game.PASS + ' / 100 ou plus) parmi les ' + st.pool + ' pannes du chapitre, puis réussir l’examen' + (n < C.last() ? ' pour ouvrir le chapitre ' + (n + 1) + '.' : ' final.')));
  const mm = UI.modal(ch.title, body, [{ label: then ? 'C’est parti' : 'Fermer', primary: true, fn: then || null }]);
  mm.el.classList.add('chmodal'); return mm;
};

/* ------------------------------------------------------------------ accueil : colonne de gauche à trois entrées */
UC.homeLeft = function (app, prof, parts) {
  const TABS = [['camp', 'Campagne', 'Ton parcours, chapitre par chapitre'], ['duty', 'Astreinte', 'Ticket du jour et incidents majeurs'], ['sandbox', 'Bac à sable', 'Tout est ouvert, tu choisis']];
  let tab = app.legacy ? 'sandbox' : (app.homeTab || Game.store.get('hometab') || 'camp'); if (!TABS.some(t => t[0] === tab)) tab = 'camp';
  app.homeTab = tab;
  const left = h('div.hleft'); if (app.legacy) left.append(parts.daily());
  const nav = h('div.cnav', { role: 'tablist' }); const pane = h('div.cpane');
  const draw = () => {
    UI.clear(nav); TABS.forEach(t => nav.append(h('button.cnavb' + (tab === t[0] ? '.on' : ''), { role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', 'data-tab': t[0], on: { click: () => { tab = t[0]; app.homeTab = tab; Game.store.set('hometab', tab); draw(); } } }, h('b', t[1]), h('small', t[2]))));
    UI.clear(pane);
    if (tab === 'camp') pane.append(UC.campPane(app, draw));
    else if (tab === 'duty') pane.append(UC.dutyPane(app, parts, prof));
    else pane.append(h('p.muted.cintro', 'Le jeu libre : toutes les pannes, toute l’infrastructure visible, les options du formateur. Rien de ce que tu fais ici ne fait avancer la campagne.'), ...parts.sandbox);
  };
  draw(); left.append(nav, pane); return left;
};
UC.campPane = function (app, redraw) {
  const prof = Game.profile(); const S = C.state(prof);
  let sel = app.campSel && C.chapterState(prof, app.campSel) && C.chapterState(prof, app.campSel).unlocked ? app.campSel : S.current;
  const st = S.chapters.find(c => c.n === sel), ch = st.ch; const mode = app.campMode();
  const left = Math.max(0, st.need - st.validated);
  const due = C.dueReviews(prof).filter(d => C.faultChapter(d) === sel).length;
  const modeBtn = (id, label, sub) => h('button.cmodeb' + (mode === id ? '.on' : ''), { 'data-mode': id, on: { click: () => { app.setCampMode(id); redraw(); } } }, h('b', label), h('small', sub));
  const ticketBtn = (primary, label) => h('button.btn' + (primary ? '.primary.cgo' : ''), { 'data-act': 'ticket', on: { click: () => app.campTicket(sel) } }, label);
  const examBtn = (primary, label) => h('button.btn' + (primary ? '.primary.cgo' : ''), { 'data-act': 'exam', disabled: !st.examReady, title: st.examReady ? '' : 'Valide encore ' + plural(left, 'ticket') + ' pour ouvrir l’examen', on: { click: () => app.campExam(sel) } }, label);
  const acts = st.done ? [ticketBtn(true, 'S’entraîner sur ce chapitre ▶'), examBtn(false, 'Repasser l’examen (meilleure note : ' + st.examBest + ')')]
    : st.examReady ? [examBtn(true, 'Passer l’examen du chapitre ▶'), ticketBtn(false, 'S’entraîner encore')]
    : [ticketBtn(true, 'Prendre un ticket ▶'), examBtn(false, 'Examen du chapitre')];
  const card = h('div.ccard' + (st.done ? '.done' : ''),
    h('div.ckick', 'Chapitre ' + sel + ' / ' + C.last() + ' · ' + ch.kicker, st.done ? h('span.tag.ok', 'Examen réussi · ' + st.examBest + ' / 100') : null),
    h('h2.ctitle', ch.title), h('p.cstory', ch.story),
    h('div.cprog', h('div.cbar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': st.need, 'aria-valuenow': Math.min(st.validated, st.need) }, h('i', { style: { width: Math.round(100 * Math.min(1, st.need ? st.validated / st.need : 1)) + '%' } })),
      h('span.cprogt', h('b', Math.min(st.validated, st.need) + ' / ' + st.need), ' tickets validés', st.validated > st.need ? ' (' + st.validated + ' sur les ' + st.pool + ' du chapitre)' : ' · ' + st.pool + ' pannes dans ce chapitre')),
    h('div.cstate', st.done ? 'Chapitre terminé. Tu peux continuer à t’entraîner : les pannes pas encore vues passent en premier.' : st.examReady ? 'L’examen est ouvert : chronométré, sans indice ni assistant.' : 'Encore ' + plural(left, 'ticket') + ' à valider (' + Game.PASS + ' / 100 ou plus) pour ouvrir l’examen.',
      due ? h('div.cdue', '↻ ' + plural(due, 'panne') + ' à revoir : ' + (due > 1 ? 'elles reviennent' : 'elle revient') + ' en priorité au prochain ticket.') : null),
    h('div.cmode', h('span.muted', 'Comment tu joues ce ticket :'), modeBtn('guided', 'Accompagné', 'Indices gratuits, assistant pas à pas'), modeBtn('free', 'Autonome', 'Indices payants, plus d’XP')),
    h('div.cact', acts, h('button.btn', { 'data-act': 'chantier', on: { click: () => UC.chantier(app, sel, null) } }, 'Voir le chantier')));
  const path = h('div.cpath', { 'aria-label': 'Chapitres de la campagne' }, S.chapters.map(c => {
    const cls = (c.done ? '.done' : '') + (c.n === S.current && !c.done ? '.cur' : '') + (c.unlocked ? '' : '.lock') + (c.n === sel ? '.sel' : '');
    return h('button.cnode' + cls, { disabled: !c.unlocked, 'data-ch': c.n, title: c.unlocked ? c.ch.title : 'Réussis l’examen du chapitre ' + (c.n - 1) + ' pour l’ouvrir', on: { click: () => { app.campSel = c.n; redraw(); } } },
      h('span.cnn', c.done ? '✓' : c.unlocked ? String(c.n) : '🔒'), h('span.cnt', c.ch.title), h('small', c.done ? 'Terminé' : c.unlocked ? Math.min(c.validated, c.need) + ' / ' + c.need : 'Verrouillé'));
  }));
  return h('div', S.finished ? h('div.cfin', h('b', 'Campagne terminée.'), ' Toute l’infrastructure est sous ta responsabilité. Reste l’astreinte, le ticket du jour, et les pannes que tu n’as pas encore croisées.') : null, card, h('h2.cpatht', 'Le parcours'), path);
};
UC.dutyPane = function (app, parts, prof) {
  let timed = app._dutyTimed === true;
  const box = h('div');
  const draw = () => {
    UI.clear(box);
    const go = lv => app.begin({ level: lv, mode: timed ? 'timed' : 'free', seed: randomSeed() });
    box.append(parts.daily(),
      h('p.muted.cintro', 'Incidents majeurs : plusieurs pannes de natures différentes dans le même ticket, tirées dans toute l’infrastructure. À garder pour quand la campagne est bien avancée.'),
      h('div.cduty', [[3, 'Incident double', '2 pannes'], [4, 'Incident critique', '3 pannes, dont une subtile'], [5, 'Nuit noire', '4 pannes, parfois masquées entre elles']].map(x => h('button.cdutyb', { 'data-level': x[0], on: { click: () => go(x[0]) } }, h('b', x[1]), h('small', x[2]), h('span.muted', 'Cible ≈ ' + Math.round(Game.levelPar(x[0]) / 60) + ' min')))),
      h('label.cchk', h('input', { type: 'checkbox', checked: timed, on: { change: e => { timed = e.target.checked; app._dutyTimed = timed; } } }), ' Chronométré, sans indice'));
  };
  draw(); return box;
};

/* ------------------------------------------------------------------ ticket : critère de clôture, toujours affiché */
UC.verifBox = function (m) {
  const texts = []; m.parts.forEach(p => { const t = SIM.report.closeText(p); if (texts.indexOf(t) < 0) texts.push(t); });
  return texts.map(t => h('div.verif', h('b', 'Pour clôturer : '), t));
};

/* ------------------------------------------------------------------ fiche d'intervention (ticket résolu, avant le débrief) */
UC.reportModal = function (app, run, spec) {
  const m = run.m; const ans = {}; const DK = '?';
  const submit = h('button.btn.primary', { disabled: true, on: { click: () => { ov.remove(); const a = {}; Object.keys(ans).forEach(k => { if (ans[k] !== DK) a[k] = ans[k]; }); run.finalize(a); } } }, 'Fermer le ticket');
  const left = h('span.muted');
  const refresh = () => { const n = spec.questions.length - Object.keys(ans).length; submit.disabled = n > 0; left.textContent = n > 0 ? plural(n, 'réponse') + ' manquante' + (n > 1 ? 's' : '') : 'Fiche complète.'; };
  const qbox = q => {
    const box = h('div.fq', { 'data-q': q.id }, h('div.fql', q.label), h('div.fqh', q.help));
    const opts = q.options.concat([{ id: DK, text: 'Je ne sais pas', dk: true }]).map(o => {
      const b = h('button.fopt' + (o.dk ? '.dk' : ''), { 'data-o': o.id, 'aria-pressed': 'false', on: { click: () => { ans[q.id] = o.id; box.querySelectorAll('.fopt').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); refresh(); } } }, h('span.fob'), h('span', o.text));
      return b;
    });
    box.append(h('div.fopts', opts)); return box;
  };
  const rule = m.mode.hintsFree ? 'Mode accompagné : la fiche est corrigée au débrief, elle n’enlève aucun point.' : 'Cause mal identifiée : −' + SIM.report.CAUSE_COST + ' · correction mal identifiée : −' + SIM.report.FIX_COST + '. La fiche ne fait jamais échouer un ticket réparé : elle départage les étoiles.';
  const ov = h('div.overlay.frep', h('div.modal.fmodal', { role: 'dialog', 'aria-label': 'Fiche d’intervention' },
    h('div.fhead', h('span.tag.ok', 'Ticket résolu'), h('span.muted', 'Ticket ' + run.id + ' · chrono arrêté à ' + UI.fmtDur(m.result.mttrSec))),
    h('h2', 'Fiche d’intervention'),
    h('p.muted', 'Le demandeur est dépanné. Avant de fermer le ticket, consigne ce que tu as trouvé : c’est ce qui sépare une panne réparée d’une panne comprise.'),
    spec.questions.map(qbox),
    h('div.frule', rule),
    h('div.actions', left, submit)));
  document.body.appendChild(ov); refresh();
};

/* ------------------------------------------------------------------ débrief */
UC.debriefReport = function (rp) {
  if (!rp) return null;
  return [h('h2', 'Ta fiche d’intervention'),
    h('div.card.dfiche' + (rp.allOk ? '.ok' : ''), rp.rows.map(x => h('div.dfrow', h('span.tag' + (x.ok ? '.ok' : '.bad'), x.ok ? 'Juste' : x.chosen ? 'Faux' : 'Sans réponse'), h('div', h('b', x.label),
        x.ok ? h('div.muted', x.answerText) : [x.chosenText ? h('div.dfko', 'Ta réponse : ' + x.chosenText) : null, h('div', 'Réponse attendue : ' + x.answerText)]))),
      h('div.muted.dfsum', rp.allOk ? 'Panne réparée et comprise.' + (rp.guided ? '' : ' Bonus d’XP.') : rp.guided ? 'Mode accompagné : aucun point retiré. La panne reviendra dans quelques tickets pour que tu la retravailles.' : (rp.penalty ? '−' + rp.penalty + ' sur la note. ' : 'Aucun point retiré (note déjà au seuil). ') + (rp.causeOk ? '' : 'La panne reviendra dans quelques tickets pour que tu la retravailles.')))];
};
UC.debriefCamp = function (app, camp) {
  if (!camp) return null;
  const ch = C.chapter(camp.ch); const pct = Math.round(100 * Math.min(1, camp.need ? camp.validated / camp.need : 1));
  const msg = camp.finished ? h('div.dcbig', '★ Campagne terminée. Toute l’infrastructure est sous ta responsabilité.')
    : camp.unlocked ? h('div.dcbig', '★ Chapitre ' + camp.unlocked + ' débloqué : ' + C.chapter(camp.unlocked).title)
    : camp.exam ? h('div', camp.passed ? 'Examen réussi une nouvelle fois.' : 'Examen à repasser : il faut ' + Game.PASS + ' / 100. Chaque tentative tire un nouvel incident.')
    : camp.examNowReady ? h('div.dcbig', 'L’examen du chapitre est ouvert.')
    : camp.examReady ? h('div', 'L’examen du chapitre t’attend.')
    : h('div', camp.passed ? 'Encore ' + plural(Math.max(0, camp.need - camp.validated), 'ticket') + ' à valider avant l’examen.' : 'Ticket non validé : il ne compte pas pour le chapitre' + (camp.review ? '' : ', et la panne reviendra dans quelques tickets') + '.');
  return h('div.card.dcamp' + (camp.unlocked || camp.finished ? '.up' : ''), h('h3', 'Campagne · chapitre ' + camp.ch + ' — ' + ch.title + (camp.exam ? ' · examen' : camp.review ? ' · révision' : '')),
    h('div.cprog', h('div.cbar', h('i', { style: { width: pct + '%' } })), h('span.cprogt', h('b', Math.min(camp.validated, camp.need) + ' / ' + camp.need), ' tickets validés')), msg);
};
UC.debriefNext = function (app, m, camp) {
  if (!m.camp || !camp) return null;
  const n = camp.ch; const p = Game.profile();
  if (camp.finished) return h('button.btn.primary', { on: { click: () => app.home() } }, 'Retour à la campagne');
  if (camp.unlocked) return h('button.btn.primary', { 'data-act': 'next', on: { click: () => { app.campSel = camp.unlocked; app.campTicket(camp.unlocked); } } }, 'Découvrir le chapitre ' + camp.unlocked + ' ▶');
  if (camp.examReady && !C.examPassed(p, n)) return [h('button.btn.primary', { 'data-act': 'exam', on: { click: () => app.campExam(n) } }, camp.exam ? 'Repasser l’examen ▶' : 'Passer l’examen du chapitre ▶'), h('button.btn', { 'data-act': 'next', on: { click: () => app.campTicket(n) } }, 'Ticket suivant')];
  return h('button.btn.primary', { 'data-act': 'next', on: { click: () => app.campTicket(n) } }, 'Ticket suivant ▶');
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
