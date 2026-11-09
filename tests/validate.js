/* Validation de scénarios déclaratifs : tout le catalogue passe, les scénarios cassés sont refusés avec un message clair,
   une variante créée par un formateur (donnée pure, aucun code) s'importe et se joue. */
const SIM = require('./load.js')(); const F = SIM.fault;
let bad = 0; const ok = (n, c, extra) => { console.log((c ? '✓ ' : '✗ ') + n + (!c && extra ? ' — ' + extra : '')); if (!c) bad++; };
const clone = o => JSON.parse(JSON.stringify(o));
const all = SIM.faults.slice();
let fails = 0; for (const d of all) { const r = F.validate(d, { allowExisting: true }); if (!r.ok) { fails++; console.log('  ', d.id, r.errors.join(' ; ')); } }
ok('catalogue complet validé (' + all.length + ')', fails === 0);

const base = all.find(d => d.id === 'dhcp_scope_off');
let r;
r = F.validate(Object.assign(clone(base), { id: 'x1' }), {}); ok('variante saine acceptée', r.ok, r.errors.join(' ; '));
r = F.validate(clone(base), {}); ok('id déjà pris refusé', !r.ok && /déjà utilisé/.test(r.errors[0]));
r = F.validate(Object.assign(clone(base), { id: 'x2', skills: [] })); ok('sans compétence refusé', !r.ok && /compétence/.test(r.errors.join()));
r = F.validate(Object.assign(clone(base), { id: 'x3', skills: ['astrologie'] })); ok('compétence inconnue refusée', !r.ok && /inconnue/.test(r.errors.join()));
r = F.validate(Object.assign(clone(base), { id: 'x4', hints: ['un'] })); ok('3 indices exigés', !r.ok);
r = F.validate(Object.assign(clone(base), { id: 'x5', inject: [{ do: 'explose' }] })); ok('étape inconnue refusée', !r.ok && /étape inconnue/.test(r.errors.join()));
r = F.validate(Object.assign(clone(base), { id: 'x6', inject: [] })); ok('injection vide → aucun symptôme, refusé', !r.ok && /aucun symptôme/.test(r.errors.join()));
r = F.validate(Object.assign(clone(base), { id: 'x7', fix: [] })); ok('correction qui ne répare pas, refusée', !r.ok);
r = F.validate(Object.assign(clone(base), { id: 'x8', probes: [{ t: 'bidon' }] })); ok('sonde inconnue refusée', !r.ok && /type inconnu/.test(r.errors.join()));
/* D-90 : aucun scénario ne peut exiger un ping de PCEXT vers pfsense-tls tant que la règle Snort 1000001 est active (le ping bloquerait PCEXT) */
r = F.validate(Object.assign(clone(base), { id: 'x9', probes: [{ t: 'ping', from: 'PCEXT', to: '198.51.100.2' }] })); ok('D-90 : ping de PCEXT vers le WAN de pfsense-tls refusé, message explicite', !r.ok && /D-90/.test(r.errors.join(' ')) && /1000001/.test(r.errors.join(' ')), r.errors.join(' ; ').slice(0, 200));
r = F.validate(Object.assign(clone(base), { id: 'x10', probes: [{ t: 'ping', from: 'PCEXT', to: '198.18.0.1' }] })); ok('D-90 neutralisation : un ping de PCEXT vers une autre adresse (le FAI) n’est pas visé par la règle', !/D-90/.test(r.errors.join(' ')));
r = F.validate(Object.assign(clone(base), { id: 'x11', probes: [{ t: 'ping', from: 'PC-ADM', to: '198.51.100.2' }] })); ok('D-90 neutralisation : un ping depuis un poste interne vers pfsense-tls n’est pas visé', !/D-90/.test(r.errors.join(' ')));
r = F.validate(Object.assign(clone(base), { id: 'x12', verify: ['ping:PCEXT:*'] })); ok('D-90 : verify dont la seule voie est un ping de PCEXT vers le WAN, refusé', !r.ok && /D-90/.test(r.errors.join(' ')), r.errors.join(' ; ').slice(0, 200));
r = F.validate(Object.assign(clone(base), { id: 'x13', verify: ['ping:PCEXT:*', 'connect:PCEXT:*'] })); ok('D-90 neutralisation : ping + connexion TCP (ping non exigé) n’est pas visé par la règle', !/D-90/.test(r.errors.join(' ')), r.errors.join(' ; ').slice(0, 200));
r = F.validate('texte'); ok('non-objet refusé', !r.ok);
/* variante formateur : même panne, autre poste, importée puis rejouable */
const v = clone(base); v.id = 'dhcp_scope_off_rh'; v.title = 'Étendue DHCP désactivée (variante RH)';
const n0 = SIM.faults.length; r = F.importScenario(v); ok('import accepté', r.ok && SIM.faults.length === n0 + 1, r.errors.join(' ; '));
r = F.importScenario(v); ok('double import refusé', !r.ok && SIM.faults.length === n0 + 1);
process.exit(bad ? 1 : 0);
