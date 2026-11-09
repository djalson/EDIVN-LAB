/* ============================================================================
   Couche jeu : niveaux, modes, missions, score, actions dangereuses, indices, clôture,
   débrief (MTTR, chemin suivi vs optimal, impasses, compétences, notions à revoir).
   Aucune dépendance au DOM : testable sous Node. Le temps réel est injecté (`clock`).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, F = SIM.fault;
const Game = SIM.game = {};

/* ------------------------------------------------------------------ niveaux et modes */
Game.LEVELS = [
  { id: 'junior', level: 1, label: 'Junior', faults: 1, desc: 'Une cause simple, un seul équipement.' },
  { id: 'confirme', level: 2, label: 'Confirmé', faults: 1, desc: 'Une cause à isoler dans un service.' },
  { id: 'admin', level: 3, label: 'Admin', faults: 2, pool: [2, 3], need: 3, desc: 'Deux pannes de nature différente dans un seul ticket.' },
  { id: 'cyber', level: 4, label: 'Cyber', faults: 3, pool: [2, 3, 4], need: 4, desc: 'Trois pannes dont une subtile, pièges et fausses pistes.' },
  { id: 'chaos', level: 5, label: 'Chaos', faults: 4, desc: 'Quatre causes tirées de tous les modules, parfois masquées entre elles.' }
];
Game.MODES = [
  { id: 'guided', label: 'Guidé', desc: 'Assistant pas à pas, indices gratuits, pas de limite de temps. Non classé.', hintsFree: true, timed: false, ranked: false, steps: true },
  { id: 'free', label: 'Libre', desc: 'Pas de limite de temps, indices payants. Classé.', hintsFree: false, timed: false, ranked: true, steps: false },
  { id: 'timed', label: 'Évaluation chronométrée', desc: 'Compte à rebours, aucun indice. Classé.', hintsFree: false, timed: true, noHints: true, ranked: true, steps: false }
];
/* Barème : une note sur 100. Le ticket est validé à partir de PASS (75). Le temps seul ne peut jamais faire passer
   une résolution propre (sans indice, sans action dangereuse, sans clôture prématurée) sous 75 : TIME_MAX = 100 − PASS. */
Game.PASS = 75;
Game.HINT_COST = [8, 15, 25];            /* points retirés par indice (1er, 2e, 3e) ; gratuits en guidé */
Game.DANGER_COST = 15; Game.DANGER_CAP = 50;  /* par action dangereuse distincte, plafond */
Game.IMPACT_COST = 4; Game.IMPACT_CAP = 20;   /* redémarrage ou coupure inutile d'un service */
const SVC_STATE = /(?:\/win\/svc\/[^/]+|\/svc\/[^/]+)\/state$/;          /* clés d'état de service : Windows (…/win/svc/X/state) et Linux (…/svc/X/state) */
const SVC_UP = v => v === 'running' || v === 'active';
Game.WRONG_CLOSE = 5; Game.FALSE_RES = 12;    /* clôture prématurée ; clôture sur un contournement */
Game.TIME_MAX = 25;                      /* pénalité de durée maximale (atteinte à 2,5 × le temps cible) */
Game.TIMED_FACTOR = 1.5;
Game.PARTIAL_TIMEOUT = 60; Game.PARTIAL_GIVEUP = 40;   /* note maximale d'un ticket non résolu, au prorata des causes réparées (toujours < PASS) */
/* Étoiles : 0 sous 75 (À repasser), 1 de 75 à 84, 2 de 85 à 94, 3 de 95 à 100 ; 100 = Parfait (animation du thème). */
Game.starsOf = n => n < Game.PASS ? 0 : n < 85 ? 1 : n < 95 ? 2 : 3;
Game.tierOf = n => n >= 100 ? 'Parfait' : n >= 95 ? 'Expert' : n >= 85 ? 'Solide' : n >= Game.PASS ? 'Validé' : 'À repasser';
/* Temps cible d'une panne : dérivé du chemin optimal (nombre d'étapes), borné. Une panne composée : somme des causes, avec 15 % de recouvrement
   (les vérifications initiales sont communes). */
Game.parOf = function (def) { const steps = Math.max(1, ((def && def.optimal) || []).length); return Math.min(1200, Math.max(360, Math.round((120 + 110 * steps) / 30) * 30)); };
/* Temps cible moyen d'un ticket d'un niveau (pour l'affichage à l'accueil) */
Game.levelPar = function (level) {
  const lv = Game.levelOf(level); const pool = SIM.faults.filter(d => lv.faults > 1 ? (lv.pool ? lv.pool.indexOf(d.level) >= 0 : d.level >= 2 && d.level <= 4) : d.level === lv.level);
  const avg = pool.length ? pool.reduce((a, d) => a + Game.parOf(d), 0) / pool.length : 600;
  return lv.faults > 1 ? Math.round(avg * lv.faults * 0.85 / 30) * 30 : Math.round(avg / 30) * 30;
};
Game.parOfParts = function (parts) { const sum = parts.reduce((a, d) => a + Game.parOf(d), 0); return parts.length > 1 ? Math.round(sum * 0.85 / 30) * 30 : sum; };
Game.levelOf = id => Game.LEVELS.find(l => l.id === id || l.level === id);
Game.modeOf = id => Game.MODES.find(m => m.id === id);

