/* Panne dhcp_unauth : journal DHCP-Server (1046) visible, autorisation depuis la console DHCP, résolution. */
const T = require('./lib');
(async () => {
  const t = await T.start({ level: 3, fault: 'dhcp_unauth', dev: 'SRV-DC1', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' });
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  chk('dhcp ouvre', await t.open('dhcp')); await t.p.waitForTimeout(300);
  chk('autorisé = false après injection', !(await t.ev(() => SIM_APP.run.W.d('SRV-DC1').win.dhcp.authorized)));
  await t.p.click('.mmc .tvr:has-text("srv-dc1")'); await t.p.waitForTimeout(200); await t.shot('dauth1');
  await t.p.click('.mmcact .acti:has-text("Autoriser")'); await t.p.waitForTimeout(300);
  chk('autorisé = true après clic', await t.ev(() => SIM_APP.run.W.d('SRV-DC1').win.dhcp.authorized));
  chk('journal DHCP-Server contient 1046', await t.ev(() => SIM_APP.run.W.logs('SRV-DC1', 'evt:DHCP-Server').some(e => e.id === 1046)));
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close(); process.exit(ok && !t.errs.length ? 0 : 1);
})();
