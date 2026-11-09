/* Régressions d'interface : une boîte modale doit toujours passer AU-DESSUS du bureau et des fenêtres. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
  for (const [w, h] of [[1440, 900], [1024, 768], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForFunction(() => window.SIM_APP);
    await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'dhcp_svc', tour: false }));
    await p.evaluate(() => SIM_APP.openDev('SRV-DC1', 'main')); await p.waitForTimeout(500);
    await p.evaluate(() => SIM_APP.vaultModal());
    await p.waitForSelector('.overlay .modal', { timeout: 3000 });
    const r = await p.evaluate(() => {
      const m = document.querySelector('.overlay .modal').getBoundingClientRect();
      const top = document.elementFromPoint(m.left + m.width / 2, m.top + 30);
      return { inModal: !!(top && top.closest('.overlay')), left: m.left, top: m.top, right: m.right, bottom: m.bottom, vw: innerWidth, vh: innerHeight };
    });
    ok(r.inModal, w + '×' + h + ' : le coffre d’identifiants est au-dessus de l’écran de connexion');
    ok(r.left >= 0 && r.top >= 0 && r.right <= r.vw && r.bottom <= r.vh, w + '×' + h + ' : la modale tient entièrement dans la fenêtre');
    await p.close();
  }
  console.log(errs.join('\n') || 'no errors'); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
