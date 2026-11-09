# Inventaire des commandes réelles et réponse du simulateur (D-99)

_Généré par `node tests/inventory-commands.js` — ne pas éditer à la main. Relance après chaque livraison._

**Ce que ce document est.** Une liste de commandes que je sais réelles (usage courant d'un admin), passée dans les émulateurs sur un monde sain. Classes : `ok` (une sortie est produite), `non gérée` (le terminal le dit), **`INTROUVABLE`** (le simulateur répond « inconnue » alors que la commande existe : violation de D-99), **`sans effet`** (commande de configuration IOS acceptée, running-config inchangé : à traiter par l'avis de couche jeu).

**Ce qu'il n'est pas.** (1) Ce n'est pas un inventaire exhaustif : il n'existe pas, dans le projet, de liste de référence de « toutes les commandes réelles » ; l'exhaustivité est **non établie** (il faut une source : TP du cours, aide-mémoire, documentation éditeur). (2) La classe « réelle » de chaque ligne repose sur ma connaissance de ces commandes, sans lien vers la documentation de l'éditeur : **source à joindre, donc « à vérifier »** au sens de D-99.3. (3) « ok » veut dire qu'une sortie est produite, pas que son format est authentique (voir `docs/A-VERIFIER.md`).

**Réponse cible** : `INTROUVABLE` → « non gérée par le simulateur » (couche jeu, visuellement distincte) ; `sans effet` → accepter **et** afficher l'avis de couche jeu « acceptée, sans effet dans le simulateur » (ne jamais refuser : cela casserait le collage d'une configuration de TP).

## Synthèse

| Plateforme | Commandes essayées | ok | non gérée | INTROUVABLE | sans effet |
|---|--:|--:|--:|--:|--:|
| Windows cmd | 49 | 31 | 17 | 1 | 0 |
| PowerShell | 64 | 34 | 21 | 9 | 0 |
| Linux (bash) | 86 | 62 | 2 | 22 | 0 |
| SQL (mysql) | 27 | 16 | 3 | 8 | 0 |
| Cisco IOS (SW-CA) | 66 | 32 | 1 | 33 | 0 |
| Cisco IOS (R-LB3) | 66 | 33 | 0 | 33 | 0 |
| Cisco IOS config (SW-CA) | 38 | 23 | 0 | 11 | 4 |
| Cisco IOS config (R-LB3) | 32 | 16 | 0 | 13 | 3 |

## Écarts (à corriger : plateforme, commande, réponse actuelle, réponse cible)

