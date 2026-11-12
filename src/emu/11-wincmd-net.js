/* ============================================================================
   Windows — commandes réseau : ipconfig, ping, nslookup, tracert, netstat, arp, route, curl, ssh.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, WIN = SIM.win, WEB = SIM.web;
const E = SIM.emu; const L = E.L, W_ = E.win; const C = W_.cmds;
const lc = s => String(s).toLowerCase();

U.av('ipconfig-adapter-disabled', 'ipconfig n’affiche pas les cartes désactivées (état « Désactivé ») : comportement attendu de Windows, à confirmer par capture.');
U.av('ipconfig-format', 'ipconfig / ipconfig /all : libellés français, colonne des deux-points et pointillés reconstitués de mémoire (numéro de colonne, libellés « Type de nœud », « Routage IP activé », IAID/DUID DHCPv6), à valider par capture.');
U.av('ping-fr-format', 'ping en français : « Envoi d’une requête \'Ping\' … », « Réponse de … : octets=32 temps<1ms TTL=… », « Statistiques Ping pour … », « Délai d’attente de la demande dépassé. », « Impossible de joindre l’hôte/le réseau de destination. », « Échec de la transmission. Défaillance générale. » — reconstitués de mémoire.');
U.av('nslookup-format', 'nslookup en français : « Serveur : », « Address: », « Nom : », « Réponse ne faisant pas autorité : », « *** x ne parvient pas à trouver y: Non-existent domain », délais « DNS request timed out. / timeout was 2 seconds. » — reconstitués de mémoire.');
U.av('tracert-format', 'tracert en français : « Détermination de l’itinéraire vers … », « avec un maximum de 30 sauts : », « Itinéraire déterminé. », « signale : » — reconstitués de mémoire.');
U.av('netstat-arp-route-format', 'netstat -an, arp -a, route print : en-têtes et libellés français reconstitués de mémoire.');
U.av('ipconfig-elevation', 'ipconfig /release et /renew exigent une élévation sous Windows 10 (message « L’opération demandée nécessite une élévation. ») ; /flushdns autorisé ici sans élévation : à vérifier.');

/* ------------------------------------------------------------------ résolution côté poste Windows */
/* Résout un nom ou une IP depuis le poste. Retour {ok, ip, fqdn, err, viaHosts} */
W_.resolveHost = function (s, name) {
  const r = N.resolve(s.W, s.devId, name);
  if (!r.ok) s.env.advance(r.err === 'nxdomain' ? 0 : 4);
  return r;
};
W_.macOfIp = function (W, ip) { const o = N.findOwner(W, ip); if (!o) return null; const d = o.dev; const ic = (d.ifaces && d.ifaces[o.iface]) || (d.svi && d.svi[o.iface]); return (ic && ic.mac) || U.mac(d.id + o.iface); };
W_.ptrName = function (s, ip) {
  const rev = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  for (const sv of N.dnsServersOf(s.W, s.d)) {
    const r = N.dnsQuery(s.W, s.devId, sv, rev, 'PTR');
    if (r.state === 'ok' && r.rcode === 'NOERROR' && r.answers && r.answers.length) return r.answers[0].data.replace(/\.$/, '');
    if (r.state === 'ok') return null;
  }
  return null;
};
const noteArp = (s, ip) => {
  const W = s.W, d = s.d; const l3 = N.l3up(W, d); const on = l3.find(x => U.inNet(ip, x.ip, x.mask)); const rt = N.route(W, d, ip);
  let nh = on ? ip : (rt && rt.nh); if (!nh) return;
  const mac = W_.macOfIp(W, nh); if (!mac) return;
  d._rt.arp = d._rt.arp || {}; d._rt.arp[nh] = { mac, t: W.clock.elapsed };
};

