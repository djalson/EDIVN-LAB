/* ============================================================================
   Propriétés d'un dossier : onglets Général, Partage (partage avancé + autorisations de partage) et
   Sécurité (ACL NTFS, paramètres avancés, héritage, accès effectif). Lit et écrit les mêmes données que
   icacls / net share / Get-Acl : srv.win.shares[].perms et srv.win.ntfs[dossier].acl.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, AD = SIM.ad, h = UI.h, W_ = E.win;
SIM.AVREG['fsprops-ui'] = 'Propriétés de dossier (Partage / Sécurité / Paramètres de sécurité avancés / Accès effectif) : libellés français, noms des autorisations et textes des boîtes reconstitués de mémoire ; la liste détaillée des autorisations de l’onglet « Accès effectif » est une transcription de mémoire à vérifier.';
SIM.AVREG['sec-principals-prefix'] = 'Boîte « Sélectionner des utilisateurs… » : saisie d’un principal intégré avec son préfixe (BUILTIN\\…, NT AUTHORITY\\…) acceptée ; comportement exact de la vraie boîte (noms localisés, résolution) à vérifier par capture.';
const lc = s => String(s).toLowerCase();

const PERMS = [['FullControl', 'Contrôle total', 31], ['Modify', 'Modification', 15], ['ReadAndExecute', 'Lecture et exécution', 5], ['ListDirectory', 'Affichage du contenu du dossier', 1], ['Read', 'Lecture', 1], ['Write', 'Écriture', 2]];
const SHARE_PERMS = [['FullControl', 'Contrôle total', 31], ['Modify', 'Modifier', 15], ['Read', 'Lecture', 1]];
const APPLIES = { 'this+sub': 'Ce dossier, les sous-dossiers et les fichiers', 'this': 'Ce dossier uniquement', 'sub': 'Les sous-dossiers et les fichiers uniquement' };
const GRANULAR = [['Parcours du dossier/exécuter le fichier', 4], ['Liste du dossier/lecture de données', 1], ['Lecture des attributs', 1], ['Lecture des attributs étendus', 1], ['Création de fichier/écriture de données', 2], ['Création de dossier/ajout de données', 2], ['Écriture d’attributs', 2], ['Écriture d’attributs étendus', 2], ['Suppression de sous-dossier et fichier', 16], ['Suppression', 8], ['Autorisations de lecture', 1], ['Modifier les autorisations', 16], ['Appropriation', 16]];

const rightName = (r) => { const b = AD.rightBits(r); const exact = PERMS.find(p => p[2] === b && (typeof r === 'number' || p[0] === r)) || PERMS.find(p => p[2] === b); return exact ? exact[1] : 'Spéciales'; };
const whoLabel = (W, srv, who) => {
  const m = String(who).split('\\'); if (m.length === 1) return who;
  if (lc(m[0]) === 'builtin') return m[1] + ' (' + srv.name.toUpperCase() + '\\' + m[1] + ')';
  if (lc(m[0]) === 'nt authority') return lc(m[1]) === 'système' ? 'SYSTEM' : m[1];
  return m[1] + ' (' + who + ')';
};
UI.whoLabel = whoLabel;

/* résolution d'un nom saisi vers l'identifiant utilisé dans les ACL */
UI.resolvePrincipal = function (W, srv, name) {
  name = String(name || '').trim(); if (!name) return null;
  const fixed = { 'tout le monde': 'Tout le monde', everyone: 'Tout le monde', 'utilisateurs authentifiés': 'Utilisateurs authentifiés', 'système': 'NT AUTHORITY\\Système', 'system': 'NT AUTHORITY\\Système', 'administrateurs': 'BUILTIN\\Administrateurs', 'utilisateurs': 'BUILTIN\\Utilisateurs', 'iis_iusrs': 'BUILTIN\\IIS_IUSRS' };
  if (fixed[lc(name)]) return fixed[lc(name)];
  const m = name.match(/^([^\\]+)\\(.+)$/);
  if (m && /^(builtin|nt authority)$/i.test(m[1]) && fixed[lc(m[2])]) return fixed[lc(m[2])];   /* « BUILTIN\\Administrateurs », « NT AUTHORITY\\Système » saisis avec leur préfixe */ const sam = m ? m[2] : name;
  const doms = AD.domains(W);
  for (const dv of doms) { const A = dv.win.ad; if (m && lc(m[1]) !== lc(A.netbios)) continue; const gp = A.groups.find(x => lc(x.name) === lc(sam)); if (gp && !gp.builtin) return A.netbios + '\\' + gp.name; const u = AD.userOf(A, sam); if (u) return A.netbios + '\\' + u.sam; }
  const lu = (srv.win.localUsers || []).find(x => lc(x.name) === lc(sam)); if (lu) return srv.name.toUpperCase() + '\\' + lu.name;
  return null;
};

