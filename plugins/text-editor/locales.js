"use strict";
/* ============================================================================
   Text editor plugin — dictionaries.
   ----------------------------------------------------------------------------
   Loaded first by the host (a plugin script named locales.js), before the
   markup and the other scripts. One call per language: en (default and
   fallback), fr, es, de. Same keys and same {variables} in the four.
   Names of programming languages are proper names and are not listed here;
   only the few descriptive labels of the language selector are.
   ========================================================================== */

window.Allkin.i18n.register("en", {
  // Header: path, mode, full screen
  "plugin.text-editor.path.copy": "Copy the path",
  "plugin.text-editor.mode.edit": "Edit",
  "plugin.text-editor.mode.preview": "Preview",
  "plugin.text-editor.fullscreen.enter": "Full screen",
  "plugin.text-editor.fullscreen.exit": "Exit full screen",
  // Toolbar of the code editor
  "plugin.text-editor.toolbar.language": "Highlighting language",
  "plugin.text-editor.toolbar.find": "Find and replace (Ctrl+F)",
  "plugin.text-editor.toolbar.findLabel": "Find and replace",
  "plugin.text-editor.toolbar.goto": "Go to line (Ctrl+G)",
  "plugin.text-editor.toolbar.comment": "Comment / uncomment (Ctrl+/)",
  "plugin.text-editor.toolbar.commentLabel": "Comment or uncomment",
  "plugin.text-editor.toolbar.wrap": "Word wrap",
  "plugin.text-editor.toolbar.fontSmaller": "Smaller font",
  "plugin.text-editor.toolbar.fontLarger": "Larger font",
  // Language selector
  "plugin.text-editor.language.auto": "Auto — {language}",
  "plugin.text-editor.language.chosen": "Language chosen by hand: {language}",
  "plugin.text-editor.language.detected": "Detected language: {language}",
  "plugin.text-editor.language.toastChosen": "Highlighting: {language}.",
  "plugin.text-editor.language.toastAuto": "Automatic highlighting: {language}.",
  // Descriptive labels of the language selector (proper names are not translated)
  "plugin.text-editor.lang.plaintext": "Plain text",
  "plugin.text-editor.lang.shell": "Shell session",
  "plugin.text-editor.lang.phpTemplate": "PHP (template)",
  "plugin.text-editor.lang.x86asm": "x86 assembly",
  "plugin.text-editor.lang.dns": "DNS zone",
  "plugin.text-editor.lang.accesslog": "Access log",
  // Find and replace
  "plugin.text-editor.find.case": "Match case",
  "plugin.text-editor.find.previous": "Previous (Shift+Enter)",
  "plugin.text-editor.find.previousLabel": "Previous match",
  "plugin.text-editor.find.next": "Next (Enter)",
  "plugin.text-editor.find.nextLabel": "Next match",
  "plugin.text-editor.find.replaceWith": "Replace with",
  "plugin.text-editor.find.replaceAll": "All",
  "plugin.text-editor.find.close": "Close (Esc)",
  "plugin.text-editor.find.closeLabel": "Close the search",
  "plugin.text-editor.find.none": "No match.",
  "plugin.text-editor.find.replaced.one": "{count} match replaced.",
  "plugin.text-editor.find.replaced.other": "{count} matches replaced.",
  // Go to line
  "plugin.text-editor.goto.title": "Go to line",
  "plugin.text-editor.goto.ok": "Go",
  "plugin.text-editor.goto.range": "1 to {total}",
  "plugin.text-editor.goto.promptFallback": "Line (1 to {total}):",
  // Comments
  "plugin.text-editor.comment.unknown": "This language has no known comment syntax.",
  // Status bar
  "plugin.text-editor.status.positionStart": "Ln 1, Col 1",
  "plugin.text-editor.status.position": "Ln {line}, Col {column}",
  "plugin.text-editor.status.positionSelection": "Ln {line}, Col {column} ({selected} sel.)",
  "plugin.text-editor.status.lines.one": "{count} line",
  "plugin.text-editor.status.lines.other": "{count} lines",
  "plugin.text-editor.status.tabs": "Tabs",
  "plugin.text-editor.status.spaces": "Spaces: {size}",
  // Floating actions and viewer
  "plugin.text-editor.content.copy": "Copy the content",
  "plugin.text-editor.copy.refused": "Could not copy: the browser refuses access to the clipboard.",
  "plugin.text-editor.media.noPreview": "No preview for this type of file — use the download.",
  // Loading and saving
  "plugin.text-editor.load.failed": "Could not load the file: {message}",
  "plugin.text-editor.upload.errorStatus": "error {status}",
  "plugin.text-editor.save.already": "Already saved.",
  "plugin.text-editor.save.pending": "Changes pending",
  "plugin.text-editor.save.failed": "Saving failed",
  "plugin.text-editor.save.savedAt": "Saved at {time}",
});

