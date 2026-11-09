/* Application de gestion de SRV-FIC (D-103) — un parcours PAR CAUSE à travers l'interface (D-66) :
   ouvrir http://gestion.toulouse.local/ dans le navigateur du poste → voir la page d'erreur → réparer au terminal (PuTTY → SRV-LNX)
   → rouvrir → voir le tableau de bord → la panne est « résolue » → clore le ticket.
   Causes (panne lx_db_access) : bind (MariaDB n'écoute que 127.0.0.1), ufw (règle 3306 supprimée), grant (compte limité à un autre sous-réseau).
   + panne lx_svc_stopped (variantes mariadb et mariadb-dis) : service arrêté ; panne lx_disk_full (variantes log et dump) : /var pleine.
   + neutralisation (D-70) : la page suit l'état du monde, pas un drapeau — on change le monde SANS passer par une panne et la page doit suivre. */
const T = require('./lib');
const SIM = require('../load.js')();
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('✗ ' + m); } else console.log('✓ ' + m); };
const URL = 'http://gestion.toulouse.local/';
const blank = () => ({ done: {}, skills: {}, badges: [], history: [], best: {} });

/* graine qui tire la variante voulue (même appel que le jeu) */
function seedFor(faultId, key) {
  for (let s = 1; s < 200; s++) {
    const g = SIM.game.create({ seed: String(s), level: 'confirme', mode: 'free', faultId, clock: () => 0, profile: blank() });
    if (g.fault && g.fault.vars && g.fault.vars.m && g.fault.vars.m.key === key) return String(s);
  }
  throw new Error('aucune graine pour ' + faultId + ' / ' + key);
}
const pageText = t => t.p.evaluate(() => { const cs = [...document.querySelectorAll('.bcontent')]; const c = cs[cs.length - 1]; return c ? c.innerText : ''; });
const termText = t => t.p.evaluate(() => { const ts = [...document.querySelectorAll('.term.t-bash')]; return ts.length ? ts[ts.length - 1].innerText : ''; });
const status = t => t.p.evaluate(() => SIM_APP.run.m.parts.map(x => x.rt && x.rt.status).join(','));
const typeLine = async (t, s, wait) => { await t.p.evaluate(() => { const ts = [...document.querySelectorAll('.term.t-bash')]; ts[ts.length - 1].querySelector('textarea.tin').focus(); }); await t.p.keyboard.type(s); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(wait || 350); };
/* « rouvrir » : nouvelle fenêtre du navigateur sur la même adresse. Quand l'observation fait passer la panne à « résolue », le jeu bascule sur le
   débrief et retire les fenêtres : le texte rendu par la page n'est alors plus lisible dans le DOM, d'où la lecture directe côté serveur (served). */
