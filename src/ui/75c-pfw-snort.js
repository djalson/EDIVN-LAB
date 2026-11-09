/* ============================================================================
   Interface web du pare-feu — paquet Snort (IDS / IPS) :
   System > Package Manager (entrée Snort), Services > Snort (Snort Interfaces, réglages d'une interface,
   règles personnelles custom.rules, Alerts, Blocked, Pass Lists, Global Settings),
   lignes « snort » de Status > Services (démarrage, arrêt, redémarrage par instance).
   Les réglages s'appliquent à l'enregistrement (pas de mise en attente) ; seules les règles de custom.rules
   déclenchent des alertes (voir docs/LIMITES.md). Les onglets sans effet sur le jeu affichent « Page non simulée ».
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h, PW = UI.pfw, SQ = SIM.squid, SN = SIM.snort;
SIM.AVREG['pfsense-gui-snort'] = 'Interface web pfSense, paquet Snort : noms de fichiers (snort/snort_interfaces.php, snort_interfaces_edit.php, snort_rules.php, snort_alerts.php, snort_blocked.php, snort_passlist.php…), onglets (Snort Interfaces, Global Settings, Updates, Alerts, Blocked, Pass Lists, Suppress, IP Lists, SID Mgmt, Log Mgmt, Sync ; par interface : Settings, Categories, Rules, Variables, Preprocs, Barnyard2, IP Rep, Logs), colonnes des listes, libellés des cases et des listes déroulantes, message d’enregistrement et ligne « Snort IDS/IPS Daemon » de Status > Services — reconstitués de mémoire, à comparer aux captures du lot E (E1 à E6).';
SIM.AVREG['pfsense-gui-snort-modes'] = 'Snort sous pfSense : le moteur de détection du jeu applique les réglages à l’enregistrement et ne simule que le mode Legacy ; la vraie interface demande de redémarrer l’instance après certaines modifications et propose aussi le mode Inline (non simulé).';

SQ.PKGS.snort = { pkg: 'pfSense-pkg-snort', ver: '4.1.6', cat: 'Security', desc: 'Snort is an open source network intrusion prevention and detection system (IDS/IPS).' };

/* installation du paquet : crée la configuration vide (aucune instance) */
const baseInstall = SQ.pkgInstall;
SQ.pkgInstall = function (W, d, name) {
  const r = baseInstall(W, d, name);
  if (r.ok && name === 'snort') {
    if (!d.snort) d.snort = { global: { community: false, etopen: false, vrt: false }, passLists: [], ifaces: [] };
    if (!d.snortBlocked) d.snortBlocked = [];
  }
  return r;
};

/* ------------------------------------------------------------------ utilitaires */
const note = (P, text, secs, touch) => { P.desk.env.advance(secs === undefined ? 2 : secs); P.desk.env.touch(touch || 'snort'); P.desk.change('pfSense (' + (P.d.hostname || P.host) + ') : ' + text, { dev: P.host }); };
const lines = t => String(t || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const okCidr = s => { try { const c = U.parseCidr(s.indexOf('/') < 0 ? s + '/32' : s); return !!c && U.isIP(c.net) && c.len >= 0 && c.len <= 32; } catch (e) { return false; } };
const tag = (ok, a, b) => h('span.pfw-tag.' + (ok ? 'ok' : 'ko'), ok ? a : b);
const needPkg = P => SN.pkg(P.d) ? null : PW.alert('danger', 'The package pfSense-pkg-snort is not installed. Install it from System > Package Manager.');
const cfg = P => P.d.snort;
const ifl = (P, si) => PW.ifLabel(P.d, si.iface);
const ifaceOf = P => { const i = parseInt(P.q.id, 10); const l = cfg(P).ifaces; return i >= 0 && i < l.length ? { i, si: l[i] } : null; };
const stubBox = (what) => PW.alert('info', h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, 'Page non simulée'), h('div', what || 'Cet onglet existe dans la vraie interface mais n’est pas reproduit : il n’intervient dans aucun scénario du référentiel (onglets utiles : Snort Interfaces, Alerts, Blocked, Pass Lists et, par interface, Settings et Rules).'));

