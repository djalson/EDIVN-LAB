/* ============================================================================
   EDIVN-LAB — noyau : utilitaires, PRNG déterministe, IPv4, chemins d'état.
   Aucune dépendance DOM : ce fichier est exécutable sous Node (tests).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM = g.SIM || {};
const U = SIM.U = {};

/* ---------- Registre des chaînes « à vérifier » (D-13 / règle projet) ----------
   Toute sortie dont l'exactitude n'est pas certaine passe par AV(tag, texte).
   build.js extrait les appels AV( pour produire docs/A-VERIFIER.md. */
SIM.AVREG = {};
U.av = function (tag, str) { SIM.AVREG[tag] = str; return str; };

/* ---------- Divers ---------- */
U.clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
U.esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
U.pad2 = n => String(n).padStart(2, '0');
U.fmtTime = sec => U.pad2(Math.floor(sec / 60)) + ':' + U.pad2(sec % 60);
U.isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
U.uniq = a => [...new Set(a)];
U.sleep = ms => new Promise(r => setTimeout(r, ms));
U.fmtDateFR = d => U.pad2(d.getDate()) + '/' + U.pad2(d.getMonth() + 1) + '/' + d.getFullYear();
U.fmtTimeFR = d => U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes()) + ':' + U.pad2(d.getSeconds());

/* ---------- PRNG sfc32 + hash cyrb128 (déterminisme D-43) ---------- */
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
U.rng = function (seed) {
  let [a, b, c, d] = cyrb128(String(seed));
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  const r = { next };
  r.int = n => Math.floor(next() * n);
  r.pick = arr => arr[Math.floor(next() * arr.length)];
  r.chance = p => next() < p;
  r.shuffle = arr => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return r;
};

/* ---------- IPv4 ---------- */
U.isIP = s => typeof s === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every(x => +x <= 255);
U.ip2n = ip => ip.split('.').reduce((a, o) => (a * 256 + (+o)), 0);
U.n2ip = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
U.len2mask = l => l === 0 ? '0.0.0.0' : U.n2ip((0xFFFFFFFF << (32 - l)) >>> 0);
U.mask2len = m => { const n = U.ip2n(m); let l = 0; for (let i = 31; i >= 0; i--) { if ((n >>> i) & 1) l++; else break; } return l; };
U.validMask = m => { if (!U.isIP(m)) return false; const n = U.ip2n(m); const inv = (~n) >>> 0; return ((inv + 1) & inv) === 0; };
U.netAddr = (ip, mask) => U.n2ip((U.ip2n(ip) & U.ip2n(mask)) >>> 0);
U.bcast = (ip, mask) => U.n2ip(((U.ip2n(ip) & U.ip2n(mask)) | (~U.ip2n(mask) >>> 0)) >>> 0);
U.inNet = (ip, net, mask) => U.isIP(ip) && U.isIP(net) && ((U.ip2n(ip) & U.ip2n(mask)) >>> 0) === ((U.ip2n(net) & U.ip2n(mask)) >>> 0);
U.sameNet = (a, b, mask) => U.inNet(a, b, mask);
U.isPrivate = ip => U.inNet(ip, '10.0.0.0', '255.0.0.0') || U.inNet(ip, '172.16.0.0', '255.240.0.0') || U.inNet(ip, '192.168.0.0', '255.255.0.0') || U.inNet(ip, '192.5.0.0', '255.255.0.0');
U.isApipa = ip => U.inNet(ip, '169.254.0.0', '255.255.0.0');
U.parseCidr = s => { const [n, l] = s.split('/'); const len = +l; return { net: U.netAddr(n, U.len2mask(len)), mask: U.len2mask(len), len }; };
U.inCidr = (ip, cidr) => { const c = U.parseCidr(cidr); return U.inNet(ip, c.net, c.mask); };
U.wild2mask = w => U.n2ip((~U.ip2n(w)) >>> 0);
U.mask2wild = m => U.n2ip((~U.ip2n(m)) >>> 0);
U.wildMatch = (ip, addr, wild) => { const m = (~U.ip2n(wild)) >>> 0; return ((U.ip2n(ip) & m) >>> 0) === ((U.ip2n(addr) & m) >>> 0); };
U.ipRange = (a, b) => { const out = []; for (let n = U.ip2n(a); n <= U.ip2n(b); n++) out.push(U.n2ip(n)); return out; };
U.ipInRange = (ip, a, b) => { const n = U.ip2n(ip); return n >= U.ip2n(a) && n <= U.ip2n(b); };

/* ---------- Accès par chemin : a.b[id=x].c  |  a.b[2].c  |  a.b.2.c ---------- */
function tokens(path) {
  const out = []; const re = /\['([^']*)'\]|([^.\[\]]+)|\[([^\]=]+)=([^\]]*)\]|\[(\d+)\]/g; let m;
  while ((m = re.exec(path))) {
    if (m[1] !== undefined) out.push({ k: m[1] });                       // clé entre apostrophes : ['GigabitEthernet0/1.20']
    else if (m[2] !== undefined) out.push({ k: m[2] });
    else if (m[3] !== undefined) out.push({ sel: m[3], val: m[4] });
    else out.push({ k: m[5] });
  }
  return out;
}
/* Sécurité : un chemin issu d'un scénario importé ne doit jamais atteindre le prototype des objets
   (pollution de prototype) : ces clés sont refusées, en lecture comme en écriture. */
