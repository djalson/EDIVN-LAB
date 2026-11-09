/* ============================================================================
   Référentiel de compétences : identifiants courts → notions de la fiche de suivi v21
   (27/10/2026). Chaque panne est rattachée à ≥ 1 identifiant. `statut` reprend la fiche :
   vert = maîtrisé, jaune = en cours d'acquisition. `limite: true` = notion à la limite du
   périmètre (signalée au formateur, pas élargie de notre propre chef).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM = g.SIM || {};
const S = SIM.skills = {};
const add = (id, domaine, label, fiche, statut, limite) => { S[id] = { id, domaine, label, fiche, statut: statut || 'vert' }; if (limite) S[id].limite = true; };

/* --- Exploitation de l'infrastructure --- */
add('dhcp', 'Windows', 'DHCP : étendues, baux, réservations, options', 'DHCP — scope, bail, réservations, options');
add('dhcp-auth', 'Windows', 'DHCP : autorisation du serveur dans Active Directory', 'DHCP — autorisation du serveur dans Active Directory');
add('dhcp-relay', 'Réseau', 'DHCP relayé (ip helper-address) multi-réseaux', 'DHCP — scénario relayé');
add('dns', 'Windows', 'DNS : zones, enregistrements A/PTR/CNAME, redirecteurs', 'DNS — zones, enregistrements A/PTR');
add('iis', 'Windows', 'IIS : sites, bindings, hébergement', 'IIS — sites, bindings, hébergement');
add('ad-install', 'Windows', 'Active Directory : installation, DNS et domaine', 'Active Directory — installation et promotion');
add('agdlp', 'Windows', 'Active Directory : modèle AGDLP', 'Active Directory — modèle AGDLP');
add('ntfs-partage', 'Windows', 'Droits NTFS et de partage : portée et combinaison', 'Droits NTFS & partage');
add('ad-ou', 'Windows', 'Active Directory : OU et objets', 'Active Directory — OU');
add('gpo', 'Windows', 'GPO : application, ordre, liaison', 'Active Directory — GPO');
add('gpo-heritage', 'Windows', 'GPO : héritage, blocage, « Appliqué », ordre de liaison', 'GPO — héritage, blocage et « Appliqué »');
add('gpo-filtrage', 'Windows', 'GPO : filtrage de sécurité (MS16-072)', 'GPO — filtrage de sécurité et ciblage');
add('gpo-compte', 'Windows', 'GPO : stratégies de compte (niveau domaine)', 'GPO — stratégies de compte');
add('ad-trust', 'Windows', 'Active Directory : approbation entre domaines', 'Active Directory — approbation (TP Toulouse/Bordeaux)');
add('ad-compte', 'Windows', 'Active Directory : comptes (verrouillage, expiration, horaires)', 'Active Directory — comptes utilisateurs', 'jaune');

/* --- Réseaux --- */
add('subnetting', 'Réseau', 'Adressage IPv4, masques, passerelle', 'Subnetting / VLSM');
add('vlan', 'Réseau', 'VLAN : affectation des ports d’accès', 'VLAN — segmentation');
add('trunk', 'Réseau', 'Trunk 802.1Q : VLAN autorisés, VLAN natif', '802.1Q / configuration des trunks');
add('roas', 'Réseau', 'Routage inter-VLAN (ROAS / SVI)', 'ROAS (Router on a stick)');
add('routage', 'Réseau', 'Routage statique et route par défaut', 'Routage statique');
add('nat-pat', 'Réseau', 'NAT / PAT', 'NAT/PAT');
add('ssh-cisco', 'Réseau', 'SSH sur équipement Cisco', 'SSH sur Cisco');
add('acl', 'Réseau', 'ACL étendues Cisco (ordre, sens, zones)', 'ACL étendues');
/* limite : la fiche v21 ne contient aucune ligne sur la sécurité des ports ; gardée sur arbitrage du 27/10/2026 */
add('switch-secu', 'Réseau', 'Sécurité des ports de commutateur', 'Switch security', 'jaune', true);
add('ospf', 'Réseau', 'OSPF une area : voisinages, router-id, network, passive-interface, route par défaut', 'Routage dynamique OSPF — une seule area');
add('ospf-multi', 'Réseau', 'OSPF plusieurs areas : ABR, zone 0 et zones périphériques, routes O et O IA', 'OSPF — plusieurs areas', 'jaune');
add('etherchannel', 'Réseau', 'EtherChannel (LACP) et Spanning Tree : agrégation de liens, négociation, racine, ports bloqués, tempête', 'Agrégation de liens — EtherChannel (LACP) et STP', 'jaune');
add('phys', 'Réseau', 'Couche physique : câbles, prises, alimentation, écran', 'Diagnostic de couche 1');

/* --- Linux / Debian --- */
add('lx-droits', 'Linux', 'Droits POSIX, propriétaires, umask, bit x sur répertoire', 'Fichiers de configuration / droits');
add('lx-acl', 'Linux', 'ACL POSIX (getfacl / setfacl)', 'ACL — Linux');
add('lx-ssh', 'Linux', 'SSH Debian : sshd_config, clés, droits', 'SSH — service, clés');
add('lx-services', 'Linux', 'Services systemd et journalctl', 'Gestion des services');
add('lx-reseau', 'Linux', 'Réseau Debian : interfaces, routes, resolv.conf', 'Réseau en IP');
add('bind9', 'Linux', 'DNS Bind9 : named.conf, zones, SOA, points finaux', 'DNS — serveur Bind9');
add('lamp', 'Linux', 'Apache2, MariaDB, vhosts', 'LAMP / serveur web');
add('nginx', 'Linux', 'Serveur web nginx : vhosts, TLS', 'Serveur web nginx');
add('lx-stockage', 'Linux', 'Stockage : fstab, partitions, espace disque', 'Stockage — partitions');
add('bash', 'Linux', 'Scripts bash : droits d’exécution, cron', 'Scripting bash', 'jaune');
add('lx-secu', 'Linux', 'Sécurité Linux : SSH restreint, UFW', 'Sécurité Linux');

/* --- Sécurité / MCO --- */
add('pare-feu-win', 'Sécurité', 'Pare-feu Windows : profils, règles entrantes', 'Filtrage réseau', 'jaune');
add('pare-feu-etats', 'Sécurité', 'Pare-feu à états : ordre des règles, refus implicite', 'Pare-feu à états');
add('pfsense', 'Sécurité', 'pfSense : interfaces, règles, NAT, DMZ', 'Pare-feu pfSense');
add('portfwd', 'Sécurité', 'Redirection de port (DNAT) et publication de service', 'Port Forwarding & DMZ');
add('ipsec', 'Sécurité', 'VPN IPsec site à site (phases 1 et 2)', 'VPN IPsec site à site');
add('openvpn', 'Sécurité', 'VPN d’accès distant OpenVPN (PKI, certificats)', 'VPN d’accès distant');
add('segmentation', 'Sécurité', 'Segmentation et isolation des zones', 'Segmentation');
add('diag', 'Méthode', 'Diagnostic méthodique : isoler, vérifier, hiérarchiser', 'Habitudes de méthode');
add('diag-gpo', 'Méthode', 'Diagnostic GPO : gpresult, gpupdate, journaux', 'Diagnostic GPO');
add('proxy', 'Sécurité', 'Proxy web (Squid)', 'Proxy web', 'jaune');
add('snort', 'Sécurité', 'IDS/IPS Snort sur pfSense : instances, règles, HOME_NET, listes de passage, blocage', 'IDS / IPS — Snort sur pfSense', 'jaune');
})(typeof globalThis !== 'undefined' ? globalThis : window);
