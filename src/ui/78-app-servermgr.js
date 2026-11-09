/* ============================================================================
   Gestionnaire de serveur, Gestion de l'ordinateur, Utilisateurs et groupes locaux, Propriétés système (Bureau à distance)
   et applications non simulées (signalées honnêtement, jamais factices).
   Les tuiles de rôle du tableau de bord sont CALCULÉES : un service arrêté ou un événement d'erreur fait passer la tuile au rouge.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, WIN = SIM.win, h = UI.h, W_ = E.win;
SIM.AVREG['servermgr-ui'] = 'Gestionnaire de serveur : arborescence, libellés des tuiles (« Facilité de gestion », « Événements », « Services »), menus Gérer / Outils / Afficher / Aide, volet « Propriétés » du serveur local — reconstitués de mémoire en français ; les lignes Performances et Résultats BPA ne sont pas simulées (absentes).';
SIM.AVREG['sysprops-remote'] = 'Propriétés système › onglet « Utilisation à distance » : libellés des options (« Ne pas autoriser… », « Autoriser les connexions à distance à cet ordinateur », authentification au niveau du réseau) reconstitués de mémoire ; l’option NLA n’est pas modélisée (case informative).';
SIM.AVREG['compmgmt-ui'] = 'Gestion de l’ordinateur : arborescence (Outils système, Dossiers partagés, Utilisateurs et groupes locaux, Services et applications) et partages par défaut (C$ « Partage par défaut », ADMIN$ « Administration à distance », IPC$ « IPC distant ») — libellés à vérifier par capture. Planificateur de tâches, Gestion des disques, Gestionnaire de périphériques et Performances non simulés.';
SIM.AVREG['lusrmgr-ui'] = 'Utilisateurs et groupes locaux : colonnes, onglets « Général / Membre de » et message d’indisponibilité sur un contrôleur de domaine reconstitués de mémoire — à vérifier par capture.';
const lc = s => String(s || '').toLowerCase();

/* ------------------------------------------------------------------ outils disponibles selon les rôles réellement installés */
function roles(d) {
  const s = d.win && d.win.svc || {}; const out = [];
  if (s.NTDS) out.push({ id: 'ad', name: 'AD DS', svcs: ['NTDS', 'Kdc', 'Netlogon', 'DNS'].filter(x => s[x]), chan: ['Système'], tool: 'aduc' });
  if (s.DNS) out.push({ id: 'dns', name: 'DNS', svcs: ['DNS'], chan: ['DNS-Server'], tool: 'dns' });
  if (s.DHCPServer) out.push({ id: 'dhcp', name: 'DHCP', svcs: ['DHCPServer'], chan: ['DHCP-Server'], tool: 'dhcp' });
  if (s.W3SVC) out.push({ id: 'iis', name: 'IIS', svcs: ['W3SVC', 'WAS'].filter(x => s[x]), chan: ['Application'], tool: 'iis' });
  out.push({ id: 'file', name: 'Services de fichiers et de stockage', svcs: ['LanmanServer'].filter(x => s[x]), chan: [], tool: 'compmgmt' });
  return out;
}
function toolList(desk) {
  const d = desk.d, s = d.win.svc || {}; const t = [];
  if (s.NTDS) { t.push(['aduc', 'Utilisateurs et ordinateurs Active Directory']); t.push(['domain', 'Domaines et approbations Active Directory']); t.push(['dns', 'DNS']); }
  else if (s.DNS) t.push(['dns', 'DNS']);
  if (s.DHCPServer) t.push(['dhcp', 'DHCP']);
  if (s.NTDS || d.win.domain) t.push(['gpmc', 'Gestion de stratégie de groupe']);
  if (s.W3SVC) t.push(['iis', 'Gestionnaire des services Internet (IIS)']);
  t.push(['certlm', 'Certificats (ordinateur local)']); t.push(['compmgmt', 'Gestion de l’ordinateur']); t.push(['eventvwr', 'Observateur d’événements']); t.push(['services', 'Services']); t.push(['wf', 'Pare-feu Windows Defender avec fonctions avancées de sécurité']);
  return t.filter(x => UI.apps[x[0]]).sort((a, b) => a[1].localeCompare(b[1], 'fr'));
}

