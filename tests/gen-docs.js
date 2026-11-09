/* Génère docs/COUVERTURE-UI.md à partir des données (pannes + compétences). Usage : node tests/gen-docs.js */
const fs = require('fs'), path = require('path');
const SIM = require('./load.js')();
const F = SIM.faults, SK = SIM.skills;
const LV = { 1: 'Junior', 2: 'Confirmé', 3: 'Admin', 4: 'Cyber (pièges, fausses pistes)' };
const esc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
let o = '# Couverture : pannes × compétences × niveau\n\n';
o += 'Fichier généré par `node tests/gen-docs.js` à partir de `src/content/` — ne pas éditer à la main.\n\n';
o += `Total : **${F.length} pannes** · **${Object.keys(SK).length} compétences** (référentiel = fiche de suivi v21, 27/10/2026).\n\n`;
o += '## Répartition par niveau\n\n| Niveau | Pannes |\n|---|---|\n';
for (const l of [1, 2, 3, 4]) o += `| ${l} — ${LV[l]} | ${F.filter(f => f.level === l).length} |\n`;
o += '| 5 — Chaos | assemblage automatique de 2 à 4 pannes de niveau 2 à 4 (chaînées ou indépendantes) |\n'
o += '\n## Compétences → pannes\n\n| Compétence (fiche) | Domaine | Statut fiche | Pannes |\n|---|---|---|---|\n';
for (const s of Object.values(SK)) {
  const fs_ = F.filter(f => f.skills.includes(s.id)).map(f => f.id);
  o += `| ${esc(s.fiche)} | ${s.domaine} | ${s.statut} | ${fs_.length ? fs_.join(', ') : (s.id === 'proxy' ? '**aucune — 🟡 à la limite du périmètre, en attente de ta décision**' : '**aucune**')} |\n`;
}
o += '\n## Détail des pannes\n\n| ID | Niv. | Titre | Compétences | Résolution attendue | Pièges |\n|---|---|---|---|---|---|\n';
for (const f of F) {
  o += `| \`${f.id}\` | ${f.level} | ${esc(f.title)} | ${f.skills.map(s => SK[s].fiche).map(esc).join(' ; ')} | ${esc(f.solution)} | ${esc((f.traps || []).map(t => typeof t === 'string' ? t : (t.msg || t.text || t.why || JSON.stringify(t))).join(' / '))} |\n`;
}
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'COUVERTURE-UI.md'), o);
console.log('docs/COUVERTURE-UI.md :', F.length, 'pannes');

/* ---- docs/PANNES-PROXY.md : pannes Squid / SquidGuard (préfixe px_) ---- */
const PX = F.filter(f => f.id.startsWith('px_'));
/* {{m.x}} : la panne tire une variante selon la graine ; on liste toutes les variantes (label) au lieu d'un gabarit brut */
const variants = f => ((f.vary && f.vary.m) || []).map(v => v.label).filter(Boolean);
const fillM = (txt, f) => String(txt == null ? '' : txt).replace(/\{\{m\.(\w+)\}\}/g, (x, k) => { const vs = ((f.vary && f.vary.m) || []).map(v => v[k]).filter(v => v !== undefined); return vs.length > 1 ? '(' + vs.join(' / ') + ')' : (vs[0] === undefined ? x : vs[0]); });
let q = '# Pannes proxy (Squid / SquidGuard sur pfSense)\n\n';
q += 'Fichier généré par `node tests/gen-docs.js` à partir de `src/content/26-faults-proxy.js` — ne pas éditer à la main.\n\n';
q += `Référence cours : TP Squid/SquidGuard sur pfSense (voir \`docs/CORRESPONDANCE-COURS.md\`). Compétence de la fiche : **${esc((SK.proxy || {}).fiche)}**. ${PX.length} pannes (` + [1, 2, 3, 4].map(l => PX.filter(f => f.level === l).length + ' en N' + l).join(', ') + ').\n\n';
/* pannes px dont un parcours par l'interface (tests/ui/proxy-faults.js) prouve la réparation par clics et saisies */
const PX_PROUVEES = ['px_subnet_denied', 'px_cache_unsaved', 'px_sg_default_deny', 'px_sg_nolist'];
const PX_NON = PX.filter(f => PX_PROUVEES.indexOf(f.id) < 0).map(f => '`' + f.id + '`');
q += 'Toutes se diagnostiquent et se vérifient depuis le poste RH ou le poste d’administration (Paramètres du proxy du navigateur, journaux). **État de la preuve (D-105, D-108)** : seules ' + PX_PROUVEES.length + ' pannes sur ' + PX.length + ' ont un parcours par l’interface web de pfSense (Services → Squid Proxy Server / SquidGuard Proxy Filter, Status → Services) qui prouve qu’un joueur peut les réparer par clics et saisies (`tests/ui/proxy-faults.js`) : ' + PX_PROUVEES.map(x => '`' + x + '`').join(', ') + '. Les ' + PX_NON.length + ' autres (' + PX_NON.join(', ') + ') ont une correction déclarée dans le moteur mais **aucun parcours** : statut « livrée, non terminée » (dette de parcours). Le périmètre `px` attend l’arbitrage du porteur du projet. Les pannes N4 `multi_*` qui impliquent le proxy sont listées en fin de document.\n\n';
q += '## Catalogue\n\n| ID | Niv. | Ticket (sujet) | Cause racine | Résolution attendue |\n|---|---|---|---|---|\n';
for (const f of PX) q += `| \`${f.id}\` | ${f.level} | ${esc((f.ticket || {}).subject)} | ${esc(fillM(f.cause, f))} | ${esc(fillM(f.solution, f))} |\n`;
q += '\n## Pièges et contournements par panne\n\n';
for (const f of PX) {
  q += `### \`${f.id}\` — ${esc(f.title)}\n\n`;
  if (variants(f).length) q += '- Variantes tirées selon la graine : ' + variants(f).map(esc).join(' · ') + '\n';
  q += '- Chemin optimal : ' + (f.optimal || []).map((x, i) => (i + 1) + '. ' + esc(x)).join(' → ') + '\n';
  q += '- Pièges : ' + ((f.traps || []).map(t => typeof t === 'string' ? t : (t.msg || t.text || '')).map(esc).join(' · ') || '—') + '\n';
  q += '- Contournements reconnus (ne comptent pas comme résolution) : ' + (Object.keys(f.workarounds || {}).join(', ') || '—') + '\n\n';
}
const MULTI = F.filter(f => /^multi_/.test(f.id) && (f.skills.includes('proxy') || /squid|proxy/i.test(JSON.stringify(f.inject || []))));
q += '## Pannes N4 qui impliquent le proxy\n\n' + (MULTI.length ? MULTI.map(f => `- \`${f.id}\` — ${esc(f.title)}`).join('\n') : '_aucune parmi les `multi_*` actuelles ; `px_trans_multi` et `px_cascade` sont elles-mêmes de niveau 4_') + '\n\n';
q += '## Limites de la simulation proxy\n\nVoir `docs/LIMITES.md`, section « Proxy ».\n';
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'PANNES-PROXY.md'), q);
console.log('docs/PANNES-PROXY.md :', PX.length, 'pannes proxy');

