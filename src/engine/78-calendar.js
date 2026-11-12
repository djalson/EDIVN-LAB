/* ============================================================================
   Calendrier du jeu : la date et l'heure d'un ticket ne sont plus figées au mardi 27/10/2026 à 07:12.
   - Chaque ticket joué fait avancer d'un jour ouvré (jamais le week-end) ; l'heure est tirée par la graine dans la journée de travail
     (08:00 – 17:30), ou en pleine nuit pour un incident d'astreinte.
   - Le monde est construit à sa date d'origine puis décalé d'un nombre entier de jours : toutes ses dates (journaux, fichiers, certificats,
     sauvegardes, baux) suivent, et les dates écrites dans la panne (compte expiré le…, certificat expiré le…) aussi.
   Sans calendrier (tests du moteur, mode d'origine), rien ne change : mardi 27/10/2026 07:12.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const CAL = SIM.calendar = {}; const DAY = 86400000;
CAL.BASE = Date.UTC(2026, 9, 27, 7, 12, 0); const BASE_DAY = Date.UTC(2026, 9, 27);
/* n-ième jour ouvré après la date d'origine → décalage en jours calendaires */
CAL.businessDays = function (n) { let d = 0, left = Math.max(0, n | 0); while (left > 0) { d++; const wd = new Date(BASE_DAY + d * DAY).getUTCDay(); if (wd !== 0 && wd !== 6) left--; } return d; };
/* { days, sec } : jour (décalage calendaire) et heure (secondes depuis minuit). night : l'incident tombe la nuit suivante. */
CAL.make = function (n, seed, o) {
  o = o || {}; const rng = U.rng('calendar|' + seed); const days = CAL.businessDays(n);
  const sec = o.night ? (1 * 3600 + rng.int(3 * 3600 + 1800)) : (8 * 3600 + rng.int(9 * 3600 + 1800));
  return { days, sec: Math.floor(sec / 60) * 60, night: !!o.night };
};
const ISO = /\b(20\d\d)-(\d\d)-(\d\d)\b/g;
const shiftIso = (s, days) => s.replace(ISO, (m, y, mo, d) => { const t = Date.UTC(+y, +mo - 1, +d) + days * DAY; if (isNaN(t)) return m; const x = new Date(t); return x.getUTCFullYear() + '-' + U.pad2(x.getUTCMonth() + 1) + '-' + U.pad2(x.getUTCDate()); });
const isTs = v => typeof v === 'number' && v > 1.70e12 && v < 1.90e12;
function walk(o, days, seen) {
  if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
  if (o instanceof Date) { o.setTime(o.getTime() + days * DAY); return; }
  if (o instanceof Map) { const ent = [...o.entries()]; o.clear(); ent.forEach(([k, v]) => { if (typeof v === 'string') v = shiftIso(v, days); else if (isTs(v)) v += days * DAY; else walk(v, days, seen); o.set(typeof k === 'string' ? shiftIso(k, days) : k, v); }); return; }
  if (o instanceof Set) { o.forEach(v => walk(v, days, seen)); return; }
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (typeof v === 'string') o[i] = shiftIso(v, days); else if (isTs(v)) o[i] = v + days * DAY; else walk(v, days, seen); } return; }
  for (const k of Object.keys(o)) {
    let v = o[k]; if (typeof v === 'function') continue;
    if (typeof v === 'string') v = shiftIso(v, days); else if (isTs(v)) v = v + days * DAY; else walk(v, days, seen);
    const nk = shiftIso(k, days); if (nk !== k) { delete o[k]; o[nk] = v; } else o[k] = v;
  }
}
CAL.shift = function (obj, days) { if (days) walk(obj, days, new Set()); return obj; };
/* applique le calendrier à un monde sain fraîchement construit */
CAL.apply = function (W, cal) {
  if (!cal) return W; const days = cal.days | 0;
  if (days) { const clock = W.clock, listeners = W.listeners; W.clock = null; W.listeners = null; CAL.shift(W, days); W.clock = clock; W.listeners = listeners; }
  W.clock.base = BASE_DAY + (days + (cal.night ? 1 : 0)) * DAY + (cal.sec | 0) * 1000;
  W.calendar = { days, sec: cal.sec | 0, night: !!cal.night };
  return W;
};
/* dates écrites dans une panne instanciée (injection, corrections, racines, textes) + jour de la semaine des restrictions d'horaires */
CAL.shiftFault = function (inst, W) {
  const days = (W.calendar && W.calendar.days) || 0; const wd = W.now().getUTCDay();
  const parts = inst.bundle ? inst.parts : [inst];
  parts.forEach(p => {
    if (days) { const def = p.def, rt = p.rt, vars = p.vars; p.def = null; p.rt = null; p.vars = null; CAL.shift(p, days); p.def = def; p.rt = rt; p.vars = vars; }
    /* « heures de connexion interdites aujourd'hui » : le jour interdit est le jour du ticket */
    if (W.calendar) (p.inject || []).forEach(st => { const v = st && st.value; if (v && Array.isArray(v.deny)) v.deny.forEach(x => { if (typeof x.day === 'number') x.day = wd; }); });
  });
  if (inst.bundle && days) { ['cause', 'solution'].forEach(k => { if (typeof inst[k] === 'string') inst[k] = shiftIso(inst[k], days); }); }
  return inst;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
