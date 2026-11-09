/* Test : dhcp_conflict réparé en reconfigurant l'imprimante depuis son panneau (adresse manuelle hors plage), puis renouvellement du bail. */
const T = require('./lib.js');
(async () => {
  const t = await T.start({ fault: 'dhcp_conflict', dev: 'PC-01', seed: '7' }); const p = t.p;
  await p.evaluate(() => SIM_APP.openDev('IMP-T1', 'main')); await p.waitForTimeout(500);
  const btn = async (x) => { await p.click('.prnb:has-text("' + x + '")'); await p.waitForTimeout(120); };
  await btn('▼'); await btn('OK');           // Réseau
  await btn('▼'); await btn('OK');           // Adresse IP
  await p.fill('.prnin', '10.10.20.250'); await btn('OK');
  await t.shot('rig4a');
  console.log(await p.evaluate(() => JSON.stringify(SIM_APP.run.W.d('IMP-T1').ifaces.eth0.ip)), await p.evaluate(() => JSON.stringify(SIM_APP.run.m.parts.map(x => x.rt.status))));
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
