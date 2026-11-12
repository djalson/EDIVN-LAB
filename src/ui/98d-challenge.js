/* ============================================================================
   Défi entre élèves et panne mystère (onglet Astreinte).
   - Défi : un code court (niveau + mode + graine) à envoyer à un collègue. Même code = même incident, même date, mêmes événements.
     À la fin, le débrief propose de copier le résultat (note et temps) pour comparer.
   - Panne mystère : une par jour, la même pour tout le monde, niveau caché, XP ×2, un seul essai.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, PG = SIM.prog, h = UI.h; const P = UI.App.prototype;
const CH = UI.challenge = {};
const ML = { free: 'L', guided: 'G', timed: 'C' }; const LM = { L: 'free', G: 'guided', C: 'timed' };
CH.codeOf = m => m.lv.level + ML[m.mode.id] + '-' + m.seed;
CH.parse = function (txt) { const x = /([1-5])([LGC])-([A-Za-z0-9_.-]{3,40})/i.exec(String(txt || '').trim()); return x ? { level: +x[1], mode: LM[x[2].toUpperCase()], seed: x[3] } : null; };
CH.play = function (app, code) { const c = CH.parse(code); if (!c) return false; app.begin({ level: c.level, mode: c.mode, seed: c.seed, challenge: true, shared: true, events: true }); return true; };
CH.resultText = function (m) { const r = m.result || {}; const t = r.mttrSec || 0; return 'Défi EDIVN Lab — code ' + CH.codeOf(m) + ' — ' + (r.kind === 'resolved' ? 'ma note : ' + r.note + '/100 en ' + Math.floor(t / 60) + ' min ' + (t % 60 < 10 ? '0' : '') + (t % 60) + ' s' : 'pas résolu') + '. À toi ! (Accueil → Astreinte → Défi d’un collègue)'; };
/* panne mystère du jour */
CH.mystery = function () { const d = PG.today(); const seed = 'mystere-' + d; return { date: d, seed, level: 1 + parseInt(SIM.U.hash8('mys|' + d).slice(0, 4), 16) % 3, tried: Game.store.get('mystery') === d }; };
CH.playMystery = function (app) { const my = CH.mystery(); if (my.tried) return false; Game.store.set('mystery', my.date); app.begin({ level: my.level, mode: 'free', seed: my.seed, mystery: true, shared: true, events: true }); return true; };

/* cartes de l'onglet Astreinte */
CH.cards = function (app, redraw) {
  const my = CH.mystery(); const inp = h('input.txt.chin', { placeholder: 'Code reçu, ex. 2L-k3f9x2', 'aria-label': 'Code de défi reçu' }); const err = h('span.cherr');
  const go = () => { if (!CH.play(app, inp.value)) { err.textContent = 'Code non reconnu.'; } };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  return h('div.chrow',
    h('div.chcard.mys' + (my.tried ? '.done' : ''), h('div.chic', '?'), h('div.grow', h('b', 'Panne mystère'), h('div.muted', my.tried ? 'Déjà tentée aujourd’hui. Une nouvelle demain.' : 'Niveau caché · la même pour tous · XP ×2 · un seul essai par jour')),
      h('button.btn' + (my.tried ? '' : '.primary'), { 'data-act': 'mystery', disabled: my.tried, on: { click: () => UI.modal('Panne mystère', h('p', 'Un seul essai aujourd’hui : si tu quittes ou abandonnes, c’est terminé jusqu’à demain. On y va ?'), [{ label: 'Plus tard' }, { label: 'J’y vais', primary: true, fn: () => CH.playMystery(app) }]) } }, my.tried ? 'Tentée' : 'Tenter')),
    h('div.chcard', h('div.chic', '⚔'), h('div.grow', h('b', 'Défi d’un collègue'), h('div.muted', 'Même code, même incident : comparez vos notes.'), h('div.chline', inp, h('button.btn', { 'data-act': 'challenge', on: { click: go } }, 'Jouer'), err))));
};
/* la pastille de niveau ne trahit pas la panne mystère */
const begin0 = P.begin;
P.begin = function (opts) { const res = begin0.apply(this, arguments); if (opts && opts.mystery && this.run) this.root.querySelectorAll('.gbar .pill').forEach(el => { if (/^Niveau/.test(el.textContent)) el.textContent = 'Panne mystère'; }); return res; };
/* débrief : bouton pour défier un collègue (ou renvoyer son résultat) */
if (UI.simple && UI.simple.debrief) { const d0 = UI.simple.debrief; UI.simple.debrief = function (app, m) {
  const el = d0.apply(this, arguments); const box = el.querySelector && el.querySelector('.dhact2');
  if (box && !m.camp && !m.mystery && !m.daily) box.append(h('button.btn.dchal', { title: 'Copie un code : ton collègue jouera exactement le même incident', on: { click: () => UI.copyText(CH.resultText(m), 'Défi') } }, m.challenge ? 'Copier mon résultat' : 'Défier un collègue'));
  return el; }; }
})(typeof globalThis !== 'undefined' ? globalThis : window);
