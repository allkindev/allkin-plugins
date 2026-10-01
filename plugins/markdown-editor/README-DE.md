# Markdown-Editor

Der Markdown-Editor von Allkin. Du schreibst **im formatierten Dokument**: Eine Überschrift ist eine
Überschrift, eine Tabelle ist eine Tabelle, und kein Tag (`**`, `#`, `|`…) erscheint auf dem
Bildschirm. Die Datei selbst bleibt gewöhnliches Markdown.

## Wo er verwendet wird

- **Missionen** – der Text jeder Karte.
- **Rolle eines Agenten** – der Abschnitt „Rolle“ seiner Seite und das Schreiben der Rolle im
  Assistenten zum Erstellen eines Agenten.
- **`.md`-Dateien** – mit dem Plugin *Texteditor*, das ihn für Markdown-Dateien verwendet.

## Die Werkzeugleiste

| Gruppe | Was du dort findest |
| --- | --- |
| Verlauf | Rückgängig, wiederholen |
| Blockstil | Text, Überschrift 1, Überschrift 2, Überschrift 3 – die Schaltfläche sagt immer, wo du bist |
| Text | Fett, kursiv, durchgestrichen, Code, Link |
| Listen | Aufzählungszeichen, Nummern, Kästchen zum Abhaken |
| Blöcke | Zitat, Codeblock, Tabelle, Trennlinie |
| Medien | Bild, angehängte Datei |
| Markdown-Quelltext | Der Text, wie er in der Datei steht |

Die Schaltflächen leuchten je nachdem, wo der Cursor steht. Wenn du mit der Maus über eine
Schaltfläche fährst, siehst du ihren Namen und ihr Tastenkürzel.

## Schneller schreiben

- **`/`** am Zeilenanfang öffnet das Menü der Blöcke: Du tippst ein paar Buchstaben, dann <kbd>Eingabe</kbd>.
- Wenn du Markdown kennst, kannst du es weiter tippen – `# `, `- `, `1. `, `[] `, `> `, `**fett**`,
  `` `Code` ``, `[Text](Adresse)`… werden sofort umgewandelt. `---` und dann <kbd>Eingabe</kbd> setzt
  eine Trennlinie, ` ``` ` und dann <kbd>Eingabe</kbd> öffnet einen Codeblock.
- Eingefügtes Markdown oder ein von einer Webseite kopierter Abschnitt behält seine Formatierung.

| Tastenkürzel | Wirkung |
| --- | --- |
| <kbd>Strg</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>E</kbd> | Fett, kursiv, Code |
| <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>X</kbd> | Durchgestrichen |
| <kbd>Strg</kbd>+<kbd>K</kbd> | Link |
| <kbd>Strg</kbd>+<kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>3</kbd>, <kbd>0</kbd> | Überschrift 1 bis 3, Text |
| <kbd>Strg</kbd>+<kbd>Z</kbd>, <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>Z</kbd> | Rückgängig, wiederholen |
| <kbd>Tab</kbd>, <kbd>Umschalt</kbd>+<kbd>Tab</kbd> | Einen Listeneintrag ein- oder ausrücken; nächste oder vorherige Zelle |
| <kbd>Strg</kbd>+<kbd>Eingabe</kbd> | Eine Zeile unter dem aktuellen Block öffnen |

(<kbd>⌘</kbd> statt <kbd>Strg</kbd> auf dem Mac.)

## Tabellen

Die Schaltfläche Tabelle öffnet ein Raster: Du wählst die Größe, indem du mit der Maus darüberfährst.
In der Tabelle geht <kbd>Tab</kbd> zur nächsten Zelle und fügt am Ende eine Zeile hinzu;
<kbd>Eingabe</kbd> geht eine Zeile nach unten und **verlässt in der letzten die Tabelle**, um
darunter weiterzuschreiben. Die Schaltfläche **⋯** der aktuellen Zelle fügt Zeilen und Spalten ein
oder entfernt sie, richtet die Spalte aus, löscht die Tabelle.

## Links, Bilder, Dateien

- **Link** – markiere Text und drücke <kbd>Strg</kbd>+<kbd>K</kbd>, oder füge eine Adresse über der
  Auswahl ein. Steht der Cursor in einem Link, erscheint seine Adresse, mit allem, um sie zu öffnen,
  zu ändern oder zu entfernen.
- **Bild** – über die Schaltfläche Bild, indem du es **in den Text ziehst** (eine Markierung zeigt,
  wo es landet) oder es einfügst. Ein Klick auf das Bild lässt dich seine Beschreibung schreiben
  oder es löschen.
- **Datei** – die Büroklammer, oder Ziehen und Ablegen: Die Datei wird abgelegt und ein Link zu ihr
  in den Text gesetzt.

In einer **`.md`-Datei** werden Bilder und Dateien neben dem Dokument abgelegt (`images/`,
`fichiers/`). Anderswo – Mission, Rolle eines Agenten – wird ein Bild über seine Webadresse
hinzugefügt, und eine auf einer Mission abgelegte Datei wird ihr wie bisher angehängt.

Ein **entferntes Bild**, das in einem Text gefunden wird, bleibt ausgeblendet, solange du nicht
verlangt hast, es zu sehen: Es anzuzeigen heißt, eine Anfrage an seinen Server zu senden, und ein
von einem Agenten geschriebener Text könnte das nutzen, um eine Information nach außen zu bringen.
Die Server, die du akzeptierst, werden gemerkt.

## Die Datei bleibt deine

Nur die Blöcke, die du änderst, werden neu geschrieben: Ein Wort zu korrigieren formatiert den Rest
des Dokuments nicht um. Die Schaltfläche **Markdown-Quelltext** zeigt den genauen Text der Datei
und lässt dich ihn von Hand korrigieren.

## Ohne dieses Plugin

Diese Bearbeitungen gibt es dann nicht mehr: weder Missionen noch den Abschnitt „Rolle“ (die
`CLAUDE.md` eines Agenten bleibt an ihrem Platz und wird weiter verwendet, sie lässt sich nur nicht
mehr über die Oberfläche ändern), und `.md`-Dateien öffnen sich als reiner Text. Die Anzeige der
Nachrichten der Agenten hängt nicht von diesem Plugin ab.

## Für die anderen Plugins

```js
const editor = Allkin.capability("markdown-editor").create({
  host,        // das Element, das das Dokument aufnimmt
  toolbar,     // das Element, das die Werkzeugleiste aufnimmt (optional)
  spellcheck,  // Rechtschreibprüfung des Browsers
  doc: { getContent: () => text, setContent: (next) => { text = next; } },
  files: {     // optional: wo Bilder und Dateien abgelegt werden
    upload: async (file) => ({ src: "images/photo.png", name: file.name }),
    resolve: (src, usage) => "/adresse/zum/lesen/" + src,   // usage: "image" oder "open"
  },
});
editor.render();   // dann reload(), focus("start" | "end"), isFocused(), destroy()
```

## Angefordertes Recht

- **Oberfläche von Allkin** – das Plugin läuft in der Seite von Allkin, mit deiner Sitzung.
