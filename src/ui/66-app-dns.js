/* ============================================================================
   Gestionnaire DNS (dnsmgmt.msc) : zones directes et inversées, enregistrements (A, CNAME, NS, PTR, SRV),
   redirecteurs, redirecteurs conditionnels, interfaces d'écoute, récursivité. Agit sur d.win.dns.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, N = SIM.net, WIN = SIM.win, h = UI.h;
SIM.AVREG['dns-gui'] = 'Gestionnaire DNS : arborescence (Zones de recherche directes/inversées, Points d’approbation, Redirecteurs conditionnels), libellés des types d’enregistrement (« Hôte (A) », « Alias (CNAME) », « Pointeur (PTR) »…), colonnes et boîtes de dialogue reconstitués de mémoire (version française).';
SIM.AVREG['dns-soa'] = 'Gestionnaire DNS : la ligne « Début d’autorité (SOA) » est synthétisée (numéro de série compté par le simulateur, responsable « hostmaster ») car le modèle ne stocke pas de SOA ; format de la colonne Données à vérifier.';
SIM.AVREG['dns-gui-limits'] = 'Gestionnaire DNS : zones secondaires/stub, MX et autres types, délégations (assistant), vieillissement/nettoyage et mises à jour dynamiques (liste grisée, sans effet) ne sont pas simulés.';
const lc = s => String(s).toLowerCase();
const TYPE_LABEL = { A: 'Hôte (A)', AAAA: 'Hôte IPv6 (AAAA)', CNAME: 'Alias (CNAME)', NS: 'Serveur de noms (NS)', PTR: 'Pointeur (PTR)', SRV: 'Emplacement du service (SRV)', MX: 'Échange de messagerie (MX)', SOA: 'Début d’autorité (SOA)' };
const dataLabel = r => { if (r.type === 'SRV') { const m = /^(\d+) (\d+) (\d+) (.+)$/.exec(r.data); return m ? '[' + m[1] + '][' + m[2] + '][' + m[3] + '] ' + m[4] : r.data; } return r.data; };

UI.app('dns', {
  title: 'DNS', icon: 'network', admin: true, single: true,
  open: (desk) => {
    const self = { dev: desk.d }; let win, api;
    const dns = () => self.dev.win.dns;
    if (!dns()) { desk.msg({ title: 'Gestionnaire DNS', icon: 'error', text: 'Le rôle serveur DNS n’est pas installé sur cet ordinateur.' }); return null; }
    const host = () => self.dev.name.toUpperCase();
    const changed = (txt, o) => { desk.env.touch('dns'); desk.change(txt, Object.assign({ dev: self.dev.id }, o || {})); refresh(); };
    const zone = n => dns().zones.find(z => z.name === n);
    const bump = z => { z.serial = (z.serial || 1) + 1; };
    const fwdZones = () => dns().zones.filter(z => !z.reverse && !/in-addr\.arpa$/.test(z.name));
    const revZones = () => dns().zones.filter(z => z.reverse || /in-addr\.arpa$/.test(z.name));
    /* sous-dossiers d'une zone : étiquettes de droite à gauche des noms pointés */
    const folderTree = z => { const root = { kids: {} }; z.records.forEach(r => { const parts = r.name === '@' ? [] : r.name.split('.'); const dirs = parts.slice(1).reverse(); let n = root; dirs.forEach(dn => { n.kids[dn] = n.kids[dn] || { kids: {} }; n = n.kids[dn]; }); }); return root; };
    const zoneChildren = (z) => { const mk = (node, path) => Object.keys(node.kids).sort().map(k => ({ key: 'z:' + z.name + ':' + path.concat(k).join('/'), label: k, icon: 'folder', zone: z.name, path: path.concat(k), children: mk(node.kids[k], path.concat(k)) })); return mk(folderTree(z), []); };
    const roots = () => [{ key: 'root', label: 'DNS', icon: 'network', expanded: true, children: [{ key: 'srv', label: host(), icon: 'network', expanded: true, children: [
      { key: 'fwd', label: 'Zones de recherche directes', icon: 'folder', expanded: true, children: fwdZones().map(z => ({ key: 'z:' + z.name + ':', label: z.name, icon: z.state === 'paused' ? 'error' : 'folder', zone: z.name, path: [], children: zoneChildren(z) })) },
      { key: 'rev', label: 'Zones de recherche inversée', icon: 'folder', expanded: true, children: revZones().map(z => ({ key: 'z:' + z.name + ':', label: z.name, icon: 'folder', zone: z.name, path: [], children: [] })) },
      { key: 'trust', label: 'Points d’approbation', icon: 'folder' },
      { key: 'cfwd', label: 'Redirecteurs conditionnels', icon: 'folder', children: (dns().condForwarders || []).map(c => ({ key: 'cf:' + c.zone, label: c.zone, icon: 'folder' })) }] }] }];

    /* ---------- enregistrements ---------- */
    const recId = (z, name, type, data) => { const base = name + '|' + type; return z.records.some(r => r.id === base) ? base + '|' + data : base; };
    const fqdnOf = (z, name) => (name === '@' ? z.name : name + '.' + z.name);
    const addPtr = (ipv, targetFqdn) => {
      const o = ipv.split('.'); const rz = revZones().find(x => lc(x.name) === o[2] + '.' + o[1] + '.' + o[0] + '.in-addr.arpa'); if (!rz) return false;
      const nm = o[3]; const ex = rz.records.find(r => r.name === nm && r.type === 'PTR'); const data = targetFqdn.replace(/\.?$/, '.');
      if (ex) ex.data = data; else rz.records.push({ name: nm, type: 'PTR', data, id: nm + '|PTR' }); bump(rz); return true;
    };
    const dlgHost = (z, rec) => {
      const nm = UI.w.text(rec ? rec.name : '', { w: 260, readonly: !!rec }), ip = UI.w.ipBox(rec ? rec.data : ''); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      const rev = z.reverse ? null : UI.w.check('Créer un pointeur d’enregistrement PTR associé', false, () => { }); const fq = h('b', rec ? fqdnOf(z, rec.name) : z.name);
      if (!rec) nm.addEventListener('input', () => { fq.textContent = (nm.value ? nm.value + '.' : '') + z.name; });
      return UI.dialog(desk, win, { title: rec ? 'Propriétés de ' + (rec.name === '@' ? '(identique au dossier parent)' : rec.name) : 'Nouvel hôte', w: 460, h: 300,
        body: h('div', UI.w.field('Nom (utilise le domaine parent si ce champ est vide) :', nm, { lw: 200 }), UI.w.field('Nom de domaine pleinement qualifié (FQDN) :', fq, { lw: 200 }), UI.w.field('Adresse IP :', ip, { lw: 200 }), rev ? h('div', { style: { margin: '6px 0' } }, rev) : null, err),
        buttons: [{ label: rec ? 'OK' : 'Ajouter un hôte', def: true, fn: () => {
          const v = ip.getValue(); const name = rec ? rec.name : (nm.value.trim() || '@');
          if (!U.isIP(v)) { err.textContent = 'L’adresse IP n’est pas valide.'; return false; }
          if (!/^(@|[A-Za-z0-9_]([A-Za-z0-9_-]*[A-Za-z0-9_])?(\.[A-Za-z0-9_-]+)*)$/.test(name)) { err.textContent = 'Le nom n’est pas valide.'; return false; }
          if (rec) { if (rec.data !== v) { rec.data = v; bump(z); changed('DNS : enregistrement ' + rec.name + ' (A) modifié → ' + v + ' dans ' + z.name); } return; }
          if (z.records.some(r => r.name === name && r.type === 'A' && r.data === v)) { err.textContent = 'Cet enregistrement existe déjà.'; return false; }
          if (z.records.some(r => r.name.toLowerCase() === name.toLowerCase() && r.type === 'CNAME')) { err.textContent = 'Un enregistrement d’alias (CNAME) existe déjà avec ce nom.'; return false; }
          z.records.push({ name, type: 'A', data: v, id: recId(z, name, 'A', v) }); bump(z); let msg = 'DNS : hôte ' + fqdnOf(z, name) + ' → ' + v + ' créé';
          if (rev && rev.querySelector('input').checked) { if (addPtr(v, fqdnOf(z, name))) msg += ' (PTR associé créé)'; else { setTimeout(() => desk.msg({ title: 'DNS', icon: 'warning', text: 'La zone de recherche inversée correspondante est introuvable : l’enregistrement PTR n’a pas été créé.' }), 50); } }
          changed(msg);
        } }, { label: rec ? 'Annuler' : 'Terminé' }] });
    };
    const dlgAlias = (z, rec) => {
      const nm = UI.w.text(rec ? rec.name : '', { w: 260, readonly: !!rec }), tg = UI.w.text(rec ? rec.data : '', { w: 300 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: rec ? 'Propriétés de ' + rec.name : 'Nouvel alias', w: 480, h: 250, body: h('div', UI.w.field('Nom de l’alias (utilise le domaine parent si ce champ est vide) :', nm, { lw: 210 }), UI.w.field('Nom de domaine pleinement qualifié (FQDN) de l’hôte de destination :', tg, { lw: 210 }), err),
        buttons: [{ label: rec ? 'OK' : 'OK', def: true, fn: () => {
          const name = rec ? rec.name : nm.value.trim(); const t = tg.value.trim(); if (!name && !rec) { err.textContent = 'Entrez un nom d’alias.'; return false; } if (!t) { err.textContent = 'Entrez le nom de l’hôte de destination.'; return false; }
          const data = t.replace(/\.?$/, '.'); if (rec) { if (rec.data !== data) { rec.data = data; bump(z); changed('DNS : alias ' + rec.name + ' modifié → ' + data); } return; }
          if (z.records.some(r => r.name.toLowerCase() === name.toLowerCase())) { err.textContent = 'Un enregistrement portant ce nom existe déjà dans cette zone.'; return false; }
          z.records.push({ name, type: 'CNAME', data, id: name + '|CNAME' }); bump(z); changed('DNS : alias ' + fqdnOf(z, name) + ' → ' + data + ' créé');
        } }, { label: 'Annuler' }] });
    };
    const dlgPtr = (z, rec) => {
      const nm = UI.w.text(rec.name, { w: 80, readonly: true }), tg = UI.w.text(rec.data, { w: 300 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: 'Propriétés de ' + rec.name, w: 480, h: 230, body: h('div', UI.w.field('Adresse IP de l’hôte :', nm, { lw: 200 }), UI.w.field('Nom d’hôte :', tg, { lw: 200 }), err), buttons: [{ label: 'OK', def: true, fn: () => { const d2 = tg.value.trim().replace(/\.?$/, '.'); if (!tg.value.trim()) { err.textContent = 'Entrez un nom d’hôte.'; return false; } if (d2 !== rec.data) { rec.data = d2; bump(z); changed('DNS : pointeur ' + rec.name + ' modifié → ' + d2 + ' dans ' + z.name); } } }, { label: 'Annuler' }] });
    };
    const dlgNewPtr = (z) => {
      const nm = UI.w.text('', { w: 80 }), tg = UI.w.text('', { w: 300 }); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: 'Nouveau pointeur de ressource', w: 480, h: 240, body: h('div', UI.w.field('Adresse IP de l’hôte :', nm, { lw: 200 }), UI.w.field('Nom de l’hôte :', tg, { lw: 200 }), err), buttons: [{ label: 'OK', def: true, fn: () => { const n0 = nm.value.trim(); if (!/^\d{1,3}$/.test(n0) || +n0 > 255) { err.textContent = 'Entrez le dernier octet de l’adresse IP.'; return false; } if (!tg.value.trim()) { err.textContent = 'Entrez un nom d’hôte.'; return false; } const data = tg.value.trim().replace(/\.?$/, '.'); const ex = z.records.find(r => r.name === n0 && r.type === 'PTR'); if (ex) ex.data = data; else z.records.push({ name: n0, type: 'PTR', data, id: n0 + '|PTR' }); bump(z); changed('DNS : pointeur ' + n0 + ' → ' + data + ' créé dans ' + z.name); } }, { label: 'Annuler' }] });
    };
    const delRec = (z, r) => UI.confirm(desk, win, { title: 'Gestionnaire DNS', text: 'Voulez-vous supprimer l’enregistrement « ' + (r.name === '@' ? '(identique au dossier parent)' : r.name) + ' » ?', onYes: () => { z.records = z.records.filter(x => x !== r); bump(z); changed('DNS : enregistrement ' + r.name + ' (' + r.type + ') supprimé de ' + z.name); } });
    const edit = (z, r) => { if (r.type === 'A') dlgHost(z, r); else if (r.type === 'CNAME') dlgAlias(z, r); else if (r.type === 'PTR') dlgPtr(z, r); else desk.msg({ title: 'Gestionnaire DNS', icon: 'info', owner: win, text: 'Les propriétés de ce type d’enregistrement ne sont pas disponibles dans le simulateur.' }); };

    /* ---------- propriétés de zone / serveur ---------- */
    const dlgZoneProps = (z) => {
      const stEl = h('b'); let sBtn; const paint = () => { stEl.textContent = z.state === 'paused' ? 'Suspendue' : 'En cours d’exécution'; if (sBtn) sBtn.textContent = z.state === 'paused' ? 'Démarrer' : 'Suspendre'; };
      sBtn = UI.w.btn('Suspendre', () => { z.state = z.state === 'paused' ? 'running' : 'paused'; paint(); desk.env.touch('dns'); desk.change('DNS : zone ' + z.name + (z.state === 'paused' ? ' suspendue' : ' démarrée'), { dev: self.dev.id }); refresh(); }); paint();
      const gen = h('div.pad', UI.w.field('État :', h('span', stEl, ' ', sBtn), { lw: 160 }), UI.w.field('Type :', h('span', z.adIntegrated ? 'Intégrée à Active Directory' : 'Principale'), { lw: 160 }), UI.w.field('Réplication :', h('span', z.adIntegrated ? 'Tous les serveurs DNS de ce domaine' : 'Sans objet'), { lw: 160 }), UI.w.sep(), UI.w.field('Mises à jour dynamiques :', UI.w.select(['Sécurisées uniquement'], 'Sécurisées uniquement', () => { }, { disabled: true }), { lw: 160 }));
      UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + z.name, icon: 'folder', w: 460, h: 420, tabs: [{ label: 'Général', content: () => gen }, { label: 'Début d’autorité (SOA)', content: () => h('div.pad', UI.w.field('Numéro de série :', h('span', String(z.serial || 1)), { lw: 160 })) }, { label: 'Serveurs de noms', content: () => h('div.pad', h('div.dlist', z.records.filter(r => r.type === 'NS').map(r => h('div.dli', r.data)))) }], okOnly: true });
    };
    const dlgForwarders = (cf) => {
      const arr = (cf ? cf.servers : dns().forwarders || []).slice(); let sel;
      const box = h('div.dlist.tall'); const ib = UI.w.ipBox(''); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      const draw = () => { UI.clear(box); arr.forEach((v, i) => box.append(h('div.dli' + (i === sel ? '.sel' : ''), { on: { click: () => { sel = i; draw(); } } }, v))); };
      draw(); const zn = cf ? null : null; void zn;
      UI.dialog(desk, win, { title: cf ? 'Propriétés de ' + cf.zone : 'Modifier les redirecteurs', w: 440, h: 360, body: h('div', h('div', 'Adresses IP des serveurs de redirection :'), box, UI.w.field('Ajouter :', ib, { lw: 80 }), h('div', { style: { display: 'flex', gap: '6px' } }, UI.w.btn('Ajouter', () => { const v = ib.getValue(); if (!U.isIP(v)) { err.textContent = 'Entrez une adresse IP valide.'; return; } err.textContent = ''; arr.push(v); ib.setValue(''); draw(); }), UI.w.btn('Supprimer', () => { if (sel !== undefined) { arr.splice(sel, 1); sel = undefined; draw(); } }), UI.w.btn('Monter', () => { if (sel > 0) { const x = arr.splice(sel, 1)[0]; arr.splice(--sel, 0, x); draw(); } }), UI.w.btn('Descendre', () => { if (sel !== undefined && sel < arr.length - 1) { const x = arr.splice(sel, 1)[0]; arr.splice(++sel, 0, x); draw(); } })), err),
        buttons: [{ label: 'OK', def: true, fn: () => { const b = JSON.stringify(cf ? cf.servers : dns().forwarders); if (cf) cf.servers = arr; else dns().forwarders = arr; if (b !== JSON.stringify(arr)) changed('DNS : ' + (cf ? 'redirecteur conditionnel ' + cf.zone : 'redirecteurs') + ' → ' + (arr.join(', ') || '(aucun)')); } }, { label: 'Annuler' }] });
    };
    const dlgNewCF = () => {
      const zn = UI.w.text('', { w: 260 }), ib = UI.w.ipBox(''); const err = h('div', { style: { color: '#b00020', minHeight: '16px' } });
      UI.dialog(desk, win, { title: 'Nouveau redirecteur conditionnel', w: 460, h: 260, body: h('div', UI.w.field('Domaine DNS :', zn, { lw: 200 }), UI.w.field('Adresse IP des serveurs maîtres :', ib, { lw: 200 }), err), buttons: [{ label: 'OK', def: true, fn: () => { const z = zn.value.trim().toLowerCase(); if (!/^[a-z0-9.-]+\.[a-z]+$/.test(z)) { err.textContent = 'Entrez un nom de domaine DNS valide.'; return false; } if (!U.isIP(ib.getValue())) { err.textContent = 'Entrez une adresse IP valide.'; return false; } dns().condForwarders = dns().condForwarders || []; if (dns().condForwarders.some(c => lc(c.zone) === z)) { err.textContent = 'Un redirecteur conditionnel existe déjà pour ce domaine.'; return false; } dns().condForwarders.push({ zone: z, servers: [ib.getValue()] }); changed('DNS : redirecteur conditionnel ' + z + ' → ' + ib.getValue() + ' créé'); } }, { label: 'Annuler' }] });
    };
    const dlgServerProps = () => {
      const lst = (dns().listen || []).slice(); const own = N.l3(desk.W, self.dev).map(x => x.ip); let all = !lst.length; const boxes = own.map(ip => UI.w.check(ip, lst.indexOf(ip) >= 0, v => { const i = lst.indexOf(ip); if (v && i < 0) lst.push(ip); if (!v && i >= 0) lst.splice(i, 1); ps.markDirty(); }, { disabled: false }));
      const listBox = h('div.dlist.tall', boxes);
      const r1 = UI.w.radio('lsn', 'Toutes les adresses IP', all, () => { all = true; ps.markDirty(); }), r2 = UI.w.radio('lsn', 'Seulement les adresses IP suivantes :', !all, () => { all = false; ps.markDirty(); });
      const rec = dns().recursion !== false; let recOff = !rec; const cb = UI.w.check('Désactiver la récursivité (désactive également les redirecteurs)', recOff, v => { recOff = v; ps.markDirty(); });
      const fw = h('div.pad', h('div', 'Les requêtes pour lesquelles ce serveur ne fait pas autorité sont transmises aux redirecteurs :'), h('div.dlist', (dns().forwarders || []).map(x => h('div.dli', x))), UI.w.btn('Modifier…', () => dlgForwarders(null)));
      const apply = () => { const bef = JSON.stringify([dns().listen, dns().recursion]); dns().listen = all ? [] : lst.slice(); dns().recursion = !recOff; if (bef !== JSON.stringify([dns().listen, dns().recursion])) changed('DNS : propriétés du serveur modifiées (interfaces : ' + (all ? 'toutes' : lst.join(', ') || 'aucune') + ' ; récursivité ' + (recOff ? 'désactivée' : 'activée') + ')'); return true; };
      const ps = UI.w.propertySheet({ wm: desk.wm, owner: win, title: 'Propriétés de ' + host(), icon: 'network', w: 480, h: 440, tabs: [{ label: 'Interfaces', content: () => h('div.pad', h('div', 'Sélectionnez les adresses IP qui peuvent répondre aux requêtes DNS.'), r1, r2, listBox) }, { label: 'Redirecteurs', content: () => fw }, { label: 'Avancé', content: () => h('div.pad', h('div', 'Options du serveur :'), cb) }], onOk: apply, onApply: apply });
    };
    const svcCtl = (verb) => {
      const sv = self.dev.win.svc.DNS; const wait = (t, f) => UI.w.progressDialog(desk.wm, win, 'Contrôle de service', t, 900, f);
      if (verb === 'start') { if (sv.start === 'disabled') { desk.msg({ title: 'Gestionnaire DNS', icon: 'error', owner: win, text: 'Windows n’a pas pu démarrer le service Serveur DNS.\nErreur 1058 : Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.' }); return; } wait('Démarrage du service Serveur DNS…', () => { WIN.setSvc(desk.W, self.dev.id, 'DNS', 'running'); desk.env.advance(2); changed('DNS : service Serveur DNS démarré'); }); }
      else if (verb === 'stop') wait('Arrêt du service Serveur DNS…', () => { WIN.setSvc(desk.W, self.dev.id, 'DNS', 'stopped'); desk.env.advance(2); changed('DNS : service Serveur DNS arrêté', { impact: 'svc-stop' }); });
      else wait('Redémarrage du service Serveur DNS…', () => { WIN.setSvc(desk.W, self.dev.id, 'DNS', 'stopped'); WIN.setSvc(desk.W, self.dev.id, 'DNS', 'running'); desk.env.advance(3); changed('DNS : service Serveur DNS redémarré'); });
    };
    const taskItems = () => { const st = self.dev.win.svc.DNS.state; return [{ label: 'Démarrer', disabled: st === 'running', fn: () => svcCtl('start') }, { label: 'Arrêter', disabled: st !== 'running', fn: () => svcCtl('stop') }, { label: 'Suspendre', disabled: true }, { label: 'Reprendre', disabled: true }, { label: 'Redémarrer', disabled: st !== 'running', fn: () => svcCtl('restart') }]; };

    /* ---------- vues ---------- */
    const folderRows = (z, path) => {
      const rel = path.slice().reverse().join('.'); const suffix = rel ? '.' + rel : ''; const rows = [];
      const fold = new Set();
      z.records.forEach(r => {
        const nm = r.name === '@' ? '' : r.name; let local;
        if (!path.length) { if (r.name === '@') local = '@'; else if (r.name.indexOf('.') < 0) local = r.name; else { fold.add(r.name.split('.').slice(1).reverse()[0]); return; } }
        else { if (r.name.endsWith(suffix) && r.name.length > suffix.length) { const left = r.name.slice(0, r.name.length - suffix.length); if (left.indexOf('.') < 0) local = left; else { fold.add(left.split('.').slice(1).reverse()[0]); return; } } else return; }
        void nm; rows.push({ rec: r, name: local === '@' ? '(identique au dossier parent)' : local, type: TYPE_LABEL[r.type] || r.type, data: dataLabel(r), ts: 'statique' });
      });
      const out = []; if (!path.length) {
        out.push({ name: '(identique au dossier parent)', type: TYPE_LABEL.SOA, data: '[' + (z.serial || 1) + '], ' + (z.records.find(r => r.type === 'NS') ? z.records.find(r => r.type === 'NS').data : fqdnOf(z, 'srv') ) + ', hostmaster.' + z.name + '.', ts: 'statique', soa: true });
      }
      Array.from(fold).sort().forEach(f => out.push({ name: f, type: '', data: '', ts: '', folder: f }));
      return out.concat(rows.sort((a, b) => a.name.localeCompare(b.name)));
    };
    const view = (n) => {
      let el, acts = [];
      if (n.zone) {
        const z = zone(n.zone); const rev = z.reverse || /in-addr\.arpa$/.test(z.name);
        const newItems = rev ? [{ label: 'Nouveau pointeur (PTR)…', fn: () => dlgNewPtr(z) }, { label: 'Nouvel hôte (A ou AAAA)…', disabled: true }] : [{ label: 'Nouvel hôte (A ou AAAA)…', fn: () => dlgHost(z) }, { label: 'Nouvel alias (CNAME)…', fn: () => dlgAlias(z) }, { label: 'Nouveau serveur de messagerie (MX)…', disabled: true }, { label: 'Nouveau domaine…', disabled: true }, { label: 'Nouvelle délégation…', disabled: true }, { label: 'Autres nouveaux enregistrements…', disabled: true }];
        const rows = folderRows(z, n.path);
        el = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 230, sort: false }, { key: 'type', label: 'Type', w: 200, sort: false }, { key: 'data', label: 'Données', w: 340, sort: false }, { key: 'ts', label: 'Horodateur', w: 100, sort: false }], rows, key: r => (r.folder ? 'f:' + r.folder : r.soa ? 'soa' : r.rec.id + '|' + r.rec.data), noHeader: false,
          onOpen: r => { if (r.folder) api.tree.select('z:' + z.name + ':' + n.path.concat(r.folder).join('/'), true); else if (r.rec) edit(z, r.rec); },
          onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, r.rec ? [{ label: 'Mettre à jour le fichier de données du serveur', disabled: true }, '-', { label: 'Supprimer', fn: () => delRec(z, r.rec) }, '-', { label: 'Propriétés', def: true, fn: () => edit(z, r.rec) }] : [{ label: 'Ouvrir', fn: () => api.tree.select('z:' + z.name + ':' + n.path.concat(r.folder || '').join('/'), true), disabled: !r.folder }]),
          onDelete: r => r.rec && delRec(z, r.rec), onContextEmpty: e => UI.w.contextMenu(e.clientX, e.clientY, newItems.concat(['-', { label: 'Actualiser', fn: refresh }])) }).el;
        acts = [{ title: n.path.length ? n.path[n.path.length - 1] : z.name, items: newItems.concat([{ label: 'Actualiser', fn: refresh }, { label: 'Propriétés', fn: () => dlgZoneProps(z), disabled: !!n.path.length }]) }];
      } else if (n.key === 'cfwd') {
        el = UI.w.listView({ columns: [{ key: 'zone', label: 'Nom', w: 260 }, { key: 'servers', label: 'Adresses IP des serveurs maîtres', w: 380, fmt: r => r.servers.join(', ') }], rows: dns().condForwarders || [], key: r => r.zone, onOpen: r => dlgForwarders(r), onContext: (r, e) => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Supprimer', fn: () => delCF(r) }, '-', { label: 'Propriétés', def: true, fn: () => dlgForwarders(r) }]), onDelete: r => delCF(r), onContextEmpty: e => UI.w.contextMenu(e.clientX, e.clientY, [{ label: 'Nouveau redirecteur conditionnel…', fn: dlgNewCF }]) }).el;
        acts = [{ title: 'Redirecteurs conditionnels', items: [{ label: 'Nouveau redirecteur conditionnel…', fn: dlgNewCF }, { label: 'Actualiser', fn: refresh }] }];
      } else if (n.key.indexOf('cf:') === 0) {
        const c = (dns().condForwarders || []).find(x => x.zone === n.key.slice(3)); el = UI.w.listView({ columns: [{ key: 'zone', label: 'Nom', w: 260 }, { key: 'servers', label: 'Adresses IP des serveurs maîtres', w: 380, fmt: r => r.servers.join(', ') }], rows: c ? [c] : [], key: r => r.zone, onOpen: r => dlgForwarders(r) }).el;
        acts = [{ title: n.label, items: [{ label: 'Supprimer', fn: () => c && delCF(c) }, { label: 'Propriétés', fn: () => c && dlgForwarders(c) }] }];
      } else if (n.key === 'srv') {
        el = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 360, sort: false }], rows: [{ name: 'Zones de recherche directes' }, { name: 'Zones de recherche inversée' }, { name: 'Points d’approbation' }, { name: 'Redirecteurs conditionnels' }] }).el;
        acts = [{ title: host(), items: [{ label: 'Configurer un serveur DNS…', disabled: true }, { label: 'Nouvelle zone…', disabled: true }, { label: 'Définir l’ancienneté/le nettoyage pour toutes les zones…', disabled: true }, { label: 'Effacer le cache', fn: () => { changed('DNS : cache du serveur vidé'); } }, { label: 'Toutes les tâches', items: taskItems() }, { label: 'Actualiser', fn: refresh }, { label: 'Propriétés', fn: dlgServerProps }] }];
      } else { el = UI.w.listView({ columns: [{ key: 'name', label: 'Nom', w: 360 }], rows: [], empty: 'Aucun élément à afficher dans cette vue.' }).el; acts = [{ title: n.label, items: [{ label: 'Actualiser', fn: refresh }] }]; }
      return { el, acts };
    };
    const delCF = c => UI.confirm(desk, win, { title: 'Gestionnaire DNS', text: 'Voulez-vous supprimer le redirecteur conditionnel « ' + c.zone + ' » ?', onYes: () => { dns().condForwarders = dns().condForwarders.filter(x => x !== c); changed('DNS : redirecteur conditionnel ' + c.zone + ' supprimé'); } });
    const show = n => { if (!n) return; const v = view(n); api.setMid(v.el); api.setActions(v.acts); };
    function refresh() { api.tree.setRoots(roots()); const s = api.tree.selected(); if (!s) { api.tree.select('srv', true); return; } show(s); }
    const menu = [{ label: 'Fichier', items: [{ label: 'Quitter', fn: () => win.close() }] }, { label: 'Action', items: () => { const n = api.tree.selected(); return n ? view(n).acts[0].items : []; } }, { label: 'Affichage', items: [{ label: 'Actualiser', fn: refresh }] }, { label: '?', items: [{ label: 'À propos du Gestionnaire DNS', disabled: true }] }];
    win = UI.w.mmc({ wm: desk.wm, title: 'Gestionnaire DNS', icon: 'network', w: 980, h: 560, menu, roots: roots(), select: 'srv', onSelect: (n, a) => { api = a; show(n); }, onRefresh: refresh, onTreeContext: n => view(n).acts[0].items });
    api = win.mmc; win.appId = 'dns'; desk.act('Ouverture du Gestionnaire DNS sur ' + self.dev.name, { kind: 'ui' });
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
