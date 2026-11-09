/* ============================================================================
   Windows — commandes système : net, sc, gpupdate, gpresult, nltest, w32tm, netsh, icacls, klist…
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, N = SIM.net, WIN = SIM.win, AD = SIM.ad;
const E = SIM.emu; const L = E.L, W_ = E.win; const C = W_.cmds;
const lc = s => String(s).toLowerCase();

U.av('net-cmd-fr', 'Sorties de net use / view / user / group / share / time / accounts / start / stop en français : libellés et mise en page reconstitués de mémoire.');
U.av('sc-fr', 'Sorties de sc query / qc / start / stop en français : libellés (NOM_SERVICE, ÉTAT, TYPE_DÉMARRAGE…) reconstitués de mémoire.');
U.av('gpresult-fr', 'gpresult /r en français : intitulés de sections (PARAMÈTRES DE L’ORDINATEUR / DE L’UTILISATEUR, Objets de stratégie de groupe appliqués, motifs de filtrage) reconstitués de mémoire.');
U.av('nltest-fr', 'nltest /dsgetdc, /sc_query : libellés français et indicateurs reconstitués de mémoire.');
U.av('w32tm-fr', 'w32tm /query /status en français : libellés (Indicateur de saut, Strate, ID de référence…) reconstitués de mémoire.');
U.av('netsh-fr', 'netsh interface ip / advfirewall : libellés français reconstitués de mémoire.');
U.av('netsh-set-interface', 'netsh interface set interface name="…" admin=enabled|disabled : exécution silencieuse (pas de message) et mot-clé « admin » en anglais reconstitués de mémoire.');
U.av('icacls-fr', 'icacls : format des ACE ((OI)(CI)(F)…) exact ; message final « n fichiers ont été correctement traités ; échec du traitement de 0 fichiers » reconstitué.');

const needAdmin = (s, o, r, text) => { if (s.elevated) return true; o.l(text || 'Accès refusé.', 'e'); r.ok = false; return false; };

/* ------------------------------------------------------------------ services */
W_.svcFind = function (d, name) {
  const svc = d.win.svc || {}; const q = lc(name);
  let key = Object.keys(svc).find(k => lc(k) === q);
  if (!key) key = Object.keys(svc).find(k => lc(WIN.SVC_DISPLAY[k] || k) === q);
  return key || null;
};
W_.svcTarget = function (s, serverArg) {
  /* \\SERVEUR → appareil distant (RPC 135 + 445, droits d'administrateur) */
  if (!serverArg) return { dev: s.d };
  const nm = serverArg.replace(/^\\\\/, ''); const r = U.isIP(nm) ? { ok: true, ip: nm } : N.resolve(s.W, s.devId, nm);
  if (!r.ok) return { err: 1722 };
  const c = N.connect(s.W, s.devId, r.ip, 'tcp', 135); const c2 = N.connect(s.W, s.devId, r.ip, 'tcp', 445);
  if (c.state !== 'open' || c2.state !== 'open') return { err: 1722 };
  const t = s.W.d(c.dstDev);
  if (!t.win) return { err: 1722 };
  const tok = W_.token(s.W, s.d); if (!s.d._rt.session || (tok.indexOf ? false : !tok.has('builtin\\administrateurs'))) return { err: 5 };
  if (!tok.has('builtin\\administrateurs') && !(s.d._rt.session && s.d._rt.session.local)) return { err: 5 };
  return { dev: t };
};
const STATE = { running: ['4', 'RUNNING', '(STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)'], stopped: ['1', 'STOPPED', '(NOT_STOPPABLE, NOT_PAUSABLE, IGNORES_SHUTDOWN)'] };
const START = { auto: ['2', 'AUTO_START'], 'auto-delayed': ['2', 'AUTO_START  (DELAYED)'], manual: ['3', 'DEMAND_START'], disabled: ['4', 'DISABLED'] };
function scQueryLines(d, key) {
  const st = d.win.svc[key].state; const S = STATE[st];
  return ['NOM_SERVICE: ' + key, '        TYPE               : 20  WIN32_SHARE_PROCESS', '        ÉTAT               : ' + S[0] + '  ' + S[1], '                                ' + S[2], '        CODE_RETOUR_WIN32  : 0  (0x0)', '        CODE_RETOUR_SERVICE: 0  (0x0)', '        POINT_CONTRÔLE     : 0x0', '        INDICE_ATTENTE     : 0x0'];
}
C.sc = C.sc_exe = (s, a, o, r) => {
  let args = a.slice(); let server = null; if (args[0] && args[0].indexOf('\\\\') === 0) server = args.shift();
  const verb = lc(args[0] || ''); const tgt = W_.svcTarget(s, server);
  if (tgt.err) { o.blank(); o.l(tgt.err === 5 ? '[SC] OpenSCManager a échoué 5 :' : '[SC] OpenSCManager a échoué 1722 :', 'e'); o.blank(); o.l(tgt.err === 5 ? 'Accès refusé.' : 'Le serveur RPC n’est pas disponible.', 'e'); r.ok = false; return; }
  const d = tgt.dev;
  if (!verb) { o.l('DESCRIPTION :'); o.l('        SC est un programme en ligne de commande servant à communiquer avec'); o.l('        le Gestionnaire de contrôle des services et les services.'); return; }
  if (verb === 'query' || verb === 'queryex') {
    const nm = args[1] && !/=/.test(args[1]) ? args[1] : null;
    if (nm) {
      const key = W_.svcFind(d, nm); if (!key) { o.blank(); o.l('[SC] EnumQueryServicesStatus:OpenService a échoué 1060 :', 'e'); o.blank(); o.l('Le service spécifié n’existe pas en tant que service installé.', 'e'); r.ok = false; return; }
      o.blank(); scQueryLines(d, key).forEach(x => o.l(x)); return;
    }
    Object.keys(d.win.svc).filter(k => d.win.svc[k].state === 'running').forEach(k => { o.blank(); scQueryLines(d, k).forEach(x => o.l(x)); }); return;
  }
  if (verb === 'qc') {
    const key = W_.svcFind(d, args[1] || ''); if (!key) { o.blank(); o.l('[SC] OpenService a échoué 1060 :', 'e'); o.blank(); o.l('Le service spécifié n’existe pas en tant que service installé.', 'e'); r.ok = false; return; }
    const sv = d.win.svc[key]; const S = START[sv.start] || START.manual;
    o.l('[SC] QueryServiceConfig réussite(s)'); o.blank(); o.l('NOM_SERVICE: ' + key); o.l('        TYPE               : 20  WIN32_SHARE_PROCESS'); o.l('        TYPE_DÉMARRAGE     : ' + S[0] + '   ' + S[1]); o.l('        CONTRÔLE_ERREUR    : 1   NORMAL');
    o.l('        NOM_CHEMIN_BINAIRE : C:\\Windows\\system32\\svchost.exe -k ' + key); o.l('        GROUPE_ORDRE_CHARGE:'); o.l('        TAG                : 0'); o.l('        NOM_AFFICHAGE      : ' + (WIN.SVC_DISPLAY[key] || key)); o.l('        DÉPENDANCES        :'); o.l('        NOM_DÉMARRAGE_SERVICE : LocalSystem'); return;
  }
  if (verb === 'start' || verb === 'stop') {
    if (!needAdmin(s, o, r)) { o.blank(); }
    if (!s.elevated && !server) { o.l('[SC] OpenService a échoué 5 :', 'e'); o.blank(); o.l('Accès refusé.', 'e'); return; }
    const key = W_.svcFind(d, args[1] || ''); if (!key) { o.blank(); o.l('[SC] OpenService a échoué 1060 :', 'e'); o.blank(); o.l('Le service spécifié n’existe pas en tant que service installé.', 'e'); r.ok = false; return; }
    const sv = d.win.svc[key];
    if (verb === 'start') {
      if (sv.state === 'running') { o.l('[SC] StartService a échoué 1056 :', 'e'); o.blank(); o.l('Une instance du service est déjà en cours d’exécution.', 'e'); r.ok = false; return; }
      if (sv.start === 'disabled') { o.l('[SC] StartService a échoué 1058 :', 'e'); o.blank(); o.l('Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.', 'e'); r.ok = false; return; }
      WIN.setSvc(s.W, d.id, key, 'running'); s.env.advance(2); s.env.touch('svc'); r.mutated = true; o.blank(); o.l('NOM_SERVICE: ' + key); o.l('        TYPE               : 20  WIN32_SHARE_PROCESS'); o.l('        ÉTAT               : 2  START_PENDING'); o.l('                                (NOT_STOPPABLE, NOT_PAUSABLE, IGNORES_SHUTDOWN)'); o.l('        CODE_RETOUR_WIN32  : 0  (0x0)'); o.l('        CODE_RETOUR_SERVICE: 0  (0x0)'); o.l('        POINT_CONTRÔLE     : 0x0'); o.l('        INDICE_ATTENTE     : 0x7d0'); o.l('        PID                : ' + (900 + parseInt(U.hash8(key).slice(0, 3), 16) % 3000)); o.l('        INDICATEURS        :');
    } else {
      if (sv.state !== 'running') { o.l('[SC] ControlService a échoué 1062 :', 'e'); o.blank(); o.l('Le service n’a pas été démarré.', 'e'); r.ok = false; return; }
      WIN.setSvc(s.W, d.id, key, 'stopped'); s.env.advance(2); s.env.touch('svc'); r.mutated = true; r.impact = 'svc-stop'; o.blank(); o.l('NOM_SERVICE: ' + key); o.l('        TYPE               : 20  WIN32_SHARE_PROCESS'); o.l('        ÉTAT               : 3  STOP_PENDING'); o.l('                                (STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)'); o.l('        CODE_RETOUR_WIN32  : 0  (0x0)'); o.l('        CODE_RETOUR_SERVICE: 0  (0x0)'); o.l('        POINT_CONTRÔLE     : 0x0'); o.l('        INDICE_ATTENTE     : 0x0');
    }
    return;
  }
  if (verb === 'config') {
    if (!s.elevated && !server) { o.l('[SC] OpenService a échoué 5 :', 'e'); o.blank(); o.l('Accès refusé.', 'e'); r.ok = false; return; }
    const key = W_.svcFind(d, args[1] || ''); if (!key) { o.blank(); o.l('[SC] OpenService a échoué 1060 :', 'e'); o.blank(); o.l('Le service spécifié n’existe pas en tant que service installé.', 'e'); r.ok = false; return; }
    const txt = args.slice(2).join(' '); const m = txt.match(/start=\s*(\S+)/i);
    if (!m) { o.l('[SC] ChangeServiceConfig réussite(s)'); return; }
    const map = { auto: 'auto', 'delayed-auto': 'auto-delayed', demand: 'manual', disabled: 'disabled', boot: 'auto', system: 'auto' };
    if (!map[lc(m[1])]) { o.l('[SC] ChangeServiceConfig a échoué 87 :', 'e'); o.blank(); o.l('Le paramètre est incorrect.', 'e'); r.ok = false; return; }
    d.win.svc[key].start = map[lc(m[1])]; s.env.touch('svc'); r.mutated = true; o.l('[SC] ChangeServiceConfig réussite(s)'); return;
  }
  o.l('[SC] Commande non prise en charge dans cette simulation : ' + verb, 'e'); r.ok = false;
};

