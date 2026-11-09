/* ============================================================================
   Debian 13 — shell bash : analyse de ligne (tubes, redirections, && || ;, variables, globbing),
   commandes de fichiers / droits / texte / système lues et modifiées dans le VFS du monde (LX),
   éditeur (nano/vi) délégué à l'interface, sudo/su, historique, complétion.
   Les commandes réseau, systemd, démons, MariaDB, apt sont dans 21-bash-sys.js.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, LX = SIM.lx;
const E = SIM.emu; const L = E.L;
const B = E.lx = { cmds: {}, sbin: {} };
const C = B.cmds;
const lc = s => String(s).toLowerCase();

U.av('bash-errors', 'Messages d’erreur coreutils / bash en anglais (« No such file or directory », « Permission denied », « command not found »…) : formes courantes de Debian 13, reprises de mémoire.');
U.av('ls-format', 'Mise en forme de ls (colonnes, ls -l, dates « Oct 27 07:12 », total en blocs de 1 Kio) : approximation de coreutils 9.x.');
U.av('df-format', 'Sortie de df -h (noms de périphériques /dev/sda1, lignes udev/tmpfs et tailles de tmpfs) : valeurs plausibles d’une VM Debian 13, non issues d’une capture.');
U.av('uname-string', 'Chaîne complète de uname -a pour le noyau 6.12.x de Debian 13 (numéro de build et date) : à vérifier.');
U.av('ps-format', 'Sortie de ps aux (colonnes, processus noyau et systemd, tailles mémoire) : plausible, non issue d’une capture.');

const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const byteLen = s => enc ? enc.encode(s).length : s.length;
const MON = E.EN_MONTHS, DAY = E.EN_DAYS;

/* ------------------------------------------------------------------ utilitaires */
B.hsize = function (n, si) {
  const base = 1024; const u = ['', 'K', 'M', 'G', 'T']; let i = 0; let v = n;
  if (v < base) return String(v);
  while (v >= base && i < 4) { v /= base; i++; }
  const r = v < 10 ? Math.ceil(v * 10) / 10 : Math.ceil(v);
  return (r % 1 === 0 ? String(r) : r.toFixed(1)) + u[i];
};
B.nodeSize = n => n.t === 'd' ? 4096 : n.t === 'l' ? byteLen(n.target) : (n.sz ? Math.round(n.sz * 1048576) : byteLen(n.c || ''));
B.dateLs = function (W, ms) {
  const dt = new Date(ms || (W.clock.base - 30 * 86400000)); const now = W.now().getTime(); const old = (now - dt.getTime()) > 15778800000 || dt.getTime() > now + 3600000;
  const day = String(dt.getUTCDate()).padStart(2, ' ');
  return MON[dt.getUTCMonth()] + ' ' + day + ' ' + (old ? ' ' + dt.getUTCFullYear() : U.pad2(dt.getUTCHours()) + ':' + U.pad2(dt.getUTCMinutes()));
};
B.primaryGroup = (d, user) => { const u = LX.user(d, user); return u ? LX.groupName(d, u.gid) : user; };
B.padR = (s, n) => String(s).length >= n ? String(s) : String(s) + ' '.repeat(n - String(s).length);
B.padL = (s, n) => String(s).length >= n ? String(s) : ' '.repeat(n - String(s).length) + String(s);
B.sortKey = n => n.replace(/^\./, '').toLowerCase();
B.cmpName = (a, b) => { const x = B.sortKey(a), y = B.sortKey(b); return x < y ? -1 : x > y ? 1 : (a < b ? -1 : a > b ? 1 : 0); };

/* ------------------------------------------------------------------ session */
function LxShell(env, devId, opts) {
  E.Session.call(this, env, devId, opts);
  opts = opts || {}; const d = this.d;
  this.kind = 'bash'; this.user = opts.user || 'tech'; this.eff = null;
  this.vars = {}; this.status = 0; this.sudoUntil = -1; this.stack = []; this.remote = opts.remote || null; this.tty = opts.tty || 'pts/0';
  this.emergency = !!opts.emergency || !!d._rt.emergency;
  if (this.emergency) { this.user = 'root'; if (d._rt.rootRO === undefined) d._rt.rootRO = true; }
  const pw = LX.user(d, this.user); this.cwd = opts.cwd || (pw ? pw.home : '/');
  this.prevCwd = this.cwd; this.loginAt = this.W.now().getTime();
  this.cols = opts.cols || 80;
}
LxShell.prototype = Object.create(E.Session.prototype);
LxShell.prototype.constructor = LxShell;
E.LxShell = LxShell;
E.openLxShell = (env, devId, opts) => new LxShell(env, devId, opts);

LxShell.prototype.euser = function () { return this.eff || this.user; };
LxShell.prototype.home = function () { const u = LX.user(this.d, this.euser()); return u ? u.home : '/'; };
LxShell.prototype.host = function () { return this.d.hostname || this.d.name; };
LxShell.prototype.prompt = function () {
  if (this.ask) return this.ask.prompt;
  const h = this.home(); const w = this.cwd === h ? '~' : (this.cwd.indexOf(h + '/') === 0 && h !== '/' ? '~' + this.cwd.slice(h.length) : this.cwd);
  return this.euser() + '@' + this.host() + ':' + w + (this.euser() === 'root' ? '# ' : '$ ');
};
LxShell.prototype.banner = function () {
  const d = this.d;
  if (this.emergency) return [L('You are in emergency mode. After logging in, type "journalctl -xb" to view'), L('system logs, "systemctl reboot" to reboot, "systemctl default" or "exit"'), L('to boot into default mode.')];
  const dt = this.W.now(); const last = 'Last login: ' + DAY[dt.getUTCDay()] + ' ' + MON[dt.getUTCMonth()] + ' ' + String(dt.getUTCDate()).padStart(2, ' ') + ' ' + E.frTime(new Date(dt.getTime() - 3 * 3600000)).slice(0, 8) + ' ' + dt.getUTCFullYear() + ' from 10.10.30.10';
  return [L('Linux ' + (d.hostname || d.name) + ' ' + d.kernel + ' #1 SMP PREEMPT_DYNAMIC Debian ' + d.kernel.replace('+deb13-amd64', '-1') + ' x86_64'), L(''), L('The programs included with the Debian GNU/Linux system are free software;'), L('the exact distribution terms for each program are described in the'), L('individual files in /usr/share/doc/*/copyright.'), L(''), L('Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent'), L('permitted by applicable law.'), L(this.remote ? last : last.replace(/ from .*$/, ' on tty1'))];
};
LxShell.prototype.envVar = function (name) {
  const v = this.vars; if (v[name] !== undefined) return v[name];
  switch (name) {
    case 'HOME': return this.home(); case 'USER': case 'LOGNAME': return this.euser(); case 'PWD': return this.cwd; case 'OLDPWD': return this.prevCwd;
    case 'SHELL': return '/bin/bash'; case 'HOSTNAME': return this.host(); case 'LANG': return 'en_US.UTF-8'; case 'TERM': return 'xterm-256color';
    case 'PATH': return this.euser() === 'root' ? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' : '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games';
    case 'EDITOR': return undefined; case 'UID': return String((LX.user(this.d, this.euser()) || {}).uid); case '?': return String(this.status);
  }
  return undefined;
};
LxShell.prototype.abs = function (p) { if (p === '~' ) return this.home(); if (p.indexOf('~/') === 0) p = this.home() + p.slice(1); return LX.norm(p, this.cwd); };

/* --- droits et écritures --- */
LxShell.prototype.can = function (path, mode) { return LX.access(this.d, this.euser(), path, mode); };
LxShell.prototype.mountPct = function (path) { const d = this.d; if (!d.disk) return 0; const k = LX.mountOf(d, path); return d.disk[k] ? d.disk[k].usePct : 0; };
/* Écrit un fichier en vérifiant droits, système de fichiers en lecture seule et espace. Retourne null ou un message d'erreur (sans le préfixe) */
LxShell.prototype.writeFile = function (path, content, append) {
  const d = this.d, W = this.W, eu = this.euser(); const abs = LX.resolve(d, LX.norm(path));
  if (d._rt.rootRO && abs.indexOf('/tmp') !== 0 && abs.indexOf('/run') !== 0 && abs.indexOf('/dev') !== 0) return 'Read-only file system';
  const n = d.fs[abs];
  if (n && n.t === 'd') return 'Is a directory';
  if (n) { const a = this.can(abs, 'w'); if (!a.ok) return a.kind === 'noent' ? 'No such file or directory' : 'Permission denied'; }
  else {
    const par = LX.dirname(abs); if (!LX.isDir(d, par)) return 'No such file or directory';
    const a = this.can(par, 'w'); if (!a.ok) return 'Permission denied'; if (eu !== 'root') { const px = this.can(par, 'x'); if (!px.ok) return 'Permission denied'; }
  }
  const text = append && n ? (n.c || '') + content : content;
  if (content.length && this.mountPct(abs) >= 100 && !(n && n.sz && !append && content.length < (n.sz * 1048576))) return 'No space left on device';
  if (n) { if (n.sz && !append) delete n.sz; LX.write(W, d, abs, text); }
  else LX.write(W, d, abs, text, { m: '0644', o: eu, g: B.primaryGroup(d, eu) });
  LX.recalcDisk(d); return null;
};
LxShell.prototype.readFile = function (path) {
  const d = this.d; const abs = LX.resolve(d, LX.norm(path)); const n = d.fs[abs];
  const a = this.can(abs, 'r');
  if (!n && abs !== '/') return { err: 'No such file or directory' };
  if (!a.ok) return { err: a.kind === 'noent' ? 'No such file or directory' : 'Permission denied' };
  if (n && n.t === 'd') return { err: 'Is a directory' };
  return { text: n.c || '', node: n, abs };
};
LxShell.prototype.mut = function (r, why) { LX.recalcDisk(this.d); this.env.touch(why || 'fs'); if (r) r.mutated = true; };

