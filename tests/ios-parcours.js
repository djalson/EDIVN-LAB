/* Parcours « du ticket à la clôture » à travers les gestionnaires des terminaux (D-66), pour les pannes de redondance qui ne coupent rien (D-93)
   et pour les deux types de sonde OSPF (voisinage ; ping). Pour Cisco, « l'interface » est le terminal du produit : le test joue les VRAIS
   gestionnaires de commandes (ping de PC-C1, console IOS des commutateurs), pas le moteur. Pour chaque variante :
     1. panne active ; 2. le joueur teste avec un ping depuis un poste : (pannes silencieuses) le ping réussit mais la clôture est REFUSÉE et le message dit pourquoi ;
     3. il lit l'état sur les commutateurs ; 4. il corrige avec de vraies commandes ; 5. la panne est « réparée » mais PAS résolue tant qu'il n'a pas relu l'état
        (un ping ne résout pas : neutralisation de la vérification) ; 6. il relit l'état → la mission se clôt, résolue ; 7. le débrief porte le motif du refus.
   Neutralisation (D-70) : (a) correction omise → la relecture de l'état ne résout rien ; (b) correction faite mais seulement un ping ensuite → pas résolue. */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const G = SIM.game;
const fails = []; const ok = (c, m) => { if (!c) { fails.push(m); console.log('✗ ' + m); } else console.log('✓ ' + m); };
const text = r => r.out.map(x => x.t).join('\n');
let now = 0; const clock = () => now;
const blank = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
const seedFor = (faultId, key) => { for (let s = 1; s < 300; s++) { const m = G.create({ seed: String(s), level: 'confirme', mode: 'free', faultId, clock: () => 0, profile: blank() }); if (m.fault.vars && m.fault.vars.m && m.fault.vars.m.key === key) return String(s); } throw new Error('aucune graine pour ' + faultId + '/' + key); };
const st = m => m.parts.map(p => p.rt.status).join(',');
const GI = ['GigabitEthernet0/1', 'GigabitEthernet0/2'];
const ifCmds = (ports, cmds) => ports.reduce((a, p) => a.concat(['interface ' + p], cmds), []);

/* variante → commandes que tape le joueur (par équipement), équipement et commande de relecture */
const EC_READ = { dev: 'SW-CA', cmd: 'show etherchannel summary' };
const ECN = [
  ['ec_negotiation', 'passive-passive', { 'SW-CA': ifCmds(GI, ['channel-group 1 mode active']), 'SW-CB': ifCmds(GI, ['channel-group 1 mode active']) }, EC_READ, true],
  ['ec_negotiation', 'on-active', { 'SW-CA': ifCmds(GI, ['channel-group 1 mode active']) }, EC_READ, true],
  ['ec_negotiation', 'desirable', { 'SW-CB': ifCmds(GI, ['channel-group 1 mode active']) }, { dev: 'SW-CB', cmd: 'show etherchannel summary' }, true],
  ['ec_group_missing', 'cb-both', { 'SW-CB': ifCmds(GI, ['channel-group 1 mode active']) }, { dev: 'SW-CB', cmd: 'show etherchannel summary' }, true],
  ['ec_group_missing', 'ca-gi2', { 'SW-CA': ifCmds([GI[1]], ['channel-group 1 mode active']) }, EC_READ, true],
  ['ec_member_mismatch', 'cb-gi2-access', { 'SW-CB': ifCmds([GI[1]], ['switchport mode trunk']) }, { dev: 'SW-CB', cmd: 'show etherchannel summary' }, false],
  ['ec_member_mismatch', 'ca-gi1-allowed', { 'SW-CA': ifCmds([GI[0]], ['switchport trunk allowed vlan 10,20']) }, EC_READ, false],
  ['ec_member_mismatch', 'cb-both-native', { 'SW-CB': ifCmds(GI, ['switchport trunk native vlan 1']) }, { dev: 'SW-CB', cmd: 'show etherchannel summary' }, false],
  ['stp_root_moved', 'cc-0', { 'SW-CC': ['no spanning-tree vlan 10,20 priority'] }, { dev: 'SW-CA', cmd: 'show spanning-tree vlan 10' }, true],
  ['stp_root_moved', 'cb-0', { 'SW-CB': ['no spanning-tree vlan 10,20 priority'] }, { dev: 'SW-CA', cmd: 'show spanning-tree vlan 10' }, true],
  ['stp_root_moved', 'cc-v10', { 'SW-CC': ['no spanning-tree vlan 10 priority'] }, { dev: 'SW-CB', cmd: 'show spanning-tree vlan 10' }, true]
];

