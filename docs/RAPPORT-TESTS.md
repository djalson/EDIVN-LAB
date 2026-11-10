# Rapport de tests

_Généré par `node tests/all.js` — 2026-11-10 00:34 UTC · durée 2724 s_

**Résultat : 114 / 114 réussis.**

Critères : code retour 0, aucune erreur JS de page (`PAGEERR`/`CONSOLE`), aucun `TypeError`/`ReferenceError`/`✗` dans la sortie, motif attendu présent quand défini.

## Moteur

| Test | Résultat | Durée |
|---|---|---|
| `assert-world (identité, adressage, DNS, terminaux)` | OK | 0.3 s |
| `regress (bugs déjà corrigés)` | OK | 0.6 s |
| `retired (variantes retirées du jeu : jamais tirées, contenu conservé, neutralisation)` | OK | 22.2 s |
| `win-unsupported (D-99 Windows : commandes réelles sûres de leur existence → « non gérée par le simulateur », un contrôle par commande + neutralisation)` | OK | 0.2 s |
| `ios-noeffect (D-99/D-111 : avis « sans effet dans le simulateur » quand il est vrai, absent quand il serait faux)` | OK | 0.5 s |
| `ios-parcours (D-66/D-93 : pannes de redondance et OSPF, du ticket à la clôture par les terminaux ; clôture sur ping refusée avec motif ; neutralisation)` | OK | 10.3 s |
| `lx-impact (D-109 : le terminal Linux marque reboot / poweroff / arrêt de service ; needsReboot neutralisé)` | OK | 1.0 s |
| `impact-net (règle par le résultat : stop puis start du même service = 0 ; reboot jamais remboursé ; Linux, cmd, PowerShell, interface)` | OK | 2.8 s |
| `unproven-timed (pannes non prouvées par l’interface : jamais tirées en chronométré, tirées en guidé / libre ; liste vidée → reviennent)` | OK | 129.5 s |
| `codes-audit (D-106 : registre des codes d’erreur, masquage, audit statique + exécution, neutralisation)` | OK | 0.1 s |
| `build-guard (livrable autonome : toute ressource externe arrête la construction ; neutralisation)` | OK | 0.2 s |
| `faults` | OK | 56.4 s |
| `validate` | OK | 56.7 s |
| `game` | OK | 4.2 s |
| `campaign (chapitres, périmètre, tirage, examen, déblocage, révision espacée ; campagne jouée en entier)` | OK | 21.7 s |
| `report (fiche d’intervention : une fiche bien formée par panne, barème, plancher au seuil, mode guidé)` | OK | 24.6 s |
| `scoring (note /100, seuil 75, étoiles, temps cible par panne, niveaux 1/1/2/3/4 pannes)` | OK | 17.0 s |
| `combo (pannes composées + niveaux Admin 2 / Cyber 3 / Chaos 4)` | OK | 68.2 s |
| `course-links (liens de révision : table statique, hôte fixe)` | OK | 0.1 s |
| `lint-content (complétude, gabarits, couverture)` | OK | 0.1 s |
| `cli-parity (pannes réparables au terminal : net share, SMB, IIS)` | OK | 1.1 s |
| `ps-confirm (invites de confirmation PowerShell : SMB, carte réseau)` | OK | 0.5 s |
| `personas --quick (apprenants simulés : 0 anomalie, déterminisme)` | OK | 267.7 s |
| `progress (niveaux, XP, arbre, série, ticket du jour, objectifs, maîtrise, profils hostiles)` | OK | 0.9 s |
| `boot` | OK | 0.2 s |
| `web` | OK | 0.2 s |
| `ad` | OK | 0.3 s |
| `ssh` | OK | 0.2 s |
| `addressing (plan d’adressage attendu : cohérent avec le monde sain, IP uniques, bails DHCP)` | OK | 0.3 s |

## Sécurité

| Test | Résultat | Durée |
|---|---|---|
| `fuzz-term (entrées hostiles sur 6 terminaux)` | OK | 0.8 s |
| `security-ui (prototype, HTML hostile, import, CSP)` | OK | 1.3 s |
| `profile-corrupt (stockage navigateur corrompu ou hostile)` | OK | 7.3 s |

## Émulateurs

| Test | Résultat | Durée |
|---|---|---|
| `emu-win` | OK | 0.3 s |
| `emu-ps` | OK | 0.2 s |
| `emu-lx` | OK | 0.2 s |
| `emu-ssh` | OK | 0.2 s |
| `emu-ios` | OK | 0.2 s |
| `ios-edge` | OK | 0.2 s |
| `term` | OK | 0.0 s |
| `ios-fixes` | OK | 4.4 s |
| `l2-cli (EtherChannel / Spanning Tree)` | OK | 0.2 s |
| `cmdhelp (aide-mémoire : index issu des registres réels, descriptions complètes, chaque exemple exécuté sans « commande introuvable »)` | OK | 6.4 s |
| `lx-groups (usermod / gpasswd / adduser, masque ACL de setfacl)` | OK | 0.3 s |
| `sql-cli (console MariaDB : comptes, GRANT, réparation de lx_db_access)` | OK | 0.2 s |

## Réparation au terminal

| Test | Résultat | Durée |
|---|---|---|
| `cli-sweep-lx (pannes Linux × variantes réparées avec de vraies commandes : nano, chmod, systemctl, ufw, setfacl, mysql…)` | OK | 12.2 s |
| `cli-sweep-ios (pannes Cisco × variantes réparées en configuration IOS, différence show running-config)` | OK | 20.6 s |
| `sweep-coverage (neutralisation des balayages terminal : couverture retirée, recette cassée → rouge)` | OK | 109.8 s |
| `audit-win-cli (commandes réelles Windows : émulées, signalées ou absentes à tort)` | OK | 0.3 s |

