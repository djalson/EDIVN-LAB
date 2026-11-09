/* ============================================================================
   Cisco IOS — noyau de l'interpréteur de commandes (commutateurs 2960/3560, routeurs 2911).
   Modes (> # (config)# (config-if)# …), abréviations univoques, aide contextuelle « ? », complétion,
   erreurs « % Invalid input detected at '^' marker. ». Les commandes de configuration modifient le
   MODÈLE (ports, VLAN, SVI, routes, ACL, NAT, DHCP, lignes, SSH) ; les « show » sont dans 31-ios-show.js.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, IOS = SIM.ios;
const E = SIM.emu; const L = E.L;
const I = E.ios = {};

U.av('ios-secret-format', 'Format des secrets IOS affichés dans running-config (type 5 « $1$xxxx$… ») : valeur dérivée du mot de passe, le sel et la longueur du condensat sont indicatifs.');
U.av('ios-banner', 'Texte des messages « % … » non listés dans la documentation d’IOS : repris de mémoire (15.0 / 15.2).');

/* ------------------------------------------------------------------ noms d'interface */
const TYPES = [['FastEthernet', 'fa'], ['GigabitEthernet', 'gi'], ['Vlan', 'vl'], ['Loopback', 'lo'], ['Port-channel', 'po']];
I.shortIf = n => String(n).replace(/^FastEthernet/, 'Fa').replace(/^GigabitEthernet/, 'Gi').replace(/^Vlan/, 'Vl').replace(/^Port-channel/, 'Po');
I.cdpIf = n => String(n).replace(/^FastEthernet/, 'Fas ').replace(/^GigabitEthernet/, 'Gig ').replace(/^Vlan/, 'Vlan ');
/* « fa0/2 », « FastEthernet 0/2 », « gi0/1.20 », « vlan 20 » → nom canonique ; consomme 1 ou 2 jetons */
I.parseIfTokens = function (d, toks, i) {
  const t = toks[i]; if (t === undefined) return null;
  const m = String(t).match(/^([A-Za-z][A-Za-z-]*)(\d.*)?$/); if (!m) return null;
  const word = m[1].toLowerCase(); let num = m[2]; let used = 1;
  const ty = TYPES.find(x => x[0].toLowerCase().indexOf(word) === 0 && word.length >= (x[1] === 'lo' ? 2 : 1));
  if (!ty || (word.length < 2 && ty[1] === 'vl')) { if (!ty) return null; }
  if (!num) { const nx = toks[i + 1]; if (nx !== undefined && /^\d/.test(nx)) { num = nx; used = 2; } else return null; }
  const name = ty[0] + num;
  return { name, used };
};
/* Résolution d'un nom canonique dans l'appareil : {kind:'port'|'svi'|'iface', obj}. create : crée SVI / sous-interface */
I.ifRef = function (d, name, create) {
  if (d.kind === 'ios-sw') {
    if (d.ports[name]) return { kind: 'port', obj: d.ports[name], name };
    if (/^Port-channel\d+$/.test(name)) {
      const n = +name.slice(12); if (n < 1 || n > I.maxChannels(d)) return null;
      if (!create) return null; d.ports[name] = { logical: true, mode: 'access', vlan: 1, cable: null }; return { kind: 'port', obj: d.ports[name], name, created: true };
    }
    if (/^Vlan\d+$/.test(name)) { const v = +name.slice(4); if (v < 1 || v > 4094) return null; d.svi = d.svi || {}; if (!d.svi[name]) { if (!create) return null; d.svi[name] = {}; } return { kind: 'svi', obj: d.svi[name], name }; }
    return null;
  }
  if (d.ifaces[name]) return { kind: 'iface', obj: d.ifaces[name], name };
  const m = name.match(/^(\w+?\d+\/\d+)\.(\d+)$/);
  if (m && d.ifaces[m[1]] && create) { d.ifaces[name] = { parent: m[1], ip: '', mask: '', cable: null }; return { kind: 'iface', obj: d.ifaces[name], name, created: true }; }
  return null;
};
const numPart = n => { const m = String(n).match(/^([A-Za-z]+)(.*)$/); return m ? m[2] : n; };
const typePart = n => { const m = String(n).match(/^([A-Za-z]+)/); return m ? m[1] : ''; };
const portOrder = (a, b) => {
  const ta = typePart(a), tb = typePart(b); if (ta !== tb) return ta === 'Vlan' ? -1 : tb === 'Vlan' ? 1 : ta === 'Port' ? -1 : tb === 'Port' ? 1 : ta === 'FastEthernet' ? -1 : 1;
  const na = numPart(a).split(/[\/.]/).map(Number), nb = numPart(b).split(/[\/.]/).map(Number);
  for (let k = 0; k < Math.max(na.length, nb.length); k++) { const x = na[k] || 0, y = nb[k] || 0; if (x !== y) return x - y; }
  return 0;
};
I.portOrder = portOrder;

