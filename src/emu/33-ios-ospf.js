/* ============================================================================
   Cisco IOS — OSPF : mode « router ospf », commandes d'interface « ip ospf … », « show ip ospf … »,
   « show ip protocols », « clear ip ospf process ». Toute sortie est calculée depuis le moteur
   (src/engine/41-ospf.js) ; les messages %OSPF-5-ADJCHG sont issus des changements d'état réels.
   Non reproduits (volontairement, pour ne rien inventer) : « show ip ospf database », « show ip ospf neighbor detail »,
   « debug ip ospf … », compteurs LSA et sommes de contrôle de « show ip ospf » — voir docs/LIMITES.md.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;
const E = SIM.emu; const L = E.L; const I = E.ios; const def = I.def, D = I.D;
const O = SIM.ospf;
const pad = E.padR, padl = E.padL;

U.av('ospf-show-ip-ospf-partial', '« show ip ospf » : seules les lignes dérivables du modèle sont affichées (identifiant, zones, interfaces) ; minuteurs SPF, compteurs et sommes de contrôle LSA, absents, sont à ajouter depuis une capture réelle.');
U.av('ospf-one-process', 'Un seul processus OSPF est géré par l’équipement simulé ; la tentative d’en créer un second affiche un message propre au simulateur (pas d’IOS).');

const hms = sec => U.pad2(Math.floor(sec / 3600)) + ':' + U.pad2(Math.floor(sec / 60) % 60) + ':' + U.pad2(sec % 60);
const shortIf = n => String(n).replace(/^Loopback/, 'Lo').replace(/^GigabitEthernet/, 'Gi').replace(/^FastEthernet/, 'Fa');
const ifOrder = (a, b) => { const la = /^Loopback/.test(a), lb = /^Loopback/.test(b); if (la !== lb) return la ? 1 : -1; return I.portOrder(a, b); };
const areaTxt = a => (a === 0 || a === '0' ? '0' : String(a));
const parseArea = t => { if (/^\d+$/.test(t)) return +t; const m = t.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/); if (m) { const n = ((+m[1] << 24) | (+m[2] << 16) | (+m[3] << 8) | +m[4]) >>> 0; return n; } return null; };
const needOspf = (s, o) => { if (!s.d.ospf) { o.l('% OSPF: Router process not configured'); return false; } return true; };

/* ------------------------------------------------------------------ configuration globale */
def('C', 'router ospf <num>', 'Open Shortest Path First (OSPF)', function (a, rest, o, r) {
  const d = this.d;
  if (d.ospf && d.ospf.pid !== a[0]) { o.l('% Only one OSPF process is supported by this simulator'); return; }
  if (!d.ospf) { d.ospf = { pid: a[0], networks: [], passive: [], nonPassive: [], passiveDefault: false, refBw: 100, defaultOriginate: null }; this.mut(r, 'ospf'); }
  this.mode = 'R'; this.ctx = {};
}, { rt: true });
def('C', 'no router ospf <num>', 'Open Shortest Path First (OSPF)', function (a, rest, o, r) {
  const d = this.d; if (d.ospf && d.ospf.pid === a[0]) { delete d.ospf; this.mut(r, 'ospf'); }
}, { rt: true });
D('router', 'Enable a routing process'); D('no router', 'Enable a routing process');

