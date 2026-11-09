// Parcours SSH interactif : on tape des lignes dans une pile de sessions comme le ferait l'UI.
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const start = process.env.START || 'PC-ADM';
const kind = process.env.KIND || 'win';
let stack = [kind === 'win' ? SIM.emu.openWinShell(env, start, {}) : SIM.emu.openLxShell(env, start, { user: process.env.USR || 'tssr' })];
const lines = process.argv.slice(2);
for (const c of lines) {
  const sh = stack[stack.length - 1]; const pp = sh.prompt();
  const r = sh.exec(c); const txt = r.out.map(x => x.t).join('\n');
  console.log(pp + (sh.secret && sh.secret() ? '' : c) + (txt ? '\n' + txt : ''));
  if (r.push) { stack.push(r.push); const b = (r.push.banner ? r.push.banner() : []).map(x => x.t).join('\n'); if (b.trim()) console.log(b); }
  if (r.exit || r.pop) { if (stack.length > 1) stack.pop(); }
}
