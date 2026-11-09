/* ============================================================================
   Hôtes Linux (Debian 13) : système de fichiers amorcé, comptes, services.
   Trois machines : SRV-LNX (intranet + DNS de zone déléguée + MariaDB),
   SRV-WEB (vitrine nginx en DMZ), SRV-RV (Ramonville : DNS + web).
   Les fichiers de configuration sont la vérité ; tout symptôme en découle.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, WB = SIM.WB, LX = SIM.lx;

/* ---------- petit constructeur de VFS ---------- */
function FS(d) {
  d.fs = d.fs || {};
  const T0 = Date.UTC(2026, 8, 14, 9, 0, 0);
  const mk = (p, node) => { d.fs[p] = Object.assign({ mt: T0 }, node); };
  const parents = p => { const parts = p.split('/').filter(Boolean); let cur = ''; for (let i = 0; i < parts.length - 1; i++) { cur += '/' + parts[i]; if (!d.fs[cur]) mk(cur, { t: 'd', m: '0755', o: 'root', g: 'root' }); } };
  const api = {
    dir(p, m, o, gr) { parents(p); mk(p, { t: 'd', m: m || '0755', o: o || 'root', g: gr || 'root' }); return api; },
    f(p, c, m, o, gr) { parents(p); mk(p, { t: 'f', c, m: m || '0644', o: o || 'root', g: gr || 'root' }); return api; },
    l(p, target) { parents(p); mk(p, { t: 'l', target, m: '0777', o: 'root', g: 'root' }); return api; }
  };
  return api;
}

const PASSWD_BASE = [
  'root:x:0:0:root:/root:/bin/bash', 'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin', 'bin:x:2:2:bin:/bin:/usr/sbin/nologin', 'sys:x:3:3:sys:/dev:/usr/sbin/nologin',
  'sync:x:4:65534:sync:/bin:/bin/sync', 'man:x:6:12:man:/var/cache/man:/usr/sbin/nologin', 'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
  'backup:x:34:34:backup:/var/backups:/usr/sbin/nologin', '_apt:x:42:65534::/nonexistent:/usr/sbin/nologin', 'nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin',
  'sshd:x:101:65534::/run/sshd:/usr/sbin/nologin'
];
const GROUP_BASE = [
  'root:x:0:', 'daemon:x:1:', 'bin:x:2:', 'sys:x:3:', 'adm:x:4:', 'tty:x:5:', 'disk:x:6:', 'mail:x:8:', 'www-data:x:33:', 'backup:x:34:', 'sudo:x:27:', 'staff:x:50:', 'users:x:100:', 'nogroup:x:65534:'
];

