/* ============================================================================
   Interface web du pare-feu (pfSense CE 2.7) — socle : session, barre de navigation, mise en page,
   formulaires, tableaux, « Apply Changes » (modifications mises en attente puis appliquées).
   Les pages s'enregistrent avec UI.pfw.page(fichier, { crumbs, render }). Le navigateur appelle
   UI.webKinds.pfsense ; l'URL (fichier + paramètres) détermine la page, comme dans la vraie interface.
   Les modifications d'objets de configuration (règles, alias, NAT, passerelles, routes, IPsec) sont d'abord
   écrites dans une copie de travail ; « Apply Changes » les recopie dans la configuration active — exactement le
   piège « j'ai enregistré mais pas appliqué » de la vraie interface.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, WEB = SIM.web, h = UI.h;
SIM.AVREG['pfsense-gui-menu'] = 'Interface web pfSense : composition des menus (System, Interfaces, Firewall, Services, VPN, Status, Diagnostics), noms de fichiers des pages (firewall_rules.php, vpn_ipsec.php, status_logs_filter.php…) et libellés des boutons/colonnes reconstitués de mémoire (pfSense CE 2.7) — à comparer à une capture de référence.';
SIM.AVREG['pfsense-gui-apply'] = 'Interface web pfSense : textes des bandeaux « The firewall rule configuration has been changed. The changes must be applied for them to take effect. » (règles, NAT, alias, routes statiques, passerelles, IPsec) et « The changes have been applied successfully. The firewall rules are now reloading in the background. » — formulations à vérifier.';
SIM.AVREG['pfsense-gui-login'] = 'Interface web pfSense : page de connexion (« Login to pfSense », « Username or Password incorrect ») — à vérifier.';
SIM.AVREG['pfsense-gui-look'] = 'Interface web pfSense : habillage (barre sombre, panneaux, boutons) recréé sans logo ni ressource graphique de l’éditeur ; couleurs approximatives.';

const PW = UI.pfw = { pages: {}, MENU: [] };
PW.page = (file, def) => { PW.pages[file] = def; };

/* ------------------------------------------------------------------ utilitaires */
const parseQ = qs => { const o = {}; String(qs || '').replace(/^\?/, '').split('&').filter(Boolean).forEach(kv => { const i = kv.indexOf('='); const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i)); o[k] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); }); return o; };
const toQs = p => { const k = Object.keys(p || {}).filter(x => p[x] !== undefined && p[x] !== null && p[x] !== ''); return k.length ? '?' + k.map(x => encodeURIComponent(x) + '=' + encodeURIComponent(p[x])).join('&') : ''; };
const cleanJson = x => JSON.stringify(x === undefined ? null : x, (k, v) => (k && k[0] === '_' ? undefined : v));
const cl = x => (x === undefined ? undefined : JSON.parse(cleanJson(x)));
PW.cl = cl;

/* icônes originales (tracés simples) */
const IC = {
  edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
  del: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  off: 'M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 1 1-11.41-5.41L6.17 5.17A9 9 0 1 0 17.83 5.17z',
  on: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  anchor: 'M17 15l1.55 1.55c-.96 1.69-3.33 3.04-5.55 3.37V11h3V9h-3V7.82C14.16 7.4 15 6.3 15 5c0-1.65-1.35-3-3-3S9 3.35 9 5c0 1.3.84 2.4 2 2.82V9H8v2h3v8.92c-2.22-.33-4.59-1.68-5.55-3.37L7 15l-4-3v3c0 3.88 4.92 7 9 7s9-3.12 9-7v-3l-4 3zM12 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z',
  pass: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
  block: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z',
  up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
  down: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z'
};
PW.ic = (n, cls) => { const s = h('span.pfw-ic' + (cls ? '.' + cls : '')); s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + IC[n] + '"/></svg>'; return s; };

PW.btn = (label, kind, fn, o) => h('button.btn' + (kind ? '.btn-' + kind : '') + (o && o.sm ? '.btn-sm' : ''), { type: 'button', disabled: !!(o && o.disabled), on: { click: fn } }, label);
PW.alert = (kind, ...kids) => h('div.pfw-alert.' + kind, kids);
PW.panel = (title, body, o) => h('div.pfw-panel', h('div.pfw-ph', h('h2', title)), h('div.pfw-pb' + (o && o.flush ? '.flush' : ''), body));
PW.table = (cols, rows, o) => h('table.pfw-table', h('thead', h('tr', cols.map(c => h('th', c)))), h('tbody', rows));
PW.tabs = (items, cur) => h('div.pfw-tabs', items.map(t => h('a' + (t.key === cur ? '.on' : ''), { on: { click: e => { e.preventDefault(); t.go(); } } }, t.label)));

