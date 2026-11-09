# Pannes proxy (Squid / SquidGuard sur pfSense)

Fichier généré par `node tests/gen-docs.js` à partir de `src/content/26-faults-proxy.js` — ne pas éditer à la main.

Référence cours : TP Squid/SquidGuard sur pfSense (voir `docs/CORRESPONDANCE-COURS.md`). Compétence de la fiche : **Proxy web**. 21 pannes (4 en N1, 10 en N2, 5 en N3, 2 en N4).

Toutes se diagnostiquent et se vérifient depuis le poste RH ou le poste d’administration (Paramètres du proxy du navigateur, journaux). **État de la preuve (D-105, D-108)** : seules 4 pannes sur 21 ont un parcours par l’interface web de pfSense (Services → Squid Proxy Server / SquidGuard Proxy Filter, Status → Services) qui prouve qu’un joueur peut les réparer par clics et saisies (`tests/ui/proxy-faults.js`) : `px_subnet_denied`, `px_cache_unsaved`, `px_sg_default_deny`, `px_sg_nolist`. Les 17 autres (`px_down`, `px_pkg_broken`, `px_iface`, `px_client_port`, `px_client_bypass`, `px_blacklist_regex`, `px_blacklist_overblock`, `px_whitelist`, `px_sg_off`, `px_sg_category`, `px_safesearch`, `px_dns_upstream`, `px_log_off`, `px_trans_off`, `px_quic`, `px_trans_multi`, `px_cascade`) ont une correction déclarée dans le moteur mais **aucun parcours** : statut « livrée, non terminée » (dette de parcours). Le périmètre `px` attend l’arbitrage du porteur du projet. Les pannes N4 `multi_*` qui impliquent le proxy sont listées en fin de document.

## Catalogue

