/* ============================================================================
   Surface d'un poste / serveur Windows : état physique de l'écran (éteint, « aucun signal »),
   démarrage, verrouillage, ouverture de session avec authentification réelle (AD ou compte local),
   changement de mot de passe expiré, puis bureau (UI.Desktop). Émet les observations
   « use:HÔTE:screen » (écran de travail affiché) et « login:HÔTE:utilisateur ».
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, AD = SIM.ad, h = UI.h, W_ = E.win;
SIM.AVREG['win-logon-ui'] = 'Écran de connexion Windows (verrouillage, tuile « Autre utilisateur », libellé « Se connecter à : DOMAINE », message de changement de mot de passe, « Bienvenue ») : libellés reconstitués ; à vérifier par capture.';
SIM.AVREG['win-nosignal'] = 'Écran « aucun signal » : le texte exact varie selon le moniteur (marque inconnue) ; le simulateur affiche un message générique en français avec le nom de l’entrée active.';
const lc = s => String(s).toLowerCase();

/* ------------------------------------------------------------------ ouverture de session */
/* entrée utilisateur → { kind: 'local'|'domain', sam } (formes : nom, DOMAINE\nom, nom@domaine, .\nom, HÔTE\nom) */
function parseUser(W, d, raw) {
  raw = String(raw || '').trim(); let m;
  if ((m = raw.match(/^(.*)\\(.+)$/))) {
    const pre = m[1], name = m[2];
    if (pre === '.' || lc(pre) === lc(d.name)) return { kind: 'local', sam: name };
    if (d.win.domain && lc(pre) === lc(W_.netbios(W, d))) return { kind: 'domain', sam: name };
    return { kind: 'unknown', sam: name };
  }
  if ((m = raw.match(/^(.+)@(.+)$/))) { if (d.win.domain && lc(m[2]) === lc(d.win.domain)) return { kind: 'domain', sam: m[1] }; return { kind: 'unknown', sam: m[1] }; }
  return { kind: d.win.domain ? 'domain' : 'local', sam: raw };
}
UI.winLogon = function (W, d, raw, pwd, opts) {
  opts = opts || {}; const p = parseUser(W, d, raw);
  if (!p.sam) return { ok: false, code: 'badpwd', msg: AD.MSG.badpwd };
  if (p.kind === 'unknown') return { ok: false, code: 'badpwd', msg: AD.MSG.badpwd };
  if (p.kind === 'local') {
    const u = (d.win.localUsers || []).find(x => lc(x.name) === lc(p.sam));
    if (!u || (u.pwd !== undefined && u.pwd !== pwd) || u.enabled === false) return { ok: false, code: 'badpwd', msg: AD.MSG.badpwd };
    return { ok: true, code: 'local', user: u.name, local: true };
  }
  return AD.logon(W, d.id, p.sam, pwd, opts);
};
/* le mot de passe respecte-t-il la stratégie du domaine ? (même contrôle que net user) */
function pwdPolicyOk(W, d, np) {
  if (!d.win.domain) return true;
  const dc = AD.byDomain(W, d.win.domain); if (!dc) return true;
  const pol = AD.passwordPolicy(W, dc.win.ad); const cx = /[A-Z]/.test(np) && /[a-z]/.test(np) && /\d|[^A-Za-z0-9]/.test(np);
  return !(np.length < pol.minPwdLen || (pol.complexity && !cx));
}

