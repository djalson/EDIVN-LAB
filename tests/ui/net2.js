/* Test : Bureau à distance (PC-ADM → SRV-FIC) et PuTTY (PC-ADM → Debian). */
const T = require('./lib');
(async () => {
  const t = await T.start({ fault: process.argv[2] || 'web_cert_expired', dev: 'PC-ADM', user: 'TOULOUSE\\Administrateur', pwd: 'Adm!n2026' });
  const p = t.p;
  console.log('mstsc', await t.open('mstsc')); await p.waitForTimeout(300);
  await p.fill('.mstscw input.w10in >> nth=0', 'srv-fic'); await p.click('.mstscw button:has-text("Connexion")'); await p.waitForTimeout(600); await t.shot('net2a');
  await p.fill('.dlg2 input[type=text] >> nth=0', 'TOULOUSE\\Administrateur'); await p.fill('.dlg2 input[type=password]', 'Adm!n2026'); await p.click('.dlg2 button:has-text("OK")'); await p.waitForTimeout(2500); await t.shot('net2b');
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll('.rdpwin .wtitle')).map(x => x.textContent).join('|')), await p.evaluate(() => JSON.stringify(SIM_APP.run.W.d('SRV-FIC')._rt.session && SIM_APP.run.W.d('SRV-FIC')._rt.session.user)));
  // ouvrir un outil dans la session distante : le Gestionnaire de serveur doit être là
  console.log('wins in remote', await p.evaluate(() => Array.from(document.querySelectorAll('.rdpwin .desk .win .wtitle')).map(x => x.textContent).join('|')));
  // fermer la fenêtre RDP
  await p.evaluate(() => { SIM_APP.run.surfaces['PC-ADM'].desk.wm.wins.filter(w => /Bureau à distance/.test(w.title) && /srv-fic/i.test(w.title)).forEach(w => w.close(true)); });
  console.log('session after close', await p.evaluate(() => JSON.stringify(SIM_APP.run.W.d('SRV-FIC')._rt.session || null)));
  // mauvais mot de passe
  await t.open('mstsc'); await p.waitForTimeout(300);
  await p.fill('.mstscw input.w10in >> nth=0', 'srv-fic'); await p.click('.mstscw button:has-text("Connexion")'); await p.waitForTimeout(500);
  await p.fill('.dlg2 input[type=text] >> nth=0', 'TOULOUSE\\Administrateur'); await p.fill('.dlg2 input[type=password]', 'faux'); await p.click('.dlg2 button:has-text("OK")'); await p.waitForTimeout(400);
  console.log('badpwd msg:', await p.evaluate(() => Array.from(document.querySelectorAll('.dlg2 div')).map(x => x.textContent).filter(x => /fonctionn/.test(x))[0]));
  await t.shot('net2c');
  // PuTTY
  console.log('putty', await t.open('putty')); await p.waitForTimeout(300);
  await t.shot('net2d');
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
