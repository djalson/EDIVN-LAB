const SIM = require('./load')();
const W = SIM.buildHealthyWorld({ seed: 1 });
const N = SIM.net;
const x = N.connect(W, 'PCEXT', '192.0.2.2', 'tcp', 80, {});
console.log(JSON.stringify(x, null, 1).slice(0, 2500));
console.log(JSON.stringify(W.dev['SRV-RV'].svc), N.connect(W, 'PC-RV1', '172.16.3.10', 'tcp', 80, {}).state);
