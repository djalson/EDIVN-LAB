/* ============================================================================
   Active Directory : comptes, groupes (AGDLP, jetons), ouverture de session, stratégies de
   groupe (LSDOU, blocage, « Appliqué », filtrage MS16-072), partages + NTFS (droit effectif).
   Tout symptôme découle de ces états ; rien n'est scripté dans les pannes.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds, WIN = SIM.win;
const AD = SIM.ad = {};

/* ------------------------------------------------------------------ annuaire */
AD.domains = W => Object.keys(W.dev).map(k => W.dev[k]).filter(d => d.win && d.win.ad);
AD.byDomain = (W, name) => AD.domains(W).find(d => d.win.ad.domain.toLowerCase() === String(name || '').toLowerCase()) || null;
AD.dcDev = (W, domain) => { const d = AD.byDomain(W, domain); return d || null; };
const nb = (A) => A.netbios.toUpperCase();
const lc = s => String(s).toLowerCase();
/* identifiant qualifié d'un principal : NETBIOS\nom (minuscule) */
AD.pid = (A, name) => name.indexOf('\\') >= 0 ? lc(name.split('\\')[0]) + '\\' + lc(name.split('\\')[1]) : lc(nb(A)) + '\\' + lc(name);

/* Index des groupes de toute la forêt de démonstration : id de groupe → ids de membres */
function groupIndex(W) {
  const idx = [];
  for (const dev of AD.domains(W)) { const A = dev.win.ad; for (const grp of A.groups) idx.push({ id: lc(nb(A)) + '\\' + lc(grp.name), members: (grp.members || []).map(m => AD.pid(A, m)) }); }
  return idx;
}
/* Jeton d'un utilisateur ou d'un ordinateur : ensemble d'identifiants en minuscules */
AD.token = function (W, domain, name, opts) {
  opts = opts || {};
  const dev = AD.byDomain(W, domain); if (!dev) return new Set();
  const A = dev.win.ad; const self = AD.pid(A, name);
  const tok = new Set([lc(self), 'tout le monde', 'utilisateurs authentifiés']);
  if (opts.computer) { tok.add(lc(nb(A) + '\\ordinateurs du domaine')); } else { tok.add(lc(nb(A) + '\\utilisateurs du domaine')); tok.add('builtin\\utilisateurs'); }
  const idx = groupIndex(W);
  let grew = true;
  while (grew) { grew = false; for (const gr of idx) { if (tok.has(gr.id)) continue; if (gr.members.some(m => tok.has(lc(m)))) { tok.add(gr.id); grew = true; } } }
  if (tok.has(lc(nb(A) + '\\admins du domaine')) && !opts.computer) tok.add('builtin\\administrateurs');
  return tok;
};
AD.userOf = (A, sam) => A.users.find(u => lc(u.sam) === lc(sam)) || null;
AD.compOf = (A, name) => A.computers.find(c => lc(c.name) === lc(name)) || null;
AD.passwordPolicy = function (W, A) {
  const pol = Object.assign({}, A.policy);
  const root = 'DC=' + A.domain.split('.').join(',DC=');
  /* seuls les paramètres de compte portés par une GPO liée à la RACINE du domaine pilotent les comptes du domaine */
  for (const gpo of A.gpos) { if (!gpo.enabled || !gpo.compEnabled) continue; if (!gpo.links.some(l => l.enabled && l.target.toLowerCase() === root.toLowerCase())) continue; for (const s of gpo.settings || []) if (s.id.indexOf('acct.') === 0) pol[s.id.slice(5)] = s.value; }
  return pol;
};
AD.pwdAgeDays = (W, u) => (u.pwdSetDays || 0) + W.clock.elapsed / 86400;
AD._dry = false;
AD.evSec = (W, devId, id, level, msg) => AD._dry ? null : W.log(devId, 'evt:Sécurité', { id, level, source: 'Microsoft-Windows-Security-Auditing', msg });

