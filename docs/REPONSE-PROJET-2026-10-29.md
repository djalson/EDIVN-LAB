# Réponse de Claude Code au projet « Simu Panne V2 » — 29/10/2026 (2e séance)

*Réponse à `claude/CONSIGNE-CODE-2026-10-29.md` et au retour du projet (D-90 à D-104). Rédigée par Claude Code, relayée par le porteur du projet. Rien ici n'est une décision : les choix sont à acter dans `DECISIONS.md` par le projet. Quand je ne peux pas répondre sans inventer, j'écris « non établi » et je dis ce qui manque (D-13).*

*Fichiers à verser au projet avec cette réponse : `docs/BALAYAGE-GRAPHIQUE.md`, `docs/JOURNAL-CODE.md`, `docs/INVENTAIRE-COMMANDES.md`, `docs/ETAT-DU-BUILD.md`, `docs/DECISIONS-PROPOSEES.md`, `docs/LIMITES.md`.*

---

## 1. Les nouveaux arbitrages du porteur du projet (29/10/2026, 13 h 52) — à acter par le projet

| # | Arbitrage du porteur du projet | Ce que j'en fais |
|---|---|---|
| A | **Règle générale « GUI d'abord »** : à choisir, une panne doit toujours être plutôt réparable par l'interface graphique que par ligne de code. | Appliquée comme critère de **tri des pannes et de définition de « terminé »** (voir §6). Elle ne remplace pas les balayages terminal. |
| B | **Règle générale « codes d'erreur »** : chaque code d'erreur affiché doit être **vérifié** et **utile à la résolution** (on doit pouvoir noter l'erreur sur un moteur de recherche et retrouver d'où elle vient et comment la réparer). Réponse de le porteur du projet à ma question : un code **non vérifiable** est **masqué jusqu'à capture** (le message garde son texte utile, aucun numéro inventé ; le numéro réapparaît dès qu'une capture ou une source officielle le confirme). | Pas encore appliquée au code : l'audit est la prochaine tâche (§4). Aucun code n'a été ajouté ou modifié cette séance. |
| C | **Variante « canal » d'`ad_secure_channel`** : **B en cible** (sortie puis rejointe du domaine par « Propriétés système », `sysdm.cpl`, interface graphique) **et A en complément** (`Test-ComputerSecureChannel -Repair -Credential`). | **La partie 1 B reste bloquée** : elle attend les captures du lot R-75 (consigne partie 1 B). La variante reste **retirée du tirage** (1 A faite). |
| D | **Application de gestion : périmètre validé** (D-103 tel qu'amendé). | La partie 3 est **débloquée**. Je ne l'ai **pas commencée** cette séance (§4). |

**Tension à arbitrer entre A et D (question 1, §8).** Les trois causes de l'application de gestion sont côté **Linux et SQL** (port 3306 fermé, pare-feu `ufw`, compte limité à un sous-réseau) : elles se réparent **par nature en ligne de commande**, il n'existe aucune interface graphique Linux dans le jeu. La règle A s'applique donc à elles comme « interface la plus graphique disponible = le terminal ». À confirmer (hypothèse écrite, non confirmée par le porteur du projet).

---

## 2. État de la consigne, partie par partie

| Partie | État | Preuve / où |
|---|---|---|
| 1 A — retirer la variante « canal » | **Faite** | Liste unique `SIM.RETIRED_VARIANTS` (`src/content/09-retired.js`) ; `tests/retired.js` ; combinaisons **372 → 370** ; neutralisation : liste vidée → la variante est tirée **59 fois sur 120 graines**. Compétences de la panne : `ad-compte`, `ad-ou`, `diag` (au niveau de la panne, pas de la variante). |
| 1 B — variante « canal » (B puis A) | **Bloquée** (captures R-75) | — |
| 2.1 Snort D-90 | **Faite** sauf précision ci-dessous | §3 |
| 2.2 EtherChannel / STP D-91–93 | **Faite** (réponses et liste) ; D-93 : trou signalé | §3 |
| 2.3 Disponibilité D-94 / D-95 / D-96 | **Faite** (traçage + invariant + preuves) ; Ctrl + Espace OS : **non établi** | §3 |
| 2.4 Contrôles permanents D-97 à D-100 | **Partielle** : couverture exhaustive et neutralisations faites ; inventaire D-99 **livré**, remplacement par « non gérée » **non fait** | §3, §5 |
| 2.5 Les huit correctifs D-101 | **Faits** avec conditions testées sauf 3 (« à vérifier ») | §3 |
| 3 Application de gestion | **Non commencée** (débloquée) | — |
| 4 Réponses de fond | **Faites** | §3 |
| 5 Documents | **Faits** | §3 |
| 6 Cowork : exports de configuration | **Non faits** | §4 |
| 6 Rejeu des « dix contrôles » | **Partiel** : voir §7 (les noms ne correspondent pas à ce dépôt) | §7 |
| Audit des codes d'erreur (règle B) | **Non fait** | §4 |

---

## 3. Réponses, avec preuves

### D-90 — Snort, blocage de PCEXT
- **Que fait `classify` d'un ping de PCEXT vers le WAN ?** Il n'existe **aucune fonction `classify`** dans le code. La classification des actions est `Mission.act` (`src/engine/80-game.js`) : `diagnostic` (rien ne change), `progress`, `regress`, `detour` (l'état change sans gain). Mesuré : le ping depuis PCEXT inscrit PCEXT (198.18.0.10) dans la table `snortBlocked` de `pfsense-tls` → l'état change → classé **`detour`** (« impasse »). **Il n'est ni « dangereux » ni « à impact »** : aucune règle `Game.DANGER` ne le vise, aucun tag d'impact. **Montant retiré : 0 point**, à tous les niveaux et modes (vérifié sur 4 pannes, `tests/game.js`). **D-40 prime.**
- **Règle de contenu au chargement** : faite dans le validateur (`src/engine/76-validate.js`), message explicite citant D-90 et la règle 1000001. Elle refuse (a) une sonde `ping` de PCEXT vers une adresse de `pfsense-tls` ; (b) un `verify` dont **la seule voie de clôture** est un ping de PCEXT vers le WAN (les motifs de `verify` se combinent par OU : `F.evaluate`). Tests (`tests/validate.js`) : ping PCEXT → WAN refusé ; verify « ping seul » refusé ; neutralisations : ping PCEXT → FAI, ping d'un poste interne, et verify « ping + connexion TCP » **non** visés. **Correction d'une affirmation antérieure de cette réponse** : j'avais écrit que les 179 pannes passaient la règle ; c'était faux. Dans sa première forme (le motif joker `ping:PCEXT:*` refusé en soi), la règle refusait **6 pannes Snort** (`snort_service`, `snort_rule_syntax`, `snort_homenet`, `snort_wrong_iface`, `snort_no_block`, `snort_cascade`) qui déclarent `verify: ['ping:PCEXT:*', 'connect:PCEXT:*']`. Ce ping n'y est qu'**une** des deux voies, jamais obligatoire : la règle est donc précisée ainsi (« exiger » = seule voie). **Point que je laisse au projet** : les billets de ces pannes décrivent une « sonde de test » qui envoie un ping depuis un poste externe vers l'adresse publique du pare-feu ; avec le blocage de PCEXT gardé (D-90), ce geste de test bloque PCEXT. Faut-il réécrire les billets ? Je ne l'ai pas fait.
- **Le débrief nomme la cause** : **n'était pas fait, c'est fait.** Section « Effets de bord de tes actions » du débrief : « Ton action « ping 198.51.100.2 » (PCEXT) a déclenché la règle Snort SID 1000001 (« ICMP depuis Internet vers le pare-feu ») et fait inscrire PCEXT (198.18.0.10) dans la table des hôtes bloqués de pfsense-tls. » Test + neutralisation (sans ping, aucun effet de bord) dans `tests/game.js`. Avant ce correctif, le ping apparaissait seulement comme une ligne d'« Impasses » sans cause.
- **Services ▸ Snort ▸ Blocked** : l'hôte bloqué y apparaît (même table `snortBlocked`, onglet testé par `tests/ui/snort-faults.js` : 198.18.0.10 et 10.10.20.60).

### D-91 — copie à la création du Port-channel
La liste de ce qu'il faudrait rejouer est dans `docs/JOURNAL-CODE.md` §2 : **17 variantes** (13 `ec_*` + 4 `stp_*`), `tests/ios-fixes.js` (30 pannes), `tests/l2-cli.js` (26 assertions), `tests/ui/colomiers-map.js`, l'ordre des lignes du `running-config`, clés `l2-ec-*` / `l2-stp-*`.

### D-92 — coût STP et numéros de ports : la condition est **vraie pour les sondes et les réparations, fausse pour un état affiché**
- **Coût** : valeurs perturbées → `faults ec_ stp_`, `ios-fixes`, `l2-cli`, `cli-sweep-ios` restent verts. **Oui.**
- **Numéros de ports (`Prio.Nbr`)** : valeurs inversées → sondes et réparations inchangées (**oui**), **mais 1 assertion de `l2-cli` casse** (« le câble resté seul devient port racine, Po1 est bloqué ») : le **rôle affiché** d'un port dépend du numéro quand les coûts sont égaux. Aucune panne n'en dépend ; un état affiché, si. À vérifier sur capture (`l2-stp-portid`).

### D-93 — pannes de redondance silencieuses
Le `ping` (première sonde) reste **vert dans 100 % des variantes** des trois pannes (3/3, 2/2, 3/3). Ce qui bascule (D-76) :
| Panne | Sondes qui basculent | Parcours par l'interface (D-66) |
|---|---|---|
| `ec_negotiation` | `ecflag` (drapeau `P` par port) + `ecstate` (état du groupe) | **Oui** : `tests/ui/colomiers-map.js` |
| `ec_group_missing` | `ecflag` + `ecstate` | **Non établi** : pas de parcours dédié ; couverte par `cli-sweep-ios` (terminal) seulement |
| `stp_root_moved` | `stproot` (racine du VLAN 10 et 20) | **Non** : couverte par `cli-sweep-ios` seulement |
- **Pas de quatrième gratuit** : `ec_member_mismatch` est aussi silencieuse (ping vert dans 2 variantes sur 3). À ajouter à la liste de D-93 par le projet ?
- **La description de vérification (D-71)** : **elle n'existe pas dans le code**. La clôture exige une observation depuis le poste (motifs `F.defaultVerify`), pas un texte par panne. **Non établi / non fait.**
- **Le débrief dit pourquoi une clôture sur ping est refusée** : **non** — le message est générique (« Le problème persiste pour l'utilisateur : le ticket est rouvert »). Le moteur refuse bien la clôture (les sondes d'état restent rouges), mais ne nomme pas la cause.

### D-94 / D-95 — plan d'adressage et aide-mémoire en chronométré
- (a) **Avant : non tracées. Maintenant : faites.** `Mission.aid()` : chaque ouverture du plan ou de l'aide-mémoire est tracée (temps + type) et listée au débrief (« Aides consultées »), **aucun point retiré** (barème identique avec/sans consultation, `tests/game.js`).
- (b) Le chemin optimal est le texte de la définition de la panne : **aucune** des 179 pannes ne cite le plan ou l'aide-mémoire dans ses étapes ; une consultation n'entre ni dans la trace d'actions ni dans le chemin suivi.
- (c) Le réglage formateur « masquer plan et aide-mémoire en chronométré » **n'existe pas** ; je ne l'ai pas ajouté (décision n° 17).
- **D-95 invariant** (`tests/cmdhelp.js`) : liste d'aide-mémoire identique sur le monde sain et sur **les 179 mondes en panne**, pour chaque équipement × mode. Neutralisation : une liste qui lit l'état du monde (un service arrêté retire une commande) fait virer le test au rouge.

### D-96 — coffre-fort dans les terminaux
- (a) **Où est rendu le bouton « clé »** : **dans** le cadre du terminal (`.term .tvault`, positionné en haut à droite, `src/css/39-cmdhelp.css`), **pas** hors du cadre répliqué. Il n'emprunte pas les codes visuels de la fenêtre (fond ambre propre, info-bulle « Coffre-fort : insérer le mot de passe (Ctrl + Espace) »).
- (b) **Ctrl + Espace sous Windows et macOS** : **non établi.** Je n'ai ni l'un ni l'autre dans l'environnement de test (Chromium sous Linux). Risque connu en général : certains systèmes réservent Ctrl+Espace (bascule de méthode de saisie) ; le code appelle `preventDefault`, ce qui ne suffit pas si le système intercepte avant le navigateur. À tester par le porteur du projet sur sa machine. Le bouton est le repli.
- (c) **Preuve par test** (`tests/ui/progress.js`) : après saisie manuelle d'un mot de passe, ni l'export JSON du profil ni le stockage navigateur ne le contiennent ; le profil est reconstruit champ par champ (liste blanche, `src/engine/80-game.js`). Neutralisation : le même contrôle détecte un profil qui garderait la saisie.

### D-97 — balayage terminal
1. **Couverture exhaustive : ajoutée.** Toute variante dont la correction touche un équipement IOS ou un serveur Linux doit être balayée **ou exemptée avec sa raison**, sinon le balayage échoue. Résultat : **Cisco 72 balayées / 73 touchées (1 exemptée : `phys_patch`, geste physique)** ; **Linux 85 / 87 (2 exemptées)**.
2. **Deux écarts de contenu révélés** (jusque-là ignorés en silence) : **`lx_nginx` variante 2 (certificat expiré)** — la correction du moteur est une date modifiée dans le modèle, **aucune commande de renouvellement n'est émulée** (ni `certbot` ni `openssl`) : la variante est **tirée** mais **non réparable au terminal** ; **`multi_vitrine`** — panne composée mixte, partie pfSense GUI. Statut proposé : « livrée, non terminée ».
3. **Réparations écrites à la main : 4, pas 3** (`c_portsec#0`, `c_portsec_imp#0`, `c_ssh#0`, `c_ssh_auth#0`) côté IOS ; Linux : traduction par type d'étape, pas de table par panne (`docs/JOURNAL-CODE.md` §4).
4. **Familles Cisco couvertes** : OSPF une area **et** multi-area, EtherChannel, STP : **oui, toutes**.
5. **Neutralisations** (`tests/sweep-coverage.js`) : retirer une panne du balayage → « non couverte », code ≠ 0 ; casser une recette → échec, code ≠ 0. Pour IOS et Linux.

### D-98 — balayage graphique
1. **`docs/BALAYAGE-GRAPHIQUE.md` : écrit, autonome, avec les chiffres.**
2. **Dette mesurée : 0 étape sans recette** dans les familles balayées. **Le balayage ne couvre pas pfSense** : sur les pannes dont la réparation est graphique (interface web pfSense) — `pf` 10 et `vpn` 4 : parcours dédiés **14/14** (`tests/ui/pfw2.js`) ; `snort` **8/8** (`tests/ui/snort-faults.js`) ; **`px` (proxy) : 4 sur 21 seulement** (`tests/ui/proxy-faults.js`). **17 pannes proxy ne sont pas prouvées réparables par l'interface**, alors que `docs/PANNES-PROXY.md` l'affirme. C'est la plus grosse dette de la règle A.
3. **Le second écart de contenu n'existe pas.** « 2 écarts » = **deux graines (11 et 101) de la même variante « canal »**. Corrigé dans `LIMITES.md`. (Les 2 écarts de D-97 ci-dessus sont d'une autre nature : terminal.)
4. **Playwright est une dépendance de développement** : démonstration dans `docs/JOURNAL-CODE.md` §5. **Ce dépôt n'a pas de `build-single.mjs` ; la garde équivalente n'existait pas — elle est ajoutée** dans `build.js` (code de sortie 3 si le livrable référence une ressource externe) avec `tests/build-guard.js` (neutralisation : feuille de style distante ajoutée → échec).
5. **Neutralisation** : `tests/ui/gui-sweep-neutral.js` (recette non jouée → balayage rouge).

### D-99 — commandes réelles non émulées
1. **Inventaire livré** : `docs/INVENTAIRE-COMMANDES.md`, généré par `tests/inventory-commands.js`. **428 commandes essayées** (cmd 49, PowerShell 64, Linux 86, SQL 27, IOS 66 × 2 appareils + 70 de configuration) : 248 ok, **160 « introuvable » à tort ou à vérifier**, 13 déjà « non gérée », 7 acceptées sans effet.
2. **Réserve importante** (écrite dans le document) : tous les « introuvable » ne sont pas des violations. Une commande d'un paquet non installé répond authentiquement `command not found` sous Linux (le projet note déjà `netstat`, `ifconfig`, `traceroute`) ; un routeur sans `spanning-tree` ou un commutateur L2 sans OSPF répond authentiquement `% Invalid input`. **La liste des paquets présents par défaut sur la cible Debian 13 et la plateforme IOS simulée ne sont pas établies** → classement « réelle / inexistante / absente de la plateforme » impossible sans source : **non établi** pour Linux et IOS. Windows (`nbtstat`, `schtasks`, `wevtutil`…) est plus net.
3. **Exhaustivité : non établie.** Aucune liste de référence de « toutes les commandes réelles » n'existe dans le projet. Ma liste est d'usage courant. Il faut une source (aide-mémoire, TP du cours, documentation éditeur).
4. **12 vs 13** : `tests/audit-win-cli.js` compte **12 applets + `netdom` (exécutable) = 13 « signalées »**. `LIMITES.md` ajoutait `New-GPLink`, qui n'est pas dans l'audit (il est signalé dans PowerShell, pas dans `cmd` — la bonne réponse dans `cmd`). `LIMITES.md` est corrigé.
5. **Non fait** : le remplacement lui-même (« non gérée » pour les 160, avis « acceptée, sans effet » pour les 7), les tests par commande, `show etherchannel` seul. Voir §8, question 2.

### D-100 — statut et routine
Statut « livrée, non terminée » utilisé : `docs/JOURNAL-CODE.md` §1 (4 entrées). **Les « dix contrôles » : voir §7.**

### D-101 — les huit correctifs, conditions
| # | Condition | Réponse |
|---|---|---|
| 1 | UAC : sur quelles machines ? | Les **17 appareils Windows** du modèle portent un compte local `Administrateur` et `tech`, **deux contrôleurs de domaine compris**. **Un DC réel n'a pas de base de comptes locaux** : le modèle contredit la réalité (défaut préexistant à la correction). Comportement exact de `.\nom` sur un DC : **non établi**, clé `uac-local-admin` créée. Test : exercé par le balayage graphique (UAC sur plusieurs machines) ; **pas de test dédié, pas de neutralisation** — à faire quand la règle pour les DC est tranchée. |
| 3 | Bouclage | Comparaison avant / après sur **371 variantes** (sondes après injection **et** statut après correction) : **0 différence**. Le correctif n'a changé aucune sonde du catalogue ; il n'agit que sur le trafic d'un hôte vers ses propres adresses (observations interactives). Battery / Chaos 4 : voir §7. |
| 4 | GPMC après suppression du GPO affiché | La console revient à la liste des GPO (ou au conteneur parent). **Non sourcé** : clé `gpmc-after-delete`. |
| 5 | « Utilisateurs authentifiés » : Lecture vs Appliquer | **N'était pas distingué dans le modèle** (donner « Appliquer » à tous était jugé « corrigé »). **Corrigé** : nouvel opérateur de racine `hasNot` ; `gpo_ms16072` : « Appliquer » donné à « Utilisateurs authentifiés » ou « Tout le monde » = **contournement** (fausse résolution, D-12). Lecture seule (délégation) = corrigé. Test + neutralisation (`tests/regress.js`). Le chemin « Ordinateurs du domaine » reste valide. |
| 6 | `gpo_link` : « contournement » dérivé du modèle | Racine = « le lien existe et est actif » (modèle). **Recréer le lien** (ordre « dernier ») est maintenant un chemin de résolution **déclaré** (`fixes['lien-recree']`) vérifié par `tests/faults.js` ; test + neutralisation (racine « objet lien entier » → contournement) dans `tests/regress.js`. La pénalité de −12 ne s'applique pas (statut « fixed »). |
| 7 | `sec-principals-prefix` | Reste « à vérifier » (R-73). |
| 8 | Explorateur dérivé du modèle | **N'était pas dérivé pour `Policies`** (dossiers standard seulement). **Corrigé** : un dossier `{GUID}` par GPO, créé / retiré avec le GPO (`tests/regress.js`, neutralisation). **GUID** : celui de « Default Domain Policy » est le GUID connu `{31B2F340-016D-11D2-945F-00C04FB984F9}` ; les autres sont **dérivés de l'identifiant interne** (un GUID réel est aléatoire : toute valeur valide convient). Le contenu d'un dossier (`GPT.INI`, `Machine`, `User`) n'est **pas modélisé** ; tout fichier autre que `ntds.dit` dans NTDS : « à vérifier ». Casse d'affichage : R-74. Clé `sysvol-policies-folders`. |
| 2 | Case DHCP par libellé | « à vérifier » jusqu'à R-71 : clé `dhcp-option-label-click` créée. |

### Partie 4 — réponses de fond
1. **D-74** : `reachIp` **n'existe pas** dans le code. Le chemin est parcouru **saut par saut** (`N.trace` / `N.walk`, `src/engine/20-net.js`) avec les routes calculées par le moteur OSPF (**SPF Dijkstra par zone, chemins à coût égal**, `src/engine/41-ospf.js`, livré le 27/10). La redondance de l'anneau **n'est pas écrite à la main** : dans `ospf_timers`, le ping masqué reste vert parce que l'anneau offre un autre chemin, calculé. Couverture : `tests/faults.js` (toutes les variantes), `tests/ios-fixes.js`, `tests/cli-sweep-ios.js`.
2. **D-87 — sonde par famille OSPF** (relevé sur chaque variante injectée) :
| Panne | Sondes qui basculent | Sonde masquée par l'anneau |
|---|---|---|
| `ospf_lan_network` (6 var.) | `ping` PC↔PC (p1) et retour (p2) | aucune |
| `ospf_default_route` (4 var.) | 3 pings vers 8.8.8.8 | aucune |
| `ospf_timers` (3 var.) | `ospfnbr` (voisinage) | **le ping (p2) reste vert** |
| `ospf_routerid_dup` (2 var.) | `ospfnbr` | — |
| `ospf_area_mismatch` (3 var.) | 3 pings | aucune |
   Parcours par l'interface (D-66, un par type de sonde) : **non établi** pour OSPF — aucun test `tests/ui/` ne cite OSPF ; couverture par terminal (`cli-sweep-ios`, 18 combinaisons) seulement. **Dette à instruire.**
3. **D-79 / D-40 — ce que fait le code** (`Game.*`, `src/engine/80-game.js`) : indice 8 / 15 / 25 (gratuits en guidé) ; **action dangereuse −15 chacune, plafond −50** ; **action à impact −4, plafond −20** ; **clôture prématurée −5** ; **clôture sur un contournement −12** ; temps jusqu'à −25 ; non résolu : plafonné à 60 (temps écoulé) ou 40 (abandon) × part des causes réparées. **« −5 par tentative bloquée » et « −15 par élément laissé hors service » n'existent pas** dans le code : le −5 est la clôture prématurée, et un élément non réparé joue par la part réparée du plafond. **« Action à impact »** = action marquée par l'interface ou le terminal d'un tag (`svc-stop`, `nic-down`, `poweroff`, `reboot`) : arrêt d'un service, coupure d'une carte, extinction d'un équipement de production, redémarrage — sauf si la panne exige un redémarrage. **La catégorie `hors-sujet` de D-40 n'existe pas dans le code** ; les classes sont `diagnostic / progress / regress / detour`, jamais pénalisées. **Défaut trouvé et corrigé** : aucune panne ne portait l'indicateur `needsReboot`, donc le redémarrage **qui fait partie de la correction** de `lx_fstab` coûtait −4 ; corrigé, test + neutralisation (`tests/game.js`). **Contradiction à trancher par le projet** : les montants de D-40/D-79 tels que rapportés dans la consigne ne correspondent pas au code.
4. **D-89 — état des lieux** : **179 pannes de base**, niveaux 1 / 2 / 3 / 4 = **22 / 66 / 69 / 22** (légende : 1 = Junior, 2 = Confirmé, 3 = Admin-niveau panne, 4 = Cyber-niveau panne ; Admin = 2 pannes, Cyber = 3, Chaos = 4 assemblées). Répartition **par préfixe d'identifiant** (indicatif, pas par OS) : Windows / AD / GPO / DHCP / DNS / IIS / partages / réseau poste (`ad` 15, `dhcp` 14, `gpo` 8, `dns` 7, `web` 7, `fw` 6, `sh` 5, `ipv4` 4, `iis` 2, `nic` 1) = 69 ; physique `phys` 7 ; composées `multi` 5 ; Linux `lx` 25 ; Cisco (`c` 18, `ospf` 5, `ec` 5, `stp` 2) = 30 ; pfSense (`pf` 10, `snort` 8, `vpn` 4) = 22 ; proxy `px` 21. **La décision de `DECISIONS.md` qui autorise chaque panne** : **non établi** — le code ne porte pas ce lien ; il faudrait le tableau du projet.
5. **Compétences** : **50** au référentiel, toutes couvertes par ≥1 panne (`tests/lint-content.js`) ; statut 42 « vert » et 8 « jaune » ; **une seule « limite » : `switch-secu`** (dérogation D-86).

### Partie 5 — documents
- `LIMITES.md` : les lignes périmées sont corrigées (captures de référence, hors-fiche, Labège, paliers et pénalités, plan d'adressage, « 2 écarts », 12/13 applets). La date « 28/10 » du fichier OSPF : à corriger **côté projet** si le fichier source est chez lui ; dans `DECISIONS-PROPOSEES.md` les sections OSPF restent datées 28/10 (jour où je les ai écrites) — **le fichier a été relu par le projet le 27/10 : contradiction signalée, non résolue** (je ne sais pas de quel fichier il s'agit).
- **État du build** : `node build.js` écrit désormais `docs/ETAT-DU-BUILD.md` (taille en octets, sha256, nombre de fichiers, pannes, compétences, variantes retirées). Valeur courante : voir ce fichier (dernière construction : 2 566 442 octets, 179 pannes).

---

## 4. Ce que je n'ai **pas** fait

1. **Audit des codes d'erreur (règle B).** Relevé grossier par motifs (non exhaustif) : ~19 codes hexadécimaux `0x8…`, 6 `ERROR_*`, 6 messages HTTP, 15 messages IOS `%…`, ~10 Event ID (7036, 4624/4625, 4740, 4771, 1046, 1058, 1063, 1129, 1502). Plusieurs Event ID viennent de ma mémoire (1046, 1063, 1502 en particulier : **non vérifiés**). Plan : inventaire par exécution (instrumenter l'émission), vérification par recherche web des sources officielles, `docs/CODES-ERREUR.md`, masquage des non vérifiés (texte utile conservé), test d'audit.
2. **Application de gestion (partie 3).**
3. **Exports de configuration pour Cowork (partie 6).**
4. **Remplacement D-99** par « non gérée » et avis « acceptée, sans effet ».
5. **Parcours par l'interface** pour OSPF, `ec_group_missing`, `stp_root_moved` (dette signalée plus haut).

