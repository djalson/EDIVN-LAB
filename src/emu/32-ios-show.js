/* ============================================================================
   Cisco IOS — commandes « show », ping, traceroute et rendu du running-config.
   Toutes les sorties sont calculées depuis le modèle (jamais figées par scénario).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, IOS = SIM.ios;
const E = SIM.emu; const L = E.L; const I = E.ios; const def = I.def, D = I.D;
const pad = E.padR, padl = E.padL;
const W_ = E.win;
const H = I.l2h = I.l2h || {};   // crochets EtherChannel / Spanning Tree (remplis par 34-ios-l2.js)

U.av('ios-version-text', 'Texte de « show version » (version d’IOS, dates de compilation, matériel, numéro de série) : valeurs plausibles pour l’image supposée du laboratoire, à vérifier.');
U.av('ios-show-format', 'Mise en page exacte de certains « show » (cdp, port-security, dhcp, nat, interfaces) : approximation d’IOS 15.0 (2960) / 15.2 (2911).');
U.av('ios-status-cols', 'Alignement exact des colonnes Duplex/Speed de « show interfaces status » pour les débits à 6 caractères (a-1000) : à vérifier.');
U.av('ios-mac-static', 'Entrées « All … STATIC CPU » de la table MAC : liste de référence d’un 2960, à vérifier.');

/* ------------------------------------------------------------------ helpers */
const hostName = d => d.hostname || (d.kind === 'ios-sw' ? 'Switch' : 'Router');
const isSw = d => d.kind === 'ios-sw';
const dotted = I.macDotted;
const hms = sec => U.pad2(Math.floor(sec / 3600)) + ':' + U.pad2(Math.floor(sec / 60) % 60) + ':' + U.pad2(sec % 60);
const upSince = (s) => { const b = s.d._rt.bootAt !== undefined ? s.d._rt.bootAt : -(26 * 3600); return Math.max(0, Math.round(s.W.clock.elapsed - b)); };
function uptimeText(sec) {
  const m = Math.floor(sec / 60), h = Math.floor(m / 60), dd = Math.floor(h / 24); const w = Math.floor(dd / 7);
  const parts = []; if (w) parts.push(w + ' week' + (w > 1 ? 's' : '')); const d2 = dd % 7; if (d2) parts.push(d2 + ' day' + (d2 > 1 ? 's' : '')); const h2 = h % 24; if (h2 || parts.length) parts.push(h2 + ' hour' + (h2 !== 1 ? 's' : '')); parts.push((m % 60) + ' minute' + ((m % 60) !== 1 ? 's' : ''));
  return parts.join(', ');
}
const baseMac = d => dotted(U.mac(d.id + ':base'));
const ifMacOf = (d, n) => { if (isSw(d)) return d.ports[n] ? I.portMac(d, n) : baseMac(d); const i = d.ifaces[n]; const p = i && i.parent ? d.ifaces[i.parent] : i; return dotted((p && p.mac) || U.mac(d.id + ':' + (i && i.parent || n))); };
function l3list(s) { return N.l3(s.W, s.d); }
function ifaceNames(d) {
  if (isSw(d)) return ['Vlan1'].concat(Object.keys(d.svi || {}).filter(n => n !== 'Vlan1')).sort(I.portOrder).concat(I.portNames(d));
  return Object.keys(d.ifaces).sort(I.portOrder);
}
function phys(s, name) {
  const d = s.d;
  if (isSw(d)) { if (/^Vlan/.test(name)) { const sv = (d.svi || {})[name]; const l = N.l3(s.W, d).find(x => x.name === name); return { admin: !(sv && sv.shut) && !!sv, up: !!(l && l.up), exists: !!sv, svi: true, sv }; } const p = d.ports[name]; const st = IOS.portStatus(s.W, d, name); return { admin: !p.adminDown, up: st === 'connected', status: st, exists: true, port: p }; }
  const i = d.ifaces[name]; const l = N.l3(s.W, d).find(x => x.name === name);
  const physUp = (i.parent || i.virtual) ? !!(l && l.up) : N.linkUp(s.W, d, name);
  return { admin: !i.adminDown, up: !i.adminDown && physUp, exists: true, iface: i };
}
function vlanOfPortOk(d, p) { return p.mode === 'trunk' || (d.vlans && d.vlans[p.vlan || 1] && !d.vlans[p.vlan || 1].suspend); }
function portState(s, name) {
  const d = s.d; const p = d.ports[name]; const st = IOS.portStatus(s.W, d, name);
  if (st === 'connected' && !vlanOfPortOk(d, p)) return 'inactive';
  return st;
}

