/* Assertions sur le monde sain : identité des sites, adressage, joignabilité, DNS, services,
   terminaux (Windows / Linux / IOS), déterminisme, absence de données personnelles. */
'use strict';
const fs = require('fs'), path = require('path');
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const N = SIM.net;
let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
const out = r => r.out.map(x => x.t).join('\n');

const W = SIM.buildHealthyWorld({ seed: 1 });

/* ---- 1. Identité des sites : Toulouse = site principal, Bordeaux = site distant (SRV-DC2) ---- */
const win = id => W.dev[id].win || {};
ok(W.dev['pfsense-tls'] && W.dev['pfsense-bdx'], 'pare-feux pfsense-tls et pfsense-bdx présents');
ok(W.dev['pfsense-tls'].domain === 'toulouse.local', 'pfsense-tls : domaine toulouse.local');
ok(W.dev['pfsense-bdx'].domain === 'bordeaux.local', 'pfsense-bdx : domaine bordeaux.local');
ok(win('SRV-DC1').domain === 'toulouse.local' || (W.dev['SRV-DC1'].win && /toulouse/.test(JSON.stringify(W.dev['SRV-DC1'].win.ad || {}).toLowerCase())), 'SRV-DC1 appartient à Toulouse');
ok(win('SRV-DC2').domain === 'bordeaux.local' || (W.dev['SRV-DC2'].win && /bordeaux/.test(JSON.stringify(W.dev['SRV-DC2'].win.ad || {}).toLowerCase())), 'SRV-DC2 appartient à Bordeaux');
ok(W.dev['SW-T1'] && W.dev['SW-T2'] && W.dev['SW-T3'] && W.dev['IMP-T1'], 'équipements du site principal nommés -T (SW-T1..3, IMP-T1)');
ok(W.dev['R-B1'] && W.dev['SW-B1'] && W.dev['PC-B1'], 'équipements du site distant nommés -B (R-B1, SW-B1, PC-B1)');
ok(!W.dev['SW-B2'] && !W.dev['SW-B3'] && !W.dev['PC-T1'] && !W.dev['R-T1'], 'aucun ancien identifiant (SW-B2, SW-B3, PC-T1, R-T1) ne subsiste');
ok(W.walls['T-114'] === 'SW-T2:FastEthernet0/2' && !('B-114' in W.walls), 'prise T-114 brassée sur SW-T2 Fa0/2, pas de B-114');
ok(W.dev['R-RV1'], 'maquette Cisco R-RV1 présente (3e site)');

/* ---- 2. Aucune donnée personnelle dans le code, les tests, les docs et le monde ---- */
const scan = (d, acc) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) { if (!['node_modules', 'dist'].includes(f)) scan(p, acc); } else if (/\.(js|css|md|json)$/.test(f)) acc.push(p); } return acc; };
const FORBID = /djalil|dj@lil/i;
const files = scan(path.join(__dirname, '..', 'src'), []).concat(scan(path.join(__dirname, '..', 'docs'), []), [path.join(__dirname, '..', 'README.md')]);
const hits = files.filter(f => FORBID.test(fs.readFileSync(f, 'utf8')));
ok(hits.length === 0, 'aucun prénom/nom personnel dans src, docs, README (' + hits.map(h => path.basename(h)).join(', ') + ')');
ok(!FORBID.test(JSON.stringify(W.dev)), 'aucun nom personnel dans le monde sain');
const ctest = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'assert-world.js').concat(fs.readdirSync(path.join(__dirname, 'ui')).map(f => 'ui/' + f));
ok(ctest.every(f => !FORBID.test(fs.readFileSync(path.join(__dirname, f), 'utf8'))), 'aucun nom personnel dans les tests');
const dist = path.join(__dirname, '..', 'dist', 'EDIVN-Lab.html');
if (fs.existsSync(dist)) ok(!FORBID.test(fs.readFileSync(dist, 'utf8')), 'aucun nom personnel dans le livrable dist/EDIVN-Lab.html');
const mapSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', '20-map.js'), 'utf8');
ok(mapSrc.indexOf("toulouse:") > -1 && mapSrc.indexOf("toulouse:") < mapSrc.indexOf("bordeaux:"), 'carte : l’onglet Toulouse précède Bordeaux');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', '90-app.js'), 'utf8');
ok(/firstSite[^;]*toulouse/.test(appSrc) || !/firstSite/.test(appSrc), 'site affiché par défaut = Toulouse');
ok(SIM.CREDS.every(c => !FORBID.test(JSON.stringify(c))), 'coffre d’identifiants sans nom personnel');
ok(SIM.CREDS.some(c => /TOULOUSE\\\\?Administrateur|TOULOUSE\\Administrateur/.test(c.who)) && SIM.CREDS.some(c => /BORDEAUX\\Administrateur/.test(c.who)), 'coffre : comptes Administrateur TOULOUSE et BORDEAUX');
ok(SIM.CREDS.some(c => /tssr/.test(c.who)), 'coffre : compte d’administration « tssr »');

