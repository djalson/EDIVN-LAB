/* ============================================================================
   Pannes — lot I : IDS / IPS Snort sur pfSense (compétence « snort »).
   Données pures. Pare-feu : pfsense-tls (Toulouse) ; instances Snort sur WAN (mode Legacy, blocage de la source)
   et sur LAN (alerte sur le Telnet sortant). Flux de référence, rejoués à blanc par la sonde « snort » :
     ATK = ping de PCEXT (Internet) vers l'adresse WAN du pare-feu → SID 1000001, source bloquée ;
     TEL = connexion TCP/23 de PC-02 (service RH) vers Internet → SID 1000003, jamais bloquée (liste de passage « default »).
   Les symptômes viennent du moteur (SIM.snort, pf) : rien n'est écrit en dur ici.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM; const add = f => SIM.faults.push(f);
const tk = (from, subject, body, site) => ({ from, subject, body, site: site || 'toulouse' });
SIM.AVREG['pannes-snort'] = 'Pannes du lot Snort : comportement de Snort face à une règle personnelle invalide (ici : l’instance ne démarre pas), à un HOME_NET personnalisé invalide (ne démarre pas), à un blocage sur l’adresse de destination protégée par la liste de passage (aucun blocage) et à la persistance de la table des hôtes bloqués après un test ; les textes de la Mise en route de Snort ne sont pas reproduits.';
const PF = 'pfsense-tls', PC = 'PC-02', PROF = 'FormaTech-Toulouse';
const WAN = PF + '.snort.ifaces[descr=WAN]', LAN = PF + '.snort.ifaces[descr=LAN]';
const ATK = { from: 'PCEXT', to: '198.51.100.2', proto: 'icmp' };
const SSH = { from: 'PCEXT', to: '198.51.100.2', proto: 'tcp', port: 22 };
const TEL = { from: PC, to: '93.184.216.34', proto: 'tcp', port: 23 };
const R1 = 'alert icmp $EXTERNAL_NET any -> $HOME_NET any (msg:"ICMP depuis Internet vers le pare-feu"; itype:8; classtype:icmp-event; sid:1000001; rev:1;)';
const R2 = 'alert tcp $EXTERNAL_NET any -> $HOME_NET 22 (msg:"Tentative de connexion SSH depuis Internet"; flags:S; classtype:attempted-admin; sid:1000002; rev:1;)';
const GOOD_WAN = R1 + '\n' + R2;
const BLK_PC02 = { ip: '10.10.20.60', ifk: 'lan', sid: 1000003, msg: 'Telnet sortant depuis le LAN', t: 0 };
const BLK_EXT = { ip: '198.18.0.10', ifk: 'wan', sid: 1000001, msg: 'ICMP depuis Internet vers le pare-feu', t: 0 };
const SUP = 'Supervision sécurité (alerte automatique)';
const RUN_WAN = { t: 'snort', run: { iface: 'wan', on: true } };
const ALERT = { t: 'snort', flow: Object.assign({ alert: 1000001 }, ATK) };
const BLOCK = { t: 'snort', flow: Object.assign({ alert: 1000001, block: true }, ATK) };

/* ======================= SERVICE ======================= */
add({ id: 'snort_service', level: 1, title: 'Snort ne surveille plus l’interface WAN', skills: ['snort', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'stop', label: 'l’instance Snort de l’interface WAN a été arrêtée (Services → Snort → Snort Interfaces, ou Status → Services)', stopped: true, enabled: true },
    { key: 'off', label: 'la case « Enable interface » de l’interface WAN a été décochée (Services → Snort → Snort Interfaces → WAN Settings)', stopped: false, enabled: false }
  ] },
  ticket: tk(SUP, 'Plus aucune alerte Snort depuis l’intervention de cette nuit', 'Notre sonde de test envoie un ping depuis un poste externe vers l’adresse publique du pare-feu et vérifie qu’une alerte Snort apparaît. Depuis ce matin, la liste des alertes reste vide. Aucune modification n’a été annoncée.'),
  cause: 'Sur pfSense, {{m.label}} : plus aucun paquet de l’interface WAN n’est analysé, donc aucune règle ne déclenche d’alerte.',
  solution: 'Démarrer (ou réactiver) l’instance Snort de l’interface WAN : Services → Snort → Snort Interfaces, icône de démarrage, ou cocher « Enable interface » puis enregistrer.',
  hints: ['La sonde de test n’obtient plus d’alerte : commencez par vérifier que Snort tourne bien sur l’interface surveillée.', 'Services → Snort → Snort Interfaces : regardez l’état de la ligne WAN (démarrée ou arrêtée) ; Status → Services affiche aussi les instances.', 'Si l’interface est arrêtée, utilisez l’icône de démarrage ; si elle est désactivée, cochez « Enable interface » dans ses réglages et enregistrez.'],
  inject: [{ do: 'set', path: WAN + '.stopped', value: '{{m.stopped}}' }, { do: 'set', path: WAN + '.enabled', value: '{{m.enabled}}' }],
  verify: ['ping:PCEXT:*', 'connect:PCEXT:*'],
  probes: [ALERT],
  roots: [{ path: WAN + '.stopped', eq: false }, { path: WAN + '.enabled', eq: true }],
  fix: [{ do: 'set', path: WAN + '.stopped', value: false }, { do: 'set', path: WAN + '.enabled', value: true }],
  traps: ['Ajouter une règle ou modifier HOME_NET alors que l’instance est arrêtée ne change rien : vérifiez d’abord l’état du service.', 'Réinstaller le paquet n’est pas nécessaire : la configuration est conservée.'],
  optimal: ['Constater l’absence d’alerte après le ping de test', 'Services → Snort → Snort Interfaces : ligne WAN arrêtée ou désactivée', 'Démarrer / réactiver l’instance', 'Rejouer le ping de test et vérifier l’alerte'] });

