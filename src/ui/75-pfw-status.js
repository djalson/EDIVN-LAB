/* ============================================================================
   Interface web du pare-feu — Status (Dashboard, Gateways, Interfaces, IPsec, OpenVPN, Services, System Logs)
   et Diagnostics (Ping, DNS Lookup, Routes, Test Port, Command Prompt, Reboot).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h, PW = UI.pfw, N = SIM.net, PF = SIM.pf;
SIM.AVREG['pfsense-gui-status'] = 'Interface web pfSense, Status/Diagnostics : disposition du tableau de bord (System Information, Interfaces, Gateways, Services Status), colonnes des journaux (Act, Time, Interface, Rule, Source, Destination, Protocol), format de l’état IPsec (Established / Disconnected, bouton « Connect VPN »), formulaires Ping / DNS Lookup / Test Port / Reboot — à vérifier.';
const emu = () => SIM.emu;

const ago = (sec) => { sec = Math.max(0, Math.floor(sec)); const dd = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60; return (dd ? dd + ' Day' + (dd > 1 ? 's' : '') + ' ' : '') + U.pad2(hh) + ' Hour' + (hh !== 1 ? 's' : '') + ' ' + U.pad2(mm) + ' Minute' + (mm !== 1 ? 's' : '') + ' ' + U.pad2(ss) + ' Second' + (ss !== 1 ? 's' : ''); };
const uptime = (P) => { const d = P.d; const boot = d._rt.bootAt; return boot === undefined ? 259200 + P.W.clock.elapsed : P.W.clock.elapsed - boot; };
const gwStatus = (P, gw) => {
  const p = N.ping(P.W, P.host, gw.ip);
  if (!p.ok) return { ok: false, rtt: null };
  return { ok: true, rtt: emu().rttMs(p.trace, 0) };
};
const fmtMs = ms => (ms === null || ms === undefined ? 'Pending' : ms.toFixed(1) + ' ms');

/* ================================================================== Dashboard */
PW.page('index.php', {
  crumbs: ['Status', 'Dashboard'],
  render: P => {
    const d = P.d; const W = P.W; const root = h('div'); const grid = h('div.pfw-grid'); root.append(grid);
    const dns = ((d.dns && d.dns.servers) || []).join(', ');
    const sys = PW.panel('System Information', PW.table(['', ''], [
      ['Name', (d.hostname || P.host) + (d.domain ? '.' + d.domain : '')], ['User', P.user() + '@' + ((N.l3up(W, P.desk.d)[0] || {}).ip || P.desk.d.name) + ' (Local Database)'], ['System', 'pfSense'],
      ['Version', '2.7.2-RELEASE (amd64)'], ['Uptime', ago(uptime(P))], ['Current date/time', PW.fmtTime(W.nowOf(P.host).getTime()) + ' UTC'], ['DNS server(s)', dns || '—']
    ].map(r => h('tr', h('td', h('b', r[0])), h('td', r[1])))), { flush: true });
    const ifRows = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).map(k => { const i = d.ifaces[k]; const up = !!(i.cable && i.cable.plugged) && !!i.ip; return h('tr', h('td', PW.ifLabel(d, k)), h('td', h('span.' + (up ? 'pfw-up' : 'pfw-down'), up ? '▲' : '▼')), h('td', i.ip ? i.ip + '/' + U.mask2len(i.mask) : 'n/a')); });
    const ifs = PW.panel('Interfaces', PW.table(['', '', ''], ifRows), { flush: true });
    const gws = (d.gateways || []).filter(x => !x.lanGw);
    const gwRows = gws.map(gw => { const s = gwStatus(P, gw); return h('tr', h('td', gw.name), h('td', gw.ip), h('td', fmtMs(s.rtt)), h('td', s.ok ? '0.0%' : '100.0%'), h('td', s.ok ? h('span.pfw-tag.ok', 'Online') : h('span.pfw-tag.ko', 'Offline'))); });
    const gwp = PW.panel('Gateways', PW.table(['Name', 'Gateway', 'RTT', 'Loss', 'Status'], gwRows), { flush: true });
    const svc = PW.panel('Services Status', PW.table(['Service', 'Status'], services(P).map(s => h('tr', h('td', s.name), h('td', s.run ? h('span.pfw-tag.ok', 'Running') : h('span.pfw-tag.ko', 'Stopped'))))), { flush: true });
    grid.append(h('div', sys, ifs), h('div', gwp, svc));
    return root;
  }
});

