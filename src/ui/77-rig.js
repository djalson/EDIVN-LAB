/* ============================================================================
   Vue « poste physique » : face arrière d'un PC / serveur (alimentation, câble réseau, câble vidéo), écran avec
   son menu OSD, multiprise ; face avant d'un commutateur / routeur (voyants, cordons) ; baie de brassage
   (prises murales → ports du commutateur) ; panneau de l'imprimante.
   Chaque geste modifie le MODÈLE (d.phys, port.cable, W.walls) : les symptômes (liaison, écran noir, hors tension)
   en découlent. Aucun voyant ni texte n'est figé par scénario.
   Tous les dessins sont originaux (aucun logo, aucune photo d'éditeur).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, N = SIM.net, E = SIM.emu, h = UI.h;
SIM.AVREG['rig-osd'] = 'Menu OSD de l’écran : libellés génériques (Luminosité, Contraste, Source d’entrée, Langue, Réinitialiser) et noms de sources (DisplayPort, HDMI 1, HDMI 2, VGA) ; les menus réels varient selon le constructeur — à vérifier si un modèle précis doit être imité.';
SIM.AVREG['rig-printer-lcd'] = 'Panneau de l’imprimante : arborescence de menus générique (Informations / Réseau / Redémarrer) ; les libellés réels dépendent du constructeur — à vérifier si un modèle précis doit être imité.';
SIM.AVREG['rig-voyants'] = 'Voyants de port : vert fixe = liaison établie, orange = port désactivé / err-disabled, éteint = pas de liaison. Le comportement exact (clignotement d’activité, couleurs de la face avant d’un Catalyst) n’est pas reproduit.';
const Rig = UI.Rig = {};

/* ------------------------------------------------------------------ utilitaires */
const short = n => String(n).replace(/^FastEthernet/, 'Fa').replace(/^GigabitEthernet/, 'Gi').replace(/^TenGigabitEthernet/, 'Te');
const isProd = d => d.kind === 'linux' || d.kind === 'pf' || d.kind === 'ios-sw' || d.kind === 'ios-rt' || d.kind === 'sw-dumb' || (d.kind === 'win' && /Server/i.test(d.os || ''));
function physPorts(d) { const o = d.ports || d.ifaces || {}; return Object.keys(o).filter(k => o[k].cable !== undefined && !o[k].virtual && !o[k].encap).map(k => ({ name: k, p: o[k] })); }
function endText(W, to) {
  if (!to) return '';
  if (to.indexOf('wall:') === 0) return 'prise murale ' + to.slice(5);
  if (to.indexOf('patch:') === 0) return 'cordon de brassage ' + to.slice(6);
  const pp = W.parsePort(to); return pp.dev + ' ' + short(pp.port);
}
function cableState(W, d, port) {
  const p = N.portObj(d, port); const c = p && p.cable; if (!c) return { k: 'none' };
  if (!c.plugged) return { k: 'out', to: c.to };
  const pe = N.peerOf(W, d, port); return { k: pe ? 'ok' : 'far', to: c.to, peer: pe };
}
/* geste physique : modifie le modèle, signale le changement, trace l'action */
function gesture(run, d, text, fn, opts) { fn(); run.env.touch('phys'); run.act(d.id, text, Object.assign({ kind: 'physical', mutates: true }, opts || {})); }
function bootUp(run, d) {
  if (d.kind === 'ios-sw' || d.kind === 'ios-rt') { E.ios.coldBoot(run.W, d); run.env.advance(60); }
  else if (d.kind === 'win' || d.kind === 'linux') { SIM.steps.reboot(run.W, { dev: d.id }); run.env.advance(70); }
}
function setPhys(run, d, key, val, label, offLabel) {
  const was = N.powered(d); const off = val === false;
  gesture(run, d, (off ? offLabel : label) + ' — ' + d.id, () => { d.phys[key] = val; }, off && isProd(d) ? { impact: 'poweroff' } : {});
  if (!was && N.powered(d)) { bootUp(run, d); run.env.touch('phys'); }
}
function unplug(run, d, port) { const p = N.portObj(d, port); gesture(run, d, 'Débrancher le câble ' + short(port) + ' de ' + d.id, () => { p.cable.plugged = false; }); }
function replug(run, d, port) { const p = N.portObj(d, port); gesture(run, d, 'Rebrancher le câble ' + short(port) + ' de ' + d.id, () => { p.cable.plugged = true; }); }
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (t, a) => { const e = document.createElementNS(NS, t); Object.keys(a || {}).forEach(k => e.setAttribute(k, a[k])); return e; };

