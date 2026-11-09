# Essais par personas — série lourde sur le moteur de jeu

> Généré par `node tests/personas.js --quick` (graine 2026). 443 parties jouées à travers la vraie couche de jeu (missions, indices, clôture, score, débrief, profil), 137 s.

## Ce que cette série est (et n’est pas)

- Les « apprenants » sont des **modèles stochastiques écrits par nous** (aisance de départ, vitesse, appétence pour les indices, imprudence, abandon, apprentissage par compétence). Ils ne prouvent rien sur la pédagogie ni sur de vrais élèves.
- Ils servent à **stresser le moteur et le barème** : anomalies (exceptions, scores incohérents, non-déterminisme), pannes qui ne peuvent jamais être validées, effet des indices / dangers / clôtures prématurées sur la note, position du seuil de 75.
- Les parties passent par les corrections scriptées des pannes (comme `tests/faults.js`), pas par l’interface graphique ni le terminal : cela ne teste **pas** la jouabilité des consoles (couverte par les tests `tests/ui`).
- **La note est la vraie note /100 du jeu** (départ 100, moins indices, actions dangereuses, clôtures prématurées, durée au-delà du temps cible ; la durée seule ne peut pas descendre sous 75). Validé à partir de **75** : 1★ 75–84, 2★ 85–94, 3★ 95–99, 100 = Parfait. Ce n’est pas la grille de notation de la formation : le seuil est une décision (voir « Décisions »). Une série de « repassage » est jouée : après une note < 75, le même ticket est rejoué (3 essais maximum). **Admin = 2 pannes, Cyber = 3, Chaos = 4** par ticket.

## Archétypes

| Archétype | Individus | Aisance de départ | Vitesse (s / étape optimale) | Indices | Teste avant de clôturer | Raccourci dangereux | Contournement | Abandon |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Expert (habitué à 90–100) | 2 | 3.2 | 72 | 0 % | 99 % | 1 % | 2 % | 1 % |
| Solide (80–90) | 2 | 2.1 | 100 | 8 % | 95 % | 2 % | 5 % | 3 % |
| Limite (≈ 75, doit parfois repasser) | 2 | 1.25 | 110 | 30 % | 85 % | 5 % | 10 % | 6 % |
| Progressif (40–50 au départ, 75 à force d’essais) | 2 | -0.1 | 120 | 60 % | 70 % | 8 % | 18 % | 10 % |
| Méthodique mais lent | 2 | 2 | 150 | 5 % | 99 % | 1 % | 3 % | 2 % |
| Pressé / imprudent | 2 | 1.8 | 32 | 10 % | 40 % | 30 % | 40 % | 2 % |
| Décrocheur (abandonne quand bloqué) | 2 | 0.6 | 100 | 40 % | 70 % | 6 % | 15 % | 45 % |

## Résultats par archétype

| Archétype | Parties | Note moyenne | Note médiane | Validé du 1er coup | Validé en ≤ 3 essais | Jamais validé | Essais pour valider (moy.) | MTTR / cible | Indices / partie | Dangers / partie | Clôtures prématurées / partie | Abandons ou échéances |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Expert (habitué à 90–100) | 48 | 98.3 | 100.0 | 100 % | 100 % | 0 % | 1.0 | 0.6 | 0.0 | 0.0 | 0.3 | 0 % |
| Solide (80–90) | 54 | 90.1 | 99.5 | 90 % | 100 % | 0 % | 1.1 | 0.9 | 0.1 | 0.1 | 0.4 | 9 % |
| Limite (≈ 75, doit parfois repasser) | 63 | 81.2 | 98.5 | 75 % | 96 % | 4 % | 1.2 | 1.0 | 0.2 | 0.1 | 0.7 | 19 % |
| Progressif (40–50 au départ, 75 à force d’essais) | 76 | 71.3 | 89.0 | 67 % | 90 % | 10 % | 1.4 | 1.3 | 0.5 | 0.2 | 0.8 | 29 % |
| Méthodique mais lent | 49 | 90.8 | 93.0 | 98 % | 100 % | 0 % | 1.0 | 1.4 | 0.0 | 0.0 | 0.4 | 0 % |
| Pressé / imprudent | 77 | 63.9 | 80.0 | 58 % | 90 % | 10 % | 1.4 | 0.4 | 0.1 | 0.6 | 1.7 | 26 % |
| Décrocheur (abandonne quand bloqué) | 76 | 68.1 | 86.5 | 63 % | 94 % | 6 % | 1.5 | 1.1 | 0.3 | 0.1 | 0.8 | 33 % |

Les colonnes « Note » portent sur le **premier essai** de chaque ticket (le repassage fausserait la moyenne).

## Note moyenne au premier essai, par niveau

