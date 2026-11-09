/* ============================================================================
   Cisco IOS — EtherChannel et Spanning Tree : « channel-group », « interface port-channel », « spanning-tree … »,
   « show etherchannel summary », « show spanning-tree [vlan N] », « show spanning-tree blockedports ».
   Toute sortie est calculée depuis le moteur (src/engine/42-l2.js) ; les messages %EC / %SPANTREE sont issus des
   changements d'état réels (file d'attente d._rt.l2Out, vidée à l'affichage de l'invite suivante).
   Non reproduits (volontairement, pour ne rien inventer) : « show etherchannel port-channel / detail », « show lacp … »,
   « show spanning-tree summary / root / interface … », MST, protection BPDU Guard (commande acceptée, aucun effet) —
   voir docs/LIMITES.md.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;
const E = SIM.emu; const L = E.L; const I = E.ios; const def = I.def, D = I.D;
const L2 = SIM.l2; const H = I.l2h = I.l2h || {};
const pad = E.padR, padl = E.padL;

U.av('l2-runcfg', 'Position et libellé des lignes « channel-group », « spanning-tree portfast / bpduguard / cost / port-priority » dans une interface du running-config, et regroupement « spanning-tree vlan 1,10 priority N » : ordre reconstitué de mémoire (IOS 15.0), à comparer à une capture.');
U.av('l2-po-create', 'Création automatique de l’interface « Port-channel N » par « channel-group » : ligne « Creating a port-channel interface Port-channel N » reprise du cours (Packet Tracer) ; la recopie du mode / VLAN / VLAN autorisés du premier membre vers la nouvelle interface logique est une hypothèse du simulateur, à vérifier sur matériel.');
U.av('l2-stp-prio-err', 'Message d’erreur de « spanning-tree vlan N priority X » quand X n’est pas un multiple de 4096 (« % Bridge Priority must be in increments of 4096. » et liste des valeurs permises) : reconstitué de mémoire.');
U.av('l2-stp-portfast-warn', 'Avertissements affichés par « spanning-tree portfast » en mode interface (« %Warning: portfast should only be enabled on ports connected to a single host… » et « %Portfast has been configured on … ») : texte reconstitué de mémoire.');
U.av('l2-show-po', '« show interfaces port-channel N » : mise en page (« Hardware is EtherChannel », BW = somme des membres agrégés, « Members in this channel: … ») reconstituée de mémoire, à comparer à une capture.');
U.av('l2-stp-blocked', '« show spanning-tree blockedports » : mise en page (Name / Blocked Interfaces List, « Number of blocked ports (segments) in the system : N ») reconstituée de mémoire.');
U.av('l2-stp-none', 'Messages « Spanning tree instance(s) for vlan N does not exist. » et « No spanning tree instance exists. » (STP désactivé pour le VLAN) : reconstitués de mémoire.');
U.av('l2-status-suspended', 'État « suspended » affiché par « show interfaces status » pour un membre EtherChannel suspendu, et ordre des interfaces Port-channel dans les « show » (placées après les ports physiques) : à vérifier sur capture.');
U.av('l2-ec-modechange', 'Ré-saisie de « channel-group N mode … » sur un port déjà membre avec un autre mode (par ex. on → active, desirable → active) : le simulateur remplace le mode sans message ; IOS réel peut exiger de retirer d’abord le port du groupe (« no channel-group ») — comportement non vérifié.');
U.av('l2-no-po', '« no interface port-channel N » : le simulateur supprime l’interface logique ET la ligne « channel-group » des membres ; le comportement réel d’IOS (membres conservés, interface recréée) n’est pas vérifié.');
U.av('l2-root-macro', '« spanning-tree vlan N root primary / secondary » : le simulateur applique la règle publiée (24576 / 28672, ou 4096 de moins que la racine actuelle si sa priorité est inférieure) et affiche la priorité résultante dans le running-config ; les messages exacts en cas d’échec ne sont pas reproduits.');

const isSwShell = s => s.d.kind === 'ios-sw';
const INVALID = o => o.l("% Invalid input detected at '^' marker.");
const shortIf = n => I.shortIf(n);

/* ------------------------------------------------------------------ interface : channel-group */
function physRefs(s, o) {
  const refs = I.curIfs(s);
  if (!refs.length || refs.some(x => x.kind !== 'port' || x.obj.logical)) { INVALID(o); return null; }
  return refs;
}
const MODE_HELP = { active: 'Enable LACP unconditionally', passive: 'Enable LACP only if a LACP device is detected', on: 'Enable Etherchannel only', desirable: 'Enable PAgP unconditionally', auto: 'Enable PAgP only if a PAgP device is detected' };
L2.MODES.forEach(mode => {
  def('I', 'channel-group <num> mode ' + mode, MODE_HELP[mode], function (a, rest, o, r) {
    const d = this.d, grp = a[0];
    if (grp < 1 || grp > I.maxChannels(d)) { INVALID(o); return; }
    const refs = physRefs(this, o); if (!refs) return;
    const poName = L2.poName(grp);
    refs.forEach(x => {
      if (!d.ports[poName]) {
        const po = I.ifRef(d, poName, true).obj;
        po.mode = x.obj.mode === 'trunk' ? 'trunk' : 'access'; po.vlan = x.obj.vlan || 1;
        if (x.obj.mode === 'trunk') { po.allowed = x.obj.allowed === undefined || x.obj.allowed === 'all' ? 'all' : x.obj.allowed.slice(); po.native = x.obj.native || 1; }
        o.l('Creating a port-channel interface Port-channel ' + grp);
      }
      x.obj.chan = { group: grp, mode };
    });
    this.mut(r, 'ec');
  }, { sw: true });
});
def('I', 'channel-group <num>', 'Etherchannel Group Number', function (a, rest, o) { o.l('% Incomplete command.'); o.l(''); }, { sw: true });
D('channel-group', 'Add this interface to an EtherChannel group');
def('I', 'no channel-group', 'Add this interface to an EtherChannel group', function (a, rest, o, r) {
  const refs = physRefs(this, o); if (!refs) return;
  refs.forEach(x => { delete x.obj.chan; }); this.mut(r, 'ec');
}, { sw: true });
def('I', 'no channel-group <num>', 'Etherchannel Group Number', function (a, rest, o, r) {
  const refs = physRefs(this, o); if (!refs) return;
  refs.forEach(x => { if (x.obj.chan && x.obj.chan.group === a[0]) delete x.obj.chan; }); this.mut(r, 'ec');
}, { sw: true });
D('no channel-group', 'Add this interface to an EtherChannel group');

