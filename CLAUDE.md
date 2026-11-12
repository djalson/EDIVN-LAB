# EDIVN Lab

Simulateur de pannes d'infrastructure, jeu sérieux pour la formation TSSR. Livrable : **un seul fichier HTML autonome, hors ligne** (`dist/EDIVN-Lab.html`). Aucune dépendance d'exécution.

## Commandes

```
npm run build        # src/ → dist/EDIVN-Lab.html (échoue si une ressource externe s'y glisse)
npm run test:fast    # palier rapide, à lancer après chaque modification
npm run test:quick   # batterie sans le « singe »
npm test             # batterie complète (≈ 1 h ; `node tests/all.js --jobs=2` ≈ 35 min) → docs/RAPPORT-TESTS.md
node tests/<nom>.js              # un test du moteur
node tests/ui/<nom>.js           # un test d'interface (Playwright + Chromium)
```

Les tests d'interface lisent `dist/` : **toujours reconstruire avant**.

## Architecture

- `src/engine` : moteur sans DOM (monde, réseau, pannes, jeu, progression, **campagne**, **fiche**). Testable sous Node.
- `src/content` : le monde, les 187 pannes (des données), les compétences, **les chapitres**.
- `src/emu` : terminaux (cmd, PowerShell, bash, IOS, pfSense).
- `src/ui`, `src/css` : interfaces.
- `build.js` concatène tout, dans l'ordre alphabétique de chaque dossier.

Espace de noms unique `SIM`. Ajouter une panne = ajouter une donnée ; elle rejoint son chapitre toute seule (`docs/CAMPAGNE.md`).

## Règles

- Le monde simulé est la vérité : une sortie de commande est calculée depuis l'état, jamais écrite à l'avance.
- Un faux détail réaliste est pire qu'un détail absent : ce qui n'est pas confirmé va dans `docs/A-VERIFIER.md`.
- Rien de ce qui se gagne (XP, arbre) ne change la note d'un ticket.
- La campagne ne modifie jamais le monde : elle filtre la carte et le tirage. Le bac à sable reste le jeu d'origine.
- Les tests antérieurs à la campagne tournent avec `#legacy` dans l'adresse.

## À lire

`docs/CAMPAGNE.md` (V3), `docs/PROGRESSION.md` (XP, arbre), `docs/LIMITES.md`, `docs/FORMAT-SCENARIO.md`.
