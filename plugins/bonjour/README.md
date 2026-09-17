# Bonjour

Un plugin d'exemple : il fait tourner un petit serveur web et affiche sa page dans un onglet
d'Allkin. Il sert surtout de point de départ pour écrire un plugin.

## Utilisation

1. Accorder le droit **Réseau** : le plugin écoute sur un port local.
2. Régler éventuellement le port et le message d'accueil.
3. Cocher **Autoriser le démarrage en service**, puis enregistrer.
4. **Ouvrir la page** : elle s'affiche dans un onglet d'Allkin.

## Réglages

| Réglage           | Rôle                                                      |
|-------------------|-----------------------------------------------------------|
| Port local        | Port d'écoute, sur `127.0.0.1` uniquement (défaut 9301)   |
| Message d'accueil | Le titre de la page                                       |
| Jeton d'exemple   | Un secret : la page indique seulement s'il est renseigné  |
