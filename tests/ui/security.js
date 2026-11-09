/* Sécurité : pollution de prototype par chemin, HTML hostile dans une page simulée, limites d'import,
   politique CSP (aucune sortie réseau possible depuis la page). */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Content Security Policy|Refused to connect/i.test(m.text())) errs.push(m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP);
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };

  /* 1. pollution de prototype */
  const pol = await p.evaluate(() => {
    const base = JSON.parse(JSON.stringify(SIM.faults.find(d => d.id === 'dhcp_scope_off')));
    const out = {};
    for (const path of ['PC-01.__proto__.polluted', 'PC-01.constructor.prototype.polluted', 'PC-01.ifaces.__proto__.polluted']) {
      const def = Object.assign({}, base, { id: 'evil_' + Math.abs(path.length), inject: base.inject.concat([{ do: 'set', path, value: true }]) });
      const r = SIM.fault.validate(def); out[path] = r.ok;
    }
    out.polluted = ({}).polluted !== undefined || (Object.prototype).polluted !== undefined;
    return out;
  });
  chk('chemins __proto__/constructor refusés à la validation', !pol['PC-01.__proto__.polluted'] && !pol['PC-01.constructor.prototype.polluted'] && !pol['PC-01.ifaces.__proto__.polluted']);
  chk('Object.prototype intact', pol.polluted === false);

  /* 2. HTML hostile */
  const x = await p.evaluate(() => {
    window.__x = undefined;
    const hostile = '<html><head><script>window.__x=1</script></head><body><img src=x onerror="window.__x=2"><svg onload="window.__x=3"></svg>'
      + '<a href="javascript:window.__x=4" onclick="window.__x=5">lien</a><a href="https://exemple.fr/">ok</a><iframe src="data:text/html,<script>parent.__x=6</script>"></iframe>'
      + '<form action="https://evil"><input name=a></form><p onmouseover="window.__x=7" style="position:fixed">texte</p><h1>Titre</h1></body></html>';
    const box = document.createElement('div'); box.appendChild(SIM.ui.safeHtml(hostile)); document.body.appendChild(box);
    box.querySelectorAll('*').forEach(e => { e.dispatchEvent(new Event('click')); e.dispatchEvent(new Event('mouseover')); });
    const r = { html: box.innerHTML, x: window.__x, tags: Array.from(box.querySelectorAll('*')).map(e => e.tagName) };
    box.remove(); return r;
  });
  await p.waitForTimeout(300);
  chk('aucun script exécuté', x.x === undefined && (await p.evaluate(() => window.__x)) === undefined);
  chk('balises dangereuses retirées', !/script|img|svg|iframe|form|input/i.test(x.tags.join(',')));
  chk('attributs d’événement et style retirés', !/onclick|onerror|onmouseover|onload|style=/i.test(x.html));
  chk('lien javascript: neutralisé, lien https conservé', !/javascript:/i.test(x.html) && /href="https:\/\/exemple\.fr\/"/.test(x.html));
  chk('contenu légitime conservé', /<h1>Titre<\/h1>/.test(x.html) && /texte/.test(x.html));

  /* 3. limites d'import */
  const big = await p.evaluate(() => {
    const base = JSON.parse(JSON.stringify(SIM.faults.find(d => d.id === 'dhcp_scope_off')));
    const huge = Object.assign({}, base, { id: 'enorme', ticket: Object.assign({}, base.ticket, { body: 'x'.repeat(250000) }) });
    const many = Object.assign({}, base, { id: 'beaucoup', inject: Array.from({ length: 400 }, () => ({ do: 'flushdns', dev: 'PC-01' })) });
    return { huge: SIM.fault.validate(huge), many: SIM.fault.validate(many) };
  });
  chk('scénario trop volumineux refusé', !big.huge.ok && /volumineux/.test(big.huge.errors.join()));
  chk('liste d’étapes démesurée refusée', !big.many.ok && /trop d/.test(big.many.errors.join()));

  /* 4. CSP : pas de sortie réseau */
  const csp = await p.evaluate(async () => ({ meta: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), net: await fetch('https://example.com/', { mode: 'no-cors' }).then(() => 'ouvert', () => 'bloqué') }));
  chk('CSP présente', csp.meta);
  chk('fetch externe bloqué', csp.net === 'bloqué');
  /* 5. la CSP interdit eval/Function : l'émulateur ne doit en dépendre nulle part (ex. arithmétique PowerShell) */
  /* exécuté dans le contexte de la page (un évaluateur CDP contournerait la CSP) */
  await p.addScriptTag({ content: `(function () {
    var o = {}; try { Function('return 1')(); o.fnBloque = false; } catch (e) { o.fnBloque = true; }
    try { var W = SIM.buildHealthyWorld({ seed: 1 }); var env = new SIM.emu.Env(W, { act: function () { } });
      var ps = SIM.emu.openWinShell(env, 'PC-01', { elevated: true, user: 'Administrateur' }).exec('powershell').push;
      var r = function (l) { return ps.exec(l).out.map(function (x) { return x.t; }).join('|'); };
      o.somme = r('2+3'); o.div = r('7/2'); o.neg = r('-5+2'); } catch (e) { o.err = String(e); }
    window.__csp = o; })();` });
  const ar = await p.evaluate(() => window.__csp || {});
  const distSrc = require('fs').readFileSync(__dirname + '/../../dist/EDIVN-Lab.html', 'utf8');
  chk('aucun eval( / Function( dans le jeu (la CSP les interdit selon les navigateurs)', !/(^|[^.\w])(eval|Function)\s*\(/.test(distSrc));
  chk('arithmétique PowerShell fonctionnelle sous CSP (2+3, 7/2, -5+2)', ar.somme === '5' && ar.div === '3.5' && ar.neg === '-3');

  console.log(errs.join('\n') || 'no errors'); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
