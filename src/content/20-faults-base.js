/* ============================================================================
   Pannes — lot A : couche physique, adressage IPv4, DHCP, DNS, pare-feu Windows, IIS (service).
   Données pures, JSON-compatibles. Variantes `vary`, gabarits {{x}}.
   `roots` = ce qui doit être réparé pour que la panne soit réellement résolue
   (sinon : « contournement » même si les sondes passent).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const CL = [
  { host: 'PC-01', user: 'Alice Martin', svc: 'la comptabilité' },
  { host: 'PC-02', user: 'Bruno Durand', svc: 'les RH' }
];
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
const SCOPE = 'SRV-DC1.win.dhcp.scopes[id=10.10.20.0]';
const SCOPE_K = 'SRV-DC1/win/dhcp/scopes[10.10.20.0]';
const reDhcp = h => [{ do: 'release', dev: h }, { do: 'renew', dev: h }];

/* ======================= COUCHE PHYSIQUE ======================= */
add({ id: 'phys_eth', v1: 'phys_eth', level: 1, title: 'Câble réseau débranché du poste', skills: ['phys', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Plus d’Internet ni de dossiers', 'Bonjour, depuis ce matin mon ordinateur n’ouvre plus les dossiers partagés ni Internet. En bas à droite il y a une petite croix. Pouvez-vous passer ? Merci.'),
  cause: 'Le câble réseau est débranché à l’arrière du poste : aucune liaison, donc aucune communication.',
  solution: 'Rebrancher le câble sur la carte réseau du poste (vérifier le voyant de liaison).',
  hints: ['Regardez l’icône réseau dans la barre des tâches, puis l’état de la carte dans les connexions réseau.', 'Une carte « Câble réseau non connecté » est un problème de couche 1 : allez voir derrière le poste.', 'Rebranchez le câble RJ45 sur le poste et vérifiez le voyant de liaison.'],
  inject: [{ do: 'unplug', port: '{{c.host}}:Ethernet0' }],
  probes: [{ t: 'link', dev: '{{c.host}}', port: 'Ethernet0' }, { t: 'ping', from: '{{c.host}}', to: '10.10.10.10' }],
  roots: ['{{c.host}}/ifaces/Ethernet0/cable'],
  fix: [{ do: 'replug', port: '{{c.host}}:Ethernet0' }],
  traps: ['Réinitialiser la pile TCP/IP ou le DHCP n’a aucun effet tant que la liaison est coupée.'],
  optimal: ['Constater « câble non connecté » dans les connexions réseau', 'Aller à l’arrière du poste', 'Rebrancher le câble', 'Tester un ping vers le serveur'] });

add({ id: 'phys_wall', v1: 'phys_wall', level: 1, title: 'Prise murale non brassée au panneau', skills: ['phys', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Prise du bureau T-114 morte', 'Bonjour, j’ai déplacé mon poste hier et la prise murale T-114 ne marche pas : mon ordinateur est bien branché mais rien ne se passe. Le voyant de la carte réseau est éteint.'),
  cause: 'Le cordon de brassage de la prise T-114 est débranché côté commutateur (panneau de brassage / SW-T2 Fa0/2).',
  solution: 'Rebrasser la prise T-114 sur le port Fa0/2 du commutateur SW-T2.',
  hints: ['Le poste et son câble sont corrects : le problème se situe plus loin sur le chemin de la prise.', 'Une prise murale est reliée à un commutateur par un cordon de brassage : allez dans la baie.', 'Dans la baie, repérez la prise T-114 et rebranchez son cordon sur le port Fa0/2 de SW-T2.'],
  inject: [{ do: 'wall', wall: 'T-114', to: null }],
  probes: [{ t: 'link', dev: 'PC-01', port: 'Ethernet0' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: ['walls/T-114'],
  fix: [{ do: 'wall', wall: 'T-114', to: 'SW-T2:FastEthernet0/2' }],
  traps: ['Remplacer le câble du poste ne change rien : il est bon.'],
  optimal: ['Constater l’absence de liaison côté poste', 'Aller à la baie de brassage', 'Repérer la prise T-114', 'Rebrasser sur Fa0/2 de SW-T2'] });

add({ id: 'phys_patch', level: 2, title: 'Prise brassée sur le mauvais port du commutateur', skills: ['phys', 'vlan', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Réseau « non identifié » depuis le déménagement', 'Bonjour, depuis qu’on a déplacé mon bureau, mon ordinateur est branché sur la prise T-114 mais il dit « réseau non identifié » et je n’ai plus accès à rien. Le voyant de la carte clignote pourtant.'),
  cause: 'La prise T-114 a été brassée sur un port du commutateur qui appartient au VLAN 1 (Fa0/9) au lieu du port du VLAN 20 : le poste n’obtient pas de bail DHCP.',
  solution: 'Rebrasser la prise sur Fa0/2 (VLAN 20), ou affecter le port Fa0/9 au VLAN 20 si le brassage est volontaire.',
  hints: ['La liaison est bonne mais le poste a une adresse en 169.254.x.x : il n’a pas reçu de bail DHCP.', 'Regardez sur quel port du commutateur le poste arrive et dans quel VLAN se trouve ce port (show vlan brief / show interfaces status).', 'Le port Fa0/9 est dans le VLAN 1 ; le poste doit être dans le VLAN 20. Rebrassez ou affectez le port au bon VLAN.'],
  inject: [{ do: 'wall', wall: 'T-114', to: 'SW-T2:FastEthernet0/9' }, { do: 'set', path: 'SW-T2.ports.FastEthernet0/2.cable', value: null }, { do: 'set', path: 'SW-T2.ports.FastEthernet0/9.cable', value: { plugged: true, to: 'patch:T-114' } }, { do: 'release', dev: 'PC-01' }, { do: 'renew', dev: 'PC-01' }],
  probes: [{ t: 'ip', host: 'PC-01', net: '10.10.20.0/24' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: [{ any: [{ path: 'SW-T2.ports.FastEthernet0/9.vlan', eq: 20 }, 'walls/T-114'] }],
  fix: [{ do: 'wall', wall: 'T-114', to: 'SW-T2:FastEthernet0/2' }, { do: 'set', path: 'SW-T2.ports.FastEthernet0/9.cable', value: null }, { do: 'set', path: 'SW-T2.ports.FastEthernet0/2.cable', value: { plugged: true, to: 'patch:T-114' } }, { do: 'renew', dev: 'PC-01' }],
  fixes: { vlan: [{ do: 'set', path: 'SW-T2.ports.FastEthernet0/9.vlan', value: 20 }, { do: 'renew', dev: 'PC-01' }] },
  traps: ['Une IP statique rend le poste « joignable » mais ne corrige rien si le port n’est pas dans le bon VLAN (ici le VLAN 1 n’a aucune passerelle).'],
  optimal: ['ipconfig : adresse 169.254.x.x', 'Identifier le port de brassage (prise T-114 → SW-T2)', 'show vlan / show interfaces status : Fa0/9 en VLAN 1', 'Rebrasser sur Fa0/2 ou mettre Fa0/9 en VLAN 20', 'ipconfig /renew et test'] });

add({ id: 'phys_power', v1: 'phys_power', level: 1, title: 'Poste sans alimentation (multiprise éteinte)', skills: ['phys', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Mon ordinateur ne s’allume plus', 'Bonjour, ce matin mon ordinateur ne démarre pas du tout, aucune lumière. Hier soir il fonctionnait. Pouvez-vous regarder ?'),
  cause: 'La multiprise du poste est éteinte (interrupteur sur Arrêt) : le poste n’est pas alimenté.',
  solution: 'Rallumer la multiprise puis démarrer le poste.',
  hints: ['Aucune lumière, aucun bruit : pensez à l’alimentation avant de soupçonner le poste.', 'Suivez le câble d’alimentation du poste jusqu’à la prise : y a-t-il une multiprise ?', 'L’interrupteur de la multiprise est sur arrêt : rallumez-la.'],
  inject: [{ do: 'set', path: '{{c.host}}.phys.strip', value: false }],
  probes: [{ t: 'eq', path: '{{c.host}}.phys.strip', value: true }, { t: 'link', dev: '{{c.host}}', port: 'Ethernet0' }],
  roots: ['{{c.host}}/phys'], verify: ['use:{{c.host}}:screen'],
  fix: [{ do: 'set', path: '{{c.host}}.phys.strip', value: true }],
  traps: ['Remplacer le bloc d’alimentation du poste est inutile : il n’est simplement pas alimenté.'],
  optimal: ['Constater l’absence totale de signe de vie', 'Vérifier la multiprise', 'La rallumer', 'Démarrer le poste et ouvrir une session'] });

add({ id: 'phys_screen', v1: 'phys_screen', level: 1, title: 'Écran noir : câble vidéo débranché', skills: ['phys', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Écran noir', 'Bonjour, mon écran est noir ce matin mais le poste a l’air allumé (ventilateur, voyant). Je ne vois rien. Merci de votre aide.'),
  cause: 'Le câble vidéo entre l’unité centrale et l’écran est débranché.',
  solution: 'Rebrancher le câble vidéo à l’arrière de l’unité centrale et de l’écran.',
  hints: ['Le poste tourne mais l’écran est noir : l’image ne parvient pas à l’écran.', 'Regardez l’écran lui-même : indique-t-il « aucun signal » ?', 'Vérifiez que le câble vidéo est bien enfiché des deux côtés et rebranchez-le.'],
  inject: [{ do: 'set', path: '{{c.host}}.phys.screenCable', value: false }],
  probes: [{ t: 'eq', path: '{{c.host}}.phys.screenCable', value: true }],
  roots: ['{{c.host}}/phys/screenCable'], verify: ['use:{{c.host}}:screen'],
  fix: [{ do: 'set', path: '{{c.host}}.phys.screenCable', value: true }],
  traps: ['Redémarrer le poste ne change rien.'],
  optimal: ['Constater « Aucun signal » sur l’écran', 'Contrôler le câble vidéo', 'Le rebrancher'] });

add({ id: 'phys_mon', v1: 'phys_mon', level: 1, title: 'Écran éteint', skills: ['phys'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Pas d’image ce matin', 'Bonjour, je n’ai pas d’image sur mon écran, aucune lumière dessus. Le poste semble allumé.'),
  cause: 'L’écran est éteint (bouton d’alimentation de l’écran).',
  solution: 'Allumer l’écran avec son bouton d’alimentation.',
  hints: ['Y a-t-il un voyant d’alimentation allumé sur l’écran ?', 'L’écran possède son propre bouton d’alimentation.', 'Appuyez sur le bouton d’alimentation de l’écran.'],
  inject: [{ do: 'set', path: '{{c.host}}.phys.monitorOn', value: false }],
  probes: [{ t: 'eq', path: '{{c.host}}.phys.monitorOn', value: true }],
  roots: ['{{c.host}}/phys/monitorOn'], verify: ['use:{{c.host}}:screen'],
  fix: [{ do: 'set', path: '{{c.host}}.phys.monitorOn', value: true }],
  traps: [], optimal: ['Vérifier le voyant d’alimentation de l’écran', 'Appuyer sur le bouton d’alimentation de l’écran', 'Constater le retour de l’image'] });

add({ id: 'phys_source', v1: 'phys_source', level: 1, title: 'Écran sur la mauvaise source vidéo', skills: ['phys'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Écran « aucun signal »', 'Bonjour, mon écran affiche « Aucun signal » alors que tout est branché et que le poste est allumé. Quelqu’un a touché aux boutons de l’écran hier, je crois.'),
  cause: 'Le menu de l’écran a été modifié : l’entrée vidéo sélectionnée (HDMI 1) n’est pas celle sur laquelle le poste est branché (DisplayPort).',
  solution: 'Dans le menu de l’écran, rechoisir l’entrée DisplayPort (DP).',
  hints: ['Les câbles sont corrects : l’écran n’écoute simplement pas la bonne entrée.', 'Ouvrez le menu de l’écran avec ses boutons physiques et cherchez « Source » ou « Entrée ».', 'Sélectionnez l’entrée DisplayPort, celle où le câble du poste est branché.'],
  inject: [{ do: 'set', path: '{{c.host}}.phys.source', value: 'HDMI1' }],
  probes: [{ t: 'eq', path: '{{c.host}}.phys.source', value: 'DP' }],
  roots: ['{{c.host}}/phys/source'], verify: ['use:{{c.host}}:screen'],
  fix: [{ do: 'set', path: '{{c.host}}.phys.source', value: 'DP' }],
  traps: ['Débrancher et rebrancher le câble ne change rien : le câble n’est pas en cause.'],
  optimal: ['Lire le message « Aucun signal » et l’entrée affichée', 'Ouvrir le menu de l’écran', 'Choisir l’entrée DP'] });

/* ======================= ADRESSAGE IPv4 ======================= */
add({ id: 'nic_disabled', level: 1, title: 'Carte réseau désactivée dans Windows', skills: ['phys', 'subnetting', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Plus de réseau alors que le câble est bien branché', 'Bonjour, mon ordinateur n’a plus du tout de réseau : ni dossiers partagés ni Internet. Le câble est bien enfoncé et le voyant de la prise clignote encore. Un collègue a « fait du ménage » dans les paramètres hier.'),
  cause: 'La carte réseau Ethernet0 de {{c.host}} a été désactivée dans « Connexions réseau » (état Désactivé) : le câble est branché et le port du commutateur est actif, mais le système n’utilise plus la carte.',
  solution: 'Réactiver la carte (ncpa.cpl → clic droit sur Ethernet0 → Activer, ou Enable-NetAdapter) puis vérifier l’adressage et le ping vers le serveur.',
  hints: ['Le câble est branché : regardez l’état de la carte dans Connexions réseau (ncpa.cpl) avant de chercher plus loin.', 'Une carte « Désactivé » (icône grisée) est différente d’une carte « Câble réseau non connecté » : la cause est dans Windows, pas sur le câble.', 'Clic droit sur la carte → Activer (droits d’administrateur requis), puis vérifiez l’adresse avec ipconfig et testez un ping vers le serveur.'],
  inject: [{ do: 'set', path: '{{c.host}}.ifaces.Ethernet0.adminDown', value: true }],
  probes: [{ t: 'link', dev: '{{c.host}}', port: 'Ethernet0' }, { t: 'ping', from: '{{c.host}}', to: '10.10.10.10' }],
  roots: [{ path: '{{c.host}}.ifaces.Ethernet0.adminDown', ne: true }],
  fix: [{ do: 'set', path: '{{c.host}}.ifaces.Ethernet0.adminDown', value: false }],
  traps: ['Rebrancher ou changer le câble ne change rien : la liaison physique est déjà bonne.', 'Renouveler le bail DHCP est impossible tant que la carte est désactivée.'],
  optimal: ['Constater l’absence de réseau malgré le câble branché', 'ncpa.cpl : carte « Désactivé »', 'Activer la carte', 'Vérifier l’adresse (ipconfig)', 'Tester un ping vers le serveur'] });

add({ id: 'ipv4_static', v1: 'ipv4_static', level: 1, title: 'Adresse IP statique erronée sur le poste d’administration', skills: ['subnetting', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'PC-ADM n’accède plus à rien', 'Salut, depuis la modif d’hier soir sur PC-ADM je n’accède plus aux serveurs ni à Internet. La carte est connectée pourtant. Tu peux regarder ?'),
  cause: 'L’adresse IP statique de PC-ADM a été saisie dans un autre sous-réseau (10.10.31.x au lieu de 10.10.30.x) : la passerelle n’est plus joignable.',
  solution: 'Rétablir une adresse valide du VLAN 30 (10.10.30.10/24, passerelle 10.10.30.1).',
  hints: ['Comparez l’adresse IP du poste avec celle de sa passerelle (ipconfig /all).', 'L’adresse et la passerelle ne sont pas dans le même sous-réseau avec ce masque.', 'Corrigez l’adresse : 10.10.30.10 avec le masque 255.255.255.0.'],
  inject: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.ip', value: '10.10.31.10' }],
  probes: [{ t: 'ip', host: 'PC-ADM', net: '10.10.30.0/24' }, { t: 'ping', from: 'PC-ADM', to: '10.10.10.10' }],
  roots: [{ path: 'PC-ADM.ifaces.Ethernet0.ip', net: '10.10.30.0/24' }],
  fix: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.ip', value: '10.10.30.10' }],
  traps: ['Changer la passerelle pour « coller » à l’adresse casserait le routage du VLAN 30.'],
  optimal: ['ipconfig /all', 'Comparer IP et passerelle', 'Corriger l’IP', 'Ping de la passerelle puis du serveur'] });

add({ id: 'ipv4_gw', v1: 'ipv4_gw', level: 1, title: 'Passerelle par défaut erronée', skills: ['subnetting', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'PC-ADM : les serveurs ne répondent plus', 'Salut, sur PC-ADM je pingue bien les machines du même réseau mais rien au-delà (serveurs, Internet). Je n’ai rien changé de mon côté.'),
  cause: 'La passerelle configurée (10.10.30.254) n’existe pas : la passerelle du VLAN 30 est 10.10.30.1.',
  solution: 'Corriger la passerelle par défaut : 10.10.30.1.',
  hints: ['Le trafic local fonctionne, celui qui traverse un routeur non : regardez la passerelle.', 'Pingez la passerelle indiquée par ipconfig : répond-elle ?', 'La passerelle du VLAN 30 est l’interface Vlan30 de SW-T1 : 10.10.30.1.'],
  inject: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.gw', value: '10.10.30.254' }],
  probes: [{ t: 'ping', from: 'PC-ADM', to: '10.10.10.10' }, { t: 'ping', from: 'PC-ADM', to: '8.8.8.8' }],
  roots: [{ path: 'PC-ADM.ifaces.Ethernet0.gw', eq: '10.10.30.1' }],
  fix: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.gw', value: '10.10.30.1' }],
  traps: ['Ajouter une route statique sur le poste pour contourner masque le défaut de passerelle.'],
  optimal: ['ipconfig /all', 'Ping de la passerelle : pas de réponse', 'Corriger la passerelle', 'Tester serveur et Internet'] });

add({ id: 'ipv4_mask', level: 1, title: 'Masque de sous-réseau erroné', skills: ['subnetting', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'PC-ADM isolé', 'Salut, PC-ADM n’atteint plus que lui-même. Même la passerelle ne répond pas. L’adresse IP a l’air correcte pourtant.'),
  cause: 'Le masque a été saisi en 255.255.255.252 : la passerelle 10.10.30.1 est en dehors du sous-réseau calculé du poste.',
  solution: 'Rétablir le masque 255.255.255.0.',
  hints: ['L’adresse est bonne : regardez les trois autres champs, surtout le masque.', 'Avec un /30, quelle est la plage du réseau de 10.10.30.10 ? La passerelle y est-elle ?', 'Remettez le masque 255.255.255.0 (/24) sur la carte réseau de PC-ADM.'],
  inject: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.mask', value: '255.255.255.252' }],
  probes: [{ t: 'ping', from: 'PC-ADM', to: '10.10.30.1' }, { t: 'ping', from: 'PC-ADM', to: '10.10.10.10' }],
  roots: [{ path: 'PC-ADM.ifaces.Ethernet0.mask', eq: '255.255.255.0' }],
  fix: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.mask', value: '255.255.255.0' }],
  traps: [], optimal: ['ipconfig /all', 'Calculer la plage du /30', 'Corriger le masque'] });

add({ id: 'ipv4_dns', v1: 'ipv4_dns', level: 1, title: 'Serveur DNS du client erroné', skills: ['subnetting', 'dns', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'PC-ADM : « le serveur est introuvable »', 'Salut, depuis PC-ADM j’arrive à pinguer les serveurs par IP mais pas par leur nom (\\\\srv-fic par exemple). Les noms ne passent plus.'),
  cause: 'Le serveur DNS configuré sur PC-ADM (10.10.10.99) n’existe pas : seule la résolution de noms est cassée.',
  solution: 'Configurer le serveur DNS 10.10.10.10 (SRV-DC1).',
  hints: ['Ping par IP : oui ; ping par nom : non. Quel service traduit les noms ?', 'ipconfig /all : quel serveur DNS est configuré ? Répond-il ?', 'Le DNS interne est SRV-DC1 : 10.10.10.10.'],
  inject: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.dns', value: ['10.10.10.99'] }],
  probes: [{ t: 'resolve', from: 'PC-ADM', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'ping', from: 'PC-ADM', to: 'srv-fic.toulouse.local' }],
  roots: [{ path: 'PC-ADM.ifaces.Ethernet0.dns', has: '10.10.10.10' }],
  fix: [{ do: 'set', path: 'PC-ADM.ifaces.Ethernet0.dns', value: ['10.10.10.10'] }, { do: 'flushdns', dev: 'PC-ADM' }],
  workarounds: { hosts: [{ do: 'push', path: 'PC-ADM.hostsFile', item: { ip: '10.10.10.20', name: 'srv-fic' } }, { do: 'push', path: 'PC-ADM.hostsFile', item: { ip: '10.10.10.20', name: 'srv-fic.toulouse.local' } }] },
  traps: ['Ajouter des entrées dans le fichier hosts fait « marcher » ce serveur mais pas les autres noms.'],
  optimal: ['ping IP OK / ping nom KO', 'ipconfig /all : DNS invalide', 'Corriger le DNS', 'ipconfig /flushdns puis nslookup'] });

/* ======================= DHCP ======================= */
const dhcpProbes = h => [{ t: 'ip', host: h, net: '10.10.20.0/24' }, { t: 'ping', from: h, to: '10.10.10.10' }];
const staticWA = h => [{ do: 'set', path: h + '.ifaces.Ethernet0.dhcp', value: false }, { do: 'set', path: h + '.ifaces.Ethernet0.ip', value: '10.10.20.77' }, { do: 'set', path: h + '.ifaces.Ethernet0.mask', value: '255.255.255.0' }, { do: 'set', path: h + '.ifaces.Ethernet0.gw', value: '10.10.20.1' }, { do: 'set', path: h + '.ifaces.Ethernet0.dns', value: ['10.10.10.10'] }];

add({ id: 'dhcp_svc', v1: 'dhcp_svc', level: 1, title: 'Service Serveur DHCP arrêté', skills: ['dhcp', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'Pas de réseau depuis ce matin', 'Bonjour, mon poste dit « Réseau non identifié / Accès limité » depuis ce matin. Collègues pareil dans le bureau d’à côté, je crois. Je n’ai plus accès aux dossiers.'),
  cause: 'Le service « Serveur DHCP » est arrêté sur SRV-DC1 : les postes ne peuvent plus obtenir ni renouveler leur bail et passent en adressage APIPA (169.254.x.x).',
  solution: 'Démarrer le service Serveur DHCP sur SRV-DC1 (services.msc / console DHCP) puis renouveler le bail du poste.',
  hints: ['ipconfig sur le poste : l’adresse commence par 169.254. Qui distribue normalement les adresses ?', 'Le serveur DHCP est SRV-DC1 : ouvrez la console DHCP ou services.msc sur ce serveur.', 'Le service « Serveur DHCP » est arrêté : démarrez-le, puis ipconfig /renew sur le poste.'],
  inject: [{ do: 'svc', dev: 'SRV-DC1', name: 'DHCPServer', state: 'stopped' }].concat(reDhcp('{{c.host}}')),
  probes: dhcpProbes('{{c.host}}'),
  roots: ['SRV-DC1/win/svc/DHCPServer'],
  fix: [{ do: 'svc', dev: 'SRV-DC1', name: 'DHCPServer', state: 'running' }, { do: 'renew', dev: '{{c.host}}' }],
  workarounds: { ip_statique: staticWA('{{c.host}}') },
  traps: ['Une IP fixe sur le poste rend l’utilisateur opérationnel mais laisse tous les autres postes sans réseau.'],
  optimal: ['ipconfig : 169.254.x.x', 'Aller sur SRV-DC1 : console DHCP / services.msc', 'Démarrer « Serveur DHCP »', 'ipconfig /renew sur le poste'] });

add({ id: 'dhcp_svc_disabled', level: 2, title: 'Service DHCP désactivé (type de démarrage)', skills: ['dhcp', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus de réseau après le redémarrage du serveur', 'Bonjour, depuis le redémarrage du serveur cette nuit, plusieurs postes n’ont plus de réseau. On a pourtant essayé de redémarrer le poste.'),
  cause: 'Le service Serveur DHCP est configuré en démarrage « Désactivé » sur SRV-DC1 : il ne démarre plus au redémarrage et ne peut pas être lancé tant que le type de démarrage n’est pas modifié.',
  solution: 'Passer le type de démarrage à Automatique, démarrer le service, puis renouveler le bail.',
  hints: ['Le serveur a redémarré cette nuit : un service ne s’est peut-être pas relancé.', 'Dans services.msc de SRV-DC1, regardez le « Type de démarrage » du Serveur DHCP.', 'Le type est Désactivé : passez-le à Automatique avant de démarrer le service.'],
  inject: [{ do: 'svc', dev: 'SRV-DC1', name: 'DHCPServer', state: 'stopped' }, { do: 'set', path: 'SRV-DC1.win.svc.DHCPServer.start', value: 'disabled' }].concat(reDhcp('PC-01')),
  probes: dhcpProbes('PC-01'),
  roots: ['SRV-DC1/win/svc/DHCPServer'],
  fix: [{ do: 'set', path: 'SRV-DC1.win.svc.DHCPServer.start', value: 'auto' }, { do: 'svc', dev: 'SRV-DC1', name: 'DHCPServer', state: 'running' }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: ['Démarrer le service sans changer le type : il ne repartira pas au prochain redémarrage.'],
  optimal: ['Constater l’APIPA', 'services.msc sur SRV-DC1', 'Type de démarrage → Automatique', 'Démarrer le service', 'ipconfig /renew'] });

add({ id: 'dhcp_unauth', level: 3, title: 'Serveur DHCP non autorisé dans Active Directory', skills: ['dhcp-auth', 'dhcp', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus d’adresses depuis la migration de ce week-end', 'Bonjour, depuis la reprise de lundi les postes n’obtiennent plus d’adresse réseau. Le service informatique m’a dit que le serveur avait été remis à jour pendant le week-end et que « tout tournait ».'),
  cause: 'Après la restauration du serveur, SRV-DC1 n’est plus autorisé comme serveur DHCP dans Active Directory : le service est démarré mais il cesse de répondre aux clients (une erreur du journal DHCP-Server le dit).',
  solution: 'Dans la console DHCP, clic droit sur le serveur → Autoriser, puis renouveler le bail du poste.',
  hints: ['Le service DHCP est démarré et l’étendue est active, pourtant les postes sont en APIPA : cherchez ce qui empêche le serveur de répondre.', 'Consultez les journaux de SRV-DC1 dans l’Observateur d’événements (journaux des applications et des services, DHCP-Server) autour du démarrage du service.', 'Un serveur DHCP membre d’un domaine doit être autorisé dans Active Directory : regardez la flèche à côté du nom du serveur dans la console DHCP.'],
  inject: [{ do: 'set', path: 'SRV-DC1.win.dhcp.authorized', value: false }, { do: 'svc', dev: 'SRV-DC1', name: 'DHCPServer', state: 'stopped' }, { do: 'svc', dev: 'SRV-DC1', name: 'DHCPServer', state: 'running' }].concat(reDhcp('PC-01')),
  probes: dhcpProbes('PC-01'),
  roots: ['SRV-DC1/win/dhcp/authorized'],
  fix: [{ do: 'set', path: 'SRV-DC1.win.dhcp.authorized', value: true }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: ['Redémarrer le service DHCP ou recréer l’étendue ne change rien : le problème est l’autorisation du serveur, pas l’étendue.', 'Supprimer puis recréer l’étendue fait perdre les réservations et les options.'],
  optimal: ['Constater l’APIPA', 'Console DHCP : serveur avec flèche rouge', 'Journal DHCP-Server : l’événement d’erreur du service', 'Clic droit → Autoriser', 'ipconfig /renew'] });

add({ id: 'dhcp_pool', v1: 'dhcp_pool', level: 2, title: 'Étendue DHCP sans adresse disponible', skills: ['dhcp', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Mon poste n’obtient plus d’adresse', 'Bonjour, mon ordinateur n’arrive plus à se connecter au réseau depuis que j’ai rebranché mon poste ce matin. D’autres collègues y arrivent encore, je crois.'),
  cause: 'Une plage d’exclusion couvre toute l’étendue 10.10.20.50-200 : le serveur n’a plus aucune adresse à proposer.',
  solution: 'Réduire/supprimer l’exclusion pour rendre des adresses disponibles, puis renouveler le bail.',
  hints: ['L’adresse du poste est en 169.254.x.x : le serveur DHCP n’a rien proposé. Le service tourne pourtant.', 'Dans la console DHCP, regardez l’étendue 10.10.20.0 : « Pool d’adresses » et « Baux d’adresses ».', 'Une plage d’exclusion couvre toute la plage de distribution : modifiez-la.'],
  inject: [{ do: 'set', path: SCOPE + '.exclusions', value: [{ start: '10.10.20.50', end: '10.10.20.200' }] }].concat(reDhcp('PC-01')),
  probes: dhcpProbes('PC-01'),
  roots: [{ probe: { t: 'dhcpfree', dev: 'SRV-DC1', scope: '10.10.20.0' } }],
  fix: [{ do: 'set', path: SCOPE + '.exclusions', value: [{ start: '10.10.20.190', end: '10.10.20.199' }] }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: ['Créer une seconde étendue ne corrige pas l’exclusion.'],
  optimal: ['ipconfig : 169.254.x.x', 'Console DHCP : pool d’adresses', 'Corriger l’exclusion', 'ipconfig /renew'] });

add({ id: 'dhcp_scope_off', level: 2, title: 'Étendue DHCP désactivée', skills: ['dhcp', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Réseau coupé pour tout l’étage', 'Bonjour, depuis ce matin on n’a plus de réseau dans le bureau de la comptabilité. Le service informatique a peut-être touché quelque chose hier.'),
  cause: 'L’étendue 10.10.20.0 de SRV-DC1 est désactivée : le serveur DHCP ne distribue plus rien pour le VLAN 20.',
  solution: 'Activer l’étendue dans la console DHCP puis renouveler le bail.',
  hints: ['Le service DHCP est démarré mais les postes sont en APIPA : cherchez au niveau de l’étendue.', 'Dans la console DHCP, la flèche à côté de l’étendue indique son état.', 'Faites un clic droit sur l’étendue et choisissez Activer.'],
  inject: [{ do: 'set', path: SCOPE + '.active', value: false }].concat(reDhcp('PC-01')),
  probes: dhcpProbes('PC-01'),
  roots: [SCOPE_K + '/active'],
  fix: [{ do: 'set', path: SCOPE + '.active', value: true }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: [], optimal: ['Constater l’APIPA', 'Console DHCP', 'Activer l’étendue', 'ipconfig /renew'] });

add({ id: 'dhcp_relay_missing', level: 2, title: 'Relais DHCP (ip helper-address) absent', skills: ['dhcp-relay', 'roas', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Tout le service compta est sans réseau', 'Bonjour, tous les postes du service compta se retrouvent sans réseau depuis la maintenance de la nuit. Les serveurs ont l’air de fonctionner.'),
  cause: 'L’interface Vlan20 de SW-T1 n’a plus de commande ip helper-address : les requêtes DHCP des postes (diffusion) ne sont pas relayées vers SRV-DC1 qui est dans un autre VLAN.',
  solution: 'Rétablir ip helper-address 10.10.10.10 sur l’interface Vlan20 de SW-T1.',
  hints: ['Le serveur DHCP fonctionne et son étendue est active : le problème est entre le poste et le serveur.', 'Le serveur et les postes sont dans deux VLAN différents : une diffusion DHCP ne traverse pas un routeur toute seule.', 'Sur SW-T1, interface Vlan20 : ip helper-address 10.10.10.10.'],
  inject: [{ do: 'set', path: 'SW-T1.svi.Vlan20.helpers', value: [] }].concat(reDhcp('PC-01')),
  probes: dhcpProbes('PC-01'),
  roots: [{ path: 'SW-T1.svi.Vlan20.helpers', has: '10.10.10.10' }],
  fix: [{ do: 'set', path: 'SW-T1.svi.Vlan20.helpers', value: ['10.10.10.10'] }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: ['Créer une étendue sur un autre serveur du VLAN 20 serait un contournement lourd et incohérent avec l’architecture.'],
  optimal: ['APIPA sur le poste', 'Vérifier le serveur DHCP (OK)', 'show running-config sur SW-T1, interface Vlan20', 'ip helper-address 10.10.10.10', 'ipconfig /renew'] });

add({ id: 'dhcp_relay_wrong', level: 2, title: 'Relais DHCP pointant vers une mauvaise adresse', skills: ['dhcp-relay', 'roas', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Réseau en panne après la migration', 'Bonjour, depuis la migration du serveur de ce week-end les postes de la compta n’ont plus d’adresse. Le serveur répond pourtant.'),
  cause: 'ip helper-address de Vlan20 désigne 10.10.10.11, une adresse qui n’est plus celle du serveur DHCP (10.10.10.10).',
  solution: 'Remplacer l’adresse du relais par 10.10.10.10.',
  hints: ['Les postes sont en APIPA : la demande DHCP n’arrive pas au serveur.', 'Regardez la configuration de l’interface Vlan20 de SW-T1 : où le relais envoie-t-il les requêtes ?', 'L’adresse du helper est incorrecte : supprimez-la et configurez 10.10.10.10.'],
  inject: [{ do: 'set', path: 'SW-T1.svi.Vlan20.helpers', value: ['10.10.10.11'] }].concat(reDhcp('PC-01')),
  probes: dhcpProbes('PC-01'),
  roots: [{ path: 'SW-T1.svi.Vlan20.helpers', has: '10.10.10.10' }],
  fix: [{ do: 'set', path: 'SW-T1.svi.Vlan20.helpers', value: ['10.10.10.10'] }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: ['Ajouter un second helper sans retirer le mauvais fonctionne mais laisse une configuration incohérente.'],
  optimal: ['APIPA', 'show run | section Vlan20', 'Corriger le helper', 'ipconfig /renew'] });

add({ id: 'dhcp_gw_bad', v1: 'dhcp_gw_bad', level: 2, title: 'Passerelle distribuée par le DHCP erronée', skills: ['dhcp', 'subnetting', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', 'J’ai du réseau mais plus Internet ni les serveurs', 'Bonjour, mon poste dit qu’il est connecté mais je n’ouvre plus aucun dossier partagé ni de site. Je pense que ça vient de quand on a modifié des choses sur le serveur.'),
  cause: 'L’option 003 (routeur) de l’étendue 10.10.20.0 distribue 10.10.20.254 au lieu de 10.10.20.1 : les postes ont une mauvaise passerelle.',
  solution: 'Corriger l’option 003 de l’étendue (10.10.20.1) puis renouveler le bail des postes.',
  hints: ['Le poste a une adresse valide mais ne sort pas de son réseau : regardez la passerelle (ipconfig /all).', 'La passerelle du poste n’est pas celle du VLAN 20. Qui la lui a donnée ?', 'Console DHCP → Options d’étendue → 003 Routeur : 10.10.20.1, puis ipconfig /renew.'],
  inject: [{ do: 'set', path: SCOPE + '.options.3', value: '10.10.20.254' }].concat(reDhcp('{{c.host}}')),
  probes: [{ t: 'ping', from: '{{c.host}}', to: '10.10.20.1' }, { t: 'ping', from: '{{c.host}}', to: '10.10.10.10' }],
  roots: [{ path: SCOPE + '.options.3', eq: '10.10.20.1' }],
  fix: [{ do: 'set', path: SCOPE + '.options.3', value: '10.10.20.1' }, { do: 'renew', dev: '{{c.host}}' }],
  workarounds: { ip_statique: staticWA('{{c.host}}') },
  workaroundNote: 'La passerelle dépend du sous-réseau : elle se règle dans les options de l’étendue. Une option de serveur s’appliquerait à toutes les étendues (une étendue d’un autre réseau recevrait une passerelle fausse) et une adresse fixe sur le poste ne règle rien pour les autres postes.',
  traps: ['Corriger la passerelle dans la carte réseau du poste est écrasé au prochain renouvellement du bail.'],
  optimal: ['ipconfig /all : passerelle étrange', 'Console DHCP : options d’étendue', 'Corriger 003', 'ipconfig /renew'] });

add({ id: 'dhcp_gw_empty', v1: 'dhcp_gw_empty', level: 2, title: 'Option routeur (003) absente de l’étendue', skills: ['dhcp', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus d’accès aux serveurs depuis mon poste', 'Bonjour, mon poste a bien une adresse mais n’atteint plus les serveurs ni Internet, alors que mon voisin (qui n’a pas redémarré) y arrive encore.'),
  cause: 'L’option 003 Routeur a été supprimée de l’étendue : les nouveaux baux n’ont plus de passerelle.',
  solution: 'Recréer l’option 003 = 10.10.20.1 dans l’étendue puis renouveler le bail.',
  hints: ['Le poste qui n’a pas redémarré marche encore : seul le renouvellement du bail pose problème.', 'Comparez ipconfig /all de deux postes : que manque-t-il au poste en panne ?', 'L’option 003 n’existe plus dans l’étendue : recréez-la.'],
  inject: [{ do: 'del', path: SCOPE + '.options.3' }].concat(reDhcp('PC-01')),
  probes: [{ t: 'ping', from: 'PC-01', to: '10.10.10.10' }, { t: 'ping', from: 'PC-01', to: '8.8.8.8' }],
  roots: [{ path: SCOPE + '.options.3', eq: '10.10.20.1' }],
  fix: [{ do: 'set', path: SCOPE + '.options.3', value: '10.10.20.1' }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01'), option_serveur: [{ do: 'set', path: 'SRV-DC1.win.dhcp.serverOptions.3', value: '10.10.20.1' }, { do: 'renew', dev: 'PC-01' }] },
  workaroundNote: 'La passerelle dépend du sous-réseau : elle se règle dans les options de l’étendue. Une option de serveur s’appliquerait à toutes les étendues (une étendue d’un autre réseau recevrait une passerelle fausse) et une adresse fixe sur le poste ne règle rien pour les autres postes.',
  traps: [], optimal: ['ipconfig /all : pas de passerelle', 'Console DHCP : options d’étendue', 'Recréer 003', 'ipconfig /renew'] });

add({ id: 'dhcp_dns_opt', level: 2, title: 'Option DNS (006) distribuée erronée', skills: ['dhcp', 'dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Internet marche mais plus les dossiers du serveur', 'Bonjour, je peux ouvrir des sites sur Internet mais plus les dossiers du serveur ni l’intranet. Depuis ce matin, après un redémarrage.'),
  cause: 'L’option 006 de l’étendue distribue 8.8.8.8 au lieu du DNS interne SRV-DC1 : les noms du domaine ne sont plus résolus.',
  solution: 'Remettre l’option 006 = 10.10.10.10 dans l’étendue puis renouveler le bail.',
  hints: ['Internet fonctionne mais pas les noms internes : quel DNS le poste interroge-t-il ?', 'ipconfig /all : le serveur DNS n’est pas SRV-DC1.', 'Corrigez l’option 006 dans la console DHCP (pas dans la carte réseau du poste) puis renouvelez le bail.'],
  inject: [{ do: 'set', path: SCOPE + '.options.6', value: '8.8.8.8' }].concat(reDhcp('PC-01')),
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'resolve', from: 'PC-01', name: 'www.exemple.fr' }],
  roots: [{ path: SCOPE + '.options.6', eq: '10.10.10.10' }],
  fix: [{ do: 'set', path: SCOPE + '.options.6', value: '10.10.10.10' }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { dns_manuel: [{ do: 'set', path: 'PC-01.ifaces.Ethernet0.dnsManual', value: ['10.10.10.10'] }] },
  traps: ['Saisir le DNS dans la carte réseau règle un poste mais pas les autres, et se paie au prochain changement.'],
  optimal: ['ipconfig /all : DNS 8.8.8.8', 'Console DHCP : option 006', 'Corriger 006', 'ipconfig /renew'] });

add({ id: 'dhcp_conflict', v1: 'dhcp_conflict', level: 2, title: 'Conflit d’adresse IP avec l’imprimante', skills: ['dhcp', 'subnetting', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', '« Conflit d’adresse IP » sur mon poste', 'Bonjour, un message parle d’un conflit d’adresse IP sur mon poste et je n’ai plus de réseau. On a réinstallé l’imprimante du couloir hier soir.'),
  cause: 'L’imprimante IMP-T1 a été reconfigurée avec l’adresse fixe 10.10.20.50, qui appartient à la plage distribuée par le DHCP : le poste reçoit la même adresse et détecte le conflit.',
  solution: 'Remettre l’imprimante hors de la plage dynamique (10.10.20.250 ou réservation DHCP), puis renouveler le bail du poste.',
  hints: ['Windows signale un conflit : un autre équipement utilise déjà l’adresse proposée.', 'Cherchez qui répond à 10.10.20.50 (ping, arp -a, adresse MAC) : l’imprimante ?', 'Replacez l’imprimante en dehors de la plage DHCP (10.10.20.250), puis ipconfig /renew.'],
  inject: [{ do: 'release', dev: 'PC-01' }, { do: 'set', path: 'IMP-T1.ifaces.eth0.ip', value: '10.10.20.50' }, { do: 'renew', dev: 'PC-01' }],
  probes: dhcpProbes('PC-01'),
  roots: [{ path: 'IMP-T1.ifaces.eth0.ip', outside: ['10.10.20.50', '10.10.20.200'] }],
  fix: [{ do: 'set', path: 'IMP-T1.ifaces.eth0.ip', value: '10.10.20.250' }, { do: 'renew', dev: 'PC-01' }],
  workarounds: { ip_statique: staticWA('PC-01') },
  traps: ['Exclure l’adresse du DHCP sans déplacer l’imprimante laisse la plage et la configuration de l’imprimante incohérentes.'],
  optimal: ['Lire le message de conflit', 'arp -a / ping pour identifier le propriétaire de l’adresse', 'Rendre l’imprimante à son adresse hors plage', 'ipconfig /renew'] });

add({ id: 'dhcp_resa', v1: 'dhcp_resa', level: 2, title: 'Réservation DHCP avec une mauvaise adresse MAC', skills: ['dhcp', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'L’application RH ne se connecte plus à la base', 'Bonjour, l’application RH n’arrive plus à se connecter à sa base depuis que mon poste a été remplacé la semaine dernière (même nom, nouvelle carte réseau).'),
  cause: 'La réservation DHCP de PC-02 (10.10.20.60) référence l’ancienne adresse MAC : le poste reçoit une adresse du pool et le pare-feu de SRV-LNX, qui n’autorise MariaDB que depuis 10.10.20.60, refuse la connexion.',
  solution: 'Corriger l’adresse MAC de la réservation pour PC-02 puis renouveler le bail.',
  hints: ['Le poste a bien du réseau mais pas l’adresse habituelle : comparez-la avec celle attendue (10.10.20.60).', 'Console DHCP → Réservations : comparez l’adresse MAC avec celle du poste (ipconfig /all).', 'Mettez à jour la MAC de la réservation et renouvelez le bail.'],
  inject: [{ do: 'set', path: SCOPE + '.reservations[name=PC-02].mac', value: '00:15:5D:00:AA:01' }, { do: 'release', dev: 'PC-02' }, { do: 'renew', dev: 'PC-02' }],
  probes: [{ t: 'ip', host: 'PC-02', eq: '10.10.20.60' }, { t: 'connect', from: 'PC-02', to: '10.10.10.30', proto: 'tcp', port: 3306 }],
  roots: [{ path: SCOPE + '.reservations[name=PC-02].mac', eq: '@mac(PC-02)' }],
  fix: [{ do: 'set', path: SCOPE + '.reservations[name=PC-02].mac', value: '@mac(PC-02)' }, { do: 'renew', dev: 'PC-02' }],
  traps: ['Autoriser tout le VLAN 20 sur le port 3306 de SRV-LNX élargirait inutilement l’exposition de la base.'],
  optimal: ['ipconfig /all : adresse du pool', 'Console DHCP : réservations', 'Corriger la MAC', 'ipconfig /renew, test de l’application'] });

/* ======================= DNS ======================= */
const ZB = 'SRV-DC1.win.dns.zones[name=toulouse.local]';
const ZB_K = 'SRV-DC1/win/dns/zones[toulouse.local]';
add({ id: 'dns_rec_missing', v1: 'dns_rec_missing', level: 2, title: 'Enregistrement A du serveur de fichiers manquant', skills: ['dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', '\\\\srv-fic introuvable', 'Bonjour, quand je tape \\\\srv-fic dans l’explorateur j’ai « Le chemin d’accès réseau est introuvable ». Pourtant mon collègue y accède avec l’adresse IP.'),
  cause: 'L’enregistrement A de srv-fic a disparu de la zone toulouse.local : le nom n’est plus résolu.',
  solution: 'Recréer l’enregistrement A srv-fic → 10.10.10.20 dans la zone (et vider le cache DNS du client).',
  hints: ['Par IP ça marche, par nom non : c’est de la résolution de noms.', 'nslookup srv-fic : quelle réponse ? Quel serveur répond ?', 'Dans le gestionnaire DNS de SRV-DC1, la zone toulouse.local ne contient plus l’hôte srv-fic : recréez-le.'],
  inject: [{ do: 'del', path: ZB + '.records[name=srv-fic]' }],
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'connect', from: 'PC-01', to: 'srv-fic', proto: 'tcp', port: 445 }],
  roots: [ZB_K + '/records[srv-fic|A]'],
  fix: [{ do: 'push', path: ZB + '.records', item: { id: 'srv-fic|A', name: 'srv-fic', type: 'A', data: '10.10.10.20' } }, { do: 'flushdns', dev: 'PC-01' }],
  workarounds: { hosts: [{ do: 'push', path: 'PC-01.hostsFile', item: { ip: '10.10.10.20', name: 'srv-fic' } }] },
  traps: ['Le fichier hosts du poste contourne le problème pour un seul poste.'],
  optimal: ['ping par IP OK, par nom KO', 'nslookup srv-fic', 'Gestionnaire DNS : recréer l’enregistrement A', 'ipconfig /flushdns'] });

add({ id: 'dns_rec_wrong', v1: 'dns_rec_wrong', level: 2, title: 'Enregistrement A pointant vers une mauvaise adresse', skills: ['dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le partage « Compta » ne s’ouvre plus', 'Bonjour, mon lecteur réseau Compta affiche une erreur de délai d’attente alors qu’il marchait hier. Les autres collègues ont le même souci.'),
  cause: 'L’enregistrement A de srv-fic pointe vers 10.10.10.21 (ancienne adresse) au lieu de 10.10.10.20.',
  solution: 'Corriger l’enregistrement A (10.10.10.20) et vider le cache DNS des clients.',
  hints: ['Le nom se résout mais la connexion expire : vérifiez que l’adresse obtenue est la bonne.', 'nslookup srv-fic donne une adresse : est-ce l’adresse réelle du serveur (ipconfig sur srv-fic) ?', 'Modifiez l’enregistrement dans la zone DNS puis ipconfig /flushdns sur le client.'],
  inject: [{ do: 'set', path: ZB + '.records[name=srv-fic].data', value: '10.10.10.21' }],
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'connect', from: 'PC-01', to: 'srv-fic', proto: 'tcp', port: 445 }],
  roots: [ZB_K + '/records[srv-fic|A]'],
  fix: [{ do: 'set', path: ZB + '.records[name=srv-fic].data', value: '10.10.10.20' }, { do: 'flushdns', dev: 'PC-01' }],
  workarounds: { hosts: [{ do: 'push', path: 'PC-01.hostsFile', item: { ip: '10.10.10.20', name: 'srv-fic' } }] },
  traps: ['Attendre l’expiration du cache sans corriger l’enregistrement ne règle rien.'],
  optimal: ['nslookup srv-fic : 10.10.10.21', 'ipconfig sur srv-fic : 10.10.10.20', 'Corriger l’enregistrement A', 'ipconfig /flushdns'] });

add({ id: 'dns_hosts', level: 2, title: 'Fichier hosts du poste : entrée obsolète qui masque le DNS', skills: ['dns', 'diag'],
  vary: { c: CL },
  ticket: tk('{{c.user}} ({{c.svc}})', '\\\\srv-fic ne répond que sur mon poste… enfin plus du tout', 'Bonjour, depuis qu’un technicien est passé tester mon poste, \\\\srv-fic ne s’ouvre plus (message d’erreur réseau). Mes collègues du même service y accèdent sans problème. J’ai déjà vidé le cache de mon navigateur.'),
  cause: 'Le fichier hosts de {{c.host}} contient une ligne de test « 10.10.10.99 srv-fic » : le poste résout srv-fic vers une adresse qui n’existe pas, sans interroger le DNS (qui, lui, est correct).',
  solution: 'Supprimer la ligne obsolète du fichier hosts (C:\\Windows\\System32\\drivers\\etc\\hosts, éditeur lancé en administrateur), puis ipconfig /flushdns.',
  hints: ['Les collègues accèdent au serveur : le DNS est sain. Qu’est-ce qui diffère sur ce poste ?', 'Comparez nslookup srv-fic (interroge directement le serveur DNS) et ping srv-fic (suit la résolution propre au poste) : les adresses sont-elles les mêmes ?', 'Ouvrez le fichier C:\\Windows\\System32\\drivers\\etc\\hosts en administrateur, supprimez la ligne obsolète, enregistrez, puis ipconfig /flushdns.'],
  inject: [{ do: 'push', path: '{{c.host}}.hostsFile', item: { ip: '10.10.10.99', name: 'srv-fic' } }],
  probes: [{ t: 'resolve', from: '{{c.host}}', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'connect', from: '{{c.host}}', to: 'srv-fic', proto: 'tcp', port: 445 }],
  roots: [{ probe: { t: 'resolve', from: '{{c.host}}', name: 'srv-fic', expect: '10.10.10.20' } }],
  fix: [{ do: 'set', path: '{{c.host}}.hostsFile', value: [] }, { do: 'flushdns', dev: '{{c.host}}' }],
  traps: ['Corriger ou recréer l’enregistrement DNS ne change rien : l’entrée du fichier hosts passe avant le DNS pour ce poste.', 'ipconfig /flushdns seul ne suffit pas tant que la ligne reste dans le fichier.'],
  optimal: ['ping srv-fic : adresse inattendue', 'nslookup srv-fic : adresse correcte', 'Ouvrir le fichier hosts en administrateur', 'Supprimer la ligne obsolète', 'ipconfig /flushdns et retester'] });

add({ id: 'dns_svc', v1: 'dns_svc', level: 2, title: 'Service Serveur DNS arrêté', skills: ['dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus rien ne s’ouvre par son nom', 'Bonjour, ni l’intranet, ni les dossiers, ni même Internet ne s’ouvrent depuis ce matin. Parfois ça met très longtemps puis une erreur.'),
  cause: 'Le service « Serveur DNS » est arrêté sur SRV-DC1, seul DNS des postes.',
  solution: 'Démarrer le service Serveur DNS sur SRV-DC1 (et vider le cache client).',
  hints: ['Rien ne se résout, y compris Internet : le serveur DNS interne ne répond plus.', 'nslookup vers 10.10.10.10 : délai d’attente. Le service tourne-t-il sur SRV-DC1 ?', 'Démarrez « Serveur DNS » dans services.msc de SRV-DC1.'],
  inject: [{ do: 'svc', dev: 'SRV-DC1', name: 'DNS', state: 'stopped' }],
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'resolve', from: 'PC-01', name: 'www.exemple.fr' }],
  roots: ['SRV-DC1/win/svc/DNS'],
  fix: [{ do: 'svc', dev: 'SRV-DC1', name: 'DNS', state: 'running' }, { do: 'flushdns', dev: 'PC-01' }],
  traps: ['Pointer les postes sur 8.8.8.8 rétablit Internet mais casse tout le domaine.'],
  optimal: ['nslookup : délai d’attente', 'Ping de 10.10.10.10 : OK', 'services.msc sur SRV-DC1', 'Démarrer Serveur DNS'] });

add({ id: 'dns_fwd', v1: 'dns_fwd', level: 2, title: 'Redirecteur DNS erroné : pas d’Internet par nom', skills: ['dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Les sites Internet ne s’ouvrent plus', 'Bonjour, tout ce qui est interne fonctionne mais plus aucun site web ne s’ouvre. Dans le navigateur : « Impossible de trouver l’adresse du serveur ».'),
  cause: 'Le redirecteur DNS de SRV-DC1 pointe vers 10.10.10.250, qui n’existe pas : les noms externes ne sont plus résolus.',
  solution: 'Remplacer le redirecteur par 8.8.8.8 (ou le DNS de la box/pare-feu).',
  hints: ['Les noms internes passent, les noms externes non : qui relaie les requêtes externes ?', 'Propriétés du serveur DNS → onglet Redirecteurs.', 'Le redirecteur 10.10.10.250 ne répond pas : mettez 8.8.8.8.'],
  inject: [{ do: 'set', path: 'SRV-DC1.win.dns.forwarders', value: ['10.10.10.250'] }],
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'resolve', from: 'PC-01', name: 'www.exemple.fr', expect: '93.184.216.34' }],
  /* tout redirecteur qui répond convient (8.8.8.8, 1.1.1.1, le pare-feu…) : la cause est corrigée dès que le redirecteur mort a disparu et que les noms externes sont résolus (sondes) */
  roots: [{ path: 'SRV-DC1.win.dns.forwarders', hasNot: '10.10.10.250' }],
  fix: [{ do: 'set', path: 'SRV-DC1.win.dns.forwarders', value: ['8.8.8.8'] }, { do: 'flushdns', dev: 'PC-01' }],
  traps: ['Mettre 8.8.8.8 en DNS secondaire sur les postes contourne l’AD et le contrôle DNS.'],
  optimal: ['nslookup www.exemple.fr : échec', 'nslookup srv-fic : OK', 'Propriétés DNS → Redirecteurs', 'Corriger puis flushdns'] });

add({ id: 'dns_cache', v1: 'dns_cache', level: 1, title: 'Cache DNS du poste obsolète', skills: ['dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le serveur de fichiers « ne répond pas » seulement chez moi', 'Bonjour, je n’arrive pas à ouvrir \\\\srv-fic depuis mon poste alors que mes collègues y arrivent. Le serveur a changé d’adresse la semaine dernière, je crois.'),
  cause: 'Le cache DNS du poste contient encore l’ancienne adresse de srv-fic (10.10.10.200).',
  solution: 'Vider le cache DNS du poste : ipconfig /flushdns.',
  hints: ['Seul votre poste est touché : la panne est locale au poste.', 'ipconfig /displaydns montre-t-il une ancienne adresse pour srv-fic ?', 'Videz le cache DNS du poste avec ipconfig /flushdns, puis retestez.'],
  inject: [{ do: 'dnscache', dev: 'PC-01', name: 'srv-fic.toulouse.local', ip: '10.10.10.200' }],
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20', cache: true }],
  roots: [{ probe: { t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20', cache: true } }],
  fix: [{ do: 'flushdns', dev: 'PC-01' }],
  traps: ['Redémarrer le serveur ne change rien au cache du poste.'],
  optimal: ['nslookup depuis le poste et depuis un autre poste : réponses différentes', 'ipconfig /displaydns', 'ipconfig /flushdns'] });

add({ id: 'dns_ptr', level: 2, title: 'Résolution inverse (PTR) manquante', skills: ['dns', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'nslookup affiche « UnKnown » pour les serveurs', 'Salut, quand je fais un nslookup sur l’IP d’un serveur depuis PC-ADM j’obtiens « UnKnown » et un délai d’attente alors que la résolution directe marche. Ça fausse mes relevés.'),
  cause: 'L’enregistrement PTR de 10.10.10.20 n’existe pas dans la zone inversée 10.10.10.in-addr.arpa.',
  solution: 'Créer l’enregistrement pointeur (PTR) 20 → srv-fic.toulouse.local dans la zone inversée.',
  hints: ['La résolution directe fonctionne, pas l’inverse.', 'Dans le gestionnaire DNS, regardez les zones de recherche inversée.', 'Ajoutez l’enregistrement PTR 10.10.10.20 → srv-fic.toulouse.local dans la zone 10.10.10.in-addr.arpa.'],
  inject: [{ do: 'del', path: 'SRV-DC1.win.dns.zones[name=10.10.10.in-addr.arpa].records[name=20]' }],
  probes: [{ t: 'ptr', from: 'PC-ADM', ip: '10.10.10.20', expect: 'srv-fic.toulouse.local' }],
  roots: ['SRV-DC1/win/dns/zones[10.10.10.in-addr.arpa]/records[20|PTR]'],
  fix: [{ do: 'push', path: 'SRV-DC1.win.dns.zones[name=10.10.10.in-addr.arpa].records', item: { id: '20|PTR', name: '20', type: 'PTR', data: 'srv-fic.toulouse.local.' } }, { do: 'flushdns', dev: 'PC-ADM' }],
  traps: [], optimal: ['nslookup 10.10.10.20 : UnKnown', 'Gestionnaire DNS → zone inversée', 'Créer le PTR'] });

/* ======================= PARE-FEU WINDOWS ======================= */
add({ id: 'fw_icmp', v1: 'fw_icmp', level: 2, title: 'Règle ICMP (ping) désactivée sur le serveur de fichiers', skills: ['pare-feu-win', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'SRV-FIC ne répond plus au ping', 'Salut, la supervision remonte SRV-FIC en alarme (plus de réponse au ping) mais les utilisateurs accèdent encore aux dossiers. Tu peux regarder ?'),
  cause: 'La règle entrante « Partage de fichiers et d’imprimantes (Demande d’écho - Trafic entrant ICMPv4) » est désactivée sur SRV-FIC.',
  solution: 'Réactiver la règle ICMPv4 d’écho entrante dans le pare-feu Windows de SRV-FIC.',
  hints: ['Les dossiers fonctionnent : le serveur est vivant, seul ICMP est silencieux.', 'Pare-feu Windows Defender avec fonctions avancées de sécurité, règles de trafic entrant.', 'Activez la règle « Demande d’écho - Trafic entrant ICMPv4 » du groupe Partage de fichiers et d’imprimantes.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=icmp-echo].enabled', value: false }],
  probes: [{ t: 'ping', from: 'PC-ADM', to: '10.10.10.20' }, { t: 'connect', from: 'PC-ADM', to: '10.10.10.20', proto: 'tcp', port: 445 }],
  roots: ['SRV-FIC/win/fw/rules[icmp-echo]'],
  fix: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=icmp-echo].enabled', value: true }],
  workarounds: { desactiver_pare_feu: [{ do: 'set', path: 'SRV-FIC.win.fw.profiles.domain.enabled', value: false }] },
  traps: ['Désactiver complètement le pare-feu rétablit le ping mais expose le serveur : action dangereuse.'],
  optimal: ['Constater ping KO / SMB OK', 'wf.msc sur SRV-FIC', 'Activer la règle ICMPv4 d’écho entrante'] });

add({ id: 'fw_80', v1: 'fw_80', level: 2, title: 'Règle HTTP entrante désactivée sur le serveur web', skills: ['pare-feu-win', 'iis', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le portail interne ne s’ouvre plus', 'Bonjour, le site http://srv-fic ne s’ouvre plus (le navigateur tourne puis abandonne). Je ne sais pas si c’est mon poste, mais mes collègues ont le même problème.'),
  cause: 'La règle entrante « Service World Wide Web (trafic HTTP entrant) » est désactivée sur SRV-FIC : le port 80 est filtré alors qu’IIS écoute.',
  solution: 'Réactiver la règle HTTP entrante du pare-feu de SRV-FIC.',
  hints: ['Le serveur répond au ping : le site IIS est-il démarré ? Teste-t-on le bon port ?', 'Test-NetConnection srv-fic -Port 80 : délai d’attente ou refus ? Un délai évoque un filtrage.', 'Réactivez la règle HTTP entrante dans wf.msc de SRV-FIC.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=http].enabled', value: false }],
  probes: [{ t: 'connect', from: 'PC-01', to: 'srv-fic', proto: 'tcp', port: 80 }, { t: 'ping', from: 'PC-01', to: '10.10.10.20' }],
  roots: ['SRV-FIC/win/fw/rules[http]'],
  fix: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=http].enabled', value: true }],
  workarounds: { desactiver_pare_feu: [{ do: 'set', path: 'SRV-FIC.win.fw.profiles.domain.enabled', value: false }] },
  traps: ['Désactiver le pare-feu : « ça marche » mais c’est une faute de sécurité.'],
  optimal: ['Test-NetConnection port 80 : timeout', 'Vérifier IIS (démarré)', 'wf.msc : règle HTTP', 'Activer'] });

add({ id: 'fw_443', v1: 'fw_443', level: 2, title: 'Règle HTTPS entrante désactivée', skills: ['pare-feu-win', 'iis', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'https://srv-fic ne répond pas', 'Bonjour, j’ai un message d’erreur de connexion sur https://srv-fic alors que http://srv-fic marche. Mon collègue a testé aussi.'),
  cause: 'La règle HTTPS entrante (443) est désactivée sur SRV-FIC alors que le site IIS a une liaison https.',
  solution: 'Réactiver la règle « Service World Wide Web (trafic HTTPS entrant) ».',
  hints: ['HTTP marche, HTTPS non : comparez les deux ports.', 'Test-NetConnection srv-fic -Port 443.', 'Réactivez la règle HTTPS entrante dans le pare-feu de SRV-FIC.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=https].enabled', value: false }],
  probes: [{ t: 'connect', from: 'PC-01', to: 'srv-fic', proto: 'tcp', port: 443 }, { t: 'connect', from: 'PC-01', to: 'srv-fic', proto: 'tcp', port: 80 }],
  roots: ['SRV-FIC/win/fw/rules[https]'],
  fix: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=https].enabled', value: true }],
  traps: [], optimal: ['Tester 80 puis 443', 'wf.msc', 'Activer HTTPS'] });

add({ id: 'fw_53', v1: 'fw_53', level: 2, title: 'Règles DNS entrantes désactivées sur le contrôleur de domaine', skills: ['pare-feu-win', 'dns', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Les noms ne se résolvent plus, serveur DNS « vivant »', 'Bonjour, plus rien ne se résout par son nom depuis ce matin. L’informatique dit que le service DNS tourne bien.'),
  cause: 'Les règles entrantes « Serveur DNS (UDP/TCP) » sont désactivées sur SRV-DC1 : le service tourne mais le port 53 est filtré.',
  solution: 'Réactiver les deux règles entrantes DNS du pare-feu de SRV-DC1.',
  hints: ['Le service DNS est démarré, mais les requêtes expirent : qu’y a-t-il entre le poste et le service ?', 'Test-NetConnection 10.10.10.10 -Port 53 depuis un poste.', 'Réactivez les règles Serveur DNS (UDP et TCP, trafic entrant) sur SRV-DC1.'],
  inject: [{ do: 'set', path: 'SRV-DC1.win.fw.rules[id=dns-udp].enabled', value: false }, { do: 'set', path: 'SRV-DC1.win.fw.rules[id=dns-tcp].enabled', value: false }],
  probes: [{ t: 'resolve', from: 'PC-01', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'ping', from: 'PC-01', to: '10.10.10.10' }],
  roots: ['SRV-DC1/win/fw/rules[dns-udp]', 'SRV-DC1/win/fw/rules[dns-tcp]'],
  fix: [{ do: 'set', path: 'SRV-DC1.win.fw.rules[id=dns-udp].enabled', value: true }, { do: 'set', path: 'SRV-DC1.win.fw.rules[id=dns-tcp].enabled', value: true }, { do: 'flushdns', dev: 'PC-01' }],
  workarounds: { desactiver_pare_feu: [{ do: 'set', path: 'SRV-DC1.win.fw.profiles.domain.enabled', value: false }] },
  traps: ['Désactiver le pare-feu d’un contrôleur de domaine est une faute grave.'],
  optimal: ['Service DNS démarré mais pas de réponse', 'Test du port 53', 'wf.msc', 'Réactiver les deux règles'] });

add({ id: 'fw_profile', v1: 'fw_profile', level: 3, title: 'Réseau classé « Public » : règles de domaine inactives', skills: ['pare-feu-win', 'diag'],
  ticket: tk('Marc (technicien — équipe infra)', 'SRV-FIC inaccessible depuis ce matin sauf IIS', 'Salut, depuis le redémarrage de SRV-FIC plus personne n’accède aux partages et le ping ne passe plus. Mais le site web, lui, répond. Bizarre.'),
  cause: 'Au démarrage, NLA a classé le réseau de SRV-FIC en « Public » (contrôleur de domaine joint trop tard) : les règles limitées aux profils Domaine/Privé (SMB, ICMP) ne s’appliquent plus.',
  solution: 'Redémarrer le service Connaissance des emplacements réseau (NlaSvc) ou désactiver/réactiver la carte pour que le profil redevienne « Domaine ».',
  hints: ['Seul HTTP passe : cette règle s’applique à tous les profils, les autres non.', 'Quel profil réseau le pare-feu applique-t-il à la carte ? (Get-NetConnectionProfile)', 'Le réseau est en Public ; redémarrez le service de détection de réseau (NlaSvc) pour qu’il se reclasse en Domaine.'],
  inject: [{ do: 'set', path: 'SRV-FIC.ifaces.Ethernet0.fwProfile', value: 'public' }],
  probes: [{ t: 'ping', from: 'PC-ADM', to: '10.10.10.20' }, { t: 'connect', from: 'PC-ADM', to: '10.10.10.20', proto: 'tcp', port: 445 }],
  roots: ['SRV-FIC/ifaces/Ethernet0/fwProfile'],
  fix: [{ do: 'svc', dev: 'SRV-FIC', name: 'NlaSvc', state: 'stopped' }, { do: 'svc', dev: 'SRV-FIC', name: 'NlaSvc', state: 'running' }],
  workarounds: { desactiver_pare_feu: [{ do: 'set', path: 'SRV-FIC.win.fw.profiles.public.enabled', value: false }] },
  traps: ['Désactiver le pare-feu du profil Public ou ouvrir des règles pour tous les profils masque le défaut de classification.'],
  optimal: ['Constater ping/SMB KO et HTTP OK', 'Get-NetConnectionProfile : Public', 'Redémarrer NlaSvc', 'Vérifier le profil Domaine puis tester'] });

/* ======================= IIS (service) ======================= */
add({ id: 'iis_stopped', v1: 'iis_stopped', level: 1, title: 'Service IIS (W3SVC) arrêté', skills: ['iis', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le portail interne ne s’ouvre plus', 'Bonjour, http://srv-fic affiche « Impossible de se connecter » depuis ce matin. Les dossiers partagés sur le même serveur fonctionnent.'),
  cause: 'Le service de publication World Wide Web (W3SVC) est arrêté sur SRV-FIC.',
  solution: 'Démarrer le service W3SVC (ou le site depuis le Gestionnaire IIS).',
  hints: ['Les partages marchent : le serveur est joignable, seul le web ne répond pas.', 'Test-NetConnection srv-fic -Port 80 : la connexion est refusée → rien n’écoute.', 'Démarrez le service de publication World Wide Web sur SRV-FIC.'],
  inject: [{ do: 'svc', dev: 'SRV-FIC', name: 'W3SVC', state: 'stopped' }],
  probes: [{ t: 'connect', from: 'PC-01', to: 'srv-fic', proto: 'tcp', port: 80 }],
  roots: ['SRV-FIC/win/svc/W3SVC'],
  fix: [{ do: 'svc', dev: 'SRV-FIC', name: 'W3SVC', state: 'running' }],
  traps: ['Redémarrer le serveur entier est disproportionné.'],
  optimal: ['Tester le port 80 : refusé', 'services.msc ou Gestionnaire IIS', 'Démarrer le service'] });

add({ id: 'iis_binding', v1: 'iis_binding', level: 2, title: 'Liaison du site IIS sur un mauvais port', skills: ['iis', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le portail interne affiche une page d’erreur au lieu de la page d’accueil', 'Bonjour, http://srv-fic ne s’ouvre plus : le navigateur affiche une page d’erreur au lieu de la page d’accueil. Le pare-feu est bon d’après l’infra et le service tourne.'),
  cause: 'La liaison HTTP du site « Default Web Site » a été changée de 80 à 8081 : plus aucun site ne répond sur le port 80 pour le nom srv-fic (le port 80 reste ouvert, car le site « Gestion » y est lié pour son propre nom d’hôte : IIS répond « nom d’hôte non valide »).',
  solution: 'Rétablir la liaison http sur le port 80 dans le Gestionnaire IIS.',
  hints: ['Le service tourne, le pare-feu est ouvert, le port 80 répond : mais quel site répond pour le nom srv-fic ?', 'Gestionnaire IIS → chaque site → Liaisons : sur quel port et pour quel nom d’hôte chacun est-il lié ?', 'Le site « Default Web Site » est lié au port 8081 : remettez 80.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].port', value: 8081 }],
  probes: [{ t: 'http', from: 'PC-01', url: 'http://srv-fic.toulouse.local/' }],
  roots: ['SRV-FIC/win/iis/sites[1]/bindings'],
  fix: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].port', value: 80 }],
  traps: ['Ouvrir le port 8081 au pare-feu ne résout pas le problème pour les utilisateurs qui visent le 80.'],
  optimal: ['Ouvrir http://srv-fic : page d’erreur (le port 80 répond)', 'Gestionnaire IIS : liaisons de chaque site', 'Corriger la liaison du site par défaut (80)', 'Rouvrir l’URL'] });

add({ id: 'web_site_stopped', level: 2, title: 'IIS : site web arrêté alors que le service W3SVC tourne', skills: ['iis', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'L’intranet ne répond plus alors que le serveur tourne', 'Bonjour, http://srv-fic.toulouse.local affiche une page d’erreur depuis ce matin. Je peux ouvrir mes dossiers partagés sur le même serveur. L’informatique m’a dit que le service web est bien démarré.'),
  cause: 'Le site « Default Web Site » est à l’état arrêté dans IIS (arrêt manuel lors d’une maintenance) : le service W3SVC tourne mais ce site ne répond plus (le port 80 reste ouvert, car le site « Gestion » y est lié pour son propre nom d’hôte : IIS répond « nom d’hôte non valide » pour le nom srv-fic).',
  solution: 'Démarrer le site « Default Web Site » dans le Gestionnaire IIS (volet Actions → Démarrer).',
  hints: ['Le serveur est joignable et le service web tourne : ouvrez l’URL et lisez la page d’erreur (Test-NetConnection srv-fic -Port 80 répond).', 'Le service W3SVC n’est pas en cause : ouvrez le Gestionnaire IIS et regardez l’état de chaque site.', 'Sélectionnez « Default Web Site » et cliquez sur Démarrer dans le volet Actions.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].state', value: 'stopped' }],
  probes: [{ t: 'http', from: 'PC-02', url: 'http://srv-fic.toulouse.local/' }],
  roots: [{ path: 'SRV-FIC.win.iis.sites[id=1].state', eq: 'started' }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].state', value: 'started' }],
  traps: ['Redémarrer le service W3SVC ne démarre pas un site arrêté manuellement.', 'Ouvrir le port 80 au pare-feu est inutile : la règle est déjà active.'],
  optimal: ['Ouvrir l’URL : page d’erreur (le port 80 répond)', 'Vérifier W3SVC (démarré)', 'Gestionnaire IIS : site arrêté', 'Démarrer le site', 'Retester l’URL'] });

add({ id: 'web_hostheader', level: 2, title: 'IIS : nom d’hôte de la liaison ne correspondant pas à l’URL utilisée (400)', skills: ['iis', 'dns', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'L’intranet affiche une erreur 400', 'Bonjour, quand j’ouvre http://srv-fic.toulouse.local j’obtiens une page d’erreur 400 au lieu du site. Le nom du serveur est bien reconnu et il répond. Le webmaster a modifié les liaisons du site hier.'),
  cause: 'La liaison http du site « Default Web Site » a reçu le nom d’hôte « intranet.toulouse.local » : une requête adressée à srv-fic.toulouse.local ne correspond à aucune liaison, IIS répond HTTP 400 (Invalid Hostname).',
  solution: 'Vider le nom d’hôte de la liaison http du site (ou y mettre srv-fic.toulouse.local) dans le Gestionnaire IIS → Liaisons.',
  hints: ['Le serveur répond (code 400, pas de délai) : la résolution de noms et le pare-feu sont bons, c’est la requête HTTP qui n’est pas acceptée.', 'Gestionnaire IIS → Default Web Site → Liaisons : comparez le nom d’hôte de la liaison avec l’URL que tapent les utilisateurs.', 'Modifiez la liaison http : videz le nom d’hôte (ou saisissez srv-fic.toulouse.local) puis retestez.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].host', value: 'intranet.toulouse.local' }],
  probes: [{ t: 'http', from: 'PC-02', url: 'http://srv-fic.toulouse.local/' }],
  roots: [{ any: [{ path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].host', eq: '' }, { path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].host', eq: 'srv-fic.toulouse.local' }] }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].host', value: '' }],
  fixes: { fqdn: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].bindings[0].host', value: 'srv-fic.toulouse.local' }] },
  traps: ['Créer un enregistrement DNS « intranet » ne règle rien : les utilisateurs continuent à viser srv-fic.', 'Redémarrer IIS ou ouvrir un port est sans effet : le serveur répond déjà.'],
  optimal: ['Reproduire l’erreur 400 dans le navigateur', 'IIS → site → Liaisons', 'Comparer le nom d’hôte à l’URL', 'Corriger la liaison', 'Retester l’URL'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
