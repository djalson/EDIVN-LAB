/* ============================================================================
   Thèmes de l'interface du jeu (accueil, barre de jeu, ticket, débrief) + animation « note parfaite » propre à chaque thème.
   Les thèmes ne touchent JAMAIS aux consoles émulées (Windows, Cisco, pfSense, terminaux) : leur fidélité est l'objectif n°1.
   Noms génériques, palettes et animations originales : aucun logo, police, image ni citation d'œuvre tierce.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui = SIM.ui || {}; const h = UI.h;

/* vars : variables CSS appliquées à la racine. onaccent : couleur du texte posé sur --accent. scene : LED et câbles du décor salle serveur. */
const THEMES = [
  { id: 'neon', name: 'Néon Arcade', desc: 'Violet et cyan, ombres franches de borne d’arcade.', anim: 'neon', perfect: { title: 'PARFAIT', sub: 'Aucune faute. Tu viens de claquer un score d’arcade.' },
    vars: { '--bg': '#0c0820', '--panel': '#161030', '--panel2': '#201848', '--line': '#3d3174', '--text': '#efeaff', '--muted': '#a79fd0', '--accent': '#9333ea', '--accent2': '#7c3aed', '--hc': '#22d3ee', '--hv': '#a855f7', '--ink': '#1a1033', '--shadow': '#070412', '--onaccent': '#ffffff', '--bubble': '#f3efff', '--bubbletxt': '#1a1033' },
    scene: { leds: ['#22d3ee', '#a855f7', '#f0abfc'], cables: ['#a855f7', '#22d3ee', '#6d28d9'] } },
  { id: 'rain', name: 'Pluie de code', desc: 'Noir et vert phosphore, pluie de caractères.', anim: 'rain', perfect: { title: '100', sub: 'Le code s’arrête de tomber : tout est en ordre.' },
    vars: { '--bg': '#020a04', '--panel': '#06140a', '--panel2': '#0b2112', '--line': '#14532d', '--text': '#c8ffd9', '--muted': '#6fbf8a', '--accent': '#22c55e', '--accent2': '#15803d', '--hc': '#86efac', '--hv': '#22c55e', '--ink': '#021208', '--shadow': '#000000', '--onaccent': '#021208', '--bubble': '#d9ffe6', '--bubbletxt': '#021208' },
    scene: { leds: ['#22c55e', '#86efac', '#4ade80'], cables: ['#15803d', '#22c55e', '#166534'] } },
  { id: 'synth', name: 'Synthwave 80s', desc: 'Rose, cyan et violet, soleil et grille.', anim: 'synth', perfect: { title: 'LEGEND', sub: '100 / 100 — direction l’horizon.' },
    vars: { '--bg': '#14062b', '--panel': '#1d0b3d', '--panel2': '#2a1055', '--line': '#5b2a9a', '--text': '#ffeaff', '--muted': '#c4a1e8', '--accent': '#ff4fa3', '--accent2': '#c026a3', '--hc': '#2de2e6', '--hv': '#ff4fa3', '--ink': '#12042a', '--shadow': '#07011a', '--onaccent': '#12042a', '--bubble': '#ffe9f6', '--bubbletxt': '#12042a' },
    scene: { leds: ['#2de2e6', '#ff4fa3', '#ffd166'], cables: ['#ff4fa3', '#2de2e6', '#a855f7'] } },
  { id: 'cyber', name: 'Cyberpunk', desc: 'Jaune acide, cyan et magenta, effet glitch.', anim: 'cyber', perfect: { title: 'NETRUNNER', sub: 'Accès total. 100 / 100.' },
    vars: { '--bg': '#0a0a0f', '--panel': '#14141c', '--panel2': '#1d1d28', '--line': '#3b3b4f', '--text': '#f4f4ee', '--muted': '#a3a3b5', '--accent': '#fcee0a', '--accent2': '#cfc200', '--hc': '#00f0ff', '--hv': '#fcee0a', '--ink': '#050508', '--shadow': '#000000', '--onaccent': '#0a0a0f', '--bubble': '#fcee0a', '--bubbletxt': '#0a0a0f' },
    scene: { leds: ['#00f0ff', '#fcee0a', '#ff2a6d'], cables: ['#ff2a6d', '#00f0ff', '#fcee0a'] } },
  { id: 'bit', name: 'Console 8-bit', desc: 'Quatre verts de console portable, gros pixels.', anim: 'bit', perfect: { title: 'PERFECT!', sub: '100 / 100 — niveau terminé.' },
    vars: { '--bg': '#0f380f', '--panel': '#164416', '--panel2': '#1f5a1f', '--line': '#306230', '--text': '#9bbc0f', '--muted': '#a4c52a', '--accent': '#9bbc0f', '--accent2': '#6f8f0c', '--hc': '#8bac0f', '--hv': '#9bbc0f', '--ink': '#0a2a0a', '--shadow': '#082008', '--onaccent': '#0f380f', '--bubble': '#9bbc0f', '--bubbletxt': '#0f380f' },
    scene: { leds: ['#9bbc0f', '#8bac0f', '#c4d95a'], cables: ['#306230', '#8bac0f', '#6f8f0c'] } },
  { id: 'amber', name: 'Terminal Ambre', desc: 'Écran à phosphore ambre, lignes de balayage.', anim: 'amber', perfect: { title: 'ACCÈS ROOT', sub: 'Note : 100 / 100' },
    vars: { '--bg': '#120a00', '--panel': '#1a0f00', '--panel2': '#261600', '--line': '#5a3a00', '--text': '#ffb000', '--muted': '#b87a00', '--accent': '#ffb000', '--accent2': '#cc8c00', '--hc': '#ffd166', '--hv': '#ffb000', '--ink': '#0a0500', '--shadow': '#050200', '--onaccent': '#120a00', '--bubble': '#ffd98a', '--bubbletxt': '#120a00' },
    scene: { leds: ['#ffb000', '#ffd166', '#ff7a00'], cables: ['#cc8c00', '#ffb000', '#8a5a00'] } },
  { id: 'dev', name: 'Dev Dark', desc: 'Éditeur de code sombre, violet doux, rose et vert.', anim: 'dev', perfect: { title: 'Tous les tests passent', sub: '100 / 100 — build parfait.' },
    vars: { '--bg': '#1b1d2a', '--panel': '#252838', '--panel2': '#2f3347', '--line': '#444a66', '--text': '#eceff8', '--muted': '#98a2c4', '--accent': '#b79bff', '--accent2': '#8f6bd8', '--hc': '#5ff2a0', '--hv': '#ff7ac6', '--ink': '#13141d', '--shadow': '#0e0f16', '--onaccent': '#13141d', '--bubble': '#eceff8', '--bubbletxt': '#13141d' },
    scene: { leds: ['#5ff2a0', '#ff7ac6', '#b79bff'], cables: ['#b79bff', '#5ff2a0', '#ff7ac6'] } },
  { id: 'paper', name: 'Papier Clair', desc: 'Fond crème et encre sombre, lisible en salle lumineuse ou en projection.', anim: 'paper', perfect: { title: 'VALIDÉ', sub: '100 / 100 — dossier clos, tampon apposé.' },
    vars: { '--bg': '#f4f1ea', '--panel': '#ffffff', '--panel2': '#ece8de', '--line': '#c9c2b0', '--text': '#1f2430', '--muted': '#575d6e', '--accent': '#4f32c8', '--accent2': '#3d27a0', '--hc': '#0f766e', '--hv': '#b4235f', '--ink': '#1f2430', '--shadow': '#a79f8a', '--onaccent': '#ffffff', '--bubble': '#1f2430', '--bubbletxt': '#f4f1ea' },
    scene: { leds: ['#0f766e', '#b4235f', '#4f32c8'], cables: ['#4f32c8', '#0f766e', '#b4235f'] } },
  /* thèmes de prestige : débloqués par le niveau (src/engine/85-rewards.js), pas par l'arbre */
  { id: 'gold', name: 'Or noir', desc: 'Prestige, niveau 30. Noir profond et or, sobre et tranchant.', anim: 'neon', perfect: { title: 'MAGISTRAL', sub: '100 / 100 — du travail d’architecte.' },
    vars: { '--bg': '#0b0a08', '--panel': '#15130e', '--panel2': '#1f1c14', '--line': '#4a4127', '--text': '#f6efdc', '--muted': '#b9ad8c', '--accent': '#d4a017', '--accent2': '#a87c0c', '--hc': '#ffd76a', '--hv': '#e0b040', '--ink': '#0b0a08', '--shadow': '#000000', '--onaccent': '#0b0a08', '--bubble': '#f6efdc', '--bubbletxt': '#0b0a08' },
    scene: { leds: ['#ffd76a', '#e0b040', '#f6efdc'], cables: ['#a87c0c', '#ffd76a', '#4a4127'] } },
  { id: 'boreal', name: 'Boréal', desc: 'Prestige, niveau 40. Nuit polaire, turquoise et violet.', anim: 'synth', perfect: { title: 'LÉGENDE', sub: '100 / 100 — le datacenter s’incline.' },
    vars: { '--bg': '#06121a', '--panel': '#0b1d28', '--panel2': '#112a38', '--line': '#23505f', '--text': '#e6fbff', '--muted': '#8fb8c4', '--accent': '#2dd4bf', '--accent2': '#14a39a', '--hc': '#7cf7d4', '--hv': '#a78bfa', '--ink': '#04121a', '--shadow': '#01080c', '--onaccent': '#04121a', '--bubble': '#e6fbff', '--bubbletxt': '#04121a' },
    scene: { leds: ['#7cf7d4', '#a78bfa', '#2dd4bf'], cables: ['#2dd4bf', '#a78bfa', '#23505f'] } }
];
const T = UI.themes = { list: THEMES };
T.get = id => THEMES.find(x => x.id === id) || THEMES[0];
T.saved = () => { const v = SIM.game.store.get('theme'); return typeof v === 'string' && THEMES.some(x => x.id === v) ? v : 'neon'; };
T.current = () => T.get(T.saved());
T.apply = function (id, persist) {
  const t = T.get(id); if (typeof document === 'undefined') return t;
  const root = document.documentElement; root.setAttribute('data-theme', t.id);
  Object.keys(t.vars).forEach(k => root.style.setProperty(k, t.vars[k]));
  if (persist) SIM.game.store.set('theme', t.id);
  return t;
};

