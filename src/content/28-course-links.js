/* ============================================================================
   Liens de révision : quand un ticket n'est pas validé (note < 75, abandon, temps écoulé), le débrief propose les pages de cours,
   procédures et TP correspondant aux compétences de la panne, sur le site de formation https://tssr.miyukini.com (site d'un camarade
   de formation, consultable en ligne uniquement).
   Sécurité : l'hôte est FIXE, seuls des chemins écrits ici sont utilisés (aucune URL fournie par un scénario ou par le joueur).
   Les chemins ont été relevés sur le site (titre de page contrôlé pour chacun) ; le site est un rendu côté client : un chemin inconnu renvoie
   HTTP 200 avec un titre générique, d'où le contrôle du titre. Si le site change, seule cette table est à mettre à jour.
   Écarts connus : aucun cours nginx sur le site (le plus proche : virtualhosts Apache) ; aucun cours Snort (le plus proche : l'IDS d'OPNsense) ; le site couvre aussi HSRP, OPNsense… hors fiche
   de compétences : ces pages ne sont jamais proposées ici (OSPF, entré dans la fiche v21, a ses liens).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM;
const L = SIM.courseLinks = { host: 'https://tssr.miyukini.com', skills: {}, fallback: [] };
const c = (path, label, kind) => ({ path, label, kind: kind || 'cours' });
const P = (path, label) => c(path, label, 'procédure'), T = (path, label) => c(path, label, 'TP');
const S = (id, links) => { L.skills[id] = links; };

/* Windows */
S('dhcp', [c('/procedure-dhcp', 'Installer et configurer DHCP', 'procédure'), c('/adresses-ip', 'Les adresses IP')]);
S('dhcp-auth', [P('/procedure-dhcp', 'Installer et configurer DHCP'), c('/roles-windows-server', 'Les rôles Windows Server')]);
S('dhcp-relay', [P('/procedure-dhcp-relais', 'DHCP : agent de relais'), P('/procedure-dhcp-packet-tracer', 'DHCP sous Packet Tracer')]);
S('dns', [P('/procedure-dns', 'Installer et configurer DNS')]);
S('iis', [P('/procedure-iis', 'Installer et configurer IIS'), c('/hebergement-web', 'L’hébergement web')]);
S('ad-install', [P('/procedure-installation-active-directory', 'Installer Active Directory'), c('/vocabulaire-active-directory', 'Vocabulaire Active Directory')]);
S('agdlp', [P('/procedure-agdlp', 'AGDLP : groupes et permissions'), T('/tp-ad-fichiers-droits', 'TP : fichiers et droits sur AD')]);
S('ntfs-partage', [c('/permissions-partage-ntfs', 'Permissions de partage et NTFS'), P('/procedure-partage-ntfs', 'Partage et permissions NTFS'), T('/tp-ad-fichiers-droits', 'TP : fichiers et droits sur AD')]);
S('ad-ou', [P('/procedure-ad-objets', 'Objets Active Directory'), T('/tp-ad-decouverte', 'TP : découverte d’Active Directory')]);
S('gpo', [c('/cours-gpo', 'Les stratégies de groupe (GPO)'), P('/procedure-gpo', 'Créer et lier une GPO'), T('/tp-ad-gpo', 'TP : GPO')]);
S('gpo-heritage', [c('/cours-gpo', 'Les stratégies de groupe (GPO)'), P('/procedure-gpo', 'Créer et lier une GPO'), T('/tp-ad-gpo', 'TP : GPO')]);
S('gpo-filtrage', [c('/cours-gpo', 'Les stratégies de groupe (GPO)'), P('/procedure-gpo', 'Créer et lier une GPO'), T('/tp-ad-gpo', 'TP : GPO')]);
S('gpo-compte', [c('/cours-gpo', 'Les stratégies de groupe (GPO)'), P('/procedure-securite-poste', 'Sécuriser un poste')]);
S('ad-trust', [P('/procedure-approbation-ad', 'Approbation entre domaines'), c('/administration-domaine-ad', 'Administration d’un domaine')]);
S('ad-compte', [c('/gestion-avancee-utilisateurs', 'Gestion avancée des utilisateurs'), P('/procedure-ad-objets', 'Objets Active Directory')]);
/* Réseau et Cisco */
S('subnetting', [c('/calcul-ip-masque', 'Calcul IP et masque'), P('/procedure-ip-fixe-windows', 'IP fixe sous Windows'), P('/procedure-test-connectivite', 'Tester la connectivité')]);
S('vlan', [c('/les-vlan', 'Les VLAN'), P('/procedure-vlan-packet-tracer', 'VLAN sous Packet Tracer'), T('/tp-vlan-1', 'TP VLAN 1')]);
S('trunk', [c('/les-vlan', 'Les VLAN'), T('/tp-vlan-2', 'TP VLAN 2')]);
S('roas', [c('/les-vlan', 'Les VLAN'), T('/tp-vlan-2', 'TP VLAN 2'), T('/tp-vlan-3', 'TP VLAN 3 (SVI)')]);
S('routage', [c('/cisco-route-statique', 'Cisco : routes statiques'), P('/procedure-routes-statiques', 'Configurer des routes statiques'), c('/le-routeur', 'Le routeur')]);
S('ospf-multi', [c('/ospf', 'OSPF : le routage dynamique'), c('/routage-dynamique', 'Le routage dynamique : RIP, OSPF, EIGRP, BGP'), T('/tp-ospf-ha', 'TP OSPF : routage dynamique, NAT et bascule (corrigé)')]);
S('ospf', [c('/ospf', 'OSPF : le routage dynamique'), c('/routage-dynamique', 'Le routage dynamique : RIP, OSPF, EIGRP, BGP'), T('/tp-ospf-ha', 'TP OSPF : routage dynamique, NAT et bascule (corrigé)')]);
S('nat-pat', [c('/cisco-nat', 'Cisco : NAT'), P('/procedure-nat-pat', 'Configurer NAT et PAT')]);
S('ssh-cisco', [P('/procedure-ssh-packet-tracer', 'SSH sous Packet Tracer'), c('/le-ssh', 'Le protocole SSH')]);
S('acl', [c('/cisco-acl', 'Cisco : ACL'), P('/procedure-acl', 'Configurer des ACL')]);
S('switch-secu', [c('/vlan-securite', 'VLAN et sécurité'), P('/procedure-vlan-securite', 'Sécuriser les VLAN')]);
S('phys', [c('/maintenance-materielle-niveau-1', 'Maintenance matérielle de niveau 1'), c('/bases-du-reseau', 'Bases du réseau')]);
/* Linux */
S('lx-droits', [c('/linux-droits', 'Linux : droits'), T('/tp-utilisateurs-droits', 'TP : utilisateurs et droits')]);
S('lx-acl', [c('/linux-acl', 'Linux : ACL'), c('/linux-droits', 'Linux : droits')]);
S('lx-ssh', [c('/linux-ssh', 'Linux : SSH'), T('/tp-ssh-securisation', 'TP : sécuriser SSH'), P('/procedure-cle-ssh', 'Authentification par clé SSH')]);
S('lx-services', [c('/linux-systemd', 'Linux : systemd'), P('/procedure-systemd-service', 'Créer un service systemd')]);
S('lx-reseau', [c('/linux-reseau', 'Linux : réseau'), T('/tp-config-reseau-statique', 'TP : configuration réseau statique')]);
S('bind9', [P('/procedure-dns-linux-bind9', 'DNS avec BIND9'), T('/tp-dns-bind9-directe', 'TP : BIND9, zone directe'), P('/procedure-dns-linux-bind9-inverse', 'BIND9 : zone inverse')]);
S('lamp', [c('/linux-apache', 'Linux : Apache'), P('/procedure-apache-linux', 'Installer Apache'), T('/tp-apache-virtualhosts', 'TP : virtualhosts Apache')]);
S('nginx', [c('/linux-apache-virtualhosts', 'Apache : virtualhosts (le plus proche de nginx : pas de cours nginx sur le site)'), c('/linux-systemd', 'Linux : systemd')]);
S('lx-stockage', [c('/linux-disques', 'Linux : disques'), P('/procedure-linux-lvm', 'LVM sous Linux')]);
S('bash', [c('/linux-bash', 'Linux : bash'), P('/procedure-cron-journaux', 'Cron et journaux'), c('/linux-cron-logs', 'Cron et logs')]);
S('lx-secu', [c('/durcissement-linux', 'Durcissement Linux'), T('/tp-ssh-securisation', 'TP : sécuriser SSH')]);
S('etherchannel', [T('/tp-etherchannel-hsrp', 'TP Agrégation de liens et FHRP : EtherChannel et HSRP (corrigé)'), c('/le-switch', 'Le switch'), c('/les-vlan', 'Les VLAN')]);
/* Sécurité et pare-feu */
S('snort', [c('/opnsense-vpn-ids', 'Détection d’intrusion (IDS) sous OPNsense : le plus proche, pas de cours Snort sur le site'), c('/le-pare-feu', 'Le pare-feu')]);
S('pare-feu-win', [P('/procedure-pare-feu-windows', 'Pare-feu Windows'), c('/astuce-pare-feu-ping', 'Astuce : pare-feu et ping')]);
S('pare-feu-etats', [c('/le-pare-feu', 'Le pare-feu'), P('/procedure-tp-pfsense-dmz', 'pfSense et DMZ')]);
S('pfsense', [P('/procedure-tp-pfsense-dmz', 'pfSense et DMZ'), c('/le-pare-feu', 'Le pare-feu')]);
S('portfwd', [P('/procedure-tp-pfsense-dmz', 'pfSense et DMZ'), c('/opnsense-nat', 'NAT et redirection de ports (OPNsense)')]);
S('ipsec', [P('/procedure-vpn-ipsec-pfsense', 'VPN IPsec avec pfSense'), c('/vpn-site-a-site', 'VPN site à site'), c('/le-vpn', 'Le VPN')]);
S('openvpn', [c('/openvpn-pfsense', 'OpenVPN avec pfSense'), c('/le-vpn', 'Le VPN')]);
S('segmentation', [c('/dmz', 'La DMZ'), P('/dmz-mise-en-place', 'Mettre en place une DMZ'), c('/opnsense-segmentation', 'Segmentation réseau')]);
S('proxy', [c('/proxy-squid', 'Le proxy Squid')]);
/* Méthode : repli lorsqu'aucune compétence technique spécifique n'est rattachée à la panne */
S('diag', [c('/depannage', 'Méthode de dépannage'), c('/les-7-couches-osi', 'Les 7 couches OSI'), P('/procedure-test-connectivite', 'Tester la connectivité')]);
S('diag-gpo', [c('/cours-gpo', 'Les stratégies de groupe (GPO)'), c('/depannage', 'Méthode de dépannage')]);
L.fallback = L.skills.diag;

