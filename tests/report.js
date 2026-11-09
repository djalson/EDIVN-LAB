/* Fiche d'intervention : questions générées pour chaque panne du catalogue, barème, plancher au seuil de validation, mode guidé, déterminisme. */
'use strict';
const SIM = require('./load.js')(); const G = SIM.game, F = SIM.fault, R = SIM.report;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
let now = 0; const clock = () => now;
const solve = m => {
  m.parts.forEach(p => { F.runSteps(m.W, p.fix || p.fixes[Object.keys(p.fixes)[0]], { inst: p }); now += 5000; m.act({ kind: 'ui', dev: 'x', text: 'correction ' + p.id, mutates: true }); });
  m.parts.forEach(p => { const pats = ((p.verify && p.verify.length) ? p.verify : F.defaultVerify(p)); m.W.observe(pats[0].replace(/\*/g, 'test'), true); });
  m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'test client' });
};
const mk = (o) => { now = 0; return G.create(Object.assign({ clock, profile: G.cleanProfile(null), mode: 'free', level: 1, seed: 'r1' }, o)); };
const answers = (m, wrongKinds) => { const a = {}; m.reportSpec().questions.forEach(q => { a[q.id] = (wrongKinds || []).indexOf(q.kind) >= 0 ? q.options.find(o => o.id !== q.answer).id : q.answer; }); return a; };

