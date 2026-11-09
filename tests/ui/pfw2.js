const L = require('./pflib');
const addr = async (t, label, type, a, mask, alias) => {
  const loc = t.p.locator(t.fg(label) + ' select.form-control'); await loc.nth(0).selectOption(type);
  if (a !== undefined) await t.p.fill(t.fg(label) + ' input.form-control[type=text]', a);
  if (mask !== undefined) await loc.nth(1).selectOption(String(mask));
};
const body = t => t.p.evaluate(() => document.querySelector('.pfw-main').innerText);
const tab = async (t, name) => { await t.p.click('.pfw-tabs a:text-is("' + name + '")'); await t.p.waitForTimeout(600); };
const CASES = {
  async pf_lan_norule(t) {
    await t.menu('Firewall', 'Rules'); await tab(t, 'LAN'); await t.p.click('.pfw-btnrow button:has-text("Add")'); await t.p.waitForTimeout(600);
    await t.setSel('Protocol', 'any'); await t.setText('Description', 'LAN vers tout'); await t.save(); await t.apply();
  },
  async pf_dmz_rule(t) {
    await t.menu('Firewall', 'Rules'); await tab(t, 'DMZ'); await t.p.click('a[title="Enable rule"]'); await t.p.waitForTimeout(600); await t.apply();
  },
  async pf_dmz_alias(t) {
    await t.menu('Firewall', 'Aliases'); await t.p.click('a[title="Edit alias"] >> nth=0'); await t.p.waitForTimeout(600);
    const nm = await t.p.inputValue('.pfw-main input.form-control'); if (nm !== 'RFC1918') throw new Error('mauvais alias ' + nm);
    await t.p.click('button:has-text("Add Network")'); const rows = t.p.locator('.pfw-inline input[type=text]'); const n = await rows.count();
    await rows.nth(n - 1).fill('10.0.0.0'); await t.p.locator('.pfw-inline select').last().selectOption('8'); await t.save(); await t.apply();
  },
  async pf_nat_outbound(t) {
    await t.menu('Firewall', 'NAT'); await tab(t, 'Outbound');
    await t.p.click('label:has-text("Hybrid Outbound NAT") input'); await t.p.click('.pfw-panel button:has-text("Save")'); await t.p.waitForTimeout(700);
    let txt = await body(t);
    if (/10\.10\.0\.0\/16/.test(txt.split('Automatic Rules')[0])) { /* règle correcte présente */ }
    else {
      if (/VLAN Toulouse/.test(txt)) { await t.p.click('a[title="Edit mapping"] >> nth=0'); } else { await t.p.click('.pfw-btnrow button:has-text("Add") >> nth=1'); }
      await t.p.waitForTimeout(600); await addr(t, 'Source', 'net', '10.10.0.0', 16); await t.setText('Description', 'VLAN Toulouse derrière routes statiques'); await t.save();
    }
    await t.apply();
  },
  async pf_portfwd(t) {
    await t.menu('Firewall', 'NAT'); await t.p.click('a[title="Edit rule"] >> nth=0'); await t.p.waitForTimeout(600);
    await t.setSel('Interface', 'wan'); await t.p.locator(t.fg('Destination Port Range') + ' input.form-control').nth(0).fill('443'); await t.p.locator(t.fg('Destination Port Range') + ' input.form-control').nth(1).fill('');
    await t.setText('Redirect target IP', '10.10.50.10'); await t.setText('Redirect target port', '443'); await t.setSel('Filter rule association', 'pass'); await t.save(); await t.apply();
  },
  async pf_gateway(t) {
    await t.menu('System', 'Routing'); await t.p.click('a[title="Edit gateway"] >> nth=0'); await t.p.waitForTimeout(600); await t.setText('Gateway', '198.51.100.1'); await t.save(); await t.apply();
  },
  async pf_static_route(t) {
    await t.menu('System', 'Routing'); await tab(t, 'Static Routes'); const txt = await body(t);
    if (/10\.10\.20\.0\/24/.test(txt)) { const idx = await t.p.evaluate(() => Array.from(document.querySelectorAll('.pfw-table tbody tr')).findIndex(r => /10\.10\.20\.0/.test(r.textContent))); await t.p.click('a[title="Edit route"] >> nth=' + idx); }
    else await t.p.click('.pfw-btnrow button:has-text("Add")');
    await t.p.waitForTimeout(600); await t.p.fill(t.fg('Destination network') + ' input[type=text]', '10.10.20.0'); await t.p.selectOption(t.fg('Destination network') + ' select', '24'); await t.setSel('Gateway', '10.10.0.2'); await t.save(); await t.apply();
  },
  async pf_ipsec_p1(t) {
    await t.menu('VPN', 'IPsec'); await t.p.click('a[title="Edit phase 1 entry"]'); await t.p.waitForTimeout(600);
    await t.setSel('Key Exchange version', 'ikev2'); await t.setText('Remote Gateway', '198.51.100.2'); await t.setText('Pre-Shared Key', 'Bx-Tls-2026!'); await t.setSel('Key length', 256); await t.setSel('DH Group', 14); await t.save(); await t.apply();
  },
  async pf_ipsec_p2(t) {
    await t.menu('VPN', 'IPsec'); await t.p.click('a[title="Edit phase 2 entry"]'); await t.p.waitForTimeout(600);
    await t.setChk('Disabled', false); await t.p.fill(t.fg('Local Network') + ' input[type=text]', '10.20.0.0'); await t.p.selectOption(t.fg('Local Network') + ' select', '16'); await t.setSel('PFS key group', 14); await t.save(); await t.apply();
  },
  async pf_ipsec_rules(t) {
    await t.menu('Firewall', 'Rules'); await tab(t, 'IPsec'); const txt = await body(t);
    if (/Bordeaux/.test(txt)) await t.p.click('a[title="Edit rule"]'); else await t.p.click('.pfw-btnrow button:has-text("Add") >> nth=1');
    await t.p.waitForTimeout(600); await t.setSel('Protocol', 'any'); await addr(t, 'Source', 'net', '10.20.0.0', 16); await addr(t, 'Destination', 'net', '10.10.0.0', 16); await t.setText('Description', 'IPsec Bordeaux vers Toulouse'); await t.save(); await t.apply();
  },
  async vpn_wanrule(t) {
    await t.menu('Firewall', 'Rules'); await tab(t, 'WAN'); const txt = await body(t);
    if (/OpenVPN accès/.test(txt)) await t.p.click('a[title="Edit rule"]'); else await t.p.click('.pfw-btnrow button:has-text("Add") >> nth=1');
    await t.p.waitForTimeout(600); await t.setSel('Protocol', 'udp'); await addr(t, 'Destination', 'ifaddr:wan'); await t.p.locator(t.fg('Destination Port Range') + ' input.form-control').nth(0).fill('1194'); await t.setText('Description', 'OpenVPN accès distant'); await t.save(); await t.apply();
  },
  async vpn_access(t) {
    await t.menu('Firewall', 'Rules'); await tab(t, 'OpenVPN'); const txt = await body(t);
    if (/OpenVPN → LAN/.test(txt)) await t.p.click('a[title="Edit rule"]'); else await t.p.click('.pfw-btnrow button:has-text("Add") >> nth=1');
    await t.p.waitForTimeout(600); await t.setSel('Protocol', 'any'); await addr(t, 'Source', 'net', '10.99.0.0', 24); await addr(t, 'Destination', 'host', 'LAN_NETS'); await t.setText('Description', 'OpenVPN vers LAN'); await t.save(); await t.apply();
  },
  async vpn_routes(t) {
    await t.menu('VPN', 'OpenVPN'); await t.p.click('a[title="Edit server"]'); await t.p.waitForTimeout(600); await t.setText('IPv4 Local Network(s)', '10.10.0.0/16'); await t.save();
  },
  async vpn_connect(t) {
    const st = await t.p.evaluate(() => SIM_APP.run.m.parts[0].cause || '');
    if (/expiré/.test(st)) { await t.menu('System', 'Cert. Manager'); await t.p.click('.pfw-tabs a:text-is("Certificates")'); await t.p.waitForTimeout(500); await t.p.click('a[title="Renew or Reissue"] >> nth=1'); await t.confirmOk(); }
    else if (/compte VPN/.test(st)) { await t.menu('System', 'User Manager'); await t.p.click('a[title="Edit user"]'); await t.p.waitForTimeout(500); await t.setChk('Disabled', false); await t.save(); }
    else console.log('variante côté client : non couverte par ce test', st);
  }
};
const CLIENT = { pf_ipsec_p1: ['PC-B1', 'https://10.20.0.1/'], pf_ipsec_p2: ['PC-B1', 'https://10.20.0.1/'] };
(async () => {
  const id = process.argv[2]; const seed = process.argv[3]; const c = CLIENT[id] || ['PC-ADM', 'https://10.10.0.1/'];
  const t = await L.start({ fault: id, dev: c[0], seed, user: c[0] === 'PC-ADM' ? 'TOULOUSE\\tssr' : undefined, pwd: 'Tssr-2026!' });
  console.log(id, 'seed', seed || '7', 'statut initial', await t.status());
  await t.open2(c[1]);
  await CASES[id](t);
  await t.p.waitForTimeout(400);
  console.log('banner:', (await t.banner()).slice(0, 120)); await t.shot('pf2_' + id);
  console.log('statut final', await t.status());
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
