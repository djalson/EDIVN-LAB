/* ============================================================================
   Constructeur de monde — outils de câblage et équipements réseau (ISP, pare-feu,
   commutateurs et routeurs Cisco) des trois sites : Toulouse, Bordeaux, Ramonville.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const WB = SIM.WB = {};

/* ---------- câblage ---------- */
WB.cableObj = to => ({ plugged: true, to });
WB.portOf = (dev, p) => (dev.ports && dev.ports[p]) || (dev.ifaces && dev.ifaces[p]);
/* Cordon direct entre deux ports : "DEV:PORT" */
WB.link = function (devs, a, b) {
  const A = a.split(':'), B = b.split(':');
  const pa = WB.portOf(devs[A[0]], A[1]), pb = WB.portOf(devs[B[0]], B[1]);
  if (!pa || !pb) throw new Error('link: port inconnu ' + a + ' / ' + b);
  pa.cable = WB.cableObj(b); pb.cable = WB.cableObj(a);
};
/* Prise murale : le poste est relié à la prise, la prise est brassée vers un port de commutateur */
WB.wall = function (W, wallId, swPort, hostPort) {
  const S = swPort ? swPort.split(':') : null;
  W.walls[wallId] = swPort || null;
  if (swPort) WB.portOf(W.dev[S[0]], S[1]).cable = WB.cableObj('patch:' + wallId);
  if (hostPort) { const H = hostPort.split(':'); WB.portOf(W.dev[H[0]], H[1]).cable = WB.cableObj('wall:' + wallId); }
};

/* ---------- équipements ---------- */
WB.swPort = (o) => Object.assign({ mode: 'access', vlan: 1, cable: null }, o || {});
WB.ports = (names) => { const p = {}; names.forEach(n => p[n] = WB.swPort()); return p; };
const fa = n => Array.from({ length: n }, (_, i) => 'FastEthernet0/' + (i + 1));

WB.sshCfg = () => ({ ssh: { version: 2, rsa: true, timeout: 120, retries: 3 }, lines: { vty: { transport: ['ssh'], login: 'local' }, console: { login: 'none' } } });

