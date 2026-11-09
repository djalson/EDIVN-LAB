/* ============================================================================
   Couche 2 — sondes de validation des pannes (EtherChannel, Spanning Tree).
   Elles lisent l'état DÉRIVÉ du moteur (src/engine/42-l2.js) : jamais d'état figé par un scénario.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM;
const P = SIM.probes = SIM.probes || {};
const L2 = SIM.l2;

/* le port `port` de `dev` est agrégé (drapeau P de « show etherchannel summary »), ou porte le drapeau `flag` */
P.ecflag = (W, p) => {
  const x = L2.ecInfo(W, W.d(p.dev), p.port); const want = p.flag || 'P';
  return { ok: !!x && x.flag === want, why: x ? 'drapeau ' + x.flag + (x.why ? ' (' + x.why + ')' : '') : 'port hors groupe' };
};
/* l'interface logique du groupe `group` est en service (SU) */
P.ecstate = (W, p) => {
  const gr = L2.group(W, W.d(p.dev), p.group);
  return { ok: !!gr && gr.state === (p.state || 'SU'), why: gr ? gr.state : 'aucun groupe' };
};
/* le commutateur est (ou n'est pas, `root:false`) la racine du Spanning Tree du VLAN */
P.stproot = (W, p) => {
  const b = L2.bridge(W, W.d(p.dev), p.vlan); if (!b) return { ok: false, why: 'aucune instance STP pour le VLAN ' + p.vlan };
  return { ok: b.isRoot === (p.root !== false), why: b.isRoot ? 'racine' : 'racine : ' + L2.dottedMac(b.rootMac) };
};
/* aucun port du commutateur n'est bloqué par le Spanning Tree pour le VLAN (aucune redondance mise en attente) */
P.stpnoblock = (W, p) => {
  const b = L2.bridge(W, W.d(p.dev), p.vlan); if (!b) return { ok: false, why: 'aucune instance STP pour le VLAN ' + p.vlan };
  const bl = b.ports.filter(x => x.state === 'BLK').map(x => x.rep);
  return { ok: !bl.length, why: bl.length ? 'bloqué : ' + bl.join(', ') : 'aucun port bloqué' };
};
/* pas de tempête de diffusion sur le VLAN pour ce commutateur */
P.stpnostorm = (W, p) => { const st = L2.storm(W, W.d(p.dev), p.vlan); return { ok: !st, why: st ? 'tempête de diffusion' : 'pas de boucle' }; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
