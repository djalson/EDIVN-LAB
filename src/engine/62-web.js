/* ============================================================================
   Moteur web : résolution, connexion, TLS (certificat, nom, validité, autorité), vhosts
   Apache/nginx, sites IIS (liaisons, pool, document par défaut, droits NTFS), interface
   web pfSense, hôtes publics de l'ISP. Retourne un résultat structuré (code HTTP, page,
   avertissement de certificat) interprété par le navigateur de l'interface.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, WIN = SIM.win, LX = SIM.lx, AD = SIM.ad;
const WEB = SIM.web = {};
const lc = s => String(s).toLowerCase();

WEB.parseUrl = function (url) {
  const m = String(url).trim().match(/^(?:(https?):\/\/)?([^\/:?#]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?/i);
  if (!m) return null;
  const scheme = lc(m[1] || 'http'); return { scheme, host: m[2], port: m[3] ? +m[3] : (scheme === 'https' ? 443 : 80), path: m[4] || '/', query: m[5] || '' };
};
/* Autorités de certification approuvées par le client */
WEB.trustedCAs = function (W, hostId) { const d = W.d(hostId); return d.win && d.win.domain ? ['CA-FormaTech', 'AC-Publique-Demo'] : ['AC-Publique-Demo']; };
WEB.certCheck = function (W, clientId, cert, host) {
  if (!cert) return { ok: false, code: 'ERR_SSL_PROTOCOL_ERROR', why: 'aucun certificat associé à la liaison' };
  const now = W.nowOf(clientId).getTime();
  if (Date.parse(cert.notBefore) > now || Date.parse(cert.notAfter) < now) return { ok: false, code: 'ERR_CERT_DATE_INVALID', why: 'certificat expiré ou pas encore valide', cert };
  const names = (cert.san && cert.san.length ? cert.san : [cert.cn]).map(lc); const h = lc(host);
  if (!names.some(n => n === h || (n.indexOf('*.') === 0 && h.indexOf('.') > 0 && h.slice(h.indexOf('.')) === n.slice(1)))) return { ok: false, code: 'ERR_CERT_COMMON_NAME_INVALID', why: 'le nom ' + host + ' ne figure pas dans le certificat', cert };
  if (cert.selfSigned || WEB.trustedCAs(W, clientId).indexOf(cert.issuer) < 0) return { ok: false, code: 'ERR_CERT_AUTHORITY_INVALID', why: 'autorité de certification non approuvée : ' + cert.issuer, cert };
  return { ok: true, cert };
};

