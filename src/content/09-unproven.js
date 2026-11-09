/* Pannes dont la réparabilité PAR L'INTERFACE n'est pas prouvée (D-108 : « non prouvé » n'est pas « prouvé irréparable »).
   Elles restent livrées, jouables en guidé et en libre (statut « livrée, non terminée »), mais elles ne sont JAMAIS tirées en évaluation
   chronométrée : un candidat noté ne doit pas tomber sur une panne dont personne n'a démontré qu'on peut la réparer par clics et saisies.
   Arbitrage du porteur du projet du 30/10/2026 (option 1 : une liste, un filtre de mode). Un seul endroit : supprimer l'entrée la remet en jeu chronométré.
   Le filtre ne s'applique qu'au TIRAGE (pool d'un niveau, missions composées) : une panne choisie explicitement (« panne précise », formateur) reste servie.
   Motif : aucun parcours par l'interface pfSense ne la prouve (tests/ui/proxy-faults.js ne couvre que px_subnet_denied, px_cache_unsaved, px_sg_default_deny, px_sg_nolist)
   ; multi_vitrine : la partie pfSense (redirection de port) n'a pas de parcours dans une mission composée. */
(function (g) {
'use strict';
const SIM = g.SIM;
const px = 'Aucun parcours par l’interface pfSense ne prouve que cette panne se répare par clics et saisies (attente n° 20).';
SIM.UNPROVEN_FAULTS = [
  'px_down', 'px_pkg_broken', 'px_iface', 'px_client_port', 'px_client_bypass', 'px_blacklist_regex', 'px_blacklist_overblock', 'px_whitelist',
  'px_sg_off', 'px_sg_category', 'px_safesearch', 'px_dns_upstream', 'px_log_off', 'px_trans_off', 'px_quic', 'px_trans_multi', 'px_cascade'
].map(fault => ({ fault, why: px })).concat([
  { fault: 'multi_vitrine', why: 'Panne composée dont la partie pfSense (redirection de port) n’a pas de parcours prouvé dans une mission composée (D-108).' }
]);
SIM.isUnproven = id => (SIM.UNPROVEN_FAULTS || []).some(u => u.fault === id);
})(typeof globalThis !== 'undefined' ? globalThis : window);
