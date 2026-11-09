/* ============================================================================
   Moteur réseau : liaison (câbles, prises, VLAN/trunk), L3 (routes, ARP, NAT, ACL,
   pare-feu), DHCP, DNS client, joignabilité TCP/UDP/ICMP aller-retour.
   Les symptômes (timeout, refus, « hôte injoignable »…) sont DÉRIVÉS de l'état.
   Les spécificités par type d'appareil sont fournies par SIM.kinds[kind].
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const N = SIM.net = {};
const K = SIM.kinds = SIM.kinds || {};

/* ------------------------------------------------------------------ couche 1 */
N.powered = d => !d.phys || (d.phys.psu !== false && d.phys.strip !== false && d.phys.on !== false);
N.portObj = (d, port) => (d.ports && d.ports[port]) || (d.ifaces && d.ifaces[port]) || null;
N.isSwitch = d => d.kind === 'ios-sw' || d.kind === 'sw-dumb';

/* Pair de l'autre côté du câble : {dev, port} | null */
N.peerOf = function (W, d, port) {
  const p = N.portObj(d, port);
  if (!p || !p.cable || !p.cable.plugged || !p.cable.to) return null;
  const to = p.cable.to;
  if (to.startsWith('wall:')) {                       // câble de baie → prise murale → brassage
    const patch = W.walls[to.slice(5)];
    if (!patch) return null;
    const pp = W.parsePort(patch); const q = W.dev[pp.dev] && N.portObj(W.dev[pp.dev], pp.port);
    if (!q || !q.cable || !q.cable.plugged || q.cable.to !== 'patch:' + to.slice(5)) return null;
    return pp;
  }
  if (to.startsWith('patch:')) {                      // côté switch d'une prise brassée
    const id = to.slice(6);
    if (W.walls[id] !== d.id + ':' + port) return null;
    for (const k of Object.keys(W.dev)) {
      const dd = W.dev[k]; const ifs = dd.ifaces || {};
      for (const n of Object.keys(ifs)) { const c = ifs[n].cable; if (c && c.plugged && c.to === 'wall:' + id) return { dev: k, port: n }; }
    }
    return null;
  }
  const pp = W.parsePort(to);
  const dd = W.dev[pp.dev]; const q = dd && N.portObj(dd, pp.port);
  if (!q || !q.cable || !q.cable.plugged || q.cable.to !== d.id + ':' + port) return null;
  return pp;
};
/* Port « actif » : ni éteint administrativement, appareil alimenté */
N.portAdminUp = (d, port) => { const p = N.portObj(d, port); if (!p || p.adminDown || p.errdisabled || !N.powered(d)) return false; if (p.chan) { const po = d.ports['Port-channel' + p.chan.group]; if (po && po.adminDown) return false; } return true; };   // « shutdown » sur le Port-channel coupe ses membres
N.linkUp = function (W, d, port) {
  const lq = N.portObj(d, port);
  if (lq && lq.logical) return N.powered(d) && !lq.adminDown && !!SIM.l2 && SIM.l2.poUp(W, d, port);    // interface logique (Port-channel) : active si un membre est agrégé
  if (!N.portAdminUp(d, port)) return false;
  const pe = N.peerOf(W, d, port); if (!pe) return false;
  return N.portAdminUp(W.dev[pe.dev], pe.port);
};

/* ------------------------------------------------------------------ VLAN / liaison */
N.vlanActive = (sw, v) => sw.kind === 'sw-dumb' ? true : !!(sw.vlans && sw.vlans[v] && !sw.vlans[v].suspend);
N.portAllows = (p, v) => p.mode === 'trunk' && (p.allowed === 'all' || p.allowed === undefined || (Array.isArray(p.allowed) && p.allowed.indexOf(v) >= 0));
N.trunkVlanOf = (p, tag) => tag === 0 ? (p.native || 1) : tag;

/* Où se raccorde une interface L3 : {port, tag} | {sw, vlan} */
N.attachOf = function (d, ifn) {
  if (d.kind === 'ios-sw' && /^Vlan\d+$/i.test(ifn)) return { sw: true, vlan: +ifn.slice(4) };
  const i = d.ifaces && d.ifaces[ifn];
  if (i && i.encap) return { port: i.parent, tag: i.native ? 0 : i.encap };
  return { port: ifn, tag: 0 };
};

