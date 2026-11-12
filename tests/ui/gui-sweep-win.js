/* Balayage GRAPHIQUE des pannes Windows / AD / GPO / DHCP / DNS / IIS / partages : pour chaque panne et chaque variante,
   la correction déclarée (fix) est traduite en gestes dans les VRAIES consoles du bureau (Services, Connexions réseau, DHCP, DNS, ADUC, GPMC,
   pare-feu, IIS, propriétés de fichiers…) pilotées par Playwright, puis la sonde de la panne doit repasser au vert (état « fixed » ou « resolved »).
   Les étapes « client » (renew, relogon, flushdns) sont appliquées par le moteur : elles représentent l'attente du joueur ou une commande déjà couverte
   par les balayages au terminal. Une étape sans recette graphique est signalée « sans recette » (jamais comptée comme réparée).
   Usage : node tests/ui/gui-sweep-win.js [préfixe-de-panne…]    (variable DIST pour changer le build) */
const { chromium } = require('playwright');
const DIST = process.env.DIST || require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy';
const SEEDS = ['7', '11', '29', '101', '4242', '9', '15', '77'];
const FAM = /^(ad|gpo|dhcp|dns|iis|sh|fw|nic|ipv4|web)_/;

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.setDefaultTimeout(6000); await p.goto(DIST); await p.waitForFunction(() => window.SIM_APP);
  /* variantes distinctes par panne (signature des étapes de correction) */
  const plan = await p.evaluate(([seeds, famSrc, only]) => {
    const fam = new RegExp(famSrc); const out = [];
    for (const def of SIM.faults) {
      if (!fam.test(def.id) || (only.length && !only.some(o => def.id.startsWith(o)))) continue;
      const seen = new Set();
      for (const sd of seeds) { const inst = SIM.fault.instantiate(def, sd); const sig = JSON.stringify(inst.fix); if (seen.has(sig)) continue; seen.add(sig); out.push({ id: def.id, level: def.level, seed: sd }); if (seen.size >= 4) break; }
    }
    return out;
  }, [SEEDS, FAM.source, only]);

  /* ------------------------------------------------------------------ aides génériques */
  const logged = new Set();
  const creds = async dev => p.evaluate(d => {
    const W = SIM_APP.run.W; const dd = W.d(d); const dom = dd.win && dd.win.domain ? dd.win.domain.split('.')[0].toUpperCase() : null;
    const v = SIM.VAULT.find(c => c.tags.indexOf('win') >= 0 && dom && c.user.toUpperCase().startsWith(dom + '\\') && /Administrateur$/.test(c.user));
    return v ? { user: v.user, pwd: v.secret } : { user: 'Administrateur', pwd: (SIM.VAULT.find(c => c.user === 'Administrateur') || {}).secret };
  }, dev);
  const goDev = async dev => {
    await p.evaluate(d => SIM_APP.openDev(d, 'main'), dev);
    await p.waitForFunction(d => !!SIM_APP.run.surfaces[d].desk || !!document.querySelector('.logon'), dev, { timeout: 5000 }); await p.waitForTimeout(150);
    if (!logged.has(dev) && await p.$('.logon')) {
      const c = await creds(dev); await p.click('.logon'); await p.waitForTimeout(100);
      /* écran sur la tuile du dernier utilisateur (panne de connexion : il est déconnecté) : « Autre utilisateur » */
      if (!(await p.$('.logon input[type=text]'))) { const o = await p.$('.logon .other'); if (o) { await o.click(); await p.waitForTimeout(120); } }
      await p.fill('.logon input[type=text]', c.user); await p.fill('.logon input[type=password]', c.pwd); await p.keyboard.press('Enter'); await p.waitForTimeout(1700);      /* le domaine refuse l'ouverture (horloge décalée, contrôleur injoignable…) : le technicien passe par le compte LOCAL d'intervention du poste */
      if (await p.$('.logon')) {
        const okb = await p.$('.logon button.go'); if (okb && (await okb.textContent()).trim() === 'OK') { await okb.click(); await p.waitForTimeout(120); }
        if (!(await p.$('.logon input[type=text]'))) { const o = await p.$('.logon .other'); if (o) { await o.click(); await p.waitForTimeout(120); } }
        const loc = await p.evaluate(() => (SIM.VAULT.find(v => v.user === 'tech' && v.tags.indexOf('win') >= 0) || {}).secret);   /* « tech » : compte local d'intervention, administrateur du poste (l'Administrateur local des postes est désactivé) */
        if (await p.$('.logon input[type=text]')) { await p.fill('.logon input[type=text]', '.\\tech'); await p.fill('.logon input[type=password]', loc); await p.keyboard.press('Enter'); await p.waitForTimeout(1700); }
      }
    }
    logged.add(dev);
    return await p.evaluate(d => !!SIM_APP.run.surfaces[d].desk, dev);
  };
  const openApp = async (dev, app, arg) => {
    if (!(await goDev(dev))) { const e = new Error('logon'); e.noLogon = true; throw e; } curDev = dev;
    const ok = await p.evaluate(([d, a, ar]) => { const desk = SIM_APP.run.surfaces[d].desk; return !!desk.open(a, ar || ''); }, [dev, app, arg]);
    await uac(); await p.waitForTimeout(350);
    const open = await p.evaluate(([d, a]) => { const x = SIM_APP.run.surfaces[d].desk.apps[a]; return !!(x && !x.closed); }, [dev, app]);
    if (!ok && !open) throw new Error('console « ' + app + ' » non ouverte sur ' + dev);
  };
  const top = () => p.locator('.win.active').last();
  const closeTop = async () => { const w = top(); if (await w.count()) { const c = w.locator('.wb.cls').first(); if (await c.count()) await c.click(); } await p.waitForTimeout(80); };
  const closeAll = async () => { for (let i = 0; i < 12; i++) { const n = await p.locator('.win').count(); if (!n) break; const c = p.locator('.win .wb.cls').last(); try { await c.click({ timeout: 800 }); } catch (e) { break; } await p.waitForTimeout(60); } };
  const btn = async (label, scope) => { const s = scope || p.locator('.win.active').last(); await s.locator('button.w10btn', { hasText: new RegExp('^' + label + '$') }).first().click(); await p.waitForTimeout(150); };
  const treeSel = async (label, scope) => { const s = scope || p.locator('.win.active').last(); await s.locator('.tvr', { has: p.locator('.tvl', { hasText: label }) }).first().click(); await p.waitForTimeout(160); };
  const treeOpenCtx = async (label) => { const s = p.locator('.win.active').last(); await s.locator('.tvr', { has: p.locator('.tvl', { hasText: label }) }).first().click({ button: 'right' }); await p.waitForTimeout(120); };
  const menuClick = async label => { await p.locator('.ctx .ctxi', { has: p.locator('.lb', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).first().click(); await p.waitForTimeout(150); };
  const action = async label => {
    const w = p.locator('.win.active').last(); const exact = w.locator('.mmcact .acti', { hasText: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') });
    await (await exact.count() ? exact : w.locator('.mmcact .acti', { hasText: label })).first().click(); await p.waitForTimeout(200);
  };
  const row = async (text, scope) => (scope || p.locator('.win.active').last()).locator('.lvr', { hasText: text }).first();
  const setIp = async (box, val) => { const ins = box.locator('input'); const parts = String(val || '').split('.'); for (let i = 0; i < 4; i++) { await ins.nth(i).fill(parts[i] === undefined ? '' : parts[i]); } };
  const confirmYes = async () => { const d = p.locator('.win.active').last(); const y = d.locator('button', { hasText: /^(Oui|OK)$/ }).first(); if (await y.count()) { await y.click(); await p.waitForTimeout(250); } };
  const waitProgress = async () => { for (let i = 0; i < 40; i++) { if (!(await p.locator('.win:has(.wtitle:text-is("Contrôle de service"))').count())) return; await p.waitForTimeout(100); } };
  let curDev = null;
  const uac = async () => {   /* boîte « Contrôle de compte d'utilisateur » : identifiants d'administrateur du domaine (comme un technicien qui s'élève) */
    for (let i = 0; i < 6; i++) {
      const u = p.locator('.win.uac'); if (!(await u.count())) { await p.waitForTimeout(80); continue; }
      const t = u.locator('input[type=text]'); if (await t.count()) { const loc = await p.evaluate(() => SIM.VAULT.find(c => c.user === 'tech' && c.tags.indexOf('win') >= 0)); const c = loc ? { user: loc.user, pwd: loc.secret } : await creds(curDev); await t.first().fill(c.user); await u.locator('input[type=password]').first().fill(c.pwd); }
      await u.locator('button.w10btn', { hasText: /^Oui$/ }).first().click(); await p.waitForTimeout(300); if (await p.locator('.win.uac').count()) throw new Error('UAC refusé : ' + (await p.locator('.uacerr').first().innerText())); return;
    }
  };
  /* connexion MMC distante depuis un poste d'administration (quand l'ouverture de session sur le serveur est impossible) */
  const remote = async (viaDev, app, targetDev) => {
    await openApp(viaDev, app);
    const ip = await p.evaluate(d => { const dd = SIM_APP.run.W.d(d); const n = Object.keys(dd.ifaces)[0]; return dd.ifaces[n].ip; }, targetDev);
    await p.locator('.win.active').last().locator('.mbar-item', { hasText: /^Action$/ }).click(); await p.waitForTimeout(100);
    await p.locator('.ctx .ctxi', { has: p.locator('.lb', { hasText: 'Se connecter à un autre ordinateur…' }) }).first().click(); await p.waitForTimeout(200);
    const dlg = p.locator('.win.active').last(); await dlg.locator('label.chk', { hasText: 'Un autre ordinateur' }).locator('input').check(); await dlg.locator('input[type=text]').first().fill(ip);
    await dlg.locator('button.w10btn', { hasText: /^OK$/ }).first().click(); await p.waitForTimeout(400);
  };
  const T = { foreign: [], remote, uac, setDev: d => { curDev = d; }, p, goDev, openApp, top, closeAll, closeTop, btn, treeSel, treeOpenCtx, menuClick, action, row, setIp, confirmYes, waitProgress };

  /* ------------------------------------------------------------------ recettes : une par type d'étape / chemin du modèle */
  const R = require('./gui-recipes-win.js')(T);

  const fails = []; const noRecipe = {}; const gaps = []; let n = 0; let okN = 0; let nSteps = 0, nRec = 0;
  const PEN = process.env.GS_PENALTY || '';
  const BREAK = process.env.GS_BREAK || '';   /* crochet de neutralisation (tests/ui/gui-sweep-neutral.js) : la recette de cette panne n'est pas jouée, le balayage doit virer au rouge */
  /* écarts de contenu CONNUS et documentés (docs/LIMITES.md, DECISIONS-PROPOSEES) : aucune console ni commande du simulateur ne réalise cette réparation */
  const KNOWN_GAP = st => /\.win\.secureChannel$/.test(String(st.path || ''));
  for (const it of plan) {
    const e0 = errs.length; logged.clear();
    await closeAll();
    const info = await p.evaluate(async ([fid, sd, lvl]) => {
      SIM_APP.begin({ level: lvl, mode: 'free', seed: sd, faultId: fid, profile: { name: 'T', done: {}, skills: {}, badges: [], history: [], best: {} } });
      await new Promise(r => setTimeout(r, 120)); const run = SIM_APP.run; return { fix: run.m.parts[0].fix };
    }, [it.id, it.seed, it.level]);
    const tag = it.id + ' graine ' + it.seed; n++;
    const missing = []; let err = null; let gap = false;
    try {
      T.fixSteps = info.fix; T.skipStep = null;
      for (const st of info.fix) {
        if (KNOWN_GAP(st)) { gap = true; continue; }
        nSteps++; const rec = R.find(st);
        if (!rec) { missing.push(JSON.stringify(st).slice(0, 110)); continue; }
        nRec++; if (BREAK && it.id === BREAK) continue;
        await rec.run(st); await closeAll();
      }
    } catch (e) { await p.screenshot({ path: require('os').tmpdir() + '/gs-' + it.id + '.png' }).catch(() => { }); err = e.message.split('\n').slice(0, 4).join(' ¦ ').slice(0, 420); }
    if (PEN && it.id === PEN) await p.evaluate(() => { SIM.win.setSvc(SIM_APP.run.W, 'PC-ADM', 'NlaSvc', 'stopped'); SIM_APP.run.m.act({ kind: 'ui', dev: 'PC-ADM', text: 'arrêt de service injecté par le crochet de neutralisation', mutates: true, impact: 'svc-stop' }); });   /* crochet (tests/ui/gui-sweep-neutral.js) : un impact passe par la vraie mission, le balayage doit le voir. Depuis la règle « par le résultat » (30/10/2026) le service est RÉELLEMENT arrêté et reste arrêté : un tag sans changement d'état ne coûte plus rien */
    if (missing.length) missing.forEach(m => { noRecipe[m.replace(/\d+/g, 'N').slice(0, 80)] = (noRecipe[m.replace(/\d+/g, 'N').slice(0, 80)] || 0) + 1; });
    if (gap) { gaps.push(tag); process.stdout.write('g'); continue; }
    const st = await p.evaluate(() => { const run = SIM_APP.run; const rt = SIM.fault.evaluate(run.W, run.m.parts[0], run.m.base); return { status: rt.status, why: (rt.probes || []).filter(x => !x.ok).map(x => x.why).join(' | ').slice(0, 160), pen: run.m.dangers.map(x => 'danger ' + x.id + ' (' + x.text + ')').concat(run.m.impacts.map(x => 'impact ' + x.kind + ' (' + x.text + ')')).join(' ; ') }; });
    /* D-109 : un chemin de résolution déclaré ne coûte aucun malus de danger ni d'impact */
    const good = !err && !missing.length && ['fixed', 'resolved', 'workaround'].indexOf(st.status) >= 0 && st.status !== 'workaround' && !st.pen;
    if (!good && process.env.GS_DEBUG) console.log('\n[debug ' + tag + '] ' + JSON.stringify(await p.evaluate(e => (0, eval)(e), process.env.GS_DEBUG)).slice(0, 700));
    if (!good && !err) await p.screenshot({ path: require('os').tmpdir() + '/gs-' + it.id + '.png' }).catch(() => { });
    if (good) okN++; else fails.push(tag + ' : ' + (err ? 'erreur ' + err : '') + (missing.length ? ' sans recette ' + missing.length : '') + (!err && !missing.length ? ' statut ' + st.status + ' ' + st.why : '') + (st.pen ? ' malus sur un chemin déclaré : ' + st.pen : ''));
    if (errs.length > e0) fails.push(tag + ' : erreurs de page ' + errs.slice(e0).join(' | ').slice(0, 200));
    process.stdout.write(good ? '.' : 'x'); if (n % 40 === 0) process.stdout.write(' ' + n + '/' + plan.length + '\n');
  }
  console.log('\n' + plan.length + ' combinaisons graphiques, ' + okN + ' réparées par les consoles, ' + (plan.length - okN - gaps.length) + ' à reprendre, ' + gaps.length + ' écart(s) de contenu connu(s)');
  gaps.forEach(g2 => console.log('  ~ écart connu (irréparable par le joueur : aucune console ni commande ne modifie le canal sécurisé) : ' + g2));
  fails.forEach(f => console.log('  ✗ ' + f));
  console.log(nSteps + ' étapes de correction, ' + nRec + ' avec recette graphique, ' + (nSteps - nRec) + ' sans recette (dette D-98)');
  const nr = Object.keys(noRecipe); if (nr.length) { console.log('Étapes sans recette graphique :'); nr.forEach(k => console.log('  - ' + k + ' (×' + noRecipe[k] + ')')); }
  if (T.foreign.length) console.log(T.foreign.length + ' étape(s) sur équipement non Windows appliquée(s) par le moteur (réparation au terminal : cli-sweep-ios / cli-sweep-lx)');
  console.log(errs.slice(0, 10).join('\n') || 'aucune erreur de page');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
