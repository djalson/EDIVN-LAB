/* ============================================================================
   Explorateur de fichiers (disques locaux, dossiers utilisateur, chemins UNC avec contrôle des droits
   de partage + NTFS), Bloc-notes (dont le fichier hosts, avec droits), Date et heure,
   Panneau de configuration. Les erreurs d'accès reprennent les boîtes réelles de Windows.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, AD = SIM.ad, WIN = SIM.win, h = UI.h, W_ = E.win;
SIM.AVREG['explorer-ui'] = 'Explorateur : libellés des colonnes, de la barre d’outils, des volets de navigation et messages d’erreur d’accès (« n’est pas accessible », 0x80070035, 0x80070043, « Accès au dossier refusé ») reconstitués de mémoire en français ; à vérifier par capture.';
SIM.AVREG['notepad-ui'] = 'Bloc-notes : menus, boîte « Ouvrir » simplifiée, message d’échec d’enregistrement dans un dossier protégé reconstitués ; à vérifier par capture.';
SIM.AVREG['datetime-ui'] = 'Date et heure : fenêtre simplifiée (heure automatique, modification manuelle, synchronisation) ; libellés à vérifier.';
const lc = s => String(s).toLowerCase();
const pad = U.pad2;
const fmtDT = d => pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
const fmtSize = n => { if (n < 1024) return n + ' octets'; const k = Math.ceil(n / 1024); return k.toLocaleString('fr-FR') + ' Ko'; };
const TYPES = { txt: 'Document texte', log: 'Document texte', ini: 'Paramètres de configuration', cfg: 'Fichier CFG', conf: 'Fichier CONF', xml: 'Fichier XML', csv: 'Fichier CSV', pdf: 'Fichier PDF', docx: 'Fichier DOCX', xlsx: 'Fichier XLSX', jpg: 'Fichier JPG', png: 'Fichier PNG', zip: 'Dossier compressé', exe: 'Application', dll: 'Extension de l’application', html: 'Fichier HTML', htm: 'Fichier HTM', bat: 'Fichier de commandes Windows', ps1: 'Fichier PS1' };
const typeOf = n => { const m = n.match(/\.([A-Za-z0-9]+)$/); if (!m) return 'Fichier'; return TYPES[lc(m[1])] || ('Fichier ' + m[1].toUpperCase()); };

/* ------------------------------------------------------------------ accès aux emplacements (local ou UNC) */
/* retourne { dev, path, unc, node } ou { err:{kind,title,text,code}, } */
function locate(desk, input) {
  const W = desk.W, d = desk.d; let raw = String(input || '').trim().replace(/\//g, '\\'); if (!raw) return { err: { kind: 'bad' } };
  if (/^\\\\/.test(raw)) {
    const m = raw.match(/^\\\\([^\\]+)(?:\\([^\\]+)(?:\\(.*))?)?$/);
    if (!m) return { err: { kind: 'name', title: raw, code: '0x80070035' } };
    if (!m[2]) {
      const rs = U.isIP(m[1]) ? { ok: true, ip: m[1] } : N.resolve(W, d.id, m[1]); if (!rs.ok) return { err: { kind: 'name', title: raw, code: '0x80070035' } };
      const c = N.connect(W, d.id, rs.ip, 'tcp', 445); if (c.state !== 'open') return { err: { kind: 'name', title: raw, code: '0x80070035' } };
      const srv = W.d(c.dstDev); if (!d._rt.session) return { err: { kind: 'cred', title: raw } };
      return { dev: srv, unc: '\\\\' + m[1], root: true, shares: (srv.win.shares || []).filter(s => !/\$$/.test(s.name)) };
    }
    const unc = raw.replace(/\\+$/, ''); const r = AD.shareAccess(W, d.id, unc, 'read');
    if (!r.ok) {
      if (r.code === 'badnetpath') return { err: { kind: 'name', title: unc, code: '0x80070035' } };
      if (r.code === 'badnetname') return { err: { kind: 'name', title: unc, code: '0x80070043' } };
      if (r.code === 'nosession') return { err: { kind: 'cred', title: unc } };
      if (r.code === 'trust') return { err: { kind: 'denied', title: unc } };
      return { err: { kind: 'denied', title: unc, layer: r.layer } };
    }
    const srv = W.d(r.server); const sh = (srv.win.shares || []).find(s => lc(s.name) === lc(m[2])); const sp = sh.path.replace(/\\$/, '') + (m[3] ? '\\' + m[3] : '');
    const node = W_.dirNode(W, srv, sp); if (!node) return { err: { kind: 'name', title: unc, code: '0x80070043' } };
    return { dev: srv, path: sp, unc, node };
  }
  if (!/^[A-Za-z]:/.test(raw)) return { err: { kind: 'name', title: raw, code: '0x80070002' } };
  let p = W_.normPath('C:\\', raw); const node = W_.dirNode(W, d, p);
  if (!node) return { err: { kind: 'path', title: raw } };
  if (!(W_.localRights(W, d, node.name) & 1)) return { err: { kind: 'localdenied', title: raw, path: node.name } };
  return { dev: d, path: node.name, node, local: true };
}
const ERRTXT = (e) => {
  if (e.kind === 'denied') return { title: 'Accès réseau', text: e.title + ' n’est pas accessible. Vous n’avez peut-être pas l’autorisation d’utiliser cette ressource réseau. Contactez l’administrateur de ce serveur pour savoir si vous avez des autorisations d’accès.\n\nAccès refusé.' };
  if (e.kind === 'cred') return { title: 'Erreur de connexion réseau', text: 'Impossible de se connecter à ' + e.title + '. Le nom d’utilisateur ou le mot de passe est incorrect.' };
  if (e.kind === 'name') return { title: 'Accès réseau', text: 'Windows ne peut pas accéder à ' + e.title + '\nVérifiez l’orthographe du nom. Sinon, il se peut qu’il y ait un problème de réseau. Pour essayer d’identifier et de résoudre les problèmes de réseau, cliquez sur Diagnostiquer.\n\nCode d’erreur : ' + e.code + '\n' + (e.code === '0x80070043' ? 'Le nom réseau est introuvable.' : e.code === '0x80070002' ? 'Le fichier spécifié est introuvable.' : 'Le chemin réseau est introuvable.') };
  if (e.kind === 'path') return { title: 'Explorateur de fichiers', text: 'Windows ne trouve pas « ' + e.title + ' ». Vérifiez l’orthographe et réessayez.' };
  return { title: 'Explorateur de fichiers', text: 'Chemin non valide.' };
};

/* chemin affiché (local ou UNC) → { dev, path, share? } côté serveur, ou null */
UI.resolvePath = function (desk, p) {
  const W = desk.W, d = desk.d;
  if (p.indexOf('\\\\') === 0) {
    const m = p.match(/^\\\\([^\\]+)\\([^\\]+)(?:\\(.*))?$/); if (!m) return null;
    const rs = U.isIP(m[1]) ? { ok: true, ip: m[1] } : N.resolve(W, d.id, m[1]); if (!rs.ok) return null;
    const c = N.connect(W, d.id, rs.ip, 'tcp', 445); if (c.state !== 'open') return null;
    const srv = W.d(c.dstDev); const sh = (srv.win.shares || []).find(s => lc(s.name) === lc(m[2])); if (!sh) return null;
    return { dev: srv, path: sh.path.replace(/\\$/, '') + (m[3] ? '\\' + m[3] : ''), share: sh, unc: p };
  }
  return { dev: d, path: p };
};

/* ------------------------------------------------------------------ Explorateur */
UI.app('explorer', {
  title: 'Explorateur de fichiers', icon: 'folder',
  open: (desk, arg) => {
    const W = desk.W, d = desk.d; let win, lv, addr, status, tree; let hist = [], hi = -1; let loc = null; let selected = null;
    const user = () => desk.user() || 'Public';
    const home = 'C:\\Users\\' + user();
    const nodes = () => {
      const kids = (p) => W_.userDirs.map(n => ({ key: p + '\\' + n, label: n, icon: 'folder', path: p + '\\' + n }));
      const maps = W_.driveMaps ? W_.driveMaps(d) : [];
      return [
        { key: 'quick', label: 'Accès rapide', icon: 'home', expanded: true, children: ['Bureau', 'Téléchargements', 'Documents', 'Images'].map(n => ({ key: 'q:' + n, label: n, icon: 'folder', path: home + '\\' + n })) },
        { key: 'thispc', label: 'Ce PC', icon: 'monitor', expanded: true, path: 'thispc', children: kids(home).map(k => Object.assign(k, { key: 'pc:' + k.key })).concat([{ key: 'C:', label: 'Disque local (C:)', icon: 'folder', path: 'C:\\' }]).concat((d.win.ntfs && Object.keys(d.win.ntfs).some(k => /^D:/i.test(k))) ? [{ key: 'D:', label: 'Données (D:)', icon: 'folder', path: 'D:\\' }] : []) },
        { key: 'net', label: 'Réseau', icon: 'network', path: 'network' }
      ].concat(maps.length ? [] : []);
    };
    const showErr = (e) => { const t = ERRTXT(e.err || e); desk.msg({ title: t.title, icon: 'error', owner: win, text: t.text }); };
    const rowsFor = (L) => {
      if (!L) return [];
      if (L.special === 'thispc') {
        const out = W_.userDirs.map(n => ({ name: n, kind: 'dir', path: home + '\\' + n, type: 'Dossier système', size: '' }));
        out.push({ name: 'Disque local (C:)', kind: 'dir', path: 'C:\\', type: 'Disque local', size: '' });
        if (d.win.ntfs && Object.keys(d.win.ntfs).some(k => /^D:/i.test(k))) out.push({ name: 'Données (D:)', kind: 'dir', path: 'D:\\', type: 'Disque local', size: '' });
        const maps = W_.driveMaps ? W_.driveMaps(d) : []; maps.forEach(m => out.push({ name: m.letter + ' → ' + m.unc, kind: 'dir', path: m.unc, type: 'Lecteur réseau', size: '' }));
        return out;
      }
      if (L.special === 'network') return [];
      if (L.root) return L.shares.map(s => ({ name: s.name, kind: 'dir', path: L.unc + '\\' + s.name, type: 'Dossier partagé', size: '' }));
      const node = L.node; const dt = W.nowOf(d.id); const dirs = [...node.dirs].sort((a, b) => a.localeCompare(b, 'fr')).map(n => ({ name: n, kind: 'dir', path: (L.unc ? L.unc + L.path.slice(L.shareBase.length) : node.name.replace(/\\$/, '')) + '\\' + n, type: 'Dossier de fichiers', date: new Date(dt.getTime() - 86400000 * (7 + U.hash8(n).charCodeAt(0) % 90)), size: '' }));
      const files = [...node.files.keys()].sort((a, b) => a.localeCompare(b, 'fr')).map(n => { const f = node.files.get(n); return { name: n, kind: 'file', type: typeOf(n), date: f.date, size: fmtSize(f.size), bytes: f.size, path: (L.unc ? L.unc + L.path.slice(L.shareBase.length) : node.name.replace(/\\$/, '')) + '\\' + n }; });
      return dirs.concat(files);
    };
    const go = (input, push) => {
      let L;
      if (input === 'thispc' || input === 'network' || input === 'recycle') L = { special: input === 'recycle' ? 'thispc' : input, title: input === 'network' ? 'Réseau' : input === 'recycle' ? 'Corbeille' : 'Ce PC', text: input === 'network' ? 'Réseau' : input === 'recycle' ? 'Corbeille' : 'Ce PC' };
      else {
        const r = locate(desk, input); if (r.err) { if (r.err.kind === 'localdenied') return localDenied(r.err); showErr(r); return false; }
        L = r; if (L.unc && !L.root) { const m = String(input).replace(/\//g, '\\').match(/^(\\\\[^\\]+\\[^\\]+)/); const sh = (L.dev.win.shares || []).find(s => lc(s.name) === lc(m[1].split('\\')[3])); L.shareBase = sh.path.replace(/\\$/, ''); }
        L.text = L.root ? L.unc : (L.unc ? L.unc + L.path.slice(L.shareBase.length) : L.path); L.title = L.root ? L.unc.slice(2) : (L.path.replace(/\\$/, '').split('\\').pop() || L.path);
        if (L.root) { desk.env.obs('share:' + d.id + ':' + L.unc, true); } else if (L.unc) desk.env.obs('share:' + d.id + ':' + L.unc.replace(/\\[^\\]*$/, '').split('\\').slice(0, 4).join('\\'), true);
      }
      loc = L; if (push !== false) { hist = hist.slice(0, hi + 1); hist.push(input); hi = hist.length - 1; }
      addr.value = L.text || ''; win.setTitle(L.title); draw(); desk.run.act(desk.devId, 'Explorateur : ouverture de ' + (L.text || L.title), { kind: 'ui' }); return true;
    };
    const localDenied = (e) => {
      desk.msg({ title: 'Accès au dossier refusé', icon: 'warning', owner: win, text: 'Vous n’avez pas actuellement l’autorisation d’accéder à ce dossier.\nCliquez sur Continuer pour obtenir définitivement l’accès à ce dossier.', buttons: [{ label: 'Continuer', default: true, fn: () => desk.uac('Explorateur de fichiers', el => { if (!el) return; const F = AD.ntfsFolder(d, e.path); if (F && d.win.ntfs[F]) { d.win.ntfs[F].acl.push({ who: W_.whoami(W, d, el.as || desk.user()).replace(/^[^\\]+/, m => m), type: 'allow', rights: 'FullControl', applies: 'this+sub' }); desk.env.touch('ntfs'); desk.change('Explorateur : accès permanent accordé à ' + (el.as || desk.user()) + ' sur ' + F, { dev: desk.devId }); } go(e.path); }) }, { label: 'Annuler' }] });
      return false;
    };
    const draw = () => {
      const L = loc; UI.clear(contentHost);
      if (L.special === 'network') { contentHost.append(h('div.lvempty', 'Aucun ordinateur n’est affiché : la découverte du réseau n’est pas simulée. Tapez un chemin UNC (\\\\SERVEUR\\partage) dans la barre d’adresse.')); status.textContent = '0 élément'; return; }
      if (L.special === 'thispc') { /* liste ci-dessous */ }
      const rows = rowsFor(L); lv.setRows(rows); contentHost.append(lv.el); status.textContent = rows.length + ' élément' + (rows.length > 1 ? 's' : ''); selected = null;
      backBtn.disabled = hi <= 0; fwdBtn.disabled = hi >= hist.length - 1; upBtn.disabled = !(L.node || L.root);
    };
    const open = (r) => {
      if (r.kind === 'dir') { go(r.path); return; }
      /* fichier texte sans extension dont la simulation connaît le contenu (hosts) : ouvert dans le Bloc-notes */
      if (!/\.[^\\.]+$/.test(r.name) && fileText(r) !== null) { desk.open('notepad', { path: r.path, name: r.name, text: fileText(r), dev: loc.dev }); return; }
      if (/\.(txt|log|ini|cfg|conf|csv|xml|bat|ps1|html?)$/i.test(r.name)) { const content = fileText(r); if (content === null) { desk.msg({ title: 'Bloc-notes', icon: 'info', owner: win, text: 'Le contenu de ce fichier n’est pas disponible dans la simulation.' }); return; } desk.open('notepad', { path: r.path, name: r.name, text: content, dev: loc.dev }); return; }
      desk.msg({ title: 'Explorateur de fichiers', icon: 'info', owner: win, text: 'Le contenu de ce fichier n’est pas disponible dans la simulation.' });
    };
    const fileText = (r) => { const dv = loc.dev; const fp = r.path; if (lc(fp) === lc(W_.HOSTS_PATH) && dv.id === d.id) return W_.hostsText(d); const uf = dv._rt.userFiles && dv._rt.userFiles[fp]; return uf === undefined ? null : uf; };
    const props = (r) => {
      if (r.kind === 'dir' && UI.resolvePath(desk, r.path)) UI.folderProps(desk, win, { display: r.name, path: r.path });
      else desk.msg({ title: 'Propriétés de ' + r.name, icon: 'info', owner: win, text: 'Nom : ' + r.name + '\nType : ' + r.type + (r.size ? '\nTaille : ' + r.size : '') + (r.date ? '\nModifié le : ' + fmtDT(r.date) : '') });
    };
    const ctx = (r, e) => {
      /* « Ouvrir avec » : un fichier texte (hosts, .txt, .ini…) s'ouvre dans le Bloc-notes, comme sous Windows. Il n'y a pas d'« Exécuter en tant qu'administrateur » sur un fichier texte : pour modifier un fichier protégé, on lance le Bloc-notes en administrateur (menu Démarrer, clic droit) puis Fichier → Ouvrir. */
      const txt = r.kind !== 'dir' && fileText(r) !== null;
      UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Ouvrir', def: true, fn: () => open(r) }, txt ? { label: 'Ouvrir avec', items: [{ label: 'Bloc-notes', fn: () => desk.open('notepad', { path: r.path, name: r.name, text: fileText(r), dev: loc.dev }) }] } : null, { label: 'Ouvrir dans une nouvelle fenêtre', disabled: r.kind !== 'dir', fn: () => desk.open('explorer', r.path, { fresh: true }) }, '-', { label: 'Copier', disabled: true }, { label: 'Couper', disabled: true }, '-', { label: 'Supprimer', disabled: true }, { label: 'Renommer', disabled: true }, '-', { label: 'Propriétés', fn: () => props(r) }], desk.el);
    };
    const ctxEmpty = (e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Actualiser', fn: () => go(addr.value, false) }, '-', { label: 'Nouveau', items: [{ label: 'Dossier', fn: newFolder }] }, '-', { label: 'Propriétés', disabled: !(loc && (loc.node || loc.root)), fn: () => { if (loc.node) props({ kind: 'dir', name: loc.title, path: loc.unc ? loc.unc + loc.path.slice(loc.shareBase.length) : loc.path, type: 'Dossier de fichiers' }); } }], desk.el);
    const newFolder = () => {
      if (!loc || !loc.node) return;
      const target = loc.dev; const base = loc.path.replace(/\\$/, '');
      const rights = loc.unc ? AD.shareAccess(W, d.id, loc.unc, 'write') : { ok: !!(W_.localRights(W, d, base) & 2) };
      if (!rights.ok) { desk.msg({ title: 'Destination du dossier inaccessible', icon: 'warning', owner: win, text: 'Vous avez besoin d’une autorisation pour effectuer cette action.\nVous avez besoin de l’autorisation d’effectuer cette opération.\nEssayez à nouveau en demandant à votre administrateur.' }); return; }
      let n = 'Nouveau dossier', k = 1; while (loc.node.dirs.has(n)) n = 'Nouveau dossier (' + (++k) + ')';
      const np = base + '\\' + n; target._rt.userFiles = target._rt.userFiles || {}; target._rt.userFiles[np + '\\.keep'] = ''; target._rt.userFilesVer = (target._rt.userFilesVer || 0) + 1; target._rt.userDirs = (target._rt.userDirs || []).concat([np]);
      desk.change('Explorateur : création du dossier ' + np + ' sur ' + target.name, { dev: desk.devId }); go(addr.value, false);
    };
    lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 260, icon: r => (r.kind === 'dir' ? 'folder' : 'file') }, { key: 'date', label: 'Modifié le', w: 140, sort: 'num', sortVal: r => (r.date ? r.date.getTime() : 0), fmt: r => (r.date ? fmtDT(r.date) : '') }, { key: 'type', label: 'Type', w: 170 }, { key: 'bytes', label: 'Taille', w: 100, align: 'right', sort: 'num', fmt: r => r.size || '' }], rows: [], key: r => r.path || r.name, sort: { key: 'name' }, onOpen: open, onContext: ctx, onContextEmpty: ctxEmpty, onSelect: r => { selected = r; status.textContent = r ? '1 élément sélectionné' : ''; }, onRefresh: () => go(addr.value, false) });
    const contentHost = h('div.expmain-in', { style: { flex: 1, display: 'flex', minHeight: 0 } });
    const backBtn = h('button.nav', { title: 'Précédent', on: { click: () => { if (hi > 0) { hi--; go(hist[hi], false); } } } }, '←'), fwdBtn = h('button.nav', { title: 'Suivant', on: { click: () => { if (hi < hist.length - 1) { hi++; go(hist[hi], false); } } } }, '→'), upBtn = h('button.nav', { title: 'Dossier parent', on: { click: () => { if (!loc || !(loc.node || loc.root)) return; const cur = addr.value.replace(/\\$/, ''); const up = cur.indexOf('\\') >= 0 ? cur.slice(0, cur.lastIndexOf('\\')) : ''; if (/^[A-Za-z]:$/.test(up)) go(up + '\\'); else if (/^\\\\[^\\]+$/.test(up) || !up) go('thispc'); else go(up); } } }, '↑');
    addr = h('input', { spellcheck: false, on: { keydown: e => { if (e.key === 'Enter') go(addr.value); } } });
    status = h('div.expstat');
    tree = UI.w.tree({ roots: nodes(), onSelect: n => { if (n.path) go(n.path); } });
    const nav = h('div.expnav', tree.el);
    const toolbar = h('div.expbar', h('button.tbb', { on: { click: newFolder } }, 'Nouveau dossier'), h('button.tbb', { on: { click: () => selected && props(selected) }, disabled: false }, 'Propriétés'));
    win = desk.wm.open({ title: 'Explorateur de fichiers', icon: 'folder', w: 900, h: 520, minW: 480, body: () => h('div.explorer', h('div.addr', backBtn, fwdBtn, upBtn, addr), toolbar, h('div.expbody', nav, h('div.expmain', contentHost, status))) });
    win.appId = 'explorer'; win.goto = go;
    go(arg && typeof arg === 'string' ? (arg === 'thispc' || arg === 'recycle' ? arg : arg) : 'thispc');
    return win;
  }
});

