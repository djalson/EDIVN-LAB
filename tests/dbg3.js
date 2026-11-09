const SIM=require('./load')(); const W=SIM.buildHealthyWorld({seed:1}); const LX=SIM.lx; const P=SIM.probes;
const d=W.d('SRV-LNX');
console.log('disk', JSON.stringify(d.disk), 'bootCheck', JSON.stringify(LX.bootCheck(d)));
console.log('cron', JSON.stringify(LX.cronJobs(d).jobs.map(j=>j.file+':'+j.cmd.slice(0,30))), JSON.stringify(LX.cronEval(W,d,LX.cronJobs(d).jobs.find(j=>j.file.includes('backup')))));
for (const [n,p] of Object.entries({
 db:{t:'dblogin',from:'SRV-FIC',to:'10.10.10.30',user:'intranet',db:'intranet'},
 acl:{t:'lxaccess',dev:'SRV-LNX',user:'tech',path:'/srv/echanges/rapports/rapport-septembre.txt',mode:'r'},
 aclw:{t:'lxaccess',dev:'SRV-LNX',user:'tech',path:'/srv/echanges/rapports',mode:'w'},
 ufw:{t:'lxufw',dev:'SRV-LNX',port:80,from:'10.10.20.5'},
 fresh:{t:'lxfresh',dev:'SRV-LNX',svc:'bind9'},
 cfg:{t:'lxcfg',dev:'SRV-LNX',parse:'sshd',get:'ports',eq:[22]},
 cronjob:{t:'cronjob',dev:'SRV-LNX',file:'/etc/cron.d/backup-intranet'},
 ssh:{t:'ssh',from:'PC-ADM',to:'10.10.10.30',user:'tssr',method:'key'},
 http:{t:'http',from:'PC-ADM',url:'http://intranet.toulouse.local/'},
 boot:{t:'lxboot',dev:'SRV-LNX'}, disk:{t:'lxdisk',dev:'SRV-LNX',fs:'var'},
 labo:{t:'resolve',from:'PC-ADM',name:'www.labo.toulouse.local',expect:'10.10.10.30'}
})) console.log(n, JSON.stringify(P[p.t](W,p)));
// avancer le temps jusqu'à 02:31 le lendemain
SIM.sched.advance(W, 19*3600+30*60);
console.log(JSON.stringify(Object.keys(d.fs).filter(k=>k.includes('backups/intranet/')).slice(-3)), W.now().toISOString());
