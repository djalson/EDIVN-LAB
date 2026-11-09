/* ============================================================================
   SSH : négociation + authentification vers Debian (sshd_config, AllowUsers, clés,
   StrictModes, shell du compte) et vers Cisco IOS (clés RSA, nom de domaine, vty, compte local,
   access-class). Retourne un résultat structuré ; les messages affichés par le client sont
   produits par l'émulateur de terminal à partir de { stage, err }.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, LX = SIM.lx, IOS = SIM.ios;
const SSH = SIM.ssh = {};

/* Algorithmes d'échange de clés proposés par le client OpenSSH moderne (liste de référence, à vérifier selon version) */
SSH.CLIENT_KEX = LX.SSHD_DEFAULT_KEX.slice();
SIM.AVREG['ssh-client-kex'] = 'Liste KexAlgorithms du client OpenSSH : celle de Debian 13 est reprise comme référence ; à vérifier version par version.';
/* Échange de clés supposé pour l'IOS du laboratoire (image récente, SSHv2) — à vérifier selon la version d'IOS */
SSH.IOS_KEX = ['diffie-hellman-group14-sha256', 'ecdh-sha2-nistp256'];
SIM.AVREG['ssh-ios-kex'] = 'KexAlgorithms proposés par l’IOS du laboratoire en SSHv2 : valeur indicative (image récente supposée) à vérifier selon la version d’IOS.';

const lc = s => String(s).toLowerCase();
const keyBody = k => (String(k).trim().split(/\s+/)[1] || '');

/* Authentification côté Debian. Retourne { ok, reason } */
SSH.authLinux = function (W, d, client, user, cred, opts) {
  opts = opts || {};
  const cfg = LX.parseSshd(d);
  const pw = LX.user(d, user);
  const log = (m) => { if (!opts.dry) LX.jlog(W, d, 'ssh.service', 'sshd', m, 6); };
  if (cfg.allowUsers && cfg.allowUsers.map(lc).indexOf(lc(user)) < 0) { log('User ' + user + ' from ' + client.ip + ' not allowed because not listed in AllowUsers'); return { ok: false, reason: 'allowusers' }; }
  if (!pw) { log('Invalid user ' + user + ' from ' + client.ip + ' port 49152'); return { ok: false, reason: 'nouser' }; }
  const methods = [];
  /* clé publique */
  if (cred.key && cfg.pubkeyAuth) {
    const home = pw.home; const akf = home + '/.ssh/authorized_keys';
    const node = d.fs[akf];
    if (node) {
      let safe = true; let badPath = null;
      if (cfg.strict) {
        for (const p of [home, home + '/.ssh', akf]) {
          const n = d.fs[p]; if (!n) continue;
          const dg = LX.modeDigits(n.m);
          if ((n.o !== user && n.o !== 'root') || (dg[1] & 2) || (dg[2] & 2)) { safe = false; badPath = p; break; }
        }
      }
      if (!safe) { log('Authentication refused: bad ownership or modes for ' + (d.fs[badPath].t === 'd' ? 'directory ' : 'file ') + badPath); methods.push('key-strict'); }
      else {
        const acc = LX.access(d, user, akf, 'r');
        const content = LX.readFile(d, akf) || '';
        if (acc.ok && content.split('\n').some(l => keyBody(l) && keyBody(l) === keyBody(cred.key))) {
          if (pw.shell && /nologin|false$/.test(pw.shell)) return { ok: false, reason: 'nologin' };
          log('Accepted publickey for ' + user + ' from ' + client.ip + ' port 49152 ssh2');
          return { ok: true, method: 'publickey' };
        }
        methods.push('key-nomatch');
      }
    } else methods.push('key-nofile');
  }
  /* mot de passe */
  if (cred.pwd !== undefined && cfg.passwordAuth) {
    if (user === 'root' && cfg.permitRoot !== 'yes') { log('ROOT LOGIN REFUSED FROM ' + client.ip); return { ok: false, reason: 'rootdenied' }; }
    const real = (d.pwds || {})[user];
    if (real !== undefined && real === cred.pwd) {
      if (pw.shell && /nologin|false$/.test(pw.shell)) return { ok: false, reason: 'nologin' };
      log('Accepted password for ' + user + ' from ' + client.ip + ' port 49152 ssh2');
      return { ok: true, method: 'password' };
    }
    log('Failed password for ' + user + ' from ' + client.ip + ' port 49152 ssh2');
    return { ok: false, reason: 'badpwd', methods };
  }
  if (!opts.dry) log('Connection closed by authenticating user ' + user + ' ' + client.ip + ' port 49152 [preauth]');
  return { ok: false, reason: 'noauth', methods };
};

