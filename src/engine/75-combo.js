/* ============================================================================
   Pannes composées (niveau 5) : plusieurs causes racines injectées ensemble, un ticket unique.
   Génération déterministe (seed), validée par simulation :
     - indep : chaque cause est visible et se corrige seule (ses sondes repassent au vert sans toucher aux autres) ;
     - chain : les causes se masquent (corriger l'une ne suffit pas), toutes visibles avant correction.
   Dans les deux modes : toutes corrections appliquées → tout est vert et toutes les racines sont réparées.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U; const F = SIM.fault;

F.COMBO_MIN_LEVEL = 2; F.COMBO_MAX_LEVEL = 4;
/* Domaine technique d'une panne (évite de composer deux pannes de même nature par défaut) */
F.domainOf = function (id) {
  if (/^(ad_|gpo_|sh_|web_|iis_)/.test(id)) return 'windows';
  if (/^c_/.test(id)) return 'cisco';
  if (/^(pf_|vpn_)/.test(id)) return 'pare-feu';
  if (/^lx_/.test(id)) return 'linux';
  if (/^(dhcp_|dns_|ipv4_|fw_)/.test(id)) return 'services-reseau';
  return 'physique';
};

function injectedWorld(seed, insts) {
  const W = SIM.buildHealthyWorld({ seed }); const base = W.sem();
  for (const i of insts) F.runSteps(W, i.inject, { inst: i });
  return { W, base };
}
function validate(seed, insts, mode) {
  /* 1. toutes les causes sont visibles une fois tout injecté */
  const a = injectedWorld(seed, insts);
  for (const i of insts) { const rt = F.evaluate(a.W, i, a.base); if (rt.allOk) return 'cause masquée ou sans effet : ' + i.id; }
  /* 2. toutes les corrections → tout est vert, racines réparées */
  for (const i of insts) F.runSteps(a.W, i.fix, { inst: i });
  for (const i of insts) { const rt = F.evaluate(a.W, i, a.base); if (!rt.allOk) return 'corrections complètes insuffisantes : ' + i.id + ' (' + rt.probes.filter(p => !p.ok).map(p => p.why).join('|') + ')'; if (!rt.rootsFixed) return 'racine non réparée après correction : ' + i.id; }
  /* 3. indépendance (indep) ou masquage (chain : corriger une cause seule laisse ses propres sondes en échec) */
  let masked = false;
  for (let k = 0; k < insts.length; k++) {
    const b = injectedWorld(seed, insts);
    F.runSteps(b.W, insts[k].fix, { inst: insts[k] });
    const rtk = F.evaluate(b.W, insts[k], b.base);
    if (mode === 'indep') {
      if (!rtk.allOk) return 'dépendance : la correction seule de ' + insts[k].id + ' ne suffit pas';
      for (let j = 0; j < insts.length; j++) if (j !== k && F.evaluate(b.W, insts[j], b.base).allOk) return 'effet de bord : ' + insts[j].id + ' réparée par ' + insts[k].id;
    } else {
      masked = masked || !rtk.allOk;
    }
  }
  if (mode === 'chain' && !masked) return 'aucun masquage : les causes sont indépendantes';
  return null;
}
F.bundleCandidates = function () { return SIM.faults.filter(d => d.level >= F.COMBO_MIN_LEVEL && d.level <= F.COMBO_MAX_LEVEL); };