const badKey = k => k === '__proto__' || k === 'constructor' || k === 'prototype';
function step(cur, t, create) {
  if (cur == null) return undefined;
  if (t.k !== undefined && badKey(String(t.k))) throw new Error('chemin interdit : ' + t.k);
  if (t.sel !== undefined) {
    if (!Array.isArray(cur)) return undefined;
    return cur.find(x => x && String(x[t.sel]) === t.val);
  }
  if (cur[t.k] === undefined && create) cur[t.k] = {};
  return cur[t.k];
}
U.pget = (obj, path) => { let cur = obj; for (const t of tokens(path)) { cur = step(cur, t, false); if (cur === undefined) return undefined; } return cur; };
U.pset = (obj, path, val) => {
  const ts = tokens(path); let cur = obj;
  for (let i = 0; i < ts.length - 1; i++) { cur = step(cur, ts[i], true); if (cur === undefined) throw new Error('pset: chemin introuvable ' + path); }
  const last = ts[ts.length - 1];
  if (last.sel !== undefined) { const i = cur.findIndex(x => x && String(x[last.sel]) === last.val); if (i < 0) cur.push(val); else cur[i] = val; }
  else { if (badKey(String(last.k))) throw new Error('chemin interdit : ' + last.k); cur[last.k] = val; }
};
U.pdel = (obj, path) => {
  const ts = tokens(path); let cur = obj;
  for (let i = 0; i < ts.length - 1; i++) { cur = step(cur, ts[i], false); if (cur === undefined) return false; }
  const last = ts[ts.length - 1];
  if (last.sel !== undefined) { const i = cur.findIndex(x => x && String(x[last.sel]) === last.val); if (i < 0) return false; cur.splice(i, 1); return true; }
  if (Array.isArray(cur)) { cur.splice(+last.k, 1); return true; }
  if (badKey(String(last.k))) throw new Error('chemin interdit : ' + last.k);
  return delete cur[last.k];
};

/* ---------- Aplatissement sémantique (diff d'état) ----------
   Les clés commençant par « _ » sont du runtime (baux, caches, compteurs, journaux) :
   elles ne participent jamais au diff. Les tableaux d'objets sont indexés par id/name. */
U.flat = function (obj, prefix, out) {
  out = out || {}; prefix = prefix || '';
  if (Array.isArray(obj)) {
    if (obj.length && obj.every(x => U.isObj(x))) {
      obj.forEach((x, i) => { const k = x.id !== undefined ? x.id : x.name !== undefined ? x.name : i; U.flat(x, prefix + '[' + k + ']', out); });
    } else out[prefix] = JSON.stringify(obj);
  } else if (U.isObj(obj)) {
    for (const k of Object.keys(obj)) { if (k[0] === '_') continue; U.flat(obj[k], prefix ? prefix + '/' + k : k, out); }
    if (!Object.keys(obj).filter(k => k[0] !== '_').length) out[prefix] = '{}';
  } else out[prefix] = obj === undefined ? null : obj;
  return out;
};
U.diffFlat = function (base, cur) {
  const d = {};
  for (const k of Object.keys(base)) if (JSON.stringify(base[k]) !== JSON.stringify(cur[k])) d[k] = { was: base[k], now: cur[k] };
  for (const k of Object.keys(cur)) if (!(k in base)) d[k] = { was: undefined, now: cur[k] };
  return d;
};

/* ---------- Wildcard simple (noms de fichiers / ACL) ---------- */
U.globToRe = g2 => { const body = g2.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  try { return new RegExp('^' + body + '$'); } catch (e) { return new RegExp('^' + body.replace(/[\[\]]/g, '\\$&') + '$'); } };   /* « [ » sans « ] » : texte littéral, comme bash */

/* ---------- Hash court déterministe (empreintes de clés, identifiants) ---------- */
U.hash8 = s => { const h = cyrb128(String(s)); return h[0].toString(16).padStart(8, '0'); };
U.fakeFingerprint = s => { const h = cyrb128(String(s)); const b = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) b.push(((h[i] >>> (j * 8)) & 255).toString(16).padStart(2, '0')); return b.join(':'); };
U.b64like = (s, n) => { const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; const r = U.rng(s); let o = ''; for (let i = 0; i < n; i++) o += al[r.int(64)]; return o; };
U.macKey = m => String(m).toLowerCase().replace(/[^0-9a-f]/g, ''); /* clé canonique de comparaison (sans séparateurs) */
U.macFmt = m => { const h = U.macKey(m).toUpperCase(); return h.length === 12 ? h.match(/../g).join('-') : String(m); }; /* format du modèle : AA-BB-CC-DD-EE-FF */
U.mac = (s) => { const h = cyrb128(String(s)); return [0, 1, 2, 3, 4, 5].map(i => { let b = (h[i % 4] >>> ((i % 3) * 8)) & 255; if (i === 0) b &= 0xFC; /* unicast, universally administered */ return b.toString(16).padStart(2, '0'); }).join('-').toUpperCase(); };

})(typeof globalThis !== 'undefined' ? globalThis : window);
