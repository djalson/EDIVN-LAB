#!/usr/bin/env node
/* ============================================================================
   Batterie de tests complète — une seule commande :
     node tests/all.js            construit, puis lance tout (≈ 10–15 min)
     node tests/all.js --quick    sans le test « singe » ni les graines multiples
     node tests/all.js --only=pfw  ne lance que les tests dont le nom contient « pfw »
   Un test réussit si : code retour 0, aucun marqueur d'erreur dans sa sortie
   (PAGEERR, TypeError, ReferenceError, SyntaxError, « ✗ », « ERREUR ») et, quand
   il est défini, le motif attendu `expect` apparaît dans la sortie.
   Rapport écrit dans docs/RAPPORT-TESTS.md. Code retour ≠ 0 si au moins un échec.
   ============================================================================ */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
/* --fast : palier rapide (quelques minutes) à lancer après chaque modification ; la batterie complète reste la référence avant livraison. */
const FAST = process.argv.includes('--fast');
const FASTSET = /^(assert-world|regress |game$|progress |campaign|report |rewards|lint-content|course-links|codes-audit|addressing|boot$|web$|ad$|ssh$|emu-|term$|ios-edge$|regress-ui|home-tour$|win1$|pfw1$|rig1$|infra )/;

const BAD = /PAGEERR|TypeError|ReferenceError|SyntaxError|✗|ERREUR|Cannot read prop|is not a function|is not defined/;
const T = [];
/* t(groupe, nom, [args], options) — options : expect (RegExp), allowBad (RegExp d'exceptions), timeout (s) */
const t = (group, name, args, o) => T.push(Object.assign({ group, name, args, timeout: 240 }, o || {}));

