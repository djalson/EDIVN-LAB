/* ============================================================================
   Applications d'accès distant du poste Windows : Connexion Bureau à distance (mstsc), OpenVPN GUI, PuTTY.
   - mstsc : port 3389 réellement testé (pare-feu, service TermService, paramètre « Bureau à distance »),
     authentification contre la machine cible, droit de connexion (administrateur ou liste rdp.users),
     puis bureau distant imbriqué (même moteur que le bureau local).
   - OpenVPN GUI : négociation réelle (PF.ovpnConnect), journal client, édition du fichier .ovpn.
   - PuTTY : connexion SSH réelle (mêmes règles que la commande ssh), invites « login as: » / mot de passe.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, AD = SIM.ad, PF = SIM.pf, h = UI.h, W_ = E.win;
SIM.AVREG['mstsc-ui'] = 'Connexion Bureau à distance : libellés de la boîte de connexion, de l’invite « Sécurité Windows » et messages d’échec (« Le Bureau à distance ne peut pas se connecter à l’ordinateur distant pour l’une des raisons suivantes… », « ne trouve pas l’ordinateur », droit de connexion via les services Bureau à distance, informations d’identification refusées) reconstitués de mémoire en français — à vérifier par capture. Simplification : une seule session interactive par machine ; l’ouverture d’une session RDP remplace celle de la console, qui est fermée à la déconnexion.';
SIM.AVREG['openvpn-gui-ui'] = 'OpenVPN GUI : fenêtre de gestion des connexions (la vraie application vit dans la zone de notification), format des horodatages du journal, texte du fichier .ovpn généré à partir du profil — à vérifier par capture.';
SIM.AVREG['putty-ui'] = 'PuTTY : fenêtre de configuration (catégories, champs Host Name / Port / Connection type), boîte « PuTTY Security Alert », messages « Network error: Connection timed out / refused », « Unable to open connection », invites « login as: » — à vérifier par capture. Les clés .ppk / Pageant ne sont pas simulées (authentification par mot de passe).';

const lc = s => String(s || '').toLowerCase();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const stamp = (dt) => DAY[dt.getUTCDay()] + ' ' + MON[dt.getUTCMonth()] + ' ' + String(dt.getUTCDate()).padStart(2, ' ') + ' ' + U.pad2(dt.getUTCHours()) + ':' + U.pad2(dt.getUTCMinutes()) + ':' + U.pad2(dt.getUTCSeconds()) + ' ' + dt.getUTCFullYear();

/* ================================================================== Bureau à distance */
UI.app('mstsc', {
  title: 'Connexion Bureau à distance', icon: 'monitor', single: true,
  open: (desk, arg) => {
    const W = desk.W; let win;
    const host = UI.w.text(typeof arg === 'string' ? arg : '', { w: 280 }); const user = UI.w.text('', { w: 280, placeholder: '' });
    const hint = h('div.muted', 'Aucune information d’identification n’est enregistrée : vous serez invité à les saisir.');
    const fail = (title, text) => desk.msg({ title: title || 'Connexion Bureau à distance', icon: 'error', owner: win, text });
    const connect = () => {
      const name = host.value.trim().replace(/:3389$/, ''); if (!name) return;
      desk.env.advance(1);
      let ip = name;
      if (!U.isIP(name)) {
        const r = N.resolve(W, desk.devId, name, { noCache: true });
        if (!r.ok) { desk.env.obs('resolve:' + desk.devId + ':' + name, false); desk.act('Bureau à distance : ' + name + ' — nom introuvable', { kind: 'ui' }); fail('Connexion Bureau à distance', 'Le Bureau à distance ne trouve pas l’ordinateur « ' + name + ' ». Cela peut signifier que « ' + name + ' » n’appartient pas au réseau spécifié. Vérifiez le nom de l’ordinateur et du domaine auquel vous essayez de vous connecter.'); return; }
        desk.env.obs('resolve:' + desk.devId + ':' + name, true); ip = r.ip;
      }
      const c = N.connect(W, desk.devId, ip, 'tcp', 3389); desk.env.advance(c.state === 'open' ? 1 : 3);
      const okc = c.state === 'open'; desk.env.obs('connect:' + desk.devId + ':' + ip + ':3389', okc);
      desk.act('Bureau à distance : ' + name + ' (' + ip + ':3389) — ' + (okc ? 'port ouvert' : 'échec de connexion'), { kind: 'ui' });
      if (!okc) { fail('Connexion Bureau à distance', 'Le Bureau à distance ne peut pas se connecter à l’ordinateur distant pour l’une des raisons suivantes :\n\n1) L’accès à distance au serveur n’est pas activé\n2) L’ordinateur distant est éteint\n3) L’ordinateur distant n’est pas disponible sur le réseau\n\nVérifiez que l’ordinateur distant est sous tension et connecté au réseau, et que l’accès à distance est activé.'); return; }
      const target = W.d(c.dstDev);
      askCreds(target, name, user.value.trim());
    };
    const askCreds = (target, name, u0, err) => {
      const u = UI.w.text(u0 || '', { w: 260 }), p = UI.w.text('', { w: 260, password: true }); const vf = UI.vault.field({ user: u, pwd: p, kinds: ['win'] }); const msg = h('div', { style: { color: '#b00020', minHeight: '18px', margin: '4px 0' } }, err || '');
      const dlg = UI.dialog(desk, win, { title: 'Sécurité Windows', w: 430, h: 300, body: h('div.pad', h('div', { style: { fontSize: '15px', marginBottom: '6px' } }, 'Entrez vos informations d’identification'), h('div.muted', 'Ces informations d’identification seront utilisées pour vous connecter à ' + name + '.'), h('div', { style: { height: '10px' } }), UI.rows([['Nom d’utilisateur', u], ['Mot de passe', p]], 120), vf.btn, msg),
        buttons: [{ label: 'OK', def: true, fn: () => {
          if (!u.value.trim()) { msg.textContent = 'Entrez un nom d’utilisateur.'; return false; }
          const r = UI.winLogon(W, target, u.value.trim(), p.value, { remote: true });
          desk.env.advance(1);
          if (!r.ok) { desk.env.obs('login:' + desk.devId + ':' + name, false); desk.act('Bureau à distance : échec d’authentification sur ' + name + ' (' + u.value.trim() + ')', { kind: 'ui' }); msg.textContent = 'Vos informations d’identification n’ont pas fonctionné.'; p.value = ''; return false; }
          vf.submit(); setTimeout(() => session(target, name, r), 0);
        } }, { label: 'Annuler' }] });
      setTimeout(() => (u.value ? p : u).focus(), 40); return dlg;
    };
    const session = (target, name, r) => {
      const sam = r.user; const admin = W_.isAdminUser(W, target, sam); const allowed = ((target.win.rdp && target.win.rdp.users) || []).some(x => lc(x) === lc(sam));
      if (!admin && !allowed) { desk.env.obs('login:' + desk.devId + ':' + name, false); desk.act('Bureau à distance : ' + sam + ' n’a pas le droit de se connecter à ' + name, { kind: 'ui' }); fail('Connexion Bureau à distance', 'Pour vous connecter à distance, vous devez avoir le droit d’ouvrir une session via les services Bureau à distance. Par défaut, les membres du groupe Administrateurs disposent de ce droit. Si vous n’appartenez pas au groupe Administrateurs, ou si le groupe Administrateurs n’a pas ce droit, vous devez recevoir ce droit manuellement.'); return; }
      const start = () => {
        const prev = target._rt.session; let created = false;
        if (!prev || prev.user !== sam) { if (prev) AD.sessionEnd(W, target.id); AD.sessionStart(W, target.id, sam, r); created = true; }
        desk.env.obs('login:' + desk.devId + ':' + name, true); desk.env.touch('rdp'); desk.act('Bureau à distance : session ouverte sur ' + name + ' en tant que ' + sam, { kind: 'ui' });
        const nested = new UI.Desktop(desk.run, target.id, { remote: true }); const holder = h('div', { style: { position: 'relative', width: '100%', height: '100%', background: '#000' } }, nested.el);
        let rw; rw = desk.wm.open({ title: name + ' - Connexion Bureau à distance', icon: 'monitor', w: 1060, h: 680, className: 'rdpwin', body: () => holder, onClose: () => { nested.destroy(); if (created) { AD.sessionEnd(W, target.id); desk.env.touch('rdp-end'); } desk.act('Bureau à distance : déconnexion de ' + name, { kind: 'ui' }); } });
        setTimeout(() => { if (rw && !rw.closed && !rw.maxed) rw.toggleMax(); }, 30); if (win && !win.closed) win.close(true);
      };
      const prev = target._rt.session;
      if (prev && prev.user !== sam) {
        UI.confirm(desk, win, { title: 'Connexion Bureau à distance', icon: 'warning', text: 'Un autre utilisateur (' + prev.user + ') est connecté sur ' + name + '.\nSi vous continuez, sa session sera fermée et ses données non enregistrées seront perdues.\n\nVoulez-vous continuer ?', yes: 'Oui', no: 'Non', onYes: start });
      } else start();
    };
    win = desk.wm.open({ title: 'Connexion Bureau à distance', icon: 'monitor', w: 460, h: 270, resizable: false, maximizable: false, className: 'mstscw', body: () => h('div.pad',
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' } }, UI.icon('monitor', 44), h('div', { style: { fontSize: '17px' } }, 'Connexion Bureau à distance')),
      UI.rows([['Ordinateur :', host], ['Nom d’utilisateur :', user]], 130), h('div', { style: { height: '8px' } }), hint,
      h('div.mbbtns', { style: { marginTop: '18px' } }, UI.w.btn('Connexion', connect, { def: true }), UI.w.btn('Aide', () => desk.msg({ title: 'Connexion Bureau à distance', icon: 'info', owner: win, text: 'Saisissez le nom ou l’adresse IP de l’ordinateur distant, puis cliquez sur Connexion.' })))) });
    host.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); }); setTimeout(() => host.focus(), 40);
    return win;
  }
});

