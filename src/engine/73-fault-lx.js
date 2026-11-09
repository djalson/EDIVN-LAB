/* ============================================================================
   Linux — compléments du moteur : espace disque calculé, démarrage (fstab → mode d'urgence),
   cron (analyse, évaluation, exécution planifiée), accès MariaDB (comptes @hôte), sondes de
   configuration / fichier / pare-feu / cron / base, étapes d'injection spécifiques.
   Les messages dont le libellé exact est incertain passent par U.av (docs/A-VERIFIER.md).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, LX = SIM.lx;
const P = SIM.probes = SIM.probes || {}; const S = SIM.steps;

/* ------------------------------------------------------------------ espace disque */
/* Montages connus : /var (si présent) sinon tout dans la racine. Chaque fichier peut déclarer sa taille en Mo (`sz`). */
LX.mountOf = (d, path) => (d.disk && d.disk.var && path.indexOf('/var/') === 0) ? 'var' : 'root';
LX.recalcDisk = function (d) {
  if (!d.disk) return;
  const sums = {};
  for (const p of Object.keys(d.fs)) { const n = d.fs[p]; if (n.sz) { const m = LX.mountOf(d, p); sums[m] = (sums[m] || 0) + n.sz; } }
  for (const k of Object.keys(d.disk)) {
    const dk = d.disk[k]; if (dk.baseMB === undefined) continue;
    dk.usedMB = dk.baseMB + (sums[k] || 0);
    dk.usePct = Math.min(100, Math.round(100 * dk.usedMB / dk.sizeMB));
  }
};
const rm0 = LX.rm;
LX.rm = function (d, p) { rm0(d, p); LX.recalcDisk(d); };
LX.truncate = function (W, d, p) { const r = LX.resolve(d, LX.norm(p)); const n = d.fs[r]; if (!n || n.t !== 'f') return false; n.c = ''; n.sz = 0; n.mt = W.now().getTime(); LX.recalcDisk(d); W.touch('fs'); return true; };

