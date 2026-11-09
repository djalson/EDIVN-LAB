// Test de chaque panne : saine avant, cassée après injection, réparée par chaque correction scriptée,
// « contournement » détecté pour chaque contournement déclaré, vérification côté poste requise.
const SIM = require('./load')();
const F = SIM.fault, U = SIM.U;
const only = process.argv.slice(2);
const defs = SIM.faults.filter(d => !only.length || only.some(o => d.id === o || d.id.startsWith(o)));
let bad = 0, nOk = 0;
const fail = (id, msg) => { bad++; console.log('  ✗ ' + id + ' : ' + msg); };
const verifyObs = (W, inst) => { const pats = (inst.verify && inst.verify.length) ? inst.verify : F.defaultVerify(inst); const k = pats[0].replace(/\*/g, 'test'); W.observe(k, true); };
const fresh = (def, combo) => {
  const W = SIM.buildHealthyWorld({ seed: 1 }); const base = W.sem();
  const inst = F.instantiate(def, 7, combo);
  return { W, base, inst };
};
for (const def of defs) {
  const errs0 = bad;
  // métadonnées
  for (const k of ['id', 'level', 'title', 'skills', 'ticket', 'cause', 'solution', 'hints', 'inject', 'probes', 'fix']) if (def[k] === undefined) fail(def.id, 'champ manquant ' + k);
  (def.skills || []).forEach(s => { if (!SIM.skills[s]) fail(def.id, 'compétence inconnue ' + s); });
  if (!def.skills || !def.skills.length) fail(def.id, 'aucune compétence');
  if (def.hints && def.hints.length !== 3) fail(def.id, 'il faut 3 indices');
  if (def.level < 1 || def.level > 4) fail(def.id, 'niveau hors 1..4');
  if (bad > errs0) continue;
  for (const combo of F.variantCombos(def, 6)) {
    const tag = def.id + JSON.stringify(combo);
    try {
      // 1. monde sain : sondes toutes OK
      let { W, base, inst } = fresh(def, combo);
      let rt = F.evaluate(W, inst, base);
      if (!rt.allOk) fail(tag, 'sondes KO dans le monde SAIN : ' + rt.probes.filter(p => !p.ok).map(p => p.id + ':' + p.why).join(' | '));
      // 2. injection : au moins une sonde KO, racine non réparée
      ({ W, base, inst } = fresh(def, combo));
      F.runSteps(W, inst.inject);
      rt = F.evaluate(W, inst, base);
      if (rt.allOk) fail(tag, 'aucun symptôme après injection');
      if (inst.roots && inst.roots.length && rt.rootsFixed) fail(tag, 'racine « réparée » alors que la panne est injectée');
      const sym = rt.probes.filter(p => !p.ok).map(p => p.id + ':' + p.why);
      // 3. corrections
      const fixes = Object.assign({}, inst.fixes || {}); if (inst.fix) fixes.main = inst.fix;
      for (const name of Object.keys(fixes)) {
        ({ W, base, inst } = fresh(def, combo)); F.runSteps(W, inst.inject); F.runSteps(W, fixes[name]);
        rt = F.evaluate(W, inst, base);
        if (!rt.allOk) fail(tag + '/fix:' + name, 'sondes encore KO : ' + rt.probes.filter(p => !p.ok).map(p => p.id + ':' + p.why).join(' | '));
        else if (!rt.rootsFixed) fail(tag + '/fix:' + name, 'racine non réparée (considérée contournement)');
        else {
          if (rt.status !== 'fixed') fail(tag + '/fix:' + name, 'statut attendu fixed, obtenu ' + rt.status);
          verifyObs(W, inst); rt = F.evaluate(W, inst, base);
          if (rt.status !== 'resolved') fail(tag + '/fix:' + name, 'statut attendu resolved après vérification, obtenu ' + rt.status);
        }
      }
      // 4. contournements
      for (const name of Object.keys(inst.workarounds || {})) {
        ({ W, base, inst } = fresh(def, combo)); F.runSteps(W, inst.inject); F.runSteps(W, inst.workarounds[name]);
        rt = F.evaluate(W, inst, base);
        if (rt.status !== 'workaround') fail(tag + '/contournement:' + name, 'statut attendu workaround, obtenu ' + rt.status + (rt.allOk ? '' : ' (sondes KO : ' + rt.probes.filter(p => !p.ok).map(p => p.id + ':' + p.why).join(' | ') + ')'));
      }
      if (process.env.V) console.log('  ' + tag + ' symptômes → ' + sym.join(' | '));
    } catch (e) { fail(tag, 'exception ' + e.stack.split('\n').slice(0, 3).join(' / ')); }
  }
  if (bad === errs0) { nOk++; console.log('✓ ' + def.id); }
}
console.log('\n' + nOk + '/' + defs.length + ' pannes valides, ' + bad + ' erreur(s)');
process.exit(bad ? 1 : 0);
