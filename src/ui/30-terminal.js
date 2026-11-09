/* ============================================================================
   Widget terminal : véritable émulateur de saisie au-dessus des sessions de src/emu.
   - saisie ligne (curseur, historique, Tab, « ? » Cisco, Ctrl+C / Ctrl+L / Ctrl+D)
   - sorties retardées (ping), flux (ping -t, tail -f, journalctl -f), mots de passe masqués
   - pagination IOS « --More-- », pager « less », éditeurs nano / vi (31-editor.js)
   - pile de sessions (powershell depuis cmd, nslookup, ssh imbriqués)
   Aucune réponse n'est écrite ici : tout vient de session.exec().
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h;

function Terminal(opts) {
  opts = opts || {};
  this.opts = opts; this.theme = opts.theme || 'cmd';
  this.stack = []; this.buf = ''; this.pos = 0; this.hi = -1; this.draft = ''; this.busy = false; this.queue = []; this.stream = null; this.pager = null; this.edit = null; this.more = null; this.tabs = 0; this.maxLines = 4000;
  this.el = h('div.term.t-' + this.theme, { tabindex: 0 });
  this.scroll = h('div.tscroll');
  this.out = h('div.tout'); this.line = h('div.tline'); this.pEl = h('span.tp'); this.bEl = h('span.tb'); this.cEl = h('span.tc', ' ');
  this.line.append(this.pEl, this.bEl);
  this.scroll.append(this.out, this.line);
  this.ta = h('textarea.tin', { autocapitalize: 'off', autocomplete: 'off', spellcheck: false, 'aria-label': 'Saisie du terminal' });
  this.el.append(this.scroll, this.ta);
  this._bind();
  if (opts.session) this.start(opts.session, opts.banner !== false);
  if (UI.cmdHelp && opts.help !== false) UI.cmdHelp.attach(this);
  if (UI.vault && UI.vault.termAttach) UI.vault.termAttach(this);
}
UI.Terminal = Terminal;
const P = Terminal.prototype;

P.session = function () { return this.stack[this.stack.length - 1] || null; };
P.start = function (sess, banner) {
  this.stack = [sess];
  if (banner !== false) this.print(sess.banner ? sess.banner() : []);
  this.render();
};
P.focus = function () { this.ta.focus({ preventScroll: true }); };
P.destroy = function () { this._stopStream(); this.destroyed = true; };

/* ------------------------------------------------------------------ rendu */
const cls = k => (k && k !== 'o' ? ' k-' + k : '');
P._lineEl = function (l) {
  const t = typeof l === 'string' ? l : l.t; const k = typeof l === 'string' ? 'o' : l.k;
  return h('div.tl' + cls(k), t === '' ? '​' : t);
};
P.print = function (lines, instant) {
  const arr = (lines || []).map(x => typeof x === 'string' ? { t: x, k: 'o', d: 0 } : x);
  if (instant) { arr.forEach(l => this.out.appendChild(this._lineEl(l))); this._trim(); this._bottom(); return; }
  this.queue = this.queue.concat(arr); this._drain();
};
P._trim = function () { while (this.out.childNodes.length > this.maxLines) this.out.removeChild(this.out.firstChild); };
P._bottom = function () { this.scroll.scrollTop = this.scroll.scrollHeight; };
P._drain = function () {
  if (this.draining) return; this.draining = true; this.busy = true; this.render();
  const step = () => {
    if (this.destroyed) return;
    if (!this.queue.length) { this.draining = false; this.busy = false; this._afterDrain(); return; }
    const l = this.queue.shift();
    const show = () => { if (this.destroyed) return; this.out.appendChild(this._lineEl(l)); this._trim(); this._bottom(); if (this._pageCheck()) return; step(); };
    if (l.d && l.d > 0 && !this.skipDelay) this.timer = setTimeout(show, Math.min(l.d, 1500)); else show();
  };
  step();
};
P._afterDrain = function () {
  if (this.pendingStream) { const s = this.pendingStream; this.pendingStream = null; this._startStream(s); }
  if (this.pendingEdit) { const e = this.pendingEdit; this.pendingEdit = null; this._openEdit(e); return; }
  if (this.pendingPager) { const p = this.pendingPager; this.pendingPager = null; this._openPager(p); return; }
  if (this.pendingExit) { const f = this.pendingExit; this.pendingExit = null; f(); return; }
  this.render();
};
/* pagination IOS « --More-- » : appliquée quand la session expose termLen > 0 */
P._pageCheck = function () {
  const s = this.session(); if (!s || !s.termLen || s.kind !== 'ios') return false;
  this._lineCount = (this._lineCount || 0) + 1;
  if (this._lineCount >= Math.max(2, s.termLen - 1) && this.queue.length) {
    this.more = true; this.draining = false; this.render(); return true;
  }
  return false;
};
P._resumeMore = function (mode) {
  this.more = null;
  if (mode === 'stop') { this.queue = []; this.draining = false; this.busy = false; this._lineCount = 0; this._afterDrain(); return; }
  this._lineCount = mode === 'line' ? (this.session().termLen - 2) : 0;
  this._drain();
};
P.render = function () {
  if (this.helpBtn && UI.cmdHelp) UI.cmdHelp.refresh(this);
  if (this.vaultBtn && UI.vault) UI.vault.termRefresh(this);
  const s = this.session(); if (!s) return;
  const prompt = this.more ? ' --More-- ' : (this.busy ? '' : (this.stream ? '' : s.prompt()));
  this.pEl.textContent = prompt;
  const secret = this.more ? true : (s.secret && s.secret());
  const b = this.more ? '' : (secret ? '' : this.buf);
  UI.clear(this.bEl);
  if (this.busy || this.stream || this.pager || this.edit) { this.line.style.display = (this.busy || this.stream) ? 'none' : 'none'; this._bottom(); return; }
  this.line.style.display = '';
  const pre = b.slice(0, this.pos), cur = b.slice(this.pos, this.pos + 1), post = b.slice(this.pos + 1);
  this.bEl.append(document.createTextNode(pre), h('span.tcur', cur === '' ? ' ' : cur), document.createTextNode(post));
  this._bottom();
};
P.clearScreen = function () { UI.clear(this.out); this._lineCount = 0; };

