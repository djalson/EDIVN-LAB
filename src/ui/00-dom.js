/* ============================================================================
   Couche UI — socle DOM : constructeur d'éléments, jeu d'icônes ORIGINALES (SVG tracés ici,
   aucune icône d'éditeur tiers), notifications, boîtes modales du cadre de jeu.
   Police : pile système (aucune police embarquée) — voir docs/LIMITES.md.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const UI = SIM.ui = SIM.ui || {};

/* h('div.classe#id', {attr, on:{click}, style:{}}, enfants…) */
UI.h = function h(sel, attrs) {
  const m = String(sel).match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (x, t, n) => { if (t === '.') el.classList.add(n); else el.id = n; return ''; });
  let i = 1;
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    i = 2;
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') { for (const ev of Object.keys(v)) el.addEventListener(ev, v[ev]); }
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.appendChild(UI.safeHtml(v));
      else if (k === 'text') el.textContent = v;
      else if (k in el && k !== 'list' && k !== 'type' && k !== 'form') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = c => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); };
  for (; i < arguments.length; i++) add(arguments[i]);
  return el;
};
const h = UI.h;
UI.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
UI.esc = U.esc || (s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
UI.fmtDur = sec => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return U.pad2(m) + ':' + U.pad2(s); };
/* Assainisseur HTML pour tout contenu venant d'un scénario (pages web simulées, importées par un formateur) :
   analyse dans un document inerte (DOMParser, aucun script ni chargement de ressource), liste blanche de balises
   et d'attributs, liens limités à http(s). Retourne un DocumentFragment prêt à insérer. */
const SAFE_TAGS = { H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, P: 1, UL: 1, OL: 1, LI: 1, A: 1, B: 1, I: 1, U: 1, STRONG: 1, EM: 1, BR: 1, HR: 1, DIV: 1, SPAN: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, PRE: 1, CODE: 1, SMALL: 1, CENTER: 1, BLOCKQUOTE: 1, DL: 1, DT: 1, DD: 1 };
const SAFE_ATTR = { class: 1, title: 1, colspan: 1, rowspan: 1, href: 1 };
UI.safeHtml = function (html) {
  const frag = document.createDocumentFragment();
  let doc; try { doc = new DOMParser().parseFromString(String(html == null ? '' : html), 'text/html'); } catch (e) { frag.appendChild(document.createTextNode(String(html))); return frag; }
  const copy = (src, dst) => {
    for (const n of Array.prototype.slice.call(src.childNodes)) {
      if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toUpperCase();
      if (!SAFE_TAGS[tag]) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|TEMPLATE|NOSCRIPT|HEAD|TITLE|META|LINK|FORM|INPUT|BUTTON|TEXTAREA|SELECT|IMG|VIDEO|AUDIO|BASE)$/.test(tag)) continue; copy(n, dst); continue; }
      const el = document.createElement(tag.toLowerCase());
      for (const a of Array.prototype.slice.call(n.attributes)) {
        const k = a.name.toLowerCase(); if (!SAFE_ATTR[k]) continue;
        if (k === 'href') { if (/^\s*https?:\/\//i.test(a.value)) { el.setAttribute('href', a.value); el.setAttribute('rel', 'noopener noreferrer'); } continue; }
        el.setAttribute(k, a.value);
      }
      copy(n, el); dst.appendChild(el);
    }
  };
  copy(doc.body || doc, frag);
  return frag;
};
UI.svg = function (html, size) { const w = h('span.ico'); w.innerHTML = html; const s = w.firstChild; if (s && size) { s.setAttribute('width', size); s.setAttribute('height', size); } w.style.display = 'inline-flex'; return w; };

/* ------------------------------------------------------------------ icônes originales
   Chaque icône : viewBox 0 0 32 32. Formes simples, couleurs franches. */
