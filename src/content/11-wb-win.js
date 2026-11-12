/* ============================================================================
   Hôtes Windows : postes Windows 10 et serveurs Windows Server, Active Directory,
   GPO, partages + NTFS, DHCP, DNS, IIS. Données seulement : la sémantique vit dans
   engine/30-win.js et engine/35-ad.js.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, WB = SIM.WB;

const svc = (o) => { const r = {}; Object.keys(o).forEach(k => { r[k] = { state: o[k][0], start: o[k][1] }; }); return r; };
const R = 'running', S = 'stopped';

/* règles entrantes de base : noms d'affichage français à vérifier (U.av) côté UI */
const rule = (name, o) => Object.assign({ name, enabled: true, dir: 'in', action: 'allow', profiles: ['domain', 'private', 'public'], proto: 'Any', lport: '' }, o);
let ruleSeq = 0;
WB.winFwRules = function (kind) {
  const rules = [
    rule('Partage de fichiers et d’imprimantes (Demande d’écho - Trafic entrant ICMPv4)', { id: 'icmp-echo', proto: 'ICMPv4', icmpType: 8, profiles: ['domain', 'private'], group: 'Partage de fichiers et d’imprimantes' }),
    rule('Partage de fichiers et d’imprimantes (SMB - Trafic entrant)', { id: 'smb', proto: 'TCP', lport: '445', profiles: ['domain', 'private'], group: 'Partage de fichiers et d’imprimantes' })
  ];
  if (kind.indexOf('dns') >= 0) { rules.push(rule('Serveur DNS (UDP, trafic entrant)', { id: 'dns-udp', proto: 'UDP', lport: '53', group: 'Serveur DNS' })); rules.push(rule('Serveur DNS (TCP, trafic entrant)', { id: 'dns-tcp', proto: 'TCP', lport: '53', group: 'Serveur DNS' })); }
  if (kind.indexOf('dhcp') >= 0) rules.push(rule('Serveur DHCP (requête entrante)', { id: 'dhcp', proto: 'UDP', lport: '67', group: 'Serveur DHCP' }));
  if (kind.indexOf('ad') >= 0) rules.push(rule('Services de domaine Active Directory (TCP, trafic entrant)', { id: 'ad-tcp', proto: 'TCP', lport: '88,135,389,445,464,636,3268', group: 'Services de domaine Active Directory' }));
  if (kind.indexOf('web') >= 0) { rules.push(rule('Service World Wide Web (trafic HTTP entrant)', { id: 'http', proto: 'TCP', lport: '80', group: 'Service World Wide Web (HTTP)' })); rules.push(rule('Service World Wide Web (trafic HTTPS entrant)', { id: 'https', proto: 'TCP', lport: '443', group: 'Service World Wide Web (HTTPS)' })); }
  if (kind.indexOf('rdp') >= 0) rules.push(rule('Bureau à distance - Mode utilisateur (TCP-Entrée)', { id: 'rdp', proto: 'TCP', lport: '3389', group: 'Bureau à distance' }));
  return rules;
};
const fwProfiles = () => ({ domain: { enabled: true, defIn: 'block', defOut: 'allow' }, private: { enabled: true, defIn: 'block', defOut: 'allow' }, public: { enabled: true, defIn: 'block', defOut: 'allow' } });

