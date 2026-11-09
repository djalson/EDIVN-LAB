/* Confirmations interactives PowerShell : Remove-SmbShare / Revoke-SmbShareAccess (sans -Force) et Disable-NetAdapter
   (sans -Confirm:$false) posent une invite ; la réponse décide de l'exécution ; le débrief reçoit une action « mutante ». */
const SIM = require('./load.js')(); const T = require('./term.js')(SIM);
let ok = 0, ko = 0; const chk = (c, m) => { if (c) { ok++; console.log('✓ ' + m); } else { ko++; console.log('✗ ' + m); } };
const text = r => r.out.map(x => x.t).join('\n');
function fresh(dev) {
  const W = SIM.buildHealthyWorld({ seed: 1 }); const env = T.mk(W);
  const sh = SIM.emu.openWinShell(env, dev || 'SRV-FIC', { elevated: true, user: 'Administrateur' }).exec('powershell').push;
  return { W, env, sh };
}
const run = (sh, l) => T.run(sh, l, { show: false });
const shares = W => (W.d('SRV-FIC').win.shares || []).map(s => s.name);
const mut = () => T.acts.filter(a => a.mutates && /confirmé/.test(a.text));

/* 1. Remove-SmbShare sans -Force : invite, N annule, O supprime */
let R = fresh();
let r = run(R.sh, 'Remove-SmbShare -Name Direction');
chk(r.ask && /\[O\] Oui/.test(r.ask.prompt) && /Confirmer/.test(text(r)) && /Remove-SmbShare/.test(text(r)) && /Direction/.test(text(r)), 'Remove-SmbShare : invite affichée avec l’opération et la cible');
chk(shares(R.W).indexOf('Direction') >= 0, 'Remove-SmbShare : rien n’est supprimé avant la réponse');
chk(R.sh.prompt().indexOf('[O] Oui') === 0, 'Remove-SmbShare : l’invite remplace le prompt PS');
r = run(R.sh, 'N');
chk(!r.ask && shares(R.W).indexOf('Direction') >= 0, 'Remove-SmbShare : réponse N → partage conservé');
const n0 = mut().length;
r = run(R.sh, 'Remove-SmbShare -Name Direction'); r = run(R.sh, '');
chk(!r.ask && shares(R.W).indexOf('Direction') < 0, 'Remove-SmbShare : réponse vide (défaut O) → partage supprimé');
chk(mut().length === n0 + 1 && /Remove-SmbShare/.test(mut()[mut().length - 1].text), 'Remove-SmbShare : action mutante tracée après confirmation');
r = run(R.sh, 'Remove-SmbShare -Name Compta'); r = run(R.sh, 'x');
chk(r.ask && shares(R.W).indexOf('Compta') >= 0, 'Remove-SmbShare : réponse invalide → invite reposée');
r = run(R.sh, '?'); chk(r.ask && /Continuer avec uniquement/.test(text(r)), 'Remove-SmbShare : « ? » affiche l’aide puis redemande');
r = run(R.sh, 'o'); chk(!r.ask && shares(R.W).indexOf('Compta') < 0, 'Remove-SmbShare : réponse o (minuscule) acceptée');

/* 2. -Force ou -Confirm:$false : aucune invite */
R = fresh();
r = run(R.sh, 'Remove-SmbShare -Name RH -Force'); chk(!r.ask && shares(R.W).indexOf('RH') < 0, 'Remove-SmbShare -Force : exécution directe');
r = run(R.sh, 'Remove-SmbShare -Name Commun -Confirm:$false'); chk(!r.ask && shares(R.W).indexOf('Commun') < 0, 'Remove-SmbShare -Confirm:$false : exécution directe');
r = run(R.sh, 'Remove-SmbShare -Name Inexistant'); chk(!r.ask && /ne correspond/.test(text(r)), 'Remove-SmbShare : partage absent → erreur sans invite');

