/* Baie de brassage : comme en vrai, les ports du commutateur n'ont pas d'étiquette (la correspondance prise → port est dans
   la Fiche de l'infra → Brassage, ou en console) ; seul le panneau de brassage porte le numéro de prise.
   Un port dont le cordon de brassage a été débranché s'affiche « libre ». */
const L = require('./lib.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const t = await L.start({ fault: 'phys_wall', dev: 'PC-01', seed: '7' }); const p = t.p;
  await p.evaluate(() => SIM_APP.openDev('PATCH-T', 'patch')); await p.waitForTimeout(400);
  const fa2 = await p.getAttribute('.rpc[data-port="SW-T2:FastEthernet0/2"]', 'title');
  const all = await p.$$eval('.rpc', els => els.map(e => e.title).join('\n'));
  ok(!/étiquette|PC-01 \(prise/.test(all), 'aucun port de commutateur ne porte d’étiquette ni de description');
  ok(/— libre$/.test(fa2) && !/câble vers/.test(fa2), 'Fa0/2 de SW-T2 (cordon débranché) : affiché libre — ' + fa2);
  ok(await p.locator('.rpj2 .rwid:text-is("T-114")').count() === 1, 'le panneau de brassage porte le numéro de prise T-114');
  await p.click('.rpj2:has(.rwid:text-is("T-114"))'); await p.click('.ctx .ctxi:has-text("Brasser cette prise")'); await p.waitForTimeout(200);
  await p.click('.rpc[data-port="SW-T2:FastEthernet0/2"]'); await p.click('.ctx .ctxi:has-text("Brasser la prise T-114 sur Fa0/2")'); await p.waitForTimeout(400);
  const fa2b = await p.getAttribute('.rpc[data-port="SW-T2:FastEthernet0/2"]', 'title');
  ok(/câble vers cordon de brassage T-114$/.test(fa2b), 'après re-brassage : Fa0/2 occupé par le cordon T-114 — ' + fa2b);
  ok(!t.errs.length, 'aucune erreur JavaScript' + (t.errs.length ? ' — ' + t.errs[0] : ''));
  await t.b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : 'tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
