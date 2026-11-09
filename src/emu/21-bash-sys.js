/* ============================================================================
   Debian 13 — commandes système et réseau : systemctl / journalctl, apache/nginx/bind/ufw/sshd,
   ip / ss / ping / curl / dig / host / nslookup / getent, mysql, crontab, apt, reboot.
   Tout est calculé depuis le monde (LX, N, SSH) ; aucune sortie n'est figée par scénario.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, LX = SIM.lx, WEB = SIM.web;
const E = SIM.emu; const L = E.L; const B = E.lx; const C = B.cmds; const S = B.sbin;
const W_ = E.win;
const MON = E.EN_MONTHS, DAY = E.EN_DAYS;

U.av('systemctl-status-format', 'Mise en page de « systemctl status » (ligne Loaded / Active / Main PID / CGroup, « Invocation » propre à systemd 257) : reconstituée de mémoire pour Debian 13.');
U.av('systemctl-polkit', 'Message « Interactive authentication required. » d’un utilisateur ordinaire sans agent polkit (session SSH) : libellé repris de mémoire.');
U.av('journal-nopermission', 'Avertissement de journalctl pour un utilisateur hors des groupes adm / systemd-journal : libellé repris de mémoire.');
U.av('ss-format', 'Colonnes de « ss -tulpn » (largeurs, alignement de l’adresse locale, colonne Process) : approximation d’iproute2 6.x.');
U.av('ip-format', 'Sortie de « ip a » / « ip r » (flags, qdisc, onlink pour la passerelle ifupdown) : approximation d’iproute2 6.x ; l’interface s’appelle eth0 dans ce laboratoire (pas de nom prévisible).');
U.av('ping-linux-format', 'Sortie d’iputils-ping sur Debian 13 (ligne d’en-tête, temps avec décimales, statistiques) : approximation.');
U.av('dig-format', 'Sortie de dig (version de BIND dans l’en-tête, section OPT, taille de message) : approximation ; la section AUTHORITY d’un NXDOMAIN n’affiche pas le SOA (non modélisé).');
U.av('apt-format', 'Messages d’apt (tailles, numéros de version, lignes Get:/Fetched) : approximation ; seuls les échecs réseau suivent des libellés connus.');
U.av('ufw-format', 'Sortie de « ufw status » (colonnes To / Action / From, doublons « (v6) ») : approximation de ufw 0.36.');
U.av('mysql-banner', 'Bannière et numéro de version du client mariadb 11.8 : à vérifier.');
U.av('mysql-errors', 'Libellés ERROR 2002 / 1045 / 1130 du client mariadb : repris de mémoire.');
U.av('mysql-userops', 'Console SQL : RENAME / DROP / CREATE / ALTER USER et GRANT — libellé « ERROR 1396 (HY000): Operation … failed for \'u\'@\'h\' » et sortie « Query OK, 0 rows affected » repris de mémoire ; GRANT à un compte inexistant : comportement exact (création ou ERROR 1133) à vérifier.');

const fmtTs = ms => { const x = new Date(ms); return MON[x.getUTCMonth()] + ' ' + String(x.getUTCDate()).padStart(2, ' ') + ' ' + E.frTime(x); };
const fmtFull = ms => { const x = new Date(ms); return DAY[x.getUTCDay()] + ' ' + x.getUTCFullYear() + '-' + U.pad2(x.getUTCMonth() + 1) + '-' + U.pad2(x.getUTCDate()) + ' ' + E.frTime(x) + ' UTC'; };
const ago = ms => { const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'min'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ' + (m % 60) + 'min'; const dd = Math.floor(h / 24); return dd + (dd === 1 ? ' day ' : ' days ') + (h % 24) + 'h'; };
const isRoot = s => s.euser() === 'root';
const inAdm = s => { const gs = LX.groupsOf(s.d, s.euser()); return s.euser() === 'root' || gs.indexOf('adm') >= 0 || gs.indexOf('systemd-journal') >= 0; };

/* ------------------------------------------------------------------ unités */
const PSEUDO = { networking: { desc: 'Raise network interfaces', file: '/usr/lib/systemd/system/networking.service' } };
function unitOf(s, name) {
  const d = s.d; const base = name.replace(/\.service$/, '');
  const k = LX.svcKey(d, base);
  if (k) return { k, def: LX.SERVICES[k], svc: d.svc[k], pseudo: false, unit: LX.SERVICES[k].unit };
  if (PSEUDO[base]) return { k: base, pseudo: true, unit: base + '.service', def: { unit: base + '.service', desc: PSEUDO[base].desc, proc: base } };
  return null;
}
function jEntries(s, opt) {
  const d = s.d; let es = s.W.logs(d.id, 'journal').slice();
  if (opt.unit) { const u = unitOf(s, opt.unit); const names = u ? [u.unit, u.unit.replace('.service', '')] : [opt.unit, opt.unit + '.service']; es = es.filter(e => names.indexOf(e.unit) >= 0 || (u && u.def.proc === e.proc && e.proc !== 'systemd')); }
  if (opt.prio !== undefined) es = es.filter(e => (e.prio || 6) <= opt.prio);
  if (opt.since !== undefined) es = es.filter(e => e.t >= opt.since);
  if (opt.until !== undefined) es = es.filter(e => e.t <= opt.until);
  es.sort((x, y) => x.t - y.t);
  return es;
}
function jLine(s, e) { const pid = e.proc === 'systemd' ? 1 : (e.pid || ''); return fmtTs(e.t) + ' ' + s.host() + ' ' + e.proc + (pid !== '' ? '[' + pid + ']' : '') + ': ' + e.msg; }
function parseWhen(s, str) {
  const now = s.W.now().getTime(); str = String(str).trim();
  let m = str.match(/^(\d+)\s*(second|sec|s|minute|min|m|hour|h|day|d)s?\s+ago$/i);
  if (m) { const mult = { s: 1, sec: 1, second: 1, m: 60, min: 60, minute: 60, h: 3600, hour: 3600, d: 86400, day: 86400 }[m[2].toLowerCase()]; return now - m[1] * mult * 1000; }
  if (/^today$/i.test(str)) { const x = new Date(now); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); }
  if (/^yesterday$/i.test(str)) { const x = new Date(now - 86400000); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); }
  if (/^now$/i.test(str)) return now;
  const t = Date.parse(str.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? '' : 'Z')); return isNaN(t) ? null : t;
}
C.journalctl = (s, a, o, r) => {
  const opt = {}; let n = null, follow = false, reverse = false, quiet = false, boot = false, diskUsage = false;
  const flat = [];
  a.forEach(x => { if (/^-[a-zA-Z]{2,}$/.test(x) && !/^--/.test(x)) x.slice(1).split('').forEach(ch => flat.push('-' + ch)); else flat.push(x); });
  for (let i = 0; i < flat.length; i++) {
    const x = flat[i];
    if (x === '-u' || x === '--unit') opt.unit = flat[++i]; else if (/^--unit=/.test(x)) opt.unit = x.slice(7);
    else if (x === '-n' || x === '--lines') { n = flat[++i]; if (n !== undefined && !/^\d+$/.test(n)) { i--; n = 10; } } else if (/^--lines=/.test(x)) n = x.slice(8);
    else if (x === '-f' || x === '--follow') follow = true; else if (x === '-r' || x === '--reverse') reverse = true; else if (x === '-q' || x === '--quiet') quiet = true;
    else if (x === '-b' || x === '--boot') { boot = true; if (flat[i + 1] && /^-?\d$/.test(flat[i + 1])) i++; }
    else if (x === '-p' || x === '--priority') { const v = flat[++i]; opt.prio = ({ emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 })[v] !== undefined ? ({ emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 })[v] : +v; }
    else if (/^--priority=/.test(x)) opt.prio = ({ err: 3, warning: 4 })[x.slice(11)] || +x.slice(11);
    else if (x === '--since' || x === '-S') { opt.since = parseWhen(s, flat[++i]); if (opt.since === null) { o.l('Failed to parse timestamp: ' + flat[i], 'e'); return 1; } } else if (/^--since=/.test(x)) opt.since = parseWhen(s, x.slice(8));
    else if (x === '--until' || x === '-U') opt.until = parseWhen(s, flat[++i]); else if (/^--until=/.test(x)) opt.until = parseWhen(s, x.slice(8));
    else if (x === '--disk-usage') diskUsage = true; else if (x === '-k' || x === '--dmesg') { } else if (x === '-x' || x === '-e' || x === '--no-pager' || x === '-l' || x === '-a' || x === '-o') { if (x === '-o') i++; }
    else if (x[0] !== '-') { /* correspondance de champ : ignorée */ }
  }
  if (diskUsage) { o.l('Archived and active journals take up 24.0M in the file system.'); return; }
  if (!inAdm(s)) {
    if (!quiet) { o.l('Hint: You are currently not seeing messages from other users and the system.', 'w'); o.l('      Users in groups \'adm\', \'systemd-journal\' can see all messages.', 'w'); o.l('      Pass -q to turn off this notice.', 'w'); }
    o.l(U.av('journal-nopermission', 'No journal files were opened due to insufficient permissions.'), 'w'); return 1;
  }
  let es = jEntries(s, opt);
  if (boot && s.d._rt.bootAt !== undefined) { const bt = s.W.clock.base + s.d._rt.bootAt * 1000; es = es.filter(e => e.t >= bt); }
  if (!es.length) { o.l('-- No entries --'); return; }
  const emit = (list) => list.forEach(e => o.l(jLine(s, e)));
  if (n !== null && !reverse) { emit(es.slice(-parseInt(n, 10))); } else if (n !== null) { emit(es.slice(-parseInt(n, 10)).reverse()); } else if (reverse) emit(es.slice().reverse()); else emit(es);
  if (follow) { let seen = s.W.now().getTime(); r.stream = { interval: 1000, next: () => { s.env.advance(1); const now = s.W.now().getTime(); const fresh = jEntries(s, Object.assign({}, opt, { since: seen + 1 })); seen = Math.max(seen, ...fresh.map(e => e.t), seen); return fresh.map(e => L(jLine(s, e))); }, stop: () => [] }; }
};

