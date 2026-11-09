/* ============================================================================
   Couche 2 — agrégation de liens (EtherChannel : LACP, PAgP, mode « on ») et Spanning Tree (PVST+ / Rapid PVST+).
   Tout est DÉRIVÉ de la configuration et de l'état du câblage : aucun état figé par un scénario.

   Modèle de configuration (commutateurs ios-sw) :
     d.ports[p].chan  = { group:n, mode:'active'|'passive'|'on'|'desirable'|'auto' }      (port physique membre)
     d.ports['Port-channelN'] = { logical:true, mode, vlan, allowed, native, desc, adminDown }  (interface logique)
     d.stp = { mode:'pvst'|'rapid-pvst', prio:{ <vlan>: n }, off:[vlan] }                  (réglages globaux)
     d.ports[p].stp   = { portfast, bpduguard, cost, prio }                                 (réglages par port)

   Calcul :
     • EtherChannel : un port est « P » (bundled) s'il est actif, que le mode du voisin est compatible (LACP actif/passif,
       PAgP desirable/auto, « on » seul avec « on » — un port « on » s'agrège même sans partenaire) et que sa configuration
       est identique à celle de l'interface logique ; « I » (stand-alone) sinon ; « s » (suspended) en cas de
       configuration incohérente ; « D » (down) si le lien est coupé. L'interface logique est « SU » dès qu'un membre est « P ».
     • STP : une instance par VLAN ; élection de la racine par composante connexe (priorité + extension de VLAN, puis MAC),
       ports racine / désignés / alternatifs selon le coût cumulé, puis l'identifiant du pont émetteur et du port.
       Un commutateur dont STP est désactivé pour un VLAN relaie les BPDU comme un concentrateur ; une boucle dont aucun
       lien n'est bloqué entraîne une tempête de diffusion : plus aucune trame du VLAN ne traverse les commutateurs concernés.

   Écarts assumés (voir docs/LIMITES.md) : convergence instantanée (pas d'état listening / learning), pas de MST,
   pas de racine par VLAN en mode MST, pas de root guard / loop guard / UplinkFast, pas de MAC flapping simulé.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net;
const L2 = SIM.l2 = {};

U.av('l2-ec-show', 'Mise en page de « show etherchannel summary » (en-tête des drapeaux, colonnes Group / Port-channel / Protocol / Ports, « Number of aggregators ») : reconstituée de mémoire pour IOS 12.2 / 15.0, à comparer à une capture (C2).');
U.av('l2-ec-syslog', 'Messages %EC-5-BUNDLE, %EC-5-UNBUNDLE, %EC-5-CANNOT_BUNDLE2 et « Creating a port-channel interface Port-channel N » : formulation reconstituée de mémoire, à comparer à une capture (C6).');
U.av('l2-stp-show', 'Mise en page de « show spanning-tree » (Root ID / Bridge ID, colonnes Interface / Role / Sts / Cost / Prio.Nbr / Type, durée de vieillissement) : reconstituée de mémoire pour IOS 12.2 / 15.0, à comparer à une capture (C1).');
U.av('l2-stp-portid', 'Numéros de ports STP (Prio.Nbr) : Fa0/n = n, Gi0/n après les ports Fast Ethernet, Port-channel N = 64 + N — valeurs indicatives, à vérifier sur capture.');
U.av('l2-stp-pocost', 'Coût STP d’un Port-channel : coût du lien pour 1 membre, 3 pour 2 membres de 1 Gbit/s, 2 au-delà (méthode « short ») — valeurs indicatives, à vérifier sur capture.');
U.av('l2-stp-syslog', 'Message %SPANTREE-5-ROOTCHANGE (changement de racine) : formulation reconstituée de mémoire, à comparer à une capture.');

const PO_RE = /^Port-channel(\d+)$/;
L2.isPo = n => PO_RE.test(String(n));
L2.poName = g => 'Port-channel' + g;
L2.poNum = n => { const m = PO_RE.exec(String(n)); return m ? +m[1] : null; };
const isIosSw = d => !!d && d.kind === 'ios-sw';
const physPorts = d => Object.keys(d.ports || {}).filter(n => !d.ports[n].logical);
const typeRank = n => /^Fast/.test(n) ? 0 : /^Gigabit/.test(n) ? 1 : 2;
const numKey = n => String(n).replace(/^[A-Za-z-]+/, '').split(/[\/.]/).map(Number);
const portCmp = (a, b) => { const ra = typeRank(a), rb = typeRank(b); if (ra !== rb) return ra - rb; const x = numKey(a), y = numKey(b); for (let k = 0; k < Math.max(x.length, y.length); k++) if ((x[k] || 0) !== (y[k] || 0)) return (x[k] || 0) - (y[k] || 0); return 0; };
L2.portCmp = portCmp;

/* vitesse configurée / par défaut (Mbit/s) et duplex */
L2.speedOf = (d, n) => { const p = d.ports[n]; if (p && p.speed && p.speed !== 'auto') return +p.speed; return /^Fast/.test(n) ? 100 : 1000; };
L2.duplexOf = (d, n) => { const p = d.ports[n]; return p && p.duplex && p.duplex !== 'auto' ? p.duplex : 'full'; };

