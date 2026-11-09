const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'web_cert_expired', dev: 'PC-01' });
  console.log('open', await t.open('browser', 'https://srv-fic.toulouse.local')); await t.p.waitForTimeout(900); await t.shot('w10a');
  await t.p.click('.bwarn button:has-text("Paramètres avancés")'); await t.p.waitForTimeout(200); await t.shot('w10b');
  await t.p.click('.bwarn a:has-text("Continuer")'); await t.p.waitForTimeout(800); await t.shot('w10c');
  console.log(JSON.stringify(await t.ev(() => SIM_APP.run.W.obs.filter(o => /^http/.test(o.key)))));
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