/* Équipements L3 joignables dans le domaine de diffusion de (d, ifn) */
N.l2Endpoints = function (W, d, ifn) {
  const L2 = SIM.l2;
  const res = []; const seen = new Set();
  const att = N.attachOf(d, ifn);
  const q = [];
  const arrive = (devId, port, tag) => {
    const k = devId + '|' + port + '|' + tag; if (seen.has(k)) return; seen.add(k);
    const X = W.dev[devId];
    if (N.isSwitch(X)) {
      if (!N.linkUp(W, X, port)) return;
      let v;
      if (X.kind === 'sw-dumb') { v = 1; } else {
        if (L2 && L2.suspended(W, X, port)) return;
        const p = L2 ? L2.eff(W, X, port) : X.ports[port];
        if (p.mode === 'trunk') { v = N.trunkVlanOf(p, tag); if (!N.portAllows(p, v)) return; }
        else { if (tag !== 0) return; v = p.vlan || 1; }
        if (!N.vlanActive(X, v)) return;
        if (L2 && !L2.fwd(W, X, port, v)) return;          // port bloqué par le Spanning Tree
      }
      flood(X, v, port);
    } else {
      // appareil L3 : quelle interface reçoit cette trame ?
      for (const n of Object.keys(X.ifaces || {})) {
        const i = X.ifaces[n];
        const a = N.attachOf(X, n);
        if (a.port === port && a.tag === tag && !(X.id === d.id && n === ifn)) res.push({ dev: X.id, iface: n });
      }
    }
  };
  const flood = (X, v, except) => {
    if (L2 && L2.storm(W, X, v)) return;                    // boucle sans blocage : tempête de diffusion, aucune trame ne passe
    if (X.kind === 'ios-sw' && X.svi && X.svi['Vlan' + v] && !(X.id === d.id && ('Vlan' + v) === ifn)) res.push({ dev: X.id, iface: 'Vlan' + v });
    for (const pn of Object.keys(X.ports)) {
      if (pn === except) continue;
      if (X.ports[pn].logical) continue;
      const p = L2 && X.kind === 'ios-sw' ? L2.eff(W, X, pn) : X.ports[pn];
      if (X.kind === 'sw-dumb') { const pe = N.peerOf(W, X, pn); if (pe && N.linkUp(W, X, pn)) arrive(pe.dev, pe.port, 0); continue; }
      if (!N.linkUp(W, X, pn)) continue;
      if (L2 && L2.suspended(W, X, pn)) continue;
      const pe = N.peerOf(W, X, pn);
      if (p.mode === 'trunk') { if (N.portAllows(p, v) && N.vlanActive(X, v) && (!L2 || L2.fwd(W, X, pn, v))) arrive(pe.dev, pe.port, v === (p.native || 1) ? 0 : v); }
      else if ((p.vlan || 1) === v && (!L2 || L2.fwd(W, X, pn, v))) arrive(pe.dev, pe.port, 0);
    }
  };
  if (att.sw) {
    if (!N.vlanActive(d, att.vlan)) return res;
    flood(d, att.vlan, null);
  } else {
    if (!N.linkUp(W, d, att.port)) return res;
    const pe = N.peerOf(W, d, att.port);
    arrive(pe.dev, pe.port, att.tag);
  }
  return res;
};

/* ------------------------------------------------------------------ couche 3 : configuration effective */
N.effCfg = function (d, ifn) {
  const i = d.ifaces[ifn];
  if (!i) return null;
  if (d.kind === 'win' || d.kind === 'linux' || d.kind === 'printer') {
    if (i.dhcp) {
      const dnsMan = i.dnsManual && i.dnsManual.length ? i.dnsManual : null;
      if (i._lease && !i._lease.conflict) return { ip: i._lease.ip, mask: i._lease.mask, gw: i._lease.gw || '', dns: dnsMan || i._lease.dns || [], suffix: i._lease.suffix || '', mode: 'dhcp', lease: i._lease, server: i._lease.server };
      if (i._apipa) return { ip: i._apipa, mask: '255.255.0.0', gw: '', dns: dnsMan || [], suffix: '', mode: 'apipa' };
      return { ip: '0.0.0.0', mask: '0.0.0.0', gw: '', dns: [], suffix: '', mode: 'released' };
    }
    return { ip: i.ip || '', mask: i.mask || '', gw: i.gw || '', dns: (i.dns || []).slice(), suffix: i.suffix || '', mode: 'static' };
  }
  if (d.kind === 'ios-sw') return null;
  return { ip: i.ip || '', mask: i.mask || '', gw: '', dns: [], suffix: '', mode: 'static' };
};