/* ------------------------------------------------------------------ ipconfig */
const dots = (label, width) => { let f = ''; for (let i = 0; i < width - label.length; i++) f += (i % 2 === 0 ? '.' : ' '); return label + f; };
const row = (label, val) => '   ' + dots(label, 39) + ': ' + (val === undefined ? '' : val);
const ipv6 = (d, ifn) => { const h = U.hash8(d.id + ifn + 'v6'), h2 = U.hash8(ifn + d.id + 'v6'); return 'fe80::' + h.slice(0, 4) + ':' + h.slice(4, 8) + ':' + h2.slice(0, 4) + ':' + h2.slice(4, 8) + '%' + (6 + parseInt(U.hash8(d.id).slice(0, 1), 16) % 9); };
W_.adapterLines = function (s, ifn, all, o) {
  const d = s.d, W = s.W, i = d.ifaces[ifn]; const up = N.linkUp(W, d, ifn); const cfg = N.effCfg(d, ifn);
  const out = [];
  out.push('Carte Ethernet ' + ifn + ' :'); out.push('');
  if (!up) {
    out.push(row('Statut du média', 'Média déconnecté'));
    out.push(row('Suffixe DNS propre à la connexion', (cfg && cfg.suffix) || ''));
    if (all) { out.push(row('Description', W_.nicDesc)); out.push(row('Adresse physique', E.macDash(i.mac))); out.push(row('DHCP activé', i.dhcp ? 'Oui' : 'Non')); out.push(row('Configuration automatique activée', 'Oui')); }
    return out;
  }
  out.push(row('Suffixe DNS propre à la connexion', (cfg.suffix || '')));
  if (all) { out.push(row('Description', W_.nicDesc)); out.push(row('Adresse physique', E.macDash(i.mac))); out.push(row('DHCP activé', i.dhcp ? 'Oui' : 'Non')); out.push(row('Configuration automatique activée', 'Oui')); }
  out.push(row('Adresse IPv6 de liaison locale', ipv6(d, ifn) + (all ? '(préféré)' : '')));
  if (cfg.mode === 'apipa') {
    out.push(row('Adresse IPv4 de configuration automatique', cfg.ip + (all ? '(préféré)' : ''))); out.push(row('Masque de sous-réseau', cfg.mask)); out.push(row('Passerelle par défaut', ''));
  } else if (cfg.mode === 'released') {
    out.push(row('Passerelle par défaut', ''));
  } else {
    out.push(row('Adresse IPv4', cfg.ip + (all ? '(préféré)' : ''))); out.push(row('Masque de sous-réseau', cfg.mask));
    if (all && cfg.mode === 'dhcp' && cfg.lease) {
      const t0 = new Date(W.clock.base + (cfg.lease.t || 0) * 1000), t1 = new Date(t0.getTime() + (cfg.lease.leaseSec || 691200) * 1000);
      out.push(row('Bail obtenu', E.frLong(t0))); out.push(row('Bail expirant', E.frLong(t1)));
    }
    out.push(row('Passerelle par défaut', cfg.gw || ''));
    if (all && cfg.mode === 'dhcp') out.push(row('Serveur DHCP', cfg.server || ''));
  }
  if (all) {
    out.push(row('IAID DHCPv6', String(100663296 + parseInt(U.hash8(i.mac).slice(0, 4), 16)))); out.push(row('DUID de client DHCPv6', '00-01-00-01-2B-' + U.hash8(d.id).toUpperCase().match(/../g).join('-') + '-' + E.macDash(i.mac)));
    const dns = (cfg.dns || []); out.push(row('Serveurs DNS', dns[0] || '')); dns.slice(1).forEach(x => out.push(' '.repeat(42 + 0) + x));
    out.push(row('NetBIOS sur Tcpip', 'Activé'));
  }
  return out;
};
C.ipconfig = (s, a, o, r) => {
  const d = s.d, W = s.W; const fl = a.map(x => x.toLowerCase());
  const need = () => { if (!s.elevated) { o.blank(); o.l('Une erreur s’est produite lors de l’opération : L’opération demandée nécessite une élévation.', 'e'); r.ok = false; return false; } return true; };
  const names = W_.ifaceNames(d).filter(n => !d.ifaces[n].adminDown); /* une carte désactivée n’apparaît pas dans ipconfig */
  if (fl.includes('/flushdns')) { o.blank(); o.l('Configuration IP de Windows'); o.blank(); d._rt.dnsCache = {}; s.env.touch('flushdns'); r.mutated = true; o.l('Le cache de résolution DNS a été vidé.'); return; }
  if (fl.includes('/displaydns')) {
    o.blank(); o.l('Configuration IP de Windows'); o.blank();
    const c = d._rt.dnsCache || {};
    Object.keys(c).forEach(k => {
      o.l('    ' + k); o.l('    ----------------------------------------'); o.l('    Nom d’enregistrement . . . : ' + k); o.l('    Type d’enregistrement . . : 1');
      o.l('    Durée de vie . . . . . . . : ' + Math.max(1, SIM.sched.cacheTtl(c[k]) - Math.round(W.clock.elapsed - c[k].t))); o.l('    Longueur de données . . . : 4'); o.l('    Section . . . . . . . . . : Réponse'); o.l('    Enregistrement hôte (A) . : ' + c[k].ip); o.blank();
    });
    return;
  }
  if (fl.includes('/registerdns')) { o.blank(); o.l('Configuration IP de Windows'); o.blank(); o.l('L’inscription des enregistrements de ressources DNS pour toutes les cartes de cet ordinateur a été lancée. Les erreurs éventuelles seront signalées dans l’Observateur d’événements dans 15 minutes.'); return; }
  if (fl.includes('/release') || fl.includes('/renew')) {
    if (!need()) return;
    const rel = fl.includes('/release');
    o.blank(); o.l('Configuration IP de Windows'); o.blank();
    names.forEach(n => {
      const i = d.ifaces[n]; if (!i.dhcp) { o.l('Une erreur s’est produite lors de ' + (rel ? 'la libération' : 'du renouvellement') + ' de l’interface ' + n + ' : l’opération ne peut pas être exécutée car cette interface n’est pas configurée pour DHCP.', 'e'); return; }
      if (rel) { N.dhcpRelease(W, d.id, n); s.env.touch('dhcp'); r.mutated = true; W_.adapterLines(s, n, false).forEach(x => o.l(x)); o.blank(); return; }
      if (!N.linkUp(W, d, n)) { o.l('Une erreur s’est produite lors du renouvellement de l’interface ' + n + ' : impossible de contacter votre serveur DHCP. La demande a expiré.', 'e'); return; }
      const res = N.dhcpRenew(W, d.id, n); s.env.touch('dhcp'); r.mutated = true;
      if (res.ok) { s.env.advance(2); W_.adapterLines(s, n, false).forEach(x => o.l(x)); o.blank(); }
      else { s.env.advance(res.reason === 'noserver' ? 22 : 4); o.l('Une erreur s’est produite lors du renouvellement de l’interface ' + n + ' : impossible de contacter votre serveur DHCP. La demande a expiré.', 'e', res.reason === 'noserver' ? 3000 : 0); }
    });
    s.env.obs('ipconfig:' + d.id + ':renew', names.some(n => { const c = N.effCfg(d, n); return c && c.mode === 'dhcp' && c.ip && c.ip !== '0.0.0.0'; }));
    return;
  }
  const all = fl.includes('/all');
  o.blank(); o.l('Configuration IP de Windows'); o.blank();
  if (all) {
    const cfg0 = names[0] ? N.effCfg(d, names[0]) : null;
    o.l(row('Nom de l’hôte ', d.name.toUpperCase())); o.l(row('Suffixe DNS principal ', d.win.domain || '')); o.l(row('Type de nœud', 'Hybride')); o.l(row('Routage IP activé', 'Non')); o.l(row('Proxy WINS activé', 'Non'));
    const sl = N.searchList(W, d); o.l(row('Liste de recherche du suffixe DNS', sl[0] || '')); sl.slice(1).forEach(x => o.l(' '.repeat(42) + x)); o.blank();
  }
  names.forEach(n => { W_.adapterLines(s, n, all).forEach(x => o.l(x)); o.blank(); });
  const good = names.some(n => { const c = N.effCfg(d, n); return c && c.ip && c.ip !== '0.0.0.0' && c.mode !== 'apipa' && N.linkUp(W, d, n); });
  s.env.obs('ipconfig:' + d.id + ':' + (all ? 'all' : 'base'), good);
};