/* ------------------------------------------------------------------ localisation du contrôleur de domaine */
function srvTargets(W, hostId, name) {
  const out = []; let timeouts = 0;
  for (const sv of N.dnsServersOf(W, W.d(hostId))) {
    const r = N.dnsQuery(W, hostId, sv, name, 'SRV');
    if (r.state === 'ok' && r.rcode === 'NOERROR' && r.answers && r.answers.length) { r.answers.forEach(a => { const f = a.data.split(/\s+/); out.push({ port: +f[2], host: f[3].replace(/\.$/, '') }); }); return { ok: true, targets: out }; }
    if (r.state === 'ok') return { ok: false, err: r.rcode === 'NXDOMAIN' ? 'nxdomain' : r.rcode.toLowerCase() };
    timeouts++;
  }
  return { ok: false, err: timeouts ? 'timeout' : 'noserver' };
}
/* Retourne {ok, dev, ip} ou {ok:false, err} — SRV _ldap._tcp.dc._msdcs.<domaine> puis A du contrôleur, puis LDAP/Kerberos joignables */
AD.locateDC = function (W, hostId, domain) {
  const s = srvTargets(W, hostId, '_ldap._tcp.dc._msdcs.' + domain);
  if (!s.ok) return { ok: false, err: 'srv-' + s.err };
  for (const t of s.targets) {
    const a = N.resolve(W, hostId, t.host, { noCache: true }); if (!a.ok) continue;
    const l = N.connect(W, hostId, a.ip, 'tcp', 389); if (l.state !== 'open') continue;
    const k = N.connect(W, hostId, a.ip, 'tcp', 88); if (k.state !== 'open') return { ok: false, err: 'kerberos', ip: a.ip, dev: l.dstDev };
    return { ok: true, dev: W.d(l.dstDev), ip: a.ip, host: t.host };
  }
  return { ok: false, err: 'unreachable' };
};