/* ------------------------------------------------------------------ systemctl */
function unitFile(k) { return '/usr/lib/systemd/system/' + (LX.SERVICES[k] ? LX.SERVICES[k].unit : k + '.service'); }
const DOCS = { ssh: ['man:sshd(8)', 'man:sshd_config(5)'], apache2: ['https://httpd.apache.org/docs/2.4/'], nginx: ['man:nginx(8)'], bind9: ['man:named(8)', 'https://bind9.readthedocs.io/en/latest/'], mariadb: ['man:mariadbd(8)', 'https://mariadb.com/kb/en/library/systemd/'], cron: ['man:cron(8)'] };
function statusText(s, u, o) {
  const d = s.d; const W = s.W;
  if (u.pseudo) { o.l('● ' + u.unit + ' - ' + u.def.desc); o.l('     Loaded: loaded (' + PSEUDO[u.k].file + '; enabled; preset: enabled)'); o.l('     Active: active (exited) since ' + fmtFull(W.clock.base - 100000)); return; }
  const k = u.k; const sv = d.svc[k]; const run = LX.svcRun(d, k); const failed = sv.state === 'failed'; const active = sv.state === 'active' && run;
  const dot = active ? '●' : failed ? '×' : '○';
  o.l(dot + ' ' + u.unit + ' - ' + u.def.desc);
  o.l('     Loaded: ' + (sv.masked ? 'masked (Reason: Unit ' + u.unit + ' is masked.)' : 'loaded (' + unitFile(k) + '; ' + (sv.enabled ? 'enabled' : 'disabled') + '; preset: enabled)'));
  const es = jEntries(s, { unit: u.unit });
  if (active) o.l('     Active: active (running) since ' + fmtFull(run.since) + '; ' + ago(W.now().getTime() - run.since) + ' ago');
  else if (failed) { const lt = es.length ? es[es.length - 1].t : W.now().getTime(); o.l('     Active: failed (Result: exit-code) since ' + fmtFull(lt) + '; ' + ago(W.now().getTime() - lt) + ' ago'); }
  else { const lt = es.length ? es[es.length - 1].t : W.now().getTime(); o.l('     Active: inactive (dead)' + (es.length ? ' since ' + fmtFull(lt) + '; ' + ago(W.now().getTime() - lt) + ' ago' : '')); }
  o.l(' Invocation: ' + U.hash8(d.id + k + (run ? run.since : 0)) + U.hash8(k + d.id) + U.hash8(d.id + k + 'x') + U.hash8(k));
  (Object.prototype.hasOwnProperty.call(DOCS, k) ? DOCS[k] : []).forEach((x, i) => o.l((i ? '            ' : '       Docs: ') + x));
  if (active) {
    o.l('   Main PID: ' + run.pid + ' (' + u.def.proc + ')'); o.l('      Tasks: 3 (limit: 2307)'); o.l('     Memory: 12.4M (peak: 14.1M)'); o.l('        CPU: 118ms');
    o.l('     CGroup: /system.slice/' + u.unit); o.l('             └─' + run.pid + ' ' + u.def.exec);
  } else if (failed) { o.l('    Process: ' + LX.nextPid(d) + ' ExecStart=' + u.def.exec + ' (code=exited, status=1/FAILURE)'); o.l('        CPU: 41ms'); }
  o.blank();
  const lines = es.slice(-10); lines.forEach(e => o.l(jLine(s, e)));
  if (!inAdm(s)) { o.blank(); o.l('Warning: some journal files were not opened due to insufficient permissions.', 'w'); }
}
function ctlStart(s, u, o, r, verb) {
  const d = s.d, W = s.W;
  if (u.pseudo) { const x = LX.netApply(W, d); s.env.advance(3); if (!x.ok) { o.l('Job for networking.service failed because the control process exited with error code.', 'e'); o.l('See "systemctl status networking.service" and "journalctl -xeu networking.service" for details.', 'e'); return 1; } r.mutated = true; return 0; }
  const k = u.k;
  if (d.svc[k].masked) { o.l('Failed to ' + verb + ' ' + u.unit + ': Unit ' + u.unit + ' is masked.', 'e'); return 1; }
  if (verb === 'restart' && LX.svcRun(d, k)) LX.stopService(W, d, k);
  if (verb === 'start' && LX.svcRun(d, k) && d.svc[k].state === 'active') { s.mut(r); return 0; }
  const res = LX.startService(W, d, k); s.env.advance(2); r.mutated = true; s.env.touch('svc');
  if (!res.ok) { o.l('Job for ' + u.unit + ' failed because the control process exited with error code.', 'e'); o.l('See "systemctl status ' + u.unit + '" and "journalctl -xeu ' + u.unit + '" for details.', 'e'); return 1; }
  return 0;
}
function ctl(s, a, o, r) {
  const d = s.d, W = s.W; const flags = a.filter(x => x[0] === '-'); const args = a.filter(x => x[0] !== '-');
  const verb = args[0]; const names = args.slice(1);
  if (!verb) { o.l('UNIT                       LOAD   ACTIVE SUB     DESCRIPTION'); Object.keys(d.svc).forEach(k => { const sv = d.svc[k]; o.l(B.padR(LX.SERVICES[k].unit, 26) + ' loaded ' + B.padR(sv.state, 6) + ' ' + B.padR(sv.sub || (sv.state === 'active' ? 'running' : 'dead'), 7) + ' ' + LX.SERVICES[k].desc); }); return; }
  const needRoot = ['start', 'stop', 'restart', 'reload', 'enable', 'disable', 'mask', 'unmask', 'daemon-reload', 'try-restart', 'reload-or-restart', 'reboot', 'poweroff', 'halt', 'default', 'kill', 'reset-failed'];
  if (verb === 'list-units' || verb === 'list-unit-files') {
    const failedOnly = flags.some(x => /--failed/.test(x)) || (verb === 'list-units' && flags.indexOf('--state=failed') >= 0);
    const rows = Object.keys(d.svc).filter(k => !failedOnly || d.svc[k].state === 'failed').filter(k => verb === 'list-unit-files' || failedOnly || d.svc[k].state === 'active' || flags.some(x => x === '-a' || x === '--all') || true);
    if (verb === 'list-unit-files') { o.l('UNIT FILE                 STATE   PRESET'); rows.forEach(k => o.l(B.padR(LX.SERVICES[k].unit, 25) + ' ' + B.padR(d.svc[k].masked ? 'masked' : d.svc[k].enabled ? 'enabled' : 'disabled', 7) + ' enabled')); o.blank(); o.l(rows.length + ' unit files listed.'); return; }
    if (failedOnly && !rows.length) { o.l('  UNIT LOAD ACTIVE SUB DESCRIPTION'); o.l('0 loaded units listed.'); return; }
    const w1 = Math.max(4, ...rows.map(k => LX.SERVICES[k].unit.length)) + 2;
    o.l((failedOnly ? '  ' : '  ') + B.padR('UNIT', w1) + 'LOAD   ACTIVE SUB     DESCRIPTION');
    rows.forEach(k => { const sv = d.svc[k]; const st = sv.state === 'active' ? ['active', 'running'] : sv.state === 'failed' ? ['failed', 'failed'] : ['inactive', 'dead']; o.l((sv.state === 'failed' ? '● ' : '  ') + B.padR(LX.SERVICES[k].unit, w1) + 'loaded ' + B.padR(st[0], 6) + ' ' + B.padR(st[1], 7) + ' ' + LX.SERVICES[k].desc); });
    o.blank(); o.l('Legend: LOAD   → Reflects whether the unit definition was properly loaded.'); o.l('        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.'); o.l('        SUB    → The low-level unit activation state, values depend on unit type.'); o.blank(); o.l(rows.length + ' loaded units listed.' + (failedOnly ? '' : ' Pass --all to see loaded but inactive units, too.')); return;
  }
  if (verb === 'is-system-running') { o.l(d._rt.emergency ? 'maintenance' : 'running'); return d._rt.emergency ? 1 : 0; }
  if (verb === 'get-default') { o.l(d._rt.emergency ? 'emergency.target' : 'multi-user.target'); return; }
  if (needRoot.indexOf(verb) >= 0 && !isRoot(s)) {
    const target = names[0] ? (unitOf(s, names[0]) ? unitOf(s, names[0]).unit : names[0]) : '';
    if (verb === 'reboot' || verb === 'poweroff' || verb === 'halt') { o.l('Failed to ' + verb + ' system via logind: Interactive authentication required.', 'e'); o.l('Failed to open initctl fifo: Permission denied', 'e'); o.l('Failed to talk to init daemon.', 'e'); return 1; }
    o.l(U.av('systemctl-polkit', 'Failed to ' + verb + ' ' + target + ': Interactive authentication required.'), 'e'); o.l('See system logs and \'systemctl status ' + target + '\' for details.', 'e'); return 1;
  }
  if (verb === 'daemon-reload') { s.env.advance(1); return; }
  if (verb === 'reboot') return doReboot(s, o, r, 'reboot'); if (verb === 'poweroff' || verb === 'halt') return doReboot(s, o, r, 'poweroff');
  if (verb === 'default') { if (!d._rt.emergency) return; const bc = LX.bootCheck(d); if (!bc.ok) { o.l('Cannot activate default.target: dependency failed (local-fs.target). See "journalctl -xb".', 'e'); return 1; } return doReboot(s, o, r, 'reboot'); }
  if (!names.length) { o.l('Too few arguments.', 'e'); return 1; }
  let bad = 0;
  names.forEach(nm => {
    const u = unitOf(s, nm);
    if (!u) {
      if (verb === 'status') o.l('Unit ' + (/\.[a-z]+$/.test(nm) ? nm : nm + '.service') + ' could not be found.', 'e');
      else if (verb === 'is-active') o.l('inactive'); else if (verb === 'is-enabled') o.l('Failed to get unit file state for ' + nm + '.service: No such file or directory', 'e'); else if (verb === 'is-failed') o.l('inactive');
      else o.l('Failed to ' + verb + ' ' + (/\.[a-z]+$/.test(nm) ? nm : nm + '.service') + ': Unit ' + (/\.[a-z]+$/.test(nm) ? nm : nm + '.service') + ' not found.', 'e');
      bad = verb === 'status' ? 4 : verb.indexOf('is-') === 0 ? 3 : 5; return;
    }
    const k = u.k;
    switch (verb) {
      case 'status': statusText(s, u, o); if (!u.pseudo && d.svc[k].state !== 'active') bad = d.svc[k].state === 'failed' ? 3 : 3; break;
      case 'is-active': { const st = u.pseudo ? 'active' : d.svc[k].state; o.l(st); if (st !== 'active') bad = 3; break; }
      case 'is-enabled': { if (u.pseudo) { o.l('enabled'); break; } const st = d.svc[k].masked ? 'masked' : d.svc[k].enabled ? 'enabled' : 'disabled'; o.l(st); if (st !== 'enabled') bad = 1; break; }
      case 'is-failed': { const f = !u.pseudo && d.svc[k].state === 'failed'; o.l(f ? 'failed' : (u.pseudo ? 'active' : d.svc[k].state)); if (!f) bad = 1; break; }
      case 'start': case 'restart': case 'try-restart': case 'reload-or-restart': { if (verb === 'try-restart' && !(u.pseudo || LX.svcRun(d, k))) break; const x = ctlStart(s, u, o, r, verb === 'start' ? 'start' : 'restart'); if (x) bad = x; break; }
      case 'stop': if (!u.pseudo) { LX.stopService(W, d, k); s.env.advance(2); r.mutated = true; r.impact = 'svc-stop'; s.env.touch('svc'); } break;
      case 'reload': {
        if (u.pseudo) break; const x = LX.reloadService(W, d, k); s.env.advance(1);
        if (x.notRunning) { o.l('Failed to reload ' + u.unit + ': Unit ' + u.unit + ' is not active.', 'e'); bad = 1; break; }
        if (!x.ok) { o.l('Job for ' + u.unit + ' failed because the control process exited with error code.', 'e'); o.l('See "systemctl status ' + u.unit + '" and "journalctl -xeu ' + u.unit + '" for details.', 'e'); bad = 1; break; }
        r.mutated = true; s.env.touch('svc'); break;
      }
      case 'enable': case 'disable': { if (u.pseudo) break; const on = verb === 'enable'; if (d.svc[k].masked) { o.l('Failed to ' + verb + ' unit: Unit file ' + unitFile(k) + ' is masked.', 'e'); bad = 1; break; } d.svc[k].enabled = on; const unit = u.unit;
        if (on) { o.l('Synchronizing state of ' + unit + ' with SysV service script with /usr/lib/systemd/systemd-sysv-install.'); o.l('Executing: /usr/lib/systemd/systemd-sysv-install enable ' + unit.replace('.service', '')); o.l(U.av('systemctl-symlink', 'Created symlink \'/etc/systemd/system/multi-user.target.wants/' + unit + '\' → \'' + unitFile(k) + '\'.')); }
        else { o.l('Synchronizing state of ' + unit + ' with SysV service script with /usr/lib/systemd/systemd-sysv-install.'); o.l('Executing: /usr/lib/systemd/systemd-sysv-install disable ' + unit.replace('.service', '')); o.l('Removed \'/etc/systemd/system/multi-user.target.wants/' + unit + '\'.'); }
        r.mutated = true; s.env.touch('svc'); if (flags.indexOf('--now') >= 0) ctlStart(s, u, o, r, on ? 'start' : 'stop'); if (flags.indexOf('--now') >= 0 && !on) { LX.stopService(W, d, k); r.impact = 'svc-stop'; } break; }
      case 'mask': d.svc[k].masked = true; if (LX.svcRun(d, k)) LX.stopService(W, d, k); o.l('Created symlink \'/etc/systemd/system/' + u.unit + '\' → \'/dev/null\'.'); r.mutated = true; s.env.touch('svc'); break;
      case 'unmask': d.svc[k].masked = false; o.l('Removed \'/etc/systemd/system/' + u.unit + '\'.'); r.mutated = true; s.env.touch('svc'); break;
      case 'cat': { const x = LX.SERVICES[k]; o.l('# ' + unitFile(k)); o.l('[Unit]'); o.l('Description=' + x.desc); o.blank(); o.l('[Service]'); o.l('ExecStart=' + x.exec); break; }
      case 'show': o.l('Id=' + u.unit); o.l('ActiveState=' + (d.svc[k].state)); o.l('SubState=' + (d.svc[k].sub || 'dead')); break;
      case 'reset-failed': if (d.svc[k].state === 'failed') { d.svc[k].state = 'inactive'; d.svc[k].sub = 'dead'; r.mutated = true; s.env.touch('svc'); } break;
      default: o.l('Unknown command verb \'' + verb + '\'.', 'e'); bad = 1;
    }
  });
  return bad;
}
C.systemctl = ctl;
C.service = (s, a, o, r) => {
  const name = a[0], verb = a[1];
  if (a.indexOf('--status-all') >= 0) { Object.keys(s.d.svc).forEach(k => o.l(' [ ' + (s.d.svc[k].state === 'active' ? '+' : '-') + ' ]  ' + k)); return; }
  if (!name || !verb) { o.l('Usage: service < option > | --status-all | [ service_name [ command | --full-restart ] ]', 'e'); return 1; }
  return ctl(s, [verb, name], o, r);
};
function doReboot(s, o, r, kind) {
  const d = s.d, W = s.W;
  if (kind === 'poweroff') { d.phys = d.phys || {}; d.phys.on = false; o.l(s.remote ? 'Connection to ' + (s.remote.target || s.remote.ip) + ' closed by remote host.' : ''); r.exit = true; r.powerOff = true; r.mutated = true; r.impact = 'poweroff'; s.env.touch('power'); return; }
  SIM.steps.reboot(W, { dev: d.id }); s.env.advance(75);
  r.reboot = true; r.exit = true; r.mutated = true; r.impact = 'reboot'; s.env.touch('reboot'); if (s.remote) o.l('Connection to ' + (s.remote.target || s.remote.ip) + ' closed by remote host.'); }