/* ------------------------------------------------------------------ ping */
function pingLines(s, ip, label, seq, size, wait) {
  const W = s.W, d = s.d;
  const r = N.ping(W, d.id, ip);
  if (r.ok) {
    const dst = r.trace.dstDev ? W.d(r.trace.dstDev) : null; const ttl = E.baseTtl(dst) - E.hopCount(r.trace); const ms = E.rttMs(r.trace, seq);
    noteArp(s, ip);
    return { ok: true, ms, line: L('Réponse de ' + ip + ' : octets=' + size + ' ' + (ms < 1 ? 'temps<1ms' : 'temps=' + ms + ' ms') + ' TTL=' + ttl, 'o', 1000), sec: 1 };
  }
  if (r.kind === 'timeout') return { ok: false, line: L('Délai d’attente de la demande dépassé.', 'o', wait), sec: Math.round(wait / 1000) };
  if (r.kind === 'general') return { ok: false, line: L('Échec de la transmission. Défaillance générale.', 'o', 1000), sec: 1 };
  const from = r.from || ip;
  const msg = r.kind === 'net' ? 'Impossible de joindre le réseau de destination.' : 'Impossible de joindre l’hôte de destination.';
  return { ok: false, replied: true, line: L('Réponse de ' + from + ' : ' + msg, 'o', 1000), sec: 1 };
}
C.ping = (s, a, o, r) => {
  const d = s.d, W = s.W; let count = 4, cont = false, size = 32, wait = 4000, target = null, resolveAddr = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '-t') cont = true; else if (x === '-n') count = +a[++i]; else if (x === '-l') size = +a[++i]; else if (x === '-w') wait = +a[++i]; else if (x === '-a') resolveAddr = true; else if (/^-[46]$/.test(x)) { /* famille ignorée */ } else if (x === '-S' || x === '-i' || x === '-r' || x === '-s' || x === '-j' || x === '-k' || x === '-v' || x === '-R') i++; else if (/^-/.test(x)) { } else target = x;
  }
  if (!target) { o.l('Utilisation : ping [-t] [-a] [-n échos] [-l taille] [-f] [-i vie] [-v TOS]', 'o'); o.l('            [-r nombre] [-s nombre] [[-j liste-hôtes] | [-k liste-hôtes]]'); o.l('            [-w délai_attente] [-R] [-S srcaddr] [-c compartiment] [-p]'); o.l('            [-4] [-6] nom_cible'); return; }
  if (!(count > 0) || !isFinite(count)) { o.l('Mauvaise valeur pour l’option -n, la valeur doit être comprise entre 1 et 4294967295.', 'e'); r.ok = false; return; }
  let ip, label;
  if (U.isIP(target)) { ip = target; label = target; }
  else {
    const res = W_.resolveHost(s, target);
    if (!res.ok) { o.l('La requête Ping n’a pas pu trouver l’hôte ' + target + '. Vérifiez le nom et essayez à nouveau.'); s.env.obs('ping:' + d.id + ':' + target, false); r.ok = false; return; }
    ip = res.ip; label = (res.fqdn || target) + ' [' + ip + ']';
  }
  o.blank(); o.l('Envoi d’une requête \'Ping\'  ' + label + ' avec ' + size + ' octets de données :');
  const stats = { sent: 0, recv: 0, ms: [] };
  const step = (seq) => { const p = pingLines(s, ip, label, seq, size, wait); stats.sent++; if (p.ok || p.replied) stats.recv++; if (p.ok) stats.ms.push(p.ms); s.env.obs('ping:' + d.id + ':' + target, p.ok); s.env.advance(p.sec); return p; };
  const summary = () => {
    const out = [L(''), L('Statistiques Ping pour ' + ip + ':'), L('    Paquets : envoyés = ' + stats.sent + ', reçus = ' + stats.recv + ', perdus = ' + (stats.sent - stats.recv) + ' (perte ' + Math.round(100 * (stats.sent - stats.recv) / Math.max(1, stats.sent)) + '%),')];
    if (stats.ms.length) out.push(L('Durée approximative des boucles en millisecondes :'), L('    Minimum = ' + Math.min(...stats.ms) + 'ms, Maximum = ' + Math.max(...stats.ms) + 'ms, Moyenne = ' + Math.round(stats.ms.reduce((x, y) => x + y, 0) / stats.ms.length) + 'ms'));
    return out;
  };
  if (cont) {
    let seq = 0;
    r.out = r.out || [];
    r.stream = { next: () => { const p = step(seq++); return [p.line]; }, stop: () => summary().concat([L('Ctrl+C', 'd')]), interval: 1000 };
    return;
  }
  for (let q = 0; q < count; q++) { const p = step(q); o.lines.push(p.line); }
  summary().forEach(x => o.lines.push(x));
};

