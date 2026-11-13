/* Un badge par chapitre : tous les tickets d'examen du chapitre réussis (src/engine/83-campaign.js, C.examSet). */
(function (g) {
'use strict';
const SIM = g.SIM, Game = SIM.game;
(SIM.CHAPTERS || []).forEach(ch => {
  Game.BADGES.push({ id: 'exam100_' + ch.n, cat: 'Campagne', label: 'Examen à 100 % : ' + ch.title, desc: 'Réussir tous les tickets d’examen du chapitre ' + ch.n + ' (« ' + ch.title + ' »).', xp: 60, test: p => !!(SIM.camp && SIM.camp.examProgress(p, ch.n).all) });
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
