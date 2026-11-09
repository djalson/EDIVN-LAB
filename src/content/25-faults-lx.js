/* ============================================================================
   Pannes — lot E : serveurs Debian 13 (SRV-LNX intranet/DNS/BDD, SRV-WEB vitrine DMZ).
   SSH, services, UFW, MariaDB, cron/bash, droits POSIX + ACL, Bind9, Apache, nginx, stockage, réseau.
   Données pures : la configuration est la vérité, les symptômes découlent des analyseurs du moteur.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
const LNX = 'SRV-LNX', WEB = 'SRV-WEB';
const KEY_PCADM = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJd4s5mUlA0xT8n1Qw7kYb2GfHc9RpVoXe3ZtNqLmSuA tssr@PC-ADM';
const SSH_PROBE = [{ t: 'ssh', from: 'PC-ADM', to: '10.10.10.30', user: 'tssr', method: 'key' }];
const HTTP_INTRA = { t: 'http', from: 'PC-01', url: 'http://intranet.toulouse.local/' };
const HTTP_INTRA_ADM = { t: 'http', from: 'PC-ADM', url: 'http://intranet.toulouse.local/' };
const HTTP_VITRINE = { t: 'http', from: 'PCEXT', url: 'https://vitrine.formatech.fr/' };
const GESTION_VERIFY = ['http:PC-*:http://gestion.toulouse.local*'];   // D-103 / D-76 : la clôture exige l'observation de l'application de gestion depuis un poste client
const DB_PROBE = { t: 'dblogin', from: 'SRV-FIC', to: '10.10.10.30', user: 'intranet', db: 'intranet' };
const RES_WWW = { t: 'resolve', from: 'PC-ADM', name: 'www.labo.toulouse.local', expect: '10.10.10.30' };
const RES_INTRA = { t: 'resolve', from: 'PC-ADM', name: 'intra.labo.toulouse.local', expect: '10.10.10.30' };
const svc = (dev, name, op) => ({ do: 'lx.svc', dev, name, op });
const stopInj = (dev, name, dis) => dis ? [svc(dev, name, 'stop'), svc(dev, name, 'disable')] : [svc(dev, name, 'stop')];
const rep = (dev, path, from, to) => ({ do: 'lx.replace', dev, path, from, to });
const SSHD = '/etc/ssh/sshd_config', APA = '/etc/apache2/sites-available/intranet.conf', NGX = '/etc/nginx/sites-available/vitrine';
const NAMED_LOCAL = '/etc/bind/named.conf.local', NAMED_OPT = '/etc/bind/named.conf.options', ZONE = '/etc/bind/db.labo.toulouse.local';
const CERT_META = WEB + ".tls['/etc/ssl/certs/vitrine.formatech.fr.crt']";

/* ======================= SERVICES (niveau 1) ======================= */
add({ id: 'lx_svc_stopped', level: 1, title: 'Service Linux arrêté', skills: ['lx-services', 'diag'],
  vary: { m: [
    { key: 'ssh', verify: [], inj: stopInj(LNX, 'ssh', false), dev: LNX, name: 'ssh', label: 'le service SSH', t: 'Je n’arrive plus à me connecter en SSH au serveur Linux de l’intranet (la connexion est refusée). Hier tout fonctionnait.', probes: SSH_PROBE, roots: [{ probe: { t: 'svc', dev: LNX, name: 'ssh' } }], from: 'Admin TSSR (informatique)', subj: 'Plus de SSH sur le serveur Linux' },
    { key: 'apache2', verify: [], inj: stopInj(LNX, 'apache2', false), dev: LNX, name: 'apache2', label: 'le service Apache', t: 'Le site intranet affiche « impossible de se connecter » depuis ce matin. Le serveur répond pourtant au ping.', probes: [HTTP_INTRA], roots: [{ probe: { t: 'svc', dev: LNX, name: 'apache2' } }], from: 'Alice Martin (la comptabilité)', subj: 'L’intranet ne s’ouvre plus' },
    { key: 'nginx', verify: [], inj: stopInj(WEB, 'nginx', false), dev: WEB, name: 'nginx', label: 'le service nginx', t: 'Notre site vitrine n’est plus accessible depuis Internet depuis la nuit dernière.', probes: [HTTP_VITRINE], roots: [{ probe: { t: 'svc', dev: WEB, name: 'nginx' } }], from: 'Direction commerciale', subj: 'Le site vitrine est inaccessible' },
    { key: 'bind9', verify: [], inj: stopInj(LNX, 'bind9', false), dev: LNX, name: 'bind9', label: 'le service Bind9 (named)', t: 'Les adresses en « .labo.toulouse.local » ne se résolvent plus depuis ce matin, alors que le reste du réseau fonctionne.', probes: [RES_WWW], roots: [{ probe: { t: 'svc', dev: LNX, name: 'bind9' } }], from: 'Admin TSSR (informatique)', subj: 'Les noms du laboratoire ne se résolvent plus' },
    { key: 'mariadb', verify: GESTION_VERIFY, inj: stopInj(LNX, 'mariadb', false), dev: LNX, name: 'mariadb', label: 'le service MariaDB', t: 'L’application de gestion affiche « erreur de connexion à la base de données ». Le serveur Linux est pourtant allumé. L’application s’ouvre à l’adresse http://gestion.toulouse.local/.', probes: [DB_PROBE], roots: [{ probe: { t: 'svc', dev: LNX, name: 'mariadb' } }], from: 'Alice Martin (la comptabilité)', subj: 'Erreur de connexion à la base de données' },
    { key: 'mariadb-dis', verify: GESTION_VERIFY, inj: stopInj(LNX, 'mariadb', true), dev: LNX, name: 'mariadb', label: 'le service MariaDB (arrêté ET désactivé : il ne repartira pas au prochain redémarrage)', t: 'L’application de gestion ne se connecte plus à la base depuis le redémarrage du serveur d’hier soir. L’application s’ouvre à l’adresse http://gestion.toulouse.local/.', probes: [DB_PROBE], roots: [{ probe: { t: 'svc', dev: LNX, name: 'mariadb' } }, { path: LNX + '.svc.mariadb.enabled', eq: true }], from: 'Alice Martin (la comptabilité)', subj: 'Base de données injoignable depuis le redémarrage' }
  ] },
  ticket: { from: '{{m.from}}', subject: '{{m.subj}}', body: '{{m.t}}', site: 'toulouse' },
  cause: 'Dans systemd, {{m.label}} sur {{m.dev}} est arrêté : plus rien n’écoute sur son port.',
  solution: 'Démarrer le service (systemctl start), lire le journal pour comprendre pourquoi il était arrêté et, si besoin, l’activer au démarrage (systemctl enable).',
  hints: ['Le serveur répond au ping mais le service ne répond pas : regardez l’état du service avec systemctl status.', 'systemctl status <service> indique « inactive (dead) » ; journalctl -u <service> donne la raison de l’arrêt.', 'Démarrez le service avec systemctl start. S’il doit repartir seul après un redémarrage, ajoutez systemctl enable.'],
  inject: '{{m.inj}}',
  probes: '{{m.probes}}',
  verify: '{{m.verify}}',
  roots: '{{m.roots}}',
  fix: [{ do: 'lx.svc', dev: '{{m.dev}}', name: '{{m.name}}', op: 'start' }, { do: 'lx.svc', dev: '{{m.dev}}', name: '{{m.name}}', op: 'enable' }],
  traps: ['Redémarrer le serveur entier règle le symptôme sans comprendre pourquoi le service était arrêté (et ne marche pas s’il est désactivé).'],
  optimal: ['Constater que la machine répond mais pas le service', 'systemctl status du service', 'Lire le journal (journalctl -u)', 'systemctl start (et enable si besoin)', 'Retester depuis un poste'] });

/* ======================= SSH ======================= */
add({ id: 'lx_ssh_conf', level: 2, title: 'SSH : sshd ne redémarre plus après une modification de configuration', skills: ['lx-ssh', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'directive', from: 'PermitRootLogin prohibit-password', to: 'PermitRootLogn prohibit-password', label: 'une directive est mal orthographiée (PermitRootLogn)' },
    { key: 'port', from: 'Port 22\n', to: 'Port 220000\n', label: 'le numéro de port saisi est invalide (220000)' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'SSH ne répond plus depuis ma modification de la configuration', 'Bonjour, j’ai modifié la configuration de SSH sur le serveur Linux de l’intranet hier soir et redémarré le service. Depuis, impossible de me reconnecter à distance. J’ai encore la console ouverte mais je ne vois pas ce qui cloche.'),
  cause: 'Dans /etc/ssh/sshd_config, {{m.label}} : sshd refuse de démarrer (« Bad configuration option » / « Badly formatted port number ») après le redémarrage et plus rien n’écoute sur le port 22.',
  solution: 'Tester la configuration (sshd -t), corriger la ligne fautive, puis redémarrer le service ssh.',
  hints: ['Le service a été redémarré après la modification : regardez s’il est réellement actif.', 'systemctl status ssh puis journalctl -u ssh : le message désigne la ligne fautive. sshd -t teste la configuration.', 'Corrigez la ligne puis systemctl restart ssh.'],
  inject: [rep(LNX, SSHD, '{{m.from}}', '{{m.to}}'), svc(LNX, 'ssh', 'restart')],
  probes: SSH_PROBE,
  roots: [{ probe: { t: 'cfgcheck', dev: LNX, svc: 'ssh' } }],
  fix: [rep(LNX, SSHD, '{{m.to}}', '{{m.from}}'), svc(LNX, 'ssh', 'restart')],
  traps: ['Relancer le service sans corriger le fichier échoue de nouveau.', 'Réinstaller le paquet openssh-server écraserait la configuration.'],
  optimal: ['systemctl status ssh : failed', 'journalctl -u ssh : message sur la ligne', 'sshd -t', 'Corriger la ligne', 'Redémarrer et tester'] });