/* Liste des interfaces L3 d'un appareil : [{name, ip, mask, up, vlan?}] */
N.l3 = function (W, d) {
  const out = [];
  if (d.kind === 'isp') {
    for (const n of Object.keys(d.ifaces)) { const i = d.ifaces[n]; out.push({ name: n, ip: i.ip, mask: i.mask, up: N.linkUp(W, d, n) }); }
    return out;
  }
  if (d.kind === 'ios-sw') {
    for (const n of Object.keys(d.svi || {})) {
      const s = d.svi[n]; const v = +n.slice(4);
      const up = !s.shut && N.vlanActive(d, v) && N.svlanHasActivePort(W, d, v);
      out.push({ name: n, ip: s.ip || '', mask: s.mask || '', up, vlan: v });
    }
    return out;
  }
  for (const n of Object.keys(d.ifaces || {})) {
    const i = d.ifaces[n]; const cfg = N.effCfg(d, n);
    if (!cfg) continue;
    let up;
    if (i.encap) { const par = d.ifaces[i.parent]; up = !!par && !i.adminDown && N.linkUp(W, d, i.parent); }
    else if (n === 'enc0' || i.virtual) up = !i.adminDown;
    else up = N.linkUp(W, d, n);
    if (d.kind === 'linux' && d._rt && d._rt.emergency) up = false;
    out.push({ name: n, ip: cfg.ip, mask: cfg.mask, up, cfg, encap: i.encap });
  }
  return out;
};
N.svlanHasActivePort = function (W, sw, v) {
  for (const pn of Object.keys(sw.ports)) {
    const p = sw.ports[pn]; if (!N.linkUp(W, sw, pn)) continue;
    if (p.mode === 'trunk' ? N.portAllows(p, v) : (p.vlan || 1) === v) return true;
  }
  return false;
};
N.l3up = (W, d) => N.l3(W, d).filter(x => x.up && x.ip && x.ip !== '0.0.0.0' && x.mask);
N.ownsIp = (W, d, ip) => {
  if (d.kind === 'isp') { if (d.pub && d.pub[ip]) return { name: 'pub', pub: true }; }
  return N.l3up(W, d).find(x => x.ip === ip) || null;
};
N.findOwner = function (W, ip) {
  for (const id of Object.keys(W.dev)) { const d = W.dev[id]; const o = N.ownsIp(W, d, ip); if (o) return { dev: d, iface: o.name }; }
  return null;
};

/* ------------------------------------------------------------------ routage */
N.routes = function (W, d) {
  const out = []; const ifs = N.l3up(W, d);
  for (const x of ifs) out.push({ net: U.netAddr(x.ip, x.mask), mask: x.mask, len: U.mask2len(x.mask), iface: x.name, nh: null, ad: 0 });
  // passerelle par défaut des hôtes
  if (d.kind === 'win' || d.kind === 'linux' || d.kind === 'printer') {
    for (const x of ifs) { const gw = x.cfg && x.cfg.gw; if (gw && U.inNet(gw, x.ip, x.mask)) out.push({ net: '0.0.0.0', mask: '0.0.0.0', len: 0, iface: x.name, nh: gw, ad: 1, def: true }); }
  }
  if (d.kind === 'pf') {
    for (const gw of d.gateways || []) {
      if (!gw.default) continue;
      const on = ifs.find(x => x.name === gw.iface && U.inNet(gw.ip, x.ip, x.mask));
      if (on) out.push({ net: '0.0.0.0', mask: '0.0.0.0', len: 0, iface: on.name, nh: gw.ip, ad: 1, def: true });
    }
  }
  if (d._rt && d._rt.vpn && d._rt.vpn.up) for (const r of d._rt.vpn.routes) out.push(r);
  if (d.kind === 'ios-sw' && !d.ipRouting && d.defaultGateway) {
    const on = ifs.find(x => U.inNet(d.defaultGateway, x.ip, x.mask));
    if (on) out.push({ net: '0.0.0.0', mask: '0.0.0.0', len: 0, iface: on.name, nh: d.defaultGateway, ad: 1, def: true });
  }
  for (const r of (d.routes || [])) {
    if (r.disabled) continue;
    if (r.nh) {                                       // le prochain saut doit être joignable via une interface locale UP
      const on = ifs.find(x => U.inNet(r.nh, x.ip, x.mask));
      if (!on) continue;
      out.push({ net: r.net, mask: r.mask, len: U.mask2len(r.mask), iface: on.name, nh: r.nh, ad: r.ad || 1 });
    } else if (r.iface) { const on = ifs.find(x => x.name === r.iface); if (on) out.push({ net: r.net, mask: r.mask, len: U.mask2len(r.mask), iface: on.name, nh: null, ad: r.ad || 1 }); }
  }
  if (d.ospf && SIM.ospf) for (const r of SIM.ospf.routesOf(W, d)) out.push(r);   // routes dynamiques OSPF (AD 110) dérivées des voisinages
  return out;
};
N.route = function (W, d, dip) {
  let best = null;
  for (const r of N.routes(W, d)) {
    if (!U.inNet(dip, r.net, r.mask)) continue;
    if (!best || r.len > best.len || (r.len === best.len && r.ad < best.ad)) best = r;
  }
  return best;
};

