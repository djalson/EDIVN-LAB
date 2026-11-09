/* ============================================================================
   Active Directory : Utilisateurs et ordinateurs (dsa.msc) et Domaines et approbations (domain.msc).
   Aides communes dans UI.ad. Tout agit sur d.win.ad du contrôleur de domaine ; les effets (ouverture de
   session, GPO appliquées, accès aux partages…) découlent du moteur AD.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, AD = SIM.ad, h = UI.h, W_ = E.win;
SIM.AVREG['aduc-gui'] = 'Utilisateurs et ordinateurs Active Directory : arborescence (Builtin, Computers, Domain Controllers, ForeignSecurityPrincipals, Managed Service Accounts, Users), colonnes Nom/Type/Description, onglets Général/Compte/Membre de, grille des horaires d’accès, boîtes « Réinitialiser le mot de passe » et « Sélectionner des utilisateurs… » reconstitués de mémoire (version française).';
SIM.AVREG['aduc-gui-limits'] = 'ADUC : seuls les onglets Général, Compte et Membre de d’un utilisateur, Général et Membres d’un groupe sont simulés (adresse, profil, téléphones, organisation, appel entrant, etc. absents) ; les horaires d’accès sont exprimés en UTC ; la suppression d’une unité d’organisation est refusée comme pour un objet protégé.';
SIM.AVREG['aduc-msg'] = 'ADUC : textes des messages (compte désactivé/activé, confirmation de suppression, mot de passe réinitialisé, échec de complexité, accès refusé, objet protégé contre la suppression) reconstitués ; à vérifier par capture.';
SIM.AVREG['domtrust-gui'] = 'Domaines et approbations Active Directory : onglet Approbations, propriétés d’une approbation (Valider), assistant « Nouvelle approbation » simplifié ; textes de validation et d’échec reconstitués ; à vérifier par capture.';
const lc = s => String(s).toLowerCase();
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/* ------------------------------------------------------------------ aides communes */
const ad = UI.ad = {};
ad.target = function (desk) {
  const d = desk.d; if (d.win && d.win.ad) return { dev: d, A: d.win.ad, domain: d.win.ad.domain };
  if (!d.win || !d.win.domain) return { err: 'Cet ordinateur n’est pas membre d’un domaine : impossible de se connecter à Active Directory.' };
  const r = AD.locateDC(desk.W, desk.devId, d.win.domain); if (!r.ok) return { err: 'Impossible de contacter un contrôleur de domaine Active Directory pour le domaine « ' + d.win.domain + ' ».' };
  return { dev: r.dev, A: r.dev.win.ad, domain: r.dev.win.ad.domain };
};
ad.canWrite = function (desk, t) {
  const tok = W_.token(desk.W, desk.d); const nb = lc(t.A.netbios);
  return tok.has(nb + '\\admins du domaine') || tok.has('builtin\\administrateurs') || tok.has(nb + '\\administrateurs');
};
ad.denied = (desk, owner) => desk.msg({ title: 'Active Directory', icon: 'error', owner, text: 'Accès refusé.\nVous ne disposez pas des autorisations suffisantes pour modifier cet objet.' });
ad.pwdOk = function (pol, pw) {
  if (pw.length < pol.minPwdLen) return false; if (!pol.complexity) return true;
  const cls = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length; return cls >= 3;
};
ad.PWD_ERR = 'Le mot de passe ne répond pas aux exigences de stratégie de mot de passe. Vérifiez la longueur minimale du mot de passe, sa complexité et les exigences d’historique des mots de passe.';
ad.rdnLabel = dn => dn.split(',')[0].replace(/^(OU|CN|DC)=/i, '');
ad.parentDn = dn => dn.split(',').slice(1).join(',');
ad.domDn = A => A.domain.split('.').map(x => 'DC=' + x).join(',');
/* résout un nom saisi en objet (utilisateur, groupe, ordinateur), éventuellement dans un autre domaine */
/* identités spéciales (pas des groupes de l'annuaire) : utilisables dans les listes de contrôle d'accès et le filtrage de sécurité des GPO */
const WELLKNOWN = ['Utilisateurs authentifiés', 'Tout le monde'];
ad.resolve = function (W, A, text, kinds, o) {
  let t = text.trim(); if (!t) return null;
  if (o && o.wellKnown) { const wk = WELLKNOWN.find(x => lc(x) === lc(t)); if (wk) return { kind: 'group', obj: { name: wk }, member: wk, label: wk, dom: A }; } kinds = kinds || ['user', 'group', 'computer']; let dom = A, name = t;
  const m1 = /^([^\\]+)\\(.+)$/.exec(t), m2 = /^(.+)@(.+)$/.exec(t);
  if (m1) { const d2 = AD.domains(W).find(d => lc(d.win.ad.netbios) === lc(m1[1])); if (!d2) return null; dom = d2.win.ad; name = m1[2]; }
  else if (m2) { const d2 = AD.byDomain(W, m2[2]); if (!d2) return null; dom = d2.win.ad; name = m2[1]; }
  const qual = dom === A ? null : dom;
  if (kinds.indexOf('user') >= 0) { const u = dom.users.find(x => lc(x.sam) === lc(name) || lc(x.name) === lc(name)); if (u) return { kind: 'user', obj: u, member: qual ? dom.netbios + '\\' + u.sam : u.sam, label: u.name, dom }; }
  if (kinds.indexOf('group') >= 0) { const gr = dom.groups.find(x => lc(x.name) === lc(name)); if (gr) return { kind: 'group', obj: gr, member: qual ? dom.netbios + '\\' + gr.name : gr.name, label: gr.name, dom }; }
  if (kinds.indexOf('computer') >= 0) { const c = dom.computers.find(x => lc(x.name) === lc(name.replace(/\$$/, ''))); if (c) return { kind: 'computer', obj: c, member: (qual ? dom.netbios + '\\' : '') + c.name + '$', label: c.name, dom }; }
  return null;
};
/* boîte « Sélectionner des utilisateurs, des contacts, des ordinateurs, des comptes de service ou des groupes » */
ad.pick = function (desk, owner, t, o) {
  const ta = UI.w.textarea('', { rows: 4 }); ta.style.width = '100%'; const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
  const parse = () => ta.value.split(/[;\n]/).map(x => x.trim()).filter(Boolean);
  const check = () => { const res = []; for (const n of parse()) { const r = ad.resolve(desk.W, t.A, n, o.kinds, o); if (!r) { desk.msg({ title: 'Sélectionner un objet', icon: 'warning', owner: dlg, text: 'Aucun objet nommé « ' + n + ' » n’a été trouvé.\nVérifiez les types d’objets et l’emplacement et vérifiez que le nom est correct.' }); return null; } res.push(r); } return res; };
  const dlg = UI.dialog(desk, owner, { title: o.title || 'Sélectionnez des utilisateurs, des contacts, des ordinateurs, des comptes de service ou des groupes', w: 520, h: 280,
    body: h('div', h('div', { style: { margin: '2px 0 4px' } }, 'Entrez les noms des objets à sélectionner (exemples) :'), ta, h('div', { style: { margin: '6px 0' } }, UI.w.btn('Vérifier les noms', () => { const r = check(); if (r && r.length) { ta.value = r.map(x => x.label).join('; '); } })), err),
    buttons: [{ label: 'OK', def: true, fn: () => { const r = check(); if (!r) return false; if (!r.length) { err.textContent = 'Entrez au moins un nom.'; return false; } o.onOk(r); } }, { label: 'Annuler' }] });
  setTimeout(() => ta.focus(), 30); return dlg;
};
/* sélecteur de conteneur (déplacement) */
ad.pickContainer = function (desk, owner, t, cb) {
  const nodes = ad.containerTree(t.A); let sel = null;
  const tree = UI.w.tree({ roots: nodes, onSelect: n => { sel = n.key; } }); tree.el.style.height = '220px'; tree.el.style.border = '1px solid #adadad'; tree.el.style.overflow = 'auto';
  UI.dialog(desk, owner, { title: 'Déplacer', w: 420, h: 380, body: h('div', h('div', { style: { margin: '2px 0 6px' } }, 'Déplacer l’objet dans le conteneur :'), tree.el), buttons: [{ label: 'OK', def: true, fn: () => { if (!sel) return false; cb(sel); } }, { label: 'Annuler' }] });
};
ad.STD = ['CN=Builtin', 'CN=Computers', 'CN=ForeignSecurityPrincipals', 'CN=Managed Service Accounts', 'CN=Users'];
ad.containerTree = function (A) {
  const root = ad.domDn(A); const dns = new Set(); (A.ous || []).forEach(o => dns.add(o.dn)); ad.STD.forEach(s => dns.add(s + ',' + root));
  [].concat(A.users, A.groups, A.computers).forEach(o => { if (o.ou && o.ou !== root) dns.add(o.ou); });
  const kidsOf = dn => Array.from(dns).filter(x => ad.parentDn(x) === dn).sort((a, b) => ad.rdnLabel(a).localeCompare(ad.rdnLabel(b), 'fr', { sensitivity: 'base' })).map(x => ({ key: x, label: ad.rdnLabel(x), icon: /^OU=/i.test(x) ? 'ou' : 'folder', children: () => kidsOf(x) }));
  return [{ key: root, label: A.domain, icon: 'network', expanded: true, children: () => kidsOf(root) }];
};
/* complément d'icônes originales */
(function () { const I = UI.icons; if (!I.ou) { I.ou = I.folder.replace('</svg>', '<rect x="9" y="14" width="14" height="9" rx="1.5" fill="#cfe0ff" stroke="#5b7396"/></svg>'); I.userx = I.user.replace('</svg>', '<circle cx="24" cy="24" r="6" fill="#e5534b"/><path d="M21 21l6 6M27 21l-6 6" stroke="#fff" stroke-width="2"/></svg>'); I.pcx = I.pc.replace('</svg>', '<circle cx="24" cy="24" r="6" fill="#e5534b"/><path d="M21 21l6 6M27 21l-6 6" stroke="#fff" stroke-width="2"/></svg>'); } })();

