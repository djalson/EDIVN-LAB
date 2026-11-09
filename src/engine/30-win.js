/* ============================================================================
   Windows (clients et serveurs) : services, pare-feu, rôle DHCP, rôle DNS,
   écoute des ports, journaux d'événements. Symptômes dérivés, jamais écrits en dur.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;
const WIN = SIM.win = {};

/* ------------------------------------------------------------------ services */
/* Noms d'affichage (services.msc, français) — exacts pour les services courants */
WIN.SVC_DISPLAY = {
  DHCPServer: 'Serveur DHCP', DNS: 'Serveur DNS', NTDS: 'Services de domaine Active Directory', W3SVC: 'Service de publication World Wide Web',
  LanmanServer: 'Serveur', LanmanWorkstation: 'Station de travail', Netlogon: 'Netlogon', W32Time: 'Temps Windows', mpssvc: 'Pare-feu Windows Defender',
  TermService: 'Services Bureau à distance', Kdc: 'Centre de distribution de clés Kerberos', Dnscache: 'Client DNS', Dhcp: 'Client DHCP', WAS: 'Service d’activation des processus Windows',
  gpsvc: 'Client de stratégie de groupe', EventLog: 'Journal d’événements Windows',
  NlaSvc: U.av('svc-nlasvc-name', 'Connaissance des emplacements réseau')
};
WIN.svcState = (d, name) => { const s = d.win && d.win.svc && d.win.svc[name]; return s ? s.state : 'absent'; };
WIN.svcRunning = (d, name) => WIN.svcState(d, name) === 'running';

/* Journal d'événements Windows : canaux 'Application' 'Système' 'Sécurité' 'DHCP-Server' 'DNS-Server' 'GroupPolicy' */
WIN.evt = function (W, devId, chan, id, level, source, msg, ageSec) {
  W.log(devId, 'evt:' + chan, { id, level, source, msg }, ageSec || 0);
};
WIN.setSvc = function (W, devId, name, state, why) {
  const d = W.d(devId); const s = d.win.svc[name]; if (!s) return false;
  if (s.state === state) return true;
  s.state = state;
  // Service Control Manager 7036 : « Le service X est entré dans l'état : arrêté / en cours d'exécution »
  WIN.evt(W, devId, 'Système', 7036, 'Information', 'Service Control Manager',
    'Le service ' + (WIN.SVC_DISPLAY[name] || name) + ' est entré dans l’état : ' + (state === 'running' ? 'en cours d’exécution' : 'arrêté') + '.');
  if (state === 'running') WIN.onServiceStart(W, devId, name);
  return true;
};
/* Effets de bord authentiques d'un démarrage de service */
/* Classification du réseau (Windows Defender Firewall : profil Domaine / Privé / Public).
   Un poste joint à un domaine qui joint un contrôleur de domaine passe en profil « Domaine », sinon « Public ». */
WIN.recalcProfile = function (W, devId) {
  const d = W.d(devId); if (!d.win || !d.win.domain) return;
  const dc = Object.keys(W.dev).map(k => W.dev[k]).find(x => x.win && x.win.ad && x.win.ad.domain.toLowerCase() === d.win.domain.toLowerCase() && x.id !== devId);
  for (const n of Object.keys(d.ifaces)) {
    const i = d.ifaces[n]; if (!N.linkUp(W, d, n)) continue;
    let ok = false;
    if (dc) { const l = N.l3up(W, dc)[0]; if (l) ok = N.connect(W, devId, l.ip, 'tcp', 389).state === 'open'; }
    else if (d.win.ad) ok = true;
    i.fwProfile = ok ? 'domain' : 'public';
  }
};
WIN.onServiceStart = function (W, devId, name) {
  const d = W.d(devId);
  if (name === 'NlaSvc') WIN.recalcProfile(W, devId);
  if (name === 'Netlogon' && d.win.ad && SIM.ad) SIM.ad.registerDcRecords(W, devId);
  if (name === 'DHCPServer' && d.win.dhcp && !d.win.dhcp.authorized && d.win.domain) {
    WIN.evt(W, devId, 'DHCP-Server', 1046, 'Erreur', 'Microsoft-Windows-DHCP-Server',
      U.av('evt-dhcp-1046', 'Le service DHCP/BINL de l’ordinateur local, appartenant au domaine d’administration Windows ' + d.win.domain + ', a déterminé qu’il n’est pas autorisé à démarrer. Il a cessé de répondre aux clients.'));
  }
};

