/* Audit des codes d'erreur affichés (D-106).
   1. Mécanisme : un code masqué sort sans numéro, texte conservé ; un code non vérifié sort tant que la mesure n'est pas stricte ; en mode strict, seuls les « verifie » sortent.
   2. Registre : chaque code que le SOURCE peut afficher (balayage statique de src/) figure dans src/content/09-codes.js.
   3. Exécution : tout test Node qui fait sortir un code absent du registre échoue (tests/load.js) ; ici on le prouve en en injectant un.
   4. Neutralisation (D-70) : un code non listé injecté DOIT être vu ; une fois listé, il ne l'est plus. */
const fs = require('fs'), path = require('path');
const SIM = require('./load')();
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const K = SIM.codes, R = SIM.CODES;
console.log('== mécanisme');
K.reset();
ok(K.ev('Microsoft-Windows-DHCP-Server', 1046, 'test') === '', 'Event ID 1046 (DHCP-Server) masqué : le numéro ne sort pas');
ok(K.ev('Microsoft-Windows-GroupPolicy', 1502, 'test') === '' && K.ev('Microsoft-Windows-DHCP-Server', 1063, 'test') === '', 'Event ID 1502 et 1063 masqués');
ok(K.ev('Service Control Manager', 7036, 'test') === 7036, 'Event ID non vérifié : sort tant que la mesure n’est pas stricte');
ok(K.text('Erreur 0x80070005 : accès refusé', 'test') === 'Erreur 0x80070005 : accès refusé', 'code non vérifié dans un texte : le texte sort intact (mesure non stricte)');
{ const keep = R['hex:0x80070005'].status; R['hex:0x80070005'].status = 'masque'; const t = K.text('Erreur 0x80070005 : accès refusé', 'test'); R['hex:0x80070005'].status = keep;
  ok(t === 'Erreur : accès refusé' && !/0x/.test(t), 'code masqué : le numéro disparaît, le texte reste (« ' + t + ' »)'); }
{ SIM.CODES_STRICT = true; const t = K.text('Accès refusé (0x80070005).', 'test'); const e = K.ev('Service Control Manager', 7036, 'test'); const i = K.text('%LINK-3-UPDOWN: Interface Gi0/1, changed state to down', 'test'); SIM.CODES_STRICT = false;
  ok(!/0x/.test(t) && e === '' , 'mode strict : aucun code non vérifié ne sort (hex et Event ID)');
  ok(/%LINK-3-UPDOWN/.test(i), 'mode strict : les lignes de journal IOS ne sont jamais masquées (cas limite en attente de décision)'); }
console.log('== registre (balayage statique de src/)');
const RE = /(%[A-Z][A-Z0-9_]*-\d-[A-Z][A-Z0-9_]*)|(ERROR \d{4} \([0-9A-Z]{5}\))|(\d{3,5} 0x[0-9a-fA-F]{2,4} ERROR_[A-Z_]+)|((?:NET::)?(?:DNS_ERROR_[A-Z_]+|ERROR_[A-Z_]+|SEC_E_[A-Z_]+|ERR_[A-Z][A-Z0-9_]+))|(\b0x[89A-Fa-f][0-9A-Fa-f]{7}\b)|(\bHTTP [45]\d\d(?:\.\d{1,2})?\b)/g;
const idOf = (m, g) => g[1] ? 'ios:' + m : g[2] ? 'sql:' + m : g[3] ? 'name:' + m.replace(/^\d+ 0x[0-9a-fA-F]+ /, '') : g[4] ? 'name:' + m : g[5] ? 'hex:' + m.toUpperCase().replace(/^0X/, '0x') : 'http:' + m.replace(/^HTTP /, '');
const IGNORE = new Set(['hex:0xFFFFFFFF', 'name:NET::ERR_CERT_']);   // 0xFFFFFFFF : masque de sous-réseau (calcul), NET::ERR_CERT_ : préfixe concaténé
const found = {};
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f) && !/engine\/01-codes\.js$/.test(p)) { const s = fs.readFileSync(p, 'utf8'); let m; RE.lastIndex = 0; while ((m = RE.exec(s))) { const id = idOf(m[0], m); (found[id] = found[id] || new Set()).add(p.replace(/^.*src\//, '')); } } } })(path.join(__dirname, '..', 'src'));
const missing = Object.keys(found).filter(id => !R[id] && !IGNORE.has(id));
ok(Object.keys(found).length > 60, Object.keys(found).length + ' codes distincts trouvés dans le source');
ok(!missing.length, 'tous figurent au registre' + (missing.length ? ' — MANQUENT : ' + missing.map(id => id + ' (' + [...found[id]].join(',') + ')').join(' ; ') : ''));
ok(Object.keys(R).every(id => ['non-verifie', 'masque', 'verifie'].includes(R[id].status)), 'chaque entrée a un statut connu');
ok(Object.keys(R).filter(id => R[id].status === 'verifie').length === 0, 'aucun code n’est tenu pour « verifie » sans décision du projet (D-106 : le projet vérifie, pas le code)');
console.log('== textes de contenu (ticket, cause, chemin optimal, indices…) : aucun Event ID masqué (30/10/2026)');
{ const maskedEv = Object.keys(R).filter(id => /^evt:/.test(id) && R[id].status === 'masque').map(id => id.split(':').pop());
  const re = new RegExp('(?:[eéè]v[eéè]nements?|Event ?ID|ID d[’\']?[eéè]v[eéè]nements?)\\s*(?:n°\\s*)?(?:' + maskedEv.join('|') + ')\\b', 'i');
  const hits = []; SIM.faults.forEach(def => { const t = JSON.stringify(def, (k, v) => typeof v === 'function' ? undefined : v); const m = t.match(re); if (m) hits.push(def.id + ' (« ' + m[0] + ' »)'); });
  ok(maskedEv.length >= 3, maskedEv.length + ' Event ID masqués au registre (' + maskedEv.join(', ') + ')');
  ok(!hits.length, 'aucun texte de panne ne cite un Event ID masqué' + (hits.length ? ' — CITÉ DANS : ' + hits.join(' ; ') : ''));
  ok(re.test('Journal DHCP-Server : événement 1046') && re.test('Event ID 1502') && !re.test('Journal DHCP-Server : l’événement d’erreur du service'), 'neutralisation : le contrôle voit « événement 1046 » et « Event ID 1502 », pas le texte corrigé'); }
console.log('== exécution + neutralisation');
K.reset();
K.text('Échec de la connexion : 0x8FFF0001 (code injecté par le test)', 'test');
ok(!!K.unlisted['hex:0x8FFF0001'], 'neutralisation : un code absent du registre est vu comme « non listé » (le test d’exécution de load.js virerait au rouge)');
R['hex:0x8FFF0001'] = { status: 'non-verifie', from: 'test' }; K.reset(); K.text('Échec : 0x8FFF0001', 'test'); delete R['hex:0x8FFF0001'];
ok(!K.unlisted['hex:0x8FFF0001'], 'neutralisation inverse : une fois listé, il n’est plus signalé');
K.reset();   /* le code injecté ne doit pas faire échouer ce processus au titre de load.js */
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