function open(m) {
  const env = T.mk(m.W);
  const ios = {}; const cli = dev => ios[dev] || (ios[dev] = (() => { const sh = SIM.emu.openIos(env, dev, { via: 'console' }); sh.exec('enable'); return sh; })());
  const pc = (h) => SIM.emu.openWinShell(env, h, { elevated: true, user: 'Administrateur' });
  return { env, cli, pc };
}
function play(m, o, cmds) {   /* le joueur tape les commandes de configuration puis revient au mode privilégié */
  for (const dev of Object.keys(cmds)) { const sh = o.cli(dev); sh.exec('configure terminal'); for (const c of cmds[dev]) { const r = sh.exec(c); const t = text(r); if (/% (Invalid|Incomplete|Ambiguous)|Invalid input/.test(t)) return dev + '# ' + c + ' → ' + t.split('\n')[0]; } sh.exec('end'); m.act({ kind: 'cmd', dev, text: cmds[dev].join(' ; '), mutates: true }); }
  return null;
}

function parcours(faultId, key, fixCmds, read, pingStaysGreen, extra) {
  const tag = faultId + '/' + key; now = 0;
  const m = G.create({ seed: seedFor(faultId, key), level: 'confirme', mode: 'free', faultId, clock, profile: blank() });
  ok(m.fault.vars.m.key === key && st(m) === 'active', tag + ' : variante tirée et panne active');
  const o = open(m); const part = m.parts[0];
  ok(!!part.verifyText && !/show|channel-group|priority|spanning-tree vlan/.test(part.verifyText), tag + ' : la description de vérification existe et ne nomme ni la commande ni la cause (D-71)');
  /* 2. le joueur teste au ping */
  now += 60000; const pr = o.pc('PC-C1').exec('ping 10.40.10.12'); m.act({ kind: 'cmd', dev: 'PC-C1', text: 'ping 10.40.10.12' }); m.check();
  if (pingStaysGreen) ok(/Réponse de 10\.40\.10\.12|Reply from 10\.40\.10\.12|octets=/.test(text(pr)), tag + ' : le ping réussit alors que la panne est active (la panne est silencieuse)');
  ok(st(m) === 'active', tag + ' : le ping ne change pas l’état de la panne (' + st(m) + ')');
  now += 5000; const c1 = m.close();
  ok(c1.ok === false && c1.why === 'active' && c1.message.indexOf(part.closeNote) >= 0, tag + ' : clôture sur ping refusée, le message dit pourquoi');
  /* 3. il lit l'état avant de corriger */
  now += 30000; const before = text(o.cli(read.dev).exec(read.cmd)); m.act({ kind: 'cmd', dev: read.dev, text: read.cmd });
  ok(before.length > 80, tag + ' : la lecture de l’état sur ' + read.dev + ' répond (' + before.split('\n').length + ' lignes)');
  /* neutralisation (b) : correction faite, puis seulement un ping → pas résolue */
  const bad = play(m, o, fixCmds); ok(!bad, tag + ' : les commandes de correction sont acceptées' + (bad ? ' — ' + bad : ''));
  m.check(); ok(st(m) === 'fixed', tag + ' : après correction la panne est « réparée » mais pas encore résolue (' + st(m) + ')');
  now += 20000; o.pc('PC-C1').exec('ping 10.40.10.12'); m.act({ kind: 'cmd', dev: 'PC-C1', text: 'ping 10.40.10.12' }); m.check();
  ok(st(m) === 'fixed' && m.state === 'running', tag + ' : un ping après correction ne résout pas — NEUTRALISATION de la vérification (' + st(m) + ')');
  /* 6. relecture de l'état */
  now += 15000; const after = text(o.cli(read.dev).exec(read.cmd)); m.act({ kind: 'cmd', dev: read.dev, text: read.cmd }); m.check();
  ok(m.state === 'done' && m.result.kind === 'resolved', tag + ' : la relecture de l’état clôt la mission, résolue (' + (m.result && m.result.kind) + ')');
  ok(after !== before, tag + ' : la lecture de l’état a changé entre avant et après la correction');
  const d = m.debrief();
  ok(d.wrongCloses === 1 && d.closeRefusals.length === 1 && d.closeRefusals[0].note === part.closeNote, tag + ' : le débrief porte le motif de la clôture refusée');
  /* neutralisation (a) : correction omise → la relecture ne résout rien */
  now = 0; const m2 = G.create({ seed: seedFor(faultId, key), level: 'confirme', mode: 'free', faultId, clock, profile: blank() }); const o2 = open(m2);
  o2.cli(read.dev).exec(read.cmd); m2.check();
  ok(st(m2) === 'active' && m2.state === 'running', tag + ' : sans correction, lire l’état ne résout rien — NEUTRALISATION (' + st(m2) + ')');
  return m;
}
ECN.forEach(r => parcours(r[0], r[1], r[2], r[3], r[4]));