/* ------------------------------------------------------------------ pare-feu Windows */
const ICMP_ECHO = pkt => pkt.proto === 'icmp' && (pkt.icmpType === 8 || pkt.icmpType === undefined);
WIN.fwRuleMatches = function (r, pkt) {
  const proto = (r.proto || 'Any');
  if (proto === 'ICMPv4') return pkt.proto === 'icmp' && (r.icmpType === undefined || r.icmpType === (pkt.icmpType === undefined ? 8 : pkt.icmpType));
  if (pkt.proto === 'icmp') return proto === 'Any' && !r.lport;
  if (proto !== 'Any' && proto.toLowerCase() !== pkt.proto) return false;
  if (!r.lport || r.lport === 'Tous les ports' || r.lport === '*') return true;
  return String(r.lport).split(',').some(x => { x = x.trim(); if (x.indexOf('-') > 0) { const [a, b] = x.split('-').map(Number); return pkt.dport >= a && pkt.dport <= b; } return +x === pkt.dport; });
};
WIN.fwAllows = function (W, d, ifn, pkt) {
  const prof = (d.ifaces[ifn] && d.ifaces[ifn].fwProfile) || 'domain';
  const fw = d.win.fw; if (!fw) return 'allow';
  const p = fw.profiles[prof];
  if (p && !p.enabled) return 'allow';
  let allow = false;
  for (const r of fw.rules) {
    if (!r.enabled || r.dir !== 'in' || r.profiles.indexOf(prof) < 0) continue;
    if (!WIN.fwRuleMatches(r, pkt)) continue;
    if (r.action === 'block') return 'drop';
    allow = true;
  }
  return allow ? 'allow' : 'drop';
};

/* ------------------------------------------------------------------ écoute des ports */
WIN.listening = function (W, d, proto, port, ifn) {
  const w = d.win; if (!w) return false;
  const run = n => WIN.svcRunning(d, n);
  if (port === 53 && (proto === 'udp' || proto === 'tcp')) return !!w.dns && run('DNS');
  if (port === 67 && proto === 'udp') return !!w.dhcp && run('DHCPServer');
  if ((port === 445 || port === 139) && proto === 'tcp') return run('LanmanServer');
  if (port === 3389 && proto === 'tcp') return run('TermService') && !!(w.rdp && w.rdp.enabled);
  if ((port === 88 || port === 464) && (proto === 'tcp' || proto === 'udp')) return !!w.ad && run('NTDS') && run('Kdc');
  if ([389, 636, 135, 3268].indexOf(port) >= 0) return !!w.ad && run('NTDS');
  if (port === 123 && proto === 'udp') return run('W32Time');
  if (proto === 'tcp' && w.iis && run('W3SVC')) {
    const ip = (N.l3(W, d).find(x => x.name === ifn) || {}).ip;
    for (const s of w.iis.sites) { if (s.state !== 'started') continue; for (const b of s.bindings) if (+b.port === port && (b.ip === '*' || b.ip === ip)) return true; }
  }
  return false;
};

