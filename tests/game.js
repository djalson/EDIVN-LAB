// Parties scriptées : une mission par niveau, résolution via les corrections de test, score, débrief, détection de danger.
const SIM = require('./load')(); const G = SIM.game, F = SIM.fault;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
let now = 0; const clock = () => now;
const solve = (m, verifyPart) => {
  m.parts.forEach(p => {
    m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'diagnostic ' + p.id });
    F.runSteps(m.W, p.fix, { inst: p }); now += 5000;
    m.act({ kind: 'ui', dev: 'x', text: 'correction ' + p.id, mutates: true });
  });
  /* vérification depuis le poste client une fois toutes les causes corrigées (une cause masquée peut invalider un test fait trop tôt) */
  m.parts.forEach(p => { const pats = ((p.verify && p.verify.length) ? p.verify : F.defaultVerify(p)); m.W.observe(pats[0].replace(/\*/g, 'test'), true); });
  m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'test client' });
};
for (const [lvl, mode] of [['junior', 'free'], ['confirme', 'guided'], ['admin', 'timed'], ['cyber', 'free'], ['chaos', 'free']]) {
  console.log('== ' + lvl + ' / ' + mode); now = 0;
  const m = G.create({ seed: 'g-' + lvl, level: lvl, mode, clock, profile: { done: {}, skills: {}, badges: [], history: [], best: {} } });
  ok(m.check().status === 'active', 'état initial actif : ' + m.fault.id);
  m.act({ kind: 'cmd', dev: 'PC-ADM', text: 'ipconfig /all' }); now += 60000;
  const h = m.hint(); ok(mode === 'timed' ? h.denied : h.n === 1, 'indice ' + (mode === 'timed' ? 'refusé' : 'fourni'));
  const c0 = m.close(); ok(c0.ok === false, 'clôture prématurée refusée');
  now += 30000; solve(m);
  ok(m.state === 'done' && m.result.kind === 'resolved', 'résolu automatiquement après vérification (' + (m.result && m.result.kind) + ')');
  const d = m.debrief(); ok(d.skills.length > 0 && d.path.optimal.length > 0, 'débrief : ' + d.skills.length + ' compétence(s), ' + d.path.actions + ' action(s), score ' + m.result.total + ' (' + m.result.stars + '★)');
  const rec = G.record(m, { name: 't', done: {}, skills: {}, badges: [], history: [], best: {} }); ok(rec.profile.history.length === 1, 'profil mis à jour, badges : ' + rec.newBadges.map(b => b.id).join(','));
}
console.log('== danger');
now = 0; const m = G.create({ seed: 'd1', level: 'confirme', mode: 'free', clock, faultId: 'lx_perm', profile: { done: {}, skills: {}, badges: [], history: [], best: {} } });
F.runSteps(m.W, [{ do: 'lx.chmod', dev: 'SRV-LNX', path: '/srv/echanges', mode: '0777' }]); let r = m.act({ kind: 'cmd', dev: 'SRV-LNX', text: 'chmod 777 /srv/echanges', mutates: true });
ok(r.dangers.some(x => x.id === 'chmod-open'), 'chmod 777 détecté comme dangereux');
F.runSteps(m.W, [{ do: 'lx.ufw', dev: 'SRV-LNX', op: 'disable' }]); r = m.act({ kind: 'cmd', dev: 'SRV-LNX', text: 'ufw disable', mutates: true });
ok(r.dangers.some(x => x.id === 'ufw-off'), 'ufw disable détecté comme dangereux');
console.log('== contournement');
now = 0; const m2 = G.create({ seed: 'w1', level: 'confirme', mode: 'free', clock, faultId: 'dns_rec_wrong', profile: { done: {}, skills: {}, badges: [], history: [], best: {} } });
console.log('  fault', m2.fault.id, Object.keys(m2.fault.workarounds || {}));
console.log('== aides consultées (D-94 / D-95) : tracées, sans malus, hors du chemin');
{ const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
  const run = withAids => { now = 0; const m = G.create({ seed: 'aid1', level: 'confirme', mode: 'timed', clock, faultId: 'dns_svc', profile: prof() });
    if (withAids) { now = 5000; m.aid('plan'); now = 9000; m.aid('memo'); m.aid('plan'); }
    now = 20000; solve(m, true); return m; };
  const A = run(false), B = run(true);
  ok(B.debrief().aids.length === 3 && B.debrief().aids.map(x => x.kind).join() === 'plan,memo,plan', 'les 3 ouvertures sont tracées au débrief (plan, aide-mémoire, plan)');
  ok(A.debrief().aids.length === 0, 'sans consultation : aucune aide au débrief');
  ok(JSON.stringify(A.result.score) === JSON.stringify(B.result.score), 'aucun point retiré : barème identique avec et sans consultation');
  ok(A.debrief().path.actions === B.debrief().path.actions && B.trace.every(x => x.kind !== 'aid'), 'une consultation n’est pas une action du chemin suivi');
  /* neutralisation (D-70) : si aid() écrivait dans la trace d'actions, le contrôle « pas une action du chemin » virerait au rouge */
  const leaky = G.create({ seed: 'aid1', level: 'confirme', mode: 'timed', clock, faultId: 'dns_svc', profile: prof() }); const orig = leaky.aid.bind(leaky);
  leaky.aid = k => { leaky.trace.push({ t: 0, kind: 'aid', text: k, cls: 'diagnostic' }); return orig(k); }; leaky.aid('plan');
  ok(!leaky.trace.every(x => x.kind !== 'aid'), 'neutralisation : une consultation écrite dans la trace est bien détectée par le même contrôle'); }