/* ------------------------------------------------------------------ grille des horaires d'accès */
function hoursDialog(desk, owner, u, onDone) {
  const lh = u.logonHours; const grid = DAYS.map((_, dI) => Array.from({ length: 24 }, (_, hI) => !(lh && ((lh.deny || []).some(r => r.day === dI && hI >= r.from && hI < r.to) || (lh.allow && !lh.allow.some(r => r.day === dI && hI >= r.from && hI < r.to))))));
  const tbl = h('div.lhgrid'); let sel = null;
  const paint = () => { UI.clear(tbl); tbl.append(h('div.lhr', h('div.lhd'), Array.from({ length: 24 }, (_, i) => h('div.lhh', String(i))))); DAYS.forEach((dn, dI) => tbl.append(h('div.lhr', h('div.lhd', dn), grid[dI].map((on, hI) => h('div.lhc' + (on ? '.on' : '') + (sel && dI >= sel.d0 && dI <= sel.d1 && hI >= sel.h0 && hI <= sel.h1 ? '.sel' : ''), { 'data-d': dI, 'data-h': hI }))))); };
  let drag = null; tbl.addEventListener('pointerdown', e => { const c = e.target.closest('.lhc'); if (!c) return; drag = { d: +c.dataset.d, h: +c.dataset.h }; sel = { d0: drag.d, d1: drag.d, h0: drag.h, h1: drag.h }; paint(); });
  tbl.addEventListener('pointermove', e => { if (!drag) return; const c = document.elementFromPoint(e.clientX, e.clientY); const cc = c && c.closest && c.closest('.lhc'); if (!cc) return; sel = { d0: Math.min(drag.d, +cc.dataset.d), d1: Math.max(drag.d, +cc.dataset.d), h0: Math.min(drag.h, +cc.dataset.h), h1: Math.max(drag.h, +cc.dataset.h) }; paint(); });
  tbl.addEventListener('pointerup', () => { drag = null; }); tbl.addEventListener('pointerleave', () => { drag = null; });
  const setSel = on => { if (!sel) return; for (let d2 = sel.d0; d2 <= sel.d1; d2++) for (let h2 = sel.h0; h2 <= sel.h1; h2++) grid[d2][h2] = on; paint(); };
  paint();
  UI.dialog(desk, owner, { title: 'Horaires d’accès pour ' + u.name, w: 640, h: 440, body: h('div', h('div', { style: { margin: '2px 0 6px' } }, 'Cliquez sur une zone de la grille pour la sélectionner, puis choisissez « Ouverture de session autorisée » ou « Ouverture de session refusée ». Heures exprimées en temps universel (UTC).'), tbl, h('div', { style: { display: 'flex', gap: '8px', margin: '8px 0' } }, UI.w.btn('Ouverture de session autorisée', () => setSel(true)), UI.w.btn('Ouverture de session refusée', () => setSel(false)))),
    buttons: [{ label: 'OK', def: true, fn: () => {
      const deny = []; grid.forEach((row, dI) => { let s = null; row.forEach((on, hI) => { if (!on && s === null) s = hI; if ((on || hI === 23) && s !== null) { deny.push({ day: dI, from: s, to: on ? hI : 24 }); s = null; } }); });
      onDone(deny.length ? { deny } : null);
    } }, { label: 'Annuler' }] });
}
function workstationsDialog(desk, owner, u, onDone) {
  let all = !(u.allowedWorkstations && u.allowedWorkstations.length); const list = (u.allowedWorkstations || []).slice(); const box = h('div.dlist.tall'); const nm = UI.w.text('', { w: 220 }); let sel;
  const draw = () => { UI.clear(box); list.forEach((v, i) => box.append(h('div.dli' + (i === sel ? '.sel' : ''), { on: { click: () => { sel = i; draw(); } } }, v))); };
  const r1 = UI.w.radio('ws', 'Tous les ordinateurs', all, () => { all = true; }), r2 = UI.w.radio('ws', 'Les ordinateurs suivants', !all, () => { all = false; });
  draw();
  UI.dialog(desk, owner, { title: 'Stations de travail autorisées', w: 440, h: 400, body: h('div', r1, r2, h('div', { style: { margin: '6px 0 2px' } }, 'Nom de l’ordinateur :'), nm, h('div', { style: { display: 'flex', gap: '6px', margin: '4px 0' } }, UI.w.btn('Ajouter', () => { const v = nm.value.trim().toUpperCase(); if (v && list.indexOf(v) < 0) { list.push(v); nm.value = ''; draw(); r2.querySelector('input').checked = true; all = false; } }), UI.w.btn('Supprimer', () => { if (sel !== undefined) { list.splice(sel, 1); sel = undefined; draw(); } })), box),
    buttons: [{ label: 'OK', def: true, fn: () => { onDone(all || !list.length ? [] : list); } }, { label: 'Annuler' }] });
}

