/* Parité ligne de commande / interface : les pannes de partage, d'IIS et de fichier hosts doivent pouvoir
   être diagnostiquées ET réparées au terminal (cmd, PowerShell), pas seulement dans les consoles graphiques.
   Chaque scénario : monde sain → injection → constat au terminal → correction au terminal → sondes OK et racine réparée. */
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const F = SIM.fault;
let ok = 0, ko = 0; const chk = (c, m) => { if (c) { ok++; console.log('✓ ' + m); } else { ko++; console.log('✗ ' + m); } };
const text = (r) => r.out.map(x => x.t).join('\n');

function mk(faultId) {
  const W = SIM.buildHealthyWorld({ seed: 1 }); const base = W.sem(); const def = SIM.faults.find(f => f.id === faultId);
  const inst = F.instantiate(def, 7, {}); F.runSteps(W, inst.inject); return { W, base, inst, env: T.mk(W) };
}
const status = (R) => F.evaluate(R.W, R.inst, R.base).status;
const fixedOrBetter = (R) => ['fixed', 'resolved'].indexOf(status(R)) >= 0;
const open = (R, dev, elevated) => SIM.emu.openWinShell(R.env, dev, { elevated: elevated !== false, user: 'Administrateur' });
const ps = (R, dev) => open(R, dev).exec('powershell').push;
const run = (sh, l) => text(T.run(sh, l, { show: false }));

/* --- sh_missing : repartage par net share, puis par New-SmbShare --- */
for (const via of ['net', 'ps']) {
  const R = mk('sh_missing'); const item = R.inst.fix.find(s => s.do === 'push').item; const n0 = (R.W.d('SRV-FIC').win.shares || []).length;
  chk(status(R) === 'active', 'sh_missing/' + via + ' : en panne après injection');
  if (via === 'net') {
    const sh = open(R, 'SRV-FIC');
    chk(!new RegExp('^' + item.name + '\\s', 'm').test(run(sh, 'net share')), 'sh_missing/net : net share ne liste plus ' + item.name);
    chk(/a été partagé/.test(run(sh, 'net share ' + item.name + '=' + item.path + ' /GRANT:"Utilisateurs authentifiés",CHANGE')), 'sh_missing/net : création acceptée');
    chk(/2118/.test(run(sh, 'net share ' + item.name + '=' + item.path)), 'sh_missing/net : doublon refusé (erreur 2118)');
  } else {
    const sh = ps(R, 'SRV-FIC');
    chk(!new RegExp('^' + item.name + '\\s', 'm').test(run(sh, 'Get-SmbShare')), 'sh_missing/ps : Get-SmbShare ne liste plus ' + item.name);
    chk(new RegExp(item.name).test(run(sh, 'New-SmbShare -Name ' + item.name + ' -Path ' + item.path + ' -ChangeAccess "Utilisateurs authentifiés"')), 'sh_missing/ps : New-SmbShare retourne le partage');
    chk(/Change/.test(run(sh, 'Get-SmbShareAccess ' + item.name)), 'sh_missing/ps : Get-SmbShareAccess montre Change');
  }
  chk((R.W.d('SRV-FIC').win.shares || []).length === n0 + 1, 'sh_missing/' + via + ' : un partage de plus');
  chk(fixedOrBetter(R), 'sh_missing/' + via + ' : panne réparée (' + status(R) + ')');
}
/* piège : repartage avec droits par défaut (lecture seule) → contournement, pas réparation */
{
  const R = mk('sh_missing'); const item = R.inst.fix.find(s => s.do === 'push').item; run(open(R, 'SRV-FIC'), 'net share ' + item.name + '=' + item.path);
  chk(status(R) !== 'fixed' && status(R) !== 'resolved', 'sh_missing : repartage en lecture seule non considéré comme réparation (' + status(R) + ')');
  run(ps(R, 'SRV-FIC'), 'Grant-SmbShareAccess -Name ' + item.name + ' -AccountName "Utilisateurs authentifiés" -AccessRight Change -Force');
  chk(fixedOrBetter(R), 'sh_missing : Grant-SmbShareAccess Change rétablit l’écriture');
  const out = run(ps(R, 'SRV-FIC'), 'Revoke-SmbShareAccess -Name ' + item.name + ' -AccountName "Utilisateurs authentifiés" -Force');
  chk(/Tout le monde/.test(out) && !/Utilisateurs authentifiés/.test(out), 'Revoke-SmbShareAccess retire l’ACE ciblée');
}
/* droits, suppression, chemin */
{
  const R = mk('sh_missing'); const item = R.inst.fix.find(s => s.do === 'push').item;
  const std = open(R, 'SRV-FIC', false);
  chk(/5/.test(run(std, 'net share Test=C:\\ /GRANT:Everyone,READ')), 'net share : refus sans élévation (erreur 5)');
  const adm = open(R, 'SRV-FIC'); run(adm, 'net share ' + item.name + '=' + item.path);
  chk(/supprimé/.test(run(adm, 'net share ' + item.name + ' /delete')), 'net share /delete');
  chk(/2310/.test(run(adm, 'net share ' + item.name + ' /delete')), 'net share /delete : 2310 si absent');
  chk(/3/.test(run(adm, 'net share Nope=C:\\Inexistant')), 'net share : chemin inexistant refusé (erreur 3)');
  const p = ps(R, 'SRV-FIC'); run(p, 'New-SmbShare -Name Tmp -Path C:\\ -FullAccess Everyone'); chk(/Tmp/.test(run(p, 'Get-SmbShare')), 'New-SmbShare : partage Tmp créé');
  run(p, 'Remove-SmbShare -Name Tmp -Force'); chk(!/^Tmp\s/m.test(run(p, 'Get-SmbShare')), 'Remove-SmbShare : partage Tmp supprimé');
  chk(/ne correspond/.test(run(p, 'Remove-SmbShare -Name Tmp -Force')), 'Remove-SmbShare : erreur si absent');
}

