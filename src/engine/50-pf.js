/* ============================================================================
   pfSense / OPNsense — filtrage à états, NAT (port forward + sortant), IPsec site à site,
   OpenVPN accès distant, DNS résolveur, journaux de filtrage.
   « Tunnel établi ≠ trafic autorisé » : le tunnel est un lien virtuel, le filtrage
   se fait sur l'interface enc0 (onglet IPsec des règles).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;
const PF = SIM.pf = {};

/* ------------------------------------------------------------------ alias et adresses */
PF.alias = (d, name) => (d.aliases || []).find(a => a.name === name);
PF.ifNet = (W, d, ifk) => { const l = N.l3(W, d).find(x => x.name === ifk); return l && l.ip ? { net: U.netAddr(l.ip, l.mask), mask: l.mask } : null; };
PF.ifIp = (W, d, ifk) => { const l = N.l3(W, d).find(x => x.name === ifk); return l ? l.ip : null; };

PF.addrMatch = function (W, d, spec, ip) {
  if (!spec || spec.t === 'any') return true;
  if (spec.neg) return !PF.addrMatch(W, d, Object.assign({}, spec, { neg: false }), ip);
  switch (spec.t) {
    case 'host': return spec.v === ip;
    case 'net': return U.inCidr(ip, spec.v);
    case 'ifnet': { const n = PF.ifNet(W, d, spec.v); return !!n && U.inNet(ip, n.net, n.mask); }
    case 'ifaddr': return PF.ifIp(W, d, spec.v) === ip;
    case 'self': return N.ownsIp(W, d, ip) !== null;
    case 'alias': {
      const a = PF.alias(d, spec.v); if (!a) return false;
      return a.values.some(v => v.indexOf('/') > 0 ? U.inCidr(ip, v) : v === ip);
    }
  }
  return false;
};
PF.portMatch = function (d, spec, port) {
  if (spec === undefined || spec === null || spec === '' || spec === 'any') return true;
  if (port === undefined) return false;
  const a = PF.alias(d, spec);
  if (a) return a.values.some(v => PF.portMatch(d, v, port));
  const s = String(spec);
  if (s.indexOf(':') > 0 || s.indexOf('-') > 0) { const [lo, hi] = s.split(/[:-]/).map(Number); return port >= lo && port <= hi; }
  return Number(s) === port;
};
PF.protoMatch = (r, pkt) => {
  const p = r.proto || 'any';
  if (p === 'any') return true;
  if (p === 'tcp/udp') return pkt.proto === 'tcp' || pkt.proto === 'udp';
  if (p === 'icmp') return pkt.proto === 'icmp' && (!r.icmpType || r.icmpType === 'any' || (r.icmpType === 'echoreq' && (pkt.icmpType === undefined || pkt.icmpType === 8)));
  return p === pkt.proto;
};

PF.ruleHit = (W, d, r, pkt, st) => {
  if (r.dis) return false;
  if (!PF.protoMatch(r, pkt)) return false;
  if (!PF.addrMatch(W, d, r.src, st.sip)) return false;
  if (!PF.addrMatch(W, d, r.dst, st.dip)) return false;
  if (pkt.proto === 'tcp' || pkt.proto === 'udp') {
    if (!PF.portMatch(d, r.sport, pkt.sport)) return false;
    if (!PF.portMatch(d, r.dport, pkt.dport)) return false;
  }
  return true;
};

/* ------------------------------------------------------------------ journal de filtrage */
PF.fwlog = function (W, d, ifk, act, pkt, st, ruleDescr, ruleId) {
  d._rt.fwlog = d._rt.fwlog || [];
  d._rt.fwlog.push({ t: W.now().getTime(), act, ifk, ifname: (d.ifaces[ifk] || {}).name || ifk, proto: pkt.proto, sip: st.sip, sport: pkt.sport, dip: st.dip, dport: pkt.dport, rule: ruleDescr, ruleId });
  if (d._rt.fwlog.length > 400) d._rt.fwlog.shift();
};
PF.DEFAULT_DENY = U.av('pf-default-deny-label', 'Default deny rule IPv4 (1000000103)');

