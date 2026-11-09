/* Point d'entrée du navigateur */
(function (g) {
'use strict';
if (typeof document === 'undefined') return;
const boot = () => {
  const root = document.getElementById('app'); if (!root) return;
  /* Passage à la V3 (campagne) : les profils antérieurs ne sont pas repris. Marqueur « gen » posé une fois. */
  try { const st = g.SIM.game.store; if (!/legacy/.test(String(g.location && g.location.hash)) && st.get('gen') !== 3) { if (st.get('profile') !== null) st.set('profile', null); st.set('gen', 3); } } catch (e) { /* stockage indisponible */ }
  try { g.SIM_APP = new g.SIM.ui.App(root); } catch (e) { root.textContent = 'Erreur de démarrage : ' + e.message; if (typeof console !== 'undefined') console.error(e); }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