/* ------------------------------------------------------------------ Bloc-notes */
UI.app('notepad', {
  title: 'Bloc-notes', icon: 'file',
  open: (desk, arg, o) => {
    const W = desk.W, d = desk.d; arg = (arg && typeof arg === 'object') ? arg : (typeof arg === 'string' && arg ? { path: arg } : {});
    let win, ta; let file = arg.path ? { path: arg.path, name: arg.name || arg.path.split('\\').pop(), dev: arg.dev || d } : null; let dirty = false;
    const elevated = !!(o && o.elevated);
    ta = h('textarea', { spellcheck: false, wrap: 'off', on: { input: () => { dirty = true; setT(); } } });
    /* fichier donné sans son contenu (« notepad <chemin> » en ligne de commande) : on le lit comme la boîte « Ouvrir » */
    if (file && arg.text === undefined) { const fd = file.dev; if (lc(file.path) === lc(W_.HOSTS_PATH) && fd.id === d.id) arg.text = W_.hostsText(d); else if (fd._rt.userFiles && fd._rt.userFiles[file.path] !== undefined) arg.text = fd._rt.userFiles[file.path]; }
    if (arg.text !== undefined) ta.value = String(arg.text).replace(/\r\n/g, '\n');
    const setT = () => win && win.setTitle((dirty ? '*' : '') + (file ? file.name : 'Sans titre') + ' - Bloc-notes');
    const canWrite = (p) => {
      if (lc(p) === lc(W_.HOSTS_PATH)) return elevated;
      return !!(W_.localRights(W, d, p.slice(0, p.lastIndexOf('\\')) || p) & 2) || elevated;
    };
    const save = () => {
      if (!file) { saveAs(); return; }
      if (lc(file.path) === lc(W_.HOSTS_PATH)) {
        if (!canWrite(file.path)) { desk.msg({ title: 'Bloc-notes', icon: 'warning', owner: win, text: 'Vous n’avez pas l’autorisation d’enregistrer dans ce dossier.\nContactez l’administrateur pour obtenir l’autorisation.\n\nEnregistrez le fichier dans un autre emplacement.' }); return; }
        W_.setHostsText(W, d, ta.value); desk.env.advance(1); desk.change('Bloc-notes : enregistrement du fichier hosts', { dev: desk.devId }); dirty = false; setT(); return;
      }
      const dv = file.dev; dv._rt.userFiles = dv._rt.userFiles || {}; dv._rt.userFiles[file.path] = ta.value; dv._rt.userFilesVer = (dv._rt.userFilesVer || 0) + 1; dirty = false; setT(); desk.change('Bloc-notes : enregistrement de ' + file.path, { dev: desk.devId });
    };
    const saveAs = () => {
      const t = UI.w.text(file ? file.path : 'C:\\Users\\' + desk.user() + '\\Documents\\Sans titre.txt', { w: 340 }); let w2;
      w2 = desk.wm.open({ title: 'Enregistrer sous', w: 480, h: 160, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', UI.w.field('Nom du fichier :', t, { lw: 110 }), h('div.mbbtns', UI.w.btn('Enregistrer', () => { const p = W_.normPath('C:\\', t.value.trim()); w2.close(true); file = { path: p, name: p.split('\\').pop(), dev: d }; save(); }, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
    };
    const openDlg = () => {
      const t = UI.w.text(W_.HOSTS_PATH.replace(/[^\\]+$/, ''), { w: 340 }); const nm = UI.w.text('', { w: 340 }); let w2;
      const doOpen = () => {
        const p = nm.value.trim() ? W_.normPath(t.value.trim() || 'C:\\', nm.value.trim()) : null; if (!p) return;
        const node = W_.dirNode(W, d, p.slice(0, p.lastIndexOf('\\')) || p); const fn = p.split('\\').pop();
        let text = null; if (lc(p) === lc(W_.HOSTS_PATH)) text = W_.hostsText(d); else if (d._rt.userFiles && d._rt.userFiles[p] !== undefined) text = d._rt.userFiles[p];
        if (text === null) { desk.msg({ title: 'Bloc-notes', icon: 'warning', owner: w2, text: (node && node.files.has(fn)) ? 'Le contenu de ce fichier n’est pas disponible dans la simulation.' : 'Le fichier ' + p + '\nest introuvable.\nVérifiez le nom du fichier et réessayez.' }); return; }
        w2.close(true); ta.value = text.replace(/\r\n/g, '\n'); file = { path: p, name: fn, dev: d }; dirty = false; setT();
      };
      w2 = desk.wm.open({ title: 'Ouvrir', w: 500, h: 200, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', UI.w.field('Regarder dans :', t, { lw: 110 }), UI.w.field('Nom du fichier :', nm, { lw: 110 }), h('div.muted', { style: { margin: '6px 0' } }, 'Tapez le chemin du dossier et le nom du fichier.'), h('div.mbbtns', UI.w.btn('Ouvrir', doOpen, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
    };
    const menu = [{ label: 'Fichier', items: [{ label: 'Nouveau', key: 'Ctrl+N', fn: () => { ta.value = ''; file = null; dirty = false; setT(); } }, { label: 'Ouvrir…', key: 'Ctrl+O', fn: openDlg }, { label: 'Enregistrer', key: 'Ctrl+S', fn: save }, { label: 'Enregistrer sous…', fn: saveAs }, '-', { label: 'Quitter', fn: () => win.close() }] }, { label: 'Edition', items: [{ label: 'Sélectionner tout', key: 'Ctrl+A', fn: () => { ta.focus(); ta.select(); } }] }, { label: 'Format', items: [{ label: 'Retour automatique à la ligne', checked: false }] }, { label: 'Affichage', items: [{ label: 'Barre d’état', checked: true }] }, { label: '?', items: [{ label: 'À propos du Bloc-notes', disabled: true }] }];
    win = desk.wm.open({ title: 'Sans titre - Bloc-notes', icon: 'file', w: 720, h: 460, menu, className: 'notepad', body: () => ta, onClose: () => { if (dirty) { desk.msg({ title: 'Bloc-notes', icon: 'question', owner: win, text: 'Voulez-vous enregistrer les modifications apportées à ' + (file ? file.path : 'Sans titre') + ' ?', buttons: [{ label: 'Enregistrer', default: true, fn: () => { save(); if (!dirty) win.close(true); } }, { label: 'Ne pas enregistrer', fn: () => win.close(true) }, { label: 'Annuler' }] }); return false; } } });
    ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
    win.appId = 'notepad'; setT(); setTimeout(() => ta.focus(), 30); desk.run.act(desk.devId, 'Ouverture du Bloc-notes' + (elevated ? ' (administrateur)' : '') + (file ? ' : ' + file.path : ''), { kind: 'ui' });
    return win;
  }
});

/* ------------------------------------------------------------------ Date et heure */
UI.app('datetime', {
  title: 'Date et heure', icon: 'clock', single: true,
  open: (desk) => {
    const W = desk.W, d = desk.d; let win; const dtEl = h('div', { style: { fontSize: '30px', fontWeight: 300 } }); const dateEl = h('div', { style: { fontSize: '14px', marginBottom: '12px' } });
    const paint = () => { const t = W.nowOf(d.id); dtEl.textContent = pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':' + pad(t.getUTCSeconds()); dateEl.textContent = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][t.getUTCDay()] + ' ' + t.getUTCDate() + ' ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][t.getUTCMonth()] + ' ' + t.getUTCFullYear(); };
    paint(); const iv = setInterval(paint, 1000);
    const manual = () => {
      desk.uac('Date et heure', el => {
        if (!el) return; const t = W.nowOf(d.id); const di = h('input.w10in', { type: 'date', value: t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()) }); const ti = h('input.w10in', { type: 'time', value: pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) }); let w2;
        w2 = desk.wm.open({ title: 'Modifier la date et l’heure', w: 360, h: 200, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', UI.w.field('Date :', di, { lw: 80 }), UI.w.field('Heure :', ti, { lw: 80 }), h('div.mbbtns', UI.w.btn('Modifier', () => {
          const ms = Date.parse(di.value + 'T' + ti.value + ':00Z'); if (isNaN(ms)) { w2.close(true); return; }
          const real = W.clock.base + W.clock.elapsed * 1000; d.clockSkewMin = Math.round((ms - real) / 60000); desk.env.touch('time'); desk.change('Modification manuelle de la date et de l’heure de ' + d.name + ' (décalage ' + d.clockSkewMin + ' min)', { dev: desk.devId }); w2.close(true); paint(); desk.drawClock();
        }, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
      });
    };
    const sync = () => {
      desk.uac('Date et heure', el => {
        if (!el) return;
        if (!WIN.svcRunning(d, 'W32Time')) { desk.msg({ title: 'Paramètres de l’heure Internet', icon: 'error', owner: win, text: 'Une erreur s’est produite lors de la synchronisation de l’heure.\nLe service de temps Windows n’est pas démarré.' }); return; }
        const rs = W_.timeResync(W, d); if (!rs.ok) { desk.msg({ title: 'Paramètres de l’heure Internet', icon: 'error', owner: win, text: 'Une erreur s’est produite lors de la synchronisation de l’heure.\nAucune source de temps n’a pu être contactée.' }); return; }
        desk.env.advance(2); desk.env.touch('time'); desk.change('Synchronisation de l’heure de ' + d.name, { dev: desk.devId }); paint(); desk.drawClock(); desk.msg({ title: 'Paramètres de l’heure Internet', icon: 'info', owner: win, text: 'L’horloge a été synchronisée.' });
      });
    };
    win = desk.wm.open({ title: 'Date et heure', icon: 'clock', w: 400, h: 330, resizable: false, maximizable: false, body: () => h('div.pad', dtEl, dateEl, UI.w.group('Fuseau horaire', h('div', 'UTC (temps universel coordonné)'), h('div.muted', 'Le simulateur raisonne en UTC : le fuseau n’est pas modifiable.')), h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px' } }, UI.w.btn('Modifier la date et l’heure…', manual), UI.w.btn('Synchroniser maintenant', sync))), onClose: () => { clearInterval(iv); } });
    win.appId = 'datetime'; return win;
  }
});

/* ------------------------------------------------------------------ Panneau de configuration */
UI.app('control', {
  title: 'Panneau de configuration', icon: 'gear', single: true,
  open: (desk) => {
    /* affichage par catégories (comme Windows) : « Options Internet » n'est visible qu'après un clic sur le titre « Réseau et Internet » */
    const cats = [['Réseau et Internet', 'network', () => show('net')], ['Pare-feu Windows Defender', 'shield', () => desk.open('wf')], ['Date et heure', 'clock', () => desk.open('datetime')], ['Outils d’administration', 'wrench', () => desk.open('compmgmt')], ['Comptes d’utilisateurs', 'user', () => desk.open('lusrmgr')], ['Système', 'monitor', () => desk.open('msinfo')]];
    const net = [['Centre Réseau et partage', 'network', () => desk.open('ncpa')], ['Options Internet', 'globe', () => desk.open('inetcpl')]];
    const crumbs = h('span.crumbs', 'Panneau de configuration'); const host = h('div.pad', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', alignContent: 'start' } });
    const tile = it => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', cursor: 'default', padding: '8px', border: '1px solid transparent' }, on: { dblclick: it[2], click: it[2] } }, UI.icon(it[1], 32), h('div', it[0]));
    const show = (which) => {
      UI.clear(host); UI.clear(crumbs);
      if (which === 'net') { crumbs.append('Panneau de configuration \u203a Réseau et Internet'); net.forEach(it => host.append(tile(it))); }
      else { crumbs.append('Panneau de configuration'); cats.forEach(it => host.append(tile(it))); }
    };
    const win = desk.wm.open({ title: 'Panneau de configuration', icon: 'gear', w: 640, h: 380, body: () => h('div.explorer', h('div.addr', h('button.tb', { title: 'Précédent', on: { click: () => show('root') } }, '◀'), crumbs), host) });
    show('root'); win.appId = 'control'; return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
