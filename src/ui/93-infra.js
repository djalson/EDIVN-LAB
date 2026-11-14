/* ============================================================================
   Fiche de l'infra : identifiants (avec copie), plan d'adressage attendu (IP, masque, passerelle, DNS, VLAN, mode) et tableau de brassage attendu,
   comme un schéma réseau. Le plan est calculé depuis le monde SAIN (SIM.plan, src/engine/82-addressing.js), jamais écrit à la main.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h;
const INF = UI.infra = {};

/* Copie dans le presse-papiers : API moderne si disponible, sinon sélection temporaire d'un champ texte. */
UI.copyText = function (text, what) {
  const done = ok => UI.toast(ok ? (what ? what + ' copié' : 'Copié') + ' dans le presse-papiers.' : 'Copie impossible : sélectionne le texte et fais Ctrl + C.', ok ? 'ok' : 'warn', 2500);
  const fallback = () => {
    const ta = h('textarea', { style: { position: 'fixed', left: '-9999px', top: '0' }, readOnly: true }); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); done(ok);
  };
  try { if (g.navigator && g.navigator.clipboard && g.isSecureContext) { g.navigator.clipboard.writeText(text).then(() => done(true), fallback); return; } } catch (e) { /* repli ci-dessous */ }
  fallback();
};
const cp = (text, what, cls) => text ? h('span.cp' + (cls ? '.' + cls : ''), { title: 'Cliquer pour copier', tabindex: 0, role: 'button', on: { click: () => UI.copyText(text, what), keydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); UI.copyText(text, what); } } } }, text) : null;
INF.cp = cp;

/* ------------------------------------------------------------------ identifiants */
INF.credsView = function (scope) {
  /* campagne : seuls les comptes des équipements déjà au programme. Deux onglets : les comptes pour administrer, et ceux des utilisateurs (pour reproduire leur problème). */
  const all = SIM.VAULT.filter(c => !scope || !c.ch || c.ch <= scope.n); const isUser = c => /^Utilisat/.test(c.note || '');
  const row = c => h('tr', h('td', c.scope), h('td', cp(c.user, 'Identifiant')), h('td', cp(c.secret, 'Mot de passe', 'mono')),
    h('td.nowrap', h('button.btn.small', { title: 'Copier l’identifiant', on: { click: () => UI.copyText(c.user, 'Identifiant') } }, 'Copier id'), ' ', h('button.btn.small', { title: 'Copier le mot de passe', on: { click: () => UI.copyText(c.secret, 'Mot de passe') } }, 'Copier mdp')), h('td.muted', c.note));
  let tab = 'adm'; const box = h('div');
  const draw = () => { UI.clear(box); const list = all.filter(c => (tab === 'usr') === isUser(c));
    box.append(h('div.credtabs', { role: 'tablist' }, [['adm', 'Administration', all.filter(c => !isUser(c)).length], ['usr', 'Utilisateurs', all.filter(isUser).length]].map(t => h('button.credtab' + (tab === t[0] ? '.on' : ''), { role: 'tab', 'data-tab': t[0], 'aria-selected': String(tab === t[0]), on: { click: () => { tab = t[0]; draw(); } } }, t[1], h('small', ' ' + t[2])))),
      h('p.muted', tab === 'adm' ? 'Les comptes pour intervenir. Prends le moins privilégié qui suffit.' : 'Les comptes des utilisateurs, pour reproduire leur problème à leur place.'),
      h('table.tbl.infotbl', h('thead', h('tr', ['Contexte', 'Identifiant', 'Mot de passe', '', 'Note'].map(x => h('th', x)))), h('tbody', list.map(row)))); };
  draw(); return box;
};

