/* ============================================================================
   Campagne : les chapitres. Chaque chapitre élargit le périmètre d'intervention du joueur (équipements visibles sur
   la carte) et porte les pannes dont les équipements et les compétences relèvent de ce périmètre.
   Le rattachement d'une panne à un chapitre est CALCULÉ (src/engine/83-campaign.js) : le plus petit chapitre dont le
   périmètre contient tous les équipements d'une de ses variantes, relevé par le chapitre minimal de ses compétences
   (table `skills` ci-dessous) et par les règles de préfixe (`prefix`). Ajouter une panne ne demande donc rien ici.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM;

SIM.CHAPTERS = [
  { n: 1, id: 'bureau', title: 'Le bureau', kicker: 'Premier jour',
    story: 'Bienvenue chez FormaTech. Pour ta première semaine, on te confie l’étage : les postes des utilisateurs, l’imprimante et la baie de brassage. Quand « plus rien ne marche », c’est toi qu’on appelle.',
    learn: ['Couche physique : câbles, alimentation, écran, prises murales', 'Adressage IPv4 d’un poste : adresse, masque, passerelle, DNS', 'La démarche : constater, isoler, corriger, vérifier depuis le poste'],
    devices: ['PC-01', 'PC-02', 'PC-ADM', 'PATCH-T', 'IMP-T1', 'SW-T2', 'SW-T3'], sites: ['toulouse'], need: 5, examParts: 1 },
  { n: 2, id: 'serveur', title: 'Le premier serveur', kicker: 'On te donne les clés',
    story: 'Tu as fait tes preuves à l’étage. On t’ouvre la salle serveurs : le contrôleur de domaine distribue les adresses, résout les noms et ouvre les sessions de toute l’entreprise. Quand il tousse, tout le monde s’enrhume.',
    learn: ['DHCP : service, étendues, options, réservations', 'DNS : enregistrements, redirecteurs, cache', 'Comptes Active Directory : verrouillage, expiration, horloge'],
    devices: ['SRV-DC1', 'SW-T1'], sites: [], need: 6 },
  { n: 3, id: 'fichiers', title: 'Fichiers, web et stratégies', kicker: 'Les services métier',
    story: 'Le serveur de fichiers héberge les dossiers partagés et l’intranet. Les stratégies de groupe décident de ce que chaque poste a le droit de faire. Ici, un « accès refusé » a toujours une raison précise.',
    learn: ['Partages et droits NTFS, méthode AGDLP', 'IIS : sites, liaisons, certificats', 'Stratégies de groupe : liaison, héritage, filtrage', 'Pare-feu Windows : la règle précise plutôt que tout ouvrir'],
    devices: ['SRV-FIC'], sites: [], need: 6 },
  { n: 4, id: 'commute', title: 'Le réseau commuté', kicker: 'Câble console en main',
    story: 'Les commutateurs étaient jusqu’ici des boîtes à voyants. On te donne maintenant le câble console : VLAN, trunks, sécurité des ports et routage entre VLAN passent sous ta responsabilité.',
    learn: ['VLAN et ports d’accès', 'Trunks : VLAN autorisés, VLAN natif', 'Routage inter-VLAN et relais DHCP', 'Sécurité des ports, accès SSH aux équipements'],
    devices: [], sites: [], need: 5 },
  { n: 5, id: 'linux', title: 'Linux entre en scène', kicker: 'Un autre monde',
    story: 'Un serveur Debian rejoint la salle : DNS secondaire, intranet LAMP, tâches planifiées. Pas de console graphique : un terminal, des journaux, et des droits au caractère près.',
    learn: ['Services systemd et journaux', 'SSH : configuration, clés, restrictions', 'Droits, ACL, stockage', 'BIND9, Apache, MariaDB'],
    devices: ['SRV-LNX'], sites: [], need: 6 },
  { n: 6, id: 'perimetre', title: 'Le périmètre', kicker: 'La porte d’entrée',
    story: 'Tout ce qui entre et sort passe par le pare-feu pfSense. Derrière lui, une DMZ héberge le site vitrine ; devant lui, Internet et les nomades qui se connectent en VPN depuis chez eux.',
    learn: ['Règles de filtrage à états, alias', 'NAT sortant et redirection de port', 'DMZ et segmentation', 'OpenVPN pour les postes nomades, nginx en DMZ'],
    devices: ['ISP', 'pfsense-tls', 'SW-DMZ', 'SRV-WEB', 'PCEXT'], sites: ['exterieur'], need: 6 },
  { n: 7, id: 'filtrage', title: 'Filtrer et surveiller', kicker: 'Voir ce qui passe',
    story: 'La direction veut filtrer la navigation et détecter les intrusions. Le proxy Squid et la sonde Snort tournent sur le pare-feu : mal réglés, ils bloquent tout le monde ou ne voient plus rien.',
    learn: ['Proxy Squid : explicite, transparent, cache', 'SquidGuard : listes, catégories, exceptions', 'Snort : règles, interfaces, hôtes bloqués'],
    devices: [], sites: [], need: 6 },
  { n: 8, id: 'bordeaux', title: 'Deuxième site : Bordeaux', kicker: 'L’entreprise grandit',
    story: 'FormaTech ouvre une agence à Bordeaux : son propre domaine, son pare-feu, et un tunnel IPsec vers Toulouse. Une panne peut maintenant se trouver à 250 km du symptôme.',
    learn: ['Tunnel IPsec site à site : phases 1 et 2, règles', 'Relation d’approbation entre domaines', 'Routeur sur un bâton (ROAS)'],
    devices: ['pfsense-bdx', 'R-B1', 'SW-B1', 'SRV-DC2', 'PC-B1'], sites: ['bordeaux'], need: 4 },
  { n: 9, id: 'ramonville', title: 'Le labo de Ramonville', kicker: 'Tout Cisco',
    story: 'À Ramonville, pas de pfSense : un routeur Cisco fait tout. NAT, listes de contrôle d’accès et DHCP se règlent en ligne de commande, et une ligne dans le mauvais ordre suffit à tout couper.',
    learn: ['NAT / PAT sur routeur Cisco', 'ACL étendues : ordre et sens', 'DHCP porté par le routeur'],
    devices: ['R-RV1', 'SW-RVA', 'SW-RVB', 'SRV-RV', 'PC-RV1', 'PC-RV2'], sites: ['ramonville'], need: 3 },
  { n: 10, id: 'ha', title: 'Haute disponibilité', kicker: 'Quand ça ne doit jamais tomber',
    story: 'Labège et Colomiers sont conçus pour survivre à une coupure : anneau OSPF, liens agrégés, Spanning Tree. Le piège : le réseau continue de marcher alors que la redondance est déjà perdue.',
    learn: ['OSPF : voisinages, zones, route par défaut', 'EtherChannel : négociation, membres, VLAN', 'Spanning Tree : racine et boucles'],
    devices: ['R-LB1', 'R-LB2', 'R-LB3', 'R-LB4', 'R-LB5', 'R-LB6', 'PC-LB2', 'PC-LB4', 'PC-LB6', 'SW-CA', 'SW-CB', 'SW-CC', 'PC-C1', 'PC-C2', 'PC-C3', 'PC-C4'], sites: ['labege', 'colomiers'], need: 4 },
  { n: 11, id: 'astreinte', title: 'Astreinte', kicker: 'Seul aux commandes',
    story: 'Tu connais toute l’infrastructure. Ce soir, c’est toi qui es d’astreinte : les pannes s’enchaînent, se masquent entre elles, et personne ne te dira où regarder.',
    learn: ['Incidents à causes multiples', 'Une panne peut en cacher une autre', 'Prioriser et vérifier chaque correction'],
    devices: [], sites: [], need: 3, examParts: 3 }
];

/* Chapitre minimal d'une compétence : une panne n'apparaît jamais avant que sa notion soit au programme. */
SIM.CHAPTER_RULES = {
  skills: {
    'ad-compte': 2, 'ad-install': 2, 'ad-ou': 2, 'dhcp-auth': 2,
    'iis': 3, 'agdlp': 3, 'ntfs-partage': 3, 'gpo': 3, 'gpo-heritage': 3, 'gpo-filtrage': 3, 'gpo-compte': 3, 'diag-gpo': 3, 'pare-feu-win': 3,
    'vlan': 4, 'trunk': 4, 'roas': 4, 'routage': 4, 'ssh-cisco': 4, 'switch-secu': 4, 'dhcp-relay': 4, 'acl': 4,
    'lx-droits': 5, 'lx-acl': 5, 'lx-ssh': 5, 'lx-services': 5, 'lx-reseau': 5, 'bind9': 5, 'lamp': 5, 'lx-stockage': 5, 'bash': 5, 'lx-secu': 5,
    'nginx': 6, 'pfsense': 6, 'pare-feu-etats': 6, 'portfwd': 6, 'segmentation': 6, 'nat-pat': 6, 'openvpn': 6,
    'proxy': 7, 'snort': 7,
    'ipsec': 8, 'ad-trust': 8,
    'ospf': 10, 'ospf-multi': 10, 'etherchannel': 10
  },
  /* préfixe d'identifiant → chapitre imposé (chaînes multi-causes scriptées : fin de campagne) */
  prefix: { 'multi_': 11 }
};
/* Comptes du coffre : chapitre à partir duquel ils servent (la fiche de l'infra ne montre en campagne que les comptes au programme). */
(SIM.VAULT || []).forEach(c => { c.ch = /bordeaux/i.test(c.scope) ? 8 : /SRV-RV|Ramonville/i.test(c.scope) ? 9 : /Debian/i.test(c.scope) ? 5 : /Cisco/i.test(c.scope) ? 4 : /pfSense/i.test(c.scope) ? 6 : 1; });
/* Pannes du catalogue livré (les scénarios importés par un formateur ne font pas partie de la campagne). */
SIM.BASE_FAULT_IDS = SIM.faults.map(d => d.id);
})(typeof globalThis !== 'undefined' ? globalThis : window);
