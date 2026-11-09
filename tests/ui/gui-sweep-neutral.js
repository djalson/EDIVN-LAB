/* Neutralisation du balayage graphique (D-70, D-98.5) : le balayage nominal d'une panne passe ; la même panne dont la recette n'est volontairement pas jouée
   (GS_BREAK) fait virer le balayage au rouge (code ≠ 0, « à reprendre »). Sans cette preuve, un balayage qui ne répare rien resterait vert. */
'use strict';
const { spawnSync } = require('child_process'); const path = require('path');
let bad = 0; const ck = (ok, m) => { if (!ok) { bad++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
const run = env => { const r = spawnSync('node', [path.join(__dirname, 'gui-sweep-win.js'), 'dhcp_scope_off'], { env: Object.assign({}, process.env, env), encoding: 'utf8', timeout: 240000 }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const a = run({}); ck(a.code === 0 && /0 à reprendre/.test(a.out), 'balayage nominal de dhcp_scope_off au vert (0 à reprendre)');
const b = run({ GS_BREAK: 'dhcp_scope_off' }); ck(b.code !== 0 && /[1-9]\d* à reprendre/.test(b.out), 'recette non jouée (dhcp_scope_off) : le balayage vire au rouge (code ≠ 0, « à reprendre »)');
const c = run({ GS_PENALTY: 'dhcp_scope_off' }); ck(c.code !== 0 && /malus sur un chemin déclaré : impact svc-stop/.test(c.out), 'impact injecté par la vraie mission (D-109) : le balayage vire au rouge (« malus sur un chemin déclaré »)');
console.log(bad ? bad + ' échec(s)' : '0 échec'); process.exit(bad ? 1 : 0);
