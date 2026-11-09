/* ============================================================================
   Exécution d'une partie : relie la mission (src/engine/80-game.js), le monde simulé, l'environnement
   des émulateurs (trace de toutes les actions) et l'interface. Une partie = un ticket.
   - toute action du joueur (commande, clic dans une console graphique, geste physique) passe par env.act()
   - l'horloge simulée avance avec le temps réel (1 s = 1 s, par pas de 5 s) : journaux et délais vivants
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, Game = SIM.game;

const TICK_SEC = 5;
function Run(opts) {
  this.opts = opts; this.listeners = {};
  this.m = Game.create({ level: opts.level, mode: opts.mode, seed: opts.seed, skill: opts.skill, faultId: opts.faultId, parts: opts.parts, chain: opts.chain, daily: opts.daily, profile: opts.profile, camp: opts.camp, bundle: opts.bundle, clock: () => Date.now() });
  /* campagne : périmètre affiché (équipements et sites du chapitre) ; null = toute l'infrastructure (bac à sable) */
  this.scope = SIM.camp ? SIM.camp.missionScope(this.m) : null;
  this.W = this.m.W; this.surfaces = {}; this.ended = false; this.ticks = 0;
  this.id = 'INC-' + U.hash8('ticket|' + this.m.seed).slice(0, 6).toUpperCase();
  const self = this;
  this.env = new E.Env(this.W, { act: e => self.onAct(e) });
  this.W.onChange(() => self.emit('world'));
  this.tickTimer = setInterval(() => self.tick(), TICK_SEC * 1000);
  this.clockTimer = setInterval(() => self.emit('clock'), 500);
}
UI.Run = Run;
const P = Run.prototype;
P.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
P.off = function (ev, fn) { const l = this.listeners[ev]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
P.emit = function (ev, a, b) { (this.listeners[ev] || []).forEach(f => { try { f(a, b); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }); };

/* Action du joueur (appelée par env.act depuis les émulateurs et par l'UI graphique) */
P.onAct = function (e) {
  if (this.ended) return null;
  const r = this.m.act(e);
  this.emit('act', e, r);
  if (r && r.dangers && r.dangers.length && this.m.mode.id === 'guided') r.dangers.forEach(d => UI.toast('⚠ Action risquée : ' + d.label + '. ' + d.why, 'warn', 9000));
  if (r && r.ended) this.finish();
  return r;
};
/* Action graphique : kind 'ui' ; mutates renseigné par l'appelant */
P.act = function (dev, text, opts) { opts = opts || {}; return this.env.act(Object.assign({ kind: 'ui', dev, text, mutates: !!opts.mutates }, opts)); };
/* Réévalue l'état (observation « use: », clic de vérification…) */
P.check = function () { if (this.ended) return; const st = this.m.check(); if (this.m.state !== 'running') this.finish(); return st; };
P.observe = function (key, ok) { this.W.observe(key, ok); this.check(); };

P.tick = function () {
  if (this.ended || document.hidden) return;
  this.ticks++; SIM.sched.advance(this.W, TICK_SEC);
  this.W.touch('tick'); this.check();
};
/* Fin de partie. Ticket résolu : la fiche d'intervention est demandée AVANT l'enregistrement (elle entre dans la note) ;
   l'interface répond par finalize(réponses). Sans fiche (abandon, temps écoulé, opts.report === false) : enregistrement direct. */
P.finish = function () {
  if (this.ended) return; this.ended = true; clearInterval(this.tickTimer); clearInterval(this.clockTimer);
  const spec = this.opts.report === false ? null : this.m.reportSpec();
  if (spec && (this.listeners.report || []).length) { this.emit('report', this.m, spec); return; }
  this.finalize();
};
P.finalize = function (answers) {
  if (this.record) return;
  if (answers) this.m.fileReport(answers);
  const rec = Game.record(this.m); this.record = rec; this.emit('end', this.m, rec);
};
P.stop = function () { this.ended = true; clearInterval(this.tickTimer); clearInterval(this.clockTimer); Object.keys(this.surfaces).forEach(k => { try { this.surfaces[k].destroy && this.surfaces[k].destroy(); } catch (e) { /* surface déjà détruite */ } }); };

/* Surface d'un appareil : écran / console / panneau (créée à la demande, conservée tant que la partie dure) */
P.surface = function (devId) {
  if (this.surfaces[devId]) return this.surfaces[devId];
  const d = this.W.d(devId); let s;
  if (d.kind === 'win' && UI.WinSurface) s = new UI.WinSurface(this, devId);
  else if (UI.ConsoleSurface) s = new UI.ConsoleSurface(this, devId);
  else s = new UI.TextSurface(this, devId);
  this.surfaces[devId] = s; return s;
};
P.mttr = function () { return this.m.elapsedSec(); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
