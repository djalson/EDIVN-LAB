/* ============================================================================
   Pannes — lot V3 : pannes simples sur les sites distants (Bordeaux, Ramonville).
   Avant ce lot, les chapitres « Bordeaux » et « Ramonville » de la campagne n'avaient que des pannes de niveau 3 ou 4 :
   on y arrivait sans marche d'entrée. Ces pannes reprennent des mécanismes déjà prouvés à Toulouse (mêmes étapes de
   correction, donc mêmes consoles) sur les machines de ces sites, avec leur adressage propre.
   Données pures : la configuration est la vérité, les symptômes découlent des analyseurs du moteur.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site });
const ELENA = 'Elena Garcia (Bordeaux)', LABO = 'Le référent du labo (Ramonville)';

/* ------------------------------------------------------------------ Bordeaux */
add({ id: 'phys_eth_bdx', level: 1, title: 'Câble réseau débranché sur le poste de Bordeaux', skills: ['phys', 'diag'],
  ticket: tk(ELENA, 'Plus rien ne marche à l’agence', 'Bonjour, depuis le passage du ménage ce matin mon ordinateur n’a plus ni Internet ni les dossiers. Il y a une petite croix en bas à droite de l’écran. Je suis seule à l’agence aujourd’hui.', 'bordeaux'),
  cause: 'Le câble réseau de PC-B1 est débranché à l’arrière du poste : plus aucune liaison avec le commutateur SW-B1.',
  solution: 'Rebrancher le câble réseau à l’arrière de PC-B1 et contrôler le voyant de liaison.',
  hints: ['Une croix sur l’icône réseau : regardez l’état de la carte dans les connexions réseau du poste.', '« Câble réseau non connecté » est un problème de couche 1 : inutile de chercher du côté du tunnel ou du serveur.', 'Allez voir l’arrière de PC-B1 et rebranchez le câble RJ45.'],
  inject: [{ do: 'unplug', port: 'PC-B1:Ethernet0' }],
  probes: [{ t: 'link', dev: 'PC-B1', port: 'Ethernet0' }, { t: 'ping', from: 'PC-B1', to: '10.20.10.10' }],
  roots: ['PC-B1/ifaces/Ethernet0/cable'],
  fix: [{ do: 'replug', port: 'PC-B1:Ethernet0' }],
  traps: ['Soupçonner le tunnel IPsec ou le pare-feu de l’agence alors que le poste n’a même pas de liaison : toujours commencer par la couche 1.'],
  optimal: ['Constater « câble non connecté » sur PC-B1', 'Aller à l’arrière du poste', 'Rebrancher le câble', 'Tester un ping vers le serveur de l’agence'] });

add({ id: 'nic_disabled_bdx', level: 1, title: 'Carte réseau désactivée sur le poste de Bordeaux', skills: ['phys', 'subnetting', 'diag'],
  ticket: tk(ELENA, 'Plus de réseau, pourtant tout est branché', 'Bonjour, je n’ai plus de réseau du tout sur mon poste. Le câble est bien enfoncé des deux côtés, j’ai vérifié. Hier un prestataire est passé « optimiser » mon ordinateur.', 'bordeaux'),
  cause: 'La carte réseau Ethernet0 de PC-B1 a été désactivée dans « Connexions réseau » : le câble et le port de SW-B1 sont bons, mais Windows n’utilise plus la carte.',
  solution: 'Réactiver la carte de PC-B1 (ncpa.cpl → clic droit sur Ethernet0 → Activer), puis vérifier l’adresse obtenue et le ping vers SRV-DC2.',
  hints: ['Le câble est branché : regardez l’état de la carte dans Connexions réseau avant d’aller plus loin.', 'Une carte « Désactivé » n’est pas une carte « Câble réseau non connecté » : la cause est dans Windows.', 'Clic droit sur Ethernet0 → Activer (droits d’administrateur), puis ipconfig et un ping vers le serveur.'],
  inject: [{ do: 'set', path: 'PC-B1.ifaces.Ethernet0.adminDown', value: true }],
  probes: [{ t: 'link', dev: 'PC-B1', port: 'Ethernet0' }, { t: 'ping', from: 'PC-B1', to: '10.20.10.10' }],
  roots: [{ path: 'PC-B1.ifaces.Ethernet0.adminDown', ne: true }],
  fix: [{ do: 'set', path: 'PC-B1.ifaces.Ethernet0.adminDown', value: false }],
  traps: ['Rebrancher ou changer le câble ne change rien : la liaison physique est déjà bonne.'],
  optimal: ['Constater l’absence de réseau malgré le câble branché', 'ncpa.cpl : carte « Désactivé »', 'Activer la carte', 'Vérifier l’adresse (ipconfig)', 'Tester un ping vers le serveur de l’agence'] });

