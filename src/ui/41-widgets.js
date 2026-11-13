/* ============================================================================
   Widgets de bureau Windows : barre de menus, menus contextuels, liste à colonnes triables,
   arbre, onglets, champs de formulaire (dont le contrôle d'adresse IP à quatre champs),
   feuille de propriétés (OK / Annuler / Appliquer) et cadre de console MMC (arbre, liste,
   volet Actions). Aucun contenu métier ici.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h;
const w = UI.w = {};

/* ------------------------------------------------------------------ menus */
let openMenu = null;
const closeMenus = () => { if (openMenu) { openMenu.remove(); openMenu = null; } document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escKey, true); };
const outside = e => { if (openMenu && !openMenu.contains(e.target) && !(e.target.closest && e.target.closest('.mbar-item'))) closeMenus(); };
const escKey = e => { if (e.key === 'Escape') closeMenus(); };
function buildMenu(items, close, level) {
  const m = h('div.ctx' + (level ? '.sub' : ''));
  items.filter(Boolean).forEach(it => {
    if (it === '-' || it.sep) { m.append(h('div.ctxsep')); return; }
    const row = h('div.ctxi' + (it.disabled ? '.dis' : '') + (it.def ? '.def' : ''), (it.checked ? h('span.ck', '✓') : h('span.ck')), h('span.lb', it.label), it.key ? h('span.kb', it.key) : null, it.items ? h('span.ar', '›') : null);
    if (it.items) {
      let sub = null;
      row.addEventListener('mouseenter', () => { if (sub) return; sub = buildMenu(it.items, close, level + 1); row.append(sub); });
      row.addEventListener('mouseleave', () => { if (sub) { sub.remove(); sub = null; } });
    } else if (!it.disabled) row.addEventListener('click', e => { e.stopPropagation(); close(); if (it.fn) it.fn(); });
    m.append(row);
  });
  return m;
}
w.contextMenu = function (x, y, items, root) {
  closeMenus(); if (!items || !items.length) return;
  const m = buildMenu(items, closeMenus, 0); m.classList.add('top');
  /* x, y sont des coordonnées de la fenêtre du navigateur (clientX/clientY). Le menu est en position fixe, mais un conteneur du bureau simulé
     peut changer sa référence (transformation, confinement) : on le place, on mesure où il atterrit et on corrige l'écart. Il reste ensuite
     dans le conteneur (le bureau) : il s'ouvre vers le haut ou vers la gauche quand il dépasse. */
  const host = root || document.body; host.appendChild(m); openMenu = m;
  m.style.left = x + 'px'; m.style.top = y + 'px';
  let r = m.getBoundingClientRect(); const dx = r.left - x, dy = r.top - y;
  const hr = host === document.body ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : host.getBoundingClientRect();
  const W = Math.min(window.innerWidth, hr.right), H = Math.min(window.innerHeight, hr.bottom);
  let X = x, Y = y; if (X + r.width > W) X = Math.max(hr.left, x - r.width); if (Y + r.height > H) Y = Math.max(hr.top, y - r.height);
  m.style.left = (X - dx) + 'px'; m.style.top = (Y - dy) + 'px';
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escKey, true); }, 0);
};
w.menuBar = function (menus, win) {
  const bar = h('div.mbar');
  menus.forEach(mn => {
    const b = h('div.mbar-item', mn.label);
    const openIt = () => {
      closeMenus(); b.classList.add('on'); const r = b.getBoundingClientRect();
      const items = typeof mn.items === 'function' ? mn.items() : mn.items;
      const m = buildMenu(items, () => { closeMenus(); b.classList.remove('on'); }, 0); m.classList.add('top'); m.style.left = r.left + 'px'; m.style.top = r.bottom + 'px'; document.body.appendChild(m); openMenu = m;
      setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escKey, true); }, 0);
      const obs = setInterval(() => { if (!openMenu) { b.classList.remove('on'); clearInterval(obs); } }, 150);
    };
    b.addEventListener('click', e => { e.stopPropagation(); if (b.classList.contains('on')) { closeMenus(); b.classList.remove('on'); } else openIt(); });
    b.addEventListener('mouseenter', () => { if (openMenu && !b.classList.contains('on')) { bar.querySelectorAll('.on').forEach(x => x.classList.remove('on')); openIt(); } });
    bar.append(b);
  });
  return bar;
};