/* --- 1. Construction et moteur (Node, sans navigateur) --- */
t('Moteur', 'assert-world (identité, adressage, DNS, terminaux)', ['tests/assert-world.js'], { expect: /0 échec/ });
t('Moteur', 'regress (bugs déjà corrigés)', ['tests/regress.js'], { expect: /0 échec/ });
t('Moteur', 'retired (variantes retirées du jeu : jamais tirées, contenu conservé, neutralisation)', ['tests/retired.js'], { timeout: 300, expect: /0 échec/ });
t('Moteur', 'win-unsupported (D-99 Windows : commandes réelles sûres de leur existence → « non gérée par le simulateur », un contrôle par commande + neutralisation)', ['tests/win-unsupported.js'], { timeout: 300, expect: /0 échec/ });
t('Moteur', 'ios-noeffect (D-99/D-111 : avis « sans effet dans le simulateur » quand il est vrai, absent quand il serait faux)', ['tests/ios-noeffect.js'], { timeout: 300, expect: /0 échec/ });
t('Moteur', 'ios-parcours (D-66/D-93 : pannes de redondance et OSPF, du ticket à la clôture par les terminaux ; clôture sur ping refusée avec motif ; neutralisation)', ['tests/ios-parcours.js'], { timeout: 300, expect: /0 échec/ });
t('Moteur', 'lx-impact (D-109 : le terminal Linux marque reboot / poweroff / arrêt de service ; needsReboot neutralisé)', ['tests/lx-impact.js'], { expect: /^OK/m });
t('Moteur', 'impact-net (règle par le résultat : stop puis start du même service = 0 ; reboot jamais remboursé ; Linux, cmd, PowerShell, interface)', ['tests/impact-net.js'], { expect: /^OK/m });
t('Moteur', 'unproven-timed (panne irréparable retirée de tous les tirages ; pannes proxy revenues en chronométré ; liste vidée → revient)', ['tests/unproven-timed.js'], { expect: /^OK/m });
t('Moteur', 'codes-audit (D-106 : registre des codes d’erreur, masquage, audit statique + exécution, neutralisation)', ['tests/codes-audit.js'], { expect: /^OK/m });
t('Moteur', 'build-guard (livrable autonome : toute ressource externe arrête la construction ; neutralisation)', ['tests/build-guard.js'], { timeout: 300, expect: /0 échec/ });
t('Moteur', 'faults', ['tests/faults.js'], { expect: /(\d+)\/\1 pannes valides, 0 erreur/ });
t('Moteur', 'validate', ['tests/validate.js'], { expect: /double import refusé/ });
t('Moteur', 'game', ['tests/game.js'], { expect: /OK/ });
t('Moteur', 'campaign (chapitres, périmètre, tirage, examen, déblocage, révision espacée ; campagne jouée en entier)', ['tests/campaign.js'], { timeout: 600, expect: /, 0 échec/ });
t('Moteur', 'rewards (récompenses de niveau : piste, contrats en XP seulement, outils coupés en évaluation et en examen, second avis, cosmétiques, prestige)', ['tests/rewards.js'], { timeout: 120, expect: /, 0 échec/ });
t('Moteur', 'report (fiche d’intervention : une fiche bien formée par panne, barème, plancher au seuil, mode guidé)', ['tests/report.js'], { timeout: 600, expect: /, 0 échec/ });
t('Moteur', 'scoring (note /100, seuil 75, étoiles, temps cible par panne, niveaux 1/1/2/3/4 pannes)', ['tests/scoring.js'], { timeout: 600, expect: /^OK$/m });
t('Moteur', 'combo (pannes composées + niveaux Admin 2 / Cyber 3 / Chaos 4)', ['tests/combo.js', '16'], { timeout: 900, expect: /0 échec/ });
t('Moteur', 'course-links (liens de révision : table statique, hôte fixe)', ['tests/course-links.js'], { expect: /^OK$/m });
t('Moteur', 'lint-content (complétude, gabarits, couverture)', ['tests/lint-content.js'], { expect: /aucune anomalie bloquante/ });
t('Sécurité', 'fuzz-term (entrées hostiles sur 6 terminaux)', ['tests/fuzz-term.js'], { expect: /0 exception/, timeout: 400 });
t('Sécurité', 'security-ui (prototype, HTML hostile, import, CSP)', ['tests/ui/security.js']);
t('Sécurité', 'profile-corrupt (stockage navigateur corrompu ou hostile)', ['tests/ui/profile-corrupt.js'], { expect: /8 profils et listes/ });
t('Moteur', 'cli-parity (pannes réparables au terminal : net share, SMB, IIS)', ['tests/cli-parity.js'], { expect: /0 échec/ });
t('Moteur', 'ps-confirm (invites de confirmation PowerShell : SMB, carte réseau)', ['tests/ps-confirm.js'], { expect: /, 0 ko/ });
t('Moteur', 'personas --quick (apprenants simulés : 0 anomalie, déterminisme)', ['tests/personas.js', '--quick', '--out', require('os').tmpdir() + '/personas-quick.md'], { timeout: 600, expect: /0 anomalie/ });
t('Moteur', 'progress (niveaux, XP, arbre, série, ticket du jour, objectifs, maîtrise, profils hostiles)', ['tests/progress.js'], { expect: /0 échec/ });
t('Moteur', 'boot', ['tests/boot.js']);
t('Moteur', 'web', ['tests/web.js']);
t('Moteur', 'ad', ['tests/ad.js']);
t('Moteur', 'ssh', ['tests/ssh.js']);
/* --- 2. Émulateurs de terminal --- */
['emu-win', 'emu-ps', 'emu-lx', 'emu-ssh', 'emu-ios', 'ios-edge', 'term'].forEach(n => t('Émulateurs', n, ['tests/' + n + '.js']));
t('Émulateurs', 'ios-fixes', ['tests/ios-fixes.js'], { expect: /Tout OK/ });
t('Émulateurs', 'l2-cli (EtherChannel / Spanning Tree)', ['tests/l2-cli.js'], { expect: /0 échec/ });
t('Moteur', 'addressing (plan d’adressage attendu : cohérent avec le monde sain, IP uniques, bails DHCP)', ['tests/addressing.js'], { expect: /0 échec/ });
t('Réparation au terminal', 'cli-sweep-lx (pannes Linux × variantes réparées avec de vraies commandes : nano, chmod, systemctl, ufw, setfacl, mysql…)', ['tests/cli-sweep-lx.js'], { expect: /0 échec/, timeout: 300 });
t('Réparation au terminal', 'cli-sweep-ios (pannes Cisco × variantes réparées en configuration IOS, différence show running-config)', ['tests/cli-sweep-ios.js'], { expect: /0 échec/, timeout: 300 });
t('Réparation au terminal', 'sweep-coverage (neutralisation des balayages terminal : couverture retirée, recette cassée → rouge)', ['tests/sweep-coverage.js'], { timeout: 300, expect: /0 échec/ });
t('Réparation au terminal', 'audit-win-cli (commandes réelles Windows : émulées, signalées ou absentes à tort)', ['tests/audit-win-cli.js'], { expect: /0 absentes/ });
t('Émulateurs', 'cmdhelp (aide-mémoire : index issu des registres réels, descriptions complètes, chaque exemple exécuté sans « commande introuvable »)', ['tests/cmdhelp.js'], { expect: /0 échec/ });
t('Émulateurs', 'lx-groups (usermod / gpasswd / adduser, masque ACL de setfacl)', ['tests/lx-groups.js'], { expect: /0 échec/ });
t('Émulateurs', 'sql-cli (console MariaDB : comptes, GRANT, réparation de lx_db_access)', ['tests/sql-cli.js'], { expect: /0 échec/ });

