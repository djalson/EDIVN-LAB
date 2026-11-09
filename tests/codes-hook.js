/* Collecte des codes d'erreur affichés PAR EXÉCUTION (D-106) : à précharger dans les tests.
     CODES_DUMP=/chemin/fichier.jsonl NODE_PATH=$(npm root -g) NODE_OPTIONS="--require ./tests/codes-hook.js" node tests/all.js --only=...
   - tests Node : tests/load.js lit CODES_DUMP lui-même ;
   - tests Playwright : ce fichier enveloppe chromium.launch, relève SIM.codes.seen de chaque page avant sa fermeture.
   Sortie : une ligne JSON { seen } par processus, fusionnée ensuite par tests/codes-inventory.js. */
'use strict';
const fs = require('fs');
const OUT = process.env.CODES_DUMP; if (!OUT) return;
let pw; try { pw = require('playwright'); } catch (e) { return; }
const seen = {};
const merge = s => { for (const k of Object.keys(s || {})) { const a = seen[k] || (seen[k] = { n: 0, ctx: [], kind: s[k].kind }); a.n += s[k].n; (s[k].ctx || []).forEach(c => { if (a.ctx.indexOf(c) < 0) a.ctx.push(c); }); } };
const grab = async p => { try { const s = await p.evaluate(() => (window.SIM && window.SIM.codes) ? JSON.stringify(window.SIM.codes.seen) : null); if (s) merge(JSON.parse(s)); } catch (e) { /* page fermée */ } };
const orig = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async function () {
  const b = await orig.apply(null, arguments); const pages = new Set();
  const np = b.newPage.bind(b);
  b.newPage = async function () {
    const p = await np.apply(null, arguments); pages.add(p);
    const timer = setInterval(() => grab(p), 2000); p.on('close', () => clearInterval(timer));
    const pc = p.close.bind(p); p.close = async function () { await grab(p); return pc.apply(null, arguments); };
    return p;
  };
  const bc = b.close.bind(b); b.close = async function () { for (const p of pages) await grab(p); return bc.apply(null, arguments); };
  return b;
};
process.on('exit', () => { try { fs.appendFileSync(OUT, JSON.stringify({ seen }) + '\n'); } catch (e) { /* rien */ } });
