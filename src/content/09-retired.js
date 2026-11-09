/* Variantes RETIRÉES du jeu : leur contenu est conservé (statut « livrée, non terminée »), mais elles ne sont jamais tirées
   (tirage aléatoire, mission composée, « Panne précise »). Un seul endroit : supprimer l'entrée remet la variante en jeu.
   `vary` = nom de la variable de variante dans la panne, `key` = clé de la variante. */
(function (g) {
'use strict';
const SIM = g.SIM;
SIM.RETIRED_VARIANTS = [
  { fault: 'ad_secure_channel', vary: 'm', key: 'canal', why: 'Aucune console ni commande du simulateur ne répare le canal sécurisé (secureChannel = false) : variante irréparable par le joueur (D-102). Cible : sortie puis rejointe du domaine par Propriétés système (sysdm.cpl), après les captures R-75 ; Test-ComputerSecureChannel -Repair -Credential en complément.' },
  { fault: 'lx_nginx', vary: 'm', key: 'expire', why: 'Certificat expiré (notAfter modifié dans le modèle) : aucune commande de renouvellement n’est émulée dans le terminal (ni openssl ni certbot), la variante est donc non réparable au terminal (D-108). Réintégration : après le relevé des sorties d’openssl et de certbot (R-77), qui évite d’inventer ces sorties (D-13).' }
];
})(typeof globalThis !== 'undefined' ? globalThis : window);