/* ------------------------------------------------------------------ trace aller-retour */
/* pkt : {proto:'icmp'|'tcp'|'udp', sport, dport, reply?:bool, ack?:bool}
   Retour : {ok, hops:[{dev,inIp,inIf}], fail?:{kind,at,dir,iface}, icmp?:{from,kind}, deliver?:{fw,svc}, dstDev, dstIf, sip, dip} */
N.trace = function (W, srcId, dstIp, pkt, opts) {
  opts = opts || {};
  const fwd = N.walk(W, srcId, dstIp, pkt, opts);
  if (!fwd.ok) return fwd;
  // aller réussi : vérifier le retour (réponse SYN-ACK/RST/echo-reply/UDP reply)
  if (opts.noReturn) return fwd;
  if (fwd.dstDev === srcId && fwd.hops.length === 1) return fwd;   // boucle locale : pas de chemin retour
  const dst = W.dev[fwd.dstDev];
  if (fwd.deliver && fwd.deliver.fw !== 'allow' && fwd.deliver.fw !== 'reject') return fwd;
  const rpkt = { proto: pkt.proto, sport: fwd.dportAtDst !== undefined ? fwd.dportAtDst : pkt.dport, dport: pkt.sport, reply: true, ack: true, icmpType: pkt.proto === 'icmp' ? 0 : undefined };
  const rev = N.walk(W, fwd.dstDev, fwd.sipAtDst, rpkt, { reverse: true, undo: fwd.xlat, noDeliverCheck: true, maxHops: opts.maxHops, srcIp: fwd.dip, dry: opts.dry, snort: opts.snort });
  if (!rev.ok) {
    return Object.assign({}, fwd, { ok: false, fail: Object.assign({}, rev.fail, { dir: 'return' }), icmp: null, rev });
  }
  fwd.rev = rev;
  return fwd;
};

