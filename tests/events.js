/* Événements en cours de partie (src/engine/87-events.js). */
const SIM = require('./load.js')(); const F = SIM.fault, Game = SIM.game, EV = SIM.events;
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const fixOf = i => i.fix || i.fixes[Object.keys(i.fixes)[0]];
let now = 0; const mk = (o) => Game.create(Object.assign({ level: 1, mode: 'free', clock: () => now, profile: Game.blankProfile ? Game.blankProfile() : undefined }, o));
/* 1. fréquence et déterminisme */
{ let n = 0, by = {}; const N = 240; for (let i = 0; i < N; i++) { const m = mk({ seed: 'fq' + i, events: true }); if (m.event) { n++; by[m.event.type] = (by[m.event.type] || 0) + 1; } }
  ok(n / N > 0.15 && n / N < 0.35, 'environ un ticket sur quatre a un événement (' + n + ' / ' + N + ') ' + JSON.stringify(by));
  ok(Object.keys(by).length >= 4, 'au moins quatre types d’événements sortent');
  const a = mk({ seed: 'fq7', events: true }), b = mk({ seed: 'fq7', events: true }); ok(JSON.stringify(a.event && [a.event.type, a.event.at, a.event.inst && a.event.inst.id]) === JSON.stringify(b.event && [b.event.type, b.event.at, b.event.inst && b.event.inst.id]), 'même graine → même événement'); }
ok(!mk({ seed: 'x1', eventType: 'second' }).event, 'sans l’option events : jamais d’événement (tests et mode d’origine inchangés)');
ok(!mk({ seed: 'x1', events: true, eventType: 'second', mode: 'timed' }).event, 'évaluation chronométrée : jamais d’événement');
/* 2. panne ajoutée : obligatoire, réparable, sur un large échantillon de tickets */
const mains = ['dns_cache', 'iis_stopped', 'dhcp_svc', 'ipv4_dns', 'phys_eth', 'sh_perm_share', 'ad_locked', 'dhcp_gw_empty', 'fw_icmp', 'gpo_drive'].filter(id => SIM.faults.some(f => f.id === id));
let tried = 0, good = 0; const bad = [];
for (const type of ['call_extra', 'second', 'colleague']) for (const id of mains) for (const sd of ['a', 'b']) {
  now = 0; const m = mk({ seed: 'ev-' + sd + id, faultId: id, level: 2, events: true, eventType: type }); if (!m.event) continue; tried++;
  const tag = type + ' ' + id + ' + ' + m.event.inst.id; const par0 = m.parSec;
  now = (m.event.at - 1) * 1000; if (m.eventDue()) { bad.push(tag + ' : dû trop tôt'); continue; }
  now = (m.event.at + 1) * 1000; const e = m.fireEvent(); if (!e || m.parts.length !== 2 || m.parSec !== par0 + EV.EXTRA_PAR) { bad.push(tag + ' : déclenchement'); continue; }
  let st = m.status(); if (st.total !== 2 || st.status !== 'active') { bad.push(tag + ' : statut après déclenchement ' + st.status); continue; }
  F.runSteps(m.W, fixOf(m.parts[0]), { inst: m.parts[0] }); m.W.touch('t'); st = m.status(); if (st.solved !== 1) { bad.push(tag + ' : après réparation du ticket, résolues = ' + st.solved); continue; }
  const c = m.close(); if (c.ok) { bad.push(tag + ' : clôture acceptée sans la panne ajoutée'); continue; }
  F.runSteps(m.W, fixOf(m.extras[0]), { inst: m.extras[0] }); m.W.touch('t'); st = m.status(); if (st.solved !== 2) { bad.push(tag + ' : panne ajoutée non réparée par sa correction'); continue; }
  if (m.debrief().fault.parts.length !== 2) { bad.push(tag + ' : débrief'); continue; }
  good++;
}
ok(tried >= 30, tried + ' assemblages ticket + panne ajoutée essayés'); ok(!bad.length, good + ' / ' + tried + ' : panne ajoutée active, obligatoire pour clôturer, réparable'); bad.slice(0, 12).forEach(x => console.log('    ' + x));
/* 3. panne bête au téléphone */
{ now = 0; const m = mk({ seed: 'qz1', faultId: 'dns_cache', events: true, eventType: 'call_quiz' }); ok(m.event && m.event.type === 'call_quiz', 'panne bête : ' + (m.event && m.event.inst.id));
  now = (m.event.at + 1) * 1000; const e = m.fireEvent(); ok(e.quiz.options.length >= 3 && m.parts.length === 1, 'QCM de ' + e.quiz.options.length + ' consignes ; la panne n’est pas encore au ticket');
  const r = m.answerQuiz(e.quiz.answer); ok(r.ok && m.parts.length === 1 && F.evaluate(m.W, Object.assign({}, e.inst, { rt: { okSince: null, okVer: null, status: 'active', reasons: [] } }), m.base).probes.every(p => p.ok), 'bonne consigne : panne réglée au téléphone, rien à ajouter');
  now = 0; const m2 = mk({ seed: 'qz1', faultId: 'dns_cache', events: true, eventType: 'call_quiz' }); now = (m2.event.at + 1) * 1000; const e2 = m2.fireEvent(); const wrong = e2.quiz.options.find(o => o.id !== e2.quiz.answer).id;
  const r2 = m2.answerQuiz(wrong); ok(!r2.ok && m2.parts.length === 2 && m2.status().total === 2, 'mauvaise consigne : la panne s’ajoute au ticket'); }
/* 4. le responsable */
{ now = 0; const m = mk({ seed: 'bs1', faultId: 'dns_cache', events: true, eventType: 'boss' }); now = (m.event.at + 1) * 1000; const e = m.fireEvent(); ok(e.deadline > e.firedAt + 200, 'échéance du responsable : ' + (e.deadline - e.firedAt) + ' s');
  now = (e.deadline + 30) * 1000; F.runSteps(m.W, fixOf(m.parts[0]), { inst: m.parts[0] }); m.W.touch('t'); m.W.observe('share:PC-01:x', true); m.check(); if (m.state === 'running') m._finish('resolved', m.status());
  ok(m.result.score.event === -EV.BOSS_COST && m.result.event.bossOk === false, 'échéance manquée : −' + EV.BOSS_COST + ' sur la note (' + m.result.note + ')');
  now = 0; const m2 = mk({ seed: 'bs1', faultId: 'dns_cache', events: true, eventType: 'boss' }); now = (m2.event.at + 1) * 1000; m2.fireEvent(); now += 20000; F.runSteps(m2.W, fixOf(m2.parts[0]), { inst: m2.parts[0] }); m2.W.touch('t'); m2._finish('resolved', m2.status());
  ok(!m2.result.score.event && m2.result.event.bossOk === true, 'échéance tenue : note intacte (' + m2.result.note + ')'); }
console.log(fails ? '✗ ' + fails + ' échec(s)' : 'OK'); process.exit(fails ? 1 : 0);