/* ------------------------------------------------------------------ nslookup */
function dnsTypeName(t) { return lc(t); }
function nsPrimary(s, server) {
  const out = []; const W = s.W;
  let name = null;
  const rev = server.split('.').reverse().join('.') + '.in-addr.arpa';
  const q = N.dnsQuery(W, s.devId, server, rev, 'PTR');
  if (q.state === 'ok' && q.rcode === 'NOERROR' && q.answers && q.answers.length) name = q.answers[0].data.replace(/\.$/, '');
  else if (q.state !== 'ok') { out.push(L('DNS request timed out.')); out.push(L('    timeout was 2 seconds.')); }
  return { name, out, timeout: q.state !== 'ok' };
}
function nsFormatAnswers(res, type, qname, server, auth) {
  const out = [];
  const A = res.answers || [];
  if (!auth) out.push(L('Réponse ne faisant pas autorité :'));
  if (type === 'A' || type === 'AAAA') {
    const cn = A.filter(x => x.type === 'CNAME'); const addr = A.filter(x => x.type === 'A');
    const nm = (cn.length ? cn[cn.length - 1].data.replace(/\.$/, '') : qname);
    out.push(L('Nom :    ' + nm));
    if (addr.length === 1) out.push(L('Address:  ' + addr[0].data)); else if (addr.length > 1) { out.push(L('Addresses:  ' + addr[0].data)); addr.slice(1).forEach(x => out.push(L('          ' + x.data))); }
    if (cn.length) out.push(L('Aliases:  ' + qname));
  } else if (type === 'PTR') A.filter(x => x.type === 'PTR').forEach(x => out.push(L(x.name + '\tname = ' + x.data.replace(/\.$/, ''))));
  else if (type === 'NS') A.filter(x => x.type === 'NS').forEach(x => out.push(L(x.name + '\tnameserver = ' + x.data.replace(/\.$/, ''))));
  else if (type === 'CNAME') A.filter(x => x.type === 'CNAME').forEach(x => out.push(L(x.name + '\tcanonical name = ' + x.data.replace(/\.$/, ''))));
  else if (type === 'MX') A.filter(x => x.type === 'MX').forEach(x => { const p = x.data.split(/\s+/); out.push(L(x.name + '\tMX preference = ' + p[0] + ', mail exchanger = ' + p[1].replace(/\.$/, ''))); });
  else if (type === 'TXT') A.filter(x => x.type === 'TXT').forEach(x => { out.push(L(x.name + '\ttext =')); out.push(L('')); out.push(L('\t"' + x.data + '"')); });
  else if (type === 'SRV') A.filter(x => x.type === 'SRV').forEach(x => { const p = x.data.split(/\s+/); out.push(L(x.name + '\tSRV service location:')); out.push(L('          priority       = ' + p[0])); out.push(L('          weight         = ' + p[1])); out.push(L('          port           = ' + p[2])); out.push(L('          svr hostname   = ' + p[3].replace(/\.$/, ''))); });
  else A.forEach(x => out.push(L(x.name + '\t' + x.type + ' ' + x.data)));
  return out;
}
/* Requête depuis le client : retourne { out, ok } */
function nsQuery(s, server, nameRaw, type) {
  const W = s.W, d = s.d; const out = [];
  let qn = nameRaw.replace(/\.$/, ''); let isRev = false;
  if (U.isIP(qn) && (type === 'A' || type === 'PTR' || !type)) { qn = qn.split('.').reverse().join('.') + '.in-addr.arpa'; type = 'PTR'; isRev = true; }
  const cands = []; const absolute = /\.$/.test(nameRaw);
  if (qn.indexOf('.') < 0 && !isRev && !absolute) { N.searchList(W, d).forEach(sf => cands.push(qn + '.' + sf)); cands.push(qn); } else cands.push(qn);
  let last = null, tmo = 0;
  for (const c of cands) {
    const q = N.dnsQuery(W, s.devId, server, c, type);
    if (q.state !== 'ok') { tmo++; last = { timeout: true }; for (let k = 0; k < 4; k++) { out.push(L('DNS request timed out.')); out.push(L('    timeout was 2 seconds.')); } s.env.advance(8); break; }
    if (q.rcode === 'NOERROR' && q.answers && q.answers.length) {
      const hasType = q.answers.some(x => x.type === type || (type === 'A' && x.type === 'CNAME'));
      if (hasType) { nsFormatAnswers(q, type, c, server, !!q.authoritative).forEach(x => out.push(x)); if (type === 'SRV') q.answers.filter(x => x.type === 'SRV').forEach(x => { const host = x.data.split(/\s+/)[3].replace(/\.$/, ''); const a2 = N.dnsQuery(W, s.devId, server, host, 'A'); if (a2.state === 'ok' && a2.answers) a2.answers.filter(y => y.type === 'A').forEach(y => out.push(L(host + '\tinternet address = ' + y.data))); }); s.env.obs('resolve:' + s.devId + ':' + nameRaw, true); return { out, ok: true }; }
    }
    last = q;
    if (q.rcode === 'NXDOMAIN') continue;
    break;
  }
  const srvName = server;
  if (last && last.timeout) { out.push(L('*** Request to ' + (s.transient.nsName || 'UnKnown') + ' timed-out', 'e')); s.env.obs('resolve:' + s.devId + ':' + nameRaw, false); return { out, ok: false }; }
  const tail = last && last.rcode === 'NXDOMAIN' ? 'Non-existent domain' : last && last.rcode === 'REFUSED' ? 'Query refused' : last && last.rcode === 'SERVFAIL' ? 'Server failed' : 'No response from server';
  if (last && last.rcode === 'NOERROR') { out.push(L('*** ' + (s.transient.nsName || server) + ' ne parvient pas à trouver ' + nameRaw + ': No ' + (type === 'A' ? 'address' : 'records') + ' available', 'e')); }
  else out.push(L('*** ' + (s.transient.nsName || server) + ' ne parvient pas à trouver ' + nameRaw + ': ' + tail, 'e'));
  s.env.obs('resolve:' + s.devId + ':' + nameRaw, false);
  return { out, ok: false };
}
function nsHeader(s, server, label) {
  const pr = nsPrimary(s, server); s.transient.nsName = pr.name || 'UnKnown'; if (pr.timeout) s.env.advance(2);
  return pr.out.concat([L(label + (pr.name || 'UnKnown')), L('Address:  ' + server), L('')]);
}
C.nslookup = (s, a, o, r) => {
  const d = s.d, W = s.W; const args = a.filter(x => !/^-/.test(x)); const opts = a.filter(x => /^-/.test(x));
  let type = 'A'; opts.forEach(x => { const m = x.match(/^-(?:type|querytype|q)=(.+)$/i); if (m) type = m[1].toUpperCase(); });
  let servers = N.dnsServersOf(W, d); let server = args[1] || servers[0];
  if (args[1] && !U.isIP(args[1])) { const rs = N.resolve(W, d.id, args[1]); if (rs.ok) server = rs.ip; else { o.l('Serveur par défaut :  UnKnown'); o.l('Address:  ' + (servers[0] || '127.0.0.1')); o.blank(); o.l('*** UnKnown ne parvient pas à trouver ' + args[1] + ': Non-existent domain', 'e'); r.ok = false; return; } }
  if (!server) {
    U.av('nslookup-no-dns', 'nslookup sans serveur DNS configuré : sortie non vérifiée.');
    if (!args.length) { r.push = nsInteractive(s, null, type); o.l('Serveur par défaut :  UnKnown'); o.l('Address:  ::1'); o.blank(); return; }
    o.l('Serveur par défaut :  UnKnown'); o.l('Address:  ::1'); o.blank(); o.l('*** UnKnown ne parvient pas à trouver ' + args[0] + ': No response from server', 'e'); s.env.obs('resolve:' + d.id + ':' + args[0], false); r.ok = false; return;
  }
  if (!args.length) {
    const hdr = nsHeader(s, server, 'Serveur par défaut :  '); hdr.forEach(x => o.lines.push(x));
    s.sub = nsSub(s, server, type); r.interactive = true; return;
  }
  if (a[0] === '-?' || a[0] === '/?') { o.l('Utilisation :'); return; }
  nsHeader(s, server, 'Serveur :   ').forEach(x => o.lines.push(x));
  const q = nsQuery(s, server, args[0], type); q.out.forEach(x => o.lines.push(x)); if (!q.ok) r.ok = false;
};
function nsSub(s, server, type) {
  const st = { server, type, prompt: '> ' };
  st.exec = function (sh, line) {
    const out = new E.Out(); const t = line.trim();
    if (!t) return { out: [] };
    if (/^(exit|quit)$/i.test(t)) { sh.sub = null; return { out: [] }; }
    let m;
    if ((m = t.match(/^set\s+(type|querytype|q)\s*=\s*(\S+)$/i))) { st.type = m[2].toUpperCase(); return { out: [] }; }
    if (/^set\s+/i.test(t)) return { out: [] };
    if ((m = t.match(/^(?:server|lserver)\s+(\S+)$/i))) {
      let ip = m[1]; if (!U.isIP(ip)) { const rs = N.resolve(sh.W, sh.devId, ip); if (!rs.ok) { out.l('*** ' + (sh.transient.nsName || 'UnKnown') + ' ne parvient pas à trouver ' + ip + ': Non-existent domain', 'e'); return { out: out.lines }; } ip = rs.ip; }
      st.server = ip; nsHeader(sh, ip, 'Serveur par défaut :  ').forEach(x => out.lines.push(x)); return { out: out.lines };
    }
    if (/^(\?|help)$/i.test(t)) { out.l('Commandes :   (les identificateurs sont indiqués en majuscules, [] signifie facultatif)'); return { out: out.lines }; }
    const parts = t.split(/\s+/); const q = nsQuery(sh, st.server, parts[0], st.type);
    q.out.forEach(x => out.lines.push(x)); return { out: out.lines };
  };
  return st;
}
function nsInteractive(s, server, type) { return null; }