/* commandes valides sans effet simulé : mémorisées pour le running-config */
function ifExtra(spec, desc) {
  def('I', spec, desc, function (a, rest, o, r, line) { if (spec.indexOf('*rest') >= 0 && !rest.length) { o.l('% Incomplete command.'); return; } const t = line.trim().replace(/\s+/g, ' '); I.curIfs(this).forEach(x => { x.obj.extra = x.obj.extra || []; if (x.obj.extra.indexOf(t) < 0) x.obj.extra.push(t); }); this.mut(r, 'iface'); }, { sw: true });
  def('I', 'no ' + spec, desc, function (a, rest, o, r, line) { const t = line.trim().replace(/\s+/g, ' ').replace(/^no /, ''); I.curIfs(this).forEach(x => { x.obj.extra = (x.obj.extra || []).filter(e => e !== t); }); this.mut(r, 'iface'); }, { sw: true });
}
ifExtra('channel-protocol <word>', 'Select the channel protocol (LACP, PAgP)');
ifExtra('lacp port-priority <num>', 'Priority for the port');
D('lacp', 'LACP interface subcommands'); D('lacp port-priority', 'Priority for the port'); D('channel-protocol', 'Select the channel protocol (LACP, PAgP)');
function globalExtra(spec, desc) {
  const add = (s, t) => { const d = s.d; d.extra = d.extra || {}; (d.extra.global = d.extra.global || []); if (d.extra.global.indexOf(t) < 0) d.extra.global.push(t); };
  def('C', spec, desc, function (a, rest, o, r, line) { if (spec.indexOf('*rest') >= 0 && !rest.length) { o.l('% Incomplete command.'); return; } add(this, line.trim().replace(/\s+/g, ' ')); this.mut(r, 'cfg'); }, { sw: true });
  def('C', 'no ' + spec, desc, function (a, rest, o, r, line) { const t = line.trim().replace(/\s+/g, ' ').replace(/^no /, ''); const x = this.d.extra && this.d.extra.global; if (x) { const i = x.indexOf(t); if (i >= 0) x.splice(i, 1); } this.mut(r, 'cfg'); }, { sw: true });
}
globalExtra('port-channel load-balance <word>', 'Port Channel Load Balancing');
globalExtra('lacp system-priority <num>', 'LACP system priority');
D('port-channel', 'EtherChannel configuration'); D('lacp', 'LACP configuration');

