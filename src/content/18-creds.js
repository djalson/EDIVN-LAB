/* ============================================================================
   Identifiants du laboratoire (données de jeu, fictives). Affichés dans le « coffre » de
   l'interface : le technicien du scénario les connaît. Appliqués au monde à la construction.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM;
const KEY_TSSR = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJd4s5mUlA0xT8n1Qw7kYb2GfHc9RpVoXe3ZtNqLmSuA tssr@PC-ADM';
SIM.CREDS = [
  { scope: 'Domaine toulouse.local', who: 'TOULOUSE\\Administrateur', secret: 'Adm!n2026', note: 'Administrateur du domaine' },
  { scope: 'Domaine toulouse.local', who: 'TOULOUSE\\tssr', secret: 'Tssr-2026!', note: 'Compte d’administration (Admins du domaine)' },
  { scope: 'Domaine bordeaux.local', who: 'BORDEAUX\\Administrateur', secret: 'Adm!n-Bdx26', note: 'Administrateur du domaine de Bordeaux' },
  { scope: 'Postes et serveurs Windows (local)', who: 'tech', secret: 'T3ch#2026', note: 'Compte local d’intervention' },
  { scope: 'Postes et serveurs Windows (local)', who: 'Administrateur', secret: 'Loc@l-2026', note: 'Administrateur local' },
  { scope: 'Serveurs Debian', who: 'tssr', secret: 'Tssr-2026!', note: 'Clé SSH installée sur PC-ADM ; sudo' },
  { scope: 'Serveurs Debian', who: 'tech', secret: 'T3ch#2026', note: 'Compte d’intervention (sans sudo)' },
  { scope: 'SRV-RV (Ramonville)', who: 'admin', secret: 'Ramonville#2026', note: 'sudo' },
  { scope: 'Équipements Cisco', who: 'admin', secret: 'Cisco#2026', note: 'SSH ; enable : Enable#2026' },
  { scope: 'pfSense (interface web et SSH)', who: 'admin', secret: 'pfSense#2026', note: 'Toulouse et Bordeaux' }
];
/* Coffre-fort du joueur (récompense de progression) : mêmes comptes que le tableau « Mots de passe de l'infra », étiquetés par usage.
   win = ouverture de session / élévation / bureau à distance ; pf = interface web pfSense ; ssh, sudo = terminaux Linux, pfSense et Cisco ; enable = mode privilégié Cisco. */
SIM.VAULT = SIM.CREDS.map((c, i) => ({
  id: 'v' + i, scope: c.scope, user: c.who, secret: c.secret, note: c.note,
  tags: /Domaine|Windows/.test(c.scope) ? ['win'] : /pfSense/.test(c.scope) ? ['pf', 'ssh'] : /Cisco/.test(c.scope) ? ['ssh'] : ['ssh', 'sudo']
}));
SIM.VAULT.push({ id: 'venable', scope: 'Équipements Cisco', user: '(mode privilégié « enable »)', secret: 'Enable#2026', note: 'Invite Password: après la commande enable', tags: ['enable'] });
SIM.applyCreds = function (W) {
  for (const id of Object.keys(W.dev)) {
    const d = W.dev[id];
    if (d.kind === 'win') {
      for (const u of d.win.localUsers || []) u.pwd = u.name === 'tech' ? 'T3ch#2026' : 'Loc@l-2026';
      if (id === 'PC-ADM' || id === 'PCEXT') d.sshPub = KEY_TSSR;
    } else if (d.kind === 'linux') {
      d.pwds = { tssr: 'Tssr-2026!', tech: 'T3ch#2026', admin: 'Ramonville#2026', root: 'R00t#2026' };
    } else if (d.kind === 'ios-rt' || d.kind === 'ios-sw') {
      for (const u of d.users || []) u.pwd = 'Cisco#2026';
      d.enablePwd = 'Enable#2026';
    } else if (d.kind === 'pf') {
      d.pwds = { admin: 'pfSense#2026' };
    }
  }
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