/* ------------------------------------------------------------------ redirection de port (rdr, avant filtrage) */
PF.applyRdr = function (W, d, ifk, pkt, st) {
  for (const r of (d.nat && d.nat.portfwd) || []) {
    if (r.dis || r.iface !== ifk) continue;
    if (r.proto && r.proto !== pkt.proto && !(r.proto === 'tcp/udp' && (pkt.proto === 'tcp' || pkt.proto === 'udp'))) continue;
    if (!PF.addrMatch(W, d, r.dst || { t: 'ifaddr', v: ifk }, st.dip)) continue;
    if (r.src && !PF.addrMatch(W, d, r.src, st.sip)) continue;
    if (!PF.portMatch(d, r.dport, pkt.dport)) continue;
    const orig = st.dip; st.dip = r.target; if (r.tport) st.dport = Number(r.tport);
    st.xlat.push({ dev: d.id, kind: 'dnat', orig, xl: r.target });
    return r;
  }
  return null;
};

/* ------------------------------------------------------------------ filtrage à l'entrée d'une interface */
PF.filterIn = function (W, d, ifk, pkt, st) {
  if (pkt.reply) return { act: 'pass', state: true };
  const iface = d.ifaces[ifk]; if (!iface) return { act: 'block', rule: 'no-iface' };
  let rdr = null;
  if (ifk === 'wan' || (d.nat && d.nat.portfwd && d.nat.portfwd.some(r => r.iface === ifk))) rdr = PF.applyRdr(W, d, ifk, pkt, st);
  // règles automatiques
  if (ifk === 'lan' && d.system && d.system.antilockout !== false) {
    const wp = d.system.webgui ? d.system.webgui.port : 443; const sshp = d.system.ssh && d.system.ssh.enabled ? (d.system.ssh.port || 22) : null;
    if (pkt.proto === 'tcp' && N.ownsIp(W, d, st.dip) && (pkt.dport === wp || pkt.dport === sshp)) return { act: 'pass', rule: 'Anti-Lockout Rule', auto: true };
  }
  if (d.ipsec && d.ipsec.enabled && ifk === 'wan' && pkt.proto === 'udp' && (pkt.dport === 500 || pkt.dport === 4500)) {
    if ((d.ipsec.tunnels || []).some(t => !t.p1.disabled && t.p1.remoteGw === st.sip)) return { act: 'pass', rule: 'IPsec auto', auto: true };
  }
  if (ifk === 'wan') {
    if (iface.blockPrivate && U.isPrivate(st.sip)) return { act: 'block', rule: 'Block private networks', auto: true, log: true };
    if (rdr && rdr.assoc !== 'none') {
      if (!rdr.dis) return { act: 'pass', rule: 'NAT ' + (rdr.descr || 'port forward'), auto: true };
    }
  }
  const list = (d.rules && d.rules[ifk]) || [];
  for (const r of list) {
    if (!PF.ruleHit(W, d, r, pkt, st)) continue;
    r._hits = (r._hits || 0) + 1;
    return { act: r.act, rule: r.descr || ('règle ' + r.id), ruleId: r.id, log: r.log };
  }
  return { act: 'block', rule: PF.DEFAULT_DENY, def: true };
};

/* ------------------------------------------------------------------ NAT sortant */
PF.outboundNat = function (W, d, inIf, outIf, pkt, st) {
  if (inIf === null || !d.nat) return;
  const ob = d.nat.outbound || { mode: 'automatic', rules: [] };
  if (ob.mode === 'disabled') return;
  const gwIfs = (d.gateways || []).filter(g2 => !g2.lanGw).map(g2 => g2.iface);   // les passerelles « lanGw » (prochain saut interne) ne font pas de l'interface une WAN
  if (gwIfs.indexOf(outIf) < 0) return;                    // NAT seulement vers une interface WAN
  const outIp = PF.ifIp(W, d, outIf); if (!outIp) return;
  const apply = (xl) => { const orig = st.sip; st.sip = xl; st.xlat.push({ dev: d.id, kind: 'snat', orig, xl }); };
  if (ob.mode === 'manual' || ob.mode === 'hybrid') {
    for (const r of ob.rules || []) {
      if (r.dis || r.iface !== outIf) continue;
      if (!PF.addrMatch(W, d, r.src, st.sip)) continue;
      if (r.dst && !PF.addrMatch(W, d, r.dst, st.dip)) continue;
      if (r.nonat) return;
      apply(r.transl && r.transl !== 'iface' ? r.transl : outIp); return;
    }
    if (ob.mode === 'manual') return;
  }
  // automatique : réseaux des interfaces locales (hors WAN) — pas les réseaux derrière une route statique
  for (const ifk of Object.keys(d.ifaces)) {
    if (gwIfs.indexOf(ifk) >= 0 || ifk === 'enc0') continue;
    const n = PF.ifNet(W, d, ifk); if (n && U.inNet(st.sip, n.net, n.mask)) { apply(outIp); return; }
  }
};