/* ---------- Active Directory : domaine toulouse.local ---------- */
WB.adToulouse = function () {
  const dn = (ou) => (ou ? 'OU=' + ou + ',' : '') + 'DC=toulouse,DC=local';
  return {
    domain: 'toulouse.local', netbios: 'TOULOUSE', forestLevel: 'Windows Server 2016', dcs: ['SRV-DC1'], fsmo: { all: 'SRV-DC1' },
    policy: { minPwdLen: 8, complexity: true, maxPwdAgeDays: 90, minPwdAgeDays: 1, history: 12, lockoutThreshold: 5, lockoutDurationMin: 15, lockoutWindowMin: 15, kerberosSkewMin: 5 },
    ous: [
      { dn: dn('Postes'), block: false }, { dn: dn('Serveurs'), block: false }, { dn: dn('Utilisateurs'), block: false }, { dn: 'OU=Compta,' + dn('Utilisateurs'), block: false }, { dn: 'OU=RH,' + dn('Utilisateurs'), block: false },
      { dn: 'OU=Direction,' + dn('Utilisateurs'), block: false }, { dn: 'OU=Informatique,' + dn('Utilisateurs'), block: false }, { dn: dn('Groupes'), block: false }, { dn: 'OU=Domain Controllers,' + dn(), block: false }
    ],
    users: [
      { sam: 'Administrateur', name: 'Administrateur', ou: 'CN=Users,' + dn(), enabled: true, pwd: 'Adm!n2026', pwdSetDays: 40 },
      { sam: 'tssr', name: 'Admin TSSR', ou: 'OU=Informatique,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Tssr-2026!', pwdSetDays: 20, pwdNeverExpires: false },
      { sam: 'a.martin', name: 'Alice Martin', ou: 'OU=Compta,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Compta#2026', pwdSetDays: 35 },
      { sam: 'b.durand', name: 'Bruno Durand', ou: 'OU=RH,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Ress0urces!', pwdSetDays: 10 },
      { sam: 'c.lefevre', name: 'Claire Lefèvre', ou: 'OU=Direction,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Direct1on#', pwdSetDays: 50 },
      { sam: 'd.moreau', name: 'David Moreau', ou: 'OU=Compta,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Moreau@2026', pwdSetDays: 5 },
      { sam: 'l.berger', name: 'Louison Berger', ou: 'OU=RH,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Berger#2026', pwdSetDays: 22 },
      { sam: 'j.ribeiro', name: 'Jano Ribeiro', ou: 'OU=Compta,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Ribeiro#2026', pwdSetDays: 31 },
      { sam: 'm.caron', name: 'Mathis Caron', ou: 'OU=RH,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Caron#2026', pwdSetDays: 14 },
      { sam: 'j.lambert', name: 'Jenny Lambert', ou: 'OU=Compta,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Lambert#2026', pwdSetDays: 44 },
      { sam: 'l.fontaine', name: 'Liam Fontaine', ou: 'OU=Direction,OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Fontaine#2026', pwdSetDays: 8 },
      { sam: 'svc-backup', name: 'Compte de service sauvegarde', ou: 'CN=Users,' + dn(), enabled: true, pwd: 'Svc-B@ckup1', pwdNeverExpires: true, pwdSetDays: 300 }
    ],
    groups: [
      { name: 'Admins du domaine', scope: 'Global', ou: 'CN=Users,' + dn(), members: ['Administrateur', 'tssr'] },
      { name: 'Administrateurs', scope: 'DomainLocal', builtin: true, ou: 'CN=Builtin,' + dn(), members: ['Admins du domaine', 'Administrateur'] },
      { name: 'GG_Compta', scope: 'Global', ou: dn('Groupes'), members: ['a.martin', 'd.moreau', 'j.ribeiro', 'j.lambert'] },
      { name: 'GG_RH', scope: 'Global', ou: dn('Groupes'), members: ['b.durand', 'l.berger', 'm.caron'] },
      { name: 'GG_Direction', scope: 'Global', ou: dn('Groupes'), members: ['c.lefevre', 'l.fontaine'] },
      { name: 'GG_IT', scope: 'Global', ou: dn('Groupes'), members: ['tssr'] },
      { name: 'DL_Compta_RW', scope: 'DomainLocal', ou: dn('Groupes'), members: ['GG_Compta'] },
      { name: 'DL_RH_RW', scope: 'DomainLocal', ou: dn('Groupes'), members: ['GG_RH'] },
      { name: 'DL_Direction_RW', scope: 'DomainLocal', ou: dn('Groupes'), members: ['GG_Direction'] },
      { name: 'DL_Commun_RW', scope: 'DomainLocal', ou: dn('Groupes'), members: ['GG_Compta', 'GG_RH', 'GG_Direction', 'GG_IT', 'BORDEAUX\\GG_Tls_Commun'] }
    ],
    computers: [
      { name: 'SRV-DC1', ou: 'OU=Domain Controllers,' + dn(), enabled: true, dc: true },
      { name: 'PC-01', ou: dn('Postes'), enabled: true }, { name: 'PC-02', ou: dn('Postes'), enabled: true }, { name: 'PC-ADM', ou: dn('Postes'), enabled: true },
      { name: 'SRV-FIC', ou: dn('Serveurs'), enabled: true }
    ],
    gpos: [
      { id: 'GPO1', name: 'Default Domain Policy', enabled: true, userEnabled: true, compEnabled: true, links: [{ target: dn(), enforced: false, enabled: true, order: 1 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'],
        settings: [{ scope: 'computer', id: 'acct.minPwdLen', value: 8 }] },
      { id: 'GPO2', name: 'GPO_Postes_Securite', enabled: true, userEnabled: true, compEnabled: true, links: [{ target: dn('Postes'), enforced: false, enabled: true, order: 1 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'],
        settings: [{ scope: 'computer', id: 'fw.icmpEcho', value: 'enabled' }, { scope: 'computer', id: 'screensaver.timeout', value: 900 }] },
      { id: 'GPO3', name: 'GPO_Lecteurs_Reseau', enabled: true, userEnabled: true, compEnabled: false, links: [{ target: dn('Utilisateurs'), enforced: false, enabled: true, order: 1 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'],
        settings: [{ scope: 'user', id: 'drive.P', value: '\\\\SRV-FIC\\Commun', label: 'Commun' }, { scope: 'user', id: 'drive.S', value: '\\\\SRV-FIC\\Compta', label: 'Compta', itl: 'GG_Compta' }, { scope: 'user', id: 'drive.R', value: '\\\\SRV-FIC\\RH', label: 'RH', itl: 'GG_RH' }] },
      { id: 'GPO4', name: 'GPO_Fond_Ecran', enabled: true, userEnabled: true, compEnabled: false, links: [{ target: dn('Utilisateurs'), enforced: false, enabled: true, order: 2 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'],
        settings: [{ scope: 'user', id: 'wallpaper', value: '\\\\SRV-FIC\\Commun\\fond.png' }] }
    ],
    trusts: [{ target: 'bordeaux.local', direction: 'bidirectional', type: 'external', transitive: false, state: 'ok' }],
    sites: [{ name: 'Default-First-Site-Name', subnets: ['10.10.0.0/16'] }]
  };
};
WB.adBordeaux = function () {
  const dn = (ou) => (ou ? 'OU=' + ou + ',' : '') + 'DC=bordeaux,DC=local';
  return {
    domain: 'bordeaux.local', netbios: 'BORDEAUX', forestLevel: 'Windows Server 2016', dcs: ['SRV-DC2'], fsmo: { all: 'SRV-DC2' },
    policy: { minPwdLen: 8, complexity: true, maxPwdAgeDays: 90, minPwdAgeDays: 1, history: 12, lockoutThreshold: 5, lockoutDurationMin: 15, lockoutWindowMin: 15, kerberosSkewMin: 5 },
    ous: [{ dn: dn('Postes'), block: false }, { dn: dn('Utilisateurs'), block: false }, { dn: 'OU=Domain Controllers,' + dn(), block: false }],
    users: [
      { sam: 'Administrateur', name: 'Administrateur', ou: 'CN=Users,' + dn(), enabled: true, pwd: 'Adm!n-Bdx26', pwdSetDays: 40 },
      { sam: 'e.garcia', name: 'Elena Garcia', ou: 'OU=Utilisateurs,' + dn(), enabled: true, pwd: 'Bordeaux#26', pwdSetDays: 12 }
    ],
    groups: [
      { name: 'Admins du domaine', scope: 'Global', ou: 'CN=Users,' + dn(), members: ['Administrateur'] },
      { name: 'Administrateurs', scope: 'DomainLocal', builtin: true, ou: 'CN=Builtin,' + dn(), members: ['Admins du domaine', 'Administrateur'] },
      { name: 'GG_Tls_Commun', scope: 'Global', ou: dn('Utilisateurs'), members: ['e.garcia'] }
    ], computers: [{ name: 'SRV-DC2', ou: 'OU=Domain Controllers,' + dn(), enabled: true, dc: true }, { name: 'PC-B1', ou: dn('Postes'), enabled: true }],
    gpos: [{ id: 'GPO1', name: 'Default Domain Policy', enabled: true, userEnabled: true, compEnabled: true, links: [{ target: dn(), enforced: false, enabled: true, order: 1 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'], settings: [] }],
    trusts: [{ target: 'toulouse.local', direction: 'bidirectional', type: 'external', transitive: false, state: 'ok' }],
    sites: [{ name: 'Default-First-Site-Name', subnets: ['10.20.0.0/16'] }]
  };
};

/* ---------- partages + NTFS sur SRV-FIC ---------- */
WB.fileServerData = function () {
  const ntfs = (who, rights, extra) => Object.assign({ who, type: 'allow', rights, applies: 'this+sub' }, extra || {});
  const folders = {};
  const mk = (path, o) => { folders[path] = Object.assign({ inherit: false, owner: 'BUILTIN\\Administrateurs', acl: [] }, o); };
  const base = [ntfs('NT AUTHORITY\\Système', 'FullControl'), ntfs('BUILTIN\\Administrateurs', 'FullControl')];
  mk('D:\\Partages', { inherit: false, acl: base.concat([ntfs('BUILTIN\\Utilisateurs', 'ReadAndExecute', { applies: 'this-only' })]) });
  mk('D:\\Partages\\Compta', { acl: base.concat([ntfs('TOULOUSE\\DL_Compta_RW', 'Modify')]) });
  mk('D:\\Partages\\Compta\\Factures', { inherit: true, acl: [] });
  mk('D:\\Partages\\Direction\\Strategie', { inherit: true, acl: [] });
  mk('D:\\Partages\\RH', { acl: base.concat([ntfs('TOULOUSE\\DL_RH_RW', 'Modify')]) });
  mk('D:\\Partages\\Direction', { acl: base.concat([ntfs('TOULOUSE\\DL_Direction_RW', 'Modify')]) });
  mk('D:\\Partages\\Commun', { acl: base.concat([ntfs('TOULOUSE\\DL_Commun_RW', 'Modify')]) });
  mk('C:\\inetpub\\wwwroot', { inherit: true, acl: base.concat([ntfs('BUILTIN\\IIS_IUSRS', 'ReadAndExecute'), ntfs('NT AUTHORITY\\IUSR', 'ReadAndExecute')]) });
  const shares = [
    { name: 'Compta', path: 'D:\\Partages\\Compta', comment: 'Dossier du service comptabilité', perms: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }], abe: true },
    { name: 'RH', path: 'D:\\Partages\\RH', comment: 'Dossier du service RH', perms: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }], abe: true },
    { name: 'Direction', path: 'D:\\Partages\\Direction', comment: 'Dossier de la direction', perms: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }], abe: true },
    { name: 'Commun', path: 'D:\\Partages\\Commun', comment: 'Échanges inter-services', perms: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }], abe: false }
  ];
  const files = { 'D:\\Partages\\Commun': ['fond.png', 'charte-graphique.pdf'], 'D:\\Partages\\Compta': ['budget-2026.xlsx', 'factures-septembre.xlsx'], 'D:\\Partages\\Compta\\Factures': ['facture-0912.pdf', 'facture-0913.pdf'], 'D:\\Partages\\Direction\\Strategie': ['plan-2027.docx'], 'D:\\Partages\\RH': ['planning-conges.xlsx'], 'D:\\Partages\\Direction': ['comite-direction.docx'] };
  return { folders, shares, files };
};

/* ---------- base d'un hôte Windows ---------- */
WB.winBase = function (id, o) {
  const d = {
    kind: o.kind || 'win', name: id, os: o.os, build: o.build, domain: undefined, edition: o.edition,
    ifaces: { Ethernet0: { mac: U.mac(id + 'Ethernet0'), dhcp: !!o.dhcp, ip: o.ip || '', mask: o.mask || '255.255.255.0', gw: o.gw || '', dns: o.dns || [], suffix: o.suffix || '', fwProfile: o.fwProfile || (o.domain ? 'domain' : 'private'), cable: null, speed: '1 Gbit/s', adminDown: false } },
    phys: { on: true, psu: true, strip: true, screenCable: true, monitorOn: true, source: 'DP' },
    hostsFile: [], proxy: null, clockSkewMin: 0,
    win: { domain: o.domain || null, workgroup: o.domain ? null : (o.workgroup || 'WORKGROUP'), svc: svc(o.svc), fw: { profiles: fwProfiles(), rules: WB.winFwRules(o.roles || []) }, rdp: { enabled: !!o.rdp }, localUsers: o.localUsers || [{ name: 'Administrateur', enabled: false }, { name: 'tech', enabled: true, admin: true }], events: [] }
  };
  if (o.domain) d.dnsSuffix = o.domain;
  return d;
};

const CLIENT_SVC = { Dhcp: [R, 'auto'], Dnscache: [R, 'auto'], LanmanWorkstation: [R, 'auto'], LanmanServer: [R, 'auto'], mpssvc: [R, 'auto'], gpsvc: [R, 'auto'], W32Time: [R, 'auto-delayed'], EventLog: [R, 'auto'], Netlogon: [R, 'auto'], NlaSvc: [R, 'auto'], TermService: [S, 'manual'] };
WB.winClient = function (id, o) {
  const d = WB.winBase(id, Object.assign({ os: 'Windows 10 Professionnel', build: '22H2 (build 19045)', svc: CLIENT_SVC, dhcp: true, dns: [], roles: [] }, o));
  return d;
};
WB.winServer = function (id, o) {
  const s = Object.assign({}, CLIENT_SVC, o.svc || {});
  return WB.winBase(id, Object.assign({ os: 'Windows Server 2022 Standard', build: '21H2 (build 20348)', dhcp: false }, o, { svc: s }));
};

/* ---------- les machines ---------- */
WB.buildWin = function (W) {
  const dev = W.dev;
  /* ===== SRV-DC1 : AD DS + DNS + DHCP (Toulouse) ===== */
  const dc1 = WB.winServer('SRV-DC1', { ip: '10.10.10.10', gw: '10.10.10.1', dns: ['10.10.10.10'], domain: 'toulouse.local', suffix: 'toulouse.local', roles: ['dns', 'dhcp', 'ad', 'rdp'], rdp: true,
    svc: { NTDS: [R, 'auto'], Kdc: [R, 'auto'], DNS: [R, 'auto'], DHCPServer: [R, 'auto'], TermService: [R, 'auto'], Netlogon: [R, 'auto'] } });
  dc1.win.ad = WB.adToulouse();
  dc1.win.dns = {
    recursion: true, forwarders: ['8.8.8.8'], listen: [], condForwarders: [{ zone: 'bordeaux.local', servers: ['10.20.10.10'] }],
    zones: [
      { name: 'toulouse.local', type: 'primary', adIntegrated: true, state: 'running', dynUpdate: 'secure', delegations: [{ name: 'labo', ns: 'ns1.labo.toulouse.local', ip: '10.10.10.30' }], records: [
        { name: '@', type: 'A', data: '10.10.10.10' }, { name: 'srv-dc1', type: 'A', data: '10.10.10.10' }, { name: 'srv-fic', type: 'A', data: '10.10.10.20' }, { name: 'srv-lnx', type: 'A', data: '10.10.10.30' },
        { name: 'srv-web', type: 'A', data: '10.10.50.10' }, { name: 'pc-adm', type: 'A', data: '10.10.30.10' }, { name: 'imp-b1', type: 'A', data: '10.10.20.250' }, { name: 'pfsense-tls', type: 'A', data: '10.10.0.1' },
        { name: 'portail', type: 'CNAME', data: 'srv-fic.toulouse.local.' }, { name: 'gestion', type: 'CNAME', data: 'srv-fic.toulouse.local.' }, { name: 'intranet', type: 'A', data: '10.10.10.30' },
        { name: '@', type: 'NS', data: 'srv-dc1.toulouse.local.' }] },
      { name: '10.10.10.in-addr.arpa', type: 'primary', adIntegrated: true, state: 'running', reverse: true, records: [{ name: '10', type: 'PTR', data: 'srv-dc1.toulouse.local.' }, { name: '20', type: 'PTR', data: 'srv-fic.toulouse.local.' }, { name: '30', type: 'PTR', data: 'srv-lnx.toulouse.local.' }] },
      { name: '_msdcs.toulouse.local', type: 'primary', adIntegrated: true, state: 'running', records: [
        { name: '_ldap._tcp.dc', type: 'SRV', data: '0 100 389 srv-dc1.toulouse.local.' }, { name: '_kerberos._tcp.dc', type: 'SRV', data: '0 100 88 srv-dc1.toulouse.local.' }, { name: '_ldap._tcp.pdc', type: 'SRV', data: '0 100 389 srv-dc1.toulouse.local.' }] }
    ],
    scavenging: false, cacheMaxTtl: 86400
  };
  dc1.win.dhcp = {
    authorized: true, serverOptions: { 6: '10.10.10.10', 15: 'toulouse.local' }, bindings: ['Ethernet0'],
    scopes: [
      { id: '10.10.20.0', name: 'Postes Toulouse', net: '10.10.20.0', mask: '255.255.255.0', start: '10.10.20.50', end: '10.10.20.200', active: true, leaseSec: 691200,
        exclusions: [{ start: '10.10.20.190', end: '10.10.20.199' }], reservations: [{ name: 'PC-02', ip: '10.10.20.60', mac: U.mac('PC-02Ethernet0'), desc: 'Poste du service RH' }],
        options: { 3: '10.10.20.1', 6: '10.10.10.10', 15: 'toulouse.local' } }
    ]
  };
  dc1.win.shares = [{ name: 'NETLOGON', path: 'C:\\Windows\\SYSVOL\\sysvol\\toulouse.local\\SCRIPTS', comment: 'Partage du serveur d’accès', perms: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] }, { name: 'SYSVOL', path: 'C:\\Windows\\SYSVOL\\sysvol', comment: 'Partage du serveur d’accès', perms: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] }]; dc1.win.iis = null;
  dev['SRV-DC1'] = dc1;
  dc1.win.dns.zones.forEach(z => z.records.forEach(r => { r.id = r.name + '|' + r.type + (r.type === 'NS' ? '|' + r.data : ''); }));

  /* ===== SRV-FIC : fichiers + IIS (Toulouse) ===== */
  const fic = WB.winServer('SRV-FIC', { ip: '10.10.10.20', gw: '10.10.10.1', dns: ['10.10.10.10'], domain: 'toulouse.local', suffix: 'toulouse.local', roles: ['web', 'rdp'], rdp: true,
    svc: { W3SVC: [R, 'auto'], WAS: [R, 'manual'], TermService: [R, 'auto'], LanmanServer: [R, 'auto'], Dhcp: [R, 'auto'] } });
  const fd = WB.fileServerData();
  fic.win.certs = [{ cn: 'srv-fic.toulouse.local', san: ['srv-fic.toulouse.local', 'srv-fic'], issuer: 'CA-FormaTech', notBefore: '2026-03-01', notAfter: '2028-03-01' }, { cn: 'portail.toulouse.local', san: ['portail.toulouse.local'], issuer: 'CA-FormaTech', notBefore: '2026-03-01', notAfter: '2028-03-01' }];
  fic.win.fw.rules.push(rule('Portail intranet (TCP 8080)', { id: 'http-8080', proto: 'TCP', lport: '8080', group: '' }));
  fic.win.shares = fd.shares; fic.win.ntfs = fd.folders; fic.win.files = fd.files;
  fic.win.iis = {
    appPools: [{ name: 'DefaultAppPool', state: 'started', runtime: 'v4.0', pipeline: 'Integrated', identity: 'ApplicationPoolIdentity' }],
    sites: [
      { id: 1, name: 'Default Web Site', state: 'started', path: 'C:\\inetpub\\wwwroot', pool: 'DefaultAppPool', bindings: [{ proto: 'http', ip: '*', port: 80, host: '' }, { proto: 'https', ip: '*', port: 443, host: '', cert: 'srv-fic.toulouse.local' }], defaultDocs: ['Default.htm', 'Default.asp', 'index.htm', 'index.html', 'iisstart.htm', 'default.aspx'], files: ['iisstart.htm'], content: { 'iisstart.htm': { title: 'SRV-FIC — Serveur web', html: '<h1>SRV-FIC</h1><p>Le serveur web de l’agence de Toulouse est opérationnel.</p>' } }, auth: { anonymous: true, windows: false } },
      { id: 2, name: 'Portail', state: 'started', path: 'C:\\inetpub\\portail', pool: 'DefaultAppPool', bindings: [{ proto: 'http', ip: '*', port: 8080, host: 'portail.toulouse.local' }, { proto: 'https', ip: '*', port: 443, host: 'portail.toulouse.local', cert: 'portail.toulouse.local' }], defaultDocs: ['index.html'], files: ['index.html'], content: { 'index.html': { title: 'Portail FormaTech', html: '<h1>Portail FormaTech</h1><p>Accès aux applications internes.</p>' } }, auth: { anonymous: true, windows: false } },
      { id: 3, name: 'Gestion', state: 'started', path: 'C:\\inetpub\\gestion', pool: 'DefaultAppPool', bindings: [{ proto: 'http', ip: '*', port: 80, host: 'gestion.toulouse.local' }], defaultDocs: ['index.html'], files: ['index.html'], app: 'gestion',
        /* application de gestion (contenu du lab, D-103) : la page est calculée à chaque requête par SIM.web.apps.gestion à partir de la sonde de connexion à la base ; db = ce que l'application sait de sa base */
        appConfig: { db: { host: '10.10.10.30', port: 3306, user: 'intranet', name: 'intranet' } } }
    ]
  };
  fic.win.ntfs['C:\\inetpub\\portail'] = { inherit: true, owner: 'BUILTIN\\Administrateurs', acl: [{ who: 'NT AUTHORITY\\Système', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\Administrateurs', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\IIS_IUSRS', type: 'allow', rights: 'ReadAndExecute', applies: 'this+sub' }, { who: 'NT AUTHORITY\\IUSR', type: 'allow', rights: 'ReadAndExecute', applies: 'this+sub' }] };
  fic.win.ntfs['C:\\inetpub\\gestion'] = { inherit: true, owner: 'BUILTIN\\Administrateurs', acl: [{ who: 'NT AUTHORITY\\Système', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\Administrateurs', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\IIS_IUSRS', type: 'allow', rights: 'ReadAndExecute', applies: 'this+sub' }, { who: 'NT AUTHORITY\\IUSR', type: 'allow', rights: 'ReadAndExecute', applies: 'this+sub' }] };
  dev['SRV-FIC'] = fic;

  /* ===== postes Toulouse ===== */
  const pc01 = WB.winClient('PC-01', { domain: 'toulouse.local', suffix: 'toulouse.local', rdp: false, roles: [] }); pc01.user = 'a.martin'; pc01.win.cachedLogons = ['a.martin', 'tssr'];
  const pc02 = WB.winClient('PC-02', { domain: 'toulouse.local', suffix: 'toulouse.local' }); pc02.user = 'b.durand'; pc02.win.cachedLogons = ['b.durand', 'tssr'];
  /* poste RH : navigation externe via le proxy Squid du pare-feu (Options Internet) ; l'intranet et le pare-feu restent en direct */
  pc02.proxy = { enabled: true, server: '10.10.0.1', port: 3128, bypassLocal: true, exceptions: ['10.10.*', '*.toulouse.local'] };
  const pcadm = WB.winClient('PC-ADM', { domain: 'toulouse.local', dhcp: false, ip: '10.10.30.10', gw: '10.10.30.1', dns: ['10.10.10.10'], suffix: 'toulouse.local', svc: Object.assign({}, CLIENT_SVC, { TermService: [R, 'auto'] }), roles: ['rdp'], rdp: true }); pcadm.user = 'tssr'; pcadm.win.cachedLogons = ['tssr'];
  dev['PC-01'] = pc01; dev['PC-02'] = pc02; dev['PC-ADM'] = pcadm;
  /* Imprimante réseau IMP-T1 : IP statique dans la plage exclue, port 9100/515/631 */
  dev['IMP-T1'] = { kind: 'printer', name: 'IMP-T1', model: 'Imprimante laser réseau', ifaces: { eth0: { mac: U.mac('IMP-T1eth0'), ip: '10.10.20.250', mask: '255.255.255.0', gw: '10.10.20.1', dhcp: false, cable: null } }, listen: ['tcp/9100', 'tcp/515', 'tcp/631', 'tcp/80'], phys: { on: true, psu: true, strip: true }, queue: [] };
  dev['IMP-T1'].win = undefined;

  /* ===== Bordeaux : SRV-DC2 + PC-B1 ===== */
  const dc2 = WB.winServer('SRV-DC2', { ip: '10.20.10.10', gw: '10.20.10.1', dns: ['10.20.10.10'], domain: 'bordeaux.local', suffix: 'bordeaux.local', roles: ['dns', 'dhcp', 'ad', 'rdp'], rdp: true,
    svc: { NTDS: [R, 'auto'], Kdc: [R, 'auto'], DNS: [R, 'auto'], DHCPServer: [R, 'auto'], TermService: [R, 'auto'] } });
  dc2.win.ad = WB.adBordeaux();
  dc2.win.dns = { recursion: true, forwarders: ['8.8.8.8'], listen: [], condForwarders: [{ zone: 'toulouse.local', servers: ['10.10.10.10'] }],
    zones: [{ name: '_msdcs.bordeaux.local', type: 'primary', adIntegrated: true, state: 'running', records: [{ name: '_ldap._tcp.dc', type: 'SRV', data: '0 100 389 srv-dc2.bordeaux.local.' }, { name: '_kerberos._tcp.dc', type: 'SRV', data: '0 100 88 srv-dc2.bordeaux.local.' }] }, { name: 'bordeaux.local', type: 'primary', adIntegrated: true, state: 'running', dynUpdate: 'secure', records: [
      { name: '@', type: 'A', data: '10.20.10.10' }, { name: 'srv-dc2', type: 'A', data: '10.20.10.10' }, { name: 'pfsense-bdx', type: 'A', data: '10.20.0.1' }, { name: '@', type: 'NS', data: 'srv-dc2.bordeaux.local.' }] }] };
  dc2.win.dhcp = { authorized: true, serverOptions: { 6: '10.20.10.10', 15: 'bordeaux.local' }, bindings: ['Ethernet0'],
    scopes: [{ id: '10.20.20.0', name: 'Postes Bordeaux', net: '10.20.20.0', mask: '255.255.255.0', start: '10.20.20.50', end: '10.20.20.150', active: true, leaseSec: 691200, exclusions: [], reservations: [], options: { 3: '10.20.20.1', 6: '10.20.10.10', 15: 'bordeaux.local' } }] };
  dc2.win.shares = [{ name: 'NETLOGON', path: 'C:\\Windows\\SYSVOL\\sysvol\\bordeaux.local\\SCRIPTS', comment: 'Partage du serveur d’accès', perms: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] }, { name: 'SYSVOL', path: 'C:\\Windows\\SYSVOL\\sysvol', comment: 'Partage du serveur d’accès', perms: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] }]; dc2.win.iis = null;
  dev['SRV-DC2'] = dc2;
  dc2.win.dns.zones.forEach(z => z.records.forEach(r => { r.id = r.name + '|' + r.type + (r.type === 'NS' ? '|' + r.data : ''); }));
  const pct1 = WB.winClient('PC-B1', { domain: 'bordeaux.local', suffix: 'bordeaux.local' }); pct1.user = 'e.garcia'; pct1.win.cachedLogons = ['e.garcia']; dev['PC-B1'] = pct1;

  /* ===== Ramonville : postes en groupe de travail ===== */
  const pcp1 = WB.winClient('PC-RV1', { domain: null, dhcp: false, ip: '172.16.1.30', gw: '172.16.1.1', dns: ['172.16.3.10'], workgroup: 'RAMONVILLE', roles: [] }); pcp1.user = 'tech';
  const pcp2 = WB.winClient('PC-RV2', { domain: null, workgroup: 'RAMONVILLE' }); pcp2.user = 'tech';
  dev['PC-RV1'] = pcp1; dev['PC-RV2'] = pcp2;

  /* ===== Labège : postes de la maquette OSPF (adresses statiques, groupe de travail) ===== */
  const pcl2 = WB.winClient('PC-LB2', { domain: null, dhcp: false, ip: '10.30.102.10', mask: '255.255.255.0', gw: '10.30.102.1', dns: ['8.8.8.8'], workgroup: 'LABEGE', roles: [] }); pcl2.user = 'tech';
  const pcl4 = WB.winClient('PC-LB4', { domain: null, dhcp: false, ip: '10.30.104.10', mask: '255.255.255.0', gw: '10.30.104.1', dns: ['8.8.8.8'], workgroup: 'LABEGE', roles: [] }); pcl4.user = 'tech';
  const pcl6 = WB.winClient('PC-LB6', { domain: null, dhcp: false, ip: '10.30.106.10', mask: '255.255.255.0', gw: '10.30.106.1', dns: ['8.8.8.8'], workgroup: 'LABEGE', roles: [] }); pcl6.user = 'tech';
  dev['PC-LB2'] = pcl2; dev['PC-LB4'] = pcl4; dev['PC-LB6'] = pcl6;

  /* ===== Colomiers : postes de la maquette EtherChannel / Spanning Tree (adresses statiques, pas de passerelle : réseau de couche 2) ===== */
  [['PC-C1', '10.40.10.11'], ['PC-C2', '10.40.10.12'], ['PC-C3', '10.40.20.11'], ['PC-C4', '10.40.20.12']].forEach(([id, ip]) => {
    const pc = WB.winClient(id, { domain: null, dhcp: false, ip, mask: '255.255.255.0', gw: '', dns: [], workgroup: 'COLOMIERS', roles: [] }); pc.user = 'tech'; dev[id] = pc;
  });

  /* ===== poste distant (télétravailleur) sur « Internet » ===== */
  const ext = WB.winClient('PCEXT', { domain: null, dhcp: false, ip: '198.18.0.10', mask: '255.255.255.0', gw: '198.18.0.1', dns: ['8.8.8.8'], workgroup: 'WORKGROUP', fwProfile: 'public' });
  ext.user = 'tssr'; ext.vpn = { client: 'OpenVPN', profiles: [{ name: 'FormaTech-Toulouse', server: 'vpn.formatech.fr', port: 1194, proto: 'udp', ca: 'CA-FormaTech', cert: 'cert-tssr', user: 'tssr', tlsKey: 'tlsk-01' }] };
  dev['PCEXT'] = ext;
};

