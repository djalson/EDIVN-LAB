# Correspondance cours / TP du Drive ↔ pannes du jeu

> **Erratum du 27/10/2026** : la mention « hors fiche » pour Zabbix, Docker, AWS, WDS, Veeam et Hyper-V est fausse (lignes présentes dès la v19) ; OSPF, EtherChannel, HSRP et Snort sont désormais dans la fiche v21. Voir `FICHE-V21-ECART.md`.

_Établie le 27/10/2026 à partir de l'arborescence du Drive « cours » (15 dossiers). Méthode : les **titres** de tous les documents ont été relevés ; seuls les trois documents Proxy ont été relus en entier (ils servent de source aux pannes Squid). Pour les autres dossiers, le rattachement repose sur le titre du TP/cours et sur la fiche de compétences v19 : à confirmer si un point te paraît faux._

Légende : ✅ couvert par au moins une panne · 🟡 couvert en partie · ⛔ vu en formation mais **sans panne** · ❓ hors des 46 compétences de la fiche v19 (je n'élargis pas le périmètre sans ton accord).

## 1. Table de correspondance (sujet de formation → pannes)

| Dossier du Drive | Cours / TP (titres) | Compétences | Pannes | État |
|---|---|---|---|---|
| **Réseaux** (dossier Réseau Cisco) | Modèle OSI, Présentation Réseaux, exos plages d'adresses IP, VLSM, segmentation par nombre d'hôtes, classes d'adresses, ipcalc | `subnetting`, `diag` | `ipv4_static` `ipv4_gw` `ipv4_mask` `dhcp_gw_bad` `c_nat_acl` `pf_gateway`… | ✅ |
| Réseaux | Routage 2024 (statique) | `routage` | `c_route_default` `c_sw_gw` `pf_static_route` `pf_gateway` | ✅ |
| Réseaux / **VLAN** | Cours VLAN 802.1Q, Tp_Vlan-1/2/3, configs commutateur SSH, « réseau salle en 172 » | `vlan` `trunk` `roas` `ssh-cisco` | `c_vlan_port` `c_vlan_missing` `c_trunk_allowed` `c_trunk_native` `c_svi` `c_roas` `c_ssh` `c_sw_gw` | ✅ |
| Réseaux / **HA** | TP HA OSPF, Agrégation de liens (EtherChannel) et FHRP (HSRP) | _aucune compétence correspondante dans la fiche v19_ | — | ❓ **à trancher** (voir § 3) |
| **ACL** | Access Control List, ACL étendues, application sur interface, TP ACL 1 et 2 | `acl` `segmentation` | `c_acl` `c_nat_acl` `c_ssh_auth` | ✅ (1 panne N4 seulement : 🟡) |
| **Systèmes Windows** / Virtualisation | Cours Virtualisation, TP2 Hyper-V | _hors fiche (pas de compétence Hyper-V)_ | — | ❓ |
| Systèmes Windows / **DHCP** | TP DHCP, Présentation DHCP v2, TP DHCP-DNS-Hébergement | `dhcp` `dhcp-auth` `dhcp-relay` | 12 pannes `dhcp_*` + `c_dhcp_router` | ✅ |
| Systèmes Windows / **Hébergement** | Hébergement TP2026 (IIS, certificats, DNS) | `iis` `dns` | `iis_*` `web_*` `fw_80` `fw_443` | ✅ |
| Systèmes Windows / **Domaine (AD)** | TP AD 0.0 à 6 (installation, découverte, arborescence, partages, NTFS, droits, approfondissement), vocabulaire domaine, présentation bases AD, scripts utilisateurs | `ad-install` `ad-ou` `ad-compte` `agdlp` `ntfs-partage` `ad-trust` | `ad_*` `sh_*` `fw_smb` `gpo_sysvol` | ✅ |
| Windows / AD / **GPO** (+ Cours_AD_GPO) | GPO fond d'écran, lecteur réseau, installation logiciel (7-Zip), profil itinérant, quotas, script netlogon, TP-GPO et suite | `gpo` `gpo-heritage` `gpo-filtrage` `gpo-compte` `diag-gpo` | `gpo_*` `ad_ou_move` `gpo_compte` | 🟡 profil itinérant, quotas, script netlogon, installation logiciel : aucune panne dédiée |
| Windows / **Plateforme** | Plateforme (NAT, mediaserv, GPO), procédure EDIVN MEP, dossier complémentaires | `nat-pat` `portfwd` `ad-install` `gpo` | `c_nat_*` `pf_portfwd` | ✅ |
| **Linux** | 1.1–1.6 installation Debian, réseau statique, arborescence | `lx-reseau` | `lx_net` | 🟡 (1 panne) |
| Linux | 1.7 manipulation de fichiers, 1.8 utilisateurs et droits, TP ACL | `lx-droits` `lx-acl` | `lx_perm` `lx_acl` `lx_ssh_keyperm` `lx_web_perm` | ✅ |
| Linux | 1.9 SSH (port, avancé), 1.4 connexion SSH | `lx-ssh` `lx-secu` | `lx_ssh_*` `lx_ufw` | ✅ |
| Linux | 1.10 paquets, 1.11 services (systemd), 1.12 archivage et compression | `lx-services` | `lx_svc_stopped` … | ✅ (paquets, archivage : sans panne) |
| Linux | TP gestion des disques | `lx-stockage` | `lx_fstab` `lx_disk_full` | ✅ |
| Linux | 2.1 / 2.2 DNS Bind9 (directe, inverse, aller plus loin) | `bind9` | `lx_bind_conf` `lx_bind_zone` `lx_bind_access` | ✅ |
| Linux | 2.4 LAMP / Apache | `lamp` | `lx_apache_conf` `lx_web_vhost` `lx_web_perm` `lx_db_access` | ✅ |
| Linux | 2.5 ProFTPd | _aucune compétence FTP dans la fiche_ | — | ❓ |
| Linux | TP entraînement réa Linux « Atlas » + corrigé, fiches de révision | `lx-*` `bash` `nginx` | `lx_nginx` `lx_cron` | ✅ (nginx, bash : 1 panne chacune) |
| **bash** | Module script bash (cours + exercices), `menu_admin.sh` | `bash` | `lx_cron` | 🟡 (1 panne) |
| **Firewall** | TP OPNsense 1.1 à 1.4 (installation, filtrage, NAT, DMZ GLPI bastion) | `pare-feu-etats` `pfsense` `portfwd` `segmentation` | `pf_*` | ✅ — _attention : les TP sont sous **OPNsense**, le jeu reproduit **pfSense** (voir § 3)_ |
| **VPN** | Présentation VPN, IPsec approfondi, OpenVPN sur pfSense | `ipsec` `openvpn` | `pf_ipsec_*` `vpn_*` | ✅ |
| **Infra multi-sites** | pfSense DMZ complet, VPN site à site, sauvegarde et réplication (Veeam), cahier de tests Bordeaux | `pfsense` `ipsec` | `pf_*` | 🟡 sauvegarde/Veeam : sans compétence |
| **Proxy** | TP Squid/SquidGuard sur pfSense, cours Proxy, fiche procédure | `proxy` | _aucune avant ce lot_ → voir `docs/PANNES-PROXY.md` | ⛔ → traité |
| **Supervision** | Zabbix (installation, client Windows, client Linux), fiche de révision | _hors fiche_ | — | ❓ |
| **Dockers** | TP Docker Debian 13 | _hors fiche_ | — | ❓ |
| **Cloud** | TP AWS, présentation Cloud | _hors fiche_ | — | ❓ |
| **Déploiement** | WDS (TP + présentation + vocabulaire) | _hors fiche_ | — | ❓ |
| **Sécurité & Wireshark** | Wireshark | `diag` (indirect) | — | ❓ |
| **Projet** | Cahier des charges infra, soutenance | — | — | hors sujet du jeu |

## 2. Lecture rapide

- **Cœur de formation bien couvert** : adressage, VLAN/trunk/ROAS, DHCP, DNS, IIS, AD/AGDLP/NTFS, GPO, Linux (SSH, droits, Bind9, LAMP), pfSense, VPN. Ce sont les sujets où tous les stagiaires ont les mêmes bases, donc les plus utiles pour s'entraîner.
- **Couverture mince (1 panne)** : `dhcp-auth`, `ad-trust`, `switch-secu`, `lx-acl`, `lx-reseau`, `nginx`, `bash` → traité par ce lot (2ᵉ panne pour chacun).
- **Sujets de formation sans panne dans le jeu** : OSPF, EtherChannel, HSRP/FHRP (dossier HA), Hyper-V, FTP, Zabbix, Docker, AWS, WDS, Veeam. Aucun n'appartient à la fiche v19 : je ne les ajoute pas sans ton arbitrage.
- **Sous-sujets de TP couverts par aucune panne alors que la compétence existe** : GPO « profil itinérant / quotas / script netlogon / installation logiciel », gestion des paquets (`apt`), archivage (`tar`). Candidats raisonnables si tu valides.

## 3. Points à trancher (périmètre)

1. **OSPF / EtherChannel / HSRP** (dossier _HA_, TP du 19-20/10) : compétence absente de la fiche v19. Ajouter une compétence « routage dynamique / haute disponibilité » demande de modifier la fiche, donc une décision dans le projet (`DECISIONS.md`).
2. **OPNsense vs pfSense** : les TP Firewall sont en OPNsense, les TP VPN/DMZ/Proxy en pfSense. Le jeu reproduit pfSense uniquement. Les pannes `pf_*` restent valables pour les notions (règles, NAT, DMZ), mais les chemins de clics OPNsense ne sont pas reproduits.
3. **Zabbix, Docker, AWS, WDS, Hyper-V, FTP** : sujets vus mais hors fiche.

## 4. Limites de cet audit

- Seuls les titres ont été exploités (hors Proxy). Un TP dont le titre est générique (« Dossier de base », « Plateforme mediaserv ») peut contenir des notions que je n'ai pas vues.
- Les `.pkt`, `.pptx` et `.docx` n'ont pas été ouverts.
