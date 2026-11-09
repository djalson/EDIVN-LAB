/* ============================================================================
   Pannes — lot C : commutation et routage Cisco (ports, VLAN, trunk, ROAS, SVI, routes, NAT, ACL,
   SSH, port-security). Données pures.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
const reDhcp = h => [{ do: 'release', dev: h }, { do: 'renew', dev: h }];
const PORT = (sw, p) => sw + '.ports.' + p;
const IFACE = (dev, i) => dev + ".ifaces['" + i + "']";

/* ======================= PORTS D'ACCÈS ======================= */
add({ id: 'c_shutdown', level: 2, title: 'Port du commutateur désactivé (shutdown)', skills: ['vlan', 'phys', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus de réseau sur mon poste (câble pourtant branché)', 'Bonjour, mon poste n’a plus de réseau depuis hier soir : l’icône réseau indique que le câble est débranché mais il est bien enfoncé des deux côtés. Un collègue a changé la prise voisine, je ne sais pas si c’est lié.'),
  cause: 'Le port Fa0/2 de SW-T2 (prise T-114) a été désactivé administrativement (shutdown) lors d’une intervention sur la baie.',
  solution: 'Se connecter à SW-T2 et réactiver le port : interface FastEthernet0/2 → no shutdown.',
  hints: ['Le câble est bon des deux côtés : regardez l’état du port côté commutateur.', 'show interfaces status : un port « disabled » est désactivé par la configuration.', 'Dans la configuration de l’interface, no shutdown, puis vérifiez le voyant et renouvelez l’adresse.'],
  inject: [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.adminDown', value: true }, ...reDhcp('PC-01')],
  probes: [{ t: 'link', dev: 'PC-01', port: 'Ethernet0' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: [{ path: PORT('SW-T2', 'FastEthernet0/2') + '.adminDown', ne: true }],
  fix: [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.adminDown', value: false }, { do: 'renew', dev: 'PC-01' }],
  traps: ['Changer de câble ou de prise murale n’apporte rien : le port est éteint par configuration.'],
  optimal: ['Constater « câble débranché » alors qu’il est branché', 'Se connecter en SSH à SW-T2', 'show interfaces status : Fa0/2 disabled', 'no shutdown', 'ipconfig /renew et test'] });

add({ id: 'c_vlan_port', level: 2, title: 'Port d’accès affecté au mauvais VLAN', skills: ['vlan', 'dhcp-relay', 'diag'],
  vary: { m: [{ key: 'vlan30', vlan: 30, label: 'VLAN 30 (ADMIN)' }, { key: 'vlan10', vlan: 10, label: 'VLAN 10 (SERVEURS)' }, { key: 'vlan1', vlan: 1, label: 'VLAN 1 (par défaut)' }] },
  ticket: tk('Alice Martin (la comptabilité)', 'Ordinateur sans réseau depuis le déménagement du bureau', 'Bonjour, depuis que mon bureau a été déplacé, mon ordinateur affiche « réseau non identifié ». Le câble est branché, le voyant est allumé. Un technicien est passé hier pour reconfigurer la prise.'),
  cause: 'Le port Fa0/2 de SW-T2 a été placé dans {{m.label}} au lieu du VLAN 20 (postes) : le poste est dans un autre réseau et n’obtient pas de bail DHCP.',
  solution: 'Remettre le port en VLAN 20 : interface FastEthernet0/2 → switchport access vlan 20, puis renouveler le bail.',
  hints: ['Le poste a une liaison mais une adresse en 169.254.x.x : pas de DHCP. Dans quel VLAN est son port ?', 'show vlan brief / show interfaces status sur SW-T2 : repérez le VLAN du port Fa0/2.', 'switchport access vlan 20 sur l’interface, puis ipconfig /renew.'],
  inject: [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.vlan', value: '{{m.vlan}}' }, ...reDhcp('PC-01')],
  probes: [{ t: 'ip', host: 'PC-01', net: '10.10.20.0/24' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: [{ path: PORT('SW-T2', 'FastEthernet0/2') + '.vlan', eq: 20 }],
  fix: [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.vlan', value: 20 }, { do: 'renew', dev: 'PC-01' }],
  traps: ['Mettre une IP statique ne sert à rien : le port n’est pas dans le bon réseau.', 'Créer ou renommer un VLAN ne corrige pas : le port doit simplement retrouver le VLAN 20.'],
  optimal: ['ipconfig : 169.254.x.x', 'SSH sur SW-T2', 'show vlan brief : Fa0/2 dans le mauvais VLAN', 'switchport access vlan 20', 'ipconfig /renew et test'] });

add({ id: 'c_vlan_missing', level: 3, title: 'VLAN supprimé de la base du commutateur', skills: ['vlan', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Les postes de ma rangée n’ont plus de réseau', 'Bonjour, depuis ce matin les trois postes de ma rangée (dont le mien) n’ont plus de réseau. Les autres étages fonctionnent. Hier un technicien a « fait du ménage » dans la configuration du commutateur du couloir.'),
  cause: 'Le VLAN 20 a été supprimé de la base de VLAN de SW-T2 : tous les ports d’accès appartenant au VLAN 20 passent « inactifs » (le port reste dans le VLAN supprimé tant qu’on ne le recrée pas).',
  solution: 'Recréer le VLAN 20 (name POSTES) sur SW-T2 : les ports redeviennent actifs. Penser à vérifier la base de VLAN des autres commutateurs.',
  hints: ['Le port est branché, le poste a une liaison, mais plus de réseau : regardez l’état du port côté commutateur.', 'show interfaces status : le port est « inactive » ? show vlan brief : le VLAN 20 est-il listé ?', 'Recréez le VLAN 20 (vlan 20 / name POSTES) puis renouvelez l’adresse du poste.'],
  inject: [{ do: 'del', path: 'SW-T2.vlans.20' }, ...reDhcp('PC-01')],
  probes: [{ t: 'ip', host: 'PC-01', net: '10.10.20.0/24' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: [{ path: 'SW-T2.vlans.20' }],
  fix: [{ do: 'set', path: 'SW-T2.vlans.20', value: { name: 'POSTES' } }, { do: 'renew', dev: 'PC-01' }],
  traps: ['Changer le port de VLAN (par exemple 1) donne un lien mais pas le bon réseau.'],
  optimal: ['Constater la panne sur toute la rangée', 'show interfaces status : inactive', 'show vlan brief : VLAN 20 absent', 'Recréer le VLAN 20', 'Renouveler l’adresse et tester'] });

add({ id: 'c_portsec', level: 3, title: 'Port en err-disabled (port-security) après changement de carte réseau', skills: ['switch-secu', 'vlan', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus de réseau depuis le remplacement de ma carte réseau', 'Bonjour, hier le service informatique a remplacé la carte réseau de mon poste (elle était défaillante). Depuis, plus aucun réseau : le voyant de la prise est éteint alors que le câble est bien branché des deux côtés.'),
  cause: 'La sécurité de port (port-security) de Fa0/2 sur SW-T2 n’autorise que l’ancienne adresse MAC apprise (sticky) : la nouvelle carte provoque une violation et le port passe en err-disabled.',
  solution: 'Effacer l’ancienne adresse sticky (ou autoriser la nouvelle), puis réinitialiser le port (shutdown / no shutdown). Ne pas désactiver la sécurité de port.',
  hints: ['Le voyant de la prise est éteint côté commutateur mais le câble est bon : regardez l’état du port.', 'show interfaces status : err-disabled. show port-security interface Fa0/2 et le journal du commutateur donnent la cause.', 'Supprimez l’ancienne adresse sticky (ou ajustez le maximum), puis shutdown / no shutdown sur le port.'],
  inject: [{ do: 'set', path: 'PC-01.ifaces.Ethernet0.mac', value: '00:50:56:ab:cd:01' }, { do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.errdisabled', value: true },
    { do: 'log', dev: 'SW-T2', chan: 'syslog', msg: '%PM-4-ERR_DISABLE: psecure-violation error detected on Fa0/2, putting Fa0/2 in err-disable state', ageSec: 900 },
    { do: 'log', dev: 'SW-T2', chan: 'syslog', msg: '%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address 0050.56ab.cd01 on port FastEthernet0/2.', ageSec: 900 }, ...reDhcp('PC-01')],
  probes: [{ t: 'psec', dev: 'SW-T2', port: 'FastEthernet0/2' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: [{ probe: { t: 'psec', dev: 'SW-T2', port: 'FastEthernet0/2' } }, { path: PORT('SW-T2', 'FastEthernet0/2') + '.psec.enabled', eq: true }],
  fix: [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.psec.macs', value: [] }, { do: 'ios.recover', dev: 'SW-T2', port: 'FastEthernet0/2' }, { do: 'renew', dev: 'PC-01' }],
  fixes: { 'maximum': [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.psec.max', value: 2 }, { do: 'ios.recover', dev: 'SW-T2', port: 'FastEthernet0/2' }, { do: 'renew', dev: 'PC-01' }],
    'nouvelle-mac': [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.psec.macs', value: ['00:50:56:ab:cd:01'] }, { do: 'ios.recover', dev: 'SW-T2', port: 'FastEthernet0/2' }, { do: 'renew', dev: 'PC-01' }] },
  workarounds: { 'sans-securite': [{ do: 'set', path: PORT('SW-T2', 'FastEthernet0/2') + '.psec.enabled', value: false }, { do: 'ios.recover', dev: 'SW-T2', port: 'FastEthernet0/2' }, { do: 'renew', dev: 'PC-01' }] },
  traps: ['Un simple shutdown / no shutdown sans corriger l’adresse autorisée remet le port aussitôt en err-disabled.', 'Supprimer la sécurité de port rétablit le réseau mais retire la protection.'],
  optimal: ['show interfaces status : err-disabled', 'show port-security interface / journal : violation', 'Effacer l’ancienne MAC sticky', 'shutdown puis no shutdown', 'Renouveler l’adresse et tester'] });

/* ======================= TRUNKS ======================= */
add({ id: 'c_trunk_allowed', level: 3, title: 'VLAN absent de la liste autorisée du trunk', skills: ['trunk', 'vlan', 'diag'],
  vary: { c: [
    { sw: 'SW-T2', host: 'PC-01', bad: [10, 30], good: [10, 20, 30], who: 'SW-T2', label: 'les postes des commutateurs SW-T2 et SW-T3' },
    { sw: 'SW-T3', host: 'PC-02', bad: [30], good: [20, 30], who: 'SW-T3', label: 'les postes branchés sur SW-T3' }
  ] },
  ticket: tk('Bruno Durand (les RH)', 'Plus d’adresse réseau pour plusieurs postes', 'Bonjour, depuis la maintenance de la nuit plusieurs postes n’ont plus de réseau : « réseau non identifié ». Le technicien dit avoir seulement « ajouté le VLAN 30 sur la liaison entre les commutateurs ». Les serveurs fonctionnent.'),
  cause: 'Sur le trunk Gi0/1 de {{c.who}}, la liste des VLAN autorisés a été remplacée (switchport trunk allowed vlan …) au lieu d’être complétée (add) : le VLAN 20 ne traverse plus la liaison, {{c.label}} perdent le réseau.',
  solution: 'Réintroduire le VLAN 20 : switchport trunk allowed vlan add 20 (des deux côtés du trunk), puis renouveler les baux.',
  hints: ['Les serveurs (VLAN 10) fonctionnent, les postes (VLAN 20) non : un VLAN précis ne passe plus entre deux commutateurs.', 'show interfaces trunk sur les deux commutateurs : comparez « VLANs allowed » de la liaison.', 'switchport trunk allowed vlan add 20 sur la liaison concernée, puis ipconfig /renew.'],
  inject: [{ do: 'set', path: PORT('{{c.sw}}', 'GigabitEthernet0/1') + '.allowed', value: '{{c.bad}}' }, ...reDhcp('{{c.host}}')],
  probes: [{ t: 'ip', host: '{{c.host}}', net: '10.10.20.0/24' }, { t: 'ping', from: '{{c.host}}', to: '10.10.20.1' }],
  roots: [{ any: [{ path: PORT('{{c.sw}}', 'GigabitEthernet0/1') + '.allowed', eq: '{{c.good}}' }, { path: PORT('{{c.sw}}', 'GigabitEthernet0/1') + '.allowed', eq: 'all' }] }],
  fix: [{ do: 'set', path: PORT('{{c.sw}}', 'GigabitEthernet0/1') + '.allowed', value: '{{c.good}}' }, { do: 'renew', dev: '{{c.host}}' }],
  traps: ['Mettre tous les VLAN en autorisé règle le symptôme mais élargit le trunk au-delà du besoin.', 'Réparer un seul côté du trunk ne suffit pas toujours : comparez les deux extrémités.'],
  optimal: ['ipconfig : 169.254.x.x', 'show interfaces trunk sur SW-T2 / SW-T3', 'Repérer le VLAN 20 absent', 'switchport trunk allowed vlan add 20', 'Renouveler le bail et tester'] });

add({ id: 'c_trunk_native', level: 4, title: 'VLAN natif différent aux deux extrémités du trunk', skills: ['trunk', 'vlan', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Les postes sur le dernier commutateur n’atteignent plus le réseau', 'Bonjour, depuis la reconfiguration de la liaison entre les deux commutateurs du bâtiment, mon poste ne peut plus joindre ni les serveurs ni Internet. Il a bien une adresse IP au début de la journée puis plus rien. Le technicien a parlé de « VLAN natif ».'),
  cause: 'Le VLAN natif du trunk SW-T2 Gi0/2 a été changé en 20 alors qu’il vaut 1 côté SW-T3 : le trafic du VLAN 20 part sans étiquette et est reçu dans le VLAN 1 par SW-T3 (fuite de VLAN) ; les postes de SW-T3 sont isolés de leur passerelle.',
  solution: 'Remettre le même VLAN natif (1) aux deux extrémités du trunk : interface Gi0/2 de SW-T2 → switchport trunk native vlan 1. Surveiller le message CDP « NATIVE_VLAN_MISMATCH ».',
  hints: ['Seuls les postes derrière SW-T3 sont touchés : comparez la configuration des deux extrémités de la liaison SW-T2 ↔ SW-T3.', 'show interfaces trunk sur les deux commutateurs : la colonne « Native vlan » doit être identique.', 'Rétablissez le VLAN natif 1 des deux côtés.'],
  inject: [{ do: 'set', path: PORT('SW-T2', 'GigabitEthernet0/2') + '.native', value: 20 }, ...reDhcp('PC-02')],
  probes: [{ t: 'ip', host: 'PC-02', net: '10.10.20.0/24' }, { t: 'ping', from: 'PC-02', to: '10.10.20.1' }],
  roots: [{ path: PORT('SW-T2', 'GigabitEthernet0/2') + '.native', eq: 1 }],
  fix: [{ do: 'set', path: PORT('SW-T2', 'GigabitEthernet0/2') + '.native', value: 1 }, { do: 'renew', dev: 'PC-02' }],
  traps: ['Changer les VLAN des ports d’accès ne sert à rien : la fuite vient du trunk.'],
  optimal: ['Constater que seul SW-T3 est touché', 'show interfaces trunk des deux côtés', 'Repérer les VLAN natifs différents', 'Aligner le VLAN natif', 'Renouveler le bail et tester'] });

/* ======================= COUCHE 3 : SVI, ROAS, ROUTES ======================= */
add({ id: 'c_svi', level: 3, title: 'Passerelle VLAN (SVI) éteinte ou mal adressée', skills: ['roas', 'vlan', 'subnetting', 'diag'],
  vary: { m: [
    { key: 'shut', label: 'l’interface Vlan20 de SW-T1 est désactivée (shutdown)', path: 'SW-T1.svi.Vlan20.shut', bad: true, good: false },
    { key: 'ip', label: 'l’interface Vlan20 de SW-T1 porte une mauvaise adresse (10.10.21.1/24 au lieu de 10.10.20.1/24)', path: 'SW-T1.svi.Vlan20.ip', bad: '10.10.21.1', good: '10.10.20.1' }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'Je vois mes collègues mais plus les serveurs ni Internet', 'Bonjour, mon ordinateur a une adresse mais je n’accède plus aux serveurs ni à Internet depuis la maintenance. En revanche je peux envoyer des fichiers à mon voisin de bureau. Plusieurs services sont dans le même cas.'),
  cause: 'Sur SW-T1 (routage inter-VLAN), {{m.label}} : les postes du VLAN 20 n’ont plus de passerelle fonctionnelle.',
  solution: 'Corriger l’interface Vlan20 de SW-T1 (no shutdown / ip address 10.10.20.1 255.255.255.0) puis renouveler les baux si besoin.',
  hints: ['Les postes se voient entre eux (même VLAN) mais pas hors du VLAN : suspectez la passerelle.', 'Sur SW-T1, show ip interface brief : état et adresse de Vlan20.', 'Corrigez l’interface Vlan20 puis testez le ping de la passerelle et du serveur.'],
  inject: [{ do: 'set', path: 'SW-T1.svi.Vlan20.{{m.key}}', value: '{{m.bad}}' }],
  probes: [{ t: 'ping', from: 'PC-01', to: '10.10.20.1' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: [{ path: '{{m.path}}', eq: '{{m.good}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }],
  traps: ['Redémarrer les postes ne change rien : la passerelle est en cause.'],
  optimal: ['ipconfig : passerelle .1', 'ping passerelle (échec)', 'show ip interface brief sur SW-T1', 'Corriger Vlan20', 'Retester ping passerelle puis serveur'] });

add({ id: 'c_roas', level: 3, title: 'ROAS Bordeaux : sous-interface, trunk ou parent en défaut', skills: ['roas', 'trunk', 'vlan', 'diag'],
  vary: { m: [
    { key: 'encap', label: 'la sous-interface Gi0/1.20 de R-B1 encapsule en dot1Q 21 au lieu de 20', path: IFACE('R-B1', 'GigabitEthernet0/1.20') + '.encap', bad: 21, good: 20 },
    { key: 'parent', label: 'l’interface physique Gi0/1 de R-B1 (parent des sous-interfaces) est en shutdown', path: IFACE('R-B1', 'GigabitEthernet0/1') + '.adminDown', bad: true, good: false },
    { key: 'trunk', label: 'le trunk SW-B1 Fa0/1 vers le routeur n’autorise plus le VLAN 20', path: PORT('SW-B1', 'FastEthernet0/1') + '.allowed', bad: [10], good: [10, 20] }
  ] },
  ticket: tk('Elena Garcia (Bordeaux)', 'Aucun accès au réseau du siège depuis le poste de Bordeaux', 'Bonjour, mon poste à Bordeaux n’atteint plus ni les serveurs ni Internet depuis ce matin. Le technicien qui a travaillé sur le routeur hier a parlé de « sous-interface ». Les serveurs de Bordeaux semblent allumés.', 'bordeaux'),
  cause: 'Dans le routage inter-VLAN par routeur sur un trunk (ROAS) de Bordeaux, {{m.label}} : la passerelle des postes (VLAN 20) ne répond plus.',
  solution: 'Corriger la configuration ROAS : encapsulation dot1Q 20 sur Gi0/1.20, interface physique no shutdown, ou VLAN 20 autorisé sur le trunk, selon le cas.',
  hints: ['Le poste a une adresse mais ne joint pas sa passerelle 10.20.20.1 : le problème est entre le poste et le routeur.', 'Comparez : show ip interface brief sur R-B1, show running-config interface Gi0/1.20, show interfaces trunk sur SW-B1.', 'Le VLAN d’encapsulation, l’état du parent et la liste du trunk doivent concorder (VLAN 20).'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }, ...reDhcp('PC-B1')],
  probes: [{ t: 'ping', from: 'PC-B1', to: '10.20.20.1' }, { t: 'ping', from: 'PC-B1', to: '10.20.10.10' }],
  roots: [{ path: '{{m.path}}', eq: '{{m.good}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }, { do: 'renew', dev: 'PC-B1' }],
  traps: ['Changer l’adresse du poste ne résout rien : c’est la passerelle (routeur) qui est inaccessible.'],
  optimal: ['ipconfig : adresse OK, passerelle injoignable', 'show ip interface brief sur R-B1', 'Vérifier encapsulation / parent / trunk', 'Corriger', 'Retester la passerelle puis le serveur'] });

add({ id: 'c_route_default', level: 2, title: 'Route par défaut absente ou erronée sur un équipement L3', skills: ['routage', 'diag'],
  vary: { c: [
    { dev: 'SW-T1', host: 'PC-01', label: 'SW-T1 (Toulouse)', site: 'toulouse', nh: '10.10.0.1', bad: '10.10.0.9', name: 'Alice Martin (la comptabilité)' },
    { dev: 'R-B1', host: 'PC-B1', label: 'R-B1 (Bordeaux)', site: 'bordeaux', nh: '10.20.0.1', bad: '10.20.0.9', name: 'Elena Garcia (Bordeaux)' }
  ], m: [{ key: 'missing', routes: [] }, { key: 'wrong', routes: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '{{c.bad}}', ad: 1 }] }] },
  ticket: tk('{{c.name}}', 'Internet inaccessible mais les serveurs locaux marchent', 'Bonjour, depuis la mise à jour du matériel réseau je n’ai plus accès à Internet, mais je vois encore les serveurs de l’entreprise. Pouvez-vous voir ?', '{{c.site}}'),
  cause: 'Sur {{c.label}}, la route par défaut est absente ou pointe vers une passerelle inexistante : les paquets vers Internet (et vers l’autre site) ne sont pas routés vers le pare-feu.',
  solution: 'Rétablir la route par défaut : ip route 0.0.0.0 0.0.0.0 {{c.nh}} sur {{c.dev}}.',
  hints: ['Le local fonctionne, pas l’extérieur : cherchez la route vers l’extérieur sur l’équipement L3 du site.', 'show ip route sur {{c.dev}} : y a-t-il une « Gateway of last resort » ? Est-elle joignable ?', 'Rétablissez ip route 0.0.0.0 0.0.0.0 vers le pare-feu du site ({{c.nh}}).'],
  inject: [{ do: 'set', path: '{{c.dev}}.routes', value: '{{m.routes}}' }],
  probes: [{ t: 'ping', from: '{{c.host}}', to: '8.8.8.8' }, { t: 'ping', from: '{{c.host}}', to: '10.10.10.10', hidden: true }],
  roots: ['{{c.dev}}/routes'],
  fix: [{ do: 'set', path: '{{c.dev}}.routes', value: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '{{c.nh}}', ad: 1 }] }],
  traps: ['Ajouter une route par défaut sur le poste ne répare rien pour les autres postes.'],
  optimal: ['Tester local (OK) et Internet (KO)', 'show ip route sur l’équipement L3', 'Constater l’absence ou l’erreur de route', 'Rétablir la route par défaut', 'Retester'] });

/* ======================= NAT / ACL / SERVICES (Ramonville) ======================= */
add({ id: 'c_nat_side', level: 3, title: 'NAT : interface inside/outside manquante', skills: ['nat-pat', 'routage', 'diag'],
  vary: { m: [
    { key: 'lana', iface: 'GigabitEthernet0/1', side: 'inside', host: 'PC-RV1', label: 'ip nat inside manquant sur Gi0/1 (LAN A)' },
    { key: 'wan', iface: 'GigabitEthernet0/0', side: 'outside', host: 'PC-RV1', label: 'ip nat outside manquant sur Gi0/0 (WAN)' }
  ] },
  ticket: tk('Sophie Lambert (Ramonville)', 'Plus d’Internet à Ramonville, mais l’intranet local marche', 'Bonjour, depuis la modification du routeur hier soir plus aucun site Internet ne s’ouvre à Ramonville depuis le réseau des bureaux. Le site interne et les dossiers marchent toujours.', 'ramonville'),
  cause: 'Sur R-RV1, {{m.label}} : la traduction d’adresses (PAT) ne s’applique plus au trafic concerné, les adresses privées sortent telles quelles vers l’opérateur.',
  solution: 'Rétablir les rôles NAT des interfaces : ip nat inside sur les LAN, ip nat outside sur le WAN.',
  hints: ['Le trafic local fonctionne, pas l’extérieur : une adresse privée n’est pas routable sur Internet.', 'show ip nat translations est vide ; show ip nat statistics indique les interfaces inside/outside.', 'Remettez ip nat inside / ip nat outside sur la ou les interfaces concernées.'],
  inject: [{ do: 'del', path: IFACE('R-RV1', '{{m.iface}}') + '.natSide' }],
  probes: [{ t: 'ping', from: '{{m.host}}', to: '8.8.8.8' }],
  roots: [{ path: IFACE('R-RV1', '{{m.iface}}') + '.natSide' }],
  fix: [{ do: 'set', path: IFACE('R-RV1', '{{m.iface}}') + '.natSide', value: '{{m.side}}' }],
  traps: ['Modifier les règles NAT sans corriger les rôles inside/outside n’a aucun effet.'],
  optimal: ['Ping local OK, ping Internet KO', 'show ip nat translations / statistics', 'show running-config interface', 'Remettre ip nat inside/outside', 'Retester'] });

add({ id: 'c_nat_acl', level: 3, title: 'NAT : ACL de traduction qui ne désigne plus le bon réseau', skills: ['nat-pat', 'acl', 'subnetting', 'diag'],
  ticket: tk('Sophie Lambert (Ramonville)', 'Plus d’Internet pour les bureaux de Ramonville', 'Bonjour, depuis qu’on a « resserré » la configuration du routeur de Ramonville, les postes des bureaux n’ouvrent plus aucun site Internet. L’intranet et les dossiers fonctionnent. (Le poste d’accueil, lui, n’a de toute façon accès qu’au site interne.)', 'ramonville'),
  cause: 'L’ACL 1, utilisée par le NAT pour désigner les adresses à traduire, ne contient plus que 172.16.2.0/24 : le réseau des bureaux (172.16.1.0/24) n’est plus traduit et sort avec une adresse privée.',
  solution: 'Corriger l’ACL 1 pour couvrir les réseaux internes à traduire (172.16.0.0 0.0.255.255, ou un permit par réseau).',
  hints: ['L’intranet fonctionne, pas l’extérieur : une adresse privée n’est pas routable sur Internet. Le NAT traduit-il encore ce réseau ?', 'show ip nat translations (vide pour le réseau des bureaux) et show access-lists 1.', 'Rétablissez dans l’ACL 1 le réseau 172.16.1.0 (ou 172.16.0.0 0.0.255.255).'],
  inject: [{ do: 'set', path: 'R-RV1.acls.1.entries', value: [{ a: 'permit', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' } }] }],
  probes: [{ t: 'ping', from: 'PC-RV1', to: '8.8.8.8' }],
  roots: [{ probe: { t: 'ping', from: 'PC-RV1', to: '8.8.8.8' } }],
  fix: [{ do: 'set', path: 'R-RV1.acls.1.entries', value: [{ a: 'permit', s: { t: 'net', ip: '172.16.0.0', wild: '0.0.255.255' } }] }],
  fixes: { 'reseau-a': [{ do: 'push', path: 'R-RV1.acls.1.entries', item: { a: 'permit', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' } } }] },
  traps: ['Ajouter un NAT statique pour un seul poste ne règle pas le problème des autres.'],
  optimal: ['Constater intranet OK / Internet KO', 'show ip nat translations', 'show access-lists 1', 'Corriger l’ACL 1', 'Retester'] });

add({ id: 'c_nat_static', level: 3, title: 'NAT statique (publication du site) vers une mauvaise adresse', skills: ['nat-pat', 'portfwd', 'diag'],
  ticket: tk('Sophie Lambert (Ramonville)', 'Le site web de Ramonville n’est plus visible depuis l’extérieur', 'Bonjour, des clients nous disent que notre site (http://192.0.2.2) ne répond plus depuis l’extérieur. En interne, le serveur répond normalement. Une réorganisation d’adresses a eu lieu dans la DMZ la semaine dernière.', 'ramonville'),
  cause: 'La règle NAT statique pointe vers 172.16.3.11, une adresse qui n’est plus celle du serveur web (172.16.3.10) : les connexions entrantes sont traduites vers une adresse sans hôte.',
  solution: 'Corriger la traduction : ip nat inside source static tcp 172.16.3.10 80 192.0.2.2 80.',
  hints: ['Le serveur répond en interne : le problème est entre l’extérieur et lui.', 'show ip nat translations / show running-config | include ip nat : vers quelle adresse la règle redirige-t-elle ?', 'Remplacez l’adresse locale de la règle statique par celle du serveur réel.'],
  inject: [{ do: 'set', path: 'R-RV1.nat.rules[1].local', value: '172.16.3.11' }],
  probes: [{ t: 'http', from: 'PCEXT', url: 'http://192.0.2.2/' }],
  roots: [{ path: 'R-RV1.nat.rules[1].local', eq: '172.16.3.10' }],
  fix: [{ do: 'set', path: 'R-RV1.nat.rules[1].local', value: '172.16.3.10' }],
  traps: ['Rouvrir le pare-feu ou changer le DNS ne change rien : la traduction est mauvaise.'],
  optimal: ['Tester le site en interne (OK) et depuis l’extérieur (KO)', 'Lire la règle NAT statique', 'Corriger l’adresse locale', 'Retester depuis l’extérieur'] });

const ACL100 = [
  { a: 'permit', p: 'icmp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' } },
  { a: 'permit', p: 'udp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 53 } },
  { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 80 } },
  { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 443 } },
  { a: 'permit', p: 'tcp', s: { t: 'host', ip: '172.16.1.30' }, d: { t: 'host', ip: '172.16.3.10' }, dp: { op: 'eq', v: 22 } }];
const ACL101 = [
  { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' }, d: { t: 'host', ip: '172.16.3.10' }, dp: { op: 'eq', v: 80 } },
  { a: 'permit', p: 'udp', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' }, d: { t: 'host', ip: '172.16.3.10' }, dp: { op: 'eq', v: 53 } },
  { a: 'permit', p: 'icmp', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' }, d: { t: 'host', ip: '172.16.3.10' } }];
const ACL102 = [
  { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.3.0', wild: '0.0.0.255' }, d: { t: 'any' }, est: true },
  { a: 'permit', p: 'udp', s: { t: 'host', ip: '172.16.3.10' }, sp: { op: 'eq', v: 53 }, d: { t: 'any' } },
  { a: 'permit', p: 'icmp', s: { t: 'net', ip: '172.16.3.0', wild: '0.0.0.255' }, d: { t: 'any' }, it: 0 }];
const DENY80 = { a: 'deny', p: 'tcp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 80 } };

add({ id: 'c_acl', level: 4, title: 'ACL étendue : ordre, entrée manquante ou retour bloqué', skills: ['acl', 'segmentation', 'diag'],
  vary: { m: [
    { key: 'deny-avant', acl: '100', host: 'PC-RV1', url: 'http://93.184.216.34/', entries: [DENY80].concat(ACL100), good: ACL100, label: 'une entrée « deny tcp 172.16.1.0 0.0.0.255 any eq 80 » a été insérée en première ligne de l’ACL 100 (LAN A)', symptom: 'les sites web ne s’ouvrent plus pour le réseau A mais le ping fonctionne' },
    { key: 'dns', acl: '101', host: 'PC-RV2', url: 'http://www.ramonville.lan/', entries: [ACL101[0], ACL101[2]], good: ACL101, label: 'l’entrée autorisant le DNS (udp 53) vers le serveur a disparu de l’ACL 101 (LAN B)', symptom: 'le site interne s’ouvre par son adresse IP mais plus par son nom' },
    { key: 'retour', acl: '102', host: 'PC-RV1', url: 'http://www.ramonville.lan/', entries: [ACL102[1], ACL102[2]], good: ACL102, label: 'l’entrée « permit tcp 172.16.3.0 0.0.0.255 any established » a disparu de l’ACL 102 (DMZ)', symptom: 'le ping vers le serveur web passe mais les pages ne s’affichent plus' }
  ] },
  ticket: tk('Sophie Lambert (Ramonville)', 'Un service ne passe plus à Ramonville depuis le durcissement des ACL', 'Bonjour, depuis la mise à jour des règles d’accès du routeur hier soir : {{m.symptom}}. Le technicien qui a modifié les ACL n’est pas joignable.', 'ramonville'),
  cause: 'Sur R-RV1, {{m.label}} : le filtrage (ordre des entrées, entrée manquante, refus implicite final) bloque un flux légitime.',
  solution: 'Rétablir l’ACL concernée dans son état attendu (bon ordre des entrées, entrée manquante restaurée) sans ouvrir plus que nécessaire.',
  hints: ['Le trafic est filtré quelque part sur le chemin : identifiez quelle ACL et quelle ligne le bloquent (show access-lists, compteurs « matches »).', 'Une ACL se lit de haut en bas et se termine par un refus implicite. Pensez aussi au trafic de retour.', 'Rétablissez l’entrée manquante ou supprimez/reclassez l’entrée fautive, puis vérifiez les compteurs.'],
  inject: [{ do: 'set', path: 'R-RV1.acls.{{m.acl}}.entries', value: '{{m.entries}}' }],
  probes: [{ t: 'http', from: '{{m.host}}', url: '{{m.url}}' }],
  roots: ['R-RV1/acls/{{m.acl}}'],
  fix: [{ do: 'set', path: 'R-RV1.acls.{{m.acl}}.entries', value: '{{m.good}}' }],
  traps: ['Ajouter « permit ip any any » en fin d’ACL règle tout mais supprime le filtrage voulu.', 'Retirer l’ACL de l’interface ouvre complètement le réseau.'],
  optimal: ['Reproduire le symptôme', 'show access-lists : repérer les compteurs et l’entrée manquante', 'Restaurer l’entrée dans le bon ordre', 'Retester le flux'] });

const SSH_FIX = (path, val) => [{ do: 'set', path, value: val }];
add({ id: 'c_ssh', level: 2, title: 'SSH impossible sur un équipement Cisco (service non prêt)', skills: ['ssh-cisco', 'diag'],
  vary: { m: [
    { key: 'rsa', label: 'les clés RSA ont été supprimées (crypto key zeroize rsa) : le serveur SSH ne tourne plus', path: 'SW-T2.ssh.rsa', bad: false, good: true },
    { key: 'transport', label: 'les lignes vty n’acceptent plus que telnet (transport input telnet)', path: 'SW-T2.lines.vty.transport', bad: ['telnet'], good: ['ssh'] },
    { key: 'domain', label: 'le nom de domaine (ip domain-name) a été supprimé : sans lui le serveur SSH ne démarre pas', path: 'SW-T2.domain', bad: '', good: 'toulouse.local' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Impossible d’administrer le commutateur SW-T2 en SSH', 'Bonjour, depuis ce matin je n’arrive plus à me connecter en SSH à SW-T2 (10.10.30.2) depuis PC-ADM, alors que SW-T3 fonctionne. La connexion est refusée. Pouvez-vous voir sur place avec le câble console ?'),
  cause: 'Sur SW-T2, {{m.label}}.',
  solution: 'Depuis la console : rétablir le service SSH (ip domain-name, crypto key generate rsa, ip ssh version 2) et transport input ssh sur les lignes vty.',
  hints: ['Le port 22 répond-il ? « Connexion refusée » signifie que le service SSH n’écoute pas.', 'Depuis la console : show ip ssh (SSH Enabled / Disabled), show running-config | section line vty.', 'Corrigez l’élément manquant (domaine, clés RSA, transport input ssh).'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }],
  probes: [{ t: 'ssh', from: 'PC-ADM', to: '10.10.30.2', user: 'admin', method: 'password' }],
  roots: [{ path: '{{m.path}}', eq: '{{m.good}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }],
  traps: ['Activer telnet « pour dépanner » transmet les mots de passe en clair.'],
  optimal: ['Tester le port 22 (refusé)', 'Se connecter à la console', 'show ip ssh / show run | section line vty', 'Corriger l’élément défaillant', 'Retester le SSH depuis PC-ADM'] });

add({ id: 'c_ssh_auth', level: 3, title: 'SSH Cisco : connexion fermée (access-class) ou compte local supprimé', skills: ['ssh-cisco', 'acl', 'diag'],
  vary: { m: [
    { key: 'acl', label: 'les lignes vty sont restreintes par « access-class 10 in », dont l’ACL n’autorise qu’un autre poste que PC-ADM',
      inject: [{ do: 'set', path: 'SW-T2.acls', value: { '10': { type: 'standard', entries: [{ a: 'permit', s: { t: 'host', ip: '10.10.30.99' } }] } } }, { do: 'set', path: 'SW-T2.lines.vty.accessClass', value: '10' }],
      fix: [{ do: 'set', path: 'SW-T2.acls.10.entries', value: [{ a: 'permit', s: { t: 'host', ip: '10.10.30.10' } }] }], root: { path: 'SW-T2.acls.10.entries[0].s.ip', in: ['10.10.30.10'] } },
    { key: 'user', label: 'le compte local « admin » a été supprimé alors que les lignes vty utilisent « login local »',
      inject: [{ do: 'set', path: 'SW-T2.users', value: [] }],
      fix: [{ do: 'set', path: 'SW-T2.users', value: [{ name: 'admin', priv: 15, pwd: 'Cisco#2026' }] }], root: { path: 'SW-T2.users[name=admin].priv', eq: 15 } }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'SSH vers SW-T2 : connexion fermée ou mot de passe toujours refusé', 'Bonjour, je n’arrive plus à ouvrir une session SSH sur SW-T2 depuis PC-ADM : soit la connexion se ferme tout de suite, soit mon mot de passe est refusé alors que je suis sûr de l’avoir. SW-T3 est normal.'),
  cause: 'Sur SW-T2, {{m.label}}.',
  solution: 'Depuis la console : corriger l’ACL de l’access-class (autoriser 10.10.30.10) ou recréer le compte local (username admin privilege 15 secret …).',
  hints: ['Le port 22 est ouvert : le service tourne. Le refus survient après la connexion.', 'show running-config | section line vty : access-class ? login local ? Puis show access-lists et show running-config | include username.', 'Autorisez le poste d’administration dans l’ACL de l’access-class, ou recréez le compte local.'],
  inject: '{{m.inject}}',
  probes: [{ t: 'ssh', from: 'PC-ADM', to: '10.10.30.2', user: 'admin', method: 'password' }],
  roots: ['{{m.root}}'],
  fix: '{{m.fix}}',
  traps: ['Retirer toute restriction sur les lignes vty ouvre l’administration à tout le réseau.'],
  optimal: ['Constater que le port 22 est ouvert', 'Console : show run | section line vty', 'Repérer access-class / comptes locaux', 'Corriger', 'Retester le SSH'] });

add({ id: 'c_sw_gw', level: 2, title: 'Commutateur sans passerelle par défaut : non administrable depuis un autre VLAN', skills: ['ssh-cisco', 'subnetting', 'routage', 'diag'],
  ticket: tk('Admin TSSR (informatique)', 'SW-T2 ne répond plus depuis les autres réseaux', 'Bonjour, depuis la reconfiguration de SW-T2 je ne peux plus le joindre en SSH depuis le réseau des postes (VLAN 20) alors que depuis PC-ADM (VLAN 30) tout va bien. Un contrôle de supervision tente de le joindre depuis un autre réseau et échoue.'),
  cause: 'SW-T2 n’a plus de passerelle par défaut (ip default-gateway) : il répond dans son VLAN d’administration mais ne sait pas répondre à des paquets venant d’un autre réseau.',
  solution: 'Rétablir ip default-gateway 10.10.30.1 sur SW-T2.',
  hints: ['La gestion fonctionne depuis le même réseau mais pas depuis un autre : le retour des paquets est en cause.', 'show ip route (la 1re ligne indique « Default gateway is … ») ou show running-config sur SW-T2.', 'Rétablissez ip default-gateway 10.10.30.1.'],
  inject: [{ do: 'del', path: 'SW-T2.defaultGateway' }],
  probes: [{ t: 'ping', from: 'PC-01', to: '10.10.30.2' }, { t: 'ssh', from: 'PC-01', to: '10.10.30.2', user: 'admin', method: 'password' }],
  roots: [{ path: 'SW-T2.defaultGateway', eq: '10.10.30.1' }],
  fix: [{ do: 'set', path: 'SW-T2.defaultGateway', value: '10.10.30.1' }],
  traps: ['Ajouter des routes sur le pare-feu ne changera rien : le commutateur doit savoir où renvoyer ses réponses.'],
  optimal: ['Tester la gestion depuis le même VLAN (OK) et un autre (KO)', 'Lire la configuration de SW-T2', 'Constater l’absence de default-gateway', 'Rétablir', 'Retester depuis un autre VLAN'] });

add({ id: 'c_dhcp_router', level: 3, title: 'DHCP du routeur de Ramonville : exclusion, passerelle ou service', skills: ['dhcp', 'subnetting', 'diag'],
  vary: { m: [
    { key: 'exclu', label: 'la plage exclue couvre tout le réseau B (172.16.2.1 – 172.16.2.254) : aucune adresse n’est attribuable', path: 'R-RV1.dhcp.excluded[1].end', bad: '172.16.2.254', good: '172.16.2.20' },
    { key: 'gw', label: 'la passerelle du pool LAN-B est 172.16.2.254 au lieu de 172.16.2.1', path: 'R-RV1.dhcp.pools[name=LAN-B].gw', bad: '172.16.2.254', good: '172.16.2.1' },
    { key: 'service', label: 'le service DHCP du routeur a été désactivé (no service dhcp)', path: 'R-RV1.dhcp.service', bad: false, good: true }
  ] },
  ticket: tk('Sophie Lambert (Ramonville)', 'Le poste d’accueil de Ramonville n’a plus de réseau correct', 'Bonjour, le poste d’accueil de Ramonville (réseau B) n’obtient plus de réseau correct depuis la modification du routeur. Soit il affiche un réseau non identifié, soit il a une adresse mais ne va nulle part.', 'ramonville'),
  cause: 'Sur R-RV1, {{m.label}}.',
  solution: 'Corriger la configuration DHCP du routeur (ip dhcp excluded-address, default-router du pool, service dhcp), puis renouveler le bail du poste.',
  hints: ['Regardez d’abord l’adresse obtenue par le poste : 169.254.x.x ou une adresse du bon réseau ?', 'show ip dhcp pool, show ip dhcp binding, show running-config | section dhcp.', 'Corrigez le paramètre fautif puis ipconfig /renew.'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }, ...reDhcp('PC-RV2')],
  probes: [{ t: 'ip', host: 'PC-RV2', net: '172.16.2.0/24' }, { t: 'ping', from: 'PC-RV2', to: '172.16.3.10' }],
  roots: [{ path: '{{m.path}}', eq: '{{m.good}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }, { do: 'renew', dev: 'PC-RV2' }],
  traps: ['Fixer une IP statique sur le poste masque le problème pour un seul poste.'],
  optimal: ['ipconfig /all : adresse et passerelle', 'show ip dhcp pool / binding', 'Corriger le paramètre fautif', 'ipconfig /renew et test'] });

add({ id: 'dhcp_suffix', v1: 'dhcp_suffix', level: 2, title: 'Suffixe DNS distribué par le DHCP erroné (noms courts non résolus)', skills: ['dhcp', 'dns', 'diag'],
  vary: { m: [
    { key: 'typo', label: 'le domain-name du pool LAN-B est « ramonvile.lan » (faute de frappe) au lieu de « ramonville.lan »', bad: 'ramonvile.lan' },
    { key: 'vide', label: 'le domain-name du pool LAN-B a été supprimé : le poste ne reçoit plus aucun suffixe DNS', bad: '' }
  ] },
  ticket: tk('Sophie Lambert (Ramonville)', 'Le site interne du labo ne s’ouvre plus avec son nom court', 'Bonjour, sur le poste d’accueil du labo, depuis la modification de la configuration du routeur, quand je tape « www » (ping ou navigateur) rien n’est trouvé. Si je tape l’adresse complète www.ramonville.lan, ça marche.', 'ramonville'),
  cause: 'Sur R-RV1, {{m.label}} : l’option DHCP 015 (suffixe DNS) distribuée au poste ne permet plus de compléter les noms courts, alors que le serveur DNS répond correctement aux noms complets.',
  solution: 'Rétablir « domain-name ramonville.lan » dans le pool DHCP LAN-B du routeur, puis renouveler le bail du poste (ipconfig /renew).',
  hints: ['Nom complet OK, nom court KO : le DNS répond, c’est la complétion du nom (suffixe DNS) qui est en cause.', 'ipconfig /all : comparez « Suffixe DNS propre à la connexion » avec le domaine du laboratoire (ramonville.lan).', 'Ce suffixe vient de l’option DHCP 015 : sur le routeur, corrigez « domain-name » du pool LAN-B (show running-config | section dhcp) puis ipconfig /renew.'],
  inject: [{ do: 'set', path: 'R-RV1.dhcp.pools[name=LAN-B].domain', value: '{{m.bad}}' }, ...reDhcp('PC-RV2')],
  probes: [{ t: 'resolve', from: 'PC-RV2', name: 'www', expect: '172.16.3.10' }],
  roots: [{ path: 'R-RV1.dhcp.pools[name=LAN-B].domain', eq: 'ramonville.lan' }],
  fix: [{ do: 'set', path: 'R-RV1.dhcp.pools[name=LAN-B].domain', value: 'ramonville.lan' }, { do: 'renew', dev: 'PC-RV2' }],
  workarounds: { hosts: [{ do: 'push', path: 'PC-RV2.hostsFile', item: { ip: '172.16.3.10', name: 'www' } }] },
  traps: ['Ajouter une entrée dans le fichier hosts du poste ou taper toujours le nom complet contourne le problème pour un seul poste, sans corriger l’option distribuée.'],
  optimal: ['Constater : nom complet OK, nom court KO', 'ipconfig /all : suffixe DNS de la connexion', 'show running-config | section dhcp sur le routeur', 'Corriger domain-name du pool', 'ipconfig /renew et retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