/* ------------------------------------------------------------------ EtherChannel */
const modesCompat = (a, b) => {
  if (a === 'on' || b === 'on') return a === 'on' && b === 'on';
  const lacp = m => m === 'active' || m === 'passive', pagp = m => m === 'desirable' || m === 'auto';
  if (lacp(a) && lacp(b)) return a === 'active' || b === 'active';
  if (pagp(a) && pagp(b)) return a === 'desirable' || b === 'desirable';
  return false;
};
L2.protoOf = mode => (mode === 'active' || mode === 'passive') ? 'LACP' : mode === 'on' ? '-' : 'PAgP';
L2.MODES = ['active', 'passive', 'on', 'desirable', 'auto'];

/* signature de configuration comparée entre les membres et l'interface logique */
const cfgSig = (p) => p.mode === 'trunk' ? 'trunk|' + (p.allowed === undefined ? 'all' : Array.isArray(p.allowed) ? p.allowed.slice().sort((a, b) => a - b).join(',') : p.allowed) + '|' + (p.native || 1) : 'access|' + (p.vlan || 1);
const cfgDiff = (a, b) => {
  if ((a.mode === 'trunk') !== (b.mode === 'trunk')) return 'trunk mode of {A} is ' + (a.mode === 'trunk' ? 'trunk' : 'access') + ', {B} is ' + (b.mode === 'trunk' ? 'trunk' : 'access');
  if (a.mode === 'trunk') { if (cfgSig(a) !== cfgSig(b)) return ((a.native || 1) !== (b.native || 1)) ? 'native vlan of {A} is ' + (a.native || 1) + ', {B} is ' + (b.native || 1) : 'allowed vlan list of {A} differs from {B}'; return ''; }
  return (a.vlan || 1) !== (b.vlan || 1) ? 'access vlan of {A} is ' + (a.vlan || 1) + ', {B} is ' + (b.vlan || 1) : '';
};

