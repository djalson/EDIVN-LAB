/* ============================================================================
   Aide-mémoire des commandes : bouton dans chaque terminal (cmd, PowerShell, Linux, IOS). La liste vient de SIM.emu.cmdIndex (registres réels des émulateurs) ;
   recherche instantanée ; un clic sur une commande ou un exemple l'insère dans la ligne de saisie (sans l'exécuter). Élément ajouté, pas une réplique de console réelle.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, UI = SIM.ui, h = UI.h;
const CH = UI.cmdHelp = {};

/* type d'aide-mémoire d'un terminal : null si la session n'est pas un shell émulé (console pfSense, par exemple) */
CH.kindOf = function (term) {
  const s = term.session && term.session(); const d = s && s.d; const th = term.theme;
  if (th === 'ios') return 'ios'; if (th === 'ps') return 'ps'; if (th === 'cmd') return 'cmd';
  if (th === 'bash') return s && typeof s.euser === 'function' && d && d.kind === 'linux' ? 'bash' : null;   /* un vrai shell Linux, pas l'écran de connexion ni la console pfSense */
  return null;
};
CH.devOf = term => { const s = term.session && term.session(); return s && s.d ? s.d : null; };

/* texte inséré : l'exemple, sinon le nom ; commande IOS : les mots littéraux avant le premier paramètre « <…> » */
CH.insertText = it => { if (it.ex) return it.ex; const m = it.name.split(/\s+/); const lit = []; for (const w of m) { if (w[0] === '<' || w === '*rest') break; lit.push(w); } return lit.join(' ') + (lit.length < m.length ? ' ' : ''); };

CH.open = function (term) {
  const kind = CH.kindOf(term); if (!kind) { UI.toast('Aide-mémoire indisponible sur cet écran (connecte-toi d’abord).', 'warn', 2500); return null; }
  const run = g.SIM_APP && g.SIM_APP.run; if (run && run.m && run.m.aid) run.m.aid('memo');   /* D-95 : ouverture tracée, sans malus */
  const idx = SIM.emu.cmdIndex(kind, CH.devOf(term)); const body = h('div.cmdhelp');
  const q = h('input.txt', { placeholder: 'Rechercher une commande ou un mot (ex. dhcp, ufw, vlan, droits…)', 'aria-label': 'Rechercher une commande', style: { width: '100%', boxSizing: 'border-box' } });
  const list = h('div.chlist'); let mm = null;
  const use = it => { const t = CH.insertText(it); if (mm) mm.close(); setTimeout(() => { if (term._acceptsText && term._acceptsText()) { term._insert(t); } term.focus(); }, 0); };
  const draw = () => {
    UI.clear(list); const f = q.value.trim().toLowerCase(); let shown = 0;
    idx.groups.forEach(gr => {
      const items = gr.items.filter(it => !f || (it.name + ' ' + it.desc + ' ' + it.ex + ' ' + gr.title).toLowerCase().indexOf(f) >= 0); if (!items.length) return; shown += items.length;
      list.append(h('h3.chgroup', gr.title, h('span.muted', ' (' + items.length + ')')),
        h('div.chrows', items.map(it => h('div.chrow', { tabindex: 0, role: 'button', title: 'Cliquer pour insérer dans le terminal', on: { click: () => use(it), keydown: e => { if (e.key === 'Enter') { e.preventDefault(); use(it); } } } },
          h('code.chname', it.name), h('span.chdesc', it.desc || ''), it.note ? h('span.chnote', it.note) : null, it.ex && it.ex !== it.name ? h('code.chex', it.ex) : null))));
    });
    if (!shown) list.append(h('p.muted', 'Aucune commande ne correspond.'));
  };
  q.addEventListener('input', draw); draw();
  body.append(h('p.muted', 'Commandes que ce terminal sait exécuter. Clique sur une ligne pour l’insérer dans la ligne de saisie (elle n’est pas exécutée : complète les arguments, puis Entrée).' + (idx.note ? ' ' + idx.note : '')), q, list);
  mm = UI.modal(idx.title, body, [{ label: 'Fermer', primary: true, fn: () => setTimeout(() => term.focus(), 0) }]);
  mm.el.style.maxWidth = 'min(900px, 96vw)'; mm.el.style.width = '96vw'; setTimeout(() => q.focus(), 30);
  return mm;
};

/* bouton flottant dans un terminal (appelé par le terminal à la création) */
CH.refresh = function (term) { if (term.helpBtn) term.helpBtn.style.display = CH.kindOf(term) ? '' : 'none'; };
CH.attach = function (term) {
  if (term.helpBtn || ['ios', 'ps', 'cmd', 'bash'].indexOf(term.theme) < 0) return;
  term.helpBtn = h('button.thelp', { type: 'button', title: 'Aide-mémoire : liste des commandes disponibles', 'aria-label': 'Aide-mémoire des commandes', on: { click: e => { e.stopPropagation(); CH.open(term); }, mousedown: e => e.stopPropagation() } }, 'Aide-mémoire');
  term.el.append(term.helpBtn); CH.refresh(term);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
