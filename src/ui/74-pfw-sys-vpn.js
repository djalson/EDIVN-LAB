/* ============================================================================
   Interface web du pare-feu — System (General Setup, Routing, Cert. Manager, User Manager),
   Interfaces, Services → DNS Resolver, VPN → IPsec / OpenVPN.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h, PW = UI.pfw;
SIM.AVREG['pfsense-gui-system'] = 'Interface web pfSense, System/Interfaces/Services : intitulés des pages General Setup, Routing (Gateways, Static Routes), Cert. Manager, User Manager, Interfaces, DNS Resolver, messages de validation (ex. passerelle hors du sous-réseau de l’interface) — à vérifier.';
SIM.AVREG['pfsense-gui-vpn'] = 'Interface web pfSense, VPN : intitulés des pages IPsec (Tunnels, Phase 1, Phase 2) et OpenVPN (Servers), listes d’algorithmes et de groupes DH, libellés de colonnes — à vérifier. Le tableau des serveurs OpenVPN omet la colonne « Crypto » (le modèle ne porte pas le chiffrement).';
SIM.AVREG['pfsense-gui-cert'] = 'Interface web pfSense, Cert. Manager : l’action « Renew or Reissue » est simplifiée (le certificat redevient valide côté serveur, sans régénération du fichier client) ; les dates de validité ne sont pas modélisées (étiquette Valid / Expired).';

/* ================================================================== General Setup */
PW.page('system.php', {
  crumbs: ['System', 'General Setup'],
  render: P => {
    const d = P.d; const dns = (d.dns && d.dns.servers) || [];
    const form = PW.form(P, {
      title: 'General Information',
      fields: [
        { k: 'hostname', label: 'Hostname', type: 'text', value: d.hostname || '', help: 'Name of the firewall host, without domain part.' },
        { k: 'domain', label: 'Domain', type: 'text', value: d.domain || '', help: 'Domain name for the firewall.' },
        { k: 'dns1', label: 'DNS Server 1', type: 'text', value: dns[0] || '' }, { k: 'dns2', label: 'DNS Server 2', type: 'text', value: dns[1] || '' },
        { k: 'dns3', label: 'DNS Server 3', type: 'text', value: dns[2] || '' }, { k: 'dns4', label: 'DNS Server 4', type: 'text', value: dns[3] || '' }
      ],
      save: v => {
        const errs = []; if (!/^[A-Za-z0-9-]+$/.test(v.hostname)) errs.push('The hostname can only contain the characters A-Z, 0-9 and \'-\'.');
        const list = [v.dns1, v.dns2, v.dns3, v.dns4].map(x => x.trim()).filter(Boolean); list.forEach(x => { if (!U.isIP(x)) errs.push('A valid IP address must be specified for DNS server ' + x + '.'); });
        if (errs.length) return errs;
        d.hostname = v.hostname; d.domain = v.domain.trim(); d.dns = d.dns || {}; d.dns.servers = list; P.desk.env.advance(2); P.desk.env.touch('pf-general'); P.desk.change('pfSense : System → General Setup (hostname, domaine, serveurs DNS)', { dev: P.host });
        P.setFlash('success', 'The changes have been applied successfully.'); P.go('system.php'); return null;
      }
    });
    return form.el;
  }
});

/* ================================================================== Routing */
const rtTabs = (P, cur) => PW.tabs([{ key: 'gw', label: 'Gateways', go: () => P.go('system_gateways.php') }, { key: 'rt', label: 'Static Routes', go: () => P.go('system_routes.php') }, { key: 'gg', label: 'Gateway Groups', go: () => P.go('system_gateway_groups.php') }], cur);
const gwCheck = (P, ip, ifk, ownName) => {
  const i = P.d.ifaces[ifk]; if (!i || !i.ip) return 'The selected interface has no IPv4 address configured.';
  if (!U.isIP(ip)) return 'A valid IPv4 gateway address must be specified.';
  if (!U.inNet(ip, i.ip, i.mask)) return 'The gateway address ' + ip + ' does not lie within one of the chosen interface\'s subnets.';
  if (ip === i.ip) return 'The gateway address cannot be the same as the interface address.';
  void ownName; return null;
};
PW.page('system_gateways.php', {
  crumbs: ['System', 'Routing', 'Gateways'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(PW.applyBar(P, ['gateways', 'routes'], 'Routing')); root.append(rtTabs(P, 'gw'));
    const gws = P.sec('gateways') || [];
    const rows = gws.map((gw, i) => h('tr', h('td', gw.name + (gw.default ? ' (default)' : '')), h('td', PW.ifLabel(d, gw.iface)), h('td', gw.ip), h('td', gw.ip), h('td', gw.descr || ''), h('td.act',
      h('a', { title: 'Edit gateway', on: { click: e => { e.preventDefault(); P.go('system_gateways_edit.php', { id: i }); } } }, PW.ic('edit')),
      h('a', { title: 'Delete gateway', on: { click: e => { e.preventDefault(); const used = (P.sec('routes') || []).some(r => r.nh === gw.ip); if (used) { P.setFlash('danger', 'Gateway ' + gw.name + ' cannot be deleted because it is in use by a static route.'); P.go('system_gateways.php'); return; } PW.confirm(P, 'Are you sure you want to delete this gateway?', () => { const arr = P.edit('gateways'); arr.splice(i, 1); P.go('system_gateways.php'); }); } } }, PW.ic('del')))));
    root.append(PW.panel('Gateways', PW.table(['Name', 'Interface', 'Gateway', 'Monitor IP', 'Description', 'Actions'], rows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('system_gateways_edit.php'))));
    return root;
  }
});
PW.page('system_gateways_edit.php', {
  crumbs: ['System', 'Routing', 'Gateways', 'Edit'],
  render: P => {
    const d = P.d; const gws = P.sec('gateways') || []; const idx = P.q.id !== undefined ? +P.q.id : -1;
    if (idx >= 0 && !gws[idx]) return PW.alert('danger', 'The gateway does not exist.');
    const g0 = idx >= 0 ? U.clone(gws[idx]) : { name: '', iface: 'wan', ip: '', default: false, descr: '' };
    const ifs = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
    const form = PW.form(P, {
      title: 'Edit Gateway',
      fields: [
        { k: 'iface', label: 'Interface', type: 'select', options: ifs, value: g0.iface, help: 'Choose which interface this gateway applies to.' },
        { k: 'af', label: 'Address Family', type: 'select', options: [{ value: 'inet', label: 'IPv4' }], value: 'inet' },
        { k: 'name', label: 'Name', type: 'text', value: g0.name, help: 'Gateway name' },
        { k: 'ip', label: 'Gateway', type: 'text', value: g0.ip, help: 'Gateway IP address' },
        { k: 'def', label: 'Default Gateway', type: 'check', text: 'This will select the above gateway as the default gateway', value: !!g0.default },
        { k: 'descr', label: 'Description', type: 'text', value: g0.descr || '', help: 'A description may be entered here for reference only. It is not parsed.' }
      ],
      save: v => {
        const errs = []; if (!/^[A-Za-z0-9_]+$/.test(v.name)) errs.push('The gateway name must not contain invalid characters.');
        if (gws.some((x, i) => x.name === v.name && i !== idx)) errs.push('The gateway name "' + v.name + '" already exists.');
        const e1 = gwCheck(P, v.ip.trim(), v.iface, g0.name); if (e1) errs.push(e1);
        if (errs.length) return errs;
        const arr = P.edit('gateways'); const ng = { name: v.name, iface: v.iface, ip: v.ip.trim(), descr: v.descr };
        if (v.def) ng.default = true; if (!v.def && v.iface !== 'wan') ng.lanGw = true;
        if (v.def) arr.forEach(x => { if (x !== arr[idx]) delete x.default; });
        if (idx >= 0) {
          const old = arr[idx]; arr[idx] = ng;
          if (old.ip !== ng.ip) { const rts = P.edit('routes'); rts.forEach(r => { if (r.nh === old.ip) r.nh = ng.ip; }); }
        } else arr.push(ng);
        P.go('system_gateways.php'); return null;
      }
    });
    return form.el;
  }
});
PW.page('system_gateway_groups.php', { crumbs: ['System', 'Routing', 'Gateway Groups'], render: P => { const root = h('div'); root.append(rtTabs(P, 'gg')); root.append(PW.alert('info', 'No gateway groups have been defined.')); return root; } });