/* ------------------------------------------------------------------ running-config */
const SW_VER = '15.0', RT_VER = '15.2';
function cfgLines(d, v) {
  const out = []; const sw = isSw(d); const push = (...x) => x.forEach(t => out.push(t));
  const host = v.hostname || hostName(d);
  push('!', 'version ' + (sw ? SW_VER : RT_VER)); if (sw) push('no service pad'); push('service timestamps debug datetime msec', 'service timestamps log datetime msec', 'no service password-encryption');
  push('!', 'hostname ' + host, '!', 'boot-start-marker', 'boot-end-marker', '!');
  if (v.enablePwd !== undefined && v.enablePwd !== '') push(v.enableSecret ? 'enable secret 5 ' + I.hashSecret(v.enablePwd) : 'enable password ' + v.enablePwd, '!');
  (v.users || []).forEach(u => push('username ' + u.name + (u.priv !== undefined && u.priv !== 1 ? ' privilege ' + u.priv : '') + (u.pwd !== undefined ? ' secret 5 ' + I.hashSecret(u.pwd) : '')));
  if ((v.users || []).length) push('no aaa new-model');
  if (sw) push('system mtu routing 1500'); if (sw && !/3560/.test(d.model || '')) push('ip subnet-zero');
  if (v.ipRouting && sw) push('ip routing'); else if (sw && /3560/.test(d.model || '')) push('no ip routing');
  push('!');
  /* DHCP */
  if (v.dhcp) {
    if (v.dhcp.service === false) push('no service dhcp');
    (v.dhcp.excluded || []).forEach(e => push('ip dhcp excluded-address ' + e.start + (e.end && e.end !== e.start ? ' ' + e.end : '')));
    push('!');
    (v.dhcp.pools || []).forEach(p => {
      push('ip dhcp pool ' + p.name); if (p.net) push(' network ' + p.net + ' ' + p.mask); if (p.domain) push(' domain-name ' + p.domain); if (p.dns && p.dns.length) push(' dns-server ' + p.dns.join(' ')); if (p.gw) push(' default-router ' + p.gw); if (p.leaseDays && p.leaseDays !== 1) push(' lease ' + p.leaseDays); push('!');
    });
  }
  if (v.domainLookup === false) push('no ip domain-lookup');
  if (v.domain) push('ip domain-name ' + v.domain);
  if (v.ssh && v.ssh.version) push('ip ssh version ' + v.ssh.version);
  if (v.ssh && v.ssh.timeout && v.ssh.timeout !== 120) push('ip ssh time-out ' + v.ssh.timeout); if (v.ssh && v.ssh.retries && v.ssh.retries !== 3) push('ip ssh authentication-retries ' + v.ssh.retries);
  ((v.extra && v.extra.global) || []).forEach(t => push(t));
  push('!');
  if (sw) { H.stpGlobal(v).forEach(t => push(t)); push('!'); const vl = Object.keys(v.vlans || {}).map(Number).filter(n => n !== 1).sort((a, b) => a - b); vl.forEach(n => { push('vlan ' + n); push(' name ' + v.vlans[n].name); if (v.vlans[n].suspend) push(' state suspend'); push('!'); }); push('vlan internal allocation policy ascending', '!'); }
  /* interfaces */
  const nm = (n) => n;
  if (sw) {
    Object.keys(v.ports).sort(I.portOrder).forEach(n => {
      const p = v.ports[n]; push('interface ' + n);
      if (p.desc) push(' description ' + p.desc);
      if (p.mode === 'trunk') {
        if (/3560/.test(d.model || '')) push(' switchport trunk encapsulation dot1q');
        if (p.native && p.native !== 1) push(' switchport trunk native vlan ' + p.native);
        if (p.allowed !== 'all' && p.allowed !== undefined) push(' switchport trunk allowed vlan ' + (p.allowed.length ? I.vlanText(p.allowed.slice().sort((a, b) => a - b)) : 'none').replace(/^none$/, 'none'));
        push(' switchport mode trunk');
      } else if ((p.vlan && p.vlan !== 1) || (p.psec && p.psec.enabled)) { if (p.vlan && p.vlan !== 1) push(' switchport access vlan ' + p.vlan); push(' switchport mode access'); }
      if (p.psec && p.psec.enabled) {
        push(' switchport port-security'); if (p.psec.max && p.psec.max !== 1) push(' switchport port-security maximum ' + p.psec.max);
        if (p.psec.violation && p.psec.violation !== 'shutdown') push(' switchport port-security violation ' + p.psec.violation);
        if (p.psec.sticky) { push(' switchport port-security mac-address sticky'); (p.psec.macs || []).forEach(m => push(' switchport port-security mac-address sticky ' + dotted(m))); }
        else (p.psec.macs || []).forEach(m => push(' switchport port-security mac-address ' + dotted(m)));
      }
      if (p.speed) push(' speed ' + p.speed); if (p.duplex) push(' duplex ' + p.duplex);
      (p.extra || []).forEach(t => push(' ' + t));
      H.ifLines(p, n).forEach(t => push(t));
      if (p.adminDown) push(' shutdown');
      push('!');
    });
    const svis = Object.keys(v.svi || {}); if (svis.indexOf('Vlan1') < 0) svis.push('Vlan1');
    svis.sort(I.portOrder).forEach(n => {
      const sv = (v.svi || {})[n] || {}; push('interface ' + n);
      if (sv.desc) push(' description ' + sv.desc);
      if (sv.ip) push(' ip address ' + sv.ip + ' ' + sv.mask); else push(' no ip address');
      (sv.helpers || []).forEach(h => push(' ip helper-address ' + h));
      if (sv.aclIn) push(' ip access-group ' + sv.aclIn + ' in'); if (sv.aclOut) push(' ip access-group ' + sv.aclOut + ' out');
      if (sv.natSide) push(' ip nat ' + sv.natSide);
      if (sv.shut || (n === 'Vlan1' && !sv.ip && !v.svi.Vlan1)) push(' shutdown');
      push('!');
    });
  } else {
    Object.keys(v.ifaces).sort(I.portOrder).forEach(n => {
      const i = v.ifaces[n]; push('interface ' + n);
      if (i.desc) push(' description ' + i.desc);
      if (i.encap !== undefined) push(' encapsulation dot1Q ' + i.encap + (i.native ? ' native' : ''));
      if (i.ip) push(' ip address ' + i.ip + ' ' + i.mask); else push(' no ip address');
      (i.helpers || []).forEach(h => push(' ip helper-address ' + h));
      if (i.aclIn) push(' ip access-group ' + i.aclIn + ' in'); if (i.aclOut) push(' ip access-group ' + i.aclOut + ' out');
      if (i.natSide) push(' ip nat ' + i.natSide);
      if (i.ospfCost) push(' ip ospf cost ' + i.ospfCost);
      if (i.ospfPriority !== undefined) push(' ip ospf priority ' + i.ospfPriority);
      if (i.ospfHello) push(' ip ospf hello-interval ' + i.ospfHello);
      if (i.ospfDead) push(' ip ospf dead-interval ' + i.ospfDead);
      if (i.ospfArea !== undefined) push(' ip ospf ' + ((v.ospf && v.ospf.pid) || 1) + ' area ' + i.ospfArea);
      if (!i.parent && !i.virtual) { push(' duplex ' + (i.duplex || 'auto')); push(' speed ' + (i.speed || 'auto')); }
      (i.extra || []).forEach(t => push(' ' + t));
      if (i.adminDown) push(' shutdown');
      push('!');
    });
  }
  /* routage dynamique */
  if (v.ospf) {
    const o = v.ospf; push('router ospf ' + (o.pid || 1));
    if (o.routerId) push(' router-id ' + o.routerId);
    push(' log-adjacency-changes');
    if (o.refBw && o.refBw !== 100) push(' auto-cost reference-bandwidth ' + o.refBw);
    if (o.passiveDefault) push(' passive-interface default');
    (o.networks || []).forEach(n => push(' network ' + n.net + ' ' + n.wild + ' area ' + n.area));
    if (o.passiveDefault) (o.nonPassive || []).forEach(n => push(' no passive-interface ' + n)); else (o.passive || []).forEach(n => push(' passive-interface ' + n));
    if (o.defaultOriginate) push(' default-information originate' + (o.defaultOriginate.always ? ' always' : ''));
    push('!');
  }
  /* routage, NAT, ACL */
  if (v.defaultGateway) push('ip default-gateway ' + v.defaultGateway);
  (v.routes || []).forEach(r => push('ip route ' + r.net + ' ' + r.mask + ' ' + (r.nh || r.iface) + (r.ad && r.ad !== 1 ? ' ' + r.ad : '')));
  if (v.nat) {
    Object.keys(v.nat.pools || {}).forEach(k => push('ip nat pool ' + k + ' ' + v.nat.pools[k].start + ' ' + v.nat.pools[k].end + ' netmask ' + v.nat.pools[k].mask));
    (v.nat.rules || []).forEach(r => {
      if (r.type === 'dynamic') push('ip nat inside source list ' + r.acl + (r.pool ? ' pool ' + r.pool : ' interface ' + r.iface) + (r.overload ? ' overload' : ''));
      else if (r.proto) push('ip nat inside source static ' + r.proto + ' ' + r.local + ' ' + r.lport + ' ' + r.global + ' ' + r.gport);
      else push('ip nat inside source static ' + r.local + ' ' + r.global);
    });
  }
  push('!');
  const acls = v.acls || {}; const named = [];
  Object.keys(acls).sort((a, b) => (+a || 1e9) - (+b || 1e9) || a.localeCompare(b)).forEach(k => {
    const a = acls[k];
    if (/^\d+$/.test(k)) a.entries.forEach(e => push('access-list ' + k + ' ' + I.entryText(a.type, e)));
    else named.push(k);
  });
  named.forEach(k => { const a = acls[k]; push('ip access-list ' + a.type + ' ' + k); a.entries.forEach(e => push(' ' + I.entryText(a.type, e))); push('!'); });
  if (Object.keys(acls).some(k => /^\d+$/.test(k))) push('!');
  if (v.banner) push('banner motd ^C' + v.banner + '^C', '!');
  const ln = v.lines || {};
  const lineBody = (c) => { const o = []; if (c.accessClass) o.push(' access-class ' + c.accessClass + ' in'); if (c.execTimeout) o.push(' exec-timeout ' + c.execTimeout); if (c.password) o.push(' password ' + c.password); if (c.loggingSync) o.push(' logging synchronous'); if (c.login === 'local') o.push(' login local'); else if (c.login === 'login') o.push(' login'); if (c.transport && c.transport.length) o.push(' transport input ' + c.transport.join(' ')); return o; };
  push('line con 0'); lineBody(ln.console || {}).forEach(t => push(t));
  const vt = lineBody(ln.vty || {}); push('line vty 0 4'); vt.forEach(t => push(t)); push('line vty 5 15'); vt.forEach(t => push(t));
  push('!', 'end');
  return out;
}
I.configOf = function (d) { return d; };
function renderRunning(s, ifOnly) {
  const d = s.d; const lines = cfgLines(d, d);
  if (!ifOnly) return lines;
  const name = ifOnly; const out = []; let on = false;
  lines.forEach(l => { if (l === 'interface ' + name) { on = true; out.push('!'); out.push(l); return; } if (on) { if (l === '!') { on = false; return; } out.push(l); } });
  return out.length ? out.concat(['end']) : null;
}
def('P', 'show running-config', 'Current operating configuration', function (a, rest, o) {
  const body = renderRunning(this); o.l('Building configuration...'); o.l(''); o.l('Current configuration : ' + (body.join('\n').length + 80) + ' bytes'); body.forEach(l => o.l(l));
});
def('P', 'show running-config interface <if>', 'Show interface configuration', function (a, rest, o) {
  const ref = I.ifRef(this.d, a[0], false); if (!ref) { o.l("% Invalid input detected at '^' marker."); o.l(''); return; }
  const body = renderRunning(this, ref.name); o.l('Building configuration...'); o.l(''); o.l('Current configuration : ' + (body ? body.join('\n').length + 20 : 0) + ' bytes'); (body || []).forEach(l => o.l(l));
});
D('show running-config interface', 'Show interface configuration');
def('P', 'show startup-config', 'Contents of startup configuration', function (a, rest, o) {
  const d = this.d; const st = d._rt.startup;
  if (!st || st.__blank) { o.l('startup-config is not present'); return; }
  const view = Object.assign({}, d, st); const body = cfgLines(d, view);
  o.l('Using ' + (body.join('\n').length + 80) + ' out of 65536 bytes'); o.l(''); body.forEach(l => o.l(l));
});
def('P', 'show archive config differences', 'Show differences', function (a, rest, o) { o.l('% Invalid input detected'); });
I.cfgLines = cfgLines;