window.Allkin.i18n.register("fr", {
  // Header: path, mode, full screen
  "plugin.text-editor.path.copy": "Copier le chemin",
  "plugin.text-editor.mode.edit": "Éditer",
  "plugin.text-editor.mode.preview": "Aperçu",
  "plugin.text-editor.fullscreen.enter": "Plein écran",
  "plugin.text-editor.fullscreen.exit": "Quitter le plein écran",
  // Toolbar of the code editor
  "plugin.text-editor.toolbar.language": "Langage de coloration",
  "plugin.text-editor.toolbar.find": "Rechercher et remplacer (Ctrl+F)",
  "plugin.text-editor.toolbar.findLabel": "Rechercher et remplacer",
  "plugin.text-editor.toolbar.goto": "Aller à la ligne (Ctrl+G)",
  "plugin.text-editor.toolbar.comment": "Commenter / décommenter (Ctrl+/)",
  "plugin.text-editor.toolbar.commentLabel": "Commenter ou décommenter",
  "plugin.text-editor.toolbar.wrap": "Retour à la ligne automatique",
  "plugin.text-editor.toolbar.fontSmaller": "Réduire la police",
  "plugin.text-editor.toolbar.fontLarger": "Agrandir la police",
  // Language selector
  "plugin.text-editor.language.auto": "Auto — {language}",
  "plugin.text-editor.language.chosen": "Langage choisi à la main : {language}",
  "plugin.text-editor.language.detected": "Langage détecté : {language}",
  "plugin.text-editor.language.toastChosen": "Coloration : {language}.",
  "plugin.text-editor.language.toastAuto": "Coloration automatique : {language}.",
  // Descriptive labels of the language selector (proper names are not translated)
  "plugin.text-editor.lang.plaintext": "Texte brut",
  "plugin.text-editor.lang.shell": "Session shell",
  "plugin.text-editor.lang.phpTemplate": "PHP (gabarit)",
  "plugin.text-editor.lang.x86asm": "Assembleur x86",
  "plugin.text-editor.lang.dns": "Zone DNS",
  "plugin.text-editor.lang.accesslog": "Journal d'accès",
  // Find and replace
  "plugin.text-editor.find.case": "Respecter la casse",
  "plugin.text-editor.find.previous": "Précédent (Maj+Entrée)",
  "plugin.text-editor.find.previousLabel": "Occurrence précédente",
  "plugin.text-editor.find.next": "Suivant (Entrée)",
  "plugin.text-editor.find.nextLabel": "Occurrence suivante",
  "plugin.text-editor.find.replaceWith": "Remplacer par",
  "plugin.text-editor.find.replaceAll": "Tout",
  "plugin.text-editor.find.close": "Fermer (Échap)",
  "plugin.text-editor.find.closeLabel": "Fermer la recherche",
  "plugin.text-editor.find.none": "Aucune occurrence.",
  "plugin.text-editor.find.replaced.one": "{count} occurrence remplacée.",
  "plugin.text-editor.find.replaced.other": "{count} occurrences remplacées.",
  // Go to line
  "plugin.text-editor.goto.title": "Aller à la ligne",
  "plugin.text-editor.goto.ok": "Aller",
  "plugin.text-editor.goto.range": "1 à {total}",
  "plugin.text-editor.goto.promptFallback": "Ligne (1 à {total}) :",
  // Comments
  "plugin.text-editor.comment.unknown": "Ce langage n'a pas de commentaire connu.",
  // Status bar
  "plugin.text-editor.status.positionStart": "Ln 1, Col 1",
  "plugin.text-editor.status.position": "Ln {line}, Col {column}",
  "plugin.text-editor.status.positionSelection": "Ln {line}, Col {column} ({selected} sél.)",
  "plugin.text-editor.status.lines.one": "{count} ligne",
  "plugin.text-editor.status.lines.other": "{count} lignes",
  "plugin.text-editor.status.tabs": "Tabulations",
  "plugin.text-editor.status.spaces": "Espaces : {size}",
  // Floating actions and viewer
  "plugin.text-editor.content.copy": "Copier le contenu",
  "plugin.text-editor.copy.refused": "Copie impossible : le presse-papiers est refusé par le navigateur.",
  "plugin.text-editor.media.noPreview": "Aperçu non disponible pour ce type de fichier — utilise le téléchargement.",
  // Loading and saving
  "plugin.text-editor.load.failed": "Impossible de charger le fichier : {message}",
  "plugin.text-editor.upload.errorStatus": "erreur {status}",
  "plugin.text-editor.save.already": "Déjà enregistré.",
  "plugin.text-editor.save.pending": "Modifications en attente",
  "plugin.text-editor.save.failed": "Échec de l'enregistrement",
  "plugin.text-editor.save.savedAt": "Enregistré à {time}",
});