/* ======================= SYNTAXE DE RÈGLE ======================= */
add({ id: 'snort_rule_syntax', level: 3, title: 'Snort ne démarre plus depuis l’ajout d’une règle personnelle', skills: ['snort', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'paren', rules: R1.slice(0, -1) + '\n' + R2, label: 'la règle 1000001 de custom.rules a perdu sa parenthèse fermante' },
    { key: 'option', rules: R1.replace('classtype:', 'clastype:') + '\n' + R2, label: 'la règle 1000001 de custom.rules contient l’option « clastype » (faute de frappe pour « classtype »)' },
    { key: 'action', rules: R1.replace(/^alert/, 'alarm') + '\n' + R2, label: 'la règle 1000001 de custom.rules commence par l’action « alarm », qui n’existe pas (« alert » attendu)' },
    { key: 'var', rules: R1.replace('$HOME_NET', '$HOME_NETWORK') + '\n' + R2, label: 'la règle 1000001 de custom.rules utilise la variable $HOME_NETWORK, qui n’existe pas ($HOME_NET attendu)' }
  ] },
  ticket: tk(SUP, 'Snort est arrêté sur le WAN depuis l’ajout d’une règle', 'Un technicien a ajouté une règle personnelle pour détecter les pings venant d’Internet. Depuis, l’interface WAN de Snort reste arrêtée et le bouton de démarrage ne tient pas : aucune alerte, ni pour le ping ni pour les tentatives SSH.'),
  cause: 'Sur pfSense, {{m.label}} : Snort refuse de charger un fichier de règles invalide et l’instance du WAN ne démarre pas, ce qui coupe aussi les autres règles (SID 1000002 pour le SSH).',
  solution: 'Corriger la règle fautive dans Services → Snort → WAN Rules (catégorie custom.rules), enregistrer puis démarrer l’instance du WAN.',
  hints: ['L’instance du WAN ne reste pas démarrée : cherchez ce qui a changé juste avant, côté règles.', 'Services → Snort → Snort Interfaces → WAN Rules, catégorie custom.rules : relisez chaque règle (action, protocole, adresses, options entre parenthèses, point-virgules).', 'Une règle valide commence par « alert tcp/udp/icmp » et se termine par « ) » ; les options connues sont msg, sid, rev, classtype… : corrigez, enregistrez, puis démarrez l’instance.'],
  inject: [{ do: 'set', path: WAN + '.custom', value: '{{m.rules}}' }],
  verify: ['ping:PCEXT:*', 'connect:PCEXT:*'],
  probes: [RUN_WAN, ALERT, { t: 'snort', flow: Object.assign({ alert: 1000002 }, SSH), hidden: true }],
  roots: [{ probe: RUN_WAN }],
  fix: [{ do: 'set', path: WAN + '.custom', value: GOOD_WAN }],
  traps: ['Commenter la règle avec « # » fait démarrer Snort mais supprime la détection du ping : le test échoue encore.', 'Désactiver Snort ou vider custom.rules ne répare rien.'],
  optimal: ['Constater que l’instance du WAN ne démarre pas', 'Ouvrir WAN Rules → custom.rules', 'Repérer et corriger la règle invalide', 'Enregistrer et démarrer l’instance', 'Rejouer le ping et le SSH de test'] });

