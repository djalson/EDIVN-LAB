# Captures à produire (généré par `node tests/gen-captures.js`)

Chaque entrée du registre `A-VERIFIER.md` est un détail reconstitué de mémoire : une capture de référence la confirme ou la corrige. Regroupées par machine pour que la session de capture se fasse en une fois par VM.

**184 entrées** — 41 Debian 13 · 18 Cisco IOS · 24 pfSense · 39 Windows Server · 26 Windows · 18 Windows Client · 1 Observateur d'événements · 17 Autre.

Procédure : capturer → placer le fichier sous `captures/<tag>.png` (ou `.txt` pour une sortie texte) → corriger le code → supprimer l'appel `U.av('<tag>', …)` correspondant → relancer `node build.js` et `node tests/all.js`.

## Debian 13 (SRV-LNX / SRV-WEB) (41)

Debian — shell : copier la sortie texte exacte (terminal ou SSH), pas de capture graphique nécessaire.

| Tag | À confirmer |
|---|---|
| `apt-format` | Messages d’apt (tailles, numéros de version, lignes Get:/Fetched) : approximation ; seuls les échecs réseau suivent des libellés connus. |
| `bash-errors` | Messages d’erreur coreutils / bash en anglais (« No such file or directory », « Permission denied », « command not found »…) : formes courantes de Debian 13, reprises de mémoire. |
| `bash-script-errors` | Messages de bash pour un script erroné (« script: line N: unexpected EOF while looking for matching `"' », « syntax error: unexpected end of file », « DEST: command not found ») : formes reconnues de bash 5.2, numéros de ligne rapportés à confirmer par essai s… |
| `boot-emergency` | You are in emergency mode. After logging in, type "journalctl -xb" to view system logs, "systemctl reboot" to reboot, or "exit" to continue bootup. |
| `cron-insecure` | Message de cron pour un fichier de /etc/cron.d modifiable par le groupe ou les autres : « INSECURE MODE (group/other writable) » — libellé à vérifier sur Debian 13. |
| `cron-nomta` | Ligne syslog de cron quand la tâche produit une sortie et qu’aucun MTA n’est installé : « (CRON) info (No MTA installed, discarding output) » — à vérifier sur Debian 13. |
| `cron-shell-err` | Messages d’erreur du shell lancé par cron (dash : « /bin/sh: 1: <cmd>: Permission denied » / « not found ») — à vérifier sur Debian 13. |
| `df-format` | Sortie de df -h (noms de périphériques /dev/sda1, lignes udev/tmpfs et tailles de tmpfs) : valeurs plausibles d’une VM Debian 13, non issues d’une capture. |
| `dig-format` | Sortie de dig (version de BIND dans l’en-tête, section OPT, taille de message) : approximation ; la section AUTHORITY d’un NXDOMAIN n’affiche pas le SOA (non modélisé). |
| `gpo-editor` | Éditeur de gestion des stratégies de groupe : seul un sous-ensemble de paramètres est modélisé (longueur minimale du mot de passe, seuil de verrouillage, règle ICMP entrante, délai de l’écran de veille, papier peint, lecteurs mappés) ; chemins d’arborescence e… |
| `ip-format` | Sortie de « ip a » / « ip r » (flags, qdisc, onlink pour la passerelle ifupdown) : approximation d’iproute2 6.x ; l’interface s’appelle eth0 dans ce laboratoire (pas de nom prévisible). |
| `journal-nopermission` | Avertissement de journalctl pour un utilisateur hors des groupes adm / systemd-journal : libellé repris de mémoire. |
| `l2-ec-show` | Mise en page de « show etherchannel summary » (en-tête des drapeaux, colonnes Group / Port-channel / Protocol / Ports, « Number of aggregators ») : reconstituée de mémoire pour IOS 12.2 / 15.0, à comparer à une capture (C2). |
| `l2-ec-syslog` | Messages %EC-5-BUNDLE, %EC-5-UNBUNDLE, %EC-5-CANNOT_BUNDLE2 et « Creating a port-channel interface Port-channel N » : formulation reconstituée de mémoire, à comparer à une capture (C6). |
| `l2-runcfg` | Position et libellé des lignes « channel-group », « spanning-tree portfast / bpduguard / cost / port-priority » dans une interface du running-config, et regroupement « spanning-tree vlan 1,10 priority N » : ordre reconstitué de mémoire (IOS 15.0), à comparer à… |
| `l2-show-po` | « show interfaces port-channel N » : mise en page (« Hardware is EtherChannel », BW = somme des membres agrégés, « Members in this channel: … ») reconstituée de mémoire, à comparer à une capture. |
| `l2-status-suspended` | État « suspended » affiché par « show interfaces status » pour un membre EtherChannel suspendu, et ordre des interfaces Port-channel dans les « show » (placées après les ports physiques) : à vérifier sur capture. |
| `l2-stp-pocost` | Coût STP d’un Port-channel : coût du lien pour 1 membre, 3 pour 2 membres de 1 Gbit/s, 2 au-delà (méthode « short ») — valeurs indicatives, à vérifier sur capture. |
| `l2-stp-portid` | Numéros de ports STP (Prio.Nbr) : Fa0/n = n, Gi0/n après les ports Fast Ethernet, Port-channel N = 64 + N — valeurs indicatives, à vérifier sur capture. |
| `l2-stp-show` | Mise en page de « show spanning-tree » (Root ID / Bridge ID, colonnes Interface / Role / Sts / Cost / Prio.Nbr / Type, durée de vieillissement) : reconstituée de mémoire pour IOS 12.2 / 15.0, à comparer à une capture (C1). |
| `l2-stp-syslog` | Message %SPANTREE-5-ROOTCHANGE (changement de racine) : formulation reconstituée de mémoire, à comparer à une capture. |
| `linux-issue` | Bannière de connexion console (/etc/issue) : « Debian GNU/Linux 13 <hôte> tty1 » — libellé reconstitué ; à vérifier sur une installation réelle. |
| `lx-networking-unit` | Application de /etc/network/interfaces : « systemctl restart networking » (ifupdown) supposé sur Debian 13 en installation serveur ; à vérifier. |
| `mariadb-denied` | Libellés ERROR 1045 (28000) « Access denied for user … » et ERROR 1130 (HY000) « Host … is not allowed to connect to this MariaDB server » : repris de mémoire, à vérifier (résolution inverse de l’hôte affichée selon skip-name-resolve). |
| `mstsc-ui` | Connexion Bureau à distance : libellés de la boîte de connexion, de l’invite « Sécurité Windows » et messages d’échec (« Le Bureau à distance ne peut pas se connecter à l’ordinateur distant pour l’une des raisons suivantes… », « ne trouve pas l’ordinateur », d… |
| `mysql-banner` | Bannière et numéro de version du client mariadb 11.8 : à vérifier. |
| `mysql-errors` | Libellés ERROR 2002 / 1045 / 1130 du client mariadb : repris de mémoire. |
| `nano-ui-texts` | Interface nano : version affichée (« GNU nano 8.4 »), libellés du pied de page (^G Aide… ^X Exit) et messages d’état reconstitués de mémoire ; à comparer à la version réellement installée. |
| `nic-description` | Microsoft Hyper-V Network Adapter |
| `notepad-ui` | Bloc-notes : menus, boîte « Ouvrir » simplifiée, message d’échec d’enregistrement dans un dossier protégé reconstitués ; à vérifier par capture. |
| `pannes-proxy` | Pannes du lot proxy : le comportement exact de Squid face à une expression régulière invalide dans la Blacklist (ici : Squid ne démarre pas), face à un cache local jamais enregistré (ne démarre pas), d’un squidGuard sans base chargée (service arrêté, filtrage … |
| `putty-ui` | PuTTY : fenêtre de configuration (catégories, champs Host Name / Port / Connection type), boîte « PuTTY Security Alert », messages « Network error: Connection timed out / refused », « Unable to open connection », invites « login as: » — à vérifier par capture.… |
| `snort-default-passlist` | Snort sous pfSense : contenu exact de la liste de passage « default » et de la valeur « default » de HOME_NET (ici : adresses et sous-réseaux des interfaces, passerelles, serveurs DNS, routes statiques et réseaux VPN) — à vérifier sur capture (écrans Pass List… |
| `snort-rule-syntax` | Snort : liste des options de règle reconnues, messages d’erreur au démarrage (texte propre à ce jeu, pas celui de Snort) et variables $HOME_NET / $EXTERNAL_NET seules prises en charge — à comparer à une capture du journal de démarrage de Snort sous pfSense. |
| `ss-format` | Colonnes de « ss -tulpn » (largeurs, alignement de l’adresse locale, colonne Process) : approximation d’iproute2 6.x. |
| `ssh-client-kex` | Liste KexAlgorithms du client OpenSSH : celle de Debian 13 est reprise comme référence ; à vérifier version par version. |
| `systemctl-polkit` | Message « Interactive authentication required. » d’un utilisateur ordinaire sans agent polkit (session SSH) : libellé repris de mémoire. |
| `systemctl-status-format` | Mise en page de « systemctl status » (ligne Loaded / Active / Main PID / CGroup, « Invocation » propre à systemd 257) : reconstituée de mémoire pour Debian 13. |
| `ufw-format` | Sortie de « ufw status » (colonnes To / Action / From, doublons « (v6) ») : approximation de ufw 0.36. |
| `uname-string` | Chaîne complète de uname -a pour le noyau 6.12.x de Debian 13 (numéro de build et date) : à vérifier. |
| `vi-ui-texts` | Interface vi (vim-tiny de Debian) : messages « E37 », « E492 », format « "fichier" nL, nB written » exacts d’après la documentation de vim ; absence de numéro de ligne/colonne en barre d’état supposée (ruler désactivé par défaut). |

## Cisco IOS (Packet Tracer / matériel Ramonville) (18)

IOS — copier la sortie console exacte de chaque commande show/debug citée.

| Tag | À confirmer |
|---|---|
| `ios-banner` | Texte des messages « % … » non listés dans la documentation d’IOS : repris de mémoire (15.0 / 15.2). |
| `ios-con-ready` | Texte d’attente de la console Cisco : « <hôte> con0 is now available / Press RETURN to get started. » — reconstitué de mémoire. |
| `ios-counters` | Compteurs de « show interfaces » (paquets/octets) : valeurs synthétiques croissantes avec l’uptime, non issues d’un vrai trafic. |
| `ios-mac-static` | Entrées « All … STATIC CPU » de la table MAC : liste de référence d’un 2960, à vérifier. |
| `ios-secret-format` | Format des secrets IOS affichés dans running-config (type 5 « $1$xxxx$… ») : valeur dérivée du mot de passe, le sel et la longueur du condensat sont indicatifs. |
| `ios-show-format` | Mise en page exacte de certains « show » (cdp, port-security, dhcp, nat, interfaces) : approximation d’IOS 15.0 (2960) / 15.2 (2911). |
| `ios-status-cols` | Alignement exact des colonnes Duplex/Speed de « show interfaces status » pour les débits à 6 caractères (a-1000) : à vérifier. |
| `ios-version-text` | Texte de « show version » (version d’IOS, dates de compilation, matériel, numéro de série) : valeurs plausibles pour l’image supposée du laboratoire, à vérifier. |
| `l2-ec-modechange` | Ré-saisie de « channel-group N mode … » sur un port déjà membre avec un autre mode (par ex. on → active, desirable → active) : le simulateur remplace le mode sans message ; IOS réel peut exiger de retirer d’abord le port du groupe (« no channel-group ») — comp… |
| `l2-no-po` | « no interface port-channel N » : le simulateur supprime l’interface logique ET la ligne « channel-group » des membres ; le comportement réel d’IOS (membres conservés, interface recréée) n’est pas vérifié. |
| `l2-stp-blocked` | « show spanning-tree blockedports » : mise en page (Name / Blocked Interfaces List, « Number of blocked ports (segments) in the system : N ») reconstituée de mémoire. |
| `ospf-one-process` | Un seul processus OSPF est géré par l’équipement simulé ; la tentative d’en créer un second affiche un message propre au simulateur (pas d’IOS). |
| `ospf-show-format` | Mise en page exacte de « show ip ospf neighbor / interface / show ip protocols » et des routes O / O*E2 : reconstruite de mémoire pour IOS 15.x (2911), à comparer à une capture réelle. |
| `ospf-show-ip-ospf-partial` | « show ip ospf » : seules les lignes dérivables du modèle sont affichées (identifiant, zones, interfaces) ; minuteurs SPF, compteurs et sommes de contrôle LSA, absents, sont à ajouter depuis une capture réelle. |
| `ospf-syslog-text` | Messages %OSPF-5-ADJCHG (formation, perte de voisinage, motifs « Dead timer expired » / « Interface down or detached »), %OSPF-4-DUP_RTRID_NBR et message de changement de router-id : formulations à confirmer sur une capture réelle. |
| `ssh-client-text` | Messages du client OpenSSH (invite de clé d’hôte, « Permission denied », usage) : forme d’OpenSSH 9.x ; la liste exacte des méthodes d’authentification annoncées par IOS (« Permission denied (…) ») est à vérifier. |
| `ssh-ios-closed` | Message du client lorsque l’IOS ferme la connexion à cause d’une access-class (« kex_exchange_identification… ») : forme OpenSSH ≥ 8.7, à vérifier. |
| `ssh-ios-kex` | KexAlgorithms proposés par l’IOS du laboratoire en SSHv2 : valeur indicative (image récente supposée) à vérifier selon la version d’IOS. |

## pfSense (24)

pfSense — captures de l'interface web (Firewall > Rules, NAT, VPN > IPsec, Status) et de /var/log.

| Tag | À confirmer |
|---|---|
| `openvpn-gui-ui` | OpenVPN GUI : fenêtre de gestion des connexions (la vraie application vit dans la zone de notification), format des horodatages du journal, texte du fichier .ovpn généré à partir du profil — à vérifier par capture. |
| `pf-console-ifaddr` | Dialogue de l’option 2 « Set interface(s) IP address » (questions, messages de fin) : forme de pfSense 2.7.x reconstituée, à vérifier. |
| `pf-console-menu` | Texte et numérotation du menu de la console pfSense (options 0 à 16, libellés « Enable/Disable Secure Shell (sshd) ») : forme de pfSense 2.7.x, à vérifier selon la version installée. |
| `pf-console-shell` | Invite et commandes du shell (option 8) : invite « [2.7.2-RELEASE][admin@hôte]/root: » ; seul un petit sous-ensemble de commandes FreeBSD est simulé. |
| `pf-default-deny-label` | Default deny rule IPv4 (1000000103) |
| `pf-version` | Version de pfSense affichée (2.7.2-RELEASE) : hypothèse du laboratoire, à aligner sur la VM réelle. |
| `pfsense-gui-apply` | Interface web pfSense : textes des bandeaux « The firewall rule configuration has been changed. The changes must be applied for them to take effect. » (règles, NAT, alias, routes statiques, passerelles, IPsec) et « The changes have been applied successfully. T… |
| `pfsense-gui-cert` | Interface web pfSense, Cert. Manager : l’action « Renew or Reissue » est simplifiée (le certificat redevient valide côté serveur, sans régénération du fichier client) ; les dates de validité ne sont pas modélisées (étiquette Valid / Expired). |
| `pfsense-gui-login` | Interface web pfSense : page de connexion (« Login to pfSense », « Username or Password incorrect ») — à vérifier. |
| `pfsense-gui-look` | Interface web pfSense : habillage (barre sombre, panneaux, boutons) recréé sans logo ni ressource graphique de l’éditeur ; couleurs approximatives. |
| `pfsense-gui-menu` | Interface web pfSense : composition des menus (System, Interfaces, Firewall, Services, VPN, Status, Diagnostics), noms de fichiers des pages (firewall_rules.php, vpn_ipsec.php, status_logs_filter.php…) et libellés des boutons/colonnes reconstitués de mémoire (… |
| `pfsense-gui-nat` | Interface web pfSense, Firewall → NAT : colonnes, intitulés des quatre modes de NAT sortant (Automatic / Hybrid / Manual / Disable), liste « Filter rule association » — à vérifier. |
| `pfsense-gui-pkgmgr` | Interface web pfSense, System > Package Manager : onglets Installed Packages / Available Packages, colonnes, avertissement « Package is configured but not (fully) installed or deprecated » (cité par la fiche de TP), icônes réinstaller/supprimer, journal d’inst… |
| `pfsense-gui-rules` | Interface web pfSense, Firewall → Rules : colonnes (States, Protocol, Source, Port, Destination, Port, Gateway, Queue, Schedule, Description, Actions), libellés « Block private networks and loopback addresses », « Block bogon networks », « Anti-Lockout Rule »,… |
| `pfsense-gui-snort` | Interface web pfSense, paquet Snort : noms de fichiers (snort/snort_interfaces.php, snort_interfaces_edit.php, snort_rules.php, snort_alerts.php, snort_blocked.php, snort_passlist.php…), onglets (Snort Interfaces, Global Settings, Updates, Alerts, Blocked, Pas… |
| `pfsense-gui-snort-modes` | Snort sous pfSense : le moteur de détection du jeu applique les réglages à l’enregistrement et ne simule que le mode Legacy ; la vraie interface demande de redémarrer l’instance après certaines modifications et propose aussi le mode Inline (non simulé). |
| `pfsense-gui-squid` | Interface web pfSense, paquet Squid : onglets (General, Remote Cache, Local Cache, Antivirus, ACLs, Traffic Mgmt, Authentication, Users, Real Time, Status, Sync), noms de fichiers (pkg_edit.php?xml=squid.xml, squid_nac.xml, squid_monitor.php), libellés des cas… |
| `pfsense-gui-squid-errs` | Interface web pfSense, Squid > General : messages d’erreur à l’enregistrement (cache local non enregistré, AC absente pour l’interception SSL) reconstitués ; seule la contrainte est documentée par la fiche de TP. |
| `pfsense-gui-squidguard` | Interface web pfSense, paquet squidGuard : onglets (General settings, Common ACL, Groups ACL, Target categories, Times, Rewrites, Blacklist, Log, XMLRPC Sync), bouton Apply et ligne « SquidGuard service state: STARTED » (cités par la fiche de TP), cadre Target… |
| `pfsense-gui-status` | Interface web pfSense, Status/Diagnostics : disposition du tableau de bord (System Information, Interfaces, Gateways, Services Status), colonnes des journaux (Act, Time, Interface, Rule, Source, Destination, Protocol), format de l’état IPsec (Established / Dis… |
| `pfsense-gui-system` | Interface web pfSense, System/Interfaces/Services : intitulés des pages General Setup, Routing (Gateways, Static Routes), Cert. Manager, User Manager, Interfaces, DNS Resolver, messages de validation (ex. passerelle hors du sous-réseau de l’interface) — à véri… |
| `pfsense-gui-testport` | Interface web pfSense, Diagnostics → Test Port : texte du résultat (« Connection to … succeeded! ») — à vérifier. |
| `pfsense-gui-vpn` | Interface web pfSense, VPN : intitulés des pages IPsec (Tunnels, Phase 1, Phase 2) et OpenVPN (Servers), listes d’algorithmes et de groupes DH, libellés de colonnes — à vérifier. Le tableau des serveurs OpenVPN omet la colonne « Crypto » (le modèle ne porte pa… |
| `snort-block-legacy` | Snort sous pfSense, mode Legacy : toute alerte d’une interface avec « Block Offenders » inscrit l’adresse source (ou destination, ou les deux) dans la table snort2c, sauf adresse de la liste de passage ; libellé du journal de pare-feu pour ce blocage reconstit… |

## Windows Server — consoles graphiques (SRV-DC1 / SRV-FIC) (39)

Console MMC — une capture d'écran par fenêtre/onglet/boîte de dialogue citée (taille normale, thème par défaut).

| Tag | À confirmer |
|---|---|
| `aduc-gui` | Utilisateurs et ordinateurs Active Directory : arborescence (Builtin, Computers, Domain Controllers, ForeignSecurityPrincipals, Managed Service Accounts, Users), colonnes Nom/Type/Description, onglets Général/Compte/Membre de, grille des horaires d’accès, boît… |
| `aduc-gui-limits` | ADUC : seuls les onglets Général, Compte et Membre de d’un utilisateur, Général et Membres d’un groupe sont simulés (adresse, profil, téléphones, organisation, appel entrant, etc. absents) ; les horaires d’accès sont exprimés en UTC ; la suppression d’une unit… |
| `aduc-msg` | ADUC : textes des messages (compte désactivé/activé, confirmation de suppression, mot de passe réinitialisé, échec de complexité, accès refusé, objet protégé contre la suppression) reconstitués ; à vérifier par capture. |
| `browser-gui` | Navigateur : pages d’erreur (« Impossible d’accéder à ce site », ERR_NAME_NOT_RESOLVED, ERR_CONNECTION_TIMED_OUT, ERR_CONNECTION_REFUSED, ERR_ADDRESS_UNREACHABLE), page « Votre connexion n’est pas privée » (NET::ERR_CERT_*), pages d’erreur IIS et libellés reco… |
| `certlm-gui` | Certificats (ordinateur local) : magasins Personnel et Autorités de certification racines de confiance, colonnes et assistant « Inscription de certificats » (renouvellement avec la même clé auprès de CA-FormaTech) simplifiés et reconstitués de mémoire. |
| `compmgmt-ui` | Gestion de l’ordinateur : arborescence (Outils système, Dossiers partagés, Utilisateurs et groupes locaux, Services et applications) et partages par défaut (C$ « Partage par défaut », ADMIN$ « Administration à distance », IPC$ « IPC distant ») — libellés à vér… |
| `datetime-ui` | Date et heure : fenêtre simplifiée (heure automatique, modification manuelle, synchronisation) ; libellés à vérifier. |
| `dhcp-gui` | Console DHCP : arborescence (Étendue [id] nom, Pool d’adresses, Concessions d’adresses, Réservations, Options d’étendue, Options de serveur), colonnes, menus et boîtes de dialogue reconstitués de mémoire (version française) ; libellé « ** Inactive ** » et text… |
| `dhcp-gui-limits` | Console DHCP : l’assistant « Nouvelle étendue », les stratégies, les filtres, IPv6 et le basculement ne sont pas simulés (entrées grisées). |
| `dns-gui` | Gestionnaire DNS : arborescence (Zones de recherche directes/inversées, Points d’approbation, Redirecteurs conditionnels), libellés des types d’enregistrement (« Hôte (A) », « Alias (CNAME) », « Pointeur (PTR) »…), colonnes et boîtes de dialogue reconstitués d… |
| `dns-gui-limits` | Gestionnaire DNS : zones secondaires/stub, MX et autres types, délégations (assistant), vieillissement/nettoyage et mises à jour dynamiques (liste grisée, sans effet) ne sont pas simulés. |
| `dns-soa` | Gestionnaire DNS : la ligne « Début d’autorité (SOA) » est synthétisée (numéro de série compté par le simulateur, responsable « hostmaster ») car le modèle ne stocke pas de SOA ; format de la colonne Données à vérifier. |
| `domtrust-gui` | Domaines et approbations Active Directory : onglet Approbations, propriétés d’une approbation (Valider), assistant « Nouvelle approbation » simplifié ; textes de validation et d’échec reconstitués ; à vérifier par capture. |
| `evt-gui` | Observateur d’événements : arborescence, colonnes, volet Détail et libellés des actions reconstitués (version française) ; noms des journaux d’applications et de services (DHCP-Server, DNS Server, GroupPolicy) à vérifier par capture. |
| `explorer-ui` | Explorateur : libellés des colonnes, de la barre d’outils, des volets de navigation et messages d’erreur d’accès (« n’est pas accessible », 0x80070035, 0x80070043, « Accès au dossier refusé ») reconstitués de mémoire en français ; à vérifier par capture. |
| `fsprops-ui` | Propriétés de dossier (Partage / Sécurité / Paramètres de sécurité avancés / Accès effectif) : libellés français, noms des autorisations et textes des boîtes reconstitués de mémoire ; la liste détaillée des autorisations de l’onglet « Accès effectif » est une … |
| `gpmc-gui` | GPMC : arborescence (Forêt, Domaines, Objets de stratégie de groupe, Filtres WMI, Sites, Modélisation, Résultats), onglets « Objets de stratégie de groupe liés / Héritage / Étendue / Détails / Paramètres / Délégation », colonnes, menus contextuels et libellés … |
| `gpmc-gui-limits` | GPMC : modélisation de stratégie, filtres WMI, GPO Starter, sauvegarde/restauration, rapports HTML, délégation fine (seule la lecture est modélisée) et gestion des sites ne sont pas simulés ; ordre d’un nouveau lien (ajouté en dernier) à vérifier. |
| `gpresult-gui` | Résultats de stratégie de groupe (GPMC) : assistant simplifié et libellés des raisons de refus (« Filtrage de sécurité », « Désactivé(e) ») reconstitués ; à vérifier par capture. |
| `iis-400-host` | Nom d’hôte non valide. |
| `iis-401-3` | Vous n’avez pas l’autorisation d’afficher ce répertoire ou cette page avec les informations d’identification que vous avez fournies (accès refusé en raison de listes de contrôle d’accès). |
| `iis-403-14` | Un document par défaut n’est pas configuré pour l’URL demandée et l’exploration de répertoire n’est pas activée sur le serveur. |
| `iis-404-0` | Le répertoire ou le fichier que vous recherchez a été supprimé, a changé de nom ou est temporairement indisponible. |
| `iis-503` | Service indisponible. |
| `iis-gui` | Gestionnaire IIS : arborescence (Pools d’applications, Sites), colonnes, boîte « Liaisons de sites », « Modifier la liaison de site », « Documents par défaut », « Certificats de serveur » reconstitués de mémoire (version française). |
| `iis-gui-limits` | Gestionnaire IIS : seules les fonctionnalités Certificats de serveur, Documents par défaut, Liaisons, Pools d’applications et démarrage/arrêt de site/serveur sont simulées (pas de Module, Authentification, Journalisation, etc.). |
| `iisreset-fr` | iisreset : messages français (« Tentative d’arrêt… », « Arrêt d’Internet services réussi », « Tentative de démarrage… », « Redémarrage d’Internet services réussi ») et options /stop /start /restart /status reconstitués de mémoire. |
| `inetcpl-gui` | Options Internet (inetcpl.cpl) : onglets de la feuille « Propriétés de : Internet », libellés du bouton « Paramètres réseau », de la fenêtre « Paramètres du réseau local (LAN) » (cases « Utiliser un serveur proxy pour votre réseau local », « Ne pas utiliser de… |
| `ls-format` | Mise en forme de ls (colonnes, ls -l, dates « Oct 27 07:12 », total en blocs de 1 Kio) : approximation de coreutils 9.x. |
| `lusrmgr-ui` | Utilisateurs et groupes locaux : colonnes, onglets « Général / Membre de » et message d’indisponibilité sur un contrôleur de domaine reconstitués de mémoire — à vérifier par capture. |
| `mmc-remote` | Connexion à un autre ordinateur depuis une console MMC : texte de la boîte « Sélectionner un ordinateur » et des messages d’échec reconstitués. |
| `ncpa-gui` | Connexions réseau (ncpa.cpl) : barre d’outils, libellés d’état, boîtes « État », « Détails de connexion réseau », « Propriétés de Ethernet » (liste des composants) et « Propriétés de Protocole Internet version 4 (TCP/IPv4) » reconstitués de mémoire (français) … |
| `rig-printer-lcd` | Panneau de l’imprimante : arborescence de menus générique (Informations / Réseau / Redémarrer) ; les libellés réels dépendent du constructeur — à vérifier si un modèle précis doit être imité. |
| `servermgr-ui` | Gestionnaire de serveur : arborescence, libellés des tuiles (« Facilité de gestion », « Événements », « Services »), menus Gérer / Outils / Afficher / Aide, volet « Propriétés » du serveur local — reconstitués de mémoire en français ; les lignes Performances e… |
| `squid-log-cols` | Squid (Services > Squid Proxy Server > Real Time) : colonnes du tableau « Squid - Access Logs » (Date, IP, Status, Address, Destination) et formats TCP_TUNNEL/200, TCP_MISS/200, TCP_DENIED/403 : les statuts viennent de la fiche de TP ; les colonnes et l’ordre … |
| `svc-gui` | Services (services.msc) : libellés des colonnes, du menu contextuel, des boîtes « Propriétés » et « Contrôle de service », message d’erreur « Windows n’a pas pu démarrer le service… » reconstitués ; descriptions des services volontairement absentes (non vérifi… |
| `sysprops-remote` | Propriétés système › onglet « Utilisation à distance » : libellés des options (« Ne pas autoriser… », « Autoriser les connexions à distance à cet ordinateur », authentification au niveau du réseau) reconstitués de mémoire ; l’option NLA n’est pas modélisée (ca… |
| `wf-gui` | Pare-feu Windows Defender avec fonctions avancées de sécurité : arborescence, colonnes (Nom, Groupe, Profil, Activé, Action…), menus, boîte de propriétés (Général / Protocoles et ports / Avancé), assistant « Nouvelle règle » (type Port) et « Propriétés du pare… |
| `wf-gui-limits` | Pare-feu avancé : règles de programme, personnalisées, de sécurité de connexion, analyse, filtrage par profil/groupe et export non simulés ; règles sortantes listées sans création. |

## Windows — ligne de commande / PowerShell (26)

cmd / PowerShell — copier le texte brut de la sortie (police fixe), sur Windows Server 2022 et Windows 10 en français.

| Tag | À confirmer |
|---|---|
| `gpresult-fr` | gpresult /r en français : intitulés de sections (PARAMÈTRES DE L’ORDINATEUR / DE L’UTILISATEUR, Objets de stratégie de groupe appliqués, motifs de filtrage) reconstitués de mémoire. |
| `icacls-fr` | icacls : format des ACE ((OI)(CI)(F)…) exact ; message final « n fichiers ont été correctement traités ; échec du traitement de 0 fichiers » reconstitué. |
| `ipconfig-adapter-disabled` | ipconfig n’affiche pas les cartes désactivées (état « Désactivé ») : comportement attendu de Windows, à confirmer par capture. |
| `ipconfig-elevation` | ipconfig /release et /renew exigent une élévation sous Windows 10 (message « L’opération demandée nécessite une élévation. ») ; /flushdns autorisé ici sans élévation : à vérifier. |
| `ipconfig-format` | ipconfig / ipconfig /all : libellés français, colonne des deux-points et pointillés reconstitués de mémoire (numéro de colonne, libellés « Type de nœud », « Routage IP activé », IAID/DUID DHCPv6), à valider par capture. |
| `net-cmd-fr` | Sorties de net use / view / user / group / share / time / accounts / start / stop en français : libellés et mise en page reconstitués de mémoire. |
| `net-share-write-fr` | net share Nom=chemin /GRANT: /REMARK: /DELETE : messages de succès (« … a été partagé. », « … a été supprimé. ») et erreurs 2118 / 2310 / 3 en français reconstitués de mémoire. |
| `netsh-fr` | netsh interface ip / advfirewall : libellés français reconstitués de mémoire. |
| `netsh-set-interface` | netsh interface set interface name="…" admin=enabled/disabled : exécution silencieuse (pas de message) et mot-clé « admin » en anglais reconstitués de mémoire. |
| `netstat-arp-route-format` | netstat -an, arp -a, route print : en-têtes et libellés français reconstitués de mémoire. |
| `nltest-fr` | nltest /dsgetdc, /sc_query : libellés français et indicateurs reconstitués de mémoire. |
| `nslookup-format` | nslookup en français : « Serveur : », « Address: », « Nom : », « Réponse ne faisant pas autorité : », « *** x ne parvient pas à trouver y: Non-existent domain », délais « DNS request timed out. / timeout was 2 seconds. » — reconstitués de mémoire. |
| `ping-fr-format` | ping en français : « Envoi d’une requête 'Ping' … », « Réponse de … : octets=32 temps<1ms TTL=… », « Statistiques Ping pour … », « Délai d’attente de la demande dépassé. », « Impossible de joindre l’hôte/le réseau de destination. », « Échec de la transmission.… |
| `ping-linux-format` | Sortie d’iputils-ping sur Debian 13 (ligne d’en-tête, temps avec décimales, statistiques) : approximation. |
| `ps-confirm` | Invite de confirmation PowerShell de Remove-SmbShare, Revoke-SmbShareAccess et Disable-NetAdapter : structure « Confirmer / Voulez-vous vraiment effectuer cette action ? / Opération « … » en cours sur la cible « … » » et ligne de choix « [O] Oui  [T] Oui pour … |
| `ps-divzero` | Division par zéro en PowerShell : message « Tentative de division par zéro. » reconstitué de mémoire (la vraie sortie ajoute les lignes « Au caractère Ligne:1 : … » et CategoryInfo). |
| `ps-errors-fr` | Messages d’erreur PowerShell en français (« n’est pas reconnu en tant que nom d’applet de commande… », « Impossible de trouver un service… », « Ce nom n’existe pas. ») reconstitués de mémoire. |
| `ps-format` | Sortie de ps aux (colonnes, processus noyau et systemd, tailles mémoire) : plausible, non issue d’une capture. |
| `ps-formats` | Mise en forme PowerShell (tables, listes, en-têtes de Get-WinEvent, Get-Service, Get-DhcpServerv4Scope, Get-DnsServerResourceRecord…) : colonnes fidèles aux propriétés réelles, largeurs et libellés d’erreur en français reconstitués de mémoire. |
| `ps-iis` | Get-Website / Start-Website / Stop-Website / Get-WebBinding / Set-WebBinding / Get-IISSite / Start-IISSite / Stop-IISSite : colonnes (Name, ID, State, Physical Path, Bindings ; protocol, bindingInformation, sslFlags), PhysicalPath en %SystemDrive%, libellé « S… |
| `ps-netadapter-admin` | Enable-NetAdapter / Disable-NetAdapter : Enable s’exécute sans invite, Disable demande confirmation sans -Confirm:$false (voir ps-confirm) ; Get-NetAdapter affiche « Disabled » pour une carte désactivée (LinkSpeed 0 bps) — à confirmer par capture. |
| `ps-smb-write` | New-SmbShare / Remove-SmbShare / Grant-SmbShareAccess / Revoke-SmbShareAccess : paramètres, objets retournés et messages d’erreur reconstitués de mémoire (l’invite de confirmation de Remove-/Revoke- sans -Force est émulée : voir ps-confirm). |
| `sc-fr` | Sorties de sc query / qc / start / stop en français : libellés (NOM_SERVICE, ÉTAT, TYPE_DÉMARRAGE…) reconstitués de mémoire. |
| `tracert-format` | tracert en français : « Détermination de l’itinéraire vers … », « avec un maximum de 30 sauts : », « Itinéraire déterminé. », « signale : » — reconstitués de mémoire. |
| `w32tm-fr` | w32tm /query /status en français : libellés (Indicateur de saut, Strate, ID de référence…) reconstitués de mémoire. |
| `win-fr-syntax-errors` | Messages d’erreur cmd.exe en français : « n’est pas reconnu en tant que commande interne ou externe, un programme exécutable ou un fichier de commandes. », « Le chemin d’accès spécifié est introuvable. », « Accès refusé. » — reconstitués de mémoire, à valider … |

## Windows Client (PC-01 / PC-02) — ouverture de session et messages système (18)

Poste Windows 10 en français — capture de l'écran de connexion et des boîtes de message (une par cas), texte exact.

| Tag | À confirmer |
|---|---|
| `curl-win-errors` | Messages d’erreur de curl.exe sous Windows (schannel) : formulation exacte non vérifiée pour les erreurs de certificat. |
| `logon-acctexp` | Votre compte a expiré. Contactez votre administrateur système. |
| `logon-badpwd` | Le nom d’utilisateur ou le mot de passe est incorrect. |
| `logon-disabled` | Votre compte a été désactivé. Contactez votre administrateur système. |
| `logon-hours` | Votre compte a des restrictions d’horaire qui vous empêchent de vous connecter pour le moment. Réessayez plus tard. |
| `logon-locked` | Le compte référencé est actuellement verrouillé et ne peut pas être utilisé pour ouvrir une session. |
| `logon-nologon` | Il n’y a actuellement aucun serveur d’ouverture de session disponible pour traiter la demande d’ouverture de session. |
| `logon-pwdexp` | Votre mot de passe a expiré et doit être modifié. |
| `logon-secure` | La relation d’approbation entre cette station de travail et le domaine principal a échoué. |
| `logon-time` | Le décalage horaire entre le client et le serveur est trop important. |
| `logon-workstation` | Votre compte est configuré de façon à vous empêcher d’utiliser cet ordinateur. Essayez un autre ordinateur. |
| `ncpa-ipv4-validation` | Propriétés TCP/IPv4 : Windows peut avertir lorsque la passerelle n’appartient pas au sous-réseau défini ; le simulateur accepte la saisie sans avertissement (texte exact non vérifié). C’est volontairement plus permissif que la réalité. |
| `svc-nlasvc-name` | Connaissance des emplacements réseau |
| `win-cmd-banner` | Bannière cmd.exe : « Microsoft Windows [version 10.0.<build>] » + « (c) Microsoft Corporation. Tous droits réservés. » ; numéro de révision de build non connu (19045.x / 20348.x). |
| `win-logon-ui` | Écran de connexion Windows (verrouillage, tuile « Autre utilisateur », libellé « Se connecter à : DOMAINE », message de changement de mot de passe, « Bienvenue ») : libellés reconstitués ; à vérifier par capture. |
| `win-nosignal` | Écran « aucun signal » : le texte exact varie selon le moniteur (marque inconnue) ; le simulateur affiche un message générique en français avec le nom de l’entrée active. |
| `win-start-icon` | Légal : le bouton Démarrer utilise un pictogramme original (grille de points), et non le logo Windows protégé. |
| `win-ui-texts` | Libellés de l’interface Windows reproduits de mémoire (boîtes UAC, Exécuter, menu Démarrer, info-bulles réseau) : à vérifier par capture (Windows 10 22H2 / Server 2022 en français). |

## Observateur d'événements (Event ID) (1)

Observateur d'événements — pour chaque ID : journal, source, niveau, texte exact du message en français.

| Tag | À confirmer |
|---|---|
| `rig-osd` | Menu OSD de l’écran : libellés génériques (Luminosité, Contraste, Source d’entrée, Langue, Réinitialiser) et noms de sources (DisplayPort, HDMI 1, HDMI 2, VGA) ; les menus réels varient selon le constructeur — à vérifier si un modèle précis doit être imité. |

## Autre (à ranger) (17)

| Tag | À confirmer |
|---|---|
| `browser-gui-proxy` | Navigateur, erreurs liées au proxy : ERR_PROXY_CONNECTION_FAILED, ERR_TUNNEL_CONNECTION_FAILED (titre « Désolé, impossible d’accéder à cette page », cité par la fiche de TP) et ERR_SSL_PROTOCOL_ERROR (titre « La connexion de ce site n’est pas sécurisée », cité… |
| `l2-po-create` | Création automatique de l’interface « Port-channel N » par « channel-group » : ligne « Creating a port-channel interface Port-channel N » reprise du cours (Packet Tracer) ; la recopie du mode / VLAN / VLAN autorisés du premier membre vers la nouvelle interface… |
| `l2-root-macro` | « spanning-tree vlan N root primary / secondary » : le simulateur applique la règle publiée (24576 / 28672, ou 4096 de moins que la racine actuelle si sa priorité est inférieure) et affiche la priorité résultante dans le running-config ; les messages exacts en… |
| `l2-stp-none` | Messages « Spanning tree instance(s) for vlan N does not exist. » et « No spanning tree instance exists. » (STP désactivé pour le VLAN) : reconstitués de mémoire. |
| `l2-stp-portfast-warn` | Avertissements affichés par « spanning-tree portfast » en mode interface (« %Warning: portfast should only be enabled on ports connected to a single host… » et « %Portfast has been configured on … ») : texte reconstitué de mémoire. |
| `l2-stp-prio-err` | Message d’erreur de « spanning-tree vlan N priority X » quand X n’est pas un multiple de 4096 (« % Bridge Priority must be in increments of 4096. » et liste des valeurs permises) : reconstitué de mémoire. |
| `pannes-snort` | Pannes du lot Snort : comportement de Snort face à une règle personnelle invalide (ici : l’instance ne démarre pas), à un HOME_NET personnalisé invalide (ne démarre pas), à un blocage sur l’adresse de destination protégée par la liste de passage (aucun blocage… |
| `rig-voyants` | Voyants de port : vert fixe = liaison établie, orange = port désactivé / err-disabled, éteint = pas de liaison. Le comportement exact (clignotement d’activité, couleurs de la face avant d’un Catalyst) n’est pas reproduit. |
| `sched-dhcp-retry` | Intervalle de réessai DHCP du client Windows sans bail : 300 s utilisés dans la simulation ; valeur exacte à vérifier. |
| `sg-block-page` | squidGuard : page de blocage affichée pour un site HTTP refusé (texte reconstitué ; la fiche de TP ne montre que le cas HTTPS, erreur du navigateur). |
| `sg-cats` | squidGuard : liste de catégories (noms blk_blacklists_xxx) reconstituée de mémoire à partir de la liste UT1 (la fiche de TP annonce 69 catégories ; la liste affichée est partielle) ; le contenu des catégories (quels domaines) est fictif et réduit à quelques no… |
| `sg-log-line` | squidGuard (Log > Blocked) : format de ligne « date [pid] Request(règle/catégorie/-) hôte:port ip/- - MÉTHODE REDIRECT » reconstitué ; la fiche de TP donne les éléments (IP, site, default, catégorie, CONNECT REDIRECT) sans la mise en forme exacte. |
| `snort-classtypes` | Snort : libellés et priorités par défaut des classtype (classification.config) — repris de mémoire pour une dizaine de classtype ; une valeur absente de la table est affichée telle quelle. |
| `squid-errpage` | Squid : page d’erreur par défaut en anglais (« ERROR / The requested URL could not be retrieved / Access Denied. / Access control configuration prevents your request from being allowed at this time. / Generated … by <hôte> (squid/6.3) ») et textes ERR_DNS_FAIL… |
| `squid-log-sg-explicit` | Squid, mode explicite : ligne du journal d’accès quand squidGuard refuse un CONNECT — la fiche de TP ne la montre pas (seul le journal « Blocked » de squidGuard est documenté) ; TCP_DENIED/403 est une hypothèse. |
| `squid-trans-blacklist-err` | Squid, mode transparent + Splice All : code d’erreur du navigateur quand un site de la Blacklist de Squid est refusé — la fiche de TP ne le précise que pour squidGuard (ERR_SSL_PROTOCOL_ERROR) ; le même code est repris par hypothèse. |
| `ssh-hostkey-fpr` | Empreintes de clé d’hôte : valeurs synthétiques stables par équipement, ce ne sont pas de vraies empreintes. |
