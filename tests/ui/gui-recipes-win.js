/* Recettes du balayage graphique : chaque recette traduit UNE étape de correction du moteur en gestes dans la console Windows réelle.
   find(étape) → { run(étape) } ou null (« sans recette »). Les gestes passent par les éléments du DOM (clic, saisie), jamais par le modèle. */
module.exports = function (T) {
  const { p } = T; const list = [];
  const add = (match, run) => list.push({ match, run });
  const pathOf = st => String(st.path || '');
  const dev0 = path => path.split('.')[0];
  const engine = st => p.evaluate(s => { const run = SIM_APP.run; SIM.fault.runSteps(run.W, [s], { inst: run.m.parts[0] }); }, st);

  /* ---- équipements sans console Windows (routeurs, commutateurs, imprimante) : étape appliquée par le moteur, réparation au terminal prouvée par les balayages IOS / Linux ---- */
  const devOfStep = st => st.dev || (st.path ? String(st.path).split('.')[0] : null);

  /* ---- Gestionnaire DNS ---- */
  const dnsZone = async (dev, zone) => { await T.openApp(dev, 'dns'); const w = p.locator('.win.active').last(); await w.locator('.tvr', { has: p.locator('.tvl', { hasText: new RegExp('^' + zone.replace(/\./g, '\\.') + '$') }) }).first().click(); await p.waitForTimeout(250); };
  add(st => st.do === 'push' && /\.win\.dns\.zones\[name=[^\]]+\]\.records$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.dns\.zones\[name=([^\]]+)\]\.records$/.exec(pathOf(st)); await dnsZone(m[1], m[2]); const it = st.item;
    if (it.type === 'A') { await T.action('Nouvel hôte (A ou AAAA)…'); const d = dlgTop(); await d.locator('input.w10in').first().fill(it.name); await T.setIp(d.locator('.ipbox').first(), it.data); await T.btn('Ajouter un hôte', d); if (await p.locator('.win.active').last().locator('button.w10btn', { hasText: /^Terminé$/ }).count()) await T.btn('Terminé'); }
    else if (it.type === 'PTR') { await T.action('Nouveau pointeur (PTR)…'); const d = dlgTop(); await d.locator('input.w10in').nth(0).fill(it.name); await d.locator('input.w10in').nth(1).fill(it.data.replace(/\.$/, '')); await T.btn('OK', d); }
    else throw new Error('type d’enregistrement sans recette : ' + it.type);
  });
  add(st => st.do === 'set' && /\.win\.dns\.zones\[name=[^\]]+\]\.records\[name=[^\]]+\]\.data$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.dns\.zones\[name=([^\]]+)\]\.records\[name=([^\]]+)\]\.data$/.exec(pathOf(st)); await dnsZone(m[1], m[2]);
    const rr = p.locator('.win.active').last().locator('.lvr').filter({ has: p.locator('.lvd', { hasText: new RegExp('^' + m[3] + '$') }) }).filter({ hasText: /Hôte \(A\)/ }).first();
    await rr.dblclick(); await p.waitForTimeout(250); const d = dlgTop(); await T.setIp(d.locator('.ipbox').first(), st.value); await T.btn('OK', d);
  });
  add(st => st.do === 'set' && /\.hostsFile$/.test(pathOf(st)), async st => {   /* fichier hosts : Bloc-notes lancé avec élévation, texte remplacé puis Ctrl+S */
    const dev = dev0(pathOf(st)); await T.goDev(dev); T.setDev(dev);
    await p.evaluate(d => { const desk = SIM_APP.run.surfaces[d].desk; desk.open('notepad', { path: SIM.emu.win.HOSTS_PATH, name: 'hosts' }, { elevated: true }); }, dev); await p.waitForTimeout(400);
    const ta = p.locator('.win.active').last().locator('textarea').first(); const cur = await ta.inputValue();
    const keep = cur.split('\n').filter(l => !l.trim() || l.trim().startsWith('#') || (st.value || []).some(h => l.indexOf(h.name) >= 0)).join('\n');
    await ta.fill(keep); await ta.press('Control+s'); await p.waitForTimeout(300); await T.uac();
  });
  add(st => st.do === 'set' && /\.win\.dns\.forwarders$/.test(pathOf(st)), async st => {
    const dev = dev0(pathOf(st)); await T.openApp(dev, 'dns'); const w = p.locator('.win.active').last(); await w.locator('.tvr', { has: p.locator('.tvl', { hasText: new RegExp('^' + dev + '$', 'i') }) }).first().click(); await p.waitForTimeout(200);
    await T.action('Propriétés'); const ps = dlgTop(); await ps.locator('.ttab', { hasText: 'Redirecteurs' }).click(); await p.waitForTimeout(150); await T.btn('Modifier…', ps);
    const d = dlgTop();
    for (let i = 0; i < 8; i++) { const it = d.locator('.dli').first(); if (!(await it.count())) break; await it.click(); await T.btn('Supprimer', d); }
    for (const ip of st.value) { await T.setIp(d.locator('.ipbox').first(), ip); await T.btn('Ajouter', d); }
    await T.btn('OK', d); await T.btn('OK', dlgTop());
  });


  /* ---- Pare-feu Windows (wf.msc) ---- */
  add(st => st.do === 'set' && /\.win\.fw\.rules\[id=[^\]]+\]\.enabled$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.fw\.rules\[id=([^\]]+)\]\.enabled$/.exec(pathOf(st)); await T.openApp(m[1], 'wf');
    const r = await p.evaluate(([d, id]) => { const x = SIM_APP.run.W.d(d).win.fw.rules.find(q => q.id === id); return { name: x.name, dir: x.dir }; }, [m[1], m[2]]);
    await T.treeSel(r.dir === 'in' ? 'Règles de trafic entrant' : 'Règles de trafic sortant');
    const row = p.locator('.win.active').last().locator('.lvr').filter({ has: p.locator('.lvd', { hasText: r.name }) }).first(); await row.click({ button: 'right' });
    await T.menuClick(st.value ? 'Activer la règle' : 'Désactiver la règle'); await p.waitForTimeout(200);
  });

  /* ---- Gestionnaire IIS ---- */
  const iisSite = async (dev, id) => {
    await T.openApp(dev, 'iis'); const nm = await p.evaluate(([d, i]) => SIM_APP.run.W.d(d).win.iis.sites.find(s => String(s.id) === String(i)).name, [dev, id]);
    const w = p.locator('.win.active').last(); const sites = w.locator('.tvr', { has: p.locator('.tvl', { hasText: /^Sites$/ }) }).first(); await sites.click();
    if (!(await w.locator('.tvr', { has: p.locator('.tvl', { hasText: new RegExp('^' + nm + '$') }) }).count())) { await sites.locator('.tvx').click(); await p.waitForTimeout(150); }
    await w.locator('.tvr', { has: p.locator('.tvl', { hasText: new RegExp('^' + nm + '$') }) }).first().click(); await p.waitForTimeout(250); return nm;
  };
  add(st => st.do === 'set' && /\.win\.iis\.sites\[id=[^\]]+\]\.state$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.iis\.sites\[id=([^\]]+)\]\.state$/.exec(pathOf(st)); await iisSite(m[1], m[2]); await T.action(st.value === 'started' ? 'Démarrer' : 'Arrêter'); await p.waitForTimeout(200);
  });
  add(st => st.do === 'set' && /\.win\.iis\.sites\[id=[^\]]+\]\.bindings\[\d+\]\.(port|host|cert)$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.iis\.sites\[id=([^\]]+)\]\.bindings\[(\d+)\]\.(port|host|cert)$/.exec(pathOf(st)); await iisSite(m[1], m[2]); await T.action('Liaisons…');
    const dl = dlgTop(); await dl.locator('.lvr').nth(+m[3]).click(); await T.btn('Modifier…', dl); const d = dlgTop();
    if (m[4] === 'port') await d.locator('input.w10in').first().fill(String(st.value));
    else if (m[4] === 'host') { const inputs = d.locator('input.w10in'); await inputs.nth(1).fill(String(st.value)); }
    else await d.locator('select.w10in').last().selectOption({ label: String(st.value) });
    await T.btn('OK', d); await T.btn('Fermer', dlgTop());
  });
  add(st => st.do === 'push' && /\.win\.iis\.sites\[id=[^\]]+\]\.defaultDocs$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.iis\.sites\[id=([^\]]+)\]\.defaultDocs$/.exec(pathOf(st)); await iisSite(m[1], m[2]);
    await p.locator('.win.active').last().locator('div', { hasText: /^Documents par défaut$/ }).last().dblclick(); await p.waitForTimeout(250);
    await T.action('Ajouter…');
    const d = dlgTop(); await d.locator('input.w10in').first().fill(String(st.item)); await T.btn('OK', d);
  });
  add(st => st.do === 'set' && /\.win\.iis\.appPools\[name=[^\]]+\]\.state$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.iis\.appPools\[name=([^\]]+)\]\.state$/.exec(pathOf(st)); await T.openApp(m[1], 'iis'); await T.treeSel('Pools d’applications');
    await (await T.row(m[2])).click(); await T.action(st.value === 'started' ? 'Démarrer' : 'Arrêter'); await p.waitForTimeout(200);
  });

  /* ---- Certificats (ordinateur local) : assistant de renouvellement ---- */
  add(st => st.do === 'set' && /\.win\.certs\[cn=[^\]]+\]\.notAfter$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.certs\[cn=([^\]]+)\]\.notAfter$/.exec(pathOf(st)); await T.openApp(m[1], 'certlm'); await T.treeSel(/^Certificats$/, p.locator('.win.active').last());
    const row = await T.row(m[2]); await row.click(); await p.waitForTimeout(150); await T.action('Renouveler le certificat avec la même clé…'); const d = dlgTop();
    for (let i = 0; i < 3; i++) { const b = d.locator('button.w10btn', { hasText: /^(Suivant|Terminer)$/ }).first(); await b.click(); await p.waitForTimeout(200); }
  });


  /* ---- Utilisateurs et ordinateurs Active Directory ---- */
  const dcOf = async dom => p.evaluate(d => { const x = SIM.ad.byDomain(SIM_APP.run.W, d); return x ? x.id : null; }, dom);
  const aducGoto = async (dc, dn) => {
    await T.openApp(dc, 'aduc'); const w = p.locator('.win.active').last();
    const parts = dn.split(','); const chain = []; for (let i = parts.length - 1; i >= 0; i--) { const sub = parts.slice(i).join(','); if (/^DC=/i.test(sub) && i > 0 && /^DC=/i.test(parts[i - 1])) continue; chain.push(sub); }
    for (let i = 0; i < chain.length - 1; i++) { const row = w.locator('.tvr[data-k="' + chain[i] + '"]').first(); const nxt = w.locator('.tvr[data-k="' + chain[i + 1] + '"]'); if (!(await nxt.count())) { await row.locator('.tvx').click(); await p.waitForTimeout(120); } }
    await w.locator('.tvr[data-k="' + chain[chain.length - 1] + '"]').first().click(); await p.waitForTimeout(250); return w;
  };
  const modelObj = (dc, kind, key) => p.evaluate(([d, k, v]) => { const A = SIM_APP.run.W.d(d).win.ad; const o = k === 'user' ? A.users.find(x => x.sam === v) : k === 'computer' ? A.computers.find(x => x.name === v) : A.groups.find(x => x.name === v); return { name: o.name, ou: o.ou }; }, [dc, kind, key]);
  const aducRow = async (dc, kind, key) => { const o = await modelObj(dc, kind, key); const w = await aducGoto(dc, o.ou); return w.locator('.lvr').filter({ has: p.locator('.lvd', { hasText: new RegExp('^' + o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).first(); };
  const userProps = async (dc, sam, tab) => { const r = await aducRow(dc, 'user', sam); await r.dblclick(); await p.waitForTimeout(300); const ps = dlgTop(); if (tab) await ps.locator('.ttab', { hasText: tab }).click(); await p.waitForTimeout(120); return ps; };
  add(st => st.do === 'ad.unlock', async st => {
    const dc = await dcOf(st.domain); const ps = await userProps(dc, st.sam, 'Compte'); await ps.locator('label.chk', { hasText: 'Déverrouiller le compte' }).locator('input').check(); await T.btn('OK', ps);
  });
  add(st => st.do === 'ad.pwd', async st => {
    const dc = await dcOf(st.domain); const r = await aducRow(dc, 'user', st.sam); await r.click({ button: 'right' }); await T.menuClick('Réinitialiser le mot de passe…'); const d = dlgTop();
    const pw = d.locator('input[type=password]'); await pw.nth(0).fill(st.pwd); await pw.nth(1).fill(st.pwd);
    const must = d.locator('label.chk', { hasText: 'doit changer de mot de passe' }).locator('input'); if ((await must.isChecked()) !== !!st.mustChange) await must.click();
    await T.btn('OK', d); await T.confirmYes();   /* message d'information */
  });
  add(st => st.do === 'ad.member.add', async st => {
    const dc = await dcOf(st.domain); const r = await aducRow(dc, 'group', st.group); await r.dblclick(); await p.waitForTimeout(300); const ps = dlgTop(); await ps.locator('.ttab', { hasText: 'Membres' }).click();
    await T.btn('Ajouter…', ps); const d = dlgTop(); await d.locator('textarea').fill(st.member); await T.btn('OK', d); await T.btn('OK', ps);
  });
  add(st => st.do === 'set' && /\.win\.ad\.users\[sam=[^\]]+\]\.enabled$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.users\[sam=([^\]]+)\]\.enabled$/.exec(pathOf(st)); const ps = await userProps(m[1], m[2], 'Compte'); const c = ps.locator('label.chk', { hasText: 'Compte désactivé' }).locator('input');
    if ((await c.isChecked()) !== !st.value) await c.click(); await T.btn('OK', ps);
  });
  add(st => st.do === 'set' && /\.win\.ad\.users\[sam=[^\]]+\]\.expires$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.users\[sam=([^\]]+)\]\.expires$/.exec(pathOf(st)); const ps = await userProps(m[1], m[2], 'Compte');
    if (!st.value) await ps.locator('label.chk', { hasText: /^Jamais$/ }).locator('input').check();
    else { await ps.locator('label.chk', { hasText: 'Fin de :' }).locator('input').check(); const [y, mo, da] = st.value.slice(0, 10).split('-'); await ps.locator('input.w10in[type=text]').last().fill(da + '/' + mo + '/' + y); }
    await T.btn('OK', ps);
  });
  add(st => st.do === 'set' && /\.win\.ad\.users\[sam=[^\]]+\]\.allowedWorkstations$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.users\[sam=([^\]]+)\]\.allowedWorkstations$/.exec(pathOf(st)); const ps = await userProps(m[1], m[2], 'Compte'); await T.btn('Se connecter à…', ps); const d = dlgTop();
    if (!(st.value || []).length) await d.locator('label.chk', { hasText: 'Tous les ordinateurs' }).locator('input').check();
    else throw new Error('liste de stations non vide sans recette');
    await T.btn('OK', d); await T.btn('OK', ps);
  });
  add(st => st.do === 'set' && /\.win\.ad\.computers\[name=[^\]]+\]\.enabled$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.computers\[name=([^\]]+)\]\.enabled$/.exec(pathOf(st)); const r = await aducRow(m[1], 'computer', m[2]); await r.click({ button: 'right' }); await T.menuClick(st.value ? 'Activer le compte' : 'Désactiver le compte'); await T.confirmYes();
  });
  add(st => st.do === 'set' && /\.win\.ad\.computers\[name=[^\]]+\]\.ou$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.computers\[name=([^\]]+)\]\.ou$/.exec(pathOf(st)); const r = await aducRow(m[1], 'computer', m[2]); await r.click({ button: 'right' }); await T.menuClick('Déplacer…'); const d = dlgTop();
    const parts = st.value.split(','); const chain = []; for (let i = parts.length - 1; i >= 0; i--) { const sub = parts.slice(i).join(','); if (/^DC=/i.test(sub) && i > 0 && /^DC=/i.test(parts[i - 1])) continue; chain.push(sub); }
    for (let i = 0; i < chain.length - 1; i++) { const nxt = d.locator('.tvr[data-k="' + chain[i + 1] + '"]'); if (!(await nxt.count())) { await d.locator('.tvr[data-k="' + chain[i] + '"] .tvx').click(); await p.waitForTimeout(120); } }
    await d.locator('.tvr[data-k="' + chain[chain.length - 1] + '"]').first().click(); await T.btn('OK', d);
  });

  const fallback = { match: st => !!devOfStep(st) && ['renew', 'release', 'flushdns', 'relogon', 'tick', 'dnscache'].indexOf(st.do) < 0, run: async st => {
    const dv = devOfStep(st); const isWin = await p.evaluate(d => { const x = SIM_APP.run.W.dev[d]; return !!(x && x.win); }, dv);
    if (isWin) throw new Error('sans recette graphique : ' + JSON.stringify(st).slice(0, 100));
    await engine(st); T.foreign.push(JSON.stringify(st).slice(0, 90));
  } };
  /* ---- étapes « client » : attente / rafraîchissement côté poste (couvertes par les balayages au terminal) ---- */
  ['renew', 'release', 'flushdns', 'relogon', 'tick', 'dnscache'].forEach(k => add(st => st.do === k, async st => { await engine(st); }));

  /* ---- Services (services.msc) ---- */
  const svcDisplay = key => p.evaluate(k => SIM.win.SVC_DISPLAY[k] || k, key);
  const svcRow = async (dev, key) => {
    try { await T.openApp(dev, 'services'); } catch (e) { if (!e.noLogon) throw e; await T.remote('PC-ADM', 'services', dev); }   /* pas de serveur d'ouverture de session : console Services depuis PC-ADM */
    const nm = await svcDisplay(key); const r = await T.row(nm); await r.scrollIntoViewIfNeeded(); return r; };
  /* « arrêt puis démarrage » d'un même service = « Redémarrer » dans la console (c'est le geste que le chemin optimal des pannes décrit) :
     jouer Arrêter puis Démarrer coûterait un impact « arrêt de service » (D-109) que le chemin déclaré ne doit pas coûter. */
  add(st => st.do === 'svc', async st => {
    const fx = T.fixSteps || []; const i = fx.indexOf(st);
    if (T.skipStep === st) { T.skipStep = null; return; }
    const nx = i >= 0 ? fx[i + 1] : null; const pair = st.state === 'stopped' && nx && nx.do === 'svc' && nx.dev === st.dev && nx.name === st.name && nx.state === 'running';
    const r = await svcRow(st.dev, st.name); await r.click({ button: 'right' });
    if (pair) { await T.menuClick('Redémarrer'); T.skipStep = nx; } else await T.menuClick(st.state === 'running' ? 'Démarrer' : 'Arrêter');
    await T.waitProgress(); await p.waitForTimeout(150);
  });
  add(st => st.do === 'set' && /\.win\.svc\.\w+\.start$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.svc\.(\w+)\.start$/.exec(pathOf(st)); const r = await svcRow(m[1], m[2]); await r.dblclick(); await p.waitForTimeout(250);
    const label = { auto: 'Automatique', manual: 'Manuel', disabled: 'Désactivé', 'auto-delayed': 'Automatique (début différé)' }[st.value];
    await T.top().locator('select.w10in').first().selectOption({ label }); await T.btn('OK');
  });

  /* ---- Connexions réseau (ncpa.cpl) ---- */
  const ncpaRow = async (dev, nic) => { await T.openApp(dev, 'ncpa'); const r = await T.row(nic); return r; };
  add(st => st.do === 'set' && /\.ifaces\.[\w-]+\.adminDown$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.ifaces\.([\w-]+)\.adminDown$/.exec(pathOf(st)); const r = await ncpaRow(m[1], m[2]); await r.click({ button: 'right' }); await T.menuClick(st.value ? 'Désactiver' : 'Activer'); await T.uac(); await p.waitForTimeout(250);
  });
  add(st => st.do === 'set' && /\.ifaces\.[\w-]+\.(ip|mask|gw|dns)$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.ifaces\.([\w-]+)\.(ip|mask|gw|dns)$/.exec(pathOf(st)); const [dev, nic, field] = [m[1], m[2], m[3]];
    if (!(await p.evaluate(d => !!SIM_APP.run.W.dev[d].win, dev))) { await engine(st); T.foreign.push(JSON.stringify(st).slice(0, 90)); return; }   /* imprimante / équipement sans console Windows */
    const cur = await p.evaluate(([d, n]) => { const i = SIM_APP.run.W.d(d).ifaces[n]; return { dhcp: !!i.dhcp, ip: i.ip || '', mask: i.mask || '', gw: i.gw || '', dns: (i.dns || []).slice() }; }, [dev, nic]);
    const r = await ncpaRow(dev, nic); await r.dblclick(); await p.waitForTimeout(250); await T.btn('Propriétés'); await T.uac(); await p.waitForTimeout(250);
    await T.top().locator('.cmpi', { hasText: 'Protocole Internet version 4' }).first().dblclick(); await p.waitForTimeout(250);
    const sheet = T.top();
    if (field === 'dns') { await sheet.locator('label.chk', { hasText: 'Utiliser l’adresse de serveur DNS suivante' }).locator('input').check(); }
    else { await sheet.locator('label.chk', { hasText: 'Utiliser l’adresse IP suivante' }).locator('input').check(); }
    const boxes = sheet.locator('.ipbox'); const val = field === 'dns' ? (st.value || []) : st.value;
    if (!cur.dhcp || field !== 'dns') {
      const want = { ip: cur.ip, mask: cur.mask, gw: cur.gw }; if (field !== 'dns') want[field] = val;
      await T.setIp(boxes.nth(0), want.ip); await T.setIp(boxes.nth(1), want.mask); await T.setIp(boxes.nth(2), want.gw);
    }
    if (field === 'dns') { await T.setIp(boxes.nth(3), val[0] || ''); await T.setIp(boxes.nth(4), val[1] || ''); }
    else if (cur.dns.length) { await sheet.locator('label.chk', { hasText: 'Utiliser l’adresse de serveur DNS suivante' }).locator('input').check(); await T.setIp(boxes.nth(3), cur.dns[0] || ''); await T.setIp(boxes.nth(4), cur.dns[1] || ''); }
    await T.btn('OK'); await p.waitForTimeout(250);
  });


  /* ---- Console DHCP ---- */
  const dhcpOpen = async dev => { await T.openApp(dev, 'dhcp'); };
  const dhcpScopeRow = async (id) => { const w = p.locator('.win.active').last(); const row = w.locator('.tvr', { has: p.locator('.tvl', { hasText: 'Étendue [' + id + ']' }) }).first(); return row; };
  const dhcpSub = async (id, label) => {   /* sélectionne un sous-nœud d'étendue (déplie l'étendue au besoin) */
    const w = p.locator('.win.active').last(); const sc = await dhcpScopeRow(id); await sc.click();
    let sub = w.locator('.tvr', { has: p.locator('.tvl', { hasText: label }) }); if (!(await sub.count())) { await sc.locator('.tvx').click(); await p.waitForTimeout(150); }
    await w.locator('.tvr', { has: p.locator('.tvl', { hasText: label }) }).first().click(); await p.waitForTimeout(200);
  };
  const dlgTop = () => p.locator('.win.active').last();
  add(st => st.do === 'set' && /\.win\.dhcp\.authorized$/.test(pathOf(st)), async st => {
    await dhcpOpen(dev0(pathOf(st))); const w = p.locator('.win.active').last(); await w.locator('.tvr', { has: p.locator('.tvl', { hasText: /\.toulouse\.local$|\.bordeaux\.local$/ }) }).first().click(); await p.waitForTimeout(200);
    await T.action(st.value ? 'Autoriser' : 'Annuler l’autorisation'); await p.waitForTimeout(200);
  });
  add(st => st.do === 'set' && /\.win\.dhcp\.scopes\[id=[^\]]+\]\.active$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.dhcp\.scopes\[id=([^\]]+)\]\.active$/.exec(pathOf(st)); await dhcpOpen(m[1]); const sc = await dhcpScopeRow(m[2]); await sc.click(); await p.waitForTimeout(200);
    await T.action(st.value ? 'Activer' : 'Désactiver'); await T.confirmYes();
  });
  add(st => st.do === 'set' && /\.win\.dhcp\.scopes\[id=[^\]]+\]\.exclusions$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.dhcp\.scopes\[id=([^\]]+)\]\.exclusions$/.exec(pathOf(st)); await dhcpOpen(m[1]); await dhcpSub(m[2], 'Pool d’adresses');
    const want = (st.value || []).map(e => e.start + '|' + e.end);
    const cur = await p.evaluate(([d, id]) => SIM_APP.run.W.d(d).win.dhcp.scopes.find(s => s.id === id).exclusions.map(e => e.start + '|' + e.end), [m[1], m[2]]);
    for (const c of cur.filter(x => want.indexOf(x) < 0)) {   /* exclusion en trop : clic droit › Supprimer */
      const [a, b] = c.split('|'); const r = p.locator('.win.active').last().locator('.lvr', { hasText: a }).filter({ hasText: 'Adresses IP exclues' }).first();
      await r.click({ button: 'right' }); await T.menuClick('Supprimer'); await T.confirmYes();
    }
    for (const c of want.filter(x => cur.indexOf(x) < 0)) {
      const [a, b] = c.split('|'); await T.action('Nouvelle plage d’exclusion…'); const d = dlgTop(); const boxes = d.locator('.ipbox'); await T.setIp(boxes.nth(0), a); await T.setIp(boxes.nth(1), b); await T.btn('Ajouter', d); await T.btn('Fermer', d);
    }
  });
  add(st => st.do === 'set' && /\.win\.dhcp\.scopes\[id=[^\]]+\]\.options\.\d+$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.dhcp\.scopes\[id=([^\]]+)\]\.options\.(\d+)$/.exec(pathOf(st)); await dhcpOpen(m[1]); await dhcpSub(m[2], 'Options d’étendue'); await T.action('Configurer les options…');
    const d = dlgTop(); const names = { 3: '003 Routeur', 6: '006 Serveurs DNS', 15: '015 Nom de domaine DNS' };
    const rowOpt = d.locator('.chk', { hasText: names[m[3]] }); await rowOpt.locator('span').click();   /* le libellé sélectionne l'option ; la case l'active */
    const chk = rowOpt.locator('input'); if (!(await chk.isChecked())) await chk.check();
    await p.waitForTimeout(150);
    if (m[3] === '15') { await d.locator('input.w10in').last().fill(String(st.value)); }
    else {
      for (let i = 0; i < 6; i++) { const it = d.locator('.dli').first(); if (!(await it.count())) break; await it.click(); await T.btn('Supprimer', d); }
      for (const ip of String(st.value).split(/[,\s]+/).filter(Boolean)) { await T.setIp(d.locator('.ipbox').first(), ip); await T.btn('Ajouter', d); }
    }
    await T.btn('OK', d);
  });
  add(st => st.do === 'set' && /\.win\.dhcp\.scopes\[id=[^\]]+\]\.reservations\[name=[^\]]+\]\.mac$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.dhcp\.scopes\[id=([^\]]+)\]\.reservations\[name=([^\]]+)\]\.mac$/.exec(pathOf(st)); await dhcpOpen(m[1]); await dhcpSub(m[2], 'Réservations');
    const mac = await p.evaluate(([d, n]) => { const dd = SIM_APP.run.W.d(n); const i = dd.ifaces[Object.keys(dd.ifaces)[0]]; return i.mac; }, [m[1], m[3]]);
    const dash = mac.replace(/[:-]/g, '').toUpperCase().match(/.{2}/g).join('-');
    await (await T.row(m[3])).dblclick(); await p.waitForTimeout(250); const d = dlgTop(); await d.locator('input.w10in').nth(1).fill(dash); await T.btn('OK', d);
  });


  /* ---- Gestion de stratégie de groupe (gpmc.msc) ---- */
  const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const gpoModel = (dev, id) => p.evaluate(([d, i]) => { const g = SIM_APP.run.W.d(d).win.ad.gpos.find(x => x.id === i); return g ? JSON.parse(JSON.stringify(g)) : null; }, [dev, id]);
  const gpmcOpen = async dev => { await T.openApp(dev, 'gpmc'); return p.locator('.win.active').last(); };
  /* sélectionne un nœud de l'arbre par data-k ; déplie les parents au besoin (clic sur l'expanseur du premier ancêtre visible) */
  const gTree = async (w, key, ancestors) => {
    const row = w.locator('.tvr[data-k="' + key + '"]');
    for (const a of (ancestors || [])) { if (await row.count()) break; const ar = w.locator('.tvr[data-k="' + a + '"]').first(); if (await ar.count()) { await ar.locator('.tvx').click(); await p.waitForTimeout(120); } }
    if (!(await row.count())) throw new Error('nœud GPMC introuvable : ' + key);
    await row.first().click(); await p.waitForTimeout(250);
  };
  const gGpo = async (dev, id) => { const w = await gpmcOpen(dev); const dom = await p.evaluate(d => SIM_APP.run.W.d(d).win.ad.domain, dev); await gTree(w, 'g:' + id, ['gpos']); return w; };
  const ouChain = dn => { const parts = dn.split(','); const out = []; for (let i = parts.length - 1; i >= 0; i--) { const sub = parts.slice(i).join(','); if (/^DC=/i.test(sub) && i > 0 && /^DC=/i.test(parts[i - 1])) continue; out.push(sub); } return out; };
  const gContainer = async (dev, dn) => { const w = await gpmcOpen(dev); const chain = ouChain(dn).map(x => 'c:' + x); await gTree(w, chain[chain.length - 1], chain.slice(0, -1).reverse()); return w; };
  const GP = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]/;
  /* lien activé / appliqué : clic droit sur la ligne du lien (vue Étendue du GPO) › case à cocher du menu */
  add(st => st.do === 'set' && /\.win\.ad\.gpos\[id=[^\]]+\]\.links\[\d+\]\.(enabled|enforced)$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.links\[(\d+)\]\.(enabled|enforced)$/.exec(pathOf(st)); const g = await gpoModel(m[1], m[2]); const l = g.links[+m[3]];
    const cur = m[4] === 'enabled' ? l.enabled !== false : !!l.enforced; if (cur === !!st.value) return;
    const w = await gGpo(m[1], m[2]); const row = w.locator('.lvr').filter({ has: p.locator('.lvd', { hasText: /^(Oui|Non)$/ }) }).nth(+m[3]);
    await row.click({ button: 'right' }); await T.menuClick(m[4] === 'enabled' ? 'Lien activé' : 'Appliqué');
  });
  /* ordre de liaison : « Déplacer vers le haut / le bas » jusqu'à l'ordre voulu */
  add(st => st.do === 'set' && /\.win\.ad\.gpos\[id=[^\]]+\]\.links\[\d+\]\.order$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.links\[(\d+)\]\.order$/.exec(pathOf(st));
    for (let i = 0; i < 8; i++) {
      const g = await gpoModel(m[1], m[2]); const l = g.links[+m[3]]; if (l.order === st.value) return;
      const w = await gContainer(m[1], l.target); const row = w.locator('.lvr', { has: p.locator('.lvd', { hasText: new RegExp('^' + esc(g.name) + '$') }) }).first();
      await row.click({ button: 'right' }); await T.menuClick(l.order > st.value ? 'Déplacer vers le haut' : 'Déplacer vers le bas'); await closeGpmcDlg();
    }
  });
  const closeGpmcDlg = async () => { await p.waitForTimeout(100); };
  /* état du GPO (liste déroulante de l'onglet Détails) */
  add(st => st.do === 'set' && /\.win\.ad\.gpos\[id=[^\]]+\]\.(userEnabled|compEnabled|enabled)$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.(userEnabled|compEnabled|enabled)$/.exec(pathOf(st)); const g = await gpoModel(m[1], m[2]);
    const f = { enabled: g.enabled !== false, userEnabled: g.userEnabled !== false, compEnabled: g.compEnabled !== false }; f[m[3]] = !!st.value;
    const label = !f.enabled || (!f.userEnabled && !f.compEnabled) ? 'Tous les paramètres désactivés' : !f.userEnabled ? 'Paramètres de configuration utilisateur désactivés' : !f.compEnabled ? 'Paramètres de configuration ordinateur désactivés' : 'Activé';
    const w = await gGpo(m[1], m[2]); await w.locator('.ttab', { hasText: 'Détails' }).click(); await p.waitForTimeout(150); await w.locator('select').last().selectOption({ label }); await p.waitForTimeout(200);
  });
  /* lien supprimé : « Lier un objet de stratégie de groupe existant… » sur le conteneur */
  add(st => st.do === 'set' && /\.win\.ad\.gpos\[id=[^\]]+\]\.links$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.links$/.exec(pathOf(st)); const g = await gpoModel(m[1], m[2]);
    for (const l of (st.value || [])) {
      if ((g.links || []).some(x => x.target.toLowerCase() === l.target.toLowerCase())) continue;
      await gContainer(m[1], l.target); await T.action('Lier un objet de stratégie de groupe existant…'); const d = dlgTop();
      await d.locator('.lvr', { has: p.locator('.lvd', { hasText: new RegExp('^' + esc(g.name) + '$') }) }).first().click(); await T.btn('OK', d);
    }
  });
  const pickNames = async names => { const d = dlgTop(); await d.locator('textarea').fill(names.join('; ')); await T.btn('OK', d); };
  /* filtrage de sécurité (onglet Étendue) */
  add(st => st.do === 'set' && /\.win\.ad\.gpos\[id=[^\]]+\]\.secFilter$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.secFilter$/.exec(pathOf(st)); const g = await gpoModel(m[1], m[2]); const w = await gGpo(m[1], m[2]); const want = st.value || [];
    for (const n of (g.secFilter || []).filter(x => want.indexOf(x) < 0)) { await w.locator('.dli', { hasText: new RegExp('^' + esc(n) + '$') }).first().click(); await T.btn('Supprimer', w); }
    const add_ = want.filter(x => (g.secFilter || []).indexOf(x) < 0); if (add_.length) { await w.locator('.ttab', { hasText: 'Étendue' }).click(); await T.btn('Ajouter…', w); await pickNames(add_); }
  });
  add(st => st.do === 'push' && /\.win\.ad\.gpos\[id=[^\]]+\]\.secFilter$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.secFilter$/.exec(pathOf(st)); const w = await gGpo(m[1], m[2]); await T.btn('Ajouter…', w); await pickNames([st.item]);
  });
  /* droit de lecture (onglet Délégation) */
  add(st => st.do === 'push' && /\.win\.ad\.gpos\[id=[^\]]+\]\.readers$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.readers$/.exec(pathOf(st)); const g = await gpoModel(m[1], m[2]); if ((g.readers || []).indexOf(st.item) >= 0) return;
    const w = await gGpo(m[1], m[2]); await w.locator('.ttab', { hasText: 'Délégation' }).click(); await p.waitForTimeout(150); await T.btn('Ajouter…', w); await pickNames([st.item]);
  });
  /* blocage d'héritage d'une OU */
  add(st => st.do === 'set' && /\.win\.ad\.ous\[dn=[^\]]+\]\.block$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.ous\[dn=([^\]]+)\]\.block$/.exec(pathOf(st)); const cur = await p.evaluate(([d, dn]) => !!SIM_APP.run.W.d(d).win.ad.ous.find(o => o.dn === dn).block, [m[1], m[2]]);
    if (cur === !!st.value) return; await gContainer(m[1], m[2]); await T.action('Bloquer l’héritage');
  });
  /* suppression d'un GPO */
  add(st => st.do === 'del' && /\.win\.ad\.gpos\[id=[^\]]+\]$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]$/.exec(pathOf(st)); await gGpo(m[1], m[2]); await T.action('Supprimer'); await T.confirmYes();
  });
  /* paramètre de stratégie (éditeur de GPO) */
  const EDIT_PATH = { 'acct.lockoutThreshold': ['Stratégies', 'Paramètres Windows', 'Paramètres de sécurité', 'Stratégies de comptes', 'Stratégie de verrouillage du compte', 'Seuil de verrouillage du compte'], 'acct.minPwdLen': ['Stratégies', 'Paramètres Windows', 'Paramètres de sécurité', 'Stratégies de comptes', 'Stratégie de mot de passe', 'Longueur minimale du mot de passe'] };
  add(st => st.do === 'set' && /\.win\.ad\.gpos\[id=[^\]]+\]\.settings\[id=[^\]]+\]\.value$/.test(pathOf(st)) && !!EDIT_PATH[/settings\[id=([^\]]+)\]/.exec(pathOf(st))[1]], async st => {
    const m = /^(.+?)\.win\.ad\.gpos\[id=([^\]]+)\]\.settings\[id=([^\]]+)\]\.value$/.exec(pathOf(st)); const w = await gGpo(m[1], m[2]); await T.action('Modifier…');
    const ed = p.locator('.win.active').last(); const path = EDIT_PATH[m[3]];
    for (let i = 0; i < path.length - 1; i++) { const row = ed.locator('.tvr', { has: p.locator('.tvl', { hasText: new RegExp('^' + esc(path[i]) + '$') }) }).first(); const nxt = ed.locator('.tvr', { has: p.locator('.tvl', { hasText: new RegExp('^' + esc(path[i + 1]) + '$') }) }); if (i + 1 < path.length - 1 && !(await nxt.count())) { await row.locator('.tvx').click(); await p.waitForTimeout(120); } if (i === path.length - 2) await row.click(); }
    await p.waitForTimeout(200); await ed.locator('.lvr', { has: p.locator('.lvd', { hasText: new RegExp('^' + esc(path[path.length - 1]) + '$') }) }).first().dblclick(); await p.waitForTimeout(250);
    const d = dlgTop(); const def = d.locator('label.chk, .chk', { hasText: 'Définir ce paramètre de stratégie' }).locator('input').first(); if (!(await def.isChecked())) await def.check();
    await d.locator('input.w10in').first().fill(String(st.value)); await T.btn('OK', d);
  });


  /* ---- Partages et autorisations NTFS (Explorateur › Propriétés › Partage avancé / Sécurité) ---- */
  const NTFS_KINDS = ['FullControl', 'Modify', 'ReadAndExecute', 'ListDirectory', 'Read', 'Write'], SHARE_KINDS = ['FullControl', 'Modify', 'Read'];
  const parentOf = pth => { const q = pth.replace(/\\$/, ''); const i = q.lastIndexOf('\\'); return i <= 2 ? q.slice(0, i + 1) : q.slice(0, i); };
  const baseOf = pth => pth.replace(/\\$/, '').split('\\').pop();
  const folderProps = async (dev, pth) => {
    await T.openApp(dev, 'explorer', parentOf(pth)); const w = p.locator('.win.active').last();
    await w.locator('.lvr', { has: p.locator('.lvd', { hasText: new RegExp('^' + esc(baseOf(pth)) + '$') }) }).first().click(); await p.waitForTimeout(150);
    await w.locator('button.tbb', { hasText: /^Propriétés$/ }).first().click(); await p.waitForTimeout(300); return dlgTop();
  };
  const whoLabelOf = (dev, who) => p.evaluate(([d, x]) => SIM.ui.whoLabel(SIM_APP.run.W, SIM_APP.run.W.d(d), x), [dev, who]);
  /* boîte « Autorisations pour … » : amène la liste (Autoriser / Refuser par principal) à l'état voulu, par clics */
  const aclEdit = async (dev, kinds, rightsKey, wanted) => {
    const dlg = dlgTop(); const want = {};
    for (const a of wanted) { const g = want[a.who] = want[a.who] || { allow: [], deny: [] }; g[a.type === 'deny' ? 'deny' : 'allow'].push(a[rightsKey]); }
    const labels = {}; for (const who of Object.keys(want)) labels[who] = await whoLabelOf(dev, who);
    const cur = async () => (await dlg.locator('.cmpi').allInnerTexts()).map(x => x.trim());
    for (let i = 0; i < 12; i++) { const extra = (await cur()).find(x => Object.values(labels).indexOf(x) < 0); if (!extra) break; await dlg.locator('.cmpi', { hasText: new RegExp('^\\s*' + esc(extra) + '\\s*$') }).first().click(); await T.btn('Supprimer', dlg); }
    for (const who of Object.keys(want)) {
      if ((await cur()).indexOf(labels[who]) < 0) { await T.btn('Ajouter…', dlg); const d = dlgTop(); await d.locator('input.w10in').first().fill(who); await T.btn('OK', d); await p.waitForTimeout(150); }
      await dlg.locator('.cmpi', { hasText: new RegExp('^\\s*' + esc(labels[who]) + '\\s*$') }).first().click(); await p.waitForTimeout(100);
      const boxes = () => dlg.locator('.permgrid .pc input');
      for (let guard = 0; guard < 14; guard++) { const n = await boxes().count(); let hit = false; for (let i = 0; i < n; i++) { if (await boxes().nth(i).isChecked()) { await boxes().nth(i).uncheck(); hit = true; break; } } if (!hit) break; }
      for (const col of ['allow', 'deny']) for (const r of want[who][col]) { const k = kinds.indexOf(r); if (k < 0) throw new Error('droit sans case : ' + r); await boxes().nth(2 * k + (col === 'deny' ? 1 : 0)).check(); }
    }
    await T.btn('OK', dlg);
  };
  const shareAdv = async (dev, pth) => { const ps = await folderProps(dev, pth); await ps.locator('.ttab', { hasText: 'Partage' }).click(); await p.waitForTimeout(150); await T.btn('Partage avancé…', ps); return dlgTop(); };
  add(st => st.do === 'push' && /\.win\.shares$/.test(pathOf(st)), async st => {
    const dev = dev0(pathOf(st)); const it = st.item; const adv = await shareAdv(dev, it.path);
    const chk = adv.locator('label.chk, .chk', { hasText: 'Partager ce dossier' }).locator('input').first(); if (!(await chk.isChecked())) await chk.check();
    await adv.locator('input.w10in').first().fill(it.name); await T.btn('Autorisations', adv);
    await aclEdit(dev, SHARE_KINDS, 'access', it.perms.map(x => Object.assign({ type: 'allow' }, x))); await T.btn('OK', adv); await T.btn('OK', dlgTop());
  });
  add(st => st.do === 'set' && /\.win\.shares\[name=[^\]]+\]\.perms$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.shares\[name=([^\]]+)\]\.perms$/.exec(pathOf(st)); const pth = await p.evaluate(([d, n]) => SIM_APP.run.W.d(d).win.shares.find(x => x.name === n).path, [m[1], m[2]]);
    const adv = await shareAdv(m[1], pth); await T.btn('Autorisations', adv); await aclEdit(m[1], SHARE_KINDS, 'access', st.value.map(x => Object.assign({ type: 'allow' }, x))); await T.btn('OK', adv); await T.btn('OK', dlgTop());
  });
  const ntfsKey = (dev, rawKey) => p.evaluate(([d, k]) => Object.keys(SIM_APP.run.W.d(d).win.ntfs).find(x => x.toLowerCase().replace(/\\$/, '') === k.toLowerCase()), [dev, rawKey]);
  const secEdit = async (dev, pth, wanted) => { const ps = await folderProps(dev, pth); await ps.locator('.ttab', { hasText: 'Sécurité' }).click(); await p.waitForTimeout(150); await T.btn('Modifier…', ps); await aclEdit(dev, NTFS_KINDS, 'rights', wanted); await T.btn('OK', dlgTop()); };
  add(st => st.do === 'set' && /\.win\.ntfs\..+\.acl$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ntfs\.(.+)\.acl$/.exec(pathOf(st)); await secEdit(m[1], m[2], st.value);
  });
  add(st => st.do === 'push' && /\.win\.ntfs\..+\.acl$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ntfs\.(.+)\.acl$/.exec(pathOf(st)); const k = await ntfsKey(m[1], m[2]);
    const cur = await p.evaluate(([d, kk]) => JSON.parse(JSON.stringify(SIM_APP.run.W.d(d).win.ntfs[kk].acl || [])), [m[1], k]); await secEdit(m[1], m[2], cur.concat([st.item]));
  });
  add(st => st.do === 'set' && /\.win\.ntfs\..+\.inherit$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ntfs\.(.+)\.inherit$/.exec(pathOf(st)); const ps = await folderProps(m[1], m[2]); await ps.locator('.ttab', { hasText: 'Sécurité' }).click(); await p.waitForTimeout(150);
    await T.btn('Avancé', ps); const adv = dlgTop(); await T.btn(st.value ? 'Activer l’héritage' : 'Désactiver l’héritage', adv);
  });


  /* ---- Domaines et approbations Active Directory : l'approbation se supprime / se recrée (la validation ne répare pas) ---- */
  const trustOf = (dev, target) => p.evaluate(([d, t]) => { const x = (SIM_APP.run.W.d(d).win.ad.trusts || []).find(y => y.target.toLowerCase() === t.toLowerCase()); return x ? JSON.parse(JSON.stringify(x)) : null; }, [dev, target]);
  const remoteAdmin = target => p.evaluate(t => { const dc = SIM.ad.byDomain(SIM_APP.run.W, t); const nb = dc.win.ad.netbios; const v = SIM.VAULT.find(c => c.user.toUpperCase() === nb.toUpperCase() + '\\ADMINISTRATEUR'); return { user: nb + '\\Administrateur', pwd: v ? v.secret : '' }; }, target);
  const trustSync = async (dev, target, dir) => {
    const cur = await trustOf(dev, target); const rem = await p.evaluate(([d, t]) => { const A = SIM_APP.run.W.d(d).win.ad; const o = SIM.ad.byDomain(SIM_APP.run.W, t); const r = o && (o.win.ad.trusts || []).find(x => x.target.toLowerCase() === A.domain.toLowerCase()); return r ? { state: r.state, direction: r.direction } : null; }, [dev, target]);
    const inv = { bidirectional: 'bidirectional', inbound: 'outbound', outbound: 'inbound' };
    if (cur && cur.state === 'ok' && cur.direction === dir && rem && rem.state === 'ok' && rem.direction === inv[dir]) return;   /* déjà recréée par une étape précédente */
    await T.openApp(dev, 'domain'); const w = p.locator('.win.active').last(); await w.locator('.tvr[data-k="dom"]').first().click(); await p.waitForTimeout(200); await T.action('Propriétés'); const ps = dlgTop();
    await ps.locator('.ttab', { hasText: 'Approbations' }).click(); await p.waitForTimeout(150);
    if (cur) { await ps.locator('.lvr', { hasText: target }).first().click(); await T.btn('Supprimer', ps); await T.confirmYes(); await p.waitForTimeout(200); }
    await T.btn('Nouvelle approbation…', ps); const d = dlgTop(); const c = await remoteAdmin(target);
    const ins = d.locator('input.w10in, input[type=password]'); await d.locator('input.w10in').first().fill(target); await d.locator('input.w10in').nth(1).fill(c.user); await d.locator('input[type=password]').first().fill(c.pwd);
    await d.locator('label.chk, .chk, label', { hasText: dir === 'bidirectional' ? 'Bidirectionnelle' : dir === 'inbound' ? 'entrante' : 'sortante' }).first().locator('input').check();
    await T.btn('Terminer', d); await p.waitForTimeout(250);
    const err = await d.locator('div[style*="b00020"]').first().innerText().catch(() => ''); if (err && err.trim()) throw new Error('assistant approbation : ' + err.trim());
  };
  add(st => st.do === 'set' && /\.win\.ad\.trusts\[target=[^\]]+\]\.(state|direction)$/.test(pathOf(st)), async st => {
    const m = /^(.+?)\.win\.ad\.trusts\[target=([^\]]+)\]\.(state|direction)$/.exec(pathOf(st)); const cur = await trustOf(m[1], m[2]);
    await trustSync(m[1], m[2], m[3] === 'direction' ? st.value : cur.direction);
  });
  add(st => st.do === 'push' && /\.win\.ad\.trusts$/.test(pathOf(st)), async st => { await trustSync(dev0(pathOf(st)), st.item.target, st.item.direction); });

  /* ---- Date et heure : « Synchroniser maintenant » ---- */
  add(st => st.do === 'set' && /\.clockSkewMin$/.test(pathOf(st)) && +st.value === 0, async st => {
    const dev = dev0(pathOf(st)); await T.openApp(dev, 'datetime'); await T.btn('Synchroniser maintenant', p.locator('.win.active').last()); await T.uac(); await p.waitForTimeout(300);
    const m = p.locator('.win.active').last().locator('button.w10btn', { hasText: /^OK$/ }); if (await m.count()) await m.first().click();
  });

  /* ---- horaires d'accès d'un compte (grille) ---- */
  add(st => st.do === 'set' && /\.win\.ad\.users\[sam=[^\]]+\]\.logonHours$/.test(pathOf(st)) && st.value === null, async st => {
    const m = /^(.+?)\.win\.ad\.users\[sam=([^\]]+)\]\.logonHours$/.exec(pathOf(st)); const ps = await userProps(m[1], m[2], 'Compte'); await T.btn('Horaires d’accès…', ps); const d = dlgTop();
    const a = await d.locator('.lhc').first().boundingBox(), z = await d.locator('.lhc').last().boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 6 }); await p.mouse.up();
    await d.locator('button.w10btn', { hasText: /autorisée/ }).first().click(); await T.btn('OK', d); await T.btn('OK', ps);
  });

  /* ---- réenregistrement des enregistrements du contrôleur (nltest /dsregdns dans une invite de commandes d'administrateur) ---- */
  add(st => st.do === 'ad.regdns', async st => {
    if (!(await T.goDev(st.dev))) {   /* pas de serveur d'ouverture de session : Services depuis PC-ADM › redémarrer Netlogon (il réenregistre ses enregistrements) */
      await T.remote('PC-ADM', 'services', st.dev); await (await T.row('Netlogon')).click(); await T.action('Redémarrer'); await T.waitProgress(); await p.waitForTimeout(300); return;
    }
    await p.evaluate(d => SIM_APP.run.surfaces[d].desk.open('cmd', '', { runas: true }), st.dev); await T.uac(); await p.waitForTimeout(300);
    await p.locator('.win.active').last().locator('.term').first().click(); await p.keyboard.type('nltest /dsregdns'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  });

  return { find: st => { const r = list.find(x => x.match(st)) || (fallback.match(st) ? fallback : null); return r ? { run: r.run } : null; } };
};