/* --- 3. Interface (Chromium / Playwright) --- */
t('Interface', 'smoke-all', ['tests/ui/smoke-all.js'], { timeout: 600 });
t('Interface', 'regress-ui (modale au-dessus du bureau)', ['tests/ui/regress.js']);
t('Interface', 'sweep (toutes les pannes × 2 graines, 3 modes)', ['tests/ui/sweep.js'], { timeout: 1200, expect: /pannes × 2 graines/ });
t('Réparation graphique', 'gui-sweep-neutral (neutralisation : recette non jouée → le balayage graphique vire au rouge)', ['tests/ui/gui-sweep-neutral.js'], { timeout: 600, expect: /0 échec/ });
t('Réparation graphique', 'gestion-app (D-103 : application de gestion de SRV-FIC, un parcours par cause + neutralisation)', ['tests/ui/gestion-app.js'], { timeout: 900, expect: /0 échec/ });
t('Réparation graphique', 'gui-sweep-win (pannes Windows / AD / GPO / DHCP / DNS / IIS / partages × variantes réparées par clics dans les vraies consoles)', ['tests/ui/gui-sweep-win.js'], { timeout: 2400, expect: /, 0 à reprendre,/ });
t('Interface', 'home-tour', ['tests/ui/home-tour.js']);
t('Interface', 'rewards-ui (piste, apparence, contrats, voyants de liaison, ping rapide, historique, second avis, paliers d’astreinte, prestige, #legacy)', ['tests/ui/rewards.js'], { timeout: 300, expect: /^OK récompenses$/m });
t('Interface', 'campaign-ui (accueil à trois entrées, chantier, carte du périmètre, fiche d’intervention, examen, déblocage, #legacy)', ['tests/ui/campaign.js'], { timeout: 300, expect: /^OK campagne$/m });
t('Interface', 'themes-debrief (accueil, 8 thèmes, animations du 100, débrief, liens de cours)', ['tests/ui/themes-debrief.js'], { timeout: 300, expect: /^OK$/m });
t('Interface', 'scenario-import', ['tests/ui/scenario-import.js']);
t('Interface', 'dhcp-auth', ['tests/ui/dhcp-auth.js']);
for (let i = 1; i <= 11; i++) t('Consoles Windows', 'win' + i, ['tests/ui/win' + i + '.js']);
t('Réseau', 'net1', ['tests/ui/net1.js'], { allowBad: /CONSOLE/, timeout: 600 });   // net1 journalise des erreurs OpenVPN simulées
t('Réseau', 'net2', ['tests/ui/net2.js']);
[1, 3, 4].forEach(i => t('Baie / physique', 'rig' + i, ['tests/ui/rig' + i + '.js']));
t('Baie / physique', 'rig-sites (câble débranché à Bordeaux et à Ramonville : réparé par la vue physique)', ['tests/ui/rig-sites.js'], { expect: /^OK rig-sites$/m });
['phys_eth', 'phys_power', 'phys_screen', 'phys_mon', 'phys_source', 'phys_wall', 'phys_patch']
  .forEach(f => t('Baie / physique', 'rig2:' + f, ['tests/ui/rig2.js', f], { expect: /après ping: \["resolved"\]|après geste: \["(fixed|resolved)"\]/ }));
