const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const dev = process.env.DEV || 'SW-T2';
let sh = SIM.emu.openIos(env, dev, { via: 'console' });
const out = (r) => r.out.map(x => x.t).join('\n');
const argv = process.argv.slice(2);
const cmds = argv.length ? argv : ['show version', 'show vlan brief', 'show ip interface brief'];
for (const c of cmds) {
  try {
    const pp = sh.prompt(); let r = sh.exec(c); let txt = out(r);
    while (r.ask) { console.log('[ASK ' + r.ask.prompt + ']'); r = sh.exec(process.env.ANS || 'yes'); txt += '\n' + out(r); }
    console.log(pp + c + (txt ? '\n' + txt : ''));
  } catch (e) { console.log('!!! ' + c + '\n' + e.stack.split('\n').slice(0, 6).join('\n')); }
}
