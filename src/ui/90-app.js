/* ============================================================================
   Application : écran d'accueil (profil, niveau, mode, seed), écran de jeu (ticket, minuteur,
   indices, carte par site, onglets d'appareils), débrief.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, Game = SIM.game, h = UI.h;

/* #legacy dans l'adresse : jeu d'origine (accueil ouvert sur le bac à sable, pas de fiche d'intervention). Sert aux tests d'interface antérieurs à la campagne. */
function App(root) { this.root = root; this.run = null; this.legacy = /legacy/.test(String(g.location && g.location.hash)); this.home(); }
UI.App = App;
const P = App.prototype;

/* ------------------------------------------------------------------ accueil */
const randomSeed = () => String(Math.floor(Math.random() * 900000000) + 100000000);
P.home = function () {
  if (!this._customLoaded) { this._customLoaded = true; this.loadCustom(); }
  if (this.run) { this.run.stop(); this.run = null; }
  const self = this; const prof = Game.profile(); const root = UI.clear(this.root);
  const theme = UI.themes.apply(UI.themes.saved());
  const passed = prof.history.filter(x => x.stars > 0);
  const firstVisit = !prof.history.length && !prof.tourDone;
  const sel = { level: this.lastLevel || Math.min(5, 1 + Math.max(0, ...passed.map(x => x.level), 0)), mode: this.lastMode || (firstVisit ? 'guided' : 'free') };
  if (sel.level > 5) sel.level = 5;
  /* La graine n'est plus un choix du joueur : tirage automatique. Le formateur peut la fixer dans « Options formateur » ; elle est rappelée au débrief. */
  const seedIn = h('input.txt', { value: this.lastSeed || '', placeholder: 'aléatoire', style: { width: '150px' }, 'aria-label': 'Graine de l’incident (vide = aléatoire)' });
  const nameIn = h('input.txt.hname', { value: prof.name, maxlength: 24, 'aria-label': 'Nom du technicien' });
  const LVC = { 1: '#2fbf71', 2: '#3b8cff', 3: '#f0a63a', 4: '#e5534b', 5: '#a77bff' };
  const lvInfo = l => {
    if (l.faults > 1) { const pool = l.pool ? SIM.faults.filter(f => l.pool.indexOf(f.level) >= 0).length : SIM.faults.filter(f => f.level >= 2 && f.level <= 4).length; return pool + ' pannes combinables, toujours de natures différentes'; }
    const fs = SIM.faults.filter(f => f.level === l.level); const doms = {};
    fs.forEach(f => f.skills.forEach(k => { const d = (SIM.skills[k] || {}).domaine; if (d && d !== 'Méthode') doms[d] = (doms[d] || 0) + 1; }));
    return fs.length + ' pannes · ' + Object.keys(doms).sort((a, b) => doms[b] - doms[a]).slice(0, 4).join(', ');
  };
  const mins = sec => Math.round(sec / 60);
  const lv = h('div.hlevels'); const md = h('div.hmodes'); const sum = h('div.hsum');
  const diff = n => h('span.hstars', { 'aria-label': 'Difficulté ' + n + ' sur 5' }, '■'.repeat(n), h('i', '■'.repeat(5 - n)));
  const refresh = () => {
    const L = Game.LEVELS.find(x => x.level === sel.level), M = Game.MODES.find(x => x.id === sel.mode); const par = Game.levelPar(L.level);
    UI.clear(sum); sum.append(h('div.hsumt', h('b', 'Niveau ' + L.label), ' · ', h('b', M.label), ' · ', L.faults > 1 ? L.faults + ' pannes dans le ticket' : '1 panne'), h('div.muted', M.timed ? 'Compte à rebours d’environ ' + mins(par * Game.TIMED_FACTOR) + ' min, sans indice.' : 'Temps cible ≈ ' + mins(par) + ' min' + (M.hintsFree ? ' — indices gratuits, assistant pas à pas.' : ' — chaque indice coûte des points.') + ' Validé à partir de ' + Game.PASS + ' / 100.'));
  };
  const drawL = () => { UI.clear(lv); Game.LEVELS.forEach(l => { const done = passed.filter(x => x.level === l.level).length; lv.append(h('button.hlv' + (sel.level === l.level ? '.on' : ''), { style: '--c:' + LVC[l.level], on: { click: () => { sel.level = l.level; self.lastLevel = l.level; drawL(); refresh(); } } }, h('div.hlvn', UI.pixel('l' + l.level, 4)), h('div.hlvt', h('b', l.label), diff(l.level)), h('div.hlvd', l.desc), h('div.hlvi', lvInfo(l)), h('div.hlvf', 'Cible ≈ ' + mins(Game.levelPar(l.level)) + ' min', done ? h('span.tag.ok', done + ' validé' + (done > 1 ? 's' : '')) : null))); }); };
  const drawM = () => { UI.clear(md); Game.MODES.forEach(m => md.append(h('button.hmd' + (sel.mode === m.id ? '.on' : ''), { on: { click: () => { sel.mode = m.id; self.lastMode = m.id; drawM(); refresh(); } } }, h('span.hmdi', UI.pixel('m_' + m.id, 4)), h('div', h('b', m.label), h('small', m.desc))))); };
  drawL(); drawM(); refresh();
  const skillSel = h('select.txt', h('option', { value: '' }, 'Toutes les compétences'), Object.keys(SIM.skills).map(id => h('option', { value: id }, SIM.skills[id].domaine + ' — ' + SIM.skills[id].label)));
  const faultSel = h('select.txt', h('option', { value: '' }, '(tirage selon le profil)'), SIM.faults.slice().sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)).map(f => h('option', { value: f.id }, 'N' + f.level + ' — ' + f.title)));
  const partsSel = h('select.txt', [2, 3, 4].map(n => h('option', { value: n, selected: n === 4 }, n + ' causes')));
  const adv = h('details.adv', h('summary', 'Options formateur (spoilers : le titre de la panne est visible)'), h('div.grid.c3', { style: { marginTop: '8px' } }, h('div', h('label.muted', 'Graine (vide = incident aléatoire)'), seedIn), h('div', h('label.muted', 'Compétence ciblée'), skillSel), h('div', h('label.muted', 'Panne précise (une seule)'), faultSel), h('div', h('label.muted', 'Niveau Chaos : nombre de causes'), partsSel)), h('small.muted', 'La graine rejoue exactement le même incident : elle est rappelée dans le débrief, avec un bouton « Rejouer cet incident ».'));
  const saveName = () => { const p = Game.profile(); p.name = nameIn.value.trim() || 'Technicien'; Game.saveProfile(p); };
  nameIn.addEventListener('change', saveName);
  const launch = () => {
    saveName(); this.lastLevel = sel.level; this.lastMode = sel.mode; this.lastSeed = seedIn.value.trim();
    this.begin({ level: sel.level, mode: sel.mode, seed: seedIn.value.trim() || randomSeed(), skill: skillSel.value || undefined, faultId: faultSel.value || undefined, parts: sel.level === 5 ? +partsSel.value : undefined });
  };
  const start = () => {
    if (firstVisit) { UI.modal('Première partie ?', h('div', UI.paras('Le tutoriel est une visite guidée de 3 minutes sur un ticket de démonstration : ticket, carte du réseau, écran et poste physique des machines, indices, journal, clôture et débrief.\n\nTu peux aussi le lancer plus tard depuis l’accueil (« Revoir le tutoriel »).')), [{ label: 'Jouer directement', fn: launch }, { label: 'Lancer le tutoriel', primary: true, fn: () => self.startTour() }]); return; }
    launch();
  };
  /* ---- colonne de droite : progression ---- */
  const notes = passed.map(x => x.total);
  const avgNote = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
  const mttrs = passed.filter(x => x.mttr).map(x => x.mttr); const avgMttr = mttrs.length ? mttrs.reduce((a, b) => a + b, 0) / mttrs.length : 0;
  const stat = (v, l) => h('div.hstat', h('b', v), h('span', l));
  const skillsRows = Object.keys(prof.skills).map(id => ({ id, ok: prof.skills[id].ok, ko: prof.skills[id].ko })).filter(r => r.ok + r.ko > 0).sort((a, b) => (b.ko - b.ok) - (a.ko - a.ok)).slice(0, 6);
  const hist = prof.history.slice(-5).reverse();
  const tagOf = x => x.stars > 0 ? h('span.tag.ok', x.perfect ? 'Parfait' : 'Validé') : h('span.tag.bad', x.kind === 'resolved' ? 'À repasser' : x.kind === 'timeout' ? 'Temps écoulé' : 'Abandonné');
  const side = h('aside.hside',
    UI.prog.profileCard(prof, self),
    h('div.hcard', h('h3', 'Progression'), h('div.hstats', stat(String(passed.length), 'validés'), stat(passed.length ? avgNote + ' / 100' : '—', 'note moyenne'), stat(avgMttr ? UI.fmtDur(avgMttr) : '—', 'MTTR moyen')),
      prof.badges.length ? h('div.hbadges', prof.badges.slice(-6).map(b => { const bd = Game.BADGES.find(x => x.id === b) || { label: b }; return h('span.tag.ok', { title: bd.desc || '' }, bd.label); })) : h('div.muted', 'Aucun badge pour l’instant.')),
    skillsRows.length ? h('div.hcard', h('h3', 'À retravailler'), skillsRows.map(r => { const tot = r.ok + r.ko; return h('div.hsk', h('div', (SIM.skills[r.id] || { label: r.id }).label), h('div.hbar', h('i', { style: { width: Math.round(100 * r.ok / tot) + '%' } })), h('small.muted', r.ok + ' réussie(s) · ' + r.ko + ' à revoir')); })) : null,
    hist.length ? h('div.hcard', h('h3', 'Derniers tickets'), hist.map(x => h('div.hhist', tagOf(x), h('span', 'N' + x.level + ' · ' + new Date(x.at).toLocaleDateString('fr-FR')), h('span.grow'), h('span.muted', UI.fmtDur(x.mttr)), h('b', x.total ? String(x.total) : '—')))) : null,
    h('div.hcard', h('h3', 'Outils'), h('div.hbtns', h('button.btn', { on: { click: () => self.startTour() } }, 'Revoir le tutoriel'), h('button.btn', { on: { click: () => self.vaultModal() } }, 'Mots de passe de l’infra'), h('button.btn', { on: { click: () => self.planModal() } }, 'Plan d’adressage'), h('button.btn', { on: { click: () => self.scenarioModal() } }, 'Scénarios formateur'), h('button.btn', { on: { click: () => UI.prog.backupModal(self) } }, 'Sauvegarde du profil'), h('button.btn.hthemebtn', { on: { click: () => self.themeModal() } }, 'Thème : ' + theme.name), h('button.btn', { on: { click: () => self.aboutModal() } }, 'À propos et limites'))));
  const TIPS = ['Lis le ticket deux fois : le demandeur ne dit jamais tout.', 'Avant de clôturer, teste depuis le poste de l’utilisateur.', 'Mode guidé : indices gratuits, parfait pour débuter.', 'En mode libre, chaque indice coûte des points : réfléchis d’abord.', 'Après un ticket, tu peux rejouer le même incident depuis le débrief.', 'Chaque action est tracée : le débrief compare ton chemin à l’optimal.', 'Une action dangereuse coûte des points, même si elle « marche ».', 'Une panne peut en cacher une autre. Vérifie tout, pas seulement le symptôme.', 'Dès Admin, un ticket peut cacher plusieurs pannes : liste les symptômes un par un.', 'Il faut ' + Game.PASS + ' / 100 pour valider. Un 100, c’est du travail propre, sans indice, dans le temps.'];
  let tipN = Math.floor(Math.random() * TIPS.length);
  const bubble = h('div.hbubble', { role: 'status' }, TIPS[tipN]);
  const cat = h('button.hcat', { title: 'Un autre conseil ?', 'aria-label': 'Mascotte : afficher un autre conseil', on: { click: () => { tipN = (tipN + 1) % TIPS.length; bubble.textContent = TIPS[tipN]; cat.classList.remove('hop'); void cat.offsetWidth; cat.classList.add('hop'); } } }, UI.pixel('cat', 7));
  /* ---- décor pixel-art : salle serveur (bandeau d'en-tête + faux plancher en bas), chats cachés dans le décor ---- */
  const found = new Set((Game.store.get('cats') || []).filter(x => typeof x === 'string'));
  const catCount = h('span.hcount', 'Chats cachés : ' + found.size + '/4');
  const wire = el => el.querySelectorAll('.hcatg').forEach(gc => {
    const id = gc.getAttribute('data-cat'); if (found.has(id)) gc.classList.add('found');
    const act = () => { if (found.has(id)) return; found.add(id); Game.store.set('cats', Array.from(found)); gc.classList.add('found'); UI.toast(found.size >= 4 ? 'Les 4 chats cachés de la salle serveur sont trouvés. Miaou !' : 'Miaou ! Chat caché trouvé (' + found.size + '/4).', 'ok'); catCount.textContent = 'Chats cachés : ' + found.size + '/4'; };
    gc.addEventListener('click', act); gc.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
  const band = h('div.hband'); band.innerHTML = UI.sceneSvg('top', theme).html; wire(band);
  const floor = h('div.hfloor'); floor.innerHTML = UI.sceneSvg('bottom', theme).html; wire(floor);
  const hero = h('header.hhero', band, h('div.hheroin', h('div.hmasc', cat, bubble), h('div.grow.htitle', h('h1', h('span.glitch', { 'data-t': 'EDIVN_LAB' }, 'EDIVN_LAB'), h('i.hcur')), h('div.hsub', 'Le ticket est flou, la panne est réelle. ', h('b', 'À toi de la trouver.'))), h('div.hwho', h('label.muted', 'Technicien'), nameIn, h('button.btn.small.hthemetop', { title: 'Changer le thème de l’interface', on: { click: () => self.themeModal() } }, '🎨 ' + theme.name))));
  const tuto = firstVisit ? h('div.htuto', h('div.htutoi', UI.icon('question', 26)), h('div.grow', h('b', 'Première visite ?'), h('div', 'Fais le tutoriel interactif (3 min) : il te montre l’interface sur un vrai ticket, sans stress.')), h('button.btn.primary', { on: { click: () => self.startTour() } }, 'Lancer le tutoriel')) : null;
  const main = h('div.hmain',
    h('section', h('h2', h('span.hn', '1'), 'Choisis ta difficulté'), lv),
    h('section', h('h2', h('span.hn', '2'), 'Comment tu joues ?'), md),
    h('section', adv));
  const cta = h('div.hcta', sum, h('button.btn.primary.hgo', { on: { click: start } }, h('span', 'Prendre le ticket'), h('i.hgoa', '▶')));
  /* trois entrées : Campagne (mise en avant), Astreinte, Bac à sable (le jeu d'origine, tout ouvert) */
  const left = UI.camp.homeLeft(self, prof, { sandbox: [main, cta], daily: () => UI.prog.dailyCard(prof, self) });
  const scr = h('div.screen.home', h('div.hwrap', hero, tuto, h('div.hcols', left, side), h('div.muted.hfoot', h('span', SIM.faults.length + ' pannes au catalogue · simulateur de pannes d’infrastructure, consoles et journaux fidèles aux systèmes réels · pixel-art et icônes originaux, aucune police ni capture d’éditeur tiers.'), catCount), floor));
  root.append(scr);
};

P.themeModal = function () {
  const self = this; const cur = UI.themes.saved(); let mm = null; const prof = Game.profile();
  const card = t => h('div.thcard' + (t.id === cur ? '.on' : ''), { style: '--t1:' + t.vars['--bg'] + ';--t2:' + t.vars['--panel2'] + ';--t3:' + t.vars['--hv'] + ';--t4:' + t.vars['--hc'] + ';--t5:' + t.vars['--text'] },
    h('div.thprev', h('i'), h('i'), h('i'), h('i'), h('i')), h('b', t.name), t.id === cur ? h('span.tag.ok', 'actuel') : null, h('div.muted', t.desc),
    h('div.row', { style: { marginTop: '8px' } }, SIM.prog.themeOwned(prof, t.id) ? h('button.btn.small.primary', { on: { click: () => { UI.themes.apply(t.id, true); if (mm) mm.close(); self.home(); } } }, t.id === cur ? 'Garder' : 'Appliquer') : h('button.btn.small', { title: 'Se débloque dans l’arbre de compétences (branche Style)', on: { click: () => { if (mm) mm.close(); UI.prog.screen(self, 'tree'); } } }, '🔒 Débloquer dans l’arbre'), h('button.btn.small', { title: 'Aperçu de l’animation affichée pour une note de 100 / 100', on: { click: () => UI.themes.celebrate(t.id, 100) } }, 'Voir l’animation du 100')));
  mm = UI.modal('Thème de l’interface', h('div', h('p.muted', 'Le thème change l’accueil, la barre de jeu, le ticket et le débrief. Les consoles (Windows, Cisco, pfSense, terminaux) ne changent jamais : elles restent fidèles aux vrais systèmes.'), h('div.thgrid', UI.themes.list.map(card))), [{ label: 'Fermer', primary: true }]);
};

P.vaultModal = function () { UI.infra.modal(this, 'creds'); };
P.planModal = function () { UI.infra.modal(this, 'plan'); };
P.aboutModal = function () {
  UI.modal('À propos et limites connues', h('div', UI.paras('Les consoles reproduisent les interfaces d’origine (invite de commandes, PowerShell, bash, Cisco IOS, consoles MMC, interface pfSense). Chaque sortie est calculée depuis l’état du réseau simulé : aucun symptôme n’est écrit à l’avance.\n\nLes détails techniques non confirmés par une capture (Event ID, libellés, formats) sont listés dans le registre « à vérifier » livré avec le jeu (docs/A-VERIFIER.md).\n\nLimites : horloges en UTC ; polices système ; certaines commandes de diagnostic sont approximatives (voir docs/LIMITES.md).')), [{ label: 'Fermer', primary: true }]);
};

/* ------------------------------------------------------------------ scénarios formateur (JSON déclaratif, sans code) */
P.loadCustom = function () {
  const raw = Game.store.get('scenarios'); const list = Array.isArray(raw) ? raw : []; const keep = [];
  list.forEach(def => { let ok = false; try { ok = !!def && typeof def === 'object' && SIM.fault.validate(def).ok && !SIM.faults.some(f => f.id === def.id); } catch (e) { ok = false; } if (ok) { SIM.faults.push(def); keep.push(def); } });
  if (raw !== null && (!Array.isArray(raw) || keep.length !== list.length)) Game.store.set('scenarios', keep);
};
P.storedScenarios = function () { const l = Game.store.get('scenarios'); return Array.isArray(l) ? l.filter(d => d && typeof d === 'object' && typeof d.id === 'string') : []; };
P.customIds = function () { return this.storedScenarios().map(d => d.id); };
P.downloadJson = function (name, data) {
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
};
P.scenarioModal = function () {
  const self = this; const out = h('div', { style: { marginTop: '10px' } });
  const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  const show = (res, name) => {
    UI.clear(out);
    out.append(h('div.' + (res.ok ? 'tag.ok' : 'tag.bad'), res.ok ? 'Scénario « ' + name + ' » importé et prêt à jouer (liste « Options formateur » de l’accueil).' : 'Scénario refusé : ' + res.errors.length + ' erreur(s)'));
    (res.errors || []).forEach(e => out.append(h('div', { style: { margin: '4px 0', color: '#ff8a8a', fontSize: '12.5px' } }, '✗ ' + e)));
    (res.warnings || []).forEach(e => out.append(h('div', { style: { margin: '4px 0', color: '#e8c36a', fontSize: '12.5px' } }, '⚠ ' + e)));
  };
  const importDefs = (defs) => {
    if (!Array.isArray(defs)) defs = [defs];
    if (defs.length > 50) { show({ ok: false, errors: ['trop de scénarios dans un même fichier (' + defs.length + ', maximum 50)'], warnings: [] }); return; }
    const stored = self.storedScenarios(); let okN = 0; const allErr = [], allWarn = [];
    defs.forEach(def => { const r = SIM.fault.importScenario(def); if (r.ok) { stored.push(def); okN++; } else allErr.push((def && def.id ? def.id + ' : ' : '') + r.errors.join(' ; ')); (r.warnings || []).forEach(w => allWarn.push((def && def.id ? def.id + ' : ' : '') + w)); });
    Game.store.set('scenarios', stored); show({ ok: !allErr.length, errors: allErr, warnings: allWarn }, okN + ' scénario(s)');
  };
  file.addEventListener('change', () => {
    const f = file.files && file.files[0]; if (!f) return;
    if (f.size > 2000000) { show({ ok: false, errors: ['fichier trop volumineux (' + Math.round(f.size / 1024) + ' Ko, maximum 2 000 Ko)'], warnings: [] }); file.value = ''; return; }
    const rd = new FileReader();
    rd.onload = () => { let defs; try { defs = JSON.parse(String(rd.result)); } catch (e) { show({ ok: false, errors: ['fichier JSON illisible : ' + e.message], warnings: [] }); return; } importDefs(defs); };
    rd.readAsText(f); file.value = '';
  });
  const mine = this.customIds();
  const rows = mine.length ? h('div', h('h3', 'Scénarios importés'), mine.map(id => h('div.row', { style: { margin: '3px 0' } }, h('code', id), h('button.btn.small', { on: { click: () => { Game.store.set('scenarios', (Game.store.get('scenarios') || []).filter(d => d.id !== id)); const i = SIM.faults.findIndex(d => d.id === id); if (i >= 0) SIM.faults.splice(i, 1); mm.close(); self.scenarioModal(); } } }, 'Retirer')))) : h('div.muted', 'Aucun scénario importé.');
  const mm = UI.modal('Scénarios formateur', h('div',
    UI.paras('Un scénario est un fichier JSON : brief du ticket, cause racine, étapes d’injection, sondes (symptômes), corrections valides, pièges, chemin optimal et compétences travaillées. Aucun code à écrire.\n\nÀ l’import, le moteur joue le scénario complet sur un réseau sain : sondes au vert avant la panne, au rouge après l’injection, retour au vert avec chaque correction déclarée. Un scénario qui ne passe pas ce contrôle est refusé avec la raison.'),
    h('div.row', h('button.btn.primary', { on: { click: () => file.click() } }, 'Importer un fichier JSON…'), h('button.btn', { on: { click: () => self.downloadJson('scenario-modele.json', Object.assign({}, SIM.faults.find(d => d.id === 'dhcp_scope_off'), { id: 'mon_scenario', title: 'Mon scénario (modèle)' })) } }, 'Télécharger un modèle'), h('button.btn', { on: { click: () => self.downloadJson('catalogue-scenarios.json', SIM.faults) } }, 'Exporter tout le catalogue')),
    file, rows, out), [{ label: 'Fermer', primary: true, fn: () => self.home() }]);
};

/* ------------------------------------------------------------------ partie */
P.begin = function (opts) {
  let run;
  if (opts.report === undefined) opts = Object.assign({ report: !this.legacy }, opts);
  try { run = new UI.Run(opts); } catch (e) { UI.modal('Impossible de préparer l’incident', h('p', String(e.message)), [{ label: 'Retour', primary: true }]); if (typeof console !== 'undefined') console.error(e); return; }
  if (this.run && this.run !== run) { try { this.run.stop(); } catch (e) { /* l'ancienne partie est abandonnée */ } }   // pas de minuteurs ni de surfaces orphelins en cas de « Rejouer »
  this.run = run; const m = run.m; const self = this;
  const root = UI.clear(this.root);
  const timer = h('span.timer', '00:00'); const pillSite = h('span.pill', '');
  const btnHint = h('button.btn.small', { on: { click: () => self.hint() } }, 'Indice');
  const btnClose = h('button.btn.small.primary', { on: { click: () => self.closeTicket() } }, 'Clôturer le ticket');
  const btnGive = h('button.btn.small.danger', { on: { click: () => UI.modal('Abandonner ?', h('p', 'Le ticket sera clos sans résolution et le débrief affichera la cause.'), [{ label: 'Continuer à chercher' }, { label: 'Abandonner', danger: true, fn: () => { m.giveUp(); run.finish(); } }]) } }, 'Abandonner');
  const bar = h('div.gbar', h('div.brand', UI.svg(UI.iconSvg('network'), 22), 'EDIVN Lab'), h('span.pill', h('b', run.id)), m.camp ? h('span.pill.campill', 'Chapitre ', h('b', String(m.camp.ch)), m.camp.exam ? ' · examen' : m.camp.review ? ' · révision' : '') : h('span.pill', 'Niveau ', h('b', m.lv.label)), h('span.pill', h('b', m.mode.label)), h('div.grow'), timer, btnHint, btnClose, btnGive, UI.prog.notesAvailable(run) ? h('button.btn.small', { title: 'Carnet de bord de ce ticket', on: { click: () => UI.prog.notesModal(run) } }, UI.icon('note', 14), ' Carnet') : null, h('button.btn.small', { on: { click: () => self.vaultModal() } }, 'Identifiants'), h('button.btn.small', { title: 'Plan d’adressage attendu (IP, masques, passerelles, DNS)', on: { click: () => self.planModal() } }, 'Adressage'));
  const t = m.fault.ticket;
  const ticket = h('div.card.ticket', h('h3', 'Ticket ' + run.id + (m.daily ? ' · ticket du jour' : '')), h('div.from', 'De : ' + t.from), h('div.subject', t.subject), h('div.body', t.body), UI.camp.verifBox(m), UI.prog.goalsBox(run));
  const hintsBox = h('div'); const guide = h('div'); const log = h('div.actlog');
  const guideCard = m.mode.steps ? h('div.card', h('h3', 'Assistant pas à pas'), guide) : null;
  const side = h('div.side', ticket, guideCard, h('div.card', h('h3', 'Indices'), hintsBox), h('div.card', h('h3', 'Journal de vos actions'), log));
  const tabs = h('div.tabs'); const view = h('div.view');
  const stage = h('div.stage', tabs, view);
  root.append(bar, h('div.main', side, stage));
  /* onglets */
  const siteIds = ['toulouse', 'bordeaux', 'ramonville', 'labege', 'colomiers', 'exterieur'].filter(s => !run.scope || run.scope.sites.indexOf(s) >= 0);
  const mv = new UI.MapView(run, (id, what) => openDev(id, what));
  const open = []; let current = null;
  const tabEls = {};
  const render = () => {
    UI.clear(tabs);
    siteIds.forEach(sid => tabs.append(h('div.tab' + (current === 'site:' + sid ? '.on' : ''), { on: { click: () => select('site:' + sid) } }, UI.icon('network', 14), UI.SITES[sid].label)));
    tabs.append(h('div', { style: { width: '14px' } }));
    open.forEach(o => tabs.append(h('div.tab' + (current === o.key ? '.on' : ''), { on: { click: () => select(o.key) } }, UI.icon(o.icon, 14), o.label, h('span.x', { title: 'Fermer l’onglet', on: { click: ev => { ev.stopPropagation(); closeTab(o.key); } } }, '✕'))));
    tabs.append(h('div.spacer'));
  };
  const select = key => {
    current = key; UI.clear(view);
    if (key.indexOf('site:') === 0) { view.append(mv.siteView(key.slice(5))); }
    else { const o = open.find(x => x.key === key); if (o) { view.append(o.el); if (o.focus) setTimeout(o.focus, 20); } }
    render();
  };
  const closeTab = key => { const i = open.findIndex(x => x.key === key); if (i >= 0) open.splice(i, 1); select(current === key ? ('site:' + siteOf(firstSite)) : current); };
  const siteOfDev = id => { for (const sid of siteIds) if (UI.SITES[sid].nodes.some(n => n[0] === id)) return sid; return 'toulouse'; };
  let firstSite = 'toulouse';
  const openDev = (id, what) => {
    if (what === 'patch') {
      let o = open.find(x => x.key === 'dev:PATCH-T');
      if (!o) { const el = UI.Rig && UI.Rig.patchPanel ? UI.Rig.patchPanel(run) : h('div.pad', 'Baie indisponible'); o = { key: 'dev:PATCH-T', label: 'Baie de brassage', icon: 'patch', el }; open.push(o); run.act('PATCH-T', 'Ouverture de la baie de brassage', { kind: 'physical' }); }
      select(o.key); return;
    }
    let o = open.find(x => x.key === 'dev:' + id);
    if (!o) {
      const s = run.surface(id); const d = run.W.d(id);
      o = { key: 'dev:' + id, label: id, icon: d.kind === 'win' ? (/Server/i.test(d.os || '') ? 'server' : 'pc') : d.kind === 'linux' ? 'linux' : d.kind === 'pf' ? 'firewall' : d.kind === 'ios-rt' ? 'router' : d.kind === 'printer' ? 'printer' : 'switch', el: s.el, focus: () => s.focus && s.focus(), surf: s };
      open.push(o);
    }
    select(o.key);
    if (what === 'rig' && o.surf && o.surf.frame) o.surf.frame.show('rig'); else if (o.surf && o.surf.frame) o.surf.frame.show('main');
    run.act(id, 'Accès à ' + id + (what === 'rig' ? ' (poste physique)' : ''), { kind: 'nav' });
  };
  this.openDev = openDev;
  /* événements */
  const tick = () => {
    if (run.ended) return;
    const rem = m.remainingSec();
    const sec = rem === null ? m.elapsedSec() : rem;
    timer.textContent = UI.fmtDur(sec); timer.classList.toggle('low', rem !== null && rem < 60);
    if (rem !== null && rem <= 0) run.check();
  };
  run.on('clock', tick); tick();
  const drawLog = () => {
    UI.clear(log); const items = m.trace.slice(-9).reverse();
    if (!items.length) log.append(h('div.muted', 'Aucune action pour l’instant.'));
    items.forEach(e => log.append(h('div.lg', h('span.t', UI.fmtDur(e.t)), h('span.d', e.dev || ''), h('span.x', (e.text || '').slice(0, 60)), (e.cls === 'progress' ? h('span.tag.ok', '▲') : e.cls === 'regress' ? h('span.tag.bad', '▼') : e.cls === 'detour' ? h('span.tag.warn', '≈') : null))));
  };
  const drawGuide = () => {
    if (!guideCard) return; UI.clear(guide); const steps = m.guideSteps(); const n = m.guided.opened.length;
    steps.slice(0, n).forEach(s => guide.append(h('div.stepitem', s.text)));
    if (n < steps.length) guide.append(h('button.btn.small', { style: { marginTop: '6px' }, on: { click: () => { m.guided.opened.push(1); drawGuide(); } } }, n ? 'Étape suivante' : 'Voir la première étape'));
    else guide.append(h('div.muted', 'Toutes les étapes sont affichées.'));
    if (!steps.length) guide.append(h('div.muted', 'Pas de pas-à-pas pour cette panne.'));
  };
  run.on('act', () => drawLog()); drawLog(); drawGuide();
  run.on('report', (mm, spec) => UI.camp.reportModal(self, run, spec));
  run.on('end', (mm, rec) => self.debrief(mm, rec));
  this.drawHints = () => { UI.clear(hintsBox); if (m.mode.noHints) hintsBox.append(h('div.muted', 'Indices désactivés en évaluation chronométrée.')); else if (!m.hintLog.length) hintsBox.append(h('div.muted', m.mode.hintsFree ? 'Indices gratuits en mode guidé.' : 'Chaque indice coûte des points sur 100 (' + Game.HINT_COST.map(c => '−' + c).join(' / ') + ').')); m.hintLog.forEach(x => hintsBox.append(h('div.hintbox', h('b', 'Indice ' + x.n + ' — '), x.text))); btnHint.disabled = !!m.mode.noHints || m.hintsUsed >= 3; };
  this.drawHints();
  /* site de départ */
  const ts = t.site; firstSite = Array.isArray(ts) ? ts[0] : ts; if (!UI.SITES[firstSite] || siteIds.indexOf(firstSite) < 0) firstSite = siteIds[0];
  const siteOf = x => x;
  select('site:' + firstSite);
  /* bandeau d'accueil du ticket */
  UI.toast('Nouveau ticket ' + run.id + ' : ' + t.subject, 'ok', 6000);
  if (opts.tour && UI.Tour) setTimeout(() => UI.Tour.start(self, run), 350);
};

P.hint = function () {
  const run = this.run, m = run.m; const r = m.hint();
  if (r.denied) { UI.toast(r.why, 'warn'); return; }
  if (r.none) { UI.toast('Plus d’indice disponible.', 'warn'); return; }
  if (r.cost) UI.toast('Indice ' + r.n + ' : −' + r.cost + ' points', 'warn', 3500);
  this.drawHints();
};
P.closeTicket = function () {
  const run = this.run, m = run.m; const r = m.close();
  if (r.ok || r.already) { run.finish(); return; }
  UI.modal('Le ticket est rouvert', h('p', r.message), [{ label: 'Reprendre', primary: true }]);
  run.emit('act', { text: 'Clôture refusée' }, null);
};

/* ------------------------------------------------------------------ débrief */
P.debrief = function (m, rec) {
  const d = m.debrief(); const r = d.result; const self = this; const root = UI.clear(this.root);
  const ok = r.passed;
  const head = r.perfect ? 'Ticket parfait' : r.passed ? 'Ticket validé' : r.kind === 'resolved' ? 'Ticket résolu, mais à repasser' : r.kind === 'timeout' ? 'Temps écoulé : à repasser' : 'Ticket abandonné : à repasser';
  const sc = r.score;
  const line = (k, v) => v ? h('tr', h('td', k), h('td', { style: { textAlign: 'right' } }, (v > 0 ? '+' : '') + v)) : null;
  const tl = d.path.timeline;
  const cls = c => c === 'progress' ? h('span.tag.ok', 'progrès') : c === 'regress' ? h('span.tag.bad', 'recul') : c === 'detour' ? h('span.tag.warn', 'sans effet') : c === 'false-close' || c === 'wrong-close' ? h('span.tag.bad', 'clôture refusée') : h('span.tag', 'lecture');
  const scr = h('div.screen',
    h('div.row', UI.svg(UI.iconSvg(ok ? 'check' : 'warning'), 40), h('div', h('h1', head), h('div.muted', 'Ticket ' + this.run.id + ' — ' + d.fault.title), h('div.muted.dseed', 'Graine de l’incident : ', h('code', m.seed), ' ', h('button.btn.small', { title: 'Copier la graine', on: { click: () => { try { try { navigator.clipboard.writeText(m.seed).then(() => UI.toast('Graine copiée.', 'ok'), () => UI.toast('Copie impossible : sélectionne la graine et copie-la à la main.', 'warn')); } catch (e) { UI.toast('Copie impossible : sélectionne la graine et copie-la à la main.', 'warn'); } } catch (e) { UI.toast('Copie impossible : graine ' + m.seed, 'warn'); } } } }, 'Copier')))),
    h('div.grid.c3', { style: { marginTop: '14px' } },
      h('div.card.dnote' + (r.passed ? '.ok' : '.ko'), h('h3', 'Note'), h('div.stars', { style: { fontSize: '22px' }, 'aria-label': (r.stars || 0) + ' étoile(s) sur 3' }, UI.stars(r.stars || 0)), h('div', { style: { fontSize: '30px', fontWeight: 800 } }, r.total, h('small.muted', ' / 100'), ' ', h('span.tag' + (r.passed ? '.ok' : '.bad'), r.tier)), h('div.muted', r.passed ? 'Validé (seuil ' + Game.PASS + ')' : 'Seuil de validation : ' + Game.PASS + ' / 100'), h('div.muted', r.ranked ? 'Partie classée' : 'Mode guidé : non classé')),
      h('div.card', h('h3', 'Temps de résolution (MTTR)'), h('div', { style: { fontSize: '26px', fontWeight: 700 } }, UI.fmtDur(d.mttrSec)), h('div.muted', 'Temps cible ' + UI.fmtDur(d.parSec) + (d.firstFixedSec !== null ? ' — correction effective à ' + UI.fmtDur(d.firstFixedSec) : ''))),
      h('div.card', h('h3', 'Démarche'), h('div', d.path.actions + ' actions, ' + d.path.counters.change + ' modifications'), h('div.muted', d.path.counters.progress + ' progrès, ' + d.path.counters.detour + ' sans effet, ' + d.path.counters.regress + ' reculs'), h('div.muted', d.hints.length + ' indice(s), ' + d.wrongCloses + ' clôture(s) refusée(s)'))),
    UI.camp.debriefCamp(self, rec && rec.camp),
    UI.prog.debriefPanel(rec && rec.prog),
    UI.camp.debriefReport(r.report),
    h('h2', 'Cause racine et correction'),
    h('div.card', d.fault.parts.length > 1 ? d.fault.parts.map((p, i) => h('div', { style: { marginBottom: '8px' } }, h('b', (i + 1) + '. ' + p.title), h('div', p.cause), h('div.muted', 'Correction : ' + p.solution))) : [h('div', d.fault.cause), h('div.muted', { style: { marginTop: '4px' } }, 'Correction : ' + d.fault.solution)]),
    d.closeRefusals && d.closeRefusals.length ? [h('h2', 'Pourquoi la clôture a été refusée'), h('div.card', [...new Set(d.closeRefusals.map(x => x.note))].map(x => h('div', x)))] : null,
    d.fault.traps.length ? [h('h2', 'Pièges de ce scénario'), h('div.card', d.fault.traps.map(x => h('div', '• ' + x)))] : null,
    h('h2', 'Chemin suivi et chemin optimal'),
    h('div.grid.c2', h('div.card', h('h3', 'Chemin optimal'), d.path.optimal.map((s, i) => h('div', (i + 1) + '. ' + s))), h('div.card', h('h3', 'Impasses (modifications sans effet ou régressions)'), d.path.deadEnds.length ? d.path.deadEnds.slice(0, 10).map(x => h('div', h('span.muted', UI.fmtDur(x.t) + ' '), (x.dev ? x.dev + ' — ' : '') + x.text)) : h('div.muted', 'Aucune.'))),
    d.sideEffects && d.sideEffects.length ? [h('h2', 'Effets de bord de tes actions'), h('div.card', d.sideEffects.map(x => h('div', h('span.muted', UI.fmtDur(x.t) + ' '), h('span.tag.warn', 'Blocage'), ' Ton action « ', h('code', x.text), ' »' + (x.dev ? ' (' + x.dev + ')' : '') + ' a déclenché la règle Snort SID ' + x.sid + (x.msg ? ' (« ' + x.msg + ' »)' : '') + ' et fait inscrire ' + (x.host || 'l’hôte') + ' (' + x.ip + ') dans la table des hôtes bloqués de ' + x.on + '. Un hôte bloqué n’atteint plus rien : le test a bloqué celui qui le lance.')))] : null,
    d.aids && d.aids.length ? [h('h2', 'Aides consultées'), h('div.card', h('div.muted', 'Tracées pour information : aucun point n’est retiré.'), d.aids.map(x => h('div', h('span.muted', UI.fmtDur(x.t) + ' '), x.kind === 'plan' ? 'Plan d’adressage' : 'Aide-mémoire des commandes')))] : null,
    d.dangers.length || d.impacts.length ? [h('h2', 'Actions dangereuses ou à impact'), h('div.card', d.dangers.map(x => h('div', h('span.tag.bad', 'Danger'), ' ', h('b', x.label), ' — ', x.why)), d.impacts.map(x => h('div', h('span.tag.warn', 'Impact'), ' ', x.text, ' ', h('span.muted', '(' + x.kind + ')'))))] : null,
    h('h2', 'Compétences travaillées'),
    h('div.card', d.skills.map(s => h('div', h('span.tag' + (s.ok ? '.ok' : '.warn'), s.ok ? 'maîtrisée sur ce ticket' : 'à revoir'), ' ', h('b', s.label), s.why.length ? h('span.muted', ' — ' + s.why.join(' ; ')) : null))),
    d.review.length ? [h('h2', 'Notions à revoir'), h('div.card', d.review.map(x => h('div', '• ', h('b', x.label), ' : ', x.why.join(' ; '))))] : null,
    r.passed ? null : self.courseLinks(d),
    h('h2', 'Barème'),
    h('div.card', h('table.tbl', h('tbody', h('tr', h('td', 'Départ'), h('td', { style: { textAlign: 'right' } }, sc.start)), line('Panne non résolue (plafond)', sc.unsolved), line('Pénalité de durée (temps cible ' + UI.fmtDur(d.parSec) + ')', sc.time), line('Indices', sc.hints), line('Actions dangereuses', sc.danger), line('Actions à impact', sc.impact), line('Clôtures prématurées', sc.wrongClose), line('Contournement pris pour une résolution', sc.falseRes), line('Fiche d’intervention (cause ou correction mal identifiée)', sc.report), h('tr', h('td', h('b', 'Note')), h('td', { style: { textAlign: 'right' } }, h('b', r.total + ' / 100'))))), h('small.muted', 'Validé à partir de ' + Game.PASS + '. La durée seule ne peut pas faire passer sous ' + Game.PASS + ' une résolution propre (sans indice, sans action dangereuse, sans clôture prématurée).')),
    h('h2', 'Historique complet des actions'),
    h('div.card', { style: { maxHeight: '260px', overflow: 'auto' } }, tl.length ? h('table.tbl', h('tbody', tl.map(x => h('tr', h('td.muted', UI.fmtDur(x.t)), h('td', x.dev || ''), h('td', x.text || ''), h('td', cls(x.cls)))))) : h('div.muted', 'Aucune action enregistrée.')),
    h('div.row', { style: { margin: '20px 0 40px' } },
      UI.camp.debriefNext(self, m, rec && rec.camp),
      h('button.btn' + (m.camp ? '' : '.primary'), { on: { click: () => m.camp ? self.begin(Object.assign({}, self.run.opts)) : self.begin({ daily: m.daily, level: m.lv.level, mode: m.mode.id, seed: m.seed, faultId: m.fault.bundle ? undefined : m.fault.id, skill: m.opts.skill, parts: m.opts.parts, chain: m.opts.chain }) } }, 'Rejouer cet incident'),
      h('button.btn', { on: { click: () => { self.lastSeed = ''; self.home(); } } }, m.camp ? 'Retour à l’accueil' : 'Nouveau ticket'),
      h('button.btn', { on: { click: () => self.exportTrace(m, d) } }, 'Exporter la trace (JSON)')));
  root.append(scr);
  if (r.perfect) UI.themes.celebrate(UI.themes.saved(), r.total);
};

/* Liens de révision (échec : note < 75, abandon ou temps écoulé) vers le site de cours de la formation ; table statique, hôte fixe. */
P.courseLinks = function (d) {
  const L = SIM.courseLinks; const groups = L.forSkills(d.skills.map(s => s.id), 8);
  return [h('h2', 'À réviser avant de repasser ce ticket'),
    h('div.card.dcourses', h('div.muted', 'Pages de la formation correspondant aux compétences de cette panne (site de cours ' + L.host.replace('https://', '') + ', connexion internet nécessaire ; le jeu lui-même reste hors ligne).'),
      groups.map(gp => h('div.dcg', h('b', gp.label), h('div.dcl', gp.links.map(l => h('a.btn.small', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, h('span.tag', l.kind), ' ', l.label)))))) ];
};
P.exportTrace = function (m, d) {
  const blob = new Blob([JSON.stringify({ ticket: this.run.id, seed: m.seed, level: m.lv.id, mode: m.mode.id, fault: d.fault.id, result: d.result, timeline: d.path.timeline, dangers: d.dangers, hints: d.hints }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'trace-' + this.run.id + '.json' }); document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
