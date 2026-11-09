/* ============================================================================
   Pannes — lot H : routage dynamique OSPF (zone 0 + zone 1), site de Labège (anneau R-LB1…R-LB5, R-LB6 en zone 1).
   Données pures : voisinages et routes sont DÉRIVÉS de la configuration (src/engine/41-ospf.js).
   Compétences de la fiche v21 : « Routage dynamique OSPF — une seule area » (id : ospf) et « OSPF — plusieurs areas » (id : ospf-multi).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body) => ({ from, subject, body, site: 'labege' });
const IFACE = (dev, i) => dev + ".ifaces['" + i + "']";
const RID = { 'R-LB1': '10.30.255.1', 'R-LB2': '10.30.255.2', 'R-LB3': '10.30.255.3', 'R-LB4': '10.30.255.4', 'R-LB5': '10.30.255.5', 'R-LB6': '10.30.255.6' };
const NET = (net, wild) => ({ net, wild, area: 0 });
const NETA = (net, wild, area) => ({ net, wild, area });

/* ======================= RÉSEAU NON ANNONCÉ ======================= */
const L2_GOOD = [NET('10.30.12.0', '0.0.0.3'), NET('10.30.23.0', '0.0.0.3'), NET('10.30.102.0', '0.0.0.255'), NET('10.30.255.2', '0.0.0.0')];
const L6_GOOD = [NETA('10.30.36.0', '0.0.0.3', 1), NETA('10.30.106.0', '0.0.0.255', 1), NETA('10.30.255.6', '0.0.0.0', 1)];
const L4_GOOD = [NET('10.30.34.0', '0.0.0.3'), NET('10.30.45.0', '0.0.0.3'), NET('10.30.104.0', '0.0.0.255'), NET('10.30.255.4', '0.0.0.0')];
add({ id: 'ospf_lan_network', level: 3, title: 'OSPF : le réseau local n’est plus annoncé aux autres routeurs', skills: ['ospf', 'subnetting', 'diag'],
  vary: { m: [
    { key: 'lb2-wild', area: 0, dev: 'R-LB2', net: '10.30.102.0/24', good: L2_GOOD, bad: [L2_GOOD[0], L2_GOOD[1], NET('10.30.102.0', '0.0.0.0'), L2_GOOD[3]], from: 'PC-LB4', fromIp: '10.30.104.10', back: 'PC-LB2', to: '10.30.102.10', lan: 'LAN utilisateurs', label: 'l’instruction « network 10.30.102.0 0.0.0.0 area 0 » utilise un masque générique d’hôte (0.0.0.0) : aucune interface n’a l’adresse 10.30.102.0, le LAN n’est plus activé dans OSPF' },
    { key: 'lb2-typo', area: 0, dev: 'R-LB2', net: '10.30.102.0/24', good: L2_GOOD, bad: [L2_GOOD[0], L2_GOOD[1], NET('10.30.120.0', '0.0.0.255'), L2_GOOD[3]], from: 'PC-LB4', fromIp: '10.30.104.10', back: 'PC-LB2', to: '10.30.102.10', lan: 'LAN utilisateurs', label: 'l’instruction réseau du LAN indique 10.30.120.0 au lieu de 10.30.102.0 (chiffres inversés) : l’interface du LAN n’est dans aucune instruction « network »' },
    { key: 'lb4-absent', area: 0, dev: 'R-LB4', net: '10.30.104.0/24', good: L4_GOOD, bad: [L4_GOOD[0], L4_GOOD[1], L4_GOOD[3]], from: 'PC-LB2', fromIp: '10.30.102.10', back: 'PC-LB4', to: '10.30.104.10', lan: 'LAN atelier', label: 'l’instruction « network 10.30.104.0 0.0.0.255 area 0 » a été supprimée : le LAN de l’atelier n’est plus annoncé' },
    { key: 'lb4-wild', area: 0, dev: 'R-LB4', net: '10.30.104.0/24', good: L4_GOOD, bad: [L4_GOOD[0], L4_GOOD[1], NET('10.30.104.0', '0.0.0.0'), L4_GOOD[3]], from: 'PC-LB2', fromIp: '10.30.102.10', back: 'PC-LB4', to: '10.30.104.10', lan: 'LAN atelier', label: 'l’instruction « network 10.30.104.0 0.0.0.0 area 0 » utilise un masque générique d’hôte (0.0.0.0) : l’interface du LAN n’est plus activée dans OSPF' },
    { key: 'lb6-absent', area: 1, dev: 'R-LB6', net: '10.30.106.0/24', good: L6_GOOD, bad: [L6_GOOD[0], L6_GOOD[2]], from: 'PC-LB2', fromIp: '10.30.102.10', back: 'PC-LB6', to: '10.30.106.10', lan: 'LAN annexe (zone 1)', label: 'l’instruction « network 10.30.106.0 0.0.0.255 area 1 » a été supprimée : le LAN de l’annexe, en zone 1, n’est plus annoncé' },
    { key: 'lb6-area', area: 1, dev: 'R-LB6', net: '10.30.106.0/24', good: L6_GOOD, bad: [L6_GOOD[0], NETA('10.30.106.0', '0.0.0.255', 0), L6_GOOD[2]], from: 'PC-LB2', fromIp: '10.30.102.10', back: 'PC-LB6', to: '10.30.106.10', lan: 'LAN annexe (zone 1)', label: 'l’instruction du LAN annexe indique « area 0 » alors que le reste de R-LB6 est en zone 1 : le LAN est annoncé, mais depuis une zone où R-LB6 n’a aucun voisin, donc il n’est transmis à personne' }
  ] },
  ticket: tk('Marc Delmas (Labège)', 'Plus d’échanges entre les bâtiments de Labège, chacun voit son réseau seulement', 'Bonjour, depuis la dernière intervention sur les routeurs de Labège, les postes d’un bâtiment et ceux d’un autre (bureau, atelier, annexe) ne se parlent plus : chacun accède à ses propres machines mais plus à celles de l’autre bâtiment. Rien n’a bougé côté câblage. Merci de regarder avant la réunion de 14 h.'),
  cause: 'Sur {{m.dev}} ({{m.lan}}), {{m.label}}. Les autres routeurs n’ont donc plus de route vers {{m.net}} et les réponses ne reviennent pas.',
  solution: 'Rétablir l’instruction « network » correcte du LAN dans OSPF (adresse du réseau et masque générique inverse de son masque) : router ospf 1 → network <réseau> <masque générique> area 0.',
  hints: ['Chaque bâtiment voit ses propres machines mais pas celles de l’autre : le défaut est sur le chemin, pas sur le poste.', 'show ip route ou show ip route ospf sur un routeur de l’anneau : le réseau du bâtiment concerné n’y figure plus. Comparez avec show ip ospf interface brief sur le routeur du bâtiment.', 'Sur le routeur du bâtiment, show ip protocols liste les instructions « network » : l’interface du LAN doit correspondre à l’une d’elles (réseau + masque générique).'],
  inject: [{ do: 'set', path: '{{m.dev}}.ospf.networks', value: '{{m.bad}}' }],
  probes: [{ t: 'ping', from: '{{m.from}}', to: '{{m.to}}' }, { t: 'ping', from: '{{m.back}}', to: '{{m.fromIp}}', hidden: true }],
  roots: [{ probe: { t: 'ospfadv', dev: '{{m.dev}}', net: '{{m.net}}', area: '{{m.area}}' } }],
  fix: [{ do: 'set', path: '{{m.dev}}.ospf.networks', value: '{{m.good}}' }],
  traps: ['Ajouter une route statique vers le LAN sur chaque routeur contourne OSPF sans corriger la cause (et ne suit pas les changements d’anneau).', 'Un masque générique n’est pas un masque de sous-réseau : 0.0.0.255 correspond à un /24, 0.0.0.0 à une seule adresse.'],
  optimal: ['Ping entre bâtiments en échec, ping local OK', 'show ip route sur un routeur de l’anneau : réseau absent', 'show ip ospf interface brief / show ip protocols sur le routeur du bâtiment', 'Corriger l’instruction network', 'Retester dans les deux sens'] });

