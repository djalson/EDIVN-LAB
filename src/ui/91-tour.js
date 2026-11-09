/* ============================================================================
   Tutoriel de prise en main : visite guidée (projecteur + carte d'explication) jouée sur un vrai
   ticket de démonstration en mode guidé. Non bloquant : les éléments éclairés restent cliquables.
   Proposé à la première partie ; rejouable depuis l'accueil. Textes originaux.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, Game = SIM.game, h = UI.h;
const P = UI.App.prototype;

P.startTour = function () { this.begin({ level: 1, mode: 'guided', seed: 'tuto', faultId: 'phys_eth', tour: true }); };

const byText = (sel, txt) => Array.from(document.querySelectorAll(sel)).find(e => (e.textContent || '').trim().indexOf(txt) === 0) || null;
const done = () => { const p = Game.profile(); p.tourDone = true; const res = SIM.prog.award(p); Game.saveProfile(p); if (UI.prog) UI.prog.toastBump(res); };

UI.Tour = {
  steps(run) {
    const host = ((run.m.parts[0].vars || {}).c || {}).host || 'PC-01';
    const q = s => () => document.querySelector(s);
    return [
      { title: 'Bienvenue dans EDIVN Lab', text: 'Tu es technicien d’un petit système d’information (Toulouse, Bordeaux, Ramonville). Un utilisateur t’envoie un ticket ; à toi de comprendre la panne et de la réparer avec les vrais outils, comme en entreprise.\n\nCette visite dure environ 3 minutes. Tu peux la quitter à tout moment.' },
      { title: 'Le ticket', text: 'Voici le message de l’utilisateur, tel qu’il l’a écrit : vague, parfois imprécis ou trompeur. Commence toujours par le relire et par reformuler le problème.', target: q('.side .ticket'), place: 'right' },
      { title: 'Chronomètre et mode', text: 'Le temps écoulé (MTTR) compte pour le score. En mode guidé il n’y a pas de limite ; en évaluation chronométrée un compte à rebours s’affiche.', target: q('.gbar .timer'), place: 'bottom' },
      { title: 'Indices', text: 'Trois indices, du plus vague au plus précis. Ils sont gratuits en mode guidé, payants en mode libre, absents en évaluation.', target: () => byText('.gbar .btn', 'Indice'), place: 'bottom' },
      { title: 'Assistant pas à pas', text: 'Uniquement en mode guidé : une méthode de diagnostic étape par étape, sans donner la réponse. Essaie-le plus tard si tu bloques.', target: () => byText('.side .card', 'Assistant'), place: 'right' },
      { title: 'Journal de tes actions', text: 'Chaque action est tracée : ce que tu ouvres, tapes ou modifies. Le débrief final s’en sert pour comparer ton chemin au chemin optimal et signaler les impasses et les actions dangereuses.', target: q('.side .actlog'), place: 'right' },
      { title: 'La carte, par site', text: 'Un onglet par site. Chaque icône est une machine ou un équipement réseau. Les liens montrent le câblage logique.', target: q('.tabs .tab'), place: 'bottom' },
      { title: 'Choisis une machine', text: 'Le ticket vient d’un poste de travail. Clique sur « ' + host + ' » pour ouvrir son menu.', target: () => document.querySelector('.node[title="' + host + '"]'), place: 'left', wait: () => !!document.querySelector('.pop') },
      { title: 'Écran ou poste physique', text: 'Chaque machine a deux faces : « l’écran » (ce que voit l’utilisateur : bureau, console…) et « le poste physique » (arrière de l’unité, câbles, alimentation, écran, prises murales). Certaines pannes sont purement matérielles !\n\nClique sur la première entrée pour ouvrir l’écran.', target: q('.pop'), place: 'left', wait: () => !!document.querySelector('.tabs .tab.on .x') },
      { title: 'Basculer entre les deux faces', text: 'Cette barre te permet de passer à tout moment de l’écran au poste physique de la machine. Le poste physique reflète l’état réel : câble débranché, prise inactive, alimentation coupée…', target: q('.frame .fbar'), place: 'bottom' },
      { title: 'Un vrai bureau', text: 'Ce que tu vois est une réplique des interfaces réelles : barre des tâches, menu Démarrer (clic sur la zone en bas à gauche), clic droit, fenêtres déplaçables, invite de commandes, panneau de configuration, etc. Les serveurs ont leurs consoles d’administration ; les équipements réseau, pfSense et Linux ont leurs terminaux.\n\nLes commandes sont réellement interprétées : ipconfig, ping, ls, show running-config… Les sorties dépendent de l’état du réseau.', target: q('.frame .fbody'), place: 'center' },
      { title: 'Identifiants', text: 'Pour intervenir comme dans la réalité il faut des comptes : le bouton regroupe ceux du technicien. Utilise le compte le moins privilégié qui suffit : une action dangereuse avec un compte trop puissant sera signalée au débrief.', target: () => byText('.gbar .btn', 'Identifiants'), place: 'bottom' },
      { title: 'Clôturer le ticket', text: 'Quand tu penses avoir réparé, clique ici. Le moteur vérifie depuis le poste de l’utilisateur que la panne a réellement disparu : un contournement (IP statique par exemple) ou une fausse résolution sont détectés. Clôturer trop tôt coûte des points sur ta note (validée à partir de 75 / 100).', target: () => document.querySelector('.gbar .btn.primary'), place: 'bottom' },
      { title: 'À toi de jouer', text: 'Ce ticket est le tien : l’utilisatrice voit « une petite croix » sur l’icône réseau. Teste d’abord depuis son poste (écran), puis regarde du côté physique. Pense à vérifier que tout fonctionne avant de clôturer (ping, ouverture d’un dossier partagé).\n\nBon courage !', last: true }
    ];
  },
  start(app, run) {
    this.stop(); const steps = this.steps(run); let i = 0; let timer = null; let stopped = false; const self = this;
    const shade = h('div.tshade'); const card = h('div.tcard', { role: 'dialog', 'aria-label': 'Tutoriel' });
    document.body.append(shade, card);
    const finish = (quit) => { stopped = true; clearInterval(timer); shade.remove(); card.remove(); document.removeEventListener('keydown', onKey, true); done(); self.cur = null; if (quit === 'home') app.home(); };
    const target = () => { const s = steps[i]; try { return s.target ? s.target() : null; } catch (e) { return null; } };
    const place = () => {
      if (stopped) return; const s = steps[i]; const el = target(); const vw = innerWidth, vh = innerHeight;
      if (!el || !el.getBoundingClientRect || !el.isConnected) { shade.style.cssText = 'left:50%;top:50%;width:0;height:0;'; card.style.left = Math.max(10, (vw - card.offsetWidth) / 2) + 'px'; card.style.top = Math.max(10, (vh - card.offsetHeight) / 3) + 'px'; return; }
      const r = el.getBoundingClientRect(); const pad = 6;
      shade.style.left = (r.left - pad) + 'px'; shade.style.top = (r.top - pad) + 'px'; shade.style.width = (r.width + 2 * pad) + 'px'; shade.style.height = (r.height + 2 * pad) + 'px';
      const cw = card.offsetWidth, ch = card.offsetHeight; let x, y;
      if (s.place === 'right') { x = r.right + 16; y = r.top; } else if (s.place === 'left') { x = r.left - cw - 16; y = r.top; } else if (s.place === 'bottom') { x = r.left; y = r.bottom + 16; } else { x = r.left + r.width / 2 - cw / 2; y = r.top + r.height / 2 - ch / 2; }
      if (x + cw > vw - 10) x = vw - cw - 10; if (x < 10) x = 10; if (y + ch > vh - 10) y = vh - ch - 10; if (y < 10) y = 10;
      card.style.left = x + 'px'; card.style.top = y + 'px';
    };
    const draw = () => {
      const s = steps[i]; UI.clear(card);
      const dots = h('div.tdots', steps.map((_, k) => h('i' + (k === i ? '.on' : k < i ? '.past' : ''))));
      card.append(...[h('div.tkick', 'Tutoriel · étape ' + (i + 1) + ' / ' + steps.length), h('h3', s.title), UI.paras(s.text), s.wait ? h('div.twait', '▶ Fais l’action indiquée pour continuer (ou clique sur Suivant).') : null, dots,
        h('div.tbtns', s.last ? null : h('button.btn.small.tskip', { on: { click: () => finish() } }, 'Passer le tutoriel'), h('div.grow'), i > 0 ? h('button.btn.small.tprev', { on: { click: () => go(i - 1) } }, 'Précédent') : null,
          s.last ? [h('button.btn.small.thome', { on: { click: () => finish('home') } }, 'Retour à l’accueil'), h('button.btn.primary.tnext', { on: { click: () => finish() } }, 'Jouer ce ticket')] : h('button.btn.primary.tnext', { on: { click: () => go(i + 1) } }, 'Suivant →'))].filter(Boolean));
      place(); const el = target(); if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ } }
      setTimeout(place, 60);
    };
    const go = n => { i = Math.max(0, Math.min(steps.length - 1, n)); draw(); };
    const onKey = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); finish(); } else if (ev.key === 'ArrowRight' && !/INPUT|TEXTAREA/.test((ev.target || {}).tagName || '')) { if (i < steps.length - 1) go(i + 1); } else if (ev.key === 'ArrowLeft' && !/INPUT|TEXTAREA/.test((ev.target || {}).tagName || '')) { if (i > 0) go(i - 1); } };
    document.addEventListener('keydown', onKey, true);
    let advancing = false;
    timer = setInterval(() => {
      if (stopped) return;
      if (!app.run || app.run !== run) { finish(); return; }
      const s = steps[i];
      if (s.wait && !advancing && s.wait()) { advancing = true; setTimeout(() => { advancing = false; if (!stopped && steps[i] === s) go(i + 1); }, 350); return; }
      place();
    }, 300);
    this.cur = { finish }; go(0);
  },
  stop() { if (this.cur) this.cur.finish(); }
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
