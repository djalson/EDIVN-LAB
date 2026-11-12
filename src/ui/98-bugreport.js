/* ============================================================================
   « Signaler un bug » : un rapport prêt à coller, en un clic, pendant une partie.
   Partie lisible : version, ticket, mode, temps, journal des actions, remarque du joueur.
   Partie technique : graine, pannes et variantes, état des sondes, dernières observations — encodée (base64) pour ne pas
   afficher la cause de la panne au joueur qui signale un problème en cours de partie.
   Rien n'est envoyé : le rapport est copié dans le presse-papiers, le joueur le colle où il veut.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h;
SIM.VERSION = 'V3 · 2026-11-12';
const BR = UI.bugreport = {};
const b64 = s => { try { return g.btoa(unescape(encodeURIComponent(s))); } catch (e) { return ''; } };
BR.decode = s => JSON.parse(decodeURIComponent(escape(g.atob(String(s).replace(/\s+/g, '')))));
const mmss = t => { t = Math.max(0, Math.round(t || 0)); return (t < 600 ? '0' : '') + Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); };
BR.data = function (run) {
  const m = run.m, W = run.W; let st = null; try { st = m.status(); } catch (e) { st = { status: 'erreur : ' + e.message, parts: [] }; }
  return {
    v: SIM.VERSION, ticket: run.id, seed: m.seed, mode: m.mode && (m.mode.id || m.mode.label), level: m.lv && m.lv.level, camp: m.camp ? { ch: m.camp.ch, exam: !!m.camp.exam, review: !!m.camp.review } : null,
    faults: m.parts.map(p => ({ id: p.id, vars: Object.keys(p.vars || {}).reduce((o, k) => { const v = p.vars[k]; o[k] = v && (v.key || v.sam || v.host || v.id) || (typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : v); return o; }, {}) })),
    state: m.state, status: st.status, parts: (st.parts || []).map(p => ({ id: p.id, status: p.rt && p.rt.status, roots: p.rt && p.rt.rootsFixed, verified: p.rt && p.rt.verified, probes: ((p.rt && p.rt.probes) || []).map(x => [x.t, x.ok ? 1 : 0, String(x.why || '').slice(0, 90)]) })),
    elapsed: Math.round(m.elapsedSec()), simElapsed: Math.round(W.clock.elapsed), hints: m.hintsUsed, wrongCloses: m.wrongCloses,
    obs: (W.obs || []).slice(-25).map(o => [o.key, o.ok ? 1 : 0, Math.round(o.t)]),
    sessions: Object.keys(W.dev).filter(id => W.dev[id]._rt && W.dev[id]._rt.session).map(id => id + '=' + W.dev[id]._rt.session.user),
    ua: (g.navigator && g.navigator.userAgent || '').slice(0, 120), win: g.innerWidth + 'x' + g.innerHeight
  };
};
BR.text = function (run, comment) {
  const m = run.m; const d = BR.data(run); const tk = m.fault.ticket || {};
  const lines = ['=== Rapport de bug EDIVN Lab ===', 'Version : ' + d.v, 'Ticket : ' + d.ticket + ' — « ' + (tk.subject || '') + ' » (' + (tk.from || '') + ')',
    'Mode : ' + (m.mode && m.mode.label) + (d.camp ? ' · chapitre ' + d.camp.ch + (d.camp.exam ? ' (examen)' : d.camp.review ? ' (révision)' : '') : ' · niveau ' + (m.lv && m.lv.label)), 'Temps : ' + mmss(d.elapsed) + ' · indices : ' + d.hints, '',
    'Ce qui cloche :', (comment || '').trim() || '(non précisé)', '', 'Journal des actions (les plus récentes en bas) :'];
  m.trace.slice(-40).forEach(e => lines.push('  ' + mmss(e.t) + '  ' + (e.dev ? e.dev + '  ' : '') + String(e.text || '').slice(0, 140) + (e.cls && e.cls !== 'diagnostic' ? '  [' + e.cls + ']' : '')));
  if (!m.trace.length) lines.push('  (aucune action)');
  lines.push('', 'Données techniques (ne pas modifier) :', (b64(JSON.stringify(d)).match(/.{1,100}/g) || []).join('\n'), '=== fin du rapport ===');
  return lines.join('\n');
};
BR.modal = function (run) {
  const ta = h('textarea.brta', { rows: 4, placeholder: 'Décris en une phrase ce qui te semble faux (facultatif) : « le ticket s’est clôturé tout seul », « impossible d’ouvrir tel fichier »…' });
  const body = h('div.brbox', h('p', 'Le rapport contient ce ticket, tes actions et l’état du jeu. Colle-le à la personne qui corrige le simulateur.'), ta, h('p.muted', 'Rien n’est envoyé sur Internet : le rapport est seulement copié.'));
  UI.modal('Signaler un bug', body, [{ label: 'Annuler' }, { label: 'Copier le rapport', primary: true, fn: () => UI.copyText(BR.text(run, ta.value), 'Rapport') }]);
  setTimeout(() => ta.focus(), 30);
};
BR.button = run => h('button.btn.small.gbug', { title: 'Copier un rapport de bug (ticket, actions, état du jeu)', on: { click: () => BR.modal(run) } }, 'Bug ?');
})(typeof globalThis !== 'undefined' ? globalThis : window);
