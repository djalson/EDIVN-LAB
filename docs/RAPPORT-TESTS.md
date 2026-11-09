# Rapport de tests

_Généré par `node tests/all.js` — 2026-10-30 11:57 UTC · durée 3068 s_

**Résultat : 111 / 111 réussis.**

Critères : code retour 0, aucune erreur JS de page (`PAGEERR`/`CONSOLE`), aucun `TypeError`/`ReferenceError`/`✗` dans la sortie, motif attendu présent quand défini.

## Moteur

| Test | Résultat | Durée |
|---|---|---|
| `assert-world (identité, adressage, DNS, terminaux)` | OK | 0.5 s |
| `regress (bugs déjà corrigés)` | OK | 0.8 s |
| `retired (variantes retirées du jeu : jamais tirées, contenu conservé, neutralisation)` | OK | 31.6 s |
| `win-unsupported (D-99 Windows : commandes réelles sûres de leur existence → « non gérée par le simulateur », un contrôle par commande + neutralisation)` | OK | 0.2 s |
| `ios-noeffect (D-99/D-111 : avis « sans effet dans le simulateur » quand il est vrai, absent quand il serait faux)` | OK | 0.8 s |
| `ios-parcours (D-66/D-93 : pannes de redondance et OSPF, du ticket à la clôture par les terminaux ; clôture sur ping refusée avec motif ; neutralisation)` | OK | 14.6 s |
| `lx-impact (D-109 : le terminal Linux marque reboot / poweroff / arrêt de service ; needsReboot neutralisé)` | OK | 1.4 s |
| `impact-net (règle par le résultat : stop puis start du même service = 0 ; reboot jamais remboursé ; Linux, cmd, PowerShell, interface)` | OK | 4.0 s |
| `unproven-timed (pannes non prouvées par l’interface : jamais tirées en chronométré, tirées en guidé / libre ; liste vidée → reviennent)` | OK | 193.7 s |
| `codes-audit (D-106 : registre des codes d’erreur, masquage, audit statique + exécution, neutralisation)` | OK | 0.1 s |
| `build-guard (livrable autonome : toute ressource externe arrête la construction ; neutralisation)` | OK | 0.4 s |
| `faults` | OK | 77.6 s |
| `validate` | OK | 82.2 s |
| `game` | OK | 5.3 s |
| `scoring (note /100, seuil 75, étoiles, temps cible par panne, niveaux 1/1/2/3/4 pannes)` | OK | 23.3 s |
| `combo (pannes composées + niveaux Admin 2 / Cyber 3 / Chaos 4)` | OK | 101.5 s |
| `course-links (liens de révision : table statique, hôte fixe)` | OK | 0.1 s |
| `lint-content (complétude, gabarits, couverture)` | OK | 0.1 s |
| `cli-parity (pannes réparables au terminal : net share, SMB, IIS)` | OK | 1.4 s |
| `ps-confirm (invites de confirmation PowerShell : SMB, carte réseau)` | OK | 0.6 s |
| `personas --quick (apprenants simulés : 0 anomalie, déterminisme)` | OK | 382.1 s |
| `progress (niveaux, XP, arbre, série, ticket du jour, objectifs, maîtrise, profils hostiles)` | OK | 1.6 s |
| `boot` | OK | 0.3 s |
| `web` | OK | 0.3 s |
| `ad` | OK | 0.5 s |
| `ssh` | OK | 0.3 s |
| `addressing (plan d’adressage attendu : cohérent avec le monde sain, IP uniques, bails DHCP)` | OK | 0.5 s |

## Sécurité

| Test | Résultat | Durée |
|---|---|---|
| `fuzz-term (entrées hostiles sur 6 terminaux)` | OK | 1.1 s |
| `security-ui (prototype, HTML hostile, import, CSP)` | OK | 1.5 s |
| `profile-corrupt (stockage navigateur corrompu ou hostile)` | OK | 8.1 s |

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
| `ios-fixes` | OK | 6.5 s |
| `l2-cli (EtherChannel / Spanning Tree)` | OK | 0.3 s |
| `cmdhelp (aide-mémoire : index issu des registres réels, descriptions complètes, chaque exemple exécuté sans « commande introuvable »)` | OK | 8.9 s |
| `lx-groups (usermod / gpasswd / adduser, masque ACL de setfacl)` | OK | 0.4 s |
| `sql-cli (console MariaDB : comptes, GRANT, réparation de lx_db_access)` | OK | 0.3 s |

## Réparation au terminal

| Test | Résultat | Durée |
|---|---|---|
| `cli-sweep-lx (pannes Linux × variantes réparées avec de vraies commandes : nano, chmod, systemctl, ufw, setfacl, mysql…)` | OK | 17.3 s |
| `cli-sweep-ios (pannes Cisco × variantes réparées en configuration IOS, différence show running-config)` | OK | 30.3 s |
| `sweep-coverage (neutralisation des balayages terminal : couverture retirée, recette cassée → rouge)` | OK | 157.1 s |
| `audit-win-cli (commandes réelles Windows : émulées, signalées ou absentes à tort)` | OK | 0.3 s |

## Interface

