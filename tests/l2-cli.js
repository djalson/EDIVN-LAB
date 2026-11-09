/* EtherChannel et Spanning Tree en ligne de commande IOS (site de Colomiers) : création / retrait de membres, modes, suspension,
   arrêt du Port-channel, priorités STP, journaux, refus de saisies invalides. Les états sont lus avec les « show » comme le ferait un admin. */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const sh = {}; const sw = id => sh[id] || (sh[id] = (() => { const s = SIM.emu.openIos(env, id, { via: 'console' }); s.exec('enable'); return s; })());
const run = (id, ...cmds) => cmds.map(c => sw(id).exec(c).out.map(x => x.t).join('\n')).join('\n');
const summ = id => run(id, 'show etherchannel summary').split('\n').filter(l => /^\d+\s+Po/.test(l)).join('|');
const stp = (id, v) => run(id, 'show spanning-tree vlan ' + v);
let o;

/* état sain */
ok(/Po1\(SU\)\s+LACP\s+Gi0\/1\(P\)\s+Gi0\/2\(P\)/.test(summ('SW-CA')), 'sain : Po1(SU) avec les deux membres agrégés');
/* retrait d'un membre */
o = run('SW-CB', 'conf t', 'interface gi0/2', 'no channel-group', 'end');
ok(/%EC-5-UNBUNDLE: Interface Gi0\/2 left the port-channel Po1/.test(o), 'no channel-group : message UNBUNDLE');
ok(/Po1\(SU\)\s+LACP\s+Gi0\/1\(P\)\s*$/.test(summ('SW-CB')), 'SW-CB : un seul membre reste dans le groupe');
ok(/Gi0\/1\(P\)\s+Gi0\/2\(I\)/.test(summ('SW-CA')), 'SW-CA : le membre dont le partenaire est parti est resté seul (I)');
ok(/Po1\s+Altn BLK/.test(stp('SW-CB', 10)) && /Gi0\/2\s+Root FWD/.test(stp('SW-CB', 10)), 'SW-CB : le câble resté seul devient port racine, Po1 est bloqué (Altn BLK)');
/* retour dans le groupe en mode passif → agrégé de nouveau (active ↔ passive) */
o = run('SW-CB', 'conf t', 'interface gi0/2', 'channel-group 1 mode passive', 'end');
ok(/%EC-5-BUNDLE: Interface Gi0\/2 joined port-channel Po1/.test(o), 'channel-group … mode passive : message BUNDLE');
ok(/Gi0\/1\(P\)\s+Gi0\/2\(P\)/.test(summ('SW-CA')) && /Gi0\/1\(P\)\s+Gi0\/2\(P\)/.test(summ('SW-CB')), 'active ↔ passive : agrégation rétablie des deux côtés');
/* passive ↔ passive : personne ne propose */
run('SW-CA', 'conf t', 'interface gi0/1', 'channel-group 1 mode passive', 'interface gi0/2', 'channel-group 1 mode passive', 'end');
run('SW-CB', 'conf t', 'interface gi0/1', 'channel-group 1 mode passive', 'end');
ok(/Po1\(SD\)\s+LACP\s+Gi0\/1\(I\)\s+Gi0\/2\(I\)/.test(summ('SW-CA')), 'passive ↔ passive : Po1(SD), membres (I)');
run('SW-CA', 'conf t', 'interface gi0/1', 'channel-group 1 mode active', 'interface gi0/2', 'channel-group 1 mode active', 'end');
run('SW-CB', 'conf t', 'interface gi0/1', 'channel-group 1 mode active', 'end');
ok(/Po1\(SU\)/.test(summ('SW-CA')), 'retour en active : Po1(SU)');
/* membre incompatible : suspendu et signalé */
o = run('SW-CB', 'conf t', 'interface gi0/2', 'switchport trunk allowed vlan 10', 'end', 'show logging');
ok(/CANNOT_BUNDLE2: Gi0\/2 is not compatible with Po1 and will be suspended/.test(o), 'VLAN autorisés différents : CANNOT_BUNDLE2 dans le journal');
ok(/Gi0\/2\(s\)/.test(summ('SW-CB')), 'le membre incompatible est suspendu (s)');
run('SW-CB', 'conf t', 'interface gi0/2', 'switchport trunk allowed vlan 10,20', 'end');
ok(/Gi0\/1\(P\)\s+Gi0\/2\(P\)/.test(summ('SW-CB')), 'configuration alignée : membre agrégé de nouveau');
/* Port-channel éteint */
o = run('SW-CA', 'conf t', 'interface port-channel 1', 'shutdown', 'end');
ok(/changed state to administratively down/.test(o), 'shutdown du Port-channel : journal « administratively down »');
ok(/Po1\(SD\)/.test(summ('SW-CB')), 'l’autre commutateur voit Po1(SD)');
ok(run('SW-CA', 'show running-config interface port-channel 1').indexOf(' shutdown') >= 0, 'running-config : shutdown sous Port-channel1');
run('SW-CA', 'conf t', 'interface port-channel 1', 'no shutdown', 'end');
ok(/Po1\(SU\)/.test(summ('SW-CB')), 'no shutdown : Po1(SU) de nouveau');
/* priorités STP */
o = run('SW-CB', 'conf t', 'spanning-tree vlan 10 priority 5000');
ok(/must be in increments of 4096/.test(o), 'priorité non multiple de 4096 refusée');
run('SW-CC', 'conf t', 'spanning-tree vlan 10 priority 0', 'end');
ok(/This bridge is the root/.test(stp('SW-CC', 10)) && !/This bridge is the root/.test(stp('SW-CA', 10)), 'priorité 0 : SW-CC devient racine du VLAN 10');
ok(/This bridge is the root/.test(stp('SW-CA', 20)), 'VLAN 20 : SW-CA reste racine');
ok(/ROOTCHANGE: Root Changed for vlan 10/.test(run('SW-CB', 'show logging')), 'journal : %SPANTREE-5-ROOTCHANGE');
ok(/spanning-tree vlan 10 priority 0/.test(run('SW-CC', 'show running-config | include spanning')), 'running-config : priorité visible');
run('SW-CC', 'conf t', 'no spanning-tree vlan 10 priority', 'end');
ok(/This bridge is the root/.test(stp('SW-CA', 10)), 'no … priority : SW-CA de nouveau racine');
/* STP désactivé + boucle : tempête, puis retour à la normale */
run('SW-CC', 'conf t', 'no spanning-tree vlan 10', 'end');
ok(/does not exist/.test(stp('SW-CC', 10)), 'no spanning-tree vlan 10 : plus d’instance');
run('SW-CC', 'conf t', 'spanning-tree vlan 10', 'end');
ok(/Fa0\/23\s+Root FWD/.test(stp('SW-CC', 10)), 'spanning-tree vlan 10 : instance recréée');
/* commandes invalides */
ok(/Invalid input/.test(run('SW-CB', 'conf t', 'interface gi0/1', 'channel-group 1 mode bidule')), 'mode inconnu refusé');
run('SW-CB', 'end');
ok(/Invalid input/.test(run('SW-CB', 'channel-group 1 mode active')), 'channel-group refusé hors du mode interface');
console.log(n + ' assertions, ' + bad + ' échec(s)');
process.exit(bad ? 1 : 0);
