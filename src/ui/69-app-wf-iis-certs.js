/* ============================================================================
   Pare-feu Windows Defender avec fonctions avancées de sécurité (wf.msc), Gestionnaire des services
   Internet (inetmgr) et Certificats de l'ordinateur local (certlm.msc). Ils agissent sur d.win.fw,
   d.win.iis et d.win.certs ; les effets (accès réseau, pages web, TLS) découlent du moteur.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, WIN = SIM.win, h = UI.h, W_ = E.win;
SIM.AVREG['wf-gui'] = 'Pare-feu Windows Defender avec fonctions avancées de sécurité : arborescence, colonnes (Nom, Groupe, Profil, Activé, Action…), menus, boîte de propriétés (Général / Protocoles et ports / Avancé), assistant « Nouvelle règle » (type Port) et « Propriétés du pare-feu » reconstitués de mémoire (version française).';
SIM.AVREG['wf-gui-limits'] = 'Pare-feu avancé : règles de programme, personnalisées, de sécurité de connexion, analyse, filtrage par profil/groupe et export non simulés ; règles sortantes listées sans création.';
SIM.AVREG['iis-gui'] = 'Gestionnaire IIS : arborescence (Pools d’applications, Sites), colonnes, boîte « Liaisons de sites », « Modifier la liaison de site », « Documents par défaut », « Certificats de serveur » reconstitués de mémoire (version française).';
SIM.AVREG['iis-gui-limits'] = 'Gestionnaire IIS : seules les fonctionnalités Certificats de serveur, Documents par défaut, Liaisons, Pools d’applications et démarrage/arrêt de site/serveur sont simulées (pas de Module, Authentification, Journalisation, etc.).';
SIM.AVREG['certlm-gui'] = 'Certificats (ordinateur local) : magasins Personnel et Autorités de certification racines de confiance, colonnes et assistant « Inscription de certificats » (renouvellement avec la même clé auprès de CA-FormaTech) simplifiés et reconstitués de mémoire.';
const lc = s => String(s).toLowerCase();
const pad = U.pad2;
const fmtDate = iso => { const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : '')); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); };
const needAdmin = (desk, owner) => { if (desk.isAdmin && !desk.isAdmin()) { desk.msg({ title: 'Accès refusé', icon: 'error', owner, text: 'Accès refusé.' }); return false; } return true; };

/* ------------------------------------------------------------------ Pare-feu Windows (wf.msc) */
const PROFTXT = { domain: 'Domaine', private: 'Privé', public: 'Public' };
const profCell = r => (r.profiles.length === 3 ? 'Tout' : r.profiles.map(p => PROFTXT[p]).join(', '));
UI.app('wf', {
  title: 'Pare-feu Windows Defender avec fonctions avancées de sécurité', icon: 'firewall', admin: true, single: true,
  open: (desk) => {
    const d = desk.d; let win, api; const fw = () => d.win.fw;
    const changed = (txt, o) => { desk.env.touch('fw'); desk.change(txt, Object.assign({ dev: desk.devId }, o || {})); refresh(); };
    const title = 'Pare-feu Windows Defender avec fonctions avancées de sécurité sur Ordinateur local';
    const roots = () => [{ key: 'root', label: 'Pare-feu Windows Defender avec fonctions avancées de sécurité - Ordinateur local', icon: 'firewall', expanded: true, children: [{ key: 'in', label: 'Règles de trafic entrant', icon: 'folder' }, { key: 'out', label: 'Règles de trafic sortant', icon: 'folder' }, { key: 'csr', label: 'Règles de sécurité de connexion', icon: 'folder' }, { key: 'mon', label: 'Analyse', icon: 'eye' }] }];
    const setEn = (r, on) => { r.enabled = on; changed('Pare-feu : règle « ' + r.name + ' » ' + (on ? 'activée' : 'désactivée')); };
    const delRule = r => UI.confirm(desk, win, { title: 'Pare-feu Windows Defender', text: 'Voulez-vous supprimer la règle « ' + r.name + ' » ?', onYes: () => { fw().rules = fw().rules.filter(x => x !== r); changed('Pare-feu : règle « ' + r.name + ' » supprimée'); } });
    const ruleProps = (r) => {
      const st = { en: r.enabled !== false, act: r.action, port: r.lport || '', prof: r.profiles.slice(), name: r.name }; let ps;
      const nm = UI.w.text(r.name, { w: 360, onchange: v => { st.name = v; ps.markDirty(); } }); const en = UI.w.check('Activé', st.en, v => { st.en = v; ps.markDirty(); });
      const general = h('div.pad', UI.w.field('Nom :', nm, { lw: 90 }), UI.w.field('Groupe :', h('span', r.group || ''), { lw: 90 }), h('div', { style: { margin: '8px 0' } }, en), UI.w.group('Action', UI.w.radio('act', 'Autoriser la connexion', st.act === 'allow', () => { st.act = 'allow'; ps.markDirty(); }), UI.w.radio('act', 'Bloquer la connexion', st.act === 'block', () => { st.act = 'block'; ps.markDirty(); })));
      const pt = UI.w.text(st.port, { w: 200, disabled: !(r.proto === 'TCP' || r.proto === 'UDP'), onchange: v => { st.port = v; ps.markDirty(); } });
      const ports = h('div.pad', UI.w.field('Type de protocole :', h('span', r.proto), { lw: 130 }), UI.w.field('Port local :', pt, { lw: 130 }), r.proto === 'ICMPv4' ? h('div.muted', 'Type ICMP : ' + (r.icmpType === 8 ? 'Demande d’écho (8)' : r.icmpType)) : null);
      const pcs = ['domain', 'private', 'public'].map(p => UI.w.check(PROFTXT[p], st.prof.indexOf(p) >= 0, v => { const i = st.prof.indexOf(p); if (v && i < 0) st.prof.push(p); if (!v && i >= 0) st.prof.splice(i, 1); ps.markDirty(); }));
      const adv = h('div.pad', UI.w.group('Profils', pcs));
      const save = () => {
        if (!needAdmin(desk, ps)) return false;
        if ((r.proto === 'TCP' || r.proto === 'UDP') && st.port.trim() && !/^(\d{1,5}(-\d{1,5})?)(,(\d{1,5}(-\d{1,5})?))*$/.test(st.port.trim())) { desk.msg({ title: 'Propriétés', icon: 'error', owner: ps, text: 'Le port spécifié n’est pas valide.' }); return false; }
        if (!st.prof.length) { desk.msg({ title: 'Propriétés', icon: 'error', owner: ps, text: 'Vous devez sélectionner au moins un profil.' }); return false; }
        const bef = JSON.stringify([r.name, r.enabled, r.action, r.lport, r.profiles]); r.name = st.name || r.name; r.enabled = st.en; r.action = st.act; if (r.proto === 'TCP' || r.proto === 'UDP') r.lport = st.port.trim(); r.profiles = ['domain', 'private', 'public'].filter(p => st.prof.indexOf(p) >= 0);
        if (bef !== JSON.stringify([r.name, r.enabled, r.action, r.lport, r.profiles])) changed('Pare-feu : règle « ' + r.name + ' » modifiée (' + (r.enabled ? 'activée' : 'désactivée') + ', ' + r.action + ', ' + r.proto + ' ' + (r.lport || '') + ')'); return true;
      };
      ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + r.name, icon: 'firewall', w: 520, h: 460, tabs: [{ label: 'Général', content: () => general }, { label: 'Protocoles et ports', content: () => ports }, { label: 'Avancé', content: () => adv }], onOk: save, onApply: save });
    };
    const newRule = (dir) => {
      if (!needAdmin(desk, win)) return; let page = 1; const st = { proto: 'TCP', port: '', act: 'allow', prof: ['domain', 'private', 'public'], name: '', desc: '' }; const host = h('div'); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } }); let dlg;
      const draw = () => {
        UI.clear(host);
        if (page === 1) host.append(h('div', { style: { fontWeight: 600, margin: '0 0 8px' } }, 'Type de règle'), h('div', 'Quel type de règle voulez-vous créer ?'), UI.w.radio('rt', 'Programme', false, () => { }, { disabled: true }), UI.w.radio('rt', 'Port', true, () => { }), UI.w.radio('rt', 'Prédéfinie', false, () => { }, { disabled: true }), UI.w.radio('rt', 'Personnalisée', false, () => { }, { disabled: true }));
        else if (page === 2) { const pt = UI.w.text(st.port, { w: 200, onchange: v => { st.port = v; } }); host.append(h('div', { style: { fontWeight: 600, margin: '0 0 8px' } }, 'Protocole et ports'), UI.w.radio('pr', 'TCP', st.proto === 'TCP', () => { st.proto = 'TCP'; }), UI.w.radio('pr', 'UDP', st.proto === 'UDP', () => { st.proto = 'UDP'; }), h('div', { style: { margin: '8px 0 4px' } }, 'Ports locaux spécifiques :'), pt, h('div.muted', 'Exemple : 80, 443, 5000-5010')); }
        else if (page === 3) host.append(h('div', { style: { fontWeight: 600, margin: '0 0 8px' } }, 'Action'), UI.w.radio('ac', 'Autoriser la connexion', st.act === 'allow', () => { st.act = 'allow'; }), UI.w.radio('ac', 'Autoriser la connexion si elle est sécurisée', false, () => { }, { disabled: true }), UI.w.radio('ac', 'Bloquer la connexion', st.act === 'block', () => { st.act = 'block'; }));
        else if (page === 4) host.append(h('div', { style: { fontWeight: 600, margin: '0 0 8px' } }, 'Profil'), ['domain', 'private', 'public'].map(p => UI.w.check(PROFTXT[p], st.prof.indexOf(p) >= 0, v => { const i = st.prof.indexOf(p); if (v && i < 0) st.prof.push(p); if (!v && i >= 0) st.prof.splice(i, 1); })));
        else host.append(h('div', { style: { fontWeight: 600, margin: '0 0 8px' } }, 'Nom'), UI.w.field('Nom :', UI.w.text(st.name, { w: 300, onchange: v => { st.name = v; } }), { lw: 110 }), UI.w.field('Description :', UI.w.text(st.desc, { w: 300, onchange: v => { st.desc = v; } }), { lw: 110 }));
        host.append(err);
      };
      draw();
      dlg = UI.dialog(desk, win, { title: 'Assistant Nouvelle règle de trafic ' + (dir === 'in' ? 'entrant' : 'sortant'), w: 560, h: 380, body: host, buttons: [{ label: '< Précédent', fn: () => { if (page > 1) { page--; draw(); dlg.bar.children[1].textContent = 'Suivant >'; } return false; } }, { label: 'Suivant >', def: true, fn: () => {
        err.textContent = '';
        if (page === 2 && !/^(\d{1,5}(-\d{1,5})?)(,\s*(\d{1,5}(-\d{1,5})?))*$/.test(st.port.trim())) { err.textContent = 'Entrez un ou plusieurs ports valides.'; return false; }
        if (page === 4 && !st.prof.length) { err.textContent = 'Sélectionnez au moins un profil.'; return false; }
        if (page < 5) { page++; draw(); if (page === 5) dlg.bar.children[1].textContent = 'Terminer'; return false; }
        if (!st.name.trim()) { err.textContent = 'Entrez un nom pour la règle.'; return false; }
        const id = 'user-' + st.proto.toLowerCase() + '-' + st.port.replace(/[^0-9-]/g, '_') + '-' + dir; fw().rules.push({ name: st.name.trim(), enabled: true, dir, action: st.act, profiles: ['domain', 'private', 'public'].filter(p => st.prof.indexOf(p) >= 0), proto: st.proto, lport: st.port.replace(/\s/g, ''), id, group: '' });
        changed('Pare-feu : règle « ' + st.name.trim() + ' » créée (' + st.proto + ' ' + st.port + ', ' + st.act + ')'); } }, { label: 'Annuler' }] });
    };
    const fwProps = () => {
      const mk = (p) => { const pr = fw().profiles[p]; const st = { en: pr.enabled !== false, di: pr.defIn, dout: pr.defOut };
        return h('div.pad', h('div', { style: { fontWeight: 600, margin: '0 0 6px' } }, 'Paramètres du profil ' + PROFTXT[p].toLowerCase()), UI.w.field('État du pare-feu :', UI.w.select([{ value: 'on', label: 'Activé (recommandé)' }, { value: 'off', label: 'Désactivé' }], st.en ? 'on' : 'off', v => { st.en = v === 'on'; ps.markDirty(); }), { lw: 150 }), UI.w.field('Connexions entrantes :', UI.w.select([{ value: 'block', label: 'Bloquer (par défaut)' }, { value: 'allow', label: 'Autoriser' }], st.di, v => { st.di = v; ps.markDirty(); }), { lw: 150 }), UI.w.field('Connexions sortantes :', UI.w.select([{ value: 'allow', label: 'Autoriser (par défaut)' }, { value: 'block', label: 'Bloquer' }], st.dout, v => { st.dout = v; ps.markDirty(); }), { lw: 150 }), Object.assign(h('i'), { _st: st, _p: p })); };
      const panes = ['domain', 'private', 'public'].map(mk);
      const save = () => { if (!needAdmin(desk, ps)) return false; panes.forEach(pn => { const m = pn.lastChild; const st = m._st, p = m._p, pr = fw().profiles[p]; if (pr.enabled !== st.en || pr.defIn !== st.di || pr.defOut !== st.dout) { pr.enabled = st.en; pr.defIn = st.di; pr.defOut = st.dout; changed('Pare-feu : profil ' + PROFTXT[p] + ' — ' + (st.en ? 'activé' : 'désactivé') + ', entrant ' + st.di + ', sortant ' + st.dout); } }); return true; };
      const ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de Pare-feu Windows Defender avec fonctions avancées de sécurité - Ordinateur local', icon: 'firewall', w: 520, h: 360, tabs: [{ label: 'Profil de domaine', content: () => panes[0] }, { label: 'Profil privé', content: () => panes[1] }, { label: 'Profil public', content: () => panes[2] }], onOk: save, onApply: save });
    };
    const rulesView = (dir) => {
      const rows = () => fw().rules.filter(r => r.dir === dir);
      const lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 280 }, { key: 'group', label: 'Groupe', w: 160 }, { key: 'prof', label: 'Profil', w: 112, fmt: profCell, sortVal: profCell }, { key: 'en', label: 'Activé', w: 66, fmt: r => (r.enabled !== false ? 'Oui' : 'Non'), sortVal: r => (r.enabled !== false ? 'Oui' : 'Non') }, { key: 'action', label: 'Action', w: 90, fmt: r => (r.action === 'allow' ? 'Autoriser' : 'Bloquer'), sortVal: r => r.action }, { key: 'ov', label: 'Remplacer', w: 80, fmt: () => 'Non' }, { key: 'prog', label: 'Programme', w: 100, fmt: () => 'Tout' }, { key: 'proto', label: 'Protocole', w: 90 }, { key: 'lport', label: 'Port local', w: 100, fmt: r => r.lport || 'Tout' }], rows: rows(), key: r => r.id || r.name, sort: { key: 'name' }, onOpen: r => ruleProps(r),
        onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: r.enabled !== false ? 'Désactiver la règle' : 'Activer la règle', fn: () => { if (needAdmin(desk, win)) setEn(r, r.enabled === false); } }, { label: 'Couper', disabled: true }, { label: 'Copier', disabled: true }, { label: 'Supprimer', fn: () => { if (needAdmin(desk, win)) delRule(r); } }, '-', { label: 'Propriétés', def: true, fn: () => ruleProps(r) }, '-', { label: 'Aide', disabled: true }]), onDelete: r => needAdmin(desk, win) && delRule(r), onRefresh: refresh, onSelect: r => api.setActions(acts(dir, r)) });
      return lv;
    };
    const acts = (dir, r) => {
      const sec = [{ title: dir === 'in' ? 'Règles de trafic entrant' : 'Règles de trafic sortant', items: [{ label: 'Nouvelle règle…', fn: () => newRule(dir) }, { label: 'Filtrer par profil', disabled: true }, { label: 'Actualiser', fn: refresh }, { label: 'Exporter la liste…', disabled: true }] }];
      if (r) sec.push({ title: r.name.length > 40 ? r.name.slice(0, 38) + '…' : r.name, items: [{ label: r.enabled !== false ? 'Désactiver la règle' : 'Activer la règle', fn: () => { if (needAdmin(desk, win)) setEn(r, r.enabled === false); } }, { label: 'Supprimer', fn: () => { if (needAdmin(desk, win)) delRule(r); } }, { label: 'Propriétés', fn: () => ruleProps(r) }] });
      return sec;
    };
    const show = (n) => {
      if (n.key === 'in' || n.key === 'out') { const lv = rulesView(n.key); api.setMid(lv.el); api.setActions(acts(n.key, null)); }
      else if (n.key === 'root') { const pr = fw().profiles; api.setMid(h('div.pad', h('div', { style: { fontWeight: 700, marginBottom: '8px' } }, 'Vue d’ensemble'), ['domain', 'private', 'public'].map(p => h('div', { style: { margin: '4px 0' } }, h('b', 'Profil ' + PROFTXT[p].toLowerCase() + ' : '), pr[p].enabled !== false ? 'Le Pare-feu Windows Defender est activé.' : 'Le Pare-feu Windows Defender est désactivé.')))); api.setActions([{ title: 'Pare-feu Windows Defender avec fonctions avancées de sécurité', items: [{ label: 'Propriétés', fn: fwProps }, { label: 'Actualiser', fn: refresh }] }]); }
      else { api.setMid(h('div.pad.muted', 'Aucun élément à afficher dans cette vue.')); api.setActions([{ title: n.label, items: [{ label: 'Actualiser', fn: refresh }] }]); }
    };
    function refresh() { const s = api.tree.selected(); if (s) show(s); }
    win = UI.w.mmc({ wm: desk.wm, title, icon: 'firewall', w: 1060, h: 580, menu: [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: [{ label: 'Propriétés', fn: fwProps }, { label: 'Actualiser', fn: refresh }] }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos', disabled: true }] }], roots: roots(), select: 'in', onSelect: (n, a) => { api = a; show(n); }, onRefresh: refresh, onTreeContext: n => (n.key === 'in' || n.key === 'out' ? [{ label: 'Nouvelle règle…', fn: () => newRule(n.key) }, '-', { label: 'Actualiser', fn: refresh }] : n.key === 'root' ? [{ label: 'Propriétés', fn: fwProps }] : []) });
    api = win.mmc; win.appId = 'wf'; desk.act('Ouverture du Pare-feu Windows Defender avec fonctions avancées de sécurité', { kind: 'ui' });
    return win;
  }
});

