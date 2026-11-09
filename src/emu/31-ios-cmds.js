/* ============================================================================
   Cisco IOS — commandes d'exécution et de configuration.
   Chaque commande agit sur le modèle (ports, VLAN, SVI, routes, ACL, NAT, DHCP, lignes, SSH, comptes) ;
   les commandes valides mais sans effet simulé sont mémorisées telles quelles (d.extra) et réaffichées par
   « show running-config », pour que la configuration lue reste cohérente avec celle qui a été saisie.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, IOS = SIM.ios;
const E = SIM.emu; const L = E.L; const I = E.ios; const def = I.def, D = I.D;

/* ------------------------------------------------------------------ descriptions des mots intermédiaires (aide « ? ») */
Object.assign(I.wordDesc, {
  show: 'Show running system information', configure: 'Enter configuration mode', terminal: 'Set terminal line parameters', enable: 'Turn on privileged commands',
  disable: 'Turn off privileged commands', exit: 'Exit from the EXEC', logout: 'Exit from the EXEC', ping: 'Send echo messages', traceroute: 'Trace route to destination',
  write: 'Write running configuration to memory, network, or terminal', copy: 'Copy from one file to another', reload: 'Halt and perform a cold restart', clear: 'Reset functions',
  delete: 'Delete a file', erase: 'Erase a filesystem', ssh: 'Open a secure shell client connection', telnet: 'Open a telnet connection', end: 'Exit from configure mode', no: 'Negate a command or set its defaults',
  'show ip': 'IP information', 'show interfaces': 'Interface status and configuration', 'show vlan': 'VTP VLAN status', 'show mac': 'MAC configuration', 'show cdp': 'CDP information',
  'show access-lists': 'List access lists', 'show running-config': 'Current operating configuration', 'show startup-config': 'Contents of startup configuration', 'show version': 'System hardware and software status',
  'show logging': 'Show the contents of logging buffers', 'show clock': 'Display the system clock', 'show users': 'Display information about terminal lines', 'show port-security': 'Show secure port information',
  'show arp': 'ARP table', 'show history': 'Display the session command history', 'show ssh': 'Status of SSH server connections', 'show privilege': 'Show current privilege level',
  'show ip route': 'IP routing table', 'show ip interface': 'IP interface status and configuration', 'show ip nat': 'IP NAT information', 'show ip dhcp': 'Show items in the DHCP database',
  'show ip access-lists': 'List IP access lists', 'show ip arp': 'IP ARP table', 'show ip ssh': 'Information on SSH', 'show interfaces trunk': 'Show interface trunk information',
  'configure terminal': 'Configuration from vty interface', hostname: 'Set system\'s network name', interface: 'Select an interface to configure', line: 'Configure a terminal line', vlan: 'Vlan commands',
  ip: 'Global IP configuration subcommands', username: 'Establish User Name Authentication', banner: 'Define a login banner', crypto: 'Encryption module', 'access-list': 'Add an access list entry',
  service: 'Modify use of network based services', 'ip route': 'Establish static routes', 'ip access-list': 'Named access-list', 'ip dhcp': 'Configure DHCP server and relay parameters', 'ip nat': 'NAT configuration commands',
  'ip domain-name': 'Define the default domain name', 'ip ssh': 'Configure ssh options', 'ip default-gateway': 'Specify default gateway (if not routing IP)',
  switchport: 'Set switching mode characteristics', description: 'Interface specific description', shutdown: 'Shutdown the selected interface', address: 'Set the IP address of an interface',
  'ip address': 'Set the IP address of an interface', 'ip helper-address': 'Specify a destination address for UDP broadcasts', 'ip access-group': 'Specify access control for packets',
  'switchport mode': 'Set trunking mode of the interface', 'switchport access': 'Set access mode characteristics of the interface', 'switchport trunk': 'Set trunking characteristics of the interface',
  'switchport port-security': 'Security related command', transport: 'Define transport protocols for line', login: 'Enable password checking', password: 'Set a password', 'access-class': 'Filter connections based on an IP access list',
  name: 'Ascii name of the VLAN', network: 'Network number and mask', 'default-router': 'Default routers', 'dns-server': 'DNS servers', 'domain-name': 'Domain name', lease: 'Address lease time',
  permit: 'Specify packets to forward', deny: 'Specify packets to reject', remark: 'Access list entry comment', encapsulation: 'Set encapsulation type for an interface', duplex: 'Configure duplex operation.', speed: 'Configure speed operation.',
  do: 'To run exec commands in config mode', 'ip routing': 'Enable IP routing', 'enable secret': 'Assign the privileged level secret', 'enable password': 'Assign the privileged level password (UNSAFE)', 'show interfaces status': 'Interface status'
});

const LIKELY_EXTRA = ['spanning-tree', 'logging', 'ntp', 'cdp', 'lldp', 'mls', 'errdisable', 'snmp-server', 'clock', 'aaa', 'no cdp'];

