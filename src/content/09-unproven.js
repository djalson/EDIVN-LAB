/* Pannes écartées du tirage parce qu'un joueur ne peut pas les réparer avec ce que le simulateur émule.
   Elles restent au catalogue (contenu conservé) et une panne choisie explicitement (« panne précise », formateur) reste servie.

   Historique : cette liste portait 18 pannes « non prouvées réparables par l'interface » (17 pannes proxy + multi_vitrine), exclues
   de la seule évaluation chronométrée. Le 10/11/2026, tests/ui/proxy-sweep.js a réparé les 17 pannes proxy, toutes variantes
   comprises (37), par clics et saisies dans l'interface web de pfSense et dans les Options Internet du poste : elles sortent de la liste.
   La même vérification a établi que multi_vitrine n'est PAS réparable : une de ses trois causes est un certificat expiré, et aucune
   commande de renouvellement n'est émulée (ni openssl ni certbot ; même motif que la variante « expire » de lx_nginx, 09-retired.js).
   Elle est donc retirée de TOUS les tirages (aléatoire, mission composée, campagne), pas seulement du chronométré.
   Un seul endroit : supprimer l'entrée la remet en jeu. */
(function (g) {
'use strict';
const SIM = g.SIM;
SIM.UNPROVEN_FAULTS = [
  { fault: 'multi_vitrine', retired: true, why: 'Irréparable par le joueur : une des trois causes est un certificat expiré, et aucune commande de renouvellement n’est émulée (ni openssl ni certbot). Réintégration après le relevé des sorties de ces commandes (R-77), pour ne pas les inventer (D-13).' }
];
SIM.isUnproven = id => (SIM.UNPROVEN_FAULTS || []).some(u => u.fault === id);
/* retirée de tous les tirages (et pas seulement du chronométré) */
SIM.isRetiredFault = id => (SIM.UNPROVEN_FAULTS || []).some(u => u.fault === id && u.retired);
})(typeof globalThis !== 'undefined' ? globalThis : window);
