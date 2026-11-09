/* Génère docs/CODES-ERREUR.md (D-106) : une ligne par code que le jeu peut afficher.
   Sources : (1) balayage statique de src/ (où le code est écrit, le texte qui l'accompagne) ; (2) registre src/content/09-codes.js (statut) ;
   (3) docs/codes-vus.json : ce que l'EXÉCUTION a effectivement fait sortir (contextes d'affichage, nombre), fusionné depuis les fichiers
       produits par tests/codes-hook.js et tests/load.js :
         CODES_DUMP=/tmp/c.jsonl NODE_PATH=$(npm root -g) NODE_OPTIONS="--require ./tests/codes-hook.js" node tests/all.js
         node tests/codes-inventory.js /tmp/c.jsonl            (fusionne puis régénère)
         node tests/codes-inventory.js                          (régénère depuis docs/codes-vus.json)
   Ce script ne vérifie rien : la colonne « Origine » dit d'où vient la valeur AUJOURD'HUI, jamais qu'elle est exacte. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const SIM = require('./load')();
const vusPath = path.join(root, 'docs', 'codes-vus.json');
let vus = {}; try { vus = JSON.parse(fs.readFileSync(vusPath, 'utf8')); } catch (e) { vus = {}; }
for (const f of process.argv.slice(2)) fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).forEach(l => { let o; try { o = JSON.parse(l); } catch (e) { return; } Object.keys(o.seen || {}).forEach(k => { const a = vus[k] || (vus[k] = { n: 0, ctx: [], kind: o.seen[k].kind }); a.n += o.seen[k].n; (o.seen[k].ctx || []).forEach(c => { if (a.ctx.indexOf(c) < 0) a.ctx.push(c); }); }); });
fs.writeFileSync(vusPath, JSON.stringify(Object.keys(vus).sort().reduce((m, k) => (m[k] = vus[k], m), {}), null, 1) + '\n');
const RE = /(%[A-Z][A-Z0-9_]*-\d-[A-Z][A-Z0-9_]*)|(ERROR \d{4} \([0-9A-Z]{5}\))|(\d{3,5} 0x[0-9a-fA-F]{2,4} ERROR_[A-Z_]+)|((?:NET::)?(?:DNS_ERROR_[A-Z_]+|ERROR_[A-Z_]+|SEC_E_[A-Z_]+|ERR_[A-Z][A-Z0-9_]+))|(\b0x[89A-Fa-f][0-9A-Fa-f]{7}\b)|(\bHTTP [45]\d\d(?:\.\d{1,2})?\b)/g;
const idOf = (m, g) => g[1] ? 'ios:' + m : g[2] ? 'sql:' + m : g[3] ? 'name:' + m.replace(/^\d+ 0x[0-9a-fA-F]+ /, '') : g[4] ? 'name:' + m : g[5] ? 'hex:' + m.toUpperCase().replace(/^0X/, '0x') : 'http:' + m.replace(/^HTTP /, '');
const where = {};   // id → [{file, line}]
(function walk(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f) && !/engine\/01-codes\.js$/.test(p)) { fs.readFileSync(p, 'utf8').split('\n').forEach((ln, i) => { let m; RE.lastIndex = 0; while ((m = RE.exec(ln))) { const id = idOf(m[0], m); (where[id] = where[id] || []).push({ file: p.replace(/^.*src\//, ''), line: i + 1, text: ln.trim() }); } }); } } })(path.join(root, 'src'));
const faultOf = {};   // id → pannes dont le contenu (src/content) cite le code
SIM.faults.forEach(f => { const s = JSON.stringify(f, (k, v) => typeof v === 'function' ? undefined : v); Object.keys(where).forEach(id => { const tok = id.replace(/^[a-z]+:/, ''); if (s.indexOf(tok) >= 0) (faultOf[id] = faultOf[id] || []).push(f.id); }); });
const R = SIM.CODES; const ids = Array.from(new Set(Object.keys(R).concat(Object.keys(where), Object.keys(vus)))).sort();
const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const snip = a => { const t = a.text.replace(/\s+/g, ' '); const i = t.search(/%|ERROR|ERR_|0x|HTTP|DNS_|SEC_E/); return t.slice(Math.max(0, i - 40), i + 110); };
const out = [];
out.push('# Codes d\'erreur affichés par le simulateur (D-106)\n');
out.push('*Fichier généré par `node tests/codes-inventory.js` (ne pas éditer à la main). Il constate ; il ne vérifie rien : **aucun code n\'est « vérifié » à ce jour**, c\'est le projet qui vérifie (D-106) et qui rend la liste blanche. Les valeurs viennent de la mémoire de l\'auteur du code, sans source jointe.*\n');
const cnt = s => ids.filter(i => (R[i] || {}).status === s).length;
out.push('## Synthèse\n');
out.push('| | Nombre |\n|---|---|');
out.push('| Codes au registre (`src/content/09-codes.js`) | ' + Object.keys(R).length + ' |');
out.push('| dont masqués (numéro retiré, texte conservé) | ' + cnt('masque') + ' |');
out.push('| dont non vérifiés (affichés) | ' + cnt('non-verifie') + ' |');
out.push('| dont vérifiés | ' + cnt('verifie') + ' |');
out.push('| Codes écrits dans le source sans entrée au registre | ' + ids.filter(i => !R[i] && where[i] && !/^hex:0xFFFFFFFF$|^name:NET::ERR_CERT_$/.test(i)).length + ' (le test `tests/codes-audit.js` échoue s\'il y en a) |');
out.push('| Codes vus à l\'exécution (batterie instrumentée, `docs/codes-vus.json`) | ' + Object.keys(vus).length + ' |');
out.push('| Codes écrits dans le source mais jamais vus à l\'exécution | ' + ids.filter(i => R[i] && !vus[i]).length + ' (chemins non joués par la batterie, ou affichés par le journal d\'événements non joué) |\n');
out.push('## Lecture\n');
out.push('- **Statut** : `masque` = le numéro ne sort pas ; `non-verifie` = il sort ; `verifie` = posé par le projet seul.');
out.push('- **Vu à l\'exécution** : nombre d\'émissions et contextes d\'affichage (`terminal`, `journal`, `dialogue`, `navigateur`, `trace`) relevés pendant la batterie complète. « — » = jamais vu : le code existe dans le source mais aucun test ne l\'a fait sortir.');
out.push('- **Pannes** : pannes dont la définition (ticket, cause, indices, correction) cite le code. Ce n\'est PAS la liste des pannes qui le font afficher : un code produit par le moteur (par exemple une ligne de journal IOS) peut apparaître dans des pannes que cette colonne ne nomme pas. Colonne **à compléter** par exécution panne par panne (travail non fait).');
out.push('- **Origine** : pour tous, « mémoire de l\'auteur du code, aucune source jointe ». Aucune capture ni documentation officielle n\'est rattachée à ces valeurs dans le dépôt.\n');
out.push('## Inventaire\n');
out.push('| Code | Statut | Texte qui l\'accompagne (extrait du source) | Écrit dans | Vu à l\'exécution | Pannes citant le code | Origine |\n|---|---|---|---|---|---|---|');
ids.forEach(id => {
  const w = where[id] || []; const v = vus[id]; const st = (R[id] || {}).status || '**ABSENT DU REGISTRE**';
  const files = Array.from(new Set(w.map(a => a.file + ':' + a.line))).slice(0, 4).join(', ') + (w.length > 4 ? ' …' : '') || ((R[id] || {}).from || '—');
  const txt = w.length ? '`' + esc(snip(w[0])).replace(/`/g, '') + '`' : (id.startsWith('evt:') ? 'journal d\'événements (voir `src/engine/30-win.js`, `35-ad.js`)' : '—');
  const nm = id.replace(/^[a-z]+:/, '');
  out.push('| `' + nm.replace(/\|/g, '/') + '` | ' + st + ' | ' + txt + ' | ' + esc(files || '—') + ' | ' + (v ? v.n + ' (' + v.ctx.join(', ') + ')' : '—') + ' | ' + ((faultOf[id] || []).slice(0, 6).join(', ') || '—') + ' | mémoire de l\'auteur du code, aucune source jointe |');
});
out.push('\n## Ce que cet inventaire ne dit pas\n');
out.push('- **Les Event ID ne sont pas dans le source sous forme de texte** : ils passent par le journal (`WIN.evt`, `AD.evSec`). Leur ligne « Écrit dans » vient du registre, pas du balayage. Dix identifiants sont enregistrés : 1046, 1063, 1502 (masqués), 1058, 1129, 4624, 4625, 4740, 4771, 7036 (non vérifiés).');
out.push('- **Codes dans les textes de contenu** (ticket, cause, solution, indices, chemin optimal) : ces textes ne passent pas par le point d\'émission unique. Exemple : l\'événement 1046 est masqué dans le journal mais cité dans la cause et le chemin optimal de `dhcp_unauth` et de `dhcp_unauth_bdx`. Écart à trancher par le projet (proposition dans `DECISIONS-PROPOSEES.md`).');
out.push('- **Valeurs numériques sans forme reconnue** (code d\'échec Kerberos `0x25`, `0x18`, `Statut : …` des événements 4625) : hors des familles que le mécanisme sait reconnaître. À traiter avec le projet.');
out.push('- **Sous-statuts d\'authentification** (ex. `0xC000006A`) sont des NTSTATUS : ils sont inscrits au registre, mais leur sens dans un événement 4625 attend une source.');
fs.writeFileSync(path.join(root, 'docs', 'CODES-ERREUR.md'), out.join('\n') + '\n');
console.log('docs/CODES-ERREUR.md : ' + ids.length + ' codes, ' + Object.keys(vus).length + ' vus à l\'exécution');
