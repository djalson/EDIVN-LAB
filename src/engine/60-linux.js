/* ============================================================================
   Linux (Debian 13) — système de fichiers virtuel, droits POSIX + ACL, comptes,
   services systemd avec INSTANTANÉ d'exécution (la configuration modifiée n'agit
   qu'après reload/restart), analyseurs de configuration (sshd, apache2, nginx, bind9,
   mariadb, ufw), journal.
   La configuration est la vérité : les symptômes en découlent.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;
const LX = SIM.lx = {};

/* ------------------------------------------------------------------ VFS */
LX.norm = function (path, cwd) {
  if (!path) return cwd || '/';
  if (path[0] !== '/') path = (cwd || '/') + '/' + path;
  const out = [];
  for (const p of path.split('/')) { if (!p || p === '.') continue; if (p === '..') out.pop(); else out.push(p); }
  return '/' + out.join('/');
};
LX.dirname = p => { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); };
LX.basename = p => p.slice(p.lastIndexOf('/') + 1);
LX.node = (d, p) => d.fs[p] || null;
/* Résout les liens symboliques (profondeur max 8). Retourne le chemin final (qui peut ne pas exister). */
LX.resolve = function (d, p, depth) {
  depth = depth || 0; if (depth > 8) return p;
  const parts = p.split('/').filter(Boolean); let cur = '';
  for (let i = 0; i < parts.length; i++) {
    cur += '/' + parts[i];
    const n = d.fs[cur];
    if (n && n.t === 'l') {
      const tgt = n.target[0] === '/' ? n.target : LX.dirname(cur) + '/' + n.target;
      const rest = parts.slice(i + 1).join('/');
      return LX.resolve(d, LX.norm(tgt + (rest ? '/' + rest : '')), depth + 1);
    }
  }
  return cur || '/';
};
LX.exists = (d, p) => { const r = LX.resolve(d, LX.norm(p)); return r === '/' || !!d.fs[r]; };
LX.isDir = (d, p) => { const r = LX.resolve(d, LX.norm(p)); return r === '/' || (d.fs[r] && d.fs[r].t === 'd'); };
LX.readFile = function (d, p) { const r = LX.resolve(d, LX.norm(p)); const n = d.fs[r]; return n && n.t === 'f' ? n.c : null; };
LX.list = function (d, dir) {
  dir = LX.resolve(d, LX.norm(dir)); const pre = dir === '/' ? '/' : dir + '/'; const out = new Set();
  for (const k of Object.keys(d.fs)) if (k.indexOf(pre) === 0 && k !== dir) { const rest = k.slice(pre.length).split('/')[0]; if (rest) out.add(rest); }
  return [...out].sort();
};
LX.write = function (W, d, p, content, opts) {
  opts = opts || {}; p = LX.resolve(d, LX.norm(p));
  const n = d.fs[p];
  const now = W ? W.now().getTime() : 0;
  if (n && n.t === 'f') { n.c = content; n.mt = now; }
  else d.fs[p] = { t: 'f', c: content, m: opts.m || '0644', o: opts.o || 'root', g: opts.g || 'root', mt: now };
  if (W) W.touch('fs');
};
LX.mkdir = (W, d, p, o) => { p = LX.norm(p); if (!d.fs[p]) d.fs[p] = { t: 'd', m: (o && o.m) || '0755', o: (o && o.o) || 'root', g: (o && o.g) || 'root', mt: W ? W.now().getTime() : 0 }; };
LX.rm = (d, p) => { p = LX.norm(p); const pre = p + '/'; Object.keys(d.fs).forEach(k => { if (k === p || k.indexOf(pre) === 0) delete d.fs[k]; }); };

/* ------------------------------------------------------------------ comptes */
LX.passwd = d => (LX.readFile(d, '/etc/passwd') || '').split('\n').filter(l => l && l[0] !== '#').map(l => { const f = l.split(':'); return { name: f[0], uid: +f[2], gid: +f[3], gecos: f[4], home: f[5], shell: f[6] }; });
LX.groups = d => (LX.readFile(d, '/etc/group') || '').split('\n').filter(l => l && l[0] !== '#').map(l => { const f = l.split(':'); return { name: f[0], gid: +f[2], members: f[3] ? f[3].split(',') : [] }; });
LX.user = (d, name) => LX.passwd(d).find(u => u.name === name) || null;
LX.groupName = (d, gid) => { const g2 = LX.groups(d).find(x => x.gid === gid); return g2 ? g2.name : String(gid); };
LX.groupsOf = function (d, name) {
  const u = LX.user(d, name); if (!u) return [];
  const out = []; const prim = LX.groups(d).find(x => x.gid === u.gid); if (prim) out.push(prim.name);
  LX.groups(d).forEach(x => { if (x.members.indexOf(name) >= 0 && out.indexOf(x.name) < 0) out.push(x.name); });
  return out;
};

