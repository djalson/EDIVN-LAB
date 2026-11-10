/* ============================================================================
   Carte des sites : un onglet par site (Toulouse, Bordeaux, Ramonville, Labège, Colomiers, extérieur). Topologie
   NOMINALE (documentation du réseau) : la carte ne montre aucun état en direct — une liaison
   coupée, un équipement éteint ou un service arrêté ne s'y voient pas, comme sur un schéma papier.
   Un clic sur un équipement ouvre son écran / sa console ; « Poste physique » donne accès au
   câblage et à l'alimentation.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h;

/* sites : zones, noeuds (id, x, y, type, libellé secondaire) et liaisons nominales */
const SITES = {
  toulouse: {
    label: 'Toulouse', w: 1180, h: 650,
    zones: [{ x: 30, y: 10, w: 640, h: 120, t: 'Périmètre' }, { x: 30, y: 250, w: 580, h: 130, t: 'Salle serveurs' }, { x: 640, y: 250, w: 450, h: 130, t: 'Étage — commutateurs d’accès' }, { x: 520, y: 420, w: 640, h: 200, t: 'Bureaux' }, { x: 700, y: 10, w: 390, h: 120, t: 'DMZ' }],
    nodes: [
      ['ISP', 60, 30, 'cloud', 'Internet (FAI)'], ['pfsense-tls', 360, 30, 'firewall', 'Pare-feu pfSense'],
      ['SW-DMZ', 740, 30, 'switch', 'Commutateur DMZ'], ['SRV-WEB', 940, 30, 'linux', 'Serveur web (DMZ)'],
      ['SW-T1', 360, 170, 'switch', 'Cœur de réseau (L3)'],
      ['SRV-DC1', 70, 275, 'server', 'Contrôleur de domaine'], ['SRV-FIC', 230, 275, 'server', 'Serveur de fichiers / web'], ['SRV-LNX', 400, 275, 'linux', 'Serveur Debian'],
      ['SW-T2', 690, 275, 'switch', 'Étage 1'], ['SW-T3', 930, 275, 'switch', 'Étage 2'],
      ['PC-ADM', 550, 460, 'pc', 'Administration'], ['PATCH-T', 690, 460, 'patch', 'Prises murales / baie'], ['PC-01', 810, 460, 'pc', 'Poste T-114'], ['PC-02', 930, 460, 'pc', 'Poste RH'], ['IMP-T1', 1040, 460, 'printer', 'Imprimante']
    ],
    links: [['ISP', 'pfsense-tls'], ['pfsense-tls', 'SW-DMZ'], ['SW-DMZ', 'SRV-WEB'], ['pfsense-tls', 'SW-T1'], ['SW-T1', 'SRV-DC1'], ['SW-T1', 'SRV-FIC'], ['SW-T1', 'SRV-LNX'], ['SW-T1', 'SW-T2'], ['SW-T2', 'SW-T3'], ['SW-T2', 'PATCH-T'], ['PATCH-T', 'PC-01'], ['SW-T2', 'PC-ADM'], ['SW-T3', 'PC-02'], ['SW-T3', 'IMP-T1']]
  },
  bordeaux: {
    label: 'Bordeaux', w: 900, h: 560,
    zones: [{ x: 20, y: 10, w: 840, h: 520, t: 'Site de Bordeaux' }],
    nodes: [['ISP', 100, 40, 'cloud', 'Internet (FAI)'], ['pfsense-bdx', 330, 40, 'firewall', 'Pare-feu pfSense'], ['R-B1', 330, 190, 'router', 'Routeur (ROAS)'], ['SW-B1', 330, 330, 'switch', 'Commutateur'], ['SRV-DC2', 160, 450, 'server', 'Contrôleur de domaine'], ['PC-B1', 500, 450, 'pc', 'Poste utilisateur']],
    links: [['ISP', 'pfsense-bdx'], ['pfsense-bdx', 'R-B1'], ['R-B1', 'SW-B1'], ['SW-B1', 'SRV-DC2'], ['SW-B1', 'PC-B1']]
  },
  ramonville: {
    label: 'Ramonville', w: 900, h: 560,
    zones: [{ x: 20, y: 10, w: 840, h: 520, t: 'Site de Ramonville (domaine ramonville.lan)' }],
    nodes: [['ISP', 100, 40, 'cloud', 'Internet (FAI)'], ['R-RV1', 330, 100, 'router', 'Routeur / pare-feu'], ['SW-RVA', 150, 270, 'switch', 'Commutateur A'], ['SW-RVB', 400, 270, 'switch', 'Commutateur B'], ['SRV-RV', 650, 270, 'linux', 'Serveur Debian'], ['PC-RV1', 150, 430, 'pc', 'Poste'], ['PC-RV2', 400, 430, 'pc', 'Poste']],
    links: [['ISP', 'R-RV1'], ['R-RV1', 'SW-RVA'], ['R-RV1', 'SW-RVB'], ['R-RV1', 'SRV-RV'], ['SW-RVA', 'PC-RV1'], ['SW-RVB', 'PC-RV2']]
  },
  labege: {
    label: 'Labège', w: 900, h: 560,
    zones: [{ x: 20, y: 10, w: 840, h: 520, t: 'Site de Labège (maquette OSPF : zone 0 + zone 1, domaine labege.lan)' }],
    nodes: [['ISP', 60, 40, 'cloud', 'Internet (FAI)'], ['R-LB1', 300, 40, 'router', 'Bordure (NAT)'], ['R-LB2', 620, 120, 'router', 'Routeur bureaux'], ['R-LB3', 560, 280, 'router', 'Routeur'], ['R-LB4', 300, 330, 'router', 'Routeur atelier'], ['R-LB5', 60, 230, 'router', 'Routeur'], ['PC-LB2', 740, 260, 'pc', 'Poste bureau'], ['PC-LB4', 300, 440, 'pc', 'Poste atelier'], ['R-LB6', 680, 390, 'router', 'Routeur zone 1'], ['PC-LB6', 760, 470, 'pc', 'Poste annexe']],
    links: [['ISP', 'R-LB1'], ['R-LB1', 'R-LB2'], ['R-LB2', 'R-LB3'], ['R-LB3', 'R-LB4'], ['R-LB4', 'R-LB5'], ['R-LB5', 'R-LB1'], ['R-LB2', 'PC-LB2'], ['R-LB4', 'PC-LB4'], ['R-LB3', 'R-LB6'], ['R-LB6', 'PC-LB6']]
  },
  colomiers: {
    label: 'Colomiers', w: 900, h: 560,
    zones: [{ x: 20, y: 10, w: 840, h: 520, t: 'Site de Colomiers (maquette EtherChannel / Spanning Tree : cœur SW-CA, Port-channel 1 vers SW-CB)' }],
    nodes: [['SW-CA', 330, 80, 'switch', 'Cœur (racine STP)'], ['SW-CB', 150, 270, 'switch', 'Commutateur B (Po1 vers SW-CA)'], ['SW-CC', 560, 270, 'switch', 'Commutateur C (Fa0/23 vers SW-CA)'], ['PC-C1', 60, 430, 'pc', 'Bureau (VLAN 10)'], ['PC-C3', 250, 430, 'pc', 'Atelier (VLAN 20)'], ['PC-C2', 470, 430, 'pc', 'Bureau (VLAN 10)'], ['PC-C4', 660, 430, 'pc', 'Atelier (VLAN 20)']],
    links: [['SW-CA', 'SW-CB'], ['SW-CA', 'SW-CC'], ['SW-CB', 'PC-C1'], ['SW-CB', 'PC-C3'], ['SW-CC', 'PC-C2'], ['SW-CC', 'PC-C4']]
  },
  exterieur: {
    label: 'Extérieur', w: 700, h: 420,
    zones: [{ x: 20, y: 10, w: 640, h: 380, t: 'Hors site' }],
    nodes: [['ISP', 150, 90, 'cloud', 'Internet (FAI)'], ['PCEXT', 400, 200, 'pc', 'Poste nomade (domicile)']],
    links: [['ISP', 'PCEXT']]
  }
};
UI.SITES = SITES;
const TYPE_ICON = { cloud: 'cloud', firewall: 'firewall', switch: 'switch', router: 'router', server: 'server', linux: 'linux', pc: 'pc', printer: 'printer', patch: 'patch' };

