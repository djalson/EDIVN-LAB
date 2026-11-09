/* ============================================================================
   Pannes — lot I : couche 2, EtherChannel (LACP) et Spanning Tree, site de Colomiers (SW-CA racine STP, SW-CB en Port-channel 1, SW-CC).
   Données pures : drapeaux des ports, état du Port-channel, racine et ports bloqués sont DÉRIVÉS de la configuration (src/engine/42-l2.js).
   Compétence de la fiche v21 : « Agrégation de liens — EtherChannel (LACP) et STP » (id : etherchannel).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body) => ({ from, subject, body, site: 'colomiers' });
const PORT = (sw, p) => sw + '.ports.' + p;
const MEMB = ['GigabitEthernet0/1', 'GigabitEthernet0/2'];
const PO = sw => PORT(sw, 'Port-channel1');
const setMode = (sw, mode) => MEMB.map(p => ({ do: 'set', path: PORT(sw, p) + '.chan.mode', value: mode }));
const setChan = (sw, ports, mode) => ports.map(p => ({ do: 'set', path: PORT(sw, p) + '.chan', value: { group: 1, mode } }));
const delChan = (sw, ports) => ports.map(p => ({ do: 'del', path: PORT(sw, p) + '.chan' }));
const flag = (sw, port) => ({ t: 'ecflag', dev: sw, port, flag: 'P' });
const FOUR = [flag('SW-CA', MEMB[0]), flag('SW-CA', MEMB[1]), flag('SW-CB', MEMB[0]), flag('SW-CB', MEMB[1])];
const PING10 = { t: 'ping', from: 'PC-C1', to: '10.40.10.12' };
const PING20 = { t: 'ping', from: 'PC-C3', to: '10.40.20.12' };
const TRUNK_OK = [10, 20];

/* ======================= NÉGOCIATION : MODES INCOMPATIBLES ======================= */
add({ id: 'ec_negotiation', level: 3, title: 'EtherChannel : le Port-channel entre SW-CA et SW-CB ne se forme pas (modes incompatibles)', skills: ['etherchannel', 'diag'],
  vary: { m: [
    { key: 'passive-passive', label: 'les ports membres des deux commutateurs sont en mode « passive » : chacun attend que l’autre propose l’agrégation et personne ne propose', inj: [...setMode('SW-CA', 'passive'), ...setMode('SW-CB', 'passive')], fix: setMode('SW-CA', 'active') },
    { key: 'on-active', label: 'les ports de SW-CA sont en mode « on » (agrégation forcée, sans négociation) alors que ceux de SW-CB négocient en LACP (« active ») : un côté parle LACP, l’autre non', inj: setMode('SW-CA', 'on'), fix: setMode('SW-CA', 'active') },
    { key: 'desirable', label: 'les ports de SW-CB ont été configurés en « desirable » (PAgP, protocole propriétaire Cisco) alors que SW-CA utilise LACP (« active ») : les deux protocoles ne se parlent pas', inj: setMode('SW-CB', 'desirable'), fix: setMode('SW-CB', 'active') }
  ] },
  ticket: tk('Supervision réseau (alerte automatique)', 'ALERTE — Colomiers : liaison SW-CA ↔ SW-CB dégradée, pas de bascule instantanée', 'Alerte reçue : la liaison entre SW-CA et SW-CB à Colomiers n’est plus en Port-channel. Un seul des deux câbles sert, l’autre est en attente, le débit est limité et il n’y a plus de bascule immédiate en cas de coupure. Les utilisateurs ne se plaignent de rien pour l’instant.'),
  cause: 'Entre SW-CA et SW-CB, {{m.label}}. Les deux ports restent chacun « seul » (I) et le Spanning Tree met l’un des deux câbles en attente (BLK) : le lien n’est plus agrégé.',
  solution: 'Mettre des modes compatibles sur les ports membres : LACP en « active » (au moins d’un côté, l’autre pouvant être « active » ou « passive »). Par exemple, sur les deux ports concernés : channel-group 1 mode active. Vérifier Po1(SU) et Gi0/1(P) Gi0/2(P) sur les deux commutateurs.',
  hints: ['Les postes fonctionnent encore : la panne est une perte de redondance et de débit, pas une coupure. C’est l’état de l’EtherChannel qu’il faut lire.', 'show etherchannel summary sur les deux commutateurs : comparez les drapeaux des ports (P = agrégé, I = resté seul) et la colonne Protocol. show spanning-tree vlan 10 sur SW-CB montre un port bloqué (BLK) vers SW-CA.', 'Deux ports ne s’agrègent que si leurs modes sont compatibles : active avec active ou passive (LACP), desirable avec desirable ou auto (PAgP), on avec on. Corrigez avec channel-group 1 mode active sur les ports membres du côté fautif.'],
  inject: '{{m.inj}}',
  verify: ['show:SW-CA:etherchannel-summary', 'show:SW-CB:etherchannel-summary'],
  verifyText: 'Une fois la correction faite, constater depuis la console d’un des deux commutateurs de Colomiers l’état du regroupement de liens entre SW-CA et SW-CB.',
  closeNote: 'Un ping entre deux postes qui réussit ne prouve pas que le regroupement de liens est rétabli : le trafic peut passer par un seul des deux câbles. Cette panne ne se constate que sur l’état de la liaison entre les deux commutateurs ; la clôture exige de l’avoir lu après la correction.',
  probes: [PING10, ...FOUR, { t: 'ecstate', dev: 'SW-CA', group: 1 }, { t: 'ecstate', dev: 'SW-CB', group: 1 }],
  roots: [flag('SW-CB', MEMB[0]), flag('SW-CB', MEMB[1])].map(probe => ({ probe })),
  fix: '{{m.fix}}',
  traps: ['Débrancher l’un des deux câbles supprime la boucle mais aussi la redondance : l’agrégation n’est pas rétablie.', 'Mettre « on » des deux côtés force l’agrégation sans négociation : plus de détection d’un mauvais câblage, et une boucle possible si un côté est mal configuré.', 'Le ping entre les postes réussit : ne vous arrêtez pas à un test réussi, la panne est dans l’état de l’agrégation.'],
  optimal: ['Ping OK mais alerte de supervision sur la liaison', 'show etherchannel summary sur SW-CA et SW-CB : ports en (I)', 'show spanning-tree vlan 10 sur SW-CB : un port bloqué (BLK) vers SW-CA', 'Aligner les modes sur LACP (channel-group 1 mode active)', 'Vérifier Po1(SU) et (P) sur les deux commutateurs'] });