/* ------------------------------------------------------------------ ouverture de session */
const MSG = {
  badpwd: U.av('logon-badpwd', 'Le nom d’utilisateur ou le mot de passe est incorrect.'),
  disabled: U.av('logon-disabled', 'Votre compte a été désactivé. Contactez votre administrateur système.'),
  locked: U.av('logon-locked', 'Le compte référencé est actuellement verrouillé et ne peut pas être utilisé pour ouvrir une session.'),
  acctexp: U.av('logon-acctexp', 'Votre compte a expiré. Contactez votre administrateur système.'),
  pwdexp: U.av('logon-pwdexp', 'Votre mot de passe a expiré et doit être modifié.'),
  hours: U.av('logon-hours', 'Votre compte a des restrictions d’horaire qui vous empêchent de vous connecter pour le moment. Réessayez plus tard.'),
  nologon: U.av('logon-nologon', 'Il n’y a actuellement aucun serveur d’ouverture de session disponible pour traiter la demande d’ouverture de session.'),
  secure: U.av('logon-secure', 'La relation d’approbation entre cette station de travail et le domaine principal a échoué.'),
  workstation: U.av('logon-workstation', 'Votre compte est configuré de façon à vous empêcher d’utiliser cet ordinateur. Essayez un autre ordinateur.'),
  time: U.av('logon-time', 'Le décalage horaire entre le client et le serveur est trop important.')
};
AD.MSG = MSG;
/* opts.dry : simulation sans journal ni compteur (sondes d'évaluation) */
AD.logon = function (W, hostId, sam, pwd, opts) {
  const prev = AD._dry; AD._dry = !!(opts && opts.dry);
  try { return AD._logon(W, hostId, sam, pwd, opts); } finally { AD._dry = prev; }
};
AD._logon = function (W, hostId, sam, pwd, opts) {
  opts = opts || {}; const host = W.d(hostId); const w = host.win;
  if (!w.domain) {                                                       // compte local (groupe de travail)
    const u = (w.localUsers || []).find(x => lc(x.name) === lc(sam));
    if (!u || (u.pwd !== undefined && u.pwd !== pwd) || !u.enabled) return { ok: false, code: 'badpwd', msg: MSG.badpwd };
    return { ok: true, code: 'local', user: u.name, local: true };
  }
  const dom = w.domain; const dc = AD.locateDC(W, hostId, dom);
  if (!dc.ok) {
    if ((w.cachedLogons || []).some(x => lc(x) === lc(sam))) return { ok: true, code: 'cached', user: sam, cached: true, note: 'Ouverture avec les informations d’identification en cache : ressources réseau indisponibles.' };
    return { ok: false, code: 'nologon', msg: MSG.nologon, why: dc.err };
  }
  const dcdev = dc.dev; const A = dcdev.win.ad; const pol = AD.passwordPolicy(W, A);
  const dcId = dcdev.id; const kerbOk = WIN.svcRunning(dcdev, 'Kdc') && WIN.svcRunning(dcdev, 'Netlogon') && WIN.svcRunning(dcdev, 'NTDS');
  if (!kerbOk) return { ok: false, code: 'nologon', msg: MSG.nologon, why: 'services-dc' };
  /* canal sécurisé de l'ordinateur */
  const comp = AD.compOf(A, host.name);
  if (!comp || comp.enabled === false || w.secureChannel === false) return { ok: false, code: 'secure', msg: MSG.secure };
  /* décalage horaire Kerberos */
  const skew = Math.abs(W.nowOf(hostId).getTime() - W.nowOf(dcId).getTime());
  if (skew > (pol.kerberosSkewMin || 5) * 60000) {
    AD.evSec(W, dcId, 4771, 'Audit des échecs', 'Échec de la pré-authentification Kerberos.\n\nCompte : ' + sam + '\nCode d’échec : 0x25');
    return { ok: false, code: 'time', msg: MSG.time };
  }
  /* utilisateur (domaine de la machine ou domaine approuvé non géré ici) */
  const u = AD.userOf(A, sam);
  const fail = (code, status, text) => { AD.evSec(W, dcId, 4625, 'Audit des échecs', 'Échec d’ouverture de session d’un compte.\n\nCompte : ' + sam + '\nStation de travail : ' + host.name + '\nÉtat : 0xC000006D\nSous-état : ' + status + (text ? '\n' + text : '')); return { ok: false, code, msg: MSG[code] }; };
  if (!u) return fail('badpwd', '0xC0000064');
  if (u.locked && u.lockedAt != null && pol.lockoutDurationMin > 0 && (W.clock.elapsed - u.lockedAt) >= pol.lockoutDurationMin * 60) { u.locked = false; u._bad = 0; }
  if (u.locked) return fail('locked', '0xC0000234');
  if (u.enabled === false) return fail('disabled', '0xC0000072');
  if (u.pwd !== pwd) {
    if (!AD._dry) u._bad = (u._bad || 0) + 1;
    AD.evSec(W, dcId, 4771, 'Audit des échecs', 'Échec de la pré-authentification Kerberos.\n\nCompte : ' + sam + '\nCode d’échec : 0x18');
    const f = fail('badpwd', '0xC000006A');
    if (!AD._dry && pol.lockoutThreshold > 0 && u._bad >= pol.lockoutThreshold) { u.locked = true; u.lockedAt = W.clock.elapsed; W.touch('lockout'); AD.evSec(W, dcId, 4740, 'Succès de l’audit', 'Un compte d’utilisateur a été verrouillé.\n\nCompte verrouillé : ' + sam + '\nNom de l’ordinateur appelant : ' + host.name); }
    return f;
  }
  if (u.expires && Date.parse(u.expires) < W.nowOf(dcId).getTime()) return fail('acctexp', '0xC0000193');
  if (u.logonHours && !AD.hoursOk(u, W.nowOf(dcId))) return fail('hours', '0xC000006F');
  if (u.allowedWorkstations && u.allowedWorkstations.length && u.allowedWorkstations.map(lc).indexOf(lc(host.name)) < 0) return fail('workstation', '0xC0000070');
  const expired = !u.pwdNeverExpires && pol.maxPwdAgeDays > 0 && AD.pwdAgeDays(W, u) > pol.maxPwdAgeDays;
  if (u.mustChange || expired) return fail('pwdexp', '0xC0000071');
  u._bad = 0;
  AD.evSec(W, dcId, 4624, 'Succès de l’audit', 'Un compte a été correctement ouvert.\n\nCompte : ' + sam + '\nOrdinateur : ' + host.name);
  return { ok: true, code: 'ok', user: u.sam, dc: dcId, token: AD.token(W, dom, u.sam) };
};
AD.hoursOk = (u, date) => { const lh = u.logonHours; if (!lh) return true; const day = date.getUTCDay(); const h = date.getUTCHours(); return !(lh.deny || []).some(r => r.day === day && h >= r.from && h < r.to) && (!lh.allow || lh.allow.some(r => r.day === day && h >= r.from && h < r.to)); };
AD.tick = function (W) {
  for (const dev of AD.domains(W)) { const A = dev.win.ad; const pol = AD.passwordPolicy(W, A); for (const u of A.users) if (u.locked && u.lockedAt != null && pol.lockoutDurationMin > 0 && (W.clock.elapsed - u.lockedAt) >= pol.lockoutDurationMin * 60) { u.locked = false; u._bad = 0; } }
};
AD.setPassword = function (W, domain, sam, newPwd, mustChange) { const A = AD.byDomain(W, domain).win.ad; const u = AD.userOf(A, sam); u.pwd = newPwd; u.pwdSetDays = -W.clock.elapsed / 86400; u.mustChange = !!mustChange; u._bad = 0; W.touch('pwd'); };