/* ------------------------------------------------------------------ surface */
function WinSurface(run, devId) {
  this.run = run; this.W = run.W; this.devId = devId; this.d = run.W.d(devId); this.env = run.env;
  this.main = h('div.cmain'); this.layer = h('div.mlayer'); this.over = h('div.mover');
  this.main.append(this.layer, this.over);
  const server = W_.isServer(this.d);
  this.frame = UI.Frame(run, devId, this.main, { icon: server ? 'server' : 'pc', subtitle: this.d.os || '', mainLabel: 'Écran' });
  this.el = this.frame.el; this.mode = null; this.desk = null; this.rebootSeen = this.d._rt.rebootN || 0; this.lastUse = null;
  const self = this; this.onWorld = () => self.update(); run.on('world', this.onWorld);
  const powered = N.powered(this.d);
  if (this.d._rt.powerSeen === undefined) this.d._rt.powerSeen = powered;
  this.update(true);
}
UI.WinSurface = WinSurface;
const P = WinSurface.prototype;
P.focus = function () { if (this.desk) this.desk.el.focus && this.desk.el.focus(); };
P.destroy = function () { this.dropKey(); this.killDesk(); if (this.bootTimer) clearTimeout(this.bootTimer); };
P.killDesk = function () { if (this.desk) { this.desk.destroy(); this.desk = null; } };

P.update = function (first) {
  const d = this.d, powered = N.powered(d), prev = d._rt.powerSeen, rb = d._rt.rebootN || 0;
  if (powered !== prev) {
    d._rt.powerSeen = powered;
    if (!powered) { this.killDesk(); this.mode = 'off'; AD.sessionEnd(this.W, this.devId); }
    else { this.rebootSeen = rb; this.startBoot(); }
  } else if (powered && rb !== this.rebootSeen) { this.rebootSeen = rb; this.killDesk(); this.startBoot(); }
  else if (!powered && this.mode !== 'off') { this.killDesk(); this.mode = 'off'; }
  else if (powered && !this.mode) { if (d._rt.session) this.showDesk(); else this.showLogon(); }
  else if (powered && this.mode === 'desk' && !d._rt.session) { this.killDesk(); this.showLogon(); }
  this.drawOverlay();
  const sc = UI.screenState(d); const usable = sc.k === 'ok' && powered && (this.mode === 'logon' || this.mode === 'desk' || this.mode === 'lock');
  if (usable) { if (!this.lastUse) { this.lastUse = 1; this.env.obs('use:' + this.devId + ':screen', true); this.run.check && this.run.check(); } } else this.lastUse = null;
};
/* écran noir / aucun signal par-dessus tout le reste */
P.drawOverlay = function () {
  const sc = UI.screenState(this.d); const key = sc.k + (sc.src || '');
  if (key === this._ovKey) return; this._ovKey = key; UI.clear(this.over);
  if (sc.k === 'ok') { this.over.classList.add('hidden'); return; }
  this.over.classList.remove('hidden');
  if (sc.k === 'dark') this.over.append(h('div.monitorscr'));
  else this.over.append(h('div.monitorscr', h('div.nosig', h('div.src', 'Entrée : ' + sc.src), h('div.msg', 'Aucun signal'))));
};

P.startBoot = function () {
  const self = this; this.killDesk(); this.mode = 'boot'; UI.clear(this.layer);
  const d = this.d;
  this.layer.append(h('div.bootscr', h('div.spin')));
  if (this.bootTimer) clearTimeout(this.bootTimer);
  this.bootTimer = setTimeout(() => { self.bootTimer = null; if (!N.powered(d)) { self.mode = 'off'; UI.clear(self.layer); return; } if (d._rt.session) self.showDesk(); else self.showLogon(); self.update(); }, 2600);
  this.run.act(this.devId, 'Démarrage de ' + this.d.name, { kind: 'physical', mutates: false });
};

/* ------------------------------------------------------------------ bureau */
P.showDesk = function () {
  const self = this; this.mode = 'desk'; UI.clear(this.layer); this.killDesk();
  this.desk = new UI.Desktop(this.run, this.devId, { onLock: () => self.showLock() });
  this.layer.append(this.desk.el);
};

