/* ============================================================================
   Pannes — lot B : Active Directory, comptes, GPO, partages & droits NTFS, IIS (contenu, droits, certificats).
   Données pures (JSON-compatibles). Variantes `vary`, gabarits {{x}}.
   Les symptômes ne sont jamais écrits : ils découlent de l'état du monde modifié.
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
const uSel = sam => 'SRV-DC1.win.ad.users[sam=' + sam + ']';
const gpo = id => 'SRV-DC1.win.ad.gpos[id=' + id + ']';
const loginProbe = [{ t: 'login', host: '{{u.host}}', user: '{{u.sam}}' }];

/* ======================= COMPTES ======================= */
add({ id: 'ad_locked', level: 1, title: 'Compte utilisateur verrouillé', skills: ['ad-compte', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Impossible d’ouvrir ma session', 'Bonjour, ce matin mon mot de passe est refusé alors que je suis sûr(e) de le connaître. J’ai essayé plusieurs fois avec la touche majuscule enfoncée par erreur et maintenant l’ordinateur me dit que mon compte est bloqué. Pouvez-vous me débloquer ?'),
  cause: 'Plusieurs saisies erronées ont atteint le seuil de verrouillage : le compte est verrouillé dans Active Directory (le mot de passe est correct).',
  solution: 'Dans « Utilisateurs et ordinateurs Active Directory », ouvrir le compte → onglet Compte → cocher « Débloquer le compte ». (Il se débloquerait aussi seul à l’issue de la durée de verrouillage.)',
  hints: ['Le message à l’écran parle d’un compte « verrouillé » et non d’un mot de passe incorrect : le problème est côté annuaire, pas côté poste.', 'Regardez l’état du compte dans Utilisateurs et ordinateurs Active Directory, onglet Compte.', 'Cochez « Débloquer le compte » puis faites retester l’ouverture de session.'],
  inject: [{ do: 'ad.lock', domain: DOM, sam: '{{u.sam}}' }],
  probes: loginProbe,
  roots: [{ path: uSel('{{u.sam}}') + '.locked', ne: true }],
  fix: [{ do: 'ad.unlock', domain: DOM, sam: '{{u.sam}}' }],
  fixes: { attendre: [{ do: 'tick', sec: 960 }] },
  traps: ['Réinitialiser le mot de passe ne déverrouille pas le compte : la case « Débloquer » est distincte.', 'Assouplir la stratégie de verrouillage du domaine pour « régler » un cas isolé affaiblit la sécurité de tous.'],
  optimal: ['Lire le message exact affiché au poste', 'Ouvrir Utilisateurs et ordinateurs Active Directory sur le contrôleur', 'Rechercher le compte → onglet Compte', 'Débloquer le compte', 'Faire retester l’ouverture de session'] });

add({ id: 'ad_disabled', level: 1, title: 'Compte utilisateur désactivé par erreur', skills: ['ad-compte', 'ad-ou', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Mon compte ne marche plus ce matin', 'Bonjour, je reviens de congés et mon identifiant ne fonctionne plus : l’écran me dit que mon compte a été désactivé. Je n’ai rien fait de particulier. Merci de regarder rapidement, j’ai du travail en retard.'),
  cause: 'Le compte a été désactivé dans Active Directory (nettoyage des comptes des personnes absentes) alors que la personne est de retour.',
  solution: 'Dans Utilisateurs et ordinateurs Active Directory : clic droit sur le compte → « Activer le compte ».',
  hints: ['Le message est explicite : « compte désactivé ». Aucun intérêt à toucher au poste.', 'Dans Utilisateurs et ordinateurs Active Directory, un compte désactivé est affiché avec une flèche vers le bas.', 'Clic droit sur le compte → Activer le compte, puis refaire tester.'],
  inject: [{ do: 'set', path: uSel('{{u.sam}}') + '.enabled', value: false }],
  probes: loginProbe,
  roots: [{ path: uSel('{{u.sam}}') + '.enabled', ne: false }],
  fix: [{ do: 'set', path: uSel('{{u.sam}}') + '.enabled', value: true }],
  traps: ['Réinitialiser le mot de passe ou le déverrouiller ne change rien : le compte reste désactivé.'],
  optimal: ['Lire le message d’erreur', 'Ouvrir Utilisateurs et ordinateurs Active Directory', 'Activer le compte', 'Faire retester l’ouverture de session'] });

add({ id: 'ad_pwd_expired', level: 2, title: 'Mot de passe expiré', skills: ['ad-compte', 'gpo-compte', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Mot de passe refusé depuis ce matin', 'Bonjour, mon mot de passe ne passe plus. Je n’ai pourtant pas fait de faute de frappe. Mon collègue m’a dit qu’il fallait peut-être le changer mais je n’ai reçu aucun message. Pouvez-vous m’aider ?'),
  cause: 'L’âge maximal du mot de passe (stratégie de domaine) est dépassé : le mot de passe a expiré et l’utilisateur doit en définir un nouveau.',
  solution: 'Réinitialiser le mot de passe en imposant le changement à la prochaine ouverture de session (ou laisser l’utilisateur le changer à l’écran de connexion). Ne pas cocher « Le mot de passe n’expire jamais » pour un compte nominatif.',
  hints: ['Regardez l’onglet Compte de l’utilisateur et la stratégie de mot de passe du domaine (âge maximal).', 'Le mot de passe a plus de jours que la durée maximale autorisée. Il faut en définir un nouveau.', 'Réinitialisez le mot de passe en cochant « L’utilisateur doit changer le mot de passe à la prochaine ouverture de session ».'],
  inject: [{ do: 'set', path: uSel('{{u.sam}}') + '.pwdSetDays', value: 95 }],
  probes: loginProbe,
  roots: [{ path: uSel('{{u.sam}}') + '.pwdSetDays', lt: 90 }],
  fix: [{ do: 'ad.pwd', domain: DOM, sam: '{{u.sam}}', pwd: 'Nouveau#Mdp26', mustChange: true }],
  workarounds: { 'sans-expiration': [{ do: 'set', path: uSel('{{u.sam}}') + '.pwdNeverExpires', value: true }] },
  traps: ['Cocher « Le mot de passe n’expire jamais » fait disparaître le symptôme mais contourne la stratégie de sécurité du domaine.'],
  optimal: ['Lire le message', 'Vérifier l’âge du mot de passe et la stratégie de domaine', 'Réinitialiser le mot de passe avec changement obligatoire', 'Faire retester'] });

add({ id: 'ad_acct_expired', level: 2, title: 'Compte utilisateur expiré (contrat prolongé)', skills: ['ad-compte', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Message « compte expiré » à la connexion', 'Bonjour, mon contrat vient d’être prolongé jusqu’au printemps mais ce matin l’ordinateur affiche que mon compte a expiré. Mon responsable dit avoir prévenu l’informatique. Je ne peux plus travailler.'),
  cause: 'La date d’expiration du compte (onglet Compte) est dépassée alors que le contrat a été prolongé.',
  solution: 'Modifier « Le compte expire » : choisir une nouvelle date ou « Jamais » (selon la politique de l’entreprise).',
  hints: ['Le message parle d’expiration du compte, pas du mot de passe : deux choses différentes.', 'Onglet Compte du compte utilisateur : section « Le compte expire ».', 'Définissez la nouvelle date de fin (ou « Jamais ») puis faites retester.'],
  inject: [{ do: 'set', path: uSel('{{u.sam}}') + '.expires', value: '2026-10-25' }],
  probes: loginProbe,
  roots: [{ any: [{ path: uSel('{{u.sam}}') + '.expires', isNull: true }, { path: uSel('{{u.sam}}') + '.expires', gt: '2026-11-27' }] }],
  fix: [{ do: 'set', path: uSel('{{u.sam}}') + '.expires', value: '2027-04-30' }],
  fixes: { jamais: [{ do: 'set', path: uSel('{{u.sam}}') + '.expires', value: null }] },
  traps: ['Réinitialiser le mot de passe ne sert à rien : l’expiration du compte est indépendante.'],
  optimal: ['Lire le message exact', 'Ouvrir le compte → onglet Compte', 'Corriger la date d’expiration', 'Faire retester'] });

add({ id: 'ad_restrict', level: 3, title: 'Restriction d’horaires ou de poste sur le compte', skills: ['ad-compte', 'diag'],
  vary: { u: USERS, m: [
    { key: 'hours', label: 'horaires', sets: [{ do: 'set', path: uSel('{{u.sam}}') + '.logonHours', value: { deny: [{ day: 2, from: 0, to: 24 }] } }], fixes: [{ do: 'set', path: uSel('{{u.sam}}') + '.logonHours', value: null }], root: { path: uSel('{{u.sam}}') + '.logonHours', isNull: true } },
    { key: 'ws', label: 'poste', sets: [{ do: 'set', path: uSel('{{u.sam}}') + '.allowedWorkstations', value: ['PC-ADM'] }], fixes: [{ do: 'set', path: uSel('{{u.sam}}') + '.allowedWorkstations', value: [] }], root: { path: uSel('{{u.sam}}') + '.allowedWorkstations', eq: [] } }
  ] },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Connexion refusée : restriction sur mon compte', 'Bonjour, depuis ce matin impossible d’ouvrir ma session, l’ordinateur affiche un message sur une restriction de mon compte. Hier encore tout fonctionnait. Mon mot de passe est bon.'),
  cause: 'Le compte est soumis à une restriction (heures de connexion interdites ou liste de postes autorisés) qui ne correspond plus à la situation réelle.',
  solution: 'Dans les propriétés du compte (onglet Compte), retirer la restriction : « Se connecter à… » (postes autorisés) ou « Horaires d’accès ».',
  hints: ['Le mot de passe est correct et le compte n’est ni verrouillé ni désactivé : cherchez une restriction du compte.', 'Onglet Compte : deux boutons « Horaires d’accès… » et « Se connecter à… ».', 'Retirez la restriction qui bloque (jour entier interdit, ou poste non listé).'],
  inject: '{{m.sets}}',
  probes: loginProbe,
  roots: ['{{m.root}}'],
  fix: '{{m.fixes}}',
  traps: ['Désactiver la stratégie de verrouillage ou changer le mot de passe n’a aucun effet sur ces restrictions.'],
  optimal: ['Lire le message exact', 'Vérifier verrouillage / désactivation / expiration (négatif)', 'Onglet Compte : horaires et postes autorisés', 'Retirer la restriction', 'Faire retester'] });

add({ id: 'ad_time', level: 2, title: 'Horloge du poste décalée (Kerberos)', skills: ['ad-compte', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Connexion impossible après changement de pile de l’horloge', 'Bonjour, hier soir il y a eu une coupure de courant dans le bureau et ce matin l’heure affichée par mon poste est fausse de presque un quart d’heure. Maintenant je n’arrive plus à ouvrir ma session, l’ordinateur parle d’une différence de date et d’heure.'),
  cause: 'L’horloge du poste dérive de plus de 5 minutes par rapport au contrôleur de domaine : Kerberos refuse l’authentification.',
  solution: 'Resynchroniser l’heure du poste avec le domaine (w32tm /resync, ou régler la date/l’heure et le fuseau) puis retester.',
  hints: ['L’erreur évoque une différence de temps : comparez l’heure du poste à celle du contrôleur de domaine.', 'Kerberos tolère 5 minutes d’écart par défaut. Ici l’écart est supérieur.', 'Resynchronisez l’heure avec le domaine (w32tm /resync) puis retestez l’ouverture de session.'],
  inject: [{ do: 'set', path: '{{u.host}}.clockSkewMin', value: 17 }],
  probes: loginProbe,
  roots: [{ path: '{{u.host}}.clockSkewMin', lte: 4 }],
  fix: [{ do: 'set', path: '{{u.host}}.clockSkewMin', value: 0 }],
  traps: ['Changer le mot de passe ou débloquer le compte n’apporte rien : le compte est sain.'],
  optimal: ['Lire le message d’erreur', 'Comparer l’heure du poste à celle du DC', 'Resynchroniser l’heure du poste', 'Faire retester'] });

add({ id: 'ad_time_dc', level: 4, title: 'Dérive d’horloge du contrôleur de domaine', skills: ['ad-compte', 'diag'],
  ticket: tk('Plusieurs utilisateurs', 'Plus personne ne peut se connecter depuis la fin de matinée', 'Bonjour, depuis une heure environ les collègues n’arrivent plus à ouvrir leur session ou à accéder aux dossiers, alors que le serveur répond au ping. Le problème touche tout le monde en même temps. Je n’ai rien modifié.'),
  cause: 'L’horloge du contrôleur de domaine a dérivé d’environ neuf minutes (source de temps absente ou mauvaise synchronisation de l’hôte de virtualisation) : tous les clients sont en échec Kerberos.',
  solution: 'Corriger l’heure du contrôleur (PDC) et sa source de temps (w32tm /config /syncfromflags:manual /manualpeerlist:… puis /resync). Les postes se resynchronisent ensuite sur le domaine.',
  hints: ['Tous les utilisateurs sont touchés en même temps : suspectez un composant central plutôt que chaque poste.', 'Comparez l’heure du contrôleur de domaine avec celle d’un poste ou d’un serveur membre.', 'Corrigez l’heure du contrôleur (et sa source de temps), puis testez une ouverture de session.'],
  inject: [{ do: 'set', path: 'SRV-DC1.clockSkewMin', value: 9 }],
  probes: [{ t: 'login', host: 'PC-01', user: 'a.martin' }, { t: 'login', host: 'PC-02', user: 'b.durand' }],
  roots: [{ path: 'SRV-DC1.clockSkewMin', lte: 4 }],
  fix: [{ do: 'set', path: 'SRV-DC1.clockSkewMin', value: 0 }],
  traps: ['Rebooter ou resynchroniser les postes un par un ne sert à rien si la référence (le DC) est fausse.'],
  optimal: ['Constater que le problème est général', 'Comparer l’heure DC / postes', 'Corriger la source de temps du DC', 'Faire retester plusieurs sessions'] });

add({ id: 'ad_secure_channel', level: 3, title: 'Relation d’approbation poste ↔ domaine rompue', skills: ['ad-compte', 'ad-ou', 'diag'],
  vary: { c: [{ host: 'PC-01', user: 'a.martin', name: 'Alice Martin', svc: 'la comptabilité' }, { host: 'PC-02', user: 'b.durand', name: 'Bruno Durand', svc: 'les RH' }],
    m: [{ key: 'canal', path: '{{c.host}}.win.secureChannel', bad: false, good: true, why: 'le mot de passe du compte ordinateur n’est plus synchronisé avec l’annuaire (canal sécurisé rompu)' },
        { key: 'compte', path: 'SRV-DC1.win.ad.computers[name={{c.host}}].enabled', bad: false, good: true, why: 'le compte ordinateur a été désactivé dans l’annuaire' }] },
  ticket: tk('{{c.name}} ({{c.svc}})', 'Message sur la relation d’approbation à la connexion', 'Bonjour, à l’ouverture de session je reçois « La relation d’approbation entre cette station de travail et le domaine principal a échoué ». Le poste revient d’une restauration d’image faite par un technicien la semaine dernière. Mon mot de passe est bon, j’ai vérifié avec un collègue.'),
  cause: 'Le poste n’est plus reconnu par le domaine : {{m.why}}. Les identifiants de l’utilisateur n’y sont pour rien.',
  solution: 'Réparer le canal sécurisé : (Test-ComputerSecureChannel -Repair / Reset-ComputerMachinePassword), ou réactiver le compte ordinateur, ou sortir et rejoindre le domaine avec un compte autorisé.',
  hints: ['Le message ne concerne pas le mot de passe de l’utilisateur mais le compte de l’ordinateur dans le domaine.', 'Dans l’annuaire, regardez le compte ordinateur du poste (activé ? existant ?). Côté poste, testez le canal sécurisé.', 'Réactivez le compte ordinateur ou réparez le canal (Test-ComputerSecureChannel -Repair ; ou sortir/rejoindre le domaine).'],
  inject: [{ do: 'set', path: '{{m.path}}', value: '{{m.bad}}' }],
  probes: [{ t: 'login', host: '{{c.host}}', user: '{{c.user}}' }],
  roots: [{ path: '{{m.path}}', ne: '{{m.bad}}' }],
  fix: [{ do: 'set', path: '{{m.path}}', value: '{{m.good}}' }],
  traps: ['Réinitialiser le mot de passe de l’utilisateur est inutile : l’erreur vient de la machine.', 'Une ouverture avec un compte local ne règle pas l’appartenance au domaine.'],
  optimal: ['Lire le message exact', 'Chercher le compte ordinateur dans l’annuaire', 'Réactiver ou réparer le canal sécurisé', 'Faire retester la session'] });

add({ id: 'ad_dc_svc', level: 3, title: 'Service Active Directory arrêté sur le contrôleur', skills: ['ad-install', 'ad-compte', 'diag'],
  vary: { s: ['Netlogon', 'Kdc'] },
  ticket: tk('Alice Martin (la comptabilité)', 'Connexion lente puis « aucun serveur d’ouverture de session »', 'Bonjour, ce matin mon ordinateur est très long à démarrer et ensuite il dit qu’aucun serveur d’ouverture de session n’est disponible. Pourtant je peux ouvrir Windows avec mon mot de passe habituel mais je n’ai plus accès aux dossiers du serveur.'),
  cause: 'Le service « {{s}} » est arrêté sur le contrôleur de domaine SRV-DC1 : les clients ne peuvent plus s’authentifier auprès du domaine. L’ouverture de session en cache donne l’illusion que « ça marche ».',
  solution: 'Démarrer le service {{s}} sur SRV-DC1 (services.msc) et vérifier le démarrage automatique ; contrôler l’Observateur d’événements pour la cause de l’arrêt.',
  hints: ['Le poste est ouvert avec les informations en cache : sans accès aux ressources réseau, l’authentification au domaine ne passe pas.', 'Allez sur le contrôleur de domaine : services Active Directory (Netlogon, Centre de distribution de clés Kerberos).', 'Démarrez le service arrêté puis refaites une vraie ouverture de session (pas en cache).'],
  inject: [{ do: 'svc', dev: 'SRV-DC1', name: '{{s}}', state: 'stopped' }],
  probes: [{ t: 'login', host: 'PC-01', user: 'a.martin' }],
  roots: [{ probe: { t: 'svc', dev: 'SRV-DC1', name: '{{s}}' } }],
  fix: [{ do: 'svc', dev: 'SRV-DC1', name: '{{s}}', state: 'running' }],
  traps: ['L’ouverture de session en cache masque la panne : seul un accès à une ressource réseau prouve que l’authentification fonctionne.'],
  optimal: ['Constater l’ouverture en cache / ressources inaccessibles', 'Aller sur le DC', 'Voir les services AD arrêtés', 'Démarrer le service', 'Tester une vraie ouverture de session'] });

add({ id: 'ad_srv_missing', level: 3, title: 'Enregistrements SRV du contrôleur absents du DNS', skills: ['ad-install', 'dns', 'ad-compte', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Le domaine est « introuvable » depuis ce matin', 'Bonjour, mon poste affiche qu’il ne trouve plus le domaine et ne me laisse ouvrir que ma session mise en cache. Le serveur répond pourtant bien au ping. Un collègue a « nettoyé le DNS » hier soir.'),
  cause: 'Les enregistrements SRV du contrôleur (zone _msdcs) ont été supprimés lors d’un nettoyage du DNS : les clients ne localisent plus le contrôleur de domaine, bien que le serveur soit joignable.',
  solution: 'Faire ré-enregistrer le contrôleur : redémarrer le service Netlogon (net stop netlogon && net start netlogon) ou nltest /dsregdns, puis vérifier la zone _msdcs.',
  hints: ['Le ping vers le serveur marche : le problème n’est pas le réseau mais la localisation du service de domaine.', 'La localisation passe par des enregistrements SRV. Vérifiez la zone _msdcs.toulouse.local dans le DNS.', 'Forcez le ré-enregistrement (redémarrage de Netlogon ou nltest /dsregdns) puis retestez.'],
  inject: [{ do: 'del', path: 'SRV-DC1.win.dns.zones[name=_msdcs.toulouse.local].records[name=_ldap._tcp.dc]' }, { do: 'del', path: 'SRV-DC1.win.dns.zones[name=_msdcs.toulouse.local].records[name=_kerberos._tcp.dc]' }],
  probes: [{ t: 'login', host: 'PC-02', user: 'b.durand' }, { t: 'dc', host: 'PC-02' }],
  roots: [{ probe: { t: 'dc', host: 'PC-02' } }],
  fix: [{ do: 'ad.regdns', dev: 'SRV-DC1' }],
  fixes: { netlogon: [{ do: 'svc', dev: 'SRV-DC1', name: 'Netlogon', state: 'stopped' }, { do: 'svc', dev: 'SRV-DC1', name: 'Netlogon', state: 'running' }] },
  traps: ['Recréer à la main un enregistrement A pour le DC ne suffit pas : ce sont les SRV qui permettent la localisation.'],
  optimal: ['nslookup -type=SRV _ldap._tcp.dc._msdcs.toulouse.local', 'Constater l’absence de l’enregistrement', 'Ré-enregistrer le contrôleur (Netlogon)', 'Retester la localisation et la session'] });

add({ id: 'ad_trust', level: 3, title: 'Approbation entre domaines rompue (Toulouse ↔ Bordeaux)', skills: ['ad-trust', 'ntfs-partage', 'diag'],
  vary: { m: [
    { key: 'cassee', sets: [{ do: 'set', path: 'SRV-DC1.win.ad.trusts[target=bordeaux.local].state', value: 'broken' }], fixes: [{ do: 'set', path: 'SRV-DC1.win.ad.trusts[target=bordeaux.local].state', value: 'ok' }] },
    { key: 'absente', sets: [{ do: 'del', path: 'SRV-DC2.win.ad.trusts[target=toulouse.local]' }], fixes: [{ do: 'push', path: 'SRV-DC2.win.ad.trusts', item: { target: 'toulouse.local', direction: 'bidirectional', type: 'external', transitive: false, state: 'ok' } }] }
  ] },
  ticket: tk('Elena Garcia (Bordeaux)', 'Dossier commun de Toulouse inaccessible', 'Bonjour, depuis ce matin je n’arrive plus à ouvrir le dossier Commun du siège de Toulouse. Je me connecte à mon poste de Bordeaux sans problème, mais l’accès au serveur de Toulouse me demande des identifiants et refuse les miens.', 'bordeaux'),
  cause: 'L’approbation entre bordeaux.local et toulouse.local est invalide ou n’existe plus d’un côté : les utilisateurs de Bordeaux ne peuvent plus être authentifiés sur les ressources de Toulouse.',
  solution: 'Valider ou recréer l’approbation entre les deux domaines (Domaines et approbations Active Directory), des deux côtés, avec un compte administrateur de chaque domaine.',
  hints: ['La connexion locale à Bordeaux fonctionne : le problème est inter-domaines.', 'Ouvrez « Domaines et approbations Active Directory » sur les deux contrôleurs et comparez l’état de l’approbation.', 'Validez ou recréez l’approbation bidirectionnelle des deux côtés.'],
  inject: '{{m.sets}}',
  probes: [{ t: 'trust', a: 'toulouse.local', b: 'bordeaux.local' }, { t: 'share', from: 'PC-B1', user: 'e.garcia', unc: '\\\\srv-fic.toulouse.local\\Commun', want: 'write' }],
  roots: [{ probe: { t: 'trust', a: 'toulouse.local', b: 'bordeaux.local' } }],
  fix: '{{m.fixes}}',
  traps: ['Créer un compte local à Elena sur SRV-FIC contourne le problème en cassant la gestion centralisée des identités.'],
  optimal: ['Vérifier que le poste et le DNS de Bordeaux sont sains', 'Vérifier l’état de l’approbation des deux côtés', 'Valider ou recréer l’approbation', 'Retester l’accès à \\\\srv-fic\\Commun'] });

/* ======================= AGDLP / PARTAGES / NTFS ======================= */
add({ id: 'ad_agdlp_member', level: 2, title: 'Utilisateur retiré de son groupe global (AGDLP)', skills: ['agdlp', 'ntfs-partage', 'ad-compte', 'diag'],
  vary: { u: USERS },
  ticket: tk('{{u.name}} ({{u.svc}})', 'Accès refusé au dossier {{u.share}}', 'Bonjour, ce matin j’ouvre le dossier {{u.share}} du serveur et on me dit que je n’ai pas l’autorisation. Pourtant j’y accédais hier. Je n’ai changé aucun mot de passe.'),
  cause: 'L’utilisateur n’est plus membre du groupe global {{u.gg}} (retiré lors d’un ménage dans les groupes) : son jeton d’accès ne contient plus le groupe local de domaine qui porte les droits.',
  solution: 'Ré-ajouter l’utilisateur au groupe {{u.gg}} (le groupe global est membre de {{u.dl}}, qui porte la permission NTFS), puis faire fermer/rouvrir la session pour actualiser le jeton.',
  hints: ['Le poste, le réseau et le serveur répondent : c’est un refus d’autorisation. Qui est autorisé sur le dossier ?', 'Regardez la sécurité NTFS du dossier : un groupe local de domaine (DL_…) porte la permission. De qui est-il composé ?', 'Remettez l’utilisateur dans {{u.gg}} puis fermez/rouvrez sa session pour actualiser son jeton.'],
  inject: [{ do: 'ad.member.del', domain: DOM, group: '{{u.gg}}', member: '{{u.sam}}' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  probes: [{ t: 'share', from: '{{u.host}}', user: '{{u.sam}}', unc: '\\\\SRV-FIC\\{{u.share}}', want: 'write' }],
  roots: [{ path: 'SRV-DC1.win.ad.groups[name={{u.gg}}].members', has: '{{u.sam}}' }],
  fix: [{ do: 'ad.member.add', domain: DOM, group: '{{u.gg}}', member: '{{u.sam}}' }, { do: 'relogon', dev: '{{u.host}}', user: '{{u.sam}}' }],
  workarounds: { 'ace-direct': [{ do: 'push', path: 'SRV-FIC.win.ntfs.D:\\Partages\\{{u.share}}.acl', item: { who: 'TOULOUSE\\{{u.sam}}', type: 'allow', rights: 'Modify', applies: 'this+sub' } }] },
  traps: ['Ajouter l’utilisateur directement dans l’ACL NTFS règle le cas mais détruit le modèle AGDLP (non maintenable).', 'Ré-ajouter au groupe sans faire rouvrir la session ne suffit pas : le jeton d’accès est figé à l’ouverture.'],
  optimal: ['Constater un refus d’autorisation (pas un problème réseau)', 'Lire la sécurité du dossier (NTFS) et le partage', 'Identifier le groupe DL puis le GG', 'Constater l’absence de l’utilisateur dans le GG', 'Ré-ajouter, fermer/rouvrir la session, retester'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
