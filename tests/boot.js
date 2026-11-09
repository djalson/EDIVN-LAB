const SIM = require('./load')();
const W = SIM.buildHealthyWorld({ seed: 1 });
const N = SIM.net;
const show = (l, v) => console.log(l.padEnd(46), typeof v === 'string' ? v : JSON.stringify(v));
for (const id of ['PC-01', 'PC-02', 'PC-B1', 'PC-RV2']) { const i = W.dev[id].ifaces.Ethernet0; show('bail ' + id, i._lease ? i._lease.ip + ' gw ' + i._lease.gw + ' dns ' + (i._lease.dns || []).join(',') : (i._apipa || 'rien')); }
const p = (a, b) => { const r = N.ping(W, a, b); show('ping ' + a + ' -> ' + b, r.ok ? 'OK' : 'ECHEC ' + (r.kind || '') + ' ' + (r.trace ? N.describeFail(r.trace) : '')); };
p('PC-01', '10.10.10.10'); p('PC-01', '10.10.20.1'); p('PC-01', '10.10.10.20'); p('PC-01', '8.8.8.8'); p('PC-01', '10.20.10.10'); p('PC-B1', '10.10.10.10'); p('PC-ADM', '10.10.10.30');
p('PC-RV2', '8.8.8.8'); p('PC-RV2', '172.16.3.10'); p('PC-RV1', '172.16.3.10'); p('PCEXT', '198.51.100.2');
const r = (h, n) => { const x = N.resolve(W, h, n, { noCache: true }); show('dns ' + h + ' ' + n, x.ok ? x.ip : 'ECHEC ' + x.err); };
r('PC-01', 'srv-dc1'); r('PC-01', 'srv-fic.toulouse.local'); r('PC-01', 'www.exemple.fr'); r('PC-01', 'dc2.bordeaux.local'); r('PC-01', 'srv-dc2.bordeaux.local'); r('PC-01', 'www.labo.toulouse.local'); r('PC-01', 'portail'); r('PC-B1', 'srv-dc1.toulouse.local');
const c = (a, b, pr, po) => { const x = N.connect(W, a, b, pr, po); show('connect ' + a + ' -> ' + b + ':' + po, x.state + (x.trace && !x.trace.ok ? ' ' + N.describeFail(x.trace) : '')); };
c('PC-01', '10.10.10.20', 'tcp', 80); c('PC-01', '10.10.10.20', 'tcp', 445); c('PC-01', '10.10.10.30', 'tcp', 80); c('PC-ADM', '10.10.10.30', 'tcp', 22); c('PC-ADM', '10.10.50.10', 'tcp', 22);
c('PCEXT', '198.51.100.2', 'tcp', 443); c('PCEXT', '192.0.2.2', 'tcp', 80); c('PC-01', '93.184.216.34', 'tcp', 443); c('PC-01', '10.10.10.30', 'tcp', 3306); c('PC-01', '10.10.50.10', 'tcp', 80);
c('PC-ADM', '10.10.0.1', 'tcp', 443); c('PC-ADM', '10.20.10.10', 'tcp', 3389);