function computeEC(W) {
  const swIds = Object.keys(W.dev).filter(id => isIosSw(W.dev[id]) && Object.keys(W.dev[id].ports).some(n => W.dev[id].ports[n].chan));
  /* itérations : l'état d'un membre dépend de celui du port en face (un port suspendu côté voisin n'est pas agrégé) */
  let flags = {};
  const peerFlag = (id, pn) => { const pe = N.peerOf(W, W.dev[id], pn); if (!pe) return null; const x = flags[pe.dev] && flags[pe.dev].portInfo[pe.port]; return x ? x.flag : null; };
  for (let it = 0; it < 4; it++) {
    const next = {};
    for (const id of swIds) {
      const d = W.dev[id]; const groups = {}; const portInfo = {};
      for (const pn of physPorts(d).sort(portCmp)) { const p = d.ports[pn]; if (!p.chan) continue; (groups[p.chan.group] = groups[p.chan.group] || { group: p.chan.group, po: L2.poName(p.chan.group), members: [] }).members.push(pn); }
      for (const gk of Object.keys(groups)) {
        const G = groups[gk]; const po = d.ports[G.po]; G.poMissing = !po; G.proto = L2.protoOf(d.ports[G.members[0]].chan.mode);
        const info = G.members.map(pn => {
          const p = d.ports[pn]; const mode = p.chan.mode; const up = N.linkUp(W, d, pn); const pe = up ? N.peerOf(W, d, pn) : null; const peerD = pe && W.dev[pe.dev];
          const peerP = peerD && isIosSw(peerD) ? peerD.ports[pe.port] : null; const peerCh = peerP && peerP.chan;
          let flag, why = '';
          if (!up) flag = 'D';
          else if (!po) { flag = 'I'; why = 'no port-channel'; }
          else if (mode === 'on') flag = 'P';
          else if (!peerCh || !peerD.ports[L2.poName(peerCh.group)]) { flag = 'I'; why = peerCh ? 'partner has no port-channel' : 'no partner'; }
          else if (!modesCompat(mode, peerCh.mode)) { flag = 'I'; why = 'modes ' + mode + '/' + peerCh.mode; }
          else flag = 'P';
          return { port: pn, mode, flag, why, peerDev: pe && pe.dev, peerPort: pe && pe.port, peerGroup: peerCh && peerCh.group };
        });
        /* cohérence : même partenaire, même vitesse / duplex, même configuration que l'interface logique */
        const cand = info.filter(m => m.flag === 'P');
        const ref = cand[0];
        cand.forEach(m => {
          if (m !== ref && m.mode !== 'on' && ref.mode !== 'on' && (m.peerDev !== ref.peerDev || m.peerGroup !== ref.peerGroup)) { m.flag = 'I'; m.why = 'different partner'; return; }
          if (po) { const df = cfgDiff(d.ports[m.port], po); if (df) { m.flag = 's'; m.why = df.replace('{A}', I_short(m.port)).replace('{B}', G.po.replace('Port-channel', 'Po')); m.cant = 'po'; return; } }
          if (m !== ref) {
            if (L2.speedOf(d, m.port) !== L2.speedOf(d, ref.port)) { m.flag = 's'; m.why = 'speed of ' + I_short(m.port) + ' is ' + L2.speedOf(d, m.port) + 'M, ' + I_short(ref.port) + ' is ' + L2.speedOf(d, ref.port) + 'M'; m.cant = ref.port; }
            else if (L2.duplexOf(d, m.port) !== L2.duplexOf(d, ref.port)) { m.flag = 's'; m.why = 'duplex of ' + I_short(m.port) + ' is ' + L2.duplexOf(d, m.port) + ', ' + I_short(ref.port) + ' is ' + L2.duplexOf(d, ref.port); m.cant = ref.port; }
          }
        });
        /* le voisin doit lui aussi pouvoir agréger ce port (LACP / PAgP) */
        info.forEach(m => { if (m.flag === 'P' && m.mode !== 'on') { const pf = peerFlag(id, m.port); if (pf === 's' || pf === 'D') { m.flag = 'I'; m.why = 'partner suspended'; } } });
        G.members = info; G.bundled = info.filter(m => m.flag === 'P').map(m => m.port);
        G.state = (po && !po.adminDown && G.bundled.length) ? 'SU' : 'SD';
        if (G.state === 'SD') info.forEach(m => { if (m.flag === 'P') m.flag = 'I'; });
        info.forEach(m => { portInfo[m.port] = { group: +gk, flag: m.flag, why: m.why, po: G.po, bundled: m.flag === 'P', cant: m.cant }; });
      }
      next[id] = { groups, portInfo };
    }
    const same = JSON.stringify(Object.keys(next).map(k => [k, Object.keys(next[k].portInfo).map(p => next[k].portInfo[p].flag)])) === JSON.stringify(Object.keys(flags).filter(k => next[k]).map(k => [k, Object.keys(flags[k].portInfo).map(p => flags[k].portInfo[p].flag)]));
    flags = next; if (same) break;
  }
  return flags;
}
const I_short = n => String(n).replace(/^FastEthernet/, 'Fa').replace(/^GigabitEthernet/, 'Gi');

