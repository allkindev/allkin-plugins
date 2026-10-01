/* ==========================================================================
   Markdown editor plugin — dictionaries.

   Loaded before every other script of the plugin (see loadInterfacePlugins in
   web/app.js). One call to Allkin.i18n.register per language; every key starts
   with "plugin.markdown-editor."; the four languages hold the same keys and
   the same {variables}. English is the default and the fallback.
   ========================================================================== */

Allkin.i18n.register("en", {
  // Keyboard keys, as shown in tooltips and menus
  "plugin.markdown-editor.key.ctrl": "Ctrl",
  "plugin.markdown-editor.key.shift": "Shift",
  "plugin.markdown-editor.key.alt": "Alt",

  // The document
  "plugin.markdown-editor.placeholder": "Write here… or type “/” to insert a block",
  "plugin.markdown-editor.document.label": "Text",
  "plugin.markdown-editor.frontmatter": "Header",

  // Blocks: toolbar, block style, “/” menu
  "plugin.markdown-editor.block.text": "Text",
  "plugin.markdown-editor.block.heading": "Heading {level}",
  "plugin.markdown-editor.block.list": "List",
  "plugin.markdown-editor.block.ul": "Bulleted list",
  "plugin.markdown-editor.block.ol": "Numbered list",
  "plugin.markdown-editor.block.task": "Task list",
  "plugin.markdown-editor.block.quote": "Quote",
  "plugin.markdown-editor.block.pre": "Code block",
  "plugin.markdown-editor.block.table": "Table",
  "plugin.markdown-editor.block.hr": "Divider",
  "plugin.markdown-editor.block.image": "Image",
  "plugin.markdown-editor.block.file": "File",
  "plugin.markdown-editor.block.link": "Link",

  // What each block is, in the menus
  "plugin.markdown-editor.hint.text": "Plain paragraph",
  "plugin.markdown-editor.hint.h1": "Main heading",
  "plugin.markdown-editor.hint.h2": "Section heading",
  "plugin.markdown-editor.hint.h3": "Subheading",
  "plugin.markdown-editor.hint.ul": "A simple list",
  "plugin.markdown-editor.hint.ol": "Steps in order",
  "plugin.markdown-editor.hint.task": "Checkboxes",
  "plugin.markdown-editor.hint.quote": "An indented passage",
  "plugin.markdown-editor.hint.pre": "Code, as it is",
  "plugin.markdown-editor.hint.table": "Rows and columns",
  "plugin.markdown-editor.hint.hr": "A horizontal rule",
  "plugin.markdown-editor.hint.image": "From this device or an address",
  "plugin.markdown-editor.hint.file": "Attach a document",
  "plugin.markdown-editor.hint.link": "To a web page",

  // Words the “/” menu also answers to (never shown; accents and case are ignored)
  "plugin.markdown-editor.words.text": "paragraph normal plain",
  "plugin.markdown-editor.words.heading": "heading title",
  "plugin.markdown-editor.words.ul": "bullet unordered",
  "plugin.markdown-editor.words.ol": "number ordered",
  "plugin.markdown-editor.words.task": "todo checkbox check",
  "plugin.markdown-editor.words.quote": "blockquote",
  "plugin.markdown-editor.words.pre": "code source",
  "plugin.markdown-editor.words.table": "table grid",
  "plugin.markdown-editor.words.hr": "rule line separator hr",
  "plugin.markdown-editor.words.image": "photo picture",
  "plugin.markdown-editor.words.file": "attachment document",
  "plugin.markdown-editor.words.link": "url address",

  // Toolbar
  "plugin.markdown-editor.toolbar.label": "Formatting",
  "plugin.markdown-editor.toolbar.undo": "Undo",
  "plugin.markdown-editor.toolbar.redo": "Redo",
  "plugin.markdown-editor.toolbar.blockStyle": "Block style",
  "plugin.markdown-editor.toolbar.strong": "Bold",
  "plugin.markdown-editor.toolbar.em": "Italic",
  "plugin.markdown-editor.toolbar.del": "Strikethrough",
  "plugin.markdown-editor.toolbar.code": "Code",
  "plugin.markdown-editor.toolbar.attachFile": "Attach a file",
  "plugin.markdown-editor.toolbar.more": "More tools",
  "plugin.markdown-editor.toolbar.source": "Raw Markdown",

  // Menus
  "plugin.markdown-editor.menu.empty": "No block matches",
  "plugin.markdown-editor.insert": "Insert",

  // Tables — size picker: {count} columns, {rows} rows
  "plugin.markdown-editor.table.sizeOneRow.one": "{count} column × {rows} row",
  "plugin.markdown-editor.table.sizeOneRow.other": "{count} columns × {rows} row",
  "plugin.markdown-editor.table.sizeRows.one": "{count} column × {rows} rows",
  "plugin.markdown-editor.table.sizeRows.other": "{count} columns × {rows} rows",
  "plugin.markdown-editor.table.cellOneRow.one": "{count} column, {rows} row",
  "plugin.markdown-editor.table.cellOneRow.other": "{count} columns, {rows} row",
  "plugin.markdown-editor.table.cellRows.one": "{count} column, {rows} rows",
  "plugin.markdown-editor.table.cellRows.other": "{count} columns, {rows} rows",

  // Tables — menu of the current cell
  "plugin.markdown-editor.table.menu": "Rows and columns",
  "plugin.markdown-editor.table.rowAddAbove": "Insert a row above",
  "plugin.markdown-editor.table.rowAdd": "Insert a row below",
  "plugin.markdown-editor.table.colAddLeft": "Insert a column to the left",
  "plugin.markdown-editor.table.colAdd": "Insert a column to the right",
  "plugin.markdown-editor.table.alignLeft": "Align the column left",
  "plugin.markdown-editor.table.alignCenter": "Center the column",
  "plugin.markdown-editor.table.alignRight": "Align the column right",
  "plugin.markdown-editor.table.rowDel": "Delete the row",
  "plugin.markdown-editor.table.colDel": "Delete the column",
  "plugin.markdown-editor.table.remove": "Delete the table",
  "plugin.markdown-editor.table.headerStays": "The header row cannot be removed: delete the whole table.",

  // Links
  "plugin.markdown-editor.link.address": "Address",
  "plugin.markdown-editor.link.text": "Text",
  "plugin.markdown-editor.link.textPlaceholder": "Link text",
  "plugin.markdown-editor.link.add": "Add the link",
  "plugin.markdown-editor.link.empty": "(empty address)",
  "plugin.markdown-editor.link.open": "Open the link",
  "plugin.markdown-editor.link.edit": "Change the link",
  "plugin.markdown-editor.link.remove": "Remove the link",
  "plugin.markdown-editor.link.cannotOpen": "This kind of address cannot be opened from here.",
  "plugin.markdown-editor.link.localFile": "This link points to a local file: it cannot be opened from here.",

  // Images
  "plugin.markdown-editor.image.blocked": "External image hidden",
  "plugin.markdown-editor.image.blockedDetail": "{host} — click to show it",
  "plugin.markdown-editor.image.missing": "Image not found",
  "plugin.markdown-editor.image.show": "Show ({host})",
  "plugin.markdown-editor.image.alt": "Image description",
  "plugin.markdown-editor.image.delete": "Delete the image",
  "plugin.markdown-editor.image.choose": "Choose an image…",
  "plugin.markdown-editor.image.orDrop": "or drag it straight into the text",
  "plugin.markdown-editor.image.orAddress": "or by its address",
  "plugin.markdown-editor.image.address": "Image address",
  "plugin.markdown-editor.image.description": "Description",
  "plugin.markdown-editor.image.descriptionPlaceholder": "What the image shows",
  "plugin.markdown-editor.image.byAddressOnly": "Here, an image is added by its address: Image button of the toolbar.",

  // Files added to the document
  "plugin.markdown-editor.upload.sending": "Uploading {name}…",
  "plugin.markdown-editor.upload.noPath": "no path returned",
  "plugin.markdown-editor.upload.failed": "“{name}” could not be added: {error}",
});

