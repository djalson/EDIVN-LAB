# Campagne, infra progressive et fiche d'intervention (V3)

Code : `src/engine/83-campaign.js` (campagne, sans DOM), `src/engine/84-report.js` (fiche, sans DOM), `src/content/31-chapters.js` (les chapitres), `src/ui/95-campaign.js` + `src/css/40-campaign.css` (interface). Tests : `tests/campaign.js`, `tests/report.js`, `tests/ui/campaign.js`.

## Principe

Le monde simulé n'est jamais modifié par la campagne. Deux choses seulement changent :

- **ce que la carte montre** : le périmètre du chapitre (équipements et sites) ;
- **ce que le tirage propose** : les pannes du chapitre.

Le bac à sable est donc strictement le jeu d'origine, et tous les tests antérieurs restent valables.

## Les trois entrées de l'accueil

| Entrée | Contenu |
|---|---|
| **Campagne** | 11 chapitres. Carte limitée au périmètre, tirage dans le chapitre, examen pour ouvrir le suivant. |
| **Astreinte** | Ticket du jour et incidents à 2, 3 ou 4 pannes tirés dans toute l'infrastructure. |
| **Bac à sable** | Le jeu d'origine : 5 niveaux, 3 modes, options formateur, toute l'infrastructure visible. Ne fait pas avancer la campagne. |

## Les chapitres

| # | Chapitre | Équipements ajoutés au périmètre | Pannes | À valider |
|---|---|---|---|---|
| 1 | Le bureau | PC-01, PC-02, PC-ADM, baie de brassage, IMP-T1, SW-T2, SW-T3 | 14 | 5 |
| 2 | Le premier serveur | SRV-DC1, SW-T1 | 23 | 6 |
| 3 | Fichiers, web et stratégies | SRV-FIC | 32 | 6 |
| 4 | Le réseau commuté | (aucun : consoles des commutateurs) | 15 | 5 |
| 5 | Linux entre en scène | SRV-LNX | 22 | 6 |
| 6 | Le périmètre | ISP, pfsense-tls, SW-DMZ, SRV-WEB, PCEXT | 14 | 6 |
| 7 | Filtrer et surveiller | (aucun : Squid et Snort sur le pare-feu) | 29 | 6 |
| 8 | Deuxième site : Bordeaux | pfsense-bdx, R-B1, SW-B1, SRV-DC2, PC-B1 | 12 | 4 |
| 9 | Le labo de Ramonville | R-RV1, SW-RVA, SW-RVB, SRV-RV, PC-RV1, PC-RV2 | 9 | 4 |
| 10 | Haute disponibilité | Labège (anneau OSPF) et Colomiers (EtherChannel, STP) | 12 | 4 |
| 11 | Astreinte | (tout) | 5 | 3 |

Total : 187 pannes, 55 tickets à valider et 11 examens pour terminer la campagne.

### Rattachement d'une panne à un chapitre (calculé, jamais écrit à la main)

`C.faultChapter(def)` : le plus petit chapitre dont le périmètre contient tous les équipements d'**une** variante de la panne, relevé par le chapitre minimal de ses compétences (`SIM.CHAPTER_RULES.skills`) et par les règles de préfixe (`multi_` → chapitre 11). **Ajouter une panne au catalogue ne demande rien** : elle tombe dans son chapitre. `tests/campaign.js` vérifie que chaque panne a un chapitre et une variante jouable dans son périmètre.

Une panne à variantes peut viser un serveur qui n'est pas encore au programme : `C.seedInScope` dérive la graine jusqu'à tomber sur une variante du périmètre.

### Avancer

- Un ticket est **validé** à 75 / 100 ou plus (mode accompagné ou autonome).
- Quand le nombre de tickets validés atteint l'objectif, l'**examen** s'ouvre : chronométré, sans indice. Chapitre 1 : une panne parmi les plus difficiles. Chapitres 2 à 10 : deux pannes de natures différentes prises dans tout le périmètre connu, dont une au moins du chapitre. Chapitre 11 : trois pannes.
- Examen réussi (75 ou plus) : le chapitre suivant s'ouvre, +150 XP la première fois.
- Rien n'est stocké qui puisse se déduire : le chapitre atteint se lit sur les examens réussis à la suite.

### Tirage du prochain ticket

1. une panne **à revoir** arrivée à échéance ;
2. sinon une panne pas encore validée, les plus simples d'abord, les moins jouées d'abord ;
3. sinon la moins bien réussie.

### Révision espacée

Une panne ratée, abandonnée, ou réparée sans avoir identifié la cause racine (fiche) est mise en révision : elle revient **deux tickets plus tard**. Réussie et comprise, elle sort de la liste. Vaut aussi pour le bac à sable.

## Fiche d'intervention

Après un ticket **résolu**, avant le débrief, le joueur remplit la fiche. Chrono arrêté.

- Ticket à une panne : **cause racine** et **correction durable**. Ticket à plusieurs pannes : une question de cause par panne.
- 4 propositions + « Je ne sais pas ». La bonne réponse est le champ `cause` (ou `solution`) de la panne jouée ; les autres sont ceux de pannes voisines (mêmes compétences, mêmes équipements, même chapitre), instanciées sur les mêmes machines.
- Pas de fiche pour un abandon ou un temps écoulé : le débrief donne la cause.

### Barème

Le jeu notait déjà la **manière** (indices, actions dangereuses, coupures inutiles, clôtures prématurées). La fiche note la **compréhension**.

| Cas | Effet |
|---|---|
| Cause mal identifiée | −10 par panne, plafond −20 |
| Correction mal identifiée | −5 |
| Mode accompagné (guidé) | aucun point retiré, fiche corrigée au débrief |
| Ticket validé | la fiche ne le fait **jamais** repasser sous 75 |
| Fiche entièrement juste | +15 XP ; condition du « Parfait » |
| Cause fausse | la panne part en révision et ne compte pas pour la maîtrise de la compétence |

## Critère de clôture

Chaque ticket affiche maintenant « Pour clôturer : … » : le texte déclaré par la panne (`verifyText`) ou, à défaut, le critère par défaut du moteur dit en clair (un test réussi depuis le poste du demandeur après la correction). `SIM.report.closeText`.

## Profils

Les profils d'avant la V3 ne sont pas repris : au premier lancement, le profil est remis à zéro (marqueur `edivn.gen = 3`).

## Mode d'origine pour les tests : `#legacy`

`dist/EDIVN-Lab.html#legacy` ouvre l'accueil sur le bac à sable, sans fiche d'intervention et sans remise à zéro du profil. Les tests d'interface antérieurs à la campagne tournent ainsi, inchangés. `tests/ui/campaign.js` teste le jeu sans ce marqueur.

## Ajouter un chapitre

1. Une entrée dans `SIM.CHAPTERS` (`src/content/31-chapters.js`) : titre, récit, `devices`, `sites`, `need`.
2. Si besoin, le chapitre minimal des nouvelles compétences dans `SIM.CHAPTER_RULES.skills`.
3. `node tests/campaign.js` : contrôle que tout équipement du monde a un chapitre et que chaque chapitre a assez de pannes.
