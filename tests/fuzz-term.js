/* Entrées hostiles / dégénérées sur tous les émulateurs de terminal : aucune exception ne doit s'échapper,
   Object.prototype ne doit jamais être modifié, un terminal reste utilisable après chaque ligne. */
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const NAMES = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'prototype', '__defineGetter__'];
const lines = [''];
NAMES.forEach(n => {
  lines.push(n, n + ' ' + n, 'cat ' + n, 'ls ' + n, 'cd ' + n, 'type ' + n, 'dir ' + n, 'echo ' + n, 'set ' + n + '=x', 'export ' + n + '=x', 'alias ' + n + '=ls',
    'sc query ' + n, 'net use ' + n, 'net share ' + n, 'net user ' + n, 'ping ' + n, 'nslookup ' + n, 'Get-Service ' + n, 'Get-Item ' + n, 'show ' + n, 'show ' + n + ' ' + n,
    'interface ' + n, 'ip route ' + n, 'systemctl status ' + n, 'systemctl restart ' + n, 'journalctl -u ' + n, 'id ' + n, 'sudo ' + n, 'grep ' + n + ' /etc/passwd', 'ip dhcp pool ' + n,
    'hostname ' + n, 'ssh ' + n + '@' + n, 'curl http://' + n, 'ipconfig /' + n, 'netsh ' + n, 'help ' + n, 'man ' + n);
});
lines.push('echo "', "echo '", 'echo $(', 'echo `', 'echo ${', 'echo %', 'echo %%%', '|||', '>>>', '&&&&', '; ; ;', 'cat <<', '!!', '!$', '^^', '\\', '\\\\\\\\', '"', "'", '$', '${__proto__}', '$((1/0))',
  'a'.repeat(20000), 'echo ' + 'x'.repeat(50000), 'ls ' + '/..'.repeat(500), 'cd ' + '../'.repeat(500), '\u0000', 'echo ‮', 'ping 999.999.999.999', 'ping -n 0 127.0.0.1', 'ping -n -5 8.8.8.8',
  'for i in $(seq 1 3); do echo $i; done', 'while true; do break; done', 'sleep 0', 'sleep -1', 'tail -n -5 /etc/passwd', 'head -n 99999999 /etc/passwd', 'seq 1 0');
let bad = 0, n = 0; const proto0 = Object.getOwnPropertyNames(Object.prototype).sort().join(',');
const shells = [
  ['cmd PC-01', () => SIM.emu.openWinShell(T.mk(SIM.buildHealthyWorld({ seed: 1 })), 'PC-01', { elevated: true, user: 'a.martin' })],
  ['ps SRV-FIC', () => { const s = SIM.emu.openWinShell(T.mk(SIM.buildHealthyWorld({ seed: 1 })), 'SRV-FIC', { elevated: true, user: 'tssr' }); s.exec('powershell'); return s; }],
  ['bash SRV-LNX', () => SIM.emu.openLxShell(T.mk(SIM.buildHealthyWorld({ seed: 1 })), 'SRV-LNX', { user: 'tech' })],
  ['ios SW-T2', () => SIM.emu.openIos(T.mk(SIM.buildHealthyWorld({ seed: 1 })), 'SW-T2', { via: 'console' })],
  ['ios R-RV1', () => SIM.emu.openIos(T.mk(SIM.buildHealthyWorld({ seed: 1 })), 'R-RV1', { via: 'console' })]
];
if (SIM.emu.openPfConsole) shells.push(['pf pfsense-tls', () => SIM.emu.openPfConsole(T.mk(SIM.buildHealthyWorld({ seed: 1 })), 'pfsense-tls', { user: 'admin' })]);
for (const [label, mk] of shells) {
  let sh; try { sh = mk(); } catch (e) { console.log('✗ ouverture ' + label + ' : ' + e.message); bad++; continue; }
  let fails = 0;
  for (const l of lines) {
    n++;
    try {
      let r = sh.exec(l); let guard = 0;
      while (r && r.ask && guard++ < 3) r = sh.exec('x');
      if (r && r.edit) { try { sh.exec(':q!'); } catch (e) { /* éditeur : fermeture facultative ici */ } }
      if (r && r.stream) { try { r.stream.stop(); } catch (e) { throw e; } }
    } catch (e) { fails++; bad++; if (fails <= 5) console.log('✗ ' + label + ' « ' + String(l).slice(0, 60) + ' » : ' + e.message.split('\n')[0]); }
  }
  try { const r = sh.exec(label.startsWith('ios') ? 'show clock' : label.startsWith('bash') ? 'echo ok' : label.startsWith('pf') ? 'pfctl -s info' : 'echo ok'); if (!r || !r.out) throw new Error('terminal inutilisable'); } catch (e) { bad++; console.log('✗ ' + label + ' inutilisable après fuzz : ' + e.message); }
  console.log((fails ? '✗ ' : '✓ ') + label + ' : ' + lines.length + ' lignes hostiles, ' + fails + ' exception(s)');
}
if (Object.getOwnPropertyNames(Object.prototype).sort().join(',') !== proto0 || ({}).polluted !== undefined) { bad++; console.log('✗ Object.prototype modifié'); }
console.log(bad ? bad + ' ÉCHEC(S) sur ' + n + ' entrées' : 'OK — ' + n + ' entrées hostiles, 0 exception');
process.exit(bad ? 1 : 0);