const reload = async t => { await t.open('browser', URL); await t.p.waitForTimeout(1900); return pageText(t); };
const openApp = reload;
/* contenu que le serveur sert à ce poste (même fonction que le navigateur) */
const served = t => t.p.evaluate(u => { const r = SIM.web.fetch(SIM_APP.run.W, 'PC-ADM', u); return { status: r.status, ok: r.ok, text: r.page ? String(r.page.html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : '' }; }, URL);

async function sshRoot(t) {
  await t.open('putty'); await t.p.waitForTimeout(500);
  await t.p.evaluate(() => { const ins = [...document.querySelectorAll('.win input[type=text]')]; const h = ins.find(i => i.value === '' && i.offsetParent); h.focus(); });
  await t.p.keyboard.type('10.10.10.30'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(900);
  const acc = await t.p.$('button:has-text("Accept")'); if (acc) { await acc.click(); await t.p.waitForTimeout(700); }
  await typeLine(t, 'tssr'); await typeLine(t, 'Tssr-2026!', 700);
  await typeLine(t, 'sudo -i', 500); await typeLine(t, 'Tssr-2026!', 700);
}

async function parcours(label, faultId, key, repair) {
  const seed = seedFor(faultId, key);
  const t = await T.start({ fault: faultId, seed, level: 1, dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  ok(await t.p.evaluate(k => SIM_APP.run.m.parts[0].vars.m.key === k, key), label + ' : la variante tirée est « ' + key + ' »');
  ok(/^active$/.test(await status(t)), label + ' : panne active après injection (' + await status(t) + ')');
  const before = await openApp(t);
  ok(/Service momentanément indisponible/.test(before), label + ' : la page affiche l’erreur de l’application');
  ok(!/0x[0-9A-Fa-f]{4,}|ERROR|ERR_|Access denied|HTTP \d{3}|MariaDB|errno/i.test(before), label + ' : aucun code, aucun message de pile ni de serveur de base dans la page (D-103)');
  const errPage = before;
  await sshRoot(t);
  const who = await termText(t); ok(/root@/.test(who), label + ' : session root sur SRV-LNX (' + who.split('\n').slice(-2).join(' | ').slice(0, 60) + ')');
  await repair(t);
  if (process.env.GESTION_DEBUG) console.log('--- terminal ---\n' + (await termText(t)).split('\n').slice(-12).join('\n'));
  /* D-76 : tant que le joueur n'a pas observé l'application depuis le poste, la réparation seule ne ferme pas le ticket */
  { const st0 = await status(t); ok(st0 === 'fixed', label + ' : réparée mais pas encore observée depuis le poste → statut « fixed », pas « resolved » (' + st0 + ')'); }
  const srv = await served(t);
  ok(srv.status === 200 && /Tableau de bord/.test(srv.text) && /Clients actifs/.test(srv.text), label + ' : le serveur sert le tableau de bord après la réparation (HTTP ' + srv.status + ')');
  const after = await reload(t);
  if (process.env.GESTION_DEBUG) console.log('--- page ---\n' + after + '\n--- bcontents ---\n' + JSON.stringify(await t.p.evaluate(() => [...document.querySelectorAll('.bcontent')].map(c => c.innerText.slice(0, 50)))));
  ok(!/Service momentanément indisponible/.test(after), label + ' : la page d’erreur a disparu');
  ok(/^resolved$/.test(await status(t)), label + ' : panne « résolue » (réparation + observation depuis le poste) (' + await status(t) + ')');
  /* la résolution (réparation + observation depuis le poste) clôt le ticket d'elle-même ; sinon on clique « Clôturer le ticket » */
  await t.p.waitForTimeout(600);
  await t.p.evaluate(() => { if (SIM_APP.run.m.state !== 'done') { const b = [...document.querySelectorAll('button')].find(x => /Clôturer le ticket/.test(x.textContent)); if (b) b.click(); } }); await t.p.waitForTimeout(900);
  ok(await t.p.evaluate(() => SIM_APP.run.m.state === 'done' && SIM_APP.run.m.result && SIM_APP.run.m.result.kind === 'resolved'), label + ' : ticket clos, résolu');
  ok(!t.errs.length, label + ' : aucune erreur de page' + (t.errs.length ? ' : ' + t.errs.join(' ; ') : ''));
  await t.b.close(); return errPage;
}

(async () => {
  const pages = [];
  /* écoute : bind-address = 127.0.0.1 → 0.0.0.0, puis redémarrage */
  pages.push(await parcours('bind', 'lx_db_access', 'bind', async t => {
    await typeLine(t, "sed -i 's/^bind-address.*/bind-address            = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf");
    await typeLine(t, 'systemctl restart mariadb', 900);
  }));
  /* pare-feu : règle 3306 depuis le réseau des serveurs */
  pages.push(await parcours('ufw', 'lx_db_access', 'ufw', async t => {
    await typeLine(t, 'ufw allow from 10.10.10.0/24 to any port 3306 proto tcp', 700);
  }));
  /* compte SQL : retour sur le bon sous-réseau */
  pages.push(await parcours('grant', 'lx_db_access', 'grant', async t => {
    await typeLine(t, 'mysql', 700);
    await typeLine(t, "RENAME USER 'intranet'@'10.10.20.%' TO 'intranet'@'10.10.10.%';", 500);
    await typeLine(t, 'FLUSH PRIVILEGES;', 400); await typeLine(t, 'exit', 400);
  }));
  /* service arrêté (autre panne, même application) */
  pages.push(await parcours('service', 'lx_svc_stopped', 'mariadb', async t => {
    await typeLine(t, 'systemctl start mariadb', 900); await typeLine(t, 'systemctl enable mariadb', 500);
  }));
  /* service arrêté ET désactivé : « start » seul ne suffit pas à la panne (elle revient au redémarrage) → il faut aussi « enable » */
  pages.push(await parcours('service-dis', 'lx_svc_stopped', 'mariadb-dis', async t => {
    await typeLine(t, 'systemctl start mariadb', 900); await typeLine(t, 'systemctl enable mariadb', 500);
  }));
  /* partition /var pleine : la base s'est arrêtée faute de place (deux origines du remplissage) */
  pages.push(await parcours('disque-log', 'lx_disk_full', 'log', async t => {
    await typeLine(t, 'truncate -s 0 /var/log/apache2/intranet_error.log', 600); await typeLine(t, 'systemctl start mariadb', 900);
  }));
  pages.push(await parcours('disque-dump', 'lx_disk_full', 'dump', async t => {
    await typeLine(t, 'rm /var/backups/intranet/vieux-dump-2024.tar.gz', 600); await typeLine(t, 'systemctl start mariadb', 900);
  }));
  ok(new Set(pages.map(p => p.replace(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/g, ''))).size === 1, 'la page d’erreur est identique pour les sept causes (hors horodatage) — D-103');

  /* neutralisation D-70 : monde sain, AUCUNE panne : on coupe la base en modifiant le monde directement ; la page doit suivre */
  const t = await T.start({ fault: 'fw_icmp', seed: '7', level: 1, dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  const healthy = await openApp(t);
  ok(/Tableau de bord/.test(healthy), 'neutralisation : monde sain → tableau de bord');
  await t.p.evaluate(() => { SIM.fault.runSteps(SIM_APP.run.W, [{ do: 'lx.svc', dev: 'SRV-LNX', name: 'mariadb', op: 'stop' }]); });
  const broken = await reload(t);
  ok(/Service momentanément indisponible/.test(broken), 'neutralisation : la base est coupée SANS passer par une panne → la page d’erreur apparaît (la page lit l’état, pas un drapeau de scénario)');
  await t.p.evaluate(() => { SIM.fault.runSteps(SIM_APP.run.W, [{ do: 'lx.svc', dev: 'SRV-LNX', name: 'mariadb', op: 'start' }]); });
  const back = await reload(t);
  ok(/Tableau de bord/.test(back), 'neutralisation : la base revient SANS panne → le tableau de bord revient');
  await t.b.close();
  console.log(fails.length ? fails.length + ' échec(s)' : '0 échec');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('✗ exception : ' + e.stack); process.exit(1); });
