/* ============================================================================
   Émulateurs de terminaux — noyau commun (sans DOM, testable sous Node).
   - Env      : pont vers le monde simulé, la mission (trace des actions) et les observations de vérification.
   - Session  : base d'une session interactive (historique, saisie secrète, sous-sessions, flux de sortie).
   - Outils   : découpage de lignes de commande (cmd / bash), tableaux, dates françaises.
   Les sorties sont CALCULÉES depuis l'état du monde : aucune réponse n'est figée par scénario.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const E = SIM.emu = SIM.emu || {};

/* ------------------------------------------------------------------ lignes de sortie */
/* k : 'o' normal, 'e' erreur (stderr), 'w' avertissement, 'd' atténué, 'b' gras, 'h' en-tête ; d : délai (ms) avant affichage */
const L = (t, k, d) => ({ t: SIM.codes.text(String(t), 'terminal'), k: k || 'o', d: d || 0 });   // D-106 : seul point d'émission des codes d'erreur
E.L = L;
function Out() { this.lines = []; }
Out.prototype.l = function (t, k, d) { String(t === undefined ? '' : t).split('\n').forEach((x, i) => this.lines.push(L(x, k, i === 0 ? d : 0))); return this; };
Out.prototype.e = function (t) { return this.l(t, 'e'); };
Out.prototype.w = function (t) { return this.l(t, 'w'); };
Out.prototype.blank = function () { this.lines.push(L('')); return this; };
Out.prototype.add = function (lines) { (lines || []).forEach(x => this.lines.push(typeof x === 'string' ? L(x) : x)); return this; };
E.Out = Out;

/* ------------------------------------------------------------------ environnement */
function Env(W, hooks) { this.W = W; this.hooks = hooks || {}; }
/* Trace d'une action du joueur (mission.act en jeu, W.trace sinon) */
Env.prototype.act = function (e) {
  if (this.hooks.act) return this.hooks.act(e);
  this.W.trace({ kind: e.kind, dev: e.dev, text: e.text, mutates: !!e.mutates });
  return null;
};
Env.prototype.obs = function (key, ok, meta) { this.W.observe(key, ok, meta); };
Env.prototype.advance = function (sec) { SIM.sched.advance(this.W, sec); };
Env.prototype.touch = function (why) { this.W.touch(why || 'player'); };
Env.prototype.now = function (devId) { return this.W.nowOf(devId); };
E.Env = Env;

/* ------------------------------------------------------------------ session de base */
function Session(env, devId, opts) {
  opts = opts || {};
  this.env = env; this.W = env.W; this.devId = devId; this.d = env.W.d(devId);
  this.history = []; this.ask = null; this.user = opts.user || null; this.kind = 'generic';
  this.transient = {};          // données propres à la session (répertoire courant, variables…)
}
Session.prototype.normalize = function (res) {
  if (!res) res = {};
  if (res instanceof Out) res = { out: res.lines };
  if (Array.isArray(res)) res = { out: res };
  res.out = (res.out || []).map(x => typeof x === 'string' ? L(x) : x);
  return res;
};
/* Exécute une ligne de saisie. Retour : { out:[Line], ask?, push?, pop?, clear?, launch?:[{app,arg}], stream?, pager?, mutated?, exit? } */
Session.prototype.exec = function (line) {
  let res;
  if (this.ask) {
    const a = this.ask; this.ask = null; res = this.normalize(a.cb(line));
  } else {
    if (line.trim()) this.history.push(line);
    res = this.normalize(this.run(line));
    if (line.trim() || res.mutated) this.env.act({ kind: 'cmd', dev: this.devId, text: line.trim(), mutates: !!res.mutated, shell: this.kind, danger: res.danger, impact: res.impact });
  }
  if (res.ask) this.ask = res.ask;
  return res;
};
Session.prototype.run = function () { return { out: [] }; };
Session.prototype.prompt = function () { return this.ask ? this.ask.prompt : '> '; };
Session.prototype.secret = function () { return !!(this.ask && this.ask.echo === false); };
Session.prototype.banner = function () { return []; };
Session.prototype.complete = function () { return { list: [], from: 0 }; };
/* Aide contextuelle sur '?' (surtout Cisco) */
Session.prototype.help = function () { return null; };
/* marque une modification de l'état : à appeler par toute commande qui change le monde */
Session.prototype.changed = function (res, why) { this.env.touch(why || 'player'); if (res) res.mutated = true; };
E.Session = Session;