/* ------------------------------------------------------------------ grammaire */
/* Spécification d'une commande : mots littéraux (préfixe univoque accepté) et paramètres <nom> ; « *rest » absorbe la fin de ligne */
const DEFS = I.defs = [];
const WORDDESC = I.wordDesc = {};
function def(modes, spec, desc, fn, opts) {
  const parts = spec.split(/\s+/); const rest = parts[parts.length - 1] === '*rest'; if (rest) parts.pop();
  DEFS.push(Object.assign({ modes, parts, rest, desc, fn, spec }, opts || {}));
}
const D = (path, text) => { WORDDESC[path] = text; };
I.def = def; I.D = D;

const isParam = w => w[0] === '<';
const PARAM_HELP = {
  ip: 'A.B.C.D', mask: 'A.B.C.D', wild: 'A.B.C.D', word: 'WORD', text: 'LINE', if: 'IFNAME', iflist: 'IFLIST', vlan: '<1-4094>', vlanlist: 'WORD', num: '<1-65535>',
  name: 'WORD', port: '<0-65535>', acl: '<1-199>', seq: '<1-2147483647>', int: '<0-4294967295>', mac: 'H.H.H', minute: '<0-35791>', host: 'Hostname or A.B.C.D'
};
function paramKind(w) { return w.slice(1, -1).split(':')[0]; }
function paramLabel(w) { const k = paramKind(w); return PARAM_HELP[k] || k.toUpperCase(); }
const RANGE_ALLOWED = { vlan: [1, 4094], acl: [1, 2699], num: [0, 65535], port: [0, 65535], int: [0, 4294967295], minute: [0, 35791], seq: [1, 2147483647] };
function paramOk(sess, kind, tok, toks, i) {
  switch (kind) {
    case 'ip': return U.isIP(tok) ? { used: 1, v: tok } : null;
    case 'mask': return U.isIP(tok) ? { used: 1, v: tok } : null;
    case 'wild': return U.isIP(tok) ? { used: 1, v: tok } : null;
    case 'host': return /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(tok) ? { used: 1, v: tok } : null;
    case 'vlan': case 'acl': case 'num': case 'port': case 'int': case 'minute': case 'seq': {
      if (!/^\d+$/.test(tok)) return null; const r = RANGE_ALLOWED[kind]; const n = +tok; if (n < r[0] || n > r[1]) return null; return { used: 1, v: n };
    }
    case 'if': {
      const x = I.parseIfTokens(sess.d, toks, i); if (!x) return null;
      if (I.ifRef(sess.d, x.name, false)) return { used: x.used, v: x.name };
      /* en configuration, une SVI (commutateur) ou une sous-interface (routeur) peut être créée à la volée */
      const cfg = sess.mode !== 'U' && sess.mode !== 'P';
      if (cfg && sess.d.kind === 'ios-sw' && /^Vlan\d+$/.test(x.name) && +x.name.slice(4) >= 1 && +x.name.slice(4) <= 4094) return { used: x.used, v: x.name };
      if (cfg && sess.d.kind === 'ios-sw' && /^Port-channel\d+$/.test(x.name) && +x.name.slice(12) >= 1 && +x.name.slice(12) <= I.maxChannels(sess.d)) return { used: x.used, v: x.name };
      if (cfg && sess.d.kind === 'ios-rt') { const m = x.name.match(/^(\w+?\d+\/\d+)\.(\d+)$/); if (m && sess.d.ifaces[m[1]]) return { used: x.used, v: x.name }; }
      return null;
    }
    case 'mac': return /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(tok) ? { used: 1, v: tok.toLowerCase() } : null;
    case 'text': return { used: toks.length - i, v: toks.slice(i).join(' ') };
    default: return { used: 1, v: tok };
  }
}
/* Résolution d'une ligne : retourne {def, args, rest} ou {err:'invalid'|'ambiguous'|'incomplete', at} */
I.resolve = function (sess, toks, mode) {
  let cands = DEFS.filter(x => x.modes.indexOf(mode) >= 0 && sess.allowed(x));
  const args = []; let i = 0; let pos = 0;
  while (i < toks.length) {
    const tok = toks[i]; const next = [];
    const lit = {}; let paramHits = [];
    let anyRest = null;
    for (const dd of cands) {
      const w = dd.parts[pos];
      if (w === undefined) { if (dd.rest) anyRest = dd; continue; }
      if (isParam(w)) { const pr = paramOk(sess, paramKind(w), tok, toks, i); if (pr) paramHits.push({ dd, pr }); }
      else if (w.toLowerCase().indexOf(tok.toLowerCase()) === 0) (lit[w] = lit[w] || []).push(dd);
    }
    const lw = Object.keys(lit);
    let chosen = null;
    const exact = lw.find(w => w.toLowerCase() === tok.toLowerCase());
    if (exact) chosen = exact; else if (lw.length === 1) chosen = lw[0];
    else if (lw.length > 1) {
      /* mots différents mais préfixes de la saisie : ambigu sauf s'il existe aussi un paramètre valide */
      if (!paramHits.length) return { err: 'ambiguous', at: i, token: toks.slice(0, i + 1).join(' ') };
    }
    if (chosen) { cands = lit[chosen]; pos++; i++; continue; }
    if (paramHits.length) {
      /* un seul consommateur de jetons à la fois (tous les candidats paramétriques doivent consommer pareil) */
      const used = paramHits[0].pr.used; const kept = paramHits.filter(h => h.pr.used === used);
      args.push(paramHits[0].pr.v); cands = kept.map(h => h.dd); pos++; i += used; continue;
    }
    if (anyRest) return { def: anyRest, args, rest: toks.slice(i) };
    /* jetons restants : une définition avec *rest à cet endroit ? */
    const rr = cands.find(c => c.rest && c.parts.length === pos);
    if (rr) return { def: rr, args, rest: toks.slice(i) };
    return { err: 'invalid', at: i };
  }
  /* fin de ligne : une définition complète ? */
  const done = cands.filter(c => c.parts.length === pos);
  if (done.length) return { def: done[0], args, rest: [] };
  return { err: 'incomplete' };
};
/* Options affichables par « ? » après `toks` (la dernière valeur est complète si `endsSpace`) */
I.nextOptions = function (sess, toks, mode, endsSpace) {
  let cands = DEFS.filter(x => x.modes.indexOf(mode) >= 0 && sess.allowed(x));
  let pos = 0; let i = 0; const consumed = endsSpace ? toks.length : Math.max(0, toks.length - 1);
  while (i < consumed) {
    const tok = toks[i]; const lit = {}; const ph = [];
    for (const dd of cands) {
      const w = dd.parts[pos]; if (w === undefined) continue;
      if (isParam(w)) { const pr = paramOk(sess, paramKind(w), tok, toks, i); if (pr) ph.push({ dd, pr }); }
      else if (w.toLowerCase().indexOf(tok.toLowerCase()) === 0) (lit[w] = lit[w] || []).push(dd);
    }
    const lw = Object.keys(lit); const exact = lw.find(w => w.toLowerCase() === tok.toLowerCase()); const ch = exact || (lw.length === 1 ? lw[0] : null);
    if (ch) { cands = lit[ch]; pos++; i++; }
    else if (ph.length) { cands = ph.map(h => h.dd); pos++; i += ph[0].pr.used; }
    else return { opts: [], bad: true };
  }
  const opts = []; const seen = {}; let cr = false;
  const prefix = endsSpace ? '' : (toks[toks.length - 1] || '');
  for (const dd of cands) {
    const w = dd.parts[pos];
    if (w === undefined) { if (dd.parts.length === pos) cr = true; continue; }
    if (isParam(w)) { if (!endsSpace) continue; const lab = paramLabel(w); if (!seen[lab]) { seen[lab] = 1; opts.push({ w: lab, d: dd.pdesc && dd.pdesc[pos] || '' , param: true }); } continue; }
    if (prefix && w.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) continue;
    if (!seen[w]) { seen[w] = 1; const key = dd.parts.slice(0, pos + 1).filter(x => !isParam(x)).join(' '); opts.push({ w, d: (pos === dd.parts.length - 1 ? dd.desc : null) || WORDDESC[dd.parts.slice(0, pos + 1).join(' ')] || WORDDESC[key] || '' }); }
  }
  if (cr && endsSpace) opts.push({ w: '<cr>', d: '' });
  opts.sort((a, b) => (a.w === '<cr>') - (b.w === '<cr>') || (a.param ? 1 : 0) - (b.param ? 1 : 0) || a.w.localeCompare(b.w));
  return { opts, cands };
};

