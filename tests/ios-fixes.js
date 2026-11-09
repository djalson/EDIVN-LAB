// Pour chaque panne Cisco : injection, puis réparation faite UNIQUEMENT avec des commandes IOS tapées
// dans le vrai shell émulé (pas les « set » du modèle). Vérifie que les mêmes champs du modèle sont modifiés.
const SIM = require('./load')(); const T = require('./term.js')(SIM);
const F = SIM.fault;
const only = process.argv.slice(2);
let bad = 0, nOk = 0;
const fail = (id, msg) => { bad++; console.log('  ✗ ' + id + ' : ' + msg); };

function run(W, env, dev, cmds, log) {
  const sh = SIM.emu.openIos(env, dev, { via: 'console' });
  const answers = { 'How many bits': '1024' };
  for (const c of cmds) {
    let r = sh.exec(c); let txt = r.out.map(x => x.t).join('\n');
    let guard = 0;
    while (r.ask && guard++ < 5) { const a = r.ask.prompt.indexOf('bits') >= 0 ? '1024' : 'yes'; r = sh.exec(a); txt += '\n' + r.out.map(x => x.t).join('\n'); }
    if (log) console.log('    ' + sh.prompt() + c + (txt.trim() ? '\n      ' + txt.trim().split('\n').join('\n      ') : ''));
    if (/% (Invalid|Ambiguous|Incomplete)/.test(txt) && !/no ip route|no ip nat/.test(c)) throw new Error('commande rejetée : « ' + c + ' » → ' + txt.trim());
  }
}
const P = (...x) => x;
const FIX = {
  c_shutdown: () => [['SW-T2', ['enable', 'conf t', 'interface FastEthernet0/2', 'no shutdown', 'end']]],
  c_vlan_port: () => [['SW-T2', ['enable', 'conf t', 'int fa0/2', 'switchport access vlan 20', 'end']]],
  c_vlan_missing: () => [['SW-T2', ['enable', 'conf t', 'vlan 20', 'name POSTES', 'end']]],
  c_portsec: (v, name) => name === 'maximum' ? [['SW-T2', ['enable', 'conf t', 'int fa0/2', 'switchport port-security maximum 2', 'shutdown', 'no shutdown', 'end']]]
    : name === 'nouvelle-mac' ? [['SW-T2', ['enable', 'clear port-security sticky interface fa0/2', 'conf t', 'int fa0/2', 'switchport port-security mac-address sticky 0050.56ab.cd01', 'shutdown', 'no shutdown', 'end']]]
    : name === 'sans-securite' ? [['SW-T2', ['enable', 'conf t', 'int fa0/2', 'no switchport port-security', 'shutdown', 'no shutdown', 'end']]]
    : [['SW-T2', ['enable', 'clear port-security sticky interface fa0/2', 'conf t', 'int fa0/2', 'shutdown', 'no shutdown', 'end']]],
  c_portsec_imp: (v, name) => name === 'maximum' ? [['SW-T3', ['enable', 'conf t', 'int fa0/5', 'switchport port-security maximum 2', 'shutdown', 'no shutdown', 'end']]]
    : name === 'nouvelle-mac' ? [['SW-T3', ['enable', 'clear port-security sticky interface fa0/5', 'conf t', 'int fa0/5', 'switchport port-security mac-address sticky b8d8.4871.9999', 'shutdown', 'no shutdown', 'end']]]
    : name === 'sans-securite' ? [['SW-T3', ['enable', 'conf t', 'int fa0/5', 'no switchport port-security', 'shutdown', 'no shutdown', 'end']]]
    : [['SW-T3', ['enable', 'clear port-security sticky interface fa0/5', 'conf t', 'int fa0/5', 'shutdown', 'no shutdown', 'end']]],
  c_trunk_allowed: v => [[v.c.sw, ['enable', 'conf t', 'int gi0/1', 'switchport trunk allowed vlan add 20', 'end']]],
  c_trunk_native: () => [['SW-T2', ['enable', 'conf t', 'int gi0/2', 'switchport trunk native vlan 1', 'end']]],
  c_svi: v => [['SW-T1', ['enable', 'conf t', 'interface vlan 20'].concat(v.m.key === 'shut' ? ['no shutdown'] : ['ip address 10.10.20.1 255.255.255.0']).concat(['end'])]],
  c_roas: v => v.m.key === 'encap' ? [['R-B1', ['enable', 'conf t', 'interface g0/1.20', 'encapsulation dot1Q 20', 'end']]]
    : v.m.key === 'parent' ? [['R-B1', ['enable', 'conf t', 'interface g0/1', 'no shutdown', 'end']]]
    : [['SW-B1', ['enable', 'conf t', 'int fa0/1', 'switchport trunk allowed vlan add 20', 'end']]],
  c_route_default: v => [[v.c.dev, ['enable', 'conf t'].concat(v.m.key === 'wrong' ? ['no ip route 0.0.0.0 0.0.0.0 ' + v.c.bad] : []).concat(['ip route 0.0.0.0 0.0.0.0 ' + v.c.nh, 'end'])]],
  c_nat_side: v => [['R-RV1', ['enable', 'conf t', 'interface ' + v.m.iface, 'ip nat ' + v.m.side, 'end']]],
  c_nat_acl: (v, name) => name === 'reseau-a' ? [['R-RV1', ['enable', 'conf t', 'access-list 1 permit 172.16.1.0 0.0.0.255', 'end']]] : [['R-RV1', ['enable', 'conf t', 'no access-list 1', 'access-list 1 permit 172.16.0.0 0.0.255.255', 'end']]],
  c_nat_static: () => [['R-RV1', ['enable', 'conf t', 'no ip nat inside source static tcp 172.16.3.11 80 192.0.2.2 80', 'ip nat inside source static tcp 172.16.3.10 80 192.0.2.2 80', 'end']]],
  c_acl: v => v.m.key === 'deny-avant' ? [['R-RV1', ['enable', 'conf t', 'ip access-list extended 100', 'no 10', 'end']]]
    : v.m.key === 'dns' ? [['R-RV1', ['enable', 'conf t', 'ip access-list extended 101', '15 permit udp 172.16.2.0 0.0.0.255 host 172.16.3.10 eq domain', 'end']]]
    : [['R-RV1', ['enable', 'conf t', 'ip access-list extended 102', '5 permit tcp 172.16.3.0 0.0.0.255 any established', 'end']]],
  c_ssh: v => [['SW-T2', ['enable', 'conf t'].concat(v.m.key === 'rsa' ? ['crypto key generate rsa'] : v.m.key === 'transport' ? ['line vty 0 15', 'transport input ssh'] : ['ip domain-name toulouse.local']).concat(['end'])]],
  c_ssh_auth: v => [['SW-T2', ['enable', 'conf t'].concat(v.m.key === 'acl' ? ['no access-list 10', 'access-list 10 permit host 10.10.30.10'] : ['username admin privilege 15 secret Cisco#2026']).concat(['end'])]],
  c_sw_gw: () => [['SW-T2', ['enable', 'conf t', 'ip default-gateway 10.10.30.1', 'end']]],
  c_dhcp_router: v => [['R-RV1', ['enable', 'conf t'].concat(v.m.key === 'exclu' ? ['no ip dhcp excluded-address 172.16.2.1 172.16.2.254', 'ip dhcp excluded-address 172.16.2.1 172.16.2.20'] : v.m.key === 'gw' ? ['ip dhcp pool LAN-B', 'default-router 172.16.2.1'] : ['service dhcp']).concat(['end'])]],
  /* OSPF (Labège) */
  ospf_lan_network: v => {
    const key = n => n.net + '|' + n.wild;
    const goodK = v.m.good.map(key); const extra = v.m.bad.filter(n => goodK.indexOf(key(n)) < 0);
    const net = v.m.net.split('/')[0];
    return [[v.m.dev, ['enable', 'conf t', 'router ospf 1'].concat(extra.map(n => 'no network ' + n.net + ' ' + n.wild + ' area ' + n.area)).concat(['network ' + net + ' 0.0.0.255 area ' + v.m.area, 'end'])]];
  },
  ospf_default_route: v => [['R-LB1', ['enable', 'conf t'].concat(
    v.m.key === 'originate' ? ['router ospf 1', 'default-information originate']
      : v.m.key === 'static' ? ['ip route 0.0.0.0 0.0.0.0 192.0.2.5']
        : v.m.key === 'nexthop' ? ['no ip route 0.0.0.0 0.0.0.0 192.0.2.9', 'ip route 0.0.0.0 0.0.0.0 192.0.2.5']
          : ['router ospf 1', 'no passive-interface default']).concat(['end'])]],
  ospf_area_mismatch: v => [[v.m.dev, ['enable', 'conf t', 'router ospf 1', 'network 10.30.36.0 0.0.0.3 area 1', 'end']]],
  ec_negotiation: v => { const sw = v.m.key === 'desirable' ? 'SW-CB' : 'SW-CA'; return v.m.key === 'passive-passive' ? [['SW-CA', ['enable', 'conf t', 'int gi0/1', 'channel-group 1 mode active', 'int gi0/2', 'channel-group 1 mode active', 'end']]]
    : [[sw, ['enable', 'conf t', 'int gi0/1', 'channel-group 1 mode active', 'int gi0/2', 'channel-group 1 mode active', 'end']]]; },
  ec_group_missing: v => { const sw = v.m.key === 'cb-both' ? 'SW-CB' : 'SW-CA'; const ps = v.m.key === 'cb-both' ? ['gi0/1', 'gi0/2'] : ['gi0/2'];
    return [[sw, ['enable', 'conf t'].concat(...ps.map(p => ['int ' + p, 'channel-group 1 mode active'])).concat(['end'])]]; },
  ec_member_mismatch: v => v.m.key === 'cb-gi2-access' ? [['SW-CB', ['enable', 'conf t', 'int gi0/2', 'switchport mode trunk', 'end']]]
    : v.m.key === 'ca-gi1-allowed' ? [['SW-CA', ['enable', 'conf t', 'int gi0/1', 'switchport trunk allowed vlan 10,20', 'end']]]
      : [['SW-CB', ['enable', 'conf t', 'int gi0/1', 'switchport trunk native vlan 1', 'int gi0/2', 'switchport trunk native vlan 1', 'end']]],
  ec_allowed_vlan: v => v.m.key === 'ca-cc' ? [['SW-CA', ['enable', 'conf t', 'int fa0/23', 'switchport trunk allowed vlan add 20', 'end']]]
    : [[v.m.key === 'ca-po' ? 'SW-CA' : 'SW-CB', ['enable', 'conf t', 'int port-channel 1', 'switchport trunk allowed vlan add 20', 'end']]],
  ec_po_shutdown: v => [[v.m.sw, ['enable', 'conf t', 'int port-channel 1', 'no shutdown', 'end']]],
  stp_root_moved: v => [[v.m.sw, ['enable', 'conf t', 'no spanning-tree vlan ' + (v.m.key === 'cc-v10' ? '10' : '10,20') + ' priority', 'end']]],
  stp_loop_cable: () => [['SW-CC', ['enable', 'conf t', 'spanning-tree vlan 10', 'end']]],
  ospf_timers: v => [[v.m.dev, ['enable', 'conf t', 'interface ' + v.m.iface, 'no ip ospf hello-interval', 'no ip ospf dead-interval', 'end']]],
  ospf_routerid_dup: v => [[v.m.dev, ['enable', 'conf t', 'router ospf 1', 'router-id ' + v.m.own, 'end', 'clear ip ospf process']]],
};
const defs = SIM.faults.filter(d => /^(c_|ospf_|ec_|stp_)/.test(d.id) && (!only.length || only.some(o => d.id.startsWith(o))));
const verbose = !!process.env.V;
for (const def of defs) {
  const errs0 = bad;
  if (!FIX[def.id]) { fail(def.id, 'aucun script IOS de réparation dans le test'); continue; }
  for (const combo of F.variantCombos(def, 6)) {
    const tag = def.id + JSON.stringify(combo);
    try {
      const names = ['main'].concat(Object.keys((F.instantiate(def, 7, combo).fixes) || {}), Object.keys((F.instantiate(def, 7, combo).workarounds) || {}).map(n => n));
      for (const name of names) {
        const W = SIM.buildHealthyWorld({ seed: 1 }); const base = W.sem(); const env = T.mk(W);
        const inst = F.instantiate(def, 7, combo); F.runSteps(W, inst.inject);
        const isWork = name !== 'main' && !(inst.fixes || {})[name];
        const script = FIX[def.id](inst.vars || {}, name === 'main' ? undefined : name);
        for (const [dev, cmds] of script) run(W, env, dev, cmds, verbose);
        // étapes hors-IOS de la réparation (renouvellement DHCP du poste)
        const fx = name === 'main' ? inst.fix : (inst.fixes || {})[name] || (inst.workarounds || {})[name];
        F.runSteps(W, (fx || []).filter(s => s.do === 'renew' || s.do === 'release'));
        let rt = F.evaluate(W, inst, base);
        if (isWork) { if (rt.status !== 'workaround') fail(tag + '/' + name, 'statut attendu workaround, obtenu ' + rt.status + ' (KO : ' + rt.probes.filter(p => !p.ok).map(p => p.id + ':' + p.why).join(' | ') + ')'); continue; }
        if (!rt.allOk) fail(tag + '/' + name, 'sondes encore KO : ' + rt.probes.filter(p => !p.ok).map(p => p.id + ':' + p.why).join(' | '));
        else if (!rt.rootsFixed) fail(tag + '/' + name, 'racine non réparée (contournement ?)');
        else if (rt.status !== 'fixed') fail(tag + '/' + name, 'statut attendu fixed, obtenu ' + rt.status);
      }
    } catch (e) { fail(tag, e.message.split('\n')[0] + (process.env.V ? '\n' + e.stack : '')); }
  }
  if (bad === errs0) { nOk++; console.log('✓ ' + def.id); }
}
console.log(bad ? '\n' + bad + ' échec(s)' : '\nTout OK (' + nOk + ' pannes)'); process.exit(bad ? 1 : 0);
