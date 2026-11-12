/* « Signaler un bug » : bouton de la barre de partie → rapport copiable (journal lisible, données techniques encodées, cause non affichée en clair). */
const L = require('./lib');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const T = await L.start({ fault: 'dns_cache', seed: 'br', level: 1, dev: 'PC-01' }); const { p } = T;
  await p.evaluate(() => SIM_APP.run.act('PC-01', 'ipconfig /displaydns', { kind: 'cmd', mutates: false }));
  ok(await p.locator('.gbar .gbug').count() === 1, 'bouton présent dans la barre de partie');
  await p.locator('.gbar .gbug').click(); await p.waitForTimeout(200);
  await p.locator('.modal .brta').fill('Le ticket se ferme tout seul.');
  const txt = await p.evaluate(() => SIM.ui.bugreport.text(SIM_APP.run, document.querySelector('.brta').value));
  ok(/Rapport de bug EDIVN Lab/.test(txt) && /Le ticket se ferme tout seul\./.test(txt) && /ipconfig \/displaydns/.test(txt), 'rapport : en-tête, remarque et journal lisibles');
  ok(!/dns_cache|Cache DNS du poste obsolète|10\.10\.10\.200/.test(txt), 'rapport : la cause de la panne n’apparaît pas en clair');
  const blob = txt.split('Données techniques (ne pas modifier) :\n')[1].split('\n=== fin')[0];
  const d = await p.evaluate(b => SIM.ui.bugreport.decode(b), blob);
  ok(d.seed === 'br' && d.faults[0].id === 'dns_cache' && d.parts[0].probes.length > 0 && d.status === 'active', 'données techniques décodables : graine, panne, sondes, statut');
  await p.locator('.modal button', { hasText: 'Copier le rapport' }).click(); await p.waitForTimeout(300);
  ok(await p.locator('.modal').count() === 0, 'fenêtre refermée après copie');
  ok(!T.errs.length, 'aucune erreur de page' + (T.errs.length ? ' : ' + T.errs.join(' | ') : ''));
  await T.b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ bugreport : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