/* ------------------------------------------------------------------ IPsec : état calculé */
PF.logOnce = function (W, devId, msg) {
  const L = W.logs(devId, 'ipsec'); const last = L[L.length - 1];
  if (last && last.msg === msg && (W.now().getTime() - last.t) < 120000) return;
  W.log(devId, 'ipsec', { msg });
};
PF.cidrKey = c => { const p = U.parseCidr(c); return p.net + '/' + p.len; };
PF.ipsecStatus = function (W, d, tun) {
  if (!d._rt.ipsecCache || d._rt.ipsecCache.ver !== W.ver) d._rt.ipsecCache = { ver: W.ver, m: {} };
  const cache = d._rt.ipsecCache.m, key = tun.id;
  if (cache[key]) return cache[key];
  const res = { p1: { up: false, err: null }, p2: [] };
  const log = (m) => PF.logOnce(W, d.id, m);
  const p1 = tun.p1;
  const wanIp = PF.ifIp(W, d, p1.iface || 'wan');
  const own = N.findOwner(W, p1.remoteGw);
  const peer = own && own.dev.kind === 'pf' ? own.dev : null;
  const fail = (err, msg, peerMsg) => { res.p1.err = err; if (msg) log(msg); if (peer && peerMsg) PF.logOnce(W, peer.id, peerMsg); cache[key] = res; return res; };
  if (!d.ipsec || !d.ipsec.enabled || p1.disabled) return fail('disabled');
  if (!wanIp) return fail('nowan', U.av('ipsec-log-nowan', 'IKE: pas d’adresse locale disponible sur ' + (p1.iface || 'wan')));
  const c = N.connect(W, d.id, p1.remoteGw, 'udp', 500, { srcIp: wanIp, noReturn: false });
  if (c.state !== 'open') return fail('timeout', U.av('ipsec-log-timeout', 'IKE: pas de réponse de ' + p1.remoteGw + ' (retransmission de IKE_SA_INIT)'));
  if (!peer) return fail('timeout');
  const ptun = ((peer.ipsec && peer.ipsec.tunnels) || []).find(t => !t.p1.disabled && t.p1.remoteGw === wanIp);
  if (!ptun || !peer.ipsec.enabled) return fail('NO_PROPOSAL_CHOSEN', U.av('ipsec-log-nopropchosen', 'IKE: réception de NO_PROPOSAL_CHOSEN de ' + p1.remoteGw), U.av('ipsec-log-noikecfg', 'IKE: aucune configuration IKE trouvée pour ' + p1.remoteGw + '...' + wanIp + ', envoi de NO_PROPOSAL_CHOSEN'));
  const q = ptun.p1;
  if (q.ike !== p1.ike) return fail('NO_PROPOSAL_CHOSEN', U.av('ipsec-log-ikever', 'IKE: version IKE incompatible (' + p1.ike + ' ≠ ' + q.ike + ')'), U.av('ipsec-log-ikever2', 'IKE: version IKE incompatible (' + q.ike + ' ≠ ' + p1.ike + ')'));
  if (q.encr !== p1.encr || q.hash !== p1.hash || String(q.dh) !== String(p1.dh)) return fail('NO_PROPOSAL_CHOSEN', U.av('ipsec-log-p1-noprop', 'IKE: réception de NO_PROPOSAL_CHOSEN de ' + p1.remoteGw), U.av('ipsec-log-p1-noprop2', 'IKE: aucune proposition IKE acceptable reçue de ' + wanIp + ', envoi de NO_PROPOSAL_CHOSEN'));
  if (q.psk !== p1.psk) return fail('AUTHENTICATION_FAILED', U.av('ipsec-log-authfail', 'IKE: réception de AUTHENTICATION_FAILED de ' + p1.remoteGw), U.av('ipsec-log-authfail2', 'IKE: la charge utile AUTH reçue de ' + wanIp + ' ne correspond pas (clé pré-partagée) — envoi de AUTHENTICATION_FAILED'));
  res.p1.up = true; log(U.av('ipsec-log-ikeok', 'IKE_SA ' + tun.id + ' établie entre ' + wanIp + ' et ' + p1.remoteGw));
  for (const p2 of tun.p2 || []) {
    const e = { up: false, err: null, local: p2.local, remote: p2.remote };
    if (p2.dis) { e.err = 'disabled'; res.p2.push(e); continue; }
    const m = (ptun.p2 || []).find(x => !x.dis && PF.cidrKey(x.local) === PF.cidrKey(p2.remote) && PF.cidrKey(x.remote) === PF.cidrKey(p2.local));
    if (!m) { e.err = 'TS_UNACCEPTABLE'; log(U.av('ipsec-log-ts', 'CHILD_SA: réception de TS_UNACCEPTABLE de ' + p1.remoteGw)); PF.logOnce(W, peer.id, U.av('ipsec-log-ts2', 'CHILD_SA: sélecteurs de trafic non acceptables, envoi de TS_UNACCEPTABLE')); res.p2.push(e); continue; }
    if (m.encr !== p2.encr || m.hash !== p2.hash || (m.pfs || null) !== (p2.pfs || null) || (m.proto || 'esp') !== (p2.proto || 'esp')) { e.err = 'NO_PROPOSAL_CHOSEN'; log(U.av('ipsec-log-p2-noprop', 'CHILD_SA: réception de NO_PROPOSAL_CHOSEN de ' + p1.remoteGw)); res.p2.push(e); continue; }
    e.up = true; res.p2.push(e);
  }
  cache[key] = res; return res;
};
/* Trouve le tunnel et le pair pour un paquet src→dst */
PF.ipsecRoute = function (W, d, st) {
  if (!d.ipsec || !d.ipsec.enabled) return null;
  for (const t of d.ipsec.tunnels || []) {
    if (t.p1.disabled) continue;
    for (const p2 of t.p2 || []) {
      if (p2.dis) continue;
      if (U.inCidr(st.dip, p2.remote) && U.inCidr(st.sip, p2.local)) {
        const s = PF.ipsecStatus(W, d, t); const e = s.p2.find(x => x.local === p2.local && x.remote === p2.remote);
        if (s.p1.up && e && e.up) { const own = N.findOwner(W, t.p1.remoteGw); return { peer: own.dev, tun: t }; }
        return { down: true, tun: t };
      }
    }
  }
  return null;
};

