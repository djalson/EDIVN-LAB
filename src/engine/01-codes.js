/* ============================================================================
   EDIVN-LAB — codes d'erreur affichés (D-106). UN SEUL POINT D'ÉMISSION.

   Règle du projet : un code d'erreur affiché est VÉRIFIÉ (il existe, il a ce sens) et UTILE (on peut le chercher et en
   tirer la cause et la réparation). Sinon il est MASQUÉ : le texte du message reste, le numéro disparaît.

   Mécanisme :
   - le registre SIM.CODES (src/content/09-codes.js) liste chaque code que le jeu peut afficher, avec un statut :
       'verifie'      : le projet l'a vérifié contre une source (capture, documentation officielle) ;
       'non-verifie'  : affiché mais pas encore vérifié (statut par défaut d'un code connu) ;
       'masque'       : retiré de l'affichage (texte conservé, numéro retiré) ;
   - SIM.CODES_STRICT = true : seuls les codes 'verifie' sortent. false (état actuel) : tout sort sauf 'masque' ;
   - toute sortie passe par SIM.codes.text(texte, contexte) (terminaux : E.L ; boîtes de dialogue ; pages du navigateur)
     ou SIM.codes.ev(source, id, contexte) (journaux d'événements Windows) ;
   - tout code rencontré à l'exécution est consigné (SIM.codes.seen) ; un code absent du registre est consigné
     (SIM.codes.unlisted) et fait échouer le test d'audit (tests/codes-audit.js).
   Cette couche ne CRÉE ni ne CORRIGE aucun code : elle ne fait que retirer. Aucun code ne s'y vérifie lui-même.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM = g.SIM || {};

/* familles de codes reconnues dans un texte. Une alternative par famille, la plus spécifique d'abord. */
const RE = new RegExp([
  '(%[A-Z][A-Z0-9_]*-\\d-[A-Z][A-Z0-9_]*)',                          // 1 : ligne de journal IOS (%FACILITY-n-MNEMONIC)
  '(ERROR \\d{4} \\([0-9A-Z]{5}\\))',                                // 2 : MariaDB / MySQL
  '(\\d{3,5} 0x[0-9a-fA-F]{2,4} (?:ERROR_[A-Z_]+))',                // 3 : nltest : « 1355 0x54b ERROR_NO_SUCH_DOMAIN »
  '((?:NET::)?(?:DNS_ERROR_[A-Z_]+|ERROR_[A-Z_]+|SEC_E_[A-Z_]+|ERR_[A-Z][A-Z0-9_]+))', // 4 : noms symboliques
  '(\\b0x[89A-Fa-f][0-9A-Fa-f]{7}\\b)',                             // 5 : HRESULT / NTSTATUS (8 chiffres hexa)
  '(\\bHTTP [45]\\d\\d(?:\\.\\d{1,2})?\\b)'                          // 6 : statut HTTP d'erreur, sous-code IIS compris (404.0)
].join('|'), 'g');

/* familles dont le masquage attend une décision du projet (D-106 §4 : une ligne de journal IOS est son propre
   identifiant ; que montrer quand elle n'est pas vérifiée ? Proposition en attente) : consignées, jamais masquées. */
const NEVER_MASKED = { ios: true, http: true };   // http : statuts RFC 4xx/5xx et sous-codes IIS, consignés, jamais masqués tant que le projet n'a pas tranché

const C = SIM.codes = {
  seen: {},        // id → { n, ctx : [contextes], kind }
  unlisted: {},    // id → contexte : code affiché sans entrée au registre
  reg() { return SIM.CODES || {}; },
  strict() { return !!SIM.CODES_STRICT; },
  reset() { C.seen = {}; C.unlisted = {}; },
  /* identifiant normalisé d'un fragment trouvé dans un texte */
  idOf(kind, tok) {
    if (kind === 'hex') return 'hex:' + tok.toUpperCase().replace(/^0X/, '0x');
    if (kind === 'win32') return 'name:' + tok.replace(/^\d+ 0x[0-9a-fA-F]+ /, '');
    if (kind === 'name') return 'name:' + tok;
    if (kind === 'http') return 'http:' + tok.replace(/^HTTP /, '');
    return kind + ':' + tok;
  },
  /* le code est-il affichable maintenant ? (n'enregistre rien) */
  visible(id, kind) {
    const e = C.reg()[id];
    if (!e) return true;                         // inconnu : on ne masque pas ce qu'on ne connaît pas, mais l'audit échoue
    if (NEVER_MASKED[kind]) return true;
    if (C.strict()) return e.status === 'verifie';
    return e.status !== 'masque';
  },
  note(id, kind, ctx) {
    const s = C.seen[id] || (C.seen[id] = { n: 0, ctx: [], kind });
    s.n++; if (ctx && s.ctx.indexOf(ctx) < 0 && s.ctx.length < 8) s.ctx.push(ctx);
    if (!C.reg()[id]) C.unlisted[id] = ctx || '';
  },
  /* texte → texte, codes masqués retirés ; consigne tout ce qui passe */
  text(t, ctx) {
    if (t === undefined || t === null) return t;
    const s = String(t);
    if (s.length < 5) return s;
    let masked = false;
    const out = s.replace(RE, (m, ios, sql, w32, name, hex, http) => {
      const kind = ios ? 'ios' : sql ? 'sql' : w32 ? 'win32' : name ? 'name' : http ? 'http' : 'hex';
      const id = C.idOf(kind, m);
      C.note(id, kind, ctx);
      if (C.visible(id, kind)) return m;
      masked = true; return '';
    });
    return masked ? C.tidy(out) : out;
  },
  /* repli typographique après retrait d'un numéro : parenthèses vides, espaces doubles, séparateur orphelin en fin */
  tidy(s) {
    return s.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/ {2,}/g, ' ').replace(/\s+([.,;])/g, '$1').replace(/\s*[:=]\s*$/g, '').replace(/[ \t]+$/g, '');
  },
  /* identifiant d'événement Windows : renvoie l'ID, ou '' s'il est masqué */
  ev(source, id, ctx) {
    const key = 'evt:' + source + ':' + id;
    C.note(key, 'evt', ctx || 'journal');
    const e = C.reg()[key];
    if (!e) return id;
    if (C.strict()) return e.status === 'verifie' ? id : '';
    return e.status === 'masque' ? '' : id;
  },
  /* pour les tests : rapport de ce qui est sorti sans entrée au registre */
  report() { return { seen: C.seen, unlisted: C.unlisted }; }
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
