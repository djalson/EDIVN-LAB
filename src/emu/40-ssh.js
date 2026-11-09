/* ============================================================================
   Clients SSH / telnet des émulateurs : ssh (OpenSSH Linux et Windows), ssh -l / telnet (IOS).
   Négociation et authentification : engine/66-ssh.js (SSH.attempt). Ici : messages du client, invite de
   mot de passe, empreinte de clé d'hôte, ouverture de la session distante (Linux, IOS, pfSense).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, SSH = SIM.ssh, IOS = SIM.ios;
const E = SIM.emu; const L = E.L;

U.av('ssh-client-text', 'Messages du client OpenSSH (invite de clé d’hôte, « Permission denied », usage) : forme d’OpenSSH 9.x ; la liste exacte des méthodes d’authentification annoncées par IOS (« Permission denied (…) ») est à vérifier.');
U.av('ssh-ios-closed', 'Message du client lorsque l’IOS ferme la connexion à cause d’une access-class (« kex_exchange_identification… ») : forme OpenSSH ≥ 8.7, à vérifier.');
U.av('ssh-hostkey-fpr', 'Empreintes de clé d’hôte : valeurs synthétiques stables par équipement, ce ne sont pas de vraies empreintes.');

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fingerprint(devId, type) {
  let s = ''; for (let i = 0; s.length < 43; i++) { const h = U.hash8(devId + ':' + type + ':' + i); for (let k = 0; k < 8 && s.length < 43; k += 2) s += B64[parseInt(h.slice(k, k + 2), 16) % 64]; }
  return 'SHA256:' + s;
}
function keyTypeOf(dev) { return dev.kind === 'linux' ? 'ED25519' : 'RSA'; }

const USAGE = ['usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]', '           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]', '           [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file]', '           [-J destination] [-L address] [-l login_name] [-m mac_spec]', '           [-O ctl_cmd] [-o option] [-P tag] [-p port] [-R address]', '           [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]]', '           destination [command [argument ...]]'];

function parseSsh(a) {
  const o = { port: 22, user: null, host: null, cmd: [], opts: {}, quiet: false, identity: null };
  const withArg = 'bcDEeFIiJLlmOopPQRSWw';
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (o.host !== null) { o.cmd.push(t); continue; }
    if (t[0] === '-' && t.length > 1) {
      const f = t[1];
      if (withArg.indexOf(f) >= 0) {
        const v = t.length > 2 ? t.slice(2) : a[++i];
        if (v === undefined) { o.err = 'Option requires an argument -- ' + f; return o; }
        if (f === 'p') o.port = parseInt(v, 10); else if (f === 'l') o.user = v; else if (f === 'i') o.identity = v;
        else if (f === 'o') { const m = String(v).match(/^([^=\s]+)[=\s]+(.*)$/); if (m) o.opts[m[1].toLowerCase()] = m[2].toLowerCase(); }
      } else if (f === 'q') o.quiet = true;
      continue;
    }
    const m = t.match(/^(?:([^@]+)@)?(.+)$/); if (m) { if (m[1] && !o.user) o.user = m[1]; o.host = m[2]; }
  }
  return o;
}

/* Table des messages d'erreur de connexion (client OpenSSH). */
function connErr(flavor, host, p, port) {
  const ip = p.ip || host;
  switch (p.err) {
    case 'resolve': return 'ssh: Could not resolve hostname ' + host + ': ' + (flavor === 'win' ? 'No such host is known. ' : 'Name or service not known');
    case 'refused': return 'ssh: connect to host ' + ip + ' port ' + port + ': Connection refused';
    case 'noroute': return 'ssh: connect to host ' + ip + ' port ' + port + ': No route to host';
    case 'timeout': return 'ssh: connect to host ' + ip + ' port ' + port + ': Connection timed out';
    case 'kex': return 'Unable to negotiate with ' + ip + ' port ' + port + ': no matching key exchange method found. Their offer: ' + (p.offer || []).join(',');
  }
  return 'ssh: connect to host ' + ip + ' port ' + port + ': Connection refused';
}
function clientIpTo(s, ip) { const c = N.connect(s.W, s.devId, ip, 'tcp', 22); return (c && c.trace && c.trace.sipAtDst) || ''; }

/* ouvre la session distante une fois authentifié */
function openRemote(s, dev, user, host, cip, probe, cmd, flavor) {
  const env = s.env;
  env.obs('ssh:' + s.devId + ':' + probe.ip, true);
  env.act({ kind: 'cmd', dev: s.devId, text: 'ssh ' + user + '@' + host, mutates: false, shell: s.kind });
  let sh = null;
  if (dev.kind === 'linux') sh = E.openLxShell(env, dev.id, { user, remote: { ip: cip, target: host } });
  else if (dev.kind === 'ios-sw' || dev.kind === 'ios-rt') {
    const u = (dev.users || []).find(x => x.name === user);
    sh = E.openIos(env, dev.id, { via: 'vty', user, priv: u ? (u.priv === undefined ? 1 : u.priv) : (dev.lines && dev.lines.vty && dev.lines.vty.login === 'none' ? 1 : 1), from: cip });
    sh.closeMsg = 'Connection to ' + host + ' closed by remote host.';
  } else if (dev.kind === 'pf') {
    if (!E.openPfConsole) return { out: [L('Connection to ' + host + ' closed by remote host.')], status: 1 };
    sh = E.openPfConsole(env, dev.id, { user, remote: { ip: cip, target: host } });
  }
  if (!sh) return { out: [L('Connection to ' + host + ' closed by remote host.')], status: 1 };
  if (cmd && cmd.length) {
    /* commande distante : exécutée sans terminal interactif */
    const line = cmd.join(' '); const x = sh.exec(line); const out = x.out.slice();
    return { out, status: x.status !== undefined ? x.status : 0, mutated: x.mutated };
  }
  return { out: [], push: sh, status: 0 };
}

