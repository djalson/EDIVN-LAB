# Revue de check-up — EDIVN Lab

_Dernière mise à jour : 27/10/2026. Les chiffres de test viennent de `docs/RAPPORT-TESTS.md` (batterie complète : 75/75 tests réussis, 892 s)._

## 1. Verdict

Le produit est livrable en l'état : 158 pannes valides (sain → injecté → réparé → contournement détecté), chaque panne rattachée à ≥ 1 compétence de la fiche v19, aucune erreur JS sur le balayage complet de l'interface (toutes les pannes × 2 graines × 3 modes), terminal soumis à un fuzz d'entrées hostiles sans exception.
Le risque n°1 n'est pas technique : c'est la **fidélité des détails non confirmés** (140 entrées dans `A-VERIFIER.md`). Tant qu'aucune capture de référence ne les confirme, un admin sys expérimenté peut relever un écart de libellé. Elles sont regroupées par machine dans `CAPTURES-A-FAIRE.md`.

## 2. Bugs trouvés et corrigés pendant ce check-up

| # | Constat | Correction | Test |
|---|---|---|---|
| 1 | `systemctl status constructor` (et `__proto__`, `toString`…) faisait planter l'émulateur Linux (recherche dans un objet sans garde) | garde `hasOwnProperty` | `fuzz-term` |
| 2 | Éditeur vim : double échappement HTML (caractères `<` `&` affichés en entités) | entrées `{t}`/`{h}` distinctes | `sweep`, `emu-lx` |
| 3 | PowerShell : la forme `-Paramètre:valeur` (ex. `-Confirm:$false`, très courante) était refusée | liaison des paramètres corrigée | `cli-parity` |
| 4 | `ipconfig` affichait « Média déconnecté » pour une carte **désactivée** (Windows ne l'affiche pas) ; `Get-NetAdapter` disait `Disconnected` au lieu de `Disabled` | filtre + statut | `cli-parity` |
| 5 | Une partie relancée sans fermer la précédente laissait des minuteurs orphelins | `begin()` arrête la partie précédente | `sweep` |
| 6 | Pare-feu Windows : la colonne **Activé** (celle que touchent les pannes) était hors de l'écran à la taille par défaut | largeurs de colonnes réduites | `gallery` (revue visuelle) |
| 7 | Les notifications recouvraient le bouton Démarrer / la zone de recherche du bureau simulé | largeur limitée à la barre latérale | `gallery` |
| 8 | Un profil ou une liste de scénarios corrompu dans le stockage du navigateur (`42`, `[]`, mauvais types) empêchait **tout** démarrage de l'application | reconstruction du profil champ par champ (`Game.cleanProfile`), listes de scénarios tolérantes | `profile-corrupt` |
| 9 | L'arithmétique PowerShell (`2+3`) reposait sur `Function()` (eval), incompatible avec une CSP stricte selon les navigateurs | petit évaluateur arithmétique sans eval | `security`, `cli-parity` |

## 3. Sécurité

| Sujet | Mesure | Vérifié par |
|---|---|---|
| Pollution de prototype via chemins de scénario (`__proto__`, `constructor`, `prototype`) | refus dans `pget`/`pset`/`pdel` et dans la validation | `security` |
| HTML hostile (tickets, pages web simulées, scénarios importés) | assainisseur `UI.safeHtml` (liste blanche de balises et d'attributs, pas de `on*`, pas de `javascript:`) | `security` |
| Contenu actif | politique CSP intégrée au fichier (aucune sortie réseau, aucun cadre, aucun script distant) ; plus aucun `eval`/`Function` dans le code (test statique) | `security` |
| Import de scénarios | taille ≤ 2 Mo, ≤ 50 scénarios, limites d'étapes/variantes, revalidation par simulation à chaque chargement | `scenario-import`, `security` |
| Stockage navigateur corrompu ou hostile | profil reconstruit, clés dangereuses écartées, scénarios revalidés | `profile-corrupt` |
| Terminaux | 6 émulateurs soumis à des entrées aléatoires/hostiles (très longues, caractères de contrôle, noms réservés JS) : 0 exception | `fuzz-term` |

Reste hors périmètre : le jeu est un fichier local sans serveur ni compte ; aucune donnée ne quitte le navigateur.

## 4. Pannes ajoutées

- `nic_disabled` (N1) — carte réseau désactivée dans Windows, câble et port sains. Compétences `phys`, `subnetting`.
- `fw_smb` (N2) — règle SMB entrante désactivée sur SRV-FIC, port 445 filtré, partages intacts. Compétences `pare-feu-win`, `ntfs-partage`.
- Itération précédente : `dhcp_suffix`, `sh_missing`, `dns_hosts`, `web_site_stopped`, `web_hostheader`.

Périmètre : aucune extension (pas de RDP, pas de Squid).
Candidats non retenus, faute de base documentaire ou parce qu'ils sortent de la fiche : `dhcp_release`, pannes RDP, pannes proxy.

## 5. Parité ligne de commande / interface graphique

Chaque panne doit pouvoir être réparée par le chemin que choisirait un admin, graphique **ou** terminal. Ajouts : `net share Nom=chemin /GRANT: /REMARK:` et `/DELETE`, `New-/Remove-SmbShare`, `Grant-/Revoke-SmbShareAccess`, `Get-Website`, `Start-/Stop-Website`, `Get-/Set-WebBinding`, `Get-IISSite`, `Start-/Stop-IISSite`, `iisreset`, `Enable-/Disable-NetAdapter`, `netsh interface set interface admin=`.
Test dédié : `tests/cli-parity.js` (54 vérifications : diagnostic au terminal, réparation, droits d'administrateur, erreurs).

## 6. Revue visuelle

Captures générées par `tests/ui/gallery.js` (accueil, ticket, carte, bureaux serveur et client, IIS, pare-feu, DHCP, DNS, ADUC, GPMC, connexions réseau) et relues. Points relevés et corrigés : § 2, lignes 6 et 7. Rien d'autre d'incohérent à l'œil (arborescences, colonnes, libellés, barres de titre).
Limite : une relecture à l'œil ne remplace pas la comparaison avec de vraies captures (`CAPTURES-A-FAIRE.md`).

## 7. Axes d'amélioration (par ordre de valeur)

1. **Captures de référence** — confirmer ou corriger les 140 détails de `A-VERIFIER.md`. C'est ce qui sépare « très ressemblant » de « indiscernable » (objectif n°1).
2. **Compétences à une seule panne** : `dhcp-auth`, `ad-trust`, `switch-secu`, `lx-acl`, `lx-reseau`, `nginx`, `bash`. Plusieurs ont des variantes internes, mais une deuxième panne indépendante diversifierait l'entraînement.
3. **Squid / proxy** : seule compétence sans panne (décision « pas pour l'instant »).
4. **Pannes multi-causes scénarisées au niveau 4** (en plus du niveau Chaos généré) : par exemple AGDLP + permission de partage sur le même dossier.
5. **Confirmations interactives PowerShell** (`Remove-SmbShare` sans `-Confirm:$false`) et sorties multi-lignes de `Get-Website` : non émulées.
6. **Test pixel** : aucun ; la fidélité visuelle se juge à l'œil.
7. **Persistance** : le profil vit dans le navigateur ; l'export JSON de la trace existe, pas de synchronisation entre postes.

## 8. Ce qui n'a pas été fait volontairement

- Aucune décision de gouvernance (`DECISIONS.md`) : elle se prend dans le projet.
- Aucun élément marqué « à vérifier » n'a été « confirmé » sans capture.
- Pas de logo, police ni capture tiers ajoutés.
