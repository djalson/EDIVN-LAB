/* ============================================================================
   Bureau Windows d'un poste / serveur : écran (état physique : alimentation, câble vidéo, source,
   bouton de l'écran), démarrage, ouverture de session (authentification AD réelle), bureau, barre des
   tâches, menu Démarrer, Exécuter, UAC, zone de notification (réseau, horloge simulée).
   Les applications s'enregistrent dans UI.apps (fichiers 6x-*).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, AD = SIM.ad, WIN = SIM.win, h = UI.h, W_ = E.win;
SIM.AVREG['win-ui-texts'] = 'Libellés de l’interface Windows reproduits de mémoire (boîtes UAC, Exécuter, menu Démarrer, info-bulles réseau) : à vérifier par capture (Windows 10 22H2 / Server 2022 en français).';
SIM.AVREG['uac-local-admin'] = 'Boîte UAC : le compte administrateur local d’un poste (saisi « nom », « .\\nom » ou « HÔTE\\nom ») est accepté comme à l’ouverture de session ; sur un contrôleur de domaine, l’existence de comptes locaux (le modèle en porte, la vraie machine n’a pas de base locale) et le comportement exact de « .\\nom » sont à vérifier.';
SIM.AVREG['win-start-icon'] = 'Légal : le bouton Démarrer utilise un pictogramme original (grille de points), et non le logo Windows protégé.';

UI.apps = {};
UI.app = (id, def) => { UI.apps[id] = Object.assign({ id }, def); };

/* ------------------------------------------------------------------ état physique de l'écran */
UI.screenState = function (d) {
  /* l'écran est alimenté par la multiprise (strip) et son propre bouton ; l'unité centrale a son bloc d'alimentation (psu) et son bouton (on) */
  const p = d.phys || {};
  if (p.strip === false || p.monitorOn === false) return { k: 'dark' };
  const srcLabel = { DP: 'DisplayPort', HDMI1: 'HDMI 1', HDMI2: 'HDMI 2', VGA: 'VGA' }[p.source || 'DP'] || p.source;
  if ((p.source || 'DP') !== 'DP') return { k: 'nosig', src: srcLabel };
  if (p.psu === false || p.on === false || p.screenCable === false) return { k: 'nosig', src: srcLabel };
  return { k: 'ok' };
};

/* état de la connexion réseau (icône de la zone de notification) */
UI.netState = function (W, d) {
  const n = 'Ethernet0'; if (!d.ifaces[n]) return { k: 'none', label: 'Aucune connexion' };
  if (d.ifaces[n].adminDown) return { k: 'down', label: 'Désactivé' };
  if (!N.linkUp(W, d, n)) return { k: 'down', label: 'Câble réseau non connecté' };
  const l3 = N.l3up(W, d).filter(x => x.name === n)[0];
  if (!l3 || !l3.ip || /^169\.254\./.test(l3.ip) || l3.ip === '0.0.0.0') return { k: 'noid', label: 'Réseau non identifié', sub: 'Pas d’accès à Internet' };
  let internet = false; try { internet = N.ping(W, d.id, '8.8.8.8').ok; } catch (e) { internet = false; }
  const cfg = N.effCfg(d, n); const net = (d.win && d.win.domain) || cfg.suffix || 'Réseau';
  return internet ? { k: 'ok', label: net, sub: 'Connecté' } : { k: 'noinet', label: net, sub: 'Pas d’accès à Internet' };
};
const NETSVG = {
  ok: '<svg viewBox="0 0 18 16"><rect x="1" y="3" width="16" height="9" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M6 14h6M9 12v2" stroke="#fff" stroke-width="1.4"/></svg>',
  noinet: '<svg viewBox="0 0 18 16"><rect x="1" y="3" width="16" height="9" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M6 14h6M9 12v2" stroke="#fff" stroke-width="1.4"/><circle cx="14" cy="11" r="4" fill="#f5c518"/><path d="M14 8.6v2.6" stroke="#000" stroke-width="1.4"/><circle cx="14" cy="13" r=".8" fill="#000"/></svg>',
  down: '<svg viewBox="0 0 18 16"><rect x="1" y="3" width="16" height="9" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M6 14h6M9 12v2" stroke="#fff" stroke-width="1.4"/><circle cx="14" cy="11" r="4" fill="#e81123"/><path d="M12.2 9.2l3.6 3.6M15.8 9.2l-3.6 3.6" stroke="#fff" stroke-width="1.3"/></svg>'
};
NETSVG.noid = NETSVG.noinet; NETSVG.none = NETSVG.down;