/* ------------------------------------------------------------------ onglets */
const GLOBAL_TABS = [
  ['ifaces', 'Snort Interfaces', 'snort/snort_interfaces.php'], ['global', 'Global Settings', 'snort/snort_interfaces_global.php'], ['upd', 'Updates', 'snort/snort_download_updates.php'],
  ['alerts', 'Alerts', 'snort/snort_alerts.php'], ['blocked', 'Blocked', 'snort/snort_blocked.php'], ['pass', 'Pass Lists', 'snort/snort_passlist.php'],
  ['supp', 'Suppress', 'snort/snort_interfaces_suppress.php'], ['iprep', 'IP Lists', 'snort/snort_iprep.php'], ['sid', 'SID Mgmt', 'snort/snort_sid_mgmt.php'],
  ['logm', 'Log Mgmt', 'snort/snort_log_mgmt.php'], ['sync', 'Sync', 'snort/snort_xmlrpc_sync.php']
];
const gTabs = (P, cur) => PW.tabs(GLOBAL_TABS.map(t => ({ key: t[0], label: t[1], go: () => P.go(t[2]) })), cur);
const IF_TABS = [
  ['set', 'Settings', 'snort/snort_interfaces_edit.php'], ['cat', 'Categories', 'snort/snort_rulesets.php'], ['rules', 'Rules', 'snort/snort_rules.php'], ['var', 'Variables', 'snort/snort_define_servers.php'],
  ['pre', 'Preprocs', 'snort/snort_preprocessors.php'], ['by', 'Barnyard2', 'snort/snort_barnyard.php'], ['rep', 'IP Rep', 'snort/snort_ip_reputation.php'], ['logs', 'Logs', 'snort/snort_interface_logs.php']
];
const iTabs = (P, id, cur) => PW.tabs(IF_TABS.map(t => ({ key: t[0], label: ifl(P, cfg(P).ifaces[id]) + ' ' + t[1], go: () => P.go(t[2], { id }) })), cur);

/* ------------------------------------------------------------------ pages sans effet dans le jeu */
GLOBAL_TABS.forEach(t => {
  if (['ifaces', 'global', 'alerts', 'blocked', 'pass'].indexOf(t[0]) >= 0) return;
  PW.page(t[2], { crumbs: ['Services', 'Snort', t[1]], render: P => { const m = needPkg(P); if (m) return m; const root = h('div'); root.append(gTabs(P, t[0]), stubBox()); return root; } });
});
IF_TABS.forEach(t => {
  if (t[0] === 'set' || t[0] === 'rules') return;
  PW.page(t[2], {
    crumbs: ['Services', 'Snort', t[1]],
    render: P => {
      const m = needPkg(P); if (m) return m; const r = ifaceOf(P); const root = h('div');
      if (!r) return PW.alert('danger', 'Instance Snort introuvable.');
      root.append(gTabs(P, 'ifaces'), iTabs(P, r.i, t[0]), stubBox(t[0] === 'cat' ? 'Les catégories de règles préinstallées (Snort VRT, Emerging Threats, communauté) ne sont pas simulées : seules les règles de custom.rules (onglet Rules) déclenchent des alertes.' : undefined));
      return root;
    }
  });
});

