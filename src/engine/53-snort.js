/* ============================================================================
   IDS / IPS Snort sur pfSense (paquet « snort »).
   Modèle de configuration (sur l'appareil pfSense) :
     d.snort = {
       ifaces: [{ iface:'wan', enabled, stopped, descr, block, blockWhich:'src'|'dst'|'both', ips:'legacy',
                  homeNet:'default'|'custom', homeNetList:[cidr], passList:'default'|'none'|<nom>,
                  syslog, custom:'texte de custom.rules' }],
       passLists: [{ name, addrs:[ip|cidr] }],
       global: { community, etopen, vrt }               // réglages affichés ; sans effet sur la détection
     }
     d.snortBlocked = [{ ip, ifk, sid, msg, t }]        // table « snort2c » : persistante, exclue de tout trafic
   Les symptômes ne sont jamais écrits : chaque paquet qui arrive sur une interface du pare-feu (ou en sort) est
   inspecté par l'instance Snort de cette interface si elle est démarrée ; les règles de custom.rules sont
   interprétées (sous-ensemble de la syntaxe Snort, voir LIMITES) ; une alerte peut bloquer l'adresse
   source / destination (mode « Legacy », « Block Offenders ») sauf si elle figure dans la liste de passage ;
   pf rejette ensuite tout trafic depuis / vers une adresse bloquée.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, K = SIM.kinds;
const SN = SIM.snort = {};
U.av('snort-rule-syntax', 'Snort : liste des options de règle reconnues, messages d’erreur au démarrage (texte propre à ce jeu, pas celui de Snort) et variables $HOME_NET / $EXTERNAL_NET seules prises en charge — à comparer à une capture du journal de démarrage de Snort sous pfSense.');
U.av('snort-default-passlist', 'Snort sous pfSense : contenu exact de la liste de passage « default » et de la valeur « default » de HOME_NET (ici : adresses et sous-réseaux des interfaces, passerelles, serveurs DNS, routes statiques et réseaux VPN) — à vérifier sur capture (écrans Pass Lists et Interface Settings).');
U.av('snort-classtypes', 'Snort : libellés et priorités par défaut des classtype (classification.config) — repris de mémoire pour une dizaine de classtype ; une valeur absente de la table est affichée telle quelle.');
U.av('snort-block-legacy', 'Snort sous pfSense, mode Legacy : toute alerte d’une interface avec « Block Offenders » inscrit l’adresse source (ou destination, ou les deux) dans la table snort2c, sauf adresse de la liste de passage ; libellé du journal de pare-feu pour ce blocage reconstitué.');

SN.PKG = 'snort';
SN.CLASSES = {
  'misc-activity': ['Misc activity', 3], 'attempted-recon': ['Attempted Information Leak', 2], 'attempted-admin': ['Attempted Administrator Privilege Gain', 1],
  'attempted-user': ['Attempted User Privilege Gain', 1], 'bad-unknown': ['Potentially Bad Traffic', 2], 'network-scan': ['Detection of a Network Scan', 3],
  'icmp-event': ['Generic ICMP event', 3], 'policy-violation': ['Potential Corporate Privacy Violation', 1], 'trojan-activity': ['A Network Trojan was detected', 1],
  'web-application-attack': ['Web Application Attack', 1], 'attempted-dos': ['Attempted Denial of Service', 2], 'not-suspicious': ['Not Suspicious Traffic', 3]
};
const ACTIONS = ['alert', 'log', 'pass', 'drop', 'reject', 'sdrop', 'activate', 'dynamic'];
const PROTOS = ['tcp', 'udp', 'icmp', 'ip'];
/* options comprises par Snort ; seules les « évaluables » le sont par le jeu (pas de contenu de paquet) */
const OPT_EVAL = ['msg', 'sid', 'rev', 'gid', 'classtype', 'priority', 'reference', 'metadata', 'itype', 'icode', 'flags', 'flow'];
const OPT_DEAD = ['content', 'pcre', 'uricontent', 'nocase', 'offset', 'depth', 'distance', 'within', 'rawbytes', 'http_uri', 'http_header', 'http_method', 'http_client_body', 'http_cookie', 'fast_pattern', 'byte_test', 'byte_jump', 'isdataat', 'dsize', 'ttl', 'tos', 'id', 'ipopts', 'fragbits', 'fragoffset', 'seq', 'ack', 'window', 'threshold', 'detection_filter', 'tag', 'sameip', 'stream_size', 'stream_reassemble', 'resp', 'react', 'replace', 'ip_proto', 'ftpbounce', 'asn1', 'cvs', 'sd_pattern', 'file_data', 'pkt_data', 'base64_decode', 'base64_data', 'service', 'rpc', 'session', 'logto', 'activates', 'activated_by', 'count', 'flowbits', 'ssl_state', 'ssl_version', 'urilen'];

