/* Balayage « réparable au terminal » — Linux. Pour CHAQUE panne Linux × CHAQUE variante :
   monde sain → injection → réparation faite UNIQUEMENT avec de vraies commandes (nano + enregistrement, chmod, chown, systemctl, ufw, setfacl, mysql, mv, ln, rm, truncate, reboot…)
   traduites depuis les étapes de correction scriptées → la panne doit passer à « réparée ». Un échec = une commande réelle que le simulateur ne sait pas faire.
   Les étapes qui ne modifient qu'un fichier sont rejouées par l'éditeur (le texte final est calculé sur une copie du monde). */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const F = SIM.fault; const LX = SIM.lx;
const only = process.argv[2] || '';
const SKIP = process.env.SWEEP_SKIP || '', BREAK = process.env.SWEEP_BREAK || '';   /* crochets de neutralisation (tests/sweep-coverage.js) */
/* Variantes dont la correction touche un serveur Linux mais ne se répare pas au terminal seul : exemptées, avec la raison (dette déclarée, jamais silencieuse). */
const EXEMPT = {
  'lx_nginx#2': 'certificat expiré : la correction est une date de fin de validité modifiée dans le modèle (étape « set »), sans commande de renouvellement émulée dans le terminal (certbot / openssl) — écart de contenu à instruire',
  'multi_vitrine#0': 'panne composée : une partie se corrige dans l’interface pfSense (redirection de port), le reste est une panne web Linux déjà couverte par ailleurs'
};
const touched = [];
const res = []; const sq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
const text = r => r.out.map(x => x.t).join('\n');
const ruleCmd = (op, r) => { const pre = op === 'delete' ? 'ufw delete ' : 'ufw '; const act = r.action.toLowerCase(); const m = String(r.to).match(/^(\d+)\/(tcp|udp)$/); const port = m ? m[1] : r.to, proto = m ? m[2] : null;
  if (r.from === 'Anywhere') return pre + act + ' ' + r.to; return pre + act + ' from ' + r.from + ' to any port ' + port + (proto ? ' proto ' + proto : ''); };
const aclCmds = (path, acl) => { if (acl === null) return ['setfacl -b ' + path]; const c = []; Object.keys(acl.users || {}).forEach(u => c.push('setfacl -m u:' + u + ':' + acl.users[u] + ' ' + path)); Object.keys(acl.groups || {}).forEach(g => c.push('setfacl -m g:' + g + ':' + acl.groups[g] + ' ' + path)); return c; };

