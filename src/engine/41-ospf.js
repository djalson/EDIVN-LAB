/* ============================================================================
   OSPF (v2, IPv4) — calcul DÉRIVÉ de l'état du monde : voisinages, élection DR/BDR,
   SPF (Dijkstra) par zone avec chemins à coût égal (ECMP), route par défaut externe E2.
   Rien n'est écrit en dur : si une interface passe en passive, si un temporisateur diffère,
   si une zone ou un router-id ne correspond pas, le voisinage tombe et les routes `O` disparaissent.

   Modèle de configuration (sur l'appareil) :
     d.ospf = { pid, routerId?, activeRid?, networks:[{net,wild,area}], passive:[if], passiveDefault:bool,
                nonPassive:[if], defaultOriginate:null|{always:bool}, refBw:100 (Mbit/s) }
   Sur l'interface : ospfHello (10), ospfDead (40), ospfCost, ospfPriority (1).

   Écarts assumés avec un OSPF réel (voir docs/LIMITES.md) :
     • DR/BDR : plus haute (priorité, router-id), sans la non-préemption de la RFC 2328 ;
     • multi-zones à deux niveaux (zone 0 + zones périphériques, ABR rattaché à la zone 0) : routes O IA par résumé d'ABR ; ni liaison virtuelle, ni stub/NSSA, ni agrégation de routes ;
     • pas d'authentification, pas de MTU, pas de LSA détaillées (la base LSDB n'est pas exposée) ;
     • le temps de convergence est instantané (les temporisateurs dead ne sont pas rejoués).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;
const O = SIM.ospf = {};

U.av('ospf-show-format', 'Mise en page exacte de « show ip ospf neighbor / interface / show ip protocols » et des routes O / O*E2 : reconstruite de mémoire pour IOS 15.x (2911), à comparer à une capture réelle.');
U.av('ospf-syslog-text', 'Messages %OSPF-5-ADJCHG (formation, perte de voisinage, motifs « Dead timer expired » / « Interface down or detached »), %OSPF-4-DUP_RTRID_NBR et message de changement de router-id : formulations à confirmer sur une capture réelle.');

const bwMbps = n => /^Gigabit/.test(n) ? 1000 : /^Fast/.test(n) ? 100 : /^Ethernet/.test(n) ? 10 : /^Loopback/.test(n) ? 8000 : 1000;
const ifCfgOf = (d, n) => (d.ifaces && d.ifaces[n]) || (d.svi && d.svi[n]) || {};
const isLoop = n => /^Loopback/.test(n);

O.cost = function (d, n) {
  const i = ifCfgOf(d, n); if (i.ospfCost) return i.ospfCost;
  const ref = (d.ospf && d.ospf.refBw) || 100;
  return Math.max(1, Math.floor(ref / bwMbps(n)));
};
O.isPassive = function (d, n) {
  const o = d.ospf || {};
  return o.passiveDefault ? (o.nonPassive || []).indexOf(n) < 0 : (o.passive || []).indexOf(n) >= 0;
};
const ipDesc = (a, b) => U.ip2n(b) - U.ip2n(a);
/* router-id configuré, sinon plus haute loopback, sinon plus haute adresse d'interface active */
O.autoRid = function (W, d) {
  const l3 = N.l3up(W, d); const lo = l3.filter(x => isLoop(x.name));
  const pool = lo.length ? lo : l3;
  const ips = pool.map(x => x.ip).sort(ipDesc);
  return ips[0] || '0.0.0.0';
};
O.routerIdOf = function (W, d) { const o = d.ospf; return o.activeRid || o.routerId || O.autoRid(W, d); };
/* Y a-t-il une route statique par défaut utilisable (prochain saut joignable via une interface locale UP) ? */
O.hasStaticDefault = function (W, d) {
  const ifs = N.l3up(W, d);
  return (d.routes || []).some(r => !r.disabled && r.net === '0.0.0.0' && r.mask === '0.0.0.0' &&
    (r.nh ? ifs.some(x => U.inNet(r.nh, x.ip, x.mask)) : ifs.some(x => x.name === r.iface)));
};
O.defaultOriginating = function (W, d) {
  const o = d.ospf; if (!o || !o.defaultOriginate) return false;
  return !!o.defaultOriginate.always || O.hasStaticDefault(W, d);
};

