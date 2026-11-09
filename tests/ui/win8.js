const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'gpo_secfilter', dev: 'SRV-DC1', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' });
  console.log('gpmc', await t.open('gpmc')); await t.p.waitForTimeout(400); await t.shot('w8a');
  await t.p.click('.mmc .tvr:has(.tvl:text-is("Objets de stratégie de groupe"))'); await t.p.waitForTimeout(200); await t.shot('w8b');
  await t.p.dblclick('.mmc .lvr:has-text("GPO_Postes_Securite")'); await t.p.waitForTimeout(300); await t.shot('w8c');
  await t.p.click('.ttab:has-text("Paramètres")'); await t.p.waitForTimeout(200); await t.shot('w8d');
  await t.p.click('.mmc .tvr:has(.tvl:text-is("Résultats de stratégie de groupe"))'); await t.p.waitForTimeout(200);
  await t.p.click('.mmcact .acti:has-text("Assistant Résultats")'); await t.p.waitForTimeout(300);
  await t.p.click('.dlg2 button:has-text("Terminer")'); await t.p.waitForTimeout(500); await t.shot('w8e');
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
