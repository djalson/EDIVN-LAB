# Format d'un scénario (JSON déclaratif)

Un scénario est une **donnée pure** : aucun code. On peut le créer en copiant un scénario existant
(bouton « Scénarios formateur » → « Télécharger un modèle »), en modifiant le JSON, puis en l'important
dans le jeu. À l'import le moteur **joue le scénario** sur un réseau sain et le refuse avec la raison s'il ne tient pas
(`SIM.fault.validate`, testé par `tests/validate.js`).

Les scénarios livrés sont dans `src/content/20..25-faults-*.js` (même format, ajoutés par `add({...})`).
Le catalogue complet à jour est exporté par « Exporter tout le catalogue ».

## Champs

| Champ | Obligatoire | Rôle |
|---|---|---|
| `id` | oui | minuscules, chiffres, `_` ; unique |
| `level` | oui | 1 Junior · 2 Confirmé · 3 Admin · 4 Cyber (pièges, fausses pistes). Le niveau 5 « Chaos » n'a pas de scénario propre : le moteur assemble 2 à 4 pannes de niveau 2 à 4 (chaînées ou indépendantes) |
| `title` | oui | titre de la panne (visible seulement en « options formateur » et au débrief) |
| `skills` | oui | ≥ 1 identifiant du référentiel (fiche v19) : voir `docs/COUVERTURE-UI.md` ou `SIM.skills` |
| `ticket` | oui | `{ from, subject, body, site }` — brief vague, rédigé comme un utilisateur |
| `cause` / `solution` | oui | texte du débrief |
| `hints` | oui | exactement 3, du plus vague au plus précis |
| `inject` | oui | liste d'étapes qui cassent le réseau (modifient l'état du modèle ; **aucun symptôme écrit à la main**) |
| `probes` | oui | symptômes observables, évalués sur l'état : `{ "t": "ping", "from": "PC-01", "to": "10.10.10.10" }` |
| `fix` | oui | correction de référence (utilisée par les tests) ; `fixes` : variantes de corrections valides |
| `roots` | recommandé | clés de cause racine : distinguent une vraie réparation d'un contournement |
| `workarounds` | non | contournements reconnus (ex. IP statique) → statut « contournement » |
| `traps` | recommandé | pièges listés au débrief |
| `optimal` | recommandé | chemin optimal pour la comparaison du débrief |
| `vary` | non | variantes tirées par la graine ; `{{x.champ}}` dans tout le scénario |
| `verify` | non | observations requises pour valider la résolution (sinon dérivées des sondes) |

## Étapes (`inject`, `fix`, `workarounds`)
`set` (chemin de modèle) · `del` · `push` · `wall` · `unplug` · `replug` · `renew` · `release` · `flushdns` · `svc` ·
`tick` · `session` · `relogon` · `gpupdate` · `ad.pwd` · `ad.lock` · `ad.unlock` · `ad.regdns` · `ad.member.add/del` ·
`ovpn.connect/disconnect` · `reboot` · `log` · `ios.recover` · `lx.write/replace/append/chmod/chown/rm/svc/disk/…`
(liste exacte : `Object.keys(SIM.steps)`).

## Sondes (`probes`)
`ping connect resolve http lease ip svc ptr dhcpfree link eq listen login share gpo gpfetch trust dc time policy certvalid
ipsec vpn vpnuse ssh ace psec ioscfg lxcfg lxfile lxufw lxfresh cronjob dblogin lxaccess lxdisk lxboot bindok cfgcheck fstabok`.

## Règle de gouvernance
Un scénario sans compétence du référentiel est refusé. Une notion hors fiche (ex. RDP, Squid — 🟡 en attente de décision)
ne doit pas être ajoutée sans arbitrage.