/* ------------------------------------------------------------------ calcul */
function build(W) {
  const R = {};
  for (const id of Object.keys(W.dev)) {
    const d = W.dev[id]; if (!d.ospf || !N.powered(d)) continue;
    const rid = O.routerIdOf(W, d);
    const ifs = {}; const nets = d.ospf.networks || [];
    for (const x of N.l3up(W, d)) {
      const c = ifCfgOf(d, x.name); const hello = c.ospfHello || 10;
      let m = nets.find(n => U.wildMatch(x.ip, n.net, n.wild));
      if (!m && c.ospfArea !== undefined) m = { area: c.ospfArea, viaIface: true };
      if (!m) continue;
      const mask = isLoop(x.name) ? '255.255.255.255' : x.mask;
      ifs[x.name] = {
        name: x.name, ip: x.ip, mask, len: U.mask2len(mask), net: U.netAddr(x.ip, mask), area: m.area, cost: O.cost(d, x.name),
        passive: O.isPassive(d, x.name), viaIface: !!m.viaIface, hello, dead: c.ospfDead || hello * 4, prio: c.ospfPriority === undefined ? 1 : c.ospfPriority,
        nbrs: [], rejects: [], loop: isLoop(x.name)
      };
    }
    R[id] = { id, d, rid, ifs };
  }
  /* voisinages */
  for (const id of Object.keys(R)) {
    const A = R[id];
    for (const n of Object.keys(A.ifs)) {
      const me = A.ifs[n]; if (me.passive || me.loop) continue;
      for (const e of N.l2Endpoints(W, A.d, n)) {
        const B = R[e.dev]; if (!B) continue;
        const pi = B.ifs[e.iface]; if (!pi || pi.passive) continue;
        if (me.net !== pi.net || me.mask !== pi.mask) { me.rejects.push({ ip: pi.ip, why: 'subnet' }); continue; }
        if (me.area !== pi.area) { me.rejects.push({ ip: pi.ip, why: 'area', theirs: pi.area }); continue; }
        if (me.hello !== pi.hello || me.dead !== pi.dead) { me.rejects.push({ ip: pi.ip, why: me.hello !== pi.hello ? 'hello' : 'dead', theirs: me.hello !== pi.hello ? pi.hello : pi.dead }); continue; }
        if (A.rid === B.rid) { me.rejects.push({ ip: pi.ip, why: 'dupid' }); continue; }
        me.nbrs.push({ dev: B.id, rid: B.rid, ip: pi.ip, iface: n, peerIface: e.iface, prio: pi.prio });
      }
    }
  }
  /* DR / BDR et états */
  for (const id of Object.keys(R)) {
    const A = R[id];
    for (const n of Object.keys(A.ifs)) {
      const me = A.ifs[n]; if (me.loop) continue;
      if (me.passive) { me.role = me.prio > 0 ? 'DR' : 'DROTHER'; continue; }
      const cand = [{ rid: A.rid, ip: me.ip, prio: me.prio }].concat(me.nbrs.map(x => ({ rid: x.rid, ip: x.ip, prio: x.prio }))).filter(x => x.prio > 0);
      cand.sort((a, b) => b.prio - a.prio || ipDesc(a.rid, b.rid));
      const dr = cand[0] || null; const bdr = cand[1] || null;
      me.dr = dr; me.bdr = bdr;
      me.role = dr && dr.rid === A.rid ? 'DR' : bdr && bdr.rid === A.rid ? 'BDR' : 'DROTHER';
      me.nbrs.forEach(x => {
        x.role = dr && dr.rid === x.rid ? 'DR' : bdr && bdr.rid === x.rid ? 'BDR' : 'DROTHER';
        x.state = (me.role !== 'DROTHER' || x.role !== 'DROTHER') ? 'FULL' : '2WAY';
      });
    }
  }
  return R;
}