t('pfSense', 'pfw1', ['tests/ui/pfw1.js']);
t('pfSense', 'pfw3', ['tests/ui/pfw3.js']);
t('pfSense', 'proxy (pages Squid / squidGuard / Options Internet)', ['tests/ui/proxy.js']);
t('pfSense', 'proxy-sweep (17 pannes proxy × variantes réparées par clics dans l’interface pfSense et les Options Internet)', ['tests/ui/proxy-sweep.js'], { timeout: 900, expect: /, 0 à reprendre$/m });
t('pfSense', 'proxy-faults (réparations par l’interface)', ['tests/ui/proxy-faults.js']);
t('pfSense', 'snort-faults (réparations par l’interface Snort)', ['tests/ui/snort-faults.js']);
t('Réseau', 'colomiers-map (carte du site, panne EtherChannel)', ['tests/ui/colomiers-map.js']);
t('Interface', 'progress-ui (carrière, arbre, coffre-fort, carnet, débrief XP, ticket du jour, sauvegarde)', ['tests/ui/progress.js'], { timeout: 300 });
t('Interface', 'infra (identifiants copiables, plan d’adressage, copie presse-papiers, mode évaluation)', ['tests/ui/infra.js'], { timeout: 180 });
t('Interface', 'cmdhelp-ui (bouton Aide-mémoire : cmd, PowerShell, Linux, IOS ; recherche ; insertion sans exécution)', ['tests/ui/cmdhelp.js'], { timeout: 180 });
['pf_lan_norule', 'pf_dmz_rule', 'pf_dmz_alias', 'pf_nat_outbound', 'pf_portfwd', 'pf_gateway', 'pf_static_route',
  'pf_ipsec_p1', 'pf_ipsec_p2', 'pf_ipsec_rules', 'vpn_wanrule', 'vpn_access', 'vpn_routes', 'vpn_connect']
  .forEach(f => t('pfSense', 'pfw2:' + f, ['tests/ui/pfw2.js', f], { expect: /statut final \[ '(fixed|resolved)' \]|non couverte/ }));
if (!QUICK) {
  [['1', '6', '80', '1440', '900'], ['2', '6', '80', '1280', '720'], ['3', '8', '120', '1920', '1080'], ['4', '6', '100', '1024', '768'], ['5', '10', '60', '1440', '900']]
    .forEach(a => t('Singe (aléatoire)', 'monkey graine ' + a[0] + ' ' + a[3] + '×' + a[4], ['tests/ui/monkey.js'].concat(a), { timeout: 900 }));
  [['1280', '720'], ['1024', '768']].forEach(a => { t('Interface', 'home-tour ' + a.join('×'), ['tests/ui/home-tour.js'].concat(a)); t('Interface', 'themes-debrief ' + a.join('×'), ['tests/ui/themes-debrief.js'].concat(a), { timeout: 300, expect: /^OK$/m }); });
}

