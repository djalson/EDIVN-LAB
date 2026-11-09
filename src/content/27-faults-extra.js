/* ============================================================================
   Pannes — lot G : secondes pannes des compétences les moins couvertes (approbation AD, autorisation DHCP,
   sécurité de port, ACL POSIX, réseau Debian, nginx, scripts bash) et chaînes multi-causes de niveau 4.
   Données pures : la configuration est la vérité, les symptômes découlent des analyseurs du moteur.
   Les chaînes « multi_* » cumulent plusieurs causes indépendantes sur le même service : réparer une seule
   cause ne rétablit pas le service (le joueur doit retester après chaque correction).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
const LNX = 'SRV-LNX', WEB = 'SRV-WEB', PF_MAIN = 'pfsense-tls', PF_REMOTE = 'pfsense-bdx';
const DOM = 'toulouse.local', DOM_B = 'bordeaux.local';
const PORT = (sw, p) => sw + '.ports.' + p;
const reDhcp = h => [{ do: 'release', dev: h }, { do: 'renew', dev: h }];
const rep = (dev, path, from, to) => ({ do: 'lx.replace', dev, path, from, to });
const svc = (dev, name, op) => ({ do: 'lx.svc', dev, name, op });
const NGX = '/etc/nginx/sites-available/vitrine', APA = '/etc/apache2/sites-available/intranet.conf', SCRIPT = '/opt/scripts/backup.sh';
const CERT_META = WEB + ".tls['/etc/ssl/certs/vitrine.formatech.fr.crt']";
const HTTP_VITRINE = { t: 'http', from: 'PCEXT', url: 'https://vitrine.formatech.fr/' };
const HTTP_INTRA = { t: 'http', from: 'PC-01', url: 'http://intranet.toulouse.local/' };
const TR_DC1 = 'SRV-DC1.win.ad.trusts[target=' + DOM_B + '].direction', TR_DC2 = 'SRV-DC2.win.ad.trusts[target=' + DOM + '].direction';
const TRUST_OK = { t: 'trust', a: DOM, b: DOM_B, res: DOM, usr: DOM_B };
const SHARE_BDX = { t: 'share', from: 'PC-B1', user: 'e.garcia', unc: '\\\\srv-fic.toulouse.local\\Commun', want: 'write' };
const ENC0_MAIN = [{ id: 'i1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.20.0.0/16' }, dst: { t: 'net', v: '10.10.0.0/16' }, descr: 'IPsec Bordeaux → Toulouse' }];
const FWD_GOOD = [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.10', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }];
const FWD_BAD = [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.11', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }];
const SCOPE_RH = 'SRV-DC1.win.dhcp.scopes[id=10.10.20.0]';
const MSDCS = 'SRV-DC1.win.dns.zones[name=_msdcs.toulouse.local].records';
const PSEC_PRINTER = { enabled: true, max: 1, violation: 'shutdown', sticky: true, macs: ['B8-D8-48-71-96-61'] };
const NEW_MAC = 'B8-D8-48-71-99-99';
const FA5 = PORT('SW-T3', 'FastEthernet0/5');
const SHARE_COMPTA = 'SRV-FIC.win.shares[name=Compta].perms';

/* ======================= APPROBATION ACTIVE DIRECTORY : SENS ======================= */
add({ id: 'ad_trust_dir', level: 3, title: 'Approbation Toulouse ↔ Bordeaux dans le mauvais sens', skills: ['ad-trust', 'ntfs-partage', 'diag'],
  vary: { m: [
    { key: 'inverse', sets: [{ do: 'set', path: TR_DC1, value: 'inbound' }, { do: 'set', path: TR_DC2, value: 'outbound' }], fixes: [{ do: 'set', path: TR_DC1, value: 'bidirectional' }, { do: 'set', path: TR_DC2, value: 'bidirectional' }],
      alt: [{ do: 'set', path: TR_DC1, value: 'outbound' }, { do: 'set', path: TR_DC2, value: 'inbound' }], label: 'les deux extrémités de l’approbation ont été recréées dans le sens inverse (Toulouse « entrante », Bordeaux « sortante »)' },
    { key: 'toulouse', sets: [{ do: 'set', path: TR_DC1, value: 'inbound' }], fixes: [{ do: 'set', path: TR_DC1, value: 'bidirectional' }],
      alt: [{ do: 'set', path: TR_DC1, value: 'outbound' }], label: 'l’approbation est « entrante » côté Toulouse alors que Bordeaux la déclare bidirectionnelle' },
    { key: 'bordeaux', sets: [{ do: 'set', path: TR_DC2, value: 'outbound' }], fixes: [{ do: 'set', path: TR_DC2, value: 'bidirectional' }],
      alt: [{ do: 'set', path: TR_DC2, value: 'inbound' }], label: 'l’approbation est « sortante » côté Bordeaux alors que Toulouse la déclare bidirectionnelle' }
  ] },
  ticket: tk('Elena Garcia (Bordeaux)', 'Le dossier Commun de Toulouse refuse mon compte depuis la « remise en place » du lien', 'Bonjour, le technicien a recréé hier la relation entre nos deux domaines et m’a dit que « la validation est passée ». Pourtant, quand j’ouvre le dossier Commun du serveur de Toulouse depuis mon poste de Bordeaux, mon compte est refusé. Mon poste, lui, fonctionne normalement.', 'bordeaux'),
  cause: 'La relation d’approbation existe et se valide, mais son sens est faux : {{m.label}}. Pour que les utilisateurs de Bordeaux accèdent aux ressources de Toulouse, Toulouse doit approuver Bordeaux (sortante côté Toulouse) et Bordeaux doit déclarer l’approbation entrante.',
  solution: 'Recréer l’approbation (ou la corriger des deux côtés) avec la bonne direction : bidirectionnelle, ou sortante côté Toulouse et entrante côté Bordeaux. Retester l’accès à \\\\srv-fic.toulouse.local\\Commun depuis Bordeaux.',
  hints: ['La relation existe et le bouton Valider ne signale rien : cherchez ce qui n’est pas vérifié par la validation.', 'Domaines et approbations Active Directory sur les DEUX contrôleurs : comparez la colonne « Direction ». Qui approuve qui ?', 'Les utilisateurs de Bordeaux accèdent à une ressource de Toulouse : Toulouse doit avoir une approbation sortante vers Bordeaux, Bordeaux une entrante. Supprimez et recréez avec la direction voulue.'],
  inject: '{{m.sets}}',
  probes: [TRUST_OK, SHARE_BDX],
  roots: [{ probe: TRUST_OK }],
  fix: '{{m.fixes}}',
  fixes: { 'sens-minimal': '{{m.alt}}' },
  traps: ['Le bouton Valider répond que tout va bien : il vérifie que la relation existe et répond, pas que son sens autorise l’accès voulu.', 'Créer un compte local à Elena sur SRV-FIC contourne le problème en cassant la gestion centralisée des identités.'],
  optimal: ['Vérifier que le poste de Bordeaux et son DNS sont sains', 'Ouvrir Domaines et approbations sur les deux contrôleurs', 'Comparer les directions des deux extrémités', 'Recréer l’approbation dans le bon sens', 'Retester l’accès à \\\\srv-fic.toulouse.local\\Commun'] });

