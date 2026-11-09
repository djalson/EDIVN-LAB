/* Accueil refondu (graine masquée, textes, décor pixel-art, chats dispersés), 8 thèmes + animations du 100,
   débrief (note /100, graine, rejeu, liens de cours sur échec, animation sur 100). Aucune erreur JS de page. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +(process.argv[2] || 1440), height: +(process.argv[3] || 900) } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let ok = true; const chk = (n, c) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) ok = false; };
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForFunction(() => window.SIM_APP); await p.waitForTimeout(300);
  await p.evaluate(() => { SIM.game.store.set('theme', 'neon'); SIM_APP.home(); }); await p.waitForTimeout(200);

  console.log('== accueil');
  const txt = await p.innerText('.screen.home');
  chk('slogan : « Le ticket est flou, la panne est réelle. À toi de la trouver. »', /Le ticket est flou, la panne est réelle\. À toi de la trouver\./.test(txt));
  chk('ancien slogan et « Coffre d’identifiants » absents', !/Une panne\. Un ticket flou/.test(txt) && !/Coffre/.test(txt) && /Mots de passe de l’infra/.test(txt));
  chk('graine : aucun champ visible dans le parcours de choix (rangée dans Options formateur)', (await p.$$('.hmain > section:not(:last-child) input')).length === 0 && (await p.$$('details.adv input')).length === 1);
  chk('graine : ni libellé « graine » ni dé sur la page hors options', !/Graine de l’incident/.test(await p.innerText('.hleft .hmain > section:nth-child(1)')) && !(await p.$('.hmain section:has(h2:has-text("Graine"))')));
  chk('niveaux Admin / Cyber / Chaos annoncent 2 / 3 / 4 pannes', (await p.$$eval('.hlv .hlvd', e => e.map(x => x.textContent)).then(a => /Deux pannes/.test(a[2]) && /Trois pannes/.test(a[3]) && /Quatre/.test(a[4]))));
  const cats = await p.$$eval('.hcatg', e => e.map(x => { const r = x.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 + document.querySelector('.screen.home').scrollTop }; }));
  let minD = 1e9; for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) minD = Math.min(minD, Math.hypot(cats[i].x - cats[j].x, cats[i].y - cats[j].y));
  chk('4 chats cachés dans le décor, jamais côte à côte (distance mini ' + Math.round(minD) + ' px)', cats.length === 4 && minD > 250);
  chk('décor salle serveur : bandeau d’en-tête + faux plancher, LED animées', !!(await p.$('.hband svg')) && !!(await p.$('.hfloor svg')) && (await p.$$('.hband .led')).length > 20);
  chk('les LED clignotent (animation CSS active)', await p.$eval('.hband .led', e => getComputedStyle(e).animationName === 'ledb'));

  /* les 5 thèmes payants sont débloqués ici (le verrouillage est testé dans progress.js) */
  await p.evaluate(() => { const pr = SIM.game.profile(); SIM.prog.TREE.forEach(n => { if (n.theme) pr.tree[n.id] = 1; }); SIM.game.saveProfile(pr); });
  console.log('== thèmes');
  await p.click('.hthemetop'); await p.waitForSelector('.thcard');
  chk('sélecteur : 8 thèmes proposés', (await p.$$('.thcard')).length === 8);
  const names = await p.$$eval('.thcard b', e => e.map(x => x.textContent));
  chk('noms génériques (aucune marque ni œuvre citée)', !names.some(n => /matrix|blade|tron|game ?boy|dracula|nintendo|microsoft|cisco/i.test(n)) && names.join() === 'Néon Arcade,Pluie de code,Synthwave 80s,Cyberpunk,Console 8-bit,Terminal Ambre,Dev Dark,Papier Clair');
  await p.click('.thcard:nth-child(4) button:has-text("Appliquer")'); await p.waitForTimeout(300);
  chk('thème appliqué (data-theme) et mémorisé', await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'cyber' && SIM.game.store.get('theme') === 'cyber'));
  chk('l’accueil est redessiné avec le thème (variable --accent)', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() === '#fcee0a'));
  chk('les consoles émulées ne sont pas thématisées (--win-bg inchangé)', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--win-bg').trim() === '#ffffff'));
  /* contraste du texte du bouton principal pour chaque thème (≥ 4,5 : AA) */
  const lum = c => { const [r, g, bb] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * bb; };
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const pal = await p.evaluate(() => SIM.ui.themes.list.map(t => ({ id: t.id, acc: t.vars['--accent'], acc2: t.vars['--accent2'], on: t.vars['--onaccent'], bg: t.vars['--bg'], text: t.vars['--text'], panel: t.vars['--panel'], muted: t.vars['--muted'], bub: t.vars['--bubble'], bubt: t.vars['--bubbletxt'] })));
  const cr = (a, c) => { const A = lum(hex(a)), B = lum(hex(c)); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); };
  const bad = []; pal.forEach(t => { const ck = (n, a, c, min) => { const v = cr(a, c); if (v < min) bad.push(t.id + ' ' + n + ' ' + v.toFixed(2)); }; ck('bouton principal', t.on, t.acc, 4.5); ck('texte/fond', t.text, t.bg, 4.5); ck('texte/panneau', t.text, t.panel, 4.5); ck('discret/panneau', t.muted, t.panel, 4.5); ck('bulle', t.bubt, t.bub, 4.5); });
  chk('contrastes AA sur les 8 thèmes' + (bad.length ? ' : ' + bad.join(' ; ') : ''), bad.length === 0);

  console.log('== animations du 100');
  for (const id of ['neon', 'rain', 'synth', 'cyber', 'bit', 'amber', 'dev', 'paper']) {
    await p.evaluate(i => SIM.ui.themes.celebrate(i, 100), id); await p.waitForTimeout(id === 'rain' ? 3800 : id === 'amber' ? 2600 : 900);
    const st = await p.evaluate(() => { const e = document.querySelector('.hperf'); if (!e) return null; const cv = e.querySelector('canvas'); let lit = 0; if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 64) if (d[i + 1] > 120) lit++; } return { cls: e.className, text: e.innerText, label: e.getAttribute('aria-label'), lit }; });
    chk(id + ' : animation affichée' + (id === 'rain' ? ' (' + (st && st.lit) + ' points verts, « 100 » figé)' : ''), !!st && st.cls.includes('pf-' + (id)) && /100/.test((st.text || '') + (st.label || '')) && (id !== 'rain' || st.lit > 200));
    await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    chk(id + ' : se ferme avec Échap', !(await p.$('.hperf')));
  }
  await p.evaluate(() => SIM.ui.themes.celebrate('neon', 100)); await p.click('.hperf'); await p.waitForTimeout(350); chk('se ferme au clic', !(await p.$('.hperf')));
  await p.evaluate(() => SIM.ui.themes.celebrate('neon', 100)); await p.waitForTimeout(5800); chk('se ferme seule après ~5 s', !(await p.$('.hperf')));
  /* mouvement réduit : carte fixe, pas de canvas */
  await p.emulateMedia({ reducedMotion: 'reduce' }); await p.evaluate(() => SIM.ui.themes.celebrate('rain', 100)); await p.waitForTimeout(300);
  chk('mouvement réduit : carte fixe sans canvas ni particules', !!(await p.$('.hperf .pf-card')) && !(await p.$('.hperf canvas')) && !(await p.$('.hperf .pf-star, .hperf .pf-conf')));
  await p.keyboard.press('Escape'); await p.emulateMedia({ reducedMotion: 'no-preference' }); await p.waitForTimeout(300);

  console.log('== débrief');
  await p.evaluate(() => { SIM.game.store.set('theme', 'dev'); SIM_APP.home(); });
  const fail = await p.evaluate(async () => {
    SIM_APP.begin({ level: 2, mode: 'free', seed: '4242', faultId: 'dhcp_scope_off' }); await new Promise(r => setTimeout(r, 80));
    SIM_APP.run.m.giveUp(); SIM_APP.run.finish(); await new Promise(r => setTimeout(r, 150));
    const links = Array.from(document.querySelectorAll('.dcourses a')).map(a => ({ href: a.href, rel: a.rel, target: a.target }));
    return { text: document.body.innerText, links, seed: (document.querySelector('.dseed code') || {}).textContent, replay: !!Array.from(document.querySelectorAll('button')).find(x => x.textContent === 'Rejouer cet incident') };
  });
  chk('abandon : « à repasser », note < 75 affichée', /Ticket abandonné : à repasser/.test(fail.text) && /\/ 100/.test(fail.text) && /Seuil de validation : 75/.test(fail.text));
  chk('abandon : graine rappelée (4242) et bouton « Rejouer cet incident »', fail.seed === '4242' && fail.replay);
  chk('abandon : liens de cours (' + fail.links.length + ') sur l’hôte fixe, noopener noreferrer, nouvel onglet', fail.links.length >= 2 && fail.links.every(l => /^https:\/\/tssr\.miyukini\.com\/[a-z0-9-]+$/.test(l.href) && /noopener/.test(l.rel) && /noreferrer/.test(l.rel) && l.target === '_blank'));
  chk('abandon : les liens correspondent à la panne (DHCP)', fail.links.some(l => /dhcp/.test(l.href)));
  chk('abandon : mention « connexion internet nécessaire »', /connexion internet nécessaire/.test(fail.text));
  const good = await p.evaluate(async () => {
    SIM_APP.begin({ level: 2, mode: 'free', seed: '4243', faultId: 'dhcp_scope_off', profile: { name: 'T', done: {}, skills: {}, badges: [], history: [], best: {} } }); await new Promise(r => setTimeout(r, 80));
    const run = SIM_APP.run; const inst = run.m.parts[0]; SIM.fault.runSteps(run.W, inst.fix, { inst }); const pats = (inst.verify && inst.verify.length) ? inst.verify : SIM.fault.defaultVerify(inst); run.W.observe(pats[0].replace(/\*/g, 'test'), true);
    SIM_APP.closeTicket(); await new Promise(r => setTimeout(r, 300));
    return { text: document.body.innerText, perfect: !!document.querySelector('.hperf'), cls: (document.querySelector('.hperf') || {}).className, note: run.m.result.note, links: document.querySelectorAll('.dcourses').length };
  });
  chk('résolution propre et rapide : 100 / 100, « Ticket parfait »', good.note === 100 && /Ticket parfait/.test(good.text) && /Parfait/.test(good.text));
  chk('100 : animation du thème actif (Dev Dark) lancée', good.perfect && /pf-dev/.test(good.cls));
  chk('ticket validé : pas de liens de révision', good.links === 0);
  await p.keyboard.press('Escape');
  console.log('erreurs de page :', errs.length ? errs.join(' | ') : 'aucune'); if (errs.length) ok = false;
  await b.close(); console.log(ok ? 'OK' : 'ÉCHEC'); process.exit(ok ? 0 : 1);
})();
