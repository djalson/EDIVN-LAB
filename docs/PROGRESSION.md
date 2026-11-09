# Progression, expérience et « jeu » (V2)

Code : `src/engine/81-progress.js` (moteur, sans DOM, testé dans `tests/progress.js`), `src/ui/92-progress.js` + `src/css/38-progress.css` (interface), branchements dans `src/ui/90-app.js`, `10-run.js`, `30-terminal.js`, `50-desktop.js`, `51-winsurface.js`, `72-pfw-core.js`, `76-app-remote.js`. Tests d'interface : `tests/ui/progress.js`.

## Principe
Rendre chaque ticket plus « rejouable » sans toucher à la formation. **Aucun avantage gagné ne change la note, le contenu ou la difficulté d'un ticket.** Les avantages sont du confort, du style, de l'XP et de la tolérance de série. Le coffre-fort et le carnet sont **coupés en évaluation chronométrée** (`P.perkActive`).

## Niveaux et points
- 40 niveaux ; XP cumulée pour le niveau n : `round(100 × (n−1)^1,6)`. Titres par paliers.
- 1 point de compétence par niveau, +1 aux niveaux 10, 20, 30, 40. Les points ne sont **pas stockés** : `points = gagnés(niveau) − coût(arbre acheté)`. Réinitialiser l'arbre est gratuit.

## XP d'un ticket
Base : 60 / 100 / 160 / 230 / 300 (niveaux 1 à 5), + étoiles (20 % / 10 %), première résolution (25), record (20), sans faute (20), éclair (20) ou rapide (10), objectifs bonus. Puis multiplicateurs : rejeu d'une panne déjà jouée ≥ 3 fois (60 %), mode guidé (× 0,6), ticket du jour (× 1,5, une fois par jour), série (+5 % par jour, plafond +30 %), arbre (+5 % + 5 %). Échec ou abandon : 10 XP.

## Arbre (13 nœuds)
| Branche | Nœud | Coût | Effet |
|---|---|---|---|
| Confort | Coffre-fort d'identifiants | offert (succès « Mémoire des doigts ») | Bouton clé sur les formulaires d'identification |
| Confort | Coffre-fort : terminaux | 2 (succès « Pianiste » requis) | Ctrl + Espace aux invites de mot de passe |
| Confort | Carnet de bord | 1 | Bloc-notes par ticket |
| Réputation | Curiosité / Méthode | 2 / 3 | +5 % / +5 % d'XP |
| Réputation | Chasseur de primes | 3 | 4ᵉ objectif bonus |
| Réputation | Joker de série | 2 | Un jour manqué pardonné (1 fois / 14 jours) |
| Style | Titres à la carte | 1 | Choisir son titre |
| Style | 5 thèmes (Pluie de code, Synthwave 80s, Cyberpunk, Console 8-bit, Terminal Ambre) | 1 chacun | Débloque le thème (libres : Néon Arcade, Dev Dark, Papier Clair) |

## Maîtrise
Par compétence de la fiche : Bronze / Argent / Or à 1 / 3 / 6 validations « propres » (sans indice ni action risquée). Vue « Maîtrises par compétence », regroupée par domaine.

## Série et ticket du jour
Série = jours consécutifs avec au moins un ticket validé. **Ticket du jour** : graine `jour-AAAA-MM-JJ`, niveau selon le jour de la semaine (lun. 1, mar. 2, mer. 3, jeu. 2, ven. 4, sam. 3, dim. Chaos). Même incident pour tous ; aux niveaux 1 et 2 la panne est fixée indépendamment du profil.

## Coffre-fort d'identifiants
Reprend les comptes du tableau « Mots de passe de l'infra » (`SIM.VAULT`, `src/content/18-creds.js`), étiquetés par usage. Compte comme saisie manuelle : un mot de passe d'au moins 3 caractères, tapé (non rempli par le coffre) et **accepté** par le système. 20 saisies → succès « Mémoire des doigts » → coffre offert ; 60 → « Pianiste » → palier terminaux achetable.

## Succès et objectifs
41 succès (`Game.BADGES`, ajoutés par `81-progress.js`), familles Progression, Maîtrise, Persévérance, Habitudes ; certains secrets. 3 objectifs bonus par ticket (4 avec « Chasseur de primes »), tirés par graine, évalués en direct dans le ticket et au débrief.

## Persistance et limites
Profil dans `localStorage` (clé `edivn.profile`), assaini à chaque lecture (`Game.cleanProfile`). Export / import JSON dans Outils. Le ticket du jour et la série utilisent l'horloge locale : pas d'anti-triche (pas de serveur). Barème d'équilibrage à ajuster après essais réels.
