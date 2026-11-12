/* Cache DNS client : une entrée vit le TTL de l'enregistrement (comme Windows), pas 300 s fixes.
   Régression : la panne dns_cache (ancienne adresse en cache) se réparait toute seule au bout de 5 min de jeu. */
const SIM = require('./load.js')(); const N = SIM.net;
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const adv = (W, s) => { for (let i = 0; i < s / 5; i++) SIM.sched.advance(W, 5); };
const m = SIM.game.create({ level: 1, mode: 'free', faultId: 'dns_cache', seed: 'ttl1' }); const W = m.W;
ok(N.resolve(W, 'PC-01', 'srv-fic').ip === '10.10.10.200', 'dns_cache : ancienne adresse servie par le cache');
adv(W, 900);
ok(N.resolve(W, 'PC-01', 'srv-fic').ip === '10.10.10.200', 'dns_cache : toujours en panne après 15 min (le cache ne se vide pas tout seul)');
ok(m.check() !== 'resolved' && m.state === 'running', 'dns_cache : le ticket ne se résout pas sans intervention');
W.d('PC-01')._rt.dnsCache = {};   /* ipconfig /flushdns */
const r = N.resolve(W, 'PC-01', 'srv-fic'); ok(r.ip === '10.10.10.20' && !r.cached, 'après flushdns : bonne adresse, demandée au DNS');
const e = W.d('PC-01')._rt.dnsCache['srv-fic.toulouse.local']; ok(e && e.ttl === 3600, 'entrée mise en cache avec le TTL de l’enregistrement (3600 s)');
adv(W, 3600); ok(!W.d('PC-01')._rt.dnsCache['srv-fic.toulouse.local'], 'entrée expirée au bout de son TTL');
ok(SIM.sched.cacheTtl({ neg: true }) === 900 && SIM.sched.cacheTtl({}) === 300, 'réponse négative 900 s ; entrée sans TTL connu : 300 s');
console.log(fails ? '✗ ' + fails + ' échec(s)' : 'OK'); process.exit(fails ? 1 : 0);