/* complétion générique : candidats filtrés par le préfixe du dernier mot */
E.completeWith = function (buf, candidates, opts) {
  opts = opts || {};
  const m = buf.match(/(\S*)$/); const word = m ? m[1] : ''; const from = buf.length - word.length;
  const ci = opts.caseInsensitive;
  const pool = candidates.filter(c => (ci ? c.toLowerCase().indexOf(word.toLowerCase()) === 0 : c.indexOf(word) === 0));
  return { list: U.uniq(pool).sort(), from, word };
};
E.commonPrefix = function (list, ci) {
  if (!list.length) return '';
  let p = list[0];
  for (const s of list) { while (p && (ci ? s.toLowerCase().indexOf(p.toLowerCase()) !== 0 : s.indexOf(p) !== 0)) p = p.slice(0, -1); }
  return p;
};

/* ------------------------------------------------------------------ dates (fr) */
E.FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
E.FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
E.FR_MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/* Les machines simulées sont réglées sur UTC (hypothèse documentée dans docs/LIMITES.md) */
E.frLong = d => E.FR_DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + E.FR_MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ' ' + U.pad2(d.getUTCHours()) + ':' + U.pad2(d.getUTCMinutes()) + ':' + U.pad2(d.getUTCSeconds());
E.frDate = d => U.pad2(d.getUTCDate()) + '/' + U.pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
E.frTime = d => U.pad2(d.getUTCHours()) + ':' + U.pad2(d.getUTCMinutes()) + ':' + U.pad2(d.getUTCSeconds());
E.frDateTime = d => E.frDate(d) + ' ' + E.frTime(d);
E.isoDate = d => d.getUTCFullYear() + '-' + U.pad2(d.getUTCMonth() + 1) + '-' + U.pad2(d.getUTCDate());
E.EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
E.EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* « Mon Oct 26 07:12:00 UTC 2026 » (sortie de date en C/POSIX) */
E.dateC = d => E.EN_DAYS[d.getUTCDay()] + ' ' + E.EN_MONTHS[d.getUTCMonth()] + ' ' + String(d.getUTCDate()).padStart(2, ' ') + ' ' + E.frTime(d) + ' UTC ' + d.getUTCFullYear();
/* horodatage syslog « Oct 26 07:12:00 » */
E.syslogTs = d => E.EN_MONTHS[d.getUTCMonth()] + ' ' + String(d.getUTCDate()).padStart(2, ' ') + ' ' + E.frTime(d);

/* ------------------------------------------------------------------ texte */
E.padR = (s, n) => { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); };
E.padL = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
/* tableau à colonnes alignées ; cols : [{h, key|fn, w?, right?}] */
E.table = function (rows, cols, opts) {
  opts = opts || {}; const gap = opts.gap === undefined ? 2 : opts.gap;
  const cell = (r, c) => String(c.fn ? c.fn(r) : r[c.key] === undefined || r[c.key] === null ? '' : r[c.key]);
  const widths = cols.map(c => Math.max(c.w || 0, opts.noHeader ? 0 : String(c.h || '').length, ...rows.map(r => cell(r, c).length)));
  const fmt = (vals) => vals.map((v, i) => (cols[i].right ? E.padL(v, widths[i]) : (i === vals.length - 1 && !opts.padLast ? v : E.padR(v, widths[i])))).join(' '.repeat(gap));
  const out = [];
  if (!opts.noHeader) out.push(fmt(cols.map(c => c.h || '')));
  rows.forEach(r => out.push(fmt(cols.map(c => cell(r, c)))));
  return out;
};