/* suppression de l'interface logique */
const noIf0 = I.defs.find(x => x.modes === 'C' && x.spec === 'no interface <if>');
if (noIf0) {
  const fn0 = noIf0.fn;
  noIf0.fn = function (a, rest, o, r) {
    const d = this.d;
    if (d.kind === 'ios-sw' && L2.isPo(a[0]) && d.ports[a[0]]) {
      const g = L2.poNum(a[0]); delete d.ports[a[0]];
      Object.keys(d.ports).forEach(n => { const c = d.ports[n].chan; if (c && c.group === g) delete d.ports[n].chan; });
      this.mut(r, 'iface'); return;
    }
    return fn0.call(this, a, rest, o, r);
  };
}

/* l'interface logique impose sa configuration à ses membres (comme IOS : les commandes passées sur le Port-channel sont répercutées) */
function syncPo(d, ctx) {
  const names = (ctx && ctx.ifs) || [];
  names.forEach(n => {
    if (!L2.isPo(n) || !d.ports[n]) return;
    const po = d.ports[n], g = L2.poNum(n);
    Object.keys(d.ports).forEach(pn => {
      const p = d.ports[pn]; if (p.logical || !p.chan || p.chan.group !== g) return;
      p.mode = po.mode; p.vlan = po.vlan; p.native = po.native;
      if (po.allowed === undefined) delete p.allowed; else p.allowed = Array.isArray(po.allowed) ? po.allowed.slice() : po.allowed;
    });
  });
}
const mut0 = I.IosShell.prototype.mut;
I.IosShell.prototype.mut = function (rr, why) {
  if (this.mode === 'I' && this.d.kind === 'ios-sw') syncPo(this.d, this.ctx);
  return mut0.call(this, rr, why);
};

