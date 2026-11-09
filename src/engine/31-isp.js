/* ============================================================================
   Fournisseur d'accès (ISP) simulé + commutateur non administrable.
   L'ISP ne route pas les adresses privées (RFC 1918) : sans NAT correct,
   l'accès Internet échoue — cette conséquence est dérivée, pas scriptée.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;

K.isp = {
  forwards: true,
  ingress: (W, d, ifn, pkt, st) => {
    if (U.isPrivate(st.sip) && !(d.allowPrivateFrom || []).some(c => U.inCidr(st.sip, c))) return { drop: 'bogon', icmp: null };
    return null;
  },
  fwIn: () => 'allow',
  icmpReply: () => true,
  listening: (W, d, proto, port, ifn, st) => {
    const h = d.pub && d.pub[st.dip]; if (!h) return false;
    return (h.svc || []).indexOf(proto + '/' + port) >= 0;
  },
  dnsAnswer: (W, d, ifn, q) => {
    const z = d.dnsZone || {};
    const name = q.name.toLowerCase();
    if (q.type === 'A') {
      const key = Object.keys(z).find(k => k === name);
      if (key) return { rcode: 'NOERROR', answers: [{ name, type: 'A', data: z[key], ttl: 300 }] };
      // domaines publics génériques : tout nom en .fr/.com/... inconnu → NXDOMAIN
      return { rcode: 'NXDOMAIN', answers: [] };
    }
    if (q.type === 'PTR') return { rcode: 'NXDOMAIN', answers: [] };
    return { rcode: 'NOERROR', answers: [] };
  }
};
K['sw-dumb'] = { forwards: false };

SIM.semProjectors.isp = function (d, id) { return {}; };            // l'ISP n'est jamais une cause de panne
SIM.semProjectors['sw-dumb'] = function (d, id) { const o = {}; for (const n of Object.keys(d.ports)) { const c = d.ports[n].cable; o[id + '/ports/' + n + '/plugged'] = c ? !!c.plugged : null; o[id + '/ports/' + n + '/to'] = c ? c.to : null; } o[id + '/phys'] = JSON.stringify(d.phys || {}); return o; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