| Archétype | Junior | Confirmé | Admin | Cyber | Chaos |
|---|---:|---:|---:|---:|---:|
| Expert (habitué à 90–100) | 100.0 (100 %) | 100.0 (100 %) | 96.8 (100 %) | 98.3 (100 %) | 95.0 (100 %) |
| Solide (80–90) | 98.4 (100 %) | 97.0 (100 %) | 91.0 (94 %) | 70.0 (50 %) | 52.3 (25 %) |
| Limite (≈ 75, doit parfois repasser) | 99.9 (100 %) | 90.4 (88 %) | 82.8 (74 %) | 47.5 (50 %) | 21.3 (0 %) |
| Progressif (40–50 au départ, 75 à force d’essais) | 93.7 (100 %) | 72.1 (72 %) | 70.4 (61 %) | 80.5 (50 %) | 33.8 (25 %) |
| Méthodique mais lent | 95.0 (100 %) | 92.9 (100 %) | 87.8 (94 %) | 84.0 (100 %) | 92.0 (100 %) |
| Pressé / imprudent | 80.0 (67 %) | 70.3 (65 %) | 62.0 (58 %) | 75.0 (100 %) | 16.3 (0 %) |
| Décrocheur (abandonne quand bloqué) | 83.7 (67 %) | 83.6 (78 %) | 62.6 (61 %) | 11.0 (0 %) | 28.5 (25 %) |

Entre parenthèses : part des parties validées (note ≥ 75) du premier coup.

## Courbe d’apprentissage (archétype « Progressif »)

| Parties jouées (tranche) | Note moyenne | Part validée (≥ 75) | Indices / partie | Mode guidé |
|---|---:|---:|---:|---:|
| 1–10 | 67.2 | 60 % | 0.7 | 35 % |
| 11–20 | 64.5 | 65 % | 0.5 | 60 % |
| 21–30 | 59.7 | 50 % | 0.3 | 40 % |
| 31–40 | 56.9 | 50 % | 0.6 | 50 % |

Rang de partie à partir duquel la moyenne glissante (5 parties) atteint 75 : individu 1 → 5 ; individu 2 → 5.

## Effet des indices, dangers et clôtures prématurées sur la note

Parties résolues, tous archétypes confondus (premier essai) :

| Situation | Parties | Note moyenne | Part ≥ 75 |
|---|---:|---:|---:|
| Aucun indice, aucune erreur | 158 | 98.2 | 100 % |
| 1 indice seul | 6 | 90.2 | 100 % |
| 2 indices ou plus | 5 | 50.4 | 0 % |
| 1 action dangereuse | 22 | 76.2 | 68 % |
| 2 actions dangereuses ou plus | 7 | 58.3 | 0 % |
| 1 clôture prématurée | 86 | 86.9 | 85 % |
| Contournement pris pour une résolution | 8 | 71.1 | 63 % |

### Le seuil de 75 en fonction du temps (résolutions propres : sans indice, sans erreur)

| MTTR / temps cible | Parties | Note moyenne | Part ≥ 75 |
|---|---:|---:|---:|
| 0 – 0.5 | 11 | 100.0 | 100 % |
| 0.5 – 0.75 | 55 | 100.0 | 100 % |
| 0.75 – 1 | 40 | 100.0 | 100 % |
| 1 – 1.25 | 25 | 97.9 | 100 % |
| 1.25 – 1.5 | 18 | 94.3 | 100 % |
| ≥ 1.5 | 9 | 86.0 | 100 % |

## Pannes : calibrage

- Pannes jouées au moins une fois (seules ou comme cause d’un ticket composé) : **155 / 158** ; tickets composés : Admin 171, Cyber 22, Chaos 57 parties.
- Jamais tirées dans cette série : phys_eth, ipv4_dns, lx_svc_stopped (augmenter le nombre de tickets ou relancer avec une autre graine).

### Pannes les moins validées par les experts et solides (premier essai)

| Panne | Niveau | Étapes optimales | Temps cible | Experts/solides (parties) | Part ≥ 75 | Note moyenne |
|---|---:|---:|---:|---:|---:|---:|
| `dhcp_dns_opt` | 2 | 4 | 570 s | 2 | 100 % | 92.5 |
| `c_route_default` | 2 | 5 | 660 s | 2 | 100 % | 92.5 |
| `px_subnet_denied` | 2 | 5 | 660 s | 2 | 100 % | 93.5 |
| `phys_source` | 1 | 3 | 450 s | 2 | 100 % | 93.5 |
| `dhcp_suffix` | 2 | 5 | 660 s | 2 | 100 % | 99.5 |
| `phys_wall` | 1 | 4 | 570 s | 3 | 100 % | 100.0 |
| `dns_svc` | 2 | 4 | 570 s | 2 | 100 % | 100.0 |
| `lx_net` | 2 | 5 | 660 s | 2 | 100 % | 100.0 |
| `iis_binding` | 2 | 3 | 450 s | 2 | 100 % | 100.0 |
| `px_sg_default_deny` | 2 | 5 | 660 s | 2 | 100 % | 100.0 |
| `dhcp_conflict` | 2 | 4 | 570 s | 2 | 100 % | 100.0 |
| `phys_power` | 1 | 4 | 570 s | 2 | 100 % | 100.0 |