/* ------------------------------------------------------------------ découpage des lignes de commande */
/* cmd.exe / PowerShell : mots séparés par des espaces, guillemets doubles, simples (PS) */
E.splitWin = function (line, ps) {
  const out = []; let cur = '', q = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || (ps && c === "'")) { q = c; has = true; continue; }
    if (/\s/.test(c)) { if (cur !== '' || has) { out.push(cur); cur = ''; has = false; } continue; }
    cur += c;
  }
  if (cur !== '' || has) out.push(cur);
  return out;
};

/* bash : retourne une liste de « segments » { pipeline:[{argv,redirs,assign}], sep } ; expansion $VAR, ~, $?, $(...) via ctx */
E.parseSh = function (line, ctx) {
  const toks = []; let i = 0; const n = line.length;
  const pushWord = (w) => toks.push({ t: 'w', v: w });
  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '#') break;
    if (c === ';') { toks.push({ t: 'op', v: ';' }); i++; continue; }
    if (c === '&' && line[i + 1] === '&') { toks.push({ t: 'op', v: '&&' }); i += 2; continue; }
    if (c === '|' && line[i + 1] === '|') { toks.push({ t: 'op', v: '||' }); i += 2; continue; }
    if (c === '|') { toks.push({ t: 'op', v: '|' }); i++; continue; }
    if (c === '&') { toks.push({ t: 'op', v: '&' }); i++; continue; }
    if (c === '>' || c === '<' || (c === '2' && line[i + 1] === '>') || (c === '1' && line[i + 1] === '>')) {
      let op = ''; if (c === '2' || c === '1') { op = c; i++; }
      op += line[i]; i++;
      if (line[i] === '>' && op.slice(-1) === '>') { op += '>'; i++; }
      if (line[i] === '&') { op += '&'; i++; if (/\d/.test(line[i] || '')) { op += line[i]; i++; } toks.push({ t: 'redir', v: op, target: null }); continue; }
      toks.push({ t: 'redir', v: op, target: undefined }); continue;
    }
    /* mot */
    let w = ''; let glob = false; let quoted = false;
    while (i < n && !/[\s;&|<>]/.test(line[i])) {
      const ch = line[i];
      if (ch === "'") { quoted = true; const j = line.indexOf("'", i + 1); if (j < 0) { w += line.slice(i + 1); i = n; break; } w += line.slice(i + 1, j); i = j + 1; continue; }
      if (ch === '"') {
        quoted = true; i++;
        while (i < n && line[i] !== '"') {
          if (line[i] === '\\' && /["\\$`]/.test(line[i + 1] || '')) { w += line[i + 1]; i += 2; continue; }
          if (line[i] === '$') { const r = expandVar(line, i, ctx); w += r.v; i = r.i; continue; }
          w += line[i]; i++;
        }
        i++; continue;
      }
      if (ch === '\\') { w += line[i + 1] || ''; quoted = true; i += 2; continue; }
      if (ch === '$') { const r = expandVar(line, i, ctx); w += r.v; i = r.i; continue; }
      if (ch === '`') { const j = line.indexOf('`', i + 1); const sub = line.slice(i + 1, j < 0 ? n : j); w += ctx && ctx.subst ? ctx.subst(sub) : ''; i = j < 0 ? n : j + 1; continue; }
      if (ch === '~' && w === '' && (i + 1 >= n || /[\/\s]/.test(line[i + 1]))) { w += (ctx && ctx.home) || '~'; i++; continue; }
      if (/[*?\[]/.test(ch)) glob = true;
      w += ch; i++;
    }
    pushWord({ s: w, glob: glob && !quoted, quoted });
  }
  /* regroupement */
  const segs = []; let cur = { pipeline: [{ argv: [], redirs: [], assign: [] }], sep: null };
  let last = cur.pipeline[0];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'w') {
      const w = t.v;
      if (last.argv.length === 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w.s) && !w.quoted) { const eq = w.s.indexOf('='); last.assign.push([w.s.slice(0, eq), w.s.slice(eq + 1)]); }
      else last.argv.push(w);
    } else if (t.t === 'redir') {
      if (t.target === null) last.redirs.push({ op: t.v });
      else { const nx = toks[k + 1]; if (nx && nx.t === 'w') { last.redirs.push({ op: t.v, target: nx.v.s }); k++; } else last.redirs.push({ op: t.v, target: '' }); }
    } else if (t.v === '|') { last = { argv: [], redirs: [], assign: [] }; cur.pipeline.push(last); }
    else { segs.push(cur); cur = { pipeline: [{ argv: [], redirs: [], assign: [] }], sep: t.v }; last = cur.pipeline[0]; }
  }
  segs.push(cur);
  /* « sep » d'un segment = opérateur qui le PRÉCÈDE ; on le conserve tel quel */
  return segs.filter(s => s.pipeline.some(c => c.argv.length || c.assign.length || c.redirs.length));
};
function expandVar(line, i, ctx) {
  const n = line.length; i++;
  if (line[i] === '(') {
    let depth = 1, j = i + 1; while (j < n && depth) { if (line[j] === '(') depth++; else if (line[j] === ')') depth--; j++; }
    const sub = line.slice(i + 1, j - 1); return { v: ctx && ctx.subst ? ctx.subst(sub) : '', i: j };
  }
  if (line[i] === '{') { const j = line.indexOf('}', i); const name = line.slice(i + 1, j < 0 ? n : j); return { v: ctx && ctx.env ? (ctx.env(name) || '') : '', i: j < 0 ? n : j + 1 }; }
  if (line[i] === '?') return { v: String(ctx && ctx.status !== undefined ? ctx.status : 0), i: i + 1 };
  if (line[i] === '$') return { v: '1234', i: i + 1 };
  const m = line.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
  if (!m) return { v: '$', i };
  return { v: ctx && ctx.env ? (ctx.env(m[0]) || '') : '', i: i + m[0].length };
}

