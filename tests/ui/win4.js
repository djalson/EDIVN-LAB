const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForTimeout(300);
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '3', faultId: 'ipv4_subnet' }));
  const host = await p.evaluate(() => SIM_APP.run.m.fault.c ? JSON.stringify(SIM_APP.run.m.fault.c) : 'noc');
  console.log(host);
  await p.evaluate(() => SIM_APP.openDev('PC-ADM', 'main')); await p.waitForTimeout(500);
  await p.evaluate(() => SIM_APP.run.surfaces['PC-ADM'].desk.open('ncpa')); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/n1.png' });
  await p.dblclick('.lvr'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/n2.png' });
  console.log(JSON.stringify(errs));
  await b.close();
})();
