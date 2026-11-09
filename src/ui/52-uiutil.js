/* ============================================================================
   Aides de dialogue communes aux applications du bureau Windows.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h;

/* Boîte de dialogue modale : body = élément ou fonction ; buttons : [{ label, def, fn(win) }] ; fn retourne false pour garder la boîte ouverte */
UI.dialog = function (desk, owner, o) {
  let win; const bar = h('div.mbbtns', (o.buttons || [{ label: 'OK', def: true }]).map(b => UI.w.btn(b.label, () => { if (b.fn && b.fn(win) === false) return; win.close(true); }, { def: !!b.def, disabled: !!b.disabled })));
  const body = typeof o.body === 'function' ? o.body(() => win) : o.body;
  win = desk.wm.open({ title: o.title || '', icon: o.icon, w: o.w || 420, h: o.h || 260, owner: owner || undefined, resizable: !!o.resizable, minimizable: false, maximizable: false, className: o.className || 'dlg2', body: () => h('div.pad.dlgbody', body, bar) });
  win.bar = bar; return win;
};
/* Confirmation Oui / Non */
UI.confirm = function (desk, owner, o) {
  desk.msg({ title: o.title || '', icon: o.icon || 'question', owner, text: o.text, buttons: [{ label: o.yes || 'Oui', default: true, fn: o.onYes }, { label: o.no || 'Non', fn: o.onNo }] });
};
/* Saisie d'une valeur texte */
UI.prompt = function (desk, owner, o) {
  const t = UI.w.text(o.value || '', { w: o.fw || 280 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px', marginTop: '4px' } });
  const w = UI.dialog(desk, owner, { title: o.title, w: o.w || 420, h: o.h || 190, body: h('div', h('div', { style: { marginBottom: '6px' } }, o.label || ''), t, err), buttons: [{ label: 'OK', def: true, fn: () => { const r = o.onOk(t.value); if (typeof r === 'string') { err.textContent = r; return false; } if (r === false) return false; } }, { label: 'Annuler' }] });
  setTimeout(() => t.focus(), 30); return w;
};
/* Pile de lignes de formulaire */
UI.rows = (pairs, lw) => h('div', pairs.map(p => (p ? UI.w.field(p[0], p[1], { lw: lw || 140 }) : h('div', { style: { height: '8px' } }))));
})(typeof globalThis !== 'undefined' ? globalThis : window);