/* ------------------------------------------------------------------ net */
function netErr(o, r, code, msg) { o.blank(); o.l('Erreur système ' + code + '.', 'e'); o.blank(); o.l(msg, 'e'); r.ok = false; }
const NET_MSG = { 5: 'Accès refusé.', 53: 'Le chemin réseau est introuvable.', 67: 'Le nom réseau est introuvable.', 1355: 'Le domaine spécifié n’existe pas ou n’a pas pu être contacté.', 1326: 'Le nom d’utilisateur ou le mot de passe est incorrect.' };
function accessErr(o, r, res) {
  if (res.code === 'badnetpath') return netErr(o, r, 53, NET_MSG[53]);
  if (res.code === 'badnetname') return netErr(o, r, 67, NET_MSG[67]);
  if (res.code === 'nosession') return netErr(o, r, 1326, NET_MSG[1326]);
  return netErr(o, r, 5, NET_MSG[5]);
}
W_.mounts = function (d) { d._rt.mounts = d._rt.mounts || {}; return d._rt.mounts; };
W_.driveMaps = function (d) {
  const out = []; const gp = d._rt.gp && d._rt.gp.user; const m = W_.mounts(d);
  if (gp && gp.settings) Object.keys(gp.settings).forEach(k => { if (/^drive\./.test(k)) out.push({ letter: k.slice(6).toUpperCase() + ':', unc: gp.settings[k].value, gpo: true }); });
  Object.keys(m).forEach(l => out.push({ letter: l, unc: m[l].unc }));
  return out;
};
function netAs(s, userArg, pwdArg, fn) {
  /* exécute fn avec les identifiants explicites (net use /user:) */
  const d = s.d, W = s.W; if (!userArg) return fn();
  const m = userArg.match(/^(?:([^\\]+)\\)?(.+)$/); const sam = m[2];
  const lg = AD.logon(W, d.id, sam, pwdArg, { dry: false });
  if (!lg.ok) return { ok: false, code: 'badcreds' };
  const saved = d._rt.session; d._rt.session = { user: sam, token: lg.token ? [...lg.token] : null, local: !!lg.local };
  try { return fn(); } finally { d._rt.session = saved; }
}
/* ------------------------------------------------------------------ iisreset */
U.av('iisreset-fr', 'iisreset : messages français (« Tentative d’arrêt… », « Arrêt d’Internet services réussi », « Tentative de démarrage… », « Redémarrage d’Internet services réussi ») et options /stop /start /restart /status reconstitués de mémoire.');
C.iisreset = (s, a, o, r) => {
  const d = s.d;
  if (!d.win.iis) return { ok: false, out: [L('\'iisreset\' n’est pas reconnu en tant que commande interne', 'e'), L('ou externe, un programme exécutable ou un fichier de commandes.', 'e'), L('')] };
  if (!s.elevated) { o.l('Vous devez être administrateur pour exécuter cette commande.', 'e'); r.ok = false; return; }
  const op = a.map(x => lc(x)).find(x => /^\/(stop|start|restart|status)$/.test(x)) || '/restart';
  const st = () => (d.win.svc.W3SVC && d.win.svc.W3SVC.state === 'running');
  if (op === '/status') { o.blank(); o.l('Statut de Service de publication World Wide Web ( W3SVC ) : ' + (st() ? 'En cours d’exécution' : 'Arrêté')); return; }
  if (op !== '/start') { o.l('Tentative d’arrêt...'); SIM.win.setSvc(s.W, d.id, 'W3SVC', 'stopped'); o.l('Arrêt d’Internet services réussi'); }
  if (op !== '/stop') { o.l('Tentative de démarrage...'); SIM.win.setSvc(s.W, d.id, 'W3SVC', 'running'); o.l(op === '/start' ? 'Démarrage d’Internet services réussi' : 'Redémarrage d’Internet services réussi'); }
  s.env.advance(4); s.env.touch('svc'); r.mutated = true;
};

/* ------------------------------------------------------------------ partages SMB (net share / New-SmbShare…) */
U.av('net-share-write-fr', 'net share Nom=chemin /GRANT: /REMARK: /DELETE : messages de succès (« … a été partagé. », « … a été supprimé. ») et erreurs 2118 / 2310 / 3 en français reconstitués de mémoire.');
W_.shareWho = function (n) {
  const x = lc(String(n).trim());
  if (x === 'everyone') return 'Tout le monde';
  if (x === 'authenticated users' || x === 'nt authority\\authenticated users' || x === 'nt authority\\utilisateurs authentifiés') return 'Utilisateurs authentifiés';
  if (x === 'tout le monde') return 'Tout le monde';
  return String(n).trim();
};
W_.shareRight = function (a) { const x = lc(String(a).trim()); if (x === 'full' || x === 'fullcontrol' || x === 'contrôle total') return 'FullControl'; if (x === 'change' || x === 'modify' || x === 'modifier') return 'Modify'; if (x === 'read' || x === 'lecture') return 'Read'; return null; };
/* crée un partage sur l'appareil local ; retourne { code, msg } en cas d'échec, { ok:true, share } sinon */
W_.shareCreate = function (s, name, path, opts) {
  const d = s.d; d.win.shares = d.win.shares || [];
  const p = W_.normPath(s.cwd || 'C:\\', path);
  if (!W_.dirNode(s.W, d, p)) return { code: 3, msg: 'Le chemin d’accès spécifié est introuvable.' };
  if (/^(ipc|admin|[a-z])\$$/i.test(name) || d.win.shares.some(x => lc(x.name) === lc(name))) return { code: 2118, msg: 'Le nom est déjà partagé.' };
  const sh = { name, path: p.length === 2 ? p + '\\' : p, comment: opts.remark || '', perms: opts.perms && opts.perms.length ? opts.perms : [{ who: 'Tout le monde', access: 'Read' }] };
  d.win.shares.push(sh); s.env.touch('acl'); return { ok: true, share: sh };
};
W_.shareRemove = function (s, name) {
  const sh = s.d.win.shares || []; const i = sh.findIndex(x => lc(x.name) === lc(name));
  if (i < 0) return false; sh.splice(i, 1); s.env.touch('acl'); return true;
};

