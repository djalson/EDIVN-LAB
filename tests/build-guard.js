/* Garde de livraison (D-75) : la construction DOIT échouer si le livrable référence une ressource externe, et réussir sinon.
   Le test construit une copie temporaire de l'arbre : 1. copie saine → code 0 ; 2. copie avec une feuille de style distante → code 3 (neutralisation : sans la garde, elle passerait). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'); let bad = 0; const ck = (ok, m) => { if (!ok) { bad++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-guard-'));
const cp = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? cp(s, d) : fs.copyFileSync(s, d); } };
for (const d of ['src', 'tests']) cp(path.join(root, d), path.join(tmp, d)); fs.copyFileSync(path.join(root, 'build.js'), path.join(tmp, 'build.js')); fs.mkdirSync(path.join(tmp, 'docs'));
const build = () => spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
const a = build(); ck(a.status === 0, 'copie saine : la construction réussit (code 0)');
fs.writeFileSync(path.join(tmp, 'src', 'css', '99-externe.css'), '@import url("https://exemple.invalid/police.css");\n');
const b = build(); ck(b.status === 3 && /ressource externe/.test(b.stdout + b.stderr), 'feuille de style distante ajoutée : la construction ÉCHOUE (code 3, « ressource externe »)');
fs.rmSync(path.join(tmp, 'src', 'css', '99-externe.css'));
const html = fs.readFileSync(path.join(tmp, 'dist', 'EDIVN-Lab.html'), 'utf8');
ck(!/playwright/i.test(html), 'le livrable ne contient aucune trace de Playwright (dépendance de développement, uniquement dans tests/)');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? bad + ' échec(s)' : '0 échec'); process.exit(bad ? 1 : 0);
