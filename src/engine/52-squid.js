/* ============================================================================
   Proxy web sur pfSense : paquets Squid + squidGuard.
   Modèle de configuration (sur l'appareil pfSense) :
     d.packages[]   : paquets installés {name, ver, broken}
     d.squid        : {enabled, stopped, port, ifaces[], allowUsers, cacheSaved, transparent, transIfaces[],
                       ssl:{on, mode, ifaces[], port, ca}, log:{access}, acl:{allowedSubnets[], whitelist[], blacklist[]}}
     d.squidguard   : {enabled, stopped, log, guiLog, blacklist:{on, url, loaded}, acl:{cats:{cat:'allow'|'deny'|'whitelist'}, default}}
   Les symptômes ne sont jamais écrits : le navigateur d'un poste appelle WEB.fetch, qui passe par ici
   (proxy explicite déclaré sur le poste, ou interception transparente en 80/443 sur le pare-feu, ou QUIC
   qui contourne le proxy). Journaux (Real Time, squidGuard « Blocked ») produits par les requêtes réelles.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;
const SQ = SIM.squid = {};
const lc = s => String(s).toLowerCase();

U.av('squid-errpage', 'Squid : page d’erreur par défaut en anglais (« ERROR / The requested URL could not be retrieved / Access Denied. / Access control configuration prevents your request from being allowed at this time. / Generated … by <hôte> (squid/6.3) ») et textes ERR_DNS_FAIL / ERR_CONNECT_FAIL reconstitués de mémoire ; la fiche de TP ne montre que la page d’erreur du navigateur pour le HTTPS.');
U.av('squid-log-cols', 'Squid (Services > Squid Proxy Server > Real Time) : colonnes du tableau « Squid - Access Logs » (Date, IP, Status, Address, Destination) et formats TCP_TUNNEL/200, TCP_MISS/200, TCP_DENIED/403 : les statuts viennent de la fiche de TP ; les colonnes et l’ordre sont reconstitués.');
U.av('squid-log-sg-explicit', 'Squid, mode explicite : ligne du journal d’accès quand squidGuard refuse un CONNECT — la fiche de TP ne la montre pas (seul le journal « Blocked » de squidGuard est documenté) ; TCP_DENIED/403 est une hypothèse.');
U.av('squid-trans-blacklist-err', 'Squid, mode transparent + Splice All : code d’erreur du navigateur quand un site de la Blacklist de Squid est refusé — la fiche de TP ne le précise que pour squidGuard (ERR_SSL_PROTOCOL_ERROR) ; le même code est repris par hypothèse.');
U.av('sg-block-page', 'squidGuard : page de blocage affichée pour un site HTTP refusé (texte reconstitué ; la fiche de TP ne montre que le cas HTTPS, erreur du navigateur).');
U.av('sg-cats', 'squidGuard : liste de catégories (noms blk_blacklists_xxx) reconstituée de mémoire à partir de la liste UT1 (la fiche de TP annonce 69 catégories ; la liste affichée est partielle) ; le contenu des catégories (quels domaines) est fictif et réduit à quelques noms.');
U.av('sg-log-line', 'squidGuard (Log > Blocked) : format de ligne « date [pid] Request(règle/catégorie/-) hôte:port ip/- - MÉTHODE REDIRECT » reconstitué ; la fiche de TP donne les éléments (IP, site, default, catégorie, CONNECT REDIRECT) sans la mise en forme exacte.');

/* ------------------------------------------------------------------ catégories squidGuard (base fictive réduite) */
SQ.CATS = ['adult', 'agressif', 'arjel', 'associations_religieuses', 'astrology', 'bank', 'bitcoin', 'blog', 'celebrity', 'chat', 'child', 'cleaning', 'cooking', 'cryptojacking', 'dangerous_material', 'dating', 'ddos', 'dialer', 'download', 'drogue', 'education', 'filehosting', 'financial', 'forums', 'gambling', 'games', 'hacking', 'jobsearch', 'liste_blanche', 'malware', 'manga', 'marketingware', 'mixed_adult', 'mobile-phone', 'phishing', 'press', 'publicite', 'radio', 'reaffected', 'remote-control', 'sect', 'shopping', 'social_networks', 'sports', 'stalkerware', 'strict_redirector', 'strong_redirector', 'tricheur', 'update', 'warez', 'webmail'];
SQ.CATDB = {
  social_networks: ['facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'snapchat.com'],
  adult: ['site-adulte.example']
};
SQ.catName = c => 'blk_blacklists_' + c;
SQ.categoryOf = function (host) {
  host = lc(host);
  for (const c of SQ.CATS) { const l = SQ.CATDB[c]; if (l && l.some(dm => host === dm || host.endsWith('.' + dm))) return c; }
  return null;
};

/* ------------------------------------------------------------------ état des services */
SQ.pkg = (d, name) => (d.packages || []).find(p => p.name === name) || null;
SQ.regexOk = e => { try { new RegExp(e, 'i'); return true; } catch (x) { return false; } };
SQ.badRegex = d => ((d.squid && d.squid.acl) ? (d.squid.acl.blacklist || []).concat(d.squid.acl.whitelist || []) : []).filter(e => e && !SQ.regexOk(e));
/* retour : {run, why} */
SQ.state = function (d) {
  const q = d.squid; const p = SQ.pkg(d, 'squid');
  if (!q || !p) return { run: false, why: 'paquet absent' };
  if (p.broken) return { run: false, why: 'paquet incomplet' };
  if (!q.enabled) return { run: false, why: 'désactivé' };
  if (q.stopped) return { run: false, why: 'arrêté' };
  if (!q.cacheSaved) return { run: false, why: 'cache local non enregistré' };
  if (!(q.ifaces || []).length) return { run: false, why: 'aucune interface' };
  if (SQ.badRegex(d).length) return { run: false, why: 'expression régulière invalide : ' + SQ.badRegex(d)[0] };
  if (q.ssl && q.ssl.on && !q.ssl.ca) return { run: false, why: 'aucune autorité de certification pour l’interception SSL' };
  return { run: true, why: 'démarré' };
};
SQ.guardState = function (d) {
  const s = d.squidguard; const p = SQ.pkg(d, 'squidGuard');
  if (!s || !p) return { run: false, why: 'paquet absent' };
  if (p.broken) return { run: false, why: 'paquet incomplet' };
  if (!s.enabled) return { run: false, why: 'désactivé' };
  if (s.stopped) return { run: false, why: 'arrêté' };
  if (!SQ.state(d).run) return { run: false, why: 'Squid arrêté' };
  if (!d.sgdb || !d.sgdb.loaded) return { run: false, why: 'aucune liste chargée' };
  return { run: true, why: 'STARTED' };
};
SQ.restart = function (W, d) { d._rt.squidEpoch = (d._rt.squidEpoch || 0) + 1; };
SQ.epoch = d => d._rt.squidEpoch || 0;

/* écoute : proxy explicite sur les interfaces choisies, port SSL 3129 uniquement en redirection interne (non joignable) */
SQ.listening = function (W, d, proto, port, ifn) {
  if (proto !== 'tcp' || !d.squid) return false;
  return SQ.state(d).run && port === Number(d.squid.port || 3128) && (d.squid.ifaces || []).indexOf(ifn) >= 0;
};

/* ------------------------------------------------------------------ journaux */
SQ.log = function (W, d, e) {
  if (!d.squid || !d.squid.log || !d.squid.log.access) return;
  const l = d._rt.squidLog = d._rt.squidLog || [];
  l.push(Object.assign({ t: W.nowOf(d.id).getTime() }, e)); if (l.length > 400) l.shift();
};
SQ.sgLog = function (W, d, e) {
  const s = d.squidguard; if (!s || !s.log) return;
  const l = d._rt.sgLog = d._rt.sgLog || [];
  l.push(Object.assign({ t: W.nowOf(d.id).getTime() }, e)); if (l.length > 400) l.shift();
};
SQ.sgLine = e => {
  const dt = new Date(e.t); const p2 = U.pad2;
  return dt.getUTCFullYear() + '-' + p2(dt.getUTCMonth() + 1) + '-' + p2(dt.getUTCDate()) + ' ' + p2(dt.getUTCHours()) + ':' + p2(dt.getUTCMinutes()) + ':' + p2(dt.getUTCSeconds()) + ' [' + (e.pid || 4242) + '] Request(default/' + SQ.catName(e.cat) + '/-) ' + e.target + ' ' + e.ip + '/- - ' + e.method + ' REDIRECT';
};

/* ------------------------------------------------------------------ résolution faite par le pare-feu lui-même */
/* pfSense : /etc/resolv.conf pointe sur 127.0.0.1 si le Résolveur DNS est actif, sinon sur les serveurs DNS généraux. */
SQ.resolve = function (W, d, name) {
  name = String(name).replace(/\.$/, '');
  if (U.isIP(name)) return { ok: true, ip: name };
  const u = d.dns && d.dns.unbound;
  if (u && u.enabled) {
    const a = K.pf.dnsAnswer(W, d, 'lan', { name, type: 'A' });
    const ips = (a.answers || []).filter(x => x.type === 'A').map(x => x.data);
    if (a.rcode === 'NOERROR' && ips.length) return { ok: true, ip: ips[0], server: '127.0.0.1' };
    return { ok: false, err: a.rcode === 'NXDOMAIN' ? 'nxdomain' : 'servfail', server: '127.0.0.1' };
  }
  for (const s of (d.dns && d.dns.servers) || []) {
    const r = N.dnsQuery(W, d.id, s, lc(name), 'A');
    if (r.state === 'ok' && r.rcode === 'NOERROR' && r.answers && r.answers.length) return { ok: true, ip: r.answers.filter(x => x.type === 'A')[0].data, server: s };
    if (r.state === 'ok' && r.rcode === 'NXDOMAIN') return { ok: false, err: 'nxdomain', server: s };
  }
  return { ok: false, err: 'timeout' };
};

/* Diagnostics > DNS Lookup : toutes les réponses A et le serveur interrogé (127.0.0.1 si le Résolveur DNS est actif) */
SQ.lookup = function (W, d, name) {
  name = String(name).replace(/\.$/, '');
  const u = d.dns && d.dns.unbound;
  if (u && u.enabled) {
    const a = K.pf.dnsAnswer(W, d, 'lan', { name: name.toLowerCase(), type: 'A' });
    const ans = (a.answers || []).filter(x => x.type === 'A');
    return { ok: a.rcode === 'NOERROR' && ans.length > 0, rcode: a.rcode, answers: ans, server: '127.0.0.1' };
  }
  for (const s of (d.dns && d.dns.servers) || []) {
    const r = N.dnsQuery(W, d.id, s, name.toLowerCase(), 'A');
    if (r.state === 'ok') { const ans = (r.answers || []).filter(x => x.type === 'A'); return { ok: r.rcode === 'NOERROR' && ans.length > 0, rcode: r.rcode, answers: ans, server: s }; }
  }
  return { ok: false, rcode: 'SERVFAIL', answers: [], server: ((d.dns && d.dns.servers) || [])[0] || '' };
};

/* ------------------------------------------------------------------ décision du proxy */
SQ.clientAllowed = function (d, ip) {
  const q = d.squid; const a = q.acl || {};
  if (q.allowUsers && (q.ifaces || []).some(k => { const i = d.ifaces[k]; return i && i.ip && i.mask && U.inNet(ip, i.ip, i.mask); })) return true;
  return (a.allowedSubnets || []).some(c => { try { return U.inCidr(ip, c); } catch (e) { return false; } });
};
const matchList = (list, host) => (list || []).some(e => { try { return new RegExp(e, 'i').test(host); } catch (x) { return false; } });
/* c : {ip, host, port, method:'CONNECT'|'GET', mode:'explicit'|'transparent'} → {action:'allow'|'deny'|'redirect', by, cat?} */
SQ.policy = function (W, d, c) {
  const q = d.squid; const a = q.acl || {};
  if (!SQ.clientAllowed(d, c.ip)) return { action: 'deny', by: 'src' };
  if (c.method === 'CONNECT' && c.port !== 443) return { action: 'deny', by: 'port' };
  if (c.method !== 'CONNECT' && c.port !== 80 && c.port !== 443 && c.port < 1025) return { action: 'deny', by: 'port' };
  const wl = matchList(a.whitelist, c.host);
  if (!wl && matchList(a.blacklist, c.host)) return { action: 'deny', by: 'blacklist' };
  if (SQ.guardState(d).run) {
    const s = d.squidguard; const cat = SQ.categoryOf(c.host); const rule = cat ? (s.acl.cats || {})[cat] : null;
    if (rule === 'deny') return { action: 'redirect', by: 'squidguard', cat };
    if (!rule && s.acl.default === 'deny') return { action: 'redirect', by: 'squidguard', cat: 'all' };
  }
  return { action: 'allow', by: wl ? 'whitelist' : 'default' };
};

/* page d'erreur de Squid (HTTP en clair) */
SQ.errorPage = function (W, d, url, kind, extra) {
  const gen = W.nowOf(d.id).toUTCString().replace('GMT', 'GMT');
  const body = {
    denied: ['Access Denied.', 'Access control configuration prevents your request from being allowed at this time. Please contact your service provider if you feel this is incorrect.'],
    dns: ['Unable to determine IP address from host name', 'The DNS server returned: ' + (extra || 'Server Failure: The name server was unable to process this query.')],
    connect: ['Connection to ' + (extra && extra.ip || '') + ' failed.', 'The system returned: ' + (extra && extra.msg || '(110) Connection timed out')]
  }[kind];
  const html = '<h1>ERROR</h1><h2>The requested URL could not be retrieved</h2><hr><p>The following error was encountered while trying to retrieve the URL: <a>' + U.esc(url) + '</a></p><blockquote><p><b>' + U.esc(body[0]) + '</b></p></blockquote><p>' + U.esc(body[1]) + '</p><p>Your cache administrator is webmaster.</p><hr><p>Generated ' + U.esc(gen) + ' by ' + U.esc((d.hostname || d.id) + (d.domain ? '.' + d.domain : '')) + ' (squid/6.3)</p>';
  return { kind: 'html', title: 'ERROR: The requested URL could not be retrieved', html };
};
SQ.sgPage = function (host) {
  return { kind: 'html', title: 'Access Denied', html: '<h1>Request denied by pfSense proxy</h1><p>Accès refusé par le filtre de catégories (squidGuard) : ' + U.esc(host) + '</p>' };
};

/* ------------------------------------------------------------------ côté poste : proxy déclaré dans Options Internet */
const glob = (pat, host) => new RegExp('^' + String(pat).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i').test(host);
SQ.clientProxy = function (W, clientId, u) {
  const d = W.d(clientId); const p = d.proxy;
  if (!p || !p.enabled || !p.server) return null;
  const host = u.host;
  if (host === 'localhost' || /^127\./.test(host)) return null;
  if (p.bypassLocal && host.indexOf('.') < 0 && !U.isIP(host)) return null;
  if ((p.exceptions || []).some(e => e && glob(e.trim(), host))) return null;
  if (u.scheme === 'https' && p.secure && p.secure.server) return { server: p.secure.server, port: Number(p.secure.port) || 80 };
  return { server: p.server, port: Number(p.port) || 80 };
};

/* ------------------------------------------------------------------ traitement d'une requête par le proxy */
function tunnelKey(host, port) { return host + ':' + port; }
/* req : {ip, host, port, scheme, url, method, mode}. fetchOrigin(ip) → res du serveur d'origine ou {unreach}.
   Retour : {fail:{err, errCode, detail}} | {res} | {blocked:true, ...} */
SQ.serve = function (W, pf, req, clientId, opts, originFn) {
  const q = pf.squid; const isTls = req.method === 'CONNECT';
  const addr = isTls ? req.host + ':' + req.port : req.url;
  const failTunnel = (detail) => ({ fail: { err: 'tunnel', errCode: req.mode === 'transparent' ? 'ERR_SSL_PROTOCOL_ERROR' : 'ERR_TUNNEL_CONNECTION_FAILED', detail } });
  /* connexion déjà ouverte : jamais réexaminée par Squid (tunnel HTTPS établi avant la règle) */
  if (isTls && req.mode === 'explicit' && !opts.noTunnelReuse) {
    const cd = W.d(clientId); const t = cd._rt.tunnels && cd._rt.tunnels[tunnelKey(req.host, req.port)];
    if (t && t.epoch === SQ.epoch(pf) && W.clock.elapsed - t.t < 600) {
      t.t = W.clock.elapsed;
      const rr = SQ.resolve(W, pf, req.host); const ip = rr.ok ? rr.ip : null;
      const org = ip ? originFn(ip) : { unreach: 'dns' };
      if (org.res) return { res: org.res, srv: org.srv, reused: true };
    }
  }
  const pol = SQ.policy(W, pf, req);
  if (pol.action === 'deny') {
    SQ.log(W, pf, { ip: req.ip, status: 'TCP_DENIED/403', addr, dest: '-' });
    if (isTls) return failTunnel('Squid : TCP_DENIED/403 (' + pol.by + ')');
    return { res: { status: 403, server: 'squid', page: SQ.errorPage(W, pf, req.url, 'denied') }, srv: pf.id, denied: pol.by };
  }
  if (pol.action === 'redirect') {
    SQ.sgLog(W, pf, { ip: req.ip, target: req.host + ':' + req.port, cat: pol.cat, method: isTls ? 'CONNECT' : 'GET' });
    if (isTls) {
      if (req.mode === 'transparent') SQ.log(W, pf, { ip: req.ip, status: 'TCP_TUNNEL/503', addr: 'https:443', dest: '-' });
      else SQ.log(W, pf, { ip: req.ip, status: 'TCP_DENIED/403', addr, dest: '-' });
      return failTunnel('squidGuard : REDIRECT (' + SQ.catName(pol.cat) + ')');
    }
    SQ.log(W, pf, { ip: req.ip, status: 'TCP_DENIED/403', addr, dest: '-' });
    return { res: { status: 403, server: 'squid', page: SQ.sgPage(req.host) }, srv: pf.id, denied: 'squidguard' };
  }
  const rr = SQ.resolve(W, pf, req.host);
  if (!rr.ok) {
    SQ.log(W, pf, { ip: req.ip, status: isTls ? 'NONE_NONE/503' : 'TCP_MISS/503', addr, dest: '-' });
    if (isTls) return failTunnel('Squid : résolution de ' + req.host + ' impossible (' + rr.err + ')');
    return { res: { status: 503, server: 'squid', page: SQ.errorPage(W, pf, req.url, 'dns', rr.err === 'nxdomain' ? 'Name Error: The domain name does not exist.' : null) }, srv: pf.id };
  }
  const org = originFn(rr.ip);
  if (org.unreach) {
    SQ.log(W, pf, { ip: req.ip, status: isTls ? 'NONE_NONE/503' : 'TCP_MISS/503', addr, dest: rr.ip });
    if (isTls) return failTunnel('Squid : connexion à ' + rr.ip + ':' + req.port + ' impossible (' + org.unreach + ')');
    return { res: { status: 503, server: 'squid', page: SQ.errorPage(W, pf, req.url, 'connect', { ip: rr.ip, msg: org.unreach === 'refused' ? '(111) Connection refused' : '(110) Connection timed out' }) }, srv: pf.id };
  }
  SQ.log(W, pf, { ip: req.ip, status: isTls ? 'TCP_TUNNEL/200' : 'TCP_MISS/' + org.res.status, addr, dest: rr.ip });
  if (isTls && req.mode === 'explicit' && !opts.noTunnelReuse) { const cd = W.d(clientId); cd._rt.tunnels = cd._rt.tunnels || {}; cd._rt.tunnels[tunnelKey(req.host, req.port)] = { epoch: SQ.epoch(pf), t: W.clock.elapsed }; }
  return { res: org.res, dest: rr.ip, srv: org.srv };
};

/* Interception transparente : le trafic du poste traverse le pare-feu (sauts de la trace) */
SQ.interceptPoint = function (W, trace, scheme, port) {
  for (const hp of trace.hops || []) {
    const d = W.dev[hp.dev]; if (!d || d.kind !== 'pf' || !d.squid || !hp.inIf || !d.squid.enabled) continue;
    const q = d.squid;
    if (scheme === 'http' && port === 80 && q.transparent && (q.transIfaces || []).indexOf(hp.inIf) >= 0) return { pf: d, inIf: hp.inIf, mode: 'http' };
    if (scheme === 'https' && port === 443 && q.ssl && q.ssl.on && (q.ssl.ifaces || []).indexOf(hp.inIf) >= 0) return { pf: d, inIf: hp.inIf, mode: 'ssl' };
  }
  return null;
};
/* ------------------------------------------------------------------ sonde « squid » (état du service et de sa configuration)
   Paramètres : dev (défaut pfsense-tls) ; run / guard : Squid / squidGuard doivent (ou non) être démarrés ;
   blNot / wlNot : aucun motif de la Blacklist / Whitelist ne correspond à l'hôte donné ;
   quicBlocked : {from, ip} — le poste ne peut pas ouvrir de session UDP/443 vers l'adresse ;
   resolves : {name, ip} — le pare-feu résout le nom vers cette adresse (Résolveur DNS ou serveurs généraux). */
SIM.probes = SIM.probes || {};
SIM.probes.squid = (W, p) => {
  const d = W.d(p.dev || 'pfsense-tls'); const why = [];
  if (!d.squid) return { ok: false, why: 'Squid absent' };
  if (p.run !== undefined) { const s = SQ.state(d); if (s.run !== p.run) why.push('Squid : ' + s.why); }
  if (p.guard !== undefined) { const s = SQ.guardState(d); if (s.run !== p.guard) why.push('squidGuard : ' + s.why); }
  if (p.blNot !== undefined && matchList((d.squid.acl || {}).blacklist, p.blNot)) why.push('la Blacklist correspond à ' + p.blNot);
  if (p.wlNot !== undefined && matchList((d.squid.acl || {}).whitelist, p.wlNot)) why.push('la Whitelist correspond à ' + p.wlNot);
  if (p.resolves) { const r = SQ.resolve(W, d, p.resolves.name); if (!r.ok || r.ip !== p.resolves.ip) why.push(p.resolves.name + ' → ' + (r.ok ? r.ip : r.err) + ' (attendu ' + p.resolves.ip + ')'); }
  if (p.quicBlocked) { const c = N.connect(W, p.quicBlocked.from, p.quicBlocked.ip, 'udp', 443); if (c.state === 'open') why.push('UDP/443 ouvert vers ' + p.quicBlocked.ip); }
  return { ok: !why.length, why: why.length ? why.join(' ; ') : 'ok' };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
