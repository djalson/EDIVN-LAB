/* Liens de révision (débrief d'un ticket à repasser) : table statique compétence → pages du site de cours.
   Contrôle de forme et de sécurité hors ligne (le contrôle en ligne des titres de page a été fait à la rédaction : voir docs/LIENS-COURS.md). */
const SIM = require('./load')(); const L = SIM.courseLinks;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const ids = Object.keys(SIM.skills);
ok(L.host === 'https://tssr.miyukini.com', 'hôte fixe : ' + L.host);
ok(ids.every(i => (L.skills[i] || []).length > 0), 'les ' + ids.length + ' compétences de la fiche ont au moins un lien');
ok(Object.keys(L.skills).every(i => ids.indexOf(i) >= 0), 'aucune compétence inconnue dans la table (périmètre = fiche)');
const all = [].concat.apply([], Object.values(L.skills));
ok(all.every(l => /^\/[a-z0-9-]+$/.test(l.path) && l.label && ['cours', 'procédure', 'TP'].indexOf(l.kind) >= 0), 'chemins relatifs simples (a-z, 0-9, tiret), libellé et type renseignés (' + all.length + ' liens)');
ok(Object.values(L.skills).every(a => new Set(a.map(l => l.path)).size === a.length), 'pas de doublon dans une compétence');
ok(!/https?:\/\//.test(JSON.stringify(L.skills)), 'aucune URL complète dans la table : l’hôte est ajouté par le code');
['http://evil.test/x', '//evil.test/x', '/a/b', '../x', 'javascript:alert(1)', '/x?y=1', '/x#y', '', null, 42, '/A'].forEach(bad1 => ok(L.url(bad1) === null, 'chemin refusé : ' + JSON.stringify(bad1)));
ok(L.url('/procedure-dhcp') === 'https://tssr.miyukini.com/procedure-dhcp', 'chemin valide → URL de l’hôte fixe');
/* toutes les pannes du catalogue produisent des liens valides */
let worst = 0, empty = 0;
SIM.faults.forEach(f => { const g = L.forSkills(f.skills, 8); const n = g.reduce((a, x) => a + x.links.length, 0); worst = Math.max(worst, n); if (!n) empty++; if (!g.every(x => x.links.every(l => l.url.indexOf(L.host + '/') === 0))) { bad++; console.log('  ✗ URL hors hôte pour ' + f.id); } });
ok(empty === 0 && worst <= 8, SIM.faults.length + ' pannes : toutes ont des liens, au plus 8 par ticket (max ' + worst + ')');
const t = L.forSkills(['diag', 'dhcp']); ok(t.length === 1 && t[0].skill === 'dhcp', 'compétence technique d’abord : diag est écartée quand une compétence précise existe');
ok(L.forSkills(['diag']).length === 1 && L.forSkills([]).length === 1 && L.forSkills(['inconnue']).length === 1, 'repli sur la méthode de dépannage (diag) sinon');
ok(L.forSkills(['lx-ssh', 'lx-ssh']).length === 1, 'compétences en double dédupliquées');
const nx = L.forSkills(['nginx'])[0]; ok(nx.links[0].label.indexOf('pas de cours nginx') >= 0, 'écart connu signalé au joueur : pas de cours nginx sur le site');
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
