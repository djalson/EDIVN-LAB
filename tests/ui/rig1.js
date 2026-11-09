/* Test : vue physique (captures + réparation des pannes de couche 1 par les gestes). */
const T = require('/home/claude/game/tests/ui/lib.js');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'phys_eth', dev: process.argv[3] || 'PC-01', seed: process.argv[4] || '7' });
  const p = t.p; await p.evaluate(dev => SIM_APP.openDev(dev, 'rig'), process.argv[3] || 'PC-01'); await p.waitForTimeout(600);
  await t.shot('rig_' + (process.argv[2] || 'phys_eth'));
  console.log(await p.evaluate(() => JSON.stringify(SIM_APP.run.m.parts.map(x => x.rt && x.rt.status))));
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