/* ------------------------------------------------------------------ droits POSIX + ACL */
const MODEBITS = { r: 4, w: 2, x: 1 };
LX.modeDigits = m => { const s = String(m).padStart(4, '0'); return [+s[1], +s[2], +s[3]]; };
LX.permOf = function (d, user, node) {
  if (user === 'root') return 7 | 8;                                  // bit 8 = root (x seulement si un x existe quelque part)
  const dg = LX.modeDigits(node.m); const groups = LX.groupsOf(d, user);
  const acl = node.acl;
  if (user === node.o) return dg[0];
  if (acl) {
    if (acl.users && acl.users[user] !== undefined) return LX.aclBits(acl.users[user]) & LX.aclBits(acl.mask || 'rwx');
    let gb = -1;
    if (groups.indexOf(node.g) >= 0) gb = (gb < 0 ? 0 : gb) | dg[1];
    for (const gname of Object.keys(acl.groups || {})) if (groups.indexOf(gname) >= 0) gb = (gb < 0 ? 0 : gb) | LX.aclBits(acl.groups[gname]);
    if (gb >= 0) return gb & LX.aclBits(acl.mask || 'rwx');
    return dg[2];
  }
  if (groups.indexOf(node.g) >= 0) return dg[1];
  return dg[2];
};
LX.aclBits = s => (s.indexOf('r') >= 0 ? 4 : 0) | (s.indexOf('w') >= 0 ? 2 : 0) | (s.indexOf('x') >= 0 ? 1 : 0);
/* Vérifie l'accès « mode » (r/w/x) de user sur path, avec traversée (x) de tous les maillons */
LX.access = function (d, user, path, mode) {
  path = LX.resolve(d, LX.norm(path)); const parts = path.split('/').filter(Boolean); let cur = '';
  const trav = [];
  for (let i = 0; i < parts.length; i++) {
    const parentNode = d.fs[cur || '/'] || { t: 'd', m: '0755', o: 'root', g: 'root' };
    const pb = LX.permOf(d, user, parentNode);
    const ok = user === 'root' || (pb & 1);
    trav.push({ path: cur || '/', node: parentNode, ok });
    if (!ok) return { ok: false, failAt: cur || '/', kind: 'search', trav };
    cur += '/' + parts[i];
    const n = d.fs[cur]; if (!n) return { ok: false, failAt: cur, kind: 'noent', trav };
    if (n.t === 'l') { const r = LX.resolve(d, cur); if (r !== cur) return LX.access(d, user, r, mode); }
  }
  const node = d.fs[path] || (path === '/' ? { t: 'd', m: '0755', o: 'root', g: 'root' } : null);
  if (!node) return { ok: false, failAt: path, kind: 'noent', trav };
  const b = LX.permOf(d, user, node);
  const need = MODEBITS[mode];
  if (user === 'root') { if (mode === 'x' && node.t === 'f' && !(LX.modeDigits(node.m).some(v => v & 1))) return { ok: false, failAt: path, kind: 'perm', trav }; return { ok: true, trav }; }
  if (!(b & need)) return { ok: false, failAt: path, kind: 'perm', trav };
  return { ok: true, trav };
};
LX.modeStr = function (n) {
  const t = n.t === 'd' ? 'd' : n.t === 'l' ? 'l' : '-'; const dg = LX.modeDigits(n.m); const sp = (v, i) => ((v & 4) ? 'r' : '-') + ((v & 2) ? 'w' : '-') + ((v & 1) ? 'x' : '-');
  let s = sp(dg[0]) + sp(n.acl ? LX.aclBits(n.acl.mask || 'rwx') & 7 : dg[1]) + sp(dg[2]);
  return t + s + (n.acl ? '+' : '');
};

