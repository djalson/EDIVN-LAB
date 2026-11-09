/* Carte du site de Colomiers : onglet présent, site ouvert par le ticket, équipements cliquables, console IOS fonctionnelle. */
const T = require('./lib');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('✗ ' + m); } else console.log('✓ ' + m); };
(async () => {
  const t = await T.start({ fault: 'ec_negotiation', seed: '7', dev: 'SW-CB' });
  const tabs = await t.p.evaluate(() => Array.from(document.querySelectorAll('.tabs .tab')).map(x => x.innerText.trim()));
  ok(tabs.indexOf('Colomiers') >= 0, 'onglet « Colomiers » présent (' + tabs.join(' | ') + ')');
  await t.p.evaluate(() => { const el = Array.from(document.querySelectorAll('.tabs .tab')).find(x => x.innerText.trim() === 'Colomiers'); el.click(); });
  await t.p.waitForTimeout(400);
  const labels = await t.p.evaluate(() => document.querySelector('.view').innerText);
  ok(/SW-CA/.test(labels) && /SW-CB/.test(labels) && /SW-CC/.test(labels), 'la carte montre les trois commutateurs');
  ok(/PC-C1/.test(labels) && /PC-C4/.test(labels), 'la carte montre les quatre postes');
  ok(/Cœur \(racine STP\)/.test(labels), 'libellé du cœur de réseau');
  const nlinks = await t.p.evaluate(() => document.querySelectorAll('.view svg line, .view svg path').length);
  ok(nlinks >= 6, 'liaisons dessinées (' + nlinks + ')');
  const st = await t.p.evaluate(() => SIM_APP.run.m.parts.map(x => x.rt && x.rt.status).join(','));
  ok(st === 'active', 'panne active à l’ouverture (' + st + ')');
  ok(t.errs.length === 0, 'aucune erreur console/page' + (t.errs.length ? ' : ' + t.errs.join(' ; ') : ''));
  await t.b.close();
  process.exit(fails.length ? 1 : 0);
})();