/* ======================= DHCP BORDEAUX NON AUTORISÉ ======================= */
add({ id: 'dhcp_unauth_bdx', level: 3, title: 'DHCP de Bordeaux non autorisé dans Active Directory', skills: ['dhcp-auth', 'dhcp', 'diag'],
  ticket: tk('Elena Garcia (Bordeaux)', 'Plus d’adresse réseau à Bordeaux depuis la restauration du serveur', 'Bonjour, depuis la restauration du serveur de Bordeaux ce week-end, mon poste affiche « Réseau non identifié » et je n’ai plus accès à rien. Le technicien dit que « le service DHCP tourne ».', 'bordeaux'),
  cause: 'Après la restauration, SRV-DC2 n’est plus autorisé comme serveur DHCP dans Active Directory : le service est démarré mais il ne répond plus aux clients (une erreur du journal DHCP-Server de SRV-DC2 le dit).',
  solution: 'Sur SRV-DC2, dans la console DHCP : clic droit sur le serveur → Autoriser. Puis renouveler le bail du poste de Bordeaux.',
  hints: ['Le service est démarré et l’étendue est active, pourtant le poste est en APIPA : qu’est-ce qui empêche le serveur de répondre ?', 'Sur SRV-DC2, ouvrez la console DHCP (flèche rouge sur le serveur ?) et le journal DHCP-Server de l’Observateur d’événements.', 'Autorisez le serveur dans Active Directory (clic droit → Autoriser) puis ipconfig /renew sur le poste.'],
  inject: [{ do: 'set', path: 'SRV-DC2.win.dhcp.authorized', value: false }, { do: 'svc', dev: 'SRV-DC2', name: 'DHCPServer', state: 'stopped' }, { do: 'svc', dev: 'SRV-DC2', name: 'DHCPServer', state: 'running' }].concat(reDhcp('PC-B1')),
  probes: [{ t: 'ip', host: 'PC-B1', net: '10.20.20.0/24' }, { t: 'ping', from: 'PC-B1', to: '10.20.10.10' }],
  roots: ['SRV-DC2/win/dhcp/authorized'],
  fix: [{ do: 'set', path: 'SRV-DC2.win.dhcp.authorized', value: true }, { do: 'renew', dev: 'PC-B1' }],
  workarounds: { ip_statique: [{ do: 'set', path: 'PC-B1.ifaces.Ethernet0.dhcp', value: false }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.ip', value: '10.20.20.77' }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.mask', value: '255.255.255.0' }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.gw', value: '10.20.20.1' }, { do: 'set', path: 'PC-B1.ifaces.Ethernet0.dns', value: ['10.20.10.10'] }] },
  traps: ['Redémarrer le service DHCP ou recréer l’étendue ne change rien : le problème est l’autorisation du serveur.', 'Une adresse statique sur le poste dépanne une personne mais pas le site.'],
  optimal: ['Constater l’APIPA du poste de Bordeaux', 'Console DHCP de SRV-DC2 : serveur non autorisé', 'Journal DHCP-Server : l’événement d’erreur du service', 'Clic droit → Autoriser', 'ipconfig /renew'] });

/* ======================= SÉCURITÉ DE PORT : IMPRIMANTE REMPLACÉE ======================= */
add({ id: 'c_portsec_imp', level: 3, title: 'Imprimante remplacée : le port est en err-disabled (port-security)', skills: ['switch-secu', 'vlan', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'L’imprimante du couloir n’est plus joignable depuis son remplacement', 'Bonjour, l’imprimante réseau du couloir a été remplacée hier (même modèle, mais livrée avec une nouvelle carte). Depuis, personne ne peut imprimer et le voyant de la prise est éteint côté mur. L’adresse IP est pourtant la même qu’avant.'),
  cause: 'La sécurité de port de Fa0/5 sur SW-T3 n’autorise que l’ancienne adresse MAC de l’imprimante (sticky) : la nouvelle carte réseau provoque une violation et le port passe en err-disabled.',
  solution: 'Effacer l’ancienne adresse sticky (ou autoriser la nouvelle, ou relever le maximum), puis réinitialiser le port (shutdown / no shutdown). Ne pas désactiver la sécurité de port.',
  hints: ['Le voyant de la prise est éteint côté commutateur et l’imprimante est allumée : regardez l’état du port sur SW-T3.', 'show interfaces status : err-disabled. show port-security interface Fa0/5 et le journal du commutateur donnent la cause et la MAC fautive.', 'Supprimez l’ancienne adresse (ou autorisez la nouvelle), puis shutdown / no shutdown sur Fa0/5.'],
  inject: [{ do: 'set', path: FA5 + '.psec', value: PSEC_PRINTER }, { do: 'set', path: 'IMP-T1.ifaces.eth0.mac', value: NEW_MAC }, { do: 'set', path: FA5 + '.errdisabled', value: true },
    { do: 'log', dev: 'SW-T3', chan: 'syslog', msg: '%PM-4-ERR_DISABLE: psecure-violation error detected on Fa0/5, putting Fa0/5 in err-disable state', ageSec: 900 },
    { do: 'log', dev: 'SW-T3', chan: 'syslog', msg: '%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address b8d8.4871.9999 on port FastEthernet0/5.', ageSec: 900 }],
  probes: [{ t: 'psec', dev: 'SW-T3', port: 'FastEthernet0/5' }, { t: 'ping', from: 'PC-02', to: '10.10.20.250' }],
  roots: [{ probe: { t: 'psec', dev: 'SW-T3', port: 'FastEthernet0/5' } }, { path: FA5 + '.psec.enabled', eq: true }],
  fix: [{ do: 'set', path: FA5 + '.psec.macs', value: [] }, { do: 'ios.recover', dev: 'SW-T3', port: 'FastEthernet0/5' }],
  fixes: { 'maximum': [{ do: 'set', path: FA5 + '.psec.max', value: 2 }, { do: 'ios.recover', dev: 'SW-T3', port: 'FastEthernet0/5' }],
    'nouvelle-mac': [{ do: 'set', path: FA5 + '.psec.macs', value: [NEW_MAC] }, { do: 'ios.recover', dev: 'SW-T3', port: 'FastEthernet0/5' }] },
  workarounds: { 'sans-securite': [{ do: 'set', path: FA5 + '.psec.enabled', value: false }, { do: 'ios.recover', dev: 'SW-T3', port: 'FastEthernet0/5' }] },
  traps: ['Un simple shutdown / no shutdown sans corriger l’adresse autorisée remet le port aussitôt en err-disabled.', 'Supprimer la sécurité de port rétablit l’impression mais retire la protection du port.'],
  optimal: ['show interfaces status : err-disabled', 'show port-security interface Fa0/5 / journal : violation', 'Effacer l’ancienne MAC sticky', 'shutdown puis no shutdown', 'Tester l’impression / le ping'] });

/* ======================= ACL POSIX : ENTRÉE NOMMÉE ======================= */
add({ id: 'lx_acl_user', level: 3, title: 'ACL POSIX : une entrée nommée prime sur le groupe', skills: ['lx-acl', 'lx-droits', 'diag'],
  vary: { m: [
    { key: 'lecture', perm: 'r-x', label: 'l’ACL du dossier contient user:tech:r-x (entrée nommée, ajoutée pour une lecture seule)' },
    { key: 'aucun', perm: '---', label: 'l’ACL du dossier contient user:tech:--- (entrée nommée de blocage, restée après un test)' }
  ] },
  ticket: tk('Marc Technicien (support)', 'Écriture refusée dans le dossier d’échange alors que je suis bien dans le groupe', 'Bonjour, je n’arrive plus à écrire dans /srv/echanges (« Permission denied ») alors que id tech me montre bien dans le groupe techs et que le dossier est en 770 pour ce groupe. Mes collègues du groupe écrivent sans problème.'),
  cause: 'Sur /srv/echanges, {{m.label}}. Une entrée d’ACL nommée est évaluée avant le groupe propriétaire : elle remplace les droits de groupe pour ce seul utilisateur, quels que soient les bits du mode.',
  solution: 'Supprimer l’entrée nommée (setfacl -x u:tech /srv/echanges) ou lui rendre rwx (setfacl -m u:tech:rwx), puis retester l’écriture. Ne pas passer le dossier en 777.',
  hints: ['Les droits classiques semblent corrects et les collègues du même groupe écrivent : ce qui diffère est propre à ce compte.', 'ls -ld /srv/echanges puis getfacl /srv/echanges : y a-t-il une ligne user:tech ? Quel est son ordre de priorité face à group::?', 'setfacl -x u:tech /srv/echanges retire l’entrée (le groupe reprend la main) ; ou setfacl -m u:tech:rwx.'],
  inject: [{ do: 'lx.acl', dev: LNX, path: '/srv/echanges', acl: { users: { tech: '{{m.perm}}' }, mask: 'rwx' } }],
  probes: [{ t: 'lxaccess', dev: LNX, user: 'tech', path: '/srv/echanges', mode: 'w' }],
  roots: [{ probe: { t: 'lxaccess', dev: LNX, user: 'tech', path: '/srv/echanges', mode: 'w' } }, { probe: { t: 'lxfile', dev: LNX, path: '/srv/echanges', modeIn: ['0770', '2770'] } }],
  fix: [{ do: 'lx.acl', dev: LNX, path: '/srv/echanges', acl: null }],
  fixes: { 'entree-rwx': [{ do: 'lx.acl', dev: LNX, path: '/srv/echanges', acl: { users: { tech: 'rwx' }, mask: 'rwx' } }] },
  traps: ['chmod 777 n’aide pas ici : l’entrée nommée de tech prime sur les droits « autres » (et ouvre le dossier à tout le monde).', 'Ajouter tech à un autre groupe ne change rien : l’entrée nommée l’emporte sur tous les groupes.'],
  optimal: ['ls -ld et id tech : droits cohérents', 'getfacl du dossier', 'Repérer l’entrée user:tech', 'setfacl -x ou -m', 'Retester en écriture'] });

/* ======================= RÉSEAU DEBIAN : RÉSOLUTION DE NOMS ======================= */
add({ id: 'lx_net_dns', level: 2, title: 'Serveur Linux : les noms du domaine ne se résolvent plus', skills: ['lx-reseau', 'dns', 'diag'],
  vary: { m: [
    { key: 'nameserver', file: '/etc/resolv.conf', from: 'nameserver 10.10.10.10', to: 'nameserver 10.10.10.11', root: { probe: { t: 'lxfile', dev: LNX, path: '/etc/resolv.conf', contains: 'nameserver 10.10.10.10' } }, label: 'resolv.conf désigne le serveur DNS 10.10.10.11 qui n’existe pas (au lieu de 10.10.10.10)' },
    { key: 'search', file: '/etc/resolv.conf', from: 'search toulouse.local\n', to: '', root: { probe: { t: 'lxfile', dev: LNX, path: '/etc/resolv.conf', contains: 'search toulouse.local' } }, label: 'la ligne « search toulouse.local » a disparu de resolv.conf : les noms courts ne sont plus complétés' },
    { key: 'hosts', file: '/etc/hosts', from: '::1\tlocalhost ip6-localhost ip6-loopback', to: '10.10.10.99\tsrv-fic srv-fic.toulouse.local\n::1\tlocalhost ip6-localhost ip6-loopback', root: { probe: { t: 'lxfile', dev: LNX, path: '/etc/hosts', absent: '10.10.10.99' } }, label: 'une ancienne ligne de /etc/hosts associe srv-fic à 10.10.10.99 et masque le DNS' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Depuis SRV-LNX, impossible de joindre le serveur de fichiers par son nom', 'Bonjour, sur le serveur Linux de l’intranet je n’arrive plus à joindre srv-fic par son nom (montage, sauvegarde, ping). Par adresse IP ça répond. Depuis les postes Windows, les noms fonctionnent.'),
  cause: 'Sur SRV-LNX, {{m.label}} : la résolution de noms du serveur Linux est cassée alors que le DNS du domaine fonctionne pour les autres machines.',
  solution: 'Corriger /etc/resolv.conf (nameserver 10.10.10.10 et search toulouse.local) ou supprimer l’entrée obsolète de /etc/hosts, puis retester avec getent hosts, host ou dig.',
  hints: ['Par IP ça répond, par nom non, mais le DNS fonctionne pour les postes : le problème est local à ce serveur.', 'cat /etc/resolv.conf et cat /etc/hosts, puis getent hosts srv-fic et host srv-fic.toulouse.local : comparez les résultats.', 'Rétablissez le nameserver et la ligne search, ou supprimez la ligne obsolète de /etc/hosts (qui prime sur le DNS).'],
  inject: [rep(LNX, '{{m.file}}', '{{m.from}}', '{{m.to}}')],
  probes: [{ t: 'resolve', from: LNX, name: 'srv-fic.toulouse.local', expect: '10.10.10.20' }, { t: 'resolve', from: LNX, name: 'srv-fic', expect: '10.10.10.20' }],
  roots: ['{{m.root}}'],
  fix: [rep(LNX, '{{m.file}}', '{{m.to}}', '{{m.from}}')],
  traps: ['Ajouter une ligne srv-fic dans /etc/hosts règle le symptôme sur ce serveur mais crée une seconde source de vérité à maintenir.'],
  optimal: ['Tester par IP puis par nom', 'Lire resolv.conf et hosts', 'Comparer getent hosts et host/dig', 'Corriger le fichier fautif', 'Retester avec le nom court et le nom complet'] });

/* ======================= NGINX : DROITS ET PORT ======================= */
add({ id: 'lx_nginx_perm', level: 3, title: 'nginx : site vitrine en 403 ou sur le mauvais port', skills: ['nginx', 'lx-droits', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'droits', inj: [{ do: 'lx.chown', dev: WEB, path: '/var/www/vitrine', owner: 'root', group: 'root' }, { do: 'lx.chmod', dev: WEB, path: '/var/www/vitrine', mode: '0700' }],
      fix: [{ do: 'lx.chmod', dev: WEB, path: '/var/www/vitrine', mode: '0755' }], alt: [{ do: 'lx.chown', dev: WEB, path: '/var/www/vitrine', owner: 'www-data', group: 'www-data' }, { do: 'lx.chmod', dev: WEB, path: '/var/www/vitrine', mode: '0750' }],
      roots: [{ probe: HTTP_VITRINE }, { probe: { t: 'lxfile', dev: WEB, path: '/var/www/vitrine', modeIn: ['0755', '0750', '0775'] } }], label: 'le dossier /var/www/vitrine appartient à root et est en 700 après une restauration : le compte www-data de nginx ne peut plus le parcourir (403 Forbidden, « Permission denied » dans error.log)' },
    { key: 'port', inj: [rep(WEB, NGX, 'listen 443 ssl;', 'listen 4443 ssl;'), svc(WEB, 'nginx', 'restart')],
      fix: [rep(WEB, NGX, 'listen 4443 ssl;', 'listen 443 ssl;'), svc(WEB, 'nginx', 'restart')], alt: [rep(WEB, NGX, 'listen 4443 ssl;', 'listen 443 ssl;'), svc(WEB, 'nginx', 'reload')],
      roots: ['SRV-WEB:/etc/nginx/sites-available/vitrine'], label: 'le bloc HTTPS écoute le port 4443 au lieu de 443 (nginx démarre sans erreur mais rien n’écoute sur 443)' }
  ] },
  ticket: tk('Direction commerciale', 'Le site vitrine ne répond plus correctement depuis la maintenance', 'Bonjour, depuis la maintenance de cette nuit, https://vitrine.formatech.fr affiche « 403 Forbidden » ou ne répond plus du tout. Le technicien dit que « nginx est bien démarré ».'),
  cause: 'Sur SRV-WEB (nginx, en DMZ), {{m.label}}.',
  solution: 'Lire le journal d’erreurs de nginx et l’état des ports (ss -tlnp), corriger le propriétaire / les droits du dossier ou le port d’écoute, puis recharger nginx et retester depuis l’extérieur.',
  hints: ['nginx est démarré : un service qui tourne ne veut pas dire qu’il sert la bonne chose sur le bon port. Notez le code ou l’erreur vue de l’extérieur.', 'ss -tlnp : quels ports écoute nginx ? ls -ld /var/www/vitrine et journalctl -u nginx / error.log donnent le propriétaire, le mode et le message exact.', 'Corrigez le port dans le vhost, ou le propriétaire/mode du dossier (pas de 777), puis nginx -t et systemctl reload nginx.'],
  inject: '{{m.inj}}',
  probes: [HTTP_VITRINE],
  roots: '{{m.roots}}',
  fix: '{{m.fix}}',
  fixes: { 'variante': '{{m.alt}}' },
  traps: ['chmod -R 777 /var/www règle le 403 mais donne l’écriture sur le site à tout compte du serveur.', 'Redémarrer nginx sans corriger la cause ne change rien.'],
  optimal: ['Tester depuis l’extérieur et noter l’erreur', 'ss -tlnp et journal nginx', 'Identifier le port ou les droits fautifs', 'Corriger puis nginx -t', 'Recharger et retester depuis l’extérieur'] });

/* ======================= SCRIPT BASH : SYNTAXE ======================= */
add({ id: 'lx_script_syntax', level: 3, title: 'Script de sauvegarde modifié : erreur de syntaxe bash', skills: ['bash', 'lx-droits', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'espaces', from: 'DEST=/var/backups/intranet', to: 'DEST = /var/backups/intranet', label: 'la ligne « DEST = /var/backups/intranet » contient des espaces autour du signe égal : bash cherche une commande nommée DEST (command not found)' },
    { key: 'guillemet', from: 'gzip > "$DEST/intranet-$(date +%F).sql.gz"', to: 'gzip > "$DEST/intranet-$(date +%F).sql.gz', label: 'un guillemet fermant est manquant sur la ligne gzip : bash ne trouve pas la fin de la chaîne (unexpected EOF while looking for matching `"\')' },
    { key: 'fi', from: 'mkdir -p "$DEST"\n', to: 'if [ ! -d "$DEST" ]; then\n\tmkdir -p "$DEST"\n', label: 'un bloc « if … then » a été ajouté sans « fi » de fermeture (syntax error: unexpected end of file)' },
    { key: 'faute', from: 'mysqldump intranet', to: 'mysqldmup intranet', label: 'la commande mysqldump est mal orthographiée (mysqldmup : command not found)' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'La sauvegarde de nuit échoue depuis que j’ai « amélioré » le script', 'Bonjour, j’ai retouché /opt/scripts/backup.sh hier soir (ajout d’une vérification) et depuis, plus aucune sauvegarde n’est créée dans /var/backups/intranet. La tâche cron est toujours là et le service tourne. Je ne vois aucune erreur.'),
  cause: 'Dans /opt/scripts/backup.sh, {{m.label}}. La tâche cron lance le script, mais celui-ci échoue avant d’écrire la sauvegarde ; la sortie d’erreur est perdue (pas de MTA).',
  solution: 'Vérifier la syntaxe avec bash -n /opt/scripts/backup.sh, lancer le script à la main pour lire le message, corriger la ligne fautive, puis vérifier qu’une exécution produit bien un fichier dans /var/backups/intranet.',
  hints: ['Le cron, le service et les droits sont intacts : la différence vient du contenu du script modifié hier.', 'Lancez /opt/scripts/backup.sh à la main et lisez le message (numéro de ligne) ; bash -n /opt/scripts/backup.sh contrôle la syntaxe sans exécuter.', 'Corrigez la ligne indiquée (espaces autour du =, guillemet, fi manquant ou nom de commande), puis relancez.'],
  inject: [rep(LNX, SCRIPT, '{{m.from}}', '{{m.to}}')],
  probes: [{ t: 'cronjob', dev: LNX, file: '/etc/cron.d/backup-intranet' }],
  roots: [{ probe: { t: 'cronjob', dev: LNX, file: '/etc/cron.d/backup-intranet' } }],
  fix: [rep(LNX, SCRIPT, '{{m.to}}', '{{m.from}}')],
  traps: ['Lancer le script à la main une fois ne corrige pas la tâche planifiée si le fichier reste fautif.', 'Supprimer la ligne fautive fait disparaître l’erreur mais retire une étape de la sauvegarde.'],
  optimal: ['Exécuter le script à la main', 'Lire le message et le numéro de ligne', 'bash -n pour confirmer la syntaxe', 'Corriger la ligne', 'Retester la tâche'] });

/* ======================= CHAÎNES MULTI-CAUSES (NIVEAU 4) ======================= */
add({ id: 'multi_share', level: 4, title: 'Dossier Compta : groupe retiré ET partage en lecture seule', skills: ['agdlp', 'ntfs-partage', 'ad-compte', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le dossier Compta est inaccessible, puis en lecture seule', 'Bonjour, ce matin je n’avais plus accès au dossier Compta. Un collègue a « tout remis en ordre » mais je ne peux toujours pas enregistrer mes fichiers. Je n’ai changé aucun mot de passe.'),
  cause: 'Deux causes indépendantes : GG_Compta a été retiré de DL_Compta_RW (le groupe local de domaine qui porte la permission NTFS) et les autorisations du partage \\\\SRV-FIC\\Compta sont passées en lecture seule. Corriger l’une des deux laisse le dossier inutilisable en écriture.',
  solution: 'Remettre GG_Compta dans DL_Compta_RW, rétablir les autorisations du partage (Utilisateurs authentifiés : Modifier), puis faire fermer/rouvrir la session pour actualiser le jeton.',
  hints: ['Corriger une chose ne suffit pas toujours : après chaque correction, retestez et regardez si le message d’erreur change.', 'Deux couches décident de l’accès : les autorisations du partage ET la sécurité NTFS (via AGDLP). Vérifiez l’une puis l’autre.', 'Vérifiez l’appartenance de GG_Compta à DL_Compta_RW, puis les autorisations du partage ; terminez en rouvrant la session.'],
  inject: [{ do: 'ad.member.del', domain: DOM, group: 'DL_Compta_RW', member: 'GG_Compta' }, { do: 'set', path: SHARE_COMPTA, value: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }],
  probes: [{ t: 'share', from: 'PC-01', user: 'a.martin', unc: '\\\\SRV-FIC\\Compta', want: 'write' }],
  roots: [{ path: 'SRV-DC1.win.ad.groups[name=DL_Compta_RW].members', has: 'GG_Compta' }, { probe: { t: 'share', from: 'PC-ADM', user: 'tssr', unc: '\\\\SRV-FIC\\Compta', want: 'write' } }],
  fix: [{ do: 'ad.member.add', domain: DOM, group: 'DL_Compta_RW', member: 'GG_Compta' }, { do: 'set', path: SHARE_COMPTA, value: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }] }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }],
  traps: ['Ajouter Alice directement dans l’ACL NTFS contourne le groupe et détruit le modèle AGDLP.', 'Donner « Contrôle total » à Tout le monde sur le partage règle le symptôme mais ouvre trop large.', 'Ré-ajouter au groupe sans faire rouvrir la session ne suffit pas : le jeton d’accès est figé à l’ouverture.'],
  optimal: ['Constater le refus', 'Vérifier le groupe AGDLP', 'Corriger l’appartenance', 'Retester : nouveau message (lecture seule)', 'Vérifier le partage et le corriger', 'Rouvrir la session et retester'] });

