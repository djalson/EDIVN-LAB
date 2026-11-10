/* Pannes de couche 1 des sites distants (lot V3) : réparées par la vue physique du poste, puis constatées résolues. */
const T = require('./lib.js');
(async () => {
  let ok = true;
  for (const [fault, dev] of [['phys_eth_bdx', 'PC-B1'], ['phys_eth_rv', 'PC-RV1']]) {
    const t = await T.start({ fault, dev, seed: '7' }); const p = t.p;
    await p.evaluate(h => SIM_APP.openDev(h, 'rig'), dev); await p.waitForTimeout(500);
    await p.click('.rigplug.loose'); await p.click('.ctx .ctxi:has-text("Rebrancher le câble réseau")'); await p.waitForTimeout(400);
    const st = await p.evaluate(() => { const run = SIM_APP.run; run.check(); return run.m.parts[0].rt.status; });
    const good = (st === 'fixed' || st === 'resolved') && !t.errs.length; if (!good) ok = false;
    console.log((good ? '✓ ' : '✗ ') + fault + ' sur ' + dev + ' : après le geste, état « ' + st + ' »' + (t.errs.length ? ' ' + t.errs.join(' ; ') : ''));
    await t.b.close();
  }
  console.log(ok ? 'OK rig-sites' : 'ÉCHEC'); process.exit(ok ? 0 : 1);
})();