/* ======================= GROUPE ABSENT SUR UN PORT OU UN COMMUTATEUR ======================= */
add({ id: 'ec_group_missing', level: 3, title: 'EtherChannel : « channel-group » manquant sur un port membre', skills: ['etherchannel', 'diag'],
  vary: { m: [
    { key: 'cb-both', label: 'les lignes « channel-group 1 mode active » ont disparu des deux ports de SW-CB (configuration restaurée depuis une ancienne sauvegarde)', inj: delChan('SW-CB', MEMB), fix: setChan('SW-CB', MEMB, 'active') },
    { key: 'ca-gi2', label: 'la ligne « channel-group 1 mode active » manque sur le port Gi0/2 de SW-CA : un seul des deux câbles est dans le groupe', inj: delChan('SW-CA', [MEMB[1]]), fix: setChan('SW-CA', [MEMB[1]], 'active') }
  ] },
  ticket: tk('Karim Benali (technicien réseau)', 'Colomiers : après la reprise de configuration, le lien SW-CA ↔ SW-CB n’est plus agrégé', 'Bonjour, j’ai remis en place la configuration des commutateurs de Colomiers après un incident. Tout a l’air de marcher (les postes se parlent) mais la supervision indique que le lien entre SW-CA et SW-CB n’est plus un Port-channel complet. Je ne retrouve pas pourquoi. Pouvez-vous regarder ?'),
  cause: 'Sur la liaison SW-CA ↔ SW-CB, {{m.label}}. Le port concerné n’a plus de partenaire LACP : il reste seul (I) et le Spanning Tree bloque l’un des câbles.',
  solution: 'Remettre le port dans le groupe : sur le port concerné, channel-group 1 mode active (la configuration du port doit rester identique à celle du Port-channel). Vérifier ensuite Po1(SU) avec les deux ports en (P) des deux côtés.',
  hints: ['Les postes se parlent : la panne ne coupe rien, elle réduit la redondance. Regardez l’état de l’agrégation côté SW-CA et côté SW-CB.', 'show etherchannel summary sur SW-CA et sur SW-CB : un port est en (I) ou le groupe est vide. show running-config interface gi0/1 puis gi0/2 : comparez les lignes des deux ports.', 'Un port qui n’a pas la ligne « channel-group 1 mode … » ne fait pas partie du groupe. Réintroduisez-la avec le même numéro de groupe que l’autre port.'],
  inject: '{{m.inj}}',
  verify: ['show:SW-CA:etherchannel-summary', 'show:SW-CB:etherchannel-summary'],
  verifyText: 'Une fois la correction faite, constater depuis la console d’un des deux commutateurs de Colomiers l’état du regroupement de liens entre SW-CA et SW-CB.',
  closeNote: 'Un ping entre deux postes qui réussit ne prouve pas que le regroupement de liens est rétabli : le trafic peut passer par un seul des deux câbles. Cette panne ne se constate que sur l’état de la liaison entre les deux commutateurs ; la clôture exige de l’avoir lu après la correction.',
  probes: [PING10, ...FOUR, { t: 'ecstate', dev: 'SW-CB', group: 1 }],
  roots: FOUR.map(probe => ({ probe })),
  fix: '{{m.fix}}',
  traps: ['Créer un second groupe (channel-group 2) pour le port concerné ne l’agrège pas avec l’autre : les deux ports doivent être dans le même groupe.', 'Un ping réussi ne prouve pas que l’agrégation est complète : le trafic passe par le câble resté seul.'],
  optimal: ['Ping OK, alerte sur la liaison', 'show etherchannel summary sur les deux commutateurs', 'show running-config interface sur chaque port membre : comparer', 'Remettre channel-group 1 mode active sur le port concerné', 'Vérifier Po1(SU) et (P) sur les deux ports des deux côtés'] });

