const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'dhcp_scope_off', dev: 'SRV-DC1', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' });
  console.log('dhcp', await t.open('dhcp')); await t.p.waitForTimeout(300);
  await t.p.click('.mmc .tvr:has-text("Étendue [10.10.20.0]") .tvx'); await t.p.waitForTimeout(100);
  await t.p.click('.mmc .tvr:has-text("Pool d’adresses")'); await t.p.waitForTimeout(200); await t.shot('w6c');
  // nouvelle exclusion via action
  await t.p.click('.mmcact .acti:has-text("Nouvelle plage d’exclusion")'); await t.p.waitForTimeout(200);
  const ins = t.p.locator('.dlg2 .ipbox input'); const n = await ins.count(); console.log('ip inputs', n);
  for (const [i, v] of ['10','10','20','150','10','10','20','155'].entries()) await ins.nth(i).fill(v);
  await t.p.click('.dlg2 button:has-text("Ajouter")'); await t.p.waitForTimeout(300);
  console.log('exclusions', JSON.stringify(await t.ev(() => SIM_APP.run.W.d('SRV-DC1').win.dhcp.scopes[0].exclusions)));
  await t.p.click('.dlg2 button:has-text("Fermer")'); await t.p.waitForTimeout(200); await t.shot('w6c2');
  await t.p.click('.mmc .tvr:has-text("Options d’étendue")'); await t.p.waitForTimeout(200);
  await t.p.click('.mmc .tvr:has-text("Réservations")'); await t.p.waitForTimeout(200); await t.shot('w6c3');
  await t.p.click('.mmc .tvr:has-text("Concessions")'); await t.p.waitForTimeout(200); await t.shot('w6c4');
  await t.p.click('.mmc .tvr:has-text("Étendue [10.10.20.0]")'); await t.p.waitForTimeout(100);
  await t.p.click('.mmcact .acti:has-text("Activer")'); await t.p.waitForTimeout(300);
  console.log('scope active:', await t.ev(() => SIM_APP.run.W.d('SRV-DC1').win.dhcp.scopes[0].active));
  console.log('dns', await t.open('dns')); await t.p.waitForTimeout(400); await t.shot('w6d');
  await t.p.click('.mmc >> nth=1 >> .tvr:has-text("toulouse.local")'); 
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
