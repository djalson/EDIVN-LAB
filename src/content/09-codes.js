/* ============================================================================
   EDIVN-LAB — registre des codes d'erreur affichés (D-106). Données seules, aucune logique.
   Lu par src/engine/01-codes.js (SIM.codes) : un code 'masque' sort sans numéro (le texte reste) ; un code absent d'ici
   est consigné (SIM.codes.unlisted) et fait échouer tests/codes-audit.js et tout test Node qui l'affiche.

   Statuts :
     'non-verifie' : affiché, pas encore vérifié par le projet contre une source (D-106 : c'est le PROJET qui vérifie, pas le code) ;
     'masque'      : numéro retiré de l'affichage, texte conservé ;
     'verifie'     : à poser par le projet seul, avec la source dans docs/CODES-ERREUR.md. AUCUN code n'est 'verifie' à ce jour.
   SIM.CODES_STRICT = true ne laisserait sortir que les 'verifie' (interrupteur unique de la mesure, D-106).
   Les familles IOS (%…) et HTTP sont consignées mais jamais masquées tant que le projet n'a pas tranché le cas limite
   (docs/DECISIONS-PROPOSEES.md, « Codes d'erreur »).
   Origine des valeurs : la mémoire de l'auteur du code, sans source, SAUF mention contraire. Rien ici n'a été vérifié.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM = g.SIM || {};
SIM.CODES_STRICT = false;
const C = SIM.CODES = {};
const add = (id, status, from, note) => { C[id] = { status, from, note: note || '' }; };
const NV = 'non-verifie';
/* journaux de commutateur IOS (%FACILITE-n-MNEMONIQUE) — attendent les captures du bloc réseau (SESSION-VM-V21-RESEAU) */
add('ios:%EC-5-BUNDLE', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%EC-5-CANNOT_BUNDLE2', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%EC-5-UNBUNDLE', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%LINEPROTO-5-UPDOWN', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%LINK-3-UPDOWN', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%LINK-5-CHANGED', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%OSPF-4-DUP_RTRID_NBR', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%OSPF-5-ADJCHG', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%PM-4-ERR_DISABLE', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%PORT_SECURITY-2-PSECURE_VIOLATION', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%SPANTREE-5-ROOTCHANGE', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%SSH-5-DISABLED', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%SSH-5-ENABLED', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%SYS-5-CONFIG_I', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
add('ios:%SYS-5-RELOAD', NV, 'moteur IOS / émulateur', 'ligne de journal IOS : son propre identifiant (cas limite, proposition en attente)');
/* codes HRESULT / NTSTATUS (hexadécimal à 8 chiffres) */
add('hex:0x80070002', NV, 'ui/63-app-explorer.js');
add('hex:0x80070005', NV, 'emu/12-wincmd-sys.js');
add('hex:0x80070035', NV, 'ui/63-app-explorer.js');
add('hex:0x80070043', NV, 'ui/63-app-explorer.js');
add('hex:0x80070426', NV, 'emu/12-wincmd-sys.js');
add('hex:0x80072746', NV, 'emu/12-wincmd-sys.js');
add('hex:0x80090325', NV, 'emu/11-wincmd-net.js');
add('hex:0xC0000064', NV, 'engine/35-ad.js');
add('hex:0xC000006A', NV, 'engine/35-ad.js');
add('hex:0xC000006D', NV, 'engine/35-ad.js');
add('hex:0xC000006F', NV, 'engine/35-ad.js');
add('hex:0xC0000070', NV, 'engine/35-ad.js');
add('hex:0xC0000071', NV, 'engine/35-ad.js');
add('hex:0xC0000072', NV, 'engine/35-ad.js');
add('hex:0xC0000193', NV, 'engine/35-ad.js');
add('hex:0xC0000234', NV, 'engine/35-ad.js');
/* noms symboliques (Win32, DNS, SChannel, navigateur, proxy) */
add('name:ERROR_NO_LOGON_SERVERS', NV, 'emu/12-wincmd-sys.js (nltest)');
add('name:ERROR_NO_SUCH_DOMAIN', NV, 'emu/12-wincmd-sys.js (nltest)');
add('name:ERROR_NO_TRUST_LSA_SECRET', NV, 'emu/12-wincmd-sys.js (nltest)');
add('name:DNS_ERROR_RCODE_NAME_ERROR', NV, 'emu/13-powershell.js');
add('name:DNS_ERROR_RCODE_SERVER_FAILURE', NV, 'emu/13-powershell.js');
add('name:ERROR_TIMEOUT', NV, 'emu/13-powershell.js');
add('name:SEC_E_UNTRUSTED_ROOT', NV, 'emu/11-wincmd-net.js');
add('name:ERR_ADDRESS_UNREACHABLE', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_ADDRESS_UNREACHABLE', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_CERT_AUTHORITY_INVALID', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_CERT_AUTHORITY_INVALID', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_CERT_COMMON_NAME_INVALID', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_CERT_COMMON_NAME_INVALID', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_CERT_DATE_INVALID', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_CERT_DATE_INVALID', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_CONNECTION_REFUSED', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_CONNECTION_REFUSED', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_CONNECTION_TIMED_OUT', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_CONNECTION_TIMED_OUT', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_NAME_NOT_RESOLVED', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_NAME_NOT_RESOLVED', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_PROXY_CONNECTION_FAILED', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_PROXY_CONNECTION_FAILED', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_SSL_PROTOCOL_ERROR', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_SSL_PROTOCOL_ERROR', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_TOO_MANY_REDIRECTS', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_TOO_MANY_REDIRECTS', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_TUNNEL_CONNECTION_FAILED', NV, 'engine/62-web.js, ui/70-app-browser.js (navigateur)');
add('name:NET::ERR_TUNNEL_CONNECTION_FAILED', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_CONNECT_FAIL', NV, 'engine/52-squid.js (page d’erreur du proxy)');
add('name:NET::ERR_CONNECT_FAIL', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
add('name:ERR_DNS_FAIL', NV, 'engine/52-squid.js (page d’erreur du proxy)');
add('name:NET::ERR_DNS_FAIL', NV, 'ui/70-app-browser.js (écran d’erreur du navigateur)');
/* MariaDB / MySQL */
add('sql:ERROR 1044 (42000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1045 (28000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1046 (3D000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1049 (42000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1064 (42000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1130 (HY000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1141 (42000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1142 (42000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1227 (42000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 1396 (HY000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 2002 (HY000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
add('sql:ERROR 2005 (HY000)', NV, 'emu/21-bash-sys.js, engine/73-fault-lx.js');
/* statuts HTTP d'erreur (consignés, jamais masqués) */
add('http:400', NV, 'engine/62-web.js, content/22-faults-gpo-web.js');
add('http:401.3', NV, 'engine/62-web.js, content/22-faults-gpo-web.js');
add('http:403', NV, 'engine/62-web.js, content/22-faults-gpo-web.js');
add('http:403.14', NV, 'engine/62-web.js, content/22-faults-gpo-web.js');
add('http:404', NV, 'engine/62-web.js, content/22-faults-gpo-web.js');
add('http:503', NV, 'engine/62-web.js, content/22-faults-gpo-web.js');
/* identifiants d'événements Windows (journaux). Masqués dès maintenant : valeurs tenues de la mémoire de l'auteur (consigne du 29/10, travail 3.2) */
add('evt:Microsoft-Windows-DHCP-Server:1046', 'masque', 'engine/30-win.js, engine/35-ad.js', 'valeur tenue de la mémoire de l’auteur : numéro masqué jusqu’à vérification par le projet');
add('evt:Microsoft-Windows-DHCP-Server:1063', 'masque', 'engine/30-win.js, engine/35-ad.js', 'valeur tenue de la mémoire de l’auteur : numéro masqué jusqu’à vérification par le projet');
add('evt:Microsoft-Windows-GroupPolicy:1502', 'masque', 'engine/30-win.js, engine/35-ad.js', 'valeur tenue de la mémoire de l’auteur : numéro masqué jusqu’à vérification par le projet');
add('evt:Microsoft-Windows-GroupPolicy:1058', NV, 'engine/30-win.js, engine/35-ad.js');
add('evt:Microsoft-Windows-GroupPolicy:1129', NV, 'engine/30-win.js, engine/35-ad.js');
add('evt:Service Control Manager:7036', NV, 'engine/30-win.js, engine/35-ad.js');
add('evt:Microsoft-Windows-Security-Auditing:4624', NV, 'engine/30-win.js, engine/35-ad.js');
add('evt:Microsoft-Windows-Security-Auditing:4625', NV, 'engine/30-win.js, engine/35-ad.js');
add('evt:Microsoft-Windows-Security-Auditing:4740', NV, 'engine/30-win.js, engine/35-ad.js');
add('evt:Microsoft-Windows-Security-Auditing:4771', NV, 'engine/30-win.js, engine/35-ad.js');
})(typeof globalThis !== 'undefined' ? globalThis : window);
