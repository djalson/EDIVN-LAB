/* ============================================================================
   Récompenses de niveau : ce que chaque palier d'expérience débloque. Aucune dépendance au DOM (tests/rewards.js).

   L'arbre de compétences (81-progress.js) s'achète avec des points et se vide vers le niveau 18. Cette piste, elle,
   donne quelque chose à CHAQUE palier jusqu'au niveau 40, sans rien acheter :
     - contrats   : contraintes choisies avant un ticket, qui multiplient l'XP (jamais la note) ;
     - outils     : aides de diagnostic (voyants de liaison, ping rapide, historique des commandes) ;
     - astreinte  : incidents à 2, 3 puis 4 pannes ;
     - second avis: un indice gratuit par jour ;
     - cosmétiques: fonds d'écran des postes, couleurs de terminal, habillages de carte, thèmes de prestige ;
     - insignes   : liés aux chapitres de campagne terminés (pas au niveau) ;
     - prestige   : au niveau 40, repartir du niveau 1 en gardant tout.

   Équité : les outils et le second avis sont coupés en évaluation chronométrée et en examen de chapitre (`toolOn`),
   comme le coffre-fort. Les contrats ne touchent que l'XP. Les notes restent comparables d'un joueur à l'autre.
   Rien n'est stocké qui puisse se déduire : une récompense est acquise si le niveau (ou le prestige) le dit.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, Game = SIM.game, P = SIM.prog;
const RW = SIM.rewards = {};

/* ------------------------------------------------------------------ contrats */
/* f : multiplicateur d'XP d'un ticket VALIDÉ. lv : niveau requis. prestige : nombre de prestiges requis. */
RW.CONTRACTS = [
  { id: 'nohelp', lv: 4, f: 1.10, label: 'Sans aide-mémoire', desc: 'Le bouton d’aide-mémoire des terminaux est retiré : tu connais tes commandes.' },
  { id: 'vague', lv: 8, f: 1.15, label: 'Ticket vague', desc: 'Le demandeur n’écrit qu’une ligne. À toi de poser le diagnostic sans son récit.' },
  { id: 'fast', lv: 13, f: 1.20, label: 'Temps réduit', desc: 'Le temps cible est réduit d’un quart : la pénalité de durée tombe plus tôt.' },
  { id: 'nomap', lv: 16, f: 1.20, label: 'Sans plan', desc: 'La carte n’affiche plus la topologie : une simple liste d’équipements, sans zones ni liens.' },
  { id: 'allin', lv: 1, prestige: 1, f: 1.50, label: 'Tout ou rien', desc: 'Réservé au prestige. 90 / 100 ou plus : XP × 1,5. En dessous : aucune XP pour ce ticket.' }
];
RW.contract = id => RW.CONTRACTS.find(c => c.id === id) || null;
RW.VAGUE_BODY = 'Bonjour, ça ne marche plus. Merci de regarder rapidement.';

/* ------------------------------------------------------------------ cosmétiques */
/* lv : niveau requis ; ch : chapitre de campagne terminé requis. Le premier de chaque famille est celui d'origine. */
RW.COS = {
  wall: [{ id: 'default', label: 'Bleu d’origine' }, { id: 'circuit', lv: 3, label: 'Circuit imprimé' }, { id: 'aurora', lv: 11, label: 'Aurore' }, { id: 'dusk', lv: 18, label: 'Crépuscule' }, { id: 'grid', lv: 26, label: 'Grille rétro' }, { id: 'summit', lv: 35, label: 'Sommet' }],
  term: [{ id: 'default', label: 'Gris d’origine' }, { id: 'green', lv: 2, label: 'Phosphore vert' }, { id: 'solar', lv: 9, label: 'Solarisé sombre' }, { id: 'violet', lv: 15, label: 'Nuit violette' }, { id: 'paper', lv: 24, label: 'Papier clair' }],
  map: [{ id: 'default', label: 'Grille d’origine' }, { id: 'blueprint', lv: 6, label: 'Plan d’architecte' }, { id: 'schema', lv: 14, label: 'Schéma technique' }, { id: 'night', lv: 22, label: 'Nuit' }],
  frame: [{ id: 'default', label: 'Aucun insigne' }, { id: 'bronze', ch: 3, label: 'Insigne de bronze' }, { id: 'silver', ch: 6, label: 'Insigne d’argent' }, { id: 'gold', ch: 10, label: 'Insigne d’or' }, { id: 'onyx', ch: 11, label: 'Insigne d’astreinte' }]
};
RW.COS_LABEL = { wall: 'Fond d’écran des postes Windows', term: 'Couleurs des terminaux', map: 'Habillage de la carte', frame: 'Insigne de profil' };
RW.THEMES = { gold: 30, boreal: 40 };   /* thèmes de prestige : identifiant → niveau */