Allkin.i18n.register("fr", {
  // Keyboard keys, as shown in tooltips and menus
  "plugin.markdown-editor.key.ctrl": "Ctrl",
  "plugin.markdown-editor.key.shift": "Maj",
  "plugin.markdown-editor.key.alt": "Alt",

  // The document
  "plugin.markdown-editor.placeholder": "Écris ici… ou tape « / » pour insérer un bloc",
  "plugin.markdown-editor.document.label": "Texte",
  "plugin.markdown-editor.frontmatter": "En-tête",

  // Blocks: toolbar, block style, “/” menu
  "plugin.markdown-editor.block.text": "Texte",
  "plugin.markdown-editor.block.heading": "Titre {level}",
  "plugin.markdown-editor.block.list": "Liste",
  "plugin.markdown-editor.block.ul": "Liste à puces",
  "plugin.markdown-editor.block.ol": "Liste numérotée",
  "plugin.markdown-editor.block.task": "Liste de tâches",
  "plugin.markdown-editor.block.quote": "Citation",
  "plugin.markdown-editor.block.pre": "Bloc de code",
  "plugin.markdown-editor.block.table": "Tableau",
  "plugin.markdown-editor.block.hr": "Séparateur",
  "plugin.markdown-editor.block.image": "Image",
  "plugin.markdown-editor.block.file": "Fichier",
  "plugin.markdown-editor.block.link": "Lien",

  // What each block is, in the menus
  "plugin.markdown-editor.hint.text": "Paragraphe courant",
  "plugin.markdown-editor.hint.h1": "Grand titre",
  "plugin.markdown-editor.hint.h2": "Titre de section",
  "plugin.markdown-editor.hint.h3": "Sous-titre",
  "plugin.markdown-editor.hint.ul": "Une liste simple",
  "plugin.markdown-editor.hint.ol": "Des étapes dans l'ordre",
  "plugin.markdown-editor.hint.task": "Des cases à cocher",
  "plugin.markdown-editor.hint.quote": "Un passage mis en retrait",
  "plugin.markdown-editor.hint.pre": "Du code, tel quel",
  "plugin.markdown-editor.hint.table": "Lignes et colonnes",
  "plugin.markdown-editor.hint.hr": "Un filet horizontal",
  "plugin.markdown-editor.hint.image": "Depuis l'appareil ou une adresse",
  "plugin.markdown-editor.hint.file": "Joindre un document",
  "plugin.markdown-editor.hint.link": "Vers une page web",

  // Words the “/” menu also answers to (never shown; accents and case are ignored)
  "plugin.markdown-editor.words.text": "paragraphe normal",
  "plugin.markdown-editor.words.heading": "heading titre",
  "plugin.markdown-editor.words.ul": "bullet puce",
  "plugin.markdown-editor.words.ol": "numero ordonnee",
  "plugin.markdown-editor.words.task": "todo case cocher checkbox",
  "plugin.markdown-editor.words.quote": "blockquote",
  "plugin.markdown-editor.words.pre": "code source",
  "plugin.markdown-editor.words.table": "table grille",
  "plugin.markdown-editor.words.hr": "filet ligne separateur hr",
  "plugin.markdown-editor.words.image": "photo picture",
  "plugin.markdown-editor.words.file": "piece jointe document",
  "plugin.markdown-editor.words.link": "url adresse",

  // Toolbar
  "plugin.markdown-editor.toolbar.label": "Mise en forme",
  "plugin.markdown-editor.toolbar.undo": "Annuler",
  "plugin.markdown-editor.toolbar.redo": "Rétablir",
  "plugin.markdown-editor.toolbar.blockStyle": "Style du bloc",
  "plugin.markdown-editor.toolbar.strong": "Gras",
  "plugin.markdown-editor.toolbar.em": "Italique",
  "plugin.markdown-editor.toolbar.del": "Barré",
  "plugin.markdown-editor.toolbar.code": "Code",
  "plugin.markdown-editor.toolbar.attachFile": "Joindre un fichier",
  "plugin.markdown-editor.toolbar.more": "Plus d'outils",
  "plugin.markdown-editor.toolbar.source": "Markdown brut",

  // Menus
  "plugin.markdown-editor.menu.empty": "Aucun bloc ne correspond",
  "plugin.markdown-editor.insert": "Insérer",

  // Tables — size picker: {count} columns, {rows} rows
  "plugin.markdown-editor.table.sizeOneRow.one": "{count} colonne × {rows} ligne",
  "plugin.markdown-editor.table.sizeOneRow.other": "{count} colonnes × {rows} ligne",
  "plugin.markdown-editor.table.sizeRows.one": "{count} colonne × {rows} lignes",
  "plugin.markdown-editor.table.sizeRows.other": "{count} colonnes × {rows} lignes",
  "plugin.markdown-editor.table.cellOneRow.one": "{count} colonne, {rows} ligne",
  "plugin.markdown-editor.table.cellOneRow.other": "{count} colonnes, {rows} ligne",
  "plugin.markdown-editor.table.cellRows.one": "{count} colonne, {rows} lignes",
  "plugin.markdown-editor.table.cellRows.other": "{count} colonnes, {rows} lignes",

  // Tables — menu of the current cell
  "plugin.markdown-editor.table.menu": "Lignes et colonnes",
  "plugin.markdown-editor.table.rowAddAbove": "Insérer une ligne au-dessus",
  "plugin.markdown-editor.table.rowAdd": "Insérer une ligne en dessous",
  "plugin.markdown-editor.table.colAddLeft": "Insérer une colonne à gauche",
  "plugin.markdown-editor.table.colAdd": "Insérer une colonne à droite",
  "plugin.markdown-editor.table.alignLeft": "Aligner la colonne à gauche",
  "plugin.markdown-editor.table.alignCenter": "Centrer la colonne",
  "plugin.markdown-editor.table.alignRight": "Aligner la colonne à droite",
  "plugin.markdown-editor.table.rowDel": "Supprimer la ligne",
  "plugin.markdown-editor.table.colDel": "Supprimer la colonne",
  "plugin.markdown-editor.table.remove": "Supprimer le tableau",
  "plugin.markdown-editor.table.headerStays": "La ligne d'en-tête ne se retire pas : supprime le tableau entier.",

  // Links
  "plugin.markdown-editor.link.address": "Adresse",
  "plugin.markdown-editor.link.text": "Texte",
  "plugin.markdown-editor.link.textPlaceholder": "Texte du lien",
  "plugin.markdown-editor.link.add": "Ajouter le lien",
  "plugin.markdown-editor.link.empty": "(adresse vide)",
  "plugin.markdown-editor.link.open": "Ouvrir le lien",
  "plugin.markdown-editor.link.edit": "Modifier le lien",
  "plugin.markdown-editor.link.remove": "Retirer le lien",
  "plugin.markdown-editor.link.cannotOpen": "Ce type d'adresse ne s'ouvre pas d'ici.",
  "plugin.markdown-editor.link.localFile": "Ce lien désigne un fichier local : il ne s'ouvre pas d'ici.",

  // Images
  "plugin.markdown-editor.image.blocked": "Image externe masquée",
  "plugin.markdown-editor.image.blockedDetail": "{host} — clique pour l'afficher",
  "plugin.markdown-editor.image.missing": "Image introuvable",
  "plugin.markdown-editor.image.show": "Afficher ({host})",
  "plugin.markdown-editor.image.alt": "Description de l'image",
  "plugin.markdown-editor.image.delete": "Supprimer l'image",
  "plugin.markdown-editor.image.choose": "Choisir une image…",
  "plugin.markdown-editor.image.orDrop": "ou glisse-la directement dans le texte",
  "plugin.markdown-editor.image.orAddress": "ou par son adresse",
  "plugin.markdown-editor.image.address": "Adresse de l'image",
  "plugin.markdown-editor.image.description": "Description",
  "plugin.markdown-editor.image.descriptionPlaceholder": "Ce que montre l'image",
  "plugin.markdown-editor.image.byAddressOnly": "Ici, une image s'ajoute par son adresse : bouton Image de la barre d'outils.",

  // Files added to the document
  "plugin.markdown-editor.upload.sending": "Envoi de {name}…",
  "plugin.markdown-editor.upload.noPath": "aucun chemin rendu",
  "plugin.markdown-editor.upload.failed": "« {name} » n'a pas pu être ajouté : {error}",
});