/* ------------------------------------------------------------------ analyse de configuration générique */
LX.lines = text => (text || '').split('\n').map((raw, i) => ({ n: i + 1, raw, t: raw.replace(/#.*$/, '').trim() }));

/* ---- sshd ---- */
const SSHD_KEYWORDS = ['port', 'addressfamily', 'listenaddress', 'hostkey', 'permitrootlogin', 'passwordauthentication', 'pubkeyauthentication', 'allowusers', 'denyusers', 'allowgroups', 'kexalgorithms', 'ciphers', 'macs', 'hostkeyalgorithms', 'x11forwarding', 'printmotd', 'acceptenv', 'subsystem', 'usepam', 'authorizedkeysfile', 'maxauthtries', 'logingracetime', 'loglevel', 'strictmodes', 'permitemptypasswords', 'challengeresponseauthentication', 'kbdinteractiveauthentication', 'clientaliveinterval', 'clientalivecountmax', 'banner', 'include', 'syslogfacility', 'tcpkeepalive', 'permittunnel', 'gatewayports', 'allowtcpforwarding', 'maxsessions', 'maxstartups', 'usedns', 'match', 'pidfile', 'compression', 'ignorerhosts', 'hostbasedauthentication', 'pubkeyacceptedalgorithms'];
LX.parseSshd = function (d) {
  const text = LX.readFile(d, '/etc/ssh/sshd_config') || '';
  const cfg = { ports: [], listen: [], permitRoot: 'prohibit-password', passwordAuth: true, pubkeyAuth: true, allowUsers: null, kex: null, strict: true, errors: [], maxAuthTries: 6 };
  for (const L of LX.lines(text)) {
    if (!L.t) continue; const m = L.t.match(/^(\S+)\s+(.+)$/); const key = (m ? m[1] : L.t).toLowerCase(); const val = m ? m[2].trim() : '';
    if (SSHD_KEYWORDS.indexOf(key) < 0) { cfg.errors.push({ line: L.n, msg: U.av('sshd-bad-option', '/etc/ssh/sshd_config: line ' + L.n + ': Bad configuration option: ' + (m ? m[1] : L.t)) }); continue; }
    switch (key) {
      case 'port': { const p = parseInt(val, 10); if (!(p > 0 && p < 65536)) cfg.errors.push({ line: L.n, msg: U.av('sshd-bad-port', '/etc/ssh/sshd_config line ' + L.n + ': Badly formatted port number.') }); else cfg.ports.push(p); break; }
      case 'listenaddress': cfg.listen.push(val.replace(/:\d+$/, '')); break;
      case 'permitrootlogin': cfg.permitRoot = val.toLowerCase(); break;
      case 'passwordauthentication': cfg.passwordAuth = /^yes$/i.test(val); break;
      case 'pubkeyauthentication': cfg.pubkeyAuth = /^yes$/i.test(val); break;
      case 'allowusers': cfg.allowUsers = (cfg.allowUsers || []).concat(val.split(/\s+/)); break;
      case 'kexalgorithms': cfg.kex = val; break;
      case 'strictmodes': cfg.strict = /^yes$/i.test(val); break;
      case 'maxauthtries': cfg.maxAuthTries = parseInt(val, 10) || 6; break;
    }
  }
  if (!cfg.ports.length) cfg.ports.push(22);
  return cfg;
};
LX.SSHD_DEFAULT_KEX = ['sntrup761x25519-sha512', 'curve25519-sha256', 'ecdh-sha2-nistp256', 'diffie-hellman-group-exchange-sha256', 'diffie-hellman-group16-sha512', 'diffie-hellman-group18-sha512', 'diffie-hellman-group14-sha256'];

/* ---- apache2 ---- */
const APACHE_DIRS = ['listen', 'servername', 'serveralias', 'serveradmin', 'documentroot', 'errorlog', 'customlog', 'loglevel', 'include', 'includeoptional', 'sslengine', 'sslcertificatefile', 'sslcertificatekeyfile', 'directoryindex', 'options', 'allowoverride', 'require', 'servertokens', 'serversignature', 'redirect', 'alias', 'scriptalias', 'timeout', 'keepalive', 'user', 'group', 'serverroot', 'pidfile', 'mutex', 'loadmodule', 'accessfilename', 'hostnamelookups', 'errordocument', 'header', 'rewriteengine', 'rewriterule', 'rewritecond', 'addtype', 'addhandler', 'sslprotocol', 'sslciphersuite', 'ifmodule', 'maxkeepaliverequests', 'keepalivetimeout', 'defaulttype', 'logformat', 'phpvalue', 'fileetag', 'order', 'allow', 'deny'];
LX.parseApache = function (d) {
  const out = { listen: [], vhosts: [], mods: [], errors: [], warnings: [] };
  const modsDir = '/etc/apache2/mods-enabled';
  LX.list(d, modsDir).forEach(f => { if (/\.load$/.test(f)) out.mods.push(f.replace(/\.load$/, '')); });
  const files = [];
  if (LX.readFile(d, '/etc/apache2/ports.conf') !== null) files.push('/etc/apache2/ports.conf');
  LX.list(d, '/etc/apache2/conf-enabled').filter(f => /\.conf$/.test(f)).forEach(f => files.push('/etc/apache2/conf-enabled/' + f));
  LX.list(d, '/etc/apache2/sites-enabled').filter(f => /\.conf$/.test(f)).forEach(f => files.push('/etc/apache2/sites-enabled/' + f));
  for (const f of files) {
    const text = LX.readFile(d, f); if (text === null) { out.errors.push({ file: f, line: 0, msg: 'AH00526: ' + f + ' : fichier lien cassé' }); continue; }
    let cur = null; const stack = [];
    for (const L of LX.lines(text)) {
      if (!L.t) continue;
      let m;
      if ((m = L.t.match(/^<VirtualHost\s+(\S+)>$/i))) { const hp = m[1].split(':'); cur = { addr: hp[0], port: parseInt(hp[1], 10) || 80, serverName: '', aliases: [], docroot: '', ssl: false, certFile: '', keyFile: '', dirs: [], file: f, line: L.n, errorLog: '', customLog: '' }; stack.push('vh'); continue; }
      if (/^<\/VirtualHost>$/i.test(L.t)) { if (cur) out.vhosts.push(cur); cur = null; stack.pop(); continue; }
      if ((m = L.t.match(/^<Directory\s+"?([^">]+)"?>$/i))) { stack.push('dir'); if (cur) cur.dirs.push({ path: m[1], require: null, options: null }); continue; }
      if (/^<\/Directory>$/i.test(L.t)) { stack.pop(); continue; }
      if (/^<IfModule/i.test(L.t) || /^<Files/i.test(L.t) || /^<Location/i.test(L.t)) { stack.push('x'); continue; }
      if (/^<\/(IfModule|Files|Location)>$/i.test(L.t)) { stack.pop(); continue; }
      m = L.t.match(/^(\S+)\s*(.*)$/); const key = m[1].toLowerCase(); const val = m[2].trim();
      if (APACHE_DIRS.indexOf(key) < 0) { out.errors.push({ file: f, line: L.n, msg: "Invalid command '" + m[1] + "', perhaps misspelled or defined by a module not included in the server configuration" }); continue; }
      if (key === 'sslengine' && out.mods.indexOf('ssl') < 0 && !stack.some(s => s === 'x')) { out.errors.push({ file: f, line: L.n, msg: "Invalid command 'SSLEngine', perhaps misspelled or defined by a module not included in the server configuration" }); continue; }
      if ((key === 'sslcertificatefile' || key === 'sslcertificatekeyfile') && out.mods.indexOf('ssl') < 0 && !stack.some(s => s === 'x')) { out.errors.push({ file: f, line: L.n, msg: "Invalid command '" + m[1] + "', perhaps misspelled or defined by a module not included in the server configuration" }); continue; }
      if (key === 'listen') { const lp = parseInt(val.split(':').pop(), 10); if (!(lp > 0)) out.errors.push({ file: f, line: L.n, msg: 'Listen: invalid port' }); else if (out.listen.indexOf(lp) < 0) out.listen.push(lp); continue; }
      if (cur) {
        const dir = cur.dirs.length && stack[stack.length - 1] === 'dir' ? cur.dirs[cur.dirs.length - 1] : null;
        if (key === 'servername') cur.serverName = val; else if (key === 'serveralias') cur.aliases = cur.aliases.concat(val.split(/\s+/));
        else if (key === 'documentroot') cur.docroot = val.replace(/^"|"$/g, ''); else if (key === 'sslengine') cur.ssl = /^on$/i.test(val);
        else if (key === 'sslcertificatefile') cur.certFile = val; else if (key === 'sslcertificatekeyfile') cur.keyFile = val;
        else if (key === 'require' && dir) dir.require = val; else if (key === 'errorlog') cur.errorLog = val.replace(/\$\{APACHE_LOG_DIR\}/, '/var/log/apache2'); else if (key === 'customlog') cur.customLog = val;
      }
    }
    if (cur) out.errors.push({ file: f, line: cur.line, msg: U.av('apache-vh-notclosed', '<VirtualHost ' + cur.addr + ':' + cur.port + '> was not closed.') });
  }
  out.vhosts.forEach(v => { if (out.listen.indexOf(v.port) < 0 && false) out.warnings.push('[core:warn] NameVirtualHost'); });
  return out;
};
LX.apacheCheck = function (d) {
  const c = LX.parseApache(d);
  if (c.errors.length) { const e = c.errors[0]; return { ok: false, lines: ['AH00526: Syntax error on line ' + e.line + ' of ' + e.file + ':', e.msg, "Action 'configtest' failed."], cfg: c }; }
  const w = [];
  for (const v of c.vhosts) if (v.docroot && !LX.exists(d, v.docroot)) w.push('AH00112: Warning: DocumentRoot [' + v.docroot + '] does not exist');
  for (const v of c.vhosts) if (v.ssl && (!v.certFile || !LX.exists(d, v.certFile))) { return { ok: false, lines: ['AH00526: Syntax error on line ' + v.line + ' of ' + v.file + ':', 'SSLCertificateFile: file \'' + (v.certFile || '') + '\' does not exist or is empty', "Action 'configtest' failed."], cfg: c }; }
  return { ok: true, lines: w.concat(['Syntax OK']), cfg: c };
};

/* ---- nginx ---- */
LX.parseNginx = function (d) {
  const out = { servers: [], errors: [], tokens: true };
  const files = ['/etc/nginx/nginx.conf'];
  LX.list(d, '/etc/nginx/sites-enabled').forEach(f => files.push('/etc/nginx/sites-enabled/' + f));
  LX.list(d, '/etc/nginx/conf.d').filter(f => /\.conf$/.test(f)).forEach(f => files.push('/etc/nginx/conf.d/' + f));
  for (const f of files) {
    const text = LX.readFile(d, f); if (text === null) continue;
    let depth = 0, srv = null; let ln = 0;
    for (const L of LX.lines(text)) {
      ln = L.n; if (!L.t) continue;
      const t = L.t;
      if (/^server\s*\{$/.test(t)) { depth++; srv = { listen: [], names: [], root: '', ret: null, ssl: false, cert: '', key: '', file: f, line: L.n, tokensOff: false, loc: [], defaultFor: [], d0: depth }; continue; }
      if (/\{$/.test(t) && !/^server/.test(t)) { depth++; if (srv && /^location/.test(t)) srv.loc.push({ path: t.replace(/^location\s+/, '').replace(/\s*\{$/, ''), ret: null }); continue; }
      if (t === '}') { depth--; if (srv && depth === srv.d0 - 1) { out.servers.push(srv); srv = null; } continue; }
      if (t.slice(-1) !== ';') { out.errors.push({ file: f, line: L.n, msg: 'nginx: [emerg] directive "' + t.split(/\s+/)[0] + '" is not terminated by ";" in ' + f + ':' + L.n }); continue; }
      const parts = t.slice(0, -1).trim().split(/\s+/); const key = parts[0];
      if (key === 'server_tokens') { if (parts[1] === 'off') out.tokens = false; }
      if (key === 'server_name' && parts.length < 2) { out.errors.push({ file: f, line: L.n, msg: 'nginx: [emerg] invalid number of arguments in "server_name" directive in ' + f + ':' + L.n }); continue; }
      if (!srv) continue;
      if (key === 'listen') { const spec = parts[1]; const port = parseInt(spec.split(':').pop(), 10) || 80; srv.listen.push({ port, ssl: parts.indexOf('ssl') > 0, def: parts.indexOf('default_server') > 0, addr: spec.indexOf(':') > 0 ? spec.split(':')[0] : '*' }); if (parts.indexOf('ssl') > 0) srv.ssl = true; }
      else if (key === 'server_name') srv.names = parts.slice(1);
      else if (key === 'root') srv.root = parts[1];
      else if (key === 'return') { if (srv.loc.length) srv.loc[srv.loc.length - 1].ret = parts.slice(1).join(' '); else srv.ret = parts.slice(1).join(' '); }
      else if (key === 'ssl_certificate') srv.cert = parts[1]; else if (key === 'ssl_certificate_key') srv.key = parts[1];
      else if (key === 'ssl_reject_handshake') srv.rejectTls = parts[1] === 'on';
    }
    if (depth !== 0) out.errors.push({ file: f, line: ln, msg: depth > 0 ? 'nginx: [emerg] unexpected end of file, expecting "}" in ' + f + ':' + ln : 'nginx: [emerg] unexpected "}" in ' + f + ':' + ln });
  }
  return out;
};
LX.nginxCheck = function (d) {
  const c = LX.parseNginx(d);
  if (c.errors.length) return { ok: false, lines: [c.errors[0].msg, 'nginx: configuration file /etc/nginx/nginx.conf test failed'], cfg: c };
  for (const s of c.servers) if (s.ssl && s.cert && !LX.exists(d, s.cert)) return { ok: false, lines: ['nginx: [emerg] cannot load certificate "' + s.cert + '": BIO_new_file() failed (SSL: error:80000002:system library::No such file or directory:calling fopen(' + s.cert + ', r) error:10000080:BIO routines::no such file)', 'nginx: configuration file /etc/nginx/nginx.conf test failed'], cfg: c };
  return { ok: true, lines: ['nginx: the configuration file /etc/nginx/nginx.conf syntax is ok', 'nginx: configuration file /etc/nginx/nginx.conf test is successful'], cfg: c };
};

/* ---- bind9 ---- */
LX.parseBindOptions = function (d) {
  const t = (LX.readFile(d, '/etc/bind/named.conf.options') || '').replace(/\/\/.*$/gm, '').replace(/#.*$/gm, '');
  const grab = (key) => { const m = t.match(new RegExp(key + '\\s*\\{([^}]*)\\}\\s*;', 'i')); return m ? m[1].split(';').map(s => s.trim()).filter(Boolean) : null; };
  const o = { listenOn: grab('listen-on'), allowQuery: grab('allow-query'), allowRecursion: grab('allow-recursion'), forwarders: grab('forwarders') || [], recursion: !/recursion\s+no\s*;/i.test(t), version: (t.match(/version\s+"?([^";]+)"?\s*;/i) || [])[1] || null, hostnameHidden: /hostname\s+none/i.test(t) };
  const open = (t.match(/\{/g) || []).length, close = (t.match(/\}/g) || []).length;
  o.syntaxErr = open !== close;
  return o;
};
LX.parseBindLocal = function (d) {
  const out = { zones: [], errors: [] };
  const text = LX.readFile(d, '/etc/bind/named.conf.local') || '';
  const clean = text.replace(/\/\/.*$/gm, '');
  const re = /zone\s+"([^"]+)"\s*(?:IN\s*)?\{([^}]*)\}\s*;?/g; let m;
  const open = (clean.match(/\{/g) || []).length, close = (clean.match(/\}/g) || []).length;
  if (open !== close) out.errors.push(U.av('named-conf-brace', '/etc/bind/named.conf.local: syntax error'));
  while ((m = re.exec(clean))) {
    const body = m[2];
    if (!/;\s*$/.test(body.trim()) && body.trim()) { out.errors.push(U.av('named-conf-semicolon', "/etc/bind/named.conf.local: missing ';' before '}'")); }
    out.zones.push({ name: m[1], type: ((body.match(/type\s+(\w+)/) || [])[1]) || 'master', file: ((body.match(/file\s+"([^"]+)"/) || [])[1]) || '' });
  }
  return out;
};
/* Analyse d'un fichier de zone avec la sémantique du « . » final */
LX.parseZone = function (d, zoneName, file) {
  const text = LX.readFile(d, file);
  if (text === null) return { ok: false, err: U.av('named-zone-nofile', 'zone ' + zoneName + '/IN: loading from master file ' + file + ' failed: file not found'), records: [] };
  let origin = zoneName.replace(/\.?$/, '.'); let ttl = 86400; const recs = []; let soa = null; let lastName = '@'; let n = 0;
  const abs = (nm) => nm === '@' ? origin : (nm.slice(-1) === '.' ? nm : nm + '.' + origin);
  const toks = [];
  let inParen = false; let acc = null;
  for (const raw of text.split('\n')) {
    n++; const line = raw.replace(/;.*$/, '');
    if (!line.trim()) continue;
    let l2 = line;
    if (inParen) { acc.text += ' ' + l2.replace(/[()]/g, ' '); if (l2.indexOf(')') >= 0) { inParen = false; toks.push(acc); } continue; }
    if (l2.indexOf('(') >= 0 && l2.indexOf(')') < 0) { inParen = true; acc = { n, text: l2.replace('(', ' '), lead: /^\s/.test(raw) }; continue; }
    toks.push({ n, text: l2.replace(/[()]/g, ' '), lead: /^\s/.test(raw) });
  }
  for (const tk of toks) {
    const t = tk.text.trim().split(/\s+/);
    if (t[0] === '$TTL') { ttl = parseInt(t[1], 10) || ttl; continue; }
    if (t[0] === '$ORIGIN') { origin = t[1]; continue; }
    let name = tk.lead ? lastName : t.shift(); if (!tk.lead) lastName = name; else t.shift && 0;
    let rest = tk.lead ? tk.text.trim().split(/\s+/) : t;
    // retirer TTL / classe
    while (rest.length && (/^\d+[smhdw]?$/i.test(rest[0]) || rest[0].toUpperCase() === 'IN')) rest.shift();
    const type = (rest.shift() || '').toUpperCase(); const data = rest;
    if (!['SOA', 'NS', 'A', 'AAAA', 'CNAME', 'MX', 'PTR', 'TXT', 'SRV'].includes(type)) return { ok: false, err: U.av('named-zone-syntax', 'dns_rdata_fromtext: ' + file + ':' + tk.n + ": near '" + (type || tk.text.trim()) + "': syntax error"), records: [] };
    const full = abs(name);
    if (type === 'SOA') { if (data.length < 7) return { ok: false, err: U.av('named-zone-soa', 'dns_rdata_fromtext: ' + file + ':' + tk.n + ": near '" + data.join(' ') + "': unexpected end of input"), records: [] }; soa = { mname: abs(data[0]), rname: abs(data[1]), serial: parseInt(data[2], 10), refresh: data[3], retry: data[4], expire: data[5], minimum: data[6] }; recs.push({ name: full, type, ttl, data: data.join(' '), soa }); continue; }
    if (type === 'A' && !U.isIP(data[0])) return { ok: false, err: U.av('named-zone-badip', 'dns_rdata_fromtext: ' + file + ':' + tk.n + ": near '" + data[0] + "': bad dotted quad"), records: [] };
    let val = data.join(' ');
    if (type === 'CNAME' || type === 'NS' || type === 'PTR') val = abs(data[0]);
    if (type === 'MX') val = data[0] + ' ' + abs(data[1]);
    recs.push({ name: full, type, ttl, data: val });
  }
  if (!soa) return { ok: false, err: U.av('named-zone-nosoa', 'zone ' + zoneName + '/IN: has no SOA record'), records: [] };
  // NS doit avoir un enregistrement A dans la zone si il est dans la zone
  for (const r of recs.filter(x => x.type === 'NS')) {
    const inZone = r.data.endsWith(origin);
    if (inZone && !recs.some(x => (x.type === 'A' || x.type === 'AAAA') && x.name === r.data)) return { ok: false, err: U.av('named-zone-nsnoa', "zone " + zoneName + "/IN: NS '" + r.data.replace(/\.$/, '') + "' has no address records (A or AAAA)"), records: [] };
  }
  return { ok: true, serial: soa.serial, records: recs, origin };
};
LX.bindSnapshot = function (d) {
  const opt = LX.parseBindOptions(d); const loc = LX.parseBindLocal(d);
  const zones = loc.zones.map(z => { const p = LX.parseZone(d, z.name, z.file); return { name: z.name.toLowerCase(), file: z.file, ok: p.ok, err: p.err, serial: p.serial, records: p.records || [], type: z.type }; });
  return { opt, zones, errors: loc.errors, loadedAt: null };
};
LX.bindCheckConf = function (d) {
  const snap = LX.bindSnapshot(d);
  if (snap.opt.syntaxErr) return { ok: false, lines: [U.av('named-opt-syntax', '/etc/bind/named.conf.options:1: unexpected end of input')] };
  if (snap.errors.length) return { ok: false, lines: [snap.errors[0]] };
  return { ok: true, lines: [], snap };
};

/* ---- mariadb ---- */
LX.parseMariadb = function (d) {
  let bind = '127.0.0.1', port = 3306;
  const files = LX.list(d, '/etc/mysql/mariadb.conf.d').map(f => '/etc/mysql/mariadb.conf.d/' + f);
  for (const f of files) for (const L of LX.lines(LX.readFile(d, f))) {
    let m; if ((m = L.t.match(/^bind-address\s*=\s*(\S+)/))) bind = m[1]; if ((m = L.t.match(/^port\s*=\s*(\d+)/))) port = +m[1];
  }
  return { bind, port };
};

/* ---- ufw ---- */
LX.ufwAllows = function (d, proto, port, sip) {
  const u = d.ufw; if (!u || !u.enabled) return true;
  for (const r of u.rules) {
    if (r.to) { const m = r.to.match(/^(\d+)(?::(\d+))?(?:\/(tcp|udp))?$/); if (!m) continue; const lo = +m[1], hi = m[2] ? +m[2] : lo; if (!(port >= lo && port <= hi)) continue; if (m[3] && m[3] !== proto) continue; }
    if (r.from && r.from !== 'Anywhere' && !(r.from.indexOf('/') > 0 ? U.inCidr(sip, r.from) : r.from === sip)) continue;
    return r.action === 'ALLOW';
  }
  return (u.defaultIn || 'deny') === 'allow';
};

/* ------------------------------------------------------------------ services systemd */
/* Définition des services : unit, description, conf → snapshot, validate, ports d'écoute */
LX.SERVICES = {
  ssh: { unit: 'ssh.service', desc: 'OpenBSD Secure Shell server', proc: 'sshd', exec: '/usr/sbin/sshd -D',
    snap: d => LX.parseSshd(d), check: d => { const c = LX.parseSshd(d); return c.errors.length ? { ok: false, lines: c.errors.map(e => e.msg).concat([U.av('sshd-terminating', '/etc/ssh/sshd_config: terminating, ' + c.errors.length + ' bad configuration options')]) } : { ok: true, lines: [] }; },
    listen: (s, d) => s.ports.map(p => ({ proto: 'tcp', port: p, addr: s.listen[0] || '0.0.0.0' })) },
  apache2: { unit: 'apache2.service', desc: 'The Apache HTTP Server', proc: 'apache2', exec: '/usr/sbin/apachectl start',
    snap: d => { const c = LX.parseApache(d); return c; }, check: d => LX.apacheCheck(d),
    listen: (s) => s.listen.map(p => ({ proto: 'tcp', port: p, addr: '0.0.0.0' })) },
  nginx: { unit: 'nginx.service', desc: 'A high performance web server and a reverse proxy server', proc: 'nginx', exec: '/usr/sbin/nginx -g \'daemon on; master_process on;\'',
    snap: d => LX.parseNginx(d), check: d => LX.nginxCheck(d),
    listen: (s) => { const o = []; s.servers.forEach(v => v.listen.forEach(l => { if (!o.some(x => x.port === l.port)) o.push({ proto: 'tcp', port: l.port, addr: l.addr === '*' ? '0.0.0.0' : l.addr }); })); return o; } },
  bind9: { unit: 'named.service', alias: 'named', desc: 'BIND Domain Name Server', proc: 'named', exec: '/usr/sbin/named -f -u bind',
    snap: d => LX.bindSnapshot(d), check: d => LX.bindCheckConf(d),
    listen: (s) => { const addrs = s.opt.listenOn ? s.opt.listenOn : null; const p = 53; return [{ proto: 'tcp', port: p, addr: '0.0.0.0', listenOn: addrs }, { proto: 'udp', port: p, addr: '0.0.0.0', listenOn: addrs }]; } },
  mariadb: { unit: 'mariadb.service', desc: 'MariaDB 11.8 database server', proc: 'mariadbd', exec: '/usr/sbin/mariadbd',
    snap: d => LX.parseMariadb(d), check: d => {
      // « df » plein sur /var : MariaDB ne démarre pas (écriture impossible)
      if (d.disk && d.disk.var && d.disk.var.usePct >= 100) return { ok: false, lines: [U.av('mariadb-nospace', '[ERROR] mariadbd: Disk is full writing \'./ib_logfile0\' (Errcode: 28 "No space left on device")')] };
      return { ok: true, lines: [] };
    },
    listen: (s) => [{ proto: 'tcp', port: s.port, addr: s.bind === '0.0.0.0' || s.bind === '*' ? '0.0.0.0' : s.bind }] },
  'zabbix-agent': { unit: 'zabbix-agent.service', desc: 'Zabbix Agent', proc: 'zabbix_agentd', exec: '/usr/sbin/zabbix_agentd', snap: d => ({ conf: LX.readFile(d, '/etc/zabbix/zabbix_agentd.conf') || '' }), check: () => ({ ok: true, lines: [] }), listen: () => [{ proto: 'tcp', port: 10050, addr: '0.0.0.0' }] },
  cron: { unit: 'cron.service', desc: 'Regular background program processing daemon', proc: 'cron', exec: '/usr/sbin/cron -f', snap: () => ({}), check: () => ({ ok: true, lines: [] }), listen: () => [] },
  docker: { unit: 'docker.service', desc: 'Docker Application Container Engine', proc: 'dockerd', exec: '/usr/bin/dockerd', snap: () => ({}), check: () => ({ ok: true, lines: [] }), listen: () => [] }
};
LX.svcKey = (d, name) => { name = name.replace(/\.service$/, ''); if (d.svc[name]) return name; return Object.keys(d.svc).find(k => (LX.SERVICES[k] || {}).alias === name) || null; };
LX.svcRun = (d, k) => { d._rt.svcRun = d._rt.svcRun || {}; return d._rt.svcRun[k] || null; };
LX.jlog = (W, d, unit, proc, msg, prio, ageSec) => W.log(d.id, 'journal', { unit, proc, msg, prio: prio || 6, pid: (LX.svcRun(d, LX.svcKey(d, unit) || unit) || {}).pid }, ageSec || 0);
LX.nextPid = d => { d._rt.pidc = (d._rt.pidc || 800) + 1 + Math.floor((d._rt.pidc || 0) % 7); return d._rt.pidc; };

LX.startService = function (W, d, k, opts) {
  opts = opts || {}; const def = LX.SERVICES[k]; const s = d.svc[k];
  const ck = def.check(d);
  if (!ck.ok) {
    s.state = 'failed'; d._rt.svcRun = d._rt.svcRun || {}; delete d._rt.svcRun[k];
    ck.lines.forEach(l => LX.jlog(W, d, def.unit, def.proc, l, 3));
    LX.jlog(W, d, def.unit, 'systemd', def.unit.replace('.service', '') === 'apache2' ? 'apache2.service: Control process exited, code=exited, status=1/FAILURE' : def.unit + ': Main process exited, code=exited, status=1/FAILURE', 3);
    LX.jlog(W, d, def.unit, 'systemd', 'Failed to start ' + def.unit + ' - ' + def.desc + '.', 3);
    W.touch('svc'); return { ok: false, lines: ck.lines };
  }
  d._rt.svcRun = d._rt.svcRun || {};
  d._rt.svcRun[k] = { pid: LX.nextPid(d), since: W.now().getTime(), snap: U.clone(def.snap(d)) };
  s.state = 'active'; s.sub = 'running';
  LX.jlog(W, d, def.unit, 'systemd', 'Started ' + def.unit + ' - ' + def.desc + '.', 6);
  if (k === 'ssh') LX.jlog(W, d, def.unit, 'sshd', 'Server listening on 0.0.0.0 port ' + d._rt.svcRun[k].snap.ports[0] + '.', 6);
  if (k === 'bind9') { const sn = d._rt.svcRun[k].snap; sn.zones.forEach(z => { if (z.ok) LX.jlog(W, d, def.unit, 'named', 'zone ' + z.name + '/IN: loaded serial ' + z.serial, 6); else LX.jlog(W, d, def.unit, 'named', U.av('named-zone-notloaded', z.err + ' — zone ' + z.name + '/IN: not loaded due to errors.'), 3); }); }
  W.touch('svc'); return { ok: true, lines: [] };
};
LX.stopService = function (W, d, k) {
  const def = LX.SERVICES[k]; const s = d.svc[k]; if (d._rt.svcRun) delete d._rt.svcRun[k];
  s.state = 'inactive'; s.sub = 'dead';
  LX.jlog(W, d, def.unit, 'systemd', 'Stopped ' + def.unit + ' - ' + def.desc + '.', 6); W.touch('svc'); return { ok: true };
};
LX.reloadService = function (W, d, k) {
  const def = LX.SERVICES[k]; const run = LX.svcRun(d, k);
  if (!run) return { ok: false, notRunning: true };
  const ck = def.check(d);
  if (!ck.ok) { ck.lines.forEach(l => LX.jlog(W, d, def.unit, def.proc, l, 3)); return { ok: false, lines: ck.lines }; }
  run.snap = U.clone(def.snap(d)); LX.jlog(W, d, def.unit, 'systemd', 'Reloaded ' + def.unit + ' - ' + def.desc + '.', 6);
  if (k === 'bind9') run.snap.zones.forEach(z => { if (z.ok) LX.jlog(W, d, def.unit, 'named', 'zone ' + z.name + '/IN: loaded serial ' + z.serial, 6); else LX.jlog(W, d, def.unit, 'named', U.av('named-zone-notloaded2', z.err + ' — zone ' + z.name + '/IN: not loaded due to errors.'), 3); });
  W.touch('svc'); return { ok: true };
};
/* Démarrage de tous les services activés (amorçage du monde sain) */
LX.boot = function (W, d) {
  for (const k of Object.keys(d.svc)) { const s = d.svc[k]; if (s.enabled && !s.masked) LX.startService(W, d, k, { boot: true }); else { s.state = 'inactive'; s.sub = 'dead'; } }
};

/* ------------------------------------------------------------------ écoute : dérivée des instantanés d'exécution */
LX.listeners = function (W, d) {
  const out = [];
  for (const k of Object.keys(d.svc)) {
    const run = LX.svcRun(d, k); if (!run || d.svc[k].state !== 'active') continue;
    const def = LX.SERVICES[k]; (def.listen(run.snap, d) || []).forEach(l => out.push(Object.assign({ svc: k, proc: def.proc, pid: run.pid }, l)));
  }
  if (d.docker && d.svc.docker && d.svc.docker.state === 'active') for (const c of d.docker.containers || []) if (c.state === 'running') (c.ports || []).forEach(p => out.push({ svc: 'docker', proc: 'docker-proxy', pid: 3000, proto: 'tcp', port: p.host, addr: '0.0.0.0' }));
  return out;
};
LX.isListening = function (W, d, proto, port, ifn, st) {
  const dip = st && st.dip;
  for (const l of LX.listeners(W, d)) {
    if (l.proto !== proto || l.port !== port) continue;
    if (l.listenOn) { if (l.listenOn.indexOf('any') >= 0 || l.listenOn.indexOf(dip) >= 0 || (dip && l.listenOn.some(x => x.indexOf('/') > 0 && U.inCidr(dip, x)))) return true; continue; }
    if (l.addr === '0.0.0.0' || l.addr === dip) return true;
    if (l.addr === '127.0.0.1' && dip === '127.0.0.1') return true;
  }
  return false;
};

/* ------------------------------------------------------------------ DNS (bind9) */
LX.dnsAnswer = function (W, d, ifn, q) {
  const k = 'bind9'; const run = LX.svcRun(d, k); if (!run || d.svc[k].state !== 'active') return { rcode: 'SERVFAIL', answers: [] };
  const snap = run.snap; const name = q.name.toLowerCase().replace(/\.$/, '');
  // allow-query : liste d'ACL (CIDR / any / localhost / localnets)
  const aq = snap.opt.allowQuery;
  if (aq && !aq.some(x => x === 'any' || (x === 'localhost' && (q.from === '127.0.0.1')) || (x === 'localnets' && N.l3up(W, d).some(l => U.inNet(q.from, l.ip, l.mask))) || (x.indexOf('/') > 0 && U.inCidr(q.from, x)) || x === q.from)) return { rcode: 'REFUSED', answers: [] };
  let zone = null;
  for (const z of snap.zones) if (name === z.name || name.endsWith('.' + z.name)) { if (!zone || z.name.length > zone.name.length) zone = z; }
  if (zone) {
    if (!zone.ok) return { rcode: 'SERVFAIL', answers: [] };
    const fq = name + '.';
    const direct = zone.records.filter(r => r.name.toLowerCase() === fq && r.type === q.type);
    if (direct.length) return { rcode: 'NOERROR', answers: direct.map(r => ({ name, type: r.type, data: r.type === 'A' ? r.data : r.data.replace(/\.$/, ''), ttl: r.ttl })), authoritative: true };
    const cn = zone.records.find(r => r.name.toLowerCase() === fq && r.type === 'CNAME');
    if (cn && q.type !== 'CNAME') {
      const t2 = cn.data.replace(/\.$/, '');
      const sub = LX.dnsAnswer(W, d, ifn, { name: t2, type: q.type, from: q.from });
      return { rcode: sub.rcode, answers: [{ name, type: 'CNAME', data: t2, ttl: cn.ttl }].concat(sub.answers || []), authoritative: true };
    }
    if (zone.records.some(r => r.name.toLowerCase() === fq)) return { rcode: 'NOERROR', answers: [], authoritative: true };
    return { rcode: 'NXDOMAIN', answers: [], authoritative: true };
  }
  // récursion
  const ar = snap.opt.allowRecursion || snap.opt.allowQuery;
  if (!snap.opt.recursion) return { rcode: 'REFUSED', answers: [] };
  if (ar && !ar.some(x => x === 'any' || (x === 'localnets' && N.l3up(W, d).some(l => U.inNet(q.from, l.ip, l.mask))) || (x.indexOf('/') > 0 && U.inCidr(q.from, x)))) return { rcode: 'REFUSED', answers: [] };
  for (const f of snap.opt.forwarders) { const r = N.dnsQuery(W, d.id, f, name, q.type); if (r.state === 'ok') return { rcode: r.rcode, answers: r.answers || [] }; }
  return { rcode: 'SERVFAIL', answers: [] };
};

/* ------------------------------------------------------------------ hooks */
K.linux = {
  forwards: false,
  fwIn: (W, d, ifn, pkt, st) => {
    if (pkt.reply) return 'allow';
    if (pkt.proto === 'icmp') return 'allow';
    if (pkt.proto === 'tcp' || pkt.proto === 'udp') return LX.ufwAllows(d, pkt.proto, pkt.dport, st.sip) ? 'allow' : 'drop';
    return 'allow';
  },
  listening: (W, d, proto, port, ifn, st) => LX.isListening(W, d, proto, port, ifn, st),
  icmpReply: () => true,
  dnsAnswer: LX.dnsAnswer
};
if (SIM.pf && SIM.pf.hostPreRoute) K.linux.preRoute = SIM.pf.hostPreRoute;

/* ------------------------------------------------------------------ projection sémantique : fichiers de configuration inclus */
SIM.semProjectors.linux = function (d, id) {
  const out = {};
  const c = { ifaces: {}, svc: d.svc, ufw: d.ufw, db: d.db, docker: d.docker, disk: d.disk, hostname: d.hostname, clockSkewMin: d.clockSkewMin, boot: d.boot };
  for (const n of Object.keys(d.ifaces)) { const i = d.ifaces[n]; c.ifaces[n] = { ip: i.ip, mask: i.mask, gw: i.gw, adminDown: i.adminDown, cable: i.cable ? { plugged: i.cable.plugged, to: i.cable.to } : null }; }
  U.flat(c, id, out);
  for (const p of Object.keys(d.fs)) { if (!/^\/(etc|srv|opt|root|usr\/local|var\/www|home)\//.test(p) || /\.bash_history$|\.viminfo$|\.lesshst$/.test(p)) continue; const n = d.fs[p]; out[id + ':' + p] = n.t === 'f' ? 'f|' + n.m + '|' + n.o + ':' + n.g + '|' + U.hash8(n.c) + (n.acl ? '|acl' + JSON.stringify(n.acl) : '') : n.t === 'l' ? 'l|' + n.target : 'd|' + n.m + '|' + n.o + ':' + n.g + (n.acl ? '|acl' + JSON.stringify(n.acl) : ''); }
  return out;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