/* ------------------------------------------------------------------ scène avec câbles (SVG recalculé après mise en page) */
function Scene() {
  this.el = h('div.rigscene'); this.svg = svgEl('svg', { class: 'rigcables' }); this.el.append(this.svg); this.cables = []; this.plugs = [];
  const self = this; if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => self.layout()); this.ro.observe(this.el); }
}
Scene.prototype.cable = function (o) { this.cables.push(o); return this; };
Scene.prototype.center = function (el, rel) { const r = el.getBoundingClientRect(), s = rel.getBoundingClientRect(); return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }; };
Scene.prototype.layout = function () {
  const self = this; if (!this.el.isConnected) return;
  while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild); this.plugs.forEach(p => p.remove()); this.plugs = [];
  this.cables.forEach(c => {
    const a = this.center(c.a, this.el), b = this.center(c.b, this.el);
    let end = a;
    if (c.loose) { end = { x: a.x + (c.dx || -8), y: a.y + (c.dy || 70) }; }
    /* câble qui pend : part du port vers le bas, arrive à la destination par le haut (ou en boucle si la destination est plus haute) */
    const route = (from, to) => { const dy = to.y - from.y; const k = Math.max(50, Math.abs(dy) * 0.45); const c2y = dy > 30 ? to.y - k : to.y + k; return 'M' + from.x + ' ' + from.y + ' C ' + from.x + ' ' + (from.y + k) + ', ' + to.x + ' ' + c2y + ', ' + to.x + ' ' + to.y; };
    const d = route(end, b);
    this.svg.append(svgEl('path', { d, fill: 'none', stroke: '#0a0f16', 'stroke-width': c.w + 3, 'stroke-linecap': 'round' }));
    this.svg.append(svgEl('path', { d, fill: 'none', stroke: c.color, 'stroke-width': c.w, 'stroke-linecap': 'round', 'stroke-dasharray': c.live === false ? '' : '' }));
    const pl = h('div.rigplug' + (c.loose ? '.loose' : '') + (c.cls ? '.' + c.cls : ''), { title: c.title || '', style: { left: end.x + 'px', top: end.y + 'px', background: c.color }, on: { click: e => { e.stopPropagation(); if (c.onClick) c.onClick(e); } } });
    this.el.append(pl); this.plugs.push(pl);
  });
};
Scene.prototype.done = function () { const self = this; requestAnimationFrame(() => self.layout()); setTimeout(() => self.layout(), 60); return this.el; };

/* ------------------------------------------------------------------ éléments dessinés */
const led = (cls, on) => h('i.rled' + (cls ? '.' + cls : '') + (on ? '.on' : ''));
function jack(label, cls, title, onClick) { const j = h('div.rjack' + (cls ? '.' + cls : ''), { title: title || label, on: { click: e => { e.stopPropagation(); if (onClick) onClick(e); } } }, h('span', label)); return j; }

