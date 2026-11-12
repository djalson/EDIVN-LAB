/* ============================================================================
   Cadre de pannes : définitions déclaratives (données pures) → instance → injection
   → évaluation (sondes vivantes, racine réparée, vérification côté client).
   Les symptômes ne sont jamais écrits : ils découlent du monde modifié.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;
SIM.faults = SIM.faults || [];
SIM.probes = SIM.probes || {};
SIM.steps = SIM.steps || {};
const F = SIM.fault = {};

/* ------------------------------------------------------------------ gabarits {{x}} */
function lookup(vars, path) { let cur = vars; for (const k of path.split('.')) { if (cur == null) return undefined; cur = cur[k]; } return cur; }
F.subst = function subst(v, vars) {
  if (typeof v === 'string') {
    const whole = v.match(/^\{\{([\w.]+)\}\}$/);
    if (whole) { const r = lookup(vars, whole[1]); if (r === undefined) throw new Error('Variable de panne inconnue: ' + whole[1]); return ((r !== null && typeof r === 'object') || (typeof r === 'string' && r.indexOf('{{') >= 0)) ? subst(r, vars) : r; }
    return v.replace(/\{\{([\w.]+)\}\}/g, (m, p) => { const r = lookup(vars, p); if (r === undefined) throw new Error('Variable de panne inconnue: ' + p); return String(r); });
  }
  if (Array.isArray(v)) return v.map(x => subst(x, vars));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = subst(v[k], vars); return o; }
  return v;
};

/* ------------------------------------------------------------------ instanciation */
/* seed → variables (vary) → copie substituée de la définition */
F.instantiate = function (def, seed, forced) {
  const rng = U.rng('fault|' + def.id + '|' + seed);
  const vars = {};
  /* variantes retirées du jeu (SIM.RETIRED_VARIANTS) : jamais tirées au hasard ; un test peut encore les forcer par indice */
  const retired = (SIM.RETIRED_VARIANTS || []).filter(r => r.fault === def.id);
  for (const k of Object.keys(def.vary || {})) {
    const all = def.vary[k]; const kept = all.filter(x => !retired.some(r => r.vary === k && x && x.key === r.key));
    const pick = rng.pick(kept.length ? kept : all); vars[k] = (forced && forced[k] !== undefined) ? all[forced[k]] : pick;
  }
  const body = {};
  for (const k of Object.keys(def)) { if (k === 'vary') continue; body[k] = F.subst(def[k], vars); }
  body.vars = vars; body.id = def.id; body.def = def;
  body.probes = (body.probes || []).map((p, i) => Object.assign({ id: 'p' + (i + 1) }, p));
  body.rt = { okSince: null, okVer: null, status: 'active', reasons: [] };
  return body;
};