/* ------------------------------------------------------------------ ADUC */
UI.app('aduc', {
  title: 'Utilisateurs et ordinateurs Active Directory', icon: 'users', admin: true, single: true,
  open: (desk) => {
    const t = ad.target(desk); if (t.err) { desk.msg({ title: 'Utilisateurs et ordinateurs Active Directory', icon: 'error', text: t.err }); return null; }
    const A = t.A; let win, api; const W = desk.W; const rootDn = ad.domDn(A);
    const changed = (txt, o) => { desk.env.touch('ad'); desk.change(txt, Object.assign({ dev: t.dev.id }, o || {})); refresh(); };
    const need = () => { if (!ad.canWrite(desk, t)) { ad.denied(desk, win); return false; } return true; };
    const containers = () => ad.containerTree(A);
    const roots = () => [{ key: 'root', label: 'Utilisateurs et ordinateurs Active Directory [' + W_.fqdn(t.dev) + ']', icon: 'users', expanded: true, children: [{ key: 'saved', label: 'Requêtes enregistrées', icon: 'folder' }].concat(containers()) }];
    const typeOf = o => (o.kind === 'user' ? 'Utilisateur' : o.kind === 'computer' ? 'Ordinateur' : o.kind === 'ou' ? 'Unité d’organisation' : o.kind === 'cn' ? 'Conteneur' : 'Groupe de sécurité - ' + ({ Global: 'Global', DomainLocal: 'Domaine local', Universal: 'Universel' }[o.obj.scope] || o.obj.scope));
    const rowsOf = dn => {
      const out = []; const dns = new Set(); (A.ous || []).forEach(x => dns.add(x.dn)); ad.STD.forEach(s => dns.add(s + ',' + rootDn));
      Array.from(dns).filter(x => ad.parentDn(x) === dn).forEach(x => out.push({ kind: /^OU=/i.test(x) ? 'ou' : 'cn', name: ad.rdnLabel(x), dn: x, desc: '' }));
      A.groups.filter(x => x.ou === dn).forEach(x => out.push({ kind: 'group', name: x.name, obj: x, desc: x.desc || '' }));
      A.computers.filter(x => x.ou === dn).forEach(x => out.push({ kind: 'computer', name: x.name, obj: x, desc: x.dc ? 'Contrôleur de domaine' : (x.desc || '') }));
      A.users.filter(x => x.ou === dn).forEach(x => out.push({ kind: 'user', name: x.name, obj: x, desc: x.desc || '' }));
      return out;
    };
    const iconOf = r => (r.kind === 'user' ? (r.obj.enabled === false ? 'userx' : 'user') : r.kind === 'group' ? 'users' : r.kind === 'computer' ? (r.obj.enabled === false ? 'pcx' : 'pc') : r.kind === 'ou' ? 'ou' : 'folder');
    let curDn = rootDn; let lv;

    /* --- actions sur objets --- */
    const setEnabled = (r, on) => { if (!need()) return; r.obj.enabled = on; changed('AD : compte ' + r.name + (on ? ' activé' : ' désactivé')); desk.msg({ title: 'Active Directory', icon: 'info', owner: win, text: 'L’objet ' + r.name + ' a été ' + (on ? 'activé.' : 'désactivé.') }); };
    const delObj = r => {
      if (!need()) return; if (r.kind === 'ou' || r.kind === 'cn') { desk.msg({ title: 'Active Directory', icon: 'error', owner: win, text: 'Vous ne disposez pas des autorisations suffisantes pour supprimer ' + r.name + ', ou cet objet est protégé contre une suppression accidentelle.' }); return; }
      UI.confirm(desk, win, { title: 'Active Directory', text: 'Êtes-vous sûr de vouloir supprimer l’objet ' + (r.kind === 'user' ? 'utilisateur' : r.kind === 'group' ? 'groupe' : 'ordinateur') + ' ' + r.name + ' ?', onYes: () => {
        if (r.kind === 'user') { A.users = A.users.filter(x => x !== r.obj); A.groups.forEach(g2 => { g2.members = (g2.members || []).filter(m => lc(m) !== lc(r.obj.sam)); }); }
        else if (r.kind === 'group') { A.groups = A.groups.filter(x => x !== r.obj); } else A.computers = A.computers.filter(x => x !== r.obj);
        changed('AD : objet ' + r.name + ' supprimé'); } });
    };
    const moveObj = r => { if (!need()) return; ad.pickContainer(desk, win, t, dn => { if (r.obj.ou === dn) return; r.obj.ou = dn; changed('AD : objet ' + r.name + ' déplacé vers ' + dn); }); };
    const setPwd = (r, pw, must, unlock) => { AD.setPassword(W, A.domain, r.obj.sam, pw, must); if (unlock) { r.obj.locked = false; r.obj._bad = 0; } };
    const resetPwdDlg = r => {
      if (!need()) return; const p1 = UI.w.text('', { password: true, w: 240 }), p2 = UI.w.text('', { password: true, w: 240 }); const must = UI.w.check('L’utilisateur doit changer de mot de passe à la prochaine ouverture de session', true); const unl = UI.w.check('Déverrouiller le compte de l’utilisateur', !!r.obj.locked); const err = h('div', { style: { color: '#b00020', minHeight: '16px', marginTop: '6px' } });
      UI.dialog(desk, win, { title: 'Réinitialiser le mot de passe', w: 520, h: 330, body: h('div', UI.w.field('Nouveau mot de passe :', p1, { lw: 170 }), UI.w.field('Confirmer le mot de passe :', p2, { lw: 170 }), h('div', { style: { margin: '8px 0 4px' } }, must), unl, err),
        buttons: [{ label: 'OK', def: true, fn: () => {
          if (p1.value !== p2.value) { err.textContent = 'Les mots de passe ne correspondent pas.'; return false; }
          if (!ad.pwdOk(AD.passwordPolicy(W, A), p1.value)) { err.textContent = ad.PWD_ERR; return false; }
          setPwd(r, p1.value, must.querySelector('input').checked, unl.querySelector('input').checked); changed('AD : mot de passe de ' + r.obj.sam + ' réinitialisé' + (unl.querySelector('input').checked ? ' et compte déverrouillé' : ''));
          setTimeout(() => desk.msg({ title: 'Active Directory', icon: 'info', owner: win, text: 'Le mot de passe de ' + r.obj.sam + ' a été changé.' }), 30); } }, { label: 'Annuler' }] });
    };

    /* --- propriétés --- */
    const groupsOfUser = sam => A.groups.filter(gr => (gr.members || []).some(m => lc(m) === lc(sam)));
    const userProps = r => {
      const u = r.obj; const nm = UI.w.text(u.name, { w: 260 }), ds = UI.w.text(u.desc || '', { w: 260 });
      const must = UI.w.check('L’utilisateur doit changer de mot de passe à la prochaine ouverture de session', !!u.mustChange, v => { if (v) { never.querySelector('input').checked = false; st.never = false; } st.must = v; ps.markDirty(); });
      const never = UI.w.check('Le mot de passe n’expire jamais', !!u.pwdNeverExpires, v => { if (v) { must.querySelector('input').checked = false; st.must = false; } st.never = v; ps.markDirty(); });
      const dis = UI.w.check('Compte désactivé', u.enabled === false, v => { st.dis = v; ps.markDirty(); });
      const st = { must: !!u.mustChange, never: !!u.pwdNeverExpires, dis: u.enabled === false, unlock: false, expires: u.expires || null, hours: u.logonHours || null, ws: (u.allowedWorkstations || []).slice(), groups: groupsOfUser(u.sam).map(x => x.name) };
      const unl = u.locked ? UI.w.check('Déverrouiller le compte. Ce compte est actuellement verrouillé sur ce contrôleur de domaine Active Directory.', false, v => { st.unlock = v; ps.markDirty(); }) : null;
      const fmtD = iso => { const d = new Date(iso); return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); }; const pad2 = U.pad2;
      const expTxt = UI.w.text(st.expires ? fmtD(st.expires) : '', { w: 100, disabled: !st.expires, onchange: () => ps.markDirty() });
      const rNever = UI.w.radio('exp', 'Jamais', !st.expires, () => { expTxt.disabled = true; st.expires = null; ps.markDirty(); }), rEnd = UI.w.radio('exp', 'Fin de :', !!st.expires, () => { expTxt.disabled = false; if (!st.expires) { expTxt.value = fmtD(W.now().getTime() + 86400000 * 30); } ps.markDirty(); });
      const general = h('div.pad', UI.w.field('Nom complet :', nm, { lw: 140 }), UI.w.field('Description :', ds, { lw: 140 }));
      nm.addEventListener('input', () => ps.markDirty()); ds.addEventListener('input', () => ps.markDirty());
      const account = h('div.pad', UI.w.field('Nom d’ouverture de session de l’utilisateur :', h('span', u.sam + ' @' + A.domain), { lw: 250 }), h('div', { style: { display: 'flex', gap: '8px', margin: '8px 0' } }, UI.w.btn('Horaires d’accès…', () => hoursDialog(desk, ps.win || win, { name: u.name, logonHours: st.hours }, v => { st.hours = v; ps.markDirty(); })), UI.w.btn('Se connecter à…', () => workstationsDialog(desk, ps.win || win, { allowedWorkstations: st.ws }, v => { st.ws = v; ps.markDirty(); }))), unl, UI.w.group('Options du compte', must, never, dis), UI.w.group('Le compte expire', rNever, h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, rEnd, expTxt)));
      const grpBox = h('div.dlist.tall'); let gSel; const gDraw = () => { UI.clear(grpBox); st.groups.forEach((x, i) => grpBox.append(h('div.dli' + (i === gSel ? '.sel' : ''), { on: { click: () => { gSel = i; gDraw(); } } }, x + '  —  ' + A.domain + '/' + ad.rdnLabel((A.groups.find(y => y.name === x) || { ou: 'CN=Users' }).ou)))); }; gDraw();
      const memberOf = h('div.pad', h('div', 'Membre de :'), grpBox, h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } }, UI.w.btn('Ajouter…', () => ad.pick(desk, ps.win || win, t, { kinds: ['group'], title: 'Sélectionner des groupes', onOk: res => { res.forEach(x => { if (st.groups.indexOf(x.obj.name) < 0) st.groups.push(x.obj.name); }); gDraw(); ps.markDirty(); } })), UI.w.btn('Supprimer', () => { if (gSel !== undefined) { st.groups.splice(gSel, 1); gSel = undefined; gDraw(); ps.markDirty(); } })));
      const save = () => {
        if (!need()) return false;
        let exp = null; if (!rNever.querySelector('input').checked) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(expTxt.value.trim()); if (!m) { desk.msg({ title: 'Propriétés de ' + u.name, icon: 'error', owner: ps.win, text: 'La date d’expiration est incorrecte (jj/mm/aaaa).' }); return false; } exp = m[3] + '-' + m[2] + '-' + m[1] + 'T23:59:59Z'; }
        const bef = JSON.stringify([u.name, u.desc, u.mustChange, u.pwdNeverExpires, u.enabled, u.expires, u.logonHours, u.allowedWorkstations, u.locked, groupsOfUser(u.sam).map(x => x.name)]);
        u.name = nm.value.trim() || u.name; u.desc = ds.value; u.mustChange = st.must; u.pwdNeverExpires = st.never; u.enabled = !st.dis;
        if (exp) u.expires = exp; else delete u.expires; if (st.hours) u.logonHours = st.hours; else delete u.logonHours; u.allowedWorkstations = st.ws.slice();
        if (st.unlock) { u.locked = false; u._bad = 0; }
        A.groups.forEach(gr => { const has = (gr.members || []).some(m => lc(m) === lc(u.sam)), want = st.groups.indexOf(gr.name) >= 0; if (want && !has) gr.members.push(u.sam); if (!want && has) gr.members = gr.members.filter(m => lc(m) !== lc(u.sam)); });
        if (bef !== JSON.stringify([u.name, u.desc, u.mustChange, u.pwdNeverExpires, u.enabled, u.expires, u.logonHours, u.allowedWorkstations, u.locked, groupsOfUser(u.sam).map(x => x.name)])) changed('AD : propriétés du compte ' + u.sam + ' modifiées');
        return true;
      };
      const ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + u.name, icon: 'user', w: 480, h: 540, tabs: [{ label: 'Général', content: () => general }, { label: 'Compte', content: () => account }, { label: 'Membre de', content: () => memberOf }], onOk: save, onApply: save }); ps.win = ps;
    };
    const groupProps = r => {
      const gp = r.obj; const members = (gp.members || []).slice(); const box = h('div.dlist.tall'); let sel; const draw = () => { UI.clear(box); members.forEach((m, i) => { const x = ad.resolve(W, A, m); box.append(h('div.dli' + (i === sel ? '.sel' : ''), { on: { click: () => { sel = i; draw(); } } }, (x ? x.label : m) + '  —  ' + A.domain + (x && x.obj && x.obj.ou ? '/' + ad.rdnLabel(x.obj.ou) : ''))); }); }; draw();
      const general = h('div.pad', UI.w.field('Nom du groupe :', h('span', gp.name), { lw: 150 }), UI.w.field('Étendue du groupe :', h('span', { Global: 'Globale', DomainLocal: 'Domaine local', Universal: 'Universelle' }[gp.scope] || gp.scope), { lw: 150 }), UI.w.field('Type de groupe :', h('span', 'Sécurité'), { lw: 150 }));
      const mem = h('div.pad', h('div', 'Membres :'), box, h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } }, UI.w.btn('Ajouter…', () => ad.pick(desk, ps, t, { onOk: res => { res.forEach(x => { if (members.indexOf(x.member) < 0) members.push(x.member); }); draw(); ps.markDirty(); } })), UI.w.btn('Supprimer', () => { if (sel !== undefined) { members.splice(sel, 1); sel = undefined; draw(); ps.markDirty(); } })));
      const save = () => { if (!need()) return false; if (JSON.stringify(members) !== JSON.stringify(gp.members || [])) { gp.members = members.slice(); changed('AD : membres du groupe ' + gp.name + ' modifiés (' + members.length + ')'); } return true; };
      const ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + gp.name, icon: 'users', w: 460, h: 440, tabs: [{ label: 'Général', content: () => general }, { label: 'Membres', content: () => mem }], onOk: save, onApply: save }); ps.owner = win;
    };
    const compProps = r => { const c = r.obj; UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + c.name, icon: 'pc', w: 440, h: 380, tabs: [{ label: 'Général', content: () => h('div.pad', UI.w.field('Nom de l’ordinateur (antérieur à Windows 2000) :', h('span', c.name.toUpperCase()), { lw: 260 }), UI.w.field('Nom DNS :', h('span', c.name.toLowerCase() + '.' + A.domain), { lw: 260 }), UI.w.field('Rôle de l’ordinateur :', h('span', c.dc ? 'Contrôleur de domaine' : 'Station de travail ou serveur'), { lw: 260 })) }], okOnly: true }); };
    const props = r => { if (r.kind === 'user') userProps(r); else if (r.kind === 'group') groupProps(r); else if (r.kind === 'computer') compProps(r); else if (r.kind === 'ou') ouProps(r); };
    const ouProps = r => { UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + r.name, icon: 'ou', w: 400, h: 340, tabs: [{ label: 'Général', content: () => h('div.pad', UI.w.field('Nom :', h('span', r.name), { lw: 120 }), UI.w.field('Chemin :', h('span', r.dn), { lw: 120 })) }], okOnly: true }); };

    /* --- nouveaux objets --- */
    const container = () => { const dn = curDn; return (dn === rootDn || /^OU=/i.test(dn) || /^CN=(Users|Computers)/i.test(dn)) ? dn : null; };
    const newUser = () => {
      if (!need()) return; const cdn = container(); if (!cdn) return;
      const fn = UI.w.text('', { w: 200 }), ln = UI.w.text('', { w: 200 }), full = UI.w.text('', { w: 260 }), sam = UI.w.text('', { w: 140 }); const p1 = UI.w.text('', { password: true, w: 220 }), p2 = UI.w.text('', { password: true, w: 220 });
      const must = UI.w.check('L’utilisateur doit changer le mot de passe à la prochaine ouverture de session', true), never = UI.w.check('Le mot de passe n’expire jamais', false), dis = UI.w.check('Compte désactivé', false); const err = h('div', { style: { color: '#b00020', minHeight: '32px' } });
      const upd = () => { full.value = (fn.value + ' ' + ln.value).trim(); }; fn.addEventListener('input', upd); ln.addEventListener('input', upd);
      let page = 1; const host = h('div'); const draw = () => { UI.clear(host); if (page === 1) host.append(UI.w.field('Prénom :', fn, { lw: 200 }), UI.w.field('Nom :', ln, { lw: 200 }), UI.w.field('Nom complet :', full, { lw: 200 }), UI.w.field('Nom d’ouverture de session de l’utilisateur :', h('span', sam, ' @' + A.domain), { lw: 200 })); else host.append(UI.w.field('Mot de passe :', p1, { lw: 200 }), UI.w.field('Confirmer le mot de passe :', p2, { lw: 200 }), must, never, dis); host.append(err); };
      draw(); let dlg;
      dlg = UI.dialog(desk, win, { title: 'Nouvel objet - Utilisateur', w: 560, h: 360, body: h('div', h('div', { style: { margin: '2px 0 8px' } }, 'Créer dans : ' + A.domain + '/' + (cdn === rootDn ? '' : ad.rdnLabel(cdn))), host), buttons: [{ label: '< Précédent', fn: () => { if (page > 1) { page = 1; draw(); } return false; } }, { label: 'Suivant >', def: true, fn: () => {
        if (page === 1) { if (!full.value.trim() || !sam.value.trim()) { err.textContent = 'Entrez le nom complet et le nom d’ouverture de session.'; return false; } if (AD.userOf(A, sam.value.trim())) { err.textContent = 'Le nom d’ouverture de session de l’utilisateur spécifié est déjà utilisé. Choisissez-en un autre.'; return false; } err.textContent = ''; page = 2; draw(); dlg.bar.children[1].textContent = 'Terminer'; return false; }
        if (p1.value !== p2.value) { err.textContent = 'Les mots de passe ne correspondent pas.'; return false; }
        if (!ad.pwdOk(AD.passwordPolicy(W, A), p1.value)) { err.textContent = ad.PWD_ERR; return false; }
        A.users.push({ sam: sam.value.trim(), name: full.value.trim(), ou: cdn, enabled: !dis.querySelector('input').checked, pwd: p1.value, pwdSetDays: -W.clock.elapsed / 86400, pwdNeverExpires: never.querySelector('input').checked, mustChange: must.querySelector('input').checked && !never.querySelector('input').checked, _bad: 0 });
        changed('AD : utilisateur ' + sam.value.trim() + ' créé dans ' + cdn); } }, { label: 'Annuler' }] });
    };
    const newGroup = () => {
      if (!need()) return; const cdn = container(); if (!cdn) return; const nm = UI.w.text('', { w: 260 }); let scope = 'Global'; const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: 'Nouvel objet - Groupe', w: 480, h: 340, body: h('div', UI.w.field('Nom du groupe :', nm, { lw: 130 }), UI.w.group('Étendue du groupe', UI.w.radio('sc', 'Domaine local', false, () => { scope = 'DomainLocal'; }), UI.w.radio('sc', 'Globale', true, () => { scope = 'Global'; }), UI.w.radio('sc', 'Universelle', false, () => { scope = 'Universal'; })), UI.w.group('Type de groupe', UI.w.radio('ty', 'Sécurité', true, () => { }), UI.w.radio('ty', 'Distribution', false, () => { }, { disabled: true })), err),
        buttons: [{ label: 'OK', def: true, fn: () => { const n = nm.value.trim(); if (!n) { err.textContent = 'Entrez un nom de groupe.'; return false; } if (A.groups.some(x => lc(x.name) === lc(n))) { err.textContent = 'Le nom spécifié existe déjà.'; return false; } A.groups.push({ name: n, scope, ou: cdn, members: [] }); changed('AD : groupe ' + n + ' créé (' + scope + ') dans ' + cdn); } }, { label: 'Annuler' }] });
    };
    const newOU = () => {
      if (!need()) return; const cdn = container(); if (!cdn || /^CN=/i.test(cdn)) { desk.msg({ title: 'Active Directory', icon: 'error', owner: win, text: 'Impossible de créer une unité d’organisation dans ce conteneur.' }); return; } const nm = UI.w.text('', { w: 260 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: 'Nouvel objet - Unité d’organisation', w: 440, h: 220, body: h('div', UI.w.field('Nom :', nm, { lw: 100 }), UI.w.check('Protéger le conteneur contre une suppression accidentelle', true), err), buttons: [{ label: 'OK', def: true, fn: () => { const n = nm.value.trim(); if (!n) { err.textContent = 'Entrez un nom.'; return false; } const dn = 'OU=' + n + ',' + cdn; if ((A.ous || []).some(x => lc(x.dn) === lc(dn))) { err.textContent = 'Le nom spécifié existe déjà.'; return false; } A.ous.push({ dn, block: false }); changed('AD : unité d’organisation ' + dn + ' créée'); } }, { label: 'Annuler' }] });
    };
    const findDlg = () => {
      const q = UI.w.text('', { w: 240 }); const res = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 200 }, { key: 'type', label: 'Type', w: 180 }, { key: 'loc', label: 'Dossier', w: 180 }], rows: [], onOpen: r => props(r) }); res.el.style.height = '200px';
      UI.dialog(desk, win, { title: 'Rechercher des utilisateurs, des contacts et des groupes', w: 640, h: 440, body: h('div', UI.w.field('Nom :', q, { lw: 80 }), UI.w.btn('Rechercher', () => { const s = lc(q.value); const rows = []; [['user', A.users], ['group', A.groups], ['computer', A.computers]].forEach(([k, arr]) => arr.forEach(o => { if (!s || lc(o.name).indexOf(s) >= 0 || (o.sam && lc(o.sam).indexOf(s) >= 0)) rows.push({ kind: k, name: o.name, obj: o, type: typeOf({ kind: k, obj: o }), loc: A.domain + '/' + ad.rdnLabel(o.ou || rootDn) }); })); res.setRows(rows); }), res.el), buttons: [{ label: 'Fermer' }] });
    };

    /* --- menus --- */
    const ctxOf = r => {
      if (r.kind === 'user') return [{ label: 'Copier…', disabled: true }, { label: 'Ajouter à un groupe…', fn: () => ad.pick(desk, win, t, { kinds: ['group'], title: 'Sélectionner des groupes', onOk: res => { if (!need()) return; res.forEach(x => { if (x.obj.members.indexOf(r.obj.sam) < 0) x.obj.members.push(r.obj.sam); }); changed('AD : ' + r.obj.sam + ' ajouté au groupe ' + res.map(x => x.obj.name).join(', ')); } }) }, { label: r.obj.enabled === false ? 'Activer le compte' : 'Désactiver le compte', fn: () => setEnabled(r, r.obj.enabled === false) }, { label: 'Réinitialiser le mot de passe…', fn: () => resetPwdDlg(r) }, { label: 'Déplacer…', fn: () => moveObj(r) }, '-', { label: 'Couper', disabled: true }, { label: 'Supprimer', fn: () => delObj(r) }, { label: 'Renommer', disabled: true }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }, { label: 'Aide', disabled: true }];
      if (r.kind === 'computer') return [{ label: 'Ajouter à un groupe…', fn: () => ad.pick(desk, win, t, { kinds: ['group'], title: 'Sélectionner des groupes', onOk: res => { if (!need()) return; res.forEach(x => { const m = r.obj.name + '$'; if (x.obj.members.indexOf(m) < 0) x.obj.members.push(m); }); changed('AD : ' + r.obj.name + ' ajouté au groupe ' + res.map(x => x.obj.name).join(', ')); } }) }, { label: r.obj.enabled === false ? 'Activer le compte' : 'Désactiver le compte', fn: () => setEnabled(r, r.obj.enabled === false) }, { label: 'Réinitialiser le compte', disabled: true }, { label: 'Déplacer…', fn: () => moveObj(r) }, '-', { label: 'Supprimer', fn: () => delObj(r) }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }];
      if (r.kind === 'group') return [{ label: 'Ajouter à un groupe…', disabled: true }, { label: 'Déplacer…', fn: () => moveObj(r) }, '-', { label: 'Supprimer', fn: () => delObj(r) }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }];
      return [{ label: 'Supprimer', fn: () => delObj(r) }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }];
    };
    const newItems = () => [{ label: 'Ordinateur', disabled: true }, { label: 'Contact', disabled: true }, { label: 'Groupe', fn: newGroup }, { label: 'Unité d’organisation', fn: newOU }, { label: 'Utilisateur', fn: newUser }];
    const emptyCtx = e => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Nouveau', items: newItems() }, '-', { label: 'Actualiser', fn: refresh }]);
    const acts = r => {
      const sec = [{ title: curDn === rootDn ? A.domain : ad.rdnLabel(curDn), items: [{ label: 'Nouveau', items: newItems() }, { label: 'Rechercher…', fn: findDlg }, { label: 'Actualiser', fn: refresh }] }];
      if (r) sec.push({ title: r.name, items: ctxOf(r).filter(x => x !== '-' && !x.disabled) });
      return sec;
    };
    const show = (n) => {
      curDn = n.key; if (n.key === 'root' || n.key === 'saved') { api.setMid(UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 400 }], rows: n.key === 'root' ? [{ name: 'Requêtes enregistrées' }, { name: A.domain }] : [] }).el); api.setActions([{ title: n.label, items: [{ label: 'Actualiser', fn: refresh }] }]); return; }
      lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 240, icon: iconOf }, { key: 'type', label: 'Type', w: 220, fmt: r => typeOf(r), sortVal: r => typeOf(r) }, { key: 'desc', label: 'Description', w: 300 }], rows: rowsOf(curDn), key: r => r.kind + ':' + r.name, sort: { key: 'name' }, onOpen: r => { if (r.kind === 'ou' || r.kind === 'cn') api.tree.select(r.dn, true); else props(r); }, onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, ctxOf(r)), onContextEmpty: emptyCtx, onSelect: r => api.setActions(acts(r)), onDelete: r => delObj(r), onRefresh: refresh });
      api.setMid(lv.el); api.setActions(acts(null));
    };
    function refresh() { api.tree.setRoots(roots()); const s = api.tree.selected(); if (s) show(s); }
    const menu = [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: () => acts(lv && lv.selected && lv.selected()).reduce((a, s) => a.concat(s.items), []) }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos', disabled: true }] }];
    win = UI.w.mmc({ wm: desk.wm, title: 'Utilisateurs et ordinateurs Active Directory', icon: 'users', w: 1000, h: 580, menu, roots: roots(), select: rootDn, onSelect: (n, a) => { api = a; show(n); }, onRefresh: refresh, onTreeContext: n => (n.key === 'root' || n.key === 'saved' ? [{ label: 'Actualiser', fn: refresh }] : [{ label: 'Nouveau', items: newItems() }, { label: 'Rechercher…', fn: findDlg }, '-', { label: 'Actualiser', fn: refresh }]) });
    api = win.mmc; win.appId = 'aduc'; desk.act('Ouverture de Utilisateurs et ordinateurs Active Directory (' + A.domain + ')', { kind: 'ui' });
    return win;
  }
});

