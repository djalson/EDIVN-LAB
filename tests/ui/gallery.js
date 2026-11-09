/* Galerie de captures du jeu (revue visuelle) : écran d'accueil, ticket, carte, bureaux et consoles principales.
   Les images sont écrites dans le dossier passé en argument (défaut /tmp/edivn-gallery). Ce script ne juge rien :
   il produit les images à regarder, et échoue seulement sur une erreur JS de page ou un élément absent. */
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2] || '/tmp/edivn-gallery'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; const miss = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(500);
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: OUT + '/' + n + '.png' }); console.log('→ ' + n); };
  await shot('01-accueil');
  const begin = (o) => p.evaluate(o => { SIM_APP.begin(o); }, o);
  const open = (dev, app, arg) => p.evaluate(([d, a, r]) => { const s = SIM_APP.run.surfaces[d]; if (!s) return 'no-surface'; return !!s.desk.open(a, r); }, [dev, app, arg]).then(r => { if (r !== true) miss.push(dev + ':' + app + ' → ' + r); });
  const dev = async (d, user, pwd) => {
    await p.evaluate(x => SIM_APP.openDev(x, 'main'), d); await p.waitForTimeout(500);
    if (await p.$('.logon')) { await p.click('.logon'); await p.waitForTimeout(150); await p.fill('.logon input[type=text]', user || 'TOULOUSE\\Administrateur'); await p.fill('.logon input[type=password]', pwd || 'Adm!n2026'); await p.keyboard.press('Enter'); await p.waitForTimeout(2000); }
  };
  const prof = { name: 'Revue', done: {}, skills: {}, badges: [], history: [], best: {} };

  await begin({ level: 2, mode: 'guided', seed: '11', faultId: 'dhcp_scope_off', profile: prof }); await shot('02-ticket-guide');
  await p.evaluate(() => { const t = [...document.querySelectorAll('button,.tab,[role=tab]')].find(x => /carte|réseau|topologie/i.test(x.textContent)); if (t) t.click(); }); await shot('03-carte');

  await begin({ level: 2, mode: 'free', seed: '5', faultId: 'web_hostheader', profile: prof });
  await dev('SRV-FIC'); await shot('04-bureau-srv-fic');
  await open('SRV-FIC', 'iis'); await shot('05-iis');
  await open('SRV-FIC', 'explorer'); await open('SRV-FIC', 'compmgmt'); await shot('06-explorer-compmgmt');
  await open('SRV-FIC', 'wf'); await shot('07-pare-feu');

  await begin({ level: 2, mode: 'free', seed: '5', faultId: 'dhcp_scope_off', profile: prof });
  await dev('SRV-DC1'); await open('SRV-DC1', 'dhcp'); await shot('08-dhcp');
  await open('SRV-DC1', 'dns'); await shot('09-dns');
  await open('SRV-DC1', 'aduc'); await shot('10-aduc');
  await open('SRV-DC1', 'gpmc'); await shot('11-gpmc');
  await dev('PC-01', 'TOULOUSE\\a.martin', 'Compta#2026'); await open('PC-01', 'ncpa'); await shot('12-ncpa-client');
  await p.keyboard.press('Escape');
  await b.close();
  console.log(miss.length ? '✗ applications non ouvertes : ' + miss.join(' ; ') : 'toutes les applications demandées se sont ouvertes');
  console.log(errs.slice(0, 10).join('\n') || 'no errors'); process.exit(errs.length || miss.length ? 1 : 0);
})();
