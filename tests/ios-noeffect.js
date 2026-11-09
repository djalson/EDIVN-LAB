/* D-99 / D-111 : une commande de configuration IOS acceptée mais dont le simulateur ne garde aucune trace affiche l'avis de la couche jeu
   « acceptée, sans effet dans le simulateur » (jamais un refus : cela casserait le collage d'une configuration de TP).
   Seule « no cdp run » est dans ce cas aujourd'hui. Les six autres commandes relevées par l'inventaire (docs/INVENTAIRE-COMMANDES.md) ne reçoivent PAS l'avis :
   cinq sont idempotentes (la valeur demandée est déjà celle du simulateur : un vrai IOS ne change rien non plus), une est appliquée mais non réaffichée dans le running-config.
   Ce test fige les deux faces : l'avis existe quand il est vrai ; il n'existe pas quand il serait faux (D-13). */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const fails = []; const ok = (c, m) => { if (!c) { fails.push(m); console.log('✗ ' + m); } else console.log('✓ ' + m); };
const text = r => (r.out || []).map(x => x.t).join('\n');
const run = (dev, pre, cmd) => { const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W); const sh = SIM.emu.openIos(env, dev, { via: 'console' }); sh.exec('enable'); const a = text(sh.exec('show running-config')); sh.exec('configure terminal'); pre.forEach(c => sh.exec(c)); const o = text(sh.exec(cmd)); sh.exec('end'); const b = text(sh.exec('show running-config')); return { o, same: a === b, shell: sh }; };
for (const dev of ['SW-CA', 'R-LB3']) { const r = run(dev, [], 'no cdp run'); ok(/sans effet dans le simulateur/.test(r.o) && !/% Invalid/.test(r.o), dev + ' : « no cdp run » est acceptée ET signalée « sans effet dans le simulateur »'); }
/* les commandes idempotentes ne reçoivent aucun avis, et leur variante qui change quelque chose change bien le running-config */
const IDEM = [['SW-CA', [], 'spanning-tree vlan 10 priority 4096', 'spanning-tree vlan 10 priority 8192'], ['SW-CA', [], 'hostname SW-CA', 'hostname SW-X'], ['R-LB3', ['router ospf 1'], 'router-id 10.30.255.3', 'router-id 10.30.255.9'], ['R-LB3', [], 'ip ssh version 2', 'ip ssh version 1']];
IDEM.forEach(([dev, pre, same, diff]) => { const a = run(dev, pre, same), b = run(dev, pre, diff); ok(a.same && !/sans effet/.test(a.o), dev + ' : « ' + same + ' » idempotente → running-config inchangé, aucun avis (un avis serait faux)'); ok(!b.same, dev + ' : « ' + diff + ' » change bien le running-config (la commande n’est pas un simple no-op)'); });
/* « show etherchannel » seul (consigne de midi, travail 6.4) : la sortie réelle n'est pas relevée → « non gérée », jamais « % Incomplete command. » ; la forme « summary » reste émulée */
{ const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W); const sh = SIM.emu.openIos(env, 'SW-CA', { via: 'console' }); sh.exec('enable');
  const bare = text(sh.exec('show etherchannel')), summ = text(sh.exec('show etherchannel summary'));
  ok(/non gérée par le simulateur/.test(bare) && !/Incomplete/.test(bare), '« show etherchannel » seul : réponse « non gérée par le simulateur » (pas « % Incomplete command. »)');
  ok(/Number of channel-groups in use/.test(summ) && !/non gérée/.test(summ), 'neutralisation : « show etherchannel summary » reste émulée et ne reçoit pas l’avis'); }
console.log(fails.length ? fails.length + ' échec(s)' : '0 échec'); process.exit(fails.length ? 1 : 0);
