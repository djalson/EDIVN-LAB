# État du dépôt (Claude Code, 29/10/2026 au soir) — travail 2 de la consigne de suite

*Document de constat, à verser au projet. Il ne décide rien. Tout ce qui n'est pas établi est écrit « non établi ». Les chiffres sont ceux mesurés sur cette arborescence aujourd'hui.*

## 1. Les dix fonctions (D-110) : quel script les remplit

| # | Fonction | Script(s) de ce dépôt | Remarque |
|---|---|---|---|
| 1 | Moteur | `tests/faults.js` (179/179 pannes : sain → cassé → réparé → contournement), `tests/game.js`, `tests/scoring.js`, `tests/combo.js`, `tests/regress.js`, `tests/retired.js`, `tests/progress.js`, `tests/addressing.js` | Node seul, sans navigateur |
| 2 | Fumée de l'interface | `tests/ui/smoke-all.js` (26 appareils × 3 pannes, Playwright), `tests/ui/sweep.js` (toutes les pannes × 2 graines × 3 modes) | Playwright |
| 3 | Intégration du catalogue | `tests/validate.js` (le validateur de scénarios joue chaque panne du catalogue, 179/179, plus les règles D-90), `tests/lint-content.js` (complétude, gabarits, couverture des 50 compétences) | |
| 4 | Parcours par l'interface | `tests/ui/*.js` : consoles Windows (`win1` à `win11`), pfSense (`pfw1` à `pfw3`, `proxy-faults`, `snort-faults`), baie (`rig1` à `rig4`), carte (`colomiers-map`, `net1`, `net2`), etc. | Pas un script unique : une famille |
| 5 | Audit de sourçage | **Partielle.** `build.js` assemble le registre `SIM.AVREG` et écrit `docs/A-VERIFIER.md` (193 entrées) ; `tests/inventory-commands.js` et `tests/gen-captures.js` le lisent. **Aucun test n'échoue si un texte réaliste est affiché sans entrée de registre** | À construire avec l'audit des codes d'erreur (D-106) |
| 6 | Contrôle de types | **Absente.** Ce dépôt n'a ni `package.json`, ni TypeScript, ni `tsc` | |
| 7 | Balayage Linux (terminal) | `tests/cli-sweep-lx.js` : 85 combinaisons réparées avec de vraies commandes, sans malus de barème (D-109), 87 variantes touchant un serveur Linux dont 2 exemptées | |
| 8 | Balayage Cisco (terminal) | `tests/cli-sweep-ios.js` : 72 combinaisons réparées en configuration IOS, 73 touchées dont 1 exemptée | |
| 9 | Balayage Windows (terminal) | `tests/audit-win-cli.js` (commandes réelles Windows : émulées, signalées « non gérée » ou absentes) ; `tests/cli-parity.js`, `tests/ps-confirm.js` | Ce n'est pas un balayage par panne comme 7 et 8 |
| 10 | Balayage graphique Windows | `tests/ui/gui-sweep-win.js` (+ `gui-recipes-win.js`) : 96/96 | |

