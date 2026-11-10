# Rapport de tests

_Généré par `node tests/all.js` — 2026-11-10 10:37 UTC · durée 2628 s_

**Résultat : 117 / 117 réussis.**

Critères : code retour 0, aucune erreur JS de page (`PAGEERR`/`CONSOLE`), aucun `TypeError`/`ReferenceError`/`✗` dans la sortie, motif attendu présent quand défini.

## Moteur

| Test | Résultat | Durée |
|---|---|---|
| `assert-world (identité, adressage, DNS, terminaux)` | OK | 0.3 s |
| `regress (bugs déjà corrigés)` | OK | 0.5 s |
| `retired (variantes retirées du jeu : jamais tirées, contenu conservé, neutralisation)` | OK | 16.9 s |
| `win-unsupported (D-99 Windows : commandes réelles sûres de leur existence → « non gérée par le simulateur », un contrôle par commande + neutralisation)` | OK | 0.2 s |
| `ios-noeffect (D-99/D-111 : avis « sans effet dans le simulateur » quand il est vrai, absent quand il serait faux)` | OK | 0.5 s |
| `ios-parcours (D-66/D-93 : pannes de redondance et OSPF, du ticket à la clôture par les terminaux ; clôture sur ping refusée avec motif ; neutralisation)` | OK | 8.9 s |
| `lx-impact (D-109 : le terminal Linux marque reboot / poweroff / arrêt de service ; needsReboot neutralisé)` | OK | 0.9 s |
| `impact-net (règle par le résultat : stop puis start du même service = 0 ; reboot jamais remboursé ; Linux, cmd, PowerShell, interface)` | OK | 2.6 s |
| `unproven-timed (pannes non prouvées par l’interface : jamais tirées en chronométré, tirées en guidé / libre ; liste vidée → reviennent)` | OK | 108.7 s |
| `codes-audit (D-106 : registre des codes d’erreur, masquage, audit statique + exécution, neutralisation)` | OK | 0.1 s |
| `build-guard (livrable autonome : toute ressource externe arrête la construction ; neutralisation)` | OK | 0.2 s |
| `faults` | OK | 49.7 s |
| `validate` | OK | 51.1 s |
| `game` | OK | 4.6 s |
| `campaign (chapitres, périmètre, tirage, examen, déblocage, révision espacée ; campagne jouée en entier)` | OK | 18.6 s |
| `rewards (récompenses de niveau : piste, contrats en XP seulement, outils coupés en évaluation et en examen, second avis, cosmétiques, prestige)` | OK | 1.5 s |
| `report (fiche d’intervention : une fiche bien formée par panne, barème, plancher au seuil, mode guidé)` | OK | 21.8 s |
| `scoring (note /100, seuil 75, étoiles, temps cible par panne, niveaux 1/1/2/3/4 pannes)` | OK | 18.4 s |
| `combo (pannes composées + niveaux Admin 2 / Cyber 3 / Chaos 4)` | OK | 52.6 s |
| `course-links (liens de révision : table statique, hôte fixe)` | OK | 0.1 s |
| `lint-content (complétude, gabarits, couverture)` | OK | 0.1 s |
| `cli-parity (pannes réparables au terminal : net share, SMB, IIS)` | OK | 0.9 s |
| `ps-confirm (invites de confirmation PowerShell : SMB, carte réseau)` | OK | 0.4 s |
| `personas --quick (apprenants simulés : 0 anomalie, déterminisme)` | OK | 234.4 s |
| `progress (niveaux, XP, arbre, série, ticket du jour, objectifs, maîtrise, profils hostiles)` | OK | 1.0 s |
| `boot` | OK | 0.2 s |
| `web` | OK | 0.2 s |
| `ad` | OK | 0.3 s |
| `ssh` | OK | 0.2 s |
| `addressing (plan d’adressage attendu : cohérent avec le monde sain, IP uniques, bails DHCP)` | OK | 0.3 s |

## Sécurité