function services(P) {
  const d = P.d; const out = [];
  out.push({ name: 'dpinger', desc: 'Gateway Monitoring Daemon', run: true });
  if (d.dns && d.dns.unbound) out.push({ name: 'unbound', desc: 'DNS Resolver', run: !!d.dns.unbound.enabled });
  if (d.ipsec) out.push({ name: 'ipsec', desc: 'IPsec VPN', run: !!d.ipsec.enabled });
  ((d.openvpn && d.openvpn.servers) || []).forEach(s => out.push({ name: 'openvpn', desc: 'OpenVPN server: ' + (s.descr || s.id), run: !s.dis }));
  out.push({ name: 'sshd', desc: 'Secure Shell Daemon', run: !!(d.system && d.system.ssh && d.system.ssh.enabled) });
  out.push({ name: 'syslogd', desc: 'System Logger Daemon', run: true });
  if (PW.extraServices) PW.extraServices(P).forEach(x => out.push(x));
  return out;
}
PW.page('status_services.php', {
  crumbs: ['Status', 'Services'],
  render: P => PW.panel('Services', PW.table(['Service', 'Description', 'Status', 'Actions'], services(P).map(s => h('tr', h('td', s.name), h('td', s.desc), h('td', s.run ? h('span.pfw-tag.ok', 'Running') : h('span.pfw-tag.ko', 'Stopped')),
    h('td.act', (s.acts || []).map(op => h('a', { title: ({ restart: 'Restart Service', stop: 'Stop Service', start: 'Start Service' })[op], on: { click: e => { e.preventDefault(); PW.svcAction(P, s.key || s.name, op); } } }, PW.ic(op === 'restart' ? 'refresh' : op === 'stop' ? 'stop' : 'play'))))))), { flush: true })
});

/* ================================================================== Gateways */
PW.page('status_gateways.php', {
  crumbs: ['Status', 'Gateways'],
  render: P => {
    const gws = (P.d.gateways || []).filter(x => !x.lanGw);
    const rows = gws.map(gw => { const s = gwStatus(P, gw); return h('tr', h('td', gw.name + (gw.default ? ' (default)' : '')), h('td', gw.ip), h('td', gw.ip), h('td', fmtMs(s.rtt)), h('td', s.ok ? '0.0%' : '100.0%'), h('td', s.ok ? h('span.pfw-tag.ok', 'Online') : h('span.pfw-tag.ko', 'Offline')), h('td', gw.descr || '')); });
    return PW.panel('Gateways', PW.table(['Name', 'Gateway', 'Monitor', 'RTT', 'Loss', 'Status', 'Description'], rows), { flush: true });
  }
});

/* ================================================================== Interfaces */
PW.page('status_interfaces.php', {
  crumbs: ['Status', 'Interfaces'],
  render: P => {
    const d = P.d; const root = h('div');
    Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).forEach(k => {
      const i = d.ifaces[k]; const up = !!(i.cable && i.cable.plugged);
      root.append(PW.panel(PW.ifLabel(d, k) + ' Interface (' + k + ', ' + i.dev + ')', PW.table(['', ''], [
        ['Status', up ? 'up' : 'no carrier'], ['MAC Address', i.mac || '—'], ['IPv4 Address', i.ip || '—'], ['Subnet mask IPv4', i.mask || '—'], ['Gateway IPv4', ((d.gateways || []).find(x => x.iface === k && !x.lanGw) || {}).ip || '—']
      ].map(r => h('tr', h('td', h('b', r[0])), h('td', r[1])))), { flush: true }));
    });
    return root;
  }
});