add({ id: 'lx_ssh_allowusers', level: 2, title: 'SSH : compte absent de AllowUsers', skills: ['lx-ssh', 'lx-secu', 'diag'],
  vary: { m: [
    { key: 'tech', line: 'AllowUsers tech\n', good: 'AllowUsers tssr tech\n', label: 'la directive AllowUsers ne liste que « tech »' },
    { key: 'faute', line: 'AllowUsers tssi tech\n', good: 'AllowUsers tssr tech\n', label: 'la directive AllowUsers contient « tssi » (faute de frappe) au lieu de « tssr »' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Mon compte est refusé en SSH depuis le durcissement', 'Bonjour, depuis les modifications de sécurité de cet après-midi sur le serveur Linux, mon compte tssr est refusé en SSH (« Permission denied »), avec la bonne clé. Le collègue « tech » arrive à se connecter.'),
  cause: 'Dans /etc/ssh/sshd_config, {{m.label}} : les autres comptes sont refusés avant même l’authentification (journal : « User tssr … not allowed because not listed in AllowUsers »).',
  solution: 'Ajouter le compte à la directive AllowUsers (ou la supprimer), puis recharger sshd (systemctl reload ssh).',
  hints: ['La clé est bonne mais la connexion est refusée : le refus vient d’une règle côté serveur, pas de l’authentification.', 'journalctl -u ssh : cherchez « not allowed because not listed in AllowUsers ».', 'Corrigez AllowUsers dans /etc/ssh/sshd_config puis systemctl reload ssh.'],
  inject: [{ do: 'lx.append', dev: LNX, path: SSHD, content: '{{m.line}}' }, svc(LNX, 'ssh', 'reload')],
  probes: SSH_PROBE,
  roots: [{ any: [{ probe: { t: 'lxcfg', dev: LNX, parse: 'sshd', get: 'allowUsers', has: 'tssr' } }, { probe: { t: 'lxcfg', dev: LNX, parse: 'sshd', get: 'allowUsers', isNull: true } }] }, { probe: { t: 'lxfresh', dev: LNX, svc: 'ssh' } }],
  fix: [rep(LNX, SSHD, '{{m.line}}', '{{m.good}}'), svc(LNX, 'ssh', 'reload')],
  traps: ['Remettre PermitRootLogin ou ouvrir l’authentification par mot de passe n’a aucun rapport avec ce refus.'],
  optimal: ['Constater que la clé est bonne', 'journalctl -u ssh : AllowUsers', 'Corriger la directive', 'Recharger ssh', 'Retester'] });

add({ id: 'lx_ssh_auth_pw', level: 2, title: 'SSH : authentification par mot de passe désactivée', skills: ['lx-ssh', 'lx-secu', 'diag'],
  ticket: tk('Marc Technicien (support)', 'Je ne peux plus me connecter en SSH avec mon mot de passe', 'Bonjour, depuis le durcissement du serveur Linux cette nuit, ma connexion SSH avec le compte « tech » est refusée avec le message « Permission denied (publickey) ». Mon mot de passe est pourtant correct.'),
  cause: 'PasswordAuthentication est passé à « no » dans sshd_config alors que le compte « tech » n’a aucune clé publique dans ~/.ssh/authorized_keys : seule l’authentification par clé est acceptée.',
  solution: 'Soit réactiver PasswordAuthentication (si la politique le permet), soit — mieux — déployer la clé publique du poste d’administration dans ~tech/.ssh/authorized_keys.',
  hints: ['Le message « Permission denied (publickey) » indique que seule la clé est proposée par le serveur.', 'Regardez PasswordAuthentication dans /etc/ssh/sshd_config, et si le compte a une clé dans ~/.ssh/authorized_keys.', 'Réactivez le mot de passe ou déposez la clé publique du client dans authorized_keys (droits 600/700).'],
  inject: [rep(LNX, SSHD, 'PasswordAuthentication yes', 'PasswordAuthentication no'), svc(LNX, 'ssh', 'reload')],
  probes: [{ t: 'ssh', from: 'PC-ADM', to: '10.10.10.30', user: 'tech', method: 'any' }],
  roots: [{ any: [{ probe: { t: 'lxcfg', dev: LNX, parse: 'sshd', get: 'passwordAuth', eq: true } }, { probe: { t: 'lxfile', dev: LNX, path: '/home/tech/.ssh/authorized_keys', contains: KEY_PCADM } }] }, { probe: { t: 'lxfresh', dev: LNX, svc: 'ssh' } }],
  fix: [rep(LNX, SSHD, 'PasswordAuthentication no', 'PasswordAuthentication yes'), svc(LNX, 'ssh', 'reload')],
  fixes: { cle: [{ do: 'lx.mkdir', dev: LNX, path: '/home/tech/.ssh', m: '0700', o: 'tech', g: 'tech' }, { do: 'lx.write', dev: LNX, path: '/home/tech/.ssh/authorized_keys', content: KEY_PCADM + '\n', m: '0600', o: 'tech', g: 'tech' }] },
  traps: ['Autoriser la connexion root par mot de passe élargit la surface d’attaque sans rien résoudre.'],
  optimal: ['Lire le message d’erreur (publickey)', 'Lire sshd_config', 'Choisir : réactiver le mot de passe ou déployer la clé', 'Recharger ssh', 'Retester'] });

add({ id: 'lx_ssh_keyperm', level: 3, title: 'SSH : clé refusée à cause des droits (StrictModes)', skills: ['lx-ssh', 'lx-droits', 'diag'],
  vary: { m: [
    { key: 'home', path: '/home/tssr', bad: { do: 'lx.chmod', dev: LNX, path: '/home/tssr', mode: '0777' }, good: { do: 'lx.chmod', dev: LNX, path: '/home/tssr', mode: '0750' }, label: 'le répertoire personnel /home/tssr est ouvert en écriture à tous (777)' },
    { key: 'home-g', path: '/home/tssr', bad: { do: 'lx.chmod', dev: LNX, path: '/home/tssr', mode: '0775' }, good: { do: 'lx.chmod', dev: LNX, path: '/home/tssr', mode: '0750' }, label: 'le répertoire personnel /home/tssr est modifiable par le groupe (775)' },
    { key: 'ssh', path: '/home/tssr/.ssh', bad: { do: 'lx.chmod', dev: LNX, path: '/home/tssr/.ssh', mode: '0770' }, good: { do: 'lx.chmod', dev: LNX, path: '/home/tssr/.ssh', mode: '0700' }, label: 'le répertoire ~/.ssh est modifiable par le groupe (770)' },
    { key: 'ak', path: '/home/tssr/.ssh/authorized_keys', bad: { do: 'lx.chmod', dev: LNX, path: '/home/tssr/.ssh/authorized_keys', mode: '0666' }, good: { do: 'lx.chmod', dev: LNX, path: '/home/tssr/.ssh/authorized_keys', mode: '0600' }, label: 'le fichier authorized_keys est modifiable par tout le monde (666)' },
    { key: 'owner', path: '/home/tssr/.ssh/authorized_keys', bad: { do: 'lx.chown', dev: LNX, path: '/home/tssr/.ssh/authorized_keys', owner: 'tech', group: 'tech' }, good: { do: 'lx.chown', dev: LNX, path: '/home/tssr/.ssh/authorized_keys', owner: 'tssr', group: 'tssr' }, label: 'le fichier authorized_keys appartient au compte « tech »' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Ma clé SSH n’est plus acceptée sur le serveur Linux', 'Bonjour, ma connexion SSH par clé vers le serveur Linux est maintenant refusée alors que je n’ai pas changé de clé. Quelqu’un a fait un « chmod pour dépanner » dans mon dossier personnel. Le mot de passe est désactivé pour mon compte.'),
  cause: 'Avec StrictModes, sshd ignore authorized_keys si le répertoire personnel, ~/.ssh ou le fichier ont de mauvais droits ou un mauvais propriétaire : {{m.label}} (journal : « Authentication refused: bad ownership or modes »).',
  solution: 'Rétablir les droits attendus : home 750 (ou 755 maximum), ~/.ssh 700, authorized_keys 600, propriétaire = le compte.',
  hints: ['Clé correcte mais refusée sans message côté client : le serveur ne fait plus confiance au fichier.', 'journalctl -u ssh : « Authentication refused: bad ownership or modes for … ». Regardez ls -ld et ls -l sur la chaîne /home/tssr → .ssh → authorized_keys.', 'chmod/chown : aucun de ces trois éléments ne doit être modifiable par le groupe ou les autres, et tous doivent appartenir au compte (ou root).'],
  inject: ['{{m.bad}}'],
  probes: SSH_PROBE,
  roots: [{ probe: { t: 'lxfile', dev: LNX, path: '/home/tssr', safe: true, ownerIn: ['tssr', 'root'] } }, { probe: { t: 'lxfile', dev: LNX, path: '/home/tssr/.ssh', safe: true, ownerIn: ['tssr', 'root'] } }, { probe: { t: 'lxfile', dev: LNX, path: '/home/tssr/.ssh/authorized_keys', safe: true, ownerIn: ['tssr', 'root'] } }],
  fix: ['{{m.good}}'],
  traps: ['Désactiver StrictModes règle le symptôme en supprimant une protection : c’est une fausse résolution.'],
  optimal: ['Lire le journal ssh', 'ls -ld sur la chaîne de répertoires', 'Identifier l’élément trop permissif', 'chmod / chown', 'Retester'] });

/* ======================= PARE-FEU UFW ======================= */
add({ id: 'lx_ufw', level: 2, title: 'UFW : règle manquante ou mal ordonnée', skills: ['lx-secu', 'diag'],
  vary: { m: [
    { key: 'web', inj: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' } }], fix: [{ do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' } }], probes: [HTTP_INTRA], roots: [{ probe: { t: 'lxufw', dev: LNX, port: 80, from: '10.10.20.5' } }], label: 'la règle autorisant le port 80 a été supprimée', subj: 'L’intranet ne répond plus', body: 'Bonjour, l’intranet ne s’ouvre plus depuis les postes (la page tourne dans le vide). Le serveur répond au ping. Hier, un collègue a « nettoyé » le pare-feu du serveur.' },
    { key: 'ssh', inj: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '22/tcp', from: '10.10.0.0/16', action: 'ALLOW' } }], fix: [{ do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '22/tcp', from: '10.10.0.0/16', action: 'ALLOW' } }], probes: SSH_PROBE, roots: [{ probe: { t: 'lxufw', dev: LNX, port: 22, from: '10.10.30.10' } }], label: 'la règle autorisant SSH depuis 10.10.0.0/16 a été supprimée', subj: 'SSH ne répond plus (timeout)', body: 'Bonjour, mes connexions SSH vers le serveur Linux ne répondent plus du tout (timeout, pas de refus). Le service tourne pourtant sur la machine, je le vois à la console.' },
    { key: 'sous-reseau', inj: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' } }, { do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '80/tcp', from: '10.10.30.0/24', action: 'ALLOW' } }], fix: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '80/tcp', from: '10.10.30.0/24', action: 'ALLOW' } }, { do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' } }], probes: [HTTP_INTRA, HTTP_INTRA_ADM], roots: [{ probe: { t: 'lxufw', dev: LNX, port: 80, from: '10.10.20.5' } }], label: 'la règle du port 80 n’autorise plus que le réseau 10.10.30.0/24 (administration)', subj: 'L’intranet n’est accessible qu’au poste d’administration', body: 'Bonjour, l’intranet fonctionne depuis le poste d’administration mais pas depuis les postes des services.' },
    { key: 'ordre', inj: [{ do: 'lx.ufw', dev: LNX, op: 'insert', index: 0, rule: { to: '80/tcp', from: '10.10.20.0/24', action: 'DENY' } }], fix: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '80/tcp', from: '10.10.20.0/24', action: 'DENY' } }], probes: [HTTP_INTRA, HTTP_INTRA_ADM], roots: [{ probe: { t: 'lxufw', dev: LNX, port: 80, from: '10.10.20.5' } }], label: 'une règle DENY sur le port 80 pour 10.10.20.0/24 est placée avant la règle ALLOW (UFW applique la première règle qui correspond)', subj: 'Les postes des services n’ouvrent plus l’intranet', body: 'Bonjour, l’intranet ne s’ouvre plus depuis les postes des services alors que le poste d’administration y accède normalement. Une règle a été ajoutée hier au pare-feu du serveur.' }
  ] },
  ticket: { from: 'Alice Martin (la comptabilité)', subject: '{{m.subj}}', body: '{{m.body}}', site: 'toulouse' },
  cause: 'Sur SRV-LNX, UFW filtre le trafic entrant : {{m.label}}. Le service tourne mais les paquets sont abandonnés avant lui (timeout, pas de refus).',
  solution: 'Rétablir la règle correcte avec ufw (allow ou delete de la règle fautive) en tenant compte de l’ordre des règles.',
  hints: ['Pas de réponse du tout (timeout) alors que le service écoute : pensez au pare-feu local de la machine.', 'ufw status numbered : lisez les règles dans l’ordre, la première qui correspond s’applique.', 'ufw allow … ou ufw delete <numéro> selon le cas, puis retestez depuis le bon réseau.'],
  inject: '{{m.inj}}',
  probes: '{{m.probes}}',
  roots: '{{m.roots}}',
  fix: '{{m.fix}}',
  traps: ['ufw disable ou ufw default allow incoming règle le symptôme en supprimant la protection : fausse résolution.'],
  optimal: ['Distinguer timeout et refus', 'ufw status numbered', 'Identifier la règle fautive ou manquante', 'Corriger', 'Retester depuis chaque réseau'] });