| Test | Résultat | Durée |
|---|---|---|
| `fuzz-term (entrées hostiles sur 6 terminaux)` | OK | 0.7 s |
| `security-ui (prototype, HTML hostile, import, CSP)` | OK | 1.1 s |
| `profile-corrupt (stockage navigateur corrompu ou hostile)` | OK | 7.0 s |

## Émulateurs

| Test | Résultat | Durée |
|---|---|---|
| `emu-win` | OK | 0.3 s |
| `emu-ps` | OK | 0.2 s |
| `emu-lx` | OK | 0.2 s |
| `emu-ssh` | OK | 0.1 s |
| `emu-ios` | OK | 0.2 s |
| `ios-edge` | OK | 0.1 s |
| `term` | OK | 0.0 s |
| `ios-fixes` | OK | 4.0 s |
| `l2-cli (EtherChannel / Spanning Tree)` | OK | 0.2 s |
| `cmdhelp (aide-mémoire : index issu des registres réels, descriptions complètes, chaque exemple exécuté sans « commande introuvable »)` | OK | 5.6 s |
| `lx-groups (usermod / gpasswd / adduser, masque ACL de setfacl)` | OK | 0.3 s |
| `sql-cli (console MariaDB : comptes, GRANT, réparation de lx_db_access)` | OK | 0.2 s |

## Réparation au terminal

| Test | Résultat | Durée |
|---|---|---|
| `cli-sweep-lx (pannes Linux × variantes réparées avec de vraies commandes : nano, chmod, systemctl, ufw, setfacl, mysql…)` | OK | 10.6 s |
| `cli-sweep-ios (pannes Cisco × variantes réparées en configuration IOS, différence show running-config)` | OK | 18.1 s |
| `sweep-coverage (neutralisation des balayages terminal : couverture retirée, recette cassée → rouge)` | OK | 95.5 s |
| `audit-win-cli (commandes réelles Windows : émulées, signalées ou absentes à tort)` | OK | 0.2 s |

## Interface

| Test | Résultat | Durée |
|---|---|---|
| `smoke-all` | OK | 113.7 s |
| `regress-ui (modale au-dessus du bureau)` | OK | 3.1 s |
| `sweep (toutes les pannes × 2 graines, 3 modes)` | OK | 145.5 s |
| `home-tour` | OK | 13.8 s |
| `rewards-ui (piste, apparence, contrats, voyants de liaison, ping rapide, historique, second avis, paliers d’astreinte, prestige, #legacy)` | OK | 15.2 s |
| `campaign-ui (accueil à trois entrées, chantier, carte du périmètre, fiche d’intervention, examen, déblocage, #legacy)` | OK | 43.8 s |
| `themes-debrief (accueil, 8 thèmes, animations du 100, débrief, liens de cours)` | OK | 24.1 s |
| `scenario-import` | OK | 5.5 s |
| `dhcp-auth` | OK | 4.4 s |
| `progress-ui (carrière, arbre, coffre-fort, carnet, débrief XP, ticket du jour, sauvegarde)` | OK | 22.7 s |
| `infra (identifiants copiables, plan d’adressage, copie presse-papiers, mode évaluation)` | OK | 4.2 s |
| `cmdhelp-ui (bouton Aide-mémoire : cmd, PowerShell, Linux, IOS ; recherche ; insertion sans exécution)` | OK | 7.6 s |
| `home-tour 1280×720` | OK | 13.7 s |
| `themes-debrief 1280×720` | OK | 24.1 s |
| `home-tour 1024×768` | OK | 13.9 s |
| `themes-debrief 1024×768` | OK | 24.0 s |

## Réparation graphique

| Test | Résultat | Durée |
|---|---|---|
| `gui-sweep-neutral (neutralisation : recette non jouée → le balayage graphique vire au rouge)` | OK | 9.8 s |
| `gestion-app (D-103 : application de gestion de SRV-FIC, un parcours par cause + neutralisation)` | OK | 95.6 s |
| `gui-sweep-win (pannes Windows / AD / GPO / DHCP / DNS / IIS / partages × variantes réparées par clics dans les vraies consoles)` | OK | 462.6 s |