/* ------------------------------------------------------------------ boutons et champs */
w.btn = (label, fn, o) => h('button.w10btn' + (o && o.def ? '.def' : ''), { disabled: !!(o && o.disabled), on: { click: fn } }, label);
w.check = (label, checked, onchange, o) => { const i = h('input', { type: 'checkbox', checked: !!checked, disabled: !!(o && o.disabled), on: { change: () => onchange && onchange(i.checked) } }); return h('label.chk', i, h('span', label)); };
w.radio = (name, label, checked, onchange, o) => { const i = h('input', { type: 'radio', name, checked: !!checked, disabled: !!(o && o.disabled), on: { change: () => { if (i.checked && onchange) onchange(); } } }); return h('label.chk', i, h('span', label)); };
w.text = (value, o) => { o = o || {}; const i = h('input.w10in', { type: o.password ? 'password' : 'text', value: value === undefined || value === null ? '' : String(value), readOnly: !!o.readonly, disabled: !!o.disabled, placeholder: o.placeholder || '' }); if (o.w) i.style.width = o.w + 'px'; if (o.onchange) i.addEventListener('input', () => o.onchange(i.value)); if (o.onenter) i.addEventListener('keydown', e => { if (e.key === 'Enter') o.onenter(i.value); }); return i; };
w.select = (options, value, onchange, o) => { const s = h('select.w10in', { disabled: !!(o && o.disabled) }, options.map(op => { const v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? op.label : op; return h('option', { value: v, selected: String(v) === String(value) }, l); })); if (o && o.w) s.style.width = o.w + 'px'; s.addEventListener('change', () => onchange && onchange(s.value)); return s; };
w.field = (label, input, o) => h('div.frow', h('label', { style: { width: ((o && o.lw) || 150) + 'px' } }, label), input);
w.group = (title, ...kids) => h('fieldset.grp', h('legend', title), kids);
w.textarea = (value, o) => { const t = h('textarea.w10in', { value: value || '', readOnly: !!(o && o.readonly), spellcheck: false, rows: (o && o.rows) || 4 }); if (o && o.onchange) t.addEventListener('input', () => o.onchange(t.value)); return t; };
/* Contrôle d'adresse IP à quatre champs (comme la boîte de propriétés TCP/IPv4) ; value '' = vide. */
w.ipBox = function (value, o) {
  o = o || {}; const parts = String(value || '').split('.'); const box = h('div.ipbox' + (o.disabled ? '.dis' : ''));
  const ins = [0, 1, 2, 3].map(i => h('input', { type: 'text', maxLength: 3, value: parts[i] === undefined ? '' : parts[i], disabled: !!o.disabled }));
  ins.forEach((inp, i) => {
    box.append(inp); if (i < 3) box.append(h('span.dot', '.'));
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^0-9]/g, ''); if (inp.value.length === 3 && i < 3) { ins[i + 1].focus(); ins[i + 1].select(); } if (o.onchange) o.onchange(box.getValue()); });
    inp.addEventListener('keydown', e => { if ((e.key === '.' || e.key === ' ') && i < 3) { e.preventDefault(); ins[i + 1].focus(); ins[i + 1].select(); } else if (e.key === 'Backspace' && inp.value === '' && i > 0) { ins[i - 1].focus(); } });
    inp.addEventListener('blur', () => { if (inp.value !== '' && +inp.value > 255) inp.value = '255'; });
  });
  box.getValue = () => { const v = ins.map(x => x.value); return v.every(x => x === '') ? '' : v.join('.'); };
  box.setValue = val => { const p = String(val || '').split('.'); ins.forEach((x, i) => { x.value = p[i] === undefined ? '' : p[i]; }); };
  box.setDisabled = d => { box.classList.toggle('dis', d); ins.forEach(x => { x.disabled = d; }); };
  return box;
};
w.sep = () => h('div.hsep');

