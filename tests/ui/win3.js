const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForTimeout(300);
  await p.evaluate(() => SIM_APP.begin({ level: 2, mode: 'free', seed: '7', faultId: 'lx_ssh_conf' }));
  await p.evaluate(() => SIM_APP.openDev('SRV-DC1', 'main')); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/w4.png' });
  await p.click('.logon'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/w5.png' });
  await p.fill('.logon input[type=text]', 'TOULOUSE\\Administrateur'); await p.fill('.logon input[type=password]', 'Adm!n2026'); await p.keyboard.press('Enter');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '/tmp/w6.png' });
  await p.evaluate(() => { const ds = document.querySelector('.desk'); });
  console.log(JSON.stringify(errs));
  await b.close();
})();
