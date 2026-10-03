# Recordr

Écoute le micro de l'appareil sur lequel Allkin est ouvert, écrit ce qui se dit au fil de la parole
et sépare les interlocuteurs : un bloc par prise de parole, une couleur par voix. La reconnaissance
est faite par un **service audio** connecté à Allkin — aujourd'hui [Soniox](https://soniox.com),
un service en ligne payant à l'usage.

## Mise en route

1. **Services › Ajouter › Soniox** : coller la clé API créée sur
   [console.soniox.com](https://console.soniox.com). C'est le même geste que pour un service
   d'images : la clé est gardée par Allkin, pas par le plugin.
2. Sur la page du plugin, accorder le droit **Réseau**, choisir ce service dans **Service audio**
   et la **langue parlée** (indiquée, elle améliore la reconnaissance).
3. Cocher **Autoriser le démarrage en service**, puis enregistrer.
4. **Ouvrir la page**, appuyer sur **Écouter** et autoriser le micro quand le navigateur le demande.

## Le micro demande HTTPS

Un navigateur ne donne le micro qu'à une page servie en **HTTPS** (ou sur `localhost`). Allkin ouvert
par `http://192.168.x.x:9191` ne l'obtiendra pas : il faut passer par son adresse HTTPS
(`tailscale serve`, Caddy…). La page le dit quand c'est le cas.

## Ce que fait la page

- **Écouter / Pause / Arrêter** — le texte arrive mot à mot. Les mots en gris ne sont pas encore
  définitifs : le service peut les corriger pendant une seconde ou deux. La pastille à côté des
  boutons dit où en est l'écoute, avec sa durée et le niveau du micro. **Pause** garde la connexion
  (et la numérotation des voix) ; après dix minutes de pause elle est relâchée, et la reprise en
  ouvre une nouvelle.
- **L'écoute continue en arrière-plan** — on peut passer à un autre onglet d'Allkin, à un autre
  onglet du navigateur ou à une autre fenêtre : la capture et l'envoi ne dépendent pas de la page
  affichée. Le navigateur demande confirmation avant de fermer ou de recharger l'onglet pendant une
  écoute.
- **Reconnexion automatique** — si la connexion au service audio tombe, la page la rétablit seule
  (pendant cinq minutes au plus) et garde jusqu'à vingt secondes d'audio en attendant. Un trait
  « Reprise de l'écoute » marque l'endroit : le service renumérote alors les voix, qui reçoivent
  de nouveaux numéros.
- **Interlocuteurs** — le service distingue les voix ; il ne sait pas qui parle. Un clic sur
  « Interlocuteur 1 », dans le texte ou dans le panneau de droite, lui donne son vrai nom partout.
  Le panneau montre le temps de parole de chacun et sa part du total.
- **Titre**, **Copier**, **Télécharger (.md)** — la transcription s'exporte en Markdown, avec les noms
  et l'horodatage de chaque prise de parole.
- **Historique** — chaque écoute est enregistrée sur la machine d'Allkin, au fil de l'eau
  (`plugin-data/recordr/data/transcripts/`). On la retrouve par son titre, on la rouvre, on la
  renomme, on la supprime.

Appuyer sur **Écouter** alors qu'une transcription est affichée en commence une nouvelle.

## Où va l'audio, où reste la clé

La clé du service audio ne quitte pas Allkin. À chaque écoute, la page demande à Allkin une
**clé temporaire** (deux minutes, le temps d'ouvrir la connexion) ; l'audio part ensuite du
navigateur directement chez le service, sans passer par la machine d'Allkin. Le plugin lui-même
ne voit aucune clé : son service ne fait que servir la page et garder les transcriptions.

## Limites

- **Fermer l'onglet du plugin dans Allkin, ou recharger la page, arrête l'écoute.** Ce qui était
  transcrit est déjà enregistré.
- **Un seul micro pour plusieurs personnes** : quand on se coupe la parole ou qu'on est loin du
  micro, l'attribution se trompe. Un micro de table posé au milieu aide beaucoup.
- **Sur un téléphone**, l'écran doit rester allumé et le navigateur au premier plan : la page
  demande au système de ne pas verrouiller l'écran, mais il peut refuser en mode économie d'énergie,
  et un téléphone coupe le micro d'un navigateur passé en arrière-plan. Au retour, la page reprend
  l'écoute d'elle-même quand le système le permet.
- **Soniox facture la durée de la connexion**, pause comprise (d'où le relâchement après dix
  minutes), et une connexion dure cinq heures au plus ; au-delà, la page en rouvre une.
- **Confidentialité** : l'audio part chez le service audio, depuis le navigateur. Enregistrer des
  personnes suppose leur accord.

## Réglages

| Réglage | Rôle |
|---|---|
| Port local | Port du service sur `127.0.0.1` ; à changer seulement s'il est déjà pris. |
| Service audio | Le service connecté qui transcrit (ajouté dans **Services**). Obligatoire. |
| Langue parlée | Français, anglais, espagnol, allemand, ou automatique. |
| Modèle | Vide = le modèle temps réel par défaut du service ; sinon son nom exact. |

## Droit demandé

**Réseau** — le service écoute sur un port local, pour servir sa page dans Allkin.
