const T = require('/home/claude/game/tests/ui/lib.js');
(async () => {
  const t = await T.start({ fault: 'dhcp_conflict', dev: 'PC-01', seed: '7' }); const p = t.p;
  await p.evaluate(() => SIM_APP.openDev('SW-T2', 'rig')); await p.waitForTimeout(700); await t.shot('rig3_sw');
  await p.evaluate(() => SIM_APP.openDev('PATCH-T', 'patch')); await p.waitForTimeout(700); await t.shot('rig3_patch');
  await p.evaluate(() => SIM_APP.openDev('SRV-LNX', 'rig')); await p.waitForTimeout(700); await t.shot('rig3_lnx');
  await p.evaluate(() => SIM_APP.openDev('IMP-T1', 'main')); await p.waitForTimeout(700); await t.shot('rig3_prn');
  await p.evaluate(() => SIM_APP.openDev('IMP-T1', 'rig')); await p.waitForTimeout(700); await t.shot('rig3_prnrig');
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
