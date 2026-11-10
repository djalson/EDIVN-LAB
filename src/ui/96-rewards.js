/* ============================================================================
   Récompenses de niveau, côté interface : piste des récompenses, contrats, outils de diagnostic (voyants de liaison,
   ping rapide, historique entre tickets), second avis, cosmétiques (fonds d'écran, terminaux, carte, insignes), prestige.
   Moteur : src/engine/85-rewards.js. Styles : src/css/41-rewards.css.
   En mode d'origine (#legacy) rien de tout cela n'est actif : les tests antérieurs voient le jeu tel qu'il était.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, RW = SIM.rewards, P = SIM.prog, N = SIM.net, h = UI.h;
const UR = UI.rewards = { run: null, seed: {} };
const App = UI.App.prototype;
const legacy = () => /legacy/.test(String(g.location && g.location.hash));
const KIND_ICON = { contract: 'target', tool: 'network', duty: 'shield', perk: 'spark', cos: 'palette', theme: 'palette', prestige: 'medal' };
const icon = (n, s) => { try { return UI.icon(n, s); } catch (e) { return null; } };

/* ------------------------------------------------------------------ cosmétiques : attributs sur la racine, lus par la feuille de style */
UR.applyCos = function (prof) {
  if (typeof document === 'undefined') return; const root = document.documentElement; prof = prof || Game.profile();
  ['wall', 'term', 'map'].forEach(s => { const v = legacy() ? 'default' : RW.cosOf(prof, s); if (v === 'default') root.removeAttribute('data-' + s); else root.setAttribute('data-' + s, v); });
};

/* ------------------------------------------------------------------ contrats */
UR.contracts = function () { const v = Game.store.get('contracts'); const p = Game.profile(); return Array.isArray(v) ? v.filter(id => typeof id === 'string' && RW.contractOwned(p, id)) : []; };
UR.setContracts = ids => Game.store.set('contracts', ids);
/* sélecteur : note = ce qui rend les contrats inapplicables ici (mode accompagné) */
UR.contractPicker = function (app, o) {
  o = o || {}; const prof = Game.profile(); const box = h('div.rwc');
  const draw = () => {
    UI.clear(box); const on = UR.contracts(); const owned = RW.CONTRACTS.filter(c => RW.contractOwned(prof, c.id));
    const nextC = RW.CONTRACTS.filter(c => !c.prestige && !RW.contractOwned(prof, c.id))[0];
    const f = RW.contractFactor(on);
    box.append(h('div.rwch', h('b', 'Contrats'), h('span.muted', owned.length ? (o.off ? ' — ' + o.off : on.length ? ' — XP × ' + f.toFixed(2).replace('.', ',') + ' sur un ticket validé' : ' — des contraintes en échange d’XP. La note n’est jamais touchée.') : ' — premier contrat au niveau ' + (nextC ? nextC.lv : '?'))));
    if (owned.length) box.append(h('div.rwcl', owned.map(c => h('button.rwcb' + (on.indexOf(c.id) >= 0 ? '.on' : ''), { 'data-contract': c.id, disabled: !!o.off, title: c.desc, 'aria-pressed': on.indexOf(c.id) >= 0 ? 'true' : 'false', on: { click: () => { const cur = UR.contracts(); const i = cur.indexOf(c.id); if (i >= 0) cur.splice(i, 1); else cur.push(c.id); UR.setContracts(cur); draw(); if (o.onChange) o.onChange(UR.contracts()); } } }, h('b', c.label), h('small', '× ' + String(c.f).replace('.', ','))))));
    if (owned.length && nextC) box.append(h('div.muted.rwcn', 'Prochain contrat : « ' + nextC.label + ' » au niveau ' + nextC.lv + '.'));
  };
  draw(); return box;
};
UR.ticketBody = (m, body) => (m.contracts && m.contracts.indexOf('vague') >= 0 ? RW.VAGUE_BODY : body);
UR.has = (m, id) => !!(m && m.contracts && m.contracts.indexOf(id) >= 0);
UR.contractPills = m => (m.contracts || []).map(id => h('span.pill.rwpill', { title: RW.contract(id).desc }, 'Contrat ', h('b', RW.contract(id).label)));