/* ------------------------------------------------------------------ OpenVPN accès distant */
PF.ovpnServerFor = (d, port, proto) => ((d.openvpn && d.openvpn.servers) || []).find(s => !s.dis && Number(s.port) === port && s.proto.replace(/[46]$/, '') === proto);
/* Vérification pure (sans effet de bord) de la négociation : sert de sonde et de moteur de connexion */
PF.ovpnCheck = function (W, clientId, profileName) {
  const c = W.d(clientId); const profs = (c.vpn && c.vpn.profiles) || []; const prof = profs.find(p => p.name === profileName) || profs[0];
  const out = { ok: false, log: [] }; const L = m => out.log.push(m);
  if (!prof) { L('Options error: pas de profil'); return out; }
  L('OpenVPN 2.x ' + U.av('ovpn-version-line', 'sur Windows')); L('TCP/UDP: Preserving recently used remote address: [AF_INET]' + prof.server + ':' + prof.port);
  const wanc = N.l3up(W, c)[0]; if (!wanc) { L('Network is unreachable'); out.err = 'nonet'; return out; }
  let sip = prof.server;
  if (!U.isIP(sip)) { const rr = N.resolve(W, clientId, prof.server, { noCache: true }); if (!rr.ok) { L(U.av('ovpn-log-resolve', 'RESOLVE: Cannot resolve host address: ' + prof.server + ':' + prof.port + ' (Name or service not known)')); L('Exiting due to fatal error'); out.err = 'resolve'; return out; } sip = rr.ip; }
  const con = N.connect(W, clientId, sip, prof.proto.replace(/[46]$/, ''), Number(prof.port), {});
  if (con.state !== 'open' && !(prof.proto.indexOf('udp') === 0 && con.state === 'open')) {
    L(U.av('ovpn-log-timeout', 'TLS Error: TLS key negotiation failed to occur within 60 seconds (check your network connectivity)')); L('TLS Error: TLS handshake failed'); out.err = 'timeout'; return out;
  }
  const srvDev = W.d(con.dstDev); out.srvDev = srvDev.id; out.clientIp = wanc.ip; out.cn = (((srvDev.openvpn || {}).certs || []).find(x => x.name === prof.cert) || {}).cn || prof.cert;
  const srv = PF.ovpnServerFor(srvDev, Number(prof.port), prof.proto.replace(/[46]$/, ''));
  if (!srv) { L('TLS Error: TLS handshake failed'); out.err = 'noserver'; return out; }
  const ca = (srvDev.openvpn.cas || []).find(x => x.name === srv.ca);
  if (!ca || prof.ca !== srv.ca) { L(U.av('ovpn-log-verify', 'VERIFY ERROR: depth=1, error=unable to get issuer certificate')); L('TLS_ERROR: BIO read tls_read_plaintext error'); out.err = 'ca'; return out; }
  const cert = (srvDev.openvpn.certs || []).find(x => x.name === prof.cert);
  if (!cert || cert.ca !== srv.ca) { L(U.av('ovpn-log-badcert', 'VERIFY ERROR: depth=0, error=certificate signature failure')); out.err = 'cert'; return out; }
  if (cert.revoked) { L(U.av('ovpn-log-revoked', 'VERIFY ERROR: depth=0, error=certificate revoked')); out.err = 'revoked'; return out; }
  if (cert.expired) { L(U.av('ovpn-log-expired', 'VERIFY ERROR: depth=0, error=certificate has expired')); out.err = 'expired'; return out; }
  if (ca.expired) { L(U.av('ovpn-log-caexpired', 'VERIFY ERROR: depth=1, error=certificate has expired')); out.err = 'caexpired'; return out; }
  if (srv.tls && prof.tlsKey !== srv.tlsKey) { L(U.av('ovpn-log-tlsauth', 'tls-crypt unwrap error: packet authentication failed')); out.err = 'tlskey'; return out; }
  const user = (srvDev.openvpn.users || []).find(u => u.cert === cert.name);
  if (!user || user.disabled) { L(U.av('ovpn-log-authfail', 'AUTH: Received control message: AUTH_FAILED')); out.err = 'auth'; return out; }
  const tn = U.parseCidr(srv.tunnelNet); const cip = U.n2ip(U.ip2n(tn.net) + 2);
  const routes = (srv.localNets || []).map(x => { const p = U.parseCidr(x); return { net: p.net, mask: p.mask, len: p.len, iface: 'tun0', nh: null, ad: 1 }; });
  out.tunnel = { tn, cip, routes, server: srvDev.id, srvName: srv.descr };
  L(U.av('ovpn-log-ok', 'Initialization Sequence Completed')); out.ok = true; out.ip = cip;
  return out;
};
/* Journal côté serveur : n'est écrit que si des paquets ont réellement atteint le serveur OpenVPN. */
PF.ovpnServerLog = function (W, out) {
  if (!out.srvDev) return;
  const who = out.clientIp + ':' + (50000 + parseInt(U.hash8(out.clientIp + out.cn).slice(0, 3), 16) % 10000);
  const L = m => W.log(out.srvDev, 'openvpn', { msg: m, proc: 'openvpn' });
  switch (out.err) {
    case 'noserver': break;
    case 'ca': L(who + ' ' + U.av('ovpn-srv-ca', 'VERIFY ERROR: depth=1, error=unable to get issuer certificate: CN=' + out.cn)); L(who + ' TLS_ERROR: BIO read tls_read_plaintext error'); break;
    case 'cert': L(who + ' ' + U.av('ovpn-srv-cert', 'VERIFY ERROR: depth=0, error=certificate signature failure: CN=' + out.cn)); break;
    case 'revoked': L(who + ' ' + U.av('ovpn-srv-revoked', 'VERIFY ERROR: depth=0, error=certificate revoked: CN=' + out.cn)); break;
    case 'expired': L(who + ' ' + U.av('ovpn-srv-expired', 'VERIFY ERROR: depth=0, error=certificate has expired: CN=' + out.cn)); L(who + ' TLS_ERROR: BIO read tls_read_plaintext error'); break;
    case 'caexpired': L(who + ' ' + U.av('ovpn-srv-caexpired', 'VERIFY ERROR: depth=1, error=certificate has expired')); break;
    case 'tlskey': L(who + ' ' + U.av('ovpn-srv-tlskey', 'tls-crypt unwrap error: packet authentication failed')); break;
    case 'auth': L(who + ' ' + U.av('ovpn-srv-auth', 'TLS Auth Error: Auth Username/Password verification failed for peer')); break;
    default: if (out.ok) { L(who + ' ' + U.av('ovpn-srv-ok', 'Peer Connection Initiated with [AF_INET]' + who)); L(out.cn + '/' + who + ' ' + U.av('ovpn-srv-ok2', 'MULTI: Learn: ' + out.ip + ' -> ' + out.cn + '/' + who)); }
  }
};
PF.ovpnConnect = function (W, clientId, profileName) {
  const c = W.d(clientId); const out = PF.ovpnCheck(W, clientId, profileName);
  PF.ovpnServerLog(W, out);
  if (out.ok) {
    const t = out.tunnel;
    c.ifaces.tun0 = { virtual: true, ip: t.cip, mask: t.tn.mask, name: 'TAP-Windows Adapter V9' };
    c._rt.vpn = { up: true, server: t.server, ip: t.cip, routes: t.routes, since: W.clock.elapsed, srvName: t.srvName };
  }
  W.touch('vpn');
  return out;
};
PF.ovpnDisconnect = function (W, clientId) { const c = W.d(clientId); delete c.ifaces.tun0; c._rt.vpn = null; W.touch('vpn'); };

