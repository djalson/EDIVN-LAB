/* ============================================================================
   Pannes — lot F : proxy web Squid + squidGuard sur pfSense (compétence « proxy »).
   Données pures. Poste de référence : PC-02 (service RH, VLAN 20), configuré en proxy explicite
   10.10.0.1:3128 (Options Internet). Les symptômes viennent du moteur (SIM.squid, WEB.fetch) :
   rien n'est écrit en dur ici.
   Sites utilisés : Wikipédia (jamais bloqué), neverssl.com (HTTP), Facebook / YouTube (liste noire de Squid),
   Instagram / site pour adultes (catégories squidGuard), www.google.com (SafeSearch).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
SIM.AVREG['pannes-proxy'] = 'Pannes du lot proxy : le comportement exact de Squid face à une expression régulière invalide dans la Blacklist (ici : Squid ne démarre pas), face à un cache local jamais enregistré (ne démarre pas), d’un squidGuard sans base chargée (service arrêté, filtrage inactif) et la redirection transparente (le paquet réel impose en plus « loopback » dans les interfaces du proxy, non modélisé) sont des choix de modélisation à confirmer par capture sur une vraie installation.';
const PF = 'pfsense-tls', PC = 'PC-02';
const SQ = PF + '.squid', SG = PF + '.squidguard';
const DEF_LIST = ['facebook.com', 'youtube.com'];
const SG_URL = 'http://dsi.ut-capitole.fr/blacklists/download/blacklists_for_pfsense.tar.gz';
const CLIENT_EXC = ['10.10.*', '*.toulouse.local'];
const HO_GOOD = [{ host: 'www', domain: 'google.com', ip: '216.239.38.120', descr: 'SafeSearch forcé', aliases: [{ host: 'www', domain: 'google.fr', descr: '' }] }];
const RH = 'Bruno Durand (les RH)';

/* sondes réutilisées (toutes depuis le poste RH) */
const WIKI = { t: 'http', from: PC, url: 'https://www.wikipedia.org/', label: 'Wikipédia (HTTPS) s’ouvre sur le poste RH' };
const NEVER = { t: 'http', from: PC, url: 'http://neverssl.com/', label: 'Un site en HTTP s’ouvre sur le poste RH' };
const NO_FB = { t: 'http', from: PC, url: 'https://www.facebook.com/', not: true, label: 'Facebook reste bloqué' };
const NO_YT = { t: 'http', from: PC, url: 'https://www.youtube.com/', not: true, label: 'YouTube reste bloqué' };
const NO_IG = { t: 'http', from: PC, url: 'https://www.instagram.com/', not: true, label: 'Instagram (catégorie réseaux sociaux) reste bloqué' };
const NO_ADULT = { t: 'http', from: PC, url: 'https://site-adulte.example/', not: true, label: 'Le site pour adultes reste bloqué' };
const NO_FB_HTTP = { t: 'http', from: PC, url: 'http://www.facebook.com/', not: true, label: 'Facebook en HTTP reste bloqué' };
/* contournement commun : le poste n'utilise plus le proxy (le filtrage est alors perdu) */
const CLIENT_PROXY_OFF = [{ do: 'set', path: PC + '.proxy.enabled', value: false }];
const CLIENT_PROXY_ON = [{ do: 'set', path: PC + '.proxy.enabled', value: true }];
/* mise en place du mode transparent (poste sans proxy déclaré, interception HTTP et HTTPS en « splice ») */
const TRANS_SETUP = [
  { do: 'set', path: PC + '.proxy.enabled', value: false },
  { do: 'push', path: PF + '.openvpn.cas', item: { name: 'CA-Proxy-Squid', expires: '2036-10-27' } },
  { do: 'set', path: SQ + '.transparent', value: true }, { do: 'set', path: SQ + '.transIfaces', value: ['lan'] },
  { do: 'set', path: SQ + '.ssl', value: { on: true, mode: 'splice', ifaces: ['lan'], port: 3129, ca: 'CA-Proxy-Squid' } }
];
const LAN_PASS = { id: 'l1', act: 'pass', proto: 'any', src: { t: 'any' }, dst: { t: 'any' }, descr: 'Autoriser LAN vers tout' };
const QUIC_REJECT = { id: 'l0', act: 'reject', proto: 'udp', src: { t: 'any' }, dst: { t: 'any' }, dport: '443', descr: 'Bloquer QUIC (UDP 443) pour forcer le TCP' };
const QUIC_FB = { probe: { t: 'squid', quicBlocked: { from: PC, ip: '198.51.100.63' } } };

/* ======================= SERVICE ET PAQUET ======================= */
add({ id: 'px_down', level: 1, title: 'Proxy Squid arrêté ou désactivé', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'stop', label: 'le service Squid a été arrêté (Status → Services)', stopped: true, enabled: true },
    { key: 'off', label: 'la case « Enable Squid Proxy » a été décochée (Services → Squid Proxy Server → General)', stopped: false, enabled: false }
  ] },
  ticket: tk(RH, 'Plus aucun site ne s’ouvre sur mon poste', 'Bonjour, depuis ce matin mon navigateur affiche une page d’erreur à chaque site, même Wikipédia. Mes dossiers partagés fonctionnent normalement. Le poste de ma collègue, lui, accède à Internet (il n’est pas configuré comme le mien).'),
  cause: 'Sur pfSense, {{m.label}} : plus rien n’écoute sur 10.10.0.1:3128 et le navigateur (configuré avec ce proxy) affiche ERR_PROXY_CONNECTION_FAILED.',
  solution: 'Redémarrer / réactiver Squid sur pfSense (Status → Services ou case Enable dans Squid General) et retester la navigation.',
  hints: ['Le navigateur affiche ERR_PROXY_CONNECTION_FAILED : il n’arrive pas à joindre le proxy configuré dans Options Internet. Les accès intranet fonctionnent, donc le réseau n’est pas en cause.', 'Testez le port du proxy depuis le poste (Test-NetConnection 10.10.0.1 -Port 3128), puis regardez l’état du service dans l’interface web de pfSense (Status → Services).', 'Redémarrez Squid depuis Status → Services, ou cochez « Enable Squid Proxy » dans Services → Squid Proxy Server → General puis Save.'],
  inject: [{ do: 'set', path: SQ + '.stopped', value: '{{m.stopped}}' }, { do: 'set', path: SQ + '.enabled', value: '{{m.enabled}}' }],
  probes: [WIKI, NEVER],
  roots: [{ path: SQ + '.stopped', eq: false }, { path: SQ + '.enabled', eq: true }],
  fix: [{ do: 'set', path: SQ + '.stopped', value: false }, { do: 'set', path: SQ + '.enabled', value: true }],
  workarounds: { client_sans_proxy: CLIENT_PROXY_OFF },
  traps: ['Décocher le proxy dans Options Internet rend la navigation mais supprime tout filtrage pour ce poste : ce n’est pas une réparation.', 'Redémarrer le poste ou vider le cache du navigateur n’a aucun effet : le proxy lui-même ne répond pas.'],
  optimal: ['Lire le message du navigateur (proxy injoignable)', 'Tester le port 3128 depuis le poste', 'Status → Services sur pfSense : Squid arrêté', 'Démarrer / réactiver Squid', 'Retester la navigation'] });

