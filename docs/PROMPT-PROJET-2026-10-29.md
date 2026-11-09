Séance du 29/10/2026 (mise à jour de 11 h 30) : Claude Code vient de livrer et d'arbitrer avec le porteur du projet. Lis d'abord `claude/EDIVN-LAB-DECISIONS-PROPOSEES-2026-10-28.md` (sections « Arbitrages du porteur du projet du 28/10/2026 », « Progression et jeu livrés », « Fiche de l'infra livrée », « Balayage réparable au terminal et arbitrages du 29/10/2026 » et « Balayage graphique des consoles Windows (29/10/2026, 2e séance) »), puis `claude/EDIVN-LAB-LIMITES.md`, puis `DECISIONS.md`.

À faire dans cet ordre :

1. **Acter dans `DECISIONS.md`** les quatre arbitrages du 28/10 (le porteur du projet les a validés « Recommandé ») :
   a. Snort, point 8 : on garde le choix de Claude Code ;
   b. EtherChannel : le Port-channel est copié à la création (« copy-on-create ») : on garde ;
   c. EtherChannel / STP : le coût STP reste une valeur « à vérifier » (clé AV) : on garde ;
   d. pannes de redondance silencieuses (la panne n'a pas de symptôme tant que l'autre lien tient) : on garde.
   Pour chacun, écris la décision, la date, le motif en une phrase, et ce que ça coûtera plus tard.

2. **Acter les décisions du porteur du projet du 29/10** :
   a. le **plan d'adressage reste disponible en évaluation chronométrée** (il donne la valeur attendue pour les pannes d'adressage : dis si le barème doit en tenir compte) ;
   b. l'**aide-mémoire des commandes reste disponible en évaluation chronométrée** (réponse du 29/10 à 10 h 30 : « garder ») : dis si le barème doit en tenir compte ;
   c. le **coffre-fort d'identifiants dans les terminaux** : bouton « clé » visible quand le terminal attend un mot de passe, **et** raccourci Ctrl + Espace (réponse : « les 2 ») ; déjà livré et testé ;
   d. le **balayage « réparable au terminal »** est adopté comme contrôle permanent (`tests/cli-sweep-lx.js`, `tests/cli-sweep-ios.js`, `tests/audit-win-cli.js`) : Linux 85/85, Cisco 72/72 ; ajoute-le à la définition de « terminé » d'une panne Linux ou Cisco (« réparable avec de vraies commandes, pas seulement par l'étape interne ») ;
   e. le **balayage graphique des consoles Windows** (`tests/ui/gui-sweep-win.js`, Playwright : chaque correction déclarée est rejouée par clics et saisies dans les vraies consoles du bureau, puis la sonde de la panne doit repasser au vert) est adopté comme contrôle permanent ; ajoute-le à la définition de « terminé » d'une panne Windows / AD / GPO / DHCP / DNS / IIS / partages (« réparable dans la vraie console, pas seulement par l'étape interne »). Les chiffres et les étapes encore sans recette sont dans la section « Balayage graphique… » ;
   f. les **applets de commande Windows réelles non émulées** (12, listées dans `docs/LIMITES.md`) répondent « non gérée par le simulateur » : confirme cette règle générale (une commande réelle non émulée est signalée, jamais déclarée inexistante).

3. **Valider les correctifs de réalisme faits par Claude Code pendant le balayage graphique** (ce sont des défauts réels de l'interface ou du moteur, corrigés sans attendre ; chacun est décrit dans la section « Balayage graphique… ») : fenêtre UAC qui refusait le compte administrateur local ; case de l'option DHCP qui se cochait en cliquant le libellé ; trafic vers ses propres adresses filtré par le pare-feu de l'hôte (règle de bouclage) ; plantage de la GPMC quand on supprime le GPO affiché ; sélecteur d'objets de la GPMC qui n'acceptait pas « Utilisateurs authentifiés » (correction MS16-072 impossible) ; panne `gpo_link` qui jugeait « contournement » un lien recréé dans la GPMC ; saisie `BUILTIN\…` / `NT AUTHORITY\…` acceptée dans la boîte de sélection de principaux (clé « à vérifier » `sec-principals-prefix`) ; dossiers standard d'un contrôleur de domaine (`C:\Windows\NTDS`, `C:\Windows\SYSVOL\sysvol\<domaine>\Policies` et `\scripts`) présents dans l'Explorateur.

4. **Trancher un trou de contenu découvert par le balayage : la panne `ad_secure_channel`, variante « canal »** (relation d'approbation poste ↔ domaine rompue, `secureChannel = false`). **Aucune console ni commande du simulateur ne la répare** : la variante est donc irréparable pour le joueur, alors que sa solution annonce `Test-ComputerSecureChannel -Repair` / `Reset-ComputerMachinePassword` / sortie-rejointe du domaine (aucune des trois n'existe ; `netdom` est volontairement non géré, et il n'existe pas sur un poste client sans RSAT). Options à chiffrer et trancher : (A) émuler `Test-ComputerSecureChannel -Repair -Credential` avec `Get-Credential` (le chemin canonique) ; (B) émuler la sortie et la rejointe du domaine par « Propriétés système » ; (C) retirer la variante « canal » en attendant (il reste la variante « compte ordinateur désactivé », réparable dans ADUC). Dis laquelle tu recommandes, puis écris la consigne.

5. **Trancher la proposition « application de gestion »** (page web originale servie par SRV-FIC, erreur calculée depuis la sonde SRV-FIC → SRV-LNX:3306). Le porteur du projet a dit **oui sur le principe** (arbitrage OK le 29/10) mais **rien ne doit être codé avant que le projet l'acte**. Valide ou amende le périmètre (page de tableau de bord + page d'erreur, message MariaDB brut, aucune pile applicative inventée), puis écris la consigne de développement pour Claude Code.

6. **Écrire la consigne de captures pour Cowork** (`CAPTURES-EN-ATTENTE.md` + consigne) : OSPF (routes `O IA`, `show ip ospf` sur un ABR), Snort (états E1 à E6), EtherChannel (C1 à C6). Ne demande que ce qui est utile pour vérifier les formats « à vérifier » restants.

7. **Mets à jour `PASSATION.md`** : état de la séance, prochaine étape recommandée = HSRP (vague 3) ; Hyper-V reste conditionné à D-84.

Questions encore ouvertes pour le porteur du projet (à lui poser, pas à trancher seul) : le choix A / B / C du point 4 ; l'application de gestion (point 5) une fois le périmètre validé. Idées reportées : mutateurs, cosmétiques de mascotte, classement partagé, défi hebdomadaire, export PDF des compétences.

Termine par : prochaine étape recommandée + points de décision qui attendent le porteur du projet.
