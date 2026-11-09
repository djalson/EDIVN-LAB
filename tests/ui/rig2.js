/* Test E2E : pannes de couche 1 réparées uniquement par la vue physique, puis vérifiées depuis le poste. */
const T = require('./lib.js');
const st = (t) => t.p.evaluate(() => JSON.stringify(SIM_APP.run.m.parts.map(x => x.rt && x.rt.status)));
const menuClick = async (p, label) => { await p.click('.ctx .ctxi:has-text("' + label + '")'); await p.waitForTimeout(250); };
const CASES = {
  phys_eth: async (t, p) => { await p.click('.rigplug.loose'); await menuClick(p, 'Rebrancher le câble réseau'); },
  phys_power: async (t, p) => { await p.click('.rstrip .rsw'); await p.waitForTimeout(300); },
  phys_screen: async (t, p) => { await p.click('.rigplug.loose'); await menuClick(p, 'Rebrancher le câble vidéo'); },
  phys_mon: async (t, p) => { await p.click('.rmb.pw'); await p.waitForTimeout(300); },
  phys_source: async (t, p) => { await p.click('.rmb:has-text("MENU")'); await p.click('.rmb:has-text("▼")'); await p.click('.rmb:has-text("▼")'); await p.click('.rmb:has-text("OK")'); await p.click('.rmb:has-text("▲")'); await p.click('.rmb:has-text("OK")'); await p.waitForTimeout(300); },
  phys_wall: async (t, p) => { await p.evaluate(() => SIM_APP.openDev('PATCH-T', 'patch')); await p.waitForTimeout(400); await p.click('.rpj2:has(.rwid:text-is("T-114"))'); await menuClick(p, 'Brasser cette prise'); await p.click('.rpc[data-port="SW-T2:FastEthernet0/2"]'); await menuClick(p, 'Brasser la prise T-114 sur Fa0/2'); },
  phys_patch: async (t, p) => { await p.evaluate(() => SIM_APP.openDev('PATCH-T', 'patch')); await p.waitForTimeout(400); await p.click('.rpj2:has(.rwid:text-is("T-114"))'); await menuClick(p, 'Brasser cette prise'); await p.click('.rpc[data-port="SW-T2:FastEthernet0/2"]'); await menuClick(p, 'Brasser la prise T-114 sur Fa0/2'); }
};
(async () => {
  const fault = process.argv[2]; const seed = process.argv[3] || '7';
  const dev = fault === 'phys_wall' || fault === 'phys_patch' ? 'PC-01' : 'PC-01';
  const t = await T.start({ fault, dev, seed }); const p = t.p;
  const host = await p.evaluate(() => SIM_APP.run.m.parts[0].cause);
  console.log(fault, '|', host.slice(0, 90));
  const target = await p.evaluate(() => (SIM_APP.run.m.parts[0].vars && SIM_APP.run.m.parts[0].vars.c && SIM_APP.run.m.parts[0].vars.c.host) || 'PC-01');
  console.log('host', target);
  if (target !== 'PC-01') { await p.evaluate(h => SIM_APP.openDev(h, 'main'), target); }
  if (fault !== 'phys_wall' && fault !== 'phys_patch') await p.evaluate(h => SIM_APP.openDev(h, 'rig'), target);
  await p.waitForTimeout(500);
  await CASES[fault](t, p); await p.waitForTimeout(400);
  console.log('après geste:', await st(t));
  await t.shot('rig2_' + fault);
  // vérification depuis le poste : écran + connexion + ping
  await p.evaluate(h => SIM_APP.openDev(h, 'main'), target); await p.waitForTimeout(3500);
  const logon = await p.$('.logon'); if (logon) { await p.click('.logon'); await p.waitForTimeout(200); let ti = await p.$('.logon input[type=text]'); if (!ti) { await p.click('.logon .other'); await p.waitForTimeout(200); } await p.fill('.logon input[type=text]', 'TOULOUSE\\Administrateur'); await p.fill('.logon input[type=password]', 'Adm!n2026'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
  await p.evaluate(h => { SIM_APP.run.surfaces[h].desk && SIM_APP.run.surfaces[h].desk.openTerminal('cmd', true); }, target); await p.waitForTimeout(500);
  if (fault === 'phys_patch') { await p.keyboard.type('ipconfig /renew'); await p.keyboard.press('Enter'); await p.waitForTimeout(3500); }
  await p.keyboard.type('ping 10.10.10.10'); await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
  console.log('après ping:', await st(t)); console.log((await p.evaluate(() => Array.from(document.querySelectorAll('.term')).map(x => x.innerText).join('\n----\n'))).slice(-900));
  console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
})();
