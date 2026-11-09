/* ============================================================================
   Surfaces « console » : Debian (invite de connexion tty1), Cisco (câble console),
   pfSense (menu de la console VM), imprimante (panneau), équipements non administrables.
   Chaque surface est enveloppée par UI.Frame : bascule « Écran / console » ↔ « Poste physique ».
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, LX = SIM.lx, h = UI.h, L = E.L;
SIM.AVREG['linux-issue'] = 'Bannière de connexion console (/etc/issue) : « Debian GNU/Linux 13 <hôte> tty1 » — libellé reconstitué ; à vérifier sur une installation réelle.';
SIM.AVREG['ios-con-ready'] = 'Texte d’attente de la console Cisco : « <hôte> con0 is now available / Press RETURN to get started. » — reconstitué de mémoire.';

/* ------------------------------------------------------------------ cadre : écran ↔ poste physique */
UI.Frame = function (run, devId, main, opts) {
  opts = opts || {};
  const d = run.W.d(devId);
  const el = h('div.frame');
  const bar = h('div.fbar');
  const body = h('div.fbody');
  const rigHost = h('div.frig.hidden');
  body.append(main, rigHost);
  let rigBuilt = false;
  const bMain = h('button.btn.small.on', { on: { click: () => show('main') } }, opts.mainLabel || 'Écran');
  const bRig = h('button.btn.small', { on: { click: () => show('rig') } }, 'Poste physique (arrière, câbles, alimentation)');
  const state = h('span.fstate');
  bar.append(UI.icon(opts.icon || 'server', 18), h('b', devId), h('span.muted', { style: { marginLeft: '6px' } }, opts.subtitle || ''), h('div.grow'), state, bMain, bRig);
  function show(w) {
    const r = w === 'rig';
    main.classList.toggle('hidden', r); rigHost.classList.toggle('hidden', !r);
    bMain.classList.toggle('on', !r); bRig.classList.toggle('on', r);
    if (r) { if (UI.Rig) { UI.clear(rigHost); rigHost.append(UI.Rig.build(run, devId, () => show('main'))); } else rigHost.append(h('div.pad', 'Vue physique indisponible.')); run.act(devId, 'Inspection physique de ' + devId, { kind: 'physical' }); }
    else if (opts.onShow) opts.onShow();
  }
  el.append(bar, body);
  const upd = () => { const pw = N.powered(d); state.textContent = pw ? '' : '⏻ hors tension'; state.style.color = 'var(--warn)'; if (rigHost && !rigHost.classList.contains('hidden') && UI.Rig && UI.Rig.refresh) UI.Rig.refresh(rigHost); };
  run.on('world', upd); upd();
  return { el, show, update: upd, rigHost };
};

/* ------------------------------------------------------------------ session de connexion Debian */
function LoginSession(env, devId, opts) {
  E.Session.call(this, env, devId, opts); this.kind = 'login'; this.opts = opts || {}; this.fail = 0;
}
LoginSession.prototype = Object.create(E.Session.prototype); LoginSession.prototype.constructor = LoginSession;
LoginSession.prototype.host = function () { return this.d.hostname || this.d.name; };
LoginSession.prototype.prompt = function () {
  if (this.ask) return this.ask.prompt;
  return this.d._rt.emergency ? '(or press Control-D to continue): ' : this.host() + ' login: ';
};
LoginSession.prototype.banner = function () {
  const d = this.d;
  if (d._rt.emergency) return [L(''), L('You are in emergency mode. After logging in, type "journalctl -xb" to view'), L('system logs, "systemctl reboot" to reboot, "systemctl default" or ^D to'), L('try again to boot into default mode.'), L('Give root password for maintenance')];
  return [L('Debian GNU/Linux 13 ' + this.host() + ' tty1'), L('')];
};
LoginSession.prototype.run = function (line) {
  const self = this; const d = this.d;
  if (d._rt.emergency) {
    return this.askPw('root', line.trim() === '' ? null : undefined, true);
  }
  const user = line.trim(); if (!user) return { out: [] };
  return { out: [], ask: { prompt: 'Password: ', echo: false, user, cb: pw => self.verify(user, pw) } };
};
LoginSession.prototype.askPw = function (user) {
  const self = this;
  return { out: [], ask: { prompt: 'Password: ', echo: false, user, cb: pw => self.verify(user, pw, true) } };
};
LoginSession.prototype.verify = function (user, pw, emergency) {
  const d = this.d; const u = LX.user(d, user); const ok = u && d.pwds && d.pwds[user] === pw && !(u.shell && /nologin|false$/.test(u.shell) && !emergency);
  if (!ok) {
    this.fail++;
    this.env.act({ kind: 'login', dev: this.devId, text: 'Échec de connexion console (' + user + ')', mutates: false });
    if (emergency) return { out: [{ t: '', k: 'o', d: 1200 }, L('Cannot open access to console, the root account is locked.'), L('See sulogin(8) man page for more details.'), L('')] };
    return { out: [{ t: '', k: 'o', d: 1500 }, L('Login incorrect'), L('')] };
  }
  const sh = E.openLxShell(this.env, this.devId, { user, tty: 'tty1', emergency: !!emergency });
  this.env.act({ kind: 'login', dev: this.devId, text: 'Connexion console ' + user, mutates: false });
  this.env.obs('login:' + this.devId + ':' + user, true);
  return { out: [], push: sh };
};
UI.LoginSession = LoginSession;

