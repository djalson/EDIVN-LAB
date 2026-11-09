/* Robustesse du profil persistant : un localStorage corrompu ou hostile ne doit jamais bloquer l'accueil ni une partie.
   On injecte plusieurs profils invalides avant le chargement, puis on vérifie que l'accueil s'affiche et qu'un ticket démarre. */
const { chromium } = require('playwright');
const BAD = [
  '42', '"texte"', 'null', '[]', '{"name":42,"done":"x","skills":7,"badges":"b","history":{},"best":[]}',
  '{"name":"<img src=x onerror=alert(1)>","done":{"__proto__":{"polluted":true}},"skills":{},"badges":[],"history":[],"best":{}}',
  '{"name":"' + 'A'.repeat(5000) + '","done":{},"skills":{},"badges":[],"history":[],"best":{}}',
  '{ceci n est pas du json'
];
(async () => {
  const b = await chromium.launch(); const fails = []; const errs = [];
  for (const raw of BAD) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('dialog', d => { fails.push('boîte de dialogue JS inattendue : ' + d.message()); d.dismiss(); });
    await p.addInitScript(r => { try { localStorage.setItem('edivn.profile', r); localStorage.setItem('edivn.scenarios', r); } catch (e) { /* ignoré */ } }, raw);
    await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP, null, { timeout: 5000 }).catch(() => fails.push('SIM_APP absent pour ' + raw.slice(0, 40)));
    await p.waitForTimeout(400);
    const home = await p.evaluate(() => /Niveau de difficulté/i.test(document.body.innerText) || /Prendre le ticket/i.test(document.body.innerText));
    if (!home) fails.push('accueil absent pour le profil ' + raw.slice(0, 50));
    const polluted = await p.evaluate(() => ({}).polluted === true);
    if (polluted) fails.push('pollution de prototype via le profil ' + raw.slice(0, 50));
    const started = await p.evaluate(async () => { try { SIM_APP.begin({ level: 1, mode: 'free', seed: '3' }); await new Promise(r => setTimeout(r, 80)); return !!SIM_APP.run; } catch (e) { return 'erreur : ' + e.message; } });
    if (started !== true) fails.push('partie impossible avec le profil ' + raw.slice(0, 50) + ' → ' + started);
    const xss = await p.evaluate(() => !!document.querySelector('img[src="x"]')); if (xss) fails.push('HTML du profil interprété (XSS) pour ' + raw.slice(0, 50));
    await ctx.close();
  }
  console.log(fails.length ? fails.map(x => '✗ ' + x).join('\n') : '✓ ' + BAD.length + ' profils et listes de scénarios corrompus : accueil et partie OK, aucun HTML interprété, aucune pollution');
  console.log(errs.slice(0, 10).join('\n') || 'no errors'); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
