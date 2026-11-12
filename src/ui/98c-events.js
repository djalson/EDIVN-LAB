/* ============================================================================
   Événements en cours de partie, côté interface (moteur : src/engine/87-events.js).
   - Le panneau « Messages » (colonne de gauche) reçoit tout ce qui arrive pendant le ticket : rappel du demandeur, deuxième ticket,
     collègue qui « a aidé », échéance du responsable. Il est toujours affiché, pour que sa présence ne trahisse rien.
   - Le téléphone (rappel, panne bête) ouvre une fenêtre : on décroche.
   Rien de cela en mode d'origine, pendant le tutoriel, ni pendant les trois premiers tickets d'un profil.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, h = UI.h; const P = UI.App.prototype;
const UE = UI.events = {};
const mmss = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ' min ' + (t % 60 < 10 ? '0' : '') + (t % 60) + ' s'; };
const who = from => String(from || '').replace(/\s*\(.*$/, '');
UE.COLLEAGUE = 'Sacha (support, ton collègue)';

const begin0 = P.begin;
P.begin = function (opts) {
  if (opts && !this.legacy && !opts.tour && opts.events === undefined && !g.SIM_NO_EVENTS && ((Game.profile().history || []).length >= 3 || opts.eventType)) { opts = Object.assign({}, opts, { events: true }); arguments[0] = opts; }
  const res = begin0.apply(this, arguments); const app = this, run = this.run;
  if (!run || this.legacy || (opts && opts.tour)) return res;
  const side = this.root.querySelector('.side'); if (!side) return res;
  const list = h('div.msglist', h('div.muted.msgempty', 'Aucun message.')); const badge = h('span.msgn');
  side.append(h('div.card.msgs', h('h3', 'Messages', badge), list));
  let n = 0; const post = (icon, from, body, extra) => { const e = list.querySelector('.msgempty'); if (e) e.remove(); n++; badge.textContent = ' ' + n; const el = h('div.msg.new', h('div.msgh', UI.icon(icon, 15), h('b', from)), h('div.msgb', body), extra || null); list.prepend(el); setTimeout(() => el.classList.remove('new'), 4000); return el; };
  const must = inst => h('div.msgmust', h('b', 'À régler pour clôturer. '), SIM.report.closeText(inst));
  let bossEl = null;
  const fire = () => {
    const m = run.m; const e = m.fireEvent(); if (!e) return; const inst = e.inst; const tk = inst && inst.ticket;
    if (e.type === 'boss') {
      const cd = h('b.msgcd', ''); bossEl = post('clock', 'Ton responsable', '« La direction attend ce service. Il me faut ce ticket clôturé avant la fin du compte à rebours. »', h('div.msgmust', 'Échéance : ', cd, h('span.muted', ' · raté : −' + SIM.events.BOSS_COST + ' sur la note')));
      bossEl._cd = cd; UI.toast('Message de ton responsable', 'warn'); return;
    }
    if (e.type === 'second') { post('mail', tk.from, [h('div.msgsub', tk.subject), tk.body], must(inst)); UI.toast('Nouveau ticket : ' + who(tk.from), 'warn'); return; }
    if (e.type === 'colleague') { const dev = SIM.events.deviceOf(inst); post('users', UE.COLLEAGUE, '« J’ai vu passer ton ticket, j’ai voulu avancer de mon côté sur ' + dev + '. Dis-moi si ça a aidé ! »', h('div.msgmust', h('b', 'À régler pour clôturer. '), 'Retrouve ce qui a été modifié sur ' + dev + ' et remets-le en état.')); UI.toast('Message de ton collègue', 'warn'); return; }
    if (e.type === 'call_extra') {
      post('user', tk.from, [h('div.msgsub', tk.subject), tk.body], must(inst));
      UI.modal('Le téléphone sonne', h('div.evcall', h('p.evfrom', UI.icon('user', 18), ' ', h('b', tk.from)), h('p', '« Pendant que je vous ai… j’ai un autre souci. ' + tk.body.replace(/^Bonjour,?\s*/i, '') + ' »'), h('p.muted', 'Ce deuxième problème s’ajoute au ticket : il faut le régler aussi pour clôturer.')), [{ label: 'Je m’en occupe', primary: true }]);
      return;
    }
    if (e.type === 'call_quiz') {
      run.m.pause(); const box = h('div.evquiz'); const fin = (ok, txt) => { run.m.resume(); post('user', tk.from, [h('div.msgsub', tk.subject), ok ? 'Réglé au téléphone.' : 'Ta consigne n’a rien donné.'], ok ? h('div.msgok', 'Réglé') : must(inst)); };
      const ov = UI.modal('Le téléphone sonne', h('div.evcall', h('p.evfrom', UI.icon('user', 18), ' ', h('b', tk.from)), h('p', '« ' + tk.body + ' »'), h('p', h('b', 'Que lui dis-tu de faire ?')), box, h('p.muted', 'La bonne consigne règle le problème au téléphone. Sinon, il faudra aller le réparer avant de clôturer.')), []);
      e.quiz.options.forEach(o => box.append(h('button.evopt', { 'data-opt': o.id, on: { click: () => { const r = run.m.answerQuiz(o.id); if (!r) return; UI.clear(box); box.append(h('div.evres.' + (r.ok ? 'ok' : 'ko'), r.ok ? '✓ « Ah oui, ça remarche, merci ! » Problème réglé au téléphone.' : '✗ « Non, ça ne change rien… » Le problème s’ajoute à ton ticket.'), h('button.btn.primary.evclose', { on: { click: () => ov.close() } }, 'Raccrocher')); fin(r.ok); } } }, o.text)));
      const bx = ov.el.querySelector('.actions'); if (bx) bx.remove();
      return;
    }
  };
  run.on('clock', () => {
    if (run.ended) return; const m = run.m;
    if (m.eventDue() && !document.querySelector('.overlay')) fire();
    if (bossEl && bossEl._cd) { const e = m.event; const left = e.deadline - m.elapsedSec(); bossEl._cd.textContent = left > 0 ? mmss(left) : 'dépassée'; bossEl.classList.toggle('late', left <= 0); }
  });
  return res;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