/* ------------------------------------------------------------------ surfaces console */
function ConsoleSurface(run, devId) {
  this.run = run; this.devId = devId; this.d = run.W.d(devId);
  this.main = h('div.cmain'); this.rebootSeen = this.d._rt.rebootN || 0;
  const k = this.d.kind;
  const icon = k === 'linux' ? 'linux' : k === 'pf' ? 'firewall' : k === 'ios-rt' ? 'router' : k === 'ios-sw' ? 'switch' : k === 'printer' ? 'printer' : 'switch';
  const sub = k === 'linux' ? 'Console de la machine virtuelle (tty1)' : k === 'pf' ? 'Console de la machine virtuelle (menu pfSense)' : k === 'ios-sw' || k === 'ios-rt' ? 'Câble console (série)' : k === 'printer' ? 'Panneau de commande' : 'Équipement';
  this.frame = UI.Frame(run, devId, this.main, { icon, subtitle: sub, mainLabel: k === 'printer' ? 'Panneau' : 'Console', onShow: () => this.focus() });
  this.el = this.frame.el; this.term = null; this.started = false;
  const self = this;
  run.on('world', () => self.refresh());
  this.refresh(true);
}
UI.ConsoleSurface = ConsoleSurface;
const CP = ConsoleSurface.prototype;
CP.focus = function () { if (this.term) this.term.focus(); };
CP.destroy = function () { if (this.term) this.term.destroy(); };
CP.refresh = function (first) {
  const d = this.d; const powered = N.powered(d);
  const rb = d._rt.rebootN || 0;
  if (this.started && rb !== this.rebootSeen && powered) { this.rebootSeen = rb; this.bootOverlay(); return; }
  if (!powered) { if (this.mode !== 'off') this.showOff(); return; }
  if (this.mode === 'off' || !this.started) this.start();
};
CP.showOff = function () {
  this.mode = 'off'; this.started = false; if (this.term) { this.term.destroy(); this.term = null; }
  const d = this.d;
  UI.clear(this.main);
  this.main.append(h('div.blackscreen', h('div', { style: { textAlign: 'center' } }, h('div', { style: { fontSize: '40px', opacity: .3 } }, '⏻'), h('div', 'Machine hors tension'), h('div.muted', { style: { marginTop: '6px' } }, 'Vérifiez l’alimentation dans « Poste physique ».'))));
};
CP.bootOverlay = function () {
  const self = this; this.mode = 'boot'; if (this.term) { this.term.destroy(); this.term = null; }
  UI.clear(this.main);
  const bar = h('i'); this.main.append(h('div.blackscreen', h('div', { style: { textAlign: 'center', width: '320px' } }, h('div', 'Redémarrage de ' + this.devId + '…'), h('div.bootbar', bar))));
  let p = 0; const iv = setInterval(() => { p += 7; bar.style.width = Math.min(100, p) + '%'; if (p >= 100) { clearInterval(iv); self.started = false; self.mode = 'x'; self.start(); } }, 120);
};
CP.start = function () {
  const k = this.d.kind; const self = this; const run = this.run; const d = this.d;
  UI.clear(this.main); this.started = true; this.mode = 'on'; this.rebootSeen = d._rt.rebootN || 0;
  if (this.term) { this.term.destroy(); this.term = null; }
  const mk = (theme, sess, extra) => { const t = new UI.Terminal(Object.assign({ theme, session: sess, onExit: () => self.reopen() }, extra || {})); this.term = t; this.main.append(t.el); setTimeout(() => t.focus(), 30); return t; };
  if (k === 'linux') {
    const sess = new LoginSession(run.env, this.devId, {});
    mk('bash', sess, { cols: 100, onExec: () => self.afterExec(), onPop: () => self.afterExec() });
  } else if (k === 'ios-sw' || k === 'ios-rt') {
    const t = new UI.Terminal({ theme: 'ios', session: new GateSession(run.env, this.devId, this), banner: false, onExit: () => self.reopen(), onExec: () => self.afterExec(), onPop: () => { t.print([L(''), L(''), L('Press RETURN to get started.'), L('')], true); self.afterExec(); } });
    this.term = t; this.main.append(t.el); t.print([L(''), L(this.d.hostname + ' con0 is now available'), L(''), L(''), L(''), L('Press RETURN to get started.'), L('')], true); t.render(); setTimeout(() => t.focus(), 30);
  } else if (k === 'pf') {
    const sess = E.openPfConsole(run.env, this.devId, {});
    mk('pf', sess, { onExec: () => self.afterExec() });
  } else if (k === 'printer' && UI.printerPanel) {
    this.main.append(UI.printerPanel(run, this.devId));
  } else {
    this.main.append(h('div.blackscreen', h('div', { style: { textAlign: 'center' } }, UI.icon(k === 'isp' ? 'cloud' : 'switch', 48), h('div', { style: { marginTop: '8px' } }, k === 'isp' ? 'Réseau de l’opérateur (hors périmètre d’intervention)' : 'Commutateur non administrable : aucune console'), h('div.muted', 'Seuls la liaison et les voyants sont observables (poste physique).'))));
  }
};
CP.afterExec = function () {
  const d = this.d; const rb = d._rt.rebootN || 0;
  if (rb !== this.rebootSeen && N.powered(d)) { this.rebootSeen = rb; setTimeout(() => this.bootOverlay(), 300); }
  else if (!N.powered(d)) setTimeout(() => this.showOff(), 300);
};
CP.reopen = function () { this.afterExec(); if (this.mode === 'on') { if (this.d.kind === 'linux') this.start(); else this.start(); } };

/* Câble console Cisco : « Press RETURN » puis session */
function GateSession(env, devId, surf) { E.Session.call(this, env, devId, {}); this.kind = 'gate'; this.surf = surf; }
GateSession.prototype = Object.create(E.Session.prototype); GateSession.prototype.constructor = GateSession;
GateSession.prototype.prompt = function () { return ''; };
GateSession.prototype.run = function () {
  const d = this.d; const sh = E.openIos(this.env, this.devId, { via: 'console', priv: 1 });
  const out = sh.banner();
  return { out, push: sh };
};
GateSession.prototype.exec = function (line) { const r = this.normalize(this.run(line)); return r; };
UI.GateSession = GateSession;

/* ------------------------------------------------------------------ surface texte de repli */
function TextSurface(run, devId) { this.run = run; this.devId = devId; const main = h('div.blackscreen', h('div', 'Aucune interface pour ' + devId)); this.frame = UI.Frame(run, devId, main, {}); this.el = this.frame.el; }
UI.TextSurface = TextSurface; TextSurface.prototype.focus = function () { }; TextSurface.prototype.destroy = function () { };
})(typeof globalThis !== 'undefined' ? globalThis : window);
