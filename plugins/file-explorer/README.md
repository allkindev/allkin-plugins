# Explorateur de fichiers

Parcourir et gérer les fichiers des agents depuis Allkin.

## Onglet « Fichiers » d'un agent

Le bouton dossier sur la ligne d'un agent ouvre son espace `data/` :

- navigation par dossiers, tri par nom, taille ou date ;
- boutons **Nouveau dossier** et **Nouveau fichier** dans l'en-tête, à côté du chemin ;
- **dépôt** de fichiers et de dossiers entiers par glisser-déposer, avec progression ;
- **menu contextuel** (clic droit ou appui long) : ouvrir, télécharger, copier, couper, coller,
  renommer, archiver, extraire, nouveau fichier, nouveau dossier, supprimer ;
- **sélection multiple** et actions en masse depuis le menu ⋮ ;
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