/* ------------------------------------------------------------------ plan d'adressage */
let cache = null;
INF.plan = function (seed) {
  const key = String(seed || 1); if (cache && cache.key === key) return cache.plan;
  const world = SIM.buildHealthyWorld({ seed: seed || 1 }); const plan = SIM.plan(world); cache = { key, plan, world }; return plan;
};
INF.world = function (seed) { INF.plan(seed); return cache.world; };
INF.siteOf = dev => { const ids = Object.keys(UI.SITES); for (const sid of ids) { const n = UI.SITES[sid].nodes.find(x => x[0] === dev); if (n) return { sid, role: n[4] || '' }; } return { sid: '', role: '' }; };
INF.planView = function (seed, scope) {
  const full = INF.plan(seed); const plan = scope ? { rows: full.rows.filter(r => scope.devs.indexOf(r.dev) >= 0), devices: full.devices.filter(d => scope.devs.indexOf(d) >= 0) } : full; const box = h('div'); const q = h('input.txt', { placeholder: 'Filtrer : machine, IP, VLAN…', 'aria-label': 'Filtrer le plan d’adressage', style: { width: '260px' } });
  const sites = Object.keys(UI.SITES); const bySite = {}; plan.rows.forEach(r => { const s = INF.siteOf(r.dev); r._role = s.role; (bySite[s.sid || '_'] = bySite[s.sid || '_'] || []).push(r); });
  const draw = () => {
    UI.clear(box); const f = q.value.trim().toLowerCase(); let shown = 0;
    sites.concat(['_']).forEach(sid => {
      const rows = (bySite[sid] || []).filter(r => !f || [r.dev, r._role, r.iface, r.ip, r.cidr, r.mask, r.gw, r.dns.join(' '), r.vlan, r.mode, r.note, r.suffix].join(' ').toLowerCase().indexOf(f) >= 0);
      if (!rows.length) return; shown += rows.length; let last = '';
      box.append(h('h3.infosite', sid === '_' ? 'Autres' : UI.SITES[sid].label), h('table.tbl.infotbl', h('thead', h('tr', ['Machine', 'Interface', 'Adresse IP', 'Masque', 'Passerelle', 'DNS', 'VLAN', 'Mode', 'Note'].map(x => h('th', x)))),
        h('tbody', rows.map(r => { const first = r.dev !== last; last = r.dev;
          return h('tr' + (first ? '.infofirst' : ''), h('td', first ? [h('b', r.dev), r._role ? h('div.muted', r._role) : null] : ''), h('td', r.iface), h('td', cp(r.ip, 'Adresse IP', 'mono')),
            h('td.nowrap', r.mask ? [cp(r.mask, 'Masque', 'mono'), h('span.muted', ' /' + SIM.U.mask2len(r.mask))] : ''), h('td', cp(r.gw, 'Passerelle', 'mono')),
            h('td', r.dns.map((x, i) => [i ? ', ' : '', cp(x, 'DNS', 'mono')]), r.suffix ? h('div.muted', 'suffixe ' + r.suffix) : null), h('td', r.vlan), h('td', r.mode), h('td.muted', r.note)); }))));
    });
    if (!shown) box.append(h('p.muted', 'Aucune ligne ne correspond.'));
  };
  q.addEventListener('input', draw); draw();
  return h('div', h('p.muted', 'Adressage ATTENDU en fonctionnement normal, comme sur un schéma réseau. Compare avec ce que tu observes sur la machine (ipconfig, ip a, show ip interface brief…). Les postes en DHCP affichent l’adresse du bail normal. Clique sur une valeur pour la copier.'),
    h('div.row', { style: { margin: '6px 0' } }, q, h('span.muted', plan.rows.length + ' lignes, ' + plan.devices.length + ' équipements')), box);
};

/* ------------------------------------------------------------------ tableau de brassage
   Comme le plan d'adressage : l'état ATTENDU, calculé depuis le monde sain (ports des commutateurs, prises murales), jamais écrit à la main.
   Ce qu'on trouverait dans le dossier d'exploitation : port, ce qui y est relié, mode, VLAN, description. Rien sur la sécurité de port
   (adresses MAC apprises), qui se vérifie en console. */
