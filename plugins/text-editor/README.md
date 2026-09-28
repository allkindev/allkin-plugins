# Éditeur de texte

Ouvre un fichier du dossier d'un agent dans son propre onglet.

## Éditeur de code

Tout fichier texte s'ouvre dans l'éditeur de code — **80 langages colorés** (JavaScript,
TypeScript, Python, PHP, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, SQL, YAML, JSON,
HTML/XML, CSS/SCSS, shell, PowerShell, Dockerfile, Makefile, Nginx, LaTeX…), par highlight.js.

- **Langage** : détecté d'après le nom du fichier (extension, `Dockerfile`, `Makefile`, `.env`…)
  ou, à défaut, deviné au contenu. Le sélecteur de l'en-tête permet de le **choisir à la main** ;
  le choix est retenu pour ce fichier sur cet appareil. « Texte brut » désactive la coloration.
- **Numéros de ligne**, retour à la ligne automatique (bouton ; d'office pour le texte brut),
  taille de police réglable, plein écran.
- **Rechercher / remplacer** (Ctrl+F, Ctrl+H) : occurrence suivante/précédente, respect de la
  casse, remplacer une ou toutes ; **aller à la ligne** (Ctrl+G).
- **Écrire du code** : Tab / Maj+Tab indentent la sélection (unité détectée : tabulation ou
  espaces), Entrée conserve l'indentation et ouvre un bloc après `{`, `[`, `(` ou `:`,
  Ctrl+/ commente ou décommente (syntaxe du langage), Ctrl+D duplique la ligne, Ctrl+S enregistre
  tout de suite. L'annulation (Ctrl+Z) reste celle du navigateur.
- **Barre d'état** : ligne et colonne, nombre de lignes, indentation, langage.
- **Enregistrement au fil de la frappe** — aucun bouton « Enregistrer ».

## Markdown, images, PDF

- **Markdown** s'ouvre mis en forme ; « Éditer » passe dans l'éditeur markdown si le plugin
  *Éditeur markdown* est installé, dans l'éditeur de code sinon. Les images et fichiers qu'on y
  ajoute sont rangés à côté du document, dans `images/` et `fichiers/`.
- **Images et PDF** : simple visionneuse.
- Copier le contenu ou le chemin, télécharger le fichier.

Jusqu'à six fichiers ouverts par agent : au-delà, le plus ancien est fermé (après enregistrement).

## Pour les autres plugins

La capacité `code-highlight` : `highlight(texte, langage)`, `languageForFilename(nom)`,
`languages()`. L'explorateur s'en sert pour montrer un script avant de l'exécuter.

`hljs.js` est construit depuis `node_modules/highlight.js` du dépôt allkin par
`scripts/hljs-entry.mjs` (la commande est en tête du fichier).

## Sans ce plugin

Plus d'onglet fichier : cliquer sur un fichier dans l'explorateur le télécharge.

## Droit demandé

- **Interface d'Allkin** — le plugin s'exécute dans la page d'Allkin, avec ta session.