N.walk = function (W, srcId, dstIp, pkt, opts) {
  opts = opts || {};
  const res = { ok: false, hops: [], xlat: [], dip: dstIp };
  const src = W.d(srcId);
  const maxHops = opts.maxHops || 24;
  const st = { sip: null, dip: dstIp, xlat: [], dport: undefined };
  const ep = () => (st.dport !== undefined ? Object.assign({}, pkt, { dport: st.dport }) : pkt);
  // interface source
  let cur = src, inIf = null;
  let rt = null;
  const srcRoute = N.route(W, src, st.dip);
  const own = N.ownsIp(W, src, st.dip);
  if (own) {                                           // boucle locale
    res.ok = true; res.dstDev = src.id; res.dstIf = own.name; res.sipAtDst = st.dip; res.deliver = deliverTo(W, src, own.name, pkt, st, opts); res.dportAtDst = pkt.dport; res.sip = st.dip; res.xlat = st.xlat;
    res.hops.push({ dev: src.id, inIp: st.dip });
    /* le trafic vers une adresse de la machine elle-même passe par la boucle locale : il n'est pas filtré par le pare-feu de l'hôte (Windows : règles entrantes sans effet ; Linux : « -i lo -j ACCEPT ») */
    if (res.deliver.fw !== 'allow') res.deliver = Object.assign({}, res.deliver, { fw: 'allow' });
    return res;
  }
  if (!srcRoute) { const any = N.l3up(W, src).length; res.fail = { kind: any ? 'noroute' : 'nolink', at: src.id, src: true }; res.icmp = any ? { from: N.l3up(W, src)[0].ip, kind: 'host' } : null; return res; }
  const srcL3 = N.l3(W, src).find(x => x.name === srcRoute.iface);
  st.sip = (opts.srcIp) || srcL3.ip;
  res.sip = st.sip;
  if (!srcL3.ip || srcL3.ip === '0.0.0.0') { res.fail = { kind: 'noip', at: src.id }; return res; }
  const hook = d => K[d.kind] || {};

  for (let n = 0; n < maxHops; n++) {
    const node = cur;
    // --- livraison locale ?
    const o = N.ownsIp(W, node, st.dip);
    if (o && n > 0) {
      res.dstDev = node.id; res.dstIf = o.name; res.sipAtDst = st.sip; res.xlat = st.xlat; res.dip = st.dip; res.dportAtDst = st.dport !== undefined ? st.dport : pkt.dport;
      res.deliver = opts.noDeliverCheck ? { fw: 'allow', svc: 'open' } : deliverTo(W, node, o.name, ep(), st, opts);
      if (res.deliver.fw === 'drop') { res.fail = { kind: 'fw', at: node.id, iface: inIf }; return res; }
      res.ok = true; return res;
    }
    // --- routage
    let tunnel = null;
    if (hook(node).preRoute) tunnel = hook(node).preRoute(W, node, inIf, ep(), st, opts);
    let rt2, nhIp, outIf;
    if (tunnel && tunnel.fail) { res.fail = { kind: tunnel.fail, at: node.id }; return res; }
    if (tunnel && tunnel.to) {                         // sortie par tunnel IPsec
      res.hops.push({ dev: node.id, inIp: inIf ? (N.l3(W, node).find(x => x.name === inIf) || {}).ip : st.sip, inIf, via: 'ipsec' });
      cur = W.d(tunnel.to.dev); inIf = tunnel.to.iface;
      const v = hook(cur).ingress ? hook(cur).ingress(W, cur, inIf, ep(), st, opts) : null;
      if (v && v.drop) { res.fail = { kind: v.drop, at: cur.id, iface: inIf, detail: v.detail }; res.icmp = v.icmp || null; return res; }
      continue;
    }
    rt2 = N.route(W, node, st.dip);
    if (!rt2) { res.fail = { kind: 'noroute', at: node.id, iface: inIf }; if (n > 0) res.icmp = { from: (N.l3(W, node).find(x => x.name === inIf) || {}).ip, kind: 'net' }; return res; }
    outIf = rt2.iface; nhIp = rt2.nh || st.dip;
    // --- sortie (NAT/ACL out)
    if (hook(node).egress) {
      const v = hook(node).egress(W, node, inIf, outIf, ep(), st, opts);
      if (v && v.drop) { res.fail = { kind: v.drop, at: node.id, iface: outIf, detail: v.detail }; res.icmp = v.icmp ? { from: (N.l3(W, node).find(x => x.name === inIf) || {}).ip, kind: v.icmp } : null; return res; }
    }
    // --- ARP / voisin
    const ends = N.l2Endpoints(W, node, outIf);
    let tgt = null;
    for (const e of ends) { const dd = W.dev[e.dev]; const l = N.l3up(W, dd).find(x => x.name === e.iface && x.ip === nhIp); if (l) { tgt = e; break; } }
    if (!tgt) {
      // l'ISP porte l'ensemble des IP publiques derrière son interface
      for (const e of ends) { const dd = W.dev[e.dev]; if (dd.kind === 'isp' && dd.pub && dd.pub[nhIp]) { tgt = e; break; } }
    }
    if (!tgt) {
      const fromIp = n === 0 ? srcL3.ip : (N.l3(W, node).find(x => x.name === inIf) || N.l3(W, node).find(x => x.name === outIf) || {}).ip;
      res.fail = { kind: 'arp', at: node.id, iface: outIf, nh: nhIp };
      res.icmp = { from: fromIp, kind: 'host' };
      return res;
    }
    res.hops.push({ dev: node.id, inIp: n === 0 ? srcL3.ip : (N.l3(W, node).find(x => x.name === inIf) || {}).ip, inIf, outIf });
    // --- arrivée sur le saut suivant
    cur = W.d(tgt.dev); inIf = tgt.iface;
    const h2 = hook(cur);
    if (h2.ingress) {
      const v = h2.ingress(W, cur, inIf, ep(), st, opts);
      if (v && v.drop) { res.fail = { kind: v.drop, at: cur.id, iface: inIf, detail: v.detail }; res.icmp = v.icmp ? { from: (N.l3(W, cur).find(x => x.name === inIf) || {}).ip, kind: v.icmp } : null; return res; }
    }
    // démontage NAT sur le chemin retour (après filtrage d'entrée, avant décision de livraison)
    if (opts.undo) for (const x of opts.undo) {
      if (x.dev !== cur.id) continue;
      if (x.kind === 'snat' && st.dip === x.xl) st.dip = x.orig;
      if (x.kind === 'dnat' && st.sip === x.xl) st.sip = x.orig;
    }
    // l'hôte reçoit mais ne retransmet pas s'il n'est pas destinataire
    const owns = N.ownsIp(W, cur, st.dip);
    const fwds = typeof h2.forwards === 'function' ? h2.forwards(W, cur) : h2.forwards;
    if (!owns && !fwds) {
      res.fail = { kind: 'nofwd', at: cur.id, iface: inIf }; return res;
    }
    if (!owns && fwds && n === maxHops - 1) { res.fail = { kind: 'ttl', at: cur.id }; return res; }
    if (owns) {
      res.hops.push({ dev: cur.id, inIp: (N.l3(W, cur).find(x => x.name === inIf) || {}).ip, inIf, final: true });
      res.dstDev = cur.id; res.dstIf = owns.name; res.sipAtDst = st.sip; res.xlat = st.xlat; res.dip = st.dip; res.dportAtDst = st.dport !== undefined ? st.dport : pkt.dport;
      res.deliver = opts.noDeliverCheck ? { fw: 'allow', svc: 'open' } : deliverTo(W, cur, owns.name, ep(), st, opts);
      if (res.deliver.fw === 'drop') { res.fail = { kind: 'fw', at: cur.id, iface: inIf }; return res; }
      res.ok = true; return res;
    }
  }
  res.fail = { kind: 'ttl', at: cur.id };
  return res;
};

