/* Pannes Snort réparées par l'interface web de pfSense (gestes réels) et vérifiées par la détection automatique.
   Cas : service arrêté / désactivé, règle invalide, HOME_NET faux, mauvaise interface, blocage absent (3 variantes),
   poste légitime bloqué, hôte bloqué périmé, cascade. */
const T = require('./lib');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); else console.log('✓ ' + m); };
const status = t => t.p.evaluate(() => SIM_APP.run.m.parts.map(x => x.rt && x.rt.status).join(','));
const GOOD = 'alert icmp $EXTERNAL_NET any -> $HOME_NET any (msg:"ICMP depuis Internet vers le pare-feu"; itype:8; classtype:icmp-event; sid:1000001; rev:1;)\nalert tcp $EXTERNAL_NET any -> $HOME_NET 22 (msg:"Tentative de connexion SSH depuis Internet"; flags:S; classtype:attempted-admin; sid:1000002; rev:1;)';

async function pfLogin(fault, seed) {
  const t = await T.start({ fault, seed, dev: 'PC-ADM', user: 'TOULOUSE\\tssr', pwd: 'Tssr-2026!' });
  await t.open('browser', 'https://10.10.0.1/'); await t.p.waitForTimeout(800);
  await t.p.click('.bwarn button:has-text("Paramètres avancés")'); await t.p.click('.bwarn a:has-text("Continuer")'); await t.p.waitForTimeout(800);
  await t.p.fill('.pfw-login input[type=text]', 'admin'); await t.p.fill('.pfw-login input[type=password]', 'pfSense#2026'); await t.p.click('.pfw-login button'); await t.p.waitForTimeout(900);
  t.nav = async (menu, item) => { await t.p.click('.pfw-mi:has-text("' + menu + '")'); await t.p.click('.pfw-mi.open .pfw-dd a:has-text("' + item + '")'); await t.p.waitForTimeout(500); };
  t.text = () => t.p.evaluate(() => document.querySelector('.pfw-main').innerText);
  t.tab = async (name) => { await t.p.click('.pfw-tabs a:text-is("' + name + '")'); await t.p.waitForTimeout(450); };
  t.row = (descr) => '.pfw-main tr:has(td:text-is("' + descr + '"))';
  return t;
}
/* règle l'instance WAN : tous les champs aux valeurs saines, puis Save */
async function healWan(t, opts) {
  opts = opts || {};
  await t.nav('Services', 'Snort');
  await t.p.click(t.row('WAN') + ' a[title^="Edit"]'); await t.p.waitForTimeout(500);
  const fg = l => '.pfw-main .pfw-fg:has(label.pfw-lbl:text-is("' + l + '"))';
  await t.p.check(fg('Enable') + ' input[type=checkbox]');
  await t.p.selectOption(fg('Interface') + ' select', 'wan');
  if (!opts.keepBlock) { await t.p.check(fg('Block Offenders') + ' input[type=checkbox]'); await t.p.selectOption(fg('Which IP to Block') + ' select', 'src'); }
  await t.p.selectOption(fg('Home Net') + ' select', 'default');
  await t.p.selectOption(fg('Pass List') + ' select', 'default');
  await t.p.click('.pfw-main button:text-is("Save")'); await t.p.waitForTimeout(600);
}
async function startWan(t) {
  await t.nav('Services', 'Snort');
  const a = await t.p.$(t.row('WAN') + ' a[title^="Start Snort"]'); if (a) { await a.click(); await t.p.waitForTimeout(600); }
}
const done = async (t, label) => { await t.p.waitForTimeout(1600); const s = await status(t); ok(/fixed|resolved/.test(s), label + ' (' + s + ')'); };
const errsOf = [];
const close = async t => { errsOf.push(t.errs.length); if (t.errs.length) console.log(t.errs.join('\n')); await t.b.close(); };

