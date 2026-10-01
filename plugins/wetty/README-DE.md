# WeTTY

Ein Terminal im Browser: [WeTTY](https://github.com/butlerx/wetty) öffnet eine SSH-Sitzung und
zeigt sie in einem Tab von Allkin an. Praktisch vom Telefon aus oder an einem Rechner ohne
SSH-Client.

## Erste Schritte

1. Die drei Rechte gewähren (warum, steht weiter unten).
2. Die Einstellungen prüfen: Standardmäßig verbindet sich das Terminal per SSH mit der Maschine
   von Allkin (`localhost:22`) und fragt nach dem Benutzernamen, dann nach dem Passwort.
3. **Start als Dienst erlauben** ankreuzen, dann speichern.
4. **Seite öffnen**.

Beim **ersten Start** wird WeTTY von npm heruntergeladen und sein natives Modul `node-pty` für
die Maschine kompiliert: Rechne mit zehn Sekunden bis einer Minute. Das Protokoll des Dienstes
zeigt den Fortschritt; solange das nicht abgeschlossen ist, antwortet die Seite „Das Plugin
antwortet nicht“ – lade sie danach neu. Die folgenden Starts erfolgen sofort.

## Warum SSH, selbst zur lokalen Maschine

WeTTY öffnet eine lokale Shell nur dann direkt, wenn es als root läuft, was bei Allkin nicht der
Fall ist. Es geht deshalb über den SSH-Server, was einen Vorteil hat: **Das Öffnen des Terminals
verlangt die Zugangsdaten des Systems**, zusätzlich zur Allkin-Sitzung. Der SSH-Server muss
installiert sein und die gewählte Authentifizierung akzeptieren
(`sudo apt install openssh-server` unter Debian/Ubuntu).

## Einstellungen

| Einstellung            | Rolle                                                             |
|------------------------|-------------------------------------------------------------------|
| Lokaler Port           | Port, auf dem WeTTY auf `127.0.0.1` lauscht (Standard 9310)       |
| SSH-Server             | Die Maschine, auf der das Terminal geöffnet wird (Standard `localhost`) |
| SSH-Port               | Standard 22                                                       |
| SSH-Benutzer           | Leer: wird bei jedem Öffnen abgefragt                             |
| Authentifizierung      | Passwort, oder Schlüssel, dann Passwort                           |
| Privater SSH-Schlüssel | Pfad eines Schlüssels. Ohne Passphrase wird nichts mehr abgefragt: Dann schützt nur noch die Allkin-Sitzung das Terminal |
| Titel                  | Der Titel des Terminalfensters                                    |

## Angeforderte Rechte

- **Netzwerk** – Herunterladen von WeTTY von npm, Lauschen auf dem lokalen Port, SSH-Verbindung.
- **Systembefehle** – npm bei der Installation, dann ssh; und das Terminal führt aus, was du
  eingibst.
- **Dateien außerhalb seines Ordners** – ein Terminal sieht alles, was das angemeldete Konto sieht.

## Details

- WeTTY wird im Datenordner des Plugins (`runtime/`) installiert, der bei Aktualisierungen des
  Plugins erhalten bleibt. Das Löschen dieses Ordners erzwingt eine Neuinstallation beim nächsten
  Start.
- Die Seite wird unter `/plugins/wetty/web` (Option `--base`) ausgeliefert und von Allkin
  weitergeleitet, WebSocket inbegriffen: Sie ist nie direkt im Netzwerk erreichbar.