/* ------------------------------------------------------------------ STP */
const macHex = d => String(U.mac(d.id + ':base')).replace(/[^0-9a-f]/gi, '').toLowerCase();
const bridgePrio = (d, v) => { const s = d.stp || {}; const p = s.prio && s.prio[v]; return p === undefined ? 32768 : p; };
L2.bridgePrio = bridgePrio;
L2.stpOn = (d, v) => !(d.stp && d.stp.off && d.stp.off.indexOf(v) >= 0);
L2.stpMode = d => (d.stp && d.stp.mode) || 'pvst';
L2.portNbr = (d, rep) => {
  const po = L2.poNum(rep); if (po !== null) return 64 + po;
  const all = physPorts(d).sort(portCmp); return all.indexOf(rep) + 1;
};
L2.portCost = (W, d, rep, ec) => {
  const st = d.ports[rep] && d.ports[rep].stp; if (st && st.cost) return st.cost;
  const speed = n => { const s = L2.speedOf(d, n); const pe = N.peerOf(W, d, n); const pd = pe && W.dev[pe.dev]; const ps = pd && isIosSw(pd) && pd.ports[pe.port] ? L2.speedOf(pd, pe.port) : s; return Math.min(s, ps); };
  const byMbps = m => m >= 10000 ? 2 : m >= 1000 ? 4 : m >= 100 ? 19 : 100;
  if (L2.isPo(rep)) {
    const info = ec && ec[d.id]; const g = info && info.groups[L2.poNum(rep)]; const n = g ? g.bundled.length : 0;
    if (n <= 1) return byMbps(n ? speed(g.bundled[0]) : 1000);
    const m = speed(g.bundled[0]); return m >= 1000 ? (n === 2 ? 3 : 2) : (n === 2 ? 12 : 8);
  }
  return byMbps(speed(rep));
};

