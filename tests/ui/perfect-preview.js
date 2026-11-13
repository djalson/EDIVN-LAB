/* Choix du thème → « Voir l'animation du 100 » : l'animation s'affiche PAR-DESSUS la fenêtre de choix (elle restait dessous). */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href); await p.waitForFunction(() => window.SIM_APP);
  await p.evaluate(() => { window.SIM_NO_UNLOAD_PROMPT = 1; document.querySelectorAll('.overlay').forEach(o => o.remove()); const G = SIM.game; const pr = G.profile(); pr.tourDone = true; G.saveProfile(pr); SIM_APP.home(); SIM_APP.themeModal(); });
  await p.waitForSelector('.modal .thcard');
  await p.locator('.modal button', { hasText: 'Voir l’animation du 100' }).first().click(); await p.waitForSelector('.hperf'); await p.waitForTimeout(300);
  const top = await p.evaluate(() => { const pts = [[0.5, 0.5], [0.3, 0.4], [0.7, 0.6]]; return pts.every(([x, y]) => { const e = document.elementFromPoint(innerWidth * x, innerHeight * y); return e && e.closest('.hperf'); }); });
  ok(top, 'aperçu de l’animation du 100 : affiché au-dessus de la fenêtre de choix du thème');
  await p.locator('.hperf').click(); await p.waitForTimeout(400);
  ok(await p.locator('.hperf').count() === 0 && await p.locator('.modal .thcard').count() > 0, 'clic sur l’animation : elle se ferme, la fenêtre de choix est toujours là');
  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
  await b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : 'tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
