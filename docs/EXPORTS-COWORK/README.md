# Exports pour Cowork (D-104)

*Généré par `node tests/gen-exports.js`. Ne pas éditer à la main.*

**Ce que c'est** : les configurations de départ des laboratoires réseau à monter, **telles que le simulateur les produit**. Configuration de simulateur, non validée sur un IOS réel. Cowork signale toute ligne rejetée par la plateforme réelle : c'est une information, pas une erreur.

| Fichier | Appareil | Rôle |
|---|---|---|
| `colomiers-SW-CA.running-config.txt` | SW-CA | Colomiers : commutateur (EtherChannel / STP) |
| `colomiers-SW-CB.running-config.txt` | SW-CB | Colomiers : commutateur (EtherChannel / STP) |
| `colomiers-SW-CC.running-config.txt` | SW-CC | Colomiers : commutateur (EtherChannel / STP) |
| `labege-R-LB2.running-config.txt` | R-LB2 | Labège : routeur de zone 0, réseau local 10.30.102.0/24 derrière |
| `labege-R-LB3.running-config.txt` | R-LB3 | Labège : ABR (zone 0 / zone 1) |
| `labege-R-LB6.running-config.txt` | R-LB6 | Labège : routeur de zone 1, réseau local 10.30.106.0/24 derrière |
| `pfsense-tls-snort-wan.custom.rules` | pfsense-tls wan | Snort : règles personnelles de l'instance |
| `pfsense-tls-snort-lan.custom.rules` | pfsense-tls lan | Snort : règles personnelles de l'instance |

## À savoir avant de monter

- **Labège, sous-ensemble minimal** : R-LB2 – R-LB3 – R-LB6, en ligne. R-LB2 porte aussi une interface vers R-LB1 (`GigabitEthernet0/0`, 10.30.12.0/30) : dans ce sous-ensemble, elle n'a pas de voisin (R-LB1 absent). R-LB3 porte une interface vers R-LB4 (`GigabitEthernet0/1`, 10.30.34.0/30), idem. Ces deux interfaces sont laissées telles que le simulateur les produit.
- **Colomiers** : les trois commutateurs sont exportés ensemble ; leurs descriptions d'interface disent qui est relié à qui (câblage non reproduit ici).
- **Modèles** : le simulateur déclare un C3560 (SW-CA) et des C2960 (SW-CB, SW-CC) pour Colomiers, des 2911 pour Labège (`show version`). Valeurs de contenu **à vérifier** (voir `docs/INVENTAIRE-COMMANDES.md`, section R-77). Ce n'est pas une exigence de matériel.
- **Snort** : une règle personnelle par ligne ; deux instances (WAN, LAN). Le numéro de règle `1000001` est celui que cite D-90.
- **Rien ici n'est sourcé** : ce sont des sorties de simulateur. Si une plateforme réelle les rejette ou les modifie, la différence est la donnée.
