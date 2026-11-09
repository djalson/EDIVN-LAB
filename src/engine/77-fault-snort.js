/* ============================================================================
   Snort — sonde de validation des pannes (instance démarrée, alerte produite par un flux, blocage).
   Elle rejoue le flux À BLANC (pas de journal, pas de nouvelle entrée dans la table des hôtes bloqués) :
   le résultat découle de l'état du modèle (src/engine/53-snort.js), jamais d'un état figé par un scénario.
   Paramètres : dev (défaut pfsense-tls) ;
     run     : {iface, on} — l'instance Snort de l'interface est (ou non) démarrée ;
     flow    : {from, to, proto:'icmp'|'tcp', port} — flux rejoué, avec :
       alert   : numéro SID attendu parmi les alertes (false = aucune alerte attendue) ;
       block   : true = le flux entraînerait un blocage ; false = aucun blocage ;
       reached : true = le flux atteint sa destination ;
     blockedNot : adresse qui ne doit pas figurer dans la table des hôtes bloqués.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, SN = SIM.snort;
SIM.probes = SIM.probes || {};
SIM.probes.snort = (W, p) => {
  const d = W.d(p.dev || 'pfsense-tls'); const why = [];
  if (!d.snort) return { ok: false, why: 'Snort absent' };
  if (p.run) { const s = SN.state(d, SN.cfg(d, p.run.iface)); if (s.run !== p.run.on) why.push('Snort (' + p.run.iface + ') : ' + s.why); }
  if (p.flow) {
    const r = SN.dryFlow(W, p.flow);
    if (p.flow.alert !== undefined) {
      const has = typeof p.flow.alert === 'number' ? r.alerts.some(a => a.sid === p.flow.alert) : r.alerts.length > 0;
      if (p.flow.alert === false ? r.alerts.length > 0 : !has) why.push(p.flow.alert === false ? 'une alerte est produite' : 'aucune alerte ' + (typeof p.flow.alert === 'number' ? 'SID ' + p.flow.alert : '') + ' pour ' + p.flow.from + ' → ' + p.flow.to);
    }
    if (p.flow.block !== undefined && (r.blocks.length > 0) !== p.flow.block) why.push(p.flow.block ? 'le flux ne déclenche aucun blocage' : 'le flux déclenche un blocage de ' + r.blocks.map(b => b.ip).join(', '));
    if (p.flow.reached !== undefined && r.reached !== p.flow.reached) why.push(p.flow.reached ? p.flow.from + ' n’atteint pas ' + p.flow.to : p.flow.from + ' atteint ' + p.flow.to);
  }
  if (p.blockedNot && (d.snortBlocked || []).some(b => b.ip === p.blockedNot)) why.push(p.blockedNot + ' figure dans la table des hôtes bloqués');
  return { ok: !why.length, why: why.length ? why.join(' ; ') : 'ok' };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