/* ---- docs/LIENS-COURS.md : correspondance compétence → pages du site de cours (liens de révision du débrief) ---- */
{
  const L = SIM.courseLinks; const skills = Object.keys(SIM.skills);
  const cnt = {}; SIM.faults.forEach(f => f.skills.forEach(s => { cnt[s] = (cnt[s] || 0) + 1; }));
  let d = '# Liens de révision : compétences → site de cours\n\n> Généré par `node tests/gen-docs.js` depuis `src/content/28-course-links.js`. Ne pas éditer à la main.\n\n';
  d += 'Quand un ticket n’est **pas validé** (note < 75 / 100, abandon ou temps écoulé), le débrief propose « À réviser avant de repasser ce ticket » : des liens vers les cours, procédures et TP du site de formation **' + L.host + '** (site d’un camarade de formation), choisis d’après les compétences de la panne.\n\n';
  d += '## Règles\n\n- **Hôte fixe** et chemins écrits dans la table : aucune URL n’est fournie par un scénario, un fichier importé ou le joueur.\n- Liens en `target="_blank" rel="noopener noreferrer"` ; connexion internet nécessaire (le jeu lui-même reste hors ligne, la CSP du jeu n’est pas modifiée : ce sont de simples liens).\n- Au plus 8 liens par ticket ; les compétences techniques passent avant `diag` / `diag-gpo` (méthode), qui ne servent que de repli.\n- Les ' + Object.keys(SIM.skills).length + ' compétences de la fiche ont au moins un lien (testé : `tests/course-links.js`).\n\n';
  d += '## Vérification et limites\n\n- Chaque chemin a été ouvert sur le site avec le navigateur intégré pendant la rédaction (octobre 2026), **titre de page contrôlé** : le site est rendu côté client et un chemin inconnu répond quand même HTTP 200 avec un titre générique, donc le code HTTP seul ne prouve rien. Le contrôle en ligne n’est pas rejouable depuis la batterie de tests (réseau du poste de dev restreint).\n- Si le site renomme ou supprime une page, seul le lien concerné casse : mettre à jour la table `src/content/28-course-links.js` puis relancer `node tests/gen-docs.js`.\n- **Aucun cours nginx** sur le site : la compétence `nginx` renvoie vers les virtualhosts Apache (le plus proche) et le libellé le dit.\n- Le site couvre aussi des sujets **hors fiche de compétences** (OSPF, HSRP, OPNsense…) : ils ne sont jamais proposés ici, pour ne pas élargir le périmètre du jeu. Deux pages OPNsense (`/opnsense-nat`, `/opnsense-segmentation`) servent d’illustration au NAT / à la segmentation faute de page pfSense dédiée : à confirmer.\n\n';
  d += '## Table\n\n| Compétence | Domaine | Pannes | Liens proposés |\n|---|---|---:|---|\n';
  skills.forEach(id => { const s = SIM.skills[id]; d += '| `' + id + '` — ' + s.label.replace(/\|/g, '/') + ' | ' + s.domaine + ' | ' + (cnt[id] || 0) + ' | ' + (L.skills[id] || []).map(l => '[' + l.label.replace(/\|/g, '/') + '](' + L.host + l.path + ') (' + l.kind + ')').join(' · ') + ' |\n'; });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'LIENS-COURS.md'), d);
  console.log('docs/LIENS-COURS.md :', skills.length, 'compétences,', Object.values(L.skills).reduce((a, x) => a + x.length, 0), 'liens');
}
