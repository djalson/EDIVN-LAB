# Rapport de tests

_Généré par `node tests/all.js` — 2026-11-13 11:31 UTC · durée 2009 s_

**Résultat : 135 / 135 réussis.**

Critères : code retour 0, aucune erreur JS de page (`PAGEERR`/`CONSOLE`), aucun `TypeError`/`ReferenceError`/`✗` dans la sortie, motif attendu présent quand défini.

## Moteur

| Test | Résultat | Durée |
|---|---|---|
| `assert-world (identité, adressage, DNS, terminaux)` | OK | 0.7 s |
| `regress (bugs déjà corrigés)` | OK | 1.0 s |
| `retired (variantes retirées du jeu : jamais tirées, contenu conservé, neutralisation)` | OK | 31.2 s |
| `win-unsupported (D-99 Windows : commandes réelles sûres de leur existence → « non gérée par le simulateur », un contrôle par commande + neutralisation)` | OK | 0.4 s |
| `ios-noeffect (D-99/D-111 : avis « sans effet dans le simulateur » quand il est vrai, absent quand il serait faux)` | OK | 0.8 s |
| `ios-parcours (D-66/D-93 : pannes de redondance et OSPF, du ticket à la clôture par les terminaux ; clôture sur ping refusée avec motif ; neutralisation)` | OK | 13.6 s |
| `lx-impact (D-109 : le terminal Linux marque reboot / poweroff / arrêt de service ; needsReboot neutralisé)` | OK | 1.5 s |
| `impact-net (règle par le résultat : stop puis start du même service = 0 ; reboot jamais remboursé ; Linux, cmd, PowerShell, interface)` | OK | 3.6 s |
| `invariants (toutes pannes × variantes : pas d’auto-réparation, un écran affiché ne clôture rien, ticket signé par le bon utilisateur, session fermée sur une panne de connexion)` | OK | 102.2 s |
| `hints-commands (les commandes citées dans les indices et solutions existent dans le simulateur)` | OK | 2.5 s |
| `calendar (dates et heures du jeu : toutes les pannes se comportent pareil à une autre date)` | OK | 146.9 s |
| `events (événements en partie : fréquence, panne ajoutée obligatoire et réparable, QCM du téléphone, échéance du responsable)` | OK | 37.3 s |
| `personas-text (personnalités : le ton change, aucun élément technique du ticket n’est perdu)` | OK | 0.5 s |
| `exams (examens : série fixe de tickets différents par chapitre, suivant / refaire le même, badge à 100 %)` | OK | 87.8 s |
| `dns-cache-ttl (cache DNS client : TTL de l’enregistrement ; dns_cache ne se répare plus tout seul)` | OK | 3.1 s |
| `unproven-timed (panne irréparable retirée de tous les tirages ; pannes proxy revenues en chronométré ; liste vidée → revient)` | OK | 124.0 s |
| `codes-audit (D-106 : registre des codes d’erreur, masquage, audit statique + exécution, neutralisation)` | OK | 0.2 s |
| `build-guard (livrable autonome : toute ressource externe arrête la construction ; neutralisation)` | OK | 0.4 s |
| `faults` | OK | 74.6 s |
| `validate` | OK | 79.0 s |
| `game` | OK | 5.6 s |
| `campaign (chapitres, périmètre, tirage, examen, déblocage, révision espacée ; campagne jouée en entier)` | OK | 29.8 s |
| `rewards (récompenses de niveau : piste, contrats en XP seulement, outils coupés en évaluation et en examen, second avis, cosmétiques, prestige)` | OK | 2.5 s |
| `report (fiche d’intervention : une fiche bien formée par panne, barème, plancher au seuil, mode guidé)` | OK | 32.3 s |
| `scoring (note /100, seuil 75, étoiles, temps cible par panne, niveaux 1/1/2/3/4 pannes)` | OK | 28.0 s |
| `combo (pannes composées + niveaux Admin 2 / Cyber 3 / Chaos 4)` | OK | 98.4 s |
| `course-links (liens de révision : table statique, hôte fixe)` | OK | 0.1 s |
| `lint-content (complétude, gabarits, couverture)` | OK | 0.1 s |
| `cli-parity (pannes réparables au terminal : net share, SMB, IIS)` | OK | 1.5 s |
| `ps-confirm (invites de confirmation PowerShell : SMB, carte réseau)` | OK | 0.7 s |
| `personas --quick (apprenants simulés : 0 anomalie, déterminisme)` | OK | 335.6 s |
| `progress (niveaux, XP, arbre, série, ticket du jour, objectifs, maîtrise, profils hostiles)` | OK | 1.5 s |
| `boot` | OK | 0.3 s |
| `web` | OK | 0.3 s |
| `ad` | OK | 0.5 s |
| `ssh` | OK | 0.3 s |
| `addressing (plan d’adressage attendu : cohérent avec le monde sain, IP uniques, bails DHCP)` | OK | 0.5 s |