/* ------------------------------------------------------------------ Spanning Tree : global */
const stpOf = d => (d.stp = d.stp || { mode: 'pvst', prio: {}, off: [] });
const listArg = (s, o, txt) => { const l = I.vlanList(txt); if (!l) { INVALID(o); return null; } return l; };
const PRIO_ERR = ['% Bridge Priority must be in increments of 4096.', '% Allowed values are:', '  0     4096  8192  12288 16384 20480 24576 28672', '  32768 36864 40960 45056 49152 53248 57344 61440'];
def('C', 'spanning-tree mode <word>', 'Spanning tree operating mode', function (a, rest, o, r) {
  const m = ['pvst', 'rapid-pvst', 'mst'].filter(x => x.indexOf(a[0].toLowerCase()) === 0);
  if (m.length !== 1) { INVALID(o); return; }
  stpOf(this.d).mode = m[0]; this.mut(r, 'stp');
}, { sw: true });
def('C', 'no spanning-tree mode', 'Spanning tree operating mode', function (a, rest, o, r) { stpOf(this.d).mode = 'pvst'; this.mut(r, 'stp'); }, { sw: true });
def('C', 'spanning-tree extend system-id', 'Extend ID', function () { }, { sw: true });
def('C', 'spanning-tree vlan <vlanlist> priority <int>', 'Set the bridge priority for the spanning tree', function (a, rest, o, r) {
  const l = listArg(this, o, a[0]); if (!l) return;
  if (a[1] % 4096 !== 0 || a[1] > 61440) { PRIO_ERR.forEach(t => o.l(t)); return; }
  const st = stpOf(this.d); l.forEach(v => { if (a[1] === 32768) delete st.prio[v]; else st.prio[v] = a[1]; }); this.mut(r, 'stp');
}, { sw: true });
def('C', 'no spanning-tree vlan <vlanlist> priority', 'Set the bridge priority for the spanning tree', function (a, rest, o, r) {
  const l = listArg(this, o, a[0]); if (!l) return; const st = stpOf(this.d); l.forEach(v => { delete st.prio[v]; }); this.mut(r, 'stp');
}, { sw: true });
function rootMacro(s, o, r, txt, kind) {
  const l = listArg(s, o, txt); if (!l) return; const st = stpOf(s.d);
  l.forEach(v => {
    const b = L2.bridge(s.W, s.d, v);
    let target;
    if (kind === 'secondary') target = 28672;
    else if (b && !b.isRoot) target = b.rootPrio > 24576 ? 24576 : b.rootPrio - 4096;
    else target = 24576;
    if (target < 0 || (b && !b.isRoot && b.rootPrio === 0)) { o.l('% Failed to make the bridge root for vlan ' + v); return; }
    if (kind === 'primary' && b && b.isRoot && b.prio <= target) return;
    if (target === 32768) delete st.prio[v]; else st.prio[v] = target;
  });
  s.mut(r, 'stp');
}
def('C', 'spanning-tree vlan <vlanlist> root primary', 'Configure this switch as primary root for this spanning tree', function (a, rest, o, r) { rootMacro(this, o, r, a[0], 'primary'); }, { sw: true });
def('C', 'spanning-tree vlan <vlanlist> root secondary', 'Configure switch as secondary root', function (a, rest, o, r) { rootMacro(this, o, r, a[0], 'secondary'); }, { sw: true });
def('C', 'spanning-tree vlan <vlanlist>', 'VLAN Switch Spanning Tree', function (a, rest, o, r) {
  const l = listArg(this, o, a[0]); if (!l) return; const st = stpOf(this.d); st.off = (st.off || []).filter(v => l.indexOf(v) < 0); this.mut(r, 'stp');
}, { sw: true });
def('C', 'no spanning-tree vlan <vlanlist>', 'VLAN Switch Spanning Tree', function (a, rest, o, r) {
  const l = listArg(this, o, a[0]); if (!l) return; const st = stpOf(this.d); st.off = U.uniq((st.off || []).concat(l)).sort((x, y) => x - y); this.mut(r, 'stp');
}, { sw: true });
function stpVlanExtra(neg) {
  def('C', (neg ? 'no ' : '') + 'spanning-tree vlan <vlanlist> *rest', 'VLAN Switch Spanning Tree', function (a, rest, o, r, line) {
    const l = listArg(this, o, a[0]); if (!l) return;
    const t = line.trim().replace(/\s+/g, ' ').replace(/^no /, ''); const d = this.d; d.extra = d.extra || {}; d.extra.global = d.extra.global || [];
    if (neg) d.extra.global = d.extra.global.filter(e => e !== t); else if (d.extra.global.indexOf(t) < 0) d.extra.global.push(t);
    this.mut(r, 'cfg');
  }, { sw: true });
}
stpVlanExtra(false); stpVlanExtra(true);
D('spanning-tree', 'Spanning Tree Subsystem'); D('spanning-tree mode', 'Spanning tree operating mode'); D('spanning-tree vlan', 'VLAN Switch Spanning Tree'); D('spanning-tree extend', 'Spanning Tree 802.1t extensions');
D('no spanning-tree', 'Spanning Tree Subsystem'); D('no spanning-tree vlan', 'VLAN Switch Spanning Tree');