Allkin.i18n.register("es", {
  // Keyboard keys, as shown in tooltips and menus
  "plugin.markdown-editor.key.ctrl": "Ctrl",
  "plugin.markdown-editor.key.shift": "Mayús",
  "plugin.markdown-editor.key.alt": "Alt",

  // The document
  "plugin.markdown-editor.placeholder": "Escribe aquí… o teclea «/» para insertar un bloque",
  "plugin.markdown-editor.document.label": "Texto",
  "plugin.markdown-editor.frontmatter": "Encabezado",

  // Blocks: toolbar, block style, “/” menu
  "plugin.markdown-editor.block.text": "Texto",
  "plugin.markdown-editor.block.heading": "Título {level}",
  "plugin.markdown-editor.block.list": "Lista",
  "plugin.markdown-editor.block.ul": "Lista con viñetas",
  "plugin.markdown-editor.block.ol": "Lista numerada",
  "plugin.markdown-editor.block.task": "Lista de tareas",
  "plugin.markdown-editor.block.quote": "Cita",
  "plugin.markdown-editor.block.pre": "Bloque de código",
  "plugin.markdown-editor.block.table": "Tabla",
  "plugin.markdown-editor.block.hr": "Separador",
  "plugin.markdown-editor.block.image": "Imagen",
  "plugin.markdown-editor.block.file": "Archivo",
  "plugin.markdown-editor.block.link": "Enlace",

  // What each block is, in the menus
  "plugin.markdown-editor.hint.text": "Párrafo normal",
  "plugin.markdown-editor.hint.h1": "Título principal",
  "plugin.markdown-editor.hint.h2": "Título de sección",
  "plugin.markdown-editor.hint.h3": "Subtítulo",
  "plugin.markdown-editor.hint.ul": "Una lista sencilla",
  "plugin.markdown-editor.hint.ol": "Pasos en orden",
  "plugin.markdown-editor.hint.task": "Casillas para marcar",
  "plugin.markdown-editor.hint.quote": "Un pasaje con sangría",
  "plugin.markdown-editor.hint.pre": "Código, tal cual",
  "plugin.markdown-editor.hint.table": "Filas y columnas",
  "plugin.markdown-editor.hint.hr": "Una línea horizontal",
  "plugin.markdown-editor.hint.image": "Desde el dispositivo o una dirección",
  "plugin.markdown-editor.hint.file": "Adjuntar un documento",
  "plugin.markdown-editor.hint.link": "A una página web",

  // Words the “/” menu also answers to (never shown; accents and case are ignored)
  "plugin.markdown-editor.words.text": "párrafo normal paragraph",
  "plugin.markdown-editor.words.heading": "heading título encabezado",
  "plugin.markdown-editor.words.ul": "bullet viñeta punto",
  "plugin.markdown-editor.words.ol": "número ordenada",
  "plugin.markdown-editor.words.task": "todo casilla marcar checkbox",
  "plugin.markdown-editor.words.quote": "blockquote",
  "plugin.markdown-editor.words.pre": "código fuente code",
  "plugin.markdown-editor.words.table": "table cuadrícula",
  "plugin.markdown-editor.words.hr": "línea separador regla hr",
  "plugin.markdown-editor.words.image": "foto picture",
  "plugin.markdown-editor.words.file": "adjunto documento",
  "plugin.markdown-editor.words.link": "url dirección",

  // Toolbar
  "plugin.markdown-editor.toolbar.label": "Formato",
  "plugin.markdown-editor.toolbar.undo": "Deshacer",
  "plugin.markdown-editor.toolbar.redo": "Rehacer",
  "plugin.markdown-editor.toolbar.blockStyle": "Estilo del bloque",
  "plugin.markdown-editor.toolbar.strong": "Negrita",
  "plugin.markdown-editor.toolbar.em": "Cursiva",
  "plugin.markdown-editor.toolbar.del": "Tachado",
  "plugin.markdown-editor.toolbar.code": "Código",
  "plugin.markdown-editor.toolbar.attachFile": "Adjuntar un archivo",
  "plugin.markdown-editor.toolbar.more": "Más herramientas",
  "plugin.markdown-editor.toolbar.source": "Markdown en bruto",

  // Menus
  "plugin.markdown-editor.menu.empty": "Ningún bloque coincide",
  "plugin.markdown-editor.insert": "Insertar",

  // Tables — size picker: {count} columns, {rows} rows
  "plugin.markdown-editor.table.sizeOneRow.one": "{count} columna × {rows} fila",
  "plugin.markdown-editor.table.sizeOneRow.other": "{count} columnas × {rows} fila",
  "plugin.markdown-editor.table.sizeRows.one": "{count} columna × {rows} filas",
  "plugin.markdown-editor.table.sizeRows.other": "{count} columnas × {rows} filas",
  "plugin.markdown-editor.table.cellOneRow.one": "{count} columna, {rows} fila",
  "plugin.markdown-editor.table.cellOneRow.other": "{count} columnas, {rows} fila",
  "plugin.markdown-editor.table.cellRows.one": "{count} columna, {rows} filas",
  "plugin.markdown-editor.table.cellRows.other": "{count} columnas, {rows} filas",

  // Tables — menu of the current cell
  "plugin.markdown-editor.table.menu": "Filas y columnas",
  "plugin.markdown-editor.table.rowAddAbove": "Insertar una fila encima",
  "plugin.markdown-editor.table.rowAdd": "Insertar una fila debajo",
  "plugin.markdown-editor.table.colAddLeft": "Insertar una columna a la izquierda",
  "plugin.markdown-editor.table.colAdd": "Insertar una columna a la derecha",
  "plugin.markdown-editor.table.alignLeft": "Alinear la columna a la izquierda",
  "plugin.markdown-editor.table.alignCenter": "Centrar la columna",
  "plugin.markdown-editor.table.alignRight": "Alinear la columna a la derecha",
  "plugin.markdown-editor.table.rowDel": "Eliminar la fila",
  "plugin.markdown-editor.table.colDel": "Eliminar la columna",
  "plugin.markdown-editor.table.remove": "Eliminar la tabla",
  "plugin.markdown-editor.table.headerStays": "La fila de encabezado no se puede quitar: elimina la tabla entera.",

  // Links
  "plugin.markdown-editor.link.address": "Dirección",
  "plugin.markdown-editor.link.text": "Texto",
  "plugin.markdown-editor.link.textPlaceholder": "Texto del enlace",
  "plugin.markdown-editor.link.add": "Añadir el enlace",
  "plugin.markdown-editor.link.empty": "(dirección vacía)",
  "plugin.markdown-editor.link.open": "Abrir el enlace",
  "plugin.markdown-editor.link.edit": "Modificar el enlace",
  "plugin.markdown-editor.link.remove": "Quitar el enlace",
  "plugin.markdown-editor.link.cannotOpen": "Este tipo de dirección no se abre desde aquí.",
  "plugin.markdown-editor.link.localFile": "Este enlace apunta a un archivo local: no se abre desde aquí.",

  // Images
  "plugin.markdown-editor.image.blocked": "Imagen externa oculta",
  "plugin.markdown-editor.image.blockedDetail": "{host}: haz clic para mostrarla",
  "plugin.markdown-editor.image.missing": "Imagen no encontrada",
  "plugin.markdown-editor.image.show": "Mostrar ({host})",
  "plugin.markdown-editor.image.alt": "Descripción de la imagen",
  "plugin.markdown-editor.image.delete": "Eliminar la imagen",
  "plugin.markdown-editor.image.choose": "Elegir una imagen…",
  "plugin.markdown-editor.image.orDrop": "o arrástrala directamente al texto",
  "plugin.markdown-editor.image.orAddress": "o por su dirección",
  "plugin.markdown-editor.image.address": "Dirección de la imagen",
  "plugin.markdown-editor.image.description": "Descripción",
  "plugin.markdown-editor.image.descriptionPlaceholder": "Lo que muestra la imagen",
  "plugin.markdown-editor.image.byAddressOnly": "Aquí, una imagen se añade por su dirección: botón Imagen de la barra de herramientas.",

  // Files added to the document
  "plugin.markdown-editor.upload.sending": "Subiendo {name}…",
  "plugin.markdown-editor.upload.noPath": "no se devolvió ninguna ruta",
  "plugin.markdown-editor.upload.failed": "«{name}» no se pudo añadir: {error}",
});