/* ------------------------------------------------------------------ branchements sur la partie */
const begin = App.begin;
App.begin = function (opts) {
  opts = Object.assign({}, opts || {});
  if (!this.legacy && opts.contracts === undefined && !opts.tour) opts.contracts = UR.contracts();
  UR.applyCos();
  /* historique entre tickets : instantané pris au début de la partie */
  UR.seed = {}; try { const st = Game.store.get('cmdhist'); if (st && typeof st === 'object') Object.keys(st).slice(0, 8).forEach(k => { if (Array.isArray(st[k])) UR.seed[k] = st[k].filter(x => typeof x === 'string').slice(-40); }); } catch (e) { /* stockage indisponible */ }
  UR.run = null; const r = begin.call(this, opts); UR.run = this.run || null; return r;
};
const home = App.home;
App.home = function () { UR.run = null; UR.applyCos(); const r = home.apply(this, arguments); if (!this.legacy) UR.decorateHome(this); return r; };

/* outils actifs pour la partie en cours */
UR.toolOn = (id, run) => { run = run || UR.run; return !legacy() && !!run && !run.ended && RW.toolOn(Game.profile(), id, run.m); };
/* terminaux dont l'historique est conservé : jamais un écran d'ouverture de session */
UR.HIST_KINDS = ['cmd', 'bash', 'ios', 'pf', 'mysql'];

/* voyants de liaison : état réel du lien entre deux équipements de la carte (null : pas de câble direct connu) */
UR.linkState = function (W, a, b) {
  const A = W.dev[a]; if (!A) return null;
  for (const name of Object.keys(A.ifaces || {}).concat(Object.keys(A.ports || {}))) { const q = N.portObj(A, name); if (q && q.cable && typeof q.cable.to === 'string' && (q.cable.to.split(':')[0] === b || (/^PATCH/.test(b) && /^wall:/.test(q.cable.to)))) return !!q.cable.plugged && N.linkUp(W, A, name); }
  return null;
};
UR.paintLinks = function (run, lines) {
  if (!UR.toolOn('leds', run)) return;
  lines.forEach(x => { const st = UR.linkState(run.W, x.a, x.b); const s2 = st === null ? UR.linkState(run.W, x.b, x.a) : st; if (s2 === null) { x.el.style.stroke = ''; x.el.style.strokeDasharray = ''; return; } x.el.style.stroke = s2 ? '#22c55e' : '#ef4444'; x.el.style.strokeDasharray = s2 ? '' : '6 5'; x.el.setAttribute('data-link', s2 ? 'up' : 'down'); });
};
/* ping rapide : depuis le poste du demandeur (ou le poste d'administration) vers la première adresse de l'équipement. Diagnostic seulement : n'observe rien, ne clôt rien. */
UR.quickPing = function (run, nid) {
  const W = run.W, d = W.dev[nid]; if (!d) return;
  let src = null; run.m.parts.forEach(p => (p.probes || []).forEach(pr => { if (!src && pr.from && W.dev[pr.from]) src = pr.from; })); if (!src || src === nid) src = W.dev['PC-ADM'] && nid !== 'PC-ADM' ? 'PC-ADM' : src;
  const ip = Object.keys(d.ifaces || {}).map(k => d.ifaces[k].ip).filter(x => x && !/^169\.254\./.test(x))[0];
  if (!src || !ip) { UI.toast('Ping rapide : pas d’adresse connue pour ' + nid + '.', 'warn', 3000); return; }
  let ok = false; try { ok = !!N.ping(W, src, ip).ok; } catch (e) { ok = false; }
  run.act(src, 'ping rapide → ' + nid + ' (' + ip + ') : ' + (ok ? 'réponse' : 'pas de réponse'), {});
  UI.toast(src + ' → ' + nid + ' (' + ip + ') : ' + (ok ? 'réponse' : 'délai d’attente dépassé'), ok ? 'ok' : 'warn', 4500);
};
UR.popupItems = function (run, nid, btn) { return UR.toolOn('qping', run) && run.W.dev[nid] && nid !== 'ISP' ? [btn('Ping rapide (outil)', () => UR.quickPing(run, nid))] : []; };