/* ------------------------------------------------------------------ événements */
P._bind = function () {
  const self = this;
  this.el.addEventListener('mousedown', function (e) { if (window.getSelection && String(window.getSelection()).length) return; setTimeout(() => self.focus(), 0); });
  this.el.addEventListener('click', function () { if (!(window.getSelection && String(window.getSelection()).length)) self.focus(); });
  this.ta.addEventListener('input', function () { const v = self.ta.value; self.ta.value = ''; if (v && self._acceptsText()) self._insert(v.replace(/\r?\n/g, ' ').replace(/\t/g, ' ')); });
  this.ta.addEventListener('paste', function (e) {
    const t = (e.clipboardData || window.clipboardData).getData('text'); if (!t) return; e.preventDefault();
    if (!self._acceptsText()) return;
    const lines = t.split(/\r?\n/); lines.forEach((ln, i) => { self._insert(ln); if (i < lines.length - 1) self._enter(); });
  });
  this.ta.addEventListener('keydown', function (e) { self._key(e); });
};
P._acceptsText = function () { return !this.busy && !this.stream && !this.pager && !this.edit && !this.more; };
P._insert = function (txt) { this.buf = this.buf.slice(0, this.pos) + txt + this.buf.slice(this.pos); this.pos += txt.length; this.tabs = 0; this.render(); };
P._key = function (e) {
  const s = this.session(); if (!s) return;
  const k = e.key; const ctrl = e.ctrlKey && !e.altKey, meta = e.metaKey;
  if (this.edit) return;                         /* l'éditeur gère ses propres touches */
  if (this.pager) { e.preventDefault(); this._pagerKey(e); return; }
  if (this.more) {
    e.preventDefault();
    if (k === ' ') this._resumeMore('page'); else if (k === 'Enter') this._resumeMore('line'); else if (k.length === 1 || k === 'Escape' || ctrl) this._resumeMore('stop');
    return;
  }
  if (ctrl && (k === 'c' || k === 'C')) {
    const sel = window.getSelection && String(window.getSelection()); if (sel) return;   /* copier */
    e.preventDefault(); this._interrupt(); return;
  }
  if (this.busy && !this.stream) { if (ctrl && (k === 'c')) this._interrupt(); e.preventDefault(); return; }
  if (this.stream) { e.preventDefault(); return; }
  if (meta) return;
  /* coffre-fort d'identifiants : Ctrl + Espace à une invite de mot de passe */
  if (ctrl && (k === ' ' || e.code === 'Space') && s.secret && s.secret()) { e.preventDefault(); if (UI.vault) UI.vault.termKey(this, s); return; }
  if (k === 'Enter') { e.preventDefault(); this._enter(); return; }
  if (k === 'Backspace') { e.preventDefault(); if (this.pos > 0) { this.buf = this.buf.slice(0, this.pos - 1) + this.buf.slice(this.pos); this.pos--; this.tabs = 0; this.render(); } return; }
  if (k === 'Delete') { e.preventDefault(); this.buf = this.buf.slice(0, this.pos) + this.buf.slice(this.pos + 1); this.render(); return; }
  if (k === 'ArrowLeft') { e.preventDefault(); if (ctrl) this.pos = this._wordLeft(); else this.pos = Math.max(0, this.pos - 1); this.render(); return; }
  if (k === 'ArrowRight') { e.preventDefault(); if (ctrl) this.pos = this._wordRight(); else this.pos = Math.min(this.buf.length, this.pos + 1); this.render(); return; }
  if (k === 'Home' || (ctrl && k === 'a')) { e.preventDefault(); this.pos = 0; this.render(); return; }
  if (k === 'End' || (ctrl && k === 'e')) { e.preventDefault(); this.pos = this.buf.length; this.render(); return; }
  if (k === 'ArrowUp' || (ctrl && k === 'p')) { e.preventDefault(); this._hist(-1); return; }
  if (k === 'ArrowDown' || (ctrl && k === 'n')) { e.preventDefault(); this._hist(1); return; }
  if (k === 'PageUp') { e.preventDefault(); this.scroll.scrollTop -= this.scroll.clientHeight * 0.8; return; }
  if (k === 'PageDown') { e.preventDefault(); this.scroll.scrollTop += this.scroll.clientHeight * 0.8; return; }
  if (k === 'Escape') { e.preventDefault(); if (this.theme === 'cmd' || this.theme === 'ps') { this.buf = ''; this.pos = 0; this.render(); } return; }
  if (k === 'Tab') { e.preventDefault(); this._tab(); return; }
  if (ctrl && k === 'l') { e.preventDefault(); if (this.theme === 'bash' || this.theme === 'ios') { this.clearScreen(); this.render(); } return; }
  if (ctrl && k === 'u') { e.preventDefault(); this.buf = this.buf.slice(this.pos); this.pos = 0; this.render(); return; }
  if (ctrl && k === 'k') { e.preventDefault(); this.buf = this.buf.slice(0, this.pos); this.render(); return; }
  if (ctrl && k === 'w') { e.preventDefault(); const p = this._wordLeft(); this.buf = this.buf.slice(0, p) + this.buf.slice(this.pos); this.pos = p; this.render(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); if (!this.buf && !s.ask && (this.theme === 'bash')) { this.print([{ t: s.prompt() + 'exit', k: 'o' }], true); this._run('exit', true); } else if (this.buf) { this.buf = this.buf.slice(0, this.pos) + this.buf.slice(this.pos + 1); this.render(); } return; }
  if (k === '?' && s.help && s.kind === 'ios' && !s.ask) { e.preventDefault(); this._help(); return; }
  /* touches imprimables : laissées au textarea (AltGr, accents, IME) */
};
P._wordLeft = function () { let p = this.pos; while (p > 0 && /\s/.test(this.buf[p - 1])) p--; while (p > 0 && !/\s/.test(this.buf[p - 1])) p--; return p; };
P._wordRight = function () { let p = this.pos; const n = this.buf.length; while (p < n && !/\s/.test(this.buf[p])) p++; while (p < n && /\s/.test(this.buf[p])) p++; return p; };
P._hist = function (dir) {
  const s = this.session(); if (s.ask) return; const H = s.history || [];
  if (dir < 0) { if (this.hi === -1) { this.draft = this.buf; this.hi = H.length; } if (this.hi > 0) this.hi--; this.buf = H[this.hi] || ''; }
  else { if (this.hi === -1) return; this.hi++; if (this.hi >= H.length) { this.hi = -1; this.buf = this.draft; } else this.buf = H[this.hi]; }
  this.pos = this.buf.length; this.render();
};
P._echoLine = function (s, text) { const p = s.prompt(); this.print([{ t: p + text, k: 'o' }], true); };
P._help = function () {
  const s = this.session(); const lines = s.help(this.buf) || [];
  this.print([{ t: s.prompt() + this.buf + '?', k: 'o' }], true); this.print(lines, true); this.render();
};
P._tab = function () {
  const s = this.session(); if (s.ask || !s.complete) return;
  const before = this.buf.slice(0, this.pos), after = this.buf.slice(this.pos);
  const c = s.complete(before); const list = c.list || []; if (!list.length) return;
  const ci = this.theme === 'cmd' || this.theme === 'ps' || this.theme === 'ios';
  const common = SIM.emu.commonPrefix(list, ci);
  const word = c.word !== undefined ? c.word : before.slice(c.from);
  if (list.length === 1) {
    let rep = list[0]; const add = (this.theme === 'bash' && !/\/$/.test(rep)) ? ' ' : (this.theme === 'ios' ? ' ' : (/\\$/.test(rep) ? '' : ''));
    if ((this.theme === 'cmd' || this.theme === 'ps') && /\s/.test(rep) && !/^"/.test(rep)) rep = '"' + rep + '"';
    this.buf = before.slice(0, c.from) + rep + add + after; this.pos = c.from + rep.length + add.length; this.tabs = 0; this.render(); return;
  }
  if (common && common.length > word.length) { this.buf = before.slice(0, c.from) + common + after; this.pos = c.from + common.length; this.tabs = 0; this.render(); return; }
  if (this.theme === 'cmd' || this.theme === 'ps') {          /* cmd : cycle sur les candidats */
    this.tabIdx = ((this.tabIdx === undefined ? -1 : this.tabIdx) + 1) % list.length; const rep = list[this.tabIdx];
    this.buf = before.slice(0, c.from) + rep + after; this.pos = c.from + rep.length; this.render(); return;
  }
  this.tabs++;
  if (this.tabs >= 2 || this.theme === 'ios') {
    const w = Math.max.apply(null, list.map(x => x.length)) + 2; const cols = Math.max(1, Math.floor((this.opts.cols || 80) / w)); const rows = [];
    for (let i = 0; i < list.length; i += cols) rows.push(list.slice(i, i + cols).map(x => x + ' '.repeat(w - x.length)).join('').replace(/\s+$/, ''));
    this._echoLine(s, this.buf); this.print(rows.map(t => ({ t, k: 'o' })), true); this.tabs = 0; this.render();
  }
};
P._interrupt = function () {
  const s = this.session();
  if (this.stream) { const st = this.stream; this._stopStream(); const lines = []; if (st.echoCtrlC !== false) lines.push({ t: st.echoCtrlC || '^C', k: 'o' }); (st.stop ? st.stop() : []).forEach(x => lines.push(typeof x === 'string' ? { t: x, k: 'o' } : x)); this.print(lines, true); this.busy = false; this.render(); this.focus(); return; }
  if (this.draining || this.queue.length) { const rest = this.queue; this.queue = []; clearTimeout(this.timer); this.draining = false; this.busy = false; rest.forEach(l => this.out.appendChild(this._lineEl(l))); this._bottom(); this._afterDrain(); return; }
  if (s && s.ask) { s.ask = null; this.print([{ t: s.prompt ? '' : '', k: 'o' }], true); this.buf = ''; this.pos = 0; this.render(); return; }
  const echo = this.theme === 'bash' ? '^C' : (this.theme === 'ios' ? '' : '^C');
  this.print([{ t: s.prompt() + this.buf + echo, k: 'o' }], true); this.buf = ''; this.pos = 0; this.hi = -1; this.render();
};

/* ------------------------------------------------------------------ exécution */
P._enter = function () {
  const s = this.session(); const text = this.buf; const secret = s.secret && s.secret();
  this.print([{ t: s.prompt() + (secret ? '' : text), k: 'o' }], true);
  this.buf = ''; this.pos = 0; this.hi = -1; this.tabs = 0; this.tabIdx = undefined; this._lineCount = 0;
  const filled = this._vaultFilled === text; this._vaultFilled = null;
  const res = this._run(text, false);
  /* saisie manuelle réussie d'un mot de passe : compte pour le succès « Mémoire des doigts » */
  if (secret && !filled && text.length >= 3 && !s.ask && res && res.ok !== false && !(res.out || []).some(l => l.k === 'e') && UI.vault) UI.vault.manual(text);
};
P._run = function (text, noEcho) {
  const s = this.session(); let res;
  try { res = s.exec(text); } catch (e) { res = { out: [{ t: 'Erreur interne de l’émulateur : ' + e.message, k: 'e', d: 0 }] }; if (typeof console !== 'undefined') console.error(e); }
  this._apply(res, s);
  if (this.opts.onExec) this.opts.onExec(text, res, s);
  return res;
};
P._apply = function (res, s) {
  if (res.clear) { this.clearScreen(); }
  if (res.out && res.out.length) this.print(res.out);
  if (res.launch && this.opts.onLaunch) this.opts.onLaunch(res.launch, s);
  if (res.push) { const ns = res.push; this.stack.push(ns); if (ns.banner && !res.out.length) this.print(ns.banner()); }
  const popping = res.pop || (res.exit && this.stack.length > 1);
  if (res.stream) this.pendingStream = res.stream;
  if (res.edit) this.pendingEdit = { edit: res.edit, session: s };
  if (res.pager) this.pendingPager = res.pager;
  if (popping && this.stack.length > 1) { this.stack.pop(); if (this.opts.onPop) this.opts.onPop(this.session()); }
  else if (res.exit) { this.pendingExit = () => { if (this.opts.onExit) this.opts.onExit(s, res); }; }
  if (this.queue.length) this._drain(); else this._afterDrain();
};
P._startStream = function (st) {
  this.stream = st; this.busy = true; this.render();
  const tick = () => {
    if (!this.stream || this.destroyed) return;
    let lines = []; try { lines = st.next() || []; } catch (e) { lines = [{ t: String(e.message), k: 'e' }]; }
    this.print(lines.map(x => typeof x === 'string' ? { t: x, k: 'o' } : x), true);
    if (this.opts.onTick) this.opts.onTick();
    this.streamTimer = setTimeout(tick, Math.max(120, st.interval || 1000));
  };
  tick();
};
P._stopStream = function () { clearTimeout(this.streamTimer); this.stream = null; this.busy = false; };

/* ------------------------------------------------------------------ pager (less) */
P._openPager = function (pg) {
  this.pager = { lines: pg.lines.map(x => typeof x === 'string' ? x : x.t), title: pg.title || '', top: 0, search: null, cmd: null };
  this.full = h('div.tfull'); this.el.appendChild(this.full); this._pagerDraw(); this.render();
};
P._rows = function () { return Math.max(5, Math.floor(this.el.clientHeight / (this.opts.lineH || 17))) - 1; };
P._pagerDraw = function () {
  const pg = this.pager; const rows = this._rows(); const max = Math.max(0, pg.lines.length - rows);
  pg.top = Math.max(0, Math.min(pg.top, max));
  const view = pg.lines.slice(pg.top, pg.top + rows);
  while (view.length < rows) view.push('~');
  const atEnd = pg.top >= max;
  const status = pg.cmd !== null ? pg.cmd : (atEnd ? '(END)' : ':');
  UI.clear(this.full); this.full.append(h('pre.tpre', view.join('\n') + '\n' + status));
};
P._pagerKey = function (e) {
  const pg = this.pager; const k = e.key; const rows = this._rows();
  if (pg.cmd !== null) {
    if (k === 'Enter') { const q = pg.cmd.slice(1); pg.cmd = null; if (q) { pg.search = q; this._pagerFind(1); } } else if (k === 'Escape') pg.cmd = null; else if (k === 'Backspace') { pg.cmd = pg.cmd.length > 1 ? pg.cmd.slice(0, -1) : null; } else if (k.length === 1) pg.cmd += k;
    this._pagerDraw(); return;
  }
  if (k === 'q' || k === 'Q') { this._closePager(); return; }
  if (k === ' ' || k === 'f' || k === 'PageDown') pg.top += rows; else if (k === 'b' || k === 'PageUp') pg.top -= rows;
  else if (k === 'j' || k === 'Enter' || k === 'ArrowDown') pg.top++; else if (k === 'k' || k === 'ArrowUp') pg.top--;
  else if (k === 'g' || k === 'Home') pg.top = 0; else if (k === 'G' || k === 'End') pg.top = pg.lines.length;
  else if (k === '/') pg.cmd = '/'; else if (k === 'n') this._pagerFind(1); else if (k === 'N') this._pagerFind(-1);
  this._pagerDraw();
};
P._pagerFind = function (dir) {
  const pg = this.pager; if (!pg.search) return; const q = pg.search.toLowerCase(); const n = pg.lines.length;
  for (let i = 1; i <= n; i++) { const idx = (pg.top + dir * i + n * 2) % n; if (pg.lines[idx].toLowerCase().indexOf(q) >= 0) { pg.top = idx; return; } }
};
P._closePager = function () { this.pager = null; if (this.full) this.full.remove(); this.full = null; this.render(); this.focus(); this._afterDrain(); };

/* ------------------------------------------------------------------ éditeur */
P._openEdit = function (job) {
  const sess = job.session; const ed = job.edit;
  this.edit = true; this.render();
  const self = this;
  const done = function (info) {
    self.edit = null; if (self.full) self.full.remove(); self.full = null; self.render(); self.focus();
    if (info && info.msg) self.print([{ t: info.msg, k: info.ok === false ? 'e' : 'o' }], true);
    self._afterDrain();
  };
  this.full = h('div.tfull.editor'); this.el.appendChild(this.full);
  const save = (path, text) => (sess.editorSave ? sess.editorSave(path, text) : { ok: false, msg: 'Impossible d’enregistrer' });
  if (ed.editor === 'vi') UI.viEditor(this.full, ed, save, done, this); else UI.nanoEditor(this.full, ed, save, done, this);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
