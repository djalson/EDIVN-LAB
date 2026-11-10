/* Balayage par l'interface des pannes proxy (Squid, squidGuard, résolveur DNS, règles, Options Internet du poste) :
   chaque panne et chaque variante est réparée par des clics et des saisies dans l'interface web de pfSense (ou dans les
   Options Internet de PC-02), puis constatée réparée par le moteur. C'est la preuve de réparabilité qui manquait (D-108).
   Usage : node tests/ui/proxy-sweep.js [préfixe…]   — sort en erreur si une variante n'est pas réparée ou si une erreur JS apparaît. */
const PF = require('./pflib');
const only = process.argv.slice(2);
const IDS = ['px_down', 'px_pkg_broken', 'px_iface', 'px_client_port', 'px_client_bypass', 'px_blacklist_regex', 'px_blacklist_overblock', 'px_whitelist', 'px_sg_off', 'px_sg_category', 'px_safesearch', 'px_dns_upstream', 'px_log_off', 'px_trans_off', 'px_quic', 'px_trans_multi', 'px_cascade'];
const { chromium } = require('playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy';

/* une graine par variante distincte (signature de l'injection) */
async function plan() {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(URL); await p.waitForFunction(() => window.SIM_APP);
  const out = await p.evaluate(ids => { const res = []; ids.forEach(id => { const def = SIM.faults.find(d => d.id === id); const seen = new Set(); for (let s = 1; s <= 80; s++) { const inst = SIM.fault.instantiate(def, String(s)); const sig = JSON.stringify(inst.inject); if (seen.has(sig)) continue; seen.add(sig); res.push({ id, seed: String(s), want: SIM.fault.variantCombos(def, 24).length }); } }); return res; }, IDS);
  await b.close(); return out;
}
const multi = async (t, label, values) => { await t.p.selectOption(t.fg(label) + ' select', values); };
const tab = async (t, name) => { await t.p.click('.pfw-tabs a:text-is("' + name + '")'); await t.p.waitForTimeout(450); };
const area = async (t, label, lines) => { await t.p.fill(t.fg(label) + ' textarea', lines.join('\n')); };
const state = (t, path) => t.p.evaluate(pa => { let o = SIM_APP.run.W.dev; for (const k of pa.split('.')) { if (o == null) return undefined; o = o[k]; } return o; }, path);
const sgApply = async t => { await tab(t, 'General settings'); await t.p.click('.pfw-main button:text-is("Apply")'); await t.p.waitForTimeout(700); };

/* gestes par étape de correction (chemin du modèle → clics) */
const squidGeneral = async (t, fn) => { await t.menu('Services', 'Squid Proxy Server'); await fn(); await t.save(); };
const R = {
  async 'pfsense-tls.squid.stopped'(t, inst) {
    if ((await state(t, 'pfsense-tls.squid.enabled')) === false) return squidGeneral(t, () => t.setChk('Enable Squid Proxy', true));
    await t.menu('Status', 'Services'); await t.p.click('tr:has(td:text-is("squid")) a[title="Start Service"], tr:has(td:text-is("squid")) a[title="Restart Service"]'); await t.p.waitForTimeout(700);
  },
  async 'pfsense-tls.squid.enabled'() { /* traité avec squid.stopped */ },
  async 'pfsense-tls.packages'(t, inst, step) {
    const name = /name=([A-Za-z]+)/.exec(step.path)[1];
    await t.menu('System', 'Package Manager'); await t.p.click('tr:has-text("pfSense-pkg-' + name + '") a[title="Reinstall Package"]'); await t.p.waitForTimeout(600);
    const c = await t.p.$('.pfw-main button:has-text("Confirm")'); if (c) { await c.click(); }
    await t.p.waitForFunction(() => /Success/i.test(document.querySelector('.pfw-main').innerText), null, { timeout: 20000 }); await t.p.waitForTimeout(400);
  },
  async 'pfsense-tls.squid.ifaces'(t) { await squidGeneral(t, () => multi(t, 'Proxy Interface(s)', ['lan'])); },
  async 'pfsense-tls.squid.acl.blacklist'(t, inst, step) { await t.menu('Services', 'Squid Proxy Server'); await tab(t, 'ACLs'); await area(t, 'Blacklist', step.value); await t.save(); },
  async 'pfsense-tls.squid.acl.whitelist'(t, inst, step) { await t.menu('Services', 'Squid Proxy Server'); await tab(t, 'ACLs'); await area(t, 'Whitelist', step.value); await t.save(); },
  async 'pfsense-tls.squid.acl.allowedSubnets'(t, inst, step) { await t.menu('Services', 'Squid Proxy Server'); await tab(t, 'ACLs'); await area(t, 'Allowed Subnets', step.value); await t.save(); },
  async 'pfsense-tls.squidguard.stopped'(t) {
    if (!(await state(t, 'pfsense-tls.squidguard.enabled'))) { await t.menu('Services', 'SquidGuard Proxy Filter'); await t.setChk('Enable', true); await t.save(); await sgApply(t); return; }
    await t.menu('Status', 'Services'); await t.p.click('tr:has(td:text-is("squidGuard")) a[title="Start Service"], tr:has(td:text-is("squidGuard")) a[title="Restart Service"]'); await t.p.waitForTimeout(700);
  },
  async 'pfsense-tls.squidguard.enabled'() { /* traité avec squidguard.stopped */ },
  async 'pfsense-tls.squidguard.acl.cats'(t, inst, step) {
    await t.menu('Services', 'SquidGuard Proxy Filter'); await tab(t, 'Common ACL'); await t.p.click('.pfw-main button:text-is("+")'); await t.p.waitForTimeout(250);
    for (const cat of Object.keys(step.value)) await t.p.selectOption('.pfw-main tr:has-text("[blk_blacklists_' + cat + ']") select', step.value[cat]);
    await t.save(); await sgApply(t);
  },
  async 'pfsense-tls.squidguard.acl.default'(t, inst, step) {
    await t.menu('Services', 'SquidGuard Proxy Filter'); await tab(t, 'Common ACL'); await t.p.click('.pfw-main button:text-is("+")'); await t.p.waitForTimeout(250);
    const sels = await t.p.$$('.pfw-main table select'); await sels[sels.length - 1].selectOption(step.value); await t.save(); await sgApply(t);
  },
  async 'pfsense-tls.squidguard.log'(t) { await t.menu('Services', 'SquidGuard Proxy Filter'); await t.setChk('Enable log', true); await t.save(); await sgApply(t); },
  async 'pfsense-tls.squid.log.access'(t) { await squidGeneral(t, () => t.setChk('Enable Access Logging', true)); },
  async 'pfsense-tls.squid.transparent'(t) { await squidGeneral(t, async () => { await t.setChk('Transparent HTTP Proxy', true); await multi(t, 'Transparent Proxy Interface(s)', ['lan']); }); },
  async 'pfsense-tls.squid.transIfaces'() { /* traité avec squid.transparent */ },
  async 'pfsense-tls.squid.ssl'(t, inst, step) { await squidGeneral(t, async () => { await t.setChk('HTTPS/SSL Interception', true); await t.setSel('SSL/MITM Mode', step.value.mode); await multi(t, 'SSL Intercept Interface(s)', step.value.ifaces); await t.setSel('CA', step.value.ca); }); },
  async 'pfsense-tls.dns.servers'(t, inst, step) { await t.menu('System', 'General Setup'); for (let i = 1; i <= 4; i++) await t.setText('DNS Server ' + i, step.value[i - 1] || ''); await t.save(); },
  async 'pfsense-tls.dns.unbound.enabled'(t) { await t.menu('Services', 'DNS Resolver'); if (!(await t.p.isChecked(t.fg('Enable') + ' input[type=checkbox]'))) { await t.setChk('Enable', true); await t.p.click('.pfw-main button.btn-primary:text-is("Save")'); await t.p.waitForTimeout(600); if (await t.p.$('.pfw-alert button:has-text("Apply Changes")')) await t.apply(); } },
  async 'pfsense-tls.dns.unbound.hostOverrides'(t, inst, step) {
    const want = step.value[0]; await t.menu('Services', 'DNS Resolver');
    const cur = (await state(t, 'pfsense-tls.dns.unbound.hostOverrides')) || []; const ho = cur.find(x => x.host === want.host && x.domain === want.domain);
    if (ho && ho.ip === want.ip && (ho.aliases || []).length === want.aliases.length) return;
    if (ho) await t.p.click('a[title="Edit host override"]'); else await t.p.click('.pfw-panel:has-text("Host Overrides") button:has-text("Add"), .pfw-main button.btn-success:has-text("Add")');
    await t.p.waitForTimeout(500);
    await t.setText('Host', want.host); await t.setText('Domain', want.domain); await t.setText('IP Address', want.ip); await t.setText('Description', want.descr);
    if (!ho || !(ho.aliases || []).length) { await t.p.click(t.fg('Host Name') + ' button:has-text("Add Host Name")'); await t.p.waitForTimeout(250); const ins = await t.p.$$(t.fg('Host Name') + ' input'); await ins[0].fill(want.aliases[0].host); await ins[1].fill(want.aliases[0].domain); }
    await t.save(); if (await t.p.$('.pfw-alert button:has-text("Apply Changes")')) await t.apply();
  },
  async 'pfsense-tls.rules.lan'(t) {
    await t.menu('Firewall', 'Rules'); await tab(t, 'LAN'); await t.p.click('.pfw-btnrow button:has-text("Add") >> nth=0'); await t.p.waitForTimeout(600);
    await t.setSel('Action', 'reject'); await t.setSel('Protocol', 'udp'); await t.p.selectOption(t.fg('Destination Port Range') + ' select >> nth=0', '443');
    await t.setText('Description', 'Bloquer QUIC (UDP 443)'); await t.save(); await t.apply();
  }
};
/* poste : Panneau de configuration → Réseau et Internet → Options Internet → Paramètres réseau */
async function inetcpl(t) { await t.open('control'); await t.p.waitForTimeout(400); await t.p.click('.explorer :text("Réseau et Internet")'); await t.p.waitForTimeout(300); await t.p.click('.explorer :text("Options Internet")'); await t.p.waitForTimeout(400); await t.p.click('.propsheet button:text-is("Paramètres réseau")'); await t.p.waitForTimeout(350); }
const C = {
  async px_client_port(t, inst) { await inetcpl(t); const ins = await t.p.$$('.win:has(.mbbtns) input.w10in'); const want = {}; inst.fix.forEach(s => { want[s.path.split('.').pop()] = String(s.value); });
    for (const i of ins) { const v = await i.inputValue(); if (/^\d+\.\d+\.\d+\.\d+$/.test(v) || v === '') { /* adresse */ } }
    const vals = await Promise.all(ins.map(i => i.inputValue())); const ai = vals.findIndex(v => /\./.test(v)), pi = vals.findIndex((v, k) => k !== ai && /^\d+$/.test(v));
    await ins[ai].fill(want.server); await ins[pi].fill(want.port); await okAll(t); },
  async px_client_bypass(t, inst) { await inetcpl(t); await t.p.click('button:text-is("Avancé")'); await t.p.waitForTimeout(350); await t.p.fill('textarea.w10in', inst.fix[0].value.join(';')); await okAll(t); }
};
async function okAll(t) { for (let i = 0; i < 4; i++) { const btns = await t.p.$$('.win .mbbtns button:text-is("OK"), .propsheet button:text-is("OK")'); if (!btns.length) break; await btns[btns.length - 1].click(); await t.p.waitForTimeout(350); } }

(async () => {
  const all = (await plan()).filter(x => !only.length || only.some(o => x.id.startsWith(o)));
  const fails = []; let done = 0; const per = {};
  for (const it of all) {
    const client = !!C[it.id]; let t;
    try {
      t = await PF.start({ fault: it.id, seed: it.seed, level: 1, dev: client ? 'PC-02' : 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
      const inst = await t.p.evaluate(() => { const x = SIM_APP.run.m.parts[0]; return { fix: x.fix, inject: x.inject }; });
      const before = (await t.status()).join();
      if (client) await C[it.id](t, inst);
      else { await t.open2('https://10.10.0.1/'); for (const step of inst.fix) { const key = Object.keys(R).find(k => step.path === k || step.path.indexOf(k + '[') === 0); if (!key) throw new Error('aucun geste pour ' + step.path); await R[key](t, inst, step); } }
      await t.p.waitForTimeout(1200); await t.p.evaluate(() => SIM_APP.run.check());
      const after = (await t.status()).join(); const good = /^active$/.test(before) && /^(fixed|resolved)$/.test(after) && !t.errs.length;
      console.log((good ? '✓ ' : '✗ ') + it.id + ' graine ' + it.seed + ' : ' + before + ' → ' + after + (t.errs.length ? ' ' + t.errs.join(' ; ') : '') + '   [' + inst.inject.map(s => s.path.split('.').slice(-2).join('.') + '=' + JSON.stringify(s.value === undefined ? s.item : s.value)).join(' ; ').slice(0, 110) + ']');
      if (!good) fails.push(it.id + '#' + it.seed); else per[it.id] = (per[it.id] || 0) + 1;
    } catch (e) { console.log('✗ ' + it.id + ' graine ' + it.seed + ' : ' + String(e.message).split('\n')[0]); fails.push(it.id + '#' + it.seed); }
    if (t) await t.b.close(); done++;
  }
  const short = all.filter(x => (per[x.id] || 0) < x.want).map(x => x.id).filter((v, i, a) => a.indexOf(v) === i);
  console.log(done + ' variantes jouées, ' + (done - fails.length) + ' réparées par l’interface, ' + fails.length + ' à reprendre' + (fails.length ? ' : ' + fails.join(', ') : '') + (short.length && !fails.length ? ' ; variantes non atteintes par les graines : ' + short.join(', ') : ''));
  process.exit(fails.length || (short.length && !only.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