add({ id: 'px_cache_unsaved', level: 2, title: 'Squid ne démarre pas : cache local jamais enregistré', skills: ['proxy', 'pfsense', 'diag'],
  ticket: tk(RH, 'Le proxy ne répond plus depuis la réinstallation du paquet', 'Bonjour, hier le technicien a réinstallé le paquet du proxy sur le pare-feu « pour le mettre à jour ». Depuis, mon navigateur indique qu’il ne peut pas se connecter au serveur proxy. Il dit que tout est coché comme avant.'),
  cause: 'Après la réinstallation du paquet, la configuration du cache local n’a jamais été enregistrée (onglet Local Cache) : les dossiers de cache n’existent pas et Squid ne démarre pas, bien que « Enable Squid Proxy » soit coché.',
  solution: 'Ouvrir Services → Squid Proxy Server → Local Cache, cliquer sur Save pour créer le cache, puis démarrer Squid.',
  hints: ['Le navigateur ne joint pas le proxy (ERR_PROXY_CONNECTION_FAILED). Comparez avec la configuration : « Enable Squid Proxy » est bien coché.', 'Status → Services : Squid est arrêté malgré la case cochée. Un démarrage échoue si une étape de préparation n’a pas été faite après la réinstallation.', 'Services → Squid Proxy Server → onglet Local Cache : enregistrez la page (Save) pour initialiser le cache, puis démarrez le service.'],
  inject: [{ do: 'set', path: SQ + '.cacheSaved', value: false }],
  probes: [WIKI, NEVER],
  roots: [{ path: SQ + '.cacheSaved', eq: true }],
  fix: [{ do: 'set', path: SQ + '.cacheSaved', value: true }],
  workarounds: { client_sans_proxy: CLIENT_PROXY_OFF },
  traps: ['Réinstaller encore le paquet ne règle rien : la configuration du cache doit être enregistrée.', 'Contourner en retirant le proxy du poste fait disparaître le filtrage.'],
  optimal: ['Constater l’erreur de proxy injoignable', 'Status → Services : Squid arrêté', 'Squid → General : tout est coché', 'Local Cache → Save', 'Démarrer Squid puis retester'] });

add({ id: 'px_pkg_broken', level: 2, title: 'Paquet Squid ou squidGuard « configured but not (fully) installed »', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'squid', pkg: 'squid', label: 'Squid' },
    { key: 'guard', pkg: 'squidGuard', label: 'squidGuard' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Un des paquets du proxy est signalé en erreur sur pfSense', 'Bonjour, après la coupure électrique de la nuit, le filtrage web se comporte bizarrement depuis le poste RH. Dans l’interface du pare-feu, le menu System → Package Manager montre un avertissement sur un des paquets.'),
  cause: 'Le paquet {{m.label}} est marqué « Package is configured but not (fully) installed or deprecated » : son installation a été interrompue par la coupure et le service concerné ne peut pas démarrer.',
  solution: 'System → Package Manager → Installed Packages : réinstaller le paquet concerné (icône Reinstall Package), attendre « Success », puis vérifier le service.',
  hints: ['Regardez ce qui est filtré et ce qui ne l’est plus depuis le poste RH, puis ouvrez Status → Services : lequel des deux services du proxy n’est pas démarré ?', 'System → Package Manager → Installed Packages : un des paquets porte un avertissement rouge.', 'Cliquez sur l’icône « Reinstall Package » du paquet en défaut et attendez la fin du journal d’installation.'],
  inject: [{ do: 'set', path: PF + '.packages[name={{m.pkg}}].broken', value: true }],
  probes: [WIKI, NEVER, NO_IG],
  roots: [{ path: PF + '.packages[name={{m.pkg}}].broken', eq: false }],
  fix: [{ do: 'set', path: PF + '.packages[name={{m.pkg}}].broken', value: false }],
  traps: ['Relancer le service depuis Status → Services ne répare pas un paquet incomplet.'],
  optimal: ['Observer le symptôme (page d’erreur ou site non filtré)', 'Status → Services', 'System → Package Manager : repérer le paquet en défaut', 'Reinstall Package', 'Retester'] });

add({ id: 'px_iface', level: 2, title: 'Squid écoute sur la mauvaise interface', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'wan', label: 'WAN', ifaces: ['wan'] },
    { key: 'dmz', label: 'DMZ', ifaces: ['dmz'] }
  ] },
  ticket: tk(RH, 'Après la modification du proxy, plus personne ne navigue', 'Bonjour, hier on a « resserré la sécurité » sur le proxy du pare-feu. Aujourd’hui le service est démarré d’après l’écran du pare-feu, mais mon navigateur dit qu’il ne peut pas joindre le proxy.'),
  cause: 'Dans Services → Squid Proxy Server → General, « Proxy Interface(s) » ne contient plus que {{m.label}} : Squid n’écoute plus sur LAN et refuse les connexions des postes.',
  solution: 'Sélectionner l’interface LAN dans « Proxy Interface(s) », enregistrer (Save) et vérifier que la navigation fonctionne.',
  hints: ['Le service est démarré mais le port 3128 refuse la connexion depuis le poste. Qu’est-ce qui peut faire qu’un service démarré ne réponde pas sur une adresse donnée ?', 'Squid n’écoute que sur les interfaces cochées dans l’onglet General. Comparez avec l’interface par laquelle le poste atteint le pare-feu (10.10.0.1 = LAN).', 'Services → Squid Proxy Server → General → « Proxy Interface(s) » : sélectionnez LAN, puis Save.'],
  inject: [{ do: 'set', path: SQ + '.ifaces', value: '{{m.ifaces}}' }],
  probes: [WIKI, NEVER],
  roots: [{ path: SQ + '.ifaces', has: 'lan' }],
  fix: [{ do: 'set', path: SQ + '.ifaces', value: ['lan'] }],
  workarounds: { client_sans_proxy: CLIENT_PROXY_OFF },
  traps: ['Ouvrir le port 3128 sur la règle WAN du pare-feu n’aide pas : le problème est l’interface d’écoute, pas le filtrage.'],
  optimal: ['Tester le port 3128 depuis le poste (refus)', 'Status → Services : Squid démarré', 'Squid → General : interfaces du proxy', 'Sélectionner LAN', 'Retester'] });

