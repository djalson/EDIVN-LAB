/* Accueil + tutoriel : proposé à la première partie, parcours complet, rejouable, non bloquant. */
const { chromium } = require('playwright');
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/home_new.png' });
  chk('bannière tutoriel à la première visite', !!(await p.$('.htuto')));
  chk('5 niveaux et 3 modes', (await p.$$('.hlv')).length === 5 && (await p.$$('.hmd')).length === 3);
  const b0 = await p.innerText('.hbubble'); await p.click('.hcat'); await p.click('.hcat');
  chk('mascotte : le conseil change au clic', (await p.innerText('.hbubble')) !== b0);
  await p.click('.hcatg >> nth=0'); chk('chat caché (dans le décor) : trouvé et persisté', (await p.$$('.hcatg.found')).length === 1 && await p.evaluate(() => (SIM.game.store.get('cats') || []).length === 1));
  chk('titres de niveau colorés (--c appliqué)', (await p.$$eval('.hlv', e => new Set(e.map(x => getComputedStyle(x).borderTopColor)).size)) === 5);
  chk('mode guidé présélectionné', (await p.$$eval('.hmd.on b', e => e.map(x => x.textContent))).join() === 'Guidé');
  await p.click('.hlv:nth-child(3)'); chk('sélection niveau met à jour le récap', (await p.innerText('.hsum')).includes('Admin'));
  await p.click('.hgo'); await p.waitForTimeout(200);
  chk('proposition du tutoriel au premier lancement', (await p.innerText('.modal')).includes('Première partie'));
  await p.screenshot({ path: '/tmp/home_prop.png' });
  await p.click('.modal button:has-text("Lancer le tutoriel")'); await p.waitForTimeout(1200);
  chk('partie de tutoriel démarrée', await p.evaluate(() => SIM_APP.run && SIM_APP.run.m.fault.id === 'phys_eth'));
  chk('carte du tutoriel visible', !!(await p.$('.tcard')));
  let n = 0; let shots = 0;
  for (let guard = 0; guard < 30; guard++) {
    const kick = await p.innerText('.tcard .tkick').catch(() => ''); if (!kick) break;
    const num = +kick.match(/(\d+) \//)[1];
    if (shots < 14) await p.screenshot({ path: '/tmp/tour' + String(num).padStart(2, '0') + '.png' }); shots++;
    const title = await p.innerText('.tcard h3');
    if (title === 'Choisis une machine') { const host = await p.evaluate(() => ((SIM_APP.run.m.parts[0].vars || {}).c || {}).host); await p.click('.node[title="' + host + '"]'); await p.waitForTimeout(700); n++; continue; }
    if (title === 'Écran ou poste physique') { await p.click('.pop .btn >> nth=0'); await p.waitForTimeout(1200); n++; continue; }
    if (await p.$('.tcard .tnext')) { const txt = await p.innerText('.tcard .tnext'); if (/Jouer/.test(txt)) { await p.click('.tcard .tnext'); break; } await p.click('.tcard .tnext'); await p.waitForTimeout(450); n++; } else break;
  }
  chk('parcours complet jusqu\'à la fin', !(await p.$('.tcard')) && n >= 12);
  chk('tutoriel marqué comme fait', await p.evaluate(() => !!SIM.game.profile().tourDone));
  chk('on reste dans la partie après le tutoriel', await p.evaluate(() => !!SIM_APP.run));
  await p.screenshot({ path: '/tmp/tour_end.png' });
  await p.click('button:has-text("Abandonner")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("Abandonner")'); await p.waitForTimeout(1200);
  await p.evaluate(() => SIM_APP.home()); await p.waitForTimeout(300);
  chk('plus de bannière après le tutoriel', !(await p.$('.htuto')));
  await p.click('button:has-text("Revoir le tutoriel")'); await p.waitForTimeout(1000);
  chk('tutoriel rejouable', !!(await p.$('.tcard')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); chk('Échap ferme le tutoriel', !(await p.$('.tcard')));
  console.log(errs.join('\n') || 'no errors'); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