## Consoles Windows

| Test | Résultat | Durée |
|---|---|---|
| `win1` | OK | 1.4 s |
| `win2` | OK | 1.8 s |
| `win3` | OK | 3.8 s |
| `win4` | OK | 2.2 s |
| `win5` | OK | 4.6 s |
| `win6` | OK | 6.9 s |
| `win7` | OK | 5.6 s |
| `win8` | OK | 6.0 s |
| `win9` | OK | 6.3 s |
| `win10` | OK | 3.4 s |
| `win11` | OK | 7.3 s |

## Réseau

| Test | Résultat | Durée |
|---|---|---|
| `net1` | OK | 43.7 s |
| `net2` | OK | 6.7 s |
| `colomiers-map (carte du site, panne EtherChannel)` | OK | 1.7 s |

## Baie / physique

| Test | Résultat | Durée |
|---|---|---|
| `rig1` | OK | 1.8 s |
| `rig3` | OK | 4.9 s |
| `rig4` | OK | 2.5 s |
| `rig-sites (câble débranché à Bordeaux et à Ramonville : réparé par la vue physique)` | OK | 4.2 s |
| `rig2:phys_eth` | OK | 11.7 s |
| `rig2:phys_power` | OK | 11.6 s |
| `rig2:phys_screen` | OK | 11.6 s |
| `rig2:phys_mon` | OK | 11.6 s |
| `rig2:phys_source` | OK | 11.9 s |
| `rig2:phys_wall` | OK | 12.3 s |
| `rig2:phys_patch` | OK | 15.9 s |

## pfSense

| Test | Résultat | Durée |
|---|---|---|
| `pfw1` | OK | 6.3 s |
| `pfw3` | OK | 9.0 s |
| `proxy (pages Squid / squidGuard / Options Internet)` | OK | 17.3 s |
| `proxy-faults (réparations par l’interface)` | OK | 30.1 s |
| `snort-faults (réparations par l’interface Snort)` | OK | 133.1 s |
| `pfw2:pf_lan_norule` | OK | 7.5 s |
| `pfw2:pf_dmz_rule` | OK | 6.7 s |
| `pfw2:pf_dmz_alias` | OK | 6.8 s |
| `pfw2:pf_nat_outbound` | OK | 8.2 s |
| `pfw2:pf_portfwd` | OK | 6.9 s |
| `pfw2:pf_gateway` | OK | 6.8 s |
| `pfw2:pf_static_route` | OK | 7.4 s |
| `pfw2:pf_ipsec_p1` | OK | 6.9 s |
| `pfw2:pf_ipsec_p2` | OK | 6.8 s |
| `pfw2:pf_ipsec_rules` | OK | 7.4 s |
| `pfw2:vpn_wanrule` | OK | 7.4 s |
| `pfw2:vpn_access` | OK | 7.4 s |
| `pfw2:vpn_routes` | OK | 6.1 s |
| `pfw2:vpn_connect` | OK | 6.0 s |

## Singe (aléatoire)

| Test | Résultat | Durée |
|---|---|---|
| `monkey graine 1 1440×900` | OK | 53.6 s |
| `monkey graine 2 1280×720` | OK | 54.4 s |
| `monkey graine 3 1920×1080` | OK | 102.5 s |
| `monkey graine 4 1024×768` | OK | 65.8 s |
| `monkey graine 5 1440×900` | OK | 67.6 s |

## Ce que la batterie ne couvre pas

- Le test « singe » est aléatoire (graines fixes, donc rejouable) : il détecte les erreurs JS, pas les incohérences de contenu.
- Les sorties de commandes et Event ID marqués « à vérifier » (`docs/A-VERIFIER.md`) ne peuvent pas être validés automatiquement : ils attendent des captures de référence.
- Aucun test de rendu pixel : la fidélité visuelle se juge à l’œil face aux captures.