/* ======================= ROUTE PAR DÉFAUT NON PROPAGÉE ======================= */
add({ id: 'ospf_default_route', level: 3, title: 'OSPF : la route par défaut n’atteint plus les routeurs de l’anneau', skills: ['ospf', 'routage', 'diag'],
  vary: { m: [
    { key: 'originate', label: 'la commande « default-information originate » a été retirée de la configuration OSPF de R-LB1', inj: [{ do: 'set', path: 'R-LB1.ospf.defaultOriginate', value: null }], fix: [{ do: 'set', path: 'R-LB1.ospf.defaultOriginate', value: { always: false } }] },
    { key: 'static', label: 'la route statique par défaut de R-LB1 a disparu : « default-information originate » sans « always » n’annonce rien tant que R-LB1 n’a pas lui-même de route par défaut', inj: [{ do: 'set', path: 'R-LB1.routes', value: [] }], fix: [{ do: 'set', path: 'R-LB1.routes', value: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '192.0.2.5', ad: 1 }] }] },
    { key: 'nexthop', label: 'la route statique par défaut de R-LB1 pointe vers 192.0.2.9, une adresse qui n’est pas sur le réseau du lien opérateur (192.0.2.4/30) : la route n’est pas installée et OSPF ne l’annonce plus', inj: [{ do: 'set', path: 'R-LB1.routes', value: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '192.0.2.9', ad: 1 }] }], fix: [{ do: 'set', path: 'R-LB1.routes', value: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '192.0.2.5', ad: 1 }] }] },
    { key: 'passive', label: 'la commande « passive-interface default » a été ajoutée sur R-LB1 sans « no passive-interface » pour ses deux liens vers l’anneau : R-LB1 n’a plus aucun voisin OSPF', inj: [{ do: 'set', path: 'R-LB1.ospf.passiveDefault', value: true }, { do: 'set', path: 'R-LB1.ospf.nonPassive', value: [] }], fix: [{ do: 'set', path: 'R-LB1.ospf.passiveDefault', value: false }, { do: 'set', path: 'R-LB1.ospf.nonPassive', value: [] }, { do: 'set', path: 'R-LB1.ospf.passive', value: [] }] }
  ] },
  ticket: tk('Marc Delmas (Labège)', 'Plus d’Internet à Labège, ni dans un bâtiment ni dans l’autre', 'Bonjour, depuis ce matin plus aucun site Internet ne s’ouvre à Labège, ni au bureau ni à l’atelier. Par contre on arrive toujours à se connecter entre les deux bâtiments. L’opérateur dit que son lien est actif.'),
  cause: 'Sur R-LB1 (routeur de bordure), {{m.label}} : les routeurs de l’anneau n’apprennent plus de route par défaut (O*E2 0.0.0.0/0) et ne savent plus où envoyer le trafic Internet.',
  solution: 'Rétablir sur R-LB1 la route statique par défaut vers l’opérateur (192.0.2.5) et sa diffusion dans OSPF (default-information originate), ainsi que ses adjacences avec l’anneau.',
  hints: ['Le trafic interne fonctionne, seul Internet est coupé : la route par défaut est à regarder, sur les routeurs de l’anneau puis sur celui de bordure.', 'show ip route sur R-LB3 : il manque la ligne « O*E2 0.0.0.0/0 ». Sur R-LB1, show ip route (route statique « S* » ?) et show ip protocols / show ip ospf neighbor.', 'default-information originate n’annonce la route par défaut que si R-LB1 en possède une (sauf option « always »). Vérifiez aussi que R-LB1 a bien ses voisins OSPF.'],
  inject: '{{m.inj}}',
  probes: [{ t: 'ping', from: 'PC-LB2', to: '8.8.8.8' }, { t: 'ping', from: 'PC-LB4', to: '8.8.8.8', hidden: true }, { t: 'ping', from: 'PC-LB6', to: '8.8.8.8', hidden: true }],
  roots: [{ probe: { t: 'ospfdef', dev: 'R-LB1' } }, { probe: { t: 'ospfnbr', dev: 'R-LB1', rid: RID['R-LB2'] } }, { probe: { t: 'ospfnbr', dev: 'R-LB1', rid: RID['R-LB5'] } }],
  fix: '{{m.fix}}',
  traps: ['Ajouter une route par défaut statique sur chaque routeur de l’anneau règle le symptôme mais contourne OSPF.', 'Ne redémarrez pas les routeurs : la configuration est en cause, pas un blocage.'],
  optimal: ['Ping interne OK, ping Internet KO', 'show ip route sur un routeur de l’anneau : pas de O*E2', 'show ip route / show ip protocols / show ip ospf neighbor sur R-LB1', 'Rétablir la route statique ou la commande default-information originate ou les voisins', 'Retester depuis un poste'] });