add({ id: 'dhcp_svc_bdx', level: 1, title: 'Service Serveur DHCP arrêté à Bordeaux', skills: ['dhcp', 'diag'],
  ticket: tk(ELENA, '« Réseau non identifié » ce matin', 'Bonjour, mon poste affiche « Réseau non identifié » depuis ce matin et je n’accède plus à rien. Hier soir tout allait bien. Le serveur de l’agence a été mis à jour cette nuit, paraît-il.', 'bordeaux'),
  cause: 'Le service « Serveur DHCP » est arrêté sur SRV-DC2 : PC-B1 ne peut plus obtenir de bail et passe en adressage automatique (169.254.x.x).',
  solution: 'Démarrer le service Serveur DHCP sur SRV-DC2 (services.msc ou console DHCP), puis renouveler le bail de PC-B1.',
  hints: ['ipconfig sur le poste : l’adresse commence par 169.254. Qui distribue les adresses à Bordeaux ?', 'À Bordeaux, le serveur DHCP est SRV-DC2 : regardez ses services.', 'Le service « Serveur DHCP » est arrêté : démarrez-le, puis ipconfig /renew sur PC-B1.'],
  inject: [{ do: 'svc', dev: 'SRV-DC2', name: 'DHCPServer', state: 'stopped' }, { do: 'release', dev: 'PC-B1' }, { do: 'renew', dev: 'PC-B1' }],
  probes: [{ t: 'ip', host: 'PC-B1', net: '10.20.20.0/24' }, { t: 'ping', from: 'PC-B1', to: '10.20.10.10' }],
  roots: ['SRV-DC2/win/svc/DHCPServer'],
  fix: [{ do: 'svc', dev: 'SRV-DC2', name: 'DHCPServer', state: 'running' }, { do: 'renew', dev: 'PC-B1' }],
  workarounds: { ip_statique: [{ do: 'set', path: 'PC-B1.ifaces.Ethernet0.dhcp', value: false }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.ip', value: '10.20.20.77' }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.mask', value: '255.255.255.0' }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.gw', value: '10.20.20.1' }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.dns', value: ['10.20.10.10'] }] },
  traps: ['Une adresse fixe sur PC-B1 dépanne une personne, pas l’agence : le prochain poste aura le même problème.'],
  optimal: ['ipconfig sur PC-B1 : 169.254.x.x', 'Aller sur SRV-DC2 : services.msc ou console DHCP', 'Démarrer « Serveur DHCP »', 'ipconfig /renew sur PC-B1'] });

add({ id: 'dns_svc_bdx', level: 2, title: 'Service Serveur DNS arrêté à Bordeaux', skills: ['dns', 'diag'],
  ticket: tk(ELENA, 'Les sites et les dossiers ne s’ouvrent plus par leur nom', 'Bonjour, plus rien ne s’ouvre depuis ce matin : ni Internet, ni les dossiers de l’agence. Le réseau a l’air connecté pourtant, l’icône est normale.', 'bordeaux'),
  cause: 'Le service « Serveur DNS » est arrêté sur SRV-DC2, seul serveur DNS des postes de Bordeaux : plus aucun nom n’est résolu, alors que le réseau fonctionne.',
  solution: 'Démarrer le service Serveur DNS sur SRV-DC2, puis vider le cache DNS de PC-B1.',
  hints: ['Le réseau est connecté mais aucun nom ne répond : testez une adresse IP, puis un nom.', 'nslookup interroge 10.20.10.10 et n’obtient pas de réponse : le service tourne-t-il sur SRV-DC2 ?', 'Démarrez « Serveur DNS » dans services.msc de SRV-DC2.'],
  inject: [{ do: 'svc', dev: 'SRV-DC2', name: 'DNS', state: 'stopped' }],
  probes: [{ t: 'resolve', from: 'PC-B1', name: 'srv-dc2', expect: '10.20.10.10' }, { t: 'resolve', from: 'PC-B1', name: 'www.exemple.fr' }],
  roots: ['SRV-DC2/win/svc/DNS'],
  fix: [{ do: 'svc', dev: 'SRV-DC2', name: 'DNS', state: 'running' }, { do: 'flushdns', dev: 'PC-B1' }],
  traps: ['Pointer PC-B1 sur un DNS public rétablit Internet mais casse l’ouverture de session et tout le domaine bordeaux.local.'],
  optimal: ['Ping d’une adresse IP : OK ; d’un nom : échec', 'nslookup : délai d’attente sur 10.20.10.10', 'services.msc sur SRV-DC2', 'Démarrer Serveur DNS'] });

