/* ============================================================================
   OSPF — sondes de validation des pannes (voisinage, annonce d'un réseau, route par défaut).
   Elles lisent l'état DÉRIVÉ du moteur (src/engine/41-ospf.js) : jamais d'état figé par un scénario.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM;
const P = SIM.probes = SIM.probes || {};
const O = SIM.ospf;

/* voisin `rid` de `dev` en état FULL */
P.ospfnbr = (W, p) => {
  const d = W.d(p.dev); const n = O.neighbors(W, d).find(x => x.rid === p.rid);
  return { ok: !!n && n.state === 'FULL', why: n ? n.state : 'aucun voisin ' + p.rid };
};
/* le routeur annonce le réseau `net` (a.b.c.d/len) dans OSPF — dans la zone `area` si elle est précisée */
P.ospfadv = (W, p) => {
  const R = O.routerOf(W, W.d(p.dev)); if (!R) return { ok: false, why: 'processus OSPF inactif' };
  const ok = Object.keys(R.ifs).some(n => R.ifs[n].net + '/' + R.ifs[n].len === p.net && (p.area === undefined || R.ifs[n].area === p.area));
  return { ok, why: ok ? 'annoncé' : 'non annoncé' };
};
/* le routeur diffuse une route par défaut dans OSPF (default-information originate effectif) */
P.ospfdef = (W, p) => { const ok = O.defaultOriginating(W, W.d(p.dev)); return { ok, why: ok ? 'route par défaut annoncée' : 'aucune route par défaut annoncée' }; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