/* ------------------------------------------------------------------ DHCP serveur */
WIN.dhcpScopeFor = function (W, d, req) {
  const dh = d.win.dhcp; if (!dh) return null;
  const l3 = N.l3up(W, d);
  let ref = req.giaddr;
  if (!ref) { const x = l3.find(i => i.name === req.via); ref = x && x.ip; }
  if (!ref) return null;
  return dh.scopes.find(s => U.inNet(ref, s.net, s.mask)) || null;
};
WIN.dhcpOffer = function (W, d, req) {
  if (!d.win || !d.win.dhcp) return null;
  if (!WIN.svcRunning(d, 'DHCPServer')) return null;
  const dh = d.win.dhcp;
  if (d.win.domain && !dh.authorized) return null;                      // panne silencieuse caractéristique
  const sc = WIN.dhcpScopeFor(W, d, req);
  if (!sc || !sc.active) return null;
  const mac = (req.mac || '').toUpperCase();
  sc._leases = sc._leases || {};
  const excl = (ip) => (sc.exclusions || []).some(e => U.ipInRange(ip, e.start, e.end));
  const srvIps = N.l3(W, d).map(x => x.ip);
  const usedBy = {}; Object.keys(sc._leases).forEach(m => { usedBy[sc._leases[m].ip] = m; });
  const resa = (sc.reservations || []).find(r => r.mac.toUpperCase() === mac);
  let ip = null;
  if (resa) ip = resa.ip;
  else if (sc._leases[mac]) ip = sc._leases[mac].ip;
  else if (sc._nextOffer) ip = sc._nextOffer;
  else {
    const rsvIps = (sc.reservations || []).map(r => r.ip);
    for (let n = U.ip2n(sc.start); n <= U.ip2n(sc.end); n++) {
      const c = U.n2ip(n);
      if (excl(c) || usedBy[c] || rsvIps.indexOf(c) >= 0 || srvIps.indexOf(c) >= 0) continue;
      ip = c; break;
    }
  }
  if (!ip) { WIN.evt(W, d.id, 'DHCP-Server', 1063, 'Avertissement', 'Microsoft-Windows-DHCP-Server', U.av('evt-dhcp-pool', 'Plus aucune adresse disponible dans l’étendue ' + sc.net + '.')); return null; }
  const opt = (n) => (resa && resa.options && resa.options[n] !== undefined) ? resa.options[n] : (sc.options && sc.options[n] !== undefined ? sc.options[n] : (dh.serverOptions && dh.serverOptions[n]));
  const gw = opt(3) || ''; const dns = opt(6) ? String(opt(6)).split(/[,\s]+/).filter(Boolean) : [];
  const own = (N.l3(W, d).find(x => x.name === req.via) || {}).ip || srvIps[0];
  return { ip, mask: sc.mask, gw: U.isIP(gw) ? gw : '', dns: dns.filter(U.isIP), suffix: opt(15) || '', serverIp: own, leaseSec: sc.leaseSec || 691200, scopeId: sc.id };
};
WIN.dhcpCommit = function (W, srv, offer, client, ifn) {
  const sc = srv.win.dhcp.scopes.find(s => s.id === offer.scopeId); if (!sc) return;
  sc._leases = sc._leases || {};
  const mac = (client.ifaces[ifn].mac || '').toUpperCase();
  sc._leases[mac] = { ip: offer.ip, name: client.name + '.' + ((client.win && client.win.domain) || ''), mac, expires: W.clock.elapsed + (offer.leaseSec || 691200), type: 'DHCP' };
  if (sc._nextOffer === offer.ip) sc._nextOffer = null;
};
WIN.dhcpFree = function (W, srv, client, ifn, lease) {
  const mac = (client.ifaces[ifn].mac || '').toUpperCase();
  srv.win.dhcp.scopes.forEach(sc => { if (sc._leases && sc._leases[mac]) delete sc._leases[mac]; });
};