/* ================================================================== Services > Snort > Snort Interfaces */
PW.page('snort/snort_interfaces.php', {
  crumbs: ['Services', 'Snort', 'Snort Interfaces'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const root = h('div'); root.append(gTabs(P, 'ifaces'));
    const L = cfg(P).ifaces;
    const startStop = (i, op) => {
      const si = L[i];
      if (op === 'stop') { si.stopped = true; note(P, 'Snort — instance ' + ifl(P, si) + ' arrêtée', 2); P.setFlash('success', 'Snort a été arrêté sur l’interface ' + ifl(P, si) + '.'); }
      else {
        si.stopped = false; const st = SN.state(d, si);
        note(P, 'Snort — démarrage de l’instance ' + ifl(P, si) + (st.run ? ' réussi' : ' en échec (' + st.why + ')'), 4);
        if (st.run) P.setFlash('success', 'Snort a démarré sur l’interface ' + ifl(P, si) + '.'); else P.setFlash('danger', 'Snort n’a pas pu démarrer sur l’interface ' + ifl(P, si) + ' : ' + st.why + '.');
      }
      P.go('snort/snort_interfaces.php');
    };
    const rows = L.map((si, i) => {
      const st = SN.state(d, si);
      return h('tr',
        h('td', ifl(P, si)), h('td', tag(st.run, 'Running', 'Stopped')), h('td', 'AC-BNFA'), h('td', si.block ? 'LEGACY MODE' : 'DISABLED'), h('td', si.descr || ''),
        h('td.act',
          h('a', { title: st.run ? 'Stop Snort on this interface' : 'Start Snort on this interface', on: { click: e => { e.preventDefault(); startStop(i, st.run ? 'stop' : 'start'); } } }, PW.ic(st.run ? 'stop' : 'play')),
          h('a', { title: 'Edit this Snort interface', on: { click: e => { e.preventDefault(); P.go('snort/snort_interfaces_edit.php', { id: i }); } } }, PW.ic('edit')),
          h('a', { title: 'Delete this Snort interface', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you want to delete this Snort interface?', () => { L.splice(i, 1); note(P, 'Snort — instance supprimée', 2); P.setFlash('success', 'The Snort interface has been deleted.'); P.go('snort/snort_interfaces.php'); }); } } }, PW.ic('del'))));
    });
    root.append(PW.panel('Snort Interfaces', rows.length ? PW.table(['Interface', 'Snort Status', 'Pattern Match', 'Blocking Mode', 'Description', 'Actions'], rows) : h('div', { style: { padding: '10px' } }, 'No Snort interfaces have been configured.'), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('snort/snort_interfaces_edit.php'))));
    return root;
  }
});

/* ================================================================== réglages d'une interface */
PW.page('snort/snort_interfaces_edit.php', {
  crumbs: ['Services', 'Snort', 'Interface Settings'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const S = cfg(P); const root = h('div'); const r = ifaceOf(P); const isNew = !r;
    if (P.q.id !== undefined && P.q.id !== '' && !r) return PW.alert('danger', 'Instance Snort introuvable.');
    const si = r ? r.si : { iface: '', descr: '', enabled: true, stopped: false, ips: 'legacy', block: false, blockWhich: 'src', homeNet: 'default', homeNetList: [], passList: 'default', syslog: false, custom: '' };
    root.append(gTabs(P, 'ifaces')); if (r) root.append(iTabs(P, r.i, 'set'));
    const used = S.ifaces.map(x => x.iface).filter(k => k !== si.iface);
    const ifOpts = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual && used.indexOf(k) < 0).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
    const form = PW.form(P, {
      title: 'General Settings',
      fields: [
        { k: 'en', label: 'Enable', type: 'check', text: 'Enable interface', value: !!si.enabled },
        { k: 'if', label: 'Interface', type: 'select', options: ifOpts, value: si.iface || (ifOpts[0] && ifOpts[0].value), help: 'Choose the interface where you want Snort to inspect traffic.' },
        { k: 'descr', label: 'Description', type: 'text', value: si.descr || '', w: 320, help: 'Enter a meaningful description here for your reference.' },
        { k: 'sys', label: 'Send Alerts to System Log', type: 'check', text: 'Snort will send Alerts to the firewall\'s system log.', value: !!si.syslog },
        { panel: 'Alert Settings' },
        { k: 'blk', label: 'Block Offenders', type: 'check', text: 'Checking this option will automatically block hosts that generate a Snort alert.', value: !!si.block },
        { k: 'ips', label: 'IPS Mode', type: 'select', options: [{ value: 'legacy', label: 'Legacy Mode' }], value: 'legacy', show: v => v.blk, help: 'Legacy Mode inspects copies of packets and blocks the offending host in the firewall (mode Inline non simulé).' },
        { k: 'which', label: 'Which IP to Block', type: 'select', options: [{ value: 'src', label: 'SRC' }, { value: 'dst', label: 'DST' }, { value: 'both', label: 'BOTH' }], value: si.blockWhich || 'src', show: v => v.blk, help: 'Select which IP extracted from the packet you wish to block.' },
        { panel: 'Choose the networks Snort should inspect and whitelist' },
        { k: 'hn', label: 'Home Net', type: 'select', options: [{ value: 'default', label: 'default' }, { value: 'custom', label: 'Custom list' }], value: si.homeNet === 'custom' ? 'custom' : 'default', help: 'Choose the Home Net you want this interface to use. The default Home Net adds only local networks, WAN IPs, Gateways, VPNs and VIPs.' },
        { k: 'hnl', label: 'Custom Home Net', type: 'textarea', rows: 4, value: (si.homeNetList || []).join('\n'), show: v => v.hn === 'custom', help: 'One address or subnet per line (example: 10.10.0.0/16).' },
        { k: 'pl', label: 'Pass List', type: 'select', options: [{ value: 'default', label: 'default' }, { value: 'none', label: 'none' }].concat((S.passLists || []).map(l => ({ value: l.name, label: l.name }))), value: si.passList || 'default', help: 'Choose the Pass List you want this interface to use. Hosts of the Pass List are never blocked.' }
      ],
      save: v => {
        const errs = [];
        if (!v.if) errs.push('An interface must be selected.');
        const hl = lines(v.hnl);
        if (v.hn === 'custom') { if (!hl.length) errs.push('At least one address must be entered for a custom Home Net.'); hl.forEach(s => { if (!okCidr(s)) errs.push('"' + s + '" is not a valid address or subnet (expected format: 10.10.0.0/16).'); }); }
        if (errs.length) return errs;
        const nd = { iface: v.if, descr: v.descr.trim(), enabled: !!v.en, stopped: si.stopped, ips: 'legacy', block: !!v.blk, blockWhich: v.which || 'src', homeNet: v.hn, homeNetList: v.hn === 'custom' ? hl : [], passList: v.pl, syslog: !!v.sys, custom: si.custom || '' };
        if (isNew) { if (!nd.descr) nd.descr = PW.ifLabel(d, v.if); S.ifaces.push(nd); } else Object.assign(si, nd);
        const idx = isNew ? S.ifaces.length - 1 : r.i; const st = SN.state(d, S.ifaces[idx]);
        note(P, 'Snort — réglages de l’interface ' + PW.ifLabel(d, v.if) + ' enregistrés' + (st.run ? '' : ' (instance non démarrée : ' + st.why + ')'), 3);
        P.setFlash('success', 'The changes have been saved for the ' + PW.ifLabel(d, v.if) + ' interface.'); P.go('snort/snort_interfaces_edit.php', { id: idx }); return null;
      }
    });
    root.append(form.el); return root;
  }
});

/* ================================================================== règles : custom.rules */
PW.page('snort/snort_rules.php', {
  crumbs: ['Services', 'Snort', 'Rules'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const r = ifaceOf(P); if (!r) return PW.alert('danger', 'Instance Snort introuvable.');
    const si = r.si; const root = h('div'); root.append(gTabs(P, 'ifaces'), iTabs(P, r.i, 'rules'));
    const cat = P.q.openruleset || 'custom.rules';
    const sel = h('select.form-control', { style: { width: '320px' } }, ['custom.rules', 'snort_community.rules', 'emerging-attack_response.rules', 'emerging-scan.rules', 'snort_icmp.rules'].map(c => h('option', { value: c, selected: c === cat }, c)));
    sel.addEventListener('change', () => P.go('snort/snort_rules.php', { id: r.i, openruleset: sel.value }));
    root.append(PW.panel('Available Rule Categories', h('div.pfw-pb', h('div.pfw-fg', h('label.pfw-lbl', 'Category'), h('div.pfw-inp', sel, h('span.pfw-help', 'Select the rule category to view and edit.'))))));
    if (cat !== 'custom.rules') { root.append(stubBox('Les catégories de règles préinstallées ne sont pas simulées : seules les règles de custom.rules déclenchent des alertes dans le jeu.')); return root; }
    const st = SN.state(d, si);
    if (!st.run && st.why.indexOf('custom.rules') >= 0) root.append(PW.alert('danger', 'Snort ne peut pas démarrer sur ' + ifl(P, si) + ' : ' + st.why + '.'));
    const pr = SN.parsed(si); pr.rules.filter(x => x.dead).forEach(x => root.append(PW.alert('warning', 'custom.rules, ligne ' + x.line + ' : ' + x.dead + '.')));
    const form = PW.form(P, {
      title: 'Defined Custom Rules',
      fields: [{ k: 'txt', label: 'Defined Custom Rules', type: 'textarea', rows: 14, value: si.custom || '', help: 'Une règle par ligne (syntaxe Snort). Le fichier est rechargé au démarrage de l’instance.' }],
      save: v => {
        si.custom = v.txt.replace(/\r/g, ''); const p2 = SN.parseRules(si.custom); const s2 = SN.state(d, si);
        note(P, 'Snort — custom.rules de l’interface ' + ifl(P, si) + ' enregistré (' + p2.rules.length + ' règle(s)' + (p2.errors.length ? ', ' + p2.errors.length + ' erreur(s)' : '') + ')', 3);
        if (p2.errors.length) P.setFlash('danger', 'custom.rules enregistré, mais ligne ' + p2.errors[0].line + ' : ' + p2.errors[0].msg + '. L’instance ne peut pas démarrer tant que le fichier est invalide.');
        else P.setFlash('success', 'custom.rules enregistré' + (s2.run ? '.' : ' ; l’instance n’est pas démarrée (' + s2.why + ').'));
        P.go('snort/snort_rules.php', { id: r.i, openruleset: 'custom.rules' }); return null;
      }
    });
    root.append(form.el); return root;
  }
});

/* ================================================================== Alerts */
PW.page('snort/snort_alerts.php', {
  crumbs: ['Services', 'Snort', 'Alerts'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const S = cfg(P); const root = h('div'); root.append(gTabs(P, 'alerts'));
    if (!S.ifaces.length) { root.append(PW.alert('info', 'No Snort interfaces have been configured.')); return root; }
    const cur = P.q.instance !== undefined ? Math.max(0, Math.min(S.ifaces.length - 1, parseInt(P.q.instance, 10) || 0)) : 0; const si = S.ifaces[cur];
    const sel = h('select.form-control', { style: { width: '260px' } }, S.ifaces.map((x, i) => h('option', { value: i, selected: i === cur }, ifl(P, x) + ' (' + (x.descr || '') + ')')));
    sel.addEventListener('change', () => P.go('snort/snort_alerts.php', { instance: sel.value }));
    root.append(PW.panel('Alert Log View Settings', h('div.pfw-pb', h('div.pfw-fg', h('label.pfw-lbl', 'Instance to Inspect'), h('div.pfw-inp', sel)))));
    const al = (d._rt.snortAlerts || []).filter(a => a.ifk === si.iface).slice(-250).reverse();
    const rows = al.map(a => h('tr', h('td', PW.fmtTime(a.t)), h('td', a.pri), h('td', String(a.proto).toUpperCase()), h('td', a.cls), h('td', a.src), h('td', a.sport === undefined ? '' : a.sport), h('td', a.dst), h('td', a.dport === undefined ? '' : a.dport), h('td', a.gid + ':' + a.sid), h('td', a.msg)));
    root.append(PW.panel('Last ' + Math.min(al.length, 250) + ' Alert Entries', al.length ? PW.table(['Date', 'Pri', 'Proto', 'Class', 'Src', 'SPort', 'Dst', 'DPort', 'SID', 'Description'], rows) : h('div', { style: { padding: '10px' } }, 'No entries in the alert log for this interface.'), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn('Clear', 'danger', () => PW.confirm(P, 'Are you sure you want to clear the alert log of this interface?', () => { d._rt.snortAlerts = (d._rt.snortAlerts || []).filter(a => a.ifk !== si.iface); note(P, 'Snort — journal des alertes de ' + ifl(P, si) + ' vidé', 1); P.go('snort/snort_alerts.php', { instance: cur }); }))));
    return root;
  }
});

/* ================================================================== Blocked */
PW.page('snort/snort_blocked.php', {
  crumbs: ['Services', 'Snort', 'Blocked'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const root = h('div'); root.append(gTabs(P, 'blocked'));
    const L = d.snortBlocked || [];
    const rows = L.map((b, i) => h('tr', h('td', String(i + 1)), h('td', b.ip), h('td', b.msg + (b.sid ? ' (SID ' + b.sid + ')' : '')), h('td', PW.fmtTime(b.t)),
      h('td.act', h('a', { title: 'Remove host from the Blocked Table', on: { click: e => { e.preventDefault(); const k = d.snortBlocked.indexOf(b); if (k >= 0) d.snortBlocked.splice(k, 1); note(P, 'Snort — hôte ' + b.ip + ' retiré de la table des hôtes bloqués', 2); P.setFlash('success', 'The host ' + b.ip + ' has been removed from the Blocked Table.'); P.go('snort/snort_blocked.php'); } } }, PW.ic('del')))));
    root.append(PW.panel('Last ' + L.length + ' Hosts Blocked by Snort', L.length ? PW.table(['#', 'IP', 'Alert Description(s)', 'Date', 'Remove'], rows) : h('div', { style: { padding: '10px' } }, 'There are currently no hosts blocked by Snort.'), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn('Clear', 'danger', () => PW.confirm(P, 'Are you sure you want to remove all blocked hosts?', () => { d.snortBlocked = []; note(P, 'Snort — table des hôtes bloqués vidée', 2); P.setFlash('success', 'All blocked hosts have been removed.'); P.go('snort/snort_blocked.php'); }))));
    return root;
  }
});

/* ================================================================== Pass Lists */
PW.page('snort/snort_passlist.php', {
  crumbs: ['Services', 'Snort', 'Pass Lists'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const S = cfg(P); const root = h('div'); root.append(gTabs(P, 'pass'));
    const rows = [h('tr', h('td', 'default'), h('td', 'Liste de passage par défaut (adresses locales du pare-feu)'), h('td.act'))].concat((S.passLists || []).map((l, i) => h('tr', h('td', l.name), h('td', l.descr || ''), h('td.act',
      h('a', { title: 'Edit this Pass List', on: { click: e => { e.preventDefault(); P.go('snort/snort_passlist_edit.php', { id: i }); } } }, PW.ic('edit')),
      h('a', { title: 'Delete this Pass List', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you want to delete this Pass List?', () => {
        if (S.ifaces.some(x => x.passList === l.name)) { P.setFlash('danger', 'The Pass List ' + l.name + ' is still used by a Snort interface and cannot be deleted.'); P.go('snort/snort_passlist.php'); return; }
        S.passLists.splice(i, 1); note(P, 'Snort — liste de passage ' + l.name + ' supprimée', 2); P.setFlash('success', 'The Pass List has been deleted.'); P.go('snort/snort_passlist.php'); }); } } }, PW.ic('del'))))));
    root.append(PW.panel('Pass Lists', PW.table(['List Name', 'Description', 'Actions'], rows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('snort/snort_passlist_edit.php'))));
    return root;
  }
});
PW.page('snort/snort_passlist_edit.php', {
  crumbs: ['Services', 'Snort', 'Pass Lists', 'Edit'],
  render: P => {
    const d = P.d; const m = needPkg(P); if (m) return m; const S = cfg(P); const root = h('div'); root.append(gTabs(P, 'pass'));
    const i = parseInt(P.q.id, 10); const cur = i >= 0 && S.passLists[i] ? S.passLists[i] : null; const isNew = !cur;
    const form = PW.form(P, {
      title: 'General Settings',
      fields: [
        { k: 'name', label: 'Name', type: 'text', value: cur ? cur.name : '', w: 260, help: 'The list name may only consist of the characters a-z, A-Z, 0-9 and _.' },
        { k: 'descr', label: 'Description', type: 'text', value: cur ? (cur.descr || '') : '', w: 320 },
        { k: 'addrs', label: 'Addresses', type: 'textarea', rows: 6, value: cur ? (cur.addrs || []).join('\n') : '', help: 'One host address or subnet per line (example: 198.51.100.77 or 10.10.0.0/16).' }
      ],
      save: v => {
        const errs = []; const name = v.name.trim(); const a = lines(v.addrs);
        if (!/^[A-Za-z0-9_]+$/.test(name)) errs.push('The list name may only consist of the characters a-z, A-Z, 0-9 and _.');
        else if (name === 'default' || name === 'none' || S.passLists.some((l, k) => l.name === name && k !== i)) errs.push('A Pass List with this name already exists.');
        a.forEach(s => { if (!okCidr(s)) errs.push('"' + s + '" is not a valid address or subnet.'); });
        if (errs.length) return errs;
        if (isNew) S.passLists.push({ name, descr: v.descr.trim(), addrs: a }); else { S.ifaces.forEach(x => { if (x.passList === cur.name) x.passList = name; }); Object.assign(cur, { name, descr: v.descr.trim(), addrs: a }); }
        note(P, 'Snort — liste de passage ' + name + ' enregistrée (' + a.length + ' entrée(s))', 2);
        P.setFlash('success', 'The Pass List has been saved.'); P.go('snort/snort_passlist.php'); return null;
      }
    });
    root.append(form.el); return root;
  }
});

