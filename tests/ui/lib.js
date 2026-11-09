/* Aides communes aux tests de l'interface Windows (Chromium / Playwright). */
const { chromium } = require('playwright');
exports.start = async function (opts) {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP);
  await p.evaluate(o => SIM_APP.begin({ level: o.level || 1, mode: 'free', seed: o.seed || '7', faultId: o.fault }), opts);
  await p.evaluate(o => SIM_APP.openDev(o.dev, 'main'), opts); await p.waitForTimeout(500);
  if (opts.user) {
    const needLogon = await p.$('.logon'); if (needLogon) { await p.click('.logon'); await p.waitForTimeout(150); await p.fill('.logon input[type=text]', opts.user); await p.fill('.logon input[type=password]', opts.pwd); await p.keyboard.press('Enter'); await p.waitForTimeout(2000); }
  }
  const ev = (fn, arg) => p.evaluate(fn, arg);
  return { b, p, errs, ev, shot: (n) => p.screenshot({ path: require('os').tmpdir() + '/' + n + '.png' }), open: (app, arg) => p.evaluate(([dev, a, ar]) => { const d = SIM_APP.run.surfaces[dev].desk; return !!d.open(a, ar); }, [opts.dev, app, arg || '']), desk: (fn, arg) => p.evaluate(([dev, f, a]) => { const d = SIM_APP.run.surfaces[dev].desk; return (new Function('d', 'a', 'return (' + f + ')(d,a)'))(d, a); }, [opts.dev, fn.toString(), arg]) };
};
