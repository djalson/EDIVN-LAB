/* Consoles MMC : double-clic dans le volet central sur un dossier (« Pool d'adresses ») → le dossier s'ouvre, comme la vraie MMC.
   Console DHCP : plage d'adresses, exclusions et propriétés de l'étendue consultables. */
const L = require('./lib');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const T = await L.start({ fault: 'dns_cache', seed: 'x', level: 1, dev: 'SRV-DC1', user: 'tssr', pwd: 'Tssr-2026!' }); const { p } = T;
  await p.evaluate(() => SIM_APP.run.surfaces['SRV-DC1'].desk.open('dhcp')); await p.waitForTimeout(300);
  if (await p.locator('.win.uac').count()) { await p.locator('.win.uac button', { hasText: /^Oui$/ }).click(); await p.waitForTimeout(400); }
  const w = p.locator('.win.mmc').last();
  await w.locator('.tvr', { hasText: 'Étendue' }).first().click(); await p.waitForTimeout(250);
  await w.locator('.mmcmid .lvr', { hasText: 'Pool d’adresses' }).first().dblclick(); await p.waitForTimeout(300);
  ok(/Pool d’adresses/.test(await w.locator('.tvr.sel').first().textContent()), 'double-clic sur « Pool d’adresses » : le dossier est sélectionné dans l’arbre');
  const mid = await w.locator('.mmcmid').textContent();
  ok(/Plage d’adresses pour la distribution/.test(mid) && /\d+\.\d+\.\d+\.\d+/.test(mid), 'pool : plage d’adresses affichée');
  await w.locator('.tvr', { hasText: 'Étendue' }).first().click(); await p.waitForTimeout(200);
  await w.locator('.acti', { hasText: /^Propriétés$/ }).first().click(); await p.waitForTimeout(350);
  ok(await p.locator('.win.propsheet').count() > 0, 'propriétés de l’étendue ouvertes');
  ok(!T.errs.length, 'aucune erreur de page' + (T.errs.length ? ' : ' + T.errs.join(' | ') : ''));
  await T.b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ mmc-nav : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