add({ id: 'ad_locked_bdx', level: 1, title: 'Compte utilisateur verrouillé à Bordeaux', skills: ['ad-compte', 'diag'],
  ticket: tk(ELENA, 'Mon compte est bloqué', 'Bonjour, de retour de congés j’ai essayé mon ancien mot de passe plusieurs fois avant de me rappeler le nouveau. Maintenant l’ordinateur dit que mon compte est verrouillé, même avec le bon.', 'bordeaux'),
  cause: 'Les saisies erronées ont atteint le seuil de verrouillage : le compte e.garcia est verrouillé dans l’annuaire bordeaux.local (le mot de passe, lui, est correct).',
  solution: 'Sur SRV-DC2, dans « Utilisateurs et ordinateurs Active Directory », ouvrir le compte e.garcia → onglet Compte → cocher « Débloquer le compte ».',
  hints: ['Le message parle d’un compte « verrouillé », pas d’un mot de passe incorrect : le problème est dans l’annuaire.', 'Bordeaux a son propre domaine : le compte se gère sur SRV-DC2, pas sur le contrôleur de Toulouse.', 'Onglet Compte du compte e.garcia : cochez « Débloquer le compte », puis faites retester.'],
  inject: [{ do: 'ad.lock', domain: 'bordeaux.local', sam: 'e.garcia' }],
  probes: [{ t: 'login', host: 'PC-B1', user: 'e.garcia' }],
  roots: [{ path: 'SRV-DC2.win.ad.users[sam=e.garcia].locked', ne: true }],
  fix: [{ do: 'ad.unlock', domain: 'bordeaux.local', sam: 'e.garcia' }],
  traps: ['Chercher le compte sur SRV-DC1 : Toulouse et Bordeaux sont deux domaines distincts.', 'Réinitialiser le mot de passe ne déverrouille pas le compte : la case « Débloquer » est distincte.'],
  optimal: ['Lire le message exact affiché sur PC-B1', 'Ouvrir Utilisateurs et ordinateurs Active Directory sur SRV-DC2', 'Compte e.garcia → onglet Compte', 'Débloquer le compte', 'Faire retester l’ouverture de session'] });

/* ------------------------------------------------------------------ Ramonville */
add({ id: 'phys_eth_rv', level: 1, title: 'Câble réseau débranché sur un poste du labo', skills: ['phys', 'diag'],
  ticket: tk(LABO, 'PC-RV1 n’a plus de réseau', 'Bonjour, après le démontage d’une maquette hier soir, PC-RV1 n’a plus de réseau du tout. Les autres postes du labo fonctionnent.', 'ramonville'),
  cause: 'Le câble réseau de PC-RV1 est débranché à l’arrière du poste : plus aucune liaison avec le commutateur SW-RVA.',
  solution: 'Rebrancher le câble réseau à l’arrière de PC-RV1 et contrôler le voyant de liaison.',
  hints: ['Un seul poste touché, juste après une manipulation de matériel : commencez par le poste lui-même.', 'L’état de la carte dans les connexions réseau dit si une liaison existe.', 'Regardez l’arrière de PC-RV1 : le câble RJ45 n’est plus branché.'],
  inject: [{ do: 'unplug', port: 'PC-RV1:Ethernet0' }],
  probes: [{ t: 'link', dev: 'PC-RV1', port: 'Ethernet0' }, { t: 'ping', from: 'PC-RV1', to: '172.16.1.1' }],
  roots: ['PC-RV1/ifaces/Ethernet0/cable'],
  fix: [{ do: 'replug', port: 'PC-RV1:Ethernet0' }],
  traps: ['Reconfigurer le routeur ou le commutateur alors qu’un seul poste est touché : le défaut est local.'],
  optimal: ['Constater « câble non connecté » sur PC-RV1', 'Aller à l’arrière du poste', 'Rebrancher le câble', 'Tester un ping vers la passerelle'] });

