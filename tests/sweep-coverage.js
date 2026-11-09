/* Neutralisation des balayages terminal (D-70, D-97) : chaque contrôle doit virer au rouge quand on le prive de ce qu'il vérifie.
   1. couverture : une panne retirée du balayage → « non couverte » ; 2. recette cassée : une panne dont la réparation n'est plus rejouée → échec.
   Les balayages sont lancés tels quels, avec leurs crochets SWEEP_SKIP / SWEEP_BREAK (variables d'environnement, jamais utilisées par la batterie). */
'use strict';
const { spawnSync } = require('child_process'); const path = require('path');
let bad = 0; const ck = (ok, msg) => { if (!ok) { bad++; console.log('✗ ' + msg); } else console.log('✓ ' + msg); };
const run = (file, env) => { const r = spawnSync('node', [path.join(__dirname, file)], { env: Object.assign({}, process.env, env), encoding: 'utf8' }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
for (const [file, id, label] of [['cli-sweep-ios.js', 'ec_negotiation', 'IOS'], ['cli-sweep-lx.js', 'lx_svc_stopped', 'Linux']]) {
  const ref = run(file, {}); ck(ref.code === 0 && / 0 échec\(s\)/.test(ref.out), label + ' : balayage nominal au vert');
  const a = run(file, { SWEEP_SKIP: id }); ck(a.code !== 0 && new RegExp('non couverte par le balayage ' + label + ' : ' + id).test(a.out), label + ' : neutralisation de la couverture (' + id + ' retirée → « non couverte », code ≠ 0)');
  const b = run(file, { SWEEP_BREAK: id }); ck(b.code !== 0 && new RegExp('✗ ' + id + '#').test(b.out), label + ' : neutralisation de la recette (' + id + ' non réparée → échec, code ≠ 0)');
}
/* garde-fou du barème (D-109) : lx_fstab se répare par un redémarrage ; sans needsReboot il coûterait un impact, et le balayage doit le dire */
{ const c = run('cli-sweep-lx.js', { PENALTY_BREAK: 'lx_fstab' }); ck(c.code !== 0 && /✗ lx_fstab#\d+ : malus sur un chemin déclaré : impact reboot/.test(c.out), 'Linux : neutralisation du barème (lx_fstab sans needsReboot → malus d’impact détecté, code ≠ 0)'); }
console.log(bad ? bad + ' échec(s)' : '0 échec'); process.exit(bad ? 1 : 0);