/* ------------------------------------------------------------------ actions dangereuses (lues sur la différence d'état) */
const D = Game.DANGER = [];
const rule = (id, label, why, test) => D.push({ id, label, why, test });
const num = m => parseInt(String(m), 8);
rule('fw-win-off', 'Pare-feu Windows désactivé', 'Désactiver le pare-feu règle un blocage en supprimant la protection : il faut créer la règle précise.', c => c.ch.filter(x => /\/win\/fw\/profiles\/\w+\/enabled$/.test(x.k) && x.b === false && x.a !== false).map(x => x.k));
rule('fw-win-allow', 'Pare-feu Windows : trafic entrant autorisé par défaut', 'Passer le comportement par défaut en « autoriser » ouvre tout le trafic entrant.', c => c.ch.filter(x => /\/win\/fw\/profiles\/\w+\/defIn$/.test(x.k) && /allow/i.test(String(x.b)) && !/allow/i.test(String(x.a))).map(x => x.k));
rule('ufw-off', 'UFW désactivé ou politique entrante ouverte', 'Désactiver UFW ou autoriser tout règle le symptôme en retirant la protection.', c => c.ch.filter(x => (/\/ufw\/enabled$/.test(x.k) && x.b === false) || (/\/ufw\/defaultIn$/.test(x.k) && x.b === 'allow')).map(x => x.k));
rule('pf-open', 'Règle « tout autoriser » créée sur le pare-feu', 'Une règle pass any→any sur WAN/DMZ expose le réseau : il faut une règle ciblée.', c => {
  const out = []; const ids = new Set();
  Object.keys(c.cur).forEach(k => { const m = k.match(/^(pfsense-[a-z]+\/rules\/(?:wan|dmz)\[[^\]]+\])\/act$/); if (m && c.cur[k] === 'pass' && c.cur[m[1] + '/src/t'] === 'any' && c.cur[m[1] + '/dst/t'] === 'any' && c.cur[m[1] + '/dport'] === undefined && c.prev[k] === undefined) ids.add(m[1]); });
  ids.forEach(i => out.push(i)); return out;
});
rule('acl-any', 'ACL « permit ip any any » ajoutée', 'Un permit ip any any annule le filtrage de l’ACL : il faut corriger l’ordre ou ajouter la règle précise.', c => {
  const out = []; Object.keys(c.cur).forEach(k => { const m = k.match(/^(.+\/acls\/[^/]+\/entries\[\d+\])\/a$/); if (m && c.cur[k] === 'permit' && c.cur[m[1] + '/p'] === 'ip' && c.cur[m[1] + '/s/t'] === 'any' && c.cur[m[1] + '/d/t'] === 'any' && c.prev[k] !== 'permit') out.push(m[1]); }); return out;
});
rule('chmod-open', 'Droits ouverts à tous (écriture pour « autres »)', 'chmod 777 / 666 règle un problème de droits en donnant l’écriture à tout le monde.', c => c.ch.filter(x => /^[^/]+:\//.test(x.k) && !/^[^:]+:\/tmp/.test(x.k) && typeof x.b === 'string' && /^[fd]\|/.test(x.b) && (num(x.b.split('|')[1]) & 2) && !(typeof x.a === 'string' && /^[fd]\|/.test(x.a) && (num(x.a.split('|')[1]) & 2))).map(x => x.k));
rule('data-delete', 'Suppression de données ou de fichiers système', 'Supprimer des données de la base, des clés ou des fichiers de comptes est destructeur.', c => c.ch.filter(x => x.b === undefined && x.a !== undefined && /^[^:]+:\/(var\/lib\/mysql|etc\/(passwd|shadow|group|ssh)|home\/[^/]+\/\.ssh)/.test(x.k) && !/\/(\.bash_history)$/.test(x.k)).map(x => x.k));
rule('ad-priv', 'Compte ajouté à un groupe d’administration', 'Ajouter un compte aux Admins du domaine résout un refus d’accès en donnant tous les droits : le correctif est ailleurs.', c => c.ch.filter(x => /\/win\/ad\/groups\[(Admins du domaine|Administrateurs|Admins de l’entreprise|Admins de l'entreprise)\]\/members$/.test(x.k) && Array.isArray(x.b) && x.b.length > (Array.isArray(x.a) ? x.a.length : 0)).map(x => x.k));
rule('ad-delete', 'Objet Active Directory supprimé', 'Supprimer un compte, un groupe ou un objet de stratégie détruit de l’information difficile à restaurer.', c => c.ch.filter(x => x.b === undefined && x.a !== undefined && /\/win\/ad\/(users|groups|gpos|ous)\[[^\]]+\]\/(sam|name|id)$/.test(x.k)).map(x => x.k));
rule('ntfs-everyone', 'Contrôle total donné à « Tout le monde »', 'Ouvrir un dossier à Tout le monde corrige un refus en supprimant le cloisonnement des droits.', c => {
  const out = []; Object.keys(c.cur).forEach(k => { const m = k.match(/^(.+\/(?:ntfs\/.+\/acl|shares\[[^\]]+\]\/perms)\[\d+\])\/who$/); if (m && /^(tout le monde|everyone)$/i.test(String(c.cur[k])) && /full|contr[oô]le total/i.test(String(c.cur[m[1] + '/rights'] || c.cur[m[1] + '/access'] || '')) && c.prev[m[1] + '/who'] !== c.cur[k]) out.push(m[1]); }); return out;
});
rule('link-down', 'Liaison d’infrastructure coupée', 'Couper un trunk, une liaison inter-sites ou un uplink coupe tout ce qui passe par là.', c => c.ch.filter(x => /\/(ports|ifaces)\/[^/]+\/adminDown$/.test(x.k) && x.b === true).filter(x => { const base = x.k.replace(/\/adminDown$/, ''); return c.cur[base + '/mode'] === 'trunk' || /vers|trunk|liaison|uplink|wan/i.test(String(c.cur[base + '/desc'] || '')); }).map(x => x.k));
rule('svc-stop', 'Service critique arrêté', 'Arrêter DHCP, DNS, NTDS, Netlogon ou un service de domaine provoque une panne plus large.', c => c.ch.filter(x => /\/win\/svc\/(Dhcp|DNS|NTDS|Netlogon|Kdc|W32Time|gpsvc|LanmanServer|mpssvc|EventLog)\/state$/.test(x.k) && x.a === 'running' && x.b !== 'running').map(x => x.k));
rule('vlan-delete', 'VLAN supprimé', 'Supprimer un VLAN coupe toutes les machines qui y sont rattachées.', c => c.ch.filter(x => x.b === undefined && x.a !== undefined && /^(.+)\/vlans\/\d+\/name$/.test(x.k)).map(x => x.k));
rule('scope-delete', 'Étendue DHCP ou zone DNS supprimée', 'Supprimer une étendue ou une zone casse l’adressage ou la résolution pour tout le réseau.', c => c.ch.filter(x => x.b === undefined && x.a !== undefined && /\/win\/(dhcp\/scopes|dns\/zones)\[[^\]]+\]\/(id|name)$/.test(x.k)).map(x => x.k));
rule('db-wildcard', 'Compte SQL ouvert à tous les hôtes (%)', 'Ouvrir un compte de base de données à « % » règle un refus d’accès en supprimant la restriction par hôte.', c => c.ch.filter(x => /\/db\/users\[\d+\]\/host$/.test(x.k) && x.b === '%' && x.a !== '%').map(x => x.k));
rule('sshd-weak', 'Durcissement SSH affaibli', 'StrictModes no, PermitRootLogin yes ou PermitEmptyPasswords yes contournent la protection au lieu de corriger la cause.', c => {
  const out = []; c.ch.forEach(x => { if (/^[^:]+:\/etc\/ssh\/sshd_config$/.test(x.k)) { const dev = x.k.split(':')[0]; const t = SIM.lx.readFile(c.W.d(dev), '/etc/ssh/sshd_config') || ''; if (/^\s*(StrictModes\s+no|PermitRootLogin\s+yes|PermitEmptyPasswords\s+yes)\b/mi.test(t)) out.push(x.k); } }); return out;
});
rule('log-clear', 'Journal d’événements effacé', 'Effacer un journal détruit les preuves du diagnostic : on lit les événements, on ne les supprime pas.', c => c.acts.filter(a => a.danger === 'logclear').map(a => a.text));
rule('cfg-wipe', 'Configuration effacée', 'Effacer la configuration d’un équipement supprime tout son paramétrage.', c => c.acts.filter(a => a.danger === 'wipe').map(a => a.text));

Game.scanDanger = function (W, prev, cur, acts, okIds) {
  const ch = []; const keys = new Set(Object.keys(prev).concat(Object.keys(cur)));
  keys.forEach(k => { const a = prev[k], b = cur[k]; if (JSON.stringify(a) !== JSON.stringify(b)) ch.push({ k, a, b }); });
  const ctx = { ch, prev, cur, W, acts: acts || [] }; const found = [];
  /* okDanger : identifiants de règles exemptées pour toute la mission, OU { id, match } — exemption limitée aux éléments dont la clé contient « match »
     (par exemple supprimer la GPO de test que la panne a créée : chemin de résolution déclaré, sans exempter la suppression de n'importe quelle autre GPO). */
  const okAll = (okIds || []).filter(x => typeof x === 'string'), okSome = (okIds || []).filter(x => x && typeof x === 'object');
  for (const r of D) { if (okAll.indexOf(r.id) >= 0) continue; let d; try { d = r.test(ctx); } catch (e) { d = null; }
    const lim = okSome.filter(o => o.id === r.id); if (d && lim.length) d = d.filter(item => !lim.some(o => String(item).indexOf(o.match) >= 0)); if (d && d.length) found.push({ id: r.id, label: r.label, why: r.why, detail: d.slice(0, 3) }); }
  return { found, changed: ch.length, ch };
};

/* ------------------------------------------------------------------ profil (persistant, tolérant à l'absence de stockage) */
Game.store = (function () {
  const mem = {};
  const ls = () => { try { return g.localStorage || null; } catch (e) { return null; } };
  return {
    get(k) { try { const s = ls(); const v = s ? s.getItem('edivn.' + k) : null; return v == null ? (mem[k] === undefined ? null : mem[k]) : JSON.parse(v); } catch (e) { return mem[k] === undefined ? null : mem[k]; } },
    set(k, v) { mem[k] = v; try { const s = ls(); if (s) s.setItem('edivn.' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : profil en mémoire */ } }
  };
})();
/* Un profil lu dans le stockage n'est jamais de confiance (stockage partagé, corrompu, édité à la main) :
   forme et types sont reconstruits champ par champ, les clés dangereuses sont écartées. */
Game.cleanProfile = function (p) {
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const okKey = k => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  const out = { v: 2, name: 'Technicien', done: {}, skills: {}, badges: [], history: [], best: {}, xp: 0, tree: {}, stats: {}, streak: { n: 0, last: '', best: 0 }, daily: { date: '', done: false }, notes: {}, pv: 0 };
  if (!isObj(p)) return out;
  /* Profil d'avant le barème sur 100 (points ouverts) : les notes ne sont pas convertibles, on repart de zéro sur les meilleurs scores. */
  const legacy = p.v !== 2; const n100 = (v) => legacy ? 0 : Math.min(100, Math.max(0, num(v, 0)));
  /* progression : XP, arbre acheté, compteurs, série, ticket du jour, carnet — chaque champ borné et typé */
  const dateOk = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!legacy || p.v === 2) {
    out.xp = Math.min(1e7, Math.max(0, Math.floor(num(p.xp, 0)))); out.pv = p.pv === 1 ? 1 : 0;
    if (isObj(p.tree)) Object.keys(p.tree).filter(okKey).slice(0, 60).forEach(k => { if (p.tree[k]) out.tree[k] = 1; });
    if (isObj(p.stats)) ['played', 'passed', 'perfect', 'clean', 'root', 'goals', 'dailies', 'logins', 'cmds', 'notes'].forEach(k => { out.stats[k] = Math.min(1e7, Math.max(0, Math.floor(num(p.stats[k], 0)))); });
    if (isObj(p.streak)) out.streak = { n: Math.min(10000, Math.max(0, Math.floor(num(p.streak.n, 0)))), last: dateOk(p.streak.last) ? p.streak.last : '', best: Math.min(10000, Math.max(0, Math.floor(num(p.streak.best, 0)))) , shieldAt: Math.floor(num(p.streak.shieldAt, -99)) };
    if (isObj(p.daily)) out.daily = { date: dateOk(p.daily.date) ? p.daily.date : '', done: p.daily.done === true, note: Math.min(100, Math.max(0, num(p.daily.note, 0))) };
    if (isObj(p.notes)) Object.keys(p.notes).filter(okKey).slice(-30).forEach(k => { if (typeof p.notes[k] === 'string') out.notes[k.slice(0, 40)] = p.notes[k].slice(0, 4000); });
    if (typeof p.title === 'string') out.title = p.title.slice(0, 40);
    if (typeof p.giftTheme === 'string' && /^[a-z]{2,12}$/.test(p.giftTheme)) out.giftTheme = p.giftTheme;
  }
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 24);
  if (p.tourDone === true) out.tourDone = true;
  if (isObj(p.done)) Object.keys(p.done).filter(okKey).slice(0, 500).forEach(k => { const v = p.done[k]; if (isObj(v)) out.done[k] = { count: Math.max(0, num(v.count, 0)), best: n100(v.best) }; });
  if (isObj(p.skills)) Object.keys(p.skills).filter(okKey).slice(0, 500).forEach(k => { const v = p.skills[k]; if (isObj(v)) out.skills[k] = { ok: Math.max(0, num(v.ok, 0)), ko: Math.max(0, num(v.ko, 0)) }; });
  if (isObj(p.best)) Object.keys(p.best).filter(okKey).slice(0, 20).forEach(k => { if (typeof p.best[k] === 'number' && isFinite(p.best[k])) out.best[k] = n100(p.best[k]); });
  if (Array.isArray(p.badges)) out.badges = p.badges.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 100);
  if (Array.isArray(p.history)) out.history = p.history.filter(isObj).slice(-200).map(x => ({ at: num(x.at, 0), seed: String(x.seed === undefined ? '' : x.seed).slice(0, 40), level: Math.min(5, Math.max(1, num(x.level, 1))), mode: typeof x.mode === 'string' ? x.mode.slice(0, 12) : 'free', id: typeof x.id === 'string' ? x.id.slice(0, 60) : '', kind: typeof x.kind === 'string' ? x.kind.slice(0, 20) : '', total: n100(x.total), mttr: num(x.mttr, 0), stars: legacy ? 0 : Math.min(3, Math.max(0, num(x.stars, 0))), perfect: !legacy && x.perfect === true, skills: Array.isArray(x.skills) ? x.skills.filter(y => typeof y === 'string').slice(0, 20) : [] }));
  return out;
};
Game.profile = function () { const p = Game.cleanProfile(Game.store.get('profile')); return SIM.prog ? SIM.prog.migrate(p) : p; };
Game.saveProfile = p => Game.store.set('profile', p);

/* ------------------------------------------------------------------ choix d'une panne */
Game.pick = function (level, seed, profile, opts) {
  opts = opts || {}; const rng = U.rng('pick|' + level + '|' + seed);
  let pool = SIM.faults.filter(d => d.level === level);
  /* évaluation chronométrée : les pannes dont la réparabilité par l'interface n'est pas prouvée (SIM.UNPROVEN_FAULTS) ne sont pas tirées ; jamais de pool vide */
  if (opts.timed) { const ok = pool.filter(d => !SIM.isUnproven(d.id)); if (ok.length) pool = ok; }
  if (opts.skill) { const sp = pool.filter(d => d.skills.indexOf(opts.skill) >= 0); if (sp.length) pool = sp; }
  if (opts.faultId) { const f = SIM.faults.find(d => d.id === opts.faultId); if (f) return f; }
  const done = (profile && profile.done) || {};
  const min = Math.min.apply(null, pool.map(d => (done[d.id] || {}).count || 0));
  const fresh = pool.filter(d => ((done[d.id] || {}).count || 0) === min);
  return rng.pick(fresh);
};

/* ------------------------------------------------------------------ mission */
function Mission(o) {
  this.clock = o.clock || (() => Date.now());
  this.seed = String(o.seed); this.lv = Game.levelOf(o.level); this.opts = { skill: o.skill, parts: o.parts, chain: o.chain }; this.mode = Game.modeOf(o.mode || 'free');
  this.W = SIM.buildHealthyWorld({ seed: this.seed }); this.base = this.W.sem();
  const prof = o.profile || Game.profile();
  /* campagne : chapitre, examen, révision (src/engine/83-campaign.js) ; o.bundle : assemblage imposé (examen de chapitre) */
  this.camp = o.camp ? Object.assign({}, o.camp) : null;
  if (o.bundle) this.fault = F.bundle(o.bundle.seed || this.seed, o.bundle);
  else if (o.faultId) this.fault = F.instantiate(Game.pick(this.lv.level, this.seed, prof, { skill: o.skill, faultId: o.faultId }), this.seed);
  else if (this.lv.faults > 1) {
    /* Admin = 2 pannes, Cyber = 3, Chaos = 4 (ou o.parts) : assemblage validé par simulation, natures différentes, rejet des paires incompatibles. */
    const spec = { count: o.parts || this.lv.faults, mode: o.chain === false ? 'indep' : 'auto' };
    if (this.mode.timed) spec.exclude = (SIM.UNPROVEN_FAULTS || []).map(u => u.fault);   /* chronométré : pas de panne non prouvée dans une mission composée */
    if (this.lv.pool) { spec.levels = this.lv.pool; spec.needLevel = this.lv.need; }
    if (o.skill) { const a = SIM.faults.filter(d => d.skills.indexOf(o.skill) >= 0 && (!spec.levels || spec.levels.indexOf(d.level) >= 0) && !(this.mode.timed && SIM.isUnproven(d.id))).map(d => d.id); if (a.length) spec.anchor = a; }
    this.fault = F.bundle(this.seed, spec);
  } else this.fault = F.instantiate(Game.pick(this.lv.level, this.seed, prof, { skill: o.skill, timed: !!this.mode.timed }), this.seed);
  this.parts = this.fault.bundle ? this.fault.parts : [this.fault];
  this.startMs = this.clock(); this.pausedMs = 0; this.pausedAt = null;
  this.trace = []; this.hintsUsed = 0; this.hintLog = []; this.dangers = []; this.wrongCloses = 0; this.falseRes = 0; this.impacts = []; this.refunded = []; this.aids = []; this.fx = []; this._blk = this._blockedNow();
  this.state = 'running'; this.result = null; this.resolvedAtSec = null; this.firstFixedAtSec = null; this.endSec = null;
  this.parts.forEach(p => F.runSteps(this.W, p.inject, { inst: p }));
  this.prevSem = this.W.sem(); this.simStart = this.W.clock.elapsed;
  this.prog = this._progress(); this.counters = { diagnostic: 0, change: 0, progress: 0, regress: 0, detour: 0 };
  this.okDanger = [].concat.apply([], this.parts.map(p => p.okDanger || []));
  this.parSec = Game.parOfParts(this.parts);
  this.deadlineSec = this.mode.timed ? Math.round(this.parSec * Game.TIMED_FACTOR) : null;
  this.guided = { opened: [] };
  this.daily = !!o.daily; this.prof = prof;
  this.goals = SIM.prog ? SIM.prog.goalsFor(this.seed, prof, this.fault.id) : [];
}
Mission.prototype.elapsedSec = function () { const now = this.pausedAt === null ? this.clock() : this.pausedAt; return Math.max(0, (now - this.startMs - this.pausedMs) / 1000); };
Mission.prototype.pause = function () { if (this.pausedAt === null && this.state === 'running') this.pausedAt = this.clock(); };
Mission.prototype.resume = function () { if (this.pausedAt !== null) { this.pausedMs += this.clock() - this.pausedAt; this.pausedAt = null; } };
Mission.prototype.remainingSec = function () { return this.deadlineSec === null ? null : Math.max(0, this.deadlineSec - this.elapsedSec()); };
Mission.prototype._progress = function () {
  let probesOk = 0, probesTotal = 0, rootsOk = 0, rootsTotal = 0;
  this.parts.forEach(p => { const rt = F.evaluate(this.W, p, this.base); probesOk += rt.probes.filter(x => x.ok).length; probesTotal += rt.probes.length; const rc = F.rootsCount(this.W, p, this.base); rootsOk += rc.ok; rootsTotal += rc.total; });
  return { probesOk, probesTotal, rootsOk, rootsTotal };
};
/* Statut détaillé de chaque cause */
Mission.prototype.status = function () {
  if (this.fault.bundle) return F.bundleEvaluate(this.W, this.fault, this.base);
  const rt = F.evaluate(this.W, this.fault, this.base);
  return { status: rt.status, parts: [{ id: this.fault.id, rt }], solved: rt.allOk ? 1 : 0, total: 1 };
};
/* Hôtes inscrits dans une table de blocage Snort (« snort2c »), par équipement : sert à nommer, au débrief, l'action qui a bloqué un hôte (D-90). */
Mission.prototype._blockedNow = function () { const o = {}; try { Object.keys(this.W.dev).forEach(id => { (this.W.dev[id].snortBlocked || []).forEach(b => { o[id + '|' + b.ip] = b; }); }); } catch (e) { /* monde sans Snort */ } return o; };
/* Une action du joueur : { kind: 'cmd'|'ui'|'nav'|'physical'|'read', dev, text, mutates?, danger?, impact? } */
Mission.prototype.act = function (e) {
  if (this.state !== 'running') return { ignored: true };
  e = Object.assign({ t: this.elapsedSec(), sim: this.W.clock.elapsed - this.simStart }, e);
  const cur = this.W.sem(); const dg = Game.scanDanger(this.W, this.prevSem, cur, [e], this.okDanger);
  const changed = dg.changed > 0 || e.mutates === true;
  let cls = 'diagnostic';
  if (changed) {
    const before = this.prog; const after = this._progress();
    const gain = (after.probesOk - before.probesOk) + (after.rootsOk - before.rootsOk), loss = (before.probesOk - after.probesOk) + (before.rootsOk - after.rootsOk);
    cls = gain > 0 && loss <= 0 ? 'progress' : loss > 0 && gain <= 0 ? 'regress' : gain > 0 ? 'progress' : 'detour';
    this.prog = after; this.counters.change++; this.counters[cls]++;
    this.prevSem = cur;
  } else this.counters.diagnostic++;
  e.cls = cls; this.trace.push(e);
  { const now = this._blockedNow(); Object.keys(now).forEach(k => { if (!this._blk[k]) { const b = now[k]; const own = SIM.net && SIM.net.findOwner ? SIM.net.findOwner(this.W, b.ip) : null; this.fx.push({ t: e.t, kind: 'snort-block', text: e.text, dev: e.dev, ip: b.ip, host: own ? own.dev.id : null, sid: b.sid, msg: b.msg, on: k.split('|')[0] }); } }); this._blk = now; }
  const newDangers = dg.found.map(x => Object.assign({ t: e.t, text: e.text }, x));
  /* Impact (D-79, règle « par le résultat » du 30/10/2026) : un arrêt de service coûte tant que le service reste arrêté. Si le joueur le relance
     (stop puis start = redémarrage), l'impact est retiré du compte (il reste lisible dans `refunded` pour le débrief). reboot / poweroff / liaison
     coupée ne sont jamais remboursés. L'entrée garde les clés d'état des services que CETTE action a arrêtés. */
  if (e.impact && !this.parts.some(p => p.needsReboot)) {
    const svc = e.impact === 'svc-stop' ? dg.ch.filter(x => SVC_STATE.test(x.k) && SVC_UP(x.a) && !SVC_UP(x.b)).map(x => x.k) : [];
    /* « net stop x && net start x » sur UNE ligne : l'action est tagguée svc-stop mais l'état final est identique à l'état initial → rien n'a été coupé. */
    if (!(e.impact === 'svc-stop' && !svc.length && dg.changed === 0)) this.impacts.push({ t: e.t, text: e.text, kind: e.impact, svc });
  }
  this.impacts = this.impacts.filter(i => {
    if (i.kind !== 'svc-stop' || !i.svc || !i.svc.length || !i.svc.every(k => SVC_UP(cur[k]))) return true;
    (this.refunded = this.refunded || []).push({ t: i.t, text: i.text, kind: i.kind, restoredAt: e.t, restoredBy: e.text }); return false;
  });
  newDangers.forEach(x => { if (!this.dangers.some(d => d.id === x.id && JSON.stringify(d.detail) === JSON.stringify(x.detail))) this.dangers.push(x); });
  const st = this.check();
  return { cls, dangers: newDangers, status: st.status, ended: this.state !== 'running' };
};
/* Évalue l'état ; clôture automatique quand la résolution est vérifiée depuis un poste client */
Mission.prototype.check = function () {
  if (this.state !== 'running') return { status: this.result && this.result.status };
  const st = this.status();
  if (st.solved === st.total && this.firstFixedAtSec === null) this.firstFixedAtSec = this.elapsedSec();
  /* L'échéance prime : une résolution constatée après l'heure limite du mode chronométré est un temps écoulé. */
  if (this.deadlineSec !== null && this.elapsedSec() >= this.deadlineSec) this._finish('timeout', st);
  else if (st.status === 'resolved') { this.resolvedAtSec = this.elapsedSec(); this._finish('resolved', st); }
  return st;
};
/* Aides consultées (D-94, D-95) : plan d'adressage, aide-mémoire. Tracées pour le débrief (« aide consultée »), SANS effet sur la note,
   hors de la trace d'actions (une consultation n'est ni une étape du chemin suivi ni une étape du chemin optimal). */
Mission.prototype.aid = function (kind) { if (this.state !== 'running') return false; this.aids.push({ t: Math.round(this.elapsedSec()), kind }); return true; };
/* Indices : coût croissant ; gratuits en guidé ; interdits en évaluation */
Mission.prototype.hint = function (partIdx) {
  if (this.mode.noHints) return { denied: true, why: 'Les indices sont désactivés en évaluation chronométrée.' };
  const k = this.hintsUsed; if (k >= 3) return { none: true };
  const src = this.fault.bundle ? this.fault.hints : this.fault.hints;
  this.hintsUsed++; const text = src[k]; this.hintLog.push({ n: k + 1, t: this.elapsedSec(), text });
  return { n: k + 1, text, cost: this.mode.hintsFree ? 0 : Game.HINT_COST[k] };
};
/* Clôture explicite du ticket par le joueur */
Mission.prototype.close = function () {
  if (this.state !== 'running') return { already: true };
  const st = this.check(); if (this.state !== 'running') return { ok: true, result: this.result };
  if (st.status === 'workaround') { this.falseRes++; this.wrongCloses++; this.trace.push({ t: this.elapsedSec(), kind: 'close', text: 'Clôture sur un contournement', cls: 'false-close' }); return { ok: false, why: 'workaround', message: 'Le service remarche pour l’utilisateur mais la cause racine n’est pas corrigée : la panne reviendra. Le ticket est rouvert.' }; }
  /* panne « silencieuse » (D-93) : la clôture sur un test qui réussit est refusée ; la panne dit POURQUOI (champ closeNote), sans nommer la cause ni la commande */
  const notes = this.parts.filter(p => p.rt && p.rt.status !== 'resolved' && p.closeNote).map(p => p.closeNote);
  this.wrongCloses++; this.trace.push({ t: this.elapsedSec(), kind: 'close', text: 'Clôture prématurée', cls: 'wrong-close', note: notes.length ? notes.join(' ') : undefined });
  const base = st.status === 'fixed' ? 'La correction semble bonne mais n’a pas été vérifiée depuis le poste de l’utilisateur : testez avant de clôturer.' : 'Le problème persiste pour l’utilisateur : le ticket est rouvert.';
  return { ok: false, why: st.status === 'fixed' ? 'unverified' : 'active', message: base + (notes.length ? ' ' + notes.join(' ') : '') };
};
Mission.prototype.giveUp = function () { if (this.state === 'running') this._finish('abandoned', this.status()); return this.result; };
Mission.prototype.guideSteps = function () { return (this.fault.optimal || []).map((s, i) => ({ n: i + 1, text: s })); };

Mission.prototype._finish = function (kind, st) {
  const t = this.elapsedSec(); this.endSec = t; this.state = 'done';
  const sc = { start: 100, unsolved: 0, time: 0, hints: 0, danger: 0, impact: 0, wrongClose: 0, falseRes: 0 };
  /* Non résolu : plafond sous le seuil de validation, au prorata des causes réparées. */
  if (kind !== 'resolved') sc.unsolved = -(100 - Math.round((kind === 'timeout' ? Game.PARTIAL_TIMEOUT : Game.PARTIAL_GIVEUP) * (st.total ? st.solved / st.total : 0)));
  else if (t > this.parSec) sc.time = -Math.min(Game.TIME_MAX, Math.round(Game.TIME_MAX * (t - this.parSec) / (1.5 * this.parSec)));
  sc.hints = this.mode.hintsFree ? 0 : -this.hintLog.reduce((a, h) => a + Game.HINT_COST[h.n - 1], 0);
  sc.danger = -Math.min(Game.DANGER_CAP, this.dangers.length * Game.DANGER_COST);
  sc.impact = -Math.min(Game.IMPACT_CAP, this.impacts.length * Game.IMPACT_COST);
  sc.wrongClose = -(this.wrongCloses - this.falseRes) * Game.WRONG_CLOSE; sc.falseRes = -this.falseRes * Game.FALSE_RES;
  const note = Math.max(0, Math.min(100, sc.start + sc.unsolved + sc.time + sc.hints + sc.danger + sc.impact + sc.wrongClose + sc.falseRes));
  const passed = kind === 'resolved' && note >= Game.PASS;
  /* « total » conserve le nom historique du champ : c'est la note sur 100. */
  this.result = { kind, status: kind, mttrSec: Math.round(t), parSec: this.parSec, score: sc, total: note, note, passed, stars: passed ? Game.starsOf(note) : 0, perfect: kind === 'resolved' && note === 100, tier: kind === 'resolved' ? Game.tierOf(note) : 'À repasser', ranked: this.mode.ranked };
};

/* ------------------------------------------------------------------ débrief */
const SKILL_TIPS = {};
Mission.prototype.debrief = function () {
  const r = this.result || (this.state === 'running' ? { kind: 'running' } : null);
  const optimal = this.fault.optimal || [];
  const tr = this.trace;
  const deadEnds = tr.filter(x => x.cls === 'detour' || x.cls === 'regress').map(x => ({ t: Math.round(x.t), text: x.text, dev: x.dev, cls: x.cls }));
  const skillIds = this.fault.skills || [];
  const weak = {}; const flag = (sid, why) => { (weak[sid] = weak[sid] || []).push(why); };
  const allSk = skillIds.slice();
  if (this.hintLog.length) allSk.forEach(s => flag(s, 'indice(s) utilisé(s)'));
  if (this.dangers.length) allSk.forEach(s => flag(s, 'action dangereuse : ' + this.dangers.map(d => d.label).join(' ; ')));
  if (deadEnds.length > 3) allSk.forEach(s => flag(s, 'nombreuses modifications sans effet (' + deadEnds.length + ')'));
  if (this.falseRes) allSk.forEach(s => flag(s, 'contournement pris pour une résolution'));
  if (r && r.kind !== 'resolved' && r.kind !== 'running') allSk.forEach(s => flag(s, 'panne non résolue'));
  const skills = skillIds.map(id => { const sk = SIM.skills[id] || { label: id }; const why = weak[id] || []; return { id, label: sk.label || sk.title || id, domain: sk.domain, ok: why.length === 0, why }; });
  return {
    fault: { id: this.fault.id, title: this.fault.title, level: this.fault.level, cause: this.fault.cause, solution: this.fault.solution, traps: this.fault.traps || [], parts: this.parts.map(p => ({ id: p.id, title: p.title, cause: p.cause, solution: p.solution })) },
    result: r, mttrSec: r && r.mttrSec, parSec: this.parSec, firstFixedSec: this.firstFixedAtSec === null ? null : Math.round(this.firstFixedAtSec),
    path: { counters: Object.assign({}, this.counters), actions: tr.length, optimal, followedChanges: this.counters.change, deadEnds, timeline: tr.map(x => ({ t: Math.round(x.t), kind: x.kind, dev: x.dev, text: x.text, cls: x.cls, note: x.note })) },
    closeRefusals: tr.filter(x => x.kind === 'close' && x.note).map(x => ({ t: Math.round(x.t), note: x.note })),
    dangers: this.dangers, impacts: this.impacts, refundedImpacts: this.refunded.slice(), aids: this.aids.slice(), sideEffects: this.fx.slice(), hints: this.hintLog, wrongCloses: this.wrongCloses, falseResolutions: this.falseRes,
    skills, review: skills.filter(s => !s.ok).map(s => ({ id: s.id, label: s.label, why: s.why }))
  };
};
Game.Mission = Mission;
Game.create = o => new Mission(o);

/* ------------------------------------------------------------------ profil : enregistrement d'une mission terminée, badges */
Game.BADGES = [
  { id: 'first', label: 'Premier ticket', test: (p, m, r) => r.kind === 'resolved' && p.history.length === 0 },
  { id: 'clean', label: 'Sans faute', desc: 'Résolu sans indice, sans action dangereuse et sans clôture prématurée.', test: (p, m, r) => r.kind === 'resolved' && !m.hintLog.length && !m.dangers.length && !m.wrongCloses },
  { id: 'fast', label: 'Éclair', desc: 'Résolu en moins de la moitié du temps cible.', test: (p, m, r) => r.kind === 'resolved' && r.mttrSec <= r.parSec / 2 },
  { id: 'chaos', label: 'Gestionnaire de crise', desc: 'Résolution d’un incident Chaos.', test: (p, m, r) => r.kind === 'resolved' && m.lv.level === 5 },
  { id: 'cyber', label: 'Œil de lynx', desc: 'Résolution d’un incident Cyber.', test: (p, m, r) => r.kind === 'resolved' && m.lv.level === 4 },
  { id: 'rootcause', label: 'Cause racine', desc: 'N’a jamais pris un contournement pour une résolution.', test: (p, m, r) => r.passed && !m.falseRes && m.lv.level >= 3 },
  { id: 'perfect', label: 'Parfait', desc: 'Note de 100 / 100 : sans indice, sans faute et dans le temps cible.', test: (p, m, r) => !!r.perfect },
  { id: 'five', label: 'Cinq tickets validés', test: (p) => p.history.filter(h => h.stars > 0).length >= 5 },
  { id: 'twenty', label: 'Vingt tickets validés', test: (p) => p.history.filter(h => h.stars > 0).length >= 20 }
];
Game.record = function (m, profile) {
  const r = m.result; if (!r) return null; const p = profile || Game.profile(); const P = SIM.prog;
  P.migrate(p);
  const prev = { counts: {}, bests: {} }; m.parts.forEach(pt => { const d = p.done[pt.id]; prev.counts[pt.id] = d ? d.count : 0; prev.bests[pt.id] = d ? d.best : 0; });
  const lvBefore = P.levelOf(p.xp), stBefore = P.streakInfo(p);
  const pre = P.collectMission(p, m, r);          /* succès « de ticket » : évalués avant l'ajout à l'historique */
  const entry = { at: Date.now(), seed: m.seed, level: m.lv.level, mode: m.mode.id, id: m.fault.id, kind: r.kind, total: r.total, mttr: r.mttrSec, stars: r.stars, perfect: !!r.perfect, skills: m.fault.skills };
  p.history.push(entry); if (p.history.length > 200) p.history.shift();
  m.parts.forEach(pt => { const d = p.done[pt.id] || { count: 0, best: 0 }; d.count++; d.best = Math.max(d.best, r.total); p.done[pt.id] = d; });
  (m.fault.skills || []).forEach(s => { const k = p.skills[s] || { ok: 0, ko: 0 }; if (r.passed && !m.hintLog.length && !m.dangers.length && !(r.report && !r.report.causeOk)) k.ok++; else k.ko++; p.skills[s] = k; });
  if (r.ranked) { const key = 'l' + m.lv.level; p.best[key] = Math.max(p.best[key] || 0, r.total); }
  /* campagne et révision espacée : avant le calcul de l'XP (l'examen réussi pour la première fois rapporte un bonus) */
  const camp = SIM.camp ? SIM.camp.record(p, m, r) : null;
  const prog = P.apply(p, m, r, prev, pre, lvBefore, stBefore);
  Game.saveProfile(p); return { profile: p, newBadges: prog.newBadges, prog, camp };
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