/* ------------------------------------------------------------------ piste des récompenses (une ligne par déblocage) */
const TOOLS = [
  { id: 'leds', lv: 5, label: 'Voyants de liaison', desc: 'Sur la carte, chaque lien est vert ou rouge selon l’état réel de la liaison.' },
  { id: 'qping', lv: 12, label: 'Ping rapide', desc: 'Depuis la carte, un ping vers un équipement sans ouvrir de terminal. Il ne clôt jamais un ticket.' },
  { id: 'hist', lv: 17, label: 'Historique entre tickets', desc: 'La flèche haut des terminaux rappelle aussi les commandes de tes tickets précédents.' }
];
const DUTY = [{ id: 'duty3', lv: 10, level: 3, label: 'Astreinte : incident double' }, { id: 'duty4', lv: 20, level: 4, label: 'Astreinte : incident critique' }, { id: 'duty5', lv: 30, level: 5, label: 'Astreinte : nuit noire' }];
RW.TOOLS = TOOLS; RW.DUTY = DUTY;
RW.TRACK = (function () {
  const t = [];
  RW.CONTRACTS.filter(c => !c.prestige).forEach(c => t.push({ lv: c.lv, id: 'contract:' + c.id, kind: 'contract', label: 'Contrat « ' + c.label + ' »', desc: c.desc + ' XP × ' + String(c.f).replace('.', ',') + '.' }));
  TOOLS.forEach(x => t.push({ lv: x.lv, id: 'tool:' + x.id, kind: 'tool', label: 'Outil : ' + x.label, desc: x.desc }));
  DUTY.forEach(x => t.push({ lv: x.lv, id: x.id, kind: 'duty', label: x.label, desc: 'Un nouveau palier d’incidents à plusieurs pannes s’ouvre dans l’onglet Astreinte.' }));
  t.push({ lv: 7, id: 'second', kind: 'perk', label: 'Second avis', desc: 'Une fois par jour, un indice qui ne coûte aucun point.' });
  Object.keys(RW.COS).forEach(slot => RW.COS[slot].filter(c => c.lv).forEach(c => t.push({ lv: c.lv, id: 'cos:' + slot + ':' + c.id, kind: 'cos', label: RW.COS_LABEL[slot].split(' ')[0] + ' « ' + c.label + ' »', desc: RW.COS_LABEL[slot] + '.' })));
  t.push({ lv: 30, id: 'theme:gold', kind: 'theme', label: 'Thème de prestige « Or noir »', desc: 'Un thème d’interface réservé aux architectes.' });
  t.push({ lv: 40, id: 'theme:boreal', kind: 'theme', label: 'Thème de prestige « Boréal »', desc: 'Le thème des légendes du datacenter.' });
  t.push({ lv: 40, id: 'prestige', kind: 'prestige', label: 'Prestige', desc: 'Repartir du niveau 1 en gardant tout ce qui est débloqué, avec une étoile de prestige et le contrat « Tout ou rien ».' });
  return t.sort((a, b) => a.lv - b.lv || (a.id < b.id ? -1 : 1));
})();

/* ------------------------------------------------------------------ acquis */
RW.prestige = p => (p && typeof p.prestige === 'number' && p.prestige > 0 ? Math.min(99, Math.floor(p.prestige)) : 0);
/* niveau qui compte pour les récompenses : après un prestige, tout reste acquis */
RW.level = p => (RW.prestige(p) > 0 ? P.MAX_LEVEL : P.levelOf(p.xp).level);
RW.has = function (p, id) { const r = RW.TRACK.find(x => x.id === id); return !!r && RW.level(p) >= r.lv; };
RW.between = (from, to) => RW.TRACK.filter(r => r.lv > from && r.lv <= to);
RW.next = p => RW.TRACK.find(r => r.lv > RW.level(p)) || null;
RW.themeOwned = (p, id) => RW.THEMES[id] !== undefined && RW.level(p) >= RW.THEMES[id];
const chDone = (p, n) => !!SIM.camp && SIM.camp.examPassed(p, n);
RW.cosOwned = function (p, slot, id) { const c = (RW.COS[slot] || []).find(x => x.id === id); if (!c) return false; if (c.lv) return RW.level(p) >= c.lv; if (c.ch) return chDone(p, c.ch); return true; };
RW.cosOf = function (p, slot) { const v = p.cos && p.cos[slot]; return v && RW.cosOwned(p, slot, v) ? v : 'default'; };
RW.setCos = function (p, slot, id) { if (!RW.cosOwned(p, slot, id)) return false; p.cos = p.cos || {}; p.cos[slot] = id; return true; };
RW.cleanCos = function (c) { const out = {}; if (c && typeof c === 'object' && !Array.isArray(c)) Object.keys(RW.COS).forEach(s => { if (typeof c[s] === 'string' && RW.COS[s].some(x => x.id === c[s])) out[s] = c[s]; }); return out; };
/* insigne le plus élevé mérité (tampon de la fiche d'intervention) */
RW.bestFrame = function (p) { let b = null; RW.COS.frame.forEach(f => { if (f.ch && chDone(p, f.ch)) b = f; }); return b; };