SN.pkg = d => (d.packages || []).find(p => p.name === SN.PKG) || null;
SN.cfg = (d, ifk) => ((d.snort && d.snort.ifaces) || []).find(s => s.iface === ifk) || null;

/* ------------------------------------------------------------------ analyse d'une règle */
const splitTop = (s, sep) => { const out = []; let cur = '', q = false, esc = false; for (const ch of s) { if (esc) { cur += ch; esc = false; continue; } if (ch === '\\') { cur += ch; esc = true; continue; } if (ch === '"') q = !q; if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const parseAddrItem = tok => {
  let neg = false; tok = tok.trim(); if (tok[0] === '!') { neg = true; tok = tok.slice(1); }
  if (tok === 'any') return { any: true, neg };
  if (tok[0] === '$') { const v = tok.slice(1); if (v !== 'HOME_NET' && v !== 'EXTERNAL_NET') return { err: 'variable ' + tok + ' non définie' }; return { neg, v }; }
  if (/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(tok)) {
    const c = tok.indexOf('/') < 0 ? tok + '/32' : tok; const len = +c.split('/')[1]; const ip = c.split('/')[0];
    if (!U.isIP(ip) || len < 0 || len > 32) return { err: 'adresse invalide : ' + tok };
    return { neg, cidr: c };
  }
  return { err: 'adresse invalide : ' + tok };
};
const parseAddr = spec => {
  spec = spec.trim(); let body = spec;
  if (body[0] === '!' && body[1] === '[') return { err: 'liste niée non prise en charge : ' + spec };
  if (body[0] === '[') { if (body[body.length - 1] !== ']') return { err: 'liste d’adresses non fermée : ' + spec }; body = body.slice(1, -1); const items = body.split(',').map(parseAddrItem); const e = items.find(x => x.err); return e ? { err: e.err } : { items }; }
  const it = parseAddrItem(body); return it.err ? { err: it.err } : { items: [it] };
};
const parsePortItem = tok => {
  let neg = false; tok = tok.trim(); if (tok[0] === '!') { neg = true; tok = tok.slice(1); }
  if (tok === 'any') return { any: true, neg };
  let m;
  if ((m = /^(\d+)$/.exec(tok))) return +m[1] > 65535 ? { err: 'port invalide : ' + tok } : { neg, lo: +m[1], hi: +m[1] };
  if ((m = /^(\d*):(\d*)$/.exec(tok))) { const lo = m[1] === '' ? 0 : +m[1], hi = m[2] === '' ? 65535 : +m[2]; if (hi > 65535 || lo > hi) return { err: 'plage de ports invalide : ' + tok }; return { neg, lo, hi }; }
  return { err: 'port invalide : ' + tok };
};
const parsePorts = spec => {
  spec = spec.trim(); let body = spec;
  if (body[0] === '[') { if (body[body.length - 1] !== ']') return { err: 'liste de ports non fermée : ' + spec }; body = body.slice(1, -1); }
  const items = body.split(',').map(parsePortItem); const e = items.find(x => x.err); return e ? { err: e.err } : { items };
};

SN.parseRules = function (text) {
  const out = { rules: [], errors: [] };
  const raw = String(text || '').split(/\r?\n/); const lines = [];
  for (let i = 0; i < raw.length; i++) { let l = raw[i], n = i + 1; while (/\\\s*$/.test(l) && i + 1 < raw.length) { l = l.replace(/\\\s*$/, '') + raw[++i].trim(); } lines.push({ n, t: l.trim() }); }
  for (const L of lines) {
    if (!L.t || L.t[0] === '#') continue;
    const fail = m => out.errors.push({ line: L.n, msg: m });
    const hp = L.t.indexOf('(');
    if (hp < 0) { fail('options absentes ou parenthèse ouvrante manquante'); continue; }
    if (L.t[L.t.length - 1] !== ')') { fail('parenthèse fermante manquante à la fin de la règle'); continue; }
    const head = L.t.slice(0, hp).trim().replace(/\[[^\]]*\]/g, m => m.replace(/\s+/g, '')); const body = L.t.slice(hp + 1, -1);
    const h = head.split(/\s+/);
    if (h.length !== 7) { fail('en-tête de règle incomplet (attendu : action protocole source port -> destination port)'); continue; }
    const [action, proto, src, sport, dir, dst, dport] = h;
    if (ACTIONS.indexOf(action) < 0) { fail('action inconnue « ' + action + ' »'); continue; }
    if (PROTOS.indexOf(proto) < 0) { fail('protocole inconnu « ' + proto + ' »'); continue; }
    if (dir !== '->' && dir !== '<>') { fail('opérateur de direction invalide « ' + dir + ' »'); continue; }
    const as = parseAddr(src), ad = parseAddr(dst); if (as.err) { fail(as.err); continue; } if (ad.err) { fail(ad.err); continue; }
    const ps = parsePorts(sport), pd = parsePorts(dport); if (ps.err) { fail(ps.err); continue; } if (pd.err) { fail(pd.err); continue; }
    const r = { line: L.n, action, proto, dir, src: as, dst: ad, sport: ps, dport: pd, opts: {}, dead: null, text: L.t };
    let bad = false;
    for (const part of splitTop(body, ';')) {
      const p = part.trim(); if (!p) continue;
      const ci = p.indexOf(':'); const key = (ci < 0 ? p : p.slice(0, ci)).trim().toLowerCase(); let val = ci < 0 ? '' : p.slice(ci + 1).trim();
      if (OPT_EVAL.indexOf(key) < 0 && OPT_DEAD.indexOf(key) < 0) { fail('option inconnue « ' + key + ' »'); bad = true; break; }
      if (key === 'msg') { if (!/^".*"$/.test(val)) { fail('msg doit être entre guillemets'); bad = true; break; } val = val.slice(1, -1); }
      if (key === 'sid' || key === 'rev' || key === 'priority' || key === 'gid') { if (!/^\d+$/.test(val)) { fail(key + ' doit être un nombre'); bad = true; break; } }
      if (key === 'classtype' && !/^[a-z-]+$/.test(val)) { fail('classtype invalide'); bad = true; break; }
      if (OPT_DEAD.indexOf(key) >= 0 && !r.dead) r.dead = 'option « ' + key + ' » non évaluée par le simulateur (aucun contenu de paquet simulé)';
      r.opts[key] = val;
    }
    if (bad) continue;
    if (r.opts.flags !== undefined && proto !== 'tcp') r.dead = r.dead || 'flags n’a de sens que pour TCP';
    out.rules.push(r);
  }
  return out;
};
/* analyse mise en cache par texte */
SN.parsed = function (si) { const t = si.custom || ''; if (!si._pc || si._pc.t !== t) Object.defineProperty(si, '_pc', { value: { t, p: SN.parseRules(t) }, enumerable: false, writable: true, configurable: true }); return si._pc.p; };

/* ------------------------------------------------------------------ contexte d'une interface */
const cidrOf = (ip, mask) => U.netAddr(ip, mask) + '/' + U.mask2len(mask);
const validCidr = s => { try { const m = /^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+))?$/.exec(String(s).trim()); if (!m || !U.isIP(m[1])) return null; const len = m[2] === undefined ? 32 : +m[2]; if (len < 0 || len > 32) return null; return U.netAddr(m[1], U.len2mask(len)) + '/' + len; } catch (e) { return null; } };
SN.wanIfaces = d => (d.gateways || []).filter(x => x.default).map(x => x.iface);
/* adresses « locales » du pare-feu (interfaces, passerelles, DNS, routes statiques, VPN) */
SN.localNets = function (d, includeWan) {
  const out = []; const wans = SN.wanIfaces(d);
  Object.keys(d.ifaces || {}).forEach(k => { const i = d.ifaces[k]; if (!i.ip || !i.mask || k === 'enc0') return; if (includeWan || wans.indexOf(k) < 0) out.push(cidrOf(i.ip, i.mask)); });
  (d.routes || []).forEach(r => { if (!r.disabled && r.net && r.mask) out.push(cidrOf(r.net, r.mask)); });
  ((d.openvpn && d.openvpn.servers) || []).forEach(s => { if (s.tunnelNet) out.push(s.tunnelNet); });
  return out;
};
SN.homeNet = function (d, si) {
  if (si.homeNet === 'custom') return (si.homeNetList || []).map(validCidr).filter(Boolean);
  const i = d.ifaces[si.iface]; const out = [];
  if (i && i.ip && i.mask) out.push(cidrOf(i.ip, i.mask));
  (d.routes || []).forEach(r => { if (r.disabled || !r.nh || !i || !i.ip) return; if (U.inNet(r.nh, i.ip, i.mask)) out.push(cidrOf(r.net, r.mask)); });
  return out;
};
SN.passSet = function (d, si) {
  if (si.passList === 'none') return [];
  if (si.passList && si.passList !== 'default') { const l = ((d.snort && d.snort.passLists) || []).find(x => x.name === si.passList); return l ? (l.addrs || []).map(validCidr).filter(Boolean) : []; }
  const out = [];
  Object.keys(d.ifaces || {}).forEach(k => { const i = d.ifaces[k]; if (i.ip && k !== 'enc0') out.push(i.ip + '/32'); });
  (d.gateways || []).forEach(x => { if (x.ip) out.push(x.ip + '/32'); });
  ((d.dns && d.dns.servers) || []).forEach(x => { if (U.isIP(x)) out.push(x + '/32'); });
  return out.concat(SN.localNets(d, false));
};
SN.inList = (ip, list) => list.some(c => { try { return U.inCidr(ip, c); } catch (e) { return false; } });