/* ------------------------------------------------------------------ liste à colonnes */
/* o : { columns:[{key,label,w,align,sort:'str'|'num'|fn,fmt(row),icon(row)}], rows, key(row), onSelect(row), onOpen(row), onContext(row,ev), multi, empty, rowClass(row), noHeader } */
w.listView = function (o) {
  const el = h('div.lv' + (o.noHeader ? '.nohead' : '')); const head = h('div.lvh'); const bodyEl = h('div.lvb', { tabindex: 0 });
  el.append(head, bodyEl); let rows = o.rows || []; let sorted = o.sort ? { key: o.sort.key, dir: o.sort.dir || 1 } : null; let sel = new Set(); let view = []; let anchor = null;
  const cols = o.columns.map(c => Object.assign({ w: 120 }, c));
  const keyOf = (r, i) => (o.key ? o.key(r) : (r.id !== undefined ? r.id : i));
  const cmp = (a, b, c) => { const va = c.sortVal ? c.sortVal(a) : a[c.key], vb = c.sortVal ? c.sortVal(b) : b[c.key]; if (c.sort === 'num') return (+va || 0) - (+vb || 0); if (typeof c.sort === 'function') return c.sort(a, b); return String(va === undefined || va === null ? '' : va).localeCompare(String(vb === undefined || vb === null ? '' : vb), 'fr', { numeric: true, sensitivity: 'base' }); };
  const drawHead = () => {
    UI.clear(head);
    cols.forEach((c, i) => {
      const hd = h('div.lvc', { style: { width: c.w + 'px', textAlign: c.align || 'left' }, on: { click: () => { if (c.sort === false) return; if (sorted && sorted.key === c.key) sorted.dir = -sorted.dir; else sorted = { key: c.key, dir: 1 }; draw(); } } }, h('span', c.label), sorted && sorted.key === c.key ? h('span.srt', sorted.dir > 0 ? '▲' : '▼') : null);
      const rz = h('div.lvrz', { on: { click: e => e.stopPropagation(), pointerdown: e => { e.stopPropagation(); e.preventDefault(); const sx = e.clientX, sw = c.w; rz.setPointerCapture(e.pointerId); const mv = ev => { c.w = Math.max(30, sw + ev.clientX - sx); drawHead(); drawBody(); }; const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); }; rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); } } });
      hd.append(rz); head.append(hd);
    });
  };
  const drawBody = () => {
    UI.clear(bodyEl);
    view = rows.slice(); if (sorted) { const c = cols.find(x => x.key === sorted.key); if (c) view.sort((a, b) => sorted.dir * cmp(a, b, c)); }
    if (!view.length) bodyEl.append(h('div.lvempty', o.empty || 'Aucun élément à afficher dans cette vue.'));
    view.forEach((r, i) => {
      const k = keyOf(r, i); const row = h('div.lvr' + (sel.has(k) ? '.sel' : '') + (o.rowClass && o.rowClass(r) ? '.' + o.rowClass(r) : ''), { 'data-k': k },
        cols.map(c => h('div.lvd', { style: { width: c.w + 'px', textAlign: c.align || 'left' } }, c.icon && c.icon(r) ? UI.icon(c.icon(r), 16) : null, h('span', c.fmt ? c.fmt(r) : (r[c.key] === undefined || r[c.key] === null ? '' : String(r[c.key]))))));
      row.addEventListener('click', e => {
        const ctrl = o.multi && (e.ctrlKey || e.metaKey), shift = o.multi && e.shiftKey;
        if (shift && anchor !== null) { const ai = view.findIndex((x, j) => keyOf(x, j) === anchor); const lo = Math.min(ai, i), hi = Math.max(ai, i); sel = new Set(); for (let j = lo; j <= hi; j++) sel.add(keyOf(view[j], j)); }
        else if (ctrl) { if (sel.has(k)) sel.delete(k); else sel.add(k); anchor = k; } else { sel = new Set([k]); anchor = k; }
        paintSel(); if (o.onSelect) o.onSelect(w1());
      });
      row.addEventListener('dblclick', () => { if (o.onOpen) o.onOpen(r); });
      row.addEventListener('contextmenu', e => { e.preventDefault(); if (!sel.has(k)) { sel = new Set([k]); anchor = k; paintSel(); if (o.onSelect) o.onSelect(w1()); } if (o.onContext) o.onContext(r, e); });
      bodyEl.append(row);
    });
  };
  const paintSel = () => { bodyEl.querySelectorAll('.lvr').forEach((r, i) => r.classList.toggle('sel', sel.has(keyOf(view[i], i)))); };
  const w1 = () => { const arr = view.filter((r, i) => sel.has(keyOf(r, i))); return o.multi ? arr : (arr[0] || null); };
  const draw = () => { drawHead(); drawBody(); };
  bodyEl.addEventListener('contextmenu', e => { if (e.target === bodyEl || e.target.classList.contains('lvempty')) { e.preventDefault(); if (o.onContextEmpty) o.onContextEmpty(e); } });
  bodyEl.addEventListener('keydown', e => {
    if (!view.length) return; const cur = view.findIndex((r, i) => sel.has(keyOf(r, i)));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.max(0, Math.min(view.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1))); sel = new Set([keyOf(view[n], n)]); anchor = keyOf(view[n], n); paintSel(); const rr = bodyEl.children[n]; if (rr && rr.scrollIntoView) rr.scrollIntoView({ block: 'nearest' }); if (o.onSelect) o.onSelect(w1()); }
    else if (e.key === 'Enter' && cur >= 0 && o.onOpen) o.onOpen(view[cur]);
    else if (e.key === 'Delete' && cur >= 0 && o.onDelete) o.onDelete(view[cur]);
    else if (e.key === 'F5' && o.onRefresh) { e.preventDefault(); o.onRefresh(); }
    else if (e.key === 'a' && (e.ctrlKey || e.metaKey) && o.multi) { e.preventDefault(); sel = new Set(view.map((r, i) => keyOf(r, i))); paintSel(); if (o.onSelect) o.onSelect(w1()); }
  });
  draw();
  return {
    el, setRows(r, keep) { const keepSel = keep ? Array.from(sel) : []; rows = r || []; sel = new Set(keepSel.filter(k => rows.some((x, i) => keyOf(x, i) === k))); drawBody(); },
    selected: w1, select(k) { sel = new Set([k]); anchor = k; paintSel(); if (o.onSelect) o.onSelect(w1()); },
    clearSel() { sel = new Set(); paintSel(); }, setColumns(c) { cols.length = 0; c.forEach(x => cols.push(Object.assign({ w: 120 }, x))); sorted = null; draw(); }, focus() { bodyEl.focus(); }, rows: () => rows
  };
};