/* Dijkstra d'une zone depuis `src` : {dist, hops} (hops : prochains sauts possibles vers chaque routeur) */
function spf(R, area, src) {
  const dist = {}; const hops = {}; const done = {};
  dist[src] = 0; hops[src] = [];
  for (;;) {
    let u = null;
    for (const k of Object.keys(dist)) if (!done[k] && (u === null || dist[k] < dist[u])) u = k;
    if (u === null) break;
    done[u] = true;
    for (const n of Object.keys(R[u].ifs)) {
      const i = R[u].ifs[n]; if (i.area !== area) continue;
      for (const nb of i.nbrs) {
        if (nb.state !== 'FULL' || !R[nb.dev] || done[nb.dev]) continue;
        const nd = dist[u] + i.cost;
        const hop = u === src ? [{ ip: nb.ip, iface: n, via: nb.dev }] : hops[u];
        if (dist[nb.dev] === undefined || nd < dist[nb.dev]) { dist[nb.dev] = nd; hops[nb.dev] = hop.slice(); }
        else if (nd === dist[nb.dev]) hop.forEach(h => { if (!hops[nb.dev].some(y => y.ip === h.ip && y.iface === h.iface)) hops[nb.dev].push(h); });
      }
    }
  }
  return { dist, hops };
}

