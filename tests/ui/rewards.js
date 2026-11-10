/* Récompenses de niveau par l'interface : piste, apparence, contrats (ticket vague, sans plan, sans aide-mémoire), voyants de liaison,
   ping rapide, historique entre tickets, second avis, paliers d'astreinte, déblocage au débrief, prestige, coupure en chronométré, #legacy. */
const { chromium } = require('playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href;
const SHOTS = process.env.SHOTS || '';
(async () => {
  const b = await chromium.launch(); const errs = []; let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  const open = async (profile, hash) => { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await p.addInitScript(pr => { if (!localStorage.getItem('edivn.gen')) { localStorage.setItem('edivn.gen', '3'); localStorage.setItem('edivn.profile', JSON.stringify(pr)); } }, profile);
    await p.goto(URL + (hash || '')); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300); return p; };
  const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + n + '.png' }); };
  const xp = lv => Math.round(100 * Math.pow(lv - 1, 1.6));
  const solve = p => p.evaluate(() => { const run = SIM_APP.run, m = run.m, F = SIM.fault; m.parts.forEach(pt => { F.runSteps(m.W, pt.fix || pt.fixes[Object.keys(pt.fixes)[0]], { inst: pt }); run.act('x', 'correction', { mutates: true }); }); m.parts.forEach(pt => { const v = (pt.verify && pt.verify.length) ? pt.verify : F.defaultVerify(pt); m.W.observe(v[0].replace(/\*/g, 'test'), true); }); run.check(); });
  const fiche = async p => { await p.waitForSelector('.fmodal'); const spec = await p.evaluate(() => SIM_APP.run.m.reportSpec().questions.map(q => [q.id, q.answer])); for (const q of spec) await p.click('.fq[data-q="' + q[0] + '"] .fopt[data-o="' + q[1] + '"]'); await p.click('.fmodal .actions .btn'); await p.waitForSelector('.dfiche'); };

  /* ---------- niveau 20, chapitres 1 à 3 terminés ---------- */
  let p = await open({ v: 2, xp: xp(20), camp: { exams: { 1: 90, 2: 90, 3: 90 }, seen: { 1: 1, 2: 1, 3: 1, 4: 1 } } });
  chk('accueil : bouton Récompenses et prochaine récompense', !!(await p.$('.pcard .rwbtn')) && /niveau 22/i.test(await p.innerText('.rwnext')));
  chk('contrats repliés par défaut', !!(await p.$('.ccard details.cctr:not([open])')));
  await p.click('.ccard .cctr > summary');
  chk('accompagné : contrats indisponibles', await p.$eval('.ccard .rwcb', e => e.disabled) && /accompagné/.test(await p.innerText('.ccard .rwch')));
  await p.click('.cmodeb[data-mode=free]'); await p.click('.ccard .cctr > summary'); chk('autonome : 4 contrats acquis au niveau 20', (await p.$$('.ccard .rwcb:not([disabled])')).length === 4);
  await p.click('.ccard .rwcb[data-contract=nohelp]'); await p.click('.ccard .rwcb[data-contract=vague]'); await p.click('.ccard .rwcb[data-contract=nomap]');
  chk('contrats cochés : multiplicateur affiché sur le repli', /1,52/.test(await p.innerText('.ccard .cctrn')));
  await shot(p, '20-contrats');
  await p.click('.cnavb[data-tab=duty]'); chk('astreinte niveau 20 : nuit noire verrouillée, les deux autres ouvertes', (await p.$$('.cdutyb.lock')).length === 1 && /niveau 30/.test(await p.innerText('.cdutyb.lock')));
  await shot(p, '21-astreinte-paliers');
  /* piste et apparence */
  await p.click('.pcard .rwbtn'); await p.waitForSelector('.rwview');
  chk('piste : récompenses acquises jusqu’au niveau 20', await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('.rwtrack .rwrow')); return rows.length === SIM.rewards.TRACK.length && rows.filter(r => r.classList.contains('on')).length === SIM.rewards.TRACK.filter(r => r.lv <= 20).length; }));
  chk('apparence : habillage « Nuit » (niv. 22) verrouillé, insigne de bronze acquis', await p.$eval('[data-cos="map:night"]', e => e.disabled) && !(await p.$eval('[data-cos="frame:bronze"]', e => e.disabled)) && await p.$eval('[data-cos="frame:silver"]', e => e.disabled));
  await p.click('[data-cos="map:blueprint"]'); await p.click('[data-cos="term:green"]'); await p.click('[data-cos="wall:aurora"]'); await p.click('[data-cos="frame:bronze"]');
  chk('apparence appliquée à la racine et enregistrée', await p.evaluate(() => { const r = document.documentElement, c = SIM.game.profile().cos; return r.getAttribute('data-map') === 'blueprint' && r.getAttribute('data-term') === 'green' && r.getAttribute('data-wall') === 'aurora' && c.map === 'blueprint' && c.frame === 'bronze'; }));
  chk('prestige indisponible avant le niveau 40', await p.$eval('[data-act=prestige]', e => e.disabled));
  await shot(p, '22-recompenses');
  await p.click('.pghead .btn'); await p.waitForTimeout(200);
  chk('insigne de bronze sur la carte de carrière', (await p.getAttribute('.pcard', 'data-frame')) === 'bronze');
  /* partie sous contrats */
  await p.evaluate(() => SIM_APP.begin({ level: 2, mode: 'free', seed: '7', faultId: 'dns_svc' })); await p.waitForTimeout(400);
  chk('contrats actifs dans la partie : 3 pastilles', (await p.$$('.rwpill')).length === 3 && await p.evaluate(() => SIM_APP.run.m.contracts.join() === 'nohelp,vague,nomap'));
  chk('ticket vague : le récit du demandeur est remplacé', (await p.innerText('.ticket .body')).trim() === await p.evaluate(() => SIM.rewards.VAGUE_BODY));
  chk('sans plan : équipements listés, ni lien ni zone', (await p.$$('.map .node')).length === 15 && (await p.$$('.map svg.links line')).length === 0 && (await p.$$('.map .zone')).length === 0);
  await shot(p, '23-sans-plan');
  await p.evaluate(() => SIM_APP.openDev('SRV-LNX', 'main')); await p.waitForTimeout(700);
  chk('sans aide-mémoire : pas de bouton dans le terminal', !(await p.$('.thelp')) && !!(await p.$('.term')));
  chk('couleurs de terminal « Phosphore vert »', await p.$eval('.term', e => getComputedStyle(e).color === 'rgb(51, 255, 102)'));
  await shot(p, '24-terminal-vert');
  await solve(p); await fiche(p);
  chk('débrief : les trois contrats au bilan d’XP', ((await p.$eval('.pgxpcard', e => e.textContent)).match(/Contrat «/g) || []).length === 3);
  /* partie sans contrat : outils */
  await p.evaluate(() => { SIM.game.store.set('contracts', []); SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'phys_eth' }); }); await p.waitForTimeout(400);
  const dev = await p.evaluate(() => SIM_APP.run.m.parts[0].inject[0].port.split(':')[0]);
  chk('voyants de liaison : liens colorés, un lien coupé en rouge', (await p.$$('.map line[data-link=up]')).length >= 8 && (await p.$$('.map line[data-link=down]')).length === 1);
  chk('habillage « Plan d’architecte » sur la carte', await p.$eval('.map', e => getComputedStyle(e).backgroundColor === 'rgb(11, 58, 107)'));
  await shot(p, '25-voyants');
  await p.click('.node[title="SRV-DC1"]'); chk('ping rapide proposé sur un équipement', !!(await p.$('.pop button:has-text("Ping rapide")')));
  await p.click('.pop button:has-text("Ping rapide")'); await p.waitForTimeout(200);
  chk('ping rapide : résultat annoncé et journalisé, sans clore le ticket', /pas de réponse|délai/.test(await p.innerText('.toasts, .toast')) && await p.evaluate(() => SIM_APP.run.m.state === 'running' && SIM_APP.run.m.trace.some(t => /ping rapide/.test(t.text))));
  await p.evaluate(d => { SIM.fault.runSteps(SIM_APP.run.W, SIM_APP.run.m.parts[0].fix, { inst: SIM_APP.run.m.parts[0] }); SIM_APP.run.act(d, 'rebranché', { mutates: true }); }, dev); await p.waitForTimeout(150);
  chk('voyants repeints après une action : plus aucun lien rouge', (await p.$$('.map line[data-link=down]')).length === 0);
  /* second avis */
  await p.click('.gbar button:has-text("Indice")'); await p.waitForTimeout(200);
  chk('second avis : premier indice offert', await p.evaluate(() => { const m = SIM_APP.run.m; return m.hintLog.length === 1 && m.hintLog[0].free === true && SIM.game.profile().second === SIM.prog.today(); }));
  await p.click('.gbar button:has-text("Indice")'); await p.waitForTimeout(200);
  chk('second avis : le suivant est payant', await p.evaluate(() => { const m = SIM_APP.run.m; return m.hintLog.length === 2 && !m.hintLog[1].free; }));
  /* historique entre tickets */
  await p.evaluate(() => SIM_APP.openDev('SRV-LNX', 'main')); await p.waitForTimeout(600);
  await p.evaluate(() => { const mk = kind => Object.assign(Object.create(SIM.emu.Session.prototype), { kind, history: [], ask: null, env: { act: () => {}, W: SIM_APP.run.W }, W: SIM_APP.run.W, run: () => ({ out: [] }) }); mk('bash').exec('hostname'); mk('login').exec('tech'); const a = mk('bash'); a.ask = { cb: () => ({ out: [] }) }; a.exec('MotDePasse!'); });
  chk('commande enregistrée pour les tickets suivants ; ni identifiant ni mot de passe', await p.evaluate(() => { const h = SIM.game.store.get('cmdhist'); const all = JSON.stringify(h); return h && h.bash.indexOf('hostname') >= 0 && !/tech|MotDePasse/.test(all); }));
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '8', faultId: 'phys_eth' })); await p.waitForTimeout(300);
  chk('historique rappelé dans la partie suivante', await p.evaluate(() => SIM.ui.rewards.histSeed({ kind: 'bash' }).indexOf('hostname') >= 0));
  /* chronométré : outils et second avis coupés */
  await p.evaluate(() => { const q = SIM.game.profile(); q.second = ''; SIM.game.saveProfile(q); SIM_APP.begin({ level: 1, mode: 'timed', seed: '7', faultId: 'phys_eth' }); }); await p.waitForTimeout(400);
  chk('chronométré : ni voyants, ni ping rapide, ni historique', (await p.$$('.map line[data-link]')).length === 0 && await p.evaluate(() => !SIM.ui.rewards.toolOn('qping') && SIM.ui.rewards.histSeed({ kind: 'bash' }).length === 0));
  await p.close();

  /* ---------- montée de niveau : déblocage annoncé au débrief ---------- */
  p = await open({ v: 2, xp: xp(5) - 20 });
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'phys_eth' })); await p.waitForTimeout(300); await solve(p); await fiche(p);
  chk('débrief : « Voyants de liaison » débloqué au niveau 5', !!(await p.$('.rwnew')) && /Voyants de liaison/.test(await p.innerText('.rwnew')));
  await shot(p, '26-debloque'); await p.close();

  /* ---------- niveau 40 : prestige ---------- */
  p = await open({ v: 2, xp: xp(40) + 50, tree: { notes: true } });
  await p.click('.pcard .rwbtn'); await p.waitForSelector('.rwview');
  chk('niveau 40 : toute la piste acquise, thème Boréal possédé', await p.evaluate(() => document.querySelectorAll('.rwtrack .rwrow:not(.on)').length === 0 && SIM.prog.themeOwned(SIM.game.profile(), 'boreal')));
  await p.click('[data-act=prestige]'); await p.click('.modal .btn.primary'); await p.waitForTimeout(300);
  chk('prestige : niveau 1, une étoile, récompenses gardées', await p.evaluate(() => { const q = SIM.game.profile(); return q.prestige === 1 && q.xp === 0 && SIM.rewards.has(q, 'tool:hist') && SIM.rewards.contractOwned(q, 'allin'); }));
  await p.click('.pghead .btn'); await p.waitForTimeout(200);
  chk('étoile de prestige sur la carte, contrat « Tout ou rien » proposé', /★/.test(await p.innerText('.pcard .ptitle')) && (await p.click('.cnavb[data-tab=sandbox]'), !!(await p.$('.rwcb[data-contract=allin]'))));
  await shot(p, '27-prestige'); await p.close();

  /* ---------- thèmes : 10 dont 2 de prestige verrouillés au niveau 1 ---------- */
  p = await open({ v: 2 });
  chk('niveau 1 : aucun contrat affiché', (await p.$$('.rwc')).length === 0);
  await p.click('.cnavb[data-tab=duty]'); chk('niveau 1 : les trois incidents d’astreinte verrouillés, ticket du jour ouvert', (await p.$$('.cdutyb.lock')).length === 3 && !!(await p.$('.pdaily')));
  await p.close();

  /* ---------- mode d'origine ---------- */
  p = await open({ v: 2, xp: xp(20), cos: { map: 'blueprint', term: 'green' } }, '#legacy');
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'phys_eth', contracts: ['nomap'] })); await p.waitForTimeout(300);
  chk('#legacy : ni cosmétique, ni voyants, ni bouton Récompenses', await p.evaluate(() => !document.documentElement.hasAttribute('data-map') && !document.querySelector('.map line[data-link]')) && (await p.evaluate(() => { SIM_APP.home(); return !document.querySelector('.rwbtn') && !document.querySelector('.rwc'); })));
  await p.close();
  errs.forEach(e => console.log(e));
  console.log(ok && !errs.length ? 'OK récompenses' : 'ÉCHEC'); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