add({ id: 'multi_site_bdx', level: 4, title: 'Lien Toulouse–Bordeaux : sélecteur de phase 2 ET règles IPsec vides', skills: ['ipsec', 'pfsense', 'subnetting', 'pare-feu-etats', 'diag'],
  ticket: tk('Elena Garcia (Bordeaux)', 'Après la maintenance du lien, Bordeaux ne voit toujours pas Toulouse', 'Bonjour, le technicien est intervenu hier sur les pare-feu pour « remettre le VPN ». Le statut a changé deux fois mais je n’accède toujours à aucun serveur de Toulouse depuis mon poste. Les deux sites ont Internet.', 'bordeaux'),
  cause: 'Deux causes cumulées : la phase 2 IPsec de Bordeaux annonce 10.20.0.0/24 au lieu de 10.20.0.0/16 (TS_UNACCEPTABLE), et l’onglet IPsec de Toulouse ne contient plus de règle de passage. Réparer la phase 2 fait monter le tunnel mais le trafic reste bloqué par le refus implicite.',
  solution: 'Aligner la phase 2 de Bordeaux (réseau local 10.20.0.0/16) et recréer la règle de passage de l’onglet IPsec de Toulouse (10.20.0.0/16 → 10.10.0.0/16). Retester le ping inter-sites.',
  hints: ['Un statut qui change n’est pas la preuve que le trafic passe : testez par un ping entre sites après chaque correction.', 'Status → IPsec (phase 2 présente ?), puis Status → System Logs → Firewall : des blocages sur l’interface IPsec ?', 'Deux endroits à corriger : la phase 2 de Bordeaux (sélecteurs miroirs) et Firewall → Rules → IPsec à Toulouse.'],
  inject: [{ do: 'set', path: PF_REMOTE + '.ipsec.tunnels[0].p2[0].local', value: '10.20.0.0/24' }, { do: 'set', path: PF_MAIN + '.rules.enc0', value: [] }],
  probes: [{ t: 'ipsec', dev: PF_MAIN }, { t: 'ping', from: 'PC-B1', to: '10.10.10.10' }],
  roots: [{ path: PF_REMOTE + '.ipsec.tunnels[0].p2[0].local', eq: '10.20.0.0/16' }, PF_MAIN + '/canon/rules/enc0'],
  fix: [{ do: 'set', path: PF_REMOTE + '.ipsec.tunnels[0].p2[0].local', value: '10.20.0.0/16' }, { do: 'set', path: PF_MAIN + '.rules.enc0', value: ENC0_MAIN }],
  traps: ['Se focaliser sur la clé pré-partagée est inutile : l’authentification (phase 1) est bonne.', 'Ouvrir tout le trafic entrant sur l’onglet IPsec « pour tester » expose le réseau.'],
  optimal: ['Status IPsec : phase 2 absente', 'Journal IPsec : TS_UNACCEPTABLE', 'Corriger le sélecteur de phase 2', 'Retester : le tunnel monte mais rien ne passe', 'Journal du pare-feu : blocage sur IPsec', 'Recréer la règle IPsec de Toulouse', 'Retester le ping inter-sites'] });

