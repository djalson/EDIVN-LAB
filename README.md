# EDIVN Lab — simulateur de pannes d'infrastructure (V3)

Jeu autonome (un seul fichier HTML, hors ligne) : `dist/EDIVN-Lab.html`. Ouvrir dans Chrome / Edge / Firefox.

## Trois façons de jouer
- **Campagne** (mise en avant) : 11 chapitres. Tu commences avec un étage de bureaux ; chaque examen réussi ajoute des équipements à ton périmètre, jusqu'à l'infrastructure complète (5 sites). Détail : `docs/CAMPAGNE.md`.
- **Astreinte** : ticket du jour et incidents à plusieurs pannes.
- **Bac à sable** : tout est ouvert, tu choisis niveau, mode et panne (c'est le jeu de la V2, inchangé).

Après chaque ticket résolu, une **fiche d'intervention** demande la cause racine et la correction durable : elle entre dans la note et décide des révisions.

## Jouer (bac à sable)
Au premier lancement, un **tutoriel de prise en main** (≈ 2 min, passable) propose de découvrir le ticket, la carte,
le bureau Windows, les indices et la clôture. Il se relance depuis l'accueil (« Revoir le tutoriel »).
1. Sur l'accueil (décor pixel-art de salle serveur, mascotte), choisir le niveau (Junior → Chaos) et le mode (guidé, libre, évaluation chronométrée). La graine est tirée au hasard (le formateur peut la fixer dans « Options formateur ») ; elle est rappelée au débrief avec « Rejouer cet incident ». La mascotte donne un conseil au clic ; 4 chats se cachent dans le décor. Le thème de l'interface se change depuis l'accueil (7 thèmes).
2. « Prendre le ticket » : un utilisateur décrit la panne comme dans la vraie vie (vague, parfois faux). **Admin = 2 pannes dans le même ticket, Cyber = 3, Chaos = 4** (tirées de tous les modules, natures différentes, parfois masquées entre elles).
3. Diagnostiquer et réparer **depuis les vraies interfaces** : bureau Windows (Server 2022 et postes clients : MMC, services, observateur
   d'événements, cmd, PowerShell, connexions réseau, pare-feu), consoles Debian (bash), Cisco IOS, interface web pfSense,
   OpenVPN GUI, PuTTY, Bureau à distance, **dos du poste (câbles, alimentation, écran, baie de brassage, imprimante)**.
4. « Clôturer le ticket » : débrief (note /100, MTTR, chemin suivi vs optimal, impasses, actions dangereuses, compétences, barème).
   **Note sur 100, validée à partir de 75** (sinon « À repasser ») : 1★ de 75 à 84, 2★ de 85 à 94, 3★ de 95 à 99, **100 = Parfait** (animation propre au thème). Départ 100, moins indices (−8 / −15 / −25, gratuits en guidé), actions dangereuses (−15), clôture prématurée (−5), contournement pris pour une résolution (−12) et durée au-delà du temps cible (jusqu'à −25, jamais en dessous de 75 pour une résolution propre). Le **temps cible est calculé par panne** (étapes du chemin optimal). Sous 75, abandon ou temps écoulé : le débrief propose les pages de cours correspondantes du site de formation (`docs/LIENS-COURS.md`).

La carte réseau est à onglets par site : **Toulouse (site principal)**, Bordeaux (site distant, DC2), Ramonville (labo Cisco avec matériel physique, voir `docs/LIMITES.md`), Extérieur. Chaque équipement s'ouvre sur son écran ;
les postes et serveurs ont aussi leur vue « poste physique ».

## Progression
Niveaux, XP, arbre de compétences, maîtrise par compétence, succès, série, **ticket du jour**, thèmes à débloquer, coffre-fort d'identifiants et carnet de bord : voir `docs/PROGRESSION.md`. Rien de ce qui se gagne ne change la note.

## Contenu
187 pannes de base réparties sur 4 niveaux (28 / 67 / 69 / 22) ; Junior et Confirmé = 1 panne, **Admin = 2 pannes, Cyber = 3, Chaos = 4** assemblées par le moteur (pannes de natures différentes, validées par simulation : 120 à 137 pannes combinables), dont 21 pannes proxy Squid/SquidGuard (`docs/PANNES-PROXY.md`) et des chaînes multi-causes scriptées de niveau 4, rattachées aux 50 compétences de la fiche
v21 (voir `docs/COUVERTURE-UI.md`). Les mêmes graines rejouent les mêmes incidents.

## Créer / modifier un scénario sans coder
Accueil → « Scénarios formateur » : télécharger un modèle JSON, le modifier, l'importer. Le moteur le valide en le jouant.
Format : `docs/FORMAT-SCENARIO.md`.

## Développer
```
npm run build ; npm run test:fast     # après chaque modification (quelques minutes)
npm test                              # batterie complète avant de livrer
node build.js                 # assemble src/ → dist/EDIVN-Lab.html et docs/A-VERIFIER.md
node tests/faults.js          # 187 pannes : sain → cassé → réparé → contournement
node tests/validate.js        # validation de scénarios
node tests/game.js; node tests/scoring.js; node tests/course-links.js; node tests/combo.js; node tests/boot.js; node tests/emu-*.js ...
node tests/ui/smoke-all.js    # 26 appareils × 3 pannes, toutes applications (Playwright)
node tests/gen-docs.js        # régénère docs/COUVERTURE-UI.md, PANNES-PROXY.md et LIENS-COURS.md
node tests/personas.js        # série d'essais par « apprenants » simulés → docs/PERSONAS-ESSAIS.md (--quick pour une version courte)
node tests/all.js             # BATTERIE COMPLÈTE (build + moteur + émulateurs + interface + singe) → docs/RAPPORT-TESTS.md
node tests/all.js --quick     # idem sans le test « singe »
```
Identifiants de jeu : `docs/` ne les liste pas ; ils sont dans « **Mots de passe de l'infra** » (accueil, ou bouton Identifiants en jeu ; chaque valeur se copie d'un clic) ; l'adressage attendu de chaque machine est dans « **Plan d'adressage** » (accueil, ou bouton Adressage en jeu) (comptes génériques `tssr`, `Administrateur`, `tech`).
Architecture : `src/engine` (moteur sans DOM) · `src/content` (monde + pannes + compétences) · `src/emu` (terminaux)
· `src/ui` + `src/css` (interfaces). Ajouter un scénario = ajouter une donnée ; ajouter une console = un fichier `src/ui`.
Lire `docs/PROGRESS.md` (état), `docs/LIMITES.md` (limites), `docs/A-VERIFIER.md` (détails non confirmés).