/* ------------------------------------------------------------------ stratégies de groupe */
function containerChain(dn) {
  /* 'OU=Compta,OU=Utilisateurs,DC=toulouse,DC=local' → ['DC=toulouse,DC=local','OU=Utilisateurs,DC=…','OU=Compta,OU=Utilisateurs,DC=…'] */
  const parts = dn.split(','); const dcs = parts.filter(p => /^DC=/i.test(p)); const ous = parts.filter(p => /^OU=/i.test(p)).reverse();
  const chain = [dcs.join(',')]; let acc = dcs.join(',');
  for (const ou of ous) { acc = ou + ',' + acc; chain.push(acc); }
  return chain;
}
AD.containerChain = containerChain;
AD.collectGposFor = (A, dn) => collectGpos(A, containerChain(dn));
function collectGpos(A, chain) {
  const normal = []; const enforced = [];
  chain.forEach((dn, depth) => {
    const ou = (A.ous || []).find(o => o.dn.toLowerCase() === dn.toLowerCase());
    if (depth > 0 && ou && ou.block) { for (let i = normal.length - 1; i >= 0; i--) normal.splice(i, 1); }
    const here = [];
    for (const gpo of A.gpos) for (const l of gpo.links || []) if (l.target.toLowerCase() === dn.toLowerCase()) here.push({ gpo, link: l, depth });
    here.sort((a, b) => b.link.order - a.link.order);                    // ordre de liaison 1 appliqué en dernier
    for (const e of here) { if (e.link.enforced) enforced.push(e); normal.push(e); }
  });
  /* « Appliqué » : survit au blocage, et le niveau le plus haut l'emporte (appliqué en dernier) */
  const keepEnf = enforced.slice().sort((a, b) => b.depth - a.depth);
  const base = normal.filter(e => !e.link.enforced);
  const out = [];
  const seen = new Set();
  for (const e of base.concat(keepEnf)) { const k = e.gpo.id + '|' + e.link.target; if (seen.has(k)) { const i = out.findIndex(x => x.gpo.id + '|' + x.link.target === k); out.splice(i, 1); } seen.add(k); out.push(e); }
  return out;
}
function inTok(tok, name, A) { const n = lc(name); return tok.has(n) || (n.indexOf('\\') < 0 && tok.has(lc(nb(A)) + '\\' + n)); }
AD.rsop = function (W, hostId, sam) {
  const host = W.d(hostId); const dom = host.win.domain; const dev = AD.byDomain(W, dom); if (!dev) return null;
  const A = dev.win.ad; const comp = AD.compOf(A, host.name);
  const res = { computer: { gpos: [], settings: {} }, user: { gpos: [], settings: {} }, domain: dom };
  const compTok = AD.token(W, dom, host.name + '$', { computer: true });
  const part = (kind, tok, container, ownerA) => {
    const chain = containerChain(container); const list = collectGpos(ownerA, chain);
    for (const e of list) {
      const gpo = e.gpo; const info = { id: gpo.id, name: gpo.name, link: e.link.target, enforced: !!e.link.enforced, applied: false, reason: '' };
      if (!gpo.enabled) info.reason = 'désactivée';
      else if (!e.link.enabled) info.reason = 'lien désactivé';
      else if (kind === 'computer' && !gpo.compEnabled) info.reason = 'configuration ordinateur désactivée';
      else if (kind === 'user' && !gpo.userEnabled) info.reason = 'configuration utilisateur désactivée';
      else if (!(gpo.secFilter || []).some(x => inTok(tok, x, ownerA))) info.reason = 'refusée (filtrage de sécurité)';
      else if (!(gpo.readers || []).some(x => inTok(tok, x, ownerA))) info.reason = 'refusée (droit de lecture)';
      else if (kind === 'user' && !(gpo.readers || []).some(x => inTok(compTok, x, ownerA))) info.reason = 'refusée (l’ordinateur n’a pas le droit de lecture — MS16-072)';
      else {
        info.applied = true;
        for (const s of gpo.settings || []) {
          if (s.scope !== kind) continue;
          if (s.itl && !inTok(tok, s.itl, ownerA)) continue;
          res[kind].settings[s.id] = { value: s.value, gpo: gpo.name, label: s.label, needsLogon: /^(drive\.|wallpaper)/.test(s.id) };
        }
      }
      res[kind].gpos.push(info);
    }
  };
  if (comp) part('computer', compTok, comp.ou, A);
  if (sam) {
    const uDev = AD.byDomain(W, dom); const u = AD.userOf(A, sam);
    if (u) part('user', AD.token(W, dom, sam), u.ou, A);
  }
  return res;
};
/* Application des stratégies : ordinateur au démarrage/gpupdate, utilisateur à l'ouverture de session/gpupdate */
AD.applyGP = function (W, hostId, sam, opts) {
  opts = opts || {}; const host = W.d(hostId); if (!host.win || !host.win.domain) return { ok: false, why: 'groupe de travail' };
  host._rt.gp = host._rt.gp || { computer: null, user: null };
  const dc = AD.locateDC(W, hostId, host.win.domain);
  if (!dc.ok) { WIN.evt(W, hostId, 'Système', 1129, 'Erreur', 'Microsoft-Windows-GroupPolicy', U.av('evt-gp-1129', 'Échec du traitement de la stratégie de groupe en raison de l’absence de connectivité réseau vers un contrôleur de domaine.')); return { ok: false, why: 'dc', err: dc.err }; }
  /* lecture de SYSVOL */
  const sv = N.connect(W, hostId, dc.ip, 'tcp', 445);
  const hasSysvol = (dc.dev.win.shares || []).some(s => s.name === 'SYSVOL');
  if (sv.state !== 'open' || !hasSysvol || !WIN.svcRunning(dc.dev, 'LanmanServer')) { WIN.evt(W, hostId, 'Système', 1058, 'Erreur', 'Microsoft-Windows-GroupPolicy', U.av('evt-gp-1058', 'Le traitement de la stratégie de groupe a échoué. Windows n’a pas pu accéder au fichier \\\\' + host.win.domain + '\\sysvol\\' + host.win.domain + '\\Policies\\… : le fichier est inaccessible.')); return { ok: false, why: 'sysvol' }; }
  const r = AD.rsop(W, hostId, sam || (host._rt.gp.user && host._rt.gp.user.sam));
  const now = W.clock.elapsed;
  if (opts.computer !== false) host._rt.gp.computer = { at: now, gpos: r.computer.gpos, settings: r.computer.settings };
  if (opts.user !== false && sam) {
    const keep = {}; const sets = {};
    for (const id of Object.keys(r.user.settings)) { const s = r.user.settings[id]; if (s.needsLogon && !opts.logon) { const prev = host._rt.gp.user && host._rt.gp.user.sam === sam ? host._rt.gp.user.settings[id] : null; if (prev) sets[id] = prev; continue; } sets[id] = s; }
    host._rt.gp.user = { sam, at: now, gpos: r.user.gpos, settings: sets, pending: Object.keys(r.user.settings).filter(id => !sets[id] || sets[id] !== r.user.settings[id]) };
  }
  WIN.evt(W, hostId, 'Système', 1502, 'Information', 'Microsoft-Windows-GroupPolicy', U.av('evt-gp-1502', 'Le traitement de la stratégie de groupe de l’ordinateur / de l’utilisateur a réussi.'));
  return { ok: true, rsop: r };
};
AD.sessionStart = function (W, hostId, sam, logonRes) {
  const host = W.d(hostId); host._rt.session = { user: sam, at: W.clock.elapsed, token: logonRes && logonRes.token ? [...logonRes.token] : null, cached: !!(logonRes && logonRes.cached), local: !!(logonRes && logonRes.local) };
  if (host.win.domain && !(logonRes && logonRes.cached)) AD.applyGP(W, hostId, sam, { logon: true });
  W.touch('session');
};
AD.sessionEnd = function (W, hostId) { const host = W.d(hostId); delete host._rt.session; if (host._rt.gp) host._rt.gp.user = null; W.touch('session'); };