/* base commune d'une machine Debian */
WB.linuxBase = function (id, o) {
  const d = {
    kind: 'linux', name: id, hostname: o.hostname || id.toLowerCase(), os: 'Debian GNU/Linux 13 (trixie)', kernel: '6.12.48+deb13-amd64', arch: 'x86_64',
    ifaces: { eth0: { mac: U.mac(id + 'eth0'), ip: o.ip, mask: o.mask || '255.255.255.0', gw: o.gw || '', dns: o.dnsList || [], dhcp: false, cable: null } },
    phys: { on: true, psu: true, strip: true }, svc: {}, ufw: { enabled: true, defaultIn: 'deny', defaultOut: 'allow', rules: [] }, fs: {}, disk: { root: { sizeMB: 20480, usePct: 22 }, var: { sizeMB: 8192, usePct: 14 } },
    users: {}, boot: { fsck: 'ok' }
  };
  /* UUID de systèmes de fichiers propres à la machine (aléatoires v4 à la création du système réel) ; espace de base = occupation initiale hors fichiers à taille déclarée */
  const uuid = (k) => { const h = U.hash8(id + k + 'a') + U.hash8(id + k + 'b') + U.hash8(id + k + 'c') + U.hash8(id + k + 'd'); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32); };
  Object.keys(d.disk).forEach(k => { d.disk[k].uuid = uuid(k); d.disk[k].fstype = 'ext4'; d.disk[k].baseMB = Math.round(d.disk[k].usePct * d.disk[k].sizeMB / 100); });
  d.swapUuid = uuid('swap');
  const fs = FS(d);
  const pw = PASSWD_BASE.slice(), gr = GROUP_BASE.slice(); const shadow = ['root:$y$j9T$simule$simule:20000:0:99999:7:::'];
  (o.accounts || []).forEach((a, i) => {
    pw.push(a.name + ':x:' + (1000 + i) + ':' + (1000 + i) + ':' + (a.gecos || a.name) + ',,,:/home/' + a.name + ':/bin/bash');
    gr.push(a.name + ':x:' + (1000 + i) + ':'); shadow.push(a.name + ':$y$j9T$simule$simule:20000:0:99999:7:::');
  });
  (o.extraPasswd || []).forEach(l => pw.push(l)); (o.extraGroup || []).forEach(l => gr.push(l));
  const sudoLine = gr.findIndex(l => l.startsWith('sudo:'));
  const sudoers = (o.sudo || []); if (sudoers.length) gr[sudoLine] = 'sudo:x:27:' + sudoers.join(',');
  fs.f('/etc/passwd', pw.join('\n') + '\n').f('/etc/group', gr.join('\n') + '\n').f('/etc/shadow', shadow.join('\n') + '\n', '0640', 'root', 'shadow');
  fs.f('/etc/hostname', d.hostname + '\n').f('/etc/hosts', '127.0.0.1\tlocalhost\n127.0.1.1\t' + d.hostname + '.' + (o.domain || 'toulouse.local') + ' ' + d.hostname + '\n\n::1\tlocalhost ip6-localhost ip6-loopback\nff02::1\tip6-allnodes\nff02::2\tip6-allrouters\n');
  const prefix = o.mask ? o.mask.split('.').reduce((a, b) => a + (+b).toString(2).replace(/0/g, '').length, 0) : 24;
  fs.f('/etc/network/interfaces', '# This file describes the network interfaces available on your system\n# and how to activate them. For more information, see interfaces(5).\n\nsource /etc/network/interfaces.d/*\n\n# The loopback network interface\nauto lo\niface lo inet loopback\n\n# The primary network interface\nallow-hotplug eth0\niface eth0 inet static\n\taddress ' + o.ip + '/' + prefix + '\n\tgateway ' + (o.gw || '') + '\n');
  fs.f('/etc/resolv.conf', 'search ' + (o.domain || 'toulouse.local') + '\n' + (o.dnsList || []).map(x => 'nameserver ' + x).join('\n') + '\n');
  fs.f('/etc/os-release', 'PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nNAME="Debian GNU/Linux"\nVERSION_ID="13"\nVERSION="13 (trixie)"\nVERSION_CODENAME=trixie\nDEBIAN_VERSION_FULL=13.1\nID=debian\nHOME_URL="https://www.debian.org/"\nSUPPORT_URL="https://www.debian.org/support"\nBUG_REPORT_URL="https://bugs.debian.org/"\n');
  fs.f('/etc/fstab', '# <file system> <mount point>   <type>  <options>       <dump>  <pass>\nUUID=' + d.disk.root.uuid + ' /               ext4    errors=remount-ro 0       1\nUUID=' + d.disk.var.uuid + ' /var            ext4    defaults        0       2\nUUID=' + d.swapUuid + ' none            swap    sw              0       0\n');
  fs.f('/etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\n\nPort 22\n#AddressFamily any\n#ListenAddress 0.0.0.0\n\nPermitRootLogin prohibit-password\nPubkeyAuthentication yes\nPasswordAuthentication yes\nKbdInteractiveAuthentication no\nUsePAM yes\nX11Forwarding yes\nPrintMotd no\nAcceptEnv LANG LC_*\nSubsystem\tsftp\t/usr/lib/openssh/sftp-server\n', '0644');
  fs.dir('/root', '0700').dir('/tmp', '1777').dir('/var/log').dir('/var/backups').dir('/srv').dir('/opt').dir('/usr/local/bin');
  fs.f('/etc/crontab', 'SHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n# m h dom mon dow user  command\n17 *\t* * *\troot    cd / && run-parts --report /etc/cron.hourly\n25 6\t* * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }\n');
  (o.accounts || []).forEach((a, i) => {
    const uid = 1000 + i;
    fs.dir('/home/' + a.name, '0750', a.name, a.name);
    fs.f('/home/' + a.name + '/.bashrc', '# ~/.bashrc: executed by bash(1) for non-login shells.\n', '0644', a.name, a.name);
    fs.f('/home/' + a.name + '/.profile', '# ~/.profile: executed by the command interpreter for login shells.\n', '0644', a.name, a.name);
    if (a.key) { fs.dir('/home/' + a.name + '/.ssh', '0700', a.name, a.name); fs.f('/home/' + a.name + '/.ssh/authorized_keys', a.key + '\n', '0600', a.name, a.name); }
  });
  d.svc.ssh = { enabled: true, state: 'inactive', sub: 'dead' };
  d.svc.cron = { enabled: true, state: 'inactive', sub: 'dead' };
  (o.ufwRules || []).forEach(r => d.ufw.rules.push(r));
  return d;
};