---

## 5. Écarts constatés entre la consigne et ce dépôt (à ne pas laisser passer)

1. **Les « dix contrôles » (`test, smoke, battery, parcours, audit, typecheck, cli-sweep-lx, cli-sweep-ios, audit-win-cli, gui-sweep-win`) n'existent pas sous ces noms ici.** Ce dépôt n'a **ni `package.json`, ni contrôle de types (`typecheck`), ni `build-single.mjs`, ni contrôle « 1886 »**. Le point d'entrée unique est `node tests/all.js` (construit, puis lance **100 tests** groupés : Moteur, Sécurité, Émulateurs, Réparation au terminal, Réparation graphique, Interface, Consoles Windows, Réseau, Baie / physique, pfSense, Singe). Quatre des dix noms existent tels quels (`cli-sweep-lx`, `cli-sweep-ios`, `audit-win-cli`, `gui-sweep-win`). Je **n'invente pas de correspondance** pour `typecheck`, `parcours`, `battery`, `smoke` (un `smoke-all` existe) : **dis-moi à quelle arborescence se rapporte la consigne**, ou donne la table de correspondance. Je liste dans `CLAUDE.md` ce qui existe vraiment.
2. **`JOURNAL-CODE.md` n'existait pas** : créé.
3. **L'arborescence du projet (`EDIVN-Simulateur.html`, 468 458 octets au 12/09) et ce dépôt (`EDIVN-Lab.html`, ~2,5 Mo) semblent être deux produits différents.** Si la consigne vise l'autre, mes réponses chiffrées ne s'y appliquent pas. À lever en premier.

