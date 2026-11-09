const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'pf_lan_rules', dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  console.log('open', await t.open('browser', 'https://10.10.0.1/')); await t.p.waitForTimeout(800);
  await t.p.click('.bwarn button:has-text("Paramètres avancés")'); await t.p.click('.bwarn a:has-text("Continuer")'); await t.p.waitForTimeout(800);
  await t.shot('pf1a');
  await t.p.fill('.pfw-login input[type=text]', 'admin'); await t.p.fill('.pfw-login input[type=password]', 'pfSense#2026'); await t.p.click('.pfw-login button'); await t.p.waitForTimeout(900);
  await t.shot('pf1b');
  const nav = async (menu, item) => { await t.p.click('.pfw-mi:has-text("' + menu + '")'); await t.p.click('.pfw-mi.open .pfw-dd a:has-text("' + item + '")'); await t.p.waitForTimeout(700); };
  await nav('Firewall', 'Rules'); await t.shot('pf1c');
  await t.p.click('.pfw-tabs a:has-text("LAN")'); await t.p.waitForTimeout(700); await t.shot('pf1d');
  await t.p.click('.pfw-btnrow button:has-text("Add")'); await t.p.waitForTimeout(700); await t.shot('pf1e');
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