/* --- exécution --- */
const sel = T.filter(x => (!ONLY || (x.group + ' ' + x.name).toLowerCase().includes(ONLY.toLowerCase())) && (!FAST || FASTSET.test(x.name)));
console.log('Construction…');
const b = spawnSync('node', ['build.js'], { cwd: ROOT, encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout + b.stderr); process.exit(2); }
console.log((b.stdout || '').trim().split('\n').pop());
const res = []; const t0 = Date.now();
sel.forEach((x, i) => {
  const s0 = Date.now();
  const r = spawnSync('node', x.args, { cwd: ROOT, encoding: 'utf8', timeout: x.timeout * 1000, maxBuffer: 64 << 20 });
  const out = (r.stdout || '') + (r.stderr || '');
  const why = [];
  if (r.error && r.error.code === 'ETIMEDOUT') why.push('délai dépassé (' + x.timeout + ' s)');
  else if (r.status !== 0) why.push('code retour ' + r.status);
  const lines = out.split('\n').filter(l => BAD.test(l) || (!x.allowBad && /^CONSOLE /.test(l)));
  const real = lines.filter(l => !(x.allowBad && x.allowBad.test(l)));
  if (real.length) why.push('marqueur d’erreur : ' + real[0].trim().slice(0, 140));
  if (x.expect && !x.expect.test(out)) why.push('sortie attendue absente : ' + x.expect);
  const ok = why.length === 0; const sec = ((Date.now() - s0) / 1000).toFixed(1);
  res.push({ x, ok, why, sec });
  console.log(((i + 1) + '/' + sel.length).padStart(7) + '  ' + (ok ? 'OK  ' : 'ÉCHEC') + '  ' + x.group + ' · ' + x.name + '  (' + sec + ' s)' + (ok ? '' : '\n         → ' + why.join(' ; ')));
  if (!ok) fs.writeFileSync(path.join(ROOT, 'tests', '.echec-' + x.name.replace(/[^a-z0-9]+/gi, '_') + '.log'), out);
});

/* --- rapport --- */
const nOK = res.filter(r => r.ok).length, nKO = res.length - nOK, dur = ((Date.now() - t0) / 1000).toFixed(0);
const groups = {}; res.forEach(r => { (groups[r.x.group] = groups[r.x.group] || []).push(r); });
let md = '# Rapport de tests\n\n_Généré par `node tests/all.js' + (QUICK ? ' --quick' : '') + (ONLY ? ' --only=' + ONLY : '') + '` — ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC · durée ' + dur + ' s_\n\n';
md += '**Résultat : ' + nOK + ' / ' + res.length + ' réussis' + (nKO ? ', ' + nKO + ' en échec' : '') + '.**\n\n';
md += 'Critères : code retour 0, aucune erreur JS de page (`PAGEERR`/`CONSOLE`), aucun `TypeError`/`ReferenceError`/`✗` dans la sortie, motif attendu présent quand défini.\n';
Object.keys(groups).forEach(g => {
  md += '\n## ' + g + '\n\n| Test | Résultat | Durée |\n|---|---|---|\n';
  groups[g].forEach(r => { md += '| `' + r.x.name + '` | ' + (r.ok ? 'OK' : '**ÉCHEC** — ' + r.why.join(' ; ').replace(/\|/g, '/')) + ' | ' + r.sec + ' s |\n'; });
});
md += '\n## Ce que la batterie ne couvre pas\n\n- Le test « singe » est aléatoire (graines fixes, donc rejouable) : il détecte les erreurs JS, pas les incohérences de contenu.\n- Les sorties de commandes et Event ID marqués « à vérifier » (`docs/A-VERIFIER.md`) ne peuvent pas être validés automatiquement : ils attendent des captures de référence.\n- Aucun test de rendu pixel : la fidélité visuelle se juge à l’œil face aux captures.\n';
if (!FAST && !ONLY) fs.writeFileSync(path.join(ROOT, 'docs', 'RAPPORT-TESTS.md'), md);   /* un passage partiel n'écrase pas le rapport de référence */
console.log('\n' + nOK + '/' + res.length + ' OK' + (nKO ? ' — ' + nKO + ' ÉCHEC(S)' : '') + ' en ' + dur + ' s' + (FAST || ONLY ? '' : ' → docs/RAPPORT-TESTS.md'));
process.exit(nKO ? 1 : 0);