/* ------------------------------------------------------------------ étapes (injection ET correction scriptée de test) */
F.runSteps = function (W, steps, ctx) {
  for (const st of steps || []) {
    const fn = SIM.steps[st.do];
    if (!fn) throw new Error('Étape inconnue: ' + st.do);
    fn(W, st, ctx || {});
  }
  W.touch('steps');
};
/* jetons évalués à l'exécution : @mac(DEV[,IFACE]) */
F.token = function (W, v) {
  if (typeof v === 'string') { const m = v.match(/^@mac\(([^,)]+)(?:,([^)]+))?\)$/); if (m) { const d = W.d(m[1]); return d.ifaces[m[2] || Object.keys(d.ifaces)[0]].mac; } return v; }
  if (Array.isArray(v)) return v.map(x => F.token(W, x));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = F.token(W, v[k]); return o; }
  return v;
};
const S = SIM.steps;
S.set = (W, s) => { W.setPath(s.path, F.token(W, s.value)); };
S.del = (W, s) => { if (!W.delPath(s.path)) throw new Error('del: chemin introuvable ' + s.path); };
S.push = (W, s) => { W.pushPath(s.path, F.token(W, s.item)); };
S.wall = (W, s) => { W.walls[s.wall] = s.to; };
S.dnscache = (W, s) => { const d = W.d(s.dev); d._rt.dnsCache = d._rt.dnsCache || {}; d._rt.dnsCache[s.name.toLowerCase()] = { ip: s.ip, t: W.clock.elapsed, ttl: s.ttl || 3600 }; };   /* entrée périmée gardée 1 h (TTL d'un enregistrement A statique) : la panne ne s'efface pas en cours de partie */
S.unplug = (W, s) => { const [dv, pn] = s.port.split(':'); const p = N.portObj(W.d(dv), pn); if (!p || !p.cable) throw new Error('unplug: pas de câble ' + s.port); p.cable.plugged = false; };
S.replug = (W, s) => { const [dv, pn] = s.port.split(':'); const p = N.portObj(W.d(dv), pn); if (!p || !p.cable) throw new Error('replug: pas de câble ' + s.port); p.cable.plugged = true; };
S.tick = (W, s) => { SIM.sched.advance(W, s.sec); };
S.renew = (W, s) => { N.dhcpRenew(W, s.dev, s.iface || Object.keys(W.d(s.dev).ifaces)[0]); };
S.release = (W, s) => { N.dhcpRelease(W, s.dev, s.iface || Object.keys(W.d(s.dev).ifaces)[0]); };
S.flushdns = (W, s) => { W.d(s.dev)._rt.dnsCache = {}; };
S.svc = (W, s) => {
  const d = W.d(s.dev);
  if (d.kind === 'win') { SIM.win.setSvc(W, s.dev, s.name, s.state === 'running' || s.state === 'active' ? 'running' : 'stopped'); return; }
  const k = SIM.lx.svcKey(d, s.name); if (!k) throw new Error('svc: service inconnu ' + s.name);
  if (s.state === 'running' || s.state === 'active') SIM.lx.startService(W, d, k); else SIM.lx.stopService(W, d, k);
};
/* Linux */
S['lx.write'] = (W, s) => { SIM.lx.write(W, W.d(s.dev), s.path, s.content, { m: s.m, o: s.o, g: s.g }); };
S['lx.replace'] = (W, s) => {
  const d = W.d(s.dev); const c = SIM.lx.readFile(d, s.path); if (c === null) throw new Error('lx.replace: fichier absent ' + s.path);
  if (c.indexOf(s.from) < 0) throw new Error('lx.replace: motif introuvable dans ' + s.path + ' : ' + s.from);
  SIM.lx.write(W, d, s.path, s.all ? c.split(s.from).join(s.to) : c.replace(s.from, s.to));
};
S['lx.append'] = (W, s) => { const d = W.d(s.dev); SIM.lx.write(W, d, s.path, (SIM.lx.readFile(d, s.path) || '') + s.content); };
S['lx.chmod'] = (W, s) => { const d = W.d(s.dev); const p = SIM.lx.resolve(d, SIM.lx.norm(s.path)); if (!d.fs[p]) throw new Error('lx.chmod: absent ' + s.path); d.fs[p].m = s.mode; };
S['lx.chown'] = (W, s) => { const d = W.d(s.dev); const p = SIM.lx.resolve(d, SIM.lx.norm(s.path)); if (!d.fs[p]) throw new Error('lx.chown: absent ' + s.path); if (s.owner) d.fs[p].o = s.owner; if (s.group) d.fs[p].g = s.group; };
S['lx.rm'] = (W, s) => { SIM.lx.rm(W.d(s.dev), s.path); };
S['lx.svc'] = (W, s) => {
  const d = W.d(s.dev); const k = SIM.lx.svcKey(d, s.name); if (!k) throw new Error('lx.svc: service inconnu ' + s.name);
  if (s.op === 'start') SIM.lx.startService(W, d, k); else if (s.op === 'stop') SIM.lx.stopService(W, d, k);
  else if (s.op === 'reload') SIM.lx.reloadService(W, d, k); else if (s.op === 'restart') { SIM.lx.stopService(W, d, k); SIM.lx.startService(W, d, k); }
  else if (s.op === 'enable') d.svc[k].enabled = true; else if (s.op === 'disable') d.svc[k].enabled = false;
  else throw new Error('lx.svc: opération inconnue ' + s.op);
};
S['lx.disk'] = (W, s) => { W.d(s.dev).disk[s.fs].usePct = s.usePct; };

