/* Plan d'adressage attendu (SIM.plan) : lu dans le monde sain, donc cohérent avec lui. Plusieurs graines. */
'use strict';
const SIM = require('./load.js')(); const U = SIM.U;
let n = 0, bad = 0; const ok = (c, msg) => { n++; if (!c) { bad++; console.log('  ✗ ' + msg); } };
for (const seed of [1, 2, 7, 42, 4243]) {
  const W = SIM.buildHealthyWorld({ seed }); const P = SIM.plan(W); const tag = ' (graine ' + seed + ')';
  ok(P.devices.length === Object.keys(W.dev).length, 'tous les équipements du monde sont listés' + tag);
  ok(P.devices.every(id => P.rows.some(r => r.dev === id)), 'chaque équipement a au moins une ligne' + tag);
  const ips = P.rows.filter(r => r.ip).map(r => r.ip); ok(new Set(ips).size === ips.length, 'aucune adresse IP en double' + tag);
  ok(P.rows.filter(r => r.ip).every(r => U.isIP(r.ip) && U.validMask(r.mask) && r.cidr === r.ip + '/' + U.mask2len(r.mask)), 'IP, masque et CIDR valides et cohérents' + tag);
  const gwOk = P.rows.filter(r => r.ip && r.gw && r.mode).every(r => r.dev.indexOf('pfSense') === 0 || U.sameNet(r.ip, r.gw, r.mask)); ok(gwOk, 'la passerelle est dans le sous-réseau de la carte' + tag);
  ok(P.rows.filter(r => r.mode === 'DHCP').every(r => r.ip && r.gw && r.dns.length && /Bail attribué/.test(r.note)), 'les lignes DHCP portent l’adresse du bail normal' + tag);
  ok(P.rows.every(r => !/null|undefined|NaN/.test(JSON.stringify(r))), 'aucune valeur « null / undefined / NaN »' + tag);
  /* chaque IP du plan est bien portée par l'interface correspondante du monde */
  const real = new Set(); for (const id of Object.keys(W.dev)) { const d = W.dev[id]; [d.ifaces, d.svi].forEach(o => Object.keys(o || {}).forEach(k => { const f = o[k]; if (f.ip) real.add(id + '|' + f.ip); if (f._lease) real.add(id + '|' + f._lease.ip); })); }
  ok(P.rows.filter(r => r.ip).every(r => real.has(r.dev + '|' + r.ip)), 'chaque IP du plan existe sur l’équipement indiqué' + tag);
}
const W = SIM.buildHealthyWorld({ seed: 1 }); const pc = SIM.plan(W).rows.find(r => r.dev === 'PC-01');
ok(pc && pc.ip === '10.10.20.50' && pc.mask === '255.255.255.0' && pc.gw === '10.10.20.1' && pc.dns[0] === '10.10.10.10' && /^20/.test(pc.vlan), 'PC-01 : 10.10.20.50/24, passerelle 10.10.20.1, DNS 10.10.10.10, VLAN 20');
console.log(n + ' assertions, ' + bad + ' échec(s)'); process.exit(bad ? 1 : 0);
