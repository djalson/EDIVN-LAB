/* ============================================================================
   Interface web du pare-feu — paquets Squid et squidGuard (TP Proxy) :
   System > Package Manager, Services > Squid Proxy Server (General, Local Cache, ACLs, Real Time),
   Services > SquidGuard Proxy Filter (General settings, Common ACL, Blacklist, Log),
   lignes squid / squidGuard dans Status > Services (redémarrage, arrêt, démarrage).
   Les réglages de Squid s'appliquent à l'enregistrement ; ceux de squidGuard sont mis en attente
   (Save) puis mis en service par « Apply » — le piège documenté dans la fiche de TP.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h, PW = UI.pfw, N = SIM.net, SQ = SIM.squid;
SIM.AVREG['pfsense-gui-squid'] = 'Interface web pfSense, paquet Squid : onglets (General, Remote Cache, Local Cache, Antivirus, ACLs, Traffic Mgmt, Authentication, Users, Real Time, Status, Sync), noms de fichiers (pkg_edit.php?xml=squid.xml, squid_nac.xml, squid_monitor.php), libellés des cases (Enable Squid Proxy, Proxy Interface(s), Allow Users on Interface, Transparent HTTP Proxy, HTTPS/SSL Interception, SSL/MITM Mode, Enable Access Logging) : repris de la fiche de TP quand elle les cite, le reste reconstitué ; valeurs par défaut du cache local et mise en page à vérifier.';
SIM.AVREG['pfsense-gui-squidguard'] = 'Interface web pfSense, paquet squidGuard : onglets (General settings, Common ACL, Groups ACL, Target categories, Times, Rewrites, Blacklist, Log, XMLRPC Sync), bouton Apply et ligne « SquidGuard service state: STARTED » (cités par la fiche de TP), cadre Target Rules List repliable avec le bouton +, libellé « Default access [all] », boutons Download et Blocked ; textes du journal de téléchargement reconstitués (sauf « Blacklist update complete »).';
SIM.AVREG['pfsense-gui-pkgmgr'] = 'Interface web pfSense, System > Package Manager : onglets Installed Packages / Available Packages, colonnes, avertissement « Package is configured but not (fully) installed or deprecated » (cité par la fiche de TP), icônes réinstaller/supprimer, journal d’installation (textes reconstitués), liste des paquets disponibles réduite à Squid et squidGuard.';
SIM.AVREG['pfsense-gui-squid-errs'] = 'Interface web pfSense, Squid > General : messages d’erreur à l’enregistrement (cache local non enregistré, AC absente pour l’interception SSL) reconstitués ; seule la contrainte est documentée par la fiche de TP.';

const PKGS = {
  squid: { pkg: 'pfSense-pkg-squid', ver: '0.4.46', cat: 'Network', desc: 'Proxy web avec cache (Squid) : relais, journalisation et filtrage des requêtes HTTP/HTTPS.' },
  squidGuard: { pkg: 'pfSense-pkg-squidGuard', ver: '1.16.19', cat: 'Network', desc: 'Filtre d’URL par catégories pour Squid (squidGuard).' }
};
SQ.PKGS = PKGS;

/* ------------------------------------------------------------------ utilitaires */
const lines = t => String(t || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const note = (P, text, secs, touch) => { P.desk.env.advance(secs === undefined ? 2 : secs); P.desk.env.touch(touch || 'pf-proxy'); P.desk.change('pfSense (' + (P.d.hostname || P.host) + ') : ' + text, { dev: P.host }); };
function multi(opts, sel) {
  const s = h('select.form-control', { multiple: true, size: Math.min(Math.max(opts.length, 2), 5) }, opts.map(o => h('option', { value: o.value, selected: sel.indexOf(o.value) >= 0 }, o.label)));
  return { el: s, get: () => Array.prototype.slice.call(s.selectedOptions).map(o => o.value) };
}
const ifOpts = d => Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
const pkgInstalled = (d, n) => !!SQ.pkg(d, n);
const tag = (ok, a, b) => h('span.pfw-tag.' + (ok ? 'ok' : 'ko'), ok ? a : b);

/* installation / réinstallation d'un paquet : le pare-feu doit joindre le dépôt par son WAN */
SQ.pkgInstall = function (W, d, name) {
  const p = PKGS[name]; const out = [];
  out.push('>>> Installing ' + p.pkg + '...', 'Updating pfSense-core repository catalogue...');
  const r = SQ.resolve(W, d, 'pkg.netgate.com');
  if (!r.ok) { out.push('pkg: Unable to resolve pkg.netgate.com', '>>> Installation of ' + p.pkg + ' failed: the firewall could not reach the package repository.'); return { ok: false, lines: out, why: 'résolution du dépôt' }; }
  const c = N.connect(W, d.id, r.ip, 'tcp', 443);
  if (c.state !== 'open') { out.push('pkg: Unable to connect to pkg.netgate.com (' + r.ip + ')', '>>> Installation of ' + p.pkg + ' failed: the firewall could not reach the package repository.'); return { ok: false, lines: out, why: 'connexion au dépôt (' + c.state + ')' }; }
  out.push('Fetching ' + p.pkg + '-' + p.ver + '.pkg: ... done', 'Installing ' + p.pkg + '-' + p.ver + '...', 'Extracting ' + p.pkg + '-' + p.ver + ': ... done', '>>> Success');
  d.packages = d.packages || []; const cur = SQ.pkg(d, name);
  if (cur) { cur.broken = false; cur.ver = p.ver; } else d.packages.push({ name, ver: p.ver, broken: false });
  if (name === 'squid' && !d.squid) d.squid = { enabled: false, stopped: false, port: 3128, ifaces: [], allowUsers: false, cacheSaved: false, transparent: false, transIfaces: [], ssl: { on: false, mode: 'splice', ifaces: [], port: 3129, ca: '' }, log: { access: false }, acl: { allowedSubnets: [], whitelist: [], blacklist: [] } };
  if (name === 'squidGuard' && !d.squidguard) { d.squidguard = { enabled: false, stopped: false, log: false, guiLog: false, blacklist: { on: false, url: '' }, acl: { cats: {}, default: 'deny' } }; d.sgdb = { loaded: false, count: 0 }; }
  return { ok: true, lines: out };
};

/* ================================================================== System > Package Manager */
const pkgTabs = (P, cur) => PW.tabs([{ key: 'inst', label: 'Installed Packages', go: () => P.go('pkg_mgr_installed.php') }, { key: 'avail', label: 'Available Packages', go: () => P.go('pkg_mgr.php') }], cur);
PW.page('pkg_mgr_installed.php', {
  crumbs: ['System', 'Package Manager', 'Installed Packages'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(pkgTabs(P, 'inst'));
    const rows = (d.packages || []).map(p => {
      const meta = PKGS[p.name] || { pkg: p.name, cat: '', desc: '' };
      return h('tr', h('td', meta.pkg, p.broken ? h('div', { style: { color: '#b94a48', fontSize: '12px' } }, 'Package is configured but not (fully) installed or deprecated') : null), h('td', meta.cat), h('td', p.ver), h('td', meta.desc), h('td.act',
        h('a', { title: 'Reinstall Package', on: { click: e => { e.preventDefault(); P.go('pkg_mgr_install.php', { mode: 'reinstallpkg', pkg: p.name }); } } }, PW.ic('refresh')),
        h('a', { title: 'Remove Package', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you want to remove ' + meta.pkg + '?', () => { d.packages = d.packages.filter(x => x.name !== p.name); note(P, 'Package Manager — ' + meta.pkg + ' supprimé', 3, 'pf-pkg'); P.setFlash('success', 'Package ' + meta.pkg + ' was removed.'); P.go('pkg_mgr_installed.php'); }, 'Remove'); } } }, PW.ic('del'))));
    });
    root.append(PW.panel('Installed Packages', rows.length ? PW.table(['Name', 'Category', 'Version', 'Description', 'Actions'], rows) : h('div', { style: { padding: '10px' } }, 'There are no packages currently installed.'), { flush: true }));
    return root;
  }
});
PW.page('pkg_mgr.php', {
  crumbs: ['System', 'Package Manager', 'Available Packages'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(pkgTabs(P, 'avail'));
    const rows = Object.keys(PKGS).map(n => { const p = PKGS[n]; const inst = pkgInstalled(d, n); return h('tr', h('td', p.pkg), h('td', p.cat), h('td', p.ver), h('td', p.desc), h('td.act', inst ? h('span.pfw-help', 'Installed') : PW.btn([PW.ic('up'), ' Install'], 'success', () => P.go('pkg_mgr_install.php', { mode: 'installpkg', pkg: n }), { sm: true }))); });
    root.append(PW.panel('Available Packages', PW.table(['Name', 'Category', 'Version', 'Description', 'Actions'], rows), { flush: true }));
    return root;
  }
});
PW.page('pkg_mgr_install.php', {
  crumbs: ['System', 'Package Manager', 'Package Installer'],
  render: P => {
    const d = P.d; const name = P.q.pkg; const meta = PKGS[name]; if (!meta) return PW.alert('danger', 'Unknown package.');
    const root = h('div'); const re = P.q.mode === 'reinstallpkg';
    P.desk.env.advance(20);
    const r = SQ.pkgInstall(P.W, d, name);
    note(P, 'Package Manager — ' + (re ? 'réinstallation de ' : 'installation de ') + meta.pkg + (r.ok ? ' réussie' : ' en échec (' + r.why + ')'), 5, 'pf-pkg');
    root.append(PW.panel('Package Installation', h('pre.pfw-log', r.lines.join('\n'))));
    root.append(r.ok ? PW.alert('success', meta.pkg + ' installation completed.') : PW.alert('danger', 'Package installation failed.'));
    return root;
  }
});

/* ================================================================== Services > Squid Proxy Server */
const squidTabs = (P, cur) => PW.tabs([
  ['general', 'General', 'squid.xml'], ['remote', 'Remote Cache', 'squid_upstream.xml'], ['cache', 'Local Cache', 'squid_cache.xml'], ['av', 'Antivirus', 'squid_antivirus.xml'],
  ['acl', 'ACLs', 'squid_nac.xml'], ['traffic', 'Traffic Mgmt', 'squid_traffic.xml'], ['auth', 'Authentication', 'squid_auth.xml'], ['users', 'Users', 'squid_users.xml']
].map(t => ({ key: t[0], label: t[1], go: () => P.go('pkg_edit.php', { xml: t[2] }) })).concat([{ key: 'rt', label: 'Real Time', go: () => P.go('squid_monitor.php') }, { key: 'status', label: 'Status', go: () => P.go('pkg_edit.php', { xml: 'squid_status.xml' }) }, { key: 'sync', label: 'Sync', go: () => P.go('pkg_edit.php', { xml: 'squid_sync.xml' }) }]), cur);
const needPkg = (P, name) => pkgInstalled(P.d, name) ? null : PW.alert('danger', 'The package ' + PKGS[name].pkg + ' is not installed. Install it from System > Package Manager.');
const svcBanner = (P) => { const st = SQ.state(P.d); return st.run ? null : PW.alert('warning', 'Squid is not running (' + st.why + ').'); };

function squidGeneral(P) {
  const d = P.d; const q = d.squid; const root = h('div'); root.append(squidTabs(P, 'general'));
  const sb = svcBanner(P); if (sb) root.append(sb);
  const ifs = ifOpts(d); const pi = multi(ifs, q.ifaces || []); const ti = multi(ifs, q.transIfaces || []); const si = multi(ifs, (q.ssl && q.ssl.ifaces) || []);
  const cas = ((d.openvpn && d.openvpn.cas) || []).map(c => ({ value: c.name, label: c.name }));
  const form = PW.form(P, {
    title: 'Squid General Settings',
    fields: [
      { k: 'en', label: 'Enable Squid Proxy', type: 'check', text: 'Check to enable the Squid proxy.', value: !!q.enabled, help: 'Important: If unchecked, ALL Squid services will be disabled and stopped.' },
      { k: 'pi', label: 'Proxy Interface(s)', type: 'el', el: pi.el, get: pi.get, help: 'The interface(s) the proxy server will bind to. Use CTRL + click to select multiple interfaces.' },
      { k: 'port', label: 'Proxy Port', type: 'text', value: q.port, w: 80, help: 'This is the port the proxy server will listen on. Default: 3128' },
      { k: 'au', label: 'Allow Users on Interface', type: 'check', text: 'If checked, the users connected to the interface selected in "Proxy interface(s)" will be allowed to use the proxy.', value: !!q.allowUsers },
      { panel: 'Transparent Proxy Settings' },
      { k: 'tr', label: 'Transparent HTTP Proxy', type: 'check', text: 'Enable transparent mode to forward all requests for destination port 80 to the proxy server.', value: !!q.transparent },
      { k: 'ti', label: 'Transparent Proxy Interface(s)', type: 'el', el: ti.el, get: ti.get, help: 'The interface(s) the proxy server will transparently intercept requests on.', show: v => v.tr },
      { panel: 'SSL Man In the Middle Filtering' },
      { k: 'ssl', label: 'HTTPS/SSL Interception', type: 'check', text: 'Enable SSL filtering.', value: !!(q.ssl && q.ssl.on) },
      { k: 'mode', label: 'SSL/MITM Mode', type: 'select', options: [{ value: 'splice_wl_bump', label: 'Splice Whitelist, Bump Otherwise' }, { value: 'splice', label: 'Splice All' }], value: (q.ssl && q.ssl.mode === 'splice_wl_bump') ? 'splice_wl_bump' : 'splice', show: v => v.ssl },
      { k: 'si', label: 'SSL Intercept Interface(s)', type: 'el', el: si.el, get: si.get, help: 'The interface(s) the proxy server will intercept SSL requests on.', show: v => v.ssl },
      { k: 'sport', label: 'SSL Proxy Port', type: 'text', value: (q.ssl && q.ssl.port) || 3129, w: 80, show: v => v.ssl },
      { k: 'ca', label: 'CA', type: 'select', options: [{ value: '', label: '(none)' }].concat(cas), value: (q.ssl && q.ssl.ca) || '', show: v => v.ssl, help: 'Select a Certificate Authority to use when Squid needs to sign certificates.' },
      { panel: 'Logging Settings' },
      { k: 'log', label: 'Enable Access Logging', type: 'check', text: 'This will enable the access log.', value: !!(q.log && q.log.access) },
      { k: 'dir', label: 'Log Store Directory', type: 'text', value: '/var/squid/logs', readonly: true, show: v => v.log, help: 'The directory where the logs will be stored.' },
      { k: 'rot', label: 'Rotate Logs', type: 'text', value: '', w: 60, show: v => v.log, help: 'Defines how many days of logfiles will be kept. Rotation is disabled if left empty.' }
    ],
    save: v => {
      const errs = [];
      const port = parseInt(v.port, 10); if (!(port >= 1 && port <= 65535)) errs.push('A valid port number must be specified.');
      if (v.en && !q.cacheSaved) errs.push('The local cache settings have never been saved: open the Local Cache tab, then click Save, before enabling Squid.');
      if (v.en && !v.pi.length) errs.push('At least one proxy interface must be selected.');
      if (v.en && v.tr && !v.ti.length) errs.push('At least one transparent proxy interface must be selected.');
      if (v.en && v.ssl && !v.ca) errs.push('A certificate authority must be selected to enable HTTPS/SSL interception.');
      if (v.en && v.ssl && !v.si.length) errs.push('At least one SSL intercept interface must be selected.');
      if (errs.length) return errs;
      q.enabled = !!v.en; q.stopped = false; q.port = port; q.ifaces = v.pi; q.allowUsers = !!v.au; q.transparent = !!v.tr; q.transIfaces = v.tr ? v.ti : [];
      q.ssl = { on: !!v.ssl, mode: v.mode === 'splice' ? 'splice' : 'splice_wl_bump', ifaces: v.si, port: parseInt(v.sport, 10) || 3129, ca: v.ca };
      q.log = { access: !!v.log };
      SQ.restart(P.W, d);
      note(P, 'Squid — réglages généraux enregistrés (' + (q.enabled ? 'proxy activé' : 'proxy désactivé') + ')', 4, 'pf-squid');
      P.setFlash('success', 'The changes have been applied successfully.'); P.go('pkg_edit.php', { xml: 'squid.xml' }); return null;
    }
  });
  root.append(form.el); return root;
}
function squidCache(P) {
  const d = P.d; const q = d.squid; const root = h('div'); root.append(squidTabs(P, 'cache'));
  const c = q.cache || {};
  const form = PW.form(P, {
    title: 'Squid Cache General Settings',
    fields: [
      { k: 'hd', label: 'Hard Disk Cache Size', type: 'text', value: c.hd === undefined ? 100 : c.hd, w: 80, help: 'Amount of disk space (in megabytes) to use for cached objects.' },
      { k: 'sys', label: 'Hard Disk Cache System', type: 'select', options: ['ufs', 'aufs', 'diskd'], value: c.sys || 'ufs' },
      { k: 'l1', label: 'Level 1 Subdirectories', type: 'text', value: c.l1 === undefined ? 16 : c.l1, w: 60 },
      { k: 'mem', label: 'Memory Cache Size', type: 'text', value: c.mem === undefined ? 64 : c.mem, w: 80, help: 'Amount of physical RAM (in megabytes) to be used for negative caching and in-transit objects.' },
      { k: 'max', label: 'Maximum Object Size', type: 'text', value: c.max === undefined ? 4 : c.max, w: 80, help: 'Objects larger than this size (in megabytes) will not be saved on disk.' }
    ],
    save: v => {
      const errs = []; ['hd', 'l1', 'mem', 'max'].forEach(k => { if (!/^\d+$/.test(String(v[k]).trim())) errs.push('The value of "' + k + '" must be a positive number.'); });
      if (errs.length) return errs;
      q.cache = { hd: +v.hd, sys: v.sys, l1: +v.l1, mem: +v.mem, max: +v.max }; q.cacheSaved = true;
      note(P, 'Squid — cache local enregistré', 3, 'pf-squid');
      P.setFlash('success', 'The changes have been applied successfully.'); P.go('pkg_edit.php', { xml: 'squid_cache.xml' }); return null;
    }
  });
  root.append(form.el); return root;
}
function squidAcl(P) {
  const d = P.d; const q = d.squid; q.acl = q.acl || { allowedSubnets: [], whitelist: [], blacklist: [] }; const a = q.acl; const root = h('div'); root.append(squidTabs(P, 'acl'));
  const form = PW.form(P, {
    title: 'Squid Access Control',
    fields: [
      { k: 'sub', label: 'Allowed Subnets', type: 'textarea', rows: 4, value: (a.allowedSubnets || []).join('\n'), help: 'Enter each subnet on a new line that is allowed to use the proxy. Format: 192.168.1.0/24' },
      { k: 'wl', label: 'Whitelist', type: 'textarea', rows: 4, value: (a.whitelist || []).join('\n'), help: 'Enter each destination domain on a new line that can be accessed. Regular expressions are accepted. The whitelist takes precedence over the blacklist.' },
      { k: 'bl', label: 'Blacklist', type: 'textarea', rows: 6, value: (a.blacklist || []).join('\n'), help: 'Enter each destination domain on a new line that will be blocked (e.g. facebook.com). Entries are treated as regular expressions.' }
    ],
    save: v => {
      const errs = []; const sub = lines(v.sub);
      const okCidr = s => { try { const c = U.parseCidr(s.indexOf('/') < 0 ? s + '/32' : s); return !!c && U.isIP(c.net) && c.len >= 0 && c.len <= 32; } catch (e) { return false; } };
      sub.forEach(s => { if (!okCidr(s)) errs.push('"' + s + '" is not a valid subnet (expected format: 192.168.1.0/24).'); });
      if (errs.length) return errs;
      a.allowedSubnets = sub; a.whitelist = lines(v.wl); a.blacklist = lines(v.bl);
      note(P, 'Squid — listes d’accès enregistrées (sous-réseaux : ' + sub.length + ', liste blanche : ' + a.whitelist.length + ', liste noire : ' + a.blacklist.length + ')', 3, 'pf-squid');
      P.setFlash('success', 'The changes have been applied successfully.'); P.go('pkg_edit.php', { xml: 'squid_nac.xml' }); return null;
    }
  });
  root.append(form.el); return root;
}
PW.page('pkg_edit.php', {
  crumbs: P => {
    const x = P.q.xml || '';
    if (/^squid_?/.test(x) || x === 'squid.xml') return ['Services', 'Squid Proxy Server', { 'squid.xml': 'General', 'squid_cache.xml': 'Local Cache', 'squid_nac.xml': 'ACLs' }[x] || 'Settings'];
    if (/^squidguard/.test(x)) return ['Services', 'SquidGuard Proxy Filter', { 'squidguard.xml': 'General settings', 'squidguard_default.xml': 'Common ACL' }[x] || 'Settings'];
    return ['System', 'Package'];
  },
  render: P => {
    const x = P.q.xml || '';
    if (x === 'squid.xml' || x === 'squid_cache.xml' || x === 'squid_nac.xml') { const m = needPkg(P, 'squid'); if (m) return m; return x === 'squid.xml' ? squidGeneral(P) : x === 'squid_cache.xml' ? squidCache(P) : squidAcl(P); }
    if (x === 'squidguard.xml' || x === 'squidguard_default.xml') { const m = needPkg(P, 'squidGuard'); if (m) return m; return x === 'squidguard.xml' ? guardGeneral(P) : guardAcl(P); }
    const root = h('div'); if (/^squid_/.test(x)) root.append(squidTabs(P, 'x')); else if (/^squidguard/.test(x)) root.append(guardTabs(P, 'x'));
    root.append(PW.alert('info', h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, 'Page non simulée'), h('div', 'Cet onglet existe dans la vraie interface mais n’est pas reproduit : il n’intervient dans aucun scénario du référentiel (onglets utiles : General, Local Cache, ACLs, Real Time pour Squid ; General settings, Common ACL, Blacklist, Log pour squidGuard).')));
    return root;
  }
});
PW.page('squid_monitor.php', {
  crumbs: ['Services', 'Squid Proxy Server', 'Real Time'],
  render: P => {
    const d = P.d; const m = needPkg(P, 'squid'); if (m) return m; const root = h('div'); root.append(squidTabs(P, 'rt'));
    const sb = svcBanner(P); if (sb) root.append(sb);
    const log = (d._rt.squidLog || []).slice(-60).reverse();
    const rows = log.map(e => h('tr', h('td', PW.fmtTime(e.t)), h('td', e.ip), h('td', e.status), h('td', e.addr), h('td', e.dest)));
    root.append(PW.panel('Squid - Access Logs', rows.length ? PW.table(['Date', 'IP', 'Status', 'Address', 'Destination'], rows) : h('div', { style: { padding: '10px' } }, d.squid.log && d.squid.log.access ? 'No log entries.' : 'Access logging is not enabled: no entries are recorded.'), { flush: true }));
    const st = SQ.state(d); const cache = [];
    if (st.run) cache.push('ERROR: Error Pages Missing Language: fr', 'ERROR: Error Pages Missing Language: fr-fr'); else cache.push('FATAL: Squid is not running: ' + st.why);
    root.append(PW.panel('Squid - Cache Logs', h('pre.pfw-log', cache.join('\n'))));
    return root;
  }
});

/* ================================================================== Services > SquidGuard Proxy Filter */
const guardTabs = (P, cur) => PW.tabs([
  ['general', 'General settings', () => P.go('pkg_edit.php', { xml: 'squidguard.xml' })], ['acl', 'Common ACL', () => P.go('pkg_edit.php', { xml: 'squidguard_default.xml' })],
  ['groups', 'Groups ACL', () => P.go('pkg_edit.php', { xml: 'squidguard_acl.xml' })], ['dest', 'Target categories', () => P.go('pkg_edit.php', { xml: 'squidguard_dest.xml' })],
  ['times', 'Times', () => P.go('pkg_edit.php', { xml: 'squidguard_time.xml' })], ['rewr', 'Rewrites', () => P.go('pkg_edit.php', { xml: 'squidguard_rewr.xml' })],
  ['bl', 'Blacklist', () => P.go('squidguard_blacklist.php')], ['log', 'Log', () => P.go('squidguard_log.php')], ['sync', 'XMLRPC Sync', () => P.go('pkg_edit.php', { xml: 'squidguard_sync.xml' })]
].map(t => ({ key: t[0], label: t[1], go: t[2] })), cur);
const gd = P => P.sec('squidguard');

function guardGeneral(P) {
  const d = P.d; const s = gd(P); const root = h('div'); root.append(guardTabs(P, 'general'));
  const gs = SQ.guardState(d);
  root.append(h('div.pfw-btnrow', PW.btn('Apply', 'success', () => {
    P.apply(['squidguard'], 'squidGuard — configuration appliquée');
    P.setFlash('success', 'The changes have been applied successfully.'); P.go('pkg_edit.php', { xml: 'squidguard.xml' });
  }), h('span', { style: { marginLeft: '14px', fontWeight: 600 } }, 'SquidGuard service state: ', h('span', { style: { color: gs.run ? '#2e7d32' : '#b94a48' } }, gs.run ? 'STARTED' : 'STOPPED'))));
  if (P.dirty('squidguard')) root.append(PW.alert('warning', 'The squidGuard configuration has been changed but not applied. Press Apply to put the changes into service.'));
  const form = PW.form(P, {
    title: 'General Options',
    fields: [
      { k: 'en', label: 'Enable', type: 'check', text: 'Check this option to enable squidGuard.', value: !!s.enabled, help: 'Important: Please set up at least one category on the "Common ACL" tab and press "Apply" on this tab.' },
      { panel: 'Logging options' },
      { k: 'gl', label: 'Enable GUI log', type: 'check', text: 'Check this option to log the squidGuard GUI activity such as reloading the lists.', value: !!s.guiLog },
      { k: 'lg', label: 'Enable log', type: 'check', text: 'Check this option to log the squidGuard proxy filter activity.', value: !!s.log },
      { panel: 'Blacklist options' },
      { k: 'bl', label: 'Blacklist', type: 'check', text: 'Check this option to enable blacklist.', value: !!(s.blacklist && s.blacklist.on) },
      { k: 'url', label: 'Blacklist URL', type: 'text', value: (s.blacklist && s.blacklist.url) || '', w: 520, show: v => v.bl, help: 'Enter the URL of the blacklist archive (tar.gz).' }
    ],
    save: v => {
      const e = P.edit('squidguard'); e.enabled = !!v.en; e.guiLog = !!v.gl; e.log = !!v.lg; e.blacklist = { on: !!v.bl, url: v.url.trim() };
      note(P, 'squidGuard — réglages généraux enregistrés (en attente d’« Apply »)', 2, 'pf-sg');
      P.setFlash('success', 'The changes have been saved. Press Apply to put them into service.'); P.go('pkg_edit.php', { xml: 'squidguard.xml' }); return null;
    }
  });
  root.append(form.el); return root;
}
function guardAcl(P) {
  const d = P.d; const s = gd(P); const root = h('div'); root.append(guardTabs(P, 'acl'));
  const cats = s.acl.cats || {}; const selects = {}; let open = false;
  const acc = (v, withBlank) => { const sel = h('select.form-control.sm', (withBlank ? ['---', 'allow', 'deny', 'whitelist'] : ['allow', 'deny']).map(o => h('option', { value: o === '---' ? '' : o, selected: (o === '---' ? '' : o) === (v || '') }, o))); return sel; };
  const tbody = h('tbody'); SQ.CATS.forEach(c => { const sel = acc(cats[c], true); selects[c] = sel; tbody.append(h('tr', h('td', '[' + SQ.catName(c) + ']'), h('td', sel))); });
  const defSel = acc(s.acl.default || 'deny', false); tbody.append(h('tr', h('td', h('b', 'Default access [all]')), h('td', defSel)));
  const box = h('div', { style: { display: 'none' } }, h('table.pfw-table', h('thead', h('tr', h('th', 'Target Rules List'), h('th', 'access'))), tbody));
  const toggle = PW.btn('+', '', () => { open = !open; box.style.display = open ? '' : 'none'; toggle.textContent = open ? '−' : '+'; }, { sm: true });
  const chk = (v) => h('input', { type: 'checkbox', checked: !!v });
  const logC = chk(s.acl.log), safeC = chk(s.acl.safeSearch), noIp = chk(s.acl.noIp);
  root.append(PW.panel('Common Access Control List (ACL)', h('div',
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' } }, h('b', 'Target Rules List'), toggle), box,
    h('div.pfw-fg', h('label.pfw-lbl', 'Do not allow IP-Addresses in URL'), h('div.pfw-inp', h('label.pfw-chk', noIp, h('span', 'To make sure that people do not bypass the URL filter by simply using the IP-Addresses instead of the FQDN you can check this option.')))),
    h('div.pfw-fg', h('label.pfw-lbl', 'Use SafeSearch engine'), h('div.pfw-inp', h('label.pfw-chk', safeC, h('span', 'Enable the SafeSearch engine of squidGuard.')), h('span.pfw-help', 'Sans effet sur les sites en HTTPS : le proxy ne voit que le nom du site, pas la recherche.'))),
    h('div.pfw-fg', h('label.pfw-lbl', 'Log'), h('div.pfw-inp', h('label.pfw-chk', logC, h('span', 'Check this option to enable logging for this ACL.')))),
    h('div', { style: { marginTop: '6px', paddingLeft: '16.66%' } }, PW.btn('Save', 'primary', () => {
      const e = P.edit('squidguard'); e.acl = e.acl || { cats: {}, default: 'deny' }; e.acl.cats = {};
      SQ.CATS.forEach(c => { const v = selects[c].value; if (v) e.acl.cats[c] = v; });
      e.acl.default = defSel.value; e.acl.log = logC.checked; e.acl.safeSearch = safeC.checked; e.acl.noIp = noIp.checked;
      note(P, 'squidGuard — Common ACL enregistrée (en attente d’« Apply »)', 2, 'pf-sg');
      P.setFlash('success', 'The changes have been saved. Press Apply (General settings) to put them into service.'); P.go('pkg_edit.php', { xml: 'squidguard_default.xml' });
    })))));
  return root;
}
/* base de catégories : téléchargement depuis l'URL saisie, via le WAN du pare-feu */
SQ.sgDownload = function (W, d, url) {
  const out = ['Blacklist update starting...']; const m = String(url || '').match(/^http:\/\/([^\/]+)(\/.*)$/i);
  if (!m) { out.push('wget: invalid URL: ' + (url || '(empty)'), 'Blacklist update failed.'); return { ok: false, lines: out }; }
  const r = SQ.resolve(W, d, m[1]);
  if (!r.ok) { out.push('wget: unable to resolve host address \'' + m[1] + '\'', 'Blacklist update failed.'); return { ok: false, lines: out }; }
  const c = N.connect(W, d.id, r.ip, 'tcp', 80);
  if (c.state !== 'open') { out.push('wget: unable to connect to ' + m[1] + ' (' + r.ip + ':80)', 'Blacklist update failed.'); return { ok: false, lines: out }; }
  if (!/^\/blacklists\/download\/blacklists(_for_pfsense)?\.tar\.gz$/.test(m[2])) { out.push('wget: server returned error: HTTP/1.1 404 Not Found', 'Blacklist update failed.'); return { ok: false, lines: out }; }
  out.push('Downloading ' + m[2].split('/').pop() + ' ... done', 'Archive decompressed.', '69 categories found.', 'Rebuilding the squidGuard database...', 'Blacklist update complete.');
  d.sgdb = { loaded: true, count: 69 }; return { ok: true, lines: out };
};
PW.page('squidguard_blacklist.php', {
  crumbs: ['Services', 'SquidGuard Proxy Filter', 'Blacklist'],
  render: P => {
    const d = P.d; const m = needPkg(P, 'squidGuard'); if (m) return m; const s = gd(P); const root = h('div'); root.append(guardTabs(P, 'bl'));
    const logBox = h('div');
    const url = h('input.form-control', { type: 'text', value: (s.blacklist && s.blacklist.url) || '', spellcheck: false, style: { width: '520px' } });
    root.append(PW.panel('Blacklist update', h('div',
      h('div.pfw-fg', h('label.pfw-lbl', 'Blacklist URL'), h('div.pfw-inp', url, h('span.pfw-help', 'Enter the URL of the blacklist archive.'))),
      h('div', { style: { margin: '8px 0 8px 16.66%' } }, PW.btn('Download', 'primary', () => {
        P.desk.env.advance(90);
        const r = SQ.sgDownload(P.W, d, url.value.trim());
        note(P, 'squidGuard — téléchargement de la liste de catégories ' + (r.ok ? 'terminé' : 'en échec'), 3, 'pf-sg');
        UI.clear(logBox); logBox.append(PW.panel('Blacklist update log', h('pre.pfw-log', r.lines.join('\n'))));
      })), logBox)));
    root.append(PW.alert('info', 'Base actuelle : ' + (d.sgdb && d.sgdb.loaded ? d.sgdb.count + ' catégories chargées.' : 'aucune liste chargée.')));
    return root;
  }
});
PW.page('squidguard_log.php', {
  crumbs: ['Services', 'SquidGuard Proxy Filter', 'Log'],
  render: P => {
    const d = P.d; const m = needPkg(P, 'squidGuard'); if (m) return m; const root = h('div'); root.append(guardTabs(P, 'log'));
    const out = h('div'); const show = (which) => {
      UI.clear(out);
      const l = which === 'blocked' ? (d._rt.sgLog || []).slice(-80).reverse().map(SQ.sgLine) : [];
      out.append(PW.panel('squidGuard log (' + which + ')', h('pre.pfw-log', l.length ? l.join('\n') : 'No entries.')));
    };
    root.append(h('div.pfw-btnrow', PW.btn('Blocked', 'primary', () => show('blocked')), PW.btn('Access', '', () => show('access')), PW.btn('Error', '', () => show('error'))), out);
    return root;
  }
});

/* ------------------------------------------------------------------ Status > Services : lignes et actions */
PW.svcAction = function (P, svc, op) {
  const d = P.d;
  if (svc === 'squid') {
    if (op === 'restart') { d.squid.stopped = false; SQ.restart(P.W, d); } else if (op === 'stop') d.squid.stopped = true; else if (op === 'start') { d.squid.stopped = false; SQ.restart(P.W, d); }
  } else if (svc === 'squidGuard') {
    if (op === 'restart' || op === 'start') d.squidguard.stopped = false; else if (op === 'stop') d.squidguard.stopped = true;
  }
  note(P, 'Status > Services — ' + svc + ' : ' + ({ restart: 'redémarrage', stop: 'arrêt', start: 'démarrage' })[op], 3, 'pf-svc');
  P.setFlash('success', 'Service ' + svc + ' ' + ({ restart: 'restarted', stop: 'stopped', start: 'started' })[op] + ' successfully.'); P.go('status_services.php');
};
PW.extraServices = function (P) {
  const d = P.d; const out = [];
  if (SQ.pkg(d, 'squid')) out.push({ name: 'squid', desc: 'Squid Web Proxy Server', run: SQ.state(d).run, acts: SQ.state(d).run ? ['restart', 'stop'] : ['start'] });
  if (SQ.pkg(d, 'squidGuard')) out.push({ name: 'squidGuard', desc: 'SquidGuard Proxy Filter', run: SQ.guardState(d).run, acts: SQ.guardState(d).run ? ['restart', 'stop'] : ['start'] });
  if (SQ.pkg(d, 'squid')) { out.push({ name: 'c-icap', desc: 'ICAP Antivirus Service', run: false }); out.push({ name: 'clamd', desc: 'ClamAV Antivirus', run: false }); }
  return out;
};

/* ------------------------------------------------------------------ menu Services : entrées des paquets installés */
const baseMenus = PW.menus;
PW.menus = P => {
  const m = baseMenus(P); const sv = m.find(x => x.label === 'Services');
  if (sv) {
    const it = [];
    if (SQ.pkg(P.d, 'squid')) it.push({ label: 'Squid Proxy Server', file: 'pkg_edit.php', params: { xml: 'squid.xml' } });
    if (SQ.pkg(P.d, 'squidGuard')) it.push({ label: 'SquidGuard Proxy Filter', file: 'pkg_edit.php', params: { xml: 'squidguard.xml' } });
    if (it.length) { const i = sv.items.findIndex(x => x && x.label === 'SNMP'); sv.items.splice(i < 0 ? sv.items.length : i + 1, 0, ...it); }
  }
  return m;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