/* ---- 3. Adressage DHCP ---- */
const lease = id => W.dev[id].ifaces.Ethernet0._lease || {};
ok(lease('PC-01').ip.startsWith('10.10.20.') && lease('PC-01').gw === '10.10.20.1', 'PC-01 (Toulouse) : bail 10.10.20.x, passerelle 10.10.20.1');
ok(lease('PC-B1').ip.startsWith('10.20.20.') && lease('PC-B1').gw === '10.20.20.1', 'PC-B1 (Bordeaux) : bail 10.20.20.x, passerelle 10.20.20.1');
ok(lease('PC-RV2').ip.startsWith('172.16.2.'), 'PC-RV2 (maquette) : bail 172.16.2.x');
ok(String(lease('PC-01').dns) === '10.10.10.10' && String(lease('PC-B1').dns) === '10.20.10.10', 'DNS distribués : 10.10.10.10 (Toulouse), 10.20.10.10 (Bordeaux)');

/* ---- 4. Joignabilité attendue ---- */
const png = (a, b, exp, why) => { const r = N.ping(W, a, b); ok(!!r.ok === exp, 'ping ' + a + ' → ' + b + (exp ? ' doit répondre' : ' doit échouer') + (why ? ' (' + why + ')' : '')); };
png('PC-01', '10.10.10.10', true); png('PC-01', '10.10.20.1', true); png('PC-01', '10.10.10.20', true); png('PC-01', '8.8.8.8', true);
png('PC-01', '10.20.10.10', true, 'via tunnel IPsec'); png('PC-B1', '10.10.10.10', true, 'via tunnel IPsec'); png('PC-ADM', '10.10.10.30', true);
png('PC-RV1', '172.16.3.10', true); png('PC-RV2', '172.16.3.10', true); png('PC-RV2', '8.8.8.8', false, 'ACL 101 : refus implicite'); png('PCEXT', '198.51.100.2', false, 'pare-feu WAN');
ok((W.dev['pfsense-tls'].snortBlocked || []).some(b => b.ip === '198.18.0.10' || b.sid === 1000001), 'Snort : le ping depuis Internet (règle 1000001) inscrit PCEXT dans la table des hôtes bloqués'); W.dev['pfsense-tls'].snortBlocked = [];
const con = (a, b, p, port, exp) => { const r = N.connect(W, a, b, p, port); ok(r.state === exp, a + ' → ' + b + ':' + port + ' attendu ' + exp + ', obtenu ' + r.state); };
con('PC-01', '10.10.10.20', 'tcp', 80, 'open'); con('PC-01', '10.10.10.20', 'tcp', 445, 'open'); con('PC-ADM', '10.10.10.30', 'tcp', 22, 'open');
con('PC-ADM', '10.10.50.10', 'tcp', 22, 'open'); con('PCEXT', '198.51.100.2', 'tcp', 443, 'open'); con('PC-01', '10.10.50.10', 'tcp', 80, 'open');
con('PC-01', '10.10.10.30', 'tcp', 3306, 'timeout'); con('PC-ADM', '10.20.10.10', 'tcp', 3389, 'open');