| Test | Résultat | Durée |
|---|---|---|
| `smoke-all` | OK | 120.0 s |
| `regress-ui (modale au-dessus du bureau)` | OK | 3.6 s |
| `sweep (toutes les pannes × 2 graines, 3 modes)` | OK | 151.8 s |
| `home-tour` | OK | 15.2 s |
| `themes-debrief (accueil, 8 thèmes, animations du 100, débrief, liens de cours)` | OK | 24.7 s |
| `scenario-import` | OK | 6.1 s |
| `dhcp-auth` | OK | 4.8 s |
| `progress-ui (carrière, arbre, coffre-fort, carnet, débrief XP, ticket du jour, sauvegarde)` | OK | 24.1 s |
| `infra (identifiants copiables, plan d’adressage, copie presse-papiers, mode évaluation)` | OK | 4.9 s |
| `cmdhelp-ui (bouton Aide-mémoire : cmd, PowerShell, Linux, IOS ; recherche ; insertion sans exécution)` | OK | 8.2 s |
| `home-tour 1280×720` | OK | 14.8 s |
| `themes-debrief 1280×720` | OK | 24.8 s |
| `home-tour 1024×768` | OK | 14.5 s |
| `themes-debrief 1024×768` | OK | 24.8 s |

## Réparation graphique

| Test | Résultat | Durée |
|---|---|---|
| `gui-sweep-neutral (neutralisation : recette non jouée → le balayage graphique vire au rouge)` | OK | 10.9 s |
| `gestion-app (D-103 : application de gestion de SRV-FIC, un parcours par cause + neutralisation)` | OK | 99.8 s |
| `gui-sweep-win (pannes Windows / AD / GPO / DHCP / DNS / IIS / partages × variantes réparées par clics dans les vraies consoles)` | OK | 458.8 s |

## Consoles Windows

| Test | Résultat | Durée |
|---|---|---|
| `win1` | OK | 1.7 s |
| `win2` | OK | 2.3 s |
| `win3` | OK | 4.2 s |
| `win4` | OK | 2.6 s |
| `win5` | OK | 4.9 s |
| `win6` | OK | 7.6 s |
| `win7` | OK | 6.2 s |
| `win8` | OK | 6.5 s |
| `win9` | OK | 6.9 s |
| `win10` | OK | 3.8 s |
| `win11` | OK | 7.9 s |

## Réseau

| Test | Résultat | Durée |
|---|---|---|
| `net1` | OK | 47.2 s |
| `net2` | OK | 7.3 s |
| `colomiers-map (carte du site, panne EtherChannel)` | OK | 1.9 s |

## Baie / physique

| Test | Résultat | Durée |
|---|---|---|
| `rig1` | OK | 2.2 s |
| `rig3` | OK | 5.4 s |
| `rig4` | OK | 3.0 s |
| `rig2:phys_eth` | OK | 12.3 s |
| `rig2:phys_power` | OK | 12.1 s |
| `rig2:phys_screen` | OK | 12.1 s |
| `rig2:phys_mon` | OK | 12.1 s |
| `rig2:phys_source` | OK | 12.2 s |
| `rig2:phys_wall` | OK | 12.9 s |
| `rig2:phys_patch` | OK | 16.4 s |

## pfSense

| Test | Résultat | Durée |
|---|---|---|
| `pfw1` | OK | 7.0 s |
| `pfw3` | OK | 9.5 s |
| `proxy (pages Squid / squidGuard / Options Internet)` | OK | 18.2 s |
| `proxy-faults (réparations par l’interface)` | OK | 31.6 s |
| `snort-faults (réparations par l’interface Snort)` | OK | 139.5 s |
| `pfw2:pf_lan_norule` | OK | 7.8 s |
| `pfw2:pf_dmz_rule` | OK | 7.2 s |
| `pfw2:pf_dmz_alias` | OK | 7.3 s |
| `pfw2:pf_nat_outbound` | OK | 8.6 s |
| `pfw2:pf_portfwd` | OK | 7.2 s |
| `pfw2:pf_gateway` | OK | 7.2 s |
| `pfw2:pf_static_route` | OK | 7.9 s |
| `pfw2:pf_ipsec_p1` | OK | 7.2 s |
| `pfw2:pf_ipsec_p2` | OK | 7.4 s |
| `pfw2:pf_ipsec_rules` | OK | 8.0 s |
| `pfw2:vpn_wanrule` | OK | 8.2 s |
| `pfw2:vpn_access` | OK | 8.0 s |
| `pfw2:vpn_routes` | OK | 6.6 s |
| `pfw2:vpn_connect` | OK | 6.5 s |

## Singe (aléatoire)

| Test | Résultat | Durée |
|---|---|---|
| `monkey graine 1 1440×900` | OK | 58.9 s |
| `monkey graine 2 1280×720` | OK | 60.4 s |
| `monkey graine 3 1920×1080` | OK | 110.6 s |
| `monkey graine 4 1024×768` | OK | 71.8 s |
| `monkey graine 5 1440×900` | OK | 72.8 s |

## Ce que la batterie ne couvre pas

- Le test « singe » est aléatoire (graines fixes, donc rejouable) : il détecte les erreurs JS, pas les incohérences de contenu.
- Les sorties de commandes et Event ID marqués « à vérifier » (`docs/A-VERIFIER.md`) ne peuvent pas être validés automatiquement : ils attendent des captures de référence.
- Aucun test de rendu pixel : la fidélité visuelle se juge à l’œil face aux captures.
