/* Pannes proxy réparées par l'interface web de pfSense (gestes réels) et vérifiées côté poste RH (PC-02).
   Cas : ACL (sous-réseau refusé), cache local jamais enregistré, squidGuard « default deny » (Save puis Apply),
   liste de catégories absente (Download). */
const T = require('./lib');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); else console.log('✓ ' + m); };
const status = t => t.p.evaluate(() => SIM_APP.run.m.parts.map(x => x.rt && x.rt.status).join(','));

async function pfLogin(fault) {
  const t = await T.start({ fault, dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  await t.open('browser', 'https://10.10.0.1/'); await t.p.waitForTimeout(800);
  await t.p.click('.bwarn button:has-text("Paramètres avancés")'); await t.p.click('.bwarn a:has-text("Continuer")'); await t.p.waitForTimeout(800);
  await t.p.fill('.pfw-login input[type=text]', 'admin'); await t.p.fill('.pfw-login input[type=password]', 'pfSense#2026'); await t.p.click('.pfw-login button'); await t.p.waitForTimeout(900);
  t.nav = async (menu, item) => { await t.p.click('.pfw-mi:has-text("' + menu + '")'); await t.p.click('.pfw-mi.open .pfw-dd a:has-text("' + item + '")'); await t.p.waitForTimeout(500); };
  t.text = () => t.p.evaluate(() => document.querySelector('.pfw-main').innerText);
  t.tab = async (name) => { await t.p.click('.pfw-tabs a:text-is("' + name + '")'); await t.p.waitForTimeout(450); };
  return t;
}
(async () => {
  /* 1. sous-réseau refusé */
  let t = await pfLogin('px_subnet_denied');
  ok(/^active$/.test(await status(t)), 'px_subnet_denied : active après injection (' + await status(t) + ')');
  await t.nav('Services', 'Squid Proxy Server'); await t.tab('ACLs');
  const ta = await t.p.$$('.pfw-main textarea'); await ta[0].fill('10.10.0.0/16');
  await t.p.click('.pfw-main button:text-is("Save")'); await t.p.waitForTimeout(600);
  await t.p.waitForTimeout(1500); ok(/fixed|resolved/.test(await status(t)), 'px_subnet_denied : réparée par Squid → ACLs → Allowed subnets (' + await status(t) + ')');
  console.log(t.errs.join('\n') || 'no errors'); const e1 = t.errs.length; await t.b.close();

  /* 2. cache local jamais enregistré */
  t = await pfLogin('px_cache_unsaved');
  await t.nav('Status', 'Services'); let tx = await t.text();
  ok(/squid\s+Squid Web Proxy Server\s+Stopped/i.test(tx), 'px_cache_unsaved : Status > Services montre Squid arrêté');
  await t.nav('Services', 'Squid Proxy Server'); await t.tab('Local Cache'); await t.p.click('.pfw-main button:text-is("Save")'); await t.p.waitForTimeout(700);
  await t.p.waitForTimeout(1500); ok(/fixed|resolved/.test(await status(t)), 'px_cache_unsaved : réparée par Local Cache → Save (' + await status(t) + ')');
  const e2 = t.errs.length; console.log(t.errs.join('\n') || 'no errors'); await t.b.close();

  /* 3. squidGuard default deny : Save sans Apply ne répare rien, Apply répare */
  t = await pfLogin('px_sg_default_deny');
  await t.nav('Services', 'SquidGuard Proxy Filter'); await t.tab('Common ACL'); await t.p.click('.pfw-main button:text-is("+")'); await t.p.waitForTimeout(250);
  const sels = await t.p.$$('.pfw-main table select'); await sels[sels.length - 1].selectOption('allow');
  await t.p.click('.pfw-main button:text-is("Save")'); await t.p.waitForTimeout(1500);
  ok(/active/.test(await status(t)), 'px_sg_default_deny : Save seul ne répare pas (modification non appliquée) (' + await status(t) + ')');
  await t.tab('General settings'); await t.p.click('.pfw-main button:text-is("Apply")'); await t.p.waitForTimeout(1500);
  ok(/fixed|resolved/.test(await status(t)), 'px_sg_default_deny : réparée après Apply (' + await status(t) + ')');
  const e3 = t.errs.length; console.log(t.errs.join('\n') || 'no errors'); await t.b.close();

  /* 4. liste de catégories absente (URL fausse) : Download avec l'URL corrigée */
  t = await pfLogin('px_sg_nolist');
  await t.nav('Services', 'SquidGuard Proxy Filter'); tx = await t.text(); ok(/SquidGuard service state:\s*STOPPED/.test(tx), 'px_sg_nolist : squidGuard STOPPED');
  await t.tab('Blacklist'); const u = await t.p.$('.pfw-main input.form-control'); await u.fill('http://dsi.ut-capitole.fr/blacklists/download/blacklists_for_pfsense.tar.gz');
  await t.p.click('.pfw-main button:text-is("Download")'); await t.p.waitForTimeout(600); tx = await t.text(); ok(/Blacklist update complete/.test(tx), 'px_sg_nolist : Download terminé');
  await t.p.waitForTimeout(1500); ok(/fixed|resolved/.test(await status(t)), 'px_sg_nolist : réparée par Blacklist → Download (' + await status(t) + ')');
  const e4 = t.errs.length; console.log(t.errs.join('\n') || 'no errors'); await t.b.close();

  console.log(fails.length ? fails.map(x => '✗ ' + x).join('\n') : 'tout est conforme');
  process.exit(fails.length || e1 || e2 || e3 || e4 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
