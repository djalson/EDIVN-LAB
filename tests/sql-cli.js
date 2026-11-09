/* Console SQL MariaDB : RENAME / DROP / CREATE / ALTER USER, GRANT ciblé, erreurs 1396 / 1064, requêtes non gérées signalées (jamais de fausse erreur de syntaxe).
   Réparation de la panne lx_db_access (variante « compte SQL limité à 10.10.20.% ») uniquement par la console, comme un vrai administrateur. */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const LX = SIM.lx || SIM.LX;
let n = 0, bad = 0; const ok = (c, msg) => { n++; if (!c) { bad++; console.log('  ✗ ' + msg); } };
let m;
for (let s = 1; s < 80; s++) { m = SIM.game.create({ level: 3, mode: 'free', seed: String(s), faultId: 'lx_db_access' }); if (m.W.d('SRV-LNX').db.users[0].host === '10.10.20.%') break; }
const d = m.W.d('SRV-LNX'); const env = T.mk(m.W);
const sh = SIM.emu.openLxShell(env, 'SRV-LNX', { user: 'root', tty: 'tty1' });
const sql = T.run(sh, 'mysql', { show: false }).push;
const q = c => sql.exec(c).out.map(x => x.t).join('\n');
const login = () => SIM.lx.dbLogin(d, '10.10.10.20', 'intranet', 'intranet');
ok(d.db.users[0].host === '10.10.20.%' && !login().ok, 'départ : compte limité à 10.10.20.%, connexion de 10.10.10.20 refusée');
ok(/ERROR 1396 \(HY000\): Operation RENAME USER failed for 'x'@'y'/.test(q("RENAME USER 'x'@'y' TO 'x'@'z';")), 'RENAME USER d’un compte inexistant : ERROR 1396');
ok(!login().ok, 'l’échec n’a rien modifié');
ok(/Query OK, 0 rows affected/.test(q("RENAME USER 'intranet'@'10.10.20.%' TO 'intranet'@'10.10.10.%';")) && d.db.users[0].host === '10.10.10.%', 'RENAME USER corrige l’hôte');
ok(login().ok, 'après RENAME USER, la connexion de l’application (10.10.10.20) est acceptée');
ok(/ERROR 1396/.test(q("RENAME USER 'intranet'@'10.10.20.%' TO 'intranet'@'10.10.10.%';")), 'rejouer le RENAME : ERROR 1396');
ok(/Query OK/.test(q("CREATE USER 'bob'@'10.10.10.%' IDENTIFIED BY 'x';")) && /ERROR 1396.*CREATE USER/.test(q("CREATE USER 'bob'@'10.10.10.%';")), 'CREATE USER, puis doublon refusé');
ok(/Query OK/.test(q("GRANT SELECT, INSERT ON intranet.* TO 'bob'@'10.10.10.%';")) && /GRANT SELECT, INSERT ON `intranet`/.test(q("SHOW GRANTS FOR 'bob'@'10.10.10.%';")), 'GRANT ciblé visible dans SHOW GRANTS');
ok(d.db.users.filter(u => u.user === 'bob').length === 1, 'un seul compte bob (pas de doublon par GRANT)');
ok(/Query OK/.test(q("DROP USER 'bob'@'10.10.10.%';")) && /ERROR 1396.*DROP USER/.test(q("DROP USER 'bob'@'10.10.10.%';")) && /Query OK/.test(q("DROP USER IF EXISTS 'bob'@'10.10.10.%';")), 'DROP USER, inexistant refusé, IF EXISTS toléré');
ok(/ERROR 1064/.test(q('foo bar;')), 'du texte quelconque reste une erreur de syntaxe');
ok(/Requête non gérée par le simulateur/.test(q("UPDATE mysql.user SET Host='x';")) && !/ERROR 1064/.test(q("UPDATE mysql.user SET Host='x';")), 'une requête valide mais non gérée est signalée comme telle (pas de fausse erreur de syntaxe)');
ok(d.db.users.length === 2, 'état final : deux comptes seulement');
console.log(n + ' assertions, ' + bad + ' échec(s)'); process.exit(bad ? 1 : 0);