/* ------------------------------------------------------------------ arbre */
/* nœud : { key, label, icon, children:[…] | () => […], expanded, data } */
w.tree = function (o) {
  const el = h('div.tv', { tabindex: 0 }); let roots = o.roots || []; let selKey = null; const expanded = new Set(); const nodeIndex = {};
  const kidsOf = n => (typeof n.children === 'function' ? n.children() : n.children) || [];
  const draw = () => {
    UI.clear(el);
    const walk = (n, depth) => {
      nodeIndex[n.key] = n; const kids = kidsOf(n); const has = kids.length > 0 || n.folder; const open = expanded.has(n.key);
      const row = h('div.tvr' + (selKey === n.key ? '.sel' : ''), { style: { paddingLeft: (4 + depth * 16) + 'px' }, 'data-k': n.key },
        h('span.tvx' + (has ? '' : '.none'), { on: { click: e => { e.stopPropagation(); if (open) expanded.delete(n.key); else expanded.add(n.key); draw(); } } }, has ? (open ? '▾' : '▸') : ''), n.icon ? UI.icon(n.icon, 16) : null, h('span.tvl', n.label));
      row.addEventListener('click', () => { selKey = n.key; draw(); if (o.onSelect) o.onSelect(n); });
      row.addEventListener('dblclick', () => { if (has) { if (open) expanded.delete(n.key); else expanded.add(n.key); draw(); } });
      row.addEventListener('contextmenu', e => { e.preventDefault(); selKey = n.key; draw(); if (o.onSelect) o.onSelect(n); if (o.onContext) o.onContext(n, e); });
      el.append(row); if (open) kids.forEach(k => walk(k, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
  };
  const initExp = n => { if (n.expanded) expanded.add(n.key); kidsOf(n).forEach(initExp); };
  roots.forEach(initExp); draw();
  return { el, setRoots(r) { roots = r; draw(); }, refresh: draw, select(k, fire) { selKey = k; const find = (n, path) => { if (n.key === k) return path; for (const c of kidsOf(n)) { const r = find(c, path.concat(n.key)); if (r) return r; } return null; }; for (const r of roots) { const p = find(r, []); if (p) { p.forEach(x => expanded.add(x)); break; } } draw(); if (fire && nodeIndex[k] && o.onSelect) o.onSelect(nodeIndex[k]); }, selected: () => nodeIndex[selKey] || null, expand(k) { expanded.add(k); draw(); }, selKey: () => selKey };
};

/* ------------------------------------------------------------------ onglets */
w.tabs = function (items, o) {
  o = o || {}; const el = h('div.tabs10'); const strip = h('div.tstrip'); const pane = h('div.tpane'); el.append(strip, pane); let cur = -1;
  const sel = i => { cur = i; UI.clear(strip); items.forEach((it, j) => strip.append(h('div.ttab' + (j === i ? '.on' : ''), { on: { click: () => sel(j) } }, it.label))); UI.clear(pane); const c = typeof it0(i).content === 'function' ? it0(i).content() : it0(i).content; pane.append(c); if (o.onSelect) o.onSelect(i); };
  const it0 = i => items[i];
  sel(o.start || 0); return { el, select: sel, current: () => cur };
};

/* ------------------------------------------------------------------ feuille de propriétés */
/* spec : { wm, owner, title, icon, w, h, tabs:[{label, content}], onOk(), onApply(), okOnly } → fenêtre */
w.propertySheet = function (spec) {
  let win; const tabs = w.tabs(spec.tabs, { start: spec.start || 0 });
  const apply = w.btn('Appliquer', () => { if (spec.onApply) spec.onApply(win); apply.disabled = true; }, { disabled: true });
  const mark = () => { apply.disabled = false; }; /* appelé par les contenus */
  const bar = h('div.psbar', spec.okOnly ? w.btn('OK', () => win.close(true), { def: true }) : [w.btn('OK', () => { if (spec.onOk) { if (spec.onOk(win) === false) return; } win.close(true); }, { def: true }), w.btn('Annuler', () => win.close(true)), apply]);
  win = spec.wm.open({ title: spec.title, icon: spec.icon, w: spec.w || 420, h: spec.h || 480, resizable: false, minimizable: false, maximizable: false, owner: spec.owner, className: 'propsheet', body: () => h('div.pswrap', tabs.el, bar) });
  win.markDirty = mark; win.tabs = tabs; return win;
};

/* ------------------------------------------------------------------ cadre console MMC */
/* spec : { wm, title, icon, w, h, menu, tree:{roots, onSelect}, actions:(node)=>[{section, items}] } */
w.mmc = function (spec) {
  const wm = spec.wm; let win; const info = { listHost: h('div.mmcmid'), actHost: h('div.mmcact'), status: h('div.mmcst') };
  const tree = w.tree({ roots: spec.roots, onSelect: n => { if (spec.onSelect) spec.onSelect(n, api); }, onContext: (n, e) => { if (spec.onTreeContext) w.contextMenu(e.clientX, e.clientY, spec.onTreeContext(n, api)); } });
  const left = h('div.mmcleft', tree.el);
  const tools = h('div.mmctools', h('button.tb', { title: 'Précédent', on: { click: () => { } } }, '◀'), h('button.tb', { title: 'Suivant' }, '▶'), h('button.tb', { title: 'Actualiser', on: { click: () => api.refresh() } }, '⟳'), h('span.tbsep'), spec.tools || null);
  const main = h('div.mmcbody', left, info.listHost, spec.noActions ? null : info.actHost);
  const api = {
    tree, win: null, mid: info.listHost, setActions(sections) {
      UI.clear(info.actHost); sections.forEach(sec => { info.actHost.append(h('div.acth', sec.title)); (sec.items || []).forEach(it => { if (it === '-') { info.actHost.append(h('div.hsep')); return; } const row = h('div.acti' + (it.disabled ? '.dis' : ''), { on: { click: ev => { if (it.disabled) return; if (it.items) { const r = ev.currentTarget.getBoundingClientRect(); w.contextMenu(r.left - 150, r.bottom, it.items); } else if (it.fn) it.fn(); } } }, h('span', it.label), it.items ? h('span.ar', '▸') : null); info.actHost.append(row); }); });
    },
    status(t) { info.status.textContent = t || ''; }, refresh() { if (spec.onRefresh) spec.onRefresh(api); else if (spec.onSelect && tree.selected()) spec.onSelect(tree.selected(), api); }, setMid(el) { UI.clear(info.listHost); info.listHost.append(el); }
  };
  win = wm.open({ title: spec.title, icon: spec.icon, w: spec.w || 860, h: spec.h || 520, menu: spec.menu, className: 'mmc', minW: 520, minH: 300, onClose: spec.onClose, body: () => h('div.mmcwrap', tools, main, h('div.mmcstw', info.status)) });
  /* double-clic dans le volet central sur un élément qui est aussi un dossier de l'arbre (« Pool d'adresses », une OU, une zone…) : on l'ouvre, comme la vraie MMC */
  info.listHost.addEventListener('dblclick', e => {
    const row = e.target.closest && e.target.closest('.lvr'); const cur = tree.selected(); if (!row || !cur) return;
    const txt = ((row.querySelector('.lvd') || row).textContent || '').trim(); const kids = (typeof cur.children === 'function' ? cur.children() : cur.children) || [];
    const k = kids.find(c => String(c.label).trim() === txt); if (k) { tree.expand(cur.key); tree.select(k.key, true); }
  });
  api.win = win; win.mmc = api;
  if (spec.select) tree.select(spec.select, true); else if (spec.roots && spec.roots[0]) tree.select(spec.roots[0].key, true);
  return win;
};
/* Dialogue « Contrôle de service » (démarrage / arrêt) : barre de progression puis fermeture */
w.progressDialog = function (wm, owner, title, text, ms, then) {
  const bar = h('i'); let win;
  win = wm.open({ title, w: 420, h: 150, resizable: false, minimizable: false, maximizable: false, owner, body: () => h('div.pgwrap', h('div', text), h('div.pgbar', bar)) });
  let p = 0; const step = Math.max(40, ms / 12); const iv = setInterval(() => { p += 100 / 12; bar.style.width = Math.min(100, p) + '%'; if (p >= 100) { clearInterval(iv); win.close(true); if (then) then(); } }, step);
  return win;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