/* ------------------------------------------------------------------ show version / clock / users / history */
def('UP', 'show version', 'System hardware and software status', function (a, rest, o) {
  const d = this.d; const sw = isSw(d); const sec = upSince(this); const serial = 'FOC' + U.hash8(d.id).toUpperCase().slice(0, 7);
  if (sw) {
    const is3560 = /3560/.test(d.model || '');
    o.l(is3560 ? 'Cisco IOS Software, C3560 Software (C3560-IPSERVICESK9-M), Version 12.2(55)SE12, RELEASE SOFTWARE (fc2)' : 'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)');
    o.l('Technical Support: http://www.cisco.com/techsupport'); o.l('Copyright (c) 1986-2013 by Cisco Systems, Inc.'); o.l(''); o.l('ROM: Bootstrap program is ' + (is3560 ? 'C3560' : 'C2960') + ' boot loader');
    o.l(''); o.l(hostName(d) + ' uptime is ' + uptimeText(sec)); o.l('System returned to ROM by power-on'); o.l('System image file is "flash:' + (is3560 ? 'c3560-ipservicesk9-mz.122-55.SE12.bin' : 'c2960-lanbasek9-mz.150-2.SE4.bin') + '"'); o.l('');
    o.l('cisco WS-' + (is3560 ? 'C3560-24PS-S (PowerPC405) processor (revision G0) with 131072K bytes of memory.' : 'C2960-24TT-L (PowerPC405) processor (revision N0) with 65536K bytes of memory.'));
    o.l('Processor board ID ' + serial); o.l('Last reset from power-on'); const nfa = Object.keys(d.ports).filter(n => /^Fast/.test(n)).length, ngi = Object.keys(d.ports).filter(n => /^Giga/.test(n)).length;
    o.l('1 Virtual Ethernet interface'); o.l(nfa + ' FastEthernet interfaces'); o.l(ngi + ' Gigabit Ethernet interfaces'); o.l('The password-recovery mechanism is enabled.'); o.l('');
    o.l('Base ethernet MAC Address       : ' + baseMac(d).toUpperCase().replace(/(..)(..)\.(..)(..)\.(..)(..)/, '$1:$2:$3:$4:$5:$6')); o.l('Configuration register is 0xF');
  } else {
    o.l('Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.2(4)M3, RELEASE SOFTWARE (fc2)'); o.l('Technical Support: http://www.cisco.com/techsupport'); o.l('Copyright (c) 1986-2013 by Cisco Systems, Inc.'); o.l('Compiled Fri 20-Dec-13 13:52 by prod_rel_team'); o.l('');
    o.l('ROM: System Bootstrap, Version 15.0(1r)M16, RELEASE SOFTWARE (fc1)'); o.l(''); o.l(hostName(d) + ' uptime is ' + uptimeText(sec)); o.l('System returned to ROM by power-on'); o.l('System image file is "flash:c2900-universalk9-mz.SPA.152-4.M3.bin"'); o.l('Last reload type: Normal Reload'); o.l('');
    o.l('Cisco CISCO2911/K9 (revision 1.0) with 487424K/36864K bytes of memory.'); o.l('Processor board ID ' + serial); o.l(Object.keys(d.ifaces).filter(n => !/\./.test(n)).length + ' Gigabit Ethernet interfaces'); o.l('DRAM configuration is 64 bits wide with parity enabled.'); o.l('255K bytes of non-volatile configuration memory.'); o.l('250880K bytes of ATA System CompactFlash 0 (Read/Write)'); o.l(''); o.l('Configuration register is 0x2102');
  }
  U.av('ios-version-text', 'show version');
});
def('UP', 'show clock', 'Display the system clock', function (a, rest, o) { const t = new Date(this.W.clock.base + this.W.clock.elapsed * 1000); o.l('*' + E.frTime(t) + '.' + String(((this.W.clock.elapsed * 53) % 1000) | 0).padStart(3, '0') + ' UTC ' + E.EN_DAYS[t.getUTCDay()] + ' ' + E.EN_MONTHS[t.getUTCMonth()] + ' ' + t.getUTCDate() + ' ' + t.getUTCFullYear()); });
def('UP', 'show users', 'Display information about terminal lines', function (a, rest, o) {
  o.l('    Line       User       Host(s)              Idle       Location');
  if (this.via === 'console') o.l('*  0 con 0                idle                 00:00:00');
  else { o.l('   0 con 0                idle                 00:00:00 '); o.l('*  1 vty 0     ' + pad(this.user || '', 10) + ' idle                 00:00:00 ' + (this.remote || '')); }
});
def('UP', 'show history', 'Display the session command history', function (a, rest, o) { this.history.slice(-10).forEach(h => o.l('  ' + h)); });
def('UP', 'show privilege', 'Show current privilege level', function (a, rest, o) { o.l('Current privilege level is ' + this.priv); });
def('UP', 'show ssh', 'Status of SSH server connections', function (a, rest, o) {
  if (this.via === 'vty') { o.l('Connection Version Mode Encryption  Hmac         State                 Username'); o.l('0          2.0     IN   aes128-cbc hmac-sha1    Session started       ' + (this.user || '')); o.l('0          2.0     OUT  aes128-cbc hmac-sha1    Session started       ' + (this.user || '')); }
  else { o.l('%No SSHv2 server connections running.'); o.l('%No SSHv1 server connections running.'); }
});
def('UP', 'show ip ssh', 'Information on SSH', function (a, rest, o) {
  const d = this.d; const ready = IOS.sshReady(d); const v = d.ssh && d.ssh.version === 2 ? '2.0' : '1.99';
  if (ready.ok) { o.l('SSH Enabled - version ' + v); } else { o.l('SSH Disabled - version ' + v); o.l(U.av('ios-ssh-disabled', '%Please create RSA keys to enable SSH (and of at least 768 bits for SSH v2).')); }
  o.l('Authentication timeout: ' + ((d.ssh && d.ssh.timeout) || 120) + ' secs; Authentication retries: ' + ((d.ssh && d.ssh.retries) || 3));
});