/* ------------------------------------------------------------------ tracert */
C.tracert = (s, a, o, r) => {
  const d = s.d, W = s.W; let noRes = false, maxH = 30, target = null;
  for (let i = 0; i < a.length; i++) { if (a[i] === '-d') noRes = true; else if (a[i] === '-h') maxH = +a[++i]; else if (a[i] === '-w' || a[i] === '-R' || a[i] === '-S') i++; else if (!/^-/.test(a[i])) target = a[i]; }
  if (!target) { o.l('Utilisation : tracert [-d] [-h nombre_maxi_sauts] [-j liste_hôtes] [-w délai_attente]'); o.l('                [-R] [-S srcaddr] [-4] [-6] nom_cible'); return; }
  let ip, label;
  if (U.isIP(target)) { ip = target; label = target; } else {
    const res = W_.resolveHost(s, target);
    if (!res.ok) { o.l('Impossible de résoudre le nom du système cible ' + target + '.'); s.env.obs('ping:' + d.id + ':' + target, false); r.ok = false; return; }
    ip = res.ip; label = (res.fqdn || target) + ' [' + ip + ']';
  }
  o.blank(); o.l('Détermination de l’itinéraire vers ' + label); o.l('avec un maximum de ' + maxH + ' sauts :'); o.blank();
  const t = N.trace(W, d.id, ip, { proto: 'icmp', icmpType: 8 }, {});
  const f = N.walk(W, d.id, ip, { proto: 'icmp', icmpType: 8 }, {});
  const hops = (f.hops || []).slice(1, f.ok ? -1 : undefined).filter(h => !h.final);
  const fmtMs = ms => E.padL(ms < 1 ? '<1 ms' : ms + ' ms', 9);
  const name = (hip) => { if (noRes) return hip; const n = W_.ptrName(s, hip); return n ? n + ' [' + hip + ']' : hip; };
  let n = 0;
  hops.forEach((h, idx) => { n++; const ms = 1 + idx; o.l(E.padL(n, 3) + fmtMs(ms) + fmtMs(ms) + fmtMs(ms) + '  ' + name(h.inIp), 'o', 300); });
  if (f.ok) {
    n++; const ms = hops.length + 1; o.l(E.padL(n, 3) + fmtMs(ms) + fmtMs(ms) + fmtMs(ms) + '  ' + (U.isIP(target) ? name(ip) : label), 'o', 300);
    o.blank(); o.l('Itinéraire déterminé.'); noteArp(s, ip); s.env.obs('ping:' + d.id + ':' + target, t.ok);
  } else {
    n++;
    if (f.icmp && f.icmp.from) { o.l(E.padL(n, 3) + '  ' + name(f.icmp.from) + '  signale : ' + (f.icmp.kind === 'net' ? 'Impossible de joindre le réseau de destination.' : 'Impossible de joindre l’hôte de destination.')); o.blank(); o.l('Itinéraire déterminé.'); }
    else {
      const maxShow = Math.min(maxH, n + 2);
      for (let k = n; k <= maxShow; k++) o.l(E.padL(k, 3) + '     *        *        *     Délai d’attente de la demande dépassé.', 'o', 600);
      o.blank(); if (maxShow >= maxH) o.l('Itinéraire déterminé.');
      s.env.advance(12);
    }
    s.env.obs('ping:' + d.id + ':' + target, false);
  }
};
C.pathping = C.tracert;