/* instances STP d'un VLAN : retourne { br:{devId:{...}}, storm:Set(devId) } */
function computeStp(W, v, ec) {
  const out = { br: {}, storm: new Set() };
  const parent = new Map(); const find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); let c = k; while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  const loopSegs = [];                                // segments où une boucle de relais (STP désactivé, concentrateur) se referme
  const union = (a, b, link) => { const x = find(a), y = find(b); if (x === y) { if (link) loopSegs.push(a); return; } parent.set(x, y); };
  const ids = Object.keys(W.dev);
  const bridges = []; const relayKeys = new Map();   // relais : appareils qui retransmettent les BPDU
  const repOf = (d, pn) => { const x = ec[d.id] && ec[d.id].portInfo[pn]; return x && x.bundled ? x.po : pn; };
  const inVlan = (d, pn) => {
    const p = d.ports[pn]; if (!p || p.logical) return false;
    if (!N.linkUp(W, d, pn)) return false;
    const x = ec[d.id] && ec[d.id].portInfo[pn]; if (x && (x.flag === 's')) return false;
    const e = x && x.bundled ? d.ports[x.po] : p;
    return e.mode === 'trunk' ? N.portAllows(e, v) : (e.vlan || 1) === v;
  };
  /* constitution des ponts et des relais */
  for (const id of ids) {
    const d = W.dev[id];
    if (d.kind === 'sw-dumb') { if (N.powered(d)) relayKeys.set(id, true); continue; }
    if (!isIosSw(d) || !N.powered(d) || !N.vlanActive(d, v)) continue;
    const ps = physPorts(d).filter(pn => inVlan(d, pn)); if (!ps.length) continue;
    if (!L2.stpOn(d, v)) { relayKeys.set(id, ps); continue; }
    const reps = []; ps.forEach(pn => { const r = repOf(d, pn); if (reps.indexOf(r) < 0) reps.push(r); });
    bridges.push({ d, id, reps, prio: bridgePrio(d, v), mac: macHex(d) });
  }
  const keyOf = (id, rep) => id + '|' + rep;
  /* liens physiques → segments */
  const seen = new Set();
  const linkPorts = (d, pn) => {
    if (seen.has(d.id + '|' + pn)) return; seen.add(d.id + '|' + pn);
    const pe = N.peerOf(W, d, pn); if (!pe) return; const pd = W.dev[pe.dev]; if (!pd) return;
    seen.add(pe.dev + '|' + pe.port);
    const a = isIosSw(d) && relayKeys.get(d.id) === undefined ? keyOf(d.id, repOf(d, pn)) : 'R|' + d.id;
    let b;
    if (pd.kind === 'sw-dumb') { if (!N.linkUp(W, pd, pe.port)) return; b = 'R|' + pd.id; }
    else if (isIosSw(pd)) {
      if (!N.linkUp(W, pd, pe.port) || !inVlan(pd, pe.port)) return;
      b = relayKeys.get(pd.id) !== undefined ? 'R|' + pd.id : keyOf(pd.id, repOf(pd, pe.port));
    } else return;                                   // poste, routeur, pare-feu : port d'extrémité
    union(a, b, (a.startsWith('R|') && b.startsWith('R|')));
  };
  for (const b of bridges) for (const pn of physPorts(b.d)) if (inVlan(b.d, pn)) linkPorts(b.d, pn);
  for (const id of ids) { const d = W.dev[id]; if (d.kind === 'sw-dumb') { if (!N.powered(d)) continue; for (const pn of Object.keys(d.ports)) if (N.linkUp(W, d, pn)) linkPorts(d, pn); } else if (isIosSw(d) && Array.isArray(relayKeys.get(id))) for (const pn of relayKeys.get(id)) linkPorts(d, pn); }
  /* ports de pont */
  const P = [];  // {b, rep, seg, cost, prio, nbr, members}
  bridges.forEach((b, bi) => b.reps.forEach(rep => {
    const members = physPorts(b.d).filter(pn => inVlan(b.d, pn) && repOf(b.d, pn) === rep);
    const st = (b.d.ports[rep] && b.d.ports[rep].stp) || {};
    const first = rep;
    P.push({ b: bi, rep, seg: find(keyOf(b.id, rep)), cost: L2.portCost(W, b.d, rep, ec), pprio: st.prio || 128, nbr: L2.portNbr(b.d, first), members });
  }));
  /* composantes de ponts */
  const bp = bridges.map((_, i) => i); const bf = i => { while (bp[i] !== i) { bp[i] = bp[bp[i]]; i = bp[i]; } return i; };
  const segBridge = new Map();
  P.forEach(p => { if (segBridge.has(p.seg)) { const a = bf(segBridge.get(p.seg)), c = bf(p.b); if (a !== c) bp[a] = c; } else segBridge.set(p.seg, p.b); });
  const bid = i => { const b = bridges[i]; return [b.prio + v, b.mac]; };
  const bidCmp = (x, y) => (x[0] - y[0]) || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0);
  const rootOf = {}; bridges.forEach((b, i) => { const c = bf(i); if (!(c in rootOf) || bidCmp(bid(i), bid(rootOf[c])) < 0) rootOf[c] = i; });
  const cost = bridges.map((b, i) => rootOf[bf(i)] === i ? 0 : Infinity);
  const pnKey = p => [p.pprio, p.nbr];
  const better = (A, B) => { for (let k = 0; k < A.length; k++) { const x = A[k], y = B[k]; if (Array.isArray(x)) { const c = x[0] !== y[0] ? x[0] - y[0] : (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); if (c) return c; } else if (x !== y) return x - y; } return 0; };
  let desig = new Map(); let rootPort = bridges.map(() => null);
  for (let round = 0; round < 60; round++) {
    desig = new Map();
    const bySeg = new Map(); P.forEach(p => { (bySeg.get(p.seg) || bySeg.set(p.seg, []).get(p.seg)).push(p); });
    bySeg.forEach((ps, seg) => {
      let best = null; ps.forEach(p => { if (cost[p.b] === Infinity) return; const key = [cost[p.b], bid(p.b), pnKey(p)]; if (!best || better(key, best.key) < 0) best = { p, key }; });
      if (best) desig.set(seg, best.p);
    });
    let changed = false; const newRoot = bridges.map(() => null);
    bridges.forEach((b, i) => {
      if (rootOf[bf(i)] === i) return;
      let best = null;
      P.filter(p => p.b === i).forEach(p => { const dp = desig.get(p.seg); if (!dp || dp.b === i) return; const key = [cost[dp.b] + p.cost, bid(dp.b), pnKey(dp), pnKey(p)]; if (cost[dp.b] === Infinity) return; if (!best || better(key, best.key) < 0) best = { p, key }; });
      if (best) { newRoot[i] = best.p; if (cost[i] !== best.key[0]) { cost[i] = best.key[0]; changed = true; } }
    });
    rootPort = newRoot;
    if (!changed) break;
  }
  /* rôles, états et résultat par pont */
  const segCount = new Map(); { const sb = new Map(); P.forEach(p => { (sb.get(p.seg) || sb.set(p.seg, new Set()).get(p.seg)).add(p.b); }); sb.forEach((set, seg) => segCount.set(seg, set.size)); }
  // nombre d'extrémités par segment : ports de ponts + extrémités (postes) rattachées à un pont
  const edgeCount = new Map();
  bridges.forEach(b => { for (const pn of physPorts(b.d)) { if (!inVlan(b.d, pn)) continue; const pe = N.peerOf(W, b.d, pn); const pd = pe && W.dev[pe.dev]; if (pd && !isIosSw(pd) && pd.kind !== 'sw-dumb') edgeCount.set(find(keyOf(b.id, repOf(b.d, pn))), 1); } });
  bridges.forEach((b, i) => {
    const root = bridges[rootOf[bf(i)]]; const isRoot = root === b;
    const ports = P.filter(p => p.b === i).map(p => {
      let role;
      const dp = desig.get(p.seg);
      if (rootPort[i] === p) role = 'Root';
      else if (dp === p) role = 'Desg';
      else if (dp && dp.b === i) role = 'Back';
      else role = 'Altn';
      const st = (b.d.ports[p.rep] && b.d.ports[p.rep].stp) || {};
      const shared = (segCount.get(p.seg) || 1) + (edgeCount.get(p.seg) || 0) > 2 || (relayKeys.size && ids.some(id => W.dev[id].kind === 'sw-dumb' && find('R|' + id) === p.seg));
      return { rep: p.rep, members: p.members, role, state: (role === 'Root' || role === 'Desg') ? 'FWD' : 'BLK', cost: p.cost, pprio: p.pprio, nbr: p.nbr, type: shared ? 'Shr' : 'P2p' + (st.portfast ? ' Edge' : ''), seg: p.seg };
    });
    out.br[b.id] = { id: b.id, prio: b.prio, mac: b.mac, isRoot, rootPrio: root.prio, rootMac: root.mac, rootCost: cost[i] === Infinity ? 0 : cost[i], rootPort: rootPort[i] ? rootPort[i].rep : null, ports };
  });
  /* tempête de diffusion : (1) un cycle dans la topologie active (ponts, segments, ports en transfert), (2) une boucle fermée par des relais
     (STP désactivé, concentrateur). La tempête touche tout le domaine de diffusion relié par des ports en transfert, pas les autres réseaux. */
  const vp2 = new Map(); const g2 = k => { if (!vp2.has(k)) vp2.set(k, k); let r = k; while (vp2.get(r) !== r) r = vp2.get(r); return r; };
  const closing = [];
  bridges.forEach(b => out.br[b.id].ports.forEach(p => { if (p.state !== 'FWD') return; const a = g2('B|' + b.id), c = g2('S|' + p.seg); if (a === c) closing.push('S|' + p.seg); else vp2.set(a, c); }));
  const stormRoots = new Set(closing.map(g2));
  loopSegs.forEach(k => stormRoots.add(g2('S|' + find(k))));
  if (stormRoots.size) {
    bridges.forEach(b => { if (stormRoots.has(g2('B|' + b.id))) out.storm.add(b.id); });
    relayKeys.forEach((val, id) => { if (stormRoots.has(g2('S|' + find('R|' + id)))) out.storm.add(id); });
  }
  return out;
}