/* ------------------------------------------------------------------ DNS serveur (rôle Windows) */
WIN.dnsZoneFor = function (dns, name) {
  let best = null;
  for (const z of dns.zones) { const zn = z.name.toLowerCase(); if (name === zn || name.endsWith('.' + zn)) { if (!best || zn.length > best.name.length) best = z; } }
  return best;
};
WIN.dnsAnswer = function (W, d, ifn, q) {
  const dns = d.win && d.win.dns;
  if (!dns || !WIN.svcRunning(d, 'DNS')) return { rcode: 'SERVFAIL', answers: [] };
  if (dns.listen && dns.listen.length) { const ip = (N.l3(W, d).find(x => x.name === ifn) || {}).ip; if (dns.listen.indexOf(ip) < 0) return { rcode: 'REFUSED', answers: [] }; }
  const name = q.name.toLowerCase();
  const z = WIN.dnsZoneFor(dns, name);
  if (z) {
    if (z.state === 'paused') return { rcode: 'SERVFAIL', answers: [] };
    const rel = name === z.name.toLowerCase() ? '@' : name.slice(0, name.length - z.name.length - 1);
    /* délégation de sous-zone : résolution itérative vers le serveur de noms délégué (adresse de colle) */
    let del = null;
    for (const dg of (z.delegations || [])) { if (rel === dg.name || rel.endsWith('.' + dg.name)) { if (!del || dg.name.length > del.name.length) del = dg; } }
    if (del) {
      const r = N.dnsQuery(W, d.id, del.ip, name, q.type);
      if (r.state === 'ok') return { rcode: r.rcode, answers: r.answers || [] };
      return { rcode: 'SERVFAIL', answers: [] };
    }
    const recs = z.records.filter(r => r.name.toLowerCase() === rel && r.type === q.type);
    if (recs.length) return { rcode: 'NOERROR', answers: recs.map(r => ({ name, type: r.type, data: r.data, ttl: r.ttl || 3600 })), authoritative: true };
    const cn = z.records.find(r => r.name.toLowerCase() === rel && r.type === 'CNAME' && q.type !== 'CNAME');
    if (cn) {
      const t2 = cn.data.replace(/\.$/, '').toLowerCase();
      const sub = WIN.dnsAnswer(W, d, ifn, { name: t2, type: q.type, from: q.from });
      return { rcode: sub.rcode, answers: [{ name, type: 'CNAME', data: cn.data, ttl: 3600 }].concat(sub.answers || []), authoritative: true };
    }
    if (z.records.some(r => r.name.toLowerCase() === rel)) return { rcode: 'NOERROR', answers: [], authoritative: true };
    return { rcode: 'NXDOMAIN', answers: [], authoritative: true };
  }
  // redirecteur conditionnel (zone la plus spécifique)
  let cf = null;
  for (const c of (dns.condForwarders || [])) { const zn = c.zone.toLowerCase(); if (name === zn || name.endsWith('.' + zn)) { if (!cf || zn.length > cf.zone.length) cf = c; } }
  const fwdList = cf ? cf.servers : (dns.forwarders || []);
  if (!fwdList.length) return { rcode: 'SERVFAIL', answers: [] };
  if (!dns.recursion && dns.recursion !== undefined) return { rcode: 'REFUSED', answers: [] };
  for (const f of fwdList) {
    const r = N.dnsQuery(W, d.id, f, name, q.type);
    if (r.state === 'ok' && (r.rcode === 'NOERROR' || r.rcode === 'NXDOMAIN')) return { rcode: r.rcode, answers: r.answers || [] };
  }
  return { rcode: 'SERVFAIL', answers: [] };
};

/* ------------------------------------------------------------------ enregistrement du type d'appareil */
K.win = {
  forwards: false,
  fwIn: (W, d, ifn, pkt) => WIN.fwAllows(W, d, ifn, pkt),
  listening: (W, d, proto, port, ifn) => WIN.listening(W, d, proto, port, ifn),
  icmpReply: () => true,
  dhcpOffer: WIN.dhcpOffer, dhcpCommit: WIN.dhcpCommit, dhcpFree: WIN.dhcpFree,
  dnsAnswer: WIN.dnsAnswer
};
K.printer = {
  forwards: false,
  fwIn: () => 'allow',
  listening: (W, d, proto, port) => (d.listen || []).indexOf(proto + '/' + port) >= 0,
  icmpReply: () => true
};

/* ------------------------------------------------------------------ projection sémantique */
SIM.semProjectors.win = function (d, id) {
  const out = {};
  const c = { ifaces: {}, win: d.win, phys: d.phys, hostsFile: d.hostsFile, proxy: d.proxy, clockSkewMin: d.clockSkewMin };
  for (const n of Object.keys(d.ifaces)) { const i = d.ifaces[n]; c.ifaces[n] = { ip: i.ip, mask: i.mask, gw: i.gw, dns: i.dns, dhcp: i.dhcp, dnsManual: i.dnsManual, fwProfile: i.fwProfile, adminDown: i.adminDown, cable: i.cable ? { plugged: i.cable.plugged, to: i.cable.to } : null }; }
  U.flat(c, id, out);
  return out;
};
SIM.semProjectors.printer = SIM.semProjectors.win;
})(typeof globalThis !== 'undefined' ? globalThis : window);
