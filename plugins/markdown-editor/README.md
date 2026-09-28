# Éditeur markdown

L'éditeur markdown d'Allkin. On écrit **dans le document mis en forme** : un titre est un titre, un
tableau est un tableau, et aucune balise (`**`, `#`, `|`…) n'apparaît à l'écran. Le fichier, lui,
reste du markdown ordinaire.

## Où il sert

- **Missions** — le texte de chaque fiche.
- **Rôle d'un agent** — la section « Rôle » de sa page, et la rédaction du rôle dans l'assistant de
  création d'un agent.
- **Fichiers `.md`** — avec le plugin *Éditeur de texte*, qui s'en sert pour les fichiers markdown.

## La barre d'outils

| Groupe | Ce qu'on y trouve |
| --- | --- |
| Historique | Annuler, rétablir |
| Style du bloc | Texte, Titre 1, Titre 2, Titre 3 — le bouton dit toujours où l'on est |
| Texte | Gras, italique, barré, code, lien |
| Listes | Puces, numéros, cases à cocher |
| Blocs | Citation, bloc de code, tableau, séparateur |
| Médias | Image, fichier joint |
| Markdown brut | Le texte tel qu'il est écrit dans le fichier |

Les boutons s'allument selon l'endroit où se trouve le curseur. Survoler un bouton donne son nom et
son raccourci.

## Écrire plus vite

- **`/`** en début de ligne ouvre le menu des blocs : on tape quelques lettres, puis <kbd>Entrée</kbd>.
- Qui connaît le markdown peut continuer à le taper — `# `, `- `, `1. `, `[] `, `> `, `**gras**`,
  `` `code` ``, `[texte](adresse)`… sont convertis à la volée. `---` puis <kbd>Entrée</kbd> pose un
  séparateur, ` ``` ` puis <kbd>Entrée</kbd> ouvre un bloc de code.
- Coller du markdown, ou un passage copié d'une page web, garde sa mise en forme.

| Raccourci | Effet |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>E</kbd> | Gras, italique, code |
| <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>X</kbd> | Barré |
| <kbd>Ctrl</kbd>+<kbd>K</kbd> | Lien |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>3</kbd>, <kbd>0</kbd> | Titre 1 à 3, texte |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>Z</kbd> | Annuler, rétablir |
| <kbd>Tab</kbd>, <kbd>Maj</kbd>+<kbd>Tab</kbd> | Décaler un item de liste ; cellule suivante ou précédente |
| <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> | Ouvrir une ligne sous le bloc courant |

(<kbd>⌘</kbd> à la place de <kbd>Ctrl</kbd> sur Mac.)

## Tableaux

Le bouton Tableau ouvre une grille : on choisit la taille en la survolant. Dans le tableau,
<kbd>Tab</kbd> passe à la cellule suivante et ajoute une ligne au bout ; <kbd>Entrée</kbd> descend
d'une ligne et, **sur la dernière, sort du tableau** pour continuer à écrire dessous. Le bouton
**⋯** de la cellule courante insère ou retire lignes et colonnes, aligne la colonne, supprime le
tableau.

## Liens, images, fichiers

- **Lien** — sélectionne du texte puis <kbd>Ctrl</kbd>+<kbd>K</kbd>, ou colle une adresse sur la
  sélection. Le curseur dans un lien fait apparaître son adresse, avec de quoi l'ouvrir, la changer
  ou la retirer.
- **Image** — par le bouton Image, en la **glissant dans le texte** (un repère montre où elle
  tombera) ou en la collant. Un clic sur l'image permet d'écrire sa description ou de la supprimer.
- **Fichier** — le trombone, ou un glisser-déposer : le fichier est rangé et un lien vers lui est
  posé dans le texte.

Dans un **fichier `.md`**, images et fichiers sont rangés à côté du document (`images/`,
`fichiers/`). Ailleurs — mission, rôle d'un agent — une image s'ajoute par son adresse web, et un
fichier déposé sur une mission y est joint comme avant.

Une **image distante** trouvée dans un texte reste masquée tant que tu n'as pas demandé à la voir :
l'afficher, c'est envoyer une requête à son serveur, et un texte écrit par un agent pourrait s'en
servir pour faire sortir une information. Les serveurs que tu acceptes sont retenus.

## Le fichier reste le tien

Seuls les blocs que tu modifies sont réécrits : corriger un mot ne reformate pas le reste du
document. Le bouton **Markdown brut** montre le texte exact du fichier, et permet de le corriger à
la main.

## Sans ce plugin

Ces éditions n'existent plus : ni missions, ni section « Rôle » (le `CLAUDE.md` d'un agent reste en
place et continue de servir, il n'est simplement plus modifiable depuis l'interface), et les
fichiers `.md` s'ouvrent comme du texte brut. L'affichage des messages des agents, lui, ne dépend
pas de ce plugin.

## Pour les autres plugins

```js
const editor = Allkin.capability("markdown-editor").create({
  host,        // l'élément qui reçoit le document
  toolbar,     // celui qui reçoit la barre d'outils (facultatif)
  spellcheck,  // correcteur du navigateur
  doc: { getContent: () => texte, setContent: (suivant) => { texte = suivant; } },
  files: {     // facultatif : où ranger images et fichiers
    upload: async (file) => ({ src: "images/photo.png", name: file.name }),
    resolve: (src, usage) => "/adresse/où/lire/" + src,   // usage : "image" ou "open"
  },
});
editor.render();   // puis reload(), focus("start" | "end"), isFocused(), destroy()
```

## Droit demandé

- **Interface d'Allkin** — le plugin s'exécute dans la page d'Allkin, avec ta session.
