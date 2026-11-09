# Écart fiche de suivi v21 (27/10/2026) ↔ compétences du jeu

_Établi le 27/10/2026 en comparant la fiche v21 (123 lignes de compétences) à la v19 et aux 46 compétences du jeu. Aucune panne n'a été ajoutée : ce document sert à arbitrer._

## 1. Ce qui change entre v19 et v21

- **Hors statuts** : seul le statut de « Switch multicouche — routage par SVI » passe de 🟡 à 🟢 (remis en œuvre le 19/10). La compétence du jeu `roas` était déjà « vert » : rien à changer.
- **Réa Linux 1** : résultat reçu, 90,25/100 (mention A). Bind9 confirmé 🟢. Pièges signalés par la correction : PTR du client écrit sans domaine (−1) et nom court « intranet » qui ne résout pas sans suffixe DNS (−1) — voir § 3.
- **Nouvelles lignes absentes de la v19** (13) : OSPF une area, OSPF multi-area, EtherChannel (LACP) et STP, HSRP (FHRP), IDS/IPS Snort sur pfSense, gestion de projet, chiffrage, support et ITIL (GLPI), continuité (RTO/RPO), soutenance, prouver par la mesure, compte rendu de TP complet.
- **Lignes supprimées** : uniquement des lignes de chronologie (TP, projet DLQio), pas de compétence technique.

## 2. Notions de la fiche sans aucune panne dans le jeu

| Statut | Ligne de la fiche | Panne possible ? | Remarque |
|---|---|---|---|
| 🟢 | Routage dynamique OSPF — une seule area | oui | **Livré (28/10/2026)** : voisinages, router-id, `network`, passive-interface, route par défaut propagée (4 pannes `ospf_*`) |
| 🟡 | OSPF — plusieurs areas (ABR, routes O / O IA) | oui | **Livré (28/10/2026)** : R-LB6 en zone 1 derrière l'ABR R-LB3, routes `O IA`, panne `ospf_area_mismatch`, compétence `ospf-multi` |
| 🟢 | Agrégation de liens — EtherChannel (LACP) et STP | oui | **Livré (28/10/2026)** : site de Colomiers, Port-channel, STP par VLAN, 7 pannes `ec_*` / `stp_*`, compétence `etherchannel` ; captures C1–C6 à comparer (mises en page reconstituées) |
| 🟢 | Redondance de passerelle — HSRP | oui | Pas de modèle HSRP (`show standby brief`, priorités, preempt) |
| 🟡 | IDS / IPS — Snort sur pfSense | oui | **Livré (28/10/2026)** : instances WAN/LAN, `custom.rules`, Alerts, Blocked, Pass Lists, 8 pannes `snort_*`, compétence `snort` ; captures E1–E6 à comparer (libellés reconstitués) |
| 🟢 | Hyper-V (hyperviseur, VM, snapshots, commutateurs, ressources) | oui | Existait déjà en v19 ; classé « hors fiche » par erreur dans `CORRESPONDANCE-COURS.md` |
| 🟢 | Supervision — Zabbix 7.4 | oui | Idem (en v19) |
| 🟢 | Cloud public — AWS ; Conteneurs — Docker / Compose | oui | Idem (en v19) |
| 🟡 | Déploiement de postes — WDS ; 🟢 Sauvegarde — Veeam | oui | Idem (en v19) |
| 🟢/🟡 | LVM, ProFTPd, ACL POSIX, archivage, paquets, SSH, FHS | en partie | Les compétences `lx-*` du jeu en couvrent une partie (archivage et `apt` : pas de panne) |
| 🟡 | AD — GPP, ABE, FSRM, GPO par MSI, automatisation PowerShell | oui | Candidats cités dans l'audit précédent |
| 🟡/🟢 | Support et ITIL (GLPI), continuité RTO/RPO, gestion de projet, chiffrage, soutenance, rédaction, méthode | **non** | Ce sont des compétences de pilotage / documentation, pas des pannes d'infrastructure : à laisser hors du jeu |
| 🟢 | Dissection des trames, audit FTP/Telnet/HTTP Basic, Bluetooth, cryptanalyse Cisco Type 5/7 | non | Analyse réseau / SOC : relève d'un autre type d'exercice (analyse de capture), pas de diagnostic de panne |

## 3. Pistes sans nouvelle émulation (à faible risque)

- **Bind9 / DNS** : le piège du nom court qui ne résout pas sans suffixe DNS est déjà couvert par `dhcp_suffix` (poste Windows de Ramonville, option 015). Le piège du PTR écrit sans domaine est traité depuis le 27/10 par la nouvelle panne `lx_bind_ptr` (N3 : PTR sans domaine, PTR sans point final, PTR en commentaire) ; limite de modélisation dans `LIMITES.md`.
- **`switch-secu`** : la compétence du jeu est marquée 🟡 mais la fiche (v19 comme v21) ne contient aucune ligne sur la sécurité des ports (port-security). Rattachement à confirmer ou à retirer.

## 4. Correction d'une erreur de mon audit précédent

`docs/CORRESPONDANCE-COURS.md` classait Zabbix, Docker, AWS, WDS, Hyper-V comme « hors fiche v19 ». C'est faux : ces lignes figurent dans la fiche depuis la v19. Elles étaient « hors des 46 compétences du jeu », ce qui est un choix de conception, pas un hors-périmètre. Seuls OSPF, EtherChannel, HSRP et Snort étaient réellement absents de la v19.
