#!/usr/bin/env node
/* Assemble le jeu en UN SEUL fichier HTML autonome (hors ligne, aucune dépendance externe).
   Ordre : css/*.css, puis engine → content → emu → ui (ordre alphabétique dans chaque dossier).
   Génère aussi docs/A-VERIFIER.md (registre des détails techniques à confirmer). */
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src');
const list = (d, ext) => (fs.existsSync(path.join(src, d)) ? fs.readdirSync(path.join(src, d)) : []).filter(f => f.endsWith(ext)).sort().map(f => path.join(src, d, f));
const css = list('css', '.css').map(f => '/* ' + path.basename(f) + ' */\n' + fs.readFileSync(f, 'utf8')).join('\n');
const js = ['engine', 'content', 'emu', 'ui'].map(d => list(d, '.js').map(f => '/* ===== ' + d + '/' + path.basename(f) + ' ===== */\n' + fs.readFileSync(f, 'utf8')).join('\n')).join('\n');
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>EDIVN Lab — Simulateur de pannes</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<noscript>Ce simulateur nécessite JavaScript.</noscript>
<script>
'use strict';
${js}
</script>
</body>
</html>
`;
/* Garde de livraison (D-75) : le livrable est UN fichier autonome, hors ligne. Toute ressource externe (script, feuille de style, lien, image distante) arrête la construction.
   Playwright et les tests ne sont donc jamais dans le livrable : ils n'existent que dans tests/ (dépendance de développement). */
const EXTERNE = [[/<script[^>]+\ssrc\s*=/i, '<script src=…>'], [/<link[^>]+rel\s*=\s*["']?stylesheet/i, '<link rel="stylesheet">'], [/<link[^>]+href\s*=\s*["']?https?:/i, '<link href="http…">'], [/@import\s+(url\()?["']?https?:/i, '@import http…'], [/<(img|iframe|source|video|audio)[^>]+\ssrc\s*=\s*["']?https?:/i, 'ressource distante (img/iframe/…)']];
const externes = EXTERNE.filter(([re]) => re.test(html)).map(x => x[1]);
if (externes.length) { console.error('ÉCHEC DE CONSTRUCTION : ressource externe dans le livrable (' + externes.join(', ') + '). Le livrable doit rester un fichier autonome hors ligne.'); process.exit(3); }
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'EDIVN-Lab.html');
fs.writeFileSync(out, html);
const octets = fs.statSync(out).size;
console.log('écrit', out, octets + ' octets (' + (octets / 1024).toFixed(0) + ' Kio)');
/* État du build (D-33) : rejoué à chaque livraison, repris dans PASSATION.md */
try {
  const SIMb = require('./tests/load.js')(); const sha = require('crypto').createHash('sha256').update(fs.readFileSync(out)).digest('hex');
  const nsrc = ['css', 'engine', 'content', 'emu', 'ui'].reduce((n, d) => n + (fs.existsSync(path.join(src, d)) ? fs.readdirSync(path.join(src, d)).length : 0), 0);
  const state = ['# État du build', '', '- fichier : `dist/EDIVN-Lab.html`', '- taille : ' + octets + ' octets', '- sha256 : `' + sha + '`', '- fichiers source assemblés : ' + nsrc, '- pannes de base : ' + SIMb.faults.length, '- compétences : ' + Object.keys(SIMb.skills).length, '- variantes retirées du tirage : ' + (SIMb.RETIRED_VARIANTS || []).length, ''].join('\n');
  fs.writeFileSync(path.join(root, 'docs', 'ETAT-DU-BUILD.md'), state); console.log('docs/ETAT-DU-BUILD.md : ' + octets + ' octets, ' + SIMb.faults.length + ' pannes');
} catch (e) { console.error('état du build non généré :', e.message); }
/* registre « à vérifier » */
try {
  const SIM = require('./tests/load.js')();
  const reg = Object.assign({}, SIM.AVREG || {});
  /* entrées déclarées côté interface (non chargée sous Node) */
  for (const f of fs.readdirSync(path.join(root, 'src', 'ui'))) { const src = fs.readFileSync(path.join(root, 'src', 'ui', f), 'utf8'); const re = /SIM\.AVREG\['([^']+)'\]\s*=\s*'((?:[^'\\]|\\.)*)';/g; let m; while ((m = re.exec(src))) reg[m[1]] = m[2].replace(/\\'/g, "'"); }
  const keys = Object.keys(reg).sort();
  const md = '# Registre « à vérifier »\n\nDétails techniques (Event ID, formats de sortie, libellés, chemins…) reconstitués de mémoire d\'expert et **non confirmés par une capture**. Un faux détail réaliste étant pire qu\'un détail absent, chaque entrée est à confronter à une machine réelle ou à une capture avant diffusion.\n\n' + keys.map(k => '- **' + k + '** — ' + reg[k]).join('\n') + '\n';
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'A-VERIFIER.md'), md);
  console.log('docs/A-VERIFIER.md :', keys.length, 'entrées');
} catch (e) { console.error('registre non généré :', e.message); }
