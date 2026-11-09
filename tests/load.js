// Charge les fichiers du moteur et du contenu dans un contexte Node partagé (sans DOM)
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load() {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, Math, Date, JSON, Object, Array, Set, Map, String, Number, RegExp, Error, Promise });
  ctx.globalThis = ctx; ctx.window = undefined;
  const root = path.join(__dirname, '..', 'src');
  const have = d => fs.existsSync(path.join(root, d));
  for (const dir of ['engine', 'content', 'emu']) {
    for (const f of (have(dir) ? fs.readdirSync(path.join(root, dir)) : []).filter(x => x.endsWith('.js')).sort()) {
      const code = fs.readFileSync(path.join(root, dir, f), 'utf8');
      try { vm.runInContext(code, ctx, { filename: dir + '/' + f }); } catch (e) { console.error('ERREUR chargement ' + dir + '/' + f + ': ' + e.stack); process.exit(1); }
    }
  }
  if (process.env.CODES_DUMP) process.on('exit', () => { try { fs.appendFileSync(process.env.CODES_DUMP, JSON.stringify({ seen: ctx.SIM.codes.seen }) + '\n'); } catch (e) { /* rien */ } });   // inventaire des codes par exécution (D-106)
  /* Audit par exécution (D-106) : tout test Node qui fait SORTIR un code d'erreur absent du registre (src/content/09-codes.js) échoue.
     Un test qui en injecte un exprès (tests/codes-audit.js) vide SIM.codes.unlisted avant de finir. */
  process.on('exit', () => { const u = Object.keys(ctx.SIM.codes.unlisted); if (u.length && !process.env.CODES_AUDIT_OFF) { console.error('✗ CODE D’ERREUR AFFICHÉ SANS ENTRÉE AU REGISTRE (D-106) : ' + u.slice(0, 8).join(' ; ') + (u.length > 8 ? ' … (+' + (u.length - 8) + ')' : '')); process.exitCode = process.exitCode || 1; } });
  return ctx.SIM;
};