## Interface

| Test | Résultat | Durée |
|---|---|---|
| `smoke-all` | OK | 115.2 s |
| `regress-ui (modale au-dessus du bureau)` | OK | 3.3 s |
| `sweep (toutes les pannes × 2 graines, 3 modes)` | OK | 147.6 s |
| `home-tour` | OK | 14.2 s |
| `campaign-ui (accueil à trois entrées, chantier, carte du périmètre, fiche d’intervention, examen, déblocage, #legacy)` | OK | 44.0 s |
| `themes-debrief (accueil, 8 thèmes, animations du 100, débrief, liens de cours)` | OK | 24.3 s |
| `scenario-import` | OK | 5.5 s |
| `dhcp-auth` | OK | 4.5 s |
| `progress-ui (carrière, arbre, coffre-fort, carnet, débrief XP, ticket du jour, sauvegarde)` | OK | 23.1 s |
| `infra (identifiants copiables, plan d’adressage, copie presse-papiers, mode évaluation)` | OK | 4.5 s |
| `cmdhelp-ui (bouton Aide-mémoire : cmd, PowerShell, Linux, IOS ; recherche ; insertion sans exécution)` | OK | 7.8 s |
| `home-tour 1280×720` | OK | 14.1 s |
| `themes-debrief 1280×720` | OK | 24.4 s |
| `home-tour 1024×768` | OK | 14.0 s |
| `themes-debrief 1024×768` | OK | 24.2 s |

## Réparation graphique

| Test | Résultat | Durée |
|---|---|---|
| `gui-sweep-neutral (neutralisation : recette non jouée → le balayage graphique vire au rouge)` | OK | 10.2 s |
| `gestion-app (D-103 : application de gestion de SRV-FIC, un parcours par cause + neutralisation)` | OK | 97.0 s |
| `gui-sweep-win (pannes Windows / AD / GPO / DHCP / DNS / IIS / partages × variantes réparées par clics dans les vraies consoles)` | OK | 444.9 s |

## Consoles Windows

| Test | Résultat | Durée |
|---|---|---|
| `win1` | OK | 1.4 s |
| `win2` | OK | 1.9 s |
| `win3` | OK | 3.8 s |
| `win4` | OK | 2.3 s |
| `win5` | OK | 4.7 s |
| `win6` | OK | 7.1 s |
| `win7` | OK | 5.7 s |
| `win8` | OK | 6.1 s |
| `win9` | OK | 6.3 s |
| `win10` | OK | 3.4 s |
| `win11` | OK | 7.4 s |

## Réseau

| Test | Résultat | Durée |
|---|---|---|
| `net1` | OK | 44.5 s |
| `net2` | OK | 6.9 s |
| `colomiers-map (carte du site, panne EtherChannel)` | OK | 1.7 s |

## Baie / physique

| Test | Résultat | Durée |
|---|---|---|
| `rig1` | OK | 2.0 s |
| `rig3` | OK | 5.1 s |
| `rig4` | OK | 2.6 s |
| `rig2:phys_eth` | OK | 11.8 s |
| `rig2:phys_power` | OK | 11.8 s |
| `rig2:phys_screen` | OK | 11.7 s |
| `rig2:phys_mon` | OK | 11.8 s |
| `rig2:phys_source` | OK | 12.0 s |
| `rig2:phys_wall` | OK | 12.5 s |
| `rig2:phys_patch` | OK | 16.0 s |

## pfSense

| Test | Résultat | Durée |
|---|---|---|
| `pfw1` | OK | 6.5 s |
| `pfw3` | OK | 9.1 s |
| `proxy (pages Squid / squidGuard / Options Internet)` | OK | 17.7 s |
| `proxy-faults (réparations par l’interface)` | OK | 30.7 s |
| `snort-faults (réparations par l’interface Snort)` | OK | 135.4 s |
| `pfw2:pf_lan_norule` | OK | 7.6 s |
| `pfw2:pf_dmz_rule` | OK | 6.8 s |
| `pfw2:pf_dmz_alias` | OK | 7.0 s |
| `pfw2:pf_nat_outbound` | OK | 8.3 s |
| `pfw2:pf_portfwd` | OK | 7.0 s |
| `pfw2:pf_gateway` | OK | 6.9 s |
| `pfw2:pf_static_route` | OK | 7.6 s |
| `pfw2:pf_ipsec_p1` | OK | 7.0 s |
| `pfw2:pf_ipsec_p2` | OK | 6.9 s |
| `pfw2:pf_ipsec_rules` | OK | 7.7 s |
| `pfw2:vpn_wanrule` | OK | 7.6 s |
| `pfw2:vpn_access` | OK | 7.7 s |
| `pfw2:vpn_routes` | OK | 6.2 s |
| `pfw2:vpn_connect` | OK | 6.2 s |

## Singe (aléatoire)

| Test | Résultat | Durée |
|---|---|---|
| `monkey graine 1 1440×900` | OK | 55.2 s |
| `monkey graine 2 1280×720` | OK | 55.1 s |
| `monkey graine 3 1920×1080` | OK | 103.7 s |
| `monkey graine 4 1024×768` | OK | 66.2 s |
| `monkey graine 5 1440×900` | OK | 67.8 s |

## Ce que la batterie ne couvre pas

- Le test « singe » est aléatoire (graines fixes, donc rejouable) : il détecte les erreurs JS, pas les incohérences de contenu.
- Les sorties de commandes et Event ID marqués « à vérifier » (`docs/A-VERIFIER.md`) ne peuvent pas être validés automatiquement : ils attendent des captures de référence.
- Aucun test de rendu pixel : la fidélité visuelle se juge à l’œil face aux captures.