C.net = C.net1 = (s, a, o, r) => {
  const d = s.d, W = s.W; const verb = lc(a[0] || ''); const rest = a.slice(1);
  if (!verb) { o.l('La syntaxe de cette commande est :'); o.blank(); o.l('NET'); o.l('    [ ACCOUNTS | COMPUTER | CONFIG | CONTINUE | FILE | GROUP | HELP |'); o.l('      HELPMSG | LOCALGROUP | PAUSE | SESSION | SHARE | START |'); o.l('      STATISTICS | STOP | TIME | USE | USER | VIEW ]'); return; }
  /* ---- net use ---- */
  if (verb === 'use') {
    const args = rest.filter(x => !/^\//.test(x)); const flags = rest.filter(x => /^\//.test(x)); const del = flags.some(x => /^\/(d|delete)$/i.test(x));
    const um = flags.find(x => /^\/user:/i.test(x)); const user = um ? um.slice(6) : null;
    if (!args.length) {
      const maps = W_.driveMaps(d);
      if (!maps.length) { o.l('Les nouvelles connexions seront mémorisées.'); o.blank(); o.l('La liste est vide.'); return; }
      o.l('Les nouvelles connexions seront mémorisées.'); o.blank(); o.l('État       Local     Distant                   Réseau'); o.blank(); o.l('-------------------------------------------------------------------------------');
      maps.forEach(m => { const ok = AD.shareAccess(W, d.id, m.unc, 'read'); o.l(E.padR(ok.ok ? 'OK' : 'Non disponible', 12) + E.padR(m.letter, 10) + E.padR(m.unc, 26) + 'Microsoft Windows Network'); });
      o.l('La commande s’est terminée correctement.'); return;
    }
    let letter = null, unc = null, pwd = null;
    args.forEach(x => { if (/^[A-Za-z]:$/.test(x) || x === '*') letter = x.toUpperCase(); else if (x.indexOf('\\\\') === 0) unc = x; else pwd = x; });
    if (del) { const m = W_.mounts(d); if (letter && m[letter]) { delete m[letter]; s.env.touch('mount'); r.mutated = true; o.l(letter + ' a été supprimé.'); } else if (letter === '*' || !letter) { Object.keys(m).forEach(k => delete m[k]); o.l('Les connexions ont été supprimées.'); } else netErr(o, r, 2250, 'La connexion réseau est introuvable.'); return; }
    if (!unc) { o.l('La syntaxe de cette commande est :', 'e'); r.ok = false; return; }
    const res = netAs(s, user, pwd, () => AD.shareAccess(W, d.id, unc, 'read'));
    s.env.advance(res.ok ? 1 : 3);
    s.env.obs('share:' + d.id + ':' + unc, !!res.ok);
    if (!res.ok) { if (res.code === 'badcreds') return netErr(o, r, 1326, NET_MSG[1326]); return accessErr(o, r, res); }
    if (letter && letter !== '*') { W_.mounts(d)[letter] = { unc }; s.env.touch('mount'); r.mutated = true; }
    o.l('La commande s’est terminée correctement.'); return;
  }
  /* ---- net view ---- */
  if (verb === 'view') {
    const unc = rest.find(x => x.indexOf('\\\\') === 0);
    if (!unc) { o.l('Il n’y a aucune entrée dans la liste.'); return; }
    const nm = unc.slice(2); const rs = U.isIP(nm) ? { ok: true, ip: nm } : N.resolve(W, d.id, nm);
    if (!rs.ok) return netErr(o, r, 53, NET_MSG[53]);
    const c = N.connect(W, d.id, rs.ip, 'tcp', 445); if (c.state !== 'open') return netErr(o, r, 53, NET_MSG[53]);
    const srv = W.d(c.dstDev); if (!srv.win) return netErr(o, r, 53, NET_MSG[53]);
    if (!d._rt.session) return netErr(o, r, 5, NET_MSG[5]);
    o.l('Ressources partagées sur ' + unc.toUpperCase()); o.blank(); o.l('Nom de partage  Type   Utilisé comme  Commentaire'); o.blank(); o.l('-------------------------------------------------------------------------------');
    (srv.win.shares || []).forEach(sh => o.l(E.padR(sh.name, 16) + E.padR('Disque', 7) + E.padR('', 15) + (sh.comment || '')));
    o.l('La commande s’est terminée correctement.'); s.env.obs('share:' + d.id + ':' + unc, true); return;
  }
  /* ---- net share ---- */
  if (verb === 'share') {
    const sh = d.win.shares || [];
    if (!rest.length) {
      o.blank(); o.l('Nom de partage  Ressource                        Remarque'); o.blank(); o.l('-------------------------------------------------------------------------------');
      const sys = [['IPC$', '', 'IPC distant'], ['ADMIN$', 'C:\\Windows', 'Administration à distance'], ['C$', 'C:\\', 'Partage par défaut']];
      sys.concat(sh.map(x => [x.name, x.path, x.comment || ''])).forEach(x => o.l(E.padR(x[0], 16) + E.padR(x[1], 32) + x[2]));
      o.l('La commande s’est terminée correctement.'); return;
    }
    /* création : net share Nom=chemin [/GRANT:utilisateur,{READ|CHANGE|FULL}] [/REMARK:"texte"] ; suppression : net share Nom /DELETE */
    const dflag = rest.some(x => /^\/(d|delete)$/i.test(x));
    const eq = rest.join(' ').match(/^([^=\/\s]+)=(\S+(?:\s+(?![\/])\S+)*)/);
    if (dflag) {
      const nm0 = rest.find(x => !/^\//.test(x));
      if (!s.elevated) return netErr(o, r, 5, NET_MSG[5]);
      if (!W_.shareRemove(s, nm0)) return netErr(o, r, 2310, 'Ce nom de partage n’existe pas.');
      r.mutated = true; o.l(nm0 + ' a été supprimé.'); return;
    }
    if (eq) {
      if (!s.elevated) return netErr(o, r, 5, NET_MSG[5]);
      const flags = rest.join(' ').split(/\s(?=\/)/).slice(1); const perms = []; let remark = '';
      for (const f of flags) {
        const g = f.match(/^\/grant:(.+?),(read|change|full)$/i); const rk = f.match(/^\/remark:"?(.*?)"?$/i);
        if (g) perms.push({ who: W_.shareWho(g[1]), access: W_.shareRight(g[2]) });
        else if (rk) remark = rk[1];
        else if (!/^\/(users|cache|unlimited)/i.test(f)) { o.l('La syntaxe de cette commande est :', 'e'); o.blank(); o.l('NET SHARE', 'e'); o.l('sharename', 'e'); o.l('          sharename=drive:path [/GRANT:user,[READ | CHANGE | FULL]]', 'e'); r.ok = false; return; }
      }
      const res = W_.shareCreate(s, eq[1], eq[2], { remark, perms });
      if (!res.ok) return netErr(o, r, res.code, res.msg);
      r.mutated = true; o.l(eq[1] + ' a été partagé.'); return;
    }
    const found = sh.find(x => lc(x.name) === lc(rest[0]));
    if (!found) return netErr(o, r, 2310, 'Ce nom de partage n’existe pas.');
    o.l('Nom de partage        ' + found.name); o.l('Chemin d’accès         ' + found.path); o.l('Remarque              ' + (found.comment || '')); o.l('Nb maximal d’utilisateurs Pas de limite'); o.l('Utilisateurs'); o.l('Mise en cache           Mise en cache manuelle des documents'); o.l('Autorisation           ' + (found.perms || []).map(p => p.who + ', ' + ({ FullControl: 'FULL', Modify: 'CHANGE', Read: 'READ' }[p.access] || p.access)).join('\n                      ')); o.l('La commande s’est terminée correctement.'); return;
  }
  /* ---- net time ---- */
  if (verb === 'time') {
    const unc = rest.find(x => x.indexOf('\\\\') === 0); let dev = d;
    if (unc) { const rs = N.resolve(W, d.id, unc.slice(2)); const c = rs.ok && N.connect(W, d.id, rs.ip, 'tcp', 445); if (!rs.ok || c.state !== 'open') return netErr(o, r, 53, NET_MSG[53]); dev = W.d(c.dstDev); }
    o.l('L’heure actuelle sur \\\\' + W_.fqdn(dev) + ' est le ' + E.frDateTime(W.nowOf(dev.id))); o.l('La commande s’est terminée correctement.'); return;
  }
  /* ---- net accounts ---- */
  if (verb === 'accounts') {
    let pol = null;
    if (a.some(x => /^\/domain$/i.test(x)) && d.win.domain) { const dc = AD.byDomain(W, d.win.domain); const c = dc && N.connect(W, d.id, N.l3up(W, dc)[0].ip, 'tcp', 389); if (!c || c.state !== 'open') return netErr(o, r, 1355, NET_MSG[1355]); pol = AD.passwordPolicy(W, dc.win.ad); }
    pol = pol || { minPwdLen: 0, maxPwdAgeDays: 42, minPwdAgeDays: 0, history: 24, lockoutThreshold: 0, lockoutDurationMin: 10, lockoutWindowMin: 10 };
    const P = (k, v) => o.l(E.padR(k, 66) + v);
    P('Forcer la déconnexion des utilisateurs après l’expiration des heures de connexion ?:', 'Oui'); P('Durée de vie minimale du mot de passe (jours):', pol.minPwdAgeDays); P('Durée de vie maximale du mot de passe (jours):', pol.maxPwdAgeDays); P('Longueur minimale du mot de passe:', pol.minPwdLen); P('Longueur de l’historique des mots de passe conservés:', pol.history);
    P('Seuil de verrouillage:', pol.lockoutThreshold || 'Jamais'); P('Durée de verrouillage (minutes):', pol.lockoutDurationMin); P('Fenêtre d’observation du verrouillage (minutes):', pol.lockoutWindowMin); P('Rôle de l’ordinateur:', d.win.ad ? 'PRINCIPAL' : 'STATION DE TRAVAIL'); o.l('La commande s’est terminée correctement.'); return;
  }
  /* ---- net start / stop ---- */
  if (verb === 'start' || verb === 'stop') {
    if (!rest.length) { if (verb === 'start') { o.l('Les services Windows suivants sont démarrés :'); o.blank(); Object.keys(d.win.svc).filter(k => d.win.svc[k].state === 'running').forEach(k => o.l('   ' + (WIN.SVC_DISPLAY[k] || k))); o.blank(); o.l('La commande s’est terminée correctement.'); } return; }
    if (!s.elevated) { netErr(o, r, 5, NET_MSG[5]); return; }
    const key = W_.svcFind(d, rest.join(' ')); if (!key) { o.l('Le nom de service n’est pas valide.', 'e'); o.blank(); o.l('Vous pouvez obtenir une aide supplémentaire en entrant NET HELPMSG 2185.', 'e'); r.ok = false; return; }
    const sv = d.win.svc[key]; const disp = WIN.SVC_DISPLAY[key] || key;
    if (verb === 'start') {
      if (sv.state === 'running') { o.l('Le service demandé a déjà été démarré.', 'e'); o.blank(); o.l('Vous pouvez obtenir une aide supplémentaire en entrant NET HELPMSG 2182.', 'e'); r.ok = false; return; }
      if (sv.start === 'disabled') { o.l('Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.', 'e'); o.blank(); o.l('Vous pouvez obtenir une aide supplémentaire en entrant NET HELPMSG 3523.', 'e'); r.ok = false; return; }
      o.l('Le service ' + disp + ' démarre.'); o.blank(); WIN.setSvc(W, d.id, key, 'running'); s.env.advance(3); s.env.touch('svc'); r.mutated = true; o.l('Le service ' + disp + ' a démarré.', 'o', 1200); o.blank(); return;
    }
    if (sv.state !== 'running') { o.l('Le service ' + disp + ' n’est pas démarré.', 'e'); o.blank(); o.l('Vous pouvez obtenir une aide supplémentaire en entrant NET HELPMSG 3521.', 'e'); r.ok = false; return; }
    o.l('Le service ' + disp + ' s’arrête.'); WIN.setSvc(W, d.id, key, 'stopped'); s.env.advance(3); s.env.touch('svc'); r.mutated = true; r.impact = 'svc-stop'; o.l('Le service ' + disp + ' a été arrêté.', 'o', 1200); o.blank(); return;
  }
  if (verb === 'helpmsg') { const n = +rest[0]; const m = { 2182: 'Le service demandé a déjà été démarré.', 3521: 'Le service n’a pas été démarré.', 3523: 'Le service ne peut pas être démarré, soit parce qu’il est désactivé, soit parce qu’il n’est associé à aucun périphérique activé.', 53: 'Le chemin réseau est introuvable.', 5: 'Accès refusé.' }; o.blank(); o.l(m[n] || 'Message d’aide non disponible.'); return; }
  /* ---- net user ---- */
  if (verb === 'user') {
    const flags = rest.filter(x => /^\//.test(x)).map(lc); const args = rest.filter(x => !/^\//.test(x)); const dom = flags.includes('/domain');
    let A = null, dcDev = null;
    if (dom) {
      if (!d.win.domain) return netErr(o, r, 1355, NET_MSG[1355]);
      dcDev = AD.byDomain(W, d.win.domain); const l3 = dcDev && N.l3up(W, dcDev)[0]; const c = l3 && N.connect(W, d.id, l3.ip, 'tcp', 389);
      if (!c || c.state !== 'open' || !WIN.svcRunning(dcDev, 'NTDS')) { o.l('La demande sera traitée sur un contrôleur de domaine du domaine ' + d.win.domain + '.', 'e'); o.blank(); return netErr(o, r, 1355, NET_MSG[1355]); }
      A = dcDev.win.ad; if (!args.length) { o.l('La demande sera traitée sur un contrôleur de domaine du domaine ' + d.win.domain + '.'); }
    }
    if (!args.length) {
      const names = dom ? A.users.map(u => u.sam) : (d.win.localUsers || []).map(u => u.name).concat(['DefaultAccount', 'Invité']);
      o.blank(); o.l('Comptes d’utilisateurs de ' + (dom ? '\\\\' + dcDev.name : '\\\\' + d.name.toUpperCase())); o.blank(); o.l('-------------------------------------------------------------------------------');
      for (let i = 0; i < names.length; i += 3) o.l(names.slice(i, i + 3).map(x => E.padR(x, 25)).join('')); o.l('La commande s’est terminée correctement.'); return;
    }
    const who = args[0]; const mod = args.slice(1);
    const u = dom ? AD.userOf(A, who) : (d.win.localUsers || []).find(x => lc(x.name) === lc(who));
    if (!u) return netErr(o, r, 2221, 'Le nom d’utilisateur est introuvable.');
    const isModify = mod.length || flags.some(f => /^\/(active|expires|add|delete)/.test(f));
    if (isModify) {
      if (dom) { const tok = W_.token(W, d); if (!s.elevated || !(tok.has ? tok.has(lc(A.netbios) + '\\admins du domaine') : true)) return netErr(o, r, 5, NET_MSG[5]); }
      else if (!s.elevated) return netErr(o, r, 5, NET_MSG[5]);
      const act = flags.find(f => /^\/active:/.test(f));
      if (act) { const yes = /yes|oui/.test(act); if (dom) u.enabled = yes; else u.enabled = yes; s.env.touch('aduser'); r.mutated = true; o.l('La commande s’est terminée correctement.'); return; }
      const nonOpt = mod.filter(x => !/^\//.test(x));
      if (nonOpt.length) {
        const np = nonOpt[0] === '*' ? '*' : nonOpt[0];
        if (np === '*') { r.ask = { prompt: 'Tapez un mot de passe pour l’utilisateur : ', echo: false, cb: (pw) => { const out = new E.Out(); if (dom) { const pol = AD.passwordPolicy(W, A); if (pw.length < pol.minPwdLen) { out.e('Le mot de passe ne répond pas aux exigences de stratégie de mot de passe. Vérifiez la longueur minimale du mot de passe, sa complexité et les exigences d’historique des mots de passe.'); return out; } AD.setPassword(W, d.win.domain, u.sam, pw, false); } else u.pwd = pw; s.env.touch('adpwd'); out.l('La commande s’est terminée correctement.'); return { out: out.lines, mutated: true }; } }; return; }
        if (dom) { const pol = AD.passwordPolicy(W, A); const cx = /[A-Z]/.test(np) && /[a-z]/.test(np) && /\d|[^A-Za-z0-9]/.test(np); if (np.length < pol.minPwdLen || (pol.complexity && !cx)) { o.l('Le mot de passe ne répond pas aux exigences de stratégie de mot de passe. Vérifiez la longueur minimale du mot de passe, sa complexité et les exigences d’historique des mots de passe.', 'e'); o.blank(); o.l('Vous pouvez obtenir une aide supplémentaire en entrant NET HELPMSG 2245.', 'e'); r.ok = false; return; } AD.setPassword(W, d.win.domain, u.sam, np, false); } else { u.pwd = np; W.touch('pwd'); }
        s.env.touch('adpwd'); r.mutated = true; o.l('La commande s’est terminée correctement.'); return;
      }
      o.l('La commande s’est terminée correctement.'); return;
    }
    if (dom) {
      const pol = AD.passwordPolicy(W, A); const tok = AD.token(W, d.win.domain, u.sam); const groups = A.groups.filter(g2 => tok.has(lc(A.netbios) + '\\' + lc(g2.name))).map(g2 => '*' + g2.name);
      const pwdDate = new Date(W.clock.base - AD.pwdAgeDays(W, u) * 86400000); const exp = u.pwdNeverExpires ? 'Jamais' : E.frDateTime(new Date(pwdDate.getTime() + pol.maxPwdAgeDays * 86400000));
      const P = (k, v) => o.l(E.padR(k, 37) + v);
      o.l('La demande sera traitée sur un contrôleur de domaine du domaine ' + d.win.domain + '.'); o.blank();
      P('Nom d’utilisateur', u.sam); P('Nom complet', u.name); P('Commentaire', ''); P('Commentaire de l’utilisateur', ''); P('Code du pays ou de la région', '000 (Valeur par défaut du système)');
      P('Compte : actif', u.enabled === false ? 'Non' : (u.locked ? 'Verrouillé' : 'Oui')); P('Le compte expire', u.expires ? E.frDate(new Date(Date.parse(u.expires))) : 'Jamais'); o.blank();
      P('Dernier changement de mot de passe', E.frDateTime(pwdDate)); P('Le mot de passe expire', exp); P('Le mot de passe peut être changé', E.frDateTime(new Date(pwdDate.getTime() + 86400000))); P('Mot de passe exigé', 'Oui'); P('L’utilisateur peut changer de mot de passe', 'Oui'); o.blank();
      P('Stations autorisées', u.allowedWorkstations && u.allowedWorkstations.length ? u.allowedWorkstations.join(',') : 'Tout'); P('Script d’ouverture de session', ''); P('Profil d’utilisateur', ''); P('Répertoire de base', ''); P('Dernier accès', 'Jamais'); o.blank(); P('Heures d’accès autorisées', u.logonHours ? 'Restreintes' : 'Tout'); o.blank();
      P('Appartient aux groupes locaux', ''); P('Appartient aux groupes globaux', groups.join('  ')); o.l('La commande s’est terminée correctement.'); return;
    }
    const P = (k, v) => o.l(E.padR(k, 37) + v);
    P('Nom d’utilisateur', u.name); P('Nom complet', ''); P('Commentaire', ''); P('Compte : actif', u.enabled === false ? 'Non' : 'Oui'); P('Le compte expire', 'Jamais'); P('Appartient aux groupes locaux', u.admin ? '*Administrateurs  *Utilisateurs' : '*Utilisateurs'); o.l('La commande s’est terminée correctement.'); return;
  }
  /* ---- net group (domaine) / localgroup ---- */
  if (verb === 'group' || verb === 'localgroup') {
    const flags = rest.filter(x => /^\//.test(x)).map(lc); const args = rest.filter(x => !/^\//.test(x));
    if (verb === 'localgroup') {
      const nm = args[0];
      if (!nm) { o.blank(); o.l('Alias pour \\\\' + d.name.toUpperCase()); o.blank(); o.l('-------------------------------------------------------------------------------'); ['*Administrateurs', '*Utilisateurs', '*Utilisateurs du Bureau à distance'].forEach(x => o.l(x)); o.l('La commande s’est terminée correctement.'); return; }
      o.l('Nom de l’alias     ' + nm); o.l('Commentaire'); o.blank(); o.l('Membres'); o.blank(); o.l('-------------------------------------------------------------------------------');
      if (/administrateurs/i.test(nm)) { o.l('Administrateur'); if (d.win.domain) o.l(W_.netbios(W, d) + '\\Admins du domaine'); (d.win.localUsers || []).filter(x => x.admin).forEach(x => o.l(x.name)); } else o.l(d.win.domain ? W_.netbios(W, d) + '\\Utilisateurs du domaine' : '');
      o.l('La commande s’est terminée correctement.'); return;
    }
    if (!d.win.domain || !flags.includes('/domain')) return netErr(o, r, 1355, NET_MSG[1355]);
    const dc = AD.byDomain(W, d.win.domain); const l3 = dc && N.l3up(W, dc)[0]; const c = l3 && N.connect(W, d.id, l3.ip, 'tcp', 389);
    if (!c || c.state !== 'open') return netErr(o, r, 1355, NET_MSG[1355]);
    const A = dc.win.ad;
    if (!args.length) { o.l('La demande sera traitée sur un contrôleur de domaine du domaine ' + d.win.domain + '.'); o.blank(); o.l('Comptes de groupes de \\\\' + dc.name); o.blank(); o.l('-------------------------------------------------------------------------------'); A.groups.filter(x => x.scope === 'Global').forEach(x => o.l('*' + x.name)); o.l('La commande s’est terminée correctement.'); return; }
    const grp = A.groups.find(x => lc(x.name) === lc(args[0])); if (!grp) return netErr(o, r, 2220, 'Le nom de groupe est introuvable.');
    if (args[1]) {
      if (!s.elevated) return netErr(o, r, 5, NET_MSG[5]);
      const tok = W_.token(W, d); if (!(tok.has && tok.has(lc(A.netbios) + '\\admins du domaine'))) return netErr(o, r, 5, NET_MSG[5]);
      if (flags.includes('/add')) { if (!grp.members.some(m => lc(m) === lc(args[1]))) grp.members.push(args[1]); } else if (flags.includes('/delete')) grp.members = grp.members.filter(m => lc(m) !== lc(args[1]));
      s.env.touch('member'); r.mutated = true; o.l('La commande s’est terminée correctement.'); return;
    }
    o.l('La demande sera traitée sur un contrôleur de domaine du domaine ' + d.win.domain + '.'); o.blank(); o.l('Nom du groupe     ' + grp.name); o.l('Commentaire'); o.blank(); o.l('Membres'); o.blank(); o.l('-------------------------------------------------------------------------------');
    for (let i = 0; i < grp.members.length; i += 3) o.l(grp.members.slice(i, i + 3).map(x => E.padR(x, 25)).join('')); o.l('La commande s’est terminée correctement.'); return;
  }
  if (verb === 'config') { o.l('Nom complet de l’ordinateur             ' + W_.fqdn(d).toUpperCase()); o.l('Nom de l’ordinateur                      \\\\' + d.name.toUpperCase()); o.l('Nom d’utilisateur                        ' + (W_.sessionUser(d) || '')); o.l('Domaine de la station de travail           ' + W_.netbios(W, d)); o.l('La commande s’est terminée correctement.'); return; }
  o.l('La syntaxe de cette commande est :', 'e'); r.ok = false;
};

/* ------------------------------------------------------------------ gpupdate / gpresult */
C.gpupdate = (s, a, o, r) => {
  const d = s.d, W = s.W; o.blank(); o.l('Mise à jour de la stratégie...'); o.blank();
  if (!d.win.domain) { o.l('La mise à jour de la stratégie utilisateur s’est terminée sans erreur.'); o.l('La mise à jour de la stratégie d’ordinateur s’est terminée sans erreur.'); return; }
  const user = W_.sessionUser(d); const res = AD.applyGP(W, d.id, user, { logon: false });
  s.env.advance(3); s.env.touch('gpupdate'); r.mutated = true;
  if (res.ok) { o.l('La mise à jour de la stratégie utilisateur s’est terminée sans erreur.', 'o', 600); o.l('La mise à jour de la stratégie d’ordinateur s’est terminée sans erreur.', 'o', 600); }
  else { o.l('La mise à jour de la stratégie utilisateur n’a pas pu se terminer en raison des erreurs suivantes :', 'e'); o.l('Échec du traitement de la stratégie de groupe. Windows n’a pas pu accéder au contrôleur de domaine.', 'e'); o.blank(); o.l('Des erreurs se sont produites pendant le traitement de la stratégie. Consultez le journal des événements pour plus d’informations.', 'e'); r.ok = false; }
  const gp = d._rt.gp && d._rt.gp.user; if (res.ok && gp && gp.pending && gp.pending.length) { o.blank(); o.l('Pour que certains paramètres de stratégie soient appliqués, l’utilisateur doit fermer sa session puis la rouvrir.'); U.av('gpupdate-logoff-notice', 'gpupdate : avis de fermeture de session pour les paramètres utilisateur nécessitant une ouverture de session — libellé non vérifié.'); }
  s.env.obs('ipconfig:' + d.id + ':gpupdate', !!res.ok);
};
C.gpresult = (s, a, o, r) => {
  const d = s.d, W = s.W; const fl = a.map(lc);
  if (!d.win.domain) { o.blank(); o.l('INFORMATION : cet ordinateur n’est pas joint à un domaine.'); return; }
  const user = W_.sessionUser(d); const sc = fl.indexOf('/scope') >= 0 ? fl[fl.indexOf('/scope') + 1] : null;
  if (!fl.includes('/r') && !fl.includes('/v') && !fl.includes('/h')) { o.l('Utilisation : GPRESULT [/S système [/U nom_utilisateur [/P [mot_de_passe]]]] [/SCOPE portée] [/USER nom_utilisateur_cible] [/R | /V | /Z | /X nom_fichier | /H nom_fichier] [/F] [/?]'); return; }
  const gp = d._rt.gp || {}; const A = AD.byDomain(W, d.win.domain); const info = AD.rsop(W, d.id, user);
  const dt = W.nowOf(d.id);
  o.blank(); o.l('Outil Résultat de stratégie du système d’exploitation Microsoft (R) Windows (R) v2.0'); o.l('© 2018 Microsoft Corporation. Tous droits réservés.'); o.blank(); o.l('Créé le ' + E.frDate(dt) + ' à ' + E.frTime(dt)); o.blank(); o.blank();
  o.l('Données RSOP pour ' + W_.whoami(W, d, user).replace(/^[^\\]+/, W_.netbios(W, d)) + ' sur ' + d.name.toUpperCase() + ' : Mode de journalisation'); o.l('-------------------------------------------------------------------'); o.blank();
  o.l('Informations sur le système d’exploitation :   Microsoft Windows ' + (d.os || '').replace(/^Windows /, '')); o.l('Version du système d’exploitation :   ' + W_.build(d).replace(/^10\.0\./, '') + ' ' + (d.build || '')); o.l('Nom de l’hôte :                      ' + d.name.toUpperCase()); o.l('Nom du domaine :                    ' + W_.netbios(W, d)); o.l('Type de domaine :                    Windows 2008 ou version ultérieure'); o.l('Site :                              Default-First-Site-Name'); o.l('Profil itinérant :                  Non'); o.l('Profil local :                      C:\\Users\\' + user); o.l('Connecté via une liaison lente :    Non'); o.blank();
  const sect = (kind) => {
    const comp = kind === 'computer'; const gpu = comp ? gp.computer : gp.user; const cobj = A && AD.compOf(A.win.ad, d.name); const uobj = A && AD.userOf(A.win.ad, user);
    o.l('    ' + (comp ? 'CN=' + d.name.toUpperCase() + ',' + ((cobj || {}).ou || '') : 'CN=' + ((uobj || {}).name || user) + ',' + ((uobj || {}).ou || '')));
    o.l('    Dernière application de la stratégie de groupe : ' + (gpu ? E.frDateTime(new Date(W.clock.base + gpu.at * 1000)) : 'Jamais')); o.l('    La stratégie de groupe a été appliquée à partir de : ' + (d._rt.session && d._rt.session.dc ? d._rt.session.dc : (A ? A.name : ''))); o.l('    Seuil de liaison lente de la stratégie de groupe : 500 kbits/s'); o.l('    Nom de domaine : ' + W_.netbios(W, d)); o.l('    Type de domaine : Windows 2008 ou version ultérieure'); o.blank();
    const list = (info && info[kind] && info[kind].gpos) || []; const applied = list.filter(x => x.applied), skipped = list.filter(x => !x.applied);
    o.l('    Objets de stratégie de groupe appliqués'); o.l('    -----------------------------------'); if (!applied.length) o.l('        N/A'); applied.forEach(x => o.l('        ' + x.name)); o.blank();
    o.l('    Les objets de stratégie de groupe suivants n’ont pas été appliqués, car ils ont été filtrés'); o.l('    ----------------------------------------------------------------------------------------'); if (!skipped.length) o.l('        N/A');
    skipped.forEach(x => { o.l('        ' + x.name); o.l('            Filtrage :  ' + (/sécurité|lecture/.test(x.reason) ? 'Refusé (Sécurité)' : /désactiv/.test(x.reason) ? 'Désactivé (' + (/lien/.test(x.reason) ? 'Lien' : /configuration/.test(x.reason) ? 'Configuration' : 'GPO') + ')' : x.reason)); o.blank(); });
    o.blank();
    const tok = comp ? AD.token(W, d.win.domain, d.name + '$', { computer: true }) : AD.token(W, d.win.domain, user);
    o.l('    ' + (comp ? 'L’ordinateur' : 'L’utilisateur') + ' fait partie des groupes de sécurité suivants :'); o.blank();
    W_.tokenNames(W, d, tok).forEach(x => o.l('        ' + x)); o.blank();
  };
  if (sc !== 'user') { o.l('PARAMÈTRES DE L’ORDINATEUR'); o.l('--------------------------'); sect('computer'); }
  if (sc !== 'computer') { o.l('PARAMÈTRES DE L’UTILISATEUR'); o.l('---------------------------'); sect('user'); }
  s.env.obs('ipconfig:' + d.id + ':gpresult', true);
};

/* ------------------------------------------------------------------ nltest / w32tm */
C.nltest = (s, a, o, r) => {
  const d = s.d, W = s.W; const t = a.join(' ');
  let m;
  if ((m = t.match(/\/dsgetdc:(\S+)/i)) || /\/dsgetdc/i.test(t)) {
    const dom = m ? m[1] : d.win.domain;
    const dc = dom && AD.locateDC(W, d.id, dom);
    if (!dc || !dc.ok) { o.l('Échec de l’obtention du nom de DC : État = 1355 0x54b ERROR_NO_SUCH_DOMAIN', 'e'); o.l('La commande a échoué : État = 1355 0x54b ERROR_NO_SUCH_DOMAIN', 'e'); r.ok = false; return; }
    const A = dc.dev.win.ad; o.l('           DC: \\\\' + W_.fqdn(dc.dev)); o.l('      Adresse: \\\\' + dc.ip); o.l('GUID du domaine: ' + [U.hash8(A.domain), U.hash8(A.domain + 'a').slice(0, 4), U.hash8(A.domain + 'b').slice(0, 4), U.hash8(A.domain + 'c').slice(0, 4), U.hash8(A.domain + 'd') + U.hash8(A.domain + 'e').slice(0, 4)].join('-')); o.l('Nom du domaine: ' + A.domain); o.l('  Nom de la forêt: ' + A.domain); o.l('Nom du site du contrôleur de domaine: Default-First-Site-Name'); o.l('Nom du site de l’ordinateur: Default-First-Site-Name');
    o.l('Indicateurs: PDC GC DS LDAP KDC TIMESERV GTIMESERV WRITABLE DNS_DC DNS_DOMAIN DNS_FOREST CLOSE_SITE FULL_SECRET WS DS_8 DS_9 DS_10'); o.l('La commande s’est terminée correctement'); s.env.advance(1); return;
  }
  if ((m = t.match(/\/(sc_query|sc_verify):(\S+)/i))) {
    const dom = m[2]; const w = d.win;
    if (!w.domain || lc(dom) !== lc(w.domain)) { o.l('Flags: 0', 'e'); o.l('Trusted DC Name', 'e'); o.l('Trusted DC Connection Status Status = 1355 0x54b ERROR_NO_SUCH_DOMAIN', 'e'); o.l('La commande a échoué : État = 1355 0x54b ERROR_NO_SUCH_DOMAIN', 'e'); r.ok = false; return; }
    const dc = AD.locateDC(W, d.id, dom); const A = dc.ok ? dc.dev.win.ad : null; const comp = A && AD.compOf(A, d.name);
    if (!dc.ok) { o.l('Flags: 0'); o.l('Trusted DC Name '); o.l('Trusted DC Connection Status Status = 1311 0x51f ERROR_NO_LOGON_SERVERS', 'e'); o.l('La commande a échoué : État = 1311 0x51f ERROR_NO_LOGON_SERVERS', 'e'); r.ok = false; return; }
    if (!comp || comp.enabled === false || w.secureChannel === false) { o.l('Flags: 0'); o.l('Trusted DC Name \\\\' + W_.fqdn(dc.dev)); o.l('Trusted DC Connection Status Status = 1786 0x6fa ERROR_NO_TRUST_LSA_SECRET', 'e'); o.l('La commande a échoué : État = 1786 0x6fa ERROR_NO_TRUST_LSA_SECRET', 'e'); r.ok = false; return; }
    o.l('Flags: 30 HAS_IP  HAS_TIMESERV'); o.l('Trusted DC Name \\\\' + W_.fqdn(dc.dev)); o.l('Trusted DC Connection Status Status = 0 0x0 NERR_Success'); o.l('Trust Verification Status = 0 0x0 NERR_Success'); o.l('La commande s’est terminée correctement'); return;
  }
  if (/\/dsregdns/i.test(t)) { if (!s.elevated) { o.l('Accès refusé.', 'e'); r.ok = false; return; } if (!d.win.ad) { o.l('Cette commande n’est disponible que sur un contrôleur de domaine.', 'e'); r.ok = false; return; } AD.registerDcRecords(W, d.id); s.env.touch('regdns'); r.mutated = true; o.l('Les enregistrements DNS du contrôleur de domaine ont été inscrits.'); o.l('La commande s’est terminée correctement'); U.av('nltest-dsregdns', 'nltest /dsregdns : libellé de confirmation non vérifié.'); return; }
  if (/\/dclist:(\S+)/i.test(t)) { m = t.match(/\/dclist:(\S+)/i); const dev = AD.byDomain(W, m[1]); if (!dev) { o.l('Impossible d’obtenir la liste des contrôleurs de domaine : État = 1355 0x54b ERROR_NO_SUCH_DOMAIN', 'e'); r.ok = false; return; } o.l('Obtient la liste des contrôleurs de domaine dans le domaine \'' + m[1] + '\':'); o.l('    ' + W_.fqdn(dev) + ' [PDC]  [DS] Site: Default-First-Site-Name'); o.l('La commande s’est terminée correctement'); return; }
  o.l('Utilisation : nltest [/OPTIONS]', 'e'); r.ok = false;
};
/* Resynchronisation de l'horloge (w32tm /resync, bouton « Synchroniser maintenant ») : applique la source de temps du poste */
W_.timeResync = function (W, d) {
  if (d.win.ad) { const net = N.ping(W, d.id, '8.8.8.8'); if (!net.ok) return { ok: false }; d.clockSkewMin = 0; return { ok: true }; }
  if (d.win.domain) { const dc = AD.locateDC(W, d.id, d.win.domain); if (!dc.ok) return { ok: false }; d.clockSkewMin = dc.dev.clockSkewMin || 0; return { ok: true }; }
  d.clockSkewMin = 0; return { ok: true };
};
C.w32tm = (s, a, o, r) => {
  const d = s.d, W = s.W; const t = a.join(' ').toLowerCase();
  const src = () => { if (d.win.ad) return 'Local CMOS Clock'; if (!d.win.domain) return 'time.windows.com,0x9'; const dc = AD.locateDC(W, d.id, d.win.domain); return dc.ok ? W_.fqdn(dc.dev) : 'Local CMOS Clock'; };
  if (/\/query/.test(t) && /\/status/.test(t)) {
    if (!WIN.svcRunning(d, 'W32Time')) { o.l('Le service de temps Windows n’est pas démarré.', 'e'); o.l('Erreur : 0x80070426 (Le service n’a pas été démarré.)', 'e'); r.ok = false; return; }
    const sy = d.win.ad ? 'Local CMOS Clock' : src(); const last = new Date(W.clock.base - 600000);
    o.l('Indicateur de saut : 0(aucun avertissement)'); o.l('Strate : ' + (d.win.ad ? 1 : 3) + ' (' + (d.win.ad ? 'référence primaire - synchronisée par radio' : 'référence secondaire - synchronisée par (S)NTP') + ')'); o.l('Précision : -23 (119.209ns par graduation)'); o.l('Délai de la racine : 0.0156250s'); o.l('Dispersion de la racine : 7.8250000s');
    o.l('ID de référence : 0x4C4F434C (adresse IP source :  LOCL)'); o.l('Heure de la dernière synchronisation réussie : ' + E.frDateTime(last)); o.l('Source : ' + sy); o.l('Intervalle d’interrogation : 10 (1024s)'); return;
  }
  if (/\/query/.test(t) && /\/source/.test(t)) { o.l(src()); return; }
  if (/\/resync/.test(t)) {
    if (!s.elevated) { o.l('Accès refusé. (0x80070005)', 'e'); r.ok = false; return; }
    if (!WIN.svcRunning(d, 'W32Time')) { o.l('Le service de temps Windows n’est pas démarré.', 'e'); r.ok = false; return; }
    o.l('Envoi de la commande de resynchronisation à l’ordinateur local');
    const rs = W_.timeResync(W, d); if (!rs.ok) { o.l('La commande a échoué : aucune source de temps n’était disponible.', 'e'); r.ok = false; return; }
    s.env.touch('time'); r.mutated = true; o.l('La commande s’est terminée correctement.'); return;
  }
  if (/\/stripchart/.test(t)) {
    const m = t.match(/\/computer:(\S+)/); if (!m) { o.l('Paramètre /computer manquant.', 'e'); return; }
    const rs = U.isIP(m[1]) ? { ok: true, ip: m[1] } : N.resolve(W, d.id, m[1]); if (!rs.ok) { o.l('Le nom d’hôte est introuvable : ' + m[1], 'e'); r.ok = false; return; }
    const c = N.connect(W, d.id, rs.ip, 'udp', 123); o.l('Suivi de ' + m[1] + ' [' + rs.ip + '].'); o.l('Heure actuelle : ' + E.frDateTime(W.nowOf(d.id)).replace(' ', ' '));
    const tgt = c.state === 'open' ? W.d(c.dstDev) : null; const n = +(t.match(/\/samples:(\d+)/) || [0, 3])[1];
    for (let i = 0; i < n; i++) { o.l(E.frTime(W.nowOf(d.id)) + ' ' + (tgt ? 'd:+00.0003 o:' + (((tgt.clockSkewMin || 0) - (d.clockSkewMin || 0)) * 60 >= 0 ? '+' : '') + (((tgt.clockSkewMin || 0) - (d.clockSkewMin || 0)) * 60).toFixed(7) + 's' : 'erreur: 0x80072746'), 'o', 1000); }
    return;
  }
  o.l('Utilisation : w32tm [/?] [/query] [/resync] [/stripchart] …', 'e'); r.ok = false;
};

/* ------------------------------------------------------------------ netsh */
function ifaceByName(d, nm) { return W_.ifaceNames(d).find(n => lc(n) === lc(nm)); }
C.netsh = (s, a, o, r) => {
  const d = s.d, W = s.W; const t = a.join(' '); const lt = t.toLowerCase();
  const getName = () => { const m = t.match(/name=("[^"]+"|\S+)/i); return m ? m[1].replace(/"/g, '') : null; };
  if (/^(interface|int)\s+(ip|ipv4)\s+show\s+(config|address|addresses)/.test(lt)) {
    W_.ifaceNames(d).forEach(n => {
      const c = N.effCfg(d, n); o.blank(); o.l('Configuration de l’interface "' + n + '"'); o.l('    DHCP activé :                         ' + (d.ifaces[n].dhcp ? 'Oui' : 'Non'));
      o.l('    Adresse IP :                          ' + (c && c.ip !== '0.0.0.0' ? c.ip : '')); o.l('    Préfixe de sous-réseau :              ' + (c && c.mask ? U.netAddr(c.ip, c.mask) + '/' + U.mask2len(c.mask) + ' (masque ' + c.mask + ')' : ''));
      o.l('    Passerelle par défaut :               ' + ((c && c.gw) || '')); o.l('    Métrique de passerelle :              ' + (c && c.gw ? 0 : '')); o.l('    Métrique d’interface :                25');
      o.l('    Serveurs DNS configurés statiquement : ' + (d.ifaces[n].dhcp ? 'Aucun' : ((c && c.dns[0]) || 'Aucun'))); (d.ifaces[n].dhcp ? [] : (c ? c.dns.slice(1) : [])).forEach(x => o.l(' '.repeat(43) + x)); o.l('    Inscrire avec le suffixe :            Principal uniquement');
    });
    o.blank(); return;
  }
  if (/^(interface|int)\s+(ip|ipv4)\s+show\s+dns/.test(lt)) { W_.ifaceNames(d).forEach(n => { const c = N.effCfg(d, n); o.blank(); o.l('Configuration de l’interface "' + n + '"'); o.l('    Serveurs DNS configurés statiquement : ' + (d.ifaces[n].dhcp ? 'Aucun' : ((c && c.dns[0]) || 'Aucun'))); o.l('    Inscrire avec le suffixe :            Principal uniquement'); }); o.blank(); return; }
  if (/^(interface|int)\s+set\s+interface\b/.test(lt)) {
    if (!s.elevated) { o.l('L’opération demandée nécessite une élévation (exécuter en tant qu’administrateur).', 'e'); r.ok = false; return; }
    const nm = ifaceByName(d, getName() || ''); if (!nm) { o.l('Le nom de l’interface est introuvable.', 'e'); r.ok = false; return; }
    const adm = (t.match(/admin=(\w+)/i) || [])[1]; if (!adm || !/^(enabled|disabled)$/i.test(adm)) { o.l('Le paramètre est incorrect.', 'e'); r.ok = false; return; }
    const ic = d.ifaces[nm]; ic.adminDown = lc(adm) === 'disabled'; if (!ic.adminDown && ic.dhcp) N.dhcpRenew(W, d.id, nm);
    s.env.advance(2); s.env.touch('nic'); r.mutated = true; if (ic.adminDown) r.impact = 'nic-down'; return;
  }
  if (/^(interface|int)\s+(ip|ipv4)\s+set\s+address/.test(lt)) {
    if (!s.elevated) { o.l('L’opération demandée nécessite une élévation (exécuter en tant qu’administrateur).', 'e'); r.ok = false; return; }
    const nm = ifaceByName(d, getName() || ''); if (!nm) { o.l('Le nom de l’interface est introuvable.', 'e'); r.ok = false; return; }
    const toks = E.splitWin(t.replace(/name=("[^"]+"|\S+)/i, ''), false).slice(3).filter(x => !/^source=/i.test(x) || true);
    const src = (t.match(/source=(\w+)/i) || [])[1];
    if (/dhcp/.test(lt) && (src ? lc(src) === 'dhcp' : toks.some(x => lc(x) === 'dhcp'))) { d.ifaces[nm].dhcp = true; d.ifaces[nm].dnsManual = d.ifaces[nm].dnsManual || []; N.dhcpRenew(W, d.id, nm); s.env.touch('ipv4'); r.mutated = true; return; }
    const vals = t.replace(/name=("[^"]+"|\S+)/i, '').match(/\b\d+\.\d+\.\d+\.\d+\b/g) || []; const ip = vals[0], mask = vals[1] || '255.255.255.0', gw = vals[2] || '';
    if (!ip || !U.isIP(ip) || !U.validMask(mask)) { o.l('Le paramètre est incorrect.', 'e'); r.ok = false; return; }
    const ic = d.ifaces[nm]; ic.dhcp = false; ic.ip = ip; ic.mask = mask; ic.gw = gw; s.env.touch('ipv4'); r.mutated = true; return;
  }
  if (/^(interface|int)\s+(ip|ipv4)\s+(set|add)\s+dns/.test(lt)) {
    if (!s.elevated) { o.l('L’opération demandée nécessite une élévation (exécuter en tant qu’administrateur).', 'e'); r.ok = false; return; }
    const nm = ifaceByName(d, getName() || ''); if (!nm) { o.l('Le nom de l’interface est introuvable.', 'e'); r.ok = false; return; }
    const ic = d.ifaces[nm]; const ips = t.replace(/name=("[^"]+"|\S+)/i, '').match(/\b\d+\.\d+\.\d+\.\d+\b/g) || [];
    if (/source=dhcp|\bdhcp\b/.test(lt)) { ic.dnsManual = []; if (!ic.dhcp) ic.dns = []; } else if (/\badd\s+dns/.test(lt)) { if (ic.dhcp) ic.dnsManual = (ic.dnsManual || []).concat(ips); else ic.dns = (ic.dns || []).concat(ips); } else { if (ic.dhcp) ic.dnsManual = ips; else ic.dns = ips; }
    s.env.touch('ipv4'); r.mutated = true; return;
  }
  if (/^advfirewall\s+show\s+(allprofiles|domainprofile|privateprofile|publicprofile|currentprofile)/.test(lt)) {
    const which = /allprofiles/.test(lt) ? ['domain', 'private', 'public'] : /domain/.test(lt) ? ['domain'] : /private/.test(lt) ? ['private'] : /public/.test(lt) ? ['public'] : [(N.effCfg(d, W_.ifaceNames(d)[0]) && d.ifaces[W_.ifaceNames(d)[0]].fwProfile) || 'domain'];
    const lab = { domain: 'Profil de domaine', private: 'Profil privé', public: 'Profil public' };
    which.forEach(p => { const pr = d.win.fw.profiles[p]; o.blank(); o.l(lab[p] + ' Paramètres :'); o.l('----------------------------------------------------------------------'); o.l(E.padR('État', 40) + (pr.enabled ? 'ACTIVER' : 'DÉSACTIVER')); o.l(E.padR('Stratégie de pare-feu', 40) + (pr.defIn === 'block' ? 'BlockInbound' : 'AllowInbound') + ',' + (pr.defOut === 'allow' ? 'AllowOutbound' : 'BlockOutbound')); });
    o.blank(); o.l('OK.'); return;
  }
  if (/^advfirewall\s+set\s+(allprofiles|domainprofile|privateprofile|publicprofile|currentprofile)\s+state/.test(lt)) {
    if (!s.elevated) { o.l('L’opération demandée nécessite une élévation (exécuter en tant qu’administrateur).', 'e'); r.ok = false; return; }
    const on = /state\s+on/.test(lt); const which = /allprofiles|currentprofile/.test(lt) ? ['domain', 'private', 'public'] : /domain/.test(lt) ? ['domain'] : /private/.test(lt) ? ['private'] : ['public'];
    which.forEach(p => { d.win.fw.profiles[p].enabled = on; }); s.env.touch('fw'); r.mutated = true; o.l('OK.'); return;
  }
  if (/^advfirewall\s+firewall\s+show\s+rule/.test(lt)) {
    const nm = (t.match(/name=("[^"]+"|\S+)/i) || [])[1]; const nmv = nm ? nm.replace(/"/g, '') : 'all';
    const rules = d.win.fw.rules.filter(x => lc(nmv) === 'all' || lc(x.name).indexOf(lc(nmv)) >= 0);
    if (!rules.length) { o.l('Aucune règle ne correspond aux critères spécifiés.'); return; }
    rules.forEach(x => { o.blank(); o.l(E.padR('Nom de la règle :', 35) + x.name); o.l('----------------------------------------------------------------------'); o.l(E.padR('Activé :', 35) + (x.enabled ? 'Oui' : 'Non')); o.l(E.padR('Direction :', 35) + (x.dir === 'in' ? 'Entrée' : 'Sortie')); o.l(E.padR('Profils :', 35) + x.profiles.map(p => ({ domain: 'Domaine', private: 'Privé', public: 'Public' })[p]).join(',')); o.l(E.padR('Protocole :', 35) + x.proto); if (x.lport) o.l(E.padR('PortLocal :', 35) + x.lport); o.l(E.padR('Action :', 35) + (x.action === 'allow' ? 'Autoriser' : 'Bloquer')); });
    o.blank(); o.l('OK.'); return;
  }
  if (/^advfirewall\s+firewall\s+(add|set|delete)\s+rule/.test(lt)) {
    if (!s.elevated) { o.l('L’opération demandée nécessite une élévation (exécuter en tant qu’administrateur).', 'e'); r.ok = false; return; }
    const nm = ((t.match(/name=("[^"]+"|\S+)/i) || [])[1] || '').replace(/"/g, ''); const rules = d.win.fw.rules;
    if (/\sadd\s+rule/.test(lt)) {
      const g1 = k => ((t.match(new RegExp(k + '=("[^"]+"|\\S+)', 'i')) || [])[1] || '').replace(/"/g, '');
      rules.push({ id: 'u-' + rules.length, name: nm, enabled: true, dir: lc(g1('dir')) === 'out' ? 'out' : 'in', action: lc(g1('action')) === 'block' ? 'block' : 'allow', profiles: ['domain', 'private', 'public'], proto: (g1('protocol') || 'Any').toUpperCase(), lport: g1('localport') });
      s.env.touch('fw'); r.mutated = true; o.l('OK.'); return;
    }
    const hit = rules.filter(x => lc(x.name) === lc(nm)); if (!hit.length) { o.l('Aucune règle ne correspond aux critères spécifiés.', 'e'); r.ok = false; return; }
    if (/\sdelete\s+rule/.test(lt)) { d.win.fw.rules = rules.filter(x => lc(x.name) !== lc(nm)); o.l(hit.length + ' règle(s) supprimée(s).'); o.l('OK.'); }
    else { const en = (t.match(/enable=(\w+)/i) || [])[1]; if (en) hit.forEach(x => { x.enabled = /^(yes|oui)$/i.test(en); }); o.l(hit.length + ' règle(s) mise(s) à jour.'); o.l('OK.'); }
    s.env.touch('fw'); r.mutated = true; return;
  }
  if (/^winsock\s+reset/.test(lt)) { o.blank(); o.l('Réinitialisation réussie du catalogue Winsock.'); o.l('Vous devez redémarrer l’ordinateur pour terminer cette opération.'); return; }
  if (/^(int|interface)\s+ip\s+reset/.test(lt)) { o.l('Réinitialisation de Interface, OK!'); o.l('Redémarrez l’ordinateur pour terminer cette action.'); return; }
  if (/^winhttp\s+show\s+proxy/.test(lt)) { o.blank(); o.l('Paramètres de proxy WinHTTP en cours :'); o.blank(); o.l('    Accès direct (pas de serveur proxy).'); return; }
  o.l('La commande suivante est introuvable : ' + t + '.', 'e'); r.ok = false;
};

/* ------------------------------------------------------------------ icacls (NTFS) */
const ACE_CODE = { FullControl: '(F)', Modify: '(M)', ReadAndExecute: '(RX)', Read: '(R)', Write: '(W)' };
const ACE_FROM = { F: 'FullControl', M: 'Modify', RX: 'ReadAndExecute', R: 'Read', W: 'Write' };
C.icacls = (s, a, o, r) => {
  const d = s.d, W = s.W; if (!d.win.ntfs) { o.l('Le chemin d’accès spécifié est introuvable.', 'e'); r.ok = false; return; }
  const path = W_.normPath(s.cwd, a[0] || '.'); const nt = d.win.ntfs; const key = AD.ntfsFolder(d, path);
  if (!key || lc(key) !== lc(path)) { if (!key) { o.l(path + ': Le chemin d’accès spécifié est introuvable.', 'e'); o.blank(); o.l('1 fichiers n’ont pas pu être traités ; échec du traitement de 1 fichiers'); r.ok = false; return; } }
  const fd = nt[key]; const rest = a.slice(1);
  if (!rest.length) {
    const tok = W_.token(W, d); if (s.elevated) tok.add('builtin\\administrateurs');
    const lines = []; if (fd.inherit) { /* ACE héritées marquées (I) */ }
    const own = (fd.acl || []).map(x => ({ who: x.who, rights: x.rights, type: x.type, applies: x.applies, inh: false }));
    let parent = null; if (fd.inherit) { const pk = Object.keys(nt).filter(k => lc(path).indexOf(lc(k) + '\\') === 0).sort((x, y) => y.length - x.length)[0]; parent = pk ? nt[pk] : null; }
    const inh = parent ? (parent.acl || []).filter(x => (x.applies || 'this+sub').indexOf('sub') >= 0).map(x => ({ who: x.who, rights: x.rights, type: x.type, applies: x.applies, inh: true })) : [];
    own.concat(inh).forEach(x => { const flags = (x.inh ? '(I)' : '') + ((x.applies || 'this+sub').indexOf('sub') >= 0 ? '(OI)(CI)' : '') + (x.type === 'deny' ? '(DENY)' : '') + (ACE_CODE[x.rights] || '(' + x.rights + ')'); lines.push(x.who + ':' + flags); });
    lines.forEach((ln, i) => o.l(i === 0 ? path + ' ' + ln : ' '.repeat(path.length + 1) + ln)); o.blank(); o.l('1 fichiers ont été correctement traités ; échec du traitement de 0 fichiers'); return;
  }
  if (!s.elevated) { o.l(path + ': Accès refusé.', 'e'); o.blank(); o.l('1 fichiers n’ont pas pu être traités ; échec du traitement de 1 fichiers'); r.ok = false; return; }
  for (let i = 0; i < rest.length; i++) {
    const f = lc(rest[i]);
    if (f === '/grant' || f === '/deny' || f === '/grant:r') { const m = rest[++i].match(/^(.+):(.+)$/); if (!m) { o.l('Paramètre non valide.', 'e'); r.ok = false; return; } const rt = m[2].replace(/\((OI|CI|IO)\)/g, ''); const code = rt.replace(/[()]/g, ''); const rights = ACE_FROM[code.toUpperCase()]; if (!rights) { o.l('Droit non pris en charge dans cette simulation : ' + rt, 'e'); r.ok = false; return; } fd.acl = (fd.acl || []).filter(x => !(lc(x.who) === lc(m[1]) && f === '/grant:r')); fd.acl.push({ who: m[1], type: f === '/deny' ? 'deny' : 'allow', rights, applies: /\(OI\)|\(CI\)/.test(m[2]) ? 'this+sub' : 'this-only' }); }
    else if (f === '/remove' || f === '/remove:g' || f === '/remove:d') { const who = rest[++i]; fd.acl = (fd.acl || []).filter(x => lc(x.who) !== lc(who)); }
    else if (f === '/inheritance:e') fd.inherit = true; else if (f === '/inheritance:d') fd.inherit = false; else if (f === '/inheritance:r') fd.inherit = false;
    else if (f === '/t' || f === '/c' || f === '/q') { /* options ignorées */ }
  }
  s.env.touch('ntfs'); r.mutated = true; o.l('1 fichiers ont été correctement traités ; échec du traitement de 0 fichiers');
};
C.klist = (s, a, o, r) => { const d = s.d; const sess = d._rt.session; o.blank(); o.l('Id de connexion actuel : 0:0x' + U.hash8(d.id).slice(0, 5)); o.blank(); o.l('Tickets mis en cache : (' + (sess && d.win.domain ? 2 : 0) + ')'); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