Ajoutés le 30/10/2026 : `tests/impact-net.js` (règle d'impact par le résultat), `tests/unproven-timed.js` (pannes non prouvées exclues du chronométré).

Ajoutés le 29/10/2026 : `tests/codes-audit.js` (codes d'erreur, D-106), `tests/lx-impact.js` (tags d'impact du terminal Linux), `tests/ios-parcours.js` (parcours Cisco), `tests/gestion-app` (UI), `tests/gen-exports.js` (exports Cowork), `tests/build-guard.js` (livrable autonome, garde de `build.js`), `tests/sweep-coverage.js` (neutralisation des balayages terminal), `tests/ui/gui-sweep-neutral.js` (neutralisation du balayage graphique).

## 2. Commandes réelles du dépôt (pour réécrire `CLAUDE.md`)

```
node build.js                      # src/ → dist/EDIVN-Lab.html + docs/A-VERIFIER.md + docs/ETAT-DU-BUILD.md ; code 3 si ressource externe
node tests/all.js                  # batterie complète (build, 111 tests, ≈ 51 min) → docs/RAPPORT-TESTS.md
node tests/all.js --quick          # sans le « singe » ni les graines multiples
node tests/all.js --only=<motif>   # les tests dont le nom contient le motif
node tests/<nom>.js                # un test Node
NODE_PATH=$(npm root -g) node tests/ui/<nom>.js   # un test d'interface (Playwright installé globalement)
node tests/gen-docs.js             # régénère COUVERTURE-UI.md, PANNES-PROXY.md, LIENS-COURS.md (ne pas éditer à la main)
node tests/inventory-commands.js   # régénère docs/INVENTAIRE-COMMANDES.md
```
Archive des sources : `cd /home/claude && zip -qr EDIVN-Lab-sources.zip game -x 'game/node_modules/*' 'game/dist/*.png'`. Node v22.23.4. Aucune dépendance d'exécution ; Playwright (et un Chromium) pour `tests/ui/`.

## 3. Les unités (légende des chiffres rapportés)

| Mot | Ce qu'il compte | Valeur |
|---|---|---|
| **Panne** | une définition du catalogue (`SIM.faults`) | **179** (106 ont des variantes) |
| **Variante** | une entrée d'une liste `vary` d'une panne | **298** entrées au total |
| **Combinaison** | un élément du produit cartésien des variantes d'une panne (`F.variantCombos`), une panne sans variante comptant pour 1 | **372** avant retrait, **369** après retrait des deux variantes retirées (« canal », « expire »). Le plafond de 12 combinaisons par panne n'est jamais atteint |
| **Variante balayée** | une combinaison distincte par correction, comptée par les balayages | Cisco 72 ; Linux 85 ; graphique Windows 96 |

Pourquoi retirer **une** variante enlève plus d'**une** combinaison : `ad_secure_channel` a deux listes de variantes croisées (`c` et `m` ; `m` = canal / compte), donc retirer « canal » retire 2 combinaisons : 372 → 370 ; retirer ensuite `lx_nginx` « expire » en retire 1 : → 369. **« 371 variantes »**, cité dans le retour du 29/10, est le nombre de variantes de la comparaison avant / après du bouclage (D-101 n° 3) : je n'ai pas conservé son mode de décompte exact, donc **non établi**, et je ne le réutilise plus.

## 4. Historique git

**Non établi : cette arborescence n'est pas un dépôt git** (`git rev-parse` : « not a git repository » dans le dossier et ses parents). Il n'existe donc ni premier commit, ni nombre de commits, ni trace d'un `package.json`, d'un moteur TypeScript ou d'un dossier `edivn-sim`. Ce que je peux établir par les dates de fichiers (indicatif, ce ne sont pas des commits) : les fichiers du dépôt sont datés du 26/10/2026 (8 fichiers), 27/10 (144), 28/10 (20) et 29/10 (60). **Rien dans l'arborescence ne la relie à une arborescence plus ancienne** (aucune mention de `npm run`, de `build-single.mjs` ni d'un dossier `edivn-sim`). La relation avec la copie du projet du 12/09 (`EDIVN-Simulateur.html`, 468 458 octets) est donc **non établie** de mon côté : pour la trancher, il faudrait l'historique du poste qui héberge le travail, que je ne vois pas.

## 5. Taille et empreinte du build

Voir `docs/ETAT-DU-BUILD.md` (régénéré par chaque `node build.js`) : à cette date, 2 603 224 octets, 118 fichiers source assemblés, 179 pannes, 50 compétences, 2 variantes retirées du tirage. L'empreinte sha256 y figure.

## 6. Rejeu complet des dix fonctions (chiffres réels)

Voir `docs/JOURNAL-CODE.md` §8.
