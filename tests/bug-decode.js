/* Décode le bloc « Données techniques » d'un rapport de bug (fichier texte en argument, ou entrée standard) et rejoue le départ du ticket.
   Usage : node tests/bug-decode.js rapport.txt */
const fs = require('fs'); const txt = fs.readFileSync(process.argv[2] || 0, 'utf8');
const m = /Données techniques \(ne pas modifier\) :\s*([\s\S]*?)\s*=== fin du rapport ===/.exec(txt); if (!m) { console.error('bloc technique introuvable'); process.exit(1); }
const d = JSON.parse(Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('utf8')); console.log(JSON.stringify(d, null, 1));
