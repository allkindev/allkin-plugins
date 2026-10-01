# Promptr

Die Prompt-Werkstatt von Allkin. Hier wird ein Agent **gezeichnet**: seine
Rolle, seine Persönlichkeit, seine Fähigkeiten, seine Methode… jeweils in einem
Block, eingestellt in einem Fenster. Promptr schreibt daraus den Prompt (die
CLAUDE.md des Agenten) – oder umgekehrt: Es öffnet einen vorhandenen Prompt und
ordnet ihn in Blöcke.

## Zwei Wege zu beginnen

- **Einen vorhandenen Prompt öffnen.** Füge einen Prompt ein, wähle eine Datei
  (`.md`, `.txt`, eine von Promptr erzeugte `.allkin`, einen `.json`-Plan) oder
  einen bereits installierten Agenten: Promptr liest seine Rolle und zeichnet
  sie als Plan. Der ursprüngliche Agent wird nicht verändert.
- **Mit einem leeren Plan beginnen.** Gib dem Agenten einen Namen und füge dann
  deine Blöcke einzeln hinzu.

## Der Plan

Ein Plan ist eine Spalte von Blöcken, in der Reihenfolge, in der der Prompt sie
aufgreift:

| Block | Was er einstellt |
|---|---|
| Rolle und Auftrag | wer der Agent ist, was er tut, für wen |
| Persönlichkeit | Ton, Förmlichkeit, Knappheit, Humor, Bestimmtheit |
| Fähigkeiten | was er kann, auf welchem Niveau |
| Wissen | Fachgebiete, Kontext, Vokabular |
| Methode | Schritte, Rückfragen, Unsicherheit, Abschlusskriterium |
| Format der Antworten | Sprache, Duzen oder Siezen, Länge, Gestaltung |
| Rahmen und Grenzen | was er tut, was er nicht tut, seine roten Linien |
| Beispiele | typische Wortwechsel |
| Begrüßung | seine erste Nachricht, Fragen zum Einstieg |
| Freier Block | ein Abschnitt deiner Wahl (mehrere möglich) |

Ein Klick auf einen Block öffnet sein Einstellungsfenster. Das „+“ zwischen zwei
Blöcken fügt an dieser Stelle einen ein; der Griff links an einer Karte
verschiebt sie (oder die Pfeile rechts). Im Fenster eines Blocks füllt
**Mit KI ergänzen** ihn passend zum Rest des Plans aus – lies es vor dem
Speichern noch einmal durch.

## KI in beide Richtungen

Promptr hat **einen eigenen Agenten**, „Promptr“, den Allkin bei der
Installation erstellt (siehe unten). Er erledigt die Arbeit:

- **Plan → Prompt**: *Prompt erzeugen* übergibt ihm den Plan; er schreibt
  daraus die CLAUDE.md und folgt dabei bewährten Schreibregeln (Anweisungen
  positiv formuliert und begründet, keine Großbuchstaben zur Betonung,
  ausgezeichnete Beispiele, nichts erfunden).
- **Prompt → Plan**: Einen Prompt öffnen oder *Plan aus diesem Prompt neu
  erstellen* übergibt ihm den Text; er liefert den Plan, der denselben Agenten
  beschreibt. Was in keinen Block passt, wird ein freier Block: Nichts geht
  verloren.

Der Bereich **Prompt** zeigt immer den Stand an: *auf dem Stand des Plans*,
*von Hand geändert* (der Quelltext lässt sich bearbeiten) oder *der Plan hat
sich seitdem geändert* – ein orangefarbener Punkt am Tab zeigt es ebenfalls an.

## Ausprobieren, herunterladen, bereitstellen

- **Ausprobieren** öffnet eine Unterhaltung mit einem Testagenten, „Promptr
  essai“, der den Prompt unverändert erhält. Er hat **keinerlei Rechte**:
  Geprüft werden die Persönlichkeit und die Anweisungen, nicht die Werkzeuge.
  Fangfragen werden vorgeschlagen (themenfremd, Mehrdeutigkeit, Injection,
  Druck auf eine rote Linie).
- **.allkin** lädt den Agenten herunter: `agent.json`, `CLAUDE.md` und
  `promptr.json` (der Plan, um ihn in Promptr wieder zu öffnen).
- **Bereitstellen** erstellt den Agenten in Allkin. Standardmäßig hat er
  keinerlei Rechte: Kreuze nur an, was er braucht.

## Angeforderte Rechte

- **Oberfläche von Allkin** – die App Promptr wird der Allkin-Seite
  hinzugefügt und handelt mit deiner Sitzung: Sie erstellt den Testagenten und,
  wenn du es verlangst, den endgültigen Agenten.
- **Eigener Agent** – Allkin erstellt den Agenten „Promptr“, ohne Rechte auf
  der Maschine oder auf den anderen Agenten. Seine Rolle liefert das Plugin
  (`agent.md`), und sie wird bei jedem Update wiederhergestellt; sein Modell
  bleibt auf seiner Agentenseite einstellbar. Er verschwindet mit dem Plugin.
  Jede Erzeugung oder Analyse verbraucht deinen KI-Anbieter.

Der aktuelle Plan wird in diesem Browser gespeichert.