/* Calcul de toutes les tables : intra-zone (O), inter-zones (O IA) via les ABR, route par défaut externe (E2). */
function allRoutes(W, R) {
  const ids = Object.keys(R);
  const areasOf = id => { const a = []; Object.keys(R[id].ifs).forEach(n => { if (a.indexOf(R[id].ifs[n].area) < 0) a.push(R[id].ifs[n].area); }); return a; };
  const AR = {}; ids.forEach(id => { AR[id] = areasOf(id); });
  const cache = {};
  const spfC = (area, src) => { const k = area + '|' + src; return cache[k] || (cache[k] = spf(R, area, src)); };
  const addHops = (dst, hops) => hops.forEach(h => { if (!dst.some(y => y.ip === h.ip && y.iface === h.iface)) dst.push(h); });
  /* préfixes d'une zone vus depuis `s` (interfaces propres incluses, own:true) */
  const areaTable = (s, a) => {
    const S = spfC(a, s); const t = {};
    Object.keys(S.dist).forEach(rid => {
      Object.keys(R[rid].ifs).forEach(n => {
        const i = R[rid].ifs[n]; if (i.area !== a) return;
        const key = i.net + '/' + i.len; const m = S.dist[rid] + i.cost; const own = rid === s;
        const c = t[key];
        if (!c || m < c.metric) t[key] = { net: i.net, mask: i.mask, len: i.len, metric: m, hops: own ? [] : S.hops[rid].slice(), own };
        else if (m === c.metric && !own && !c.own) addHops(c.hops, S.hops[rid]);
      });
    });
    return t;
  };
  const tables = {}; ids.forEach(id => { tables[id] = {}; AR[id].forEach(a => { tables[id][a] = areaTable(id, a); }); });
  const isAbr = id => AR[id].length > 1 && AR[id].some(a => a === 0 || a === '0');
  const abrs = ids.filter(isAbr);
  const mine = id => { const m = {}; N.l3up(W, R[id].d).forEach(x => { m[U.netAddr(x.ip, x.mask) + '/' + U.mask2len(x.mask)] = 1; }); Object.keys(R[id].ifs).forEach(n => { m[R[id].ifs[n].net + '/' + R[id].ifs[n].len] = 1; }); return m; };
  const MINE = {}; ids.forEach(id => { MINE[id] = mine(id); });
  const merge = (dst, key, e) => { const c = dst[key]; if (!c || e.metric < c.metric) dst[key] = { net: e.net, mask: e.mask, len: e.len, metric: e.metric }; };
  /* résumés envoyés par chaque ABR : dans la zone 0 (préfixes des autres zones), puis dans les autres zones */
  const sumTo0 = {};
  abrs.forEach(b => { sumTo0[b] = {}; AR[b].forEach(a => { if (a === 0 || a === '0') return; Object.keys(tables[b][a]).forEach(k => merge(sumTo0[b], k, tables[b][a][k])); }); });
  /* routes inter-zones apprises dans la zone 0 par chaque routeur de la zone 0 */
  const IA0 = {};
  ids.forEach(s => {
    if (AR[s].indexOf(0) < 0) return; const S = spfC(0, s); const t = {};
    abrs.forEach(b => {
      if (b === s || S.dist[b] === undefined) return;
      Object.keys(sumTo0[b]).forEach(k => {
        if (tables[s][0][k] || MINE[s][k]) return;
        const m = S.dist[b] + sumTo0[b][k].metric; const c = t[k];
        if (!c || m < c.metric) t[k] = { net: sumTo0[b][k].net, mask: sumTo0[b][k].mask, len: sumTo0[b][k].len, metric: m, hops: S.hops[b].slice(), area: 0 };
        else if (m === c.metric) addHops(c.hops, S.hops[b]);
      });
    });
    IA0[s] = t;
  });
  const sumToA = {};
  abrs.forEach(b => {
    sumToA[b] = {};
    AR[b].forEach(a => {
      if (a === 0 || a === '0') return; const t = {};
      Object.keys(tables[b][0]).forEach(k => merge(t, k, tables[b][0][k]));
      Object.keys(IA0[b] || {}).forEach(k => merge(t, k, IA0[b][k]));
      Object.keys(tables[b][a]).forEach(k => { delete t[k]; });
      sumToA[b][a] = t;
    });
  });
  /* joignabilité d'un ASBR : même zone, sinon via un ABR commun */
  const reach = (s, A) => {
    let best = null;
    const common = AR[s].filter(a => AR[A].indexOf(a) >= 0);
    common.forEach(a => { const S = spfC(a, s); if (S.dist[A] === undefined) return; if (!best || S.dist[A] < best.cost) best = { cost: S.dist[A], hops: S.hops[A].slice() }; else if (S.dist[A] === best.cost) addHops(best.hops, S.hops[A]); });
    if (best) return best;
    abrs.forEach(b => {
      if (b === s) return;
      AR[s].filter(a => AR[b].indexOf(a) >= 0).forEach(a1 => {
        const S1 = spfC(a1, s); if (S1.dist[b] === undefined) return;
        AR[b].filter(a2 => AR[A].indexOf(a2) >= 0).forEach(a2 => {
          const S2 = spfC(a2, b); if (S2.dist[A] === undefined) return;
          const c = S1.dist[b] + S2.dist[A];
          if (!best || c < best.cost) best = { cost: c, hops: S1.hops[b].slice() }; else if (c === best.cost) addHops(best.hops, S1.hops[b]);
        });
      });
    });
    return best;
  };
  const out = {};
  ids.forEach(s => {
    const cand = {};   // key -> {rank, metric, hops, e}
    const offer = (key, rank, e) => {
      const c = cand[key];
      if (!c || rank < c.rank || (rank === c.rank && e.metric < c.metric)) cand[key] = { rank, metric: e.metric, hops: e.hops.slice(), e };
      else if (rank === c.rank && e.metric === c.metric) addHops(c.hops, e.hops);
    };
    AR[s].forEach(a => {
      Object.keys(tables[s][a]).forEach(k => { const e = tables[s][a][k]; if (!e.own && !MINE[s][k]) offer(k, 1, Object.assign({ area: a }, e)); });
      /* inter-zones */
      if (a === 0 || a === '0') Object.keys(IA0[s] || {}).forEach(k => { if (!MINE[s][k]) offer(k, 2, IA0[s][k]); });
      else {
        const S = spfC(a, s);
        abrs.forEach(b => {
          if (b === s || S.dist[b] === undefined || !sumToA[b][a]) return;
          Object.keys(sumToA[b][a]).forEach(k => {
            if (MINE[s][k] || AR[s].some(x => tables[s][x][k])) return;
            offer(k, 2, { net: sumToA[b][a][k].net, mask: sumToA[b][a][k].mask, len: sumToA[b][a][k].len, metric: S.dist[b] + sumToA[b][a][k].metric, hops: S.hops[b], area: a });
          });
        });
      }
    });
    /* route par défaut externe : le meilleur ASBR (coût d'accès le plus faible) */
    let def = null;
    ids.forEach(A => {
      if (A === s || !O.defaultOriginating(W, R[A].d)) return;
      const r = reach(s, A); if (!r) return;
      if (!def || r.cost < def.cost) def = { cost: r.cost, hops: r.hops.slice(), asbr: A };
      else if (r.cost === def.cost) addHops(def.hops, r.hops);
    });
    const list = [];
    Object.keys(cand).forEach(k => {
      const c = cand[k];
      c.hops.forEach(h => list.push({ net: c.e.net, mask: c.e.mask, len: c.e.len, iface: h.iface, nh: h.ip, ad: 110, proto: 'ospf', metric: c.metric, rtype: c.rank === 1 ? 'O' : 'IA', area: c.e.area, viaDev: h.via }));
    });
    if (def && !cand['0.0.0.0/0']) def.hops.forEach(h => list.push({ net: '0.0.0.0', mask: '0.0.0.0', len: 0, iface: h.iface, nh: h.ip, ad: 110, proto: 'ospf', metric: 1, rtype: 'E2', area: 0, asbr: def.asbr, viaDev: h.via }));
    out[s] = list;
  });
  return out;
}