/* --- globbing --- */
LxShell.prototype.glob = function (pat) {
  const d = this.d; const abs = pat[0] === '/'; const segs = pat.split('/').filter(x => x !== '');
  let cur = [abs ? '/' : this.cwd]; let prefixes = [abs ? '/' : ''];
  segs.forEach((sg, idx) => {
    const next = [], np = [];
    cur.forEach((base, bi) => {
      if (!/[*?\[]/.test(sg)) { const p = LX.norm(sg, base); if (LX.exists(d, p)) { next.push(p); np.push(prefixes[bi] + sg + (idx < segs.length - 1 ? '/' : '')); } return; }
      const re = U.globToRe(sg); LX.list(d, base).forEach(nm => { if (nm[0] === '.' && sg[0] !== '.') return; if (re.test(nm)) { const p = LX.norm(nm, base); if (idx < segs.length - 1 && !LX.isDir(d, p)) return; next.push(p); np.push(prefixes[bi] + nm + (idx < segs.length - 1 ? '/' : '')); } });
    });
    cur = next; prefixes = np;
  });
  return prefixes.map(p => p.replace(/\/$/, '') || '/').sort(B.cmpName);
};

/* ------------------------------------------------------------------ exécution */
LxShell.prototype.subst = function (sub) { const sv = this.vars; const o = this.runLine(sub, { capture: true }); return o.text.replace(/\n+$/, ''); };
LxShell.prototype.run = function (line) { return this.runLine(line, {}); };
LxShell.prototype.runLine = function (line, opts) {
  opts = opts || {};
  const ctx = { env: n => this.envVar(n), subst: s => this.subst(s), status: this.status, home: this.home() };
  const segs = E.parseSh(line, ctx);
  const res = { out: [], mutated: false };
  let status = this.status;
  for (const seg of segs) {
    if (seg.sep === '&&' && status !== 0) continue;
    if (seg.sep === '||' && status === 0) continue;
    const pr = this.runPipeline(seg.pipeline, opts);
    pr.out.forEach(x => res.out.push(x)); status = pr.status; this.status = status;
    if (pr.mutated) res.mutated = true;
    if (pr.impact && !res.impact) res.impact = pr.impact;   /* tag d'impact (D-109) : « systemctl stop x && reboot » garde le premier */
    if (pr.danger && !res.danger) res.danger = pr.danger;
    ['ask', 'push', 'pop', 'clear', 'launch', 'stream', 'pager', 'exit', 'edit'].forEach(k => { if (pr[k] !== undefined) res[k] = pr[k]; });
    if (pr.ask || pr.push || pr.exit || pr.stream || pr.edit || pr.pager) break;
  }
  if (opts.capture) { res.text = res.out.filter(x => x.k !== 'e').map(x => x.t).join('\n'); }
  res.ok = status === 0; return res;
};
LxShell.prototype.runPipeline = function (pipe, opts) {
  let input = null; let last = { out: [], status: 0 }; const all = []; let anyMut = false;
  for (let i = 0; i < pipe.length; i++) {
    const r = this.runCmd(pipe[i], input, opts); const final = i === pipe.length - 1;
    r.out.filter(x => x.k === 'e').forEach(x => all.push(x));
    input = r.out.filter(x => x.k !== 'e').map(x => x.t);
    if (r.mutated) anyMut = true;
    if (final) { r.out.filter(x => x.k !== 'e').forEach(x => all.push(x)); last = r; }
    else if (r.edit || r.ask || r.push || r.pager || r.stream) { last = r; r.out.filter(x => x.k !== 'e').forEach(x => all.push(x)); break; }
  }
  return Object.assign({}, last, { out: all, mutated: anyMut });
};
/* exécute une commande simple : affectations, redirections, builtin / programme */
LxShell.prototype.runCmd = function (cmd, input, opts) {
  const o = new E.Out(); const r = { out: o.lines, status: 0, ok: true };
  /* affectations seules */
  if (!cmd.argv.length) { cmd.assign.forEach(a => { this.vars[a[0]] = a[1]; }); return Object.assign(r, { out: [] }); }
  /* globbing */
  let argv = [];
  cmd.argv.forEach(w => { if (w.glob) { const m = this.glob(w.s); if (m.length) m.forEach(x => argv.push(x)); else argv.push(w.s); } else argv.push(w.s); });
  const name = argv[0]; const args = argv.slice(1);
  /* redirections */
  let stdin = input; let outFile = null, errFile = null, append = false, errToOut = false, errNull = false;
  for (const rd of cmd.redirs) {
    const op = rd.op;
    if (op === '<') { const rf = this.readFile(this.abs(rd.target)); if (rf.err) { o.l('bash: ' + rd.target + ': ' + rf.err, 'e'); r.status = 1; r.ok = false; return r; } stdin = rf.text.replace(/\n$/, '').split('\n'); }
    else if (op === '>' || op === '>>' || op === '1>' || op === '1>>') { outFile = rd.target; append = /\>\>/.test(op); }
    else if (op === '2>' || op === '2>>') { if (rd.target === '/dev/null') errNull = true; else errFile = rd.target; }
    else if (/^2>&/.test(op) || op === '&>') errToOut = true;
  }
  if (cmd.redirs.some(x => x.op === '2>&' ) || cmd.redirs.some(x => /2>&1/.test(x.op))) errToOut = true;
  const sub = new E.Out(); const rr = { out: sub.lines, status: 0, ok: true };
  /* sudo / environnement de la commande */
  const saved = {}; cmd.assign.forEach(a => { saved[a[0]] = this.vars[a[0]]; this.vars[a[0]] = a[1]; });
  this.dispatch(name, args, sub, rr, stdin, opts);
  Object.keys(saved).forEach(k => { if (saved[k] === undefined) delete this.vars[k]; else this.vars[k] = saved[k]; });
  if (rr.ok === false && !rr.status) rr.status = 1;
  /* application des redirections */
  let lines = rr.out;
  if (errNull) lines = lines.filter(x => x.k !== 'e');
  if (errFile) { const errs = lines.filter(x => x.k === 'e'); lines = lines.filter(x => x.k !== 'e'); const e1 = this.writeFile(this.abs(errFile), errs.map(x => x.t).join('\n') + (errs.length ? '\n' : ''), false); if (e1) lines.push(L('bash: ' + errFile + ': ' + e1, 'e')); else rr.mutated = true; }
  if (errToOut) lines = lines.map(x => x.k === 'e' ? Object.assign({}, x, { k: 'o' }) : x);
  if (outFile !== null) {
    const outs = lines.filter(x => x.k !== 'e'); const rest = lines.filter(x => x.k === 'e');
    const text = outs.map(x => x.t).join('\n') + (outs.length ? '\n' : '');
    if (outFile === '/dev/null') lines = rest;
    else {
      const abs = this.abs(outFile); const e1 = this.writeFile(abs, text, append);
      if (e1) { lines = [L('bash: ' + outFile + ': ' + e1, 'e')]; rr.status = 1; rr.ok = false; } else { lines = rest; rr.mutated = true; this.env.touch('fs'); }
    }
  }
  rr.out = lines; if (rr.mutated) this.env.touch('fs');
  return rr;
};

/* sudo : élévation pour la durée d'une commande */
LxShell.prototype.sudoOk = function () { const d = this.d; const groups = LX.groupsOf(d, this.user); return this.user === 'root' || groups.indexOf('sudo') >= 0 || groups.indexOf('admin') >= 0; };
LxShell.prototype.dispatch = function (name, args, o, r, stdin, opts) {
  if (name.indexOf('/') >= 0) return this.runPath(name, args, o, r, stdin);
  const fn = C[name] || B.sbin[name];
  if (fn) {
    if (B.sbin[name] && !C[name] && this.euser() !== 'root' && !B.sbinUser[name]) { /* binaires de /usr/sbin : hors du PATH d'un utilisateur ordinaire */ o.l('bash: ' + name + ': command not found', 'e'); r.status = 127; r.ok = false; return; }
    if (!B.available(this, name)) { o.l('bash: ' + name + ': command not found', 'e'); r.status = 127; r.ok = false; return; }
    const ret = fn(this, args, o, r, { in: stdin, opts });
    if (typeof ret === 'number') r.status = ret;
    return;
  }
  /* alias de répertoire (cd implicite non pris en charge) */
  o.l('bash: ' + name + ': command not found', 'e'); r.status = 127; r.ok = false;
};
B.sbinUser = { ip: 1, ss: 1, ifconfig: 0, ping: 1, sysctl: 0 };
B.PKG = { dig: 'bind9-dnsutils', host: 'bind9-host', nslookup: 'bind9-dnsutils', mysql: 'mariadb-client', mysqldump: 'mariadb-client', curl: 'curl', wget: 'wget', nano: 'nano', vim: 'vim', traceroute: 'traceroute', 'net-tools': 'net-tools', netstat: 'net-tools', ifconfig: 'net-tools', tcpdump: 'tcpdump', lsof: 'lsof', nc: 'netcat-openbsd', telnet: 'telnet', rsync: 'rsync', tree: 'tree', htop: 'htop', mtr: 'mtr-tiny', zip: 'zip', unzip: 'unzip' };
/* paquets présents par défaut sur une VM serveur Debian 13 de ce laboratoire */
B.DEFAULT_PKGS = ['curl', 'nano', 'bind9-host', 'bind9-dnsutils', 'mariadb-client'];
B.available = function (s, name) {
  const pk = B.PKG[name]; if (!pk) return true;
  const d = s.d; d.pkgs = d.pkgs || B.DEFAULT_PKGS.slice();
  if (name === 'mysql' || name === 'mysqldump') return d.pkgs.indexOf('mariadb-client') >= 0 || d.pkgs.indexOf('mariadb-server') >= 0 || !!d.svc.mariadb;
  return d.pkgs.indexOf(pk) >= 0;
};
LxShell.prototype.runPath = function (name, args, o, r, stdin) {
  const d = this.d; const abs = this.abs(name); const resolved = LX.resolve(d, abs); const n = d.fs[resolved];
  const shown = name;
  if (/^\/(usr\/)?(local\/)?(s?bin)\//.test(resolved) && !n) {
    const base = LX.basename(resolved); if (C[base] || B.sbin[base]) return this.dispatch(base, args, o, r, stdin, {});
    o.l('bash: ' + shown + ': No such file or directory', 'e'); r.status = 127; r.ok = false; return;
  }
  if (!n) { o.l('bash: ' + shown + ': No such file or directory', 'e'); r.status = 127; r.ok = false; return; }
  if (n.t === 'd') { o.l('bash: ' + shown + ': Is a directory', 'e'); r.status = 126; r.ok = false; return; }
  const acc = this.can(resolved, 'x');
  if (!acc.ok) { o.l('bash: ' + shown + ': Permission denied', 'e'); r.status = 126; r.ok = false; return; }
  const first = (n.c || '').split('\n')[0];
  if (/^#!/.test(first)) {
    const interp = first.slice(2).replace(/^[ \t]+/, '').split(/[ \t]+/)[0];
    if (['/bin/bash', '/bin/sh', '/bin/dash', '/usr/bin/bash', '/usr/bin/env', '/usr/bin/python3', '/usr/bin/perl'].indexOf(interp) < 0) { o.l('bash: ' + shown + ': ' + interp.replace(/\r/g, '^M') + ': bad interpreter: No such file or directory', 'e'); r.status = 126; r.ok = false; return; }
  } else if (n.c === undefined || n.c === '') { return; }
  return this.runScript(resolved, n, args, o, r);
};
/* exécution d'un script du VFS : évaluation fidèle à cron (droits, interpréteur, dépendances), effets de bord déclarés (cronOut) */
LxShell.prototype.runScript = function (path, node, args, o, r) {
  const d = this.d, W = this.W;
  const ev = LX.cronEval(W, d, { file: '(shell)', user: this.euser(), cmd: path });
  const cronBad = ev && !ev.ok && ev.stage !== 'service' && ev.stage !== 'insecure';
  if (cronBad) { String(ev.bash || ev.msg).split('\n').forEach(l => o.l(l, 'e')); r.status = ev.stage === 'cmd' ? 127 : 1; r.ok = false; return; }
  const out = (d.cronOut || {})[path];
  if (out) {
    const dt = W.now(); const f = dt.getUTCFullYear() + '-' + U.pad2(dt.getUTCMonth() + 1) + '-' + U.pad2(dt.getUTCDate());
    const p = out.dir + '/' + out.name.replace('%F', f);
    if (this.can(out.dir, 'w').ok || this.euser() === 'root') {
      LX.write(W, d, p, '', { m: '0644', o: this.euser(), g: B.primaryGroup(d, this.euser()) }); d.fs[p].sz = out.sizeMB || 1; LX.recalcDisk(d); r.mutated = true; this.env.touch('fs');
    } else { o.l('mkdir: cannot create directory ‘' + out.dir + '’: Permission denied', 'e'); r.status = 1; r.ok = false; }
  }
  W.advance && W.advance(0);
  this.env.advance(3);
};

/* historique / complétion */
LxShell.prototype.complete = function (buf) {
  const m = buf.match(/(\S*)$/); const word = m ? m[1] : ''; const from = buf.length - word.length; const firstWord = !/\s/.test(buf.slice(0, from).trim() ? buf.slice(0, from).trim() : '') && buf.slice(0, from).trim() === '';
  const d = this.d; let list = [];
  if (firstWord && word.indexOf('/') < 0) { list = Object.keys(C).concat(this.euser() === 'root' ? Object.keys(B.sbin) : Object.keys(B.sbinUser)).filter(x => x.indexOf(word) === 0 && B.available(this, x)); }
  else {
    const dirPart = word.indexOf('/') >= 0 ? word.slice(0, word.lastIndexOf('/') + 1) : ''; const base = word.slice(dirPart.length);
    const dirAbs = this.abs(dirPart || '.');
    if (LX.isDir(d, dirAbs) && this.can(dirAbs, 'r').ok) LX.list(d, dirAbs).forEach(nm => { if (nm.indexOf(base) === 0 && (nm[0] !== '.' || base[0] === '.')) list.push(dirPart + nm + (LX.isDir(d, LX.norm(nm, dirAbs)) ? '/' : '')); });
  }
  return { list: U.uniq(list).sort(), from, word };
};

/* ------------------------------------------------------------------ éditeur (nano / vi) */
LxShell.prototype.openEditor = function (editor, file, r, o) {
  const abs = this.abs(file); const d = this.d; const resolved = LX.resolve(d, abs); const n = d.fs[resolved];
  if (n && n.t === 'd') { o.l(editor === 'nano' ? 'nano: ' + file + ' is a directory' : '"' + file + '" is a directory', 'e'); r.status = 1; return; }
  let text = '', exists = !!n;
  if (n) { const a = this.can(resolved, 'r'); if (!a.ok) { if (editor === 'nano') o.l('Error reading ' + file + ': Permission denied', 'e'); else o.l('E484: Can\'t open file ' + file, 'e'); r.status = 1; return; } text = n.c || ''; }
  r.edit = { editor, path: resolved, name: file, text, exists, readonly: false };
};
/* appelée par l'interface à l'enregistrement : écrit, trace, avance l'horloge */
LxShell.prototype.editorSave = function (path, text) {
  const err = this.writeFile(path, text, false);
  if (err) return { ok: false, msg: err };
  this.env.touch('fs'); this.env.advance(20);
  this.env.act({ kind: 'edit', dev: this.devId, text: 'edit ' + path, mutates: true, shell: 'bash', path });
  return { ok: true };
};
LxShell.prototype.help = function () { return null; };

/* ------------------------------------------------------------------ commandes : internes */
C.cd = (s, a, o, r) => {
  let t = a[0]; if (t === undefined || t === '~') t = s.home(); else if (t === '-') { t = s.prevCwd; o.l(t); }
  const abs = s.abs(t); const d = s.d;
  if (!LX.exists(d, abs)) { o.l('bash: cd: ' + a[0] + ': No such file or directory', 'e'); r.ok = false; return; }
  if (!LX.isDir(d, abs)) { o.l('bash: cd: ' + a[0] + ': Not a directory', 'e'); r.ok = false; return; }
  const ac = s.can(LX.resolve(d, abs), 'x'); if (!ac.ok) { o.l('bash: cd: ' + a[0] + ': Permission denied', 'e'); r.ok = false; return; }
  s.prevCwd = s.cwd; s.cwd = LX.resolve(d, abs);
};
C.pwd = (s, a, o) => { o.l(s.cwd); };
C.echo = (s, a, o) => { let nl = true, esc = false; while (a[0] && /^-[neE]+$/.test(a[0])) { if (a[0].indexOf('n') >= 0) nl = false; if (a[0].indexOf('e') >= 0) esc = true; a = a.slice(1); } let t = a.join(' '); if (esc) t = t.replace(/\\n/g, '\n').replace(/\\t/g, '\t'); o.l(t); };
C.printf = (s, a, o) => { if (!a.length) return; let f = a[0].replace(/\\n/g, '\n').replace(/\\t/g, '\t'); let k = 1; f = f.replace(/%[sd]/g, () => (a[k++] || '')); o.l(f.replace(/\n$/, '')); };
C.export = (s, a, o) => { a.forEach(x => { const i = x.indexOf('='); if (i > 0) s.vars[x.slice(0, i)] = x.slice(i + 1); }); };
C.unset = (s, a) => { a.forEach(x => delete s.vars[x]); };
C.env = (s, a, o) => { ['SHELL=/bin/bash', 'PWD=' + s.cwd, 'LOGNAME=' + s.euser(), 'HOME=' + s.home(), 'LANG=en_US.UTF-8', 'TERM=xterm-256color', 'USER=' + s.euser(), 'PATH=' + s.envVar('PATH')].concat(Object.keys(s.vars).map(k => k + '=' + s.vars[k])).forEach(x => o.l(x)); };
C.printenv = (s, a, o) => { if (!a.length) return C.env(s, a, o); const v = s.envVar(a[0]); if (v !== undefined) o.l(v); else return 1; };
C.true = () => 0; C.false = () => 1; C[':'] = () => 0;
C.exit = (s, a, o, r) => { if (s.stack.length) { const p = s.stack.pop(); s.eff = p.eff; s.user = p.user; s.cwd = p.cwd; o.l('logout'); return; } if (s.remote) { o.l('logout'); o.l('Connection to ' + (s.remote.target || s.remote.ip) + ' closed.'); } r.exit = true; };
C.logout = C.exit;
C.clear = (s, a, o, r) => { r.clear = true; };
C.history = (s, a, o) => { s.history.forEach((h, i) => o.l(B.padL(i + 1, 5) + '  ' + h)); };
C.sleep = (s, a, o) => { s.env.advance(Math.round(parseFloat(a[0]) || 0)); };
C.type = (s, a, o, r) => { a.forEach(n => { if (C[n]) o.l(n + ' is /usr/bin/' + n); else if (B.sbin[n]) o.l(n + ' is /usr/sbin/' + n); else { o.l('bash: type: ' + n + ': not found', 'e'); r.ok = false; } }); };
C.which = (s, a, o, r) => { a.forEach(n => { if (C[n] && n !== 'cd' && B.available(s, n)) o.l('/usr/bin/' + n); else if (B.sbin[n] && s.euser() === 'root') o.l('/usr/sbin/' + n); else r.ok = false; }); if (!r.ok) r.status = 1; };
C.source = (s, a, o) => { };
C['.'] = C.source;
C.bash = (s, a, o, r) => { if (a[0] === '-n' && a[1] !== undefined) { const abs = s.abs(a[1]); const n = s.d.fs[LX.resolve(s.d, abs)]; if (!n) { o.l('bash: ' + a[1] + ': No such file or directory', 'e'); r.status = 127; return; } const rf = s.readFile(abs); if (rf.err) { o.l('bash: ' + a[1] + ': ' + rf.err, 'e'); r.status = 126; return; } const sc = LX.shCheck(n.c, a[1]); if (sc && sc.stage === 'syntax') { String(sc.msg + (sc.msg2 ? '\n' + sc.msg2 : '')).split('\n').forEach(l => o.l(l, 'e')); r.status = 2; } else r.status = 0; return; } if (a[0] === '-c' && a[1] !== undefined) { const x = s.runLine(a[1], {}); x.out.forEach(l => o.lines.push(l)); r.status = x.ok ? 0 : 1; if (x.mutated) r.mutated = true; return; } if (a.length && a[0][0] !== '-') { const abs = s.abs(a[0]); const n = s.d.fs[LX.resolve(s.d, abs)]; if (!n) { o.l('bash: ' + a[0] + ': No such file or directory', 'e'); r.status = 127; return; } const rf = s.readFile(abs); if (rf.err) { o.l('bash: ' + a[0] + ': ' + rf.err, 'e'); r.status = 126; return; } return s.runScript(LX.resolve(s.d, abs), n, a.slice(1), o, r); } const ns = new LxShell(s.env, s.devId, { user: s.user, cwd: s.cwd, remote: s.remote }); ns.eff = s.eff; r.push = ns; };
C.sh = C.bash;
C.test = (s, a, o, r) => { let x = a.slice(); if (x[x.length - 1] === ']') x.pop(); let res = false; const f = x[0], v = x[1];
  if (['-e', '-f', '-d', '-r', '-w', '-x', '-s', '-L'].indexOf(f) >= 0) { const abs = LX.resolve(s.d, s.abs(v || '')); const n = s.d.fs[abs] || (abs === '/' ? { t: 'd' } : null); res = !!n && (f === '-e' || (f === '-f' && n.t === 'f') || (f === '-d' && n.t === 'd') || (f === '-L' && s.d.fs[LX.norm(s.abs(v))] && s.d.fs[LX.norm(s.abs(v))].t === 'l') || (f === '-s' && B.nodeSize(n) > 0) || (f === '-r' && s.can(abs, 'r').ok) || (f === '-w' && s.can(abs, 'w').ok) || (f === '-x' && s.can(abs, 'x').ok)); }
  else if (f === '-z') res = !v; else if (f === '-n') res = !!v;
  else if (x[1] === '=' || x[1] === '==') res = x[0] === x[2]; else if (x[1] === '!=') res = x[0] !== x[2];
  else if (['-eq', '-ne', '-lt', '-gt', '-le', '-ge'].indexOf(x[1]) >= 0) { const p = +x[0], q = +x[2]; res = ({ '-eq': p === q, '-ne': p !== q, '-lt': p < q, '-gt': p > q, '-le': p <= q, '-ge': p >= q })[x[1]]; }
  else res = !!f; return res ? 0 : 1; };
C['['] = C.test;
C.alias = () => 0;

/* ------------------------------------------------------------------ fichiers : lecture */
function lsRows(s, paths, flags) {
  const d = s.d; const rows = [];
  paths.forEach(p => {
    const raw = LX.norm(p.path, '/'); const node = d.fs[raw] || (raw === '/' ? { t: 'd', m: '0755', o: 'root', g: 'root', mt: 0 } : null);
    if (node) rows.push({ name: p.name, node, path: raw });
  });
  return rows;
}
function lsFormatLong(s, rows, flags) {
  const d = s.d, W = s.W; const out = [];
  const subdirs = (path) => Object.keys(d.fs).filter(k => LX.dirname(k) === path && d.fs[k].t === 'd').length;
  const cells = rows.map(r => {
    const n = r.node; const size = B.nodeSize(n);
    return { mode: LX.modeStr(n), links: n.t === 'd' ? String(2 + subdirs(r.path)) : '1', o: n.o, g: n.g, size: flags.h ? B.hsize(size) : String(size), date: B.dateLs(W, n.mt), name: r.name + (n.t === 'l' ? ' -> ' + n.target : ''), blocks: Math.ceil(size / 4096) * 4 };
  });
  const wl = Math.max(0, ...cells.map(c => c.links.length)), wo = Math.max(0, ...cells.map(c => c.o.length)), wg = Math.max(0, ...cells.map(c => c.g.length)), ws = Math.max(0, ...cells.map(c => c.size.length));
  cells.forEach(c => out.push(c.mode + ' ' + B.padL(c.links, wl) + ' ' + B.padR(c.o, wo) + ' ' + B.padR(c.g, wg) + ' ' + B.padL(c.size, ws) + ' ' + c.date + ' ' + c.name));
  return { lines: out, total: cells.reduce((t, c) => t + c.blocks, 0) };
}
function lsColumns(names, width) {
  if (!names.length) return [];
  const n = names.length; let best = null;
  for (let cols = Math.min(n, Math.floor(width / 3)); cols >= 1; cols--) {
    const rows = Math.ceil(n / cols); const widths = []; for (let c = 0; c < cols; c++) { let w = 0; for (let r2 = 0; r2 < rows; r2++) { const nm = names[c * rows + r2]; if (nm !== undefined) w = Math.max(w, nm.length); } widths.push(w); }
    const total = widths.reduce((t, w) => t + w, 0) + 2 * (cols - 1);
    if (total <= width || cols === 1) { best = { rows, widths, cols }; break; }
  }
  const lines = [];
  for (let r2 = 0; r2 < best.rows; r2++) { let line = ''; for (let c = 0; c < best.cols; c++) { const nm = names[c * best.rows + r2]; if (nm === undefined) continue; line += (c < best.cols - 1 && names[(c + 1) * best.rows + r2] !== undefined ? B.padR(nm, best.widths[c] + 2) : nm); } lines.push(line); }
  return lines;
}
C.ls = (s, a, o, r) => {
  const flags = { l: false, a: false, A: false, h: false, d: false, R: false, one: false, r: false, t: false }; const targets = [];
  a.forEach(x => { if (x[0] === '-' && x.length > 1 && x[1] !== '-') { for (const ch of x.slice(1)) { if (ch === 'l') flags.l = true; else if (ch === 'a') flags.a = true; else if (ch === 'A') flags.A = true; else if (ch === 'h') flags.h = true; else if (ch === 'd') flags.d = true; else if (ch === 'R') flags.R = true; else if (ch === '1') flags.one = true; else if (ch === 'r') flags.r = true; else if (ch === 't') flags.t = true; } } else if (x === '--all') flags.a = true; else if (x[0] !== '-') targets.push(x); });
  const d = s.d; if (!targets.length) targets.push('.');
  const files = [], dirs = []; let bad = false;
  targets.forEach(t => {
    const abs = s.abs(t); const res = LX.resolve(d, abs); const n = d.fs[res] || (res === '/' ? { t: 'd', m: '0755', o: 'root', g: 'root' } : null);
    if (!n) { o.l('ls: cannot access \'' + t + '\': No such file or directory', 'e'); bad = true; return; }
    const parentOk = res === '/' ? true : s.can(LX.dirname(res), 'x').ok;
    if (!parentOk && (n.t !== 'd' || flags.d)) { o.l('ls: cannot access \'' + t + '\': Permission denied', 'e'); bad = true; return; }
    if (n.t === 'd' && !flags.d) dirs.push({ t, abs: res }); else files.push({ name: t, path: res, node: n });
  });
  const listDir = (dn, show) => {
    const acc = s.can(dn.abs, 'r'); if (!acc.ok) { o.l('ls: cannot open directory \'' + dn.t + '\': Permission denied', 'e'); bad = true; return; }
    if (show) o.l(dn.t + ':');
    let names = LX.list(d, dn.abs); if (!flags.a && !flags.A) names = names.filter(x => x[0] !== '.');
    names.sort(B.cmpName); if (flags.a) names = ['.', '..'].concat(names);
    if (flags.t) names.sort((x, y) => ((d.fs[LX.norm(y, dn.abs)] || {}).mt || 0) - ((d.fs[LX.norm(x, dn.abs)] || {}).mt || 0));
    if (flags.r) names.reverse();
    if (flags.l) {
      const rows = names.map(nm => ({ name: nm, node: nm === '.' ? d.fs[dn.abs] || { t: 'd', m: '0755', o: 'root', g: 'root', mt: 0 } : nm === '..' ? d.fs[LX.dirname(dn.abs)] || { t: 'd', m: '0755', o: 'root', g: 'root', mt: 0 } : d.fs[LX.norm(nm, dn.abs)], path: nm === '.' ? dn.abs : nm === '..' ? LX.dirname(dn.abs) : LX.norm(nm, dn.abs) })).filter(x => x.node);
      const f = lsFormatLong(s, rows, flags); o.l('total ' + f.total); f.lines.forEach(x => o.l(x));
    } else if (flags.one) names.forEach(nm => o.l(nm)); else lsColumns(names, s.cols).forEach(x => o.l(x));
    if (flags.R) names.filter(nm => nm !== '.' && nm !== '..' && d.fs[LX.norm(nm, dn.abs)] && d.fs[LX.norm(nm, dn.abs)].t === 'd').forEach(nm => { o.blank(); listDir({ t: (dn.t === '.' ? '.' : dn.t.replace(/\/$/, '')) + '/' + nm, abs: LX.norm(nm, dn.abs) }, true); });
  };
  if (files.length) { files.sort((x, y) => B.cmpName(x.name, y.name)); if (flags.l) lsFormatLong(s, files, flags).lines.forEach(x => o.l(x)); else lsColumns(files.map(x => x.name), s.cols).forEach(x => o.l(x)); }
  dirs.forEach((dn, i) => { if (files.length || i > 0) o.blank(); listDir(dn, targets.length > 1 || flags.R); });
  return bad ? 2 : 0;
};
C.dir = C.ls; C.ll = (s, a, o, r) => C.ls(s, ['-l'].concat(a), o, r);
C.cat = (s, a, o, r, st) => {
  const files = a.filter(x => x[0] !== '-' || x === '-'); const num = a.indexOf('-n') >= 0;
  if (!files.length) { (st.in || []).forEach(l => o.l(l)); return; }
  let bad = 0, k = 0;
  files.forEach(f => { if (f === '-') { (st.in || []).forEach(l => o.l(l)); return; } const x = s.readFile(s.abs(f)); if (x.err) { o.l('cat: ' + f + ': ' + x.err, 'e'); bad = 1; return; } const ls = x.text.replace(/\n$/, '').split('\n'); if (x.text === '') return; ls.forEach(l => { k++; o.l(num ? B.padL(k, 6) + '\t' + l : l); }); });
  return bad;
};
C.tac = (s, a, o, r, st) => { const x = a[0] ? s.readFile(s.abs(a[0])) : { text: (st.in || []).join('\n') }; if (x.err) { o.l('tac: ' + a[0] + ': ' + x.err, 'e'); return 1; } x.text.replace(/\n$/, '').split('\n').reverse().forEach(l => o.l(l)); };
function inputOf(s, files, st, cmdName, o) {
  if (!files.length) return { lines: (st.in || []), ok: true };
  const out = []; let ok = true;
  files.forEach(f => { const x = s.readFile(s.abs(f)); if (x.err) { o.l(cmdName + ': ' + (cmdName === 'head' || cmdName === 'tail' ? 'cannot open \'' + f + '\' for reading: ' : f + ': ') + x.err, 'e'); ok = false; return; } if (x.text !== '') x.text.replace(/\n$/, '').split('\n').forEach(l => out.push(l)); });
  return { lines: out, ok };
}
function numOpt(a, def) { let n = def; const rest = []; for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-n' && a[i + 1] !== undefined) { n = a[++i]; } else if (/^-n/.test(x)) n = x.slice(2); else if (/^-\d+$/.test(x)) n = x.slice(1); else if (x === '-f' || x === '-F') rest.push(x); else rest.push(x); } return { n, rest }; }
C.head = (s, a, o, r, st) => { const p = numOpt(a, '10'); const files = p.rest.filter(x => x[0] !== '-'); const i = inputOf(s, files, st, 'head', o); const k = parseInt(p.n, 10); (/^-/.test(p.n) ? i.lines.slice(0, Math.max(0, i.lines.length + k)) : i.lines.slice(0, k)).forEach(l => o.l(l)); return i.ok ? 0 : 1; };
C.tail = (s, a, o, r, st) => {
  const p = numOpt(a, '10'); const follow = a.indexOf('-f') >= 0 || a.indexOf('-F') >= 0; const files = p.rest.filter(x => x[0] !== '-'); const i = inputOf(s, files, st, 'tail', o); const k = parseInt(p.n, 10);
  (/^\+/.test(p.n) ? i.lines.slice(k - 1) : i.lines.slice(-k)).forEach(l => o.l(l));
  if (follow && files.length && i.ok) { const path = LX.resolve(s.d, s.abs(files[0])); let seen = (s.d.fs[path].c || '').length; r.stream = { interval: 1000, next: () => { const n = s.d.fs[path]; if (!n) return []; const c = n.c || ''; if (c.length <= seen) { s.env.advance(1); return []; } const add = c.slice(seen).replace(/\n$/, '').split('\n'); seen = c.length; return add.map(x => L(x)); }, stop: () => [] }; }
  return i.ok ? 0 : 1;
};
C.wc = (s, a, o, r, st) => {
  const flags = a.filter(x => x[0] === '-').join(''); const files = a.filter(x => x[0] !== '-');
  const doOne = (text, name) => { const lines = (text.match(/\n/g) || []).length; const words = (text.trim() ? text.trim().split(/\s+/).length : 0); const bytes = byteLen(text); const cols = []; const all = !/[lwc]/.test(flags); if (all || /l/.test(flags)) cols.push(lines); if (all || /w/.test(flags)) cols.push(words); if (all || /c/.test(flags)) cols.push(bytes); o.l((files.length || cols.length > 1 ? cols.map(c => B.padL(c, 7)).join(' ') : String(cols[0])) + (name ? ' ' + name : '')); };
  if (!files.length) { doOne((st.in || []).join('\n') + ((st.in || []).length ? '\n' : ''), ''); return; }
  files.forEach(f => { const x = s.readFile(s.abs(f)); if (x.err) { o.l('wc: ' + f + ': ' + x.err, 'e'); return; } doOne(x.text, f); });
};
C.grep = (s, a, o, r, st) => {
  const flags = { i: false, v: false, n: false, c: false, l: false, r: false, E: false, w: false, q: false, H: false, h: false, o: false, x: false };
  const rest = []; let pat = null; const extra = [];
  for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-e' && a[i + 1] !== undefined) { extra.push(a[++i]); } else if (x[0] === '-' && x.length > 1 && !/^--/.test(x)) { for (const ch of x.slice(1)) if (flags[ch] !== undefined) flags[ch] = true; } else if (x === '--color=auto' || x === '--color') { } else if (x === '--recursive') flags.r = true; else if (x === '--ignore-case') flags.i = true; else rest.push(x); }
  if (extra.length) pat = extra.join('|'); else pat = rest.shift();
  if (pat === undefined) { o.l('Usage: grep [OPTION]... PATTERNS [FILE]...', 'e'); return 2; }
  let re; try { re = new RegExp(flags.x ? '^(?:' + (flags.E ? pat : pat) + ')$' : (flags.w ? '\\b(?:' + pat + ')\\b' : (flags.E ? pat : pat.replace(/\\\|/g, '|').replace(/\\\(/g, '(').replace(/\\\)/g, ')'))), flags.i ? 'i' : ''); } catch (e) { o.l('grep: Unmatched ( or \\(', 'e'); return 2; }
  const files = rest.filter(x => x[0] !== '-'); let anyMatch = false; let bad = 0;
  const scan = (lines, label, multi) => { let cnt = 0; lines.forEach((l, i) => { const hit = re.test(l) !== flags.v; if (!hit) return; cnt++; anyMatch = true; if (flags.q || flags.c || flags.l) return; const m = flags.o ? (l.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || []) : [l]; m.forEach(t => o.l((multi && !flags.h ? label + ':' : '') + (flags.n ? (i + 1) + ':' : '') + t)); }); if (flags.c) o.l((multi && !flags.h ? label + ':' : '') + cnt); if (flags.l && cnt) o.l(label); };
  if (!files.length && !flags.r) { scan(st.in || [], '(standard input)', false); return anyMatch ? 0 : 1; }
  const targets = files.length ? files : ['.'];
  const walk = (p, shown) => { const abs = LX.resolve(s.d, s.abs(p)); const n = s.d.fs[abs]; if (!n && abs !== '/') { o.l('grep: ' + p + ': No such file or directory', 'e'); bad = 2; return; } if (n && n.t === 'd') { if (!flags.r) { o.l('grep: ' + p + ': Is a directory', 'e'); bad = 2; return; } if (!s.can(abs, 'r').ok) { o.l('grep: ' + shown + ': Permission denied', 'e'); bad = 2; return; } LX.list(s.d, abs).forEach(nm => walk(LX.norm(nm, abs), (shown === '.' ? '' : shown.replace(/\/$/, '') + '/') + nm)); return; } const x = s.readFile(abs); if (x.err) { o.l('grep: ' + shown + ': ' + x.err, 'e'); bad = 2; return; } scan(x.text.replace(/\n$/, '').split('\n'), shown, files.length > 1 || flags.r); };
  targets.forEach(t => walk(s.abs(t), t));
  return bad || (anyMatch ? 0 : 1);
};
C.egrep = (s, a, o, r, st) => C.grep(s, ['-E'].concat(a), o, r, st); C.fgrep = C.grep;
C.sort = (s, a, o, r, st) => { const rev = a.indexOf('-r') >= 0, num = a.indexOf('-n') >= 0, uniq = a.indexOf('-u') >= 0; const files = a.filter(x => x[0] !== '-'); const i = inputOf(s, files, st, 'sort', o); let l = i.lines.slice(); l.sort(num ? (x, y) => parseFloat(x) - parseFloat(y) : (x, y) => { const p = x.toLowerCase(), q = y.toLowerCase(); return p < q ? -1 : p > q ? 1 : 0; }); if (rev) l.reverse(); if (uniq) l = l.filter((x, k) => k === 0 || x !== l[k - 1]); l.forEach(x => o.l(x)); };
C.uniq = (s, a, o, r, st) => { const cnt = a.indexOf('-c') >= 0; const files = a.filter(x => x[0] !== '-'); const i = inputOf(s, files, st, 'uniq', o); const out = []; i.lines.forEach(l => { if (out.length && out[out.length - 1].l === l) out[out.length - 1].n++; else out.push({ l, n: 1 }); }); out.forEach(x => o.l(cnt ? B.padL(x.n, 7) + ' ' + x.l : x.l)); };
C.cut = (s, a, o, r, st) => { let dl = '\t', f = null, c = null; const files = []; for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-d') dl = a[++i]; else if (/^-d/.test(x)) dl = x.slice(2); else if (x === '-f') f = a[++i]; else if (/^-f/.test(x)) f = x.slice(2); else if (x === '-c') c = a[++i]; else if (/^-c/.test(x)) c = x.slice(2); else if (x[0] !== '-') files.push(x); } const i = inputOf(s, files, st, 'cut', o);
  const pick = (spec, n) => { const idx = []; spec.split(',').forEach(p => { const m = p.match(/^(\d*)-(\d*)$/); if (m) { const lo = m[1] ? +m[1] : 1, hi = m[2] ? +m[2] : n; for (let k = lo; k <= hi; k++) idx.push(k); } else idx.push(+p); }); return idx; };
  i.lines.forEach(l => { if (c) { o.l(pick(c, l.length).map(k => l[k - 1] || '').join('')); return; } const parts = l.split(dl); if (parts.length === 1) { o.l(l); return; } o.l(pick(f || '1', parts.length).map(k => parts[k - 1]).filter(x => x !== undefined).join(dl)); }); };
C.tr = (s, a, o, r, st) => { const del = a.indexOf('-d') >= 0; const sets = a.filter(x => x[0] !== '-'); const expand = t => t.replace(/([a-zA-Z0-9])-([a-zA-Z0-9])/g, (m, x, y) => { let z = ''; for (let k = x.charCodeAt(0); k <= y.charCodeAt(0); k++) z += String.fromCharCode(k); return z; }).replace(/\[:upper:\]/g, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').replace(/\[:lower:\]/g, 'abcdefghijklmnopqrstuvwxyz'); const f = expand(sets[0] || ''), t = expand(sets[1] || ''); (st.in || []).forEach(l => { let out = ''; for (const ch of l) { const k = f.indexOf(ch); if (k < 0) out += ch; else if (!del) out += t[Math.min(k, t.length - 1)] || ''; } o.l(out); }); };
C.tee = (s, a, o, r, st) => { const app = a.indexOf('-a') >= 0; const files = a.filter(x => x[0] !== '-'); const text = (st.in || []).join('\n') + ((st.in || []).length ? '\n' : ''); (st.in || []).forEach(l => o.l(l)); let bad = 0; files.forEach(f => { const e = s.writeFile(s.abs(f), text, app); if (e) { o.l('tee: ' + f + ': ' + e, 'e'); bad = 1; } else r.mutated = true; }); return bad; };
C.awk = (s, a, o, r, st) => {
  let fs = null; const rest = []; for (let i = 0; i < a.length; i++) { if (a[i] === '-F') fs = a[++i]; else if (/^-F./.test(a[i])) fs = a[i].slice(2); else rest.push(a[i]); }
  const prog = rest.shift(); const files = rest; const i = inputOf(s, files, st, 'awk', o);
  const m = (prog || '').match(/^(?:\/(.*)\/)?\s*\{\s*print\s*(.*?)\s*\}\s*$/); if (!m) { o.l('awk: syntaxe non prise en charge dans cette simulation (seuls « /motif/ { print $N } » sont gérés)', 'e'); return 2; }
  const re = m[1] ? new RegExp(m[1]) : null; const exprs = m[2] ? m[2].split(/\s*,\s*/) : ['$0'];
  i.lines.forEach(l => { if (re && !re.test(l)) return; const f = fs ? l.split(fs.length === 1 ? fs : new RegExp(fs)) : l.trim().split(/\s+/); o.l(exprs.map(e => e.replace(/\$(\d+)/g, (x, n) => n === '0' ? l : (f[n - 1] === undefined ? '' : f[n - 1])).replace(/\$NF/g, f[f.length - 1]).replace(/^"(.*)"$/, '$1')).join(' ')); });
};
C.sed = (s, a, o, r, st) => {
  let quiet = false, inplace = false; const rest = []; for (const x of a) { if (x === '-n') quiet = true; else if (x === '-i' || /^-i/.test(x)) inplace = true; else if (x === '-e') { } else rest.push(x); }
  const prog = rest.shift(); const files = rest; const sm = (prog || '').match(/^s(.)(.*?)\1(.*?)\1([gI]*)$/); const pm = (prog || '').match(/^(\d+)(?:,(\d+))?p$/); const dm = (prog || '').match(/^\/(.*)\/d$/);
  if (!sm && !pm && !dm) { o.l('sed: expression non prise en charge dans cette simulation (s/x/y/[g], N,Mp, /motif/d)', 'e'); return 1; }
  const tf = (lines) => { let out = lines; if (sm) { const re = new RegExp(sm[2], (sm[4].indexOf('g') >= 0 ? 'g' : '') + (sm[4].indexOf('I') >= 0 ? 'i' : '')); out = lines.map(l => l.replace(re, sm[3].replace(/\\(\d)/g, '$$$1'))); if (quiet) out = []; } else if (pm) out = lines.slice(+pm[1] - 1, pm[2] ? +pm[2] : +pm[1]); else if (dm) { const re = new RegExp(dm[1]); out = lines.filter(l => !re.test(l)); } return out; };
  if (inplace) { files.forEach(f => { const x = s.readFile(s.abs(f)); if (x.err) { o.l('sed: can\'t read ' + f + ': ' + x.err, 'e'); return; } const e = s.writeFile(s.abs(f), tf(x.text.replace(/\n$/, '').split('\n')).join('\n') + '\n', false); if (e) o.l('sed: couldn\'t open temporary file ' + LX.dirname(s.abs(f)) + '/sedXXXXXX: ' + e, 'e'); else r.mutated = true; }); return; }
  const i = inputOf(s, files, st, 'sed', o); tf(i.lines).forEach(l => o.l(l));
};
C.less = (s, a, o, r, st) => { const files = a.filter(x => x[0] !== '-'); const i = inputOf(s, files, st, 'less', o); if (!i.ok) return 1; r.pager = { lines: i.lines.slice(), title: files[0] || '' }; };
C.more = C.less;
C.nano = (s, a, o, r) => { const f = a.filter(x => x[0] !== '-')[0]; if (!f) { r.edit = { editor: 'nano', path: null, name: '', text: '', exists: false, readonly: false }; return; } s.openEditor('nano', f, r, o); };
C.vi = (s, a, o, r) => { const f = a.filter(x => x[0] !== '-')[0]; if (!f) { r.edit = { editor: 'vi', path: null, name: '', text: '', exists: false, readonly: false }; return; } s.openEditor('vi', f, r, o); };
C.vim = C.vi; C['vim.tiny'] = C.vi; C.editor = C.nano; C['sensible-editor'] = C.nano;
C.file = (s, a, o) => { a.forEach(f => { const abs = LX.resolve(s.d, s.abs(f)); const n = s.d.fs[abs]; if (!n && abs !== '/') { o.l(f + ': cannot open `' + f + '\' (No such file or directory)'); return; } if (!n || n.t === 'd') o.l(f + ': directory'); else if (n.t === 'l') o.l(f + ': symbolic link to ' + n.target); else { const c = n.c || ''; o.l(f + ': ' + (c === '' ? 'empty' : /^#!\/bin\/(ba)?sh/.test(c) ? 'Bourne-Again shell script, ASCII text executable' + (/\r\n/.test(c) ? ', with CRLF line terminators' : '') : /\r\n/.test(c) ? 'ASCII text, with CRLF line terminators' : /^\x1f\x8b/.test(c) ? 'gzip compressed data' : 'ASCII text')); } }); };
C.basename = (s, a, o) => { o.l(LX.basename(a[0] || '').replace(a[1] ? new RegExp(a[1].replace(/\./g, '\\.') + '$') : /$^/, '')); }; C.dirname = (s, a, o) => { o.l(LX.dirname(a[0] || '.')); };
C.realpath = (s, a, o, r) => { a.forEach(f => { const abs = LX.resolve(s.d, s.abs(f)); if (!LX.exists(s.d, abs)) { o.l('realpath: ' + f + ': No such file or directory', 'e'); r.ok = false; } else o.l(abs); }); };
C.readlink = (s, a, o) => { const f = a.filter(x => x[0] !== '-')[0]; const n = s.d.fs[LX.norm(s.abs(f || ''))]; if (n && n.t === 'l') o.l(n.target); else if (a.indexOf('-f') >= 0) o.l(LX.resolve(s.d, s.abs(f))); else return 1; };
C.stat = (s, a, o, r) => {
  a.filter(x => x[0] !== '-').forEach(f => {
    const abs = LX.resolve(s.d, s.abs(f)); const n = s.d.fs[abs] || (abs === '/' ? { t: 'd', m: '0755', o: 'root', g: 'root', mt: 0 } : null);
    if (!n) { o.l('stat: cannot statx \'' + f + '\': No such file or directory', 'e'); r.ok = false; return; }
    const sz = B.nodeSize(n); const dg = LX.modeDigits(n.m); const pw = LX.user(s.d, n.o); const dt = n.mt ? new Date(n.mt) : new Date(s.W.clock.base - 30 * 86400000); const ts = x => x.getUTCFullYear() + '-' + U.pad2(x.getUTCMonth() + 1) + '-' + U.pad2(x.getUTCDate()) + ' ' + E.frTime(x) + '.000000000 +0000';
    o.l('  File: ' + f + (n.t === 'l' ? ' -> ' + n.target : '')); o.l('  Size: ' + B.padR(sz, 10) + ' Blocks: ' + B.padR(Math.ceil(sz / 4096) * 8, 10) + ' IO Block: 4096   ' + (n.t === 'd' ? 'directory' : n.t === 'l' ? 'symbolic link' : sz === 0 ? 'regular empty file' : 'regular file'));
    o.l('Device: 8,1\tInode: ' + (parseInt(U.hash8(abs).slice(0, 5), 16) % 900000 + 100000) + '     Links: 1'); o.l('Access: (' + String(n.m).padStart(4, '0') + '/' + LX.modeStr(n).slice(0, 10) + ')  Uid: (' + B.padL(pw ? pw.uid : 0, 5) + '/' + B.padL(n.o, 8) + ')   Gid: (' + B.padL((LX.groups(s.d).find(x => x.name === n.g) || {}).gid || 0, 5) + '/' + B.padL(n.g, 8) + ')');
    o.l('Access: ' + ts(dt)); o.l('Modify: ' + ts(dt)); o.l('Change: ' + ts(dt)); o.l(' Birth: -');
  });
};
C.find = (s, a, o, r) => {
  const d = s.d; const starts = []; let i = 0; while (i < a.length && a[i][0] !== '-' && a[i] !== '(' && a[i] !== '!') starts.push(a[i++]); if (!starts.length) starts.push('.');
  const cond = []; let action = 'print'; let maxd = Infinity, mind = 0;
  for (; i < a.length; i++) { const x = a[i];
    if (x === '-name' || x === '-iname') cond.push({ k: 'name', re: new RegExp('^' + a[++i].replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', x === '-iname' ? 'i' : '') });
    else if (x === '-type') cond.push({ k: 'type', v: a[++i] });
    else if (x === '-user') cond.push({ k: 'user', v: a[++i] }); else if (x === '-group') cond.push({ k: 'group', v: a[++i] });
    else if (x === '-perm') cond.push({ k: 'perm', v: a[++i] });
    else if (x === '-size') cond.push({ k: 'size', v: a[++i] }); else if (x === '-mtime') cond.push({ k: 'mtime', v: a[++i] });
    else if (x === '-maxdepth') maxd = +a[++i]; else if (x === '-mindepth') mind = +a[++i];
    else if (x === '-delete') action = 'delete'; else if (x === '-print') action = 'print'; else if (x === '-ls') action = 'ls';
    else if (x === '-exec') { const cmd = []; i++; while (a[i] !== ';' && a[i] !== '+' && i < a.length) cmd.push(a[i++]); action = { exec: cmd }; }
    else if (x === '-empty') cond.push({ k: 'empty' }); else if (x === '-writable') cond.push({ k: 'writable' }); else if (x === '-readable') cond.push({ k: 'readable' });
  }
  const match = (p, n) => cond.every(c => {
    if (c.k === 'name') return c.re.test(LX.basename(p) || '/');
    if (c.k === 'type') return (c.v === 'f' && n.t === 'f') || (c.v === 'd' && n.t === 'd') || (c.v === 'l' && n.t === 'l');
    if (c.k === 'user') return n.o === c.v; if (c.k === 'group') return n.g === c.v;
    if (c.k === 'perm') { const m = c.v.replace(/^[-\/]/, ''); return c.v[0] === '-' ? (parseInt(n.m, 8) & parseInt(m, 8)) === parseInt(m, 8) : c.v[0] === '/' ? (parseInt(n.m, 8) & parseInt(m, 8)) !== 0 : parseInt(n.m, 8) === parseInt(m, 8); }
    if (c.k === 'size') { const m = c.v.match(/^([+-]?)(\d+)([cKMG]?)$/); if (!m) return true; const mult = ({ c: 1, K: 1024, M: 1048576, G: 1073741824, '': 512 })[m[3]]; const sz = B.nodeSize(n); const lim = +m[2] * mult; return m[1] === '+' ? sz > lim : m[1] === '-' ? sz < lim : Math.ceil(sz / mult) === +m[2]; }
    if (c.k === 'mtime') { const m = c.v.match(/^([+-]?)(\d+)$/); const age = (s.W.now().getTime() - (n.mt || (s.W.clock.base - 30 * 86400000))) / 86400000; return m[1] === '+' ? age > +m[2] : m[1] === '-' ? age < +m[2] : Math.floor(age) === +m[2]; }
    if (c.k === 'empty') return n.t === 'f' ? B.nodeSize(n) === 0 : false;
    if (c.k === 'writable') return s.can(p, 'w').ok; if (c.k === 'readable') return s.can(p, 'r').ok; return true;
  });
  starts.forEach(st => {
    const abs = LX.resolve(d, s.abs(st)); const root = d.fs[abs] || (abs === '/' ? { t: 'd', m: '0755', o: 'root', g: 'root' } : null);
    if (!root) { o.l('find: ‘' + st + '’: No such file or directory', 'e'); r.ok = false; return; }
    const shown = (p) => st === '.' ? (p === abs ? '.' : './' + p.slice(abs === '/' ? 1 : abs.length + 1)) : (p === abs ? st : st.replace(/\/$/, '') + '/' + p.slice(abs === '/' ? 1 : abs.length + 1));
    const walk = (p, n, depth) => {
      if (depth >= mind && depth <= maxd && match(p, n)) {
        if (action === 'print') o.l(shown(p));
        else if (action === 'ls') o.l(B.padL(parseInt(U.hash8(p).slice(0, 5), 16) % 900000 + 100000, 8) + ' ' + B.padL(Math.ceil(B.nodeSize(n) / 1024), 5) + ' ' + LX.modeStr(n) + '  1 ' + B.padR(n.o, 8) + ' ' + B.padR(n.g, 8) + ' ' + B.padL(B.nodeSize(n), 8) + ' ' + B.dateLs(s.W, n.mt) + ' ' + shown(p));
        else if (action === 'delete') { if (s.can(LX.dirname(p), 'w').ok && !d._rt.rootRO) { LX.rm(d, p); r.mutated = true; } else { o.l('find: cannot delete ‘' + shown(p) + '’: ' + (d._rt.rootRO ? 'Read-only file system' : 'Permission denied'), 'e'); r.ok = false; } }
        else if (action.exec) { const cmdline = action.exec.map(t => t === '{}' ? shown(p) : t).join(' '); const x = s.runLine(cmdline, {}); x.out.forEach(l => o.lines.push(l)); if (x.mutated) r.mutated = true; }
      }
      if (n.t === 'd' && depth < maxd) { if (!s.can(p, 'r').ok) { o.l('find: ‘' + shown(p) + '’: Permission denied', 'e'); r.ok = false; return; } LX.list(d, p).forEach(nm => { const q = LX.norm(nm, p); const cn = d.fs[q]; if (cn) walk(q, cn, depth + 1); }); }
    };
    walk(abs, root, 0);
  });
  if (r.mutated) s.env.touch('fs'); LX.recalcDisk(d);
};

/* ------------------------------------------------------------------ fichiers : écriture, droits */
C.touch = (s, a, o, r) => { let bad = 0; a.filter(x => x[0] !== '-').forEach(f => { const abs = LX.resolve(s.d, s.abs(f)); const n = s.d.fs[abs]; if (n) { const ac = s.can(abs, 'w'); if (!ac.ok && s.euser() !== 'root') { o.l('touch: cannot touch \'' + f + '\': Permission denied', 'e'); bad = 1; return; } n.mt = s.W.now().getTime(); r.mutated = true; return; } const e = s.writeFile(abs, '', false); if (e) { o.l('touch: cannot touch \'' + f + '\': ' + e, 'e'); bad = 1; } else r.mutated = true; }); s.mut(r); return bad; };
C.mkdir = (s, a, o, r) => {
  const parents = a.indexOf('-p') >= 0; let bad = 0; let mode = null; const targets = [];
  for (let i = 0; i < a.length; i++) { if (a[i] === '-m') mode = a[++i]; else if (a[i][0] !== '-') targets.push(a[i]); }
  targets.forEach(t => {
    const abs = LX.norm(s.abs(t)); const d = s.d;
    if (d.fs[abs] || abs === '/') { if (!parents) { o.l('mkdir: cannot create directory \'' + t + '\': File exists', 'e'); bad = 1; } return; }
    if (d._rt.rootRO) { o.l('mkdir: cannot create directory \'' + t + '\': Read-only file system', 'e'); bad = 1; return; }
    const chain = []; let p = abs; while (!LX.exists(d, p)) { chain.unshift(p); p = LX.dirname(p); }
    if (chain.length > 1 && !parents) { o.l('mkdir: cannot create directory \'' + t + '\': No such file or directory', 'e'); bad = 1; return; }
    if (!LX.isDir(d, p)) { o.l('mkdir: cannot create directory \'' + t + '\': Not a directory', 'e'); bad = 1; return; }
    const ac = s.can(p, 'w'); if (!ac.ok) { o.l('mkdir: cannot create directory \'' + t + '\': Permission denied', 'e'); bad = 1; return; }
    if (s.mountPct(abs) >= 100) { o.l('mkdir: cannot create directory \'' + t + '\': No space left on device', 'e'); bad = 1; return; }
    chain.forEach(c => LX.mkdir(s.W, d, c, { m: mode ? mode.padStart(4, '0') : '0755', o: s.euser(), g: B.primaryGroup(d, s.euser()) })); r.mutated = true;
  });
  s.mut(r); return bad;
};
C.rmdir = (s, a, o, r) => { let bad = 0; a.filter(x => x[0] !== '-').forEach(t => { const abs = LX.resolve(s.d, s.abs(t)); const n = s.d.fs[abs]; if (!n) { o.l('rmdir: failed to remove \'' + t + '\': No such file or directory', 'e'); bad = 1; return; } if (n.t !== 'd') { o.l('rmdir: failed to remove \'' + t + '\': Not a directory', 'e'); bad = 1; return; } if (LX.list(s.d, abs).length) { o.l('rmdir: failed to remove \'' + t + '\': Directory not empty', 'e'); bad = 1; return; } if (!s.can(LX.dirname(abs), 'w').ok) { o.l('rmdir: failed to remove \'' + t + '\': Permission denied', 'e'); bad = 1; return; } LX.rm(s.d, abs); r.mutated = true; }); s.mut(r); return bad; };
C.rm = (s, a, o, r) => {
  const rec = a.some(x => /^-[a-zA-Z]*[rR]/.test(x) || x === '--recursive'); const force = a.some(x => /^-[a-zA-Z]*f/.test(x)); let bad = 0; const verbose = a.some(x => /^-[a-zA-Z]*v/.test(x));
  a.filter(x => x[0] !== '-').forEach(t => {
    const abs = LX.norm(s.abs(t)); const d = s.d; const n = d.fs[abs];
    if (abs === '/') { o.l('rm: it is dangerous to operate recursively on \'/\'', 'e'); o.l('rm: use --no-preserve-root to override this failsafe', 'e'); bad = 1; return; }
    if (!n) { if (!force) { o.l('rm: cannot remove \'' + t + '\': No such file or directory', 'e'); bad = 1; } return; }
    if (n.t === 'd' && !rec) { o.l('rm: cannot remove \'' + t + '\': Is a directory', 'e'); bad = 1; return; }
    if (d._rt.rootRO) { o.l('rm: cannot remove \'' + t + '\': Read-only file system', 'e'); bad = 1; return; }
    const par = LX.dirname(abs); const pa = s.can(par, 'w'); const px = s.can(par, 'x');
    if (!pa.ok || !px.ok) { o.l('rm: cannot remove \'' + t + '\': Permission denied', 'e'); bad = 1; return; }
    LX.rm(d, abs); if (verbose) o.l('removed \'' + t + '\''); r.mutated = true;
  });
  s.mut(r); return bad;
};
C.cp = (s, a, o, r) => {
  const rec = a.some(x => /^-[a-zA-Z]*[rRa]/.test(x)); const args = a.filter(x => x[0] !== '-'); if (args.length < 2) { o.l('cp: missing destination file operand after \'' + (args[0] || '') + '\'', 'e'); return 1; }
  const dst = args.pop(); let bad = 0; const d = s.d; const dabs = LX.resolve(d, s.abs(dst)); const dIsDir = LX.isDir(d, dabs);
  if (args.length > 1 && !dIsDir) { o.l('cp: target \'' + dst + '\' is not a directory', 'e'); return 1; }
  args.forEach(src => {
    const sabs = LX.resolve(d, s.abs(src)); const n = d.fs[sabs];
    if (!n) { o.l('cp: cannot stat \'' + src + '\': No such file or directory', 'e'); bad = 1; return; }
    if (n.t === 'd' && !rec) { o.l('cp: -r not specified; omitting directory \'' + src + '\'', 'e'); bad = 1; return; }
    if (!s.can(sabs, 'r').ok) { o.l('cp: cannot open \'' + src + '\' for reading: Permission denied', 'e'); bad = 1; return; }
    const target = dIsDir ? LX.norm(LX.basename(sabs), dabs) : dabs;
    const copyNode = (from, to, node) => {
      if (node.t === 'd') { LX.mkdir(s.W, d, to, { m: node.m, o: s.euser(), g: B.primaryGroup(d, s.euser()) }); LX.list(d, from).forEach(nm => copyNode(LX.norm(nm, from), LX.norm(nm, to), d.fs[LX.norm(nm, from)])); return null; }
      const e = s.writeFile(to, node.c || '', false); if (e) return e; const nn = d.fs[LX.resolve(d, to)]; nn.m = node.m; if (node.sz) nn.sz = node.sz; return null;
    };
    const exists = d.fs[target];
    if (!exists || exists.t !== 'd') { const par = LX.dirname(target); if (!d._rt.rootRO && (!LX.isDir(d, par) || !s.can(par, 'w').ok)) { o.l('cp: cannot create regular file \'' + dst + '\': ' + (LX.isDir(d, par) ? 'Permission denied' : 'No such file or directory'), 'e'); bad = 1; return; } }
    const e = copyNode(sabs, target, n); if (e) { o.l('cp: cannot create regular file \'' + dst + '\': ' + e, 'e'); bad = 1; } else r.mutated = true;
  });
  s.mut(r); return bad;
};
C.mv = (s, a, o, r) => {
  const args = a.filter(x => x[0] !== '-'); if (args.length < 2) { o.l('mv: missing file operand', 'e'); return 1; } const dst = args.pop(); const d = s.d; let bad = 0;
  const dabs = LX.resolve(d, s.abs(dst)); const dIsDir = LX.isDir(d, dabs);
  args.forEach(src => {
    const sabs = LX.norm(s.abs(src)); const n = d.fs[sabs]; if (!n) { o.l('mv: cannot stat \'' + src + '\': No such file or directory', 'e'); bad = 1; return; }
    const target = dIsDir ? LX.norm(LX.basename(sabs), dabs) : LX.norm(s.abs(dst));
    if (d._rt.rootRO) { o.l('mv: cannot move \'' + src + '\' to \'' + dst + '\': Read-only file system', 'e'); bad = 1; return; }
    if (!s.can(LX.dirname(sabs), 'w').ok || !s.can(LX.dirname(target), 'w').ok) { o.l('mv: cannot move \'' + src + '\' to \'' + dst + '\': Permission denied', 'e'); bad = 1; return; }
    Object.keys(d.fs).forEach(k => { if (k === sabs || k.indexOf(sabs + '/') === 0) { d.fs[target + k.slice(sabs.length)] = d.fs[k]; delete d.fs[k]; } }); r.mutated = true;
  });
  s.mut(r); return bad;
};
C.ln = (s, a, o, r) => { const sym = a.some(x => /^-[a-z]*s/.test(x)); const args = a.filter(x => x[0] !== '-'); if (args.length < 2) { o.l('ln: missing file operand', 'e'); return 1; } const tgt = args[0], link = LX.norm(s.abs(args[1])); const d = s.d; if (d.fs[link]) { o.l('ln: failed to create ' + (sym ? 'symbolic ' : 'hard ') + 'link \'' + args[1] + '\': File exists', 'e'); return 1; } if (!s.can(LX.dirname(link), 'w').ok || d._rt.rootRO) { o.l('ln: failed to create ' + (sym ? 'symbolic ' : 'hard ') + 'link \'' + args[1] + '\': ' + (d._rt.rootRO ? 'Read-only file system' : 'Permission denied'), 'e'); return 1; } if (sym) d.fs[link] = { t: 'l', target: tgt, m: '0777', o: s.euser(), g: B.primaryGroup(d, s.euser()), mt: s.W.now().getTime() }; else { const sn = d.fs[LX.resolve(d, s.abs(tgt))]; if (!sn) { o.l('ln: failed to access \'' + tgt + '\': No such file or directory', 'e'); return 1; } d.fs[link] = Object.assign({}, sn); } s.mut(r); r.mutated = true; };
C.truncate = (s, a, o, r) => { let size = null; const files = []; for (let i = 0; i < a.length; i++) { if (a[i] === '-s') size = a[++i]; else if (/^-s/.test(a[i])) size = a[i].slice(2); else if (a[i][0] !== '-') files.push(a[i]); } if (size === null) { o.l('truncate: you must specify either \'--size\' or \'--reference\'', 'e'); return 1; } let bad = 0;
  files.forEach(f => { const abs = LX.resolve(s.d, s.abs(f)); const n = s.d.fs[abs]; if (!n) { const e = s.writeFile(abs, '', false); if (e) { o.l('truncate: cannot open \'' + f + '\' for writing: ' + e, 'e'); bad = 1; } return; } if (s.d._rt.rootRO) { o.l('truncate: cannot open \'' + f + '\' for writing: Read-only file system', 'e'); bad = 1; return; } if (!s.can(abs, 'w').ok) { o.l('truncate: cannot open \'' + f + '\' for writing: Permission denied', 'e'); bad = 1; return; } if (+size === 0 || size === '0') { LX.truncate(s.W, s.d, abs); } else { n.c = (n.c || '').slice(0, parseInt(size, 10)); delete n.sz; } r.mutated = true; });
  s.mut(r); return bad; };

function parseMode(spec, node) {
  if (/^[0-7]{1,4}$/.test(spec)) return spec.padStart(4, '0');
  const cur = LX.modeDigits(node.m); let bits = [cur[0], cur[1], cur[2]]; const special = String(node.m).padStart(4, '0')[0];
  const m = spec.split(',');
  for (const part of m) {
    const mm = part.match(/^([ugoa]*)([-+=])([rwxXst]*)$/); if (!mm) return null;
    const who = mm[1] || 'a'; const idx = []; if (who.indexOf('a') >= 0 || who.indexOf('u') >= 0) idx.push(0); if (who.indexOf('a') >= 0 || who.indexOf('g') >= 0) idx.push(1); if (who.indexOf('a') >= 0 || who.indexOf('o') >= 0) idx.push(2);
    let v = 0; if (mm[3].indexOf('r') >= 0) v |= 4; if (mm[3].indexOf('w') >= 0) v |= 2; if (mm[3].indexOf('x') >= 0 || (mm[3].indexOf('X') >= 0 && (node.t === 'd' || bits.some(b => b & 1)))) v |= 1;
    idx.forEach(i => { if (mm[2] === '+') bits[i] |= v; else if (mm[2] === '-') bits[i] &= ~v; else bits[i] = v; });
  }
  return special + bits.join('');
}
C.chmod = (s, a, o, r) => {
  const rec = a.some(x => x === '-R' || x === '--recursive'); const args = a.filter(x => x[0] !== '-' || /^-[rwxXst+=,ugo-]/.test(x) && !/^-[Rv]+$/.test(x) && /^-[rwxX]+$/.test(x));
  const plain = a.filter(x => !(x === '-R' || x === '-v' || x === '--recursive')); const spec = plain[0]; const files = plain.slice(1);
  if (!spec) { o.l('chmod: missing operand', 'e'); return 1; } if (!files.length) { o.l('chmod: missing operand after \'' + spec + '\'', 'e'); return 1; }
  let bad = 0; const d = s.d;
  const apply = (abs, shown) => { const n = d.fs[abs]; const nm = parseMode(spec, n); if (nm === null) { o.l('chmod: invalid mode: ‘' + spec + '’', 'e'); bad = 1; return false; } if (s.euser() !== 'root' && n.o !== s.euser()) { o.l('chmod: changing permissions of \'' + shown + '\': Operation not permitted', 'e'); bad = 1; return true; } if (d._rt.rootRO) { o.l('chmod: changing permissions of \'' + shown + '\': Read-only file system', 'e'); bad = 1; return true; } n.m = nm; r.mutated = true; return true; };
  files.forEach(f => { const abs = LX.resolve(d, s.abs(f)); const n = d.fs[abs]; if (!n) { o.l('chmod: cannot access \'' + f + '\': No such file or directory', 'e'); bad = 1; return; } if (!apply(abs, f)) return; if (rec && n.t === 'd') { const pre = abs === '/' ? '/' : abs + '/'; Object.keys(d.fs).filter(k => k.indexOf(pre) === 0).forEach(k => apply(k, f + k.slice(abs.length))); } });
  s.mut(r); return bad;
};
function ownerOp(cmd) {
  return (s, a, o, r) => {
    const rec = a.some(x => x === '-R'); const args = a.filter(x => x[0] !== '-'); if (args.length < 2) { o.l(cmd + ': missing operand' + (args.length ? ' after \'' + args[0] + '\'' : ''), 'e'); return 1; }
    const spec = args[0]; let own = null, grp = null; const d = s.d;
    if (cmd === 'chgrp') grp = spec; else { const m = spec.split(/[:.]/); own = m[0] || null; grp = m.length > 1 && m[1] ? m[1] : null; }
    if (own && !LX.user(d, own) && !/^\d+$/.test(own)) { o.l(cmd + ': invalid user: ‘' + spec + '’', 'e'); return 1; }
    if (grp && !LX.groups(d).find(x => x.name === grp) && !/^\d+$/.test(grp)) { o.l(cmd + ': invalid group: ‘' + spec + '’', 'e'); return 1; }
    let bad = 0;
    args.slice(1).forEach(f => { const abs = LX.resolve(d, s.abs(f)); const n = d.fs[abs]; if (!n) { o.l(cmd + ': cannot access \'' + f + '\': No such file or directory', 'e'); bad = 1; return; }
      const doit = (p, shown) => { const nd = d.fs[p]; if (s.euser() !== 'root' && (own && own !== nd.o)) { o.l(cmd + ': changing ownership of \'' + shown + '\': Operation not permitted', 'e'); bad = 1; return; } if (s.euser() !== 'root' && grp && (nd.o !== s.euser() || LX.groupsOf(d, s.euser()).indexOf(grp) < 0)) { o.l(cmd + ': changing group of \'' + shown + '\': Operation not permitted', 'e'); bad = 1; return; } if (d._rt.rootRO) { o.l(cmd + ': changing ownership of \'' + shown + '\': Read-only file system', 'e'); bad = 1; return; } if (own) nd.o = own; if (grp) nd.g = grp; r.mutated = true; };
      doit(abs, f); if (rec && n.t === 'd') { const pre = abs === '/' ? '/' : abs + '/'; Object.keys(d.fs).filter(k => k.indexOf(pre) === 0).forEach(k => doit(k, f + k.slice(abs.length))); } });
    s.mut(r); return bad;
  };
}
C.chown = ownerOp('chown'); C.chgrp = ownerOp('chgrp');
C.getfacl = (s, a, o, r) => {
  a.filter(x => x[0] !== '-').forEach((f, i) => {
    const abs = LX.resolve(s.d, s.abs(f)); const n = s.d.fs[abs] || (abs === '/' ? { t: 'd', m: '0755', o: 'root', g: 'root' } : null); if (!n) { o.l('getfacl: ' + f + ': No such file or directory', 'e'); r.ok = false; return; }
    if (i) o.blank(); const dg = LX.modeDigits(n.m); const sp = v => ((v & 4) ? 'r' : '-') + ((v & 2) ? 'w' : '-') + ((v & 1) ? 'x' : '-');
    o.l('# file: ' + f.replace(/^\//, '')); o.l('# owner: ' + n.o); o.l('# group: ' + n.g); o.l('user::' + sp(dg[0]));
    if (n.acl) { Object.keys(n.acl.users || {}).forEach(u => o.l('user:' + u + ':' + n.acl.users[u])); o.l('group::' + sp(dg[1])); Object.keys(n.acl.groups || {}).forEach(g2 => o.l('group:' + g2 + ':' + n.acl.groups[g2])); o.l('mask::' + (n.acl.mask || 'rwx')); } else o.l('group::' + sp(dg[1]));
    o.l('other::' + sp(dg[2])); o.blank();
  });
};
const pbits = p => (/r/.test(p || '') ? 4 : 0) | (/w/.test(p || '') ? 2 : 0) | (/x/.test(p || '') ? 1 : 0);
C.setfacl = (s, a, o, r) => {
  let mod = null, rm = null, clear = false; const files = [];
  let noRecalc = false;
  for (let i = 0; i < a.length; i++) { if (a[i] === '-m') mod = a[++i]; else if (a[i] === '-x') rm = a[++i]; else if (a[i] === '-b') clear = true; else if (a[i] === '-n') noRecalc = true; else if (a[i][0] !== '-') files.push(a[i]); }
  if (!files.length) { o.l('Usage: setfacl [-bkndRLP] { -m|-M|-x|-X ... } file ...', 'e'); return 2; } let bad = 0;
  files.forEach(f => { const abs = LX.resolve(s.d, s.abs(f)); const n = s.d.fs[abs]; if (!n) { o.l('setfacl: ' + f + ': No such file or directory', 'e'); bad = 1; return; } if (s.euser() !== 'root' && n.o !== s.euser()) { o.l('setfacl: ' + f + ': Operation not permitted', 'e'); bad = 1; return; } if (s.d._rt.rootRO) { o.l('setfacl: ' + f + ': Read-only file system', 'e'); bad = 1; return; }
    if (clear) { delete n.acl; r.mutated = true; return; } n.acl = n.acl || { users: {}, groups: {}, mask: 'rwx' }; n.acl.users = n.acl.users || {}; n.acl.groups = n.acl.groups || {};
    const each = (spec, fn) => spec.split(',').forEach(p => { const m = p.split(':'); fn(m[0], m[1], m[2]); });
    if (mod) each(mod, (kind, who, perm) => { if (kind === 'u' || kind === 'user') { if (who) n.acl.users[who] = perm; } else if (kind === 'g' || kind === 'group') { if (who) n.acl.groups[who] = perm; } else if (kind === 'm' || kind === 'mask') n.acl.mask = perm || who; });
    if (rm) each(rm, (kind, who) => { if (kind[0] === 'u') delete n.acl.users[who]; else if (kind[0] === 'g') delete n.acl.groups[who]; });
    /* comportement de setfacl (man setfacl) : sans -n ni entrée de masque explicite, le masque est recalculé (union des droits de la classe groupe) */
    const explicitMask = !!mod && mod.split(',').some(p => /^(m|mask):/.test(p));
    if (n.acl && !noRecalc && !explicitMask) { const dg = LX.modeDigits(n.m); let u = dg[1]; Object.keys(n.acl.users).forEach(k => { u |= pbits(n.acl.users[k]); }); Object.keys(n.acl.groups).forEach(k => { u |= pbits(n.acl.groups[k]); }); n.acl.mask = ((u & 4) ? 'r' : '-') + ((u & 2) ? 'w' : '-') + ((u & 1) ? 'x' : '-'); }
    if (!Object.keys(n.acl.users).length && !Object.keys(n.acl.groups).length) delete n.acl; r.mutated = true; });
  s.mut(r); return bad;
};

/* ------------------------------------------------------------------ comptes / identité */
C.id = (s, a, o) => { const u = a.find(x => x[0] !== '-') || s.euser(); const pw = LX.user(s.d, u); if (!pw) { o.l('id: ‘' + u + '’: no such user', 'e'); return 1; } const gs = LX.groupsOf(s.d, u); const gl = LX.groups(s.d); const gtxt = gs.map(n => { const g2 = gl.find(x => x.name === n); return (g2 ? g2.gid : '?') + '(' + n + ')'; }); o.l('uid=' + pw.uid + '(' + pw.name + ') gid=' + pw.gid + '(' + LX.groupName(s.d, pw.gid) + ') groups=' + gtxt.join(',')); };
C.whoami = (s, a, o) => { o.l(s.euser()); };
C.groups = (s, a, o) => { const u = a[0] || s.euser(); if (!LX.user(s.d, u)) { o.l('groups: ‘' + u + '’: no such user', 'e'); return 1; } o.l((a[0] ? a[0] + ' : ' : '') + LX.groupsOf(s.d, u).join(' ')); };
C.who = (s, a, o) => { const dt = new Date(s.loginAt); o.l(B.padR(s.user, 8) + ' ' + B.padR(s.tty, 12) + ' ' + dt.getUTCFullYear() + '-' + U.pad2(dt.getUTCMonth() + 1) + '-' + U.pad2(dt.getUTCDate()) + ' ' + E.frTime(dt).slice(0, 5) + (s.remote ? ' (' + s.remote.ip + ')' : '')); };
C.w = (s, a, o) => { const now = s.W.now(); const up = s.uptimeSec(); o.l(' ' + E.frTime(now) + ' up ' + B.uptimeTxt(up) + ',  1 user,  load average: 0.00, 0.01, 0.00'); o.l('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT'); const dt = new Date(s.loginAt); o.l(B.padR(s.user, 8) + ' ' + B.padR(s.tty, 8) + ' ' + B.padR(s.remote ? s.remote.ip : '-', 16) + ' ' + E.frTime(dt).slice(0, 5) + '    0.00s  0.01s  0.00s w'); };
C.last = (s, a, o) => { o.l(B.padR(s.user, 8) + ' ' + B.padR(s.tty, 12) + ' ' + B.padR(s.remote ? s.remote.ip : '', 16) + ' ' + DAY[new Date(s.loginAt).getUTCDay()] + ' ' + MON[new Date(s.loginAt).getUTCMonth()] + ' ' + String(new Date(s.loginAt).getUTCDate()).padStart(2, ' ') + ' ' + E.frTime(new Date(s.loginAt)).slice(0, 5) + '   still logged in'); o.blank(); o.l('wtmp begins ' + DAY[new Date(s.W.clock.base).getUTCDay()] + ' ' + MON[new Date(s.W.clock.base).getUTCMonth()] + ' 1 00:00:00 2026'); };
LxShell.prototype.uptimeSec = function () { const d = this.d; const b = d._rt.bootAt !== undefined ? d._rt.bootAt : -(12 * 86400 + 3 * 3600); return Math.max(0, Math.round(this.W.clock.elapsed - b)); };
B.uptimeTxt = sec => { const dd = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), mm = Math.floor(sec % 3600 / 60); return (dd ? dd + ' day' + (dd > 1 ? 's' : '') + ', ' : '') + (dd || hh ? hh + ':' + U.pad2(mm) : mm + ' min'); };
C.uptime = (s, a, o) => { const now = s.W.now(); const up = s.uptimeSec(); if (a.indexOf('-p') >= 0) { const dd = Math.floor(up / 86400), hh = Math.floor(up % 86400 / 3600), mm = Math.floor(up % 3600 / 60); o.l('up ' + [dd ? dd + ' day' + (dd > 1 ? 's' : '') : '', hh ? hh + ' hour' + (hh > 1 ? 's' : '') : '', mm + ' minute' + (mm !== 1 ? 's' : '')].filter(Boolean).join(', ')); return; } o.l(' ' + E.frTime(now) + ' up ' + B.uptimeTxt(up) + ',  1 user,  load average: 0.00, 0.01, 0.00'); };
C.uname = (s, a, o) => { const d = s.d; const host = d.hostname || d.name; if (a.indexOf('-a') >= 0) o.l('Linux ' + host + ' ' + d.kernel + ' ' + U.av('uname-string', '#1 SMP PREEMPT_DYNAMIC Debian ' + d.kernel.replace('+deb13-amd64', '-1')) + ' x86_64 GNU/Linux'); else if (a.indexOf('-r') >= 0) o.l(d.kernel); else if (a.indexOf('-n') >= 0) o.l(host); else if (a.indexOf('-m') >= 0) o.l('x86_64'); else o.l('Linux'); };
C.hostname = (s, a, o, r) => { const f = a.indexOf('-f') >= 0 || a.indexOf('--fqdn') >= 0; const dom = (s.d.hostname || '') + (f ? '.' + (N.searchList(s.W, s.d)[0] || 'localdomain') : ''); if (a.indexOf('-I') >= 0 || a.indexOf('-i') >= 0) { o.l(N.l3up(s.W, s.d).map(x => x.ip).join(' ') + ' '); return; } if (a.filter(x => x[0] !== '-').length) { o.l('hostname: you must be root to change the host name', 'e'); return 1; } o.l(dom); };
C.date = (s, a, o) => { const dt = s.W.nowOf(s.devId); const f = a.find(x => x[0] === '+'); if (f) { o.l(f.slice(1).replace(/%F/g, dt.getUTCFullYear() + '-' + U.pad2(dt.getUTCMonth() + 1) + '-' + U.pad2(dt.getUTCDate())).replace(/%T/g, E.frTime(dt)).replace(/%Y/g, dt.getUTCFullYear()).replace(/%m/g, U.pad2(dt.getUTCMonth() + 1)).replace(/%d/g, U.pad2(dt.getUTCDate())).replace(/%H/g, U.pad2(dt.getUTCHours())).replace(/%M/g, U.pad2(dt.getUTCMinutes())).replace(/%S/g, U.pad2(dt.getUTCSeconds())).replace(/%s/g, Math.floor(dt.getTime() / 1000))); return; } if (a.length && a[0][0] !== '-') { o.l('date: cannot set date: Operation not permitted', 'e'); return 1; } o.l(E.dateC(dt)); };
C.free = (s, a, o) => { const h = a.some(x => /h/.test(x)); const m = a.some(x => /m/.test(x)); const tot = 1964 * 1024, used = 412 * 1024, fr = 1020 * 1024, sh = 1024, bc = 560 * 1024, av = tot - used; const f = v => h ? B.hsize(v * 1024) + 'i' : m ? String(Math.round(v / 1024)) : String(v); o.l('               total        used        free      shared  buff/cache   available'); o.l('Mem:' + [tot, used, fr, sh, bc, av].map(v => B.padL(f(v), 12)).join('')); o.l('Swap:' + [1024 * 1024, 0, 1024 * 1024].map(v => B.padL(f(v), 12)).join('')); };
C.nproc = (s, a, o) => { o.l('2'); };
C.lscpu = (s, a, o) => { o.l('Architecture:                         x86_64'); o.l('CPU(s):                               2'); };
C.df = (s, a, o) => {
  const d = s.d; const h = a.some(x => /h/.test(x)); const T = a.some(x => /T/.test(x)); const rows = [];
  const mk = (src, k, mp, type) => { const dk = d.disk[k]; const size = dk.sizeMB * 1048576; const used = Math.round((dk.usedMB !== undefined ? dk.usedMB : dk.sizeMB * dk.usePct / 100) * 1048576); const avail = Math.max(0, size - used); rows.push({ src, type, size, used, avail, pct: dk.usePct + '%', mp }); };
  rows.push({ src: 'udev', type: 'devtmpfs', size: 987 * 1048576, used: 0, avail: 987 * 1048576, pct: '0%', mp: '/dev' });
  rows.push({ src: 'tmpfs', type: 'tmpfs', size: 197 * 1048576, used: 1.2 * 1048576 | 0, avail: 196 * 1048576, pct: '1%', mp: '/run' });
  mk('/dev/sda1', 'root', '/', 'ext4'); if (d.disk.var) mk('/dev/sdb1', 'var', '/var', 'ext4');
  rows.push({ src: 'tmpfs', type: 'tmpfs', size: 984 * 1048576, used: 0, avail: 984 * 1048576, pct: '0%', mp: '/dev/shm' });
  rows.push({ src: 'tmpfs', type: 'tmpfs', size: 5 * 1048576, used: 0, avail: 5 * 1048576, pct: '0%', mp: '/run/lock' });
  const hd = rows.map(r => ({ src: r.src, type: r.type, size: h ? B.hsize(r.size) : String(Math.ceil(r.size / 1024)), used: h ? B.hsize(r.used) : String(Math.ceil(r.used / 1024)), avail: h ? B.hsize(r.avail) : String(Math.floor(r.avail / 1024)), pct: r.pct, mp: r.mp }));
  const w = (k, hdr) => Math.max(hdr.length, ...hd.map(r => String(r[k]).length));
  const ws = w('src', 'Filesystem'), wt = w('type', 'Type'), wz = w('size', h ? 'Size' : '1K-blocks'), wu = w('used', 'Used'), wa = w('avail', 'Avail');
  o.l(B.padR('Filesystem', ws) + ' ' + (T ? B.padR('Type', wt) + ' ' : '') + B.padL(h ? 'Size' : '1K-blocks', wz) + ' ' + B.padL('Used', wu) + ' ' + B.padL('Avail', wa) + ' Use% Mounted on');
  hd.forEach(r => o.l(B.padR(r.src, ws) + ' ' + (T ? B.padR(r.type, wt) + ' ' : '') + B.padL(r.size, wz) + ' ' + B.padL(r.used, wu) + ' ' + B.padL(r.avail, wa) + ' ' + B.padL(r.pct, 4) + ' ' + r.mp));
};
C.du = (s, a, o, r) => {
  const sum = a.some(x => /s/.test(x) && x[0] === '-'); const h = a.some(x => /h/.test(x) && x[0] === '-'); const targets = a.filter(x => x[0] !== '-'); if (!targets.length) targets.push('.'); const d = s.d; let depth = Infinity; a.forEach(x => { const m = x.match(/^--max-depth=(\d+)$/); if (m) depth = +m[1]; if (x === '-d') depth = +a[a.indexOf(x) + 1]; });
  const sizeOf = (p) => { const n = d.fs[p]; if (!n) return 0; if (n.t !== 'd') return B.nodeSize(n); let t = 4096; LX.list(d, p).forEach(nm => { t += sizeOf(LX.norm(nm, p)); }); return t; };
  const fmt = v => h ? B.hsize(v) : String(Math.ceil(v / 1024));
  let bad = 0;
  const walk = (p, shown, lvl) => { const n = d.fs[p]; if (n && n.t === 'd' && !s.can(p, 'r').ok) { o.l('du: cannot read directory \'' + shown + '\': Permission denied', 'e'); bad = 1; return; } if (n && n.t === 'd' && !sum && lvl < depth) LX.list(d, p).forEach(nm => { const q = LX.norm(nm, p); if (d.fs[q] && d.fs[q].t === 'd') walk(q, shown.replace(/\/$/, '') + '/' + nm, lvl + 1); }); o.l(fmt(sizeOf(p)) + '\t' + shown); };
  targets.forEach(t => { const abs = LX.resolve(d, s.abs(t)); if (!d.fs[abs] && abs !== '/') { o.l('du: cannot access \'' + t + '\': No such file or directory', 'e'); bad = 1; return; } walk(abs, t, 0); });
  return bad;
};
C.lsblk = (s, a, o) => { const d = s.d; o.l('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS'); const gb = k => B.hsize(d.disk[k].sizeMB * 1048576); o.l('sda      8:0    0   ' + B.padL(gb('root'), 3) + ' 0 disk '); o.l('└─sda1   8:1    0   ' + B.padL(gb('root'), 3) + ' 0 part /'); if (d.disk.var) { o.l('sdb      8:16   0    ' + B.padL(gb('var'), 2) + ' 0 disk '); o.l('└─sdb1   8:17   0    ' + B.padL(gb('var'), 2) + ' 0 part /var'); } };
C.blkid = (s, a, o) => { const d = s.d; if (s.euser() !== 'root') return 2; o.l('/dev/sda1: UUID="' + d.disk.root.uuid + '" BLOCK_SIZE="4096" TYPE="' + d.disk.root.fstype + '" PARTUUID="' + U.hash8(d.id + 'a') + '-01"'); if (d.disk.var) o.l('/dev/sdb1: UUID="' + d.disk.var.uuid + '" BLOCK_SIZE="4096" TYPE="' + d.disk.var.fstype + '" PARTUUID="' + U.hash8(d.id + 'b') + '-01"'); if (d.swapUuid) o.l('/dev/sda2: UUID="' + d.swapUuid + '" TYPE="swap" PARTUUID="' + U.hash8(d.id + 'c') + '-02"'); };
C.findmnt = (s, a, o) => { const d = s.d; o.l('TARGET SOURCE    FSTYPE OPTIONS'); o.l('/      /dev/sda1 ext4   ' + (d._rt.rootRO ? 'ro' : 'rw') + ',relatime,errors=remount-ro'); if (d.disk.var) o.l('/var   /dev/sdb1 ext4   rw,relatime'); };
C.mount = (s, a, o, r) => {
  const d = s.d;
  if (!a.length) { o.l('sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)'); o.l('proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)'); o.l('udev on /dev type devtmpfs (rw,nosuid,relatime,size=1010592k,nr_inodes=252648,mode=755)'); o.l('/dev/sda1 on / type ext4 (' + (d._rt.rootRO ? 'ro' : 'rw') + ',relatime,errors=remount-ro)'); if (d.disk.var && !d._rt.emergency) o.l('/dev/sdb1 on /var type ext4 (rw,relatime)'); return; }
  if (s.euser() !== 'root') { o.l('mount: only root can do that', 'e'); return 1; }
  if (a.indexOf('-a') >= 0) { const bc = LX.bootCheck(d, true); if (!bc.ok) { bc.errs.forEach(e => { if (e.kind === 'device') o.l('mount: ' + e.mp + ': special device UUID=' + e.uuid + ' does not exist.', 'e'); else o.l(e.msg, 'e'); }); return 32; } if (d.disk.var) { /* montage effectif */ } return 0; }
  const oi = a.indexOf('-o'); if (oi >= 0 && /remount/.test(a[oi + 1] || '')) { const rw = /rw/.test(a[oi + 1]); const tgt = a[a.length - 1]; if (tgt === '/' ) { d._rt.rootRO = !rw; r.mutated = true; s.env.touch('mount'); return 0; } return 0; }
  o.l('mount: ' + a[a.length - 1] + ': mount point does not exist.', 'e'); return 32;
};
C.umount = (s, a, o) => { if (s.euser() !== 'root') { o.l('umount: ' + (a[0] || '') + ': must be superuser to unmount.', 'e'); return 1; } };
C.ps = (s, a, o) => {
  const d = s.d; const W = s.W; const rows = []; const t0 = d._rt.bootAt !== undefined ? d._rt.bootAt : -(12 * 86400 + 3 * 3600);
  const start = ms => { const x = new Date(ms); const today = W.now().getUTCDate() === x.getUTCDate(); return today ? U.pad2(x.getUTCHours()) + ':' + U.pad2(x.getUTCMinutes()) : MON[x.getUTCMonth()] + U.pad2(x.getUTCDate()); };
  const bootMs = W.clock.base + t0 * 1000;
  rows.push({ u: 'root', pid: 1, cpu: '0.0', mem: '0.4', vsz: 22160, rss: 12288, tty: '?', stat: 'Ss', st: start(bootMs), cmd: '/sbin/init' });
  rows.push({ u: 'root', pid: 189, cpu: '0.0', mem: '0.7', vsz: 63896, rss: 14336, tty: '?', stat: 'Ss', st: start(bootMs), cmd: '/usr/lib/systemd/systemd-journald' });
  rows.push({ u: 'root', pid: 221, cpu: '0.0', mem: '0.3', vsz: 33112, rss: 6912, tty: '?', stat: 'Ss', st: start(bootMs), cmd: '/usr/lib/systemd/systemd-udevd' });
  Object.keys(d.svc).forEach(k => { const run = LX.svcRun(d, k); if (!run || d.svc[k].state !== 'active') return; const def = LX.SERVICES[k]; const user = k === 'mariadb' ? 'mysql' : k === 'bind9' ? 'bind' : k === 'apache2' || k === 'nginx' ? 'root' : 'root'; rows.push({ u: user, pid: run.pid, cpu: '0.0', mem: '1.2', vsz: 98000, rss: 24000, tty: '?', stat: 'Ss', st: start(run.since), cmd: def.exec.replace(/^\/usr\/sbin\/apachectl start$/, '/usr/sbin/apache2 -k start') });
    if (k === 'apache2') for (let i = 1; i <= 2; i++) rows.push({ u: 'www-data', pid: run.pid + i, cpu: '0.0', mem: '0.6', vsz: 1950000, rss: 8200, tty: '?', stat: 'S', st: start(run.since), cmd: '/usr/sbin/apache2 -k start' });
    if (k === 'nginx') rows.push({ u: 'www-data', pid: run.pid + 1, cpu: '0.0', mem: '0.4', vsz: 56000, rss: 5200, tty: '?', stat: 'S', st: start(run.since), cmd: 'nginx: worker process' }); });
  rows.push({ u: s.user, pid: 3120, cpu: '0.0', mem: '0.2', vsz: 8200, rss: 5400, tty: s.tty, stat: 'Ss', st: start(s.loginAt), cmd: '-bash' });
  rows.push({ u: s.euser(), pid: 3399, cpu: '0.0', mem: '0.1', vsz: 11000, rss: 4300, tty: s.tty, stat: 'R+', st: start(W.now().getTime()), cmd: 'ps ' + a.join(' ') });
  const aux = a.some(x => /a|e|x/.test(x)) || true; const vis = rows.filter(r => a.some(x => /[aeAx]/.test(x.replace(/^-/, ''))) ? true : r.u === s.euser());
  const wide = a.some(x => /f/.test(x) && x[0] === '-' ) ;
  if (wide) { o.l('UID          PID    PPID  C STIME TTY          TIME CMD'); vis.forEach(r => o.l(B.padR(r.u, 8) + B.padL(r.pid, 8) + B.padL(r.pid === 1 ? 0 : 1, 8) + '  0 ' + B.padR(r.st, 5) + ' ' + B.padR(r.tty, 8) + '   00:00:00 ' + r.cmd)); return; }
  if (!a.some(x => /[aeAxu]/.test(x))) { o.l('    PID TTY          TIME CMD'); vis.filter(r => r.tty !== '?').forEach(r => o.l(B.padL(r.pid, 7) + ' ' + B.padR(r.tty, 8) + '    00:00:00 ' + r.cmd.replace(/^-/, ''))); return; }
  o.l('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND'); vis.forEach(r => o.l(B.padR(r.u, 10) + B.padL(r.pid, 6) + B.padL(r.cpu, 5) + B.padL(r.mem, 5) + B.padL(r.vsz, 7) + B.padL(r.rss, 6) + ' ' + B.padR(r.tty, 8) + ' ' + B.padR(r.stat, 4) + ' ' + B.padR(r.st, 6) + ' ' + B.padL('0:00', 6) + ' ' + r.cmd));
};
C.kill = (s, a, o) => { o.l('bash: kill: (' + (a.filter(x => x[0] !== '-')[0] || '') + ') - Operation not permitted', 'e'); return 1; };
C.top = (s, a, o) => { o.l('top - ' + E.frTime(s.W.now()) + ' up ' + B.uptimeTxt(s.uptimeSec()) + ',  1 user,  load average: 0.00, 0.01, 0.00'); o.l('Tasks:  98 total,   1 running,  97 sleeping,   0 stopped,   0 zombie'); o.l('%Cpu(s):  0.3 us,  0.2 sy,  0.0 ni, 99.5 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st'); o.l('MiB Mem :   1964.0 total,   1020.0 free,    412.0 used,    560.0 buff/cache'); };
/* saisie d'un mot de passe avec 3 essais : check(line) → bool ; onOk() → résultat */
B.askPassword = function (prompt, check, onOk, failMsg, giveUp, user) {
  const mk = (tries) => ({ prompt, echo: false, user, cb: (line) => {
    if (check(line)) return onOk();
    const n = tries + 1; const out = new E.Out();
    if (n >= 3) { out.l(giveUp, 'e'); return { out: out.lines, ok: false }; }
    if (failMsg) out.l(failMsg, 'e');
    return { out: out.lines, ask: mk(n) };
  } });
  return mk(0);
};
C.sudo = (s, a, o, r) => {
  const d = s.d; if (!a.length) { o.l('usage: sudo -h | -K | -k | -V', 'e'); return 1; }
  let i = 0; let asUser = 'root'; let login = false; let list = false; let shell = false;
  while (i < a.length && a[i][0] === '-') { const x = a[i]; if (x === '-u') asUser = a[++i]; else if (x === '-i') login = true; else if (x === '-s') shell = true; else if (x === '-l') list = true; i++; }
  const rest = a.slice(i);
  const go = () => {
    if (list) { const out = new E.Out(); out.l('Matching Defaults entries for ' + s.user + ' on ' + s.host() + ':'); out.l('    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin, use_pty'); out.blank(); out.l('User ' + s.user + ' may run the following commands on ' + s.host() + ':'); out.l('    (ALL : ALL) ALL'); return { out: out.lines }; }
    if (!LX.user(d, asUser)) return { out: [L('sudo: unknown user ' + asUser, 'e')], ok: false };
    if (login || shell || !rest.length) { s.stack.push({ eff: s.eff, user: s.user, cwd: s.cwd }); s.eff = asUser; if (login) s.cwd = (LX.user(d, asUser) || {}).home || '/'; return { out: [] }; }
    const prev = s.eff; s.eff = asUser; let res; try { res = s.runLine(rest.map(x => /\s|[*?'"$|;&<>]/.test(x) ? "'" + x.replace(/'/g, "'\\''") + "'" : x).join(' '), {}); } finally { s.eff = prev; }
    return res;
  };
  const merge = (x) => { x.out.forEach(l => o.lines.push(l)); ['mutated', 'push', 'stream', 'edit', 'pager', 'ask', 'clear', 'exit', 'launch'].forEach(k => { if (x[k] !== undefined) r[k] = x[k]; }); if (x.ok === false) r.status = 1; };
  if (s.user === 'root' && !s.eff) return merge(go());
  if (!s.sudoOk()) {
    r.ask = B.askPassword('[sudo] password for ' + s.user + ': ', l => (d.pwds || {})[s.user] === l, () => ({ out: [L(U.av('sudo-not-in-sudoers', s.user + ' is not in the sudoers file.'), 'e')], ok: false }), 'Sorry, try again.', 'sudo: 3 incorrect password attempts');
    return;
  }
  if (s.sudoUntil >= s.W.clock.elapsed) return merge(go());
  r.ask = B.askPassword('[sudo] password for ' + s.user + ': ', l => (d.pwds || {})[s.user] === l, () => { s.sudoUntil = s.W.clock.elapsed + 900; return go(); }, 'Sorry, try again.', 'sudo: 3 incorrect password attempts');
};
C.su = (s, a, o, r) => {
  const d = s.d; const login = a.some(x => x === '-' || x === '-l' || x === '--login'); const target = a.filter(x => x[0] !== '-')[0] || 'root';
  if (!LX.user(d, target)) { o.l('su: user ' + target + ' does not exist or the user entry does not contain all the required fields', 'e'); return 1; }
  const enter = () => { s.stack.push({ eff: s.eff, user: s.user, cwd: s.cwd }); s.eff = target; if (login) s.cwd = LX.user(d, target).home; return { out: [] }; };
  if (s.euser() === 'root') { const x = enter(); return; }
  r.ask = B.askPassword('Password: ', l => (d.pwds || {})[target] === l, enter, 'su: Authentication failure', 'su: Authentication failure', target);
};
C.passwd = (s, a, o) => { o.l('passwd: Authentication token manipulation error', 'e'); o.l('passwd: password unchanged', 'e'); return 10; };
C.gzip = (s, a, o, r) => { const f = a.filter(x => x[0] !== '-')[0]; if (!f) return; const x = s.readFile(s.abs(f)); if (x.err) { o.l('gzip: ' + f + ': ' + x.err, 'e'); return 1; } const e = s.writeFile(s.abs(f) + '.gz', '\x1f\x8b' + x.text, false); if (e) { o.l('gzip: ' + f + '.gz: ' + e, 'e'); return 1; } LX.rm(s.d, LX.resolve(s.d, s.abs(f))); s.mut(r); };
C.zcat = (s, a, o) => { const x = s.readFile(s.abs(a[0] || '')); if (x.err) { o.l('gzip: ' + a[0] + ': ' + x.err, 'e'); return 1; } x.text.replace(/^\x1f\x8b/, '').split('\n').forEach(l => o.l(l)); };
C.zgrep = (s, a, o) => { o.l('zgrep: non pris en charge dans cette simulation', 'e'); return 2; };
C.logger = (s, a, o) => { LX.jlog(s.W, s.d, 'user', s.euser(), a.filter(x => x[0] !== '-').join(' '), 6); s.env.touch('log'); };
C.dmesg = (s, a, o) => { if (s.euser() !== 'root') { o.l('dmesg: read kernel buffer failed: Operation not permitted', 'e'); return 1; } o.l(U.av('dmesg-lines', '[    0.000000] Linux version ' + s.d.kernel + ' (debian-kernel@lists.debian.org)')); o.l('[    1.842310] EXT4-fs (sda1): mounted filesystem with ordered data mode. Quota mode: none.'); };
C.tput = () => 0; C.reset = (s, a, o, r) => { r.clear = true; };
C.wait = () => 0; C.read = () => 0;
C.xargs = (s, a, o, r, st) => { const cmd = a.length ? a : ['echo']; const x = s.runLine(cmd.join(' ') + ' ' + (st.in || []).join(' '), {}); x.out.forEach(l => o.lines.push(l)); if (x.mutated) r.mutated = true; };

B.sbin = B.sbin || {};
/* commandes connues pour le contrôle statique des scripts (LX.shCheck) : celles de l'émulateur + quelques programmes courants non simulés */
const SCRIPT_KNOWN = ['mysqldump', 'mysql', 'gzip', 'gunzip', 'zcat', 'tar', 'rsync', 'scp', 'ssh', 'logger', 'mail', 'tee', 'basename', 'dirname', 'date', 'sleep', 'find', 'xargs', 'curl', 'wget', 'local', 'read', 'return', 'exit', 'set', 'shift', 'trap', 'declare', 'eval', 'exec', 'let', 'getopts', 'break', 'continue', 'source', '.', ':', 'true', 'false', 'test', 'export', 'unset', 'echo', 'printf', 'cd', 'pwd', 'alias', 'umask', 'wait', 'hash', 'mktemp', 'sync', 'nice', 'ionice', 'flock', 'timeout', 'systemctl', 'service', 'apt', 'apt-get', 'dpkg'];
LX.knownCmd = n => !!(C[n] || B.sbin[n] || (B.sbinUser && B.sbinUser[n] !== undefined) || SCRIPT_KNOWN.indexOf(n) >= 0);
})(typeof globalThis !== 'undefined' ? globalThis : window);