add({ id: 'ipv4_gw_rv', level: 1, title: 'Passerelle par défaut erronée sur un poste du labo', skills: ['subnetting', 'diag'],
  ticket: tk(LABO, 'PC-RV1 ne sort plus de son réseau', 'Bonjour, PC-RV1 joint bien le routeur du labo mais plus le serveur ni Internet. Quelqu’un a refait son adressage à la main pendant un TP.', 'ramonville'),
  cause: 'La passerelle saisie sur PC-RV1 (172.16.1.254) n’existe pas : la passerelle du réseau 172.16.1.0/24 est l’interface du routeur R-RV1, 172.16.1.1.',
  solution: 'Corriger la passerelle par défaut de PC-RV1 : 172.16.1.1.',
  hints: ['Le réseau local répond, tout ce qui passe par un routeur ne répond pas : regardez la passerelle.', 'Pingez la passerelle affichée par ipconfig : répond-elle ?', 'La passerelle du réseau 172.16.1.0/24 est 172.16.1.1 (R-RV1).'],
  inject: [{ do: 'set', path: 'PC-RV1.ifaces.Ethernet0.gw', value: '172.16.1.254' }],
  probes: [{ t: 'ping', from: 'PC-RV1', to: '172.16.3.10' }],
  roots: [{ path: 'PC-RV1.ifaces.Ethernet0.gw', eq: '172.16.1.1' }],
  fix: [{ do: 'set', path: 'PC-RV1.ifaces.Ethernet0.gw', value: '172.16.1.1' }],
  traps: ['Toucher aux routes ou au NAT de R-RV1 alors que les autres postes sortent normalement : le défaut est sur le poste.'],
  optimal: ['ipconfig /all sur PC-RV1', 'Ping de la passerelle affichée : pas de réponse', 'Corriger la passerelle', 'Tester le serveur du labo'] });

add({ id: 'ipv4_dns_rv', level: 1, title: 'Serveur DNS erroné sur un poste du labo', skills: ['subnetting', 'dns', 'diag'],
  ticket: tk(LABO, 'PC-RV1 : le site du labo ne s’ouvre plus par son nom', 'Bonjour, sur PC-RV1 le site www.ramonville.lan ne s’ouvre plus, alors qu’il s’ouvre en tapant directement l’adresse du serveur. Les autres postes n’ont pas le problème.', 'ramonville'),
  cause: 'Le serveur DNS saisi sur PC-RV1 (172.16.3.99) n’existe pas : le DNS du labo est SRV-RV, 172.16.3.10.',
  solution: 'Corriger le serveur DNS de PC-RV1 (172.16.3.10), puis vider le cache DNS du poste.',
  hints: ['Par adresse IP ça marche, par nom non : ce n’est pas le réseau, c’est la résolution de noms.', 'nslookup montre quel serveur DNS le poste interroge : répond-il ?', 'Le DNS du labo est SRV-RV (172.16.3.10) : corrigez la carte de PC-RV1.'],
  inject: [{ do: 'set', path: 'PC-RV1.ifaces.Ethernet0.dns', value: ['172.16.3.99'] }],
  probes: [{ t: 'resolve', from: 'PC-RV1', name: 'www.ramonville.lan', expect: '172.16.3.10' }],
  roots: [{ path: 'PC-RV1.ifaces.Ethernet0.dns', has: '172.16.3.10' }],
  fix: [{ do: 'set', path: 'PC-RV1.ifaces.Ethernet0.dns', value: ['172.16.3.10'] }, { do: 'flushdns', dev: 'PC-RV1' }],
  workarounds: { hosts: [{ do: 'push', path: 'PC-RV1.hostsFile', item: { ip: '172.16.3.10', name: 'www.ramonville.lan' } }] },
  traps: ['Ajouter une ligne au fichier hosts fait marcher ce nom-là et laisse le poste sans DNS pour tout le reste.'],
  optimal: ['Ping par adresse : OK ; par nom : échec', 'nslookup : le serveur interrogé ne répond pas', 'Corriger le DNS de la carte', 'ipconfig /flushdns puis retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
