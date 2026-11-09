# Captures à demander à Cowork — lot fiche v21 (27/10/2026)

Demandé par l'utilisateur le 27/10 (« demande à Cowork, en parallèle »). La consigne de session est à rédiger par le projet (`SESSION-VM-*.md`) ; ce fichier est la liste du besoin, côté code. Convention de nommage : `<CONSOLE>__<ecran>__<etat>__<NN>.png` (voir `ORGANISATION.md` §4). Règle : un PNG par écran, fenêtre entière, jamais recadré ; relever tout écart de libellé.

**Précision de source à noter dans `NOTES.md`** : si les `show` Cisco sont pris sous Packet Tracer (outil des TP), l'indiquer et noter la version ; les sorties de Packet Tracer ne sont pas identiques à celles d'un IOS réel. Un relevé sur IOS réel (ou sur un équipement de salle) prime.

## A. OSPF une area (ring de 5 routeurs : 4 secteurs + firewall, faux Internet derrière)

| # | Commande / écran | État à capturer |
|---|---|---|
| A1 | `show ip ospf neighbor` | sain (FULL/DR, FULL/BDR, FULL/-) ; **et** voisin absent (liste vide) |
| A2 | `show ip route` | sain, avec routes `O` et `O*E2 0.0.0.0/0` ; **et** après coupure d'un lien de l'anneau |
| A3 | `show ip route ospf` | sain |
| A4 | `show ip ospf interface brief` | sain, avec une interface en `passive` |
| A5 | `show ip ospf interface <interface>` | interface passive ; interface avec timers hello/dead modifiés |
| A6 | `show ip protocols` | routeur OSPF configuré (router-id, networks, passive interfaces, distance) |
| A7 | `show running-config | section router ospf` | sain ; **et** avec un masque inverse erroné dans `network` |
| A8 | Messages de journal OSPF (`show logging`) | changement d'état de voisinage (`%OSPF-5-ADJCHG`) |
| A9 | `router ospf 1` en configuration | invite `(config-router)#` et `?` pour la liste des sous-commandes |

## B. OSPF multi-area (bonus du TP)

| # | Commande | État |
|---|---|---|
| B1 | `show ip route` sur un routeur d'une area ≠ 0 | routes `O` et `O IA` |
| B2 | `show ip ospf border-routers` | ABR visibles |
| B3 | `show ip ospf database` | LSA type 1 et type 3 |

## C. EtherChannel (LACP) et STP

_Livré le 28/10/2026 (site de Colomiers). Les mises en page de `show etherchannel summary` et de `show spanning-tree`, les messages `%EC-5-*` et `%SPANTREE-5-ROOTCHANGE` et les numéros de ports STP sont reconstitués de mémoire (clés `l2-*` de `A-VERIFIER.md`) : comparer dès réception. C3 (`show etherchannel port-channel`) n'est pas simulé : la capture dira s'il faut l'ajouter._

| # | Commande | État |
|---|---|---|
| C1 | `show spanning-tree` | avant regroupement : un lien en `Altn BLK` |
| C2 | `show etherchannel summary` | Po1 `(SU)` avec ports `(P)` ; **et** Po1 `(SD)` ou port `(I)` (stand-alone) ; **et** un port `(D)` |
| C3 | `show etherchannel port-channel` | sain |
| C4 | `show interfaces trunk` | trunk porté par Po1 |
| C5 | Configuration `channel-group 1 mode active` et `passive` | un côté `passive` + l'autre `passive` (ne forme jamais) |
| C6 | Messages de journal EtherChannel | formation / rupture (`%EC-5-...`) |

## D. HSRP (FHRP)

| # | Commande | État |
|---|---|---|
| D1 | `show standby brief` | sain (Active / Standby, priorité 110 / 100, preempt) |
| D2 | `show standby` (détaillé) | sain |
| D3 | `show standby brief` | après coupure du routeur actif (bascule) et retour avec / sans `preempt` |
| D4 | `traceroute` / `tracert` depuis un poste | avant et après bascule |

## E. Snort sur pfSense

| # | Écran | État |
|---|---|---|
| E1 | Services ▸ Snort ▸ Snort Interfaces | liste vide ; interface ajoutée, démarrée / arrêtée |
| E2 | Services ▸ Snort ▸ Global Settings | clés / mise à jour des règles |
| E3 | Snort Interfaces ▸ édition d'une interface | onglets Interface Settings, Categories, Rules, Preprocs |
| E4 | Services ▸ Snort ▸ Alerts | vide ; avec alertes |
| E5 | Services ▸ Snort ▸ Blocked Hosts | vide ; avec un hôte bloqué |
| E6 | Version du paquet Snort affichée dans System ▸ Package Manager | version exacte |

## F. Hyper-V (console du serveur de captures)

| # | Écran | État |
|---|---|---|
| F1 | Gestionnaire Hyper-V | liste de VM, volet Actions |
| F2 | Paramètres d'une VM | Mémoire (statique / dynamique), Processeur, Carte réseau, Disque dur |
| F3 | Points de contrôle (snapshots) | liste, menu contextuel, boîte de confirmation de restauration |
| F4 | Gestionnaire de commutateur virtuel | External, Internal, Private (création et propriétés) |
| F5 | VM démarrée avec carte réseau déconnectée | symptôme côté invité |

*Dépend de l'arbitrage sur D-61 (Hyper-V hors périmètre) : à ne lancer qu'après décision du projet.*