/* ======================= MARIADB ======================= */
add({ id: 'lx_db_access', level: 3, title: 'MariaDB : le serveur de fichiers n’arrive plus à se connecter à la base', skills: ['lamp', 'lx-secu', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'bind', inj: [rep(LNX, '/etc/mysql/mariadb.conf.d/50-server.cnf', 'bind-address            = 0.0.0.0', 'bind-address            = 127.0.0.1'), svc(LNX, 'mariadb', 'restart')], fix: [rep(LNX, '/etc/mysql/mariadb.conf.d/50-server.cnf', 'bind-address            = 127.0.0.1', 'bind-address            = 0.0.0.0'), svc(LNX, 'mariadb', 'restart')], roots: [{ probe: { t: 'lxcfg', dev: LNX, parse: 'mariadb', get: 'bind', in: ['0.0.0.0', '*', '10.10.10.30'] } }, { probe: { t: 'lxfresh', dev: LNX, svc: 'mariadb' } }], label: 'MariaDB n’écoute plus que sur 127.0.0.1 (bind-address)', sym: 'La connexion est refusée (le port 3306 est fermé vu du réseau).' },
    { key: 'ufw', inj: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '3306/tcp', from: '10.10.10.0/24', action: 'ALLOW' } }], fix: [{ do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '3306/tcp', from: '10.10.10.0/24', action: 'ALLOW' } }], roots: [{ probe: { t: 'lxufw', dev: LNX, port: 3306, from: '10.10.10.20' } }], label: 'la règle UFW autorisant le port 3306 depuis 10.10.10.0/24 a disparu', sym: 'La connexion expire (pas de réponse du tout).' },
    { key: 'grant', inj: [{ do: 'lx.db', dev: LNX, op: 'host', user: 'intranet', host: '10.10.20.%' }], fix: [{ do: 'lx.db', dev: LNX, op: 'host', user: 'intranet', host: '10.10.10.%' }], roots: [{ path: LNX + '.db.users[user=intranet].host', in: ['10.10.10.%', '10.10.10.20', '10.10.10.0/255.255.255.0'] }], label: 'le compte SQL intranet n’est plus autorisé que depuis 10.10.20.% (au lieu de 10.10.10.%)', sym: 'Le serveur répond mais refuse le compte : « Access denied for user ».' }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'L’application de gestion n’arrive plus à joindre la base', 'Bonjour, l’application de gestion (hébergée sur le serveur de fichiers) affiche une erreur de connexion à la base de données depuis ce matin. Le serveur MariaDB est allumé et son service semble démarré. L’application s’ouvre à l’adresse http://gestion.toulouse.local/.'),
  cause: 'L’application (10.10.10.20) n’atteint plus MariaDB sur SRV-LNX : {{m.label}}. {{m.sym}}',
  solution: 'Corriger l’élément fautif (écoute, pare-feu ou compte SQL) en gardant le principe du moindre privilège (pas de GRANT vers « % »).',
  hints: ['Le service tourne : localisez le blocage couche par couche (écoute, pare-feu, droits du compte).', 'ss -tlnp (port 3306 ?), ufw status, puis SELECT user,host FROM mysql.user. Le message du client change selon la couche : refus, expiration ou « Access denied ».', 'Corrigez la couche fautive. Ne créez pas de compte ouvert à « % ».'],
  inject: '{{m.inj}}',
  probes: [DB_PROBE],
  verify: GESTION_VERIFY,
  roots: '{{m.roots}}',
  fix: '{{m.fix}}',
  traps: ['Créer un compte « intranet »@« % » avec tous les droits règle le symptôme en élargissant les accès : fausse résolution.', 'Désactiver UFW n’est pas une correction.'],
  optimal: ['Tester le port depuis le client (refus / timeout / access denied)', 'Identifier la couche fautive', 'Corriger', 'Redémarrer ou recharger si besoin', 'Retester la connexion'] });

