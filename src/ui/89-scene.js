/* ============================================================================
   Décor pixel-art de l'accueil : une SALLE SERVEUR (baies, LED qui clignotent, chemins de câbles, dalles de faux plancher).
   Tout est dessiné ici, case par case, en SVG ; les couleurs viennent du thème actif. Les chats cachés font partie du décor.
   `UI.sceneSvg('top' | 'bottom', thème)` → { html, cats: [ids] }. Déterministe (aucun hasard) : même décor à chaque affichage.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui = SIM.ui || {};

const hex = c => { const m = /^#([0-9a-f]{6})$/i.exec(c); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [0, 0, 0]; };
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
/* PRNG minimal (mulberry32) : décor reproductible */
const prng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const W = 240;
function canvas(w, h) { const px = Array.from({ length: h }, () => new Array(w).fill(null)); return { w, h, px, leds: [],
  rect(x, y, ww, hh, c) { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) if (j >= 0 && j < h && i >= 0 && i < w) px[j][i] = c; },
  dot(x, y, c) { if (y >= 0 && y < h && x >= 0 && x < w) px[y][x] = c; } }; }
function toSvg(cv, extraBefore, extraAfter) {
  const out = [];
  cv.px.forEach((row, y) => { let x = 0; while (x < cv.w) { const c = row[x]; if (!c) { x++; continue; } let n = 1; while (x + n < cv.w && row[x + n] === c) n++; out.push('<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + c + '"/>'); x += n; } });
  const leds = cv.leds.map((l, i) => '<rect class="led l' + (1 + (i % 3)) + '" x="' + l.x + '" y="' + l.y + '" width="1" height="1" fill="' + l.c + '" style="animation-delay:' + ((i * 0.37) % 2.4).toFixed(2) + 's"/>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" class="hscene-svg" viewBox="0 0 ' + cv.w + ' ' + cv.h + '" width="' + cv.w * 8 + '" height="' + cv.h * 8 + '" shape-rendering="crispEdges" aria-hidden="false">' + (extraBefore || '') + out.join('') + leds + (extraAfter || '') + '</svg>';
}
/* Un chat caché : sprite à moitié échelle, zone cliquable et focusable (portée par le <g>) */
function cat(id, x, y, label, clipBottom) {
  const b = UI.pixelBody('cat');
  const g = '<g class="hcatg" data-cat="' + id + '" role="button" tabindex="0" aria-label="' + label + '" transform="translate(' + x + ' ' + y + ') scale(.5)"><rect x="-2" y="-2" width="' + (b.w + 4) + '" height="' + (b.h + 4) + '" fill="transparent"/>' + b.body + '</g>';
  /* clipBottom : ordonnée au-delà de laquelle le chat est masqué (il passe la tête par-dessus un obstacle) */
  return clipBottom === undefined ? g : '<defs><clipPath id="clip-' + id + '"><rect x="0" y="0" width="' + W + '" height="' + clipBottom + '"/></clipPath></defs><g clip-path="url(#clip-' + id + ')">' + g + '</g>';
}

UI.sceneSvg = function (which, theme) {
  const v = theme.vars, sc = theme.scene; const R = prng(which === 'top' ? 7 : 11);
  const wall = mix(v['--bg'], v['--panel'], 0.55), wall2 = mix(v['--bg'], v['--panel'], 0.8), ceil = mix(v['--bg'], '#000000', 0.35);
  const rackIn = mix(v['--bg'], '#000000', 0.45), rackEdge = mix(v['--line'], v['--text'], 0.22), unitA = mix(v['--panel2'], v['--line'], 0.65), unitB = mix(v['--line'], v['--panel2'], 0.25), vent = mix(v['--line'], v['--text'], 0.3), port = mix(v['--line'], v['--text'], 0.55);
  const tray = mix(v['--line'], v['--bg'], 0.3), rung = mix(v['--line'], v['--text'], 0.18);
  if (which === 'top') {
    const H = 52, cv = canvas(W, H);
    cv.rect(0, 0, W, H, wall); for (let y = 12; y < H; y += 10) cv.rect(0, y, W, 1, wall2);      /* panneaux muraux */
    cv.rect(0, 0, W, 4, ceil);                                                                    /* plafond */
    cv.rect(0, 5, W, 3, tray); for (let x = 1; x < W; x += 5) cv.rect(x, 5, 1, 3, rung);          /* chemin de câbles */
    const racks = []; const RW = 17, GAP = 4, X0 = 5;
    for (let i = 0; i < 11; i++) racks.push({ x: X0 + i * (RW + GAP), y: 20 });
    /* câbles qui descendent du chemin de câbles vers les baies */
    racks.forEach((r, i) => { if (i % 2 === 0 || i === 5) { const c = sc.cables[i % sc.cables.length]; const cx = r.x + 3 + (i % 3) * 4; cv.rect(cx, 8, 1, r.y - 8, c); cv.rect(cx + 1, 14, 1, 1, c); } });
    racks.forEach((r, i) => {
      cv.rect(r.x, r.y, RW, H - r.y, rackEdge); cv.rect(r.x + 1, r.y + 1, RW - 2, H - r.y - 1, rackIn);
      let y = r.y + 2; while (y + 2 < H) {
        const kind = R(); const body = kind < 0.55 ? unitA : kind < 0.85 ? unitB : mix(rackIn, unitA, 0.4);
        cv.rect(r.x + 1, y, RW - 2, 2, body);
        if (kind < 0.55) { for (let x = r.x + 7; x < r.x + RW - 2; x += 2) cv.dot(x, y, vent); cv.leds.push({ x: r.x + 2, y: y, c: sc.leds[Math.floor(R() * 3)] }); if (R() < 0.7) cv.leds.push({ x: r.x + 4, y: y, c: sc.leds[Math.floor(R() * 3)] }); }
        else if (kind < 0.85) { for (let x = r.x + 2; x < r.x + RW - 2; x += 2) cv.dot(x, y + 1, port); cv.leds.push({ x: r.x + RW - 3, y: y, c: sc.leds[Math.floor(R() * 3)] }); }
        y += 3;
      }
    });
    /* chat 1 : assis sur la baie n°6 ; chat 2 : tête qui dépasse de la baie n°3 (corps masqué) */
    const c1 = cat('c1', racks[5].x + 2, racks[5].y - 7.5, 'Chat caché sur une baie');
    const c2 = cat('c2', racks[2].x + 4, racks[2].y - 4, 'Chat caché derrière une baie', racks[2].y);
    return { html: toSvg(cv, '', c1 + c2), cats: ['c1', 'c2'] };
  }
  /* bas de page : faux plancher, câbles au sol, carton avec un chat, pied de baie */
  const H = 20, cv = canvas(W, H);
  cv.rect(0, 0, W, H, wall);
  const fa = mix(v['--bg'], v['--panel'], 0.7), fb = mix(v['--bg'], v['--panel'], 1.0);
  for (let y = 7; y < H; y++) for (let x = 0; x < W; x++) cv.dot(x, y, (Math.floor(x / 8) + Math.floor((y - 7) / 3)) % 2 ? fa : fb);
  cv.rect(0, 6, W, 1, rackEdge);
  let y0 = 11; sc.cables.forEach((c, k) => { let y = y0 + k * 3; for (let x = 0; x < W; x++) { if (x % 37 === 18 + k * 5) y += (x % 2 ? 1 : -1); cv.dot(x, y, c); cv.dot(x, y + 1, mix(c, '#000000', 0.45)); } });
  [20, 150].forEach(x => { cv.rect(x, 0, 17, 7, rackEdge); cv.rect(x + 1, 0, 15, 6, rackIn); for (let i = 0; i < 2; i++) { cv.rect(x + 1, 1 + i * 3, 15, 2, unitA); cv.leds.push({ x: x + 2, y: 1 + i * 3, c: sc.leds[i] }); } });
  /* carton ouvert (chat 4) et dalle soulevée (chat 3) */
  const box = '#b88a52', boxD = '#8a6338';
  cv.rect(96, 11, 14, 8, box); cv.rect(96, 11, 14, 1, boxD); cv.rect(96, 18, 14, 1, boxD); cv.rect(103, 12, 1, 7, boxD);
  cv.rect(52, 9, 18, 11, rackIn); cv.rect(52, 9, 18, 1, rackEdge); cv.rect(69, 9, 1, 11, rackEdge);   /* trappe d'accès sous le plancher */
  const c3 = cat('c3', 54, 11.5, 'Chat caché sous une dalle');
  const c4 = cat('c4', 98, 7.5, 'Chat caché dans un carton');
  const front = '<rect x="96" y="14" width="14" height="5" fill="' + box + '"/><rect x="96" y="14" width="14" height="1" fill="' + boxD + '"/><rect x="103" y="15" width="1" height="4" fill="' + boxD + '"/><rect x="96" y="18" width="14" height="1" fill="' + boxD + '"/>';
  return { html: toSvg(cv, '', c3 + c4 + front), cats: ['c3', 'c4'] };
};
})(typeof window !== 'undefined' ? window : globalThis);
