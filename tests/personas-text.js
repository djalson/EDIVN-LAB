/* Personnalités : le texte d'un ticket change de ton, jamais de fond. Pour chaque panne × variante signée par un utilisateur à caractère :
   tous les éléments techniques du texte d'origine (machines, adresses, chemins, chiffres, sigles) sont encore là, dans le même ordre. */
const SIM = require('./load.js')(); const F = SIM.fault, PS = SIM.personas;
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const TECH = /[\w\\\/.:@-]*[\d\\\/@][\w\\\/.:@-]*|\b[A-Z]{2,}[\w-]*|«[^»]*»/g;
let n = 0, changed = 0; const bad = []; const seenBy = {};
for (const def of SIM.faults) for (const combo of F.variantCombos(def, 8)) for (const seed of ['p1', 'p2', 'p3']) {
  const i = F.instantiate(def, 7, combo); const p = PS.of(i.ticket.from); if (!p) continue; n++; const src = i.ticket.body; const out = PS.say(i.ticket.from, src, seed + def.id); seenBy[p.key] = (seenBy[p.key] || 0) + 1;
  const a = src.match(TECH) || [], b = out.match(TECH) || [];
  let k = 0; for (const tok of b) { if (k < a.length && tok === a[k]) k++; }
  if (k < a.length) bad.push(def.id + ' : « ' + a[k] + ' » perdu\n      ' + src + '\n      → ' + out);
  else if (/\bundefined\b|\bnull\b|  /.test(out) || out.length < src.length * 0.6) bad.push(def.id + ' : texte abîmé → ' + out);
  if (out !== src) changed++;
}
ok(n > 600, n + ' textes de tickets passés par une personnalité ' + JSON.stringify(seenBy)); ok(changed > n * 0.95, 'le ton change (' + changed + ' / ' + n + ')');
ok(!bad.length, 'aucun élément technique perdu ni texte abîmé' + (bad.length ? ' — ' + bad.length + ' cas' : '')); bad.slice(0, 8).forEach(x => console.log('    ' + x));
ok(PS.say('Alice Martin (la comptabilité)', 'Bonjour, test.', 's') === PS.say('Alice Martin (la comptabilité)', 'Bonjour, test.', 's'), 'même graine → même texte');
ok(PS.say('Admin TSSR (informatique)', 'Bonjour, test.', 's') === 'Bonjour, test.', 'auteur sans personnalité : texte inchangé');
const m = SIM.game.create({ level: 1, mode: 'free', seed: 'pz', faultId: 'dns_cache' }); ok(!m.fault.ticket.trait, 'sans l’option personas : ticket brut (tests et mode d’origine inchangés)');
const m2 = SIM.game.create({ level: 1, mode: 'free', seed: 'pz', faultId: 'dns_cache', personas: true }); ok(m2.fault.ticket.trait && m2.fault.ticket.body !== m.fault.ticket.body, 'avec l’option : ' + m2.fault.ticket.body.slice(0, 90) + '…');
console.log(fails ? '✗ ' + fails + ' échec(s)' : 'OK'); process.exit(fails ? 1 : 0);
