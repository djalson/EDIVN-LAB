/* ============================================================================
   Validation d'un scénario déclaratif (utilisé par l'import formateur ET par tests/faults.js).
   Un scénario est une donnée JSON pure : rien n'est exécuté avant d'avoir passé ces contrôles.
   Contrôles : schéma, compétences du référentiel (≥ 1), étapes et sondes connues, puis
   simulation complète sur un monde sain : sondes OK avant, KO après injection, réparé par chaque
   correction déclarée (statut « fixed » puis « resolved » après vérification), contournements
   détectés comme tels.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, F = SIM.fault;

const REQUIRED = ['id', 'level', 'title', 'skills', 'ticket', 'cause', 'solution', 'hints', 'inject', 'probes', 'fix'];

F.validate = function (def, opts) {
  opts = opts || {};
  const errors = [], warnings = [];
  const err = m => errors.push(m);
  if (!def || typeof def !== 'object' || Array.isArray(def)) return { ok: false, errors: ['le scénario doit être un objet JSON'], warnings };
  for (const k of REQUIRED) if (def[k] === undefined) err('champ manquant : ' + k);
  if (errors.length) return { ok: false, errors, warnings };
  /* bornes de sécurité : un scénario venant d'un fichier ne doit pouvoir ni saturer la mémoire ni boucler longtemps */
  let size = 0; try { size = JSON.stringify(def).length; } catch (e) { return { ok: false, errors: ['scénario non sérialisable (référence circulaire ?)'], warnings }; }
  if (size > 200000) return { ok: false, errors: ['scénario trop volumineux (' + size + ' caractères, maximum 200 000)'], warnings };
  const lists = [def.inject, def.fix, def.probes].concat(Object.keys(def.fixes || {}).map(k => def.fixes[k]), Object.keys(def.workarounds || {}).map(k => def.workarounds[k]));
  if (lists.some(l => Array.isArray(l) && l.length > 300)) return { ok: false, errors: ['trop d’étapes ou de sondes dans une liste (maximum 300)'], warnings };
  if (def.vary && typeof def.vary === 'object' && Object.keys(def.vary).some(k => Array.isArray(def.vary[k]) && def.vary[k].length > 50)) return { ok: false, errors: ['trop de variantes dans « vary » (maximum 50 par clé)'], warnings };
  if (!/^[a-z][a-z0-9_]*$/.test(def.id)) err('id invalide (minuscules, chiffres et _ uniquement) : ' + def.id);
  if (!opts.allowExisting && SIM.faults.some(x => x.id === def.id)) err('id déjà utilisé : ' + def.id);
  if (!Number.isInteger(def.level) || def.level < 1 || def.level > 4) err('niveau hors 1..4');
  if (!Array.isArray(def.skills) || !def.skills.length) err('au moins une compétence du référentiel est obligatoire');
  else def.skills.forEach(s => { if (!SIM.skills[s]) err('compétence inconnue : ' + s + ' (valeurs possibles : ' + Object.keys(SIM.skills).join(', ') + ')'); });
  if (!Array.isArray(def.hints) || def.hints.length !== 3) err('il faut exactement 3 indices (du plus vague au plus précis)');
  if (!def.ticket || !def.ticket.from || !def.ticket.subject || !def.ticket.body) err('ticket : from, subject et body sont obligatoires');
  /* les gabarits « {{...}} » ne sont vérifiables qu'une fois instanciés (voir plus bas) : ici, seule la forme */
  const isTpl = v => typeof v === 'string' && v.indexOf('{{') >= 0;
  const shape = (v, where) => { if (!isTpl(v) && !Array.isArray(v)) err(where + ' doit être une liste d’étapes'); };
  shape(def.inject, 'inject'); shape(def.fix, 'fix');
  Object.keys(def.fixes || {}).forEach(k => shape(def.fixes[k], 'fixes.' + k));
  Object.keys(def.workarounds || {}).forEach(k => shape(def.workarounds[k], 'workarounds.' + k));
  if (!isTpl(def.probes) && (!Array.isArray(def.probes) || !def.probes.length)) err('au moins une sonde (symptôme observable) est obligatoire');
  if (errors.length) return { ok: false, errors, warnings };

  /* simulation complète (dynamique) */
  const fresh = combo => { const W = SIM.buildHealthyWorld({ seed: 1 }); return { W, base: W.sem(), inst: F.instantiate(def, 7, combo) }; };
  const why = rt => rt.probes.filter(p => !p.ok).map(p => p.id + ' : ' + p.why).join(' | ');
  const verifyObs = (W, inst) => { const pats = (inst.verify && inst.verify.length) ? inst.verify : F.defaultVerify(inst); W.observe(pats[0].replace(/\*/g, 'test'), true); };
  for (const combo of F.variantCombos(def, 6)) {
    const tag = Object.keys(combo).length ? ' [variante ' + JSON.stringify(combo) + ']' : '';
    try {
      let { W, base, inst } = fresh(combo);
      const stepsErr = (list, where) => {
        if (!Array.isArray(list)) { err(where + ' : liste d’étapes attendue après instanciation' + tag); return false; }
        let okAll = true;
        list.forEach((st, i) => { if (!st || typeof st.do !== 'string') { err(where + '[' + i + '] : champ « do » manquant' + tag); okAll = false; } else if (!SIM.steps[st.do]) { err(where + '[' + i + '] : étape inconnue « ' + st.do + ' » (connues : ' + Object.keys(SIM.steps).join(', ') + ')' + tag); okAll = false; } });
        return okAll;
      };
      let structOk = stepsErr(inst.inject, 'inject') & stepsErr(inst.fix, 'fix');
      Object.keys(inst.fixes || {}).forEach(k => { structOk &= stepsErr(inst.fixes[k], 'fixes.' + k); });
      Object.keys(inst.workarounds || {}).forEach(k => { structOk &= stepsErr(inst.workarounds[k], 'workarounds.' + k); });
      if (!inst.probes.length) { err('aucune sonde après instanciation' + tag); structOk = 0; }
      inst.probes.forEach((p, i) => { if (!p || !SIM.probes[p.t]) { err('probes[' + i + '] : type inconnu « ' + (p && p.t) + ' » (connus : ' + Object.keys(SIM.probes).join(', ') + ')' + tag); structOk = 0; } });
      /* D-90 : tant que la règle Snort 1000001 (alerte ICMP depuis Internet, blocage de la source) est active dans le monde sain, aucun scénario ne peut exiger un ping
         de PCEXT vers une adresse de pfsense-tls comme vérification : ce ping bloquerait PCEXT lui-même (table des hôtes bloqués). Contrôle mécanique, comme D-10 et D-16. */
      try {
        const pf = W.dev['pfsense-tls']; const ruleOn = !!(pf && pf.snort && JSON.stringify(pf.snort).indexOf('sid:1000001') >= 0);
        if (ruleOn) {
          const owned = ip => { const o = SIM.net.findOwner(W, ip); return !!(o && o.dev.id === 'pfsense-tls'); };
          inst.probes.forEach((p, i) => { if (p && p.t === 'ping' && p.from === 'PCEXT' && owned(p.to)) err('probes[' + i + '] : ping de PCEXT vers ' + p.to + ' (adresse de pfsense-tls) refusé — la règle Snort 1000001 est active et ce ping bloquerait PCEXT (D-90). Vérifier autrement (HTTP, connexion TCP, état du service).' + tag); });
          /* « exiger » : la clôture se fait par OU entre les motifs de verify (F.evaluate). Un motif ping de PCEXT vers le WAN n'est une exigence que s'il est le SEUL
             moyen de clore ; avec une alternative (connect, http…), le ping reste une voie possible mais jamais obligatoire. */
          const vs = (inst.verify || []).map(String);
          const isAtkPing = v => { const m = /^ping:PCEXT:(.+)$/.exec(v); return !!m && (owned(m[1]) || m[1] === '*'); };
          if (vs.length && vs.every(isAtkPing)) err('verify « ' + vs.join(' | ') + ' » : la seule vérification possible est un ping de PCEXT vers pfsense-tls, refusée (D-90) — ajouter une vérification par connexion TCP, HTTP ou état du service.' + tag);
        }
      } catch (e) { err('contrôle D-90 impossible : ' + e.message + tag); }
      if (!structOk) continue;
      let rt = F.evaluate(W, inst, base);
      if (!rt.allOk) err('monde SAIN : sondes déjà en échec avant injection — ' + why(rt) + tag);
      ({ W, base, inst } = fresh(combo)); F.runSteps(W, inst.inject); rt = F.evaluate(W, inst, base);
      if (rt.allOk) err('aucun symptôme après injection : aucune sonde ne passe au rouge' + tag);
      if (inst.roots && inst.roots.length && rt.rootsFixed) err('la racine est déjà « réparée » juste après l’injection' + tag);
      const fixes = Object.assign({}, inst.fixes || {}); if (inst.fix) fixes.main = inst.fix;
      for (const name of Object.keys(fixes)) {
        ({ W, base, inst } = fresh(combo)); F.runSteps(W, inst.inject); F.runSteps(W, fixes[name]); rt = F.evaluate(W, inst, base);
        if (!rt.allOk) err('correction « ' + name + ' » : sondes encore en échec — ' + why(rt) + tag);
        else if (!rt.rootsFixed) err('correction « ' + name + ' » : racine non réparée (serait vue comme un contournement)' + tag);
        else { verifyObs(W, inst); rt = F.evaluate(W, inst, base); if (rt.status !== 'resolved') err('correction « ' + name + ' » : statut « ' + rt.status + ' » au lieu de « resolved » après vérification' + tag); }
      }
      for (const name of Object.keys(inst.workarounds || {})) {
        ({ W, base, inst } = fresh(combo)); F.runSteps(W, inst.inject); F.runSteps(W, inst.workarounds[name]); rt = F.evaluate(W, inst, base);
        if (rt.status !== 'workaround') err('contournement « ' + name + ' » : statut « ' + rt.status + ' » au lieu de « workaround »' + tag);
      }
    } catch (e) { err('exception pendant la simulation' + tag + ' : ' + e.message); }
  }
  if (!def.traps || !def.traps.length) warnings.push('aucun piège déclaré (champ traps) : le débrief n’aura rien à signaler');
  if (!def.optimal || !def.optimal.length) warnings.push('aucun chemin optimal déclaré (champ optimal) : le débrief ne pourra pas comparer');
  if (!def.roots || !def.roots.length) warnings.push('aucune racine déclarée (champ roots) : un contournement ne sera pas distingué d’une vraie réparation');
  return { ok: !errors.length, errors, warnings };
};

/* Import : valide puis enregistre dans le catalogue de la session. Retourne le résultat de validation. */
F.importScenario = function (def) {
  const r = F.validate(def);
  if (r.ok) SIM.faults.push(JSON.parse(JSON.stringify(def)));
  return r;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
