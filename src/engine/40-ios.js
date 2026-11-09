/* ============================================================================
   Cisco IOS — sémantique : ACL (avec compteurs), NAT/PAT, DHCP, SSH, ROAS/SVI.
   La configuration est une STRUCTURE ; les sorties « show » sont générées par l'émulateur CLI.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;
const IOS = SIM.ios = {};

/* ------------------------------------------------------------------ ACL */
const addrMatch = (a, ip) => !a || a.t === 'any' || (a.t === 'host' ? a.ip === ip : U.wildMatch(ip, a.ip, a.wild));
const portMatch = (p, v) => {
  if (!p) return true; if (v === undefined) return false;
  switch (p.op) { case 'eq': return v === p.v; case 'neq': return v !== p.v; case 'gt': return v > p.v; case 'lt': return v < p.v; case 'range': return v >= p.v && v <= p.v2; }
  return false;
};
/* Retourne {action:'permit'|'deny', idx, entry} ; idx = -1 pour le refus implicite final */
IOS.aclEval = function (d, name, pkt, sip, dip) {
  const acl = d.acls && d.acls[name];
  if (!acl) return { action: 'permit', idx: -2, missing: true };       // ACL référencée mais non définie : IOS laisse passer
  const L = acl.entries;
  for (let i = 0; i < L.length; i++) {
    const e = L[i];
    if (acl.type === 'standard') { if (!addrMatch(e.s, sip)) continue; }
    else {
      const proto = e.p;
      if (proto !== 'ip') {
        if (proto !== pkt.proto) continue;
        if (proto === 'icmp' && e.it !== undefined && e.it !== null) { const t = pkt.icmpType === undefined ? 8 : pkt.icmpType; if (t !== e.it) continue; }
        if (proto === 'tcp' || proto === 'udp') {
          if (!portMatch(e.sp, pkt.sport) || !portMatch(e.dp, pkt.dport)) continue;
          if (e.est && !(pkt.proto === 'tcp' && pkt.ack)) continue;
        }
      }
      if (!addrMatch(e.s, sip) || !addrMatch(e.d, dip)) continue;
    }
    e._hits = (e._hits || 0) + 1;
    return { action: e.a, idx: i, entry: e };
  }
  return { action: 'deny', idx: -1 };
};
IOS.ifaceOf = (d, ifn) => d.kind === 'ios-sw' ? (d.svi && d.svi[ifn]) : (d.ifaces && d.ifaces[ifn]);

/* ------------------------------------------------------------------ NAT */
IOS.natKey = (proto, il, ig, ol, og) => [proto, il, ig, ol, og].join('|');
IOS.natRecord = function (W, d, proto, insideLocal, insideGlobal, outLocal, outGlobal, sport, dport) {
  const t = d._rt.nat = d._rt.nat || { tr: [] };
  const k = IOS.natKey(proto, insideLocal, insideGlobal, outLocal, outGlobal);
  if (!t.tr.some(x => x.k === k)) t.tr.push({ k, proto, il: insideLocal, ig: insideGlobal, ol: outLocal, og: outGlobal, sport, dport, t: W.clock.elapsed });
};
IOS.poolPick = function (pool, sip) {
  if (!pool) return null; const n = U.ip2n(pool.start); const e = U.ip2n(pool.end); const pick = n + (U.ip2n(sip) % (e - n + 1)); return U.n2ip(pick);
};
IOS.natSide = (d, ifn) => (IOS.ifaceOf(d, ifn) || {}).natSide || null;