/* ------------------------------------------------------------------ état en cache et journalisation */
function emit(W, devId, msg) {
  W.log(devId, 'syslog', { msg, sev: 5 });
  const d = W.dev[devId]; (d._rt.l2Out = d._rt.l2Out || []).push({ msg, t: W.nowOf(devId).getTime() });
}
L2.emit = emit;
const vlansIn = W => { const s = new Set(); Object.keys(W.dev).forEach(id => { const d = W.dev[id]; if (isIosSw(d)) Object.keys(d.vlans || {}).forEach(v => s.add(+v)); }); return Array.from(s).sort((a, b) => a - b); };
function build(W, prev) {
  const ec = computeEC(W);
  const stp = {}; vlansIn(W).forEach(v => { stp[v] = computeStp(W, v, ec); });
  return { ver: W.ver, ec, stp };
}
function diffAndLog(W, prev, next) {
  /* EtherChannel : adhésion / sortie d'un port, état de l'interface logique */
  for (const id of U.uniq(Object.keys(next.ec).concat(Object.keys(prev.ec)))) {
    const a = next.ec[id] || { groups: {}, portInfo: {} }, b = prev.ec[id] || { groups: {}, portInfo: {} };
    for (const pn of Object.keys(a.portInfo)) {
      const x = a.portInfo[pn], y = b.portInfo[pn] || { flag: 'D' };
      if (x.flag === y.flag) continue;
      const po = x.po.replace('Port-channel', 'Po');
      if (x.flag === 'P') emit(W, id, '%EC-5-BUNDLE: Interface ' + I_short(pn) + ' joined port-channel ' + po);
      else if (y.flag === 'P') emit(W, id, '%EC-5-UNBUNDLE: Interface ' + I_short(pn) + ' left the port-channel ' + po);
      if (x.flag === 's' && x.cant) emit(W, id, '%EC-5-CANNOT_BUNDLE2: ' + I_short(pn) + ' is not compatible with ' + (x.cant === 'po' ? po : I_short(x.cant)) + ' and will be suspended (' + x.why + ')');
    }
    /* ports sortis de tout groupe (« no channel-group ») et groupes vidés */
    for (const pn of Object.keys(b.portInfo)) {
      if (a.portInfo[pn]) continue; const y = b.portInfo[pn];
      if (y.flag === 'P') emit(W, id, '%EC-5-UNBUNDLE: Interface ' + I_short(pn) + ' left the port-channel ' + y.po.replace('Port-channel', 'Po'));
    }
    for (const gk of Object.keys(b.groups || {})) {
      if (a.groups[gk]) continue; const y = b.groups[gk];
      if (y.state === 'SU') { emit(W, id, '%LINK-3-UPDOWN: Interface ' + y.po + ', changed state to down'); emit(W, id, '%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + y.po + ', changed state to down'); }
    }
    for (const gk of Object.keys(a.groups)) {
      const x = a.groups[gk], y = (b.groups || {})[gk];
      if ((y && x.state !== y.state) || (!y && x.state === 'SU')) {
        const up = x.state === 'SU';
        emit(W, id, '%LINK-3-UPDOWN: Interface ' + x.po + ', changed state to ' + (up ? 'up' : 'down'));
        emit(W, id, '%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + x.po + ', changed state to ' + (up ? 'up' : 'down'));
      }
    }
  }
  /* STP : changement de racine vu par un commutateur */
  for (const v of Object.keys(next.stp)) {
    const A = next.stp[v].br, B = (prev.stp[v] || { br: {} }).br;
    for (const id of Object.keys(A)) {
      const x = A[id], y = B[id]; if (!y) continue;
      if (x.rootMac !== y.rootMac || x.rootPrio !== y.rootPrio || x.rootPort !== y.rootPort) {
        if (!x.rootPort) continue;                     // le commutateur devient racine : pas de message « New Root Port »
        emit(W, id, '%SPANTREE-5-ROOTCHANGE: Root Changed for vlan ' + v + ': New Root Port is ' + (x.rootPort || 'none') + '. New Root Mac Address is ' + dottedMac(x.rootMac) + '.');
      }
    }
  }
}
const dottedMac = h => h.slice(0, 4) + '.' + h.slice(4, 8) + '.' + h.slice(8, 12);
L2.dottedMac = dottedMac;
L2.state = function (W) {
  if (W._l2 && W._l2.ver === W.ver) return W._l2;
  if (W._l2Busy) return W._l2 || { ver: -1, ec: {}, stp: {} };
  W._l2Busy = true;
  try {
    const prev = W._l2; const st = build(W, prev);
    if (prev) diffAndLog(W, prev, st);
    W._l2 = st; return st;
  } finally { W._l2Busy = false; }
};
const hasL2 = W => Object.keys(W.dev).some(id => isIosSw(W.dev[id]) && (W.dev[id].stp || Object.keys(W.dev[id].ports).some(n => W.dev[id].ports[n].chan || W.dev[id].ports[n].logical)));
L2.attach = function (W) {
  if (W._l2Attached) return; W._l2Attached = true;
  if (hasL2(W)) L2.state(W);
  W.onChange(() => { if (hasL2(W)) L2.state(W); });
};

/* ------------------------------------------------------------------ interrogation par le moteur réseau et l'émulateur */
L2.ecInfo = (W, d, port) => { const s = L2.state(W).ec[d.id]; return s && s.portInfo[port] || null; };
L2.group = (W, d, g) => { const s = L2.state(W).ec[d.id]; return s && s.groups[g] || null; };
L2.bundledPo = (W, d, port) => { const x = L2.ecInfo(W, d, port); return x && x.bundled ? x.po : null; };
L2.suspended = (W, d, port) => { const x = L2.ecInfo(W, d, port); return !!x && x.flag === 's'; };
L2.poUp = (W, d, name) => { const g = L2.group(W, d, L2.poNum(name)); return !!g && g.state === 'SU'; };
/* configuration effective d'un port (celle de l'interface logique pour un membre agrégé) */
L2.eff = (W, d, port) => { const po = L2.bundledPo(W, d, port); return po ? d.ports[po] : d.ports[port]; };
/* état STP d'un port pour un VLAN : 'FWD' | 'BLK' | null (le port ne participe pas) */
L2.stpState = (W, d, port, v) => {
  const s = L2.state(W).stp[v]; const b = s && s.br[d.id]; if (!b) return null;
  const rep = L2.bundledPo(W, d, port) || port; const p = b.ports.find(x => x.rep === rep); return p ? p.state : null;
};
L2.fwd = (W, d, port, v) => { if (!isIosSw(d)) return true; return L2.stpState(W, d, port, v) !== 'BLK'; };
L2.storm = (W, d, v) => { const s = L2.state(W).stp[v]; return !!s && s.storm.has(d.id); };
L2.bridge = (W, d, v) => { const s = L2.state(W).stp[v]; return s && s.br[d.id] || null; };
L2.vlansOf = (W, d) => Object.keys(L2.state(W).stp).map(Number).filter(v => L2.bridge(W, d, v)).sort((a, b) => a - b);
})(typeof globalThis !== 'undefined' ? globalThis : window);