/* ------------------------------------------------------------------ sondes */
const P = SIM.probes;
const targetIp = (W, from, to) => {
  if (U.isIP(to)) return { ip: to };
  const r = N.resolve(W, from, to, { noCache: true });
  return r.ok ? { ip: r.ip } : { err: 'résolution de « ' + to + ' » depuis ' + from + ' : ' + r.err };
};
P.ping = (W, p) => { const t = targetIp(W, p.from, p.to); if (t.err) return { ok: false, why: t.err }; const r = N.ping(W, p.from, t.ip); return { ok: r.ok, why: r.ok ? 'ok' : N.describeFail(r.trace) }; };
P.connect = (W, p) => { const t = targetIp(W, p.from, p.to); if (t.err) return { ok: false, why: t.err }; const r = N.connect(W, p.from, t.ip, p.proto || 'tcp', p.port); return { ok: r.state === 'open', why: r.state + (r.trace && !r.trace.ok ? ' ' + N.describeFail(r.trace) : '') }; };
P.resolve = (W, p) => {
  const r = N.resolve(W, p.from, p.name, { noCache: !p.cache });
  if (!r.ok) return { ok: false, why: r.err };
  if (p.expect && r.ips.indexOf(p.expect) < 0) return { ok: false, why: 'résolu en ' + r.ips.join(',') + ' (attendu ' + p.expect + ')' };
  return { ok: true, why: r.ip };
};
P.lease = (W, p) => {
  const d = W.d(p.host); const ifn = p.iface || Object.keys(d.ifaces)[0]; const c = N.effCfg(d, ifn);
  if (!c || c.mode !== 'dhcp') return { ok: false, why: 'mode ' + (c && c.mode) };
  if (p.net && !U.inCidr(c.ip, p.net)) return { ok: false, why: 'bail ' + c.ip + ' hors ' + p.net };
  return { ok: true, why: c.ip };
};
P.ip = (W, p) => {
  const d = W.d(p.host); const ifn = p.iface || Object.keys(d.ifaces)[0]; const c = N.effCfg(d, ifn);
  if (!c || !c.ip || c.ip === '0.0.0.0' || c.mode === 'apipa') return { ok: false, why: 'pas d’adresse valide' };
  if (p.net && !U.inCidr(c.ip, p.net)) return { ok: false, why: c.ip + ' hors ' + p.net };
  if (p.eq && c.ip !== p.eq) return { ok: false, why: c.ip + ' ≠ ' + p.eq };
  return { ok: true, why: c.ip };
};
P.svc = (W, p) => {
  const d = W.d(p.dev); let st;
  if (d.kind === 'win') st = SIM.win.svcState(d, p.name) === 'running' ? 'running' : 'stopped';
  else { const k = SIM.lx.svcKey(d, p.name); st = k && d.svc[k].state === 'active' && SIM.lx.svcRun(d, k) ? 'running' : 'stopped'; }
  return { ok: st === (p.state || 'running'), why: st };
};
P.ptr = (W, p) => {
  const rev = p.ip.split('.').reverse().join('.') + '.in-addr.arpa';
  for (const sv of (p.server ? [p.server] : N.dnsServersOf(W, W.d(p.from)))) {
    const r = N.dnsQuery(W, p.from, sv, rev, 'PTR');
    if (r.state === 'ok' && r.rcode === 'NOERROR' && r.answers && r.answers.length) { const v = r.answers[0].data.replace(/\.$/, ''); return { ok: !p.expect || v.toLowerCase() === p.expect.toLowerCase(), why: v }; }
  }
  return { ok: false, why: 'pas de PTR' };
};
P.dhcpfree = (W, p) => {
  const d = W.d(p.dev); const sc = d.win.dhcp.scopes.find(x => x.id === p.scope); if (!sc) return { ok: false, why: 'étendue absente' };
  const used = new Set((sc.reservations || []).map(r => r.ip)); let free = 0;
  for (let n = U.ip2n(sc.start); n <= U.ip2n(sc.end); n++) { const ip = U.n2ip(n); if (used.has(ip) || (sc.exclusions || []).some(e => U.ipInRange(ip, e.start, e.end))) continue; free++; }
  return { ok: free >= (p.min || 10), why: free + ' adresses libres' };
};
P.link = (W, p) => { const up = N.linkUp(W, W.d(p.dev), p.port); return { ok: up, why: up ? 'up' : 'down' }; };
P.eq = (W, p) => { const v = W.getPath(p.path); const ok = JSON.stringify(v) === JSON.stringify(p.value); return { ok, why: JSON.stringify(v) }; };
P.listen = (W, p) => { const d = W.d(p.dev); const h = SIM.kinds[d.kind] || {}; const ip = (N.l3up(W, d)[0] || {}).ip; const ok = !!(h.listening && h.listening(W, d, p.proto || 'tcp', p.port, (N.l3up(W, d)[0] || {}).name, { dip: ip })); return { ok, why: ok ? 'écoute' : 'n’écoute pas' }; };

