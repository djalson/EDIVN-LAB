/* ============================================================================
   Applications web hébergées (contenu du lab). Une application est une fonction (W, serveur, requête, client, site) → réponse
   de WEB.fetch. Elle ne mémorise rien : tout ce qu'elle affiche est CALCULÉ à la requête depuis l'état du monde (D-103).

   Application de gestion de SRV-FIC (http://gestion.toulouse.local/) :
   - elle interroge sa base avec la MÊME sonde que les pannes (P.dblogin : SRV-FIC → SRV-LNX:3306, compte « intranet »),
     jamais un drapeau ; le paramétrage de la base est lu dans site.appConfig du modèle ;
   - base joignable → tableau de bord (contenu fictif, statique, non lié à la console SQL : voir docs/LIMITES.md) ;
   - base injoignable → UNE page d'erreur, la même pour toute cause (port fermé, pare-feu, compte limité à un autre
     sous-réseau, service arrêté…), rédigée dans le jeu : aucun code d'erreur, aucun détail de pile, aucun message du serveur
     de base de données (D-103, D-13 : aucune pile applicative réelle n'a été relevée) ;
   - l'horodatage vient de l'horloge simulée (D-77).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, WEB = SIM.web;
WEB.apps = WEB.apps || {};

const frDate = d => U.pad2(d.getDate()) + '/' + U.pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());

/* Contenu fictif du tableau de bord : sociétés inventées, aucun nom de personne (règle du lab). */
const DEMO = {
  clients: 128, facturesMois: 342, enAttente: 17,
  dernieres: [
    { n: 'F-2026-0342', c: 'Menuiserie Boréal', m: '1 280,00' },
    { n: 'F-2026-0341', c: 'Atelier des Trois Ponts', m: '460,50' },
    { n: 'F-2026-0340', c: 'Transports Vallée Verte', m: '3 915,00' },
    { n: 'F-2026-0339', c: 'Imprimerie du Canal', m: '212,80' },
    { n: 'F-2026-0338', c: 'Garage des Pins', m: '875,00' }
  ]
};

WEB.apps.gestion = function (W, srv, req, clientId, site) {
  const cfg = (site.appConfig && site.appConfig.db) || { host: '10.10.10.30', port: 3306, user: 'intranet', name: 'intranet' };
  const db = SIM.probes.dblogin(W, { from: srv.id, to: cfg.host, port: cfg.port, user: cfg.user, db: cfg.name });
  const now = frDate(W.nowOf(srv.id));
  if (!db.ok) {
    return {
      status: 503,
      page: { kind: 'html', title: 'Gestion — service indisponible', html:
        '<h1>Gestion commerciale</h1><h2>Service momentanément indisponible</h2>' +
        '<p>L’application n’a pas pu accéder à ses données.</p>' +
        '<p>Réessayez dans quelques instants. Si le problème persiste, contactez l’administrateur.</p>' +
        '<p><small>' + U.esc(now) + '</small></p>' }
    };
  }
  return {
    status: 200,
    page: { kind: 'html', title: 'Gestion — tableau de bord', html:
      '<h1>Gestion commerciale</h1><h2>Tableau de bord</h2>' +
      '<p><small>' + U.esc(now) + '</small></p>' +
      '<ul><li>Clients actifs : <b>' + DEMO.clients + '</b></li><li>Factures du mois : <b>' + DEMO.facturesMois + '</b></li><li>Factures en attente de règlement : <b>' + DEMO.enAttente + '</b></li></ul>' +
      '<h3>Dernières factures</h3><table><tr><th>N°</th><th>Client</th><th>Montant (€)</th></tr>' +
      DEMO.dernieres.map(f => '<tr><td>' + U.esc(f.n) + '</td><td>' + U.esc(f.c) + '</td><td>' + U.esc(f.m) + '</td></tr>').join('') + '</table>' +
      '<p><small>Données de démonstration, indépendantes de la console SQL.</small></p>' }
  };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