### Temps cible par panne : où le rapport MTTR / cible des experts dépasse 1

Le temps cible est **calculé par panne** à partir de son chemin optimal (étapes × 110 s + 120 s, arrondi à 30 s, borné 6–20 min ; panne composée : somme − 15 %). Résolutions propres des archétypes expert et solide :

| Panne | Parties | MTTR / cible (moy.) | Temps cible |
|---|---:|---:|---:|
| `phys_source` | 2 | 1.30 | 450 s |
| `dhcp_conflict` | 2 | 0.94 | 570 s |
| `phys_screen` | 2 | 0.79 | 450 s |
| `dhcp_suffix` | 2 | 0.79 | 660 s |
| `phys_wall` | 3 | 0.76 | 570 s |
| `phys_power` | 2 | 0.70 | 570 s |
| `lx_net` | 2 | 0.68 | 660 s |
| `iis_binding` | 2 | 0.63 | 450 s |
| `dns_svc` | 2 | 0.62 | 570 s |
| `px_client_bypass` | 2 | 0.59 | 660 s |

Rapport moyen toutes pannes (experts et solides, résolutions propres) : **0.7**. Les modèles d’apprenants fixent leur vitesse en secondes par étape optimale : ce rapport vérifie surtout la **cohérence interne** du temps cible, pas sa justesse pour de vrais élèves (à mesurer).

### Pannes qui obligent le plus à repasser (nombre moyen d’essais pour valider)

| Panne | Niveau | Parties | Essais moyens | Validées du 1er coup (tous archétypes) |
|---|---:|---:|---:|---:|
| `dns_cache` | 1 | 4 | 1.8 | 50 % |
| `dns_svc` | 2 | 5 | 1.6 | 67 % |
| `c_shutdown` | 2 | 5 | 1.6 | 67 % |
| `dhcp_gw_bad` | 2 | 7 | 1.6 | 50 % |
| `dhcp_conflict` | 2 | 9 | 1.4 | 67 % |
| `dhcp_suffix` | 2 | 7 | 1.4 | 80 % |
| `ad_agdlp_member` | 2 | 4 | 1.3 | 67 % |
| `dhcp_resa` | 2 | 4 | 1.3 | 67 % |
| `ad_disabled` | 1 | 5 | 1.2 | 75 % |
| `c_route_default` | 2 | 6 | 1.2 | 80 % |

## Compétences : où les apprenants simulés restent faibles

Notes moyennes (archétypes Limite + Progressif, tous essais) par compétence du référentiel, les 10 plus basses :

| Compétence | Parties | Note moyenne | Part ≥ 75 |
|---|---:|---:|---:|
| Pare-feu à états : ordre des règles, refus implicite (`pare-feu-etats`) | 18 | 43.7 | 33 % |
| Services systemd et journalctl (`lx-services`) | 23 | 48.4 | 39 % |
| Sécurité Linux : SSH restreint, UFW (`lx-secu`) | 9 | 50.4 | 44 % |
| Couche physique : câbles, prises, alimentation, écran (`phys`) | 11 | 50.5 | 55 % |
| VLAN : affectation des ports d’accès (`vlan`) | 30 | 52.2 | 53 % |
| DNS : zones, enregistrements A/PTR/CNAME, redirecteurs (`dns`) | 26 | 55.7 | 50 % |
| Droits POSIX, propriétaires, umask, bit x sur répertoire (`lx-droits`) | 14 | 55.8 | 57 % |
| Apache2, MariaDB, vhosts (`lamp`) | 13 | 57.0 | 62 % |
| Diagnostic GPO : gpresult, gpupdate, journaux (`diag-gpo`) | 8 | 59.1 | 38 % |
| Routage statique et route par défaut (`routage`) | 17 | 59.5 | 53 % |

> Ce classement reflète surtout **le niveau des pannes rattachées** à chaque compétence (une compétence dont toutes les pannes sont de niveau 4 sort basse) et le nombre d’étapes : ce n’est pas un diagnostic de difficulté intrinsèque.

## Contrôles d’intégrité

- Déterminisme : **6 / 6** rejeux identiques (même graine, même comportement).
- Anomalies relevées : **0** (aucune)
- Issues des parties : resolved 359, timeout 6, abandoned 78.

## Décisions que cette série met sur la table

1. **Seuil de validation à 75 / 100** (validé dans la conversation) ; paliers 1★ 75–84, 2★ 85–94, 3★ 95–99 et 100 = Parfait : proposés par le jeu, à confirmer ou ajuster. Le plancher du temps (une résolution propre ne descend jamais sous 75) est vérifié ici à chaque partie.
2. **Temps cible par panne** (dérivé des étapes optimales) : voir « Temps cible par panne ». Le rapport MTTR / cible des experts doit rester ≲ 1 ; sinon allonger la formule.
3. Les paramètres des archétypes (`tests/personas.js`) sont des hypothèses : à ajuster si tu as des mesures réelles d’élèves (temps de résolution, nombre d’indices).