/* ------------------------------------------------------------------ divers */
/* TTL affiché selon le type de destination (valeurs usuelles : Windows 128, Linux 64, équipements réseau 255) moins le nombre de routeurs traversés */
E.baseTtl = function (dev) { if (!dev) return 128; if (dev.kind === 'win') return 128; if (dev.kind === 'linux' || dev.kind === 'pf') return 64; if (dev.kind === 'printer') return 64; return 255; };
/* routeurs traversés (le saut 0 est la source, le dernier saut est la destination ; les commutateurs L2 n'apparaissent pas) */
E.hopCount = function (trace) {
  const h = trace && (trace.rev || trace) && (trace.rev || trace).hops;
  return h ? Math.max(0, h.length - 2) : 0;
};
E.macDash = m => String(m).toUpperCase().replace(/[:]/g, '-');
E.macColon = m => String(m).toLowerCase().replace(/-/g, ':');
E.maskLen = U.mask2len;

/* délai de réponse affiché (ms) : < 1 ms sur le même segment, quelques ms par routeur ; pas aléatoire (déterminisme) */
E.rttMs = function (trace, seq) {
  const routers = E.hopCount(trace);
  const dev = (trace && trace.dstDev) || '';
  const wan = trace && trace.hops && trace.hops.some(h => h.dev === 'ISP') ? 14 : 0;
  const jitter = routers ? (U.hash8(dev + ':' + seq).charCodeAt(0) % 3) : 0;
  return routers ? routers + 1 + wan + jitter : wan;
};

E.hostOfIp = (W, ip) => { const o = SIM.net.findOwner(W, ip); return o ? o.dev || o : null; };

})(typeof globalThis !== 'undefined' ? globalThis : window);