const C = { blue: '#3b8cff', dark: '#24324a', mid: '#5b7396', light: '#cfe0ff', green: '#2fbf71', red: '#e5534b', amber: '#f0a63a', white: '#f4f7fb', gray: '#8fa3bf', yellow: '#f6d365', teal: '#27b5b0', violet: '#8a6cf0' };
UI.C = C;
const P = (body) => '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
UI.icons = {
  monitor: P(`<rect x="3" y="5" width="26" height="17" rx="2" fill="${C.dark}" stroke="${C.mid}" stroke-width="1.5"/><rect x="5.5" y="7.5" width="21" height="12" fill="${C.blue}"/><rect x="12" y="23" width="8" height="3" fill="${C.mid}"/><rect x="8" y="26" width="16" height="2" rx="1" fill="${C.mid}"/>`),
  pc: P(`<rect x="4" y="4" width="16" height="24" rx="2" fill="${C.mid}" stroke="${C.dark}"/><rect x="7" y="8" width="10" height="2" fill="${C.dark}"/><circle cx="12" cy="22" r="2" fill="${C.green}"/><rect x="22" y="9" width="8" height="12" rx="1" fill="${C.blue}" stroke="${C.dark}"/>`),
  server: P(`<rect x="5" y="4" width="22" height="7" rx="1.5" fill="${C.mid}" stroke="${C.dark}"/><rect x="5" y="13" width="22" height="7" rx="1.5" fill="${C.mid}" stroke="${C.dark}"/><rect x="5" y="22" width="22" height="7" rx="1.5" fill="${C.mid}" stroke="${C.dark}"/><circle cx="9" cy="7.5" r="1.4" fill="${C.green}"/><circle cx="9" cy="16.5" r="1.4" fill="${C.green}"/><circle cx="9" cy="25.5" r="1.4" fill="${C.amber}"/><rect x="14" y="6.8" width="9" height="1.4" fill="${C.dark}"/><rect x="14" y="15.8" width="9" height="1.4" fill="${C.dark}"/><rect x="14" y="24.8" width="9" height="1.4" fill="${C.dark}"/>`),
  linux: P(`<rect x="5" y="4" width="22" height="7" rx="1.5" fill="#3a4d6e" stroke="${C.dark}"/><rect x="5" y="13" width="22" height="7" rx="1.5" fill="#3a4d6e" stroke="${C.dark}"/><rect x="5" y="22" width="22" height="7" rx="1.5" fill="#3a4d6e" stroke="${C.dark}"/><path d="M9 6l3 1.5L9 9" fill="none" stroke="${C.green}" stroke-width="1.4"/><path d="M9 15l3 1.5L9 18" fill="none" stroke="${C.green}" stroke-width="1.4"/><circle cx="9" cy="25.5" r="1.4" fill="${C.green}"/>`),
  switch: P(`<rect x="2" y="10" width="28" height="12" rx="2" fill="${C.mid}" stroke="${C.dark}"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${4.5 + i * 3}" y="14" width="2" height="4" fill="${C.dark}"/><rect x="${4.5 + i * 3}" y="12" width="2" height="1" fill="${i % 3 === 0 ? C.green : C.amber}"/>`).join('')}`),
  router: P(`<rect x="3" y="14" width="26" height="10" rx="2" fill="${C.mid}" stroke="${C.dark}"/><path d="M16 4v8M12 8l4-4 4 4" fill="none" stroke="${C.blue}" stroke-width="1.8"/><circle cx="8" cy="19" r="1.3" fill="${C.green}"/><circle cx="12" cy="19" r="1.3" fill="${C.green}"/><rect x="18" y="18" width="8" height="2" fill="${C.dark}"/>`),
  firewall: P(`<rect x="3" y="6" width="26" height="20" rx="2" fill="${C.red}" stroke="#8a2b25"/><path d="M3 12h26M3 19h26M10 6v6M20 6v6M15 12v7M8 19v7M22 19v7" stroke="#8a2b25" stroke-width="1.2"/>`),
  printer: P(`<rect x="8" y="4" width="16" height="7" fill="${C.white}" stroke="${C.dark}"/><rect x="3" y="11" width="26" height="12" rx="2" fill="${C.mid}" stroke="${C.dark}"/><rect x="8" y="19" width="16" height="9" fill="${C.white}" stroke="${C.dark}"/><circle cx="25" cy="15" r="1.2" fill="${C.green}"/>`),
  cloud: P(`<path d="M9 23a5 5 0 010-10 7 7 0 0113.5-1A5.5 5.5 0 0123 23z" fill="${C.light}" stroke="${C.mid}" stroke-width="1.4"/>`),
  globe: P(`<circle cx="16" cy="16" r="12" fill="${C.blue}" stroke="${C.dark}"/><ellipse cx="16" cy="16" rx="5" ry="12" fill="none" stroke="${C.light}"/><path d="M4 16h24M6 9h20M6 23h20" stroke="${C.light}" fill="none"/>`),
  folder: P(`<path d="M3 8a2 2 0 012-2h7l3 3h12a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="${C.yellow}" stroke="#b58a1d"/>`),
  file: P(`<path d="M8 3h11l6 6v20H8z" fill="${C.white}" stroke="${C.mid}"/><path d="M19 3v6h6" fill="none" stroke="${C.mid}"/><path d="M11 15h11M11 19h11M11 23h8" stroke="${C.gray}"/>`),
  gear: P(`<circle cx="16" cy="16" r="9" fill="${C.mid}" stroke="${C.dark}" stroke-width="1.5"/><circle cx="16" cy="16" r="3.5" fill="${C.dark}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="14.5" y="2" width="3" height="5" fill="${C.mid}" stroke="${C.dark}" transform="rotate(${a} 16 16)"/>`).join('')}`),
  shield: P(`<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="${C.green}" stroke="#1d7a49" stroke-width="1.4"/><path d="M10.5 15.5l4 4 7-8" fill="none" stroke="${C.white}" stroke-width="2.4"/>`),
  network: P(`<rect x="12" y="3" width="8" height="6" rx="1" fill="${C.blue}"/><rect x="3" y="22" width="8" height="6" rx="1" fill="${C.blue}"/><rect x="21" y="22" width="8" height="6" rx="1" fill="${C.blue}"/><path d="M16 9v6M7 22v-7h18v7" fill="none" stroke="${C.mid}" stroke-width="1.6"/>`),
  terminal: P(`<rect x="3" y="5" width="26" height="22" rx="2" fill="#0c1018" stroke="${C.mid}"/><path d="M8 12l5 4-5 4" fill="none" stroke="${C.green}" stroke-width="2"/><path d="M16 21h8" stroke="${C.light}" stroke-width="2"/>`),
  user: P(`<circle cx="16" cy="11" r="5" fill="${C.light}" stroke="${C.mid}"/><path d="M5 28c0-6 5-9 11-9s11 3 11 9z" fill="${C.light}" stroke="${C.mid}"/>`),
  users: P(`<circle cx="11" cy="11" r="4.5" fill="${C.light}" stroke="${C.mid}"/><circle cx="22" cy="12" r="4" fill="${C.light}" stroke="${C.mid}"/><path d="M2 27c0-5 4-8 9-8s9 3 9 8zM17 27c0-4 3-6.5 6.5-6.5S30 23 30 27z" fill="${C.light}" stroke="${C.mid}"/>`),
  db: P(`<ellipse cx="16" cy="8" rx="10" ry="4" fill="${C.light}" stroke="${C.mid}"/><path d="M6 8v16c0 2.2 4.5 4 10 4s10-1.8 10-4V8" fill="${C.mid}" stroke="${C.dark}"/><path d="M6 16c0 2.2 4.5 4 10 4s10-1.8 10-4" fill="none" stroke="${C.dark}"/>`),
  lock: P(`<rect x="7" y="14" width="18" height="14" rx="2" fill="${C.amber}" stroke="#a36a12"/><path d="M11 14V10a5 5 0 0110 0v4" fill="none" stroke="${C.mid}" stroke-width="2.4"/>`),
  key: P(`<circle cx="10" cy="16" r="6" fill="${C.yellow}" stroke="#b58a1d"/><circle cx="10" cy="16" r="2" fill="${C.dark}"/><path d="M16 16h13M24 16v5M28 16v4" stroke="#b58a1d" stroke-width="2.4"/>`),
  warning: P(`<path d="M16 3l14 25H2z" fill="${C.amber}" stroke="#a36a12" stroke-width="1.4"/><path d="M16 12v8" stroke="${C.dark}" stroke-width="2.6"/><circle cx="16" cy="23.5" r="1.6" fill="${C.dark}"/>`),
  error: P(`<circle cx="16" cy="16" r="13" fill="${C.red}" stroke="#8a2b25"/><path d="M10 10l12 12M22 10L10 22" stroke="${C.white}" stroke-width="3"/>`),
  info: P(`<circle cx="16" cy="16" r="13" fill="${C.blue}" stroke="#1f56a8"/><rect x="14.5" y="14" width="3" height="10" fill="${C.white}"/><circle cx="16" cy="9.5" r="1.8" fill="${C.white}"/>`),
  question: P(`<circle cx="16" cy="16" r="13" fill="${C.blue}" stroke="#1f56a8"/><path d="M11.5 12.5a4.5 4.5 0 119 0c0 3-4.5 3.5-4.5 6.5" fill="none" stroke="${C.white}" stroke-width="2.6"/><circle cx="16" cy="23.5" r="1.7" fill="${C.white}"/>`),
  check: P(`<circle cx="16" cy="16" r="13" fill="${C.green}" stroke="#1d7a49"/><path d="M9 16.5l5 5 9-10" fill="none" stroke="${C.white}" stroke-width="3"/>`),
  plug: P(`<path d="M11 3v7M21 3v7" stroke="${C.mid}" stroke-width="3"/><path d="M7 10h18v7a9 9 0 01-18 0z" fill="${C.mid}" stroke="${C.dark}"/><path d="M16 26v4" stroke="${C.dark}" stroke-width="3"/>`),
  cable: P(`<rect x="6" y="3" width="20" height="14" rx="2" fill="${C.blue}" stroke="#1f56a8"/><rect x="10" y="17" width="12" height="5" fill="${C.dark}"/><path d="M16 22v8" stroke="${C.dark}" stroke-width="3"/>`),
  power: P(`<circle cx="16" cy="17" r="10" fill="none" stroke="${C.light}" stroke-width="2.6"/><path d="M16 4v12" stroke="${C.light}" stroke-width="3"/>`),
  clock: P(`<circle cx="16" cy="16" r="13" fill="${C.white}" stroke="${C.mid}" stroke-width="2"/><path d="M16 8v9l6 3" fill="none" stroke="${C.dark}" stroke-width="2.4"/>`),
  mail: P(`<rect x="3" y="7" width="26" height="18" rx="2" fill="${C.white}" stroke="${C.mid}"/><path d="M3 9l13 9L29 9" fill="none" stroke="${C.mid}"/>`),
  list: P(`<rect x="4" y="4" width="24" height="24" rx="2" fill="${C.white}" stroke="${C.mid}"/><path d="M9 11h14M9 16h14M9 21h10" stroke="${C.mid}" stroke-width="2"/>`),
  eye: P(`<path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16z" fill="${C.white}" stroke="${C.mid}"/><circle cx="16" cy="16" r="4.5" fill="${C.blue}"/>`),
  wrench: P(`<path d="M24 4a6 6 0 00-6 8L5 25l3 3 13-13a6 6 0 008-6l-4 4-3-1-1-3z" fill="${C.mid}" stroke="${C.dark}"/>`),
  cert: P(`<rect x="3" y="5" width="26" height="18" rx="2" fill="${C.white}" stroke="${C.mid}"/><path d="M7 11h18M7 15h12" stroke="${C.gray}" stroke-width="1.6"/><circle cx="23" cy="21" r="5" fill="${C.amber}" stroke="#a36a12"/><path d="M20 25l-1 5 4-2 4 2-1-5" fill="${C.red}"/>`),
  chart: P(`<rect x="3" y="4" width="26" height="24" rx="2" fill="${C.white}" stroke="${C.mid}"/><path d="M7 22l5-6 4 3 6-9 3 4" fill="none" stroke="${C.blue}" stroke-width="2.2"/>`),
  vpn: P(`<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="${C.violet}" stroke="#4d3aa5" stroke-width="1.4"/><rect x="11" y="14" width="10" height="8" rx="1.5" fill="${C.white}"/><path d="M13 14v-2a3 3 0 016 0v2" fill="none" stroke="${C.white}" stroke-width="2"/>`),
  wall: P(`<rect x="4" y="4" width="24" height="24" rx="3" fill="${C.white}" stroke="${C.mid}"/><rect x="10" y="11" width="12" height="9" rx="1" fill="${C.dark}"/><path d="M13 11v4M16 11v4M19 11v4" stroke="${C.amber}" stroke-width="1.6"/>`),
  patch: P(`<rect x="2" y="9" width="28" height="14" rx="2" fill="${C.mid}" stroke="${C.dark}"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${4 + i * 4.4}" y="13" width="3.4" height="6" fill="${C.dark}"/>`).join('')}`),
  strip: P(`<rect x="2" y="11" width="28" height="10" rx="3" fill="${C.white}" stroke="${C.mid}"/>${[0, 1, 2, 3].map(i => `<rect x="${6 + i * 6}" y="14" width="4" height="4" rx="1" fill="${C.dark}"/>`).join('')}<circle cx="27" cy="16" r="1.5" fill="${C.red}"/>`),
  start: P(`<rect x="3" y="3" width="12" height="12" fill="${C.blue}"/><rect x="17" y="3" width="12" height="12" fill="${C.blue}"/><rect x="3" y="17" width="12" height="12" fill="${C.blue}"/><rect x="17" y="17" width="12" height="12" fill="${C.blue}"/>`),
  arrow: P(`<path d="M6 16h18M17 8l8 8-8 8" fill="none" stroke="${C.light}" stroke-width="3"/>`),
  trash: P(`<path d="M8 8h16l-1.5 20h-13z" fill="${C.gray}" stroke="${C.dark}"/><rect x="6" y="5" width="20" height="3" fill="${C.mid}"/><rect x="13" y="2" width="6" height="3" fill="${C.mid}"/>`),
  search: P(`<circle cx="13" cy="13" r="8" fill="none" stroke="${C.light}" stroke-width="3"/><path d="M19 19l9 9" stroke="${C.light}" stroke-width="3.4"/>`),
  home: P(`<path d="M3 16L16 4l13 12h-4v11H7V16z" fill="${C.light}" stroke="${C.mid}"/><rect x="13" y="19" width="6" height="8" fill="${C.mid}"/>`)
};
UI.icon = function (name, size) {
  const s = UI.icons[name] || UI.icons.file; const w = h('span.ico', { style: { display: 'inline-flex', width: (size || 16) + 'px', height: (size || 16) + 'px', flex: '0 0 auto' } });
  w.innerHTML = s; const sv = w.firstChild; sv.setAttribute('width', size || 16); sv.setAttribute('height', size || 16); return w;
};
UI.iconSvg = name => UI.icons[name] || UI.icons.file;

/* ------------------------------------------------------------------ notifications du cadre de jeu */
UI.toast = function (msg, kind, ms) {
  let box = document.querySelector('.toasts'); if (!box) { box = h('div.toasts'); document.body.appendChild(box); }
  const t = h('div.toast' + (kind ? '.' + kind : ''), msg); box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, ms || 4500);
  return t;
};
/* Boîte modale du cadre de jeu (hors fenêtres simulées) */
UI.modal = function (title, body, buttons) {
  const ov = h('div.overlay'); const close = () => ov.remove();
  const bar = h('div.actions', (buttons || [{ label: 'OK', primary: true }]).map(b => h('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), { on: { click: () => { close(); if (b.fn) b.fn(); } } }, b.label)));
  const m = h('div.modal', h('h2', title), body, bar); ov.appendChild(m); document.body.appendChild(ov); return { close, el: m };
};
/* Rendu texte avec retours à la ligne en paragraphes */
UI.paras = txt => h('div', String(txt).split(/\n\n+/).map(p => h('p', { style: { margin: '0 0 8px' } }, p)));
UI.stars = (n, max) => '★'.repeat(n) + '☆'.repeat(Math.max(0, (max || 3) - n));
})(typeof globalThis !== 'undefined' ? globalThis : window);