/* ------------------------------------------------------------------ hooks */
function isRoutingDevice(d) { return d.kind === 'ios-rt' || d.ipRouting; }
const iosHooks = {
  forwards: (W, d) => isRoutingDevice(d),
  ingress: (W, d, ifn, pkt, st) => {
    const i = IOS.ifaceOf(d, ifn); if (!i) return null;
    if (i.aclIn) {
      const r = IOS.aclEval(d, i.aclIn, pkt, st.sip, st.dip);
      if (r.action === 'deny') return { drop: 'acl', icmp: 'admin', detail: 'ACL ' + i.aclIn + ' in ' + ifn + (r.idx >= 0 ? ' (ligne ' + (r.idx + 1) + ')' : ' (refus implicite)') };
    }
    /* NAT statique outside → inside : appliqué après l'ACL d'entrée, avant le routage / la décision de livraison */
    if (d.nat && i.natSide === 'outside' && !pkt.reply) {
      for (const r of d.nat.rules || []) {
        if (r.type !== 'static' || st.dip !== r.global) continue;
        if (r.proto && (r.proto !== pkt.proto || (r.gport && r.gport !== (st.dport !== undefined ? st.dport : pkt.dport)))) continue;
        const orig = st.dip; st.dip = r.local; if (r.lport) st.dport = r.lport;
        st.xlat.push({ dev: d.id, kind: 'dnat', orig, xl: r.local });
        IOS.natRecord(W, d, pkt.proto === 'icmp' ? 'icmp' : pkt.proto, r.local, r.global, st.sip, st.sip, undefined, undefined);
        break;
      }
    }
    return null;
  },
  egress: (W, d, inIf, outIf, pkt, st) => {
    const o = IOS.ifaceOf(d, outIf);
    // NAT inside → outside (après routage)
    if (inIf !== null && d.nat && IOS.natSide(d, inIf) === 'inside' && o && o.natSide === 'outside') {
      let done = false;
      for (const r of d.nat.rules || []) {
        if (r.type === 'static' && r.local === st.sip && (!r.proto || (r.proto === pkt.proto && (!r.lport || r.lport === pkt.sport)))) {
          const orig = st.sip; st.sip = r.global; st.xlat.push({ dev: d.id, kind: 'snat', orig, xl: r.global }); IOS.natRecord(W, d, pkt.proto, orig, r.global, st.dip, st.dip); done = true; break;
        }
        if (r.type === 'dynamic') {
          const m = IOS.aclEval(d, r.acl, pkt, st.sip, st.dip);
          if (m.action !== 'permit') continue;
          let xl;
          if (r.pool) xl = IOS.poolPick((d.nat.pools || {})[r.pool], st.sip);
          else { const l = N.l3(W, d).find(x => x.name === (r.iface || outIf)); xl = l && l.ip; }
          if (!xl) continue;
          if (r.iface && r.iface !== outIf && !r.pool) continue;       // la règle « interface X overload » ne s'applique qu'à la sortie X
          const orig = st.sip; st.sip = xl; st.xlat.push({ dev: d.id, kind: 'snat', orig, xl }); IOS.natRecord(W, d, pkt.proto, orig, xl, st.dip, st.dip, pkt.sport, pkt.dport); done = true; break;
        }
      }
    }
    // ACL sortante (jamais sur le trafic émis par le routeur lui-même)
    if (inIf !== null && o && o.aclOut) {
      const r = IOS.aclEval(d, o.aclOut, pkt, st.sip, st.dip);
      if (r.action === 'deny') return { drop: 'acl', icmp: 'admin', detail: 'ACL ' + o.aclOut + ' out ' + outIf + (r.idx >= 0 ? ' (ligne ' + (r.idx + 1) + ')' : ' (refus implicite)') };
    }
    return null;
  },
  fwIn: () => 'allow',
  icmpReply: () => true,
  listening: (W, d, proto, port, ifn) => {
    if (proto !== 'tcp') return false;
    const v = (d.lines && d.lines.vty) || {};
    const tr = v.transport || [];
    if (port === 22) return (tr.indexOf('ssh') >= 0 || tr.indexOf('all') >= 0) && IOS.sshReady(d).ok;
    if (port === 23) return tr.indexOf('telnet') >= 0 || tr.indexOf('all') >= 0;
    return false;
  },
  dhcpOffer: (W, d, req) => IOS.dhcpOffer(W, d, req)
};
K['ios-rt'] = iosHooks; K['ios-sw'] = iosHooks;

/* Session SSH possible ? (le port TCP/22 ouvert ne suffit pas : clé RSA, version, utilisateur local) */
IOS.sshReady = function (d) {
  const s = d.ssh || {};
  if (!s.rsa) return { ok: false, reason: 'norsa' };
  if (!d.domain) return { ok: false, reason: 'nodomain' };
  return { ok: true };
};
IOS.hostnameDefault = d => /^(Router|Switch)$/i.test(d.hostname);

/* ------------------------------------------------------------------ DHCP serveur IOS */
IOS.dhcpOffer = function (W, d, req) {
  const dh = d.dhcp; if (!dh || dh.service === false) return null;
  const l3 = N.l3up(W, d);
  const ref = req.giaddr || (l3.find(x => x.name === req.via) || {}).ip; if (!ref) return null;
  const pool = (dh.pools || []).find(p => U.inNet(ref, p.net, p.mask)); if (!pool) return null;
  pool._leases = pool._leases || {};
  const mac = (req.mac || '').toUpperCase();
  const excluded = ip => (dh.excluded || []).some(e => U.ipInRange(ip, e.start, e.end || e.start));
  const own = l3.map(x => x.ip);
  let ip = pool._leases[mac] && pool._leases[mac].ip;
  if (!ip) {
    const used = Object.keys(pool._leases).map(m => pool._leases[m].ip);
    for (let n = U.ip2n(pool.net) + 1; n < U.ip2n(U.bcast(pool.net, pool.mask)); n++) {
      const c = U.n2ip(n); if (excluded(c) || used.indexOf(c) >= 0 || own.indexOf(c) >= 0) continue; ip = c; break;
    }
  }
  if (!ip) return null;
  return { ip, mask: pool.mask, gw: pool.gw || '', dns: (pool.dns || []).slice(), suffix: pool.domain || '', serverIp: (l3.find(x => x.name === req.via) || l3[0]).ip, leaseSec: (pool.leaseDays || 1) * 86400, poolName: pool.name };
};
K['ios-rt'].dhcpCommit = K['ios-sw'].dhcpCommit = (W, srv, offer, client, ifn) => {
  const pool = (srv.dhcp.pools || []).find(p => p.name === offer.poolName); if (!pool) return;
  pool._leases = pool._leases || {}; const mac = (client.ifaces[ifn].mac || '').toUpperCase();
  pool._leases[mac] = { ip: offer.ip, mac, t: W.clock.elapsed };
};
K['ios-rt'].dhcpFree = K['ios-sw'].dhcpFree = (W, srv, client, ifn) => {
  const mac = (client.ifaces[ifn].mac || '').toUpperCase(); (srv.dhcp.pools || []).forEach(p => { if (p._leases) delete p._leases[mac]; });
};