/* boîte modale de confirmation (équivalent de la boîte de dialogue JavaScript de l'interface) */
PW.confirm = (P, text, onYes, yesLabel) => {
  const bg = h('div.pfw-modal-bg'); const close = () => bg.remove();
  bg.append(h('div.pfw-modal', h('div.mh', 'Confirmation Required'), h('div.mb', text), h('div.mf', PW.btn('Cancel', '', close), PW.btn(yesLabel || 'Confirm', 'primary', () => { close(); onYes(); }))));
  P.root.append(bg);
};

/* ------------------------------------------------------------------ formulaire */
/* spec : { fields:[{k,label,type,value,options,text,help,show(vals),w,ph, panel:'Titre' | sep}], save(vals)→erreurs[]|undefined, saveLabel, buttons:[] } */
PW.form = function (P, spec) {
  const vals = {}; const reads = {}; const rowEls = []; const root = h('div'); const errBox = h('div');
  let panels = []; let cur = null; const startPanel = (t) => { cur = { title: t, body: h('div.pfw-pb') }; panels.push(cur); };
  startPanel(spec.title || '');
  const collect = () => { for (const k of Object.keys(reads)) vals[k] = reads[k](); };
  const sync = () => { collect(); rowEls.forEach(r => { const vis = !r.f.show || r.f.show(vals); r.el.style.display = vis ? '' : 'none'; }); };
  (spec.fields || []).forEach(f => {
    if (f.panel) { startPanel(f.panel); return; }
    let inp, ev = 'input';
    switch (f.type || 'text') {
      case 'text': case 'password': inp = h('input.form-control', { type: f.type === 'password' ? 'password' : 'text', value: f.value === undefined || f.value === null ? '' : String(f.value), spellcheck: false, placeholder: f.ph || '', readOnly: !!f.readonly }); if (f.w) inp.style.width = f.w + 'px'; reads[f.k] = () => inp.value; break;
      case 'textarea': inp = h('textarea.form-control', { rows: f.rows || 4, spellcheck: false }); inp.value = f.value || ''; reads[f.k] = () => inp.value; break;
      case 'select': ev = 'change'; inp = h('select.form-control', f.options.map(o => { const v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o; return h('option', { value: v, selected: String(v) === String(f.value) }, l); })); if (f.w) { inp.style.width = f.w + 'px'; } reads[f.k] = () => inp.value; break;
      case 'check': ev = 'change'; { const c = h('input', { type: 'checkbox', checked: !!f.value }); inp = h('label.pfw-chk', c, h('span', f.text || '')); reads[f.k] = () => c.checked; inp = Object.assign(inp, {}); inp._c = c; } break;
      case 'static': inp = h('div.pfw-static', f.value === undefined ? '' : f.value); reads[f.k] = () => f.value; break;
      case 'el': inp = f.el; reads[f.k] = f.get; break;
    }
    const target = inp._c || inp; if (ev && f.type !== 'static') target.addEventListener(ev, sync);
    if (f.type === 'select') inp.addEventListener('input', sync);
    const row = h('div.pfw-fg', h('label.pfw-lbl', f.label || ''), h('div.pfw-inp', inp, f.help ? h('span.pfw-help', f.help) : null));
    rowEls.push({ f, el: row }); cur.body.append(row); f._inp = inp; f._row = row;
  });
  const btns = h('div', { style: { marginTop: '6px', paddingLeft: '16.66%' } });
  btns.append(PW.btn(spec.saveLabel || 'Save', 'primary', () => {
    collect();
    const errs = spec.save ? spec.save(vals) : null;
    UI.clear(errBox);
    if (errs && errs.length) { errBox.append(PW.alert('danger', h('div', 'The following input errors were detected:'), h('ul', errs.map(e => h('li', e))))); P.root.scrollIntoView && errBox.scrollIntoView({ block: 'nearest' }); }
  }));
  (spec.buttons || []).forEach(b => btns.append(PW.btn(b.label, b.kind || '', () => { collect(); b.fn(vals); })));
  cur.body.append(btns);
  root.append(errBox); panels.forEach(p => root.append(h('div.pfw-panel', p.title ? h('div.pfw-ph', h('h2', p.title)) : null, p.body)));
  sync();
  return { el: root, vals, sync, collect, fields: spec.fields };
};

