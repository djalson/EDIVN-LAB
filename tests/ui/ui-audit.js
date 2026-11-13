/* ============================================================================
   Audit graphique automatique (interface V3) : parcourt les écrans comme un joueur et repère les défauts du genre
   « icônes non cliquables », « menu du clic droit décalé », « roue de démarrage restée par-dessus ».
   Pour chaque écran :
   1. Clic : chaque élément interactif visible (bouton, icône, ligne, onglet, case…) reçoit-il le clic en son centre,
      ou un autre élément le recouvre-t-il ?
   2. Menus du clic droit : le menu s'ouvre-t-il sous le pointeur, dans l'écran ?
   3. Fenêtres : une fenêtre qui s'ouvre tient-elle dans le bureau, avec sa barre de titre et son bouton Fermer accessibles ?
   4. Écrans bloqués : après connexion, verrouillage, redémarrage, l'écran attendu est-il au premier plan ?
   5. Débordements : texte coupé dans un bouton, défilement horizontal de la page.
   Couverture : accueil (3 onglets) et fenêtres de l'accueil, partie (carte, barre, panneau), bureaux Windows 10 et Windows Server
   avec toutes leurs applications, console Linux, console Cisco, pfSense, poste physique.
   Sortie : liste des anomalies, captures dans tests/.audit/, rapport docs/AUDIT-UI.md. Code retour ≠ 0 s'il y a une anomalie.
   Usage : node tests/ui/ui-audit.js [--only=<morceau d'étape>]
   ============================================================================ */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..'); const OUT = path.join(__dirname, '..', '.audit'); fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).toLowerCase();
const issues = []; let steps = 0, checked = 0, menus = 0, wins = 0;