/* Livraison à l'appareil de destination : pare-feu local puis écoute */
function deliverTo(W, d, ifn, pkt, st, opts) {
  const h = K[d.kind] || {};
  let fw = 'allow';
  if (h.fwIn) fw = h.fwIn(W, d, ifn, pkt, st, opts) || 'allow';
  let svc = 'open';
  if (pkt.proto === 'tcp' || pkt.proto === 'udp') svc = h.listening && h.listening(W, d, pkt.proto, pkt.dport, ifn, st) ? 'open' : 'closed';
  if (pkt.proto === 'icmp' && h.icmpReply && !h.icmpReply(W, d, ifn)) svc = 'closed';
  return { fw, svc };
}

/* ------------------------------------------------------------------ connexions de haut niveau */
/* connect : état d'une connexion TCP/UDP depuis srcId vers ip:port
   Retour : {state:'open'|'refused'|'timeout'|'unreach'|'nolink'|'noroute', icmp?, trace} */
N.connect = function (W, srcId, dstIp, proto, port, opts) {
  opts = opts || {};
  const pkt = { proto, sport: 49152 + (opts.sport || 3), dport: port };
  const t = N.trace(W, srcId, dstIp, pkt, opts);
  if (!t.ok) {
    if (t.fail && t.fail.dir === 'return') return { state: 'timeout', trace: t };
    if (t.fail && t.fail.kind === 'reject') return { state: 'refused', trace: t, rejectedAt: t.fail.at };
    if (t.fail.kind === 'nolink') return { state: 'nolink', trace: t };
    if (t.icmp) return { state: 'unreach', icmp: t.icmp, trace: t };
    if (t.fail.kind === 'noroute' && t.fail.src) return { state: 'noroute', trace: t };
    return { state: 'timeout', trace: t };
  }
  if (t.deliver.fw === 'reject') return { state: 'refused', trace: t };
  if (t.deliver.svc === 'closed') return { state: proto === 'udp' ? 'refused' : 'refused', trace: t };
  return { state: 'open', trace: t, dstDev: t.dstDev, dstIf: t.dstIf };
};
N.ping = function (W, srcId, dstIp, opts) {
  const t = N.trace(W, srcId, dstIp, { proto: 'icmp', icmpType: 8 }, opts || {});
  if (t.ok && t.deliver.svc === 'closed') return { ok: false, kind: 'timeout', trace: t };
  if (t.ok) return { ok: true, trace: t };
  if (t.fail && t.fail.dir === 'return') return { ok: false, kind: 'timeout', trace: t };
  if (t.fail.kind === 'reject') return { ok: false, kind: 'admin', from: t.fail.at, trace: t };
  if (t.fail.kind === 'nolink') return { ok: false, kind: 'general', trace: t };
  if (t.fail.kind === 'noip') return { ok: false, kind: 'general', trace: t };
  if (t.icmp) return { ok: false, kind: t.icmp.kind === 'net' ? 'net' : t.icmp.kind === 'admin' ? 'admin' : 'host', from: t.icmp.from, trace: t };
  if (t.fail.kind === 'noroute') return { ok: false, kind: 'host', from: (N.l3up(W, W.d(srcId))[0] || {}).ip, trace: t };
  return { ok: false, kind: 'timeout', trace: t };
};

/* ------------------------------------------------------------------ DHCP (client) */
N.apipaOf = d => { const h = U.hash8(d.id).match(/../g).map(x => parseInt(x, 16)); return '169.254.' + (1 + (h[0] % 254)) + '.' + (1 + (h[1] % 254)); };

