# Journal du code (Claude Code) — dettes, statuts et preuves

*Tenu par Claude Code. Il ne décide rien : les décisions sont dans `DECISIONS.md` (projet). Chaque entrée dit ce qui est vrai dans le code à la date indiquée.*

## 1. Statut « livrée, non terminée » (D-100, D-108)

*Mis à jour le 29/10/2026 (soir), selon la consigne de suite (travail 1). Trois comptes à rapporter à chaque séance :*

| Compte | Nombre | Détail |
|---|---|---|
| **Variantes irréparables retirées du tirage** (`SIM.RETIRED_VARIANTS`, `src/content/09-retired.js`) | **2** | `ad_secure_channel` « canal » ; `lx_nginx` « expire » (certificat expiré). Combinaisons de variantes : **372 avant retrait → 369 après** (produit cartésien de `tests/retired.js`) |
| **Pannes non prouvées réparables par l'interface** (« non prouvé », pas « prouvé irréparable », D-108) | **18** | `multi_vitrine` (1) + les **17 pannes `px`** nommées ci-dessous |
| **Dettes de parcours** (D-66 / D-108) | voir §1 ter | 5 pannes OSPF/EtherChannel/STP encore sans parcours : `ospf_default_route`, `ospf_area_mismatch`, `ec_allowed_vlan`, `ec_po_shutdown`, `stp_loop_cable` (terminal seul, `tests/ios-fixes.js`) |

### 1 bis. Détail

| Panne / variante | Dette | Où c'est mesuré | Mesure en vigueur |
|---|---|---|---|
| `ad_secure_channel`, variante « canal » | Aucune console ni commande ne la répare (D-102) | `tests/ui/gui-sweep-win.js` (`KNOWN_GAP`) | **Retirée du tirage**, contenu conservé, `tests/retired.js` ; réintégration après R-75 (D-107) |
| `lx_nginx`, variante n° 2 (« expire » : certificat expiré) | La correction du moteur est une date modifiée dans le modèle ; **aucune commande de renouvellement n'est émulée** (ni `certbot`, ni `openssl`) | `tests/cli-sweep-lx.js` (liste `EXEMPT`) | **Retirée du tirage le 29/10/2026 (D-108)**, contenu conservé ; réintégration après le relevé R-77 des sorties d'`openssl` et de `certbot` (D-13) |
| `multi_vitrine` (combinaison 0) | Panne composée : une partie se corrige dans l'interface pfSense (redirection de port) | `tests/cli-sweep-lx.js` (`EXEMPT`) | **Livrée, non terminée.** Exemptée du balayage terminal avec sa raison ; la partie pfSense est couverte par `tests/ui/pfw2.js` ; toujours tirée |
| `phys_patch` | Geste physique (câble de brassage) : réparée depuis le dos du poste, pas au terminal, par nature | `tests/cli-sweep-ios.js` (`EXEMPT`) | Exemptée avec sa raison ; couverte par `tests/ui/rig2.js phys_patch` |
| **17 pannes `px`** : `px_down`, `px_pkg_broken`, `px_iface`, `px_client_port`, `px_client_bypass`, `px_blacklist_regex`, `px_blacklist_overblock`, `px_whitelist`, `px_sg_off`, `px_sg_category`, `px_safesearch`, `px_dns_upstream`, `px_log_off`, `px_trans_off`, `px_quic`, `px_trans_multi`, `px_cascade` | **Aucun parcours** par l'interface pfSense ne prouve qu'un joueur peut les réparer par clics et saisies. Les 4 autres pannes `px` (`px_subnet_denied`, `px_cache_unsaved`, `px_sg_default_deny`, `px_sg_nolist`) ont un parcours (`tests/ui/proxy-faults.js`) | `tests/ui/proxy-faults.js` | **Livrées, non terminées**, toujours tirées. Périmètre `px` : attente n° 20 (porteur du projet). `docs/PANNES-PROXY.md` corrigé |

