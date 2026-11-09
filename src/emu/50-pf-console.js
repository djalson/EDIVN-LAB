/* ============================================================================
   pfSense — console texte (menu numéroté de la console VM / SSH) et petit shell.
   Le pare-feu se gère surtout par l'interface web ; la console sert aux dépannages « hors GUI » :
   adresse d'interface, ping, activation de sshd, redémarrage de webConfigurator, redémarrage.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;
const E = SIM.emu; const L = E.L;
const PFC = E.pfc = {};

U.av('pf-console-menu', 'Texte et numérotation du menu de la console pfSense (options 0 à 16, libellés « Enable/Disable Secure Shell (sshd) ») : forme de pfSense 2.7.x, à vérifier selon la version installée.');
U.av('pf-console-ifaddr', 'Dialogue de l’option 2 « Set interface(s) IP address » (questions, messages de fin) : forme de pfSense 2.7.x reconstituée, à vérifier.');
U.av('pf-console-shell', 'Invite et commandes du shell (option 8) : invite « [2.7.2-RELEASE][admin@hôte]/root: » ; seul un petit sous-ensemble de commandes FreeBSD est simulé.');
U.av('pf-version', 'Version de pfSense affichée (2.7.2-RELEASE) : hypothèse du laboratoire, à aligner sur la VM réelle.');
const VERSION = '2.7.2-RELEASE';

function ifList(d) { return Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual); }
/* nom interne pfSense : wan, lan, puis opt1, opt2… dans l'ordre */
function internalName(d, k) { if (k === 'wan' || k === 'lan') return k; const others = ifList(d).filter(x => x !== 'wan' && x !== 'lan'); return 'opt' + (others.indexOf(k) + 1); }
function head(d) {
  const lines = ['', '*** Welcome to pfSense ' + VERSION + ' (amd64) on ' + (d.hostname || 'pfSense') + ' ***', ''];
  ifList(d).forEach(k => {
    const i = d.ifaces[k]; const nm = (i.name || k.toUpperCase());
    const ipTxt = i.ip ? (i.dhcp ? 'v4/DHCP4: ' : 'v4: ') + i.ip + '/' + U.mask2len(i.mask) : '';
    lines.push(' ' + E.padR(nm + ' (' + internalName(d, k) + ')', 15) + ' -> ' + E.padR(i.dev, 10) + ' -> ' + ipTxt);
  });
  lines.push('');
  const sshTxt = d.system && d.system.ssh && d.system.ssh.enabled ? 'Disable' : 'Enable';
  lines.push(' 0) Logout (SSH only)                  9) pfTop');
  lines.push(' 1) Assign Interfaces                 10) Filter Logs');
  lines.push(' 2) Set interface(s) IP address       11) Restart webConfigurator');
  lines.push(' 3) Reset webConfigurator password    12) PHP shell + pfSense tools');
  lines.push(' 4) Reset to factory defaults         13) Update from console');
  lines.push(' 5) Reboot system                     14) ' + sshTxt + ' Secure Shell (sshd)');
  lines.push(' 6) Halt system                       15) Restore recent configuration');
  lines.push(' 7) Ping host                         16) Restart PHP-FPM');
  lines.push(' 8) Shell');
  lines.push('');
  return lines;
}

function PfConsole(env, devId, opts) {
  E.Session.call(this, env, devId, opts);
  opts = opts || {}; this.kind = 'pf'; this.user = opts.user || 'admin'; this.remote = opts.remote || null; this.mode = 'menu';
}
PfConsole.prototype = Object.create(E.Session.prototype); PfConsole.prototype.constructor = PfConsole;
E.PfConsole = PfConsole;
E.openPfConsole = (env, devId, opts) => new PfConsole(env, devId, opts);

PfConsole.prototype.prompt = function () {
  if (this.ask) return this.ask.prompt;
  if (this.mode === 'shell') return '[' + VERSION + '][' + this.user + '@' + (this.d.hostname || 'pfSense') + (this.d.domain ? '.' + this.d.domain : '') + ']/root: ';
  return 'Enter an option: ';
};
PfConsole.prototype.banner = function () { return head(this.d).map(t => L(t)); };
const menuOut = s => head(s.d).map(t => L(t));