/* historique entre tickets : lignes des tickets précédents, placées avant celles de la session */
UR.histSeed = s => (UR.toolOn('hist') && s && UR.HIST_KINDS.indexOf(s.kind) >= 0 && UR.seed[s.kind] ? UR.seed[s.kind] : []);
if (SIM.emu && SIM.emu.Session) {
  const exec = SIM.emu.Session.prototype.exec;
  SIM.emu.Session.prototype.exec = function (line) {
    const asking = !!this.ask; const r = exec.apply(this, arguments);
    /* jamais une réponse à une invite (mot de passe, confirmation) */
    if (!asking && typeof line === 'string' && line.trim() && UR.run && UR.HIST_KINDS.indexOf(this.kind) >= 0 && !legacy() && RW.has(Game.profile(), 'tool:hist')) {
      try { const st = Game.store.get('cmdhist'); const all = st && typeof st === 'object' && !Array.isArray(st) ? st : {}; const k = String(this.kind || 'generic').slice(0, 12); const a = Array.isArray(all[k]) ? all[k] : []; if (a[a.length - 1] !== line) a.push(line.slice(0, 200)); all[k] = a.slice(-40); Game.store.set('cmdhist', all); } catch (e) { /* stockage indisponible */ }
    }
    return r;
  };
}

/* second avis : le prochain indice est gratuit, une fois par jour */
const hintUi = App.hint;
App.hint = function () {
  const run = this.run, m = run && run.m; if (!m || this.legacy) return hintUi.apply(this, arguments);
  const prof = Game.profile();
  if (!RW.secondReady(prof, m) || m.hintsUsed >= 3) return hintUi.apply(this, arguments);
  const r = m.hint(undefined, { free: true });
  if (r.denied) { UI.toast(r.why, 'warn'); return; } if (r.none) { UI.toast('Plus d’indice disponible.', 'warn'); return; }
  RW.useSecond(prof); Game.saveProfile(prof);
  UI.toast('Second avis : indice ' + r.n + ' offert, aucun point retiré. Le prochain sera payant.', 'ok', 5000);
  if (this.drawHints) this.drawHints(); if (this.refreshBar) this.refreshBar();
};

/* ------------------------------------------------------------------ accueil : insigne, étoiles de prestige, prochaine récompense */
UR.decorateHome = function (app) {
  const root = app.root; if (!root) return; const card = root.querySelector('.pcard'); if (!card) return; const prof = Game.profile();
  const fr = RW.cosOf(prof, 'frame'); if (fr !== 'default') card.setAttribute('data-frame', fr);
  const pr = RW.prestige(prof); const title = card.querySelector('.ptitle'); if (pr && title) title.append(h('span.rwstar', { title: pr + ' prestige' + (pr > 1 ? 's' : '') }, ' ' + '★'.repeat(Math.min(pr, 5)) + (pr > 5 ? ' ×' + pr : '')));
  const nx = RW.next(prof); const btns = card.querySelector('.hbtns');
  if (btns) btns.append(h('button.btn.rwbtn', { on: { click: () => UI.prog.screen(app, 'rewards') } }, 'Récompenses'));
  card.append(h('div.rwnext', nx ? ['Prochaine récompense au niveau ', h('b', String(nx.lv)), ' : ' + nx.label] : RW.canPrestige(prof) ? 'Niveau maximal : le prestige t’attend dans Récompenses.' : 'Toutes les récompenses de niveau sont acquises.'));
};
/* tampon de la fiche d'intervention : l'insigne le plus élevé mérité */
UR.stamp = function () { if (legacy()) return null; const f = RW.bestFrame(Game.profile()); return f ? h('span.rwstamp', { 'data-frame': f.id, title: 'Tampon : ' + f.label }, f.label.replace('Insigne ', '').replace(/^d’|^de /, '').toUpperCase()) : null; };

