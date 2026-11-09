const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const dev = process.env.DEV || 'SW-T2';
const sh = SIM.emu.openIos(env, dev, { via: 'console' });
const argv = process.argv.slice(2);
for (const c of argv) {
  const pp = sh.prompt();
  if (c.endsWith('?') ) { const h = sh.help(c.slice(0, -1)); console.log(pp + c + '\n' + (h.out || h).map(x => x.t !== undefined ? x.t : x).join('\n')); continue; }
  if (c.endsWith('\t')) { console.log(pp + c.replace('\t', '<TAB>') + ' → ' + JSON.stringify(sh.complete(c.slice(0, -1)))); continue; }
  let r = sh.exec(c); let txt = r.out.map(x => x.t).join('\n');
  let g = 0; while (r.ask && g++ < 4) { console.log('[ASK ' + r.ask.prompt + ']'); r = sh.exec(process.env.ANS || 'yes'); txt += '\n' + r.out.map(x => x.t).join('\n'); }
  console.log(pp + c + (txt.trim() ? '\n' + txt : ''));
}
