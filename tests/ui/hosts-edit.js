/* Fichier hosts depuis une session d'utilisateur standard (panne dns_hosts) : les trois chemins qu'un technicien essaie.
   1. Invite de commandes (admin) → « notepad <chemin> » : le Bloc-notes s'ouvre AVEC le contenu du fichier (il s'ouvrait vide).
   2. Explorateur → C:\Windows\System32\drivers\etc → double-clic sur « hosts » (sans extension) : ouvert dans le Bloc-notes.
   3. Menu Démarrer → clic droit sur Bloc-notes → « Exécuter en tant qu'administrateur » → UAC (identifiants tssr) → Fichier/Ouvrir, édition, Ctrl+S : la panne est réparée.
   Bloc-notes NON élevé : l'enregistrement est refusé (comportement réel conservé). */
const L = require('./lib');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
(async () => {
  /* graine qui tire la variante PC-01 / Alice Martin */
  let seed = null;
  { const SIM = require('../load.js')(); for (let i = 0; i < 40 && !seed; i++) { const m = SIM.game.create({ level: 2, mode: 'free', faultId: 'dns_hosts', seed: 'h' + i }); if (m.W.d('PC-01').hostsFile && m.W.d('PC-01').hostsFile.some(x => x.ip === '10.10.10.99')) seed = 'h' + i; } }
  ok(!!seed, 'graine PC-01 trouvée');
  const T = await L.start({ fault: 'dns_hosts', seed, level: 2, dev: 'PC-01', user: 'a.martin', pwd: 'Compta#2026' });
  const { p } = T;
  const desk = () => 'SIM_APP.run.surfaces["PC-01"].desk';
  const uac = async () => {
    for (let i = 0; i < 20; i++) { const u = p.locator('.win.uac'); if (!(await u.count())) { await p.waitForTimeout(100); continue; }
      const t = u.locator('input[type=text]'); if (await t.count()) { await t.first().fill('tssr'); await u.locator('input[type=password]').first().fill('Tssr-2026!'); }
      await u.locator('button.w10btn', { hasText: /^Oui$/ }).first().click(); await p.waitForTimeout(300); return true; }
    return false;
  };
  const npText = () => p.locator('.win.notepad textarea').last().inputValue();
  const closeNp = () => p.evaluate(() => document.querySelectorAll('.win.notepad').forEach(w => { const x = w.querySelector('.wclose, [title=Fermer]'); if (x) x.click(); }));
  ok(await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.user()).then(u => /a\.martin/i.test(u)), 'session ouverte en a.martin');

  /* 1. console admin → notepad <chemin> */
  await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.open('cmd', '', { runas: true })); ok(await uac(), 'UAC présentée pour la console admin');
  const sess = await p.evaluate(() => { const E = SIM.emu; const d = SIM_APP.run.surfaces['PC-01'].desk; const s = E.openWinShell(d.env, 'PC-01', { mode: 'cmd', elevated: true, user: 'tssr', cwd: 'C:\\Windows\\system32' }); const r = s.run('notepad drivers\\etc\\hosts'); d.launch(r.launch, s); return r.launch && r.launch[0].arg; });
  ok(/^C:\\Windows\\system32\\drivers\\etc\\hosts$/i.test(sess || ''), 'notepad : chemin relatif résolu depuis le dossier courant (' + sess + ')');
  await p.waitForTimeout(300);
  ok(/10\.10\.10\.99\s+srv-fic/.test(await npText()), 'notepad lancé depuis la console : le fichier hosts est chargé (plus de document vide)');
  await closeNp(); await p.waitForTimeout(200);

  /* 2. explorateur → hosts sans extension */
  await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.open('explorer', 'C:\\Windows\\System32\\drivers\\etc')); await p.waitForTimeout(400);
  const row = p.locator('.win.active .lvr', { hasText: /^hosts/ }).first();
  ok(await row.count() > 0, 'explorateur : hosts listé'); if (await row.count()) { await row.dblclick(); await p.waitForTimeout(300); }
  ok(/10\.10\.10\.99\s+srv-fic/.test(await npText().catch(() => '')), 'explorateur : double-clic sur hosts → Bloc-notes avec le contenu');
  /* Bloc-notes non élevé : enregistrement refusé */
  await p.locator('.win.notepad textarea').last().press('Control+s'); await p.waitForTimeout(250);
  ok(await p.locator('.win', { hasText: 'Vous n’avez pas l’autorisation d’enregistrer' }).count() > 0, 'Bloc-notes non élevé : enregistrement refusé');
  await p.evaluate(() => document.querySelectorAll('.win').forEach(w => { if (/autorisation d’enregistrer/.test(w.textContent)) { const b = [...w.querySelectorAll('button')].find(x => x.textContent.trim() === 'OK'); if (b) b.click(); } }));
  await p.evaluate(() => { const d = SIM_APP.run.surfaces['PC-01'].desk; Object.values(d.wm.wins || {}).forEach(w => w.close && w.close(true)); }).catch(() => {});
  await p.evaluate(() => document.querySelectorAll('.win.notepad, .win.explorer').forEach(w => w.remove()));

  /* 3. menu Démarrer → clic droit → Exécuter en tant qu'administrateur */
  await p.evaluate(() => SIM_APP.run.surfaces['PC-01'].desk.openStart()); await p.waitForTimeout(200);
  await p.locator('.si', { hasText: /^Bloc-notes$/ }).first().click({ button: 'right' }); await p.waitForTimeout(150);
  const it = p.locator('text=Exécuter en tant qu’administrateur').first(); ok(await it.count() > 0, 'menu Démarrer : « Exécuter en tant qu’administrateur » proposé'); await it.click();
  ok(await uac(), 'UAC : identifiants d’un administrateur demandés'); await p.waitForTimeout(300);
  ok(await p.locator('.win.notepad').count() > 0, 'Bloc-notes élevé ouvert');
  /* Fichier → Ouvrir… dans CE Bloc-notes : dossier etc pré-rempli, nom « hosts » */
  const np = p.locator('.win.notepad').last();
  await np.locator('text=Fichier').first().click(); await p.waitForTimeout(120); await p.locator('text=Ouvrir…').first().click(); await p.waitForTimeout(250);
  const dlg = p.locator('.win', { hasText: 'Regarder dans' }).last(); await dlg.locator('input').nth(1).fill('hosts'); await dlg.locator('button', { hasText: /^Ouvrir$/ }).click(); await p.waitForTimeout(250);
  const ta = p.locator('.win.notepad textarea').last(); const cur = await ta.inputValue();
  ok(/10\.10\.10\.99/.test(cur), 'Bloc-notes élevé : hosts ouvert par Fichier → Ouvrir');
  await ta.fill(cur.split('\n').filter(l => !/10\.10\.10\.99/.test(l)).join('\n')); await ta.press('Control+s'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !(SIM_APP.run.W.d('PC-01').hostsFile || []).some(x => x.ip === '10.10.10.99')), 'Bloc-notes élevé : enregistrement accepté, ligne supprimée');
  ok(!T.errs.length, 'aucune erreur de page' + (T.errs.length ? ' : ' + T.errs.slice(0, 3).join(' | ') : ''));
  await T.b.close();
  console.log(fails ? '✗ ' + fails + ' échec(s)' : '✓ hosts-edit : tout passe'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
