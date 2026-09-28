# Explorateur de fichiers

Parcourir et gérer les fichiers des agents depuis Allkin.

## Onglet « Fichiers » d'un agent

Le bouton dossier sur la ligne d'un agent ouvre son espace `data/` :

- navigation par dossiers (une ligne « Dossier parent » pour remonter) ; tri par nom, taille ou
  date (en-têtes de colonnes ; sur téléphone, un bouton « Trier ») ;
- **tout se fait depuis l'en-tête de la page**, en boutons icône : rechercher (le filtre par nom
  ne prend une ligne que quand on l'ouvre), déposer des fichiers, nouveau dossier, nouveau fichier,
  sélection — le menu ⋮ d'Allkin n'a rien à proposer ici ;
- une **icône par type** : dossier, image, PDF, archive, script, code, données, texte… la
  corbeille et le dossier `Upload` ont la leur ;
- un fichier créé s'ouvre aussitôt ;
- **dépôt** de fichiers et de dossiers entiers par glisser-déposer, avec progression — ou par le
  sélecteur du système (bouton « Déposer » de l'en-tête), la seule façon sur téléphone ;
- **menu contextuel** (clic droit, appui long, ou le bouton ⋯ de chaque ligne) : ouvrir,
  télécharger, sélectionner, copier, couper, coller, renommer, archiver, extraire, nouveau
  fichier, nouveau dossier, déposer, supprimer ;
- **sélection multiple** : bouton « Sélection » de l'en-tête, ou « Sélectionner » sur un
  élément. Une barre apparaît alors avec Tout / Télécharger / Déplacer / Supprimer / Terminé — au
  pied de l'écran sur téléphone ;
- **corbeille** : « Vider la corbeille » dans le menu contextuel, quand on est dedans ;
- toutes les confirmations et saisies passent par les fenêtres d'Allkin, et chaque action
  répond par une bulle ;
- **archives** zip/tar, et téléchargement d'un dossier en zip ;
- **exécution de scripts** `.sh`, après lecture de leur contenu, avec la sortie en direct ;
- **corbeille** : ce qui est supprimé part dans `Trash/`, vidable à part.

Un clic sur un fichier l'ouvre dans le plugin *Éditeur de texte* s'il est installé, et le
télécharge sinon.

## Explorateur de `~/.allkin`

Depuis l'accueil, un parcours **en lecture seule** du dossier d'installation d'Allkin : agents,
sessions, sauvegardes. Les secrets n'y sont pas lisibles.

## Sans ce plugin

Plus d'onglet Fichiers ni d'explorateur : le bouton dossier des agents et le bouton « Explorateur »
de l'accueil disparaissent. Les agents, eux, gardent l'accès à leurs fichiers selon leurs droits.

## Droit demandé

- **Interface d'Allkin** — le plugin s'exécute dans la page d'Allkin, avec ta session.