S.reboot = (s, a, o, r) => doReboot(s, o, r, 'reboot'); S.shutdown = (s, a, o, r) => doReboot(s, o, r, a.some(x => /^-[hP]$|poweroff|halt/.test(x)) ? 'poweroff' : 'reboot'); S.poweroff = (s, a, o, r) => doReboot(s, o, r, 'poweroff'); S.halt = S.poweroff;
C.reboot = (s, a, o, r) => (isRoot(s) ? doReboot(s, o, r, 'reboot') : (o.l('Failed to set wall message, ignoring: Interactive authentication required.', 'e'), o.l('Failed to reboot system via logind: Interactive authentication required.', 'e'), o.l('Failed to open initctl fifo: Permission denied', 'e'), o.l('Failed to talk to init daemon.', 'e'), 1));
C.shutdown = C.reboot; C.poweroff = C.reboot;
S.ifup = (s, a, o, r) => {
  const d = s.d; const nm = a.filter(x => x[0] !== '-')[0]; if (!d.ifaces[nm]) { o.l('ifup: unknown interface ' + (nm || ''), 'e'); return 1; }
  d.ifaces[nm].adminDown = false; const x = LX.netApply(s.W, d); r.mutated = true; s.env.touch('iface'); if (!x.ok) { x.errors.forEach(e => o.l('ifup: ' + e, 'e')); return 1; } };
S.ifdown = (s, a, o, r) => { const d = s.d; const nm = a.filter(x => x[0] !== '-')[0]; if (!d.ifaces[nm]) { o.l('ifdown: unknown interface ' + (nm || ''), 'e'); return 1; } d.ifaces[nm].adminDown = true; r.mutated = true; s.env.touch('iface'); };

/* ------------------------------------------------------------------ Apache / nginx / BIND / sshd / rndc */
function apacheCtl(s, a, o, r) {
  if (!isRoot(s)) { /* apachectl exige les droits sur /var/run et /var/log */ }
  const d = s.d; const verb = a.filter(x => x[0] !== '-')[0] || a.find(x => x === '-t' || x === '-S' || x === '-M' || x === '-v') || '';
  const cfg = () => LX.apacheCheck(d);
  if (verb === 'configtest' || verb === '-t') { const ck = cfg(); ck.lines.forEach(l => o.l(l, ck.ok || l === 'Syntax OK' || /^AH00112/.test(l) ? 'o' : 'e')); return ck.ok ? 0 : 1; }
  if (verb === '-S') { const c = LX.parseApache(d); if (c.errors.length) { const ck = cfg(); ck.lines.forEach(l => o.l(l, 'e')); return 1; } o.l('VirtualHost configuration:'); c.vhosts.forEach(v => { o.l(B.padR(v.addr + ':' + v.port, 22) + ' ' + (v.serverName || '*') + ' (' + v.file + ':' + v.line + ')'); }); o.l('ServerRoot: "/etc/apache2"'); o.l('Main DocumentRoot: "/var/www/html"'); o.l('Main ErrorLog: "/var/log/apache2/error.log"'); return 0; }
  if (verb === '-M') { const c = LX.parseApache(d); o.l('Loaded Modules:'); c.mods.forEach(m => o.l(' ' + m + '_module (shared)')); return 0; }
  if (verb === '-v') { o.l('Server version: Apache/2.4 (Debian)'); return 0; }
  if (verb === 'start' || verb === 'stop' || verb === 'restart' || verb === 'graceful' || verb === 'reload') {
    if (!isRoot(s)) { o.l('(13)Permission denied: AH00091: apache2: could not open error log file /var/log/apache2/error.log.', 'e'); o.l('AH00015: Unable to open logs', 'e'); o.l('Action \'' + verb + '\' failed.', 'e'); o.l('The Apache error log may have more information.', 'e'); return 1; }
    return ctl(s, [verb === 'graceful' ? 'reload' : verb, 'apache2'], o, r); }
  o.l('Usage: apachectl start|stop|restart|graceful|configtest|-S|-M', 'e'); return 1;
}
S.apachectl = apacheCtl; S.apache2ctl = apacheCtl; S.apache2 = apacheCtl;
function a2(kind, verb) {
  return (s, a, o, r) => {
    const d = s.d; const nm = a.filter(x => x[0] !== '-')[0];
    if (!isRoot(s)) { o.l('ERROR: This script requires root privileges.', 'e'); return 1; }
    if (!nm) { o.l('Your choices are: ' + LX.list(d, '/etc/apache2/' + (kind === 'site' ? 'sites' : 'mods') + '-available').map(x => x.replace(/\.(conf|load)$/, '')).join(' '), 'e'); o.l('Which ' + kind + ' do you want to ' + (verb === 'en' ? 'enable' : 'disable') + '? ', 'e'); return 1; }
    const dirA = '/etc/apache2/' + (kind === 'site' ? 'sites' : 'mods') + '-available', dirE = '/etc/apache2/' + (kind === 'site' ? 'sites' : 'mods') + '-enabled';
    const file = kind === 'site' ? nm.replace(/\.conf$/, '') + '.conf' : nm + '.load'; const avail = dirA + '/' + file; const en = dirE + '/' + file;
    if (verb === 'en') {
      if (!d.fs[avail]) { o.l('ERROR: ' + (kind === 'site' ? 'Site' : 'Module') + ' ' + nm + ' does not exist!', 'e'); return 1; }
      if (d.fs[en]) { o.l((kind === 'site' ? 'Site ' : 'Module ') + nm + ' already enabled'); return 0; }
      d.fs[en] = { t: 'l', target: '../' + (kind === 'site' ? 'sites' : 'mods') + '-available/' + file, m: '0777', o: 'root', g: 'root', mt: s.W.now().getTime() };
      o.l('Enabling ' + kind + ' ' + nm + '.'); o.l('To activate the new configuration, you need to run:'); o.l('  systemctl ' + (kind === 'site' ? 'reload' : 'restart') + ' apache2');
    } else {
      if (!d.fs[en]) { o.l('Site ' .replace('Site', kind === 'site' ? 'Site' : 'Module') + nm + ' already disabled'); return 0; }
      delete d.fs[en]; o.l((kind === 'site' ? 'Site ' : 'Module ') + nm + ' disabled.'); o.l('To activate the new configuration, you need to run:'); o.l('  systemctl ' + (kind === 'site' ? 'reload' : 'restart') + ' apache2');
    }
    s.mut(r); r.mutated = true;
  };
}
S.a2ensite = a2('site', 'en'); S.a2dissite = a2('site', 'dis'); S.a2enmod = a2('module', 'en'); S.a2dismod = a2('module', 'dis');
S.nginx = (s, a, o, r) => {
  const d = s.d; const ck = () => LX.nginxCheck(d);
  if (a.indexOf('-t') >= 0 || a.indexOf('-T') >= 0) { if (!isRoot(s)) { o.l('nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)', 'e'); }
    const c = ck(); c.lines.forEach(l => o.l(l, c.ok ? 'o' : 'e')); return c.ok ? 0 : 1; }
  if (a.indexOf('-v') >= 0 || a.indexOf('-V') >= 0) { o.l('nginx version: nginx/1.26'); return; }
  const si = a.indexOf('-s'); if (si >= 0) { if (!isRoot(s)) { o.l('nginx: [error] open() "/run/nginx.pid" failed (13: Permission denied)', 'e'); return 1; } const sig = a[si + 1]; return ctl(s, [sig === 'reload' ? 'reload' : sig === 'stop' || sig === 'quit' ? 'stop' : 'restart', 'nginx'], o, r); }
  o.l('nginx: usage: nginx -t | -s reload', 'e'); return 1;
};
C['named-checkconf'] = (s, a, o, r) => { const ck = LX.bindCheckConf(s.d); if (ck.ok) return 0; ck.lines.forEach(l => o.l(l, 'e')); return 1; };
C['named-checkzone'] = (s, a, o, r) => {
  const args = a.filter(x => x[0] !== '-'); if (args.length < 2) { o.l('usage: named-checkzone [-djqvD] [-c class] [-f format] [-F format] [-J filename] [-i mode] [-k mode] [-m mode] [-M mode] [-n mode] [-l ttl] [-L serial] [-o filename] [-r mode] [-s style] [-S mode] [-t directory] [-T mode] [-w directory] [-D] [-W mode] zonename filename', 'e'); return 1; }
  const p = LX.parseZone(s.d, args[0], args[1][0] === '/' ? args[1] : '/etc/bind/' + args[1]);
  if (!p.ok) { o.l(p.err, 'e'); o.l('zone ' + args[0] + '/IN: not loaded due to errors.', 'e'); return 1; }
  o.l('zone ' + args[0] + '/IN: loaded serial ' + p.serial); o.l('OK'); return 0;
};
S.rndc = (s, a, o, r) => {
  const d = s.d; const verb = a[0]; if (!d.svc.bind9) { o.l('rndc: command not found', 'e'); return 127; }
  if (!isRoot(s)) { o.l(U.av('rndc-perm', 'rndc: neither /etc/bind/rndc.conf nor /etc/bind/rndc.key was found'), 'e'); return 1; }
  if (!LX.svcRun(d, 'bind9')) { o.l('rndc: connect failed: 127.0.0.1#953: connection refused', 'e'); return 1; }
  if (verb === 'reload' || verb === 'reconfig') { const x = LX.reloadService(s.W, d, 'bind9'); r.mutated = true; s.env.touch('svc'); if (!x.ok) { o.l('rndc: \'' + verb + '\' failed: failure', 'e'); return 1; } o.l(verb === 'reload' ? 'server reload successful' : 'server reconfig successful'); return; }
  if (verb === 'flush') { return 0; }
  if (verb === 'status') { o.l('version: BIND 9.20 (Debian)'); o.l('running on ' + s.host() + ': Linux x86_64 ' + d.kernel); o.l('boot time: ' + fmtFull(LX.svcRun(d, 'bind9').since)); o.l('number of zones: ' + LX.svcRun(d, 'bind9').snap.zones.length); o.l('server is up and running'); return; }
  o.l('rndc: unknown command \'' + verb + '\'', 'e'); return 1;
};
S.sshd = (s, a, o, r) => {
  const ck = LX.SERVICES.ssh.check(s.d); if (a.indexOf('-t') >= 0 || a.indexOf('-T') >= 0) { if (!ck.ok) { ck.lines.forEach(l => o.l(l, 'e')); return 255; } return 0; }
  o.l('sshd: this program is managed by systemd; use systemctl', 'e'); return 1;
};

