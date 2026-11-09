/* ============================================================================
   Applications MMC : Services (services.msc) et Observateur d'événements (eventvwr.msc).
   Les deux agissent sur le modèle (d.win.svc, journaux) comme les commandes sc / net / Get-WinEvent,
   en local ou sur un autre ordinateur (connexion distante sous réserve de réseau + droits).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, WIN = SIM.win, h = UI.h, W_ = E.win;
SIM.AVREG['svc-gui'] = 'Services (services.msc) : libellés des colonnes, du menu contextuel, des boîtes « Propriétés » et « Contrôle de service », message d’erreur « Windows n’a pas pu démarrer le service… » reconstitués ; descriptions des services volontairement absentes (non vérifiées).';
SIM.AVREG['evt-gui'] = 'Observateur d’événements : arborescence, colonnes, volet Détail et libellés des actions reconstitués (version française) ; noms des journaux d’applications et de services (DHCP-Server, DNS Server, GroupPolicy) à vérifier par capture.';
SIM.AVREG['mmc-remote'] = 'Connexion à un autre ordinateur depuis une console MMC : texte de la boîte « Sélectionner un ordinateur » et des messages d’échec reconstitués.';
const lc = s => String(s).toLowerCase();

/* ------------------------------------------------------------------ cible distante (RPC 135 + SMB 445, droits d'administrateur) */
UI.resolveHost = function (desk, name) {
  const W = desk.W; if (!name || lc(name) === lc(desk.d.name) || name === '.' || lc(name) === 'localhost') return { dev: desk.d, local: true };
  const nm = name.replace(/^\\\\/, ''); const r = U.isIP(nm) ? { ok: true, ip: nm } : N.resolve(W, desk.devId, nm);
  if (!r.ok) return { err: 'name' };
  const c = N.connect(W, desk.devId, r.ip, 'tcp', 135), c2 = N.connect(W, desk.devId, r.ip, 'tcp', 445);
  if (c.state !== 'open' || c2.state !== 'open') return { err: 'rpc' };
  const t = W.d(c.dstDev); if (!t.win) return { err: 'rpc' };
  const tok = W_.token(W, desk.d);
  if (!(tok.has && tok.has('builtin\\administrateurs')) && !W_.isAdminUser(W, desk.d)) return { err: 'denied' };
  return { dev: t };
};
const RMSG = { name: 'Le nom de l’ordinateur est introuvable.', rpc: 'Le serveur RPC n’est pas disponible.', denied: 'Accès refusé.' };
UI.remoteMsg = e => RMSG[e] || 'Erreur.';
/* boîte « Sélectionner un ordinateur » */
UI.pickComputer = function (desk, owner, cb) {
  let win; const rl = h('div'); let which = 'local'; const nm = UI.w.text('', { w: 220, disabled: true });
  const r1 = UI.w.radio('cmp', 'Ordinateur local (sur lequel cette console s’exécute)', true, () => { which = 'local'; nm.disabled = true; });
  const r2 = UI.w.radio('cmp', 'Un autre ordinateur :', false, () => { which = 'other'; nm.disabled = false; nm.focus(); });
  rl.append(h('div', { style: { margin: '6px 0 10px' } }, 'Sélectionnez l’ordinateur que vous voulez que cette console gère.'), r1, h('div', { style: { height: '6px' } }), h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, r2, nm));
  win = desk.wm.open({ title: 'Sélectionner un ordinateur', w: 460, h: 220, owner, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', rl, h('div.mbbtns', UI.w.btn('OK', () => { const v = which === 'local' ? '' : nm.value.trim(); win.close(true); cb(v); }, { def: true }), UI.w.btn('Annuler', () => win.close(true)))) });
};

/* ------------------------------------------------------------------ Services */
const STARTTXT = { auto: 'Automatique', 'auto-delayed': 'Automatique (début différé)', manual: 'Manuel', disabled: 'Désactivé' };
const STARTKEY = { 'Automatique': 'auto', 'Automatique (début différé)': 'auto-delayed', 'Manuel': 'manual', 'Désactivé': 'disabled' };
UI.app('services', {
  title: 'Services', icon: 'gear', admin: true, single: true,
  open: (desk, arg) => {
    const self = { target: desk.d, label: 'Services (local)' };
    const rows = () => Object.keys(self.target.win.svc).map(k => ({ id: k, name: WIN.SVC_DISPLAY[k] || k, key: k, state: self.target.win.svc[k].state, start: self.target.win.svc[k].start }));
    let win, api, lv; let selected = null;
    const where = () => (self.target.id === desk.devId ? 'Ordinateur local' : self.target.name.toUpperCase());
    const errBox = (owner, key, code, msg) => desk.msg({ title: 'Services', icon: 'error', owner, text: 'Windows n’a pas pu démarrer le service ' + (WIN.SVC_DISPLAY[key] || key) + ' sur ' + where() + '.\nErreur ' + code + ' : ' + msg });
    const control = (key, verb, owner, done) => {
      const d = self.target; const sv = d.win.svc[key]; const disp = WIN.SVC_DISPLAY[key] || key;
      if (verb === 'start') {
        if (sv.state === 'running') { done && done(); return; }
        if (sv.start === 'disabled') { errBox(owner, key, 1058, 'Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.'); return; }
        UI.w.progressDialog(desk.wm, owner || win, 'Contrôle de service', 'Windows tente de démarrer le service suivant sur ' + where() + '\n\n' + disp, 1200, () => {
          WIN.setSvc(desk.W, d.id, key, 'running'); desk.env.advance(2);
          desk.change('Services : démarrage de « ' + disp + ' » sur ' + d.name, { dev: desk.devId }); refresh(); done && done();
        });
      } else if (verb === 'stop') {
        if (sv.state !== 'running') { done && done(); return; }
        UI.w.progressDialog(desk.wm, owner || win, 'Contrôle de service', 'Windows tente d’arrêter le service suivant sur ' + where() + '\n\n' + disp, 1000, () => {
          WIN.setSvc(desk.W, d.id, key, 'stopped'); desk.env.advance(2);
          desk.change('Services : arrêt de « ' + disp + ' » sur ' + d.name, { dev: desk.devId, impact: 'svc-stop' }); refresh(); done && done();
        });
      } else if (verb === 'restart') {
        if (sv.state === 'running') {
          UI.w.progressDialog(desk.wm, owner || win, 'Contrôle de service', 'Windows tente d’arrêter le service suivant sur ' + where() + '\n\n' + disp, 900, () => { WIN.setSvc(desk.W, d.id, key, 'stopped'); desk.env.advance(1); control(key, 'start', owner, done); });
        } else control(key, 'start', owner, done);
      }
    };
    const refresh = () => { lv.setRows(rows(), true); upd(); };
    const upd = () => { const r = lv.selected(); selected = r; api.setActions(actions(r)); api.status(''); };
    const props = (r) => {
      const d = self.target; const sv = () => d.win.svc[r.key]; let newStart = sv().start;
      const stEl = h('b'); const bStart = UI.w.btn('Démarrer', () => control(r.key, 'start', ps, paint)), bStop = UI.w.btn('Arrêter', () => control(r.key, 'stop', ps, paint)); const bPause = UI.w.btn('Suspendre', () => { }, { disabled: true }), bRes = UI.w.btn('Reprendre', () => { }, { disabled: true });
      const sel = UI.w.select(['Automatique (début différé)', 'Automatique', 'Manuel', 'Désactivé'], STARTTXT[sv().start], v => { newStart = STARTKEY[v]; ps.markDirty(); });
      const paint = () => { stEl.textContent = sv().state === 'running' ? 'En cours d’exécution' : 'Arrêté'; bStart.disabled = sv().state === 'running'; bStop.disabled = sv().state !== 'running'; };
      const general = h('div.pad', UI.w.field('Nom du service :', h('span', r.key), { lw: 150 }), UI.w.field('Nom complet :', h('span', WIN.SVC_DISPLAY[r.key] || r.key), { lw: 150 }), UI.w.field('Description :', h('span.muted', ''), { lw: 150 }),
        UI.w.field('Chemin d’accès des fichiers exécutables :', h('span.muted', ''), { lw: 150 }), UI.w.sep(), UI.w.field('Type de démarrage :', sel, { lw: 150 }), h('div', { style: { height: '10px' } }), UI.w.field('État du service :', stEl, { lw: 150 }), h('div', { style: { display: 'flex', gap: '6px', margin: '8px 0' } }, bStart, bStop, bPause, bRes),
        h('div', { style: { marginTop: '10px' } }, 'Vous pouvez spécifier les paramètres de démarrage qui s’appliquent quand vous démarrez le service à partir d’ici.'));
      paint();
      const ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + (WIN.SVC_DISPLAY[r.key] || r.key) + ' (Ordinateur local)', icon: 'gear', w: 440, h: 460, tabs: [{ label: 'Général', content: () => general }],
        onOk: () => { if (newStart !== sv().start) { sv().start = newStart; desk.env.touch('svc'); desk.change('Services : type de démarrage de « ' + (WIN.SVC_DISPLAY[r.key] || r.key) + ' » → ' + STARTTXT[newStart], { dev: desk.devId }); refresh(); } },
        onApply: () => { if (newStart !== sv().start) { sv().start = newStart; desk.env.touch('svc'); desk.change('Services : type de démarrage de « ' + (WIN.SVC_DISPLAY[r.key] || r.key) + ' » → ' + STARTTXT[newStart], { dev: desk.devId }); refresh(); } } });
    };
    const ctx = (r, e) => { UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Démarrer', disabled: r.state === 'running', fn: () => control(r.key, 'start') }, { label: 'Arrêter', disabled: r.state !== 'running', fn: () => control(r.key, 'stop') }, { label: 'Suspendre', disabled: true }, { label: 'Reprendre', disabled: true }, { label: 'Redémarrer', disabled: r.state !== 'running', fn: () => control(r.key, 'restart') }, '-', { label: 'Toutes les tâches', items: [{ label: 'Démarrer', disabled: true }] }, '-', { label: 'Actualiser', fn: refresh }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }, '-', { label: 'Aide', disabled: true }]); };
    const actions = (r) => {
      const sec = [{ title: 'Services', items: [{ label: 'Autres actions', arrow: true, fn: () => { } }] }];
      if (r) sec.push({ title: r.name, items: [{ label: 'Démarrer le service', disabled: r.state === 'running', fn: () => control(r.key, 'start') }, { label: 'Arrêter le service', disabled: r.state !== 'running', fn: () => control(r.key, 'stop') }, { label: 'Suspendre le service', disabled: true }, { label: 'Reprendre le service', disabled: true }, { label: 'Redémarrer le service', disabled: r.state !== 'running', fn: () => control(r.key, 'restart') }, '-', { label: 'Propriétés', fn: () => props(r) }, { label: 'Aide', disabled: true }] });
      return sec;
    };
    lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 260 }, { key: 'state', label: 'État', w: 130, fmt: r => (r.state === 'running' ? 'En cours d’exécution' : ''), sortVal: r => (r.state === 'running' ? 'En cours d’exécution' : '') }, { key: 'start', label: 'Type de démarrage', w: 190, fmt: r => STARTTXT[r.start] || r.start }], rows: rows(), key: r => r.key, sort: { key: 'name' }, onSelect: () => upd(), onOpen: r => props(r), onContext: ctx, onRefresh: () => refresh() });
    const menu = [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: () => [{ label: 'Se connecter à un autre ordinateur…', fn: () => UI.pickComputer(desk, win, v => { const t = UI.resolveHost(desk, v); if (t.err) { desk.msg({ title: 'Services', icon: 'error', owner: win, text: 'Impossible de se connecter à l’ordinateur « ' + v + ' ».\n' + UI.remoteMsg(t.err) }); return; } self.target = t.dev; win.setTitle('Services'); tree.setRoots(roots()); refresh(); desk.act('Services : connexion à ' + t.dev.name, { kind: 'ui' }); }) }, { label: 'Actualiser', key: 'F5', fn: refresh }, '-', { label: 'Propriétés', disabled: !selected, fn: () => selected && props(selected) }] }, { label: 'Affichage', items: [{ label: 'Étendu', checked: true }, { label: 'Standard' }] }, { label: '?', items: [{ label: 'À propos de Services', disabled: true }] }];
    const roots = () => [{ key: 'root', label: 'Services (' + (self.target.id === desk.devId ? 'local' : self.target.name.toUpperCase()) + ')', icon: 'gear', expanded: true }];
    let tree;
    win = UI.w.mmc({ wm: desk.wm, title: 'Services', icon: 'gear', w: 900, h: 520, menu, roots: roots(), noTree: false, onSelect: (n, a) => { a.setMid(lv.el); }, onRefresh: refresh });
    api = win.mmc; tree = api.tree; api.setMid(lv.el); upd(); win.appId = 'services'; desk.act('Ouverture de Services', { kind: 'ui' });
    return win;
  }
});

