# Explorateur de fichiers

Parcourir et gérer les fichiers des agents depuis Allkin.

## Onglet « Fichiers » d'un agent

Le bouton dossier sur la ligne d'un agent ouvre son espace `data/` :

- navigation par dossiers (une ligne « Dossier parent » pour remonter), **filtre** par nom, tri
  par nom, taille ou date (en-têtes de colonnes ; sur téléphone, un menu « Trier ») ;
- une **icône par type** : dossier, image, PDF, archive, script, code, données, texte… la
  corbeille et le dossier `Upload` ont la leur ;
- boutons **Nouveau dossier** et **Nouveau fichier** dans l'en-tête, à côté du chemin ; un
  fichier créé s'ouvre aussitôt ;
- **dépôt** de fichiers et de dossiers entiers par glisser-déposer, avec progression — ou par le
  sélecteur du système (« Déposer des fichiers… », menu ⋮ ou menu contextuel), la seule façon
  sur téléphone ;
- **menu contextuel** (clic droit, appui long, ou le bouton ⋯ de chaque ligne) : ouvrir,
  télécharger, sélectionner, copier, couper, coller, renommer, archiver, extraire, nouveau
  fichier, nouveau dossier, déposer, supprimer ;
- **sélection multiple** : depuis le menu ⋮, ou « Sélectionner » sur un élément. Une barre
  apparaît alors avec Tout / Télécharger / Déplacer / Supprimer / Terminé — au pied de l'écran
  sur téléphone ;
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