/* ---- OSPF : un parcours par type de sonde ---- */
function ospf(faultId, key, fixCmds, probeOf, checks) {
  const tag = faultId + '/' + key; now = 0;
  const m = G.create({ seed: seedFor(faultId, key), level: 'confirme', mode: 'free', faultId, clock, profile: blank() });
  ok(st(m) === 'active', tag + ' : panne active (' + st(m) + '), sonde « ' + probeOf + ' »');
  const o = open(m);
  now += 60000; checks.before(m, o);
  const bad = play(m, o, fixCmds); ok(!bad, tag + ' : les commandes de correction sont acceptées' + (bad ? ' — ' + bad : ''));
  m.check(); const mid = st(m);
  now += 20000; checks.after(m, o);
  m.check(); ok(m.state === 'done' && m.result.kind === 'resolved', tag + ' : mission clôturée, résolue (' + st(m) + ' ; avant la relecture : ' + mid + ')');
  now = 0; const m2 = G.create({ seed: seedFor(faultId, key), level: 'confirme', mode: 'free', faultId, clock, profile: blank() }); const o2 = open(m2);
  checks.after(m2, o2); m2.check(); ok(m2.state === 'running' && st(m2) === 'active', tag + ' : sans correction, les mêmes relectures ne résolvent rien — NEUTRALISATION (' + st(m2) + ')');
}
const nbrOf = (m, o, dev) => text(o.cli(dev).exec('show ip ospf neighbor'));
ospf('ospf_timers', 'hello-lb4', { 'R-LB4': ['interface GigabitEthernet0/1', 'no ip ospf hello-interval', 'no ip ospf dead-interval'] }, 'ospfnbr', {
  before(m, o) { const t = nbrOf(m, o, 'R-LB4'); ok(!/10\.30\.255\.5/.test(t), 'ospf_timers/hello-lb4 : le voisin R-LB5 manque dans « show ip ospf neighbor »'); m.act({ kind: 'cmd', dev: 'R-LB4', text: 'show ip ospf neighbor' }); },
  after(m, o) { const t = nbrOf(m, o, 'R-LB4'); m.act({ kind: 'cmd', dev: 'R-LB4', text: 'show ip ospf neighbor' }); if (m.parts[0].rt.status !== 'active') ok(/10\.30\.255\.5/.test(t) && /FULL/.test(t), 'ospf_timers/hello-lb4 : le voisin R-LB5 est de nouveau FULL'); } });
ospf('ospf_timers', 'dead-lb3', { 'R-LB3': ['interface GigabitEthernet0/1', 'no ip ospf dead-interval'] }, 'ospfnbr', {
  before(m, o) { m.act({ kind: 'cmd', dev: 'R-LB3', text: 'show ip ospf neighbor' }); nbrOf(m, o, 'R-LB3'); },
  after(m, o) { nbrOf(m, o, 'R-LB3'); m.act({ kind: 'cmd', dev: 'R-LB3', text: 'show ip ospf neighbor' }); } });
ospf('ospf_timers', 'hello-lb2', { 'R-LB2': ['interface GigabitEthernet0/0', 'no ip ospf hello-interval', 'no ip ospf dead-interval'] }, 'ospfnbr', {
  before(m, o) { m.act({ kind: 'cmd', dev: 'R-LB2', text: 'show ip ospf neighbor' }); nbrOf(m, o, 'R-LB2'); },
  after(m, o) { nbrOf(m, o, 'R-LB2'); m.act({ kind: 'cmd', dev: 'R-LB2', text: 'show ip ospf neighbor' }); } });
/* sonde « ping » : le réseau local n'est plus annoncé → le ping entre bâtiments échoue puis réussit */
const pingCheck = (host, ip, dev) => ({
  before(m, o) { const t = text(o.pc(host).exec('ping ' + ip)); m.act({ kind: 'cmd', dev: host, text: 'ping ' + ip }); ok(!/Réponse de \S+ : octets=/.test(t), 'ospf_lan_network : le ping ' + host + ' → ' + ip + ' échoue avant la correction'); },
  after(m, o) { o.pc(host).exec('ping ' + ip); m.act({ kind: 'cmd', dev: host, text: 'ping ' + ip }); } });
ospf('ospf_lan_network', 'lb4-absent', { 'R-LB4': ['router ospf 1', 'network 10.30.104.0 0.0.0.255 area 0'] }, 'ping', pingCheck('PC-LB2', '10.30.104.10'));
ospf('ospf_lan_network', 'lb2-wild', { 'R-LB2': ['router ospf 1', 'no network 10.30.102.0 0.0.0.0 area 0', 'network 10.30.102.0 0.0.0.255 area 0'] }, 'ping', pingCheck('PC-LB4', '10.30.102.10'));
ospf('ospf_lan_network', 'lb6-area', { 'R-LB6': ['router ospf 1', 'no network 10.30.106.0 0.0.0.255 area 0', 'network 10.30.106.0 0.0.0.255 area 1'] }, 'ping', pingCheck('PC-LB2', '10.30.106.10'));