/* ------------------------------------------------------------------ Propriétés système › Utilisation à distance */
function sysProps(desk, owner, start) {
  const d = desk.d, W = desk.W; const rdp = d.win.rdp = d.win.rdp || { enabled: false, users: [] }; rdp.users = rdp.users || [];
  let on = !!rdp.enabled; let users = rdp.users.slice(); let nla = rdp.nla !== false;
  const name = h('div.pad', UI.rows([['Nom complet :', h('b', d.name.toLowerCase() + (d.win.domain ? '.' + d.win.domain : ''))], [d.win.domain ? 'Domaine :' : 'Groupe de travail :', h('b', d.win.domain || d.win.workgroup || 'WORKGROUP')]], 130));
  const dirty = () => win.markDirty && win.markDirty();
  const rOff = UI.w.radio('rd', 'Ne pas autoriser les connexions à distance à cet ordinateur', !on, () => { on = false; dirty(); }), rOn = UI.w.radio('rd', 'Autoriser les connexions à distance à cet ordinateur', on, () => { on = true; dirty(); });
  const chk = UI.w.check('N’autoriser que la connexion des ordinateurs exécutant le Bureau à distance avec authentification au niveau du réseau (recommandé)', nla, v => { nla = v; dirty(); });
  const selUsers = UI.w.btn('Sélectionner des utilisateurs…', () => usersDlg());
  const usersDlg = () => {
    const lst = h('textarea', { spellcheck: false, style: { width: '100%', height: '140px' } }); lst.value = users.join('\n');
    UI.dialog(desk, win, { title: 'Utilisateurs du Bureau à distance', w: 440, h: 330, body: h('div', h('div', { style: { marginBottom: '6px' } }, 'Les comptes ci-dessous (un par ligne, DOMAINE\\compte) peuvent se connecter à distance. Les membres du groupe Administrateurs peuvent toujours se connecter.'), lst),
      buttons: [{ label: 'OK', def: true, fn: () => { users = lst.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean); dirty(); } }, { label: 'Annuler' }] });
  };
  const remote = h('div.pad', h('div', { style: { fontWeight: 600, marginBottom: '6px' } }, 'Bureau à distance'), h('div', { style: { marginBottom: '8px' } }, 'Choisissez une option, puis spécifiez qui peut se connecter, si nécessaire.'), rOff, rOn, h('div', { style: { margin: '8px 0 8px 22px' } }, chk), h('div', { style: { marginLeft: '22px' } }, selUsers));
  const apply = () => {
    const was = !!rdp.enabled;
    rdp.enabled = on; rdp.nla = nla; rdp.users = users.slice();
    /* Windows active aussi le groupe de règles « Bureau à distance » du pare-feu */
    const fw = (d.win.fw && d.win.fw.rules) || []; const grp = fw.filter(r => r.group === 'Bureau à distance');
    if (on && !grp.length) fw.push({ name: 'Bureau à distance - Mode utilisateur (TCP-Entrée)', id: 'rdp', enabled: true, dir: 'in', action: 'allow', profiles: ['domain', 'private'], proto: 'TCP', lport: '3389', group: 'Bureau à distance' });
    else if (on) grp.forEach(r => { r.enabled = true; });
    desk.env.advance(2); desk.change('Propriétés système : Bureau à distance ' + (on ? 'autorisé' : 'refusé') + (was === on ? ' (liste d’utilisateurs modifiée)' : ''), { dev: desk.devId });
  };
  let win = UI.w.propertySheet({ wm: desk.wm, owner, title: 'Propriétés système', icon: 'gear', w: 440, h: 440, start: start || 0, tabs: [{ label: 'Nom de l’ordinateur', content: name }, { label: 'Utilisation à distance', content: remote }], onOk: () => apply(), onApply: () => apply() });
  return win;
}