/* Tentative complète depuis `fromId` vers `target` (nom ou IP) */
SSH.attempt = function (W, fromId, target, user, cred, opts) {
  opts = opts || {}; cred = cred || {};
  const port = opts.port || 22;
  const r = U.isIP(target) ? { ok: true, ip: target } : N.resolve(W, fromId, target, { noCache: opts.dry !== false });
  if (!r.ok) return { ok: false, stage: 'resolve', err: 'resolve', detail: r.err };
  let c;
  /* cible = la machine elle-même (127.0.0.1 ou une de ses adresses) : le trafic passe par l'interface de bouclage, hors pare-feu */
  const own = r.ip.indexOf('127.') === 0 ? { dev: W.d(fromId) } : N.findOwner(W, r.ip);
  if (own && own.dev && own.dev.id === fromId && W.d(fromId).kind === 'linux') {
    const me = W.d(fromId);
    c = LX.isListening(W, me, 'tcp', port, null, { dip: r.ip.indexOf('127.') === 0 ? '127.0.0.1' : r.ip })
      ? { state: 'open', dstDev: fromId, trace: { sipAtDst: r.ip, dipAtDst: r.ip } } : { state: 'refused', trace: {} };
  } else c = N.connect(W, fromId, r.ip, 'tcp', port);
  if (c.state !== 'open') return { ok: false, stage: 'connect', err: c.state === 'refused' ? 'refused' : (c.state === 'unreach' || c.state === 'noroute' ? 'noroute' : 'timeout'), ip: r.ip, trace: c.trace };
  const dev = W.d(c.dstDev); const sip = c.trace.sipAtDst;
  const out = { ip: r.ip, dev: dev.id, stage: 'kex' };
  if (dev.kind === 'linux') {
    const cfg = LX.parseSshd(dev);
    const offer = cfg.kex ? cfg.kex.split(',').map(x => x.trim()) : SSH.CLIENT_KEX;
    if (!offer.some(k => SSH.CLIENT_KEX.indexOf(k) >= 0)) return Object.assign(out, { ok: false, err: 'kex', offer });
    out.stage = 'auth';
    const a = SSH.authLinux(W, dev, { ip: sip }, user, cred, opts);
    return Object.assign(out, a, { err: a.ok ? null : a.reason });
  }
  if (dev.kind === 'ios-rt' || dev.kind === 'ios-sw') {
    const ready = IOS.sshReady(dev); if (!ready.ok) return Object.assign(out, { ok: false, err: 'refused', stage: 'connect' });
    const kex = (dev.ssh && dev.ssh.kex) || SSH.IOS_KEX;
    if (!kex.some(k => SSH.CLIENT_KEX.indexOf(k) >= 0)) return Object.assign(out, { ok: false, err: 'kex', offer: kex });
    const vty = (dev.lines && dev.lines.vty) || {};
    out.stage = 'auth';
    if (vty.accessClass) { const ev = IOS.aclEval(dev, vty.accessClass, { proto: 'tcp', sport: 49152, dport: 22 }, sip, c.trace.dipAtDst || r.ip); if (ev.action !== 'permit') return Object.assign(out, { ok: false, err: 'closed', reason: 'access-class' }); }
    if (vty.login === 'local') {
      const u = (dev.users || []).find(x => x.name === user);
      if (!u || u.pwd === undefined || cred.pwd !== u.pwd) return Object.assign(out, { ok: false, err: 'denied', reason: 'badpwd' });
    } else if (vty.login === 'none') { /* accès direct sans mot de passe */ }
    else if (vty.password !== undefined && cred.pwd !== vty.password) return Object.assign(out, { ok: false, err: 'denied', reason: 'badpwd' });
    return Object.assign(out, { ok: true, method: 'password', priv: ((dev.users || []).find(x => x.name === user) || {}).priv || 1 });
  }
  if (dev.kind === 'pf') {
    const s = (dev.system && dev.system.ssh) || {};
    if (!s.enabled) return Object.assign(out, { ok: false, err: 'refused', stage: 'connect' });
    const real = (dev.pwds || {})[user];
    if (real === undefined || cred.pwd !== real) return Object.assign(out, { ok: false, err: 'denied', stage: 'auth' });
    return Object.assign(out, { ok: true, method: 'password', stage: 'auth' });
  }
  return Object.assign(out, { ok: false, err: 'refused', stage: 'connect' });
};

/* identifiants du client : clé publique du poste (d.sshPub) + mot de passe du compte cible lu dans le monde */
SSH.credsFor = function (W, fromId, targetDevId, user, method) {
  const t = W.d(targetDevId); const f = W.d(fromId); const cred = {};
  if (method === 'key' || method === 'any') cred.key = f.sshPub;
  if (method === 'password' || method === 'any') {
    if (t.kind === 'linux' || t.kind === 'pf') cred.pwd = (t.pwds || {})[user];
    else cred.pwd = ((t.users || []).find(x => x.name === user) || {}).pwd;
  }
  return cred;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