/* ------------------------------------------------------------------ gestionnaires de serveurs */
const ERR = {
  '403.14': ['Forbidden', U.av('iis-403-14', 'Un document par défaut n’est pas configuré pour l’URL demandée et l’exploration de répertoire n’est pas activée sur le serveur.')],
  '401.3': ['Unauthorized', U.av('iis-401-3', 'Vous n’avez pas l’autorisation d’afficher ce répertoire ou cette page avec les informations d’identification que vous avez fournies (accès refusé en raison de listes de contrôle d’accès).')],
  '404.0': ['Not Found', U.av('iis-404-0', 'Le répertoire ou le fichier que vous recherchez a été supprimé, a changé de nom ou est temporairement indisponible.')],
  '503': ['Service Unavailable', U.av('iis-503', 'Service indisponible.')],
  '400': ['Bad Request - Invalid Hostname', U.av('iis-400-host', 'Nom d’hôte non valide.')]
};
function iisHandler(W, srv, req, ifn, clientId) {
  const iis = srv.win.iis; const ip = (N.l3(W, srv).find(x => x.name === ifn) || {}).ip;
  const cand = [];
  for (const s of iis.sites) { if (s.state !== 'started') continue; for (const b of s.bindings) if (+b.port === req.port && b.proto === req.scheme && (b.ip === '*' || b.ip === ip)) cand.push({ s, b }); }
  let hit = cand.find(c => c.b.host && lc(c.b.host) === lc(req.host)) || cand.find(c => !c.b.host);
  if (!hit) return { status: 400, error: { code: '400', title: ERR['400'][0], detail: ERR['400'][1] }, server: 'iis' };
  const site = hit.s;
  let tls = null;
  if (req.scheme === 'https') { const cert = ((srv.win.certs) || []).find(c => c.cn === hit.b.cert); tls = WEB.certCheck(W, clientId, cert, req.host); }
  const pool = iis.appPools.find(p => p.name === site.pool);
  if (!pool || pool.state !== 'started') return { status: 503, error: { code: '503', title: ERR['503'][0], detail: ERR['503'][1] }, tls, server: 'iis' };
  let file = req.path === '/' ? null : req.path.replace(/^\//, '');
  if (!file) { file = (site.defaultDocs || []).find(d => (site.files || []).indexOf(d) >= 0); if (!file && site.dirBrowse) return { status: 200, page: { kind: 'html', title: 'Index of /', html: '<h1>Contenu du répertoire</h1><ul>' + (site.files || []).map(f => '<li>' + U.esc(f) + '</li>').join('') + '</ul>' }, tls, server: 'iis', site: site.name }; if (!file) return { status: 403, error: { code: '403.14', title: ERR['403.14'][0], detail: ERR['403.14'][1] }, tls, server: 'iis' }; }
  else if ((site.files || []).indexOf(file) < 0) return { status: 404, error: { code: '404.0', title: ERR['404.0'][0], detail: ERR['404.0'][1] }, tls, server: 'iis' };
  const tok = new Set(['nt authority\\iusr', 'builtin\\iis_iusrs', 'tout le monde', 'utilisateurs authentifiés']);
  const nr = AD.ntfsEffective(srv, site.path + '\\' + file, tok);
  if (!(nr.rights & 1)) return { status: 401, error: { code: '401.3', title: ERR['401.3'][0], detail: ERR['401.3'][1] }, tls, server: 'iis' };
  if (site.app && WEB.apps && WEB.apps[site.app]) return Object.assign({ tls, server: 'iis', site: site.name }, WEB.apps[site.app](W, srv, req, clientId, site));   // application hébergée (63-webapps.js)
  const content = (site.content && site.content[file]) || null;
  return { status: 200, page: { kind: 'html', title: content ? content.title : 'Page web', html: content ? content.html : '<h1>' + U.esc(site.name) + '</h1>' }, tls, server: 'iis', site: site.name };
}

function fileAccess(W, d, user, path, mode) { return LX.access(d, user, path, mode); }
function pageFrom(W, d, user, docroot, reqPath, indexNames) {
  let p = LX.norm(docroot + '/' + reqPath.replace(/^\//, ''));
  if (LX.isDir(d, p)) {
    if (!LX.access(d, user, p, 'x').ok) return { status: 403 };
    const idx = indexNames.map(i => LX.norm(p + '/' + i)).find(x => LX.exists(d, x));
    if (!idx) return { status: reqPath === '/' ? 403 : 404 };
    p = idx;
  }
  if (!LX.exists(d, p)) { const parent = LX.dirname(p); if (!LX.access(d, user, parent, 'x').ok) return { status: 403 }; return { status: 404 }; }
  const acc = LX.access(d, user, p, 'r'); if (!acc.ok) return { status: 403 };
  const c = LX.readFile(d, p); return { status: 200, html: c, file: p };
}
function apacheHandler(W, srv, req, clientIp, clientId) {
  const run = LX.svcRun(srv, 'apache2'); const snap = run.snap;
  const cands = snap.vhosts.filter(v => v.port === req.port);
  const v = cands.find(x => lc(x.serverName) === lc(req.host) || x.aliases.map(lc).indexOf(lc(req.host)) >= 0) || cands[0];
  if (!v) return { status: 404, server: 'apache' };
  let tls = null;
  if (req.scheme === 'https') { if (!v.ssl) return { status: 400, server: 'apache', tlsError: true }; const meta = (srv.tls || {})[v.certFile]; tls = WEB.certCheck(W, clientId, meta, req.host); }
  else if (v.ssl) return { status: 400, server: 'apache', note: 'Bad Request : HTTP sur un port TLS' };
  for (const dd of v.dirs) if (req.path.indexOf('/') === 0 && LX.norm(v.docroot).indexOf(LX.norm(dd.path)) === 0 && dd.require) {
    const rq = dd.require.toLowerCase();
    if (rq === 'all denied') return { status: 403, server: 'apache', tls, why: 'Require all denied' };
    const m = rq.match(/^ip\s+(\S+)/); if (m && !(m[1].indexOf('/') > 0 ? U.inCidr(clientIp, m[1]) : clientIp === m[1])) return { status: 403, server: 'apache', tls, why: 'Require ip' };
  }
  const r = pageFrom(W, srv, 'www-data', v.docroot, req.path, ['index.html', 'index.php', 'index.htm']);
  if (r.status !== 200) return { status: r.status, server: 'apache', tls };
  return { status: 200, server: 'apache', tls, page: { kind: 'html', title: (r.html.match(/<title>([^<]*)/i) || [])[1] || req.host, html: r.html } };
}
function nginxHandler(W, srv, req, clientIp, clientId) {
  const run = LX.svcRun(srv, 'nginx'); const snap = run.snap;
  const cands = snap.servers.filter(sv => sv.listen.some(l => l.port === req.port && l.ssl === (req.scheme === 'https')));
  const v = cands.find(sv => sv.names.map(lc).indexOf(lc(req.host)) >= 0) || cands.find(sv => sv.listen.some(l => l.def)) || cands[0];
  if (!v) return { status: 400, server: 'nginx' };
  let tls = null;
  if (req.scheme === 'https') tls = WEB.certCheck(W, clientId, (srv.tls || {})[v.cert], req.host);
  if (v.ret) { const m = v.ret.match(/^(\d+)\s+(\S+)/); if (m && /^30\d$/.test(m[1])) return { status: +m[1], location: m[2].replace(/\$host/g, req.host).replace(/\$request_uri/g, req.path + req.query).replace(/\$scheme/g, req.scheme), server: 'nginx', tls }; }
  const r = pageFrom(W, srv, 'www-data', v.root || '/usr/share/nginx/html', req.path, ['index.html', 'index.htm']);
  if (r.status !== 200) return { status: r.status === 403 && req.path === '/' ? 403 : r.status, server: 'nginx', tls };
  return { status: 200, server: 'nginx', tls, page: { kind: 'html', title: (r.html.match(/<title>([^<]*)/i) || [])[1] || req.host, html: r.html } };
}
function pfHandler(W, srv, req, clientIp) { return { status: 200, server: 'pfsense', page: { kind: 'pfsense', host: srv.id }, tls: { ok: false, code: 'ERR_CERT_AUTHORITY_INVALID', why: 'certificat auto-signé du pare-feu', cert: { cn: srv.hostname, issuer: srv.hostname, selfSigned: true } } }; }

/* ------------------------------------------------------------------ serveur d'origine */
/* Traite la requête chez le serveur joint (c : résultat de N.connect). clientId sert à valider le TLS côté poste. */
function originHandle(W, c, req, clientId, u) {
  const srv = W.d(c.dstDev); const sip = c.trace.sipAtDst;
  if (srv.kind === 'win' && srv.win.iis) return iisHandler(W, srv, req, c.dstIf, clientId);
  if (srv.kind === 'linux') {
    if (LX.svcRun(srv, 'apache2') && srv.svc.apache2.state === 'active' && (LX.svcRun(srv, 'apache2').snap.listen.indexOf(req.port) >= 0)) return apacheHandler(W, srv, req, sip, clientId);
    if (LX.svcRun(srv, 'nginx') && srv.svc.nginx.state === 'active') return nginxHandler(W, srv, req, sip, clientId);
    return { status: 502, server: 'inconnu' };
  }
  if (srv.kind === 'pf') return pfHandler(W, srv, req, sip);
  if (srv.kind === 'isp') return ispHandler(W, srv, req, c.trace.dip);
  if (srv.kind === 'printer') return { status: 200, server: 'printer', page: { kind: 'html', title: 'Imprimante', html: '<h1>' + U.esc(srv.model || srv.name) + '</h1><p>État : prête</p>' } };
  return { status: 404, server: 'inconnu' };
}
/* hôtes publics : page propre à l'adresse (pub[ip].pages[chemin]), sinon page générique */
function ispHandler(W, srv, req, dip) {
  const hst = srv.pub && srv.pub[dip]; const pg = hst && hst.pages && (hst.pages[req.path] || hst.pages['*']);
  if (pg) return { status: 200, server: 'public', page: { kind: 'html', title: pg.title, html: pg.html } };
  return { status: 200, server: 'public', page: { kind: 'html', title: 'Exemple', html: '<h1>Domaine d’exemple</h1><p>Ce domaine est réservé à la documentation.</p>' } };
}
const fmtUrl = u => u.scheme + '://' + u.host + (((u.scheme === 'http' && u.port === 80) || (u.scheme === 'https' && u.port === 443)) ? '' : ':' + u.port) + u.path + u.query;
/* l'hôte public accepte-t-il QUIC (UDP 443) ? */
function quicCapable(W, ip) { for (const id of Object.keys(W.dev)) { const d = W.dev[id]; if (d.kind === 'isp' && d.pub && d.pub[ip] && (d.pub[ip].svc || []).indexOf('udp/443') >= 0) return true; } return false; }
/* interception SSL en mode « bump » : le certificat présenté est signé par l'AC de Squid */
function bumpCert(pf, host) { return { cn: host, san: [host], issuer: pf.squid.ssl.ca, selfSigned: false, notBefore: '2020-01-01', notAfter: '2040-01-01' }; }

/* ------------------------------------------------------------------ récupération d'une URL */
WEB.fetch = function (W, clientId, url, opts) {
  opts = opts || {}; const out = { ok: false, steps: [], redirects: [] };
  let u = WEB.parseUrl(url); if (!u) { out.err = 'url'; return out; }
  const SQ = SIM.squid;
  for (let hop = 0; hop < 6; hop++) {
    out.url = fmtUrl(u);
    let res = null; let srvId = null;
    const px = SQ ? SQ.clientProxy(W, clientId, u) : null;
    if (px) {
      /* ---- proxy explicite déclaré sur le poste */
      const pip = U.isIP(px.server) ? { ok: true, ip: px.server } : N.resolve(W, clientId, px.server, { noCache: !!opts.noCache });
      const pc = pip.ok ? N.connect(W, clientId, pip.ip, 'tcp', px.port) : { state: 'dns' };
      const pf = pc.state === 'open' ? W.d(pc.dstDev) : null;
      if (!pf || pf.kind !== 'pf' || !pf.squid) { out.err = 'proxy'; out.errCode = 'ERR_PROXY_CONNECTION_FAILED'; out.detail = 'proxy ' + px.server + ':' + px.port + ' : ' + (pc.state === 'open' ? 'service inattendu' : pc.state + (pc.trace && !pc.trace.ok ? ' ' + N.describeFail(pc.trace) : '')); return out; }
      const req = { ip: pc.trace.sipAtDst, host: u.host, port: u.port, scheme: u.scheme, url: out.url, method: u.scheme === 'https' ? 'CONNECT' : 'GET', mode: 'explicit' };
      const sv = SQ.serve(W, pf, req, clientId, opts, (ip) => {
        const cc = N.connect(W, pf.id, ip, 'tcp', u.port);
        if (cc.state !== 'open') return { unreach: cc.state === 'refused' ? 'refused' : 'timeout' };
        return { res: originHandle(W, cc, { scheme: u.scheme, host: u.host, port: cc.trace.dportAtDst !== undefined ? cc.trace.dportAtDst : u.port, path: u.path, query: u.query }, clientId, u), srv: cc.dstDev };
      });
      if (sv.fail) { out.err = sv.fail.err; out.errCode = sv.fail.errCode; out.detail = sv.fail.detail; out.viaProxy = pf.id; return out; }
      res = sv.res; srvId = sv.srv; out.viaProxy = pf.id; out.proxyDenied = sv.denied || null;
      /* en tunnel, le TLS est négocié de bout en bout : le poste valide le certificat du site */
    } else {
      /* ---- connexion directe (éventuellement interceptée par le pare-feu) */
      const r = U.isIP(u.host) ? { ok: true, ip: u.host } : N.resolve(W, clientId, u.host, { noCache: !!opts.noCache });
      if (!r.ok) { out.err = 'dns'; out.detail = r.err; out.errCode = 'ERR_NAME_NOT_RESOLVED'; return out; }
      let c = null; let viaQuic = false;
      if (u.scheme === 'https' && quicCapable(W, r.ip)) { const qc = N.connect(W, clientId, r.ip, 'udp', 443); if (qc.state === 'open') { c = N.connect(W, clientId, r.ip, 'tcp', u.port); viaQuic = true; } }
      if (!c) c = N.connect(W, clientId, r.ip, 'tcp', u.port);
      /* redirection transparente : rdr vers Squid, avant le filtrage ; si Squid est arrêté, personne n'écoute */
      const ic = (SQ && !viaQuic && c.trace) ? SQ.interceptPoint(W, c.trace, u.scheme, u.port) : null;
      if (ic) {
        if (!SQ.state(ic.pf).run) { out.err = 'refused'; out.errCode = 'ERR_CONNECTION_REFUSED'; out.detail = 'redirection vers Squid : aucun service à l’écoute'; return out; }
        const req = { ip: c.trace.sip || (c.trace.hops[0] && c.trace.hops[0].inIp), host: u.host, port: u.port, scheme: u.scheme, url: out.url, method: u.scheme === 'https' ? 'CONNECT' : 'GET', mode: 'transparent' };
        if (c.state !== 'open') { /* le chemin vers la destination est coupé : le client n'a pas de réponse */ }
        else {
          const sv = SQ.serve(W, ic.pf, req, clientId, Object.assign({}, opts, { noTunnelReuse: true }), (ip) => ({ res: originHandle(W, c, { scheme: u.scheme, host: u.host, port: u.port, path: u.path, query: u.query }, clientId, u), srv: c.dstDev }));
          if (sv.fail) { out.err = sv.fail.err; out.errCode = sv.fail.errCode; out.detail = sv.fail.detail; out.viaProxy = ic.pf.id; out.transparent = true; return out; }
          res = sv.res; srvId = sv.srv; out.viaProxy = ic.pf.id; out.transparent = true; out.proxyDenied = sv.denied || null;
          if (u.scheme === 'https' && ic.pf.squid.ssl.mode !== 'splice' && !sv.denied) res = Object.assign({}, res, { tls: WEB.certCheck(W, clientId, bumpCert(ic.pf, u.host), u.host) });
        }
      }
      if (!res) {
        if (c.state !== 'open') { out.err = c.state === 'refused' ? 'refused' : 'timeout'; out.errCode = c.state === 'refused' ? 'ERR_CONNECTION_REFUSED' : (c.state === 'unreach' ? 'ERR_ADDRESS_UNREACHABLE' : 'ERR_CONNECTION_TIMED_OUT'); out.detail = c.state + (c.trace && !c.trace.ok ? ' ' + N.describeFail(c.trace) : ''); return out; }
        const dport = c.trace.dportAtDst !== undefined ? c.trace.dportAtDst : u.port;
        res = originHandle(W, c, { scheme: u.scheme, host: u.host, port: dport, path: u.path, query: u.query }, clientId, u);
        if (viaQuic) out.quic = true;
      }
      srvId = c.dstDev;
    }
    out.server = srvId; out.tls = res.tls || null;
    if (u.scheme === 'https' && res.tls && !res.tls.ok && !opts.ignoreTls) { out.err = 'tls'; out.errCode = res.tls.code; out.detail = res.tls.why; out.cert = res.tls.cert; out.status = res.status; out.blocked = true; return out; }
    if (res.tlsError) { out.err = 'tls'; out.errCode = 'ERR_SSL_PROTOCOL_ERROR'; return out; }
    if (res.status >= 300 && res.status < 400 && res.location) { out.redirects.push({ from: out.url, status: res.status, to: res.location }); const nu = WEB.parseUrl(res.location); if (!nu) { out.err = 'redirect'; return out; } u = nu; continue; }
    out.ok = res.status >= 200 && res.status < 300; out.status = res.status; out.page = res.page || null; out.error = res.error || null; out.finalUrl = out.url; out.site = res.site; out.serverKind = res.server;
    return out;
  }
  out.err = 'redirect-loop'; out.errCode = 'ERR_TOO_MANY_REDIRECTS'; return out;
};

/* sonde : requête HTTP depuis un poste */
SIM.probes = SIM.probes || {};
SIM.probes.http = (W, p) => {
  const r = WEB.fetch(W, p.from, p.url, { noCache: true, ignoreTls: !!p.ignoreTls, noTunnelReuse: true });
  if (r.err) return { ok: false, why: r.err + (r.errCode ? ' ' + r.errCode : '') + (r.detail ? ' (' + r.detail + ')' : '') };
  const want = p.status || 200;
  if (r.status !== want) return { ok: false, why: 'HTTP ' + r.status + (r.error ? ' ' + r.error.code : '') };
  if (p.contains && !(r.page && r.page.html && r.page.html.indexOf(p.contains) >= 0)) return { ok: false, why: 'contenu inattendu' };
  return { ok: true, why: 'HTTP ' + r.status };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
