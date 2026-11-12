/* ============================================================================
   Événements en cours de partie : environ un ticket sur quatre réserve une surprise, tirée par la graine (même graine = même événement).
   Jamais en évaluation chronométrée, en examen de chapitre, pendant le tutoriel ni en mode d'origine.

   - call_extra : le demandeur rappelle, il a un deuxième problème → une panne de plus, à réparer pour clôturer.
   - second     : un autre utilisateur ouvre un ticket pendant le premier → une panne de plus, à réparer pour clôturer.
   - colleague  : un collègue « a voulu aider » et a touché à un équipement → une panne de plus, il dit seulement où il est passé.
   - call_quiz  : une panne « bête » (écran éteint, câble débranché) signalée par téléphone. Un QCM : la bonne consigne la règle au téléphone,
                  une mauvaise oblige à aller la réparer pour clôturer.
   - boss       : le responsable veut le ticket réglé avant une échéance. Raté : −5 sur la note.

   La panne ajoutée est choisie pour être compatible avec le ticket en cours : l'assemblage est rejoué dans un monde neuf avant d'être retenu
   (les deux pannes actives ensemble, la réparation de l'une ne répare pas l'autre, chacune réparable). Aucune dépendance au DOM.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, F = SIM.fault, Game = SIM.game, M = Game.Mission.prototype;
const EV = SIM.events = {};
EV.RATE = 0.25; EV.TYPES = ['call_extra', 'second', 'colleague', 'call_quiz', 'boss'];
EV.DUMB = ['phys_screen', 'phys_mon', 'phys_source', 'phys_eth', 'phys_power'];
EV.EXTRA_PAR = 300; EV.BOSS_COST = 5; EV.MIN_AT = 50; EV.SPAN = 110;
const fresh = p => Object.assign({}, p, { rt: { okSince: null, okVer: null, status: 'active', reasons: [] } });
const fixOf = i => i.fix || (i.fixes && i.fixes[Object.keys(i.fixes)[0]]) || [];
const hostsOf = i => (i.probes || []).map(p => p.from || p.host || p.client).filter(Boolean);
const devOf = i => { for (const st of (i.inject || [])) { const d = st.dev || (typeof st.path === 'string' ? st.path.split(/[.\/:]/)[0] : null); if (d) return d; } return hostsOf(i)[0] || null; };
EV.deviceOf = devOf;

/* l'assemblage [pannes du ticket + panne ajoutée] tient-il debout ? rejoué dans un monde neuf, à la même date */
EV.compatible = function (m, cand) {
  const W = SIM.buildHealthyWorld({ seed: m.seed }); if (m.W.calendar && SIM.calendar) SIM.calendar.apply(W, m.W.calendar); const base = W.sem();
  const mains = m.parts.map(fresh); const c = fresh(cand);
  if (!F.evaluate(W, c, base).probes.every(p => p.ok)) return false;                       /* la panne ajoutée part d'un état sain */
  mains.forEach(p => F.runSteps(W, p.inject, { inst: p }));
  if (!F.evaluate(W, c, base).probes.every(p => p.ok)) return false;                       /* le ticket en cours ne la déclenche pas déjà */
  const before = mains.map(p => F.evaluate(W, p, base).status);
  F.runSteps(W, c.inject, { inst: c });
  if (F.evaluate(W, c, base).status !== 'active') return false;
  if (mains.some((p, i) => F.evaluate(W, p, base).status !== before[i] || before[i] !== 'active')) return false;
  mains.forEach(p => F.runSteps(W, fixOf(p), { inst: p }));
  if (mains.some(p => !F.evaluate(W, p, base).allOk)) return false;                        /* le ticket reste réparable malgré la panne ajoutée */
  if (F.evaluate(W, c, base).allOk) return false;                                          /* … et sa réparation ne règle pas l'autre */
  F.runSteps(W, fixOf(c), { inst: c }); const rt = F.evaluate(W, c, base);
  return rt.allOk && rt.rootsFixed && mains.every(p => F.evaluate(W, p, base).allOk);
};
/* candidats d'un type d'événement, dans l'ordre tiré par la graine */
EV.candidates = function (m, type, rng) {
  const C = SIM.camp; const ids = m.parts.map(p => p.id); const doms = m.parts.map(p => F.domainOf(p.id)); const mainFrom = String((m.fault.ticket || {}).from || '');
  const mainHosts = []; m.parts.forEach(p => hostsOf(p).forEach(h => { if (mainHosts.indexOf(h) < 0) mainHosts.push(h); }));
  let pool = SIM.faults.filter(d => ids.indexOf(d.id) < 0 && !/^multi_/.test(d.id) && !(SIM.isRetiredFault && SIM.isRetiredFault(d.id)) && !(SIM.isUnproven && SIM.isUnproven(d.id)) && !d.needsReboot
    && (m.camp && C ? C.faultChapter(d) <= m.camp.ch : d.level <= Math.max(2, m.lv.level)));
  pool = type === 'call_quiz' ? pool.filter(d => EV.DUMB.indexOf(d.id.replace(/_(bdx|rv)$/, '')) >= 0) : pool.filter(d => d.level <= 2 && !/^phys_/.test(d.id) && doms.indexOf(F.domainOf(d.id)) < 0);
  const out = [];
  rng.shuffle(pool).forEach(d => { const combos = rng.shuffle(F.variantCombos(d, 6)); for (const combo of combos) {
    const i = F.instantiate(d, m.seed + '|event', combo); const hs = hostsOf(i); const from = String(i.ticket.from || '');
    if ((i.probes || []).some(p => p.t === 'login') || (i.verify || []).some(v => /^use:/.test(v)) && type !== 'call_quiz') continue;
    if (m.camp && C && C.devsOf(i).some(dv => C.devChapter(dv) > m.camp.ch)) continue;
    if (type === 'call_extra' && from !== mainFrom) continue;
    if (type === 'second' && (from === mainFrom || /^(Supervision|Admin)/.test(from))) continue;
    if (type === 'call_quiz' && (from === mainFrom || hs.some(h => mainHosts.indexOf(h) >= 0))) continue;
    if (type === 'colleague' && (!devOf(i) || /^PC-/.test(devOf(i)))) continue;
    out.push(i); break; } });
  return out;
};
/* le plan d'une mission : null (le cas le plus fréquent) ou { type, at, inst?, … } */
EV.plan = function (m, o) {
  if (!o || !o.events || m.mode.timed || (m.camp && m.camp.exam) || !SIM.buildHealthyWorld) return null;
  const rng = U.rng('events|' + m.seed); const roll = rng.next(); const rate = o.eventRate === undefined ? EV.RATE : o.eventRate;
  if (!o.eventType && roll >= rate) return null;
  const order = o.eventType ? [o.eventType] : rng.shuffle(EV.TYPES);
  for (const type of order) {
    const at = EV.MIN_AT + rng.int(EV.SPAN);
    if (type === 'boss') return { type, at: Math.max(30, at - 20), fired: false, done: false };
    let n = 0; for (const cand of EV.candidates(m, type, rng)) { if (++n > 8) break; let ok = false; try { ok = EV.compatible(m, cand); } catch (e) { ok = false; } if (ok) return { type, at, inst: cand, fired: false, done: false }; }
  }
  return null;
};