/* ------------------------------------------------------------------ pare-feu ufw */
const UFW_SVC = { ssh: '22/tcp', http: '80/tcp', https: '443/tcp', mysql: '3306/tcp', domain: '53', dns: '53', smtp: '25/tcp', 'www': '80/tcp', 'OpenSSH': '22/tcp' };
function ufwText(r, verbose) { return null; }
function ufwRuleRows(d, verbose, numbered) {
  const rows = []; d.ufw.rules.forEach((rl, i) => { const to = rl.to; const from = rl.from || 'Anywhere'; rows.push({ n: i + 1, to, act: rl.action + (verbose || numbered ? ' IN' : ''), from }); if (!rl.from || rl.from === 'Anywhere') rows.push({ n: null, to: to + ' (v6)', act: rl.action + (verbose || numbered ? ' IN' : ''), from: 'Anywhere (v6)' }); });
  return rows;
}
S.ufw = (s, a, o, r) => {
  const d = s.d; if (!d.ufw) { o.l('ufw: command not found', 'e'); return 127; }
  if (!isRoot(s)) { o.l('ERROR: You need to be root to run this script', 'e'); return 1; }
  const args = a.filter(x => x !== '--force'); const verb = args[0]; const force = a.indexOf('--force') >= 0;
  const toSpec = (rest) => {
    let proto = null, port = null, from = null; const t = rest.slice();
    let i = 0; let action = null; let spec = null;
    if (t[0] === 'from') { from = t[1] === 'any' ? 'Anywhere' : t[1]; i = 2; const pi = t.indexOf('port'); if (t[i] === 'to') { const dst = t[i + 1]; i += 2; if (t[i] === 'port') { port = t[i + 1]; i += 2; } } if (t[i] === 'proto') { proto = t[i + 1]; } if (port) spec = port + (proto ? '/' + proto : ''); else spec = proto ? proto : 'Anywhere'; }
    else if (t[0] === 'in' || t[0] === 'out') { spec = t[1]; }
    else spec = t[0];
    if (spec && UFW_SVC[spec]) spec = UFW_SVC[spec];
    return { to: spec, from: from || 'Anywhere' };
  };
  if (verb === 'status') {
    if (!d.ufw.enabled) { o.l('Status: inactive'); return; }
    const verbose = args[1] === 'verbose'; const numbered = args[1] === 'numbered'; o.l('Status: active'); if (verbose) { o.l('Logging: on (low)'); o.l('Default: ' + d.ufw.defaultIn + ' (incoming), ' + (d.ufw.defaultOut || 'allow') + ' (outgoing), disabled (routed)'); o.l('New profiles: skip'); }
    o.blank(); const rows = ufwRuleRows(d, verbose, numbered);
    const wt = Math.max(2, ...rows.map(x => x.to.length + (numbered && x.n ? 5 : 0)), 26 - 0); const wa = Math.max(6, ...rows.map(x => x.act.length)) + 0;
    const pre = numbered ? '     ' : '';
    o.l((numbered ? '     ' : '') + B.padR('To', wt) + ' ' + B.padR('Action', 12) + ' From'); o.l((numbered ? '     ' : '') + B.padR('--', wt) + ' ' + B.padR('------', 12) + ' ----');
    rows.forEach(x => o.l((numbered ? B.padR(x.n ? '[' + B.padL(x.n, 2) + '] ' : '', 5) : '') + B.padR(x.to, wt) + ' ' + B.padR(x.act, 12) + ' ' + x.from)); return;
  }
  if (verb === 'enable') { const go = () => { d.ufw.enabled = true; r.mutated = true; s.env.touch('ufw'); return { out: [L('Firewall is active and enabled on system startup')] }; }; if (force) { o.lines.push(...go().out); return; } r.ask = { prompt: 'Command may disrupt existing ssh connections. Proceed with operation (y|n)? ', echo: true, cb: l => (/^y/i.test(l) ? (r.mutated = true, go()) : { out: [L('Aborted')] }) }; return; }
  if (verb === 'disable') { d.ufw.enabled = false; r.mutated = true; s.env.touch('ufw'); o.l('Firewall stopped and disabled on system startup'); return; }
  if (verb === 'reload') { r.mutated = true; s.env.touch('ufw'); o.l('Firewall reloaded'); return; }
  if (verb === 'reset') { d.ufw.rules = []; d.ufw.enabled = false; r.mutated = true; s.env.touch('ufw'); o.l('Resetting all rules to installed defaults. This may disrupt existing ssh connections. Proceed with operation (y|n)? y'); o.l('Backing up \'user.rules\' to \'/etc/ufw/user.rules.' + U.hash8(d.id) + '\''); return; }
  if (verb === 'default') { const pol = args[1], dir = args[2]; if (['allow', 'deny', 'reject'].indexOf(pol) < 0) { o.l('ERROR: Invalid policy \'' + pol + '\'', 'e'); return 1; } if (dir === 'incoming') d.ufw.defaultIn = pol; else d.ufw.defaultOut = pol; r.mutated = true; s.env.touch('ufw'); o.l('Default ' + dir + ' policy changed to \'' + pol + '\''); o.l('(be sure to update your rules accordingly)'); return; }
  if (verb === 'allow' || verb === 'deny' || verb === 'reject' || verb === 'limit' || verb === 'insert') {
    let rest = args.slice(1); let idx = null; let act = verb;
    if (verb === 'insert') { idx = +rest[0]; act = rest[1]; rest = rest.slice(2); }
    const sp = toSpec(rest); if (!sp.to) { o.l('ERROR: Bad source address', 'e'); return 1; }
    const rule = { to: sp.to, from: sp.from, action: ({ allow: 'ALLOW', deny: 'DENY', reject: 'REJECT', limit: 'LIMIT' })[act] };
    const dup = d.ufw.rules.find(x => x.to === rule.to && (x.from || 'Anywhere') === rule.from && x.action === rule.action);
    if (dup) { o.l('Skipping adding existing rule'); if (rule.from === 'Anywhere') o.l('Skipping adding existing rule (v6)'); return; }
    if (idx) d.ufw.rules.splice(Math.max(0, idx - 1), 0, rule); else d.ufw.rules.push(rule);
    r.mutated = true; s.env.touch('ufw'); o.l(d.ufw.enabled || true ? 'Rule ' + (idx ? 'inserted' : 'added') : ''); if (rule.from === 'Anywhere') o.l('Rule ' + (idx ? 'inserted' : 'added') + ' (v6)'); return;
  }
  if (verb === 'delete') {
    const doDel = (i) => { const rl = d.ufw.rules[i]; d.ufw.rules.splice(i, 1); r.mutated = true; s.env.touch('ufw'); return rl; };
    if (/^\d+$/.test(args[1])) { const i = +args[1] - 1; const rl = d.ufw.rules[i]; if (!rl) { o.l('ERROR: Could not delete non-existent rule', 'e'); return 1; } const desc = (rl.action || '').toLowerCase() + (rl.from && rl.from !== 'Anywhere' ? ' from ' + rl.from + ' to any port ' + rl.to.replace(/\/.*/, '') + (rl.to.indexOf('/') > 0 ? ' proto ' + rl.to.split('/')[1] : '') : ' ' + rl.to);
      const go = () => { doDel(i); return { out: [L('Rule deleted')] }; }; o.l('Deleting:'); o.l(' ' + desc);
      if (force) { o.lines.push(...go().out); return; } r.ask = { prompt: 'Proceed with operation (y|n)? ', echo: true, cb: l => (/^y/i.test(l) ? (r.mutated = true, go()) : { out: [L('Aborted')] }) }; return; }
    const act = args[1]; const sp = toSpec(args.slice(2)); const i = d.ufw.rules.findIndex(x => x.to === sp.to && (x.from || 'Anywhere') === sp.from && x.action === ({ allow: 'ALLOW', deny: 'DENY', reject: 'REJECT' })[act]);
    if (i < 0) { o.l('Could not delete non-existent rule'); if (sp.from === 'Anywhere') o.l('Could not delete non-existent rule (v6)'); return; }
    doDel(i); o.l('Rule deleted'); if (sp.from === 'Anywhere') o.l('Rule deleted (v6)'); return;
  }
  if (verb === 'logging') { o.l('Logging enabled'); return; }
  o.l('ERROR: Invalid syntax', 'e'); o.l('Usage: ufw COMMAND', 'e'); return 1;
};