add({ id: 'multi_vitrine', level: 4, title: 'Site vitrine : redirection de port, certificat expiré ET racine nginx', skills: ['pfsense', 'portfwd', 'nginx', 'diag'],
  ticket: tk('Direction commerciale', 'Notre site vitrine est tombé après le week-end, puis affiche autre chose', 'Bonjour, le site https://vitrine.formatech.fr ne répondait plus lundi matin. Après une première intervention, il répond mais le navigateur affiche une alerte de sécurité, et quand on passe outre, une page d’erreur. Pouvez-vous tout regarder ?'),
  cause: 'Trois causes cumulées : la redirection de port du pare-feu pointe vers 10.10.50.11 au lieu de 10.10.50.10, le certificat de vitrine.formatech.fr a expiré le 2026-10-01, et la directive root du vhost nginx pointe vers /var/www/vitrin (inexistant, 404).',
  solution: 'Corriger la cible de la redirection (10.10.50.10:443), renouveler le certificat, corriger root dans le vhost puis nginx -t et recharger. Retester depuis l’extérieur après chaque correction.',
  hints: ['Un seul symptôme visible à la fois, mais plusieurs causes : corrigez, retestez de l’extérieur, relisez l’erreur et recommencez.', 'D’abord « ça ne répond pas » (pare-feu / NAT), puis « alerte de sécurité » (certificat : dates), puis « page d’erreur » (nginx : root, journal d’erreurs).', 'Port Forward → cible 10.10.50.10 ; certificat de SRV-WEB : date de fin ; nginx -t et error.log pour la racine.'],
  inject: [{ do: 'set', path: PF_MAIN + '.nat.portfwd', value: FWD_BAD }, { do: 'set', path: CERT_META + '.notAfter', value: '2026-10-01' }, rep(WEB, NGX, 'root /var/www/vitrine;', 'root /var/www/vitrin;'), svc(WEB, 'nginx', 'reload')],
  probes: [HTTP_VITRINE],
  roots: [PF_MAIN + '/canon/nat/portfwd', { path: CERT_META + '.notAfter', gt: '2026-10-27' }, 'SRV-WEB:/etc/nginx/sites-available/vitrine'],
  fix: [{ do: 'set', path: PF_MAIN + '.nat.portfwd', value: FWD_GOOD }, { do: 'set', path: CERT_META + '.notAfter', value: '2027-10-01' }, rep(WEB, NGX, 'root /var/www/vitrin;', 'root /var/www/vitrine;'), svc(WEB, 'nginx', 'reload')],
  traps: ['Installer un certificat auto-signé pour faire disparaître l’alerte remplace une erreur par une autre.', 'Ouvrir toutes les entrées WAN pour « tester » expose le réseau.'],
  optimal: ['Tester depuis l’extérieur (échec)', 'Journal du pare-feu / Port Forward : corriger la cible', 'Retester : alerte de certificat', 'Corriger le certificat', 'Retester : erreur 404', 'nginx -t / error.log : corriger root', 'Recharger et retester'] });