/* 3. Revoke-SmbShareAccess */
R = fresh();
r = run(R.sh, 'Revoke-SmbShareAccess -Name Compta -AccountName "Utilisateurs authentifiés"');
chk(r.ask && /Revoke-SmbShareAccess/.test(text(r)), 'Revoke-SmbShareAccess : invite affichée');
chk((R.W.d('SRV-FIC').win.shares.find(s => s.name === 'Compta').perms || []).length === 1, 'Revoke-SmbShareAccess : ACE conservée avant réponse');
r = run(R.sh, 'O'); chk(!r.ask && (R.W.d('SRV-FIC').win.shares.find(s => s.name === 'Compta').perms || []).length === 0, 'Revoke-SmbShareAccess : ACE retirée après O');

/* 4. Disable-NetAdapter : invite par carte, T = pour toutes, -Confirm:$false direct */
R = fresh('PC-01');
r = run(R.sh, 'Disable-NetAdapter -Name Ethernet0');
chk(r.ask && /Disable-NetAdapter/.test(text(r)) && /Ethernet0/.test(text(r)), 'Disable-NetAdapter : invite affichée');
chk(!R.W.d('PC-01').ifaces.Ethernet0.adminDown, 'Disable-NetAdapter : carte active avant la réponse');
r = run(R.sh, 'O'); chk(!r.ask && R.W.d('PC-01').ifaces.Ethernet0.adminDown === true, 'Disable-NetAdapter : carte désactivée après O');
R = fresh('PC-01');
r = run(R.sh, 'Disable-NetAdapter -Name Ethernet0 -Confirm:$false'); chk(!r.ask && R.W.d('PC-01').ifaces.Ethernet0.adminDown === true, 'Disable-NetAdapter -Confirm:$false : direct');
R = fresh('PC-01');
r = run(R.sh, 'Disable-NetAdapter -Name Ethernet0'); r = run(R.sh, 'U'); chk(!r.ask && !R.W.d('PC-01').ifaces.Ethernet0.adminDown, 'Disable-NetAdapter : U (non pour tout) → carte conservée');
r = run(R.sh, 'Disable-NetAdapter -Name Ethernet0'); r = run(R.sh, 'T'); chk(!r.ask && R.W.d('PC-01').ifaces.Ethernet0.adminDown === true, 'Disable-NetAdapter : T (oui pour tout) → carte désactivée');

/* 5. Sans élévation : l'erreur d'accès précède l'invite ; Enable-NetAdapter sans invite */
const W2 = SIM.buildHealthyWorld({ seed: 1 }); const e2 = T.mk(W2);
const nsh = SIM.emu.openWinShell(e2, 'SRV-FIC', { elevated: false, user: 'tssr' }).exec('powershell').push;
r = run(nsh, 'Remove-SmbShare -Name RH'); chk(!r.ask && /Accès refusé/.test(text(r)) && shares(W2).indexOf('RH') >= 0, 'sans élévation : accès refusé avant toute invite');
R = fresh('PC-01'); run(R.sh, 'Disable-NetAdapter -Name Ethernet0 -Confirm:$false'); r = run(R.sh, 'Enable-NetAdapter -Name Ethernet0');
chk(!r.ask && R.W.d('PC-01').ifaces.Ethernet0.adminDown === false, 'Enable-NetAdapter : sans invite');

/* 6. Pipeline : Get-SmbShare filtré → invite par partage */
R = fresh();
r = run(R.sh, 'Get-SmbShare -Name Commun | Remove-SmbShare');
chk(r.ask && /Commun/.test(text(r)), 'pipeline Get-SmbShare | Remove-SmbShare : invite sur le partage reçu');
r = run(R.sh, 'O'); chk(!r.ask && shares(R.W).indexOf('Commun') < 0 && shares(R.W).indexOf('RH') >= 0, 'pipeline : seul le partage désigné est supprimé');

console.log('\n' + ok + ' ok, ' + ko + ' ko'); process.exit(ko ? 1 : 0);
