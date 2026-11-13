/* Bureau Windows : icônes cliquables, menus contextuels affichés là où on clique (bureau placé à droite du panneau du ticket),
   « Ouvrir avec → Bloc-notes » sur un fichier texte de l'explorateur, et redémarrage qui revient à l'écran de connexion (plus de roue figée). */
const L = require('./lib');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  const T = await L.start({ fault: 'dns_hosts', seed: 'h3', level: 2, dev: 'PC-01', user: 'a.martin', pwd: 'Compta#2026' }); const { p } = T;
  await p.evaluate(() => window.SIM_NO_UNLOAD_PROMPT = 1);
  const closeAll = () => p.evaluate(() => { const d = SIM_APP.run.surfaces['PC-01'].desk; document.querySelectorAll('.desk .win .wb.cls').forEach(b => b.click()); });
  for (const [name, cls] of [['Ce PC', 'explorer'], ['Navigateur', 'browser'], ['Invite de commandes', '']]) {
    const n0 = await p.locator('.desk .win').count(); await p.locator('.dicon', { hasText: name }).dblclick({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400);
    ok(await p.locator('.desk .win').count() > n0, 'double-clic sur l’icône « ' + name + ' » : une fenêtre s’ouvre'); await closeAll(); await p.waitForTimeout(200); }
  /* clic droit sur le bureau */
  const wall = await p.locator('.desk .wall').boundingBox(); const wx = wall.x + 400, wy = wall.y + 200;
  await p.mouse.click(wx, wy, { button: 'right' }); await p.waitForTimeout(200);
  let m = await p.locator('.ctx.top').boundingBox(); ok(m && Math.abs(m.x - wx) < 6 && Math.abs(m.y - wy) < 6, 'clic droit sur le bureau : menu sous le pointeur (' + (m && Math.round(m.x - wx)) + ', ' + (m && Math.round(m.y - wy)) + ')'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  /* clic droit sur Démarrer : menu au-dessus du bouton, collé à lui */
  const sb = await p.locator('.desk .startb').boundingBox(); await p.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2, { button: 'right' }); await p.waitForTimeout(200);
  m = await p.locator('.ctx.top').boundingBox(); const deskBox = await p.locator('.desk').boundingBox();
  ok(m && m.x >= sb.x - 4 && m.x < sb.x + sb.width + 4 && m.y + m.height <= sb.y + sb.height / 2 + 4 && m.y > deskBox.y, 'clic droit sur Démarrer : menu au-dessus du bouton, dans le bureau (x ' + (m && Math.round(m.x - sb.x)) + ', bas ' + (m && Math.round(m.y + m.height - sb.y)) + ')');
  ok(/Invite de commandes \(admin\)/.test(await p.locator('.ctx.top').innerText()), 'menu Démarrer : « Invite de commandes (admin) » présent'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  /* explorateur : clic droit sur hosts */
  await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.open('explorer', 'C:\\Windows\\System32\\drivers\\etc')); await p.waitForTimeout(400);
  const row = p.locator('.win.active .lvr', { hasText: /^hosts/ }).first(); const rb = await row.boundingBox(); await p.mouse.click(rb.x + 30, rb.y + rb.height / 2, { button: 'right' }); await p.waitForTimeout(200);
  m = await p.locator('.ctx.top').boundingBox(); ok(m && Math.abs(m.x - (rb.x + 30)) < 6, 'explorateur : menu du clic droit sous le pointeur');
  await p.locator('.ctx.top .ctxi', { hasText: 'Ouvrir avec' }).hover(); await p.waitForTimeout(150); await p.locator('.ctx.sub .ctxi', { hasText: 'Bloc-notes' }).click(); await p.waitForTimeout(300);
  ok(/localhost name resolution/.test(await p.locator('.win.notepad textarea').last().inputValue().catch(() => '')), 'explorateur : « Ouvrir avec → Bloc-notes » ouvre hosts');
  await closeAll(); await p.waitForTimeout(200);
  /* redémarrage : l'écran de connexion n'est plus caché sous la roue */
  await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.restart()); await p.waitForTimeout(200); await p.locator('.win button', { hasText: /^Redémarrer$/ }).first().click(); await p.waitForTimeout(3800);
  const vis = await p.evaluate(() => { const l = document.querySelector('.logon'); if (!l) return 'pas d’écran de connexion'; const r = l.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t && t.closest('.bootscr') ? 'roue par-dessus' : 'visible'; });
  ok(vis === 'visible', 'redémarrage : écran de connexion visible après le démarrage (' + vis + ')');
  ok(!T.errs.length, 'aucune erreur de page' + (T.errs.length ? ' : ' + T.errs.join(' | ') : ''));
  await T.b.close(); console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ desk-clicks : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