/* Cherche un serveur DHCP dans le domaine de diffusion (ou via relais) et renvoie une offre */
N.dhcpDiscover = function (W, hostId, ifn) {
  const d = W.d(hostId); const ends = N.l2Endpoints(W, d, ifn);
  const mac = d.ifaces[ifn].mac || U.mac(hostId + ifn);
  const trace = [];
  for (const e of ends) {
    const sd = W.dev[e.dev]; const sk = K[sd.kind] || {};
    // serveur direct sur le même domaine
    if (sk.dhcpOffer) {
      const o = sk.dhcpOffer(W, sd, { via: e.iface, giaddr: null, mac, clientId: hostId });
      trace.push({ server: sd.id, direct: true, result: o ? 'offer' : 'none' });
      if (o && !o.error) return Object.assign({ via: sd.id }, o);
    }
    // relais (ip helper-address)
    const ic = sd.ifaces && sd.ifaces[e.iface];
    const helpers = (ic && ic.helpers) || (sd.svi && sd.svi[e.iface] && sd.svi[e.iface].helpers) || [];
    if (helpers.length) {
      const l3 = N.l3(W, sd).find(x => x.name === e.iface);
      for (const h of helpers) {
        const c = N.connect(W, sd.id, h, 'udp', 67, { srcIp: l3.ip, noReturn: false });
        trace.push({ relay: sd.id, helper: h, result: c.state });
        if (c.state === 'open' || (c.state === 'refused' && false)) {
          const srv = W.dev[c.dstDev]; const hk = K[srv.kind] || {};
          if (hk.dhcpOffer) {
            const o = hk.dhcpOffer(W, srv, { via: c.dstIf, giaddr: l3.ip, mac, clientId: hostId });
            if (o && !o.error) return Object.assign({ via: srv.id, relay: sd.id }, o);
          }
        }
      }
    }
  }
  return { none: true, trace };
};

/* Renouvellement / acquisition : applique le résultat au client. Retourne le bail ou null */
N.dhcpRenew = function (W, hostId, ifn) {
  const d = W.d(hostId); const i = d.ifaces[ifn];
  if (!N.linkUp(W, d, ifn)) return { ok: false, reason: 'nolink' };
  const r = N.dhcpDiscover(W, hostId, ifn);
  if (r.none) { i._lease = null; i._apipa = N.apipaOf(d); return { ok: false, reason: 'noserver', trace: r.trace }; }
  // détection de conflit d'adresse : un autre équipement du domaine utilise déjà l'IP offerte
  const ends = N.l2Endpoints(W, d, ifn);
  for (const e of ends) {
    const dd = W.dev[e.dev]; const l = N.l3up(W, dd).find(x => x.name === e.iface);
    if (l && l.ip === r.ip) { i._lease = { ip: r.ip, mask: r.mask, gw: r.gw, dns: r.dns, suffix: r.suffix, server: r.serverIp, conflict: true, t: W.clock.elapsed }; i._apipa = N.apipaOf(d); return { ok: false, reason: 'conflict', ip: r.ip, lease: i._lease }; }
  }
  i._apipa = null;
  i._lease = { ip: r.ip, mask: r.mask, gw: r.gw, dns: r.dns || [], suffix: r.suffix || '', server: r.serverIp, t: W.clock.elapsed, leaseSec: r.leaseSec || 691200, via: r.via, relay: r.relay };
  if (K[W.dev[r.via].kind] && K[W.dev[r.via].kind].dhcpCommit) K[W.dev[r.via].kind].dhcpCommit(W, W.dev[r.via], r, d, ifn);
  return { ok: true, lease: i._lease };
};
N.dhcpRelease = function (W, hostId, ifn) {
  const d = W.d(hostId); const i = d.ifaces[ifn]; const old = i._lease;
  if (old && old.via && K[W.dev[old.via].kind] && K[W.dev[old.via].kind].dhcpFree) K[W.dev[old.via].kind].dhcpFree(W, W.dev[old.via], d, ifn, old);
  i._lease = null; i._apipa = null;
};

/* ------------------------------------------------------------------ DNS (client) */
/* Requête DNS depuis srcId vers serverIp. Retour {state, rcode, answers[]}
   state : 'ok' | 'timeout' | 'refused-port' (ICMP port unreachable) | 'nolink' */
N.dnsQuery = function (W, srcId, serverIp, qname, qtype) {
  const c = N.connect(W, srcId, serverIp, 'udp', 53, {});
  if (c.state === 'nolink' || c.state === 'noroute') return { state: 'nolink' };
  if (c.state === 'timeout' || c.state === 'unreach') return { state: 'timeout' };
  if (c.state === 'refused') return { state: 'refused-port' };
  const sd = W.d(c.dstDev); const h = K[sd.kind] || {};
  if (!h.dnsAnswer) return { state: 'timeout' };
  const a = h.dnsAnswer(W, sd, c.dstIf, { name: qname.toLowerCase().replace(/\.$/, ''), type: qtype || 'A', from: c.trace.sipAtDst, via: srcId });
  return Object.assign({ state: 'ok', server: sd.id, serverIp }, a);
};