/* ======================= MINUTEURS HELLO / DEAD ======================= */
add({ id: 'ospf_timers', level: 3, title: 'OSPF : un voisin de l’anneau est perdu (minuteurs différents)', skills: ['ospf', 'diag'],
  vary: { m: [
    { key: 'hello-lb4', dev: 'R-LB4', iface: 'GigabitEthernet0/1', nbrDev: 'R-LB5', rid: RID['R-LB5'], mine: RID['R-LB4'], set: [{ do: 'set', path: IFACE('R-LB4', 'GigabitEthernet0/1') + '.ospfHello', value: 5 }, { do: 'set', path: IFACE('R-LB4', 'GigabitEthernet0/1') + '.ospfDead', value: 20 }], clear: [{ do: 'del', path: IFACE('R-LB4', 'GigabitEthernet0/1') + '.ospfHello' }, { do: 'del', path: IFACE('R-LB4', 'GigabitEthernet0/1') + '.ospfDead' }], label: 'le lien Gi0/1 de R-LB4 vers R-LB5 est configuré avec « ip ospf hello-interval 5 » (dead-interval 20) alors que R-LB5 reste à 10 / 40' },
    { key: 'dead-lb3', dev: 'R-LB3', iface: 'GigabitEthernet0/1', nbrDev: 'R-LB4', rid: RID['R-LB4'], mine: RID['R-LB3'], set: [{ do: 'set', path: IFACE('R-LB3', 'GigabitEthernet0/1') + '.ospfDead', value: 30 }, { do: 'set', path: IFACE('R-LB3', 'GigabitEthernet0/1') + '.ospfDeadExplicit', value: true }], clear: [{ do: 'del', path: IFACE('R-LB3', 'GigabitEthernet0/1') + '.ospfDead' }, { do: 'del', path: IFACE('R-LB3', 'GigabitEthernet0/1') + '.ospfDeadExplicit' }], label: 'le lien Gi0/1 de R-LB3 vers R-LB4 est configuré avec « ip ospf dead-interval 30 » alors que R-LB4 reste à 40 (hello identique à 10)' },
    { key: 'hello-lb2', dev: 'R-LB2', iface: 'GigabitEthernet0/0', nbrDev: 'R-LB1', rid: RID['R-LB1'], mine: RID['R-LB2'], set: [{ do: 'set', path: IFACE('R-LB2', 'GigabitEthernet0/0') + '.ospfHello', value: 30 }, { do: 'set', path: IFACE('R-LB2', 'GigabitEthernet0/0') + '.ospfDead', value: 120 }], clear: [{ do: 'del', path: IFACE('R-LB2', 'GigabitEthernet0/0') + '.ospfHello' }, { do: 'del', path: IFACE('R-LB2', 'GigabitEthernet0/0') + '.ospfDead' }], label: 'le lien Gi0/0 de R-LB2 vers R-LB1 est configuré avec « ip ospf hello-interval 30 » (dead-interval 120) alors que R-LB1 reste à 10 / 40' }
  ] },
  ticket: tk('Supervision réseau (alerte automatique)', 'ALERTE — Labège : perte de voisinage OSPF, redondance de l’anneau dégradée', 'Alerte reçue : le voisinage OSPF entre deux routeurs de l’anneau de Labège est tombé et ne remonte pas. Les postes fonctionnent encore (le trafic passe par l’autre sens de l’anneau) mais une deuxième coupure isolerait un bâtiment. Une intervention est prévue ce soir sur un autre lien : il faut rétablir la redondance avant.'),
  cause: 'Sur {{m.dev}}, {{m.label}}. Deux routeurs OSPF doivent avoir les mêmes minuteurs hello et dead sur le lien pour devenir voisins : le voisinage avec {{m.nbrDev}} ne se forme pas.',
  solution: 'Remettre des minuteurs identiques aux deux extrémités du lien (valeurs par défaut : « no ip ospf hello-interval » / « no ip ospf dead-interval » sur l’interface modifiée), puis vérifier que le voisin repasse à FULL.',
  hints: ['Les postes fonctionnent encore : la panne est une perte de redondance, à lire dans les voisinages OSPF.', 'show ip ospf neighbor sur les deux extrémités du lien : un des deux routeurs n’a plus l’autre. show ip ospf interface sur le lien montre les valeurs Hello et Dead.', 'Comparez « Timer intervals configured, Hello x, Dead y » des deux côtés du lien : les valeurs doivent être identiques.'],
  inject: '{{m.set}}',
  verify: ['show:R-LB*:ospf-neighbor'],
  verifyText: 'Une fois la correction faite, constater depuis la console d’un routeur de l’anneau de Labège l’état des voisinages OSPF.',
  closeNote: 'Les postes de Labège se parlent déjà : le trafic passe par l’autre sens de l’anneau. Un ping réussi ne dit rien de l’état d’un voisinage OSPF ; la clôture exige de l’avoir constaté après la correction.',
  probes: [{ t: 'ospfnbr', dev: '{{m.dev}}', rid: '{{m.rid}}' }, { t: 'ping', from: 'PC-LB2', to: '10.30.104.10', hidden: true }],
  roots: [{ probe: { t: 'ospfnbr', dev: '{{m.dev}}', rid: '{{m.rid}}' } }],
  fix: '{{m.clear}}',
  traps: ['Les pings entre les bâtiments fonctionnent toujours (l’anneau passe par l’autre côté) : ne vous arrêtez pas à un test réussi.', 'Aligner l’autre extrémité sur la valeur erronée rétablit le voisin mais conserve des minuteurs hors standard.'],
  optimal: ['show ip ospf neighbor : le voisin manque', 'show ip ospf interface sur les deux extrémités : minuteurs différents', 'no ip ospf hello-interval / dead-interval', 'Vérifier le retour de l’adjacence en FULL'] });