/* ================================================================== Global Settings */
PW.page('snort/snort_interfaces_global.php', {
  crumbs: ['Services', 'Snort', 'Global Settings'],
  render: P => {
    const m = needPkg(P); if (m) return m; const S = cfg(P); const root = h('div'); root.append(gTabs(P, 'global'));
    root.append(PW.alert('info', 'Les jeux de règles ci-dessous sont affichés mais ne sont pas simulés : seules les règles de custom.rules déclenchent des alertes.'));
    const form = PW.form(P, {
      title: 'Please Choose The Type Of Rules You Wish To Download',
      fields: [
        { k: 'com', label: 'Install Snort GPLv2 Community Rules', type: 'check', text: 'Click to install the Snort GPLv2 Community Rules', value: !!(S.global && S.global.community) },
        { k: 'et', label: 'Install ETOpen Emerging Threats rules', type: 'check', text: 'Click to install the ETOpen Emerging Threats rules', value: !!(S.global && S.global.etopen) },
        { k: 'vrt', label: 'Install Snort Subscriber rules', type: 'check', text: 'Click to install the Snort Subscriber rules (an Oinkcode is required)', value: !!(S.global && S.global.vrt) }
      ],
      save: v => { S.global = { community: !!v.com, etopen: !!v.et, vrt: !!v.vrt }; note(P, 'Snort — réglages globaux enregistrés', 2); P.setFlash('success', 'The Global Settings have been saved.'); P.go('snort/snort_interfaces_global.php'); return null; }
    });
    root.append(form.el); return root;
  }
});

