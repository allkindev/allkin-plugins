# Datei-Explorer

Die Dateien der Agenten in Allkin durchsuchen und verwalten.

## Tab „Dateien“ eines Agenten

Die Ordner-Schaltfläche in der Zeile eines Agenten öffnet seinen Bereich `data/`:

- Navigation durch Ordner (eine Zeile „Übergeordneter Ordner“, um nach oben zu gehen); Sortieren
  nach Name, Größe oder Datum (Spaltenköpfe; auf dem Telefon eine Schaltfläche „Sortieren“);
- **alles geschieht über den Kopf der Seite**, mit Symbol-Schaltflächen: suchen (der Namensfilter
  belegt nur eine Zeile, wenn du ihn öffnest), Dateien hochladen, neuer Ordner, neue Datei,
  Auswahl – das ⋮-Menü von Allkin hat hier nichts anzubieten;
- **ein Symbol pro Typ**: Ordner, Bild, PDF, Archiv, Skript, Code, Daten, Text… der Papierkorb und
  der Ordner `Upload` haben ihr eigenes;
- eine neu angelegte Datei öffnet sich sofort;
- **Hochladen** von Dateien und ganzen Ordnern per Drag and Drop, mit Fortschritt – oder über die
  Dateiauswahl des Systems (Schaltfläche „Hochladen“ im Kopf), der einzige Weg auf dem Telefon;
- **Kontextmenü** (Rechtsklick, langes Drücken oder die Schaltfläche ⋯ jeder Zeile): öffnen,
  herunterladen, auswählen, kopieren, ausschneiden, einfügen, umbenennen, archivieren, entpacken,
  neue Datei, neuer Ordner, hochladen, löschen;
- **Mehrfachauswahl**: Schaltfläche „Auswahl“ im Kopf oder „Auswählen“ auf einem Element. Dann
  erscheint eine Leiste mit Alle / Herunterladen / Verschieben / Löschen / Fertig – auf dem
  Telefon am unteren Bildschirmrand;
- **Papierkorb**: „Papierkorb leeren“ im Kontextmenü, wenn du darin bist;
- alle Bestätigungen und Eingaben laufen über die Fenster von Allkin, und jede Aktion antwortet
  mit einer Blase;
- zip/tar-**Archive** und Herunterladen eines Ordners als zip;
- **Ausführen von `.sh`-Skripten**, nachdem ihr Inhalt gelesen wurde, mit der Ausgabe live;
- **Papierkorb**: Gelöschtes wandert nach `Trash/`, das sich separat leeren lässt.

Ein Klick auf eine Datei öffnet sie im Plugin *Texteditor*, wenn es installiert ist, und lädt sie
sonst herunter.

## Explorer von `~/.allkin`

Von der Startseite aus ein **schreibgeschützter** Gang durch den Installationsordner von Allkin:
Agenten, Sitzungen, Sicherungen. Geheimnisse sind dort nicht lesbar.

## Ohne dieses Plugin

Kein Tab Dateien und kein Explorer mehr: Die Ordner-Schaltfläche der Agenten und die Schaltfläche
„Explorer“ der Startseite verschwinden. Die Agenten selbst behalten den Zugriff auf ihre Dateien
gemäß ihren Rechten.

## Angefordertes Recht

- **Oberfläche von Allkin** – das Plugin läuft in der Seite von Allkin, mit deiner Sitzung.