add({ id: 'multi_postes_rh', level: 4, title: 'Postes RH : DNS distribué erroné ET enregistrements SRV du contrôleur absents', skills: ['dhcp', 'dns', 'ad-install', 'ad-compte', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Le domaine est introuvable depuis ce matin et mes dossiers aussi', 'Bonjour, depuis ce matin mon poste ne trouve plus le domaine et je ne peux pas ouvrir les dossiers du serveur, alors qu’Internet fonctionne. Un collègue a « nettoyé le DNS » et changé « un truc dans le DHCP » avant de partir.'),
  cause: 'Deux causes cumulées : l’option 006 de l’étendue du VLAN 20 distribue 8.8.8.8 au lieu du DNS interne 10.10.10.10, et les enregistrements SRV du contrôleur (_ldap, _kerberos) ont été supprimés de la zone _msdcs. Corriger seulement le DNS distribué laisse le poste incapable de localiser le contrôleur de domaine.',
  solution: 'Remettre l’option 006 = 10.10.10.10 dans l’étendue et renouveler le bail ; faire ré-enregistrer le contrôleur (nltest /dsregdns ou redémarrage de Netlogon) ; vérifier la zone _msdcs puis retester la session.',
  hints: ['Internet marche mais pas le domaine : commencez par ce que le poste interroge comme DNS (ipconfig /all) et par ce qu’il obtient comme réponse.', 'Une fois le bon DNS en place, nslookup -type=SRV _ldap._tcp.dc._msdcs.toulouse.local : la réponse est-elle correcte ?', 'Option 006 dans la console DHCP puis ipconfig /renew ; ensuite nltest /dsregdns (ou Netlogon) sur le contrôleur pour recréer les SRV.'],
  inject: [{ do: 'set', path: SCOPE_RH + '.options.6', value: '8.8.8.8' }, { do: 'del', path: MSDCS + '[name=_ldap._tcp.dc]' }, { do: 'del', path: MSDCS + '[name=_kerberos._tcp.dc]' }].concat(reDhcp('PC-02')),
  probes: [{ t: 'resolve', from: 'PC-02', name: 'srv-fic', expect: '10.10.10.20' }, { t: 'dc', host: 'PC-02' }],
  roots: [{ path: SCOPE_RH + '.options.6', eq: '10.10.10.10' }, { path: MSDCS + '[name=_ldap._tcp.dc].name', eq: '_ldap._tcp.dc' }],
  fix: [{ do: 'set', path: SCOPE_RH + '.options.6', value: '10.10.10.10' }, { do: 'ad.regdns', dev: 'SRV-DC1' }, { do: 'renew', dev: 'PC-02' }],
  traps: ['Saisir le DNS dans la carte réseau règle un poste mais pas les autres, et ne rétablit pas les SRV manquants.', 'Recréer à la main un enregistrement A pour le contrôleur ne suffit pas : ce sont les SRV qui permettent la localisation.'],
  optimal: ['ipconfig /all : DNS 8.8.8.8', 'Console DHCP : option 006', 'Corriger puis ipconfig /renew', 'Retester : le domaine reste introuvable', 'nslookup -type=SRV : absent', 'Ré-enregistrer le contrôleur', 'Retester la session'] });

add({ id: 'multi_intranet', level: 4, title: 'Intranet : directive Apache fautive ET règle UFW du port 80 supprimée', skills: ['lamp', 'lx-services', 'lx-secu', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'L’intranet ne répond plus après les interventions sur le serveur Linux', 'Bonjour, l’intranet est inaccessible depuis hier soir. L’admin TSSR dit avoir « corrigé Apache » ce matin, mais ça ne marche toujours pas. Quelqu’un a aussi « fait du ménage dans le pare-feu » du serveur.'),
  cause: 'Deux causes cumulées : la directive DocumentRoot du vhost est mal orthographiée (apache2 ne démarre plus) et la règle UFW qui autorisait le port 80 a été supprimée. Corriger seulement Apache rend le service actif mais le pare-feu du serveur bloque toujours les clients.',
  solution: 'Corriger la ligne fautive (apachectl configtest) et redémarrer apache2, puis rétablir la règle UFW 80/tcp (ufw allow 80/tcp). Retester depuis un poste.',
  hints: ['Corriger le service ne prouve rien tant qu’un poste n’a pas retesté : testez après chaque correction.', 'systemctl status apache2 et apachectl configtest pour le service ; ss -tlnp puis ufw status numbered pour le pare-feu local.', 'Corrigez la directive, redémarrez Apache, puis ufw allow 80/tcp et retestez depuis un poste.'],
  inject: [rep(LNX, APA, 'DocumentRoot /var/www/intranet\n\n', 'DocumentRot /var/www/intranet\n\n'), svc(LNX, 'apache2', 'restart'), { do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' } }],
  probes: [HTTP_INTRA],
  roots: [{ probe: { t: 'cfgcheck', dev: LNX, svc: 'apache2' } }, { probe: { t: 'lxufw', dev: LNX, port: 80, from: '10.10.20.5' } }],
  fix: [rep(LNX, APA, 'DocumentRot /var/www/intranet\n\n', 'DocumentRoot /var/www/intranet\n\n'), svc(LNX, 'apache2', 'restart'), { do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' } }],
  traps: ['ufw disable règle le blocage mais supprime toute la protection du serveur.', 'Activer un module Apache ne règle pas une faute de frappe dans une directive.'],
  optimal: ['systemctl status apache2', 'apachectl configtest : corriger la ligne', 'Redémarrer et retester depuis un poste (échec)', 'ufw status : port 80 absent', 'ufw allow 80/tcp', 'Retester depuis un poste'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
