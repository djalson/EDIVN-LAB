/* Vérification de clôture : le test qui prouve la réparation ressemble à celui qui échouait.
   iis_stopped : afficher l'écran de PC-01 ne clôture plus ; ouvrir l'intranet dans le navigateur (favori « Intranet ») clôture. */
const L = require('./lib');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const T = await L.start({ fault: 'iis_stopped', seed: 'v1', level: 1, dev: 'PC-01' }); const { p } = T;
  await p.evaluate(() => { const W = SIM_APP.run.W; SIM.win.setSvc(W, 'SRV-FIC', 'W3SVC', 'running'); W.touch('svc'); SIM_APP.run.check(); });
  await p.evaluate(() => SIM_APP.openDev('PC-01', 'main')); await p.waitForTimeout(600);
  ok(await p.evaluate(() => SIM_APP.run.m.state === 'running'), 'service relancé + écran de PC-01 affiché : le ticket reste ouvert');
  await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.open('browser')); await p.waitForTimeout(400);
  const fav = p.locator('.win.browser .bfav', { hasText: 'Intranet' }); ok(await fav.count() === 1, 'navigateur : favori « Intranet »');
  ok(await p.locator('.win.browser .bfav', { hasText: 'Google' }).count() === 1, 'navigateur : favori « Google »');
  await fav.click(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => SIM_APP.run.m.state !== 'running' && SIM_APP.run.m.result && SIM_APP.run.m.result.kind === 'resolved'), 'intranet ouvert depuis PC-01 : ticket clôturé');
  ok(!T.errs.length, 'aucune erreur de page' + (T.errs.length ? ' : ' + T.errs.join(' | ') : ''));
  await T.b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ verify-strict : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