/* ------------------------------------------------------------------ PC / serveur Windows / serveur Linux */
function buildHost(run, d) {
  const W = run.W; const sc = new Scene(); const hasScreen = d.kind === 'win'; const ph = d.phys = d.phys || {};
  const isServer = /Server/i.test(d.os || '') || d.kind === 'linux';
  const powered = N.powered(d); const stripOn = ph.strip !== false; const lan = physPorts(d)[0];
  /* multiprise + prise secteur */
  const stripSw = h('div.rsw' + (stripOn ? '.on' : ''), { title: 'Interrupteur de la multiprise', on: { click: () => setPhys(run, d, 'strip', !stripOn, 'Allumer la multiprise', 'Éteindre la multiprise') } }, h('i'));
  const sock1 = h('div.rsock', { title: 'Prise 1' }), sock2 = h('div.rsock', { title: 'Prise 2' });
  const strip = h('div.rstrip', h('div.rcap', 'Multiprise'), h('div.rsocks', sock1, sock2), h('div.rswrap', led('lamp', stripOn), stripSw));
  const outlet = h('div.routlet', h('div.rcap', 'Prise secteur'), h('div.rsock.big'));
  /* unité centrale : face arrière */
  const psuOn = ph.psu !== false;
  const psuSw = h('div.rsw.rock' + (psuOn ? '.on' : ''), { title: 'Interrupteur du bloc d’alimentation (I / O)', on: { click: () => setPhys(run, d, 'psu', !psuOn, 'Allumer le bloc d’alimentation', 'Éteindre le bloc d’alimentation') } }, h('i'), h('span', psuOn ? 'I' : 'O'));
  const inlet = h('div.rinlet', { title: 'Embase d’alimentation' });
  const psu = h('div.rpsu', h('div.rcap', 'Alimentation'), psuSw, inlet);
  const cs = lan ? cableState(W, d, lan.name) : { k: 'none' };
  const link = lan ? N.linkUp(W, d, lan.name) : false;
  const rj = lan ? jack('', 'rj45', 'Carte réseau ' + short(lan.name), (e) => lanMenu(run, d, lan.name, e)) : null;
  if (rj) rj.append(led('link', link && powered), led('act', link && powered));
  const dp = hasScreen ? jack('', 'dp', 'Sortie vidéo', (e) => videoMenu(run, d, e)) : null;
  const usb = h('div.rports', [0, 1, 2, 3].map(() => h('div.rusb')), [0, 1, 2].map(() => h('div.raudio')));
  const front = h('div.rfront', h('div.rcap', 'Face avant'), h('div.rbtnwrap', h('div.rpwr' + (powered ? '.on' : ''), { title: 'Bouton marche', on: { click: () => frontButton(run, d) } }, '⏻'), led('pwr', powered), led('hdd', powered)));
  const tower = h('div.rtower', h('div.rcap.big', isServer ? 'Serveur — face arrière' : 'Unité centrale — face arrière'), h('div.rrow', psu, h('div.rcol', h('div.rports2', rj ? h('div.rpl', h('div.rcap', 'Réseau'), rj) : null, dp ? h('div.rpl', h('div.rcap', 'Vidéo'), dp) : null), usb)), front);
  const left = h('div.rcell', tower);
  /* écran */
  let mid = null;
  if (hasScreen) mid = buildMonitor(run, d, sc);
  /* mise en page */
  const cols = [left]; if (mid) cols.push(mid);
  const grid = h('div.rgrid' + (mid ? '' : '.one'), cols);
  sc.el.append(grid);
  /* rangée du bas : prise murale réseau (ou destination du câble), multiprise, prise secteur */
  let wallPlate = null;
  if (cs.k !== 'none' && cs.to && cs.to.indexOf('wall:') === 0) {
    const id = cs.to.slice(5); wallPlate = h('div.rwall', { title: 'Prise murale ' + id }, h('div.rcap', 'Prise murale'), h('div.rwid', id), h('div.rjack.rj45.wall'));
  } else if (cs.k !== 'none') { wallPlate = h('div.rwall.tag', h('div.rcap', 'Câble réseau vers'), h('div.rwid', endText(W, cs.to)), h('div.rjack.rj45.wall')); }
  sc.el.append(h('div.rbottom', wallPlate, strip, outlet));
  const bwire = wallPlate ? wallPlate.querySelector('.rjack') : null;
  /* câbles */
  if (rj && bwire) sc.cable({ a: rj, b: bwire, color: '#2f7fd1', w: 5, loose: cs.k === 'out', dx: -4, dy: 60, title: cs.k === 'out' ? 'Câble réseau débranché : cliquer pour rebrancher' : 'Câble réseau : cliquer pour débrancher', onClick: (e) => lanMenu(run, d, lan.name, e) });
  sc.cable({ a: inlet, b: sock1, color: '#3a3f47', w: 6, title: 'Cordon d’alimentation de l’unité centrale', onClick: () => { } });
  if (mid) {
    sc.cable({ a: dp, b: mid.querySelector('.rmoninput'), color: '#555d6a', w: 4, loose: ph.screenCable === false, dx: 6, dy: 70, title: ph.screenCable === false ? 'Câble vidéo débranché : cliquer pour rebrancher' : 'Câble vidéo : cliquer pour débrancher', onClick: (e) => videoMenu(run, d, e) });
    sc.cable({ a: mid.querySelector('.rmonpwr'), b: sock2, color: '#3a3f47', w: 6, title: 'Cordon d’alimentation de l’écran', onClick: () => { } });
  }
  sc.cable({ a: sock1.parentNode.parentNode.querySelector('.rswrap'), b: outlet.querySelector('.rsock'), color: '#3a3f47', w: 7, title: 'Cordon de la multiprise', onClick: () => { } });
  const info = h('div.rinfo', h('b', d.id), ' — ', powered ? h('span.ok', 'sous tension') : h('span.bad', 'hors tension'), lan ? [' · liaison réseau : ', link && powered ? h('span.ok', 'établie') : h('span.bad', 'absente')] : null);
  return h('div.rig', info, sc.done());
}
function lanMenu(run, d, port, e) {
  const W = run.W; const cs = cableState(W, d, port); const items = [];
  if (cs.k === 'none') { items.push({ label: 'Aucun câble raccordé', disabled: true }); }
  else if (cs.k === 'out') items.push({ label: 'Rebrancher le câble réseau', fn: () => replug(run, d, port) });
  else items.push({ label: 'Débrancher le câble réseau', fn: () => unplug(run, d, port) });
  UI.w.contextMenu(e ? e.clientX : 200, e ? e.clientY : 200, items);
}
function videoMenu(run, d, e) {
  const ph = d.phys; const items = [ph.screenCable === false ? { label: 'Rebrancher le câble vidéo', fn: () => gesture(run, d, 'Rebrancher le câble vidéo de ' + d.id, () => { ph.screenCable = true; }) } : { label: 'Débrancher le câble vidéo', fn: () => gesture(run, d, 'Débrancher le câble vidéo de ' + d.id, () => { ph.screenCable = false; }) }];
  UI.w.contextMenu(e ? e.clientX : 200, e ? e.clientY : 200, items);
}
function frontButton(run, d) {
  const ph = d.phys; const on = ph.on !== false; const was = N.powered(d);
  gesture(run, d, (on ? 'Appui sur le bouton marche (extinction)' : 'Appui sur le bouton marche (démarrage)') + ' — ' + d.id, () => { ph.on = !on; }, on && isProd(d) ? { impact: 'poweroff' } : {});
  if (!was && N.powered(d)) { bootUp(run, d); run.env.touch('phys'); }
}

