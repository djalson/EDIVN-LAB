const SIM=require('./load')(); const F=SIM.fault; const id=process.argv[2]; const idx=+process.argv[3]||0;
const def=SIM.faults.find(f=>f.id===id); const combo=def.vary?{m:idx}:{};
const W=SIM.buildHealthyWorld({seed:1}); const base=W.sem(); const inst=F.instantiate(def,7,combo);
F.runSteps(W,inst.inject); let rt=F.evaluate(W,inst,base); console.log('broken',JSON.stringify(rt.probes.map(p=>[p.ok,p.why])));
F.runSteps(W,inst.fix); rt=F.evaluate(W,inst,base); console.log('fixed',JSON.stringify(rt.probes.map(p=>[p.ok,p.why])));
for (const r of inst.roots) { if (r.probe) console.log('root',JSON.stringify(r.probe), JSON.stringify(SIM.probes[r.probe.t](W,r.probe))); else console.log('root',JSON.stringify(r), F.rootsFixed(W,{roots:[r]},base)); }
