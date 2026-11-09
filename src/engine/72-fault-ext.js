/* ============================================================================
   Sondes et étapes supplémentaires du cadre de pannes : sessions Windows, accès aux partages,
   stratégies de groupe appliquées, approbations, localisation du DC, décalage horaire,
   IPsec, OpenVPN, SSH, certificats. Toutes les sondes sont PURES (aucune mutation visible
   par le moteur de notifications) : elles peuvent être évaluées à chaque changement d'état.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, AD = SIM.ad, PF = SIM.pf, WIN = SIM.win;
const P = SIM.probes, S = SIM.steps, F = SIM.fault;
const lc = s => String(s).toLowerCase();

/* ------------------------------------------------------------------ helpers */
/* mot de passe courant d'un compte (domaine du poste ou compte local) */
function pwdOf(W, hostId, sam) {
  const d = W.d(hostId);
  if (d.win.domain) { const A = AD.byDomain(W, d.win.domain); const u = A && AD.userOf(A.win.ad, sam); return u ? u.pwd : undefined; }
  const u = (d.win.localUsers || []).find(x => lc(x.name) === lc(sam)); return u ? u.pwd : undefined;
}
/* évaluation d'une fonction avec la session d'un autre utilisateur, puis restauration */
function asSession(W, hostId, sam, fn) {
  const host = W.d(hostId); const saved = host._rt.session; let tmp = false;
  if (!saved || lc(saved.user) !== lc(sam)) {
    const tok = host.win.domain ? [...AD.token(W, host.win.domain, sam)] : null;
    host._rt.session = { user: sam, at: W.clock.elapsed, token: tok, local: !host.win.domain }; tmp = true;
  }
  try { return fn(); } finally { if (tmp) host._rt.session = saved; }
}

/* ------------------------------------------------------------------ sondes AD */
P.login = (W, p) => {
  const pwd = pwdOf(W, p.host, p.user);
  const r = AD.logon(W, p.host, p.user, pwd, { dry: true });
  if (r.ok && r.cached && !p.allowCached) return { ok: false, why: 'ouverture avec informations en cache uniquement (contrôleur de domaine injoignable)' };
  if (!r.ok && r.code === 'pwdexp') {
    const d = W.d(p.host); const A = d.win.domain ? AD.byDomain(W, d.win.domain) : null; const u = A && AD.userOf(A.win.ad, p.user);
    const pol = A ? AD.passwordPolicy(W, A.win.ad) : {};
    if (u && u.mustChange && !(!u.pwdNeverExpires && pol.maxPwdAgeDays > 0 && AD.pwdAgeDays(W, u) > pol.maxPwdAgeDays)) return { ok: true, why: 'changement de mot de passe demandé à l’ouverture' };
  }
  return { ok: r.ok, why: r.ok ? (r.cached ? 'cache' : 'ouverture de session réussie') : r.code + ' : ' + r.msg };
};
P.share = (W, p) => {
  const r = asSession(W, p.from, p.user, () => AD.shareAccess(W, p.from, p.unc, p.want || 'read'));
  const msg = r.ok ? 'accès accordé' : r.code + (r.layer ? ' (' + r.layer + ')' : '') + (r.detail ? ' ' + r.detail : '');
  return { ok: r.ok, why: msg };
};
P.gpo = (W, p) => {
  const d = W.d(p.host); const gp = d._rt.gp; const sc = p.scope || 'user';
  const st = gp && gp[sc]; if (!st) return { ok: false, why: 'aucune stratégie ' + sc + ' appliquée' };
  if (sc === 'user' && p.user && lc(st.sam) !== lc(p.user)) return { ok: false, why: 'session de ' + st.sam + ' ≠ ' + p.user };
  const s = st.settings[p.setting];
  if (!s) return { ok: false, why: 'paramètre ' + p.setting + ' non appliqué' };
  if (p.expect !== undefined && JSON.stringify(s.value) !== JSON.stringify(p.expect)) return { ok: false, why: p.setting + ' = ' + JSON.stringify(s.value) + ' (GPO ' + s.gpo + ')' };
  return { ok: true, why: p.setting + ' appliqué par ' + s.gpo };
};
P.gpfetch = (W, p) => {
  const d = W.d(p.host); if (!d.win.domain) return { ok: false, why: 'groupe de travail' };
  const dc = AD.locateDC(W, p.host, d.win.domain); if (!dc.ok) return { ok: false, why: 'DC introuvable : ' + dc.err };
  const sv = N.connect(W, p.host, dc.ip, 'tcp', 445);
  const has = (dc.dev.win.shares || []).some(s => s.name === 'SYSVOL');
  if (sv.state !== 'open' || !has || !WIN.svcRunning(dc.dev, 'LanmanServer')) return { ok: false, why: 'SYSVOL inaccessible (' + (sv.state !== 'open' ? sv.state : !has ? 'partage absent' : 'service Serveur arrêté') + ')' };
  return { ok: true, why: 'SYSVOL lisible' };
};
P.trust = (W, p) => {
  const a = AD.byDomain(W, p.a), b = AD.byDomain(W, p.b); if (!a || !b) return { ok: false, why: 'domaine inconnu' };
  const ta = a.win.ad.trusts.find(t => lc(t.target) === lc(p.b)), tb = b.win.ad.trusts.find(t => lc(t.target) === lc(p.a));
  let ok = !!(ta && tb && ta.state === 'ok' && tb.state === 'ok');
  if (ok && p.res && p.usr) { const al = AD.trustAllows(W, p.res, p.usr); if (!al.ok) return { ok: false, why: al.why }; }
  return { ok, why: ok ? 'approbation valide' : 'a→b ' + (ta ? ta.state : 'absente') + ' ; b→a ' + (tb ? tb.state : 'absente') };
};
P.dc = (W, p) => { const d = W.d(p.host); const r = AD.locateDC(W, p.host, p.domain || d.win.domain); return { ok: r.ok, why: r.ok ? 'DC ' + r.host : r.err }; };
P.time = (W, p) => {
  const a = W.nowOf(p.a).getTime(), b = W.nowOf(p.b).getTime(); const diff = Math.abs(a - b) / 60000;
  return { ok: diff <= (p.maxMin || 5), why: 'écart ' + diff.toFixed(1) + ' min' };
};
P.policy = (W, p) => {
  const dev = AD.byDomain(W, p.domain); if (!dev) return { ok: false, why: 'domaine inconnu' };
  const pol = AD.passwordPolicy(W, dev.win.ad); const v = pol[p.key];
  return { ok: JSON.stringify(v) === JSON.stringify(p.eq), why: p.key + ' = ' + v };
};
P.certvalid = (W, p) => {
  const cert = ((W.d(p.dev).win || {}).certs || []).find(c => c.cn === p.cn); if (!cert) return { ok: false, why: 'certificat absent' };
  const now = W.now().getTime(); const ok = Date.parse(cert.notBefore) <= now && Date.parse(cert.notAfter) >= now;
  return { ok, why: ok ? 'valide jusqu’au ' + cert.notAfter.slice(0, 10) : 'expiré le ' + cert.notAfter.slice(0, 10) };
};