/* ------------------------------------------------------------------ interfaces */
def('UP', 'show ip interface brief', 'Brief summary of IP status and configuration', function (a, rest, o) {
  const d = this.d; o.l('Interface              IP-Address      OK? Method Status                Protocol');
  ifaceNames(d).forEach(n => {
    const ph = phys(this, n); let ip = 'unassigned', method = 'unset';
    if (isSw(d) && /^Vlan/.test(n)) { const sv = (d.svi || {})[n]; if (sv && sv.ip) { ip = sv.ip; method = 'manual'; } }
    else if (!isSw(d)) { const i = d.ifaces[n]; if (i.ip) { ip = i.ip; method = 'manual'; } }
    let status, proto;
    if (isSw(d) && /^Vlan/.test(n)) { const sv = (d.svi || {})[n]; if (!sv || sv.shut || !sv) { status = 'administratively down'; proto = 'down'; } else { status = ph.up ? 'up' : 'down'; proto = ph.up ? 'up' : 'down'; } }
    else if (isSw(d)) { const st = portState(this, n); status = st === 'disabled' ? 'administratively down' : (st === 'connected' ? 'up' : 'down'); proto = st === 'connected' ? 'up' : 'down'; }
    else { const i = d.ifaces[n]; status = i.adminDown ? 'administratively down' : (ph.up ? 'up' : 'down'); proto = (!i.adminDown && ph.up) ? 'up' : 'down'; }
    o.l(pad(n, 23) + pad(ip, 16) + 'YES ' + pad(method, 7) + pad(status, 22) + proto);
  });
});
D('show ip interface', 'IP interface status and configuration');
def('UP', 'show ip interface <if>', 'IP interface status and configuration', function (a, rest, o) {
  const d = this.d; const ref = I.ifRef(d, a[0], false); if (!ref || ref.kind === 'port') { o.l("% Invalid input detected at '^' marker."); o.l(''); return; }
  const ph = phys(this, ref.name); const x = ref.obj; const up = ph.up;
  o.l(ref.name + ' is ' + (!ph.admin ? 'administratively down' : up ? 'up' : 'down') + ', line protocol is ' + (up ? 'up' : 'down'));
  if (x.ip) {
    o.l('  Internet address is ' + x.ip + '/' + U.mask2len(x.mask)); o.l('  Broadcast address is 255.255.255.255'); o.l('  Address determined by setup command'); o.l('  MTU is 1500 bytes');
    o.l((x.helpers && x.helpers.length) ? '  Helper address is ' + x.helpers[0] : '  Helper address is not set'); (x.helpers || []).slice(1).forEach(h => o.l('                    ' + h));
    o.l('  Directed broadcast forwarding is disabled'); o.l('  Outgoing access list is ' + (x.aclOut || 'not set')); o.l('  Inbound  access list is ' + (x.aclIn || 'not set'));
    o.l('  Proxy ARP is enabled'); o.l('  Local Proxy ARP is disabled'); o.l('  Security level is default'); o.l('  Split horizon is enabled'); o.l('  ICMP redirects are always sent'); o.l('  ICMP unreachables are always sent'); o.l('  ICMP mask replies are never sent');
    if (x.natSide) o.l('  Network address translation is ' + (x.natSide === 'inside' ? 'enabled, interface in domain inside' : 'enabled, interface in domain outside')); else o.l('  Network address translation is disabled');
  } else o.l('  Internet protocol processing disabled');
});
D('show ip interface brief', 'Brief summary of IP status and configuration');
/* Compteurs : le simulateur ne compte pas les paquets ; on dérive des valeurs stables et croissantes de l'uptime (jamais 0 sur une liaison active). */
U.av('ios-counters', 'Compteurs de « show interfaces » (paquets/octets) : valeurs synthétiques croissantes avec l’uptime, non issues d’un vrai trafic.');
function ctr(s, n, up) {
  if (!up) return null;
  const h = parseInt(U.hash8(s.d.id + ':' + n).slice(0, 6), 16); const t = upSince(s);
  const inP = Math.floor(t * (30 + h % 220)), outP = Math.floor(t * (25 + (h >> 3) % 200));
  return { inP, inB: inP * (90 + h % 500), outP, outB: outP * (110 + (h >> 5) % 600), inBc: Math.floor(inP / (12 + h % 9)), rate: (h % 9) * 1000 };
}
function ifCounters(o, c, cleared) {
  const k = c || { inP: 0, inB: 0, outP: 0, outB: 0, inBc: 0, rate: 0 };
  o.l('  Last input ' + (c ? '00:00:00' : 'never') + ', output ' + (c ? '00:00:00' : 'never') + ', output hang never');
  o.l('  Last clearing of "show interface" counters never'); o.l('  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0'); o.l('  Queueing strategy: fifo'); o.l('  Output queue: 0/40 (size/max)');
  o.l('  5 minute input rate ' + k.rate + ' bits/sec, ' + Math.floor(k.rate / 700) + ' packets/sec'); o.l('  5 minute output rate ' + Math.floor(k.rate * 0.7) + ' bits/sec, ' + Math.floor(k.rate / 900) + ' packets/sec');
  o.l('     ' + k.inP + ' packets input, ' + k.inB + ' bytes, 0 no buffer'); o.l('     Received ' + k.inBc + ' broadcasts (0 IP multicasts)'); o.l('     0 runts, 0 giants, 0 throttles'); o.l('     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored');
  o.l('     0 watchdog, ' + Math.floor(k.inBc / 3) + ' multicast, 0 pause input'); o.l('     0 input packets with dribble condition detected'); o.l('     ' + k.outP + ' packets output, ' + k.outB + ' bytes, 0 underruns');
  o.l('     0 output errors, 0 collisions, 1 interface resets'); o.l('     0 unknown protocol drops'); o.l('     0 babbles, 0 late collision, 0 deferred'); o.l('     0 lost carrier, 0 no carrier, 0 pause output'); o.l('     0 output buffer failures, 0 output buffers swapped out');
}
def('UP', 'show interfaces', 'Interface status and configuration', function (a, rest, o) { ifaceNames(this.d).filter(n => !isSw(this.d) || !/^Vlan1$/.test(n) || (this.d.svi || {}).Vlan1).forEach(n => showIf(this, n, o)); });
def('UP', 'show interfaces <if>', 'Interface status and configuration', function (a, rest, o) { const ref = I.ifRef(this.d, a[0], false); showIf(this, ref.name, o); });
function showIf(s, n, o) {
  const d = s.d; const ph = phys(s, n); const ref = I.ifRef(d, n, false); const x = ref.obj;
  if (ref.kind === 'port') {
    const st = portState(s, n); const po = /^Port-channel/.test(n); const pi = po ? H.poInfo(s, n) : null; const fast = po ? pi.fast : /^Fast/.test(n); const up = st === 'connected';
    o.l(n + ' is ' + (st === 'disabled' ? 'administratively down' : up ? 'up' : 'down') + ', line protocol is ' + (up ? 'up' : 'down') + ' (' + st + ')');
    o.l('  Hardware is ' + (po ? 'EtherChannel' : fast ? 'Fast Ethernet' : 'Gigabit Ethernet') + ', address is ' + I.portMac(d, n) + ' (bia ' + I.portMac(d, n) + ')');
    if (x.desc) o.l('  Description: ' + x.desc);
    o.l('  MTU 1500 bytes, BW ' + (po ? pi.bw : fast ? '100000' : '1000000') + ' Kbit/sec, DLY ' + (fast ? '100' : '10') + ' usec,'); o.l('     reliability 255/255, txload 1/255, rxload 1/255'); o.l('  Encapsulation ARPA, loopback not set'); o.l('  Keepalive set (10 sec)');
    if (po) o.l(up ? '  Full-duplex, ' + pi.speed + 'Mb/s' : '  Auto-duplex, Auto-speed');
    else if (up) o.l('  ' + (x.duplex === 'half' ? 'Half' : 'Full') + '-duplex, ' + (fast ? '100Mb/s' : '1000Mb/s') + ', media type is ' + (fast ? '10/100BaseTX' : '10/100/1000BaseTX')); else o.l('  Auto-duplex, Auto-speed, media type is ' + (fast ? '10/100BaseTX' : '10/100/1000BaseTX'));
    o.l('  input flow-control is off, output flow-control is unsupported '); if (po) o.l('  Members in this channel: ' + pi.members.join(' ') + ' '); o.l('  ARP type: ARPA, ARP Timeout 04:00:00');
    ifCounters(o, ctr(s, n, up)); return;
  }
  const up = ph.up;
  o.l(n + ' is ' + (!ph.admin ? 'administratively down' : up ? 'up' : 'down') + ', line protocol is ' + (up ? 'up' : 'down') + ' ');
  o.l('  Hardware is ' + (ref.kind === 'svi' ? 'EtherSVI' : (x.parent ? 'CN Gigabit Ethernet' : 'CN Gigabit Ethernet')) + ', address is ' + ifMacOf(d, n) + ' (bia ' + ifMacOf(d, n) + ')');
  if (x.desc) o.l('  Description: ' + x.desc);
  if (x.ip) o.l('  Internet address is ' + x.ip + '/' + U.mask2len(x.mask)); o.l('  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec, '); o.l('     reliability 255/255, txload 1/255, rxload 1/255');
  if (x.encap !== undefined) o.l('  Encapsulation 802.1Q Virtual LAN, Vlan ID  ' + x.encap + '.'); else o.l('  Encapsulation ARPA, loopback not set');
  if (ref.kind === 'iface' && !x.parent) { o.l('  Keepalive set (10 sec)'); o.l(up ? '  Full Duplex, 1Gbps, media type is RJ45' : '  Auto Duplex, Auto Speed, media type is RJ45'); o.l('  output flow-control is unsupported, input flow-control is unsupported'); }
  o.l('  ARP type: ARPA, ARP Timeout 04:00:00');
  ifCounters(o, ctr(s, n, up));
}
def('UP', 'show interfaces status', 'Interface status', function (a, rest, o) {
  const d = this.d; o.l('Port      Name               Status       Vlan       Duplex  Speed Type'); I.portNames(d).forEach(n => statusRow(this, n, o));
}, { sw: true });
def('UP', 'show interfaces <if> status', 'Interface status', function (a, rest, o) {
  const d = this.d; const ref = I.ifRef(d, a[0], false); if (!ref || ref.kind !== 'port') { o.l("% Invalid input detected at '^' marker."); o.l(''); return; }
  o.l('Port      Name               Status       Vlan       Duplex  Speed Type'); statusRow(this, ref.name, o);
}, { sw: true });
function statusRow(s, n, o) {
  const d = s.d; const p = d.ports[n]; const st = portState(s, n); const fast = /^Fast/.test(n); const po = /^Port-channel/.test(n);
  const dup = st === 'connected' ? (p.duplex && p.duplex !== 'auto' ? p.duplex : 'a-full') : (p.duplex || 'auto'); let spd = st === 'connected' ? (p.speed && p.speed !== 'auto' ? p.speed : (fast ? 'a-100' : 'a-1000')) : (p.speed || 'auto');
  if (po) spd = st === 'connected' ? 'a-' + H.poSpeed(s, n) : 'auto';
  o.l(pad(I.shortIf(n), 10) + pad((p.desc || '').slice(0, 18), 19) + pad(st, 13) + pad(p.mode === 'trunk' ? 'trunk' : String(p.vlan || 1), 11) + pad(dup, 8) + pad(spd, 6) + (spd.length >= 6 ? ' ' : '') + (po ? '' : fast ? '10/100BaseTX' : '10/100/1000BaseTX'));
}
def('UP', 'show interfaces description', 'Interface description', function (a, rest, o) {
  const d = this.d; o.l('Interface                      Status         Protocol Description');
  ifaceNames(d).forEach(n => { const ph = phys(this, n); const ref = I.ifRef(d, n, false); let status, proto; if (isSw(d) && ref.kind === 'port') { const st = portState(this, n); status = st === 'disabled' ? 'admin down' : st === 'connected' ? 'up' : 'down'; proto = st === 'connected' ? 'up' : 'down'; } else { status = !ph.admin ? 'admin down' : ph.up ? 'up' : 'down'; proto = ph.up ? 'up' : 'down'; } o.l(pad(I.shortIf(n), 31) + pad(status, 15) + pad(proto, 9) + ((ref && ref.obj && ref.obj.desc) || '')); });
});
def('UP', 'show interfaces trunk', 'Show interface trunk information', function (a, rest, o) {
  const d = this.d; const rows = I.portNames(d).filter(n => d.ports[n].mode === 'trunk' && N.linkUp(this.W, d, n) && !H.hiddenMember(this.W, d, n)); if (!rows.length) return;
  const vl = Object.keys(d.vlans).map(Number);
  o.l('Port        Mode             Encapsulation  Status        Native vlan'); rows.forEach(n => o.l(pad(I.shortIf(n), 12) + pad('on', 17) + pad('802.1q', 15) + pad('trunking', 14) + (d.ports[n].native || 1)));
  o.l(''); o.l('Port        Vlans allowed on trunk'); rows.forEach(n => o.l(pad(I.shortIf(n), 12) + I.allowedList(d.ports[n]).replace(/^all$/, '1-4094')));
  const active = n => { const p = d.ports[n]; const l = vl.filter(v => N.portAllows(p, v)).sort((x, y) => x - y); return l.length ? I.vlanText(l) : 'none'; };
  o.l(''); o.l('Port        Vlans allowed and active in management domain'); rows.forEach(n => o.l(pad(I.shortIf(n), 12) + active(n)));
  o.l(''); o.l('Port        Vlans in spanning tree forwarding state and not pruned'); rows.forEach(n => o.l(pad(I.shortIf(n), 12) + H.stpFwdList(this.W, d, n, vl, active)));
}, { sw: true });