| Plateforme | Commande | Classe | Réponse actuelle (1re ligne) | Réponse cible |
|---|---|---|---|---|
| Windows cmd | `telnet` | INTROUVABLE | 'telnet' n’est pas reconnu en tant que commande interne | non gérée par le simulateur |
| PowerShell | `Get-ADDomain` | INTROUVABLE | Get-ADDomain : Le terme «Get-ADDomain» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichi | non gérée par le simulateur |
| PowerShell | `Get-Website` | INTROUVABLE | Get-Website : Le terme «Get-Website» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier | non gérée par le simulateur |
| PowerShell | `Install-WindowsFeature -Name DHCP` | INTROUVABLE | Install-WindowsFeature : Le terme «Install-WindowsFeature» n’est pas reconnu en tant que nom d’applet de comma | non gérée par le simulateur |
| PowerShell | `Get-WindowsFeature` | INTROUVABLE | Get-WindowsFeature : Le terme «Get-WindowsFeature» n’est pas reconnu en tant que nom d’applet de commande, fon | non gérée par le simulateur |
| PowerShell | `Get-DhcpServerInDC` | INTROUVABLE | Get-DhcpServerInDC : Le terme «Get-DhcpServerInDC» n’est pas reconnu en tant que nom d’applet de commande, fon | non gérée par le simulateur |
| PowerShell | `Get-WebBinding` | INTROUVABLE | Get-WebBinding : Le terme «Get-WebBinding» n’est pas reconnu en tant que nom d’applet de commande, fonction, f | non gérée par le simulateur |
| PowerShell | `Import-Module ActiveDirectory` | INTROUVABLE | Import-Module : Le terme «Import-Module» n’est pas reconnu en tant que nom d’applet de commande, fonction, fic | non gérée par le simulateur |
| PowerShell | `Out-File -FilePath C:\x.txt` | INTROUVABLE | Out-File : Le terme «Out-File» n’est pas reconnu en tant que nom d’applet de commande, fonction, fichier de sc | non gérée par le simulateur |
| PowerShell | `Get-Credential` | INTROUVABLE | Get-Credential : Le terme «Get-Credential» n’est pas reconnu en tant que nom d’applet de commande, fonction, f | non gérée par le simulateur |
| Linux (bash) | `netstat -tulpn` | INTROUVABLE | bash: netstat: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `wget -q http://localhost` | INTROUVABLE | bash: wget: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `dpkg -l` | INTROUVABLE | bash: dpkg: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `iptables -L` | INTROUVABLE | bash: iptables: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `nft list ruleset` | INTROUVABLE | bash: nft: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `fdisk -l` | INTROUVABLE | bash: fdisk: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `tar --version` | INTROUVABLE | bash: tar: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `rsync --version` | INTROUVABLE | bash: rsync: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `tcpdump -h` | INTROUVABLE | bash: tcpdump: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `nmap --version` | INTROUVABLE | bash: nmap: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `lsof -i` | INTROUVABLE | bash: lsof: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `resolvectl status` | INTROUVABLE | bash: resolvectl: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `systemd-resolve --status` | INTROUVABLE | bash: systemd-resolve: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `lsmod` | INTROUVABLE | bash: lsmod: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `chage -l root` | INTROUVABLE | bash: chage: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `visudo -c` | INTROUVABLE | bash: visudo: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `sysctl -a` | INTROUVABLE | bash: sysctl: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `certbot certificates` | INTROUVABLE | bash: certbot: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `openssl version` | INTROUVABLE | bash: openssl: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `openssl x509 -noout -dates -in /etc/ssl/certs/ssl-cert-snakeoil.pem` | INTROUVABLE | bash: openssl: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `dpkg -L openssh-server` | INTROUVABLE | bash: dpkg: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Linux (bash) | `logrotate -d /etc/logrotate.conf` | INTROUVABLE | bash: logrotate: command not found | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| SQL (mysql) | `SHOW PROCESSLIST;` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `SHOW STATUS;` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `SHOW VARIABLES LIKE "port";` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `STATUS;` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `SHOW CREATE DATABASE mysql;` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `SHOW ENGINES;` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `SHOW CHARACTER SET;` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| SQL (mysql) | `SELECT NOW();` | INTROUVABLE | ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB se | non gérée par le simulateur |
| Cisco IOS (SW-CA) | `show spanning-tree summary` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show etherchannel port-channel` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip protocols` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip ospf` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip ospf neighbor` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip ospf database` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip ospf interface brief` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show lldp neighbors` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show standby brief` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show vtp status` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip nat translations` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show line` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ntp status` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip dhcp binding` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip dhcp pool` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip dhcp conflict` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show flash:` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show inventory` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show environment` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show processes cpu` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show memory` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show errdisable recovery` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show errdisable detection` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip eigrp neighbors` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip bgp summary` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip cef` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ipv6 interface brief` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show monitor` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show ip interface GigabitEthernet0/1` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show controllers` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `show tech-support` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `clear ip ospf process` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (SW-CA) | `reload cancel` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show interfaces status` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show interfaces trunk` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show vlan brief` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show mac address-table` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show spanning-tree` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show spanning-tree summary` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show etherchannel summary` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show etherchannel` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show etherchannel port-channel` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show ip ospf database` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show lldp neighbors` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show standby brief` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show vtp status` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show port-security` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show port-security interface FastEthernet0/1` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show line` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show ntp status` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show flash:` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show inventory` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show environment` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show processes cpu` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show memory` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show errdisable recovery` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show errdisable detection` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show ip eigrp neighbors` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show ip bgp summary` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show ip cef` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show ipv6 interface brief` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show monitor` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show vlan id 10` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show controllers` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `show tech-support` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS (R-LB3) | `reload cancel` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `interface FastEthernet0/5 ▸ switchport mode access` | sans effet | (acceptée, running-config inchangé) | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `interface FastEthernet0/5 ▸ storm-control broadcast level 20` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `spanning-tree vlan 10 priority 4096` | sans effet | (acceptée, running-config inchangé) | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `errdisable recovery cause psecure-violation` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `vtp mode transparent` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `lldp run` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `no cdp run` | sans effet | Commande acceptée, sans effet dans le simulateur : « no cdp run » n’est pas prise en compte (« show cdp neighb | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `service password-encryption` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `ip dhcp snooping` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `ip arp inspection vlan 10` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `udld enable` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `mls qos` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `ip igmp snooping` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `system mtu 1500` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (SW-CA) | `hostname SW-CA` | sans effet | (acceptée, running-config inchangé) | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `interface GigabitEthernet0/0 ▸ ip ospf network point-to-point` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `interface GigabitEthernet0/0 ▸ standby 1 ip 10.30.1.254` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `interface GigabitEthernet0/0 ▸ standby 1 priority 110` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `interface GigabitEthernet0/0 ▸ standby 1 preempt` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `interface GigabitEthernet0/0 ▸ ip ospf authentication message-digest` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `interface GigabitEthernet0/0 ▸ bandwidth 1000000` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `router ospf 1 ▸ router-id 10.30.255.3` | sans effet | (acceptée, running-config inchangé) | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `router ospf 1 ▸ area 1 stub` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `router ospf 1 ▸ area 1 range 10.30.0.0 255.255.0.0` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `router ospf 1 ▸ maximum-paths 4` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `router ospf 1 ▸ log-adjacency-changes` | sans effet | (acceptée, running-config inchangé) | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `ip sla 1` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `ip ssh version 2` | sans effet | (acceptée, running-config inchangé) | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `ip flow-export version 9` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `ip cef` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |
| Cisco IOS config (R-LB3) | `ipv6 unicast-routing` | INTROUVABLE | % Invalid input detected at '^' marker. | **à vérifier sur machine de référence (R-77) — comportement inchangé** |

## Réserves avant de corriger (à trancher par le projet)

- **Linux : « command not found » n'est pas toujours faux.** Sur une Debian réelle, une commande fournie par un paquet non installé répond exactement `bash: <cmd>: command not found`. Ce qui est « installé par défaut » sur la cible du jeu (Debian 13, installation minimale ou non) n'est **pas établi** dans le projet : les lignes Linux ci-dessus ne sont donc pas toutes des violations de D-99. Il faut une liste sourcée « paquets présents sur SRV-LNX / SRV-WEB » ; ensuite, `apt install <paquet>` doit faire apparaître la commande (réponse « non gérée » si elle n'est pas émulée). À vérifier.
- **PowerShell : modules.** Les applets de modules RSAT (Active Directory, DHCP, DNS, GroupPolicy) existent sur un contrôleur de domaine (essayé ici sur SRV-DC1) mais pas sur un poste client sans RSAT : la réponse correcte dépend de l'hôte. Les lignes ci-dessus sont celles d'un DC.
- **IOS : disponibilité selon la plateforme et la version.** Une commande réelle peut être absente d'un modèle (commutateur de couche 2 sans `ip routing`, routeur 2911 sans `spanning-tree`…) : `% Invalid input` est alors authentique. Les lignes `INTROUVABLE` doivent être confrontées à la plateforme simulée (2911 / commutateur de la fiche) avant correction ; sans source, la réponse cible reste « à vérifier ». Les commandes en erreur sur les deux appareils sont les plus sûres à traiter.
- **SQL.** Les instructions `SHOW …` ci-dessus sont des instructions MariaDB réelles ; la console n'en émule qu'une partie (comptes, droits, bases).

## Commandes signalées « non gérée » (conformes à D-99)

- Windows cmd : `nbtstat -n`
- Windows cmd : `dcdiag`
- Windows cmd : `repadmin /replsummary`
- Windows cmd : `schtasks /query`
- Windows cmd : `wevtutil qe System /c:1`
- Windows cmd : `taskkill /im notepad.exe`
- Windows cmd : `query user`
- Windows cmd : `driverquery`
- Windows cmd : `certutil -?`
- Windows cmd : `ftp`
- Windows cmd : `diskpart`
- Windows cmd : `fsutil fsinfo drives`
- Windows cmd : `cipher /?`
- Windows cmd : `wmic os get caption`
- Windows cmd : `sfc /?`
- Windows cmd : `chkdsk`
- Windows cmd : `help`
- PowerShell : `Get-GPO -All`
- PowerShell : `Get-HotFix`
- PowerShell : `Get-ComputerInfo`
- PowerShell : `Get-NetRoute`
- PowerShell : `Get-Acl C:\`
- PowerShell : `Get-Volume`
- PowerShell : `Get-Disk`
- PowerShell : `Get-LocalUser`
- PowerShell : `Get-ScheduledTask`
- PowerShell : `Invoke-Command -ComputerName SRV-FIC -ScriptBlock { hostname }`
- PowerShell : `Enter-PSSession -ComputerName SRV-FIC`
- PowerShell : `Get-Item C:\`
- PowerShell : `Get-ItemProperty HKLM:\SOFTWARE`
- PowerShell : `Test-ComputerSecureChannel`
- PowerShell : `Get-NetAdapterBinding`
- PowerShell : `Set-NetIPAddress -IPAddress 10.10.0.5 -InterfaceAlias Ethernet`
- PowerShell : `New-GPLink -Name x -Target y`
- PowerShell : `Set-GPLink -Name x -Target y`
- PowerShell : `Get-NetTCPConnection`
- PowerShell : `Get-Printer`
- PowerShell : `Get-Module -ListAvailable`
- Linux (bash) : `man ls`
- Linux (bash) : `help`
- SQL (mysql) : `EXPLAIN SELECT 1;`
- SQL (mysql) : `DESCRIBE mysql.user;`
- SQL (mysql) : `SELECT COUNT(*) FROM mysql.user;`
- Cisco IOS (SW-CA) : `show etherchannel`

## Pour le relevé R-77 : ce que le simulateur déclare (et rien de plus)

**Modèles IOS déclarés par `show version`**, regroupés par sortie. Ce sont des valeurs de contenu du simulateur, **à vérifier** (clé `ios-version-text`) : aucune n'a été relevée sur un appareil.

| Image / version déclarée | Matériel déclaré | Appareils |
|---|---|---|
| Cisco IOS Software, C3560 Software (C3560-IPSERVICESK9-M), Version 12.2(55)SE12 | cisco WS-C3560-24PS-S (PowerPC405) processor (revision G0) | SW-T1, SW-CA |
| Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4 | cisco WS-C2960-24TT-L (PowerPC405) processor (revision N0) | SW-T2, SW-T3, SW-B1, SW-CB, SW-CC |
| Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.2(4)M3 | Cisco CISCO2911/K9 (revision 1.0) | R-B1, R-RV1, R-LB1, R-LB2, R-LB3, R-LB4, R-LB5, R-LB6 |

**Linux : paquets.** Le simulateur déclare, comme paquets installés par défaut, **curl, nano, bind9-host, bind9-dnsutils, mariadb-client** (`B.DEFAULT_PKGS`, `apt list --installed` ne montre que ceux-là, plus ceux que le joueur installe). **Quels paquets le TP Linux installe réellement : non établi** — aucun document du dépôt ne le dit ; `docs/LIMITES.md` affirme seulement que `netstat`, `ifconfig` et `traceroute` ne sont pas installés par défaut « comme sur la VM Debian du laboratoire », sans liste. **Incohérence interne constatée, non corrigée** (D-99 : aucun changement Linux sans relevé) : le serveur exécute `apache2`, `mariadb`, `nginx`, `bind9`, `ufw`, `ssh` (services visibles par `systemctl`), mais `apt list --installed` ne liste pas les paquets serveur correspondants.