/* ------------------------------------------------------------------ IPsec / OpenVPN / SSH */
P.ipsec = (W, p) => {
  const d = W.d(p.dev); const tun = ((d.ipsec && d.ipsec.tunnels) || []).find(t => !p.tunnel || t.id === p.tunnel); if (!tun) return { ok: false, why: 'tunnel absent' };
  const st = PF.ipsecStatus(W, d, tun);
  if (!st.p1.up) return { ok: false, why: 'phase 1 : ' + (st.p1.err || 'down') };
  const bad = st.p2.filter(e => !e.up); if (bad.length) return { ok: false, why: 'phase 2 : ' + bad.map(e => e.local + '↔' + e.remote + ' ' + e.err).join(', ') };
  return { ok: true, why: 'phases 1 et 2 établies' };
};
P.vpn = (W, p) => { const r = PF.ovpnCheck(W, p.client, p.profile); return { ok: r.ok, why: r.ok ? 'tunnel négocié (' + r.ip + ')' : (r.err || 'échec') + ' : ' + (r.log[r.log.length - 1] || '') }; };
/* test d'usage : le tunnel est monté de façon transitoire (sans notification), le test réseau est joué, puis le tunnel est retiré */
function withTunnel(W, clientId, profile, fn) {
  const c = W.d(clientId); const already = c._rt.vpn && c._rt.vpn.up;
  if (already) return fn();
  const out = PF.ovpnCheck(W, clientId, profile); if (!out.ok) return { fail: 'vpn:' + (out.err || 'échec') };
  const t = out.tunnel; const hadTun = c.ifaces.tun0;
  c.ifaces.tun0 = { virtual: true, ip: t.cip, mask: t.tn.mask, name: 'TAP-Windows Adapter V9' };
  c._rt.vpn = { up: true, server: t.server, ip: t.cip, routes: t.routes, since: W.clock.elapsed, srvName: t.srvName };
  try { return fn(); } finally { if (hadTun) c.ifaces.tun0 = hadTun; else delete c.ifaces.tun0; c._rt.vpn = null; }
}
P.vpnuse = (W, p) => {
  const r = withTunnel(W, p.client, p.profile, () => {
    if (p.port) { const c = N.connect(W, p.client, p.to, 'tcp', p.port); return { ok: c.state === 'open', why: c.state + (c.trace && !c.trace.ok ? ' ' + N.describeFail(c.trace) : '') }; }
    const pr = N.ping(W, p.client, p.to); return { ok: pr.ok, why: pr.ok ? 'ok' : N.describeFail(pr.trace) };
  });
  if (r.fail) return { ok: false, why: r.fail };
  return r;
};
P.ssh = (W, p) => {
  const t = U.isIP(p.to) ? { ip: p.to } : N.resolve(W, p.from, p.to, { noCache: true }); if (t.ok === false) return { ok: false, why: 'résolution : ' + t.err };
  /* le compte cible est lu sur l'appareil joint */
  const owner = N.findOwner(W, t.ip || p.to); const devId = owner ? owner.dev.id : null; if (!devId) return { ok: false, why: 'hôte inconnu' };
  const cred = SIM.ssh.credsFor(W, p.from, devId, p.user, p.method || 'any');
  const r = SIM.ssh.attempt(W, p.from, t.ip || p.to, p.user, cred, { dry: true });
  return { ok: r.ok, why: r.ok ? 'session ouverte (' + r.method + ')' : (r.stage + ' : ' + (r.err || r.reason)) };
};
P.ace = (W, p) => {
  const srv = W.d(p.dev); const r = AD.ntfsEffective(srv, p.path, new Set([lc(p.who)]));
  return { ok: (r.rights & (p.min || 1)) === (p.min || 1), why: p.who + ' : droits ' + r.rights };
};
P.psec = (W, p) => {
  const sw = W.d(p.dev); const q = sw.ports[p.port]; if (!q) return { ok: false, why: 'port inconnu' };
  if (q.errdisabled) return { ok: false, why: 'err-disabled' };
  if (SIM.ios.psecViolates(W, sw, p.port)) return { ok: false, why: 'violation port-security' };
  return { ok: true, why: 'port actif' };
};
P.ioscfg = (W, p) => { const v = W.getPath(p.path); return { ok: JSON.stringify(v) === JSON.stringify(p.value), why: JSON.stringify(v) }; };