/* ------------------------------------------------------------------ session */
const MODE_PROMPT = { U: '>', P: '#', C: '(config)#', I: '(config-if)#', L: '(config-line)#', V: '(config-vlan)#', A: '(config-ext-nacl)#', D: '(dhcp-config)#', R: '(config-router)#' };
function IosShell(env, devId, opts) {
  E.Session.call(this, env, devId, opts);
  opts = opts || {}; this.kind = 'ios'; this.via = opts.via || 'console'; this.remote = opts.from || null; this.user = opts.user || null;
  this.priv = opts.priv === undefined ? 15 : opts.priv;
  this.mode = this.priv >= 15 ? 'P' : 'U'; this.ctx = {}; this.termLen = 24; this.monitor = this.via === 'console';
  this.pend = []; this.cfgChanged = false;
  const d = this.d; d._rt.startup = d._rt.startup || I.snapshot(d);
  d._rt.sessCount = (d._rt.sessCount || 0) + 1;
}
IosShell.prototype = Object.create(E.Session.prototype); IosShell.prototype.constructor = IosShell;
I.IosShell = IosShell;
E.IosShell = IosShell;
E.openIos = (env, devId, opts) => new IosShell(env, devId, opts);

IosShell.prototype.host = function () { return this.d.hostname || (this.d.kind === 'ios-sw' ? 'Switch' : 'Router'); };
IosShell.prototype.prompt = function () {
  if (this.ask) return this.ask.prompt;
  const h = this.host(); let m = this.mode;
  if (m === 'I') return h + (this.ctx.ifs && this.ctx.ifs.length > 1 ? '(config-if-range)#' : this.ctx.ifs && /\.\d+$/.test(this.ctx.ifs[0]) ? '(config-subif)#' : '(config-if)#');
  if (m === 'A') return h + (this.ctx.acl && this.ctx.acl.type === 'standard' ? '(config-std-nacl)#' : '(config-ext-nacl)#');
  return h + MODE_PROMPT[m];
};
IosShell.prototype.allowed = function (dd) {
  if (dd.sw && this.d.kind !== 'ios-sw') return false;
  if (dd.rt && this.d.kind !== 'ios-rt') return false;
  if (dd.l3 && !(this.d.kind === 'ios-rt' || this.d.ipRouting)) return false;
  if (dd.minPriv && this.priv < dd.minPriv && this.mode !== 'P' && this.mode !== 'C') return false;
  return true;
};
IosShell.prototype.banner = function () {
  const out = []; const b = this.d.banner;
  if (b) { out.push(L('')); out.push(L(b)); out.push(L('')); }
  return out;
};
IosShell.prototype.modeGroup = function () { return this.mode === 'U' || this.mode === 'P' ? this.mode : 'C'; };
IosShell.prototype.secret = function () { return !!(this.ask && this.ask.echo === false); };

