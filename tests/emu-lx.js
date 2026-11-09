const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const dev = process.env.DEV || 'SRV-LNX'; const user = process.env.USR || 'tech';
let sh = SIM.emu.openLxShell(env, dev, { user });
const out = (r) => r.out.map(x => x.t).join('\n');
const argv = process.argv.slice(2);
const cmds = argv.length ? argv : ['id', 'pwd', 'ls', 'ls -la', 'cat /etc/hostname', 'cat /etc/shadow', 'ls /root', 'echo hi > /etc/x', 'cat /etc/passwd | grep bash', 'df -h', 'uname -a', 'sudo ls /root'];
for (const c of cmds) {
  try {
    let r = sh.exec(c); let txt = out(r);
    while (r.ask) { const pw = (sh.d.pwds || {})[user]; console.log('[ASK ' + r.ask.prompt + ']'); r = sh.exec(process.env.PW !== undefined ? process.env.PW : pw); txt += '\n' + out(r); }
    if (r.edit) txt += '\n[EDIT ' + r.edit.editor + ' ' + r.edit.path + ' ' + r.edit.text.length + ']';
    if (r.push) txt += '\n[PUSH]';
    console.log(sh.prompt() + c + '\n' + txt);
  } catch (e) { console.log('!!! ' + c + '\n' + e.stack.split('\n').slice(0, 5).join('\n')); }
}