/* ---------- câblage physique des hôtes ---------- */
WB.cableHosts = function (W) {
  const dev = W.dev;
  WB.link(dev, 'SRV-DC1:Ethernet0', 'SW-T1:FastEthernet0/2');
  WB.link(dev, 'SRV-FIC:Ethernet0', 'SW-T1:FastEthernet0/3');
  WB.link(dev, 'SRV-LNX:eth0', 'SW-T1:FastEthernet0/4');
  WB.link(dev, 'SRV-WEB:eth0', 'SW-DMZ:p2');
  WB.wall(W, 'T-114', 'SW-T2:FastEthernet0/2', 'PC-01:Ethernet0');
  WB.link(dev, 'PC-02:Ethernet0', 'SW-T3:FastEthernet0/2');
  WB.link(dev, 'PC-ADM:Ethernet0', 'SW-T2:FastEthernet0/10');
  WB.link(dev, 'IMP-T1:eth0', 'SW-T3:FastEthernet0/5');
  WB.link(dev, 'SRV-DC2:Ethernet0', 'SW-B1:FastEthernet0/2');
  WB.link(dev, 'PC-B1:Ethernet0', 'SW-B1:FastEthernet0/3');
  WB.link(dev, 'PC-RV1:Ethernet0', 'SW-RVA:p2');
  WB.link(dev, 'PC-RV2:Ethernet0', 'SW-RVB:p2');
  WB.link(dev, 'SRV-RV:eth0', 'R-RV1:GigabitEthernet0/3');
  WB.link(dev, 'PC-LB2:Ethernet0', 'R-LB2:GigabitEthernet0/2');
  WB.link(dev, 'PC-LB4:Ethernet0', 'R-LB4:GigabitEthernet0/2');
  WB.link(dev, 'PC-LB6:Ethernet0', 'R-LB6:GigabitEthernet0/1');
  WB.link(dev, 'PC-C1:Ethernet0', 'SW-CB:FastEthernet0/10');
  WB.link(dev, 'PC-C3:Ethernet0', 'SW-CB:FastEthernet0/11');
  WB.link(dev, 'PC-C2:Ethernet0', 'SW-CC:FastEthernet0/10');
  WB.link(dev, 'PC-C4:Ethernet0', 'SW-CC:FastEthernet0/11');
  WB.link(dev, 'PCEXT:Ethernet0', 'ISP:to-X');
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