/* --- web_site_stopped : Get-Website / Start-Website / Start-IISSite --- */
{
  const R = mk('web_site_stopped'); const sh = ps(R, 'SRV-FIC'); const o1 = run(sh, 'Get-Website');
  chk(/Default Web Site/.test(o1) && /Stopped/.test(o1), 'web_site_stopped : Get-Website montre Stopped');
  chk(status(R) === 'active', 'web_site_stopped : toujours en panne avant Start-Website');
  run(sh, 'Start-Website -Name "Default Web Site"');
  chk(/Started/.test(run(sh, 'Get-Website')), 'web_site_stopped : Get-Website montre Started');
  chk(fixedOrBetter(R), 'web_site_stopped : réparée par Start-Website');
  const R2 = mk('web_site_stopped'); run(ps(R2, 'SRV-FIC'), 'Start-IISSite -Name "Default Web Site"');
  chk(fixedOrBetter(R2), 'web_site_stopped : réparée par Start-IISSite');
  chk(/n’est pas reconnu/.test(run(ps(R2, 'PC-02'), 'Get-Website')), 'Get-Website absent d’un poste sans IIS');
  chk(/introuvable/.test(run(sh, 'Start-Website -Name Nope')), 'Start-Website : site inexistant refusé');
}

/* --- web_hostheader : Get-WebBinding / Set-WebBinding --- */
{
  const R = mk('web_hostheader'); const sh = ps(R, 'SRV-FIC');
  chk(/intranet\.toulouse\.local/.test(run(sh, 'Get-WebBinding -Name "Default Web Site"')), 'web_hostheader : Get-WebBinding montre le nom d’hôte');
  chk(status(R) === 'active', 'web_hostheader : en panne avant correction');
  run(sh, 'Set-WebBinding -Name "Default Web Site" -BindingInformation "*:80:intranet.toulouse.local" -PropertyName HostHeader -Value ""');
  chk(fixedOrBetter(R), 'web_hostheader : réparée par Set-WebBinding');
}

/* --- dns_hosts : le fichier hosts se lit au terminal --- */
{
  const R = mk('dns_hosts'); const host = R.inst.probes[0].from; const sh = open(R, host);
  chk(/10\.10\.10\.99/.test(run(sh, 'type C:\\Windows\\System32\\drivers\\etc\\hosts')), 'dns_hosts : « type hosts » montre l’entrée parasite sur ' + host);
  chk(status(R) === 'active', 'dns_hosts : en panne avant correction');
}