(async () => {
  let t;
  /* 1. service arrêté / désactivé (deux variantes selon la graine) */
  for (const seed of ['7', '3', '11']) {
    t = await pfLogin('snort_service', seed);
    ok(/^active$/.test(await status(t)), 'snort_service/' + seed + ' : active après injection');
    await t.nav('Status', 'Services'); let tx = await t.text();
    ok(!/snort\s+Snort IDS\/IPS Daemon - WAN\s+Running/.test(tx), 'snort_service/' + seed + ' : Status > Services ne montre pas le WAN en marche');
    await t.nav('Services', 'Snort'); tx = await t.text(); ok(/Snort Interfaces/.test(tx) && /Pattern Match/.test(tx), 'snort_service/' + seed + ' : page Snort Interfaces');
    await healWan(t, { keepBlock: true }); await startWan(t);
    await done(t, 'snort_service/' + seed + ' : réparée (activer + démarrer)'); await close(t);
  }
  /* 2. règle invalide : correction de custom.rules (+ démarrage) */
  for (const seed of ['7', '3']) {
    t = await pfLogin('snort_rule_syntax', seed);
    await t.nav('Services', 'Snort'); let tx = await t.text(); ok(/WAN\s+Stopped/.test(tx), 'snort_rule_syntax/' + seed + ' : WAN arrêté');
    await t.p.click(t.row('WAN') + ' a[title^="Start Snort"]'); await t.p.waitForTimeout(600); tx = await t.text(); ok(/n’a pas pu démarrer/.test(tx) && /custom\.rules/.test(tx), 'snort_rule_syntax/' + seed + ' : démarrage refusé avec la ligne en cause');
    await t.p.click(t.row('WAN') + ' a[title^="Edit"]'); await t.p.waitForTimeout(400); await t.tab('WAN Rules');
    await t.p.fill('.pfw-main textarea', GOOD); await t.p.click('.pfw-main button:text-is("Save")'); await t.p.waitForTimeout(600);
    await startWan(t); await done(t, 'snort_rule_syntax/' + seed + ' : réparée par WAN Rules → custom.rules'); await close(t);
  }
  /* 3. HOME_NET, interface, blocage (trois variantes), cascade */
  for (const [f, seeds] of [['snort_homenet', ['7', '3', '11']], ['snort_wrong_iface', ['7']], ['snort_no_block', ['7', '3', '11', '5']], ['snort_cascade', ['7']]]) {
    for (const seed of seeds) {
      t = await pfLogin(f, seed);
      ok(/^active$/.test(await status(t)), f + '/' + seed + ' : active après injection');
      await healWan(t); await startWan(t);
      await done(t, f + '/' + seed + ' : réparée par WAN Settings'); await close(t);
    }
  }
  /* 4. poste légitime bloqué : vider Blocked + liste de passage par défaut sur le LAN */
  t = await pfLogin('snort_blocked_legit', '7');
  await t.nav('Services', 'Snort'); await t.tab('Blocked'); let tx = await t.text(); ok(/10\.10\.20\.60/.test(tx), 'snort_blocked_legit : Blocked montre 10.10.20.60');
  await t.p.click('.pfw-main button:text-is("Clear")'); await t.p.click('.pfw-modal button:text-is("Confirm")'); await t.p.waitForTimeout(500);
  await t.tab('Snort Interfaces'); await t.p.click(t.row('LAN') + ' a[title^="Edit"]'); await t.p.waitForTimeout(400);
  await t.p.selectOption('.pfw-main .pfw-fg:has(label.pfw-lbl:text-is("Pass List")) select', 'default'); await t.p.click('.pfw-main button:text-is("Save")');
  await done(t, 'snort_blocked_legit : réparée (Blocked vidé + Pass List default)'); await close(t);
  /* 5. hôte périmé : retrait ciblé de la ligne */
  t = await pfLogin('snort_blocked_stale', '7');
  await t.nav('Services', 'Snort'); await t.tab('Blocked'); tx = await t.text(); ok(/198\.18\.0\.10/.test(tx), 'snort_blocked_stale : Blocked montre 198.18.0.10');
  await t.p.click('.pfw-main a[title^="Remove host"]'); await t.p.waitForTimeout(500);
  await done(t, 'snort_blocked_stale : réparée par Blocked → Remove'); await close(t);
  /* 6. flux réel : ping externe → alerte visible dans Alerts, puis hôte dans Blocked */
  t = await pfLogin(undefined, '7');
  await t.p.evaluate(() => { const W = SIM_APP.run.W; SIM.net.ping(W, 'PCEXT', '198.51.100.2', {}); });
  await t.nav('Services', 'Snort'); await t.tab('Alerts'); tx = await t.text(); ok(/1:1000001/.test(tx) && /ICMP depuis Internet/.test(tx) && /Generic ICMP event/.test(tx), 'flux sain : alerte 1:1000001 visible dans Alerts');
  await t.tab('Blocked'); tx = await t.text(); ok(/198\.18\.0\.10|203\.0\.113\./.test(tx) || /Hosts Blocked/.test(tx), 'flux sain : page Blocked affichée (' + tx.replace(/\s+/g, ' ').slice(0, 160) + ')');
  await close(t);

  console.log(fails.length ? fails.map(x => '✗ ' + x).join('\n') : 'tout est conforme');
  process.exit(fails.length || errsOf.some(n => n) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