## Sécurité

| Test | Résultat | Durée |
|---|---|---|
| `fuzz-term (entrées hostiles sur 6 terminaux)` | OK | 1.2 s |
| `security-ui (prototype, HTML hostile, import, CSP)` | OK | 1.6 s |
| `profile-corrupt (stockage navigateur corrompu ou hostile)` | OK | 8.6 s |

## Émulateurs

| Test | Résultat | Durée |
|---|---|---|
| `emu-win` | OK | 0.4 s |
| `emu-ps` | OK | 0.3 s |
| `emu-lx` | OK | 0.2 s |
| `emu-ssh` | OK | 0.2 s |
| `emu-ios` | OK | 0.2 s |
| `ios-edge` | OK | 0.2 s |
| `term` | OK | 0.0 s |
| `ios-fixes` | OK | 6.4 s |
| `l2-cli (EtherChannel / Spanning Tree)` | OK | 0.4 s |
| `cmdhelp (aide-mémoire : index issu des registres réels, descriptions complètes, chaque exemple exécuté sans « commande introuvable »)` | OK | 9.0 s |
| `lx-groups (usermod / gpasswd / adduser, masque ACL de setfacl)` | OK | 0.4 s |
| `sql-cli (console MariaDB : comptes, GRANT, réparation de lx_db_access)` | OK | 0.3 s |

## Réparation au terminal

| Test | Résultat | Durée |
|---|---|---|
| `cli-sweep-lx (pannes Linux × variantes réparées avec de vraies commandes : nano, chmod, systemctl, ufw, setfacl, mysql…)` | OK | 15.4 s |
| `cli-sweep-ios (pannes Cisco × variantes réparées en configuration IOS, différence show running-config)` | OK | 26.5 s |
| `sweep-coverage (neutralisation des balayages terminal : couverture retirée, recette cassée → rouge)` | OK | 137.9 s |
| `audit-win-cli (commandes réelles Windows : émulées, signalées ou absentes à tort)` | OK | 0.3 s |

## Interface

| Test | Résultat | Durée |
|---|---|---|
| `smoke-all` | OK | 123.2 s |
| `regress-ui (modale au-dessus du bureau)` | OK | 3.9 s |
| `hosts-edit (fichier hosts depuis une session standard : notepad <chemin> en console admin, explorateur, Exécuter en tant qu’administrateur)` | OK | 6.8 s |
| `mmc-nav (double-clic sur un dossier du volet central d’une console MMC ; pool DHCP et propriétés de l’étendue)` | OK | 6.0 s |
| `verify-strict (clôture prouvée par le test qui échouait : écran affiché ≠ preuve ; favoris Intranet / Google du navigateur)` | OK | 3.6 s |
| `resume (ticket interrompu par un rechargement : reprise proposée, chronomètre conservé)` | OK | 4.2 s |
| `events-ui (panneau Messages, téléphone et QCM, deuxième ticket, collègue, responsable)` | OK | 10.6 s |
| `challenge (défi entre élèves : même code = même incident ; panne mystère : un essai par jour)` | OK | 8.1 s |
| `desk-clicks (icônes du bureau cliquables, menus contextuels sous le pointeur, Ouvrir avec → Bloc-notes, redémarrage sans roue figée)` | OK | 10.0 s |
| `exams-ui (fenêtre d’examen : pastilles, Commencer, Refaire le même, Ticket suivant)` | OK | 2.4 s |
| `ui-audit (audit graphique : éléments recouverts, menus du clic droit, fenêtres, écrans bloqués, débordements, sur tous les écrans et toutes les applications)` | OK | 168.8 s |
| `bugreport (bouton « Bug ? » : rapport copiable, cause non affichée, données décodables)` | OK | 2.2 s |
| `sweep (toutes les pannes × 2 graines, 3 modes)` | OK | 161.9 s |
| `home-tour` | OK | 13.7 s |
| `rewards-ui (piste, apparence, contrats, voyants de liaison, ping rapide, historique, second avis, paliers d’astreinte, prestige, #legacy)` | OK | 17.9 s |
| `campaign-ui (accueil à trois entrées, chantier, carte du périmètre, fiche d’intervention, examen, déblocage, #legacy)` | OK | 47.9 s |
| `themes-debrief (accueil, 8 thèmes, animations du 100, débrief, liens de cours)` | OK | 24.7 s |
| `scenario-import` | OK | 6.0 s |
| `dhcp-auth` | OK | 4.9 s |
| `progress-ui (carrière, arbre, coffre-fort, carnet, débrief XP, ticket du jour, sauvegarde)` | OK | 24.8 s |
| `infra (identifiants copiables, plan d’adressage, copie presse-papiers, mode évaluation)` | OK | 6.0 s |
| `cmdhelp-ui (bouton Aide-mémoire : cmd, PowerShell, Linux, IOS ; recherche ; insertion sans exécution)` | OK | 8.5 s |
| `home-tour 1280×720` | OK | 13.8 s |
| `themes-debrief 1280×720` | OK | 25.1 s |
| `home-tour 1024×768` | OK | 14.0 s |
| `themes-debrief 1024×768` | OK | 24.8 s |

