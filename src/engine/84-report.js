/* ============================================================================
   Fiche d'intervention : ce que le technicien remplit avant de fermer un ticket résolu.
   Le jeu sait déjà noter la MANIÈRE (indices, actions dangereuses, coupures inutiles, clôtures prématurées).
   La fiche note la COMPRÉHENSION : quelle était la cause racine, et quelle correction la traite durablement.
   Aucune dépendance au DOM : testable sous Node (tests/report.js).

   - Les questions sont générées depuis le catalogue : la bonne réponse est la cause (ou la correction) de la panne
     jouée ; les autres sont celles de pannes voisines (mêmes compétences, mêmes équipements), donc crédibles.
   - Barème : cause mal identifiée −10 par panne (plafond −20), correction mal identifiée −5. Rien en mode guidé.
     La fiche ne fait JAMAIS échouer un ticket réparé : elle ne peut pas faire passer une note validée sous le seuil.
     Elle départage les étoiles, et un « Parfait » exige une fiche juste.
   - Une cause mal identifiée renvoie la panne en révision (src/engine/83-campaign.js) et ne compte pas pour la maîtrise.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, F = SIM.fault, Game = SIM.game;
const R = SIM.report = {};
R.CAUSE_COST = 10; R.CAUSE_CAP = 20; R.FIX_COST = 5;
R.CHOICES = 4;

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
/* pannes voisines d'une panne instanciée, de la plus proche à la plus lointaine */
R.neighbours = function (inst, excludeIds, seed) {
  const C = SIM.camp; const mine = (inst.skills || []).filter(s => s !== 'diag'); const devs = C ? C.devsOf(inst) : [];
  const myCh = C ? C.faultChapter(inst.def || inst) : 0;
  const rows = [];
  SIM.faults.forEach(d => {
    if (excludeIds.indexOf(d.id) >= 0 || d.id === inst.id) return;
    if (/^multi_/.test(d.id) && !/^multi_/.test(inst.id)) return;   /* une chaîne « trois causes cumulées » se repère au premier coup d'œil */
    /* variante de la voisine qui parle des mêmes machines que la panne jouée : sinon la bonne réponse se repère au nom du poste du ticket */
    let i = F.instantiate(d, seed + '|' + d.id), dv = C ? C.devsOf(i).filter(x => devs.indexOf(x) >= 0).length : 0;
    if (C && d.vary) F.variantCombos(d, 12).forEach(c => { const j = F.instantiate(d, seed + '|' + d.id, c); const n = C.devsOf(j).filter(x => devs.indexOf(x) >= 0).length; if (n > dv) { i = j; dv = n; } });
    const shared = (d.skills || []).filter(s => mine.indexOf(s) >= 0).length;
    const ch = C ? C.faultChapter(d) : 0;
    rows.push({ inst: i, score: shared * 3 + dv * 2 + (ch === myCh ? 2 : ch < myCh ? 1 : -4) - Math.abs((d.level || 1) - (inst.level || 1)) * 0.5 });
  });
  rows.sort((a, b) => b.score - a.score || (a.inst.id < b.inst.id ? -1 : 1));
  return rows.map(r => r.inst);
};
/* Critère de clôture affiché dans le ticket (« Pour clôturer : … ») : celui que la panne déclare (verifyText), sinon le critère par défaut
   du moteur dit en clair — un test réussi depuis le poste du demandeur APRÈS la correction. Ne nomme ni la cause ni la commande. */