/* ------------------------------------------------------------------ connexion / verrouillage */
P.clockBits = function () { const dt = this.W.nowOf(this.devId); return { t: E.frTime(dt).slice(0, 5), dt: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][dt.getUTCMonth()] }; };
P.showLogon = function () {
  /* l'écran de démarrage (roue qui tourne) doit disparaître : resté au-dessus, il masquait l'écran de connexion après un redémarrage */
  this.killDesk(); this.mode = 'logon'; this.layer.querySelectorAll('.bootscr').forEach(x => x.remove()); this.drawLogon(null, 'lock');
};
P.showLock = function () {
  /* session conservée, bureau masqué sous l'écran de verrouillage */
  const self = this; this.mode = 'lock'; if (this.desk) this.desk.el.classList.add('hidden');
  this.drawLogon(W_.sessionUser(this.d), 'lock', true);
};
P.drawLogon = function (userPreset, step, locking) {
  const self = this, d = this.d; this.dropKey(); const old = this.layer.querySelector('.logon'); if (old) old.remove();
  const root = h('div.logon'); this.layer.append(root);
  const net = UI.netState(this.W, d);
  const corner = h('div.corner', h('span', net.k === 'ok' || net.k === 'noinet' ? '🖧' : '⊘'), h('span', 'FRA'), h('span', '⏻'));
  root.append(corner);
  if (step === 'lock') {
    const c = this.clockBits(); root.append(h('div.lockclk', h('div.lt', c.t), h('div.ld', c.dt)));
    const go = () => { self.dropKey(); self.drawLogon(userPreset, 'signin', locking); };
    root.addEventListener('click', go); this._kd = () => go(); setTimeout(() => { if (self._kd) document.addEventListener('keydown', self._kd, true); }, 50);
    return;
  }
  const last = userPreset || d.user || ((d.win.cachedLogons || [])[0]) || null;
  let other = !last;
  const card = h('div.card'); root.append(card);
  const render = () => {
    UI.clear(card);
    const avatar = h('div.avatar', UI.icon('user', 64)); card.append(avatar);
    const uIn = h('input', { placeholder: 'Nom d’utilisateur', type: 'text', spellcheck: false, autocomplete: 'off' });
    const pIn = h('input', { placeholder: 'Mot de passe', type: 'password', autocomplete: 'off' });
    const err = h('div.err.hidden');
    const vf = UI.vault.field({ user: other ? uIn : null, pwd: pIn, kinds: ['win'], userHint: other ? '' : last });
    const showErr = (msg) => { err.textContent = msg; err.classList.remove('hidden'); pIn.value = ''; };
    const submit = () => {
      const name = other ? uIn.value.trim() : last;
      if (!name) { uIn.focus(); return; }
      const pwd = pIn.value;
      if (locking && !other) {
        const r = UI.winLogon(self.W, d, last, pwd);
        if (!r.ok) { self.env.obs('login:' + self.devId + ':' + String(last).replace(/^.*\\/, '').replace(/@.*$/, ''), false); self.run.act(self.devId, 'Échec de déverrouillage', { kind: 'login', mutates: false }); showErr(r.msg); return; }
        /* le déverrouillage authentifie auprès du contrôleur de domaine (horaires, poste, verrouillage) : il vaut test de connexion */
        self.env.obs('login:' + self.devId + ':' + String(r.user || last).replace(/^.*\\/, '').replace(/@.*$/, ''), true);
        vf.submit(); if (self.desk) self.desk.el.classList.remove('hidden'); root.remove(); self.mode = 'desk'; self.run.act(self.devId, 'Déverrouillage de la session', { kind: 'login', mutates: false }); return;
      }
      const r = UI.winLogon(self.W, d, name, pwd);
      if (!r.ok) {
        self.env.obs('login:' + self.devId + ':' + name.replace(/^.*\\/, '').replace(/@.*$/, ''), false);
        self.run.act(self.devId, 'Échec de connexion à ' + self.d.name + ' (' + name + ')', { kind: 'login', mutates: false });
        if (r.code === 'pwdexp') { self.changePwd(root, card, name, r); return; }
        showErr(r.msg); if (r.code === 'locked' || r.code === 'disabled' || r.code === 'nologon' || r.code === 'secure' || r.code === 'time' || r.code === 'hours' || r.code === 'workstation' || r.code === 'acctexp') self.okMessage(card, r.msg, render); return;
      }
      vf.submit(); self.welcome(root, card, name, r);
    };
    [uIn, pIn].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
    if (other) card.append(h('div.uname', 'Autre utilisateur'), uIn); else card.append(h('div.uname', last));
    card.append(pIn, ...(vf.btn ? [vf.btn] : []), err, h('button.go', { on: { click: submit } }, '→'));
    if (d.win.domain) card.append(h('div.dom', 'Se connecter à : ' + W_.netbios(self.W, d)));
    else card.append(h('div.dom', 'Se connecter à : ' + d.name.toUpperCase()));
    if (last && !locking) card.append(h('div.other', { on: { click: () => { other = !other; render(); } } }, other ? last : 'Autre utilisateur'));
    if (locking && last) card.append(h('div.other', { on: { click: () => { other = false; render(); } } }, ' '));
    setTimeout(() => (other ? uIn : pIn).focus(), 20);
  };
  render();
};
P.dropKey = function () { if (this._kd) { document.removeEventListener('keydown', this._kd, true); this._kd = null; } };
P.okMessage = function (card, msg, back) {
  UI.clear(card); card.append(h('div.err', msg), h('button.go', { on: { click: back } }, 'OK'));
};
/* mot de passe expiré : changement obligatoire avant l'ouverture */
P.changePwd = function (root, card, name, r) {
  const self = this, d = this.d; UI.clear(card);
  const sam = name.replace(/^.*\\/, '').replace(/@.*$/, '');
  const a = h('input', { type: 'password', placeholder: 'Nouveau mot de passe' }), b = h('input', { type: 'password', placeholder: 'Confirmer le mot de passe' }); const err = h('div.err.hidden');
  const go = () => {
    if (a.value !== b.value) { err.textContent = 'Les mots de passe ne correspondent pas.'; err.classList.remove('hidden'); return; }
    if (!pwdPolicyOk(self.W, d, a.value)) { err.textContent = 'Impossible de mettre à jour votre mot de passe. La valeur fournie pour le nouveau mot de passe ne respecte pas la longueur, la complexité ou l’historique requis par le domaine.'; err.classList.remove('hidden'); return; }
    AD.setPassword(self.W, d.win.domain, sam, a.value, false); self.env.touch('pwdchange');
    self.run.act(self.devId, 'Changement du mot de passe de ' + sam + ' à l’ouverture de session', { kind: 'ui', mutates: true });
    const r2 = UI.winLogon(self.W, d, name, a.value); if (!r2.ok) { err.textContent = r2.msg; err.classList.remove('hidden'); return; }
    self.welcome(root, card, name, r2);
  };
  card.append(h('div.err', 'Votre mot de passe a expiré et doit être modifié.'), a, b, err, h('button.go', { on: { click: go } }, '→'));
  setTimeout(() => a.focus(), 20);
};
P.welcome = function (root, card, name, r) {
  const self = this, d = this.d; UI.clear(card);
  card.append(h('div.spin', { style: { margin: '0 auto 18px' } }), h('div.uname', 'Bienvenue'));
  const sam = r.user || name.replace(/^.*\\/, '').replace(/@.*$/, '');
  AD.sessionStart(this.W, this.devId, sam, r);
  this.env.obs('login:' + this.devId + ':' + sam, true);
  this.run.act(this.devId, 'Ouverture de session de ' + sam + ' sur ' + d.name + (r.cached ? ' (informations en cache)' : ''), { kind: 'login', mutates: false });
  setTimeout(() => { if (self.mode === 'off') return; root.remove(); self.showDesk(); self.update(); }, 1100);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
