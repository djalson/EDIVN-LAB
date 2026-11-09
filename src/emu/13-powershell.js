/* ============================================================================
   Windows PowerShell — interpréteur d'objets simplifié : cmdlets qui produisent des objets (état réel du monde),
   tubes Where-Object / Select-Object / Sort-Object / ForEach-Object / Format-Table / Format-List,
   variables, hashtables, sous-expressions. Les modules AD / DHCP / DNS / pare-feu ne sont présents que là où le rôle l'est.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, WIN = SIM.win, AD = SIM.ad, WEB = SIM.web;
const E = SIM.emu; const L = E.L, W_ = E.win;
const lc = s => String(s).toLowerCase();

U.av('ps-formats', 'Mise en forme PowerShell (tables, listes, en-têtes de Get-WinEvent, Get-Service, Get-DhcpServerv4Scope, Get-DnsServerResourceRecord…) : colonnes fidèles aux propriétés réelles, largeurs et libellés d’erreur en français reconstitués de mémoire.');
U.av('ps-errors-fr', 'Messages d’erreur PowerShell en français (« n’est pas reconnu en tant que nom d’applet de commande… », « Impossible de trouver un service… », « Ce nom n’existe pas. ») reconstitués de mémoire.');

/* ------------------------------------------------------------------ tokenisation PowerShell */
function psTokens(str) {
  const out = []; let i = 0; const n = str.length;
  while (i < n) {
    while (i < n && /\s/.test(str[i])) i++;
    if (i >= n) break;
    let tok = ''; let depth = 0; let q = null;
    while (i < n) {
      const c = str[i];
      if (q) { tok += c; if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; tok += c; i++; continue; }
      if (c === '{' || c === '(' || c === '[') { depth++; tok += c; i++; continue; }
      if (c === '}' || c === ')' || c === ']') { depth--; tok += c; i++; continue; }
      if (/\s/.test(c) && depth <= 0) break;
      tok += c; i++;
    }
    out.push(tok);
  }
  return out;
}
function splitTop(str, sep) {
  const out = []; let cur = ''; let depth = 0; let q = null;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if ('{(['.indexOf(c) >= 0) depth++; if ('})]'.indexOf(c) >= 0) depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur); return out;
}

