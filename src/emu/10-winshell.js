/* ============================================================================
   Windows — invite de commandes (cmd.exe) : session, système de fichiers virtuel, commandes internes.
   Les commandes réseau/système sont dans 11-wincmd-net.js et 12-wincmd-sys.js (table E.win.cmds).
   Toute sortie découle de l'état du monde (interfaces, baux, services, pare-feu, AD…).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, WIN = SIM.win, AD = SIM.ad;
const E = SIM.emu; const L = E.L, Out = E.Out;
const W_ = E.win = { cmds: {}, ps: {} };

U.av('win-cmd-banner', 'Bannière cmd.exe : « Microsoft Windows [version 10.0.<build>] » + « (c) Microsoft Corporation. Tous droits réservés. » ; numéro de révision de build non connu (19045.x / 20348.x).');
U.av('win-fr-syntax-errors', 'Messages d’erreur cmd.exe en français : « n’est pas reconnu en tant que commande interne ou externe, un programme exécutable ou un fichier de commandes. », « Le chemin d’accès spécifié est introuvable. », « Accès refusé. » — reconstitués de mémoire, à valider par capture.');

/* ------------------------------------------------------------------ utilitaires hôte */
const lc = s => String(s).toLowerCase();
const REAL_CMD_UNSUPPORTED = {}; ['nbtstat', 'schtasks', 'wevtutil', 'taskkill', 'query', 'driverquery', 'certutil', 'ftp', 'diskpart', 'fsutil', 'cipher', 'wmic', 'sfc', 'chkdsk'].forEach(c => { REAL_CMD_UNSUPPORTED[c] = 1; });
E.REAL_CMD_UNSUPPORTED = REAL_CMD_UNSUPPORTED;
W_.fqdn = d => (d.win && d.win.domain ? d.name.toLowerCase() + '.' + d.win.domain.toLowerCase() : d.name);
W_.sessionUser = d => (d._rt.session && d._rt.session.user) || d.user || null;
W_.isServer = d => /Server/i.test(d.os || '');
W_.domainOf = d => (d.win && d.win.domain) || null;
W_.netbios = (W, d) => { if (!d.win.domain) return d.name.toUpperCase(); const dc = AD.byDomain(W, d.win.domain); return dc ? dc.win.ad.netbios : d.win.domain.split('.')[0].toUpperCase(); };
W_.whoami = (W, d, user) => { user = user || W_.sessionUser(d); if (!user) return null; return lc(W_.netbios(W, d)) + '\\' + lc(user); };
W_.ifaceNames = d => Object.keys(d.ifaces || {});
W_.build = d => (W_.isServer(d) ? '10.0.20348.2113' : '10.0.19045.2006');
W_.nicDesc = U.av('nic-description', 'Microsoft Hyper-V Network Adapter');
/* Jeton d'un utilisateur de la session (pour les contrôles d'accès) */
W_.token = function (W, d) {
  const s = d._rt.session; if (!s) return new Set(['tout le monde']);
  if (s.token) return new Set(s.token);
  return new Set([lc(d.name + '\\' + s.user), 'tout le monde', 'utilisateurs authentifiés', 'builtin\\utilisateurs']);
};
/* Noms d'affichage (casse réelle) des identifiants d'un jeton */
const WELL = { 'tout le monde': 'Tout le monde', 'utilisateurs authentifiés': 'NT AUTHORITY\\Utilisateurs authentifiés', 'builtin\\utilisateurs': 'BUILTIN\\Utilisateurs', 'builtin\\administrateurs': 'BUILTIN\\Administrateurs', 'interactif': 'NT AUTHORITY\\INTERACTIF', 'ouverture de session de console': 'Ouverture de session de console' };
W_.tokenNames = function (W, d, tok) {
  const out = []; const doms = AD.domains(W);
  tok.forEach(t => {
    if (WELL[t]) { out.push(WELL[t]); return; }
    const m = t.split('\\'); if (m.length !== 2) { out.push(t); return; }
    let nm = null;
    for (const dv of doms) { const A = dv.win.ad; if (lc(A.netbios) !== m[0]) continue; const g2 = A.groups.find(x => lc(x.name) === m[1]); const u = A.users.find(x => lc(x.sam) === m[1]); const c = A.computers.find(x => lc(x.name) + '$' === m[1]); nm = (g2 && g2.name) || (u && u.sam) || (c && c.name.toUpperCase() + '$') || null; out.push(A.netbios.toUpperCase() + '\\' + (nm || (m[1].charAt(0).toUpperCase() + m[1].slice(1)))); return; }
    out.push(m[0].toUpperCase() + '\\' + m[1]);
  });
  return out;
};
/* Appartenance à Administrateurs (local ou via Admins du domaine) — détermine les droits d'élévation */
W_.isAdminUser = function (W, d, user) {
  user = user || W_.sessionUser(d); if (!user) return false;
  const s = d._rt.session;
  if (s && s.user === user && s.token) return s.token.indexOf ? s.token.indexOf('builtin\\administrateurs') >= 0 : false;
  if (d.win.domain) {
    const dc = AD.byDomain(W, d.win.domain); if (!dc) return false;
    const tok = AD.token(W, d.win.domain, user);
    if (tok.has('builtin\\administrateurs')) return true;
  }
  const lu = (d.win.localUsers || []).find(x => lc(x.name) === lc(user));
  return !!(lu && lu.admin);
};

/* ------------------------------------------------------------------ hosts */
const HOSTS_HEADER = [
  '# Copyright (c) 1993-2009 Microsoft Corp.', '#', '# This is a sample HOSTS file used by Microsoft TCP/IP for Windows.', '#',
  '# This file contains the mappings of IP addresses to host names. Each', '# entry should be kept on an individual line. The IP address should',
  '# be placed in the first column followed by the corresponding host name.', '# The IP address and the host name should be separated by at least one', '# space.', '#',
  '# Additionally, comments (such as these) may be inserted on individual', '# lines or following the machine name denoted by a \'#\' symbol.', '#', '# For example:', '#',
  '#      102.54.94.97     rhino.acme.com          # source server', '#       38.25.63.10     x.acme.com              # x client host', '',
  '# localhost name resolution is handled within DNS itself.', '#\t127.0.0.1       localhost', '#\t::1             localhost'];