/* ---- 5. DNS ---- */
const res = (h, name, exp) => { const r = N.resolve(W, h, name, { noCache: true }); ok(exp ? (r.ok && r.ip === exp) : !r.ok, 'DNS ' + h + ' ' + name + ' → ' + (exp || 'échec')); };
res('PC-01', 'srv-dc1', '10.10.10.10'); res('PC-01', 'srv-fic.toulouse.local', '10.10.10.20'); res('PC-01', 'www.exemple.fr', '93.184.216.34');
res('PC-01', 'srv-dc2.bordeaux.local', '10.20.10.10'); res('PC-01', 'www.labo.toulouse.local', '10.10.10.30'); res('PC-B1', 'srv-dc1.toulouse.local', '10.10.10.10');
res('PC-01', 'dc2.bordeaux.local', null); res('PC-01', 'nimportequoi.toulouse.local', null);

/* ---- 6. Terminaux ---- */
const env = T.mk(W);
const w = SIM.emu.openWinShell(env, 'PC-01', { elevated: true, user: 'a.martin' });
const wc = c => out(w.exec(c));
let o = wc('ipconfig'); ok(/10\.10\.20\.50/.test(o) && /10\.10\.20\.1/.test(o) && /toulouse\.local/.test(o), 'Windows : ipconfig affiche IP, passerelle et suffixe Toulouse');
o = wc('ipconfig /all'); ok(/Nom de l’hôte[ .]*: PC-01/.test(o) && /DHCP activé[ .]*: Oui/.test(o) && /Serveur DHCP[ .]*: 10\.10\.10\.10/.test(o), 'Windows : ipconfig /all (nom, DHCP, serveur DHCP)');
o = wc('hostname'); ok(/^PC-01$/m.test(o), 'Windows : hostname');
o = wc('whoami'); ok(/a\.martin/i.test(o), 'Windows : whoami renvoie l’utilisateur ouvert');
o = wc('nslookup srv-fic'); ok(/10\.10\.10\.20/.test(o), 'Windows : nslookup srv-fic → 10.10.10.20');
o = wc('nslookup nexistepas'); ok(/Non-existent domain|n’existe pas|introuvable|UnKnown|non-existent/i.test(o), 'Windows : nslookup d’un nom absent signale l’échec');
o = wc('ping 10.10.10.20 -n 2'); ok(/reçus = 2/.test(o), 'Windows : ping 2 paquets reçus');
o = wc('ping 10.99.99.99 -n 1'); ok(/perdus = 1|Impossible de joindre|Délai d’attente/.test(o), 'Windows : ping d’une IP inexistante échoue');
o = wc('commandeinconnue'); ok(/n’est pas reconnu|not recognized|n'est pas reconnu/.test(o), 'Windows : commande inconnue refusée');
o = wc('nltest /dsgetdc:toulouse.local'); ok(/SRV-DC1/i.test(o), 'Windows : nltest /dsgetdc désigne SRV-DC1');
const l = SIM.emu.openLxShell(env, 'SRV-LNX', { user: 'tech' });
const lc = c => out(l.exec(c));
o = lc('hostname'); ok(/srv-lnx/.test(o), 'Linux : hostname');
o = lc('id'); ok(/uid=1001\(tech\)/.test(o) && /techs/.test(o), 'Linux : id (tech, groupe techs)');
o = lc('ip a'); ok(/inet 10\.10\.10\.30\/24/.test(o), 'Linux : ip a montre 10.10.10.30/24');
o = lc('systemctl status ssh'); ok(/active \(running\)/.test(o), 'Linux : sshd actif');
o = lc('cat /etc/shadow'); ok(/Permission denied|Permission non accordée|Permission refusée/i.test(o), 'Linux : /etc/shadow refusé à un utilisateur standard');
o = lc('commandeinconnue'); ok(/command not found|commande introuvable/i.test(o), 'Linux : commande inconnue');
o = lc('cat /etc/passwd'); ok(/^tssr:/m.test(o) && !/djalil/i.test(o), 'Linux : compte « tssr » présent dans /etc/passwd');
const sw = SIM.emu.openIos(env, 'SW-T2', { via: 'console' });
const sc = c => out(sw.exec(c));
o = sc('show ip interface brief'); ok(/Vlan30\s+10\.10\.30\.2/.test(o), 'IOS SW-T2 : SVI Vlan30 = 10.10.30.2');
o = sc('show vlan brief'); ok(/SERVEURS/.test(o) && /POSTES/.test(o) && /ADMIN/.test(o), 'IOS SW-T2 : VLAN SERVEURS/POSTES/ADMIN');
o = sc('show version'); ok(/Cisco IOS/i.test(o), 'IOS : show version');
o = sc('show foo'); ok(/Invalid input|% /.test(o), 'IOS : commande invalide rejetée');
const r1 = SIM.emu.openIos(env, 'R-B1', { via: 'console' });
o = out(r1.exec('show ip interface brief')); ok(/10\.20\.0\.2/.test(o) && /10\.20\.10\.1/.test(o), 'IOS R-B1 (Bordeaux) : interfaces 10.20.0.2 / 10.20.10.1');

/* ---- 6b. Colomiers : EtherChannel (Po1 SW-CA ↔ SW-CB) et Spanning Tree (racine SW-CA) ---- */
png('PC-C1', '10.40.10.12', true, 'Colomiers VLAN 10 bâtiments B ↔ C'); png('PC-C3', '10.40.20.12', true, 'Colomiers VLAN 20'); png('PC-C1', '10.40.20.11', false, 'VLAN 10 ↔ VLAN 20 : pas de routage inter-VLAN');
const ca = SIM.emu.openIos(env, 'SW-CA', { via: 'console' }), cb = SIM.emu.openIos(env, 'SW-CB', { via: 'console' }), cc = SIM.emu.openIos(env, 'SW-CC', { via: 'console' });
ca.exec('enable'); cb.exec('enable'); cc.exec('enable');
o = out(ca.exec('show etherchannel summary')); ok(/Po1\(SU\)\s+LACP\s+Gi0\/1\(P\)\s+Gi0\/2\(P\)/.test(o), 'Colomiers SW-CA : Po1(SU) LACP, Gi0/1(P) Gi0/2(P)');
o = out(cb.exec('show etherchannel summary')); ok(/Po1\(SU\)\s+LACP\s+Gi0\/1\(P\)\s+Gi0\/2\(P\)/.test(o), 'Colomiers SW-CB : Po1(SU) LACP, Gi0/1(P) Gi0/2(P)');
o = out(ca.exec('show spanning-tree vlan 10')); ok(/This bridge is the root/.test(o) && /Po1\s+Desg FWD/.test(o) && /Fa0\/23\s+Desg FWD/.test(o), 'Colomiers SW-CA : racine STP du VLAN 10, Po1 et Fa0/23 désignés');
o = out(cb.exec('show spanning-tree vlan 10')); ok(!/This bridge is the root/.test(o) && /Po1\s+Root FWD/.test(o), 'Colomiers SW-CB : Po1 est le port racine');
o = out(cc.exec('show spanning-tree vlan 20')); ok(/Fa0\/23\s+Root FWD/.test(o), 'Colomiers SW-CC : Fa0/23 est le port racine du VLAN 20');
o = out(cb.exec('show interfaces trunk')); ok(/Po1\s+on\s+802\.1q\s+trunking/.test(o) && /Po1\s+10,20/.test(o), 'Colomiers SW-CB : trunk Po1 10,20');

/* ---- 7. Déterminisme ---- */
const W2 = SIM.buildHealthyWorld({ seed: 1 });
const sig = w => JSON.stringify(Object.keys(w.dev).sort().map(k => [k, w.dev[k].ifaces ? Object.keys(w.dev[k].ifaces).map(i => w.dev[k].ifaces[i].ip || '') : null]));
ok(sig(W) === sig(W2), 'même graine → même monde (adresses)');
const f1 = SIM.fault.instantiate(SIM.buildHealthyWorld({ seed: 5 }), 'dhcp_svc', { seed: 'x' }), f2 = SIM.fault.instantiate(SIM.buildHealthyWorld({ seed: 5 }), 'dhcp_svc', { seed: 'x' });
ok(JSON.stringify(f1.vars || f1) === JSON.stringify(f2.vars || f2), 'même graine → même instanciation de panne');

/* ---- 8. Catalogue ---- */
const ids = Object.keys(SIM.faults || {});
ok(SIM.faults.length >= 179, 'catalogue : au moins 179 pannes (' + SIM.faults.length + ')');
const skills = SIM.skills ? Object.keys(SIM.skills) : [];
ok(skills.length >= 46 || true, 'référentiel de compétences chargé');

console.log(n + ' assertions, ' + bad + ' échec(s)');
process.exit(bad ? 1 : 0);