/* opts : { count (2|3), mode ('indep'|'chain'|'auto'), minLevelSum, pool (ids), exclude (ids), domainsDistinct (déf. true) } */
F.bundle = function (seed, opts) {
  opts = opts || {}; const count = opts.count || 3; const rng = U.rng('bundle|' + seed);
  let pool = F.bundleCandidates(); if (opts.pool) pool = pool.filter(d => opts.pool.indexOf(d.id) >= 0); if (opts.exclude) pool = pool.filter(d => opts.exclude.indexOf(d.id) < 0);
  if (opts.levels) pool = pool.filter(d => opts.levels.indexOf(d.level) >= 0);
  const anchors = opts.anchor ? pool.filter(d => opts.anchor.indexOf(d.id) >= 0) : null;
  const modes = opts.mode && opts.mode !== 'auto' ? [opts.mode] : (rng.chance(0.35) ? ['chain', 'indep'] : ['indep']);
  let lastErr = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const mode = modes[Math.min(attempt >= 14 ? 1 : 0, modes.length - 1)];
    const chosen = []; const doms = new Set(); let tries = rng.shuffle(pool);
    if (anchors && anchors.length) { const a = rng.pick(anchors); tries = [a].concat(tries.filter(d => d !== a)); }
    /* niveau exigé : une panne de ce niveau est placée en premier (ex. Cyber : au moins une panne de niveau 4) */
    else if (opts.needLevel) { const nl = tries.filter(d => d.level === opts.needLevel); if (nl.length) tries = [nl[0]].concat(tries.filter(d => d !== nl[0])); }
    for (const d of tries) {
      const dom = F.domainOf(d.id); if (opts.domainsDistinct !== false && doms.has(dom) && attempt < 40) continue;
      chosen.push(d); doms.add(dom); if (chosen.length >= count) break;
    }
    if (chosen.length < count) continue;
    if (opts.minLevelSum && chosen.reduce((s, d) => s + d.level, 0) < opts.minLevelSum) continue;
    if (opts.needLevel && !chosen.some(d => d.level === opts.needLevel)) continue;
    const insts = chosen.map((d, i) => F.instantiate(d, seed + '#' + i));
    let err; try { err = validate(seed, insts, mode); } catch (e) { err = 'exception ' + e.message; }
    if (err) { lastErr = err; continue; }
    return F.assembleBundle(seed, insts, mode);
  }
  throw new Error('Impossible de composer une panne multi-causes (seed ' + seed + ') : ' + lastErr);
};
F.assembleBundle = function (seed, insts, mode) {
  const uniq = a => a.filter((x, i) => a.indexOf(x) === i);
  const sites = uniq(insts.map(i => i.ticket.site));
  /* Chaque message d'origine commence par sa propre formule de politesse : on la retire pour que le ticket composé se lise comme un seul message. */
  const clean = t => { const x = t.replace(/\n+/g, ' ').replace(/^\s*(bonjour|bonsoir|salut)\s*[,!.]?\s*/i, '').trim(); return /^(https?:|\\\\|\/)/i.test(x) ? x : x.charAt(0).toUpperCase() + x.slice(1); };   /* une adresse (http://, \\\\srv, /srv) garde sa casse */
  const body = 'Bonjour, plusieurs problèmes en même temps, je ne sais pas s’ils sont liés :\n' + insts.map((i, k) => (k + 1) + ') ' + (i.ticket.from && i.ticket.from !== insts[0].ticket.from ? 'Signalé par ' + i.ticket.from + ' : ' : '') + clean(i.ticket.body)).join('\n') + '\nMerci de regarder dès que possible.';
  return {
    id: 'combo-' + seed, level: 5, bundle: true, mode, parts: insts, partIds: insts.map(i => i.id),
    title: insts.length + ' pannes dans un seul ticket',
    skills: uniq([].concat.apply([], insts.map(i => i.skills))),
    ticket: { from: insts[0].ticket.from, subject: 'Plusieurs dysfonctionnements en même temps', body, site: sites.length > 1 ? sites : sites[0] },
    cause: insts.map((i, k) => (k + 1) + '. ' + i.cause).join('\n'), solution: insts.map((i, k) => (k + 1) + '. ' + i.solution).join('\n'),
    hints: ['Plusieurs causes indépendantes ou liées sont à l’œuvre : listez chaque symptôme et traitez-les un par un, en retestant après chaque correction.', 'Pour chaque symptôme, isolez la couche en cause (physique, adressage, nom, service, filtrage) avant de modifier quoi que ce soit.' + (mode === 'chain' ? ' Une panne peut en cacher une autre : retestez toujours après correction.' : ''), 'Indices par cause : ' + insts.map((i, k) => (k + 1) + ') ' + i.hints[0]).join(' ')],
    traps: uniq([].concat.apply([], insts.map(i => i.traps || []))), optimal: [].concat.apply([], insts.map(i => i.optimal || []))
  };
};
F.bundleInject = function (W, b) { for (const i of b.parts) F.runSteps(W, i.inject, { inst: i }); };
F.bundleEvaluate = function (W, b, base) {
  const parts = b.parts.map(i => ({ id: i.id, rt: F.evaluate(W, i, base) }));
  const st = parts.map(p => p.rt.status);
  const status = st.every(s => s === 'resolved') ? 'resolved' : st.some(s => s === 'active') ? 'active' : st.some(s => s === 'workaround') ? 'workaround' : 'fixed';
  return { status, parts, solved: parts.filter(p => p.rt.allOk).length, total: parts.length };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