/* ======================= CÔTÉ POSTE (OPTIONS INTERNET) ======================= */
add({ id: 'px_client_port', level: 1, title: 'Poste : adresse ou port du proxy erroné dans Options Internet', skills: ['proxy', 'diag'],
  vary: { m: [
    { key: 'port', label: 'le port est 8080 au lieu de 3128', server: '10.10.0.1', port: 8080 },
    { key: 'addr', label: 'l’adresse du proxy est 10.10.10.1 au lieu de 10.10.0.1', server: '10.10.10.1', port: 3128 }
  ] },
  ticket: tk(RH, 'Mon navigateur n’arrive plus à se connecter au proxy', 'Bonjour, mon navigateur affiche « Impossible de se connecter au serveur proxy ». Un collègue est passé sur mon poste ce matin « pour faire un réglage dans les options ». Les autres postes du service naviguent normalement.'),
  cause: 'Dans Options Internet → Connexions → Paramètres réseau du poste PC-02, {{m.label}} : le navigateur contacte un service qui ne répond pas.',
  solution: 'Rétablir 10.10.0.1 port 3128 dans Options Internet → Connexions → Paramètres réseau (Paramètres du réseau local, LAN).',
  hints: ['Seul ce poste est touché : le défaut est sur le poste, pas sur le pare-feu. Que dit exactement la page d’erreur du navigateur ?', 'Ouvrez le Panneau de configuration → Réseau et Internet → Options Internet → Connexions → Paramètres réseau et comparez adresse et port avec ceux de Squid (10.10.0.1, 3128).', 'Corrigez l’adresse et le port, validez par OK, puis rechargez la page.'],
  inject: [{ do: 'set', path: PC + '.proxy.server', value: '{{m.server}}' }, { do: 'set', path: PC + '.proxy.port', value: '{{m.port}}' }],
  probes: [WIKI, NEVER],
  roots: [{ path: PC + '.proxy.server', eq: '10.10.0.1' }, { path: PC + '.proxy.port', eq: 3128 }],
  fix: [{ do: 'set', path: PC + '.proxy.server', value: '10.10.0.1' }, { do: 'set', path: PC + '.proxy.port', value: 3128 }],
  workarounds: { sans_proxy: CLIENT_PROXY_OFF },
  traps: ['Décocher « Utiliser un serveur proxy » fait revenir la navigation mais sort le poste du filtrage.'],
  optimal: ['Lire l’erreur du navigateur', 'Comparer avec les autres postes', 'Options Internet → Paramètres réseau', 'Corriger adresse et port', 'Retester'] });

add({ id: 'px_client_bypass', level: 2, title: 'Poste : exceptions du proxy trop larges, Facebook et YouTube accessibles', skills: ['proxy', 'diag'],
  vary: { m: [
    { key: 'com', label: 'l’exception « *.com » a été ajoutée', ex: ['10.10.*', '*.toulouse.local', '*.com'] },
    { key: 'star', label: 'l’exception « * » a été ajoutée', ex: ['10.10.*', '*.toulouse.local', '*'] }
  ] },
  ticket: tk('Direction RH', 'Des salariés ouvrent YouTube et Facebook alors que c’est interdit', 'Bonjour, la charte interdit les réseaux sociaux et les vidéos, et le proxy est censé les bloquer. Or depuis le poste d’accueil RH, tout s’ouvre sans problème. Les autres postes sont bien bloqués.'),
  cause: 'Dans Options Internet → Paramètres du proxy → Avancé du poste PC-02, {{m.label}} dans les exceptions : ces adresses ne passent plus par le proxy et échappent donc à la liste noire.',
  solution: 'Retirer l’exception excessive : seules les adresses 10.10.* et *.toulouse.local doivent contourner le proxy.',
  hints: ['Un site interdit s’ouvre, donc la requête ne passe pas par le filtrage. Regardez Status/Real Time côté Squid : voit-on passer les requêtes de ce poste ?', 'Les exceptions de Options Internet → Connexions → Paramètres réseau → Avancé dictent quelles adresses sont jointes en direct.', 'Supprimez l’exception ajoutée (ne gardez que 10.10.* et *.toulouse.local) puis validez.'],
  inject: [{ do: 'set', path: PC + '.proxy.exceptions', value: '{{m.ex}}' }],
  probes: [WIKI, NO_FB, NO_YT],
  roots: [{ path: PC + '.proxy.exceptions', eq: CLIENT_EXC }],
  fix: [{ do: 'set', path: PC + '.proxy.exceptions', value: CLIENT_EXC }],
  traps: ['Ajouter facebook.com à la Blacklist de Squid ne change rien : le poste ne passe pas par Squid.'],
  optimal: ['Constater que le site s’ouvre', 'Real Time de Squid : aucune requête de ce poste', 'Options Internet → Avancé : exceptions', 'Retirer l’exception', 'Retester le blocage'] });

/* ======================= ACL DE SQUID ======================= */
add({ id: 'px_subnet_denied', level: 2, title: 'Squid refuse les postes du VLAN (réseaux autorisés)', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'vide', label: 'aucun sous-réseau n’est renseigné', nets: [] },
    { key: 'mauvais', label: 'seul 10.10.0.0/24 est renseigné (les postes sont en 10.10.20.0/24)', nets: ['10.10.0.0/24'] },
    { key: 'bdx', label: 'seul 10.20.0.0/16 (Bordeaux) est renseigné', nets: ['10.20.0.0/16'] }
  ] },
  ticket: tk(RH, 'Une page « Access Denied » s’affiche quand je navigue', 'Bonjour, le proxy répond mais tout est refusé : en HTTP j’ai une page d’erreur avec « Access Denied », en HTTPS une erreur de tunnel. Ça marchait avant le passage de nos postes dans le VLAN 20.'),
  cause: 'Squid n’autorise que le réseau de l’interface du proxy (le LAN du pare-feu) : dans Squid → ACLs → « Allowed subnets », {{m.label}}, donc les postes du VLAN 20 sont refusés (TCP_DENIED/403).',
  solution: 'Ajouter le réseau des postes (10.10.0.0/16, ou au moins 10.10.20.0/24) dans Squid → ACLs → Allowed subnets, puis enregistrer.',
  hints: ['Le proxy est joint (la page d’erreur vient de lui) mais il refuse. Squid → Real Time : quel statut apparaît pour l’adresse du poste ?', 'TCP_DENIED/403 pour 10.10.20.60 : « Allow Users on Interface » n’autorise que le sous-réseau de l’interface du pare-feu (10.10.0.0/30), pas les VLAN derrière le routeur.', 'Squid → ACLs → Allowed subnets : ajoutez 10.10.0.0/16 (une ligne par réseau), Save.'],
  inject: [{ do: 'set', path: SQ + '.acl.allowedSubnets', value: '{{m.nets}}' }],
  probes: [WIKI, NEVER],
  roots: [{ any: [{ path: SQ + '.acl.allowedSubnets', has: '10.10.0.0/16' }, { path: SQ + '.acl.allowedSubnets', has: '10.10.20.0/24' }] }],
  fixes: { reseau_16: [{ do: 'set', path: SQ + '.acl.allowedSubnets', value: ['10.10.0.0/16'] }], vlan_20: [{ do: 'set', path: SQ + '.acl.allowedSubnets', value: ['10.10.20.0/24'] }] },
  fix: [{ do: 'set', path: SQ + '.acl.allowedSubnets', value: ['10.10.0.0/16'] }],
  workarounds: { client_sans_proxy: CLIENT_PROXY_OFF },
  traps: ['Sortir le poste du proxy contourne le refus sans le corriger.', 'Autoriser 0.0.0.0/0 ouvrirait le proxy à tout réseau joignable : trop large.'],
  optimal: ['Lire la page d’erreur (Access Denied)', 'Squid → Real Time : TCP_DENIED/403', 'Squid → ACLs : sous-réseaux autorisés', 'Ajouter 10.10.0.0/16', 'Retester HTTP et HTTPS'] });