/* ------------------------------------------------------------------ démarrage : fstab */
SIM.AVREG['boot-emergency'] = 'Messages systemd d’un démarrage qui échoue sur un montage fstab (délai « Timed out waiting for device », « Dependency failed for … », shell de secours) : libellés repris de mémoire, à vérifier sur Debian 13.';
LX.fstab = function (d) {
  const out = [];
  for (const L of LX.lines(LX.readFile(d, '/etc/fstab'))) {
    if (!L.t) continue; const f = L.t.split(/\s+/); if (f.length < 4) { out.push({ n: L.n, raw: L.raw, bad: true }); continue; }
    out.push({ n: L.n, spec: f[0], mp: f[1], type: f[2], opts: f[3].split(','), dump: f[4], pass: f[5], raw: L.raw });
  }
  return out;
};
LX.bootCheck = function (d, strict) {
  const errs = []; const uuids = Object.keys(d.disk || {}).map(k => ({ k, uuid: d.disk[k].uuid, fstype: d.disk[k].fstype }));
  for (const e of LX.fstab(d)) {
    if (e.bad) { errs.push({ n: e.n, kind: 'syntax', msg: U.av('boot-emergency', '/etc/fstab: ligne ' + e.n + ' mal formée') }); continue; }
    if (e.type === 'swap' || e.opts.indexOf('noauto') >= 0) continue;
    const nofail = !strict && e.opts.indexOf('nofail') >= 0;
    const m = e.spec.match(/^UUID=(.+)$/i);
    if (m) {
      const disk = uuids.find(x => x.uuid === m[1]);
      if (!disk) { if (!nofail) errs.push({ n: e.n, kind: 'device', mp: e.mp, uuid: m[1], msg: 'Timed out waiting for device /dev/disk/by-uuid/' + m[1] }); continue; }
      if (disk.fstype !== e.type) { if (!nofail) errs.push({ n: e.n, kind: 'fstype', mp: e.mp, msg: 'mount: ' + e.mp + ': wrong fs type, bad option, bad superblock on /dev/' + disk.k + ', missing codepage or helper program, or other error.' }); continue; }
    } else if (/^\/dev\//.test(e.spec)) { if (!nofail) errs.push({ n: e.n, kind: 'device', mp: e.mp, msg: 'Timed out waiting for device ' + e.spec }); continue; }
    if (e.mp !== '/' && !LX.isDir(d, e.mp)) { if (!nofail) errs.push({ n: e.n, kind: 'mountpoint', mp: e.mp, msg: 'mount: ' + e.mp + ': mount point does not exist.' }); }
  }
  return { ok: errs.length === 0, errs };
};
const boot0 = LX.boot;
LX.boot = function (W, d) {
  d._rt.emergency = false; d._rt.svcRun = {};
  const bc = LX.bootCheck(d);
  if (!bc.ok) {
    d._rt.emergency = true;
    Object.keys(d.svc).forEach(k => { d.svc[k].state = 'inactive'; d.svc[k].sub = 'dead'; });
    for (const e of bc.errs) {
      if (e.kind === 'device') {
        const dev = 'dev-disk-by\\x2duuid-' + e.uuid.replace(/-/g, '\\x2d') + '.device';
        LX.jlog(W, d, 'systemd', 'systemd', dev + ': Job ' + dev + '/start timed out.', 3);
        LX.jlog(W, d, 'systemd', 'systemd', 'Timed out waiting for device ' + dev.replace('.device', '') + ' - /dev/disk/by-uuid/' + e.uuid + '.', 3);
      } else LX.jlog(W, d, 'systemd', 'systemd', e.msg, 3);
      if (e.mp) LX.jlog(W, d, 'systemd', 'systemd', 'Dependency failed for ' + e.mp.replace(/^\//, '').replace(/\//g, '-') + '.mount - ' + e.mp + '.', 3);
    }
    LX.jlog(W, d, 'systemd', 'systemd', 'Dependency failed for local-fs.target - Local File Systems.', 3);
    LX.jlog(W, d, 'systemd', 'systemd', "local-fs.target: Job local-fs.target/start failed with result 'dependency'.", 3);
    LX.jlog(W, d, 'systemd', 'systemd', 'Starting emergency.service - Emergency Shell...', 6);
    W.touch('boot'); return;
  }
  boot0(W, d);
  if (W.clock.elapsed > 0) { d._rt.bootAt = W.clock.elapsed; d._rt.rootRO = false; LX.netApply(W, d); }
};
/* hors service réseau en mode d'urgence : aucune interface configurée */
LX.emergencyMsg = U.av('boot-emergency', 'You are in emergency mode. After logging in, type "journalctl -xb" to view system logs, "systemctl reboot" to reboot, or "exit" to continue bootup.');

/* ------------------------------------------------------------------ cron */
SIM.AVREG['cron-insecure'] = 'Message de cron pour un fichier de /etc/cron.d modifiable par le groupe ou les autres : « INSECURE MODE (group/other writable) » — libellé à vérifier sur Debian 13.';
SIM.AVREG['cron-nomta'] = 'Ligne syslog de cron quand la tâche produit une sortie et qu’aucun MTA n’est installé : « (CRON) info (No MTA installed, discarding output) » — à vérifier sur Debian 13.';
SIM.AVREG['cron-shell-err'] = 'Messages d’erreur du shell lancé par cron (dash : « /bin/sh: 1: <cmd>: Permission denied » / « not found ») — à vérifier sur Debian 13.';
LX.CRON_NAME_OK = /^[A-Za-z0-9_-]+$/;
LX.cronJobs = function (d) {
  const jobs = []; const ignored = [];
  const parse = (file, text, sys, user) => {
    for (const L of LX.lines(text)) {
      if (!L.t || /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(L.t)) continue;
      const f = L.t.split(/\s+/); const need = sys ? 7 : 6; if (f.length < need) continue;
      const u = sys ? f[5] : user; const cmd = f.slice(sys ? 6 : 5).join(' ');
      jobs.push({ file, line: L.n, min: f[0], hour: f[1], dom: f[2], mon: f[3], dow: f[4], user: u, cmd });
    }
  };
  const ct = LX.readFile(d, '/etc/crontab'); if (ct !== null) parse('/etc/crontab', ct, true);
  for (const f of LX.list(d, '/etc/cron.d')) {
    const p = '/etc/cron.d/' + f; const n = d.fs[p]; if (!n || n.t !== 'f') continue;
    if (!LX.CRON_NAME_OK.test(f)) { ignored.push({ file: p, why: 'name' }); continue; }
    parse(p, n.c, true);
  }
  for (const u of LX.list(d, '/var/spool/cron/crontabs')) { const p = '/var/spool/cron/crontabs/' + u; const n = d.fs[p]; if (n && n.t === 'f') parse(p, n.c, false, u); }
  return { jobs, ignored };
};
const fieldMatch = (spec, v, lo, hi) => spec.split(',').some(part => {
  const m = part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/); if (!m) return false;
  let a = lo, b = hi; if (m[1] !== '*') { const r = m[1].split('-'); a = +r[0]; b = r[1] !== undefined ? +r[1] : a; if (m[2] === undefined && r[1] === undefined) return v === a; }
  const step = m[2] ? +m[2] : 1; return v >= a && v <= b && ((v - a) % step === 0);
});
LX.cronMatch = (j, dt) => fieldMatch(j.min, dt.getUTCMinutes(), 0, 59) && fieldMatch(j.hour, dt.getUTCHours(), 0, 23) && fieldMatch(j.mon, dt.getUTCMonth() + 1, 1, 12)
  && (j.dom === '*' || j.dow === '*' ? (fieldMatch(j.dom, dt.getUTCDate(), 1, 31) && fieldMatch(j.dow, dt.getUTCDay(), 0, 7)) : (fieldMatch(j.dom, dt.getUTCDate(), 1, 31) || fieldMatch(j.dow, dt.getUTCDay(), 0, 7)));
const SYS_BIN = /^\/(usr\/)?(local\/)?(s?bin)\//;
const INTERP = ['/bin/bash', '/bin/sh', '/bin/dash', '/usr/bin/bash', '/usr/bin/env', '/usr/bin/python3', '/usr/bin/perl'];
/* ------------------------------------------------------------------ contrôle statique d'un script shell (bash -n + commandes inconnues)
   Pas d'interpréteur : détection des guillemets non fermés, des blocs if/for/while/case non fermés ou mal fermés
   et des commandes introuvables (premier mot d'une instruction). LX.knownCmd(nom) est fourni par l'émulateur bash. */
SIM.AVREG['bash-script-errors'] = 'Messages de bash pour un script erroné (« script: line N: unexpected EOF while looking for matching `"\' », « syntax error: unexpected end of file », « DEST: command not found ») : formes reconnues de bash 5.2, numéros de ligne rapportés à confirmer par essai sur une vraie Debian 13.';
const SH_KW = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'in', 'function', 'select', 'time', '!', '{', '}'];
const SH_OPEN = { if: 'fi', for: 'done', while: 'done', until: 'done', case: 'esac' };
LX.shCheck = function (text, path) {
  const known = LX.knownCmd || (() => true);
  const lines = String(text || '').replace(/\r/g, '').split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const total = lines.length; const stack = []; let quote = null, qLine = 0;
  const stmts = [];
  for (let i = 0; i < total; i++) {
    const ln = lines[i]; let code = ''; let k = 0;
    while (k < ln.length) {
      const c = ln[k];
      if (quote) { if (c === '\\' && quote === '"') { k += 2; code += '  '; continue; } if (c === quote) quote = null; code += 'x'; k++; continue; }
      if (c === '\\') { k += 2; code += 'xx'; continue; }
      if (c === '#' && (k === 0 || /\s/.test(ln[k - 1]))) break;
      if (c === '"' || c === "'") { quote = c; qLine = i + 1; code += 'x'; k++; continue; }
      code += c; k++;
    }
    stmts.push({ n: i + 1, code });
  }
  if (quote) return { stage: 'syntax', line: total + 1, msg: path + ': line ' + total + ': unexpected EOF while looking for matching `' + quote + "'", msg2: path + ': line ' + (total + 1) + ': syntax error: unexpected end of file' };
  for (const st of stmts) {
    const parts = st.code.split(/;;|&&|\|\||[;|&\n(){}]/);
    for (let part of parts) {
      let w = part.trim().split(/\s+/).filter(Boolean); if (!w.length) continue;
      while (w.length && ['then', 'else', 'elif', 'do', '!', 'time'].indexOf(w[0]) >= 0) w.shift();
      if (!w.length) continue;
      const first = w[0];
      if (SH_OPEN[first]) { stack.push({ kw: first, line: st.n }); }
      else if (first === 'fi' || first === 'done' || first === 'esac') {
        const top = stack.pop(); if (!top || SH_OPEN[top.kw] !== first) return { stage: 'syntax', line: st.n, msg: path + ': line ' + st.n + ": syntax error near unexpected token `" + first + "'", msg2: path + ': line ' + st.n + ": `" + st.code.trim() + "'" };
      }
      if (SH_KW.indexOf(first) >= 0) continue;
      if (/^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/.test(first) || /^\$/.test(first) || /^[0-9]*[<>]/.test(first) || first[0] === '/' || first[0] === '.' || first[0] === '[' || first[0] === '~' || first[0] === '-') continue;
      if (/\(\)$/.test(first) || (w[1] && w[1] === '()')) continue;
      if (/^[a-z]+\(\)/.test(st.code.trim())) continue;
      if (!known(first)) return { stage: 'cmd', line: st.n, msg: path + ': line ' + st.n + ': ' + first + ': command not found', cmd: first };
    }
  }
  if (stack.length) return { stage: 'syntax', line: total + 1, msg: path + ': line ' + (total + 1) + ': syntax error: unexpected end of file' };
  return null;
};
LX.cronEval = function (W, d, job) {
  const base = { job };
  if (!LX.svcRun(d, 'cron') || d.svc.cron.state !== 'active') return Object.assign(base, { ok: false, stage: 'service', msg: 'cron.service n’est pas actif' });
  const fn = d.fs[job.file];
  if (fn && job.file.indexOf('/etc/cron.d/') === 0) {
    const dg = LX.modeDigits(fn.m);
    if (fn.o !== 'root' || (dg[1] & 2) || (dg[2] & 2)) return Object.assign(base, { ok: false, stage: 'insecure', msg: '(*system*' + LX.basename(job.file) + ') ' + U.av('cron-insecure', 'INSECURE MODE (group/other writable)') });
  }
  const tok = job.cmd.split(/\s+/)[0];
  if (tok[0] !== '/' || SYS_BIN.test(tok)) return Object.assign(base, { ok: true, system: true });
  const sh = (m) => U.av('cron-shell-err', '/bin/sh: 1: ' + tok + ': ' + m);
  const r = LX.resolve(d, LX.norm(tok)); const n = d.fs[r];
  if (!n || n.t !== 'f') return Object.assign(base, { ok: false, stage: 'exec', msg: sh('not found'), bash: 'bash: ' + tok + ': No such file or directory' });
  const acc = LX.access(d, job.user, r, 'x');
  if (!acc.ok) return Object.assign(base, { ok: false, stage: 'exec', msg: sh('Permission denied'), bash: 'bash: ' + tok + ': Permission denied' });
  const first = (n.c || '').split('\n')[0];
  if (/^#!/.test(first)) {
    const interp = first.slice(2).replace(/^[ \t]+/, '').split(/[ \t]+/)[0];
    if (INTERP.indexOf(interp) < 0) return Object.assign(base, { ok: false, stage: 'exec', msg: sh('not found'), bash: 'bash: ' + tok + ': ' + interp.replace(/\r/g, '^M') + ': bad interpreter: No such file or directory', badInterp: interp });
  }
  if (/^#!\s*\/(usr\/)?bin\/(env\s+)?(ba)?sh/.test(first) && !/\r/.test(first)) {
    const sc = LX.shCheck(n.c, tok);
    if (sc) return Object.assign(base, { ok: false, stage: sc.stage, msg: sh(sc.msg), bash: sc.msg + (sc.msg2 ? '\n' + sc.msg2 : ''), line: sc.line });
  }
  if (/mysqldump/.test(n.c || '') && !(LX.svcRun(d, 'mariadb') && d.svc.mariadb.state === 'active')) return Object.assign(base, { ok: false, stage: 'db', msg: 'mysqldump: Got error: 2002: "Can\'t connect to local server through socket \'/run/mysqld/mysqld.sock\' (2)" when trying to connect' });
  const out = (d.cronOut || {})[r];
  if (out && d.disk && d.disk[LX.mountOf(d, out.dir + '/')] && d.disk[LX.mountOf(d, out.dir + '/')].usePct >= 100) return Object.assign(base, { ok: false, stage: 'disk', msg: 'gzip: stdout: No space left on device' });
  return Object.assign(base, { ok: true });
};
LX.cronRun = function (W, d, job, atMs) {
  const r = LX.cronEval(W, d, job); const pid = LX.nextPid(d);
  const lg = (msg, prio) => LX.jlog(W, d, 'cron.service', 'CRON', msg, prio || 6);
  if (r.stage === 'service') return r;
  if (r.stage === 'insecure') { LX.jlog(W, d, 'cron.service', 'cron', r.msg, 4); return r; }
  lg('(' + job.user + ') CMD (' + job.cmd + ')');
  if (!r.ok) { LX.jlog(W, d, 'cron.service', 'CRON', '(CRON) ' + U.av('cron-nomta', 'info (No MTA installed, discarding output)'), 6); return r; }
  const tok = job.cmd.split(/\s+/)[0]; const out = (d.cronOut || {})[LX.resolve(d, LX.norm(tok))];
  if (out) {
    const dt = new Date(atMs); const f = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
    const p = out.dir + '/' + out.name.replace('%F', f); LX.write(W, d, p, '', { m: '0644' }); d.fs[p].sz = out.sizeMB || 1; LX.recalcDisk(d);
  }
  return r;
};
/* Joue les minutes écoulées entre deux instants simulés (appelé par l'horloge) */
LX.cronTick = function (W, d, fromMs, toMs) {
  if (!d.fs || !LX.svcRun(d, 'cron')) return;
  const { jobs } = LX.cronJobs(d); if (!jobs.length) return;
  const cap = Math.min(toMs, fromMs + 3 * 86400000);
  for (let t = Math.floor(fromMs / 60000) * 60000 + 60000; t <= cap; t += 60000) {
    const dt = new Date(t);
    for (const j of jobs) if (LX.cronMatch(j, dt)) LX.cronRun(W, d, j, t);
  }
};

/* ------------------------------------------------------------------ MariaDB : comptes name@hôte */
SIM.AVREG['mariadb-denied'] = 'Libellés ERROR 1045 (28000) « Access denied for user … » et ERROR 1130 (HY000) « Host … is not allowed to connect to this MariaDB server » : repris de mémoire, à vérifier (résolution inverse de l’hôte affichée selon skip-name-resolve).';
LX.dbHostMatch = (pat, ip) => {
  if (pat === '%') return true; if (pat === 'localhost') return ip === '127.0.0.1';
  if (pat.indexOf('/') > 0) { const [a, m] = pat.split('/'); return U.isIP(m) ? U.inNet(ip, a, m) : U.inCidr(ip, pat); }
  return new RegExp('^' + pat.replace(/\./g, '\\.').replace(/%/g, '.*').replace(/_/g, '.') + '$').test(ip);
};
LX.dbLogin = function (d, ip, user, db) {
  const users = (d.db && d.db.users) || [];
  const anyHost = users.some(u => LX.dbHostMatch(u.host, ip));
  if (!anyHost) return { ok: false, code: 1130, msg: U.av('mariadb-denied', "ERROR 1130 (HY000): Host '" + ip + "' is not allowed to connect to this MariaDB server") };
  const row = users.find(u => u.user === user && LX.dbHostMatch(u.host, ip));
  if (!row) return { ok: false, code: 1045, msg: U.av('mariadb-denied', "ERROR 1045 (28000): Access denied for user '" + user + "'@'" + ip + "' (using password: YES)") };
  if (db && row.db !== '*' && row.db !== db) return { ok: false, code: 1044, msg: U.av('mariadb-denied', "ERROR 1044 (42000): Access denied for user '" + user + "'@'" + ip + "' to database '" + db + "'") };
  return { ok: true, row };
};

/* ------------------------------------------------------------------ sondes */
const eqv = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cmpVal = (v, p) => {
  if (p.eq !== undefined) return eqv(v, p.eq);
  if (p.ne !== undefined) return !eqv(v, p.ne);
  if (p.in) return p.in.some(x => eqv(x, v));
  if (p.has !== undefined) return Array.isArray(v) ? v.some(x => eqv(x, p.has)) : (typeof v === 'string' && v.indexOf(p.has) >= 0);
  if (p.hasNot !== undefined) return !(Array.isArray(v) ? v.some(x => eqv(x, p.hasNot)) : (typeof v === 'string' && v.indexOf(p.hasNot) >= 0));
  if (p.isNull) return v === null || v === undefined;
  if (p.gte !== undefined) return v >= p.gte; if (p.lt !== undefined) return v < p.lt;
  return !!v;
};
const PARSERS = { sshd: LX.parseSshd, apache: LX.parseApache, nginx: LX.parseNginx, bind: LX.bindSnapshot, mariadb: LX.parseMariadb, bindopt: LX.parseBindOptions };
P.lxcfg = (W, p) => {
  const d = W.d(p.dev); const fn = PARSERS[p.parse]; if (!fn) return { ok: false, why: 'analyseur inconnu ' + p.parse };
  const v = U.pget(fn(d), p.get); const ok = cmpVal(v, p);
  return { ok, why: p.parse + '.' + p.get + ' = ' + JSON.stringify(v) };
};
P.lxfile = (W, p) => {
  const d = W.d(p.dev); const r = LX.resolve(d, LX.norm(p.path)); const n = d.fs[r];
  if (p.exists === false) return { ok: !n, why: n ? 'présent' : 'absent' };
  if (!n) return { ok: false, why: 'absent' };
  const c = n.c || '';
  if (p.contains !== undefined && c.indexOf(p.contains) < 0) return { ok: false, why: 'contenu : « ' + p.contains + ' » introuvable' };
  if (p.matches && !new RegExp(p.matches, 'm').test(c)) return { ok: false, why: 'contenu : motif absent' };
  if (p.absent !== undefined && c.indexOf(p.absent) >= 0) return { ok: false, why: 'contenu : « ' + p.absent + ' » présent' };
  if (p.mode !== undefined && n.m !== p.mode) return { ok: false, why: 'mode ' + n.m };
  if (p.modeIn && p.modeIn.indexOf(n.m) < 0) return { ok: false, why: 'mode ' + n.m };
  if (p.safe) { const dg = LX.modeDigits(n.m); if ((dg[1] & 2) || (dg[2] & 2)) return { ok: false, why: 'modifiable par le groupe/les autres (' + n.m + ')' }; }
  if (p.owner !== undefined && n.o !== p.owner) return { ok: false, why: 'propriétaire ' + n.o };
  if (p.ownerIn && p.ownerIn.indexOf(n.o) < 0) return { ok: false, why: 'propriétaire ' + n.o };
  if (p.group !== undefined && n.g !== p.group) return { ok: false, why: 'groupe ' + n.g };
  if (p.exec) { const dg = LX.modeDigits(n.m); if (!(dg[0] & 1)) return { ok: false, why: 'pas exécutable' }; }
  return { ok: true, why: n.m + ' ' + n.o + ':' + n.g };
};
P.lxufw = (W, p) => { const d = W.d(p.dev); const ok = LX.ufwAllows(d, p.proto || 'tcp', p.port, p.from); const want = p.expect === false ? false : true; return { ok: ok === want, why: ok ? 'autorisé' : 'refusé' }; };
P.lxfresh = (W, p) => {
  const d = W.d(p.dev); const k = LX.svcKey(d, p.svc); const run = k && LX.svcRun(d, k);
  if (!run || d.svc[k].state !== 'active') return { ok: false, why: 'service arrêté' };
  const cur = LX.SERVICES[k].snap(d); const same = eqv(run.snap, cur);
  return { ok: same, why: same ? 'configuration chargée = fichiers' : 'les fichiers diffèrent de la configuration chargée (rechargement nécessaire)' };
};
P.cronjob = (W, p) => {
  const d = W.d(p.dev); const all = LX.cronJobs(d);
  const ign = all.ignored.find(x => x.file === p.file); if (ign) return { ok: false, why: 'fichier ignoré par cron (nom invalide)' };
  const js = all.jobs.filter(j => j.file === p.file && (!p.cmd || j.cmd.indexOf(p.cmd) >= 0)); if (!js.length) return { ok: false, why: 'tâche absente de ' + p.file };
  for (const j of js) { const r = LX.cronEval(W, d, j); if (!r.ok) return { ok: false, why: r.stage + ' : ' + r.msg }; }
  return { ok: true, why: 'tâche exécutable' };
};
P.dblogin = (W, p) => {
  const t = U.isIP(p.to) ? { ip: p.to } : N.resolve(W, p.from, p.to, { noCache: true }); if (t.ok === false) return { ok: false, why: 'résolution : ' + t.err };
  const c = N.connect(W, p.from, t.ip, 'tcp', p.port || 3306);
  if (c.state !== 'open') return { ok: false, why: c.state + (c.trace && !c.trace.ok ? ' ' + N.describeFail(c.trace) : '') };
  const d = W.d(c.dstDev); const r = LX.dbLogin(d, c.trace.sipAtDst, p.user, p.db);
  return r.ok ? { ok: true, why: 'connexion acceptée' } : { ok: false, why: r.msg };
};
P.lxaccess = (W, p) => { const d = W.d(p.dev); const r = LX.access(d, p.user, p.path, p.mode || 'r'); return { ok: r.ok === (p.expect !== false), why: r.ok ? 'accès ' + (p.mode || 'r') : 'refusé (' + r.kind + ' sur ' + r.failAt + ')' }; };
P.lxdisk = (W, p) => { const d = W.d(p.dev); const k = d.disk[p.fs]; return { ok: k.usePct <= (p.max === undefined ? 90 : p.max), why: p.fs + ' à ' + k.usePct + ' %' }; };
P.lxboot = (W, p) => { const d = W.d(p.dev); return { ok: !d._rt.emergency, why: d._rt.emergency ? 'mode d’urgence' : 'démarrage normal' }; };


/* ------------------------------------------------------------------ réseau Debian : /etc/network/interfaces (ifupdown) */
SIM.AVREG['lx-networking-unit'] = 'Application de /etc/network/interfaces : « systemctl restart networking » (ifupdown) supposé sur Debian 13 en installation serveur ; à vérifier.';
LX.parseInterfaces = function (d) {
  const res = { ifaces: {}, errors: [] }; let cur = null;
  for (const L of LX.lines(LX.readFile(d, '/etc/network/interfaces'))) {
    if (!L.t) continue; const f = L.t.split(/\s+/);
    if (f[0] === 'iface') { cur = { name: f[1], family: f[2], method: f[3] }; res.ifaces[f[1]] = cur; continue; }
    if (f[0] === 'auto' || f[0] === 'allow-hotplug' || f[0] === 'source') { cur = null; continue; }
    if (!cur) continue;
    if (f[0] === 'address') { const m = f[1].split('/'); cur.address = m[0]; if (m[1]) cur.prefix = +m[1]; }
    else if (f[0] === 'netmask') cur.netmask = f[1];
    else if (f[0] === 'gateway') cur.gateway = f[1];
  }
  return res;
};
LX.netApply = function (W, d) {
  const cfg = LX.parseInterfaces(d); const out = [];
  for (const n of Object.keys(cfg.ifaces)) {
    const c = cfg.ifaces[n]; const i = d.ifaces[n]; if (!i || c.method !== 'static') continue;
    if (!c.address || !U.isIP(c.address)) { out.push(n + ': adresse invalide'); continue; }
    i.ip = c.address; i.mask = c.netmask || (c.prefix !== undefined ? U.len2mask(c.prefix) : '255.255.255.0'); i.gw = c.gateway || '';
  }
  W.touch('iface'); return { ok: out.length === 0, errors: out };
};
S['lx.netapply'] = (W, s) => { const r = LX.netApply(W, W.d(s.dev)); if (!r.ok) throw new Error('lx.netapply: ' + r.errors.join('; ')); };
S['lx.link'] = (W, s) => { const d = W.d(s.dev); d.fs[LX.norm(s.path)] = { t: 'l', target: s.target, m: '0777', o: 'root', g: 'root', mt: W.now().getTime() }; W.touch('fs'); };
P.bindok = (W, p) => {
  const d = W.d(p.dev); const ck = LX.bindCheckConf(d); if (!ck.ok) return { ok: false, why: ck.lines[0] };
  const bad = ck.snap.zones.find(z => !z.ok); if (bad) return { ok: false, why: bad.err };
  const k = 'bind9'; const run = LX.svcRun(d, k); if (!run || d.svc[k].state !== 'active') return { ok: false, why: 'service arrêté' };
  return eqv(run.snap, LX.SERVICES[k].snap(d)) ? { ok: true, why: 'configuration saine et chargée' } : { ok: false, why: 'rechargement nécessaire' };
};
/* ------------------------------------------------------------------ étapes d'injection */
S['lx.mv'] = (W, s) => {
  const d = W.d(s.dev); const a = LX.norm(s.from), b = LX.norm(s.to); if (!d.fs[a]) throw new Error('lx.mv: absent ' + s.from);
  Object.keys(d.fs).forEach(k => { if (k === a || k.indexOf(a + '/') === 0) { d.fs[b + k.slice(a.length)] = d.fs[k]; delete d.fs[k]; } });
  LX.recalcDisk(d); W.touch('fs');
};
S['lx.jlog'] = (W, s) => { LX.jlog(W, W.d(s.dev), s.unit, s.proc, s.msg, s.prio || 3, s.ageSec || 0); };
/* Modifie l'entrée fstab d'un point de montage : uuid = 'typo' | 'ok', type, mp */
S['lx.fstab'] = (W, s) => {
  const d = W.d(s.dev); const txt = LX.readFile(d, '/etc/fstab'); let hit = false;
  const lines = txt.split('\n').map(l => {
    const f = l.split(/\s+/); if (l[0] === '#' || f.length < 4 || f[1] !== s.mp) return l; hit = true;
    if (s.uuid === 'typo') f[0] = f[0].slice(0, -1) + (f[0].slice(-1) === 'a' ? 'b' : 'a');
    else if (s.uuid === 'ok') f[0] = 'UUID=' + d.disk[s.disk].uuid;
    if (s.type) f[2] = s.type; if (s.newMp) f[1] = s.newMp;
    return f.join(' ');
  });
  if (!hit) throw new Error('lx.fstab: point de montage introuvable ' + s.mp);
  LX.write(W, d, '/etc/fstab', lines.join('\n'));
};

P.cfgcheck = (W, p) => {
  const d = W.d(p.dev); const k = LX.svcKey(d, p.svc); const ck = LX.SERVICES[k].check(d);
  if (!ck.ok) return { ok: false, why: ck.lines[0] };
  const run = LX.svcRun(d, k); if (!run || d.svc[k].state !== 'active') return { ok: false, why: 'service arrêté' };
  return eqv(run.snap, LX.SERVICES[k].snap(d)) ? { ok: true, why: 'configuration valide et chargée' } : { ok: false, why: 'configuration valide mais non rechargée' };
};
S['lx.mkdir'] = (W, s) => { LX.mkdir(W, W.d(s.dev), s.path, { m: s.m, o: s.o, g: s.g }); W.touch('fs'); };
P.fstabok = (W, p) => { const bc = LX.bootCheck(W.d(p.dev), true); return { ok: bc.ok, why: bc.ok ? 'fstab cohérent' : bc.errs[0].msg }; };

S['lx.bigfile'] = (W, s) => {
  const d = W.d(s.dev); LX.write(W, d, s.path, '', { m: s.m || '0640', o: s.owner || 'root', g: s.group || 'adm' });
  d.fs[LX.resolve(d, LX.norm(s.path))].sz = s.sizeMB; LX.recalcDisk(d);
};
S['lx.truncate'] = (W, s) => { if (!LX.truncate(W, W.d(s.dev), s.path)) throw new Error('lx.truncate: ' + s.path); };
S['lx.ufw'] = (W, s) => {
  const d = W.d(s.dev); const rules = d.ufw.rules; const same = (r) => r.to === s.rule.to && r.from === s.rule.from && r.action === s.rule.action;
  if (s.op === 'insert') rules.splice(s.index || 0, 0, U.clone(s.rule));
  else if (s.op === 'add') rules.push(U.clone(s.rule));
  else if (s.op === 'delete') { const i = rules.findIndex(same); if (i < 0) throw new Error('lx.ufw: règle introuvable ' + JSON.stringify(s.rule)); rules.splice(i, 1); }
  else if (s.op === 'default') d.ufw.defaultIn = s.value;
  else if (s.op === 'enable') d.ufw.enabled = true; else if (s.op === 'disable') d.ufw.enabled = false;
  else throw new Error('lx.ufw: opération inconnue ' + s.op);
  W.touch('ufw');
};
S['lx.acl'] = (W, s) => { const d = W.d(s.dev); const r = LX.resolve(d, LX.norm(s.path)); if (!d.fs[r]) throw new Error('lx.acl: absent ' + s.path); if (s.acl === null) delete d.fs[r].acl; else d.fs[r].acl = U.clone(s.acl); W.touch('fs'); };
S['lx.db'] = (W, s) => { const d = W.d(s.dev); if (s.op === 'grant') d.db.users.push(U.clone(s.row)); else if (s.op === 'revoke') { const i = d.db.users.findIndex(u => u.user === s.row.user && u.host === s.row.host); if (i < 0) throw new Error('lx.db: compte introuvable'); d.db.users.splice(i, 1); } else if (s.op === 'host') { const u = d.db.users.find(x => x.user === s.user); if (!u) throw new Error('lx.db: compte introuvable'); u.host = s.host; } else throw new Error('lx.db: opération inconnue ' + s.op); W.touch('db'); };
S['lx.iface'] = (W, s) => { const d = W.d(s.dev); const i = d.ifaces[s.iface || 'eth0']; Object.keys(s.set).forEach(k => { i[k] = U.clone(s.set[k]); }); W.touch('iface'); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
