/* Interface du TP Proxy : pages pfSense (Package Manager, Squid, squidGuard, Status > Services, DNS Lookup, AC, surcharge d'hôte)
   et côté poste (Panneau de configuration > Réseau et Internet > Options Internet > Paramètres réseau > Avancé, navigateur). */
const T = require('./lib');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); else console.log('✓ ' + m); };
(async () => {
  /* ---------------- côté pare-feu (depuis PC-ADM) */
  const t = await T.start({ fault: 'pf_dmz_rule', dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  await t.open('browser', 'https://10.10.0.1/'); await t.p.waitForTimeout(800);
  await t.p.click('.bwarn button:has-text("Paramètres avancés")'); await t.p.click('.bwarn a:has-text("Continuer")'); await t.p.waitForTimeout(800);
  await t.p.fill('.pfw-login input[type=text]', 'admin'); await t.p.fill('.pfw-login input[type=password]', 'pfSense#2026'); await t.p.click('.pfw-login button'); await t.p.waitForTimeout(900);
  const nav = async (menu, item) => { await t.p.click('.pfw-mi:has-text("' + menu + '")'); await t.p.click('.pfw-mi.open .pfw-dd a:has-text("' + item + '")'); await t.p.waitForTimeout(500); };
  const text = () => t.p.evaluate(() => document.querySelector('.pfw-main').innerText);
  const tab = async (name) => { await t.p.click('.pfw-tabs a:text-is("' + name + '")'); await t.p.waitForTimeout(450); };

  await nav('System', 'Package Manager'); let tx = await text();
  ok(/pfSense-pkg-squid\b/.test(tx) && /pfSense-pkg-squidGuard/.test(tx), 'Package Manager : squid et squidGuard installés');
  await tab('Available Packages'); tx = await text(); ok(/Installed/.test(tx), 'Available Packages : paquets déjà installés signalés');

  await nav('Services', 'Squid Proxy Server'); tx = await text();
  ok(/Enable Squid Proxy/.test(tx) && /Proxy Interface\(s\)/.test(tx) && /Allow Users on Interface/.test(tx) && /Transparent HTTP Proxy/.test(tx) && /HTTPS\/SSL Interception/.test(tx) && /Enable Access Logging/.test(tx), 'Squid General : libellés du TP');
  await tab('Local Cache'); tx = await text(); ok(/Hard Disk Cache Size/.test(tx), 'Squid Local Cache');
  await tab('ACLs'); tx = await t.p.evaluate(() => Array.from(document.querySelectorAll('.pfw-main textarea')).map(x => x.value).join('|')); ok(/facebook\.com/.test(tx) && /10\.10\.0\.0\/16/.test(tx), 'Squid ACLs : Blacklist et sous-réseaux autorisés');
  await tab('Real Time'); tx = await text(); ok(/Squid - Access Logs/.test(tx) && /Squid - Cache Logs/.test(tx), 'Squid Real Time');

  await nav('Services', 'SquidGuard Proxy Filter'); tx = await text(); ok(/SquidGuard service state:\s*STARTED/.test(tx), 'squidGuard : STARTED');
  await tab('Common ACL'); await t.p.click('.pfw-main button:text-is("+")'); await t.p.waitForTimeout(250); tx = await text();
  ok(/\[blk_blacklists_social_networks\]/.test(tx) && /Default access \[all\]/.test(tx), 'squidGuard Common ACL : catégories et accès par défaut');
  await tab('Blacklist'); await t.p.click('.pfw-main button:text-is("Download")'); await t.p.waitForTimeout(500); tx = await text(); ok(/Blacklist update complete/.test(tx), 'squidGuard Blacklist : téléchargement terminé');
  await tab('Log'); await t.p.click('.pfw-main button:text-is("Blocked")'); await t.p.waitForTimeout(300); tx = await text(); ok(/squidGuard log \(blocked\)/.test(tx), 'squidGuard Log : bouton Blocked');

  await nav('Status', 'Services'); tx = await text(); ok(/squid\s+Squid Web Proxy Server\s+Running/.test(tx) && /squidGuard\s+SquidGuard Proxy Filter\s+Running/.test(tx) && /c-icap/.test(tx), 'Status > Services : squid et squidGuard démarrés');
  await t.p.click('.pfw-main tr:has-text("Squid Web Proxy Server") a[title="Restart Service"]'); await t.p.waitForTimeout(500); tx = await text(); ok(/Service squid restarted successfully/.test(tx), 'Status > Services : redémarrage de squid');

  await nav('Diagnostics', 'DNS Lookup'); await t.p.fill('.pfw-main input[type=text]', 'www.google.com'); await t.p.click('.pfw-main button:text-is("DNS Lookup")'); await t.p.waitForTimeout(400); tx = await text();
  ok(/216\.239\.38\.120/.test(tx) && /127\.0\.0\.1/.test(tx), 'DNS Lookup : SafeSearch forcé, réponse du résolveur 127.0.0.1');
  await nav('Services', 'DNS Resolver'); tx = await text(); ok(/www\.google\.fr|google\.fr/.test(tx) && /Alias for www\.google\.com/.test(tx), 'DNS Resolver : alias de la surcharge d’hôte');

  await nav('System', 'Cert. Manager'); await t.p.click('.pfw-btnrow button:has-text("Add")'); await t.p.waitForTimeout(400);
  const inputs = await t.p.$$('.pfw-main input[type=text]'); await inputs[0].fill('CA-Proxy-Squid'); await inputs[inputs.length - 1].fill('ca-proxy-squid');
  await t.p.click('.pfw-main button:text-is("Save")'); await t.p.waitForTimeout(500); tx = await text(); ok(/CA-Proxy-Squid/.test(tx) && /ca-proxy-squid/.test(tx), 'Cert. Manager : création de l’AC interne');
  await t.b.close();

  /* ---------------- côté poste (PC-02) */
  const u = await T.start({ fault: 'pf_dmz_rule', dev: 'PC-02', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  await u.open('control'); await u.p.waitForTimeout(400);
  let body = await u.p.evaluate(() => document.body.innerText); ok(!/Options Internet/.test(body), 'Panneau de configuration par catégories : « Options Internet » absent de la première page');
  await u.p.click('.explorer :text("Réseau et Internet")'); await u.p.waitForTimeout(300); body = await u.p.evaluate(() => document.body.innerText); ok(/Options Internet/.test(body), 'Réseau et Internet : « Options Internet » présent');
  await u.p.click('.explorer :text("Options Internet")'); await u.p.waitForTimeout(400);
  ok(await u.p.isVisible('.propsheet'), 'Fenêtre « Propriétés de : Internet »');
  await u.p.click('.propsheet button:text-is("Paramètres réseau")'); await u.p.waitForTimeout(350);
  const vals = await u.p.evaluate(() => Array.from(document.querySelectorAll('.win:has(.mbbtns) input.w10in')).map(i => i.value)); ok(vals.indexOf('10.10.0.1') >= 0 && vals.indexOf('3128') >= 0, 'Paramètres du réseau local : proxy 10.10.0.1:3128 prérempli (' + vals.join(',') + ')');
  await u.p.click('button:text-is("Avancé")'); await u.p.waitForTimeout(350); const exc = await u.p.evaluate(() => Array.from(document.querySelectorAll('textarea.w10in')).map(i => i.value).join('|')); ok(/10\.10\.\*/.test(exc), 'Paramètres du proxy : exceptions ' + exc);
  await u.shot('proxy-adv');
  console.log(u.errs.join('\n') || 'no errors'); await u.b.close();
  console.log(fails.length ? fails.map(x => '✗ ' + x).join('\n') : 'tout est conforme'); process.exit(fails.length || u.errs.length || t.errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
