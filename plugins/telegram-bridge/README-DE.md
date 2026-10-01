# Telegram-Brücke

Sprich von Telegram aus mit deinen Agenten. Ein Bot hört ständig zu (Long Polling: nichts am
Router zu öffnen, keine öffentliche Adresse), leitet jede Nachricht an den gewählten Agenten
weiter und schickt seine Antwort in den Chat zurück. Will der Agent einen Befehl ausführen, kommt
er mit zwei Schaltflächen: **Erlauben** oder **Ablehnen**.

## Einrichtung

1. Schreib in Telegram an **@BotFather**: `/newbot`, ein Name, ein Benutzername. Er gibt dir das
   **Token** des Bots.
2. Füge das Token in die Plugin-Einstellungen ein und trage deine **Telegram-Id** unter
   „Erlaubte Nutzer“ ein (kennst du sie nicht: Schreib dem Bot, er antwortet mit deiner Id, wenn
   sie nicht in der Liste steht; oder frag **@userinfobot**).
3. Wähle den **Standard-Agenten** (seine Id, die aus der URL seiner Seite).
4. Erteile die drei Rechte, hake **Start als Dienst erlauben** an, speichern.

Schreib dem Bot: `/start` erklärt die Befehle, alles andere geht an den Agenten.

## Im Chat

| Befehl        | Wirkung                                                      |
|---------------|--------------------------------------------------------------|
| `/agents`     | die Liste der Agenten, mit dem Befehl zum Wechseln           |
| `/agent <id>` | dieser Chat spricht jetzt mit diesem Agenten (neue Unterhaltung) |
| `/new`        | beginnt eine neue Unterhaltung mit demselben Agenten         |
| `/who`        | Agent und Unterhaltung dieses Chats                          |

Jeder Telegram-Chat behält seine Unterhaltung: Sie übersteht Neustarts des Plugins und von
Allkin und erscheint im Verlauf des Agenten in der Oberfläche. Ein Foto oder eine Datei an den
Bot landet im **Upload**-Ordner des Agenten, der davon erfährt.

## Gut zu wissen

- **Nur die gelisteten Ids** dürfen mit dem Bot sprechen; andere bekommen eine Ablehnung mit
  ihrer Id, damit du sie hinzufügen kannst.
- **Formulare**, die ein Agent anfordern kann, lassen sich aus Telegram nicht ausfüllen: Sie
  werden mit einer Erklärung abgebrochen.
- Freigaben aus Telegram lassen sich in den Einstellungen abschalten: Befehle werden dann sofort
  abgelehnt.
- Das Plugin spricht nur mit `api.telegram.org`, es sei denn, du zeigst auf einen eigenen
  Bot-API-Server.

## Rechte

| Recht      | Warum                                                                   |
|------------|-------------------------------------------------------------------------|
| Netzwerk   | Telegram abfragen und Antworten zurückschicken, Dateien laden           |
| Agenten    | eine Unterhaltung mit einem Agenten über die Socket von Allkin öffnen   |
| Dateien    | empfangene Dateien im Upload-Ordner des Agenten ablegen                 |