/* ------------------------------------------------------------------ écran + menu OSD */
function buildMonitor(run, d, sc) {
  const ph = d.phys; const st = UI.screenState(d); const stripOn = ph.strip !== false; const monOn = ph.monitorOn !== false && stripOn;
  const key = '_osd'; const osd = d._rt[key] = d._rt[key] || { open: false, idx: 0, sub: false };
  const SRC = [['DP', 'DisplayPort'], ['HDMI1', 'HDMI 1'], ['HDMI2', 'HDMI 2'], ['VGA', 'VGA']];
  const MAIN = ['Luminosité', 'Contraste', 'Source d’entrée', 'Langue', 'Réinitialiser'];
  const rebuild = () => run.emit('world');
  const scr = h('div.rmonscr.' + (!monOn ? 'off' : st.k));
  if (monOn) {
    if (st.k === 'ok') scr.append(h('div.rmonok', 'Bureau'));
    else scr.append(h('div.rmonnosig', h('div', 'Entrée : ' + st.src), h('div.big', 'Aucun signal')));
    if (osd.open) {
      const box = h('div.rosd', h('div.rosdt', osd.sub ? 'Source d’entrée' : 'Menu'));
      const rows = osd.sub ? SRC.map(s => s[1]) : MAIN;
      rows.forEach((t, i) => { const cur = osd.sub && SRC[i][0] === (ph.source || 'DP'); box.append(h('div.rosdr' + (i === osd.idx ? '.sel' : ''), (cur ? '● ' : '') + t)); });
      scr.append(box);
    }
  }
  const press = (what) => {
    if (!monOn) return;
    if (what === 'menu') { if (osd.open && osd.sub) { osd.sub = false; osd.idx = 2; } else { osd.open = !osd.open; osd.sub = false; osd.idx = 0; } rebuild(); return; }
    if (!osd.open) return;
    const n = osd.sub ? SRC.length : MAIN.length;
    if (what === 'up') osd.idx = (osd.idx + n - 1) % n; else if (what === 'down') osd.idx = (osd.idx + 1) % n;
    else if (what === 'ok') {
      if (!osd.sub) { if (osd.idx === 2) { osd.sub = true; osd.idx = Math.max(0, SRC.findIndex(s => s[0] === (ph.source || 'DP'))); } else if (osd.idx === 4) { osd.open = false; } }
      else { const nv = SRC[osd.idx][0]; osd.open = false; osd.sub = false; if (nv !== (ph.source || 'DP')) { gesture(run, d, 'Écran de ' + d.id + ' : source d’entrée → ' + SRC.find(s => s[0] === nv)[1], () => { ph.source = nv; }); return; } }
    }
    rebuild();
  };
  const b = (t, w, tt) => h('button.rmb', { title: tt, on: { click: () => press(w) } }, t);
  const pw = h('button.rmb.pw' + (ph.monitorOn !== false ? '.on' : ''), { title: 'Bouton marche de l’écran', on: { click: () => gesture(run, d, 'Écran de ' + d.id + (ph.monitorOn === false ? ' : allumer' : ' : éteindre'), () => { ph.monitorOn = ph.monitorOn === false; }) } }, '⏻');
  const ledMon = led('mon' + (monOn && st.k === 'ok' ? '' : (monOn ? '.amber' : '')), monOn);
  const bezel = h('div.rmonbtns', ledMon, b('MENU', 'menu', 'Menu'), b('▲', 'up', 'Haut'), b('▼', 'down', 'Bas'), b('OK', 'ok', 'Valider'), pw);
  return h('div.rcell', h('div.rmon', h('div.rcap.big', 'Écran'), scr, bezel, h('div.rmonback', h('div.rmoninput', { title: 'Entrée vidéo de l’écran' }, h('span', 'Entrée')), h('div.rmonpwr', { title: 'Alimentation de l’écran' }, h('span', 'Secteur')))));
}