/* ================================================================== IPsec */
PW.page('status_ipsec.php', {
  crumbs: ['Status', 'IPsec', 'Overview'],
  render: P => {
    const d = P.d; const W = P.W; const root = h('div'); const ip = d.ipsec || { enabled: false, tunnels: [] };
    if (!ip.enabled) { root.append(PW.alert('info', 'IPsec is not enabled.')); return root; }
    const rows = [];
    (ip.tunnels || []).forEach(t => {
      const s = PF.ipsecStatus(W, d, t); const wanIp = PF.ifIp(W, d, t.p1.iface || 'wan');
      const st = s.p1.up ? h('span', h('span.pfw-tag.ok', 'Established'), ' ', h('span.pfw-help', 'IKE SA')) : h('span', h('span.pfw-tag.ko', t.p1.disabled ? 'Disabled' : 'Disconnected'));
      const act = s.p1.up ? PW.btn('Disconnect', 'danger', () => { P.setFlash('info', 'Disconnect requested.'); P.go('status_ipsec.php'); }, { sm: true }) : PW.btn('Connect VPN', 'success', () => { P.desk.env.advance(3); P.desk.env.touch('ipsec-connect'); P.desk.act('pfSense : Status → IPsec — Connect VPN (' + (t.descr || t.id) + ')', { kind: 'ui' }); P.go('status_ipsec.php'); }, { sm: true });
      rows.push(h('tr', h('td', t.id), h('td', t.descr || ''), h('td', wanIp || ''), h('td', t.p1.remoteGw), h('td', 'Initiator'), h('td', st), h('td.act', act)));
      if (s.p1.up) (s.p2 || []).forEach(e => rows.push(h('tr', h('td'), h('td', { style: { paddingLeft: '28px' } }, 'Child SA'), h('td', e.local), h('td', e.remote), h('td', 'ESP'), h('td', e.up ? h('span.pfw-tag.ok', 'Installed') : h('span.pfw-tag.ko', e.err || 'Down')), h('td'))));
    });
    root.append(PW.panel('IPsec Status', PW.table(['ID', 'Description', 'Local', 'Remote', 'Role', 'Status', 'Actions'], rows), { flush: true }));
    return root;
  }
});

/* ================================================================== OpenVPN */
PW.page('status_openvpn.php', {
  crumbs: ['Status', 'OpenVPN'],
  render: P => {
    const d = P.d; const W = P.W; const root = h('div'); const ov = d.openvpn || { servers: [] };
    (ov.servers || []).forEach(s => {
      const clients = [];
      Object.keys(W.dev).forEach(id => { const c = W.dev[id]; if (c._rt && c._rt.vpn && c._rt.vpn.up && c._rt.vpn.server === d.id) { const prof = ((c.vpn && c.vpn.profiles) || [])[0] || {}; const cert = (ov.certs || []).find(x => x.name === prof.cert) || {}; clients.push({ cn: cert.cn || prof.cert || id, real: ((N.l3up(W, c)[0]) || {}).ip, virt: c._rt.vpn.ip, since: c._rt.vpn.since }); } });
      const rows = clients.map(c => h('tr', h('td', c.cn), h('td', c.real || ''), h('td', c.virt), h('td', PW.fmtTime(W.clock.base + (c.since || 0) * 1000))));
      root.append(PW.panel(s.descr + ' ' + (/^tcp/.test(s.proto) ? 'TCP' : 'UDP') + (/4$/.test(s.proto) ? '4' : '') + ':' + s.port + ' Client Connections', rows.length ? PW.table(['Common Name', 'Real Address', 'Virtual Address', 'Connected Since'], rows) : h('div', { style: { padding: '10px' } }, 'No OpenVPN clients connected.'), { flush: true }));
      root.append(PW.panel('Server status', h('div', { style: { padding: '10px' } }, s.dis ? h('span.pfw-tag.ko', 'Disabled') : h('span.pfw-tag.ok', 'up'), ' Tunnel network ' + s.tunnelNet), { flush: true }));
    });
    return root;
  }
});

