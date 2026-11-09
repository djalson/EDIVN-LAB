# Balayage graphique des consoles Windows (29/10/2026, 2e séance)

*Document autonome, à verser au projet. Rédigé par Claude Code ; il ne décide rien (voir `DECISIONS.md`). Remplace la section du même nom de `DECISIONS-PROPOSEES.md` (les chiffres ci-dessous sont ceux du dernier passage).*

## 1. Ce que c'est

`tests/ui/gui-sweep-win.js` (recettes dans `tests/ui/gui-recipes-win.js`), Playwright, enregistré dans `tests/all.js`.
Pour chaque panne des familles `ad_ dhcp_ dns_ fw_ gpo_ iis_ ipv4_ nic_ sh_ web_` et chaque variante distincte de correction, **chaque étape de correction déclarée est rejouée par clics et saisies** dans la vraie console du bureau simulé : Services, Connexions réseau, DHCP, DNS, pare-feu, Gestionnaire IIS, Certificats, Utilisateurs et ordinateurs AD, GPMC et son éditeur, Domaines et approbations, Explorateur › Propriétés › Partage avancé / Sécurité, Date et heure, invite de commandes. La sonde de la panne doit ensuite repasser au vert (état « corrigé »).

## 2. Résultat du dernier passage (29/10/2026)

```
96 combinaisons graphiques, 96 réparées par les consoles, 0 à reprendre, 0 écart(s) de contenu connu(s)
4 étape(s) sur équipement non Windows appliquée(s) par le moteur (réparation au terminal : cli-sweep-ios / cli-sweep-lx)
aucune erreur de page
```

- **96 / 96.** Les 98 combinaisons du premier passage étaient 96 + 2 graines (11 et 101) de **la même** variante « canal » de `ad_secure_channel`. Elle est depuis **retirée du tirage** (D-102, `SIM.RETIRED_VARIANTS`), d'où 96. **Il n'y avait qu'un seul écart de contenu, pas deux** (la mention « 2 écarts » de `LIMITES.md` est corrigée).
- Les étapes « client » (renouveler le bail, vider le cache DNS, rouvrir la session, attendre) sont appliquées par le moteur : elles représentent un geste du joueur déjà couvert par les balayages terminal.
- **4 étapes** visent un équipement sans console Windows (routeur, commutateur, imprimante) : appliquées par le moteur ; la réparation au terminal est prouvée par `cli-sweep-ios` / `cli-sweep-lx`.
- **Dette mesurée : 0 étape sans recette** dans les familles balayées.

## 3. Ce que le balayage ne couvre pas (à lire avant de conclure « tout est réparable par l'interface »)

- **pfSense** (interface web) : pas dans ce balayage. Parcours dédiés : `pf` 10 et `vpn` 4 → 14/14 (`tests/ui/pfw2.js`) ; `snort` 8/8 (`tests/ui/snort-faults.js`) ; **`px` (proxy) : 4 pannes sur 21 seulement** (`tests/ui/proxy-faults.js`). **17 pannes proxy ne sont pas prouvées réparables par l'interface.**
- **OSPF, `ec_group_missing`, `stp_root_moved`** : pas de parcours par l'interface, couverture par le terminal seulement.
- **Linux, SQL, Cisco** : pas d'interface graphique dans le jeu ; le terminal est l'interface (balayages `cli-sweep-lx` 85/85, `cli-sweep-ios` 72/72).
- Le commentaire et l'option d'énumération basée sur l'accès d'un partage ne sont pas dans l'interface simulée : l'étape qui les porte est jouée sans eux (la sonde ne les teste pas).

## 4. Défauts réels trouvés par le balayage et corrigés

| # | Défaut | Correction | Test / neutralisation |
|---|---|---|---|
| 1 | UAC : le compte administrateur local d'un poste du domaine était refusé | Même résolution que l'ouverture de session. **Réserve** : le modèle porte aussi des comptes locaux sur les contrôleurs de domaine, ce qu'un vrai DC n'a pas (clé `uac-local-admin`, à vérifier) | Exercé par le balayage ; pas de test dédié |
| 2 | DHCP : cliquer le libellé d'une option la cochait | Libellé = sélection, case = activation (clé `dhcp-option-label-click`, à vérifier) | Balayage |
| 3 | Un hôte dont le pare-feu bloque le port 53 bloquait ses propres requêtes vers lui-même | Le bouclage n'est jamais filtré par le pare-feu de l'hôte. Comparaison avant / après sur 371 variantes : 0 différence de sonde ou de statut | Balayage + comparaison |
| 4 | GPMC : plantage quand on supprime le GPO affiché | Retour à la liste / au conteneur (clé `gpmc-after-delete`, à vérifier) | Balayage |
| 5 | GPMC : « Utilisateurs authentifiés » refusé dans le sélecteur ; et le modèle ne distinguait pas Lecture / Appliquer | Identités spéciales acceptées ; racine `hasNot` : « Appliquer » donné à tous = contournement, Lecture seule = corrigé | `tests/regress.js` test 3 + neutralisation |
| 6 | `gpo_link` : un lien recréé était jugé « contournement » | Racine = le lien existe et est actif ; chemin déclaré `fixes['lien-recree']` | `tests/regress.js` test 4 + neutralisation |
| 7 | Boîte de sélection de principaux : `BUILTIN\…` / `NT AUTHORITY\…` refusés | Préfixes acceptés (clé `sec-principals-prefix`, à vérifier, R-73) | Balayage |
| 8 | Dossiers d'un contrôleur de domaine absents de l'Explorateur | `NTDS`, `SYSVOL\sysvol\<domaine>\Policies` (un dossier `{GUID}` par GPO, dérivé du modèle) et `\scripts` ; contenu des dossiers non modélisé (clé `sysvol-policies-folders`) | `tests/regress.js` test 5 + neutralisation |

## 5. Neutralisation du balayage lui-même

`tests/ui/gui-sweep-neutral.js` : une recette non jouée fait virer le balayage au rouge (`GS_BREAK`). Sans cela, un balayage qui « passe » ne prouverait rien.

## 6. Coûts et limites

- Les recettes dépendent du DOM (libellés, classes) : un changement de libellé d'une console casse le balayage. C'est voulu (il signale une dérive) mais coûte une retouche de recette à chaque évolution d'interface.
- Durée : environ 8 minutes.
- Playwright est une dépendance de **développement** (jamais dans le livrable ; `build.js` s'arrête avec le code 3 si le livrable référence une ressource externe, `tests/build-guard.js`). Les tests d'interface se lancent avec `NODE_PATH=$(npm root -g)` et exigent un navigateur Chromium installé.
- Nombre d'étapes par famille : **non relevé dans ce passage** (le balayage affiche les combinaisons, pas un total d'étapes) ; je ne le chiffre pas.
