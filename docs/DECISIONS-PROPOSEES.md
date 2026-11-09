# Décisions proposées (à arbitrer ; rien n'est acté tant que `DECISIONS.md` ne les reprend pas)

Ce fichier est tenu par Claude Code : il propose, le commanditaire arbitre, le projet acte dans `DECISIONS.md`.

## Déjà validées dans la conversation (à acter dans `DECISIONS.md`)
- **Seuil de validation à 75 / 100** ; note sur 100 au lieu des 5 étoiles ; 100 = « parfait » avec une courte animation liée au thème choisi.
- **Combinaisons dès Admin** : Admin = 2 pannes, Cyber = 3 pannes (la V1 en avait dès Admin) ; Chaos reste « tous les modules, au hasard » (4 pannes).
- **Graine masquée** de l'accueil, déplacée dans « Options formateur » et rappelée au débrief avec « Rejouer cet incident ».
- **Accueil** : « Coffre d'identifiants » → « Mots de passe de l'infra » (avec une pointe d'humour) ; nouveau slogan ; décor pixel-art **salle serveur** ; chats cachés dispersés dans le décor.
- **8 thèmes** génériques (Néon Arcade, Pluie de code, Synthwave 80s, Cyberpunk, Console 8-bit, Terminal Ambre, Dev Dark, Papier Clair — seul thème clair, animation du 100 : tampon « VALIDÉ »).
- **Liens de cours** sur les tickets non validés, vers `tssr.miyukini.com` (site d'un camarade de formation), selon le sujet de la panne.

## Choix faits par Claude Code, à confirmer ou ajuster
1. **Paliers d'étoiles** : 1★ 75–84, 2★ 85–94, 3★ 95–99 (le commanditaire a laissé la main sur les paliers 2 et 3).
2. **Pénalités** : indices −8 / −15 / −25 (gratuits en guidé), action dangereuse −15 (plafond −50), clôture prématurée −5, contournement pris pour une résolution −12, action à impact −4 (plafond −20). Deux actions dangereuses suffisent donc à faire échouer (70) ; un seul indice laisse à 92.
3. **Temps cible par panne** (« décide-toi ») : 120 s + 110 s × étapes du chemin optimal, borné 6–20 min ; panne composée = somme − 15 %. Le temps ne retire que de 0 à 25 points (plancher 75) ; le mode chronométré garde son échéance dure à 1,5 × cible. Les échecs viennent des indices, dangers, clôtures prématurées, abandon et échéance.
4. **Profils existants** : meilleurs scores et étoiles remis à zéro (points ouverts non convertibles), compteurs et badges conservés.
5. **Page OPNsense** du site de cours (`/opnsense-nat`, `/opnsense-segmentation`) utilisées comme repli pour `portfwd` et `segmentation` (le site n'a pas de page pfSense dédiée) : OPNsense est hors fiche. À garder ou retirer.
6. **Pas de cours nginx** sur le site : la compétence `nginx` renvoie vers les virtualhosts Apache (libellé explicite).

## Toujours en attente
- **Hors fiche v19** (non traités sans ton accord) : HA, OSPF, EtherChannel, HSRP ; OPNsense (les TP utilisent pfSense) ; le site de cours couvre OSPF / HSRP / OPNsense mais ces pages ne sont jamais proposées.
- **Captures à demander à Cowork** : invite de confirmation PowerShell (`ps-confirm`), erreurs de script bash (`bash-script-errors`), pages Squid / SquidGuard (entrées proxy de `docs/A-VERIFIER.md`).


## Arbitrages reçus le 2026-10-27 (à acter dans DECISIONS.md par le projet)

| Sujet | Arbitrage de l'utilisateur |
|---|---|
| Paliers d'étoiles et barème de pénalités | Gardés tels quels : 75 réussi, 85 = 2★, 95 = 3★ ; indices −8/−15/−25, danger −15 (cap −50), impact −4 (cap −20), temps jusqu'à −25 |
| Temps cible par panne | Formule gardée (120 s + 110 s par étape optimale, arrondi 30 s, bornes 360–1200 s ; chrono = 1,5 × cible) |
| Anciens scores du profil | Remise à zéro (migration profil v2) |
| Part de chaînes dans les pannes combinées | ~35 % en mode auto, inchangé |
| 8ᵉ thème clair | Oui → « Papier Clair » livré |
| Captures de référence | Les 156 d'un coup (liste : docs/CAPTURES-A-FAIRE.md) — à produire par Cowork, consigne à rédiger côté projet |
| Point 3 (« ça peut attendre ») | Pas maintenant |
| Hors fiche (HA, OSPF, EtherChannel, HSRP, OPNsense) et liens OPNsense de repli | **En attente** : la fiche de compétences mise à jour doit être renvoyée ; rien n'est changé d'ici là |

## Fiche v21 reçue le 2026-10-27 — arbitrages et état

| Sujet | Arbitrage | État |
|---|---|---|
| OSPF / EtherChannel / HSRP (désormais dans la fiche) | Construire par vagues : OSPF une area, puis EtherChannel, puis HSRP | À faire (aucune émulation n'existe) |
| Snort / IDS-IPS pfSense, Hyper-V | À ajouter | À faire — captures de référence nécessaires |
| Zabbix, Docker, AWS, WDS, Veeam | Non retenus pour l'instant | — |
| PTR sans domaine (réa Linux 1) | Oui | Fait : panne `lx_bind_ptr` (N3), zone inverse Bind9 ajoutée au monde |
| `switch-secu` (aucune ligne dans la fiche) | Garder | Gardée, à marquer « limite » dans le référentiel |
| Pilotage / documentation (ITIL, RTO-RPO, chiffrage, soutenance, méthode) | Hors jeu (pas des pannes) | Proposé, non contesté |

Rappel : l'écart complet est dans `docs/FICHE-V21-ECART.md`. Ces arbitrages sont à acter dans `DECISIONS.md` par le projet.

## Décisions de `DECISIONS.md` rouvertes par les arbitrages du 27/10/2026 (à traiter explicitement par le projet)

`DECISIONS.md` (dernière entrée D-78, 12/09) contredit deux des arbitrages ci-dessus. Le plus récent prime, mais la règle du projet veut que la contradiction soit signalée et réécrite avec sa date et son motif, pas résolue en silence.

| Décision existante | Contradiction | Ce que dit la fiche v21 | Question au projet |
|---|---|---|---|
| **D-61** (17/08) : Hyper-V hors périmètre, motif « le technicien n'a pas la main sur l'hyperviseur » | Arbitrage du 27/10 : ajouter Hyper-V (VM, snapshots, commutateurs) | 3 lignes 🟢 : hyperviseur / VM / snapshots, commutateurs virtuels, attribution de ressources | Rouvrir D-61 avec motif, ou limiter à des pannes vues du côté poste (ex. carte virtuelle débranchée) |
| **D-09 / D-24 / D-56** : zones inverses et PTR hors périmètre | Panne `lx_bind_ptr` (Bind9, zone inverse) livrée le 27/10 ; `dns_ptr` (Windows) existait déjà | La ligne « DNS — zones, enregistrements A/PTR » est en 🟢 ; Bind9 « zones directe et inverse » confirmé par la réa Linux 1 (90,25/100) | Rouvrir D-09 pour les PTR, ou retirer `lx_bind_ptr` |

Autres points que `DECISIONS.md` ne couvre pas encore :
- **OSPF, EtherChannel, HSRP, Snort** : absents de D-09 (qui renvoie le Cisco « après le socle Windows » et ne connaît pas ces protocoles). Arbitrage du 27/10 : à construire, par vagues, captures Cisco demandées à Cowork en parallèle.
- **`switch-secu`** : aucune ligne dans la fiche, gardée sur arbitrage du 27/10, marquée « limite ».
- **Pilotage / documentation** (ITIL, RTO-RPO, chiffrage, soutenance) : proposé hors jeu.

## OSPF vague 1 livrée (28/10/2026) — choix faits par Claude Code, à confirmer
| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | **Nouveau site « Labège »** (5 routeurs en anneau, 2 postes) plutôt que greffer OSPF sur Ramonville | R-RV1 porte 12 pannes NAT/ACL/DHCP ; le modifier risquait de les casser. Coût : un 4e onglet de carte et +7 appareils. |
| 2 | Liens Gi en **broadcast** (DR/BDR affichés `FULL/DR`) | À réaligner si les captures montrent du point-à-point (`FULL/-`). |
| 3 | 4 pannes OSPF (`ospf_lan_network` ×4, `ospf_default_route` ×4, `ospf_timers` ×3, `ospf_routerid_dup` ×2), compétence `ospf` (🟢 « une seule area ») | Total 163 pannes (21/62/62/18). Les pannes de voisinage sont des alertes de supervision : l'anneau redondant masque l'effet aux pings. |
| 4 | Multi-area (ABR, `O IA`) : voir le tableau « vague 1 bis » ci-dessous | Faite juste après. |
| 5 | Textes `show ip ospf …` / syslog marqués « à vérifier » (clés `ospf-*`) | Captures A1–A9 de Cowork à rapprocher du rendu. |

## OSPF vague 1 bis livrée (28/10/2026) — multi-area, choix faits par Claude Code, à confirmer
| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | **R-LB6 + PC-LB6 en zone 1** rattachés à R-LB3 (qui devient ABR : Gi0/2 10.30.36.0/30 en zone 1), sur le site Labège existant | Évite un nouveau site ; R-LB3 reste dans l'anneau. Coût : la carte Labège passe à 8 nœuds. |
| 2 | Moteur multi-zones à **deux niveaux** (zone 0 + périphériques), routes `O IA` par résumé d'ABR, défaut E2 vu via l'ABR | Couvre la ligne « OSPF — plusieurs areas (ABR, routes O / O IA) ». Pas de liaison virtuelle, stub/NSSA, `area range`, LSA 4 (voir `docs/LIMITES.md`). |
| 3 | `show ip ospf` / `show ip protocols` : « It is an area border router » ; `show ip route` : code `O IA` | Libellés à confirmer sur capture (clé `ospf-show-format`). |
| 4 | Panne `ospf_area_mismatch` (3 variantes, niveau 4), 2 variantes `ospf_lan_network` pour le LAN de l'annexe, sonde cachée annexe → Internet dans `ospf_default_route` | Total **164 pannes (21/62/62/19)**, 48 compétences. Compétence `ospf-multi` classée 🟡 comme sur la fiche. |
| 5 | Aucun message syslog pour le rejet « area mismatch » | Texte exact non vérifié : rien d'inventé. À ajouter si une capture le fournit. |

## Snort livré (28/10/2026) — choix faits par Claude Code, à confirmer
| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | Snort sur le pfSense existant de Toulouse (`pfsense-tls`), une instance WAN (Legacy, blocage source) + une instance LAN (alerte Telnet sortant) | Pas de nouveau décor ; le TP IDS/IPS porte sur ce pare-feu. Attaquant = PCEXT (Internet), poste de référence = PC-02 (RH). |
| 2 | **Seul `custom.rules` produit des alertes** ; catégories, Updates et Global Settings sont inertes | Sans contenu de paquet simulé, un jeu de règles réel serait un décor trompeur. Coût : le joueur ne peut pas s'exercer à activer des catégories (documenté dans `LIMITES.md`). |
| 3 | Sous-ensemble de la syntaxe Snort + messages d'erreur de démarrage **propres au jeu** | Le texte réel des erreurs Snort n'est pas connu : rien d'inventé (clé `snort-rule-syntax`). |
| 4 | 8 pannes (`snort_service` ×2, `snort_rule_syntax` ×4, `snort_homenet` ×3, `snort_wrong_iface`, `snort_no_block` ×3, `snort_blocked_legit`, `snort_blocked_stale`, `snort_cascade`) — total **172 pannes (22/65/65/20)**, 49 compétences | Compétence `snort` (Sécurité), rattachée aussi à `pfsense`, `subnetting`, `openvpn`, `diag` selon la panne. |
| 5 | Vérification des sondes par **rejeu à blanc** (`dryFlow`) : aucun effet de bord sur la table des hôtes bloqués ni sur les journaux | Une sonde de détection qui bloquerait elle-même l'attaquant fausserait l'évaluation. |
| 6 | Réparation de toutes les pannes vérifiée **par l'interface** (`tests/ui/snort-faults.js`, 16 parcours dont les variantes) | Condition « un admin sys réel ne relèverait pas d'incohérence ». |
| 7 | Captures E1 à E6 à produire par Cowork (déjà listées dans `CAPTURES-A-DEMANDER-V21.md`) | Libellés des écrans Snort reconstitués de mémoire (clé `pfsense-gui-snort`) : à comparer dès réception. |
| 8 | **Point à arbitrer** : dans l'état sain, un ping de PCEXT vers l'adresse WAN lève l'alerte 1000001 et **inscrit PCEXT dans la table des hôtes bloqués** (Block Offenders actif sur le WAN) | Comportement conforme au TP IDS/IPS, mais piège pour les pannes VPN / WAN (`vpn_*`, `pf_portfwd`…) si le joueur teste la joignabilité par un ping depuis PCEXT : son VPN tombe ensuite. Alternatives : (a) garder tel quel et l'assumer comme piège pédagogique (action « dangereuse » au débrief), (b) rendre la règle 1000001 non bloquante (nécessite un blocage par règle, absent de Snort réel), (c) retirer la règle ICMP de l'état sain et ne garder que le SSH. Défaut retenu : (a). |

## EtherChannel (LACP) + STP livrés (28/10/2026) — vague 2, choix faits par Claude Code, à confirmer
| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | **Nouveau site « Colomiers »** (SW-CA cœur / racine, SW-CB en **Po1 2 × Gi**, SW-CC en trunk Fa0/23, 4 postes VLAN 10 et 20) plutôt que greffer un Port-channel sur Toulouse | Les commutateurs de Toulouse portent les pannes VLAN, trunk, port-security et SVI qu'un Port-channel risquait de casser. Coût : un 6ᵉ onglet de carte et +7 appareils. |
| 2 | Modèle L2 **calculé** (flags `P/I/s/D`, `SU/SD`, STP par VLAN, tempête limitée à un domaine) dans `42-l2.js`, CLI dans `34-ios-l2.js` | Aucun symptôme écrit en dur. Coût : STP simplifié (convergence instantanée, pas de RSTP/MST, `bpduguard` sans effet) — voir `LIMITES.md`. |
| 3 | **Un Port-channel créé par `channel-group` copie la configuration du premier membre** (clé `l2-po-create`) | Évite des suspensions parasites quand le joueur configure les ports avant l'interface logique. Le comportement exact d'IOS (recopie ou non) n'est pas vérifié. |
| 4 | **Coût STP d'un Po de 2 × 1 Gbit/s = 3**, numéros de ports Fa/Gi = index + 1, Po = 64 + N | Valeurs indicatives (clés `l2-stp-pocost`, `l2-stp-portid`) : à aligner sur les captures C1. |
| 5 | **7 pannes** : `ec_negotiation` ×3 (passive/passive, on/active, PAgP/LACP), `ec_group_missing` ×2, `ec_member_mismatch` ×3 (mode, VLAN autorisés, VLAN natif), `ec_allowed_vlan` ×3 (Po SW-CA, Po SW-CB, trunk Fa0/23), `ec_po_shutdown` ×2, `stp_root_moved` ×3, `stp_loop_cable` | Total **179 pannes (22/66/69/22)**, 50 compétences. Rattachées à `etherchannel` (+ `trunk`, `vlan`, `diag` selon la panne). |
| 6 | **Pannes « silencieuses »** (`ec_negotiation`, `ec_group_missing`, `stp_root_moved`) : les pings restent OK, la panne est une perte de redondance détectée par des **sondes d'état** (drapeau `I`/`s`, racine STP) | Réaliste (alerte de supervision) mais l'élève qui se contente d'un ping croit avoir fini : la détection de résolution le rattrape, le débrief le signale. À arbitrer : garder, ou ajouter systématiquement un symptôme visible. |
| 7 | Réparation vérifiée **uniquement en CLI IOS** (`tests/ios-fixes.js`, 7 pannes / 17 variantes) + `tests/l2-cli.js` (26 assertions) + carte (`tests/ui/colomiers-map.js`) | Condition « un admin sys réel ne relèverait pas d'incohérence » côté commandes. |
| 8 | Tempête de diffusion **sans `%SW_MATM-4-MACFLAP_NOTIF`** ni alerte CPU | Formulation non vérifiée : rien d'inventé. À ajouter si la capture C6 la fournit. |
| 9 | Captures C1 à C6 à produire par Cowork (déjà listées dans `CAPTURES-A-DEMANDER-V21.md`) | Mise en page des `show` reconstituée de mémoire (clés `l2-ec-show`, `l2-stp-show`, `l2-ec-syslog`, `l2-stp-syslog`, `l2-runcfg`) : à comparer dès réception. |

**Prochaine étape recommandée** : HSRP (vague 3) sur le même principe (site dédié ou greffe sur Colomiers avec un routeur), après arbitrage des points 3, 4 et 6 ci-dessus. Hyper-V reste conditionné à D-84.

## Arbitrages du porteur du projet du 28/10/2026 — à acter par le projet (`DECISIONS.md`)
Le porteur du projet a demandé « arbitre et applique pour faire le mieux selon toi » : Claude Code a tranché les points en suspens comme suit. **Ce ne sont pas encore des décisions** tant que le projet ne les a pas écrites dans `DECISIONS.md`.
| # | Point | Arbitrage retenu | Raison |
|---|---|---|---|
| 1 | Snort, point 8 : le ping de PCEXT vers le WAN bloque PCEXT (Block Offenders) | **Conserver (a)** : comportement conforme au TP, c'est un piège pédagogique (une panne VPN / WAN peut venir d'un hôte bloqué par Snort) | Le retirer reviendrait à cacher un vrai effet de bord de l'IPS. Les sondes de détection sont à blanc (`dryFlow`), donc l'évaluation n'est pas faussée. |
| 2 | EtherChannel, point 3 : le Port-channel créé par `channel-group` copie la configuration du premier membre | **Conserver**, clé `l2-po-create` (à vérifier) | Évite des suspensions parasites ; reste signalé dans A-VERIFIER. |
| 3 | EtherChannel, point 4 : coût STP du Po = 3, numérotation des ports | **Conserver**, clés `l2-stp-pocost` / `l2-stp-portid` (à vérifier) | Valeurs indicatives, à aligner sur les captures C1. |
| 4 | EtherChannel, point 6 : pannes « silencieuses » (`ec_negotiation`, `ec_group_missing`, `stp_root_moved`) | **Conserver** | Réaliste (perte de redondance, alerte de supervision) ; le ticket guide vers `show`. |

## Progression et « jeu » livrés (28/10/2026) — demande du porteur du projet, choix faits par Claude Code
Objectif : rendre la résolution de tickets **addictive** et donner envie de rejouer (niveau, compétences, série, succès) **sans jamais fausser la formation ni la note**. Détail dans `docs/PROGRESSION.md`.

Réponses aux questions (toutes sur le choix recommandé) :
| Question | Réponse |
|---|---|
| Coffre et carnet en évaluation chronométrée ? | **Coupés** : les notes restent comparables entre élèves. |
| Thèmes | **5 sur 8 verrouillés** derrière l'arbre (libres : Néon Arcade, Dev Dark, Papier Clair). |
| Rendez-vous quotidien | **Ticket du jour** (même incident pour tous, graine = date, XP ×1,5) + **série** de jours avec **Joker**. |
| Coffre dans les terminaux | **Oui, 2ᵉ palier payant** (invites SSH / sudo / su / enable, Ctrl + Espace). |

| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | **Règle d'or : rien de ce qui se gagne ne change la note ni le contenu d'un ticket.** Avantages = confort (coffre, carnet), style (thèmes, titres), XP, tolérance de série. Aucun contenu de formation n'est verrouillé. | Garantit qu'un élève « riche en points » n'a pas plus de chances de valider. Invariance de la note testée avec un profil maximal (`tests/progress.js`). |
| 2 | **XP** : base par niveau (60 / 100 / 160 / 230 / 300), bonus étoiles, première résolution, record, sans faute, rapidité, objectifs bonus ; rejeu d'une panne maîtrisée à 60 % ; mode guidé × 0,6 ; ticket du jour × 1,5 ; série +5 % par jour (plafond +30 %) ; arbre +10 % max. Échec = 10 XP de participation. 40 niveaux (`cum(n) = 100·(n−1)^1,6`), 1 point par niveau + 1 aux niveaux 10 / 20 / 30 / 40 | Anti-farm : le rejeu rapporte moins, le guidé aussi. Coût : barème d'équilibrage à réajuster après essais réels. |
| 3 | **Arbre de compétences** (13 nœuds, 3 branches : Confort, Réputation, Style) ; points **dérivés** (gagnés − dépensés, jamais stockés) ; réinitialisation gratuite | Pas de choix « raté » : on peut tout réaffecter. |
| 4 | **Coffre-fort d'identifiants** : offert par le succès « Mémoire des doigts » (20 saisies manuelles réussies) ; palier 2 (terminaux) = succès « Pianiste » (60 saisies) + 2 points. Bouton clé sur : ouverture de session / verrouillage Windows, élévation (UAC), Bureau à distance, connexion pfSense. Ctrl + Espace aux invites de mot de passe des terminaux. Seules les saisies **manuelles réussies** comptent (pas les remplissages, pas les échecs) | Le coffre reprend exactement le tableau « Mots de passe de l'infra ». Le mot de passe `root` n'y figure pas (pas de `su root` couvert). Le bouton clé est un élément **ajouté** (pas une réplique d'une vraie console) : volontaire, visuellement distinct. |
| 5 | **Maîtrise par compétence** : Bronze / Argent / Or à 1 / 3 / 6 validations propres (sans indice ni action risquée) | Rend visible la couverture de la fiche de compétences, domaine par domaine. |
| 6 | **41 succès** (9 d’origine + 32), 4 familles, quelques secrets ; objectifs bonus (3, 4 avec « Chasseur de primes ») tirés par graine à chaque ticket et évalués en direct | Les objectifs poussent à la bonne méthode (cause racine, pas de fausse manip), jamais à une astuce. |
| 7 | **Ticket du jour** : niveau selon le jour (lun. 1, mar. 2, mer. 3, jeu. 2, ven. 4, sam. 3, dim. Chaos), graine = date ; niveaux 1 et 2 : panne fixée indépendamment du profil | Utilise l'horloge locale du poste : un élève peut tricher en changeant la date (pas de serveur). Documenté, accepté. |
| 8 | **Profil en `localStorage` uniquement**, avec export / import JSON (Outils → Sauvegarde du profil) ; l'import repasse par `cleanProfile` | Pas de serveur, pas de compte. Coût : le profil disparaît si le navigateur est vidé ; l'export est la parade. |
| 9 | **Profils existants migrés** : XP rétroactive d'après l'historique, compteurs recalculés, thème déjà choisi conservé (`giftTheme`) | Personne ne repart de zéro ni ne perd son thème. |
| 10 | **Carnet de bord** par ticket (30 derniers conservés), coupé en chronométré | Aide à la rédaction du compte rendu ; XP du succès « Carnet ». |

**Idées restantes (non faites, à arbitrer)** : mutateurs de ticket (« mains dans le dos » : sans indice, « horloge accélérée »), cosmétiques de mascotte (chapeaux débloqués), classement formateur / graine de classe partagée, défi hebdomadaire de série de pannes, export PDF d'un carnet de compétences.

**Point à vérifier côté projet** : le bouton clé (coffre) est-il acceptable dans une réplique « fidèle » ? Alternative : touche seule (Ctrl + Espace) sans bouton, plus discret mais moins découvrable.

## Fiche de l'infra livrée (28/10/2026) — demande du porteur du projet, choix faits par Claude Code

Demande : « un bouton pour copier les id et mdp, et les IP, masques, DNS etc. attendus pour chaque machine, comme sur un schéma réseau, pour faciliter comparaisons et pings ».

| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | Fenêtre unique « Fiche de l'infra » à deux onglets : **Identifiants** (boutons « Copier id » / « Copier mdp », clic sur la valeur = copie) et **Plan d'adressage** (groupé par site, filtre texte, clic sur une valeur = copie). Accès : accueil (Outils), et en jeu (boutons « Identifiants » et « Adressage ») | Outil d'aide, pas une console : volontairement visuellement distinct |
| 2 | Plan **calculé depuis le monde sain**, pas rédigé | Zéro divergence possible avec le modèle ; coût : il suit le modèle, donc toute évolution d'adressage s'y reflète sans relecture |
| 3 | Plan **disponible en évaluation chronométrée** | Cohérent avec le tableau des mots de passe, déjà disponible. **Point à arbitrer par le projet** : il livre la valeur attendue pour les pannes d'adressage (IP, passerelle, DNS, masque). Alternative : le masquer en mode chronométré |
| 4 | Copier-coller d'un mot de passe ≠ saisie manuelle pour la progression | Sinon le succès « Mémoire des doigts » deviendrait trivial |
| 5 | Les routes (hors route par défaut) et les tables ARP/MAC ne sont pas dans le plan | Un schéma réseau ne les porte pas ; évite d'afficher des valeurs d'état |

Tests : `tests/addressing.js` (moteur, 5 graines : tous les équipements, IP uniques, IP présentes sur l'équipement, passerelle dans le sous-réseau, bails DHCP) et `tests/ui/infra.js` (copie réelle dans le presse-papiers, filtre, modale, mode libre et chronométré).

## Balayage « réparable au terminal » et arbitrages du 29/10/2026 — choix faits par Claude Code

Décisions du porteur du projet (29/10) : **(1)** garder le plan d'adressage en évaluation chronométrée ; **(5)** lancer un balayage complet ; **(6)** oui pour une vraie page web simulée de « l'application de gestion » (SRV-FIC) ; idées restantes (mutateurs, cosmétiques, classement, défi hebdomadaire, export PDF) : rien pour l'instant.

| # | Constat / choix | Pourquoi / coût |
|---|---|---|
| 1 | Plan d'adressage conservé en mode chronométré (décision du porteur) | Il donne la valeur attendue pour les pannes d'adressage : à acter par le projet. Si une note de barème doit l'intégrer, ce sera au projet de trancher |
| 2 | **Balayage Linux : 85/85** réparées au terminal, **Cisco : 72/72** | Voir `LIMITES.md`. Corrections : masque `setfacl`, `usermod -aG` / `gpasswd` / `adduser`, `no aaa new-model`, `no … sticky <mac>` |
| 3 | `usermod` : seuls `-aG` et `-G … -a` gérés ; `gpasswd -a/-d` ; `adduser <u> <g>` (formats de sortie `adduser` et `gpasswd` à vérifier : clés AV `adduser-unsupported`, `gpasswd-unsupported`, `usermod-unsupported`) | Évite d'inventer le reste des options : tout autre usage est signalé, jamais ignoré en silence |
| 4 | Applets de commande Windows réelles non émulées : message « non gérée par le simulateur » au lieu de « n'est pas reconnu » (`ps-unsupported`, `win-unsupported-tool`) | « Un faux détail réaliste est pire qu'un détail absent » : dire qu'une applet réelle n'existe pas était faux. Coût : 12 applets à émuler un jour si le projet veut des réparations PowerShell |
| 5 | **Application de gestion (SRV-FIC) : proposition, non construite** | Nouvelle console (navigateur sur une page servie par IIS) → arbitrage du projet requis. Voir ci-dessous |

### Proposition : page web de « l'application de gestion » (à arbitrer — le porteur du projet a dit « arbitrage OK » le 29/10 à 10 h 30 ; **rien n'est codé tant que le projet ne l'a pas acté**)
- Une page `http://gestion.toulouse.local/` servie par SRV-FIC (IIS), page **originale** (aucune reprise d'un éditeur) : tableau de bord minimal (clients, factures) si la connexion à la base MariaDB de SRV-LNX réussit ; sinon, **page d'erreur calculée depuis la sonde existante** (SRV-FIC → SRV-LNX:3306, utilisateur `intranet`), jamais écrite en dur par scénario :
  - port fermé (`bind-address`) → erreur de connexion refusée ; pare-feu (UFW) → délai dépassé ; compte limité à un autre sous-réseau → « Access denied for user 'intranet'@'10.10.10.20' » (format MariaDB à vérifier).
- Réutilise le navigateur du simulateur : aucun nouvel émulateur de terminal. Les textes d'erreur du connecteur côté application (pile applicative) sont **à vérifier** : on affichera le message MariaDB brut, ce qui est exact, plutôt qu'une pile inventée.
- Compétences : `lamp`, `lx-secu`, `lx-services`, `diag`. Bénéfice : le ticket INC-xxxx « application de gestion » devient testable depuis un poste, comme dans la vraie vie, sans sonde cachée.
- Coût : une page + un module de rendu (≈ 1 demi-journée) et des tests ; risque : la page est un élément ajouté, pas une réplique de console réelle.

## Aide-mémoire des commandes livré (29/10/2026) — demande du porteur du projet, choix faits par Claude Code

Demande : « un moyen pour le joueur d'avoir la liste des commandes disponibles (cmd, PowerShell, Linux, Cisco…), on ne les connaît pas toujours par cœur ».

| # | Choix | Pourquoi / coût |
|---|---|---|
| 1 | Bouton **Aide-mémoire** dans chaque terminal ; liste **générée depuis les registres des émulateurs**, jamais écrite à côté | Ne peut pas annoncer une commande que le terminal ne sait pas faire. Coût : toute nouvelle commande doit recevoir sa description (le test échoue sinon) |
| 2 | Disponible **aussi en évaluation chronométrée** | Cohérent avec les mots de passe et le plan d'adressage ; un vrai technicien a `man`, Tab, `?`. **Arbitrage du porteur du projet (29/10, 10 h 30) : « garder »** — à acter par le projet ; si l'évaluation doit mesurer la mémoire des commandes, masquer le bouton dans ce mode (1 ligne) |
| 3 | Clic = insertion sans exécution ; exemples uniquement de syntaxe standard, **tous exécutés par un test** | Évite un exemple que le simulateur refuserait |
| 4 | `man` / `help` : « non géré par le simulateur » + renvoi vers l'aide-mémoire | Les pages de manuel réelles ne sont pas reproduites (contenu énorme, risque de détails faux) |
| 5 | Descriptions IOS en **anglais** (aide `?` du matériel), le reste en français | Fidélité à la console réelle, comme demandé par l'objectif n° 1 |

## Coffre-fort d'identifiants dans les terminaux (29/10/2026) — arbitrage du porteur du projet : « les 2 »

Question posée : bouton « clé » visible dans les terminaux, ou Ctrl + Espace seulement. Réponse : **les deux**.
- Un bouton **« Coffre »** (icône clé) apparaît en haut à droite du terminal (cmd, PowerShell, Linux, IOS) **uniquement quand le terminal attend un mot de passe** (saisie masquée) et que le coffre est actif (niveau 2 de progression). Clic = insère le mot de passe du coffre pour la session ; Ctrl + Espace fait la même chose. Le bouton disparaît hors invite de mot de passe.
- Coût : un élément d'interface de plus dans la barre du terminal (à côté de « Aide-mémoire »). Test : `tests/ui/progress.js` (3 contrôles).

## Balayage graphique des consoles Windows (29/10/2026, 2e séance) — choix faits par Claude Code

Demande du porteur du projet : **oui** à un balayage graphique complet des variantes Windows / AD / GPO. Réalisé : `tests/ui/gui-sweep-win.js` (+ `tests/ui/gui-recipes-win.js`), enregistré dans `tests/all.js`. Pour chaque panne des familles `ad_ dhcp_ dns_ fw_ gpo_ iis_ ipv4_ nic_ sh_ web_` et chaque variante distincte de correction (jusqu'à 4 par panne), chaque étape de correction est **rejouée par clics et saisies** dans la vraie console du bureau simulé (Services, Connexions réseau, DHCP, DNS, pare-feu, Gestionnaire IIS, Certificats, Utilisateurs et ordinateurs AD, GPMC et son éditeur, Domaines et approbations, Explorateur › Propriétés › Partage avancé / Sécurité, Date et heure, invite de commandes) ; la sonde de la panne doit ensuite repasser au vert (état « corrigé »).

**Résultat : 98 combinaisons, 96 réparées par les consoles, 0 à reprendre, 2 combinaisons en écart de contenu** : ce sont deux graines (11 et 101) de **la même** variante « canal » de `ad_secure_channel` — il n'y a **qu'un seul** écart de contenu, pas deux (voir point 4 du prompt). Les étapes « client » (renouveler le bail, vider le cache DNS, rouvrir la session, attendre) sont appliquées par le moteur : elles représentent un geste du joueur déjà couvert par les balayages au terminal. 4 étapes visent des équipements sans console Windows (routeur, commutateur, imprimante) : appliquées par le moteur, la réparation au terminal est prouvée par `cli-sweep-ios` / `cli-sweep-lx`.

| # | Défaut réel trouvé et corrigé | Correction |
|---|---|---|
| 1 | La fenêtre UAC refusait le compte administrateur local d'un poste du domaine (elle ne savait pas résoudre `tech` / `.\tech` comme le fait l'écran de connexion) | `P.uac` passe par la même résolution que l'ouverture de session |
| 2 | Console DHCP, options d'étendue : cliquer le **libellé** d'une option la cochait au lieu de la sélectionner | Libellé = sélection, case = activation |
| 3 | Moteur : un hôte dont le pare-feu bloque le port 53 bloquait aussi ses **propres** requêtes vers lui-même (fw_53 irréparable) | Le trafic vers ses propres adresses (bouclage) n'est jamais filtré par le pare-feu de l'hôte |
| 4 | GPMC : **plantage** (TypeError) quand on supprime le GPO affiché (ordre de liaison, GPO appliqué) | Retour au conteneur / à la liste après suppression |
| 5 | GPMC : le sélecteur d'objets n'acceptait pas « Utilisateurs authentifiés » → la correction standard (filtrage de sécurité, MS16-072) était impossible | Identités spéciales « Utilisateurs authentifiés » et « Tout le monde » acceptées dans ce sélecteur (GPMC seulement) |
| 6 | `gpo_link`, variante « délié » : un lien recréé dans la GPMC (ordre « dernier ») était jugé « contournement » car la racine comparait l'objet lien entier | La racine vérifie que le lien existe et est actif |
| 7 | Boîte « Sélectionner des utilisateurs… » : `BUILTIN\IIS_IUSRS`, `NT AUTHORITY\Système` saisis avec le préfixe étaient refusés | Préfixes acceptés (clé « à vérifier » `sec-principals-prefix` : comportement exact de la vraie boîte à confirmer par capture) |
| 8 | Contrôleur de domaine : `C:\Windows\SYSVOL\sysvol\<domaine>` absent de l'Explorateur (partage SYSVOL impossible à recréer par l'interface) | Dossiers standard `NTDS`, `SYSVOL\sysvol\<domaine>\Policies` et `\scripts` ajoutés au contrôleur |

**Écart de contenu à trancher (point 4 du prompt)** : `ad_secure_channel`, variante « canal » (`secureChannel = false`) : **aucune console ni commande ne la répare**. La solution annoncée cite `Test-ComputerSecureChannel -Repair`, `Reset-ComputerMachinePassword` ou la sortie / rejointe du domaine : aucune n'existe dans le simulateur (`netdom` est volontairement « non géré », et n'existe pas sur un poste client sans RSAT). Le test `faults` ne l'a pas vu parce qu'il applique l'étape de correction du moteur, pas un geste du joueur — c'est exactement ce que ce balayage sert à détecter. Options : (A) émuler `Test-ComputerSecureChannel -Repair -Credential` avec `Get-Credential` (chemin canonique, ≈ 1 journée : variables PSCredential, invite d'identifiants) ; (B) émuler la sortie et la rejointe du domaine dans « Propriétés système » (+ redémarrage) ; (C) retirer la variante « canal » en attendant. **Recommandation : (A)** pour la fidélité au métier, avec (C) en attendant. Le balayage la signale explicitement (`~ écart connu`) au lieu de la masquer.

Coût / limites : les recettes dépendent du DOM (libellés, classes) : un changement de libellé d'une console casse le balayage, ce qui est voulu (il signale une dérive) ; la durée du balayage est d'environ 8 minutes. Le commentaire et l'option d'énumération basée sur l'accès d'un partage ne sont pas dans l'interface simulée : l'étape qui les porte est jouée sans eux (la sonde ne les teste pas).

## Réponses du porteur du projet du 29/10/2026 au soir (à acter par le projet)

Quatre questions posées par Claude Code, quatre réponses « Recommandé » :

1. **Règle « GUI d'abord » et Linux / SQL / Cisco** : l'interface la plus graphique **disponible** est le terminal pour ces trois familles ; la règle vise Windows et pfSense. L'application de gestion (D-103) est donc conforme à la règle.
2. **Pannes proxy** : les 17 pannes `px_*` non prouvées réparables par l'interface pfSense sont traitées **avant** l'application de gestion (estimation 1 à 2 jours).
3. **Comptes locaux sur les contrôleurs de domaine** : à retirer (ouverture de session et UAC d'un DC passent par les comptes du domaine). Clé `uac-local-admin` à instruire ; coût : revoir les pannes qui s'appuient sur un compte local d'un DC (à lister avant de modifier).
4. **`lx_nginx`, variante « certificat expiré »** : émuler `openssl x509 -dates` et `certbot` pour la rendre réparable au terminal. Les formats de sortie non établis restent « à vérifier » (D-13) ; aucune sortie plausible inventée.

Ordre de travail proposé : (a) rejeu de la batterie (en cours) ; (b) comptes DC ; (c) `lx_nginx` ; (d) pannes proxy en balayage graphique pfSense ; (e) audit des codes d'erreur ; (f) application de gestion.

## Coût de l'exclusion des pannes non prouvées de l'évaluation chronométrée (consigne de suite, travail 1.4) — chiffrage seulement, rien d'écrit

*Proposition de Claude Code, à arbitrer par le porteur du projet et à acter par le projet (D-108 point 2). Aucune ligne de code n'a été écrite pour cela.*

- **Population concernée** : 18 pannes « non prouvées par l'interface » (17 `px` + `multi_vitrine`), soit 10 % des 179. Par niveau (1 / 2 / 3 / 4) : 4 / 7 / 4 / 3 sur 22 / 66 / 69 / 22 pannes. Aucun niveau n'est vidé.
- **Option 1 — une liste** (`SIM.UNPROVEN_FAULTS`, un fichier de contenu comme `09-retired.js`) **et un filtre de mode** appliqué aux trois endroits où l'on construit un tirage : `Game.create` (pools de niveau, `80-game.js` lignes 42 et 137) et `F.bundleCandidates` (`75-combo.js`). Le filtre ne s'active que si `mode.timed`. Coût : environ une demi-journée avec ses tests (liste vidée → les pannes reviennent en chronométré ; liste pleine → aucune tirée en chronométré, tous niveaux, y compris missions composées). Effet de bord : les pannes restent jouables en guidé et en libre, avec un avertissement possible au choix de la panne.
- **Option 2 — un champ par panne** (`proven: false`, dans la définition). Même filtre, mais la dette est portée par la panne : plus lisible pour un formateur, mais modifie 18 définitions de contenu.
- **Option 3 — ne rien exclure, afficher** « parcours non prouvé » dans le débrief. Aucun filtre, mais un joueur chronométré peut tomber sur une panne dont la réparabilité par l'interface n'est pas prouvée.
- **Ce que je recommande** : option 1, parce que la liste se vide d'un mot dès que le parcours existe, et qu'elle suit le motif déjà éprouvé de `RETIRED_VARIANTS`. À ne faire qu'après l'arbitrage.

## Conflit entre les réponses du porteur du projet (29/10 au soir) et la consigne de suite du projet

Les réponses « Recommandé » du porteur du projet (voir la section précédente) ont été données **après** la rédaction de la consigne de suite et la contredisent sur trois points. **Conduite tenue en attendant son arbitrage : la plus prudente de chaque paire.**

| Sujet | Réponse du porteur du projet | Consigne de suite | Conduite tenue |
|---|---|---|---|
| Comptes locaux des DC | Retirer | Ne pas retirer de mémoire (D-13), attendre la capture R-76 | **Rien retiré**, aucune nouvelle dépendance ajoutée |
| `lx_nginx` « expire » | Émuler `openssl` + `certbot` | Retirer maintenant (D-108) | **Retirée du tirage**, contenu conservé |
| Pannes proxy | Avant l'application de gestion | Après l'application et après la réponse n° 20 | **Application d'abord**, `px` non touché |

Note sur le premier point : l'absence de base de comptes locaux sur un contrôleur de domaine est un fait général de Windows Server, mais le comportement exact de `.\nom` à l'ouverture de session d'un DC dans l'interface et dans les messages n'est pas établi (clé `uac-local-admin`) : c'est ce qui justifie d'attendre la capture.


## Travail 4 de la consigne de suite — application de gestion de SRV-FIC (D-103) : livré

*Rapport de Claude Code. Rien ici n'est acté. Tests : `tests/ui/gestion-app.js` (parcours par l'interface, 7 causes, règle D-76, neutralisation D-70), enregistré dans `tests/all.js`.*

### 1. Ce qui est livré
- `http://gestion.toulouse.local/` : enregistrement DNS (CNAME vers `srv-fic.toulouse.local.`), site IIS « Gestion » (liaison par nom d'hôte, port 80), page servie par `src/engine/63-webapps.js`. Tableau de bord si la sonde SRV-FIC → SRV-LNX:3306 (compte `intranet`) passe, page d'erreur sinon. **Aucun code, aucune pile, aucun message MariaDB** dans la page ; texte identique pour toutes les causes. Horodatage de l'horloge simulée.
- **Les causes se réparent au terminal** (PuTTY → SRV-LNX), D-105 : aucune n'a de chemin graphique dans le jeu (Linux n'a pas de console graphique). C'est le cas « interface la plus graphique disponible » (attente n° 18) : elle est le terminal.

### 2. Pannes concernées et hôte de vérification (D-76)
Hôte exigé : **un poste client** (`PC-*`), observation `http:PC-*:http://gestion.toulouse.local*` ; elle n'est satisfaite que par une réponse 2xx. Tant qu'elle n'a pas eu lieu, la panne reste « réparée » (statut `fixed`), pas « résolue » : testé pour les 7 causes.

| Panne (niveau) | Variantes concernées | Gestes de réparation joués par le test |
|---|---|---|
| `lx_db_access` (3) | `bind`, `ufw`, `grant` (toutes) | `sed` sur `bind-address` + `systemctl restart mariadb` ; `ufw allow from 10.10.10.0/24 to any port 3306 proto tcp` ; `RENAME USER 'intranet'@'10.10.20.%' TO 'intranet'@'10.10.10.%'` + `FLUSH PRIVILEGES` |
| `lx_svc_stopped` (1) | `mariadb`, `mariadb-dis` (2 des 6) ; les 4 autres (`ssh`, `apache2`, `nginx`, `bind9`) gardent leur vérification d'origine | `systemctl start mariadb` (+ `enable` pour `mariadb-dis`) |
| `lx_disk_full` (3) | `log`, `dump` (toutes) | `truncate -s 0 …intranet_error.log` ou `rm …vieux-dump-2024.tar.gz`, puis `systemctl start mariadb` |

**La sonde de diagnostic `ping` n'est pas la vérification** : une panne qui ne casse pas le ping n'est jamais fermée par lui.

**Description de vérification (D-71) : elle n'existe pas dans le code**, pour aucune panne (aucun champ par panne ; la clôture exige une observation, pas un texte). Proposition de texte, **à faire acter** avant tout champ : « Ouvrir l'application de gestion depuis un poste client et constater l'affichage du tableau de bord. » (identique pour les 7 causes, elle ne nomme ni la couche ni la commande). Le champ sera créé au travail 5, qui en a besoin pour les quatre pannes silencieuses : je ne crée pas un champ pour un seul cas.

### 3. Compétences, contre le référentiel
Source disponible dans mon dépôt : `src/content/00-skills.js` (identifiants du jeu, libellés de la **fiche v21 du 27/10**). **Non établi : la fiche v21 elle-même n'est pas versée au projet** ; la fiche v13 qui y est versée **ne contient aucune ligne Linux** (ni service, ni LAMP, ni UFW, ni stockage). Je ne peux donc pas contrôler ces rattachements contre le document ; je ne peux que dire ce que le jeu déclare :

| Panne | Compétences déclarées | Ligne de fiche (selon `00-skills.js`) |
|---|---|---|
| `lx_db_access` | `lamp`, `lx-secu`, `lx-services`, `diag` | « LAMP / serveur web » ; « Sécurité Linux » ; « Gestion des services » ; « Habitudes de méthode » (v13 : « Isoler chaque couche du diagnostic », 🟢) |
| `lx_svc_stopped` | `lx-services`, `diag` | « Gestion des services » ; « Habitudes de méthode » |
| `lx_disk_full` | `lx-stockage`, `lamp`, `lx-services`, `diag` | « Stockage — partitions » ; « LAMP / serveur web » ; « Gestion des services » ; « Habitudes de méthode » |

Ces trois pannes existaient avant la page ; **la page ne leur en ajoute aucune**. Elle utilise en amont `dns` et `iis` (lignes « DNS — zones, enregistrements A/PTR » et « IIS — sites, bindings, hébergement », 🟢 en v13) sans les déclarer sur ces pannes. **Question pour le projet** : faut-il les ajouter à `lx_db_access` ? Non fait : le périmètre ne s'élargit pas de mon propre chef. **Pour contrôler : verser la fiche v21.**

### 4. Parcours et neutralisation
- **Un parcours par cause** (7) : ouvrir la page, voir l'erreur, se connecter en SSH, réparer, constater que la panne n'est pas encore résolue, rouvrir, voir le tableau de bord, ticket clos « résolu ». Plus : la page d'erreur est **identique** pour les 7 causes (hors horodatage).
- **Neutralisation (D-70)** : monde sain sans aucune panne → tableau de bord ; on arrête MariaDB **directement dans le monde** (sans passer par une panne) → la page d'erreur apparaît ; on le redémarre → le tableau de bord revient. Si la page lisait un drapeau de scénario, ce test échouerait.

### 5. Effets constatés (à connaître)
1. **Deux pannes IIS existantes ont changé de symptôme** : `iis_binding` et `web_site_stopped` répondent maintenant HTTP 400 (« nom d'hôte non valide ») au lieu d'un refus de connexion, parce que le site « Gestion » occupe le port 80. Leur sonde et leurs textes sont réécrits ; le texte exact de la page 400 d'IIS reste « à vérifier ». **D-103 point 5 ne prévoyait pas ce changement** (il parlait de composabilité).
2. **Le tableau de bord est déclaré statique** dans `LIMITES.md` (non lié à la console SQL).
3. **Six pannes `snort` ont un ticket qui mentionne un ping de test** ; la règle D-90 (une vérification ne peut pas être uniquement un ping vers `pfsense-tls`) les touche : voir `REPONSE-PROJET-2026-10-29.md`. Sans rapport avec la page de gestion.

## Travail 7 de la consigne de suite — barème (D-109) : invariant livré, trois réponses, un écart trouvé

*Propositions et constats de Claude Code, 29/10/2026 au soir. Rien n'est acté ici.*

### 1. L'invariant « un chemin déclaré ne coûte aucun malus » existe et vire au rouge

- **Où il joue** : les trois balayages qui rejouent les corrections déclarées du catalogue contrôlent maintenant, en plus du statut final, les malus de danger et d'impact de la **vraie mission** : `tests/cli-sweep-lx.js` (85 combinaisons), `tests/cli-sweep-ios.js` (72), `tests/ui/gui-sweep-win.js` (96). Le contrôle est la règle du jeu elle-même (`Game.scanDanger` pour les dangers, tags d'impact sauf `needsReboot`) appliquée à chaque action du terminal (`tests/term.js`, `T.guard`) ; côté graphique il lit `Mission.dangers` et `Mission.impacts`.
- **Neutralisations (D-70)**, toutes dans `tests/sweep-coverage.js` et `tests/ui/gui-sweep-neutral.js` : `lx_fstab` privée de `needsReboot` → les 3 variantes virent au rouge (« malus sur un chemin déclaré : impact reboot ») ; un impact injecté dans la vraie mission pendant le balayage graphique → rouge.
- **Mesure à ce jour** : 0 malus sur les 253 combinaisons balayées (Linux 85, Cisco 72, graphique Windows 96) après les trois corrections ci-dessous ; résultat de la batterie complète dans `docs/JOURNAL-CODE.md` §8.
- **L'invariant a trouvé trois violations réelles dans le catalogue, toutes corrigées** (première exécution du balayage graphique avec le contrôle) : (1) `fw_profile` — la **recette** jouait « Arrêter » puis « Démarrer » sur NlaSvc au lieu de « Redémarrer » (impact −4) ; recette corrigée, le contenu de la panne n'a pas changé ; (2) `gpo_order` et (3) `gpo_enforced` — le chemin déclaré **supprime la GPO fautive que la panne a créée**, et la règle `ad-delete` le punissait (−15). Correction : champ `okDanger` de la panne, désormais capable d'une exemption **limitée à un élément** (`{ id: 'ad-delete', match: 'gpos[GPO5]' }`) : supprimer *une autre* GPO (le piège « modifier GPO_Fond_Ecran ») reste dangereux ; `tests/game.js` le prouve avec neutralisation. **Question de fond pour le projet** : un joueur qui fait « Arrêter » puis « Démarrer » à la main (au lieu de « Redémarrer ») perd 4 points, alors que le résultat est identique. D-109 ne distingue pas ; je ne l'ai pas tranché.
- **Ce que l'invariant ne couvre pas** : les pannes qui ne se réparent ni au terminal Linux/IOS ni dans une console Windows balayée (pfSense, baie, composées). Elles ne sont pas contrôlées. Ce n'est pas une preuve sur « tout le catalogue » : c'est une preuve sur ce que les balayages rejouent.

### 2. Écart trouvé en le construisant — à connaître, à arbitrer

**Avant cette séance, le terminal Linux n'émettait aucun tag d'impact.** `reboot`, `poweroff` et `systemctl stop <service>` y étaient gratuits ; Windows (cmd, PowerShell, interfaces) et IOS (`reload`) émettaient déjà. Conséquence : le test de neutralisation de `lx_fstab` ne pouvait pas virer au rouge au niveau du terminal (le test de `tests/game.js` qui montrait le −4 de `lx_fstab` injecte l'événement à la main ; je ne peux pas dire quel chemin réel l'émettait pour Linux, et je ne l'ai pas retrouvé), et l'invariant était vide pour Linux.

Ce que j'ai fait, **sans l'avoir attendu du projet** (je le dis pour que tu puisses le défaire) : le terminal Linux émet maintenant `svc-stop` (`systemctl stop`, `systemctl disable --now`), `reboot` et `poweroff`, exactement les tags de D-109 point 2 (« tag par l'interface ou le terminal »), pas d'autre. `restart`, `reload`, `start` n'en émettent pas. `tests/lx-impact.js` joue le vrai terminal dans une vraie mission. **Effet sur le jeu** : un joueur qui redémarre ou éteint un serveur Linux, ou arrête un service, perd 4 points par action (plafond 20), sauf si la panne exige un redémarrage. **Pour défaire** : retirer `r.impact = …` aux quatre endroits de `src/emu/21-bash-sys.js` (cherche « D-109 » dans `src/emu/20-bash.js` pour la propagation).

**Point à arbitrer** : `systemctl stop` d'un service comme première étape d'un diagnostic propre (arrêter pour relancer) est puni de la même façon que sous Windows. Le barème de D-79 ne distingue pas. Si le projet veut distinguer « arrêt puis redémarrage dans la même session », c'est une règle nouvelle (non écrite).

### 3. Réponses aux trois questions

**(a) Le garde-fou de niveau 1 (blocage avec avertissement, D-40, D-42) : il n'existe pas.**
Aucune trace dans le code : ni dans `Game.LEVELS` (champs `id, level, label, faults, pool, need, desc`), ni dans les terminaux, ni dans les interfaces. Aucune action n'est bloquée ni précédée d'un avertissement de la couche jeu, à aucun niveau. Les seules confirmations sont celles **des consoles elles-mêmes** (invites de confirmation PowerShell, boîtes « Voulez-vous vraiment redémarrer ? »), qui existent parce que les vrais outils les posent, pas par pédagogie. Les actions dangereuses sont **détectées après coup** (états avant/après, règles `Game.DANGER`) et pénalisées (−15, plafond −50), jamais empêchées.

**(b) L'écart au temps cible en points** — formule du code, `Mission._finish` :
`pénalité = min(25, arrondi(25 × (t − cible) / (1,5 × cible)))` si `t > cible`, sinon 0. Elle atteint donc 25 à 2,5 × la cible. **Le temps seul ne fait jamais échouer** : 100 − 25 = 75 = seuil de validation (commentaire du code, `Game.PASS`).
**Arrondi à 30 s** : il ne s'applique pas à la pénalité mais à la **cible** : `cible = clamp(360 s ; 1200 s ; arrondi_30s((120 + 110 × nombre d'étapes du chemin optimal)))` pour une panne ; pour plusieurs causes : somme des cibles × 0,85, arrondie à 30 s. La limite du mode chronométré est `arrondi(1,5 × cible)` à la seconde, **sans** arrondi à 30 s. D'où viennent ces constantes (120, 110, 360, 1200, 0,85, 1,5) : **non établi** — ce sont mes choix, aucun document du projet que je puisse citer ne les fixe.

**(c) Les plafonds 60 et 40 du non résolu** : valeurs de `Game.PARTIAL_TIMEOUT` et `Game.PARTIAL_GIVEUP`, choisies par moi. La seule contrainte que j'ai appliquée est celle du commentaire du code : un ticket non résolu doit rester **sous le seuil de validation (75)**, au prorata des causes réparées (`plafond × réparées / total`). Pourquoi 60 plutôt que 70, et 40 plutôt que 50 : **non établi**, pas de source. Le 60 (temps écoulé) est supérieur au 40 (abandon) parce que j'ai jugé qu'abandonner est pire que manquer de temps. Rien d'autre.

### 4. Le ping de PCEXT
Classé `detour`, 0 point : **rien à changer**, vérifié par `tests/game.js` (section D-90, avec neutralisation).

## Travail 3 de la consigne de suite — codes d'erreur (D-106) : mécanisme livré, cas limite IOS, écarts à trancher

*Propositions et constats de Claude Code, 29/10/2026 au soir. Je ne vérifie aucun code : le projet vérifie (D-106).*

### 1. Ce qui est livré
- **Registre** `src/content/09-codes.js` : 92 entrées (15 lignes de journal IOS, 16 HRESULT/NTSTATUS, 33 noms symboliques (dont les 13 doublés avec le préfixe `NET::` du navigateur), 12 MariaDB, 6 statuts HTTP, 10 Event ID). **Statut de départ : « non-verifie » pour tout, sauf trois masqués** : Event ID 1046 et 1063 (`Microsoft-Windows-DHCP-Server`) et 1502 (`Microsoft-Windows-GroupPolicy`), les trois que le retour du 29/10 a déclarés tenus de ma mémoire. Aucun code n'est « verifie ». Les sources exactes (clés) : `evt:Microsoft-Windows-DHCP-Server:1046`, `…:1063`, `evt:Microsoft-Windows-GroupPolicy:1502`.
- **Interrupteur unique** : `SIM.CODES_STRICT` (dans `09-codes.js`). Vrai : seuls les « verifie » sortent. Faux (état actuel) : tout sort sauf les « masque ». La mesure se défait en changeant `status`.
- **Point d'émission** `src/engine/01-codes.js` : terminaux (`E.L`), boîtes de dialogue (`40-wm.js`), pages du navigateur (`70-app-browser.js`), journaux d'événements (`60-app-svc-evt.js`, PowerShell `Get-WinEvent`/`Get-EventLog`).
- **Audit** `tests/codes-audit.js` (mécanisme, balayage statique du source, neutralisation) **plus** un contrôle dans `tests/load.js` : tout test Node qui fait sortir un code absent du registre échoue (neutralisation : le test d'audit en injecte un).
- **Inventaire** `docs/CODES-ERREUR.md`, généré par `tests/codes-inventory.js` : une ligne par code, avec statut, extrait du texte qui l'accompagne, fichier source, émissions vues à l'exécution (19 codes sur 92 ont été vus par la batterie instrumentée, le reste n'est écrit que dans le source), pannes dont le contenu cite le code, origine (« mémoire de l'auteur, aucune source »).

### 2. Cas limite : les lignes de journal IOS (`%EC-5-…`)
Proposition de Claude Code, à arbitrer :
| Option | Ce qu'on affiche tant que la ligne n'est pas vérifiée | Coût |
|---|---|---|
| **A (mon choix actuel)** | La ligne telle qu'elle est, **non masquée** (famille exclue du masquage, `NEVER_MASKED` dans `01-codes.js`) | Le joueur voit un identifiant cherchable non vérifié ; écart de fidélité possible si le format ou le niveau (chiffre) est faux |
| B | Rien : la ligne n'est pas émise | Les terminaux Cisco n'ont plus de journal ; la pédagogie « lire le journal pour comprendre » disparaît pour EtherChannel, STP, OSPF ; certaines pannes silencieuses n'ont plus de trace du tout |
| C | Le texte seul, sans identifiant (« Interface Gi0/1, changed state to down »), pas la forme `%FAC-n-MNEM:` | **Je ne propose pas C** : fabriquer un texte sans identifiant est inventer une sortie que le vrai IOS n'a pas (D-13) |

**Recommandation** : A en attendant les captures de `SESSION-VM-V21-RESEAU.md`, avec la liste ci-dessus comme périmètre de vérification. B appauvrit le jeu sans rien garantir.
Même raisonnement pour les statuts HTTP (famille exclue du masquage) : ce sont des codes RFC, pas des codes de pile.

### 3. Écarts à trancher par le projet
1. **Les textes de contenu ne passent pas par le point d'émission.** L'Event ID 1046 est masqué dans le journal DHCP-Server, mais la cause et le chemin optimal de `dhcp_unauth` et `dhcp_unauth_bdx` disent « événement 1046 » (débrief). Un joueur qui lit le débrief apprend un numéro que le journal ne lui a jamais montré. Options : (i) passer ces textes par `SIM.codes.text` — mais elle ne reconnaît que les familles listées, pas « événement 1046 » nu, il faudrait une règle de plus ; (ii) retirer le numéro de ces deux textes à la main ; (iii) laisser (le débrief est la couche jeu, pas une console).
2. **Valeurs que le mécanisme ne sait pas reconnaître** : `0x25` et `0x18` dans « Code d'échec » des événements 4771, champs « Statut » / « Sous-statut » de 4625. Ce sont des codes affichés hors des familles du motif. À traiter avec le projet (étendre le motif ou les inscrire à la main).
3. **L'inventaire par exécution est partiel** : 19 codes vus sur 92. La batterie ne fait pas sortir `0x80070005` ou `ERROR 1045`, par exemple. L'inventaire statique les couvre, mais la colonne « pannes qui le provoquent » est **la liste des pannes dont le contenu cite le code**, pas celle qui le fait afficher. Une exécution panne par panne (travail non fait) la complèterait.
4. **Les sources** : je n'ai consulté aucune source officielle ; je ne propose pas d'URL de peur d'en inventer. Le projet les cherche.

## Travail 5 de la consigne de suite — pannes silencieuses : ce qui est livré, une proposition générale

*Propositions et constats de Claude Code, 29/10/2026 au soir.*

### Livré
- Pour `ec_negotiation`, `ec_group_missing`, `ec_member_mismatch`, `stp_root_moved` (et, parce qu'elles avaient le même défaut, `ospf_timers` et `ospf_routerid_dup`) : une **description de vérification** qui nomme le geste sans nommer la cause ni la commande (affichée dans le ticket, « Pour clôturer : »), une **vérification explicite par lecture d'état** (observation `show:<appareil>:<sujet>` émise par les commandes `show`), et un **motif de refus de clôture** (`closeNote`) montré au joueur au moment du refus ET dans le débrief (« Pourquoi la clôture a été refusée »).
- **Un parcours par panne** (`tests/ios-parcours.js`), avec ses neutralisations : voir `JOURNAL-CODE.md` §1 ter pour le détail et les cinq pannes qui restent sans parcours.

### Corrections de mes affirmations antérieures
- D-93 disait qu'`ec_negotiation` avait un parcours (`tests/ui/colomiers-map.js`) : **inexact**, c'est un test de la carte. Aucune des quatre n'en avait.
- `ospf_routerid_dup` et `ospf_timers` ne pouvaient pas être résolues par le joueur dans le jeu (vérification par ping, destination toujours joignable par l'autre sens de l'anneau). Le balayage terminal ne le voyait pas parce qu'il lit le statut « réparée », pas « résolue ». **C'est le même motif que D-102** : un balayage qui s'arrête à « réparée » ne prouve pas que le ticket peut être clos.

### Proposition générale (à arbitrer)
**173 pannes sur 179 n'ont pas de description de vérification.** La clôture de ces pannes exige une observation depuis l'hôte requis (D-76), mais le ticket ne dit pas laquelle. Je propose de **dériver** un texte par défaut du type d'observation de la vérification par défaut (`F.defaultVerify`) : par exemple, pour une sonde `ping` : « constater depuis le poste de l'utilisateur que la ressource est de nouveau joignable » ; pour une vérification par page : « ouvrir la page depuis le poste ». Avantage : aucune de ces 173 pannes n'est à réécrire à la main. Risque : un texte dérivé est générique, et peut être trop proche de la commande. À arbitrer par le projet ; une description écrite panne par panne (D-71) l'emporte toujours sur la dérivée.


## Arbitrages du porteur du projet du 30/10/2026 — appliqués par Claude Code, à acter par le projet

*Sept réponses du porteur du projet, données dans la conversation avec Claude Code. Rien n'est acté tant que `DECISIONS.md` ne les reprend pas. Pour chacune : ce qui a été fait, où, et la phrase que le projet peut recopier.*

| # | Question | Réponse du porteur | Fait par Claude Code |
|---|---|---|---|
| 1 | n° 20 : les 21 pannes `px` | **Garder et balayer maintenant** | Le travail 9 (balayage graphique pfSense des 17 pannes `px` non prouvées) est **débloqué côté porteur** ; il n'est pas commencé dans cette séance. Le projet doit acter la réponse n° 20 |
| 2 | Pannes non prouvées en évaluation chronométrée | **Les exclure** (option 1 de « Coût de l'exclusion… ») | Fait : `src/content/09-unproven.js` (`SIM.UNPROVEN_FAULTS`, 18 pannes : 17 `px` + `multi_vitrine`), filtre dans `Game.pick` et dans l'assemblage des missions composées quand le mode est chronométré, `tests/unproven-timed.js` (neutralisation : liste vidée → elles reviennent). Une panne **choisie explicitement** (`faultId`, formateur) reste servie : c'est un choix délibéré, pas un tirage |
| 3 | Barème : arrêt de service Linux / Windows | **Règle par le résultat** (après la question « pourquoi `restart` serait plus propre que `stop` ou `reboot` ? ») | Fait, voir ci-dessous |
| 4 | Plafonds du non résolu (60 / 40) et pénalité de temps | **Les fixer définitivement** | Valeurs inchangées dans le code (`Game.PARTIAL_TIMEOUT = 60`, `Game.PARTIAL_GIVEUP = 40`, `Game.TIME_MAX = 25`, cible = 120 s + 110 s × étapes bornée 360–1200 s). **Le projet doit les écrire dans D-79 comme décision ferme** : elles n'ont toujours aucune source, c'est un arbitrage du porteur |
| 5 | Journal Cisco (`%EC-5-…`) non vérifié | **L'afficher tel quel** (option A) | Rien à changer : c'est l'état actuel (`NEVER_MASKED`). Reste une dette de fidélité : 15 lignes à vérifier avec les captures R-77 |
| 6 | Textes de débrief citant « événement 1046 » | **Retirer le numéro à la main** | Fait dans `dhcp_unauth` et `dhcp_unauth_bdx` (cause et chemin optimal). Nouveau contrôle dans `tests/codes-audit.js` : aucun texte de panne ne cite un Event ID **masqué** au registre (1046, 1063, 1502), avec neutralisation. Le numéro revient quand le projet l'aura vérifié |
| 7 | n° 18 (interface la plus graphique *disponible* pour Linux, SQL, Cisco) | « Recommandé » (déjà donné le 29/10 au soir) | Rien à changer |

### Détail du point 3 — la règle d'impact « par le résultat »

**Texte à écrire dans D-79 (proposition)** : *un arrêt de service coûte 4 points tant que le service reste arrêté ; si le joueur relance le même service (stop puis start, ou stop puis restart), l'impact est retiré. Un redémarrage ou une extinction de machine (`reboot`, `poweroff`, arrêt depuis l'interface) coûte 4 points et n'est jamais remboursé, sauf si la panne exige un redémarrage (`needsReboot`). Plafond inchangé : 20.*

**Mise en œuvre** : `Mission.act` (`src/engine/80-game.js`). L'impact `svc-stop` garde les clés d'état des services que l'action a fait passer de « démarré » à « arrêté » (différence d'état, Windows `…/win/svc/X/state`, Linux `…/svc/X/state`). Dès qu'une action suivante remet **tous** ces services en marche, l'entrée est retirée du compte et gardée dans `refundedImpacts` (visible au débrief). Une action tagguée `svc-stop` dont l'état final est identique à l'état initial (`net stop x && net start x` sur une ligne) ne compte pas.

**Ce qui n'a pas changé** : `restart` reste gratuit ; le nombre de points ; le plafond ; la détection des actions *dangereuses* (voir « Point ouvert » ci-dessous).

**Un défaut trouvé en l'écrivant (même famille que celui du terminal Linux du 29/10)** : le shell `cmd` de Windows **perdait** les tags d'impact. `net stop`, `sc stop`, `shutdown /r` et `netsh interface … disable` posaient le tag, mais `WinShell.run` ne recopiait pas `impact` ni `danger` dans le résultat de la ligne : ces actions étaient **gratuites en `cmd`**, alors que la même action coûtait 4 points en PowerShell ou dans la console Services. Corrigé dans `src/emu/10-winshell.js` (la ligne, et le pipeline). **Effet sur le jeu** : à partir de cette version, `net stop <service>` et `shutdown /r` au `cmd` coûtent 4 points, comme dans D-79. Pour défaire : retirer les deux lignes `if (r.impact …) …` de `WinShell.run` et du pipeline.

**Tests** : `tests/impact-net.js` (Linux, `cmd`, PowerShell, console Services ; stop seul, stop+start, stop+restart, deux cycles, autre service, autre poste, reboot jamais remboursé, note finale), `tests/lx-impact.js` (inchangé, passe).

**Point ouvert (à trancher par le projet)** : la règle *dangereuse* `svc-stop` (D-79 : arrêter DHCP, DNS, NTDS, Netlogon, Kdc, W32Time, gpsvc, LanmanServer, mpssvc ou EventLog = −15) n'est **pas** remboursée par un redémarrage : un joueur qui fait `net stop dhcp` puis `net start dhcp` paie 15 points, alors qu'il ne paie plus rien pour un service banal. C'est incohérent avec la règle par le résultat, mais c'est une règle de **danger** (D-79 point 1), pas d'**impact** : je n'y ai pas touché. Deux options : (a) garder (arrêter un service de domaine est risqué même brièvement, et le chemin sûr est `restart`) ; (b) étendre le remboursement aux dangers `svc-stop`. Je recommande (a) tant qu'aucune panne déclarée n'oblige à passer par un `stop` seul (le balayage D-109 le contrôle).

### Ce qui reste à faire (sans changement)
Travail 9 (balayage `px`) : prêt à partir dès que le projet a acté la réponse n° 20. Variante « canal », HSRP, Hyper-V : non commencés.