add({ id: 'px_blacklist_regex', level: 3, title: 'Squid ne démarre plus : entrée invalide dans la Blacklist', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'etoile', label: '« *.facebook.com »', bl: ['*.facebook.com', 'youtube.com'] },
    { key: 'parenthese', label: '« (youtube.com »', bl: ['facebook.com', '(youtube.com'] },
    { key: 'crochet', label: '« [tiktok.com »', bl: ['facebook.com', 'youtube.com', '[tiktok.com'] }
  ] },
  ticket: tk(RH, 'Plus de proxy depuis qu’on a ajouté un site à bloquer', 'Bonjour, la direction a demandé de bloquer un site de plus. Le technicien a modifié la liste des sites bloqués ce matin, et depuis plus aucun site ne s’ouvre sur mon poste : « impossible de se connecter au serveur proxy ».'),
  cause: 'La Blacklist de Squid contient l’entrée {{m.label}}, qui n’est pas une expression régulière valide (les entrées sont des regex) : Squid refuse de démarrer avec cette configuration.',
  solution: 'Corriger ou supprimer l’entrée invalide dans Squid → ACLs → Blacklist (par exemple « facebook.com », « youtube.com »), enregistrer et vérifier que Squid démarre.',
  hints: ['Le proxy est injoignable alors que « Enable Squid Proxy » est coché et que rien d’autre n’a changé que la liste des sites bloqués.', 'Status → Services : Squid ne démarre pas. Squid → Real Time → Cache Logs : le démarrage échoue sur une expression régulière.', 'Squid → ACLs → Blacklist : les entrées sont des expressions régulières. Corrigez l’entrée invalide (écrivez facebook.com, pas *.facebook.com), Save, puis vérifiez le service.'],
  inject: [{ do: 'set', path: SQ + '.acl.blacklist', value: '{{m.bl}}' }],
  probes: [{ t: 'squid', run: true, label: 'Le service Squid démarre' }, WIKI, NO_FB, NO_YT],
  roots: [{ probe: { t: 'squid', run: true } }],
  fix: [{ do: 'set', path: SQ + '.acl.blacklist', value: DEF_LIST }],
  traps: ['Vider toute la Blacklist fait redémarrer Squid mais YouTube redevient accessible : la consigne de blocage n’est plus appliquée.'],
  optimal: ['Constater l’erreur de proxy injoignable', 'Status → Services : Squid arrêté', 'Cache Logs : erreur d’expression régulière', 'Corriger l’entrée de la Blacklist', 'Vérifier le service et le blocage'] });

add({ id: 'px_blacklist_overblock', level: 2, title: 'Blacklist trop large : un site légitime est bloqué', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'pedia', label: '« pedia »', bl: ['facebook.com', 'youtube.com', 'pedia'] },
    { key: 'org', label: '« .org »', bl: ['facebook.com', 'youtube.com', '.org'] }
  ] },
  ticket: tk(RH, 'Wikipédia ne s’ouvre plus', 'Bonjour, depuis hier je n’arrive plus à ouvrir Wikipédia, j’ai une page d’erreur. Les autres sites autorisés fonctionnent. Hier on a ajouté un mot à la liste des sites bloqués.'),
  cause: 'La Blacklist de Squid contient l’entrée {{m.label}} : les entrées sont des expressions régulières appliquées au nom du site, elles correspondent aussi à www.wikipedia.org, qui est refusé (TCP_DENIED/403).',
  solution: 'Remplacer l’entrée trop large par des noms précis (facebook.com, youtube.com) dans Squid → ACLs → Blacklist, puis enregistrer.',
  hints: ['Seul un site précis est inaccessible alors que le proxy fonctionne. Squid → Real Time : que dit le journal pour wikipedia.org ?', 'TCP_DENIED/403 pour wikipedia.org : un motif de la Blacklist l’a retenu. Relisez toutes les entrées en pensant « sous-chaîne / expression régulière ».', 'Remplacez l’entrée trop générale par le nom exact du site visé (ou supprimez-la), Save. Éviter la Whitelist : elle masque le défaut sans le corriger.'],
  inject: [{ do: 'set', path: SQ + '.acl.blacklist', value: '{{m.bl}}' }],
  probes: [WIKI, NO_FB, NO_YT],
  roots: [{ probe: { t: 'squid', blNot: 'www.wikipedia.org' } }],
  fix: [{ do: 'set', path: SQ + '.acl.blacklist', value: DEF_LIST }],
  workarounds: { whitelist: [{ do: 'set', path: SQ + '.acl.whitelist', value: ['wikipedia.org'] }] },
  traps: ['Ajouter wikipedia.org à la Whitelist rouvre l’accès mais laisse une entrée de Blacklist qui bloquera d’autres sites sans prévenir.'],
  optimal: ['Reproduire le blocage de Wikipédia', 'Squid → Real Time : TCP_DENIED/403', 'Squid → ACLs → Blacklist', 'Corriger l’entrée trop large', 'Retester Wikipédia et le blocage'] });

add({ id: 'px_whitelist', level: 2, title: 'Whitelist qui annule la Blacklist : YouTube accessible', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'yt', label: '« youtube.com »', wl: ['youtube.com'] },
    { key: 'tout', label: '« .* » (tous les sites)', wl: ['.*'] },
    { key: 'tube', label: '« tube »', wl: ['tube'] }
  ] },
  ticket: tk('Direction RH', 'YouTube s’ouvre depuis le poste RH malgré l’interdiction', 'Bonjour, YouTube est censé être bloqué par le proxy et il est bien dans la liste des sites interdits. Pourtant il s’ouvre sans souci depuis le poste RH, alors que Facebook reste bloqué.'),
  cause: 'La Whitelist de Squid contient {{m.label}} : une correspondance dans la Whitelist l’emporte sur la Blacklist, donc youtube.com n’est plus refusé par Squid.',
  solution: 'Vider la Whitelist de Squid (Squid → ACLs → Whitelist) pour que la Blacklist s’applique de nouveau.',
  hints: ['Le site est bien dans la Blacklist et pourtant il passe. Qu’est-ce qui peut être évalué avant la Blacklist ?', 'Squid → ACLs : relisez le champ Whitelist. Facebook reste bloqué car il l’est aussi par une autre couche (squidGuard).', 'Videz la Whitelist (ou retirez l’entrée qui correspond à youtube.com), Save, puis retestez.'],
  inject: [{ do: 'set', path: SQ + '.acl.whitelist', value: '{{m.wl}}' }],
  probes: [WIKI, NO_YT, NO_FB],
  roots: [{ probe: { t: 'squid', wlNot: 'www.youtube.com' } }],
  fix: [{ do: 'set', path: SQ + '.acl.whitelist', value: [] }],
  traps: ['Ajouter une deuxième entrée à la Blacklist ne sert à rien : la Whitelist reste prioritaire.'],
  optimal: ['Constater que YouTube s’ouvre', 'Vérifier la Blacklist (correcte)', 'Squid → ACLs : Whitelist', 'Vider la Whitelist', 'Retester le blocage'] });