W_.HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
W_.hostsText = function (d) { return HOSTS_HEADER.concat((d.hostsFile || []).map(h => h.ip + '\t' + h.name)).join('\r\n') + '\r\n'; };
W_.setHostsText = function (W, d, text) {
  const out = [];
  text.split(/\r?\n/).forEach(l => { const t = l.replace(/#.*/, '').trim(); if (!t) return; const p = t.split(/\s+/); if (p.length >= 2) p.slice(1).forEach(nm => out.push({ ip: p[0], name: nm })); });
  d.hostsFile = out; W.touch('hosts');
};

/* ------------------------------------------------------------------ système de fichiers virtuel (lecture, quelques écritures en mémoire) */
const normWin = p => String(p).replace(/\//g, '\\');
W_.normPath = function (cwd, p) {
  p = normWin(p).replace(/^"|"$/g, '');
  let base;
  if (/^[A-Za-z]:\\?/.test(p)) { base = p.slice(0, 2).toUpperCase() + '\\' + p.slice(3); if (p.length === 2) base = p.toUpperCase() + '\\'; }
  else if (p.indexOf('\\\\') === 0) base = p;
  else if (p[0] === '\\') base = cwd.slice(0, 2) + p;
  else base = cwd.replace(/\\$/, '') + '\\' + p;
  if (base.indexOf('\\\\') === 0) return base.replace(/\\+$/, '');
  const drive = base.slice(0, 2); const parts = base.slice(2).split('\\'); const st = [];
  for (const s of parts) { if (!s || s === '.') continue; if (s === '..') st.pop(); else st.push(s); }
  return drive + '\\' + st.join('\\');
};
U.av('sysvol-policies-folders', 'Dossiers des GPO dans SYSVOL\\<domaine>\\Policies : un dossier par GPO nommé par son identifiant {GUID} (valeurs ici dérivées de l’identifiant interne, sauf « Default Domain Policy » = {31B2F340-016D-11D2-945F-00C04FB984F9}) ; casse d’affichage des GUID dans l’Explorateur à confirmer par la capture R-74 ; contenu d’un dossier (GPT.INI, Machine, User) non modélisé ; seul « ntds.dit » est attendu sous NTDS, tout autre fichier est à vérifier.');
W_.gpoGuid = g => { if (g.guid) return g.guid; if (g.id === 'GPO1') return '{31B2F340-016D-11D2-945F-00C04FB984F9}'; const h = k => U.hash8(g.id + k).toUpperCase(); return '{' + h('a') + '-' + h('b').slice(0, 4) + '-' + h('c').slice(0, 4) + '-' + h('d').slice(0, 4) + '-' + h('e') + h('f').slice(0, 4) + '}'; };
W_.userDirs = ['Bureau', 'Documents', 'Images', 'Musique', 'Téléchargements', 'Vidéos'];
W_.tree = function (W, d) {
  /* dossier → { dirs:[…], files:[…] } construit à la demande ; sur serveur : dossiers NTFS et fichiers déclarés */
  const T = {};
  const dir = (p) => { const k = lc(p.replace(/\\$/, '') || p); if (!T[k]) T[k] = { name: p.replace(/\\$/, ''), dirs: new Set(), files: new Map() }; return T[k]; };
  const ensure = (p) => { p = p.replace(/\\$/, ''); const parts = p.split('\\'); let cur = parts[0] + '\\'; dir(cur); for (let i = 1; i < parts.length; i++) { const parent = cur; cur = (cur.replace(/\\$/, '')) + '\\' + parts[i]; dir(cur); dir(parent).dirs.add(parts[i]); } };
  ['C:\\Windows\\System32\\drivers\\etc', 'C:\\Windows\\Temp', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\Users\\Public', 'C:\\Temp'].forEach(ensure);
  if (d.win.ad && d.win.ad.domain) ['C:\\Windows\\NTDS', 'C:\\Windows\\SYSVOL\\sysvol\\' + d.win.ad.domain + '\\Policies', 'C:\\Windows\\SYSVOL\\sysvol\\' + d.win.ad.domain + '\\scripts'].forEach(ensure);   /* dossiers standard d'un contrôleur de domaine */
  if (d.win.ad && d.win.ad.domain) (d.win.ad.gpos || []).forEach(g => ensure('C:\\Windows\\SYSVOL\\sysvol\\' + d.win.ad.domain + '\\Policies\\' + W_.gpoGuid(g)));   /* un dossier par GPO existant (dérivé du modèle : créer / supprimer un GPO dans la GPMC le fait apparaître / disparaître) */
  const users = new Set([W_.sessionUser(d)].concat(d.win.cachedLogons || []).concat((d.win.localUsers || []).map(u => u.name)).filter(Boolean));
  users.forEach(u => { ensure('C:\\Users\\' + u); W_.userDirs.forEach(x => ensure('C:\\Users\\' + u + '\\' + x)); });
  dir('C:\\Windows\\System32\\drivers\\etc').files.set('hosts', { size: W_.hostsText(d).length, date: new Date(W.clock.base - 86400000 * 30) });
  const nt = d.win.ntfs || {}; Object.keys(nt).forEach(ensure);
  const files = d.win.files || {}; Object.keys(files).forEach(p => { ensure(p); files[p].forEach(f => dir(p).files.set(f, { size: 12288 + U.hash8(p + f).charCodeAt(0) * 211, date: new Date(W.clock.base - 86400000 * (3 + U.hash8(f).charCodeAt(1) % 40)) })); });
  const mem = d._rt.userFiles || {}; Object.keys(mem).forEach(fp => { const dp = fp.slice(0, fp.lastIndexOf('\\')); ensure(dp); dir(dp).files.set(fp.slice(fp.lastIndexOf('\\') + 1), { size: mem[fp].length, date: W.now() }); });
  return T;
};
W_.getTree = function (W, d) { const key = W.ver + ':' + (d._rt.userFilesVer || 0); if (d._rt._tree && d._rt._treeKey === key) return d._rt._tree; d._rt._tree = W_.tree(W, d); d._rt._treeKey = key; return d._rt._tree; };
W_.dirNode = (W, d, p) => W_.getTree(W, d)[lc(p.replace(/\\$/, '') || p)] || null;

/* Droits NTFS locaux de la session sur un chemin (administrateurs : accès complet) */
W_.localRights = function (W, d, p) {
  if (!d.win.ntfs || !AD.ntfsFolder(d, p)) return 7;       // dossiers système : lecture/écriture pour tous (simplification documentée)
  const tok = W_.token(W, d);
  if (W_.isAdminUser(W, d)) tok.add('builtin\\administrateurs');
  return AD.ntfsEffective(d, p, tok).rights;
};

/* ------------------------------------------------------------------ session cmd.exe */
function WinShell(env, devId, opts) {
  E.Session.call(this, env, devId, opts);
  opts = opts || {}; const d = this.d;
  this.kind = 'cmd'; this.mode = opts.mode || 'cmd';
  this.elevated = !!opts.elevated;
  this.user = opts.user || W_.sessionUser(d) || 'tech';
  this.cwd = opts.cwd || ('C:\\Users\\' + this.user);
  this.vars = {}; this.echoOff = false;
  this.sub = null;                       // sous-mode interactif (nslookup)
}
WinShell.prototype = Object.create(E.Session.prototype);
WinShell.prototype.constructor = WinShell;
E.WinShell = WinShell;

WinShell.prototype.banner = function () {
  const d = this.d; if (this.mode === 'ps') return [L('Windows PowerShell'), L('Copyright (C) Microsoft Corporation. Tous droits réservés.'), L(''), L('Testez la nouvelle fonctionnalité de multiplateforme PowerShell https://aka.ms/pscore6'), L('')];
  return [L('Microsoft Windows [version ' + W_.build(d) + ']'), L('(c) Microsoft Corporation. Tous droits réservés.'), L('')];
};
WinShell.prototype.prompt = function () {
  if (this.ask) return this.ask.prompt;
  if (this.sub) return this.sub.prompt;
  return this.mode === 'ps' ? 'PS ' + this.cwd + '> ' : this.cwd + '>';
};
WinShell.prototype.title = function () { return (this.mode === 'ps' ? 'Windows PowerShell' : 'Invite de commandes') + (this.elevated ? ' (administrateur)' : ''); };
WinShell.prototype.envVar = function (name) {
  const d = this.d, u = this.user, W = this.W; const k = name.toUpperCase();
  if (this.vars[k] !== undefined) return this.vars[k];
  const map = { USERNAME: u, COMPUTERNAME: d.name.toUpperCase(), USERDOMAIN: W_.netbios(W, d), USERPROFILE: 'C:\\Users\\' + u, HOMEPATH: '\\Users\\' + u, HOMEDRIVE: 'C:', SYSTEMROOT: 'C:\\Windows', WINDIR: 'C:\\Windows', SYSTEMDRIVE: 'C:', TEMP: 'C:\\Users\\' + u + '\\AppData\\Local\\Temp', TMP: 'C:\\Users\\' + u + '\\AppData\\Local\\Temp', OS: 'Windows_NT', PROCESSOR_ARCHITECTURE: 'AMD64', NUMBER_OF_PROCESSORS: '2', LOGONSERVER: '\\\\' + (d._rt.session && d._rt.session.dc ? d._rt.session.dc : d.name.toUpperCase()), PATH: 'C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\;C:\\Windows\\System32\\OpenSSH\\', PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC', PROMPT: '$P$G', DATE: E.frDate(W.nowOf(d.id)), TIME: E.frTime(W.nowOf(d.id)) };
  return map[k];
};
WinShell.prototype.expand = function (line) { return line.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, n) => { const v = this.envVar(n); return v === undefined ? m : v; }); };

/* Exécution d'une ligne : opérateurs &, &&, ||, | et redirections simples */
WinShell.prototype.run = function (line) {
  if (this.sub) return this.sub.exec(this, line);
  const raw = line;
  line = this.mode === 'ps' ? line : this.expand(line);
  if (!line.trim()) return { out: [] };
  const res = { out: [], mutated: false };
  /* séparateurs && et || et & (cmd) ; en PowerShell « ; » */
  const parts = this.splitChain(line);
  let lastOk = true;
  for (const part of parts) {
    if (part.op === '&&' && !lastOk) continue;
    if (part.op === '||' && lastOk) continue;
    const r = this.runPipeline(part.text);
    r.out.forEach(x => res.out.push(x));
    if (r.mutated) res.mutated = true;
    if (r.impact && !res.impact) res.impact = r.impact; if (r.danger && !res.danger) res.danger = r.danger;   /* tags du barème (D-109) : « net stop x && net start x » garde le premier ; avant le 30/10/2026 cmd les perdait ici */
    ['ask', 'push', 'pop', 'clear', 'launch', 'stream', 'pager', 'exit', 'switch'].forEach(k => { if (r[k] !== undefined) res[k] = r[k]; });
    lastOk = r.ok !== false;
    if (r.ask || r.push || r.exit || r.stream) break;
  }
  return res;
};
WinShell.prototype.splitChain = function (line) {
  const parts = []; let cur = '', q = false, op = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    if (!q && c === '&' && line[i + 1] === '&') { parts.push({ text: cur, op }); cur = ''; op = '&&'; i++; continue; }
    if (!q && c === '|' && line[i + 1] === '|') { parts.push({ text: cur, op }); cur = ''; op = '||'; i++; continue; }
    if (!q && c === '&') { parts.push({ text: cur, op }); cur = ''; op = '&'; continue; }
    if (!q && c === ';' && this.mode === 'ps') { parts.push({ text: cur, op }); cur = ''; op = ';'; continue; }
    cur += c;
  }
  parts.push({ text: cur, op });
  return parts.filter(p => p.text.trim());
};
WinShell.prototype.splitPipe = function (s) { const out = []; let cur = '', q = false; for (const c of s) { if (c === '"') q = !q; if (c === '|' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
WinShell.prototype.runPipeline = function (text) {
  if (this.mode === 'ps' && W_.psPipeline) { const pr = W_.psPipeline(this, text); if (pr) return pr; }
  const segs = this.splitPipe(text);
  let r = this.runOne(segs[0].trim(), null);
  for (let i = 1; i < segs.length; i++) {
    const filt = this.runFilter(segs[i].trim(), r.out);
    if (r.mutated) filt.mutated = true;
    if (r.impact) filt.impact = r.impact; if (r.danger) filt.danger = r.danger;
    r = filt;
  }
  /* redirection >, >> */
  if (segs.length === 1) {
    const m = text.match(/^(.*?)(>>?)\s*("[^"]+"|[^\s>]+)\s*$/);
    if (m && this.mode === 'cmd') {
      const inner = this.runOne(m[1].trim(), null); const path = W_.normPath(this.cwd, m[3]);
      return this.writeFile(path, inner.out.map(x => x.t).join('\r\n') + (inner.out.length ? '\r\n' : ''), m[2] === '>>', inner);
    }
  }
  return r;
};
WinShell.prototype.writeFile = function (path, content, append, inner) {
  const d = this.d, W = this.W; const res = { out: [], mutated: !!(inner && inner.mutated), ok: true };
  if (lc(path) === lc(W_.HOSTS_PATH)) {
    if (!this.elevated) { res.out.push(L('Accès refusé.', 'e')); res.ok = false; return res; }
    const cur = W_.hostsText(d); W_.setHostsText(W, d, append ? cur + content : content); res.mutated = true; return res;
  }
  const dp = path.slice(0, path.lastIndexOf('\\'));
  const node = W_.dirNode(W, d, dp);
  if (!node) { res.out.push(L('Le chemin d’accès spécifié est introuvable.', 'e')); res.ok = false; return res; }
  if (!(W_.localRights(W, d, dp) & 2)) { res.out.push(L('Accès refusé.', 'e')); res.ok = false; return res; }
  d._rt.userFiles = d._rt.userFiles || {}; d._rt.userFiles[path] = (append ? (d._rt.userFiles[path] || '') : '') + content; d._rt.userFilesVer = (d._rt.userFilesVer || 0) + 1;
  return res;
};
WinShell.prototype.readFile = function (path) {
  const d = this.d, W = this.W;
  if (lc(path) === lc(W_.HOSTS_PATH)) return { text: W_.hostsText(d) };
  const mem = d._rt.userFiles || {}; const k = Object.keys(mem).find(x => lc(x) === lc(path)); if (k) return { text: mem[k] };
  const dp = path.slice(0, path.lastIndexOf('\\')); const node = W_.dirNode(W, d, dp);
  if (!node) return { err: 'path' };
  const name = path.slice(path.lastIndexOf('\\') + 1); const f = [...node.files.keys()].find(x => lc(x) === lc(name));
  if (!f) return { err: 'file' };
  if (!(W_.localRights(W, d, dp) & 1)) return { err: 'denied' };
  return { text: '[contenu du fichier ' + f + ']' };
};

/* Filtres de tube : findstr, find, more, sort */
WinShell.prototype.runFilter = function (cmd, input) {
  const args = E.splitWin(cmd, this.mode === 'ps'); const name = lc((args[0] || '').replace(/\.exe$/, ''));
  const lines = input.map(x => x.t);
  const res = { out: [], ok: true };
  if (name === 'findstr' || name === 'find' || name === 'select-string' || name === 'sls') {
    let ci = false, pat = null, regex = false, inv = false; const rest = [];
    for (const a of args.slice(1)) {
      if (/^\/i$/i.test(a)) ci = a === '/i' || a === '/I'; else if (/^\/r$/i.test(a)) regex = true; else if (/^\/v$/i.test(a)) inv = true; else if (/^\/[a-z]$/i.test(a)) { /* ignoré */ }
      else if (/^-(NotMatch)$/i.test(a)) inv = true; else if (/^-CaseSensitive$/i.test(a)) ci = false; else if (/^-Pattern$/i.test(a)) { /* valeur suivante */ } else rest.push(a);
    }
    if (name === 'find') ci = args.some(a => a.toLowerCase() === '/i');
    if (name === 'select-string' || name === 'sls') ci = !args.some(a => /^-CaseSensitive$/i.test(a));
    pat = rest[0]; if (pat === undefined) { res.out.push(L('FINDSTR : mot de passe ou chaîne de recherche manquante.', 'e')); return res; }
    const pats = (name === 'findstr' && !regex) ? pat.split(' ') : [pat];
    lines.forEach(l => {
      const hay = ci ? l.toLowerCase() : l;
      const hit = pats.some(p => { const pp = ci ? p.toLowerCase() : p; if (regex || name === 'select-string' || name === 'sls') { try { return new RegExp(pp, ci ? 'i' : '').test(l); } catch (e) { return false; } } return hay.indexOf(pp) >= 0; });
      if (hit !== inv) res.out.push(L(l));
    });
    return res;
  }
  if (name === 'more' || name === 'out-host' || name === 'format-table' || name === 'ft' || name === 'out-string' || name === 'format-list' || name === 'fl') return { out: input.slice(), ok: true };
  if (name === 'sort' || name === 'sort-object') { const sorted = lines.slice().sort((a, b) => a.localeCompare(b)); if (args.some(a => /^\/r$/i.test(a) || /^-Descending$/i.test(a))) sorted.reverse(); return { out: sorted.map(x => L(x)), ok: true }; }
  if (name === 'measure-object' || name === 'measure') { return { out: [L(''), L('Count    : ' + lines.length), L('')], ok: true }; }
  if (name === 'select-object' || name === 'select') {
    const first = args.indexOf('-First'); if (first >= 0) { const n = +args[first + 1]; return { out: input.slice(0, n + 2), ok: true }; }
    return { out: input.slice(), ok: true };
  }
  return { out: [L('\'' + args[0] + '\' n’est pas reconnu en tant que commande interne ou externe,', 'e'), L('un programme exécutable ou un fichier de commandes.', 'e')], ok: false };
};

/* Commande unique */
WinShell.prototype.runOne = function (text, input) {
  const d = this.d;
  if (!text) return { out: [], ok: true };
  /* lecteur seul : « D: » */
  if (/^[A-Za-z]:$/.test(text)) {
    const p = text.toUpperCase() + '\\'; if (!W_.dirNode(this.W, d, p)) return { out: [L('Le chemin d’accès spécifié est introuvable.', 'e')], ok: false };
    this.cwd = p; return { out: [], ok: true };
  }
  const args = E.splitWin(text, this.mode === 'ps');
  let name = args[0]; if (!name) return { out: [], ok: true };
  const bare = lc(name.replace(/^.*[\\/]/, '').replace(/\.(exe|cmd|bat|msc|cpl)$/i, ''));
  /* « cmd /c », « powershell » */
  if (this.mode === 'ps') { const psr = W_.runPs ? W_.runPs(this, text, args) : null; if (psr) return psr; }
  const fn = W_.cmds[bare] || W_.cmds[lc(name)];
  if (fn) {
    const res = { out: [], ok: true, mutated: false };
    const out = new Out();
    let r;
    try { r = fn(this, args.slice(1), out, res, text); } catch (e) { out.e('Erreur interne de l’émulateur : ' + e.message); res.ok = false; if (typeof console !== 'undefined' && this.env.hooks.debug) console.error(e); }
    if (r && typeof r === 'object') Object.assign(res, r);
    res.out = (res.out || []).concat(out.lines);
    return res;
  }
  /* exécutables / consoles MMC → application graphique */
  const gui = W_.apps[bare];
  if (gui) {
    let arg = args.slice(1).join(' ');
    /* « notepad hosts » ou « notepad C:\...\hosts » : chemin rendu absolu depuis le dossier courant, le Bloc-notes charge le fichier */
    if (gui === 'notepad' && arg.trim()) arg = W_.normPath(this.cwd, arg.trim());
    return { out: [], ok: true, launch: [{ app: gui, arg, cmd: name }] };
  }
  /* « help » existe dans cmd.exe : le simulateur ne reproduit pas sa liste ; on renvoie vers l'aide-mémoire de la fenêtre */
  if (/^help$/i.test(name) && this.mode !== 'ps') return { out: [L(U.av('win-help-unsupported', 'Commande réelle non gérée par le simulateur : help. Utilise le bouton « Aide-mémoire » de la fenêtre pour la liste des commandes disponibles.'), 'w'), L('')], ok: false };
  /* D-99 : commandes dont l'existence sur Windows Server 2019 ET Windows 10 (Pro et au-dessus, donc tout poste joint à un domaine) ne fait pas de doute et que le simulateur n'émule pas :
     on le dit, au lieu de prétendre qu'elles n'existent pas. Liste volontairement courte ; « telnet » en est exclue (fonctionnalité optionnelle, absente par défaut : « n'est pas reconnu » y est la vraie réponse). */
  if (REAL_CMD_UNSUPPORTED[bare]) return { out: [L(U.av('win-unsupported-cmd', 'Commande réelle non gérée par le simulateur : ' + bare + '. Utilise le bouton « Aide-mémoire » de la fenêtre pour la liste des commandes disponibles.'), 'w'), L('')], ok: false };
  /* outils réels des contrôleurs de domaine que le simulateur n'émule pas : on le dit, au lieu de prétendre qu'ils n'existent pas */
  if (this.d.win && this.d.win.ad && /^(netdom|dcdiag|repadmin|dsquery|dsget|setspn)(\.exe)?$/i.test(name)) return { out: [L(U.av('win-unsupported-tool', 'Outil réel non géré par le simulateur : ' + name.replace(/\.exe$/i, '') + '. Utilise la console graphique correspondante (Utilisateurs et ordinateurs AD, Sites et services AD, Domaines et approbations) ou nltest.'), 'w'), L('')], ok: false };
  if (this.mode === 'ps') return { out: [L('Le terme «' + name + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable. Vérifiez l’orthographe du nom, ou si un chemin d’accès existe, vérifiez que le chemin d’accès est correct et réessayez.', 'e'), L('Au caractère Ligne:1 : 1', 'e'), L('+ ' + text, 'e'), L('+ ~~~~', 'e'), L('    + CategoryInfo          : ObjectNotFound: (' + name + ':String) [], CommandNotFoundException', 'e'), L('    + FullyQualifiedErrorId : CommandNotFoundException', 'e'), L('')], ok: false };
  return { out: [L('\'' + name + '\' n’est pas reconnu en tant que commande interne', 'e'), L('ou externe, un programme exécutable ou un fichier de commandes.', 'e'), L('')], ok: false };
};

/* applications graphiques lançables depuis la ligne de commande */
W_.apps = {
  notepad: 'notepad', mstsc: 'mstsc', explorer: 'explorer', services: 'services', eventvwr: 'eventvwr', dsa: 'aduc', dhcpmgmt: 'dhcp', dnsmgmt: 'dns', gpmc: 'gpmc', wf: 'wf', inetmgr: 'iis', ncpa: 'ncpa', inetcpl: 'inetcpl',
  compmgmt: 'compmgmt', lusrmgr: 'lusrmgr', taskmgr: 'taskmgr', control: 'control', devmgmt: 'devmgmt', diskmgmt: 'diskmgmt', certlm: 'certlm', gpedit: 'gpedit', msinfo32: 'msinfo', mmc: 'mmc',
  'server-manager': 'servermgr', servermanager: 'servermgr', msedge: 'browser', iexplore: 'browser', chrome: 'browser', firefox: 'browser', openvpn: 'openvpn', 'openvpn-gui': 'openvpn', putty: 'putty', regedit: 'regedit',
  powershell_ise: 'ise', domain: 'domain', 'domain.msc': 'domain', dsac: 'aduc', 'dnsmgmt.msc': 'dns', 'dsa.msc': 'aduc'
};

/* ------------------------------------------------------------------ complétion */
WinShell.prototype.complete = function (buf) {
  const m = buf.match(/(\S*)$/); const word = m ? m[1] : ''; const from = buf.length - word.length; const first = buf.slice(0, from).trim() === '';
  if (first) {
    const names = Object.keys(W_.cmds).concat(this.mode === 'ps' ? Object.keys(W_.ps) : []);
    const list = names.filter(n => n.toLowerCase().indexOf(word.toLowerCase()) === 0);
    return { list: list.sort(), from, word };
  }
  /* chemins */
  const unq = word.replace(/^"/, ''); const idx = Math.max(unq.lastIndexOf('\\'), unq.lastIndexOf('/'));
  const dirPart = idx >= 0 ? unq.slice(0, idx + 1) : ''; const namePart = idx >= 0 ? unq.slice(idx + 1) : unq;
  const base = dirPart ? W_.normPath(this.cwd, dirPart) : this.cwd; const node = W_.dirNode(this.W, this.d, base);
  if (!node) return { list: [], from, word };
  const cands = [...node.dirs].map(x => dirPart + x + '\\').concat([...node.files.keys()].map(x => dirPart + x));
  const list = cands.filter(c => lc(c.slice(dirPart.length)).indexOf(lc(namePart)) === 0);
  return { list: list.sort(), from: from + (word[0] === '"' ? 1 : 0), word: unq };
};

/* ------------------------------------------------------------------ commandes internes */
const C = W_.cmds;
C.cls = (s, a, o, r) => { r.clear = true; };
C.exit = (s, a, o, r) => { r.exit = true; };
C.ver = (s, a, o) => { o.blank(); o.l('Microsoft Windows [version ' + W_.build(s.d) + ']'); };
C.hostname = (s, a, o) => { o.l(s.d.name.toUpperCase()); };
C.echo = (s, a, o, r, text) => {
  const rest = text.replace(/^\s*echo\.?\s?/i, '');
  if (/^off$/i.test(rest)) { s.echoOff = true; return; } if (/^on$/i.test(rest)) { s.echoOff = false; return; }
  o.l(rest);
};
C.title = () => {}; C.color = () => {}; C.pause = (s, a, o) => { o.l('Appuyez sur une touche pour continuer...'); };
C.set = (s, a, o, r, text) => {
  const rest = text.replace(/^\s*set\s*/i, '');
  if (!rest) { ['ALLUSERSPROFILE', 'COMPUTERNAME', 'HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'NUMBER_OF_PROCESSORS', 'OS', 'PATH', 'PATHEXT', 'PROCESSOR_ARCHITECTURE', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'WINDIR'].forEach(k => { const v = s.envVar(k); if (v !== undefined) o.l(k + '=' + v); }); return; }
  const eq = rest.indexOf('=');
  if (eq < 0) { const hits = ['COMPUTERNAME', 'USERNAME', 'USERDOMAIN', 'USERPROFILE', 'PATH', 'TEMP', 'TMP', 'OS', 'WINDIR', 'SYSTEMROOT'].filter(k => k.indexOf(rest.toUpperCase()) === 0); if (!hits.length) { o.l('La variable d’environnement ' + rest + ' n’est pas définie.'); r.ok = false; } else hits.forEach(k => o.l(k + '=' + s.envVar(k))); return; }
  s.vars[rest.slice(0, eq).toUpperCase()] = rest.slice(eq + 1);
};
C.date = (s, a, o) => { const dt = s.W.nowOf(s.d.id); if (a.some(x => /^\/t$/i.test(x))) { o.l(E.FR_DAYS[dt.getUTCDay()].slice(0, 3) + '. ' + E.frDate(dt).replace(/^0/, '')); return; } o.l('La date actuelle est : ' + E.FR_DAYS[dt.getUTCDay()].slice(0, 3) + '. ' + E.frDate(dt)); o.l('Entrez la nouvelle date : (jj-mm-aa)'); };
C.time = (s, a, o) => { const dt = s.W.nowOf(s.d.id); if (a.some(x => /^\/t$/i.test(x))) { o.l(U.pad2(dt.getUTCHours()) + ':' + U.pad2(dt.getUTCMinutes())); return; } o.l('L’heure actuelle est : ' + E.frTime(dt) + ',00'); };
C.cd = C.chdir = (s, a, o, r) => {
  if (!a.length) { o.l(s.cwd); return; }
  let t = a.filter(x => !/^\/d$/i.test(x)).join(' ');
  const p = W_.normPath(s.cwd, t); const node = W_.dirNode(s.W, s.d, p);
  if (!node) { o.l('Le chemin d’accès spécifié est introuvable.', 'e'); r.ok = false; return; }
  if (!(W_.localRights(s.W, s.d, p) & 1)) { o.l('Accès refusé.', 'e'); r.ok = false; return; }
  s.cwd = node.name.length === 2 ? node.name + '\\' : node.name;
};
C.type = (s, a, o, r) => {
  if (!a.length) { o.l('La syntaxe de la commande n’est pas correcte.', 'e'); r.ok = false; return; }
  a.forEach(f => {
    const path = W_.normPath(s.cwd, f); const x = s.readFile(path);
    if (x.err === 'denied') { o.l('Accès refusé.', 'e'); r.ok = false; } else if (x.err) { o.l('Le fichier spécifié est introuvable.', 'e'); r.ok = false; } else o.l(x.text.replace(/\r\n$/, '').replace(/\r\n/g, '\n'));
  });
};
C.dir = (s, a, o, r) => {
  const args = a.filter(x => !/^\//.test(x)); const bare = a.some(x => /^\/b$/i.test(x));
  const p = W_.normPath(s.cwd, args[0] || '.'); const node = W_.dirNode(s.W, s.d, p);
  if (!node) { o.blank(); o.l(' Le volume dans le lecteur ' + p[0] + ' n’a pas de nom.'); o.l(' Le numéro de série du volume est ' + U.hash8(s.d.id + p[0]).slice(0, 4).toUpperCase() + '-' + U.hash8(p[0] + s.d.id).slice(0, 4).toUpperCase()); o.blank(); o.l(' Répertoire de ' + p.replace(/\\$/, '')); o.blank(); o.l('Fichier introuvable', 'e'); r.ok = false; return; }
  if (!(W_.localRights(s.W, s.d, node.name) & 1)) { o.l('Accès refusé.', 'e'); r.ok = false; return; }
  const dirs = [...node.dirs].sort((x, y) => x.localeCompare(y)); const files = [...node.files.keys()].sort((x, y) => x.localeCompare(y));
  if (bare) { dirs.concat(files).forEach(x => o.l(x)); return; }
  const dt = s.W.nowOf(s.d.id);
  o.l(' Le volume dans le lecteur ' + p[0] + ' n’a pas de nom.'); o.l(' Le numéro de série du volume est ' + U.hash8(s.d.id + p[0]).slice(0, 4).toUpperCase() + '-' + U.hash8(p[0] + s.d.id).slice(0, 4).toUpperCase());
  o.blank(); o.l(' Répertoire de ' + node.name); o.blank();
  const fmtDate = x => E.frDate(x) + '  ' + U.pad2(x.getUTCHours()) + ':' + U.pad2(x.getUTCMinutes());
  o.l(fmtDate(dt) + '    <DIR>          .'); if (node.name.length > 3) o.l(fmtDate(dt) + '    <DIR>          ..');
  dirs.forEach(x => o.l(fmtDate(new Date(dt.getTime() - 86400000 * (7 + U.hash8(x).charCodeAt(0) % 90))) + '    <DIR>          ' + x));
  let total = 0;
  files.forEach(x => { const f = node.files.get(x); total += f.size; o.l(fmtDate(f.date) + ' ' + E.padL(f.size.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' '), 14) + ' ' + x); });
  o.l(E.padL(files.length, 16) + ' fichier(s) ' + E.padL(total.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' '), 14) + ' octets');
  o.l(E.padL(dirs.length + (node.name.length > 3 ? 2 : 1), 16) + ' Rép(s)  ' + E.padL('21 474 836 480', 15) + ' octets libres');
};
C.mkdir = C.md = (s, a, o, r) => {
  const p = W_.normPath(s.cwd, a[0] || ''); const dp = p.slice(0, p.lastIndexOf('\\')) || p.slice(0, 3);
  if (!W_.dirNode(s.W, s.d, dp)) { o.l('Le chemin d’accès spécifié est introuvable.', 'e'); r.ok = false; return; }
  if (!(W_.localRights(s.W, s.d, dp) & 2)) { o.l('Accès refusé.', 'e'); r.ok = false; return; }
  s.d._rt.userDirs = s.d._rt.userDirs || []; s.d._rt.userDirs.push(p); s.d._rt.userFiles = s.d._rt.userFiles || {}; s.d._rt.userFiles[p + '\\.keep'] = ''; s.d._rt.userFilesVer = (s.d._rt.userFilesVer || 0) + 1;
};
C.del = C.erase = (s, a, o, r) => {
  const f = W_.normPath(s.cwd, a.filter(x => !/^\//.test(x))[0] || ''); const mem = s.d._rt.userFiles || {}; const k = Object.keys(mem).find(x => lc(x) === lc(f));
  if (!k) { o.l('Fichier introuvable - ' + f, 'e'); r.ok = false; return; }
  delete mem[k]; s.d._rt.userFilesVer = (s.d._rt.userFilesVer || 0) + 1;
};
C.copy = (s, a, o, r) => { o.l('        1 fichier(s) copié(s).'); };
C.whoami = (s, a, o, r) => {
  const d = s.d, W = s.W; const me = W_.whoami(W, d, s.user);
  if (a.some(x => /^\/user$/i.test(x))) { o.blank(); o.l('INFORMATIONS UTILISATEUR'); o.l('------------------------'); o.blank(); E.table([{ n: me, s: AD.pid ? 'S-1-5-21-' + U.hash8(me).replace(/[a-f]/g, '3') + '-' + (1000 + parseInt(U.hash8(me + 'r').slice(0, 3), 16) % 8000) : '' }], [{ h: 'Nom d’utilisateur', key: 'n' }, { h: 'SID', key: 's' }]).forEach(x => o.l(x)); return; }
  if (a.some(x => /^\/groups$/i.test(x)) || a.some(x => /^\/all$/i.test(x))) {
    o.blank(); o.l('INFORMATIONS DE GROUPE'); o.l('----------------------'); o.blank();
    const tok = W_.token(W, d); const rows = [];
    W_.tokenNames(W, d, tok).forEach(nm => { rows.push({ n: nm, t: /^(BUILTIN|NT AUTHORITY)\\|^Tout le monde$/.test(nm) ? 'Alias bien connu' : 'Groupe', a: 'Groupe obligatoire, Activé par défaut, Groupe activé' }); });
    E.table(rows, [{ h: 'Nom de groupe', key: 'n' }, { h: 'Type', key: 't' }, { h: 'Attributs', key: 'a' }]).forEach(x => o.l(x));
    U.av('whoami-groups-format', 'Sortie whoami /groups : mise en forme simplifiée (colonnes SID absentes), à valider par capture.'); return;
  }
  o.l(me);
};
C.getmac = (s, a, o) => {
  const rows = W_.ifaceNames(s.d).map(n => { const i = s.d.ifaces[n]; const up = N.linkUp(s.W, s.d, n); return { a: E.macDash(i.mac), t: up ? '\\Device\\Tcpip_{' + U.hash8(s.d.id + n).toUpperCase() + '-' + U.hash8(n + s.d.id).slice(0, 4).toUpperCase() + '-4A1F-9C3B-' + U.hash8(i.mac).toUpperCase() + '}' : 'Média déconnecté' }; });
  o.blank(); E.table(rows, [{ h: 'Adresse physique', key: 'a' }, { h: 'Nom de transport', key: 't' }]).forEach(x => o.l(x));
  o.l('');
  U.av('getmac-format', 'Sortie getmac : en-têtes « Adresse physique / Nom de transport » et GUID de transport, mise en forme à valider.');
};
C.systeminfo = (s, a, o) => {
  const d = s.d, W = s.W; const dt = W.nowOf(d.id);
  const inf = [['Nom de l’hôte', d.name.toUpperCase()], ['Nom du système d’exploitation', 'Microsoft ' + (d.os || 'Windows')], ['Version du système', W_.build(d) + ' N/A Build ' + W_.build(d).split('.')[2]], ['Type de système', 'x64-based PC'], ['Domaine', d.win.domain || d.win.workgroup], ['Serveur d’ouverture de session', d._rt.session && d._rt.session.dc ? '\\\\' + d._rt.session.dc : 'N/A'], ['Heure de démarrage du système', E.frDateTime(new Date(W.clock.base - 3 * 3600000))], ['Fuseau horaire', '(UTC+00:00) Temps universel coordonné']];
  inf.forEach(([k, v]) => o.l(E.padR(k + ':', 38) + v));
  U.av('systeminfo-format', 'Sortie systeminfo : sous-ensemble de champs avec libellés reconstitués, à valider par capture.');
};
C.tasklist = (s, a, o) => { o.blank(); E.table([{ n: 'System Idle Process', p: 0 }, { n: 'System', p: 4 }, { n: 'svchost.exe', p: 880 }, { n: 'explorer.exe', p: 4120 }, { n: 'cmd.exe', p: 5132 }], [{ h: 'Nom de l’image', key: 'n', w: 25 }, { h: 'PID', key: 'p', right: true }]).forEach(x => o.l(x)); };
C.timeout = (s, a, o) => { const n = +(a.find(x => /^\d+$/.test(x)) || 0); s.env.advance(n); o.l('Attente de ' + n + ' secondes, appuyez sur une touche pour continuer ...'); };
C.cmd = (s, a, o, r) => { if (a.some(x => /^\/c$/i.test(x))) { const rest = a.slice(a.findIndex(x => /^\/c$/i.test(x)) + 1).join(' '); const q = s.runPipeline(rest); r.mutated = q.mutated; Object.assign(r, q); return; } o.add(s.banner()); };
C.powershell = (s, a, o, r) => {
  if (a.some(x => /^-command$|^-c$/i.test(x))) { const i = a.findIndex(x => /^-command$|^-c$/i.test(x)); const sub = new WinShell(s.env, s.devId, { mode: 'ps', elevated: s.elevated, user: s.user, cwd: s.cwd }); const q = sub.runPipeline(a.slice(i + 1).join(' ')); Object.assign(r, q); return; }
  r.push = new WinShell(s.env, s.devId, { mode: 'ps', elevated: s.elevated, user: s.user, cwd: s.cwd }); r.out = r.push.banner();
};
C.pwsh = C.powershell;
C.shutdown = (s, a, o, r) => {
  const d = s.d, W = s.W;
  if (!s.elevated) { o.l('Accès refusé.(5)', 'e'); r.ok = false; return; }
  if (a.some(x => /^\/a$/i.test(x))) { o.l('Le délai d’arrêt a été annulé.'); return; }
  const rb = a.some(x => /^\/r$/i.test(x)), lo = a.some(x => /^\/l$/i.test(x)), sd = a.some(x => /^\/s$/i.test(x));
  if (!(rb || lo || sd)) { o.l('Usage : shutdown [/i | /l | /s | /sg | /r | /g | /a | /p | /h | /e | /o] [/hybrid] [/soft] [/fw] [/f]', 'e'); o.l('    [/m \\\\ordinateur][/t xxx][/d [p|u:]xx:yy [/c "commentaire"]]'); r.ok = false; return; }
  const delay = a.indexOf('/t') >= 0 ? +a[a.indexOf('/t') + 1] : 30;
  if (lo) { AD.sessionEnd(W, d.id); r.mutated = true; r.logoff = true; return; }
  r.mutated = true; r.reboot = true; r.rebootDelay = delay; r.impact = 'reboot';
  S_doReboot(s, rb);
};
function S_doReboot(s, rb) { SIM.steps.reboot(s.W, { dev: s.devId }); s.env.touch('reboot'); }
C.logoff = (s, a, o, r) => { AD.sessionEnd(s.W, s.d.id); r.mutated = true; r.logoff = true; };

/* ------------------------------------------------------------------ exposition */
E.openWinShell = function (env, devId, opts) { return new WinShell(env, devId, opts); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