Allkin.i18n.register("de", {
  // Keyboard keys, as shown in tooltips and menus
  "plugin.markdown-editor.key.ctrl": "Strg",
  "plugin.markdown-editor.key.shift": "Umschalt",
  "plugin.markdown-editor.key.alt": "Alt",

  // The document
  "plugin.markdown-editor.placeholder": "Schreib hier … oder tippe „/“, um einen Block einzufügen",
  "plugin.markdown-editor.document.label": "Text",
  "plugin.markdown-editor.frontmatter": "Kopfdaten",

  // Blocks: toolbar, block style, “/” menu
  "plugin.markdown-editor.block.text": "Text",
  "plugin.markdown-editor.block.heading": "Überschrift {level}",
  "plugin.markdown-editor.block.list": "Liste",
  "plugin.markdown-editor.block.ul": "Aufzählung",
  "plugin.markdown-editor.block.ol": "Nummerierte Liste",
  "plugin.markdown-editor.block.task": "Aufgabenliste",
  "plugin.markdown-editor.block.quote": "Zitat",
  "plugin.markdown-editor.block.pre": "Codeblock",
  "plugin.markdown-editor.block.table": "Tabelle",
  "plugin.markdown-editor.block.hr": "Trennlinie",
  "plugin.markdown-editor.block.image": "Bild",
  "plugin.markdown-editor.block.file": "Datei",
  "plugin.markdown-editor.block.link": "Link",

  // What each block is, in the menus
  "plugin.markdown-editor.hint.text": "Normaler Absatz",
  "plugin.markdown-editor.hint.h1": "Große Überschrift",
  "plugin.markdown-editor.hint.h2": "Abschnittsüberschrift",
  "plugin.markdown-editor.hint.h3": "Unterüberschrift",
  "plugin.markdown-editor.hint.ul": "Eine einfache Liste",
  "plugin.markdown-editor.hint.ol": "Schritte der Reihe nach",
  "plugin.markdown-editor.hint.task": "Kästchen zum Abhaken",
  "plugin.markdown-editor.hint.quote": "Ein eingerückter Abschnitt",
  "plugin.markdown-editor.hint.pre": "Code, unverändert",
  "plugin.markdown-editor.hint.table": "Zeilen und Spalten",
  "plugin.markdown-editor.hint.hr": "Eine waagerechte Linie",
  "plugin.markdown-editor.hint.image": "Vom Gerät oder über eine Adresse",
  "plugin.markdown-editor.hint.file": "Ein Dokument anhängen",
  "plugin.markdown-editor.hint.link": "Zu einer Webseite",

  // Words the “/” menu also answers to (never shown; accents and case are ignored)
  "plugin.markdown-editor.words.text": "absatz normal paragraph",
  "plugin.markdown-editor.words.heading": "heading überschrift titel",
  "plugin.markdown-editor.words.ul": "bullet aufzählungszeichen punkt",
  "plugin.markdown-editor.words.ol": "nummer geordnet nummeriert",
  "plugin.markdown-editor.words.task": "todo kästchen abhaken checkbox",
  "plugin.markdown-editor.words.quote": "blockquote",
  "plugin.markdown-editor.words.pre": "code quelltext",
  "plugin.markdown-editor.words.table": "table raster gitter",
  "plugin.markdown-editor.words.hr": "linie trenner separator hr",
  "plugin.markdown-editor.words.image": "foto picture",
  "plugin.markdown-editor.words.file": "anhang dokument",
  "plugin.markdown-editor.words.link": "url adresse",

  // Toolbar
  "plugin.markdown-editor.toolbar.label": "Formatierung",
  "plugin.markdown-editor.toolbar.undo": "Rückgängig",
  "plugin.markdown-editor.toolbar.redo": "Wiederholen",
  "plugin.markdown-editor.toolbar.blockStyle": "Blockstil",
  "plugin.markdown-editor.toolbar.strong": "Fett",
  "plugin.markdown-editor.toolbar.em": "Kursiv",
  "plugin.markdown-editor.toolbar.del": "Durchgestrichen",
  "plugin.markdown-editor.toolbar.code": "Code",
  "plugin.markdown-editor.toolbar.attachFile": "Datei anhängen",
  "plugin.markdown-editor.toolbar.more": "Weitere Werkzeuge",
  "plugin.markdown-editor.toolbar.source": "Markdown-Quelltext",

  // Menus
  "plugin.markdown-editor.menu.empty": "Kein Block passt",
  "plugin.markdown-editor.insert": "Einfügen",

  // Tables — size picker: {count} columns, {rows} rows
  "plugin.markdown-editor.table.sizeOneRow.one": "{count} Spalte × {rows} Zeile",
  "plugin.markdown-editor.table.sizeOneRow.other": "{count} Spalten × {rows} Zeile",
  "plugin.markdown-editor.table.sizeRows.one": "{count} Spalte × {rows} Zeilen",
  "plugin.markdown-editor.table.sizeRows.other": "{count} Spalten × {rows} Zeilen",
  "plugin.markdown-editor.table.cellOneRow.one": "{count} Spalte, {rows} Zeile",
  "plugin.markdown-editor.table.cellOneRow.other": "{count} Spalten, {rows} Zeile",
  "plugin.markdown-editor.table.cellRows.one": "{count} Spalte, {rows} Zeilen",
  "plugin.markdown-editor.table.cellRows.other": "{count} Spalten, {rows} Zeilen",

  // Tables — menu of the current cell
  "plugin.markdown-editor.table.menu": "Zeilen und Spalten",
  "plugin.markdown-editor.table.rowAddAbove": "Zeile oberhalb einfügen",
  "plugin.markdown-editor.table.rowAdd": "Zeile unterhalb einfügen",
  "plugin.markdown-editor.table.colAddLeft": "Spalte links einfügen",
  "plugin.markdown-editor.table.colAdd": "Spalte rechts einfügen",
  "plugin.markdown-editor.table.alignLeft": "Spalte linksbündig ausrichten",
  "plugin.markdown-editor.table.alignCenter": "Spalte zentrieren",
  "plugin.markdown-editor.table.alignRight": "Spalte rechtsbündig ausrichten",
  "plugin.markdown-editor.table.rowDel": "Zeile löschen",
  "plugin.markdown-editor.table.colDel": "Spalte löschen",
  "plugin.markdown-editor.table.remove": "Tabelle löschen",
  "plugin.markdown-editor.table.headerStays": "Die Kopfzeile lässt sich nicht entfernen: Lösch die ganze Tabelle.",

  // Links
  "plugin.markdown-editor.link.address": "Adresse",
  "plugin.markdown-editor.link.text": "Text",
  "plugin.markdown-editor.link.textPlaceholder": "Linktext",
  "plugin.markdown-editor.link.add": "Link hinzufügen",
  "plugin.markdown-editor.link.empty": "(leere Adresse)",
  "plugin.markdown-editor.link.open": "Link öffnen",
  "plugin.markdown-editor.link.edit": "Link ändern",
  "plugin.markdown-editor.link.remove": "Link entfernen",
  "plugin.markdown-editor.link.cannotOpen": "Diese Art von Adresse lässt sich von hier aus nicht öffnen.",
  "plugin.markdown-editor.link.localFile": "Dieser Link verweist auf eine lokale Datei: Sie lässt sich von hier aus nicht öffnen.",

  // Images
  "plugin.markdown-editor.image.blocked": "Externes Bild ausgeblendet",
  "plugin.markdown-editor.image.blockedDetail": "{host} – klick, um es anzuzeigen",
  "plugin.markdown-editor.image.missing": "Bild nicht gefunden",
  "plugin.markdown-editor.image.show": "Anzeigen ({host})",
  "plugin.markdown-editor.image.alt": "Bildbeschreibung",
  "plugin.markdown-editor.image.delete": "Bild löschen",
  "plugin.markdown-editor.image.choose": "Bild auswählen…",
  "plugin.markdown-editor.image.orDrop": "oder zieh es direkt in den Text",
  "plugin.markdown-editor.image.orAddress": "oder über seine Adresse",
  "plugin.markdown-editor.image.address": "Bildadresse",
  "plugin.markdown-editor.image.description": "Beschreibung",
  "plugin.markdown-editor.image.descriptionPlaceholder": "Was das Bild zeigt",
  "plugin.markdown-editor.image.byAddressOnly": "Hier wird ein Bild über seine Adresse hinzugefügt: Schaltfläche „Bild“ in der Werkzeugleiste.",

  // Files added to the document
  "plugin.markdown-editor.upload.sending": "{name} wird hochgeladen…",
  "plugin.markdown-editor.upload.noPath": "kein Pfad zurückgegeben",
  "plugin.markdown-editor.upload.failed": "„{name}“ konnte nicht hinzugefügt werden: {error}",
});
