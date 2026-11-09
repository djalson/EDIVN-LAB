/* ============================================================================
   Interface web du pare-feu — menu Firewall : Rules (par interface), Aliases, NAT (Port Forward, Outbound).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, h = UI.h, PW = UI.pfw;
SIM.AVREG['pfsense-gui-rules'] = 'Interface web pfSense, Firewall → Rules : colonnes (States, Protocol, Source, Port, Destination, Port, Gateway, Queue, Schedule, Description, Actions), libellés « Block private networks and loopback addresses », « Block bogon networks », « Anti-Lockout Rule », intitulés de l’édition de règle, messages de validation — à vérifier. La colonne « States » est approximée par le compteur de correspondances.';
SIM.AVREG['pfsense-gui-nat'] = 'Interface web pfSense, Firewall → NAT : colonnes, intitulés des quatre modes de NAT sortant (Automatic / Hybrid / Manual / Disable), liste « Filter rule association » — à vérifier.';

const RIF = d => ['wan', 'lan', 'dmz', 'enc0', 'ovpns1'].filter(k => d.ifaces[k] || (d.rules && d.rules[k]));
const PRESETS = [['', '(other)'], ['80', 'HTTP (80)'], ['443', 'HTTPS (443)'], ['53', 'DNS (53)'], ['22', 'SSH (22)'], ['25', 'SMTP (25)'], ['3389', 'MS RDP (3389)'], ['445', 'MS DS (445)'], ['1194', 'OpenVPN (1194)'], ['500', 'IKE (500)'], ['4500', 'IPsec NAT-T (4500)']];
const isPortNum = s => /^\d+$/.test(s) && +s >= 1 && +s <= 65535;

/* champ « plage de ports » : préréglage + saisie libre, de/à */
function portRange(P, init) {
  const parts = String(init === undefined || init === null ? '' : init).split('-');
  const mk = v => { const sel = h('select.form-control.sm', PRESETS.map(p => h('option', { value: p[0], selected: p[0] === v }, p[1]))); const txt = h('input.form-control.sm', { type: 'text', value: v, spellcheck: false, style: { width: '110px' } }); sel.addEventListener('change', () => { if (sel.value) txt.value = sel.value; }); return { sel, txt }; };
  const aliasOk = parts.length === 1 && !isPortNum(parts[0]) && parts[0] !== '';
  const a = mk(parts[0] || ''), b = mk(parts[1] || '');
  const el = h('div.pfw-inline', h('span', 'From:'), a.sel, a.txt, h('span', 'To:'), b.sel, b.txt);
  void aliasOk;
  return { el, get: () => { const f = a.txt.value.trim(), t = b.txt.value.trim(); return !f ? '' : (t && t !== f ? f + '-' + t : f); } };
}
/* validation d'un port / alias de ports */
function portErr(P, v, what) {
  if (v === '') return null;
  const al = (P.sec('aliases') || []).find(x => x.name === v);
  if (al) return al.type === 'port' ? null : 'The alias ' + v + ' is not a port alias (' + what + ').';
  const m = v.split('-');
  if (m.length > 2 || !m.every(isPortNum)) return 'The ' + what + ' port range is invalid: ports must be numbers between 1 and 65535, or a port alias.';
  if (m.length === 2 && +m[0] > +m[1]) return 'The ' + what + ' port range is invalid: the first port must be lower than the second.';
  return null;
}

/* saisie d'adresse : [inverser] type + adresse + masque */
function addrInput(P, spec, what, o) {
  o = o || {}; const d = P.d; const ifs = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual);
  const opts = [['any', 'Any'], ['host', 'Single host or alias'], ['net', 'Network'], ['self', 'This firewall (self)']];
  ifs.forEach(k => { opts.push(['ifnet:' + k, PW.ifLabel(d, k) + ' subnets']); opts.push(['ifaddr:' + k, PW.ifLabel(d, k) + ' address']); });
  const t0 = !spec || spec.t === 'any' ? 'any' : spec.t === 'host' || spec.t === 'alias' ? 'host' : spec.t === 'net' ? 'net' : spec.t === 'self' ? 'self' : spec.t + ':' + spec.v;
  const cp = spec && spec.t === 'net' ? PW.cidrParts(spec.v) : null;
  const neg = h('input', { type: 'checkbox', checked: !!(spec && spec.neg) });
  const sel = h('select.form-control.sm', opts.map(x => h('option', { value: x[0], selected: x[0] === t0 }, x[1])));
  const addr = h('input.form-control.sm', { type: 'text', spellcheck: false, value: spec && (spec.t === 'host' || spec.t === 'alias') ? spec.v : cp ? cp.addr : '', style: { width: '150px' } });
  const msk = h('select.form-control.sm', PW.maskOpts().map(x => h('option', { value: x.value, selected: cp ? +x.value === cp.len : +x.value === 24 }, x.label)));
  const vis = () => { const t = sel.value; addr.style.display = t === 'host' || t === 'net' ? '' : 'none'; msk.style.display = t === 'net' ? '' : 'none'; };
  sel.addEventListener('change', vis); vis();
  const el = h('div.pfw-inline', h('label.pfw-chk', neg, h('span', 'Invert match')), sel, addr, msk);
  const get = () => {
    const t = sel.value; const n = neg.checked ? { neg: true } : {};
    if (t === 'any') return { spec: { t: 'any' } };
    if (t === 'self') return { spec: Object.assign({ t: 'self' }, n) };
    if (t.indexOf(':') > 0) { const [tt, v] = t.split(':'); return { spec: Object.assign({ t: tt, v }, n) }; }
    const a = addr.value.trim();
    if (t === 'host') {
      if ((P.sec('aliases') || []).some(x => x.name === a)) return { spec: Object.assign({ t: 'alias', v: a }, n) };
      if (U.isIP(a)) return { spec: Object.assign({ t: 'host', v: a }, n) };
      return { err: 'A valid ' + what + ' IP address or alias must be specified.' };
    }
    if (!U.isIP(a)) return { err: 'A valid ' + what + ' IP address must be specified.' };
    return { spec: Object.assign({ t: 'net', v: a + '/' + msk.value }, n) };
  };
  return { el, get };
}