/* ================================================================== OpenVPN GUI */
const ovpnText = (p) => ['client', 'dev tun', 'proto ' + (p.proto || 'udp'), 'remote ' + p.server + ' ' + p.port, 'resolv-retry infinite', 'nobind', 'persist-key', 'persist-tun', 'remote-cert-tls server', 'ca ' + p.ca + '.crt', 'cert ' + p.cert + '.crt', 'key ' + p.cert + '.key', 'tls-crypt ' + p.tlsKey + '.key', 'verb 3', ''].join('\n');
function parseOvpn(text, prof) {
  const out = Object.assign({}, prof); const errs = []; const seen = {};
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/[#;].*$/, '').trim(); if (!line) return; const t = line.split(/\s+/); const k = t[0].toLowerCase();
    if (k === 'proto') { if (!/^(udp|tcp|udp4|tcp4|tcp-client)$/.test(t[1] || '')) errs.push('Ligne ' + (i + 1) + ' : protocole « ' + (t[1] || '') + ' » inconnu.'); else out.proto = t[1].replace(/4$/, '').replace('-client', ''); seen.proto = 1; }
    else if (k === 'remote') { if (!t[1] || !/^\d+$/.test(t[2] || '1194')) errs.push('Ligne ' + (i + 1) + ' : directive « remote » invalide.'); else { out.server = t[1]; out.port = t[2] ? +t[2] : 1194; } seen.remote = 1; }
    else if (k === 'ca') { out.ca = (t[1] || '').replace(/\.(crt|pem)$/i, ''); }
    else if (k === 'cert') { out.cert = (t[1] || '').replace(/\.(crt|pem)$/i, ''); }
    else if (k === 'tls-crypt' || k === 'tls-auth') { out.tlsKey = (t[1] || '').replace(/\.key$/i, ''); }
  });
  if (!seen.remote) errs.push('La directive « remote » est absente.');
  return { prof: out, errs };
}
UI.app('openvpn', {
  title: 'OpenVPN GUI', icon: 'vpn', single: true,
  open: (desk) => {
    const W = desk.W, d = desk.d; if (!d.vpn || !(d.vpn.profiles || []).length) { desk.msg({ title: 'OpenVPN GUI', icon: 'info', text: 'Aucun profil de connexion n’est installé sur cet ordinateur.' }); return null; }
    desk._ovpn = desk._ovpn || { logs: {}, sel: 0 }; const S = desk._ovpn; let win; const box = h('div');
    const state = (p) => { const v = d._rt.vpn; return v && v.up && v.profile === p.name ? 'Connecté' : (v && v.up ? 'Connecté (autre profil)' : 'Déconnecté'); };
    const log = (p, lines, hdr) => { const L = S.logs[p.name] = S.logs[p.name] || []; const t = W.nowOf(desk.devId); (hdr ? [hdr] : []).concat(lines).forEach(x => L.push(stamp(t) + ' ' + x)); };
    const draw = () => {
      UI.clear(box); const profs = d.vpn.profiles; const cur = profs[Math.min(S.sel, profs.length - 1)];
      const lv = UI.w.listView({ columns: [{ key: 'name', label: 'Profil', w: 220 }, { key: 'srv', label: 'Serveur', w: 220 }, { key: 'st', label: 'État', w: 140 }], rows: profs.map((p, i) => ({ id: i, name: p.name, srv: p.server + ':' + p.port + ' (' + p.proto + ')', st: state(p) })), onSelect: rows => { if (rows[0]) { S.sel = rows[0].id; } }, key: r => r.id });
      const on = state(cur) === 'Connecté';
      const btns = h('div.mbbtns', { style: { justifyContent: 'flex-start', gap: '6px', margin: '10px 0' } },
        UI.w.btn('Connecter', () => connect(cur), { disabled: on }), UI.w.btn('Déconnecter', () => { PF.ovpnDisconnect(W, desk.devId); d._rt.vpn = null; log(cur, ['SIGTERM[hard,] received, process exiting']); desk.env.advance(2); desk.env.touch('vpn'); desk.act('OpenVPN GUI : déconnexion du profil ' + cur.name, { kind: 'ui' }); draw(); }, { disabled: !on }),
        UI.w.btn('Afficher le journal', () => showLog(cur)), UI.w.btn('Modifier la configuration', () => edit(cur)));
      box.append(h('div', { style: { height: '220px', border: '1px solid #aaa' } }, lv.el || lv), btns, h('div.muted', on ? 'Connecté : adresse du tunnel ' + d._rt.vpn.ip : 'Aucune connexion active.'));
    };
    const connect = (p) => {
      const prev = d._rt.vpn && d._rt.vpn.up ? 1 : 0; if (prev) PF.ovpnDisconnect(W, desk.devId);
      desk.env.advance(4); const out = PF.ovpnConnect(W, desk.devId, p.name); if (out.ok) { d._rt.vpn.profile = p.name; }
      log(p, out.log, '--- Connexion du profil ' + p.name + ' ---'); desk.env.advance(out.ok ? 2 : 8);
      desk.env.obs('vpn:' + desk.devId + ':' + p.name, !!out.ok, { err: out.err });
      desk.act('OpenVPN GUI : ' + (out.ok ? 'connecté (' + out.ip + ')' : 'échec de connexion (' + (out.err || 'erreur') + ')') + ' — profil ' + p.name, { kind: 'ui' });
      draw(); showLog(p);
    };
    const showLog = (p) => {
      const ta = h('textarea', { readOnly: true, spellcheck: false, wrap: 'off', style: { width: '100%', height: '100%', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px', border: 'none', resize: 'none', background: '#fff' } }); ta.value = (S.logs[p.name] || ['(journal vide)']).join('\n');
      const lw = desk.wm.open({ title: p.name + ' - Journal OpenVPN', icon: 'vpn', w: 760, h: 380, owner: win, body: () => ta }); setTimeout(() => { ta.scrollTop = ta.scrollHeight; }, 30); return lw;
    };
    const edit = (p) => {
      const ta = h('textarea', { spellcheck: false, wrap: 'off', style: { width: '100%', height: '100%', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12.5px', border: 'none', resize: 'none' } }); ta.value = ovpnText(p);
      const w = UI.dialog(desk, win, { title: p.name + '.ovpn - Bloc-notes', w: 640, h: 440, resizable: true, body: ta, buttons: [{ label: 'Enregistrer', def: true, fn: () => {
        const r = parseOvpn(ta.value, p); if (r.errs.length) { desk.msg({ title: 'OpenVPN GUI', icon: 'error', owner: w, text: r.errs.join('\n') }); return false; }
        Object.assign(p, r.prof); desk.env.advance(1); desk.change('OpenVPN GUI : modification du fichier de configuration ' + p.name + '.ovpn', { dev: desk.devId }); draw();
      } }, { label: 'Annuler' }] }); return w;
    };
    win = desk.wm.open({ title: 'OpenVPN GUI', icon: 'vpn', w: 640, h: 380, resizable: false, maximizable: false, body: () => h('div.pad', box) }); draw();
    return win;
  }
});

/* ================================================================== PuTTY */
UI.app('putty', {
  title: 'PuTTY', icon: 'terminal',
  open: (desk) => {
    const W = desk.W; let win;
    const host = UI.w.text('', { w: 260 }), port = UI.w.text('22', { w: 60 });
    const cats = ['Session', 'Logging', 'Terminal', 'Window', 'Connection', 'SSH', 'Serial'];
    const fatal = (text) => desk.msg({ title: 'PuTTY Fatal Error', icon: 'error', owner: win, text });
    const open = () => {
      const name = host.value.trim(); const pt = +port.value || 22; if (!name) { desk.msg({ title: 'PuTTY', icon: 'warning', owner: win, text: 'You haven\'t specified a host name.' }); return; }
      desk.env.advance(1);
      const probe = SIM.ssh.attempt(W, desk.devId, name, 'x', {}, { port: pt, dry: true });
      const okish = probe.ok || probe.stage === 'auth';
      if (!okish) {
        desk.env.obs('ssh:' + desk.devId + ':' + (probe.ip || name), false); desk.env.advance(probe.err === 'timeout' ? 21 : 1);
        desk.act('PuTTY : ' + name + ':' + pt + ' — ' + (probe.err || 'échec'), { kind: 'ui' });
        fatal(probe.err === 'resolve' ? 'Unable to open connection to\n' + name + '\nHost does not exist' : probe.err === 'refused' ? 'Network error: Connection refused' : probe.err === 'noroute' ? 'Network error: No route to host' : probe.err === 'kex' ? 'Unable to negotiate with ' + (probe.ip || name) + ' port ' + pt + ': no matching key exchange method found.' : 'Network error: Connection timed out'); return;
      }
      const dev = W.d(probe.dev); const known = (desk.d._rt.puttyHosts = desk.d._rt.puttyHosts || {}); const kt = E.sshKeyType(dev); const fpr = E.sshFp(dev.id, kt);
      const go = () => terminal(dev, name, pt, probe);
      if (known[probe.ip] === fpr) { go(); return; }
      const fp = (kt === 'ED25519' ? 'ssh-ed25519 255 ' : 'ssh-rsa 2048 ') + fpr;
      UI.dialog(desk, win, { title: 'PuTTY Security Alert', icon: 'warning', w: 520, h: 280, body: h('div.pad', h('div', 'The host key is not cached for this server:'), h('div', { style: { margin: '4px 0 8px', fontWeight: 600 } }, name + ' (port ' + pt + ')'), h('div', 'You have no guarantee that the server is the computer you think it is.'), h('div', { style: { margin: '8px 0 4px' } }, 'The server\'s ' + (kt === 'ED25519' ? 'ssh-ed25519' : 'ssh-rsa') + ' key fingerprint is:'), h('div', { style: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px' } }, fp)),
        buttons: [{ label: 'Accept', def: true, fn: () => { known[probe.ip] = fpr; go(); } }, { label: 'Connect Once', fn: () => { go(); } }, { label: 'Cancel' }] });
    };
    const terminal = (dev, name, pt, probe) => {
      const sess = new E.Session(desk.env, desk.devId, { user: null }); sess.kind = 'putty'; let tries = 0;
      const askUser = () => ({ prompt: 'login as: ', echo: true, cb: line => { const user = line.trim(); return { out: [], ask: askPwd(user) }; } });
      const askPwd = (user) => ({ prompt: user + '@' + name + '\'s password: ', echo: false, cb: line => {
        tries++; const att = SIM.ssh.attempt(W, desk.devId, probe.ip, user, { pwd: line }, { port: pt, dry: false });
        if (att.ok || probe.ok) { const cip = E.sshClientIpTo(sess, probe.ip); const r = E.sshOpenRemote(sess, dev, user, name, cip, probe, null, 'win'); if (r.push) { desk.act('PuTTY : session SSH ouverte sur ' + name + ' (' + user + ')', { kind: 'ui' }); } return r; }
        if (tries >= 3) { desk.act('PuTTY : échec d’authentification sur ' + name + ' (' + user + ')', { kind: 'ui' }); return { out: [{ t: 'Access denied', k: 'e', d: 0 }, { t: 'Disconnected: No more authentication methods available', k: 'e', d: 0 }], exit: true }; }
        return { out: [{ t: 'Access denied', k: 'e', d: 0 }], ask: askUser() };
      } });
      sess.ask = askUser(); sess.run = () => ({ out: [], exit: true }); sess.banner = () => [];
      let tw; const term = new UI.Terminal({ theme: dev.kind === 'linux' || dev.kind === 'pf' ? 'bash' : 'ios', session: sess, cols: 110, lineH: 17, onExit: () => tw && tw.close(true), onPop: (s) => { if (s === sess && tw) tw.close(true); } });
      tw = desk.wm.open({ title: name + ' - PuTTY', icon: 'terminal', w: 760, h: 440, className: 'termwin', minW: 300, body: () => term.el, onClose: () => term.destroy() }); tw.onFocus = () => term.focus(); setTimeout(() => term.focus(), 40);
      if (win && !win.closed) win.close(true); return tw;
    };
    const left = h('div', { style: { width: '150px', borderRight: '1px solid #bbb', padding: '6px 4px', background: '#fff' } }, h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, 'Category:'), cats.map((c, i) => h('div', { style: { padding: '2px 6px', background: i === 0 ? '#0078d7' : 'transparent', color: i === 0 ? '#fff' : '#111' } }, c)));
    const right = h('div.pad', { style: { flex: 1 } }, h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Basic options for your PuTTY session'), h('div', { style: { marginBottom: '8px' } }, 'Specify the destination you want to connect to'),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end' } }, h('div', h('div', 'Host Name (or IP address)'), host), h('div', h('div', 'Port'), port)),
      h('div', { style: { margin: '10px 0 4px' } }, 'Connection type:'), h('div', { style: { display: 'flex', gap: '12px' } }, ['Raw', 'Telnet', 'Rlogin'].map(x => h('label.chk', h('input', { type: 'radio', name: 'pt', disabled: true }), x)), h('label.chk', h('input', { type: 'radio', name: 'pt', checked: true }), 'SSH'), h('label.chk', h('input', { type: 'radio', name: 'pt', disabled: true }), 'Serial')));
    win = desk.wm.open({ title: 'PuTTY Configuration', icon: 'terminal', w: 560, h: 420, resizable: false, maximizable: false, body: () => h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }, h('div', { style: { display: 'flex', flex: 1 } }, left, right), h('div.mbbtns', { style: { padding: '8px 12px' } }, UI.w.btn('About', () => desk.msg({ title: 'About PuTTY', icon: 'info', owner: win, text: 'Client SSH simulé : reproduction fonctionnelle, sans le logo ni le code de l’application d’origine.' })), UI.w.btn('Open', open, { def: true }), UI.w.btn('Cancel', () => win.close()))) });
    host.addEventListener('keydown', e => { if (e.key === 'Enter') open(); }); setTimeout(() => host.focus(), 40);
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