/* ------------------------------------------------------------------ mode config-router */
const RM = 'R';
def(RM, 'router-id <ip>', 'router-id for this OSPF process', function (a, rest, o, r) {
  const d = this.d, op = d.ospf, W = this.W;
  const cur = O.routerIdOf(W, d); const R = O.routerOf(W, d); const live = !!(R && Object.keys(R.ifs).length);
  if (a[0] === cur) { op.routerId = a[0]; this.mut(r, 'ospf'); return; }
  if (live) { if (!op.activeRid) op.activeRid = cur; op.routerId = a[0]; this.mut(r, 'ospf'); o.l('% OSPF: Reload or use "clear ip ospf process" command, for this to take effect'); return; }
  op.routerId = a[0]; this.mut(r, 'ospf');
});
def(RM, 'no router-id', 'router-id for this OSPF process', function (a, rest, o, r) {
  const d = this.d, op = d.ospf, W = this.W;
  const cur = O.routerIdOf(W, d); delete op.routerId; const after = O.autoRid(W, d);
  const R = O.routerOf(W, d); const live = !!(R && Object.keys(R.ifs).length);
  if (live && after !== cur) { if (!op.activeRid) op.activeRid = cur; o.l('% OSPF: Reload or use "clear ip ospf process" command, for this to take effect'); }
  this.mut(r, 'ospf');
});
def(RM, 'network <ip> <wild> area <word>', 'Set the OSPF area ID', function (a, rest, o, r) {
  const ar = parseArea(a[2]); if (ar === null) { o.l("% Invalid input detected at '^' marker."); return; }
  const nets = this.d.ospf.networks; const net = U.netAddr(a[0], U.wild2mask(a[1]));
  const ex = nets.find(n => n.net === net && n.wild === a[1]);
  if (ex) ex.area = ar; else nets.push({ net: a[0], wild: a[1], area: ar });
  this.mut(r, 'ospf');
});
def(RM, 'no network <ip> <wild> area <word>', 'Set the OSPF area ID', function (a, rest, o, r) {
  const op = this.d.ospf; const n0 = op.networks.length;
  op.networks = op.networks.filter(n => !(n.net === a[0] && n.wild === a[1])); if (op.networks.length !== n0) this.mut(r, 'ospf');
});
D('network', 'Enable routing on an IP network'); D('no network', 'Enable routing on an IP network');
def(RM, 'passive-interface <if>', 'Suppress routing updates on an interface', function (a, rest, o, r) {
  const op = this.d.ospf;
  if (op.passiveDefault) op.nonPassive = op.nonPassive.filter(x => x !== a[0]); else if (op.passive.indexOf(a[0]) < 0) op.passive.push(a[0]);
  this.mut(r, 'ospf');
});
def(RM, 'no passive-interface <if>', 'Suppress routing updates on an interface', function (a, rest, o, r) {
  const op = this.d.ospf;
  if (op.passiveDefault) { if (op.nonPassive.indexOf(a[0]) < 0) op.nonPassive.push(a[0]); } else op.passive = op.passive.filter(x => x !== a[0]);
  this.mut(r, 'ospf');
});
def(RM, 'passive-interface default', 'Suppress routing updates on all interfaces', function (a, rest, o, r) { const op = this.d.ospf; op.passiveDefault = true; op.nonPassive = []; op.passive = []; this.mut(r, 'ospf'); });
def(RM, 'no passive-interface default', 'Suppress routing updates on all interfaces', function (a, rest, o, r) { const op = this.d.ospf; op.passiveDefault = false; op.nonPassive = []; op.passive = []; this.mut(r, 'ospf'); });
D('passive-interface', 'Suppress routing updates on an interface'); D('no passive-interface', 'Suppress routing updates on an interface');
def(RM, 'default-information originate', 'Distribute a default route', function (a, rest, o, r) { const op = this.d.ospf; op.defaultOriginate = { always: false }; this.mut(r, 'ospf'); });
def(RM, 'default-information originate always', 'Always advertise default route', function (a, rest, o, r) { const op = this.d.ospf; op.defaultOriginate = { always: true }; this.mut(r, 'ospf'); });
def(RM, 'no default-information originate', 'Distribute a default route', function (a, rest, o, r) { this.d.ospf.defaultOriginate = null; this.mut(r, 'ospf'); });
def(RM, 'no default-information originate always', 'Always advertise default route', function (a, rest, o, r) { this.d.ospf.defaultOriginate = null; this.mut(r, 'ospf'); });
D('default-information', 'Control distribution of default information'); D('no default-information', 'Control distribution of default information');
D('default-information originate', 'Distribute a default route'); D('no default-information originate', 'Distribute a default route');
def(RM, 'auto-cost reference-bandwidth <num>', 'Use reference bandwidth method to assign OSPF cost', function (a, rest, o, r) {
  const op = this.d.ospf; if (op.refBw !== a[0]) { o.l('% OSPF: Reference bandwidth is changed.'); o.l('        Please ensure reference bandwidth is consistent across all routers.'); }
  op.refBw = a[0]; this.mut(r, 'ospf');
});
def(RM, 'no auto-cost reference-bandwidth', 'Use reference bandwidth method to assign OSPF cost', function (a, rest, o, r) { this.d.ospf.refBw = 100; this.mut(r, 'ospf'); });
D('auto-cost', 'Calculate OSPF interface cost according to bandwidth'); D('auto-cost reference-bandwidth', 'Use reference bandwidth method to assign OSPF cost');
D('no auto-cost', 'Calculate OSPF interface cost according to bandwidth');
def(RM, 'log-adjacency-changes', 'Log changes in adjacency state', function () { });
def(RM, 'log-adjacency-changes detail', 'Log all state changes', function () { });
def(RM, 'no log-adjacency-changes', 'Log changes in adjacency state', function () { });

