# Texteditor

Öffnet eine Datei aus dem Ordner eines Agenten in einem eigenen Tab.

## Code-Editor

Jede Textdatei wird im Code-Editor geöffnet – **80 Sprachen mit Hervorhebung** (JavaScript,
TypeScript, Python, PHP, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, SQL, YAML, JSON,
HTML/XML, CSS/SCSS, Shell, PowerShell, Dockerfile, Makefile, Nginx, LaTeX…), durch highlight.js.

- **Sprache**: am Namen der Datei erkannt (Endung, `Dockerfile`, `Makefile`, `.env`…) oder,
  wenn das nicht geht, am Inhalt erraten. Mit der Auswahl in der Kopfzeile lässt sie sich **von
  Hand wählen**; die Wahl wird für diese Datei auf diesem Gerät behalten. „Nur Text“ schaltet
  die Hervorhebung aus.
- **Zeilennummern**, automatischer Zeilenumbruch (Schaltfläche; bei reinem Text von vornherein
  aktiv), einstellbare Schriftgröße, Vollbild.
- **Suchen und ersetzen** (Strg+F, Strg+H): nächster/vorheriger Treffer, Groß-/Kleinschreibung
  beachten, einen oder alle ersetzen; **gehe zu Zeile** (Strg+G).
- **Code schreiben**: Tab / Umschalt+Tab rücken die Auswahl ein (erkannte Einheit: Tabulator oder
  Leerzeichen), die Eingabetaste behält die Einrückung bei und öffnet einen Block nach `{`, `[`,
  `(` oder `:`, Strg+/ kommentiert oder entfernt den Kommentar (Syntax der Sprache), Strg+D
  dupliziert die Zeile, Strg+S speichert sofort. Rückgängig (Strg+Z) bleibt das des Browsers.
- **Statusleiste**: Zeile und Spalte, Anzahl der Zeilen, Einrückung, Sprache.
- **Speichern beim Tippen** – keine Schaltfläche „Speichern“.

## Markdown, Bilder, PDF

- **Markdown** wird formatiert geöffnet; „Bearbeiten“ wechselt in den Markdown-Editor, wenn das
  Plugin *Markdown-Editor* installiert ist, sonst in den Code-Editor. Bilder und Dateien, die
  man dort hinzufügt, werden neben dem Dokument abgelegt, in `images/` und `fichiers/`.
- **Bilder und PDF**: ein einfacher Betrachter.
- Inhalt oder Pfad kopieren, Datei herunterladen.

Bis zu sechs geöffnete Dateien pro Agent: darüber hinaus wird die älteste geschlossen (nach dem
Speichern).

## Für die anderen Plugins

Die Fähigkeit `code-highlight`: `highlight(text, sprache)`, `languageForFilename(name)`,
`languages()`. Der Explorer nutzt sie, um ein Skript zu zeigen, bevor er es ausführt.

`hljs.js` wird aus `node_modules/highlight.js` des Repositorys allkin mit
`scripts/hljs-entry.mjs` gebaut (der Befehl steht am Anfang der Datei).

## Ohne dieses Plugin

Kein Datei-Tab mehr: Ein Klick auf eine Datei im Explorer lädt sie herunter.

## Angefordertes Recht

- **Allkin-Oberfläche** – das Plugin läuft in der Allkin-Seite, mit deiner Sitzung.
