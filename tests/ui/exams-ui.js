/* Fenêtre d'examen : série de tickets (pastilles), « Commencer », puis « Refaire le même » / « Ticket suivant ». */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href); await p.waitForFunction(() => window.SIM_APP);
  await p.evaluate(() => { window.SIM_NO_UNLOAD_PROMPT = 1; window.SIM_NO_EVENTS = 1; document.querySelectorAll('.overlay').forEach(o => o.remove()); const G = SIM.game; const pr = G.profile(); pr.tourDone = true; SIM.camp.pool(1).forEach(d => { pr.camp.ok[d.id] = 90; }); pr.camp.seen[1] = 1; G.saveProfile(pr); SIM_APP.home(); });
  await p.evaluate(() => SIM_APP.campExam(1)); await p.waitForSelector('.modal .exdots');
  ok(await p.locator('.modal .exdot').count() === 5, 'premier examen : 5 tickets numérotés');
  ok(await p.locator('.modal button', { hasText: 'Refaire le même' }).count() === 0, 'premier passage : pas de « Refaire le même »');
  await p.locator('.modal button', { hasText: 'Commencer l’examen' }).click(); await p.waitForFunction(() => SIM_APP.run && SIM_APP.run.m.camp && SIM_APP.run.m.camp.exam);
  const f1 = await p.evaluate(() => ({ k: SIM_APP.run.m.camp.examK, f: SIM_APP.run.m.fault.id }));
  ok(f1.k === 0, 'ticket d’examen n° 1 lancé (' + f1.f + ')');
  /* raté (abandon) puis retour : refaire le même / suivant */
  await p.evaluate(() => { SIM_APP.run.m._finish('abandoned', SIM_APP.run.m.status()); SIM_APP.run.finish(); }); await p.waitForTimeout(600); await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.remove()); SIM_APP.home(); });
  await p.evaluate(() => SIM_APP.campExam(1)); await p.waitForSelector('.modal .exdots');
  ok(await p.locator('.modal button', { hasText: 'Refaire le même (n° 1)' }).count() === 1 && await p.locator('.modal button', { hasText: 'Ticket suivant (n° 2)' }).count() === 1, 'après un essai : « Refaire le même (n° 1) » et « Ticket suivant (n° 2) »');
  await p.locator('.modal button', { hasText: 'Ticket suivant' }).click(); await p.waitForFunction(() => SIM_APP.run && SIM_APP.run.m.camp && SIM_APP.run.m.camp.examK === 1);
  const f2 = await p.evaluate(() => SIM_APP.run.m.fault.id); ok(f2 !== f1.f, 'ticket n° 2 : une autre panne (' + f2 + ')');
  await p.evaluate(() => SIM_APP.home()); await p.evaluate(() => SIM_APP.campExam(1)); await p.waitForSelector('.modal .exdots');
  await p.locator('.modal button', { hasText: 'Refaire le même' }).click(); await p.waitForFunction(() => SIM_APP.run && SIM_APP.run.m.camp && SIM_APP.run.m.camp.exam);
  ok(await p.evaluate(() => SIM_APP.run.m.fault.id) === f2, '« Refaire le même » : même panne que le ticket n° 2');
  ok(!errs.length, 'aucune erreur de page' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ exams-ui : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
