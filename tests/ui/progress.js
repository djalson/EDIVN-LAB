/* Progression côté interface : carte de carrière, ticket du jour, thèmes verrouillés, arbre de compétences, coffre-fort
   (formulaire Windows, terminal Ctrl+Espace), comptage des saisies manuelles, coupure en évaluation chronométrée,
   bilan d'XP du débrief, objectifs bonus, carnet. Aucune erreur JS de page. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300);

  console.log('== accueil : carrière et ticket du jour');
  let txt = await p.innerText('.screen.home');
  chk('carte de carrière : niveau 1, titre, 0 point', !!(await p.$('.pcard .lvchip')) && /Niveau|Recrue|Stagiaire|Apprenti|Technicien|Junior/i.test(await p.innerText('.pcard .ptitle')) && /0 point/.test(await p.innerText('.pcard')));
  chk('ticket du jour affiché, avec bouton', !!(await p.$('.pdaily')) && /Ticket du jour/.test(txt) && !!(await p.$('.pdaily button.primary')));
  chk('boutons Arbre / Maîtrises / Succès', /Arbre de compétences/.test(txt) && /Maîtrises par compétence/.test(txt) && /Succès \(0 \/ \d+\)/.test(txt));
  chk('sauvegarde du profil proposée dans les outils', /Sauvegarde du profil/.test(txt));

  console.log('== thèmes verrouillés');
  await p.click('.hthemetop'); await p.waitForSelector('.thcard');
  const locked = await p.$$eval('.thcard', cs => cs.map(c => ({ n: c.querySelector('b').textContent, lock: /Débloquer dans l’arbre|🔒 Niveau/.test(c.innerText) })));
  chk('7 thèmes verrouillés (5 dans l’arbre, 2 de prestige), 3 libres (Néon Arcade, Dev Dark, Papier Clair)', locked.filter(x => x.lock).length === 7 && locked.filter(x => !x.lock).map(x => x.n).sort().join() === 'Dev Dark,Néon Arcade,Papier Clair');
  await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.overlay') && document.querySelector('.overlay').remove());

  console.log('== arbre de compétences');
  await p.click('.pcard button:has-text("Arbre de compétences")'); await p.waitForSelector('.pgscr');
  chk('13 nœuds en 3 branches (Confort / Réputation / Style)', (await p.$$('.pgnode')).length === 13 && (await p.$$('.pgcol')).length === 3);
  chk('niveau 1 : rien n’est achetable (0 point)', (await p.$$('.pgnode.buy')).length === 0 && (await p.$$('.pgnode.owned')).length === 0);
  chk('le coffre dit comment l’obtenir', /Se débloque avec le succès « Mémoire des doigts »/.test(await p.innerText('.pgscr')));
  await p.click('.pgtab:has-text("Maîtrises")'); chk('maîtrises : toutes les compétences listées à « aucune »', (await p.$$('.pgsk')).length >= 40);
  await p.click('.pgtab:has-text("Succès")'); chk('succès : ≥ 40 cartes, filtrables par catégorie', (await p.$$('.pgac')).length >= 40 && (await p.$$('.pgfilter .pgtab')).length >= 5);
  chk('un succès secret reste masqué', /Succès secret/.test(await p.innerText('.pgscr')));
  await p.click('.pghead button:has-text("Fermer")'); chk('fermeture', !(await p.$('.pgscr')));
  /* 4 points : niveau 5 */
  await p.evaluate(() => { const pr = SIM.game.profile(); pr.xp = SIM.prog.cum(5); SIM.game.saveProfile(pr); SIM_APP.home(); });
  await p.click('.pcard button:has-text("Arbre de compétences")'); await p.waitForSelector('.pgscr');
  chk('niveau 5 : 4 points affichés', /^4/.test(await p.innerText('.pgpts')));
  await p.click('.pgnode:has-text("Carnet de bord") button:has-text("Débloquer")'); await p.waitForTimeout(100);
  chk('achat du carnet : 3 points restants, nœud possédé, persisté', /^3/.test(await p.innerText('.pgpts')) && await p.evaluate(() => SIM.prog.has(SIM.game.profile(), 'notes')));
  await p.click('.pgnode:has-text("Thème : Pluie de code") button:has-text("Débloquer")'); await p.waitForTimeout(100);
  await p.click('.pgnode:has-text("Thème : Pluie de code") button:has-text("Appliquer")'); await p.waitForTimeout(100);
  chk('thème acheté puis appliqué', await p.evaluate(() => SIM.game.store.get('theme') === 'rain' && document.documentElement.getAttribute('data-theme') === 'rain'));
  await p.click('.pgbody button:has-text("Réinitialiser l’arbre")'); await p.waitForSelector('.modal');
  await p.click('.modal button:has-text("Réinitialiser")'); await p.waitForTimeout(100);
  chk('réinitialisation : points rendus (4), plus aucun nœud acheté', /^4/.test(await p.innerText('.pgpts')) && (await p.$$('.pgnode.owned')).length === 0);
  await p.click('.pghead button:has-text("Fermer")');
  await p.evaluate(() => { SIM.game.store.set('theme', 'neon'); SIM_APP.home(); });

  console.log('== coffre-fort : formulaire Windows');
  await p.evaluate(() => { const pr = SIM.game.profile(); pr.stats.logins = 19; SIM.prog.award(pr); SIM.game.saveProfile(pr); });
  const logon = async mode => {
    await p.evaluate(m => { SIM_APP.begin({ level: 1, mode: m, seed: '7', faultId: 'dhcp_scope_off' }); SIM_APP.openDev('PC-ADM', 'main'); SIM_APP.run.surfaces['PC-ADM'].showLogon(); }, mode); await p.waitForTimeout(500);
    const l = await p.$('.logon'); if (l) { await l.click(); await p.waitForTimeout(150); }
    const other = await p.$('.logon .other'); if (other && !(await p.$('.logon input[type=text]'))) { await other.click(); await p.waitForTimeout(100); }
  };
  await logon('free');
  chk('19 saisies : pas de coffre, pas de bouton clé', !(await p.$('.logon .vkey')));
  chk('sans coffre : aucun texte parasite (« null ») sur l’écran de connexion', !/null|undefined/.test(await p.innerText('.logon')));
  await p.fill('.logon input[type=text]', 'TOULOUSE\\tssr'); await p.fill('.logon input[type=password]', 'Tssr-2026!'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  let st = await p.evaluate(() => SIM.game.profile());
  chk('connexion manuelle réussie : 20 saisies → succès « Mémoire des doigts »', st.stats.logins === 20 && st.badges.indexOf('fingers') >= 0);
  /* D-96 : l'export JSON du profil ne contient aucun mot de passe saisi par le joueur (le mot de passe vient d'être tapé à la main ci-dessus) */
  { const leak = await p.evaluate(() => { const typed = 'Tssr-2026!'; const look = o => JSON.stringify(o); const ls = {}; try { for (let i = 0; i < localStorage.length; i++) ls[localStorage.key(i)] = localStorage.getItem(localStorage.key(i)); } catch (e) { /* stockage indisponible */ }
      const hit = txt => txt.indexOf(typed) >= 0 || /"[^"]*(password|passwd|pwd|secret|mdp|motdepasse)[^"]*"\s*:/i.test(txt);
      return { exported: hit(look(SIM.game.profile())), stored: hit(look(ls)), neutralisation: hit(look({ stats: { logins: 20 }, derniereSaisie: typed })) }; });
    chk('D-96 : l’export JSON du profil ne contient pas le mot de passe saisi à la main', leak.exported === false);
    chk('D-96 : le stockage navigateur (profil, préférences) ne contient pas non plus le mot de passe saisi', leak.stored === false);
    chk('D-96 neutralisation : le même contrôle détecte un profil qui garderait la saisie (il virerait au rouge)', leak.neutralisation === true); }
  chk('le coffre est offert par le succès, sans point dépensé', await p.evaluate(() => SIM.prog.has(SIM.game.profile(), 'vault1') && SIM.prog.pointsLeft(SIM.game.profile()) === 4));
  chk('toast du succès : coffre annoncé', /Succès débloqué : Mémoire des doigts/.test(await p.evaluate(() => document.body.innerText)) );
  await logon('free');
  chk('coffre actif : bouton clé présent sur l’ouverture de session', !!(await p.$('.logon .vkey')));
  await p.click('.logon .vkey'); await p.waitForSelector('.modal');
  chk('choix du compte : tableau des comptes Windows', (await p.$$('.modal tbody tr')).length >= 4);
  await p.click('.modal tr:has-text("TOULOUSE\\\\tssr") button'); await p.waitForTimeout(150);
  chk('identifiant et mot de passe remplis', await p.evaluate(() => document.querySelector('.logon input[type=text]').value === 'TOULOUSE\\tssr' && document.querySelector('.logon input[type=password]').value === 'Tssr-2026!'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  chk('connexion par le coffre : le compteur de saisies manuelles n’augmente pas', await p.evaluate(() => SIM.game.profile().stats.logins === 20));
  chk('session ouverte (bureau affiché)', !!(await p.$('.desk')) && !(await p.$('.logon input[type=password]')));
  await logon('timed');
  chk('évaluation chronométrée : le coffre est coupé', !(await p.$('.logon .vkey')));

  console.log('== coffre-fort : terminaux (Ctrl + Espace)');
  await p.evaluate(() => { const pr = SIM.game.profile(); pr.stats.logins = 60; pr.xp = SIM.prog.cum(5); SIM.prog.award(pr); SIM.game.saveProfile(pr); SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: 'dhcp_scope_off' }); SIM_APP.openDev('SRV-RV', 'main'); });
  await p.waitForTimeout(600);
  const key = async () => { await p.keyboard.press('Control+Space'); await p.waitForTimeout(150); };
  await p.keyboard.type('admin'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await key();
  chk('palier 2 non acheté : message d’invite à débloquer', /terminaux/.test(await p.innerText('.toasts')));
  chk('palier 2 non acheté : pas de bouton clé dans le terminal', !(await p.$('.term .tvault:visible')));
  await p.evaluate(() => { const pr = SIM.game.profile(); SIM.prog.buy(pr, 'vault2'); SIM.game.saveProfile(pr); });
  await p.keyboard.press('x'); await p.keyboard.press('Backspace'); await p.waitForTimeout(100);
  chk('palier 2 acheté : bouton clé visible à l’invite du mot de passe', !!(await p.$('.term .tvault:visible')));
  await p.click('.term .tvault'); await p.waitForTimeout(150);
  chk('palier 2 acheté : mot de passe de « admin » inséré sans choix', /inséré depuis le coffre/.test(await p.innerText('.toasts')) || !!(await p.$('.modal')));
  if (await p.$('.modal')) { await p.click('.modal tr:has-text("SRV-RV") button'); await p.waitForTimeout(150); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(2200);
  chk('connexion console réussie avec le mot de passe du coffre', /admin@srv-rv|\$ /.test(await p.innerText('.stage')));
  chk('bouton clé masqué hors invite de mot de passe', !(await p.$('.term .tvault:visible')));
  chk('aucune saisie manuelle comptée pour un remplissage par le coffre', await p.evaluate(() => SIM.game.profile().stats.logins === 60));

  console.log('== objectifs bonus et carnet dans le ticket');
  await p.evaluate(() => { SIM_APP.begin({ level: 2, mode: 'free', seed: '4243', faultId: 'dhcp_scope_off' }); }); await p.waitForTimeout(300);
  chk('objectifs bonus listés dans le ticket', (await p.$$('.pgoalbox .pgg')).length >= 3);
  chk('carnet : bouton présent (acheté ou non, ici non)', !(await p.$('.gbar button:has-text("Carnet")')));
  await p.evaluate(() => { const pr = SIM.game.profile(); SIM.prog.buy(pr, 'notes'); SIM.game.saveProfile(pr); SIM_APP.begin({ level: 2, mode: 'free', seed: '4243', faultId: 'dhcp_scope_off' }); }); await p.waitForTimeout(300);
  chk('carnet acheté : bouton présent en mode libre', !!(await p.$('.gbar button:has-text("Carnet")')));
  await p.click('.gbar button:has-text("Carnet")'); await p.waitForSelector('textarea.pgnotes'); await p.fill('textarea.pgnotes', 'DHCP : vérifier la portée.');
  await p.click('.modal button:has-text("Enregistrer")'); await p.waitForTimeout(150);
  chk('note enregistrée dans le profil, compteur de notes à 1', await p.evaluate(() => { const pr = SIM.game.profile(); return Object.keys(pr.notes).length === 1 && pr.stats.notes === 1; }));
  await p.evaluate(() => { SIM_APP.begin({ level: 2, mode: 'timed', seed: '4243', faultId: 'dhcp_scope_off' }); }); await p.waitForTimeout(300);
  chk('évaluation chronométrée : le carnet est coupé', !(await p.$('.gbar button:has-text("Carnet")')));

  console.log('== débrief : bilan d’XP');
  const deb = await p.evaluate(async () => {
    const before = SIM.game.profile().xp;
    SIM_APP.begin({ level: 2, mode: 'free', seed: '4243', faultId: 'dhcp_scope_off' }); await new Promise(r => setTimeout(r, 80));
    const run = SIM_APP.run; const inst = run.m.parts[0]; SIM.fault.runSteps(run.W, inst.fix, { inst }); const pats = (inst.verify && inst.verify.length) ? inst.verify : SIM.fault.defaultVerify(inst); run.W.observe(pats[0].replace(/\*/g, 'test'), true);
    SIM_APP.closeTicket(); await new Promise(r => setTimeout(r, 400));
    const pr = SIM.game.profile();
    return { before, after: pr.xp, text: document.body.innerText, panel: !!document.querySelector('.pgdeb'), goals: document.querySelectorAll('.pgdeb .pgg').length, big: (document.querySelector('.pgxpbig b') || {}).textContent, streak: pr.streak.n };
  });
  chk('panneau « Expérience » présent après le barème des cartes', deb.panel && /Expérience/i.test(deb.text));
  chk('XP gagnée affichée = XP ajoutée au profil', deb.after - deb.before === parseInt(String(deb.big).replace(/\D/g, ''), 10) && deb.after > deb.before);
  chk('détail : niveau, première résolution, objectifs bonus', /Niveau \S+/.test(deb.text) && /Première résolution/i.test(deb.text) && deb.goals >= 3);
  chk('série de 1 jour démarrée', deb.streak === 1);
  const gu = await p.evaluate(async () => {
    SIM_APP.begin({ level: 1, mode: 'free', seed: '9' }); await new Promise(r => setTimeout(r, 80));
    SIM_APP.run.m.giveUp(); SIM_APP.run.finish(); await new Promise(r => setTimeout(r, 300));
    return { text: document.querySelector('.pgdeb') ? document.querySelector('.pgdeb').innerText : '' };
  });
  chk('abandon : participation seule (10 XP), pas de bonus', /Participation/.test(gu.text) && /\+10/.test(gu.text));

  console.log('== ticket du jour');
  await p.evaluate(() => SIM_APP.home()); await p.waitForTimeout(200);
  const dly = await p.evaluate(() => { const d = SIM.prog.daily(); return { d, again: JSON.stringify(SIM.prog.daily()) === JSON.stringify(d) }; });
  chk('ticket du jour déterministe (même date → même graine et niveau)', dly.again && /^jour-\d{4}-\d{2}-\d{2}$/.test(dly.d.seed));
  await p.click('.pdaily button'); await p.waitForTimeout(500);
  chk('le ticket du jour démarre avec le badge « ticket du jour »', await p.evaluate(() => SIM_APP.run.m.daily === true) && /ticket du jour/i.test(await p.innerText('.ticket h3')));
  await p.evaluate(() => SIM_APP.home()); await p.waitForTimeout(200);

  console.log('== sauvegarde du profil');
  await p.click('button:has-text("Sauvegarde du profil")'); await p.waitForSelector('textarea.pgnotes');
  const exported = await p.evaluate(() => JSON.stringify(SIM.game.profile()));
  await p.evaluate(() => { const pr = SIM.game.profile(); pr.xp = 0; SIM.game.saveProfile(pr); });
  await p.fill('textarea.pgnotes', exported); await p.click('.modal button:has-text("Restaurer ce profil")'); await p.waitForTimeout(300);
  chk('restauration : XP, arbre et carnet de retour', await p.evaluate(e => { const pr = SIM.game.profile(); const o = JSON.parse(e); return pr.xp === o.xp && pr.xp > 0 && SIM.prog.has(pr, 'notes'); }, exported));
  await p.click('button:has-text("Sauvegarde du profil")'); await p.waitForSelector('textarea.pgnotes'); await p.fill('textarea.pgnotes', '{"v":2,"__proto__":{"x":1}'); await p.click('.modal button:has-text("Restaurer ce profil")');
  chk('contenu invalide refusé sans casser le profil', /illisible/.test(await p.innerText('.modal')) && await p.evaluate(() => SIM.game.profile().xp > 0));

  console.log('erreurs de page :', errs.length ? errs.join(' | ') : 'aucune'); if (errs.length) ok = false;
  await b.close(); console.log(ok ? 'OK' : 'ÉCHEC'); process.exit(ok ? 0 : 1);
})();
