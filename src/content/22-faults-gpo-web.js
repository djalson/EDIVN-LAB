/* ============================================================================
   Pannes — lot B (suite) : partages & NTFS, stratégies de groupe, IIS (contenu, droits, certificats).
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
const DOM = 'toulouse.local';
const USERS = [
  { sam: 'a.martin', host: 'PC-01', name: 'Alice Martin', svc: 'la comptabilité', gg: 'GG_Compta', share: 'Compta', drive: 'drive.S', dl: 'DL_Compta_RW' },
  { sam: 'b.durand', host: 'PC-02', name: 'Bruno Durand', svc: 'les RH', gg: 'GG_RH', share: 'RH', drive: 'drive.R', dl: 'DL_RH_RW' }
];
const gpo = id => 'SRV-DC1.win.ad.gpos[id=' + id + ']';
const ntfs = p => 'SRV-FIC.win.ntfs.' + p;
const LINK_USERS = { target: 'OU=Utilisateurs,DC=toulouse,DC=local', enforced: false, enabled: true, order: 1 };

/* ======================= PARTAGES & NTFS ======================= */
add({ id: 'sh_svc', v1: 'sh_svc', level: 2, title: 'Service « Serveur » arrêté sur le serveur de fichiers', skills: ['ntfs-partage', 'iis', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Le serveur répond mais mes dossiers sont inaccessibles', 'Bonjour, depuis ce matin je n’arrive plus à ouvrir \\\\SRV-FIC. Un collègue de l’informatique m’a dit que le serveur répond au ping, donc je ne comprends pas. Le message dit que le chemin réseau est introuvable.'),
  cause: 'Le service « Serveur » (LanmanServer) est arrêté sur SRV-FIC : le serveur répond au ping mais n’écoute plus sur SMB (TCP 445).',
  solution: 'Démarrer le service Serveur sur SRV-FIC (services.msc) et contrôler son démarrage automatique.',
  hints: ['Le serveur répond au ping : la couche réseau est bonne. Testez le port SMB (TCP 445).', 'Si 445 est fermé alors que la machine répond, un service est arrêté côté serveur.', 'Sur SRV-FIC, démarrez le service « Serveur » et vérifiez qu’il est en démarrage automatique.'],
  inject: [{ do: 'svc', dev: 'SRV-FIC', name: 'LanmanServer', state: 'stopped' }],
  probes: [{ t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'read' }, { t: 'ping', from: '{{u.host}}', to: '10.10.10.20', hidden: true }],
  roots: [{ probe: { t: 'svc', dev: 'SRV-FIC', name: 'LanmanServer' } }],
  fix: [{ do: 'svc', dev: 'SRV-FIC', name: 'LanmanServer', state: 'running' }],
  traps: ['Revoir le DNS, le pare-feu ou les droits NTFS ne sert à rien tant que le service ne répond pas.'],
  optimal: ['Ping SRV-FIC (OK)', 'Test du port 445 (refusé)', 'Services du serveur : Serveur arrêté', 'Démarrer le service', 'Retester \\\\SRV-FIC\\dossier'] });

add({ id: 'sh_perm_share', level: 2, title: 'Autorisations de partage trop restrictives', skills: ['ntfs-partage', 'diag'],
  vary: { u: USERS, m: [
    { key: 'lecture', label: 'lecture seule', perms: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] },
    { key: 'vide', label: 'aucune autorisation', perms: [] }
  ] },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Impossible d’enregistrer dans le dossier {{u.share}}', 'Bonjour, depuis hier soir je peux parfois ouvrir mes fichiers mais je n’arrive plus à enregistrer dans le dossier {{u.share}} (ou même à l’ouvrir). L’ordinateur dit que l’accès est refusé. Je suis pourtant dans le bon groupe, un collègue de mon service a le même souci.'),
  cause: 'Les autorisations du partage \\\\SRV-FIC\\{{u.share}} ont été modifiées ({{m.label}}) : la combinaison partage ∩ NTFS ne laisse plus l’écriture, quels que soient les droits NTFS.',
  solution: 'Rétablir les autorisations du partage (Utilisateurs authentifiés : Modifier) et laisser NTFS affiner par groupe.',
  hints: ['Plusieurs collègues du même service sont touchés : regardez le partage plutôt que le compte.', 'Les droits effectifs sont l’intersection des autorisations du partage ET de la sécurité NTFS : vérifiez les deux couches.', 'Dans les propriétés du partage → Autorisations : rétablissez « Modifier » pour les utilisateurs authentifiés.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.shares[name={{u.share}}].perms', value: '{{m.perms}}' }],
  probes: [{ t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'write' }],
  roots: [{ probe: { t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'write' } }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.shares[name={{u.share}}].perms', value: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }] }],
  traps: ['Donner « Contrôle total » à Tout le monde sur le partage règle le symptôme mais ouvre trop large.', 'Modifier les droits NTFS ne dépasse jamais les autorisations du partage.'],
  optimal: ['Constater un refus d’accès à l’écriture', 'Vérifier les autorisations du partage', 'Vérifier la sécurité NTFS (OK)', 'Rétablir les autorisations du partage', 'Retester l’enregistrement'] });

const SHDEF = {
  Compta: { path: 'D:\\Partages\\Compta', comment: 'Dossier du service comptabilité' },
  RH: { path: 'D:\\Partages\\RH', comment: 'Dossier du service RH' }
};
add({ id: 'sh_missing', v1: 'sh_missing', level: 2, title: 'Partage supprimé alors que le dossier existe toujours', skills: ['ntfs-partage', 'diag'],
  vary: { u: USERS.map(u => Object.assign({}, u, { spath: SHDEF[u.share].path, scomment: SHDEF[u.share].comment })) },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Le dossier {{u.share}} du serveur ne s’ouvre plus', 'Bonjour, depuis ce matin je n’arrive plus à ouvrir le dossier {{u.share}} du serveur de fichiers. Les autres dossiers du serveur s’ouvrent normalement et le serveur répond. Un technicien a fait du rangement sur le serveur hier soir.'),
  cause: 'Le partage \\\\SRV-FIC\\{{u.share}} a été supprimé (le dossier {{u.spath}} existe toujours sur le disque, avec ses droits NTFS) : le serveur répond mais ne publie plus ce nom de partage.',
  solution: 'Repartager le dossier {{u.spath}} sous le nom « {{u.share}} » avec les autorisations de partage « Modifier » pour les utilisateurs authentifiés, en laissant NTFS affiner par groupe.',
  hints: ['Le serveur répond et les autres partages s’ouvrent : ce n’est ni le réseau ni le DNS. Notez le code de l’erreur (net use donne un numéro).', 'Erreur système 67 = nom de partage introuvable (à distinguer de la 53, chemin réseau introuvable). Listez les partages publiés par le serveur : net view \\\\SRV-FIC ou Gestion de l’ordinateur → Dossiers partagés.', 'Le partage a disparu mais le dossier existe : repartagez-le sous le même nom, puis rétablissez les autorisations de partage « Modifier » pour les utilisateurs authentifiés.'],
  inject: [{ do: 'del', path: 'SRV-FIC.win.shares[name={{u.share}}]' }],
  probes: [{ t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'write' }],
  roots: [{ probe: { t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'write' } }],
  fix: [{ do: 'push', path: 'SRV-FIC.win.shares', item: { name: '{{u.share}}', path: '{{u.spath}}', comment: '{{u.scomment}}', perms: [{ who: 'Utilisateurs authentifiés', access: 'Modify' }], abe: true } }],
  traps: ['Repartager avec les autorisations par défaut (lecture seule) rétablit le nom mais pas l’écriture : le partage reste à corriger.', 'Toucher aux droits NTFS ne sert à rien tant que le partage n’existe pas.'],
  optimal: ['Constater le code d’erreur (67) et que les autres partages fonctionnent', 'net view \\\\SRV-FIC : le partage est absent', 'Vérifier que le dossier existe sur le disque', 'Repartager avec les bonnes autorisations', 'Retester l’enregistrement'] });

