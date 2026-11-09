/* ============================================================================
   Horloge simulée et comportements différés : le temps qui passe fait évoluer le monde
   (réessais DHCP des clients en APIPA, expiration des caches DNS client).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;

/* Un client Windows sans bail réessaie le DHCP périodiquement ; durée exacte à vérifier (docs/A-VERIFIER.md : sched-dhcp-retry) */
const DHCP_RETRY_SEC = 300;
/* TTL du cache négatif/positif du résolveur client (secondes simulées) */
const DNS_CACHE_TTL = 300, DNS_NEG_TTL = 900;

SIM.AVREG['sched-dhcp-retry'] = 'Intervalle de réessai DHCP du client Windows sans bail : 300 s utilisés dans la simulation ; valeur exacte à vérifier.';
SIM.sched = {};
SIM.sched.advance = function (W, sec) {
  const before = W.clock.elapsed;
  W.tick(sec);
  const now = W.clock.elapsed;
  let changed = false;
  for (const id of Object.keys(W.dev)) {
    const d = W.dev[id];
    if (d.kind !== 'win' && d.kind !== 'linux') continue;
    if (d.kind === 'linux' && SIM.lx && SIM.lx.cronTick) SIM.lx.cronTick(W, d, W.now().getTime() - (now - before) * 1000, W.now().getTime());
    /* cache DNS client */
    if (d._rt.dnsCache) for (const k of Object.keys(d._rt.dnsCache)) { const e = d._rt.dnsCache[k]; if (now - e.t >= (e.neg ? DNS_NEG_TTL : DNS_CACHE_TTL)) delete d._rt.dnsCache[k]; }
    /* réessai DHCP */
    for (const n of Object.keys(d.ifaces || {})) {
      const i = d.ifaces[n]; if (!i.dhcp) continue;
      if (i._lease && !i._lease.conflict) continue;
      i._retryAt = i._retryAt === undefined ? before + DHCP_RETRY_SEC : i._retryAt;
      if (now >= i._retryAt) {
        i._retryAt = now + DHCP_RETRY_SEC;
        const r = N.dhcpRenew(W, id, n);
        if (r.ok) { changed = true; }
      }
    }
  }
  if (SIM.ad) {
    SIM.ad.tick(W);
    /* actualisation périodique des stratégies de groupe (toutes les 90 min simulées) */
    for (const id of Object.keys(W.dev)) { const d = W.dev[id]; if (d.kind !== 'win' || !d.win.domain || !d._rt.gp || !d._rt.gp.computer) continue; if (now - d._rt.gp.computer.at >= 5400) SIM.ad.applyGP(W, id, d._rt.session && d._rt.session.user, { logon: false }); }
  }
  W.touch('tick');
  return changed;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