/* ======================= HOME_NET ======================= */
add({ id: 'snort_homenet', level: 3, title: 'Snort tourne sur le WAN mais ne lève plus d’alerte', skills: ['snort', 'pfsense', 'subnetting', 'diag'],
  vary: { m: [
    { key: 'lan', list: ['10.10.0.0/16'], label: 'la variable HOME_NET du WAN est personnalisée avec le réseau du LAN (10.10.0.0/16) au lieu de l’adresse du pare-feu côté Internet (198.51.100.0/30)' },
    { key: 'typo', list: ['198.51.100.8/30'], label: 'la variable HOME_NET du WAN est personnalisée avec 198.51.100.8/30 au lieu de 198.51.100.0/30 (faute de frappe sur l’adresse)' },
    { key: 'invalid', list: ['198.51.100.0/3O'], label: 'la variable HOME_NET du WAN contient « 198.51.100.0/3O » (lettre O à la place du chiffre 0) : valeur invalide' }
  ] },
  ticket: tk(SUP, 'Snort affiché « démarré » mais plus d’alerte pour les pings externes', 'Après l’harmonisation des variables Snort faite hier, l’interface WAN apparaît dans la liste, mais le ping de test depuis l’extérieur ne produit plus aucune alerte (ou Snort ne tient pas démarré). Les règles n’ont pas été touchées.'),
  cause: 'Sur pfSense, {{m.label}} : les règles dont la destination est $HOME_NET ne correspondent plus à l’adresse WAN du pare-feu (ou Snort refuse la valeur invalide), donc aucune alerte.',
  solution: 'Remettre « Home Net » sur default (ou sur un alias contenant 198.51.100.0/30) dans Services → Snort → WAN Settings, enregistrer, redémarrer l’instance.',
  hints: ['Les règles n’ont pas changé et l’interface est surveillée : regardez les variables qui interviennent dans les règles ($HOME_NET, $EXTERNAL_NET).', 'Services → Snort → Snort Interfaces → WAN Settings : sélection de « Home Net » (default ou personnalisé). Comparez avec l’adresse réelle du WAN (Interfaces → WAN).', '« default » reprend les réseaux de l’interface ; une valeur personnalisée doit contenir l’adresse WAN 198.51.100.2 (198.51.100.0/30).'],
  inject: [{ do: 'set', path: WAN + '.homeNet', value: 'custom' }, { do: 'set', path: WAN + '.homeNetList', value: '{{m.list}}' }],
  verify: ['ping:PCEXT:*', 'connect:PCEXT:*'],
  probes: [ALERT, RUN_WAN],
  roots: [{ probe: ALERT }],
  fix: [{ do: 'set', path: WAN + '.homeNet', value: 'default' }, { do: 'set', path: WAN + '.homeNetList', value: [] }],
  traps: ['Remplacer $HOME_NET par « any » dans les règles fait revenir l’alerte mais la rend beaucoup trop large.', 'Redémarrer Snort sans corriger HOME_NET ne change rien.'],
  optimal: ['Rejouer le ping de test : pas d’alerte', 'Vérifier l’état de l’instance WAN (démarrée)', 'WAN Settings : relire Home Net', 'Corriger Home Net, enregistrer, redémarrer', 'Rejouer le ping de test'] });