const KEY_TSSR = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJd4s5mUlA0xT8n1Qw7kYb2GfHc9RpVoXe3ZtNqLmSuA tssr@PC-ADM';

/* ---------- SRV-LNX : intranet Apache, MariaDB, BIND9 (zone déléguée labo.toulouse.local) ---------- */
WB.srvLnx = function () {
  const d = WB.linuxBase('SRV-LNX', {
    ip: '10.10.10.30', gw: '10.10.10.1', dnsList: ['10.10.10.10'], domain: 'toulouse.local', accounts: [{ name: 'tssr', gecos: 'Admin TSSR', key: KEY_TSSR }, { name: 'tech', gecos: 'Technicien' }], sudo: ['tssr'],
    ufwRules: [
      { to: '22/tcp', from: '10.10.0.0/16', action: 'ALLOW' }, { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' },
      { to: '53', from: '10.10.0.0/16', action: 'ALLOW' }, { to: '3306/tcp', from: '10.10.10.0/24', action: 'ALLOW' }, { to: '3306/tcp', from: '10.10.20.60', action: 'ALLOW' }
    ]
  });
  const fs = FS(d);
  /* Apache */
  fs.f('/etc/apache2/apache2.conf', '# Configuration principale apache2 (extrait Debian)\nDefaultRuntimeDir ${APACHE_RUN_DIR}\n');
  fs.f('/etc/apache2/ports.conf', 'Listen 80\n');
  ['alias', 'authz_core', 'authz_host', 'deflate', 'dir', 'mime', 'negotiation', 'rewrite', 'setenvif', 'status'].forEach(m => { fs.l('/etc/apache2/mods-enabled/' + m + '.load', '../mods-available/' + m + '.load'); fs.f('/etc/apache2/mods-available/' + m + '.load', 'LoadModule ' + m + '_module /usr/lib/apache2/modules/mod_' + m + '.so\n'); });
  fs.f('/etc/apache2/mods-available/ssl.load', 'LoadModule ssl_module /usr/lib/apache2/modules/mod_ssl.so\n');
  fs.f('/etc/apache2/sites-available/intranet.conf',
    '<VirtualHost *:80>\n\tServerName intranet.toulouse.local\n\tServerAdmin webmaster@toulouse.local\n\tDocumentRoot /var/www/intranet\n\n\t<Directory /var/www/intranet>\n\t\tOptions -Indexes +FollowSymLinks\n\t\tAllowOverride None\n\t\tRequire all granted\n\t</Directory>\n\n\tErrorLog ${APACHE_LOG_DIR}/intranet_error.log\n\tCustomLog ${APACHE_LOG_DIR}/intranet_access.log combined\n</VirtualHost>\n');
  fs.l('/etc/apache2/sites-enabled/intranet.conf', '../sites-available/intranet.conf');
  fs.dir('/var/www', '0755').dir('/var/www/intranet', '0755', 'root', 'root');
  fs.f('/var/www/intranet/index.html', '<!DOCTYPE html>\n<html lang="fr"><head><meta charset="utf-8"><title>Intranet FormaTech</title></head>\n<body><h1>Intranet FormaTech</h1><p>Bienvenue sur l’intranet de l’agence de Toulouse.</p></body></html>\n', '0644', 'root', 'root');
  d.svc.apache2 = { enabled: true, state: 'inactive', sub: 'dead' };
  /* MariaDB */
  fs.f('/etc/mysql/mariadb.conf.d/50-server.cnf', '[mysqld]\nuser                    = mysql\nbind-address            = 0.0.0.0\nport                    = 3306\ndatadir                 = /var/lib/mysql\n');
  fs.dir('/var/lib/mysql', '0755', 'mysql', 'mysql');
  d.svc.mariadb = { enabled: true, state: 'inactive', sub: 'dead' };
  d.db = { databases: ['information_schema', 'mysql', 'performance_schema', 'sys', 'intranet'], users: [{ user: 'intranet', host: '10.10.10.%', db: 'intranet', grants: 'ALL PRIVILEGES' }, { user: 'root', host: 'localhost', db: '*', grants: 'ALL PRIVILEGES' }] };
  d.fs['/etc/passwd'].c += 'mysql:x:102:105:MariaDB Server,,,:/nonexistent:/bin/false\nbind:x:103:106::/var/cache/bind:/usr/sbin/nologin\n';
  d.fs['/etc/group'].c += 'mysql:x:105:\nbind:x:106:\n';
  /* BIND9 */
  fs.f('/etc/bind/named.conf', 'include "/etc/bind/named.conf.options";\ninclude "/etc/bind/named.conf.local";\ninclude "/etc/bind/named.conf.default-zones";\n');
  fs.f('/etc/bind/named.conf.options', 'options {\n\tdirectory "/var/cache/bind";\n\n\trecursion yes;\n\tallow-query { any; };\n\tallow-recursion { 10.10.0.0/16; };\n\tforwarders {\n\t\t10.10.10.10;\n\t};\n\n\tdnssec-validation auto;\n\tlisten-on-v6 { any; };\n};\n');
  fs.f('/etc/bind/named.conf.local', 'zone "labo.toulouse.local" {\n\ttype master;\n\tfile "/etc/bind/db.labo.toulouse.local";\n};\n\nzone "10.10.10.in-addr.arpa" {\n\ttype master;\n\tfile "/etc/bind/db.10.10.10";\n};\n');
  fs.f('/etc/bind/db.10.10.10', '$TTL\t86400\n@\tIN\tSOA\tns1.labo.toulouse.local. admin.labo.toulouse.local. (\n\t\t\t2026100101\t; Serial\n\t\t\t3600\t\t; Refresh\n\t\t\t900\t\t; Retry\n\t\t\t604800\t\t; Expire\n\t\t\t86400 )\t; Negative Cache TTL\n;\n@\tIN\tNS\tns1.labo.toulouse.local.\n30\tIN\tPTR\twww.labo.toulouse.local.\n');
  fs.f('/etc/bind/named.conf.default-zones', '// zones par défaut (extrait)\n');
  fs.f('/etc/bind/db.labo.toulouse.local', '$TTL\t86400\n@\tIN\tSOA\tns1.labo.toulouse.local. admin.labo.toulouse.local. (\n\t\t\t2026100101\t; Serial\n\t\t\t3600\t\t; Refresh\n\t\t\t900\t\t; Retry\n\t\t\t604800\t\t; Expire\n\t\t\t86400 )\t; Negative Cache TTL\n;\n@\tIN\tNS\tns1.labo.toulouse.local.\nns1\tIN\tA\t10.10.10.30\nwww\tIN\tA\t10.10.10.30\ndb\tIN\tA\t10.10.10.30\nintra\tIN\tCNAME\twww\n');
  fs.dir('/var/cache/bind', '0775', 'root', 'bind');
  d.svc.bind9 = { enabled: true, state: 'inactive', sub: 'dead' };
  /* script de sauvegarde + cron */
  fs.dir('/opt/scripts', '0755').f('/opt/scripts/backup.sh', '#!/bin/bash\n# Sauvegarde quotidienne de la base intranet\nDEST=/var/backups/intranet\nmkdir -p "$DEST"\nmysqldump intranet | gzip > "$DEST/intranet-$(date +%F).sql.gz"\nfind "$DEST" -name \'*.sql.gz\' -mtime +14 -delete\n', '0755', 'root', 'root');
  fs.f('/etc/cron.d/backup-intranet', '# Sauvegarde de la base intranet\n30 2 * * * root /opt/scripts/backup.sh\n');
  /* échanges d'équipe : groupe techs, dossier partagé et dossier de rapports avec ACL POSIX */
  d.fs['/etc/group'].c += 'techs:x:1100:tech,tssr\n';
  fs.dir('/srv/echanges', '0770', 'root', 'techs').f('/srv/echanges/LISEZMOI.txt', 'Dossier d’échange de l’équipe technique.\n', '0660', 'root', 'techs');
  fs.dir('/srv/echanges/rapports', '0750', 'tssr', 'techs').f('/srv/echanges/rapports/rapport-septembre.txt', 'Rapport mensuel — septembre 2026\n', '0640', 'tssr', 'techs');
  d.fs['/srv/echanges/rapports'].acl = { users: { tech: 'rwx' }, mask: 'rwx' };
  /* sauvegardes existantes (tailles en Mo, comptées dans l'espace disque de /var) et sortie déclarée du job cron */
  fs.dir('/var/backups/intranet', '0755', 'root', 'root');
  ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].forEach(dt => { fs.f('/var/backups/intranet/intranet-' + dt + '.sql.gz', '', '0644', 'root', 'root'); d.fs['/var/backups/intranet/intranet-' + dt + '.sql.gz'].sz = 12; });
  d.fs['/var/backups/intranet'].mt = Date.UTC(2026, 9, 26, 2, 30, 0);
  d.cronOut = { '/opt/scripts/backup.sh': { dir: '/var/backups/intranet', name: 'intranet-%F.sql.gz', sizeMB: 12 } };
  fs.dir('/var/log/apache2', '0750', 'root', 'adm').f('/var/log/apache2/intranet_access.log', '', '0640', 'root', 'adm').f('/var/log/apache2/intranet_error.log', '', '0640', 'root', 'adm');
  d.disk.var.baseMB -= 48;
  d.cron = [{ file: '/etc/cron.d/backup-intranet', user: 'root', min: '30', hour: '2', dom: '*', mon: '*', dow: '*', cmd: '/opt/scripts/backup.sh' }];
  return d;
};