/* ------------------------------------------------------------------ onglet « Récompenses » de l'écran de carrière */
UR.view = function (app, prof, save, redraw) {
  const lvl = RW.level(prof), real = P.levelOf(prof.xp).level, pr = RW.prestige(prof);
  const track = h('div.rwtrack', RW.TRACK.map(r => { const own = lvl >= r.lv; return h('div.rwrow' + (own ? '.on' : ''), { 'data-reward': r.id }, h('span.rwlv', own ? '✓' : String(r.lv)), h('span.rwic', icon(KIND_ICON[r.kind] || 'spark', 20)), h('div.grow', h('b', r.label), h('div.muted', r.desc)), h('span.muted.rwst', own ? 'Acquis' : 'Niveau ' + r.lv)); }));
  const picker = slot => h('div.rwslot', h('h3', RW.COS_LABEL[slot]), h('div.rwopts', RW.COS[slot].map(c => { const own = RW.cosOwned(prof, slot, c.id); const cur = RW.cosOf(prof, slot) === c.id;
    return h('button.rwopt' + (cur ? '.on' : '') + (own ? '' : '.lock'), { 'data-cos': slot + ':' + c.id, disabled: !own, title: own ? c.label : c.lv ? 'Niveau ' + c.lv : 'Termine le chapitre ' + c.ch + ' de la campagne', on: { click: () => { if (RW.setCos(prof, slot, c.id)) { save(); UR.applyCos(prof); redraw(); } } } },
      h('i.rwsw', { 'data-slot': slot, 'data-v': c.id }), h('span', c.label), own ? null : h('small', c.lv ? 'niv. ' + c.lv : 'chap. ' + c.ch)); })));
  const prestige = h('div.rwprest', h('h3', 'Prestige' + (pr ? ' — ' + '★'.repeat(Math.min(pr, 5)) + (pr > 5 ? ' ×' + pr : '') : '')),
    h('p.muted', 'Au niveau ' + P.MAX_LEVEL + ', tu peux repartir du niveau 1. Tu gardes la campagne, les succès, les maîtrises et toutes les récompenses de niveau ; l’arbre de compétences est rendu et se regagne en remontant. Tu gagnes une étoile et le contrat « Tout ou rien ».'),
    h('button.btn' + (RW.canPrestige(prof) ? '.primary' : ''), { 'data-act': 'prestige', disabled: !RW.canPrestige(prof), on: { click: () => UI.modal('Passer au prestige ?', h('p', 'Ton expérience repart de zéro (niveau 1). Rien d’autre n’est perdu. Ce choix ne s’annule pas.'), [{ label: 'Annuler' }, { label: 'Prestige', primary: true, fn: () => { if (RW.doPrestige(prof)) { save(); UI.toast('Prestige ' + RW.prestige(prof) + ' : une étoile de plus. Contrat « Tout ou rien » disponible.', 'ok', 7000); redraw(); } } }]) } }, RW.canPrestige(prof) ? 'Passer au prestige' : 'Disponible au niveau ' + P.MAX_LEVEL + ' (tu es niveau ' + real + ')'));
  return h('div.rwview', h('p.muted', 'Chaque palier de niveau débloque quelque chose, sans rien acheter. Les outils et le second avis sont coupés en évaluation chronométrée et en examen de chapitre ; les contrats ne changent que l’XP. Les notes restent comparables d’un joueur à l’autre.'),
    h('div.rwcols', h('div', h('h3', 'Piste des récompenses'), track), h('div', h('h3', 'Apparence'), h('p.muted', 'Les fonds d’écran, les couleurs de terminal et la carte ne changent rien au fonctionnement des consoles.'), ['wall', 'term', 'map', 'frame'].map(picker), prestige)));
};
/* débrief : ce que le ou les niveaux gagnés viennent de débloquer */
UR.debriefUnlocks = function (prog) {
  if (!prog || legacy() || !prog.from || !prog.to || prog.to.level <= prog.from.level) return null;
  if (RW.prestige(Game.profile()) > 0) return null;
  const list = RW.between(prog.from.level, prog.to.level); if (!list.length) return null;
  return h('div.card.rwnew', h('h3', 'Débloqué par ton niveau ' + prog.to.level), list.map(r => h('div.rwrow.on', h('span.rwic', icon(KIND_ICON[r.kind] || 'spark', 20)), h('div.grow', h('b', r.label), h('div.muted', r.desc)))),
    h('div.muted', { style: { marginTop: '6px' } }, 'À retrouver dans Carrière → Récompenses.'));
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
