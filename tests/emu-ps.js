const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const dev = process.env.DEV || 'SRV-DC1';
const sh0 = SIM.emu.openWinShell(env, dev, { elevated: true, user: 'Administrateur' });
const sh = sh0.exec('powershell').push;
const cmds = process.argv.slice(2).length ? process.argv.slice(2) : [
 'Get-Service dns,dhcpserver', 'Get-Service | Where-Object {$_.Status -eq "Running"} | Select-Object -First 3', 'Get-Service nope',
 'Get-NetIPConfiguration', 'Get-NetIPAddress', 'Get-DnsClientServerAddress', 'Test-NetConnection 10.10.10.1', 'Test-NetConnection srv-fic -Port 445',
 'Resolve-DnsName srv-fic', 'Resolve-DnsName toto.toulouse.local', 'Get-ADUser -Filter *', 'Get-ADUser a.martin -Properties LockedOut,PasswordExpired',
 'Get-DhcpServerv4Scope', 'Get-DhcpServerv4ExclusionRange', 'Get-DnsServerZone', 'Get-DnsServerResourceRecord -ZoneName toulouse.local',
 'Get-WinEvent -LogName System -MaxEvents 3', 'Get-NetFirewallProfile', '$x = Get-Service dns; $x.Status', 'Get-ChildItem C:\\', 'Get-Date', 'Get-Foo', 'Get-SmbShare', 'Stop-Service dns', 'Start-Service dns', 'Get-ADUser -Filter * | Format-Table SamAccountName,Enabled'
];
for (const c of cmds) { try { T.run(sh, c); } catch (e) { console.log('!!! ' + c + '\n' + e.stack.split('\n').slice(0,4).join('\n')); } }