/* ================================================================== System Logs */
const logTabs = (P, cur) => PW.tabs([
  { key: 'system', label: 'System', go: () => P.go('status_logs.php') }, { key: 'filter', label: 'Firewall', go: () => P.go('status_logs_filter.php') },
  { key: 'dhcp', label: 'DHCP', go: () => P.go('status_logs.php', { logfile: 'dhcpd' }) }, { key: 'ipsec', label: 'IPsec', go: () => P.go('status_logs_vpn.php', { vpntype: 'ipsec' }) },
  { key: 'openvpn', label: 'OpenVPN', go: () => P.go('status_logs_openvpn.php') }, { key: 'resolver', label: 'DNS Resolver', go: () => P.go('status_logs.php', { logfile: 'resolver' }) }], cur);
const logTable = (P, entries, proc) => entries.length
  ? PW.table(['Time', 'Process', 'Message'], entries.slice(-100).reverse().map(e => h('tr', h('td.pfw-mono', PW.fmtTime(e.t)), h('td', e.proc || proc), h('td.pfw-mono', e.msg))), {})
  : h('div', { style: { padding: '12px' } }, 'No logs to display.');
PW.page('status_logs.php', {
  crumbs: P => ['Status', 'System Logs', P.q.logfile === 'dhcpd' ? 'DHCP' : P.q.logfile === 'resolver' ? 'DNS Resolver' : 'System'],
  render: P => {
    const root = h('div'); const cur = P.q.logfile === 'dhcpd' ? 'dhcp' : P.q.logfile === 'resolver' ? 'resolver' : 'system'; root.append(logTabs(P, cur));
    const chan = cur === 'system' ? 'system' : cur === 'dhcp' ? 'dhcpd' : 'resolver';
    root.append(PW.panel('Last 100 ' + (cur === 'system' ? 'System' : cur === 'dhcp' ? 'DHCP' : 'Resolver') + ' Log Entries', logTable(P, P.W.logs(P.host, chan), cur === 'system' ? 'system' : cur === 'dhcp' ? 'dhcpd' : 'unbound'), { flush: true }));
    return root;
  }
});
PW.page('status_logs_filter.php', {
  crumbs: ['Status', 'System Logs', 'Firewall', 'Normal View'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(logTabs(P, 'filter'));
    const L = (d._rt.fwlog || []).slice(-100).reverse();
    const rows = L.map(e => {
      const proto = e.proto === 'tcp' ? 'TCP:S' : e.proto === 'udp' ? 'UDP' : e.proto === 'icmp' ? 'ICMP' : String(e.proto || '').toUpperCase();
      const src = e.sip + (e.sport ? ':' + e.sport : ''), dst = e.dip + (e.dport ? ':' + e.dport : '');
      return h('tr', h('td', PW.ic(e.act === 'pass' ? 'pass' : 'block', e.act === 'pass' ? 'pass' : 'block')), h('td.pfw-mono', PW.fmtTime(e.t).slice(7)), h('td', e.ifname), h('td', e.rule || ''), h('td.pfw-mono', src), h('td.pfw-mono', dst), h('td', proto));
    });
    root.append(PW.panel('Last ' + Math.max(L.length, 0) + ' Firewall Log Entries. (Maximum 100)', rows.length ? PW.table(['Act', 'Time', 'Interface', 'Rule', 'Source', 'Destination', 'Protocol'], rows) : h('div', { style: { padding: '12px' } }, 'No logs to display.'), { flush: true }));
    return root;
  }
});
PW.page('status_logs_vpn.php', {
  crumbs: ['Status', 'System Logs', 'IPsec'],
  render: P => { const root = h('div'); root.append(logTabs(P, 'ipsec')); root.append(PW.panel('Last 100 IPsec Log Entries', logTable(P, P.W.logs(P.host, 'ipsec'), 'charon'), { flush: true })); return root; }
});
PW.page('status_logs_openvpn.php', {
  crumbs: ['Status', 'System Logs', 'OpenVPN'],
  render: P => { const root = h('div'); root.append(logTabs(P, 'openvpn')); root.append(PW.panel('Last 100 OpenVPN Log Entries', logTable(P, P.W.logs(P.host, 'openvpn'), 'openvpn'), { flush: true })); return root; }
});

