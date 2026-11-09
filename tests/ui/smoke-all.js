/* Fumée : ouvre chaque appareil (écran + vue physique) et chaque application Windows sur chaque poste, sans erreur JS. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP);
  for (const fault of (process.argv.slice(2).length ? process.argv.slice(2) : ['phys_eth', 'ad_locked', 'c_vlan_port'])) {
    await p.evaluate(f => SIM_APP.begin({ level: 1, mode: 'free', seed: '7', faultId: f }), fault); await p.waitForTimeout(300);
    const ids = await p.evaluate(() => Object.keys(SIM_APP.run.W.dev));
    for (const id of ids) {
      for (const what of ['main', 'rig']) { await p.evaluate(([i, w]) => SIM_APP.openDev(i, w), [id, what]); await p.waitForTimeout(80); }
      const kind = await p.evaluate(i => SIM_APP.run.W.d(i).kind, id);
      if (kind === 'win') {
        await p.evaluate(i => SIM_APP.openDev(i, 'main'), id); await p.waitForTimeout(150);
        const res = await p.evaluate(async (i) => {
          const s = SIM_APP.run.surfaces[i]; const out = [];
          if (!s.desk) { try { SIM.ad.sessionStart(SIM_APP.run.W, i, 'Administrateur', { token: [] }); s.showDesk(); } catch (e) { return ['nodesk ' + e.message]; } }
          const d = s.desk; if (!d) return ['nodesk'];
          for (const app of Object.keys(SIM.ui.apps)) { try { const w = d.open(app, '', { elevated: true }); await new Promise(r => setTimeout(r, 40)); if (w && w.close) w.close(true); document.querySelectorAll('.uac').forEach(x => x.remove()); } catch (e) { out.push(app + ': ' + e.message); } }
          return out;
        }, id);
        if (res.length) errs.push(id + ' apps: ' + res.join(' | '));
      }
    }
    console.log(fault, 'ok', ids.length, 'appareils');
  }
  console.log(errs.slice(0, 30).join('\n') || 'no errors'); await b.close();
})();
