/* ============================================================================
   Monde simulé : appareils, câblage, horloge, journaux, observations, diff sémantique.
   Le monde ne contient AUCUN symptôme : tout symptôme est dérivé (net.js, win.js, …).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;

class World {
  constructor(spec) {
    this.dev = spec.dev;                       // id -> appareil
    this.walls = spec.walls || {};             // prises murales: "T-114" -> "SW2:FastEthernet0/2" | null
    this.meta = spec.meta || {};
    this.clock = { base: spec.baseTime || Date.UTC(2026, 9, 27, 7, 12, 0), elapsed: 0 };
    this.ver = 0;                              // incrémenté à chaque mutation d'état
    this.obs = [];                             // observations côté joueur {key, ok, t}
    this.listeners = [];
    this.actLog = [];                          // trace des actions {t, dev, kind, text}
    this.lastMutT = 0;
    for (const id of Object.keys(this.dev)) { this.dev[id].id = id; if (!this.dev[id]._rt) this.dev[id]._rt = {}; }
  }
  d(id) { const x = this.dev[id]; if (!x) throw new Error('Appareil inconnu: ' + id); return x; }
  /* ----- temps ----- */
  now() { return new Date(this.clock.base + this.clock.elapsed * 1000); }
  nowOf(devId) { const d = this.dev[devId]; const skew = d && d.clockSkewMin ? d.clockSkewMin * 60000 : 0; return new Date(this.clock.base + this.clock.elapsed * 1000 + skew); }
  tick(sec) { this.clock.elapsed += sec; }
  /* ----- notifications ----- */
  onChange(fn) { this.listeners.push(fn); }
  touch(why) { this.ver++; this.lastMutT = this.clock.elapsed; for (const f of this.listeners) { try { f(why); } catch (e) { console.error(e); } } }
  /* ----- observations (preuves de vérification côté joueur) ----- */
  observe(key, ok, meta) { this.obs.push({ key, ok: !!ok, t: this.clock.elapsed, ver: this.ver, meta }); }
  /* observation réussie dont la clé correspond au motif (joker *) et survenue à partir de la version d'état `sinceVer` */
  observedOk(pattern, sinceVer) { const re = pattern.indexOf('*') >= 0 ? U.globToRe(pattern) : null; return this.obs.some(o => o.ok && o.ver >= (sinceVer || 0) && (re ? re.test(o.key) : o.key === pattern)); }
  /* ----- journaux par appareil ----- */
  log(devId, chan, entry, ageSec) {
    const d = this.d(devId); d._rt.logs = d._rt.logs || {}; (d._rt.logs[chan] = d._rt.logs[chan] || []);
    const t = new Date(this.clock.base + (this.clock.elapsed - (ageSec || 0)) * 1000);
    d._rt.logs[chan].push(Object.assign({ t: t.getTime() }, entry));
  }
  logs(devId, chan) { const d = this.d(devId); return ((d._rt.logs || {})[chan] || []); }
  /* ----- trace des actions du joueur (débriefing) ----- */
  trace(entry) { this.actLog.push(Object.assign({ t: this.clock.elapsed }, entry)); }
  /* ----- mutations déclaratives ----- */
  setPath(path, val) { const i = path.indexOf('.'); const id = path.slice(0, i); U.pset(this.d(id), path.slice(i + 1), U.clone(val)); }
  getPath(path) { const i = path.indexOf('.'); return U.pget(this.d(path.slice(0, i)), path.slice(i + 1)); }
  delPath(path) { const i = path.indexOf('.'); return U.pdel(this.d(path.slice(0, i)), path.slice(i + 1)); }
  pushPath(path, item) { const arr = this.getPath(path); if (!Array.isArray(arr)) throw new Error('pushPath: pas un tableau ' + path); arr.push(U.clone(item)); }
  /* ----- projection sémantique ----- */
  sem() {
    const out = {};
    for (const k of Object.keys(this.walls)) out['walls/' + k] = this.walls[k];
    for (const id of Object.keys(this.dev)) {
      const d = this.dev[id];
      const proj = SIM.semProjectors && SIM.semProjectors[d.kind];
      if (proj) Object.assign(out, proj(d, id)); else {
        const c = {}; for (const k of Object.keys(d)) { if (k[0] === '_' || k === 'fs' || k === 'id') continue; c[k] = d[k]; }
        U.flat(c, id, out);
      }
    }
    return out;
  }
  snapshot() { return JSON.stringify({ dev: this.dev, walls: this.walls, clock: this.clock }); }
  /* ----- pairs réseau ----- */
  parsePort(s) { if (!s) return null; const i = s.indexOf(':'); return { dev: s.slice(0, i), port: s.slice(i + 1) }; }
}
SIM.World = World;

/* Constructeurs de clés de rendu des rôles : utilitaires partagés */
SIM.semProjectors = SIM.semProjectors || {};

})(typeof globalThis !== 'undefined' ? globalThis : window);