/* ======================= squidGuard ======================= */
add({ id: 'px_sg_off', level: 1, title: 'squidGuard arrêté : le filtrage par catégories ne s’applique plus', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'stop', label: 'le service squidGuard est arrêté (Status → Services)', enabled: true, stopped: true },
    { key: 'off', label: 'la case d’activation de squidGuard (General settings) est décochée', enabled: false, stopped: false }
  ] },
  ticket: tk('Direction RH', 'Un réseau social s’ouvre alors qu’il devrait être filtré', 'Bonjour, Instagram et un site pour adultes s’ouvrent depuis le poste RH. Pourtant le filtrage par catégories avait été mis en place il y a un mois, et Facebook et YouTube sont toujours bloqués.'),
  cause: 'Sur pfSense, {{m.label}} : Squid fonctionne (sa Blacklist bloque encore Facebook et YouTube) mais plus aucune catégorie n’est filtrée.',
  solution: 'Réactiver squidGuard (General settings : Enable, puis Apply) ou le redémarrer depuis Status → Services, et vérifier « SquidGuard service state: STARTED ».',
  hints: ['Seuls les sites filtrés par catégories s’ouvrent : la Blacklist de Squid, elle, fonctionne. Quel composant s’occupe des catégories ?', 'Services → SquidGuard Proxy Filter → General settings : lisez « SquidGuard service state ». Contrôlez aussi Status → Services.', 'Cochez Enable (si besoin), Save puis Apply, ou redémarrez squidGuard dans Status → Services ; vérifiez STARTED.'],
  inject: [{ do: 'set', path: SG + '.enabled', value: '{{m.enabled}}' }, { do: 'set', path: SG + '.stopped', value: '{{m.stopped}}' }],
  probes: [WIKI, NO_IG, NO_ADULT],
  roots: [{ probe: { t: 'squid', guard: true } }],
  fix: [{ do: 'set', path: SG + '.enabled', value: true }, { do: 'set', path: SG + '.stopped', value: false }],
  traps: ['Ajouter ces sites à la Blacklist de Squid règle ces deux cas mais pas la catégorie entière.'],
  optimal: ['Constater que les catégories ne sont plus filtrées', 'General settings : état du service', 'Activer / démarrer squidGuard', 'Apply', 'Retester'] });

add({ id: 'px_sg_default_deny', level: 2, title: 'squidGuard : accès par défaut « deny », plus aucun site ne s’ouvre', skills: ['proxy', 'pfsense', 'diag'],
  ticket: tk(RH, 'Tous les sites sont bloqués depuis la modification du filtre', 'Bonjour, depuis la modification du filtre web, plus aucun site ne s’ouvre : en HTTPS j’ai une erreur de tunnel et en HTTP une page « Request denied by pfSense proxy ». Le proxy lui-même a l’air de fonctionner.'),
  cause: 'Dans squidGuard → Common ACL, « Default access [all] » est passé à deny : tout site qui n’appartient à aucune catégorie autorisée explicitement est redirigé et bloqué, y compris Wikipédia.',
  solution: 'Remettre « Default access [all] » sur allow dans Common ACL, enregistrer puis cliquer sur Apply dans General settings.',
  hints: ['Le proxy répond (erreur de tunnel / page de refus) mais tout est refusé, y compris des sites sans rapport avec les catégories bloquées.', 'squidGuard → Log → Blocked : les requêtes de Wikipédia sont redirigées par la règle « default ». Observez la catégorie indiquée.', 'Services → SquidGuard Proxy Filter → Common ACL : passez « Default access [all] » sur allow, Save, puis Apply (General settings).'],
  inject: [{ do: 'set', path: SG + '.acl.default', value: 'deny' }],
  probes: [WIKI, NEVER],
  roots: [{ path: SG + '.acl.default', eq: 'allow' }],
  fix: [{ do: 'set', path: SG + '.acl.default', value: 'allow' }],
  traps: ['Enregistrer la page sans cliquer sur Apply ne change rien pour les utilisateurs : les modifications de squidGuard ne s’appliquent qu’après Apply.', 'Arrêter squidGuard règle le symptôme mais supprime tout filtrage par catégories.'],
  optimal: ['Constater que tout est bloqué', 'squidGuard → Log → Blocked : règle default', 'Common ACL : Default access', 'Passer sur allow, Save', 'Apply puis retester'] });

add({ id: 'px_sg_category', level: 2, title: 'squidGuard : une catégorie n’est plus refusée', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'social', label: 'social_networks (réseaux sociaux)', social: 'allow', adult: 'deny' },
    { key: 'adult', label: 'adult (sites pour adultes)', social: 'deny', adult: 'allow' }
  ] },
  ticket: tk('Direction RH', 'Un site interdit par la charte s’ouvre à nouveau', 'Bonjour, depuis la dernière intervention sur le filtre web, un site qui était bloqué (réseau social ou contenu adulte) est de nouveau accessible depuis le poste RH. Le reste du filtrage semble en place.'),
  cause: 'Dans squidGuard → Common ACL, la catégorie {{m.label}} est passée en « allow » : les sites de cette catégorie ne sont plus redirigés.',
  solution: 'Remettre la catégorie concernée en deny dans Common ACL (Target Rules List), Save, puis Apply.',
  hints: ['Un seul type de site s’ouvre : le filtrage fonctionne globalement. Quelle catégorie squidGuard a-t-il donnée à ce site ?', 'Common ACL → Target Rules List (+) : parcourez les catégories blk_blacklists_… concernées.', 'Passez la catégorie en deny, Save, Apply (General settings), puis retestez depuis le poste.'],
  inject: [{ do: 'set', path: SG + '.acl.cats', value: { social_networks: '{{m.social}}', adult: '{{m.adult}}' } }],
  probes: [WIKI, NO_IG, NO_ADULT, NO_FB],
  roots: [{ path: SG + '.acl.cats.social_networks', eq: 'deny' }, { path: SG + '.acl.cats.adult', eq: 'deny' }],
  fix: [{ do: 'set', path: SG + '.acl.cats', value: { social_networks: 'deny', adult: 'deny' } }],
  traps: ['Bloquer le site précis dans la Blacklist de Squid ne règle pas les autres sites de la catégorie.'],
  optimal: ['Identifier le site qui passe', 'Common ACL → Target Rules List', 'Repérer la catégorie en allow', 'Deny + Save + Apply', 'Retester'] });

add({ id: 'px_sg_nolist', level: 3, title: 'squidGuard sans base de catégories (téléchargement jamais fait)', skills: ['proxy', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'vide', label: 'la base de catégories n’a jamais été téléchargée', url: SG_URL },
    { key: 'url', label: 'l’adresse de la liste est erronée et le téléchargement n’a jamais abouti', url: 'http://dsi.ut-capitole.fr/blacklists/download/blacklist.tar.gz' }
  ] },
  ticket: tk('Direction RH', 'Le filtre par catégories ne fait plus rien depuis la réinstallation', 'Bonjour, depuis la réinstallation du filtre, Instagram et les sites pour adultes sont de nouveau ouverts. Pourtant les catégories sont bien cochées « deny » dans l’interface, le technicien l’a vérifié deux fois.'),
  cause: 'Sur pfSense, {{m.label}} : squidGuard n’a aucune liste de catégories sur le disque (son service reste arrêté), donc les règles « deny » n’ont aucun effet.',
  solution: 'Dans squidGuard → Blacklist, saisir l’URL de la liste UT Capitole (blacklists_for_pfsense.tar.gz), cliquer sur Download jusqu’à « Blacklist update complete », puis Apply dans General settings.',
  hints: ['Les règles sont correctes mais sans effet : que doit-il y avoir pour que « deny » ait un sens pour squidGuard ? Regardez l’état du service dans General settings.', 'squidGuard → Blacklist : la base est vide (« aucune liste chargée »). Contrôlez l’URL saisie.', 'Renseignez http://dsi.ut-capitole.fr/blacklists/download/blacklists_for_pfsense.tar.gz, cliquez sur Download, attendez « Blacklist update complete », puis Apply.'],
  inject: [{ do: 'set', path: PF + '.sgdb', value: { loaded: false, count: 0 } }, { do: 'set', path: SG + '.blacklist.url', value: '{{m.url}}' }],
  probes: [{ t: 'squid', guard: true, label: 'squidGuard est démarré' }, WIKI, NO_IG, NO_ADULT],
  roots: [{ path: PF + '.sgdb.loaded', eq: true }],
  fix: [{ do: 'set', path: PF + '.sgdb', value: { loaded: true, count: 69 } }, { do: 'set', path: SG + '.blacklist.url', value: SG_URL }],
  traps: ['Cocher d’autres catégories n’a aucun effet tant que la base n’est pas chargée.'],
  optimal: ['Constater que le filtrage ne s’applique plus', 'General settings : service arrêté', 'Blacklist : base vide / URL', 'Download', 'Apply puis retester'] });