| ID | Niv. | Ticket (sujet) | Cause racine | Résolution attendue |
|---|---|---|---|---|
| `px_down` | 1 | Plus aucun site ne s’ouvre sur mon poste | Sur pfSense, (le service Squid a été arrêté (Status → Services) / la case « Enable Squid Proxy » a été décochée (Services → Squid Proxy Server → General)) : plus rien n’écoute sur 10.10.0.1:3128 et le navigateur (configuré avec ce proxy) affiche ERR_PROXY_CONNECTION_FAILED. | Redémarrer / réactiver Squid sur pfSense (Status → Services ou case Enable dans Squid General) et retester la navigation. |
| `px_cache_unsaved` | 2 | Le proxy ne répond plus depuis la réinstallation du paquet | Après la réinstallation du paquet, la configuration du cache local n’a jamais été enregistrée (onglet Local Cache) : les dossiers de cache n’existent pas et Squid ne démarre pas, bien que « Enable Squid Proxy » soit coché. | Ouvrir Services → Squid Proxy Server → Local Cache, cliquer sur Save pour créer le cache, puis démarrer Squid. |
| `px_pkg_broken` | 2 | Un des paquets du proxy est signalé en erreur sur pfSense | Le paquet (Squid / squidGuard) est marqué « Package is configured but not (fully) installed or deprecated » : son installation a été interrompue par la coupure et le service concerné ne peut pas démarrer. | System → Package Manager → Installed Packages : réinstaller le paquet concerné (icône Reinstall Package), attendre « Success », puis vérifier le service. |
| `px_iface` | 2 | Après la modification du proxy, plus personne ne navigue | Dans Services → Squid Proxy Server → General, « Proxy Interface(s) » ne contient plus que (WAN / DMZ) : Squid n’écoute plus sur LAN et refuse les connexions des postes. | Sélectionner l’interface LAN dans « Proxy Interface(s) », enregistrer (Save) et vérifier que la navigation fonctionne. |
| `px_client_port` | 1 | Mon navigateur n’arrive plus à se connecter au proxy | Dans Options Internet → Connexions → Paramètres réseau du poste PC-02, (le port est 8080 au lieu de 3128 / l’adresse du proxy est 10.10.10.1 au lieu de 10.10.0.1) : le navigateur contacte un service qui ne répond pas. | Rétablir 10.10.0.1 port 3128 dans Options Internet → Connexions → Paramètres réseau (Paramètres du réseau local, LAN). |
| `px_client_bypass` | 2 | Des salariés ouvrent YouTube et Facebook alors que c’est interdit | Dans Options Internet → Paramètres du proxy → Avancé du poste PC-02, (l’exception « *.com » a été ajoutée / l’exception « * » a été ajoutée) dans les exceptions : ces adresses ne passent plus par le proxy et échappent donc à la liste noire. | Retirer l’exception excessive : seules les adresses 10.10.* et *.toulouse.local doivent contourner le proxy. |
| `px_subnet_denied` | 2 | Une page « Access Denied » s’affiche quand je navigue | Squid n’autorise que le réseau de l’interface du proxy (le LAN du pare-feu) : dans Squid → ACLs → « Allowed subnets », (aucun sous-réseau n’est renseigné / seul 10.10.0.0/24 est renseigné (les postes sont en 10.10.20.0/24) / seul 10.20.0.0/16 (Bordeaux) est renseigné), donc les postes du VLAN 20 sont refusés (TCP_DENIED/403). | Ajouter le réseau des postes (10.10.0.0/16, ou au moins 10.10.20.0/24) dans Squid → ACLs → Allowed subnets, puis enregistrer. |
| `px_blacklist_regex` | 3 | Plus de proxy depuis qu’on a ajouté un site à bloquer | La Blacklist de Squid contient l’entrée (« *.facebook.com » / « (youtube.com » / « [tiktok.com »), qui n’est pas une expression régulière valide (les entrées sont des regex) : Squid refuse de démarrer avec cette configuration. | Corriger ou supprimer l’entrée invalide dans Squid → ACLs → Blacklist (par exemple « facebook.com », « youtube.com »), enregistrer et vérifier que Squid démarre. |
| `px_blacklist_overblock` | 2 | Wikipédia ne s’ouvre plus | La Blacklist de Squid contient l’entrée (« pedia » / « .org ») : les entrées sont des expressions régulières appliquées au nom du site, elles correspondent aussi à www.wikipedia.org, qui est refusé (TCP_DENIED/403). | Remplacer l’entrée trop large par des noms précis (facebook.com, youtube.com) dans Squid → ACLs → Blacklist, puis enregistrer. |
| `px_whitelist` | 2 | YouTube s’ouvre depuis le poste RH malgré l’interdiction | La Whitelist de Squid contient (« youtube.com » / « .* » (tous les sites) / « tube ») : une correspondance dans la Whitelist l’emporte sur la Blacklist, donc youtube.com n’est plus refusé par Squid. | Vider la Whitelist de Squid (Squid → ACLs → Whitelist) pour que la Blacklist s’applique de nouveau. |
| `px_sg_off` | 1 | Un réseau social s’ouvre alors qu’il devrait être filtré | Sur pfSense, (le service squidGuard est arrêté (Status → Services) / la case d’activation de squidGuard (General settings) est décochée) : Squid fonctionne (sa Blacklist bloque encore Facebook et YouTube) mais plus aucune catégorie n’est filtrée. | Réactiver squidGuard (General settings : Enable, puis Apply) ou le redémarrer depuis Status → Services, et vérifier « SquidGuard service state: STARTED ». |
| `px_sg_default_deny` | 2 | Tous les sites sont bloqués depuis la modification du filtre | Dans squidGuard → Common ACL, « Default access [all] » est passé à deny : tout site qui n’appartient à aucune catégorie autorisée explicitement est redirigé et bloqué, y compris Wikipédia. | Remettre « Default access [all] » sur allow dans Common ACL, enregistrer puis cliquer sur Apply dans General settings. |
| `px_sg_category` | 2 | Un site interdit par la charte s’ouvre à nouveau | Dans squidGuard → Common ACL, la catégorie (social_networks (réseaux sociaux) / adult (sites pour adultes)) est passée en « allow » : les sites de cette catégorie ne sont plus redirigés. | Remettre la catégorie concernée en deny dans Common ACL (Target Rules List), Save, puis Apply. |
| `px_sg_nolist` | 3 | Le filtre par catégories ne fait plus rien depuis la réinstallation | Sur pfSense, (la base de catégories n’a jamais été téléchargée / l’adresse de la liste est erronée et le téléchargement n’a jamais abouti) : squidGuard n’a aucune liste de catégories sur le disque (son service reste arrêté), donc les règles « deny » n’ont aucun effet. | Dans squidGuard → Blacklist, saisir l’URL de la liste UT Capitole (blacklists_for_pfsense.tar.gz), cliquer sur Download jusqu’à « Blacklist update complete », puis Apply dans General settings. |
| `px_safesearch` | 3 | La recherche sécurisée n’est plus verrouillée sur les postes | Sur pfSense, (la surcharge d’hôte www.google.com a été supprimée / la surcharge d’hôte www.google.com pointe vers l’adresse réelle du moteur (198.51.100.61) au lieu de forcesafesearch.google.com (216.239.38.120) / l’alias www.google.fr de la surcharge d’hôte a été supprimé / le Résolveur DNS est désactivé (les surcharges d’hôte ne sont plus servies)) : le proxy résout www.google.com vers le vrai moteur et non vers le serveur qui force SafeSearch. | Rétablir la surcharge d’hôte www.google.com → 216.239.38.120 (avec l’alias www.google.fr) dans Services → DNS Resolver, résolveur activé, et vérifier avec Diagnostics → DNS Lookup puis sur la page /safesearch. |
| `px_dns_upstream` | 3 | Les sites ne se chargent plus mais le proxy répond | Sur pfSense, (le serveur DNS général est 8.8.4.4, qui ne répond pas / aucun serveur DNS général n’est renseigné / le serveur DNS général est 10.10.10.99, qui n’existe pas) : le Résolveur DNS ne trouve plus aucun nom hors surcharges, donc Squid ne peut pas résoudre les sites demandés (NONE_NONE/503). | Renseigner un serveur DNS joignable (8.8.8.8) dans System → General Setup, puis vérifier avec Diagnostics → DNS Lookup. |
| `px_log_off` | 1 | Je ne vois plus les accès web dans les journaux du proxy | Sur pfSense, (la case « Enable Access Logging » de Squid General est décochée / la case « Enable log » de squidGuard est décochée) : les requêtes sont traitées normalement mais aucune ligne n’est écrite dans le journal concerné. | Réactiver la journalisation (Squid General → Enable Access Logging, ou squidGuard General settings → Enable log), enregistrer, appliquer, puis vérifier dans Real Time / Log. |
| `px_trans_off` | 2 | Après la bascule en mode transparent, Facebook s’ouvre en HTTP | Dans Squid General (poste sans proxy déclaré), (la case « Transparent HTTP Proxy » n’est pas cochée / la case « Transparent HTTP Proxy » est cochée mais aucune interface de redirection n’est choisie / l’interface de redirection choisie est WAN au lieu de LAN) : le trafic HTTP du poste n’est pas redirigé vers Squid et part directement sur Internet, sans filtrage. | Cocher « Transparent HTTP Proxy », sélectionner l’interface LAN comme « Transparent Proxy Interface(s) », enregistrer, puis retester le blocage HTTP. |
| `px_quic` | 3 | Facebook et YouTube s’ouvrent en HTTPS malgré l’interception SSL | Le navigateur tente d’abord QUIC (UDP 443) vers les sites qui le proposent ; la règle « Autoriser LAN vers tout » laisse passer ce trafic, qui n’est pas redirigé vers Squid. Il manque une règle LAN qui rejette UDP 443 pour forcer le retour en TCP. | Ajouter en haut des règles LAN une règle Reject, protocole UDP, destination port 443 (au-dessus de « Autoriser LAN vers tout »), appliquer, puis retester Facebook et YouTube. |
| `px_trans_multi` | 4 | Audit : les sites interdits sont accessibles en HTTPS depuis le VLAN postes | Deux causes cumulées : l’interception HTTPS (HTTPS/SSL Interception en mode Splice All) n’est pas activée, donc le trafic TCP 443 n’est jamais redirigé vers Squid ; et la règle Reject UDP 443 manque, donc les navigateurs passent par QUIC. Corriger une seule des deux laisse les sites accessibles. | Activer HTTPS/SSL Interception en mode Splice All sur LAN avec une autorité de certification (CA-Proxy-Squid), et ajouter une règle Reject UDP 443 au-dessus du pass-all sur LAN. Retester Facebook et YouTube. |
| `px_cascade` | 4 | Après la grosse modification du proxy, rien ne marche, même après un redémarrage | Trois défauts cumulés, révélés l’un après l’autre : la Blacklist de Squid contient l’entrée invalide « *.facebook.com » (Squid ne démarre pas) ; les « Allowed subnets » ne contiennent pas le réseau des postes (TCP_DENIED/403) ; et le filtre squidGuard est en « Default access [all] = deny » (tout est redirigé). | Corriger la Blacklist (facebook.com), ajouter 10.10.0.0/16 aux Allowed subnets, repasser le Default access de squidGuard sur allow (Save puis Apply), puis retester Wikipédia, HTTP/HTTPS et le blocage des sites interdits. |

## Pièges et contournements par panne

### `px_down` — Proxy Squid arrêté ou désactivé

- Variantes tirées selon la graine : le service Squid a été arrêté (Status → Services) · la case « Enable Squid Proxy » a été décochée (Services → Squid Proxy Server → General)
- Chemin optimal : 1. Lire le message du navigateur (proxy injoignable) → 2. Tester le port 3128 depuis le poste → 3. Status → Services sur pfSense : Squid arrêté → 4. Démarrer / réactiver Squid → 5. Retester la navigation
- Pièges : Décocher le proxy dans Options Internet rend la navigation mais supprime tout filtrage pour ce poste : ce n’est pas une réparation. · Redémarrer le poste ou vider le cache du navigateur n’a aucun effet : le proxy lui-même ne répond pas.
- Contournements reconnus (ne comptent pas comme résolution) : client_sans_proxy

### `px_cache_unsaved` — Squid ne démarre pas : cache local jamais enregistré

- Chemin optimal : 1. Constater l’erreur de proxy injoignable → 2. Status → Services : Squid arrêté → 3. Squid → General : tout est coché → 4. Local Cache → Save → 5. Démarrer Squid puis retester
- Pièges : Réinstaller encore le paquet ne règle rien : la configuration du cache doit être enregistrée. · Contourner en retirant le proxy du poste fait disparaître le filtrage.
- Contournements reconnus (ne comptent pas comme résolution) : client_sans_proxy

### `px_pkg_broken` — Paquet Squid ou squidGuard « configured but not (fully) installed »

- Variantes tirées selon la graine : Squid · squidGuard
- Chemin optimal : 1. Observer le symptôme (page d’erreur ou site non filtré) → 2. Status → Services → 3. System → Package Manager : repérer le paquet en défaut → 4. Reinstall Package → 5. Retester
- Pièges : Relancer le service depuis Status → Services ne répare pas un paquet incomplet.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_iface` — Squid écoute sur la mauvaise interface

- Variantes tirées selon la graine : WAN · DMZ
- Chemin optimal : 1. Tester le port 3128 depuis le poste (refus) → 2. Status → Services : Squid démarré → 3. Squid → General : interfaces du proxy → 4. Sélectionner LAN → 5. Retester
- Pièges : Ouvrir le port 3128 sur la règle WAN du pare-feu n’aide pas : le problème est l’interface d’écoute, pas le filtrage.
- Contournements reconnus (ne comptent pas comme résolution) : client_sans_proxy

### `px_client_port` — Poste : adresse ou port du proxy erroné dans Options Internet

- Variantes tirées selon la graine : le port est 8080 au lieu de 3128 · l’adresse du proxy est 10.10.10.1 au lieu de 10.10.0.1
- Chemin optimal : 1. Lire l’erreur du navigateur → 2. Comparer avec les autres postes → 3. Options Internet → Paramètres réseau → 4. Corriger adresse et port → 5. Retester
- Pièges : Décocher « Utiliser un serveur proxy » fait revenir la navigation mais sort le poste du filtrage.
- Contournements reconnus (ne comptent pas comme résolution) : sans_proxy

### `px_client_bypass` — Poste : exceptions du proxy trop larges, Facebook et YouTube accessibles

- Variantes tirées selon la graine : l’exception « *.com » a été ajoutée · l’exception « * » a été ajoutée
- Chemin optimal : 1. Constater que le site s’ouvre → 2. Real Time de Squid : aucune requête de ce poste → 3. Options Internet → Avancé : exceptions → 4. Retirer l’exception → 5. Retester le blocage
- Pièges : Ajouter facebook.com à la Blacklist de Squid ne change rien : le poste ne passe pas par Squid.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_subnet_denied` — Squid refuse les postes du VLAN (réseaux autorisés)

- Variantes tirées selon la graine : aucun sous-réseau n’est renseigné · seul 10.10.0.0/24 est renseigné (les postes sont en 10.10.20.0/24) · seul 10.20.0.0/16 (Bordeaux) est renseigné
- Chemin optimal : 1. Lire la page d’erreur (Access Denied) → 2. Squid → Real Time : TCP_DENIED/403 → 3. Squid → ACLs : sous-réseaux autorisés → 4. Ajouter 10.10.0.0/16 → 5. Retester HTTP et HTTPS
- Pièges : Sortir le poste du proxy contourne le refus sans le corriger. · Autoriser 0.0.0.0/0 ouvrirait le proxy à tout réseau joignable : trop large.
- Contournements reconnus (ne comptent pas comme résolution) : client_sans_proxy

### `px_blacklist_regex` — Squid ne démarre plus : entrée invalide dans la Blacklist

- Variantes tirées selon la graine : « *.facebook.com » · « (youtube.com » · « [tiktok.com »
- Chemin optimal : 1. Constater l’erreur de proxy injoignable → 2. Status → Services : Squid arrêté → 3. Cache Logs : erreur d’expression régulière → 4. Corriger l’entrée de la Blacklist → 5. Vérifier le service et le blocage
- Pièges : Vider toute la Blacklist fait redémarrer Squid mais YouTube redevient accessible : la consigne de blocage n’est plus appliquée.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_blacklist_overblock` — Blacklist trop large : un site légitime est bloqué

- Variantes tirées selon la graine : « pedia » · « .org »
- Chemin optimal : 1. Reproduire le blocage de Wikipédia → 2. Squid → Real Time : TCP_DENIED/403 → 3. Squid → ACLs → Blacklist → 4. Corriger l’entrée trop large → 5. Retester Wikipédia et le blocage
- Pièges : Ajouter wikipedia.org à la Whitelist rouvre l’accès mais laisse une entrée de Blacklist qui bloquera d’autres sites sans prévenir.
- Contournements reconnus (ne comptent pas comme résolution) : whitelist

### `px_whitelist` — Whitelist qui annule la Blacklist : YouTube accessible

- Variantes tirées selon la graine : « youtube.com » · « .* » (tous les sites) · « tube »
- Chemin optimal : 1. Constater que YouTube s’ouvre → 2. Vérifier la Blacklist (correcte) → 3. Squid → ACLs : Whitelist → 4. Vider la Whitelist → 5. Retester le blocage
- Pièges : Ajouter une deuxième entrée à la Blacklist ne sert à rien : la Whitelist reste prioritaire.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_sg_off` — squidGuard arrêté : le filtrage par catégories ne s’applique plus

- Variantes tirées selon la graine : le service squidGuard est arrêté (Status → Services) · la case d’activation de squidGuard (General settings) est décochée
- Chemin optimal : 1. Constater que les catégories ne sont plus filtrées → 2. General settings : état du service → 3. Activer / démarrer squidGuard → 4. Apply → 5. Retester
- Pièges : Ajouter ces sites à la Blacklist de Squid règle ces deux cas mais pas la catégorie entière.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_sg_default_deny` — squidGuard : accès par défaut « deny », plus aucun site ne s’ouvre

- Chemin optimal : 1. Constater que tout est bloqué → 2. squidGuard → Log → Blocked : règle default → 3. Common ACL : Default access → 4. Passer sur allow, Save → 5. Apply puis retester
- Pièges : Enregistrer la page sans cliquer sur Apply ne change rien pour les utilisateurs : les modifications de squidGuard ne s’appliquent qu’après Apply. · Arrêter squidGuard règle le symptôme mais supprime tout filtrage par catégories.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_sg_category` — squidGuard : une catégorie n’est plus refusée

- Variantes tirées selon la graine : social_networks (réseaux sociaux) · adult (sites pour adultes)
- Chemin optimal : 1. Identifier le site qui passe → 2. Common ACL → Target Rules List → 3. Repérer la catégorie en allow → 4. Deny + Save + Apply → 5. Retester
- Pièges : Bloquer le site précis dans la Blacklist de Squid ne règle pas les autres sites de la catégorie.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_sg_nolist` — squidGuard sans base de catégories (téléchargement jamais fait)

- Variantes tirées selon la graine : la base de catégories n’a jamais été téléchargée · l’adresse de la liste est erronée et le téléchargement n’a jamais abouti
- Chemin optimal : 1. Constater que le filtrage ne s’applique plus → 2. General settings : service arrêté → 3. Blacklist : base vide / URL → 4. Download → 5. Apply puis retester
- Pièges : Cocher d’autres catégories n’a aucun effet tant que la base n’est pas chargée.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_safesearch` — SafeSearch n’est plus forcé (surcharge DNS www.google.com)

- Variantes tirées selon la graine : la surcharge d’hôte www.google.com a été supprimée · la surcharge d’hôte www.google.com pointe vers l’adresse réelle du moteur (198.51.100.61) au lieu de forcesafesearch.google.com (216.239.38.120) · l’alias www.google.fr de la surcharge d’hôte a été supprimé · le Résolveur DNS est désactivé (les surcharges d’hôte ne sont plus servies)
- Chemin optimal : 1. Constater « Filtering Off » sur /safesearch → 2. DNS Lookup de www.google.com sur pfSense → 3. DNS Resolver : surcharge d’hôte / résolveur → 4. Rétablir la surcharge et l’alias → 5. Retester les deux adresses
- Pièges : Régler SafeSearch dans le navigateur du poste n’est pas verrouillé par l’administrateur.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_dns_upstream` — Le proxy ne résout plus les noms (serveur DNS de pfSense injoignable)

- Variantes tirées selon la graine : le serveur DNS général est 8.8.4.4, qui ne répond pas · aucun serveur DNS général n’est renseigné · le serveur DNS général est 10.10.10.99, qui n’existe pas
- Chemin optimal : 1. Lire la page d’erreur (résolution) → 2. Real Time : NONE_NONE/503 → 3. DNS Lookup depuis pfSense (échec) → 4. Corriger les serveurs DNS généraux → 5. Retester
- Pièges : Désactiver le proxy sur le poste fait résoudre par l’AD et contourne le défaut (et le filtrage).
- Contournements reconnus (ne comptent pas comme résolution) : client_sans_proxy

### `px_log_off` — Journaux du proxy vides (journalisation désactivée)

- Variantes tirées selon la graine : la case « Enable Access Logging » de Squid General est décochée · la case « Enable log » de squidGuard est décochée
- Chemin optimal : 1. Naviguer puis ouvrir Real Time (vide) → 2. Squid → General → 3. squidGuard → General settings → 4. Réactiver la journalisation et appliquer → 5. Naviguer et relire le journal
- Pièges : Vider le journal n’y change rien : il n’est plus alimenté.
- Contournements reconnus (ne comptent pas comme résolution) : —

### `px_trans_off` — Mode transparent : la redirection HTTP ne fonctionne pas

- Variantes tirées selon la graine : la case « Transparent HTTP Proxy » n’est pas cochée · la case « Transparent HTTP Proxy » est cochée mais aucune interface de redirection n’est choisie · l’interface de redirection choisie est WAN au lieu de LAN
- Chemin optimal : 1. Constater que Facebook en HTTP s’ouvre → 2. Real Time : rien n’apparaît → 3. Squid → General : mode transparent → 4. Cocher et choisir LAN → 5. Retester
- Pièges : Reconfigurer le proxy dans le navigateur contourne le mode transparent voulu par l’exercice.
- Contournements reconnus (ne comptent pas comme résolution) : proxy_explicite

### `px_quic` — HTTPS transparent : les sites passent encore par QUIC (UDP 443)

- Chemin optimal : 1. Constater que Facebook en HTTPS s’ouvre → 2. Real Time : aucune requête → 3. Repérer QUIC / UDP 443 → 4. Règle Reject UDP 443 au-dessus du pass-all → 5. Retester
- Pièges : Placer la règle Reject sous « Autoriser LAN vers tout » ne sert à rien : la première règle qui correspond s’applique. · Bloquer TCP 443 coupe tout HTTPS, pas seulement QUIC.
- Contournements reconnus (ne comptent pas comme résolution) : proxy_explicite

### `px_trans_multi` — Filtrage HTTPS transparent inopérant : interception SSL absente et QUIC non bloqué

- Chemin optimal : 1. Constater que le HTTPS n’est pas filtré → 2. Squid General : interception SSL absente → 3. Activer Splice All avec la CA → 4. Reject UDP 443 en tête des règles LAN → 5. Retester Facebook et YouTube
- Pièges : Après avoir ajouté la règle QUIC, Facebook est encore accessible : la tentation est de conclure que la règle est mal placée alors que l’interception SSL manque. · Imposer le proxy explicite dans le navigateur contourne l’objectif du mode transparent.
- Contournements reconnus (ne comptent pas comme résolution) : proxy_explicite

### `px_cascade` — Panne en cascade : Squid ne démarre pas, puis refuse les postes, puis bloque tout

- Chemin optimal : 1. Status → Services : Squid arrêté → 2. Cache Logs : expression régulière invalide, corriger → 3. Real Time : TCP_DENIED/403, ajouter le sous-réseau → 4. squidGuard Log : règle default, repasser sur allow + Apply → 5. Retester tous les cas
- Pièges : S’arrêter à la première correction : Squid démarre mais le poste reste refusé. · Vider la Blacklist et la Whitelist pour « simplifier » rend YouTube accessible.
- Contournements reconnus (ne comptent pas comme résolution) : —

## Pannes N4 qui impliquent le proxy

_aucune parmi les `multi_*` actuelles ; `px_trans_multi` et `px_cascade` sont elles-mêmes de niveau 4_

## Limites de la simulation proxy

Voir `docs/LIMITES.md`, section « Proxy ».