/* message système (syslog) : journalisé, et affiché au fil de l'eau sur la console / terminal monitor */
IosShell.prototype.syslog = function (msg, sev) {
  const W = this.W; W.log(this.devId, 'syslog', { msg, sev: sev === undefined ? 5 : sev });
  this.d._rt.syslogN = (this.d._rt.syslogN || 0) + 1;
  const ts = new Date(W.clock.base + W.clock.elapsed * 1000);
  this.pend.push(L('*' + E.syslogTs(ts) + '.' + String(ts.getUTCMilliseconds()).padStart(3, '0') + ': ' + msg, 'o'));
};
IosShell.prototype.flushPend = function (res) {
  if (this.pend.length && this.monitor) { if (res.out.length || true) res.out.push(L('')); this.pend.forEach(x => res.out.push(x)); }
  this.pend = [];
};

/* ------------------------------------------------------------------ exécution */
IosShell.prototype.tokens = function (line) {
  const toks = []; const pos = []; const re = /\S+/g; let m;
  while ((m = re.exec(line))) { toks.push(m[0]); pos.push(m.index); }
  return { toks, pos };
};
IosShell.prototype.caret = function (line, pos) { return L(' '.repeat(this.prompt().length + pos) + '^'); };
IosShell.prototype.run = function (line) {
  const res = { out: [], mutated: false };
  const t = line.replace(/^\s+/, '');
  if (t === '' || t[0] === '!') return res;
  const tk = this.tokens(t);
  /* « | » : filtre de sortie (include / exclude / begin / section / count) */
  let filter = null; let toks = tk.toks;
  const bar = toks.indexOf('|');
  if (bar >= 0) { filter = toks.slice(bar + 1); toks = toks.slice(0, bar); }
  if (!toks.length) return res;
  const out = this.dispatchLine(toks, t, tk, res);
  if (filter && out.out) out.out = I.applyFilter(out.out, filter);
  this.flushPend(out);
  return out;
};
IosShell.prototype.dispatchLine = function (toks, line, tk, res) {
  let mode = this.mode; let viaDo = false; let off = 0;
  if (/^do$/i.test(toks[0]) && this.mode !== 'U' && this.mode !== 'P') {
    toks = toks.slice(1); off = 1;
    if (!toks.length) { res.out.push(L('% Incomplete command.')); return res; }
    viaDo = true; mode = 'P';
  }
  const r = I.resolve(this, toks, mode);
  if (r.err) {
    if (r.err === 'invalid') { res.out.push(this.caret(line, tk.pos[r.at + off] || 0)); res.out.push(L("% Invalid input detected at '^' marker.")); res.out.push(L('')); }
    else if (r.err === 'ambiguous') { res.out.push(L('% Ambiguous command:  "' + toks.slice(0, r.at + 1).join(' ') + '"')); }
    else { res.out.push(L('% Incomplete command.')); res.out.push(L('')); }
    return res;
  }
  const sub = new E.Out(); const rr = { out: sub.lines, mutated: false };
  const prevMode = this.mode; if (viaDo) this.mode = 'P';
  try { r.def.fn.call(this, r.args, r.rest, sub, rr, line); }
  finally { if (viaDo && this.mode === 'P') this.mode = prevMode; }
  res.out = rr.out.concat(); ['ask', 'push', 'pop', 'clear', 'launch', 'stream', 'pager', 'exit', 'danger', 'impact'].forEach(k => { if (rr[k] !== undefined) res[k] = rr[k]; });
  if (rr.mutated) res.mutated = true;
  return res;
};
/* marque la configuration comme modifiée (syslog à la sortie du mode configuration) */
IosShell.prototype.mut = function (rr, why) { this.cfgChanged = true; this.d._rt.cfgDirty = true; this.env.touch(why || 'ios'); if (rr) rr.mutated = true; };
IosShell.prototype.leaveConfig = function () {
  if (this.cfgChanged) { this.syslog('%SYS-5-CONFIG_I: Configured from ' + (this.via === 'console' ? 'console by console' : 'console by ' + (this.user || 'vty') + ' on vty0 (' + (this.remote || '0.0.0.0') + ')')); this.cfgChanged = false; }
  this.mode = 'P'; this.ctx = {};
};