/* ======================= DNS, SAFESEARCH, JOURNAUX ======================= */
add({ id: 'px_safesearch', level: 3, title: 'SafeSearch n’est plus forcé (surcharge DNS www.google.com)', skills: ['proxy', 'pfsense', 'dns', 'diag'],
  vary: { m: [
    { key: 'absente', label: 'la surcharge d’hôte www.google.com a été supprimée', unbound: true, ho: [] },
    { key: 'ip', label: 'la surcharge d’hôte www.google.com pointe vers l’adresse réelle du moteur (198.51.100.61) au lieu de forcesafesearch.google.com (216.239.38.120)', unbound: true, ho: [{ host: 'www', domain: 'google.com', ip: '198.51.100.61', descr: 'SafeSearch forcé', aliases: [{ host: 'www', domain: 'google.fr', descr: '' }] }] },
    { key: 'alias', label: 'l’alias www.google.fr de la surcharge d’hôte a été supprimé', unbound: true, ho: [{ host: 'www', domain: 'google.com', ip: '216.239.38.120', descr: 'SafeSearch forcé', aliases: [] }] },
    { key: 'resolveur', label: 'le Résolveur DNS est désactivé (les surcharges d’hôte ne sont plus servies)', unbound: false, ho: HO_GOOD }
  ] },
  ticket: tk('Direction RH', 'La recherche sécurisée n’est plus verrouillée sur les postes', 'Bonjour, la page google.com/safesearch affiche de nouveau « Filtering Off » sur le poste RH, alors qu’elle était verrouillée par l’administrateur. Une modification du DNS du pare-feu a eu lieu cette semaine.'),
  cause: 'Sur pfSense, {{m.label}} : le proxy résout www.google.com vers le vrai moteur et non vers le serveur qui force SafeSearch.',
  solution: 'Rétablir la surcharge d’hôte www.google.com → 216.239.38.120 (avec l’alias www.google.fr) dans Services → DNS Resolver, résolveur activé, et vérifier avec Diagnostics → DNS Lookup puis sur la page /safesearch.',
  hints: ['SafeSearch se verrouille en forçant la résolution DNS de www.google.com vers forcesafesearch.google.com. Que répond pfSense à Diagnostics → DNS Lookup pour www.google.com ?', 'Services → DNS Resolver : le résolveur est-il actif ? Existe-t-il une surcharge d’hôte pour www.google.com, avec son adresse et son alias www.google.fr ?', 'Surcharge d’hôte : host www, domaine google.com, IP 216.239.38.120, alias www.google.fr ; Save et Apply Changes, puis testez /safesearch (« Filtering On »).'],
  inject: [{ do: 'set', path: PF + '.dns.unbound.enabled', value: '{{m.unbound}}' }, { do: 'set', path: PF + '.dns.unbound.hostOverrides', value: '{{m.ho}}' }],
  probes: [{ t: 'http', from: PC, url: 'https://www.google.com/safesearch', contains: 'Filtering On', label: 'google.com/safesearch affiche « Filtering On »' }, { t: 'http', from: PC, url: 'http://www.google.fr/safesearch', contains: 'Filtering On', label: 'google.fr/safesearch affiche « Filtering On »' }],
  roots: [{ probe: { t: 'squid', resolves: { name: 'www.google.com', ip: '216.239.38.120' } } }, { probe: { t: 'squid', resolves: { name: 'www.google.fr', ip: '216.239.38.120' } } }],
  fix: [{ do: 'set', path: PF + '.dns.unbound.enabled', value: true }, { do: 'set', path: PF + '.dns.unbound.hostOverrides', value: HO_GOOD }],
  traps: ['Régler SafeSearch dans le navigateur du poste n’est pas verrouillé par l’administrateur.'],
  optimal: ['Constater « Filtering Off » sur /safesearch', 'DNS Lookup de www.google.com sur pfSense', 'DNS Resolver : surcharge d’hôte / résolveur', 'Rétablir la surcharge et l’alias', 'Retester les deux adresses'] });

add({ id: 'px_dns_upstream', level: 3, title: 'Le proxy ne résout plus les noms (serveur DNS de pfSense injoignable)', skills: ['proxy', 'pfsense', 'dns', 'diag'],
  vary: { m: [
    { key: 'faux', label: 'le serveur DNS général est 8.8.4.4, qui ne répond pas', servers: ['8.8.4.4'] },
    { key: 'vide', label: 'aucun serveur DNS général n’est renseigné', servers: [] },
    { key: 'interne', label: 'le serveur DNS général est 10.10.10.99, qui n’existe pas', servers: ['10.10.10.99'] }
  ] },
  ticket: tk(RH, 'Les sites ne se chargent plus mais le proxy répond', 'Bonjour, mon navigateur n’affiche plus aucun site : en HTTP j’obtiens une page du proxy avec « Unable to determine IP address from host name », en HTTPS une erreur de tunnel. Si je désactive le proxy dans les options, ça marche, mais je n’ai pas le droit.'),
  cause: 'Sur pfSense, {{m.label}} : le Résolveur DNS ne trouve plus aucun nom hors surcharges, donc Squid ne peut pas résoudre les sites demandés (NONE_NONE/503).',
  solution: 'Renseigner un serveur DNS joignable (8.8.8.8) dans System → General Setup, puis vérifier avec Diagnostics → DNS Lookup.',
  hints: ['Le proxy accepte la requête mais n’arrive pas à joindre le site. La page d’erreur dit qu’il ne trouve pas l’adresse : qui résout les noms pour Squid ?', 'Diagnostics → DNS Lookup depuis pfSense sur www.wikipedia.org : échec ? Le résolveur transmet aux serveurs DNS généraux.', 'System → General Setup → DNS Servers : renseignez 8.8.8.8, Save, puis refaites le DNS Lookup.'],
  inject: [{ do: 'set', path: PF + '.dns.servers', value: '{{m.servers}}' }],
  probes: [WIKI, NEVER],
  roots: [{ probe: { t: 'squid', resolves: { name: 'www.wikipedia.org', ip: '185.15.59.224' } } }],
  fix: [{ do: 'set', path: PF + '.dns.servers', value: ['8.8.8.8'] }],
  workarounds: { client_sans_proxy: CLIENT_PROXY_OFF },
  traps: ['Désactiver le proxy sur le poste fait résoudre par l’AD et contourne le défaut (et le filtrage).'],
  optimal: ['Lire la page d’erreur (résolution)', 'Real Time : NONE_NONE/503', 'DNS Lookup depuis pfSense (échec)', 'Corriger les serveurs DNS généraux', 'Retester'] });

