/* D-99 / D-111, côté Windows : une commande RÉELLE dont l'existence sur Windows Server 2019 et Windows 10 ne fait pas de doute, et que le simulateur n'émule pas, répond
   « non gérée par le simulateur » (couche jeu), jamais « n'est pas reconnu » (qui affirmerait qu'elle n'existe pas). Un contrôle par commande, sur un serveur ET sur un poste, en cmd ET en PowerShell.
   La liste ci-dessous est volontairement INDÉPENDANTE de la table du simulateur : retirer une commande de la table fait virer le contrôle correspondant au rouge (neutralisation, D-70).
   Contre-exemples : « telnet » (fonctionnalité optionnelle, absente par défaut) et une commande inventée gardent « n'est pas reconnu ». */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const fails = []; const ok = (c, m) => { if (!c) { fails.push(m); console.log('✗ ' + m); } else console.log('✓ ' + m); };
const text = r => (r.out || []).map(x => x.t).join('\n');
const CMD = ['nbtstat -n', 'schtasks /query', 'wevtutil qe System /c:1', 'taskkill /im notepad.exe', 'query user', 'driverquery', 'certutil -?', 'ftp', 'diskpart', 'fsutil fsinfo drives', 'cipher /?', 'wmic os get caption', 'sfc /?', 'chkdsk'];
const PS = ['Get-HotFix', 'Get-ComputerInfo', 'Get-NetRoute', 'Get-Acl C:\\', 'Get-Volume', 'Get-Disk', 'Get-LocalUser', 'Get-ScheduledTask', 'Invoke-Command -ComputerName SRV-FIC -ScriptBlock { hostname }', 'Enter-PSSession -ComputerName SRV-FIC', 'Get-Item C:\\', 'Get-ItemProperty HKLM:\\SOFTWARE', 'Get-NetAdapterBinding', 'Get-NetTCPConnection', 'Get-Printer', 'Get-Module -ListAvailable'];
const NOT_RECOGNIZED = /n’est pas reconnu|n'est pas reconnu/;
for (const dev of ['SRV-DC1', 'PC-ADM']) {
  const sh = () => SIM.emu.openWinShell(env, dev, { elevated: true, user: 'Administrateur' });
  CMD.forEach(c => { const o = text(sh().exec(c)); ok(/non gérée par le simulateur/.test(o) && !NOT_RECOGNIZED.test(o), dev + ' cmd : « ' + c + ' » → non gérée par le simulateur (' + o.split('\n')[0].slice(0, 70) + ')'); });
  PS.forEach(c => { const o = text(sh().exec('powershell').push.exec(c)); ok(/non gérée par le simulateur/.test(o) && !NOT_RECOGNIZED.test(o), dev + ' PowerShell : « ' + c.slice(0, 40) + ' » → non gérée par le simulateur'); });
  /* contre-exemples : on ne remplace PAS tout « introuvable » */
  let o = text(sh().exec('telnet')); ok(NOT_RECOGNIZED.test(o) && !/non gérée/.test(o), dev + ' : « telnet » (absent par défaut) garde « n’est pas reconnu »');
  o = text(sh().exec('zzcommande')); ok(NOT_RECOGNIZED.test(o) && !/non gérée/.test(o), dev + ' : une commande inventée garde « n’est pas reconnu »');
  o = text(sh().exec('powershell').push.exec('Get-ZzInventee')); ok(NOT_RECOGNIZED.test(o) && !/non gérée/.test(o), dev + ' : une applet inventée garde « n’est pas reconnue »');
}
/* la table du simulateur ne contient rien que ce test ne contrôle pas (pas de commande ajoutée sans test) */
const tested = new Set(CMD.map(c => c.split(/\s+/)[0].toLowerCase())); const tablec = Object.keys(SIM.emu.REAL_CMD_UNSUPPORTED || {});
ok(tablec.length === tested.size && tablec.every(c => tested.has(c)), 'la table cmd du simulateur et la liste testée sont identiques (' + tablec.length + ' commandes)');
const testedP = new Set(PS.map(c => c.split(/\s+/)[0].toLowerCase())); const tablep = Object.keys(SIM.emu.REAL_PS_UNSUPPORTED || {});
ok(tablep.length === testedP.size && tablep.every(c => testedP.has(c)), 'la table PowerShell du simulateur et la liste testée sont identiques (' + tablep.length + ' applets)');
console.log(fails.length ? fails.length + ' échec(s)' : '0 échec'); process.exit(fails.length ? 1 : 0);