/* ------------------------------------------------------------------ état du service (par interface) */
SN.state = function (d, si) {
  const p = SN.pkg(d);
  if (!d.snort || !p) return { run: false, why: 'paquet absent' };
  if (p.broken) return { run: false, why: 'paquet incomplet' };
  if (!si) return { run: false, why: 'aucune instance sur cette interface' };
  if (!d.ifaces[si.iface]) return { run: false, why: 'interface inexistante' };
  if (!si.enabled) return { run: false, why: 'interface désactivée' };
  if (si.stopped) return { run: false, why: 'arrêté' };
  if (si.homeNet === 'custom' && !SN.homeNet(d, si).length) return { run: false, why: 'HOME_NET personnalisé vide ou invalide' };
  const pr = SN.parsed(si);
  if (pr.errors.length) return { run: false, why: 'erreur dans custom.rules, ligne ' + pr.errors[0].line + ' : ' + pr.errors[0].msg };
  return { run: true, why: 'démarré' };
};

/* ------------------------------------------------------------------ correspondance d'une règle avec un paquet */
const addrHit = (spec, ip, vars) => {
  const pos = [], neg = [];
  for (const it of spec.items) {
    let m;
    if (it.any) m = true;
    else if (it.v === 'HOME_NET') m = SN.inList(ip, vars.home);
    else if (it.v === 'EXTERNAL_NET') m = !SN.inList(ip, vars.home);
    else m = SN.inList(ip, [it.cidr]);
    (it.neg ? neg : pos).push(m);
  }
  return (pos.length ? pos.some(Boolean) : true) && !neg.some(Boolean);
};
const portHit = (spec, port) => {
  const pos = [], neg = [];
  for (const it of spec.items) { const m = it.any ? true : (port !== undefined && port >= it.lo && port <= it.hi); (it.neg ? neg : pos).push(m); }
  return (pos.length ? pos.some(Boolean) : true) && !neg.some(Boolean);
};
const numCmp = (spec, v) => { if (v === undefined) return false; let m; if ((m = /^(\d+)<>(\d+)$/.exec(spec))) return v > +m[1] && v < +m[2]; if ((m = /^>(\d+)$/.exec(spec))) return v > +m[1]; if ((m = /^<(\d+)$/.exec(spec))) return v < +m[1]; if ((m = /^(\d+)$/.exec(spec))) return v === +m[1]; return false; };
SN.ruleHit = function (r, pkt, st, vars) {
  if (r.dead) return false;
  if (r.proto !== 'ip' && r.proto !== pkt.proto) return false;
  const fwd = addrHit(r.src, st.sip, vars) && addrHit(r.dst, st.dip, vars) && (pkt.proto === 'icmp' || r.proto === 'ip' || (portHit(r.sport, pkt.sport) && portHit(r.dport, pkt.dport)));
  const rev = r.dir === '<>' && addrHit(r.src, st.dip, vars) && addrHit(r.dst, st.sip, vars) && (pkt.proto === 'icmp' || r.proto === 'ip' || (portHit(r.sport, pkt.dport) && portHit(r.dport, pkt.sport)));
  if (!fwd && !rev) return false;
  const o = r.opts;
  if (pkt.proto === 'icmp') {
    const t = pkt.icmpType === undefined ? 8 : pkt.icmpType;
    if (o.itype !== undefined && !numCmp(o.itype, t)) return false;
    if (o.icode !== undefined && !numCmp(o.icode, 0)) return false;
  } else if (o.itype !== undefined || o.icode !== undefined) return false;
  if (o.flags !== undefined) {
    const f = o.flags.replace(/[+*!,\s].*$/, '').toUpperCase();
    if (pkt.proto !== 'tcp') return false;
    if (f === 'S') { if (pkt.reply) return false; }
    else if (f === 'SA') { if (!pkt.reply) return false; }
    else if (f === 'A') { if (!pkt.reply) return false; }
    else return false;
  }
  if (o.flow !== undefined) {
    const f = o.flow.toLowerCase().split(',').map(x => x.trim());
    if (f.indexOf('to_server') >= 0 && pkt.reply) return false;
    if (f.indexOf('from_server') >= 0 && !pkt.reply) return false;
    if (f.indexOf('established') >= 0 && !pkt.reply) return false;
  }
  return true;
};