/* ---------------------------------------------------------------- contrôles exécutés dans la page */
const PAGE_FN = () => {
  const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button], .dicon, .si, .tbtn, .ti, .ri, .lvr, .tvr, .acti, .mbar-item, .node, .wb, .ttab, .btn, .cnavb, .credtab, .pgtab, .evopt, .fopt, .hhist, .tab, .lvh';
  const label = el => { const t = (el.getAttribute('aria-label') || el.title || el.textContent || el.value || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 50); return (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + (t ? ' « ' + t + ' »' : ''); };
  /* zone réellement visible d'un élément : coupée par ses ancêtres qui défilent ou masquent */
  const visibleRect = el => {
    let r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null;
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return null;
      if (a.tagName === 'DETAILS' && !a.open && !el.closest('summary')) return null;
      if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible') { const q = a.getBoundingClientRect(); x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom); }
    }
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0 || s.pointerEvents === 'none') return null;
    x1 = Math.max(x1, 0); y1 = Math.max(y1, 0); x2 = Math.min(x2, innerWidth); y2 = Math.min(y2, innerHeight);
    if (x2 - x1 < 4 || y2 - y1 < 4) return null; return { x1, y1, x2, y2 };
  };
  window.__audit = {
    /* éléments interactifs du calque du dessus (fenêtre modale ouverte → seulement elle) */
    clicks(rootSel) {
      let root = rootSel ? document.querySelector(rootSel) : document.body; if (!root) return { n: 0, bad: [] };
      const ov = [...document.querySelectorAll('.overlay')].filter(o => getComputedStyle(o).display !== 'none'); if (ov.length && !rootSel) root = ov[ov.length - 1];
      const bad = []; let n = 0;
      root.querySelectorAll(SEL).forEach(el => {
        if (el.disabled || el.closest('[disabled], .dis, .ctx')) return; const v = visibleRect(el); if (!v) return; n++;
        const cx = (v.x1 + v.x2) / 2, cy = (v.y1 + v.y2) / 2; const hit = document.elementFromPoint(cx, cy);
        if (!hit || el === hit || el.contains(hit)) return;
        /* recouvert par un calque légitimement au-dessus (fenêtre, menu, panneau Démarrer, notification) : normal. Ce qui compte : un élément
           recouvert par quelque chose de SON propre calque, ou par un élément sans calque (la zone des fenêtres qui couvrait les icônes) */
        const LAYER = '.win, .ctx, .overlay, .flyout, .startmenu, .toasts, .tcard, .tshade, .pop';
        const lh = hit.closest(LAYER), le = el.closest(LAYER); if (lh && lh !== le && !lh.contains(el)) return;
        if (hit.contains(el) && getComputedStyle(el).pointerEvents !== 'none') return;   /* l'élément est dans le cible (ex. libellé dans un bouton) */
        if (el.tagName === 'INPUT' && hit.tagName === 'LABEL' && hit.contains(el)) return;
        bad.push({ el: label(el), by: label(hit), x: Math.round(cx), y: Math.round(cy) });
      });
      return { n, bad };
    },
    /* texte coupé dans un bouton, défilement horizontal de la page */
    overflow(rootSel) {
      const root = rootSel ? document.querySelector(rootSel) : document.body; const bad = [];
      if (!rootSel && document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) bad.push({ el: 'page', why: 'défilement horizontal (' + document.documentElement.scrollWidth + ' px pour ' + document.documentElement.clientWidth + ')' });
      if (root) root.querySelectorAll('button, .btn, .cnavb, .pill').forEach(el => { if (!visibleRect(el)) return; const s = getComputedStyle(el); if (s.textOverflow === 'ellipsis') return; if (el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 20 && s.overflow !== 'visible') bad.push({ el: label(el), why: 'texte coupé (' + el.scrollWidth + ' px pour ' + el.clientWidth + ')' }); });
      return bad;
    },
    /* une fenêtre de bureau tient-elle dans le bureau, barre de titre et bouton Fermer accessibles ? */
    win(winEl) {
      const w = winEl || [...document.querySelectorAll('.desk .win')].pop(); if (!w) return null; const desk = w.closest('.desk'); const d = desk.getBoundingClientRect(), r = w.getBoundingClientRect(); const bad = [];
      if (r.left < d.left - 2 || r.top < d.top - 2 || r.right > d.right + 2 || r.bottom > d.bottom - 38) bad.push('déborde du bureau (' + [Math.round(r.left - d.left), Math.round(r.top - d.top), Math.round(d.right - r.right), Math.round(d.bottom - 40 - r.bottom)].join(', ') + ')');
      const cls = w.querySelector('.wb.cls'); if (cls) { const c = cls.getBoundingClientRect(); const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); if (!hit || !cls.contains(hit)) bad.push('bouton Fermer recouvert par ' + (hit ? label(hit) : 'rien')); }
      const tb = w.querySelector('.wtitle, .wt, .titlebar, .wbar'); if (tb) { const t = tb.getBoundingClientRect(); if (t.top < d.top - 1) bad.push('barre de titre hors du bureau'); }
      return { title: (w.querySelector('.wtitle, .wt, .titlebar') || w).textContent.trim().slice(0, 40), bad };
    },
    /* calque du dessus au centre d'un élément */
    topAt(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit ? label(hit) + (hit.closest('.bootscr') ? ' [roue de démarrage]' : '') + (hit.closest(sel) ? ' [ok]' : '') : null; },
    /* cibles de clic droit d'un calque : premières lignes de liste, d'arbre, bureau */
    ctxTargets(rootSel) {
      const root = document.querySelector(rootSel); if (!root) return []; const out = [];
      ['.lvr', '.tvr', '.dicon', '.si'].forEach(s => { const e = [...root.querySelectorAll(s)].find(x => visibleRect(x)); if (e) { const v = visibleRect(e); out.push({ sel: s, x: Math.round(v.x1 + Math.min(30, (v.x2 - v.x1) / 2)), y: Math.round((v.y1 + v.y2) / 2), what: label(e) }); } });
      return out;
    },
    menuAt() { const m = document.querySelector('.ctx.top'); if (!m) return null; const r = m.getBoundingClientRect(); return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom, items: m.querySelectorAll('.ctxi').length }; }
  };
};

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console : ' + m.text()); });
  const url = require('url').pathToFileURL(process.env.AUDIT_HTML || path.join(ROOT, 'dist', 'EDIVN-Lab.html')).href;   /* AUDIT_HTML : auditer un autre fichier (ex. une ancienne version) */
  await p.goto(url); await p.waitForFunction(() => window.SIM_APP); await p.evaluate(PAGE_FN);
  await p.evaluate(() => { window.SIM_NO_UNLOAD_PROMPT = 1; window.SIM_NO_EVENTS = 1; });
  const shot = async name => { const f = path.join(OUT, name.replace(/[^a-z0-9]+/gi, '_').slice(0, 80) + '.png'); await p.screenshot({ path: f }); return path.relative(ROOT, f); };
  const add = async (step, kind, detail, doShot) => { const f = doShot === false ? null : await shot(step + '_' + kind); issues.push({ step, kind, detail, shot: f }); };
  const want = name => !ONLY || name.toLowerCase().includes(ONLY);
  /* un écran : clic + débordements */
  const audit = async (step, rootSel) => {
    if (!want(step)) return; steps++;
    await p.waitForTimeout(250); const c = await p.evaluate(s => window.__audit.clicks(s), rootSel || null); checked += c.n;
    if (c.bad.length) await add(step, 'élément recouvert', c.bad.slice(0, 6).map(x => x.el + ' — recouvert par ' + x.by + ' (' + x.x + ', ' + x.y + ')').join('\n') + (c.bad.length > 6 ? '\n… et ' + (c.bad.length - 6) + ' autre(s)' : ''));
    const o = await p.evaluate(s => window.__audit.overflow(s), rootSel || null); if (o.length) await add(step, 'débordement', o.slice(0, 5).map(x => x.el + ' — ' + x.why).join('\n'));
  };
  /* clic droit : le menu doit s'ouvrir sous le pointeur (ou retourné contre le bord) et rester dans l'écran */
  const ctxCheck = async (step, rootSel) => {
    if (!want(step)) return; const ts = await p.evaluate(s => window.__audit.ctxTargets(s), rootSel);
    for (const t of ts) {
      await p.mouse.click(t.x, t.y, { button: 'right' }); await p.waitForTimeout(150); const m = await p.evaluate(() => window.__audit.menuAt());
      if (m) { menus++; const near = (Math.abs(m.x1 - t.x) <= 8 || Math.abs(m.x2 - t.x) <= 8) && (Math.abs(m.y1 - t.y) <= 8 || Math.abs(m.y2 - t.y) <= 8); const inside = m.x1 >= -1 && m.y1 >= -1 && m.x2 <= 1441 && m.y2 <= 901;
        if (!near || !inside) await add(step, 'menu du clic droit mal placé', 'clic droit sur ' + t.what + ' en (' + t.x + ', ' + t.y + ') → menu en (' + Math.round(m.x1) + ', ' + Math.round(m.y1) + ')–(' + Math.round(m.x2) + ', ' + Math.round(m.y2) + ')' + (inside ? '' : ', hors de l’écran')); }
      await p.keyboard.press('Escape'); await p.mouse.click(5, 895).catch(() => {}); await p.waitForTimeout(80); await p.evaluate(() => document.querySelectorAll('.ctx').forEach(x => x.remove()));
    }
  };
  const closeOv = () => p.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));

  /* ======================= accueil ======================= */
  await audit('Accueil · première visite'); await closeOv();
  await p.evaluate(() => { const G = SIM.game, P = SIM.prog; const pr = G.profile(); pr.tourDone = true; pr.xp = P.cum(14) + 50; for (let i = 0; i < 6; i++) pr.history.push({ id: SIM.faults[i].id, total: 80 + i, ts: Date.now() - i * 1e6, mttr: 300 }); G.saveProfile(pr); SIM_APP.home(); });
  for (const t of ['camp', 'duty', 'sandbox']) { await p.locator('.cnavb[data-tab=' + t + ']').click().catch(() => {}); await audit('Accueil · onglet ' + t); }
  await p.locator('.cnavb[data-tab=camp]').click().catch(() => {});
  await p.locator('details.htools summary').click().catch(() => {}); await audit('Accueil · outils ouverts');
  for (const [n, f] of [['identifiants', 'vaultModal'], ['plan d’adressage', 'planModal'], ['thèmes', 'themeModal'], ['à propos', 'aboutModal'], ['scénarios formateur', 'scenarioModal']]) { await p.evaluate(fn => SIM_APP[fn](), f); await audit('Accueil · fenêtre ' + n); await closeOv(); }
  for (const t of ['tree', 'rewards', 'mastery', 'ach']) { await p.evaluate(x => SIM.ui.prog.screen(SIM_APP, x), t); await audit('Carrière · ' + t); await closeOv(); }
  if (await p.locator('[data-act=chantier]').count()) { await p.locator('[data-act=chantier]').first().click(); await audit('Campagne · chantier'); await closeOv(); }

  /* ======================= partie ======================= */
  await p.evaluate(() => SIM_APP.begin({ level: 2, mode: 'free', seed: 'audit', faultId: 'iis_stopped' })); await p.waitForTimeout(700);
  await audit('Partie · carte du site');
  for (const [n, sel] of [['indice', '.gbar .btn:text-is("Indice")'], ['bug', '.gbar .gbug'], ['identifiants', '.gbar .btn:text-is("Identifiants")'], ['adressage', '.gbar .btn:text-is("Adressage")']]) { const l = p.locator(sel).first(); if (await l.count()) { await l.click().catch(() => {}); await audit('Partie · fenêtre ' + n); await closeOv(); } }

  /* bureaux Windows : poste client et serveur, toutes les applications */
  const logon = async (dev, user, pwd) => {
    await p.evaluate(d => SIM_APP.openDev(d, 'main'), dev); await p.waitForTimeout(700);
    const lg = p.locator('.logon:visible').first(); if (!(await lg.count())) return;
    await lg.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(120);
    if (!(await lg.locator('input[type=text]').count())) { const o = lg.locator('.other'); if (await o.count()) { await o.first().click().catch(() => {}); await p.waitForTimeout(120); } }
    if (await lg.locator('input[type=text]').count()) await lg.locator('input[type=text]').first().fill(user);
    await lg.locator('input[type=password]').first().fill(pwd).catch(() => {}); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  };
  const closeWins = () => p.evaluate(() => { document.querySelectorAll('.desk .win .wb.cls').forEach(b => b.click()); document.querySelectorAll('.desk .win').forEach(w => w.remove()); });
  for (const [dev, user, pwd, tag] of [['PC-01', 'tssr', 'Tssr-2026!', 'Windows 10'], ['SRV-DC1', 'tssr', 'Tssr-2026!', 'Windows Server']]) {
    await logon(dev, user, pwd); await closeWins();
    await audit(tag + ' · bureau'); await ctxCheck(tag + ' · bureau', '.desk');
    /* clic droit sur le fond du bureau et sur Démarrer */
    if (want(tag + ' · clic droit')) { for (const [what, sel, dy] of [['fond du bureau', '.desk .wall', 0], ['bouton Démarrer', '.desk .startb', 0]]) { const bx = await p.locator(sel).first().boundingBox(); if (!bx) continue; const x = Math.round(bx.x + (what === 'fond du bureau' ? 420 : bx.width / 2)), y = Math.round(bx.y + (what === 'fond du bureau' ? 260 : bx.height / 2)); await p.mouse.click(x, y, { button: 'right' }); await p.waitForTimeout(150); const m = await p.evaluate(() => window.__audit.menuAt()); menus++;
      if (!m) await add(tag + ' · clic droit', 'menu absent', 'clic droit sur ' + what + ' : aucun menu'); else if (!((Math.abs(m.x1 - x) <= 30 || Math.abs(m.x2 - x) <= 30) && (Math.abs(m.y1 - y) <= 30 || Math.abs(m.y2 - y) <= 30))) await add(tag + ' · clic droit', 'menu du clic droit mal placé', 'clic droit sur ' + what + ' en (' + x + ', ' + y + ') → menu en (' + Math.round(m.x1) + ', ' + Math.round(m.y1) + ')');
      await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.ctx').forEach(x => x.remove())); } }
    /* menu Démarrer */
    await p.evaluate(d => SIM_APP.run.surfaces[d].desk.openStart(), dev); await audit(tag + ' · menu Démarrer'); await ctxCheck(tag + ' · menu Démarrer', '.desk .start, .desk .smenu, .desk');
    await p.evaluate(d => SIM_APP.run.surfaces[d].desk.closeStart(), dev);
    /* chaque application */
    const apps = await p.evaluate(() => Object.keys(SIM.ui.apps).filter(k => ['run'].indexOf(k) < 0));
    for (const app of apps) {
      const step = tag + ' · ' + app; if (!want(step)) continue;
      const n0 = await p.locator('.desk .win').count();
      await p.evaluate(([d, a]) => { try { SIM_APP.run.surfaces[d].desk.open(a, undefined, { elevated: true }); } catch (e) { window.__openErr = e.message; } }, [dev, app]); await p.waitForTimeout(500);
      if (await p.locator('.desk .win.uac').count()) { const u = p.locator('.desk .win.uac').last(); const t = u.locator('input[type=text]'); if (await t.count()) { await t.first().fill('tssr'); await u.locator('input[type=password]').first().fill('Tssr-2026!'); } await u.locator('button', { hasText: /^Oui$/ }).first().click().catch(() => {}); await p.waitForTimeout(500); }
      const oe = await p.evaluate(() => { const e = window.__openErr; window.__openErr = null; return e; }); if (oe) { await add(step, 'erreur à l’ouverture', oe); continue; }
      if (await p.locator('.desk .win').count() <= n0) continue;   /* application refusée sur ce système (ex. console serveur sur un poste) */
      wins++; const wv = await p.evaluate(() => window.__audit.win()); if (wv && wv.bad.length) await add(step, 'fenêtre', '« ' + wv.title + ' » : ' + wv.bad.join(' ; '));
      await audit(step, '.desk'); await ctxCheck(step, '.desk .win:last-of-type');
      await closeWins(); await p.waitForTimeout(150);
    }
    /* verrouillage puis redémarrage : l'écran attendu doit être au premier plan */
    if (want(tag + ' · verrouillage')) { steps++; await p.evaluate(d => SIM_APP.run.surfaces[d].desk.lock(), dev); await p.waitForTimeout(700); const t = await p.evaluate(() => window.__audit.topAt('.frame:not(.hidden) .logon, .logon')); if (!t || !/\[ok\]/.test(t)) await add(tag + ' · verrouillage', 'écran bloqué', 'écran de verrouillage pas au premier plan : ' + t); await logon(dev, user, pwd); }
    if (want(tag + ' · redémarrage')) { steps++; await p.evaluate(d => { SIM.steps.reboot(SIM_APP.run.W, { dev: d }); SIM_APP.run.W.touch('power'); }, dev); await p.waitForTimeout(3800); const t = await p.evaluate(() => window.__audit.topAt('.frame:not(.hidden) .logon, .logon')); if (!t || !/\[ok\]/.test(t)) await add(tag + ' · redémarrage', 'écran bloqué', 'écran de connexion pas au premier plan après redémarrage : ' + t); }
  }
  /* consoles et pare-feu */
  for (const [dev, tag] of [['SRV-LNX', 'Console Linux'], ['SW-T1', 'Console Cisco'], ['pfsense-tls', 'pfSense']]) { await p.evaluate(d => SIM_APP.openDev(d, 'main'), dev); await p.waitForTimeout(900); await audit(tag); }
  for (const dev of ['PC-01', 'SW-T1']) { await p.evaluate(d => SIM_APP.openDev(d, 'rig'), dev); await p.waitForTimeout(800); await audit('Poste physique · ' + dev); }

  /* ======================= rapport ======================= */
  if (errs.length) issues.push({ step: 'toute la session', kind: 'erreur JavaScript', detail: [...new Set(errs)].slice(0, 8).join('\n') });
  await b.close();
  const md = ['# Audit graphique', '', '_Généré par `node tests/ui/ui-audit.js` — ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '_', '',
    steps + ' écrans, ' + checked + ' éléments interactifs vérifiés, ' + menus + ' menus du clic droit, ' + wins + ' fenêtres d’application.', '',
    issues.length ? '## ' + issues.length + ' anomalie(s)\n' : '## Aucune anomalie\n'].concat(issues.map(x => '### ' + x.step + ' — ' + x.kind + '\n\n```\n' + x.detail + '\n```\n' + (x.shot ? '\nCapture : `' + x.shot + '`\n' : ''))).join('\n');
  fs.writeFileSync(path.join(ROOT, 'docs', 'AUDIT-UI.md'), md);
  issues.forEach(x => console.log('✗ ' + x.step + ' — ' + x.kind + '\n    ' + x.detail.split('\n').join('\n    ')));
  console.log('\n' + steps + ' écrans, ' + checked + ' éléments vérifiés, ' + menus + ' menus, ' + wins + ' fenêtres → ' + (issues.length ? issues.length + ' anomalie(s)' : 'aucune anomalie') + ' (docs/AUDIT-UI.md)');
  console.log(issues.length ? '✗ ui-audit : anomalies' : '✓ ui-audit : tout passe'); process.exit(issues.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