## Réparation graphique

| Test | Résultat | Durée |
|---|---|---|
| `gui-sweep-neutral (neutralisation : recette non jouée → le balayage graphique vire au rouge)` | OK | 10.8 s |
| `gestion-app (D-103 : application de gestion de SRV-FIC, un parcours par cause + neutralisation)` | OK | 99.4 s |
| `gui-sweep-win (pannes Windows / AD / GPO / DHCP / DNS / IIS / partages × variantes réparées par clics dans les vraies consoles)` | OK | 525.5 s |

## Consoles Windows

| Test | Résultat | Durée |
|---|---|---|
| `win1` | OK | 1.6 s |
| `win2` | OK | 2.1 s |
| `win3` | OK | 4.2 s |
| `win4` | OK | 2.6 s |
| `win5` | OK | 4.9 s |
| `win6` | OK | 7.4 s |
| `win7` | OK | 6.1 s |
| `win8` | OK | 6.4 s |
| `win9` | OK | 6.6 s |
| `win10` | OK | 3.7 s |
| `win11` | OK | 7.7 s |

## Réseau

| Test | Résultat | Durée |
|---|---|---|
| `net1` | OK | 46.5 s |
| `net2` | OK | 7.1 s |
| `colomiers-map (carte du site, panne EtherChannel)` | OK | 2.0 s |

## Baie / physique

| Test | Résultat | Durée |
|---|---|---|
| `rig1` | OK | 2.2 s |
| `rig3` | OK | 5.3 s |
| `rig4` | OK | 2.8 s |
| `rig-sites (câble débranché à Bordeaux et à Ramonville : réparé par la vue physique)` | OK | 4.8 s |
| `rig2:phys_eth` | OK | 12.1 s |
| `rig2:phys_power` | OK | 11.9 s |
| `rig2:phys_screen` | OK | 12.1 s |
| `rig2:phys_mon` | OK | 12.1 s |
| `rig2:phys_source` | OK | 12.3 s |
| `rig2:phys_wall` | OK | 12.8 s |
| `rig2:phys_patch` | OK | 16.3 s |

## pfSense

| Test | Résultat | Durée |
|---|---|---|
| `pfw1` | OK | 6.9 s |
| `pfw3` | OK | 9.4 s |
| `proxy (pages Squid / squidGuard / Options Internet)` | OK | 18.3 s |
| `proxy-sweep (17 pannes proxy × variantes réparées par clics dans l’interface pfSense et les Options Internet)` | OK | 266.3 s |
| `proxy-faults (réparations par l’interface)` | OK | 32.2 s |
| `snort-faults (réparations par l’interface Snort)` | OK | 141.5 s |
| `pfw2:pf_lan_norule` | OK | 8.1 s |
| `pfw2:pf_dmz_rule` | OK | 7.3 s |
| `pfw2:pf_dmz_alias` | OK | 7.4 s |
| `pfw2:pf_nat_outbound` | OK | 8.8 s |
| `pfw2:pf_portfwd` | OK | 7.5 s |
| `pfw2:pf_gateway` | OK | 7.4 s |
| `pfw2:pf_static_route` | OK | 7.9 s |
| `pfw2:pf_ipsec_p1` | OK | 7.4 s |
| `pfw2:pf_ipsec_p2` | OK | 7.4 s |
| `pfw2:pf_ipsec_rules` | OK | 8.1 s |
| `pfw2:vpn_wanrule` | OK | 8.0 s |
| `pfw2:vpn_access` | OK | 8.0 s |
| `pfw2:vpn_routes` | OK | 6.7 s |
| `pfw2:vpn_connect` | OK | 6.8 s |

## Singe (aléatoire)

| Test | Résultat | Durée |
|---|---|---|
| `monkey graine 1 1440×900` | OK | 58.4 s |
| `monkey graine 2 1280×720` | OK | 58.0 s |
| `monkey graine 3 1920×1080` | OK | 110.2 s |
| `monkey graine 4 1024×768` | OK | 70.9 s |
| `monkey graine 5 1440×900` | OK | 74.1 s |

## Ce que la batterie ne couvre pas

- Le test « singe » est aléatoire (graines fixes, donc rejouable) : il détecte les erreurs JS, pas les incohérences de contenu.
- Les sorties de commandes et Event ID marqués « à vérifier » (`docs/A-VERIFIER.md`) ne peuvent pas être validés automatiquement : ils attendent des captures de référence.
- Aucun test de rendu pixel : la fidélité visuelle se juge à l’œil face aux captures.