/* ------------------------------------------------------------------ Spanning Tree : interface */
const stOf = p => (p.stp = p.stp || {});
const cleanSt = p => { if (p.stp && !Object.keys(p.stp).length) delete p.stp; };
def('I', 'spanning-tree portfast', 'Enable an interface to move directly to forwarding on link up', function (a, rest, o, r) {
  const refs = physRefs(this, o); if (!refs) return;
  refs.forEach(x => { stOf(x.obj).portfast = true; });
  o.l('%Warning: portfast should only be enabled on ports connected to a single'); o.l(' host. Connecting hubs, concentrators, switches, bridges, etc... to this'); o.l('  interface when portfast is enabled, can cause temporary bridging loops.'); o.l(' Use with CAUTION'); o.l('');
  refs.forEach(x => { o.l('%Portfast has been configured on ' + x.name + ' but will only'); o.l(' have effect when the interface is in a non-trunking mode.'); });
  this.mut(r, 'stp');
}, { sw: true });
def('I', 'no spanning-tree portfast', 'Enable an interface to move directly to forwarding on link up', function (a, rest, o, r) {
  const refs = physRefs(this, o); if (!refs) return; refs.forEach(x => { if (x.obj.stp) { delete x.obj.stp.portfast; cleanSt(x.obj); } }); this.mut(r, 'stp');
}, { sw: true });
ifExtra('spanning-tree portfast <word>', 'Enable an interface to move directly to forwarding on link up');
def('I', 'spanning-tree bpduguard enable', 'Enable BPDU guard for this interface', function (a, rest, o, r) { const refs = physRefs(this, o); if (!refs) return; refs.forEach(x => { stOf(x.obj).bpduguard = 'enable'; }); this.mut(r, 'stp'); }, { sw: true });
def('I', 'spanning-tree bpduguard disable', 'Disable BPDU guard for this interface', function (a, rest, o, r) { const refs = physRefs(this, o); if (!refs) return; refs.forEach(x => { stOf(x.obj).bpduguard = 'disable'; }); this.mut(r, 'stp'); }, { sw: true });
def('I', 'no spanning-tree bpduguard', 'Don\'t enforce BPDU guard on this interface', function (a, rest, o, r) { const refs = physRefs(this, o); if (!refs) return; refs.forEach(x => { if (x.obj.stp) { delete x.obj.stp.bpduguard; cleanSt(x.obj); } }); this.mut(r, 'stp'); }, { sw: true });
def('I', 'spanning-tree cost <num>', 'Change an interface\'s spanning tree port path cost', function (a, rest, o, r) {
  if (a[0] < 1 || a[0] > 200000000) { INVALID(o); return; }
  const refs = I.curIfs(this); if (!refs.length || refs.some(x => x.kind !== 'port')) { INVALID(o); return; }
  refs.forEach(x => { stOf(x.obj).cost = a[0]; }); this.mut(r, 'stp');
}, { sw: true });
def('I', 'no spanning-tree cost', 'Change an interface\'s spanning tree port path cost', function (a, rest, o, r) { I.curIfs(this).forEach(x => { if (x.obj.stp) { delete x.obj.stp.cost; cleanSt(x.obj); } }); this.mut(r, 'stp'); }, { sw: true });
def('I', 'spanning-tree port-priority <num>', 'Change an interface\'s spanning tree priority', function (a, rest, o, r) {
  if (a[0] > 240) { INVALID(o); return; }
  const refs = I.curIfs(this); if (!refs.length || refs.some(x => x.kind !== 'port')) { INVALID(o); return; }
  refs.forEach(x => { if (a[0] === 128) { if (x.obj.stp) { delete x.obj.stp.prio; cleanSt(x.obj); } } else stOf(x.obj).prio = a[0]; }); this.mut(r, 'stp');
}, { sw: true });
def('I', 'no spanning-tree port-priority', 'Change an interface\'s spanning tree priority', function (a, rest, o, r) { I.curIfs(this).forEach(x => { if (x.obj.stp) { delete x.obj.stp.prio; cleanSt(x.obj); } }); this.mut(r, 'stp'); }, { sw: true });
D('spanning-tree bpduguard', 'Don\'t accept BPDUs on this interface'); D('spanning-tree cost', 'Change an interface\'s spanning tree port path cost'); D('spanning-tree port-priority', 'Change an interface\'s spanning tree priority');

/* ------------------------------------------------------------------ running-config */
H.stpGlobal = function (d) {
  const out = []; const st = d.stp || {};
  out.push('spanning-tree mode ' + (st.mode || 'pvst'), 'spanning-tree extend system-id');
  const byPrio = {}; Object.keys(st.prio || {}).map(Number).sort((a, b) => a - b).forEach(v => { (byPrio[st.prio[v]] = byPrio[st.prio[v]] || []).push(v); });
  Object.keys(byPrio).sort((a, b) => byPrio[a][0] - byPrio[b][0]).forEach(p => out.push('spanning-tree vlan ' + I.vlanText(byPrio[p]) + ' priority ' + p));
  if ((st.off || []).length) out.push('no spanning-tree vlan ' + I.vlanText(st.off.slice().sort((a, b) => a - b)));
  return out;
};
H.ifLines = function (p, n) {
  const out = [];
  if (p.chan) out.push(' channel-group ' + p.chan.group + ' mode ' + p.chan.mode);
  const st = p.stp;
  if (st) {
    if (st.portfast) out.push(' spanning-tree portfast');
    if (st.bpduguard) out.push(' spanning-tree bpduguard ' + st.bpduguard);
    if (st.cost) out.push(' spanning-tree cost ' + st.cost);
    if (st.prio) out.push(' spanning-tree port-priority ' + st.prio);
  }
  return out;
};