/* ------------------------------------------------------------------ netstat / arp / route */
W_.listenPorts = function (W, d) {
  const out = [['tcp', 135]]; const add = (proto, port) => { if (WIN.listening(W, d, proto, port, Object.keys(d.ifaces)[0])) out.push([proto, port]); };
  [['tcp', 445], ['tcp', 139], ['tcp', 88], ['udp', 88], ['tcp', 389], ['udp', 389], ['tcp', 464], ['tcp', 636], ['tcp', 3268], ['tcp', 53], ['udp', 53], ['udp', 67], ['tcp', 3389], ['udp', 123]].forEach(p => add(p[0], p[1]));
  if (d.win.iis && WIN.svcRunning(d, 'W3SVC')) { d.win.iis.sites.forEach(si => { if (si.state === 'started') si.bindings.forEach(b => { if (!out.some(x => x[0] === 'tcp' && x[1] === +b.port)) out.push(['tcp', +b.port]); }); }); }
  return out;
};
C.netstat = (s, a, o) => {
  const d = s.d, W = s.W; const fl = a.join(' ').toLowerCase();
  if (/-r/.test(fl)) { C.route(s, ['print'], o, {}); return; }
  o.blank(); o.l('Connexions actives'); o.blank(); o.l('  Proto  Adresse locale         Adresse distante       État');
  const rows = [];
  W_.listenPorts(W, d).sort((x, y) => x[1] - y[1]).forEach(([p, port]) => { if (p === 'tcp') rows.push('  TCP    0.0.0.0:' + E.padR(port, 15) + '0.0.0.0:0              LISTENING'); else rows.push('  UDP    0.0.0.0:' + E.padR(port, 15) + '*:*                    '); });
  (d._rt.conns || []).forEach(c => rows.push('  TCP    ' + E.padR(c.local, 22) + E.padR(c.remote, 23) + 'ESTABLISHED'));
  rows.forEach(x => o.l(x));
};
C.arp = (s, a, o, r) => {
  const d = s.d, W = s.W;
  if (!a.some(x => /^-a$|^-g$/i.test(x))) { if (a.some(x => /^-d$/i.test(x))) { d._rt.arp = {}; return; } o.l('Affiche et modifie les tables de traduction d’adresses IP en adresses physiques utilisées par'); o.l('le protocole de résolution d’adresses ARP.'); return; }
  const rows = [];
  N.l3up(W, d).forEach(l3 => {
    const ent = Object.keys(d._rt.arp || {}).filter(ip => U.inNet(ip, l3.ip, l3.mask));
    o.blank(); o.l('Interface : ' + l3.ip + ' --- 0x' + (6 + parseInt(U.hash8(d.id).slice(0, 1), 16) % 9).toString(16)); o.l('  Adresse Internet      Adresse physique      Type');
    ent.sort((x, y) => U.ip2n(x) - U.ip2n(y)).forEach(ip => o.l('  ' + E.padR(ip, 22) + E.padR(E.macDash(d._rt.arp[ip].mac).toLowerCase(), 22) + 'dynamique'));
    o.l('  ' + E.padR(U.bcast(l3.ip, l3.mask), 22) + E.padR('ff-ff-ff-ff-ff-ff', 22) + 'statique'); o.l('  ' + E.padR('224.0.0.22', 22) + E.padR('01-00-5e-00-00-16', 22) + 'statique'); o.l('  ' + E.padR('224.0.0.251', 22) + E.padR('01-00-5e-00-00-fb', 22) + 'statique'); o.l('  ' + E.padR('255.255.255.255', 22) + E.padR('ff-ff-ff-ff-ff-ff', 22) + 'statique');
  });
  if (!N.l3up(W, d).length) o.l('Aucune entrée ARP trouvée.');
};
C.route = (s, a, o, r) => {
  const d = s.d, W = s.W;
  if (!a.some(x => /^print$/i.test(x))) {
    if (!s.elevated) { o.l('L’opération demandée nécessite une élévation.', 'e'); r.ok = false; return; }
    const verb = lc(a[0] || '');
    if (verb === 'add') {
      const dest = a[1], mi = a.findIndex(x => lc(x) === 'mask'), mask = mi >= 0 ? a[mi + 1] : '255.255.255.255', gw = a[mi >= 0 ? mi + 2 : 2];
      if (!U.isIP(dest) || !U.isIP(gw)) { o.l('La syntaxe de la commande est incorrecte.', 'e'); r.ok = false; return; }
      const on = N.l3up(W, d).find(x => U.inNet(gw, x.ip, x.mask));
      if (!on) { o.l('Échec de l’ajout de l’itinéraire : le chemin d’accès spécifié est introuvable.', 'e'); r.ok = false; return; }
      d.routes = d.routes || []; d.routes.push({ net: dest, mask, nh: gw }); s.env.touch('route'); r.mutated = true; o.l(' OK!'); return;
    }
    if (verb === 'delete') { const dest = a[1]; d.routes = (d.routes || []).filter(x => x.net !== dest); s.env.touch('route'); r.mutated = true; o.l(' OK!'); return; }
    o.l('Manipule les tables de routage du réseau.'); return;
  }
  o.l('==========================================================================='); o.l('Liste d’interfaces');
  W_.ifaceNames(d).forEach((n, i) => o.l(E.padL(6 + i, 3) + '...' + E.macDash(d.ifaces[n].mac).toLowerCase().replace(/-/g, ' ') + ' ......' + W_.nicDesc));
  o.l('  1...........................Software Loopback Interface 1'); o.l('==========================================================================='); o.blank();
  o.l('IPv4 Table de routage'); o.l('==========================================================================='); o.l('Itinéraires actifs :');
  o.l('Destination réseau    Masque réseau  Adr. passerelle   Adr. interface Métrique');
  const rows = []; const l3 = N.l3up(W, d);
  N.routes(W, d).forEach(rt => { const ifc = l3.find(x => x.name === rt.iface); rows.push([rt.net, rt.mask, rt.nh || 'On-link', ifc ? ifc.ip : '', rt.def ? 281 : 281]); });
  l3.forEach(x => { rows.push(['127.0.0.0', '255.0.0.0', 'On-link', '127.0.0.1', 331]); });
  l3.forEach(x => { rows.push([x.ip, '255.255.255.255', 'On-link', x.ip, 281]); rows.push([U.bcast(x.ip, x.mask), '255.255.255.255', 'On-link', x.ip, 281]); });
  const seen = new Set();
  rows.sort((p, q) => U.ip2n(p[0]) - U.ip2n(q[0])).forEach(rw => { const k = rw.join('|'); if (seen.has(k)) return; seen.add(k); o.l(E.padL(rw[0], 17) + E.padL(rw[1], 17) + E.padL(rw[2], 17) + E.padL(rw[3], 17) + E.padL(rw[4], 7)); });
  o.l('==========================================================================='); o.l('Itinéraires persistants :'); o.l('  Aucun');
};

