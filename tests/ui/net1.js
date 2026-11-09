/* Test E2E : panne OpenVPN côté client réparée uniquement par OpenVPN GUI (édition du .ovpn + reconnexion). */
const T = require('./lib');
async function logon(p, u, pw) { const l = await p.$('.logon'); if (!l) return; await p.click('.logon'); await p.waitForTimeout(200); let ti = await p.$('.logon input[type=text]'); if (!ti) { await p.click('.logon .other'); await p.waitForTimeout(200); ti = await p.$('.logon input[type=text]'); } if (ti) await p.fill('.logon input[type=text]', u); await p.fill('.logon input[type=password]', pw); await p.keyboard.press('Enter'); await p.waitForTimeout(2200); }
(async () => {
  const seeds = process.argv.slice(2).length ? process.argv.slice(2) : ['7', '8', '9', '10', '11', '12', '13', '14'];
  for (const seed of seeds) {
    const t = await T.start({ fault: 'vpn_connect', dev: 'PCEXT', seed });
    const p = t.p; await logon(p, 'tech', 'T3ch#2026'); const cause = await t.ev(() => SIM_APP.run.m.parts[0].cause || '');
    const client = /port 1195|TCP alors|clé TLS/.test(cause);
    console.log('seed', seed, '|', cause.slice(0, 80), '| client-side:', client);
    if (!client) { await t.b.close(); continue; }
    console.log('open', await t.open('openvpn'));
    await p.waitForTimeout(300);
    await p.click('button:has-text("Connecter")'); await p.waitForTimeout(500);
    const log1 = await p.evaluate(() => Array.from(document.querySelectorAll('textarea')).map(x => x.value).join('\n---\n'));
    console.log(log1.split('\n').slice(-4).join('\n'));
    await t.shot('net1a_' + seed);
    // fermer le journal, éditer la configuration
    await p.evaluate(() => { const w = SIM_APP.run.surfaces['PCEXT'].desk.wm.wins; w.filter(x => /Journal/.test(x.title)).forEach(x => x.close(true)); });
    await p.click('button:has-text("Modifier la configuration")'); await p.waitForTimeout(300);
    const txt = await p.evaluate(() => Array.from(document.querySelectorAll('textarea')).pop().value);
    let fixed = txt.replace(/^proto .*/m, 'proto udp').replace(/^remote (\S+) \d+/m, 'remote $1 1194').replace(/^tls-crypt .*/m, 'tls-crypt tlsk-01.key');
    await p.evaluate(v => { const ta = Array.from(document.querySelectorAll('textarea')).pop(); ta.value = v; }, fixed);
    await p.click('.dlg2 button:has-text("Enregistrer")'); await p.waitForTimeout(300);
    await p.click('button:has-text("Connecter")'); await p.waitForTimeout(500);
    const log2 = await p.evaluate(() => Array.from(document.querySelectorAll('textarea')).map(x => x.value).join('\n---\n'));
    console.log(log2.split('\n').slice(-3).join('\n'));
    await t.shot('net1b_' + seed);
    console.log('status', JSON.stringify(await t.ev(() => SIM_APP.run.m.parts.map(x => x.rt && x.rt.status))));
    console.log(t.errs.join('\n') || 'no errors'); await t.b.close();
  }
})();