add({ id: 'px_log_off', level: 1, title: 'Journaux du proxy vides (journalisation désactivée)', skills: ['proxy', 'pfsense'],
  vary: { m: [
    { key: 'squid', label: 'la case « Enable Access Logging » de Squid General est décochée', acc: false, sg: true },
    { key: 'guard', label: 'la case « Enable log » de squidGuard est décochée', acc: true, sg: false }
  ] },
  ticket: tk('Responsable sécurité', 'Je ne vois plus les accès web dans les journaux du proxy', 'Bonjour, pour l’enquête sur un salarié j’ai besoin du journal des accès, mais l’écran du proxy reste vide quand je navigue, alors que la navigation fonctionne. Même chose pour la liste des sites refusés.'),
  cause: 'Sur pfSense, {{m.label}} : les requêtes sont traitées normalement mais aucune ligne n’est écrite dans le journal concerné.',
  solution: 'Réactiver la journalisation (Squid General → Enable Access Logging, ou squidGuard General settings → Enable log), enregistrer, appliquer, puis vérifier dans Real Time / Log.',
  hints: ['La navigation fonctionne mais le journal reste vide : le service tourne, c’est donc l’écriture du journal qui est coupée.', 'Squid → General (Enable Access Logging) et squidGuard → General settings (Enable log) : comparez les deux.', 'Cochez la journalisation manquante, Save (et Apply pour squidGuard), puis naviguez et actualisez Real Time ou Log → Blocked.'],
  inject: [{ do: 'set', path: SQ + '.log.access', value: '{{m.acc}}' }, { do: 'set', path: SG + '.log', value: '{{m.sg}}' }],
  probes: [{ t: 'eq', path: SQ + '.log.access', value: true, label: 'Squid écrit son journal d’accès' }, { t: 'eq', path: SG + '.log', value: true, label: 'squidGuard écrit son journal des blocages' }],
  roots: [{ path: SQ + '.log.access', eq: true }, { path: SG + '.log', eq: true }],
  fix: [{ do: 'set', path: SQ + '.log.access', value: true }, { do: 'set', path: SG + '.log', value: true }],
  verify: ['http:PC-02:*'],
  traps: ['Vider le journal n’y change rien : il n’est plus alimenté.'],
  optimal: ['Naviguer puis ouvrir Real Time (vide)', 'Squid → General', 'squidGuard → General settings', 'Réactiver la journalisation et appliquer', 'Naviguer et relire le journal'] });

