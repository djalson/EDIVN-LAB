/* Les commandes citées dans les indices, solutions et chemins optimaux existent dans le simulateur :
   un indice qui envoie le joueur vers une commande « non gérée » est une impasse (trouvé en jouant : Get-NetConnectionProfile, namei). */
const SIM = require('./load.js')(); const F = SIM.fault, E = SIM.emu;
const RX = /\b((?:ipconfig|nslookup|ping|tracert|pathping|netsh|net (?:use|user|start|stop|view|accounts|localgroup|share|time)|gpupdate|gpresult|w32tm|arp|route print|sc (?:query|start|stop|config)|whoami|hostname|nltest|klist|getmac|netstat|nbtstat|icacls|systeminfo|tasklist|sfc|chkdsk|dcdiag|repadmin|netdom|Test-NetConnection|Test-ComputerSecureChannel|Reset-ComputerMachinePassword|Resolve-DnsName|Clear-DnsClientCache|Get-[A-Z]\w+|Set-[A-Z]\w+|Restart-Service|Start-Service|Stop-Service|Unlock-ADAccount|Enable-ADAccount|Add-[A-Z]\w+|New-[A-Z]\w+|Remove-[A-Z]\w+|Invoke-[A-Z]\w+|Search-ADAccount)(?:[ ]+[\/\-]?[\w.\-\\:@*]+){0,4})/g;
const seen = {};
for (const def of SIM.faults) { const i = F.instantiate(def, 7); const txt = [i.solution].concat(i.hints || [], i.optimal || [], i.traps || []).join(' \n '); (txt.match(RX) || []).forEach(c => { c = c.trim().replace(/[.,;:)]+$/, ''); (seen[c] = seen[c] || []).push(def.id); }); }
const W = SIM.buildHealthyWorld({ seed: 1 }); if (SIM.applyCreds) SIM.applyCreds(W);
const env = new E.Env ? new E.Env(W) : null;
const mk = (dev, mode) => E.openWinShell(env || { W, touch() {}, obs() {}, advance() {}, act() {} }, dev, { mode, elevated: true, user: 'tssr' });
let bad = 0;
for (const c of Object.keys(seen).sort()) {
  let outs = [];
  for (const [dev, mode] of [['PC-ADM', 'cmd'], ['PC-ADM', 'ps'], ['SRV-DC1', 'ps'], ['SRV-DC1', 'cmd']]) { let r; try { r = mk(dev, mode).run(c); } catch (e) { outs.push('EXC ' + e.message.slice(0, 50)); continue; } const t = (r.out || []).map(x => x.t).join(' '); outs.push(/non gér|n’est pas reconnu|not recognized|introuvable\. Vérifiez/.test(t) ? 'KO' : 'ok'); }
  if (outs.every(o => o !== 'ok')) { bad++; console.log(c.padEnd(52), outs.join(','), '←', [...new Set(seen[c])].slice(0, 4).join(',')); }
}
console.log((bad ? '✗ ' : '✓ ') + Object.keys(seen).length + ' commandes Windows citées dans les indices et solutions, ' + bad + ' non reconnue(s) par le simulateur'); let fails = bad;

const isLx = d => /lx_|multi_intranet|multi_vitrine/.test(d.id) || (d.skills || []).some(s => /linux|lx|apache|bind|ssh-linux|nginx/.test(s));
const LX = /\b((?:sudo )?(?:systemctl|journalctl|ufw|ss|ip|cat|ls|chmod|chown|chgrp|setfacl|getfacl|named-checkconf|named-checkzone|apachectl|apache2ctl|a2ensite|a2dissite|nginx|df|du|mount|findmnt|lsblk|blkid|crontab|sshd|dig|host|curl|wget|mysql|mariadb|tail|grep|id|groups|usermod|gpasswd|stat|namei|rndc|resolvectl|nano|vi|vim|bash|sh|openssl|certbot|ping|nmcli|ifup|ifdown|netplan|hostnamectl|timedatectl|free|top|ps|kill|truncate|rm|find|logrotate|apt|dpkg)(?: +[\w.\/\-:=@*~+,'"]+){0,5})/g;
const lx = {}, ios = {};
for (const def of SIM.faults) { const i = F.instantiate(def, 7); const txt = [i.solution].concat(i.hints || [], i.optimal || []).join(' \n ');
  if (isLx(def)) (txt.match(LX) || []).forEach(c => { c = c.trim().replace(/[.,;:)'"]+$/, ''); if (/ /.test(c) || /^(nginx|df|mount|id|ss)$/.test(c)) (lx[c] = lx[c] || []).push(def.id); }); }
bad = 0;
for (const c of Object.keys(lx).sort()) { let res = []; for (const dev of ['SRV-LNX', 'SRV-WEB']) { try { const s = E.openLxShell(env, dev, { user: 'root' }); const r = s.run(c.replace(/^sudo /, '')); const t = (r.out || []).map(x => x.t).join(' '); res.push(/command not found|non gér|not supported|unrecognized|invalid option|Unknown (command|operation)/i.test(t) ? 'KO:' + t.slice(0, 60) : 'ok'); } catch (e) { res.push('EXC ' + e.message.slice(0, 40)); } } if (res.every(x => x !== 'ok')) { bad++; console.log('LX  ' + c.padEnd(46), res[0], '←', [...new Set(lx[c])].slice(0, 3).join(',')); } }
console.log((bad ? '✗ ' : '✓ ') + Object.keys(lx).length + ' commandes Linux citées, ' + bad + ' non reconnue(s)'); fails += bad;
console.log(fails ? '✗ ' + fails + ' anomalie(s)' : 'OK'); process.exit(fails ? 1 : 0);