O.isAbr = function (W, d) { const R = O.routerOf(W, d); if (!R) return false; const a = []; Object.keys(R.ifs).forEach(n => { if (a.indexOf(R.ifs[n].area) < 0) a.push(R.ifs[n].area); }); return a.length > 1 && a.some(x => x === 0 || x === '0'); };

/* ------------------------------------------------------------------ état mis en cache + journalisation */
O.emit = function (W, devId, msg) {
  W.log(devId, 'syslog', { msg, sev: 5 });
  const d = W.dev[devId]; (d._rt.ospfOut = d._rt.ospfOut || []).push({ msg, t: W.nowOf(devId).getTime() });
};
function adjKey(id, n, rid) { return id + '|' + n + '|' + rid; }
function diffAndLog(W, prev, next) {
  const now = {}; for (const id of Object.keys(next.R)) for (const n of Object.keys(next.R[id].ifs)) next.R[id].ifs[n].nbrs.forEach(x => { if (x.state === 'FULL') now[adjKey(id, n, x.rid)] = { id, n, x }; });
  next.adj = now;
  /* doublons de router-id vus sur un segment : un message par (appareil, interface, voisin) */
  const dups = {};
  for (const id of Object.keys(next.R)) for (const n of Object.keys(next.R[id].ifs)) next.R[id].ifs[n].rejects.filter(x => x.why === 'dupid').forEach(x => { dups[id + '|' + n + '|' + x.ip] = { id, n, ip: x.ip, rid: next.R[id].rid }; });
  next.dups = dups;
  if (prev) Object.keys(dups).forEach(k => { if (!(prev.dups || {})[k]) O.emit(W, dups[k].id, '%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ' + dups[k].rid + ' from ' + dups[k].ip + ' on interface ' + dups[k].n); });
  const was = prev ? prev.adj : null;
  if (!was) { Object.keys(now).forEach(k => { next.since[k] = W.clock.elapsed - 600 - (parseInt(U.hash8(k).slice(0, 4), 16) % 86000); }); return; }
  next.since = Object.assign({}, prev.since);
  for (const k of Object.keys(now)) if (!was[k]) {
    next.since[k] = W.clock.elapsed;
    O.emit(W, now[k].id, '%OSPF-5-ADJCHG: Process ' + (W.dev[now[k].id].ospf.pid || 1) + ', Nbr ' + now[k].x.rid + ' on ' + now[k].n + ' from LOADING to FULL, Loading Done');
  }
  for (const k of Object.keys(was)) if (!now[k]) {
    delete next.since[k];
    const w = was[k]; const A = next.R[w.id];
    if (!A) continue;
    const mine = A.ifs[w.n]; const lnk = N.l3up(W, A.d).some(x => x.name === w.n);
    const why = (!lnk || !mine || mine.passive) ? 'Interface down or detached' : 'Dead timer expired';
    O.emit(W, w.id, '%OSPF-5-ADJCHG: Process ' + (A.d.ospf.pid || 1) + ', Nbr ' + w.x.rid + ' on ' + w.n + ' from FULL to DOWN, Neighbor Down: ' + why);
  }
}
O.state = function (W) {
  if (W._ospf && W._ospf.ver === W.ver) return W._ospf;
  if (W._ospfBusy) return W._ospf || { ver: -1, R: {}, routes: {}, adj: {}, since: {} };
  W._ospfBusy = true;
  try {
    const prev = W._ospf;
    const R = build(W);
    const st = { ver: W.ver, R, routes: {}, adj: {}, since: prev ? prev.since : {} };
    st.routes = allRoutes(W, R);
    diffAndLog(W, prev, st);
    W._ospf = st;
    return st;
  } finally { W._ospfBusy = false; }
};
/* Ancienneté d'une route : celle de l'adjacence par laquelle elle est apprise */
O.routeAge = function (W, d, r) {
  const s = O.state(W); const via = s.R[r.viaDev]; if (!via) return 0;
  const t = s.since[adjKey(d.id, r.iface, via.rid)];
  return Math.max(0, Math.round(W.clock.elapsed - (t === undefined ? W.clock.elapsed : t)));
};
/* Durée à l'affichage d'IOS : hh:mm:ss, puis 1d02h, puis 1w2d */
O.ageStr = function (sec) {
  const h = Math.floor(sec / 3600), dd = Math.floor(h / 24), w = Math.floor(dd / 7);
  if (w >= 1) return w + 'w' + (dd % 7) + 'd';
  if (dd >= 1) return dd + 'd' + U.pad2(h % 24) + 'h';
  return U.pad2(h) + ':' + U.pad2(Math.floor(sec / 60) % 60) + ':' + U.pad2(sec % 60);
};
O.routesOf = function (W, d) { if (!d.ospf) return []; const s = O.state(W); return s.routes[d.id] || []; };
O.routerOf = function (W, d) { return O.state(W).R[d.id] || null; };
O.neighbors = function (W, d) {
  const A = O.routerOf(W, d); if (!A) return [];
  const s = O.state(W); const out = [];
  for (const n of Object.keys(A.ifs)) A.ifs[n].nbrs.forEach(x => out.push(Object.assign({}, x, { since: s.since[adjKey(d.id, n, x.rid)] })));
  return out;
};
/* Surveillance des changements : le calcul est relancé à chaque mutation pour que les journaux soient datés juste. */
O.attach = function (W) {
  if (W._ospfAttached) return; W._ospfAttached = true;
  if (!Object.keys(W.dev).some(id => W.dev[id].ospf)) return;
  O.state(W);
  W.onChange(() => { O.state(W); });
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