/* ======================= MAUVAISE INTERFACE ======================= */
add({ id: 'snort_wrong_iface', level: 2, title: 'Snort surveille la DMZ au lieu de l’interface WAN', skills: ['snort', 'pfsense', 'diag'],
  ticket: tk(SUP, 'Les attaques depuis Internet ne sont plus détectées', 'Lors de la migration de la configuration Snort, l’instance censée surveiller l’entrée Internet a été recréée. Le service est « démarré » dans la console, mais les pings et tentatives SSH venant de l’extérieur ne lèvent plus aucune alerte.'),
  cause: 'Sur pfSense, l’instance Snort qui porte les règles Internet (SID 1000001 et 1000002) est attachée à l’interface DMZ et non à l’interface WAN : elle est démarrée mais ne voit jamais le trafic externe qui arrive sur le WAN.',
  solution: 'Recréer / réattacher l’instance sur l’interface WAN : Services → Snort → Snort Interfaces → WAN Settings, champ « Interface » = WAN (ou ajouter une instance WAN avec les mêmes règles).',
  hints: ['Snort est démarré mais n’alerte pas : demandez-vous quelle interface il observe réellement.', 'Services → Snort → Snort Interfaces : la colonne « Interface » de la ligne de description « WAN » ne dit pas WAN.', 'Une instance Snort ne voit que le trafic de son interface : reportez-la sur WAN (les règles Internet doivent y être).'],
  inject: [{ do: 'set', path: WAN + '.iface', value: 'dmz' }],
  verify: ['ping:PCEXT:*', 'connect:PCEXT:*'],
  probes: [ALERT],
  roots: [{ probe: ALERT }],
  fix: [{ do: 'set', path: WAN + '.iface', value: 'wan' }],
  traps: ['Ajouter les règles dans l’instance LAN ne détecte pas le trafic qui arrive par le WAN.', 'Redémarrer le service ne change pas l’interface surveillée.'],
  optimal: ['Rejouer le ping de test : pas d’alerte', 'Snort Interfaces : relire l’interface surveillée par chaque instance', 'Réattacher l’instance sur WAN', 'Rejouer le ping de test'] });

/* ======================= PAS DE BLOCAGE ======================= */
add({ id: 'snort_no_block', level: 2, title: 'Snort alerte mais ne bloque plus l’attaquant', skills: ['snort', 'pfsense', 'diag'],
  vary: { m: [
    { key: 'ids', inj: [{ do: 'set', path: WAN + '.block', value: false }], fix: [{ do: 'set', path: WAN + '.block', value: true }], label: 'la case « Block Offenders » de l’interface WAN est décochée : Snort n’agit plus qu’en détection (IDS)' },
    { key: 'passlist', inj: [{ do: 'set', path: PF + '.snort.passLists', value: [{ name: 'PARTENAIRES', addrs: ['198.18.0.0/24'] }] }, { do: 'set', path: WAN + '.passList', value: 'PARTENAIRES' }], fix: [{ do: 'set', path: WAN + '.passList', value: 'default' }], label: 'la liste de passage « PARTENAIRES » (qui contient 198.18.0.0/24, le réseau de l’attaquant de test) est affectée à l’interface WAN : ces adresses ne sont jamais bloquées' },
    { key: 'dst', inj: [{ do: 'set', path: WAN + '.blockWhich', value: 'dst' }], fix: [{ do: 'set', path: WAN + '.blockWhich', value: 'src' }], label: 'le champ « Which IP to Block » est positionné sur DST : Snort tente de bloquer la destination (le pare-feu lui-même, protégé par la liste de passage) au lieu de la source' }
  ] },
  ticket: tk(SUP, 'L’IDS voit les attaques mais l’adresse n’est jamais bloquée', 'Le test d’intrusion de contrôle (ping puis SSH depuis un poste externe) lève bien des alertes, mais l’onglet des hôtes bloqués reste vide : l’attaquant peut continuer. Le mode « IPS » avait pourtant été validé à la recette.'),
  cause: 'Sur pfSense, {{m.label}} : l’alerte est produite (SID 1000001) mais l’adresse de l’attaquant n’est pas inscrite dans la table des hôtes bloqués.',
  solution: 'Rétablir le blocage de la source : Block Offenders coché, « Which IP to Block » = SRC, liste de passage « default » (sans l’adresse de l’attaquant), puis redémarrer l’instance.',
  hints: ['Les alertes arrivent : la détection fonctionne. Cherchez pourquoi l’action de blocage ne s’applique pas.', 'Services → Snort → WAN Settings : regardez Block Offenders, « Which IP to Block » et la liste de passage (Pass List) de l’interface.', 'Le blocage vise l’adresse source de l’alerte, sauf si elle est dans la liste de passage : contrôlez ces trois réglages.'],
  inject: '{{m.inj}}',
  verify: ['ping:PCEXT:*', 'connect:PCEXT:*'],
  probes: [BLOCK],
  roots: [{ probe: BLOCK }],
  fix: '{{m.fix}}',
  traps: ['Vider le journal des alertes ne règle rien : le blocage dépend des réglages de l’interface.', 'Ajouter l’adresse de l’attaquant à la main dans Blocked ne corrige pas la cause : la prochaine attaque ne sera pas bloquée.'],
  optimal: ['Rejouer le ping de test : alerte présente', 'Blocked : liste vide', 'WAN Settings : Block Offenders / Which IP to Block / Pass List', 'Corriger le réglage fautif, redémarrer l’instance', 'Rejouer l’attaque et vérifier l’hôte bloqué'] });