/* ------------------------------------------------------------------ Domaines et approbations */
UI.app('domain', {
  title: 'Domaines et approbations Active Directory', icon: 'network', admin: true, single: true,
  open: (desk) => {
    const t = ad.target(desk); if (t.err) { desk.msg({ title: 'Domaines et approbations Active Directory', icon: 'error', text: t.err }); return null; }
    const A = t.A; const W = desk.W; let win, api;
    const changed = (txt) => { desk.env.touch('trust'); desk.change(txt, { dev: t.dev.id }); refresh(); };
    const need = () => { if (!ad.canWrite(desk, t)) { ad.denied(desk, win); return false; } return true; };
    const dirTxt = d => (d === 'bidirectional' ? 'Bidirectionnelle' : d === 'inbound' ? 'Entrante' : 'Sortante');
    const typeTxt = r => (r.type === 'forest' ? 'Forêt' : 'Externe');
    const trusts = () => (A.trusts || []).slice();
    const validate = (tr) => {
      const other = AD.byDomain(W, tr.target); const remote = other && (other.win.ad.trusts || []).find(x => lc(x.target) === lc(A.domain));
      const ok = tr.state === 'ok' && !!remote && remote.state === 'ok' && !!other;
      desk.msg({ title: 'Domaines et approbations Active Directory', icon: ok ? 'info' : 'error', owner: win, text: ok ? 'L’approbation sortante a été validée. Elle est active.' : 'La relation d’approbation entre ce domaine principal et le domaine approuvé a échoué.\n' + (remote ? '' : 'L’approbation n’existe pas dans le domaine ' + tr.target + '.') });
      desk.act('Validation de l’approbation avec ' + tr.target + ' : ' + (ok ? 'valide' : 'échec'), { kind: 'ui' });
    };
    const removeTrust = (tr) => { if (!need()) return; UI.confirm(desk, win, { title: 'Active Directory', text: 'Voulez-vous vraiment supprimer l’approbation avec le domaine ' + tr.target + ' ?\nLes utilisateurs de ce domaine ne pourront plus accéder aux ressources de l’autre domaine.', onYes: () => { A.trusts = A.trusts.filter(x => x !== tr); changed('AD : approbation avec ' + tr.target + ' supprimée'); } }); };
    const trustProps = (tr) => {
      const gen = h('div.pad', UI.w.field('Ce domaine :', h('span', A.domain), { lw: 160 }), UI.w.field('Autre domaine :', h('span', tr.target), { lw: 160 }), UI.w.field('Type d’approbation :', h('span', typeTxt(tr)), { lw: 160 }), UI.w.field('Direction :', h('span', dirTxt(tr.direction)), { lw: 160 }), UI.w.field('Transitive :', h('span', tr.transitive ? 'Oui' : 'Non'), { lw: 160 }), h('div', { style: { margin: '10px 0' } }, UI.w.btn('Valider', () => validate(tr))));
      UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + tr.target, icon: 'network', w: 460, h: 380, tabs: [{ label: 'Général', content: () => gen }], okOnly: true });
    };
    const newTrust = () => {
      if (!need()) return; const nm = UI.w.text('', { w: 240 }), us = UI.w.text('', { w: 200 }), pw = UI.w.text('', { password: true, w: 200 }); let dir = 'bidirectional'; const err = h('div', { style: { color: '#b00020', minHeight: '32px' } });
      UI.dialog(desk, win, { title: 'Assistant Nouvelle approbation', w: 560, h: 470, body: h('div', UI.w.field('Nom du domaine :', nm, { lw: 190 }), UI.w.group('Direction de l’approbation', UI.w.radio('dr', 'Bidirectionnelle', true, () => { dir = 'bidirectional'; }), UI.w.radio('dr', 'Unidirectionnelle : entrante', false, () => { dir = 'inbound'; }), UI.w.radio('dr', 'Unidirectionnelle : sortante', false, () => { dir = 'outbound'; })), h('div.muted', { style: { margin: '6px 0' } }, 'Type : approbation externe. Créée des deux côtés avec les informations d’identification d’un administrateur de l’autre domaine.'), UI.w.field('Nom d’utilisateur de l’autre domaine :', us, { lw: 190 }), UI.w.field('Mot de passe :', pw, { lw: 190 }), err),
        buttons: [{ label: 'Terminer', def: true, fn: () => {
          const dn = nm.value.trim().toLowerCase(); const other = AD.byDomain(W, dn);
          if (!other || lc(dn) === lc(A.domain)) { err.textContent = 'Le domaine spécifié est introuvable. Vérifiez son nom ou la configuration DNS.'; return false; }
          if ((A.trusts || []).some(x => lc(x.target) === dn)) { err.textContent = 'Une approbation existe déjà avec ce domaine.'; return false; }
          const ip = Object.keys(other.ifaces || {}).map(k => other.ifaces[k].ip).filter(Boolean)[0]; const c = N.connect(W, t.dev.id, ip, 'tcp', 389); if (c.state !== 'open') { err.textContent = 'Le contrôleur de domaine du domaine ' + dn + ' est inaccessible (port 389).'; return false; }
          const un = us.value.trim().replace(/^.*\\/, ''); const usr = AD.userOf(other.win.ad, un); const okTok = usr && usr.pwd === pw.value && usr.enabled !== false && AD.token(W, other.win.ad.domain, usr.sam).has('builtin\\administrateurs');
          if (!okTok) { err.textContent = 'Les informations d’identification fournies ne sont pas valides ou ne disposent pas des droits d’administrateur dans le domaine ' + dn + '.'; return false; }
          const inv = { bidirectional: 'bidirectional', inbound: 'outbound', outbound: 'inbound' }[dir];
          A.trusts = A.trusts || []; A.trusts.push({ target: dn, direction: dir, type: 'external', transitive: false, state: 'ok' });
          const rt = other.win.ad.trusts = other.win.ad.trusts || []; const ex = rt.find(x => lc(x.target) === lc(A.domain)); if (ex) { ex.state = 'ok'; ex.direction = inv; } else rt.push({ target: A.domain, direction: inv, type: 'external', transitive: false, state: 'ok' });
          changed('AD : approbation créée avec ' + dn + ' (' + dir + ')'); } }, { label: 'Annuler' }] });
    };
    const domProps = () => {
      const lvT = UI.w.listView({ columns: [{ key: 'target', label: 'Nom de domaine', w: 170 }, { key: 'type', label: 'Type d’approbation', w: 130, fmt: typeTxt }, { key: 'trans', label: 'Transitive', w: 80, fmt: r => (r.transitive ? 'Oui' : 'Non') }, { key: 'direction', label: 'Direction', w: 110, fmt: r => dirTxt(r.direction) }], rows: trusts(), key: r => r.target, onOpen: r => trustProps(r) }); lvT.el.style.height = '160px';
      const bar = h('div', { style: { display: 'flex', gap: '8px', margin: '8px 0' } }, UI.w.btn('Nouvelle approbation…', newTrust), UI.w.btn('Supprimer', () => { const r = lvT.selected(); if (r) removeTrust(r); }), UI.w.btn('Propriétés…', () => { const r = lvT.selected(); if (r) trustProps(r); }));
      const body = h('div.pad', h('div', 'Domaines approuvés par ce domaine ou qui approuvent ce domaine :'), lvT.el, bar);
      const ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + A.domain, icon: 'network', w: 560, h: 440, tabs: [{ label: 'Général', content: () => h('div.pad', UI.w.field('Nom de domaine (antérieur à Windows 2000) :', h('span', A.netbios), { lw: 250 }), UI.w.field('Description :', h('span', ''), { lw: 250 })) }, { label: 'Approbations', content: () => body }, { label: 'Géré par', content: () => h('div.pad.muted', 'Non simulé.') }], okOnly: true, start: 1 });
      ps.refreshTrusts = () => lvT.setRows(trusts());
      return ps;
    };
    const roots = () => [{ key: 'root', label: 'Domaines et approbations Active Directory [' + W_.fqdn(t.dev) + ']', icon: 'network', expanded: true, children: [{ key: 'dom', label: A.domain, icon: 'network' }] }];
    const show = (n) => {
      if (n.key === 'dom') { api.setMid(UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 300 }, { key: 'dir', label: 'Direction', w: 120 }], rows: trusts().map(x => ({ name: x.target, dir: dirTxt(x.direction) })) }).el); api.setActions([{ title: A.domain, items: [{ label: 'Propriétés', fn: domProps }, { label: 'Actualiser', fn: refresh }] }]); }
      else { api.setMid(UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 300 }], rows: [{ name: A.domain }] }).el); api.setActions([{ title: 'Domaines et approbations Active Directory', items: [{ label: 'Actualiser', fn: refresh }] }]); }
    };
    function refresh() { api.tree.setRoots(roots()); const s = api.tree.selected(); if (s) show(s); }
    win = UI.w.mmc({ wm: desk.wm, title: 'Domaines et approbations Active Directory', icon: 'network', w: 880, h: 480, menu: [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: [{ label: 'Propriétés', fn: domProps }, { label: 'Actualiser', fn: refresh }] }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos', disabled: true }] }], roots: roots(), select: 'dom', onSelect: (n, a) => { api = a; show(n); }, onRefresh: refresh, onTreeContext: n => (n.key === 'dom' ? [{ label: 'Propriétés', fn: domProps }] : []) });
    api = win.mmc; win.appId = 'domain'; desk.act('Ouverture de Domaines et approbations Active Directory', { kind: 'ui' });
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