/* ---------- SRV-WEB : vitrine nginx en DMZ (publiée sur Internet via redirection de port pfSense) ---------- */
WB.srvWeb = function () {
  const d = WB.linuxBase('SRV-WEB', {
    ip: '10.10.50.10', gw: '10.10.50.1', dnsList: ['10.10.50.1'], domain: 'toulouse.local', accounts: [{ name: 'tssr', gecos: 'Admin TSSR', key: KEY_TSSR }], sudo: ['tssr'],
    ufwRules: [{ to: '22/tcp', from: '10.10.30.0/24', action: 'ALLOW' }, { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' }, { to: '443/tcp', from: 'Anywhere', action: 'ALLOW' }]
  });
  const fs = FS(d);
  fs.f('/etc/nginx/nginx.conf', 'user www-data;\nworker_processes auto;\npid /run/nginx.pid;\n\nevents {\n\tworker_connections 768;\n}\n\nhttp {\n\tsendfile on;\n\tserver_tokens off;\n\tinclude /etc/nginx/mime.types;\n\tdefault_type application/octet-stream;\n\taccess_log /var/log/nginx/access.log;\n\terror_log /var/log/nginx/error.log;\n\tinclude /etc/nginx/conf.d/*.conf;\n\tinclude /etc/nginx/sites-enabled/*;\n}\n');
  fs.f('/etc/nginx/sites-available/vitrine',
    'server {\n\tlisten 80;\n\tserver_name vitrine.formatech.fr;\n\treturn 301 https://$host$request_uri;\n}\n\nserver {\n\tlisten 443 ssl;\n\tserver_name vitrine.formatech.fr;\n\tssl_certificate /etc/ssl/certs/vitrine.formatech.fr.crt;\n\tssl_certificate_key /etc/ssl/private/vitrine.formatech.fr.key;\n\troot /var/www/vitrine;\n\tindex index.html;\n\n\tlocation / {\n\t\ttry_files $uri $uri/ =404;\n\t}\n}\n');
  fs.l('/etc/nginx/sites-enabled/vitrine', '../sites-available/vitrine');
  fs.f('/etc/ssl/certs/vitrine.formatech.fr.crt', '-----BEGIN CERTIFICATE-----\n(certificat simulé — vitrine.formatech.fr)\n-----END CERTIFICATE-----\n', '0644');
  fs.f('/etc/ssl/private/vitrine.formatech.fr.key', '-----BEGIN PRIVATE KEY-----\n(clé simulée)\n-----END PRIVATE KEY-----\n', '0600', 'root', 'root');
  fs.dir('/var/www/vitrine', '0755', 'www-data', 'www-data').f('/var/www/vitrine/index.html', '<!DOCTYPE html>\n<html lang="fr"><head><meta charset="utf-8"><title>FormaTech — Vitrine</title></head>\n<body><h1>FormaTech</h1><p>Formation et services informatiques à Toulouse, Bordeaux et Ramonville.</p></body></html>\n', '0644', 'www-data', 'www-data');
  d.svc.nginx = { enabled: true, state: 'inactive', sub: 'dead' };
  /* métadonnées de certificat lues par le moteur web (TLS) */
  d.tls = { '/etc/ssl/certs/vitrine.formatech.fr.crt': { cn: 'vitrine.formatech.fr', san: ['vitrine.formatech.fr'], issuer: 'AC-Publique-Demo', notBefore: '2026-03-01', notAfter: '2027-03-01', selfSigned: false } };
  return d;
};

/* ---------- SRV-RV : Ramonville (DNS ramonville.lan + site web Apache), en DMZ derrière R-RV1 ---------- */
WB.srvP = function () {
  const d = WB.linuxBase('SRV-RV', {
    ip: '172.16.3.10', gw: '172.16.3.1', dnsList: ['127.0.0.1'], domain: 'ramonville.lan', accounts: [{ name: 'admin', gecos: 'Administrateur' }, { name: 'tssr', gecos: 'Admin TSSR', key: KEY_TSSR }], sudo: ['admin', 'tssr'],
    ufwRules: [{ to: '22/tcp', from: '172.16.1.30', action: 'ALLOW' }, { to: '80/tcp', from: 'Anywhere', action: 'ALLOW' }, { to: '53', from: 'Anywhere', action: 'ALLOW' }]
  });
  const fs = FS(d);
  fs.f('/etc/apache2/ports.conf', 'Listen 80\n');
  ['alias', 'authz_core', 'authz_host', 'dir', 'mime'].forEach(m => { fs.l('/etc/apache2/mods-enabled/' + m + '.load', '../mods-available/' + m + '.load'); fs.f('/etc/apache2/mods-available/' + m + '.load', 'LoadModule ' + m + '_module /usr/lib/apache2/modules/mod_' + m + '.so\n'); });
  fs.f('/etc/apache2/sites-available/000-default.conf', '<VirtualHost *:80>\n\tServerName www.ramonville.lan\n\tServerAdmin webmaster@ramonville.lan\n\tDocumentRoot /var/www/html\n\tErrorLog ${APACHE_LOG_DIR}/error.log\n\tCustomLog ${APACHE_LOG_DIR}/access.log combined\n</VirtualHost>\n');
  fs.l('/etc/apache2/sites-enabled/000-default.conf', '../sites-available/000-default.conf');
  fs.dir('/var/www/html', '0755').f('/var/www/html/index.html', '<!DOCTYPE html>\n<html lang="fr"><head><meta charset="utf-8"><title>FormaTech Ramonville</title></head>\n<body><h1>FormaTech — site de Ramonville</h1></body></html>\n', '0644');
  d.svc.apache2 = { enabled: true, state: 'inactive', sub: 'dead' };
  fs.f('/etc/bind/named.conf', 'include "/etc/bind/named.conf.options";\ninclude "/etc/bind/named.conf.local";\ninclude "/etc/bind/named.conf.default-zones";\n');
  fs.f('/etc/bind/named.conf.options', 'options {\n\tdirectory "/var/cache/bind";\n\n\trecursion yes;\n\tallow-query { any; };\n\tallow-recursion { 172.16.0.0/16; localhost; };\n\tforwarders {\n\t\t8.8.8.8;\n\t};\n\n\tdnssec-validation auto;\n\tlisten-on-v6 { any; };\n};\n');
  fs.f('/etc/bind/named.conf.local', 'zone "ramonville.lan" {\n\ttype master;\n\tfile "/etc/bind/db.ramonville.lan";\n};\n');
  fs.f('/etc/bind/named.conf.default-zones', '// zones par défaut (extrait)\n');
  fs.f('/etc/bind/db.ramonville.lan', '$TTL\t86400\n@\tIN\tSOA\tns1.ramonville.lan. admin.ramonville.lan. (\n\t\t\t2026100101\t; Serial\n\t\t\t3600\t\t; Refresh\n\t\t\t900\t\t; Retry\n\t\t\t604800\t\t; Expire\n\t\t\t86400 )\t; Negative Cache TTL\n;\n@\tIN\tNS\tns1.ramonville.lan.\nns1\tIN\tA\t172.16.3.10\nwww\tIN\tA\t172.16.3.10\npc-p1\tIN\tA\t172.16.1.30\n');
  fs.dir('/var/cache/bind', '0775', 'root', 'bind');
  d.fs['/etc/passwd'].c += 'bind:x:103:106::/var/cache/bind:/usr/sbin/nologin\n'; d.fs['/etc/group'].c += 'bind:x:106:\n';
  d.svc.bind9 = { enabled: true, state: 'inactive', sub: 'dead' };
  return d;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