/* ------------------------------------------------------------------ interface */
const eachRef = s => I.curIfs(s);
const ifSet = (s, r, fn) => { eachRef(s).forEach(x => fn(x.obj)); s.mut(r, 'ospf'); };
def('I', 'ip ospf hello-interval <num>', 'Time between HELLO packets', function (a, rest, o, r) { ifSet(this, r, i => { i.ospfHello = a[0]; if (!i.ospfDeadExplicit) i.ospfDead = a[0] * 4; }); }, { rt: true });
def('I', 'no ip ospf hello-interval', 'Time between HELLO packets', function (a, rest, o, r) { ifSet(this, r, i => { delete i.ospfHello; if (!i.ospfDeadExplicit) delete i.ospfDead; }); }, { rt: true });
def('I', 'ip ospf dead-interval <num>', 'Interval after which a neighbor is declared dead', function (a, rest, o, r) { ifSet(this, r, i => { i.ospfDead = a[0]; i.ospfDeadExplicit = true; }); }, { rt: true });
def('I', 'no ip ospf dead-interval', 'Interval after which a neighbor is declared dead', function (a, rest, o, r) { ifSet(this, r, i => { delete i.ospfDeadExplicit; if (i.ospfHello) i.ospfDead = i.ospfHello * 4; else delete i.ospfDead; }); }, { rt: true });
def('I', 'ip ospf cost <num>', 'Interface cost', function (a, rest, o, r) { ifSet(this, r, i => { i.ospfCost = a[0]; }); }, { rt: true });
def('I', 'no ip ospf cost', 'Interface cost', function (a, rest, o, r) { ifSet(this, r, i => { delete i.ospfCost; }); }, { rt: true });
def('I', 'ip ospf priority <num>', 'Router priority', function (a, rest, o, r) { if (a[0] > 255) { o.l("% Invalid input detected at '^' marker."); return; } ifSet(this, r, i => { i.ospfPriority = a[0]; }); }, { rt: true });
def('I', 'no ip ospf priority', 'Router priority', function (a, rest, o, r) { ifSet(this, r, i => { delete i.ospfPriority; }); }, { rt: true });
def('I', 'ip ospf <num> area <word>', 'Set the OSPF area ID', function (a, rest, o, r) {
  const ar = parseArea(a[1]); if (ar === null) { o.l("% Invalid input detected at '^' marker."); return; }
  if (!this.d.ospf || this.d.ospf.pid !== a[0]) { o.l('% OSPF: Router process ' + a[0] + ' is not running, please configure ' + '"router ospf ' + a[0] + '"'); return; }
  ifSet(this, r, i => { i.ospfArea = ar; });
}, { rt: true });
def('I', 'no ip ospf <num> area <word>', 'Set the OSPF area ID', function (a, rest, o, r) { ifSet(this, r, i => { delete i.ospfArea; }); }, { rt: true });
D('ip ospf', 'OSPF interface commands'); D('no ip ospf', 'OSPF interface commands');
D('ip ospf hello-interval', 'Time between HELLO packets'); D('ip ospf dead-interval', 'Interval after which a neighbor is declared dead');
D('ip ospf cost', 'Interface cost'); D('ip ospf priority', 'Router priority');

