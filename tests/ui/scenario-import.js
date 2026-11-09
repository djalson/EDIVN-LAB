/* Import formateur : JSON invalide refusé avec raisons, variante valide importée, jouable, persistante. */
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP);
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  const base = await p.evaluate(() => JSON.parse(JSON.stringify(SIM.faults.find(d => d.id === 'dhcp_scope_off'))));
  const good = Object.assign({}, base, { id: 'dhcp_scope_off_rh', title: 'Étendue DHCP désactivée (variante RH)' });
  const bad = Object.assign({}, base, { id: 'dhcp_sans_symptome', inject: [] });
  fs.writeFileSync(require('os').tmpdir() + '/sc_good.json', JSON.stringify(good)); fs.writeFileSync(require('os').tmpdir() + '/sc_bad.json', JSON.stringify(bad));
  await p.click('button:has-text("Scénarios formateur")'); await p.waitForTimeout(200);
  await p.setInputFiles('.modal input[type=file]', require('os').tmpdir() + '/sc_bad.json'); await p.waitForTimeout(1500);
  chk('invalide refusé', (await p.innerText('.modal')).includes('Scénario refusé') && (await p.innerText('.modal')).includes('aucun symptôme'));
  await p.setInputFiles('.modal input[type=file]', require('os').tmpdir() + '/sc_good.json'); await p.waitForTimeout(1500);
  chk('valide importé', (await p.innerText('.modal')).includes('importé'));
  await p.screenshot({ path: require('os').tmpdir() + '/imp1.png' });
  await p.click('.modal button:has-text("Fermer")'); await p.waitForTimeout(300);
  chk('dans la liste des pannes', await p.evaluate(() => !!SIM.faults.find(d => d.id === 'dhcp_scope_off_rh')));
  await p.reload(); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300);
  chk('persistant après rechargement', await p.evaluate(() => !!SIM.faults.find(d => d.id === 'dhcp_scope_off_rh')));
  await p.evaluate(() => SIM_APP.begin({ level: 2, mode: 'free', seed: '5', faultId: 'dhcp_scope_off_rh' })); await p.waitForTimeout(500);
  chk('jouable', await p.evaluate(() => SIM_APP.run.m.fault.id === 'dhcp_scope_off_rh'));
  console.log(errs.join('\n') || 'no errors'); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