/* ------------------------------------------------------------------ mise à jour des copies de travail */
function mkCtx(content, ctx) {
  const { desk, host, url } = ctx; const W = desk.W; const d = W.d(host);
  const pu = WEB.parseUrl(url) || { scheme: 'https', host, port: 443, path: '/', query: '' };
  const base = pu.scheme + '://' + pu.host + (((pu.scheme === 'https' && pu.port === 443) || (pu.scheme === 'http' && pu.port === 80)) ? '' : ':' + pu.port);
  const file = (pu.path || '/').replace(/^\//, '').split('?')[0] || 'index.php';
  const q = parseQ(pu.query || '');
  const P = { desk, W, d, host, base, file, q, ctx, root: h('div.pfw'), flash: null };
  P.sessions = () => { desk._pfSess = desk._pfSess || {}; return desk._pfSess; };
  P.user = () => (P.sessions()[host] || {}).user || null;
  P.go = (f, params) => ctx.navigate(base + '/' + f + toQs(params));
  P.fl = P.sessions()[host] || {};
  /* copies de travail */
  P.rt = () => { d._rt.pfStage = d._rt.pfStage || {}; return d._rt.pfStage; };
  P.sec = name => { const s = P.rt()[name]; const live = d[name]; if (s && s.base !== cleanJson(live)) { delete P.rt()[name]; return live; } return s ? s.data : live; };
  P.edit = name => { const rt = P.rt(); const live = d[name]; if (rt[name] && rt[name].base !== cleanJson(live)) delete rt[name]; if (!rt[name]) rt[name] = { base: cleanJson(live), data: cl(live) }; return rt[name].data; };
  P.dirty = name => { const s = P.rt()[name]; return !!s && s.base === cleanJson(d[name]); };
  P.discard = name => { delete P.rt()[name]; };
  P.apply = (names, text) => {
    names.forEach(n => { const s = P.rt()[n]; if (s && s.base === cleanJson(d[n])) d[n] = s.data; delete P.rt()[n]; });
    desk.env.advance(3); desk.env.touch('pf-apply'); desk.change('pfSense (' + (d.hostname || host) + ') : ' + text, { dev: host });
  };
  P.setFlash = (kind, text) => { const m = P.sessions()[host]; if (m) m.flash = { kind, text }; };
  return P;
}
PW.mkCtx = mkCtx;

/* bandeau « Apply Changes » */
PW.applyBar = (P, secs, what, label) => {
  const dirty = secs.filter(s => P.dirty(s)); if (!dirty.length) return document.createDocumentFragment();
  const msg = {
    rules: 'The firewall rule configuration has been changed.', nat: 'The NAT configuration has been changed.', aliases: 'The alias configuration has been changed.',
    routes: 'The static route configuration has been changed.', gateways: 'The gateway configuration has been changed.', ipsec: 'The IPsec tunnel configuration has been changed.', ifaces: 'The interface configuration has been changed.'
  }[dirty[0]] || 'The configuration has been changed.';
  return PW.alert('warning', h('span', msg + ' ' + 'The changes must be applied for them to take effect.'), PW.btn('Apply Changes', 'success', () => {
    P.apply(dirty, (label || what || 'Apply Changes') + ' appliqué'); P.setFlash('success', dirty.indexOf('rules') >= 0 || dirty.indexOf('nat') >= 0 || dirty.indexOf('aliases') >= 0 ? 'The changes have been applied successfully. The firewall rules are now reloading in the background.' : 'The changes have been applied successfully.'); P.go(P.file, P.q);
  }));
};

/* ------------------------------------------------------------------ menus */
const A = (label, file, params) => ({ label, file, params });
PW.menus = P => {
  const d = P.d; const ifs = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual);
  return [
    { label: 'System', items: [A('Advanced', 'system_advanced_admin.php'), A('Cert. Manager', 'system_camanager.php'), A('General Setup', 'system.php'), A('High Avail. Sync', 'system_hasync.php'), A('Package Manager', 'pkg_mgr_installed.php'), A('Routing', 'system_gateways.php'), A('Setup Wizard', 'wizard.php', { xml: 'setup_wizard.xml' }), A('Update', 'pkg_mgr_install.php', { id: 'firmware' }), A('User Manager', 'system_usermanager.php')] },
    { label: 'Interfaces', items: [A('Assignments', 'interfaces_assign.php'), A('VLANs', 'interfaces_vlan.php'), null].concat(ifs.map(k => A(d.ifaces[k].name || k.toUpperCase(), 'interfaces.php', { if: k }))) },
    { label: 'Firewall', items: [A('Aliases', 'firewall_aliases.php'), A('NAT', 'firewall_nat.php'), A('Rules', 'firewall_rules.php'), A('Schedules', 'firewall_schedule.php'), A('Traffic Shaper', 'firewall_shaper.php'), A('Virtual IPs', 'firewall_virtual_ip.php')] },
    { label: 'Services', items: [A('Captive Portal', 'services_captiveportal.php'), A('DHCP Relay', 'services_dhcp_relay.php'), A('DHCP Server', 'services_dhcp.php'), A('DNS Forwarder', 'services_dnsmasq.php'), A('DNS Resolver', 'services_unbound.php'), A('Dynamic DNS', 'services_dyndns.php'), A('NTP', 'services_ntpd.php'), A('SNMP', 'services_snmp.php'), A('Wake-on-LAN', 'services_wol.php')] },
    { label: 'VPN', items: [A('IPsec', 'vpn_ipsec.php'), A('L2TP', 'vpn_l2tp.php'), A('OpenVPN', 'vpn_openvpn_server.php')] },
    { label: 'Status', items: [A('CARP (failover)', 'carp_status.php'), A('Dashboard', 'index.php'), A('DHCP Leases', 'status_dhcp_leases.php'), A('Filter Reload', 'status_filter_reload.php'), A('Gateways', 'status_gateways.php'), A('Interfaces', 'status_interfaces.php'), A('IPsec', 'status_ipsec.php'), A('Monitoring', 'status_monitoring.php'), A('NTP', 'status_ntpd.php'), A('OpenVPN', 'status_openvpn.php'), A('Services', 'status_services.php'), A('System Logs', 'status_logs.php'), A('Traffic Graph', 'status_graph.php')] },
    { label: 'Diagnostics', items: [A('ARP Table', 'diag_arp.php'), A('Authentication', 'diag_authentication.php'), A('Backup & Restore', 'diag_backup.php'), A('Command Prompt', 'diag_command.php'), A('DNS Lookup', 'diag_dns.php'), A('Factory Defaults', 'diag_defaults.php'), A('Halt System', 'diag_halt.php'), A('Packet Capture', 'diag_packet_capture.php'), A('Ping', 'diag_ping.php'), A('Reboot', 'diag_reboot.php'), A('Routes', 'diag_routes.php'), A('States', 'diag_dump_states.php'), A('Test Port', 'diag_testport.php'), A('Traceroute', 'diag_traceroute.php')] }
  ];
};

