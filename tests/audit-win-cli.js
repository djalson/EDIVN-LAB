/* Audit « existence de la commande réelle » — Windows / Active Directory.
   Pour chaque famille de réparation Windows (classes extraites des étapes de correction de toutes les pannes × variantes), on liste la commande ou l'applet de commande que
   ferait un administrateur et on vérifie si le simulateur la CONNAÎT (cmd / PowerShell, session élevée). Ce n'est PAS un test de réparation : ces pannes se réparent d'abord dans les consoles graphiques
   (couvertes par les tests de consoles) ; l'audit dit seulement ce qu'un étudiant qui préfère PowerShell trouvera ou non. Sortie : tableau, code retour 0.
   Usage : node tests/audit-win-cli.js */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const F = SIM.fault;
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const text = r => r.out.map(x => x.t).join('\n');
const ps = dev => { const sh = SIM.emu.openWinShell(env, dev, { elevated: true, user: 'Administrateur' }); return sh.exec('powershell').push; };
const known = (dev, line) => { const o = text(ps(dev).exec(line)); return /non gérée? par le simulateur/.test(o) ? 'flag' : /is not recognized|n’est pas reconnu|n'est pas reconnu|not recognized as the name/i.test(o) ? 'absent' : 'ok'; };
/* famille → [cmdlet ou commande réelle, équipement où l'essayer, pannes concernées] */
const FAM = [
  ['Compte AD : déverrouiller', 'Unlock-ADAccount -Identity x', 'SRV-DC1', 'ad_locked, gpo_compte'], ['Compte AD : activer', 'Enable-ADAccount -Identity x', 'SRV-DC1', 'ad_disabled'],
  ['Compte AD : expiration', 'Clear-ADAccountExpiration -Identity x', 'SRV-DC1', 'ad_acct_expired'], ['Compte AD : mot de passe', 'Set-ADAccountPassword -Identity x', 'SRV-DC1', 'ad_pwd_expired'],
  ['Compte AD : horaires / postes autorisés', 'Set-ADUser -Identity x -LogonWorkstations a', 'SRV-DC1', 'ad_restrict'], ['Groupe AD : ajout de membre', 'Add-ADGroupMember -Identity g -Members u', 'SRV-DC1', 'ad_agdlp_member'],
  ['Ordinateur AD : déplacer dans une OU', 'Move-ADObject -Identity x -TargetPath y', 'SRV-DC1', 'ad_ou_move'], ['Canal sécurisé du poste', 'Test-ComputerSecureChannel -Repair', 'PC-01', 'ad_secure_channel'],
  ['Approbation de domaine', 'netdom trust a /domain:b /verify', 'SRV-DC1', 'ad_trust, ad_trust_dir'], ['Heure (w32tm)', 'w32tm /resync', 'PC-01', 'ad_time, ad_time_dc'],
  ['GPO : lien', 'Set-GPLink -Name x -Target y', 'SRV-DC1', 'gpo_link'], ['GPO : héritage bloqué', 'Set-GPInheritance -Target x -IsBlocked No', 'SRV-DC1', 'gpo_block'], ['GPO : filtrage de sécurité', 'Set-GPPermission -Name x -TargetName y -TargetType Group -PermissionLevel GpoApply', 'SRV-DC1', 'gpo_secfilter, gpo_ms16072'],
  ['GPO : actualisation poste', 'gpupdate /force', 'PC-01', 'gpo_* (côté client)'],
  ['DHCP : autoriser le serveur', 'Add-DhcpServerInDC -DnsName x', 'SRV-DC1', 'dhcp_unauth, dhcp_unauth_bdx'], ['DHCP : étendue (état)', 'Set-DhcpServerv4Scope -ScopeId 10.10.20.0 -State Active', 'SRV-DC1', 'dhcp_scope_off'],
  ['DHCP : options', 'Set-DhcpServerv4OptionValue -ScopeId 10.10.20.0 -Router 10.10.20.1', 'SRV-DC1', 'dhcp_gw_bad, dhcp_gw_empty, dhcp_dns_opt'], ['DHCP : exclusions', 'Remove-DhcpServerv4ExclusionRange -ScopeId 10.10.20.0', 'SRV-DC1', 'dhcp_pool'],
  ['DHCP : réservation', 'Set-DhcpServerv4Reservation -IPAddress 10.10.20.5', 'SRV-DC1', 'dhcp_resa'], ['DNS : transmetteurs', 'Set-DnsServerForwarder -IPAddress 8.8.8.8', 'SRV-DC1', 'dns_fwd'],
  ['DNS : enregistrement A', 'Add-DnsServerResourceRecordA -ZoneName x -Name y -IPv4Address 1.1.1.1', 'SRV-DC1', 'dns_rec_missing'], ['DNS : modifier un enregistrement', 'Set-DnsServerResourceRecord -ZoneName x -Name y', 'SRV-DC1', 'dns_rec_wrong'],
  ['DNS : enregistrement PTR', 'Add-DnsServerResourceRecordPtr -ZoneName x -Name y -PtrDomainName z', 'SRV-DC1', 'dns_ptr'], ['DNS : vider le cache client', 'ipconfig /flushdns', 'PC-01', 'dns_cache, ipv4_dns…'], ['Poste : réenregistrer dans le DNS', 'ipconfig /registerdns', 'PC-01', 'ad_srv_missing'],
  ['Service Windows : démarrer', 'Start-Service -Name x', 'SRV-DC1', 'dhcp_svc, dns_svc, sh_svc, ad_dc_svc, iis_stopped, fw_profile'], ['Service Windows : type de démarrage', 'Set-Service -Name x -StartupType Automatic', 'SRV-DC1', 'dhcp_svc_disabled'],
  ['Pare-feu : activer une règle', 'Enable-NetFirewallRule -DisplayName x', 'SRV-FIC', 'fw_icmp, fw_80, fw_443, fw_53'], ['Pare-feu : profil', 'Set-NetFirewallProfile -Profile Domain -Enabled True', 'SRV-FIC', 'fw_profile'],
  ['IIS : démarrer le site', 'Start-Website -Name x', 'SRV-FIC', 'web_site_stopped'], ['IIS : pool d’applications', 'Start-WebAppPool -Name x', 'SRV-FIC', 'web_pool'], ['IIS : liaison', 'Set-WebBinding -Name x -BindingInformation y -PropertyName Port -Value 443', 'SRV-FIC', 'iis_binding, web_hostheader, web_cert_cn'],
  ['IIS : document par défaut', 'Add-WebConfigurationProperty -Filter system.webServer/defaultDocument/files -Name . -Value @{value="index.html"}', 'SRV-FIC', 'web_default_doc'], ['NTFS : droits', 'icacls D:\\ /grant x:(OI)(CI)M', 'SRV-FIC', 'sh_ntfs_deny, sh_ntfs_inherit, web_ntfs'],
  ['Partage : créer', 'New-SmbShare -Name x -Path C:\\', 'SRV-FIC', 'sh_missing'], ['Partage : droits', 'Grant-SmbShareAccess -Name x -AccountName y -AccessRight Change -Force', 'SRV-FIC', 'sh_perm_share'],
  ['Carte réseau : activer', 'Enable-NetAdapter -Name x', 'PC-01', 'nic_disabled'], ['IP : adresse statique', 'New-NetIPAddress -InterfaceAlias x -IPAddress 1.1.1.1 -PrefixLength 24', 'PC-ADM', 'ipv4_static, ipv4_mask'],
  ['IP : changer une adresse existante', 'Set-NetIPAddress -InterfaceAlias x -IPAddress 1.1.1.1', 'PC-ADM', 'ipv4_static'], ['IP : passerelle', 'Remove-NetRoute -DestinationPrefix 0.0.0.0/0', 'PC-ADM', 'ipv4_gw'], ['IP : serveurs DNS', 'Set-DnsClientServerAddress -InterfaceAlias x -ServerAddresses 1.1.1.1', 'PC-ADM', 'ipv4_dns'],
  ['Fichier hosts', 'notepad C:\\Windows\\System32\\drivers\\etc\\hosts', 'PC-01', 'dns_hosts'], ['Proxy client', 'netsh winhttp set proxy proxy-server="x:3128"', 'PC-02', 'px_client_port, px_client_bypass'],
  ['DHCP client : renouveler', 'ipconfig /renew', 'PC-01', '34 pannes (côté client)'],
];
const st = { ok: 0, flag: 0, absent: 0 }; const rows = FAM.map(f => { const k = known(f[2], f[1]); st[k]++; return (k === 'ok' ? '  connue    ' : k === 'flag' ? '  signalée  ' : '  ABSENTE   ') + f[0].padEnd(46) + f[1].split(' ')[0].padEnd(34) + f[3]; });
console.log('Famille de réparation Windows → commande réelle : le simulateur la connaît-il ?\n  (connue = émulée ; signalée = non émulée mais le terminal le dit et renvoie vers la console graphique ; ABSENTE = répond « n’est pas reconnu » à tort)\n'); console.log(rows.join('\n'));
console.log('\n' + st.ok + ' émulées, ' + st.flag + ' signalées « non gérées », ' + st.absent + ' absentes (audit)'); process.exit(st.absent ? 1 : 0);
