/* Récompenses de niveau : piste, contrats (XP seulement), outils coupés en évaluation et en examen, second avis, cosmétiques, prestige, profils hostiles. */
'use strict';
const SIM = require('./load.js')(); const G = SIM.game, F = SIM.fault, P = SIM.prog, RW = SIM.rewards, C = SIM.camp;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
let now = 0; const clock = () => now;
const solve = (m, secs) => { m.parts.forEach(p => { F.runSteps(m.W, p.fix || p.fixes[Object.keys(p.fixes)[0]], { inst: p }); m.act({ kind: 'ui', dev: 'x', text: 'c', mutates: true }); }); now += (secs || 5) * 1000;
  m.parts.forEach(p => { const v = (p.verify && p.verify.length) ? p.verify : F.defaultVerify(p); m.W.observe(v[0].replace(/\*/g, 'test'), true); }); m.act({ kind: 'cmd', dev: 'PC-ADM', text: 't' }); };
const at = lv => { const p = G.cleanProfile(null); p.xp = P.cum(lv); return p; };
const mk = (p, o) => { now = 0; return G.create(Object.assign({ clock, profile: p, mode: 'free', level: 2, seed: 'rw', faultId: 'dns_svc' }, o)); };
const fiche = m => { const a = {}; m.reportSpec().questions.forEach(q => { a[q.id] = q.answer; }); m.fileReport(a); };

/* --- piste --- */
ok(RW.TRACK.every((r, i) => !i || RW.TRACK[i - 1].lv <= r.lv) && new Set(RW.TRACK.map(r => r.id)).size === RW.TRACK.length, 'piste triée, identifiants uniques (' + RW.TRACK.length + ' récompenses)');
const lvls = new Set(RW.TRACK.map(r => r.lv)); let gap = 0, prev = 1; Array.from(lvls).sort((a, b) => a - b).forEach(l => { gap = Math.max(gap, l - prev); prev = l; });
ok(gap <= 5 && Math.max.apply(null, Array.from(lvls)) === 40 && Math.min.apply(null, Array.from(lvls)) === 2, 'une récompense au moins tous les 5 niveaux, du niveau 2 au niveau 40 (écart maximal ' + gap + ')');
ok(RW.TRACK.filter(r => r.lv > 18).length >= 8, 'la piste continue après le niveau 18, là où l’arbre est épuisé (' + RW.TRACK.filter(r => r.lv > 18).length + ')');
ok(!RW.has(at(1), 'second') && RW.has(at(7), 'second') && !RW.has(at(4), 'tool:leds') && RW.has(at(5), 'tool:leds'), 'acquis au niveau exact');
ok(RW.between(4, 5).some(r => r.id === 'tool:leds') && RW.between(5, 5).length === 0, 'récompenses entre deux niveaux');
ok(RW.next(at(1)).lv === 2 && RW.next(at(40)) === null, 'prochaine récompense');
Object.keys(RW.COS).forEach(s => ok(RW.COS[s][0].id === 'default' && !RW.COS[s][0].lv && !RW.COS[s][0].ch, 'famille ' + s + ' : le premier est celui d’origine, toujours acquis'));
Object.keys(RW.THEMES).forEach(id => ok(P.themeOwned(at(RW.THEMES[id]), id) && !P.themeOwned(at(RW.THEMES[id] - 1), id), 'thème de prestige ' + id + ' au niveau ' + RW.THEMES[id]));

/* --- contrats : validation --- */
ok(RW.validContracts(at(1), ['nohelp', 'vague'], {}).length === 0, 'niveau 1 : aucun contrat');
ok(RW.validContracts(at(8), ['vague', 'nohelp', 'fast', 'bidon'], {}).join() === 'nohelp,vague', 'niveau 8 : seulement les contrats acquis, ordre canonique');
ok(RW.validContracts(at(20), ['nohelp'], { guided: true }).length === 0 && RW.validContracts(at(20), ['nohelp'], { exam: true }).length === 0 && RW.validContracts(at(20), ['nohelp'], { tour: true }).length === 0, 'aucun contrat en accompagné, en examen, en tutoriel');
ok(RW.validContracts(at(40), ['allin'], {}).length === 0, '« Tout ou rien » réservé au prestige');
ok(RW.validContracts(at(20), 'nohelp', {}).length === 0 && RW.validContracts(at(20), null, {}).length === 0, 'entrée non conforme ignorée');