/* ------------------------------------------------------------------ racine réparée */
function semNow(W) { if (!W._semCache || W._semCache.ver !== W.ver) W._semCache = { ver: W.ver, sem: W.sem() }; return W._semCache.sem; }
const matchKey = (spec, key) => typeof spec === 'string' ? (key === spec || key.indexOf(spec + '/') === 0 || key.indexOf(spec + '[') === 0 || key.indexOf(spec + ':') === 0) : new RegExp(spec.re).test(key);
function rootOk(W, root, base) {
  const cur = semNow(W);
  if (typeof root === 'object' && root.any) return root.any.some(r => rootOk(W, r, base));
  if (typeof root === 'object' && root.probe) { const pr = SIM.probes[root.probe.t](W, root.probe); return !!pr.ok; }
  if (typeof root === 'object' && root.path) {
    const v = W.getPath(root.path);
    if (root.in) return root.in.some(x => JSON.stringify(F.token(W, x)) === JSON.stringify(v));
    if (root.has !== undefined) return Array.isArray(v) && v.indexOf(root.has) >= 0;
    if (root.hasNot !== undefined) return !(Array.isArray(v) && v.indexOf(root.hasNot) >= 0);   /* la liste ne doit PAS contenir la valeur (ex. : droit « Appliquer » donné à tous = fausse résolution) */
    if (root.net) return U.isIP(v) && U.inCidr(v, root.net);
    if (root.outside) return U.isIP(v) && !U.ipInRange(v, root.outside[0], root.outside[1]);
    if (root.eq !== undefined) return JSON.stringify(v) === JSON.stringify(F.token(W, root.eq));
    if (root.ne !== undefined) return JSON.stringify(v) !== JSON.stringify(root.ne);
    if (root.gte !== undefined) return v >= root.gte;
    if (root.gt !== undefined) return v > root.gt;
    if (root.lt !== undefined) return v < root.lt;
    if (root.lte !== undefined) return v <= root.lte;
    if (root.isNull) return v === null || v === undefined;
    return v !== undefined;
  }
  const keys = new Set(Object.keys(base).concat(Object.keys(cur)));
  for (const k of keys) { if (!matchKey(root, k)) continue; if (JSON.stringify(base[k]) !== JSON.stringify(cur[k])) return false; }
  return true;
}
F.rootsFixed = function (W, inst, base) { return (inst.roots || []).every(r => rootOk(W, r, base)); };
F.rootsCount = function (W, inst, base) { const rs = inst.roots || []; return { ok: rs.filter(r => rootOk(W, r, base)).length, total: rs.length }; };

/* ------------------------------------------------------------------ évaluation */
/* États : active → fixed (sondes OK, racine réparée, vérification manquante) → resolved ;
   workaround = sondes OK mais racine non réparée (contournement). */
F.OBS_TYPES = ['ping', 'connect', 'resolve', 'http', 'ipconfig', 'share', 'login', 'ssh', 'vpn', 'use'];
F.defaultVerify = function (inst) {
  const pats = new Set();
  for (const p of inst.probes) {
    const h = p.from || p.host || p.client;
    if (h) F.OBS_TYPES.forEach(t => pats.add(t + ':' + h + ':*'));
    if (!h && p.dev) F.OBS_TYPES.forEach(t => pats.add(t + ':*:' + p.dev + '*'));
  }
  return [...pats];
};
F.evaluate = function (W, inst, base) {
  const rt = inst.rt; rt.reasons = [];
  const res = inst.probes.map(p => {
    const fn = SIM.probes[p.t];
    let r; try { if (!fn) throw new Error('sonde inconnue: ' + p.t); r = fn(W, p, inst); } catch (e) { r = { ok: false, why: 'erreur de sonde: ' + e.message, err: true }; }
    const ok = p.not ? !r.ok : !!r.ok;
    return { id: p.id, t: p.t, ok, why: r.why, hidden: !!p.hidden, label: p.label };
  });
  const allOk = res.every(x => x.ok);
  if (allOk && rt.okSince === null) { rt.okSince = W.clock.elapsed; rt.okVer = W.ver; }
  if (!allOk) { rt.okSince = null; rt.okVer = null; }
  const rootsFixed = F.rootsFixed(W, inst, base);
  const pats = (inst.verify && inst.verify.length) ? inst.verify : F.defaultVerify(inst);
  const verified = allOk && pats.some(pt => W.observedOk(pt, rt.okVer));
  rt.status = !allOk ? 'active' : !rootsFixed ? 'workaround' : verified ? 'resolved' : 'fixed';
  rt.probes = res; rt.allOk = allOk; rt.rootsFixed = rootsFixed; rt.verified = verified;
  return rt;
};

/* ------------------------------------------------------------------ aide aux tests : application des corrections */
/* toutes les combinaisons de variantes (produit cartésien, plafonné) */
F.variantCombos = function (def, cap) {
  const keys = Object.keys(def.vary || {}); let combos = [{}];
  for (const k of keys) { const next = []; for (const c of combos) for (let i = 0; i < def.vary[k].length; i++) next.push(Object.assign({}, c, { [k]: i })); combos = next; if (combos.length > (cap || 12)) combos = combos.slice(0, cap || 12); }
  return combos;
};
F.applyFix = function (W, inst, which) {
  const steps = which ? (inst.fixes && inst.fixes[which]) : (inst.fix || (inst.fixes && inst.fixes[Object.keys(inst.fixes)[0]]));
  if (!steps) throw new Error('Aucune correction scriptée pour ' + inst.id);
  F.runSteps(W, steps, { inst });
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