/* ------------------------------------------------------------------ IIS */
UI.app('iis', {
  title: 'Gestionnaire des services Internet (IIS)', icon: 'globe', admin: true, single: true,
  open: (desk) => {
    const d = desk.d; if (!d.win || !d.win.iis) { desk.msg({ title: 'Gestionnaire des services Internet (IIS)', icon: 'error', text: 'Le rôle serveur Web (IIS) n’est pas installé sur cet ordinateur.' }); return null; }
    let win, api; const iis = () => d.win.iis;
    const changed = (txt) => { desk.env.touch('iis'); desk.change(txt, { dev: desk.devId }); refresh(); };
    const host = d.name.toUpperCase(); const who = () => ((W_.sessionUser(d) || '') + '');
    const siteNode = s => ({ key: 's:' + s.id, label: s.name, icon: 'globe', site: s.id });
    const roots = () => [{ key: 'root', label: 'Page de démarrage', icon: 'home', expanded: true, children: [{ key: 'srv', label: host + ' (' + who() + ')', icon: 'server', expanded: true, children: [{ key: 'pools', label: 'Pools d’applications', icon: 'folder' }, { key: 'sites', label: 'Sites', icon: 'folder', expanded: true, children: iis().sites.map(siteNode) }] }] }];
    const bindTxt = b => (b.ip || '*') + ':' + b.port + ':' + (b.host || '') ;
    const certByCn = cn => (d.win.certs || []).find(c => c.cn === cn);
    const cnTxt = c => c.cn;
    const siteOf = id => iis().sites.find(s => s.id === id);
    const W3 = () => d.win.svc.W3SVC;
    const svcCtl = (verb) => {
      const sv = W3(); const wait = (t, f) => UI.w.progressDialog(desk.wm, win, 'Gestionnaire des services Internet (IIS)', t, 900, f);
      if (verb === 'start') { if (sv.start === 'disabled') { desk.msg({ title: 'Gestionnaire des services Internet (IIS)', icon: 'error', owner: win, text: 'Windows n’a pas pu démarrer le service Service de publication World Wide Web.\nErreur 1058 : Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.' }); return; } wait('Démarrage du service Web…', () => { WIN.setSvc(desk.W, d.id, 'W3SVC', 'running'); desk.env.advance(2); changed('IIS : service W3SVC démarré'); }); }
      else if (verb === 'stop') wait('Arrêt du service Web…', () => { WIN.setSvc(desk.W, d.id, 'W3SVC', 'stopped'); desk.env.advance(2); changed('IIS : service W3SVC arrêté'); });
      else wait('Redémarrage du service Web…', () => { WIN.setSvc(desk.W, d.id, 'W3SVC', 'stopped'); WIN.setSvc(desk.W, d.id, 'W3SVC', 'running'); desk.env.advance(3); changed('IIS : service W3SVC redémarré'); });
    };
    /* --- liaisons --- */
    const editBinding = (s, b, done) => {
      const proto = UI.w.select(['http', 'https'], b ? b.proto : 'http', v => { cert.disabled = v !== 'https'; }), ip = UI.w.select([{ value: '*', label: 'Toutes non attribuées' }], b ? (b.ip || '*') : '*', () => { }), port = UI.w.text(b ? b.port : '80', { w: 70 }), hn = UI.w.text(b ? (b.host || '') : '', { w: 260 });
      const certs = [{ value: '', label: 'Non sélectionné' }].concat((d.win.certs || []).map(c => ({ value: c.cn, label: cnTxt(c) }))); const cert = UI.w.select(certs, b && b.cert ? b.cert : '', () => { }, { disabled: !(b && b.proto === 'https') }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: b ? 'Modifier la liaison de site' : 'Ajouter une liaison de site', w: 480, h: 360, body: h('div', UI.w.field('Type :', proto, { lw: 140 }), UI.w.field('Adresse IP :', ip, { lw: 140 }), UI.w.field('Port :', port, { lw: 140 }), UI.w.field('Nom d’hôte :', hn, { lw: 140 }), UI.w.field('Certificat SSL :', cert, { lw: 140 }), err),
        buttons: [{ label: 'OK', def: true, fn: () => { const p = +port.value; if (!(p > 0 && p < 65536)) { err.textContent = 'Le port doit être compris entre 1 et 65535.'; return false; } if (proto.value === 'https' && !cert.value) { err.textContent = 'Un certificat SSL est requis pour une liaison https.'; return false; }
          const nb = { proto: proto.value, ip: ip.value, port: p, host: hn.value.trim() }; if (proto.value === 'https') nb.cert = cert.value;
          if (s.bindings.some(x => x !== b && x.proto === nb.proto && +x.port === nb.port && (x.host || '') === nb.host && x.ip === nb.ip)) { err.textContent = 'Une liaison identique existe déjà pour ce site.'; return false; }
          done(nb); } }, { label: 'Annuler' }] });
    };
    const bindingsDlg = (s) => {
      const lv = UI.w.listView({ columns: [{ key: 'proto', label: 'Type', w: 70 }, { key: 'host', label: 'Nom d’hôte', w: 150 }, { key: 'port', label: 'Port', w: 60 }, { key: 'ip', label: 'Adresse IP', w: 110, fmt: r => (r.ip === '*' ? '*' : r.ip) }, { key: 'info', label: 'Informations de liaison', w: 150, fmt: () => '' }], rows: s.bindings, key: r => r.proto + r.port + (r.host || '') }); lv.el.style.height = '180px';
      const refreshL = () => lv.setRows(s.bindings);
      UI.dialog(desk, win, { title: 'Liaisons de sites', w: 600, h: 400, body: h('div', lv.el, h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } }, UI.w.btn('Ajouter…', () => editBinding(s, null, nb => { s.bindings.push(nb); refreshL(); changed('IIS : liaison ' + nb.proto + ' ' + nb.ip + ':' + nb.port + ' ajoutée au site ' + s.name); })), UI.w.btn('Modifier…', () => { const r = lv.selected(); if (r) editBinding(s, r, nb => { const i = s.bindings.indexOf(r); s.bindings[i] = nb; refreshL(); changed('IIS : liaison du site ' + s.name + ' modifiée (' + nb.proto + ' ' + nb.ip + ':' + nb.port + (nb.cert ? ', certificat ' + nb.cert : '') + ')'); }); }), UI.w.btn('Supprimer', () => { const r = lv.selected(); if (r) UI.confirm(desk, win, { title: 'Gestionnaire des services Internet (IIS)', text: 'Voulez-vous supprimer la liaison de site sélectionnée ?', onYes: () => { s.bindings = s.bindings.filter(x => x !== r); refreshL(); changed('IIS : liaison supprimée du site ' + s.name); } }); }))), buttons: [{ label: 'Fermer' }] });
    };
    const docsView = (s) => {
      const lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 260, sort: false }, { key: 'type', label: 'Type d’entrée', w: 140, sort: false }], rows: (s.defaultDocs || []).map(n => ({ name: n, type: 'Local' })), key: r => r.name });
      const add = () => UI.prompt(desk, win, { title: 'Ajouter un document par défaut', label: 'Nom :', onOk: v => { v = v.trim(); if (!v) return 'Entrez un nom.'; if ((s.defaultDocs || []).indexOf(v) >= 0) return 'Cette entrée existe déjà.'; s.defaultDocs = s.defaultDocs || []; s.defaultDocs.push(v); changed('IIS : document par défaut « ' + v + ' » ajouté au site ' + s.name); } });
      const del = r => { s.defaultDocs = s.defaultDocs.filter(x => x !== r.name); changed('IIS : document par défaut « ' + r.name + ' » supprimé du site ' + s.name); };
      const mv = (r, dl) => { const a = s.defaultDocs, i = a.indexOf(r.name), j = i + dl; if (j < 0 || j >= a.length) return; const x = a.splice(i, 1)[0]; a.splice(j, 0, x); changed('IIS : ordre des documents par défaut modifié (' + s.name + ')'); };
      lv.el.addEventListener('contextmenu', e => { e.preventDefault(); const r = lv.selected(); UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Ajouter…', fn: add }, { label: 'Monter', disabled: !r, fn: () => r && mv(r, -1) }, { label: 'Descendre', disabled: !r, fn: () => r && mv(r, 1) }, { label: 'Supprimer', disabled: !r, fn: () => r && del(r) }]); });
      return { el: h('div', h('div.pad', { style: { fontWeight: 600 } }, 'Document par défaut'), h('div.pad', 'Utilisez cette fonctionnalité pour spécifier les fichiers par défaut à renvoyer lorsqu’un client ne demande pas un fichier spécifique. Définissez les fichiers par ordre de priorité.'), lv.el), acts: [{ title: 'Actions', items: [{ label: 'Ajouter…', fn: add }, { label: 'Monter', fn: () => { const r = lv.selected(); if (r) mv(r, -1); } }, { label: 'Descendre', fn: () => { const r = lv.selected(); if (r) mv(r, 1); } }, { label: 'Supprimer', fn: () => { const r = lv.selected(); if (r) del(r); } }] }] };
    };
    const certsView = () => {
      const lv = UI.w.listView({ columns: [{ key: 'cn', label: 'Nom', w: 200 }, { key: 'iss', label: 'Délivré à', w: 200, fmt: r => r.cn }, { key: 'by', label: 'Délivré par', w: 140, fmt: r => r.issuer }, { key: 'exp', label: 'Date d’expiration', w: 130, fmt: r => fmtDate(r.notAfter), sortVal: r => r.notAfter }, { key: 'hash', label: 'Type de magasin', w: 120, fmt: () => 'Personnel' }], rows: d.win.certs || [], key: r => r.cn });
      return { el: h('div', h('div.pad', { style: { fontWeight: 600 } }, 'Certificats de serveur'), h('div.pad', 'Utilisez cette fonctionnalité pour demander et gérer les certificats que le serveur Web peut utiliser avec les sites web configurés pour SSL.'), lv.el), acts: [{ title: 'Actions', items: [{ label: 'Importer…', disabled: true }, { label: 'Créer une demande de certificat…', disabled: true }, { label: 'Terminer la demande de certificat…', disabled: true }, { label: 'Créer un certificat de domaine…', disabled: true }, { label: 'Afficher', fn: () => { const r = lv.selected(); if (r) desk.msg({ title: 'Certificat', icon: 'cert', owner: win, text: 'Délivré à : ' + r.cn + '\nDélivré par : ' + r.issuer + '\nValide du ' + fmtDate(r.notBefore) + ' au ' + fmtDate(r.notAfter) + '\nNoms alternatifs : ' + (r.san || []).join(', ') }); } }] }] };
    };
    const tiles = (items) => h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', padding: '14px' } }, items.map(it => h('div', { style: { width: '120px', textAlign: 'center', cursor: 'default' }, on: { dblclick: it.fn } }, UI.icon(it.icon, 32), h('div', { style: { marginTop: '4px', fontSize: '12px' } }, it.label))));
    const browse = (s, b) => { const sch = b.proto; const hn = b.host || d.name.toLowerCase() + '.' + (d.win.domain || ''); const url = sch + '://' + hn + (((sch === 'http' && +b.port === 80) || (sch === 'https' && +b.port === 443)) ? '' : ':' + b.port) + '/'; if (UI.apps.browser) desk.open('browser', url); else desk.msg({ title: 'Gestionnaire des services Internet (IIS)', icon: 'info', owner: win, text: 'Le navigateur n’est pas disponible dans cette session.' }); };
    const siteState = (s, st) => { if (st === 'started') { s.state = 'started'; changed('IIS : site « ' + s.name + ' » démarré'); } else { s.state = 'stopped'; changed('IIS : site « ' + s.name + ' » arrêté'); } };
    const poolState = (p, st) => { p.state = st; changed('IIS : pool d’applications « ' + p.name + ' » ' + (st === 'started' ? 'démarré' : 'arrêté')); };
    const show = (n) => {
      let el, acts = [];
      if (n.key === 'pools') {
        const lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 200 }, { key: 'state', label: 'État', w: 90, fmt: r => (r.state === 'started' ? 'Démarré' : 'Arrêté') }, { key: 'runtime', label: 'Version du CLR .NET', w: 140, fmt: r => r.runtime }, { key: 'pipeline', label: 'Mode de pipeline géré', w: 170 }, { key: 'identity', label: 'Identité', w: 190 }, { key: 'apps', label: 'Applications', w: 100, fmt: r => String(iis().sites.filter(s => s.pool === r.name).length) }], rows: iis().appPools, key: r => r.name, onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Démarrer', disabled: r.state === 'started', fn: () => poolState(r, 'started') }, { label: 'Arrêter', disabled: r.state !== 'started', fn: () => poolState(r, 'stopped') }, { label: 'Recycler…', disabled: r.state !== 'started', fn: () => { desk.env.advance(1); changed('IIS : pool « ' + r.name + ' » recyclé'); } }, '-', { label: 'Actualiser', fn: refresh }]), onSelect: r => api.setActions([{ title: 'Pools d’applications', items: [{ label: 'Démarrer', disabled: !r || r.state === 'started', fn: () => r && poolState(r, 'started') }, { label: 'Arrêter', disabled: !r || r.state !== 'started', fn: () => r && poolState(r, 'stopped') }, { label: 'Recycler…', disabled: !r || r.state !== 'started', fn: () => { if (r) { desk.env.advance(1); changed('IIS : pool « ' + r.name + ' » recyclé'); } } }] }]) });
        el = h('div', h('div.pad', { style: { fontWeight: 600 } }, 'Pools d’applications'), lv.el); acts = [{ title: 'Pools d’applications', items: [{ label: 'Ajouter un pool d’applications…', disabled: true }, { label: 'Actualiser', fn: refresh }] }];
      } else if (n.key === 'sites') {
        const lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 180 }, { key: 'id', label: 'ID', w: 40 }, { key: 'state', label: 'État', w: 90, fmt: r => (r.state === 'started' ? 'Démarré (http)' : 'Arrêté (http)') }, { key: 'b', label: 'Liaison', w: 280, fmt: r => r.bindings.map(b => (b.host ? b.host + ' ' : '') + '*:' + b.port + ' (' + b.proto + ')').join(', ') }, { key: 'path', label: 'Chemin d’accès physique', w: 200 }], rows: iis().sites, key: r => r.id, onOpen: r => api.tree.select('s:' + r.id, true) });
        el = h('div', h('div.pad', { style: { fontWeight: 600 } }, 'Sites'), lv.el); acts = [{ title: 'Sites', items: [{ label: 'Ajouter un site web…', disabled: true }, { label: 'Actualiser', fn: refresh }] }];
      } else if (n.site) {
        const s = siteOf(n.site); const sub = n._view;
        const open = (v) => { const vv = v(s); api.setMid(vv.el); api.setActions(vv.acts.concat(siteActs(s))); };
        el = h('div', h('div.pad', { style: { fontWeight: 700 } }, 'Accueil ' + s.name), tiles([{ label: 'Documents par défaut', icon: 'file', fn: () => open(docsView) }])); acts = siteActs(s);
        void sub;
      } else if (n.key === 'srv') {
        el = h('div', h('div.pad', { style: { fontWeight: 700 } }, 'Accueil ' + host), tiles([{ label: 'Certificats de serveur', icon: 'cert', fn: () => { const v = certsView(); api.setMid(v.el); api.setActions(v.acts.concat(srvActs())); } }])); acts = srvActs();
      } else { el = h('div.pad.muted', 'Gestionnaire des services Internet (IIS) — sélectionnez un serveur dans le volet Connexions.'); acts = [{ title: 'Page de démarrage', items: [{ label: 'Actualiser', fn: refresh }] }]; }
      api.setMid(h('div', { style: { height: '100%', overflow: 'auto' } }, el)); api.setActions(acts);
    };
    const srvActs = () => [{ title: 'Gérer le serveur', items: [{ label: 'Redémarrer', disabled: W3().state !== 'running', fn: () => svcCtl('restart') }, { label: 'Démarrer', disabled: W3().state === 'running', fn: () => svcCtl('start') }, { label: 'Arrêter', disabled: W3().state !== 'running', fn: () => svcCtl('stop') }] }];
    const siteActs = (s) => [{ title: 'Gérer le site web', items: [{ label: 'Redémarrer', disabled: s.state !== 'started', fn: () => { s.state = 'stopped'; s.state = 'started'; desk.env.advance(1); changed('IIS : site « ' + s.name + ' » redémarré'); } }, { label: 'Démarrer', disabled: s.state === 'started', fn: () => siteState(s, 'started') }, { label: 'Arrêter', disabled: s.state !== 'started', fn: () => siteState(s, 'stopped') }] }, { title: 'Parcourir le site web', items: s.bindings.map(b => ({ label: 'Parcourir *:' + b.port + ' (' + b.proto + ')', fn: () => browse(s, b) })) }, { title: 'Modifier le site', items: [{ label: 'Liaisons…', fn: () => bindingsDlg(s) }, { label: 'Paramètres de base…', fn: () => basicDlg(s) }] }];
    const basicDlg = (s) => {
      const pool = UI.w.select(iis().appPools.map(p => p.name), s.pool, () => { }), path = UI.w.text(s.path, { w: 300 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: 'Modifier le site', w: 520, h: 280, body: h('div', UI.w.field('Nom du site :', h('span', s.name), { lw: 150 }), UI.w.field('Pool d’applications :', pool, { lw: 150 }), UI.w.field('Chemin d’accès physique :', path, { lw: 150 }), err), buttons: [{ label: 'OK', def: true, fn: () => { if (!path.value.trim()) { err.textContent = 'Entrez un chemin physique.'; return false; } if (pool.value !== s.pool || path.value.trim() !== s.path) { s.pool = pool.value; s.path = path.value.trim(); changed('IIS : paramètres de base du site « ' + s.name + ' » modifiés (pool ' + s.pool + ', chemin ' + s.path + ')'); } } }, { label: 'Annuler' }] });
    };
    function refresh() { api.tree.setRoots(roots()); const s = api.tree.selected(); if (s) show(s); }
    win = UI.w.mmc({ wm: desk.wm, title: 'Gestionnaire des services Internet (IIS)', icon: 'globe', w: 1000, h: 560, menu: [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: 'Aide', items: [{ label: 'À propos', disabled: true }] }], roots: roots(), select: 'srv', onSelect: (n, a) => { api = a; show(n); }, onRefresh: refresh });
    api = win.mmc; win.appId = 'iis'; desk.act('Ouverture du Gestionnaire des services Internet (IIS) sur ' + d.name, { kind: 'ui' });
    return win;
  }
});