window.Allkin.i18n.register("es", {
  // Header: path, mode, full screen
  "plugin.text-editor.path.copy": "Copiar la ruta",
  "plugin.text-editor.mode.edit": "Editar",
  "plugin.text-editor.mode.preview": "Vista previa",
  "plugin.text-editor.fullscreen.enter": "Pantalla completa",
  "plugin.text-editor.fullscreen.exit": "Salir de la pantalla completa",
  // Toolbar of the code editor
  "plugin.text-editor.toolbar.language": "Lenguaje de resaltado",
  "plugin.text-editor.toolbar.find": "Buscar y sustituir (Ctrl+F)",
  "plugin.text-editor.toolbar.findLabel": "Buscar y sustituir",
  "plugin.text-editor.toolbar.goto": "Ir a la línea (Ctrl+G)",
  "plugin.text-editor.toolbar.comment": "Comentar / descomentar (Ctrl+/)",
  "plugin.text-editor.toolbar.commentLabel": "Comentar o descomentar",
  "plugin.text-editor.toolbar.wrap": "Ajuste de línea automático",
  "plugin.text-editor.toolbar.fontSmaller": "Reducir la fuente",
  "plugin.text-editor.toolbar.fontLarger": "Aumentar la fuente",
  // Language selector
  "plugin.text-editor.language.auto": "Auto: {language}",
  "plugin.text-editor.language.chosen": "Lenguaje elegido a mano: {language}",
  "plugin.text-editor.language.detected": "Lenguaje detectado: {language}",
  "plugin.text-editor.language.toastChosen": "Resaltado: {language}.",
  "plugin.text-editor.language.toastAuto": "Resaltado automático: {language}.",
  // Descriptive labels of the language selector (proper names are not translated)
  "plugin.text-editor.lang.plaintext": "Texto sin formato",
  "plugin.text-editor.lang.shell": "Sesión de shell",
  "plugin.text-editor.lang.phpTemplate": "PHP (plantilla)",
  "plugin.text-editor.lang.x86asm": "Ensamblador x86",
  "plugin.text-editor.lang.dns": "Zona DNS",
  "plugin.text-editor.lang.accesslog": "Registro de acceso",
  // Find and replace
  "plugin.text-editor.find.case": "Distinguir mayúsculas y minúsculas",
  "plugin.text-editor.find.previous": "Anterior (Mayús+Intro)",
  "plugin.text-editor.find.previousLabel": "Coincidencia anterior",
  "plugin.text-editor.find.next": "Siguiente (Intro)",
  "plugin.text-editor.find.nextLabel": "Coincidencia siguiente",
  "plugin.text-editor.find.replaceWith": "Sustituir por",
  "plugin.text-editor.find.replaceAll": "Todo",
  "plugin.text-editor.find.close": "Cerrar (Esc)",
  "plugin.text-editor.find.closeLabel": "Cerrar la búsqueda",
  "plugin.text-editor.find.none": "Ninguna coincidencia.",
  "plugin.text-editor.find.replaced.one": "{count} coincidencia sustituida.",
  "plugin.text-editor.find.replaced.other": "{count} coincidencias sustituidas.",
  // Go to line
  "plugin.text-editor.goto.title": "Ir a la línea",
  "plugin.text-editor.goto.ok": "Ir",
  "plugin.text-editor.goto.range": "1 a {total}",
  "plugin.text-editor.goto.promptFallback": "Línea (1 a {total}):",
  // Comments
  "plugin.text-editor.comment.unknown": "Este lenguaje no tiene una sintaxis de comentario conocida.",
  // Status bar
  "plugin.text-editor.status.positionStart": "Lín. 1, col. 1",
  "plugin.text-editor.status.position": "Lín. {line}, col. {column}",
  "plugin.text-editor.status.positionSelection": "Lín. {line}, col. {column} ({selected} sel.)",
  "plugin.text-editor.status.lines.one": "{count} línea",
  "plugin.text-editor.status.lines.other": "{count} líneas",
  "plugin.text-editor.status.tabs": "Tabulaciones",
  "plugin.text-editor.status.spaces": "Espacios: {size}",
  // Floating actions and viewer
  "plugin.text-editor.content.copy": "Copiar el contenido",
  "plugin.text-editor.copy.refused": "No se pudo copiar: el navegador deniega el acceso al portapapeles.",
  "plugin.text-editor.media.noPreview": "Vista previa no disponible para este tipo de archivo: usa la descarga.",
  // Loading and saving
  "plugin.text-editor.load.failed": "No se pudo cargar el archivo: {message}",
  "plugin.text-editor.upload.errorStatus": "error {status}",
  "plugin.text-editor.save.already": "Ya está guardado.",
  "plugin.text-editor.save.pending": "Cambios pendientes",
  "plugin.text-editor.save.failed": "Error al guardar",
  "plugin.text-editor.save.savedAt": "Guardado a las {time}",
});

