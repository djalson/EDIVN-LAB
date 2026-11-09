/* Fiche de l'infra : identifiants copiables et plan d'adressage attendu (accueil, en jeu, mode évaluation), copie réelle dans le presse-papiers. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300);
  const bad = async () => /\bnull\b|undefined|NaN/.test(await p.innerText('.modal'));

  console.log('== identifiants');
  await p.click('button:has-text("Mots de passe de l’infra")'); await p.waitForSelector('.modal .infotbl');
  const nCred = await p.evaluate(() => SIM.VAULT.length);
  chk('une ligne par compte, avec « Copier id » et « Copier mdp »', (await p.$$('.modal tbody tr')).length === nCred && (await p.$$('.modal button:has-text("Copier id")')).length === nCred && (await p.$$('.modal button:has-text("Copier mdp")')).length === nCred);
  const c0 = await p.evaluate(() => SIM.VAULT[0]);
  await p.click('.modal tbody tr:first-child button:has-text("Copier id")'); await p.waitForTimeout(150);
  chk('copie de l’identifiant dans le presse-papiers + toast', (await p.evaluate(() => navigator.clipboard.readText())) === c0.user && /copié/i.test(await p.innerText('body')));
  await p.click('.modal tbody tr:first-child button:has-text("Copier mdp")'); await p.waitForTimeout(150);
  chk('copie du mot de passe', (await p.evaluate(() => navigator.clipboard.readText())) === c0.secret);
  await p.click('.modal tbody tr:first-child .cp.mono'); await p.waitForTimeout(100);
  chk('un clic sur la valeur copie aussi', (await p.evaluate(() => navigator.clipboard.readText())) === c0.secret);
  chk('aucun texte parasite', !(await bad()));

  console.log('== plan d’adressage');
  await p.click('.modal .pgtab:has-text("Plan d’adressage")'); await p.waitForSelector('.modal .infosite');
  const nRows = await p.evaluate(() => SIM.plan(SIM.buildHealthyWorld({ seed: 1 })).rows.length);
  chk('toutes les lignes du plan sont affichées', (await p.$$('.modal tbody tr')).length === nRows);
  chk('groupé par site', (await p.$$('.modal .infosite')).length >= 3);
  chk('PC-01 : IP, masque, passerelle, DNS, VLAN', await p.evaluate(() => { const r = [...document.querySelectorAll('.modal tbody tr')].find(t => /PC-01/.test(t.innerText)); return !!r && /10\.10\.20\.50/.test(r.innerText) && /255\.255\.255\.0/.test(r.innerText) && /10\.10\.20\.1/.test(r.innerText) && /10\.10\.10\.10/.test(r.innerText) && /20 \(/.test(r.innerText); }));
  chk('modale élargie, sans débordement de l’écran', await p.evaluate(() => { const m = document.querySelector('.modal').getBoundingClientRect(); return m.width > 900 && m.right <= innerWidth && m.bottom <= innerHeight + 2; }));
  await p.click('.modal tbody tr:has-text("PC-01") .cp.mono'); await p.waitForTimeout(150);
  chk('clic sur une IP : copiée', /^\d+\.\d+\.\d+\.\d+$/.test(await p.evaluate(() => navigator.clipboard.readText())));
  await p.fill('.modal input.txt', '10.10.20.50'); await p.waitForTimeout(100);
  chk('filtre : ne reste que les lignes concernées', (await p.$$('.modal tbody tr')).length >= 1 && (await p.$$('.modal tbody tr')).length < 5);
  await p.fill('.modal input.txt', 'zzzzzz'); await p.waitForTimeout(100);
  chk('filtre sans résultat : message', /Aucune ligne/.test(await p.innerText('.modal')));
  chk('aucun texte parasite', !(await bad()));
  await p.click('.modal button:has-text("Fermer")'); chk('fermeture', !(await p.$('.modal')));

  console.log('== accueil : bouton dédié');
  await p.click('button:has-text("Plan d’adressage")'); await p.waitForSelector('.modal .infosite'); chk('le bouton de l’accueil ouvre directement le plan', true);
  await p.click('.modal button:has-text("Fermer")');

  console.log('== en jeu (libre et évaluation chronométrée)');
  for (const mode of ['free', 'timed']) {
    await p.evaluate(m => { SIM_APP.begin({ level: 1, mode: m, seed: '7', faultId: 'dhcp_scope_off' }); }, mode); await p.waitForTimeout(400);
    await p.click('button:has-text("Adressage")'); await p.waitForSelector('.modal .infosite');
    chk(mode + ' : le plan suit la graine de la partie (autres équipements présents)', (await p.$$('.modal tbody tr')).length >= nRows - 5 && !(await bad()));
    await p.click('.modal button:has-text("Fermer")');
    await p.click('button:has-text("Identifiants")'); await p.waitForSelector('.modal .infotbl'); chk(mode + ' : identifiants ouvrables', true); await p.click('.modal button:has-text("Fermer")');
    await p.evaluate(() => SIM_APP.home()); await p.waitForTimeout(300);
  }
  chk('aucune erreur JS de page', errs.length === 0); if (errs.length) console.log(errs.slice(0, 5));
  await b.close(); process.exit(ok ? 0 : 1);
})();
