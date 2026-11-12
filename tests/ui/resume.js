/* Ticket interrompu : après un rechargement de page en pleine partie, l'accueil propose de reprendre le même ticket, chronomètre conservé. */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());   /* confirmation « quitter la page » du navigateur */
  const url = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href;
  await p.goto(url); await p.waitForFunction(() => window.SIM_APP); await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.remove()); const pr = SIM.game.profile(); pr.tourDone = true; SIM.game.saveProfile(pr); });
  await p.evaluate(() => SIM_APP.begin({ level: 1, mode: 'free', seed: 'rs1', faultId: 'dns_cache' })); await p.waitForTimeout(400);
  const id = await p.evaluate(() => SIM_APP.run.id);
  await p.evaluate(() => { SIM_APP.run.m.startMs -= 95000; }); await p.waitForTimeout(200);
  await p.reload(); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(500);
  const txt = await p.locator('.modal').first().innerText().catch(() => '');
  ok(/Ticket interrompu/.test(txt) && txt.indexOf(id) >= 0, 'après rechargement : l’accueil propose de reprendre ' + id);
  await p.locator('.modal button', { hasText: 'Reprendre le ticket' }).click(); await p.waitForTimeout(500);
  const st = await p.evaluate(() => ({ id: SIM_APP.run && SIM_APP.run.id, el: SIM_APP.run && SIM_APP.run.m.elapsedSec(), fault: SIM_APP.run && SIM_APP.run.m.fault.id }));
  ok(st.id === id && st.fault === 'dns_cache', 'même ticket repris'); ok(st.el >= 90 && st.el < 130, 'chronomètre conservé (' + Math.round(st.el) + ' s)');
  /* retour volontaire à l'accueil : plus rien à reprendre */
  await p.evaluate(() => SIM_APP.home()); await p.waitForTimeout(200); await p.reload(); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(400);
  ok(!/Ticket interrompu/.test(await p.locator('body').innerText()), 'après un retour volontaire à l’accueil : aucune proposition');
  ok(!errs.length, 'aucune erreur de page' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ resume : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
