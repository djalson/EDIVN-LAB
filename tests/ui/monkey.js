/* Test « singe » : actions aléatoires reproductibles (graine) sur les écrans d'équipements ; échoue sur toute erreur JS.
   Usage : node tests/ui/monkey.js [graine] [nb_sessions] [nb_actions] [largeur] [hauteur] */
const { chromium } = require('playwright');
const seed0 = +(process.argv[2] || 1), N = +(process.argv[3] || 6), K = +(process.argv[4] || 80), W = +(process.argv[5] || 1440), H = +(process.argv[6] || 900);
const rng = (s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; })(seed0 * 7919 + 13);
const pick = a => a[Math.floor(rng() * a.length)];
const CMDS = ['ipconfig /all', 'ping 10.10.10.10', 'help', 'dir', 'ls -la', 'show run', 'show ip route', 'exit', 'net user', 'nslookup srv-fic', 'hostname', 'Get-Service', 'systemctl status ssh', 'cat /etc/hosts', 'ip a', 'enable', 'conf t', 'cls', 'whoami', 'tracert 8.8.8.8', 'netstat -an', 'sudo -l', 'ping -c 2 10.10.10.1', 'show vlan brief', 'show interfaces status', 'ipconfig /renew', 'gpupdate /force', 'w32tm /query /status', 'get-eventlog system -newest 3', 'journalctl -xe', 'ss -tlnp'];
const FAULTS = ['phys_eth', 'dhcp_scope_off', 'dns_svc', 'ad_locked', 'sh_perm_share', 'c_vlan_port', 'pf_nat_outbound', 'lx_ssh_conf', 'vpn_connect', 'web_cert_expired', 'gpo_link', 'c_nat_acl', 'lx_cron', 'dhcp_unauth'];
const DEVS = ['PC-01', 'PC-ADM', 'SRV-DC1', 'SRV-FIC', 'SRV-LNX', 'SW-T1', 'SW-T2', 'pfsense-tls', 'PCEXT', 'R-RV1', 'PC-B1', 'SRV-DC2', 'IMP-T1', 'PATCH-T'];
(async () => {
  const b = await chromium.launch(); let fails = 0;
  for (let s = 0; s < N; s++) {
    const fault = pick(FAULTS), dev = pick(DEVS), lvl = 1 + Math.floor(rng() * 4);
    const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; const log = [];
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @ ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'dist', 'EDIVN-Lab.html')).href + '#legacy'); await p.waitForFunction(() => window.SIM_APP);
    await p.evaluate(o => SIM_APP.begin({ level: o.l, mode: 'free', seed: String(o.s), faultId: o.f }), { l: lvl, s: seed0 * 100 + s, f: fault });
    await p.evaluate(d => SIM_APP.openDev(d, ['PATCH-T'].includes(d) ? 'patch' : 'main'), dev); await p.waitForTimeout(500);
    for (let i = 0; i < K && !errs.length; i++) {
      const r = rng(); let what = '';
      try {
        if (r < 0.12) { const c = pick(CMDS); what = 'type ' + c; await p.keyboard.type(c, { delay: 2 }); await p.keyboard.press('Enter'); await p.waitForTimeout(150); }
        else if (r < 0.2) { const k = pick(['Escape', 'Tab', 'Enter', 'F5', 'ArrowDown', 'ArrowUp', 'Control+c', 'Delete', 'Backspace', 'Meta']); what = 'key ' + k; await p.keyboard.press(k); }
        else {
          const cand = await p.evaluate(() => {
            const root = document.querySelector('.ctx') || document.querySelector('.overlay') || document.querySelector('.frame:not(.hidden)') || document.body; const out = [];
            root.querySelectorAll('*').forEach(el => { const rc = el.getBoundingClientRect(); if (rc.width < 4 || rc.height < 4 || rc.bottom < 0 || rc.right < 0 || rc.top > innerHeight || rc.left > innerWidth) return; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return; if (cs.cursor === 'pointer' || /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName)) out.push([Math.round(rc.left + rc.width / 2), Math.round(rc.top + rc.height / 2), (el.innerText || el.value || el.className || el.tagName).toString().slice(0, 28).replace(/\n/g, ' ')]); });
            return out;
          });
          if (!cand.length) { what = 'noop'; await p.mouse.click(W / 2, H / 2); }
          else { const [x, y, t] = pick(cand); const m = rng(); what = (m < 0.1 ? 'dbl ' : m < 0.25 ? 'right ' : 'click ') + t + ' @' + x + ',' + y; if (m < 0.1) await p.mouse.dblclick(x, y); else if (m < 0.25) await p.mouse.click(x, y, { button: 'right' }); else await p.mouse.click(x, y); if (rng() < 0.25) { const c = pick(['a', 'x1', '10.10.10.10', 'srv-fic', '0', 'Test!2026', '']); what += ' +type ' + c; await p.keyboard.type(c, { delay: 2 }); } }
          await p.waitForTimeout(80);
        }
      } catch (e) { what += ' (action ignorée : ' + e.message.split('\n')[0].slice(0, 60) + ')'; }
      const junk = await p.evaluate(() => { const t = document.body.innerText || ''; const m = t.match(/(^|[\s(«:])(null|undefined|NaN|\[object Object\])([\s).,»]|$)/); return m ? m[2] + ' …' + t.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, ' ') : ''; }).catch(() => '');
      if (junk && !/\$null|Get-|echo/.test(log.slice(-3).join(' '))) errs.push('TEXTE PARASITE ' + junk);
      log.push(what);
    }
    if (errs.length) { fails++; console.log('✗ session ' + s + ' [' + fault + ' / ' + dev + ' / N' + lvl + '] ' + errs[0].slice(0, 300)); console.log('   dernières actions : ' + log.slice(-6).join(' | ')); }
    else console.log('✓ session ' + s + ' [' + fault + ' / ' + dev + ' / N' + lvl + '] ' + log.length + ' actions');
    await p.close();
  }
  await b.close(); process.exit(fails ? 1 : 0);
})();