/* ======================= MEMBRE DONT LA CONFIGURATION DIFFÈRE DU PORT-CHANNEL ======================= */
add({ id: 'ec_member_mismatch', level: 4, title: 'EtherChannel : un port membre est suspendu (configuration différente du Port-channel)', skills: ['etherchannel', 'trunk', 'diag'],
  vary: { m: [
    { key: 'cb-gi2-access', label: 'le port Gi0/2 de SW-CB a été repassé en mode access (switchport mode access) pendant un test de câble, alors que le Port-channel 1 est un trunk', inj: [{ do: 'set', path: PORT('SW-CB', MEMB[1]) + '.mode', value: 'access' }], fix: [{ do: 'set', path: PORT('SW-CB', MEMB[1]) + '.mode', value: 'trunk' }], flags: [flag('SW-CB', MEMB[1]), flag('SW-CA', MEMB[1])] },
    { key: 'ca-gi1-allowed', label: 'le port Gi0/1 de SW-CA porte une liste de VLAN autorisés réduite au VLAN 10 (saisie directement sur le port) alors que le Port-channel 1 en autorise deux', inj: [{ do: 'set', path: PORT('SW-CA', MEMB[0]) + '.allowed', value: [10] }], fix: [{ do: 'set', path: PORT('SW-CA', MEMB[0]) + '.allowed', value: TRUNK_OK }], flags: [flag('SW-CA', MEMB[0]), flag('SW-CB', MEMB[0])] },
    { key: 'cb-both-native', label: 'les deux ports de SW-CB ont reçu « switchport trunk native vlan 99 » directement sur les ports, alors que le Port-channel 1 est resté en VLAN natif 1', inj: MEMB.map(p => ({ do: 'set', path: PORT('SW-CB', p) + '.native', value: 99 })), fix: MEMB.map(p => ({ do: 'set', path: PORT('SW-CB', p) + '.native', value: 1 })), flags: FOUR }
  ] },
  ticket: tk('Supervision réseau (alerte automatique)', 'ALERTE — Colomiers : messages EtherChannel sur le journal de SW-CA / SW-CB', 'Alerte reçue : des messages EtherChannel sont apparus dans le journal d’un commutateur de Colomiers après une modification de configuration sur la liaison SW-CA ↔ SW-CB. Selon le technicien, « tout marche ». Merci de vérifier l’état réel de la liaison.'),
  cause: 'Sur la liaison SW-CA ↔ SW-CB, {{m.label}}. Un port membre doit avoir exactement la configuration de l’interface Port-channel : sinon IOS le suspend (s) et il ne transporte plus rien.',
  solution: 'Remettre le port membre identique au Port-channel : même mode, mêmes VLAN autorisés, même VLAN natif. Le plus sûr est de ne configurer que l’interface Port-channel (interface port-channel 1) : ses réglages sont répercutés sur les membres. Vérifier les deux ports en (P).',
  hints: ['Le journal de l’un des commutateurs contient un message %EC : lisez-le jusqu’au bout, il dit ce qui diffère.', 'show etherchannel summary : un port est en (s) = suspendu. Comparez show running-config interface port-channel 1 et show running-config interface du port suspendu.', 'Les ports membres doivent avoir la même configuration que le Port-channel (mode trunk, VLAN autorisés, VLAN natif). Alignez le port suspendu sur l’interface Port-channel, puis vérifiez que les deux ports repassent en (P).'],
  inject: '{{m.inj}}',
  verify: ['show:SW-CA:etherchannel-summary', 'show:SW-CB:etherchannel-summary'],
  verifyText: 'Une fois la correction faite, constater depuis la console d’un des deux commutateurs de Colomiers l’état du regroupement de liens entre SW-CA et SW-CB.',
  closeNote: 'Un ping entre deux postes qui réussit ne prouve pas que le regroupement de liens est rétabli : le trafic peut passer par un seul des deux câbles. Cette panne ne se constate que sur l’état de la liaison entre les deux commutateurs ; la clôture exige de l’avoir lu après la correction.',
  probes: [PING10, ...FOUR, { t: 'ecstate', dev: 'SW-CB', group: 1 }],
  roots: '{{m.flags}}',
  fix: '{{m.fix}}',
  traps: ['Supprimer le port suspendu du groupe (no channel-group) fait disparaître le message mais laisse un seul câble dans l’agrégation.', 'Modifier le Port-channel pour qu’il copie le port fautif propage l’erreur à tous les membres.', 'Selon la panne, le ping peut réussir (l’autre câble porte le trafic) ou échouer (les deux ports suspendus) : l’état des ports est la seule vérité.'],
  optimal: ['show etherchannel summary : port en (s)', 'show logging : lire le message %EC-5-CANNOT_BUNDLE2', 'Comparer le port suspendu et l’interface Port-channel', 'Aligner la configuration (mode, VLAN autorisés, VLAN natif)', 'Vérifier les ports en (P) et Po1(SU)'].map(x => x) });