/* ------------------------------------------------------------------ Gestionnaire de serveur */
UI.app('servermgr', {
  title: 'Gestionnaire de serveur', icon: 'server', single: true,
  open: (desk) => {
    const d = desk.d, W = desk.W; let win, content = h('div.smmain'); let page = 'dash';
    const nav = h('div.smnav'); const rl = roles(d);
    const open = (id, arg) => desk.open(id, arg);
    const count = (r) => {
      const stopped = r.svcs.filter(k => d.win.svc[k] && d.win.svc[k].start !== 'disabled' && d.win.svc[k].state !== 'running' && d.win.svc[k].start !== 'manual').length;
      let ev = 0; r.chan.forEach(c => (W.logs(d.id, 'evt:' + c) || []).forEach(e => { if (e.level === 'Erreur' || e.level === 'Avertissement') ev++; }));
      return { stopped, ev };
    };
    const tile = (r) => {
      const c = count(r); const bad = c.stopped > 0;
      return h('div.smtile' + (bad ? '.bad' : ''), h('div.smth', h('b', r.name), h('span.muted', ' ' + 1)), h('div.smtr', h('span', 'Facilité de gestion'), h('i.smok' + (bad ? '.no' : ''), bad ? '✖' : '✔')),
        r.chan.length ? h('div.smtr.lk', { on: { click: () => open('eventvwr') } }, h('span', 'Événements'), h('b.smn' + (c.ev ? '.warn' : ''), c.ev || '')) : null,
        r.svcs.length ? h('div.smtr.lk', { on: { click: () => open('services') } }, h('span', 'Services'), h('b.smn' + (c.stopped ? '.bad' : ''), c.stopped || '')) : null);
    };
    const dash = () => {
      const c = h('div'); c.append(h('div.smwelcome', h('div.smwt', 'BIENVENUE DANS GESTIONNAIRE DE SERVEUR'), h('div.smwb', h('div.smwq', h('b', 'DÉMARRAGE RAPIDE')), h('div.lnk', { on: { click: () => page = pick('local') } }, '1  Configurer ce serveur local'), h('div.lnk', { on: { click: () => unsim('Ajouter des rôles et des fonctionnalités') } }, '2  Ajouter des rôles et des fonctionnalités'), h('div.lnk', { on: { click: () => unsim('Ajouter d’autres serveurs à gérer') } }, '3  Ajouter d’autres serveurs à gérer'))));
      c.append(h('div.smsec', h('div.smsh', 'RÔLES ET GROUPES DE SERVEURS'), h('div.smsub', 'Rôles : ' + rl.length + ' | Groupes de serveurs : 1 | Serveurs : 1')), h('div.smtiles', h('div.smtile', h('div.smth', h('b', 'Serveur local'), h('span.muted', ' 1')), h('div.smtr', h('span', 'Facilité de gestion'), h('i.smok', '✔')), h('div.smtr.lk', { on: { click: () => open('eventvwr') } }, h('span', 'Événements'), h('b.smn', '')), h('div.smtr.lk', { on: { click: () => open('services') } }, h('span', 'Services'), h('b.smn', ''))), rl.map(tile)));
      return c;
    };
    const unsim = (what) => desk.msg({ title: 'Gestionnaire de serveur', icon: 'info', owner: win, text: what + ' : l’assistant n’est pas simulé dans cette version. Les rôles de ce serveur sont déjà installés.' });
    const local = () => {
      const net = d.ifaces && d.ifaces.Ethernet0; const cfg = net ? N.effCfg(d, 'Ethernet0') : null;
      const rdpOn = !!(d.win.rdp && d.win.rdp.enabled);
      const prow = (k, v, fn) => h('div.smpr', h('span.smk', k), fn ? h('span.smv.lnk', { on: { click: fn } }, v) : h('span.smv', v));
      const fwp = d.win.fw && d.win.fw.profiles; const net0 = W_.fwProfileOf ? null : null;
      return h('div', h('div.smsec', h('div.smsh', 'PROPRIÉTÉS'), h('div.smsub', 'Pour ' + d.name.toUpperCase())),
        h('div.smprops', prow('Nom de l’ordinateur', d.name.toUpperCase(), () => sysProps(desk, win, 0)), prow(d.win.domain ? 'Domaine' : 'Groupe de travail', d.win.domain || d.win.workgroup || 'WORKGROUP', () => sysProps(desk, win, 0)),
          prow('Bureau à distance', rdpOn ? 'Activé' : 'Désactivé', () => sysProps(desk, win, 1)),
          prow('Ethernet0', cfg ? (cfg.mode === 'dhcp' ? 'Adresse IPv4 attribuée par DHCP : ' : 'Adresse IPv4 : ') + (cfg.ip || '—') : 'non connecté', () => open('ncpa')),
          prow('Système d’exploitation', d.os || '—'), prow('Fuseau horaire', 'UTC')));
    };
    const pick = (p) => { page = p; UI.clear(content); content.append(h('div.smhead', h('b', 'Gestionnaire de serveur'), h('span.muted', ' › ' + (p === 'dash' ? 'Tableau de bord' : 'Serveur local'))), p === 'dash' ? dash() : local()); drawNav(); return p; };
    const drawNav = () => { UI.clear(nav); [['dash', 'Tableau de bord', 'home'], ['local', 'Serveur local', 'server']].forEach(([id, l, ic]) => nav.append(h('div.smni' + (page === id ? '.on' : ''), { on: { click: () => pick(id) } }, UI.icon(ic, 16), l))); rl.forEach(r => nav.append(h('div.smni.sub', { on: { click: () => open(r.tool) } }, r.name))); };
    const menu = [
      { label: 'Gérer', items: [{ label: 'Ajouter des rôles et des fonctionnalités', fn: () => unsim('Ajouter des rôles et des fonctionnalités') }, { label: 'Supprimer des rôles et des fonctionnalités', fn: () => unsim('Supprimer des rôles et des fonctionnalités') }] },
      { label: 'Outils', items: () => toolList(desk).map(([id, l]) => ({ label: l, fn: () => open(id) })) },
      { label: 'Afficher', items: [{ label: 'Actualiser', fn: () => pick(page) }] },
      { label: 'Aide', items: [{ label: 'À propos', fn: () => desk.msg({ title: 'Gestionnaire de serveur', icon: 'info', owner: win, text: 'Reproduction fonctionnelle, sans logo ni code d’origine.' }) }] }];
    win = desk.wm.open({ title: 'Gestionnaire de serveur', icon: 'server', w: 980, h: 600, menu, className: 'smgr', minW: 600, minH: 360, body: () => h('div.smwrap', nav, content) });
    const refresh = () => { if (!win.closed) { const sc = content.scrollTop; pick(page); content.scrollTop = sc; } };
    desk.run.on('world', refresh); win.onClosed = () => desk.run.off('world', refresh);
    pick('dash'); return win;
  }
});

