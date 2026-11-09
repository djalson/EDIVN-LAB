/* Appartenance aux groupes (usermod -aG, gpasswd, adduser) et ACL POSIX (recalcul du masque par setfacl). Réparations de lx_perm (groupe) et lx_acl (masque) au terminal. */
'use strict';
const SIM = require('./load.js')(); const T = require('./term.js')(SIM); const F = SIM.fault;
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ ' + m); } };
const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W); const sh = SIM.emu.openLxShell(env, 'SRV-LNX', { user: 'root', tty: 'tty1' });
const q = c => sh.exec(c).out.map(x => x.t).join('\n'); const grp = () => q('grep ^techs: /etc/group');
q('gpasswd -d tech techs'); ok(!/tech,|,tech|:tech$/.test(grp()) && /tssr/.test(grp()), 'gpasswd -d retire le membre');
ok(/Adding user tech to group techs/.test(q('gpasswd -a tech techs')) && /tech/.test(grp()), 'gpasswd -a ajoute le membre');
q('gpasswd -d tech techs'); ok(q('usermod -aG techs tech') === '' && /1100\(techs\)/.test(q('id tech')), 'usermod -aG : silencieux, visible dans id');
ok(q('usermod -aG techs tech') === '' && grp().split(':')[3].split(',').filter(x => x === 'tech').length === 1, 'usermod -aG répété : pas de doublon');
ok(/does not exist/.test(q('usermod -aG techs fantome')) && /does not exist/.test(q('usermod -aG nogrp tech')), 'utilisateur ou groupe inconnu : erreur réelle');
ok(/non gérée/.test(q('usermod -s /bin/sh tech')) && /non gérée/.test(q('usermod -G techs tech')), 'options non gérées : signalées, jamais ignorées en silence');
ok(/Done\./.test(q('adduser tech techs')), 'adduser <user> <groupe>');
const std = SIM.emu.openLxShell(env, 'SRV-LNX', { user: 'tssr', tty: 'tty2' }); ok(/Permission denied/.test(std.exec('usermod -aG techs tech').out.map(x => x.t).join('')), 'sans sudo : Permission denied');
/* ACL : sans masque explicite le masque est recalculé ; avec m:: il est imposé ; -n l'empêche */
const f = SIM.buildHealthyWorld({ seed: 1 }); const e2 = T.mk(f); const s2 = SIM.emu.openLxShell(e2, 'SRV-LNX', { user: 'root', tty: 'tty1' });
s2.exec('mkdir /srv/t'); s2.exec('chmod 750 /srv/t'); s2.exec('setfacl -m u:tech:rwx /srv/t'); ok(/mask::rwx/.test(s2.exec('getfacl /srv/t').out.map(x => x.t).join('\n')), 'setfacl -m u:tech:rwx : masque recalculé à rwx');
s2.exec('setfacl -m m::r-x /srv/t'); ok(/mask::r-x/.test(s2.exec('getfacl /srv/t').out.map(x => x.t).join('\n')), 'setfacl -m m::r-x : masque imposé');
s2.exec('setfacl -n -m u:tech:rw- /srv/t'); ok(/mask::r-x/.test(s2.exec('getfacl /srv/t').out.map(x => x.t).join('\n')), 'setfacl -n : le masque n’est pas recalculé');
s2.exec('setfacl -m u:tech:rw- /srv/t'); ok(/mask::rwx/.test(s2.exec('getfacl /srv/t').out.map(x => x.t).join('\n')), 'sans -n : recalculé (r-x du groupe propriétaire ∪ rw-)');
console.log(n + ' assertions, ' + bad + ' échec(s)'); process.exit(bad ? 1 : 0);