/* ------------------------------------------------------------------ face avant d'un commutateur / routeur / appareil réseau */
function portMenu(run, d, port, e, hook) {
  const W = run.W; const p = N.portObj(d, port); const c = p.cable; const items = [];
  const free = !c || (c.to && c.to.indexOf('patch:') === 0 && W.walls[c.to.slice(6)] !== d.id + ':' + port);
  if (hook && hook.pick && free) { items.push({ label: 'Brasser la prise ' + hook.pick + ' sur ' + short(port), fn: () => { const id = hook.pick; if (hook.done) hook.done(); Rig.moveWall(run, id, d.id + ':' + port); } }); }
  if (c && !free) {
    const isPatch = c.to.indexOf('patch:') === 0;
    if (isPatch) { const id = c.to.slice(6); items.push({ label: 'Débrancher le cordon de brassage ' + id, fn: () => Rig.unpatch(run, id) }); }
    else if (c.plugged) items.push({ label: 'Débrancher le câble', fn: () => unplug(run, d, port) });
    else items.push({ label: 'Rebrancher le câble', fn: () => replug(run, d, port) });
  }
  if (!items.length) items.push({ label: 'Port libre : aucun câble', disabled: true });
  UI.w.contextMenu(e.clientX, e.clientY, items);
}
/* étiquette collée sous le port dans la baie : reprend la description du port (« PC-01 (prise T-114) »), comme le repérage d'un vrai panneau.
   Seulement le libellé : ni VLAN ni état de configuration, qui restent à vérifier en console (show interfaces status / show vlan brief). */
function portLabel(p) { return p && p.desc ? ' · étiquette : « ' + p.desc + ' »' : ''; }
function portTitle(W, d, port) {
  const cs = cableState(W, d, port); const p = N.portObj(d, port);
  if (cs.k === 'none') return short(port) + ' — libre' + portLabel(p);
  const st = p.errdisabled ? ' (port en erreur : err-disabled)' : p.adminDown ? ' (port désactivé par configuration)' : '';
  return short(port) + ' — câble vers ' + endText(W, cs.to) + (cs.k === 'out' ? ' (débranché)' : '') + st + portLabel(p);
}
function portCell(run, d, port, hook) {
  const W = run.W; const p = N.portObj(d, port); const cs = cableState(W, d, port); const up = N.linkUp(W, d, port); const amber = (p.adminDown || p.errdisabled) && N.powered(d);
  const free = cs.k === 'none' || (cs.to && cs.to.indexOf('patch:') === 0 && W.walls[cs.to.slice(6)] !== d.id + ':' + port);
  const cell = h('div.rpc' + (up ? '.up' : '') + (amber ? '.amber' : '') + (free ? '.free' : '') + (hook && hook.pick && free ? '.target' : ''), { title: d.id + ' ' + portTitle(W, d, port), 'data-port': d.id + ':' + port, on: { click: e => portMenu(run, d, port, e, hook) } }, h('div.rpn', short(port).replace(/^Fa/, '')), h('div.rpj'), h('i.rled' + (up && N.powered(d) ? '.on' : amber ? '.amber.on' : '')));
  if (cs.k !== 'none' && !free && cs.k !== 'out') cell.classList.add('plugged'); if (cs.k === 'out') cell.classList.add('unplugged');
  return cell;
}
function netFace(run, d, hook) {
  const ports = physPorts(d); const n = ports.length; const cols = Math.max(1, Math.ceil(n / 2)); const powered = N.powered(d);
  const grid = h('div.rpgrid', { style: { gridTemplateColumns: 'repeat(' + cols + ', 38px)', gridTemplateRows: n > 4 ? 'auto auto' : 'auto' } });
  const ordered = []; if (n > 4) { const odd = ports.filter((x, i) => i % 2 === 0), even = ports.filter((x, i) => i % 2 === 1); ordered.push(...odd, ...even); } else ordered.push(...ports);
  ordered.forEach(x => grid.append(portCell(run, d, x.name, hook)));
  const ph = d.phys = d.phys || { on: true };
  const router = d.kind === 'ios-rt';
  const pw = h('div.rpwrbox', h('div.rcap', router ? 'Interrupteur' : 'Alimentation'), h('div.rsw' + (ph.on !== false ? '.on' : ''), { title: router ? 'Interrupteur du routeur' : 'Cordon d’alimentation (débrancher / rebrancher)', on: { click: () => setPhys(run, d, 'on', ph.on === false, router ? 'Allumer le routeur' : 'Rebrancher l’alimentation', router ? 'Éteindre le routeur' : 'Débrancher l’alimentation') } }, h('i')), h('div.rcap', ph.on !== false ? (router ? 'ON' : 'branché') : (router ? 'OFF' : 'débranché')));
  const sys = h('div.rsys', h('div.rcap', 'SYST'), led('pwr', powered), h('div.rcap', 'Ports'), grid.childNodes.length ? null : null);
  return h('div.rface', h('div.rfhead', h('b', d.id), h('span.muted', ' ' + (d.model || (d.kind === 'ios-sw' ? 'Commutateur' : d.kind === 'ios-rt' ? 'Routeur' : 'Commutateur non administrable')))), h('div.rfbody', sys, grid, pw));
}
function buildNet(run, d) {
  const info = h('div.rinfo', h('b', d.id), ' — ', N.powered(d) ? h('span.ok', 'sous tension') : h('span.bad', 'hors tension'), ' · cliquez sur un port pour agir sur son câble. Voyant vert : liaison ; orange : port désactivé ou en erreur ; éteint : pas de liaison.');
  return h('div.rig', info, netFace(run, d, null));
}
function buildPrinter(run, d) {
  const info = h('div.rinfo', h('b', d.id), ' — ', N.powered(d) ? h('span.ok', 'sous tension') : h('span.bad', 'hors tension'));
  return h('div.rig', info, buildHost2(run, d));
}
/* imprimante : alimentation + câble réseau (pas d'écran PC) */
function buildHost2(run, d) {
  const W = run.W; const ph = d.phys = d.phys || {}; const sc = new Scene(); const powered = N.powered(d); const lan = physPorts(d)[0];
  const stripOn = ph.strip !== false;
  const stripSw = h('div.rsw' + (stripOn ? '.on' : ''), { title: 'Interrupteur de la multiprise', on: { click: () => setPhys(run, d, 'strip', !stripOn, 'Allumer la multiprise', 'Éteindre la multiprise') } }, h('i'));
  const sock1 = h('div.rsock'); const strip = h('div.rstrip', h('div.rcap', 'Multiprise'), h('div.rsocks', sock1, h('div.rsock')), h('div.rswrap', led('lamp', stripOn), stripSw));
  const outlet = h('div.routlet', h('div.rcap', 'Prise secteur'), h('div.rsock.big'));
  const inlet = h('div.rinlet', { title: 'Embase d’alimentation' });
  const cs = lan ? cableState(W, d, lan.name) : { k: 'none' }; const link = lan ? N.linkUp(W, d, lan.name) : false;
  const rj = lan ? jack('', 'rj45', 'Port réseau', (e) => lanMenu(run, d, lan.name, e)) : null; if (rj) rj.append(led('link', link && powered), led('act', link && powered));
  const psuOn = ph.psu !== false;
  const psuSw = h('div.rsw.rock' + (psuOn ? '.on' : ''), { title: 'Interrupteur d’alimentation (I / O)', on: { click: () => setPhys(run, d, 'psu', !psuOn, 'Allumer l’imprimante (interrupteur)', 'Éteindre l’imprimante (interrupteur)') } }, h('i'), h('span', psuOn ? 'I' : 'O'));
  const box = h('div.rtower', h('div.rcap.big', 'Imprimante — face arrière'), h('div.rrow', h('div.rpsu', h('div.rcap', 'Alimentation'), psuSw, inlet), h('div.rcol', h('div.rports2', rj ? h('div.rpl', h('div.rcap', 'Réseau'), rj) : null, h('div.rpl', h('div.rcap', 'USB'), h('div.rusb'))))));
  sc.el.append(h('div.rgrid.one', h('div.rcell', box)));
  let plate = null; if (cs.k !== 'none') { plate = h('div.rwall.tag', h('div.rcap', 'Câble réseau vers'), h('div.rwid', endText(W, cs.to)), h('div.rjack.rj45.wall')); }
  sc.el.append(h('div.rbottom', plate, strip, outlet));
  if (rj && plate) sc.cable({ a: rj, b: plate.querySelector('.rjack'), color: '#2f7fd1', w: 5, loose: cs.k === 'out', dx: -4, dy: 60, title: 'Câble réseau', onClick: (e) => lanMenu(run, d, lan.name, e) });
  sc.cable({ a: inlet, b: sock1, color: '#3a3f47', w: 6, onClick: () => { } });
  sc.cable({ a: strip.querySelector('.rswrap'), b: outlet.querySelector('.rsock'), color: '#3a3f47', w: 7, onClick: () => { } });
  return sc.done();
}

