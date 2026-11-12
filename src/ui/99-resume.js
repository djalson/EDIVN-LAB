/* ============================================================================
   Ticket interrompu : un rechargement de page (F5, onglet fermé par erreur) ne fait plus perdre la partie en silence.
   - Pendant une partie, le navigateur demande confirmation avant de quitter la page.
   - Les paramètres du ticket (graine, panne, mode, chapitre) et le temps écoulé sont gardés ; au retour, l'accueil propose de le reprendre.
   L'état des machines n'est pas sauvegardé (le monde simulé ne se sérialise pas) : le ticket repart de son état initial, avec le chronomètre
   où il en était. C'est dit au joueur. Rien de cela en mode d'origine (#legacy) ni pendant le tutoriel.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, h = UI.h; const P = UI.App.prototype;
const KEY = 'pending'; const MAX_AGE = 24 * 3600 * 1000;
const RS = UI.resume = {};
RS.clear = () => { try { Game.store.set(KEY, null); } catch (e) { /* rien */ } };
RS.get = () => { try { const p = Game.store.get(KEY); return p && p.opts && (Date.now() - p.at) < MAX_AGE ? p : null; } catch (e) { return null; } };
const plain = o => { try { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' || k === 'profile') ? undefined : v)); } catch (e) { return null; } };
const save = app => { const run = app.run; if (!run || run.ended || !app._pendingOpts) return; try { Game.store.set(KEY, { opts: app._pendingOpts, at: Date.now(), elapsed: Math.round(run.m.elapsedSec()), id: run.id, subject: (run.m.fault.ticket || {}).subject || '' }); } catch (e) { /* rien */ } };

const begin0 = P.begin;
P.begin = function (opts) {
  /* date et heure du ticket : un jour ouvré de plus à chaque ticket joué, heure de bureau tirée par la graine ; la nuit pour un incident d'astreinte lourd.
     Ticket du jour et code de défi : la date ne dépend que de la graine, pour que tous les joueurs aient le même monde. */
  if (opts && !this.legacy && !opts.tour && !opts.calendar && opts.seed && SIM.calendar) {
    const shared = opts.daily || opts.challenge; const n = shared ? parseInt(SIM.U.hash8('cal|' + opts.seed).slice(0, 4), 16) % 40 : ((Game.profile().history || []).length + 1);
    opts = Object.assign({}, opts, { calendar: SIM.calendar.make(n, opts.seed, { night: !opts.camp && +opts.level >= 4 }) }); arguments[0] = opts;
  }
  const res = begin0.apply(this, arguments); const app = this; const run = this.run;
  clearInterval(app._pendingTimer); app._pendingOpts = null;
  if (!run || this.legacy || (opts && opts.tour)) return res;
  if (opts && opts.resumeElapsed > 0) { run.m.startMs -= opts.resumeElapsed * 1000; }
  const o = plain(opts || {}); if (!o) return res; delete o.resumeElapsed; app._pendingOpts = o;
  save(app); app._pendingTimer = setInterval(() => { if (app.run !== run || run.ended) { clearInterval(app._pendingTimer); return; } save(app); }, 10000);
  if (run.on) run.on('end', () => { clearInterval(app._pendingTimer); RS.clear(); });
  return res;
};
const home0 = P.home;
P.home = function () {
  const leaving = !!this.run; if (leaving) { clearInterval(this._pendingTimer); this._pendingOpts = null; RS.clear(); }
  const res = home0.apply(this, arguments);
  if (!this._resumeAsked && !this.legacy) { this._resumeAsked = true; const p = RS.get(); if (p) RS.offer(this, p); }
  return res;
};
RS.offer = function (app, p) {
  const mm = Math.floor(p.elapsed / 60), ss = p.elapsed % 60;
  UI.modal('Ticket interrompu', h('div.rsbox', h('p', h('b', p.id || 'Ticket'), p.subject ? ' — « ' + p.subject + ' »' : ''), h('p', 'La page a été fermée ou rechargée pendant ce ticket. Tu peux le reprendre : les machines repartent de leur état de départ, le chronomètre reprend à ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss + '.')),
    [{ label: 'Laisser tomber', fn: () => RS.clear() }, { label: 'Reprendre le ticket', primary: true, fn: () => app.begin(Object.assign({}, p.opts, { resumeElapsed: p.elapsed })) }]);
};
/* quitter la page pendant une partie : confirmation du navigateur, et dernier enregistrement du temps */
if (g.addEventListener) g.addEventListener('beforeunload', e => { const app = g.SIM_APP; if (!app || app.legacy || !app.run || app.run.ended || !app._pendingOpts) return; save(app); if (!g.SIM_NO_UNLOAD_PROMPT) { e.preventDefault(); e.returnValue = ''; } });
})(typeof globalThis !== 'undefined' ? globalThis : window);