/* ------------------------------------------------------------------ Status > Services : une ligne par instance activée */
const baseExtra = PW.extraServices;
PW.extraServices = function (P) {
  const out = baseExtra ? baseExtra(P) : []; const d = P.d;
  if (SN.pkg(d) && d.snort) d.snort.ifaces.forEach((si, i) => {
    if (!si.enabled) return; const st = SN.state(d, si);
    out.push({ name: 'snort', key: 'snort:' + i, desc: 'Snort IDS/IPS Daemon - ' + ifl(P, si), run: st.run, acts: st.run ? ['restart', 'stop'] : ['start'] });
  });
  return out;
};
const baseAction = PW.svcAction;
PW.svcAction = function (P, svc, op) {
  const m = /^snort:(\d+)$/.exec(String(svc));
  if (!m) return baseAction(P, svc, op);
  const d = P.d; const si = d.snort && d.snort.ifaces[+m[1]]; if (!si) { P.go('status_services.php'); return; }
  if (op === 'stop') si.stopped = true; else si.stopped = false;
  const st = SN.state(d, si);
  note(P, 'Status > Services — snort (' + ifl(P, si) + ') : ' + ({ restart: 'redémarrage', stop: 'arrêt', start: 'démarrage' })[op] + (op !== 'stop' && !st.run ? ' en échec (' + st.why + ')' : ''), 3, 'pf-svc');
  if (op === 'stop' || st.run) P.setFlash('success', 'Service snort ' + ({ restart: 'restarted', stop: 'stopped', start: 'started' })[op] + ' successfully.');
  else P.setFlash('danger', 'Service snort (' + ifl(P, si) + ') could not be started: ' + st.why + '.');
  P.go('status_services.php');
};

/* ------------------------------------------------------------------ menu Services */
const baseMenus = PW.menus;
PW.menus = P => {
  const m = baseMenus(P); const sv = m.find(x => x.label === 'Services');
  if (sv && SN.pkg(P.d)) { const i = sv.items.findIndex(x => x && x.label === 'SNMP'); sv.items.splice(i < 0 ? sv.items.length : i + 1, 0, { label: 'Snort', file: 'snort/snort_interfaces.php' }); }
  return m;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