**Les deux variantes Linux exemptées du balayage terminal** (`tests/cli-sweep-lx.js`, `EXEMPT`) : `lx_nginx#2` (voir ci-dessus : aucune commande de renouvellement) et `multi_vitrine#0` (partie pfSense dans l'interface web). **Seule la première est maintenant hors tirage**.

### 1 ter. Dettes de parcours (consigne de suite, travail 5 — mis à jour le 29/10/2026 au soir)

**Parcours livrés** (`tests/ios-parcours.js`, jouent les gestionnaires des terminaux Cisco et la vraie mission, du ticket à la clôture, avec neutralisations) : `ec_negotiation` (3 variantes), `ec_group_missing` (2), `ec_member_mismatch` (3), `stp_root_moved` (3), `ospf_timers` (3, sonde `ospfnbr`), `ospf_lan_network` (3, sonde `ping`), `ospf_routerid_dup` (2). Ils vérifient aussi : la description de vérification (D-71) ne nomme ni la commande ni la cause ; la clôture sur ping est refusée avec son motif (`closeNote`) ; un ping après correction ne résout pas ; la relecture de l'état résout ; sans correction, la relecture ne résout rien ; le débrief porte le motif du refus.

**Restent sans parcours** (dette D-108, terminal seul via `tests/ios-fixes.js` et `tests/cli-sweep-ios.js`) : `ospf_default_route`, `ospf_area_mismatch`, `ec_allowed_vlan`, `ec_po_shutdown`, `stp_loop_cable`. Aucune des cinq n'est « silencieuse » au sens de D-93 (leur sonde est un ping qui bascule).

**Correction d'une affirmation antérieure** : `tests/ui/colomiers-map.js` n'est pas un parcours d'`ec_negotiation` ; c'est un test de la carte. L'affirmation « seule `ec_negotiation` a un parcours » (D-93) était inexacte : aucune des quatre n'en avait avant `tests/ios-parcours.js`.

**Défauts trouvés en construisant ces parcours** :
- `ospf_routerid_dup` ne pouvait pas atteindre « résolue » : sa vérification par défaut exigeait un ping d'une destination que l'anneau OSPF garde joignable, donc jamais observé comme changé. Corrigé par une observation `show:<appareil>:ospf-neighbor` émise par `show ip ospf neighbor`, et une vérification explicite (`verify: ['show:R-LB*:ospf-neighbor']`).
- `ospf_timers` : même défaut, même correction.
- Les quatre pannes EtherChannel/STP déclarent la vérification par la lecture de l'état (`show etherchannel summary`, `show spanning-tree`).
- **Cause générale à trancher** : 173 pannes sur 179 n'ont **aucune** description de vérification (`verifyText`) : seules `ospf_timers`, `ospf_routerid_dup`, `ec_negotiation`, `ec_group_missing`, `ec_member_mismatch` et `stp_root_moved` la portent. Le ticket n'affiche « Pour clôturer : » que pour celles-là. Proposition dans `DECISIONS-PROPOSEES.md`.

Les balayages terminal échouent si une variante dont la correction touche un équipement IOS ou un serveur Linux n'est ni balayée ni exemptée **avec sa raison** (`tests/sweep-coverage.js`).

## 2. D-91 — ce qui serait à rejouer si la capture C8 contredit la copie à la création du Port-channel

Le Port-channel est créé en copiant la configuration du premier membre. Si IOS ne recopie pas, il faudrait revoir :

- **17 variantes** (13 `ec_*` + 4 `stp_*`, balayées par `tests/cli-sweep-ios.js`) : `ec_allowed_vlan` ×3, `ec_group_missing` ×2, `ec_member_mismatch` ×3, `ec_negotiation` ×3, `ec_po_shutdown` ×2, `stp_loop_cable` ×1, `stp_root_moved` ×3 ;
- `tests/ios-fixes.js` (30 pannes dont les `ec_*`), `tests/l2-cli.js` (26 assertions), `tests/ui/colomiers-map.js` ;
- l'ordre des lignes de `show running-config` (interface Port-channel avant ou après les membres) ;
- les clés `l2-ec-show`, `l2-ec-syslog`, `l2-stp-*` du registre `docs/A-VERIFIER.md`.

## 3. D-92 — le coût STP et les numéros de ports

Preuve par perturbation (la valeur est changée, les contrôles sont rejoués), faite le 29/10/2026 :

- **Coût STP** (`L2.portCost`, Port-channel compris) : valeurs perturbées → `faults ec_ stp_`, `ios-fixes`, `l2-cli`, `cli-sweep-ios` restent verts. **Aucune sonde, aucun symptôme, aucune réparation ne dépend de la valeur exacte du coût.**
- **Numéros de ports** (`L2.portNbr`, colonne `Prio.Nbr`) : valeurs inversées (`1000 − n`) → `faults`, `ios-fixes`, `cli-sweep-ios` restent verts (aucune sonde ni réparation ne dépend du numéro), **mais 1 assertion de `tests/l2-cli.js` échoue** : « le câble resté seul devient port racine, Po1 est bloqué (Altn BLK) ». Le **rôle affiché** d'un port (qui bloque) dépend donc du numéro quand les coûts sont égaux (critère de départage). Condition de D-92 : **vraie pour les sondes et les réparations, fausse pour un état affiché** dans ce cas précis. Le départage par numéro de port est à vérifier sur capture (clé `l2-stp-portid`).

## 4. D-97 — réparations écrites à la main dans les balayages

- `tests/cli-sweep-ios.js`, table `OVERRIDE` : **4** réparations écrites en vraies commandes (la différence de `show running-config` n'est pas lisible) : `c_portsec#0` et `c_portsec_imp#0` (port désactivé par la sécurité de port : retrait des adresses collantes, `shutdown` / `no shutdown`), `c_ssh#0` (`crypto key generate rsa modulus 2048`), `c_ssh_auth#0` (ACL d'accès SSH). *(Le décompte « 3 » donné plus tôt était faux.)*
- `tests/cli-sweep-lx.js` : pas de table par panne ; chaque étape de correction est traduite par **type d'étape** en vraies commandes : `nano` + enregistrement (`lx.replace`, `lx.fstab`, `lx.append`, `lx.write`), `chmod`, `chown`, `systemctl`, `mv`, `ln -s`, `rm`, `truncate`, `ufw`, `setfacl`/`getfacl`, `systemctl restart networking`, `reboot`, `mysql` (`RENAME USER`, `FLUSH PRIVILEGES`). Un type d'étape inconnu fait échouer (« NON TRADUIT »).
- **Familles Cisco couvertes par les 72 combinaisons** : `c_*` (ACL, DHCP routeur, NAT, ROAS, route par défaut, SSH, SVI, trunk, VLAN, sécurité de port), `dhcp_relay_*`, `dhcp_suffix`, **EtherChannel** (`ec_*`), **STP** (`stp_*`), **OSPF une area et multi-area** (`ospf_lan_network` ×6, `ospf_default_route` ×4, `ospf_timers` ×3, `ospf_routerid_dup` ×2, `ospf_area_mismatch` ×3).

## 5. D-98 — Playwright est une dépendance de développement (D-75), démonstration

- Playwright n'est importé que par des fichiers de `tests/ui/` (20 directement, les autres via `tests/ui/lib.js`) ; `build.js` ne lit que `src/`.
- `build.js` **arrête désormais la construction (code 3)** si le livrable contient une ressource externe (`<script src=`, `<link rel="stylesheet">`, `<link href="http…">`, `@import http…`, image / iframe distante). `tests/build-guard.js` le prouve : copie saine → code 0 ; feuille de style distante ajoutée → code 3 (sans la garde elle passerait) ; le livrable ne contient aucune occurrence de « playwright ».
- **Exigence réseau à la reconstruction** : jouer les tests d'interface demande Playwright **et un navigateur Chromium** (`npm i -g playwright`, puis téléchargement du navigateur) : cela exige un accès réseau à la reconstruction des tests. Le **jeu** (`node build.js`) n'a aucune dépendance, aucun accès réseau, aucun `npm install`. Les tests d'interface se lancent avec `NODE_PATH=$(npm root -g)`.
- Dans cette arborescence il n'y a **ni `package.json` ni `build-single.mjs`** (voir `docs/REPONSE-PROJET-2026-10-29.md`, écarts constatés).

## 6. Défauts de barème trouvés en répondant à D-79 / D-40

- `needsReboot` : le moteur (`src/engine/80-game.js`) exemptait de l'impact (−4) un redémarrage « nécessaire », mais **aucune panne ne portait l'indicateur** : le redémarrage qui fait partie de la correction de `lx_fstab` coûtait −4. Corrigé (`needsReboot: true` sur `lx_fstab`), test + neutralisation dans `tests/game.js`.
- Les aides consultées (plan d'adressage, aide-mémoire) n'étaient **pas tracées** (D-94 a). Elles le sont : `Mission.aid()`, section « Aides consultées » du débrief, aucun point retiré, hors de la trace d'actions (`tests/game.js`).

- **Le terminal Linux n'émettait aucun tag d'impact** (`reboot`, `poweroff`, `systemctl stop`) : le barème de D-109 était sans effet sur Linux et l'invariant « zéro malus sur un chemin déclaré » ne pouvait pas virer au rouge pour `lx_fstab`. Corrigé (émission des quatre tags de D-109 par le terminal, propagation à travers `&&`), `tests/lx-impact.js` ; invariant dans les trois balayages, neutralisation dans `tests/sweep-coverage.js` et `tests/ui/gui-sweep-neutral.js`. **Changement de comportement du jeu à connaître et à pouvoir défaire** : voir `DECISIONS-PROPOSEES.md`, « Travail 7 ».

## 7. Reste à faire connu (au 29/10/2026, au soir)

- **Variante « canal »** (attend R-75, D-107) ; **HSRP** (attend les attentes n° 9 et n° 15) ; **Hyper-V** (attend D-84) : non commencés, conformément à la consigne.
- **Balayage graphique pfSense des 17 pannes `px`** : attend la réponse n° 20.
- **Codes d'erreur** : l'inventaire par exécution couvre 19 codes sur 92 ; la colonne « pannes » est approximative ; le projet doit vérifier les sources et rendre la liste blanche (`docs/CODES-ERREUR.md`).
- **D-99 Linux et IOS** : aucun comportement changé, en attente du relevé R-77.
- **Pannes sans `verifyText`** : 173 (voir §1 ter).
- **Pannes OSPF/EtherChannel/STP sans parcours** : 5 (voir §1 ter).
- **Barème** : émission d'impact côté Linux à confirmer ou défaire (`DECISIONS-PROPOSEES.md`, « Travail 7 »).

## 7 bis. Arbitrages du 30/10/2026 — ce qui a changé dans le code (voir `DECISIONS-PROPOSEES.md`, dernière section)

| Changement | Où | Test | Pour défaire |
|---|---|---|---|
| Règle d'impact « par le résultat » (stop puis start du même service = 0) | `Mission.act`, `src/engine/80-game.js` (`SVC_STATE`, `SVC_UP`, `refunded`) | `tests/impact-net.js` | retirer le bloc « Impact (D-79, règle par le résultat) » et le filtre qui suit |
| `cmd` Windows : `impact` / `danger` recopiés dans le résultat de la ligne et du pipeline | `src/emu/10-winshell.js` (`run`, `runPipeline`) | `tests/impact-net.js` (`net stop`, `shutdown /r`) | retirer les deux lignes |
| Pannes non prouvées exclues du chronométré | `src/content/09-unproven.js`, `Game.pick` (`opts.timed`), `Mission` (assemblage composé) | `tests/unproven-timed.js` | vider `SIM.UNPROVEN_FAULTS` |
| « événement 1046 » retiré des textes de `dhcp_unauth` et `dhcp_unauth_bdx` ; contrôle de tout Event ID masqué dans les textes de panne | `src/content/20-faults-base.js`, `27-faults-extra.js` ; `tests/codes-audit.js` | `tests/codes-audit.js` | rétablir le texte (déconseillé : le numéro est masqué au journal) |

**Une erreur de ma part, corrigée avant la livraison** : la première version du contrôle des Event ID masqués utilisait `[eé]v[eè]nement` ; l'accent aigu du second « é » n'était pas dans la classe, la regex ne reconnaissait pas « événement ». Le contrôle passait donc **à vide** avant correction. Je l'ai vu parce que la ligne de neutralisation (« le contrôle voit *événement 1046* ») virait au rouge. Sans cette ligne, l'erreur aurait été silencieuse.

## 8. Rejeu complet des dix fonctions (D-110) — chiffres réels, 30/10/2026

**Rejeu du 30/10/2026 après les arbitrages du jour : 111/111 OK en 3 068 s** (deux tests ajoutés : `impact-net`, `unproven-timed` ; une première batterie avait donné 110/111 : le crochet de neutralisation de `gui-sweep-neutral` injectait un arrêt de service sans rien arrêter, que la règle « par le résultat » compte justement pour nul ; crochet corrigé, code du jeu inchangé entre les deux). Les chiffres du tableau ci-dessous sont ceux du rejeu précédent (109 tests, 2 774 s), non remesurés ligne par ligne. Rejeu précédent : batterie complète `node tests/all.js` (build, puis **109 tests**) : **109/109 OK en 2 774 s** (`docs/RAPPORT-TESTS.md`). Ce n'est pas le même nombre qu'hier (103) : six tests ajoutés cette séance (`gestion-app`, `win-unsupported`, `ios-noeffect`, `ios-parcours`, `lx-impact`, `codes-audit`). La batterie a d'abord été rouge deux fois sur le balayage graphique (violations de l'invariant du barème, voir `DECISIONS-PROPOSEES.md`, « Travail 7 ») ; les trois corrections sont décrites là. La dernière exécution est verte.

| # | Fonction | Mesure |
|---|---|---|
| 1 | Moteur | `faults` : 179/179 pannes valides ; `game`, `scoring`, `regress`, `retired`, `progress`, `combo`, `addressing` verts |
| 2 | Fumée de l'interface | `smoke-all`, `sweep` (toutes pannes × 2 graines × 3 modes) verts |
| 3 | Intégration du catalogue | `validate` 179/179 ; `lint-content` vert |
| 4 | Parcours par l'interface | `tests/ui/*` verts (consoles Windows, pfSense, baie, carte, `gestion-app` 7 causes) ; `ios-parcours` 7 pannes Cisco, 19 variantes |
| 5 | Audit de sourçage | **partiel** : `codes-audit` (codes d'erreur) ; aucun test ne vérifie qu'un texte réaliste a une entrée `A-VERIFIER` (193 entrées au build) |
| 6 | Contrôle de types | **absent** (ni `package.json` ni `tsc`) |
| 7 | Balayage Linux | `cli-sweep-lx` : 85 combinaisons réparées, 0 échec, 87 variantes touchant un serveur Linux dont 2 exemptées, **0 malus de danger ou d'impact** |
| 8 | Balayage Cisco | `cli-sweep-ios` : 72 combinaisons réparées, 0 échec, 73 touchées dont 1 exemptée, **0 malus** |
| 9 | Balayage Windows (terminal) | `audit-win-cli`, `cli-parity`, `ps-confirm`, `win-unsupported` verts |
| 10 | Balayage graphique Windows | `gui-sweep-win` : 96/96 réparées, 0 à reprendre, 146 étapes toutes avec recette graphique, **0 malus** |

Neutralisations (D-70) rejouées dans la même batterie : `sweep-coverage` (couverture, recette cassée, **barème : `lx_fstab` sans `needsReboot`**), `gui-sweep-neutral` (recette non jouée, **impact injecté**), `build-guard`, `codes-audit`, `lx-impact`, `game` (exemption `okDanger` limitée).

**Build** (30/10/2026) : `dist/EDIVN-Lab.html` 2 603 224 octets, sha256 `10d2547170def9490ff99c59ebd07ec11293624af02bd59b5ddf7b2c8409049f`, 118 fichiers source, 179 pannes, 50 compétences, 2 variantes retirées du tirage (`docs/ETAT-DU-BUILD.md`).

**Trois comptes** (D-98) : irréparables retirées **2** ; non prouvées par l'interface **18** (17 `px` + `multi_vitrine`) ; dettes de parcours Cisco **5** (`ospf_default_route`, `ospf_area_mismatch`, `ec_allowed_vlan`, `ec_po_shutdown`, `stp_loop_cable`) (les 7 autres pannes OSPF/EtherChannel/STP ont un parcours, §1 ter).