R.closeText = function (inst) {
  if (inst.verifyText) return inst.verifyText;
  const hosts = []; (inst.probes || []).forEach(p => { const h = p.from || p.host || p.client; if (h && hosts.indexOf(h) < 0) hosts.push(h); });
  if (inst.verify && inst.verify.length) return 'Constate le retour à la normale sur l’équipement concerné.';
  if (hosts.length) return 'Refais depuis ' + hosts.join(' ou ') + ' ce qui échouait.';
  return 'Vérifie que ça remarche sur l’équipement concerné.';
};
/* une question : la bonne réponse + (CHOICES − 1) réponses de pannes voisines, textes tous différents, ordre tiré par la graine */
function question(id, label, help, inst, field, near, rng) {
  const good = String(inst[field] || ''); const seen = [norm(good)]; const wrong = [];
  /* on tire parmi les voisines les plus proches (pas toujours les trois mêmes d'un rejeu à l'autre) */
  const cand = near.slice(0, 9); const order = rng.shuffle(cand).concat(near.slice(9));
  for (const n of order) { const t = String(n[field] || ''); if (!t || seen.indexOf(norm(t)) >= 0) continue; seen.push(norm(t)); wrong.push({ text: t, from: n.id }); if (wrong.length >= R.CHOICES - 1) break; }
  const opts = rng.shuffle([{ text: good, good: true }].concat(wrong)).map((o, i) => ({ id: 'o' + (i + 1), text: o.text, good: !!o.good }));
  return { id, label, help, part: inst.id, kind: field === 'cause' ? 'cause' : 'fix', options: opts.map(o => ({ id: o.id, text: o.text })), answer: opts.find(o => o.good).id };
}
/* Les questions de la fiche d'une mission terminée et résolue ; null sinon (un ticket abandonné n'a pas de fiche : le débrief donne la cause). */
Game.Mission.prototype.reportSpec = function () {
  if (this._report !== undefined) return this._report;
  if (!this.result || this.result.kind !== 'resolved') return (this._report = null);
  const rng = U.rng('report|' + this.seed + '|' + this.fault.id); const ids = this.parts.map(p => p.id); const qs = [];
  const multi = this.parts.length > 1;
  this.parts.forEach((pt, i) => {
    const near = R.neighbours(pt, ids, this.seed);
    qs.push(question('cause' + i, multi ? 'Cause racine n° ' + (i + 1) : 'Quelle était la cause racine ?', multi ? 'Ce ticket cachait ' + this.parts.length + ' pannes. Laquelle de ces causes en faisait partie ?' : 'Ce qui était réellement cassé, pas le symptôme décrit par le demandeur.', pt, 'cause', near, rng));
    if (!multi) qs.push(question('fix' + i, 'Quelle correction traite cette cause durablement ?', 'La correction qui évite que la panne revienne, pas un contournement.', pt, 'solution', near, rng));
  });
  return (this._report = { questions: qs });
};
/* Dépôt de la fiche : answers = { idQuestion: idOption }. Ajuste la note de la mission (une seule fois). Sans appel, la note reste celle de la réparation. */
Game.Mission.prototype.fileReport = function (answers) {
  const spec = this.reportSpec(); const r = this.result;
  if (!spec || !r || r.report) return r && r.report || null;
  answers = answers || {};
  const rows = spec.questions.map(q => ({ id: q.id, kind: q.kind, part: q.part, label: q.label, chosen: answers[q.id] || null, answer: q.answer, ok: answers[q.id] === q.answer,
    chosenText: (q.options.find(o => o.id === answers[q.id]) || {}).text || null, answerText: q.options.find(o => o.id === q.answer).text }));
  const causeKo = rows.filter(x => x.kind === 'cause' && !x.ok).length, fixKo = rows.filter(x => x.kind === 'fix' && !x.ok).length;
  let pen = this.mode.hintsFree ? 0 : Math.min(R.CAUSE_CAP, causeKo * R.CAUSE_COST) + fixKo * R.FIX_COST;
  const before = r.note;
  /* la fiche ne fait pas échouer un ticket réparé */
  if (before >= Game.PASS) pen = Math.min(pen, before - Game.PASS); else pen = 0;
  r.score.report = -pen; r.note = r.total = Math.max(0, before - pen);
  r.passed = r.kind === 'resolved' && r.note >= Game.PASS; r.stars = r.passed ? Game.starsOf(r.note) : 0;
  r.perfect = r.kind === 'resolved' && r.note === 100 && !causeKo && !fixKo; r.tier = Game.tierOf(r.note);
  r.report = { rows, causeOk: causeKo === 0, fixOk: fixKo === 0, allOk: causeKo === 0 && fixKo === 0, penalty: pen, guided: !!this.mode.hintsFree };
  return r.report;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