/* ------------------------------------------------------------------ réseau : ip, ss, ping, tracepath… */
function ifState(s, nm) {
  const d = s.d, i = d.ifaces[nm]; const admin = !i.adminDown; const up = admin && N.linkUp(s.W, d, nm);
  return { admin, up, flags: !admin ? '<BROADCAST,MULTICAST>' : up ? '<BROADCAST,MULTICAST,UP,LOWER_UP>' : '<NO-CARRIER,BROADCAST,MULTICAST,UP>', state: up ? 'UP' : 'DOWN' };
}
function ipCidr(i) { return i.ip && i.mask ? i.ip + '/' + U.mask2len(i.mask) : null; }
function bcast(i) { return U.n2ip((U.ip2n(i.ip) | ((~U.ip2n(i.mask)) >>> 0)) >>> 0); }
C.ip = (s, a, o, r) => {
  const d = s.d; let flags = a.filter(x => x[0] === '-' && !/^-(family|f)$/.test(x)); const args = a.filter(x => x[0] !== '-'); const brief = flags.some(x => /^-(br|brief)$/.test(x) || x === '-o');
  let obj = (args[0] || 'addr').toLowerCase(); const cmd = (args[1] || 'show').toLowerCase();
  const full = (list, w) => list.find(x => x.indexOf(w) === 0);
  obj = full(['address', 'addr', 'a', 'route', 'r', 'link', 'l', 'neigh', 'neighbor', 'n', 'rule'], obj) ? obj : obj;
  const names = Object.keys(d.ifaces);
  const isAddr = ['a', 'addr', 'address', 'ad', 'add'].indexOf(obj) >= 0 || /^addr/.test(obj); const isRoute = obj === 'r' || /^ro/.test(obj); const isLink = obj === 'l' || /^li/.test(obj) || obj === 'link'; const isNeigh = obj === 'n' || /^nei/.test(obj);
  const modify = ['add', 'del', 'delete', 'flush', 'set', 'replace', 'change'].indexOf(cmd) >= 0;
  if (modify && !isRoot(s)) { o.l('RTNETLINK answers: Operation not permitted', 'e'); return 2; }
  if (isAddr && !modify) {
    const di = args.indexOf('dev'); const only = di >= 0 ? args[di + 1] : (args[2] && d.ifaces[args[2]] ? args[2] : (args[1] && d.ifaces[args[1]] ? args[1] : null)); const list = names.filter(n => !only || only === n);
    if (brief) { o.l(B.padR('lo', 16) + B.padR('UNKNOWN', 15) + '127.0.0.1/8 ::1/128 '); list.forEach(n => { const i = d.ifaces[n]; const st = ifState(s, n); o.l(B.padR(n, 16) + B.padR(st.state, 15) + (ipCidr(i) || '')); }); return; }
    if (!only) { o.l('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000'); o.l('    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00'); o.l('    inet 127.0.0.1/8 scope host lo'); o.l('       valid_lft forever preferred_lft forever'); o.l('    inet6 ::1/128 scope host noprefixroute '); o.l('       valid_lft forever preferred_lft forever'); }
    list.forEach((n, idx) => { const i = d.ifaces[n]; const st = ifState(s, n); o.l((names.indexOf(n) + 2) + ': ' + n + ': ' + st.flags + ' mtu 1500 qdisc fq_codel state ' + st.state + ' group default qlen 1000'); o.l('    link/ether ' + E.macColon(i.mac) + ' brd ff:ff:ff:ff:ff:ff'); if (i.ip && i.mask) { o.l('    inet ' + ipCidr(i) + ' brd ' + bcast(i) + ' scope global ' + n); o.l('       valid_lft forever preferred_lft forever'); } (i.extra || []).forEach(x => { o.l('    inet ' + x + ' scope global secondary ' + n); o.l('       valid_lft forever preferred_lft forever'); }); if (st.up) { o.l('    inet6 fe80::' + U.hash8(i.mac).slice(0, 4) + ':' + U.hash8(i.mac + 'a').slice(0, 4) + ':' + U.hash8(i.mac + 'b').slice(0, 4) + ':' + U.hash8(i.mac + 'c').slice(0, 4) + '/64 scope link '); o.l('       valid_lft forever preferred_lft forever'); } });
    return;
  }
  if (isAddr && modify) {
    const nm = args[args.indexOf('dev') + 1]; const ic = d.ifaces[nm]; if (!ic) { o.l('Cannot find device "' + (nm || '') + '"', 'e'); return 1; }
    if (cmd === 'add') { const cidr = args[2]; const m = (cidr || '').match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/); if (!m || !U.isIP(m[1])) { o.l('Error: any valid prefix is expected rather than "' + (cidr || '') + '".', 'e'); return 1; } if (ic.ip && ic.ip === m[1]) { o.l('RTNETLINK answers: File exists', 'e'); return 2; } if (!ic.ip) { ic.ip = m[1]; ic.mask = U.len2mask(+m[2]); } else { ic.extra = ic.extra || []; ic.extra.push(cidr); } }
    else if (cmd === 'del' || cmd === 'delete') { const cidr = args[2]; if (ic.ip && cidr.split('/')[0] === ic.ip) { ic.ip = ''; ic.mask = ''; ic.gw = ''; } else if (ic.extra && ic.extra.indexOf(cidr) >= 0) ic.extra.splice(ic.extra.indexOf(cidr), 1); else { o.l('Error: ipv4: Address not found.', 'e'); return 2; } }
    else if (cmd === 'flush') { ic.ip = ''; ic.mask = ''; ic.gw = ''; ic.extra = []; }
    r.mutated = true; s.env.touch('iface'); return;
  }
  if (isLink) {
    if (cmd === 'set') { const nm = args[2]; const ic = d.ifaces[nm]; if (!ic) { o.l('Cannot find device "' + (nm || '') + '"', 'e'); return 1; } if (args.indexOf('down') >= 0) ic.adminDown = true; else if (args.indexOf('up') >= 0) ic.adminDown = false; r.mutated = true; s.env.touch('iface'); return; }
    if (brief) { o.l(B.padR('lo', 16) + B.padR('UNKNOWN', 15) + '00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP> '); names.forEach(n => { const st = ifState(s, n); o.l(B.padR(n, 16) + B.padR(st.state, 15) + E.macColon(d.ifaces[n].mac) + ' ' + st.flags); }); return; }
    o.l('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000'); o.l('    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00');
    names.forEach((n, i) => { const st = ifState(s, n); o.l((i + 2) + ': ' + n + ': ' + st.flags + ' mtu 1500 qdisc fq_codel state ' + st.state + ' mode DEFAULT group default qlen 1000'); o.l('    link/ether ' + E.macColon(d.ifaces[n].mac) + ' brd ff:ff:ff:ff:ff:ff'); }); return;
  }
  if (isRoute) {
    if (modify) {
      const via = args[args.indexOf('via') + 1]; const dst = args[2];
      if (cmd === 'add' || cmd === 'replace' || cmd === 'change') { if (dst === 'default') { const ic = d.ifaces[args[args.indexOf('dev') + 1] || names[0]]; if (!via || !U.isIP(via)) { o.l('Error: inet address is expected rather than "' + (via || '') + '".', 'e'); return 1; } if (!U.inNet(via, ic.ip, ic.mask)) { o.l('Error: Nexthop has invalid gateway.', 'e'); return 2; } if (ic.gw && cmd === 'add') { o.l('RTNETLINK answers: File exists', 'e'); return 2; } ic.gw = via; } else { o.l('ip route : routes statiques autres que default non prises en charge dans cette simulation', 'e'); return 1; } }
      else if (cmd === 'del' || cmd === 'delete') { if (dst === 'default') { let hit = false; names.forEach(n => { if (d.ifaces[n].gw) { d.ifaces[n].gw = ''; hit = true; } }); if (!hit) { o.l('RTNETLINK answers: No such process', 'e'); return 2; } } }
      r.mutated = true; s.env.touch('route'); return;
    }
    names.forEach(n => { const i = d.ifaces[n]; const st = ifState(s, n); if (!i.ip || !st.admin) return; if (i.gw) o.l('default via ' + i.gw + ' dev ' + n + ' onlink '); }); names.forEach(n => { const i = d.ifaces[n]; const st = ifState(s, n); if (!i.ip || !st.admin) return; o.l(U.netAddr(i.ip, i.mask) + '/' + U.mask2len(i.mask) + ' dev ' + n + ' proto kernel scope link src ' + i.ip + (st.up ? '' : ' linkdown ')); }); return;
  }
  if (isNeigh) { names.forEach(n => { const i = d.ifaces[n]; if (!i.gw) return; const mac = W_.macOfIp(s.W, i.gw); if (mac) o.l(i.gw + ' dev ' + n + ' lladdr ' + E.macColon(mac) + ' REACHABLE'); }); return; }
  o.l('Object "' + args[0] + '" is unknown, try "ip help".', 'e'); return 1;
};
function ssTable(s, a, o) {
  const d = s.d, W = s.W; const f = a.filter(x => x[0] === '-').join('').replace(/-/g, ''); const t = /t/.test(f), u = /u/.test(f), l = /l/.test(f), n = /n/.test(f), p = /p/.test(f), all = /a/.test(f);
  const rows = []; const lis = LX.listeners(W, d); const addr = (ip, port) => ip + ':' + port;
  const ifips = N.l3up(W, d).map(x => x.ip);
  lis.forEach(e => {
    if ((e.proto === 'tcp' && !(t || (!t && !u))) || (e.proto === 'udp' && !(u || (!t && !u)))) return;
    const proc = (isRoot(s) || e.proc === '-') ? 'users:(("' + e.proc + '",pid=' + e.pid + ',fd=' + (e.proto === 'tcp' ? 4 : 5) + '))' : '';
    const push = (la, backlog) => rows.push({ netid: e.proto, state: e.proto === 'tcp' ? 'LISTEN' : 'UNCONN', rq: 0, sq: backlog, la, pa: e.proto === 'tcp' ? '0.0.0.0:*' : '0.0.0.0:*', proc: p ? proc : '', svc: e.svc });
    const bl = e.proto === 'tcp' ? (e.svc === 'apache2' ? 511 : e.svc === 'mariadb' ? 80 : e.svc === 'bind9' ? 10 : 128) : 0;
    if (e.svc === 'apache2') { rows.push({ netid: e.proto, state: 'LISTEN', rq: 0, sq: bl, la: '*:' + e.port, pa: '*:*', proc: p ? proc : '' }); return; }
    if (e.svc === 'bind9') { const addrs = ifips.concat(['127.0.0.1']); addrs.forEach(ip => rows.push({ netid: e.proto, state: e.proto === 'tcp' ? 'LISTEN' : 'UNCONN', rq: 0, sq: bl, la: addr(ip, e.port), pa: '0.0.0.0:*', proc: p ? proc : '' })); return; }
    push(addr(e.addr === '0.0.0.0' && n ? '0.0.0.0' : e.addr, e.port), bl);
    if (e.svc === 'ssh' || e.svc === 'nginx') rows.push({ netid: e.proto, state: 'LISTEN', rq: 0, sq: bl, la: '[::]:' + e.port, pa: '[::]:*', proc: p ? proc : '' });
  });
  const both = (t && u) || (!t && !u);
  const head = [].concat(both ? ['Netid'] : [], ['State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', p ? 'Process' : '']);
  const cells = rows.map(rw => [].concat(both ? [rw.netid] : [], [rw.state, String(rw.rq), String(rw.sq), rw.la, rw.pa, rw.proc]));
  const wd = head.map((h, i) => Math.max(h.length, ...cells.map(c => c[i].length)));
  const off = both ? 1 : 0;
  const line = c => c.map((v, i) => (i === off + 3 ? B.padL(v, wd[i]) : B.padR(v, wd[i]))).join('  ').replace(/\s+$/, '');
  o.l(line(head)); cells.forEach(c => o.l(line(c)));
}
C.ss = (s, a, o, r) => { ssTable(s, a, o); };
C.netstat = (s, a, o) => {
  const f = a.filter(x => x[0] === '-').join('').replace(/-/g, ''); const lis = LX.listeners(s.W, s.d); o.l('Active Internet connections (only servers)'); o.l('Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name');
  lis.forEach(e => o.l(B.padR(e.proto, 6) + B.padL(0, 6) + B.padL(0, 7) + ' ' + B.padR((e.addr === '0.0.0.0' ? '0.0.0.0' : e.addr) + ':' + e.port, 23) + ' ' + B.padR('0.0.0.0:*', 23) + ' ' + B.padR(e.proto === 'tcp' ? 'LISTEN' : '', 11) + ' ' + (/p/.test(f) && isRoot(s) ? e.pid + '/' + e.proc : '-')));
};
C.ifconfig = (s, a, o) => { const d = s.d; Object.keys(d.ifaces).forEach(n => { const i = d.ifaces[n]; const st = ifState(s, n); o.l(n + ': flags=' + (st.up ? '4163<UP,BROADCAST,RUNNING,MULTICAST>' : '4099<UP,BROADCAST,MULTICAST>') + '  mtu 1500'); if (i.ip) o.l('        inet ' + i.ip + '  netmask ' + i.mask + '  broadcast ' + bcast(i)); o.l('        ether ' + E.macColon(i.mac) + '  txqueuelen 1000  (Ethernet)'); o.blank(); }); o.l('lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536'); o.l('        inet 127.0.0.1  netmask 255.0.0.0'); o.blank(); };
function linuxResolve(s, target) { const r = W_.resolveHost(s, target); return r; }
C.ping = (s, a, o, r) => {
  const d = s.d, W = s.W; let count = null, size = 56, wait = 2, target = null, iface = null;
  for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-c') count = +a[++i]; else if (/^-c\d+$/.test(x)) count = +x.slice(2); else if (x === '-s') size = +a[++i]; else if (x === '-W' || x === '-w' || x === '-i') i++; else if (x === '-I') iface = a[++i]; else if (x[0] !== '-') target = x; }
  if (!target) { o.l('ping: usage error: Destination address required', 'e'); return 2; }
  let ip = target;
  if (!U.isIP(target)) { const res = linuxResolve(s, target); if (!res.ok) { o.l('ping: ' + target + ': ' + (res.err === 'nxdomain' ? 'Name or service not known' : 'Temporary failure in name resolution'), 'e'); s.env.obs('ping:' + d.id + ':' + target, false); s.env.advance(res.err === 'nxdomain' ? 1 : 10); return 2; } ip = res.ip; }
  o.l('PING ' + target + ' (' + ip + ') ' + size + '(' + (size + 28) + ') bytes of data.');
  const stats = { sent: 0, recv: 0, ms: [] };
  const step = (seq) => {
    const p = N.ping(W, d.id, ip); stats.sent++; s.env.obs('ping:' + d.id + ':' + target, p.ok);
    if (p.ok) {
      stats.recv++; const dst = p.trace.dstDev ? W.d(p.trace.dstDev) : null; const hops = E.hopCount(p.trace);
      const ms = 0.18 + hops * 0.42 + ((seq * 37 + hops * 11) % 90) / 1000; stats.ms.push(ms); s.env.advance(1);
      const ttl = Math.max(1, E.baseTtl(dst) - hops);
      return L('64 bytes from ' + ip + ': icmp_seq=' + (seq + 1) + ' ttl=' + ttl + ' time=' + ms.toFixed(ms < 10 ? 3 : 1) + ' ms');
    }
    s.env.advance(p.kind === 'timeout' ? 2 : 1);
    if (p.kind === 'timeout') return null;
    if (p.kind === 'general') return L('ping: connect: Network is unreachable', 'e');
    const from = p.from || ((N.l3up(W, d)[0] || {}).ip);
    return L('From ' + from + ' icmp_seq=' + (seq + 1) + (p.kind === 'net' ? ' Destination Net Unreachable' : ' Destination Host Unreachable'));
  };
  const summary = () => { const loss = stats.sent ? Math.round(100 * (stats.sent - stats.recv) / stats.sent) : 0; const out = [L(''), L('--- ' + target + ' ping statistics ---'), L(stats.sent + ' packets transmitted, ' + stats.recv + ' received, ' + loss + '% packet loss, time ' + (Math.max(0, stats.sent - 1) * 1000 + (stats.sent > 1 ? 1 : 0)) + 'ms')];
    if (stats.ms.length) { const mn = Math.min(...stats.ms), mx = Math.max(...stats.ms), av = stats.ms.reduce((x, y) => x + y, 0) / stats.ms.length; const md = Math.sqrt(stats.ms.reduce((x, y) => x + (y - av) * (y - av), 0) / stats.ms.length); out.push(L('rtt min/avg/max/mdev = ' + mn.toFixed(3) + '/' + av.toFixed(3) + '/' + mx.toFixed(3) + '/' + md.toFixed(3) + ' ms')); } return out; };
  if (count === null) { let seq = 0; r.stream = { interval: 1000, next: () => { const l = step(seq++); return l ? [l] : []; }, stop: () => summary(), echoCtrlC: '^C' }; return; }
  for (let q = 0; q < count; q++) { const l = step(q); if (l) o.lines.push(l); }
  summary().forEach(x => o.lines.push(x)); return stats.recv ? 0 : 1;
};
C.traceroute = (s, a, o, r) => {
  const d = s.d, W = s.W; const target = a.filter(x => x[0] !== '-')[0]; const noRes = a.indexOf('-n') >= 0; if (!target) { o.l('Specify "host" missing argument.', 'e'); return 2; }
  let ip = target; if (!U.isIP(target)) { const res = linuxResolve(s, target); if (!res.ok) { o.l(target + ': Name or service not known', 'e'); o.l('Cannot handle "host" cmdline arg `' + target + '\' on position 1 (argc 1)', 'e'); return 2; } ip = res.ip; }
  const f = N.walk(W, d.id, ip, { proto: 'icmp', icmpType: 8 }, {}); const hops = (f.hops || []).slice(1, f.ok ? -1 : undefined).filter(h => !h.final);
  o.l('traceroute to ' + target + ' (' + ip + '), 30 hops max, 60 byte packets');
  const ms = (k) => (0.3 + k * 0.4).toFixed(3); const nm = (hip) => { if (noRes) return hip; const n = W_.ptrName(s, hip); return (n || hip) + ' (' + hip + ')'; };
  let n = 0; hops.forEach((h, idx) => { n++; o.l(B.padL(n, 2) + '  ' + nm(h.inIp) + '  ' + ms(idx) + ' ms  ' + ms(idx) + ' ms  ' + ms(idx) + ' ms'); });
  if (f.ok) { n++; o.l(B.padL(n, 2) + '  ' + nm(ip) + '  ' + ms(hops.length) + ' ms  ' + ms(hops.length) + ' ms  ' + ms(hops.length) + ' ms'); s.env.obs('ping:' + d.id + ':' + target, true); }
  else { for (let k = n + 1; k <= n + 3; k++) o.l(B.padL(k, 2) + '  * * *'); s.env.advance(12); s.env.obs('ping:' + d.id + ':' + target, false); return 1; }
};
C.curl = (s, a, o, r) => E.curlRun(s, a, o, r, 'lx');
function dnsServers(s, atServer) { return atServer ? [atServer] : N.dnsServersOf(s.W, s.d); }
function dnsAsk(s, name, type, servers) {
  const res = { state: 'noservers' };
  for (const sv of servers) { const q = N.dnsQuery(s.W, s.devId, sv, name, type); if (q.state === 'ok') return Object.assign(q, { sv }); res.state = 'timeout'; res.sv = sv; s.env.advance(5); }
  return res;
}
function revName(ip) { return ip.split('.').reverse().join('.') + '.in-addr.arpa'; }
function digCore(s, a, o, r, mode) {
  const d = s.d; let at = null, name = null, type = 'A', short = false; const argsRest = [];
  a.forEach(x => { if (x[0] === '@') at = x.slice(1); else if (x === '+short') short = true; else if (x === '-x') type = 'REV'; else if (/^\+/.test(x)) { } else argsRest.push(x); });
  if (type === 'REV') { name = argsRest[0]; } else { name = argsRest[0]; if (argsRest[1]) type = argsRest[1].toUpperCase(); }
  if (!name) { name = '.'; type = 'NS'; }
  let qname = name; if (type === 'REV') { qname = revName(name); type = 'PTR'; }
  const servers = dnsServers(s, at); const dot = qname.replace(/\.$/, '') + '.';
  const q = servers.length ? dnsAsk(s, qname.replace(/\.$/, ''), type, servers) : { state: 'noservers' };
  s.env.obs('resolve:' + d.id + ':' + name, q.state === 'ok' && q.rcode === 'NOERROR' && (q.answers || []).length > 0);
  if (!short) { o.blank(); o.l('; <<>> ' + U.av('dig-format', 'DiG 9.20 <<>>') + ' ' + a.join(' ')); o.l(';; global options: +cmd'); }
  if (q.state !== 'ok') { if (q.state === 'noservers') { if (!short) o.l(';; no servers could be reached'); return 9; } if (!short) { o.l(';; communications error to ' + q.sv + '#53: timed out'); o.l(';; communications error to ' + q.sv + '#53: timed out'); o.l(';; communications error to ' + q.sv + '#53: timed out'); o.l(';; no servers could be reached'); } else { o.l(';; communications error to ' + q.sv + '#53: timed out', 'e'); } return 9; }
  if (q.state === 'refused-port') { o.l(';; communications error to ' + q.sv + '#53: connection refused', 'e'); return 9; }
  const ans = q.answers || []; const aa = q.authoritative;
  if (short) { ans.forEach(x => o.l(x.type === 'CNAME' || x.type === 'PTR' || x.type === 'NS' ? x.data.replace(/\.?$/, '.') : x.data)); return; }
  o.l(';; Got answer:'); o.l(';; ->>HEADER<<- opcode: QUERY, status: ' + q.rcode + ', id: ' + (parseInt(U.hash8(qname + type), 16) % 60000 + 1000)); o.l(';; flags: qr ' + (aa ? 'aa ' : '') + 'rd ra; QUERY: 1, ANSWER: ' + ans.length + ', AUTHORITY: 0, ADDITIONAL: 1'); o.blank();
  o.l(';; OPT PSEUDOSECTION:'); o.l('; EDNS: version: 0, flags:; udp: 1232'); o.l(';; QUESTION SECTION:'); o.l(';' + dot + '\t\tIN\t' + type);
  if (ans.length) { o.blank(); o.l(';; ANSWER SECTION:'); ans.forEach(x => o.l(x.name.replace(/\.?$/, '.') + '\t' + (x.ttl || 3600) + '\tIN\t' + x.type + '\t' + (['CNAME', 'PTR', 'NS'].indexOf(x.type) >= 0 ? x.data.replace(/\.?$/, '.') : x.data))); }
  o.blank(); o.l(';; Query time: 0 msec'); o.l(';; SERVER: ' + q.sv + '#53(' + q.sv + ') (UDP)'); o.l(';; WHEN: ' + E.dateC(s.W.nowOf(d.id))); o.l(';; MSG SIZE  rcvd: ' + (60 + ans.length * 28)); o.blank();
  return q.rcode === 'NOERROR' ? 0 : 0;
}
C.dig = (s, a, o, r) => digCore(s, a, o, r, 'dig');
C.host = (s, a, o, r) => {
  const d = s.d; const args = a.filter(x => x[0] !== '-'); let name = args[0]; const at = args[1]; if (!name) { o.l('Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]', 'e'); o.l('            [-R number] [-m flag] [-p port] hostname [server]', 'e'); return 1; }
  const servers = dnsServers(s, at); const isIp = U.isIP(name); const type = isIp ? 'PTR' : 'A';
  const cands = isIp ? [revName(name)] : (name.indexOf('.') < 0 ? N.searchList(s.W, d).map(x => name + '.' + x).concat([name]) : [name]);
  let last = null;
  for (const c of cands) { const q = servers.length ? dnsAsk(s, c, type, servers) : { state: 'noservers' }; if (q.state !== 'ok') { last = q; if (q.state === 'timeout') break; continue; } last = q; if (q.rcode === 'NOERROR' && q.answers && q.answers.length) { s.env.obs('resolve:' + d.id + ':' + name, true); (q.answers).forEach(x => { if (x.type === 'A') o.l(x.name + ' has address ' + x.data); else if (x.type === 'CNAME') o.l(x.name + ' is an alias for ' + x.data.replace(/\.?$/, '.')); else if (x.type === 'PTR') o.l(x.name.replace(/\.?$/, '.') + ' domain name pointer ' + x.data.replace(/\.?$/, '.')); }); return 0; } }
  s.env.obs('resolve:' + d.id + ':' + name, false);
  if (!last || last.state === 'noservers') { o.l(';; connection timed out; no servers could be reached', 'e'); return 1; }
  if (last.state === 'timeout') { o.l(';; communications error to ' + last.sv + '#53: timed out', 'e'); o.l(';; no servers could be reached', 'e'); s.env.advance(10); return 1; }
  if (last.state === 'refused-port') { o.l(';; communications error to ' + last.sv + '#53: connection refused', 'e'); o.l(';; no servers could be reached', 'e'); return 1; }
  o.l('Host ' + name + ' not found: ' + ({ NXDOMAIN: '3(NXDOMAIN)', SERVFAIL: '2(SERVFAIL)', REFUSED: '5(REFUSED)', NOERROR: '0(NOERROR)' })[last.rcode], 'e'); return 1;
};
C.nslookup = (s, a, o, r) => {
  const d = s.d; const args = a.filter(x => x[0] !== '-'); const name = args[0]; const at = args[1]; if (!name) { o.l('nslookup interactif non pris en charge dans cette simulation (utilisez « nslookup nom [serveur] »).', 'e'); return 1; }
  const servers = dnsServers(s, at); const isIp = U.isIP(name);
  const cands = isIp ? [revName(name)] : (name.indexOf('.') < 0 ? N.searchList(s.W, d).map(x => name + '.' + x).concat([name]) : [name]);
  let last = null;
  for (const c of cands) {
    const q = servers.length ? dnsAsk(s, c, isIp ? 'PTR' : 'A', servers) : { state: 'noservers' }; last = q;
    if (q.state !== 'ok') { if (q.state === 'timeout') { o.l(';; communications error to ' + q.sv + '#53: timed out', 'e'); o.l(';; communications error to ' + q.sv + '#53: timed out', 'e'); o.l(';; communications error to ' + q.sv + '#53: timed out', 'e'); o.l(';; no servers could be reached', 'e'); o.blank(); s.env.obs('resolve:' + d.id + ':' + name, false); return 1; } continue; }
    if (q.rcode === 'NOERROR' && q.answers && q.answers.length) {
      s.env.obs('resolve:' + d.id + ':' + name, true); o.l('Server:\t\t' + q.sv); o.l('Address:\t' + q.sv + '#53'); o.blank();
      if (!q.authoritative) o.l('Non-authoritative answer:');
      q.answers.forEach(x => { if (x.type === 'A') { o.l('Name:\t' + x.name); o.l('Address: ' + x.data); } else if (x.type === 'CNAME') o.l(x.name + '\tcanonical name = ' + x.data.replace(/\.?$/, '.')); else if (x.type === 'PTR') o.l(x.name.replace(/\.?$/, '.') + '\tname = ' + x.data.replace(/\.?$/, '.')); });
      o.blank(); return 0;
    }
  }
  s.env.obs('resolve:' + d.id + ':' + name, false);
  if (!last || last.state === 'noservers') { o.l(';; connection timed out; no servers could be reached', 'e'); return 1; }
  o.l('Server:\t\t' + last.sv); o.l('Address:\t' + last.sv + '#53'); o.blank(); o.l('** server can\'t find ' + name + ': ' + (last.rcode || 'NXDOMAIN'), 'e'); o.blank(); return 1;
};
C.getent = (s, a, o, r) => {
  const db = a[0]; const key = a[1]; const d = s.d;
  if (db === 'hosts') { if (!key) return 2; const res = N.resolve(s.W, d.id, key); s.env.obs('resolve:' + d.id + ':' + key, !!res.ok); if (!res.ok) return 2; o.l(B.padR(res.ip, 15) + ' ' + (res.fqdn || key)); return; }
  if (db === 'passwd') { const list = LX.passwd(d).filter(u => !key || u.name === key || String(u.uid) === key); if (!list.length) return 2; list.forEach(u => o.l([u.name, 'x', u.uid, u.gid, u.gecos, u.home, u.shell].join(':'))); return; }
  if (db === 'group') { const list = LX.groups(d).filter(g2 => !key || g2.name === key || String(g2.gid) === key); if (!list.length) return 2; list.forEach(g2 => o.l([g2.name, 'x', g2.gid, g2.members.join(',')].join(':'))); return; }
  return 2;
};
C.hostnamectl = (s, a, o) => { const d = s.d; o.l(' Static hostname: ' + d.hostname); o.l('       Icon name: computer-vm'); o.l('         Chassis: vm'); o.l('      Machine ID: ' + U.hash8(d.id) + U.hash8(d.id + 'm') + U.hash8(d.id + 'n') + U.hash8(d.id + 'o')); o.l('Operating System: ' + d.os); o.l('          Kernel: Linux ' + d.kernel); o.l('    Architecture: x86-64'); };
C.timedatectl = (s, a, o) => { const d = s.d; const dt = s.W.nowOf(d.id); const sync = !d.clockSkewMin; const f = x => DAY[x.getUTCDay()] + ' ' + x.getUTCFullYear() + '-' + U.pad2(x.getUTCMonth() + 1) + '-' + U.pad2(x.getUTCDate()) + ' ' + E.frTime(x) + ' UTC'; o.l('               Local time: ' + f(dt)); o.l('           Universal time: ' + f(dt)); o.l('                 RTC time: ' + f(dt).replace(' UTC', '')); o.l('                Time zone: Etc/UTC (UTC, +0000)'); o.l('System clock synchronized: ' + (sync ? 'yes' : 'no')); o.l('              NTP service: active'); o.l('          RTC in local TZ: no'); };