/* ======================= HÔTE LÉGITIME BLOQUÉ ======================= */
add({ id: 'snort_blocked_legit', level: 3, title: 'Un poste du service RH n’a plus accès à rien après un test Telnet', skills: ['snort', 'pfsense', 'diag'],
  ticket: tk('Bruno Durand (les RH)', 'Mon poste n’a plus aucun accès réseau depuis mon test de tout à l’heure', 'Bonjour, j’ai essayé un Telnet vers un site extérieur pour vérifier une imprimante en ligne, et depuis plus rien ne marche sur mon poste : ni Internet, ni les dossiers partagés. Les autres collègues n’ont aucun souci.'),
  cause: 'Sur pfSense, l’instance Snort du LAN a une liste de passage « None » : le Telnet sortant de PC-02 (10.10.20.60) a levé l’alerte SID 1000003 et son adresse a été inscrite dans la table des hôtes bloqués. pf rejette désormais tout le trafic de ce poste ; tant que la liste de passage reste vide, l’adresse sera bloquée de nouveau.',
  solution: 'Débloquer l’adresse (Services → Snort → Blocked, suppression de 10.10.20.60) ET remettre la liste de passage « default » sur l’instance LAN (WAN Settings → LAN Settings → Pass List) pour que les postes du LAN ne soient plus bloqués.',
  hints: ['Un seul poste est touché, juste après un test précis : l’IPS a probablement bloqué son adresse.', 'Services → Snort → Blocked : cherchez l’adresse du poste. Status → System Logs → Firewall montre aussi les paquets rejetés.', 'Supprimer l’entrée ne suffit pas si l’instance LAN n’a pas de liste de passage : le prochain test bloquera de nouveau le poste.'],
  inject: [{ do: 'set', path: LAN + '.passList', value: 'none' }, { do: 'push', path: PF + '.snortBlocked', item: BLK_PC02 }],
  probes: [{ t: 'ping', from: PC, to: '8.8.8.8' }, { t: 'snort', flow: Object.assign({ alert: 1000003, block: false }, TEL), hidden: true }],
  roots: [{ probe: { t: 'snort', blockedNot: '10.10.20.60' } }, { probe: { t: 'snort', flow: Object.assign({ block: false }, TEL) } }],
  fix: [{ do: 'set', path: PF + '.snortBlocked', value: [] }, { do: 'set', path: LAN + '.passList', value: 'default' }],
  traps: ['Supprimer seulement l’entrée de la table Blocked rend l’accès, mais le poste sera bloqué de nouveau à la prochaine alerte.', 'Désactiver Snort sur le LAN supprime la protection pour tout le service : ce n’est pas une réparation.'],
  optimal: ['Constater la perte d’accès du poste seul', 'Snort → Blocked : adresse 10.10.20.60 listée', 'Supprimer l’entrée de la table', 'LAN Settings : liste de passage « None » → remettre default', 'Retester l’accès du poste'] });