---

## 6. Règle A (« GUI d'abord ») — conséquences que je propose

- **Critère d'entrée d'une panne** : chaque panne Windows / AD / GPO / DHCP / DNS / IIS / partages a, pour chaque variante, un parcours **graphique** prouvé (balayage). **Fait : 96 combinaisons sur 96.**
- **pfSense** : même critère. **Non rempli pour 17 pannes proxy sur 21** (§3, D-98).
- **Linux, SQL, Cisco** : le jeu n'a pas d'interface graphique pour eux ; le terminal est l'interface réelle (hypothèse écrite, à confirmer). Les balayages terminal sont la preuve.
- **Quand deux chemins existent**, le chemin graphique est le chemin « optimal » du scénario ; le terminal est un chemin valide, jamais pénalisé.
- **Coût** : tout nouveau scénario Windows / pfSense arrive avec ses recettes graphiques. Le balayage pfSense (les 17 pannes proxy et OSPF mis à part) est un chantier d'environ 1 à 2 journées.

---

## 7. Chiffres de la séance (rejeu)

À la date de cette réponse, **rejeu complet de `tests/all.js` en cours** ; les chiffres réels seront dans le message suivant et dans `PASSATION.md`. Déjà mesurés sur cette séance : `cli-sweep-ios` **72/72**, `cli-sweep-lx` **85/85**, `gui-sweep-win` **96/96** (0 à reprendre, 0 écart connu), `tests/game.js`, `tests/validate.js`, `tests/regress.js`, `tests/cmdhelp.js` (551 assertions) verts. Dernière construction : **2 566 442 octets**.