/* ------------------------------------------------------------------ VLAN, table MAC */
function vlanBrief(s, o, only) {
  const d = s.d; o.l('VLAN Name                             Status    Ports'); o.l('---- -------------------------------- --------- -------------------------------');
  const vids = Object.keys(d.vlans).map(Number).sort((x, y) => x - y).filter(v => !only || only(v));
  vids.forEach(v => {
    const ports = I.portNames(d).filter(n => { const p = d.ports[n]; return p.mode !== 'trunk' && (p.vlan || 1) === v && !H.hiddenMember(s.W, d, n); }).map(I.shortIf);
    const lines = []; let cur = '';
    ports.forEach(pn => { const add = (cur ? ', ' : '') + pn; if ((cur + add).length > 31) { lines.push(cur + ','); cur = pn; } else cur += add; });
    if (cur) lines.push(cur);
    const vr = d.vlans[v];
    o.l(pad(String(v), 5) + pad(vr.name, 33) + pad(vr.suspend ? 'suspended' : 'active', 10) + (lines[0] || '')); lines.slice(1).forEach(t => o.l(' '.repeat(48) + t));
  });
  [[1002, 'fddi-default'], [1003, 'token-ring-default'], [1004, 'fddinet-default'], [1005, 'trnet-default']].forEach(([v, n]) => { if (!only || only(v)) o.l(pad(String(v), 5) + pad(n, 33) + 'act/unsup '); });
}
def('UP', 'show vlan brief', 'VTP all VLAN status in brief', function (a, rest, o) { vlanBrief(this, o); }, { sw: true });
def('UP', 'show vlan', 'VTP VLAN status', function (a, rest, o) {
  vlanBrief(this, o); o.l('');
  o.l('VLAN Type  SAID       MTU   Parent RingNo BridgeNo Stp  BrdgMode Trans1 Trans2'); o.l('---- ----- ---------- ----- ------ ------ -------- ---- -------- ------ ------');
  Object.keys(this.d.vlans).map(Number).sort((x, y) => x - y).forEach(v => o.l(pad(String(v), 5) + pad('enet', 6) + pad(String(100000 + v), 11) + pad('1500', 6) + pad('-', 7) + pad('-', 7) + pad('-', 9) + pad('-', 5) + pad('-', 9) + pad('0', 7) + '0'));
  o.l(''); o.l('Remote SPAN VLANs'); o.l('------------------------------------------------------------------------------'); o.l(''); o.l('Primary Secondary Type              Ports'); o.l('------- --------- ----------------- ------------------------------------------');
}, { sw: true });
def('UP', 'show vlan id <vlan>', 'VTP VLAN status by VLAN id', function (a, rest, o) { if (!this.d.vlans[a[0]]) { o.l('VLAN id ' + a[0] + ' not found in current VLAN database'); return; } vlanBrief(this, o, v => v === a[0] && v < 1002); }, { sw: true });
def('UP', 'show vlan name <word>', 'VTP VLAN status by VLAN name', function (a, rest, o) { const v = Object.keys(this.d.vlans).map(Number).find(n => this.d.vlans[n].name.toLowerCase() === a[0].toLowerCase()); if (!v) { o.l('VLAN name ' + a[0] + ' not found in current VLAN database'); return; } vlanBrief(this, o, x => x === v); }, { sw: true });
D('show vlan id', 'VLAN ID of the VLAN'); D('show vlan name', 'The VLAN with this name'); D('show vlan brief', 'VTP all VLAN status in brief');

/* adresses MAC apprises : BFS sur les liaisons inter-commutateurs (VLAN autorisés, ports actifs) */
function macTable(s) {
  const W = s.W, sw = s.d; const rows = [];
  const vlans = Object.keys(sw.vlans).map(Number);
  for (const v of vlans) {
    if (!N.vlanActive(sw, v)) continue;
    const seen = new Set([sw.id]);
    const walk = (cur, viaPort) => {
      for (const pn of Object.keys(cur.ports)) {
        if (cur.id === sw.id) viaPort = pn;
        const p = cur.ports[pn]; if (!N.linkUp(W, cur, pn) || H.skipPort(W, cur, pn, v)) continue;
        const pe = N.peerOf(W, cur, pn); if (!pe) continue; const peer = W.dev[pe.dev];
        if (N.isSwitch(peer) && H.skipPort(W, peer, pe.port, v)) continue;
        if (p.mode === 'trunk') {
          if (!N.portAllows(p, v)) continue;
          if (N.isSwitch(peer)) {
            if (seen.has(peer.id) || peer.kind === 'sw-dumb') continue;
            const q = peer.ports[pe.port]; if (!q || q.mode !== 'trunk' || !N.portAllows(q, v) || !N.vlanActive(peer, v)) continue;
            seen.add(peer.id); const vp = viaPort; walkFrom(peer, cur.id === sw.id ? pn : vp); continue;
          }
          /* routeur sur le trunk : sous-interface portant ce VLAN */
          Object.keys(peer.ifaces || {}).forEach(n => { const i = peer.ifaces[n]; if (i.encap === v && i.parent === pe.port && !i.adminDown) rows.push({ vlan: v, mac: dotted((peer.ifaces[pe.port] && peer.ifaces[pe.port].mac) || U.mac(peer.id + pe.port)), port: cur.id === sw.id ? pn : viaPort }); });
          continue;
        }
        if ((p.vlan || 1) !== v) continue;
        if (N.isSwitch(peer)) continue;
        const i = peer.ifaces && peer.ifaces[pe.port]; if (!i || i.adminDown || !N.powered(peer)) continue;
        rows.push({ vlan: v, mac: dotted(i.mac || U.mac(peer.id + pe.port)), port: cur.id === sw.id ? pn : viaPort });
      }
    };
    const walkFrom = (cur, firstPort) => {
      for (const pn of Object.keys(cur.ports)) {
        const p = cur.ports[pn]; if (!N.linkUp(W, cur, pn) || H.skipPort(W, cur, pn, v)) continue;
        const pe = N.peerOf(W, cur, pn); if (!pe) continue; const peer = W.dev[pe.dev];
        if (N.isSwitch(peer) && H.skipPort(W, peer, pe.port, v)) continue;
        if (p.mode === 'trunk') {
          if (!N.portAllows(p, v)) continue;
          if (N.isSwitch(peer)) { if (seen.has(peer.id) || peer.kind === 'sw-dumb') continue; const q = peer.ports[pe.port]; if (!q || q.mode !== 'trunk' || !N.portAllows(q, v) || !N.vlanActive(peer, v)) continue; seen.add(peer.id); walkFrom(peer, firstPort); continue; }
          Object.keys(peer.ifaces || {}).forEach(n => { const i = peer.ifaces[n]; if (i.encap === v && i.parent === pe.port && !i.adminDown) rows.push({ vlan: v, mac: dotted((peer.ifaces[pe.port] && peer.ifaces[pe.port].mac) || U.mac(peer.id + pe.port)), port: firstPort }); });
          continue;
        }
        if ((p.vlan || 1) !== v) continue; if (N.isSwitch(peer)) continue;
        const i = peer.ifaces && peer.ifaces[pe.port]; if (!i || i.adminDown || !N.powered(peer)) continue;
        rows.push({ vlan: v, mac: dotted(i.mac || U.mac(peer.id + pe.port)), port: firstPort });
      }
      /* SVI des commutateurs distants */
      if (cur.id !== sw.id && cur.svi && cur.svi['Vlan' + v] && !cur.svi['Vlan' + v].shut) rows.push({ vlan: v, mac: baseMac(cur), port: firstPort });
    };
    walk(sw, null);
  }
  rows.forEach(r => { r.port = H.repPort(W, sw, r.port); });
  /* dédoublonnage par (vlan, mac) : la première liaison trouvée l'emporte */
  const seenK = new Set(); const out = [];
  rows.forEach(r => { const k = r.vlan + '|' + r.mac; if (seenK.has(k)) return; seenK.add(k); out.push(r); });
  return out;
}
I.macTable = macTable;
function macShow(s, o, filter) {
  const d = s.d; let rows = macTable(s); if (d._rt.macClear !== undefined && d._rt.macClear > (d._rt.macSeen || -1)) { d._rt.macSeen = s.W.clock.elapsed; }
  const stat = [['0100.0ccc.cccc'], ['0100.0ccc.cccd'], ['0180.c200.0000'], ['0180.c200.0001'], ['0180.c200.0002'], ['0180.c200.0003'], ['0180.c200.0004'], ['0180.c200.0005'], ['0180.c200.0006'], ['0180.c200.0007'], ['ffff.ffff.ffff']];
  if (filter.vlan) rows = rows.filter(r => r.vlan === filter.vlan); if (filter.iface) rows = rows.filter(r => r.port === filter.iface); if (filter.addr) rows = rows.filter(r => r.mac === filter.addr);
  rows.sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac));
  o.l('          Mac Address Table'); o.l('-------------------------------------------'); o.l(''); o.l('Vlan    Mac Address       Type        Ports'); o.l('----    -----------       --------    -----');
  let n = 0;
  if (!filter.dynamic && !filter.vlan && !filter.iface && !filter.addr) { stat.forEach(x => { o.l(padl('All', 4) + '    ' + pad(x[0], 18) + pad('STATIC', 12) + 'CPU'); n++; }); }
  rows.forEach(r => { o.l(padl(String(r.vlan), 4) + '    ' + pad(r.mac, 18) + pad('DYNAMIC', 12) + I.shortIf(r.port)); n++; });
  o.l('Total Mac Addresses for this criterion: ' + n);
}
def('UP', 'show mac address-table', 'MAC forwarding table', function (a, rest, o) { macShow(this, o, {}); }, { sw: true });
def('UP', 'show mac address-table dynamic', 'dynamic entries', function (a, rest, o) { macShow(this, o, { dynamic: true }); }, { sw: true });
def('UP', 'show mac address-table vlan <vlan>', 'VLAN keyword', function (a, rest, o) { macShow(this, o, { vlan: a[0] }); }, { sw: true });
def('UP', 'show mac address-table interface <if>', 'interface keyword', function (a, rest, o) { const ref = I.ifRef(this.d, a[0], false); if (!ref) { o.l("% Invalid input detected at '^' marker."); o.l(''); return; } macShow(this, o, { iface: ref.name }); }, { sw: true });
def('UP', 'show mac address-table address <mac>', 'address keyword', function (a, rest, o) { macShow(this, o, { addr: a[0] }); }, { sw: true });
def('UP', 'show mac-address-table', 'MAC forwarding table', function (a, rest, o) { macShow(this, o, {}); }, { sw: true });
D('show mac address-table', 'MAC forwarding table');