function navbar(P) {
  const bar = h('div.pfw-nav', h('a.pfw-brand', { on: { click: e => { e.preventDefault(); P.go('index.php'); } } }, 'pf', h('i', 'Sense')));
  let openEl = null;
  PW.menus(P).forEach(m => {
    const dd = h('div.pfw-dd', m.items.map(it => it ? h('a', { on: { click: e => { e.preventDefault(); e.stopPropagation(); P.go(it.file, it.params); } } }, it.label) : h('hr')));
    if (m.label === 'System') dd.append(h('hr'), h('a', { on: { click: e => { e.preventDefault(); e.stopPropagation(); logout(P); } } }, 'Logout (' + P.user() + ')'));
    const mi = h('div.pfw-mi', { on: { click: e => { e.stopPropagation(); const was = mi.classList.contains('open'); if (openEl) openEl.classList.remove('open'); openEl = was ? null : mi; if (!was) mi.classList.add('open'); } } }, m.label, h('span.car'), dd);
    bar.append(mi);
  });
  bar.append(h('div.pfw-right', P.user() + '@' + (P.d.hostname || P.host)));
  P.root.addEventListener('click', () => { if (openEl) { openEl.classList.remove('open'); openEl = null; } });
  return bar;
}
function logout(P) { const s = P.sessions(); delete s[P.host]; P.go('index.php'); }

/* ------------------------------------------------------------------ connexion */
function loginPage(P) {
  const d = P.d; const user = h('input.form-control', { type: 'text', value: '', spellcheck: false, autocomplete: 'off' }); const pw = h('input.form-control', { type: 'password', value: '' }); const msg = h('div'); const vf = UI.vault.field({ user, pwd: pw, kinds: ['pf'] });
  const submit = () => {
    const u = user.value.trim(); const known = d.pwds && Object.prototype.hasOwnProperty.call(d.pwds, u);
    P.desk.env.advance(1);
    if (known && d.pwds[u] === pw.value) {
      vf.submit(); P.sessions()[P.host] = { user: u, flash: null }; P.desk.act('Interface web ' + (d.hostname || P.host) + ' : connexion en tant que ' + u, { kind: 'ui' });
      P.desk.env.obs('login:' + P.desk.devId + ':' + P.host, true); P.go(P.file === 'index.php' ? 'index.php' : P.file, P.q);
    } else { P.desk.env.obs('login:' + P.desk.devId + ':' + P.host, false); UI.clear(msg); msg.append(PW.alert('danger', 'Username or Password incorrect')); pw.value = ''; pw.focus(); }
  };
  const onEnter = e => { if (e.key === 'Enter') submit(); };
  user.addEventListener('keydown', onEnter); pw.addEventListener('keydown', onEnter);
  P.root.append(h('div.pfw-login', h('div.box', h('div.hd', 'Login to pfSense'), h('div.bd', msg, h('label', 'Username'), user, h('label', 'Password'), pw, PW.btn('SIGN IN', 'primary', submit))), vf.btn ? h('div.vfloat', vf.btn) : null));
  P.ctx.setTitle((d.hostname || P.host) + (d.domain ? '.' + d.domain : '') + ' - Login');
  setTimeout(() => user.focus(), 30);
}