WB.buildNet = function (W) {
  const dev = W.dev;
  /* ================= ISP ================= */
  dev.ISP = {
    kind: 'isp', name: 'ISP', ifaces: {
      'to-T': { ip: '198.51.100.1', mask: '255.255.255.252', cable: null }, 'to-B': { ip: '203.0.113.1', mask: '255.255.255.252', cable: null },
      'to-RV': { ip: '192.0.2.1', mask: '255.255.255.252', cable: null }, 'to-LB': { ip: '192.0.2.5', mask: '255.255.255.252', cable: null }, 'to-X': { ip: '198.18.0.1', mask: '255.255.255.0', cable: null }
    },
    pub: {
      '8.8.8.8': { name: 'dns.google', svc: ['udp/53', 'tcp/53'] },
      /* autres résolveurs publics qu'un technicien met spontanément en redirecteur ou pour tester */
      '1.1.1.1': { name: 'one.one.one.one', svc: ['udp/53', 'tcp/53'] }, '9.9.9.9': { name: 'dns.quad9.net', svc: ['udp/53', 'tcp/53'] },
      '93.184.216.34': { name: 'www.exemple.fr', svc: ['tcp/80', 'tcp/443'] },
      '142.250.74.227': { name: 'www.google.fr', svc: ['tcp/80', 'tcp/443'] },
      '185.15.59.224': { name: 'wikipedia.org', svc: ['tcp/80', 'tcp/443'], pages: { '*': { title: 'Encyclopédie', html: '<h1>Encyclopédie libre</h1><p>Page d’accueil fictive.</p>' } } },
      '198.51.100.50': { name: 'deb.debian.org', svc: ['tcp/80', 'tcp/443'] },
      /* sites visités pendant le TP Proxy ; adresses fictives de la plage de documentation, sauf le serveur SafeSearch (valeur relevée en TP) */
      '198.51.100.61': { name: 'www.google.com', svc: ['tcp/80', 'tcp/443', 'udp/443'], pages: { '/safesearch': { title: 'SafeSearch', html: '<h1>SafeSearch</h1><p><b>Filtering Off</b></p><p>Vous pouvez activer le filtrage SafeSearch pour masquer les contenus explicites.</p>' }, '*': { title: 'Recherche', html: '<h1>Recherche</h1><p>Page d’accueil du moteur de recherche (simulation).</p>' } } },
      '216.239.38.120': { name: 'forcesafesearch.google.com', svc: ['tcp/80', 'tcp/443', 'udp/443'], pages: { '/safesearch': { title: 'SafeSearch', html: '<h1>SafeSearch</h1><p><b>Filtering On</b></p><p>🔒 Cette option est verrouillée par l’administrateur de votre réseau : vos paramètres de recherche sont contrôlés par votre réseau et ne peuvent pas être modifiés.</p>' }, '*': { title: 'Recherche', html: '<h1>Recherche</h1><p>Page d’accueil du moteur de recherche, SafeSearch verrouillé (simulation).</p>' } } },
      '198.51.100.62': { name: 'neverssl.com', svc: ['tcp/80'], pages: { '*': { title: 'NeverSSL', html: '<h1>NeverSSL</h1><p>Cette page sert à tester la navigation en HTTP : elle n’utilise jamais le chiffrement (simulation).</p>' } } },
      '198.51.100.63': { name: 'www.facebook.com', svc: ['tcp/80', 'tcp/443', 'udp/443'], pages: { '*': { title: 'Réseau social', html: '<h1>Réseau social</h1><p>Page publique fictive.</p>' } } },
      '198.51.100.64': { name: 'www.youtube.com', svc: ['tcp/80', 'tcp/443', 'udp/443'], pages: { '*': { title: 'Vidéos', html: '<h1>Plateforme vidéo</h1><p>Page publique fictive.</p>' } } },
      '198.51.100.65': { name: 'www.instagram.com', svc: ['tcp/80', 'tcp/443', 'udp/443'], pages: { '*': { title: 'Photos', html: '<h1>Réseau social photo</h1><p>Page publique fictive.</p>' } } },
      '198.51.100.66': { name: 'site-adulte.example', svc: ['tcp/80', 'tcp/443'], pages: { '*': { title: 'Site pour adultes (fictif)', html: '<h1>Site pour adultes (fictif)</h1><p>Domaine fictif utilisé pour tester la catégorie « adult ».</p>' } } },
      '198.51.100.67': { name: 'dsi.ut-capitole.fr', svc: ['tcp/80', 'tcp/443'] },
      '198.51.100.68': { name: 'pkg.netgate.com', svc: ['tcp/80', 'tcp/443'] }
    },
    dnsZone: { 'www.exemple.fr': '93.184.216.34', 'exemple.fr': '93.184.216.34', 'google.fr': '142.250.74.227', 'www.google.fr': '142.250.74.227', 'wikipedia.org': '185.15.59.224', 'www.formatech.fr': '198.51.100.2', 'vitrine.formatech.fr': '198.51.100.2', 'vpn.formatech.fr': '198.51.100.2', 'bordeaux.formatech.fr': '203.0.113.2', 'deb.debian.org': '198.51.100.50', 'security.debian.org': '198.51.100.50', 'www.wikipedia.org': '185.15.59.224', 'www.google.com': '198.51.100.61', 'google.com': '198.51.100.61', 'forcesafesearch.google.com': '216.239.38.120', 'neverssl.com': '198.51.100.62', 'www.facebook.com': '198.51.100.63', 'facebook.com': '198.51.100.63', 'www.youtube.com': '198.51.100.64', 'youtube.com': '198.51.100.64', 'www.instagram.com': '198.51.100.65', 'instagram.com': '198.51.100.65', 'site-adulte.example': '198.51.100.66', 'www.site-adulte.example': '198.51.100.66', 'dsi.ut-capitole.fr': '198.51.100.67', 'pkg.netgate.com': '198.51.100.68' }
  };

  /* ================= TOULOUSE ================= */
  dev['pfsense-tls'] = {
    kind: 'pf', product: 'pfSense', name: 'pfsense-tls', hostname: 'pfsense-tls', domain: 'toulouse.local',
    ifaces: {
      wan: { name: 'WAN', dev: 'hn0', ip: '198.51.100.2', mask: '255.255.255.252', cable: null, blockPrivate: true, blockBogons: true },
      lan: { name: 'LAN', dev: 'hn1', ip: '10.10.0.1', mask: '255.255.255.252', cable: null },
      dmz: { name: 'DMZ', dev: 'hn2', ip: '10.10.50.1', mask: '255.255.255.0', cable: null },
      enc0: { name: 'IPsec', virtual: true }, ovpns1: { name: 'OpenVPN', virtual: true, ip: '10.99.0.1', mask: '255.255.255.0' }
    },
    gateways: [{ name: 'WAN_GW', iface: 'wan', ip: '198.51.100.1', default: true, descr: 'Passerelle opérateur' }, { name: 'SWT1_GW', iface: 'lan', ip: '10.10.0.2', lanGw: true, descr: 'SW-T1 (routage inter-VLAN)' }],
    routes: [{ net: '10.10.10.0', mask: '255.255.255.0', nh: '10.10.0.2' }, { net: '10.10.20.0', mask: '255.255.255.0', nh: '10.10.0.2' }, { net: '10.10.30.0', mask: '255.255.255.0', nh: '10.10.0.2' }],
    aliases: [
      { name: 'RFC1918', type: 'network', values: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] },
      { name: 'WEB_PORTS', type: 'port', values: ['80', '443'] },
      { name: 'ADMIN_HOSTS', type: 'host', values: ['10.10.30.10'] },
      { name: 'LAN_NETS', type: 'network', values: ['10.10.10.0/24', '10.10.20.0/24', '10.10.30.0/24'] }
    ],
    rules: {
      wan: [{ id: 'w1', act: 'pass', proto: 'udp', src: { t: 'any' }, dst: { t: 'ifaddr', v: 'wan' }, dport: '1194', descr: 'OpenVPN accès distant' }],
      lan: [{ id: 'l1', act: 'pass', proto: 'any', src: { t: 'any' }, dst: { t: 'any' }, descr: 'Autoriser LAN vers tout' }],
      dmz: [
        { id: 'd1', act: 'pass', proto: 'tcp/udp', src: { t: 'ifnet', v: 'dmz' }, dst: { t: 'ifaddr', v: 'dmz' }, dport: '53', descr: 'DMZ : DNS vers le pare-feu' },
        { id: 'd2', act: 'pass', proto: 'tcp', src: { t: 'ifnet', v: 'dmz' }, dst: { t: 'alias', v: 'RFC1918', neg: true }, dport: 'WEB_PORTS', descr: 'DMZ : web sortant (mises à jour)' },
        { id: 'd3', act: 'pass', proto: 'icmp', icmpType: 'echoreq', src: { t: 'ifnet', v: 'dmz' }, dst: { t: 'any' }, descr: 'DMZ : ping' }
      ],
      enc0: [{ id: 'i1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.20.0.0/16' }, dst: { t: 'net', v: '10.10.0.0/16' }, descr: 'IPsec Bordeaux → Toulouse' }],
      ovpns1: [{ id: 'o1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.99.0.0/24' }, dst: { t: 'alias', v: 'LAN_NETS' }, descr: 'OpenVPN → LAN' }]
    },
    nat: {
      outbound: { mode: 'hybrid', rules: [{ iface: 'wan', src: { t: 'net', v: '10.10.0.0/16' }, transl: 'iface', descr: 'VLAN Toulouse derrière routes statiques' }] },
      portfwd: [{ iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '443', target: '10.10.50.10', tport: '443', assoc: 'pass', descr: 'Publication vitrine HTTPS' }],
      one2one: []
    },
    ipsec: {
      enabled: true, tunnels: [{
        id: 'con1', descr: 'Toulouse ↔ Bordeaux',
        p1: { ike: 'ikev2', iface: 'wan', remoteGw: '203.0.113.2', auth: 'psk', psk: 'Bx-Tls-2026!', encr: 'aes256', hash: 'sha256', dh: 14, lifetime: 28800, dpd: true },
        p2: [{ mode: 'tunnel', local: '10.10.0.0/16', remote: '10.20.0.0/16', proto: 'esp', encr: 'aes256', hash: 'sha256', pfs: 14, lifetime: 3600 }]
      }]
    },
    openvpn: {
      servers: [{ id: 1, descr: 'Accès distant Toulouse', proto: 'udp4', port: 1194, ca: 'CA-FormaTech', cert: 'srv-pfsense-tls', tunnelNet: '10.99.0.0/24', localNets: ['10.10.0.0/16'], tls: true, tlsKey: 'tlsk-01' }],
      cas: [{ name: 'CA-FormaTech', expires: '2036-09-16' }],
      certs: [{ name: 'srv-pfsense-tls', ca: 'CA-FormaTech', type: 'server', cn: 'pfsense-tls' }, { name: 'cert-tssr', ca: 'CA-FormaTech', type: 'user', cn: 'tssr' }],
      users: [{ name: 'tssr', cert: 'cert-tssr' }]
    },
    dns: { unbound: { enabled: true, hostOverrides: [{ host: 'www', domain: 'google.com', ip: '216.239.38.120', descr: 'SafeSearch forcé', aliases: [{ host: 'www', domain: 'google.fr', descr: '' }] }], domainOverrides: [{ domain: 'toulouse.local', server: '10.10.10.10' }] }, servers: ['8.8.8.8'] },
    system: { webgui: { proto: 'https', port: 443 }, ssh: { enabled: true, port: 22 }, antilockout: true },
    /* paquets et configuration du proxy (TP Proxy) : état sain = Squid sur le LAN en mode explicite + squidGuard actif */
    packages: [{ name: 'squid', ver: '0.4.46', broken: false }, { name: 'squidGuard', ver: '1.16.19', broken: false }, { name: 'snort', ver: '4.1.6', broken: false }],
    squid: {
      enabled: true, stopped: false, port: 3128, ifaces: ['lan'], allowUsers: true, cacheSaved: true,
      transparent: false, transIfaces: [], ssl: { on: false, mode: 'splice', ifaces: ['lan'], port: 3129, ca: '' },
      log: { access: true }, acl: { allowedSubnets: ['10.10.0.0/16'], whitelist: [], blacklist: ['facebook.com', 'youtube.com'] }
    },
    squidguard: {
      enabled: true, stopped: false, log: true, guiLog: true,
      blacklist: { on: true, url: 'http://dsi.ut-capitole.fr/blacklists/download/blacklists_for_pfsense.tar.gz' },
      acl: { cats: { social_networks: 'deny', adult: 'deny' }, default: 'allow' }
    },
    /* base de catégories construite sur le disque par « Download » (hors configuration enregistrée) */
    sgdb: { loaded: true, count: 69 },
    /* IDS/IPS Snort (TP IDS/IPS) : état sain = une instance sur WAN (mode Legacy, blocage de l'adresse source) et une sur LAN
       (alerte sur le Telnet sortant) ; seules les règles de custom.rules déclenchent des alertes (voir docs/LIMITES.md) */
    snort: {
      global: { community: true, etopen: false, vrt: false },
      passLists: [],
      ifaces: [
        { iface: 'wan', descr: 'WAN', enabled: true, stopped: false, ips: 'legacy', block: true, blockWhich: 'src', homeNet: 'default', homeNetList: [], passList: 'default', syslog: false,
          custom: 'alert icmp $EXTERNAL_NET any -> $HOME_NET any (msg:"ICMP depuis Internet vers le pare-feu"; itype:8; classtype:icmp-event; sid:1000001; rev:1;)\nalert tcp $EXTERNAL_NET any -> $HOME_NET 22 (msg:"Tentative de connexion SSH depuis Internet"; flags:S; classtype:attempted-admin; sid:1000002; rev:1;)' },
        { iface: 'lan', descr: 'LAN', enabled: true, stopped: false, ips: 'legacy', block: true, blockWhich: 'src', homeNet: 'default', homeNetList: [], passList: 'default', syslog: false,
          custom: 'alert tcp $HOME_NET any -> $EXTERNAL_NET 23 (msg:"Telnet sortant depuis le LAN"; flags:S; classtype:policy-violation; sid:1000003; rev:1;)' }
      ]
    },
    snortBlocked: []
  };
  dev['SW-DMZ'] = { kind: 'sw-dumb', name: 'SW-DMZ', ports: WB.ports(['p1', 'p2', 'p3', 'p4']), phys: { on: true } };

  dev['SW-T1'] = {
    kind: 'ios-sw', name: 'SW-T1', hostname: 'SW-T1', model: 'Catalyst 3560-24PS', domain: 'toulouse.local', ipRouting: true,
    ports: Object.assign(WB.ports(fa(24).concat(['GigabitEthernet0/1', 'GigabitEthernet0/2'])), {}),
    vlans: { 1: { name: 'default' }, 10: { name: 'SERVEURS' }, 20: { name: 'POSTES' }, 30: { name: 'ADMIN' }, 100: { name: 'LIAISON-FW' } },
    svi: {
      Vlan10: { ip: '10.10.10.1', mask: '255.255.255.0' },
      Vlan20: { ip: '10.10.20.1', mask: '255.255.255.0', helpers: ['10.10.10.10'] },
      Vlan30: { ip: '10.10.30.1', mask: '255.255.255.0' },
      Vlan100: { ip: '10.10.0.2', mask: '255.255.255.252' }
    },
    routes: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '10.10.0.1', ad: 1 }], acls: {}, phys: { on: true },
    banner: 'Acces reserve au personnel autorise', enableSecret: true, users: [{ name: 'admin', priv: 15 }],
  };
  Object.assign(dev['SW-T1'], WB.sshCfg());
  const b1 = dev['SW-T1'].ports;
  b1['FastEthernet0/1'].vlan = 100; b1['FastEthernet0/1'].desc = 'vers pfsense-tls LAN';
  ['FastEthernet0/2', 'FastEthernet0/3', 'FastEthernet0/4'].forEach(p => b1[p].vlan = 10);
  b1['FastEthernet0/2'].desc = 'SRV-DC1'; b1['FastEthernet0/3'].desc = 'SRV-FIC'; b1['FastEthernet0/4'].desc = 'SRV-LNX';
  Object.assign(b1['GigabitEthernet0/1'], { mode: 'trunk', allowed: [10, 20, 30], native: 1, desc: 'trunk vers SW-T2' });

  dev['SW-T2'] = {
    kind: 'ios-sw', name: 'SW-T2', hostname: 'SW-T2', model: 'Catalyst 2960-24TT', domain: 'toulouse.local', ipRouting: false, defaultGateway: '10.10.30.1',
    ports: WB.ports(fa(24).concat(['GigabitEthernet0/1', 'GigabitEthernet0/2'])),
    vlans: { 1: { name: 'default' }, 10: { name: 'SERVEURS' }, 20: { name: 'POSTES' }, 30: { name: 'ADMIN' } },
    svi: { Vlan30: { ip: '10.10.30.2', mask: '255.255.255.0' } }, routes: [], acls: {}, phys: { on: true }, banner: 'Acces reserve au personnel autorise', enableSecret: true, users: [{ name: 'admin', priv: 15 }]
  };
  Object.assign(dev['SW-T2'], WB.sshCfg());
  const b2 = dev['SW-T2'].ports;
  Object.assign(b2['GigabitEthernet0/1'], { mode: 'trunk', allowed: [10, 20, 30], native: 1, desc: 'trunk vers SW-T1' });
  Object.assign(b2['GigabitEthernet0/2'], { mode: 'trunk', allowed: [20, 30], native: 1, desc: 'trunk vers SW-T3' });
  b2['FastEthernet0/2'].vlan = 20; b2['FastEthernet0/2'].desc = 'PC-01 (prise T-114)';
  b2['FastEthernet0/3'].vlan = 20; b2['FastEthernet0/3'].desc = 'prise T-115';
  b2['FastEthernet0/10'].vlan = 30; b2['FastEthernet0/10'].desc = 'PC-ADM';

  dev['SW-T3'] = {
    kind: 'ios-sw', name: 'SW-T3', hostname: 'SW-T3', model: 'Catalyst 2960-24TT', domain: 'toulouse.local', ipRouting: false, defaultGateway: '10.10.30.1',
    ports: WB.ports(fa(24).concat(['GigabitEthernet0/1', 'GigabitEthernet0/2'])),
    vlans: { 1: { name: 'default' }, 20: { name: 'POSTES' }, 30: { name: 'ADMIN' } },
    svi: { Vlan30: { ip: '10.10.30.3', mask: '255.255.255.0' } }, routes: [], acls: {}, phys: { on: true }, banner: 'Acces reserve au personnel autorise', enableSecret: true, users: [{ name: 'admin', priv: 15 }]
  };
  Object.assign(dev['SW-T3'], WB.sshCfg());
  const b3 = dev['SW-T3'].ports;
  Object.assign(b3['GigabitEthernet0/1'], { mode: 'trunk', allowed: [20, 30], native: 1, desc: 'trunk vers SW-T2' });
  b3['FastEthernet0/2'].vlan = 20; b3['FastEthernet0/2'].desc = 'PC-02'; b3['FastEthernet0/5'].vlan = 20; b3['FastEthernet0/5'].desc = 'IMP-T1';

  WB.link(dev, 'pfsense-tls:wan', 'ISP:to-T');
  WB.link(dev, 'pfsense-tls:lan', 'SW-T1:FastEthernet0/1');
  WB.link(dev, 'pfsense-tls:dmz', 'SW-DMZ:p1');
  WB.link(dev, 'SW-T1:GigabitEthernet0/1', 'SW-T2:GigabitEthernet0/1');
  WB.link(dev, 'SW-T2:GigabitEthernet0/2', 'SW-T3:GigabitEthernet0/1');

  /* ================= BORDEAUX ================= */
  dev['pfsense-bdx'] = {
    kind: 'pf', product: 'pfSense', name: 'pfsense-bdx', hostname: 'pfsense-bdx', domain: 'bordeaux.local',
    ifaces: {
      wan: { name: 'WAN', dev: 'hn0', ip: '203.0.113.2', mask: '255.255.255.252', cable: null, blockPrivate: true, blockBogons: true },
      lan: { name: 'LAN', dev: 'hn1', ip: '10.20.0.1', mask: '255.255.255.252', cable: null },
      enc0: { name: 'IPsec', virtual: true }
    },
    gateways: [{ name: 'WAN_GW', iface: 'wan', ip: '203.0.113.1', default: true, descr: 'Passerelle opérateur' }, { name: 'RB1_GW', iface: 'lan', ip: '10.20.0.2', lanGw: true, descr: 'R-B1 (routage inter-VLAN)' }],
    routes: [{ net: '10.20.10.0', mask: '255.255.255.0', nh: '10.20.0.2' }, { net: '10.20.20.0', mask: '255.255.255.0', nh: '10.20.0.2' }],
    aliases: [{ name: 'RFC1918', type: 'network', values: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] }],
    rules: {
      wan: [], lan: [{ id: 'l1', act: 'pass', proto: 'any', src: { t: 'any' }, dst: { t: 'any' }, descr: 'Autoriser LAN vers tout' }],
      enc0: [{ id: 'i1', act: 'pass', proto: 'any', src: { t: 'net', v: '10.10.0.0/16' }, dst: { t: 'net', v: '10.20.0.0/16' }, descr: 'IPsec Toulouse → Bordeaux' }]
    },
    nat: { outbound: { mode: 'hybrid', rules: [{ iface: 'wan', src: { t: 'net', v: '10.20.0.0/16' }, transl: 'iface', descr: 'VLAN Bordeaux derrière routes statiques' }] }, portfwd: [], one2one: [] },
    ipsec: {
      enabled: true, tunnels: [{
        id: 'con1', descr: 'Bordeaux ↔ Toulouse',
        p1: { ike: 'ikev2', iface: 'wan', remoteGw: '198.51.100.2', auth: 'psk', psk: 'Bx-Tls-2026!', encr: 'aes256', hash: 'sha256', dh: 14, lifetime: 28800, dpd: true },
        p2: [{ mode: 'tunnel', local: '10.20.0.0/16', remote: '10.10.0.0/16', proto: 'esp', encr: 'aes256', hash: 'sha256', pfs: 14, lifetime: 3600 }]
      }]
    },
    openvpn: { servers: [], cas: [], certs: [], users: [] },
    dns: { unbound: { enabled: true, hostOverrides: [], domainOverrides: [{ domain: 'bordeaux.local', server: '10.20.10.10' }] }, servers: ['8.8.8.8'] },
    system: { webgui: { proto: 'https', port: 443 }, ssh: { enabled: true, port: 22 }, antilockout: true }, squid: { enabled: false }
  };
  dev['R-B1'] = {
    kind: 'ios-rt', name: 'R-B1', hostname: 'R-B1', model: 'Cisco 2911', domain: 'bordeaux.local',
    ifaces: {
      'GigabitEthernet0/0': { ip: '10.20.0.2', mask: '255.255.255.252', cable: null, desc: 'vers pfsense-bdx LAN' },
      'GigabitEthernet0/1': { ip: '', mask: '', cable: null, desc: 'trunk ROAS vers SW-B1' },
      'GigabitEthernet0/1.10': { encap: 10, parent: 'GigabitEthernet0/1', ip: '10.20.10.1', mask: '255.255.255.0', desc: 'SERVEURS' },
      'GigabitEthernet0/1.20': { encap: 20, parent: 'GigabitEthernet0/1', ip: '10.20.20.1', mask: '255.255.255.0', desc: 'POSTES', helpers: ['10.20.10.10'] }
    },
    routes: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '10.20.0.1', ad: 1 }], acls: {}, phys: { on: true }, enableSecret: true, users: [{ name: 'admin', priv: 15 }]
  };
  Object.assign(dev['R-B1'], WB.sshCfg());
  dev['SW-B1'] = {
    kind: 'ios-sw', name: 'SW-B1', hostname: 'SW-B1', model: 'Catalyst 2960-24TT', domain: 'bordeaux.local', ipRouting: false, defaultGateway: '10.20.10.1',
    ports: WB.ports(fa(24).concat(['GigabitEthernet0/1', 'GigabitEthernet0/2'])),
    vlans: { 1: { name: 'default' }, 10: { name: 'SERVEURS' }, 20: { name: 'POSTES' } },
    svi: { Vlan10: { ip: '10.20.10.2', mask: '255.255.255.0' } }, routes: [], acls: {}, phys: { on: true }, banner: 'Acces reserve au personnel autorise', enableSecret: true, users: [{ name: 'admin', priv: 15 }]
  };
  Object.assign(dev['SW-B1'], WB.sshCfg());
  const t1 = dev['SW-B1'].ports;
  Object.assign(t1['FastEthernet0/1'], { mode: 'trunk', allowed: [10, 20], native: 1, desc: 'trunk vers R-B1 (ROAS)' });
  t1['FastEthernet0/2'].vlan = 10; t1['FastEthernet0/2'].desc = 'SRV-DC2'; t1['FastEthernet0/3'].vlan = 20; t1['FastEthernet0/3'].desc = 'PC-B1';
  WB.link(dev, 'pfsense-bdx:wan', 'ISP:to-B');
  WB.link(dev, 'pfsense-bdx:lan', 'R-B1:GigabitEthernet0/0');
  WB.link(dev, 'R-B1:GigabitEthernet0/1', 'SW-B1:FastEthernet0/1');

  /* ================= RAMONVILLE (maquette Cisco) ================= */
  dev['R-RV1'] = {
    kind: 'ios-rt', name: 'R-RV1', hostname: 'R-RV1', model: 'Cisco 2911', domain: 'ramonville.lan',
    ifaces: {
      'GigabitEthernet0/0': { ip: '192.0.2.2', mask: '255.255.255.252', cable: null, natSide: 'outside', desc: 'WAN vers ISP' },
      'GigabitEthernet0/1': { ip: '172.16.1.1', mask: '255.255.255.0', cable: null, natSide: 'inside', desc: 'LAN A', aclIn: '100' },
      'GigabitEthernet0/2': { ip: '172.16.2.1', mask: '255.255.255.0', cable: null, natSide: 'inside', desc: 'LAN B', aclIn: '101' },
      'GigabitEthernet0/3': { ip: '172.16.3.1', mask: '255.255.255.0', cable: null, natSide: 'inside', desc: 'DMZ', aclIn: '102' }
    },
    routes: [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '192.0.2.1', ad: 1 }],
    nat: { pools: {}, rules: [{ type: 'dynamic', acl: '1', iface: 'GigabitEthernet0/0', overload: true }, { type: 'static', proto: 'tcp', local: '172.16.3.10', lport: 80, global: '192.0.2.2', gport: 80 }] },
    dhcp: { service: true, excluded: [{ start: '172.16.1.1', end: '172.16.1.20' }, { start: '172.16.2.1', end: '172.16.2.20' }], pools: [
      { name: 'LAN-A', net: '172.16.1.0', mask: '255.255.255.0', gw: '172.16.1.1', dns: ['172.16.3.10'], domain: 'ramonville.lan' },
      { name: 'LAN-B', net: '172.16.2.0', mask: '255.255.255.0', gw: '172.16.2.1', dns: ['172.16.3.10'], domain: 'ramonville.lan' }] },
    acls: {
      '1': { type: 'standard', entries: [{ a: 'permit', s: { t: 'net', ip: '172.16.0.0', wild: '0.0.255.255' } }] },
      '100': { type: 'extended', entries: [
        { a: 'permit', p: 'icmp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' } },
        { a: 'permit', p: 'udp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 53 } },
        { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 80 } },
        { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.1.0', wild: '0.0.0.255' }, d: { t: 'any' }, dp: { op: 'eq', v: 443 } },
        { a: 'permit', p: 'tcp', s: { t: 'host', ip: '172.16.1.30' }, d: { t: 'host', ip: '172.16.3.10' }, dp: { op: 'eq', v: 22 } }] },
      '101': { type: 'extended', entries: [
        { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' }, d: { t: 'host', ip: '172.16.3.10' }, dp: { op: 'eq', v: 80 } },
        { a: 'permit', p: 'udp', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' }, d: { t: 'host', ip: '172.16.3.10' }, dp: { op: 'eq', v: 53 } },
        { a: 'permit', p: 'icmp', s: { t: 'net', ip: '172.16.2.0', wild: '0.0.0.255' }, d: { t: 'host', ip: '172.16.3.10' } }] },
      '102': { type: 'extended', entries: [
        { a: 'permit', p: 'tcp', s: { t: 'net', ip: '172.16.3.0', wild: '0.0.0.255' }, d: { t: 'any' }, est: true },
        { a: 'permit', p: 'udp', s: { t: 'host', ip: '172.16.3.10' }, sp: { op: 'eq', v: 53 }, d: { t: 'any' } },
        { a: 'permit', p: 'icmp', s: { t: 'net', ip: '172.16.3.0', wild: '0.0.0.255' }, d: { t: 'any' }, it: 0 }] }
    },
    phys: { on: true }, enableSecret: true, users: [{ name: 'admin', priv: 15 }]
  };
  Object.assign(dev['R-RV1'], WB.sshCfg());
  dev['SW-RVA'] = { kind: 'sw-dumb', name: 'SW-RVA', ports: WB.ports(['p1', 'p2', 'p3', 'p4']), phys: { on: true } };
  dev['SW-RVB'] = { kind: 'sw-dumb', name: 'SW-RVB', ports: WB.ports(['p1', 'p2', 'p3', 'p4']), phys: { on: true } };
  WB.link(dev, 'R-RV1:GigabitEthernet0/0', 'ISP:to-RV');
  WB.link(dev, 'R-RV1:GigabitEthernet0/1', 'SW-RVA:p1');
  WB.link(dev, 'R-RV1:GigabitEthernet0/2', 'SW-RVB:p1');

  /* ================= LABÈGE (maquette Cisco — routage dynamique OSPF, zone 0 + zone 1) =================
     Anneau de 5 routeurs (zone 0) + R-LB6 en zone 1 derrière l'ABR R-LB3 : R-LB1 (bordure : NAT + route statique par défaut + « default-information originate »)
     puis R-LB2 … R-LB5. Chaque routeur a une Loopback0 (router-id). Adresses 10.30.0.0/16 ; WAN 192.0.2.4/30. */
  const P30 = '255.255.255.252';
  const lbIf = (ip, mask, desc, extra) => Object.assign({ ip, mask: mask || P30, cable: null, desc }, extra || {});
  const lbIfaces = {
    1: { 'GigabitEthernet0/0': lbIf('192.0.2.6', P30, 'WAN vers ISP', { natSide: 'outside' }), 'GigabitEthernet0/1': lbIf('10.30.12.1', P30, 'vers R-LB2', { natSide: 'inside' }), 'GigabitEthernet0/2': lbIf('10.30.51.2', P30, 'vers R-LB5', { natSide: 'inside' }) },
    2: { 'GigabitEthernet0/0': lbIf('10.30.12.2', P30, 'vers R-LB1'), 'GigabitEthernet0/1': lbIf('10.30.23.1', P30, 'vers R-LB3'), 'GigabitEthernet0/2': lbIf('10.30.102.1', '255.255.255.0', 'LAN utilisateurs') },
    3: { 'GigabitEthernet0/0': lbIf('10.30.23.2', P30, 'vers R-LB2'), 'GigabitEthernet0/1': lbIf('10.30.34.1', P30, 'vers R-LB4'), 'GigabitEthernet0/2': lbIf('10.30.36.1', P30, 'vers R-LB6 (zone 1)') },
    4: { 'GigabitEthernet0/0': lbIf('10.30.34.2', P30, 'vers R-LB3'), 'GigabitEthernet0/1': lbIf('10.30.45.1', P30, 'vers R-LB5'), 'GigabitEthernet0/2': lbIf('10.30.104.1', '255.255.255.0', 'LAN atelier') },
    5: { 'GigabitEthernet0/0': lbIf('10.30.45.2', P30, 'vers R-LB4'), 'GigabitEthernet0/1': lbIf('10.30.51.1', P30, 'vers R-LB1') },
    6: { 'GigabitEthernet0/0': lbIf('10.30.36.2', P30, 'vers R-LB3 (ABR)'), 'GigabitEthernet0/1': lbIf('10.30.106.1', '255.255.255.0', 'LAN annexe') }
  };
  const lbNets = {
    1: [['10.30.12.0', '0.0.0.3'], ['10.30.51.0', '0.0.0.3']],
    2: [['10.30.12.0', '0.0.0.3'], ['10.30.23.0', '0.0.0.3'], ['10.30.102.0', '0.0.0.255']],
    3: [['10.30.23.0', '0.0.0.3'], ['10.30.34.0', '0.0.0.3'], ['10.30.36.0', '0.0.0.3', 1]],
    4: [['10.30.34.0', '0.0.0.3'], ['10.30.45.0', '0.0.0.3'], ['10.30.104.0', '0.0.0.255']],
    5: [['10.30.45.0', '0.0.0.3'], ['10.30.51.0', '0.0.0.3']],
    6: [['10.30.36.0', '0.0.0.3'], ['10.30.106.0', '0.0.0.255']]
  };
  const lbPassive = { 1: [], 2: ['GigabitEthernet0/2'], 3: [], 4: ['GigabitEthernet0/2'], 5: [], 6: ['GigabitEthernet0/1'] };
  for (let k = 1; k <= 6; k++) {
    const id = 'R-LB' + k; const lo = '10.30.255.' + k;
    const ifaces = Object.assign({}, lbIfaces[k], { Loopback0: { ip: lo, mask: '255.255.255.255', virtual: true, cable: null, desc: 'router-id' } });
    dev[id] = {
      kind: 'ios-rt', name: id, hostname: id, model: 'Cisco 2911', domain: 'labege.lan', ifaces,
      routes: k === 1 ? [{ net: '0.0.0.0', mask: '0.0.0.0', nh: '192.0.2.5', ad: 1 }] : [],
      ospf: {
        pid: 1, routerId: lo, refBw: 100, passiveDefault: false, passive: lbPassive[k].slice(), nonPassive: [],
        networks: lbNets[k].concat([[lo, '0.0.0.0', k === 6 ? 1 : 0]]).map(x => ({ net: x[0], wild: x[1], area: k === 6 ? 1 : (x[2] || 0) })),
        defaultOriginate: k === 1 ? { always: false } : null
      },
      acls: k === 1 ? { '1': { type: 'standard', entries: [{ a: 'permit', s: { t: 'net', ip: '10.30.0.0', wild: '0.0.255.255' } }] } } : {},
      phys: { on: true }, enableSecret: true, users: [{ name: 'admin', priv: 15 }]
    };
    if (k === 1) dev[id].nat = { pools: {}, rules: [{ type: 'dynamic', acl: '1', iface: 'GigabitEthernet0/0', overload: true }] };
    Object.assign(dev[id], WB.sshCfg());
  }
  WB.link(dev, 'R-LB1:GigabitEthernet0/0', 'ISP:to-LB');
  WB.link(dev, 'R-LB1:GigabitEthernet0/1', 'R-LB2:GigabitEthernet0/0');
  WB.link(dev, 'R-LB2:GigabitEthernet0/1', 'R-LB3:GigabitEthernet0/0');
  WB.link(dev, 'R-LB3:GigabitEthernet0/1', 'R-LB4:GigabitEthernet0/0');
  WB.link(dev, 'R-LB4:GigabitEthernet0/1', 'R-LB5:GigabitEthernet0/0');
  WB.link(dev, 'R-LB5:GigabitEthernet0/1', 'R-LB1:GigabitEthernet0/2');
  WB.link(dev, 'R-LB3:GigabitEthernet0/2', 'R-LB6:GigabitEthernet0/0');

  /* ================= COLOMIERS (maquette Cisco — couche 2 : EtherChannel LACP + Spanning Tree) =================
     SW-CA (racine STP) —Po1 (Gi0/1-2, LACP actif)— SW-CB ; SW-CA —Fa0/23— SW-CC. VLAN 10 (bureaux) et 20 (atelier), 10.40.10.0/24 et 10.40.20.0/24,
     sans routeur : un poste ne joint que les postes de son VLAN. Fa0/20 et Fa0/21 de SW-CC sont deux prises libres (câble de brassage possible). */
  const clPorts = () => WB.ports(fa(24).concat(['GigabitEthernet0/1', 'GigabitEthernet0/2']));
  const clVlans = { 1: { name: 'default' }, 10: { name: 'BUREAUX' }, 20: { name: 'ATELIER' } };
  const clSw = (id, model) => {
    dev[id] = { kind: 'ios-sw', name: id, hostname: id, model, domain: 'colomiers.local', ipRouting: false, ports: clPorts(), vlans: Object.assign({}, clVlans), svi: {}, routes: [], acls: {}, phys: { on: true }, banner: 'Acces reserve au personnel autorise', enableSecret: true, users: [{ name: 'admin', priv: 15 }] };
    Object.assign(dev[id], WB.sshCfg()); return dev[id].ports;
  };
  const cA = clSw('SW-CA', 'Catalyst 3560-24PS'), cB = clSw('SW-CB', 'Catalyst 2960-24TT'), cC = clSw('SW-CC', 'Catalyst 2960-24TT');
  const clPo = (desc) => ({ logical: true, mode: 'trunk', allowed: [10, 20], native: 1, desc, cable: null });
  dev['SW-CA'].ports['Port-channel1'] = clPo('Po1 vers SW-CB'); dev['SW-CB'].ports['Port-channel1'] = clPo('Po1 vers SW-CA');
  ['GigabitEthernet0/1', 'GigabitEthernet0/2'].forEach(n => {
    Object.assign(cA[n], { mode: 'trunk', allowed: [10, 20], native: 1, desc: 'membre Po1 vers SW-CB', chan: { group: 1, mode: 'active' } });
    Object.assign(cB[n], { mode: 'trunk', allowed: [10, 20], native: 1, desc: 'membre Po1 vers SW-CA', chan: { group: 1, mode: 'active' } });
  });
  Object.assign(cA['FastEthernet0/23'], { mode: 'trunk', allowed: [10, 20], native: 1, desc: 'trunk vers SW-CC' });
  Object.assign(cC['FastEthernet0/23'], { mode: 'trunk', allowed: [10, 20], native: 1, desc: 'trunk vers SW-CA' });
  cB['FastEthernet0/10'].vlan = 10; cB['FastEthernet0/10'].desc = 'PC-C1'; cB['FastEthernet0/11'].vlan = 20; cB['FastEthernet0/11'].desc = 'PC-C3';
  cC['FastEthernet0/10'].vlan = 10; cC['FastEthernet0/10'].desc = 'PC-C2'; cC['FastEthernet0/11'].vlan = 20; cC['FastEthernet0/11'].desc = 'PC-C4';
  cC['FastEthernet0/20'].vlan = 10; cC['FastEthernet0/20'].desc = 'prise libre C-20'; cC['FastEthernet0/21'].vlan = 10; cC['FastEthernet0/21'].desc = 'prise libre C-21';
  dev['SW-CA'].stp = { mode: 'pvst', prio: { 1: 4096, 10: 4096, 20: 4096 }, off: [] };
  dev['SW-CB'].stp = { mode: 'pvst', prio: {}, off: [] }; dev['SW-CC'].stp = { mode: 'pvst', prio: {}, off: [] };
  WB.link(dev, 'SW-CA:GigabitEthernet0/1', 'SW-CB:GigabitEthernet0/1');
  WB.link(dev, 'SW-CA:GigabitEthernet0/2', 'SW-CB:GigabitEthernet0/2');
  WB.link(dev, 'SW-CA:FastEthernet0/23', 'SW-CC:FastEthernet0/23');

  /* walls Toulouse */
  W.walls['T-114'] = 'SW-T2:FastEthernet0/2'; W.walls['T-115'] = null;
  b2['FastEthernet0/2'].cable = WB.cableObj('patch:T-114');
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