/* ------------------------------------------------------------------ crochets d'affichage utilisés par 32-ios-show.js */
H.hiddenMember = (W, d, n) => !d.ports[n].logical && !!L2.bundledPo(W, d, n);
H.skipPort = (W, d, n, v) => {
  if (d.kind !== 'ios-sw') return false; const p = d.ports[n]; if (!p || p.logical) return true;
  return L2.suspended(W, d, n) || !L2.fwd(W, d, n, v);
};
H.repPort = (W, d, n) => (d.kind === 'ios-sw' && d.ports[n] && !d.ports[n].logical && L2.bundledPo(W, d, n)) || n;
H.poInfo = (s, n) => {
  const d = s.d, W = s.W, g = L2.group(W, d, L2.poNum(n));
  const members = Object.keys(d.ports).filter(p => !d.ports[p].logical && d.ports[p].chan && d.ports[p].chan.group === L2.poNum(n)).sort(L2.portCmp).map(shortIf);
  const bundled = g ? g.bundled : []; const sp = bundled.length ? Math.min.apply(null, bundled.map(b => L2.speedOf(d, b))) : (members.length && /^Fa/.test(members[0]) ? 100 : 1000);
  return { members, bw: bundled.length * sp * 1000, speed: sp, fast: sp <= 100 };
};
H.poSpeed = (s, n) => String(H.poInfo(s, n).speed);
H.stpFwdList = (W, d, n, vl, active) => {
  const all = vl.filter(v => N.portAllows(d.ports[n], v)).sort((a, b) => a - b).filter(v => L2.stpState(W, d, n, v) !== 'BLK');
  return all.length ? I.vlanText(all) : 'none';
};

/* ------------------------------------------------------------------ show etherchannel summary */
const FLAGS = [
  'Flags:  D - down        P - bundled in port-channel', '        I - stand-alone s - suspended', '        H - Hot-standby (LACP only)', '        R - Layer3      S - Layer2',
  '        U - in use      f - failed to allocate aggregator', '', '        M - not in use, minimum links not met', '        u - unsuitable for bundling', '        w - waiting to be aggregated', '        d - default port', '', ''
];
def('UP', 'show etherchannel summary', 'One-line summary per channel-group', function (a, rest, o) {
  const d = this.d, W = this.W; this.env.obs('show:' + d.id + ':etherchannel-summary', true);   /* D-93 : la vérification de ces pannes est la lecture de l'état, pas un ping */ const st = L2.state(W).ec[d.id] || { groups: {} };
  const groups = Object.keys(st.groups).map(Number).sort((x, y) => x - y).filter(k => d.ports[st.groups[k].po]);
  FLAGS.forEach(t => o.l(t));
  o.l('Number of channel-groups in use: ' + groups.length); o.l('Number of aggregators:           ' + groups.length); o.l('');
  o.l('Group  Port-channel  Protocol    Ports'); o.l('------+-------------+-----------+-----------------------------------------------');
  groups.forEach(k => {
    const G = st.groups[k];
    const ports = G.members.slice().sort((x, y) => L2.portCmp(x.port, y.port)).map(m => pad(shortIf(m.port) + '(' + m.flag + ')', 12)).join('').replace(/\s+$/, '');
    o.l(pad(String(k), 7) + pad(G.po.replace('Port-channel', 'Po') + '(' + G.state + ')', 16) + pad(G.proto, 10) + ports);
  });
}, { sw: true });
/* « show etherchannel » seul : la sortie réelle n'a pas été relevée (consigne du 29/10, travail 6.4) — le simulateur ne l'invente pas (D-13) et ne répond pas « % Incomplete command. », qui affirmerait un comportement de l'IOS réel non relevé. */
def('UP', 'show etherchannel', 'EtherChannel information', function (a, rest, o, r) { o.l(U.av('ios-showec-bare', 'Commande réelle non gérée par le simulateur : show etherchannel (seule). Utilise le bouton « Aide-mémoire » de la fenêtre pour la liste des commandes disponibles.'), 'w'); o.l(''); }, { sw: true });
D('show etherchannel', 'EtherChannel information');

