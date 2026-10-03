# Creator

Die Plugin-Werkstatt von Allkin. Du beschreibst, was du willst; der Agent **Creator** schreibt
das Plugin oder den Dienst; die **Werkbank** prüft es, installiert es in dein Allkin und hilft
dir beim Debuggen.

## Wozu es dient

- **Ein Plugin erstellen**: ein dauerhaft laufendes Programm, eine Seite, ein Stück der
  Allkin-Oberfläche, ein eigener Agent — oder mehrere zugleich.
- **Einen Dienst erstellen**: Allkin beibringen, eine externe API zu erreichen, damit deine
  Agenten sie mit deinem Schlüssel aufrufen.

Alles, was Creator schreibt, hält den **Allkin-Standard** ein, der mit dem Plugin geliefert wird
(`standard/PLUGIN-STANDARD.md` und `standard/SERVICE-STANDARD.md`) und von der Schaltfläche
**Prüfen** kontrolliert wird.

## Erste Schritte

1. Installiere Creator und gewähre auf seiner Seite seine vier Rechte. In diesem Moment werden
   der Agent Creator und dein lokales Repository angelegt.
2. Lade die Seite neu und öffne **Creator** im Allkin-Menü (Liste Plugins).
3. Klicke auf **Neu**, wähle *Plugin* oder *Dienst*, vergib einen Namen und beschreibe den Bedarf.
4. Die Unterhaltung mit dem Agenten öffnet sich rechts. Beantworte seine Fragen; er schreibt die
   Dateien.

## Die Werkbank

**Oben**: das angezeigte Projekt (Auswahlliste), **Neu** und **Unterhaltung**, um das Gespräch
mit dem Agenten wieder zu öffnen.

**Der Zustand des Projekts**: seine Version, ob es in deinem Allkin installiert ist, der Zustand
seines Dienstes und das Urteil der Prüfung (konform, Fehler, Warnungen).

**Die Aktionen**:

| Schaltfläche | Wirkung |
|--------------|---------|
| Prüfen | Prüft das Projekt gegen den Standard |
| Installieren / Neu installieren | Kopiert das Plugin aus deinem Repository nach Allkin. Gesperrt, solange ein Fehler bleibt |
| Seite des Plugins | Öffnet seine Allkin-Seite: zu gewährende Rechte, Einstellungen, Protokoll |
| Starten / Neu starten / Stoppen | Steuert den Dienst des Plugins |
| Seite neu laden | Lädt die Oberfläche eines frisch installierten Oberflächen-Plugins |
| Dienste öffnen | Für einen Dienst: Er steht schon im Katalog, er muss nur verbunden werden |

**Den Agenten bitten**: Schaltflächen, die eine Anweisung zum angezeigten Projekt senden — die
Probleme der Prüfung beheben, Übersetzungen ergänzen, die Dokumentation schreiben, den Code
durchsehen, das Projekt erklären.

**Die drei Bereiche**:

- **Prüfung** — die Liste der Abweichungen vom Standard. Rot: Allkin würde das Plugin ablehnen,
  oder es würde im Betrieb brechen. Orange: Der Standard verlangt es.
- **Dateien** — die Dateien des Projekts; ein Klick öffnet die Datei im Editor. Was der Agent
  gerade geschrieben hat, ist hervorgehoben.
- **Debug** — das Protokoll des Dienstes und die Fehler, die seit dem Laden in der Seite
  aufgefangen wurden. **An den Agenten senden** übergibt ihm alles, damit er die Ursache findet.

## Wo deine Dateien liegen

Im Arbeitsordner des Agenten: `~/.allkin/plugin-data/creator/workspace/`, mit einem Ordner
`plugins/` und einem Ordner `services/`. Dieser Ordner ist ein **lokales Repository**: Er
erscheint im Fenster *Repositories* der Seiten Plugins und Dienste, und deine Kreationen stehen
dort mit dem Etikett „Creator“.

Dieser Ordner wird **nicht gelöscht**, wenn du Creator deinstallierst. Um eine Kreation zu
veröffentlichen, kopiere ihren Ordner in dein Plugin-Repository.

## Die verlangten Rechte

| Recht | Warum |
|-------|-------|
| Oberfläche | Die Werkbank zur Allkin-Seite hinzufügen; mit deiner Sitzung Projekte anlegen, deine Plugins installieren und ihren Dienst steuern |
| Eigener Agent | Der Agent Creator, der die Dateien schreibt. Er hat außerhalb seines Arbeitsordners keinen Zugriff auf den Rechner |
| Repository | Den Arbeitsordner zu einer Quelle für Plugins und Dienste dieses Allkin machen |
| Netzwerk | Dem Agenten erlauben, die Online-Dokumentation von APIs zu lesen |

## Wenn es nicht funktioniert

- **„Sein Agent existiert noch nicht“**: Ein Recht ist nicht gewährt. Öffne die Seite des Plugins.
- **Installieren ist ausgegraut**: Die Prüfung hat einen Fehler gefunden. Klicke auf *Probleme
  beheben*.
- **Neu installieren bringt nichts**: Die Version hat sich nicht geändert. Die Prüfung meldet es;
  bitte den Agenten, sie zu erhöhen.
- **Die Oberfläche des Plugins erscheint nicht**: Gewähre seine Rechte auf seiner Seite und lade neu.
- **Der Agent antwortet nicht**: Prüfe deinen KI-Anbieter in den Einstellungen von Allkin.
