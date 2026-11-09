// Utilitaires de test des terminaux : exécute des lignes et affiche la sortie
module.exports = function (SIM) {
  const acts = [];
  const env = new SIM.emu.Env(null, null);
  /* Garde-fou du barème (D-109) : « un chemin de réparation déclaré ne coûte aucun malus ».
     Une fois armée sur un monde déjà cassé, chaque action du terminal est passée au même contrôle que Mission.act
     (src/engine/80-game.js) : règles de danger (Game.scanDanger, états avant/après) et tags d'impact
     (svc-stop, nic-down, poweroff, reboot) sauf si la panne déclare needsReboot. Le contrôle est une copie de la règle du jeu,
     pas une réécriture : tests/sweep-coverage.js prouve qu'il vire au rouge quand on retire needsReboot de lx_fstab. */
  const guard = { st: null,
    arm(W, inst) { guard.st = { W, prev: W.sem(), okDanger: (inst && inst.okDanger) || [], needsReboot: !!(inst && inst.needsReboot), dangers: [], impacts: [] }; return guard.st; },
    disarm() { const s = guard.st; guard.st = null; return s ? { dangers: s.dangers, impacts: s.impacts } : { dangers: [], impacts: [] }; },
    see(W, e) {
      const s = guard.st; if (!s || s.W !== W) return;
      const cur = W.sem(); const scan = SIM.game.scanDanger(W, s.prev, cur, [e], s.okDanger);
      if (scan.changed > 0 || e.mutates === true) s.prev = cur;
      scan.found.forEach(x => s.dangers.push({ id: x.id, text: e.text, detail: x.detail }));
      if (e.impact && !s.needsReboot) s.impacts.push({ kind: e.impact, text: e.text });
    } };
  return {
    mk(W) { const e = new SIM.emu.Env(W, { act: x => { acts.push(x); guard.see(W, x); } }); return e; },
    guard,
    acts,
    run(sh, line, opts) {
      opts = opts || {};
      const r = sh.exec(line);
      let out = r.out.map(x => x.t);
      if (r.stream) { for (let i = 0; i < (opts.n || 3); i++) out = out.concat(r.stream.next().map(x => x.t)); out = out.concat(r.stream.stop().map(x => x.t)); }
      if (opts.show !== false) console.log((sh.prompt ? '' : '') + line + '\n' + out.join('\n') + (r.ask ? '\n[ASK ' + r.ask.prompt + ']' : '') + (r.launch ? '\n[LAUNCH ' + JSON.stringify(r.launch) + ']' : ''));
      return r;
    }
  };
};