console.log('== redémarrage nécessaire à la correction (lx_fstab) : pas de malus « à impact »');
{ const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
  const reboot = id => { now = 0; const m = G.create({ seed: 'rb1', level: 'confirme', mode: 'free', clock, faultId: id, profile: prof() }); m.act({ kind: 'cmd', dev: 'SRV-LNX', text: 'reboot', mutates: true, impact: 'reboot' }); return m.impacts.length; };
  ok(reboot('lx_fstab') === 0, 'lx_fstab : le redémarrage, étape de la correction, n’est pas compté comme impact');
  ok(reboot('dns_svc') === 1, 'une autre panne : un redémarrage reste un impact (−4)');
  /* neutralisation (D-70) : sans l'indicateur needsReboot sur la panne, le malus réapparaît */
  const def = SIM.faults.find(d => d.id === 'lx_fstab'); const keep = def.needsReboot; delete def.needsReboot; const n = reboot('lx_fstab'); def.needsReboot = keep;
  ok(n === 1, 'neutralisation : indicateur retiré → le redémarrage est de nouveau compté comme impact (le contrôle ci-dessus virerait au rouge)'); }
console.log('== D-109 : exemption de danger limitée à l’élément du chemin déclaré (gpo_order)');
{ const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
  const del = (id, strip) => { now = 0; const def = SIM.faults.find(d => d.id === 'gpo_order'); const keep = def.okDanger; if (strip) delete def.okDanger;
    const m = G.create({ seed: 'gd1', level: 'confirme', mode: 'free', clock, faultId: 'gpo_order', profile: prof() });
    F.runSteps(m.W, [{ do: 'del', path: 'SRV-DC1.win.ad.gpos[id=' + id + ']' }]); m.act({ kind: 'ui', dev: 'SRV-DC1', text: 'Suppression de la GPO ' + id, mutates: true }); def.okDanger = keep; return m.dangers.length; };
  ok(del('GPO5') === 0, 'supprimer la GPO de test créée par la panne (chemin déclaré) : aucun danger');
  ok(del('GPO3') === 1, 'supprimer une AUTRE GPO (GPO_Fond_Ecran, le piège) : reste un danger');
  { now = 0; const m = G.create({ seed: 'gd2', level: 'confirme', mode: 'free', clock, faultId: 'gpo_enforced', profile: prof() });
    F.runSteps(m.W, [{ do: 'del', path: 'SRV-DC1.win.ad.gpos[id=GPO6]' }]); m.act({ kind: 'ui', dev: 'SRV-DC1', text: 'Suppression de la GPO fautive', mutates: true });
    ok(m.dangers.length === 0, 'gpo_enforced : supprimer la GPO fautive créée par la panne : aucun danger'); }
  ok(del('GPO5', true) === 1, 'neutralisation : exemption retirée → la suppression de la GPO de test redevient un danger'); }
console.log('== D-90 : le débrief nomme la cause du blocage de PCEXT');
{ const prof = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });
  const play = ping => { now = 0; const m = G.create({ seed: 'x1', level: 'confirme', mode: 'free', clock, faultId: 'pf_gateway', profile: prof() }); if (ping) SIM.net.ping(m.W, 'PCEXT', '198.51.100.2', {}); m.act({ kind: 'cmd', dev: 'PCEXT', text: 'ping 198.51.100.2' }); m.giveUp(); return m; };
  const a = play(true), b = play(false);
  const fx = a.debrief().sideEffects;
  ok(fx.length === 1 && fx[0].host === 'PCEXT' && fx[0].sid === 1000001 && fx[0].on === 'pfsense-tls', 'le ping de PCEXT vers le WAN produit un effet de bord nommé : PCEXT bloqué par la règle 1000001 sur pfsense-tls');
  ok(a.debrief().path.deadEnds.length >= 1 && a.result.score.danger === 0 && a.result.score.impact === 0, 'classé « sans effet » (impasse), ni dangereux ni à impact : aucun point retiré (D-40 prime)');
  ok(b.debrief().sideEffects.length === 0, 'neutralisation : sans le ping, aucun effet de bord au débrief (le contrôle ne se déclenche pas à vide)'); }
console.log(bad ? bad + ' échec(s)' : 'OK'); process.exit(bad ? 1 : 0);
