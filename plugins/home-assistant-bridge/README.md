# Pont Home Assistant

Tes agents réagissent à ce qui se passe dans la maison. Le plugin reste connecté au websocket de
Home Assistant et applique des **règles** : quand telle entité passe dans tel état (ou quand tel
événement survient), il réveille l'agent de ton choix avec le message que tu as écrit. La réponse
de l'agent revient dans Home Assistant, en notification persistante ou sur ton téléphone.

## Mise en route

1. Dans Home Assistant : **Profil → Sécurité → Jetons d'accès longue durée → Créer un jeton**.
2. Colle l'adresse de Home Assistant et le jeton dans les réglages du plugin.
3. Écris tes règles, une par ligne.
4. Accorde les deux droits, coche **Autoriser le démarrage en service**, enregistre.

## Les règles

```
binary_sensor.porte_entree => on -> administrateur : La porte d'entrée vient de s'ouvrir, vérifie les caméras.
sensor.temperature_exterieure -> meteo : Il fait maintenant {state} °C dehors.
light.* => on -> majordome : {name} vient de s'allumer.
event:zha_event -> administrateur : Événement Zigbee : {data}
# une ligne qui commence par # est ignorée
```

| Forme                          | Déclenche                                             |
|--------------------------------|-------------------------------------------------------|
| `entité => état -> agent : …`  | quand l'entité prend cet état                         |
| `entité -> agent : …`          | à chaque changement d'état de l'entité                |
| `domaine.* …`                  | toutes les entités du domaine (`*` partout dans l'id) |
| `event:type -> agent : …`      | à chaque événement de ce type                         |

Dans le message : `{entity}` (l'identifiant), `{name}` (le nom affiché), `{state}`, `{old}`
(l'état précédent), `{attrs}` (les attributs en JSON), `{data}` (les données de l'événement en
JSON). L'agent reçoit le message tel quel : écris-le comme une consigne.

## Ce qu'il faut savoir

- **Une conversation par agent**, conservée d'un réveil à l'autre et visible dans son
  historique : l'agent garde le fil de ce qui s'est passé.
- **Le délai minimum** entre deux réveils d'une même règle évite qu'un capteur bavard réveille
  l'agent en boucle (60 s par défaut).
- Un agent réveillé **ne peut pas faire valider une commande** : personne n'est là pour
  répondre. Elle est refusée et la notification le dit. Donne-lui des commandes en liste blanche
  si tu veux qu'il agisse.
- Pour agir en retour sur la maison (allumer, fermer, lire un état), donne à l'agent le service
  **Home Assistant** d'Allkin.

## Droits

| Droit   | Pourquoi                                                              |
|---------|-----------------------------------------------------------------------|
| Réseau  | rester connecté au websocket de Home Assistant, renvoyer les réponses |
| Agents  | réveiller l'agent d'une règle par la socket d'Allkin                  |
