const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
const sh = SIM.emu.openWinShell(env, 'PC-01', { elevated: true, user: 'a.martin' });
console.log(sh.banner().map(x => x.t).join('\n'));
for (const c of process.argv.slice(2).length ? [process.argv.slice(2).join(' ')] : [
  'ipconfig', 'ipconfig /all', 'ping srv-fic', 'ping 10.10.10.10 -n 2', 'ping 8.8.8.8', 'nslookup srv-fic', 'nslookup portail', 'nslookup toto', 'tracert srv-fic', 'tracert -d 8.8.8.8',
  'arp -a', 'route print', 'netstat -an', 'whoami', 'whoami /groups', 'hostname', 'type C:\\Windows\\System32\\drivers\\etc\\hosts', 'dir', 'net use', 'gpresult /r', 'gpupdate /force',
  'nltest /dsgetdc:toulouse.local', 'nltest /sc_query:toulouse.local', 'w32tm /query /status', 'sc query dnscache', 'net start', 'curl http://portail.toulouse.local:8080', 'ipconfig /displaydns', 'netsh interface ip show config'
]) T.run(sh, c);