/* outils et second avis : coupés en évaluation chronométrée et en examen de chapitre */
RW.fair = m => P.perkActive(m && m.mode) && !(m && m.camp && m.camp.exam);
RW.toolOn = (p, id, m) => RW.has(p, 'tool:' + id) && RW.fair(m);
RW.dutyOpen = (p, level) => { const d = DUTY.find(x => x.level === level); return !d || RW.has(p, d.id); };

/* contrats réellement applicables à une mission : acquis, hors mode guidé (indices gratuits), hors examen, hors tutoriel */
RW.contractOwned = (p, id) => { const c = RW.contract(id); return !!c && (c.prestige ? RW.prestige(p) >= c.prestige : RW.level(p) >= c.lv); };
RW.validContracts = function (p, ids, o) {
  o = o || {}; if (!Array.isArray(ids) || o.guided || o.exam || o.tour) return [];
  return RW.CONTRACTS.map(c => c.id).filter(id => ids.indexOf(id) >= 0 && RW.contractOwned(p, id));
};
RW.contractFactor = ids => (ids || []).reduce((a, id) => a * ((RW.contract(id) || { f: 1 }).f), 1);

/* second avis : un indice gratuit par jour */
RW.secondReady = (p, m, day) => RW.has(p, 'second') && RW.fair(m) && !(m && m.mode && m.mode.hintsFree) && p.second !== (day || P.today());
RW.useSecond = (p, day) => { p.second = day || P.today(); };

/* prestige : au niveau 40, l'XP repart de zéro ; campagne, succès, cosmétiques et récompenses restent acquis ; l'arbre est rendu (points regagnés en remontant) */
RW.canPrestige = p => P.levelOf(p.xp).level >= P.MAX_LEVEL;
RW.doPrestige = function (p) { if (!RW.canPrestige(p)) return false; p.prestige = RW.prestige(p) + 1; p.xp = 0; P.reset(p); return true; };

/* ------------------------------------------------------------------ branchements sur le moteur */
/* profil : champs nettoyés comme le reste */
const cleanBase = Game.cleanProfile;
Game.cleanProfile = function (p) {
  const out = cleanBase(p); const ok = p && typeof p === 'object' && !Array.isArray(p);
  out.cos = RW.cleanCos(ok ? p.cos : null);
  out.prestige = ok && typeof p.prestige === 'number' && isFinite(p.prestige) ? Math.min(99, Math.max(0, Math.floor(p.prestige))) : 0;
  out.second = ok && typeof p.second === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.second) ? p.second : '';
  return out;
};
/* mission : contrats validés à la création ; « temps réduit » raccourcit le temps cible */
const create = Game.create;
Game.create = function (o) {
  const m = create(o); const ids = o && o.contracts; const prof = (o && o.profile) || (Array.isArray(ids) && ids.length ? Game.profile() : null);
  m.contracts = prof ? RW.validContracts(prof, o.contracts, { guided: !!m.mode.hintsFree, exam: !!(m.camp && m.camp.exam), tour: !!o.tour }) : [];
  if (m.contracts.indexOf('fast') >= 0) m.parSec = Math.max(60, Math.round(m.parSec * 0.75));
  return m;
};
/* indice gratuit : tracé comme un indice (le ticket n'est plus « sans indice »), mais sans point retiré */
const hint = Game.Mission.prototype.hint;
Game.Mission.prototype.hint = function (partIdx, opts) {
  const r = hint.call(this, partIdx); if (r && r.n && opts && opts.free) { this.hintLog[this.hintLog.length - 1].free = true; r.cost = 0; r.free = true; }
  return r;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