/* ================================================================== RULES */
const PROTOS = [['tcp', 'TCP'], ['udp', 'UDP'], ['tcp/udp', 'TCP/UDP'], ['icmp', 'ICMP'], ['any', 'Any']];
const ruleTabs = (P, cur) => PW.tabs([{ key: 'floating', label: 'Floating', go: () => P.go('firewall_rules.php', { if: 'FloatingRules' }) }].concat(RIF(P.d).map(k => ({ key: k, label: PW.ifLabel(P.d, k), go: () => P.go('firewall_rules.php', { if: k }) }))), cur);

PW.page('firewall_rules.php', {
  crumbs: P => ['Firewall', 'Rules', P.q.if === 'FloatingRules' ? 'Floating' : PW.ifLabel(P.d, P.q.if || 'wan')],
  render: P => {
    const d = P.d; const ifk = P.q.if || 'wan'; const root = h('div');
    root.append(PW.applyBar(P, ['rules'], 'Firewall rules'));
    root.append(ruleTabs(P, ifk === 'FloatingRules' ? 'floating' : ifk));
    if (ifk === 'FloatingRules') { root.append(PW.panel('Rules (Drag to change order)', h('div', { style: { textAlign: 'center', padding: '10px' } }, 'No floating rules are currently defined. Click the ', h('b', 'Add'), ' button to add a new rule.'))); return root; }
    const rules = (P.sec('rules') || {})[ifk] || [];
    const sel = new Set(); const tbody = h('tbody');
    const gos = (id, extra) => P.go('firewall_rules_edit.php', Object.assign({ if: ifk }, id !== undefined ? { id } : {}, extra || {}));
    const mut = fn => { const all = P.edit('rules'); all[ifk] = all[ifk] || []; fn(all[ifk]); P.go('firewall_rules.php', { if: ifk }); };
    const autoRow = (kind, text, src, dst, port) => h('tr.auto', h('td'), h('td', PW.ic(kind === 'pass' ? 'pass' : 'block', kind)), h('td', '*'), h('td', '*'), h('td', src), h('td', '*'), h('td', dst), h('td', port || '*'), h('td', '*'), h('td', 'none'), h('td', '*'), h('td', text), h('td'));
    const ifc = d.ifaces[ifk] || {};
    if (ifk === 'wan' && ifc.blockPrivate) tbody.append(autoRow('block', 'Block private networks and loopback addresses', 'RFC 1918 networks', '*'));
    if (ifk === 'wan' && ifc.blockBogons) tbody.append(autoRow('block', 'Block bogon networks', 'Reserved/not assigned by IANA', '*'));
    if (ifk === 'lan' && d.system && d.system.antilockout !== false) tbody.append(autoRow('pass', 'Anti-Lockout Rule', '*', 'LAN Address', (d.system.webgui ? d.system.webgui.port : 443) + (d.system.ssh && d.system.ssh.enabled ? ', ' + (d.system.ssh.port || 22) : '')));
    rules.forEach((r, i) => {
      const chk = h('input', { type: 'checkbox', on: { change: e => { if (e.target.checked) sel.add(r.id); else sel.delete(r.id); } } });
      const portTxt = p => (p === undefined || p === null || p === '' || p === 'any') ? '*' : String(p);
      const protoTxt = PW.fmtProto(r) + (r.proto === 'icmp' && r.icmpType && r.icmpType !== 'any' ? '' : '');
      tbody.append(h('tr' + (r.dis ? '.off' : ''),
        h('td', chk), h('td', PW.ic(r.act === 'pass' ? 'pass' : 'block', r.act === 'pass' ? 'pass' : 'block')),
        h('td', (r._hits || 0) + '/0 B'), h('td', protoTxt), h('td', PW.fmtAddr(r.src, d)), h('td', portTxt(r.sport)), h('td', PW.fmtAddr(r.dst, d)), h('td', portTxt(r.dport)), h('td', '*'), h('td', 'none'), h('td', 'none'), h('td', r.descr || ''),
        h('td.act',
          h('a', { title: 'Move checked rules above this one', on: { click: e => { e.preventDefault(); if (!sel.size) return; mut(list => { const mv = list.filter(x => sel.has(x.id)); const rest = list.filter(x => !sel.has(x.id)); const at = rest.findIndex(x => x.id === r.id); const pos = at < 0 ? rest.length : at; list.length = 0; rest.slice(0, pos).concat(mv, rest.slice(pos)).forEach(x => list.push(x)); }); } } }, PW.ic('anchor')),
          h('a', { title: 'Edit rule', on: { click: e => { e.preventDefault(); gos(r.id); } } }, PW.ic('edit')),
          h('a', { title: 'Copy rule', on: { click: e => { e.preventDefault(); gos(undefined, { dup: r.id }); } } }, PW.ic('copy')),
          h('a', { title: r.dis ? 'Enable rule' : 'Disable rule', on: { click: e => { e.preventDefault(); mut(list => { const x = list.find(y => y.id === r.id); if (x.dis) delete x.dis; else x.dis = true; }); } } }, PW.ic(r.dis ? 'on' : 'off')),
          h('a', { title: 'Delete this rule', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you wish to delete this rule?', () => mut(list => { const k = list.findIndex(y => y.id === r.id); if (k >= 0) list.splice(k, 1); })); } } }, PW.ic('del')))));
    });
    const table = PW.table(['', '', 'States', 'Protocol', 'Source', 'Port', 'Destination', 'Port', 'Gateway', 'Queue', 'Schedule', 'Description', 'Actions'], []);
    table.replaceChild(tbody, table.tBodies[0]);
    root.append(PW.panel('Rules (Drag to change order)', table, { flush: true }));
    root.append(h('div.pfw-btnrow',
      PW.btn([PW.ic('up'), ' Add'], 'success', () => gos(undefined, { after: '-1' })), PW.btn([PW.ic('down'), ' Add'], 'success', () => gos()),
      PW.btn('Delete', 'danger', () => { if (!sel.size) return; PW.confirm(P, 'Are you sure you wish to delete the selected rules?', () => mut(list => { for (let k = list.length - 1; k >= 0; k--) if (sel.has(list[k].id)) list.splice(k, 1); })); }),
      PW.btn('Save', 'primary', () => { P.go('firewall_rules.php', { if: ifk }); })));
    return root;
  }
});

PW.page('firewall_rules_edit.php', {
  crumbs: P => ['Firewall', 'Rules', PW.ifLabel(P.d, P.q.if || 'wan'), 'Edit'],
  render: P => {
    const d = P.d; const ifk0 = P.q.if || 'wan'; const live = ((P.sec('rules') || {})[ifk0]) || [];
    const dupId = P.q.dup; const src0 = P.q.id ? live.find(r => r.id === P.q.id) : dupId ? live.find(r => r.id === dupId) : null;
    if (P.q.id && !src0) return PW.alert('danger', 'The rule does not exist (it may have been deleted).');
    const r0 = src0 ? U.clone(src0) : { act: 'pass', proto: 'tcp', src: { t: 'any' }, dst: { t: 'any' }, descr: '' };
    if (dupId) { delete r0.id; r0.descr = ''; }
    const srcIn = addrInput(P, r0.src, 'source'), dstIn = addrInput(P, r0.dst, 'destination');
    const sp = portRange(P, r0.sport), dp = portRange(P, r0.dport);
    const ifOpts = RIF(d).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
    const hasPorts = v => v.proto === 'tcp' || v.proto === 'udp' || v.proto === 'tcp/udp';
    const form = PW.form(P, {
      title: 'Edit Firewall Rule',
      fields: [
        { k: 'act', label: 'Action', type: 'select', options: [{ value: 'pass', label: 'Pass' }, { value: 'block', label: 'Block' }, { value: 'reject', label: 'Reject' }], value: r0.act, help: 'Choose what to do with packets that match the criteria specified below. Hint: the difference between block and reject is that with reject, a packet (TCP RST or ICMP port unreachable for UDP) is returned to the sender, whereas with block the packet is dropped silently.' },
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Disable this rule', value: !!r0.dis, help: 'Set this option to disable this rule without removing it from the list.' },
        { k: 'if', label: 'Interface', type: 'select', options: ifOpts, value: ifk0, help: 'Choose the interface from which packets must come to match this rule.' },
        { k: 'af', label: 'Address Family', type: 'select', options: [{ value: 'inet', label: 'IPv4' }], value: 'inet', help: 'Select the Internet Protocol version this rule applies to.' },
        { k: 'proto', label: 'Protocol', type: 'select', options: PROTOS.map(x => ({ value: x[0], label: x[1] })), value: r0.proto || 'any', help: 'Choose which IP protocol this rule should match.' },
        { k: 'icmp', label: 'ICMP Subtypes', type: 'select', options: [{ value: 'any', label: 'any' }, { value: 'echoreq', label: 'Echo request' }], value: r0.icmpType || 'any', show: v => v.proto === 'icmp', help: 'For ICMP rules on IPv4, one or more of these ICMP subtypes may be specified.' },
        { panel: 'Source' },
        { k: 'src', label: 'Source', type: 'el', el: srcIn.el, get: srcIn.get, help: 'The Source Port Range for a connection is typically random and almost never equal to the destination port. In most cases this setting must remain at its default value, any.' },
        { k: 'sp', label: 'Source Port Range', type: 'el', el: sp.el, get: sp.get, show: hasPorts },
        { panel: 'Destination' },
        { k: 'dst', label: 'Destination', type: 'el', el: dstIn.el, get: dstIn.get },
        { k: 'dp', label: 'Destination Port Range', type: 'el', el: dp.el, get: dp.get, show: hasPorts, help: 'Specify the port or port range for the destination of the packet for this mapping. The \'To\' field may be left empty if only mapping a single port.' },
        { panel: 'Extra Options' },
        { k: 'log', label: 'Log', type: 'check', text: 'Log packets that are handled by this rule', value: !!r0.log, help: 'Hint: the firewall has limited local log space. Don\'t turn on logging for everything.' },
        { k: 'descr', label: 'Description', type: 'text', value: r0.descr || '', help: 'A description may be entered here for administrative reference. A maximum of 52 characters will be used in the ruleset and displayed in the firewall log.' }
      ],
      save: v => {
        const errs = [];
        const s = v.src, t = v.dst; if (s.err) errs.push(s.err); if (t.err) errs.push(t.err);
        if (hasPorts(v)) { const e1 = portErr(P, v.sp, 'source'), e2 = portErr(P, v.dp, 'destination'); if (e1) errs.push(e1); if (e2) errs.push(e2); }
        if (v.descr.length > 52) errs.push('The description may not exceed 52 characters.');
        if (errs.length) return errs;
        const all = P.edit('rules'); const nr = { id: r0.id, act: v.act, proto: v.proto, src: s.spec, dst: t.spec };
        if (v.proto === 'icmp' && v.icmp !== 'any') nr.icmpType = v.icmp;
        if (hasPorts(v)) { if (v.sp) nr.sport = v.sp; if (v.dp) nr.dport = v.dp; }
        if (v.descr) nr.descr = v.descr; if (v.log) nr.log = true; if (v.dis) nr.dis = true;
        let list = all[ifk0] = all[ifk0] || [];
        if (nr.id) {
          const i = list.findIndex(x => x.id === nr.id);
          if (v.if !== ifk0) { list.splice(i, 1); all[v.if] = all[v.if] || []; all[v.if].push(nr); } else list[i] = Object.assign({}, list[i], nr);
        } else {
          let n = 0; Object.keys(all).forEach(k => (all[k] || []).forEach(x => { const m = /^n(\d+)$/.exec(x.id || ''); if (m) n = Math.max(n, +m[1]); })); nr.id = 'n' + (n + 1);
          list = all[v.if] = all[v.if] || [];
          if (P.q.after === '-1') list.unshift(nr); else list.push(nr);
        }
        P.go('firewall_rules.php', { if: v.if });
        return null;
      }
    });
    return form.el;
  }
});

/* ================================================================== ALIASES */
const ATYPE = { host: 'Host(s)', network: 'Network(s)', port: 'Port(s)' };
const aliasUsedBy = (P, name) => {
  const out = []; const rules = P.sec('rules') || {};
  Object.keys(rules).forEach(k => (rules[k] || []).forEach(r => { if ((r.src && r.src.v === name && r.src.t === 'alias') || (r.dst && r.dst.t === 'alias' && r.dst.v === name) || r.dport === name || r.sport === name) out.push('Firewall rule: ' + (r.descr || r.id) + ' (' + PW.ifLabel(P.d, k) + ')'); }));
  const nat = P.sec('nat') || {};
  (nat.portfwd || []).forEach(r => { if ((r.dst && r.dst.v === name) || r.dport === name) out.push('NAT port forward: ' + (r.descr || '')); });
  (P.sec('aliases') || []).forEach(a => { if (a.name !== name && (a.values || []).indexOf(name) >= 0) out.push('Alias: ' + a.name); });
  return out;
};
PW.page('firewall_aliases.php', {
  crumbs: P => ['Firewall', 'Aliases', P.q.tab === 'port' ? 'Ports' : P.q.tab === 'ip' ? 'IP' : 'All'],
  render: P => {
    const root = h('div'); root.append(PW.applyBar(P, ['aliases'], 'Aliases'));
    const tab = P.q.tab || 'ip';
    root.append(PW.tabs([{ key: 'ip', label: 'IP', go: () => P.go('firewall_aliases.php', { tab: 'ip' }) }, { key: 'port', label: 'Ports', go: () => P.go('firewall_aliases.php', { tab: 'port' }) }, { key: 'url', label: 'URLs', go: () => P.go('firewall_aliases.php', { tab: 'url' }) }, { key: 'all', label: 'All', go: () => P.go('firewall_aliases.php', { tab: 'all' }) }], tab));
    const list = (P.sec('aliases') || []).filter(a => tab === 'all' || (tab === 'port' ? a.type === 'port' : tab === 'ip' ? a.type !== 'port' : false));
    const rows = list.map(a => h('tr', h('td', a.name), h('td', ATYPE[a.type] || a.type), h('td', (a.values || []).join(', ')), h('td', a.descr || ''), h('td.act',
      h('a', { title: 'Edit alias', on: { click: e => { e.preventDefault(); P.go('firewall_aliases_edit.php', { id: a.name }); } } }, PW.ic('edit')),
      h('a', { title: 'Delete alias', on: { click: e => { e.preventDefault(); const use = aliasUsedBy(P, a.name); if (use.length) { P.setFlash('danger', 'Cannot delete alias. Currently in use by: ' + use.join('; ')); P.go('firewall_aliases.php', P.q); return; } PW.confirm(P, 'Are you sure you want to delete this alias?', () => { const arr = P.edit('aliases'); arr.splice(arr.findIndex(x => x.name === a.name), 1); P.go('firewall_aliases.php', P.q); }); } } }, PW.ic('del')))));
    root.append(PW.panel('Firewall Aliases ' + (tab === 'port' ? 'Ports' : tab === 'url' ? 'URLs' : 'IP'), PW.table(['Name', 'Type', 'Values', 'Description', 'Actions'], rows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('firewall_aliases_edit.php', { tab }))));
    return root;
  }
});
PW.page('firewall_aliases_edit.php', {
  crumbs: P => ['Firewall', 'Aliases', 'Edit'],
  render: P => {
    const all = P.sec('aliases') || []; const a0 = P.q.id ? all.find(a => a.name === P.q.id) : null;
    if (P.q.id && !a0) return PW.alert('danger', 'The alias does not exist.');
    const al = a0 ? U.clone(a0) : { name: '', type: P.q.tab === 'port' ? 'port' : 'host', values: [], descr: '' };
    let typeNow = al.type; const rowsBox = h('div'); let rows = (al.values || []).slice();
    const draw = () => {
      UI.clear(rowsBox);
      rows.forEach((val, i) => {
        const cp = typeNow === 'network' ? PW.cidrParts(val) : null;
        const txt = h('input.form-control.sm', { type: 'text', value: cp ? cp.addr : val, spellcheck: false, style: { width: '260px' }, on: { input: () => { rows[i] = cur(i); } } });
        const msk = typeNow === 'network' ? h('select.form-control.sm', PW.maskOpts().map(x => h('option', { value: x.value, selected: cp ? +x.value === cp.len : +x.value === 24 }, x.label))) : null;
        if (msk) msk.addEventListener('change', () => { rows[i] = cur(i); });
        const cur = () => (msk ? txt.value.trim() + '/' + msk.value : txt.value.trim());
        rowsBox.append(h('div.pfw-inline', { style: { marginBottom: '6px' } }, txt, msk, PW.btn([PW.ic('del'), ' Delete'], 'warning', () => { rows.splice(i, 1); draw(); }, { sm: true })));
      });
      rowsBox.append(PW.btn([PW.ic('down'), typeNow === 'port' ? ' Add Port' : typeNow === 'network' ? ' Add Network' : ' Add Host'], 'success', () => { rows.push(typeNow === 'network' ? '0.0.0.0/24' : ''); draw(); }, { sm: true }));
    };
    draw();
    const form = PW.form(P, {
      title: 'Properties',
      fields: [
        { k: 'name', label: 'Name', type: 'text', value: al.name, help: 'The name of the alias may only consist of the characters "a-z, A-Z, 0-9 and _".' },
        { k: 'descr', label: 'Description', type: 'text', value: al.descr || '', help: 'A description may be entered here for administrative reference (not parsed).' },
        { k: 'type', label: 'Type', type: 'select', options: [{ value: 'host', label: 'Host(s)' }, { value: 'network', label: 'Network(s)' }, { value: 'port', label: 'Port(s)' }], value: al.type, help: '' },
        { panel: typeNow === 'port' ? 'Port(s)' : typeNow === 'network' ? 'Network(s)' : 'Host(s)' },
        { k: 'vals', label: 'Entries', type: 'el', el: rowsBox, get: () => rows.slice() }
      ],
      save: v => {
        const errs = [];
        if (!/^[A-Za-z0-9_]+$/.test(v.name)) errs.push('The alias name may only consist of the characters "a-z, A-Z, 0-9, _".');
        if ((P.sec('aliases') || []).some(x => x.name === v.name && x.name !== al.name)) errs.push('An alias with this name already exists.');
        const clean = v.vals.map(x => String(x).trim()).filter(Boolean);
        clean.forEach(x => {
          if (v.type === 'host' && !U.isIP(x) && !/^[A-Za-z0-9.-]+$/.test(x)) errs.push('"' + x + '" is not a valid host name or IP address.');
          if (v.type === 'network') { const p = PW.cidrParts(x); if (!U.isIP(p.addr) || p.len < 1 || p.len > 32) errs.push('"' + x + '" is not a valid network.'); }
          if (v.type === 'port' && !(isPortNum(x) || (x.split(':').length === 2 && x.split(':').every(isPortNum)))) errs.push('"' + x + '" is not a valid port or range.');
        });
        if (errs.length) return errs;
        const arr = P.edit('aliases'); const na = { name: v.name, type: v.type, values: clean }; if (v.descr) na.descr = v.descr;
        if (a0) {
          const i = arr.findIndex(x => x.name === a0.name); arr[i] = na;
          if (a0.name !== v.name) { /* renommage : met à jour les références dans les copies de travail */
            const rules = P.edit('rules'); Object.keys(rules).forEach(k => (rules[k] || []).forEach(r => { ['src', 'dst'].forEach(s => { if (r[s] && r[s].t === 'alias' && r[s].v === a0.name) r[s].v = v.name; }); if (r.dport === a0.name) r.dport = v.name; if (r.sport === a0.name) r.sport = v.name; }));
            arr.forEach(x => { x.values = (x.values || []).map(y => y === a0.name ? v.name : y); });
          }
        } else arr.push(na);
        P.go('firewall_aliases.php', { tab: v.type === 'port' ? 'port' : 'ip' });
        return null;
      }
    });
    const typeSel = form.fields.find(f => f.k === 'type')._inp;
    typeSel.addEventListener('change', () => { typeNow = typeSel.value; rows = []; draw(); const p = form.el.querySelectorAll('.pfw-ph h2'); if (p[1]) p[1].textContent = typeNow === 'port' ? 'Port(s)' : typeNow === 'network' ? 'Network(s)' : 'Host(s)'; });
    return form.el;
  }
});

/* ================================================================== NAT */
const natTabs = (P, cur) => PW.tabs([{ key: 'fwd', label: 'Port Forward', go: () => P.go('firewall_nat.php') }, { key: '1to1', label: '1:1', go: () => P.go('firewall_nat_1to1.php') }, { key: 'out', label: 'Outbound', go: () => P.go('firewall_nat_out.php') }, { key: 'npt', label: 'NPt', go: () => P.go('firewall_nat_npt.php') }], cur);
PW.page('firewall_nat.php', {
  crumbs: ['Firewall', 'NAT', 'Port Forward'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(PW.applyBar(P, ['nat'], 'NAT')); root.append(natTabs(P, 'fwd'));
    const list = (P.sec('nat') || {}).portfwd || [];
    const mut = fn => { const n = P.edit('nat'); n.portfwd = n.portfwd || []; fn(n.portfwd); P.go('firewall_nat.php'); };
    const rows = list.map((r, i) => h('tr' + (r.dis ? '.off' : ''), h('td', PW.ic(r.dis ? 'block' : 'pass', r.dis ? 'block' : 'pass')), h('td', PW.ifLabel(d, r.iface)), h('td', (r.proto || 'any').toUpperCase()), h('td', '*'), h('td', '*'), h('td', PW.fmtAddr(r.dst || { t: 'ifaddr', v: r.iface }, d)), h('td', r.dport || '*'), h('td', r.target), h('td', r.tport || r.dport || '*'), h('td', r.descr || ''), h('td.act',
      h('a', { title: 'Edit rule', on: { click: e => { e.preventDefault(); P.go('firewall_nat_edit.php', { id: i }); } } }, PW.ic('edit')),
      h('a', { title: r.dis ? 'Enable rule' : 'Disable rule', on: { click: e => { e.preventDefault(); mut(l => { if (l[i].dis) delete l[i].dis; else l[i].dis = true; }); } } }, PW.ic(r.dis ? 'on' : 'off')),
      h('a', { title: 'Delete this rule', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you wish to delete this rule?', () => mut(l => l.splice(i, 1))); } } }, PW.ic('del')))));
    root.append(PW.panel('Rules', PW.table(['', 'Interface', 'Protocol', 'Source Address', 'Source Ports', 'Dest. Address', 'Dest. Ports', 'NAT IP', 'NAT Ports', 'Description', 'Actions'], rows), { flush: true }));
    root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('firewall_nat_edit.php', { after: '-1' })), PW.btn([PW.ic('down'), ' Add'], 'success', () => P.go('firewall_nat_edit.php'))));
    return root;
  }
});
PW.page('firewall_nat_edit.php', {
  crumbs: ['Firewall', 'NAT', 'Port Forward', 'Edit'],
  render: P => {
    const d = P.d; const list = (P.sec('nat') || {}).portfwd || []; const idx = P.q.id !== undefined ? +P.q.id : -1;
    if (idx >= 0 && !list[idx]) return PW.alert('danger', 'The rule does not exist.');
    const r0 = idx >= 0 ? U.clone(list[idx]) : { iface: 'wan', proto: 'tcp', dst: { t: 'ifaddr', v: 'wan' }, dport: '', target: '', tport: '', assoc: 'pass', descr: '' };
    const dstIn = addrInput(P, r0.dst, 'destination'); const dp = portRange(P, r0.dport);
    const ifs = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
    const assocLbl = { none: 'None', pass: 'Add associated filter rule' };
    const form = PW.form(P, {
      title: 'Edit Redirect Entry',
      fields: [
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Disable this rule', value: !!r0.dis, help: 'Set this option to disable this rule without removing it from the list.' },
        { k: 'iface', label: 'Interface', type: 'select', options: ifs, value: r0.iface, help: 'Choose which interface this rule applies to. In most cases "WAN" is specified.' },
        { k: 'proto', label: 'Protocol', type: 'select', options: [{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }, { value: 'tcp/udp', label: 'TCP/UDP' }], value: r0.proto || 'tcp', help: 'Choose which protocol this rule should match. In most cases "TCP" is specified.' },
        { panel: 'Destination' },
        { k: 'dst', label: 'Destination', type: 'el', el: dstIn.el, get: dstIn.get },
        { k: 'dp', label: 'Destination Port Range', type: 'el', el: dp.el, get: dp.get, help: 'Specify the port or port range for the destination of the packet for this mapping. The \'To\' field may be left empty if only mapping a single port.' },
        { panel: 'Redirect Target' },
        { k: 'target', label: 'Redirect target IP', type: 'text', value: r0.target, help: 'Enter the internal IP address of the server on which to map the ports. e.g.: 192.168.1.12' },
        { k: 'tport', label: 'Redirect target port', type: 'text', value: r0.tport || '', w: 140, help: 'Specify the port on the machine with the IP address entered above.' },
        { k: 'descr', label: 'Description', type: 'text', value: r0.descr || '', help: 'A description may be entered here for administrative reference (not parsed).' },
        { k: 'assoc', label: 'Filter rule association', type: 'select', options: [{ value: 'none', label: 'None' }, { value: 'pass', label: 'Add associated filter rule' }, { value: 'pass2', label: 'Pass' }], value: r0.assoc === 'none' ? 'none' : 'pass', help: 'The "pass" selection does not work properly with Multi-WAN. It will only work on an interface containing the default gateway.' }
      ],
      save: v => {
        const errs = []; if (v.dst.err) errs.push(v.dst.err);
        const e1 = portErr(P, v.dp, 'destination'); if (e1) errs.push(e1); if (!v.dp) errs.push('A destination port must be specified.');
        if (!U.isIP(v.target)) errs.push('A valid redirect target IP address must be specified.');
        if (v.tport && !isPortNum(v.tport)) errs.push('A valid redirect target port must be specified.');
        if (errs.length) return errs;
        const n = P.edit('nat'); n.portfwd = n.portfwd || [];
        const nr = { iface: v.iface, proto: v.proto, dst: v.dst.spec, dport: v.dp, target: v.target, tport: v.tport || v.dp, assoc: v.assoc === 'none' ? 'none' : 'pass', descr: v.descr };
        if (v.dis) nr.dis = true;
        if (idx >= 0) n.portfwd[idx] = nr; else if (P.q.after === '-1') n.portfwd.unshift(nr); else n.portfwd.push(nr);
        P.go('firewall_nat.php'); return null;
      }
    });
    void assocLbl; return form.el;
  }
});

const OB_MODES = [['automatic', 'Automatic outbound NAT rule generation', '(IPsec passthrough included)'], ['hybrid', 'Hybrid Outbound NAT rule generation', '(Automatic Outbound NAT + rules below)'], ['manual', 'Manual Outbound NAT rule generation', '(AON - Advanced Outbound NAT)'], ['disabled', 'Disable Outbound NAT rule generation', '(No Outbound NAT rules)']];
PW.page('firewall_nat_out.php', {
  crumbs: ['Firewall', 'NAT', 'Outbound'],
  render: P => {
    const d = P.d; const root = h('div'); root.append(PW.applyBar(P, ['nat'], 'NAT')); root.append(natTabs(P, 'out'));
    const ob = (P.sec('nat') || {}).outbound || { mode: 'automatic', rules: [] };
    let mode = ob.mode;
    const radios = OB_MODES.map(m => h('label.pfw-chk', h('input', { type: 'radio', name: 'obmode', checked: m[0] === mode, on: { change: () => { mode = m[0]; } } }), h('span', h('b', m[1]), ' ', m[2])));
    root.append(PW.panel('Mode', h('div', radios, h('div', { style: { marginTop: '10px' } }, PW.btn('Save', 'primary', () => { const n = P.edit('nat'); n.outbound = n.outbound || { mode, rules: [] }; n.outbound.mode = mode; n.outbound.rules = n.outbound.rules || []; P.go('firewall_nat_out.php'); })))));
    const mut = fn => { const n = P.edit('nat'); n.outbound = n.outbound || { mode, rules: [] }; n.outbound.rules = n.outbound.rules || []; fn(n.outbound.rules); P.go('firewall_nat_out.php'); };
    if (ob.mode === 'manual' || ob.mode === 'hybrid') {
      const rows = (ob.rules || []).map((r, i) => h('tr' + (r.dis ? '.off' : ''), h('td', PW.ic(r.dis ? 'block' : 'pass', r.dis ? 'block' : 'pass')), h('td', PW.ifLabel(d, r.iface)), h('td', PW.fmtAddr(r.src, d)), h('td', '*'), h('td', PW.fmtAddr(r.dst, d)), h('td', '*'), h('td', r.nonat ? 'NO NAT' : (r.transl && r.transl !== 'iface' ? r.transl : PW.ifLabel(d, r.iface) + ' address')), h('td', '*'), h('td', r.descr || ''), h('td.act',
        h('a', { title: 'Edit mapping', on: { click: e => { e.preventDefault(); P.go('firewall_nat_out_edit.php', { id: i }); } } }, PW.ic('edit')),
        h('a', { title: r.dis ? 'Enable mapping' : 'Disable mapping', on: { click: e => { e.preventDefault(); mut(l => { if (l[i].dis) delete l[i].dis; else l[i].dis = true; }); } } }, PW.ic(r.dis ? 'on' : 'off')),
        h('a', { title: 'Delete this mapping', on: { click: e => { e.preventDefault(); PW.confirm(P, 'Are you sure you wish to delete this mapping?', () => mut(l => l.splice(i, 1))); } } }, PW.ic('del')))));
      root.append(PW.panel('Mappings', PW.table(['', 'Interface', 'Source', 'Source Port', 'Destination', 'Destination Port', 'NAT Address', 'NAT Port', 'Description', 'Actions'], rows), { flush: true }));
      root.append(h('div.pfw-btnrow', PW.btn([PW.ic('up'), ' Add'], 'success', () => P.go('firewall_nat_out_edit.php', { after: '-1' })), PW.btn([PW.ic('down'), ' Add'], 'success', () => P.go('firewall_nat_out_edit.php'))));
    }
    if (ob.mode === 'automatic' || ob.mode === 'hybrid') {
      const wan = Object.keys(d.gateways || []).length ? (d.gateways[0].iface || 'wan') : 'wan';
      const auto = [];
      Object.keys(d.ifaces).forEach(k => { const i = d.ifaces[k]; if (i.virtual || k === wan || !i.ip) return; auto.push([PW.ifLabel(d, wan), U.netAddr(i.ip, i.mask) + '/' + U.mask2len(i.mask)]); });
      auto.unshift([PW.ifLabel(d, wan), '127.0.0.0/8, ::1/128']);
      root.append(PW.panel('Automatic Rules:', PW.table(['', 'Interface', 'Source', 'Source Port', 'Destination', 'Destination Port', 'NAT Address', 'NAT Port', 'Static Port', 'Description'], auto.map(a => h('tr', h('td', PW.ic('pass', 'pass')), h('td', a[0]), h('td', a[1]), h('td', '*'), h('td', '*'), h('td', '*'), h('td', PW.ifLabel(d, wan) + ' address'), h('td', '*'), h('td', 'NO'), h('td', 'Auto created rule')))), { flush: true }));
    }
    return root;
  }
});
PW.page('firewall_nat_out_edit.php', {
  crumbs: ['Firewall', 'NAT', 'Outbound', 'Edit'],
  render: P => {
    const d = P.d; const ob = (P.sec('nat') || {}).outbound || { mode: 'manual', rules: [] }; const idx = P.q.id !== undefined ? +P.q.id : -1;
    if (idx >= 0 && !(ob.rules || [])[idx]) return PW.alert('danger', 'The mapping does not exist.');
    const r0 = idx >= 0 ? U.clone(ob.rules[idx]) : { iface: 'wan', src: { t: 'net', v: '10.10.0.0/16' }, dst: { t: 'any' }, transl: 'iface', descr: '' };
    const srcIn = addrInput(P, r0.src, 'source'), dstIn = addrInput(P, r0.dst || { t: 'any' }, 'destination');
    const ifs = Object.keys(d.ifaces).filter(k => !d.ifaces[k].virtual).map(k => ({ value: k, label: PW.ifLabel(d, k) }));
    const form = PW.form(P, {
      title: 'Edit Advanced Outbound NAT Entry',
      fields: [
        { k: 'dis', label: 'Disabled', type: 'check', text: 'Disable this rule', value: !!r0.dis },
        { k: 'nonat', label: 'Do not NAT', type: 'check', text: 'Enabling this option will disable NAT for traffic matching this rule and stop processing Outbound NAT rules', value: !!r0.nonat },
        { k: 'iface', label: 'Interface', type: 'select', options: ifs, value: r0.iface, help: 'The interface on which traffic is matched as it exits the firewall. In most cases this is "WAN" or another externally-connected interface.' },
        { panel: 'Source' },
        { k: 'src', label: 'Source', type: 'el', el: srcIn.el, get: srcIn.get },
        { panel: 'Destination' },
        { k: 'dst', label: 'Destination', type: 'el', el: dstIn.el, get: dstIn.get },
        { panel: 'Translation' },
        { k: 'transl', label: 'Address', type: 'text', value: r0.transl && r0.transl !== 'iface' ? r0.transl : '', ph: 'Interface Address', help: 'Leave empty to translate to the address of the outgoing interface (Interface Address), or enter a specific address.' },
        { k: 'descr', label: 'Description', type: 'text', value: r0.descr || '' }
      ],
      save: v => {
        const errs = []; if (v.src.err) errs.push(v.src.err); if (v.dst.err) errs.push(v.dst.err);
        const tr = v.transl.trim(); if (tr && !U.isIP(tr)) errs.push('A valid translation address must be specified.');
        if (errs.length) return errs;
        const n = P.edit('nat'); n.outbound = n.outbound || { mode: 'manual', rules: [] }; n.outbound.rules = n.outbound.rules || [];
        const nr = { iface: v.iface, src: v.src.spec, transl: tr || 'iface', descr: v.descr }; if (v.dst.spec.t !== 'any') nr.dst = v.dst.spec; if (v.nonat) nr.nonat = true; if (v.dis) nr.dis = true;
        if (idx >= 0) n.outbound.rules[idx] = nr; else if (P.q.after === '-1') n.outbound.rules.unshift(nr); else n.outbound.rules.push(nr);
        P.go('firewall_nat_out.php'); return null;
      }
    });
    return form.el;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
