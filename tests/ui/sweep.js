/* Balayage navigateur de TOUTES les pannes : démarrage dans l'interface (3 modes en rotation, 2 graines),
   ticket affiché sans gabarit brut, ouverture des appareils concernés (écran + vue physique), indices,
   réparation par la correction déclarée, clôture du ticket → « Ticket résolu » ; puis abandon → débrief.
   Aucune erreur JS de page ne doit apparaître. Usage : node tests/ui/sweep.js [préfixe-de-panne…] */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; const fails = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/game/dist/EDIVN-Lab.html'); await p.waitForFunction(() => window.SIM_APP);
  const only = process.argv.slice(2);
  const ids = (await p.evaluate(() => SIM.faults.map(f => f.id))).filter(i => !only.length || only.some(o => i.startsWith(o)));
  const modes = ['guided', 'free', 'timed']; let n = 0;
  for (const id of ids) {
    for (const seed of ['11', '29']) {
      const mode = modes[n++ % 3]; const e0 = errs.length;
      const r = await p.evaluate(async ([fid, sd, md]) => {
        const out = { notes: [] }; const def = SIM.faults.find(f => f.id === fid);
        SIM_APP.begin({ level: def.level, mode: md, seed: sd, faultId: fid, profile: { name: 'T', done: {}, skills: {}, badges: [], history: [], best: {} } });
        await new Promise(r => setTimeout(r, 60));
        const run = SIM_APP.run; if (!run) { out.notes.push('aucune partie'); return out; }
        const txt = document.body.innerText;
        if (/\{\{|\}\}|undefined|\[object/.test(txt)) out.notes.push('texte brut parasite à l’écran : ' + (txt.match(/.{0,30}(\{\{|\}\}|undefined|\[object).{0,30}/) || [''])[0]);
        if (!txt.includes(run.m.fault.ticket.subject)) out.notes.push('sujet du ticket absent de l’écran');
        const devs = Object.keys(run.W.dev); const blob = JSON.stringify([run.m.fault.probes, run.m.fault.inject, run.m.fault.fix]);
        const used = devs.filter(d => blob.indexOf('"' + d + '"') >= 0 || blob.indexOf(d + '.') >= 0 || blob.indexOf(d + ':') >= 0 || blob.indexOf(d + '/') >= 0).slice(0, 4);
        for (const d of used) { for (const w of ['main', 'rig']) { try { SIM_APP.openDev(d, w); } catch (e) { out.notes.push('openDev ' + d + ' ' + w + ' : ' + e.message); } await new Promise(r => setTimeout(r, 30)); } }
        if (md !== 'timed') { for (let i = 0; i < 3; i++) SIM_APP.hint(); if (run.m.hintLog.length !== 3) out.notes.push('3 indices attendus, ' + run.m.hintLog.length + ' obtenus'); }
        /* réparation par la correction déclarée */
        const inst = run.m.parts[0];
        SIM.fault.runSteps(run.W, inst.fix, { inst });
        const pats = (inst.verify && inst.verify.length) ? inst.verify : SIM.fault.defaultVerify(inst); run.W.observe(pats[0].replace(/\*/g, 'test'), true);
        SIM_APP.closeTicket(); await new Promise(r => setTimeout(r, 100));
        out.status = run.m.result && run.m.result.kind; out.ended = run.ended;
        if (!/Ticket (résolu|validé|parfait)/.test(document.body.innerText)) out.notes.push('débrief de résolution absent (résultat ' + out.status + ')');
        if (!/chemin optimal/i.test(document.body.innerText)) out.notes.push('débrief sans chemin optimal');
        return out;
      }, [id, seed, mode]);
      if (r.notes.length || r.status !== 'resolved') fails.push(id + ' graine ' + seed + ' (' + mode + ') : ' + (r.notes.concat(r.status !== 'resolved' ? ['statut ' + r.status] : [])).join(' ; '));
      if (errs.length > e0) fails.push(id + ' graine ' + seed + ' : ' + errs.slice(e0).join(' | ').slice(0, 300));
    }
  }
  /* abandon → débrief + « Rejouer » (pas de minuteurs orphelins) */
  const ab = await p.evaluate(async () => {
    SIM_APP.begin({ level: 2, mode: 'free', seed: '5', faultId: 'dhcp_scope_off' }); await new Promise(r => setTimeout(r, 50));
    const r1 = SIM_APP.run; r1.m.giveUp(); r1.finish(); await new Promise(r => setTimeout(r, 80));
    const ok1 = document.body.innerText.includes('Ticket abandonné');
    SIM_APP.begin({ level: 2, mode: 'free', seed: '5', faultId: 'dhcp_scope_off' }); await new Promise(r => setTimeout(r, 50));
    return { ok1, oldEnded: r1.ended, newRunning: !SIM_APP.run.ended, same: SIM_APP.run === r1 };
  });
  if (!ab.ok1 || !ab.newRunning || ab.same) fails.push('abandon/rejouer : ' + JSON.stringify(ab));
  console.log(fails.length ? fails.map(x => '✗ ' + x).join('\n') : '✓ ' + ids.length + ' pannes × 2 graines : démarrage, appareils, indices, réparation, débrief');
  console.log(errs.slice(0, 20).join('\n') || 'no errors'); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