/* ------------------------------------------------------------------ bureau */
function Desktop(run, devId, opts) {
  opts = opts || {};
  this.run = run; this.W = run.W; this.devId = devId; this.d = run.W.d(devId); this.env = run.env; this.opts = opts;
  this.server = W_.isServer(this.d);
  this.el = h('div.desk' + (opts.remote ? '.remote' : ''));
  this.wall = h('div.wall'); this.icons = h('div.dicons');
  this.el.append(this.wall, this.icons);
  this.wm = new UI.WM(this.el);
  this.taskbar = h('div.taskbar'); this.el.append(this.taskbar);
  this.flyout = null; this.start = null; this.apps = {};
  const self = this;
  this.buildIcons(); this.drawTaskbar();
  this.wm.on('change', () => self.drawTaskbar());
  this.onWorld = () => self.drawTray();
  this.onClock = () => self.drawClock();
  run.on('world', this.onWorld); run.on('clock', this.onClock);
  this.el.addEventListener('pointerdown', e => { if (self.start && !e.target.closest('.startmenu') && !e.target.closest('.startb')) self.closeStart(); if (self.flyout && !e.target.closest('.flyout') && !e.target.closest('.ti')) self.closeFlyout(); }, true);
  this.wall.addEventListener('contextmenu', e => { e.preventDefault(); UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Affichage', items: [{ label: 'Grandes icônes' }, { label: 'Icônes moyennes', checked: true }] }, '-', { label: 'Actualiser', fn: () => { } }, '-', { label: 'Paramètres d’affichage', disabled: true }, { label: 'Personnaliser', disabled: true }]); });
  this.el.addEventListener('keydown', e => { if (e.metaKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); self.open('run'); } });
  if (opts.autostart !== false && this.server && !opts.remoteNoSM) setTimeout(() => { if (UI.apps.servermgr && !self.closed) self.open('servermgr'); }, 60);
}
UI.Desktop = Desktop;
const P = Desktop.prototype;

P.user = function () { return W_.sessionUser(this.d); };
P.userLabel = function () { const u = this.user(); return u ? W_.whoami(this.W, this.d, u) : ''; };
P.isAdmin = function () { return W_.isAdminUser(this.W, this.d); };
P.elevatedByDefault = function () { return this.server && /^administrateur$/i.test(this.user() || ''); };
P.act = function (text, o) { return this.run.act(this.devId, text, Object.assign({ mutates: false }, o || {})); };
P.change = function (text, o) { this.env.touch('ui'); return this.run.act(this.devId, text, Object.assign({ mutates: true }, o || {})); };
P.msg = function (o) { return UI.msgBox(this.wm, o); };
P.destroy = function () { this.closed = true; this.run.off('world', this.onWorld); this.run.off('clock', this.onClock); this.wm.closeAll(); };

/* Contrôle de compte d'utilisateur : consentement (administrateur) ou saisie d'identifiants */
P.uac = function (progLabel, cb) {
  const self = this;
  if (this.elevatedByDefault()) { cb({ elevated: true }); return; }
  const dlg = (body, buttons) => this.wm.open({ title: 'Contrôle de compte d’utilisateur', w: 460, h: this.isAdmin() ? 270 : 330, resizable: false, minimizable: false, maximizable: false, owner: this.wm.active || undefined, className: 'uac', body: () => body });
  if (this.isAdmin()) {
    let win;
    const body = h('div.uacw', h('div.uach', 'Voulez-vous autoriser cette application à apporter des modifications à votre appareil ?'), h('div.uacb', UI.icon('shield', 40), h('div', h('div.uacn', progLabel), h('div.muted', 'Éditeur vérifié : Microsoft Windows'))), h('div.uacf', w2('Oui', () => { win.close(true); cb({ elevated: true }); }, true), w2('Non', () => { win.close(true); cb(null); })));
    win = dlg(body);
    return;
  }
  let win; const u = UI.w.text('', { w: 220 }), p = UI.w.text('', { w: 220, password: true }); const err = h('div.uacerr'); const vf = UI.vault.field({ user: u, pwd: p, kinds: ['win'] });
  const go = () => {
    const raw = u.value.trim(); const name = raw.replace(/^.*\\/, '').replace(/@.*$/, '');
    /* même grammaire que l'écran de connexion : nom, DOMAINE\nom, nom@domaine, .\nom, HÔTE\nom (compte local utilisable même si le contrôleur de domaine est injoignable) */
    let r = UI.winLogon(this.W, this.d, raw, p.value, { dry: true }); if (!r.ok && !/[\\@]/.test(raw)) r = UI.winLogon(this.W, this.d, '.\\' + raw, p.value, { dry: true });
    if (!r.ok || !W_.isAdminUser(this.W, this.d, name)) { err.textContent = 'Le nom d’utilisateur ou le mot de passe est incorrect.'; return; }
    vf.submit(); win.close(true); cb({ elevated: true, as: name });
  };
  const body = h('div.uacw', h('div.uach', 'Pour continuer, entrez un nom d’utilisateur et un mot de passe d’administrateur.'), h('div.uacb', UI.icon('shield', 40), h('div', h('div.uacn', progLabel))), h('div', { style: { padding: '0 16px' } }, u, h('div', { style: { height: '6px' } }), p, vf.btn, err), h('div.uacf', w2('Oui', go, true), w2('Non', () => { win.close(true); cb(null); })));
  win = dlg(body); setTimeout(() => u.focus(), 30);
  function w2(l, f, d) { return UI.w.btn(l, f, { def: d }); }
};

/* ouverture d'une application ; la plupart exigent une élévation (consoles d'administration) */
P.open = function (id, arg, opts) {
  const app = UI.apps[id]; opts = opts || {};
  if (!app) { this.msg({ title: 'Windows', icon: 'warning', text: 'Windows ne peut pas trouver « ' + id + ' ». Vérifiez que vous avez correctement tapé le nom, puis essayez à nouveau.' }); return null; }
  if (app.single) { const ex = this.apps[id]; if (ex && !ex.closed) { ex.restore(); return ex; } }
  const go = (elev) => { const win = app.open(this, arg, Object.assign({ elevated: !!(elev && elev.elevated) || this.elevatedByDefault() }, opts)); if (win) { win.appId = id; if (app.single) this.apps[id] = win; } return win; };
  if (app.admin && !opts.elevated && !this.elevatedByDefault()) { this.uac(app.title, el => { if (el) go(el); }); return null; }
  return go({ elevated: opts.elevated });
};
/* terminal cmd / PowerShell */
P.openTerminal = function (mode, elevated, cwd, as) {
  const self = this; const user = as || this.user();
  const sess = E.openWinShell(this.env, this.devId, { mode, elevated: !!elevated, user, cwd });
  let win;
  const title = () => (sess.elevated ? 'Administrateur : ' : '') + (mode === 'ps' ? 'Windows PowerShell' : 'Invite de commandes');
  const term = new UI.Terminal({ theme: mode === 'ps' ? 'ps' : 'cmd', session: sess, onExit: () => win && win.close(true), onLaunch: l => self.launch(l, sess), cols: 120, lineH: 17 });
  win = this.wm.open({ title: title(), icon: 'terminal', w: 760, h: 420, className: 'termwin', minW: 300, body: () => term.el, onClose: () => { term.destroy(); } });
  win.onFocus = () => term.focus(); setTimeout(() => term.focus(), 30);
  win.term = term; return win;
};
/* applications graphiques demandées depuis une ligne de commande */
P.launch = function (list, sess) {
  (list || []).forEach(l => { const id = l.app; if (UI.apps[id]) this.open(id, l.arg, { elevated: sess && sess.elevated }); else this.msg({ title: l.cmd || id, icon: 'warning', text: 'Cette application n’est pas disponible dans la simulation.' }); });
};

/* ------------------------------------------------------------------ icônes du bureau */
P.buildIcons = function () {
  const self = this;
  const ic = (label, icon, fn) => { const e = h('div.dicon', { on: { dblclick: fn, click: () => { self.icons.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); e.classList.add('sel'); } } }, UI.icon(icon, 36), h('div', label)); return e; };
  this.icons.append(ic('Ce PC', 'monitor', () => this.open('explorer', 'thispc')), ic('Corbeille', 'trash', () => this.open('explorer', 'recycle')));
};