const maskLenOf = r => U.mask2len(r.mask);
PW.page('system_routes.php', {
  crumbs: ['System', 'Routing', 'Static Routes'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(PW.applyBar(P, ['gateways', 'routes'], 'Routing')); root.append(rtTabs(P, 'rt'));
    const rts = P.sec('routes') || []; const gws = P.sec('gateways') || [];
    const rows = rts.map((r, i) => { const gw = gws.find(x => x.ip === r.nh); return h('tr' + (r.disabled ? '.off' : ''), h('td', r.net + '/' + maskLenOf(r)), h('td', gw ? gw.name + ' - ' + gw.ip : (r.nh || '')), h('td', gw ? PW.ifLabel(d, gw.iface) : ''), h('td', r.descr || ''), h('td.act',
      h('a', { title: 'Edit route', on: { click: e => { e.preventDefault(); P.go('system_routes_edit.php', { id: i }); } } }, PW.ic('edit')),
      h('a', { title: r.disabled ? 'Enable route' : 'Disable route', on: { click: e => { e.preventDefault(); const a = P.edit('routes'); if (a[i].disabled) delete a[i].disabled; else a[i].disabled = true; P.go('system_routes.php'); } } }, PW.ic(r.disabled ? 'on' : 'off')),
      h('a', { title: 'Delete route', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you want to delete this route?', () => { P.edit('routes').splice(i, 1); P.go('system_routes.php'); }); } } }, PW.ic('del')))); });
    root.append(PW.panel('Static Routes', PW.table(['Network', 'Gateway', 'Interface', 'Description', 'Actions'], rows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('system_routes_edit.php'))));
    return root;
  }
});
PW.page('system_routes_edit.php', {
  crumbs: ['System', 'Routing', 'Static Routes', 'Edit'],
  render: P => {
    const rts = P.sec('routes') || []; const gws = P.sec('gateways') || []; const idx = P.q.id !== undefined ? +P.q.id : -1;
    if (idx >= 0 && !rts[idx]) return PW.alert('danger', 'The route does not exist.');
    const r0 = idx >= 0 ? U.clone(rts[idx]) : { net: '', mask: '255.255.255.0', nh: (gws[0] || {}).ip, descr: '' };
    const gwOpts = gws.map(gw => ({ value: gw.ip, label: gw.name + ' - ' + gw.ip }));
    if (r0.nh && !gws.some(x => x.ip === r0.nh)) gwOpts.push({ value: r0.nh, label: r0.nh + ' (no gateway object)' });
    const netBox = h('div.pfw-inline'); const na = h('input.form-control.sm', { type: 'text', value: r0.net, style: { width: '160px' }, spellcheck: false });
    const nm = h('select.form-control.sm', PW.maskOpts().map(x => h('option', { value: x.value, selected: +x.value === U.mask2len(r0.mask) }, x.label))); netBox.append(na, h('span', '/'), nm);
    const form = PW.form(P, {
      title: 'Edit Route Entry',
      fields: [
        { k: 'net', label: 'Destination network', type: 'el', el: netBox, get: () => ({ a: na.value.trim(), l: +nm.value }) },
        { k: 'gw', label: 'Gateway', type: 'select', options: gwOpts, value: r0.nh, help: 'Choose which gateway this route applies to or add a new one first.' },
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Disable this static route', value: !!r0.disabled, help: 'Set this option to disable this static route without removing it from the list.' },
        { k: 'descr', label: 'Description', type: 'text', value: r0.descr || '' }
      ],
      save: v => {
        const errs = []; if (!U.isIP(v.net.a)) errs.push('A valid IPv4 destination network must be specified.');
        if (!v.gw) errs.push('A valid gateway must be specified.');
        if (errs.length) return errs;
        const a = P.edit('routes'); const nr = { net: U.netAddr(v.net.a, U.len2mask(v.net.l)), mask: U.len2mask(v.net.l), nh: v.gw }; if (v.dis) nr.disabled = true; if (v.descr) nr.descr = v.descr;
        if (idx >= 0) a[idx] = Object.assign({}, a[idx], nr, v.dis ? {} : { disabled: undefined }); else a.push(nr);
        if (idx >= 0 && !v.dis) delete a[idx].disabled;
        P.go('system_routes.php'); return null;
      }
    });
    return form.el;
  }
});

/* ================================================================== Interfaces */
PW.page('interfaces_assign.php', {
  crumbs: ['Interfaces', 'Interface Assignments'],
  render: P => {
    const d = P.d; const ifs = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual);
    return PW.panel('Interface Assignments', PW.table(['Interface', 'Network port'], ifs.map(k => h('tr', h('td', h('a', { on: { click: e => { e.preventDefault(); P.go('interfaces.php', { if: k }); } } }, PW.ifLabel(d, k))), h('td', d.ifaces[k].dev + (d.ifaces[k].mac ? ' (' + d.ifaces[k].mac + ')' : ''))))), { flush: true });
  }
});
PW.page('interfaces.php', {
  crumbs: P => ['Interfaces', PW.ifLabel(P.d, P.q.if || 'wan')],
  render: P => {
    const d = P.d; const ifk = P.q.if || 'wan'; const ifs = P.sec('ifaces') || d.ifaces; const i0 = ifs[ifk];
    if (!i0 || i0.virtual) return PW.alert('danger', 'The interface does not exist.');
    const root = h('div');
    const bar = PW.applyBar(P, ['ifaces'], 'Interfaces'); if (bar) root.append(bar);
    const gwNames = (P.sec('gateways') || []).filter(x => x.iface === ifk && !x.lanGw).map(x => x.name + ' - ' + x.ip);
    const form = PW.form(P, {
      title: 'General Configuration',
      fields: [
        { k: 'en', label: 'Enable', type: 'check', text: 'Enable interface', value: true },
        { k: 'descr', label: 'Description', type: 'text', value: i0.name || ifk.toUpperCase(), help: 'Enter a description (name) for the interface here.' },
        { k: 'type', label: 'IPv4 Configuration Type', type: 'select', options: [{ value: 'static', label: 'Static IPv4' }, { value: 'dhcp', label: 'DHCP' }], value: i0.dhcp ? 'dhcp' : 'static' },
        { panel: 'Static IPv4 Configuration' },
        { k: 'ip', label: 'IPv4 Address', type: 'el', el: (() => { const a = h('input.form-control.sm', { type: 'text', value: i0.ip || '', style: { width: '160px' }, spellcheck: false }); const m = h('select.form-control.sm', PW.maskOpts().map(x => h('option', { value: x.value, selected: i0.mask && +x.value === U.mask2len(i0.mask) }, x.label))); const w = h('div.pfw-inline', a, h('span', '/'), m); w._a = a; w._m = m; return w; })(), get: () => 0, show: v => v.type === 'static' },
        { k: 'gwinfo', label: 'IPv4 Upstream gateway', type: 'static', value: gwNames.length ? gwNames.join(', ') : 'None', show: v => v.type === 'static' }
      ],
      save: v => {
        const ipField = form.fields.find(f => f.k === 'ip')._inp; const ip = v.type === 'static' ? ipField._a.value.trim() : ''; const len = +ipField._m.value;
        const errs = [];
        if (v.type === 'static') {
          if (!U.isIP(ip)) errs.push('A valid IPv4 address must be specified.');
          else Object.keys(d.ifaces).forEach(k => { const o = d.ifaces[k]; if (k === ifk || o.virtual || !o.ip) return; const n1 = U.netAddr(ip, U.len2mask(len)), n2 = U.netAddr(o.ip, o.mask); if (U.inNet(ip, n2, o.mask) || U.inNet(o.ip, n1, U.len2mask(len))) errs.push('IPv4 address ' + ip + '/' + len + ' is being used by or overlaps with: ' + PW.ifLabel(d, k) + ' (' + o.ip + '/' + U.mask2len(o.mask) + ').'); });
        }
        if (!v.descr.trim()) errs.push('A description must be specified.');
        if (errs.length) return errs;
        const all = P.edit('ifaces'); const i = all[ifk]; i.name = v.descr.trim();
        if (v.type === 'dhcp') { i.dhcp = true; } else { i.dhcp = false; i.ip = ip; i.mask = U.len2mask(len); }
        P.go('interfaces.php', { if: ifk }); return null;
      }
    });
    root.append(form.el); return root;
  }
});

/* ================================================================== Cert. Manager */
const cmTabs = (P, cur) => PW.tabs([{ key: 'ca', label: 'CAs', go: () => P.go('system_camanager.php') }, { key: 'cert', label: 'Certificates', go: () => P.go('system_certmanager.php') }, { key: 'crl', label: 'Certificate Revocation', go: () => P.go('system_crlmanager.php') }], cur);
function caForm(P) {
  const d = P.d; const root = h('div'); root.append(cmTabs(P, 'ca'));
  const form = PW.form(P, {
    title: 'Create / Edit CA',
    fields: [
      { k: 'name', label: 'Descriptive name', type: 'text', value: '', w: 300 },
      { k: 'method', label: 'Method', type: 'select', options: [{ value: 'internal', label: 'Create an internal Certificate Authority' }, { value: 'existing', label: 'Import an existing Certificate Authority' }, { value: 'intermediate', label: 'Create an intermediate Certificate Authority' }], value: 'internal' },
      { panel: 'Internal Certificate Authority' },
      { k: 'keylen', label: 'Key length (bits)', type: 'select', options: ['2048', '3072', '4096'], value: '2048' },
      { k: 'digest', label: 'Digest Algorithm', type: 'select', options: ['sha256', 'sha384', 'sha512'], value: 'sha256' },
      { k: 'life', label: 'Lifetime (days)', type: 'text', value: '3650', w: 90 },
      { k: 'cn', label: 'Common Name', type: 'text', value: '', w: 300, help: 'The following characters are allowed: letters, numbers, spaces, and . - _ @' }
    ],
    save: v => {
      const errs = []; const name = v.name.trim(); const cn = v.cn.trim();
      if (!name) errs.push('The field \'Descriptive name\' is required.'); if (!cn) errs.push('The field \'Common Name\' is required.');
      if (!/^\d+$/.test(String(v.life).trim()) || +v.life < 1) errs.push('Lifetime must be a positive number of days.');
      if (v.method !== 'internal') errs.push('Seule la création d’une autorité interne est reproduite dans ce simulateur.');
      d.openvpn = d.openvpn || { servers: [], cas: [], certs: [], users: [] };
      if ((d.openvpn.cas || []).some(c => c.name === name)) errs.push('There is already a certificate authority named ' + name + '.');
      if (errs.length) return errs;
      const exp = new Date(P.W.nowOf(P.host).getTime() + (+v.life) * 86400000);
      d.openvpn.cas = d.openvpn.cas || []; d.openvpn.cas.push({ name, cn, internal: true, expires: exp.getUTCFullYear() + '-' + U.pad2(exp.getUTCMonth() + 1) + '-' + U.pad2(exp.getUTCDate()) });
      P.desk.env.advance(4); P.desk.env.touch('pf-ca'); P.desk.change('pfSense : Cert. Manager — autorité de certification interne ' + name + ' créée', { dev: P.host });
      P.setFlash('success', 'The certificate authority ' + name + ' was created.'); P.go('system_camanager.php'); return null;
    }
  });
  root.append(form.el); return root;
}
PW.page('system_camanager.php', {
  crumbs: ['System', 'Certificate Manager', 'CAs'],
  render: P => {
    if (P.q.act === 'new') return caForm(P);
    const ov = P.d.openvpn || { cas: [], certs: [] }; const root = h('div'); root.append(cmTabs(P, 'ca'));
    const rows = (ov.cas || []).map(ca => h('tr', h('td', ca.name), h('td', 'YES'), h('td', 'self-signed'), h('td', String((ov.certs || []).filter(c => c.ca === ca.name).length)), h('td', 'CN=' + (ca.cn || ca.name) + (ca.expires ? ', valid until ' + ca.expires : '')), h('td', ca.expired ? h('span.pfw-tag.ko', 'Expired') : h('span.pfw-tag.ok', 'Valid')), h('td.act',
      ca.expired ? h('a', { title: 'Renew or Reissue', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Renew the certificate authority ' + ca.name + '?', () => { ca.expired = false; P.desk.env.advance(2); P.desk.env.touch('pf-ca'); P.desk.change('pfSense : Cert. Manager — renouvellement de l’autorité ' + ca.name, { dev: P.host }); P.setFlash('success', 'The certificate authority was renewed.'); P.go('system_camanager.php'); }, 'Renew'); } } }, PW.ic('refresh')) : null)));
    root.append(PW.panel('Certificate Authorities', PW.table(['Name', 'Internal', 'Issuer', 'Certificates', 'Distinguished Name', 'Status', 'Actions'], rows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('system_camanager.php', { act: 'new' }))));
    return root;
  }
});
PW.page('system_certmanager.php', {
  crumbs: ['System', 'Certificate Manager', 'Certificates'],
  render: P => {
    const d = P.d; const ov = d.openvpn || { cas: [], certs: [], servers: [] }; const root = h('div'); root.append(cmTabs(P, 'cert'));
    const rows = (ov.certs || []).map(c => {
      const inUse = (ov.servers || []).some(s => s.cert === c.name) ? 'OpenVPN Server' : (ov.users || []).some(u => u.cert === c.name) ? 'User Certificate' : '';
      const st = c.revoked ? h('span.pfw-tag.ko', 'Revoked') : c.expired ? h('span.pfw-tag.ko', 'Expired') : h('span.pfw-tag.ok', 'Valid');
      return h('tr', h('td', c.name), h('td', 'CN=' + c.cn + ' (' + (c.type === 'server' ? 'Server' : 'User') + ' certificate)'), h('td', c.ca), h('td', st), h('td', inUse), h('td.act',
        h('a', { title: 'Renew or Reissue', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Reissue the certificate ' + c.name + '?', () => { c.expired = false; P.desk.env.advance(2); P.desk.env.touch('pf-cert'); P.desk.change('pfSense : Cert. Manager — certificat ' + c.name + ' réémis', { dev: P.host }); P.setFlash('success', 'The certificate ' + c.name + ' was reissued.'); P.go('system_certmanager.php'); }, 'Reissue'); } } }, PW.ic('refresh'))));
    });
    root.append(PW.panel('Certificates', PW.table(['Name', 'Issuer / Distinguished Name', 'Certificate Authority', 'Status', 'In Use', 'Actions'], rows), { flush: true }));
    return root;
  }
});
PW.page('system_crlmanager.php', {
  crumbs: ['System', 'Certificate Manager', 'Certificate Revocation'],
  render: P => {
    const ov = P.d.openvpn || { cas: [], certs: [] }; const root = h('div'); root.append(cmTabs(P, 'crl'));
    const rev = (ov.certs || []).filter(c => c.revoked);
    root.append(PW.panel('Certificate Revocation Lists', PW.table(['Certificate Authority', 'Revoked certificates', 'Actions'], (ov.cas || []).map(ca => { const l = rev.filter(c => c.ca === ca.name); return h('tr', h('td', ca.name), h('td', l.length ? l.map(c => h('div', c.name + ' ', h('a', { title: 'Delete this certificate from the CRL', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Remove ' + c.name + ' from the revocation list?', () => { delete c.revoked; P.desk.env.advance(2); P.desk.env.touch('pf-crl'); P.desk.change('pfSense : Cert. Manager — ' + c.name + ' retiré de la liste de révocation', { dev: P.host }); P.go('system_crlmanager.php'); }); } } }, PW.ic('del')))) : h('span.pfw-help', 'No certificates found for this CA.')), h('td')); })), { flush: true }));
    return root;
  }
});

/* ================================================================== User Manager */
PW.page('system_usermanager.php', {
  crumbs: ['System', 'User Manager', 'Users'],
  render: P => {
    const d = P.d; const ov = d.openvpn || { users: [] };
    const rows = [h('tr', h('td'), h('td', 'admin'), h('td', 'System Administrator'), h('td', h('span.pfw-tag.ok', 'Enabled')), h('td', 'admins'), h('td'))]
      .concat((ov.users || []).map(u => h('tr' + (u.disabled ? '.off' : ''), h('td'), h('td', u.name), h('td', u.name), h('td', u.disabled ? h('span.pfw-tag.ko', 'Disabled') : h('span.pfw-tag.ok', 'Enabled')), h('td'), h('td.act', h('a', { title: 'Edit user', on: { click: e => { e.preventDefault(); P.go('system_usermanager.php', { act: 'edit', userid: u.name }); } } }, PW.ic('edit'))))));
    if (P.q.act === 'edit') {
      const u = (ov.users || []).find(x => x.name === P.q.userid); if (!u) return PW.alert('danger', 'The user does not exist.');
      return PW.form(P, { title: 'User Properties', fields: [
        { k: 'dis', label: 'Disabled', type: 'check', text: 'This user cannot login', value: !!u.disabled },
        { k: 'name', label: 'Username', type: 'static', value: u.name },
        { k: 'cert', label: 'Certificate', type: 'static', value: u.cert }
      ], save: v => { if (v.dis) u.disabled = true; else delete u.disabled; P.desk.env.advance(1); P.desk.env.touch('pf-user'); P.desk.change('pfSense : User Manager — utilisateur ' + u.name + (v.dis ? ' désactivé' : ' activé'), { dev: P.host }); P.setFlash('success', 'The changes have been applied successfully.'); P.go('system_usermanager.php'); return null; } }).el;
    }
    return PW.panel('Users', PW.table(['', 'Username', 'Full name', 'Status', 'Groups', 'Actions'], rows), { flush: true });
  }
});

/* ================================================================== DNS Resolver */
PW.page('services_unbound.php', {
  crumbs: ['Services', 'DNS Resolver', 'General Settings'],
  render: P => {
    const d = P.d; d.dns = d.dns || {}; const u = d.dns.unbound = d.dns.unbound || { enabled: false, hostOverrides: [], domainOverrides: [] };
    const root = h('div');
    const form = PW.form(P, { title: 'General Settings', fields: [{ k: 'en', label: 'Enable', type: 'check', text: 'Enable DNS resolver', value: !!u.enabled }],
      save: v => { u.enabled = v.en; P.desk.env.advance(2); P.desk.env.touch('pf-dns'); P.desk.change('pfSense : DNS Resolver ' + (v.en ? 'activé' : 'désactivé'), { dev: P.host }); P.setFlash('success', 'The changes have been applied successfully.'); P.go('services_unbound.php'); return null; } });
    root.append(form.el);
    const hrows = []; (u.hostOverrides || []).forEach((o, i) => { hrows.push(h('tr', h('td', o.host), h('td', o.domain), h('td', o.ip), h('td', o.descr || ''), h('td.act',
      h('a', { title: 'Edit host override', on: { click: e => { e.preventDefault(); P.go('services_unbound_host_edit.php', { id: i }); } } }, PW.ic('edit')),
      h('a', { title: 'Delete host override', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you want to delete this host override?', () => { u.hostOverrides.splice(i, 1); P.desk.env.touch('pf-dns'); P.desk.change('pfSense : DNS Resolver — suppression de la substitution d’hôte ' + o.host, { dev: P.host }); P.go('services_unbound.php'); }); } } }, PW.ic('del'))))); (o.aliases || []).forEach(a => hrows.push(h('tr', h('td', a.host), h('td', a.domain), h('td', 'Alias for ' + (o.host ? o.host + '.' : '') + o.domain), h('td', a.descr || ''), h('td')))); });
    root.append(PW.panel('Host Overrides', PW.table(['Host', 'Domain', 'IP', 'Description', 'Actions'], hrows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('services_unbound_host_edit.php'))));
    const drows = (u.domainOverrides || []).map((o, i) => h('tr', h('td', o.domain), h('td', o.server), h('td', o.descr || ''), h('td.act',
      h('a', { title: 'Edit domain override', on: { click: e => { e.preventDefault(); P.go('services_unbound_domainoverride_edit.php', { id: i }); } } }, PW.ic('edit')),
      h('a', { title: 'Delete domain override', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you want to delete this domain override?', () => { u.domainOverrides.splice(i, 1); P.desk.env.touch('pf-dns'); P.desk.change('pfSense : DNS Resolver — suppression de la substitution de domaine ' + o.domain, { dev: P.host }); P.go('services_unbound.php'); }); } } }, PW.ic('del')))));
    root.append(PW.panel('Domain Overrides', PW.table(['Domain', 'IP', 'Description', 'Actions'], drows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('services_unbound_domainoverride_edit.php'))));
    return root;
  }
});
PW.page('services_unbound_host_edit.php', {
  crumbs: ['Services', 'DNS Resolver', 'Edit Host Override'],
  render: P => {
    const u = P.d.dns.unbound; const idx = P.q.id !== undefined && P.q.id !== '' ? +P.q.id : -1; const cur = idx >= 0 ? u.hostOverrides[idx] : null; if (idx >= 0 && !cur) return PW.alert('danger', 'The host override does not exist.');
    /* noms additionnels : lignes Host / Domain / Description */
    const alias = (cur && cur.aliases ? cur.aliases : []).map(a => Object.assign({}, a)); const aBox = h('div');
    const draw = () => { UI.clear(aBox); alias.forEach((a, k) => { const hi = h('input.form-control.sm', { type: 'text', value: a.host, spellcheck: false, style: { width: '110px' } }), di = h('input.form-control.sm', { type: 'text', value: a.domain, spellcheck: false, style: { width: '170px' } }), ti = h('input.form-control.sm', { type: 'text', value: a.descr || '', spellcheck: false, style: { width: '170px' } });
      hi.addEventListener('input', () => { a.host = hi.value; }); di.addEventListener('input', () => { a.domain = di.value; }); ti.addEventListener('input', () => { a.descr = ti.value; });
      aBox.append(h('div.pfw-inline', { style: { marginBottom: '4px' } }, h('span', 'Host:'), hi, h('span', 'Domain:'), di, h('span', 'Description:'), ti, PW.btn('Delete', 'danger', () => { alias.splice(k, 1); draw(); }, { sm: true }))); });
      aBox.append(PW.btn([PW.ic('up'), ' Add Host Name'], 'success', () => { alias.push({ host: '', domain: '', descr: '' }); draw(); }, { sm: true })); };
    draw();
    return PW.form(P, { title: 'Host Override Options', fields: [
      { k: 'host', label: 'Host', type: 'text', value: cur ? cur.host : '', help: 'Name of the host, without the domain part.' }, { k: 'domain', label: 'Domain', type: 'text', value: cur ? cur.domain : (P.d.domain || ''), help: 'Domain of the host.' },
      { k: 'ip', label: 'IP Address', type: 'text', value: cur ? cur.ip : '', help: 'IPv4 or IPv6 address to be returned for the host.' }, { k: 'descr', label: 'Description', type: 'text', value: cur ? (cur.descr || '') : '' },
      { panel: 'Additional Names for this Host' }, { k: 'alias', label: 'Host Name', type: 'el', el: aBox, get: () => alias }],
    save: v => { const errs = []; if (!/^[A-Za-z0-9_-]*$/.test(v.host)) errs.push('The hostname can only contain the characters A-Z, 0-9 and \'-\'.'); if (!U.isIP(v.ip.trim())) errs.push('A valid IP address must be specified.'); if (!v.domain.trim()) errs.push('A valid domain must be specified.');
      const als = alias.filter(a => a.host.trim() || a.domain.trim()); als.forEach(a => { if (!/^[A-Za-z0-9_-]*$/.test(a.host.trim())) errs.push('The hostname \'' + a.host + '\' can only contain the characters A-Z, 0-9 and \'-\'.'); if (!a.domain.trim()) errs.push('A valid domain must be specified for the additional name \'' + a.host + '\'.'); });
      if (errs.length) return errs;
      const o = { host: v.host, domain: v.domain.trim(), ip: v.ip.trim(), descr: v.descr }; if (als.length) o.aliases = als.map(a => ({ host: a.host.trim(), domain: a.domain.trim(), descr: a.descr || '' }));
      if (cur) u.hostOverrides[idx] = o; else u.hostOverrides.push(o);
      P.desk.env.touch('pf-dns'); P.desk.change('pfSense : DNS Resolver — substitution d’hôte ' + v.host + '.' + v.domain + (als.length ? ' (+' + als.length + ' nom(s) additionnel(s))' : ''), { dev: P.host }); P.go('services_unbound.php'); return null; } }).el;
  }
});
PW.page('services_unbound_domainoverride_edit.php', {
  crumbs: ['Services', 'DNS Resolver', 'Edit Domain Override'],
  render: P => {
    const u = P.d.dns.unbound; const idx = P.q.id !== undefined ? +P.q.id : -1; const o0 = idx >= 0 ? u.domainOverrides[idx] : { domain: '', server: '', descr: '' };
    if (idx >= 0 && !o0) return PW.alert('danger', 'The domain override does not exist.');
    return PW.form(P, { title: 'Domain Override Options', fields: [
      { k: 'domain', label: 'Domain', type: 'text', value: o0.domain, help: 'Domain whose lookups will be directed to a user-specified DNS lookup server.' },
      { k: 'server', label: 'IP Address', type: 'text', value: o0.server, help: 'IPv4 or IPv6 address of the authoritative DNS server for this domain.' }, { k: 'descr', label: 'Description', type: 'text', value: o0.descr || '' }],
    save: v => { const errs = []; if (!v.domain.trim()) errs.push('A valid domain must be specified.'); if (!U.isIP(v.server.trim())) errs.push('A valid IP address must be specified.'); if (errs.length) return errs;
      const nv = { domain: v.domain.trim(), server: v.server.trim() }; if (v.descr) nv.descr = v.descr; if (idx >= 0) u.domainOverrides[idx] = nv; else u.domainOverrides.push(nv);
      P.desk.env.advance(1); P.desk.env.touch('pf-dns'); P.desk.change('pfSense : DNS Resolver — substitution de domaine ' + nv.domain + ' → ' + nv.server, { dev: P.host }); P.go('services_unbound.php'); return null; } }).el;
  }
});

/* ================================================================== IPsec */
const DH = [[1, '1 (768 bit)'], [2, '2 (1024 bit)'], [5, '5 (1536 bit)'], [14, '14 (2048 bit)'], [15, '15 (3072 bit)'], [16, '16 (4096 bit)'], [19, '19 (nist ecp256)'], [20, '20 (nist ecp384)'], [21, '21 (nist ecp521)']];
const HASHES = [['md5', 'MD5'], ['sha1', 'SHA1'], ['sha256', 'SHA256'], ['sha384', 'SHA384'], ['sha512', 'SHA512']];
const KEYLEN = [128, 192, 256];
const dhLabel = n => (DH.find(x => String(x[0]) === String(n)) || [0, String(n)])[1];
const encrLabel = e => { const m = /^aes(\d+)$/.exec(e || ''); return m ? 'AES (' + m[1] + ' bits)' : String(e || ''); };
const ipTabs = (P) => PW.tabs([{ key: 't', label: 'Tunnels', go: () => P.go('vpn_ipsec.php') }, { key: 'm', label: 'Mobile Clients', go: () => P.go('vpn_ipsec_mobile.php') }, { key: 'k', label: 'Pre-Shared Keys', go: () => P.go('vpn_ipsec_keys.php') }, { key: 'a', label: 'Advanced Settings', go: () => P.go('vpn_ipsec_settings.php') }], 't');
PW.page('vpn_ipsec.php', {
  crumbs: ['VPN', 'IPsec', 'Tunnels'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(PW.applyBar(P, ['ipsec'], 'IPsec')); root.append(ipTabs(P));
    const ip = P.sec('ipsec') || { enabled: false, tunnels: [] };
    (ip.tunnels || []).forEach((t, ti) => {
      const p1 = t.p1;
      const p1row = h('tr' + (p1.disabled ? '.off' : ''), h('td', p1.ike === 'ikev1' ? 'IKEv1' : 'IKEv2'), h('td', p1.remoteGw), h('td', p1.ike === 'ikev1' ? 'Main' : 'n/a'), h('td', 'AES'), h('td', encrLabel(p1.encr)), h('td', dhLabel(p1.dh)), h('td', t.descr || ''), h('td.act',
        h('a', { title: 'Edit phase 1 entry', on: { click: e => { e.preventDefault(); P.go('vpn_ipsec_phase1.php', { ikeid: t.id }); } } }, PW.ic('edit')),
        h('a', { title: p1.disabled ? 'Enable' : 'Disable', on: { click: e => { e.preventDefault(); const a = P.edit('ipsec'); const x = a.tunnels[ti]; if (x.p1.disabled) delete x.p1.disabled; else x.p1.disabled = true; P.go('vpn_ipsec.php'); } } }, PW.ic(p1.disabled ? 'on' : 'off'))));
      const p2rows = (t.p2 || []).map((p2, pi) => h('tr' + (p2.dis ? '.off' : ''), h('td', 'Tunnel IPv4'), h('td', p2.local), h('td', p2.remote), h('td', (p2.proto || 'esp').toUpperCase()), h('td', encrLabel(p2.encr)), h('td', String(p2.hash || '').toUpperCase()), h('td', p2.descr || ''), h('td.act',
        h('a', { title: 'Edit phase 2 entry', on: { click: e => { e.preventDefault(); P.go('vpn_ipsec_phase2.php', { ikeid: t.id, idx: pi }); } } }, PW.ic('edit')),
        h('a', { title: p2.dis ? 'Enable' : 'Disable', on: { click: e => { e.preventDefault(); const a = P.edit('ipsec'); const x = a.tunnels[ti].p2[pi]; if (x.dis) delete x.dis; else x.dis = true; P.go('vpn_ipsec.php'); } } }, PW.ic(p2.dis ? 'on' : 'off')))));
      const p1tab = PW.table(['IKE', 'Remote Gateway', 'Mode', 'P1 Protocol', 'P1 Transforms', 'P1 DH-Group', 'P1 Description', 'Actions'], [p1row]);
      const p2head = h('div', { style: { padding: '8px 15px', background: '#f5f5f5', borderTop: '1px solid #ddd' } }, h('b', 'Phase 2 entries'));
      const p2tab = PW.table(['Mode', 'Local Subnet', 'Remote Subnet', 'P2 Protocol', 'P2 Transforms', 'P2 Auth Methods', 'P2 Description', 'Actions'], p2rows);
      root.append(PW.panel('IPsec Tunnels — ' + (t.descr || t.id), h('div', p1tab, p2head, p2tab), { flush: true }));
    });
    const en = h('input', { type: 'checkbox', checked: !!ip.enabled });
    root.append(PW.panel('IPsec Service', h('div', h('label.pfw-chk', en, h('span', 'Enable IPsec')), h('div', { style: { marginTop: '8px' } }, PW.btn('Save', 'primary', () => { const a = P.edit('ipsec'); a.enabled = en.checked; P.go('vpn_ipsec.php'); })))));
    return root;
  }
});
PW.page('vpn_ipsec_phase1.php', {
  crumbs: ['VPN', 'IPsec', 'Tunnels', 'Edit Phase 1'],
  render: P => {
    const d = P.d; const ip = P.sec('ipsec') || { tunnels: [] }; const ti = (ip.tunnels || []).findIndex(t => t.id === P.q.ikeid); if (ti < 0) return PW.alert('danger', 'The phase 1 entry does not exist.');
    const t = ip.tunnels[ti]; const p = t.p1; const m = /^aes(\d+)$/.exec(p.encr || ''); const wanOpts = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
    const form = PW.form(P, {
      title: 'General Information',
      fields: [
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Set this option to disable this phase1 without removing it from the list.', value: !!p.disabled },
        { k: 'ike', label: 'Key Exchange version', type: 'select', options: [{ value: 'ikev1', label: 'IKEv1' }, { value: 'ikev2', label: 'IKEv2' }], value: p.ike, help: 'Select the Internet Key Exchange protocol version to be used. Auto uses IKEv2 when initiator, and accepts either IKEv1 or IKEv2 as responder.' },
        { k: 'af', label: 'Internet Protocol', type: 'select', options: [{ value: 'inet', label: 'IPv4' }], value: 'inet' },
        { k: 'iface', label: 'Interface', type: 'select', options: wanOpts, value: p.iface || 'wan', help: 'Select the interface for the local endpoint of this phase1 entry.' },
        { k: 'gw', label: 'Remote Gateway', type: 'text', value: p.remoteGw, help: 'Enter the public IP address or host name of the remote gateway.' },
        { k: 'descr', label: 'Description', type: 'text', value: t.descr || '', help: 'A description may be entered here for administrative reference (not parsed).' },
        { panel: 'Phase 1 Proposal (Authentication)' },
        { k: 'auth', label: 'Authentication Method', type: 'select', options: [{ value: 'psk', label: 'Mutual PSK' }], value: 'psk', help: 'Must match the setting chosen on the remote side.' },
        { k: 'psk', label: 'Pre-Shared Key', type: 'text', value: p.psk || '', help: 'Enter the Pre-Shared Key string. This key must match on both peers.' },
        { panel: 'Phase 1 Proposal (Algorithms)' },
        { k: 'alg', label: 'Encryption Algorithm', type: 'select', options: [{ value: 'aes', label: 'AES' }], value: 'aes' },
        { k: 'klen', label: 'Key length', type: 'select', options: KEYLEN.map(x => ({ value: x, label: x + ' bits' })), value: m ? +m[1] : 256 },
        { k: 'hash', label: 'Hash', type: 'select', options: HASHES.map(x => ({ value: x[0], label: x[1] })), value: p.hash },
        { k: 'dh', label: 'DH Group', type: 'select', options: DH.map(x => ({ value: x[0], label: x[1] })), value: p.dh, help: 'Must match the setting chosen on the remote side.' },
        { k: 'life', label: 'Lifetime (Seconds)', type: 'text', value: p.lifetime || 28800, w: 140 },
        { panel: 'Advanced Options' },
        { k: 'dpd', label: 'Dead Peer Detection', type: 'check', text: 'Enable DPD', value: p.dpd !== false }
      ],
      save: v => {
        const errs = []; if (!U.isIP(v.gw.trim()) && !/^[A-Za-z0-9.-]+$/.test(v.gw.trim())) errs.push('A valid remote gateway address or host name must be specified.');
        if (!v.psk) errs.push('A pre-shared key must be defined.'); if (!/^\d+$/.test(String(v.life)) || +v.life < 1) errs.push('The P1 lifetime must be an integer.');
        if (errs.length) return errs;
        const a = P.edit('ipsec'); const tt = a.tunnels[ti]; const q = tt.p1;
        q.ike = v.ike; q.iface = v.iface; q.remoteGw = v.gw.trim(); q.psk = v.psk; q.encr = 'aes' + v.klen; q.hash = v.hash; q.dh = +v.dh; q.lifetime = +v.life; q.dpd = !!v.dpd;
        if (v.dis) q.disabled = true; else if ('disabled' in q) q.disabled = false; tt.descr = v.descr;
        P.go('vpn_ipsec.php'); return null;
      }
    });
    return form.el;
  }
});
PW.page('vpn_ipsec_phase2.php', {
  crumbs: ['VPN', 'IPsec', 'Tunnels', 'Edit Phase 2'],
  render: P => {
    const ip = P.sec('ipsec') || { tunnels: [] }; const ti = (ip.tunnels || []).findIndex(t => t.id === P.q.ikeid); if (ti < 0) return PW.alert('danger', 'The phase 2 entry does not exist.');
    const pi = +P.q.idx; const p = ip.tunnels[ti].p2[pi]; if (!p) return PW.alert('danger', 'The phase 2 entry does not exist.');
    const lc = PW.cidrParts(p.local), rc = PW.cidrParts(p.remote); const m = /^aes(\d+)$/.exec(p.encr || '');
    const netIn = (c) => { const a = h('input.form-control.sm', { type: 'text', value: c.addr, style: { width: '160px' }, spellcheck: false }); const s = h('select.form-control.sm', PW.maskOpts().map(x => h('option', { value: x.value, selected: +x.value === c.len }, x.label))); return { el: h('div.pfw-inline', h('span', 'Network'), a, h('span', '/'), s), get: () => ({ a: a.value.trim(), l: +s.value }) }; };
    const li = netIn(lc), ri = netIn(rc);
    const form = PW.form(P, {
      title: 'General Information',
      fields: [
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Disable this phase 2 entry without removing it from the list.', value: !!p.dis },
        { k: 'mode', label: 'Mode', type: 'select', options: [{ value: 'tunnel', label: 'Tunnel IPv4' }], value: 'tunnel' },
        { k: 'local', label: 'Local Network', type: 'el', el: li.el, get: li.get, help: 'Local network component of this IPsec security association.' },
        { k: 'remote', label: 'Remote Network', type: 'el', el: ri.el, get: ri.get, help: 'Remote network component of this IPsec security association.' },
        { k: 'descr', label: 'Description', type: 'text', value: p.descr || '' },
        { panel: 'Phase 2 Proposal (SA/Key Exchange)' },
        { k: 'proto', label: 'Protocol', type: 'select', options: [{ value: 'esp', label: 'ESP' }, { value: 'ah', label: 'AH' }], value: p.proto || 'esp', help: 'ESP is encryption, AH is authentication only.' },
        { k: 'klen', label: 'Encryption Algorithms (AES)', type: 'select', options: KEYLEN.map(x => ({ value: x, label: 'AES ' + x + ' bits' })), value: m ? +m[1] : 256 },
        { k: 'hash', label: 'Hash Algorithms', type: 'select', options: HASHES.map(x => ({ value: x[0], label: x[1] })), value: p.hash },
        { k: 'pfs', label: 'PFS key group', type: 'select', options: [{ value: '', label: 'off' }].concat(DH.map(x => ({ value: x[0], label: x[1] }))), value: p.pfs === null || p.pfs === undefined ? '' : p.pfs, help: 'Note: Groups 1, 2, 5, 22, 23, and 24 provide weak security and should be avoided.' },
        { k: 'life', label: 'Lifetime', type: 'text', value: p.lifetime || 3600, w: 140 }
      ],
      save: v => {
        const errs = []; [['local', 'local'], ['remote', 'remote']].forEach(([k, w]) => { if (!U.isIP(v[k].a) || v[k].l < 1 || v[k].l > 32) errs.push('A valid ' + w + ' network must be specified.'); });
        if (errs.length) return errs;
        const a = P.edit('ipsec'); const q = a.tunnels[ti].p2[pi];
        q.local = v.local.a + '/' + v.local.l; q.remote = v.remote.a + '/' + v.remote.l; q.proto = v.proto; q.encr = 'aes' + v.klen; q.hash = v.hash; q.pfs = v.pfs === '' ? null : +v.pfs; q.lifetime = +v.life || 3600; if (v.dis) q.dis = true; else if ('dis' in q) q.dis = false;
        if (v.descr) q.descr = v.descr; else delete q.descr; P.go('vpn_ipsec.php'); return null;
      }
    });
    return form.el;
  }
});

/* ================================================================== OpenVPN */
const ovTabs = (P, cur) => PW.tabs([{ key: 's', label: 'Servers', go: () => P.go('vpn_openvpn_server.php') }, { key: 'c', label: 'Clients', go: () => P.go('vpn_openvpn_client.php') }, { key: 'o', label: 'Client Specific Overrides', go: () => P.go('vpn_openvpn_csc.php') }, { key: 'w', label: 'Wizards', go: () => P.go('wizard.php', { xml: 'openvpn' }) }], cur);
PW.page('vpn_openvpn_server.php', {
  crumbs: ['VPN', 'OpenVPN', 'Servers'],
  render: P => {
    const d = P.d; const ov = d.openvpn || { servers: [] }; const root = h('div'); root.append(ovTabs(P, 's'));
    const rows = (ov.servers || []).map(s => h('tr' + (s.dis ? '.off' : ''), h('td', 'WAN'), h('td', (/^tcp/.test(s.proto) ? 'TCP' : 'UDP') + (/4$/.test(s.proto) ? '4' : '') + ' / ' + s.port + ' (TUN)'), h('td', s.tunnelNet), h('td', s.descr || ''), h('td.act',
      h('a', { title: 'Edit server', on: { click: e => { e.preventDefault(); P.go('vpn_openvpn_server.php', { act: 'edit', id: s.id }); } } }, PW.ic('edit')))));
    if (P.q.act === 'edit') {
      const s = (ov.servers || []).find(x => String(x.id) === P.q.id); if (!s) return PW.alert('danger', 'The OpenVPN server does not exist.');
      const cas = (ov.cas || []).map(c => ({ value: c.name, label: c.name })), certs = (ov.certs || []).filter(c => c.type === 'server').map(c => ({ value: c.name, label: c.name + (c.ca ? ' (CA: ' + c.ca + ')' : '') }));
      return PW.form(P, { title: 'General Information', fields: [
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Disable this server', value: !!s.dis, help: 'Set this option to disable this server without removing it from the list.' },
        { k: 'mode', label: 'Server mode', type: 'select', options: [{ value: 'ssl', label: 'Remote Access ( SSL/TLS )' }], value: 'ssl' },
        { k: 'proto', label: 'Protocol', type: 'select', options: [{ value: 'udp4', label: 'UDP on IPv4 only' }, { value: 'tcp4', label: 'TCP on IPv4 only' }], value: s.proto },
        { k: 'port', label: 'Local port', type: 'text', value: s.port, w: 120, help: 'Set this option to the local port the server listens on.' },
        { k: 'descr', label: 'Description', type: 'text', value: s.descr || '' },
        { panel: 'Cryptographic Settings' },
        { k: 'tls', label: 'TLS Configuration', type: 'check', text: 'Use a TLS Key', value: !!s.tls, help: 'A TLS key enhances security of an OpenVPN connection by requiring both parties to have a common key before a peer can perform a TLS handshake.' },
        { k: 'ca', label: 'Peer Certificate Authority', type: 'select', options: cas, value: s.ca },
        { k: 'cert', label: 'Server certificate', type: 'select', options: certs, value: s.cert },
        { panel: 'Tunnel Settings' },
        { k: 'tn', label: 'IPv4 Tunnel Network', type: 'text', value: s.tunnelNet, help: 'This is the IPv4 virtual network or network type alias with a single entry used for private communications between this server and client hosts expressed using CIDR notation (e.g. 10.0.8.0/24).' },
        { k: 'ln', label: 'IPv4 Local Network(s)', type: 'text', value: (s.localNets || []).join(', '), help: 'IPv4 networks that will be accessible from the remote endpoint. Expressed as a comma-separated list of one or more CIDR ranges or host/network type aliases.' }
      ], save: v => {
        const errs = []; if (!/^\d+$/.test(String(v.port)) || +v.port < 1 || +v.port > 65535) errs.push('The field \'Local port\' must contain a valid port, ranging from 0 to 65535.');
        const tn = v.tn.trim(); if (!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(tn) || !U.isIP(tn.split('/')[0])) errs.push('The field \'IPv4 Tunnel Network\' must contain a valid IPv4 subnet with CIDR mask.');
        const lns = v.ln.split(',').map(x => x.trim()).filter(Boolean); lns.forEach(x => { if (!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(x) || !U.isIP(x.split('/')[0])) errs.push('"' + x + '" is not a valid IPv4 local network.'); });
        if (errs.length) return errs;
        s.proto = v.proto; s.port = +v.port; s.descr = v.descr; s.tls = !!v.tls; s.ca = v.ca; s.cert = v.cert; s.tunnelNet = tn; s.localNets = lns; if (v.dis) s.dis = true; else delete s.dis;
        P.desk.env.advance(4); P.desk.env.touch('pf-ovpn'); P.desk.change('pfSense : OpenVPN — serveur « ' + (s.descr || s.id) + ' » modifié (' + s.proto + '/' + s.port + ', réseaux locaux ' + lns.join(', ') + ')', { dev: P.host });
        P.setFlash('success', 'The changes have been applied successfully.'); P.go('vpn_openvpn_server.php'); return null; } }).el;
    }
    root.append(PW.panel('OpenVPN Servers', PW.table(['Interface', 'Protocol / Port', 'Tunnel Network', 'Description', 'Actions'], rows), { flush: true }));
    return root;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