/* ------------------------------------------------------------------ aide et complétion */
IosShell.prototype.help = function (line) {
  const endsSpace = /\s$/.test(line) || line === '';
  let t = line.replace(/\|.*$/, ''); const tk = this.tokens(t); let toks = tk.toks; let mode = this.mode;
  if (toks.length && /^do$/i.test(toks[0]) && mode !== 'U' && mode !== 'P') { toks = toks.slice(1); mode = 'P'; }
  const res = I.nextOptions(this, toks, mode, endsSpace);
  const out = [];
  if (res.bad || !res.opts.length) { out.push(L("% Unrecognized command")); return out; }
  if (!endsSpace) {
    /* « sh? » : liste compacte des mots */
    out.push(L(res.opts.map(x => x.w).join('  '))); return out;
  }
  const w = Math.max(...res.opts.map(x => x.w.length)) + 2;
  res.opts.forEach(x => out.push(L('  ' + E.padR(x.w, w) + x.d)));
  return out;
};
IosShell.prototype.complete = function (buf) {
  const endsSpace = /\s$/.test(buf); const tk = this.tokens(buf); let toks = tk.toks; let mode = this.mode;
  if (toks.length && /^do$/i.test(toks[0]) && mode !== 'U' && mode !== 'P') { toks = toks.slice(1); mode = 'P'; }
  if (endsSpace || !toks.length) return { list: [], from: buf.length };
  const res = I.nextOptions(this, toks, mode, false);
  const word = toks[toks.length - 1]; const from = buf.length - word.length;
  const lits = (res.opts || []).filter(x => !x.param).map(x => x.w);
  return { list: lits, from, word };
};