/* ------------------------------------------------------------------ mission */
const create0 = Game.create;
Game.create = function (o) { const m = create0.apply(this, arguments); m.extras = []; m.event = null; try { m.event = EV.plan(m, o || {}); } catch (e) { m.event = null; } return m; };
/* l'événement prévu est-il dû ? (appelé par l'interface à chaque battement d'horloge) */
M.eventDue = function () { const e = this.event; return e && !e.fired && this.state === 'running' && this.elapsedSec() >= e.at ? e : null; };
const addPart = (m, inst) => { m.extras.push(inst); m.parts = m.parts.concat([inst]); m.parSec += EV.EXTRA_PAR; if (m.deadlineSec !== null && m.deadlineSec !== undefined) m.deadlineSec += EV.EXTRA_PAR; m.prog = m._progress(); m.prevSem = m.W.sem(); };
/* déclenche l'événement : injecte la panne ajoutée dans le monde en cours, ou arme l'échéance du responsable */
M.fireEvent = function () {
  const e = this.eventDue(); if (!e) return null; e.fired = true; e.firedAt = Math.round(this.elapsedSec());
  if (e.type === 'boss') { e.deadline = e.firedAt + Math.max(240, Math.round(0.4 * this.parSec)); this.trace.push({ t: e.firedAt, kind: 'event', text: 'Événement : le responsable fixe une échéance', cls: 'diagnostic' }); return e; }
  F.runSteps(this.W, e.inst.inject, { inst: e.inst }); this.W.touch('event');
  if (e.type === 'call_quiz') {
    const near = SIM.report.neighbours(e.inst, this.parts.map(p => p.id).concat([e.inst.id]), this.seed).filter(n => /^phys_/.test(n.id));
    const rng = U.rng('quiz|' + this.seed); const good = String(e.inst.solution); const seen = [good]; const wrong = [];
    near.concat(SIM.report.neighbours(e.inst, [], this.seed)).forEach(n => { const t = String(n.solution || ''); if (t && seen.indexOf(t) < 0 && wrong.length < 3) { seen.push(t); wrong.push(t); } });
    const opts = rng.shuffle([{ text: good, good: true }].concat(wrong.map(t => ({ text: t })))).map((x, i) => ({ id: 'q' + (i + 1), text: x.text, good: !!x.good }));
    e.quiz = { options: opts.map(x => ({ id: x.id, text: x.text })), answer: opts.find(x => x.good).id };
    this.trace.push({ t: e.firedAt, kind: 'event', text: 'Événement : appel de ' + e.inst.ticket.from, cls: 'diagnostic' }); return e;
  }
  addPart(this, e.inst); e.done = true;
  this.trace.push({ t: e.firedAt, kind: 'event', text: 'Événement : ' + (e.type === 'colleague' ? 'un collègue est intervenu sur ' + devOf(e.inst) : e.type === 'second' ? 'deuxième ticket, de ' + e.inst.ticket.from : 'le demandeur rappelle'), cls: 'diagnostic' });
  return e;
};
/* réponse au QCM du téléphone : juste → la consigne règle la panne ; faux → elle reste à réparer sur place */
M.answerQuiz = function (optId) {
  const e = this.event; if (!e || e.type !== 'call_quiz' || !e.fired || e.done || this.state !== 'running') return null;
  e.done = true; e.chosen = optId; e.quizOk = optId === e.quiz.answer;
  if (e.quizOk) { F.runSteps(this.W, fixOf(e.inst), { inst: e.inst }); this.W.touch('event'); this.prevSem = this.W.sem(); this.prog = this._progress(); }
  else addPart(this, e.inst);
  this.trace.push({ t: Math.round(this.elapsedSec()), kind: 'event', text: e.quizOk ? 'Panne réglée au téléphone' : 'Mauvaise consigne au téléphone : panne à réparer sur place', cls: e.quizOk ? 'progress' : 'detour' });
  return { ok: e.quizOk, answer: e.quiz.answer };
};
/* statut : les pannes ajoutées comptent comme les autres */
const status0 = M.status;
M.status = function () {
  const st = status0.call(this); if (!this.extras || !this.extras.length) return st;
  const parts = st.parts.concat(this.extras.map(x => ({ id: x.id, rt: F.evaluate(this.W, x, this.base) }))); const s = parts.map(p => p.rt.status);
  const status = s.every(x => x === 'resolved') ? 'resolved' : s.some(x => x === 'active') ? 'active' : s.some(x => x === 'workaround') ? 'workaround' : 'fixed';
  return Object.assign({}, st, { status, parts, solved: parts.filter(p => p.rt.allOk).length, total: parts.length });
};
/* note : l'échéance du responsable */
const finish0 = M._finish;
M._finish = function (kind, st) {
  finish0.call(this, kind, st); const e = this.event, r = this.result; if (!e || !r) return;
  r.event = { type: e.type, fired: !!e.fired };
  if (e.fired && e.type === 'boss') {
    e.bossOk = kind === 'resolved' && this.endSec <= e.deadline; r.event.bossOk = e.bossOk;
    if (!e.bossOk && kind === 'resolved') { const pen = Math.min(EV.BOSS_COST, Math.max(0, r.note)); r.score.event = -pen; r.note = r.total = r.note - pen; r.passed = r.note >= Game.PASS; r.stars = r.passed ? Game.starsOf(r.note) : 0; r.perfect = false; r.tier = Game.tierOf(r.note); }
  }
  if (e.fired && e.type === 'call_quiz') r.event.quizOk = !!e.quizOk;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