/* ======================= VLAN ABSENT DE LA LISTE AUTORISÉE ======================= */
add({ id: 'ec_allowed_vlan', level: 3, title: 'Trunk et EtherChannel : le VLAN 20 ne traverse plus la liaison', skills: ['etherchannel', 'trunk', 'vlan', 'diag'],
  vary: { m: [
    { key: 'ca-po', label: 'sur SW-CA, « switchport trunk allowed vlan 10 » a été saisi sur Port-channel1 au lieu de « add » : le VLAN 20 n’est plus autorisé sur la liaison vers SW-CB', inj: [{ do: 'set', path: PO('SW-CA') + '.allowed', value: [10] }, ...MEMB.map(p => ({ do: 'set', path: PORT('SW-CA', p) + '.allowed', value: [10] }))], fix: [{ do: 'set', path: PO('SW-CA') + '.allowed', value: TRUNK_OK }, ...MEMB.map(p => ({ do: 'set', path: PORT('SW-CA', p) + '.allowed', value: TRUNK_OK }))], root: PO('SW-CA') },
    { key: 'cb-po', label: 'sur SW-CB, « switchport trunk allowed vlan 10 » a été saisi sur Port-channel1 au lieu de « add » : le VLAN 20 n’est plus autorisé sur la liaison vers SW-CA', inj: [{ do: 'set', path: PO('SW-CB') + '.allowed', value: [10] }, ...MEMB.map(p => ({ do: 'set', path: PORT('SW-CB', p) + '.allowed', value: [10] }))], fix: [{ do: 'set', path: PO('SW-CB') + '.allowed', value: TRUNK_OK }, ...MEMB.map(p => ({ do: 'set', path: PORT('SW-CB', p) + '.allowed', value: TRUNK_OK }))], root: PO('SW-CB') },
    { key: 'ca-cc', label: 'sur SW-CA, « switchport trunk allowed vlan 10 » a été saisi sur le trunk Fa0/23 vers SW-CC au lieu de « add » : le VLAN 20 n’est plus autorisé sur cette liaison', inj: [{ do: 'set', path: PORT('SW-CA', 'FastEthernet0/23') + '.allowed', value: [10] }], fix: [{ do: 'set', path: PORT('SW-CA', 'FastEthernet0/23') + '.allowed', value: TRUNK_OK }], root: PORT('SW-CA', 'FastEthernet0/23') }
  ] },
  ticket: tk('Thomas Girard (atelier)', 'Colomiers : les postes de l’atelier ne se voient plus entre eux', 'Bonjour, depuis ce matin les postes de l’atelier (VLAN 20) ne se voient plus d’un bâtiment à l’autre : PC-C3 ne répond plus à PC-C4. Les bureaux (VLAN 10) fonctionnent normalement. Quelqu’un est intervenu hier soir sur les commutateurs pour « ajouter un VLAN ».'),
  cause: 'Entre deux commutateurs de Colomiers, {{m.label}}. Le VLAN 10 passe, le VLAN 20 de l’atelier est bloqué à cet endroit de la liaison.',
  solution: 'Autoriser de nouveau le VLAN 20 sur la liaison concernée : switchport trunk allowed vlan add 20 (sur l’interface Port-channel1 pour un EtherChannel : le réglage est répercuté sur les membres). Vérifier avec show interfaces trunk des deux côtés.',
  hints: ['Un seul VLAN est coupé (l’atelier), l’autre fonctionne : un VLAN précis ne traverse plus une liaison entre commutateurs.', 'show interfaces trunk sur SW-CA, SW-CB et SW-CC : comparez la colonne « Vlans allowed on trunk » de chaque liaison, et lisez bien les interfaces affichées (Po1 pour l’EtherChannel).', 'Sur un EtherChannel, la liste des VLAN autorisés se règle sur l’interface Port-channel : switchport trunk allowed vlan add 20 sur interface port-channel 1. Pour la liaison simple vers SW-CC, sur le port lui-même.'],
  inject: '{{m.inj}}',
  probes: [PING20, { t: 'ping', from: 'PC-C1', to: '10.40.10.12', hidden: true }],
  roots: [{ any: [{ path: '{{m.root}}.allowed', eq: TRUNK_OK }, { path: '{{m.root}}.allowed', eq: 'all' }] }],
  fix: '{{m.fix}}',
  traps: ['Ajouter le VLAN uniquement sur un membre du Port-channel suspend ce membre : la configuration des membres doit suivre celle du Port-channel.', 'Passer la liaison en « allowed vlan all » corrige le symptôme mais ouvre des VLAN non prévus sur le trunk.'],
  optimal: ['Ping atelier KO, ping bureaux OK', 'show interfaces trunk sur les trois commutateurs', 'Repérer la liaison où le VLAN 20 manque', 'switchport trunk allowed vlan add 20 (sur Port-channel1 ou sur Fa0/23)', 'Retester le ping de l’atelier'] });