window.Allkin.i18n.register("de", {
  // Header: path, mode, full screen
  "plugin.text-editor.path.copy": "Pfad kopieren",
  "plugin.text-editor.mode.edit": "Bearbeiten",
  "plugin.text-editor.mode.preview": "Vorschau",
  "plugin.text-editor.fullscreen.enter": "Vollbild",
  "plugin.text-editor.fullscreen.exit": "Vollbild verlassen",
  // Toolbar of the code editor
  "plugin.text-editor.toolbar.language": "Sprache der Hervorhebung",
  "plugin.text-editor.toolbar.find": "Suchen und ersetzen (Strg+F)",
  "plugin.text-editor.toolbar.findLabel": "Suchen und ersetzen",
  "plugin.text-editor.toolbar.goto": "Gehe zu Zeile (Strg+G)",
  "plugin.text-editor.toolbar.comment": "Kommentieren / Kommentar entfernen (Strg+/)",
  "plugin.text-editor.toolbar.commentLabel": "Kommentieren oder Kommentar entfernen",
  "plugin.text-editor.toolbar.wrap": "Automatischer Zeilenumbruch",
  "plugin.text-editor.toolbar.fontSmaller": "Schrift verkleinern",
  "plugin.text-editor.toolbar.fontLarger": "Schrift vergrößern",
  // Language selector
  "plugin.text-editor.language.auto": "Auto – {language}",
  "plugin.text-editor.language.chosen": "Von Hand gewählte Sprache: {language}",
  "plugin.text-editor.language.detected": "Erkannte Sprache: {language}",
  "plugin.text-editor.language.toastChosen": "Hervorhebung: {language}.",
  "plugin.text-editor.language.toastAuto": "Automatische Hervorhebung: {language}.",
  // Descriptive labels of the language selector (proper names are not translated)
  "plugin.text-editor.lang.plaintext": "Nur Text",
  "plugin.text-editor.lang.shell": "Shell-Sitzung",
  "plugin.text-editor.lang.phpTemplate": "PHP (Vorlage)",
  "plugin.text-editor.lang.x86asm": "x86-Assembler",
  "plugin.text-editor.lang.dns": "DNS-Zone",
  "plugin.text-editor.lang.accesslog": "Zugriffsprotokoll",
  // Find and replace
  "plugin.text-editor.find.case": "Groß-/Kleinschreibung beachten",
  "plugin.text-editor.find.previous": "Vorheriger (Umschalt+Eingabe)",
  "plugin.text-editor.find.previousLabel": "Vorheriger Treffer",
  "plugin.text-editor.find.next": "Nächster (Eingabe)",
  "plugin.text-editor.find.nextLabel": "Nächster Treffer",
  "plugin.text-editor.find.replaceWith": "Ersetzen durch",
  "plugin.text-editor.find.replaceAll": "Alle",
  "plugin.text-editor.find.close": "Schließen (Esc)",
  "plugin.text-editor.find.closeLabel": "Suche schließen",
  "plugin.text-editor.find.none": "Kein Treffer.",
  "plugin.text-editor.find.replaced.one": "{count} Treffer ersetzt.",
  "plugin.text-editor.find.replaced.other": "{count} Treffer ersetzt.",
  // Go to line
  "plugin.text-editor.goto.title": "Gehe zu Zeile",
  "plugin.text-editor.goto.ok": "Gehe zu",
  "plugin.text-editor.goto.range": "1 bis {total}",
  "plugin.text-editor.goto.promptFallback": "Zeile (1 bis {total}):",
  // Comments
  "plugin.text-editor.comment.unknown": "Für diese Sprache ist keine Kommentarsyntax bekannt.",
  // Status bar
  "plugin.text-editor.status.positionStart": "Ze. 1, Sp. 1",
  "plugin.text-editor.status.position": "Ze. {line}, Sp. {column}",
  "plugin.text-editor.status.positionSelection": "Ze. {line}, Sp. {column} ({selected} ausgew.)",
  "plugin.text-editor.status.lines.one": "{count} Zeile",
  "plugin.text-editor.status.lines.other": "{count} Zeilen",
  "plugin.text-editor.status.tabs": "Tabulatoren",
  "plugin.text-editor.status.spaces": "Leerzeichen: {size}",
  // Floating actions and viewer
  "plugin.text-editor.content.copy": "Inhalt kopieren",
  "plugin.text-editor.copy.refused": "Kopieren nicht möglich: Der Browser verweigert den Zugriff auf die Zwischenablage.",
  "plugin.text-editor.media.noPreview": "Keine Vorschau für diesen Dateityp – nutze den Download.",
  // Loading and saving
  "plugin.text-editor.load.failed": "Datei kann nicht geladen werden: {message}",
  "plugin.text-editor.upload.errorStatus": "Fehler {status}",
  "plugin.text-editor.save.already": "Bereits gespeichert.",
  "plugin.text-editor.save.pending": "Ungespeicherte Änderungen",
  "plugin.text-editor.save.failed": "Speichern fehlgeschlagen",
  "plugin.text-editor.save.savedAt": "Gespeichert um {time}",
});
