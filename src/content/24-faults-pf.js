/* ============================================================================
   Pannes — lot D : pare-feu pfSense (règles, NAT, DMZ, routes), VPN IPsec site à site, OpenVPN.
   Données pures.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
const PF_MAIN = 'pfsense-tls', PF_REMOTE = 'pfsense-bdx';
const LAN_PASS = [{ id: 'l1', act: 'pass', proto: 'any', src: { t: 'any' }, dst: { t: 'any' }, descr: 'Autoriser LAN vers tout' }];
const OB_GOOD = { mode: 'hybrid', rules: [{ iface: 'wan', src: { t: 'net', v: '10.10.0.0/16' }, transl: 'iface', descr: 'VLAN Toulouse derrière routes statiques' }] };
const ROUTES_MAIN = [{ net: '10.10.10.0', mask: '255.255.255.0', nh: '10.10.0.2' }, { net: '10.10.20.0', mask: '255.255.255.0', nh: '10.10.0.2' }, { net: '10.10.30.0', mask: '255.255.255.0', nh: '10.10.0.2' }];
const FWD_GOOD = [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.10', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }];
const ENC0_MAIN = [{ id: 'i1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.20.0.0/16' }, dst: { t: 'net', v: '10.10.0.0/16' }, descr: 'IPsec Bordeaux → Toulouse' }];
const WAN_MAIN = [{ id: 'w1', act: 'pass', proto: 'udp', src: { t: 'any' }, dst: { t: 'ifaddr', v: 'wan' }, dport: '1194', descr: 'OpenVPN accès distant' }];
const OVPN_RULES = [{ id: 'o1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.99.0.0/24' }, dst: { t: 'alias', v: 'LAN_NETS' }, descr: 'OpenVPN → LAN' }];
const PROF = 'FormaTech-Toulouse';

/* ======================= RÈGLES / NAT / ROUTES ======================= */
add({ id: 'pf_lan_norule', level: 2, title: 'Pare-feu : aucune règle sur l’interface LAN', skills: ['pfsense', 'pare-feu-etats', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus aucun accès à Internet depuis ce matin', 'Bonjour, plus aucun site ne s’ouvre depuis ce matin sur tous les postes, mais nos dossiers partagés fonctionnent. Hier soir quelqu’un a « fait du ménage » dans les règles du pare-feu.'),
  cause: 'Toutes les règles de l’onglet LAN de pfSense ont été supprimées : sans règle de passage, le refus implicite bloque tout le trafic sortant du LAN (seule la règle anti-verrouillage de l’interface d’administration subsiste).',
  solution: 'Recréer la règle « Autoriser LAN vers tout » (ou des règles plus fines) sur l’interface LAN de pfSense.',
  hints: ['Le trafic interne (entre VLAN) ne passe pas par pfSense : seul le trafic vers l’extérieur est touché.', 'Dans l’interface web de pfSense → Firewall → Rules → LAN : la liste est-elle vide ? Consultez Status → System Logs → Firewall.', 'Ajoutez une règle Pass sur LAN (source LAN net, destination any) ou rétablissez les règles voulues.'],
  inject: [{ do: 'set', path: PF_MAIN + '.rules.lan', value: [] }],
  probes: [{ t: 'ping', from: 'PC-01', to: '8.8.8.8' }, { t: 'http', from: 'PC-ADM', url: 'https://10.10.0.1/', ignoreTls: true, hidden: true }],
  roots: [PF_MAIN + '/canon/rules/lan'],
  fix: [{ do: 'set', path: PF_MAIN + '.rules.lan', value: LAN_PASS }],
  traps: ['Désactiver le pare-feu n’existe pas dans cette console : il faut écrire une règle.'],
  optimal: ['Constater que seul le trafic vers l’extérieur est coupé', 'Ouvrir les règles du pare-feu (LAN)', 'Consulter le journal du pare-feu : refus implicite', 'Recréer la règle', 'Tester l’accès à Internet'] });

add({ id: 'pf_dmz_rule', level: 2, title: 'Pare-feu : règle DMZ sortante désactivée', skills: ['pfsense', 'segmentation', 'pare-feu-etats', 'diag'],
  ticket: tk('Admin TSSR (informatique)', 'Le serveur web de la DMZ ne peut plus se mettre à jour', 'Bonjour, depuis hier soir SRV-WEB n’arrive plus à joindre les dépôts de mises à jour (apt). Le site reste visible de l’extérieur. Un collègue dit avoir « désactivé une règle de la DMZ pour tester ».'),
  cause: 'La règle « DMZ : web sortant (mises à jour) » est désactivée : la DMZ n’a plus de passage vers l’extérieur en 80/443.',
  solution: 'Réactiver la règle DMZ web sortant sur pfSense (Firewall → Rules → DMZ) et appliquer les changements.',
  hints: ['Le site est joignable mais le serveur ne sort plus : c’est le sens DMZ → Internet qui est refusé.', 'Journal du pare-feu : un blocage « Default deny » sur l’interface DMZ pour le port 443.', 'Réactivez la règle web sortant de la DMZ.'],
  inject: [{ do: 'set', path: PF_MAIN + '.rules.dmz[id=d2].dis', value: true }],
  probes: [{ t: 'connect', from: 'SRV-WEB', to: '93.184.216.34', port: 443 }, { t: 'http', from: 'PCEXT', url: 'https://vitrine.formatech.fr/', hidden: true }],
  roots: [{ path: PF_MAIN + '.rules.dmz[id=d2].dis', ne: true }],
  fix: [{ do: 'set', path: PF_MAIN + '.rules.dmz[id=d2].dis', value: false }],
  traps: ['Ouvrir « any → any » sur la DMZ règle le symptôme et ruine la segmentation.'],
  optimal: ['Tester la sortie depuis SRV-WEB (échec)', 'Journal du pare-feu : refus sur DMZ', 'Règles DMZ : règle désactivée', 'Réactiver', 'Retester'] });

add({ id: 'pf_dmz_alias', level: 4, title: 'Alias RFC1918 amputé : la DMZ atteint le LAN', skills: ['pfsense', 'segmentation', 'pare-feu-etats', 'diag'],
  ticket: tk('Responsable sécurité', 'Audit : la DMZ peut ouvrir des connexions web vers le LAN', 'Bonjour, lors du test d’intrusion de ce matin, un équipement de la DMZ a pu joindre le serveur de fichiers du LAN en HTTPS alors que la DMZ est censée être isolée. Rien ne semble cassé côté utilisateurs, mais c’est un écart de sécurité. Merci de trouver l’origine.'),
  cause: 'L’alias RFC1918 utilisé par la règle DMZ (« web sortant : destination NON RFC1918 ») ne contient plus 10.0.0.0/8 : les adresses du LAN ne sont plus exclues et la règle autorise la DMZ à joindre le LAN en 80/443.',
  solution: 'Rétablir 10.0.0.0/8 dans l’alias RFC1918 (Firewall → Aliases), puis vérifier que la DMZ ne joint plus le LAN.',
  hints: ['Une règle autorisant « vers Internet » laisse passer des destinations internes : sur quelle condition repose son exclusion ?', 'La règle DMZ web sortant exclut un alias. Ouvrez Firewall → Aliases et lisez son contenu.', 'L’alias doit couvrir les trois blocs privés : 10.0.0.0/8, 172.16.0.0/12 et 192.168.0.0/16.'],
  inject: [{ do: 'set', path: PF_MAIN + '.aliases[name=RFC1918].values', value: ['172.16.0.0/12', '192.168.0.0/16'] }],
  probes: [{ t: 'connect', from: 'SRV-WEB', to: '10.10.10.20', port: 443, not: true, label: 'La DMZ ne doit pas joindre le LAN' }, { t: 'connect', from: 'SRV-WEB', to: '93.184.216.34', port: 443, hidden: true }],
  roots: [{ path: PF_MAIN + '.aliases[name=RFC1918].values', has: '10.0.0.0/8' }],
  fix: [{ do: 'set', path: PF_MAIN + '.aliases[name=RFC1918].values', value: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] }],
  traps: ['Ajouter une règle de blocage DMZ → LAN en tête de liste cache le défaut sans corriger l’alias partagé par d’autres règles.'],
  optimal: ['Reproduire : DMZ → LAN en 443 passe', 'Identifier la règle qui autorise', 'Lire l’alias qu’elle utilise', 'Rétablir 10.0.0.0/8', 'Retester le blocage'] });