/* ------------------------------------------------------------------ Certificats (ordinateur local) */
UI.app('certlm', {
  title: 'Certificats (ordinateur local)', icon: 'cert', admin: true, single: true,
  open: (desk) => {
    const d = desk.d; let win, api; d.win.certs = d.win.certs || [];
    const changed = (txt) => { desk.env.touch('cert'); desk.change(txt, { dev: desk.devId }); refresh(); };
    const roots = () => [{ key: 'root', label: 'Certificats (ordinateur local)', icon: 'cert', expanded: true, children: [{ key: 'my', label: 'Personnel', icon: 'folder', expanded: true, children: [{ key: 'my:certs', label: 'Certificats', icon: 'folder' }] }, { key: 'root:ca', label: 'Autorités de certification racines de confiance', icon: 'folder', children: [{ key: 'root:ca:certs', label: 'Certificats', icon: 'folder' }] }, { key: 'inter', label: 'Autorités de certification intermédiaires', icon: 'folder' }] }];
    const nowMs = () => desk.W.nowOf(desk.devId).getTime();
    const expired = c => Date.parse(c.notAfter + 'T23:59:59Z') < nowMs();
    const renew = (c) => {
      if (!needAdmin(desk, win)) return; if (!d.win.domain) { desk.msg({ title: 'Inscription de certificats', icon: 'error', owner: win, text: 'Aucune stratégie d’inscription de certificats n’est disponible : cet ordinateur n’est pas membre d’un domaine.' }); return; }
      let page = 1; const host = h('div'); let dlg; const draw = () => { UI.clear(host); if (page === 1) host.append(h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Avant de commencer'), h('div', 'L’assistant vous permet de renouveler le certificat « ' + c.cn + ' » avec la même clé auprès de l’autorité de certification d’entreprise ' + c.issuer + '.')); else if (page === 2) host.append(h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Demander des certificats'), UI.w.check('Serveur Web  —  État : Disponible', true), h('div.muted', { style: { marginTop: '8px' } }, 'Nom du sujet : CN=' + c.cn)); else host.append(h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Résultats de l’installation de certificats'), h('div', 'Les certificats suivants ont été inscrits et installés sur cet ordinateur.'), h('div', { style: { margin: '8px 0' } }, 'Serveur Web  —  État : Réussite')); };
      draw(); dlg = UI.dialog(desk, win, { title: 'Inscription de certificats', w: 540, h: 300, body: host, buttons: [{ label: 'Suivant', def: true, fn: () => { if (page < 3) { page++; draw(); if (page === 3) { const nb = new Date(nowMs()); const na = new Date(nowMs() + 2 * 365 * 86400000); c.notBefore = nb.toISOString().slice(0, 10); c.notAfter = na.toISOString().slice(0, 10); desk.env.advance(3); changed('Certificats : « ' + c.cn + ' » renouvelé (valide jusqu’au ' + c.notAfter + ')'); dlg.bar.children[0].textContent = 'Terminer'; } return false; } } }, { label: 'Annuler' }] });
    };
    const view = (n) => {
      if (n.key === 'my:certs') {
        const lv = UI.w.listView({ columns: [{ key: 'to', label: 'Délivré à', w: 220, fmt: r => r.cn, icon: () => 'cert' }, { key: 'by', label: 'Délivré par', w: 160, fmt: r => r.issuer }, { key: 'exp', label: 'Date d’expiration', w: 130, fmt: r => fmtDate(r.notAfter), sortVal: r => r.notAfter }, { key: 'roles', label: 'Rôles prévus', w: 220, fmt: () => 'Authentification du serveur' }, { key: 'fn', label: 'Nom convivial', w: 110, fmt: () => '<Aucun>' }, { key: 'st', label: 'État du certificat', w: 120, fmt: r => (expired(r) ? 'Expiré' : '') }], rows: d.win.certs, key: r => r.cn, onOpen: r => props(r), onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Ouvrir', fn: () => props(r) }, { label: 'Toutes les tâches', items: [{ label: 'Ouvrir', fn: () => props(r) }, { label: 'Demander un certificat avec la même clé…', disabled: true }, { label: 'Renouveler le certificat avec la même clé…', fn: () => renew(r) }, { label: 'Renouveler le certificat avec une nouvelle clé…', disabled: true }, { label: 'Exporter…', disabled: true }] }, '-', { label: 'Supprimer', disabled: true }, '-', { label: 'Propriétés', fn: () => props(r) }]), onSelect: r => api.setActions(acts(r)) });
        api.setMid(lv.el); api.setActions(acts(null));
      } else { api.setMid(UI.w.listView({ columns: [{ key: 'n', label: 'Délivré à', w: 300 }], rows: [], empty: 'Aucun élément à afficher dans cette vue.' }).el); api.setActions([{ title: n.label, items: [{ label: 'Actualiser', fn: refresh }] }]); }
    };
    const props = c => UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Certificat', icon: 'cert', w: 440, h: 420, tabs: [{ label: 'Général', content: () => h('div.pad', h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Informations sur le certificat'), expired(c) ? h('div', { style: { color: '#b00020', margin: '4px 0' } }, 'Ce certificat a expiré ou n’est pas encore valide.') : null, UI.w.field('Délivré à :', h('span', c.cn), { lw: 110 }), UI.w.field('Délivré par :', h('span', c.issuer), { lw: 110 }), UI.w.field('Valide du :', h('span', fmtDate(c.notBefore) + ' au ' + fmtDate(c.notAfter)), { lw: 110 })) }, { label: 'Détails', content: () => h('div.pad', UI.w.field('Noms alternatifs :', h('span', (c.san || []).join(', ')), { lw: 120 })) }], okOnly: true });
    const acts = (r) => { const s = [{ title: 'Certificats', items: [{ label: 'Actualiser', fn: refresh }] }]; if (r) s.push({ title: r.cn, items: [{ label: 'Ouvrir', fn: () => props(r) }, { label: 'Renouveler le certificat avec la même clé…', fn: () => renew(r) }] }); return s; };
    function refresh() { api.tree.setRoots(roots()); const s = api.tree.selected(); if (s) view(s); }
    win = UI.w.mmc({ wm: desk.wm, title: 'certlm - [Racine de la console\\Certificats (ordinateur local)]', icon: 'cert', w: 940, h: 520, menu: [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: [{ label: 'Actualiser', fn: refresh }] }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos', disabled: true }] }], roots: roots(), select: 'my:certs', onSelect: (n, a) => { api = a; view(n); }, onRefresh: refresh });
    api = win.mmc; win.appId = 'certlm'; desk.act('Ouverture de Certificats (ordinateur local) sur ' + d.name, { kind: 'ui' });
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
