/* Baie de brassage : chaque port de commutateur porte son étiquette (description du port) dans l'info-bulle, pour brasser sans deviner.
   Retour joueur : prise T-114 rebrassée sur Fa0/1 (VLAN 1) au lieu de Fa0/2 → APIPA, faute de repère dans la baie. */
const L = require('./lib.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const t = await L.start({ fault: 'phys_wall', dev: 'PC-01', seed: '7' }); const p = t.p;
  await p.evaluate(() => SIM_APP.openDev('PATCH-T', 'patch')); await p.waitForTimeout(400);
  const fa2 = await p.getAttribute('.rpc[data-port="SW-T2:FastEthernet0/2"]', 'title');
  const fa1 = await p.getAttribute('.rpc[data-port="SW-T2:FastEthernet0/1"]', 'title');
  const fa10 = await p.getAttribute('.rpc[data-port="SW-T2:FastEthernet0/10"]', 'title');
  ok(/étiquette : « PC-01 \(prise T-114\) »/.test(fa2), 'Fa0/2 de SW-T2 : étiquette « PC-01 (prise T-114) » — ' + fa2);
  ok(!/étiquette/.test(fa1), 'Fa0/1 sans description : pas d’étiquette inventée — ' + fa1);
  ok(/étiquette : « PC-ADM »/.test(fa10) && !/VLAN|vlan/.test(fa10 + fa2), 'Fa0/10 : étiquette « PC-ADM » ; aucune info de VLAN dans la baie');
  ok(!t.errs.length, 'aucune erreur JavaScript' + (t.errs.length ? ' — ' + t.errs[0] : ''));
  await t.b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : 'tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