/* ------------------------------------------------------------------ Utilisateurs et groupes locaux */
function lusr(desk, owner) {
  const d = desk.d; const W = desk.W;
  if (d.win.svc && d.win.svc.NTDS) { desk.msg({ title: 'Utilisateurs et groupes locaux', icon: 'warning', text: 'Cet outil peut affecter la sécurité de votre ordinateur. L’outil Utilisateurs et groupes locaux n’est pas disponible sur un contrôleur de domaine. Utilisez Utilisateurs et ordinateurs Active Directory.' }); return null; }
  d.win.localUsers = d.win.localUsers || []; let api, lv, mode = 'users';
  const rdp = () => (d.win.rdp = d.win.rdp || { enabled: false, users: [] });
  const admins = () => d.win.localUsers.filter(u => u.admin).map(u => u.name).concat(d.win.domain ? ['TOULOUSE\\Admins du domaine'].filter(() => false) : []);
  const userRows = () => d.win.localUsers.map(u => ({ id: u.name, name: u.name, full: u.fullName || '', desc: u.name === 'Administrateur' ? 'Compte d’utilisateur d’administration' : '', st: u.enabled === false ? 'désactivé' : '' }));
  const groupRows = () => [{ id: 'Administrateurs', name: 'Administrateurs', desc: 'Les membres du groupe Administrateurs disposent d’un accès complet et illimité à l’ordinateur et au domaine' }, { id: 'Utilisateurs', name: 'Utilisateurs', desc: 'Les utilisateurs ne peuvent pas effectuer de modifications accidentelles ou intentionnelles à l’échelle du système' }, { id: 'Utilisateurs du Bureau à distance', name: 'Utilisateurs du Bureau à distance', desc: 'Les membres de ce groupe disposent des autorisations nécessaires pour se connecter à distance' }];
  const draw = () => {
    const rows = mode === 'users' ? userRows() : groupRows();
    lv = UI.w.listView({ columns: mode === 'users' ? [{ key: 'name', label: 'Nom', w: 190, icon: () => 'user' }, { key: 'full', label: 'Nom complet', w: 190 }, { key: 'desc', label: 'Description', w: 300 }] : [{ key: 'name', label: 'Nom', w: 230, icon: () => 'users' }, { key: 'desc', label: 'Description', w: 480 }], rows, key: r => r.id, onOpen: r => props(r), onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, mode === 'users' ? [{ label: 'Définir le mot de passe…', fn: () => setPwd(r) }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }] : [{ label: 'Propriétés', def: true, fn: () => props(r) }]) });
    api.setMid(lv.el); api.status(rows.length + ' élément(s)');
  };
  const setPwd = (r) => UI.prompt(desk, win, { title: 'Définir le mot de passe pour ' + r.name, label: 'Nouveau mot de passe :', w: 420, h: 190, onOk: v => { if (!v) return 'Le mot de passe ne peut pas être vide.'; const u = d.win.localUsers.find(x => x.name === r.id); u.pwd = v; desk.env.advance(1); desk.change('Utilisateurs et groupes locaux : mot de passe de ' + r.name + ' redéfini', { dev: desk.devId }); } });
  const props = (r) => {
    if (mode === 'users') {
      const u = d.win.localUsers.find(x => x.name === r.id); let dis = u.enabled === false; let admin = !!u.admin;
      const c1 = UI.w.check('Le compte est désactivé', dis, v => { dis = v; pw.markDirty(); }); const c2 = UI.w.check('Membre du groupe Administrateurs', admin, v => { admin = v; pw.markDirty(); });
      const ap = () => { u.enabled = !dis; u.admin = admin; desk.env.advance(1); desk.change('Utilisateurs et groupes locaux : compte ' + u.name + (dis ? ' désactivé' : ' activé') + (admin ? ', administrateur' : ''), { dev: desk.devId }); draw(); };
      const pw = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + u.name, icon: 'user', w: 400, h: 340, tabs: [{ label: 'Général', content: h('div.pad', h('b', u.name), h('div', { style: { margin: '10px 0' } }, c1), c2) }], onOk: ap, onApply: ap });
    } else {
      const rd = rdp(); const lines = r.id === 'Administrateurs' ? d.win.localUsers.filter(u => u.admin).map(u => d.name.toUpperCase() + '\\' + u.name) : r.id === 'Utilisateurs' ? ['NT AUTHORITY\\Utilisateurs authentifiés', 'NT AUTHORITY\\INTERACTIF'].concat(d.win.localUsers.filter(u => !u.admin).map(u => d.name.toUpperCase() + '\\' + u.name)) : (rd.users || []).slice();
      const ta = h('textarea', { spellcheck: false, style: { width: '100%', height: '170px' }, readOnly: r.id !== 'Utilisateurs du Bureau à distance' }); ta.value = lines.join('\n');
      const ap = () => { if (r.id === 'Utilisateurs du Bureau à distance') { rd.users = ta.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean); desk.env.advance(1); desk.change('Utilisateurs et groupes locaux : membres du groupe Utilisateurs du Bureau à distance modifiés', { dev: desk.devId }); draw(); } };
      UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + r.name, icon: 'users', w: 420, h: 360, tabs: [{ label: 'Général', content: h('div.pad', h('div', { style: { marginBottom: '6px' } }, 'Membres :'), ta, r.id === 'Utilisateurs du Bureau à distance' ? h('div.muted', { style: { marginTop: '4px' } }, 'Un compte par ligne (DOMAINE\\compte).') : h('div.muted', { style: { marginTop: '4px' } }, 'Liste en lecture seule dans cette version ; modifiez le compte lui-même.')) }], onOk: ap, onApply: ap });
    }
  };
  const win = UI.w.mmc({ wm: desk.wm, title: 'Utilisateurs et groupes locaux', icon: 'users', w: 860, h: 480, roots: [{ key: 'root', label: 'Utilisateurs et groupes locaux (local)', icon: 'users', expanded: true, children: [{ key: 'users', label: 'Utilisateurs', icon: 'folder' }, { key: 'groups', label: 'Groupes', icon: 'folder' }] }],
    onSelect: (n, a) => { api = a; if (n.key === 'users' || n.key === 'groups') { mode = n.key; draw(); } else { a.setMid(h('div.pad.muted', 'Sélectionnez Utilisateurs ou Groupes.')); } a.setActions([{ title: n.label, items: [{ label: 'Actualiser', fn: () => draw() }] }]); }, select: 'users' });
  api = win.mmc; return win;
}
UI.app('lusrmgr', { title: 'Utilisateurs et groupes locaux', icon: 'users', admin: true, single: true, open: (desk) => lusr(desk) });