/* ------------------------------------------------------------------ curl */
U.av('curl-win-errors', 'Messages d’erreur de curl.exe sous Windows (schannel) : formulation exacte non vérifiée pour les erreurs de certificat.');
E.curlError = function (res, host, flavor) {
  if (res.err === 'dns') return 'curl: (6) Could not resolve host: ' + host;
  if (res.err === 'refused') return 'curl: (7) Failed to connect to ' + host + ' port ' + (res.port || '') + ' after 0 ms: Connection refused';
  if (res.err === 'timeout') return 'curl: (7) Failed to connect to ' + host + ' port ' + (res.port || '') + ' after 21045 ms: Couldn\'t connect to server';
  if (res.err === 'tls') {
    if (flavor === 'win') return 'curl: (35) schannel: SEC_E_UNTRUSTED_ROOT (0x80090325) - ' + (res.errCode === 'ERR_CERT_DATE_INVALID' ? 'Le certificat a expiré.' : res.errCode === 'ERR_CERT_COMMON_NAME_INVALID' ? 'Le nom du certificat ne correspond pas au nom d’hôte.' : 'La chaîne de certificats a été fournie par une autorité qui n’est pas approuvée.');
    if (res.errCode === 'ERR_CERT_DATE_INVALID') return 'curl: (60) SSL certificate problem: certificate has expired';
    if (res.errCode === 'ERR_CERT_COMMON_NAME_INVALID') return 'curl: (60) SSL: no alternative certificate subject name matches target host name \'' + host + '\'';
    return 'curl: (60) SSL certificate problem: unable to get local issuer certificate';
  }
  if (res.err === 'redirect-loop') return 'curl: (47) Maximum (50) redirects followed';
  return 'curl: (56) Failure with receive data from peer';
};
E.curlRun = function (s, a, o, r, flavor) {
  const d = s.d; let url = null, head = false, insecure = false, silent = false, verbose = false;
  for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-I' || x === '--head') head = true; else if (x === '-k' || x === '--insecure') insecure = true; else if (x === '-s' || x === '--silent') silent = true; else if (x === '-v' || x === '-i') verbose = true; else if (x === '-L' || x === '-sS' || x === '-o' || x === '-m' || x === '--max-time' || x === '--connect-timeout') { if (x === '-o' || x === '-m' || x === '--max-time' || x === '--connect-timeout') i++; } else if (!/^-/.test(x)) url = x; }
  if (!url) { o.l('curl: try \'curl --help\' or \'curl --manual\' for more information', 'e'); r.ok = false; return; }
  const pu = WEB.parseUrl(url); if (!pu) { o.l('curl: (3) URL using bad/illegal format or missing URL', 'e'); r.ok = false; return; }
  const res = WEB.fetch(s.W, d.id, url, { ignoreTls: insecure, noCache: false });
  s.env.advance(res.err === 'timeout' ? 21 : 1);
  s.env.obs('http:' + d.id + ':' + url, !!res.ok);
  if (res.err) { o.l(E.curlError(Object.assign({ port: pu.port }, res), pu.host, flavor), 'e'); r.ok = false; return; }
  const srvName = res.serverKind === 'iis' ? 'Microsoft-IIS/10.0' : res.serverKind === 'pfsense' ? 'nginx' : U.av('http-server-banner', 'Apache/2.4 (Debian) ou nginx/1.x : numéros de version exacts non vérifiés');
  const proto = verbose || head ? 'HTTP/1.1 ' + res.status + ' ' + (res.status === 200 ? 'OK' : res.error && res.error.title ? res.error.title : '') : '';
  if (head || verbose) { o.l(proto); o.l('Content-Type: text/html'); o.l('Server: ' + srvName); o.l('Date: ' + new Date(s.W.nowOf(d.id)).toUTCString()); o.blank(); }
  if (head) return;
  const body = res.page ? (res.page.html || '') : res.error ? '<html><head><title>' + res.error.code + ' - ' + res.error.title + '</title></head><body>' + res.error.detail + '</body></html>' : '';
  if (!silent || body) o.l(body);
  if (!res.ok) r.ok = res.status < 400;
};
C.curl = (s, a, o, r) => E.curlRun(s, a, o, r, 'win');

/* ------------------------------------------------------------------ ssh (client OpenSSH de Windows) */
C.ssh = (s, a, o, r) => { if (!E.sshCommand) { o.l('ssh : indisponible', 'e'); return; } return E.sshCommand(s, a, o, r, 'win'); };
C.scp = (s, a, o, r) => { o.l('scp : transfert non pris en charge dans cette simulation', 'e'); r.ok = false; };
C.mstsc = (s, a, o, r) => { r.launch = [{ app: 'mstsc', arg: a.join(' ') }]; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