/* --- contrats : la note ne bouge pas, l'XP oui --- */
{ const p0 = at(20), p1 = at(20); const a = mk(p0), b = mk(p1, { contracts: ['nohelp', 'vague', 'nomap'] }); solve(a); solve(b); fiche(a); fiche(b);
  ok(a.contracts.length === 0 && b.contracts.join() === 'nohelp,vague,nomap', 'contrats portés par la mission');
  ok(a.result.note === b.result.note && a.result.note === 100, 'même note avec ou sans contrat');
  const ra = G.record(a, p0), rb = G.record(b, p1); const f = 1.10 * 1.15 * 1.20;
  ok(rb.prog.mult.filter(x => /Contrat/.test(x.label)).length === 3 && Math.abs(rb.prog.xpTicket / ra.prog.xpTicket - f) < 0.02, 'XP × ' + f.toFixed(3) + ' (mesuré ' + (rb.prog.xpTicket / ra.prog.xpTicket).toFixed(3) + ')'); }
/* temps réduit : cible raccourcie d'un quart */
{ const p = at(20); const a = mk(p), b = mk(p, { contracts: ['fast'] }); ok(b.parSec === Math.round(a.parSec * 0.75), 'temps réduit : cible ' + a.parSec + ' s → ' + b.parSec + ' s');
  solve(b, Math.round(a.parSec * 0.9)); ok(b.result.score.time < 0, 'la pénalité de durée tombe avant l’ancienne cible'); }
/* ticket non validé : pas de multiplicateur */
{ const p = at(20); const m = mk(p, { contracts: ['nohelp'] }); m.giveUp(); const r = G.record(m, p); ok(!r.prog.mult.some(x => /Contrat/.test(x.label)), 'ticket non validé : aucun bonus de contrat'); }
/* accompagné et examen : contrats retirés à la création */
{ const p = at(20); ok(mk(p, { mode: 'guided', contracts: ['nohelp'] }).contracts.length === 0, 'mode accompagné : contrats retirés');
  const ex = C.exam(p, 1, 'x'); ok(G.create(Object.assign({ clock, profile: p, contracts: ['nohelp'] }, ex)).contracts.length === 0, 'examen : contrats retirés'); }
/* tout ou rien */
{ const p = at(5); p.prestige = 1; let m = mk(p, { contracts: ['allin'] }); solve(m); fiche(m); let r = G.record(m, p);
  ok(m.result.note === 100 && r.prog.mult.some(x => /Tout ou rien/.test(x.label) && x.f === 1.5), 'tout ou rien : 100 → × 1,5');
  const q = at(5); q.prestige = 1; m = mk(q, { contracts: ['allin'] }); m.hint(); m.hint(); solve(m); fiche(m); r = G.record(m, q);
  ok(m.result.passed && m.result.note < 90 && r.prog.xpTicket === 0, 'tout ou rien : ' + m.result.note + ' validé mais sous 90 → 0 XP'); }

/* --- outils : coupés en évaluation chronométrée et en examen --- */
{ const p = at(20); ok(RW.toolOn(p, 'leds', mk(p)) && RW.toolOn(p, 'qping', mk(p)) && RW.toolOn(p, 'hist', mk(p)), 'outils actifs en jeu libre');
  ok(!RW.toolOn(p, 'leds', mk(p, { mode: 'timed' })), 'outils coupés en chronométré');
  const ex = C.exam(p, 1, 'x'); ok(!RW.toolOn(p, 'leds', G.create(Object.assign({ clock, profile: p }, ex))), 'outils coupés en examen');
  ok(!RW.toolOn(at(4), 'leds', mk(at(4))), 'outil non acquis'); }