/* ======================= ROUTER-ID EN DOUBLE ======================= */
add({ id: 'ospf_routerid_dup', level: 4, title: 'OSPF : deux routeurs voisins ont le même router-id', skills: ['ospf', 'diag'],
  vary: { m: [
    { key: 'lb5-as-lb4', dev: 'R-LB5', other: 'R-LB4', dup: RID['R-LB4'], rid: RID['R-LB4'], own: RID['R-LB5'], label: 'R-LB5 a été configuré par copier-coller avec « router-id 10.30.255.4 », celui de R-LB4 (voisin sur le lien Gi0/0)' },
    { key: 'lb3-as-lb2', dev: 'R-LB3', other: 'R-LB2', dup: RID['R-LB2'], rid: RID['R-LB2'], own: RID['R-LB3'], label: 'R-LB3 a été configuré par copier-coller avec « router-id 10.30.255.2 », celui de R-LB2 (voisin sur le lien Gi0/0)' }
  ] },
  ticket: tk('Supervision réseau (alerte automatique)', 'ALERTE — Labège : voisin OSPF perdu après remplacement d’un routeur', 'Alerte reçue après le remplacement d’un routeur de l’anneau à Labège : un voisinage OSPF ne se forme pas, l’autre sens de l’anneau fonctionne. Le technicien a repris la configuration d’un routeur voisin pour gagner du temps.'),
  cause: '{{m.label}} : deux routeurs d’une même zone OSPF ne peuvent pas avoir le même identifiant, l’adjacence n’est pas établie.',
  solution: 'Donner à {{m.dev}} son propre router-id ({{m.own}}, celui de sa Loopback0), puis relancer le processus : router-id {{m.own}} suivi de « clear ip ospf process » (le nouvel identifiant n’est pris en compte qu’après).',
  hints: ['L’adjacence entre deux routeurs voisins ne monte pas alors que le lien et les minuteurs sont bons : regardez les identifiants OSPF.', 'show ip protocols (ou show ip ospf) sur chacun des deux routeurs : comparez « Router ID ». show logging peut mentionner une détection de doublon.', 'Après avoir changé le router-id, IOS demande de relancer le processus : clear ip ospf process (réponse yes).'],
  inject: [{ do: 'set', path: '{{m.dev}}.ospf.routerId', value: '{{m.dup}}' }],
  verify: ['show:R-LB*:ospf-neighbor'],
  verifyText: 'Une fois la correction faite, constater depuis la console d’un routeur de l’anneau de Labège l’état des voisinages OSPF.',
  closeNote: 'Les postes de Labège se parlent déjà : le trafic passe par l’autre sens de l’anneau. Un ping réussi ne dit rien de l’état d’un voisinage OSPF ; la clôture exige de l’avoir constaté après la correction.',
  probes: [{ t: 'ospfnbr', dev: '{{m.dev}}', rid: '{{m.rid}}' }],
  roots: [{ probe: { t: 'ospfnbr', dev: '{{m.dev}}', rid: '{{m.rid}}' } }],
  fix: [{ do: 'set', path: '{{m.dev}}.ospf.routerId', value: '{{m.own}}' }, { do: 'del', path: '{{m.dev}}.ospf.activeRid' }],
  traps: ['Après « router-id », rien ne change tant que le processus n’est pas relancé : IOS prévient par un message, à lire.', 'Changer l’adresse de la Loopback ne suffit pas non plus si le router-id est configuré explicitement.'],
  optimal: ['show ip ospf neighbor : le voisin manque', 'show ip protocols sur les deux routeurs : même Router ID', 'router-id <valeur propre>', 'clear ip ospf process', 'Vérifier le retour du voisin en FULL'] });