/* ------------------------------------------------------------------ filtres de sortie */
I.applyFilter = function (lines, f) {
  const kind = (f[0] || '').toLowerCase(); const pat = f.slice(1).join(' ');
  let re; try { re = new RegExp(pat, 'i'); } catch (e) { return [L('% Invalid regular expression')]; }
  if (kind.indexOf('i') === 0) return lines.filter(x => re.test(x.t));
  if (kind.indexOf('e') === 0) return lines.filter(x => !re.test(x.t));
  if (kind.indexOf('b') === 0) { const k = lines.findIndex(x => re.test(x.t)); return k < 0 ? [] : lines.slice(k); }
  if (kind.indexOf('s') === 0) {
    const out = []; let on = false;
    lines.forEach(x => { if (!/^\s/.test(x.t)) { on = re.test(x.t); if (on) out.push(x); } else if (on) out.push(x); });
    return out;
  }
  if (kind.indexOf('c') === 0) return [L('Number of lines which match regexp = ' + lines.filter(x => re.test(x.t)).length)];
  return [L("% Invalid input detected at '^' marker.")];
};

/* ------------------------------------------------------------------ instantané de configuration (startup-config) */
const CFG_KEYS = ['hostname', 'domain', 'ports', 'vlans', 'svi', 'ifaces', 'routes', 'acls', 'nat', 'dhcp', 'lines', 'ssh', 'users', 'enableSecret', 'enablePwd', 'banner', 'defaultGateway', 'ipRouting', 'ospf', 'stp'];
I.snapshot = function (d) { const o = {}; CFG_KEYS.forEach(k => { if (d[k] !== undefined) { if (k === 'ports' || k === 'ifaces') { o[k] = {}; Object.keys(d[k]).forEach(n => { const c = U.clone(d[k][n]); delete c.cable; delete c.errdisabled; o[k][n] = c; }); } else o[k] = U.clone(d[k]); } }); return o; };
I.restore = function (d, snap) {
  CFG_KEYS.forEach(k => {
    if (snap[k] === undefined) { if (k !== 'ports' && k !== 'ifaces') delete d[k]; return; }
    if (k === 'ports' || k === 'ifaces') {
      Object.keys(d[k] || {}).forEach(n => { if (snap[k][n]) { const keep = { cable: d[k][n].cable }; Object.keys(d[k][n]).forEach(x => { if (x !== 'cable') delete d[k][n][x]; }); Object.assign(d[k][n], U.clone(snap[k][n]), keep); } else if ((k === 'ifaces' && d[k][n].parent) || (k === 'ports' && d[k][n].logical)) delete d[k][n]; });
      Object.keys(snap[k]).forEach(n => { if (!d[k][n]) d[k][n] = U.clone(snap[k][n]); });
    } else d[k] = U.clone(snap[k]);
  });
};
I.sameConfig = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------------ nom de port (filtres) */
I.portNames = d => Object.keys(d.ports || {}).sort(portOrder).sort((a, b) => (/^Port-channel/.test(a) ? 1 : 0) - (/^Port-channel/.test(b) ? 1 : 0));
/* nombre de groupes EtherChannel : 6 sur un 2960, 48 sur un 3560 (valeurs à confirmer sur capture) */
I.maxChannels = d => /2960/.test(d.model || '') ? 6 : 48;