/* ------------------------------------------------------------------ API publique */
Rig.build = function (run, devId, back) {
  const d = run.W.d(devId); const wrap = h('div.rigwrap');
  const make = () => {
    UI.clear(wrap);
    let el;
    if (d.kind === 'win' || d.kind === 'linux') el = buildHost(run, d);
    else if (d.kind === 'ios-sw' || d.kind === 'ios-rt' || d.kind === 'sw-dumb') el = buildNet(run, d);
    else if (d.kind === 'printer') el = buildPrinter(run, d);
    else if (d.kind === 'pf') el = h('div.rig', h('div.rinfo', h('b', d.id), ' — pare-feu virtualisé : les interfaces sont des cartes virtuelles reliées par l’hyperviseur ; il n’y a pas de câble ni d’alimentation à manipuler ici.'));
    else el = h('div.rig', h('div.rinfo', h('b', d.id), ' — équipement hors périmètre d’intervention (réseau de l’opérateur).'));
    wrap.append(el);
  };
  wrap._make = make; make(); return wrap;
};
Rig.refresh = function (host) { const w = host.querySelector('.rigwrap'); if (w && w._make) w._make(); };

/* Brassage : la prise murale `id` est reliée au port `swPort` ("SW-T2:FastEthernet0/9") ; l'ancien port est libéré */
Rig.moveWall = function (run, id, swPort) {
  const W = run.W; const S = W.parsePort(swPort); const sw = W.d(S.dev); const p = N.portObj(sw, S.port);
  const busy = p.cable && !(p.cable.to && p.cable.to.indexOf('patch:') === 0 && W.walls[p.cable.to.slice(6)] !== swPort);
  if (busy) { UI.toast('Le port ' + short(S.port) + ' de ' + S.dev + ' est déjà utilisé.', 'warn', 4000); return; }
  gesture(run, sw, 'Brasser la prise ' + id + ' sur ' + S.dev + ' ' + short(S.port), () => {
    Object.keys(W.dev).forEach(k => { const o = W.dev[k]; if (!o.ports) return; Object.keys(o.ports).forEach(n => { const c = o.ports[n].cable; if (c && c.to === 'patch:' + id) o.ports[n].cable = null; }); });
    W.walls[id] = swPort; p.cable = { plugged: true, to: 'patch:' + id };
  });
};
Rig.unpatch = function (run, id) {
  const W = run.W; const cur = W.walls[id]; if (!cur) return; const S = W.parsePort(cur);
  gesture(run, W.d(S.dev), 'Débrancher le cordon de brassage de la prise ' + id + ' (côté commutateur ' + S.dev + ' ' + short(S.port) + ')', () => {
    W.walls[id] = null; const p = N.portObj(W.d(S.dev), S.port); if (p && p.cable && p.cable.to === 'patch:' + id) p.cable = null;
  });
};