/* ------------------------------------------------------------------ CDP */
function cdpNeighbors(s) {
  const d = s.d; const out = []; const ports = isSw(d) ? Object.keys(d.ports) : Object.keys(d.ifaces).filter(n => !d.ifaces[n].parent);
  ports.sort(I.portOrder).forEach(n => {
    if (!N.linkUp(s.W, d, n)) return; const pe = N.peerOf(s.W, d, n); if (!pe) return; const peer = s.W.dev[pe.dev]; if (peer.kind !== 'ios-sw' && peer.kind !== 'ios-rt') return;
    out.push({ local: n, peer, port: pe.port });
  });
  return out;
}
const platformOf = p => p.kind === 'ios-rt' ? 'CISCO2911/K9' : /3560/.test(p.model || '') ? 'WS-C3560-24PS' : 'WS-C2960-24TT-L';
def('UP', 'show cdp neighbors', 'CDP neighbor entries', function (a, rest, o) {
  o.l('Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge'); o.l('                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone, '); o.l('                  D - Remote, C - CVTA, M - Two-port Mac Relay '); o.l('');
  o.l('Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID');
  cdpNeighbors(this).forEach(nb => {
    const id = hostName(nb.peer) + (nb.peer.domain ? '.' + nb.peer.domain : ''); const hold = 130 + (parseInt(U.hash8(id).slice(0, 2), 16) % 40);
    const cap = nb.peer.kind === 'ios-rt' ? 'R S I' : 'S I'; const plat = platformOf(nb.peer).slice(0, 9);
    const row = pad(I.cdpIf(nb.local), 18) + pad(String(hold), 11) + pad(cap, 12) + pad(plat, 10) + I.cdpIf(nb.port);
    if (id.length > 16) { o.l(id); o.l(' '.repeat(17) + row); } else o.l(pad(id, 17) + row);
  });
  o.l(''); o.l('Total cdp entries displayed : ' + cdpNeighbors(this).length);
});
def('UP', 'show cdp neighbors detail', 'Show detailed information', function (a, rest, o) {
  const nbs = cdpNeighbors(this); nbs.forEach(nb => {
    const id = hostName(nb.peer) + (nb.peer.domain ? '.' + nb.peer.domain : ''); const l3 = N.l3up(this.W, nb.peer)[0];
    o.l('-------------------------'); o.l('Device ID: ' + id); o.l('Entry address(es): '); if (l3) o.l('  IP address: ' + l3.ip);
    o.l('Platform: cisco ' + platformOf(nb.peer) + ',  Capabilities: ' + (nb.peer.kind === 'ios-rt' ? 'Router Switch IGMP' : 'Switch IGMP') + ' '); o.l('Interface: ' + nb.local + ',  Port ID (outgoing port): ' + nb.port);
    o.l('Holdtime : ' + (130 + (parseInt(U.hash8(id).slice(0, 2), 16) % 40)) + ' sec'); o.l(''); o.l('Version :'); o.l('Cisco IOS Software, ' + (nb.peer.kind === 'ios-rt' ? 'C2900 Software (C2900-UNIVERSALK9-M), Version 15.2(4)M3' : 'C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4') + ', RELEASE SOFTWARE'); o.l(''); o.l('advertisement version: 2'); o.l('Duplex: full'); o.l('');
  });
  o.l('');
});
D('show cdp neighbors', 'CDP neighbor entries');

/* ------------------------------------------------------------------ table de routage, ARP */
function routeRows(s) {
  const d = s.d; const rows = [];
  N.l3(s.W, d).filter(x => x.up && x.ip && x.mask).forEach(x => { rows.push({ code: 'C', net: U.netAddr(x.ip, x.mask), len: U.mask2len(x.mask), via: 'is directly connected, ' + x.name }); rows.push({ code: 'L', net: x.ip, len: 32, via: 'is directly connected, ' + x.name }); });
  N.routes(s.W, d).forEach(r => {
    if (r.ad === 0) return;
    if (r.proto === 'ospf') {
      const mine = rows.some(x => x.code === 'C' && x.net === r.net && x.len === r.len);
      const stat = N.routes(s.W, d).some(x => x.proto !== 'ospf' && x.ad < r.ad && x.net === r.net && x.len === r.len);
      if (mine || stat) return;
      rows.push({ code: r.rtype === 'E2' ? 'O*E2' : r.rtype === 'IA' ? 'O IA' : 'O', net: r.net, len: r.len, def: r.len === 0, nh: r.nh, ospf: r, via: '[' + r.ad + '/' + r.metric + '] via ' + r.nh + ', ' + SIM.ospf.ageStr(SIM.ospf.routeAge(s.W, d, r)) + ', ' + r.iface });
      return;
    }
    const def = r.len === 0;
    rows.push({ code: def ? 'S*' : 'S', net: r.net, len: r.len, def, nh: r.nh, via: r.nh ? '[' + r.ad + '/0] via ' + r.nh : 'is directly connected, ' + r.iface });
  });
  return rows;
}
def('UP', 'show ip route', 'IP routing table', function (a, rest, o) { routeShow(this, o, null); });
def('P', 'show ip route ospf', 'Open Shortest Path First (OSPF)', function (a, rest, o) { routeShow(this, o, 'ospf'); }, { l3: true });
function routeShow(s, o, only) {
  const d = s.d;
  if (isSw(d) && !d.ipRouting) {
    o.l('Default gateway is ' + (d.defaultGateway && N.routes(s.W, d).some(r => r.def) ? d.defaultGateway : 'not set')); o.l(''); o.l('Host               Gateway           Last Use    Total Uses  Interface'); o.l('ICMP redirect cache is empty'); return;
  }
  o.l('Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP'); o.l('       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area '); o.l('       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2'); o.l('       E1 - OSPF external type 1, E2 - OSPF external type 2'); o.l('       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2'); o.l('       ia - IS-IS inter area, * - candidate default, U - per-user static route'); o.l('       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP'); o.l('       + - replicated route, % - next hop override'); o.l('');
  const all = routeRows(s); const def0 = all.find(r => r.def);
  const rows = only === 'ospf' ? all.filter(r => r.code[0] === 'O') : all;
  o.l('Gateway of last resort is ' + (def0 ? def0.nh + ' to network 0.0.0.0' : 'not set')); o.l('');
  const key = r => U.ip2n(r.net) * 64 + r.len;
  const defRows = rows.filter(r => r.def); const rest0 = rows.filter(r => !r.def);
  const groups = {};
  rest0.forEach(r => { const f = +r.net.split('.')[0]; const cl = f < 128 ? 8 : f < 192 ? 16 : 24; const maj = U.netAddr(r.net, U.len2mask(cl)); (groups[maj + '/' + cl] = groups[maj + '/' + cl] || []).push(r); });
  Object.keys(groups).sort((x, y) => U.ip2n(x.split('/')[0]) - U.ip2n(y.split('/')[0])).forEach(g => {
    const list = groups[g].sort((x, y) => U.ip2n(x.net) - U.ip2n(y.net) || x.len - y.len); const masks = U.uniq(list.map(x => x.len));
    const nPref = U.uniq(list.map(x => x.net + '/' + x.len)).length;
    if (masks.length > 1) o.l('      ' + g + ' is variably subnetted, ' + nPref + ' subnets, ' + masks.length + ' masks'); else o.l('      ' + g.split('/')[0] + '/' + masks[0] + ' is subnetted, ' + nPref + ' subnets');
    let prev = null;
    list.forEach(r => {
      const k = r.net + '/' + r.len;
      if (r.ospf && prev === k) o.l(' '.repeat(9 + k.length + 1) + r.via); else o.l(pad(r.code, 9) + k + ' ' + r.via);
      prev = r.ospf ? k : null;
    });
  });
  let pd = null;
  defRows.forEach(r => {
    const k = r.net + '/' + r.len;
    if (r.ospf && pd === k) o.l(' '.repeat(6 + k.length + 1) + r.via); else o.l(pad(r.code, 6) + k + ' ' + r.via);
    pd = r.ospf ? k : null;
  });
}

D('show ip route', 'IP routing table');
function arpEntries(s) {
  const d = s.d, W = s.W; const rows = [];
  N.l3(W, d).filter(x => x.up && x.ip).forEach(x => rows.push({ ip: x.ip, age: '-', mac: ifMacOf(d, x.name), ifn: x.name }));
  const t = d._rt.arp || {}; Object.keys(t).forEach(ip => { const e = t[ip]; const ageMin = Math.max(0, Math.floor((W.clock.elapsed - e.t) / 60)); rows.push({ ip, age: String(ageMin), mac: e.mac, ifn: e.ifn }); });
  return rows.sort((x, y) => U.ip2n(x.ip) - U.ip2n(y.ip));
}
I.arpLearn = function (s, ip) {
  const d = s.d, W = s.W; const l3 = N.l3up(W, d); const on = l3.find(x => U.inNet(ip, x.ip, x.mask)); let nh = ip, ifn;
  if (on) ifn = on.name; else { const rt = N.route(W, d, ip); if (!rt || !rt.nh) return; nh = rt.nh; ifn = rt.iface; }
  const mac = W_.macOfIp(W, nh); if (!mac) return; d._rt.arp = d._rt.arp || {};
  if (!d._rt.arp[nh]) { d._rt.arp[nh] = { mac: dotted(mac), ifn, t: W.clock.elapsed }; return true; } return false;
};
function arpShow(s, o) {
  o.l('Protocol  Address          Age (min)  Hardware Addr   Type   Interface');
  arpEntries(s).forEach(e => o.l(pad('Internet', 10) + pad(e.ip, 17) + padl(e.age, 9) + '  ' + pad(e.mac, 15) + ' ARPA   ' + e.ifn));
}
def('UP', 'show arp', 'ARP table', function (a, rest, o) { arpShow(this, o); });
def('UP', 'show ip arp', 'IP ARP table', function (a, rest, o) { arpShow(this, o); });

