# Pont Telegram

Parle à tes agents depuis Telegram. Un bot écoute en continu (long polling : rien à ouvrir sur
ta box, aucune adresse publique), relaie chaque message à l'agent de ton choix et renvoie sa
réponse dans le chat. Quand l'agent veut lancer une commande, elle arrive avec deux boutons :
**Autoriser** ou **Refuser**.

## Mise en route

1. Dans Telegram, écris à **@BotFather** : `/newbot`, un nom, un identifiant. Il te donne le
   **jeton** du bot.
2. Colle le jeton dans les réglages du plugin, puis écris ton **identifiant Telegram** dans
   « Utilisateurs autorisés » (si tu ne le connais pas : enregistre d'abord avec une liste vide
   de quelqu'un d'autre, écris au bot, il te répond ton identifiant ; ou demande-le à
   **@userinfobot**).
3. Choisis l'**agent par défaut** (son identifiant, celui de l'URL de sa page).
4. Accorde les trois droits, coche **Autoriser le démarrage en service**, enregistre.

Écris au bot : `/start` explique les commandes, le reste part à l'agent.

## Dans le chat

| Commande      | Effet                                                        |
|---------------|--------------------------------------------------------------|
| `/agents`     | la liste des agents, avec la commande pour passer à chacun   |
| `/agent <id>` | ce chat parle désormais à cet agent (nouvelle conversation)  |
| `/new`        | repart sur une conversation vierge avec le même agent        |
| `/who`        | l'agent et la conversation de ce chat                        |

Chaque chat Telegram garde sa conversation : elle survit aux redémarrages du plugin et
d'Allkin, et se retrouve dans l'historique de l'agent, dans l'interface. Une photo ou un fichier
envoyé au bot est déposé dans le dossier **Upload** de l'agent, qui en est informé.

## Ce qu'il faut savoir

- **Seuls les identifiants listés** peuvent parler au bot ; les autres reçoivent un refus avec
  leur identifiant, pour que tu puisses l'ajouter.
- Les **formulaires** qu'un agent peut demander ne se remplissent pas depuis Telegram : ils
  sont annulés avec un mot d'explication.
- Les validations de commandes depuis Telegram peuvent être coupées dans les réglages : les
  commandes sont alors refusées d'office.
- Le plugin ne parle qu'à `api.telegram.org`, sauf si tu pointes un serveur Bot API à toi.

## Droits

| Droit      | Pourquoi                                                                 |
|------------|--------------------------------------------------------------------------|
| Réseau     | interroger Telegram et y renvoyer les réponses, télécharger les fichiers |
| Agents     | ouvrir une conversation avec un agent par la socket d'Allkin             |
| Fichiers   | déposer les fichiers reçus dans le dossier Upload de l'agent             |