/* Prérouteur des hôtes clients VPN : le trafic vers les réseaux poussés part dans le tunnel */
PF.hostPreRoute = function (W, d, inIf, pkt, st) {
  const v = d._rt && d._rt.vpn; if (!v || !v.up) return null;
  if (inIf !== null) return null;
  for (const r of v.routes) if (U.inNet(st.dip, r.net, r.mask)) return { to: { dev: v.server, iface: 'ovpns1' } };
  return null;
};
if (K.win) K.win.preRoute = PF.hostPreRoute;

/* ------------------------------------------------------------------ hooks du type pf */
K.pf = {
  forwards: true,
  ingress: (W, d, ifk, pkt, st, opts) => {
    if (ifk === 'enc0' && !pkt.reply) {
      const r = (d.rules.enc0 || []).find(x => PF.ruleHit(W, d, x, pkt, st));
      if (!r || r.act !== 'pass') { PF.fwlog(W, d, 'enc0', 'block', pkt, st, r ? r.descr : PF.DEFAULT_DENY, r && r.id); return { drop: r && r.act === 'reject' ? 'reject' : 'fw', detail: 'enc0' }; }
      r._hits = (r._hits || 0) + 1; return null;
    }
    if (SIM.snort) { const sv = SIM.snort.ingress(W, d, ifk, pkt, st, opts); if (sv) return sv; }
    const v = PF.filterIn(W, d, ifk, pkt, st);
    if (v.act === 'pass') return null;
    if (v.log !== false) PF.fwlog(W, d, ifk, v.act === 'reject' ? 'reject' : 'block', pkt, st, v.rule, v.ruleId);
    return { drop: v.act === 'reject' ? 'reject' : 'fw', detail: v.rule };
  },
  preRoute: (W, d, inIf, pkt, st, opts) => {
    // OpenVPN : livraison vers un client connecté
    const ov = (d.openvpn && d.openvpn.servers) || [];
    for (const s of ov) {
      if (s.dis) continue;
      if (U.inCidr(st.dip, s.tunnelNet)) {
        for (const k of Object.keys(W.dev)) { const x = W.dev[k]; if (x._rt && x._rt.vpn && x._rt.vpn.up && x._rt.vpn.server === d.id && x._rt.vpn.ip === st.dip) return { to: { dev: k, iface: 'tun0' } }; }
      }
    }
    const r = PF.ipsecRoute(W, d, st);
    if (r && r.peer) return { to: { dev: r.peer.id, iface: 'enc0' } };
    return null;
  },
  egress: (W, d, inIf, outIf, pkt, st, opts) => { PF.outboundNat(W, d, inIf, outIf, pkt, st); if (SIM.snort) SIM.snort.egress(W, d, outIf, pkt, st, opts); return null; },
  fwIn: () => 'allow',
  icmpReply: () => true,
  listening: (W, d, proto, port, ifn) => {
    const s = d.system || {};
    if (proto === 'tcp' && s.webgui && port === s.webgui.port && ifn !== 'wan') return true;
    if (proto === 'tcp' && s.ssh && s.ssh.enabled && port === (s.ssh.port || 22)) return true;
    if (port === 53 && d.dns && d.dns.unbound && d.dns.unbound.enabled) return ifn !== 'wan';
    if (proto === 'udp' && (port === 500 || port === 4500) && d.ipsec && d.ipsec.enabled) return ifn === 'wan';
    if (PF.ovpnServerFor(d, port, proto)) return true;
    if (SIM.squid && SIM.squid.listening(W, d, proto, port, ifn)) return true;
    return false;
  },
  dnsAnswer: (W, d, ifn, q) => {
    const u = d.dns && d.dns.unbound; if (!u || !u.enabled) return { rcode: 'REFUSED', answers: [] };
    const name = q.name.toLowerCase();
    for (const h of u.hostOverrides || []) {
      const names = [(h.host ? h.host + '.' + h.domain : h.domain)].concat((h.aliases || []).map(a => (a.host ? a.host + '.' + a.domain : a.domain))).map(x => x.toLowerCase());
      if (names.indexOf(name) >= 0 && q.type === 'A') return { rcode: 'NOERROR', answers: [{ name, type: 'A', data: h.ip, ttl: 3600 }] };
    }
    for (const o of u.domainOverrides || []) { const dm = o.domain.toLowerCase(); if (name === dm || name.endsWith('.' + dm)) { const r = N.dnsQuery(W, d.id, o.server, name, q.type); return r.state === 'ok' ? { rcode: r.rcode, answers: r.answers || [] } : { rcode: 'SERVFAIL', answers: [] }; } }
    for (const s of d.dns.servers || []) { const r = N.dnsQuery(W, d.id, s, name, q.type); if (r.state === 'ok') return { rcode: r.rcode, answers: r.answers || [] }; }
    return { rcode: 'SERVFAIL', answers: [] };
  }
};

