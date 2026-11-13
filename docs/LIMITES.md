# Limites connues et compromis (à relire avant de présenter le jeu)

Principe du projet : un faux détail réaliste est pire qu'un détail absent. Tout ce qui n'a pas pu être confirmé
sans capture d'écran est **déclaré** (registre `docs/A-VERIFIER.md`, généré à chaque `node build.js` : le nombre d'entrées est celui de la dernière génération, ne pas le recopier ici).
Les interfaces sont sourcées sur captures **là où le registre du projet les compte** (écrans Windows et Active Directory : chiffre tenu par le projet, non recompté ici) ; les écrans **réseau (Cisco : OSPF, EtherChannel / STP), Linux et pfSense (Snort)** restent reconstitués de mémoire d'expert tant que les captures de `SESSION-VM-V21-RESEAU.md` ne sont pas relevées : leurs clés restent « à vérifier ». Un admin sys
expérimenté trouvera des écarts de détail ; ce sont ces écarts qu'il faut remonter pour correction.

## Fidélité des interfaces
- Polices : pile système (aucune police propriétaire embarquée). Rendu proche mais pas identique à Segoe UI / MMC.
- Icônes : toutes originales (SVG internes). Aucun logo, aucune capture d'éditeur tiers.
- Horloges : l'heure affichée dans les postes est en UTC (pas de fuseau local simulé) ; le décalage d'horloge des pannes Kerberos est lui bien modélisé.
- Consoles MMC (DHCP, DNS, ADUC, GPMC, pare-feu Windows avancé, IIS, certlm) : périmètre **partiel** — seules les
  pages/onglets utiles aux pannes du référentiel sont fonctionnels, le reste affiche l'arborescence réelle mais est inactif.
- Gestionnaire des tâches, Gestionnaire de périphériques, Gestion des disques, Informations système, Éditeur de
  registre, Éditeur de stratégie de groupe locale, PowerShell ISE : fenêtres **de présence** (ouvrent, aucune panne dessus).
- pfSense : interface web reconstituée ; les pages non modélisées affichent « Page non simulée » plutôt qu'une fausse page.
- Cisco IOS : sous-ensemble de commandes (celles du référentiel) ; modèles de matériel (« Catalyst 2960-24TT » etc.)
  descriptifs, sorties `show` calculées depuis l'état mais textes exacts marqués « à vérifier ».
- Linux : Debian 13 émulé (bash, systemd, apt, ssh, ufw, bind9, apache2, nginx, mariadb, cron, ACL, journalctl) ;
  `traceroute` limité, quelques journaux de fond absents.
- Services Windows : seuls les services **modélisés** apparaissent dans `services.msc` (pas la centaine réelle).
- Bureau à distance (mstsc) : une session par poste ; la reprise de session est simplifiée. Les pannes RDP ne sont pas
  dans la fiche : aucune panne RDP n'est livrée (l'outil sert à administrer).