for (const def of SIM.faults) {
  if (only && def.id.indexOf(only) < 0) continue;
  const keys = Object.keys(def.vary || {}); const n = Math.max(1, ...keys.map(k => def.vary[k].length));
  for (let i = 0; i < n; i++) {
    const forced = {}; keys.forEach(k => { forced[k] = i % def.vary[k].length; });
    const inst = F.instantiate(def, 7, forced); const steps = inst.fix || [];
    if (process.env.PENALTY_BREAK && def.id === process.env.PENALTY_BREAK) inst.needsReboot = false;   /* crochet de neutralisation (tests/sweep-coverage.js) : la panne ne déclare plus son redémarrage, le garde-fou D-109 doit virer au rouge */
    const lxSteps = steps.filter(s => (s.dev && /^SRV-(LNX|WEB)$/.test(s.dev)) || /^lx\./.test(s.do));
    if (steps.some(s => /^SRV-(LNX|WEB)$/.test(s.dev || String(s.path || '').split('.')[0]) || /^lx\./.test(s.do))) touched.push(def.id + '#' + i);   /* toute variante dont la correction touche un serveur Linux doit être balayée ou exemptée avec sa raison */
    if (!lxSteps.length || lxSteps.length !== steps.length) continue;         /* uniquement les pannes 100 % Linux */
    if (SKIP && def.id === SKIP) continue;   /* crochet de neutralisation (tests/sweep-coverage.js) */
    const tag = def.id + '#' + i; const W = SIM.buildHealthyWorld({ seed: 1 }); const base = W.sem(); F.runSteps(W, inst.inject);
    const pre = F.evaluate(W, inst, base).status; const log = []; let fail = null;
    /* texte final des fichiers modifiés par les étapes « fichier », calculé sur une copie du monde */
    const W2 = SIM.buildHealthyWorld({ seed: 1 }); F.runSteps(W2, inst.inject);
    const env = T.mk(W); T.guard.arm(W, inst); const sh = {}; const shell = dev => { if (!sh[dev]) { sh[dev] = SIM.emu.openLxShell(env, dev, { user: 'root', tty: 'tty1', emergency: !!W.d(dev)._rt.emergency });
      if (W.d(dev)._rt.rootRO) { const r = sh[dev].exec('mount -o remount,rw /'); log.push(dev + '# mount -o remount,rw /' + (text(r) ? '\n' + text(r) : '')); } } return sh[dev]; };
    const run = (dev, cmd) => { const r = shell(dev).exec(cmd); const o = text(r); log.push(dev + '# ' + cmd + (o ? '\n' + o : '')); if (r.status && r.status !== 0 || /command not found|No such file|invalid|ERROR|Usage|Could not|not found/i.test(o) && !/^\s*$/.test(o)) { fail = fail || ('« ' + cmd + ' » → ' + o.split('\n')[0]); } return r; };
    const edit = (dev, path, newText) => { const r = shell(dev).exec('nano ' + path); if (!r.edit) { fail = fail || ('nano ' + path + ' : pas d’éditeur'); return; } const s = shell(dev).editorSave(r.edit.path, newText); log.push(dev + '# nano ' + path + ' + enregistrer' + (s.ok ? '' : ' → ' + s.msg)); if (!s.ok) fail = fail || ('enregistrement ' + path + ' : ' + s.msg); };
    for (const st of (BREAK && def.id === BREAK ? [] : lxSteps)) {   /* recette volontairement cassée : le balayage doit virer au rouge */
      const dev = st.dev;
      try {
        if (st.do === 'lx.replace' || st.do === 'lx.fstab' || st.do === 'lx.append' || st.do === 'lx.write') {
          const path = st.do === 'lx.fstab' ? '/etc/fstab' : st.path; F.runSteps(W2, [st]); edit(dev, path, LX.readFile(W2.d(dev), path));
        } else if (st.do === 'lx.chmod') run(dev, 'chmod ' + st.mode + ' ' + st.path);
        else if (st.do === 'lx.chown') run(dev, 'chown ' + (st.owner || '') + (st.group ? ':' + st.group : '') + ' ' + st.path);
        else if (st.do === 'lx.svc' || st.do === 'svc') run(dev, 'systemctl ' + (st.op || (st.state === 'running' ? 'start' : 'stop')) + ' ' + st.name);
        else if (st.do === 'lx.mv') run(dev, 'mv ' + st.from + ' ' + st.to);
        else if (st.do === 'lx.link') run(dev, 'ln -s ' + st.target + ' ' + st.path);
        else if (st.do === 'lx.rm') run(dev, 'rm ' + st.path);
        else if (st.do === 'lx.truncate') run(dev, 'truncate -s 0 ' + st.path);
        else if (st.do === 'lx.ufw') { if (st.op === 'add' || st.op === 'delete') run(dev, ruleCmd(st.op, st.rule)); else throw new Error('ufw op ' + st.op); }
        else if (st.do === 'lx.acl') aclCmds(st.path, st.acl).forEach(c => run(dev, c));
        else if (st.do === 'lx.netapply') run(dev, 'systemctl restart networking');
        else if (st.do === 'reboot') { const r = shell(dev).exec('reboot'); log.push(dev + '# reboot'); if (r.reboot || r.launch) { /* l’interface relance le démarrage */ } SIM.steps.reboot(W, st, {}); }
        else if (st.do === 'lx.db') { const u = st.user, h = st.host; if (st.op === 'host') { const sess = run(dev, 'mysql'); const sql = sess.push; const q = c => { const o = text(sql.exec(c)); log.push('MariaDB> ' + c + '\n' + o); if (/ERROR|Requête non gérée/.test(o)) fail = fail || ('« ' + c + ' » → ' + o.split('\n')[0]); };
              const cur = W.d(dev).db.users.find(x => x.user === u); q("RENAME USER '" + u + "'@'" + cur.host + "' TO '" + u + "'@'" + h + "';"); q('FLUSH PRIVILEGES;'); sql.exec('exit'); } else throw new Error('lx.db op ' + st.op); }
        else throw new Error('étape non traduite ' + st.do);
      } catch (e) { fail = fail || 'NON TRADUIT : ' + e.message; }
    }
    const gd = T.guard.disarm();   /* D-109 : un chemin déclaré ne coûte aucun malus (ni danger, ni impact) */
    if (!fail && (gd.dangers.length || gd.impacts.length)) fail = 'malus sur un chemin déclaré : ' + gd.dangers.map(x => 'danger ' + x.id + ' (' + x.text + ')').concat(gd.impacts.map(x => 'impact ' + x.kind + ' (' + x.text + ')')).join(' ; ');
    const post = F.evaluate(W, inst, base).status; const ok = !fail && ['fixed', 'resolved'].indexOf(post) >= 0;
    res.push({ tag, ok, pre, post, fail, log });
  }
}
let bad = 0;
if (!only) { const done = new Set(res.map(r => r.tag)); touched.filter(t => !done.has(t) && !EXEMPT[t]).forEach(t => { bad++; console.log('✗ non couverte par le balayage Linux : ' + t + ' (sa correction touche un serveur Linux : l\'ajouter au balayage ou l\'exempter avec sa raison)'); }); }
res.forEach(r => { if (!r.ok) { bad++; console.log('✗ ' + r.tag + ' : ' + (r.fail || 'statut final ' + r.post + ' (avant : ' + r.pre + ')')); if (process.env.VERBOSE) console.log(r.log.join('\n').replace(/^/gm, '    ')); } else if (process.env.VERBOSE) console.log('✓ ' + r.tag); });
console.log(res.length + ' combinaisons Linux, ' + (res.length - bad) + ' réparées au terminal, ' + bad + ' échec(s)' + (only ? '' : ', ' + touched.length + ' variantes touchant un serveur Linux dont ' + Object.keys(EXEMPT).filter(t => touched.indexOf(t) >= 0).length + ' exemptée(s)')); process.exit(bad ? 1 : 0);