E.sshCommand = function (s, a, o, r, flavor) {
  const W = s.W; const opt = parseSsh(a);
  if (opt.err) { o.l('ssh: ' + opt.err, 'e'); USAGE.forEach(t => o.l(t)); return 255; }
  if (!opt.host) { USAGE.forEach(t => o.l(t)); return 255; }
  const host = opt.host; const port = opt.port || 22;
  const user = opt.user || (flavor === 'win' ? String(s.user || 'user').replace(/^.*\\/, '') : s.user);
  const probe = SSH.attempt(W, s.devId, host, user, {}, { port, dry: true });
  const fail = () => { s.env.obs('ssh:' + s.devId + ':' + (probe.ip || host), false); };
  if (!probe.ok && probe.stage !== 'auth') {
    s.env.advance(probe.err === 'timeout' ? (flavor === 'win' ? 21 : 127) : 1); o.l(connErr(flavor, host, probe, port)); fail(); return 255;
  }
  const dev = W.d(probe.dev); const cip = clientIpTo(s, probe.ip);
  if (probe.err === 'closed') {
    s.env.advance(1); o.l('kex_exchange_identification: Connection closed by remote host'); o.l('Connection closed by ' + probe.ip + ' port ' + port); fail(); return 255;
  }
  const known = (s.d._rt.knownHosts = s.d._rt.knownHosts || {});
  const showHost = host === probe.ip ? probe.ip : host + ' (' + probe.ip + ')';
  const kt = keyTypeOf(dev);
  const fpr = fingerprint(dev.id, kt);
  /* authentification : clé du poste, puis mot de passe (3 essais). Retourne un résultat {out, push?, ask?, status?, mutated?} */
  const doAuth = () => {
    const me = W.d(s.devId);
    if (me.sshPub && opt.opts.pubkeyauthentication !== 'no') {
      const k = SSH.attempt(W, s.devId, probe.ip, user, { key: me.sshPub }, { port, dry: false });
      if (k.ok) return openRemote(s, dev, user, host, cip, probe, opt.cmd, flavor);
    }
    if (probe.ok) return openRemote(s, dev, user, host, cip, probe, opt.cmd, flavor); /* ligne vty sans mot de passe */
    let tries = 0;
    const prompt = () => ({ prompt: user + '@' + host + '\'s password: ', echo: false, cb: line => {
      tries++;
      const att = SSH.attempt(W, s.devId, probe.ip, user, { pwd: line }, { port, dry: false });
      if (att.ok) return openRemote(s, dev, user, host, cip, probe, opt.cmd, flavor);
      if (att.reason === 'nologin') return { out: [L('This account is currently not available.'), L('Connection to ' + host + ' closed.')] };
      if (tries >= 3) { fail(); return { out: [L('Permission denied, please try again.'), L(user + '@' + host + ': Permission denied (' + (dev.kind === 'linux' ? 'publickey,password' : 'publickey,keyboard-interactive') + ').')] }; }
      return { out: [L('Permission denied, please try again.')], ask: prompt() };
    } });
    return { out: [], ask: prompt() };
  };
  const merge = (res) => { (res.out || []).forEach(l => o.lines.push(l)); if (res.push) r.push = res.push; if (res.ask) r.ask = res.ask; if (res.mutated) r.mutated = true; return res.status === undefined ? 0 : res.status; };
  const trust = () => { known[probe.ip] = fpr; return L('Warning: Permanently added \'' + probe.ip + '\' (' + kt + ') to the list of known hosts.', 'e'); };
  if (!known[probe.ip]) {
    const sk = opt.opts.stricthostkeychecking;
    if (sk === 'no' || sk === 'off' || sk === 'accept-new') { const w = trust(); if (!opt.quiet) o.lines.push(w); return merge(doAuth()); }
    const q = (txt) => ({ prompt: txt, echo: true, cb: line => {
      const v = line.trim().toLowerCase();
      if (v === 'yes' || v === fpr.toLowerCase()) { const w = trust(); const res = doAuth(); return Object.assign({}, res, { out: [w].concat(res.out || []) }); }
      if (v === 'no') { fail(); return { out: [L('Host key verification failed.', 'e')] }; }
      const t2 = 'Please type \'yes\', \'no\' or the fingerprint: ';
      return { out: [], ask: q(t2) };
    } });
    o.l('The authenticity of host \'' + showHost + '\' can\'t be established.');
    o.l(kt + ' key fingerprint is ' + fpr + '.');
    o.l('This key is not known by any other names.');
    r.ask = q('Are you sure you want to continue connecting (yes/no/[fingerprint])? ');
    return 0;
  }
  return merge(doAuth());
};