PfConsole.prototype.run = function (line) {
  if (this.mode === 'shell') return this.shell(line);
  const v = line.trim(); const d = this.d;
  if (v === '') return { out: menuOut(this) };
  const yn = (text, fn) => ({ out: [], ask: { prompt: text, echo: true, cb: l => /^y/i.test(l.trim()) ? fn() : { out: menuOut(this) } } });
  switch (v) {
    case '0': if (!this.remote) return { out: [L('Option 0 is only valid when connected over SSH.')] }; return { out: [], exit: true, pop: true };
    case '2': return this.setIp();
    case '3': return yn('Do you want to proceed [y|n]? ', () => { d.pwds = d.pwds || {}; d.pwds.admin = 'pfsense'; this.env.touch('pf-pwd'); return { out: [L(''), L('The password for user admin has been reset to the default value, "pfsense".'), L('')].concat(menuOut(this)), mutated: true, danger: 'password', impact: 'config' }; });
    case '4': return yn('The system will be reset to factory defaults and rebooted. Do you want to proceed [y|n]? ', () => { d._rt.factoryReset = true; this.env.touch('pf-factory'); return { out: [L('Resetting configuration to factory defaults...')], exit: true, pop: !!this.remote, mutated: true, danger: 'wipe', impact: 'wipe' }; });
    case '5': return yn('The system will reboot. Do you want to proceed [y|n]? ', () => { d._rt.bootAt = this.W.clock.elapsed; this.env.advance(120); this.env.touch('reboot'); return { out: [L('pfSense is rebooting now.')], exit: true, pop: !!this.remote, mutated: true, impact: 'reboot' }; });
    case '6': return yn('The system will halt and power off. Do you want to proceed [y|n]? ', () => { d.phys = d.phys || {}; d.phys.on = false; this.env.touch('power'); return { out: [L('pfSense is halting now.')], exit: true, pop: !!this.remote, mutated: true, impact: 'poweroff' }; });
    case '7': return { out: [], ask: { prompt: 'Enter a host name or IP address: ', echo: true, cb: l => { const o = new E.Out(); PFC.ping(this, l.trim(), o, 3); return { out: o.lines.concat([L('Press ENTER to continue.')]), ask: { prompt: '', echo: true, cb: () => ({ out: menuOut(this) }) } }; } } };
    case '8': this.mode = 'shell'; return { out: [] };
    case '11': return yn('Do you want to proceed [y|n]? ', () => { this.env.advance(8); this.env.touch('webgui'); return { out: [L('Restarting webConfigurator... done.'), L('')].concat(menuOut(this)), mutated: true }; });
    case '14': {
      const on = d.system && d.system.ssh && d.system.ssh.enabled;
      return yn((on ? 'SSHD is currently enabled.  Would you like to disable? (y/n) ' : 'SSHD is currently disabled.  Would you like to enable? (y/n) '), () => { d.system = d.system || {}; d.system.ssh = d.system.ssh || { port: 22 }; d.system.ssh.enabled = !on; this.env.touch('pf-sshd'); return { out: [L(''), L('Reloading configuration... done.'), L('')].concat(menuOut(this)), mutated: true, impact: on ? 'ssh-off' : 'config' }; });
    }
    case '1': case '9': case '10': case '12': case '13': case '15': case '16':
      return { out: [L('Cette option de la console n’est pas simulée dans ce jeu (utilise l’interface web, les options 2, 5, 7, 8, 11 ou 14).', 'e'), L('')].concat(menuOut(this)) };
    default: return { out: [L('')].concat(menuOut(this)) };
  }
};

/* option 2 : adresse d'une interface */
PfConsole.prototype.setIp = function () {
  const d = this.d; const keys = ifList(d); const W = this.W;
  const out = [L(''), L('Available interfaces:'), L('')];
  keys.forEach((k, i) => out.push(L((i + 1) + ' - ' + (d.ifaces[k].name || k.toUpperCase()) + ' (' + d.ifaces[k].dev + ' - ' + (d.ifaces[k].dhcp ? 'dhcp' : 'static') + ')')));
  out.push(L(''));
  const finish = (key, ip, bits, gw) => {
    const i = d.ifaces[key]; i.ip = ip; i.mask = U.len2mask(bits); i.dhcp = false;
    if (key === 'wan' && gw) { const g0 = (d.gateways || []).find(x => x.iface === 'wan' && !x.lanGw); if (g0) g0.ip = gw; }
    this.env.advance(15); this.env.touch('pf-ip');
    const nm = i.name || key.toUpperCase();
    return { out: [L(''), L('Please wait while the changes are saved to ' + nm + '...'), L(' Reloading filter...'), L(' Reloading routing configuration...'), L(' DHCPD...'), L(''), L('The IPv4 ' + nm + ' address has been set to ' + ip + '/' + bits), L('You can now access the webConfigurator by opening the following URL in your web browser:'), L('\t\thttps://' + ip + '/'), L(''), L('Press <ENTER> to continue.')], mutated: true, impact: 'config', ask: { prompt: '', echo: true, cb: () => ({ out: menuOut(this) }) } };
  };
  return { out, ask: { prompt: 'Enter the number of the interface you wish to configure: ', echo: true, cb: l => {
    const k = keys[parseInt(l.trim(), 10) - 1]; if (!k) return { out: menuOut(this) };
    const nm = d.ifaces[k].name || k.toUpperCase();
    return { out: [], ask: { prompt: 'Configure IPv4 address ' + nm + ' interface via DHCP? (y/n) ', echo: true, cb: l2 => {
      if (/^y/i.test(l2.trim())) { d.ifaces[k].dhcp = true; this.env.touch('pf-ip'); return { out: [L('The IPv4 ' + nm + ' address has been set to DHCP.')].concat(menuOut(this)), mutated: true, impact: 'config' }; }
      return { out: [L(''), L('Enter the new ' + nm + ' IPv4 address.  Press <ENTER> for none:')], ask: { prompt: '> ', echo: true, cb: l3 => {
        const ip = l3.trim(); if (!U.isIP(ip)) return { out: [L('Invalid IP address entered.')].concat(menuOut(this)) };
        return { out: [L(''), L('Subnet masks are entered as bit counts (as in CIDR notation) in pfSense.'), L('e.g. 255.255.255.0 = 24'), L('     255.255.0.0   = 16'), L('     255.0.0.0     = 8'), L(''), L('Enter the new ' + nm + ' IPv4 subnet bit count (1 to 32):')], ask: { prompt: '> ', echo: true, cb: l4 => {
          const bits = parseInt(l4.trim(), 10); if (!(bits >= 1 && bits <= 32)) return { out: [L('Invalid subnet bit count entered.')].concat(menuOut(this)) };
          const gwQ = [L(''), L('For a WAN, enter the new ' + nm + ' IPv4 upstream gateway address.'), L('For a LAN, press <ENTER> for none:')];
          return { out: gwQ, ask: { prompt: '> ', echo: true, cb: l5 => finish(k, ip, bits, l5.trim()) } };
        } } };
      } } };
    } } };
  } } };
};

