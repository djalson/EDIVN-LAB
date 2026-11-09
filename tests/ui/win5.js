const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForTimeout(300);
  await p.evaluate(() => SIM_APP.begin({ level: 3, mode: 'free', seed: '3', faultId: 'sh_ntfs_deny' }));
  console.log(await p.evaluate(() => JSON.stringify(SIM_APP.run.m.fault.c || {})));
  await p.evaluate(() => SIM_APP.openDev('SRV-FIC', 'main')); await p.waitForTimeout(400);
  await p.click('.logon'); await p.waitForTimeout(200);
  await p.fill('.logon input[type=text]', 'TOULOUSE\\Administrateur'); await p.fill('.logon input[type=password]', 'Adm!n2026'); await p.keyboard.press('Enter');
  await p.waitForTimeout(1800);
  await p.evaluate(() => { const d = SIM_APP.run.surfaces['SRV-FIC'].desk; d.open('explorer', 'D:\\Partages\\Compta'); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: require('os').tmpdir() + '/e1.png' });
  await p.evaluate(() => { const d = SIM_APP.run.surfaces['SRV-FIC'].desk; UI = SIM.ui; UI.folderProps(d, null, { display: 'Compta', path: 'D:\\Partages\\Compta' }); });
  await p.waitForTimeout(300);
  // click Sécurité tab
  await p.click('.ttab:has-text("Sécurité")'); await p.waitForTimeout(200);
  await p.screenshot({ path: require('os').tmpdir() + '/e2.png' });
  console.log(JSON.stringify(errs));
  await b.close();
})();