/* ------------------------------------------------------------------ vues dérivées utilisées par l'émulateur CLI */
/* Interfaces trunk effectives : {port, native, allowed[], mode} */
IOS.trunkPorts = sw => Object.keys(sw.ports).filter(p => sw.ports[p].mode === 'trunk');
IOS.vlansOnPort = (sw, p) => { const q = sw.ports[p]; if (q.mode === 'trunk') return Object.keys(sw.vlans || {}).map(Number).filter(v => N.portAllows(q, v)); return [q.vlan || 1]; };
/* État « show interfaces status » : connected / notconnect / disabled / err-disabled */
IOS.portStatus = function (W, sw, p) {
  const q = sw.ports[p];
  if (q.errdisabled) return 'err-disabled';
  if (q.adminDown) return 'disabled';
  if (SIM.l2 && !q.logical && SIM.l2.suspended(W, sw, p)) return 'suspended';       // membre d'un EtherChannel dont la configuration diffère de l'interface logique
  return N.linkUp(W, sw, p) ? 'connected' : 'notconnect';
};
/* Port-security : violation = l'appareil relié présente une adresse MAC non autorisée alors que le maximum est atteint */
IOS.psecViolates = function (W, sw, port) {
  const q = sw.ports[port]; if (!q || !q.psec || !q.psec.enabled) return false;
  const pe = N.peerOf(W, sw, port); if (!pe) return false;
  const peer = W.dev[pe.dev]; const pi = peer && peer.ifaces && peer.ifaces[pe.port]; if (!pi || !pi.mac) return false;
  const mac = U.macKey(pi.mac); const known = (q.psec.macs || []).map(U.macKey);
  return known.indexOf(mac) < 0 && known.length >= (q.psec.max || 1);
};
/* Résumé « show ip interface brief » */
IOS.ifBrief = function (W, d) {
  const out = [];
  if (d.kind === 'ios-sw') {
    for (const p of Object.keys(d.ports)) {
      const q = d.ports[p]; const st = IOS.portStatus(W, d, p);
      out.push({ name: p, ip: 'unassigned', ok: 'YES', method: 'unset', status: q.adminDown ? 'administratively down' : (st === 'connected' ? 'up' : 'down'), proto: st === 'connected' ? 'up' : 'down' });
    }
    for (const s of Object.keys(d.svi || {})) {
      const sv = d.svi[s]; const l = N.l3(W, d).find(x => x.name === s);
      out.push({ name: s, ip: sv.ip || 'unassigned', ok: 'YES', method: sv.ip ? 'manual' : 'unset', status: sv.shut ? 'administratively down' : (l && l.up ? 'up' : 'down'), proto: l && l.up ? 'up' : 'down' });
    }
  } else {
    for (const n of Object.keys(d.ifaces)) {
      const i = d.ifaces[n]; const l = N.l3(W, d).find(x => x.name === n);
      const physUp = i.encap ? !!(l && l.up) : N.linkUp(W, d, n);
      out.push({ name: n, ip: i.ip || 'unassigned', ok: 'YES', method: i.ip ? 'manual' : 'unset', status: i.adminDown ? 'administratively down' : (physUp ? 'up' : 'down'), proto: (!i.adminDown && physUp) ? 'up' : 'down' });
    }
  }
  return out;
};

/* ------------------------------------------------------------------ projection sémantique */
SIM.semProjectors['ios-rt'] = SIM.semProjectors['ios-sw'] = function (d, id) {
  /* Projection « sémantique » : on ignore ce qui est purement cosmétique ou de comptabilité (numéros de séquence d'ACL, descriptions,
     lignes non modélisées, compteurs) pour que « refaire la même configuration autrement » compte comme une réparation. */
  const SKIP = { id: 1, seq: 1, extra: 1, desc: 1, banner: 1 };
  const clean = v => Array.isArray(v) ? v.map(clean) : (v && typeof v === 'object') ? Object.keys(v).reduce((o, k) => { if (k[0] !== '_' && !SKIP[k]) o[k] = clean(v[k]); return o; }, {}) : v;
  return U.flat(clean(d), id, {});
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