/* ------------------------------------------------------------------ ACL, NAT, DHCP, port-security, journal */
function showAcl(s, o, only) {
  const acls = s.d.acls || {}; const keys = Object.keys(acls).filter(k => !only || k === only).sort((x, y) => (acls[x].type === acls[y].type ? 0 : acls[x].type === 'standard' ? -1 : 1) || (+x || 1e9) - (+y || 1e9) || x.localeCompare(y));
  if (only && !keys.length) return;
  keys.forEach(k => {
    const a = acls[k]; I.normSeq(a); o.l((a.type === 'standard' ? 'Standard' : 'Extended') + ' IP access list ' + k);
    a.entries.forEach(e => {
      let txt;
      if (a.type === 'standard') txt = e.a + ' ' + (e.s.t === 'host' ? e.s.ip : e.s.t === 'any' ? 'any' : e.s.ip + ', wildcard bits ' + e.s.wild); else txt = I.entryText(a.type, e);
      o.l('    ' + e.seq + ' ' + txt + (e._hits ? ' (' + e._hits + ' match' + (e._hits > 1 ? 'es' : '') + ')' : ''));
    });
  });
}
def('P', 'show access-lists', 'List access lists', function (a, rest, o) { showAcl(this, o); });
def('P', 'show access-lists <word>', 'List access lists', function (a, rest, o) { showAcl(this, o, a[0]); });
def('P', 'show ip access-lists', 'List IP access lists', function (a, rest, o) { showAcl(this, o); });
def('P', 'show ip access-lists <word>', 'List IP access lists', function (a, rest, o) { showAcl(this, o, a[0]); });
def('P', 'show ip nat translations', 'Translation entries', function (a, rest, o) {
  const d = this.d; const nat = d.nat || { rules: [] }; const rows = [];
  (nat.rules || []).forEach(r => { if (r.type === 'static') rows.push(r.proto ? { pro: r.proto, ig: r.global + ':' + r.gport, il: r.local + ':' + r.lport, ol: '---', og: '---' } : { pro: '---', ig: r.global, il: r.local, ol: '---', og: '---' }); });
  ((d._rt.nat && d._rt.nat.tr) || []).forEach(t => {
    if ((nat.rules || []).some(r => r.type === 'static' && r.local === t.il && (!r.proto || r.proto === t.proto))) return;
    const pn = t.sport !== undefined; rows.push({ pro: t.proto, ig: t.ig + (pn ? ':' + t.sport : ''), il: t.il + (pn ? ':' + t.sport : ''), ol: t.ol + (t.dport !== undefined ? ':' + t.dport : ''), og: t.og + (t.dport !== undefined ? ':' + t.dport : '') });
  });
  if (!rows.length) return;
  o.l('Pro Inside global      Inside local       Outside local      Outside global'); rows.forEach(r => o.l(pad(r.pro, 4) + pad(r.ig, 19) + pad(r.il, 19) + pad(r.ol, 19) + r.og));
}, { rt: true });
def('P', 'show ip nat statistics', 'Translation statistics', function (a, rest, o) {
  const d = this.d; const nat = d.nat || { rules: [] }; const st = (nat.rules || []).filter(r => r.type === 'static').length; const dyn = ((d._rt.nat && d._rt.nat.tr) || []).filter(t => !(nat.rules || []).some(r => r.type === 'static' && r.local === t.il)).length;
  const outs = Object.keys(d.ifaces).filter(n => d.ifaces[n].natSide === 'outside'), ins = Object.keys(d.ifaces).filter(n => d.ifaces[n].natSide === 'inside');
  o.l('Total active translations: ' + (st + dyn) + ' (' + st + ' static, ' + dyn + ' dynamic; ' + dyn + ' extended)'); o.l('Peak translations: ' + (st + dyn) + ', occurred ' + hms(Math.max(60, upSince(this) - 1800)) + ' ago'); o.l('Outside interfaces:'); o.l(outs.length ? '  ' + outs.join(', ') : ''); o.l('Inside interfaces: '); o.l(ins.length ? '  ' + ins.join(', ') : ''); o.l('Hits: 0  Misses: 0'); o.l('CEF Translated packets: 0, CEF Punted packets: 0'); o.l('Expired translations: 0'); o.l('Dynamic mappings:');
  let id = 1; (nat.rules || []).filter(r => r.type === 'dynamic').forEach(r => { o.l('-- Inside Source'); o.l('[Id: ' + (id++) + '] access-list ' + r.acl + (r.pool ? ' pool ' + r.pool : ' interface ' + r.iface) + ' refcount ' + ((d._rt.nat && d._rt.nat.tr) || []).length); });
}, { rt: true });
def('P', 'show ip dhcp binding', 'DHCP address bindings', function (a, rest, o) {
  const dh = this.d.dhcp; o.l('Bindings from all pools not associated with VRF:'); o.l('IP address          Client-ID/              Lease expiration        Type'); o.l('                    Hardware address/'); o.l('                    User name');
  if (!dh) return;
  (dh.pools || []).forEach(p => { Object.keys(p._leases || {}).forEach(m => { const l = p._leases[m]; const exp = new Date(this.W.clock.base + (l.t + (p.leaseDays || 1) * 86400) * 1000); const hh = exp.getUTCHours(); const ap = hh >= 12 ? 'PM' : 'AM'; const h12 = hh % 12 || 12; const cid = '01' + m.replace(/[^0-9A-F]/gi, '').toLowerCase(); const cidD = cid.slice(0, 4) + '.' + cid.slice(4, 8) + '.' + cid.slice(8, 12) + '.' + cid.slice(12); o.l(pad(l.ip, 20) + pad(cidD, 24) + pad(E.EN_MONTHS[exp.getUTCMonth()] + ' ' + String(exp.getUTCDate()).padStart(2, '0') + ' ' + exp.getUTCFullYear() + ' ' + String(h12).padStart(2, '0') + ':' + U.pad2(exp.getUTCMinutes()) + ' ' + ap, 24) + 'Automatic'); }); });
}, { rt: true });
def('P', 'show ip dhcp pool', 'DHCP pools information', function (a, rest, o) {
  const dh = this.d.dhcp; if (!dh) return;
  (dh.pools || []).forEach(p => {
    const total = p.net ? Math.pow(2, 32 - U.mask2len(p.mask)) - 2 : 0; const leased = Object.keys(p._leases || {}).length;
    o.l('Pool ' + p.name + ' :'); o.l(' Utilization mark (high/low)    : 100 / 0'); o.l(' Subnet size (first/next)       : 0 / 0 '); o.l(' Total addresses                : ' + total); o.l(' Leased addresses               : ' + leased); o.l(' Pending event                  : none'); o.l(' 1 subnet is currently in the pool :');
    o.l(' Current index        IP address range                    Leased addresses'); o.l(' ' + pad(p.net ? U.n2ip(U.ip2n(p.net) + 1) : '0.0.0.0', 20) + pad((p.net ? U.n2ip(U.ip2n(p.net) + 1) : '0.0.0.0') + '      - ' + (p.net ? U.n2ip(U.ip2n(U.bcast(p.net, p.mask)) - 1) : '0.0.0.0'), 36) + leased); o.l('');
  });
}, { rt: true });
def('P', 'show ip dhcp conflict', 'DHCP address conflicts', function (a, rest, o) { o.l('IP address        Detection method   Detection time          VRF'); }, { rt: true });
D('show ip dhcp', 'Show items in the DHCP database'); D('show ip nat', 'IP NAT information');
function psecRow(s, n, o) {
  const p = s.d.ports[n]; const ps = p.psec; if (!ps || !ps.enabled) return null;
  return { n, max: ps.max || 1, cur: (ps.macs || []).length, viol: (ps.vcount || 0) + (p.errdisabled ? 1 : 0), act: (ps.violation || 'shutdown').replace(/^./, c => c.toUpperCase()) };
}
def('P', 'show port-security', 'Show secure port information', function (a, rest, o) {
  const rows = I.portNames(this.d).map(n => psecRow(this, n)).filter(Boolean);
  o.l('Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action'); o.l('                (Count)       (Count)          (Count)'); o.l('---------------------------------------------------------------------------');
  rows.forEach(r => o.l(padl(I.shortIf(r.n), 13) + padl(String(r.max), 15) + padl(String(r.cur), 13) + padl(String(r.viol), 19) + padl(r.act, 18)));
  o.l('---------------------------------------------------------------------------'); o.l('Total Addresses in System (excluding one mac per port)     : ' + rows.reduce((t, r) => t + Math.max(0, r.cur - 1), 0)); o.l('Max Addresses limit in System (excluding one mac per port) : 1024');
}, { sw: true });
def('P', 'show port-security interface <if>', 'Show secure port information', function (a, rest, o) {
  const ref = I.ifRef(this.d, a[0], false); if (!ref || ref.kind !== 'port') { o.l("% Invalid input detected at '^' marker."); o.l(''); return; }
  const p = ref.obj; const ps = p.psec || {}; const en = !!ps.enabled; const st = !en ? 'Secure-down' : p.errdisabled ? 'Secure-shutdown' : (IOS.portStatus(this.W, this.d, ref.name) === 'connected' ? 'Secure-up' : 'Secure-down');
  const pe = N.peerOf(this.W, this.d, ref.name); const peer = pe && this.W.dev[pe.dev]; const pi = peer && peer.ifaces && peer.ifaces[pe.port]; const lastMac = (p.errdisabled && pi && pi.mac) ? dotted(pi.mac) : ((ps.macs || []).length ? dotted(ps.macs[ps.macs.length - 1]) : '0000.0000.0000');
  const vl = p.mode === 'trunk' ? 1 : (p.vlan || 1);
  o.l('Port Security              : ' + (en ? 'Enabled' : 'Disabled')); o.l('Port Status                : ' + st); o.l('Violation Mode             : ' + ((ps.violation || 'shutdown').replace(/^./, c => c.toUpperCase()))); o.l('Aging Time                 : 0 mins'); o.l('Aging Type                 : Absolute'); o.l('SecureStatic Address Aging : Disabled'); o.l('Maximum MAC Addresses      : ' + (ps.max || 1));
  const nSticky = ps.sticky ? (ps.macs || []).length : 0; const nCfg = ps.sticky ? 0 : (ps.macs || []).length;
  o.l('Total MAC Addresses        : ' + (ps.macs || []).length); o.l('Configured MAC Addresses   : ' + nCfg); o.l('Sticky MAC Addresses       : ' + nSticky); o.l('Last Source Address:Vlan   : ' + lastMac + ':' + vl); o.l('Security Violation Count   : ' + ((ps.vcount || 0) + (p.errdisabled ? 1 : 0)));
}, { sw: true });
def('P', 'show port-security address', 'Show secure address', function (a, rest, o) {
  o.l('               Secure Mac Address Table'); o.l('-------------------------------------------------------------------'); o.l('Vlan    Mac Address       Type                          Ports   Remaining Age'); o.l('                                                                   (mins)'); o.l('----    -----------       ----                          -----   -------------');
  let n = 0; I.portNames(this.d).forEach(pn => { const p = this.d.ports[pn]; if (!p.psec || !p.psec.enabled) return; (p.psec.macs || []).forEach(m => { o.l(padl(String(p.vlan || 1), 4) + '    ' + pad(dotted(m), 18) + pad(p.psec.sticky ? 'SecureSticky' : 'SecureConfigured', 30) + pad(I.shortIf(pn), 8) + '-'); n++; }); });
  o.l('-------------------------------------------------------------------'); o.l('Total Addresses in System (excluding one mac per port)     : ' + Math.max(0, n)); o.l('Max Addresses limit in System (excluding one mac per port) : 1024');
}, { sw: true });
def('P', 'show logging', 'Show the contents of logging buffers', function (a, rest, o) {
  const es = this.W.logs(this.devId, 'syslog'); o.l('Syslog logging: enabled (0 messages dropped, 3 messages rate-limited, 0 flushes, 0 overruns, xml disabled, filtering disabled)'); o.l(''); o.l('No Active Message Discriminator.'); o.l(''); o.l('No Inactive Message Discriminator.'); o.l('');
  o.l('    Console logging: level debugging, ' + es.length + ' messages logged, xml disabled,'); o.l('                     filtering disabled'); o.l('    Monitor logging: level debugging, 0 messages logged, xml disabled,'); o.l('                     filtering disabled'); o.l('    Buffer logging:  level debugging, ' + es.length + ' messages logged, xml disabled,'); o.l('                    filtering disabled'); o.l('    Exception Logging: size (4096 bytes)'); o.l('    Count and timestamp logging messages: disabled'); o.l('    File logging: disabled'); o.l('    Persistent logging: disabled'); o.l('');
  o.l('No active filter modules.'); o.l(''); o.l('    Trap logging: level informational, ' + es.length + ' message lines logged'); o.l('        Logging Source-Interface:       VRF Name:'); o.l(''); o.l('Log Buffer (4096 bytes):'); o.l('');
  es.slice().sort((x, y) => x.t - y.t).forEach(e => { const t = new Date(e.t); o.l('*' + E.syslogTs(t) + '.' + String(t.getUTCMilliseconds()).padStart(3, '0') + ': ' + e.msg); });
});
def('P', 'show ip route static', 'Static routes', function (a, rest, o) {
  const rows = routeRows(this).filter(r => r.code[0] === 'S'); o.l('Codes: L - local, C - connected, S - static'); o.l(''); rows.forEach(r => o.l(pad(r.code, 6) + r.net + '/' + r.len + ' ' + r.via));
}, { l3: true });

