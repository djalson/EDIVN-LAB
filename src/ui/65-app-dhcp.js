/* ============================================================================
   Console DHCP (dhcpmgmt.msc) : serveur, étendues, pool d'adresses et exclusions, concessions,
   réservations, options d'étendue et de serveur. Elle agit sur d.win.dhcp ; l'effet sur les clients
   découle du moteur (WIN.dhcpOffer) et n'est jamais écrit ici.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, N = SIM.net, WIN = SIM.win, h = UI.h;
SIM.AVREG['dhcp-gui'] = 'Console DHCP : arborescence (Étendue [id] nom, Pool d’adresses, Concessions d’adresses, Réservations, Options d’étendue, Options de serveur), colonnes, menus et boîtes de dialogue reconstitués de mémoire (version française) ; libellé « ** Inactive ** » et textes de confirmation à vérifier par capture.';
SIM.AVREG['dhcp-option-label-click'] = 'Console DHCP, options d’étendue : cliquer le libellé d’une option la sélectionne, cocher la case l’active — comportement exact de la vraie console à confirmer par la capture R-71.';
SIM.AVREG['dhcp-gui-limits'] = 'Console DHCP : l’assistant « Nouvelle étendue », les stratégies, les filtres, IPv6 et le basculement ne sont pas simulés (entrées grisées).';
const lc = s => String(s).toLowerCase();
const pad = U.pad2;
const fmtT = ms => { const t = new Date(ms); return pad(t.getUTCDate()) + '/' + pad(t.getUTCMonth() + 1) + '/' + t.getUTCFullYear() + ' ' + pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':' + pad(t.getUTCSeconds()); };
const OPT_NAMES = { 3: '003 Routeur', 6: '006 Serveurs DNS', 15: '015 Nom de domaine DNS' };
const OPT_KEYS = [3, 6, 15];
const macOk = m => /^([0-9A-Fa-f]{2}[-:]?){5}[0-9A-Fa-f]{2}$/.test(m.trim());
const macNorm = m => { const s = m.replace(/[-:]/g, '').toUpperCase(); return s.match(/.{2}/g).join('-'); };

UI.app('dhcp', {
  title: 'DHCP', icon: 'network', admin: true, single: true,
  open: (desk) => {
    const self = { dev: desk.d };
    const srv = () => self.dev; const dh = () => self.dev.win.dhcp;
    let win, api;
    if (!dh()) { desk.msg({ title: 'DHCP', icon: 'error', text: 'Le rôle serveur DHCP n’est pas installé sur cet ordinateur.' }); return null; }
    const fqdn = () => SIM.emu.win.fqdn(self.dev).toLowerCase();
    const sc = id => dh().scopes.find(s => s.id === id);
    const changed = (txt, o) => { desk.env.touch('dhcp'); desk.change(txt, Object.assign({ dev: self.dev.id }, o || {})); refresh(); };
    const scLabel = s => 'Étendue [' + s.id + '] ' + s.name + (s.active ? '' : ' ** Inactive **');
    const roots = () => [{ key: 'root', label: 'DHCP', icon: 'network', expanded: true, children: [{ key: 'srv', label: fqdn(), icon: dh().authorized || !self.dev.win.domain ? 'network' : 'error', expanded: true, children: [
      { key: 'ipv4', label: 'IPv4', icon: 'folder', expanded: true, children: dh().scopes.map(s => ({ key: 'sc:' + s.id, label: scLabel(s), icon: s.active ? 'network' : 'error', children: [
        { key: 'sc:' + s.id + ':pool', label: 'Pool d’adresses', icon: 'folder' }, { key: 'sc:' + s.id + ':leases', label: 'Concessions d’adresses', icon: 'folder' }, { key: 'sc:' + s.id + ':resa', label: 'Réservations', icon: 'folder' }, { key: 'sc:' + s.id + ':opts', label: 'Options d’étendue', icon: 'folder' }, { key: 'sc:' + s.id + ':pol', label: 'Stratégies', icon: 'folder' }] }))
        .concat([{ key: 'sopts', label: 'Options de serveur', icon: 'folder' }, { key: 'spol', label: 'Stratégies', icon: 'folder' }, { key: 'filters', label: 'Filtres', icon: 'folder', children: [{ key: 'f:allow', label: 'Autoriser', icon: 'folder' }, { key: 'f:deny', label: 'Refuser', icon: 'folder' }] }]) },
      { key: 'ipv6', label: 'IPv6', icon: 'folder' }] }] }];

    /* ---------- boîtes de dialogue ---------- */
    const dlgExclusion = (existing) => {
      const a = UI.w.ipBox(''), b = UI.w.ipBox(''); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      return { open: (s) => UI.dialog(desk, win, { title: 'Ajouter une exclusion', w: 400, h: 230, body: h('div', h('div', { style: { marginBottom: '8px' } }, 'Tapez la plage d’adresses IP que vous voulez exclure. Si vous voulez exclure une seule adresse, tapez-la uniquement dans « Adresse IP de début ».'), UI.w.field('Adresse IP de début :', a, { lw: 150 }), UI.w.field('Adresse IP de fin :', b, { lw: 150 }), err),
        buttons: [{ label: 'Ajouter', def: true, fn: () => {
          const st = a.getValue(), en = b.getValue() || a.getValue();
          if (!U.isIP(st) || !U.isIP(en)) { err.textContent = 'Entrez une adresse IP valide.'; return false; }
          if (U.ip2n(en) < U.ip2n(st)) { err.textContent = 'L’adresse de fin doit être supérieure ou égale à l’adresse de début.'; return false; }
          if (!U.inNet(st, s.net, s.mask) || !U.inNet(en, s.net, s.mask)) { err.textContent = 'La plage d’exclusion doit se trouver dans le sous-réseau de l’étendue.'; return false; }
          if (U.ip2n(st) < U.ip2n(s.start) || U.ip2n(en) > U.ip2n(s.end)) { err.textContent = 'La plage d’exclusion doit se trouver dans la plage d’adresses de l’étendue.'; return false; }
          s.exclusions = s.exclusions || []; s.exclusions.push({ start: st, end: en }); changed('DHCP : exclusion ' + st + (en !== st ? ' - ' + en : '') + ' ajoutée à l’étendue ' + s.id); a.setValue(''); b.setValue(''); err.textContent = ''; return false;
        } }, { label: 'Fermer' }] }) };
    };
    const dlgResa = (s, r) => {
      const nm = UI.w.text(r ? r.name : '', { w: 240 }), ip = UI.w.ipBox(r ? r.ip : ''), mac = UI.w.text(r ? r.mac : '', { w: 240 }), ds = UI.w.text(r ? (r.desc || '') : '', { w: 240 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: r ? 'Propriétés de ' + r.name : 'Nouvelle réservation', w: 480, h: 330, body: h('div', UI.w.field('Nom de la réservation :', nm, { lw: 160 }), UI.w.field('Adresse IP :', ip, { lw: 160 }), UI.w.field('Adresse MAC :', mac, { lw: 160 }), UI.w.field('Description :', ds, { lw: 160 }), UI.w.field('Prise en charge :', h('span', 'DHCP'), { lw: 160 }), err),
        buttons: [{ label: r ? 'OK' : 'Ajouter', def: true, fn: () => {
          const ipv = ip.getValue(), mc = mac.value.trim();
          if (!nm.value.trim()) { err.textContent = 'Entrez un nom pour la réservation.'; return false; }
          if (!U.isIP(ipv) || !U.inNet(ipv, s.net, s.mask)) { err.textContent = 'L’adresse IP doit appartenir au sous-réseau de l’étendue.'; return false; }
          if (!macOk(mc)) { err.textContent = 'Adresse MAC non valide.'; return false; }
          const mn = macNorm(mc); const other = s.reservations.find(x => x !== r && (x.ip === ipv || x.mac.toUpperCase() === mn));
          if (other) { err.textContent = 'Une réservation existe déjà pour cette adresse IP ou cette adresse MAC.'; return false; }
          if (r) { r.name = nm.value.trim(); r.ip = ipv; r.mac = mn; r.desc = ds.value; changed('DHCP : réservation « ' + r.name + ' » modifiée (' + ipv + ' / ' + mn + ')'); }
          else { s.reservations.push({ name: nm.value.trim(), ip: ipv, mac: mn, desc: ds.value }); changed('DHCP : réservation « ' + nm.value.trim() + ' » créée (' + ipv + ' / ' + mn + ')'); nm.value = ''; ip.setValue(''); mac.value = ''; ds.value = ''; err.textContent = ''; return false; }
        } }, { label: r ? 'Annuler' : 'Fermer' }] });
    };
    /* options (003, 006, 015) : conteneur = serveur ou étendue */
    const dlgOptions = (holder, title, label) => {
      holder.options = holder.options || {}; const work = {}; OPT_KEYS.forEach(k => { work[k] = holder.options[k] === undefined ? null : String(holder.options[k]); });
      let curK = 3; const listHost = h('div'), dataHost = h('div');
      /* comme la vraie boîte « Options » : la case à cocher active l'option, un clic sur le libellé la SÉLECTIONNE (sans la décocher) pour afficher ses données */
      const checks = OPT_KEYS.map(k => {
        const box = h('input', { type: 'checkbox', checked: work[k] !== null, on: { click: e => e.stopPropagation(), change: () => { if (box.checked && work[k] === null) work[k] = ''; if (!box.checked) work[k] = null; curK = k; draw(); } } });
        return h('div.chk', { style: { cursor: 'default' }, on: { click: () => { curK = k; draw(); } } }, box, h('span', OPT_NAMES[k]));
      });
      const values = k => (work[k] ? (k === 15 ? [work[k]] : work[k].split(/[,\s]+/).filter(Boolean)) : []);
      const draw = () => {
        UI.clear(dataHost); const en = work[curK] !== null;
        dataHost.append(h('div', { style: { fontWeight: 600, margin: '4px 0' } }, 'Entrée de données — ' + OPT_NAMES[curK]));
        if (!en) { dataHost.append(h('div.muted', 'Cochez l’option pour la configurer.')); return; }
        if (curK === 15) { const t = UI.w.text(work[15] || '', { w: 260, onchange: v => { work[15] = v; } }); dataHost.append(UI.w.field('Nom de domaine parent :', t, { lw: 160 })); return; }
        const lst = values(curK); const box = h('div.dlist', lst.map((v, i) => h('div.dli' + (i === dataHost._sel ? '.sel' : ''), { on: { click: () => { dataHost._sel = i; draw(); } } }, v)));
        const ib = UI.w.ipBox(''); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
        const set = arr => { work[curK] = arr.join(' '); draw(); };
        dataHost.append(h('div', { style: { display: 'flex', gap: '10px' } }, h('div', { style: { flex: 1 } }, UI.w.field('Adresse IP :', ib, { lw: 90 }), UI.w.btn('Ajouter', () => { const v = ib.getValue(); if (!U.isIP(v)) { err.textContent = 'Entrez une adresse IP valide.'; return; } set(lst.concat([v])); }), err), h('div', { style: { flex: 1 } }, box, h('div', { style: { display: 'flex', gap: '6px', marginTop: '6px' } }, UI.w.btn('Supprimer', () => { if (dataHost._sel === undefined) return; lst.splice(dataHost._sel, 1); dataHost._sel = undefined; set(lst); }), UI.w.btn('Monter', () => { const i = dataHost._sel; if (i > 0) { const x = lst.splice(i, 1)[0]; lst.splice(i - 1, 0, x); dataHost._sel = i - 1; set(lst); } }), UI.w.btn('Descendre', () => { const i = dataHost._sel; if (i !== undefined && i < lst.length - 1) { const x = lst.splice(i, 1)[0]; lst.splice(i + 1, 0, x); dataHost._sel = i + 1; set(lst); } })))));
      };
      const apply = () => {
        const bad = OPT_KEYS.filter(k => work[k] !== null && k !== 15 && !values(k).every(U.isIP));
        const empty = OPT_KEYS.filter(k => work[k] === '' || (work[k] !== null && work[k].trim() === ''));
        let before = JSON.stringify(holder.options);
        OPT_KEYS.forEach(k => { if (work[k] === null || work[k] === undefined) delete holder.options[k]; else if (work[k].trim() !== '') holder.options[k] = work[k].trim(); else delete holder.options[k]; });
        if (before !== JSON.stringify(holder.options)) changed('DHCP : options ' + label + ' modifiées (' + OPT_KEYS.filter(k => holder.options[k] !== undefined).map(k => OPT_NAMES[k].slice(0, 3) + '=' + holder.options[k]).join(', ') + ')');
        void bad; void empty;
      };
      draw();
      const w2 = UI.dialog(desk, win, { title: title, w: 470, h: 420, body: h('div', h('div', { style: { fontWeight: 600, margin: '2px 0 4px' } }, 'Options disponibles'), h('div.dlist.tall', checks), UI.w.sep(), dataHost), buttons: [{ label: 'OK', def: true, fn: apply }, { label: 'Annuler' }, { label: 'Appliquer', fn: () => { apply(); return false; } }] });
      return w2;
    };
    const dlgScopeProps = (s) => {
      const nm = UI.w.text(s.name, { w: 260 }), a = UI.w.ipBox(s.start), b = UI.w.ipBox(s.end); const days = Math.floor((s.leaseSec || 691200) / 86400), hrs = Math.floor(((s.leaseSec || 691200) % 86400) / 3600), mins = Math.floor(((s.leaseSec || 691200) % 3600) / 60);
      const dI = UI.w.text(days, { w: 40 }), hI = UI.w.text(hrs, { w: 40 }), mI = UI.w.text(mins, { w: 40 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      const general = h('div.pad', UI.w.field('Nom de l’étendue :', nm, { lw: 150 }), UI.w.sep(), UI.w.field('Adresse IP de début :', a, { lw: 150 }), UI.w.field('Adresse IP de fin :', b, { lw: 150 }), UI.w.field('Masque de sous-réseau :', h('span', s.mask), { lw: 150 }), UI.w.sep(), h('div', 'Durée du bail pour les clients DHCP'), h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '6px 0' } }, 'Limitée à :', dI, 'Jours', hI, 'Heures', mI, 'Minutes'), err);
      const save = ps => {
        if (!U.isIP(a.getValue()) || !U.isIP(b.getValue()) || U.ip2n(b.getValue()) < U.ip2n(a.getValue()) || !U.inNet(a.getValue(), s.net, s.mask) || !U.inNet(b.getValue(), s.net, s.mask)) { err.textContent = 'La plage d’adresses saisie n’est pas valide pour ce sous-réseau.'; return false; }
        const ls = (+dI.value || 0) * 86400 + (+hI.value || 0) * 3600 + (+mI.value || 0) * 60; if (ls <= 0) { err.textContent = 'Durée de bail non valide.'; return false; }
        const ch = nm.value !== s.name || a.getValue() !== s.start || b.getValue() !== s.end || ls !== s.leaseSec;
        s.name = nm.value; s.start = a.getValue(); s.end = b.getValue(); s.leaseSec = ls; if (ch) changed('DHCP : propriétés de l’étendue ' + s.id + ' modifiées (' + s.start + ' - ' + s.end + ')'); return true;
      };
      UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de l’étendue : ' + s.name, icon: 'network', w: 480, h: 420, tabs: [{ label: 'Général', content: () => general }, { label: 'DNS', content: () => h('div.pad.muted', 'Les paramètres de mise à jour DNS dynamique ne sont pas simulés.') }, { label: 'Avancé', content: () => h('div.pad.muted', 'Prise en charge BOOTP/DHCP : DHCP uniquement.') }], onOk: save, onApply: save });
    };
    const dlgServerProps = () => {
      const general = h('div.pad', h('div', 'Mise à jour automatique des statistiques toutes les 10 minutes.'), h('div', { style: { height: '8px' } }), h('div', 'Enregistrement d’audit DHCP activé.'));
      const bind = h('div.pad', h('div', 'Connexions de liaison de serveur :'), h('div.dlist', (dh().bindings || []).map(n => h('div.dli', n))));
      UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + fqdn(), icon: 'network', w: 440, h: 400, tabs: [{ label: 'Général', content: () => general }, { label: 'DNS', content: () => h('div.pad.muted', 'Non simulé.') }, { label: 'Avancé', content: () => bind }], okOnly: true });
    };

    /* ---------- actions ---------- */
    const setActive = (s, on) => {
      if (on) { s.active = true; changed('DHCP : étendue ' + s.id + ' activée'); return; }
      UI.confirm(desk, win, { title: 'DHCP', text: 'La désactivation de l’étendue ' + s.id + ' empêche le serveur de répondre aux clients DHCP de ce sous-réseau.\n\nVoulez-vous désactiver l’étendue ?', onYes: () => { s.active = false; changed('DHCP : étendue ' + s.id + ' désactivée'); } });
    };
    const authorize = (on) => {
      if (on) { dh().authorized = true; changed('DHCP : serveur ' + fqdn() + ' autorisé dans Active Directory'); }
      else UI.confirm(desk, win, { title: 'DHCP', text: 'Voulez-vous annuler l’autorisation de ce serveur DHCP dans Active Directory ?', onYes: () => { dh().authorized = false; changed('DHCP : autorisation de ' + fqdn() + ' annulée'); } });
    };
    const svcCtl = (verb) => {
      const sv = self.dev.win.svc.DHCPServer; if (!sv) return; const wait = (txt, then) => UI.w.progressDialog(desk.wm, win, 'Contrôle de service', txt, 900, then);
      if (verb === 'start') { if (sv.start === 'disabled') { desk.msg({ title: 'DHCP', icon: 'error', owner: win, text: 'Windows n’a pas pu démarrer le service Serveur DHCP.\nErreur 1058 : Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.' }); return; } wait('Démarrage du service Serveur DHCP…', () => { WIN.setSvc(desk.W, self.dev.id, 'DHCPServer', 'running'); desk.env.advance(2); changed('DHCP : service Serveur DHCP démarré'); }); }
      else if (verb === 'stop') wait('Arrêt du service Serveur DHCP…', () => { WIN.setSvc(desk.W, self.dev.id, 'DHCPServer', 'stopped'); desk.env.advance(2); changed('DHCP : service Serveur DHCP arrêté', { impact: 'svc-stop' }); });
      else wait('Redémarrage du service Serveur DHCP…', () => { WIN.setSvc(desk.W, self.dev.id, 'DHCPServer', 'stopped'); WIN.setSvc(desk.W, self.dev.id, 'DHCPServer', 'running'); desk.env.advance(3); changed('DHCP : service Serveur DHCP redémarré'); });
    };
    const taskItems = () => { const st = self.dev.win.svc.DHCPServer && self.dev.win.svc.DHCPServer.state; return [{ label: 'Démarrer', disabled: st === 'running', fn: () => svcCtl('start') }, { label: 'Arrêter', disabled: st !== 'running', fn: () => svcCtl('stop') }, { label: 'Suspendre', disabled: true }, { label: 'Reprendre', disabled: true }, { label: 'Redémarrer', disabled: st !== 'running', fn: () => svcCtl('restart') }]; };

    /* ---------- vues ---------- */
    const listOf = (cols, rows, o) => UI.w.listView(Object.assign({ columns: cols, rows }, o || {}));
    const view = (n) => {
      const k = n.key; let el, acts = [];
      const m = /^sc:([^:]+)(?::(\w+))?$/.exec(k); const s = m ? sc(m[1]) : null; const sub = m && m[2];
      if (k === 'root') { el = listOf([{ key: 'name', label: 'Nom', w: 400 }], [{ name: fqdn() }]); acts = [{ title: 'DHCP', items: [{ label: 'Ajouter un serveur…', disabled: true }, { label: 'Gérer les serveurs autorisés…', disabled: true }] }]; }
      else if (k === 'srv') {
        el = listOf([{ key: 'name', label: 'Contenu du serveur DHCP', w: 400 }], [{ name: 'IPv4' }, { name: 'IPv6' }]);
        acts = [{ title: fqdn(), items: [{ label: 'Ajouter/supprimer des liaisons…', disabled: true }, self.dev.win.domain && dh().authorized ? { label: 'Annuler l’autorisation', fn: () => authorize(false) } : { label: 'Autoriser', disabled: !self.dev.win.domain, fn: () => authorize(true) }, { label: 'Toutes les tâches', items: taskItems() }, { label: 'Actualiser', fn: refresh }, { label: 'Propriétés', fn: dlgServerProps }] }];
      } else if (k === 'ipv4') {
        el = listOf([{ key: 'name', label: 'Contenu de IPv4', w: 400 }], dh().scopes.map(x => ({ name: scLabel(x) })).concat([{ name: 'Options de serveur' }, { name: 'Stratégies' }, { name: 'Filtres' }]));
        acts = [{ title: 'IPv4', items: [{ label: 'Nouvelle étendue…', disabled: true }, { label: 'Nouvelle étendue de multidiffusion…', disabled: true }, { label: 'Afficher les statistiques…', disabled: true }, { label: 'Actualiser', fn: refresh }, { label: 'Propriétés', fn: dlgServerProps }] }];
      } else if (s && !sub) {
        el = listOf([{ key: 'name', label: 'Contenu de l’étendue', w: 400 }], ['Pool d’adresses', 'Concessions d’adresses', 'Réservations', 'Options d’étendue', 'Stratégies'].map(x => ({ name: x })));
        acts = [{ title: scLabel(s), items: [{ label: s.active ? 'Désactiver' : 'Activer', fn: () => setActive(s, !s.active) }, { label: 'Afficher les statistiques…', disabled: true }, { label: 'Dupliquer', disabled: true }, { label: 'Supprimer', disabled: true }, { label: 'Actualiser', fn: refresh }, { label: 'Propriétés', fn: () => dlgScopeProps(s) }] }];
      } else if (sub === 'pool') {
        const rows = [{ a: s.start, b: s.end, d: 'Plage d’adresses pour la distribution', ex: null }].concat((s.exclusions || []).map(e => ({ a: e.start, b: e.end, d: 'Adresses IP exclues de la distribution', ex: e })));
        el = listOf([{ key: 'a', label: 'Adresse IP de début', w: 160, sort: false }, { key: 'b', label: 'Adresse IP de fin', w: 160, sort: false }, { key: 'd', label: 'Description', w: 300, sort: false }], rows, { key: r => r.a + '-' + r.b, onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Nouvelle plage d’exclusion…', fn: () => dlgExclusion().open(s) }, '-', { label: 'Supprimer', disabled: !r.ex, fn: () => r.ex && delExcl(s, r.ex) }, '-', { label: 'Actualiser', fn: refresh }]), onDelete: r => r.ex && delExcl(s, r.ex), onContextEmpty: e => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Nouvelle plage d’exclusion…', fn: () => dlgExclusion().open(s) }, '-', { label: 'Actualiser', fn: refresh }]) });
        acts = [{ title: 'Pool d’adresses', items: [{ label: 'Nouvelle plage d’exclusion…', fn: () => dlgExclusion().open(s) }, { label: 'Actualiser', fn: refresh }] }];
      } else if (sub === 'leases') {
        const leases = Object.keys(s._leases || {}).map(mc => Object.assign({ mac: mc }, s._leases[mc])).concat((s.reservations || []).filter(r => !(s._leases || {})[r.mac.toUpperCase()]).map(r => ({ ip: r.ip, name: r.name, mac: r.mac, expires: null, type: 'Réservation (inactive)' })));
        el = listOf([{ key: 'ip', label: 'Adresse IP du client', w: 130, sort: (a, b) => U.ip2n(a.ip) - U.ip2n(b.ip) }, { key: 'name', label: 'Nom', w: 220 }, { key: 'exp', label: 'Expiration du bail', w: 170, fmt: r => (r.expires === null ? '' : r.expires > desk.W.clock.elapsed + 86400 * 3000 ? 'Réservation (active)' : fmtT(desk.W.clock.base + r.expires * 1000)), sortVal: r => r.expires || 0 }, { key: 'type', label: 'Type', w: 140, fmt: r => (r.type === 'DHCP' ? ((s.reservations || []).some(x => x.mac.toUpperCase() === r.mac.toUpperCase()) ? 'Réservation (active)' : 'DHCP') : r.type) }, { key: 'mac', label: 'ID unique', w: 150 }], leases, { key: r => r.mac, onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Ajouter à la réservation', disabled: true }, { label: 'Supprimer', disabled: !(s._leases || {})[r.mac], fn: () => delLease(s, r) }, '-', { label: 'Actualiser', fn: refresh }]), onDelete: r => (s._leases || {})[r.mac] && delLease(s, r) });
        acts = [{ title: 'Concessions d’adresses', items: [{ label: 'Actualiser', fn: refresh }, { label: 'Exporter la liste…', disabled: true }] }];
      } else if (sub === 'resa') {
        el = listOf([{ key: 'name', label: 'Nom de la réservation', w: 200 }, { key: 'ip', label: 'Adresse IP', w: 140, sort: (a, b) => U.ip2n(a.ip) - U.ip2n(b.ip) }, { key: 'mac', label: 'Adresse MAC', w: 160 }, { key: 'desc', label: 'Description', w: 220 }], s.reservations || [], { key: r => r.mac, onOpen: r => dlgResa(s, r), onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Configurer les options…', disabled: true }, '-', { label: 'Supprimer', fn: () => delResa(s, r) }, '-', { label: 'Propriétés', def: true, fn: () => dlgResa(s, r) }]), onDelete: r => delResa(s, r), onContextEmpty: e => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Nouvelle réservation…', fn: () => dlgResa(s) }, '-', { label: 'Actualiser', fn: refresh }]) });
        acts = [{ title: 'Réservations', items: [{ label: 'Nouvelle réservation…', fn: () => dlgResa(s) }, { label: 'Actualiser', fn: refresh }] }];
      } else if (sub === 'opts' || k === 'sopts') {
        const hold = s || dh(); const opts = (s ? s.options : dh().serverOptions) || {};
        el = listOf([{ key: 'name', label: 'Nom de l’option', w: 240, sort: false }, { key: 'vend', label: 'Fournisseur', w: 130, sort: false }, { key: 'val', label: 'Valeur', w: 260, sort: false }, { key: 'pol', label: 'Nom de la stratégie', w: 140, sort: false }], OPT_KEYS.filter(x => opts[x] !== undefined).map(x => ({ name: OPT_NAMES[x], vend: 'Standard', val: String(opts[x]).replace(/ /g, ', '), pol: 'Aucun' })), { key: r => r.name, onOpen: () => holderDlg(), onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Propriétés', def: true, fn: () => holderDlg() }]), onContextEmpty: e => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Configurer les options…', fn: () => holderDlg() }, '-', { label: 'Actualiser', fn: refresh }]) });
        const holderDlg = () => { if (s) { s.options = s.options || {}; dlgOptions(s, 'Options d’étendue', 'd’étendue ' + s.id); } else dlgOptions({ get options() { return dh().serverOptions; }, set options(v) { dh().serverOptions = v; } }, 'Options de serveur', 'de serveur'); };
        void hold; acts = [{ title: s ? 'Options d’étendue' : 'Options de serveur', items: [{ label: 'Configurer les options…', fn: holderDlg }, { label: 'Actualiser', fn: refresh }] }];
      } else {
        el = listOf([{ key: 'name', label: 'Nom', w: 360 }], [], { empty: 'Aucun élément à afficher dans cette vue.' }); acts = [{ title: n.label, items: [{ label: 'Actualiser', fn: refresh }] }];
      }
      return { el, acts };
    };
    const delExcl = (s, e) => UI.confirm(desk, win, { title: 'DHCP', text: 'Voulez-vous supprimer cette plage d’exclusion ?', onYes: () => { s.exclusions = s.exclusions.filter(x => x !== e); changed('DHCP : exclusion ' + e.start + ' - ' + e.end + ' supprimée de l’étendue ' + s.id); } });
    const delLease = (s, r) => UI.confirm(desk, win, { title: 'DHCP', text: 'Voulez-vous supprimer cette concession ?', onYes: () => { delete s._leases[r.mac]; changed('DHCP : concession ' + r.ip + ' supprimée'); } });
    const delResa = (s, r) => UI.confirm(desk, win, { title: 'DHCP', text: 'Voulez-vous supprimer la réservation « ' + r.name + ' » ?', onYes: () => { s.reservations = s.reservations.filter(x => x !== r); changed('DHCP : réservation « ' + r.name + ' » supprimée'); } });

    const show = (n) => { if (!n) return; const v = view(n); api.setMid(v.el.el || v.el); api.setActions(v.acts); api.status(''); };
    function refresh() { api.tree.setRoots(roots()); show(api.tree.selected()); }
    const menu = [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: () => { const n = api.tree.selected(); const v = n && view(n); return (v ? v.acts[0].items : []).map(x => x); } }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos de DHCP', disabled: true }] }];
    win = UI.w.mmc({ wm: desk.wm, title: 'DHCP', icon: 'network', w: 960, h: 560, menu, roots: roots(), select: 'srv', onSelect: (n, a) => { api = a; show(n); }, onRefresh: refresh,
      onTreeContext: (n) => { const v = view(n); return v.acts[0].items; } });
    api = win.mmc; win.appId = 'dhcp'; desk.act('Ouverture de la console DHCP sur ' + self.dev.name, { kind: 'ui' });
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