/* ------------------------------------------------------------------ étapes */
S.session = (W, s) => {
  const host = W.d(s.dev); const user = s.user || host.user; const pwd = s.pwd !== undefined ? s.pwd : pwdOf(W, s.dev, user);
  const r = AD.logon(W, s.dev, user, pwd, { dry: true });
  if (!r.ok) throw new Error('session: ouverture impossible pour ' + user + ' sur ' + s.dev + ' : ' + r.code);
  AD.sessionStart(W, s.dev, user, r);
};
S.relogon = (W, s) => { const host = W.d(s.dev); const user = s.user || (host._rt.session && host._rt.session.user) || host.user; AD.sessionEnd(W, s.dev); S.session(W, { dev: s.dev, user, pwd: s.pwd }); };
S.gpupdate = (W, s) => { const host = W.d(s.dev); const u = s.user || (host._rt.session && host._rt.session.user); AD.applyGP(W, s.dev, u, { logon: false }); W.touch('gpupdate'); };
S['ad.pwd'] = (W, s) => { AD.setPassword(W, s.domain, s.sam, s.pwd, !!s.mustChange); W.touch('adpwd'); };
S['ad.lock'] = (W, s) => { const A = AD.byDomain(W, s.domain).win.ad; const u = AD.userOf(A, s.sam); u.locked = true; u.lockedAt = W.clock.elapsed; W.touch('lock'); };
S['ad.unlock'] = (W, s) => { const A = AD.byDomain(W, s.domain).win.ad; const u = AD.userOf(A, s.sam); u.locked = false; u._bad = 0; W.touch('unlock'); };
S['ad.regdns'] = (W, s) => { AD.registerDcRecords(W, s.dev); W.touch('regdns'); };
S['ad.member.add'] = (W, s) => { const A = AD.byDomain(W, s.domain).win.ad; const g2 = A.groups.find(x => lc(x.name) === lc(s.group)); if (!g2) throw new Error('groupe inconnu ' + s.group); if (g2.members.indexOf(s.member) < 0) g2.members.push(s.member); W.touch('member'); };
S['ad.member.del'] = (W, s) => { const A = AD.byDomain(W, s.domain).win.ad; const g2 = A.groups.find(x => lc(x.name) === lc(s.group)); if (!g2) throw new Error('groupe inconnu ' + s.group); g2.members = g2.members.filter(m => lc(m) !== lc(s.member)); W.touch('member'); };
S['ovpn.connect'] = (W, s) => { PF.ovpnConnect(W, s.dev, s.profile); };
S['ovpn.disconnect'] = (W, s) => { PF.ovpnDisconnect(W, s.dev); };
S.log = (W, s) => { W.log(s.dev, s.chan, { msg: s.msg, id: s.id, level: s.level, source: s.source, unit: s.unit, proc: s.proc }, s.ageSec || 0); };
/* shutdown + no shutdown d'un port de commutateur : l'état err-disabled revient si la cause persiste */
S['ios.recover'] = (W, s) => { const sw = W.d(s.dev); const q = N.portObj(sw, s.port); q.adminDown = false; q.errdisabled = !!SIM.ios.psecViolates(W, sw, s.port); W.touch('recover'); };
S.reboot = (W, s) => {
  const d = W.d(s.dev); d._rt.rebootN = (d._rt.rebootN || 0) + 1;
  if (d.kind === 'win') { AD.sessionEnd(W, s.dev); if (d.win.domain) AD.applyGP(W, s.dev, null, { user: false }); W.touch('reboot'); }
  else if (d.kind === 'linux') { SIM.lx.boot(W, d); W.touch('reboot'); }
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