/* ------------------------------------------------------------------ ACL : analyse / rendu */
const PORT_NAMES = { www: 80, domain: 53, telnet: 23, smtp: 25, ftp: 21, 'ftp-data': 20, pop3: 110, bootps: 67, bootpc: 68, ntp: 123, snmp: 161, tftp: 69, syslog: 514, https: 443 };
const PORT_BY_NUM = { 80: 'www', 53: 'domain', 23: 'telnet', 25: 'smtp', 21: 'ftp', 20: 'ftp-data', 110: 'pop3', 67: 'bootps', 68: 'bootpc', 123: 'ntp', 161: 'snmp', 69: 'tftp', 514: 'syslog' };
I.portName = n => PORT_BY_NUM[n] || String(n);
I.portNum = s => /^\d+$/.test(s) ? +s : PORT_NAMES[String(s).toLowerCase()];
const ICMP_TYPES = { echo: 8, 'echo-reply': 0 };
I.parseAddr = function (toks, i) {
  const t = toks[i]; if (t === undefined) return null;
  if (t.toLowerCase() === 'any') return { a: { t: 'any' }, used: 1 };
  if (t.toLowerCase() === 'host') { if (!U.isIP(toks[i + 1] || '')) return { err: i + 1 }; return { a: { t: 'host', ip: toks[i + 1] }, used: 2 }; }
  if (U.isIP(t)) { if (U.isIP(toks[i + 1] || '')) return { a: { t: 'net', ip: t, wild: toks[i + 1] }, used: 2 }; return { a: { t: 'host', ip: t }, used: 1, bare: true }; }
  return { err: i };
};
I.parsePortSpec = function (toks, i) {
  const op = (toks[i] || '').toLowerCase();
  if (['eq', 'neq', 'gt', 'lt'].indexOf(op) >= 0) { const v = I.portNum(toks[i + 1] || ''); if (v === undefined) return { err: i + 1 }; return { p: { op, v }, used: 2 }; }
  if (op === 'range') { const a = I.portNum(toks[i + 1] || ''), b = I.portNum(toks[i + 2] || ''); if (a === undefined || b === undefined) return { err: a === undefined ? i + 1 : i + 2 }; return { p: { op, v: a, v2: b }, used: 3 }; }
  return null;
};
/* analyse « permit|deny … » (extended) ou « permit|deny … » (standard) */
I.parseAclEntry = function (type, toks) {
  const act = toks[0].toLowerCase(); if (act !== 'permit' && act !== 'deny') return { err: 0 };
  let i = 1;
  if (type === 'standard') {
    const a = I.parseAddr(toks, i); if (!a || a.err !== undefined) return { err: a ? a.err : i };
    i += a.used; if (toks[i] && toks[i].toLowerCase() === 'log') i++;
    if (i < toks.length) return { err: i };
    return { e: { a: act === 'permit' ? 'permit' : 'deny', s: a.a } };
  }
  const protoTok = (toks[i] || '').toLowerCase(); const protos = ['ip', 'tcp', 'udp', 'icmp'];
  if (protos.indexOf(protoTok) < 0) return { err: i };
  const e = { a: act, p: protoTok }; i++;
  const s = I.parseAddr(toks, i); if (!s || s.err !== undefined) return { err: s ? s.err : i }; e.s = s.a; i += s.used;
  if (protoTok === 'tcp' || protoTok === 'udp') { const ps = I.parsePortSpec(toks, i); if (ps) { if (ps.err !== undefined) return { err: ps.err }; e.sp = ps.p; i += ps.used; } }
  const dd = I.parseAddr(toks, i); if (!dd || dd.err !== undefined) return { err: dd ? dd.err : i }; e.d = dd.a; i += dd.used;
  if (protoTok === 'tcp' || protoTok === 'udp') { const ps = I.parsePortSpec(toks, i); if (ps) { if (ps.err !== undefined) return { err: ps.err }; e.dp = ps.p; i += ps.used; } }
  if (protoTok === 'icmp' && toks[i] && ICMP_TYPES[toks[i].toLowerCase()] !== undefined) { e.it = ICMP_TYPES[toks[i].toLowerCase()]; i++; }
  if (protoTok === 'tcp' && toks[i] && toks[i].toLowerCase() === 'established') { e.est = true; i++; }
  if (toks[i] && toks[i].toLowerCase() === 'log') { e.log = true; i++; }
  if (i < toks.length) return { err: i };
  return { e };
};
const addrTxt = a => !a || a.t === 'any' ? 'any' : a.t === 'host' ? 'host ' + a.ip : a.ip + ' ' + a.wild;
const portTxt = p => !p ? '' : (p.op === 'range' ? ' range ' + I.portName(p.v) + ' ' + I.portName(p.v2) : ' ' + p.op + ' ' + I.portName(p.v));
I.entryText = function (type, e) {
  if (type === 'standard') return e.a + ' ' + (e.s.t === 'host' ? 'host ' + e.s.ip : e.s.t === 'any' ? 'any' : e.s.ip + ' ' + e.s.wild) + (e.log ? ' log' : '');
  return e.a + ' ' + e.p + ' ' + addrTxt(e.s) + portTxt(e.sp) + ' ' + addrTxt(e.d) + portTxt(e.dp) + (e.it === 8 ? ' echo' : e.it === 0 ? ' echo-reply' : '') + (e.est ? ' established' : '') + (e.log ? ' log' : '');
};
/* numéros de séquence : 10, 20, 30… attribués aux entrées qui n'en ont pas */
I.normSeq = function (acl) { let last = 0; acl.entries.forEach(e => { if (e.seq === undefined || e.seq <= last) e.seq = last + 10; last = e.seq; }); };
I.insertEntry = function (acl, e, seq) {
  I.normSeq(acl);
  if (seq === undefined) { const last = acl.entries.length ? acl.entries[acl.entries.length - 1].seq : 0; e.seq = last + 10; acl.entries.push(e); return true; }
  if (acl.entries.some(x => x.seq === seq)) return false;
  e.seq = seq; const k = acl.entries.findIndex(x => x.seq > seq); if (k < 0) acl.entries.push(e); else acl.entries.splice(k, 0, e); return true;
};