/* ======================= MODE TRANSPARENT, HTTPS, QUIC ======================= */
add({ id: 'px_trans_off', level: 2, title: 'Mode transparent : la redirection HTTP ne fonctionne pas', skills: ['proxy', 'pfsense', 'pare-feu-etats', 'diag'],
  vary: { m: [
    { key: 'off', label: 'la case « Transparent HTTP Proxy » n’est pas cochée', tr: false, ti: [] },
    { key: 'sans_if', label: 'la case « Transparent HTTP Proxy » est cochée mais aucune interface de redirection n’est choisie', tr: true, ti: [] },
    { key: 'wan', label: 'l’interface de redirection choisie est WAN au lieu de LAN', tr: true, ti: ['wan'] }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Après la bascule en mode transparent, Facebook s’ouvre en HTTP', 'Bonjour, nous avons retiré la configuration proxy des navigateurs pour passer en mode transparent. Depuis, des sites interdits s’ouvrent en HTTP sur le poste RH : le proxy ne voit plus passer le trafic.'),
  cause: 'Dans Squid General (poste sans proxy déclaré), {{m.label}} : le trafic HTTP du poste n’est pas redirigé vers Squid et part directement sur Internet, sans filtrage.',
  solution: 'Cocher « Transparent HTTP Proxy », sélectionner l’interface LAN comme « Transparent Proxy Interface(s) », enregistrer, puis retester le blocage HTTP.',
  hints: ['Le poste n’a plus de proxy configuré : s’il passe par Squid, c’est que le pare-feu redirige le trafic. Squid → Real Time voit-il les requêtes du poste ?', 'Squid → General : cherchez les réglages « Transparent HTTP Proxy » et l’interface sur laquelle la redirection s’applique.', 'Cochez Transparent HTTP Proxy, choisissez LAN dans « Transparent Proxy Interface(s) », Save, puis retestez http://www.facebook.com depuis le poste.'],
  inject: [{ do: 'set', path: PC + '.proxy.enabled', value: false }, { do: 'set', path: SQ + '.transparent', value: '{{m.tr}}' }, { do: 'set', path: SQ + '.transIfaces', value: '{{m.ti}}' }],
  probes: [NEVER, NO_FB_HTTP],
  roots: [{ path: SQ + '.transparent', eq: true }, { path: SQ + '.transIfaces', has: 'lan' }],
  fix: [{ do: 'set', path: SQ + '.transparent', value: true }, { do: 'set', path: SQ + '.transIfaces', value: ['lan'] }],
  workarounds: { proxy_explicite: CLIENT_PROXY_ON },
  traps: ['Reconfigurer le proxy dans le navigateur contourne le mode transparent voulu par l’exercice.'],
  optimal: ['Constater que Facebook en HTTP s’ouvre', 'Real Time : rien n’apparaît', 'Squid → General : mode transparent', 'Cocher et choisir LAN', 'Retester'] });

add({ id: 'px_quic', level: 3, title: 'HTTPS transparent : les sites passent encore par QUIC (UDP 443)', skills: ['proxy', 'pfsense', 'pare-feu-etats', 'diag'],
  ticket: tk('Admin TSSR (informatique)', 'Facebook et YouTube s’ouvrent en HTTPS malgré l’interception SSL', 'Bonjour, nous avons activé l’interception HTTPS en mode transparent et retiré le proxy des navigateurs. En test, Facebook est bien bloqué avec certains navigateurs mais pas avec Chrome : la page s’ouvre et rien n’apparaît dans les journaux de Squid.'),
  cause: 'Le navigateur tente d’abord QUIC (UDP 443) vers les sites qui le proposent ; la règle « Autoriser LAN vers tout » laisse passer ce trafic, qui n’est pas redirigé vers Squid. Il manque une règle LAN qui rejette UDP 443 pour forcer le retour en TCP.',
  solution: 'Ajouter en haut des règles LAN une règle Reject, protocole UDP, destination port 443 (au-dessus de « Autoriser LAN vers tout »), appliquer, puis retester Facebook et YouTube.',
  hints: ['Le site s’ouvre mais Squid ne journalise rien : le trafic ne passe pas par le proxy. Le navigateur utilise-t-il un autre protocole que TCP 443 ?', 'Firewall → Rules → LAN : « Autoriser LAN vers tout » laisse passer UDP 443 (QUIC / HTTP/3), qui ne peut pas être intercepté.', 'Créez une règle Reject (UDP, destination 443) placée au-dessus de la règle de passage, Save, Apply Changes, puis retestez.'],
  inject: TRANS_SETUP,
  probes: [WIKI, NEVER, NO_FB, NO_YT],
  roots: [QUIC_FB],
  fix: [{ do: 'set', path: PF + '.rules.lan', value: [QUIC_REJECT, LAN_PASS] }],
  workarounds: { proxy_explicite: CLIENT_PROXY_ON },
  traps: ['Placer la règle Reject sous « Autoriser LAN vers tout » ne sert à rien : la première règle qui correspond s’applique.', 'Bloquer TCP 443 coupe tout HTTPS, pas seulement QUIC.'],
  optimal: ['Constater que Facebook en HTTPS s’ouvre', 'Real Time : aucune requête', 'Repérer QUIC / UDP 443', 'Règle Reject UDP 443 au-dessus du pass-all', 'Retester'] });

add({ id: 'px_trans_multi', level: 4, title: 'Filtrage HTTPS transparent inopérant : interception SSL absente et QUIC non bloqué', skills: ['proxy', 'pfsense', 'pare-feu-etats', 'diag'],
  ticket: tk('Responsable sécurité', 'Audit : les sites interdits sont accessibles en HTTPS depuis le VLAN postes', 'Bonjour, lors de l’audit du filtrage web, tous les sites interdits s’ouvrent en HTTPS depuis le poste RH, quel que soit le navigateur. En HTTP le blocage fonctionne. Les journaux de Squid sont vides pour ces accès.'),
  cause: 'Deux causes cumulées : l’interception HTTPS (HTTPS/SSL Interception en mode Splice All) n’est pas activée, donc le trafic TCP 443 n’est jamais redirigé vers Squid ; et la règle Reject UDP 443 manque, donc les navigateurs passent par QUIC. Corriger une seule des deux laisse les sites accessibles.',
  solution: 'Activer HTTPS/SSL Interception en mode Splice All sur LAN avec une autorité de certification (CA-Proxy-Squid), et ajouter une règle Reject UDP 443 au-dessus du pass-all sur LAN. Retester Facebook et YouTube.',
  hints: ['Le blocage HTTP marche, le HTTPS non, et Squid ne voit rien : le trafic HTTPS n’arrive pas à Squid. Combien de chemins différents le navigateur a-t-il pour joindre un site en HTTPS ?', 'Deux chemins échappent à Squid : TCP 443 (redirection SSL absente dans Squid General) et UDP 443 (QUIC autorisé par la règle LAN). Corriger l’un laisse l’autre ouvert.', 'Squid General → HTTPS/SSL Interception : activer en mode Splice All sur LAN avec la CA ; Firewall → Rules → LAN : Reject UDP 443 au-dessus du pass-all ; retester les deux sites.'],
  inject: [
    { do: 'set', path: PC + '.proxy.enabled', value: false }, { do: 'push', path: PF + '.openvpn.cas', item: { name: 'CA-Proxy-Squid', expires: '2036-10-27' } },
    { do: 'set', path: SQ + '.transparent', value: true }, { do: 'set', path: SQ + '.transIfaces', value: ['lan'] },
    { do: 'set', path: SQ + '.ssl', value: { on: false, mode: 'splice', ifaces: ['lan'], port: 3129, ca: '' } }
  ],
  probes: [WIKI, NEVER, NO_FB, NO_YT, NO_FB_HTTP],
  roots: [{ path: SQ + '.ssl.on', eq: true }, QUIC_FB],
  fixes: {
    complete: [{ do: 'set', path: SQ + '.ssl', value: { on: true, mode: 'splice', ifaces: ['lan'], port: 3129, ca: 'CA-Proxy-Squid' } }, { do: 'set', path: PF + '.rules.lan', value: [QUIC_REJECT, LAN_PASS] }]
  },
  fix: [{ do: 'set', path: SQ + '.ssl', value: { on: true, mode: 'splice', ifaces: ['lan'], port: 3129, ca: 'CA-Proxy-Squid' } }, { do: 'set', path: PF + '.rules.lan', value: [QUIC_REJECT, LAN_PASS] }],
  workarounds: { proxy_explicite: CLIENT_PROXY_ON },
  traps: ['Après avoir ajouté la règle QUIC, Facebook est encore accessible : la tentation est de conclure que la règle est mal placée alors que l’interception SSL manque.', 'Imposer le proxy explicite dans le navigateur contourne l’objectif du mode transparent.'],
  optimal: ['Constater que le HTTPS n’est pas filtré', 'Squid General : interception SSL absente', 'Activer Splice All avec la CA', 'Reject UDP 443 en tête des règles LAN', 'Retester Facebook et YouTube'] });

/* ======================= CASCADE (plusieurs causes) ======================= */
add({ id: 'px_cascade', level: 4, title: 'Panne en cascade : Squid ne démarre pas, puis refuse les postes, puis bloque tout', skills: ['proxy', 'pfsense', 'diag'],
  ticket: tk(RH, 'Après la grosse modification du proxy, rien ne marche, même après un redémarrage', 'Bonjour, hier plusieurs réglages ont été modifiés d’un coup sur le proxy et le filtre. Ce matin le technicien dit avoir « tout redémarré » : au début mon navigateur ne trouvait plus le proxy, ensuite j’ai eu des pages d’accès refusé. Je n’ai toujours aucun site.'),
  cause: 'Trois défauts cumulés, révélés l’un après l’autre : la Blacklist de Squid contient l’entrée invalide « *.facebook.com » (Squid ne démarre pas) ; les « Allowed subnets » ne contiennent pas le réseau des postes (TCP_DENIED/403) ; et le filtre squidGuard est en « Default access [all] = deny » (tout est redirigé).',
  solution: 'Corriger la Blacklist (facebook.com), ajouter 10.10.0.0/16 aux Allowed subnets, repasser le Default access de squidGuard sur allow (Save puis Apply), puis retester Wikipédia, HTTP/HTTPS et le blocage des sites interdits.',
  hints: ['Chaque correction fait apparaître un nouveau symptôme : proxy injoignable, puis refus, puis blocage de tout. Traitez-les dans l’ordre où ils apparaissent et retestez à chaque étape.', 'Dans l’ordre : Status → Services (Squid arrêté, cause dans Cache Logs), Real Time (TCP_DENIED/403 pour l’IP du poste), squidGuard → Log → Blocked (règle default).', 'Blacklist : facebook.com ; ACLs : Allowed subnets 10.10.0.0/16 ; squidGuard Common ACL : Default access allow, puis Apply.'],
  inject: [{ do: 'set', path: SQ + '.acl.blacklist', value: ['*.facebook.com', 'youtube.com'] }, { do: 'set', path: SQ + '.acl.allowedSubnets', value: [] }, { do: 'set', path: SG + '.acl.default', value: 'deny' }],
  probes: [{ t: 'squid', run: true, label: 'Le service Squid démarre' }, WIKI, NEVER, NO_FB, NO_YT],
  roots: [{ probe: { t: 'squid', run: true } }, { any: [{ path: SQ + '.acl.allowedSubnets', has: '10.10.0.0/16' }, { path: SQ + '.acl.allowedSubnets', has: '10.10.20.0/24' }] }, { path: SG + '.acl.default', eq: 'allow' }],
  fix: [{ do: 'set', path: SQ + '.acl.blacklist', value: DEF_LIST }, { do: 'set', path: SQ + '.acl.allowedSubnets', value: ['10.10.0.0/16'] }, { do: 'set', path: SG + '.acl.default', value: 'allow' }],
  traps: ['S’arrêter à la première correction : Squid démarre mais le poste reste refusé.', 'Vider la Blacklist et la Whitelist pour « simplifier » rend YouTube accessible.'],
  optimal: ['Status → Services : Squid arrêté', 'Cache Logs : expression régulière invalide, corriger', 'Real Time : TCP_DENIED/403, ajouter le sous-réseau', 'squidGuard Log : règle default, repasser sur allow + Apply', 'Retester tous les cas'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