/* ======================= PORT-CHANNEL ÉTEINT ======================= */
add({ id: 'ec_po_shutdown', level: 2, title: 'EtherChannel : l’interface Port-channel est administrativement éteinte', skills: ['etherchannel', 'diag'],
  vary: { m: [
    { key: 'ca', sw: 'SW-CA', label: 'l’interface Port-channel1 de SW-CA est « shutdown » (saisie lors d’un test, jamais remise en service)' },
    { key: 'cb', sw: 'SW-CB', label: 'l’interface Port-channel1 de SW-CB est « shutdown » (saisie lors d’un test, jamais remise en service)' }
  ] },
  ticket: tk('Lucie Ferrand (bureaux)', 'Colomiers : le bâtiment B n’a plus de réseau du tout', 'Bonjour, depuis ce matin plus aucun poste du bâtiment B (PC-C1, PC-C3) ne joint quoi que ce soit : ni les collègues du bâtiment C, ni rien. Les voyants des câbles entre les deux armoires sont éteints. Rien n’a été débranché à ma connaissance.'),
  cause: 'Sur la liaison SW-CA ↔ SW-CB, {{m.label}}. Éteindre le Port-channel éteint tous ses membres : le bâtiment relié à SW-CB n’a plus aucune liaison.',
  solution: 'Remettre l’interface en service : interface port-channel 1 puis no shutdown. Vérifier Po1(SU) et les deux ports en (P) avec show etherchannel summary.',
  hints: ['Les deux câbles entre les armoires sont coupés en même temps : ce n’est pas un câble, c’est quelque chose qui les touche tous les deux.', 'show etherchannel summary sur SW-CA et SW-CB : Po1 est en (SD). show interfaces status : les membres sont à l’état notconnect ou disabled.', 'show running-config interface port-channel 1 : une ligne « shutdown ». no shutdown sur l’interface Port-channel (pas sur chaque membre).'],
  inject: [{ do: 'set', path: PO('{{m.sw}}') + '.adminDown', value: true }],
  probes: [PING10, PING20, { t: 'ecstate', dev: 'SW-CA', group: 1 }, { t: 'ecstate', dev: 'SW-CB', group: 1 }],
  roots: [{ path: PO('{{m.sw}}') + '.adminDown', ne: true }],
  fix: [{ do: 'set', path: PO('{{m.sw}}') + '.adminDown', value: false }],
  traps: ['Faire un « no shutdown » uniquement sur les ports membres ne suffit pas tant que le Port-channel reste éteint.', 'Retirer les ports du groupe pour les « réveiller » rétablit un lien mais détruit l’agrégation.'],
  optimal: ['Ping KO entre les bâtiments', 'show etherchannel summary sur SW-CA et SW-CB : Po1(SD)', 'show running-config interface port-channel 1 : shutdown', 'no shutdown sur Port-channel1', 'Vérifier Po1(SU) puis retester'] });

