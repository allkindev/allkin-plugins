# WeTTY

Un terminal dans le navigateur : [WeTTY](https://github.com/butlerx/wetty) ouvre une session SSH et
l'affiche dans un onglet d'Allkin. Pratique depuis un téléphone ou un poste sans client SSH.

## Mise en route

1. Accorder les trois droits (voir plus bas pourquoi).
2. Vérifier les réglages : par défaut, le terminal se connecte en SSH à la machine d'Allkin
   (`localhost:22`) et demande l'identifiant puis le mot de passe.
3. Cocher **Autoriser le démarrage en service**, puis enregistrer.
4. **Ouvrir la page**.

Au **premier démarrage**, WeTTY est téléchargé depuis npm et son module natif `node-pty` est
compilé pour la machine : comptez de dix secondes à une minute. Le journal du service montre
l'avancement ; tant que ce n'est pas fini, la page répond « le plugin ne répond pas » —
rechargez-la ensuite. Les démarrages suivants sont immédiats.

## Pourquoi SSH, même vers la machine locale

WeTTY n'ouvre un shell local directement que s'il tourne en root, ce qui n'est pas le cas
d'Allkin. Il passe donc par le serveur SSH, ce qui a un avantage : **ouvrir le terminal demande
les identifiants système**, en plus de la session Allkin. Le serveur SSH doit être installé et
accepter l'authentification choisie (`sudo apt install openssh-server` sur Debian/Ubuntu).

## Réglages

| Réglage          | Rôle                                                                  |
|------------------|-----------------------------------------------------------------------|
| Port local       | Port d'écoute de WeTTY sur `127.0.0.1` (défaut 9310)                  |
| Serveur SSH      | La machine où ouvrir le terminal (défaut `localhost`)                 |
| Port SSH         | Défaut 22                                                             |
| Utilisateur SSH  | Vide : demandé à chaque ouverture                                     |
| Authentification | Mot de passe, ou clé puis mot de passe                                |
| Clé privée SSH   | Chemin d'une clé. Sans phrase de passe, plus rien n'est demandé : seule la session Allkin protège alors le terminal |
| Titre            | Le titre de la fenêtre du terminal                                    |

## Droits demandés

- **Réseau** — téléchargement de WeTTY depuis npm, écoute sur le port local, connexion SSH.
- **Commandes système** — npm à l'installation, puis ssh ; et le terminal exécute ce que vous tapez.
- **Fichiers hors de son dossier** — un terminal voit tout ce que voit le compte connecté.

## Détails

- WeTTY est installé dans le dossier de données du plugin (`runtime/`), conservé lors des mises à
  jour du plugin. Supprimer ce dossier force une réinstallation au démarrage suivant.
- La page est servie sous `/plugins/wetty/web` (option `--base`) et relayée par Allkin, WebSocket
  compris : elle n'est jamais exposée directement sur le réseau.