/* ------------------------------------------------------------------ outils communs aux commandes */
I.err = (o, text) => o.l(text);
I.maskOk = m => U.isIP(m) && U.validMask(m);
I.wildToMask = U.wild2mask;
I.curIfs = function (s) { return (s.ctx.ifs || []).map(n => I.ifRef(s.d, n, false)).filter(Boolean); };
I.hashSecret = function (pw) { const h = U.hash8(pw) + U.hash8(pw + 'a') + U.hash8(pw + 'b'); const b = h.replace(/[^a-z0-9]/gi, 'x'); return '$1$' + b.slice(0, 4) + '$' + (b + b).slice(4, 26); };
I.macDotted = m => { const h = String(m).replace(/[^0-9a-f]/gi, '').toLowerCase(); return h.slice(0, 4) + '.' + h.slice(4, 8) + '.' + h.slice(8, 12); };
I.portMac = (d, name) => I.macDotted(U.mac(d.id + ':' + name));
I.vlanList = function (str) {
  const out = []; const bad = String(str).split(',').some(p => {
    const m = p.match(/^(\d+)(?:-(\d+))?$/); if (!m) return true; const a = +m[1], b = m[2] ? +m[2] : +m[1];
    if (a < 1 || b > 4094 || a > b) return true; for (let k = a; k <= b; k++) out.push(k); return false;
  });
  return bad ? null : U.uniq(out).sort((x, y) => x - y);
};
I.vlanText = function (arr) {
  if (!arr.length) return 'none';
  const parts = []; let a = arr[0], p = arr[0];
  for (let k = 1; k <= arr.length; k++) { const v = arr[k]; if (v === p + 1) { p = v; continue; } parts.push(a === p ? String(a) : a + '-' + p); a = v; p = v; }
  return parts.join(',');
};
I.allowedList = function (port) { return port.allowed === 'all' || port.allowed === undefined ? 'all' : I.vlanText(port.allowed.slice().sort((x, y) => x - y)); };

})(typeof globalThis !== 'undefined' ? globalThis : window);
