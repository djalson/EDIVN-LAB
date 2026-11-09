const L = require('./pflib');
(async () => {
  const t = await L.start({ fault: 'pf_ipsec_p1', dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  await t.open2('https://10.10.0.1/'); await t.shot('pf3a');
  await t.menu('Status', 'IPsec'); await t.shot('pf3b');
  await t.menu('VPN', 'IPsec'); await t.shot('pf3c');
  await t.menu('Status', 'System Logs'); await t.p.click('.pfw-tabs a:text-is("IPsec")'); await t.p.waitForTimeout(600); await t.shot('pf3d');
  await t.menu('Firewall', 'NAT'); await t.shot('pf3e');
  await t.menu('Diagnostics', 'Ping'); await t.setText('Hostname', '10.10.10.10'); await t.p.click('.pfw-main button:has-text("Ping")'); await t.p.waitForTimeout(700); await t.shot('pf3f');
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
