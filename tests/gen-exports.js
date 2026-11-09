/* Exports pour Cowork (consigne de suite, travail 8 ; D-104) : configurations de départ, telles que le simulateur les produit.
   Génère docs/EXPORTS-COWORK/ :
     - running-config des trois commutateurs de Colomiers (EtherChannel / STP) ;
     - sous-ensemble minimal de Labège : R-LB2 (zone 0, réseau local derrière), R-LB3 (ABR zone 0 / zone 1), R-LB6 (zone 1, réseau local derrière) ;
     - custom.rules des deux instances Snort de pfsense-tls (WAN et LAN).
   Rien n'est ajouté au contenu produit par le simulateur ; seules sont retirées les deux lignes « Building configuration… » et
   « Current configuration : N bytes » (messages de l'affichage, pas de la configuration) et placé un en-tête en commentaire.
   Ces exports se régénèrent : node tests/gen-exports.js */
'use strict';
const fs = require('fs'), path = require('path');
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const outDir = path.join(__dirname, '..', 'docs', 'EXPORTS-COWORK'); fs.mkdirSync(outDir, { recursive: true });
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const HDR = 'Configuration de simulateur, non validée sur un IOS réel.';
const files = [];
const ios = (id, label) => {
  const sh = SIM.emu.openIos(env, id, { via: 'console' }); sh.exec('enable');
  const lines = sh.exec('show running-config').out.map(x => x.t).filter(l => !/^Building configuration\.\.\.$/.test(l) && !/^Current configuration : \d+ bytes$/.test(l));
  while (lines.length && lines[0] === '') lines.shift();
  const body = lines.join('\n') + '\n';
  const name = label + '-' + id + '.running-config.txt';
  const hdr = ['! ' + HDR, '! Produite par le simulateur EDIVN Lab (src/ + node tests/gen-exports.js), appareil ' + id + ', monde sain, graine 1.', '! Les lignes « Building configuration… » et « Current configuration : N bytes » de la commande show running-config sont retirées.', '! Les empreintes « secret 5 » sont celles que le simulateur fabrique : une plateforme réelle peut les rejeter (information à rapporter).', '!'].join('\n');
  fs.writeFileSync(path.join(outDir, name), hdr + '\n' + body); files.push([name, id]);
};
['SW-CA', 'SW-CB', 'SW-CC'].forEach(id => ios(id, 'colomiers'));
['R-LB2', 'R-LB3', 'R-LB6'].forEach(id => ios(id, 'labege'));
const snort = W.dev['pfsense-tls'].snort.ifaces;
snort.forEach(i => {
  const name = 'pfsense-tls-snort-' + i.iface + '.custom.rules';
  const hdr = ['# ' + HDR.replace('un IOS réel', 'un Snort ni un pfSense réels'), '# Produit par le simulateur EDIVN Lab, pfsense-tls, instance Snort sur l’interface ' + i.iface.toUpperCase() + ' (' + i.descr + ').', '# Contenu de custom.rules tel que le simulateur le détient ; aucune règle ajoutée.', ''].join('\n');
  fs.writeFileSync(path.join(outDir, name), hdr + '\n' + String(i.custom || '') + '\n'); files.push([name, 'pfsense-tls ' + i.iface]);
});
const readme = ['# Exports pour Cowork (D-104)', '', '*Généré par `node tests/gen-exports.js`. Ne pas éditer à la main.*', '',
  '**Ce que c\'est** : les configurations de départ des laboratoires réseau à monter, **telles que le simulateur les produit**. ' + HDR + ' Cowork signale toute ligne rejetée par la plateforme réelle : c\'est une information, pas une erreur.', '',
  '| Fichier | Appareil | Rôle |', '|---|---|---|'];
const role = n => /colomiers/.test(n) ? 'Colomiers : commutateur (EtherChannel / STP)' : /labege-R-LB2/.test(n) ? 'Labège : routeur de zone 0, réseau local 10.30.102.0/24 derrière' : /labege-R-LB3/.test(n) ? 'Labège : ABR (zone 0 / zone 1)' : /labege-R-LB6/.test(n) ? 'Labège : routeur de zone 1, réseau local 10.30.106.0/24 derrière' : 'Snort : règles personnelles de l\'instance';
files.forEach(([n, id]) => readme.push('| `' + n + '` | ' + id + ' | ' + role(n) + ' |'));
readme.push('', '## À savoir avant de monter', '',
  '- **Labège, sous-ensemble minimal** : R-LB2 – R-LB3 – R-LB6, en ligne. R-LB2 porte aussi une interface vers R-LB1 (`GigabitEthernet0/0`, 10.30.12.0/30) : dans ce sous-ensemble, elle n\'a pas de voisin (R-LB1 absent). R-LB3 porte une interface vers R-LB4 (`GigabitEthernet0/1`, 10.30.34.0/30), idem. Ces deux interfaces sont laissées telles que le simulateur les produit.',
  '- **Colomiers** : les trois commutateurs sont exportés ensemble ; leurs descriptions d\'interface disent qui est relié à qui (câblage non reproduit ici).',
  '- **Modèles** : le simulateur déclare un C3560 (SW-CA) et des C2960 (SW-CB, SW-CC) pour Colomiers, des 2911 pour Labège (`show version`). Valeurs de contenu **à vérifier** (voir `docs/INVENTAIRE-COMMANDES.md`, section R-77). Ce n\'est pas une exigence de matériel.',
  '- **Snort** : une règle personnelle par ligne ; deux instances (WAN, LAN). Le numéro de règle `1000001` est celui que cite D-90.',
  '- **Rien ici n\'est sourcé** : ce sont des sorties de simulateur. Si une plateforme réelle les rejette ou les modifie, la différence est la donnée.');
fs.writeFileSync(path.join(outDir, 'README.md'), readme.join('\n') + '\n');
console.log(files.length + ' fichiers dans docs/EXPORTS-COWORK/');
