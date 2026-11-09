/* Régressions moteur : bugs déjà rencontrés, ne doivent jamais revenir. */
'use strict';
const SIM = require('./load.js')(); const N = SIM.net;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
const W = SIM.buildHealthyWorld({ seed: 1 });
/* 1. Une imprimante (sans objet win) passée en DHCP ne doit pas faire planter le serveur DHCP (dhcpCommit lisait client.win.domain). */
let thrown = null, r = null;
try { W.dev['IMP-T1'].ifaces.eth0.dhcp = true; r = N.dhcpRenew(W, 'IMP-T1', 'eth0'); } catch (e) { thrown = e; }
ok(!thrown, 'imprimante en DHCP : pas d’exception (' + (thrown && thrown.message) + ')');
/* 2. Le bail de l’imprimante est bien enregistré côté serveur, sous un nom sans « undefined ». */
const sc = (W.dev['SRV-DC1'].win.dhcp.scopes || []).find(s => s._leases && Object.keys(s._leases).length);
ok(!JSON.stringify(W.dev['SRV-DC1'].win.dhcp.scopes).includes('undefined'), 'baux DHCP : aucun « undefined » dans les noms');
/* 3. D-101 n° 5 / D-12 : donner « Appliquer » à « Utilisateurs authentifiés » (filtrage de sécurité) pour corriger MS16-072 est une FAUSSE RÉSOLUTION ; « Lecture » seule est la correction. */
{ const F = SIM.fault; const def = SIM.faults.find(d => d.id === 'gpo_ms16072');
  const play = (steps, d) => { const Wx = SIM.buildHealthyWorld({ seed: 1 }); const base = Wx.sem(); const inst = F.instantiate(d, 7); F.runSteps(Wx, inst.inject); F.runSteps(Wx, steps(inst)); return F.evaluate(Wx, inst, base).status; };
  ok(play(i => i.fix, def) === 'fixed', 'MS16-072 : « Utilisateurs authentifiés » en Lecture seule → corrigé');
  ok(play(i => i.workarounds['appliquer-a-tous'], def) === 'workaround', 'MS16-072 : « Appliquer » donné à « Utilisateurs authentifiés » → contournement (fausse résolution), pas corrigé');
  /* neutralisation (D-70) : sans les racines « hasNot », le même geste serait jugé corrigé — le contrôle ci-dessus virerait au rouge */
  const weak = Object.assign({}, def, { roots: def.roots.filter(r => !r.hasNot) });
  ok(play(i => i.workarounds['appliquer-a-tous'], weak) === 'fixed', 'neutralisation : racines « hasNot » retirées → « Appliquer à tous » est jugé corrigé (le contrôle virerait au rouge)'); }
/* 4. D-101 n° 6 : gpo_link, variante « délié » — recréer le lien dans la GPMC (ordre « dernier ») est une résolution valide, sans pénalité ; la racine se dérive du modèle. */
{ const F = SIM.fault; const def = SIM.faults.find(d => d.id === 'gpo_link'); const idx = def.vary.m.findIndex(x => x.key === 'delie');
  const play = (d, which) => { const Wx = SIM.buildHealthyWorld({ seed: 1 }); const base = Wx.sem(); const inst = F.instantiate(d, 7, { m: idx }); F.runSteps(Wx, inst.inject); F.runSteps(Wx, which === 'recree' ? inst.fixes['lien-recree'] : inst.fix); return F.evaluate(Wx, inst, base).status; };
  ok(play(def, 'recree') === 'fixed', 'gpo_link « délié » : lien recréé (ordre ≠ d’origine) → corrigé, pas un contournement');
  /* neutralisation : une racine qui compare l'objet lien entier (état d'avant la correction) jugerait le lien recréé « contournement » */
  const strict = Object.assign({}, def, { roots: [{ path: 'SRV-DC1.win.ad.gpos[id=GPO3].links', eq: [{ target: 'OU=Utilisateurs,DC=toulouse,DC=local', enforced: false, enabled: true, order: 1 }] }] });
  ok(play(strict, 'recree') === 'workaround', 'neutralisation : racine « objet lien entier » → le lien recréé est jugé contournement (le contrôle ci-dessus virerait au rouge)'); }
/* 5. D-101 n° 8 : le contenu des dossiers de l'Explorateur est DÉRIVÉ du modèle — un GPO créé dans la GPMC a son dossier dans Policies, un GPO supprimé n'en a plus. */
{ const Wx = SIM.buildHealthyWorld({ seed: 1 }); const dc = Wx.dev['SRV-DC1']; const pol = T => Object.keys(T).filter(k => /\\sysvol\\toulouse\.local\\policies\\\{/.test(k)).length;
  const base = pol(SIM.emu.win.tree(Wx, dc)); dc.win.ad.gpos.push({ id: 'GPO9', name: 'Nouveau', links: [], secFilter: [], readers: [], settings: [] });
  const plus = pol(SIM.emu.win.tree(Wx, dc)); dc.win.ad.gpos = dc.win.ad.gpos.filter(g => g.id !== 'GPO9'); const moins = pol(SIM.emu.win.tree(Wx, dc));
  ok(base === dc.win.ad.gpos.length && plus === base + 1 && moins === base, 'Explorateur du DC : un dossier {GUID} par GPO, créé / retiré avec le GPO (' + base + ' → ' + plus + ' → ' + moins + ')');
  /* neutralisation : une arborescence figée (qui ignorerait le modèle) ne verrait pas le nouveau GPO */
  const figee = (() => { const f = SIM.emu.win.tree(Wx, dc); return () => f; })(); dc.win.ad.gpos.push({ id: 'GPO9', name: 'Nouveau', links: [], secFilter: [], readers: [], settings: [] });
  ok(pol(figee()) === base && pol(SIM.emu.win.tree(Wx, dc)) === base + 1, 'neutralisation : une arborescence figée ne montre pas le GPO créé (le contrôle ci-dessus virerait au rouge)'); dc.win.ad.gpos.pop();
  ok(/ntds/.test(Object.keys(SIM.emu.win.tree(Wx, dc)).join(' ')) && !Object.keys(SIM.emu.win.tree(Wx, SIM.buildHealthyWorld({ seed: 1 }).dev['PC-01'])).some(k => /sysvol/.test(k)), 'NTDS / SYSVOL présents sur le DC, absents d’un poste client'); }
console.log(n + ' assertions, ' + bad + ' échec(s)'); process.exit(bad ? 1 : 0);