/* ------------------------------------------------------------------ NTFS + partages */
const RIGHTS = { FullControl: 31, Modify: 15, ReadAndExecute: 5, Read: 1, Write: 2, ListDirectory: 1, Aucun: 0 };
AD.RIGHTS = RIGHTS;
AD.rightBits = r => (typeof r === 'number' ? r : (RIGHTS[r] !== undefined ? RIGHTS[r] : 0));
const normPath = p => String(p).replace(/\//g, '\\').replace(/\\+$/, '');
AD.ntfsFolder = function (srv, path) {
  const nt = (srv.win && srv.win.ntfs) || {}; const p = lc(normPath(path)); let best = null;
  for (const k of Object.keys(nt)) { const kk = lc(normPath(k)); if (p === kk || p.indexOf(kk + '\\') === 0) { if (!best || kk.length > lc(best).length) best = k; } }
  return best;
};
AD.ntfsEffective = function (srv, path, tok) {
  const nt = srv.win.ntfs || {}; const F = AD.ntfsFolder(srv, path); if (!F) return { rights: 0, why: 'aucun ACL' };
  const isSelf = lc(normPath(path)) === lc(normPath(F));
  const aces = []; let cur = F; let first = true;
  while (cur) {
    const fd = nt[cur];
    for (const a of fd.acl || []) { const ap = a.applies || 'this+sub'; if (first && isSelf) aces.push(a); else if (ap.indexOf('sub') >= 0) aces.push(a); }
    if (!fd.inherit) break;
    first = false;
    const parent = Object.keys(nt).filter(k => lc(normPath(cur)).indexOf(lc(normPath(k)) + '\\') === 0).sort((a, b) => b.length - a.length)[0];
    cur = parent || null;
  }
  let allow = 0, deny = 0;
  for (const a of aces) { if (!tok.has(lc(a.who))) continue; const b = AD.rightBits(a.rights); if (a.type === 'deny') deny |= b; else allow |= b; }
  return { rights: allow & ~deny, folder: F };
};
AD.shareRights = function (share, tok) { let allow = 0, deny = 0; for (const p of share.perms || []) { if (!tok.has(lc(p.who))) continue; const b = AD.rightBits(p.access); if (p.type === 'deny') deny |= b; else allow |= b; } return allow & ~deny; };
/* Les utilisateurs du domaine udom peuvent-ils être authentifiés dans le domaine sdom (celui des ressources) ?
   Côté ressources, l'approbation doit être sortante (ou bidirectionnelle) ; côté utilisateurs, entrante (ou bidirectionnelle). */
AD.trustAllows = function (W, sdom, udom) {
  const tA = AD.byDomain(W, sdom), uA = AD.byDomain(W, udom);
  const tr = tA && (tA.win.ad.trusts || []).find(t => lc(t.target) === lc(udom)); const tr2 = uA && (uA.win.ad.trusts || []).find(t => lc(t.target) === lc(sdom));
  if (!tr || !tr2) return { ok: false, why: 'approbation absente' + (tr ? ' côté ' + udom : ' côté ' + sdom) };
  if (tr.state !== 'ok' || tr2.state !== 'ok') return { ok: false, why: 'approbation non valide' };
  const dirOk = (t, need) => !t.direction || t.direction === 'bidirectional' || t.direction === need;
  if (!dirOk(tr, 'outbound')) return { ok: false, why: 'direction : côté ' + sdom + ' l’approbation n’est pas sortante' };
  if (!dirOk(tr2, 'inbound')) return { ok: false, why: 'direction : côté ' + udom + ' l’approbation n’est pas entrante' };
  return { ok: true, why: 'ok' };
};
/* Accès à \\serveur\partage[\sous-dossier] depuis hostId pour la session ouverte. want: 'read'|'write' */
AD.shareAccess = function (W, hostId, unc, want) {
  const host = W.d(hostId); const sess = host._rt.session;
  const m = unc.match(/^\\\\([^\\]+)\\([^\\]+)(?:\\(.*))?$/); if (!m) return { ok: false, code: 'badpath' };
  const r = U.isIP(m[1]) ? { ok: true, ip: m[1] } : N.resolve(W, hostId, m[1], { noCache: !host._rt.useCache });
  if (!r.ok) return { ok: false, code: 'badnetpath', detail: 'résolution : ' + r.err };
  const c = N.connect(W, hostId, r.ip, 'tcp', 445);
  if (c.state !== 'open') return { ok: false, code: 'badnetpath', detail: c.state };
  const srv = W.d(c.dstDev); const share = ((srv.win && srv.win.shares) || []).find(s => lc(s.name) === lc(m[2]));
  if (!share) return { ok: false, code: 'badnetname' };
  if (!sess) return { ok: false, code: 'nosession' };
  /* approbation / jeton */
  let tok;
  const sdom = srv.win.domain || null;
  if (sess.local) tok = new Set([lc(srv.name + '\\' + sess.user), 'tout le monde', 'utilisateurs authentifiés']);
  else {
    const udom = host.win.domain; tok = new Set(sess.token || []);
    if (sdom && udom && lc(sdom) !== lc(udom)) {
      const ta = AD.trustAllows(W, sdom, udom);
      if (!ta.ok) return { ok: false, code: 'trust', detail: ta.why };
    }
  }
  const sr = AD.shareRights(share, tok);
  const wantBit = want === 'write' ? 2 : 1;
  if (!(sr & wantBit)) return { ok: false, code: 'denied', layer: 'partage' };
  const sub = m[3] ? '\\' + m[3] : ''; const nr = AD.ntfsEffective(srv, share.path + sub, tok);
  if (!(nr.rights & wantBit)) return { ok: false, code: 'denied', layer: 'ntfs', folder: nr.folder };
  return { ok: true, rights: sr & nr.rights, server: srv.id };
};

/* ------------------------------------------------------------------ Netlogon : enregistrement des enregistrements DNS du contrôleur */
AD.registerDcRecords = function (W, dcId) {
  const dev = W.d(dcId); const A = dev.win.ad; if (!A) return;
  const zones = (dev.win.dns && dev.win.dns.zones) || []; const z = zones.find(x => lc(x.name) === '_msdcs.' + lc(A.domain));
  if (!z) return;
  const fq = dev.name.toLowerCase() + '.' + A.domain.toLowerCase() + '.';
  const want = [['_ldap._tcp.dc', '0 100 389 ' + fq], ['_kerberos._tcp.dc', '0 100 88 ' + fq], ['_ldap._tcp.pdc', '0 100 389 ' + fq]];
  for (const [n, data] of want) { if (!z.records.some(r => r.name === n && r.type === 'SRV')) z.records.push({ id: n + '|SRV', name: n, type: 'SRV', data }); }
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