L.url = path => (typeof path === 'string' && /^\/[a-z0-9\-]+$/.test(path)) ? L.host + path : null;
/* Liens à proposer pour une liste de compétences : les compétences techniques d'abord (diag et diag-gpo seulement en repli), au plus `max` liens. */
L.forSkills = function (skillIds, max) {
  max = max || 8; const ids = Array.from(new Set(skillIds || []));
  const tech = ids.filter(i => i !== 'diag' && i !== 'diag-gpo' && L.skills[i]); const order = tech.length ? tech.concat(ids.filter(i => i === 'diag-gpo' && L.skills[i])) : ids.filter(i => L.skills[i]);
  const groups = []; const seen = new Set(); let n = 0;
  order.forEach(id => {
    const links = []; (L.skills[id] || []).forEach(l => { if (n >= max || seen.has(l.path)) return; const url = L.url(l.path); if (!url) return; seen.add(l.path); links.push({ path: l.path, url, label: l.label, kind: l.kind }); n++; });
    if (links.length) groups.push({ skill: id, label: (SIM.skills[id] || { label: id }).label, links });
  });
  if (!groups.length) groups.push({ skill: 'diag', label: 'Méthode de dépannage', links: L.fallback.map(l => ({ path: l.path, url: L.url(l.path), label: l.label, kind: l.kind })) });
  return groups;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
