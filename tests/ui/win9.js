const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'web_cert_expired', dev: 'SRV-FIC', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' });
  console.log('wf', await t.open('wf')); await t.p.waitForTimeout(400); await t.shot('w9a');
  await t.p.dblclick('.mmc .lvr:has-text("Demande d’écho")'); await t.p.waitForTimeout(300); await t.shot('w9b');
  await t.p.click('.propsheet button:has-text("Annuler")'); await t.p.waitForTimeout(150);
  console.log('iis', await t.open('iis')); await t.p.waitForTimeout(400);
  await t.p.click('.mmc >> nth=1 >> .tvr:has(.tvl:text-is("Portail"))'); await t.p.waitForTimeout(200); await t.shot('w9c');
  await t.p.click('.mmcact >> nth=1 >> .acti:has-text("Liaisons")'); await t.p.waitForTimeout(300); await t.shot('w9d');
  await t.p.click('.dlg2 button:has-text("Fermer")'); await t.p.waitForTimeout(150);
  console.log('certlm', await t.open('certlm')); await t.p.waitForTimeout(400); await t.shot('w9e');
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
