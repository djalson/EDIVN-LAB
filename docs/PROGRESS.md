# EDIVN-LAB — journal de construction (état final de la livraison V2)

## Livré
- Moteur sans DOM : graphe de dépendances, propagation causale, horloge simulée, graine reproductible, détection
  de résolution / contournement / fausse résolution, assemblage multi-causes (niveau Chaos).
- Monde : Toulouse (pfSense, cœur L3, 2 commutateurs d'accès, DMZ, DC, fichiers/IIS, Debian, postes, imprimante),
  Bordeaux (pfSense, routeur ROAS, DC2, poste), Ramonville (maquette Cisco), Labège (maquette OSPF, zones 0 et 1), Colomiers (maquette EtherChannel / STP), Internet (client OpenVPN externe).
- 179 pannes (22 / 66 / 69 / 22 par niveau 1–4) + Chaos ; 30 reprises du contenu V1 (concept uniquement, aucun code),
  143 nouvelles, dont 8 pannes Snort (`docs/LIMITES.md`), 21 pannes proxy (Squid / SquidGuard, `docs/PANNES-PROXY.md`) et 5 chaînes N4 scriptées (`multi_*`). Chaque panne : ≥ 1 compétence de la fiche v19 (50 compétences), 3 indices, pièges, chemin optimal.
- Émulateurs : cmd, PowerShell (sous-ensemble), bash/Debian, Cisco IOS, SSH client/serveur.
- Interfaces : bureau Windows + MMC (DHCP, DNS, ADUC, GPMC, pare-feu avancé, IIS, certificats, services, journaux,
  gestionnaire de serveur, utilisateurs locaux), pfSense web, OpenVPN GUI, PuTTY, Bureau à distance, **vue physique**
  (câbles, prises murales, baie de brassage, alimentation, écran + OSD, imprimante LCD).
- Jeu : accueil « arcade » réinventé d'après l'esprit de la V1 (mascotte chat pixel-art, titre glitch, cartes à ombres franches, chats cachés ; sprites SVG originaux dans `src/ui/89-pixel.js`), tutoriel de prise en main proposé au premier lancement, 3 modes, ticket, indices payants, journal d'actions, débrief, profil, badges, export de trace.
- Scénarios formateur : import/export JSON validé par simulation (`docs/FORMAT-SCENARIO.md`).

## Tests
`node tests/all.js` lance toute la batterie (voir `docs/RAPPORT-TESTS.md`) : moteur (179/179 pannes, jeu, combos, monde, AD, SSH, web),
assertions sur le monde (identité des sites, adressage, joignabilité, DNS, terminaux Windows/Linux/IOS, absence de données personnelles),
régressions (imprimante en DHCP, modale au-dessus du bureau), émulateurs, interface Playwright (smoke 26 appareils, win1–11, net1–2,
rig1–4 + 7 pannes physiques réparées par le geste, pfw1–3 + 14 pannes pfSense/VPN réparées par l'interface, tutoriel, import de scénario)
et test « singe » reproductible (graines fixes, plusieurs tailles d'écran).

## Hors périmètre de cette livraison (reporté)
Zabbix, AWS, Docker, Veeam, WDS ; HA / HSRP (décision en attente) — OSPF, EtherChannel et Snort sont livrés (voir `docs/DECISIONS-PROPOSEES.md`). Les œufs de Pâques V1 sont réinventés (chats pixel cachés de l'accueil).

## Conventions
- Sorties non confirmées : `U.av(tag, texte)` / `SIM.AVREG[...]` → `docs/A-VERIFIER.md` (régénéré par `node build.js`).
- Symptômes jamais écrits en dur : ils découlent de l'état du monde.
- `docs/COUVERTURE-UI.md` est généré (`node tests/gen-docs.js`).

## Dernière itération (proxy, N4, personas)
- Proxy Squid/SquidGuard sur pfSense : 21 pannes, interface web fidèle (Squid : General / Local Cache / ACLs / Real Time ; SquidGuard : General / Common ACL / Blacklist / Log), sondes `squid`, client avec paramètres de proxy.
- 12 pannes ajoutées (`src/content/27-faults-extra.js`) : 2ᵉ panne pour `dhcp-auth`, `ad-trust`, `switch-secu`, `lx-acl`, `lx-reseau`, `nginx`, `bash` + 5 chaînes multi-causes N4.
- PowerShell : confirmations interactives (`Remove-SmbShare`, `Revoke-SmbShareAccess`, `Disable-NetAdapter`) ; `bash -n` détecte les erreurs de syntaxe d'un script.
- Série d'essais par personas (`tests/personas.js`, 4 648 parties, 0 anomalie, déterminisme 20/20) → `docs/PERSONAS-ESSAIS.md`.
- Correspondance cours/pannes : `docs/CORRESPONDANCE-COURS.md` (audit du Drive).

## Itération « note sur 100, combinaisons, thèmes » (octobre 2026)
- **Note sur 100**, validée à 75 (« À repasser » en dessous), 3 étoiles (75–84 / 85–94 / 95–99), 100 = Parfait avec animation propre au thème ; le temps seul ne fait jamais passer une résolution propre sous 75. Temps cible **par panne** (étapes du chemin optimal). Moteur : `src/engine/80-game.js` ; test : `tests/scoring.js`.
- **Admin = 2 pannes, Cyber = 3, Chaos = 4** par ticket (assembleur `src/engine/75-combo.js` : niveaux autorisés, panne de niveau imposé, ancrage par compétence, rejet des combinaisons non valides par simulation) ; `tests/combo.js` joue 40 graines × 3 niveaux (0 échec). Ticket composé : messages d'origine numérotés, politesses retirées.
- **Accueil** : slogan « Le ticket est flou, la panne est réelle. À toi de la trouver. », « Mots de passe de l'infra », graine masquée (Options formateur) et rappelée au débrief, **décor pixel-art de salle serveur** (`src/ui/89-scene.js`), 4 chats dispersés dans le décor.
- **7 thèmes** (`src/ui/88-themes.js`, `src/css/37-themes.css`) + animations du 100 ; les consoles émulées ne changent pas. Test : `tests/ui/themes-debrief.js` (accueil, thèmes, contrastes AA, animations, débrief, liens).
- **Liens de cours** au débrief d'un ticket non validé (`src/content/28-course-links.js`, `docs/LIENS-COURS.md`, `tests/course-links.js`).
- Personas : harnais adapté (vraie note /100, invariants du barème, tickets composés) → `docs/PERSONAS-ESSAIS.md`.

## Fiche v21 : OSPF, Snort, EtherChannel / STP (octobre 2026)
- OSPF une area + multi-area (Labège), Snort sur pfSense (8 pannes), EtherChannel LACP + STP (Colomiers, 7 pannes `ec_*` / `stp_*`) : détails, limites et choix à confirmer dans `docs/LIMITES.md` et `docs/DECISIONS-PROPOSEES.md`. Reste : HSRP (vague 3) ; Hyper-V après D-84.

## Progression et « jeu » (28/10/2026)
- Niveaux (40), XP par ticket, arbre de compétences (13 nœuds), maîtrise Bronze / Argent / Or par compétence, 41 succès, objectifs bonus, série avec Joker, **ticket du jour**, thèmes à débloquer, **coffre-fort d'identifiants** (formulaires puis terminaux), carnet de bord, sauvegarde du profil. Détail : `docs/PROGRESSION.md`. Tests : `tests/progress.js` (61 assertions), `tests/ui/progress.js`.
