/* Événements en cours de partie, dans l'interface : panneau Messages, téléphone (QCM), deuxième ticket obligatoire, échéance du responsable. */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href;
  await p.goto(url); await p.waitForFunction(() => window.SIM_APP); await p.evaluate(() => { window.SIM_NO_UNLOAD_PROMPT = 1; document.querySelectorAll('.overlay').forEach(o => o.remove()); });
  const start = async (type, seed) => { await p.evaluate(o => SIM_APP.begin(o), { level: 1, mode: 'free', seed, faultId: 'dns_cache', eventType: type }); await p.waitForTimeout(300); };
  const due = async () => { await p.evaluate(() => { const m = SIM_APP.run.m; m.startMs -= (m.event.at + 2) * 1000; }); await p.waitForTimeout(900); };
  const fixMain = () => p.evaluate(() => { const r = SIM_APP.run, m = r.m; SIM.fault.runSteps(r.W, m.parts[0].fix, { inst: m.parts[0] }); r.W.touch('t'); r.W.observe('share:PC-01:x', true); r.check(); return m.state; });
  /* panneau présent même sans événement */
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: 'none', faultId: 'dns_cache', events: false })); await p.waitForTimeout(300);
  ok(/Aucun message/.test(await p.locator('.side .msgs').innerText()), 'panneau « Messages » présent, vide sans événement');
  /* deuxième ticket */
  await start('second', 'u1'); ok(await p.evaluate(() => !!SIM_APP.run.m.event), 'événement prévu'); await due();
  const t2 = await p.locator('.side .msgs').innerText(); ok(/À régler pour clôturer/.test(t2) && await p.evaluate(() => SIM_APP.run.m.parts.length === 2), 'deuxième ticket : affiché dans Messages, ajouté au ticket');
  ok(await fixMain() === 'running', 'ticket d’origine réparé : la partie continue (la panne ajoutée est obligatoire)');
  /* téléphone : mauvaise puis bonne consigne */
  await start('call_quiz', 'u2'); await due(); ok(await p.locator('.modal .evopt').count() >= 3, 'téléphone : QCM affiché');
  const wrong = await p.evaluate(() => { const e = SIM_APP.run.m.event; return e.quiz.options.find(o => o.id !== e.quiz.answer).id; });
  await p.locator('.modal .evopt[data-opt=' + wrong + ']').click(); await p.waitForTimeout(200); ok(/s’ajoute à ton ticket/.test(await p.locator('.modal').innerText()) && await p.evaluate(() => SIM_APP.run.m.parts.length === 2), 'mauvaise consigne : la panne s’ajoute');
  await p.locator('.modal .evclose').click(); await p.waitForTimeout(150); ok(await p.locator('.overlay').count() === 0, 'on raccroche');
  await start('call_quiz', 'u2'); await due(); const good = await p.evaluate(() => SIM_APP.run.m.event.quiz.answer); await p.locator('.modal .evopt[data-opt=' + good + ']').click(); await p.waitForTimeout(200);
  ok(/réglé au téléphone/i.test(await p.locator('.modal').innerText()) && await p.evaluate(() => SIM_APP.run.m.parts.length === 1), 'bonne consigne : réglé au téléphone'); await p.locator('.modal .evclose').click(); await p.waitForTimeout(150);
  ok(await fixMain() !== 'running', 'le ticket se clôture ensuite normalement'); await p.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));
  /* rappel du demandeur */
  await start('call_extra', 'u3'); if (await p.evaluate(() => !!SIM_APP.run.m.event)) { await due(); ok(/Le téléphone sonne/.test(await p.locator('.modal').innerText()), 'rappel du demandeur : fenêtre du téléphone'); await p.locator('.modal button', { hasText: 'Je m’en occupe' }).click(); }
  /* collègue */
  await start('colleague', 'u4'); await due(); ok(/Sacha/.test(await p.locator('.side .msgs').innerText()), 'collègue : message qui nomme l’équipement');
  /* responsable */
  await start('boss', 'u5'); await due(); ok(/Échéance/.test(await p.locator('.side .msgs').innerText()) && /min/.test(await p.locator('.msgcd').innerText()), 'responsable : compte à rebours affiché');
  ok(!errs.length, 'aucune erreur de page' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ events : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
