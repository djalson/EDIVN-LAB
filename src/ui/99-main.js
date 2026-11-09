/* Point d'entrée du navigateur */
(function (g) {
'use strict';
if (typeof document === 'undefined') return;
const boot = () => {
  const root = document.getElementById('app'); if (!root) return;
  try { g.SIM_APP = new g.SIM.ui.App(root); } catch (e) { root.textContent = 'Erreur de démarrage : ' + e.message; if (typeof console !== 'undefined') console.error(e); }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