add({ id: 'fw_smb', level: 2, title: 'Règle SMB entrante désactivée sur le serveur de fichiers', skills: ['pare-feu-win', 'ntfs-partage', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Plus aucun dossier du serveur ne s’ouvre', 'Bonjour, depuis ce matin tous les dossiers partagés du serveur de fichiers refusent de s’ouvrir (« chemin réseau introuvable »). Le serveur répond quand on le pingue. Personne de mon service n’y arrive.'),
  cause: 'La règle entrante « Partage de fichiers et d’imprimantes (SMB - Trafic entrant) » est désactivée sur SRV-FIC : le service Serveur tourne, mais le port TCP 445 est filtré.',
  solution: 'Réactiver la règle entrante SMB du pare-feu de SRV-FIC (wf.msc ou Enable-NetFirewallRule) sans désactiver le pare-feu.',
  hints: ['Le serveur répond au ping mais aucun partage ne s’ouvre : testez le port 445 (Test-NetConnection srv-fic -Port 445).', 'Port 445 en délai d’attente = filtrage. Le service « Serveur » est-il démarré sur SRV-FIC ? Que dit le pare-feu Windows de SRV-FIC ?', 'wf.msc sur SRV-FIC → Règles de trafic entrant → réactivez la règle SMB (trafic entrant).'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=smb].enabled', value: false }],
  probes: [{ t: 'connect', from: '{{u.host}}', to: 'srv-fic', proto: 'tcp', port: 445 }, { t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'read' }, { t: 'ping', from: '{{u.host}}', to: '10.10.10.20' }],
  roots: [{ path: 'SRV-FIC.win.fw.rules[id=smb].enabled', eq: true }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.fw.rules[id=smb].enabled', value: true }],
  workarounds: { desactiver_pare_feu: [{ do: 'set', path: 'SRV-FIC.win.fw.profiles.domain.enabled', value: false }] },
  traps: ['Désactiver le pare-feu du serveur de fichiers « répare » l’accès mais c’est une faute de sécurité.', 'Recréer les partages ou toucher aux droits NTFS est inutile : les partages existent et le serveur répond au ping.'],
  optimal: ['Ping OK mais partages inaccessibles (erreur 53)', 'Test-NetConnection port 445 : filtré', 'Vérifier le service Serveur (démarré)', 'wf.msc sur SRV-FIC : règle SMB', 'Réactiver la règle puis retester l’ouverture du dossier'] });

add({ id: 'ad_agdlp_dl', level: 3, title: 'Groupe global retiré du groupe local de domaine (AGDLP)', skills: ['agdlp', 'ntfs-partage', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Toute la compta n’a plus accès au dossier Compta', 'Bonjour, depuis ce matin personne du service comptabilité n’arrive à ouvrir le dossier Compta. Nous sommes quatre dans le service. Avant-hier nous avions tous accès. Un technicien a nettoyé les groupes hier soir.'),
  cause: 'Le groupe global GG_Compta a été retiré du groupe local de domaine DL_Compta_RW, qui porte la permission NTFS : plus aucun membre du service n’obtient le droit.',
  solution: 'Ré-ajouter GG_Compta comme membre de DL_Compta_RW (modèle AGDLP : comptes → groupes globaux → groupes locaux → permissions) et faire rouvrir les sessions.',
  hints: ['Tout le service est touché : le problème est dans la chaîne de groupes, pas dans un compte.', 'Suivez la chaîne : utilisateur → GG_Compta → DL_Compta_RW → ACL NTFS du dossier.', 'Remettez GG_Compta dans DL_Compta_RW puis faites fermer/rouvrir les sessions.'],
  inject: [{ do: 'ad.member.del', domain: DOM, group: 'DL_Compta_RW', member: 'GG_Compta' }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }],
  probes: [{ t: 'share', from: 'PC-01', user: 'a.martin', unc: '\\\\SRV-FIC\\Compta', want: 'write' }],
  roots: [{ path: 'SRV-DC1.win.ad.groups[name=DL_Compta_RW].members', has: 'GG_Compta' }],
  fix: [{ do: 'ad.member.add', domain: DOM, group: 'DL_Compta_RW', member: 'GG_Compta' }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }],
  workarounds: { 'ace-gg': [{ do: 'push', path: ntfs('D:\\Partages\\Compta.acl'), item: { who: 'TOULOUSE\\GG_Compta', type: 'allow', rights: 'Modify', applies: 'this+sub' } }] },
  traps: ['Mettre le GG directement dans l’ACL NTFS fonctionne mais casse AGDLP : le prochain audit le signalera.'],
  optimal: ['Constater que tout le service est touché', 'Lire l’ACL NTFS : DL_Compta_RW', 'Lister les membres de DL_Compta_RW : GG_Compta absent', 'Ré-ajouter GG_Compta', 'Rouvrir une session et retester'] });

add({ id: 'sh_ntfs_deny', level: 3, title: 'Refus explicite NTFS qui écrase les autorisations', skills: ['ntfs-partage', 'agdlp', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Je peux lire mais plus modifier mes fichiers', 'Bonjour, je peux toujours ouvrir les fichiers du dossier Compta mais je ne peux plus rien modifier ni enregistrer. C’est la même chose pour toute mon équipe. Le dossier est en « accès refusé » dès que j’essaie d’écrire.'),
  cause: 'Une entrée de refus (Écriture) a été ajoutée pour GG_Compta sur D:\\Partages\\Compta : un refus explicite l’emporte sur toutes les autorisations des groupes dont l’utilisateur est membre.',
  solution: 'Supprimer l’entrée de refus dans la sécurité NTFS du dossier (onglet Sécurité → Avancé) ; ne pas « ajouter une autorisation en plus ».',
  hints: ['Lecture OK, écriture refusée : ce n’est ni le service ni le réseau.', 'Dans la sécurité avancée du dossier, cherchez un type « Refuser ».', 'Un refus l’emporte toujours : supprimez-le au lieu d’ajouter une autorisation.'],
  inject: [{ do: 'push', path: ntfs('D:\\Partages\\Compta.acl'), item: { who: 'TOULOUSE\\GG_Compta', type: 'deny', rights: 'Write', applies: 'this+sub' } }],
  probes: [{ t: 'share', from: 'PC-01', user: 'a.martin', unc: '\\\\SRV-FIC\\Compta', want: 'write' }, { t: 'share', from: 'PC-01', user: 'a.martin', unc: '\\\\SRV-FIC\\Compta', want: 'read', hidden: true }],
  roots: ['SRV-FIC/win/ntfs/D:\\Partages\\Compta/acl'],
  fix: [{ do: 'set', path: ntfs('D:\\Partages\\Compta.acl'), value: [{ who: 'NT AUTHORITY\\Système', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\Administrateurs', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'TOULOUSE\\DL_Compta_RW', type: 'allow', rights: 'Modify', applies: 'this+sub' }] }],
  traps: ['Ajouter une autorisation « Modifier » à côté du refus ne change rien : le refus prime.'],
  optimal: ['Lecture OK / écriture refusée', 'Sécurité NTFS avancée du dossier', 'Repérer l’entrée Refuser', 'Supprimer le refus', 'Retester l’écriture'] });

add({ id: 'sh_ntfs_inherit', level: 3, title: 'Héritage NTFS coupé sur un sous-dossier', skills: ['ntfs-partage', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Le sous-dossier Factures est inaccessible', 'Bonjour, je peux ouvrir le dossier Compta mais pas le sous-dossier « Factures » : accès refusé. Mon collègue a dit qu’il avait « sécurisé » ce dossier la semaine dernière. Pourtant il faut que la compta y accède.'),
  cause: 'L’héritage des autorisations a été désactivé sur D:\\Partages\\Compta\\Factures (avec suppression des entrées héritées) : seuls Système et Administrateurs y ont accès.',
  solution: 'Réactiver l’héritage sur le dossier Factures (ou ajouter explicitement DL_Compta_RW), sans ouvrir à Tout le monde.',
  hints: ['Le dossier parent est accessible mais pas son sous-dossier : regardez la sécurité du sous-dossier.', 'Dans Sécurité → Avancé : l’héritage est-il activé ? Quelles entrées existent ?', 'Réactivez l’héritage depuis le dossier parent ou ajoutez DL_Compta_RW.'],
  inject: [{ do: 'set', path: ntfs('D:\\Partages\\Compta\\Factures'), value: { inherit: false, owner: 'BUILTIN\\Administrateurs', acl: [{ who: 'NT AUTHORITY\\Système', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\Administrateurs', type: 'allow', rights: 'FullControl', applies: 'this+sub' }] } }],
  probes: [{ t: 'share', from: 'PC-01', user: 'a.martin', unc: '\\\\SRV-FIC\\Compta\\Factures', want: 'write' }],
  roots: [{ probe: { t: 'share', from: 'PC-01', user: 'a.martin', unc: '\\\\SRV-FIC\\Compta\\Factures', want: 'write' } }],
  fix: [{ do: 'set', path: ntfs('D:\\Partages\\Compta\\Factures.inherit'), value: true }],
  fixes: { 'ace-dl': [{ do: 'push', path: ntfs('D:\\Partages\\Compta\\Factures.acl'), item: { who: 'TOULOUSE\\DL_Compta_RW', type: 'allow', rights: 'Modify', applies: 'this+sub' } }] },
  traps: ['Donner Tout le monde / Contrôle total sur le sous-dossier règle le symptôme et détruit la confidentialité.'],
  optimal: ['Constater que seul le sous-dossier est refusé', 'Lire la sécurité avancée du sous-dossier', 'Constater l’héritage désactivé', 'Réactiver l’héritage', 'Retester'] });

/* ======================= STRATÉGIES DE GROUPE ======================= */
add({ id: 'gpo_link', level: 2, title: 'GPO des lecteurs réseau non appliquée (lien, état)', skills: ['gpo', 'diag-gpo', 'diag'],
  vary: { u: USERS, m: [
    { key: 'lien', label: 'le lien de la GPO sur l’OU Utilisateurs est désactivé', path: gpo('GPO3') + '.links[0].enabled', bad: false, good: true, relink: true, rp: gpo('GPO3') + '.links[0].enabled', rg: true },
    { key: 'config', label: 'la configuration utilisateur de la GPO est désactivée', path: gpo('GPO3') + '.userEnabled', bad: false, good: true, relink: true, rp: gpo('GPO3') + '.userEnabled', rg: true },
    /* racine : le lien existe et est actif (un lien recréé dans la GPMC prend l'ordre « dernier », pas forcément celui d'origine) */
    { key: 'delie', label: 'la GPO n’est plus liée à l’OU Utilisateurs', path: gpo('GPO3') + '.links', bad: [], good: [LINK_USERS], relink: [Object.assign({}, LINK_USERS, { order: 2 })], rp: gpo('GPO3') + '.links[target=' + LINK_USERS.target + '].enabled', rg: true }
  ] },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Mes lecteurs réseau ont disparu', 'Bonjour, ce matin je n’ai plus mes lecteurs réseau (P: et les autres) dans l’explorateur. Hier ils étaient là. Si je tape le chemin du serveur à la main, j’y accède. Pouvez-vous les remettre ?'),
  cause: 'Pour la GPO « GPO_Lecteurs_Reseau », {{m.label}} : la stratégie ne s’applique plus aux utilisateurs de l’OU.',
  solution: 'Dans la console de gestion des stratégies de groupe (GPMC) : rétablir le lien / réactiver la configuration utilisateur, puis gpupdate /force et fermer/rouvrir la session de l’utilisateur.',
  hints: ['L’accès manuel au serveur marche : c’est la distribution des lecteurs (la GPO) qui ne s’applique plus. Lancez gpresult /r sur le poste.', 'Dans gpresult, la GPO « GPO_Lecteurs_Reseau » est absente ou refusée. Ouvrez la GPMC et regardez son lien et son état.', 'Rétablissez le lien/l’état puis gpupdate /force et fermez/rouvrez la session (les lecteurs se montent à l’ouverture de session).'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  probes: [{ t: 'gpo', host: '{{u.host}}', user: '{{u.sam}}', scope: 'user', setting: 'drive.P' }, { t: 'gpo', host: '{{u.host}}', user: '{{u.sam}}', scope: 'user', setting: '{{u.drive}}' }],
  roots: [{ path: '{{m.rp}}', eq: '{{m.rg}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  /* D-101 n° 6 : recréer le lien dans la GPMC prend l'ordre « dernier » (≠ ordre d'origine) : chemin de résolution valide, sans pénalité (la racine se dérive du modèle, pas d'une liste de chemins) */
  fixes: { 'lien-recree': [{ do: 'set', path: '{{m.path}}', value: '{{m.relink}}' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }] },
  traps: ['Remapper les lecteurs à la main sur un poste ne corrige que ce poste.', 'Sans gpupdate puis fermeture/ouverture de session, la correction n’est pas visible au poste.'],
  optimal: ['gpresult /r sur le poste (GPO absente)', 'GPMC : état et lien de GPO_Lecteurs_Reseau', 'Corriger le lien / l’état', 'gpupdate /force', 'Fermer/rouvrir la session et vérifier les lecteurs'] });

add({ id: 'gpo_secfilter', level: 3, title: 'Filtrage de sécurité de la GPO fond d’écran trop restrictif', skills: ['gpo-filtrage', 'diag-gpo', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Le fond d’écran de la charte graphique n’apparaît plus', 'Bonjour, depuis la mise à jour de la semaine dernière, mon fond d’écran est redevenu celui par défaut de Windows. La direction demande que tout le monde ait celui de la charte. Mes lecteurs réseau, eux, sont bien là.'),
  cause: 'Le filtrage de sécurité de « GPO_Fond_Ecran » a été limité au groupe GG_IT : les autres utilisateurs ne reçoivent plus la stratégie (refusée par filtrage de sécurité).',
  solution: 'Dans la GPMC, onglet Délégation/Étendue de la GPO : rétablir « Utilisateurs authentifiés » dans le filtrage de sécurité, puis gpupdate /force.',
  hints: ['Les lecteurs (autre GPO) fonctionnent : le moteur GPO marche. Comparez gpresult : la GPO fond d’écran est « Refusée ».', 'Raison indiquée : filtrage de sécurité. Regardez la section « Filtrage de sécurité » dans l’onglet Étendue.', 'Remettez « Utilisateurs authentifiés » (ou le bon groupe cible) dans le filtrage puis gpupdate /force et rouvrez la session.'],
  inject: [{ do: 'set', path: gpo('GPO4') + '.secFilter', value: ['GG_IT'] }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  probes: [{ t: 'gpo', host: '{{u.host}}', user: '{{u.sam}}', scope: 'user', setting: 'wallpaper' }],
  roots: [{ any: [{ path: gpo('GPO4') + '.secFilter', has: 'Utilisateurs authentifiés' }, { path: gpo('GPO4') + '.secFilter', has: 'Utilisateurs du domaine' }] }],
  fix: [{ do: 'set', path: gpo('GPO4') + '.secFilter', value: ['Utilisateurs authentifiés'] }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  workarounds: { 'groupe-par-groupe': [{ do: 'push', path: gpo('GPO4') + '.secFilter', item: '{{u.gg}}' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }] },
  traps: ['Ajouter les groupes un par un règle le poste testé mais oublie les autres services.'],
  optimal: ['gpresult /r : GPO refusée (filtrage de sécurité)', 'GPMC → Étendue → Filtrage de sécurité', 'Rétablir Utilisateurs authentifiés', 'gpupdate /force + rouvrir la session'] });

add({ id: 'gpo_ms16072', level: 4, title: 'GPO utilisateur refusée : droit de lecture de l’ordinateur manquant (MS16-072)', skills: ['gpo-filtrage', 'diag-gpo', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Plus aucun lecteur réseau ni fond d’écran depuis ce matin', 'Bonjour, depuis ce matin je n’ai plus ni lecteurs réseau ni fond d’écran, pour moi et mes collègues du service. L’administrateur a « ciblé » les stratégies sur nos groupes hier soir pour que ce soit plus propre. Les groupes sont pourtant corrects.'),
  cause: 'Les GPO utilisateur ont été filtrées sur des groupes d’utilisateurs en retirant « Utilisateurs authentifiés » de la délégation : depuis MS16-072, le compte ORDINATEUR doit aussi avoir le droit de lecture sur la GPO, sinon la stratégie utilisateur est refusée.',
  solution: 'Ajouter « Utilisateurs authentifiés » (ou « Ordinateurs du domaine ») avec le droit Lecture (sans Appliquer) dans la délégation de chaque GPO utilisateur ciblée, puis gpupdate /force et rouvrir la session.',
  hints: ['Les groupes sont corrects et pourtant la GPO est refusée. Lisez la raison exacte dans gpresult.', 'Depuis MS16-072 la stratégie utilisateur est récupérée avec le contexte de l’ordinateur : il lui faut un droit de lecture.', 'Dans la délégation de chaque GPO, ajoutez Utilisateurs authentifiés avec Lecture seule (pas Appliquer).'],
  inject: [{ do: 'set', path: gpo('GPO3') + '.secFilter', value: ['GG_Compta', 'GG_RH', 'GG_Direction', 'GG_IT'] }, { do: 'set', path: gpo('GPO3') + '.readers', value: ['GG_Compta', 'GG_RH', 'GG_Direction', 'GG_IT'] }, { do: 'set', path: gpo('GPO4') + '.secFilter', value: ['GG_Compta', 'GG_RH', 'GG_Direction', 'GG_IT'] }, { do: 'set', path: gpo('GPO4') + '.readers', value: ['GG_Compta', 'GG_RH', 'GG_Direction', 'GG_IT'] }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  probes: [{ t: 'gpo', host: '{{u.host}}', user: '{{u.sam}}', scope: 'user', setting: 'drive.P' }, { t: 'gpo', host: '{{u.host}}', user: '{{u.sam}}', scope: 'user', setting: 'wallpaper' }],
  roots: [{ any: [{ path: gpo('GPO3') + '.readers', has: 'Utilisateurs authentifiés' }, { path: gpo('GPO3') + '.readers', has: 'Ordinateurs du domaine' }] }, { any: [{ path: gpo('GPO4') + '.readers', has: 'Utilisateurs authentifiés' }, { path: gpo('GPO4') + '.readers', has: 'Ordinateurs du domaine' }] }, { path: gpo('GPO3') + '.secFilter', hasNot: 'Utilisateurs authentifiés' }, { path: gpo('GPO4') + '.secFilter', hasNot: 'Utilisateurs authentifiés' }, { path: gpo('GPO3') + '.secFilter', hasNot: 'Tout le monde' }, { path: gpo('GPO4') + '.secFilter', hasNot: 'Tout le monde' }],
  fix: [{ do: 'push', path: gpo('GPO3') + '.readers', item: 'Utilisateurs authentifiés' }, { do: 'push', path: gpo('GPO4') + '.readers', item: 'Utilisateurs authentifiés' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  fixes: { 'ordinateurs': [{ do: 'push', path: gpo('GPO3') + '.readers', item: 'Ordinateurs du domaine' }, { do: 'push', path: gpo('GPO4') + '.readers', item: 'Ordinateurs du domaine' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }] },
  workarounds: { 'appliquer-a-tous': [{ do: 'push', path: gpo('GPO3') + '.secFilter', item: 'Utilisateurs authentifiés' }, { do: 'push', path: gpo('GPO3') + '.readers', item: 'Utilisateurs authentifiés' }, { do: 'push', path: gpo('GPO4') + '.secFilter', item: 'Utilisateurs authentifiés' }, { do: 'push', path: gpo('GPO4') + '.readers', item: 'Utilisateurs authentifiés' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }] },
  traps: ['Ajouter les utilisateurs en « Appliquer » ne règle rien : le manque est un droit de lecture pour l’ordinateur.', 'Remettre « Utilisateurs authentifiés » en Appliquer sur tout annule le ciblage voulu : préférer Lecture seule.'],
  optimal: ['gpresult /r : refus (droit de lecture)', 'GPMC → Délégation → Avancé', 'Ajouter Utilisateurs authentifiés en Lecture seule', 'gpupdate /force + rouvrir la session', 'Vérifier lecteurs et fond d’écran'] });

add({ id: 'gpo_block', level: 3, title: 'Héritage des GPO bloqué sur une OU', skills: ['gpo-heritage', 'diag-gpo', 'diag'],
  ticket: tk('Alice Martin (la comptabilité)', 'Plus de lecteurs réseau ni de fond d’écran en compta uniquement', 'Bonjour, depuis hier seuls les gens de la comptabilité ont perdu leurs lecteurs réseau et le fond d’écran. Les autres services n’ont aucun problème. Quelqu’un a travaillé sur l’OU de la compta hier après-midi.'),
  cause: 'L’option « Bloquer l’héritage » a été activée sur l’OU Compta : les GPO liées à l’OU parent (Utilisateurs) ne s’appliquent plus aux utilisateurs de la comptabilité.',
  solution: 'Désactiver « Bloquer l’héritage » sur l’OU Compta (ou rendre les liens concernés « Appliqués » si le blocage est voulu), puis gpupdate /force et rouvrir la session.',
  hints: ['Un seul service est touché : regardez ce qui est propre à son OU.', 'Dans la GPMC, une OU qui bloque l’héritage affiche un point d’exclamation bleu.', 'Désactivez le blocage ou marquez les liens du parent « Appliqué ».'],
  inject: [{ do: 'set', path: 'SRV-DC1.win.ad.ous[dn=OU=Compta,OU=Utilisateurs,DC=toulouse,DC=local].block', value: true }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }],
  probes: [{ t: 'gpo', host: 'PC-01', user: 'a.martin', scope: 'user', setting: 'drive.P' }, { t: 'gpo', host: 'PC-01', user: 'a.martin', scope: 'user', setting: 'wallpaper' }],
  roots: [{ any: [{ path: 'SRV-DC1.win.ad.ous[dn=OU=Compta,OU=Utilisateurs,DC=toulouse,DC=local].block', eq: false }, { path: gpo('GPO3') + '.links[0].enforced', eq: true }] }, { any: [{ path: 'SRV-DC1.win.ad.ous[dn=OU=Compta,OU=Utilisateurs,DC=toulouse,DC=local].block', eq: false }, { path: gpo('GPO4') + '.links[0].enforced', eq: true }] }],
  fix: [{ do: 'set', path: 'SRV-DC1.win.ad.ous[dn=OU=Compta,OU=Utilisateurs,DC=toulouse,DC=local].block', value: false }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }],
  fixes: { 'applique': [{ do: 'set', path: gpo('GPO3') + '.links[0].enforced', value: true }, { do: 'set', path: gpo('GPO4') + '.links[0].enforced', value: true }, { do: 'relogon', dev: 'PC-01', user: 'a.martin' }] },
  traps: ['Lier les GPO directement sur l’OU Compta recrée des doublons à maintenir au lieu de lever le blocage.'],
  optimal: ['gpresult : GPO absentes pour la compta', 'GPMC : arborescence de l’OU Compta', 'Repérer le blocage d’héritage', 'Désactiver le blocage', 'gpupdate /force + rouvrir la session'] });

add({ id: 'gpo_order', level: 3, title: 'Deux GPO en conflit : ordre de liaison', skills: ['gpo-heritage', 'diag-gpo', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Le fond d’écran n’est pas celui de la charte', 'Bonjour, mon fond d’écran a changé : c’est une image de test, pas celle de la charte graphique. Hier c’était le bon. Mes lecteurs réseau fonctionnent normalement. Pouvez-vous voir ?'),
  cause: 'Une GPO de test « GPO_Test_Fond_Ecran » est liée à l’OU Utilisateurs avec l’ordre de liaison 1 : appliquée en dernier, elle l’emporte sur « GPO_Fond_Ecran » pour le même paramètre.',
  solution: 'Dans la GPMC : supprimer ou délier la GPO de test, ou la repasser derrière dans l’ordre de liaison (ordre 1 = appliqué en dernier = prioritaire).',
  hints: ['Le paramètre est bien appliqué, mais c’est la mauvaise valeur : cherchez quelle GPO « gagne ». Résultat de stratégie / gpresult /h.', 'Deux GPO définissent le même fond d’écran. En cas de conflit, la dernière appliquée l’emporte : ordre de liaison 1 = dernier.', 'Supprimez/déliez la GPO de test ou changez l’ordre de liaison, puis gpupdate /force.'],
  inject: [{ do: 'set', path: gpo('GPO3') + '.links[0].order', value: 2 }, { do: 'set', path: gpo('GPO4') + '.links[0].order', value: 3 },
    { do: 'push', path: 'SRV-DC1.win.ad.gpos', item: { id: 'GPO5', name: 'GPO_Test_Fond_Ecran', enabled: true, userEnabled: true, compEnabled: false, links: [{ target: 'OU=Utilisateurs,DC=toulouse,DC=local', enforced: false, enabled: true, order: 1 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'], settings: [{ scope: 'user', id: 'wallpaper', value: '\\\\SRV-FIC\\Commun\\test.png' }] } },
    { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  probes: [{ t: 'gpo', host: '{{u.host}}', user: '{{u.sam}}', scope: 'user', setting: 'wallpaper', expect: '\\\\SRV-FIC\\Commun\\fond.png' }],
  roots: [{ any: [{ path: gpo('GPO5') + '.links[0].order', gt: 3 }, { path: gpo('GPO5') + '.links[0].enabled', eq: false }, { path: gpo('GPO5') + '.enabled', eq: false }, { path: gpo('GPO5') + '.userEnabled', eq: false }, { path: gpo('GPO5'), isNull: true }, { path: gpo('GPO5') + '.links', eq: [] }] }],
  okDanger: [{ id: 'ad-delete', match: 'gpos[GPO5]' }],   /* supprimer LA GPO de test que la panne a créée est le chemin de résolution déclaré (cause / solution) ; supprimer une autre GPO reste dangereux */
  fix: [{ do: 'del', path: gpo('GPO5') }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  fixes: { ordre: [{ do: 'set', path: gpo('GPO5') + '.links[0].order', value: 4 }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }], 'lien-desactive': [{ do: 'set', path: gpo('GPO5') + '.links[0].enabled', value: false }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }] },
  traps: ['Modifier GPO_Fond_Ecran ne sert à rien : elle est correcte, c’est une autre GPO qui la masque.'],
  optimal: ['gpresult /h : repérer la GPO gagnante', 'GPMC : OU Utilisateurs → ordre de liaison', 'Supprimer ou rétrograder la GPO de test', 'gpupdate /force + rouvrir la session'] });

add({ id: 'gpo_enforced', level: 4, title: 'GPO « Appliqué » au niveau du domaine qui écrase la politique des postes', skills: ['gpo-heritage', 'diag-gpo', 'diag'],
  ticket: tk('Responsable sécurité', 'Audit : écran de verrouillage non conforme sur les postes', 'Bonjour, l’audit de conformité remonte que les postes ne verrouillent plus l’écran au bout de 15 minutes, alors que la GPO de sécurité des postes est configurée correctement (je viens de la vérifier). Ça touche tous les postes de l’OU Postes. Merci de trouver ce qui la contredit.'),
  cause: 'Une GPO « GPO_Poste_Parametres_Test » liée à la racine du domaine en mode « Appliqué » fixe un délai d’écran de veille de 2 h ; une GPO « Appliquée » du niveau supérieur l’emporte sur la GPO de l’OU Postes et résiste au blocage d’héritage.',
  solution: 'Retirer le mode « Appliqué » (ou supprimer/délier la GPO fautive) puis gpupdate /force. Bloquer l’héritage sur l’OU ne contourne pas une GPO appliquée.',
  hints: ['La GPO de l’OU est correcte : cherchez qui la contredit avec gpresult (GPO gagnante pour le paramètre).', 'Une autre GPO fixe le même paramètre à un niveau supérieur. Qu’est-ce qui lui permet de gagner contre la GPO de l’OU ?', 'Elle est liée en « Appliqué » : retirez l’option ou supprimez/déliez la GPO de test, puis gpupdate /force.'],
  inject: [{ do: 'push', path: 'SRV-DC1.win.ad.gpos', item: { id: 'GPO6', name: 'GPO_Poste_Parametres_Test', enabled: true, userEnabled: false, compEnabled: true, links: [{ target: 'DC=toulouse,DC=local', enforced: true, enabled: true, order: 2 }], secFilter: ['Utilisateurs authentifiés'], readers: ['Utilisateurs authentifiés'], settings: [{ scope: 'computer', id: 'screensaver.timeout', value: 7200 }] } }, { do: 'relogon', dev: 'PC-01' }, { do: 'relogon', dev: 'PC-02' }],
  probes: [{ t: 'gpo', host: 'PC-01', scope: 'computer', setting: 'screensaver.timeout', expect: 900 }, { t: 'gpo', host: 'PC-02', scope: 'computer', setting: 'screensaver.timeout', expect: 900 }],
  roots: [{ any: [{ path: gpo('GPO6') + '.links[0].enforced', eq: false }, { path: gpo('GPO6') + '.links[0].enabled', eq: false }, { path: gpo('GPO6') + '.enabled', eq: false }, { path: gpo('GPO6') + '.compEnabled', eq: false }, { path: gpo('GPO6'), isNull: true }] }],
  okDanger: [{ id: 'ad-delete', match: 'gpos[GPO6]' }],   /* supprimer LA GPO fautive que la panne a créée est le chemin déclaré (solution) ; une autre GPO reste protégée */
  fix: [{ do: 'del', path: gpo('GPO6') }, { do: 'relogon', dev: 'PC-01' }, { do: 'relogon', dev: 'PC-02' }],
  fixes: { 'desappliquer': [{ do: 'set', path: gpo('GPO6') + '.links[0].enforced', value: false }, { do: 'relogon', dev: 'PC-01' }, { do: 'relogon', dev: 'PC-02' }] },
  traps: ['Bloquer l’héritage sur l’OU Postes ne protège pas contre une GPO « Appliquée » du niveau supérieur.', 'Modifier GPO_Postes_Securite n’a aucun effet : elle est déjà correcte.'],
  optimal: ['gpresult /h sur un poste : GPO gagnante', 'Repérer GPO_Poste_Parametres_Test (domaine, Appliqué)', 'Retirer l’option Appliqué ou supprimer la GPO', 'gpupdate /force sur les postes', 'Vérifier la valeur appliquée'] });

add({ id: 'gpo_sysvol', level: 3, title: 'SYSVOL inaccessible : les GPO ne se téléchargent plus', skills: ['gpo', 'diag-gpo', 'ad-install', 'diag'],
  vary: { m: [
    { key: 'partage', sets: [{ do: 'del', path: 'SRV-DC1.win.shares[name=SYSVOL]' }], fixes: [{ do: 'push', path: 'SRV-DC1.win.shares', item: { name: 'SYSVOL', path: 'C:\\Windows\\SYSVOL\\sysvol', comment: 'Partage du serveur d’accès', perms: [{ who: 'Utilisateurs authentifiés', access: 'Read' }] } }] },
    { key: 'serveur', sets: [{ do: 'svc', dev: 'SRV-DC1', name: 'LanmanServer', state: 'stopped' }], fixes: [{ do: 'svc', dev: 'SRV-DC1', name: 'LanmanServer', state: 'running' }] }
  ] },
  ticket: tk('Bruno Durand (les RH)', '« gpupdate » en erreur sur mon poste', 'Bonjour, un technicien m’a demandé de lancer gpupdate /force et ça affiche des erreurs. Depuis, mes nouveaux paramètres ne sont plus pris en compte alors que l’ancien lien avec le domaine semble fonctionner (je peux ouvrir ma session).'),
  cause: 'Les postes localisent bien le contrôleur mais ne peuvent plus lire SYSVOL (partage supprimé ou service Serveur arrêté sur le DC) : le traitement de la stratégie de groupe échoue (événement 1058 de GroupPolicy).',
  solution: 'Rétablir le partage SYSVOL / démarrer le service Serveur sur le DC, vérifier NETLOGON et SYSVOL (net share), puis gpupdate /force.',
  hints: ['gpupdate affiche une erreur d’accès au dossier SYSVOL : cherchez l’Event ID de GroupPolicy dans le journal Système du poste.', 'Depuis le poste, tentez d’ouvrir \\\\SRV-DC1\\SYSVOL. Que répond-il ?', 'Sur le DC, vérifiez les partages (net share) et le service Serveur ; corrigez puis relancez gpupdate /force.'],
  inject: '{{m.sets}}',
  probes: [{ t: 'gpfetch', host: 'PC-02' }, { t: 'gpfetch', host: 'PC-01', hidden: true }],
  roots: [{ probe: { t: 'gpfetch', host: 'PC-02' } }],
  fix: '{{m.fixes}}',
  traps: ['Réinstaller les stratégies ou vider le cache de GPO du poste est inutile : la source (SYSVOL) est inaccessible.'],
  optimal: ['gpupdate /force : erreur', 'Journal Système : événement GroupPolicy 1058', 'Tester \\\\SRV-DC1\\SYSVOL', 'Rétablir le partage / le service Serveur', 'Relancer gpupdate /force'] });

add({ id: 'gpo_compte', level: 4, title: 'Seuil de verrouillage fixé à 1 dans la stratégie de domaine', skills: ['gpo-compte', 'ad-compte', 'diag-gpo', 'diag'],
  ticket: tk('Plusieurs utilisateurs', 'Les comptes se verrouillent à la moindre faute de frappe', 'Bonjour, depuis ce matin plusieurs d’entre nous se retrouvent avec un compte verrouillé après une seule erreur de mot de passe. Avant il fallait se tromper plusieurs fois. Le technicien d’astreinte a déverrouillé Alice mais ça recommence dès qu’elle se trompe.'),
  cause: 'Le seuil de verrouillage de compte a été fixé à 1 dans la « Default Domain Policy » (modification récente). Une GPO liée à une OU ne pilote pas les stratégies de compte du domaine : seule la GPO liée à la racine du domaine compte.',
  solution: 'Corriger le seuil dans la Default Domain Policy (ou la GPO liée à la racine du domaine) — valeur de l’entreprise : 5 — puis gpupdate /force sur le contrôleur et déverrouiller les comptes touchés.',
  hints: ['Le déverrouillage ne dure pas : la cause est la stratégie, pas les comptes.', 'Les stratégies de compte du domaine se règlent dans une GPO liée à la RACINE du domaine. Laquelle contient « Seuil de verrouillage » ?', 'Corrigez la valeur à 5 dans Default Domain Policy, gpupdate /force sur le DC, puis déverrouillez les comptes.'],
  inject: [{ do: 'push', path: gpo('GPO1') + '.settings', item: { scope: 'computer', id: 'acct.lockoutThreshold', value: 1, label: 'Seuil de verrouillage du compte' } }, { do: 'push', path: gpo('GPO2') + '.settings', item: { scope: 'computer', id: 'acct.lockoutThreshold', value: 5, label: 'Seuil de verrouillage du compte' } }, { do: 'ad.lock', domain: DOM, sam: 'a.martin' }],
  probes: [{ t: 'policy', domain: DOM, key: 'lockoutThreshold', eq: 5 }, { t: 'login', host: 'PC-01', user: 'a.martin' }],
  roots: [{ any: [{ path: gpo('GPO1') + '.settings[id=acct.lockoutThreshold].value', eq: 5 }, { path: gpo('GPO1') + '.settings[id=acct.lockoutThreshold]', isNull: true }] }, { path: uSelLocked(), ne: true }],
  fix: [{ do: 'set', path: gpo('GPO1') + '.settings[id=acct.lockoutThreshold].value', value: 5 }, { do: 'ad.unlock', domain: DOM, sam: 'a.martin' }],
  traps: ['Modifier la GPO de l’OU Postes (qui affiche déjà 5) n’a aucun effet sur les comptes du domaine.', 'Déverrouiller les comptes un à un sans corriger la stratégie recrée le problème au prochain essai raté.'],
  optimal: ['Constater les verrouillages à répétition', 'Lire la stratégie de mot de passe/verrouillage effective du domaine', 'Trouver la GPO liée à la racine qui définit le seuil', 'Corriger à 5', 'Déverrouiller et retester'] });
function uSelLocked() { return 'SRV-DC1.win.ad.users[sam=a.martin].locked'; }

add({ id: 'ad_ou_move', level: 3, title: 'Poste déplacé hors de son OU : GPO plus appliquées', skills: ['ad-ou', 'gpo', 'diag-gpo', 'diag'],
  vary: { c: [{ host: 'PC-01', user: 'a.martin' }, { host: 'PC-02', user: 'b.durand' }] },
  ticket: tk('Responsable sécurité', 'Audit : un poste ne verrouille plus l’écran', 'Bonjour, l’audit remonte qu’un des postes ({{c.host}}) n’applique plus la politique de sécurité des postes (verrouillage d’écran à 15 min), alors que les autres l’appliquent. Il a été réinstallé la semaine dernière. Merci de vérifier.'),
  cause: 'Le compte ordinateur {{c.host}} se trouve dans le conteneur « Computers » (par défaut lors de la réinstallation) au lieu de l’OU Postes : la GPO « GPO_Postes_Securite » liée à l’OU ne lui est pas appliquée.',
  solution: 'Déplacer le compte ordinateur dans l’OU Postes (Utilisateurs et ordinateurs AD), puis gpupdate /force sur le poste (et redémarrage si nécessaire).',
  hints: ['La politique est correcte et appliquée aux autres postes : comparez gpresult de ce poste à celui d’un autre.', 'Dans l’annuaire, regardez dans quel conteneur / quelle OU se trouve le compte ordinateur.', 'Déplacez-le dans l’OU Postes puis gpupdate /force.'],
  inject: [{ do: 'set', path: 'SRV-DC1.win.ad.computers[name={{c.host}}].ou', value: 'CN=Computers,DC=toulouse,DC=local' }, { do: 'relogon', dev: '{{c.host}}', user: '{{c.user}}' }],
  probes: [{ t: 'gpo', host: '{{c.host}}', scope: 'computer', setting: 'screensaver.timeout', expect: 900 }],
  roots: [{ path: 'SRV-DC1.win.ad.computers[name={{c.host}}].ou', eq: 'OU=Postes,DC=toulouse,DC=local' }],
  fix: [{ do: 'set', path: 'SRV-DC1.win.ad.computers[name={{c.host}}].ou', value: 'OU=Postes,DC=toulouse,DC=local' }, { do: 'relogon', dev: '{{c.host}}', user: '{{c.user}}' }],
  traps: ['Dupliquer la GPO sur le conteneur Computers est impossible (on ne lie pas à un conteneur) ; la bonne solution est de ranger l’objet dans la bonne OU.'],
  optimal: ['gpresult /r : GPO Postes absente', 'Comparer avec un poste conforme', 'Localiser le compte ordinateur dans l’annuaire', 'Déplacer dans l’OU Postes', 'gpupdate /force et vérifier'] });

/* ======================= IIS : contenu, droits, certificats ======================= */
add({ id: 'web_default_doc', level: 2, title: 'IIS : document par défaut introuvable (403.14)', skills: ['iis', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Le site de l’intranet affiche « interdit »', 'Bonjour, quand j’ouvre http://srv-fic.toulouse.local j’obtiens une erreur 403 « interdit » alors que ça marchait avant. Le webmaster a mis en ligne une nouvelle page d’accueil hier.'),
  cause: 'La page d’accueil a été remplacée par « accueil.html », absente de la liste des documents par défaut du site : IIS ne trouve aucun document par défaut et l’exploration de répertoire est désactivée (HTTP 403.14).',
  solution: 'Ajouter « accueil.html » aux documents par défaut du site (ou nommer le fichier Default.htm / index.html). Ne pas activer l’exploration de répertoire.',
  hints: ['Le code précis est 403.14 : IIS dit qu’il n’y a pas de document par défaut configuré.', 'Dans le Gestionnaire IIS → site → « Document par défaut » : la liste contient-elle le nom du fichier publié ?', 'Ajoutez accueil.html à la liste, ou renommez le fichier selon un nom de la liste.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].files', value: ['accueil.html'] }, { do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].content', value: { 'accueil.html': { title: 'SRV-FIC — Accueil', html: '<h1>Intranet FormaTech</h1><p>Nouvelle page d’accueil.</p>' } } }],
  probes: [{ t: 'http', from: 'PC-02', url: 'http://srv-fic.toulouse.local/' }],
  roots: [{ any: [{ path: 'SRV-FIC.win.iis.sites[id=1].defaultDocs', has: 'accueil.html' }, { path: 'SRV-FIC.win.iis.sites[id=1].files', eq: ['iisstart.htm'] }] }],
  fix: [{ do: 'push', path: 'SRV-FIC.win.iis.sites[id=1].defaultDocs', item: 'accueil.html' }],
  workarounds: { 'exploration': [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=1].dirBrowse', value: true }] },
  traps: ['Activer « Exploration de répertoire » fait disparaître l’erreur mais expose le contenu du dossier du site.'],
  optimal: ['Reproduire l’erreur dans le navigateur (403.14)', 'IIS → site → Document par défaut', 'Ajouter le nom du fichier publié', 'Retester l’URL'] });

add({ id: 'web_pool', level: 2, title: 'IIS : pool d’applications arrêté (503)', skills: ['iis', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Le site intranet affiche « Service indisponible »', 'Bonjour, quand j’ouvre l’intranet j’ai « Service Unavailable ». Le serveur est allumé et je peux atteindre les dossiers partagés. Le problème a commencé après le passage du technicien hier soir.'),
  cause: 'Le pool d’applications « DefaultAppPool » est arrêté (arrêt manuel ou protection contre les défaillances rapides) : IIS répond HTTP 503 pour les sites qui l’utilisent.',
  solution: 'Démarrer le pool d’applications dans le Gestionnaire IIS, puis rechercher la cause de l’arrêt dans l’Observateur d’événements.',
  hints: ['HTTP 503 = le serveur web répond mais l’application derrière est indisponible.', 'Gestionnaire IIS → Pools d’applications : l’état de DefaultAppPool ?', 'Démarrez le pool puis retestez ; consultez le journal Système/Application pour la cause.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.iis.appPools[name=DefaultAppPool].state', value: 'stopped' }],
  probes: [{ t: 'http', from: 'PC-02', url: 'http://srv-fic.toulouse.local/' }, { t: 'http', from: 'PC-02', url: 'http://portail.toulouse.local:8080/', hidden: true }],
  roots: [{ path: 'SRV-FIC.win.iis.appPools[name=DefaultAppPool].state', eq: 'started' }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.iis.appPools[name=DefaultAppPool].state', value: 'started' }],
  traps: ['Redémarrer tout le serveur ou le service W3SVC ne relance pas un pool arrêté manuellement.'],
  optimal: ['Reproduire l’erreur 503', 'IIS → Pools d’applications', 'Démarrer DefaultAppPool', 'Retester les deux sites'] });

add({ id: 'web_ntfs', level: 3, title: 'IIS : droits NTFS insuffisants sur le dossier du site (401.3)', skills: ['iis', 'ntfs-partage', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Le portail interne demande un mot de passe puis refuse l’accès', 'Bonjour, le portail interne http://portail.toulouse.local:8080 me répond « non autorisé » (401). Le site fonctionnait jusqu’à ce que quelqu’un « nettoie les droits » du dossier du portail. L’autre site du serveur marche normalement.'),
  cause: 'L’héritage a été coupé sur C:\\inetpub\\portail et les entrées IIS_IUSRS / IUSR ont été supprimées : l’identité anonyme d’IIS n’a plus de droit de lecture (HTTP 401.3).',
  solution: 'Rétablir pour IIS_IUSRS (lecture et exécution) sur le dossier du site (ou réactiver l’héritage), sans donner Tout le monde / Contrôle total.',
  hints: ['401.3 : IIS est joignable, mais l’identité d’accès au contenu n’a pas la permission NTFS.', 'Propriétés du dossier du site → Sécurité : les comptes IIS_IUSRS / IUSR sont-ils présents ?', 'Ajoutez IIS_IUSRS en lecture/exécution (ou réactivez l’héritage) puis retestez.'],
  inject: [{ do: 'set', path: ntfs('C:\\inetpub\\portail'), value: { inherit: false, owner: 'BUILTIN\\Administrateurs', acl: [{ who: 'NT AUTHORITY\\Système', type: 'allow', rights: 'FullControl', applies: 'this+sub' }, { who: 'BUILTIN\\Administrateurs', type: 'allow', rights: 'FullControl', applies: 'this+sub' }] } }],
  probes: [{ t: 'http', from: 'PC-02', url: 'http://portail.toulouse.local:8080/' }],
  roots: [{ probe: { t: 'ace', dev: 'SRV-FIC', path: 'C:\\inetpub\\portail', who: 'BUILTIN\\IIS_IUSRS', min: 1 } }],
  fix: [{ do: 'push', path: ntfs('C:\\inetpub\\portail.acl'), item: { who: 'BUILTIN\\IIS_IUSRS', type: 'allow', rights: 'ReadAndExecute', applies: 'this+sub' } }],
  workarounds: { 'tout-le-monde': [{ do: 'push', path: ntfs('C:\\inetpub\\portail.acl'), item: { who: 'Tout le monde', type: 'allow', rights: 'FullControl', applies: 'this+sub' } }] },
  traps: ['Donner Contrôle total à Tout le monde sur un dossier web est une faute de sécurité majeure.'],
  optimal: ['Reproduire l’erreur (401.3)', 'Sécurité NTFS du dossier du site', 'Ajouter IIS_IUSRS en lecture/exécution', 'Retester'] });

add({ id: 'web_cert_expired', level: 3, title: 'IIS : certificat HTTPS expiré', skills: ['iis', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Avertissement de sécurité sur le site intranet en HTTPS', 'Bonjour, quand j’ouvre https://srv-fic.toulouse.local mon navigateur affiche une grosse page rouge « Votre connexion n’est pas privée ». Mon collègue a cliqué sur « Continuer quand même » mais le service sécurité dit qu’on ne doit pas faire ça.'),
  cause: 'Le certificat associé à la liaison HTTPS du site a expiré : les navigateurs affichent ERR_CERT_DATE_INVALID.',
  solution: 'Renouveler le certificat de SRV-FIC (demande à l’autorité de certification interne) et le réassocier à la liaison HTTPS du site.',
  hints: ['L’erreur du navigateur donne le code précis : regardez les détails du certificat (dates).', 'Sur le serveur : certificats de l’ordinateur local → date d’expiration du certificat lié à la liaison HTTPS.', 'Renouvelez le certificat auprès de l’autorité interne puis associez-le à la liaison HTTPS du site.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.certs[cn=srv-fic.toulouse.local].notAfter', value: '2026-10-20' }],
  probes: [{ t: 'http', from: 'PC-02', url: 'https://srv-fic.toulouse.local/' }],
  roots: [{ probe: { t: 'certvalid', dev: 'SRV-FIC', cn: 'srv-fic.toulouse.local' } }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.certs[cn=srv-fic.toulouse.local].notAfter', value: '2028-10-27' }],
  traps: ['Demander aux utilisateurs de « continuer quand même » habitue à ignorer les alertes TLS.', 'Passer le site en HTTP supprime le chiffrement.'],
  optimal: ['Reproduire l’alerte dans le navigateur', 'Ouvrir les détails du certificat (dates)', 'Renouveler le certificat sur le serveur', 'Associer le nouveau certificat à la liaison HTTPS', 'Retester sans alerte'] });

add({ id: 'web_cert_cn', level: 3, title: 'IIS : certificat HTTPS ne correspondant pas au nom du site', skills: ['iis', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Alerte « nom du certificat non valide » sur le portail', 'Bonjour, depuis la mise en place du HTTPS sur le portail, https://portail.toulouse.local affiche une erreur « le certificat ne correspond pas au nom du site ». L’intranet principal en HTTPS n’a pas ce problème.'),
  cause: 'La liaison HTTPS du site « Portail » utilise le certificat de srv-fic.toulouse.local au lieu du certificat dont le nom est portail.toulouse.local : le nom demandé ne figure pas dans le certificat (ERR_CERT_COMMON_NAME_INVALID).',
  solution: 'Modifier la liaison HTTPS du site Portail pour lui associer le certificat portail.toulouse.local.',
  hints: ['L’alerte parle de nom : comparez l’URL tapée et le CN/SAN du certificat présenté.', 'IIS → site Portail → Liaisons → https : quel certificat est sélectionné ?', 'Choisissez le certificat portail.toulouse.local pour cette liaison.'],
  inject: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=2].bindings[1].cert', value: 'srv-fic.toulouse.local' }],
  probes: [{ t: 'http', from: 'PC-02', url: 'https://portail.toulouse.local/' }],
  roots: [{ path: 'SRV-FIC.win.iis.sites[id=2].bindings[1].cert', eq: 'portail.toulouse.local' }],
  fix: [{ do: 'set', path: 'SRV-FIC.win.iis.sites[id=2].bindings[1].cert', value: 'portail.toulouse.local' }],
  traps: ['Accéder au portail par son adresse IP donne une autre erreur (nom non listé) : ce n’est pas une correction.'],
  optimal: ['Reproduire l’alerte', 'Lire le nom présenté dans le certificat', 'IIS : liaisons du site Portail', 'Sélectionner le bon certificat', 'Retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