/* --- toutes les pannes : une fiche bien formée --- */
let weak = 0;
SIM.faults.forEach(d => {
  const m = mk({ faultId: d.id, level: Math.min(4, d.level) }); solve(m);
  if (m.state !== 'done' || m.result.kind !== 'resolved') { ok(false, d.id + ' : non résolue par la correction de test'); return; }
  const sp = m.reportSpec(); const qs = sp.questions;
  ok(qs.length === 2 && qs[0].kind === 'cause' && qs[1].kind === 'fix', d.id + ' : deux questions (cause, correction)');
  qs.forEach(q => {
    const texts = q.options.map(o => o.text.toLowerCase().replace(/\s+/g, ' ').trim());
    ok(q.options.length === R.CHOICES, d.id + ' / ' + q.kind + ' : ' + q.options.length + ' propositions');
    ok(new Set(texts).size === texts.length, d.id + ' / ' + q.kind + ' : propositions toutes différentes');
    ok(q.options.filter(o => o.id === q.answer).length === 1 && q.options.find(o => o.id === q.answer).text === (q.kind === 'cause' ? m.fault.cause : m.fault.solution), d.id + ' / ' + q.kind + ' : la bonne réponse est celle de la panne');
    ok(q.options.every(o => o.text && !/\{\{/.test(o.text)), d.id + ' / ' + q.kind + ' : aucun gabarit non substitué');
    ok(!('good' in q.options[0]), d.id + ' : la réponse n’est pas dans les propositions envoyées à l’interface');
  });
});

/* --- déterminisme et ordre --- */
{ const a = mk({ faultId: 'dns_svc', level: 2 }), b = mk({ faultId: 'dns_svc', level: 2 }); solve(a); solve(b);
  ok(JSON.stringify(a.reportSpec()) === JSON.stringify(b.reportSpec()), 'même graine → même fiche');
  const pos = new Set(); for (let i = 0; i < 12; i++) { const m = mk({ faultId: 'dns_svc', level: 2, seed: 'p' + i }); solve(m); const q = m.reportSpec().questions[0]; pos.add(q.options.findIndex(o => o.id === q.answer)); }
  ok(pos.size >= 3, 'la bonne réponse change de place selon la graine (' + pos.size + ' positions)'); }

/* --- barème --- */
{ let m = mk({ faultId: 'dns_svc', level: 2 }); solve(m); const before = m.result.note; let rp = m.fileReport(answers(m));
  ok(before === 100 && rp.allOk && rp.penalty === 0 && m.result.note === 100 && m.result.perfect, 'fiche juste : note inchangée, Parfait conservé');
  ok(m.fileReport({}) === rp && m.result.note === 100, 'second dépôt ignoré');
  m = mk({ faultId: 'dns_svc', level: 2 }); solve(m); rp = m.fileReport(answers(m, ['cause']));
  ok(rp.penalty === R.CAUSE_COST && m.result.note === 90 && m.result.score.report === -10 && !m.result.perfect && m.result.stars === 2 && m.result.passed && !rp.causeOk && rp.fixOk, 'cause fausse : −10, deux étoiles');
  m = mk({ faultId: 'dns_svc', level: 2 }); solve(m); rp = m.fileReport(answers(m, ['fix']));
  ok(rp.penalty === R.FIX_COST && m.result.note === 95 && rp.causeOk && !rp.fixOk, 'correction fausse : −5');
  m = mk({ faultId: 'dns_svc', level: 2 }); solve(m); rp = m.fileReport({});
  ok(rp.penalty === 15 && m.result.note === 85 && rp.rows.every(x => x.chosen === null && !x.ok), 'fiche vide : −15');
  /* mode guidé : la fiche est corrigée, jamais notée */
  m = mk({ faultId: 'dns_svc', level: 2, mode: 'guided' }); solve(m); rp = m.fileReport({});
  ok(rp.penalty === 0 && rp.guided && m.result.note === 100 && !m.result.perfect && !rp.causeOk, 'guidé : aucune pénalité, mais pas de Parfait sans la cause');
  /* plancher : la fiche ne fait pas échouer un ticket réparé */
  m = mk({ faultId: 'dns_svc', level: 2 }); m.hint(); m.hint(); solve(m); const b2 = m.result.note; rp = m.fileReport({});
  ok(b2 === 77 && m.result.note === G.PASS && rp.penalty === 2 && m.result.passed && m.result.stars === 1, 'plancher au seuil : 77 → 75, toujours validé');
  /* ticket déjà sous le seuil : la fiche n'enlève rien */
  m = mk({ faultId: 'dns_svc', level: 2 }); m.hint(); m.hint(); m.hint(); solve(m); const b3 = m.result.note; rp = m.fileReport({});
  ok(b3 < G.PASS && m.result.note === b3 && rp.penalty === 0, 'sous le seuil : note inchangée');
  /* non résolu : pas de fiche */
  m = mk({ faultId: 'dns_svc', level: 2 }); m.giveUp(); ok(m.reportSpec() === null && m.fileReport({}) === null && !m.result.report, 'abandon : pas de fiche');
  /* en cours : pas de fiche */
  m = mk({ faultId: 'dns_svc', level: 2 }); ok(m.reportSpec.call(Object.assign(Object.create(Object.getPrototypeOf(m)), m, { _report: undefined })) === null, 'mission en cours : pas de fiche'); }

/* --- pannes multiples : une question de cause par panne, plafond --- */
{ const m = mk({ level: 'cyber', seed: 'multi1' }); solve(m); const qs = m.reportSpec().questions;
  ok(qs.length === m.parts.length && qs.every(q => q.kind === 'cause'), 'ticket à ' + m.parts.length + ' pannes : ' + qs.length + ' questions de cause');
  const all = new Set(); qs.forEach(q => q.options.forEach(o => { if (o.id !== q.answer) all.add(o.text); }));
  ok(m.parts.every(pt => !all.has(pt.cause)), 'la cause d’une autre panne du ticket n’est jamais proposée comme mauvaise réponse');
  const rp = m.fileReport({}); ok(rp.penalty === Math.min(R.CAUSE_CAP, m.result.score.report * -1) && rp.penalty <= R.CAUSE_CAP, 'plafond de pénalité (' + rp.penalty + ')'); }

/* --- XP : la fiche juste rapporte un bonus, jamais de note --- */
{ const p = G.cleanProfile(null); const m = mk({ faultId: 'dns_svc', level: 2, profile: p }); solve(m); m.fileReport(answers(m)); const rec = G.record(m, p);
  ok(rec.prog.parts.some(x => /Fiche d’intervention juste/.test(x.label)), 'bonus d’XP d’une fiche juste');
  const p2 = G.cleanProfile(null); const m2 = mk({ faultId: 'dns_svc', level: 2, profile: p2 }); solve(m2); m2.fileReport(answers(m2, ['cause'])); const rec2 = G.record(m2, p2);
  ok(!rec2.prog.parts.some(x => /Fiche/.test(x.label)), 'pas de bonus pour une fiche fausse'); }

console.log(n + ' contrôles, ' + bad + ' échec' + (bad > 1 ? 's' : '') + (weak ? ' (' + weak + ' fiches à surveiller)' : ''));
process.exit(bad ? 1 : 0);