/* ------------------------------------------------------------------ rendu d'une page */
UI.webKinds.pfsense = function (content, ctx) {
  UI.clear(content);
  const P = mkCtx(content, ctx);
  content.append(P.root);
  if (!P.user()) { loginPage(P); return; }
  const page = PW.pages[P.file];
  const crumbs = page ? (typeof page.crumbs === 'function' ? page.crumbs(P) : page.crumbs) : [labelOf(P)];
  P.root.append(navbar(P));
  const main = h('div.pfw-main'); P.root.append(main);
  main.append(h('div.pfw-crumb', crumbs.map(c => h('span', c))));
  const flash = P.fl && P.fl.flash; if (flash) { main.append(PW.alert(flash.kind, flash.text)); P.fl.flash = null; }
  let body;
  try { body = page ? page.render(P) : notSim(P); } catch (e) { console.error(e); body = PW.alert('danger', 'Erreur interne de la page : ' + e.message); }
  main.append(body);
  ctx.setTitle((P.d.hostname || P.host) + (P.d.domain ? '.' + P.d.domain : '') + ' - ' + crumbs.join(': '));
  P.desk.act('Interface web ' + (P.d.hostname || P.host) + ' : ' + crumbs.join(' > '), { kind: 'ui' });
};
function labelOf(P) { for (const m of PW.menus(P)) for (const it of m.items) if (it && it.file === P.file) return m.label + ' / ' + it.label; return P.file; }
function notSim(P) {
  return PW.alert('info', h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, 'Page non simulée'), h('div', 'La page « ' + labelOf(P) + ' » existe dans la vraie interface mais n’est pas reproduite dans ce simulateur : elle n’intervient dans aucun scénario du référentiel. Utilise les pages des menus Firewall, VPN, Status, System ou Diagnostics.'));
}

/* petits helpers de formatage partagés par les pages */
PW.fmtAddr = (spec, d) => {
  if (!spec || spec.t === 'any') return '*';
  const ifn = k => ((d.ifaces[k] || {}).name) || String(k).toUpperCase();
  let s;
  switch (spec.t) {
    case 'host': case 'net': s = spec.v; break;
    case 'alias': s = spec.v; break;
    case 'ifnet': s = ifn(spec.v) + ' subnets'; break;
    case 'ifaddr': s = ifn(spec.v) + ' address'; break;
    case 'self': s = 'This Firewall'; break;
    default: s = String(spec.v || '*');
  }
  return (spec.neg ? '! ' : '') + s;
};
PW.fmtProto = r => { const p = r.proto || 'any'; return p === 'any' ? 'IPv4 *' : p === 'tcp/udp' ? 'IPv4 TCP/UDP' : 'IPv4 ' + p.toUpperCase(); };
PW.ifLabel = (d, k) => (k === 'enc0' ? 'IPsec' : k === 'ovpns1' ? 'OpenVPN' : (d.ifaces[k] && d.ifaces[k].name) || String(k).toUpperCase());
PW.cidrParts = c => { const p = String(c).split('/'); return { addr: p[0], len: p[1] === undefined ? 32 : +p[1] }; };
PW.maskOpts = (from) => { const o = []; for (let i = 32; i >= 1; i--) o.push({ value: i, label: String(i) }); return o; };
PW.fmtTime = (ms) => { const dt = new Date(ms); const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return M[dt.getUTCMonth()] + ' ' + String(dt.getUTCDate()).padStart(2, ' ') + ' ' + U.pad2(dt.getUTCHours()) + ':' + U.pad2(dt.getUTCMinutes()) + ':' + U.pad2(dt.getUTCSeconds()); };

})(typeof globalThis !== 'undefined' ? globalThis : window);