/* ------------------------------------------------------------------ baie de brassage (Toulouse) */
Rig.patchPanel = function (run) {
  const W = run.W; const wrap = h('div.rigwrap.rack'); const st = { pick: null };
  const make = () => {
    UI.clear(wrap);
    const info = h('div.rinfo', h('b', 'Baie de brassage — Toulouse'), ' · panneau de brassage (prises murales) au-dessus des commutateurs. Cliquez sur une prise puis sur un port libre pour la re-brasser ; clic sur un port occupé pour débrancher / rebrancher son câble.');
    const panel = h('div.rpanel', h('div.rcap.big', 'Panneau de brassage'));
    const jacks = h('div.rjacks');
    Object.keys(W.walls).sort().forEach(id => {
      const dst = W.walls[id]; const S = dst ? W.parsePort(dst) : null;
      const j = h('div.rpj2' + (st.pick === id ? '.sel' : '') + (dst ? '.patched' : '.free'), { title: dst ? 'Prise ' + id + ' brassée sur ' + S.dev + ' ' + short(S.port) : 'Prise ' + id + ' non brassée', on: { click: e => {
        const items = [{ label: st.pick === id ? 'Annuler le re-brassage' : 'Brasser cette prise sur un autre port…', fn: () => { st.pick = st.pick === id ? null : id; make(); } }];
        if (dst) items.push({ label: 'Débrancher le cordon (côté commutateur)', fn: () => { Rig.unpatch(run, id); } });
        UI.w.contextMenu(e.clientX, e.clientY, items);
      } } }, h('div.rwid', id), h('div.rjack.rj45'), h('div.rcap', dst ? '→ ' + S.dev + ' ' + short(S.port) : 'libre'));
      jacks.append(j);
    });
    panel.append(jacks);
    const sws = Object.keys(W.dev).filter(k => /^SW-T\d/.test(k)).sort().map(k => W.dev[k]);
    const racks = sws.map(sw => h('div.rrackitem', netFace(run, sw, { pick: st.pick, done: () => { st.pick = null; } })));
    const hint = st.pick ? h('div.rhint', 'Re-brassage de la prise ' + st.pick + ' : cliquez sur un port libre (cadre en pointillés) d’un commutateur.') : null;
    wrap.append(h('div.rig', info, panel, hint, h('div.rrack', racks)));
  };
  wrap._make = make; make();
  run.on('world', () => { if (wrap.isConnected) make(); });
  return wrap;
};

