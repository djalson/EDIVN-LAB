const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'ad_trust', dev: 'SRV-DC1', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' });
  console.log('aduc', await t.open('aduc')); await t.p.waitForTimeout(300);
  await t.p.click('.mmc .tvr:has(.tvl:text-is("Utilisateurs")) .tvx'); await t.p.waitForTimeout(150);
  await t.shot('w7pre');
  await t.p.click('.mmc .tvr:has-text("Informatique")'); await t.p.waitForTimeout(200); await t.shot('w7a');
  await t.p.dblclick('.mmc .lvr:has-text("Admin TSSR")'); await t.p.waitForTimeout(300);
  await t.p.click('.ttab:has-text("Compte")'); await t.p.waitForTimeout(200); await t.shot('w7b');
  await t.p.click('.propsheet button:has-text("Horaires d’accès")'); await t.p.waitForTimeout(300); await t.shot('w7c');
  console.log('domain', await t.open('domain')); await t.p.waitForTimeout(300);
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