/* éditeur de liste d'autorisations (NTFS ou partage) : un principal = une ligne, deux colonnes Autoriser / Refuser.
   o : { title, srv, kinds:[[nom,libellé,bits]], rightsKey, defaultRight, canEdit, applies, getAces(), setAces(aces) } */
function aclDialog(desk, owner, o) {
  const srv = o.srv, W = desk.W; let sel = 0; let win; let dirty = false;
  const nameOf = (bits) => { const k = o.kinds.find(x => x[2] === bits); return k ? k[0] : bits; };
  /* regroupement des ACE par principal */
  const groups = []; o.getAces().forEach(a => { let gp = groups.find(x => lc(x.who) === lc(a.who)); if (!gp) { gp = { who: a.who, allow: 0, deny: 0, applies: a.applies || 'this+sub' }; groups.push(gp); } const b = AD.rightBits(a[o.rightsKey]); if (a.type === 'deny') gp.deny |= b; else gp.allow |= b; });
  const list = h('div.cmplist', { style: { height: '120px' } }); const matrix = h('div');
  const toggle = (gp, col, bk, on) => { let bits = gp[col]; if (on) bits |= bk; else bits &= ~bk; gp[col] = bits; if (on) { const other = col === 'allow' ? 'deny' : 'allow'; gp[other] &= ~bk; } dirty = true; paint(); };
  const paint = () => {
    UI.clear(list); groups.forEach((gp, i) => list.append(h('div.cmpi' + (i === sel ? '.sel' : ''), { on: { click: () => { sel = i; paint(); } } }, UI.icon(/^(builtin|nt authority)/i.test(gp.who) || gp.who === 'Tout le monde' ? 'users' : 'user', 16), h('span', whoLabel(W, srv, gp.who)))));
    UI.clear(matrix); const gp = groups[sel]; if (!gp) return;
    matrix.append(h('div', { style: { fontWeight: 600, margin: '8px 0 4px' } }, 'Autorisations pour ' + whoLabel(W, srv, gp.who).replace(/ \(.*\)$/, '')));
    const rows = h('div.permgrid', h('div', ''), h('div.ph', 'Autoriser'), h('div.ph', 'Refuser'));
    o.kinds.forEach(k => {
      const bk = k[2]; const mk = (col) => h('input', { type: 'checkbox', checked: gp[col] !== 0 && (gp[col] & bk) === bk, disabled: !o.canEdit, on: { change: e => toggle(gp, col, bk, e.target.checked) } });
      rows.append(h('div', k[1]), h('div.pc', mk('allow')), h('div.pc', mk('deny')));
    });
    matrix.append(rows);
  };
  const add = () => {
    const t = UI.w.text('', { w: 300 }); let w2;
    w2 = desk.wm.open({ title: 'Sélectionner des utilisateurs, des ordinateurs, des comptes de service ou des groupes', w: 500, h: 200, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', h('div', 'Entrez les noms des objets à sélectionner :'), h('div', { style: { margin: '8px 0' } }, t), h('div.mbbtns', UI.w.btn('OK', () => {
      const who = UI.resolvePrincipal(W, srv, t.value); if (!who) { desk.msg({ title: 'Sélectionner des utilisateurs, des ordinateurs, des comptes de service ou des groupes', icon: 'warning', owner: w2, text: 'Aucun objet nommé « ' + t.value.trim() + ' » n’a été trouvé.\nVérifiez les types d’objet, l’emplacement et le nom, puis réessayez.' }); return; }
      w2.close(true); const ex = groups.findIndex(x => lc(x.who) === lc(who)); if (ex >= 0) { sel = ex; paint(); return; }
      groups.push({ who, allow: AD.rightBits(o.defaultRight), deny: 0, applies: 'this+sub' }); sel = groups.length - 1; dirty = true; paint();
    }, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
  };
  const remove = () => { if (!groups[sel]) return; groups.splice(sel, 1); sel = Math.max(0, sel - 1); dirty = true; paint(); };
  const commit = () => {
    if (!dirty) return; const out = [];
    groups.forEach(gp => { if (gp.deny) { const a = { who: gp.who, type: 'deny' }; a[o.rightsKey] = nameOf(gp.deny); if (o.applies) a.applies = gp.applies; out.push(a); } });
    groups.forEach(gp => { if (gp.allow) { const a = { who: gp.who, type: 'allow' }; a[o.rightsKey] = nameOf(gp.allow); if (o.applies) a.applies = gp.applies; out.push(a); } });
    o.setAces(out); dirty = false;
  };
  win = desk.wm.open({ title: o.title, w: 420, h: 540, owner, resizable: false, minimizable: false, maximizable: false, className: 'propsheet', body: () => h('div.pad', h('div', 'Noms de groupes ou d’utilisateurs :'), list, o.canEdit ? h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end', margin: '6px 0' } }, UI.w.btn('Ajouter…', add), UI.w.btn('Supprimer', remove)) : h('div', { style: { height: '12px' } }), matrix, h('div.mbbtns', UI.w.btn('OK', () => { commit(); win.close(true); }, { def: true }), UI.w.btn('Annuler', () => win.close(true)), UI.w.btn('Appliquer', () => commit(), { disabled: !o.canEdit }))) });
  paint(); return win;
}

/* ACL effective d'un dossier : entrées explicites + héritées (même résolution que AD.ntfsEffective) */
function aclChain(srv, path) {
  const nt = srv.win.ntfs || {}; const F = AD.ntfsFolder(srv, path); const out = []; if (!F) return { F: null, list: [] };
  const norm = p => String(p).replace(/\//g, '\\').replace(/\\+$/, '');
  const isSelf = lc(norm(path)) === lc(norm(F)); let cur = F, first = true;
  while (cur) {
    const fd = nt[cur];
    (fd.acl || []).forEach((a, i) => { const ap = a.applies || 'this+sub'; if (first && isSelf) out.push({ ace: a, idx: i, from: cur, inherited: false }); else if (ap.indexOf('sub') >= 0) out.push({ ace: a, idx: i, from: cur, inherited: true }); });
    if (!fd.inherit) break; first = false;
    const parent = Object.keys(nt).filter(k => lc(norm(cur)).indexOf(lc(norm(k)) + '\\') === 0).sort((a, b) => b.length - a.length)[0]; cur = parent || null;
  }
  if (!isSelf) { /* sous-dossier sans entrée propre : tout est hérité */ out.forEach(x => { x.inherited = true; }); }
  return { F, list: out, isSelf };
}

UI.folderProps = function (desk, owner, o) {
  const W = desk.W; const res = UI.resolvePath(desk, o.path); if (!res) { desk.msg({ title: 'Propriétés', icon: 'error', owner, text: 'Impossible d’afficher les propriétés : l’emplacement n’est pas accessible.' }); return; }
  const srv = res.dev; const path = res.path.replace(/\\$/, '') || res.path;
  const tok = () => W_.token(W, desk.d);
  const canAdmin = () => srv.id === desk.d.id ? W_.isAdminUser(W, desk.d) : (tok().has && tok().has('builtin\\administrateurs') ? true : W_.isAdminUser(W, desk.d));
  const denyAdmin = (ow) => desk.msg({ title: 'Sécurité', icon: 'error', owner: ow, text: 'Vous n’avez pas l’autorisation de modifier les autorisations de cet objet.\nAccès refusé.' });
  const touch = (txt) => { desk.env.touch('acl'); desk.change(txt, { dev: desk.devId }); };
  const nm = path.replace(/\\$/, '').split('\\').pop() || path;
  const share = () => (srv.win.shares || []).find(s => lc(s.path.replace(/\\$/, '')) === lc(path)) || null;
  /* ------------------ Général */
  const general = () => h('div.pad', h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } }, UI.icon('folder', 32), h('b', o.display || nm)), UI.w.sep(), UI.w.field('Type :', h('span', 'Dossier de fichiers'), { lw: 110 }), UI.w.field('Emplacement :', h('span', path.slice(0, path.lastIndexOf('\\')) || path), { lw: 110 }), UI.w.sep(), UI.w.field('Attributs :', h('span', 'Lecture seule (s’applique uniquement aux fichiers du dossier)'), { lw: 110 }));
  /* ------------------ Partage */
  const sharing = () => {
    const host = h('div.pad'); const draw = () => {
      UI.clear(host); const sh = share();
      host.append(UI.w.group('Partage de fichiers et de dossiers en réseau', h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0' } }, UI.icon('folder', 32), h('div', h('b', nm), h('div', sh ? 'Partagé' : 'Non partagé')))),
        h('div', { style: { margin: '6px 0' } }, 'Chemin réseau : ' + (sh ? '\\\\' + srv.name.toUpperCase() + '\\' + sh.name : 'Non partagé')),
        UI.w.group('Partage avancé', h('div', 'Définissez des autorisations personnalisées, créez plusieurs partages et définissez d’autres options de partage avancées.'), h('div', { style: { marginTop: '8px' } }, UI.w.btn('Partage avancé…', () => { if (!canAdmin()) { denyAdmin(owner); return; } advancedShare(draw); }))));
    }; draw(); return host;
  };
  const advancedShare = (done) => {
    const sh = share(); const on = { v: !!sh }; const nmEl = UI.w.text(sh ? sh.name : nm, { w: 240 }); let w2;
    const shared = UI.w.check('Partager ce dossier', on.v, v => { on.v = v; nmEl.disabled = !v; }); nmEl.disabled = !on.v;
    const perms = () => {
      const cur = share(); if (!cur && !on.v) return;
      const tmp = cur || { name: nmEl.value.trim() || nm, path, perms: [{ who: 'Tout le monde', access: 'Read' }] }; if (!cur) { srv.win.shares = srv.win.shares || []; srv.win.shares.push(tmp); touch('Partage de ' + path + ' sous le nom « ' + tmp.name + ' »'); }
      aclDialog(desk, w2, { title: 'Autorisations pour ' + tmp.name, srv, kinds: SHARE_PERMS, rightsKey: 'access', defaultRight: 'Read', canEdit: true, getAces: () => (tmp.perms || []).map(p => Object.assign({ type: 'allow' }, p)), setAces: (a) => { tmp.perms = a.map(x => { const r = { who: x.who, access: x.access }; if (x.type === 'deny') r.type = 'deny'; return r; }); touch('Autorisations de partage de « ' + tmp.name + ' » modifiées'); } });
    };
    w2 = desk.wm.open({ title: 'Partage avancé', w: 400, h: 260, owner, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', shared, h('div', { style: { margin: '10px 0' } }, UI.w.field('Nom du partage :', nmEl, { lw: 110 })), h('div', { style: { margin: '6px 0' } }, UI.w.btn('Autorisations', perms)), h('div.mbbtns', UI.w.btn('OK', () => {
      const cur = share();
      if (on.v && !cur) { srv.win.shares = srv.win.shares || []; srv.win.shares.push({ name: nmEl.value.trim() || nm, path, perms: [{ who: 'Tout le monde', access: 'Read' }] }); touch('Partage de ' + path + ' sous le nom « ' + (nmEl.value.trim() || nm) + ' »'); }
      else if (on.v && cur && nmEl.value.trim() && nmEl.value.trim() !== cur.name) { cur.name = nmEl.value.trim(); touch('Partage renommé « ' + cur.name + ' »'); }
      else if (!on.v && cur) { srv.win.shares.splice(srv.win.shares.indexOf(cur), 1); touch('Partage « ' + cur.name + ' » supprimé'); }
      w2.close(true); done && done();
    }, { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
  };
  /* ------------------ Sécurité */
  let secHost;
  const secDraw = () => {
    UI.clear(secHost); const ch = aclChain(srv, path); const rows = ch.list; let sel = 0; const hasAcl = !!ch.F;
    const lst = h('div.cmplist', { style: { height: '130px' } }); const perm = h('div'); const draw2 = () => {
      UI.clear(lst); rows.forEach((x, i) => lst.append(h('div.cmpi' + (i === sel ? '.sel' : ''), { on: { click: () => { sel = i; draw2(); } } }, UI.icon('user', 16), h('span', whoLabel(W, srv, x.ace.who)))));
      UI.clear(perm); const x = rows[sel]; if (!x) return; const b = AD.rightBits(x.ace.rights); const deny = x.ace.type === 'deny';
      perm.append(h('div', { style: { margin: '8px 0 4px' } }, 'Autorisations pour ' + whoLabel(W, srv, x.ace.who).replace(/ \(.*\)$/, '')));
      const g2 = h('div.permgrid', h('div', ''), h('div.ph', 'Autoriser'), h('div.ph', 'Refuser'));
      PERMS.forEach(k => { const on = b !== 0 && (b & k[2]) === k[2]; g2.append(h('div', k[1]), h('div.pc', h('input', { type: 'checkbox', checked: on && !deny, disabled: true })), h('div.pc', h('input', { type: 'checkbox', checked: on && deny, disabled: true }))); });
      perm.append(g2);
    };
    draw2();
    secHost.append(h('div', 'Nom de l’objet : ' + path), h('div', { style: { margin: '8px 0 2px' } }, 'Noms de groupes ou d’utilisateurs :'), lst, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '6px 0' } }, h('span', { style: { flex: 1 } }, 'Pour modifier les autorisations, cliquez sur Modifier.'), UI.w.btn('Modifier…', () => editNtfs())), perm,
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' } }, h('span', { style: { flex: 1 } }, 'Pour les autorisations spéciales et les paramètres avancés, cliquez sur Avancé.'), UI.w.btn('Avancé', () => advancedSec())));
    if (!hasAcl) secHost.append(h('div.muted', { style: { marginTop: '6px' } }, 'Aucune liste de contrôle d’accès modélisée pour cet emplacement.'));
  };
  const ownEntry = () => { const nt = srv.win.ntfs = srv.win.ntfs || {}; const key = Object.keys(nt).find(k => lc(k.replace(/\\$/, '')) === lc(path)); if (key) return nt[key]; nt[path] = { inherit: true, owner: 'BUILTIN\\Administrateurs', acl: [] }; return nt[path]; };
  const editNtfs = () => {
    if (!canAdmin()) { desk.msg({ title: 'Sécurité', icon: 'error', owner, text: 'Vous n’avez pas l’autorisation de modifier les autorisations de cet objet.\nAccès refusé.' }); return; }
    const ch = aclChain(srv, path); const own = ch.list.filter(x => !x.inherited);
    aclDialog(desk, owner, { title: 'Autorisations pour ' + nm, srv, kinds: PERMS, rightsKey: 'rights', defaultRight: 'ReadAndExecute', canEdit: true, applies: true, getAces: () => own.map(x => Object.assign({}, x.ace)),
      setAces: (a) => { const e = ownEntry(); e.acl = a.map(x => Object.assign({ applies: 'this+sub' }, x)); touch('Autorisations NTFS de ' + path + ' modifiées'); secDraw(); } });
  };
  const advancedSec = () => {
    const ch = aclChain(srv, path); const e = () => (srv.win.ntfs || {})[Object.keys(srv.win.ntfs || {}).find(k => lc(k.replace(/\\$/, '')) === lc(path))];
    let w2; const host = h('div');
    const drawAdv = () => {
      UI.clear(host); const c2 = aclChain(srv, path); const ent = e(); const inh = ent ? ent.inherit !== false : true;
      const rows = c2.list.map((x, i) => ({ id: i, type: x.ace.type === 'deny' ? 'Refuser' : 'Autoriser', who: whoLabel(W, srv, x.ace.who), acc: rightName(x.ace.rights), from: x.inherited ? (x.from.replace(/\\$/, '') + '\\') : 'Aucun', app: APPLIES[x.ace.applies || 'this+sub'], ref: x }));
      const lvA = UI.w.listView({ columns: [{ key: 'type', label: 'Type', w: 70, sort: false }, { key: 'who', label: 'Principal', w: 200, sort: false }, { key: 'acc', label: 'Accès', w: 150, sort: false }, { key: 'from', label: 'Hérité de', w: 130, sort: false }, { key: 'app', label: 'S’applique à', w: 250, sort: false }], rows, key: r => r.id, empty: 'Aucune entrée.' });
      const owner2 = ent && ent.owner || (c2.F && srv.win.ntfs[c2.F].owner) || 'BUILTIN\\Administrateurs';
      const addB = UI.w.btn('Ajouter', () => { if (!canAdmin()) { denyAdmin(w2); return; } w2.close(true); editNtfs(); }); const remB = UI.w.btn('Supprimer', () => { const s = lvA.selected(); if (!s) return; if (s.ref.inherited) { desk.msg({ title: 'Sécurité', icon: 'warning', owner: w2, text: 'Les entrées héritées ne peuvent pas être supprimées ici. Désactivez l’héritage pour les modifier.' }); return; } if (!canAdmin()) { denyAdmin(w2); return; } const own = ownEntry(); own.acl.splice(s.ref.idx, 1); touch('Entrée d’autorisation supprimée sur ' + path); drawAdv(); });
      const inhB = UI.w.btn(inh ? 'Désactiver l’héritage' : 'Activer l’héritage', () => {
        if (!canAdmin()) { denyAdmin(w2); return; }
        if (inh) {
          desk.msg({ title: 'Bloquer l’héritage', icon: 'question', owner: w2, text: 'Que voulez-vous faire des autorisations héritées actuelles ?\n\n• Convertir : conserver les autorisations héritées comme autorisations explicites.\n• Supprimer : retirer toutes les autorisations héritées.', buttons: [{ label: 'Convertir les autorisations héritées en autorisations explicites sur cet objet', fn: () => { const own = ownEntry(); const inherited = aclChain(srv, path).list.filter(x => x.inherited).map(x => Object.assign({}, x.ace, { applies: x.ace.applies || 'this+sub' })); own.acl = inherited.concat(own.acl); own.inherit = false; touch('Héritage désactivé sur ' + path + ' (autorisations converties)'); drawAdv(); secDraw(); } }, { label: 'Supprimer toutes les autorisations héritées de cet objet', fn: () => { const own = ownEntry(); own.inherit = false; touch('Héritage désactivé sur ' + path + ' (autorisations héritées supprimées)'); drawAdv(); secDraw(); } }, { label: 'Annuler' }] });
        } else { const own = ownEntry(); own.inherit = true; touch('Héritage activé sur ' + path); drawAdv(); secDraw(); }
      });
      host.append(h('div', UI.w.field('Nom :', h('span', path), { lw: 90 }), UI.w.field('Propriétaire :', h('span', owner2), { lw: 90 })), UI.w.sep(), h('div', { style: { margin: '6px 0 4px' } }, 'Entrées d’autorisation :'), h('div', { style: { height: '170px', border: '1px solid #aaa' } }, lvA.el), h('div', { style: { display: 'flex', gap: '6px', margin: '8px 0' } }, addB, remB, UI.w.btn('Afficher', () => { }, { disabled: true })), inhB);
    };
    drawAdv();
    const effTab = () => {
      const t = UI.w.text('', { w: 220 }); const out = h('div'); const go = () => {
        UI.clear(out); const who = UI.resolvePrincipal(W, srv, t.value); if (!who) { out.append(h('div.muted', 'Aucun objet nommé « ' + t.value.trim() + ' » n’a été trouvé.')); return; }
        let tokSet = new Set([lc(who), 'tout le monde', 'utilisateurs authentifiés']);
        const m = who.split('\\'); if (m.length === 2) { for (const dv of AD.domains(W)) { if (lc(dv.win.ad.netbios) !== lc(m[0])) continue; const A = dv.win.ad; if (AD.userOf(A, m[1])) tokSet = AD.token(W, dv.win.ad.domain, m[1]); } }
        if (srv.win.shares) { /* le résultat ne tient pas compte des autorisations de partage (comme dans l'onglet réel) */ }
        const r = AD.ntfsEffective(srv, path, tokSet); const b = r.rights || 0;
        GRANULAR.forEach(k => out.append(h('div', { style: { display: 'flex', gap: '8px' } }, h('span', { style: { width: '20px' } }, (b & k[1]) === k[1] && b ? '✔' : '✖'), h('span', k[0]))));
        out.append(h('div.muted', { style: { marginTop: '6px' } }, 'L’accès effectif ne tient pas compte des autorisations de partage.'));
      };
      return h('div.pad', UI.w.field('Utilisateur / groupe :', t, { lw: 130 }), h('div', { style: { margin: '6px 0' } }, UI.w.btn('Afficher l’accès effectif', go)), h('div', { style: { maxHeight: '260px', overflow: 'auto' } }, out));
    };
    const tabs = UI.w.tabs([{ label: 'Autorisations', content: () => host }, { label: 'Audit', content: () => h('div.pad.muted', 'L’audit n’est pas modélisé.') }, { label: 'Accès effectif', content: effTab }]);
    w2 = desk.wm.open({ title: 'Paramètres de sécurité avancés pour ' + nm, icon: 'shield', w: 720, h: 520, owner, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', tabs.el, h('div.mbbtns', UI.w.btn('OK', () => w2.close(true), { def: true }), UI.w.btn('Annuler', () => w2.close(true)))) });
  };
  secHost = h('div.pad');
  const items = [{ label: 'Général', content: general }];
  if (srv.win.shares || srv.win.svc) items.push({ label: 'Partage', content: sharing });
  items.push({ label: 'Sécurité', content: () => { secDraw(); return secHost; } });
  UI.w.propertySheet({ wm: desk.wm, owner, title: 'Propriétés de ' + (o.display || nm), icon: 'folder', w: 440, h: 560, tabs: items, okOnly: false, onOk: () => true });
  desk.run.act(desk.devId, 'Affichage des propriétés de ' + (res.unc || path), { kind: 'ui' });
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
