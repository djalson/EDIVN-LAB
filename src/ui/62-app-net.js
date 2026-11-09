/* ============================================================================
   Connexions réseau (ncpa.cpl) : liste des cartes, statut, détails, propriétés de la carte,
   propriétés du protocole Internet version 4 (adresse statique / DHCP, DNS), activation / désactivation.
   Écrit dans le même modèle que netsh et ipconfig (d.ifaces.*).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, E = SIM.emu, N = SIM.net, h = UI.h, W_ = E.win;
SIM.AVREG['ncpa-gui'] = 'Connexions réseau (ncpa.cpl) : barre d’outils, libellés d’état, boîtes « État », « Détails de connexion réseau », « Propriétés de Ethernet » (liste des composants) et « Propriétés de Protocole Internet version 4 (TCP/IPv4) » reconstitués de mémoire (français) ; le bouton « Diagnostiquer » n’est pas simulé (ses messages ne sont pas vérifiés).';
SIM.AVREG['ncpa-ipv4-validation'] = 'Propriétés TCP/IPv4 : Windows peut avertir lorsque la passerelle n’appartient pas au sous-réseau défini ; le simulateur accepte la saisie sans avertissement (texte exact non vérifié). C’est volontairement plus permissif que la réalité.';
const pad = U.pad2;

const COMPONENTS = [
  ['Client pour les réseaux Microsoft', 'Autorise votre ordinateur à accéder aux ressources d’un réseau Microsoft.'],
  ['Partage de fichiers et imprimantes Réseaux Microsoft', 'Permet à d’autres ordinateurs d’accéder aux ressources de votre ordinateur sur un réseau Microsoft.'],
  ['Planificateur de paquets QoS', 'Fournit la qualité de service (QoS) sur le réseau.'],
  ['Protocole Internet version 4 (TCP/IPv4)', 'Protocole TCP/IP par défaut pour les réseaux étendus, qui permet la communication entre différents réseaux interconnectés.'],
  ['Protocole de multiplexage de carte réseau Microsoft', ''],
  ['Pilote de protocole LLDP Microsoft', ''],
  ['Protocole Internet version 6 (TCP/IPv6)', 'Dernière version du protocole Internet qui permet la communication entre différents réseaux interconnectés.'],
  ['Répondeur de découverte de couche de liaison', ''],
  ['Pilote d’E/S du mappage de découverte de la topologie de couche de liaison', '']
];

function ifaceState(W, d, n) {
  const i = d.ifaces[n]; if (i.adminDown) return { label: 'Désactivé', icon: 'down' };
  if (!N.linkUp(W, d, n)) return { label: 'Câble réseau non connecté', icon: 'down' };
  const cfg = N.effCfg(d, n); const ns = UI.netState(W, d);
  if (!cfg || !cfg.ip || cfg.ip === '0.0.0.0' || cfg.mode === 'apipa') return { label: 'Réseau non identifié', icon: 'warn' };
  return { label: (d.win.domain || ns.label), icon: ns.k === 'ok' ? 'ok' : 'warn' };
}

UI.app('ncpa', {
  title: 'Connexions réseau', icon: 'network', admin: false, single: true,
  open: (desk) => {
    const W = desk.W, d = desk.d; let win, lv; let selected = null;
    const rows = () => W_.ifaceNames(d).map(n => ({ id: n, name: n, st: ifaceState(W, d, n) }));
    const refresh = () => { lv.setRows(rows(), true); tb(); };
    const toggle = (r) => { desk.uac('Connexions réseau', el => { if (el) doToggle(r); }); };
    const doToggle = (r) => {
      const i = d.ifaces[r.name]; i.adminDown = !i.adminDown; if (!i.adminDown && i.dhcp) N.dhcpRenew(W, d.id, r.name);
      desk.env.advance(2); desk.change((i.adminDown ? 'Désactivation' : 'Activation') + ' de la carte ' + r.name, { dev: desk.devId, impact: i.adminDown ? 'nic-down' : undefined }); refresh();
    };
    const status = (r) => {
      const i = d.ifaces[r.name]; const up = N.linkUp(W, d, r.name); const cfg = N.effCfg(d, r.name);
      const ns = UI.netState(W, d); const v4 = !up ? 'Aucun accès réseau' : (ns.k === 'ok' ? 'Internet' : (ns.k === 'noinet' ? 'Aucun accès Internet' : 'Aucun accès réseau'));
      const el = Math.max(0, Math.floor(W.clock.elapsed)); const dur = pad(Math.floor(el / 3600) % 24) + ':' + pad(Math.floor(el / 60) % 60) + ':' + pad(el % 60);
      const gen = h('div.pad', UI.w.group('Connexion', UI.w.field('Connectivité IPv4 :', h('span', v4), { lw: 160 }), UI.w.field('Connectivité IPv6 :', h('span', 'Aucun accès réseau'), { lw: 160 }), UI.w.field('État du média :', h('span', up ? 'Activé' : 'Désactivé'), { lw: 160 }), UI.w.field('Durée :', h('span', up ? dur : '—'), { lw: 160 }), UI.w.field('Vitesse :', h('span', up ? (i.speed || '1 Gbit/s').replace('Gbit/s', 'Gbit/s') : ''), { lw: 160 }), h('div', { style: { marginTop: '8px' } }, UI.w.btn('Détails…', () => details(r)))),
        UI.w.group('Activité', h('div.muted', { style: { margin: '4px 0' } }, 'Envoyés — Reçus'), h('div', 'Octets : ' + (up ? (1000 + Math.floor(W.clock.elapsed * 311) % 99999).toLocaleString('fr-FR') : '0') + ' — ' + (up ? (2000 + Math.floor(W.clock.elapsed * 733) % 99999).toLocaleString('fr-FR') : '0'))),
        h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px' } }, UI.w.btn('Propriétés', () => { w2.close(true); props(r); }), UI.w.btn('Désactiver', () => { w2.close(true); toggle(r); }), UI.w.btn('Diagnostiquer', () => { }, { disabled: true })));
      let w2 = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'État de ' + r.name, icon: 'network', w: 400, h: 470, tabs: [{ label: 'Général', content: () => gen }], okOnly: true });
      desk.run.act(desk.devId, 'Affichage de l’état de la carte ' + r.name, { kind: 'ui' }); desk.env.obs('ipconfig:' + d.id + ':base', !!(cfg && cfg.ip && cfg.ip !== '0.0.0.0' && cfg.mode !== 'apipa'));
    };
    const details = (r) => {
      const i = d.ifaces[r.name]; const up = N.linkUp(W, d, r.name); const c = N.effCfg(d, r.name) || {};
      const row = (k, v) => ({ k, v });
      const ipv6 = 'fe80::' + U.hash8(d.id + r.name + 'v6').slice(0, 4) + ':' + U.hash8(r.name + d.id + 'v6').slice(0, 4) + ':' + U.hash8(d.id).slice(0, 4) + ':' + U.hash8(i.mac).slice(0, 4) + '%' + (6 + parseInt(U.hash8(d.id).slice(0, 1), 16) % 9);
      const data = [row('Suffixe DNS propre à la connexion', c.suffix || ''), row('Description', W_.nicDesc), row('Adresse physique', E.macDash(i.mac)), row('DHCP activé', i.dhcp ? 'Oui' : 'Non')];
      if (up && c.mode !== 'released') {
        if (c.mode === 'apipa') data.push(row('Adresse IPv4 de configuration automatique', c.ip), row('Masque de sous-réseau IPv4', c.mask));
        else {
          data.push(row('Adresse IPv4', c.ip), row('Masque de sous-réseau IPv4', c.mask));
          if (c.mode === 'dhcp' && c.lease) { const t0 = new Date(W.clock.base + (c.lease.t || 0) * 1000), t1 = new Date(t0.getTime() + (c.lease.leaseSec || 691200) * 1000); data.push(row('Bail obtenu', E.frDateTime(t0)), row('Bail expirant', E.frDateTime(t1))); }
          data.push(row('Passerelle par défaut IPv4', c.gw || ''));
          if (c.mode === 'dhcp') data.push(row('Serveur DHCP IPv4', c.server || ''));
          data.push(row('Serveurs DNS IPv4', (c.dns || []).join('\n')));
        }
        data.push(row('Serveur WINS IPv4', ''), row('NetBIOS sur TCP/IP activé', 'Oui'), row('Adresse IPv6 de liaison locale', ipv6), row('Passerelle par défaut IPv6', ''), row('Serveur DNS IPv6', ''));
      }
      const lvd = UI.w.listView({ columns: [{ key: 'k', label: 'Propriété', w: 230, sort: false }, { key: 'v', label: 'Valeur', w: 250, sort: false }], rows: data, key: x => x.k, empty: '' });
      const w3 = desk.wm.open({ title: 'Détails de connexion réseau', icon: 'network', w: 540, h: 460, owner: win, resizable: false, minimizable: false, maximizable: false, body: () => h('div.pad', h('div', 'Détails de connexion réseau :'), h('div', { style: { height: '300px', border: '1px solid #aaa', margin: '6px 0' } }, lvd.el), h('div.mbbtns', UI.w.btn('Fermer', () => w3.close(true), { def: true }))) });
      desk.env.obs('ipconfig:' + d.id + ':all', !!(up && c.ip && c.ip !== '0.0.0.0' && c.mode !== 'apipa'));
      desk.run.act(desk.devId, 'Affichage des détails de connexion de ' + r.name, { kind: 'ui' });
    };
    const props = (r) => {
      desk.uac('Connexions réseau', el => { if (el) open(); });
      function open() {
        const list = h('div.cmplist'); let sel = 3; const desc = h('div.cmpdesc');
        const paint = () => { UI.clear(list); COMPONENTS.forEach((c, i) => { list.append(h('div.cmpi' + (i === sel ? '.sel' : ''), { on: { click: () => { sel = i; paint(); descr(); }, dblclick: () => { if (i === 3) ipv4(r); } } }, h('input', { type: 'checkbox', checked: true, on: { click: e => e.stopPropagation() } }), h('span', c[0]))); }); };
        const descr = () => { UI.clear(desc); desc.append(h('div', { style: { fontWeight: 600 } }, 'Description'), h('div', COMPONENTS[sel][1])); };
        paint(); descr();
        const gen = h('div.pad', h('div', 'Connexion en utilisant :'), h('div.cmpnic', UI.icon('network', 18), W_.nicDesc), h('div', { style: { margin: '8px 0 4px' } }, 'Cette connexion utilise les éléments suivants :'), list,
          h('div', { style: { display: 'flex', gap: '6px', margin: '8px 0' } }, UI.w.btn('Installer…', () => { }, { disabled: true }), UI.w.btn('Désinstaller', () => { }, { disabled: true }), UI.w.btn('Propriétés', () => { if (sel === 3) ipv4(r); }, {})), desc);
        UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + r.name, icon: 'network', w: 430, h: 520, tabs: [{ label: 'Gestion de réseau', content: () => gen }], okOnly: true });
      };
    };
    const ipv4 = (r) => {
      const i = d.ifaces[r.name]; const cfg = N.effCfg(d, r.name) || {};
      const st = { dhcp: !!i.dhcp, ip: i.dhcp ? '' : (i.ip || ''), mask: i.dhcp ? '' : (i.mask || ''), gw: i.dhcp ? '' : (i.gw || ''), dnsAuto: i.dhcp && !(i.dnsManual && i.dnsManual.length), dns: i.dhcp ? (i.dnsManual || []) : (i.dns || []) };
      const ip = UI.w.ipBox(st.ip), mask = UI.w.ipBox(st.mask), gw = UI.w.ipBox(st.gw), d1 = UI.w.ipBox(st.dns[0] || ''), d2 = UI.w.ipBox(st.dns[1] || '');
      let ps; const dirty = () => ps && ps.markDirty();
      const setStatic = (on) => { [ip, mask, gw].forEach(x => x.setDisabled(!on)); };
      const setDns = (auto) => { [d1, d2].forEach(x => x.setDisabled(auto)); };
      const rA = UI.w.radio('ip', 'Obtenir une adresse IP automatiquement', st.dhcp, () => { st.dhcp = true; setStatic(false); dirty(); });
      const rS = UI.w.radio('ip', 'Utiliser l’adresse IP suivante :', !st.dhcp, () => { st.dhcp = false; setStatic(true); dirty(); });
      const dA = UI.w.radio('dns', 'Obtenir les adresses des serveurs DNS automatiquement', st.dnsAuto, () => { st.dnsAuto = true; setDns(true); dirty(); });
      const dS = UI.w.radio('dns', 'Utiliser l’adresse de serveur DNS suivante :', !st.dnsAuto, () => { st.dnsAuto = false; setDns(false); dirty(); });
      setStatic(!st.dhcp); setDns(st.dnsAuto);
      [ip, mask, gw, d1, d2].forEach(x => x.addEventListener('input', dirty));
      const gen = h('div.pad', h('div', { style: { marginBottom: '8px' } }, 'Les paramètres IP peuvent être attribués automatiquement si votre réseau prend en charge cette fonctionnalité. Sinon, vous devez demander les paramètres IP appropriés à votre administrateur réseau.'), rA, rS,
        h('div', { style: { paddingLeft: '22px' } }, UI.w.field('Adresse IP :', ip, { lw: 150 }), UI.w.field('Masque de sous-réseau :', mask, { lw: 150 }), UI.w.field('Passerelle par défaut :', gw, { lw: 150 })), h('div', { style: { height: '8px' } }), dA, dS,
        h('div', { style: { paddingLeft: '22px' } }, UI.w.field('Serveur DNS préféré :', d1, { lw: 150 }), UI.w.field('Serveur DNS auxiliaire :', d2, { lw: 150 })), h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '10px' } }, UI.w.check('Valider les paramètres à la sortie', false, () => { }), UI.w.btn('Avancé…', () => advanced(r))));
      const apply = (w) => {
        if (!st.dhcp) {
          const a = ip.getValue(), m = mask.getValue();
          if (!U.isIP(a) || !m || !U.validMask(m)) { desk.msg({ title: 'Protocole Internet version 4 (TCP/IPv4)', icon: 'error', owner: ps, text: 'Entrez une adresse IP et un masque de sous-réseau valides.' }); return false; }
        }
        const dnsList = [d1.getValue(), d2.getValue()].filter(x => x && U.isIP(x));
        if (st.dhcp) { i.dhcp = true; i.dnsManual = st.dnsAuto ? [] : dnsList; N.dhcpRenew(W, d.id, r.name); }
        else { i.dhcp = false; i.ip = ip.getValue(); i.mask = mask.getValue(); i.gw = gw.getValue() || ''; i.dns = st.dnsAuto ? [] : dnsList; i.dnsManual = []; }
        desk.env.advance(3);
        desk.change('Propriétés TCP/IPv4 de ' + r.name + ' : ' + (st.dhcp ? 'DHCP' : ip.getValue() + ' / ' + mask.getValue() + ' / ' + (gw.getValue() || '—')) + ' ; DNS ' + (st.dnsAuto ? 'auto' : dnsList.join(', ')), { dev: desk.devId }); refresh(); return true;
      };
      ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de : Protocole Internet version 4 (TCP/IPv4)', icon: 'network', w: 400, h: 560, tabs: [{ label: 'Général', content: () => gen }], onOk: w => apply(w), onApply: w => apply(w) });
    };
    const advanced = (r) => {
      const i = d.ifaces[r.name]; const suffix = UI.w.text(i.suffix || '', { w: 260 });
      const c = N.effCfg(d, r.name) || {};
      const lvIp = UI.w.listView({ columns: [{ key: 'ip', label: 'Adresse IP', w: 170, sort: false }, { key: 'mask', label: 'Masque de sous-réseau', w: 190, sort: false }], rows: c.ip && c.ip !== '0.0.0.0' ? [{ ip: c.ip, mask: c.mask }] : [], key: x => x.ip });
      const lvGw = UI.w.listView({ columns: [{ key: 'gw', label: 'Passerelle', w: 250, sort: false }, { key: 'm', label: 'Métrique', w: 110, sort: false }], rows: c.gw ? [{ gw: c.gw, m: 'Automatique' }] : [], key: x => x.gw });
      const ipTab = h('div.pad', UI.w.group('Adresses IP', h('div', { style: { height: '90px', border: '1px solid #aaa' } }, lvIp.el), h('div', { style: { display: 'flex', gap: '6px', margin: '6px 0' } }, UI.w.btn('Ajouter…', () => { }, { disabled: true }), UI.w.btn('Modifier…', () => { }, { disabled: true }), UI.w.btn('Supprimer', () => { }, { disabled: true }))),
        UI.w.group('Passerelles par défaut :', h('div', { style: { height: '70px', border: '1px solid #aaa' } }, lvGw.el)), UI.w.check('Métrique automatique', true, () => { }, { disabled: true }));
      const dnsTab = h('div.pad', UI.w.group('Serveurs DNS, par ordre d’utilisation :', h('div', { style: { height: '90px', border: '1px solid #aaa', padding: '4px' } }, (c.dns || []).map(x => h('div', x)))), h('div', { style: { margin: '8px 0 4px' } }, UI.w.field('Suffixe DNS propre à cette connexion :', suffix, { lw: 200 })), UI.w.check('Inscrire les adresses de cette connexion dans le DNS', true, () => { }, { disabled: true }), UI.w.check('Utiliser le suffixe DNS de cette connexion pour l’inscription DNS', false, () => { }, { disabled: true }));
      const wins = h('div.pad', h('div.muted', 'Les paramètres WINS ne sont pas modélisés dans cette simulation.'));
      const ps2 = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Paramètres TCP/IP avancés', icon: 'network', w: 440, h: 500, tabs: [{ label: 'Paramètres IP', content: () => ipTab }, { label: 'DNS', content: () => dnsTab }, { label: 'WINS', content: () => wins }], onOk: () => { if (suffix.value.trim() !== (i.suffix || '')) { i.suffix = suffix.value.trim(); desk.change('Suffixe DNS propre à la connexion de ' + r.name + ' : « ' + i.suffix + ' »', { dev: desk.devId }); } } });
    };
    const ctx = (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: r.st.label === 'Désactivé' ? 'Activer' : 'Désactiver', fn: () => toggle(r) }, { label: 'État', fn: () => status(r) }, { label: 'Diagnostiquer', disabled: true }, '-', { label: 'Connexions de pont', disabled: true }, '-', { label: 'Créer un raccourci', disabled: true }, { label: 'Supprimer', disabled: true }, { label: 'Renommer', disabled: true }, '-', { label: 'Propriétés', def: true, fn: () => props(r) }], desk.el);
    lv = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 200, icon: r => 'network' }, { key: 'st', label: 'État', w: 220, fmt: r => r.st.label }, { key: 'dev', label: 'Nom de la carte', w: 280, fmt: () => W_.nicDesc }], rows: rows(), key: r => r.id, onSelect: r => { selected = r; tb(); }, onOpen: r => status(r), onContext: ctx, onRefresh: refresh });
    const tbEl = h('div.expbar'); const tb = () => {
      UI.clear(tbEl); const r = selected; const b = (l, fn, dis) => h('button.tbb', { disabled: !!dis, on: { click: fn } }, l);
      tbEl.append(b('Organiser ▾', () => { }, true), b(r && r.st.label === 'Désactivé' ? 'Activer ce périphérique réseau' : 'Désactiver ce périphérique réseau', () => r && toggle(r), !r), b('Diagnostiquer cette connexion', () => { }, true), b('Renommer cette connexion', () => { }, true), b('Afficher l’état de cette connexion', () => r && status(r), !r), b('Modifier les paramètres de cette connexion', () => r && props(r), !r));
    };
    tb();
    win = desk.wm.open({ title: 'Connexions réseau', icon: 'network', w: 860, h: 380, minW: 520, body: () => h('div.explorer', h('div.addr', h('span.crumbs', 'Panneau de configuration › Réseau et Internet › Connexions réseau')), tbEl, h('div.expbody', lv.el)) });
    win.appId = 'ncpa'; desk.run.act(desk.devId, 'Ouverture de Connexions réseau', { kind: 'ui' }); return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