/* ======================= HÔTE BLOQUÉ PAR ERREUR (VPN) ======================= */
add({ id: 'snort_blocked_stale', level: 2, title: 'Le télétravailleur n’arrive plus à ouvrir son VPN après un test de ping', skills: ['snort', 'pfsense', 'openvpn', 'diag'],
  ticket: tk('Admin TSSR (télétravail)', 'Le VPN ne monte plus depuis hier soir', 'Bonjour, hier soir, avant de me connecter, j’ai fait un ping vers l’adresse publique du pare-feu pour tester la ligne. Depuis, le client OpenVPN affiche « TLS key negotiation failed » alors que mon profil n’a pas changé et que le serveur est démarré.', 'internet'),
  cause: 'Sur pfSense, le ping de test du télétravailleur (198.18.0.10) a levé l’alerte SID 1000001 sur l’interface WAN et Snort, en mode Legacy avec « Block Offenders », a inscrit son adresse dans la table des hôtes bloqués. pf rejette tout paquet de cette adresse, y compris le UDP 1194 du VPN.',
  solution: 'Retirer l’adresse 198.18.0.10 de Services → Snort → Blocked ; éviter de la retester par ping tant que la règle ICMP bloque la source (ou l’ajouter à une liste de passage dédiée).',
  hints: ['Le VPN tournait hier : cherchez ce qui a pu bloquer l’adresse du poste distant, côté pare-feu.', 'Status → System Logs → Firewall : le UDP 1194 de l’adresse du télétravailleur est rejeté, sans règle WAN fautive. Services → Snort → Blocked liste cette adresse.', 'Supprimez l’entrée dans Snort → Blocked puis retestez le VPN.'],
  inject: [{ do: 'push', path: PF + '.snortBlocked', item: BLK_EXT }],
  probes: [{ t: 'vpn', client: 'PCEXT', profile: PROF }],
  roots: [{ probe: { t: 'snort', blockedNot: '198.18.0.10' } }],
  fix: [{ do: 'set', path: PF + '.snortBlocked', value: [] }],
  traps: ['Modifier les règles OpenVPN ou le profil client n’a aucun effet : le trafic est rejeté avant d’atteindre le serveur.', 'Arrêter Snort sur le WAN ne vide pas la table des hôtes déjà bloqués.'],
  optimal: ['Lire l’erreur du client VPN (négociation TLS échouée)', 'Journal du pare-feu : UDP 1194 rejeté, source 198.18.0.10', 'Snort → Blocked : adresse listée', 'Supprimer l’entrée', 'Retester le VPN'] });

/* ======================= CASCADE ======================= */
add({ id: 'snort_cascade', level: 4, title: 'Audit IDS/IPS : Snort arrêté, HOME_NET faux et blocage sur la mauvaise adresse', skills: ['snort', 'pfsense', 'subnetting', 'diag'],
  ticket: tk(SUP, 'Audit : le dispositif IDS/IPS du WAN ne protège plus rien', 'Le contrôle de recette de l’IDS/IPS échoue : le ping puis la tentative SSH depuis un poste externe ne produisent aucune alerte, et l’adresse de l’attaquant n’est jamais bloquée. Plusieurs réglages ont été modifiés en même temps pendant la maintenance.'),
  cause: 'Trois défauts cumulés sur l’instance WAN de Snort : elle est arrêtée ; HOME_NET est personnalisé avec 198.51.100.8/30 (mauvaise adresse) ; « Which IP to Block » est sur DST (la destination, protégée par la liste de passage). Les corriger un par un révèle le suivant.',
  solution: 'Démarrer l’instance WAN ; remettre Home Net sur default ; remettre « Which IP to Block » sur SRC ; enregistrer, redémarrer, puis rejouer le ping (alerte et hôte bloqué).',
  hints: ['Commencez par l’état de l’instance, puis par la présence d’alertes, puis par le blocage : chaque étape cache la suivante.', 'WAN Settings : Home Net (doit contenir 198.51.100.2), Block Offenders et « Which IP to Block ». Blocked doit se remplir après l’attaque de test.', 'Après avoir démarré l’instance et corrigé HOME_NET, l’alerte revient mais l’adresse n’est toujours pas bloquée : regardez « Which IP to Block ».'],
  inject: [{ do: 'set', path: WAN + '.stopped', value: true }, { do: 'set', path: WAN + '.homeNet', value: 'custom' }, { do: 'set', path: WAN + '.homeNetList', value: ['198.51.100.8/30'] }, { do: 'set', path: WAN + '.blockWhich', value: 'dst' }],
  verify: ['ping:PCEXT:*', 'connect:PCEXT:*'],
  probes: [BLOCK],
  roots: [{ probe: RUN_WAN }, { probe: ALERT }, { probe: BLOCK }],
  fix: [{ do: 'set', path: WAN + '.stopped', value: false }, { do: 'set', path: WAN + '.homeNet', value: 'default' }, { do: 'set', path: WAN + '.homeNetList', value: [] }, { do: 'set', path: WAN + '.blockWhich', value: 'src' }],
  traps: ['Corriger un seul réglage donne l’impression que tout est réparé : rejouez toujours le ping de test jusqu’au blocage de l’attaquant.', 'Bloquer l’attaquant à la main dans Blocked ne remplace pas la correction du mode de blocage.'],
  optimal: ['Constater : pas d’alerte, pas de blocage', 'Snort Interfaces : instance WAN arrêtée → démarrer', 'WAN Settings : Home Net faux → default', 'WAN Settings : Which IP to Block = SRC', 'Rejouer le ping : alerte et hôte bloqué'] });
})(typeof globalThis !== 'undefined' ? globalThis : window);
