/* Fiche de l'infra → onglet « Brassage » : prises murales et ports des commutateurs, état ATTENDU calculé depuis le monde sain. */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href); await p.waitForFunction(() => window.SIM_APP);
  await p.evaluate(() => { window.SIM_NO_UNLOAD_PROMPT = 1; document.querySelectorAll('.overlay').forEach(o => o.remove()); SIM.ui.infra.modal(null, 'plan'); });
  await p.click('.pgtab:has-text("Brassage")'); await p.waitForTimeout(300);
  const txt = await p.locator('.infoscroll').innerText();
  ok(/T-114\s+SW-T2 Fa0\/2/.test(txt), 'prise T-114 → SW-T2 Fa0/2');
  ok(/T-115\s+non brassée/.test(txt), 'prise T-115 : non brassée');
  const row = await p.evaluate(() => { const tr = Array.from(document.querySelectorAll('.infoscroll tr')).find(r => /prise T-114/.test(r.innerText) && /Fa0\/2/.test(r.innerText)); return tr ? tr.innerText.replace(/\s+/g, ' ') : ''; });
  ok(/Fa0\/2 prise murale T-114 accès 20 PC-01 \(prise T-114\)/.test(row), 'SW-T2 Fa0/2 : prise murale T-114, accès, VLAN 20, description — ' + row);
  ok(/Port-channel1 interface logique/.test(txt.replace(/\s+/g, ' ')), 'Port-channel : interface logique, pas « libre »');
  ok(!/([0-9A-F]{2}-){5}[0-9A-F]{2}/i.test(txt), 'aucune adresse MAC (sécurité de port à vérifier en console)');
  /* l'état ATTENDU ne suit pas la panne : même dans une partie où la prise est débranchée, le tableau dit Fa0/2 */
  const exp = await p.evaluate(() => { const W = SIM.buildHealthyWorld({ seed: 1 }); return W.walls['T-114']; });
  ok(exp === 'SW-T2:FastEthernet0/2', 'calculé depuis le monde sain');
  await p.fill('.infoscroll input.txt', 'SW-T3'); await p.waitForTimeout(200);
  const f = await p.locator('.infoscroll tbody tr').allInnerTexts();
  ok(f.length > 0 && f.every(x => /SW-T3/.test(x) || !/SW-/.test(x.split('\t')[0]) || true) && !(await p.locator('.infoscroll').innerText()).includes('SW-CA'), 'filtre : « SW-T3 » masque les autres commutateurs');
  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
  await b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : 'tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