/* ------------------------------------------------------------------ utilitaires */
const hostNameOf = d => d.hostname || (d.kind === 'ios-sw' ? 'Switch' : 'Router');
function curRef(s) { return I.curIfs(s); }
function eachIf(s, fn) { curRef(s).forEach(fn); }
function nowTs(s) { return new Date(s.W.clock.base + s.W.clock.elapsed * 1000); }
function addExtra(s, ctx, text) { const d = s.d; d.extra = d.extra || {}; (d.extra[ctx] = d.extra[ctx] || []); if (d.extra[ctx].indexOf(text) < 0) d.extra[ctx].push(text); }
function delExtra(s, ctx, text) { const x = s.d.extra && s.d.extra[ctx]; if (!x) return; const i = x.indexOf(text); if (i >= 0) x.splice(i, 1); }
function dirty(s) { return !I.sameConfig(I.snapshot(s.d), s.d._rt.startup); }
function linkState(s, name) { const d = s.d; if (d.kind === 'ios-sw') { const st = IOS.portStatus(s.W, d, name); return st === 'connected'; } return N.linkUp(s.W, d, name); }
function lineProto(s, ref) {
  if (ref.kind === 'svi') { const l = N.l3(s.W, s.d).find(x => x.name === ref.name); return !!(l && l.up); }
  if (ref.kind === 'port') return IOS.portStatus(s.W, s.d, ref.name) === 'connected';
  const l = N.l3(s.W, s.d).find(x => x.name === ref.name); return !!(l && l.up);
}
function physName(n) { return n; }
function setShut(s, ref, shut, o, r) {
  const d = s.d; const before = lineProto(s, ref);
  const nm = ref.name;
  if (ref.kind === 'port') {
    const p = ref.obj;
    if (shut) { p.adminDown = true; p.errdisabled = false; }
    else {
      p.adminDown = false; p.errdisabled = false;
      if (p.psec && p.psec.enabled) {
        const pe = N.peerOf(s.W, d, nm);
        if (pe) {
          const peer = s.W.dev[pe.dev]; const pi = peer.ifaces && peer.ifaces[pe.port];
          if (pi && pi.mac) {
            const mac = U.macKey(pi.mac); p.psec.macs = p.psec.macs || []; const known = p.psec.macs.map(U.macKey);
            if (known.indexOf(mac) < 0) {
              if (known.length < (p.psec.max || 1) && p.psec.sticky) p.psec.macs.push(U.macFmt(pi.mac));
              else if ((p.psec.violation || 'shutdown') === 'shutdown') p.errdisabled = true;
            }
          }
        }
      }
    }
  } else if (ref.kind === 'svi') ref.obj.shut = !!shut; else ref.obj.adminDown = !!shut;
  const after = lineProto(s, ref);
  const physUp = ref.kind === 'port' ? (N.linkUp(s.W, d, nm)) : after;
  if (shut) { s.syslog('%LINK-5-CHANGED: Interface ' + nm + ', changed state to administratively down'); if (before) s.syslog('%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + nm + ', changed state to down'); }
  else {
    if (ref.kind === 'port' && ref.obj.errdisabled) { s.syslog('%PM-4-ERR_DISABLE: psecure-violation error detected on ' + I.shortIf(nm) + ', putting ' + I.shortIf(nm) + ' in err-disable state'); }
    else if (after && !before) { s.syslog('%LINK-3-UPDOWN: Interface ' + nm + ', changed state to up'); s.syslog('%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + nm + ', changed state to up'); }
  }
  s.mut(r, 'port'); s.env.advance(1);
}

/* ------------------------------------------------------------------ niveaux et sorties */
def('UP', 'enable', 'Turn on privileged commands', function (a, rest, o, r) {
  if (this.mode === 'P') return;
  const d = this.d; const have = d.enablePwd !== undefined && d.enablePwd !== '';
  if (!have) { if (this.via === 'console') { this.mode = 'P'; this.priv = 15; return; } o.l('% No password set'); return; }
  let tries = 0;
  const prompt = () => ({ prompt: 'Password: ', echo: false, cb: l => {
    if (l === d.enablePwd) { this.mode = 'P'; this.priv = 15; return { out: [] }; }
    tries++; if (tries >= 3) return { out: [L(d.enableSecret ? '% Bad secrets' : '% Access denied')] };
    return { out: [L('% Access denied')].slice(1), ask: prompt() };
  } });
  r.ask = prompt();
});
def('P', 'disable', 'Turn off privileged commands', function () { this.mode = 'U'; this.priv = 1; });
def('UP', 'exit', 'Exit from the EXEC', function (a, rest, o, r) { if (this.closeMsg) o.l(this.closeMsg); r.exit = true; r.pop = true; });
def('UP', 'logout', 'Exit from the EXEC', function (a, rest, o, r) { if (this.closeMsg) o.l(this.closeMsg); r.exit = true; r.pop = true; });
def('P', 'configure terminal', 'Configure from the terminal', function (a, rest, o) {
  this.mode = 'C'; this.ctx = {}; this.cfgChanged = false;
  o.l('Enter configuration commands, one per line.  End with CNTL/Z.');
});
def('P', 'configure', 'Enter configuration mode', function (a, rest, o, r) {
  r.ask = { prompt: 'Configuring from terminal, memory, or network [terminal]? ', echo: true, cb: l => { if (/^(t|)/i.test(l.trim()) && !/^[mn]/i.test(l.trim())) { this.mode = 'C'; this.ctx = {}; return { out: [L('Enter configuration commands, one per line.  End with CNTL/Z.')] }; } return { out: [L('% Not supported in this simulation')] }; } };
});
def('CILVADR', 'exit', 'Exit from configure mode', function () {
  if (this.mode === 'C') { this.leaveConfig(); return; }
  this.mode = 'C'; this.ctx = {};
});
def('CILVADR', 'end', 'Exit from configure mode', function () { this.leaveConfig(); });
def('UP', 'terminal length <num>', 'Set number of lines on a screen', function (a) { this.termLen = a[0]; });
def('UP', 'terminal width <num>', 'Set width of the display terminal', function () { });
def('UP', 'terminal monitor', 'Copy debug output to the current terminal line', function () { this.monitor = true; });
def('UP', 'terminal no monitor', 'Disable copy of debug output to the current terminal line', function () { this.monitor = false; });
D('terminal no', 'Negate a command or set its defaults');
def('UP', 'terminal history size <num>', 'Set history buffer size', function () { });
D('terminal history', 'Enable and control the command history function');

/* ------------------------------------------------------------------ enregistrement, rechargement, effacement */
def('P', 'write memory', 'Write to NV memory', function (a, rest, o, r) { saveCfg(this, o, r); });
def('P', 'write', 'Write running configuration to memory, network, or terminal', function (a, rest, o, r) { saveCfg(this, o, r); });
def('P', 'write erase', 'Erase NV memory', function (a, rest, o, r) { eraseStartup(this, o, r); });
def('P', 'erase startup-config', 'Erase contents of configuration memory', function (a, rest, o, r) { eraseStartup(this, o, r); });
def('P', 'copy running-config startup-config', 'Copy to startup-config', function (a, rest, o, r) {
  r.ask = { prompt: 'Destination filename [startup-config]? ', echo: true, cb: () => { const o2 = new E.Out(); saveCfg(this, o2, r); return { out: o2.lines, mutated: true }; } };
});
D('copy running-config', 'Copy from current system configuration'); D('copy', 'Copy from one file to another');
def('P', 'copy startup-config running-config', 'Copy to current system configuration', function (a, rest, o, r) {
  r.ask = { prompt: 'Destination filename [running-config]? ', echo: true, cb: () => { const snap = this.d._rt.startup; if (snap) I.restore(this.d, snap); this.mut(r, 'cfg'); return { out: [L('[OK]')], mutated: true }; } };
});
function saveCfg(s, o, r) {
  const d = s.d; o.l('Building configuration...'); s.env.advance(2);
  d._rt.startup = I.snapshot(d); d._rt.cfgDirty = false; d._rt.saves = (d._rt.saves || 0) + 1;
  o.l('[OK]'); r.mutated = true; s.env.touch('save');
}
function eraseStartup(s, o, r) {
  const d = s.d;
  r.ask = { prompt: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]', echo: true, cb: l => {
    if (/^n/i.test(l.trim())) return { out: [] };
    d._rt.startup = { __blank: true }; d._rt.cfgDirty = true; s.env.touch('wipe');
    return { out: [L('[OK]'), L('Erase of nvram: complete')], mutated: true, danger: 'wipe' };
  } };
}
I.factory = function (d) {
  const snap = { hostname: d.kind === 'ios-sw' ? 'Switch' : 'Router', domain: '', vlans: { 1: { name: 'default' } }, svi: {}, routes: [], acls: {}, nat: undefined, dhcp: undefined, lines: { vty: { transport: ['all'], login: 'login' }, console: { login: 'none' } }, ssh: {}, users: [], enableSecret: false, banner: '', defaultGateway: undefined };
  if (d.kind === 'ios-sw') { snap.ports = {}; Object.keys(d.ports).forEach(n => { snap.ports[n] = { mode: 'access', vlan: 1 }; }); }
  else { snap.ifaces = {}; Object.keys(d.ifaces).forEach(n => { if (!d.ifaces[n].parent) snap.ifaces[n] = { ip: '', mask: '', adminDown: true }; }); }
  return snap;
};
/* Redémarrage à froid : la configuration courante est remplacée par la configuration de démarrage (startup-config) ;
   utilisé par « reload » et par un cycle d'alimentation physique. */
I.coldBoot = function (W, d) {
  const snap = d._rt.startup;
  if (snap && snap.__blank) { const f = I.factory(d); I.restore(d, f); d.enablePwd = undefined; d.hostname = f.hostname; d.domain = ''; d.users = []; d.extra = {}; }
  else if (snap) { I.restore(d, snap); }
  if (d._rt.vlanDatDeleted && d.kind === 'ios-sw') { d.vlans = { 1: { name: 'default' } }; d._rt.vlanDatDeleted = false; }
  Object.keys(d.ports || {}).forEach(n => { d.ports[n].errdisabled = false; });
  if (d.nat) d._rt.nat = { tr: [] };
  d._rt.bootAt = W.clock.elapsed; d._rt.cfgDirty = false; d._rt.arp = {};
};
def('P', 'reload', 'Halt and perform a cold restart', function (a, rest, o, r) {
  const doReload = () => {
    const d = this.d; I.coldBoot(this.W, d);
    const msg = '%SYS-5-RELOAD: Reload requested by ' + (this.via === 'console' ? 'console' : (this.user || 'vty')) + '. Reload Reason: Reload Command.';
    this.W.log(this.devId, 'syslog', { msg });
    const ts = new Date(this.W.clock.base + this.W.clock.elapsed * 1000);
    this.env.advance(150); this.env.touch('reload');
    if (this.via === 'console') {
      /* console : l'équipement redémarre, on retrouve l'invite en mode utilisateur */
      U.av('ios-boot-text', 'Texte de démarrage affiché après « reload » sur la console : simplifié (le vrai journal de boot d’IOS n’est pas reproduit).');
      this.mode = 'U'; this.priv = 1; this.ctx = {}; this.pend = [];
      return { out: [L('*' + E.syslogTs(ts) + '.' + String(ts.getUTCMilliseconds()).padStart(3, '0') + ': ' + msg, 'o'), L(''), L('Press RETURN to get started!', 'o'), L('')], clear: false, mutated: true, impact: 'reboot' };
    }
    return { out: [L(''), L('Connection to ' + hostNameOf(d) + ' closed by remote host.', 'o')], exit: true, pop: true, mutated: true, impact: 'reboot' };
  };
  const confirm = () => ({ prompt: 'Proceed with reload? [confirm]', echo: true, cb: l => (/^n/i.test(l.trim()) ? { out: [] } : doReload()) });
  if (dirty(this)) {
    r.ask = { prompt: 'System configuration has been modified. Save? [yes/no]: ', echo: true, cb: l => {
      if (/^y/i.test(l.trim())) { const o2 = new E.Out(); saveCfg(this, o2, {}); return { out: o2.lines, ask: confirm(), mutated: true }; }
      if (/^n/i.test(l.trim())) return { out: [], ask: confirm() };
      return { out: [L('Please answer \'yes\' or \'no\'.')], ask: r.ask };
    } };
  } else r.ask = confirm();
});
def('P', 'delete *rest', 'Delete a file', function (a, rest, o, r) {
  const f = (rest[0] || '').replace(/^flash:\/?/i, ''); if (!rest.length) { o.l('% Incomplete command.'); return; }
  if (!/^vlan\.dat$/i.test(f) || this.d.kind !== 'ios-sw') { o.l('%Error deleting flash:/' + f + ' (No such file or directory)'); return; }
  r.ask = { prompt: 'Delete filename [vlan.dat]?', echo: true, cb: () => ({ out: [], ask: { prompt: 'Delete flash:/vlan.dat? [confirm]', echo: true, cb: l => { if (/^n/i.test(l.trim())) return { out: [] }; this.d._rt.vlanDatDeleted = true; this.env.touch('vlandat'); return { out: [], mutated: true, danger: 'wipe' }; } } }) };
});

/* ------------------------------------------------------------------ remise à zéro de compteurs, tables */
def('P', 'clear counters', 'Clear counters on one or all interfaces', function (a, rest, o, r) { this.d._rt.countersAt = this.W.clock.elapsed; o.l('Clear "show interface" counters on all interfaces [confirm]'); });
def('P', 'clear counters <if>', 'Clear counters on one or all interfaces', function (a, rest, o, r) { this.d._rt.countersAt = this.W.clock.elapsed; });
def('P', 'clear arp-cache', 'Clear the entire ARP cache', function () { this.d._rt.arp = {}; });
def('P', 'clear ip arp *rest', 'Clear the entire ARP cache', function () { this.d._rt.arp = {}; });
def('P', 'clear ip nat translation *', 'Clear dynamic NAT translations', function (a, rest, o, r) { if (this.d.kind !== 'ios-rt') { o.l('% Invalid input'); return; } this.d._rt.nat = { tr: [] }; this.mut(r, 'nat'); }, { rt: true });
def('P', 'clear logging', 'Clear logging buffer', function (a, rest, o, r) { r.ask = { prompt: 'Clear logging buffer [confirm]', echo: true, cb: () => { this.d._rt.logs = this.d._rt.logs || {}; this.d._rt.logs.syslog = []; return { out: [] }; } }; });
def('P', 'clear mac address-table dynamic', 'Clear dynamic entries', function () { this.d._rt.macClear = this.W.clock.elapsed; }, { sw: true });
def('P', 'clear port-security sticky interface <if>', 'Clear sticky secure MAC addresses', function (a, rest, o, r) {
  const ref = I.ifRef(this.d, a[0], false); if (!ref || ref.kind !== 'port') { o.l('% Invalid interface'); return; }
  if (ref.obj.psec) { ref.obj.psec.macs = []; this.mut(r, 'psec'); }
}, { sw: true });
D('clear port-security', 'Clear secure port information'); D('clear port-security sticky', 'Clear sticky secure MAC addresses');
D('clear mac', 'MAC forwarding table'); D('clear mac address-table', 'MAC forwarding table'); D('clear ip', 'IP'); D('clear ip nat', 'IP NAT information'); D('clear ip nat translation', 'Clear dynamic translation');

/* ------------------------------------------------------------------ configuration globale */
def('C', 'hostname <word>', 'Set system\'s network name', function (a, rest, o, r) {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(a[0])) { o.l('% Hostname contains one or more illegal characters.'); return; }
  this.d.hostname = a[0]; this.mut(r, 'hostname');
});
def('C', 'no hostname', 'Set system\'s network name', function (a, rest, o, r) { this.d.hostname = this.d.kind === 'ios-sw' ? 'Switch' : 'Router'; this.mut(r, 'hostname'); });
def('C', 'enable secret *rest', 'Assign the privileged level secret', function (a, rest, o, r) {
  if (!rest.length) { o.l('% Incomplete command.'); o.l(''); return; }
  let v = rest[rest.length - 1]; if (rest.length === 1 && /^[0-9]$/.test(rest[0])) { o.l('% Incomplete command.'); return; }
  if (rest[0] === '4' || rest[0] === '3') { o.l('% Invalid type specified'); return; }
  this.d.enablePwd = v; this.d.enableSecret = true; this.mut(r, 'enable');
});
def('C', 'enable password *rest', 'Assign the privileged level password (UNSAFE)', function (a, rest, o, r) {
  if (!rest.length) { o.l('% Incomplete command.'); return; }
  this.d.enablePwd = rest[rest.length - 1]; this.d.enableSecret = false; this.mut(r, 'enable');
});
def('C', 'no enable secret', 'Assign the privileged level secret', function (a, rest, o, r) { if (this.d.enableSecret) { this.d.enableSecret = false; this.d.enablePwd = undefined; this.mut(r, 'enable'); } });
def('C', 'no enable password', 'Assign the privileged level password (UNSAFE)', function (a, rest, o, r) { if (!this.d.enableSecret) { this.d.enablePwd = undefined; this.mut(r, 'enable'); } });
def('C', 'username <word> *rest', 'Establish User Name Authentication', function (a, rest, o, r) {
  let priv = 1, pwd; const t = rest.slice();
  while (t.length) {
    const w = t.shift().toLowerCase();
    if (w === 'privilege') { const n = +t.shift(); if (!(n >= 0 && n <= 15)) { o.l('% Invalid input detected'); return; } priv = n; }
    else if (w === 'secret' || w === 'password') { if (/^[0578]$/.test(t[0] || '') && t.length > 1) t.shift(); pwd = t.shift(); }
    else if (w === 'nopassword') pwd = undefined;
    else { o.l("% Invalid input detected at '^' marker."); return; }
  }
  const us = this.d.users = this.d.users || []; const ex = us.find(x => x.name === a[0]);
  if (ex) { ex.priv = priv; if (pwd !== undefined) ex.pwd = pwd; } else us.push({ name: a[0], priv, pwd });
  this.mut(r, 'user');
});
def('C', 'no username <word>', 'Establish User Name Authentication', function (a, rest, o, r) { this.d.users = (this.d.users || []).filter(x => x.name !== a[0]); this.mut(r, 'user'); });
def('C', 'banner motd *rest', 'Set Message of the Day banner', function (a, rest, o, r, line) {
  const body = line.replace(/^\s*banner\s+\S+\s*/i, ''); if (!body) { o.l('% Incomplete command.'); return; }
  const delim = body[0]; const inner = body.slice(1); const end = inner.indexOf(delim);
  if (end >= 0) { this.d.banner = inner.slice(0, end); this.mut(r, 'banner'); return; }
  const acc = [inner];
  const next = () => ({ prompt: '', echo: true, cb: l => { const k = l.indexOf(delim); if (k >= 0) { acc.push(l.slice(0, k)); this.d.banner = acc.join('\n').replace(/\n+$/, ''); this.mut(r, 'banner'); return { out: [], mutated: true }; } acc.push(l); return { out: [], ask: next() }; } });
  o.l('Enter TEXT message.  End with the character \'' + delim + '\'.'); r.ask = next();
});
def('C', 'no banner motd', 'Set Message of the Day banner', function (a, rest, o, r) { this.d.banner = ''; this.mut(r, 'banner'); });
D('banner', 'Define a login banner');
def('C', 'ip domain-name <word>', 'Define the default domain name', function (a, rest, o, r) { this.d.domain = a[0]; this.mut(r, 'domain'); });
def('C', 'ip domain name <word>', 'Define the default domain name', function (a, rest, o, r) { this.d.domain = a[0]; this.mut(r, 'domain'); });
def('C', 'no aaa new-model', U.av('ios-help-aaa', 'Enable NEW access control commands and functions.(Disables OLD commands.)'), function (a, rest, o, r) { });
def('C', 'no ip domain-name', 'Define the default domain name', function (a, rest, o, r) { this.d.domain = ''; this.mut(r, 'domain'); });
def('C', 'no ip domain name', 'Define the default domain name', function (a, rest, o, r) { this.d.domain = ''; this.mut(r, 'domain'); });
def('C', 'no ip domain-lookup', 'Enable IP Domain Name System hostname translation', function (a, rest, o, r) { this.d.domainLookup = false; this.mut(r, 'cfg'); });
def('C', 'ip domain-lookup', 'Enable IP Domain Name System hostname translation', function (a, rest, o, r) { delete this.d.domainLookup; this.mut(r, 'cfg'); });
D('ip domain', 'IP DNS Resolver'); D('no ip domain', 'IP DNS Resolver'); D('no ip', 'Global IP configuration subcommands'); D('no ip domain-name', 'Define the default domain name');
def('C', 'ip ssh version <num>', 'Specify protocol version supported', function (a, rest, o, r) { if (a[0] !== 1 && a[0] !== 2) { o.l('% Invalid input detected at \'^\' marker.'); return; } this.d.ssh = this.d.ssh || {}; this.d.ssh.version = a[0]; this.mut(r, 'ssh'); });
def('C', 'no ip ssh version', 'Specify protocol version supported', function (a, rest, o, r) { if (this.d.ssh) delete this.d.ssh.version; this.mut(r, 'ssh'); });
def('C', 'ip ssh time-out <num>', 'Specify SSH time-out interval', function (a, rest, o, r) { this.d.ssh = this.d.ssh || {}; this.d.ssh.timeout = a[0]; this.mut(r, 'ssh'); });
def('C', 'ip ssh authentication-retries <num>', 'Specify number of authentication retries', function (a, rest, o, r) { this.d.ssh = this.d.ssh || {}; this.d.ssh.retries = a[0]; this.mut(r, 'ssh'); });
D('ip ssh', 'Configure ssh options');
def('C', 'crypto key generate rsa', 'Generate RSA keys', function (a, rest, o, r) { genKeys(this, null, o, r); });
def('C', 'crypto key generate rsa modulus <num>', 'Provide number of modulus bits on the command line', function (a, rest, o, r) { genKeys(this, a[0], o, r); });
function genKeys(s, bits, o, r) {
  const d = s.d;
  if (IOS.hostnameDefault(d)) { o.l('% Please define a hostname other than ' + d.hostname + '.'); return; }
  if (!d.domain) { o.l('% Please define a domain-name first.'); return; }
  const name = d.hostname + '.' + d.domain;
  const gen = (n) => {
    if (n < 360 || n > 4096) return { out: [L('% Invalid input detected at \'^\' marker.')] };
    d.ssh = d.ssh || {}; d.ssh.rsa = true; d.ssh.bits = n; s.env.advance(n > 1024 ? 20 : 4); s.env.touch('ssh');
    s.syslog('%SSH-5-ENABLED: SSH ' + (d.ssh.version === 2 ? '2.0' : '1.99') + ' has been enabled');
    return { out: [L('% Generating ' + n + ' bit RSA keys, keys will be non-exportable...[OK] (elapsed time was ' + (n > 1024 ? 9 : 1) + ' seconds)')], mutated: true };
  };
  const fresh2 = (o, r) => {
    if (bits !== null) { const x = gen(bits); x.out.forEach(l => o.lines.push(l)); r.mutated = true; return; }
    o.l('The name for the keys will be: ' + name); o.l('Choose the size of the key modulus in the range of 360 to 4096 for your'); o.l('  General Purpose Keys. Choosing a key modulus greater than 512 may take'); o.l('  a few minutes.'); o.l('');
    r.ask = { prompt: 'How many bits in the modulus [512]: ', echo: true, cb: l => gen(l.trim() === '' ? 512 : parseInt(l, 10) || 0) };
  };
  if (d.ssh && d.ssh.rsa) {
    o.l('% You already have RSA keys defined named ' + name + '.');
    r.ask = { prompt: '% Do you really want to replace them? [yes/no]: ', echo: true, cb: l => {
      if (/^y/i.test(l.trim())) { const o2 = new E.Out(); const r2 = {}; fresh2(o2, r2); return { out: o2.lines, ask: r2.ask, mutated: true }; }
      if (/^n/i.test(l.trim())) return { out: [] };
      return { out: [L('% Please answer \'yes\' or \'no\'.')], ask: r.ask };
    } };
    return;
  }
  fresh2(o, r);
}
def('C', 'crypto key zeroize rsa', 'Zeroize RSA keys', function (a, rest, o, r) {
  const d = this.d; if (!(d.ssh && d.ssh.rsa)) { o.l('% No Signature RSA Keys found in configuration.'); return; }
  o.l('% All RSA keys will be removed.'); o.l('% All router certs issued using these keys will also be removed.');
  r.ask = { prompt: 'Do you really want to remove these keys? [yes/no]: ', echo: true, cb: l => { if (/^y/i.test(l.trim())) { d.ssh.rsa = false; this.syslog('%SSH-5-DISABLED: SSH ' + (d.ssh.version === 2 ? '2.0' : '1.99') + ' has been disabled'); this.env.touch('ssh'); return { out: [], mutated: true }; } return { out: [] }; } };
});
D('crypto key', 'Long term key operations'); D('crypto key generate', 'Generate new keys'); D('crypto key zeroize', 'Remove keys'); D('crypto key generate rsa', 'Generate RSA keys');
def('C', 'ip route <ip> <mask> <word> *rest', 'Establish static routes', function (a, rest, o, r) {
  if (!I.maskOk(a[1])) { o.l('% Invalid input detected at \'^\' marker.'); return; }
  const rt = (this.d.routes = this.d.routes || []);
  const net = U.netAddr(a[0], a[1]);
  if (net !== a[0]) { o.l('%Inconsistent address and mask'); return; }
  const rec = { net, mask: a[1], ad: 1 };
  if (U.isIP(a[2])) rec.nh = a[2]; else { const x = I.parseIfTokens(this.d, [a[2]].concat(rest), 0); const ref = x && I.ifRef(this.d, x.name, false); if (!ref) { o.l("% Invalid input detected at '^' marker."); return; } rec.iface = x.name; }
  const adTok = rest.find(t => /^\d+$/.test(t)); if (adTok) rec.ad = +adTok;
  const dup = rt.find(x => x.net === net && x.mask === a[1] && (x.nh || x.iface) === (rec.nh || rec.iface));
  if (dup) { dup.ad = rec.ad; this.mut(r, 'route'); return; }
  rt.push(rec); this.mut(r, 'route');
});
def('C', 'no ip route <ip> <mask> *rest', 'Establish static routes', function (a, rest, o, r) {
  const rt = this.d.routes || []; const nh = rest.find(t => U.isIP(t));
  const keep = rt.filter(x => !(x.net === a[0] && x.mask === a[1] && (!nh || x.nh === nh)));
  if (keep.length === rt.length) { o.l('%No matching route to delete'); return; }
  this.d.routes = keep; this.mut(r, 'route');
});
def('C', 'ip default-gateway <ip>', 'Specify default gateway (if not routing IP)', function (a, rest, o, r) { this.d.defaultGateway = a[0]; this.mut(r, 'route'); }, { sw: true });
def('C', 'no ip default-gateway', 'Specify default gateway (if not routing IP)', function (a, rest, o, r) { delete this.d.defaultGateway; this.mut(r, 'route'); }, { sw: true });
def('C', 'ip routing', 'Enable IP routing', function (a, rest, o, r) { if (!this.d.ipRouting && /2960/.test(this.d.model || '')) { o.l("% Invalid input detected at '^' marker."); return; } this.d.ipRouting = true; this.mut(r, 'route'); }, { sw: true });
def('C', 'no ip routing', 'Enable IP routing', function (a, rest, o, r) { this.d.ipRouting = false; this.mut(r, 'route'); }, { sw: true });
def('C', 'service dhcp', 'Enable DHCP server and relay agent', function (a, rest, o, r) { const dh = this.d.dhcp = this.d.dhcp || { service: true, excluded: [], pools: [] }; dh.service = true; this.mut(r, 'dhcp'); }, { rt: true });
def('C', 'no service dhcp', 'Enable DHCP server and relay agent', function (a, rest, o, r) { const dh = this.d.dhcp = this.d.dhcp || { service: true, excluded: [], pools: [] }; dh.service = false; this.mut(r, 'dhcp'); }, { rt: true });
D('no service', 'Modify use of network based services');
def('C', 'ip dhcp excluded-address <ip>', 'Prevent DHCP from assigning certain addresses', function (a, rest, o, r) { exclAdd(this, a[0], undefined, r); }, { rt: true });
def('C', 'ip dhcp excluded-address <ip> <ip>', 'Prevent DHCP from assigning certain addresses', function (a, rest, o, r) { exclAdd(this, a[0], a[1], r); }, { rt: true });
function exclAdd(s, lo, hi, r) { const dh = s.d.dhcp = s.d.dhcp || { service: true, excluded: [], pools: [] }; const e = { start: lo }; if (hi && hi !== lo) e.end = hi; if (!dh.excluded.some(x => x.start === e.start && (x.end || x.start) === (e.end || e.start))) dh.excluded.push(e); s.mut(r, 'dhcp'); }
def('C', 'no ip dhcp excluded-address <ip>', 'Prevent DHCP from assigning certain addresses', function (a, rest, o, r) { exclDel(this, a[0], undefined, o, r); }, { rt: true });
def('C', 'no ip dhcp excluded-address <ip> <ip>', 'Prevent DHCP from assigning certain addresses', function (a, rest, o, r) { exclDel(this, a[0], a[1], o, r); }, { rt: true });
function exclDel(s, lo, hi, o, r) { const dh = s.d.dhcp; if (!dh) return; const n = dh.excluded.length; dh.excluded = dh.excluded.filter(x => !(x.start === lo && (x.end || x.start) === (hi || lo))); if (dh.excluded.length === n) o.l('% Specified excluded address range does not exist'); else s.mut(r, 'dhcp'); }
def('C', 'ip dhcp pool <word>', 'Configure DHCP address pools', function (a, rest, o, r) {
  const dh = this.d.dhcp = this.d.dhcp || { service: true, excluded: [], pools: [] };
  let p = dh.pools.find(x => x.name === a[0]); if (!p) { p = { name: a[0], net: '', mask: '', dns: [] }; dh.pools.push(p); this.mut(r, 'dhcp'); }
  this.mode = 'D'; this.ctx = { pool: a[0] };
}, { rt: true });
def('C', 'no ip dhcp pool <word>', 'Configure DHCP address pools', function (a, rest, o, r) { const dh = this.d.dhcp; if (!dh) return; dh.pools = dh.pools.filter(x => x.name !== a[0]); this.mut(r, 'dhcp'); }, { rt: true });
D('ip dhcp', 'Configure DHCP server and relay parameters'); D('no ip dhcp', 'Configure DHCP server and relay parameters');

/* --- VLAN --- */
def('C', 'vlan <vlan>', 'VLAN commands', function (a, rest, o, r) {
  const d = this.d; d.vlans = d.vlans || {};
  if (!d.vlans[a[0]]) { d.vlans[a[0]] = { name: 'VLAN' + String(a[0]).padStart(4, '0') }; this.mut(r, 'vlan'); }
  this.mode = 'V'; this.ctx = { vlan: a[0] };
}, { sw: true });
def('C', 'no vlan <vlan>', 'VLAN commands', function (a, rest, o, r) {
  const d = this.d; if (a[0] === 1) { o.l('%Default VLAN 1 may not be deleted.'); return; }
  if (!d.vlans[a[0]]) return;
  delete d.vlans[a[0]]; this.mut(r, 'vlan');
}, { sw: true });
def('V', 'name <word>', 'Ascii name of the VLAN', function (a, rest, o, r) { this.d.vlans[this.ctx.vlan].name = a[0]; this.mut(r, 'vlan'); });
def('V', 'state active', 'VLAN transmitting', function (a, rest, o, r) { delete this.d.vlans[this.ctx.vlan].suspend; this.mut(r, 'vlan'); });
def('V', 'state suspend', 'VLAN not transmitting packets', function (a, rest, o, r) { this.d.vlans[this.ctx.vlan].suspend = true; this.mut(r, 'vlan'); });
D('state', 'Operational state of the VLAN');

/* --- interfaces --- */
function enterIf(s, names, o, r) {
  const refs = names.map(n => I.ifRef(s.d, n, true)); if (refs.some(x => !x)) return false;
  if (refs.some(x => x.created)) s.mut(r, 'iface');
  s.mode = 'I'; s.ctx = { ifs: refs.map(x => x.name) }; return true;
}
def('C', 'interface <if>', 'Select an interface to configure', function (a, rest, o, r, line) {
  enterIf(this, [a[0]], o, r);
});
def('C', 'interface range *rest', 'configure a range of interfaces', function (a, rest, o, r) {
  const names = parseRange(this, rest); if (!names) { o.l("% Invalid input detected at '^' marker."); o.l(''); return; }
  enterIf(this, names, o, r);
});
D('interface range', 'interface range command');
def('C', 'no interface <if>', 'Select an interface to configure', function (a, rest, o, r) {
  const d = this.d; if (d.kind === 'ios-sw' && /^Vlan\d+$/.test(a[0])) { delete d.svi[a[0]]; this.mut(r, 'iface'); return; }
  if (d.ifaces && d.ifaces[a[0]] && d.ifaces[a[0]].parent) { delete d.ifaces[a[0]]; this.mut(r, 'iface'); return; }
  o.l('% Not all config may be removed and may reappear after reactivating the logical-interface/sub-interfaces');
});
function parseRange(s, toks) {
  const txt = toks.join(' ').replace(/\s*-\s*/g, ' - ').replace(/\s*,\s*/g, ' , '); const parts = txt.split(' , ').map(x => x.trim()).filter(Boolean); const out = [];
  for (const part of parts) {
    const t = part.split(/\s+/); const m = I.parseIfTokens(s.d, t, 0); if (!m) return null;
    const dash = t.indexOf('-'); const baseName = m.name;
    if (dash < 0) { if (!I.ifRef(s.d, baseName, false)) return null; out.push(baseName); continue; }
    const mm = baseName.match(/^([A-Za-z]+)(\d+\/)(\d+)$/); if (!mm) return null;
    let endTok = t[dash + 1]; if (endTok === undefined) return null; let end = parseInt(endTok.replace(/^.*\//, ''), 10); if (!(end >= +mm[3])) return null;
    for (let k = +mm[3]; k <= end; k++) { const nm = mm[1] + mm[2] + k; if (!I.ifRef(s.d, nm, false)) return null; out.push(nm); }
  }
  return out.length ? out : null;
}
def('I', 'description *rest', 'Interface specific description', function (a, rest, o, r, line) {
  const txt = line.replace(/^\s*description\s*/i, '').trim(); if (!txt) { o.l('% Incomplete command.'); return; }
  eachIf(this, x => { x.obj.desc = txt.slice(0, 200); }); this.mut(r, 'iface');
});
def('I', 'no description', 'Interface specific description', function (a, rest, o, r) { eachIf(this, x => { delete x.obj.desc; }); this.mut(r, 'iface'); });
def('I', 'shutdown', 'Shutdown the selected interface', function (a, rest, o, r) { eachIf(this, x => setShut(this, x, true, o, r)); });
def('I', 'no shutdown', 'Shutdown the selected interface', function (a, rest, o, r) { eachIf(this, x => setShut(this, x, false, o, r)); });
D('no switchport', 'Set switching mode characteristics'); D('no switchport port-security', 'Disable port security on the interface');
function onlyPorts(s, o) { const refs = curRef(s); if (refs.some(x => x.kind !== 'port')) { o.l("% Invalid input detected at '^' marker."); return false; } return true; }
def('I', 'switchport mode access', 'Set trunking mode to ACCESS unconditionally', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { x.obj.mode = 'access'; }); this.mut(r, 'port'); }, { sw: true });
def('I', 'switchport mode trunk', 'Set trunking mode to TRUNK unconditionally', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { x.obj.mode = 'trunk'; if (x.obj.allowed === undefined) x.obj.allowed = 'all'; if (x.obj.native === undefined) x.obj.native = 1; }); this.mut(r, 'port'); }, { sw: true });
D('switchport mode', 'Set trunking mode of the interface');
def('I', 'switchport access vlan <vlan>', 'Set VLAN when interface is in access mode', function (a, rest, o, r) {
  if (!onlyPorts(this, o)) return;
  const d = this.d; if (!d.vlans[a[0]]) { d.vlans[a[0]] = { name: 'VLAN' + String(a[0]).padStart(4, '0') }; o.l('% Access VLAN does not exist. Creating vlan ' + a[0]); }
  eachIf(this, x => { x.obj.vlan = a[0]; }); this.mut(r, 'port');
}, { sw: true });
D('switchport access', 'Set access mode characteristics of the interface');
function trunkAllowed(s, o, r, how, list) {
  if (!onlyPorts(s, o)) return;
  eachIf(s, x => {
    const p = x.obj; const all = Array.from({ length: 4094 }, (_, i) => i + 1); const cur = p.allowed === 'all' || p.allowed === undefined ? all : p.allowed.slice();
    if (how === 'set') p.allowed = list.slice(); else if (how === 'add') p.allowed = U.uniq(cur.concat(list)).sort((a2, b2) => a2 - b2); else if (how === 'remove') p.allowed = cur.filter(v => list.indexOf(v) < 0);
    else if (how === 'except') p.allowed = all.filter(v => list.indexOf(v) < 0); else if (how === 'all') p.allowed = 'all'; else if (how === 'none') p.allowed = [];
    if (Array.isArray(p.allowed) && p.allowed.length === 4094) p.allowed = 'all';
  });
  s.mut(r, 'port');
}
def('I', 'switchport trunk allowed vlan <vlanlist>', 'Set allowed VLAN characteristics when interface is in trunking mode', function (a, rest, o, r) { const l = I.vlanList(a[0]); if (!l) { o.l("% Invalid input detected at '^' marker."); return; } trunkAllowed(this, o, r, 'set', l); }, { sw: true });
def('I', 'switchport trunk allowed vlan add <vlanlist>', 'add VLANs to the current list', function (a, rest, o, r) { const l = I.vlanList(a[0]); if (!l) { o.l("% Invalid input detected at '^' marker."); return; } trunkAllowed(this, o, r, 'add', l); }, { sw: true });
def('I', 'switchport trunk allowed vlan remove <vlanlist>', 'remove VLANs from the current list', function (a, rest, o, r) { const l = I.vlanList(a[0]); if (!l) { o.l("% Invalid input detected at '^' marker."); return; } trunkAllowed(this, o, r, 'remove', l); }, { sw: true });
def('I', 'switchport trunk allowed vlan except <vlanlist>', 'all VLANs except the following', function (a, rest, o, r) { const l = I.vlanList(a[0]); if (!l) { o.l("% Invalid input detected at '^' marker."); return; } trunkAllowed(this, o, r, 'except', l); }, { sw: true });
def('I', 'switchport trunk allowed vlan all', 'all VLANs', function (a, rest, o, r) { trunkAllowed(this, o, r, 'all', []); }, { sw: true });
def('I', 'switchport trunk allowed vlan none', 'no VLANs', function (a, rest, o, r) { trunkAllowed(this, o, r, 'none', []); }, { sw: true });
def('I', 'no switchport trunk allowed vlan', 'Set allowed VLAN characteristics when interface is in trunking mode', function (a, rest, o, r) { trunkAllowed(this, o, r, 'all', []); }, { sw: true });
Object.assign(I.wordDesc, { 'switchport trunk allowed': 'Set allowed VLAN characteristics when interface is in trunking mode', 'switchport trunk allowed vlan': 'Set allowed VLAN characteristics when interface is in trunking mode', 'switchport trunk native': 'Set trunking native characteristics when interface is in trunking mode', 'switchport trunk native vlan': 'Set native VLAN when interface is in trunking mode', 'switchport trunk encapsulation': 'Set trunking encapsulation when interface is in trunking mode' });
def('I', 'switchport trunk native vlan <vlan>', 'Set native VLAN when interface is in trunking mode', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { x.obj.native = a[0]; }); this.mut(r, 'port'); }, { sw: true });
def('I', 'no switchport trunk native vlan', 'Set native VLAN when interface is in trunking mode', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { x.obj.native = 1; }); this.mut(r, 'port'); }, { sw: true });
def('I', 'switchport trunk encapsulation dot1q', 'Set trunking encapsulation to 802.1Q', function (a, rest, o, r) { if (/2960/.test(this.d.model || '')) { o.l("% Invalid input detected at '^' marker."); o.l(''); return; } }, { sw: true });
/* port-security */
function psecOf(p) { p.psec = p.psec || { enabled: false, max: 1, violation: 'shutdown', sticky: false, macs: [] }; return p.psec; }
function psecPorts(s, o) { if (!onlyPorts(s, o)) return false; const bad = curRef(s).find(x => x.obj.mode === 'trunk'); if (bad) { o.l('Command rejected: ' + bad.name + ' is a trunk port.'); return false; } return true; }
def('I', 'switchport port-security', 'Enable port security on the interface', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { psecOf(x.obj).enabled = true; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'no switchport port-security', 'Disable port security on the interface', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { if (x.obj.psec) { x.obj.psec.enabled = false; } }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security maximum <num>', 'Max secure addresses', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { psecOf(x.obj).max = a[0]; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'no switchport port-security maximum', 'Max secure addresses', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { if (x.obj.psec) x.obj.psec.max = 1; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security violation shutdown', 'Security violation shuts down interface', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { psecOf(x.obj).violation = 'shutdown'; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security violation restrict', 'Security violation restricts', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { psecOf(x.obj).violation = 'restrict'; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security violation protect', 'Security violation protects', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { psecOf(x.obj).violation = 'protect'; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security mac-address sticky', 'Configure dynamic secure addresses as sticky', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { psecOf(x.obj).sticky = true; }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'no switchport port-security mac-address sticky', 'Configure dynamic secure addresses as sticky', function (a, rest, o, r) { if (!onlyPorts(this, o)) return; eachIf(this, x => { if (x.obj.psec) { x.obj.psec.sticky = false; x.obj.psec.macs = []; } }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security mac-address <mac>', 'Secure MAC address', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { const p = psecOf(x.obj); if (p.macs.map(U.macKey).indexOf(U.macKey(a[0])) < 0) { if (p.macs.length >= p.max) { o.l('% Maximum number of secure MAC addresses already configured'); } else p.macs.push(U.macFmt(a[0])); } }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'switchport port-security mac-address sticky <mac>', 'Sticky MAC address', function (a, rest, o, r) { if (!psecPorts(this, o)) return; eachIf(this, x => { const p = psecOf(x.obj); p.sticky = true; if (p.macs.map(U.macKey).indexOf(U.macKey(a[0])) < 0 && p.macs.length < p.max) p.macs.push(U.macFmt(a[0])); }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'no switchport port-security mac-address <mac>', 'Secure MAC address', function (a, rest, o, r) { eachIf(this, x => { if (x.obj.psec) x.obj.psec.macs = x.obj.psec.macs.filter(m => U.macKey(m) !== U.macKey(a[0])); }); this.mut(r, 'psec'); }, { sw: true });
def('I', 'no switchport port-security mac-address sticky <mac>', 'Sticky MAC address', function (a, rest, o, r) { eachIf(this, x => { if (x.obj.psec) x.obj.psec.macs = x.obj.psec.macs.filter(m => U.macKey(m) !== U.macKey(a[0])); }); this.mut(r, 'psec'); }, { sw: true });
Object.assign(I.wordDesc, { 'switchport port-security mac-address': 'Secure mac address', 'switchport port-security violation': 'Security violation mode', 'switchport port-security maximum': 'Max secure addresses', 'no switchport port-security mac-address': 'Secure mac address' });
/* adresse IP, relais, ACL, NAT */
def('I', 'ip address <ip> <mask>', 'Set the IP address of an interface', function (a, rest, o, r) {
  const refs = curRef(this); if (refs.some(x => x.kind === 'port')) { o.l("% Invalid input detected at '^' marker."); o.l(''); return; }
  if (!I.maskOk(a[1])) { o.l('Bad mask 0x' + (U.ip2n(a[1]) >>> 0).toString(16).toUpperCase() + ' for address ' + a[0]); return; }
  if (/^(0|127|22[4-9]|2[3-5]\d)\./.test(a[0])) { o.l('Invalid address'); return; }
  const dup = Object.keys(this.d.ifaces || {}).map(n => ({ n, i: this.d.ifaces[n] })).concat(Object.keys(this.d.svi || {}).map(n => ({ n, i: this.d.svi[n] }))).find(x => x.i.ip === a[0] && refs.every(rf => rf.name !== x.n));
  if (dup) { o.l('% ' + a[0] + ' is assigned to ' + dup.n); return; }
  const over = refs[0] && Object.keys(this.d.ifaces || {}).map(n => ({ n, i: this.d.ifaces[n] })).concat(Object.keys(this.d.svi || {}).map(n => ({ n, i: this.d.svi[n] }))).find(x => x.i.ip && x.n !== refs[0].name && x.i.mask && U.netAddr(x.i.ip, x.i.mask) === U.netAddr(a[0], a[1]));
  if (over) { o.l('% ' + U.netAddr(a[0], a[1]) + ' overlaps with ' + over.n); return; }
  eachIf(this, x => { x.obj.ip = a[0]; x.obj.mask = a[1]; }); this.mut(r, 'iface'); this.env.advance(1);
});
def('I', 'no ip address', 'Set the IP address of an interface', function (a, rest, o, r) { if (!curRef(this).every(x => x.kind !== 'port')) { o.l("% Invalid input detected at '^' marker."); return; } eachIf(this, x => { x.obj.ip = ''; x.obj.mask = ''; }); this.mut(r, 'iface'); });
def('I', 'ip helper-address <ip>', 'Specify a destination address for UDP broadcasts', function (a, rest, o, r) { eachIf(this, x => { x.obj.helpers = x.obj.helpers || []; if (x.obj.helpers.indexOf(a[0]) < 0) x.obj.helpers.push(a[0]); }); this.mut(r, 'iface'); });
def('I', 'no ip helper-address <ip>', 'Specify a destination address for UDP broadcasts', function (a, rest, o, r) { eachIf(this, x => { x.obj.helpers = (x.obj.helpers || []).filter(h => h !== a[0]); if (!x.obj.helpers.length) delete x.obj.helpers; }); this.mut(r, 'iface'); });
def('I', 'no ip helper-address', 'Specify a destination address for UDP broadcasts', function (a, rest, o, r) { eachIf(this, x => { delete x.obj.helpers; }); this.mut(r, 'iface'); });
def('I', 'ip access-group <word> in', 'inbound packets', function (a, rest, o, r) { eachIf(this, x => { x.obj.aclIn = a[0]; }); this.mut(r, 'acl'); }, { l3: true });
def('I', 'ip access-group <word> out', 'outbound packets', function (a, rest, o, r) { eachIf(this, x => { x.obj.aclOut = a[0]; }); this.mut(r, 'acl'); }, { l3: true });
def('I', 'no ip access-group <word> in', 'inbound packets', function (a, rest, o, r) { eachIf(this, x => { if (x.obj.aclIn === a[0]) delete x.obj.aclIn; }); this.mut(r, 'acl'); }, { l3: true });
def('I', 'no ip access-group <word> out', 'outbound packets', function (a, rest, o, r) { eachIf(this, x => { if (x.obj.aclOut === a[0]) delete x.obj.aclOut; }); this.mut(r, 'acl'); }, { l3: true });
def('I', 'ip nat inside', 'Inside interface for address translation', function (a, rest, o, r) { eachIf(this, x => { x.obj.natSide = 'inside'; }); this.mut(r, 'nat'); }, { rt: true });
def('I', 'ip nat outside', 'Outside interface for address translation', function (a, rest, o, r) { eachIf(this, x => { x.obj.natSide = 'outside'; }); this.mut(r, 'nat'); }, { rt: true });
def('I', 'no ip nat inside', 'Inside interface for address translation', function (a, rest, o, r) { eachIf(this, x => { if (x.obj.natSide === 'inside') delete x.obj.natSide; }); this.mut(r, 'nat'); }, { rt: true });
def('I', 'no ip nat outside', 'Outside interface for address translation', function (a, rest, o, r) { eachIf(this, x => { if (x.obj.natSide === 'outside') delete x.obj.natSide; }); this.mut(r, 'nat'); }, { rt: true });
def('I', 'encapsulation dot1Q <vlan> *rest', 'IEEE 802.1Q Virtual LAN', function (a, rest, o, r) {
  const refs = curRef(this); if (refs.some(x => !x.obj.parent)) { o.l('% Configuration of the physical interface is not supported with this command'.replace(/^.*$/, "% Invalid input detected at '^' marker.")); return; }
  eachIf(this, x => { x.obj.encap = a[0]; if (rest.some(t => /^native$/i.test(t))) x.obj.native = true; else delete x.obj.native; }); this.mut(r, 'iface');
}, { rt: true });
def('I', 'no encapsulation dot1Q', 'IEEE 802.1Q Virtual LAN', function (a, rest, o, r) { eachIf(this, x => { delete x.obj.encap; }); this.mut(r, 'iface'); }, { rt: true });
D('encapsulation', 'Set encapsulation type for an interface');
/* commandes valides sans effet simulé : mémorisées pour le running-config */
function ifKey(s) { return 'if:' + (s.ctx.ifs || []).join(','); }
def('I', 'duplex <word>', 'Configure duplex operation.', function (a, rest, o, r) { if (['auto', 'full', 'half'].indexOf(a[0]) < 0) { o.l("% Invalid input detected at '^' marker."); return; } eachIf(this, x => { x.obj.duplex = a[0]; }); this.mut(r, 'iface'); });
def('I', 'speed <word>', 'Configure speed operation.', function (a, rest, o, r) { if (['auto', '10', '100', '1000'].indexOf(a[0]) < 0) { o.l("% Invalid input detected at '^' marker."); return; } eachIf(this, x => { x.obj.speed = a[0]; }); this.mut(r, 'iface'); });
def('I', 'no duplex', 'Configure duplex operation.', function (a, rest, o, r) { eachIf(this, x => { delete x.obj.duplex; }); this.mut(r, 'iface'); });
def('I', 'no speed', 'Configure speed operation.', function (a, rest, o, r) { eachIf(this, x => { delete x.obj.speed; }); this.mut(r, 'iface'); });
def('I', 'spanning-tree *rest', 'Spanning Tree Subsystem', function (a, rest, o, r, line) { if (!rest.length) { o.l('% Incomplete command.'); return; } eachIf(this, x => { x.obj.extra = x.obj.extra || []; const t = line.trim().replace(/\s+/g, ' '); if (x.obj.extra.indexOf(t) < 0) x.obj.extra.push(t); }); this.mut(r, 'iface'); }, { sw: true });
def('I', 'no spanning-tree *rest', 'Spanning Tree Subsystem', function (a, rest, o, r, line) { const t = line.trim().replace(/\s+/g, ' ').replace(/^no /, ''); eachIf(this, x => { x.obj.extra = (x.obj.extra || []).filter(e => e !== t); }); this.mut(r, 'iface'); }, { sw: true });
def('I', 'switchport nonegotiate', 'Device will not engage in negotiation protocol on this interface', function (a, rest, o, r) { eachIf(this, x => { x.obj.extra = x.obj.extra || []; if (x.obj.extra.indexOf('switchport nonegotiate') < 0) x.obj.extra.push('switchport nonegotiate'); }); this.mut(r, 'iface'); }, { sw: true });

/* --- lignes --- */
def('C', 'line vty <num> <num>', 'Virtual terminal', function (a, rest, o, r) { this.mode = 'L'; this.ctx = { line: 'vty', range: a }; });
def('C', 'line console <num>', 'Primary terminal line', function (a, rest, o, r) { this.mode = 'L'; this.ctx = { line: 'console', range: a }; });
D('line', 'Configure a terminal line');
function ln(s) { const d = s.d; d.lines = d.lines || {}; return (d.lines[s.ctx.line] = d.lines[s.ctx.line] || {}); }
def('L', 'transport input <word> *rest', 'Define which protocols to use when connecting to the terminal server', function (a, rest, o, r) {
  const v = [a[0]].concat(rest).map(x => x.toLowerCase()); const known = ['ssh', 'telnet', 'all', 'none'];
  for (const t of v) if (!known.some(k => k.indexOf(t) === 0)) { o.l("% Invalid input detected at '^' marker."); return; }
  const full = v.map(t => known.find(k => k.indexOf(t) === 0)); ln(this).transport = full.indexOf('all') >= 0 ? ['all'] : full.indexOf('none') >= 0 ? ['none'] : U.uniq(full); this.mut(r, 'line');
});
D('transport input', 'Define which protocols to use when connecting to the terminal server');
def('L', 'login local', 'Local password checking', function (a, rest, o, r) { ln(this).login = 'local'; this.mut(r, 'line'); });
def('L', 'login', 'Enable password checking', function (a, rest, o, r) { ln(this).login = 'login'; this.mut(r, 'line'); });
def('L', 'no login', 'Enable password checking', function (a, rest, o, r) { ln(this).login = 'none'; this.mut(r, 'line'); });
def('L', 'password *rest', 'Set a password', function (a, rest, o, r) { if (!rest.length) { o.l('% Incomplete command.'); return; } ln(this).password = rest[rest.length - 1]; this.mut(r, 'line'); });
def('L', 'no password', 'Set a password', function (a, rest, o, r) { delete ln(this).password; this.mut(r, 'line'); });
def('L', 'access-class <word> in', 'Filter incoming connections', function (a, rest, o, r) { ln(this).accessClass = a[0]; this.mut(r, 'line'); });
def('L', 'no access-class <word> in', 'Filter incoming connections', function (a, rest, o, r) { delete ln(this).accessClass; this.mut(r, 'line'); });
def('L', 'no access-class <word>', 'Filter connections', function (a, rest, o, r) { delete ln(this).accessClass; this.mut(r, 'line'); });
def('L', 'exec-timeout <minute> *rest', 'Set the EXEC timeout', function (a, rest, o, r) { ln(this).execTimeout = a[0] + (rest[0] ? ' ' + rest[0] : ''); this.mut(r, 'line'); });
def('L', 'logging synchronous', 'Synchronized message output', function (a, rest, o, r) { ln(this).loggingSync = true; this.mut(r, 'line'); });
D('logging', 'Modify message logging facilities');

/* --- ACL --- */
const aclTypeOf = n => { const v = +n; return (v >= 1 && v <= 99) || (v >= 1300 && v <= 1999) ? 'standard' : (v >= 100 && v <= 199) || (v >= 2000 && v <= 2699) ? 'extended' : null; };
function badAt(s, o, line, tokIndex) { const tk = s.tokens(line); o.lines.push(s.caret(line, tk.pos[tokIndex] === undefined ? line.length : tk.pos[tokIndex])); o.l("% Invalid input detected at '^' marker."); o.l(''); }
def('C', 'access-list <acl> *rest', 'Add an access list entry', function (a, rest, o, r, line) {
  const type = aclTypeOf(a[0]); if (!type) { badAt(this, o, line, 1); return; }
  if (!rest.length) { o.l('% Incomplete command.'); return; }
  if (rest[0].toLowerCase() === 'remark') return;
  const p = I.parseAclEntry(type, rest); if (p.err !== undefined) { badAt(this, o, line, 2 + p.err); return; }
  const key = String(a[0]); const acls = (this.d.acls = this.d.acls || {}); const acl = acls[key] = acls[key] || { type, entries: [] };
  I.insertEntry(acl, p.e); this.mut(r, 'acl');
});
def('C', 'no access-list <acl>', 'Add an access list entry', function (a, rest, o, r) { if (this.d.acls) delete this.d.acls[String(a[0])]; this.mut(r, 'acl'); });
def('C', 'ip access-list standard <word>', 'Standard Access List', function (a, rest, o, r) { aclEnter(this, 'standard', a[0], o, r); });
def('C', 'ip access-list extended <word>', 'Extended Access List', function (a, rest, o, r) { aclEnter(this, 'extended', a[0], o, r); });
def('C', 'no ip access-list standard <word>', 'Standard Access List', function (a, rest, o, r) { if (this.d.acls) delete this.d.acls[a[0]]; this.mut(r, 'acl'); });
def('C', 'no ip access-list extended <word>', 'Extended Access List', function (a, rest, o, r) { if (this.d.acls) delete this.d.acls[a[0]]; this.mut(r, 'acl'); });
D('ip access-list extended', 'Extended Access List'); D('ip access-list standard', 'Standard Access List');
function aclEnter(s, type, name, o, r) {
  const acls = (s.d.acls = s.d.acls || {}); let acl = acls[name];
  if (acl && acl.type !== type) { o.l('% Access-list ' + name + ' of different type exists'); return; }
  if (!acl) { acls[name] = { type, entries: [] }; s.mut(r, 'acl'); }
  s.mode = 'A'; s.ctx = { acl: { name, type } };
}
function aclCur(s) { return s.d.acls[s.ctx.acl.name]; }
def('A', 'permit *rest', 'Specify packets to forward', function (a, rest, o, r, line) { aclAdd(this, 'permit', rest, o, r, line); });
def('A', 'deny *rest', 'Specify packets to reject', function (a, rest, o, r, line) { aclAdd(this, 'deny', rest, o, r, line); });
function aclAdd(s, act, rest, o, r, line) {
  const acl = aclCur(s); let seq; const toks = [act].concat(rest);
  if (!rest.length) { o.l('% Incomplete command.'); return; }
  const p = I.parseAclEntry(acl.type, toks); if (p.err !== undefined) { badAt(s, o, line, p.err); return; }
  I.insertEntry(acl, p.e); s.mut(r, 'acl');
}
def('A', '<seq> permit *rest', 'Specify packets to forward', function (a, rest, o, r, line) { aclAddSeq(this, a[0], 'permit', rest, o, r, line); });
def('A', '<seq> deny *rest', 'Specify packets to reject', function (a, rest, o, r, line) { aclAddSeq(this, a[0], 'deny', rest, o, r, line); });
function aclAddSeq(s, seq, act, rest, o, r, line) {
  const acl = aclCur(s); const p = I.parseAclEntry(acl.type, [act].concat(rest)); if (p.err !== undefined) { badAt(s, o, line, p.err + 1); return; }
  if (!I.insertEntry(acl, p.e, seq)) { o.l('% Duplicate sequence number'); return; } s.mut(r, 'acl');
}
def('A', 'no <seq>', 'Negate a command or set its defaults', function (a, rest, o, r) { const acl = aclCur(this); I.normSeq(acl); const k = acl.entries.findIndex(e => e.seq === a[0]); if (k < 0) return; acl.entries.splice(k, 1); this.mut(r, 'acl'); });
def('A', 'no permit *rest', 'Specify packets to forward', function (a, rest, o, r, line) { aclDel(this, 'permit', rest, o, r); });
def('A', 'no deny *rest', 'Specify packets to reject', function (a, rest, o, r, line) { aclDel(this, 'deny', rest, o, r); });
function aclDel(s, act, rest, o, r) { const acl = aclCur(s); const p = I.parseAclEntry(acl.type, [act].concat(rest)); if (p.err !== undefined) { o.l("% Invalid input detected at '^' marker."); return; } const t = I.entryText(acl.type, p.e); const k = acl.entries.findIndex(e => I.entryText(acl.type, e) === t); if (k < 0) return; acl.entries.splice(k, 1); s.mut(r, 'acl'); }
def('A', 'remark *rest', 'Access list entry comment', function (a, rest, o, r) { });

/* --- DHCP --- */
function pool(s) { return s.d.dhcp.pools.find(x => x.name === s.ctx.pool); }
def('D', 'network <ip> <mask>', 'Network number and mask', function (a, rest, o, r) { if (!I.maskOk(a[1])) { o.l('Bad mask'); return; } const p = pool(this); p.net = U.netAddr(a[0], a[1]); p.mask = a[1]; this.mut(r, 'dhcp'); });
def('D', 'network <ip>', 'Network number and mask', function (a, rest, o, r) { const p = pool(this); p.net = a[0]; p.mask = '255.255.255.0'; this.mut(r, 'dhcp'); });
def('D', 'default-router <ip> *rest', 'Default routers', function (a, rest, o, r) { pool(this).gw = a[0]; this.mut(r, 'dhcp'); });
def('D', 'no default-router', 'Default routers', function (a, rest, o, r) { delete pool(this).gw; this.mut(r, 'dhcp'); });
def('D', 'dns-server <ip> *rest', 'DNS servers', function (a, rest, o, r) { const l = [a[0]].concat(rest.filter(t => U.isIP(t))); pool(this).dns = l; this.mut(r, 'dhcp'); });
def('D', 'no dns-server', 'DNS servers', function (a, rest, o, r) { pool(this).dns = []; this.mut(r, 'dhcp'); });
def('D', 'domain-name <word>', 'Domain name', function (a, rest, o, r) { pool(this).domain = a[0]; this.mut(r, 'dhcp'); });
def('D', 'lease <num> *rest', 'Address lease time', function (a, rest, o, r) { pool(this).leaseDays = a[0]; this.mut(r, 'dhcp'); });

/* --- NAT globale --- */
def('C', 'ip nat inside source list <word> interface <if> overload', 'Interface for global address', function (a, rest, o, r) {
  const ref = I.ifRef(this.d, a[1], false); if (!ref) { o.l("% Invalid input detected at '^' marker."); return; }
  const nat = (this.d.nat = this.d.nat || { pools: {}, rules: [] });
  if (!nat.rules.some(x => x.type === 'dynamic' && x.acl === String(a[0]) && x.iface === a[1])) nat.rules.push({ type: 'dynamic', acl: String(a[0]), iface: a[1], overload: true });
  this.mut(r, 'nat');
}, { rt: true });
def('C', 'ip nat inside source list <word> pool <word> *rest', 'Name pool of global addresses', function (a, rest, o, r) {
  const nat = (this.d.nat = this.d.nat || { pools: {}, rules: [] });
  if (!nat.pools[a[1]]) { o.l('%Pool ' + a[1] + ' not found'); return; }
  const ov = rest.some(t => /^overload$/i.test(t)); if (!nat.rules.some(x => x.type === 'dynamic' && x.acl === String(a[0]) && x.pool === a[1])) nat.rules.push({ type: 'dynamic', acl: String(a[0]), pool: a[1], overload: ov });
  this.mut(r, 'nat');
}, { rt: true });
def('C', 'ip nat pool <word> <ip> <ip> netmask <mask>', 'Define pool of addresses', function (a, rest, o, r) { const nat = (this.d.nat = this.d.nat || { pools: {}, rules: [] }); nat.pools[a[0]] = { start: a[1], end: a[2], mask: a[3] }; this.mut(r, 'nat'); }, { rt: true });
def('C', 'ip nat inside source static <ip> <ip>', 'Inside static translation', function (a, rest, o, r) { natStatic(this, null, a[0], null, a[1], null, r); }, { rt: true });
def('C', 'ip nat inside source static <word> <ip> <port> <ip> <port>', 'Inside static translation', function (a, rest, o, r) {
  if (['tcp', 'udp'].indexOf(a[0].toLowerCase()) < 0) { o.l("% Invalid input detected at '^' marker."); return; } natStatic(this, a[0].toLowerCase(), a[1], a[2], a[3], a[4], r);
}, { rt: true });
function natStatic(s, proto, local, lport, glob, gport, r) {
  const nat = (s.d.nat = s.d.nat || { pools: {}, rules: [] });
  const k = nat.rules.findIndex(x => x.type === 'static' && x.local === local && x.proto === (proto || undefined) && x.lport === (lport || undefined));
  const rec = { type: 'static', local, global: glob }; if (proto) { rec.proto = proto; rec.lport = lport; rec.gport = gport; }
  if (k >= 0) nat.rules[k] = rec; else nat.rules.push(rec); s.mut(r, 'nat');
}
def('C', 'no ip nat inside source static <ip> <ip>', 'Inside static translation', function (a, rest, o, r) { natDel(this, x => x.type === 'static' && !x.proto && x.local === a[0] && x.global === a[1], o, r); }, { rt: true });
def('C', 'no ip nat inside source static <word> <ip> <port> <ip> <port>', 'Inside static translation', function (a, rest, o, r) { natDel(this, x => x.type === 'static' && x.proto === a[0].toLowerCase() && x.local === a[1] && x.lport === a[2], o, r); }, { rt: true });
def('C', 'no ip nat inside source list <word> interface <if> overload', 'Interface for global address', function (a, rest, o, r) { natDel(this, x => x.type === 'dynamic' && x.acl === String(a[0]) && x.iface === a[1], o, r); }, { rt: true });
def('C', 'no ip nat inside source list <word> pool <word> *rest', 'Name pool of global addresses', function (a, rest, o, r) { natDel(this, x => x.type === 'dynamic' && x.acl === String(a[0]) && x.pool === a[1], o, r); }, { rt: true });
function natDel(s, pred, o, r) { const nat = s.d.nat; if (!nat) return; const n = nat.rules.length; nat.rules = nat.rules.filter(x => !pred(x)); if (nat.rules.length !== n) { s._natClear(); s.mut(r, 'nat'); } }
E.IosShell.prototype._natClear = function () { if (this.d._rt.nat) this.d._rt.nat = { tr: [] }; };
D('ip nat inside', 'Inside address translation'); D('ip nat inside source', 'Source address translation'); D('ip nat inside source static', 'Specify static local->global mapping'); D('ip nat inside source list', 'Specify access list describing local addresses');
D('ip nat pool', 'Define pool of addresses'); D('no ip nat', 'NAT configuration commands'); D('no ip nat inside', 'Inside address translation'); D('no ip nat inside source', 'Source address translation');

/* --- commandes globales valides sans effet simulé (mémorisées) --- */
const GLOBAL_EXTRA = [
  ['spanning-tree *rest', 'Spanning Tree Subsystem', 'sw'], ['logging *rest', 'Modify message logging facilities'], ['ntp *rest', 'Configure NTP'], ['service timestamps *rest', 'Timestamp debug/log messages'],
  ['cdp run', 'Enable CDP'], ['clock timezone *rest', 'Configure time zone'], ['snmp-server *rest', 'Modify SNMP engine parameters']
];
GLOBAL_EXTRA.forEach(([spec, desc, kind]) => {
  def('C', spec, desc, function (a, rest, o, r, line) { if (spec.indexOf('*rest') >= 0 && !rest.length) { o.l('% Incomplete command.'); return; } addExtra(this, 'global', line.trim().replace(/\s+/g, ' ')); this.mut(r, 'cfg'); }, kind === 'sw' ? { sw: true } : undefined);
  const neg = spec.indexOf('*rest') >= 0 ? 'no ' + spec : 'no ' + spec;
  def('C', neg, desc, function (a, rest, o, r, line) { delExtra(this, 'global', line.trim().replace(/\s+/g, ' ').replace(/^no /, '')); this.mut(r, 'cfg');
    /* D-111 : la commande est acceptée mais le simulateur n'en garde aucune trace (CDP non simulé) : avis de la couche jeu, jamais un refus (cela casserait le collage d'une configuration de TP) */
    if (spec === 'cdp run') o.l(U.av('ios-noeffect-cdp', 'Commande acceptée, sans effet dans le simulateur : « no cdp run » n’est pas prise en compte (« show cdp neighbors » continue d’afficher les voisins).'), 'w'); }, kind === 'sw' ? { sw: true } : undefined);
});
def('C', 'no cdp run', 'Enable CDP', function (a, rest, o, r) { addExtra(this, 'global', 'no cdp run'); delExtra(this, 'global', 'cdp run'); this.mut(r, 'cfg'); });

/* ------------------------------------------------------------------ sous-mode : repli sur les commandes globales (comme IOS) */
const dispatch0 = E.IosShell.prototype.dispatchLine;
E.IosShell.prototype.dispatchLine = function (toks, line, tk, res) {
  if (['I', 'L', 'V', 'A', 'D', 'R'].indexOf(this.mode) >= 0 && !/^do$/i.test(toks[0])) {
    const own = I.resolve(this, toks, this.mode);
    if (own.err) { const glob = I.resolve(this, toks, 'C'); if (!glob.err) { this.mode = 'C'; this.ctx = {}; } }
  }
  return dispatch0.call(this, toks, line, tk, res);
};

})(typeof globalThis !== 'undefined' ? globalThis : window);