/* ======================= RACINE DU SPANNING TREE DÉPLACÉE ======================= */
add({ id: 'stp_root_moved', level: 3, title: 'Spanning Tree : la racine n’est plus SW-CA', skills: ['etherchannel', 'diag'],
  vary: { m: [
    { key: 'cc-0', sw: 'SW-CC', label: 'SW-CC a reçu la priorité 0 pour les VLAN 10 et 20 (spanning-tree vlan 10,20 priority 0), probablement pour « forcer » un test : il est devenu racine à la place de SW-CA', inj: [{ do: 'set', path: 'SW-CC.stp.prio', value: { 10: 0, 20: 0 } }], fix: [{ do: 'set', path: 'SW-CC.stp.prio', value: {} }] },
    { key: 'cb-0', sw: 'SW-CB', label: 'SW-CB a reçu la priorité 0 pour les VLAN 10 et 20 (spanning-tree vlan 10,20 priority 0), probablement pour « forcer » un test : il est devenu racine à la place de SW-CA', inj: [{ do: 'set', path: 'SW-CB.stp.prio', value: { 10: 0, 20: 0 } }], fix: [{ do: 'set', path: 'SW-CB.stp.prio', value: {} }] },
    { key: 'cc-v10', sw: 'SW-CC', label: 'SW-CC a reçu la priorité 0 pour le seul VLAN 10 (spanning-tree vlan 10 priority 0) : il est racine du VLAN 10 alors que SW-CA reste racine du VLAN 20', inj: [{ do: 'set', path: 'SW-CC.stp.prio', value: { 10: 0 } }], fix: [{ do: 'set', path: 'SW-CC.stp.prio', value: {} }] }
  ] },
  ticket: tk('Supervision réseau (alerte automatique)', 'ALERTE — Colomiers : changement de racine Spanning Tree', 'Alerte reçue : des messages de changement de racine Spanning Tree sont apparus sur les commutateurs de Colomiers. Le cœur de réseau est SW-CA, c’est lui qui doit rester la racine. Aucune coupure signalée, mais le chemin du trafic ne correspond plus au plan.'),
  cause: 'À Colomiers, {{m.label}}. Un commutateur d’accès devenu racine impose son arbre à tout le réseau : les chemins ne suivent plus l’architecture prévue (le cœur SW-CA doit être racine).',
  solution: 'Retirer la priorité imposée sur {{m.sw}} (no spanning-tree vlan 10,20 priority, ou la remettre à 32768), puis vérifier que SW-CA est racine avec show spanning-tree vlan 10 (« This bridge is the root »). Option complémentaire : donner à SW-CA une priorité explicite basse (spanning-tree vlan 10,20 root primary).',
  hints: ['Rien n’est coupé : la panne est un déplacement de la racine. Cherchez dans le journal les messages %SPANTREE-5-ROOTCHANGE.', 'show spanning-tree vlan 10 sur chaque commutateur : comparez « Root ID » et « Bridge ID », et la ligne « This bridge is the root ». Une priorité inférieure à celle de SW-CA a été saisie quelque part.', 'show running-config | include spanning-tree repère la ligne « spanning-tree vlan … priority … ». no spanning-tree vlan 10,20 priority la retire. Le cœur de réseau SW-CA doit rester celui qui a la priorité la plus basse.'],
  inject: '{{m.inj}}',
  verify: ['show:SW-CA:spanning-tree', 'show:SW-CB:spanning-tree', 'show:SW-CC:spanning-tree'],
  verifyText: 'Une fois la correction faite, constater depuis la console d’un commutateur de Colomiers quel commutateur est racine du Spanning Tree.',
  closeNote: 'Un ping entre deux postes qui réussit ne prouve rien sur la racine du Spanning Tree : le trafic passe aussi quand l’arbre est faux. La clôture exige de constater, après la correction, quel commutateur est racine.',
  probes: [PING10, { t: 'stproot', dev: 'SW-CA', vlan: 10 }, { t: 'stproot', dev: 'SW-CA', vlan: 20 }],
  roots: [{ path: '{{m.sw}}.stp.prio', eq: {} }],
  fix: '{{m.fix}}',
  traps: ['Un ping réussi ne prouve rien : l’arbre peut être faux et le trafic passer quand même.', 'Mettre aussi la priorité 0 sur SW-CA ramène la racine (égalité départagée par l’adresse MAC) mais laisse une priorité aberrante sur le commutateur d’accès : le contournement tient à une adresse MAC, pas à l’architecture.'],
  optimal: ['Lire les messages ROOTCHANGE du journal', 'show spanning-tree vlan 10 sur les trois commutateurs : repérer la racine', 'show running-config | include spanning-tree : priorité anormale', 'Retirer la priorité imposée', 'Vérifier que SW-CA est racine pour les VLAN 10 et 20'] });