/* ------------------------------------------------------------------ ping / traceroute */
function ping(s, target, o, r, opts) {
  opts = opts || {}; const d = s.d, W = s.W; const count = opts.count || 5; const size = opts.size || 100;
  let ip = target;
  if (!U.isIP(target)) {
    if (d.domainLookup !== false) o.l('Translating "' + target + '"...domain server (255.255.255.255)');
    s.env.advance(d.domainLookup === false ? 0 : 6); o.l(d.domainLookup === false ? '% Unrecognized host or address or protocol not running.' : '% Unrecognized host or address, or protocol not running.'); o.l(''); s.env.obs('ping:' + d.id + ':' + target, false); return;
  }
  o.l('Type escape sequence to abort.'); o.l('Sending ' + count + ', ' + size + '-byte ICMP Echos to ' + ip + ', timeout is 2 seconds:');
  let marks = ''; const ms = []; let ok = 0;
  for (let k = 0; k < count; k++) {
    const p = N.ping(W, d.id, ip); let ch;
    if (p.ok) { const fresh = k === 0 && I.arpLearn(s, ip); ch = fresh ? '.' : '!'; if (ch === '!') { ok++; ms.push(Math.max(1, E.rttMs(p.trace, k) + (k === 0 ? 0 : 0))); } }
    else if (p.kind === 'timeout' || p.kind === 'general') ch = '.'; else ch = 'U';
    marks += ch; s.env.advance(ch === '.' ? 2 : 0);
  }
  s.env.obs('ping:' + d.id + ':' + ip, ok > 0);
  o.l(marks);
  o.l('Success rate is ' + Math.round(100 * ok / count) + ' percent (' + ok + '/' + count + ')' + (ok ? ', round-trip min/avg/max = ' + Math.min(...ms) + '/' + Math.round(ms.reduce((x, y) => x + y, 0) / ms.length) + '/' + Math.max(...ms) + ' ms' : ''));
}
def('UP', 'ping <host>', 'Send echo messages', function (a, rest, o, r) { ping(this, a[0], o, r); });
def('UP', 'ping <host> repeat <num> *rest', 'Repeat count', function (a, rest, o, r) { ping(this, a[0], o, r, { count: Math.min(a[1], 100000) }); });
def('UP', 'ping <host> size <num>', 'Datagram size', function (a, rest, o, r) { ping(this, a[0], o, r, { size: a[1] }); });
def('UP', 'traceroute <host>', 'Trace route to destination', function (a, rest, o, r) {
  const d = this.d, W = this.W; const target = a[0];
  if (!U.isIP(target)) { o.l('Translating "' + target + '"...domain server (255.255.255.255)'); this.env.advance(6); o.l('% Unrecognized host or address or protocol not running.'); o.l(''); return; }
  o.l('Type escape sequence to abort.'); o.l('Tracing the route to ' + target); o.l('VRF info: (vrf in name/id, vrf out name/id)');
  const f = N.walk(W, d.id, target, { proto: 'icmp', icmpType: 8 }, {});
  const ips = (f.hops || []).slice(1).map(h => h.inIp); if (f.ok && ips[ips.length - 1] !== target) ips.push(target);
  const rt = (n, k) => 1 + n + (parseInt(U.hash8(d.id + target + n + ':' + k).slice(0, 2), 16) % 2);
  ips.forEach((ip, idx) => o.l(padl(String(idx + 1), 3) + ' ' + ip + ' ' + rt(idx, 0) + ' msec ' + rt(idx, 1) + ' msec ' + rt(idx, 2) + ' msec'));
  this.env.obs('ping:' + d.id + ':' + target, !!f.ok);
  if (!f.ok) { for (let k = ips.length + 1; k <= 30; k++) o.l(padl(String(k), 3) + '  * * * '); this.env.advance(90); }
});

/* ------------------------------------------------------------------ client SSH / telnet (implémenté dans 40-ssh.js) */
def('UP', 'ssh -l <word> <host>', 'Open a secure shell client connection', function (a, rest, o, r) { if (!E.remoteConnect) { o.l('% SSH client unavailable'); return; } E.remoteConnect(this, 'ssh', a[1], a[0], o, r); });
def('UP', 'ssh <host>', 'Open a secure shell client connection', function (a, rest, o, r) { o.l('% Incomplete command.'); o.l(''); });
def('UP', 'telnet <host>', 'Open a telnet connection', function (a, rest, o, r) { if (!E.remoteConnect) { o.l('% Telnet client unavailable'); return; } E.remoteConnect(this, 'telnet', a[0], null, o, r); });
D('ssh -l', 'Log in using this user name');

})(typeof globalThis !== 'undefined' ? globalThis : window);