/* ================================================================== Diagnostics */
const outBox = lines => h('div.pfw-pre', lines.map(l => l.t).join('\n'));
const pseudoSession = P => ({ W: P.W, d: P.d, devId: P.host, env: P.desk.env });
PW.page('diag_ping.php', {
  crumbs: ['Diagnostics', 'Ping'],
  render: P => {
    const root = h('div'); const res = h('div');
    const form = PW.form(P, {
      title: 'Ping',
      fields: [
        { k: 'host', label: 'Hostname', type: 'text', value: P.q.host || '', help: 'Enter the hostname or IP address to ping.' },
        { k: 'af', label: 'IP Protocol', type: 'select', options: [{ value: 'inet', label: 'IPv4' }], value: 'inet' },
        { k: 'src', label: 'Source address', type: 'select', options: [{ value: '', label: 'Automatically selected (default)' }], value: '', help: 'Select source address for the ping.' },
        { k: 'cnt', label: 'Maximum number of pings', type: 'select', options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ value: n, label: String(n) })), value: 3, w: 120 }
      ],
      saveLabel: 'Ping',
      save: v => {
        if (!v.host.trim()) return ['A valid hostname or IP address must be specified.'];
        const o = new (emu().Out)(); P.desk.env.advance(1); emu().pfc.ping(pseudoSession(P), v.host.trim(), o, +v.cnt || 3);
        P.desk.act('pfSense : Diagnostics → Ping ' + v.host.trim(), { kind: 'ui' });
        UI.clear(res); res.append(PW.panel('Results', outBox(o.lines))); return null;
      }
    });
    root.append(form.el, res); return root;
  }
});
PW.page('diag_dns.php', {
  crumbs: ['Diagnostics', 'DNS Lookup'],
  render: P => {
    const root = h('div'); const res = h('div');
    const form = PW.form(P, {
      title: 'Resolve',
      fields: [{ k: 'host', label: 'Hostname', type: 'text', value: P.q.host || '', help: 'Enter the hostname or IP address to look up.' }],
      saveLabel: 'DNS Lookup',
      save: v => {
        const name = v.host.trim(); if (!name) return ['A valid hostname or IP address must be specified.'];
        P.desk.env.advance(1); const r = SIM.squid.lookup(P.W, P.d, name); P.desk.env.obs('resolve:' + P.host + ':' + name, !!r.ok); P.desk.act('pfSense : Diagnostics → DNS Lookup ' + name, { kind: 'ui' });
        UI.clear(res);
        if (!r.ok) res.append(PW.alert('danger', 'Host "' + name + '" could not be resolved.'));
        else res.append(PW.panel('Results', PW.table(['Name', 'Type', 'Address'], r.answers.map(a => h('tr', h('td', a.name), h('td', a.type), h('td', a.data)))), { flush: true }), PW.panel('Resolution time per server', PW.table(['Server', 'Query time'], [h('tr', h('td', r.server), h('td', '1 msec'))]), { flush: true }));
        return null;
      }
    });
    root.append(form.el, res); return root;
  }
});
PW.page('diag_testport.php', {
  crumbs: ['Diagnostics', 'Test Port'],
  render: P => {
    const root = h('div'); const res = h('div');
    const form = PW.form(P, {
      title: 'Test Port',
      fields: [
        { k: 'host', label: 'Hostname', type: 'text', value: '', help: 'Enter the hostname or IP address to connect to.' },
        { k: 'port', label: 'Port', type: 'text', value: '', w: 120, help: 'Enter the port to connect to.' }
      ],
      saveLabel: 'Test',
      save: v => {
        const errs = []; if (!v.host.trim()) errs.push('A valid hostname or IP address must be specified.'); if (!/^\d+$/.test(v.port) || +v.port < 1 || +v.port > 65535) errs.push('A valid port number must be specified.'); if (errs.length) return errs;
        let ip = v.host.trim(); if (!U.isIP(ip)) { const r = N.resolve(P.W, P.host, ip, { noCache: true }); if (!r.ok) { UI.clear(res); res.append(PW.alert('danger', 'Host "' + ip + '" could not be resolved.')); return null; } ip = r.ip; }
        P.desk.env.advance(2); const c = N.connect(P.W, P.host, ip, 'tcp', +v.port, {}); P.desk.env.obs('connect:' + P.host + ':' + ip + ':' + v.port, c.state === 'open'); P.desk.act('pfSense : Diagnostics → Test Port ' + ip + ':' + v.port, { kind: 'ui' });
        UI.clear(res); res.append(PW.panel('Results', h('div.pfw-pre', c.state === 'open' ? 'Connection to ' + ip + ' port ' + v.port + ' [tcp/*] succeeded!' : (c.state === 'refused' ? 'Connection to ' + ip + ' port ' + v.port + ' [tcp/*] refused.' : 'Connection to ' + ip + ' port ' + v.port + ' [tcp/*] timed out.'))));
        return null;
      }
    });
    SIM.AVREG['pfsense-gui-testport'] = 'Interface web pfSense, Diagnostics → Test Port : texte du résultat (« Connection to … succeeded! ») — à vérifier.';
    root.append(form.el, res); return root;
  }
});
PW.page('diag_routes.php', {
  crumbs: ['Diagnostics', 'Routes'],
  render: P => {
    const d = P.d; const rts = N.routes(P.W, d);
    const rows = rts.map(r => h('tr', h('td', r.net === '0.0.0.0' && r.len === 0 ? 'default' : r.net + '/' + r.len), h('td', r.nh || 'link#' + (Object.keys(d.ifaces).indexOf(r.iface) + 1)), h('td', r.nh ? 'UGS' : 'U'), h('td', PW.ifLabel(d, r.iface))));
    return PW.panel('Routes (IPv4)', PW.table(['Destination', 'Gateway', 'Flags', 'Interface'], rows), { flush: true });
  }
});
PW.page('diag_reboot.php', {
  crumbs: ['Diagnostics', 'Reboot System'],
  render: P => PW.panel('Reboot', h('div', h('p', 'Click "Reboot" to reboot the system immediately, or "No" to go to the system dashboard without rebooting. (There will be a brief delay before the dashboard appears.)'),
    PW.btn('Reboot', 'danger', () => { P.d._rt.bootAt = P.W.clock.elapsed; P.desk.env.advance(120); P.desk.env.touch('reboot'); P.desk.change('pfSense : Diagnostics → Reboot (redémarrage du pare-feu)', { dev: P.host, impact: 'reboot' }); P.setFlash('info', 'The system is rebooting now. This may take one minute or so.'); P.go('index.php'); }), PW.btn('No', '', () => P.go('index.php'))))
});
PW.page('diag_command.php', {
  crumbs: ['Diagnostics', 'Command Prompt'],
  render: P => {
    const root = h('div'); const res = h('div'); const PfC = emu().PfConsole;
    const form = PW.form(P, {
      title: 'Execute Shell Command',
      fields: [{ k: 'cmd', label: 'Command', type: 'text', value: '', help: 'Sous-ensemble du shell FreeBSD : hostname, whoami, ping.' }],
      saveLabel: 'Execute',
      save: v => {
        const s = new PfC(P.desk.env, P.host, { user: 'root' }); s.mode = 'shell'; const r = s.run(v.cmd); P.desk.act('pfSense : Diagnostics → Command Prompt « ' + v.cmd + ' »', { kind: 'ui' });
        UI.clear(res); res.append(PW.panel('Shell Output', outBox(r.out || []))); return null;
      }
    });
    root.append(form.el, res); return root;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
