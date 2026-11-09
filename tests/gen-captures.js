/* Regroupe le registre « à vérifier » (docs/A-VERIFIER.md) par machine de référence à capturer.
   Sortie : docs/CAPTURES-A-FAIRE.md — la liste de travail pour la session de captures (VM / Packet Tracer / Debian / pfSense).
   Le classement est heuristique (mots-clés du tag et du texte) : une entrée « Autre » est à ranger à la main. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'docs', 'A-VERIFIER.md'), 'utf8');
const entries = []; src.split('\n').forEach(l => { const m = l.match(/^- \*\*([^*]+)\*\* — (.*)$/); if (m) entries.push({ tag: m[1], text: m[2] }); });
const GROUPS = [
  ['Debian 13 (SRV-LNX / SRV-WEB)', 'Debian — shell : copier la sortie texte exacte (terminal ou SSH), pas de capture graphique nécessaire.', /^(mysql|nano|apt|bash|boot|lx|ssh-lx|systemctl|journal|ufw|bind|named|nginx|apache|mariadb|cron|getfacl|setfacl|df|mount|fstab|ip-|resolv|ss-|netplan|interfaces|sudo|dpkg|sshd|dig)/i, /debian|systemd|journalctl|ufw|bash|apt|\/etc\//i],
  ['Cisco IOS (Packet Tracer / matériel Ramonville)', 'IOS — copier la sortie console exacte de chaque commande show/debug citée.', /^(ios|cisco|show|spanning|vtp|acl-ios|nat-ios|vlan-ios|ssh-ios|port-sec|portsec|dhcp-ios|ospf|eigrp|trunk)/i, /\bIOS\b|Router#|Switch#|show (ip|vlan|run|int|spanning)/i],
  ['pfSense', 'pfSense — captures de l\'interface web (Firewall > Rules, NAT, VPN > IPsec, Status) et de /var/log.', /^(pf|vpn|ipsec|openvpn)/i, /pfSense|IPsec|OpenVPN/i],
  ['Windows Server — consoles graphiques (SRV-DC1 / SRV-FIC)', 'Console MMC — une capture d\'écran par fenêtre/onglet/boîte de dialogue citée (taille normale, thème par défaut).', /-gui$|^(aduc|gpmc|dhcp|dns|iis|certlm|wf|compmgmt|lusrmgr|explorer|taskmgr|eventvwr|services)/i, /Gestionnaire|console|MMC|fenêtre|onglet|boîte de dialogue|colonnes|arborescence/i],
  ['Windows — ligne de commande / PowerShell', 'cmd / PowerShell — copier le texte brut de la sortie (police fixe), sur Windows Server 2022 et Windows 10 en français.', /^(net|sc-|ipconfig|nltest|w32tm|netsh|icacls|gpresult|klist|ps-|powershell|nslookup|ping|tracert|netstat|arp|route|iisreset|cmd|win-fr)/i, /cmd|PowerShell|Get-|Set-|New-|netsh|ipconfig/i],
  ['Windows Client (PC-01 / PC-02) — ouverture de session et messages système', 'Poste Windows 10 en français — capture de l\'écran de connexion et des boîtes de message (une par cas), texte exact.', /^(logon|curl|ncpa|svc-|win-)/i, /session|ouverture/i],
  ['Observateur d\'événements (Event ID)', 'Observateur d\'événements — pour chaque ID : journal, source, niveau, texte exact du message en français.', /^(evt|event)/i, /Event ?ID|Observateur d’événements|source /i]
];
const buckets = {}; GROUPS.forEach(g => { buckets[g[0]] = []; }); buckets['Autre (à ranger)'] = [];
entries.forEach(e => { const g = GROUPS.find(x => x[2].test(e.tag)) || GROUPS.find(x => x[3].test(e.tag + ' ' + e.text)); (g ? buckets[g[0]] : buckets['Autre (à ranger)']).push(e); });
let md = '# Captures à produire (généré par `node tests/gen-captures.js`)\n\n';
md += 'Chaque entrée du registre `A-VERIFIER.md` est un détail reconstitué de mémoire : une capture de référence la confirme ou la corrige. Regroupées par machine pour que la session de capture se fasse en une fois par VM.\n\n';
md += '**' + entries.length + ' entrées** — ' + Object.keys(buckets).filter(k => buckets[k].length).map(k => buckets[k].length + ' ' + k.split(' (')[0].split(' — ')[0]).join(' · ') + '.\n\n';
md += 'Procédure : capturer → placer le fichier sous `captures/<tag>.png` (ou `.txt` pour une sortie texte) → corriger le code → supprimer l\'appel `U.av(\'<tag>\', …)` correspondant → relancer `node build.js` et `node tests/all.js`.\n';
Object.keys(buckets).forEach(k => {
  if (!buckets[k].length) return; const g = GROUPS.find(x => x[0] === k);
  md += '\n## ' + k + ' (' + buckets[k].length + ')\n\n' + (g ? g[1] + '\n\n' : '') + '| Tag | À confirmer |\n|---|---|\n';
  buckets[k].forEach(e => { md += '| `' + e.tag + '` | ' + e.text.replace(/\|/g, '/').slice(0, 260) + (e.text.length > 260 ? '…' : '') + ' |\n'; });
});
fs.writeFileSync(path.join(root, 'docs', 'CAPTURES-A-FAIRE.md'), md);
console.log('docs/CAPTURES-A-FAIRE.md : ' + entries.length + ' entrées — ' + Object.keys(buckets).map(k => k.split(' (')[0] + ' ' + buckets[k].length).join(', '));
