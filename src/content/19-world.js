/* ============================================================================
   Assemblage du monde sain : FormaTech (Toulouse, Bordeaux, Ramonville) + Internet simulé.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, WB = SIM.WB, LX = SIM.lx;

/* Construit un monde sain, amorcé (services Linux démarrés, baux DHCP obtenus). */
SIM.buildHealthyWorld = function (opts) {
  opts = opts || {};
  const W = new SIM.World({ dev: {}, walls: {}, meta: { seed: opts.seed || 1 } });
  WB.buildNet(W);
  WB.buildWin(W);
  W.dev['SRV-LNX'] = WB.srvLnx(); W.dev['SRV-WEB'] = WB.srvWeb(); W.dev['SRV-RV'] = WB.srvP();
  for (const id of Object.keys(W.dev)) { W.dev[id].id = id; if (!W.dev[id]._rt) W.dev[id]._rt = {}; }
  WB.cableHosts(W);
  /* port-security (adresses « sticky » apprises) sur les ports des postes de Toulouse */
  [['SW-T2', 'FastEthernet0/2', 'PC-01'], ['SW-T3', 'FastEthernet0/2', 'PC-02']].forEach(([sw, port, pc]) => {
    W.dev[sw].ports[port].psec = { enabled: true, max: 1, violation: 'shutdown', sticky: true, macs: [W.dev[pc].ifaces.Ethernet0.mac] };
  });
  /* services Linux */
  ['SRV-LNX', 'SRV-WEB', 'SRV-RV'].forEach(id => { LX.boot(W, W.dev[id]); });
  /* services Windows : les événements 7036 de l'amorçage ne sont pas rejoués */
  /* baux DHCP des clients */
  ['PC-01', 'PC-02', 'PC-B1', 'PC-RV2'].forEach(id => { N.dhcpRenew(W, id, 'Ethernet0'); });
  SIM.applyCreds(W);
  /* sessions ouvertes au démarrage : jeton et stratégies de groupe appliqués (état « lundi matin, tout fonctionne ») */
  for (const id of Object.keys(W.dev)) {
    const d = W.dev[id]; if (d.kind !== 'win' || !d.user || d.win.server) continue;
    let pwd; if (d.win.domain) { const A = SIM.ad.byDomain(W, d.win.domain); const u = A && SIM.ad.userOf(A.win.ad, d.user); pwd = u && u.pwd; } else { const u = (d.win.localUsers || []).find(x => x.name === d.user); pwd = u && u.pwd; }
    const lg = SIM.ad.logon(W, id, d.user, pwd, { dry: true });
    if (lg.ok) SIM.ad.sessionStart(W, id, d.user, lg);
  }
  /* le journal initial ne doit pas contenir les entrées d'amorçage dans la fenêtre de jeu */
  Object.keys(W.dev).forEach(id => { const lg = W.dev[id]._rt.logs; if (lg) Object.keys(lg).forEach(ch => lg[ch].forEach(e => { e.t -= 3600 * 1000 * 26; })); });
  /* uptime cohérent : les services Linux tournent depuis 26 h au début de la partie */
  ['SRV-LNX', 'SRV-WEB', 'SRV-RV'].forEach(id => { const d = W.dev[id]; d._rt.bootAt = -3600 * 26; Object.keys(d._rt.svcRun || {}).forEach(k => { d._rt.svcRun[k].since -= 3600 * 1000 * 26; }); });
  W.ver = 0;
  SIM.ospf.attach(W);
  SIM.l2.attach(W);
  return W;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