/* ping (option 7 et shell) : sortie FreeBSD */
PFC.ping = function (s, target, o, count) {
  const W = s.W, d = s.d; let ip = target;
  if (!U.isIP(target)) { const r = N.resolve(W, s.devId, target, { noCache: true }); if (!r.ok) { o.l('ping: cannot resolve ' + target + ': Host name lookup failure'); return 68; } ip = r.ip; }
  o.l('PING ' + target + ' (' + ip + '): 56 data bytes');
  let ok = 0; const ms = [];
  for (let k = 0; k < count; k++) {
    const p = N.ping(W, s.devId, ip);
    if (p.ok) { ok++; const t = E.rttMs(p.trace, k) + (parseInt(U.hash8(ip + k).slice(0, 3), 16) % 900) / 1000; ms.push(t); o.l('64 bytes from ' + ip + ': icmp_seq=' + k + ' ttl=' + (64 - (p.trace.hops ? p.trace.hops.length - 1 : 0)) + ' time=' + t.toFixed(3) + ' ms'); }
    s.env.advance(p.ok ? 1 : 1);
  }
  s.env.obs('ping:' + s.devId + ':' + ip, ok > 0);
  o.l(''); o.l('--- ' + target + ' ping statistics ---'); o.l(count + ' packets transmitted, ' + ok + ' packets received, ' + ((count - ok) * 100 / count).toFixed(1) + '% packet loss');
  if (ok) { const mn = Math.min(...ms), mx = Math.max(...ms), av = ms.reduce((a, b) => a + b, 0) / ms.length; const sd = Math.sqrt(ms.reduce((a, b) => a + (b - av) * (b - av), 0) / ms.length); o.l('round-trip min/avg/max/stddev = ' + mn.toFixed(3) + '/' + av.toFixed(3) + '/' + mx.toFixed(3) + '/' + sd.toFixed(3) + ' ms'); }
  return ok ? 0 : 2;
};

/* shell FreeBSD (option 8) : sous-ensemble minimal, le reste répond « not found » comme sh */
PfConsole.prototype.shell = function (line) {
  const o = new E.Out(); const t = line.trim().split(/\s+/); const c = t[0];
  if (!c) return { out: [] };
  if (c === 'exit' || c === 'logout') { this.mode = 'menu'; return { out: menuOut(this) }; }
  if (c === 'hostname') o.l((this.d.hostname || 'pfSense') + (this.d.domain ? '.' + this.d.domain : ''));
  else if (c === 'whoami') o.l('root');
  else if (c === 'ping') { const args = t.slice(1).filter(x => x[0] !== '-'); const cn = t.indexOf('-c'); const n = cn > 0 ? Math.min(20, parseInt(t[cn + 1], 10) || 3) : 4; if (args.length && !(cn > 0 && args.length === 1 && args[0] === t[cn + 1])) PFC.ping(this, args[args.length - 1], o, n); }
  else o.l(c + ': not found');
  return { out: o.lines };
};

})(typeof globalThis !== 'undefined' ? globalThis : window);