/* ------------------------------------------------------------------ animation « note parfaite » */
const reduced = () => { try { return !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
const rnd = (a, b) => a + Math.random() * (b - a);

function fanfare() {
  try {
    const AC = g.AudioContext || g.webkitAudioContext; if (!AC) return;
    const ac = new AC(); const seq = [[523, 0, .11], [659, .12, .11], [784, .24, .11], [1047, .36, .34], [784, .72, .1], [1047, .84, .5]];
    seq.forEach(([f, t0, d]) => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'square'; o.frequency.value = f; gn.gain.value = 0.0001; o.connect(gn); gn.connect(ac.destination); const t = ac.currentTime + t0; gn.gain.setValueAtTime(0.06, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.start(t); o.stop(t + d + 0.02); });
    setTimeout(() => { try { ac.close(); } catch (e) { /* contexte audio déjà fermé */ } }, 2000);
  } catch (e) { /* audio indisponible : l'animation reste visuelle */ }
}

function rainCanvas(box, cleanups) {
  const cv = h('canvas.pf-canvas'); box.append(cv); const ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
  const w = cv.width = g.innerWidth, hh = cv.height = g.innerHeight, fs = Math.max(14, Math.round(Math.min(w, hh) / 42)); const cols = Math.ceil(w / fs), rows = Math.ceil(hh / fs);
  const G = '01{}<>/;=#$%&ABCDEF0123456789'; const drops = Array.from({ length: cols }, () => Math.floor(rnd(-rows, 0)));
  /* masque du « 100 » : cellules qui resteront figées quand la pluie s'arrête */
  const mk = document.createElement('canvas'); mk.width = cols; mk.height = rows; const mc = mk.getContext('2d'); mc.fillStyle = '#000'; mc.fillRect(0, 0, cols, rows); mc.fillStyle = '#fff'; mc.textAlign = 'center'; mc.textBaseline = 'middle';
  const fsz = Math.floor(Math.min(rows * 0.8, cols * 0.5)); mc.font = '900 ' + fsz + 'px sans-serif'; mc.fillText('100', cols / 2, rows / 2);
  let md; try { md = mc.getImageData(0, 0, cols, rows).data; } catch (e) { md = null; }
  const cells = []; if (md) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (md[(y * cols + x) * 4] > 128) cells.push([x, y, G[Math.floor(Math.random() * G.length)]]);
  const t0 = Date.now(); let raf = 0, stopped = false;
  ctx.font = '700 ' + fs + 'px ui-monospace, Consolas, monospace'; ctx.textBaseline = 'top';
  const frame = () => {
    if (stopped) return; const t = Date.now() - t0; const freeze = t > 2300;
    ctx.fillStyle = freeze ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.09)'; ctx.fillRect(0, 0, w, hh);
    for (let i = 0; i < cols; i++) {
      if (!freeze || t < 3300) { const y = drops[i] * fs; ctx.fillStyle = '#d6ffe4'; ctx.fillText(G[Math.floor(Math.random() * G.length)], i * fs, y); ctx.fillStyle = '#22c55e'; ctx.fillText(G[Math.floor(Math.random() * G.length)], i * fs, y - fs); }
      drops[i]++; if (drops[i] * fs > hh && Math.random() > 0.96) drops[i] = Math.floor(rnd(-12, 0));
    }
    if (freeze) { const k = Math.min(1, (t - 2300) / 1500); ctx.fillStyle = '#eafff1'; ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 10; cells.forEach(c => { if (Math.random() < 0.18 + k * 0.5) ctx.fillText(c[2], c[0] * fs, c[1] * fs); }); ctx.shadowBlur = 0; }
    raf = g.requestAnimationFrame(frame);
  };
  raf = g.requestAnimationFrame(frame); cleanups.push(() => { stopped = true; g.cancelAnimationFrame(raf); });
}

function typeLines(el, lines, cleanups) {
  let li = 0, ci = 0, timer = 0; const out = []; const tick = () => {
    if (li >= lines.length) return; const L = lines[li];
    if (ci <= L.length) { el.textContent = out.concat([L.slice(0, ci)]).join('\n') + '█'; ci++; timer = setTimeout(tick, L.startsWith('>') || L.startsWith('$') ? 38 : 12); }
    else { out.push(L); li++; ci = 0; timer = setTimeout(tick, 260); }
  };
  tick(); cleanups.push(() => clearTimeout(timer));
}

/* Affiche l'animation du thème `id` pour une note parfaite. Cliquer, Échap ou ~5 s la ferment. Retourne une fonction de fermeture. */
T.celebrate = function (id, note) {
  const t = T.get(id || T.saved()); const doc = g.document; if (!doc) return () => {};
  const old = doc.querySelector('.hperf'); if (old && old._close) old._close();
  const cleanups = []; const still = reduced();
  const box = h('div.hperf.pf-' + t.anim, { role: 'status', 'aria-live': 'polite', 'aria-label': 'Note parfaite : ' + (note || 100) + ' sur 100. ' + t.perfect.sub });
  let closed = false;
  const close = () => { if (closed) return; closed = true; cleanups.forEach(f => { try { f(); } catch (e) { /* nettoyage best-effort */ } }); doc.removeEventListener('keydown', onKey, true); box.classList.add('out'); setTimeout(() => box.remove(), 260); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  box._close = close; box.addEventListener('click', close); doc.addEventListener('keydown', onKey, true);
  const title = h('div.pf-title', { 'data-t': t.perfect.title }, t.perfect.title);
  const sub = h('div.pf-sub', t.perfect.sub); const num = h('div.pf-num', String(note || 100), h('small', ' / 100'));
  if (!still) {
    if (t.anim === 'neon') for (let i = 0; i < 26; i++) box.append(h('i.pf-star', { style: 'left:' + rnd(2, 98).toFixed(1) + '%;animation-delay:' + rnd(0, 2.2).toFixed(2) + 's;animation-duration:' + rnd(2, 3.6).toFixed(2) + 's;' }));
    if (t.anim === 'rain') rainCanvas(box, cleanups);
    if (t.anim === 'synth') box.append(h('div.pf-sun'), h('div.pf-grid'));
    if (t.anim === 'cyber') box.append(h('div.pf-scan'));
    if (t.anim === 'bit') { fanfare(); for (let i = 0; i < 14; i++) box.append(h('i.pf-coin', { style: 'left:' + rnd(4, 96).toFixed(1) + '%;animation-delay:' + rnd(0, 1.8).toFixed(2) + 's;' })); }
    if (t.anim === 'paper') { const cs = ['#4f32c8', '#0f766e', '#b4235f', '#d97706', '#2563eb']; for (let i = 0; i < 36; i++) box.append(h('i.pf-conf', { style: 'left:' + rnd(1, 99).toFixed(1) + '%;color:' + cs[i % cs.length] + ';animation-delay:' + rnd(0, 1.6).toFixed(2) + 's;animation-duration:' + rnd(2.4, 4.2).toFixed(2) + 's;font-size:' + Math.round(rnd(14, 26)) + 'px;' }, '▮')); }
    if (t.anim === 'dev') { const gl = ['{ }', ';', '=>', '</>', '()', '[]', '&&', '!==', '#', '//']; const cs = ['#5ff2a0', '#ff7ac6', '#b79bff', '#ffd166', '#7dd3fc']; for (let i = 0; i < 42; i++) box.append(h('i.pf-conf', { style: 'left:' + rnd(1, 99).toFixed(1) + '%;color:' + cs[i % cs.length] + ';animation-delay:' + rnd(0, 1.6).toFixed(2) + 's;animation-duration:' + rnd(2.2, 4).toFixed(2) + 's;font-size:' + Math.round(rnd(14, 30)) + 'px;' }, gl[i % gl.length])); }
  }
  if (t.anim === 'amber' && !still) { const term = h('pre.pf-term'); box.append(term); typeLines(term, ['$ ticket --close --verify', '[sudo] mot de passe pour technicien : ********', '> vérification depuis le poste utilisateur ... OK', '> aucune action dangereuse, aucun indice', '', 'ACCÈS ROOT ACCORDÉ', 'Note : ' + (note || 100) + ' / 100'], cleanups); }
  else box.append(h('div.pf-card', title, num, sub));
  doc.body.appendChild(box); cleanups.push(() => {}); const to = setTimeout(close, still ? 3200 : 5200); cleanups.push(() => clearTimeout(to));
  return close;
};
})(typeof window !== 'undefined' ? window : globalThis);