/* ------------------------------------------------------------------ Observateur d'événements */
const LVL_ICON = { 'Information': 'info', 'Avertissement': 'warning', 'Erreur': 'error', 'Critique': 'error', 'Succès de l’audit': 'key', 'Audit des échecs': 'lock' };
const CHANS = [
  { key: 'Application', label: 'Application', chan: 'Application', path: 'Journaux Windows' },
  { key: 'Sécurité', label: 'Sécurité', chan: 'Sécurité', path: 'Journaux Windows', admin: true },
  { key: 'Installation', label: 'Installation', chan: null, path: 'Journaux Windows' },
  { key: 'Système', label: 'Système', chan: 'Système', path: 'Journaux Windows' },
  { key: 'Forwarded', label: 'Événements transférés', chan: null, path: 'Journaux Windows' }
];
const pad = U.pad2;
const fmtT = ms => { const t = new Date(ms); return pad(t.getUTCDate()) + '/' + pad(t.getUTCMonth() + 1) + '/' + t.getUTCFullYear() + ' ' + pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':' + pad(t.getUTCSeconds()); };
UI.app('eventvwr', {
  title: 'Observateur d’événements', icon: 'list', admin: true, single: true,
  open: (desk) => {
    const self = { target: desk.d }; let win, api, lv, det; let cur = CHANS[3]; let filter = null; let selected = null;
    const hasDhcp = () => self.target.win && (self.target.win.dhcp || self.target.win.svc.DHCPServer); const hasDns = () => self.target.win && (self.target.win.dns || self.target.win.svc.DNS);
    const roots = () => {
      const app = [{ key: 'GroupPolicy', label: 'GroupPolicy', chan: 'GroupPolicy', icon: 'list', parent: 'Opérationnel' }];
      const kids = []; if (hasDhcp()) kids.push({ key: 'DHCP-Server', label: 'DHCP-Server', chan: 'DHCP-Server', icon: 'list' });
      kids.push({ key: 'GroupPolicy', label: 'GroupPolicy', chan: 'GroupPolicy', icon: 'list' });
      const apps = [{ key: 'ms', label: 'Microsoft', icon: 'folder', children: [{ key: 'win', label: 'Windows', icon: 'folder', children: kids }] }];
      if (hasDns()) apps.unshift({ key: 'DNS-Server', label: 'DNS Server', chan: 'DNS-Server', icon: 'list' });
      return [{ key: 'root', label: 'Observateur d’événements (' + (self.target.id === desk.devId ? 'local' : self.target.name.toUpperCase()) + ')', icon: 'list', expanded: true, children: [
        { key: 'custom', label: 'Affichages personnalisés', icon: 'folder', children: [{ key: 'admin-events', label: 'Événements d’administration', chan: '*admin', icon: 'list' }] },
        { key: 'winlogs', label: 'Journaux Windows', icon: 'folder', expanded: true, children: CHANS.map(c => ({ key: c.key, label: c.label, chan: c.chan, icon: 'list', defined: true })) },
        { key: 'applogs', label: 'Journaux des applications et des services', icon: 'folder', children: apps }, { key: 'subs', label: 'Abonnements', icon: 'folder' }] }];
    };
    const events = () => {
      if (!cur.chan) return [];
      const d = self.target; let list = [];
      if (cur.chan === '*admin') { ['Application', 'Système'].forEach(c => d._rt.logs && (d._rt.logs['evt:' + c] || []).forEach(e => { if (/Erreur|Avertissement|Critique/.test(e.level)) list.push(Object.assign({ chan: c }, e)); })); }
      else list = ((d._rt.logs || {})['evt:' + cur.chan] || []).map(e => Object.assign({ chan: cur.chan }, e));
      list = list.map((e, i) => Object.assign({}, e, { _i: i, rid: e.id, id: SIM.codes.ev(e.source || '', e.id, 'journal'), msg: SIM.codes.text(e.msg, 'journal') }));   // D-106 : ID masqué si non vérifié
      if (filter) { if (filter.levels.length) list = list.filter(e => filter.levels.indexOf(e.level) >= 0); if (filter.ids.length) list = list.filter(e => filter.ids.indexOf(String(e.rid)) >= 0); if (filter.src) list = list.filter(e => lc(e.source).indexOf(lc(filter.src)) >= 0); if (filter.text) list = list.filter(e => lc(e.msg).indexOf(lc(filter.text)) >= 0); }
      return list;
    };
    const detail = (e) => {
      UI.clear(det.el); if (!e) { det.el.append(h('div.muted.pad', 'Sélectionnez un événement pour afficher ses détails.')); return; }
      const d = self.target;
      const gen = h('div.pad', h('div.evmsg', String(e.msg).split('\n').map(l => h('div', l === '' ? '​' : l))), h('div.hsep'),
        UI.w.field('Nom du journal :', h('span', e.chan), { lw: 130 }), UI.w.field('Source :', h('span', e.source), { lw: 130 }), UI.w.field('Date :', h('span', fmtT(e.t)), { lw: 130 }), UI.w.field('ID de l’événement :', h('span', String(e.id)), { lw: 130 }), UI.w.field('Catégorie de la tâche :', h('span', 'Aucun'), { lw: 130 }), UI.w.field('Niveau :', h('span', e.level), { lw: 130 }), UI.w.field('Utilisateur :', h('span', 'N/A'), { lw: 130 }), UI.w.field('Ordinateur :', h('span', W_.fqdn(d).toUpperCase()), { lw: 130 }));
      det.el.append(gen);
    };
    const refresh = () => { lv.setRows(events().sort((a, b) => b.t - a.t), true); api.status(events().length + ' événements'); selected = lv.selected(); detail(selected); };
    const filterDlg = () => {
      const lvls = ['Critique', 'Avertissement', 'Erreur', 'Information']; const want = new Set(filter ? filter.levels : []); const id = UI.w.text(filter ? filter.ids.join(',') : '', { w: 220 }); const src = UI.w.text(filter ? filter.src : '', { w: 220 }); const txt = UI.w.text(filter ? filter.text : '', { w: 220 }); let w2;
      const ck = lvls.map(l => UI.w.check(l, want.has(l), v => { if (v) want.add(l); else want.delete(l); }));
      w2 = desk.wm.open({ title: 'Filtrer le journal actuel', w: 460, h: 330, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', UI.w.group('Niveau d’événement :', h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap' } }, ck)), UI.w.field('ID d’événement :', id, { lw: 140 }), UI.w.field('Source :', src, { lw: 140 }), UI.w.field('Contient le texte :', txt, { lw: 140 }), h('div.muted', { style: { margin: '6px 0' } }, 'Entrez les ID séparés par des virgules.'), h('div.mbbtns', UI.w.btn('OK', () => { filter = { levels: Array.from(want), ids: id.value.split(/[,;\s]+/).filter(Boolean), src: src.value.trim(), text: txt.value.trim() }; if (!filter.levels.length && !filter.ids.length && !filter.src && !filter.text) filter = null; w2.close(true); refresh(); }, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
    };
    const findDlg = () => { const t = UI.w.text('', { w: 260 }); let w2; w2 = desk.wm.open({ title: 'Rechercher', w: 380, h: 150, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', UI.w.field('Rechercher :', t, { lw: 90 }), h('div.mbbtns', UI.w.btn('Suivant', () => { filter = Object.assign(filter || { levels: [], ids: [], src: '' }, { text: t.value.trim() }); w2.close(true); refresh(); }, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) }); setTimeout(() => t.focus(), 30); };
    const clearLog = () => {
      if (!cur.chan || cur.chan === '*admin') return;
      desk.msg({ title: 'Observateur d’événements', icon: 'question', owner: win, text: 'Voulez-vous enregistrer le contenu du journal « ' + cur.label + ' » avant de l’effacer ?', buttons: [{ label: 'Enregistrer et effacer', fn: () => doClear() }, { label: 'Effacer', fn: () => doClear() }, { label: 'Annuler' }] });
      function doClear() { const d = self.target; if (d._rt.logs) d._rt.logs['evt:' + cur.chan] = []; desk.env.touch('evtclear'); desk.run.act(desk.devId, 'Effacement du journal « ' + cur.label + ' » sur ' + d.name, { kind: 'ui', mutates: true, dev: desk.devId, danger: 'logclear' }); refresh(); }
    };
    const props = () => { desk.msg({ title: 'Propriétés du journal — ' + cur.label, icon: 'info', owner: win, text: 'Nom complet : ' + cur.label + '\nNombre d’événements : ' + events().length }); };
    const actions = () => [{ title: cur.label, items: [{ label: 'Ouvrir un journal enregistré…', disabled: true }, { label: 'Créer une vue personnalisée…', disabled: true }, { label: 'Importer une vue personnalisée…', disabled: true }, '-', { label: 'Effacer le journal…', disabled: !cur.chan || cur.chan === '*admin', fn: clearLog }, { label: 'Filtrer le journal actuel…', disabled: !cur.chan, fn: filterDlg }, { label: 'Propriétés', disabled: !cur.chan, fn: props }, { label: 'Rechercher…', disabled: !cur.chan, fn: findDlg }, { label: 'Enregistrer tous les événements sous…', disabled: true }, '-', { label: 'Actualiser', fn: refresh }, { label: 'Aide', disabled: true }] }].concat(selected ? [{ title: 'Événement ' + selected.id + ', ' + selected.source, items: [{ label: 'Propriétés de l’événement', fn: () => detail(selected) }, { label: 'Copier', disabled: true }, { label: 'Actualiser', fn: refresh }] }] : []);
    lv = UI.w.listView({ columns: [{ key: 'level', label: 'Niveau', w: 130, icon: r => LVL_ICON[r.level] || 'info' }, { key: 't', label: 'Date et heure', w: 160, sort: 'num', fmt: r => fmtT(r.t) }, { key: 'source', label: 'Source', w: 220 }, { key: 'id', label: 'ID de l’événement', w: 120, sort: 'num' }, { key: 'cat', label: 'Catégorie de la tâche', w: 150, fmt: () => 'Aucun' }], rows: [], key: r => r.chan + '#' + r._i, sort: { key: 't', dir: -1 }, onSelect: r => { selected = r; detail(r); api.setActions(actions()); }, onOpen: r => detail(r), onRefresh: () => refresh(), onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Propriétés de l’événement', def: true, fn: () => detail(r) }, { label: 'Copier', disabled: true }, { label: 'Actualiser', fn: refresh }]) });
    det = { el: h('div.evdet') };
    const mid = h('div.evmid', h('div.evlist', lv.el), det.el);
    const menu = [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: () => [{ label: 'Se connecter à un autre ordinateur…', fn: () => UI.pickComputer(desk, win, v => { const t = UI.resolveHost(desk, v); if (t.err) { desk.msg({ title: 'Observateur d’événements', icon: 'error', owner: win, text: 'Impossible de se connecter à l’ordinateur « ' + v + ' ».\n' + UI.remoteMsg(t.err) }); return; } self.target = t.dev; api.tree.setRoots(roots()); cur = CHANS[3]; api.tree.select('Système', true); desk.act('Observateur d’événements : connexion à ' + t.dev.name, { kind: 'ui' }); }) }, '-', { label: 'Effacer le journal…', fn: clearLog }, { label: 'Filtrer le journal actuel…', fn: filterDlg }, { label: 'Actualiser', key: 'F5', fn: refresh }] }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos', disabled: true }] }];
    win = UI.w.mmc({ wm: desk.wm, title: 'Observateur d’événements', icon: 'list', w: 1000, h: 600, menu, roots: roots(), select: 'Système', onSelect: (n, a) => {
      api = a;
      if (n.chan === undefined && !n.defined) { cur = { key: n.key, label: n.label, chan: null }; filter = null; a.setMid(h('div.pad.muted', 'Sélectionnez un journal dans l’arborescence.')); a.setActions(actions()); a.status(''); return; }
      cur = { key: n.key, label: n.label, chan: n.chan }; filter = null; a.setMid(mid); refresh(); a.setActions(actions());
    }, onRefresh: refresh });
    api = win.mmc; win.appId = 'eventvwr'; desk.act('Ouverture de l’Observateur d’événements', { kind: 'ui' });
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
