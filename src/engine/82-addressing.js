/* ============================================================================
   Plan d'adressage « attendu » : tableau que fournirait un schéma réseau (IP, masque, passerelle, DNS, VLAN, mode),
   LU dans le monde sain (jamais écrit à la main) : il ne peut donc pas diverger du modèle. Aucune donnée de panne.
   SIM.plan(W) → { rows: [...], devices: [...] }. Chaque ligne :
     { dev, kind, iface, ip, mask, cidr, gw, dns:[], suffix, mode:'statique'|'DHCP'|'', vlan, mac, note }
   Poste en DHCP : l'adresse affichée est celle du bail du monde sain (mode « DHCP »).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const cidr = (ip, mask) => (ip && mask && U.validMask(mask)) ? ip + '/' + U.mask2len(mask) : '';
/* VLAN d'accès du port de commutateur auquel une carte est câblée (null si trunk, commutateur non administrable ou câble absent). */
const portVlan = (W, cable) => {
  if (!cable || !cable.to) return null;
  let to = cable.to; if (to.indexOf('wall:') === 0) to = (W.walls && W.walls[to.slice(5)]) || '';   /* prise murale → port du commutateur (brassage de la baie) */
  if (to.indexOf(':') < 0) return null;
  const i = to.indexOf(':'); const dev = W.dev[to.slice(0, i)]; const port = to.slice(i + 1);
  if (!dev || dev.kind !== 'ios-sw' || !dev.ports || !dev.ports[port] || dev.ports[port].mode !== 'access') return null;
  const id = dev.ports[port].vlan; const nm = dev.vlans && dev.vlans[id] && dev.vlans[id].name;
  return { id, label: String(id) + (nm ? ' (' + nm + ')' : '') };
};
const defRoute = d => { const r = (d.routes || []).find(x => x.net === '0.0.0.0' && x.mask === '0.0.0.0'); return r ? r.nh : null; };

SIM.plan = function (W) {
  const rows = []; const devices = [];
  const add = (d, o) => rows.push(Object.assign({ dev: d.id, kind: d.kind, iface: '', ip: '', mask: '', cidr: '', gw: '', dns: [], suffix: '', mode: '', vlan: '', mac: '', note: '' }, o, { cidr: cidr(o.ip, o.mask) }));
  for (const id of Object.keys(W.dev)) {
    const d = W.dev[id]; devices.push(id);
    if (d.kind === 'win' || d.kind === 'linux' || d.kind === 'printer') {
      for (const nm of Object.keys(d.ifaces || {})) {
        const f = d.ifaces[nm]; const l = f.dhcp ? f._lease : null; const v = portVlan(W, f.cable);
        add(d, { iface: nm, ip: f.dhcp ? (l ? l.ip : '') : f.ip, mask: f.dhcp ? (l ? l.mask : f.mask) : f.mask, gw: f.dhcp ? (l ? l.gw : '') : (f.gw || ''), dns: (f.dhcp ? (l ? l.dns : []) : f.dns) || [], suffix: f.suffix || (l && l.suffix) || '', mode: f.dhcp ? 'DHCP' : 'statique', vlan: v ? v.label : '', mac: f.mac || '',
          note: f.dhcp && l ? 'Bail attribué par ' + l.server : '' });
      }
    } else if (d.kind === 'pf') {
      const gw = (d.gateways || []).find(x => x.default); const dns = (d.dns && d.dns.servers) || [];
      for (const nm of Object.keys(d.ifaces || {})) {
        const f = d.ifaces[nm]; if (!f.ip) continue;
        add(d, { iface: nm + (f.name ? ' (' + f.name + ')' : ''), ip: f.ip, mask: f.mask, gw: nm === 'wan' && gw ? gw.ip : '', dns: nm === 'wan' ? dns : [], suffix: nm === 'wan' ? (d.domain || '') : '', mode: 'statique', vlan: '', mac: '',
          note: f.virtual ? 'Interface virtuelle' : (nm === 'lan' && (d.gateways || []).some(x => x.lanGw) ? 'Passerelle LAN : ' + d.gateways.find(x => x.lanGw).ip : '') });
      }
    } else if (d.kind === 'ios-rt') {
      const dr = defRoute(d); let first = true;
      for (const nm of Object.keys(d.ifaces || {})) {
        const f = d.ifaces[nm]; if (!f.ip) continue;
        add(d, { iface: nm, ip: f.ip, mask: f.mask, mode: 'statique', note: [f.desc || '', first && dr ? 'route par défaut via ' + dr : ''].filter(Boolean).join(' — ') }); first = false;
      }
    } else if (d.kind === 'ios-sw') {
      const dr = defRoute(d); let first = true;
      for (const nm of Object.keys(d.svi || {})) {
        const f = d.svi[nm]; if (!f.ip) continue;
        add(d, { iface: nm, ip: f.ip, mask: f.mask, mode: 'statique', vlan: nm.replace(/^Vlan/i, ''), note: [f.helpers && f.helpers.length ? 'ip helper-address ' + f.helpers.join(', ') : '', first && dr ? 'route par défaut via ' + dr : ''].filter(Boolean).join(' — ') }); first = false;
      }
      if (!Object.keys(d.svi || {}).some(k => d.svi[k].ip)) add(d, { note: 'Aucune adresse IP (commutateur de niveau 2)' });
    } else if (d.kind === 'sw-dumb') {
      add(d, { note: 'Commutateur non administrable : aucune adresse IP' });
    } else if (d.kind === 'isp') {
      for (const nm of Object.keys(d.ifaces || {})) { const f = d.ifaces[nm]; if (f.ip) add(d, { iface: nm, ip: f.ip, mask: f.mask, mode: 'statique' }); }
    }
  }
  return { rows, devices };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
