/* Défi entre élèves (même code = même incident pour deux profils différents) et panne mystère (un essai par jour). */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const url = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href; const errs = [];
  const open = async played => { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForFunction(() => window.SIM_APP);
    await p.evaluate(n => { window.SIM_NO_UNLOAD_PROMPT = 1; document.querySelectorAll('.overlay').forEach(o => o.remove()); const pr = SIM.game.profile(); pr.tourDone = true; SIM.faults.filter(f => f.level === 2).slice(0, n).forEach(f => { pr.done[f.id] = { count: 3, best: 90 }; }); SIM.game.saveProfile(pr); SIM_APP.home(); }, played); return p; };
  const duty = async p => { await p.locator('.cnavb[data-tab=duty]').click(); await p.waitForTimeout(200); };
  const p1 = await open(0), p2 = await open(25);
  await duty(p1); ok(await p1.locator('.chcard').count() === 2, 'onglet Astreinte : cartes « Panne mystère » et « Défi d’un collègue »');
  const play = async p => { await duty(p); await p.locator('.chin').fill('2L-defi42'); await p.locator('[data-act=challenge]').click(); await p.waitForTimeout(500); return p.evaluate(() => ({ f: SIM_APP.run.m.fault.id, v: JSON.stringify(SIM_APP.run.m.parts[0].vars || {}).length, now: SIM_APP.run.W.now().toISOString(), ev: SIM_APP.run.m.event ? SIM_APP.run.m.event.type : null, lv: SIM_APP.run.m.lv.level })); };
  const a = await play(p1), c = await play(p2);
  ok(a.f === c.f && a.now === c.now && a.ev === c.ev && a.lv === 2, 'même code, deux profils différents : même panne (' + a.f + '), même date, même événement');
  await p1.evaluate(() => SIM_APP.home()); await duty(p1); await p1.locator('.chin').fill('bidon'); await p1.locator('[data-act=challenge]').click(); ok(/non reconnu/.test(await p1.locator('.cherr').innerText()), 'code invalide refusé');
  /* résultat à partager */
  await play(p1); await p1.evaluate(() => { const r = SIM_APP.run, m = r.m; m.parts.forEach(x => SIM.fault.runSteps(r.W, x.fix || x.fixes[Object.keys(x.fixes)[0]], { inst: x })); r.W.touch('t'); m._finish('resolved', m.status()); r.finish(); }); await p1.waitForTimeout(500);
  await p1.evaluate(() => { const o = document.querySelector('.overlay'); if (o) { /* fiche : on la passe */ SIM_APP.run.m.fileReport({}); SIM_APP.run.finalize(); o.remove(); } }); await p1.waitForTimeout(600);
  const txt = await p1.evaluate(() => SIM.ui.challenge.resultText(SIM_APP.run.m)); ok(/code 2L-defi42/.test(txt) && /note : \d+\/100/.test(txt), 'résultat à partager : ' + txt.slice(0, 70));
  ok(await p1.locator('.dchal').count() === 1, 'débrief : bouton « Copier mon résultat »');
  /* panne mystère */
  await p1.evaluate(() => SIM_APP.home()); await duty(p1); await p1.locator('[data-act=mystery]').click(); await p1.locator('.modal button', { hasText: 'J’y vais' }).click(); await p1.waitForTimeout(500);
  ok(await p1.evaluate(() => SIM_APP.run.m.mystery === true) && !/Niveau (Junior|Confirmé|Admin)/.test(await p1.locator('.gbar').innerText()), 'panne mystère lancée, niveau caché');
  await p1.evaluate(() => SIM_APP.home()); await duty(p1); ok(await p1.locator('[data-act=mystery]').isDisabled(), 'un seul essai par jour : le bouton est grisé ensuite');
  ok(!errs.length, 'aucune erreur de page' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ challenge : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
