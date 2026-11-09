/* Revue automatique du contenu : complétude des pannes, gabarits non résolus, couverture des compétences,
   typographie, doublons. Sortie : liste des anomalies + matrice compétences × niveaux (docs/MATRICE-COMPETENCES.md). */
const SIM = require('./load.js')(); const F = SIM.fault; const fs = require('fs'), path = require('path');
const probs = [], notes = [];
const P = (id, m) => probs.push(id + ' : ' + m);
const sk = Object.keys(SIM.skills);
const cov = {}; sk.forEach(s => { cov[s] = { 1: 0, 2: 0, 3: 0, 4: 0, ids: [] }; });
const titles = {};
for (const d of SIM.faults) {
  (d.skills || []).forEach(s => { if (cov[s]) { cov[s][d.level]++; cov[s].ids.push(d.id); } });
  if (titles[d.title]) P(d.id, 'titre en double avec ' + titles[d.title]); titles[d.title] = d.id;
  if (!d.roots || !d.roots.length) P(d.id, 'aucune racine (contournement non distingué)');
  if (!d.traps || !d.traps.length) notes.push(d.id + ' : aucun piège');
  for (const combo of F.variantCombos(d, 50)) {
    let inst; try { inst = F.instantiate(d, 7, combo); } catch (e) { P(d.id, 'instanciation impossible ' + JSON.stringify(combo) + ' : ' + e.message); continue; }
    const tag = Object.keys(combo).length ? JSON.stringify(combo) : '';
    if (!inst.roots || !inst.roots.length) P(d.id, 'aucune racine après instanciation ' + tag);
    if (!inst.optimal || inst.optimal.length < 3) P(d.id, 'chemin optimal < 3 étapes ' + tag);
    if (inst.hints.some(h => String(h).length < 25)) P(d.id, 'indice très court ' + tag);
    if (new Set(inst.hints).size !== inst.hints.length) P(d.id, 'indices identiques ' + tag);
    if (inst.ticket.body.length < 60) P(d.id, 'ticket trop bref ' + tag);
    if (String(inst.solution || '').length > 40 && inst.ticket.body.toLowerCase().includes(inst.solution.toLowerCase().slice(0, 40))) P(d.id, 'le ticket recopie la solution ' + tag);
    const txt = [inst.ticket.from, inst.ticket.subject, inst.ticket.body, inst.cause, inst.solution].concat(inst.hints || [], inst.traps || [], inst.optimal || []).join('\n');
    if (/\{\{|\}\}|\bundefined\b|\[object|\bNaN\b|\bnull\b/.test(txt)) P(d.id, 'gabarit non résolu ou valeur parasite ' + tag + ' : ' + (txt.match(/.{0,30}(\{\{|\}\}|\bundefined\b|\[object|\bNaN\b|\bnull\b).{0,30}/) || [''])[0]);
    if (/ {2,}/.test(txt.replace(/\n/g, ' '))) P(d.id, 'doubles espaces ' + tag);
    if (/'/.test(inst.ticket.body + inst.ticket.subject)) notes.push(d.id + ' : apostrophe droite dans le ticket (typographie)');
    if (!inst.ticket.site) P(d.id, 'ticket sans site');
  }
}
const EXPECTED_EMPTY = [];
sk.forEach(s => { if (!cov[s].ids.length && EXPECTED_EMPTY.indexOf(s) < 0) P('compétence ' + s, 'AUCUNE panne rattachée'); });
console.log(probs.length ? probs.map(x => '✗ ' + x).join('\n') : '✓ aucune anomalie bloquante sur ' + SIM.faults.length + ' pannes');
const thin = sk.filter(s => cov[s].ids.length === 1);
if (notes.length && process.argv.includes('-v')) console.log(notes.join('\n'));
console.log('Compétences à une seule panne (' + thin.length + ') : ' + thin.join(', '));
let md = '# Matrice compétences × niveaux (généré par `node tests/lint-content.js`)\n\n| Compétence | N1 | N2 | N3 | N4 | Total | Pannes |\n|---|--:|--:|--:|--:|--:|---|\n';
sk.forEach(s => { const c = cov[s]; const sd = SIM.skills[s]; md += '| `' + s + '` ' + ((sd && (sd.name || sd.title || sd.label)) || '') + ' | ' + c[1] + ' | ' + c[2] + ' | ' + c[3] + ' | ' + c[4] + ' | ' + c.ids.length + ' | ' + c.ids.map(i => '`' + i + '`').join(' ') + ' |\n'; });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'MATRICE-COMPETENCES.md'), md);
process.exit(probs.length ? 1 : 0);