/* ------------------------------------------------------------------ inspection d'un paquet sur une interface
   opts.snort (objet {alerts:[], blocks:[]}) collecte sans modifier l'état quand opts.dry est vrai. */
SN.inspect = function (W, d, ifk, pkt, st, opts) {
  opts = opts || {};
  if (!d.snort || !SN.pkg(d)) return;
  const si = SN.cfg(d, ifk); if (!si || !SN.state(d, si).run) return;
  const vars = { home: SN.homeNet(d, si) };
  const pr = SN.parsed(si); const hits = [];
  for (const r of pr.rules) if (SN.ruleHit(r, pkt, st, vars)) hits.push(r);
  if (!hits.length || hits.some(r => r.action === 'pass')) return;
  const pass = SN.passSet(d, si);
  const t = W.nowOf(d.id).getTime();
  for (const r of hits) {
    if (r.action === 'log' || r.action === 'activate' || r.action === 'dynamic') continue;
    const cls = r.opts.classtype ? (SN.CLASSES[r.opts.classtype] || [r.opts.classtype, 3]) : ['', 3];
    const a = { t, ifk, ifname: (d.ifaces[ifk] || {}).name || ifk, proto: pkt.proto, src: st.sip, sport: pkt.proto === 'icmp' ? undefined : pkt.sport, dst: st.dip, dport: pkt.proto === 'icmp' ? undefined : pkt.dport, sid: r.opts.sid ? +r.opts.sid : 0, gid: r.opts.gid ? +r.opts.gid : 1, rev: r.opts.rev ? +r.opts.rev : 1, msg: r.opts.msg || '', cls: cls[0], pri: r.opts.priority ? +r.opts.priority : cls[1], action: r.action };
    if (opts.snort) opts.snort.alerts.push(a);
    if (!opts.dry) { const l = d._rt.snortAlerts = d._rt.snortAlerts || []; l.push(a); if (l.length > 400) l.shift(); }
    if (!si.block) continue;
    const ips = si.blockWhich === 'dst' ? [st.dip] : si.blockWhich === 'both' ? [st.sip, st.dip] : [st.sip];
    for (const ip of ips) {
      if (SN.inList(ip, pass)) continue;
      if ((d.snortBlocked || []).some(b => b.ip === ip)) continue;
      if (opts.snort && opts.snort.blocks.some(b => b.ip === ip)) continue;
      const e = { ip, ifk, sid: a.sid, msg: a.msg, t };
      if (opts.snort) opts.snort.blocks.push(e);
      if (!opts.dry) { d.snortBlocked = d.snortBlocked || []; d.snortBlocked.push(e); W.touch('snort'); }
    }
  }
};
/* paquet vers / depuis une adresse inscrite dans la table snort2c */
SN.blockedHit = function (d, st) {
  const l = d.snortBlocked; if (!l || !l.length) return null;
  return l.find(b => b.ip === st.sip || b.ip === st.dip) || null;
};

