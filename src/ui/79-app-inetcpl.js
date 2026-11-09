/* ============================================================================
   Options Internet (inetcpl.cpl) : feuille « Propriétés de : Internet », onglet Connexions →
   « Paramètres réseau » (Paramètres du réseau local) → « Avancé » (Paramètres du proxy, exceptions).
   Écrit dans d.proxy, lu par le navigateur du poste (WEB.fetch) : {enabled, server, port, bypassLocal,
   exceptions[], secure?}. Les autres onglets existent mais ne sont pas reproduits.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h;
SIM.AVREG['inetcpl-gui'] = 'Options Internet (inetcpl.cpl) : onglets de la feuille « Propriétés de : Internet », libellés du bouton « Paramètres réseau », de la fenêtre « Paramètres du réseau local (LAN) » (cases « Utiliser un serveur proxy pour votre réseau local », « Ne pas utiliser de serveur proxy pour les adresses locales », champs Adresse / Port) et de « Paramètres du proxy » (Exceptions) : repris de la fiche de TP quand elle les cite, le reste reconstitué ; les onglets autres que Connexions ne sont pas reproduits.';

const proxyOf = d => d.proxy || (d.proxy = { enabled: false, server: '', port: 80, bypassLocal: false, exceptions: [] });
const chkEl = lab => lab.querySelector('input');

UI.app('inetcpl', {
  title: 'Propriétés de : Internet', icon: 'globe', single: true,
  open: (desk) => {
    const d = desk.d; let sheet;
    const conn = h('div.pad',
      UI.w.group('Configuration', h('div.muted', { style: { margin: '4px 0 8px' } }, 'Pour configurer une connexion Internet, cliquez sur Installation.'), UI.w.btn('Installation', () => { }, { disabled: true })),
      UI.w.group('Paramètres d’accès à distance et de réseau privé virtuel', h('div', { style: { height: '70px', border: '1px solid #aaa', margin: '4px 0 6px', background: '#fff' } }), h('div', { style: { display: 'flex', gap: '6px' } }, UI.w.btn('Ajouter…', () => { }, { disabled: true }), UI.w.btn('Supprimer…', () => { }, { disabled: true }), UI.w.btn('Paramètres', () => { }, { disabled: true }))),
      UI.w.group('Paramètres du réseau local (LAN)', h('div.muted', { style: { margin: '4px 0 8px' } }, 'Les paramètres du réseau local ne s’appliquent pas aux connexions d’accès à distance. Choisissez Paramètres ci-dessus pour les configurations d’accès à distance.'), h('div', { style: { textAlign: 'right' } }, UI.w.btn('Paramètres réseau', () => lanSettings(desk, sheet)))));
    const na = t => h('div.pad', h('div.muted', 'L’onglet « ' + t + ' » existe dans la vraie fenêtre mais n’est pas reproduit dans ce simulateur.'));
    sheet = UI.w.propertySheet({ wm: desk.wm, title: 'Propriétés de : Internet', icon: 'globe', w: 440, h: 540, start: 4,
      tabs: [{ label: 'Général', content: () => na('Général') }, { label: 'Sécurité', content: () => na('Sécurité') }, { label: 'Confidentialité', content: () => na('Confidentialité') }, { label: 'Contenu', content: () => na('Contenu') }, { label: 'Connexions', content: () => conn }, { label: 'Programmes', content: () => na('Programmes') }, { label: 'Avancé', content: () => na('Avancé') }],
      onOk: () => true });
    sheet.appId = 'inetcpl'; return sheet;
  }
});

/* Paramètres du réseau local (LAN) */
function lanSettings(desk, owner) {
  const d = desk.d; const p = proxyOf(d);
  const st = { enabled: !!p.enabled, server: p.server || '', port: p.port || '', bypassLocal: !!p.bypassLocal, exceptions: (p.exceptions || []).slice(), secure: p.secure ? Object.assign({}, p.secure) : null };
  const useProxy = UI.w.check('Utiliser un serveur proxy pour votre réseau local (ces paramètres ne s’appliqueront pas aux connexions d’accès à distance ou VPN)', st.enabled, v => { st.enabled = v; sync(); });
  const addr = UI.w.text(st.server, { w: 150, onchange: v => { st.server = v.trim(); } });
  const port = UI.w.text(st.port, { w: 56, onchange: v => { st.port = v.trim(); } });
  const bypass = UI.w.check('Ne pas utiliser de serveur proxy pour les adresses locales', st.bypassLocal, v => { st.bypassLocal = v; });
  const adv = UI.w.btn('Avancé', () => advancedDlg(desk, win, st, () => { addr.value = st.server; port.value = st.port; }), {});
  const sync = () => { [addr, port, adv, chkEl(bypass)].forEach(x => { x.disabled = !st.enabled; }); };
  const body = h('div.pad',
    UI.w.group('Configuration automatique', h('div.muted', { style: { margin: '4px 0' } }, 'La configuration automatique peut remplacer les paramètres manuels. Pour garantir l’utilisation de ces derniers, désactivez la configuration automatique.'),
      UI.w.check('Détecter automatiquement les paramètres de connexion', true, () => { }, { disabled: true }), UI.w.check('Utiliser un script de configuration automatique', false, () => { }, { disabled: true }), UI.w.field('Adresse :', UI.w.text('', { w: 220, disabled: true }), { lw: 70 })),
    UI.w.group('Serveur proxy', useProxy, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0 8px 22px' } }, h('label', 'Adresse :'), addr, h('label', 'Port :'), port, adv), h('div', { style: { marginLeft: '22px' } }, bypass)),
    h('div.mbbtns', UI.w.btn('OK', () => commit(), { def: true }), UI.w.btn('Annuler', () => win.close(true))));
  const commit = () => {
    if (st.enabled) {
      const pn = Number(st.port);
      if (!st.server) { desk.msg({ title: 'Paramètres du réseau local (LAN)', icon: 'error', owner: win, text: 'Entrez l’adresse du serveur proxy.' }); return; }
      if (!(pn >= 1 && pn <= 65535)) { desk.msg({ title: 'Paramètres du réseau local (LAN)', icon: 'error', owner: win, text: 'Le port du serveur proxy doit être un nombre compris entre 1 et 65535.' }); return; }
    }
    const before = JSON.stringify(p);
    p.enabled = st.enabled; p.server = st.server; p.port = Number(st.port) || 80; p.bypassLocal = st.bypassLocal; p.exceptions = st.exceptions;
    if (st.secure && st.secure.server) p.secure = { server: st.secure.server, port: Number(st.secure.port) || 80 }; else delete p.secure;
    if (before !== JSON.stringify(p)) {
      desk.env.advance(3); desk.env.touch('client-proxy');
      desk.change('Options Internet de ' + d.name + ' : proxy ' + (p.enabled ? p.server + ':' + p.port + (p.exceptions.length ? ' (exceptions : ' + p.exceptions.join(';') + ')' : '') : 'désactivé'), { dev: desk.devId });
    }
    win.close(true);
  };
  const win = desk.wm.open({ title: 'Paramètres du réseau local (LAN)', icon: 'globe', w: 460, h: 440, owner, resizable: false, minimizable: false, maximizable: false, body: () => body });
  sync(); return win;
}

/* Paramètres du proxy (Avancé) : adresses par protocole + exceptions */
function advancedDlg(desk, owner, st, after) {
  const same = !st.secure || !st.secure.server;
  const rows = {};
  const mk = (label, key, disabled) => { const a = UI.w.text(key === 'http' ? st.server : (st.secure ? st.secure.server : ''), { w: 150, disabled }); const pt = UI.w.text(key === 'http' ? st.port : (st.secure ? st.secure.port : ''), { w: 50, disabled }); rows[key] = { a, pt }; return h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0' } }, h('label', { style: { width: '70px' } }, label + ' :'), a, h('label', ':'), pt); };
  const useSame = UI.w.check('Utiliser le même serveur proxy pour tous les protocoles', same, v => { rows.https.a.disabled = v; rows.https.pt.disabled = v; if (v) { rows.https.a.value = rows.http.a.value; rows.https.pt.value = rows.http.pt.value; } });
  const http = mk('HTTP', 'http', false); const https = mk('Sécurisé', 'https', same);
  if (same) { rows.https.a.value = st.server; rows.https.pt.value = st.port; }
  const ftp = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0' } }, h('label', { style: { width: '70px' } }, 'FTP :'), UI.w.text('', { w: 150, disabled: true }), h('label', ':'), UI.w.text('', { w: 50, disabled: true }));
  const socks = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0' } }, h('label', { style: { width: '70px' } }, 'Socks :'), UI.w.text('', { w: 150, disabled: true }), h('label', ':'), UI.w.text('', { w: 50, disabled: true }));
  const exc = h('textarea.w10in', { style: { width: '100%', height: '70px' }, spellcheck: false }); exc.value = st.exceptions.join(';');
  const body = h('div.pad', UI.w.group('Serveurs', h('div.muted', { style: { margin: '2px 0' } }, 'Type : Adresse du proxy à utiliser : Port'), http, https, ftp, socks, useSame),
    UI.w.group('Exceptions', h('div', { style: { margin: '4px 0' } }, 'Ne pas utiliser de serveur proxy pour les adresses commençant par :'), exc, h('div.muted', { style: { marginTop: '4px' } }, 'Utilisez des points-virgules (;) pour séparer les entrées.')),
    h('div.mbbtns', UI.w.btn('OK', () => {
      st.server = rows.http.a.value.trim(); st.port = rows.http.pt.value.trim();
      st.secure = chkEl(useSame).checked ? null : { server: rows.https.a.value.trim(), port: rows.https.pt.value.trim() };
      st.exceptions = exc.value.split(/[;\n]/).map(x => x.trim()).filter(Boolean);
      if (after) after();
      win.close(true);
    }, { def: true }), UI.w.btn('Annuler', () => win.close(true))));
  const win = desk.wm.open({ title: 'Paramètres du proxy', icon: 'globe', w: 420, h: 470, owner, resizable: false, minimizable: false, maximizable: false, body: () => body });
  return win;
}
})(typeof globalThis !== 'undefined' ? globalThis : window);