/* ======================= CRON / BASH ======================= */
add({ id: 'lx_cron', level: 3, title: 'Sauvegarde nocturne qui ne s’exécute plus (cron / script)', skills: ['bash', 'lx-droits', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'chmod', inj: [{ do: 'lx.chmod', dev: LNX, path: '/opt/scripts/backup.sh', mode: '0644' }], fix: [{ do: 'lx.chmod', dev: LNX, path: '/opt/scripts/backup.sh', mode: '0755' }], label: 'le script /opt/scripts/backup.sh a perdu son bit exécutable (644)' },
    { key: 'shebang', inj: [rep(LNX, '/opt/scripts/backup.sh', '#!/bin/bash', '#!/bin/bsh')], fix: [rep(LNX, '/opt/scripts/backup.sh', '#!/bin/bsh', '#!/bin/bash')], label: 'la première ligne du script indique un interpréteur inexistant (#!/bin/bsh)' },
    { key: 'crlf', inj: [rep(LNX, '/opt/scripts/backup.sh', '#!/bin/bash\n', '#!/bin/bash\r\n')], fix: [rep(LNX, '/opt/scripts/backup.sh', '#!/bin/bash\r\n', '#!/bin/bash\n')], label: 'le script porte des fins de ligne Windows (CRLF) : l’interpréteur devient « /bin/bash^M »' },
    { key: 'chemin', inj: [rep(LNX, '/etc/cron.d/backup-intranet', '/opt/scripts/backup.sh', '/opt/script/backup.sh')], fix: [rep(LNX, '/etc/cron.d/backup-intranet', '/opt/script/backup.sh', '/opt/scripts/backup.sh')], label: 'la tâche cron pointe vers /opt/script/backup.sh (dossier inexistant)' },
    { key: 'nom', inj: [{ do: 'lx.mv', dev: LNX, from: '/etc/cron.d/backup-intranet', to: '/etc/cron.d/backup.intranet' }], fix: [{ do: 'lx.mv', dev: LNX, from: '/etc/cron.d/backup.intranet', to: '/etc/cron.d/backup-intranet' }], label: 'le fichier de /etc/cron.d a été renommé avec un point (« backup.intranet ») : cron ignore ce nom' },
    { key: 'perm', inj: [{ do: 'lx.chmod', dev: LNX, path: '/etc/cron.d/backup-intranet', mode: '0664' }], fix: [{ do: 'lx.chmod', dev: LNX, path: '/etc/cron.d/backup-intranet', mode: '0644' }], label: 'le fichier /etc/cron.d/backup-intranet est modifiable par le groupe (664) : cron le refuse' },
    { key: 'cron', inj: [svc(LNX, 'cron', 'stop')], fix: [svc(LNX, 'cron', 'start')], label: 'le service cron est arrêté' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Plus de sauvegarde de la base intranet depuis plusieurs jours', 'Bonjour, en vérifiant /var/backups/intranet je m’aperçois que plus aucun fichier n’est créé depuis plusieurs nuits. Le script de sauvegarde fonctionnait quand je l’ai écrit. Aucun message d’erreur visible : la tâche est planifiée à 2 h 30.'),
  cause: 'La tâche cron « backup-intranet » échoue ou n’est pas lancée : {{m.label}}. La sortie d’erreur est perdue (pas de MTA installé), d’où l’absence de message visible.',
  solution: 'Identifier la cause dans le journal (CRON) et en exécutant le script à la main, la corriger, puis vérifier qu’une exécution manuelle produit bien un fichier dans /var/backups/intranet.',
  hints: ['Pas de fichier créé et pas de mail : cron a-t-il seulement lancé la tâche ? Regardez le journal du service cron.', 'journalctl -u cron : la ligne CMD apparaît-elle ? Lancez le script à la main avec /opt/scripts/backup.sh puis avec bash pour comparer les messages.', 'Corrigez la cause (droits, interpréteur, chemin, nom ou droits du fichier cron.d, service) et testez à la main.'],
  inject: '{{m.inj}}',
  probes: [{ t: 'cronjob', dev: LNX, file: '/etc/cron.d/backup-intranet' }],
  roots: [{ probe: { t: 'cronjob', dev: LNX, file: '/etc/cron.d/backup-intranet' } }],
  fix: '{{m.fix}}',
  traps: ['Lancer le script à la main une fois produit le fichier du jour mais ne corrige pas la tâche planifiée.'],
  optimal: ['Lire le journal de cron', 'Exécuter le script à la main', 'Lire le message (permission, interpréteur, chemin)', 'Corriger', 'Retester la tâche'] });

/* ======================= DROITS POSIX / ACL ======================= */
add({ id: 'lx_perm', level: 2, title: 'Dossier d’échange inaccessible en écriture (droits POSIX)', skills: ['lx-droits', 'diag'],
  vary: { m: [
    { key: 'mode', inj: [{ do: 'lx.chmod', dev: LNX, path: '/srv/echanges', mode: '0750' }], fix: [{ do: 'lx.chmod', dev: LNX, path: '/srv/echanges', mode: '0770' }], root: { path: LNX + ".fs['/srv/echanges'].m", in: ['0770', '0775', '0777', '2770', '2775'] }, label: 'le dossier /srv/echanges est en 750 : le groupe peut lire mais plus écrire' },
    { key: 'groupe', inj: [{ do: 'lx.chown', dev: LNX, path: '/srv/echanges', group: 'root' }], fix: [{ do: 'lx.chown', dev: LNX, path: '/srv/echanges', group: 'techs' }], root: { path: LNX + ".fs['/srv/echanges'].g", eq: 'techs' }, label: 'le dossier /srv/echanges a pour groupe « root » au lieu de « techs »' },
    { key: 'membre', inj: [rep(LNX, '/etc/group', 'techs:x:1100:tech,tssr', 'techs:x:1100:tssr')], fix: [rep(LNX, '/etc/group', 'techs:x:1100:tssr', 'techs:x:1100:tech,tssr')], root: { probe: { t: 'lxaccess', dev: LNX, user: 'tech', path: '/srv/echanges', mode: 'w' } }, label: 'le compte « tech » a été retiré du groupe « techs »' }
  ] },
  ticket: tk('Marc Technicien (support)', 'Je ne peux plus déposer de fichiers dans le dossier d’échange du serveur Linux', 'Bonjour, depuis ce matin je n’arrive plus à écrire dans /srv/echanges sur le serveur Linux (« Permission denied »). Je pouvais hier. Je peux encore lire.'),
  cause: 'Le compte « tech » n’a plus le droit d’écrire dans /srv/echanges : {{m.label}}.',
  solution: 'Rétablir le bon groupe, la bonne appartenance ou le bon mode (770, groupe techs), sans passer en 777.',
  hints: ['Lisez les droits du dossier et les groupes du compte : ls -ld /srv/echanges et id tech.', 'Trois choses comptent : le groupe du dossier, les droits du groupe (rwx) et l’appartenance du compte à ce groupe.', 'chmod g+w, chgrp ou usermod -aG selon la cause. Évitez chmod 777.'],
  inject: '{{m.inj}}',
  probes: [{ t: 'lxaccess', dev: LNX, user: 'tech', path: '/srv/echanges', mode: 'w' }],
  roots: ['{{m.root}}'],
  fix: '{{m.fix}}',
  traps: ['chmod 777 donne l’écriture à tout le monde : c’est une fausse résolution dangereuse.'],
  optimal: ['ls -ld du dossier', 'id du compte', 'Identifier la cause (groupe, mode, appartenance)', 'Corriger', 'Retester l’écriture'] });

add({ id: 'lx_acl', level: 3, title: 'ACL POSIX : l’accès accordé à un utilisateur ne fonctionne plus', skills: ['lx-acl', 'lx-droits', 'diag'],
  vary: { m: [
    { key: 'masque', acl: { users: { tech: 'rwx' }, mask: 'r-x' }, label: 'le masque effectif de l’ACL est passé à r-x (un chmod sur le dossier l’a recalculé) : l’entrée user:tech:rwx n’est effective qu’en lecture/exécution' },
    { key: 'absente', acl: null, label: 'l’ACL a été supprimée (setfacl -b) : il ne reste que les droits classiques 750 du propriétaire tssr' },
    { key: 'faute', acl: { users: { tec: 'rwx' }, mask: 'rwx' }, label: 'l’entrée de l’ACL vise un utilisateur « tec » (faute de frappe) au lieu de « tech »' }
  ] },
  ticket: tk('Marc Technicien (support)', 'Je n’arrive plus à écrire dans le dossier de rapports', 'Bonjour, tssr m’avait donné accès en écriture au dossier /srv/echanges/rapports (via une ACL). Depuis hier soir j’obtiens « Permission denied » quand je veux déposer un rapport. Je peux encore lire.'),
  cause: 'Sur /srv/echanges/rapports, {{m.label}}.',
  solution: 'Rétablir l’ACL user:tech:rwx avec un masque rwx (setfacl -m u:tech:rwx puis -m m::rwx) ; vérifier avec getfacl (ligne « #effective »).',
  hints: ['Vérifiez avec getfacl : les droits réellement effectifs peuvent différer des droits affichés pour l’utilisateur.', 'getfacl /srv/echanges/rapports : cherchez le masque (mask::) et la ligne user:tech.', 'setfacl -m u:tech:rwx puis setfacl -m m::rwx, et retestez en écriture.'],
  inject: [{ do: 'lx.acl', dev: LNX, path: '/srv/echanges/rapports', acl: '{{m.acl}}' }],
  probes: [{ t: 'lxaccess', dev: LNX, user: 'tech', path: '/srv/echanges/rapports', mode: 'w' }],
  roots: [{ probe: { t: 'lxaccess', dev: LNX, user: 'tech', path: '/srv/echanges/rapports', mode: 'w' } }, { probe: { t: 'lxfile', dev: LNX, path: '/srv/echanges/rapports', modeIn: ['0750', '0770'] } }],
  fix: [{ do: 'lx.acl', dev: LNX, path: '/srv/echanges/rapports', acl: { users: { tech: 'rwx' }, mask: 'rwx' } }],
  traps: ['chmod 777 sur le dossier contourne l’ACL en ouvrant à tous : fausse résolution.'],
  optimal: ['getfacl du dossier', 'Lire le masque et les entrées', 'setfacl pour corriger', 'Retester en écriture'] });

/* ======================= BIND9 ======================= */
add({ id: 'lx_bind_conf', level: 2, title: 'Bind9 : erreur de syntaxe dans named.conf', skills: ['bind9', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'pv', file: NAMED_LOCAL, from: 'file "/etc/bind/db.labo.toulouse.local";\n};', to: 'file "/etc/bind/db.labo.toulouse.local"\n};', label: 'un point-virgule est manquant dans named.conf.local' },
    { key: 'accolade', file: NAMED_OPT, from: 'listen-on-v6 { any; };\n};', to: 'listen-on-v6 { any; };\n', label: 'l’accolade fermante du bloc options est absente dans named.conf.options' },
    { key: 'fichier', file: NAMED_LOCAL, from: 'file "/etc/bind/db.labo.toulouse.local";', to: 'file "/etc/bind/db.labo.toulouse.lcal";', label: 'le chemin du fichier de zone est faux dans named.conf.local (db.labo.toulouse.lcal)' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Les noms du laboratoire ne se résolvent plus après ma modification de Bind', 'Bonjour, j’ai modifié la configuration de Bind9 sur le serveur Linux et redémarré le service. Depuis, plus aucun nom en « .labo.toulouse.local » ne se résout.'),
  cause: 'Dans la configuration de Bind9, {{m.label}} : named refuse de démarrer ou ne charge pas la zone, et les requêtes de délégation échouent.',
  solution: 'Valider avec named-checkconf (et named-checkzone), corriger la ligne fautive puis redémarrer named.',
  hints: ['Regardez si le service est réellement actif après le redémarrage, et ce que dit le journal.', 'named-checkconf indique le fichier et la ligne. journalctl -u named donne la suite.', 'Corrigez puis systemctl restart bind9 (ou named) et retestez la résolution.'],
  inject: [rep(LNX, '{{m.file}}', '{{m.from}}', '{{m.to}}'), svc(LNX, 'bind9', 'restart')],
  probes: [RES_WWW],
  roots: [{ probe: { t: 'bindok', dev: LNX } }, { probe: { t: 'resolve', from: 'SRV-FIC', name: 'www.labo.toulouse.local', expect: '10.10.10.30' } }],
  fix: [rep(LNX, '{{m.file}}', '{{m.to}}', '{{m.from}}'), svc(LNX, 'bind9', 'restart')],
  traps: ['Ajouter une redirection DNS ou une entrée hosts sur les postes masque la panne sans corriger Bind.'],
  optimal: ['systemctl status : failed ou zone absente', 'named-checkconf', 'journalctl -u named', 'Corriger la ligne', 'Redémarrer et retester'] });

add({ id: 'lx_bind_zone', level: 3, title: 'Bind9 : erreur dans le fichier de zone', skills: ['bind9', 'diag'],
  vary: { m: [
    { key: 'point', from: '@\tIN\tNS\tns1.labo.toulouse.local.', to: '@\tIN\tNS\tns1.labo.toulouse.local', label: 'l’enregistrement NS n’est pas terminé par un point final : le nom est complété par le nom de zone (ns1.labo.toulouse.local.labo.toulouse.local.) et la zone est rejetée' },
    { key: 'ip', from: 'www\tIN\tA\t10.10.10.30', to: 'www\tIN\tA\t10.10.10.300', label: 'l’adresse de l’enregistrement www est invalide (10.10.10.300) et la zone est rejetée' },
    { key: 'soa', from: '604800\t\t; Expire', to: '\t\t; Expire', label: 'le SOA est incomplet (le champ Expire a disparu) et la zone est rejetée' },
    { key: 'cname', from: 'intra\tIN\tCNAME\twww\n', to: 'intra\tIN\tCNAME\twww.labo.toulouse.local\n', label: 'la cible du CNAME « intra » n’a pas de point final : elle devient www.labo.toulouse.local.labo.toulouse.local. et n’existe pas' },
    { key: 'www', from: 'www\tIN\tA\t10.10.10.30', to: 'www\tIN\tA\t10.10.10.31', label: 'l’adresse de www pointe vers 10.10.10.31 au lieu de 10.10.10.30' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'www.labo.toulouse.local ne répond plus (ou pointe au mauvais endroit)', 'Bonjour, depuis la mise à jour de la zone « labo » sur le serveur Linux, www.labo.toulouse.local et intra.labo.toulouse.local ne se résolvent plus correctement. Les autres noms de l’entreprise fonctionnent.'),
  cause: 'Dans le fichier de zone /etc/bind/db.labo.toulouse.local, {{m.label}}.',
  solution: 'Valider avec named-checkzone, corriger l’enregistrement, incrémenter le numéro de série si la zone est répliquée, puis recharger la zone (rndc reload ou systemctl reload).',
  hints: ['Les noms hors zone fonctionnent : le problème est dans la zone « labo ». Regardez le journal de named au chargement de la zone.', 'named-checkzone labo.toulouse.local /etc/bind/db.labo.toulouse.local : il indique la ligne et la nature de l’erreur. Attention à la présence du point final dans les noms complets.', 'Corrigez la ligne puis rechargez : sans rechargement, l’ancienne version reste servie.'],
  inject: [rep(LNX, ZONE, '{{m.from}}', '{{m.to}}'), svc(LNX, 'bind9', 'reload')],
  probes: [RES_WWW, RES_INTRA],
  roots: [{ probe: { t: 'bindok', dev: LNX } }, { probe: { t: 'resolve', from: 'SRV-FIC', name: 'www.labo.toulouse.local', expect: '10.10.10.30' } }, { probe: { t: 'resolve', from: 'SRV-FIC', name: 'intra.labo.toulouse.local', expect: '10.10.10.30' } }],
  fix: [rep(LNX, ZONE, '{{m.to}}', '{{m.from}}'), svc(LNX, 'bind9', 'reload')],
  traps: ['Corriger le fichier sans recharger la zone laisse l’ancienne version en mémoire.', 'Ajouter une entrée hosts sur un poste masque l’erreur sans la corriger.'],
  optimal: ['Constater que seule la zone labo est touchée', 'journalctl -u named', 'named-checkzone', 'Corriger la ligne', 'Recharger et retester'] });

add({ id: 'lx_bind_ptr', level: 3, title: 'Bind9 : résolution inverse (PTR) incorrecte', skills: ['bind9', 'dns', 'diag'],
  vary: { m: [
    { key: 'relatif', to: '30\tIN\tPTR\twww', label: 'l’enregistrement PTR de 10.10.10.30 contient « www » sans domaine : le nom est complété par la zone inverse (www.10.10.10.in-addr.arpa.)' },
    { key: 'point', to: '30\tIN\tPTR\twww.labo.toulouse.local', label: 'l’enregistrement PTR de 10.10.10.30 n’est pas terminé par un point final : le nom devient www.labo.toulouse.local.10.10.10.in-addr.arpa.' },
    { key: 'absent', to: ';30\tIN\tPTR\twww.labo.toulouse.local.', label: 'l’enregistrement PTR de 10.10.10.30 a été mis en commentaire dans la zone inverse' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'La résolution inverse du serveur web donne un nom absurde (ou rien)', 'Bonjour, quand j’interroge le serveur DNS Linux (10.10.10.30) pour retrouver le nom de l’adresse 10.10.10.30 (nslookup ou dig -x), j’obtiens un nom qui n’a rien à voir avec www.labo.toulouse.local, voire aucune réponse. Dans l’autre sens (nom vers adresse), tout fonctionne.'),
  cause: 'Dans la zone inverse 10.10.10.in-addr.arpa (/etc/bind/db.10.10.10), {{m.label}}.',
  solution: 'Valider la zone inverse avec named-checkzone, rétablir « 30 IN PTR www.labo.toulouse.local. » avec le point final, puis recharger la zone.',
  hints: ['La résolution directe fonctionne : seule la zone inverse est en cause.', 'dig -x 10.10.10.30 @10.10.10.30 puis named-checkzone 10.10.10.in-addr.arpa /etc/bind/db.10.10.10 : regardez le nom retourné et le point final.', 'Dans un fichier de zone, un nom sans point final est complété par le nom de la zone. Corrigez la ligne PTR puis rechargez.'],
  inject: [rep(LNX, '/etc/bind/db.10.10.10', '30\tIN\tPTR\twww.labo.toulouse.local.', '{{m.to}}'), svc(LNX, 'bind9', 'reload')],
  probes: [{ t: 'ptr', from: 'SRV-FIC', server: '10.10.10.30', ip: '10.10.10.30', expect: 'www.labo.toulouse.local' }],
  roots: [{ probe: { t: 'bindok', dev: LNX } }, { probe: { t: 'ptr', from: 'SRV-FIC', server: '10.10.10.30', ip: '10.10.10.30', expect: 'www.labo.toulouse.local' } }],
  fix: [rep(LNX, '/etc/bind/db.10.10.10', '{{m.to}}', '30\tIN\tPTR\twww.labo.toulouse.local.'), svc(LNX, 'bind9', 'reload')],
  traps: ['Ajouter une entrée hosts sur un poste masque l’erreur sans la corriger.', 'Corriger le fichier sans recharger la zone laisse l’ancienne version en mémoire.'],
  optimal: ['dig -x 10.10.10.30', 'named-checkzone sur la zone inverse', 'Corriger la ligne PTR (point final)', 'Recharger et retester'] });

add({ id: 'lx_bind_access', level: 3, title: 'Bind9 : le serveur ne répond plus aux requêtes du réseau', skills: ['bind9', 'lx-secu', 'diag'],
  vary: { m: [
    { key: 'allow-query', inj: [rep(LNX, NAMED_OPT, 'allow-query { any; };', 'allow-query { 10.10.20.0/24; };'), svc(LNX, 'bind9', 'reload')], fix: [rep(LNX, NAMED_OPT, 'allow-query { 10.10.20.0/24; };', 'allow-query { any; };'), svc(LNX, 'bind9', 'reload')], label: 'allow-query ne liste plus que 10.10.20.0/24 : le serveur DNS de l’entreprise (10.10.10.10) reçoit REFUSED', extra: [] },
    { key: 'listen-on', inj: [rep(LNX, NAMED_OPT, '\trecursion yes;', '\tlisten-on { 127.0.0.1; };\n\trecursion yes;'), svc(LNX, 'bind9', 'restart')], fix: [rep(LNX, NAMED_OPT, '\tlisten-on { 127.0.0.1; };\n\trecursion yes;', '\trecursion yes;'), svc(LNX, 'bind9', 'restart')], label: 'listen-on { 127.0.0.1; } : named n’écoute plus que sur la boucle locale', extra: [] },
    { key: 'ufw', inj: [{ do: 'lx.ufw', dev: LNX, op: 'delete', rule: { to: '53', from: '10.10.0.0/16', action: 'ALLOW' } }], fix: [{ do: 'lx.ufw', dev: LNX, op: 'add', rule: { to: '53', from: '10.10.0.0/16', action: 'ALLOW' } }], label: 'UFW n’autorise plus le port 53 depuis 10.10.0.0/16 : les requêtes expirent', extra: [{ probe: { t: 'lxufw', dev: LNX, proto: 'udp', port: 53, from: '10.10.10.10' } }] }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'La résolution des noms du laboratoire échoue de façon intermittente selon le poste', 'Bonjour, les noms « .labo.toulouse.local » ne se résolvent plus (SERVFAIL ou délai d’attente selon les cas), alors que le service Bind9 est actif et que sa zone est valide. Quelqu’un a touché au serveur hier.'),
  cause: 'Bind9 tourne mais n’est pas joignable par les clients légitimes : {{m.label}}.',
  solution: 'Rétablir allow-query/listen-on ou la règle UFW appropriée, recharger, puis vérifier la résolution depuis le serveur DNS de l’entreprise et depuis un poste.',
  hints: ['Le service est actif et la zone charge : le blocage est dans l’accès au service (filtrage, écoute, pare-feu).', 'rndc status / ss -ulnp (écoute sur 10.10.10.30 ?), dig @10.10.10.30 depuis un autre hôte (REFUSED, timeout ?), ufw status.', 'Corrigez la couche fautive puis rechargez ou redémarrez named si la configuration a changé.'],
  inject: '{{m.inj}}',
  probes: [RES_WWW],
  roots: [{ probe: { t: 'bindok', dev: LNX } }, { probe: { t: 'resolve', from: 'SRV-FIC', name: 'www.labo.toulouse.local', expect: '10.10.10.30' } }],
  fix: '{{m.fix}}',
  traps: ['Mettre allow-query { any; } et désactiver UFW règle tout mais supprime des protections.'],
  optimal: ['Distinguer REFUSED, SERVFAIL et timeout', 'Tester depuis un autre hôte', 'Identifier la couche', 'Corriger', 'Recharger et retester'] });

/* ======================= APACHE / WEB ======================= */
add({ id: 'lx_apache_conf', level: 2, title: 'Apache : service tombé après une modification de configuration', skills: ['lamp', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'directive', from: 'DocumentRoot /var/www/intranet\n\n', to: 'DocumentRot /var/www/intranet\n\n', label: 'la directive DocumentRoot est mal orthographiée (DocumentRot)' },
    { key: 'ssl', from: '\tServerAdmin webmaster@toulouse.local\n', to: '\tServerAdmin webmaster@toulouse.local\n\tSSLEngine on\n', label: 'une ligne SSLEngine on a été ajoutée alors que le module ssl n’est pas activé et qu’aucun certificat n’est configuré' },
    { key: 'ferme', from: '</VirtualHost>', to: '#</VirtualHost>', label: 'la balise de fermeture </VirtualHost> a été mise en commentaire' }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'L’intranet est tombé après l’intervention de l’admin TSSR sur le serveur', 'Bonjour, l’intranet est inaccessible depuis que l’admin TSSR a modifié la configuration du site. Il m’a dit avoir « juste redémarré Apache ».'),
  cause: 'Dans la configuration du site intranet, {{m.label}} : apache2 refuse de démarrer (AH00526 / « Syntax error ») après le redémarrage.',
  solution: 'Tester avec apachectl configtest (ou apache2ctl -t), corriger la ligne, puis redémarrer le service.',
  hints: ['Le service a été redémarré : est-il réellement actif ?', 'systemctl status apache2 puis apachectl configtest : le fichier et la ligne sont indiqués.', 'Corrigez la ligne fautive, vérifiez avec configtest, puis systemctl restart apache2.'],
  inject: [rep(LNX, APA, '{{m.from}}', '{{m.to}}'), svc(LNX, 'apache2', 'restart')],
  probes: [HTTP_INTRA],
  roots: [{ probe: { t: 'cfgcheck', dev: LNX, svc: 'apache2' } }],
  fix: [rep(LNX, APA, '{{m.to}}', '{{m.from}}'), svc(LNX, 'apache2', 'restart')],
  traps: ['Activer le module ssl (a2enmod ssl) ne règle pas le cas SSLEngine : il manque aussi le certificat et le port 443.'],
  optimal: ['systemctl status apache2', 'apachectl configtest', 'Corriger la ligne', 'Redémarrer', 'Retester'] });

add({ id: 'lx_web_vhost', level: 3, title: 'Apache : site intranet mal servi (vhost, port, accès)', skills: ['lamp', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'docroot', inj: [rep(LNX, APA, 'DocumentRoot /var/www/intranet\n', 'DocumentRoot /var/www/intranet2\n'), svc(LNX, 'apache2', 'reload')], fix: [rep(LNX, APA, 'DocumentRoot /var/www/intranet2\n', 'DocumentRoot /var/www/intranet\n'), svc(LNX, 'apache2', 'reload')], label: 'DocumentRoot pointe vers /var/www/intranet2 (inexistant) : erreur 404', status: 'HTTP 404' },
    { key: 'disabled', inj: [{ do: 'lx.rm', dev: LNX, path: '/etc/apache2/sites-enabled/intranet.conf' }, svc(LNX, 'apache2', 'reload')], fix: [{ do: 'lx.link', dev: LNX, path: '/etc/apache2/sites-enabled/intranet.conf', target: '../sites-available/intranet.conf' }, svc(LNX, 'apache2', 'reload')], label: 'le site n’est plus activé (le lien dans sites-enabled a disparu, a2dissite)', status: 'HTTP 404' },
    { key: 'listen', inj: [rep(LNX, '/etc/apache2/ports.conf', 'Listen 80', 'Listen 8080'), svc(LNX, 'apache2', 'restart')], fix: [rep(LNX, '/etc/apache2/ports.conf', 'Listen 8080', 'Listen 80'), svc(LNX, 'apache2', 'restart')], label: 'ports.conf fait écouter Apache sur 8080 au lieu de 80', status: 'connexion refusée' },
    { key: 'require', inj: [rep(LNX, APA, 'Require all granted', 'Require all denied'), svc(LNX, 'apache2', 'reload')], fix: [rep(LNX, APA, 'Require all denied', 'Require all granted'), svc(LNX, 'apache2', 'reload')], label: 'le bloc Directory contient « Require all denied » : erreur 403', status: 'HTTP 403' }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'L’intranet affiche une erreur', 'Bonjour, depuis ce matin l’intranet n’affiche plus la page d’accueil mais une erreur (ou rien du tout). Le serveur Linux est allumé et Apache tourne.'),
  cause: 'Apache tourne mais le site intranet n’est pas servi correctement : {{m.label}}.',
  solution: 'Lire le journal d’erreurs d’Apache, corriger la configuration du vhost (activation, port, DocumentRoot, Require) et recharger.',
  hints: ['Notez le code HTTP ou le type d’échec : 404, 403, refus de connexion n’ont pas la même origine.', 'Lisez /var/log/apache2/intranet_error.log, apachectl -S (vhosts actifs), ss -tlnp (port d’écoute).', 'Corrigez la ligne fautive puis rechargez (apachectl graceful ou systemctl reload).'],
  inject: '{{m.inj}}',
  probes: [HTTP_INTRA],
  roots: [{ probe: { t: 'lxfresh', dev: LNX, svc: 'apache2' } }, { probe: { t: 'http', from: 'PC-ADM', url: 'http://intranet.toulouse.local/' } }],
  fix: '{{m.fix}}',
  traps: ['Redémarrer le serveur ou réinstaller Apache ne corrige pas un fichier de configuration.'],
  optimal: ['Noter le code d’erreur', 'Lire le journal d’erreurs d’Apache', 'apachectl -S / configtest', 'Corriger la configuration', 'Recharger et retester'] });

add({ id: 'lx_web_perm', level: 3, title: 'Apache : 403 Forbidden à cause des droits sur le site', skills: ['lamp', 'lx-droits', 'diag'],
  vary: { m: [
    { key: 'dir', inj: [{ do: 'lx.chmod', dev: LNX, path: '/var/www/intranet', mode: '0750' }], fix: [{ do: 'lx.chmod', dev: LNX, path: '/var/www/intranet', mode: '0755' }], label: 'le répertoire /var/www/intranet est en 750 root:root : l’utilisateur www-data ne peut plus le traverser' },
    { key: 'fichier', inj: [{ do: 'lx.chmod', dev: LNX, path: '/var/www/intranet/index.html', mode: '0600' }], fix: [{ do: 'lx.chmod', dev: LNX, path: '/var/www/intranet/index.html', mode: '0644' }], label: 'index.html est en 600 root:root : www-data ne peut plus le lire' },
    { key: 'index', inj: [{ do: 'lx.mv', dev: LNX, from: '/var/www/intranet/index.html', to: '/var/www/intranet/index.html.bak' }], fix: [{ do: 'lx.mv', dev: LNX, from: '/var/www/intranet/index.html.bak', to: '/var/www/intranet/index.html' }], label: 'index.html a été renommé en index.html.bak : sans page d’index et avec Options -Indexes, Apache répond 403' }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'L’intranet affiche « Forbidden »', 'Bonjour, depuis ce matin l’intranet affiche « Forbidden — You don’t have permission to access this resource ». Rien n’a changé côté Apache selon Admin TSSR, mais quelqu’un a travaillé dans les fichiers du site.'),
  cause: 'Apache fonctionne et sa configuration est bonne, mais {{m.label}}.',
  solution: 'Rétablir les droits (755 sur les dossiers, 644 sur les fichiers, lisibles par www-data) ou restaurer le fichier d’index, sans passer en 777.',
  hints: ['Un 403 avec une configuration saine pointe vers les droits du système de fichiers.', 'Lisez l’erreur dans intranet_error.log, puis ls -l et namei -l /var/www/intranet/index.html (ou testez en tant que www-data).', 'Corrigez le mode ou restaurez le fichier. Évitez chmod -R 777.'],
  inject: '{{m.inj}}',
  probes: [HTTP_INTRA],
  roots: [{ probe: { t: 'lxaccess', dev: LNX, user: 'www-data', path: '/var/www/intranet/index.html', mode: 'r' } }],
  fix: '{{m.fix}}',
  traps: ['chmod -R 777 /var/www règle le symptôme en rendant le site modifiable par tous : fausse résolution dangereuse.'],
  optimal: ['Noter le 403', 'Lire le journal d’erreurs', 'namei -l / ls -l', 'Corriger les droits', 'Retester'] });

add({ id: 'lx_nginx', level: 3, title: 'nginx : site vitrine HTTPS en panne', skills: ['nginx', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'cert-chemin', inj: [rep(WEB, NGX, 'ssl_certificate /etc/ssl/certs/vitrine.formatech.fr.crt;', 'ssl_certificate /etc/ssl/certs/vitrine.formatech.fr.cert;'), svc(WEB, 'nginx', 'restart')], fix: [rep(WEB, NGX, 'ssl_certificate /etc/ssl/certs/vitrine.formatech.fr.cert;', 'ssl_certificate /etc/ssl/certs/vitrine.formatech.fr.crt;'), svc(WEB, 'nginx', 'restart')], root: { probe: { t: 'cfgcheck', dev: WEB, svc: 'nginx' } }, label: 'le chemin de ssl_certificate est faux (.cert au lieu de .crt) : nginx -t échoue et le service ne repart pas' },
    { key: 'pointvirgule', inj: [rep(WEB, NGX, 'try_files $uri $uri/ =404;', 'try_files $uri $uri/ =404'), svc(WEB, 'nginx', 'restart')], fix: [rep(WEB, NGX, 'try_files $uri $uri/ =404', 'try_files $uri $uri/ =404;'), svc(WEB, 'nginx', 'restart')], root: { probe: { t: 'cfgcheck', dev: WEB, svc: 'nginx' } }, label: 'il manque un point-virgule après try_files : nginx -t signale la directive non terminée' },
    { key: 'expire', inj: [{ do: 'set', path: CERT_META + '.notAfter', value: '2026-10-01' }], fix: [{ do: 'set', path: CERT_META + '.notAfter', value: '2027-10-01' }], root: { path: CERT_META + '.notAfter', gt: '2026-10-27' }, label: 'le certificat du site a expiré (notAfter 2026-10-01) : les navigateurs affichent une alerte de sécurité' },
    { key: 'boucle', inj: [rep(WEB, NGX, '\tindex index.html;\n', '\tindex index.html;\n\treturn 301 http://$host$request_uri;\n'), svc(WEB, 'nginx', 'reload')], fix: [rep(WEB, NGX, '\tindex index.html;\n\treturn 301 http://$host$request_uri;\n', '\tindex index.html;\n'), svc(WEB, 'nginx', 'reload')], root: 'SRV-WEB:/etc/nginx/sites-available/vitrine', label: 'le bloc HTTPS redirige vers http:// alors que le bloc HTTP redirige vers https:// : boucle de redirections' },
    { key: 'root', inj: [rep(WEB, NGX, 'root /var/www/vitrine;', 'root /var/www/vitrin;'), svc(WEB, 'nginx', 'reload')], fix: [rep(WEB, NGX, 'root /var/www/vitrin;', 'root /var/www/vitrine;'), svc(WEB, 'nginx', 'reload')], root: 'SRV-WEB:/etc/nginx/sites-available/vitrine', label: 'root pointe vers /var/www/vitrin (fautif) : erreur 404 sur toutes les pages' }
  ] },
  ticket: tk('Direction commerciale', 'Notre site vitrine affiche une erreur', 'Bonjour, des clients nous signalent que https://vitrine.formatech.fr affiche une alerte de sécurité, une erreur ou ne répond plus depuis hier soir. L’hébergeur dit que la ligne Internet est bonne.'),
  cause: 'Sur SRV-WEB (nginx, en DMZ), {{m.label}}.',
  solution: 'Tester la configuration (nginx -t), corriger la cause (chemin, syntaxe, certificat, redirection ou root), puis recharger ou redémarrer nginx.',
  hints: ['Testez depuis l’extérieur et notez le type d’erreur : alerte de certificat, 404, boucle de redirection, absence de réponse.', 'nginx -t et journalctl -u nginx donnent la ligne fautive ; curl -vI https://vitrine.formatech.fr montre le certificat et les redirections.', 'Corrigez puis nginx -t, puis systemctl reload (ou restart si le service est tombé).'],
  inject: '{{m.inj}}',
  probes: [HTTP_VITRINE],
  roots: ['{{m.root}}'],
  fix: '{{m.fix}}',
  traps: ['Installer un certificat auto-signé pour faire disparaître l’alerte remplace une erreur par une autre (autorité non approuvée).'],
  optimal: ['Tester depuis l’extérieur et noter l’erreur', 'nginx -t / journal', 'Corriger', 'Recharger', 'Retester depuis l’extérieur'] });

/* ======================= STOCKAGE ======================= */
add({ id: 'lx_disk_full', level: 3, title: 'Partition /var pleine : MariaDB et sauvegardes en échec', skills: ['lx-stockage', 'lamp', 'lx-services', 'diag'],
  vary: { m: [
    { key: 'log', file: '/var/log/apache2/intranet_error.log', size: 8000, label: 'le journal d’erreurs d’Apache (intranet_error.log) a grossi jusqu’à saturer /var (boucle d’erreurs 8 Go)', fix: [{ do: 'lx.truncate', dev: LNX, path: '/var/log/apache2/intranet_error.log' }, svc(LNX, 'mariadb', 'start')] },
    { key: 'dump', file: '/var/backups/intranet/vieux-dump-2024.tar.gz', size: 8000, label: 'un ancien dump de 8 Go (/var/backups/intranet/vieux-dump-2024.tar.gz) a été copié dans /var et sature la partition', fix: [{ do: 'lx.rm', dev: LNX, path: '/var/backups/intranet/vieux-dump-2024.tar.gz' }, svc(LNX, 'mariadb', 'start')] }
  ] },
  ticket: tk('Alice Martin (la comptabilité)', 'L’application de gestion ne répond plus et la base est arrêtée', 'Bonjour, l’application de gestion affiche une erreur de base de données depuis cette nuit. Le service MariaDB est arrêté et ne redémarre pas. Quelqu’un parle d’un « disque plein » sur le serveur Linux. L’application s’ouvre à l’adresse http://gestion.toulouse.local/.'),
  cause: 'La partition /var est saturée : {{m.label}}. MariaDB ne peut plus écrire (Errcode 28, « No space left on device »), s’arrête et refuse de redémarrer ; les sauvegardes échouent aussi.',
  solution: 'Identifier le fichier volumineux (df -h, du -ah /var | sort -rh | head), libérer l’espace en le supprimant ou le vidant (truncate), puis redémarrer MariaDB.',
  hints: ['Les symptômes (base arrêtée, sauvegardes en échec) ont une cause commune : l’espace disque.', 'df -h puis du -xh /var --max-depth=2 | sort -rh | head : quel fichier occupe l’espace ? journalctl -u mariadb confirme « No space left on device ».', 'Videz ou supprimez le fichier fautif (truncate -s 0 pour un journal en cours d’écriture) puis systemctl start mariadb. Ne supprimez rien dans /var/lib/mysql.'],
  inject: [{ do: 'lx.bigfile', dev: LNX, path: '{{m.file}}', sizeMB: '{{m.size}}' }, svc(LNX, 'mariadb', 'stop'), { do: 'lx.jlog', dev: LNX, unit: 'mariadb.service', proc: 'mariadbd', msg: '[ERROR] mariadbd: Disk is full writing \'./ib_logfile0\' (Errcode: 28 "No space left on device")', prio: 3 }],
  probes: [DB_PROBE, { t: 'lxdisk', dev: LNX, fs: 'var', max: 90 }],
  verify: GESTION_VERIFY,
  roots: [{ probe: { t: 'lxdisk', dev: LNX, fs: 'var', max: 90 } }],
  fix: '{{m.fix}}',
  traps: ['Supprimer des fichiers dans /var/lib/mysql corrompt la base : action destructrice.', 'Relancer MariaDB sans libérer d’espace échoue de nouveau.'],
  optimal: ['df -h', 'Trouver le fichier volumineux (du)', 'Libérer l’espace', 'Démarrer MariaDB', 'Retester l’application'] });

add({ id: 'lx_fstab', level: 4, title: 'Serveur en mode d’urgence après redémarrage (fstab)', skills: ['lx-stockage', 'lx-services', 'diag'],
  needsReboot: true,   /* la correction passe par un redémarrage : il ne compte pas comme « redémarrage inutile » (impact −4, src/engine/80-game.js) */
  vary: { m: [
    { key: 'uuid', step: { do: 'lx.fstab', dev: LNX, mp: '/var', uuid: 'typo' }, back: { do: 'lx.fstab', dev: LNX, mp: '/var', uuid: 'ok', disk: 'var' }, label: 'l’UUID du montage /var a une faute dans /etc/fstab (périphérique introuvable)' },
    { key: 'type', step: { do: 'lx.fstab', dev: LNX, mp: '/var', type: 'ext3' }, back: { do: 'lx.fstab', dev: LNX, mp: '/var', type: 'ext4' }, label: 'le type de système de fichiers de /var est déclaré ext3 alors que la partition est en ext4' },
    { key: 'mp', step: { do: 'lx.fstab', dev: LNX, mp: '/var', newMp: '/var2' }, back: { do: 'lx.fstab', dev: LNX, mp: '/var2', newMp: '/var' }, label: 'le point de montage de la partition de données est /var2, qui n’existe pas' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'Le serveur Linux ne répond plus après le redémarrage de maintenance', 'Bonjour, après le redémarrage de maintenance de ce soir, le serveur Linux ne répond plus ni au ping ni en SSH. Sur la console, il attend longtemps puis affiche « You are in emergency mode ». Quelqu’un avait modifié /etc/fstab avant de redémarrer.'),
  cause: 'Une entrée de /etc/fstab est invalide : {{m.label}}. Sans l’option nofail, systemd attend 90 secondes puis abandonne local-fs.target : le système démarre en mode d’urgence, sans réseau ni services.',
  solution: 'Depuis la console (mot de passe root), corriger /etc/fstab (blkid pour l’UUID réel), vérifier avec mount -a, puis redémarrer.',
  hints: ['La machine est allumée mais n’a pas de réseau : elle n’a pas fini de démarrer. La console est le seul accès.', 'Sur la console du mode d’urgence : journalctl -xb désigne le montage en échec ; blkid donne les UUID réels ; cat /etc/fstab montre ce qui est déclaré.', 'Corrigez la ligne, testez avec mount -a, puis systemctl reboot. L’option nofail masquerait l’erreur sans la corriger.'],
  inject: ['{{m.step}}', { do: 'reboot', dev: LNX }],
  probes: [{ t: 'lxboot', dev: LNX }, { t: 'ping', from: 'PC-ADM', to: '10.10.10.30' }, SSH_PROBE[0]],
  roots: [{ probe: { t: 'fstabok', dev: LNX } }],
  fix: ['{{m.back}}', { do: 'reboot', dev: LNX }],
  traps: ['Ajouter nofail fait démarrer le système mais sans /var : les services et la base partent en erreur.', 'Commenter la ligne de /var a le même effet qu’un nofail : fausse résolution.'],
  optimal: ['Constater : pas de réseau, console en mode d’urgence', 'journalctl -xb', 'blkid + cat /etc/fstab', 'Corriger la ligne et tester (mount -a)', 'Redémarrer et retester'] });

/* ======================= RÉSEAU DEBIAN ======================= */
add({ id: 'lx_net', level: 2, title: 'SRV-WEB n’atteint plus l’extérieur (réseau Debian)', skills: ['lx-reseau', 'diag'],
  vary: { m: [
    { key: 'gw', inj: [rep(WEB, '/etc/network/interfaces', 'gateway 10.10.50.1', 'gateway 10.10.50.254'), { do: 'lx.netapply', dev: WEB }], fix: [rep(WEB, '/etc/network/interfaces', 'gateway 10.10.50.254', 'gateway 10.10.50.1'), { do: 'lx.netapply', dev: WEB }], label: 'la passerelle par défaut est 10.10.50.254 au lieu de 10.10.50.1 dans /etc/network/interfaces' },
    { key: 'masque', inj: [rep(WEB, '/etc/network/interfaces', 'address 10.10.50.10/24', 'address 10.10.50.10/30'), { do: 'lx.netapply', dev: WEB }], fix: [rep(WEB, '/etc/network/interfaces', 'address 10.10.50.10/30', 'address 10.10.50.10/24'), { do: 'lx.netapply', dev: WEB }], label: 'le masque est /30 au lieu de /24 : la passerelle 10.10.50.1 n’est plus dans le sous-réseau local' },
    { key: 'dns', inj: [rep(WEB, '/etc/resolv.conf', 'nameserver 10.10.50.1', 'nameserver 10.10.50.99')], fix: [rep(WEB, '/etc/resolv.conf', 'nameserver 10.10.50.99', 'nameserver 10.10.50.1')], label: 'resolv.conf désigne un serveur DNS inexistant (10.10.50.99) : les noms ne se résolvent plus alors que les adresses IP restent joignables' },
    { key: 'hosts', inj: [{ do: 'lx.append', dev: WEB, path: '/etc/hosts', content: '10.10.10.77 www.exemple.fr\n' }], fix: [rep(WEB, '/etc/hosts', '10.10.10.77 www.exemple.fr\n', '')], label: 'une ligne obsolète dans /etc/hosts force www.exemple.fr vers 10.10.10.77 et prend le pas sur le DNS' }
  ] },
  ticket: tk('Admin TSSR (informatique)', 'SRV-WEB ne joint plus les dépôts de mises à jour', 'Bonjour, depuis une modification de la configuration réseau, SRV-WEB (DMZ) n’arrive plus à joindre l’extérieur : apt update échoue et les connexions sortantes ne passent pas. Le site, lui, répond encore (ou plus selon les cas).'),
  cause: 'Sur SRV-WEB, {{m.label}}.',
  solution: 'Corriger la configuration réseau (interfaces, resolv.conf ou hosts), appliquer la configuration et vérifier la sortie vers Internet et la résolution de noms.',
  hints: ['Testez d’abord par adresse IP, puis par nom : cela sépare le routage de la résolution.', 'ip a, ip route, cat /etc/resolv.conf, cat /etc/hosts, getent hosts www.exemple.fr : lequel donne un résultat anormal ?', 'Corrigez le fichier, appliquez la configuration (systemctl restart networking pour interfaces), puis retestez.'],
  inject: '{{m.inj}}',
  probes: [{ t: 'connect', from: WEB, to: '93.184.216.34', port: 443 }, { t: 'resolve', from: WEB, name: 'www.exemple.fr', expect: '93.184.216.34' }],
  roots: [{ path: WEB + '.ifaces.eth0.gw', eq: '10.10.50.1' }, { path: WEB + '.ifaces.eth0.mask', eq: '255.255.255.0' }, { probe: { t: 'lxfile', dev: WEB, path: '/etc/hosts', absent: '10.10.10.77' } }, { probe: { t: 'lxfile', dev: WEB, path: '/etc/resolv.conf', contains: 'nameserver 10.10.50.1' } }],
  fix: '{{m.fix}}',
  traps: ['Ajouter une route à la main (ip route add) ne survit pas au redémarrage : seule la modification du fichier est durable.'],
  optimal: ['Tester par IP puis par nom', 'ip a / ip route / resolv.conf / hosts', 'Identifier la cause', 'Corriger le fichier et appliquer', 'Retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