- OpenVPN GUI / PuTTY : pas de fichier `.ppk`, pas de Pageant.
- Panneaux physiques (dos du poste, écran OSD, imprimante LCD) : menus **génériques** (pas ceux d'un modèle réel).

## Sites et identifiants
- Toulouse = site principal (domaine toulouse.local, SRV-DC1/FIC/LNX/WEB, pfsense-tls, SW-T1..3, IMP-T1). Bordeaux = site distant
  (bordeaux.local, SRV-DC2, pfsense-bdx, R-B1, SW-B1, PC-B1) relié par IPsec. Ramonville = **labo Cisco** (R-RV1, ramonville.lan, 172.16.x.x) :
  lieu de la formation où l'on manipule du matériel physique ; il porte les pannes NAT/ACL/DHCP Cisco. Labège (Data Valley) n'a pas de matériel physique mais **est modélisé depuis OSPF** (anneau R-LB1…R-LB5, zone 1 derrière R-LB3 : voir la section OSPF).
- Aucun nom de personne réelle dans les identifiants, tickets, annuaires ou clés : comptes génériques (`tssr`, `Administrateur`, `tech`).

## Périmètre pédagogique
- Squid / proxy web : 21 pannes livrées (`docs/PANNES-PROXY.md`), à partir du TP déjà donné en formation. Limites : voir « Proxy » ci-dessous.
- Hors fiche : OSPF et EtherChannel sont **livrés** (D-86, D-87) ; restent non traités : HA, HSRP (vague 3, prévue), OPNsense (les TP utilisent pfSense). Compétence « limite » : `switch-secu` (dérogation de D-86).
- Non modélisés : WINS, stratégie d'audit, Zabbix, AWS, Docker, Veeam, WDS (reportés au périmètre suivant).
- Pas de panne sur des notions absentes de la fiche v21 (voir docs/FICHE-V21-ECART.md pour les notions de la fiche encore sans panne). Aucune extension du périmètre n'a été faite sans signalement.

## Pannes ajoutées lors de la dernière itération (5)
- `dhcp_suffix` (reprise du concept V1, option 015 erronée) : jouée sur PC-RV2 (poste **hors domaine** de Ramonville, pool LAN-B du routeur).
  Choix volontaire : sur un poste joint au domaine, le suffixe principal du domaine reste dans la liste de recherche, donc cette panne n'y serait pas réaliste.
- `sh_missing` (reprise du concept V1) : partage supprimé, dossier intact ; erreur système 67 distincte de la 53 (déjà modélisée).
- `dns_hosts`, `web_site_stopped`, `web_hostheader` : nouvelles. Le code HTTP 400 « Invalid Hostname » repose sur un texte marqué « à vérifier » (`iis-400-host`).

## Check-up final : ajouts et écarts de réalisme traités
- Pannes ajoutées (2) : `nic_disabled` (N1, carte réseau désactivée dans Windows, câble et port sains ; compétences `phys`, `subnetting`) et `fw_smb` (N2, règle SMB entrante désactivée sur SRV-FIC, port 445 filtré ; compétences `pare-feu-win`, `ntfs-partage`). Aucune extension de périmètre.
- Parité ligne de commande / interface : `net share Nom=chemin /GRANT: /REMARK:` et `/DELETE`, `New-SmbShare`, `Remove-SmbShare`, `Grant-/Revoke-SmbShareAccess`, `Get-Website`, `Start-/Stop-Website`, `Get-/Set-WebBinding`, `Get-IISSite`, `Start-/Stop-IISSite`, `Enable-/Disable-NetAdapter`, `netsh interface set interface admin=`, `iisreset`. Les textes de succès/erreur correspondants sont dans `docs/A-VERIFIER.md`.
- Correction générale de l'émulateur PowerShell : la forme `-Paramètre:valeur` (ex. `-Confirm:$false`) était refusée.
- `ipconfig` n'affiche plus les cartes désactivées ; `Get-NetAdapter` indique `Disabled`.
- Confirmations interactives PowerShell : uniquement `Remove-SmbShare` et `Revoke-SmbShareAccess` (sans `-Force`) et `Disable-NetAdapter` (sans `-Confirm:$false`) ; le libellé exact de l'invite est marqué « à vérifier » (`ps-confirm`), `[S] Suspendre` n'est pas émulé (l'invite est reposée), les autres cmdlets à impact élevé ne demandent pas de confirmation.
- Non émulé : liaisons multiples d'un site sur plusieurs lignes dans `Get-Website`, `appcmd.exe`.

## Proxy (Squid / SquidGuard)
- Onglets Squid simulés : General, Local Cache, ACLs, Real Time. Les autres (Authentication, Antivirus, Web Filter…) ne sont pas simulés. SquidGuard : General, Common ACL, Blacklist, Log seulement.
- Liste de catégories partielle (téléchargement simulé de la liste universitaire) ; le mode transparent n'exige pas la règle « loopback » ; la falsification de l'en-tête Host est ignorée.
- Choix de modèle (non confirmés par capture) : comportement d'une regex invalide, d'un cache non enregistré, d'une base SquidGuard vide ; l'enregistrement du résolveur DNS s'applique immédiatement.
- Côté poste : « Options Internet » contient des commandes désactivées factices ; Paramètres Windows → Proxy n'est pas simulé.
- Scripts bash : `bash -n` ne détecte que la syntaxe (guillemets, `if`/`fi`), pas une commande inconnue.

## Snort (IDS / IPS sur pfSense) — compétence `snort`
- **Où** : pare-feu `pfsense-tls` (Toulouse), paquet « snort » (pfSense-pkg-snort 4.1.6, version à vérifier : capture E6) installé d'origine ; une instance sur WAN (mode Legacy, blocage de la source) et une sur LAN (alerte sur le Telnet sortant). Moteur : `src/engine/53-snort.js` ; interface : `src/ui/75c-pfw-snort.js` ; pannes : `src/content/29-faults-snort.js` (8).
- **Seules les règles de `custom.rules` déclenchent des alertes.** Les catégories de règles préinstallées (communautaires, Emerging Threats, abonnés), « Updates » et « Global Settings » sont des écrans de façade : cases enregistrées, aucun effet sur la détection. Pas de préprocesseurs, de Barnyard2, de réputation IP, de suppressions ni de SID Mgmt (onglets « Page non simulée »).
- **Sous-ensemble de la syntaxe de règle** : actions `alert`/`log`/`pass`/`drop`/`reject`/`sdrop`, protocoles `tcp`/`udp`/`icmp`/`ip`, `$HOME_NET`/`$EXTERNAL_NET` seules variables, listes d'adresses et de ports, `itype`, `icode`, `flags` (S, SA, A), `flow`, `msg`, `sid`, `rev`, `gid`, `classtype`, `priority`. **Aucun contenu de paquet n'est simulé** : une règle avec `content`, `pcre`, `dsize`… est acceptée mais signalée comme « non évaluée » et ne se déclenche jamais.
- **Mode Legacy uniquement** (Inline/IPS non simulé). Un blocage inscrit l'adresse dans la table `snort2c` (source, destination ou les deux), sauf si elle figure dans la liste de passage ; le blocage est **persistant** jusqu'à retrait dans « Blocked ».
- **Piège assumé** : dans l’état sain, un ping depuis Internet (PCEXT) vers le pare-feu bloque l’adresse source (règle 1000001 + Block Offenders) ; voir `DECISIONS-PROPOSEES.md` (Snort, point 8).
- **Écarts assumés** : les réglages s'appliquent à l'enregistrement (la vraie interface demande de redémarrer l'instance dans certains cas) ; un fichier `custom.rules` invalide est accepté à l'enregistrement mais l'instance ne démarre pas (texte d'erreur propre au jeu, pas celui de Snort) ; « default » pour HOME_NET et la liste de passage = adresses/sous-réseaux des interfaces, passerelles, DNS, routes et VPN (contenu exact à vérifier).
- **Textes à confirmer sur capture** (`docs/A-VERIFIER.md`, clés `pfsense-gui-snort*`, `snort-*`) : libellés et colonnes de tous les écrans, messages d'enregistrement, ligne « Snort IDS/IPS Daemon » de Status ▸ Services, libellés des classtype, journal de pare-feu d'un blocage. Captures demandées : lot E (E1 à E6) de `docs/CAPTURES-A-DEMANDER-V21.md`.

## Accueil, décor et thèmes
- Illustrations pixel-art, mascotte et **décor de salle serveur** dessinés dans le code (SVG, couleurs tirées du thème actif), aucune police ni asset tiers ; la pile de polices est celle du système (la police monospace de l'accueil dépend donc de l'OS).
- Le décor est ancré à gauche et pensé pour des fenêtres de **1280 px de large ou plus** ; en dessous il est simplement rogné (les 4 chats cachés restent dans les 1 100 premiers pixels). Testé à 1024, 1280 et 1440 px.
- **8 thèmes** (Néon Arcade, Pluie de code, Synthwave 80s, Cyberpunk, Console 8-bit, Terminal Ambre, Dev Dark, Papier Clair — le seul thème clair) : noms génériques, palettes et animations originales ; **ils ne changent jamais les consoles émulées** (Windows, Cisco, pfSense, terminaux), seulement l'accueil, la barre de jeu, le ticket et le débrief. Contrastes de texte contrôlés (AA) par `tests/ui/themes-debrief.js`.
- Animation du 100 / 100 : propre à chaque thème, fermée par clic, Échap ou ~5 s, remplacée par une carte fixe si le système demande « mouvement réduit ». Le thème 8-bit joue une courte fanfare (oscillateurs Web Audio, aucun fichier son) ; elle est silencieuse si l'audio est indisponible.
- La graine n'est plus un choix du joueur : tirage automatique, réglable dans « Options formateur », rappelée au débrief.

## Barème et combinaisons
- **Note sur 100, validée à partir de 75.** Départ 100 ; indices −8 / −15 / −25 (gratuits en guidé, interdits en chronométré), action dangereuse −15 (plafond −50), action à impact −4 (plafond −20), clôture prématurée −5, contournement pris pour une résolution −12, durée au-delà du temps cible jusqu'à −25 (atteint à 2,5 × la cible) : **une résolution propre ne passe donc jamais sous 75 à cause du temps seul**. Ticket non résolu : note plafonnée à 60 (temps écoulé) ou 40 (abandon) au prorata des causes réparées, donc toujours « à repasser ». Étoiles : 1★ 75–84, 2★ 85–94, 3★ 95–99 ; 100 = Parfait. Les paliers d'étoiles et les montants des pénalités sont **actés par le projet (D-79)** ; ce n'est pas la grille de la formation.
- **Temps cible par panne** : selon le **niveau** (base 5 / 8 / 11 / 16 min pour les niveaux 1 à 4), ± 30 s par étape du chemin optimal autour de 4, borné dans la plage du niveau (niv. 1 : 4–6 min ; niv. 2 : 7–9 ; niv. 3 : 10–12 ; niv. 4 : 14–18) ; panne composée : somme des causes −15 %. Le mode chronométré expire à 1,5 × le temps cible. Recalibré le 13/11/2026 sur un profil réel (avant : 120 s + 110 s × étapes, borné 6–20 min, sans le niveau : le temps ne pesait presque jamais). À réajuster sur les temps des apprenants (l'historique note désormais le numéro d'essai par panne).
- **Admin = 2 pannes, Cyber = 3, Chaos = 4** dans un seul ticket : assemblage déterministe par graine (même graine → même incident), natures différentes (Windows / Cisco / pare-feu / Linux / services réseau / physique), chaque combinaison **validée par simulation** (toutes les causes visibles, corrections complètes suffisantes, indépendance ou masquage). Admin pioche dans les niveaux 2–3 avec au moins une panne de niveau 3, Cyber dans 2–4 avec au moins une de niveau 4. Le ticket composé reprend les messages d'origine numérotés (formule de politesse retirée) : il est plus structuré qu'un vrai ticket vague, c'est un compromis de lisibilité.
- Un scénario formateur importé de niveau 2 à 4 entre automatiquement dans le pool des combinaisons (la validation par simulation écarte les associations incohérentes) ; il n'a pas besoin d'être déclaré ailleurs.
- Les pannes de base de niveau 3–4 restent jouables **seules** via « Options formateur → Panne précise » ou un scénario importé.
- Profil : les profils d'avant le barème sur 100 sont conservés (compteurs, badges, compétences) mais leurs **meilleurs scores et étoiles sont remis à zéro** (les points ouverts ne sont pas convertibles).

## Liens de révision (cours)
- Débrief d'un ticket non validé : liens vers le site de formation `tssr.miyukini.com` (cours, procédures, TP) d'après les compétences de la panne ; table statique, hôte fixe, `rel="noopener noreferrer"`. Connexion internet nécessaire. Détails, vérifications et écarts connus (pas de cours nginx ; pages OPNsense utilisées faute de page pfSense dédiée) : `docs/LIENS-COURS.md`.

## Essais par personas
- Les « apprenants » de `tests/personas.js` sont des modèles stochastiques écrits ici : ils stressent le moteur et le barème, ils ne mesurent pas de vrais élèves. La note est la vraie note /100 du jeu ; le seuil de 75 et le plancher du temps sont vérifiés à chaque partie.

## Moteur
- Un incident = un graphe de dépendances ; symptômes **dérivés** de l'état. Limite : le moteur modélise ce que le
  référentiel exige ; un état hors modèle (ex. paramètre jamais utilisé par une sonde) n'a aucun effet.
- Déterminisme : même graine + mêmes actions = même incident, mais l'horloge murale (minuteur) n'est pas rejouée.
- Débrief : chemin « optimal » = chemin déclaré par l'auteur du scénario, pas un calcul de plus court chemin.

## Persistance
- Profil, scores et scénarios importés : `localStorage` du navigateur (par navigateur, perdus si le stockage est vidé ;
  en mémoire seulement si le stockage est indisponible). Exporter la trace (JSON) au débrief pour archiver.

## Dettes techniques identifiées
- Tests Node absents pour quelques émulateurs secondaires (vérifiés par les tests UI uniquement).
- Les scénarios importés sont validés par simulation, mais leurs textes (ticket, indices) ne sont pas relus.
- Fichier unique ~1,8 Mo : chargement local immédiat, mais pas de découpage (acceptable hors ligne).

- **Zone inverse Bind9 (`lx_bind_ptr`)** : le serveur Linux (10.10.10.30) sert la zone inverse 10.10.10.in-addr.arpa pour ses propres enregistrements, alors que le contrôleur de domaine tient lui aussi une zone inverse sur le même /24 (panne `dns_ptr`). Les clients passent par le contrôleur de domaine : la panne ne se constate donc qu'en interrogeant directement le serveur Linux (`dig -x 10.10.10.30 @10.10.10.30`, `nslookup 10.10.10.30 10.10.10.30`), ce que le ticket dit explicitement. Compromis de modélisation, pas un défaut d'émulation.

## OSPF (vagues 1 et 1 bis : zone 0 puis zone 1) — site de Labège
- **Où** : nouveau site « Labège » (anneau R-LB1…R-LB5 en zone 0, 2 postes ; R-LB6 + PC-LB6 en **zone 1** derrière R-LB3, routeur de bordure de zone / ABR), séparé de Ramonville pour ne pas toucher à R-RV1 et à ses pannes NAT/ACL/DHCP. R-LB1 : NAT/PAT + route statique par défaut + `default-information originate`.
- **Calculé, jamais écrit en dur** (`src/engine/41-ospf.js`) : voisinages (mêmes sous-réseau, area, hello/dead, router-id différents, interfaces non passives), élection DR/BDR, Dijkstra avec ECMP, route par défaut externe E2 (`O*E2 0.0.0.0/0 [110/1]`), logs `%OSPF-5-ADJCHG` et `%OSPF-4-DUP_RTRID_NBR` issus des changements d'état réels.
- **Écarts assumés** : DR/BDR = plus haute (priorité, router-id), **sans non-préemption** (RFC 2328) ; type de réseau **broadcast** sur les liens Gi (→ `FULL/DR`, `FULL/BDR`) alors qu'un lab peut utiliser `ip ospf network point-to-point` (`FULL/-`) : à aligner sur les captures A1 ; convergence instantanée ; un seul processus OSPF ; deux niveaux de zones seulement (zone 0 + zones périphériques rattachées par un ABR) : **pas de liaison virtuelle, pas de stub/NSSA, pas d'agrégation (`area range`), pas de LSA de type 4** (l'ASBR est supposé joignable par la zone ou un ABR commun) ; les routes inter-zones sont recalculées par résumé d'ABR (`O IA`, métrique = coût jusqu'à l'ABR + métrique annoncée) ; pas d'authentification, pas de MTU ; coût = référence 100 Mbit/s ÷ débit nominal selon le nom d'interface.
- **Volontairement absent (rien d'inventé)** : `show ip ospf database`, `show ip ospf neighbor detail`, `debug ip ospf …`, compteurs et sommes de contrôle LSA/SPF de `show ip ospf`. Saisis, ils renvoient `% Invalid input` ou une sortie réduite.
- **Textes à confirmer sur capture réelle** (`docs/A-VERIFIER.md`, clés `ospf-*`) : mise en page des `show ip ospf …` et `show ip protocols`, libellés des messages de syslog, avertissement de changement de router-id, message de changement de bande passante de référence, ancienneté des routes (`hh:mm:ss`, estimée depuis l'adjacence).
- **Désaccord de zone sur un lien** : l'adjacence n'est pas établie (rejet « area ») ; **aucun message de syslog n'est émis** pour ce rejet, car le texte exact n'est pas vérifié (rien d'inventé) ; le diagnostic passe par `show ip ospf interface` (champ Area) et `show ip ospf neighbor`.
- **Router-id** : modifier le `router-id` d'un processus actif ne prend effet qu'après `clear ip ospf process` (comportement réel, utilisé comme piège dans `ospf_routerid_dup`).

## EtherChannel (LACP) et Spanning Tree — site de Colomiers, compétence `etherchannel`
- **Où** : site « Colomiers » (3 commutateurs : SW-CA Catalyst 3560-24PS cœur et racine STP, SW-CB et SW-CC Catalyst 2960-24TT ; SW-CB relié à SW-CA par un **Port-channel 1 de 2 × Gi** (Gi0/1–Gi0/2), SW-CC relié par un trunk Fa0/23 ; 4 postes, VLAN 10 « bureaux » et 20 « atelier »). Moteur : `src/engine/42-l2.js` ; CLI : `src/emu/34-ios-l2.js` ; sondes : `src/engine/78-fault-l2.js` ; pannes : `src/content/30-faults-l2.js` (7 fiches, 17 variantes).
- **Calculé, jamais écrit en dur** : drapeaux des ports (`P` agrégé, `I` seul, `s` suspendu, `D` éteint), état du Port-channel (`SU`/`SD`), compatibilité des modes (LACP `active`/`passive`, PAgP `desirable`/`auto`, `on`), cohérence membres ↔ Port-channel (mode trunk, VLAN autorisés, VLAN natif), racine et rôles STP **par VLAN** (Root / Desg / Altn / Back, FWD / BLK, coûts), tempête de diffusion (boucle dans le graphe de transfert ou dans un concentrateur, limitée au domaine de diffusion concerné). Journaux `%EC-5-BUNDLE`, `%EC-5-UNBUNDLE`, `%EC-5-CANNOT_BUNDLE2`, `%LINK-3-UPDOWN` du Port-channel et `%SPANTREE-5-ROOTCHANGE` issus des changements d'état réels.
- **Commandes reproduites** : `channel-group N mode active|passive|on|desirable|auto`, `no channel-group`, `interface port-channel N` (config propagée aux membres), `shutdown` du Port-channel, `spanning-tree vlan … priority|root primary|root secondary`, `no spanning-tree vlan …`, `spanning-tree mode`, `portfast`, `bpduguard`, `cost`, `port-priority` ; `show etherchannel summary`, `show spanning-tree [vlan N]`, `show spanning-tree blockedports`, `show interfaces trunk` / `status` (Po1), `show running-config` (ordre `Port-channel1` en premier, lignes `channel-group` et `spanning-tree`).
- **Volontairement absent (rien d'inventé)** : `show etherchannel port-channel`, `detail`, `N summary`, `load-balance`, `show lacp neighbor|counters|internal`, `show pagp …`, `show spanning-tree summary|root|interface|detail`, `port-channel load-balance`, `lacp system-priority|port-priority`, MST (accepté en configuration, **non simulé**), `spanning-tree guard`, `loopguard`, `etherchannel guard`. Saisis, ils renvoient `% Invalid input` (ou, pour `show etherchannel` seul, `% Incomplete command` — IOS réel affiche une liste des groupes : à confirmer sur capture). `bpduguard` est accepté et affiché dans le running-config mais **n'a aucun effet** (pas de port en `err-disabled` sur réception de BPDU).
- **Écarts assumés** : convergence instantanée (aucun état Listening / Learning, pas de timers ni de RSTP : `rapid-pvst` ne change que le libellé « rstp » du `show spanning-tree`) ; un **Port-channel créé par `channel-group`** recopie le mode, le VLAN, les VLAN autorisés et le VLAN natif du premier membre (clé `l2-po-create`) ; ré-saisie de `channel-group` avec un autre mode : remplacement silencieux (clé `l2-ec-modechange`) ; coût STP du Port-channel = 3 pour 2 × 1 Gbit/s (clé `l2-stp-pocost`) ; numéros de ports STP (`Prio.Nbr`) Fa0/n = n, Gi après les Fa, Po N = 64 + N (clé `l2-stp-portid`) ; `no interface port-channel N` supprime aussi les lignes `channel-group` des membres (clé `l2-no-po`) ; le type de port est `P2p` partout (jamais `Shr`, sauf concentrateur).
- **Tempête de diffusion** : la boucle fait échouer les pings du domaine touché, mais le commutateur **n'émet ni `%SW_MATM-4-MACFLAP_NOTIF`, ni alerte CPU, et n'affiche pas de compteurs de diffusion qui s'envolent** (formulations non vérifiées). Le diagnostic passe par `show spanning-tree vlan N` (instance absente), `show running-config | include spanning-tree` et `show interfaces status` (deux prises libres « connected »).
- **Topologie en arbre** (aucun lien SW-CB ↔ SW-CC) : une panne de Port-channel coupe donc réellement SW-CB ; les pannes de négociation ou de groupe manquant, elles, laissent un câble en service (alerte de supervision, pings OK), ce qui est volontaire (perte de redondance silencieuse, voir `DECISIONS-PROPOSEES.md`).
- **Textes à confirmer sur capture** (`docs/A-VERIFIER.md`, clés `l2-*`) : mise en page de `show etherchannel summary` et de `show spanning-tree`, libellés des messages `%EC-5-*` et `%SPANTREE-5-ROOTCHANGE`, ordre des lignes du running-config. Captures demandées : lot C (C1 à C6) de `docs/CAPTURES-A-DEMANDER-V21.md`.

## Progression (XP, arbre, coffre-fort)
- Le profil vit dans le navigateur (`localStorage`) : il disparaît si le stockage est vidé. Parade : export / import JSON (Outils → Sauvegarde du profil).
- Ticket du jour et série reposent sur la date locale du poste : un élève peut les fausser en changeant l'horloge. Pas d'anti-triche (aucun serveur).
- Le bouton clé du coffre-fort est un élément **ajouté** aux formulaires (ouverture de session Windows, UAC, Bureau à distance, pfSense) : il n'existe pas dans les vraies consoles. Il est absent sans le nœud de l'arbre et en évaluation chronométrée.
- Le coffre ne contient pas le mot de passe `root` (pas de `su root` couvert) ; les formulaires de création de compte (ADUC) ne sont pas concernés.
- Barème d'XP et courbe de niveaux : valeurs de conception, à réajuster après essais avec de vrais élèves.

## Console SQL (MariaDB)
- Gérés : `SELECT user,host FROM mysql.user`, `SHOW GRANTS`, `RENAME USER`, `DROP USER [IF EXISTS]`, `CREATE USER [IF NOT EXISTS]`, `ALTER USER … IDENTIFIED BY`, `GRANT <privilèges> ON base.* TO …`, `FLUSH PRIVILEGES`. Libellés `ERROR 1396` et sorties `Query OK` repris de mémoire (clé `mysql-userops`, à vérifier).
- Non gérés (signalés « Requête non gérée par le simulateur », jamais déguisés en erreur de syntaxe) : `UPDATE mysql.user`, `REVOKE`, `SELECT` sur des tables, `INSERT`, `SET PASSWORD`, etc. Les mots de passe des comptes SQL ne sont pas vérifiés.

## Fiche de l'infra (identifiants copiables, plan d'adressage)
- **Source unique** : le plan (`SIM.plan`, `src/engine/82-addressing.js`) est **lu dans le monde sain** (`buildHealthyWorld`), jamais écrit à la main : il ne peut pas diverger du modèle. Il donne l'adressage ATTENDU (IP, masque, passerelle, DNS, suffixe, VLAN du port, mode statique / DHCP, MAC quand le modèle en porte une). Les postes en DHCP affichent l'adresse du bail du monde sain.
- Le plan suit la graine de la partie en cours (sur l'accueil : graine 1). Les adresses sont celles du monde sain, pas celles de l'état en panne : le but est de comparer.
- **Disponible aussi en évaluation chronométrée**, comme le tableau des mots de passe. Conséquence pédagogique : pour les pannes « mauvaise IP / mauvaise passerelle / mauvais DNS », le plan donne la valeur attendue. Tranché par le projet (D-94) : disponible, sans malus ; chaque ouverture est tracée au débrief (à confirmer côté code, voir `DECISIONS-PROPOSEES.md`).
- Équipements sans adresse IP (commutateurs de niveau 2, non administrables) : une ligne explicite « aucune adresse IP ». Les routes statiques détaillées et les tables de routage ne sont pas dans le plan (seule la route par défaut est mentionnée).
- Copie : API presse-papiers du navigateur, avec repli sur sélection de texte si elle est indisponible. Un mot de passe **copié-collé** reste une saisie « remplie » : il ne compte pas pour le succès « Mémoire des doigts ».
- Éléments d'interface **ajoutés** (pas des répliques de consoles réelles) : la fenêtre « Fiche de l'infra » et les boutons « Identifiants » / « Adressage ».

## Réparation au terminal — balayage complet (29/10/2026)
Jusqu'ici, la validation des pannes (`F.validate`, `tests/ui/sweep.js`) réparait par les **étapes internes** : elle ne prouvait pas qu'une panne se répare avec de vraies commandes (c'est ainsi que `RENAME USER` a manqué). Trois tests comblent ce trou :
- `tests/cli-sweep-lx.js` : **85 combinaisons** panne Linux × variante, réparées uniquement avec de vraies commandes (nano + enregistrement, `chmod`, `chown`, `systemctl`, `ufw`, `setfacl`, `mysql` / `RENAME USER`, `mv`, `ln -s`, `rm`, `truncate`, `reboot`, `mount -o remount,rw /` en mode secours). Les modifications de fichier sont rejouées par l'éditeur (texte final calculé sur une copie du monde).
- `tests/cli-sweep-ios.js` : **72 combinaisons** panne Cisco × variante. L'état attendu est lu comme un admin le lit : différence entre `show running-config` du monde sain et du monde en panne, rejouée en commandes de configuration (`no …` d'abord, ajouts ensuite). Cas où l'état fautif n'est pas dans `show running-config` (clé RSA absente, ACL d'accès SSH, port désactivé par la sécurité de port) : réparation écrite à la main dans le test.
- `tests/audit-win-cli.js` : audit (pas un test de réparation) de **44 familles** de commandes Windows / AD / DHCP / DNS / IIS : émulée, signalée « non gérée », ou absente à tort.

Ce que le balayage a trouvé et corrigé : `setfacl` ne recalculait pas le masque (comportement documenté dans `man setfacl` : sans `-n` ni `m::`, le masque devient l'union des droits de la classe groupe) et plantait sur une ACL sans clé `groups` ; `usermod -aG`, `gpasswd -a/-d` et `adduser <utilisateur> <groupe>` n'existaient pas ; Cisco : `no aaa new-model` et `no switchport port-security mac-address sticky <mac>` étaient refusés alors que `show running-config` imprime la première.

Limites connues :
- Cisco : la différence `show running-config` repose sur le modèle du simulateur ; elle prouve qu'une commande acceptée par le simulateur répare, pas que la syntaxe soit celle d'un IOS réel dans les cas rares (formes `no <commande> <valeur>` : consignées « à vérifier » quand le test doit retirer la valeur finale).
- Windows : **12 applets de commande réelles non émulées** (`Set-GPLink`, `New-GPLink`, `Set-GPInheritance`, `Set-GPPermission`, `Add-DhcpServerInDC`, `Set-DnsServerResourceRecord`, `Add-DnsServerResourceRecordPtr`, `Start-WebAppPool`, `Add-WebConfigurationProperty`, `Set-NetIPAddress`, `Remove-NetRoute`, `Test-ComputerSecureChannel`, `Clear-ADAccountExpiration`) et les outils DC `netdom`, `dcdiag`, `repadmin`, `dsquery`, `dsget`, `setspn`. Le terminal répond désormais « non gérée par le simulateur » et renvoie vers la console graphique, au lieu de prétendre que la commande n'existe pas. Ces pannes se réparent dans les consoles graphiques (objectif n° 1).
- pfSense, AD et GPO : réparation par les consoles graphiques (tests `pfw2`, `proxy-faults`, `snort-faults`).
- **Balayage graphique Windows** (`tests/ui/gui-sweep-win.js`, 29/10/2026) : 98 combinaisons (pannes `ad_ dhcp_ dns_ fw_ gpo_ iis_ ipv4_ nic_ sh_ web_` × variantes de correction), **96 réparées par clics dans les consoles**, 2 combinaisons en écart de contenu, qui sont **un seul et même écart** (graines 11 et 101 de la même variante) : **`ad_secure_channel`, variante « canal » : aucune console ni commande ne répare le canal sécurisé ; variante retirée du tirage (D-102, `src/content/09-retired.js`)** (voir `DECISIONS-PROPOSEES.md`, à trancher). Les étapes « client » (bail, cache DNS, réouverture de session, attente) sont appliquées par le moteur ; 4 étapes sur routeur / commutateur / imprimante sont couvertes par les balayages au terminal ; le commentaire et l'énumération basée sur l'accès d'un partage ne sont pas dans l'interface simulée ; le renouvellement de certificat est piloté par le volet Actions (le menu clic droit › Toutes les tâches existe aussi).

## Aide-mémoire des commandes (29/10/2026)
- **Bouton « Aide-mémoire »** en haut à droite de chaque terminal (cmd, PowerShell, Linux après connexion, IOS ; absent de l'écran de connexion et de la console pfSense). Recherche instantanée, un clic **insère** la commande (ou son exemple) dans la ligne de saisie sans l'exécuter.
- **La liste vient des registres réels des émulateurs** (`SIM.emu.cmdIndex`, `src/emu/90-cmdindex.js`) : si le terminal ne sait pas faire une commande, elle n'y figure pas. Descriptions : `src/content/17-cmdhelp.js` (français, rédigées pour ce simulateur) ; IOS : aide « ? » du matériel (anglais, comme sur le vrai équipement), filtrée par type d'équipement et par mode.
- **Garde-fou** (`tests/cmdhelp.js`) : chaque commande émulée a une description ; aucune fiche orpheline ; **chaque exemple est exécuté** dans le simulateur et ne doit pas répondre « commande introuvable » / « non gérée ». Linux : les commandes qui ne sont pas installées par défaut (`netstat`, `ifconfig`, `traceroute`, comme sur la VM Debian du laboratoire) sont listées avec « Non installé par défaut : apt install … ».
- **Corrections trouvées en chemin** : `Get-Command` affichait des noms mal casés (`Add-Adgroupmember`) et le même module pour toutes les applets (maintenant : module d'origine par applet ; **versions de modules à vérifier**, clé AV `ps-get-command-modules`) ; un motif `[` sans `]` dans une ligne Linux (`[` ou `ls [`) faisait planter l'émulateur (traité comme texte littéral, comme bash).
- **Commandes d'aide réelles non reproduites** : `man` et `help` (Linux), `help` (cmd) répondent « non gérée par le simulateur » et renvoient vers l'aide-mémoire (jamais « commande introuvable », qui serait faux). `Get-Help` reste un squelette (« aide en ligne non disponible »). `<commande> --help` n'est reproduit que pour quelques commandes.
- Élément d'interface **ajouté** (pas une réplique de console réelle).


## Application de gestion de SRV-FIC (D-103, 29/10/2026)
- **Page originale, sans logo ni reprise d'un éditeur**, servie par IIS (site « Gestion », liaison HTTP par nom d'hôte `gestion.toulouse.local`, port 80) et ouverte dans le navigateur du simulateur. Aucun nouvel émulateur. Moteur : `src/engine/63-webapps.js` ; la page ne lit **aucun drapeau de scénario**, elle relit la sonde existante SRV-FIC → SRV-LNX:3306 (compte `intranet`) : base joignable → tableau de bord, sinon page d'erreur.
- **Le tableau de bord est statique et n'est PAS lié à la console SQL.** Compteurs et liste sont fictifs (sociétés fictives, aucun nom de personne). La console SQL ne gère pas de `SELECT` sur des tables : si le joueur interroge la base, il n'y retrouve pas les « clients » affichés par la page. L'inverse aussi : modifier la base ne change pas la page. **On n'a pas étendu la console SQL pour cette page** (décision D-103).
- **La page d'erreur est un texte d'application rédigé dans le jeu**, identique pour toutes les causes (port d'écoute, pare-feu, compte SQL, service arrêté, partition pleine) : aucun code, aucun message de pile, aucun message MariaDB. Ce n'est pas la reproduction d'une pile réelle (aucun relevé n'existe au projet). Le joueur départage les causes avec les outils de test de port et les journaux, pas avec la page. Un message technique pourra être rouvert **à condition d'un relevé sur une vraie pile**.
- **L'horodatage de la page vient de l'horloge simulée** (D-77), pas du HTML.
- **Le tableau de bord n'a pas de comportement** : pas de lien actif, pas de formulaire, pas de rafraîchissement automatique. C'est un élément ajouté au jeu, pas une réplique d'une console réelle.
- **Effet de bord sur deux pannes IIS existantes** (`iis_binding`, `web_site_stopped`) : le site « Gestion » occupe maintenant le port 80, donc le symptôme de ces deux pannes n'est plus « connexion refusée » mais **HTTP 400, « nom d'hôte non valide »** pour `http://srv-fic.toulouse.local/`. Leur sonde, leur cause et leur ticket ont été réécrits en conséquence. Le texte exact de la page d'erreur 400 d'IIS est dans `docs/A-VERIFIER.md` (« à vérifier »).
- **Ce que la page n'ajoute pas** : pas de nouvelle chaîne de pannes. Elle ajoute une observation (`http:PC-*:http://gestion.toulouse.local*`) ; une panne DNS ou IIS de la chaîne amont reste masquée par la règle D-44 (une seule panne de la chaîne DNS ou web par mission).

## Codes d'erreur, barème et commandes — état du 29/10/2026 (au soir)
- **Codes d'erreur (D-106)** : 92 codes au registre, **aucun vérifié**, trois masqués (Event ID 1046, 1063, 1502). Le numéro des autres est affiché tant que le projet n'a pas rendu la liste blanche. Les textes de contenu (cause, solution, chemin optimal, indices) ne passent pas par le point d'émission : un numéro masqué dans un journal peut rester cité dans un débrief. Voir `docs/CODES-ERREUR.md`.
- **Barème** : le terminal Linux marque maintenant `reboot`, `poweroff` et `systemctl stop` comme actions à impact (−4, plafond −20), sauf redémarrage exigé par la panne (`needsReboot`). Il n'existe **aucun garde-fou de niveau 1** (blocage avec avertissement) : les actions dangereuses sont pénalisées après coup, jamais empêchées.
- **Commandes** : `show etherchannel` seul répond « non gérée par le simulateur » (la sortie réelle n'est pas relevée). Les commandes Linux et IOS dont l'existence dépend de la plateforme sont marquées « à vérifier » dans `docs/INVENTAIRE-COMMANDES.md` et **non modifiées**. `apt list --installed` ne liste pas les paquets serveur (apache2, mariadb-server, nginx, bind9, ufw) alors que leurs services tournent : incohérence connue, non corrigée sans relevé.
- **Vérification des tickets** : 173 pannes sur 179 n'affichent pas de description de vérification dans le ticket (proposition de dérivation en attente).