function MapView(run, onOpen) {
  this.run = run; this.onOpen = onOpen; this.el = h('div.mapwrap');
  this.views = {};
}
UI.MapView = MapView;
MapView.prototype.siteView = function (id) {
  if (this.views[id]) return this.views[id];
  const S = SITES[id]; const run = this.run; const self = this;
  const map = h('div.map'); const inner = h('div.mapin');
  const pos = {};
  /* campagne : seuls les équipements du périmètre sont dessinés ; une zone vide n'est pas tracée */
  const scope = run.scope ? run.scope.devs : null; const vis = nid => !scope || scope.indexOf(nid) >= 0;
  const inZone = z => S.nodes.some(([nid, x, y]) => vis(nid) && x + 56 >= z.x && x + 56 <= z.x + z.w && y + 26 >= z.y && y + 26 <= z.y + z.h);
  /* cadrage : en campagne la carte se resserre sur ce qui est visible (ox, oy : décalage ; MW, MH : taille utile) */
  let ox = 0, oy = 0, MW = S.w, MH = S.h;
  if (scope) {
    const zs = S.zones.filter(inZone), ns = S.nodes.filter(n => vis(n[0])); const pad = 30;
    const x0 = Math.min.apply(null, zs.map(z => z.x).concat(ns.map(n => n[1]))), y0 = Math.min.apply(null, zs.map(z => z.y).concat(ns.map(n => n[2])));
    const x1 = Math.max.apply(null, zs.map(z => z.x + z.w).concat(ns.map(n => n[1] + 130))), y1 = Math.max.apply(null, zs.map(z => z.y + z.h).concat(ns.map(n => n[2] + 90)));
    if (isFinite(x0) && isFinite(y0)) { ox = x0 - pad; oy = y0 - pad; MW = Math.max(520, x1 - x0 + 2 * pad); MH = Math.max(300, y1 - y0 + 2 * pad); }
  }
  /* contrat « Sans plan » : plus de topologie, une simple liste d'équipements rangés par nom */
  const flat = !!(UI.rewards && UI.rewards.has(run.m, 'nomap')); const flatPos = {};
  if (flat) { const ns = S.nodes.filter(n => vis(n[0])).map(n => n[0]).sort(); ns.forEach((id, i) => { flatPos[id] = [30 + (i % 5) * 150, 30 + Math.floor(i / 5) * 110]; }); ox = 0; oy = 0; MW = 800; MH = Math.max(300, 60 + Math.ceil(ns.length / 5) * 110); }
  inner.style.width = MW + 'px'; inner.style.height = MH + 'px';
  S.zones.filter(z => !flat && (!scope || inZone(z))).forEach(z => inner.append(h('div.zone', { style: { left: (z.x - ox) + 'px', top: (z.y - oy) + 'px', width: z.w + 'px', height: z.h + 'px' } }, z.t)));
  const svgNS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'links'); svg.setAttribute('width', MW); svg.setAttribute('height', MH);
  inner.append(svg);
  S.nodes.filter(n => vis(n[0])).forEach(([nid, x, y, type, sub]) => {
    if (flat) { x = flatPos[nid][0]; y = flatPos[nid][1]; if (type !== 'patch') sub = ''; } else { x -= ox; y -= oy; } pos[nid] = { x: x + 56, y: y + 26 };
    const dev = run.W.dev[nid];
    const label = type === 'patch' ? 'Baie de brassage' : nid;
    const ic = h('div.ic', UI.icon(TYPE_ICON[type], 36));
    const n = h('div.node', { style: { left: x + 'px', top: y + 'px' }, title: label, on: { click: ev => { ev.stopPropagation(); self.popup(nid, type, n, inner, sub); } } }, ic, h('div.nm', label), h('div.sub', sub));
    inner.append(n);
  });
  const lines = [];
  S.links.filter(([a, b]) => !flat && pos[a] && pos[b]).forEach(([a, b]) => {
    const l = document.createElementNS(svgNS, 'line'); l.setAttribute('x1', pos[a].x); l.setAttribute('y1', pos[a].y); l.setAttribute('x2', pos[b].x); l.setAttribute('y2', pos[b].y);
    l.setAttribute('stroke', '#4a6286'); l.setAttribute('stroke-width', '2'); svg.append(l); lines.push({ a, b, el: l });
  });
  /* outil « voyants de liaison » : liens colorés selon l'état réel, repeints à chaque action */
  this._lines = lines; if (UI.rewards) { UI.rewards.paintLinks(run, lines); if (!this._ledHook) { this._ledHook = true; run.on('act', () => { if (self._lines) UI.rewards.paintLinks(run, self._lines); }); } }
  if (flat) map.append(h('div.mapscope', 'Contrat « Sans plan » : la topologie n’est pas affichée.'));
  map.append(inner); map.addEventListener('click', () => this.closePop());
  if (scope) { const hidden = S.nodes.filter(n => !vis(n[0])).length; if (hidden) map.append(h('div.mapscope', UI.icon('network', 14), ' Chapitre ' + run.scope.n + ' : tu vois ton périmètre d’intervention. Le reste de l’infrastructure se dévoile au fil de la campagne.')); }
  /* mise à l'échelle : la carte tient toujours dans la zone visible (jamais de nœud rogné) */
  const fit = () => { const w = map.clientWidth, hh = map.clientHeight; if (!w || !hh) return; const k = Math.min(1, w / MW, hh / MH); inner.style.transformOrigin = '0 0'; inner.style.transform = k < 1 ? 'scale(' + k + ')' : ''; if (scope) { inner.style.marginLeft = Math.max(0, Math.round((w - MW * k) / 2)) + 'px'; inner.style.marginTop = Math.max(0, Math.round(Math.min(60, (hh - MH * k) / 3))) + 'px'; } };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(map); setTimeout(fit, 0);
  this.views[id] = map; return map;
};
MapView.prototype.closePop = function () { if (this.pop) { this.pop.remove(); this.pop = null; } };
MapView.prototype.popup = function (nid, type, nodeEl, inner, sub) {
  this.closePop(); const run = this.run; const self = this;
  const btn = (label, fn, icon) => h('button.btn', { on: { click: () => { self.closePop(); fn(); } } }, label);
  const items = [];
  const dev = run.W.dev[nid];
  if (type === 'patch') items.push(btn('Ouvrir la baie de brassage', () => self.onOpen(nid, 'patch')));
  else if (nid === 'ISP') items.push(h('div.muted', 'Réseau de l’opérateur : hors périmètre d’intervention.'));
  else if (dev && dev.kind === 'win') { items.push(btn(dev.win.server || /Server/i.test(dev.os || '') ? 'Ouvrir la session (écran du serveur)' : 'Utiliser le poste (écran)', () => self.onOpen(nid, 'main'))); items.push(btn('Poste physique (arrière, câbles, alimentation)', () => self.onOpen(nid, 'rig'))); }
  else if (dev && dev.kind === 'linux') { items.push(btn('Console (écran / clavier)', () => self.onOpen(nid, 'main'))); items.push(btn('Alimentation et câblage', () => self.onOpen(nid, 'rig'))); }
  else if (dev && (dev.kind === 'ios-sw' || dev.kind === 'ios-rt')) { items.push(btn('Brancher le câble console', () => self.onOpen(nid, 'main'))); items.push(btn('Voyants, câbles et alimentation', () => self.onOpen(nid, 'rig'))); }
  else if (dev && dev.kind === 'pf') { items.push(btn('Console de la VM (menu pfSense)', () => self.onOpen(nid, 'main'))); items.push(btn('Alimentation et câblage', () => self.onOpen(nid, 'rig'))); }
  else if (dev && dev.kind === 'printer') { items.push(btn('Panneau de commande', () => self.onOpen(nid, 'main'))); items.push(btn('Alimentation et câblage', () => self.onOpen(nid, 'rig'))); }
  else items.push(btn('Voyants, câbles et alimentation', () => self.onOpen(nid, 'rig')));
  if (UI.rewards) UI.rewards.popupItems(run, nid, btn).forEach(x => items.push(x));
  const pop = h('div.pop', { on: { click: e => e.stopPropagation() } }, h('h4', type === 'patch' ? 'Baie de brassage' : nid), h('div.muted', { style: { marginBottom: '6px' } }, sub), items);
  const left = parseInt(nodeEl.style.left, 10) + 120, top = parseInt(nodeEl.style.top, 10);
  pop.style.left = Math.min(left, parseInt(inner.style.width, 10) - 260) + 'px'; pop.style.top = top + 'px';
  inner.append(pop); this.pop = pop;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