/* Suffixes de recherche effectifs du client */
N.searchList = function (W, d) {
  if (d.kind === 'linux') { const f = SIM.lx && SIM.lx.readFile(d, '/etc/resolv.conf'); const out = []; (f || '').split('\n').forEach(l => { const m = l.match(/^\s*(search|domain)\s+(.+)$/); if (m) m[2].trim().split(/\s+/).forEach(x => out.push(x)); }); return out; }
  const out = [];
  for (const n of Object.keys(d.ifaces)) { const c = N.effCfg(d, n); if (c && c.suffix) out.push(c.suffix); }
  if (d.win && d.win.domain) out.unshift(d.win.domain);
  return U.uniq(out);
};
N.dnsServersOf = function (W, d) {
  if (d.kind === 'linux') { const f = SIM.lx && SIM.lx.readFile(d, '/etc/resolv.conf'); const out = []; (f || '').split('\n').forEach(l => { const m = l.match(/^\s*nameserver\s+(\S+)/); if (m) out.push(m[1]); }); return out; }
  const out = [];
  for (const n of Object.keys(d.ifaces)) { const c = N.effCfg(d, n); if (c && c.dns) c.dns.forEach(x => out.push(x)); }
  return U.uniq(out);
};
N.hostsLookup = function (d, name) {
  let list = d.hostsFile || [];
  if (d.kind === 'linux' && SIM.lx) { list = []; (SIM.lx.readFile(d, '/etc/hosts') || '').split('\n').forEach(l => { const m = l.replace(/#.*/, '').trim().split(/\s+/); if (m.length >= 2 && U.isIP(m[0])) m.slice(1).forEach(n => list.push({ ip: m[0], name: n })); }); }
  const h = list.find(x => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.ip : null;
};
/* Résolution complète côté client. Retour {ok, ip, ips, err, server, fqdn, cached} */
N.resolve = function (W, hostId, name, opts) {
  opts = opts || {}; const d = W.d(hostId);
  name = name.replace(/\.$/, '');
  if (U.isIP(name)) return { ok: true, ip: name, ips: [name], fqdn: name };
  if (name.toLowerCase() === 'localhost') return { ok: true, ip: '127.0.0.1', ips: ['127.0.0.1'], fqdn: 'localhost' };
  const hf = N.hostsLookup(d, name); if (hf) return { ok: true, ip: hf, ips: [hf], fqdn: name, viaHosts: true };
  if (name.toLowerCase() === (d.name || '').toLowerCase()) { const l = N.l3up(W, d)[0]; if (l) return { ok: true, ip: l.ip, ips: [l.ip], fqdn: name, self: true }; }
  const cands = name.indexOf('.') >= 0 ? [name] : [];
  if (name.indexOf('.') < 0) { N.searchList(W, d).forEach(s => cands.push(name + '.' + s)); cands.push(name); }
  const servers = N.dnsServersOf(W, d);
  if (!opts.noCache && d._rt.dnsCache) {
    for (const c of cands) { const e = d._rt.dnsCache[c.toLowerCase()]; if (e) return { ok: true, ip: e.ip, ips: [e.ip], fqdn: c, cached: true }; }
  }
  if (!servers.length) return { ok: false, err: 'noserver' };
  let lastErr = 'timeout', lastNx = null;
  for (const c of cands) {
    let timeouts = 0, answered = false;
    for (const s of servers) {
      const r = N.dnsQuery(W, hostId, s, c, opts.type || 'A');
      if (r.state === 'ok') {
        if (r.rcode === 'NOERROR' && r.answers && r.answers.length) {
          const ips = r.answers.filter(a => a.type === 'A').map(a => a.data);
          if (!opts.noCache) { d._rt.dnsCache = d._rt.dnsCache || {}; if (ips[0]) d._rt.dnsCache[c.toLowerCase()] = { ip: ips[0], t: W.clock.elapsed }; }
          return { ok: true, ip: ips[0], ips, fqdn: c, server: s, answers: r.answers, cname: r.cname };
        }
        if (r.rcode === 'NXDOMAIN') { lastNx = { server: s, fqdn: c }; answered = true; break; }
        if (r.rcode === 'NOERROR') { answered = true; lastNx = lastNx || { server: s, fqdn: c, nodata: true }; break; }
        lastErr = r.rcode === 'REFUSED' ? 'refused' : 'servfail'; continue;
      }
      timeouts++; lastErr = r.state === 'refused-port' ? 'refused-port' : 'timeout';
    }
  }
  if (lastNx) return { ok: false, err: 'nxdomain', server: lastNx.server, fqdn: lastNx.fqdn };
  return { ok: false, err: lastErr, server: servers[0] };
};

/* ------------------------------------------------------------------ utilitaires de diagnostic */
N.hostIps = (W, d) => N.l3up(W, d).map(x => x.ip);
N.describeFail = function (t) {
  if (t.ok) return 'ok';
  const f = t.fail || {}; return f.kind + '@' + f.at + (f.dir ? '(' + f.dir + ')' : '') + (f.detail ? ':' + f.detail : '');
};

})(typeof globalThis !== 'undefined' ? globalThis : window);
