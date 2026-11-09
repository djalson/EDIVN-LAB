const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForTimeout(300);
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '3', faultId: 'phys_screen' }));
  const host = await p.evaluate(() => { const r = SIM_APP.run; return r.m.fault ? JSON.stringify(Object.keys(r.m)) : 'x'; });
  console.log(host);
  await p.evaluate(() => SIM_APP.openDev('PC-01', 'main')); await p.waitForTimeout(400);
  await p.screenshot({ path: require('os').tmpdir() + '/w1.png' });
  console.log('nosig:', await p.evaluate(() => !!document.querySelector('.nosig')));
  console.log(JSON.stringify(errs));
  await b.close();
})();