/* ------------------------------------------------------------------ barre des tâches */
P.drawTaskbar = function () {
  const self = this; UI.clear(this.taskbar);
  const startIc = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#fff" stroke-width="2"/>' + [[10, 10], [16, 10], [22, 10], [10, 16], [16, 16], [22, 16], [10, 22], [16, 22], [22, 22]].map(p => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.5" fill="#fff"/>').join('') + '</svg>';
  const sb = h('div.tbtn.startb' + (this.start ? '.on' : ''), { title: 'Démarrer', on: { click: () => this.toggleStart(), contextmenu: e => { e.preventDefault(); UI.w.contextMenu(e.clientX, e.clientY - 150, this.startContext(), this.el); } } }); sb.innerHTML = startIc; sb.firstChild.setAttribute('width', 22); sb.firstChild.setAttribute('height', 22);
  const search = h('div.search', { on: { click: () => this.toggleStart(true) } }, 'Taper ici pour rechercher');
  this.taskbar.append(sb, search);
  /* épinglées */
  const pins = [['explorer', 'folder', 'Explorateur de fichiers'], ['browser', 'globe', 'Navigateur']];
  if (this.server) pins.unshift(['servermgr', 'server', 'Gestionnaire de serveur']);
  const shown = new Set();
  pins.forEach(([id, icon, label]) => {
    const wins = this.wm.wins.filter(x => !x.owner && x.appId === id); const act = wins.some(x => x === this.wm.active && x.state !== 'min');
    shown.add(id);
    this.taskbar.append(h('div.tbtn' + (wins.length ? '.open' : '') + (act ? '.on' : ''), { title: label, on: { click: () => { if (!wins.length) this.open(id); else if (act) wins[0].minimize(); else wins[0].restore(); } } }, UI.icon(icon, 20)));
  });
  this.wm.wins.filter(x => !x.owner && !shown.has(x.appId)).forEach(win => {
    const act = win === this.wm.active && win.state !== 'min';
    this.taskbar.append(h('div.tbtn.open' + (act ? '.on' : ''), { title: win.title, on: { click: () => { if (act) win.minimize(); else win.restore(); } } }, UI.icon(win.spec.icon || 'file', 18), h('span.tl', win.title)));
  });
  this.taskbar.append(h('div.grow'));
  this.tray = h('div.tray'); this.taskbar.append(this.tray); this.drawTray();
};
P.drawTray = function () {
  if (!this.tray) return; const self = this; UI.clear(this.tray); const ns = UI.netState(this.W, this.d);
  const net = h('div.ti', { title: ns.label + (ns.sub ? '\n' + ns.sub : ''), on: { click: e => { e.stopPropagation(); self.netFlyout(); }, contextmenu: e => { e.preventDefault(); UI.w.contextMenu(e.clientX, e.clientY - 120, [{ label: 'Résoudre les problèmes', disabled: true }, { label: 'Ouvrir les paramètres réseau et Internet', fn: () => self.open('ncpa') }], self.el); } } });
  const sv = h('span.netic'); sv.innerHTML = NETSVG[ns.k] || NETSVG.ok; net.append(sv);
  this.clockEl = h('div.ti.clock', { title: 'Date et heure', on: { click: e => { e.stopPropagation(); self.open('datetime'); } } });
  this.tray.append(h('div.ti', '︿'), net, h('div.ti', '🔊'), h('div.ti', { style: { fontSize: '11px' } }, 'FRA'), this.clockEl, h('div.ti', '🗨'));
  this.drawClock();
};
P.drawClock = function () { if (!this.clockEl) return; const dt = this.W.nowOf(this.devId); UI.clear(this.clockEl); this.clockEl.append(h('div', E.frTime(dt).slice(0, 5)), h('div', E.frDate(dt)));
  /* survol : la date complète avec le jour de la semaine, comme Windows (« mardi 27 octobre 2026 ») */
  const J = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  this.clockEl.title = J[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + M[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear(); };
P.closeFlyout = function () { if (this.flyout) { this.flyout.remove(); this.flyout = null; } };
P.netFlyout = function () {
  this.closeFlyout(); const ns = UI.netState(this.W, this.d); const self = this;
  const tile = h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 4px' } }, UI.icon('monitor', 28), h('div', h('div', { style: { fontWeight: 600 } }, ns.k === 'down' ? 'Ethernet' : ns.label), h('div.muted', { style: { color: '#b0b0b8' } }, ns.k === 'down' ? ns.label : (ns.k === 'noid' ? 'Pas d’accès à Internet' : ns.sub || ''))));
  const f = h('div.flyout', { style: { right: '6px', bottom: '46px', width: '300px' } }, h('div', { style: { color: '#b0b0b8', marginBottom: '6px' } }, 'Réseaux'), tile, h('div.hsep', { style: { background: '#444' } }), h('div', { style: { color: '#6cb0ff', cursor: 'pointer', padding: '4px' }, on: { click: () => { self.closeFlyout(); self.open('ncpa'); } } }, 'Paramètres réseau et Internet'));
  this.el.append(f); this.flyout = f;
};

/* ------------------------------------------------------------------ menu Démarrer */
P.startContext = function () {
  const self = this;
  return [{ label: 'Gestion de l’ordinateur', fn: () => self.open('compmgmt') }, { label: 'Gestionnaire de périphériques', fn: () => self.open('devmgmt') }, { label: 'Connexions réseau', fn: () => self.open('ncpa') }, { label: 'Gestionnaire des tâches', fn: () => self.open('taskmgr') }, '-', { label: 'Invite de commandes', fn: () => self.open('cmd') }, { label: 'Invite de commandes (admin)', fn: () => self.open('cmd', null, { runas: true }) }, { label: 'Windows PowerShell', fn: () => self.open('powershell') }, { label: 'Windows PowerShell (admin)', fn: () => self.open('powershell', null, { runas: true }) }, '-', { label: 'Explorateur de fichiers', fn: () => self.open('explorer') }, { label: 'Exécuter', fn: () => self.open('run') }, '-', { label: 'Arrêter ou se déconnecter', items: [{ label: 'Se déconnecter', fn: () => self.signOut() }, { label: 'Redémarrer', fn: () => self.restart() }, { label: 'Arrêter', fn: () => self.shutdown() }] }];
};
P.toggleStart = function (focusSearch) { if (this.start) this.closeStart(); else this.openStart(focusSearch); };
P.closeStart = function () { if (this.start) { this.start.remove(); this.start = null; this.drawTaskbar(); } };
P.openStart = function (focusSearch) {
  const self = this; this.closeFlyout(); this.closeStart();
  const items = [['explorer', 'folder', 'Explorateur de fichiers'], ['browser', 'globe', 'Navigateur'], ['cmd', 'terminal', 'Invite de commandes'], ['powershell', 'terminal', 'Windows PowerShell'], ['notepad', 'file', 'Bloc-notes'], ['control', 'gear', 'Panneau de configuration'], ['ncpa', 'network', 'Connexions réseau'], ['inetcpl', 'globe', 'Options Internet'], ['mstsc', 'monitor', 'Connexion Bureau à distance'], ['taskmgr', 'chart', 'Gestionnaire des tâches'], ['eventvwr', 'list', 'Observateur d’événements'], ['services', 'gear', 'Services']];
  if (this.d.vpn) items.push(['openvpn', 'vpn', 'OpenVPN GUI']);
  if (this.d.sshPub) items.push(['putty', 'terminal', 'PuTTY']);
  const admin = [['servermgr', 'server', 'Gestionnaire de serveur'], ['aduc', 'users', 'Utilisateurs et ordinateurs Active Directory'], ['gpmc', 'shield', 'Gestion de stratégie de groupe'], ['domain', 'network', 'Domaines et approbations Active Directory'], ['lusrmgr', 'users', 'Utilisateurs et groupes locaux'], ['dhcp', 'network', 'DHCP'], ['dns', 'globe', 'DNS'], ['iis', 'globe', 'Gestionnaire des services Internet (IIS)'], ['wf', 'shield', 'Pare-feu Windows Defender avec fonctions avancées de sécurité'], ['certlm', 'cert', 'Certificats (ordinateur local)'], ['compmgmt', 'gear', 'Gestion de l’ordinateur']];
  const kept = items.filter(x => UI.apps[x[0]]); const adm = this.server ? admin.filter(x => UI.apps[x[0]]) : [];
  const list = h('div.slist');
  const search = h('input.w10in', { placeholder: 'Taper ici pour rechercher', style: { margin: '0 14px 6px', width: 'calc(100% - 28px)' } });
  const draw = (q) => {
    UI.clear(list); const f = x => !q || x[2].toLowerCase().indexOf(q.toLowerCase()) >= 0;
    /* clic droit : « Exécuter en tant qu'administrateur » (UAC : consentement ou identifiants d'un administrateur) */
    const runAdmin = x => { self.closeStart(); if (x[0] === 'cmd' || x[0] === 'powershell') { self.open(x[0], undefined, { runas: true }); return; } self.uac(x[2], el => { if (el) self.open(x[0], undefined, { elevated: true }); }); };
    const mk = x => h('div.si', { on: { click: () => { self.closeStart(); self.open(x[0]); }, contextmenu: e => { e.preventDefault(); e.stopPropagation(); UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Ouvrir', fn: () => { self.closeStart(); self.open(x[0]); } }, { label: 'Exécuter en tant qu’administrateur', fn: () => runAdmin(x) }], self.el); } } }, UI.icon(x[1], 22), x[2]);
    /* la recherche trouve aussi les outils Windows qui ne sont pas épinglés (pare-feu avancé, date et heure, gestion de l'ordinateur…), comme le vrai menu Démarrer */
    const shown = kept.concat(adm).map(x => x[0]);
    const more = q ? [['wf', 'shield', 'Pare-feu Windows Defender avec fonctions avancées de sécurité'], ['datetime', 'clock', 'Date et heure'], ['compmgmt', 'gear', 'Gestion de l’ordinateur'], ['lusrmgr', 'users', 'Utilisateurs et groupes locaux'], ['devmgmt', 'gear', 'Gestionnaire de périphériques'], ['diskmgmt', 'gear', 'Gestion des disques'], ['certlm', 'cert', 'Certificats (ordinateur local)'], ['msinfo', 'list', 'Informations système'], ['regedit', 'gear', 'Éditeur du Registre'], ['gpedit', 'shield', 'Éditeur de stratégie de groupe locale'], ['ise', 'terminal', 'Windows PowerShell ISE']].filter(x => UI.apps[x[0]] && shown.indexOf(x[0]) < 0 && f(x)) : [];
    const a = kept.filter(f).concat(more), b = adm.filter(f); if (a.length) { list.append(h('div.sh', q ? 'Meilleurs résultats' : 'Applications')); a.forEach(x => list.append(mk(x))); }
    if (b.length) { list.append(h('div.sh', 'Outils d’administration Windows')); b.forEach(x => list.append(mk(x))); }
    if (!a.length && !b.length) list.append(h('div.sh', 'Aucun résultat'));
  };
  search.addEventListener('input', () => draw(search.value)); draw('');
  const power = h('div.ri', { title: 'Alimentation', on: { click: e => { const r = e.currentTarget.getBoundingClientRect(); UI.w.contextMenu(r.right, r.top - 90, [{ label: 'Verrouiller', fn: () => { self.closeStart(); self.lock(); } }, { label: 'Se déconnecter', fn: () => { self.closeStart(); self.signOut(); } }, { label: 'Redémarrer', fn: () => { self.closeStart(); self.restart(); } }, { label: 'Arrêter', fn: () => { self.closeStart(); self.shutdown(); } }], self.el); } } }, UI.icon('power', 22));
  const rail = h('div.srail', h('div.ri', { title: this.userLabel() }, UI.icon('user', 22)), h('div.ri', { title: 'Paramètres', on: { click: () => { self.closeStart(); self.open('ncpa'); } } }, UI.icon('gear', 22)), power);
  const tiles = h('div.stiles', [['explorer', 'Explorateur'], ['browser', 'Navigateur'], ['cmd', 'Invite de commandes'], ['control', 'Panneau de config.']].filter(x => UI.apps[x[0]]).map(x => h('div.tile', { on: { click: () => { self.closeStart(); self.open(x[0]); } } }, UI.icon(x[0] === 'browser' ? 'globe' : x[0] === 'explorer' ? 'folder' : x[0] === 'cmd' ? 'terminal' : 'gear', 28), x[1])));
  const m = h('div.startmenu', rail, h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } }, h('div', { style: { height: '8px' } }), search, list), tiles);
  this.el.append(m); this.start = m; this.drawTaskbar(); if (focusSearch) setTimeout(() => search.focus(), 20);
};

/* ------------------------------------------------------------------ session */
P.lock = function () { this.run.act(this.devId, 'Verrouillage de la session', { kind: 'ui', mutates: false }); if (this.opts.onLock) this.opts.onLock(); };
P.signOut = function () {
  AD.sessionEnd(this.W, this.devId); this.run.act(this.devId, 'Fermeture de session (' + this.user() + ')', { kind: 'ui', mutates: true, impact: undefined }); this.env.touch('logoff');
};
P.restart = function () {
  const self = this;
  this.msg({ title: 'Redémarrer', icon: 'question', text: 'Voulez-vous vraiment redémarrer ' + this.d.name.toUpperCase() + ' ? Les sessions ouvertes seront fermées.', buttons: [{ label: 'Redémarrer', default: true, fn: () => { SIM.steps.reboot(self.W, { dev: self.devId }); self.env.advance(80); self.run.act(self.devId, 'Redémarrage de ' + self.d.name, { kind: 'ui', mutates: true, impact: 'reboot' }); self.env.touch('reboot'); } }, { label: 'Annuler' }] });
};
P.shutdown = function () {
  const self = this;
  this.msg({ title: 'Arrêter', icon: 'question', text: 'Voulez-vous vraiment arrêter ' + this.d.name.toUpperCase() + ' ? Il faudra le rallumer physiquement.', buttons: [{ label: 'Arrêter', default: true, fn: () => { self.d.phys = self.d.phys || {}; self.d.phys.on = false; self.run.act(self.devId, 'Arrêt de ' + self.d.name, { kind: 'ui', mutates: true, impact: 'reboot' }); self.env.touch('power'); } }, { label: 'Annuler' }] });
};

/* ------------------------------------------------------------------ applications de base du bureau */
UI.app('cmd', { title: 'Invite de commandes', icon: 'terminal', open: (desk, arg, o) => { const run = () => desk.openTerminal('cmd', o.elevated, undefined); if (o.runas && !o.elevated) { desk.uac('Invite de commandes', el => { if (el) { const win = desk.openTerminal('cmd', true, undefined, el.as); win.appId = 'cmd'; } }); return null; } const win = run(); win.appId = 'cmd'; return win; } });
UI.app('powershell', { title: 'Windows PowerShell', icon: 'terminal', open: (desk, arg, o) => { if (o.runas && !o.elevated) { desk.uac('Windows PowerShell', el => { if (el) { const win = desk.openTerminal('ps', true, undefined, el.as); win.appId = 'powershell'; } }); return null; } const win = desk.openTerminal('ps', o.elevated, undefined); win.appId = 'powershell'; return win; } });
UI.apps.ise = UI.apps.powershell;
/* Exécuter : lance une commande ou une console (comme Win+R) */
UI.app('run', {
  title: 'Exécuter', icon: 'terminal', single: true,
  open: (desk) => {
    const inp = h('input.w10in', { style: { width: '100%' }, spellcheck: false }); let win; const err = h('div');
    const go = () => {
      const cmd = inp.value.trim(); if (!cmd) return;
      const bare = cmd.toLowerCase().replace(/^"|"$/g, '').replace(/\.(exe|msc|cpl)$/i, '');
      if (/^(cmd|powershell|pwsh)$/i.test(bare)) { win.close(true); desk.open(bare === 'cmd' ? 'cmd' : 'powershell'); return; }
      const id = W_.apps[bare] || W_.apps[bare.split(/\s+/)[0]] || (UI.apps[bare] ? bare : null);
      const first = bare.split(/\s+/)[0];
      if (UI.apps[id] || UI.apps[first]) { win.close(true); desk.open(UI.apps[id] ? id : first, bare.split(/\s+/).slice(1).join(' ')); return; }
      if (/^\\\\/.test(cmd) || /^[a-z]:\\/i.test(cmd) || /^https?:/i.test(cmd) || /^www\./i.test(cmd)) { win.close(true); if (/^(https?:|www\.)/i.test(cmd)) desk.open('browser', cmd); else desk.open('explorer', cmd); return; }
      desk.msg({ title: cmd, icon: 'error', owner: win, text: 'Windows ne peut pas trouver « ' + cmd + ' ». Vérifiez que vous avez correctement tapé le nom, puis essayez à nouveau.' });
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); if (e.key === 'Escape') win.close(true); });
    win = desk.wm.open({ title: 'Exécuter', icon: 'terminal', x: 8, y: Math.max(20, desk.wm.size().h - 190), w: 410, h: 170, resizable: false, minimizable: false, maximizable: false, className: 'rundlg', body: () => h('div.runw', h('div.runrow', UI.icon('terminal', 32), h('div', 'Entrez le nom d’un programme, dossier, document ou ressource Internet, et Windows l’ouvrira pour vous.')), h('div.runrow', h('label', 'Ouvrir :'), inp), h('div.mbbtns', UI.w.btn('OK', go, { def: true }), UI.w.btn('Annuler', () => win.close(true)), UI.w.btn('Parcourir…', () => { }, { disabled: true }))) });
    setTimeout(() => inp.focus(), 30); win.appId = 'run'; return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