/* ------------------------------------------------------------------ Gestion de l'ordinateur */
UI.app('compmgmt', {
  title: 'Gestion de l’ordinateur', icon: 'gear', admin: true, single: true,
  open: (desk) => {
    const d = desk.d; let api;
    const shares = () => [{ id: 'ADMIN$', name: 'ADMIN$', path: 'C:\\Windows', type: 'Windows', cl: 0, desc: 'Administration à distance' }, { id: 'C$', name: 'C$', path: 'C:\\', type: 'Windows', cl: 0, desc: 'Partage par défaut' }, { id: 'IPC$', name: 'IPC$', path: '', type: 'Windows', cl: 0, desc: 'IPC distant' }].concat((d.win.shares || []).map(s => ({ id: s.name, name: s.name, path: s.path, type: 'Windows', cl: 0, desc: s.comment || '' })));
    const launch = { evt: 'eventvwr', svc: 'services', lusr: 'lusrmgr' };
    const win = UI.w.mmc({ wm: desk.wm, title: 'Gestion de l’ordinateur', icon: 'gear', w: 900, h: 520, roots: [{ key: 'root', label: 'Gestion de l’ordinateur (local)', icon: 'gear', expanded: true, children: [
      { key: 'sys', label: 'Outils système', icon: 'folder', expanded: true, children: [{ key: 'evt', label: 'Observateur d’événements', icon: 'list' }, { key: 'shared', label: 'Dossiers partagés', icon: 'folder', expanded: true, children: [{ key: 'shares', label: 'Partages', icon: 'folder' }] }, { key: 'lusr', label: 'Utilisateurs et groupes locaux', icon: 'users' }] },
      { key: 'sto', label: 'Stockage', icon: 'folder', children: [{ key: 'disk', label: 'Gestion des disques', icon: 'gear' }] },
      { key: 'apps', label: 'Services et applications', icon: 'folder', expanded: true, children: [{ key: 'svc', label: 'Services', icon: 'gear' }] }] }],
    onSelect: (n, a) => {
      api = a;
      if (n.key === 'shares') {
        const lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom du partage', w: 160, icon: () => 'folder' }, { key: 'path', label: 'Chemin d’accès du dossier', w: 280 }, { key: 'type', label: 'Type', w: 80 }, { key: 'cl', label: '# connexions clientes', w: 140 }, { key: 'desc', label: 'Description', w: 220 }], rows: shares(), key: r => r.id });
        a.setMid(lv.el); a.status(shares().length + ' élément(s)');
      } else if (launch[n.key]) { a.setMid(h('div.pad', h('div', 'Ouverture de « ' + n.label + ' » dans sa propre console.'), h('div', { style: { marginTop: '10px' } }, UI.w.btn('Ouvrir', () => desk.open(launch[n.key]))))); a.status(''); }
      else if (n.key === 'disk') { a.setMid(h('div.pad.muted', 'Gestion des disques : non simulé dans cette version (le modèle ne décrit pas les volumes physiques).')); }
      else a.setMid(h('div.pad.muted', 'Sélectionnez un nœud de l’arborescence.'));
      a.setActions([{ title: n.label, items: [{ label: 'Actualiser', fn: () => a.refresh() }] }]);
    }, select: 'shares' });
    return win;
  }
});

/* ------------------------------------------------------------------ applications non simulées */
const NOT_SIM = { taskmgr: ['Gestionnaire des tâches', 'wrench'], devmgmt: ['Gestionnaire de périphériques', 'gear'], diskmgmt: ['Gestion des disques', 'gear'], msinfo: ['Informations système', 'info'], regedit: ['Éditeur du Registre', 'gear'], gpedit: ['Éditeur de stratégie de groupe locale', 'shield'], mmc: ['Console de gestion Microsoft', 'gear'], ise: ['Windows PowerShell ISE', 'terminal'] };
Object.keys(NOT_SIM).forEach(id => {
  UI.app(id, { title: NOT_SIM[id][0], icon: NOT_SIM[id][1], open: (desk) => { desk.msg({ title: NOT_SIM[id][0], icon: 'info', text: NOT_SIM[id][0] + ' n’est pas simulé dans cette version : aucun scénario n’en dépend. Utilisez les consoles et les commandes disponibles.' }); return null; } });
});

/* hook public : Propriétés système depuis l'invite (sysdm.cpl) ou le Panneau de configuration */
UI.sysProps = sysProps;
})(typeof globalThis !== 'undefined' ? globalThis : window);