/* ------------------------------------------------------------------ MariaDB */
function dbConnect(s, a, o, r, fromMode) {
  const d = s.d; const W = s.W; let user = s.user, host = null, port = 3306, db = null, pwdFlag = false, pwd = null, exec = null;
  const rest = []; for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-u') user = a[++i]; else if (/^-u./.test(x)) user = x.slice(2); else if (x === '-h') host = a[++i]; else if (/^-h./.test(x)) host = x.slice(2); else if (x === '-P') port = +a[++i]; else if (x === '-p') pwdFlag = true; else if (/^-p./.test(x)) { pwdFlag = true; pwd = x.slice(2); } else if (x === '-e' || x === '--execute') exec = a[++i]; else if (/^--host=/.test(x)) host = x.slice(7); else if (/^--user=/.test(x)) user = x.slice(7); else if (x === '-D') db = a[++i]; else if (x[0] !== '-') rest.push(x); }
  if (rest[0]) db = rest[0];
  if (user === s.user && s.euser() === 'root' && !a.some(x => x === '-u' || /^-u/.test(x))) user = 'root';
  return { user, host, port, db, pwdFlag, pwd, exec };
}
function dbTarget(s, p) {
  const W = s.W, d = s.d;
  if (!p.host || p.host === 'localhost' || p.host === '127.0.0.1') return { dev: d, ip: '127.0.0.1', local: true };
  let ip = p.host; if (!U.isIP(p.host)) { const rs = N.resolve(W, d.id, p.host); if (!rs.ok) return { err: "ERROR 2005 (HY000): Unknown server host '" + p.host + "' (-2)" }; ip = rs.ip; }
  const c = N.connect(W, d.id, ip, 'tcp', p.port); s.env.advance(c.state === 'timeout' ? 5 : 0);
  if (c.state !== 'open') return { err: U.av('mysql-errors', "ERROR 2002 (HY000): Can't connect to server on '" + p.host + "' (" + (c.state === 'refused' ? 111 : 110) + ')') };
  return { dev: W.d(c.dstDev), ip: c.trace.sipAtDst, local: false };
}
function dbAuth(s, p, tgt, havePw) {
  const dev = tgt.dev;
  if (!dev.db || !dev.svc || !dev.svc.mariadb) return { err: U.av('mysql-errors', "ERROR 2002 (HY000): Can't connect to local server through socket '/run/mysqld/mysqld.sock' (2)") };
  if (!LX.svcRun(dev, 'mariadb') || dev.svc.mariadb.state !== 'active') return { err: U.av('mysql-errors', tgt.local ? "ERROR 2002 (HY000): Can't connect to local server through socket '/run/mysqld/mysqld.sock' (2)" : "ERROR 2002 (HY000): Can't connect to server on '" + p.host + "' (111)") };
  if (tgt.local && p.user === 'root' && s.euser() === 'root') return { ok: true, row: { user: 'root', host: 'localhost', db: '*', grants: 'ALL PRIVILEGES' } };
  const x = LX.dbLogin(dev, tgt.ip, p.user, p.db);
  if (!x.ok) return { err: x.msg.replace(/using password: YES/, 'using password: ' + (havePw ? 'YES' : 'NO')) };
  return x;
}
function sqlSession(s, p, tgt, row) {
  const dev = tgt.dev; let cur = p.db || null;
  const sess = new E.Session(s.env, s.devId, {}); sess.kind = 'mysql'; sess.buf = '';
  sess.prompt = function () { return this.buf ? '    -> ' : 'MariaDB [' + (cur || '(none)') + ']> '; };
  sess.banner = function () { return [L('Welcome to the MariaDB monitor.  Commands end with ; or \\g.'), L('Your MariaDB connection id is ' + (parseInt(U.hash8(dev.id), 16) % 80 + 10)), L(U.av('mysql-banner', 'Server version: 11.8.2-MariaDB-0+deb13u1 Debian 13')), L(''), L('Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.'), L(''), L('Type \'help;\' or \'\\h\' for help. Type \'\\c\' to clear the current input statement.'), L('')]; };
  const table = (head, rows) => { const w = head.map((h, i) => Math.max(h.length, ...rows.map(rw => String(rw[i]).length))); const sep = '+' + w.map(x => '-'.repeat(x + 2)).join('+') + '+'; const out = [sep, '| ' + head.map((h, i) => B.padR(h, w[i])).join(' | ') + ' |', sep]; rows.forEach(rw => out.push('| ' + rw.map((v, i) => B.padR(v, w[i])).join(' | ') + ' |')); out.push(sep); out.push(rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' in set (0.001 sec)'); out.push(''); return out; };
  const canSee = (dbn) => row.db === '*' || row.db === dbn;
  sess.run = function (line) {
    const out = new E.Out(); const t = line.trim();
    if (!t) return { out: [] };
    if (/^(exit|quit|\\q)\s*;?$/i.test(t)) { out.l('Bye'); return { out: out.lines, pop: true, exit: false }; }
    this.buf += (this.buf ? ' ' : '') + t; if (!/;\s*$/.test(this.buf) && !/\\g$/.test(this.buf)) return { out: [] };
    const q = this.buf.replace(/;\s*$/, '').replace(/\\g$/, '').trim(); this.buf = ''; let m;
    if (/^show\s+databases$/i.test(q)) { const dbs = dev.db.databases.filter(x => row.db === '*' ? true : x === row.db || x === 'information_schema').slice().sort(); table(['Database'], dbs.map(x => [x])).forEach(l => out.l(l)); }
    else if ((m = q.match(/^use\s+`?(\w+)`?$/i))) { if (!dev.db.databases.includes(m[1])) out.l('ERROR 1049 (42000): Unknown database \'' + m[1] + '\'', 'e'); else if (!canSee(m[1]) && m[1] !== 'information_schema') out.l("ERROR 1044 (42000): Access denied for user '" + p.user + "'@'" + tgt.ip + "' to database '" + m[1] + "'", 'e'); else { cur = m[1]; out.l('Database changed'); } }
    else if (/^show\s+tables$/i.test(q)) { if (!cur) out.l('ERROR 1046 (3D000): No database selected', 'e'); else { const tb = ((dev.db.tables || {})[cur]) || []; if (!tb.length) out.l('Empty set (0.000 sec)\n'); else table(['Tables_in_' + cur], tb.map(x => [x])).forEach(l => out.l(l)); } }
    else if (/^select\s+version\(\)$/i.test(q)) table(['version()'], [['11.8.2-MariaDB-0+deb13u1']]).forEach(l => out.l(l));
    else if (/^select\s+(current_user\(\)|user\(\))$/i.test(q)) table([q.replace(/^select\s+/i, '')], [[p.user + '@' + (tgt.local ? 'localhost' : tgt.ip)]]).forEach(l => out.l(l));
    else if (/^select\s+user\s*,\s*host\s+from\s+mysql\.user$/i.test(q)) { if (row.db !== '*') out.l("ERROR 1142 (42000): SELECT command denied to user '" + p.user + "'@'" + tgt.ip + "' for table 'user'", 'e'); else table(['User', 'Host'], dev.db.users.map(u => [u.user, u.host])).forEach(l => out.l(l)); }
    else if ((m = q.match(/^show\s+grants(?:\s+for\s+'?([\w.-]+)'?@'?([\w.%-]+)'?)?$/i))) { const un = m[1] || p.user, hn = m[2] || (tgt.local ? 'localhost' : tgt.ip); const u = dev.db.users.find(x => x.user === un && x.host === hn); if (!u) out.l("ERROR 1141 (42000): There is no such grant defined for user '" + un + "' on host '" + hn + "'", 'e'); else table(['Grants for ' + un + '@' + hn], [["GRANT USAGE ON *.* TO `" + un + "`@`" + hn + "`"], ["GRANT " + u.grants + " ON `" + (u.db === '*' ? '*' : u.db) + "`.* TO `" + un + "`@`" + hn + "`"]]).forEach(l => out.l(l)); }
    else if (/^select\s+now\(\)$/i.test(q)) { const dt = s.W.nowOf(dev.id); table(['now()'], [[dt.getUTCFullYear() + '-' + U.pad2(dt.getUTCMonth() + 1) + '-' + U.pad2(dt.getUTCDate()) + ' ' + E.frTime(dt)]]).forEach(l => out.l(l)); }
    else if (/^select\s+1$/i.test(q)) table(['1'], [['1']]).forEach(l => out.l(l));
    else if (/^(create|drop|grant|revoke|flush|alter|rename)\b/i.test(q)) {
      const ok0 = () => out.l('Query OK, 0 rows affected (0.00' + (1 + (q.length % 4)) + ' sec)\n');
      const acct = x => { const mm = /^\s*(['"`]?)([\w.-]+)\1\s*@\s*(['"`]?)([\w.%:-]+)\3\s*$/.exec(x); return mm ? { user: mm[2], host: mm[4] } : null; };
      const q2 = x => "'" + x.user + "'@'" + x.host + "'";
      const find = a2 => dev.db.users.find(u => u.user === a2.user && u.host === a2.host);
      const fail = (op, a2) => out.l(U.av('mysql-userops', 'ERROR 1396 (HY000): Operation ' + op + ' failed for ' + q2(a2)), 'e');
      const chg = () => { s.env.touch('db'); this.changedFlag = true; };
      if (row.db !== '*') { out.l("ERROR 1227 (42000): Access denied; you need (at least one of) the SUPER privilege(s) for this operation", 'e'); }
      else if ((m = q.match(/^rename\s+user\s+(.+)$/i))) {
        const pairs = m[1].split(/\s*,\s*(?=['"`]?[\w.-]+['"`]?\s*@)/).map(x => x.split(/\s+to\s+/i)); let bad = false;
        for (const pr of pairs) { const a1 = pr.length === 2 && acct(pr[0]), b1 = pr.length === 2 && acct(pr[1]); if (!a1 || !b1) { out.l("ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near '" + q.slice(11, 41) + "' at line 1", 'e'); bad = true; break; } const r1 = find(a1); if (!r1 || find(b1)) { fail('RENAME USER', a1); bad = true; break; } r1.user = b1.user; r1.host = b1.host; chg(); }
        if (!bad) ok0();
      }
      else if ((m = q.match(/^drop\s+user\s+(if\s+exists\s+)?(.+)$/i))) {
        let bad = false; for (const x of m[2].split(/\s*,\s*/)) { const a1 = acct(x); if (!a1) { out.l("ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near '" + x.slice(0, 30) + "' at line 1", 'e'); bad = true; break; } const r1 = find(a1); if (!r1) { if (!m[1]) { fail('DROP USER', a1); bad = true; break; } continue; } dev.db.users.splice(dev.db.users.indexOf(r1), 1); chg(); }
        if (!bad) ok0();
      }
      else if ((m = q.match(/^create\s+user\s+(if\s+not\s+exists\s+)?(\S+)(?:\s+identified\s+by\s+.+)?$/i)) && acct(m[2])) {
        const a1 = acct(m[2]); if (find(a1)) { if (m[1]) ok0(); else fail('CREATE USER', a1); } else { dev.db.users.push({ user: a1.user, host: a1.host, db: '', grants: 'USAGE' }); chg(); ok0(); }
      }
      else if ((m = q.match(/^alter\s+user\s+(if\s+exists\s+)?(\S+)\s+identified\s+by\s+.+$/i)) && acct(m[2])) {
        const a1 = acct(m[2]); if (find(a1)) ok0(); else if (m[1]) ok0(); else fail('ALTER USER', a1);
      }
      else if ((m = q.match(/^grant\s+(all(?:\s+privileges)?|[a-z ,]+?)\s+on\s+`?(\w+|\*)`?\.\*\s+to\s+(\S+)(?:\s+identified\s+by\s+.+?)?(?:\s+with\s+grant\s+option)?$/i)) && acct(m[3])) {
        const a1 = acct(m[3]); const g2 = /^all/i.test(m[1]) ? 'ALL PRIVILEGES' : m[1].trim().toUpperCase().replace(/\s*,\s*/g, ', '); const r1 = find(a1);
        if (r1) { r1.db = m[2]; r1.grants = g2; } else dev.db.users.push({ user: a1.user, host: a1.host, db: m[2], grants: g2 }); chg(); ok0();
      }
      else if (/^flush\s+privileges$/i.test(q)) out.l('Query OK, 0 rows affected (0.001 sec)\n');
      else out.l(U.av('mysql-unsupported', 'Requête non gérée par le simulateur : ' + q.slice(0, 40)), 'w');
    } else if (/^(select|insert|update|delete|set|describe|desc|explain|truncate|replace|call|source)\b/i.test(q)) out.l(U.av('mysql-unsupported', 'Requête non gérée par le simulateur : ' + q.slice(0, 40)), 'w');
    else out.l('ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near \'' + q.slice(0, 30) + '\' at line 1', 'e');
    const res = { out: out.lines }; if (this.changedFlag) { res.mutated = true; this.changedFlag = false; } return res;
  };
  sess.complete = () => ({ list: [], from: 0 });
  return sess;
}
C.mysql = (s, a, o, r) => {
  const p = dbConnect(s, a, o, r); const tgt = dbTarget(s, p); if (tgt.err) { o.l(tgt.err, 'e'); return 1; }
  const proceed = (havePw) => {
    const au = dbAuth(s, p, tgt, havePw); const out = new E.Out(); if (au.err) { out.l(au.err, 'e'); return { out: out.lines, ok: false }; }
    if (p.exec) { const sess = sqlSession(s, p, tgt, au.row); const x = sess.run(p.exec + ';'); return { out: x.out, mutated: x.mutated, ok: true }; }
    const sess = sqlSession(s, p, tgt, au.row); return { out: sess.banner(), push: sess };
  };
  if (p.pwdFlag && p.pwd === null) { r.ask = { prompt: 'Enter password: ', echo: false, cb: l => proceed(!!l) }; return; }
  const x = proceed(!!p.pwd); x.out.forEach(l => o.lines.push(l)); if (x.push) r.push = x.push; if (x.mutated) r.mutated = true; if (x.ok === false) return 1;
};
C.mariadb = C.mysql;
C.mysqldump = (s, a, o, r) => {
  const p = dbConnect(s, a, o, r); const tgt = dbTarget(s, p); if (tgt.err) { o.l('mysqldump: ' + tgt.err.replace(/^ERROR /, 'Got error: ').replace(/\s*\(HY000\):/, ':'), 'e'); return 2; }
  const dev = tgt.dev; if (!dev.db || !LX.svcRun(dev, 'mariadb') || dev.svc.mariadb.state !== 'active') { o.l('mysqldump: Got error: 2002: "Can\'t connect to local server through socket \'/run/mysqld/mysqld.sock\' (2)" when trying to connect', 'e'); return 2; }
  const dbn = a.filter(x => x[0] !== '-')[0]; if (dbn && dev.db.databases.indexOf(dbn) < 0) { o.l('mysqldump: Got error: 1049: "Unknown database \'' + dbn + '\'" when selecting the database', 'e'); return 2; }
  o.l('-- MariaDB dump 10.19  Distrib 11.8, for debian-linux-gnu (x86_64)'); o.l('--'); o.l('-- Host: localhost    Database: ' + (dbn || '')); o.l('-- ------------------------------------------------------'); o.l('-- Dump completed'); };

/* ------------------------------------------------------------------ crontab */
C.crontab = (s, a, o, r) => {
  const d = s.d; let user = s.euser(); const ui = a.indexOf('-u'); if (ui >= 0) { user = a[ui + 1]; if (user !== s.euser() && !isRoot(s)) { o.l('must be privileged to use -u', 'e'); return 1; } }
  const path = '/var/spool/cron/crontabs/' + user; const n = d.fs[path];
  if (a.indexOf('-l') >= 0) { if (!n) { o.l('no crontab for ' + user, 'e'); return 1; } (n.c || '').replace(/\n$/, '').split('\n').forEach(l => o.l(l)); return; }
  if (a.indexOf('-r') >= 0) { if (!n) { o.l('no crontab for ' + user, 'e'); return 1; } LX.rm(d, path); r.mutated = true; s.env.touch('cron'); return; }
  if (a.indexOf('-e') >= 0) { s.cronEdit = { path, user }; r.edit = { editor: 'nano', path: '/tmp/crontab.' + U.hash8(user).slice(0, 6), name: '/tmp/crontab.' + U.hash8(user).slice(0, 6), text: n ? n.c : '# Edit this file to introduce tasks to be run by cron.\n#\n# m h  dom mon dow   command\n', exists: true, readonly: false, cron: path }; return; }
  o.l('usage: crontab [-u user] file', 'e'); o.l('       crontab [-u user] [-i] {-e | -l | -r}', 'e'); return 1;
};
const editorSave0 = E.LxShell.prototype.editorSave;
E.LxShell.prototype.editorSave = function (path, text) {
  if (this.cronEdit && /^\/tmp\/crontab\./.test(path)) {
    const ce = this.cronEdit; const d = this.d;
    if (/^\s*\*|^\s*\d/m.test(text)) { const bad = text.split('\n').find(l => l.trim() && l[0] !== '#' && !/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(l.trim()) && l.trim().split(/\s+/).length < 6); if (bad) return { ok: false, msg: '"/tmp/crontab": bad command' }; }
    LX.mkdir(this.W, d, '/var/spool/cron/crontabs', { m: '1730', o: 'root', g: 'crontab' });
    LX.write(this.W, d, ce.path, text, { m: '0600', o: ce.user, g: 'crontab' }); this.cronEdit = null; this.env.touch('cron'); this.env.advance(20);
    this.env.act({ kind: 'edit', dev: this.devId, text: 'crontab -e', mutates: true, shell: 'bash', path: ce.path }); return { ok: true, msg: 'crontab: installing new crontab' };
  }
  return editorSave0.call(this, path, text);
};

/* ------------------------------------------------------------------ apt */
const APT_KNOWN = { traceroute: 'traceroute', 'net-tools': 'net-tools', tcpdump: 'tcpdump', lsof: 'lsof', 'netcat-openbsd': 'netcat-openbsd', nc: 'netcat-openbsd', telnet: 'telnet', rsync: 'rsync', tree: 'tree', htop: 'htop', 'mtr-tiny': 'mtr-tiny', mtr: 'mtr-tiny', zip: 'zip', unzip: 'unzip', vim: 'vim', wget: 'wget', dnsutils: 'bind9-dnsutils', 'bind9-dnsutils': 'bind9-dnsutils', curl: 'curl', nano: 'nano', ufw: 'ufw', 'iputils-ping': 'iputils-ping' };
function aptNet(s, o) {
  const d = s.d; const rs = N.resolve(s.W, d.id, 'deb.debian.org'); s.env.advance(2);
  if (!rs.ok) { s.env.obs('resolve:' + d.id + ':deb.debian.org', false); o.l('Err:1 http://deb.debian.org/debian trixie InRelease', 'e'); o.l('  Temporary failure resolving \'deb.debian.org\'', 'e'); return { ok: false, w: 'Temporary failure resolving \'deb.debian.org\'' }; }
  s.env.obs('resolve:' + d.id + ':deb.debian.org', true);
  const c = N.connect(s.W, d.id, rs.ip, 'tcp', 80);
  if (c.state !== 'open') { o.l('Err:1 http://deb.debian.org/debian trixie InRelease', 'e'); o.l('  Could not connect to deb.debian.org:80 (' + rs.ip + '). - connect (' + (c.state === 'refused' ? '111: Connection refused' : '110: Connection timed out') + ')', 'e'); s.env.advance(c.state === 'refused' ? 1 : 10); return { ok: false, w: 'Could not connect to deb.debian.org:80 (' + rs.ip + '). - connect (' + (c.state === 'refused' ? '111: Connection refused' : '110: Connection timed out') + ')' }; }
  return { ok: true, ip: rs.ip };
}
function aptCmd(s, a, o, r, name) {
  const d = s.d; const args = a.filter(x => x[0] !== '-'); const verb = args[0]; const yes = a.some(x => x === '-y' || x === '--yes' || x === '-qq');
  if (!verb) { o.l('apt 3.0 (amd64)'); o.l('Usage: apt [options] command'); return; }
  if (['update', 'install', 'upgrade', 'remove', 'purge', 'full-upgrade', 'autoremove', 'dist-upgrade'].indexOf(verb) >= 0 && !isRoot(s)) {
    if (verb === 'update') { o.l('E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)', 'e'); o.l('E: Unable to lock directory /var/lib/apt/lists/', 'e'); o.l('W: Problem unlinking the file /var/cache/apt/pkgcache.bin - RemoveCaches (13: Permission denied)', 'e'); o.l('W: Problem unlinking the file /var/cache/apt/srcpkgcache.bin - RemoveCaches (13: Permission denied)', 'e'); }
    else { o.l('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)', 'e'); o.l('E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 'e'); }
    return 100;
  }
  d.pkgs = d.pkgs || B.DEFAULT_PKGS.slice();
  if (verb === 'update') {
    const net = aptNet(s, new E.Out()); const out = new E.Out(); const n2 = aptNet.call(null, s, out);
    out.lines.forEach(l => o.lines.push(l)); if (!n2.ok) { o.l('Reading package lists...', 'o'); o.l('Building dependency tree...'); o.l('Reading state information...'); o.l('All packages are up to date.'); o.l('W: Failed to fetch http://deb.debian.org/debian/dists/trixie/InRelease  ' + n2.w, 'e'); o.l('W: Some index files failed to download. They have been ignored, or old ones used instead.', 'e'); return 100; }
    o.l('Hit:1 http://deb.debian.org/debian trixie InRelease'); o.l('Hit:2 http://deb.debian.org/debian trixie-updates InRelease'); o.l('Hit:3 http://security.debian.org/debian-security trixie-security InRelease'); o.l('Reading package lists...'); o.l('Building dependency tree...'); o.l('Reading state information...'); o.l('All packages are up to date.'); s.env.advance(4); return 0;
  }
  if (verb === 'install' || verb === 'reinstall') {
    const pk = args.slice(1); if (!pk.length) { o.l('E: Unable to locate package', 'e'); return 100; }
    const bad = pk.filter(x => !APT_KNOWN[x]); if (bad.length) { bad.forEach(b => o.l('E: Unable to locate package ' + b, 'e')); return 100; }
    const want = U.uniq(pk.map(x => APT_KNOWN[x])); const fresh = want.filter(x => d.pkgs.indexOf(x) < 0);
    if (!fresh.length) { want.forEach(x => o.l(x + ' is already the newest version.')); o.l('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return 0; }
    const out = new E.Out(); const nt = aptNet(s, out);
    if (!nt.ok) { o.l('Reading package lists...'); o.l('Building dependency tree...'); o.l('Reading state information...'); out.lines.forEach(l => o.lines.push(l)); o.l('E: Failed to fetch http://deb.debian.org/debian/pool/main/' + fresh[0][0] + '/' + fresh[0] + '/' + fresh[0] + '_amd64.deb  ' + nt.w, 'e'); o.l('E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?', 'e'); return 100; }
    const apply = () => { fresh.forEach(x => d.pkgs.push(x)); s.env.advance(12); s.env.touch('pkg'); const out2 = new E.Out(); out2.l(U.av('apt-format', 'Setting up ' + fresh.join(', ') + ' ...')); return { out: out2.lines, mutated: true }; };
    o.l('Reading package lists...'); o.l('Building dependency tree...'); o.l('Reading state information...'); o.l('The following NEW packages will be installed:'); o.l('  ' + fresh.join(' ')); o.l('0 upgraded, ' + fresh.length + ' newly installed, 0 to remove and 0 not upgraded.');
    if (yes) { const x = apply(); x.out.forEach(l => o.lines.push(l)); r.mutated = true; return 0; }
    r.ask = { prompt: 'Do you want to continue? [Y/n] ', echo: true, cb: l => (/^(y|)$/i.test(l.trim()) ? apply() : { out: [L('Abort.')] }) }; return;
  }
  if (verb === 'list' && a.some(x => x === '--installed')) { d.pkgs.forEach(p => o.l(p + '/stable,now installed [installed]')); return; }
  if (verb === 'remove' || verb === 'purge') { const pk = args.slice(1); pk.forEach(x => { const i = d.pkgs.indexOf(APT_KNOWN[x] || x); if (i < 0) o.l('E: Unable to locate package ' + x, 'e'); else { d.pkgs.splice(i, 1); r.mutated = true; } }); return; }
  o.l('apt: commande « ' + verb + ' » non prise en charge dans cette simulation', 'e'); return 1;
}
C.apt = (s, a, o, r) => aptCmd(s, a, o, r, 'apt'); C['apt-get'] = C.apt;

/* ------------------------------------------------------------------ ssh / scp (client) */
C.ssh = (s, a, o, r) => { if (!E.sshCommand) { o.l('ssh: command not found', 'e'); return 127; } return E.sshCommand(s, a, o, r, 'lx'); };
C.scp = (s, a, o, r) => { o.l('scp: transfert non pris en charge dans cette simulation', 'e'); return 1; };
C['ssh-keygen'] = (s, a, o, r) => { o.l('ssh-keygen: non pris en charge dans cette simulation', 'e'); return 1; };

/* ------------------------------------------------------------------ appartenance aux groupes : usermod -aG, gpasswd -a/-d, adduser <u> <g>
   Écrit /etc/group (même source que groups / id / les droits de fichiers). Autres options : signalées comme non gérées, jamais ignorées en silence. */
const grpEdit = (s, o, cmd, user, group, add) => {
  const d = s.d; if (s.euser() !== 'root') { o.l(cmd + ': Permission denied.', 'e'); return 1; }
  if (!LX.user(d, user)) { o.l(cmd === 'adduser' ? 'adduser: The user `' + user + '\' does not exist.' : cmd + ': user \'' + user + '\' does not exist', 'e'); return cmd === 'adduser' ? 1 : 6; }
  const txt = LX.readFile(d, '/etc/group') || ''; let hit = false;
  const lines = txt.split('\n').map(l => { const f = l.split(':'); if (l[0] === '#' || f[0] !== group) return l; hit = true; const m = f[3] ? f[3].split(',') : []; const i = m.indexOf(user);
    if (add && i < 0) m.push(user); if (!add && i >= 0) m.splice(i, 1); f[3] = m.join(','); return f.join(':'); });
  if (!hit) { o.l(cmd === 'adduser' ? 'adduser: The group `' + group + '\' does not exist.' : cmd + ': group \'' + group + '\' does not exist', 'e'); return cmd === 'adduser' ? 1 : 6; }
  const e = s.writeFile('/etc/group', lines.join('\n'), false); if (e) { o.l(cmd + ': ' + e, 'e'); return 1; } return 0;
};
C.usermod = (s, a, o, r) => {
  const args = a.slice(); let groups = null, append = false; let user = null;
  for (let i = 0; i < args.length; i++) { const x = args[i]; if (x === '-a') append = true; else if (x === '-G') groups = args[++i]; else if (x === '-aG' || x === '-Ga') { append = true; groups = args[++i]; } else if (x[0] !== '-') user = x; else { o.l(U.av('usermod-unsupported', 'Option non gérée par le simulateur : ' + x + ' (seuls -aG et -G sont gérés)'), 'w'); return 2; } }
  if (!user || groups === null) { o.l('Usage: usermod [options] LOGIN', 'e'); return 2; }
  if (!append) { o.l(U.av('usermod-unsupported', 'Option non gérée par le simulateur : -G sans -a (remplacement de la liste) ; utilise -aG'), 'w'); return 2; }
  let st = 0; groups.split(',').filter(Boolean).forEach(g => { if (!st) st = grpEdit(s, o, 'usermod', user, g, true); }); if (!st) s.mut(r); return st;
};
C.gpasswd = (s, a, o, r) => {
  const op = a[0]; if ((op !== '-a' && op !== '-d') || a.length < 3) { o.l(U.av('gpasswd-unsupported', 'Usage géré par le simulateur : gpasswd -a|-d utilisateur groupe'), 'w'); return 2; }
  const st = grpEdit(s, o, 'gpasswd', a[1], a[2], op === '-a'); if (!st) { o.l(op === '-a' ? 'Adding user ' + a[1] + ' to group ' + a[2] : 'Removing user ' + a[1] + ' from group ' + a[2]); s.mut(r); } return st;
};
C.adduser = (s, a, o, r) => {
  const p = a.filter(x => x[0] !== '-'); if (p.length !== 2) { o.l(U.av('adduser-unsupported', 'Usage géré par le simulateur : adduser utilisateur groupe (ajout à un groupe existant)'), 'w'); return 2; }
  const st = grpEdit(s, o, 'adduser', p[0], p[1], true); if (!st) { o.l('Adding user `' + p[0] + '\' to group `' + p[1] + '\' ...'); o.l('Done.'); s.mut(r); } return st;
};
/* man / help existent sur un vrai Debian : le simulateur ne reproduit pas les pages de manuel ; on renvoie vers l'aide-mémoire */
C.man = (s, a, o, r) => { o.l(U.av('man-unsupported', 'Commande réelle non gérée par le simulateur : man (pages de manuel). Utilise le bouton « Aide-mémoire » du terminal pour la liste et la description des commandes disponibles.'), 'w'); return 1; };
C.help = (s, a, o, r) => { o.l(U.av('man-unsupported', 'Commande réelle non gérée par le simulateur : help. Utilise le bouton « Aide-mémoire » du terminal pour la liste et la description des commandes disponibles.'), 'w'); return 1; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
