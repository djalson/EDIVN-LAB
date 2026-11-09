/* ============================================================================
   Fiche de l'infra : identifiants (avec copie) et plan d'adressage attendu (IP, masque, passerelle, DNS, VLAN, mode),
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
  /* campagne : seuls les comptes des équipements déjà au programme */
  const rows = SIM.VAULT.filter(c => !scope || !c.ch || c.ch <= scope.n).map(c => h('tr', h('td', c.scope), h('td', cp(c.user, 'Identifiant')), h('td', cp(c.secret, 'Mot de passe', 'mono')),
    h('td.nowrap', h('button.btn.small', { title: 'Copier l’identifiant', on: { click: () => UI.copyText(c.user, 'Identifiant') } }, 'Copier id'), ' ', h('button.btn.small', { title: 'Copier le mot de passe', on: { click: () => UI.copyText(c.secret, 'Mot de passe') } }, 'Copier mdp')), h('td.muted', c.note)));
  return h('div', h('p.muted', 'Oui, ils sont tous dans un tableau : c’est un simulateur, pas une production. Dans la vraie vie, ça s’appelle un gestionnaire de mots de passe, et pas un post-it. Utilise le compte le moins privilégié qui suffit. Clique sur un identifiant ou un mot de passe pour le copier.'),
    h('table.tbl.infotbl', h('thead', h('tr', ['Contexte', 'Identifiant', 'Mot de passe', '', 'Note'].map(x => h('th', x)))), h('tbody', rows)));
};

/* ------------------------------------------------------------------ plan d'adressage */
let cache = null;
INF.plan = function (seed) {
  const key = String(seed || 1); if (cache && cache.key === key) return cache.plan;
  const plan = SIM.plan(SIM.buildHealthyWorld({ seed: seed || 1 })); cache = { key, plan }; return plan;
};
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

/* ------------------------------------------------------------------ fenêtre */
INF.modal = function (app, tab) {
  const seed = app && app.run && app.run.m ? app.run.m.seed : 1; const scope = app && app.run && !app.run.ended && app.run.scope ? app.run.scope : (app && app.infraScope ? app.infraScope() : null); let cur = tab || 'creds'; const body = h('div.infoscroll'); const tabs = h('div.pgtabs', { style: { padding: '0 0 8px' } }); let mm = null;
  const draw = () => {
    UI.clear(tabs); [['creds', 'Identifiants'], ['plan', 'Plan d’adressage']].forEach(t => tabs.append(h('button.pgtab' + (cur === t[0] ? '.on' : ''), { on: { click: () => { cur = t[0]; draw(); } } }, t[1])));
    UI.clear(body); body.append(cur === 'creds' ? INF.credsView(scope) : INF.planView(seed, scope));
    if (cur === 'plan' && app && app.run && app.run.m && app.run.m.aid) app.run.m.aid('plan');   /* D-94 : ouverture tracée, sans malus */
    if (mm) { mm.el.style.maxWidth = cur === 'plan' ? 'min(1240px, 96vw)' : '860px'; mm.el.style.width = cur === 'plan' ? '96vw' : 'auto'; }
  };
  mm = UI.modal('Fiche de l’infra', h('div', tabs, body), [{ label: 'Fermer', primary: true }]); draw();
  return mm;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