/* ospf_routerid_dup : panne silencieuse (l'anneau OSPF garde les postes joignables par l'autre sens) — fermée par la lecture des voisinages, pas par un ping */
function ridParcours(key, dev, own, other) {
  const faultId = 'ospf_routerid_dup', tag = faultId + '/' + key; now = 0;
  const m = G.create({ seed: seedFor(faultId, key), level: 'confirme', mode: 'free', faultId, clock, profile: blank() });
  ok(m.fault.vars.m.key === key && st(m) === 'active', tag + ' : variante tirée et panne active');
  const o = open(m); const part = m.parts[0];
  ok(!!part.verifyText && !/show|router-id|clear ip/.test(part.verifyText), tag + ' : la description de vérification existe et ne nomme ni la commande ni la cause (D-71)');
  now += 60000; const pr = o.pc('PC-LB2').exec('ping 10.30.104.10'); m.act({ kind: 'cmd', dev: 'PC-LB2', text: 'ping 10.30.104.10' }); m.check();
  ok(/octets=/.test(text(pr)) && st(m) === 'active', tag + ' : le ping entre bâtiments réussit alors que la panne est active (l’autre sens de l’anneau porte le trafic)');
  now += 5000; const c1 = m.close(); ok(c1.ok === false && c1.why === 'active' && c1.message.indexOf(part.closeNote) >= 0, tag + ' : clôture sur ping refusée, le message dit pourquoi');
  now += 30000; const read = 'show ip ospf neighbor'; const before = text(o.cli(dev).exec(read)); m.act({ kind: 'cmd', dev, text: read });
  ok(before !== undefined && !new RegExp('\\b' + other.replace(/\./g, '\\.') + '\\b').test(before), tag + ' : sur ' + dev + ', le voisin ' + other + ' manque dans « ' + read + ' »');
  const sh = o.cli(dev); sh.exec('configure terminal'); sh.exec('router ospf 1'); const rr = text(sh.exec('router-id ' + own)); ok(!/% (Invalid|Incomplete)/.test(rr), tag + ' : « router-id ' + own + ' » est accepté'); sh.exec('end');
  m.act({ kind: 'cmd', dev, text: 'router-id ' + own, mutates: true });
  const cl = sh.exec('clear ip ospf process'); if (cl.ask) sh.exec('yes'); m.act({ kind: 'cmd', dev, text: 'clear ip ospf process', mutates: true }); m.check();
  ok(st(m) === 'fixed', tag + ' : après correction la panne est « réparée » mais pas encore résolue (' + st(m) + ')');
  now += 20000; o.pc('PC-LB2').exec('ping 10.30.104.10'); m.act({ kind: 'cmd', dev: 'PC-LB2', text: 'ping 10.30.104.10' }); m.check();
  ok(st(m) === 'fixed' && m.state === 'running', tag + ' : un ping après correction ne résout pas — NEUTRALISATION de la vérification (' + st(m) + ')');
  now += 15000; const after = text(o.cli(dev).exec(read)); m.act({ kind: 'cmd', dev, text: read }); m.check();
  ok(m.state === 'done' && m.result.kind === 'resolved', tag + ' : la relecture des voisinages clôt la mission, résolue (' + (m.result && m.result.kind) + ')');
  ok(new RegExp('\\b' + other.replace(/\./g, '\\.') + '\\b').test(after) && /FULL/.test(after), tag + ' : le voisin ' + other + ' est de nouveau FULL');
  ok(m.debrief().closeRefusals.length === 1, tag + ' : le débrief porte le motif de la clôture refusée');
  now = 0; const m2 = G.create({ seed: seedFor(faultId, key), level: 'confirme', mode: 'free', faultId, clock, profile: blank() }); const o2 = open(m2);
  o2.cli(dev).exec(read); m2.act({ kind: 'cmd', dev, text: read }); m2.check();
  ok(st(m2) === 'active' && m2.state === 'running', tag + ' : sans correction, lire les voisinages ne résout rien — NEUTRALISATION (' + st(m2) + ')');
}
ridParcours('lb5-as-lb4', 'R-LB5', '10.30.255.5', '10.30.255.4');
ridParcours('lb3-as-lb2', 'R-LB3', '10.30.255.3', '10.30.255.2');

console.log(fails.length ? fails.length + ' échec(s)' : '0 échec');
process.exit(fails.length ? 1 : 0);
