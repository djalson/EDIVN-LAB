const SIM=require('./load')(); const W=SIM.buildHealthyWorld({seed:1});
const N=SIM.net;
for (const [h,ip,p] of [['SRV-WEB','93.184.216.34',443],['SRV-WEB','93.184.216.34',80],['SRV-WEB','10.10.10.20',443]]) {
 const c=N.connect(W,h,ip,'tcp',p); console.log(h,ip,p,c.state,JSON.stringify(c.trace).slice(0,600));}
const d=W.d('pfsense-tls'); console.log(JSON.stringify(d.aliases), JSON.stringify(d.rules.dmz));