/* ------------------------------------------------------------------ show spanning-tree */
function stpBlock(s, v, o) {
  const d = s.d, W = s.W; const b = L2.bridge(W, d, v); if (!b) return false;
  const st = d.stp || {}; const proto = (st.mode === 'rapid-pvst') ? 'rstp' : 'ieee';
  const sysid = (p, vv) => String(p + vv);
  o.l(''); o.l('VLAN' + pad4(v)); o.l('  Spanning tree enabled protocol ' + proto);
  o.l('  Root ID    Priority    ' + sysid(b.rootPrio, v)); o.l('             Address     ' + L2.dottedMac(b.rootMac));
  if (b.isRoot) o.l('             This bridge is the root');
  else { const rp = b.ports.find(p => p.rep === b.rootPort); o.l('             Cost        ' + b.rootCost); o.l('             Port        ' + (rp ? rp.nbr : 0) + ' (' + b.rootPort + ')'); }
  o.l('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec'); o.l('');
  o.l('  Bridge ID  Priority    ' + sysid(b.prio, v) + '  (priority ' + b.prio + ' sys-id-ext ' + v + ')'); o.l('             Address     ' + L2.dottedMac(b.mac));
  o.l('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec'); o.l('             Aging Time  300 sec'); o.l('');
  o.l('Interface           Role Sts Cost      Prio.Nbr Type'); o.l('------------------- ---- --- --------- -------- --------------------------------');
  b.ports.slice().sort((x, y) => L2.portCmp(x.rep.replace(/^Port-channel/, 'ZZ'), y.rep.replace(/^Port-channel/, 'ZZ')) || 0).forEach(p => {
    o.l(pad(shortIf(p.rep), 20) + pad(p.role, 5) + pad(p.state, 4) + pad(String(p.cost), 10) + pad(p.pprio + '.' + p.nbr, 9) + p.type);
  });
  return true;
}
const pad4 = n => String(n).padStart(4, '0');
function stpShow(s, o, only) {
  const d = s.d, W = s.W; s.env.obs('show:' + d.id + ':spanning-tree', true);   /* D-93 : lecture de l'état de l'arbre */
  if ((d.stp && d.stp.mode) === 'mst') { o.l('% Multiple Spanning Tree is not simulated'); return; }
  const vl = only || L2.vlansOf(W, d);
  let any = false; vl.forEach(v => { if (stpBlock(s, v, o)) any = true; });
  if (!any) { if (only) o.l('Spanning tree instance(s) for vlan ' + only.join(',') + ' does not exist.'); else o.l('No spanning tree instance exists.'); }
  o.l('');
}
def('UP', 'show spanning-tree', 'Spanning tree topology', function (a, rest, o) { stpShow(this, o, null); }, { sw: true });
def('UP', 'show spanning-tree vlan <vlanlist>', 'VLAN Switch Spanning Trees', function (a, rest, o) { const l = I.vlanList(a[0]); if (!l) { INVALID(o); return; } stpShow(this, o, l); }, { sw: true });
def('UP', 'show spanning-tree blockedports', 'Blocked ports', function (a, rest, o) {
  const d = this.d, W = this.W; const rows = [];
  L2.vlansOf(W, d).forEach(v => { const b = L2.bridge(W, d, v); const bl = b.ports.filter(p => p.state === 'BLK').map(p => shortIf(p.rep)); if (bl.length) rows.push([v, bl]); });
  o.l('Name                 Blocked Interfaces List'); o.l('-------------------- ------------------------------------');
  let n = 0; rows.forEach(([v, bl]) => { o.l(pad('VLAN' + pad4(v), 21) + bl.join(', ')); n += bl.length; });
  o.l(''); o.l('Number of blocked ports (segments) in the system : ' + n);
}, { sw: true });
D('show spanning-tree', 'Spanning tree topology');

/* ------------------------------------------------------------------ messages EtherChannel / STP émis par le moteur → console */
const flush0 = I.IosShell.prototype.flushPend;
I.IosShell.prototype.flushPend = function (res) {
  const q = this.d._rt.l2Out;
  if (q && q.length) {
    q.forEach(m => { const ts = new Date(m.t); this.pend.push(L('*' + E.syslogTs(ts) + '.' + String(ts.getUTCMilliseconds()).padStart(3, '0') + ': ' + m.msg, 'o')); });
    this.d._rt.l2Out = [];
  }
  return flush0.call(this, res);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