/* ======================= ZONES : DÉSACCORD D'AREA SUR LE LIEN ABR ======================= */
const L3_GOOD = [NET('10.30.23.0', '0.0.0.3'), NET('10.30.34.0', '0.0.0.3'), NETA('10.30.36.0', '0.0.0.3', 1), NET('10.30.255.3', '0.0.0.0')];
add({ id: 'ospf_area_mismatch', level: 4, title: 'OSPF : l’annexe (zone 1) est coupée du reste du réseau', skills: ['ospf', 'ospf-multi', 'diag'],
  vary: { m: [
    { key: 'lb3-area0', dev: 'R-LB3', bad: [L3_GOOD[0], L3_GOOD[1], NETA('10.30.36.0', '0.0.0.3', 0), L3_GOOD[3]], good: L3_GOOD, label: 'l’instruction « network 10.30.36.0 0.0.0.3 area 1 » de R-LB3 a été recopiée avec « area 0 » : le lien Gi0/2 vers l’annexe est déclaré en zone 0 côté R-LB3 alors que R-LB6 le déclare en zone 1' },
    { key: 'lb3-area2', dev: 'R-LB3', bad: [L3_GOOD[0], L3_GOOD[1], NETA('10.30.36.0', '0.0.0.3', 2), L3_GOOD[3]], good: L3_GOOD, label: 'l’instruction « network 10.30.36.0 0.0.0.3 » de R-LB3 porte « area 2 » au lieu de « area 1 » (faute de frappe) : les deux extrémités du lien Gi0/2 ne sont pas dans la même zone' },
    { key: 'lb6-area0', dev: 'R-LB6', bad: [NETA('10.30.36.0', '0.0.0.3', 0), L6_GOOD[1], L6_GOOD[2]], good: L6_GOOD, label: 'l’instruction « network 10.30.36.0 0.0.0.3 » de R-LB6 porte « area 0 » alors que R-LB3 déclare ce lien en zone 1' }
  ] },
  ticket: tk('Marc Delmas (Labège)', 'L’annexe de Labège n’a plus accès à rien', 'Bonjour, depuis l’intervention d’hier soir sur les routeurs de Labège, le poste de l’annexe n’accède plus ni aux serveurs du bureau ni à l’atelier, ni à Internet. Le câblage de l’annexe n’a pas été touché. Les autres bâtiments fonctionnent entre eux.'),
  cause: '{{m.label}}. Deux routeurs ne deviennent voisins OSPF que s’ils déclarent le lien dans la même zone : l’adjacence entre R-LB3 (routeur de bordure de zone) et R-LB6 ne se forme pas et l’annexe n’a plus aucune route.',
  solution: 'Remettre le lien R-LB3 ↔ R-LB6 (10.30.36.0/30) en zone 1 des deux côtés : router ospf 1 → network 10.30.36.0 0.0.0.3 area 1 (sur {{m.dev}}), puis vérifier que le voisin repasse à FULL et que l’annexe reçoit les routes « O IA ».',
  hints: ['L’annexe n’atteint plus rien, mais les autres bâtiments se parlent : le défaut est sur le lien qui dessert l’annexe.', 'show ip ospf neighbor sur R-LB3 et sur R-LB6 : le voisin de l’autre côté du lien 10.30.36.0/30 est absent. show ip ospf interface sur ce lien indique la zone (Area) de chaque côté.', 'Deux routeurs ne forment une adjacence que si le lien est dans la même zone des deux côtés : comparez « Area » sur R-LB3 (Gi0/2) et R-LB6 (Gi0/0), et les instructions « network ... area ... » (show ip protocols).'],
  inject: [{ do: 'set', path: '{{m.dev}}.ospf.networks', value: '{{m.bad}}' }],
  probes: [{ t: 'ping', from: 'PC-LB6', to: '10.30.102.10' }, { t: 'ping', from: 'PC-LB2', to: '10.30.106.10', hidden: true }, { t: 'ping', from: 'PC-LB6', to: '8.8.8.8', hidden: true }],
  roots: [{ probe: { t: 'ospfnbr', dev: 'R-LB3', rid: RID['R-LB6'] } }],
  fix: [{ do: 'set', path: '{{m.dev}}.ospf.networks', value: '{{m.good}}' }],
  traps: ['Ajouter des routes statiques sur R-LB6 et sur les routeurs de l’anneau contourne OSPF sans corriger la cause.', 'Passer tout le site en zone 0 rétablit le lien mais détruit le découpage en zones voulu pour l’annexe.', 'Le ping de R-LB6 vers son voisin direct en 10.30.36.1 réussit : le lien physique est sain, c’est le voisinage OSPF qui manque.'],
  optimal: ['Ping annexe → bureau en échec', 'show ip ospf neighbor sur R-LB6 : aucun voisin', 'show ip ospf interface / show ip protocols : zones différentes sur le lien', 'Corriger l’instruction network (area 1)', 'Vérifier le voisin FULL et les routes O IA, retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