const shortP = n => String(n).replace(/^FastEthernet/, 'Fa').replace(/^GigabitEthernet/, 'Gi').replace(/^TenGigabitEthernet/, 'Te').replace(/^Ethernet/, 'Eth');
INF.patchRows = function (seed, scope) {
  const W = INF.world(seed); const rows = [];
  Object.keys(W.dev).sort().forEach(id => { const d = W.dev[id]; if (d.kind !== 'ios-sw' || (scope && scope.devs.indexOf(id) < 0)) return;
    Object.keys(d.ports || {}).forEach(n => { const p = d.ports[n]; const to = p.cable && p.cable.to; if (!to && !p.desc) return; const logical = /^Port-channel/i.test(n) || p.virtual;
      let link = logical ? 'interface logique (agrégat EtherChannel)' : '—'; if (to) { if (to.indexOf('patch:') === 0 || to.indexOf('wall:') === 0) link = 'prise murale ' + to.replace(/^\w+:/, ''); else { const i = to.indexOf(':'); link = to.slice(0, i) + ' ' + shortP(to.slice(i + 1)); } }
      rows.push({ dev: id, port: shortP(n), link, mode: p.mode === 'trunk' ? 'trunk' : 'accès', vlan: p.mode === 'trunk' ? (p.allowed ? p.allowed.join(', ') : 'tous') + (p.native && p.native !== 1 ? ' (natif ' + p.native + ')' : '') : String(p.vlan || 1), desc: p.desc || '', free: !to && !logical, logical });
    }); });
  const walls = Object.keys(W.walls || {}).sort().map(id => { const t = W.walls[id]; if (!t) return { id, sw: '', port: '' }; const i = t.indexOf(':'); return { id, sw: t.slice(0, i), port: shortP(t.slice(i + 1)) }; })
    .filter(w => !scope || !w.sw || scope.devs.indexOf(w.sw) >= 0);
  return { rows, walls };
};
INF.patchView = function (seed, scope) {
  const data = INF.patchRows(seed, scope); const box = h('div'); const q = h('input.txt', { placeholder: 'Filtrer : commutateur, port, prise, VLAN…', 'aria-label': 'Filtrer le tableau de brassage', style: { width: '260px' } });
  const draw = () => {
    UI.clear(box); const f = q.value.trim().toLowerCase(); const m = arr => !f || arr.join(' ').toLowerCase().indexOf(f) >= 0;
    const walls = data.walls.filter(w => m(['prise', w.id, w.sw, w.port]));
    if (walls.length) box.append(h('h3.infosite', 'Prises murales'), h('table.tbl.infotbl', h('thead', h('tr', ['Prise', 'Brassée sur'].map(x => h('th', x)))),
      h('tbody', walls.map(w => h('tr', h('td', h('b', w.id)), h('td', w.sw ? w.sw + ' ' + w.port : h('span.muted', 'non brassée')))))));
    let last = ''; const rows = data.rows.filter(r => m([r.dev, r.port, r.link, r.mode, 'vlan ' + r.vlan, r.desc]));
    if (rows.length) box.append(h('h3.infosite', 'Ports des commutateurs'), h('table.tbl.infotbl', h('thead', h('tr', ['Commutateur', 'Port', 'Relié à', 'Mode', 'VLAN', 'Description'].map(x => h('th', x)))),
      h('tbody', rows.map(r => { const first = r.dev !== last; last = r.dev;
        return h('tr' + (first ? '.infofirst' : ''), h('td', first ? h('b', r.dev) : ''), h('td.mono', r.port), h('td', r.free ? h('span.muted', 'libre') : r.logical ? h('span.muted', r.link) : r.link), h('td', r.mode), h('td', r.vlan), h('td.muted', r.desc)); }))));
    if (!walls.length && !rows.length) box.append(h('p.muted', 'Aucune ligne ne correspond.'));
  };
  q.addEventListener('input', draw); draw();
  return h('div', h('p.muted', 'Brassage ATTENDU en fonctionnement normal, comme dans le dossier d’exploitation : quelle prise va sur quel port, et la configuration prévue de chaque port. Compare avec ce que tu observes (baie, show interfaces status, show vlan brief).'),
    h('div.row', { style: { margin: '6px 0' } }, q, h('span.muted', data.walls.length + ' prises, ' + data.rows.length + ' ports')), box);
};

/* ------------------------------------------------------------------ fenêtre */
INF.modal = function (app, tab) {
  const seed = app && app.run && app.run.m ? app.run.m.seed : 1; const scope = app && app.run && !app.run.ended && app.run.scope ? app.run.scope : (app && app.infraScope ? app.infraScope() : null); let cur = tab || 'creds'; const body = h('div.infoscroll'); const tabs = h('div.pgtabs', { style: { padding: '0 0 8px' } }); let mm = null;
  const draw = () => {
    UI.clear(tabs); [['creds', 'Identifiants'], ['plan', 'Plan d’adressage'], ['patch', 'Brassage']].forEach(t => tabs.append(h('button.pgtab' + (cur === t[0] ? '.on' : ''), { on: { click: () => { cur = t[0]; draw(); } } }, t[1])));
    UI.clear(body); body.append(cur === 'creds' ? INF.credsView(scope) : cur === 'patch' ? INF.patchView(seed, scope) : INF.planView(seed, scope));
    if ((cur === 'plan' || cur === 'patch') && app && app.run && app.run.m && app.run.m.aid) app.run.m.aid('plan');   /* D-94 : ouverture tracée, sans malus */
    if (mm) { mm.el.style.maxWidth = cur !== 'creds' ? 'min(1240px, 96vw)' : '860px'; mm.el.style.width = cur !== 'creds' ? '96vw' : 'auto'; }
  };
  mm = UI.modal('Fiche de l’infra', h('div', tabs, body), [{ label: 'Fermer', primary: true }]); draw();
  return mm;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