/* ------------------------------------------------------------------ affichage */
function stateOf(i, up) { if (!up) return 'DOWN'; if (i.loop) return 'LOOP'; return i.role || 'DOWN'; }
/* toutes les interfaces rattachées au processus (même éteintes) : [{name, ip, mask, up, i}] */
function ospfIfs(s) {
  const d = s.d, W = s.W, R = O.routerOf(W, d); const out = [];
  const nets = d.ospf.networks || [];
  N.l3(W, d).forEach(x => {
    if (!x.ip || x.ip === '0.0.0.0') return;
    const live = R && R.ifs[x.name];
    if (live) { out.push({ name: x.name, ip: x.ip, mask: live.mask, len: live.len, up: true, i: live }); return; }
    const cfg = (d.ifaces && d.ifaces[x.name]) || {};
    const m = nets.find(n => U.wildMatch(x.ip, n.net, n.wild)) || (cfg.ospfArea !== undefined ? { area: cfg.ospfArea } : null);
    if (m) out.push({ name: x.name, ip: x.ip, mask: x.mask, len: U.mask2len(x.mask), up: false, area: m.area, i: { area: m.area, cost: O.cost(d, x.name), nbrs: [], passive: O.isPassive(d, x.name), loop: /^Loopback/.test(x.name) } });
  });
  return out.sort((x, y) => ifOrder(x.name, y.name));
}
def('UP', 'show ip ospf neighbor', 'Neighbor list', function (a, rest, o) {
  this.env.obs('show:' + this.d.id + ':ospf-neighbor', true);   /* la vérification d'une panne de voisinage est la lecture de l'état (D-76), pas un ping masqué par l'anneau */
  const d = this.d, W = this.W; if (!needOspf(this, o)) return;
  const R = O.routerOf(W, d); if (!R) return;
  const rows = O.neighbors(W, d).sort((x, y) => U.ip2n(x.rid) - U.ip2n(y.rid) || I.portOrder(x.iface, y.iface));
  if (!rows.length) return;
  o.l('Neighbor ID     Pri   State           Dead Time   Address         Interface');
  rows.forEach(n => {
    const mi = R.ifs[n.iface]; const rem = mi.dead - ((Math.floor(W.clock.elapsed) + (parseInt(U.hash8(n.rid + n.iface).slice(0, 2), 16))) % mi.hello);
    o.l(pad(n.rid, 16) + padl(n.prio, 3) + '   ' + pad(n.state + '/' + n.role, 16) + pad(hms(rem), 12) + pad(n.ip, 16) + n.iface);
  });
}, { rt: true });
D('show ip ospf', 'OSPF information'); D('show ip ospf neighbor', 'Neighbor list');

def('UP', 'show ip ospf interface brief', 'Brief summary of OSPF interface status', function (a, rest, o) {
  const d = this.d; if (!needOspf(this, o)) return;
  o.l('Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C');
  ospfIfs(this).forEach(x => {
    const nb = x.i.nbrs || []; const full = nb.filter(n => n.state === 'FULL').length;
    o.l(pad(shortIf(x.name), 13) + pad(d.ospf.pid, 6) + pad(areaTxt(x.i.area), 16) + pad(x.ip + '/' + x.len, 19) + pad(x.i.cost, 6) + pad(stateOf(x.i, x.up) === 'DROTHER' ? 'DROTH' : stateOf(x.i, x.up), 6) + full + '/' + nb.length);
  });
}, { rt: true });
function ifDetail(s, o, x) {
  const d = s.d, W = s.W, R = O.routerOf(W, d); const i = x.i;
  o.l(x.name + ' is ' + (x.up ? 'up' : 'down') + ', line protocol is ' + (x.up ? 'up' : 'down') + ' ');
  o.l('  Internet Address ' + x.ip + '/' + x.len + ', Area ' + areaTxt(i.area) + ', Attached via ' + (i.viaIface ? 'Interface Enable' : 'Network Statement'));
  if (!x.up) { o.l('  Process ID ' + d.ospf.pid + ', Router ID ' + R.rid + ', Network Type BROADCAST, Cost: ' + i.cost); return; }
  if (i.loop) {
    o.l('  Process ID ' + d.ospf.pid + ', Router ID ' + R.rid + ', Network Type LOOPBACK, Cost: ' + i.cost);
    return;
  }
  o.l('  Process ID ' + d.ospf.pid + ', Router ID ' + R.rid + ', Network Type BROADCAST, Cost: ' + i.cost);
  o.l('  Transmit Delay is 1 sec, State ' + i.role + ', Priority ' + i.prio + ' ');
  if (i.dr) o.l('  Designated Router (ID) ' + i.dr.rid + ', Interface address ' + i.dr.ip); else o.l('  No designated router on this network');
  if (i.bdr) o.l('  Backup Designated router (ID) ' + i.bdr.rid + ', Interface address ' + i.bdr.ip); else o.l('  No backup designated router on this network');
  o.l('  Timer intervals configured, Hello ' + i.hello + ', Dead ' + i.dead + ', Wait ' + i.dead + ', Retransmit 5');
  if (i.passive) o.l('    No Hellos (Passive interface)');
  else {
    o.l('    Hello due in ' + hms(i.hello - (Math.floor(W.clock.elapsed) % i.hello) - 1 + 0));
  }
  const full = i.nbrs.filter(n => n.state === 'FULL');
  o.l('  Neighbor Count is ' + i.nbrs.length + ', Adjacent neighbor count is ' + full.length + ' ');
  full.forEach(n => o.l('    Adjacent with neighbor ' + n.rid + (n.role === 'DR' ? '  (Designated Router)' : n.role === 'BDR' ? '  (Backup Designated Router)' : '')));
}
def('UP', 'show ip ospf interface', 'Interface information', function (a, rest, o) {
  if (!needOspf(this, o)) return; ospfIfs(this).forEach(x => ifDetail(this, o, x));
}, { rt: true });
def('UP', 'show ip ospf interface <if>', 'Interface information', function (a, rest, o) {
  if (!needOspf(this, o)) return; const x = ospfIfs(this).find(y => y.name === a[0]);
  if (!x) { o.l('%OSPF: OSPF not enabled on ' + a[0]); return; }
  ifDetail(this, o, x);
}, { rt: true });
D('show ip ospf interface', 'Interface information');

