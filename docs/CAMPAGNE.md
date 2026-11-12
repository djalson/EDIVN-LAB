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
| 11 | Astreinte | (tout) | 4 | 3 |

Total : 186 pannes jouables (187 au catalogue, dont `multi_vitrine` retirée du tirage : voir plus bas), 55 tickets à valider et 11 examens pour terminer la campagne.

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

## Récompenses de niveau

Code : `src/engine/85-rewards.js` (sans DOM), `src/ui/96-rewards.js`, `src/css/41-rewards.css`. Tests : `tests/rewards.js`, `tests/ui/rewards.js`.

L'arbre de compétences s'achète avec des points et se vide vers le niveau 18. La piste des récompenses donne quelque chose à chaque palier jusqu'au niveau 40, sans rien acheter. Elle se consulte dans Carrière → Récompenses.

| Niveau | Récompense |
|---|---|
| 2 | Couleurs de terminal « Phosphore vert » |
| 3 | Fond d'écran « Circuit imprimé » |
| 4 | Contrat « Sans aide-mémoire » (XP × 1,1) |
| 5 | Outil : voyants de liaison sur la carte |
| 6 | Habillage de carte « Plan d'architecte » |
| 7 | Second avis : un indice gratuit par jour |
| 8 | Contrat « Ticket vague » (XP × 1,15) |
| 9 | Couleurs de terminal « Solarisé sombre » |
| 10 | Astreinte : incident double |
| 11 | Fond d'écran « Aurore » |
| 12 | Outil : ping rapide depuis la carte |
| 13 | Contrat « Temps réduit » (XP × 1,2) |
| 14 | Habillage de carte « Schéma technique » |
| 15 | Couleurs de terminal « Nuit violette » |
| 16 | Contrat « Sans plan » (XP × 1,2) |
| 17 | Outil : historique des commandes entre tickets |
| 18 | Fond d'écran « Crépuscule » |
| 20 | Astreinte : incident critique |
| 22 | Habillage de carte « Nuit » |
| 24 | Couleurs de terminal « Papier clair » |
| 26 | Fond d'écran « Grille rétro » |
| 30 | Astreinte : nuit noire ; thème « Or noir » |
| 35 | Fond d'écran « Sommet » |
| 40 | Thème « Boréal » ; prestige |

Insignes de profil (et tampon de la fiche d'intervention) : liés aux chapitres terminés, pas au niveau. Bronze au chapitre 3, argent au 6, or au 10, astreinte au 11.

### Règles d'équité

- **Contrats** : ne changent que l'XP d'un ticket validé, jamais la note. Indisponibles en mode accompagné, en examen et dans le tutoriel.
- **Outils et second avis** : coupés en évaluation chronométrée et en examen de chapitre (`RW.fair`), comme le coffre-fort.
- **Ping rapide** : diagnostic seulement. Il est journalisé mais n'observe rien : il ne peut pas clore un ticket.
- **Historique entre tickets** : seulement les lignes tapées dans un interpréteur (cmd, bash, IOS, pfSense, MariaDB). Jamais un écran d'ouverture de session ni une réponse à une invite de mot de passe.
- **Cosmétiques** : les fonds d'écran, les couleurs de terminal et la carte ne changent ni le contenu ni le comportement des consoles.
- **Astreinte** : les incidents à 2, 3 et 4 pannes s'ouvrent aux niveaux 10, 20 et 30. Le bac à sable reste entièrement ouvert.

### Prestige

Au niveau 40, le joueur peut repartir du niveau 1. La campagne, les succès, les maîtrises et toutes les récompenses de niveau restent acquis ; l'arbre est rendu et se regagne en remontant. Il gagne une étoile et le contrat « Tout ou rien » (90 ou plus : XP × 1,5 ; en dessous : aucune XP).

### Ajouter une récompense

Une ligne dans `RW.CONTRACTS`, `RW.COS`, `TOOLS` ou `DUTY` : la piste (`RW.TRACK`) se construit seule. `tests/rewards.js` vérifie qu'il n'y a jamais plus de 5 niveaux sans récompense.

## Pannes proxy et panne retirée (10/11/2026)

- `tests/ui/proxy-sweep.js` répare les 17 pannes proxy, toutes variantes comprises (37), par clics et saisies dans l'interface web de pfSense (Squid, squidGuard, gestionnaire de paquets, services, résolveur DNS, règles LAN) et dans les Options Internet de PC-02. Elles ne sont donc plus écartées de l'évaluation chronométrée ni des examens.
- La même vérification a établi que `multi_vitrine` n'est pas réparable par un joueur : une de ses trois causes est un certificat expiré et aucune commande de renouvellement n'est émulée. Elle est retirée de tous les tirages (`src/content/09-unproven.js`), campagne comprise. Un formateur peut encore la choisir explicitement.

## Ajouts du 12-13/11/2026

Tous ces ajouts sont **opt-in côté moteur** : une mission créée sans option se comporte comme avant (tests du moteur et mode `#legacy` inchangés). L'interface V3 les active.

| Ajout | Fichiers | Option de `Game.create` | Tests |
|---|---|---|---|
| Clôture prouvée par le test qui échouait (un écran affiché ne prouve rien) | `src/engine/70-fault.js` (`F.VERIFY_BY_PROBE`) | — | `tests/invariants.js`, `tests/ui/verify-strict.js` |
| Panne de connexion : l'utilisateur est devant l'écran de connexion | `src/engine/80-game.js` | — | `tests/invariants.js` |
| Calendrier : un jour ouvré de plus par ticket, heure de bureau (nuit en astreinte lourde) | `src/engine/78-calendar.js` | `calendar` | `tests/calendar.js` |
| Événements en partie (1 ticket sur 4) : rappel, deuxième ticket, collègue, panne bête au téléphone (QCM), échéance du responsable | `src/engine/87-events.js`, `src/ui/98c-events.js` | `events`, `eventType` | `tests/events.js`, `tests/ui/events.js` |
| Personnalités : le ton du ticket dépend de son auteur, jamais le fond | `src/content/32-personas.js` | `personas` | `tests/personas-text.js` |
| Défi entre élèves, panne mystère (1 essai par jour, XP ×2) | `src/ui/98d-challenge.js` | `shared`, `challenge`, `mystery` | `tests/ui/challenge.js` |
| Ticket interrompu (F5) : reprise proposée, chronomètre conservé | `src/ui/99-resume.js` | — | `tests/ui/resume.js` |
| Bouton « Bug ? » : rapport copiable, décodable par `node tests/bug-decode.js` | `src/ui/98-bugreport.js` | — | `tests/ui/bugreport.js` |

Règles des événements : la panne ajoutée est **obligatoire** pour clôturer et rallonge le temps cible de 5 min ; elle est validée par simulation contre le ticket en cours avant d'être retenue. L'échéance du responsable manquée coûte 5 points. Jamais d'événement en évaluation chronométrée, en examen, pendant le tutoriel, ni pendant les trois premiers tickets d'un profil.

Batterie : `node tests/all.js --jobs=2` lance deux tests à la fois et rejoue seul tout test qui échoue sous charge.
