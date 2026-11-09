/* Campagne par l'interface : accueil à trois entrées, chantier, carte limitée au périmètre, critère de clôture, fiche d'intervention,
   débrief, examen, déblocage du chapitre 2, remise à zéro des profils antérieurs, mode d'origine (#legacy). */
const { chromium } = require('playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href;
const SHOTS = process.env.SHOTS || '';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  const shot = async n => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + n + '.png' }); };
  /* un profil d'avant la campagne est remis à zéro au premier lancement */
  await p.addInitScript(() => { if (!localStorage.getItem('edivn.seeded')) { localStorage.setItem('edivn.seeded', '1'); localStorage.setItem('edivn.profile', JSON.stringify({ v: 2, pv: 1, name: 'Ancien', xp: 5000, history: [{ at: 1, seed: 's', level: 2, mode: 'free', id: 'dns_svc', kind: 'resolved', total: 90, mttr: 40, stars: 2 }] })); } });
  await p.goto(URL); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300);
  chk('profil antérieur remis à zéro', await p.evaluate(() => { const q = SIM.game.profile(); return q.xp === 0 && q.history.length === 0 && SIM.game.store.get('gen') === 3; }));
  chk('trois entrées, Campagne ouverte par défaut', (await p.$$('.cnavb')).length === 3 && (await p.innerText('.cnavb.on b')).toUpperCase() === 'CAMPAGNE');
  chk('carte du chapitre 1', /Le bureau/.test(await p.innerText('.ccard .ctitle')) && /0 \/ 5/.test(await p.innerText('.ccard .cprogt')));
  chk('11 chapitres au parcours, 10 verrouillés', (await p.$$('.cnode')).length === 11 && (await p.$$('.cnode.lock')).length === 10);
  chk('examen fermé tant que les tickets ne sont pas validés', await p.$eval('.ccard [data-act=exam]', e => e.disabled));
  await shot('01-accueil');
  /* bac à sable et astreinte restent accessibles */
  await p.click('.cnavb[data-tab=sandbox]'); chk('bac à sable : 5 niveaux, 3 modes, bouton de lancement', (await p.$$('.hlv')).length === 5 && (await p.$$('.hmd')).length === 3 && !!(await p.$('.hgo')));
  await shot('02-bac-a-sable');
  await p.click('.cnavb[data-tab=duty]'); chk('astreinte : ticket du jour et 3 incidents', !!(await p.$('.pdaily')) && (await p.$$('.cdutyb')).length === 3);
  await shot('03-astreinte');
  await p.click('.cnavb[data-tab=camp]');
  /* premier ticket : chantier d'abord */
  await p.click('.ccard [data-act=ticket]'); await p.waitForSelector('.chmodal');
  chk('chantier du chapitre 1 : 7 équipements', (await p.$$('.chmodal .chdev')).length === 7 && /Le bureau/.test(await p.innerText('.chmodal h2')));
  await shot('04-chantier');
  await p.click('.chmodal .btn.primary'); await p.waitForFunction(() => SIM_APP.run && SIM_APP.run.m); await p.waitForTimeout(500);
  chk('mission de campagne, mode accompagné', await p.evaluate(() => SIM_APP.run.m.camp.ch === 1 && SIM_APP.run.m.mode.id === 'guided'));
  chk('carte : seuls les équipements du périmètre', (await p.$$('.map .node')).length === 7 && !(await p.$('.node[title="SRV-DC1"]')) && !(await p.$('.node[title="pfsense-tls"]')));
  chk('un seul onglet de site', (await p.$$eval('.tabs .tab', e => e.map(x => x.textContent.trim()))).join() === 'Toulouse');
  chk('rappel du périmètre sur la carte', /périmètre/.test(await p.innerText('.mapscope')));
  chk('critère de clôture affiché dans le ticket', /Pour clôturer/.test(await p.innerText('.ticket .verif')));
  chk('pastille de chapitre', /Chapitre 1/.test(await p.innerText('.campill')));
  await shot('05-carte-chapitre-1');
  /* fiche de l'infra limitée au périmètre */
  await p.click('.gbar button:has-text("Identifiants")'); await p.waitForSelector('.infotbl');
  chk('identifiants : pas de pfSense ni de Cisco au chapitre 1', await p.$eval('.infotbl', e => !/pfSense|Cisco|Debian|bordeaux/i.test(e.textContent) && /toulouse/i.test(e.textContent)));
  await p.click('.pgtab:has-text("Plan")'); await p.waitForTimeout(200);
  chk('plan d’adressage : équipements du périmètre seulement', await p.$eval('.infoscroll', e => /PC-01/.test(e.textContent) && !/SRV-DC1|pfsense|R-LB1/.test(e.textContent)));
  await p.click('.modal .actions .btn'); await p.waitForTimeout(100);
  /* résolution par le moteur, fiche d'intervention */
  const solve = () => p.evaluate(() => { const run = SIM_APP.run, m = run.m, F = SIM.fault;
    m.parts.forEach(pt => { F.runSteps(m.W, pt.fix || pt.fixes[Object.keys(pt.fixes)[0]], { inst: pt }); run.act('x', 'correction', { mutates: true }); });
    m.parts.forEach(pt => { const pats = (pt.verify && pt.verify.length) ? pt.verify : F.defaultVerify(pt); m.W.observe(pats[0].replace(/\*/g, 'test'), true); }); run.check(); });
  const fiche = async good => {
    await p.waitForSelector('.fmodal'); const spec = await p.evaluate(() => SIM_APP.run.m.reportSpec().questions.map(q => ({ id: q.id, answer: q.answer, wrong: q.options.find(o => o.id !== q.answer).id })));
    for (const q of spec) await p.click('.fq[data-q="' + q.id + '"] .fopt[data-o="' + (good ? q.answer : q.wrong) + '"]');
    return spec;
  };
  await solve(); await p.waitForSelector('.fmodal');
  chk('fiche d’intervention ouverte, deux questions, bouton désactivé', (await p.$$('.fmodal .fq')).length === 2 && await p.$eval('.fmodal .actions .btn', e => e.disabled));
  chk('5 propositions par question (dont « Je ne sais pas »)', (await p.$$('.fmodal .fq[data-q=cause0] .fopt')).length === 5);
  chk('ticket pas encore enregistré tant que la fiche est ouverte', await p.evaluate(() => SIM.game.profile().history.length === 0));
  chk('la bonne réponse n’est pas marquée dans la page', await p.$eval('.fmodal', e => !/good|answer/.test(e.innerHTML)));
  await shot('06-fiche');
  await fiche(true); chk('bouton actif une fois la fiche complète', !(await p.$eval('.fmodal .actions .btn', e => e.disabled)));
  await p.click('.fmodal .actions .btn'); await p.waitForSelector('.dcamp');
  chk('débrief : bloc campagne 1 / 5', /1 \/ 5/.test(await p.innerText('.dcamp')));
  chk('débrief : fiche juste', (await p.$$('.dfiche .tag.ok')).length === 2 && /comprise/.test(await p.innerText('.dfiche')));
  chk('ticket enregistré avec la fiche', await p.evaluate(() => { const q = SIM.game.profile(); return q.history.length === 1 && Object.keys(q.camp.ok).length === 1; }));
  await shot('07-debrief');
  /* ticket suivant en autonome, fiche fausse → pénalité et révision */
  await p.evaluate(() => SIM_APP.setCampMode('free'));
  await p.click('[data-act=next]'); await p.waitForFunction(() => SIM_APP.run && !SIM_APP.run.ended); await p.waitForTimeout(300);
  chk('mode autonome appliqué', await p.evaluate(() => SIM_APP.run.m.mode.id === 'free'));
  await solve(); await fiche(false); await p.click('.fmodal .actions .btn'); await p.waitForSelector('.dfiche');
  chk('fiche fausse : −15, ticket toujours validé', await p.evaluate(() => { const r = SIM_APP.run.m.result; return r.score.report === -15 && r.note === 85 && r.passed; }));
  chk('débrief : réponses attendues affichées, ligne au barème', (await p.$$('.dfiche .tag.bad')).length === 2 && /Réponse attendue/.test(await p.innerText('.dfiche')) && /Fiche d’intervention \(cause/.test(await p.innerText('.screen')));
  chk('panne mise en révision', await p.evaluate(() => SIM.game.profile().camp.review.length === 1));
  await shot('08-debrief-fiche-fausse');
  /* jusqu'à l'examen */
  for (let i = 0; i < 12; i++) { if (await p.$('[data-act=exam]')) break; await p.click('[data-act=next]'); await p.waitForFunction(() => SIM_APP.run && !SIM_APP.run.ended); await p.waitForTimeout(200); await solve(); await fiche(true); await p.click('.fmodal .actions .btn'); await p.waitForSelector('.dcamp'); }
  chk('examen proposé au débrief après 5 tickets validés', !!(await p.$('[data-act=exam]')) && /examen du chapitre est ouvert/i.test(await p.innerText('.dcamp')));
  await p.click('[data-act=exam]'); await p.waitForSelector('.modal'); chk('annonce de l’examen', /Chronométré/.test(await p.innerText('.modal')));
  await p.click('.modal .btn.primary'); await p.waitForFunction(() => SIM_APP.run && !SIM_APP.run.ended && SIM_APP.run.m.camp.exam, null, { timeout: 20000 }); await p.waitForTimeout(300);
  const nparts = await p.evaluate(() => SIM_APP.run.m.parts.length);
  chk('examen : chronométré, indices coupés, ' + nparts + ' panne(s)', await p.evaluate(() => SIM_APP.run.m.mode.id === 'timed') && nparts >= 1 && nparts <= 2 && await p.$eval('.gbar button:has-text("Indice")', e => e.disabled));
  await solve(); await p.waitForSelector('.fmodal'); chk('fiche d’examen : ' + (nparts > 1 ? 'une question de cause par panne' : 'cause et correction'), (await p.$$('.fmodal .fq')).length === 2);
  await fiche(true); await p.click('.fmodal .actions .btn'); await p.waitForSelector('.dcamp');
  chk('chapitre 2 débloqué', /Chapitre 2 débloqué/.test(await p.innerText('.dcamp')) && await p.evaluate(() => SIM.camp.unlocked(SIM.game.profile()) === 2));
  await shot('09-chapitre-debloque');
  await p.click('[data-act=next]'); await p.waitForSelector('.chmodal'); chk('chantier du chapitre 2', /premier serveur/i.test(await p.innerText('.chmodal h2')) && (await p.$$('.chmodal .chdev')).length === 2);
  await p.click('.chmodal .btn.primary'); await p.waitForFunction(() => SIM_APP.run && !SIM_APP.run.ended); await p.waitForTimeout(400);
  chk('carte du chapitre 2 : le serveur et le cœur de réseau apparaissent', (await p.$$('.map .node')).length === 9 && !!(await p.$('.node[title="SRV-DC1"]')) && !!(await p.$('.node[title="SW-T1"]')));
  await shot('10-carte-chapitre-2');
  await p.evaluate(() => SIM_APP.home()); await p.waitForTimeout(300);
  chk('accueil : chapitre 1 terminé, chapitre 2 en cours', (await p.$$('.cnode.done')).length === 1 && /premier serveur/i.test(await p.innerText('.ccard .ctitle')));
  await shot('11-accueil-chapitre-2');
  /* abandon : pas de fiche */
  await p.click('.ccard [data-act=ticket]'); await p.waitForFunction(() => SIM_APP.run && !SIM_APP.run.ended); await p.click('button:has-text("Abandonner")'); await p.click('.modal button:has-text("Abandonner")'); await p.waitForSelector('.dcamp');
  chk('abandon : débrief direct, sans fiche', !(await p.$('.fmodal')) && !(await p.$('.dfiche')));
  /* bac à sable : toute l'infrastructure, aucune progression de campagne */
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'phys_eth' })); await p.waitForTimeout(400);
  chk('bac à sable : carte complète et 6 sites', (await p.$$('.map .node')).length === 15 && (await p.$$('.tabs .tab')).length === 6 && !(await p.$('.mapscope')));
  /* mode d'origine */
  const q = await ctx.newPage(); await q.goto(URL + '#legacy'); await q.waitForFunction(() => window.SIM_APP); await q.waitForTimeout(300);
  chk('#legacy : accueil ouvert sur le bac à sable, ticket du jour visible', (await q.$$('.hlv')).length === 5 && !!(await q.$('.pdaily')) && (await q.innerText('.cnavb.on b')).toUpperCase() === 'BAC À SABLE');
  await q.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'phys_eth' })); await q.waitForTimeout(300);
  await q.evaluate(() => { const run = SIM_APP.run, m = run.m, F = SIM.fault; m.parts.forEach(pt => { F.runSteps(m.W, pt.fix, { inst: pt }); run.act('x', 'c', { mutates: true }); }); m.W.observe(F.defaultVerify(m.parts[0])[0].replace(/\*/g, 'test'), true); run.check(); });
  await q.waitForTimeout(500); chk('#legacy : pas de fiche, débrief direct', !(await q.$('.fmodal')) && /Ticket/.test(await q.innerText('h1')));
  /* mobile : l'accueil de campagne tient sans défilement horizontal */
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const mp = await mctx.newPage(); await mp.goto(URL); await mp.waitForFunction(() => window.SIM_APP); await mp.waitForTimeout(300);
  chk('mobile : pas de débordement horizontal', await mp.evaluate(() => document.querySelector('.screen.home').scrollWidth <= window.innerWidth + 1));
  if (SHOTS) await mp.screenshot({ path: SHOTS + '/12-mobile.png', fullPage: false });
  errs.forEach(e => console.log(e));
  console.log(ok && !errs.length ? 'OK campagne' : 'ÉCHEC');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