def('UP', 'show ip ospf', 'OSPF information', function (a, rest, o) {
  const d = this.d, W = this.W; if (!needOspf(this, o)) return;
  const R = O.routerOf(W, d); const rid = R ? R.rid : O.routerIdOf(W, d);
  o.l(' Routing Process "ospf ' + d.ospf.pid + '" with ID ' + rid);
  o.l(' Supports only single TOS(TOS0) routes');
  { const abr = O.isAbr(W, d), asbr = O.defaultOriginating(W, d); if (abr || asbr) o.l(' It is ' + (abr && asbr ? 'an area border and autonomous system boundary router' : abr ? 'an area border router' : 'an autonomous system boundary router')); }
  const per = {}; ospfIfs(this).forEach(x => { const k = areaTxt(x.i.area); (per[k] = per[k] || []).push(x); });
  const keys = Object.keys(per).sort((x, y) => (+x) - (+y));
  o.l(' Number of areas in this router is ' + keys.length + '. ' + keys.length + ' normal 0 stub 0 nssa');
  o.l(' Reference bandwidth unit is ' + (d.ospf.refBw || 100) + ' mbps');
  keys.forEach(k => {
    const list = per[k]; const lo = list.filter(x => x.i.loop).length;
    o.l('    Area ' + (k === '0' ? 'BACKBONE(0)' : k));
    o.l('        Number of interfaces in this area is ' + list.length + (lo ? ' (' + lo + ' loopback)' : ''));
    o.l('        Area has no authentication');
  });
}, { rt: true });

