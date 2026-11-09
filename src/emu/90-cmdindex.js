/* ============================================================================
   Index des commandes pour l'aide-mémoire : construit à partir des registres RÉELS des émulateurs (ce que le terminal sait exécuter),
   jamais d'une liste écrite à côté. Les descriptions viennent de SIM.CMDHELP (cmd / PowerShell / Linux) ou de l'aide « ? » de l'IOS (anglais, comme sur le matériel).
   E.cmdIndex(kind, dev) → { kind, title, groups: [{ title, items: [{ name, desc, ex, mode }] }], missing: [noms sans description] }
   kind : 'cmd' | 'ps' | 'bash' | 'ios'
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, E = SIM.emu;
const fromHelp = (kind, names, groupOf) => {
  const H = SIM.CMDHELP[kind]; const cats = SIM.CMDHELP.cats[kind]; const by = {}; const missing = [];
  names.forEach(n => { const h = H[n] || H[n.toLowerCase()]; if (!h) { missing.push(n); (by['Autres'] = by['Autres'] || []).push({ name: n, desc: '', ex: '' }); return; } (by[h[0]] = by[h[0]] || []).push({ name: n, desc: h[1], ex: h[2] || '' }); });
  const order = cats.concat(['Autres']).filter((c, i, a) => a.indexOf(c) === i && by[c]);
  return { groups: order.map(c => ({ title: c, items: by[c].sort((a, b) => a.name.localeCompare(b.name)) })), missing };
};
const IOS_MODES = [['UP', 'Mode utilisateur / privilégié (Switch> / Switch#)'], ['P', 'Mode privilégié (Switch#)'], ['C', 'Configuration globale ((config)#)'], ['I', 'Configuration d’interface ((config-if)#)'], ['L', 'Lignes console et vty ((config-line)#)'], ['V', 'VLAN ((config-vlan)#)'], ['A', 'Liste d’accès nommée ((config-ext-nacl)#)'], ['D', 'Pool DHCP ((dhcp-config)#)'], ['R', 'Routeur OSPF ((config-router)#)']];
E.cmdIndex = function (kind, dev) {
  if (kind === 'bash') { const names = Object.keys(E.lx.cmds).concat(Object.keys(E.lx.sbin)).filter((n, i, a) => a.indexOf(n) === i); const r = fromHelp('bash', names);
    /* paquets non installés par défaut (modèle de paquets de l'émulateur) : la commande est listée avec la façon de l'obtenir */
    if (dev) r.groups.forEach(gr => gr.items.forEach(it => { const pk = E.lx.PKG[it.name]; if (pk && !E.lx.available({ d: dev }, it.name)) it.note = 'Non installé par défaut : apt install ' + pk; })); return Object.assign({ kind, title: 'Commandes Linux disponibles' }, r); }
  if (kind === 'cmd') { const names = Object.keys(E.win.cmds).filter(n => !/^(sc_exe|net1)$/.test(n)); const r = fromHelp('cmd', names); return Object.assign({ kind, title: 'Commandes cmd disponibles' }, r); }
  if (kind === 'ps') { const idx = E.win.psIndex(); const r = fromHelp('ps', idx.cmdlets.map(c => c.name));
    const al = idx.aliases.sort((a, b) => a.alias.localeCompare(b.alias)).map(a => ({ name: a.alias, desc: 'Alias de ' + a.target, ex: '' })); r.groups.push({ title: 'Alias', items: al });
    r.groups.push({ title: 'Commandes classiques (cmd) utilisables aussi dans PowerShell', items: Object.keys(E.win.cmds).filter(n => /^(ipconfig|ping|nslookup|tracert|netstat|arp|route|gpupdate|gpresult|w32tm|netsh|icacls|nltest|klist|systeminfo|tasklist|hostname|whoami|net|sc)$/.test(n)).sort().map(n => ({ name: n, desc: (SIM.CMDHELP.cmd[n] || [])[1] || '', ex: (SIM.CMDHELP.cmd[n] || [])[2] || '' })) });
    return Object.assign({ kind, title: 'Applets de commande PowerShell disponibles' }, r); }
  if (kind === 'ios') {
    const D = E.ios.defs; const d = dev || {}; const groups = [];
    IOS_MODES.forEach(m => { const items = D.filter(x => x.modes === m[0] || (m[0] === 'UP' && x.modes === 'UP')).filter(x => !(x.sw && d.kind && d.kind !== 'ios-sw') && !(x.rt && d.kind && d.kind !== 'ios-rt') && !(x.l3 && d.kind === 'ios-sw' && !d.ipRouting))
      .map(x => ({ name: x.spec, desc: x.desc || '', ex: '' })).sort((a, b) => a.name.localeCompare(b.name)); if (items.length) groups.push({ title: m[1], items }); });
    return { kind, title: 'Commandes IOS disponibles', groups, missing: [], note: 'Sur l’équipement, tape « ? » seul pour la liste du mode courant, « show ? » pour les sous-commandes, et Tab pour compléter.' };
  }
  return { kind, title: '', groups: [], missing: [] };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