/* Projection sémantique : clés brutes (utilisées pour la détection des actions dangereuses) + clés « canon »
   utilisées pour juger qu'une racine est réparée. Les clés canon ignorent ce qui n'a aucun effet fonctionnel
   (identifiant interne, description, journalisation) : recréer une règle depuis l'interface web, avec sa propre
   description, répare la panne sans être classé « contournement ». L'ordre des règles reste significatif
   (première correspondance). */
const sigAddr = a => (!a || a.t === 'any') ? '*' : (a.neg ? '!' : '') + a.t + ':' + (a.v === undefined ? '' : a.v);
const sigPort = p => (p === undefined || p === null || p === '' || p === 'any') ? '' : String(p);
const sigRule = r => [r.dis ? 'DIS' : 'on', r.act, r.proto || 'any', (r.icmpType && r.icmpType !== 'any') ? r.icmpType : '', sigAddr(r.src), sigPort(r.sport), sigAddr(r.dst), sigPort(r.dport)].join('|');
SIM.semProjectors.pf = function (d, id) {
  const c = {}; for (const k of Object.keys(d)) { if (k[0] === '_' || k === 'id') continue; c[k] = d[k]; }
  const out = U.flat(c, id, {});
  const cn = id + '/canon/';
  for (const ifk of Object.keys(d.rules || {})) out[cn + 'rules/' + ifk] = (d.rules[ifk] || []).map(sigRule).join('\n');
  if (d.nat) {
    out[cn + 'nat/portfwd'] = (d.nat.portfwd || []).map(r => [r.dis ? 'DIS' : 'on', r.iface, r.proto || 'any', sigAddr(r.dst), sigAddr(r.src), sigPort(r.dport), r.target, sigPort(r.tport), r.assoc || 'pass'].join('|')).join('\n');
    const ob = d.nat.outbound || { mode: 'automatic', rules: [] };
    out[cn + 'nat/outbound'] = ob.mode + '\n' + (ob.rules || []).map(r => [r.dis ? 'DIS' : 'on', r.iface, sigAddr(r.src), sigAddr(r.dst), r.transl || 'iface', r.nonat ? 'nonat' : ''].join('|')).join('\n');
  }
  out[cn + 'routes'] = (d.routes || []).map(r => r.net + '/' + r.mask + '>' + r.nh).sort().join('\n');
  for (const a of d.aliases || []) out[cn + 'aliases/' + a.name] = a.type + ':' + (a.values || []).slice().sort().join(',');
  return out;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
