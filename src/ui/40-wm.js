/* ============================================================================
   Gestionnaire de fenêtres d'un bureau simulé : fenêtres déplaçables / redimensionnables,
   ordre d'empilement, réduction / agrandissement / fermeture, boîtes de dialogue modales
   (blocage de la fenêtre parente uniquement), boîtes de message. Indépendant du contenu.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h;

function WM(host, opts) {
  this.host = host; this.opts = opts || {}; this.wins = []; this.z = 10; this.active = null; this.listeners = {};
  this.area = h('div.wmarea'); host.appendChild(this.area);
}
UI.WM = WM;
const P = WM.prototype;
P.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
P.emit = function (ev, a) { (this.listeners[ev] || []).forEach(f => { try { f(a); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }); };
P.size = function () { return { w: this.area.clientWidth || 1000, h: this.area.clientHeight || 600 }; };

/* spec : { title, icon, w, h, x, y, body, menu, resizable, maximizable, minimizable, owner (fenêtre parente → modale), taskbar, onClose, id, className } */
P.open = function (spec) {
  const wm = this; const sz = this.size(); const self = this;
  const win = { wm, spec, id: spec.id || ('w' + (++WM.seq)), owner: spec.owner || null, children: [], state: 'normal', title: spec.title || '' };
  const W = Math.min(spec.w || 640, sz.w - 20), H = Math.min(spec.h || 420, sz.h - 20);
  const n = this.wins.length % 8;
  const x = spec.x !== undefined ? spec.x : Math.max(4, Math.round((sz.w - W) / 2) + (spec.owner ? 0 : (n - 3) * 22));
  const y = spec.y !== undefined ? spec.y : Math.max(4, Math.round((sz.h - H) / 2) + (spec.owner ? 0 : (n - 3) * 18));
  const titleEl = h('span.wtitle', win.title);
  const btns = h('div.wbtns');
  if (spec.minimizable !== false && !spec.owner) btns.append(h('button.wb.min', { title: 'Réduire', on: { click: e => { e.stopPropagation(); win.minimize(); } } }, h('i')));
  if (spec.maximizable !== false && spec.resizable !== false && !spec.owner) btns.append(h('button.wb.max', { title: 'Agrandir', on: { click: e => { e.stopPropagation(); win.toggleMax(); } } }, h('i')));
  btns.append(h('button.wb.cls', { title: 'Fermer', on: { click: e => { e.stopPropagation(); win.close(); } } }, h('i')));
  const tb = h('div.wtb', spec.icon ? UI.icon(spec.icon, 16) : null, titleEl, btns);
  const body = h('div.wbody'); const menuEl = spec.menu ? UI.w.menuBar(spec.menu, win) : null;
  const el = h('div.win' + (spec.className ? '.' + spec.className : '') + (spec.owner ? '.dlg' : ''), { style: { left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px', zIndex: ++this.z }, tabindex: -1 }, tb, menuEl, body);
  win.el = el; win.body = body; win.titleEl = titleEl; win.menuEl = menuEl;
  if (typeof spec.body === 'function') { const c = spec.body(win); if (c) body.append(c); } else if (spec.body) body.append(spec.body);
  this.area.appendChild(el);
  win.setTitle = t => { win.title = t; titleEl.textContent = t; self.emit('change'); };
  win.focus = () => self.focus(win);
  win.minimize = () => { win.state = 'min'; win.prevState = win.prevState || 'normal'; el.style.display = 'none'; if (self.active === win) self.active = null; self.emit('change'); const nx = self.top(); if (nx) self.focus(nx); };
  win.restore = () => { if (win.state === 'min') { el.style.display = ''; win.state = win.maxed ? 'max' : 'normal'; } self.focus(win); };
  win.toggleMax = () => { if (win.maxed) { win.maxed = false; win.state = 'normal'; el.classList.remove('max'); Object.assign(el.style, win.restoreRect); } else { win.restoreRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height }; win.maxed = true; win.state = 'max'; el.classList.add('max'); } if (win.onResize) win.onResize(); self.emit('change'); };
  win.close = (force) => {
    if (win.closed) return;
    if (!force && spec.onClose && spec.onClose(win) === false) return;
    if (win.children.length && !force) { win.children.forEach(c => c.close(true)); }
    win.closed = true; el.remove(); const i = self.wins.indexOf(win); if (i >= 0) self.wins.splice(i, 1);
    if (win.owner) { const j = win.owner.children.indexOf(win); if (j >= 0) win.owner.children.splice(j, 1); if (!win.owner.children.length) win.owner.el.classList.remove('blocked'); self.focus(win.owner); }
    else if (self.active === win) { self.active = null; const nx = self.top(); if (nx) self.focus(nx); }
    if (win.onClosed) win.onClosed(); self.emit('change');
  };
  win.center = () => { const s = self.size(); el.style.left = Math.max(0, Math.round((s.w - el.offsetWidth) / 2)) + 'px'; el.style.top = Math.max(0, Math.round((s.h - el.offsetHeight) / 2)) + 'px'; };
  win.shake = () => { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); };
  if (win.owner) { win.owner.children.push(win); win.owner.el.classList.add('blocked'); const ow = win.owner; const ox = parseInt(ow.el.style.left, 10) || 0, oy = parseInt(ow.el.style.top, 10) || 0; if (spec.x === undefined && !ow.maxed) { el.style.left = Math.max(0, ox + Math.round((ow.el.offsetWidth - W) / 2)) + 'px'; el.style.top = Math.max(0, oy + 30 + Math.round((ow.el.offsetHeight - H) / 4)) + 'px'; } }
  this.wins.push(win);
  /* déplacement */
  tb.addEventListener('pointerdown', e => {
    if (e.target.closest('.wbtns')) return; self.focus(win);
    if (win.maxed) return;
    const sx = e.clientX, sy = e.clientY, ox = parseInt(el.style.left, 10), oy = parseInt(el.style.top, 10); tb.setPointerCapture(e.pointerId);
    const mv = ev => { const a = self.size(); el.style.left = Math.max(-W + 80, Math.min(a.w - 60, ox + ev.clientX - sx)) + 'px'; el.style.top = Math.max(0, Math.min(a.h - 30, oy + ev.clientY - sy)) + 'px'; };
    const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); };
    tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
  });
  tb.addEventListener('dblclick', e => { if (!e.target.closest('.wbtns') && spec.maximizable !== false && spec.resizable !== false && !spec.owner) win.toggleMax(); });
  /* redimensionnement */
  if (spec.resizable !== false) {
    ['e', 's', 'se', 'w', 'n', 'ne', 'sw', 'nw'].forEach(dir => {
      const hd = h('div.rz.rz-' + dir); el.append(hd);
      hd.addEventListener('pointerdown', e => {
        if (win.maxed) return; e.stopPropagation(); self.focus(win);
        const sx = e.clientX, sy = e.clientY; const r = { l: parseInt(el.style.left, 10), t: parseInt(el.style.top, 10), w: el.offsetWidth, h: el.offsetHeight }; hd.setPointerCapture(e.pointerId);
        const mw = spec.minW || 280, mh = spec.minH || 160;
        const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (dir.indexOf('e') >= 0) el.style.width = Math.max(mw, r.w + dx) + 'px'; if (dir.indexOf('s') >= 0) el.style.height = Math.max(mh, r.h + dy) + 'px'; if (dir.indexOf('w') >= 0) { const nw = Math.max(mw, r.w - dx); el.style.width = nw + 'px'; el.style.left = (r.l + r.w - nw) + 'px'; } if (dir.indexOf('n') >= 0) { const nh = Math.max(mh, r.h - dy); el.style.height = nh + 'px'; el.style.top = Math.max(0, r.t + r.h - nh) + 'px'; } if (win.onResize) win.onResize(); };
        const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); };
        hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up);
      });
    });
  }
  el.addEventListener('pointerdown', () => { if (!win.owner || true) self.focus(win); }, true);
  this.focus(win); this.emit('change');
  return win;
};
WM.seq = 0;
P.top = function () { const vis = this.wins.filter(w => w.state !== 'min' && !w.closed && !w.owner); vis.sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex)); return vis[0] || null; };
P.focus = function (win) {
  if (!win || win.closed) return;
  /* une fenêtre propriétaire bloquée renvoie le focus à sa dernière boîte modale */
  if (win.children && win.children.length) { const c = win.children[win.children.length - 1]; if (c !== win) { win.shake && win.shake(); win = c; } }
  if (win.state === 'min') { win.el.style.display = ''; win.state = win.maxed ? 'max' : 'normal'; }
  const root = win.owner ? win.owner : win; root.el.style.zIndex = ++this.z; win.el.style.zIndex = ++this.z;
  this.wins.forEach(w => w.el.classList.toggle('active', w === win || (w === root && !!win.owner)));
  this.active = win.owner ? win.owner : win; this.emit('change');
  if (win.onFocus) win.onFocus();
};
P.find = function (id) { return this.wins.find(w => w.id === id && !w.closed) || null; };
P.closeAll = function () { this.wins.slice().forEach(w => w.close(true)); };