def('UP', 'show ip protocols', 'IP routing protocol process parameters and statistics', function (a, rest, o) {
  const d = this.d, W = this.W;
  if (!d.ospf) { o.l('*** IP Routing is NSF aware ***'); o.l(''); return; }
  const R = O.routerOf(W, d); const rid = R ? R.rid : O.routerIdOf(W, d);
  o.l('*** IP Routing is NSF aware ***'); o.l('');
  o.l('Routing Protocol is "ospf ' + d.ospf.pid + '"');
  o.l('  Outgoing update filter list for all interfaces is not set ');
  o.l('  Incoming update filter list for all interfaces is not set ');
  o.l('  Router ID ' + rid);
  { const abr = O.isAbr(W, d), asbr = O.defaultOriginating(W, d); if (abr || asbr) o.l('  It is ' + (abr && asbr ? 'an area border and autonomous system boundary router' : abr ? 'an area border router' : 'an autonomous system boundary router')); if (asbr) o.l('  Redistributing External Routes from,'); }
  const areas = []; ospfIfs(this).forEach(x => { if (areas.indexOf(x.i.area) < 0) areas.push(x.i.area); });
  o.l('  Number of areas in this router is ' + areas.length + '. ' + areas.length + ' normal 0 stub 0 nssa');
  o.l('  Maximum path: 4');
  o.l('  Routing for Networks:');
  d.ospf.networks.forEach(n => o.l('    ' + n.net + ' ' + n.wild + ' area ' + areaTxt(n.area)));
  ospfIfs(this).filter(x => x.i.viaIface).forEach(x => o.l('    ' + x.name + ' (area ' + areaTxt(x.i.area) + ')'));
  const pas = ospfIfs(this).filter(x => x.i.passive && !x.i.loop).map(x => x.name);
  if (pas.length) { o.l('  Passive Interface(s):'); pas.forEach(n => o.l('    ' + n)); }
  o.l('  Routing Information Sources:');
  o.l('    Gateway         Distance      Last Update');
  if (R) {
    const st = O.state(W); const seen = {};
    Object.keys(st.R).forEach(id => {
      if (id === d.id) return; const B = st.R[id];
      if (!st.routes[d.id].some(r => r.proto === 'ospf') && !O.neighbors(W, d).length) return;
      const reach = O.neighbors(W, d).some(n => n.dev === id) || st.routes[d.id].some(r => r.viaDev === id);
      if (!reach || seen[B.rid]) return; seen[B.rid] = 1;
      const near = O.neighbors(W, d).find(n => n.dev === id);
      const age = near ? Math.max(0, Math.round(W.clock.elapsed - near.since)) % 1800 : 60 + (parseInt(U.hash8(B.rid).slice(0, 2), 16) % 600);
      o.l('    ' + pad(B.rid, 16) + padl(110, 8) + '      ' + hms(age));
    });
  }
  o.l('  Distance: (default is 110)'); o.l('');
}, { rt: true });

/* ------------------------------------------------------------------ remise à zéro du processus */
function clearProc(s, o, r) {
  const d = s.d, W = s.W; if (!needOspf(s, o)) return;
  const before = O.neighbors(W, d);
  const was = O.routerIdOf(W, d); delete d.ospf.activeRid; const now = O.routerIdOf(W, d);
  if (was === now) before.forEach(n => {
    O.emit(W, d.id, '%OSPF-5-ADJCHG: Process ' + d.ospf.pid + ', Nbr ' + n.rid + ' on ' + n.iface + ' from FULL to DOWN, Neighbor Down: Interface down or detached');
    O.emit(W, d.id, '%OSPF-5-ADJCHG: Process ' + d.ospf.pid + ', Nbr ' + n.rid + ' on ' + n.iface + ' from LOADING to FULL, Loading Done');
  });
  s.env.touch('ospf'); r.mutated = true;
}
function clearAsk(s, r) {
  r.ask = { prompt: 'Reset ALL OSPF processes? [no]: ', echo: true, cb: l => {
    if (/^y(es)?$/i.test(l.trim())) { const o2 = new E.Out(); const rr = { mutated: false }; clearProc(s, o2, rr); return { out: o2.lines, mutated: true }; }
    return { out: [] };
  } };
}
def('P', 'clear ip ospf process', 'Reset all OSPF processes', function (a, rest, o, r) { if (!needOspf(this, o)) return; clearAsk(this, r); }, { rt: true });
def('P', 'clear ip ospf <num> process', 'Reset OSPF process', function (a, rest, o, r) { if (!needOspf(this, o)) return; clearAsk(this, r); }, { rt: true });
D('clear ip ospf', 'OSPF clear commands'); D('clear ip', 'IP'); D('clear', 'Reset functions');

/* ------------------------------------------------------------------ messages OSPF émis par le moteur → console */
const flush0 = I.IosShell.prototype.flushPend;
I.IosShell.prototype.flushPend = function (res) {
  const q = this.d._rt.ospfOut;
  if (q && q.length) {
    q.forEach(m => { const ts = new Date(m.t); this.pend.push(L('*' + E.syslogTs(ts) + '.' + String(ts.getUTCMilliseconds()).padStart(3, '0') + ': ' + m.msg, 'o')); });
    this.d._rt.ospfOut = [];
  }
  return flush0.call(this, res);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
