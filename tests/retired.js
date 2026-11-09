/* Variantes retirées du jeu (SIM.RETIRED_VARIANTS) : jamais tirées (tirage, mission composée, « Panne précise »), contenu conservé,
   retrait réversible d'un mot. Neutralisation (D-70) : liste vidée → le même contrôle DOIT échouer. Usage : node tests/retired.js */
'use strict';
const SIM = require('./load')(); const F = SIM.fault; const G = SIM.game;
const blank = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
const RET = SIM.RETIRED_VARIANTS.slice();
let bad = 0; const ck = (ok, msg) => { if (!ok) { bad++; console.log('✗ ' + msg); } else console.log('✓ ' + msg); };

/* contrôle : renvoie le nombre de fois où une variante retirée est tirée, par chaque chemin du jeu */
const leaks = (heavy) => {
  const out = { instantiate: 0, composee: 0, precise: 0, niveaux: 0 };
  const hit = i => RET.some(r => r.fault === i.id && i.vars && i.vars[r.vary] && i.vars[r.vary].key === r.key);
  for (const r of RET) { const def = SIM.faults.find(d => d.id === r.fault); for (let s = 1; s <= 120; s++) if (hit(F.instantiate(def, 's' + s))) out.instantiate++; }
  if (heavy) for (let s = 1; s <= 12; s++) { const b = F.bundle('t' + s, { count: 3, mode: 'auto' }); b.parts.forEach(i => { if (hit(i)) out.composee++; }); }
  for (const r of RET) for (let s = 1; s <= 12; s++) { const g = G.create({ seed: 'p' + s, level: 'confirme', mode: 'free', faultId: r.fault, clock: () => 0, profile: blank() }); (g.fault && hit(g.fault)) && out.precise++; }
  if (heavy) for (const lv of ['admin', 'cyber', 'chaos']) for (let s = 1; s <= 3; s++) { const g = G.create({ seed: 'lv' + s, level: lv, mode: 'free', clock: () => 0, profile: blank() }); (g.parts || [g.fault]).forEach(i => { if (i && hit(i)) out.niveaux++; }); }
  return out;
};

const a = leaks(true); ck(a.instantiate + a.composee + a.precise + a.niveaux === 0, 'variantes retirées jamais tirées (' + JSON.stringify(a) + ')');
/* le contenu est conservé : la variante existe toujours et peut être forcée par un test */
for (const r of RET) { const def = SIM.faults.find(d => d.id === r.fault); const idx = def.vary[r.vary].findIndex(x => x.key === r.key); ck(idx >= 0, r.fault + ' : variante « ' + r.key + ' » conservée dans le contenu'); const inst = F.instantiate(def, 1, { [r.vary]: idx }); ck(inst.vars[r.vary].key === r.key, r.fault + ' : variante « ' + r.key + ' » reste forçable par un test'); }
/* la variante « compte ordinateur désactivé » reste en jeu */
{ const def = SIM.faults.find(d => d.id === 'ad_secure_channel'); const keys = new Set(); for (let s = 1; s <= 60; s++) keys.add(F.instantiate(def, 'k' + s).vars.m.key); ck(keys.has('compte') && !keys.has('canal'), 'ad_secure_channel : seule la variante « compte » est tirée (' + Array.from(keys) + ')'); }
/* neutralisation : liste vidée → la fuite réapparaît, le contrôle virerait au rouge */
SIM.RETIRED_VARIANTS.length = 0; const b = leaks(false); SIM.RETIRED_VARIANTS.push(...RET);
ck(b.instantiate > 0, 'neutralisation : liste vidée → les variantes retirées sont de nouveau tirées (' + b.instantiate + ' fois sur ' + (120 * RET.length) + ' tirages) : le contrôle ci-dessus virerait au rouge');
/* chaque variante retirée est tirée une fois la liste vidée (aucune entrée « décorative ») */
for (const r of RET) { SIM.RETIRED_VARIANTS.length = 0; const def = SIM.faults.find(d => d.id === r.fault); let n = 0; for (let s = 1; s <= 120; s++) { const i = F.instantiate(def, 's' + s); if (i.vars && i.vars[r.vary] && i.vars[r.vary].key === r.key) n++; } SIM.RETIRED_VARIANTS.push(...RET); ck(n > 0, 'neutralisation : ' + r.fault + ' « ' + r.key + ' » est tirée quand la liste est vidée (' + n + '/120)'); }
/* nombre de combinaisons de variantes (produit cartésien) avant / après */
const comb = (excl) => SIM.faults.reduce((n, d) => { const keys = Object.keys(d.vary || {}); let c = 1; for (const k of keys) c *= (d.vary[k] || []).filter(x => !(excl && SIM.RETIRED_VARIANTS.some(r => r.fault === d.id && r.vary === k && x && x.key === r.key))).length; return n + c; }, 0);
console.log('Pannes : ' + SIM.faults.length + ' · combinaisons de variantes : ' + comb(false) + ' avant retrait → ' + comb(true) + ' après retrait');
console.log(bad ? bad + ' échec(s)' : '0 échec');
process.exit(bad ? 1 : 0);