/* exports pour le client graphique PuTTY */
E.sshOpenRemote = openRemote; E.sshFp = fingerprint; E.sshKeyType = keyTypeOf; E.sshClientIpTo = clientIpTo;

/* ------------------------------------------------------------------ client IOS : ssh -l user host / telnet host */
E.remoteConnect = function (s, proto, host, user, o, r) {
  const W = s.W;
  const rr = U.isIP(host) ? { ok: true, ip: host } : N.resolve(W, s.devId, host, { noCache: true });
  if (!rr.ok) { o.l('Translating "' + host + '"...domain server (255.255.255.255)'); s.env.advance(6); o.l('% Unrecognized host or address, or protocol not running.'); o.l(''); return; }
  const port = proto === 'ssh' ? 22 : 23;
  o.l('Trying ' + rr.ip + ' ...');
  const c = N.connect(W, s.devId, rr.ip, 'tcp', port);
  if (c.state !== 'open') {
    if (c.state === 'refused') o.l('% Connection refused by remote host');
    else { s.env.advance(30); o.l('% Connection timed out; remote host not responding'); }
    o.l(''); s.env.obs((proto === 'ssh' ? 'ssh' : 'connect') + ':' + s.devId + ':' + rr.ip, false); return;
  }
  if (proto === 'telnet') o.lines[o.lines.length - 1].t += ' Open';
  const dev = W.d(c.dstDev); const cip = c.trace.sipAtDst;
  const closeMsg = '[Connection to ' + host + ' closed by foreign host]';
  const open = (usr) => {
    const res = (() => {
      s.env.obs((proto === 'ssh' ? 'ssh' : 'connect') + ':' + s.devId + ':' + rr.ip, true);
      let sh = null;
      if (dev.kind === 'linux') sh = E.openLxShell(s.env, dev.id, { user: usr, remote: { ip: cip, target: host } });
      else if (dev.kind === 'ios-sw' || dev.kind === 'ios-rt') { const u = (dev.users || []).find(x => x.name === usr); sh = E.openIos(s.env, dev.id, { via: 'vty', user: usr, priv: u ? (u.priv === undefined ? 1 : u.priv) : 1, from: cip }); sh.closeMsg = closeMsg; }
      else if (dev.kind === 'pf' && E.openPfConsole) sh = E.openPfConsole(s.env, dev.id, { user: usr, remote: { ip: cip, target: host } });
      return sh;
    })();
    return res;
  };
  if (proto === 'ssh') {
    const att0 = SSH.attempt(W, s.devId, rr.ip, user, {}, { dry: true });
    if (att0.err === 'closed' || att0.err === 'kex') { s.env.advance(1); o.l('% Connection closed by remote host'); o.l(''); return; }
    let tries = 0;
    const prompt = () => ({ prompt: 'Password: ', echo: false, cb: line => {
      tries++;
      const att = SSH.attempt(W, s.devId, rr.ip, user, { pwd: line }, { dry: false });
      if (att.ok) { const sh = open(user); return { out: [], push: sh }; }
      if (tries >= 3) return { out: [L('% Authentication failed.', 'e'), L('')] };
      return { out: [], ask: prompt() };
    } });
    if (att0.ok) { const sh = open(user); r.push = sh; return; }
    r.ask = prompt(); return;
  }
  /* telnet : seul un équipement IOS dont les lignes vty acceptent telnet répond ici (le port 23 est modélisé) */
  if (dev.kind !== 'ios-sw' && dev.kind !== 'ios-rt') { o.l('% Connection refused by remote host'); return; }
  const vty = (dev.lines && dev.lines.vty) || {};
  const banner = dev.banner ? ['', dev.banner, ''] : [];
  banner.forEach(t => o.l(t));
  o.l(''); o.l('User Access Verification'); o.l('');
  let tries = 0;
  const pwdAsk = (usr) => ({ prompt: 'Password: ', echo: false, cb: line => {
    tries++;
    let ok = false;
    if (vty.login === 'local') { const u = (dev.users || []).find(x => x.name === usr); ok = !!(u && u.pwd === line); }
    else ok = vty.password !== undefined && line === vty.password;
    if (ok) { const sh = open(usr || 'telnet'); return { out: [], push: sh }; }
    if (tries >= 3) return { out: [L('% Bad passwords'), L(closeMsg)] };
    return { out: [L('% Authentication failed'), L('')], ask: vty.login === 'local' ? userAsk() : pwdAsk(usr) };
  } });
  const userAsk = () => ({ prompt: 'Username: ', echo: true, cb: line => ({ out: [], ask: pwdAsk(line.trim()) }) });
  if (vty.login === 'none') { r.push = open('telnet'); return; }
  r.ask = vty.login === 'local' ? userAsk() : pwdAsk(null);
};

})(typeof globalThis !== 'undefined' ? globalThis : window);