add({ id: 'pf_nat_outbound', level: 3, title: 'NAT sortant : règle des réseaux derrière routes statiques perdue', skills: ['pfsense', 'nat-pat', 'diag'],
  vary: { m: [
    { key: 'auto', label: 'le mode a été repassé en « Automatic » (ce qui supprime la règle manuelle des réseaux derrière routes statiques)', ob: { mode: 'automatic', rules: [] } },
    { key: 'src', label: 'la règle manuelle désigne 10.10.0.0/24 au lieu de 10.10.0.0/16', ob: { mode: 'hybrid', rules: [{ iface: 'wan', src: { t: 'net', v: '10.10.0.0/24' }, transl: 'iface', descr: 'VLAN Toulouse derrière routes statiques' }] } },
    { key: 'off', label: 'le NAT sortant a été désactivé', ob: { mode: 'disabled', rules: [] } }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'Les serveurs voient Internet mais pas les postes', 'Bonjour, plus personne n’a Internet sur les postes depuis la modification du pare-feu, et pourtant je sais qu’il accepte tout le trafic du LAN. Le technicien dit que « les règles sont bonnes ».'),
  cause: 'Dans pfSense → Firewall → NAT → Outbound, {{m.label}} : les paquets des VLAN (réseaux derrière routes statiques) quittent avec une adresse privée.',
  solution: 'Rétablir la règle de NAT sortant manuelle (mode hybride) traduisant 10.10.0.0/16 vers l’adresse du WAN.',
  hints: ['Les règles de pare-feu laissent passer, mais aucune réponse ne revient : pensez à la traduction d’adresses.', 'Firewall → NAT → Outbound : mode et règles. Les VLAN sont derrière des routes statiques.', 'Le mode automatique ne couvre pas les réseaux derrière une route statique : utilisez le mode hybride avec une règle pour 10.10.0.0/16.'],
  inject: [{ do: 'set', path: PF_MAIN + '.nat.outbound', value: '{{m.ob}}' }],
  probes: [{ t: 'ping', from: 'PC-01', to: '8.8.8.8' }],
  roots: [PF_MAIN + '/canon/nat/outbound'],
  fix: [{ do: 'set', path: PF_MAIN + '.nat.outbound', value: OB_GOOD }],
  traps: ['Modifier les règles LAN n’a pas d’effet : le blocage est après le filtrage, dans la traduction.'],
  optimal: ['Constater que les règles pass', 'Firewall → NAT → Outbound', 'Repérer le mode / la règle manquante', 'Rétablir le mode hybride + règle', 'Retester'] });

add({ id: 'pf_portfwd', level: 3, title: 'Publication du site web (redirection de port) en panne', skills: ['pfsense', 'portfwd', 'pare-feu-etats', 'diag'],
  vary: { m: [
    { key: 'cible', label: 'la redirection pointe vers 10.10.50.11 au lieu de 10.10.50.10', fwd: [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.11', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }] },
    { key: 'port', label: 'la redirection écoute le port 8443 au lieu de 443', fwd: [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '8443', target: '10.10.50.10', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }] },
    { key: 'regle', label: 'la règle de filtrage associée n’a pas été créée (association « None »)', fwd: [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.10', tport: '443', assoc: 'none', descr: 'Publication vitrine HTTPS' }] },
    { key: 'iface', label: 'la redirection est attachée à l’interface LAN au lieu de WAN', fwd: [{ iface: 'lan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.10', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }] }
  ] },
  ticket: tk('Direction commerciale', 'Notre site vitrine n’est plus accessible depuis Internet', 'Bonjour, des clients nous signalent que https://vitrine.formatech.fr ne répond plus depuis hier. Depuis l’intérieur, le serveur répond normalement. Une modification du pare-feu a eu lieu hier soir.'),
  cause: 'Dans pfSense → Firewall → NAT → Port Forward, {{m.label}} : les connexions HTTPS entrantes n’atteignent plus le serveur web de la DMZ.',
  solution: 'Corriger la redirection (interface WAN, adresse WAN, port 443 → 10.10.50.10:443) avec règle de filtrage associée.',
  hints: ['Le serveur répond en local : le problème est entre Internet et lui. Testez depuis l’extérieur et lisez le journal du pare-feu.', 'Firewall → NAT → Port Forward : interface, port, cible, règle associée.', 'Rétablissez interface WAN, port 443 et cible 10.10.50.10:443 avec une règle associée.'],
  inject: [{ do: 'set', path: PF_MAIN + '.nat.portfwd', value: '{{m.fwd}}' }],
  probes: [{ t: 'http', from: 'PCEXT', url: 'https://vitrine.formatech.fr/' }],
  roots: [PF_MAIN + '/canon/nat/portfwd'],
  fix: [{ do: 'set', path: PF_MAIN + '.nat.portfwd', value: FWD_GOOD }],
  traps: ['Ouvrir toutes les entrées WAN pour « tester » expose le réseau.'],
  optimal: ['Tester depuis l’extérieur (échec)', 'Journal du pare-feu / NAT', 'Lire la redirection de port', 'Corriger', 'Retester depuis l’extérieur'] });

add({ id: 'pf_gateway', level: 3, title: 'Passerelle WAN erronée sur le pare-feu', skills: ['pfsense', 'routage', 'subnetting', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus d’Internet depuis la mise à jour de la box', 'Bonjour, plus d’Internet pour toute l’entreprise depuis que l’opérateur a changé de box ce matin. Les dossiers et l’intranet marchent.'),
  cause: 'La passerelle WAN de pfSense (WAN_GW) a été saisie avec une adresse incorrecte (198.51.100.9 au lieu de 198.51.100.1, hors de l’adresse réelle du routeur opérateur).',
  solution: 'Corriger l’adresse de la passerelle WAN (System → Routing → Gateways) : 198.51.100.1.',
  hints: ['Le pare-feu a une adresse WAN mais ne joint plus l’opérateur : testez sa passerelle depuis Diagnostics → Ping.', 'System → Routing → Gateways : l’adresse de WAN_GW est-elle dans le /30 du WAN et celle du routeur opérateur ?', 'Corrigez l’adresse de la passerelle par celle fournie par l’opérateur.'],
  inject: [{ do: 'set', path: PF_MAIN + '.gateways[0].ip', value: '198.51.100.9' }],
  probes: [{ t: 'ping', from: 'PC-01', to: '8.8.8.8' }],
  roots: [{ path: PF_MAIN + '.gateways[0].ip', eq: '198.51.100.1' }],
  fix: [{ do: 'set', path: PF_MAIN + '.gateways[0].ip', value: '198.51.100.1' }],
  traps: ['Changer l’adresse WAN du pare-feu est inutile si la passerelle est mauvaise.'],
  optimal: ['Ping 8.8.8.8 depuis un poste (échec)', 'Diagnostics → Ping depuis pfSense', 'Lire System → Routing → Gateways', 'Corriger la passerelle', 'Retester'] });

add({ id: 'pf_static_route', level: 3, title: 'Route statique manquante sur le pare-feu (retour asymétrique)', skills: ['pfsense', 'routage', 'diag'],
  vary: { m: [
    { key: 'absente', routes: [ROUTES_MAIN[0], ROUTES_MAIN[2]], label: 'la route vers 10.10.20.0/24 a été supprimée' },
    { key: 'mauvais-nh', routes: [ROUTES_MAIN[0], { net: '10.10.20.0', mask: '255.255.255.0', nh: '10.10.0.3' }, ROUTES_MAIN[2]], label: 'la route vers 10.10.20.0/24 pointe vers 10.10.0.3 au lieu de 10.10.0.2' }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'Le service compta n’a plus Internet, la direction oui', 'Bonjour, seuls les postes des services (réseau des postes) n’ont plus Internet depuis le changement de pare-feu hier. Les serveurs et la direction, eux, naviguent normalement. Les règles sont pourtant identiques pour tous.'),
  cause: 'Sur pfSense, {{m.label}} : les paquets des postes atteignent Internet mais les réponses ne trouvent pas le chemin du retour vers le VLAN 20.',
  solution: 'Rétablir la route statique 10.10.20.0/24 via 10.10.0.2 (SW-T1) : System → Routing → Static Routes.',
  hints: ['Un seul VLAN est touché : comparez le chemin du retour des réponses pour ce VLAN.', 'System → Routing → Static Routes : chaque VLAN doit avoir sa route vers SW-T1.', 'Ajoutez ou corrigez la route de 10.10.20.0/24 via 10.10.0.2 (passerelle SW-T1).'],
  inject: [{ do: 'set', path: PF_MAIN + '.routes', value: '{{m.routes}}' }],
  probes: [{ t: 'ping', from: 'PC-01', to: '8.8.8.8' }, { t: 'ping', from: 'PC-ADM', to: '8.8.8.8', hidden: true }],
  roots: [PF_MAIN + '/canon/routes'],
  fix: [{ do: 'set', path: PF_MAIN + '.routes', value: ROUTES_MAIN }],
  traps: ['Ajouter une règle de pare-feu n’a aucun effet : les paquets passent mais les réponses se perdent.'],
  optimal: ['Constater qu’un seul VLAN est touché', 'Diagnostics → Routes / traceroute depuis pfSense', 'Static Routes : route manquante', 'Rétablir la route', 'Retester'] });

/* ======================= IPSEC ======================= */
add({ id: 'pf_ipsec_p1', level: 3, title: 'IPsec phase 1 qui ne monte pas', skills: ['ipsec', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'psk', path: PF_REMOTE + '.ipsec.tunnels[0].p1.psk', bad: 'Tls-Mauvais!', good: 'Bx-Tls-2026!', label: 'la clé pré-partagée de Bordeaux ne correspond plus à celle de Toulouse (AUTHENTICATION_FAILED)' },
    { key: 'encr', path: PF_REMOTE + '.ipsec.tunnels[0].p1.encr', bad: 'aes128', good: 'aes256', label: 'l’algorithme de chiffrement de la phase 1 diffère (AES-128 d’un côté, AES-256 de l’autre : NO_PROPOSAL_CHOSEN)' },
    { key: 'dh', path: PF_REMOTE + '.ipsec.tunnels[0].p1.dh', bad: 2, good: 14, label: 'le groupe Diffie-Hellman diffère (2 d’un côté, 14 de l’autre)' },
    { key: 'ike', path: PF_REMOTE + '.ipsec.tunnels[0].p1.ike', bad: 'ikev1', good: 'ikev2', label: 'la version IKE diffère (IKEv1 à Bordeaux, IKEv2 à Toulouse)' },
    { key: 'gw', path: PF_REMOTE + '.ipsec.tunnels[0].p1.remoteGw', bad: '198.51.100.3', good: '198.51.100.2', label: 'l’adresse de la passerelle distante de Bordeaux est erronée (198.51.100.3)' }
  ] },
  ticket: tk('Elena Garcia (Bordeaux)', 'Bordeaux n’atteint plus les serveurs de Toulouse', 'Bonjour, depuis ce matin le poste de Bordeaux n’accède plus aux serveurs de Toulouse (dossiers, messagerie) mais Internet fonctionne. Un technicien a travaillé sur le pare-feu de Bordeaux hier soir.', 'bordeaux'),
  cause: 'Le tunnel IPsec Toulouse ↔ Bordeaux ne s’établit plus car, en phase 1, {{m.label}}.',
  solution: 'Aligner les paramètres de phase 1 des deux pare-feu (VPN → IPsec → Tunnels → Phase 1) puis relancer le tunnel.',
  hints: ['Internet fonctionne à Bordeaux mais pas le lien inter-sites : regardez Status → IPsec et les journaux IPsec des deux côtés.', 'Le journal indique la cause (AUTHENTICATION_FAILED, NO_PROPOSAL_CHOSEN, pas de réponse…). Les deux phases 1 doivent être identiques.', 'Corrigez la phase 1 côté fautif, puis relancez la connexion du tunnel.'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }],
  probes: [{ t: 'ipsec', dev: PF_MAIN }, { t: 'ping', from: 'PC-B1', to: '10.10.10.10' }],
  roots: [{ path: '{{m.path}}', eq: '{{m.good}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }],
  traps: ['Modifier le côté qui fonctionne casse le tunnel dans l’autre sens : comparez avant de changer.'],
  optimal: ['Constater : Internet OK / inter-sites KO', 'Status → IPsec et journaux des deux côtés', 'Repérer la cause (PSK, chiffrement, DH, IKE, passerelle)', 'Corriger la phase 1', 'Retester le ping inter-sites'] });

add({ id: 'pf_ipsec_p2', level: 4, title: 'IPsec phase 2 (sélecteurs de trafic) incompatible', skills: ['ipsec', 'pfsense', 'subnetting', 'diag'],
  vary: { m: [
    { key: 'ts', path: PF_REMOTE + '.ipsec.tunnels[0].p2[0].local', bad: '10.20.0.0/24', good: '10.20.0.0/16', label: 'le réseau local de la phase 2 à Bordeaux est 10.20.0.0/24 au lieu de 10.20.0.0/16 (TS_UNACCEPTABLE)' },
    { key: 'pfs', path: PF_REMOTE + '.ipsec.tunnels[0].p2[0].pfs', bad: 5, good: 14, label: 'le groupe PFS de la phase 2 diffère (5 à Bordeaux, 14 à Toulouse)' },
    { key: 'dis', path: PF_REMOTE + '.ipsec.tunnels[0].p2[0].dis', bad: true, good: false, label: 'la phase 2 a été désactivée à Bordeaux' }
  ] },
  ticket: tk('Elena Garcia (Bordeaux)', 'Le lien Toulouse–Bordeaux semble « connecté » mais rien ne passe', 'Bonjour, sur le pare-feu l’état du VPN indique « connecté » pourtant je n’accède toujours pas aux serveurs de Toulouse. Le technicien a juste « modifié les sous-réseaux ». Les deux sites ont Internet.', 'bordeaux'),
  cause: 'La phase 1 est établie mais la phase 2 ne s’établit pas : {{m.label}}.',
  solution: 'Aligner les phases 2 des deux pare-feu : sélecteurs de trafic miroirs (local ↔ remote), mêmes algorithmes et PFS.',
  hints: ['Phase 1 OK ne veut pas dire tunnel utilisable : regardez la ligne de la phase 2 dans Status → IPsec.', 'Journal : TS_UNACCEPTABLE ou NO_PROPOSAL_CHOSEN pour la CHILD_SA. Les sélecteurs de chaque côté doivent être le miroir l’un de l’autre.', 'Corrigez la phase 2 (réseaux, PFS, activation) sur le côté fautif.'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }],
  probes: [{ t: 'ipsec', dev: PF_MAIN }, { t: 'ping', from: 'PC-B1', to: '10.10.10.10' }],
  roots: [{ path: '{{m.path}}', eq: '{{m.good}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }],
  traps: ['Se focaliser sur la clé pré-partagée est inutile : l’authentification (phase 1) est bonne.'],
  optimal: ['Status → IPsec : phase 1 établie, phase 2 absente', 'Lire le journal IPsec (CHILD_SA)', 'Comparer les phases 2 des deux côtés', 'Corriger le sélecteur / PFS / activation', 'Retester'] });

add({ id: 'pf_ipsec_rules', level: 3, title: 'Tunnel IPsec établi mais trafic bloqué (règles IPsec)', skills: ['ipsec', 'pfsense', 'pare-feu-etats', 'diag'],
  vary: { m: [
    { key: 'vide', rules: [], label: 'l’onglet IPsec de Toulouse est vide (aucune règle de passage)' },
    { key: 'src', rules: [{ id: 'i1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.30.0.0/16' }, dst: { t: 'net', v: '10.10.0.0/16' }, descr: 'IPsec Bordeaux → Toulouse' }], label: 'la règle IPsec de Toulouse autorise 10.30.0.0/16 au lieu de 10.20.0.0/16 (réseau de Bordeaux)' }
  ] },
  ticket: tk('Elena Garcia (Bordeaux)', 'Le VPN est vert mais je n’accède à rien à Toulouse', 'Bonjour, le statut du VPN est « Established » depuis ce matin pourtant les serveurs de Toulouse ne répondent toujours pas depuis Bordeaux. Les deux sites ont Internet.', 'bordeaux'),
  cause: 'Le tunnel est monté mais, sur pfSense Toulouse, {{m.label}} : le trafic entrant par IPsec est bloqué par le refus implicite.',
  solution: 'Ajouter/corriger la règle de passage sur l’onglet IPsec de Toulouse (source 10.20.0.0/16 → destination 10.10.0.0/16).',
  hints: ['Le tunnel est établi (phases 1 et 2) : le chemin existe, mais quelque chose bloque le trafic qui y circule.', 'Status → System Logs → Firewall : des blocages sur l’interface « IPsec » ?', 'Corrigez la règle de l’onglet Firewall → Rules → IPsec.'],
  inject: [{ do: 'set', path: PF_MAIN + '.rules.enc0', value: '{{m.rules}}' }],
  probes: [{ t: 'ping', from: 'PC-B1', to: '10.10.10.10' }, { t: 'ipsec', dev: PF_MAIN, hidden: true }],
  roots: [PF_MAIN + '/canon/rules/enc0'],
  fix: [{ do: 'set', path: PF_MAIN + '.rules.enc0', value: ENC0_MAIN }],
  traps: ['Retoucher les phases 1 et 2 ne change rien : le tunnel est déjà bon.'],
  optimal: ['Status IPsec : établi', 'Journal du pare-feu : blocage sur IPsec', 'Règles IPsec de Toulouse', 'Corriger la règle', 'Retester le ping inter-sites'] });

/* ======================= OPENVPN ======================= */
add({ id: 'vpn_connect', level: 3, title: 'OpenVPN : le client ne parvient pas à établir le tunnel', skills: ['openvpn', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'expire', fix: [{ do: 'set', path: PF_MAIN + '.openvpn.certs[name=cert-tssr].expired', value: false }], inject: [{ do: 'set', path: PF_MAIN + '.openvpn.certs[name=cert-tssr].expired', value: true }], root: { path: PF_MAIN + '.openvpn.certs[name=cert-tssr].expired', ne: true }, label: 'le certificat utilisateur a expiré (VERIFY ERROR : certificate has expired)' },
    { key: 'user', fix: [{ do: 'set', path: PF_MAIN + '.openvpn.users[name=tssr].disabled', value: false }], inject: [{ do: 'set', path: PF_MAIN + '.openvpn.users[name=tssr].disabled', value: true }], root: { path: PF_MAIN + '.openvpn.users[name=tssr].disabled', ne: true }, label: 'le compte VPN de l’utilisateur est désactivé sur le serveur (AUTH_FAILED)' },
    { key: 'tls', fix: [{ do: 'set', path: 'PCEXT.vpn.profiles[name=' + PROF + '].tlsKey', value: 'tlsk-01' }], inject: [{ do: 'set', path: 'PCEXT.vpn.profiles[name=' + PROF + '].tlsKey', value: 'tlsk-ancienne' }], root: { path: 'PCEXT.vpn.profiles[name=' + PROF + '].tlsKey', eq: 'tlsk-01' }, label: 'la clé TLS (tls-crypt) du profil client est l’ancienne : le serveur rejette les paquets' },
    { key: 'port', fix: [{ do: 'set', path: 'PCEXT.vpn.profiles[name=' + PROF + '].port', value: 1194 }], inject: [{ do: 'set', path: 'PCEXT.vpn.profiles[name=' + PROF + '].port', value: 1195 }], root: { path: 'PCEXT.vpn.profiles[name=' + PROF + '].port', eq: 1194 }, label: 'le profil client vise le port 1195 alors que le serveur écoute sur 1194' },
    { key: 'proto', fix: [{ do: 'set', path: 'PCEXT.vpn.profiles[name=' + PROF + '].proto', value: 'udp' }], inject: [{ do: 'set', path: 'PCEXT.vpn.profiles[name=' + PROF + '].proto', value: 'tcp' }], root: { path: 'PCEXT.vpn.profiles[name=' + PROF + '].proto', eq: 'udp' }, label: 'le profil client est en TCP alors que le serveur est en UDP' }
  ] },
  ticket: tk('Admin TSSR (télétravail)', 'Le VPN ne se connecte plus depuis chez moi', 'Bonjour, depuis hier soir mon client OpenVPN n’arrive plus à se connecter : il tourne puis affiche une erreur. Internet fonctionne très bien chez moi. Rien n’a changé sur mon PC à ma connaissance.', 'internet'),
  cause: 'L’accès distant OpenVPN échoue : {{m.label}}.',
  solution: 'Corriger l’élément fautif (profil client, certificat ou compte VPN) puis reconnecter ; lire le journal du client et celui du serveur (Status → System Logs → OpenVPN).',
  hints: ['Lisez le journal du client OpenVPN : la dernière ligne avant l’échec donne la piste (VERIFY ERROR, AUTH_FAILED, TLS handshake failed…).', 'Comparez ce que le profil client attend et ce que le serveur propose (port, protocole, clé TLS, certificat, utilisateur).', 'Corrigez le paramètre fautif puis reconnectez le client.'],
  inject: '{{m.inject}}',
  probes: [{ t: 'vpn', client: 'PCEXT', profile: PROF }],
  roots: ['{{m.root}}'],
  fix: '{{m.fix}}',
  traps: ['Ouvrir davantage le pare-feu WAN ne règle pas une erreur de certificat, de clé ou de compte.'],
  optimal: ['Lire le journal du client', 'Lire le journal OpenVPN du serveur', 'Identifier l’élément fautif', 'Corriger', 'Reconnecter le client'] });

add({ id: 'vpn_wanrule', level: 3, title: 'OpenVPN : règle WAN absente, désactivée ou erronée', skills: ['openvpn', 'pfsense', 'pare-feu-etats', 'diag'],
  vary: { m: [
    { key: 'absente', rules: [], label: 'la règle de l’onglet WAN autorisant UDP 1194 a été supprimée' },
    { key: 'port', rules: [{ id: 'w1', act: 'pass', proto: 'udp', src: { t: 'any' }, dst: { t: 'ifaddr', v: 'wan' }, dport: '1195', descr: 'OpenVPN accès distant' }], label: 'la règle WAN autorise le port 1195 au lieu de 1194' },
    { key: 'proto', rules: [{ id: 'w1', act: 'pass', proto: 'tcp', src: { t: 'any' }, dst: { t: 'ifaddr', v: 'wan' }, dport: '1194', descr: 'OpenVPN accès distant' }], label: 'la règle WAN est en TCP alors que le serveur est en UDP' }
  ] },
  ticket: tk('Admin TSSR (télétravail)', 'Le VPN tourne dans le vide : « TLS handshake failed »', 'Bonjour, le client OpenVPN affiche « TLS key negotiation failed to occur within 60 seconds » en boucle depuis le changement de règles du pare-feu. Mon profil n’a pas changé.', 'internet'),
  cause: 'Sur pfSense Toulouse, {{m.label}} : les paquets du client VPN sont bloqués par le refus implicite avant d’atteindre le serveur OpenVPN.',
  solution: 'Rétablir la règle WAN : Pass, UDP, destination WAN address, port 1194.',
  hints: ['« TLS key negotiation failed » sans autre message = aucun paquet de réponse : suspectez un blocage réseau avant le serveur.', 'Status → System Logs → Firewall : voyez le blocage de l’UDP 1194 sur l’interface WAN.', 'Rétablissez la règle WAN pour UDP 1194.'],
  inject: [{ do: 'set', path: PF_MAIN + '.rules.wan', value: '{{m.rules}}' }],
  probes: [{ t: 'vpn', client: 'PCEXT', profile: PROF }],
  roots: [PF_MAIN + '/canon/rules/wan'],
  fix: [{ do: 'set', path: PF_MAIN + '.rules.wan', value: WAN_MAIN }],
  traps: ['Régénérer les certificats ne sert à rien : les paquets n’arrivent même pas jusqu’au serveur.'],
  optimal: ['Lire le journal client (timeout)', 'Journal du pare-feu : blocage WAN 1194', 'Corriger la règle WAN', 'Reconnecter'] });

add({ id: 'vpn_access', level: 3, title: 'OpenVPN : tunnel établi mais aucun accès au LAN (règles OpenVPN)', skills: ['openvpn', 'pfsense', 'pare-feu-etats', 'diag'],
  vary: { m: [
    { key: 'absente', rules: [], label: 'l’onglet OpenVPN est vide (aucune règle de passage)' },
    { key: 'src', rules: [{ id: 'o1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.98.0.0/24' }, dst: { t: 'alias', v: 'LAN_NETS' }, descr: 'OpenVPN → LAN' }], label: 'la règle OpenVPN autorise 10.98.0.0/24 au lieu du réseau du tunnel 10.99.0.0/24' }
  ] },
  ticket: tk('Admin TSSR (télétravail)', 'VPN connecté mais je n’accède à aucun serveur', 'Bonjour, le client VPN affiche « connecté », j’ai bien une adresse en 10.99.0.x, mais je n’arrive à joindre aucun serveur de l’entreprise (ni les dossiers, ni l’intranet).', 'internet'),
  cause: 'Le tunnel OpenVPN est monté mais, sur pfSense, {{m.label}} : le trafic des clients VPN vers le LAN est bloqué.',
  solution: 'Rétablir la règle de l’onglet OpenVPN : Pass, source 10.99.0.0/24, destination LAN_NETS.',
  hints: ['La connexion est établie : le problème est après le tunnel, au niveau du filtrage.', 'Journal du pare-feu : blocage sur l’interface OpenVPN.', 'Corrigez ou recréez la règle de l’onglet OpenVPN.'],
  inject: [{ do: 'set', path: PF_MAIN + '.rules.ovpns1', value: '{{m.rules}}' }],
  probes: [{ t: 'vpn', client: 'PCEXT', profile: PROF, hidden: true }, { t: 'vpnuse', client: 'PCEXT', profile: PROF, to: '10.10.10.10' }],
  roots: [PF_MAIN + '/canon/rules/ovpns1'],
  fix: [{ do: 'set', path: PF_MAIN + '.rules.ovpns1', value: OVPN_RULES }],
  traps: ['Rouvrir la règle WAN ou régénérer le certificat ne sert à rien : la connexion est déjà établie.'],
  optimal: ['Constater : connecté mais aucun accès', 'Journal du pare-feu : blocage OpenVPN', 'Règles OpenVPN', 'Corriger la règle', 'Retester l’accès au serveur'] });

add({ id: 'vpn_routes', level: 4, title: 'OpenVPN : réseaux poussés incomplets (accès partiel)', skills: ['openvpn', 'routage', 'pfsense', 'diag'],
  ticket: tk('Admin TSSR (télétravail)', 'En VPN j’accède aux serveurs mais pas au poste d’administration', 'Bonjour, une fois connecté en VPN je vois bien les serveurs (10.10.10.x) mais impossible de joindre le poste d’administration ni le réseau des postes. Hier, tout était accessible.'),
  cause: 'Le serveur OpenVPN ne pousse plus que 10.10.10.0/24 aux clients (« Local Network(s) ») : les routes vers 10.10.20.0/24 et 10.10.30.0/24 n’arrivent pas côté client.',
  solution: 'Rétablir les réseaux locaux poussés : 10.10.0.0/16 (VPN → OpenVPN → Servers → Local Network(s)).',
  hints: ['Certains réseaux répondent, d’autres non, depuis le même tunnel : une route manque côté client.', 'Sur le client, route print : quelles routes ont été reçues ? Sur le serveur, « Local Network(s) » de l’instance.', 'Complétez la liste des réseaux poussés puis reconnectez le client.'],
  inject: [{ do: 'set', path: PF_MAIN + '.openvpn.servers[id=1].localNets', value: ['10.10.10.0/24'] }],
  probes: [{ t: 'vpnuse', client: 'PCEXT', profile: PROF, to: '10.10.10.10', hidden: true }, { t: 'vpnuse', client: 'PCEXT', profile: PROF, to: '10.10.30.10' }],
  roots: [{ any: [{ path: PF_MAIN + '.openvpn.servers[id=1].localNets', eq: ['10.10.0.0/16'] }, { path: PF_MAIN + '.openvpn.servers[id=1].localNets', eq: ['10.10.10.0/24', '10.10.20.0/24', '10.10.30.0/24'] }] }],
  fix: [{ do: 'set', path: PF_MAIN + '.openvpn.servers[id=1].localNets', value: ['10.10.0.0/16'] }],
  traps: ['Ajouter une route à la main sur le poste distant ne règle que ce poste.'],
  optimal: ['Constater l’accès partiel', 'route print côté client', 'Local Network(s) côté serveur', 'Compléter la liste', 'Reconnecter et retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