/* --- nic_disabled : ipconfig n'affiche plus la carte ; Enable-NetAdapter / netsh la réactivent --- */
for (const via of ['ps', 'netsh']) {
  const R = mk('nic_disabled'); const host = R.inst.probes[0].dev; const sh = open(R, host);
  chk(!/Carte Ethernet Ethernet0/.test(run(sh, 'ipconfig')), 'nic_disabled/' + via + ' : ipconfig n’affiche pas la carte désactivée');
  const p = sh.exec('powershell').push;
  chk(/Disabled/.test(run(p, 'Get-NetAdapter')), 'nic_disabled/' + via + ' : Get-NetAdapter montre Disabled');
  chk(status(R) === 'active', 'nic_disabled/' + via + ' : en panne avant correction');
  if (via === 'ps') run(p, 'Enable-NetAdapter -Name Ethernet0 -Confirm:$false');
  else run(sh, 'netsh interface set interface name="Ethernet0" admin=enabled');
  chk(/Carte Ethernet Ethernet0/.test(run(sh, 'ipconfig')), 'nic_disabled/' + via + ' : la carte réapparaît dans ipconfig');
  chk(fixedOrBetter(R), 'nic_disabled/' + via + ' : réparée (' + status(R) + ')');
  const std = open(R, host, false); chk(/5|Accès refusé|élévation/.test(run(std, 'netsh interface set interface name="Ethernet0" admin=disabled')), 'nic_disabled/' + via + ' : netsh exige l’élévation');
}

/* --- fw_smb : port 445 filtré, réparation par Enable-NetFirewallRule --- */
{
  const R = mk('fw_smb'); const host = R.inst.probes[0].from; const sh = ps(R, host);
  chk(/False/.test(run(sh, 'Test-NetConnection srv-fic -Port 445')), 'fw_smb : Test-NetConnection 445 échoue');
  chk(status(R) === 'active', 'fw_smb : en panne avant correction');
  const srv = ps(R, 'SRV-FIC'); const out = run(srv, 'Get-NetFirewallRule | Where-Object { $_.Enabled -eq "False" }');
  chk(/SMB|Partage de fichiers/.test(out), 'fw_smb : la règle SMB désactivée est visible sur SRV-FIC');
  run(srv, 'Enable-NetFirewallRule -DisplayName "Partage de fichiers et d’imprimantes (SMB - Trafic entrant)"');
  chk(fixedOrBetter(R), 'fw_smb : réparée par Enable-NetFirewallRule (' + status(R) + ')');
}

/* --- iisreset : redémarre W3SVC mais ne démarre pas un site arrêté (piège de web_site_stopped) --- */
{
  const R = mk('web_site_stopped'); const sh = open(R, 'SRV-FIC');
  chk(/réussi/.test(run(sh, 'iisreset')), 'iisreset : redémarrage de W3SVC');
  chk(status(R) === 'active', 'web_site_stopped : iisreset ne démarre pas un site arrêté');
  chk(/pas reconnu/.test(run(open(R, 'PC-02'), 'iisreset')), 'iisreset : absent d’un poste sans IIS');
  chk(/administrateur/.test(run(open(R, 'SRV-FIC', false), 'iisreset')), 'iisreset : exige l’élévation');
}

/* --- PowerShell : arithmétique de base sans eval --- */
{
  const R = mk('nic_disabled'); const p = ps(R, 'PC-01');
  chk(run(p, '2+3').trim() === '5' && run(p, '7/2').trim() === '3.5' && run(p, '10 - 4 * 2').trim() === '2' && run(p, '-5+2').trim() === '-3', 'PowerShell : 2+3, 7/2, 10 - 4 * 2, -5+2');
  chk(/division par zéro/.test(run(p, '1/0')), 'PowerShell : 1/0 → division par zéro');
}

console.log('\n' + ok + ' réussis, ' + ko + ' échec(s)'); process.exit(ko ? 1 : 0);