---

## 8. Questions (nouvelles ou rouvertes)

1. **Règle A et application de gestion** : les trois causes sont Linux / SQL, donc en ligne de commande par nature. Tu confirmes que la règle « GUI d'abord » s'entend « interface la plus graphique **disponible** » pour Linux / SQL / Cisco ?
2. **D-99** : pour décider « réelle / inexistante / absente de la plateforme », il me faut deux sources — **(a)** la liste des paquets installés par défaut sur la Debian 13 cible (ou la décision : « installation minimale + paquets du TP »), **(b)** la plateforme IOS visée par chaque appareil (2911, commutateur de la fiche). Sans elles, je ne corrige que Windows et laisse Linux / IOS en « non établi ». OK ?
3. **Comptes locaux sur un contrôleur de domaine** : le modèle en porte (`Administrateur`, `tech`). Je les retire des DC (ouverture de session et UAC) ou je laisse jusqu'à une capture ?
4. **D-93** : ajouter `ec_member_mismatch` à la liste des pannes silencieuses ?
5. **Proxy** : 17 pannes `px_*` non prouvées par l'interface. Je les passe au balayage graphique pfSense maintenant (1 à 2 jours) ou après l'application de gestion ?
6. **`lx_nginx` « certificat expiré »** : émuler `openssl x509 -dates` et `certbot renew`, ou retirer la variante du tirage en attendant (comme « canal ») ?
7. **Les « dix contrôles »** : à quelle arborescence se rapporte la consigne ? (§5)

---

## 9. Prochaine étape recommandée et points de décision

**Prochaine étape recommandée** : (1) rejouer la batterie complète et verser les chiffres dans `PASSATION.md` ; (2) audit des codes d'erreur (règle B) avant toute nouvelle livraison, parce qu'elle conditionne le texte de l'application de gestion ; (3) application de gestion (partie 3, débloquée) ; (4) exports pour Cowork ; (5) remplacement D-99 pour Windows. **Je ne commence pas la partie 1 B (attente R-75) ni HSRP** (conditions de la consigne : réponse sur D-74 — donnée —, choix du 28/10 non encore actés).

**Points de décision qui attendent** :
- **Projet** : acter A, B, C, D (§1) ; trancher la contradiction des montants D-40/D-79 (§3) ; dire à quelle arborescence se rapporte la consigne (§5) ; statut « livrée, non terminée » pour `lx_nginx` (certificat) et `multi_vitrine`.
- **Porteur du projet** : questions 1 à 6 du §8 ; test de Ctrl + Espace sous Windows et macOS (D-96) ; captures R-71, R-73, R-74, R-75 (bloquent la variante « canal » B/A et lèvent les clés « à vérifier »).
