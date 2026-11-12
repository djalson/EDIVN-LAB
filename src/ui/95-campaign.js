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

/* Contrats repliés : rien tant qu'aucun n'est débloqué ; ouverts quand au moins un est coché (le multiplicateur reste visible). */
UC.contractsFold = function (app, prof, off) {
  const RW = SIM.rewards; if (app.legacy || !RW.CONTRACTS.some(c => RW.contractOwned(prof, c.id))) return null;
  const tag = h('span.cctrn'); const upd = ids => { tag.textContent = ids.length ? 'XP × ' + RW.contractFactor(ids).toFixed(2).replace('.', ',') : ''; };
  const on = UI.rewards.contracts(); upd(on);
  return h('details.cctr', on.length ? { open: true } : {}, h('summary', 'Contrats', tag, h('span.muted.cctrh', 'plus d’XP contre une contrainte')), UI.rewards.contractPicker(app, { off, onChange: upd }));
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
    h('div.chgoal', h('b', plural(st.need, 'ticket') + ' validé' + (st.need > 1 ? 's' : '')), ' puis l’examen ', h('span.muted', '(' + Game.PASS + ' / 100 ou plus)')));
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
    else pane.append(h('p.muted.cintro', app.legacy ? 'Le jeu libre : toutes les pannes, toute l’infrastructure visible, les options du formateur. Rien de ce que tu fais ici ne fait avancer la campagne.' : 'Tout est ouvert. Rien ici ne fait avancer la campagne.'), UC.contractsFold(app, prof, ''), ...parts.sandbox);
  };
  draw(); left.append(nav, pane); return left;
};
UC.campPane = function (app, redraw) {
  const prof = Game.profile(); const S = C.state(prof);
  let sel = app.campSel && C.chapterState(prof, app.campSel) && C.chapterState(prof, app.campSel).unlocked ? app.campSel : S.current;
  const st = S.chapters.find(c => c.n === sel), ch = st.ch; const mode = app.campMode();
  const left = Math.max(0, st.need - st.validated);
  const due = C.dueReviews(prof).filter(d => C.faultChapter(d) === sel).length;
  const modeBtn = (id, label, sub) => h('button.cmodeb' + (mode === id ? '.on' : ''), { 'data-mode': id, title: sub, 'aria-pressed': mode === id ? 'true' : 'false', on: { click: () => { app.setCampMode(id); redraw(); } } }, h('b', label));
  const ticketBtn = (primary, label) => h('button.btn' + (primary ? '.primary.cgo' : '.csec'), { 'data-act': 'ticket', on: { click: () => app.campTicket(sel) } }, label);
  const examBtn = (primary, label) => h('button.btn' + (primary ? '.primary.cgo.cexam' : '.csec'), { 'data-act': 'exam', disabled: !st.examReady, title: st.examReady ? '' : 'Valide encore ' + plural(left, 'ticket') + ' pour ouvrir l’examen', on: { click: () => app.campExam(sel) } }, label);
  /* une action principale, énorme ; la seconde, discrète */
  const acts = st.done ? [ticketBtn(true, 'S’entraîner ▶'), examBtn(false, 'Repasser l’examen · ' + st.examBest)]
    : st.examReady ? [examBtn(true, 'Passer l’examen ▶'), ticketBtn(false, 'S’entraîner encore')]
    : [ticketBtn(true, 'Prendre un ticket ▶'), examBtn(false, '🔒 Examen dans ' + plural(left, 'ticket'))];
  const pips = h('div.cpips', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': st.need, 'aria-valuenow': Math.min(st.validated, st.need), 'aria-label': 'Tickets validés' },
    Array.from({ length: st.need }, (x, i) => h('i' + (i < st.validated ? '.on' : ''))), h('span.cpipx' + (st.done ? '.on' : st.examReady ? '.ready' : ''), { title: 'Examen' }, '★'));
  const contracts = UC.contractsFold(app, prof, mode === 'guided' ? 'indisponibles en mode accompagné' : '');
  const card = h('div.ccard' + (st.done ? '.done' : ''),
    h('div.ckick', 'Chapitre ' + sel + ' / ' + C.last(), st.done ? h('span.tag.ok', '✓ Examen réussi · ' + st.examBest) : null, due ? h('span.cdue', '↻ ' + plural(due, 'panne') + ' à revoir') : null),
    h('h2.ctitle', ch.title),
    h('div.cprog', pips, h('span.cprogt', h('b', Math.min(st.validated, st.need) + ' / ' + st.need), ' tickets')),
    h('div.cact', acts[0], h('div.cmode', modeBtn('guided', 'Accompagné', 'Indices gratuits, assistant pas à pas'), modeBtn('free', 'Autonome', 'Indices payants, plus d’XP'))),
    h('div.cmore', acts[1], h('button.flink', { 'data-act': 'chantier', on: { click: () => UC.chantier(app, sel, null) } }, 'Voir le chantier')),
    contracts);
  const path = h('div.cpath', { 'aria-label': 'Chapitres de la campagne' }, S.chapters.map(c => {
    const cls = (c.done ? '.done' : '') + (c.n === S.current && !c.done ? '.cur' : '') + (c.unlocked ? '' : '.lock') + (c.n === sel ? '.sel' : '');
    return h('button.cnode' + cls, { disabled: !c.unlocked, 'data-ch': c.n, title: c.unlocked ? c.ch.title : 'Réussis l’examen du chapitre ' + (c.n - 1) + ' pour l’ouvrir', on: { click: () => { app.campSel = c.n; redraw(); } } },
      h('span.cnn', c.done ? '✓' : c.unlocked ? String(c.n) : '🔒'), h('span.cnt', c.ch.title), h('small', c.done ? 'Terminé' : c.unlocked ? Math.min(c.validated, c.need) + ' / ' + c.need : 'Verrouillé'));
  }));
  return h('div', S.finished ? h('div.cfin', h('b', 'Campagne terminée.'), ' Toute l’infrastructure est sous ta responsabilité. Reste l’astreinte, le ticket du jour, et les pannes que tu n’as pas encore croisées.') : null, card, h('div.cpatht', 'Le parcours'), path);
};
UC.dutyPane = function (app, parts, prof) {
  let timed = app._dutyTimed === true;
  const box = h('div');
  const draw = () => {
    UI.clear(box);
    const go = lv => app.begin({ level: lv, mode: timed ? 'timed' : 'free', seed: randomSeed() });
    box.append(parts.daily(), UI.challenge ? UI.challenge.cards(app, draw) : '',
      h('p.muted.cintro', 'Plusieurs pannes dans le même ticket, dans toute l’infrastructure.'),
      /* le choix du mode est au-dessus des incidents qu'il concerne, sous la même forme que « Accompagné / Autonome » de la campagne */
      h('div.cmode.cdutymode', { role: 'group', 'aria-label': 'Mode des incidents' }, [[false, 'Libre'], [true, 'Chronométré, sans indice']].map(x => h('button.cmodeb' + (timed === x[0] ? '.on' : ''), { 'data-timed': String(x[0]), 'aria-pressed': String(timed === x[0]), on: { click: () => { timed = x[0]; app._dutyTimed = timed; draw(); } } }, h('b', x[1])))),
      h('div.cduty', [[3, 'Incident double', '2 pannes'], [4, 'Incident critique', '3 pannes, dont une subtile'], [5, 'Nuit noire', '4 pannes, parfois masquées entre elles']].map(x => { const open = SIM.rewards.dutyOpen(prof, x[0]); const need = (SIM.rewards.DUTY.find(d => d.level === x[0]) || {}).lv; return h('button.cdutyb' + (open ? '' : '.lock'), { 'data-level': x[0], disabled: !open, title: open ? '' : 'S’ouvre au niveau ' + need, on: { click: () => go(x[0]) } }, h('b', (open ? '' : '🔒 ') + x[1]), h('small', x[2]), h('span.muted', open ? 'Cible ≈ ' + Math.round(Game.levelPar(x[0]) / 60) + ' min' : 'S’ouvre au niveau ' + need)); })),
      UC.contractsFold(app, prof, '') || '');
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
  /* Une question à la fois, comme un quiz : un clic sur une réponse passe à la suivante ; « ◂ Précédente » permet de corriger.
     Le bouton « Fermer le ticket » s'active quand tout est répondu. */
  const m = run.m; const ans = {}; const DK = '?'; const Q = spec.questions; let cur = 0;
  const submit = h('button.btn.primary.fgo', { disabled: true, on: { click: () => { ov.remove(); const a = {}; Object.keys(ans).forEach(k => { if (ans[k] !== DK) a[k] = ans[k]; }); run.finalize(a); } } }, 'Fermer le ticket ▸');
  const back = h('button.flink', { type: 'button', on: { click: () => { if (cur > 0) { cur--; show(); } } } }, '◂ Précédente');
  const dots = h('div.fdots', { 'aria-hidden': 'true' });
  const step = h('span.fstep');
  const boxes = Q.map((q, qi) => {
    const box = h('div.fq', { 'data-q': q.id }, h('div.fql', q.label), h('div.fqh', q.help));
    const opts = q.options.concat([{ id: DK, text: 'Je ne sais pas', dk: true }]).map(o => {
      const b = h('button.fopt' + (o.dk ? '.dk' : ''), { 'data-o': o.id, 'aria-pressed': 'false', on: { click: () => {
        ans[q.id] = o.id; box.querySelectorAll('.fopt').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
        if (qi < Q.length - 1) cur = qi + 1; show(); if (Object.keys(ans).length === Q.length) submit.focus();
      } } }, h('span.fob'), h('span', o.text));
      return b;
    });
    box.append(h('div.fopts', opts)); return box;
  });
  const show = () => {
    boxes.forEach((b, i) => b.classList.toggle('cur', i === cur));
    UI.clear(dots); Q.forEach((q, i) => dots.append(h('i' + (i === cur ? '.on' : '') + (ans[q.id] ? '.done' : ''))));
    step.textContent = 'Question ' + (cur + 1) + ' / ' + Q.length;
    back.style.visibility = cur > 0 ? 'visible' : 'hidden';
    const n = Q.length - Object.keys(ans).length; submit.disabled = n > 0;
    submit.textContent = n > 0 ? 'Encore ' + n + ' réponse' + (n > 1 ? 's' : '') : 'Fermer le ticket ▸';
  };
  const rule = m.mode.hintsFree ? 'Mode accompagné : aucun point en jeu.' : 'Cause fausse −' + SIM.report.CAUSE_COST + ' · correction fausse −' + SIM.report.FIX_COST + ' · jamais sous ' + Game.PASS;
  const ov = h('div.overlay.frep', h('div.modal.fmodal', { role: 'dialog', 'aria-label': 'Fiche d’intervention' },
    h('div.fhead', UI.rewards.stamp(), h('span.tag.ok', '✓ Dépanné'), h('span.muted', UI.fmtDur(m.result.mttrSec)), h('span.grow'), step, dots),
    h('h2', 'Qu’as-tu trouvé ?'),
    boxes,
    h('div.ffoot', back, h('span.frule', rule), h('div.actions', submit))));
  document.body.appendChild(ov); show();
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