/* ------------------------------------------------------------------ crochets du pare-feu */
SN.ingress = function (W, d, ifk, pkt, st, opts) {
  if (!d.snort) return null;
  const pre = SN.blockedHit(d, st);
  SN.inspect(W, d, ifk, pkt, st, opts);
  if (pre) {
    if (!(opts && opts.dry) && SIM.pf && SIM.pf.fwlog) SIM.pf.fwlog(W, d, ifk, 'block', pkt, st, 'Snort block table (snort2c)', null);
    return { drop: 'fw', detail: 'snort2c' };
  }
  return null;
};
SN.egress = function (W, d, outIf, pkt, st, opts) { if (d.snort) SN.inspect(W, d, outIf, pkt, st, opts); };

/* ------------------------------------------------------------------ rejeu à blanc d'un flux (sondes) :
   renvoie {alerts, blocks, trace} sans modifier la table des hôtes bloqués ni le journal */
SN.dryFlow = function (W, flow) {
  const col = { alerts: [], blocks: [] }; const opts = { dry: true, snort: col };
  let r;
  if (flow.proto === 'icmp') r = N.ping(W, flow.from, flow.to, opts);
  else r = N.connect(W, flow.from, flow.to, flow.proto || 'tcp', flow.port, opts);
  return { alerts: col.alerts, blocks: col.blocks, reached: !!(r && (r.ok || r.state === 'open')), r };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
