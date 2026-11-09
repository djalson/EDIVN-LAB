/* ============================================================================
   Éditeurs de terminal : nano et vi (sous-ensemble courant de vim-tiny).
   Contrat : UI.nanoEditor(root, ed, save, done, term) / UI.viEditor(...)
     ed   = { editor, path, name, text, exists, readonly }
     save = (path, text) => { ok, msg? }
     done = ({ msg?, ok? }) => void        (rend la main au terminal)
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h;
SIM.AVREG['nano-ui-texts'] = 'Interface nano : version affichée (« GNU nano 8.4 »), libellés du pied de page (^G Aide… ^X Exit) et messages d’état reconstitués de mémoire ; à comparer à la version réellement installée.';
SIM.AVREG['vi-ui-texts'] = 'Interface vi (vim-tiny de Debian) : messages « E37 », « E492 », format « "fichier" nL, nB written » exacts d’après la documentation de vim ; absence de numéro de ligne/colonne en barre d’état supposée (ruler désactivé par défaut).';

const nLines = t => (t === '' ? 0 : t.replace(/\n$/, '').split('\n').length);
const bytes = t => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(t).length : t.length);

/* ------------------------------------------------------------------ nano */
UI.nanoEditor = function (root, ed, save, done, term) {
  let modified = false; let path = ed.path; let name = ed.name || ''; let mode = 'edit'; let prompt = null; let cut = '';
  const header = h('div.nhead'); const ta = h('textarea.ntext', { wrap: 'off', spellcheck: false, value: ed.text || '' });
  const status = h('div.nstatus'); const foot = h('div.nfoot');
  const FOOT = [['^G', 'Help'], ['^O', 'Write Out'], ['^W', 'Where Is'], ['^K', 'Cut'], ['^T', 'Execute'], ['^C', 'Location'], ['^X', 'Exit'], ['^R', 'Read File'], ['^\\', 'Replace'], ['^U', 'Paste'], ['^J', 'Justify'], ['^/', 'Go To Line']];
  const drawFoot = (items) => { UI.clear(foot); (items || FOOT).forEach(([k, l]) => foot.append(h('span.nkey', h('b', k), ' ' + l))); };
  const drawHead = () => { UI.clear(header); header.append(h('span', '  GNU nano 8.4'), h('span.nname', name || 'New Buffer'), h('span.nmod', modified ? 'Modified  ' : '  ')); };
  const msg = t => { UI.clear(status); status.append(h('span.nmsg', '[ ' + t + ' ]')); clearTimeout(msg.t); msg.t = setTimeout(() => { if (!prompt) UI.clear(status); }, 4000); };
  root.append(header, ta, status, foot); drawFoot(); drawHead();
  if (ed.exists) msg('Read ' + nLines(ed.text || '') + ' line' + (nLines(ed.text || '') === 1 ? '' : 's') + ' '); else if (ed.path || ed.name) msg('New File');
  ta.addEventListener('input', () => { modified = true; drawHead(); });
  setTimeout(() => ta.focus(), 0);
  const askName = (label, initial, cb, items) => {
    mode = 'prompt'; UI.clear(status);
    const inp = h('input.ninput', { value: initial || '', spellcheck: false });
    status.append(h('span.nlabel', label), inp); prompt = { cb }; drawFoot(items || [['^C', 'Cancel']]); setTimeout(() => inp.focus(), 0);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const v = inp.value; closePrompt(); cb(v); }
      else if (e.key === 'Escape' || (e.ctrlKey && e.key === 'c')) { e.preventDefault(); closePrompt(); msg('Cancelled'); ta.focus(); }
      e.stopPropagation();
    });
  };
  const closePrompt = () => { prompt = null; mode = 'edit'; UI.clear(status); drawFoot(); };
  const doWrite = (file, then) => {
    const target = file || path; if (!target) { askName('File Name to Write: ', '', f => doWrite(f, then)); return; }
    let text = ta.value; if (text && !/\n$/.test(text)) text += '\n';
    const r = save(target, text);
    if (!r.ok) { msg('Error writing ' + (name || target) + ': ' + r.msg); ta.focus(); return; }
    path = target; if (!name) name = target; modified = false; drawHead(); msg('Wrote ' + nLines(text) + ' line' + (nLines(text) === 1 ? '' : 's')); ta.focus();
    if (then) then();
  };
  const exit = () => {
    if (!modified) { done({}); return; }
    mode = 'confirm'; UI.clear(status); status.append(h('span.nlabel', 'Save modified buffer?  (Answering "No" will DISCARD changes.) ')); drawFoot([[' Y', 'Yes'], [' N', 'No  '], ['^C', 'Cancel']]);
    const onKey = e => {
      const k = e.key.toLowerCase();
      if (k === 'y') { e.preventDefault(); document.removeEventListener('keydown', onKey, true); closePrompt(); doWrite(null, () => done({})); }
      else if (k === 'n') { e.preventDefault(); document.removeEventListener('keydown', onKey, true); closePrompt(); done({}); }
      else if ((e.ctrlKey && k === 'c') || k === 'escape') { e.preventDefault(); document.removeEventListener('keydown', onKey, true); closePrompt(); ta.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
  };
  const lineInfo = () => { const v = ta.value.slice(0, ta.selectionStart); const l = v.split('\n'); return { line: l.length, col: l[l.length - 1].length + 1, total: Math.max(1, ta.value.split('\n').length) }; };
  ta.addEventListener('keydown', e => {
    if (mode !== 'edit') return;
    if (!e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'o') { e.preventDefault(); askName('File Name to Write: ', path || '', f => doWrite(f), [['^G', 'Help'], ['M-D', 'DOS Format'], ['^C', 'Cancel'], ['M-A', 'Append'], ['M-B', 'Backup File']]); }
    else if (k === 'x') { e.preventDefault(); exit(); }
    else if (k === 'k') {
      e.preventDefault(); const v = ta.value; const s = ta.selectionStart; const a = v.lastIndexOf('\n', s - 1) + 1; let b = v.indexOf('\n', s); b = b < 0 ? v.length : b + 1;
      cut = v.slice(a, b); ta.value = v.slice(0, a) + v.slice(b); ta.selectionStart = ta.selectionEnd = a; modified = true; drawHead();
    }
    else if (k === 'u') { e.preventDefault(); if (cut) { const s = ta.selectionStart; const v = ta.value; const a = v.lastIndexOf('\n', s - 1) + 1; ta.value = v.slice(0, a) + cut + v.slice(a); ta.selectionStart = ta.selectionEnd = a + cut.length; modified = true; drawHead(); } }
    else if (k === 'w') {
      e.preventDefault(); askName('Search: ', '', q => { if (!q) return; const i = ta.value.indexOf(q, ta.selectionEnd); const j = i < 0 ? ta.value.indexOf(q) : i; if (j < 0) { msg('"' + q + '" not found'); } else { ta.focus(); ta.selectionStart = j; ta.selectionEnd = j + q.length; } ta.focus(); });
    }
    else if (k === 'c') { e.preventDefault(); const i = lineInfo(); msg('line ' + i.line + '/' + i.total + ' (' + Math.round(100 * i.line / i.total) + '%), col ' + i.col + '/' + (ta.value.split('\n')[i.line - 1].length + 1)); }
    else if (k === '_' || k === '/') { e.preventDefault(); askName('Enter line number, column number: ', '', v => { const n = parseInt(v, 10); if (n > 0) { const ls = ta.value.split('\n'); let off = 0; for (let i = 0; i < Math.min(n - 1, ls.length - 1); i++) off += ls[i].length + 1; ta.focus(); ta.selectionStart = ta.selectionEnd = off; } ta.focus(); }); }
    else if (k === 'a') { e.preventDefault(); const v = ta.value; const a = v.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.selectionStart = ta.selectionEnd = a; }
    else if (k === 'e') { e.preventDefault(); const v = ta.value; let b = v.indexOf('\n', ta.selectionStart); if (b < 0) b = v.length; ta.selectionStart = ta.selectionEnd = b; }
    else if (k === 'g') { e.preventDefault(); msg('Aide non disponible dans cette simulation'); }
    else if (k === 'z') { /* annuler : comportement natif du navigateur */ }
  });
};

/* ------------------------------------------------------------------ vi */
UI.viEditor = function (root, ed, save, done, term) {
  let lines = (ed.text || '').replace(/\n$/, '').split('\n'); if (ed.text === '' || ed.text === undefined) lines = [''];
  let path = ed.path, name = ed.name || ''; let r = 0, c = 0, top = 0; let mode = 'n'; let pend = ''; let modified = false; let reg = null; let regLine = false; let cmd = null; let message = ''; let nu = false; let search = null; let undo = []; let wantCol = 0;
  const snap = () => { undo.push({ lines: lines.slice(), r, c }); if (undo.length > 100) undo.shift(); };
  const pre = h('pre.tpre.vi', { tabindex: 0 }); root.append(pre);
  const rows = () => Math.max(4, Math.floor(root.clientHeight / (term && term.opts.lineH || 17))) - 1;
  const clampC = () => { const n = lines[r].length; const max = mode === 'i' ? n : Math.max(0, n - 1); if (c > max) c = max; if (c < 0) c = 0; };
  const setMsg = t => { message = t; };
  const fileMsg = () => '"' + (name || path) + '" ' + (ed.exists ? nLines(ed.text || '') + 'L, ' + bytes(ed.text || '') + 'B' : '[New]');
  setMsg(name || path ? fileMsg() : '');
  const draw = () => {
    const R = rows(); if (r < top) top = r; if (r >= top + R) top = r - R + 1;
    const out = [];
    for (let i = top; i < top + R; i++) {
      if (i >= lines.length) { out.push({ t: '~' }); continue; }
      let ln = lines[i]; const num = nu ? String(i + 1).padStart(String(lines.length).length + 1, ' ') + ' ' : '';
      if (i === r) { const ch = ln[c] === undefined ? ' ' : ln[c]; out.push({ h: esc(num + ln.slice(0, c)) + '<span class="vcur">' + esc(ch) + '</span>' + esc(ln.slice(c + 1)) }); } else out.push({ t: num + ln });
    }
    let st = cmd !== null ? cmd : (message || (mode === 'i' ? '-- INSERT --' : mode === 'R' ? '-- REPLACE --' : ''));
    /* les lignes sont échappées une seule fois ; seul le curseur porte du balisage (généré ici) */
    pre.innerHTML = out.map(x => x.h !== undefined ? x.h : esc(x.t)).join('\n') + '\n' + esc(st);
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wordFwd = () => { let rr = r, cc = c; const isW = ch => /\w/.test(ch); let ln = lines[rr]; if (cc < ln.length) { const t = isW(ln[cc]); while (cc < ln.length && isW(ln[cc]) === t && !/\s/.test(ln[cc])) cc++; } while (true) { ln = lines[rr]; while (cc < ln.length && /\s/.test(ln[cc])) cc++; if (cc < ln.length) break; if (rr + 1 >= lines.length) { cc = Math.max(0, ln.length - 1); break; } rr++; cc = 0; if (lines[rr].length && !/\s/.test(lines[rr][0])) break; } r = rr; c = cc; };
  const wordBack = () => { let rr = r, cc = c; const isW = ch => /\w/.test(ch); cc--; while (true) { if (cc < 0) { if (rr === 0) { cc = 0; break; } rr--; cc = lines[rr].length - 1; continue; } if (/\s/.test(lines[rr][cc] || ' ')) { cc--; continue; } break; } const t = isW(lines[rr][cc] || ''); while (cc > 0 && isW(lines[rr][cc - 1]) === t && !/\s/.test(lines[rr][cc - 1])) cc--; r = rr; c = Math.max(0, cc); };
  const finish = (m) => { done(m || {}); };
  const writeFile = (file) => {
    const target = file || path; if (!target) { setMsg('E32: No file name'); return false; }
    let text = lines.join('\n') + '\n'; if (lines.length === 1 && lines[0] === '') text = '';
    const res = save(target, text);
    if (!res.ok) { setMsg('"' + target + '" E212: Can\'t open file for writing'); return false; }
    path = target; if (!name) name = target; modified = false; const isNew = !ed.exists && !ed._wrote; ed._wrote = true;
    setMsg('"' + target + '" ' + (isNew ? '[New] ' : '') + nLines(text) + 'L, ' + bytes(text) + 'B written'); return true;
  };
  const exCmd = (s) => {
    s = s.trim(); if (!s) return;
    let m;
    if (/^\d+$/.test(s)) { r = Math.min(lines.length - 1, Math.max(0, parseInt(s, 10) - 1)); c = 0; return; }
    if (s === '$') { r = lines.length - 1; c = 0; return; }
    if (s === 'w' || /^w\s+\S/.test(s)) { writeFile(s.slice(1).trim() || null); return; }
    if (s === 'wq' || s === 'x' || s === 'wq!' || s === 'x!' || s === 'xit') { if (s[0] === 'x' && !modified) { finish(); return; } if (writeFile(null)) finish(); return; }
    if (s === 'q') { if (modified) { setMsg('E37: No write since last change (add ! to override)'); return; } finish(); return; }
    if (s === 'q!' || s === 'qa!' || s === 'qa') { if (s === 'qa' && modified) { setMsg('E37: No write since last change (add ! to override)'); return; } finish(); return; }
    if (s === 'set nu' || s === 'set number') { nu = true; return; } if (s === 'set nonu' || s === 'set nonumber') { nu = false; return; }
    if (/^set\s/.test(s)) return;
    if ((m = s.match(/^(%|\.)?s\/((?:[^\/\\]|\\.)*)\/((?:[^\/\\]|\\.)*)\/?([gi]*)$/))) {
      let re; try { re = new RegExp(m[2], (m[4].indexOf('g') >= 0 ? 'g' : '') + (m[4].indexOf('i') >= 0 ? 'i' : '')); } catch (e) { setMsg('E486: Pattern not found: ' + m[2]); return; }
      snap(); let cnt = 0; const from = m[1] === '%' ? 0 : r, to = m[1] === '%' ? lines.length - 1 : r;
      for (let i = from; i <= to; i++) { const nl = lines[i].replace(re, (x) => { cnt++; return m[3].replace(/\\\//g, '/'); }); if (nl !== lines[i]) { lines[i] = nl; modified = true; } }
      if (!cnt) { undo.pop(); setMsg('E486: Pattern not found: ' + m[2]); } else if (cnt > 2) setMsg(cnt + ' substitutions on ' + (to - from + 1) + ' lines');
      return;
    }
    if ((m = s.match(/^(\d+)?,?(\d+)?d$/)) || s === 'd') { snap(); const a = m && m[1] ? +m[1] - 1 : r; const b = m && m[2] ? +m[2] - 1 : a; lines.splice(a, b - a + 1); if (!lines.length) lines = ['']; r = Math.min(r, lines.length - 1); modified = true; return; }
    setMsg('E492: Not an editor command: ' + s);
  };
  const doSearch = (dir) => {
    if (!search) { setMsg('E35: No previous regular expression'); return; }
    let re; try { re = new RegExp(search); } catch (e) { re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
    const n = lines.length;
    for (let k = 0; k <= n; k++) {
      const i = ((r + dir * k) % n + n) % n; const ln = lines[i]; let idx;
      if (dir > 0) { const start = (k === 0 ? c + 1 : 0); const sub = ln.slice(start); const mm = sub.search(re); idx = mm < 0 ? -1 : start + mm; }
      else { const limit = (k === 0 ? c : ln.length); let best = -1; const gre = new RegExp(re.source, 'g'); let mm; while ((mm = gre.exec(ln)) && mm.index < limit) { best = mm.index; if (mm[0] === '') gre.lastIndex++; } idx = best; }
      if (idx >= 0) { r = i; c = idx; if (k > 0 && ((dir > 0 && i <= (r)) || false)) { } return; }
    }
    setMsg('E486: Pattern not found: ' + search);
  };
  const key = (e) => {
    if (e.ctrlKey && e.key !== 'r' && !(e.key === 'f' || e.key === 'b' || e.key === 'd' || e.key === 'u' || e.key === '[' || e.key === 'c')) return;
    const k = e.key; if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'Dead') return;
    if (e.ctrlKey && k === 'c') { e.preventDefault(); if (mode === 'i') { mode = 'n'; if (c > 0) c--; } cmd = null; pend = ''; draw(); return; }
    e.preventDefault();
    if (cmd !== null) {
      if (k === 'Enter') { const s = cmd; cmd = null; if (s[0] === ':') exCmd(s.slice(1)); else if (s[0] === '/' || s[0] === '?') { search = s.slice(1) || search; doSearch(s[0] === '/' ? 1 : -1); } }
      else if (k === 'Escape') cmd = null; else if (k === 'Backspace') { cmd = cmd.length > 1 ? cmd.slice(0, -1) : null; } else if (k.length === 1) cmd += k;
      clampC(); draw(); return;
    }
    if (mode === 'i' || mode === 'R') {
      if (k === 'Escape' || (e.ctrlKey && k === '[')) { mode = 'n'; if (c > 0) c--; message = ''; }
      else if (k === 'Enter') { const ln = lines[r]; lines[r] = ln.slice(0, c); lines.splice(r + 1, 0, ln.slice(c)); r++; c = 0; modified = true; }
      else if (k === 'Backspace') { if (c > 0) { lines[r] = lines[r].slice(0, c - 1) + lines[r].slice(c); c--; modified = true; } else if (r > 0) { c = lines[r - 1].length; lines[r - 1] += lines[r]; lines.splice(r, 1); r--; modified = true; } }
      else if (k === 'Delete') { if (c < lines[r].length) { lines[r] = lines[r].slice(0, c) + lines[r].slice(c + 1); modified = true; } }
      else if (k === 'ArrowLeft') c = Math.max(0, c - 1); else if (k === 'ArrowRight') c = Math.min(lines[r].length, c + 1);
      else if (k === 'ArrowUp') { r = Math.max(0, r - 1); } else if (k === 'ArrowDown') { r = Math.min(lines.length - 1, r + 1); }
      else if (k === 'Tab') { lines[r] = lines[r].slice(0, c) + '\t' + lines[r].slice(c); c++; modified = true; }
      else if (k.length === 1) { if (mode === 'R') lines[r] = lines[r].slice(0, c) + k + lines[r].slice(c + 1); else lines[r] = lines[r].slice(0, c) + k + lines[r].slice(c); c++; modified = true; }
      if (mode === 'i') c = Math.min(c, lines[r].length); else clampC(); draw(); return;
    }
    /* mode normal */
    message = '';
    const n = pend;
    const move = () => { clampC(); };
    if (/^\d$/.test(k) && !(k === '0' && !/\d$/.test(pend))) { pend += k; draw(); return; }
    const cnt = parseInt(pend, 10) || 1; const op = pend.replace(/\d+/g, ''); const full = op + k; pend = '';
    switch (full) {
      case 'h': case 'ArrowLeft': c = Math.max(0, c - cnt); break;
      case 'l': case 'ArrowRight': c = Math.min(lines[r].length - 1, c + cnt); break;
      case 'j': case 'ArrowDown': r = Math.min(lines.length - 1, r + cnt); c = Math.min(Math.max(wantCol, c), Math.max(0, lines[r].length - 1)); break;
      case 'k': case 'ArrowUp': r = Math.max(0, r - cnt); c = Math.min(Math.max(wantCol, c), Math.max(0, lines[r].length - 1)); break;
      case '0': case 'Home': c = 0; break;
      case '$': case 'End': c = Math.max(0, lines[r].length - 1); break;
      case '^': c = Math.max(0, lines[r].search(/\S|$/)); break;
      case 'w': for (let i = 0; i < cnt; i++) wordFwd(); break;
      case 'b': for (let i = 0; i < cnt; i++) wordBack(); break;
      case 'G': r = /\d/.test(n) ? Math.min(lines.length - 1, cnt - 1) : lines.length - 1; c = 0; break;
      case 'g': pend = 'g'; draw(); return;
      case 'gg': r = cnt > 1 ? Math.min(lines.length - 1, cnt - 1) : 0; c = 0; break;
      case 'i': snap(); mode = 'i'; break;
      case 'a': snap(); mode = 'i'; c = Math.min(lines[r].length, c + 1); break;
      case 'I': snap(); mode = 'i'; c = Math.max(0, lines[r].search(/\S|$/)); break;
      case 'A': snap(); mode = 'i'; c = lines[r].length; break;
      case 'o': snap(); lines.splice(r + 1, 0, ''); r++; c = 0; mode = 'i'; modified = true; break;
      case 'O': snap(); lines.splice(r, 0, ''); c = 0; mode = 'i'; modified = true; break;
      case 'R': snap(); mode = 'R'; break;
      case 'x': snap(); if (lines[r].length) { reg = lines[r].slice(c, c + cnt); regLine = false; lines[r] = lines[r].slice(0, c) + lines[r].slice(c + cnt); modified = true; } break;
      case 'X': if (c > 0) { snap(); lines[r] = lines[r].slice(0, c - 1) + lines[r].slice(c); c--; modified = true; } break;
      case 'r': pend = 'r'; draw(); return;
      case 'D': snap(); reg = lines[r].slice(c); regLine = false; lines[r] = lines[r].slice(0, c); modified = true; break;
      case 'C': snap(); reg = lines[r].slice(c); regLine = false; lines[r] = lines[r].slice(0, c); mode = 'i'; modified = true; break;
      case 'd': pend = 'd'; draw(); return;
      case 'dd': snap(); reg = lines.slice(r, r + cnt).join('\n'); regLine = true; lines.splice(r, cnt); if (!lines.length) lines = ['']; r = Math.min(r, lines.length - 1); c = 0; modified = true; break;
      case 'dw': snap(); { const ln = lines[r]; let e2 = c; for (let i = 0; i < cnt; i++) { while (e2 < ln.length && !/\s/.test(ln[e2])) e2++; while (e2 < ln.length && /\s/.test(ln[e2])) e2++; } reg = ln.slice(c, e2); regLine = false; lines[r] = ln.slice(0, c) + ln.slice(e2); modified = true; } break;
      case 'c': pend = 'c'; draw(); return;
      case 'cc': snap(); reg = lines[r]; regLine = true; lines[r] = ''; c = 0; mode = 'i'; modified = true; break;
      case 'cw': snap(); { const ln = lines[r]; let e2 = c; while (e2 < ln.length && !/\s/.test(ln[e2])) e2++; reg = ln.slice(c, e2); regLine = false; lines[r] = ln.slice(0, c) + ln.slice(e2); mode = 'i'; modified = true; } break;
      case 'y': pend = 'y'; draw(); return;
      case 'yy': reg = lines.slice(r, r + cnt).join('\n'); regLine = true; setMsg(cnt > 1 ? cnt + ' lines yanked' : ''); break;
      case 'p': if (reg !== null) { snap(); if (regLine) { lines.splice(r + 1, 0, ...reg.split('\n')); r++; c = 0; } else { lines[r] = lines[r].slice(0, c + 1) + reg + lines[r].slice(c + 1); c += reg.length; } modified = true; } break;
      case 'P': if (reg !== null) { snap(); if (regLine) { lines.splice(r, 0, ...reg.split('\n')); c = 0; } else { lines[r] = lines[r].slice(0, c) + reg + lines[r].slice(c); c += reg.length - 1; } modified = true; } break;
      case 'J': if (r + 1 < lines.length) { snap(); c = lines[r].length; lines[r] = lines[r].replace(/\s+$/, '') + ' ' + lines[r + 1].replace(/^\s+/, ''); lines.splice(r + 1, 1); modified = true; } break;
      case 'u': if (undo.length) { const u = undo.pop(); lines = u.lines; r = u.r; c = u.c; modified = true; setMsg('1 change; before #1'); } else setMsg('Already at oldest change'); break;
      case 'Z': pend = 'Z'; draw(); return;
      case 'ZZ': if (modified) { if (writeFile(null)) finish(); } else finish(); return;
      case ':': cmd = ':'; draw(); return;
      case '/': cmd = '/'; draw(); return;
      case '?': cmd = '?'; draw(); return;
      case 'n': doSearch(1); break;
      case 'N': doSearch(-1); break;
      case 'Escape': break;
      default:
        if (op === 'r' && k.length === 1) { snap(); if (lines[r].length) { lines[r] = lines[r].slice(0, c) + k + lines[r].slice(c + 1); modified = true; } }
        break;
    }
    if (full !== 'j' && full !== 'k' && full !== 'ArrowUp' && full !== 'ArrowDown') wantCol = c;
    move(); draw();
  };
  root.addEventListener('keydown', key);
  root.setAttribute('tabindex', 0);
  root.addEventListener('paste', e => { if (mode !== 'i') return; e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text'); t.split(/\r?\n/).forEach((ln, i) => { if (i > 0) { const x = lines[r]; lines[r] = x.slice(0, c); lines.splice(r + 1, 0, x.slice(c)); r++; c = 0; } lines[r] = lines[r].slice(0, c) + ln + lines[r].slice(c); c += ln.length; modified = true; }); draw(); });
  draw(); setTimeout(() => root.focus(), 0);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
