const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForTimeout(300);
  await p.evaluate(() => SIM_APP.begin({ level: 2, mode: 'free', seed: '7', faultId: 'lx_ssh_conf' }));
  await p.evaluate(() => SIM_APP.openDev('PC-ADM', 'main')); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/w2.png' });
  await p.click('.startb'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/w3.png' });
  await p.keyboard.press('Escape');
  console.log(JSON.stringify(errs));
  await b.close();
})();
