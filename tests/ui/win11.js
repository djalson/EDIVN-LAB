const T = require('/home/claude/game/tests/ui/lib.js');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'dhcp_svc', dev: 'SRV-DC1', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' }); const p = t.p;
  await p.waitForTimeout(1500); await t.shot('win11a');
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll('.smtile')).map(x => x.innerText.replace(/\n/g, ' | ')).join('\n')));
  await p.click('.smni:has-text("Serveur local")'); await p.waitForTimeout(300); await t.shot('win11b');
  await p.click('.smv:has-text("Activé")'); await p.waitForTimeout(400); await t.shot('win11c');
  console.log('rdp', await p.evaluate(() => JSON.stringify(SIM_APP.run.W.d('SRV-DC1').win.rdp)));
  await t.open('compmgmt'); await p.waitForTimeout(500); await t.shot('win11d');
  await t.open('lusrmgr'); await p.waitForTimeout(500); await t.shot('win11e');
  await t.open('taskmgr'); await p.waitForTimeout(300);
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