/* ------------------------------------------------------------------ imprimante : panneau LCD (surface principale) */
UI.printerPanel = function (run, devId) {
  const W = run.W; const d = W.d(devId); const i0 = () => d.ifaces.eth0;
  const root = h('div.prn'); const st = { path: [], idx: 0, edit: null, msg: '' };
  const MENUS = {
    '': ['Informations', 'Réseau', 'Redémarrer'],
    'Informations': ['Page de configuration', 'Adresse MAC'],
    'Réseau': ['Adressage IP', 'Adresse IP', 'Masque', 'Passerelle']
  };
  const cur = () => N.effCfg(d, 'eth0') || {};
  const draw = () => {
    UI.clear(root); const powered = N.powered(d);
    const lcd = h('div.prnlcd' + (powered ? '' : '.off'));
    if (powered) {
      const key = st.path.join('/'); const items = MENUS[key] || [];
      lcd.append(h('div.prnt', st.path.length ? st.path[st.path.length - 1] : 'Menu'));
      if (st.edit) {
        const inp = h('input.prnin', { value: st.edit.value, spellcheck: false }); lcd.append(h('div.prnr', st.edit.label), inp, h('div.prnr.dim', 'OK : valider   Retour : annuler'));
        st.edit.inp = inp; setTimeout(() => inp.focus(), 20);
      } else if (st.page) {
        st.page.forEach(l => lcd.append(h('div.prnr.mono', l)));
      } else {
        items.forEach((t, i) => {
          let right = ''; const c = cur();
          if (key === 'Réseau') right = t === 'Adressage IP' ? (d.ifaces.eth0.dhcp ? 'Auto (DHCP)' : 'Manuel') : t === 'Adresse IP' ? c.ip || '—' : t === 'Masque' ? c.mask || '—' : t === 'Passerelle' ? c.gw || '—' : '';
          if (key === 'Informations' && t === 'Adresse MAC') right = d.ifaces.eth0.mac;
          lcd.append(h('div.prnr' + (i === st.idx ? '.sel' : ''), h('span', t), h('span.r', right)));
        });
      }
      if (st.msg) lcd.append(h('div.prnr.dim', st.msg));
    } else lcd.append(h('div.prnoff', 'Hors tension'));
    const key = st.path.join('/'); const items = MENUS[key] || [];
    const open = () => {
      if (!powered) return;
      if (st.page) { st.page = null; return; }
      if (st.edit) {
        const v = st.edit.inp.value.trim(); const f = st.edit.field;
        if (!U.isIP(v)) { st.msg = 'Valeur invalide'; st.edit.value = v; return; }
        const i = d.ifaces.eth0;
        gesture(run, d, 'Imprimante ' + d.id + ' : ' + st.edit.label + ' → ' + v, () => { i[f] = v; i.dhcp = false; });
        st.edit = null; st.msg = 'Enregistré'; return;
      }
      const t = items[st.idx]; st.msg = '';
      if (key === '' && t === 'Redémarrer') {
        gesture(run, d, 'Imprimante ' + d.id + ' : redémarrage', () => { d._rt.rebootN = (d._rt.rebootN || 0) + 1; }); st.msg = 'Redémarrage…'; return;
      }
      if (MENUS[t] && key === '') { st.path = [t]; st.idx = 0; return; }
      if (key === 'Informations' && t === 'Page de configuration') { const c = cur(); st.page = ['Page de configuration', 'Modèle : ' + (d.model || '—'), 'Nom : ' + d.name, 'MAC : ' + d.ifaces.eth0.mac, 'Adressage : ' + (d.ifaces.eth0.dhcp ? 'DHCP' : 'Manuel'), 'IP : ' + (c.ip || '—'), 'Masque : ' + (c.mask || '—'), 'Passerelle : ' + (c.gw || '—')]; run.act(d.id, 'Imprimante ' + d.id + ' : impression de la page de configuration', { kind: 'physical', mutates: false }); return; }
      if (key === 'Réseau') {
        if (t === 'Adressage IP') { const i = d.ifaces.eth0; const v = !i.dhcp; gesture(run, d, 'Imprimante ' + d.id + ' : adressage ' + (v ? 'automatique (DHCP)' : 'manuel'), () => { i.dhcp = v; if (v) { N.dhcpRenew(W, d.id, 'eth0'); } }); return; }
        const f = { 'Adresse IP': 'ip', 'Masque': 'mask', 'Passerelle': 'gw' }[t]; if (f) { if (d.ifaces.eth0.dhcp) { st.msg = 'Passez en adressage manuel'; return; } st.edit = { label: t, field: f, value: d.ifaces.eth0[f] || '' }; }
      }
    };
    const back = () => { if (st.page) { st.page = null; return; } if (st.edit) { st.edit = null; return; } st.msg = ''; st.path.pop(); st.idx = 0; };
    const btn = (t, fn) => h('button.prnb', { on: { click: () => { fn(); draw(); } } }, t);
    const keys = h('div.prnkeys', btn('▲', () => { if (!st.edit && !st.page) st.idx = (st.idx + items.length - 1) % Math.max(1, items.length); }), btn('▼', () => { if (!st.edit && !st.page) st.idx = (st.idx + 1) % Math.max(1, items.length); }), btn('OK', open), btn('Retour', back));
    root.append(h('div.prnbody', h('div.prnhead', h('b', d.model || 'Imprimante'), h('span.muted', ' ' + d.id)), lcd, keys, h('div.muted', { style: { marginTop: '8px' } }, 'Panneau de commande : navigation avec ▲ ▼, validation avec OK. Pour agir sur le câble ou l’alimentation, utilisez « Poste physique » en haut.')));
  };
  draw(); run.on('world', () => { if (root.isConnected) draw(); });
  return root;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