/* ======================= BOUCLE : STP DÉSACTIVÉ + CÂBLE ENTRE DEUX PRISES ======================= */
add({ id: 'stp_loop_cable', level: 4, title: 'Spanning Tree désactivé et boucle de câblage : tempête de diffusion dans le VLAN 10', skills: ['etherchannel', 'diag'],
  vary: { m: [
    { key: 'vlan10', label: 'un câble de brassage relie les prises Fa0/20 et Fa0/21 de SW-CC (deux ports du VLAN 10), et le Spanning Tree a été désactivé pour le VLAN 10 sur SW-CC (no spanning-tree vlan 10), « pour accélérer les ports »' }
  ] },
  ticket: tk('Lucie Ferrand (bureaux)', 'Colomiers : le réseau des bureaux est inutilisable, les voyants clignotent en continu', 'Bonjour, depuis ce matin le réseau des bureaux (VLAN 10) est inutilisable : plus aucun poste ne répond et les voyants de l’armoire du bâtiment C clignotent sans arrêt. L’atelier (VLAN 20) fonctionne. Quelqu’un est intervenu dans l’armoire hier soir, je ne sais pas qui.'),
  cause: 'À Colomiers, {{m.label}}. Le câble ferme une boucle sur SW-CC et, sans Spanning Tree sur ce VLAN, aucun port n’est bloqué : les trames de diffusion tournent à l’infini (tempête de diffusion) et saturent tout le VLAN 10.',
  solution: 'Réactiver le Spanning Tree pour le VLAN 10 sur SW-CC : spanning-tree vlan 10 (il bloquera alors l’un des deux ports de la boucle). Retirer ensuite le câble de brassage inutile. Vérifier avec show spanning-tree vlan 10.',
  hints: ['Un seul VLAN est touché, les voyants clignotent en continu : c’est le comportement d’une boucle de couche 2 sans protection.', 'show spanning-tree vlan 10 sur SW-CC : il n’y a plus d’instance (« does not exist »). show running-config | include spanning-tree montre « no spanning-tree vlan 10 ». show interfaces status montre deux prises libres (Fa0/20 et Fa0/21) à l’état « connected » alors qu’aucun poste n’y est branché.', 'Réactivez le Spanning Tree sur le VLAN 10 (spanning-tree vlan 10) : un port de la boucle passe en blocage (BLK). Débranchez ensuite le câble inutile.'],
  inject: [{ do: 'set', path: PORT('SW-CC', 'FastEthernet0/20') + '.cable', value: { plugged: true, to: 'SW-CC:FastEthernet0/21' } }, { do: 'set', path: PORT('SW-CC', 'FastEthernet0/21') + '.cable', value: { plugged: true, to: 'SW-CC:FastEthernet0/20' } }, { do: 'set', path: 'SW-CC.stp.off', value: [10] }],
  probes: [PING10, { t: 'stpnostorm', dev: 'SW-CC', vlan: 10 }, { t: 'ping', from: 'PC-C3', to: '10.40.20.12', hidden: true }],
  roots: [{ path: 'SW-CC.stp.off', eq: [] }],
  fix: [{ do: 'set', path: 'SW-CC.stp.off', value: [] }],
  traps: ['Débrancher le câble de brassage rétablit le réseau mais laisse le Spanning Tree désactivé : la prochaine boucle recommencera.', 'Redémarrer les commutateurs ne change rien : la boucle revient dès que les ports remontent.'],
  optimal: ['Constater que seul le VLAN 10 est touché', 'show spanning-tree vlan 10 sur SW-CC : aucune instance', 'show running-config | include spanning-tree : STP désactivé pour le VLAN 10', 'spanning-tree vlan 10, puis débrancher le câble inutile', 'Retester le ping des bureaux'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