/* ------------------------------------------------------------------ boîtes de message */
/* msgBox(wm, { title, text, icon: 'info'|'warning'|'error'|'question', buttons: ['OK'] | [{label, default, fn}], owner }) */
UI.msgBox = function (wm, o) {
  o = Object.assign({}, o, { text: SIM.codes.text(o.text, 'dialogue') });   // D-106
  const btns = (o.buttons || ['OK']).map((b, i) => typeof b === 'string' ? { label: b } : b);
  let win;
  const row = h('div.mbrow', h('div.mbicon', UI.icon(o.icon || 'info', 32)), h('div.mbtext', String(o.text).split('\n').map(l => h('div', l === '' ? '​' : l))));
  const bar = h('div.mbbtns', btns.map((b, i) => h('button.w10btn' + ((b.default || (i === 0 && !btns.some(x => x.default))) ? '.def' : ''), { on: { click: () => { win.close(true); if (b.fn) b.fn(); } } }, b.label)));
  const lines = String(o.text).split('\n'); const wdt = Math.max(300, Math.min(520, Math.max.apply(null, lines.map(l => l.length)) * 7 + 110));
  win = wm.open({ title: o.title || '', icon: null, w: wdt, h: 70 + lines.length * 18 + 52, resizable: false, minimizable: false, maximizable: false, owner: o.owner || wm.active || undefined, className: 'msgbox', body: () => h('div.mbwrap', row, bar) });
  setTimeout(() => { const d = bar.querySelector('.def'); if (d) d.focus(); }, 10);
  win.el.addEventListener('keydown', e => { if (e.key === 'Escape') { const c = btns.find(b => /annuler|non|fermer|ok/i.test(b.label)) || btns[btns.length - 1]; win.close(true); if (c && c.fn && /annuler|non/i.test(c.label)) c.fn(); } });
  return win;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