/* ------------------------------------------------------------------ évaluation de valeurs */
function interp(s, ctx) {
  return s.replace(/\$\(([^)]*)\)|\$env:(\w+)|\$(\w+)((?:\.\w+)*)/g, (m, sub, env, v, props) => {
    if (sub !== undefined) { const r = evalExpr(sub, ctx); return Array.isArray(r) ? r.join(' ') : String(r === undefined || r === null ? '' : r); }
    if (env) { const x = ctx.s.envVar(env); return x === undefined ? '' : x; }
    let val = v === '_' ? ctx.cur : ctx.vars[v];
    if (props) props.split('.').filter(Boolean).forEach(p => { val = val == null ? undefined : val[p] !== undefined ? val[p] : val[Object.keys(val).find(k => lc(k) === lc(p))]; });
    return val === undefined || val === null ? '' : (Array.isArray(val) ? val.join(' ') : String(val));
  });
}
function evalValue(tok, ctx) {
  tok = tok.trim();
  if (tok === '') return '';
  if (/^'.*'$/s.test(tok)) return tok.slice(1, -1).replace(/''/g, "'");
  if (/^".*"$/s.test(tok)) return interp(tok.slice(1, -1).replace(/`n/g, '\n'), ctx);
  if (/^\$true$/i.test(tok)) return true; if (/^\$false$/i.test(tok)) return false; if (/^\$null$/i.test(tok)) return null;
  if (/^-?\d+(\.\d+)?$/.test(tok)) return +tok;
  if (/^@\{.*\}$/s.test(tok)) { const o = {}; splitTop(tok.slice(2, -1), ';').forEach(kv => { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i).trim()] = evalValue(kv.slice(i + 1), ctx); }); return o; }
  if (/^@\(.*\)$/s.test(tok)) return splitTop(tok.slice(2, -1), ',').map(x => evalValue(x, ctx));
  if (/^\{.*\}$/s.test(tok)) return { __block: tok.slice(1, -1) };
  if (/^\(.*\)$/s.test(tok)) { const r = evalExpr(tok.slice(1, -1), ctx); return r; }
  if (tok.indexOf(',') > 0 && !/^[-\$]/.test(tok)) return splitTop(tok, ',').map(x => evalValue(x, ctx));
  const vm = tok.match(/^\$(\w+)((?:\.\w+)*)$/);
  if (vm) { let val = vm[1] === '_' ? ctx.cur : ctx.vars[vm[1]]; if (vm[2]) vm[2].split('.').filter(Boolean).forEach(p => { if (val == null) return; if (Array.isArray(val) && val.length === 1) val = val[0]; val = val[p] !== undefined ? val[p] : val[Object.keys(val).find(k => lc(k) === lc(p))]; }); return val; }
  const em = tok.match(/^\$env:(\w+)$/i); if (em) return ctx.s.envVar(em[1]);
  return tok;
}
/* expression : commande, ou opération de comparaison dans un bloc */
function evalExpr(expr, ctx) {
  expr = expr.trim();
  if (!expr) return null;
  const r = runStatement(expr, ctx, null);
  if (r.objs !== undefined) return r.objs.length === 1 ? r.objs[0] : r.objs;
  return null;
}

/* condition d'un Where-Object : comparaisons chaînées par -and / -or */
function evalCond(expr, ctx) {
  expr = expr.trim();
  const orParts = expr.split(/\s+-or\s+/i);
  if (orParts.length > 1) return orParts.some(p => evalCond(p, ctx));
  const andParts = expr.split(/\s+-and\s+/i);
  if (andParts.length > 1) return andParts.every(p => evalCond(p, ctx));
  if (/^\(.*\)$/.test(expr)) return evalCond(expr.slice(1, -1), ctx);
  const neg = expr.match(/^(?:-not|!)\s*(.*)$/i); if (neg) return !evalCond(neg[1], ctx);
  const m = expr.match(/^(.+?)\s+-(eq|ne|like|notlike|match|notmatch|gt|lt|ge|le|contains|notcontains|in|ceq|cne)\s+(.+)$/is);
  if (!m) { const v = evalValue(expr, ctx); return !!(Array.isArray(v) ? v.length : v); }
  let a = evalValue(m[1], ctx), b = evalValue(m[3], ctx); const op = m[2].toLowerCase();
  if (Array.isArray(a) && a.length === 1) a = a[0];
  const sa = String(a === null || a === undefined ? '' : a), sb = String(b === null || b === undefined ? '' : b);
  switch (op) {
    case 'eq': case 'ceq': return typeof a === 'number' && typeof b === 'number' ? a === b : lc(sa) === lc(sb);
    case 'ne': case 'cne': return typeof a === 'number' && typeof b === 'number' ? a !== b : lc(sa) !== lc(sb);
    case 'like': return U.globToRe(lc(sb)).test(lc(sa));
    case 'notlike': return !U.globToRe(lc(sb)).test(lc(sa));
    case 'match': try { return new RegExp(sb, 'i').test(sa); } catch (e) { return false; }
    case 'notmatch': try { return !new RegExp(sb, 'i').test(sa); } catch (e) { return false; }
    case 'gt': return +a > +b; case 'lt': return +a < +b; case 'ge': return +a >= +b; case 'le': return +a <= +b;
    case 'contains': return Array.isArray(a) && a.some(x => lc(x) === lc(b));
    case 'notcontains': return !(Array.isArray(a) && a.some(x => lc(x) === lc(b)));
    case 'in': return Array.isArray(b) && b.some(x => lc(x) === lc(a));
  }
  return false;
}

/* ------------------------------------------------------------------ format de sortie */
const TABLES = {
  service: ['Status', 'Name', 'DisplayName'],
  scope: ['ScopeId', 'SubnetMask', 'Name', 'State', 'StartRange', 'EndRange', 'LeaseDuration'],
  dnsrr: ['HostName', 'RecordType', 'Type', 'Timestamp', 'TimeToLive', 'RecordData'],
  dnszone: ['ZoneName', 'ZoneType', 'IsAutoCreated', 'IsDsIntegrated', 'IsReverseLookupZone', 'IsSigned'],
  adapter: ['Name', 'InterfaceDescription', 'ifIndex', 'Status', 'MacAddress', 'LinkSpeed'],
  dnsclient: ['InterfaceAlias', 'Interface', 'AddressFamily', 'ServerAddresses'],
  share: ['Name', 'ScopeName', 'Path', 'Description'],
  shareacc: ['Name', 'ScopeName', 'AccountName', 'AccessControlType', 'AccessRight'],
  ping: ['Source', 'Destination', 'IPV4Address', 'IPV6Address', 'Bytes', 'Time(ms)'],
  fwprofile: [],
  excl: ['ScopeId', 'StartRange', 'EndRange'],
  lease: ['IPAddress', 'ScopeId', 'ClientId', 'HostName', 'AddressState', 'LeaseExpiryTime'],
  resv: ['IPAddress', 'ScopeId', 'ClientId', 'Name', 'Description'],
  option: ['OptionId', 'Name', 'Type', 'Value'],
  dnsres: ['Name', 'Type', 'TTL', 'Section', 'IPAddress'],
  dnscache: ['Entry', 'RecordName', 'RecordType', 'Status', 'Section', 'TimeToLive', 'DataLength', 'Data'],
  process: ['Handles', 'NPM(K)', 'PM(K)', 'WS(K)', 'CPU(s)', 'Id', 'SI', 'ProcessName'],
  grp: ['SamAccountName', 'ObjectClass', 'Name'],
  adgrp: ['DistinguishedName', 'Name', 'ObjectClass', 'SamAccountName'],
  ou: ['DistinguishedName', 'Name']
};
const RIGHT = { ifIndex: 1, Id: 1, 'Bytes': 1, 'Time(ms)': 1, TTL: 1, Handles: 1, 'NPM(K)': 1, 'PM(K)': 1, 'WS(K)': 1, 'CPU(s)': 1, SI: 1 };
const LISTS = new Set(['netipconfig', 'netip', 'aduser', 'adcomputer', 'fwrule', 'fwprof', 'tnc', 'tncp', 'date', 'adgroup', 'gpo', 'dhcpopt', 'cim']);
function fmtVal(v) { if (v === null || v === undefined) return ''; if (v === true) return 'True'; if (v === false) return 'False'; if (Array.isArray(v)) return v.map(x => (x && x.Name !== undefined && typeof x === 'object' ? x.Name : String(x))).join(', '); if (v instanceof Date) return E.frDate(v) + ' ' + E.frTime(v); if (typeof v === 'object') return '{' + Object.keys(v).map(k => k + '=' + v[k]).join(', ') + '}'; return String(v); }
function formatTable(objs, cols) {
  const rows = objs.map(o => cols.map(c => fmtVal(propOf(o, c))));
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map(r => r[i].length)));
  const out = [''];
  out.push(cols.map((c, i) => (RIGHT[c] ? E.padL(c, widths[i]) : E.padR(c, widths[i]))).join(' ').replace(/\s+$/, ''));
  out.push(cols.map((c, i) => E.padR('-'.repeat(c.length), widths[i])).join(' ').replace(/\s+$/, ''));
  rows.forEach(r => out.push(r.map((v, i) => (RIGHT[cols[i]] ? E.padL(v, widths[i]) : E.padR(v, widths[i]))).join(' ').replace(/\s+$/, '')));
  out.push('');
  return out;
}
function formatList(objs, cols) {
  const out = [];
  objs.forEach(o => {
    const keys = cols || Object.keys(o).filter(k => k[0] !== '_');
    const w = Math.max(...keys.map(k => k.length));
    out.push(''); keys.forEach(k => { const v = fmtVal(propOf(o, k)); const lines = v.split('\n'); out.push(E.padR(k, w) + ' : ' + lines[0]); lines.slice(1).forEach(l => out.push(' '.repeat(w + 3) + l)); });
  });
  out.push(''); return out;
}
function propOf(o, k) { if (o == null) return undefined; if (typeof o !== 'object') return o; if (o[k] !== undefined) return o[k]; const kk = Object.keys(o).find(x => lc(x) === lc(k)); return kk ? o[kk] : undefined; }
function formatDefault(objs) {
  if (!objs.length) return [];
  if (objs.every(o => typeof o !== 'object' || o === null || o instanceof Date)) { const l = objs.map(o => (o instanceof Date ? E.frLong(o) : fmtVal(o))); return objs.every(o => o instanceof Date) ? [''].concat(l, ['']) : l; }
  const t = objs[0].__t;
  if (t === 'event') {
    const out = []; const by = {}; objs.forEach(o => { (by[o.ProviderName] = by[o.ProviderName] || []).push(o); });
    Object.keys(by).forEach(pn => { out.push(''); out.push('   ProviderName: ' + pn); out.push(''); const rows = by[pn].map(o => [E.frDateTime(new Date(o.TimeCreated)), String(o.Id), o.LevelDisplayName, String(o.Message).split('\n')[0]]); const w0 = Math.max(11, ...rows.map(r => r[0].length)), w1 = Math.max(2, ...rows.map(r => r[1].length)), w2 = Math.max(16, ...rows.map(r => r[2].length)); out.push(E.padR('TimeCreated', w0) + ' ' + E.padL('Id', w1) + ' ' + E.padR('LevelDisplayName', w2) + ' Message'); out.push('-'.repeat(11).padEnd(w0) + ' ' + '--'.padStart(w1) + ' ' + '----------------'.padEnd(w2) + ' -------'); rows.forEach(r => out.push(E.padR(r[0], w0) + ' ' + E.padL(r[1], w1) + ' ' + E.padR(r[2], w2) + ' ' + r[3])); });
    out.push(''); return out;
  }
  if (t && TABLES[t] && TABLES[t].length) return formatTable(objs, TABLES[t]);
  if (t && LISTS.has(t)) return formatList(objs);
  const keys = Object.keys(objs[0]).filter(k => k[0] !== '_');
  if (keys.length <= 4 && objs.length > 1) return formatTable(objs, keys);
  return formatList(objs);
}

/* ------------------------------------------------------------------ erreurs PowerShell */
function psError(cmd, msg, cat, fq, text) {
  return [L(cmd + ' : ' + msg, 'e'), L('Au caractère Ligne:1 : 1', 'e'), L('+ ' + text, 'e'), L('+ ' + '~'.repeat(Math.max(1, Math.min(text.length, 40))), 'e'), L('    + CategoryInfo          : ' + cat, 'e'), L('    + FullyQualifiedErrorId : ' + fq, 'e'), L('')];
}

/* ------------------------------------------------------------------ définition des cmdlets */
const CMD = {}; const ALIAS = {
  gsv: 'get-service', ls: 'get-childitem', dir: 'get-childitem', gci: 'get-childitem', cat: 'get-content', gc: 'get-content', type: 'get-content', cd: 'set-location', sl: 'set-location', pwd: 'get-location', gl: 'get-location',
  echo: 'write-output', write: 'write-output', cls: 'clear-host', clear: 'clear-host', where: 'where-object', '?': 'where-object', foreach: 'foreach-object', '%': 'foreach-object', select: 'select-object', sort: 'sort-object', ft: 'format-table', fl: 'format-list',
  sls: 'select-string', measure: 'measure-object', gcm: 'get-command', ps: 'get-process', gps: 'get-process', sasv: 'start-service', spsv: 'stop-service', gwmi: 'get-ciminstance', icm: 'invoke-command', iwr: 'invoke-webrequest', curl: 'invoke-webrequest', wget: 'invoke-webrequest',
  gdr: 'get-psdrive', ipconfig: null, ping: null, h: 'get-history', history: 'get-history', man: 'get-help', help: 'get-help', gp: 'get-itemproperty', ni: 'new-item', mkdir: 'new-item', ri: 'remove-item', rm: 'remove-item', del: 'remove-item', cp: 'copy-item', copy: 'copy-item', mv: 'move-item', move: 'move-item', rvpa: 'resolve-path', gm: 'get-member', tnc: 'test-netconnection', ogv: null
};
const GPMC = 'la console « Gestion de stratégie de groupe »', DHCPM = 'la console DHCP', DNSM = 'la console DNS', IISM = 'le « Gestionnaire des services Internet (IIS) »', ADUC = 'la console « Utilisateurs et ordinateurs Active Directory »', NETC = 'les « Connexions réseau » ou avec netsh';
const REAL_UNSUPPORTED = { 'set-gplink': GPMC, 'new-gplink': GPMC, 'remove-gplink': GPMC, 'set-gpinheritance': GPMC, 'set-gppermission': GPMC, 'get-gpo': GPMC, 'new-gpo': GPMC, 'add-dhcpserverindc': DHCPM, 'set-dnsserverresourcerecord': DNSM, 'add-dnsserverresourcerecordptr': DNSM,
  'start-webapppool': IISM, 'stop-webapppool': IISM, 'add-webconfigurationproperty': IISM, 'set-netipaddress': NETC, 'remove-netipaddress': NETC, 'new-netroute': NETC, 'remove-netroute': NETC, 'test-computersecurechannel': 'les commandes « nltest » ou « netdom »',
  'clear-adaccountexpiration': ADUC, 'set-adaccountexpiration': ADUC };
/* D-99 : applets dont l'existence sur Windows Server 2019 ET Windows 10 ne fait pas de doute (modules livrés avec PowerShell 5.1 / Windows), non émulées. Les applets liées à un rôle ou à RSAT (Get-ADDomain, Get-Website, Get-WindowsFeature, Install-WindowsFeature, Get-DhcpServerInDC, Get-WebBinding…) n'y sont PAS : leur présence dépend de la machine, laissées « à vérifier ». */
const REAL_PS_UNSUPPORTED = {}; ['get-hotfix', 'get-computerinfo', 'get-netroute', 'get-acl', 'get-volume', 'get-disk', 'get-localuser', 'get-scheduledtask', 'invoke-command', 'enter-pssession', 'get-item', 'get-itemproperty', 'get-netadapterbinding', 'get-nettcpconnection', 'get-printer', 'get-module'].forEach(c => { REAL_PS_UNSUPPORTED[c] = 1; });
E.REAL_PS_UNSUPPORTED = REAL_PS_UNSUPPORTED;
function def(name, spec, fn) { CMD[name] = { spec: spec || {}, fn }; }
function bind(spec, toks, ctx) {
  const P = {}; const pos = []; const vals = (spec.p || []).map(lc), sws = (spec.sw || []).map(lc);
  const all = vals.concat(sws);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^-[A-Za-z]/.test(t)) {
      const inl = t.match(/^-([A-Za-z]+):(.+)$/); /* forme -Param:valeur (ex. -Confirm:$false) */
      const nm = lc(inl ? inl[1] : t.slice(1).replace(/:$/, ''));
      let hit = all.filter(x => x === nm); if (!hit.length) hit = all.filter(x => x.indexOf(nm) === 0);
      if (hit.length >= 1) {
        const h = hit[0];
        if (inl) { const v = evalValue(inl[2], ctx); P[h] = sws.indexOf(h) >= 0 ? !(v === false || /^(false|0)$/i.test(String(v))) : v; continue; }
        if (sws.indexOf(h) >= 0) { const nx = toks[i + 1]; if (nx && /^\$(true|false)$/i.test(nx)) { P[h] = /true/i.test(nx); i++; } else P[h] = true; }
        else { const raw = toks[++i]; P[h] = raw === undefined ? undefined : evalValue(raw, ctx); }
        continue;
      }
      P.__unknown = t; continue;
    }
    pos.push(evalValue(t, ctx));
  }
  (spec.pos || []).forEach((nm, k) => { if (P[lc(nm)] === undefined && pos[k] !== undefined) P[lc(nm)] = pos[k]; });
  P.__pos = pos;
  return P;
}
/* Arithmétique entière/décimale de base (+ - * /) sans eval : la CSP du jeu interdit `Function`/`eval`. Retourne null si l'expression est mal formée. */
U.av('ps-divzero', 'Division par zéro en PowerShell : message « Tentative de division par zéro. » reconstitué de mémoire (la vraie sortie ajoute les lignes « Au caractère Ligne:1 : … » et CategoryInfo).');
function arith(src) {
  const t = String(src).replace(/\s+/g, '').match(/\d+(?:\.\d+)?|[-+*\/]/g); if (!t || t.join('') !== String(src).replace(/\s+/g, '')) return null;
  let i = 0;
  const num = () => { let neg = false; while (t[i] === '-' || t[i] === '+') { if (t[i] === '-') neg = !neg; i++; } if (i >= t.length || !/^\d/.test(t[i])) throw new Error('syntaxe'); const v = parseFloat(t[i++]); return neg ? -v : v; };
  const term = () => { let v = num(); while (t[i] === '*' || t[i] === '/') { const op = t[i++]; const r = num(); v = op === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (t[i] === '+' || t[i] === '-') { const op = t[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
  try { const v = expr(); return i === t.length ? v : null; } catch (e) { return null; }
}
function listOf(v) { if (v === undefined || v === null) return []; return Array.isArray(v) ? v : [v]; }
const wild = (pat, v) => U.globToRe(lc(pat)).test(lc(v));

/* le contexte ctx porte : s (shell), W, d, vars, cur, input, text */
const hasRole = (d, role) => role === 'ad' ? !!(d.win && d.win.ad) : role === 'dhcp' ? !!(d.win && d.win.dhcp) : role === 'dns' ? !!(d.win && d.win.dns) : true;
const needRole = (ctx, role, cmdName, text) => { if (hasRole(ctx.d, role) || (role === 'ad' && ctx.d.id === 'PC-ADM')) return null; return psError(ctx.name, 'Le terme «' + ctx.name + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable. Vérifiez l’orthographe du nom, ou si un chemin d’accès existe, vérifiez que le chemin d’accès est correct et réessayez.', 'ObjectNotFound: (' + ctx.name + ':String) [], CommandNotFoundException', 'CommandNotFoundException', text); };
const adDev = (ctx) => { const d = ctx.d; if (d.win.ad) return { dev: d }; const dc = AD.locateDC(ctx.W, d.id, d.win.domain); return dc.ok ? { dev: dc.dev } : null; };
const adErrServer = (ctx) => psError(ctx.name, 'Impossible de trouver un contrôleur de domaine Active Directory Web Services (ADWS) qui exécute le service.', 'ResourceUnavailable: (:) [' + ctx.name + '], ADServerDownException', 'ActiveDirectoryServer:1355,Microsoft.ActiveDirectory.Management.Commands.' + ctx.name.replace('-', '') + 'Command', ctx.text);

/* --- services --- */
function svcObj(d, k) { const s = d.win.svc[k]; return { __t: 'service', Status: s.state === 'running' ? 'Running' : 'Stopped', Name: k, DisplayName: WIN.SVC_DISPLAY[k] || k, StartType: ({ auto: 'Automatic', 'auto-delayed': 'Automatic', manual: 'Manual', disabled: 'Disabled' })[s.start], CanStop: s.state === 'running' }; }
def('get-service', { p: ['name', 'displayname', 'computername'], pos: ['name'], sw: [] }, (ctx, P) => {
  let d = ctx.d; if (P.computername && lc(P.computername) !== lc(d.name) && P.computername !== '.') { const t = W_.svcTarget(ctx.s, '\\\\' + P.computername); if (t.err) return { err: psError(ctx.name, 'Impossible d’ouvrir le gestionnaire de contrôle des services sur l’ordinateur « ' + P.computername + ' ». Ce problème peut se produire car l’ordinateur n’existe pas ou est inaccessible.', 'NotSpecified: (:) [Get-Service], InvalidOperationException', 'System.InvalidOperationException,Microsoft.PowerShell.Commands.GetServiceCommand', ctx.text) }; d = t.dev; }
  let names = listOf(P.name || P.displayname); const keys = Object.keys(d.win.svc);
  if (!names.length) return { objs: keys.map(k => svcObj(d, k)) };
  const out = []; for (const n of names) { const hit = keys.filter(k => wild(n, k) || wild(n, WIN.SVC_DISPLAY[k] || k)); if (!hit.length && !/[*?]/.test(n)) return { err: psError(ctx.name, 'Impossible de trouver un service dont le nom de service est « ' + n + ' ».', 'ObjectNotFound: (' + n + ':String) [Get-Service], ServiceCommandException', 'NoServiceFoundForGivenName,Microsoft.PowerShell.Commands.GetServiceCommand', ctx.text) }; hit.forEach(k => out.push(svcObj(d, k))); }
  return { objs: out };
});
function svcAction(act) {
  return (ctx, P) => {
    const d = ctx.d; const names = listOf(P.name || P.inputobject).concat(ctx.input.map(o => (o && o.Name) || o)).filter(Boolean);
    if (!names.length) return { err: psError(ctx.name, 'Impossible de lier le paramètre «Name» : l’argument est null ou vide.', 'InvalidData: (:) [' + ctx.name + '], ParameterBindingException', 'ParameterArgumentValidationError', ctx.text) };
    const res = { objs: [], mutated: false }; const errs = [];
    for (const n of names) {
      const nm = typeof n === 'object' ? n.Name : n; const k = W_.svcFind(d, nm);
      if (!k) { errs.push(...psError(ctx.name, 'Impossible de trouver un service dont le nom de service est « ' + nm + ' ».', 'ObjectNotFound: (' + nm + ':String) [' + ctx.name + '], ServiceCommandException', 'NoServiceFoundForGivenName,Microsoft.PowerShell.Commands.' + ctx.name.replace('-', '') + 'Command', ctx.text)); continue; }
      const sv = d.win.svc[k]; const disp = (WIN.SVC_DISPLAY[k] || k) + ' (' + k + ')';
      if (!ctx.s.elevated) { errs.push(...psError(ctx.name, 'Impossible d’ouvrir le service ' + disp + ' sur l’ordinateur « . ».', 'PermissionDenied: (System.ServiceProcess.ServiceController:ServiceController) [' + ctx.name + '], ServiceCommandException', 'CouldNotStartService,Microsoft.PowerShell.Commands.' + ctx.name.replace('-', '') + 'Command', ctx.text)); continue; }
      if (act === 'start' || act === 'restart') {
        if (act === 'restart' && sv.state === 'running') WIN.setSvc(ctx.W, d.id, k, 'stopped');
        if (sv.state !== 'running') {
          if (sv.start === 'disabled') { errs.push(...psError(ctx.name, 'Impossible de démarrer le service ' + disp + ' sur l’ordinateur « . ».', 'OpenError: (System.ServiceProcess.ServiceController:ServiceController) [' + ctx.name + '], ServiceCommandException', 'CouldNotStartService,Microsoft.PowerShell.Commands.' + ctx.name.replace('-', '') + 'Command', ctx.text)); continue; }
          WIN.setSvc(ctx.W, d.id, k, 'running'); ctx.s.env.advance(2);
        }
      } else if (act === 'stop') { if (sv.state === 'running') { WIN.setSvc(ctx.W, d.id, k, 'stopped'); ctx.s.env.advance(2); res.impact = 'svc-stop'; } }
      res.mutated = true; if (P.passthru) res.objs.push(svcObj(d, k));
    }
    if (res.mutated) ctx.s.env.touch('svc');
    res.errLines = errs; return res;
  };
}
def('start-service', { p: ['name', 'displayname', 'inputobject'], pos: ['name'], sw: ['passthru', 'force'] }, svcAction('start'));
def('stop-service', { p: ['name', 'displayname', 'inputobject'], pos: ['name'], sw: ['passthru', 'force'] }, svcAction('stop'));
def('restart-service', { p: ['name', 'displayname', 'inputobject'], pos: ['name'], sw: ['passthru', 'force'] }, svcAction('restart'));
def('set-service', { p: ['name', 'startuptype', 'status', 'displayname'], pos: ['name'], sw: ['passthru'] }, (ctx, P) => {
  const d = ctx.d; const k = W_.svcFind(d, P.name || ''); if (!k) return { err: psError(ctx.name, 'Le service « ' + P.name + ' » est introuvable sur l’ordinateur « . ».', 'ObjectNotFound: (' + P.name + ':String) [Set-Service], ServiceCommandException', 'NoServiceFoundForGivenName,Microsoft.PowerShell.Commands.SetServiceCommand', ctx.text) };
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Impossible d’ouvrir le service ' + k + ' sur l’ordinateur « . ».', 'PermissionDenied: (:) [Set-Service], ServiceCommandException', 'CouldNotSetService,Microsoft.PowerShell.Commands.SetServiceCommand', ctx.text) };
  const map = { automatic: 'auto', automaticdelayedstart: 'auto-delayed', manual: 'manual', disabled: 'disabled' };
  if (P.startuptype) { const v = map[lc(P.startuptype)]; if (!v) return { err: psError(ctx.name, 'Impossible de lier le paramètre « StartupType ». Impossible de convertir la valeur « ' + P.startuptype + ' ».', 'InvalidArgument: (:) [Set-Service], ParameterBindingException', 'CannotConvertArgumentNoMessage', ctx.text) }; d.win.svc[k].start = v; }
  if (P.status) { WIN.setSvc(ctx.W, d.id, k, /run|start/i.test(P.status) ? 'running' : 'stopped'); }
  ctx.s.env.touch('svc'); return { objs: [], mutated: true };
});
/* --- réseau --- */
def('get-netipconfiguration', { p: ['interfacealias'], pos: ['interfacealias'], sw: ['detailed', 'all'] }, (ctx, P) => {
  const d = ctx.d; const out = [];
  W_.ifaceNames(d).forEach((n, i) => { const c = N.effCfg(d, n); const up = N.linkUp(ctx.W, d, n); if (P.interfacealias && lc(P.interfacealias) !== lc(n)) return; out.push({ __t: 'netipconfig', InterfaceAlias: n, InterfaceIndex: 6 + i, InterfaceDescription: W_.nicDesc, 'NetProfile.Name': (d.win.domain ? d.win.domain : 'Réseau non identifié'), IPv4Address: up && c && c.ip !== '0.0.0.0' ? c.ip : '', IPv6DefaultGateway: '', IPv4DefaultGateway: up && c ? c.gw : '', DNSServer: up && c ? c.dns : [] }); });
  return { objs: out };
});
def('get-netipaddress', { p: ['interfacealias', 'addressfamily', 'ipaddress'], sw: [] }, (ctx, P) => {
  const d = ctx.d; const out = [];
  W_.ifaceNames(d).forEach((n, i) => { const c = N.effCfg(d, n); if (c && c.ip && c.ip !== '0.0.0.0' && N.linkUp(ctx.W, d, n)) out.push({ __t: 'netip', IPAddress: c.ip, InterfaceIndex: 6 + i, InterfaceAlias: n, AddressFamily: 'IPv4', Type: 'Unicast', PrefixLength: U.mask2len(c.mask), PrefixOrigin: c.mode === 'dhcp' ? 'Dhcp' : 'Manual', SuffixOrigin: c.mode === 'dhcp' ? 'Dhcp' : 'Manual', AddressState: 'Preferred' }); });
  return { objs: out.filter(o => !P.interfacealias || lc(o.InterfaceAlias) === lc(P.interfacealias)) };
});
def('get-netadapter', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => ({ objs: W_.ifaceNames(ctx.d).map((n, i) => ({ __t: 'adapter', Name: n, InterfaceDescription: W_.nicDesc, ifIndex: 6 + i, Status: ctx.d.ifaces[n].adminDown ? 'Disabled' : N.linkUp(ctx.W, ctx.d, n) ? 'Up' : 'Disconnected', MacAddress: E.macDash(ctx.d.ifaces[n].mac), LinkSpeed: N.linkUp(ctx.W, ctx.d, n) ? '1 Gbps' : '0 bps' })).filter(o => !P.name || wild(P.name, o.Name)) }));
def('get-dnsclientserveraddress', { p: ['interfacealias', 'addressfamily'], sw: [] }, (ctx, P) => ({ objs: W_.ifaceNames(ctx.d).map((n, i) => { const c = N.effCfg(ctx.d, n); return { __t: 'dnsclient', InterfaceAlias: n, Interface: 6 + i, AddressFamily: 'IPv4', ServerAddresses: c ? c.dns : [] }; }).filter(o => !P.interfacealias || lc(o.InterfaceAlias) === lc(P.interfacealias)) }));
def('set-dnsclientserveraddress', { p: ['interfacealias', 'serveraddresses'], sw: ['resetserveraddresses', 'passthru'] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (MSFT_DNSClientServerAddress:root/StandardCimv2/MSFT_DNSClientServerAddress) [Set-DnsClientServerAddress], CimException', 'Windows System Error 5,Set-DnsClientServerAddress', ctx.text) };
  const nm = W_.ifaceNames(ctx.d).find(n => lc(n) === lc(P.interfacealias || '')); if (!nm) return { err: psError(ctx.name, 'Aucune carte réseau ne correspond au nom « ' + P.interfacealias + ' ».', 'ObjectNotFound: (:) [Set-DnsClientServerAddress], CimJobException', 'CmdletizationQuery_NotFound_InterfaceAlias', ctx.text) };
  const ic = ctx.d.ifaces[nm];
  if (P.resetserveraddresses) { ic.dnsManual = []; if (!ic.dhcp) ic.dns = []; } else if (ic.dhcp) ic.dnsManual = listOf(P.serveraddresses).map(String); else ic.dns = listOf(P.serveraddresses).map(String);
  ctx.s.env.touch('ipv4'); return { objs: [], mutated: true };
});
def('new-netipaddress', { p: ['interfacealias', 'ipaddress', 'prefixlength', 'defaultgateway', 'addressfamily'], sw: [] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [New-NetIPAddress], CimException', 'Windows System Error 5,New-NetIPAddress', ctx.text) };
  const nm = W_.ifaceNames(ctx.d).find(n => lc(n) === lc(P.interfacealias || '')); if (!nm) return { err: psError(ctx.name, 'Aucune carte réseau ne correspond au nom « ' + P.interfacealias + ' ».', 'ObjectNotFound: (:) [New-NetIPAddress], CimJobException', 'CmdletizationQuery_NotFound_InterfaceAlias', ctx.text) };
  const ic = ctx.d.ifaces[nm]; ic.dhcp = false; ic.ip = String(P.ipaddress); ic.mask = U.len2mask(+P.prefixlength || 24); ic.gw = P.defaultgateway ? String(P.defaultgateway) : ''; ctx.s.env.touch('ipv4'); return { objs: [], mutated: true };
});
def('set-netipinterface', { p: ['interfacealias', 'dhcp'], sw: [] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-NetIPInterface], CimException', 'Windows System Error 5,Set-NetIPInterface', ctx.text) };
  const nm = W_.ifaceNames(ctx.d).find(n => lc(n) === lc(P.interfacealias || '')); if (!nm) return { err: psError(ctx.name, 'Aucune carte réseau ne correspond au nom « ' + P.interfacealias + ' ».', 'ObjectNotFound: (:) [Set-NetIPInterface], CimJobException', 'CmdletizationQuery_NotFound_InterfaceAlias', ctx.text) };
  const on = /enabled/i.test(P.dhcp); ctx.d.ifaces[nm].dhcp = on; if (on) N.dhcpRenew(ctx.W, ctx.d.id, nm); ctx.s.env.touch('ipv4'); return { objs: [], mutated: true };
});
def('clear-dnsclientcache', {}, ctx => { ctx.d._rt.dnsCache = {}; ctx.s.env.touch('flushdns'); return { objs: [], mutated: true }; });
def('get-dnsclientcache', {}, ctx => { const c = ctx.d._rt.dnsCache || {}; return { objs: Object.keys(c).map(k => ({ __t: 'dnscache', Entry: k, RecordName: k, RecordType: 1, Status: 0, Section: 1, TimeToLive: Math.max(1, 300 - Math.round(ctx.W.clock.elapsed - c[k].t)), DataLength: 4, Data: c[k].ip })) }; });
def('register-dnsclient', {}, ctx => ({ objs: [] }));
def('test-netconnection', { p: ['computername', 'port', 'informationlevel', 'commonTCPPort'.toLowerCase()], pos: ['computername', 'port'], sw: [] }, (ctx, P) => {
  const d = ctx.d, W = ctx.W; const target = P.computername || 'internetbeacon.msedge.net'; const port = P.port !== undefined ? +P.port : (P.commontcpport ? ({ smb: 445, http: 80, rdp: 3389, winrm: 5985 })[lc(P.commontcpport)] : null);
  const quiet = lc(P.informationlevel || '') === 'quiet';
  let ip = target; const warn = [];
  if (!U.isIP(target)) { const r = N.resolve(W, d.id, target); ctx.s.env.advance(r.ok ? 0 : 3); if (!r.ok) { warn.push('AVERTISSEMENT : Name resolution of ' + target + ' failed'); return { objs: quiet ? [false] : [{ __t: 'tnc', ComputerName: target, RemoteAddress: '', NameResolutionResults: '', PingSucceeded: false }], warn, ok: false }; } ip = r.ip; }
  const l3 = N.l3up(W, d); const rt = N.route(W, d, ip); const ifc = rt ? l3.find(x => x.name === rt.iface) : l3[0];
  if (port) {
    const c = N.connect(W, d.id, ip, 'tcp', port); const okc = c.state === 'open'; ctx.s.env.advance(okc ? 0 : 21);
    if (!okc) warn.push('AVERTISSEMENT : TCP connect to (' + ip + ' : ' + port + ') failed');
    if (!okc) { const pg = N.ping(W, d.id, ip); if (!pg.ok) warn.push('AVERTISSEMENT : Ping to ' + ip + ' failed with status: ' + (pg.kind === 'timeout' ? 'TimedOut' : 'DestinationHostUnreachable')); }
    ctx.s.env.obs('connect:' + d.id + ':' + ip + ':' + port, okc);
    if (quiet) return { objs: [okc], warn };
    const o = { __t: 'tnc', ComputerName: target, RemoteAddress: ip, RemotePort: port, InterfaceAlias: ifc ? ifc.name : '', SourceAddress: ifc ? ifc.ip : '', TcpTestSucceeded: okc };
    return { objs: [o], warn };
  }
  const pg = N.ping(W, d.id, ip); ctx.s.env.obs('ping:' + d.id + ':' + target, pg.ok); ctx.s.env.advance(pg.ok ? 1 : 4);
  if (!pg.ok) warn.push('AVERTISSEMENT : Ping to ' + ip + ' failed with status: ' + (pg.kind === 'timeout' ? 'TimedOut' : 'DestinationHostUnreachable'));
  if (quiet) return { objs: [pg.ok], warn };
  const o = { __t: 'tnc', ComputerName: target, RemoteAddress: ip, InterfaceAlias: ifc ? ifc.name : '', SourceAddress: ifc ? ifc.ip : '', PingSucceeded: pg.ok }; if (pg.ok) o['PingReplyDetails (RTT)'] = E.rttMs(pg.trace, 0) + ' ms';
  return { objs: [o], warn };
});
def('test-connection', { p: ['computername', 'count'], pos: ['computername'], sw: ['quiet'] }, (ctx, P) => {
  const d = ctx.d, W = ctx.W; const tg = P.computername; let ip = tg; if (!U.isIP(tg)) { const r = N.resolve(W, d.id, tg); if (!r.ok) return { err: psError(ctx.name, 'Test-Connection : Impossible de tester la connexion à l’ordinateur « ' + tg + ' » en raison de l’erreur suivante : Aucune ressource de ce type n’est connue.', 'ResourceUnavailable: (' + tg + ':String) [Test-Connection], PingException', 'TestConnectionException,Microsoft.PowerShell.Commands.TestConnectionCommand', ctx.text) }; ip = r.ip; }
  const n = +(P.count || 4); const out = []; let ok = false;
  for (let i = 0; i < n; i++) { const pg = N.ping(W, d.id, ip); ctx.s.env.advance(1); ctx.s.env.obs('ping:' + d.id + ':' + tg, pg.ok); if (pg.ok) { ok = true; out.push({ __t: 'ping', Source: d.name.toUpperCase(), Destination: tg, IPV4Address: ip, IPV6Address: '', Bytes: 32, 'Time(ms)': E.rttMs(pg.trace, i) }); } else out.push({ __t: 'err' }); }
  const good = out.filter(o => o.__t === 'ping'); if (P.quiet) return { objs: [ok] };
  const errs = out.length - good.length ? psError(ctx.name, 'Test-Connection : Échec de la commande de test (Délai d’attente dépassé) pour l’ordinateur « ' + tg + ' »...', 'ResourceUnavailable: (' + ip + ':String) [Test-Connection], PingException', 'TestConnectionException,Microsoft.PowerShell.Commands.TestConnectionCommand', ctx.text) : [];
  return { objs: good, errLines: errs };
});
def('resolve-dnsname', { p: ['name', 'type', 'server', 'dnsonly'], pos: ['name'], sw: ['dnsonly', 'nohostsfile'] }, (ctx, P) => {
  const d = ctx.d, W = ctx.W; const name = String(P.name || ''); const type = (P.type || (U.isIP(name) ? 'PTR' : 'A')).toUpperCase();
  const servers = P.server ? [P.server] : N.dnsServersOf(W, d);
  if (!servers.length) return { err: psError(ctx.name, name + ' : Aucun serveur DNS n’est configuré', 'ResourceUnavailable: (' + name + ':String) [Resolve-DnsName], Win32Exception', 'DNS_ERROR_RCODE_SERVER_FAILURE,Microsoft.DnsClient.Commands.ResolveDnsName', ctx.text) };
  let qn = name.replace(/\.$/, ''); if (U.isIP(qn)) qn = qn.split('.').reverse().join('.') + '.in-addr.arpa';
  const cands = qn.indexOf('.') < 0 ? N.searchList(W, d).map(sf => qn + '.' + sf).concat([qn]) : [qn];
  let lastErr = null;
  for (const c of cands) {
    for (const sv of servers) {
      const r = N.dnsQuery(W, d.id, sv, c, type);
      if (r.state !== 'ok') { lastErr = 'timeout'; ctx.s.env.advance(2); continue; }
      if (r.rcode === 'NOERROR' && r.answers && r.answers.length) { ctx.s.env.obs('resolve:' + d.id + ':' + name, true); return { objs: r.answers.map(a => ({ __t: 'dnsres', Name: a.name || c, Type: a.type, TTL: a.ttl || 3600, Section: 'Answer', IPAddress: a.type === 'A' ? a.data : undefined, NameHost: a.type === 'PTR' || a.type === 'NS' ? a.data : undefined, NameAdministrator: undefined, Data: a.data })) }; }
      lastErr = r.rcode; if (r.rcode === 'NXDOMAIN') break; if (r.rcode === 'REFUSED' || r.rcode === 'SERVFAIL') continue; break;
    }
  }
  ctx.s.env.obs('resolve:' + d.id + ':' + name, false);
  const msg = lastErr === 'NXDOMAIN' ? 'Ce nom n’existe pas.' : lastErr === 'timeout' ? 'Le délai d’attente de l’opération a expiré.' : lastErr === 'REFUSED' ? 'Opération refusée par le serveur DNS.' : lastErr === 'SERVFAIL' ? 'Échec du serveur DNS.' : 'Aucun enregistrement de ce type n’existe.';
  return { err: psError(ctx.name, name + ' : ' + msg, 'ResourceUnavailable: (' + name + ':String) [Resolve-DnsName], Win32Exception', (lastErr === 'NXDOMAIN' ? 'DNS_ERROR_RCODE_NAME_ERROR' : lastErr === 'timeout' ? 'ERROR_TIMEOUT' : 'DNS_ERROR_RCODE_SERVER_FAILURE') + ',Microsoft.DnsClient.Commands.ResolveDnsName', ctx.text) };
});
def('invoke-webrequest', { p: ['uri', 'method'], pos: ['uri'], sw: ['usebasicparsing', 'skipcertificatecheck'] }, (ctx, P) => {
  const url = String(P.uri || ''); const r = WEB.fetch(ctx.W, ctx.d.id, url, { ignoreTls: !!P.skipcertificatecheck }); ctx.s.env.advance(r.err === 'timeout' ? 21 : 1); ctx.s.env.obs('http:' + ctx.d.id + ':' + url, !!r.ok);
  if (r.err) { const msg = r.err === 'dns' ? 'Le nom distant n’a pas pu être résolu : \'' + (WEB.parseUrl(url) || {}).host + '\'' : r.err === 'refused' ? 'Impossible de se connecter au serveur distant' : r.err === 'timeout' ? 'Délai d’attente de l’opération dépassé.' : r.err === 'tls' ? 'La connexion sous-jacente a été fermée : Impossible d’établir une relation d’approbation pour le canal sécurisé SSL/TLS.' : 'Échec de la requête.'; return { err: psError(ctx.name, msg, 'InvalidOperation: (System.Net.HttpWebRequest:HttpWebRequest) [Invoke-WebRequest], WebException', 'WebCmdletWebResponseException,Microsoft.PowerShell.Commands.InvokeWebRequestCommand', ctx.text) }; }
  if (!r.ok) return { err: psError(ctx.name, 'Le serveur distant a retourné une erreur : (' + r.status + ') ' + (r.error ? r.error.title : '') + '.', 'InvalidOperation: (System.Net.HttpWebRequest:HttpWebRequest) [Invoke-WebRequest], WebException', 'WebCmdletWebResponseException,Microsoft.PowerShell.Commands.InvokeWebRequestCommand', ctx.text) };
  return { objs: [{ __t: 'web', StatusCode: r.status, StatusDescription: 'OK', Content: r.page ? r.page.html : '', RawContentLength: (r.page ? r.page.html : '').length }] };
});
/* --- pare-feu --- */
const ruleObj = (r) => ({ __t: 'fwrule', Name: r.id, DisplayName: r.name, Group: r.group || '', Enabled: r.enabled ? 'True' : 'False', Profile: r.profiles.map(p => ({ domain: 'Domain', private: 'Private', public: 'Public' })[p]).join(', '), Direction: r.dir === 'in' ? 'Inbound' : 'Outbound', Action: r.action === 'allow' ? 'Allow' : 'Block', Protocol: r.proto, LocalPort: r.lport });
def('get-netfirewallrule', { p: ['displayname', 'name', 'enabled', 'direction', 'displaygroup'], pos: ['name'], sw: [] }, (ctx, P) => {
  let rs = ctx.d.win.fw.rules.map(ruleObj);
  if (P.displayname) rs = rs.filter(r => wild(P.displayname, r.DisplayName)); if (P.name) rs = rs.filter(r => wild(P.name, r.Name)); if (P.enabled !== undefined) rs = rs.filter(r => lc(r.Enabled) === lc(String(P.enabled))); if (P.direction) rs = rs.filter(r => lc(r.Direction) === lc(P.direction)); if (P.displaygroup) rs = rs.filter(r => wild(P.displaygroup, r.Group));
  if (!rs.length && (P.displayname || P.name)) return { err: psError(ctx.name, 'Aucune règle de pare-feu ne correspond aux critères spécifiés.', 'ObjectNotFound: (:) [Get-NetFirewallRule], CimJobException', 'CmdletizationQuery_NotFound_Name,Get-NetFirewallRule', ctx.text) };
  return { objs: rs };
});
function fwToggle(on) { return (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [' + ctx.name + '], CimException', 'Windows System Error 5,' + ctx.name, ctx.text) };
  let rs = ctx.d.win.fw.rules; const input = ctx.input.map(o => o && o.Name).filter(Boolean);
  if (P.displayname) rs = rs.filter(r => wild(P.displayname, r.name)); else if (P.name) rs = rs.filter(r => wild(P.name, r.id)); else if (input.length) rs = rs.filter(r => input.indexOf(r.id) >= 0); else rs = [];
  if (!rs.length) return { err: psError(ctx.name, 'Aucune règle de pare-feu ne correspond aux critères spécifiés.', 'ObjectNotFound: (:) [' + ctx.name + '], CimJobException', 'CmdletizationQuery_NotFound_DisplayName,' + ctx.name, ctx.text) };
  rs.forEach(r => { r.enabled = on; }); ctx.s.env.touch('fw'); return { objs: [], mutated: true };
}; }
def('enable-netfirewallrule', { p: ['displayname', 'name', 'displaygroup'], pos: ['name'], sw: [] }, fwToggle(true));
def('disable-netfirewallrule', { p: ['displayname', 'name', 'displaygroup'], pos: ['name'], sw: [] }, fwToggle(false));
def('get-netfirewallprofile', { p: ['name'], pos: ['name'], sw: [] }, ctx => ({ objs: ['domain', 'private', 'public'].map(p => ({ __t: 'fwprof', Name: p[0].toUpperCase() + p.slice(1), Enabled: ctx.d.win.fw.profiles[p].enabled ? 'True' : 'False', DefaultInboundAction: ctx.d.win.fw.profiles[p].defIn === 'block' ? 'Block' : 'Allow', DefaultOutboundAction: ctx.d.win.fw.profiles[p].defOut === 'allow' ? 'Allow' : 'Block' })).filter(o => !ctx.P || true) }));
def('set-netfirewallprofile', { p: ['name', 'enabled', 'profile'], pos: ['name'], sw: [] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-NetFirewallProfile], CimException', 'Windows System Error 5,Set-NetFirewallProfile', ctx.text) };
  const names = listOf(P.name || P.profile).length ? listOf(P.name || P.profile).map(lc) : ctx.input.map(o => lc(o.Name)); const on = lc(String(P.enabled)) === 'true';
  (names.indexOf('all') >= 0 ? ['domain', 'private', 'public'] : names).forEach(p => { if (ctx.d.win.fw.profiles[p]) ctx.d.win.fw.profiles[p].enabled = on; }); ctx.s.env.touch('fw'); return { objs: [], mutated: true };
});
def('new-netfirewallrule', { p: ['displayname', 'direction', 'protocol', 'localport', 'action', 'profile', 'enabled'], sw: [] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [New-NetFirewallRule], CimException', 'Windows System Error 5,New-NetFirewallRule', ctx.text) };
  const rules = ctx.d.win.fw.rules; rules.push({ id: '{' + U.hash8(P.displayname + rules.length) + '}', name: String(P.displayname), enabled: true, dir: lc(P.direction || 'inbound') === 'outbound' ? 'out' : 'in', action: lc(P.action || 'allow') === 'block' ? 'block' : 'allow', profiles: ['domain', 'private', 'public'], proto: String(P.protocol || 'Any').toUpperCase(), lport: P.localport !== undefined ? String(P.localport) : '' });
  ctx.s.env.touch('fw'); return { objs: [], mutated: true };
});
/* --- journaux --- */
function evObj(d, chan, e) { return { __t: 'event', ProviderName: e.source || '', TimeCreated: e.t, Id: SIM.codes.ev(e.source || '', e.id, 'journal'), __rid: e.id, LevelDisplayName: e.level || 'Information', Message: e.msg, LogName: chan, MachineName: W_.fqdn(d) }; }
const CHAN = { system: 'Système', application: 'Application', security: 'Sécurité', 'dhcp-server': 'DHCP-Server', 'dns-server': 'DNS-Server', 'microsoft-windows-dhcp-server/operational': 'DHCP-Server', 'microsoft-windows-dhcp-server/admin': 'DHCP-Server', 'dns server': 'DNS-Server', 'microsoft-windows-grouppolicy/operational': 'GroupPolicy', grouppolicy: 'GroupPolicy' };
def('get-winevent', { p: ['logname', 'maxevents', 'filterhashtable', 'computername'], pos: ['logname'], sw: ['oldest'] }, (ctx, P) => {
  const h = P.filterhashtable || {}; const ln = P.logname || h.LogName || h.logname; const keys = ln ? [ln] : ['System'];
  const allowed = ['Système', 'Application', 'Sécurité', 'DHCP-Server', 'DNS-Server', 'GroupPolicy'];
  let d = ctx.d; if (P.computername && lc(P.computername) !== lc(d.name)) { const t = W_.svcTarget(ctx.s, '\\\\' + P.computername); if (t.err) return { err: psError(ctx.name, 'Impossible de se connecter à l’ordinateur « ' + P.computername + ' » : le serveur RPC n’est pas disponible.', 'NotSpecified: (:) [Get-WinEvent], EventLogException', 'System.Diagnostics.Eventing.Reader.EventLogException,Microsoft.PowerShell.Commands.GetWinEventCommand', ctx.text) }; d = t.dev; }
  let out = [];
  for (const k of keys) {
    const chan = CHAN[lc(k)] || (allowed.indexOf(k) >= 0 ? k : null);
    if (!chan) return { err: psError(ctx.name, 'Aucun journal d’événements n’a été trouvé pour « ' + k + ' ».', 'ObjectNotFound: (' + k + ':String) [Get-WinEvent], Exception', 'NoMatchingLogsFound,Microsoft.PowerShell.Commands.GetWinEventCommand', ctx.text) };
    if (chan === 'Sécurité' && !ctx.s.elevated) return { err: psError(ctx.name, 'Tentative d’accès au journal « Security » non autorisée.', 'NotSpecified: (:) [Get-WinEvent], UnauthorizedAccessException', 'System.UnauthorizedAccessException,Microsoft.PowerShell.Commands.GetWinEventCommand', ctx.text) };
    ctx.W.logs(d.id, 'evt:' + chan).forEach(e => out.push(evObj(d, chan, e)));
  }
  if (h.Id !== undefined) { const ids = listOf(h.Id).map(Number); out = out.filter(e => ids.indexOf(e.__rid) >= 0); }
  if (h.ProviderName) out = out.filter(e => wild(h.ProviderName, e.ProviderName));
  if (h.Level !== undefined) { const lv = { 1: 'Critique', 2: 'Erreur', 3: 'Avertissement', 4: 'Information' }; const want = listOf(h.Level).map(x => lv[x]); out = out.filter(e => want.indexOf(e.LevelDisplayName) >= 0); }
  out.sort((a, b) => b.TimeCreated - a.TimeCreated); if (P.oldest) out.reverse();
  if (P.maxevents) out = out.slice(0, +P.maxevents);
  if (!out.length) return { err: psError(ctx.name, 'Aucun événement correspondant aux critères de sélection spécifiés n’a été trouvé.', 'ObjectNotFound: (:) [Get-WinEvent], Exception', 'NoMatchingEventsFound,Microsoft.PowerShell.Commands.GetWinEventCommand', ctx.text) };
  return { objs: out };
});
def('get-eventlog', { p: ['logname', 'newest', 'entrytype', 'source', 'instanceid'], pos: ['logname'], sw: [] }, (ctx, P) => {
  const chan = CHAN[lc(P.logname || '')]; if (!chan) return { err: psError(ctx.name, 'Impossible de trouver un journal d’événements avec le nom « ' + P.logname + ' ».', 'ObjectNotFound: (:) [Get-EventLog], InvalidOperationException', 'System.InvalidOperationException,Microsoft.PowerShell.Commands.GetEventLogCommand', ctx.text) };
  let out = ctx.W.logs(ctx.d.id, 'evt:' + chan).map(e => ({ __t: 'evlog', Index: 0, Time: e.t, EntryType: ({ Erreur: 'Error', Avertissement: 'Warning', Information: 'Information' })[e.level] || 'Information', Source: e.source, InstanceID: SIM.codes.ev(e.source || '', e.id, 'journal'), __rid: e.id, Message: e.msg }));
  if (P.entrytype) out = out.filter(e => lc(e.EntryType) === lc(P.entrytype)); if (P.source) out = out.filter(e => wild(P.source, e.Source)); if (P.instanceid !== undefined) out = out.filter(e => e.__rid === +P.instanceid);
  out.sort((a, b) => b.Time - a.Time); if (P.newest) out = out.slice(0, +P.newest); out.forEach((e, i) => { e.Index = 1000 - i; });
  return { objs: out, table: ['Index', 'Time', 'EntryType', 'Source', 'InstanceID', 'Message'], fmt: { Time: v => E.EN_MONTHS[new Date(v).getUTCMonth()] + ' ' + String(new Date(v).getUTCDate()).padStart(2, '0') + ' ' + E.frTime(new Date(v)).slice(0, 5) } };
});
/* --- Active Directory --- */
function adUserObj(A, u, props) {
  const o = { __t: 'aduser', DistinguishedName: 'CN=' + u.name + ',' + u.ou, Enabled: u.enabled !== false, GivenName: u.name.split(' ')[0], Name: u.name, ObjectClass: 'user', ObjectGUID: [U.hash8(u.sam), U.hash8(u.sam + 'a').slice(0, 4), U.hash8(u.sam + 'b').slice(0, 4), U.hash8(u.sam + 'c').slice(0, 4), U.hash8(u.sam + 'd') + U.hash8(u.sam + 'e').slice(0, 4)].join('-'), SamAccountName: u.sam, SID: 'S-1-5-21-' + [0, 1, 2].map(k => parseInt(U.hash8(A.domain + k), 16) % 2000000000 + 1000000000).join('-') + '-' + (1100 + parseInt(U.hash8(u.sam).slice(0, 3), 16) % 6000), Surname: u.name.split(' ').slice(1).join(' '), UserPrincipalName: u.sam + '@' + A.domain };
  return o;
}
function adExtra(ctx, A, u, o, props) {
  const W = ctx.W; const all = props.indexOf('*') >= 0; const has = k => all || props.map(lc).indexOf(lc(k)) >= 0; const pol = AD.passwordPolicy(W, A);
  const age = AD.pwdAgeDays(W, u); const exp = !u.pwdNeverExpires && pol.maxPwdAgeDays > 0 && age > pol.maxPwdAgeDays;
  if (has('LockedOut')) o.LockedOut = !!u.locked; if (has('PasswordExpired')) o.PasswordExpired = !!(exp || u.mustChange); if (has('PasswordNeverExpires')) o.PasswordNeverExpires = !!u.pwdNeverExpires; if (has('PasswordLastSet')) o.PasswordLastSet = new Date(W.clock.base - age * 86400000);
  if (has('AccountExpirationDate')) o.AccountExpirationDate = u.expires ? new Date(Date.parse(u.expires)) : null; if (has('MemberOf')) { const tok = AD.token(W, A.domain, u.sam); o.MemberOf = A.groups.filter(g2 => tok.has(lc(A.netbios) + '\\' + lc(g2.name)) && g2.members.some(m => lc(m) === lc(u.sam))).map(g2 => 'CN=' + g2.name + ',' + g2.ou); }
  if (has('LogonWorkstations')) o.LogonWorkstations = (u.allowedWorkstations || []).join(','); if (has('Description')) o.Description = ''; if (has('LastLogonDate')) o.LastLogonDate = new Date(W.clock.base - 3600000); if (has('mail')) o.mail = u.sam + '@' + A.domain; if (has('LogonHours')) o.LogonHours = u.logonHours ? 'restreint' : null;
}
def('get-aduser', { p: ['identity', 'filter', 'properties', 'searchbase', 'server'], pos: ['identity'], sw: [] }, (ctx, P) => {
  const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad;
  const props = listOf(P.properties).map(String); let users = A.users;
  if (P.identity) { const id = typeof P.identity === 'object' ? P.identity.SamAccountName : P.identity; users = users.filter(u => lc(u.sam) === lc(id) || lc(u.name) === lc(id) || lc(u.sam + '@' + A.domain) === lc(id)); if (!users.length) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + id + ' » sous : « ' + A.ous[0].dn.replace(/^.*?(DC=.*)$/, '$1') + ' ».', 'ObjectNotFound: (' + id + ':ADUser) [Get-ADUser], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.GetADUser', ctx.text) }; }
  else if (P.filter && P.filter !== '*') { const f = String(P.filter); const m = f.match(/(\w+)\s*-(eq|like)\s*['"]?([^'"]+)['"]?/i); if (m) users = users.filter(u => { const val = m[1].toLowerCase() === 'samaccountname' ? u.sam : m[1].toLowerCase() === 'name' ? u.name : m[1].toLowerCase() === 'enabled' ? (u.enabled !== false) : m[1].toLowerCase() === 'lockedout' ? !!u.locked : ''; return m[2].toLowerCase() === 'like' ? wild(m[3], val) : lc(val) === lc(m[3]); }); }
  else if (!P.filter) return { err: psError(ctx.name, 'Impossible de lier le paramètre « Filter » ou « Identity ».', 'InvalidArgument: (:) [Get-ADUser], ParameterBindingException', 'MissingParameter', ctx.text) };
  return { objs: users.map(u => { const o = adUserObj(A, u, props); adExtra(ctx, A, u, o, props); return o; }) };
});
function adAct(fn, needAdmin) { return (ctx, P) => {
  const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad;
  const tok = W_.token(ctx.W, ctx.d); if (!ctx.d.win.ad && !(tok.has && tok.has(lc(A.netbios) + '\\admins du domaine'))) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (' + (P.identity || '') + ':ADUser) [' + ctx.name + '], UnauthorizedAccessException', 'ActiveDirectoryServer:5,Microsoft.ActiveDirectory.Management.Commands.' + ctx.name.replace('-', ''), ctx.text) };
  const idv = P.identity !== undefined ? P.identity : ctx.input[0]; const id = typeof idv === 'object' && idv ? idv.SamAccountName || idv.Name : idv;
  const u = AD.userOf(A, id); if (!u) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + id + ' ».', 'ObjectNotFound: (' + id + ':ADUser) [' + ctx.name + '], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.' + ctx.name.replace('-', ''), ctx.text) };
  const r = fn(ctx, P, A, u); ctx.s.env.touch('aduser'); return Object.assign({ objs: [], mutated: true }, r || {});
}; }
def('unlock-adaccount', { p: ['identity', 'server'], pos: ['identity'], sw: [] }, adAct((ctx, P, A, u) => { u.locked = false; u._bad = 0; }));
def('enable-adaccount', { p: ['identity', 'server'], pos: ['identity'], sw: [] }, adAct((ctx, P, A, u) => { u.enabled = true; }));
def('disable-adaccount', { p: ['identity', 'server'], pos: ['identity'], sw: [] }, adAct((ctx, P, A, u) => { u.enabled = false; }));
def('set-adaccountpassword', { p: ['identity', 'newpassword', 'oldpassword', 'server'], pos: ['identity'], sw: ['reset'] }, adAct((ctx, P, A, u) => {
  const m = ctx.text.match(/-NewPassword\s+\(ConvertTo-SecureString\s+(?:-String\s+)?(?:"([^"]*)"|'([^']*)')/i); const pw = m ? (m[1] !== undefined ? m[1] : m[2]) : (typeof P.newpassword === 'string' ? P.newpassword : null);
  if (!pw) return { objs: [], mutated: false };
  const pol = AD.passwordPolicy(ctx.W, A); const cx = /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d|[^A-Za-z0-9]/.test(pw);
  if (pw.length < pol.minPwdLen || (pol.complexity && !cx)) return { err: psError(ctx.name, 'Le mot de passe ne répond pas aux exigences de la stratégie de mot de passe. Vérifiez la longueur minimale du mot de passe, sa complexité et les exigences d’historique des mots de passe.', 'InvalidData: (' + u.sam + ':ADAccount) [Set-ADAccountPassword], ADPasswordComplexityException', 'ActiveDirectoryServer:1325,Microsoft.ActiveDirectory.Management.Commands.SetADAccountPassword', ctx.text), mutated: false };
  AD.setPassword(ctx.W, ctx.d.win.domain || A.domain, u.sam, pw, false);
}));
def('set-aduser', { p: ['identity', 'accountexpirationdate', 'clear', 'changepasswordatlogon', 'passwordneverexpires', 'logonworkstations', 'server'], pos: ['identity'], sw: [] }, adAct((ctx, P, A, u) => {
  if (P.clear && lc(String(P.clear)).indexOf('accountexpirationdate') >= 0) u.expires = null; if (P.accountexpirationdate === null && /-AccountExpirationDate\s+\$null/i.test(ctx.text)) u.expires = null;
  if (P.changepasswordatlogon !== undefined) u.mustChange = !!P.changepasswordatlogon; if (P.passwordneverexpires !== undefined) u.pwdNeverExpires = !!P.passwordneverexpires; if (P.logonworkstations !== undefined) u.allowedWorkstations = String(P.logonworkstations || '').split(',').filter(Boolean);
}));
def('add-adgroupmember', { p: ['identity', 'members', 'server'], pos: ['identity', 'members'], sw: [] }, (ctx, P) => {
  const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad;
  const tok = W_.token(ctx.W, ctx.d); if (!ctx.d.win.ad && !(tok.has && tok.has(lc(A.netbios) + '\\admins du domaine'))) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Add-ADGroupMember], UnauthorizedAccessException', 'ActiveDirectoryServer:5,Microsoft.ActiveDirectory.Management.Commands.AddADGroupMember', ctx.text) };
  const grp = A.groups.find(x => lc(x.name) === lc(typeof P.identity === 'object' ? P.identity.Name : P.identity)); if (!grp) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + P.identity + ' ».', 'ObjectNotFound: (' + P.identity + ':ADGroup) [Add-ADGroupMember], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.AddADGroupMember', ctx.text) };
  for (const m of listOf(P.members)) { const nm = typeof m === 'object' ? m.SamAccountName || m.Name : m; if (!AD.userOf(A, nm) && !A.groups.find(x => lc(x.name) === lc(nm))) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + nm + ' ».', 'ObjectNotFound: (' + nm + ':ADPrincipal) [Add-ADGroupMember], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.AddADGroupMember', ctx.text) }; if (grp.members.map(lc).indexOf(lc(nm)) < 0) grp.members.push(nm); }
  ctx.s.env.touch('member'); return { objs: [], mutated: true };
});
def('get-adgroupmember', { p: ['identity', 'recursive', 'server'], pos: ['identity'], sw: ['recursive'] }, (ctx, P) => {
  const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad;
  const grp = A.groups.find(x => lc(x.name) === lc(typeof P.identity === 'object' ? P.identity.Name : P.identity)); if (!grp) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + P.identity + ' ».', 'ObjectNotFound: (' + P.identity + ':ADGroup) [Get-ADGroupMember], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.GetADGroupMember', ctx.text) };
  return { objs: grp.members.map(m => { const u = AD.userOf(A, m); const g2 = A.groups.find(x => lc(x.name) === lc(m)); return { __t: 'adgrp', DistinguishedName: u ? 'CN=' + u.name + ',' + u.ou : g2 ? 'CN=' + g2.name + ',' + g2.ou : m, Name: u ? u.name : m, ObjectClass: u ? 'user' : g2 ? 'group' : '', SamAccountName: u ? u.sam : m }; }) };
});
def('get-adgroup', { p: ['identity', 'filter'], pos: ['identity'], sw: [] }, (ctx, P) => { const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad; let gs = A.groups; if (P.identity) gs = gs.filter(x => lc(x.name) === lc(P.identity)); return { objs: gs.map(x => ({ __t: 'adgroup', DistinguishedName: 'CN=' + x.name + ',' + x.ou, GroupCategory: 'Security', GroupScope: x.scope === 'DomainLocal' ? 'DomainLocal' : 'Global', Name: x.name, ObjectClass: 'group', SamAccountName: x.name })) }; });
def('get-adcomputer', { p: ['identity', 'filter', 'properties'], pos: ['identity'], sw: [] }, (ctx, P) => {
  const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad; let cs = A.computers;
  if (P.identity) { const id = typeof P.identity === 'object' ? P.identity.Name : P.identity; cs = cs.filter(c => lc(c.name) === lc(id) || lc(c.name + '$') === lc(id)); if (!cs.length) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + id + ' ».', 'ObjectNotFound: (' + id + ':ADComputer) [Get-ADComputer], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.GetADComputer', ctx.text) }; }
  return { objs: cs.map(c => ({ __t: 'adcomputer', DistinguishedName: 'CN=' + c.name + ',' + c.ou, DNSHostName: c.name.toLowerCase() + '.' + A.domain, Enabled: c.enabled !== false, Name: c.name, ObjectClass: 'computer', SamAccountName: c.name + '$' })) };
});
def('move-adobject', { p: ['identity', 'targetpath'], pos: ['identity'], sw: [] }, (ctx, P) => {
  const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const A = dd.dev.win.ad;
  const id = typeof P.identity === 'object' ? P.identity.DistinguishedName : String(P.identity); const nm = (id.match(/^CN=([^,]+),/i) || [])[1]; const tgt = String(P.targetpath || '');
  if (!A.ous.some(o => lc(o.dn) === lc(tgt)) && lc(tgt) !== lc('CN=Users,' + A.ous[0].dn.replace(/^.*?(DC=.*)$/, '$1'))) return { err: psError(ctx.name, 'Le chemin de destination est introuvable : « ' + tgt + ' ».', 'ObjectNotFound: (' + tgt + ':String) [Move-ADObject], ADIdentityNotFoundException', 'ActiveDirectoryServer:8240,Microsoft.ActiveDirectory.Management.Commands.MoveADObject', ctx.text) };
  const c = AD.compOf(A, nm); const u = A.users.find(x => lc(x.name) === lc(nm)); const o = c || u; if (!o) return { err: psError(ctx.name, 'Impossible de trouver un objet avec l’identité : « ' + id + ' ».', 'ObjectNotFound: (' + id + ':ADObject) [Move-ADObject], ADIdentityNotFoundException', 'ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.MoveADObject', ctx.text) };
  o.ou = tgt; ctx.s.env.touch('adou'); return { objs: [], mutated: true };
});
def('get-adorganizationalunit', { p: ['filter', 'identity'], sw: [] }, (ctx, P) => { const rs = needRole(ctx, 'ad'); if (rs) return { err: rs }; const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; return { objs: dd.dev.win.ad.ous.map(o => ({ __t: 'ou', DistinguishedName: o.dn, Name: o.dn.split(',')[0].replace(/^OU=/, '') })) }; });
def('get-addomaincontroller', { p: ['filter', 'discover'], sw: ['discover'] }, ctx => { const dd = adDev(ctx); if (!dd) return { err: adErrServer(ctx) }; const dc = dd.dev; return { objs: [{ __t: 'adcomputer', Name: dc.name, HostName: W_.fqdn(dc), IPv4Address: N.l3up(ctx.W, dc)[0].ip, Domain: dc.win.ad.domain, Forest: dc.win.ad.domain, Site: 'Default-First-Site-Name', IsGlobalCatalog: true }] }; });
/* --- DHCP --- */
const durFmt = sec => { const d = Math.floor(sec / 86400); const h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return d + '.' + U.pad2(h) + ':' + U.pad2(m) + ':' + U.pad2(s); };
const scopeObj = sc => ({ __t: 'scope', ScopeId: sc.id, SubnetMask: sc.mask, Name: sc.name, State: sc.active === false ? 'InActive' : 'Active', StartRange: sc.start, EndRange: sc.end, LeaseDuration: durFmt(sc.leaseSec || 691200) });
const dhcpSrv = (ctx) => { if (!ctx.d.win.dhcp) return { err: psError(ctx.name, 'Le terme «' + ctx.name + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable. Vérifiez l’orthographe du nom, ou si un chemin d’accès existe, vérifiez que le chemin d’accès est correct et réessayez.', 'ObjectNotFound: (' + ctx.name + ':String) [], CommandNotFoundException', 'CommandNotFoundException', ctx.text) }; return null; };
def('get-dhcpserverv4scope', { p: ['scopeid', 'computername'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; if (!WIN.svcRunning(ctx.d, 'DHCPServer')) return { err: psError(ctx.name, 'Impossible de se connecter au serveur DHCP sur le port RPC (le service DHCP Server n’est pas démarré).', 'NotSpecified: (:) [Get-DhcpServerv4Scope], CimException', 'WIN32 1722,Get-DhcpServerv4Scope', ctx.text) }; let sc = ctx.d.win.dhcp.scopes; if (P.scopeid) sc = sc.filter(x => x.id === String(P.scopeid)); if (P.scopeid && !sc.length) return { err: psError(ctx.name, 'Le portée DHCP spécifiée est introuvable.', 'ObjectNotFound: (:) [Get-DhcpServerv4Scope], CimException', 'DHCP 20010,Get-DhcpServerv4Scope', ctx.text) }; return { objs: sc.map(scopeObj) }; });
def('set-dhcpserverv4scope', { p: ['scopeid', 'state', 'name', 'startrange', 'endrange'], pos: ['scopeid'], sw: [] }, (ctx, P) => {
  const e = dhcpSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-DhcpServerv4Scope], CimException', 'WIN32 5,Set-DhcpServerv4Scope', ctx.text) };
  const sc = ctx.d.win.dhcp.scopes.find(x => x.id === String(P.scopeid)); if (!sc) return { err: psError(ctx.name, 'Le portée DHCP spécifiée est introuvable.', 'ObjectNotFound: (:) [Set-DhcpServerv4Scope], CimException', 'DHCP 20010,Set-DhcpServerv4Scope', ctx.text) };
  if (P.state) sc.active = /^active$/i.test(P.state); if (P.name) sc.name = String(P.name); if (P.startrange) sc.start = String(P.startrange); if (P.endrange) sc.end = String(P.endrange); ctx.s.env.touch('dhcp'); return { objs: [], mutated: true };
});
def('get-dhcpserverv4exclusionrange', { p: ['scopeid'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; const out = []; ctx.d.win.dhcp.scopes.filter(x => !P.scopeid || x.id === String(P.scopeid)).forEach(sc => (sc.exclusions || []).forEach(x => out.push({ __t: 'excl', ScopeId: sc.id, StartRange: x.start, EndRange: x.end }))); return { objs: out }; });
def('remove-dhcpserverv4exclusionrange', { p: ['scopeid', 'startrange', 'endrange'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [' + ctx.name + '], CimException', 'WIN32 5,' + ctx.name, ctx.text) }; const sc = ctx.d.win.dhcp.scopes.find(x => x.id === String(P.scopeid)); if (!sc) return { err: psError(ctx.name, 'Le portée DHCP spécifiée est introuvable.', 'ObjectNotFound: (:) [' + ctx.name + '], CimException', 'DHCP 20010,' + ctx.name, ctx.text) }; const n0 = (sc.exclusions || []).length; sc.exclusions = (sc.exclusions || []).filter(x => !(x.start === String(P.startrange) && x.end === String(P.endrange))); if (sc.exclusions.length === n0) return { err: psError(ctx.name, 'La plage d’exclusion spécifiée est introuvable.', 'ObjectNotFound: (:) [' + ctx.name + '], CimException', 'DHCP 20011,' + ctx.name, ctx.text) }; ctx.s.env.touch('dhcp'); return { objs: [], mutated: true }; });
def('add-dhcpserverv4exclusionrange', { p: ['scopeid', 'startrange', 'endrange'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [' + ctx.name + '], CimException', 'WIN32 5,' + ctx.name, ctx.text) }; const sc = ctx.d.win.dhcp.scopes.find(x => x.id === String(P.scopeid)); if (!sc) return { err: psError(ctx.name, 'Le portée DHCP spécifiée est introuvable.', 'ObjectNotFound: (:) [' + ctx.name + '], CimException', 'DHCP 20010,' + ctx.name, ctx.text) }; sc.exclusions = sc.exclusions || []; sc.exclusions.push({ start: String(P.startrange), end: String(P.endrange) }); ctx.s.env.touch('dhcp'); return { objs: [], mutated: true }; });
def('get-dhcpserverv4optionvalue', { p: ['scopeid', 'optionid'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; const NAMES = { 3: 'Router', 6: 'DNS Servers', 15: 'DNS Domain Name', 51: 'Lease' }; const sc = P.scopeid ? ctx.d.win.dhcp.scopes.find(x => x.id === String(P.scopeid)) : null; const src = sc ? sc.options : ctx.d.win.dhcp.serverOptions; return { objs: Object.keys(src || {}).filter(k => !P.optionid || +k === +P.optionid).map(k => ({ __t: 'option', OptionId: +k, Name: NAMES[k] || 'Option ' + k, Type: 'IPv4Address', Value: String(src[k]).split(',').map(x => x.trim()) })) }; });
def('set-dhcpserverv4optionvalue', { p: ['scopeid', 'router', 'dnsserver', 'dnsdomain', 'optionid', 'value'], pos: [], sw: [] }, (ctx, P) => {
  const e = dhcpSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-DhcpServerv4OptionValue], CimException', 'WIN32 5,Set-DhcpServerv4OptionValue', ctx.text) };
  const tgt = P.scopeid ? ctx.d.win.dhcp.scopes.find(x => x.id === String(P.scopeid)) : null; if (P.scopeid && !tgt) return { err: psError(ctx.name, 'Le portée DHCP spécifiée est introuvable.', 'ObjectNotFound: (:) [Set-DhcpServerv4OptionValue], CimException', 'DHCP 20010,Set-DhcpServerv4OptionValue', ctx.text) };
  const opts = tgt ? tgt.options : ctx.d.win.dhcp.serverOptions; if (P.router !== undefined) opts[3] = listOf(P.router).join(','); if (P.dnsserver !== undefined) opts[6] = listOf(P.dnsserver).join(','); if (P.dnsdomain !== undefined) opts[15] = String(P.dnsdomain);
  if (P.optionid !== undefined) opts[+P.optionid] = listOf(P.value).join(','); ctx.s.env.touch('dhcp'); return { objs: [], mutated: true };
});
def('get-dhcpserverv4lease', { p: ['scopeid'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; const out = []; ctx.d.win.dhcp.scopes.filter(x => !P.scopeid || x.id === String(P.scopeid)).forEach(sc => { const ls = sc._leases || {}; Object.keys(ls).forEach(ip => out.push({ __t: 'lease', IPAddress: ip, ScopeId: sc.id, ClientId: ls[ip].mac || '', HostName: ls[ip].host || '', AddressState: 'Active', LeaseExpiryTime: new Date(ctx.W.clock.base + ((ls[ip].t || 0) + (sc.leaseSec || 691200)) * 1000) })); }); return { objs: out }; });
def('get-dhcpserverv4reservation', { p: ['scopeid'], pos: ['scopeid'], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; const out = []; ctx.d.win.dhcp.scopes.filter(x => !P.scopeid || x.id === String(P.scopeid)).forEach(sc => (sc.reservations || []).forEach(r => out.push({ __t: 'resv', IPAddress: r.ip, ScopeId: sc.id, ClientId: E.macDash(r.mac).toLowerCase(), Name: r.name, Description: r.desc || '' }))); return { objs: out }; });
def('set-dhcpserverv4reservation', { p: ['ipaddress', 'clientid', 'name', 'description', 'scopeid'], pos: [], sw: [] }, (ctx, P) => { const e = dhcpSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-DhcpServerv4Reservation], CimException', 'WIN32 5,Set-DhcpServerv4Reservation', ctx.text) }; let hit = null; ctx.d.win.dhcp.scopes.forEach(sc => (sc.reservations || []).forEach(r => { if (r.ip === String(P.ipaddress)) hit = r; })); if (!hit) return { err: psError(ctx.name, 'La réservation spécifiée est introuvable.', 'ObjectNotFound: (:) [Set-DhcpServerv4Reservation], CimException', 'DHCP 20013,Set-DhcpServerv4Reservation', ctx.text) }; if (P.clientid) hit.mac = String(P.clientid).toUpperCase().replace(/[:]/g, '-'); if (P.name) hit.name = String(P.name); ctx.s.env.touch('dhcp'); return { objs: [], mutated: true }; });
/* --- DNS serveur --- */
const dnsSrv = (ctx) => { if (!ctx.d.win.dns) return { err: psError(ctx.name, 'Le terme «' + ctx.name + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable. Vérifiez l’orthographe du nom, ou si un chemin d’accès existe, vérifiez que le chemin d’accès est correct et réessayez.', 'ObjectNotFound: (' + ctx.name + ':String) [], CommandNotFoundException', 'CommandNotFoundException', ctx.text) }; if (!WIN.svcRunning(ctx.d, 'DNS')) return { err: psError(ctx.name, 'Impossible de se connecter au serveur DNS : le serveur RPC n’est pas disponible.', 'ConnectionError: (:) [' + ctx.name + '], CimException', 'WIN32 1722,' + ctx.name, ctx.text) }; return null; };
def('get-dnsserverzone', { p: ['name', 'computername'], pos: ['name'], sw: [] }, (ctx, P) => { const e = dnsSrv(ctx); if (e) return e; let z = ctx.d.win.dns.zones; if (P.name) z = z.filter(x => lc(x.name) === lc(P.name)); if (P.name && !z.length) return { err: psError(ctx.name, 'La zone ' + P.name + ' est introuvable sur le serveur ' + ctx.d.name + '.', 'ObjectNotFound: (' + P.name + ':root/Microsoft/...) [Get-DnsServerZone], CimException', 'WIN32 9601,Get-DnsServerZone', ctx.text) }; return { objs: z.map(x => ({ __t: 'dnszone', ZoneName: x.name, ZoneType: 'Primary', IsAutoCreated: false, IsDsIntegrated: !!x.adIntegrated, IsReverseLookupZone: !!x.reverse || /in-addr\.arpa$/.test(x.name), IsSigned: false })) }; });
def('get-dnsserverresourcerecord', { p: ['zonename', 'name', 'rrtype', 'computername'], pos: [], sw: [] }, (ctx, P) => { const e = dnsSrv(ctx); if (e) return e; const z = ctx.d.win.dns.zones.find(x => lc(x.name) === lc(P.zonename || '')); if (!z) return { err: psError(ctx.name, 'La zone ' + P.zonename + ' est introuvable sur le serveur ' + ctx.d.name + '.', 'ObjectNotFound: (' + P.zonename + ':root/Microsoft/...) [Get-DnsServerResourceRecord], CimException', 'WIN32 9601,Get-DnsServerResourceRecord', ctx.text) }; let rs = z.records; if (P.name) rs = rs.filter(r => lc(r.name) === lc(P.name)); if (P.rrtype) rs = rs.filter(r => r.type === String(P.rrtype).toUpperCase()); if (P.name && !rs.length) return { err: psError(ctx.name, 'Impossible de trouver l’enregistrement ' + P.name + ' dans la zone ' + z.name + '.', 'ObjectNotFound: (' + P.name + ':root/Microsoft/...) [Get-DnsServerResourceRecord], CimException', 'WIN32 9714,Get-DnsServerResourceRecord', ctx.text) }; return { objs: rs.map(r => ({ __t: 'dnsrr', HostName: r.name, RecordType: r.type, Type: ({ A: 1, NS: 2, CNAME: 5, PTR: 12, SRV: 33, MX: 15, TXT: 16 })[r.type] || 0, Timestamp: 0, TimeToLive: '01:00:00', RecordData: r.data })) }; });
def('add-dnsserverresourcerecorda', { p: ['zonename', 'name', 'ipv4address', 'computername'], pos: [], sw: [] }, (ctx, P) => { const e = dnsSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Add-DnsServerResourceRecordA], CimException', 'WIN32 5,Add-DnsServerResourceRecordA', ctx.text) }; const z = ctx.d.win.dns.zones.find(x => lc(x.name) === lc(P.zonename || '')); if (!z) return { err: psError(ctx.name, 'La zone ' + P.zonename + ' est introuvable sur le serveur ' + ctx.d.name + '.', 'ObjectNotFound: (:) [Add-DnsServerResourceRecordA], CimException', 'WIN32 9601,Add-DnsServerResourceRecordA', ctx.text) }; z.records.push({ id: P.name + '|A', name: String(P.name), type: 'A', data: String(P.ipv4address) }); ctx.s.env.touch('dns'); return { objs: [], mutated: true }; });
def('remove-dnsserverresourcerecord', { p: ['zonename', 'name', 'rrtype', 'recorddata'], pos: [], sw: ['force'] }, (ctx, P) => { const e = dnsSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Remove-DnsServerResourceRecord], CimException', 'WIN32 5,Remove-DnsServerResourceRecord', ctx.text) }; const z = ctx.d.win.dns.zones.find(x => lc(x.name) === lc(P.zonename || '')); if (!z) return { err: psError(ctx.name, 'La zone est introuvable.', 'ObjectNotFound: (:) [Remove-DnsServerResourceRecord], CimException', 'WIN32 9601,Remove-DnsServerResourceRecord', ctx.text) }; const n0 = z.records.length; z.records = z.records.filter(r => !(lc(r.name) === lc(P.name) && (!P.rrtype || r.type === String(P.rrtype).toUpperCase()) && (!P.recorddata || r.data === String(P.recorddata)))); if (z.records.length === n0) return { err: psError(ctx.name, 'Impossible de trouver l’enregistrement.', 'ObjectNotFound: (:) [Remove-DnsServerResourceRecord], CimException', 'WIN32 9714,Remove-DnsServerResourceRecord', ctx.text) }; ctx.s.env.touch('dns'); return { objs: [], mutated: true }; });
def('get-dnsserverforwarder', {}, ctx => { const e = dnsSrv(ctx); if (e) return e; return { objs: [{ __t: 'dnsfwd', UseRootHint: true, Timeout: 3, EnableReordering: true, IPAddress: ctx.d.win.dns.forwarders.slice() }] }; });
def('set-dnsserverforwarder', { p: ['ipaddress'], pos: ['ipaddress'], sw: ['passthru'] }, (ctx, P) => { const e = dnsSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-DnsServerForwarder], CimException', 'WIN32 5,Set-DnsServerForwarder', ctx.text) }; ctx.d.win.dns.forwarders = listOf(P.ipaddress).map(String); ctx.s.env.touch('dns'); return { objs: [], mutated: true }; });
def('clear-dnsservercache', { p: [], sw: ['force'] }, ctx => { const e = dnsSrv(ctx); if (e) return e; return { objs: [] }; });
/* --- partages / fichiers --- */
def('get-smbshare', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => { const sh = ctx.d.win.shares || []; const all = [{ __t: 'share', Name: 'ADMIN$', ScopeName: '*', Path: 'C:\\Windows', Description: 'Administration à distance' }, { __t: 'share', Name: 'C$', ScopeName: '*', Path: 'C:\\', Description: 'Partage par défaut' }, { __t: 'share', Name: 'IPC$', ScopeName: '*', Path: '', Description: 'IPC distant' }].concat(sh.map(x => ({ __t: 'share', Name: x.name, ScopeName: '*', Path: x.path, Description: x.comment || '' }))); if (P.name === undefined) return { objs: all }; const sel = listOf(P.name).map(String); const objs = all.filter(o => sel.some(n => wild(n, o.Name))); if (!objs.length) return { err: smbNotFound(ctx, sel[0]) }; return { objs }; });
def('get-smbshareaccess', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => { const sh = (ctx.d.win.shares || []).find(x => lc(x.name) === lc(P.name || '')); if (!sh) return { err: psError(ctx.name, 'Aucun partage SMB ne correspond au nom « ' + P.name + ' ».', 'ObjectNotFound: (' + P.name + ':String) [Get-SmbShareAccess], CimException', 'CmdletizationQuery_NotFound_Name,Get-SmbShareAccess', ctx.text) }; return { objs: (sh.perms || []).map(p => ({ __t: 'shareacc', Name: sh.name, ScopeName: '*', AccountName: p.who, AccessControlType: p.type === 'deny' ? 'Deny' : 'Allow', AccessRight: ({ Modify: 'Change', FullControl: 'Full', Read: 'Read', ReadAndExecute: 'Read' })[p.access] || p.access })) }; });
U.av('ps-smb-write', 'New-SmbShare / Remove-SmbShare / Grant-SmbShareAccess / Revoke-SmbShareAccess : paramètres, objets retournés et messages d’erreur reconstitués de mémoire (l’invite de confirmation de Remove-/Revoke- sans -Force est émulée : voir ps-confirm).');
const smbDenied = (ctx) => psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [' + ctx.name + '], CimException', 'Windows System Error 5,' + ctx.name, ctx.text);
const smbNotFound = (ctx, n) => psError(ctx.name, 'Aucun partage SMB ne correspond au nom « ' + n + ' ».', 'ObjectNotFound: (' + n + ':String) [' + ctx.name + '], CimException', 'CmdletizationQuery_NotFound_Name,' + ctx.name, ctx.text);
const smbRow = x => ({ __t: 'share', Name: x.name, ScopeName: '*', Path: x.path, Description: x.comment || '' });
def('new-smbshare', { p: ['name', 'path', 'description', 'fullaccess', 'changeaccess', 'readaccess', 'noaccess', 'folderenumerationmode'], pos: [], sw: [] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: smbDenied(ctx) };
  if (!P.name || !P.path) return { err: psError(ctx.name, 'Impossible de lier le paramètre : les paramètres Name et Path sont obligatoires.', 'InvalidArgument: (:) [' + ctx.name + '], ParameterBindingException', 'MissingMandatoryParameter,' + ctx.name, ctx.text) };
  const perms = []; const add = (list, access, type) => listOf(list).forEach(a => { const r = { who: W_.shareWho(a), access }; if (type) r.type = type; perms.push(r); });
  add(P.fullaccess, 'FullControl'); add(P.changeaccess, 'Modify'); add(P.readaccess, 'Read'); add(P.noaccess, 'FullControl', 'deny');
  const res = W_.shareCreate(ctx.s, String(P.name), String(P.path), { remark: P.description ? String(P.description) : '', perms });
  if (!res.ok) return { err: psError(ctx.name, res.code === 2118 ? 'Le nom est déjà partagé.' : 'Le chemin d’accès spécifié est introuvable.', 'InvalidArgument: (MSFT_SmbShare:ROOT/Microsoft/Windows/SMB/MSFT_SmbShare) [New-SmbShare], CimException', 'Windows System Error ' + res.code + ',New-SmbShare', ctx.text) };
  return { objs: [smbRow(res.share)], mutated: true };
});
def('remove-smbshare', { p: ['name'], pos: ['name'], sw: ['force'] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: smbDenied(ctx) };
  if (!W_.shareRemove(ctx.s, String(P.name || ''))) return { err: smbNotFound(ctx, P.name) };
  return { objs: [], mutated: true };
});
def('grant-smbshareaccess', { p: ['name', 'accountname', 'accessright', 'accesscontroltype'], pos: [], sw: ['force'] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: smbDenied(ctx) };
  const sh = (ctx.d.win.shares || []).find(x => lc(x.name) === lc(P.name || '')); if (!sh) return { err: smbNotFound(ctx, P.name) };
  const right = W_.shareRight(P.accessright || ''); if (!right) return { err: psError(ctx.name, 'Impossible de lier le paramètre « AccessRight ». Impossible de convertir la valeur « ' + (P.accessright || '') + ' » en type « Microsoft.PowerShell.Cmdletization.GeneratedTypes.SmbShare.ShareAccessRight ». Les valeurs autorisées sont : Full, Change, Read, Custom.', 'InvalidArgument: (:) [' + ctx.name + '], ParameterBindingException', 'CannotConvertArgumentNoMessage,' + ctx.name, ctx.text) };
  sh.perms = sh.perms || [];
  listOf(P.accountname).forEach(a => { const who = W_.shareWho(a); const ex = sh.perms.find(x => lc(x.who) === lc(who) && (x.type === 'deny') === (lc(P.accesscontroltype || 'allow') === 'deny')); if (ex) ex.access = right; else { const n = { who, access: right }; if (lc(P.accesscontroltype || '') === 'deny') n.type = 'deny'; sh.perms.push(n); } });
  ctx.s.env.touch('acl');
  return { objs: sh.perms.map(p => ({ __t: 'shareacc', Name: sh.name, ScopeName: '*', AccountName: p.who, AccessControlType: p.type === 'deny' ? 'Deny' : 'Allow', AccessRight: ({ Modify: 'Change', FullControl: 'Full', Read: 'Read' })[p.access] || p.access })), mutated: true };
});
def('revoke-smbshareaccess', { p: ['name', 'accountname'], pos: [], sw: ['force'] }, (ctx, P) => {
  if (!ctx.s.elevated) return { err: smbDenied(ctx) };
  const sh = (ctx.d.win.shares || []).find(x => lc(x.name) === lc(P.name || '')); if (!sh) return { err: smbNotFound(ctx, P.name) };
  const who = listOf(P.accountname).map(a => lc(W_.shareWho(a))); sh.perms = (sh.perms || []).filter(p => who.indexOf(lc(p.who)) < 0); ctx.s.env.touch('acl');
  return { objs: sh.perms.map(p => ({ __t: 'shareacc', Name: sh.name, ScopeName: '*', AccountName: p.who, AccessControlType: p.type === 'deny' ? 'Deny' : 'Allow', AccessRight: ({ Modify: 'Change', FullControl: 'Full', Read: 'Read' })[p.access] || p.access })), mutated: true };
});
/* --- IIS (modules WebAdministration / IISAdministration) --- */
U.av('ps-iis', 'Get-Website / Start-Website / Stop-Website / Get-WebBinding / Set-WebBinding / Get-IISSite / Start-IISSite / Stop-IISSite : colonnes (Name, ID, State, Physical Path, Bindings ; protocol, bindingInformation, sslFlags), PhysicalPath en %SystemDrive%, libellé « Started/Stopped » et messages d’erreur reconstitués de mémoire ; les liaisons multiples d’un site sont réduites à la première ligne.');
const iisSrv = (ctx) => { if (!ctx.d.win.iis) return { err: psError(ctx.name, 'Le terme «' + ctx.name + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable. Vérifiez l’orthographe du nom, ou si un chemin d’accès existe, vérifiez que le chemin d’accès est correct et réessayez.', 'ObjectNotFound: (' + ctx.name + ':String) [], CommandNotFoundException', 'CommandNotFoundException', ctx.text) }; return null; };
const iisFind = (ctx, n) => (ctx.d.win.iis.sites || []).find(x => lc(x.name) === lc(n || ''));
const iisBind = b => b.proto + ' ' + b.ip + ':' + b.port + ':' + (b.host || '');
const iisRow = (x, stateKey) => { const o = { Name: x.name, ID: x.id }; o[stateKey] = x.state === 'started' ? 'Started' : 'Stopped'; o.PhysicalPath = x.path.replace(/^C:\\inetpub/i, '%SystemDrive%\\inetpub'); o.Bindings = x.bindings.map(iisBind).join('\n'); Object.defineProperty(o, 'Physical Path', { value: o.PhysicalPath, enumerable: false }); return o; };
const iisNotFound = (ctx, n) => psError(ctx.name, 'Le site web « ' + n + ' » est introuvable.', 'ObjectNotFound: (' + n + ':String) [' + ctx.name + '], ItemNotFoundException', 'SiteNotFound,' + ctx.name, ctx.text);
const iisSites = (ctx, P, stateKey) => { const e = iisSrv(ctx); if (e) return e; let l = ctx.d.win.iis.sites || []; if (P.name) { const x = iisFind(ctx, P.name); if (!x) return { err: iisNotFound(ctx, P.name) }; l = [x]; } return { objs: l.map(x => iisRow(x, stateKey)), table: ['Name', 'ID', stateKey, 'Physical Path', 'Bindings'] }; };
const iisSetState = (ctx, P, state) => { const e = iisSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [' + ctx.name + '], UnauthorizedAccessException', 'UnauthorizedAccess,' + ctx.name, ctx.text) }; const x = iisFind(ctx, P.name); if (!x) return { err: iisNotFound(ctx, P.name) }; x.state = state; ctx.s.env.touch('iis'); return { objs: [], mutated: true }; };
def('get-website', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => iisSites(ctx, P, 'State'));
def('get-iissite', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => iisSites(ctx, P, 'Status'));
def('start-website', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => iisSetState(ctx, P, 'started'));
def('stop-website', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => iisSetState(ctx, P, 'stopped'));
def('start-iissite', { p: ['name'], pos: ['name'], sw: ['passthru'] }, (ctx, P) => iisSetState(ctx, P, 'started'));
def('stop-iissite', { p: ['name'], pos: ['name'], sw: ['confirm', 'passthru'] }, (ctx, P) => iisSetState(ctx, P, 'stopped'));
def('get-webbinding', { p: ['name', 'port', 'ip', 'hostheader', 'protocol'], pos: [], sw: [] }, (ctx, P) => {
  const e = iisSrv(ctx); if (e) return e; let sites = ctx.d.win.iis.sites || [];
  if (P.name) { const x = iisFind(ctx, P.name); if (!x) return { err: iisNotFound(ctx, P.name) }; sites = [x]; }
  const rows = []; sites.forEach(x => x.bindings.forEach(b => { if (P.port && +P.port !== +b.port) return; if (P.hostheader !== undefined && P.hostheader !== null && lc(P.hostheader) !== lc(b.host || '')) return; if (P.protocol && lc(P.protocol) !== b.proto) return; rows.push({ protocol: b.proto, bindingInformation: b.ip + ':' + b.port + ':' + (b.host || ''), sslFlags: b.proto === 'https' ? 0 : 0 }); }));
  return { objs: rows, table: ['protocol', 'bindingInformation', 'sslFlags'] };
});
def('set-webbinding', { p: ['name', 'bindinginformation', 'propertyname', 'value'], pos: [], sw: [] }, (ctx, P) => {
  const e = iisSrv(ctx); if (e) return e; if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Set-WebBinding], UnauthorizedAccessException', 'UnauthorizedAccess,Set-WebBinding', ctx.text) };
  const x = iisFind(ctx, P.name); if (!x) return { err: iisNotFound(ctx, P.name) };
  const bi = String(P.bindinginformation || '*:80:'); const b = x.bindings.find(y => (y.ip + ':' + y.port + ':' + (y.host || '')) === bi);
  if (!b) return { err: psError(ctx.name, 'Aucune liaison ne correspond à « ' + bi + ' » sur le site « ' + x.name + ' ».', 'ObjectNotFound: (' + bi + ':String) [Set-WebBinding], ItemNotFoundException', 'BindingNotFound,Set-WebBinding', ctx.text) };
  const pn = lc(P.propertyname || ''); const v = P.value === undefined || P.value === null ? '' : String(P.value);
  if (pn === 'hostheader') b.host = v; else if (pn === 'port') b.port = +v; else if (pn === 'ipaddress') b.ip = v; else return { err: psError(ctx.name, 'La propriété « ' + (P.propertyname || '') + ' » n’est pas prise en charge par cette émulation.', 'InvalidArgument: (:) [Set-WebBinding], ParameterBindingException', 'UnsupportedProperty,Set-WebBinding', ctx.text) };
  ctx.s.env.touch('iis'); return { objs: [], mutated: true };
});
U.av('ps-netadapter-admin', 'Enable-NetAdapter / Disable-NetAdapter : Enable s’exécute sans invite, Disable demande confirmation sans -Confirm:$false (voir ps-confirm) ; Get-NetAdapter affiche « Disabled » pour une carte désactivée (LinkSpeed 0 bps) — à confirmer par capture.');
const nicSet = (down) => (ctx, P) => {
  if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (MSFT_NetAdapter:ROOT/StandardCimv2/MSFT_NetAdapter) [' + ctx.name + '], CimException', 'Windows System Error 5,' + ctx.name, ctx.text) };
  const names = W_.ifaceNames(ctx.d).filter(n => !P.name || wild(P.name, n));
  if (!names.length) return { err: psError(ctx.name, 'Aucune carte réseau ne correspond aux critères « ' + (P.name || '') + ' ».', 'ObjectNotFound: (' + (P.name || '') + ':String) [' + ctx.name + '], CimJobException', 'CmdletizationQuery_NotFound_Name,' + ctx.name, ctx.text) };
  names.forEach(n => { const i = ctx.d.ifaces[n]; i.adminDown = down; if (!down && i.dhcp) N.dhcpRenew(ctx.W, ctx.d.id, n); });
  ctx.s.env.advance(2); ctx.s.env.touch('nic');
  return { objs: P.passthru ? names.map(n => ({ __t: 'adapter', Name: n, InterfaceDescription: W_.nicDesc, ifIndex: 6 + W_.ifaceNames(ctx.d).indexOf(n), Status: down ? 'Disabled' : (N.linkUp(ctx.W, ctx.d, n) ? 'Up' : 'Disconnected'), MacAddress: E.macDash(ctx.d.ifaces[n].mac), LinkSpeed: down || !N.linkUp(ctx.W, ctx.d, n) ? '0 bps' : '1 Gbps' })) : [], mutated: true };
};
def('enable-netadapter', { p: ['name'], pos: ['name'], sw: ['passthru', 'confirm'] }, nicSet(false));
def('disable-netadapter', { p: ['name'], pos: ['name'], sw: ['passthru', 'confirm'] }, nicSet(true));
def('get-childitem', { p: ['path'], pos: ['path'], sw: ['recurse', 'force'] }, (ctx, P) => {
  const s = ctx.s; const p = W_.normPath(s.cwd, String(P.path || '.')); const node = W_.dirNode(ctx.W, ctx.d, p); if (!node) return { err: psError(ctx.name, 'Impossible de trouver le chemin d’accès « ' + p + ' », car il n’existe pas.', 'ObjectNotFound: (' + p + ':String) [Get-ChildItem], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.GetChildItemCommand', ctx.text) };
  if (!(W_.localRights(ctx.W, ctx.d, node.name) & 1)) return { err: psError(ctx.name, 'Accès au chemin d’accès « ' + p + ' » refusé.', 'PermissionDenied: (' + p + ':String) [Get-ChildItem], UnauthorizedAccessException', 'DirUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetChildItemCommand', ctx.text) };
  const rows = [...node.dirs].sort().map(n => ({ __t: 'item', Mode: 'd-----', LastWriteTime: ctx.W.now(), Length: '', Name: n })).concat([...node.files.keys()].sort().map(n => ({ __t: 'item', Mode: '-a----', LastWriteTime: node.files.get(n).date, Length: node.files.get(n).size, Name: n })));
  return { objs: rows, head: '    Répertoire : ' + node.name, table: ['Mode', 'LastWriteTime', 'Length', 'Name'], fmt: { LastWriteTime: v => E.frDate(v) + '   ' + E.frTime(v).slice(0, 5) } };
});
def('get-content', { p: ['path'], pos: ['path'], sw: [] }, (ctx, P) => { const path = W_.normPath(ctx.s.cwd, String(P.path || '')); const x = ctx.s.readFile(path); if (x.err === 'denied') return { err: psError(ctx.name, 'Accès au chemin d’accès « ' + path + ' » refusé.', 'PermissionDenied: (' + path + ':String) [Get-Content], UnauthorizedAccessException', 'GetContentReaderUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetContentCommand', ctx.text) }; if (x.err) return { err: psError(ctx.name, 'Impossible de trouver le chemin d’accès « ' + path + ' », car il n’existe pas.', 'ObjectNotFound: (' + path + ':String) [Get-Content], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand', ctx.text) }; return { objs: x.text.replace(/\r\n$/, '').split(/\r?\n/) }; });
def('set-location', { p: ['path'], pos: ['path'], sw: [] }, (ctx, P) => { const p = W_.normPath(ctx.s.cwd, String(P.path || '')); const node = W_.dirNode(ctx.W, ctx.d, p); if (!node) return { err: psError(ctx.name, 'Impossible de trouver le chemin d’accès « ' + p + ' », car il n’existe pas.', 'ObjectNotFound: (' + p + ':String) [Set-Location], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.SetLocationCommand', ctx.text) }; ctx.s.cwd = node.name.length === 2 ? node.name + '\\' : node.name; return { objs: [] }; });
def('get-location', {}, ctx => ({ objs: [], head: '', raw: ['', 'Path', '----', ctx.s.cwd, ''] }));
def('test-path', { p: ['path'], pos: ['path'], sw: [] }, (ctx, P) => { const p = W_.normPath(ctx.s.cwd, String(P.path || '')); const node = W_.dirNode(ctx.W, ctx.d, p); if (node) return { objs: [true] }; const dp = p.slice(0, p.lastIndexOf('\\')); const n = W_.dirNode(ctx.W, ctx.d, dp); const name = p.slice(p.lastIndexOf('\\') + 1); return { objs: [!!(n && [...n.files.keys()].some(f => lc(f) === lc(name)))] }; });
def('get-date', { p: ['format'], sw: [] }, (ctx, P) => { const dt = ctx.W.nowOf(ctx.d.id); if (P.format) return { objs: [String(P.format).replace(/yyyy/g, dt.getUTCFullYear()).replace(/MM/g, U.pad2(dt.getUTCMonth() + 1)).replace(/dd/g, U.pad2(dt.getUTCDate())).replace(/HH/g, U.pad2(dt.getUTCHours())).replace(/mm/g, U.pad2(dt.getUTCMinutes())).replace(/ss/g, U.pad2(dt.getUTCSeconds()))] }; return { objs: [dt] }; });
def('write-output', { p: [], sw: [] }, (ctx, P) => ({ objs: P.__pos.length ? P.__pos : ctx.input }));
def('write-host', { p: ['foregroundcolor', 'backgroundcolor', 'separator'], sw: ['nonewline'] }, (ctx, P) => ({ objs: [], raw: [P.__pos.map(x => fmtVal(x)).join(' ')] }));
def('clear-host', {}, ctx => ({ objs: [], clear: true }));
def('get-process', { p: ['name'], pos: ['name'], sw: [] }, (ctx, P) => { const base = [['svchost', 880], ['explorer', 4120], ['powershell', 5132], ['lsass', 704], ['services', 692], ['winlogon', 612]]; return { objs: base.filter(b => !P.name || wild(P.name, b[0])).map((b, i) => ({ __t: 'process', Handles: 200 + i * 37, 'NPM(K)': 12, 'PM(K)': 8400 + i * 900, 'WS(K)': 21000 + i * 1300, 'CPU(s)': (0.2 + i * 0.7).toFixed(2), Id: b[1], SI: 1, ProcessName: b[0] })) }; });
def('restart-computer', { p: ['computername'], sw: ['force', 'wait'] }, (ctx, P) => { if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (:) [Restart-Computer], UnauthorizedAccessException', 'RestartComputerFailed,Microsoft.PowerShell.Commands.RestartComputerCommand', ctx.text) }; SIM.steps.reboot(ctx.W, { dev: ctx.d.id }); ctx.s.env.touch('reboot'); return { objs: [], mutated: true, impact: 'reboot' }; });
def('get-help', { p: [], sw: [] }, ctx => ({ objs: [], raw: ['', 'NOM', '    ' + (ctx.args0 || ''), '', 'SYNOPSIS', '    L’aide en ligne n’est pas disponible dans cette simulation.', ''] }));
/* module d'origine (Source) et version (colonnes de Get-Command) : noms de modules exacts ; versions à vérifier */
U.av('ps-get-command-modules', 'Get-Command : colonne Source (module) et Version affichées par le simulateur selon le nom de l’applet de commande (ActiveDirectory 1.0.1.0, DhcpServer / DnsServer / NetSecurity / SmbShare / NetAdapter 2.0.0.0, NetTCPIP / DnsClient 1.0.0.0, WebAdministration 1.0.0.0, IISAdministration 1.1.0.0, Management / Utility 3.1.0.0) : à comparer avec un Windows Server réel.');
const CMD_MODULE = [[/^(get|set|add|move|unlock|enable|disable)-ad/, 'ActiveDirectory', '1.0.1.0'], [/-dhcpserver/, 'DhcpServer', '2.0.0.0'], [/-dnsserver/, 'DnsServer', '2.0.0.0'], [/^(get|enable|disable|new|set)-netfirewall/, 'NetSecurity', '2.0.0.0'], [/-smbshare/, 'SmbShare', '2.0.0.0'],
  [/-netadapter$/, 'NetAdapter', '2.0.0.0'], [/^(get|new|set)-netip|^test-netconnection/, 'NetTCPIP', '1.0.0.0'], [/-dnsclient|^resolve-dnsname|^register-dnsclient/, 'DnsClient', '1.0.0.0'], [/-iissite$/, 'IISAdministration', '1.1.0.0'], [/-website$|-webbinding$/, 'WebAdministration', '1.0.0.0'],
  [/^(write-|get-date|invoke-webrequest|convertto|select-|format-)/, 'Microsoft.PowerShell.Utility', '3.1.0.0']];
const cmdModule = k => { const m = CMD_MODULE.find(x => x[0].test(k)); return m ? [m[1], m[2]] : ['Microsoft.PowerShell.Management', '3.1.0.0']; };
def('get-command', { p: [], sw: [] }, (ctx, P) => ({ objs: Object.keys(CMD).filter(k => !P.__pos[0] || wild(P.__pos[0], k)).sort().map(k => { const m = cmdModule(k); return { __t: 'cmd', CommandType: 'Cmdlet', Name: nameCase(k), Version: m[1], Source: m[0] }; }) }));
/* index pour l'aide-mémoire de l'interface : noms exacts des applets de commande émulées + alias */
W_.psIndex = () => ({ cmdlets: Object.keys(CMD).sort().map(k => ({ name: nameCase(k), module: cmdModule(k)[0] })), aliases: Object.keys(ALIAS).filter(k => ALIAS[k]).map(k => ({ alias: k, target: nameCase(ALIAS[k]) })) });
def('get-history', {}, ctx => ({ objs: ctx.s.history.map((h, i) => ({ __t: 'hist', Id: i + 1, CommandLine: h })) }));
def('convertto-securestring', { p: ['string'], pos: ['string'], sw: ['asplaintext', 'force'] }, (ctx, P) => ({ objs: [String(P.string || P.__pos[0] || '')] }));

/* filtres */
const FILTERS = {
  'where-object': (ctx, objs, toks) => { const blk = toks.find(t => /^\{/.test(t)); const expr = blk ? blk.slice(1, -1) : '$_.' + toks.join(' '); return objs.filter(o => { const c = Object.assign({}, ctx, { cur: o }); return evalCond(expr, c); }); },
  'foreach-object': (ctx, objs, toks) => { const blk = toks.find(t => /^\{/.test(t)); if (!blk) return objs; const stmts = splitTop(blk.slice(1, -1), ';'); const out = []; objs.forEach(o => { const c = Object.assign({}, ctx, { cur: o }); stmts.forEach(st => { const r = runStatement(st.trim(), c, null); if (r.objs) r.objs.forEach(x => out.push(x)); }); }); return out; },
  'select-object': (ctx, objs, toks) => {
    const names = []; let first = null, last = null, exp = null, uniq = false;
    for (let i = 0; i < toks.length; i++) { const t = toks[i]; if (/^-first$/i.test(t)) first = +toks[++i]; else if (/^-last$/i.test(t)) last = +toks[++i]; else if (/^-expandproperty$/i.test(t)) exp = String(evalValue(toks[++i], ctx)); else if (/^-unique$/i.test(t)) uniq = true; else if (/^-property$/i.test(t)) { listOf(evalValue(toks[++i], ctx)).forEach(x => names.push(String(x))); } else if (!/^-/.test(t)) listOf(evalValue(t, ctx)).forEach(x => names.push(String(x))); }
    let out = objs; if (first !== null) out = out.slice(0, first); if (last !== null) out = out.slice(-last);
    if (exp) return out.map(o => propOf(o, exp));
    if (names.length) { const keys = names; out = out.map(o => { const n = { __t: undefined }; keys.forEach(k => { if (k.indexOf('*') >= 0 && typeof o === 'object') Object.keys(o).filter(x => wild(k, x) && x[0] !== '_').forEach(x => { n[x] = o[x]; }); else n[k] = propOf(o, k); }); return n; }); }
    if (uniq) { const seen = new Set(); out = out.filter(o => { const k = JSON.stringify(o); if (seen.has(k)) return false; seen.add(k); return true; }); }
    return out;
  },
  'sort-object': (ctx, objs, toks) => { const desc = toks.some(t => /^-descending$/i.test(t)); const prop = toks.filter(t => !/^-/.test(t))[0]; const key = prop ? String(evalValue(prop, ctx)) : null; const out = objs.slice().sort((a, b) => { const x = key ? propOf(a, key) : a, y = key ? propOf(b, key) : b; return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); }); return desc ? out.reverse() : out; },
  'measure-object': (ctx, objs) => [{ __t: 'measure', Count: objs.length, Average: '', Sum: '', Maximum: '', Minimum: '', Property: '' }],
  'group-object': (ctx, objs, toks) => { const key = toks.filter(t => !/^-/.test(t))[0]; const g2 = {}; objs.forEach(o => { const k = String(propOf(o, key)); (g2[k] = g2[k] || []).push(o); }); return Object.keys(g2).map(k => ({ __t: 'grp2', Count: g2[k].length, Name: k, Group: g2[k] })); },
  'out-null': () => [], 'out-host': (c, o) => o, 'out-string': (c, o) => o, 'tee-object': (c, o) => o, 'format-wide': (c, o) => o
};
const ALIASF = { where: 'where-object', '?': 'where-object', foreach: 'foreach-object', '%': 'foreach-object', select: 'select-object', sort: 'sort-object', measure: 'measure-object', group: 'group-object' };

/* ------------------------------------------------------------------ exécution d'une instruction */
function runStatement(text, ctx, input) {
  text = text.trim();
  if (!text) return { objs: [] };
  /* affectation $x = ... */
  let m = text.match(/^\$(\w+)\s*=\s*(.+)$/s);
  if (m && !/^=/.test(m[2])) { const r = runStatement(m[2], ctx, null); ctx.vars[m[1]] = r.objs && r.objs.length === 1 ? r.objs[0] : (r.objs || []); const res = { objs: [], errLines: r.errLines, err: r.err, mutated: r.mutated }; return res; }
  /* variable seule ou propriété */
  if (/^\$[\w:]+(\.\w+)*$/.test(text)) { const v = evalValue(text, ctx); return { objs: v === undefined || v === null ? [] : Array.isArray(v) ? v : [v] }; }
  if (/^"/.test(text) || /^'/.test(text)) { return { objs: [evalValue(text, ctx)] }; }
  if (/^-?\d/.test(text) && /^[\d.+\-*\/ ]+$/.test(text)) { const v = arith(text); if (v === null) return { objs: [text] }; if (!isFinite(v)) return { err: [L('Tentative de division par zéro.', 'e')] }; return { objs: [v] }; }
  const toks = psTokens(text); const name = lc(toks[0] || ''); const args = toks.slice(1);
  const cn = ALIAS[name] !== undefined ? ALIAS[name] : name;
  const cmd = cn ? CMD[cn] : null;
  if (cmd) {
    const c2 = Object.assign({}, ctx, { name: cn.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join('-'), text, input: input || [], args0: args[0] });
    if (cn === 'get-service' || true) c2.name = nameCase(cn);
    const P = bind(cmd.spec, args, c2); c2.P = P;
    if (P.__unknown && !(cmd.spec.p || []).length && !(cmd.spec.sw || []).length) { /* paramètres libres */ }
    else if (P.__unknown) return { err: psError(c2.name, 'Un paramètre correspondant au nom « ' + P.__unknown.slice(1) + ' » est introuvable.', 'InvalidArgument: (:) [' + c2.name + '], ParameterBindingException', 'NamedParameterNotFound,Microsoft.PowerShell.Commands.' + c2.name.replace('-', '') + 'Command', text) };
    return cmd.fn(c2, P) || { objs: [] };
  }
  return null;
}
function nameCase(cn) { const special = { 'get-childitem': 'Get-ChildItem', 'get-eventlog': 'Get-EventLog', 'get-aduser': 'Get-ADUser', 'unlock-adaccount': 'Unlock-ADAccount', 'enable-adaccount': 'Enable-ADAccount', 'disable-adaccount': 'Disable-ADAccount', 'set-adaccountpassword': 'Set-ADAccountPassword', 'set-aduser': 'Set-ADUser', 'add-adgroupmember': 'Add-ADGroupMember', 'get-adgroupmember': 'Get-ADGroupMember', 'get-adgroup': 'Get-ADGroup', 'get-adcomputer': 'Get-ADComputer', 'move-adobject': 'Move-ADObject', 'get-adorganizationalunit': 'Get-ADOrganizationalUnit', 'get-addomaincontroller': 'Get-ADDomainController', 'get-dhcpserverv4scope': 'Get-DhcpServerv4Scope', 'set-dhcpserverv4scope': 'Set-DhcpServerv4Scope', 'get-dhcpserverv4exclusionrange': 'Get-DhcpServerv4ExclusionRange', 'remove-dhcpserverv4exclusionrange': 'Remove-DhcpServerv4ExclusionRange', 'add-dhcpserverv4exclusionrange': 'Add-DhcpServerv4ExclusionRange', 'get-dhcpserverv4optionvalue': 'Get-DhcpServerv4OptionValue', 'set-dhcpserverv4optionvalue': 'Set-DhcpServerv4OptionValue', 'get-dhcpserverv4lease': 'Get-DhcpServerv4Lease', 'get-dhcpserverv4reservation': 'Get-DhcpServerv4Reservation', 'set-dhcpserverv4reservation': 'Set-DhcpServerv4Reservation', 'get-dnsserverzone': 'Get-DnsServerZone', 'get-dnsserverresourcerecord': 'Get-DnsServerResourceRecord', 'add-dnsserverresourcerecorda': 'Add-DnsServerResourceRecordA', 'remove-dnsserverresourcerecord': 'Remove-DnsServerResourceRecord', 'get-dnsserverforwarder': 'Get-DnsServerForwarder', 'set-dnsserverforwarder': 'Set-DnsServerForwarder', 'clear-dnsservercache': 'Clear-DnsServerCache', 'get-netipconfiguration': 'Get-NetIPConfiguration', 'get-netipaddress': 'Get-NetIPAddress', 'new-netipaddress': 'New-NetIPAddress', 'set-netipinterface': 'Set-NetIPInterface', 'get-dnsclientserveraddress': 'Get-DnsClientServerAddress', 'set-dnsclientserveraddress': 'Set-DnsClientServerAddress', 'clear-dnsclientcache': 'Clear-DnsClientCache', 'get-dnsclientcache': 'Get-DnsClientCache', 'register-dnsclient': 'Register-DnsClient', 'test-netconnection': 'Test-NetConnection', 'resolve-dnsname': 'Resolve-DnsName', 'get-netfirewallrule': 'Get-NetFirewallRule', 'enable-netfirewallrule': 'Enable-NetFirewallRule', 'disable-netfirewallrule': 'Disable-NetFirewallRule', 'get-netfirewallprofile': 'Get-NetFirewallProfile', 'set-netfirewallprofile': 'Set-NetFirewallProfile', 'new-netfirewallrule': 'New-NetFirewallRule', 'get-winevent': 'Get-WinEvent', 'get-eventlog': 'Get-EventLog', 'get-smbshare': 'Get-SmbShare', 'get-smbshareaccess': 'Get-SmbShareAccess', 'new-smbshare': 'New-SmbShare', 'remove-smbshare': 'Remove-SmbShare', 'grant-smbshareaccess': 'Grant-SmbShareAccess', 'revoke-smbshareaccess': 'Revoke-SmbShareAccess', 'enable-netadapter': 'Enable-NetAdapter', 'disable-netadapter': 'Disable-NetAdapter', 'get-netadapter': 'Get-NetAdapter', 'get-website': 'Get-Website', 'start-website': 'Start-Website', 'stop-website': 'Stop-Website', 'get-iissite': 'Get-IISSite', 'start-iissite': 'Start-IISSite', 'stop-iissite': 'Stop-IISSite', 'get-webbinding': 'Get-WebBinding', 'set-webbinding': 'Set-WebBinding', 'invoke-webrequest': 'Invoke-WebRequest', 'convertto-securestring': 'ConvertTo-SecureString' }; return special[cn] || cn.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join('-'); }

/* Affichage d'un résultat de cmdlet */
function render(res, fmt) {
  const out = [];
  if (res.err) res.err.forEach(x => out.push(x));
  if (res.errLines) res.errLines.forEach(x => out.push(x));
  (res.warn || []).forEach(w => out.push(L(w, 'w')));
  if (res.raw) res.raw.forEach(x => out.push(L(x)));
  const objs = res.objs || [];
  if (!objs.length) return out;
  const lines = fmt ? fmt(objs, res) : defaultFmt(objs, res);
  lines.forEach(x => out.push(typeof x === 'string' ? L(x) : x));
  return out;
}
function defaultFmt(objs, res) {
  if (res.head && res.table) {
    const cols = res.table; const f = res.fmt || {};
    const rows = objs.map(o => cols.map(c => (f[c] ? f[c](propOf(o, c)) : fmtVal(propOf(o, c)))));
    const w = cols.map((c, i) => Math.max(c.length, ...rows.map(r => String(r[i]).length)));
    const o2 = ['', '', res.head, '', cols.map((c, i) => RIGHT[c] ? E.padL(c, w[i]) : E.padR(c, w[i])).join(' ').replace(/\s+$/, ''), cols.map((c, i) => E.padR('-'.repeat(c.length), w[i])).join(' ').replace(/\s+$/, '')];
    rows.forEach(r => o2.push(r.map((v, i) => (RIGHT[cols[i]] ? E.padL(v, w[i]) : E.padR(v, w[i]))).join(' ').replace(/\s+$/, ''))); o2.push(''); return o2;
  }
  if (res.table) {
    const cols = res.table; const f = res.fmt || {};
    const rows = objs.map(o => cols.map(c => (f[c] ? f[c](propOf(o, c)) : fmtVal(propOf(o, c))).toString().split('\n')[0]));
    const w = cols.map((c, i) => Math.max(c.length, ...rows.map(r => String(r[i]).length)));
    const o2 = ['', cols.map((c, i) => E.padR(c, w[i])).join(' ').replace(/\s+$/, ''), cols.map((c, i) => E.padR('-'.repeat(c.length), w[i])).join(' ').replace(/\s+$/, '')];
    rows.forEach(r => o2.push(r.map((v, i) => E.padR(v, w[i])).join(' ').replace(/\s+$/, ''))); o2.push(''); return o2;
  }
  return formatDefault(objs);
}

/* --- confirmations interactives (ConfirmImpact « High ») : Remove-SmbShare, Revoke-SmbShareAccess, Disable-NetAdapter ---
   Sans -Force (SMB) ni -Confirm:$false, l'invite est affichée et l'action n'est exécutée qu'après la réponse du joueur. */
U.av('ps-confirm', 'Invite de confirmation PowerShell de Remove-SmbShare, Revoke-SmbShareAccess et Disable-NetAdapter : structure « Confirmer / Voulez-vous vraiment effectuer cette action ? / Opération « … » en cours sur la cible « … » » et ligne de choix « [O] Oui  [T] Oui pour tout  [N] Non  [U] Non pour tout  [S] Suspendre  [?] Aide » reconstituées de mémoire en français ; libellés exacts, texte de la cible et traduction à confirmer par capture. Le choix S (suspendre) n’est pas émulé : l’invite est reposée.');
const CF_PROMPT = '[O] Oui  [T] Oui pour tout  [N] Non  [U] Non pour tout  [S] Suspendre  [?] Aide (la valeur par défaut est « O ») : ';
const CF_HELP = ['O - Continuer avec uniquement l’étape suivante de l’opération.', 'T - Continuer avec toutes les étapes de l’opération.', 'N - Ignorer cette opération et passer à la suivante.', 'U - Ignorer cette opération et toutes les opérations suivantes.', 'S - Suspendre le pipeline actuel et retourner à l’invite de commandes. Tapez « exit » pour reprendre le pipeline.'];
const inNames = ctx => (ctx.input || []).filter(o => o && typeof o === 'object' && o.Name).map(o => String(o.Name));
const smbShareOf = (ctx, n) => (ctx.d.win.shares || []).find(x => lc(x.name) === lc(n || ''));
const CONFIRM = {
  'remove-smbshare': { force: true, plan: (ctx, P) => {
    if (!ctx.s.elevated) return { err: smbDenied(ctx) };
    const names = P.name !== undefined ? listOf(P.name).map(String) : inNames(ctx); const steps = [];
    for (const n of names) { const sh = smbShareOf(ctx, n); if (!sh) return { err: smbNotFound(ctx, n) }; steps.push({ target: 'Name: ' + sh.name + ' ScopeName: *', P: { name: sh.name } }); }
    return { steps };
  } },
  'revoke-smbshareaccess': { force: true, plan: (ctx, P) => {
    if (!ctx.s.elevated) return { err: smbDenied(ctx) };
    const names = P.name !== undefined ? listOf(P.name).map(String) : inNames(ctx); const steps = [];
    for (const n of names) { const sh = smbShareOf(ctx, n); if (!sh) return { err: smbNotFound(ctx, n) }; listOf(P.accountname).forEach(a => steps.push({ target: 'Name: ' + sh.name + ' ScopeName: * AccountName: ' + a, P: { name: sh.name, accountname: a } })); }
    return { steps };
  } },
  'disable-netadapter': { force: false, plan: (ctx, P) => {
    if (!ctx.s.elevated) return { err: psError(ctx.name, 'Accès refusé', 'PermissionDenied: (MSFT_NetAdapter:ROOT/StandardCimv2/MSFT_NetAdapter) [' + ctx.name + '], CimException', 'Windows System Error 5,' + ctx.name, ctx.text) };
    const given = P.name !== undefined ? listOf(P.name).map(String) : inNames(ctx);
    const names = W_.ifaceNames(ctx.d).filter(n => !given.length || given.some(g => wild(g, n)));
    if (!names.length) return null; /* l'absence de carte est signalée par la cmdlet elle-même */
    return { steps: names.map(n => ({ target: n, P: { name: n } })) };
  } }
};
Object.keys(CONFIRM).forEach(cn => {
  const cmd = CMD[cn]; const orig = cmd.fn; const plan = CONFIRM[cn];
  cmd.spec.sw = (cmd.spec.sw || []).concat(cmd.spec.sw && cmd.spec.sw.indexOf('confirm') >= 0 ? [] : ['confirm']);
  cmd.fn = (ctx, P) => {
    if (ctx.noConfirm || P.confirm === false || (P.force && plan.force && P.confirm !== true)) return orig(ctx, P);
    const pl = plan.plan(ctx, P); if (!pl) return orig(ctx, P); if (pl.err) return pl; if (!pl.steps.length) return orig(ctx, P);
    return { objs: [], confirm: { text: ctx.text, steps: pl.steps.map(st => ({ op: ctx.name, target: st.target, run: () => orig(Object.assign({}, ctx, { noConfirm: true }), Object.assign({}, P, st.P, { confirm: false })) })) } };
  };
});
function confirmFlow(ctx, cf, pre) {
  const s = ctx.s; const st = { all: false, none: false, i: 0 };
  const runStep = (step, ans) => {
    const r = step.run(); const lines = render(r);
    s.env.act({ kind: 'cmd', dev: s.devId, text: cf.text + '   [confirmé : ' + ans + ']', mutates: !r.err, shell: 'ps', impact: r.impact });
    return lines;
  };
  const again = () => ({ prompt: CF_PROMPT, echo: true, cb: answer });
  function next(out) {
    while (st.i < cf.steps.length) {
      const step = cf.steps[st.i];
      if (st.none) { st.i++; continue; }
      if (st.all) { runStep(step, 'T').forEach(x => out.push(x)); st.i++; continue; }
      [L(''), L('Confirmer'), L('Voulez-vous vraiment effectuer cette action ?'), L('Opération « ' + step.op + ' » en cours sur la cible « ' + step.target + ' ».')].forEach(x => out.push(x));
      return { out, ask: again(), ok: true };
    }
    return { out, ok: true };
  }
  function answer(line) {
    const a = lc(String(line || '').trim()); const out = [];
    if (a === '' || a === 'o') { runStep(cf.steps[st.i], 'O').forEach(x => out.push(x)); st.i++; return next(out); }
    if (a === 't') { st.all = true; return next(out); }
    if (a === 'n') { st.i++; return next(out); }
    if (a === 'u') { st.none = true; return next(out); }
    if (a === '?') CF_HELP.forEach(x => out.push(L(x)));
    return { out, ask: again(), ok: true };
  }
  return next(pre.slice());
}

/* Pipeline PowerShell complet (retourne null si la première commande n'est pas une cmdlet → exécution native) */
W_.psPipeline = function (s, text) {
  const segs = splitTop(text, '|').map(x => x.trim()).filter(Boolean);
  if (!segs.length) return { out: [], ok: true };
  const d = s.d, W = s.W; s.psVars = s.psVars || {};
  const ctx = { s, W, d, vars: s.psVars, cur: null, input: [] };
  /* première commande : cmdlet ou natif ? */
  const firstTok = lc(psTokens(segs[0])[0] || ''); const cn0 = ALIAS[firstTok] !== undefined ? ALIAS[firstTok] : firstTok;
  const isVar = /^\$/.test(segs[0]) || /^["']/.test(segs[0]) || /^-?\d/.test(segs[0]);
  if (!CMD[cn0] && !isVar && !FILTERS[cn0] && !FILTERS[ALIASF[firstTok]]) {
    /* applet de commande RÉELLE que le simulateur n'implémente pas : on le dit, au lieu d'affirmer qu'elle n'existe pas (ce qui serait faux) */
    if (REAL_PS_UNSUPPORTED[cn0] && !REAL_UNSUPPORTED[cn0]) return { out: [L(U.av('ps-unsupported', 'Applet de commande réelle non gérée par le simulateur : ' + psTokens(segs[0])[0] + '. Utilise le bouton « Aide-mémoire » de la fenêtre pour la liste des commandes disponibles.'), 'w'), L('')], ok: false };
    if (REAL_UNSUPPORTED[cn0]) return { out: [L(U.av('ps-unsupported', 'Applet de commande réelle non gérée par le simulateur : ' + psTokens(segs[0])[0] + '. Fais cette opération dans ' + REAL_UNSUPPORTED[cn0] + '.'), 'w'), L('')], ok: false };
    if (/^[A-Za-z]+-[A-Za-z]+$/.test(psTokens(segs[0])[0] || '') && !W_.cmds[firstTok]) return { out: render({ err: psError(psTokens(segs[0])[0], 'Le terme «' + psTokens(segs[0])[0] + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable. Vérifiez l’orthographe du nom, ou si un chemin d’accès existe, vérifiez que le chemin d’accès est correct et réessayez.', 'ObjectNotFound: (' + psTokens(segs[0])[0] + ':String) [], CommandNotFoundException', 'CommandNotFoundException', segs[0]) }), ok: false };
    return null;
  }
  let res = runStatement(segs[0], ctx, null) || { objs: [] };
  if (res.err) { const o = render(res); return { out: o, ok: false, mutated: res.mutated }; }
  let objs = res.objs || []; let mutated = !!res.mutated; let impact = res.impact; let fmt = null; const outLines = []; let head = res;
  const errAcc = [].concat(res.errLines || []); const warnAcc = [].concat(res.warn || []); const rawAcc = [].concat(res.raw || []); let clear = !!res.clear;
  for (let i = 1; i < segs.length; i++) {
    const toks = psTokens(segs[i]); const nm = lc(toks[0] || ''); const fn = ALIASF[nm] || ALIAS[nm] || nm;
    if (fn === 'format-table' || fn === 'format-list') {
      const names = toks.slice(1).filter(t => !/^-/.test(t)).flatMap(t => listOf(evalValue(t, ctx))).map(String).filter(x => x !== 'true'); const auto = toks.some(t => /^-auto/i.test(t));
      fmt = (os) => { const cols = names.length ? names : (os[0] && os[0].__t && TABLES[os[0].__t] && TABLES[os[0].__t].length ? TABLES[os[0].__t] : Object.keys(os[0] || {}).filter(k => k[0] !== '_')); const expanded = cols.indexOf('*') >= 0 ? Object.keys(os[0]).filter(k => k[0] !== '_') : cols; return fn === 'format-table' ? formatTable(os, expanded) : formatList(os, names.length ? expanded : null); };
      continue;
    }
    if (FILTERS[fn]) { objs = FILTERS[fn](ctx, objs, toks.slice(1)); head = { objs }; continue; }
    const cmd = CMD[fn];
    if (cmd) {
      const c2 = Object.assign({}, ctx, { name: nameCase(fn), text: segs[i], input: objs }); const P = bind(cmd.spec, toks.slice(1), c2); const r2 = cmd.fn(c2, P) || { objs: [] };
      if (r2.err) { return { out: render(Object.assign({}, r2, { raw: rawAcc, errLines: errAcc })), ok: false, mutated: mutated || r2.mutated }; }
      mutated = mutated || !!r2.mutated; impact = impact || r2.impact; (r2.errLines || []).forEach(x => errAcc.push(x)); objs = r2.objs || []; head = r2; continue;
    }
    if (fn === 'select-string' || fn === 'findstr' || fn === 'find') {
      const lines = objs.map(o => typeof o === 'string' ? o : (o && typeof o === 'object' ? formatDefault([o]).map(x => (typeof x === 'string' ? x : x.t)).join('\n') : String(o))).join('\n').split('\n').map(x => L(x));
      const r3 = s.runFilter(segs[i], lines); r3.out.forEach(x => outLines.push(x)); objs = []; head = { objs: [] }; continue;
    }
    return { out: render({ err: psError(nameCase(nm), 'Le terme «' + toks[0] + '» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de script ou programme exécutable.', 'ObjectNotFound: (' + toks[0] + ':String) [], CommandNotFoundException', 'CommandNotFoundException', segs[i]) }), ok: false };
  }
  const final = render({ objs, raw: rawAcc, errLines: errAcc, warn: warnAcc, table: head.table, head: head.head, fmt: head.fmt }, fmt);
  if (head.confirm) { const cf = confirmFlow(ctx, head.confirm, outLines.concat(final)); cf.mutated = mutated; return cf; }
  return { out: outLines.concat(final), ok: true, mutated, impact, clear: clear || undefined };
};

/* point d'entrée pour une commande native en mode PowerShell (renvoie null → table cmd) */
W_.runPs = function (s, text, args) { return null; };
W_.psCmdlets = Object.keys(CMD);
})(typeof globalThis !== 'undefined' ? globalThis : window);
