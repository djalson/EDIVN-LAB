/* ============================================================================
   Pixel art ORIGINAL (accueil) : sprites dessinés ici, case par case, en SVG. Aucun asset tiers.
   UI.pixel(nom, taille) → <svg> ; chaque sprite = grille de caractères + palette.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui = SIM.ui || {};

const SPRITES = {
  /* mascotte : chat de la salle serveur, casque de support */
  cat: {
    pal: { k: '#1a1033', f: '#b79cff', l: '#e6dcff', p: '#ff8fc7', e: '#22d3ee', w: '#ffffff', c: '#22d3ee', d: '#7c5ce0', m: '#0e7490' },
    rows: [
      '..kk........kk..',
      '.kffk......kffk.',
      '.kfpfccccccfpfk.',
      '.kfpffffffffpfk.',
      'ckffffffffffffkc',
      'ckffkwffffwkffkc',
      'ckffkkffffkkffkc',
      'ckfffffnnfffffkc',
      'ckffffkffkffffkc',
      'ckfffffkkfffffkc',
      'mmkkffffffffkk..',
      '...kddddddddk...',
      '..kddddddddddk..',
      '..kddlddddlddk..',
      '..kkkkkkkkkkkk..'
    ].map(r => r.slice(0, 16).padEnd(16, '.'))
  },
  l1: { pal: { g: '#2fbf71', d: '#1a7a47', b: '#8a5a3c' }, rows: ['..........', '...gg.gg..', '..gggggg..', '...gggg...', '....dd....', '....dd....', '....dd....', '..bbbbbb..', '.bbbbbbbb.', '..bbbbbb..'] },
  l2: { pal: { k: '#173a6e', b: '#3b8cff', g: '#7dffb2' }, rows: ['.kkkkkkkk.', '.kbbbbbbk.', '.kbgbbbbk.', '.kkkkkkkk.', '.kbbbbbbk.', '.kbgbbbbk.', '.kkkkkkkk.', '.kbbbbbbk.', '.kbgbbbbk.', '.kkkkkkkk.'] },
  l3: { pal: { k: '#7a4a00', y: '#f0a63a' }, rows: ['.kkkkkkkk.', 'kyyyyyyyyk', 'kyyyyyyyyk', 'kyyykkyyyk', 'kyyykkyyyk', 'kyyyyyyyyk', '.kyyyyyyk.', '..kyyyyk..', '...kyyk...', '....kk....'] },
  l4: { pal: { k: '#5a1210', r: '#e5534b' }, rows: ['..k....k..', '...k..k...', '....rr....', '.k.rrrr.k.', '..krrrrk..', '.k.rrrr.k.', '..krrrrk..', '.k.rrrr.k.', '....rr....', '..........'] },
  l5: { pal: { y: '#ffd76a', v: '#a77bff' }, rows: ['......yy..', '.....yy...', '....yy....', '...yyyyy..', '..yyyyy...', '.....yy...', '....yy....', '...yy.....', '..y.......', '..........'] },
  m_guided: { pal: { y: '#ffd76a', w: '#fff6c9', g: '#8a8fb0' }, rows: ['...yyyy...', '..yyyyyy..', '..yywwyy..', '..yyyyyy..', '...yyyy...', '....yy....', '...gggg...', '....gg....', '...gggg...', '..........'] },
  m_free: { pal: { k: '#1a1033', d: '#2b1f57', c: '#22d3ee' }, rows: ['kkkkkkkkkk', 'kddddddddk', 'kdcdddddck', 'kddcdddddk', 'kdcdddddck', 'kddddddddk', 'kdddcccddk', 'kddddddddk', 'kkkkkkkkkk', '..........'] },
  m_timed: { pal: { k: '#1a1033', w: '#f3efff', r: '#ff6b81' }, rows: ['..kkkkkk..', '.kwwwwwwk.', 'kwwwrwwwwk', 'kwwwrwwwwk', 'kwwwrrrwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kkkkkk..', '..........'] }
};

UI.pixelSvg = function (name, size) {
  const s = SPRITES[name]; if (!s) return '';
  const w = s.rows[0].length, hh = s.rows.length; const out = [];
  s.rows.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const ch = row[x]; if (ch === '.' || !s.pal[ch]) { x++; continue; }
      let n = 1; while (x + n < w && row[x + n] === ch) n++;
      out.push('<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + s.pal[ch] + '"/>'); x += n;
    }
  });
  const px = size || 4;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + hh + '" width="' + w * px + '" height="' + hh * px + '" shape-rendering="crispEdges" aria-hidden="true">' + out.join('') + '</svg>';
};
/* Corps d'un sprite (rectangles seuls), pour l'insérer dans une autre scène SVG : { w, h, body } */
UI.pixelBody = function (name) {
  const s = SPRITES[name]; if (!s) return { w: 0, h: 0, body: '' };
  const w = s.rows[0].length, out = [];
  s.rows.forEach((row, y) => { let x = 0; while (x < w) { const ch = row[x]; if (ch === '.' || !s.pal[ch]) { x++; continue; } let n = 1; while (x + n < w && row[x + n] === ch) n++; out.push('<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + s.pal[ch] + '"/>'); x += n; } });
  return { w, h: s.rows.length, body: out.join('') };
};
UI.pixel = function (name, px) { return UI.svg(UI.pixelSvg(name, px)); };
UI.pixelNames = Object.keys(SPRITES);
})(typeof window !== 'undefined' ? window : globalThis);