/* --- second avis --- */
{ const p = at(7); const m = mk(p); ok(RW.secondReady(p, m, '2026-11-10'), 'second avis disponible');
  const r = m.hint(undefined, { free: true }); RW.useSecond(p, '2026-11-10');
  ok(r.free && r.cost === 0 && m.hintLog[0].free && !RW.secondReady(p, m, '2026-11-10') && RW.secondReady(p, m, '2026-11-11'), 'utilisé : plus aujourd’hui, de nouveau demain');
  const r2 = m.hint(); ok(r2.cost === G.HINT_COST[1], 'l’indice suivant est payant, au tarif du deuxième');
  solve(m); ok(m.result.score.hints === -G.HINT_COST[1], 'note : seul l’indice payant est compté (' + m.result.score.hints + ')');
  ok(!RW.secondReady(at(6), mk(at(6))), 'non acquis avant le niveau 7');
  ok(!RW.secondReady(p, mk(p, { mode: 'timed' }), '2030-01-01') && !RW.secondReady(p, mk(p, { mode: 'guided' }), '2030-01-01'), 'pas en chronométré, inutile en accompagné'); }

/* --- astreinte --- */
ok(!RW.dutyOpen(at(9), 3) && RW.dutyOpen(at(10), 3) && !RW.dutyOpen(at(19), 4) && RW.dutyOpen(at(20), 4) && !RW.dutyOpen(at(29), 5) && RW.dutyOpen(at(30), 5), 'astreinte : paliers 10, 20, 30');

/* --- cosmétiques --- */
{ const p = at(6); ok(RW.setCos(p, 'map', 'blueprint') && RW.cosOf(p, 'map') === 'blueprint', 'habillage acquis appliqué');
  ok(!RW.setCos(p, 'map', 'night') && RW.cosOf(p, 'map') === 'blueprint' && !RW.setCos(p, 'map', 'inconnu'), 'habillage non acquis ou inconnu refusé');
  p.cos.wall = 'summit'; ok(RW.cosOf(p, 'wall') === 'default', 'valeur forcée non acquise → celle d’origine');
  ok(!RW.cosOwned(p, 'frame', 'bronze') && RW.bestFrame(p) === null, 'insigne : pas sans chapitre terminé');
  p.camp.exams = { 1: 80, 2: 80, 3: 80 }; ok(RW.cosOwned(p, 'frame', 'bronze') && !RW.cosOwned(p, 'frame', 'silver') && RW.bestFrame(p).id === 'bronze', 'insigne de bronze au chapitre 3 terminé'); }

/* --- prestige --- */
{ const p = at(39); ok(!RW.canPrestige(p) && !RW.doPrestige(p), 'pas de prestige avant le niveau 40');
  const q = at(40); q.tree = { notes: true }; q.camp.exams = { 1: 90 }; q.badges = ['x']; q.cos = { map: 'night' };
  ok(RW.doPrestige(q) && q.xp === 0 && q.prestige === 1 && P.levelOf(q.xp).level === 1, 'prestige : niveau 1, une étoile');
  ok(RW.level(q) === 40 && RW.has(q, 'tool:hist') && RW.cosOf(q, 'map') === 'night' && P.themeOwned(q, 'boreal') && RW.dutyOpen(q, 5), 'tout reste acquis après le prestige');
  ok(q.camp.exams[1] === 90 && q.badges.length === 1 && Object.keys(q.tree).length === 0, 'campagne et succès gardés, arbre rendu');
  ok(RW.contractOwned(q, 'allin') && RW.validContracts(q, ['allin'], {}).join() === 'allin', 'contrat « Tout ou rien » ouvert'); }

/* --- profils hostiles --- */
{ const e = G.cleanProfile({ v: 2, cos: { wall: 'summit', term: '<script>', map: 7, frame: 'gold', autre: 'x' }, prestige: 1e9, second: 'demain' });
  ok(e.cos.wall === 'summit' && e.cos.term === undefined && e.cos.map === undefined && e.cos.autre === undefined, 'cosmétiques : seules les valeurs connues survivent');
  ok(RW.cosOf(e, 'wall') === 'summit' && RW.prestige(e) === 99 && e.second === '', 'prestige borné, date nettoyée (un prestige déclaré ouvre les cosmétiques : pas de note en jeu)');
  const z = G.cleanProfile({ v: 2, cos: 'x', prestige: -3 }); ok(Object.keys(z.cos).length === 0 && z.prestige === 0, 'valeurs illisibles → défaut'); }

console.log(n + ' contrôles, ' + bad + ' échec' + (bad > 1 ? 's' : ''));
process.exit(bad ? 1 : 0);
