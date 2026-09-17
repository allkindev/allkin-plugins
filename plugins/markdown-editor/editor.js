"use strict";
/* ============================================================================
   Plugin « Éditeur markdown » — l'éditeur vivant d'Allkin.
   ----------------------------------------------------------------------------
   Fournit la capacité « markdown-editor » :

     Allkin.capability("markdown-editor").create({ host, toolbar, doc, spellcheck })

   qui rend une instance autonome (voir « La fabrique » plus bas). Le cœur s'en
   sert pour le bloc-notes et le rôle des agents (CLAUDE.md), l'éditeur de texte
   pour les fichiers .md. Sans ce plugin, ces trois éditions n'existent pas.

   Le découpage et la décoration du markdown restent dans web/markdown.js, qui
   sert aussi à l'affichage des messages : ce plugin s'en sert par
   window.decorateMarkdown, window.splitMarkdownBlocks, etc.
   ========================================================================== */
(() => {

/* ---- Éditeur markdown vivant -------------------------------------------------
   Modèle « live preview », à la Obsidian : il n'y a **qu'une seule
   représentation du texte à l'écran**, la source, habillée par des balises
   (decorateMarkdown, dans markdown.js). Elle est éditable telle quelle.

   C'est la propriété qui compte : comme rien ne bascule d'une représentation à
   une autre, cliquer ne remet jamais le texte en page. Les marqueurs de
   syntaxe sont là en permanence, simplement masqués par le CSS ; ils
   réapparaissent quand le curseur entre dans le mot ou le bloc qui les porte,
   et disparaissent quand il en sort. Rien d'autre ne change : ni cadre, ni
   fond, ni police, ni contour de focus.

   Le document est découpé en blocs (un titre, un paragraphe, une liste…) pour
   deux raisons : ne réécrire que la tranche modifiée du fichier, et ne
   redécorer qu'un paragraphe à chaque frappe plutôt que le document entier.

   Sur contenteditable : il est ici cantonné à du texte brut
   (`plaintext-only`, doublé d'un collage filtré à la main), et la source de
   vérité reste toujours `textContent`. Le navigateur ne peut donc pas
   introduire de balises de son cru — ce qu'on lui reprend à chaque frappe en
   redécorant depuis le texte.

   COMPOSANT : createLiveMarkdownEditor() rend une instance autonome — son
   hôte, sa barre d'outils, son découpage en blocs et sa pile d'annulation. Il
   ne connaît donc rien des onglets de fichiers : il parle à un `doc`, que
   l'appelant branche sur ce qu'il veut (un onglet, le bloc-notes, autre
   chose). C'est ce qui permet de le poser à deux endroits de l'interface sans
   dupliquer une ligne. */

/* ---- Aides communes à toutes les instances ---- */

function decorateBlock(blockEl, text) {
  blockEl.innerHTML = text ? window.decorateMarkdown(text) : "";
  // Un saut de ligne en fin de bloc n'ouvre pas de ligne visible : les
  // navigateurs ne rendent pas la dernière ligne d'un bloc quand elle est vide.
  // Sans ce <br>, appuyer sur Entrée en fin de paragraphe déplacerait bien le
  // curseur dans la source, mais il paraîtrait immobile à l'écran. Un <br> ne
  // compte pas dans `textContent` : la source reste intacte.
  if (!text || text.endsWith("\n")) blockEl.appendChild(document.createElement("br"));
}

/* ---- Position du curseur ----
   Exprimée en nombre de caractères depuis le début du bloc, marqueurs masqués
   compris — la même unité que `textContent`, donc que la source. C'est ce qui
   permet de redécorer le bloc à chaque frappe sans perdre le curseur. */

function caretRangeIn(blockEl) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!blockEl.contains(range.startContainer)) return null;

  const before = range.cloneRange();
  before.selectNodeContents(blockEl);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;

  const inner = range.cloneRange();
  inner.selectNodeContents(blockEl);
  inner.setStart(range.startContainer, range.startOffset);
  inner.setEnd(range.endContainer, range.endOffset);
  return { start, end: start + inner.toString().length };
}

/**
 * Le Range DOM correspondant à une tranche de caractères d'un bloc.
 *
 * Partagé entre la pose du curseur et la peinture de la sélection multi-blocs :
 * les deux ont besoin de la même traduction « n-ième caractère du bloc » ->
 * « nœud texte + décalage », et elle ne doit pas exister en deux exemplaires.
 */
function rangeIn(blockEl, start, end = start) {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  const locate = (target) => {
    let remaining = target;
    let node = walker.nextNode();
    let last = null;
    while (node) {
      if (remaining <= node.length) return { node, offset: remaining };
      remaining -= node.length;
      last = node;
      node = walker.nextNode();
    }
    return last ? { node: last, offset: last.length } : null;
  };

  const from = locate(start);
  if (!from) return null;
  walker.currentNode = blockEl;
  const to = end === start ? from : locate(end) ?? from;

  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

function setCaretIn(blockEl, start, end = start) {
  const range = rangeIn(blockEl, start, end);
  if (!range) {
    blockEl.focus();
    return;
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

/* ---- Frappe ---- */

function lineRangeAt(text, offset) {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const next = text.indexOf("\n", offset);
  return { start, end: next === -1 ? text.length : next };
}

/**
 * Entrée dans une liste : poursuit la liste plutôt que de laisser une ligne
 * nue. Le marqueur est repris tel quel pour une liste à puces, incrémenté pour
 * une liste numérotée, et l'indentation est conservée.
 *
 * Sur un item resté vide, Entrée fait l'inverse : elle retire le marqueur et
 * sort de la liste. C'est le geste attendu partout, et sans lui on ne pourrait
 * plus terminer une liste autrement qu'en effaçant à la main.
 *
 * Renvoie vrai si la touche a été traitée ici.
 */

const UNDO_INTERVAL_MS = 400;
const UNDO_DEPTH = 60;

/* ---- Barre d'outils ----
   Chaque bouton pose la balise correspondante autour de la sélection (ou au
   point d'insertion). Seules les syntaxes que markdown.js sait rendre sont
   proposées — un bouton dont le résultat ne s'afficherait pas serait un piège. */

// Chaque bouton pose la balise correspondante autour de la sélection (ou au
// point d'insertion). Seules les syntaxes que markdown.js sait rendre sont
// proposées — un bouton dont le résultat ne s'afficherait pas serait un piège.

function wrapSelection(ta, before, after = before) {
  const { selectionStart: start, selectionEnd: end, value } = ta;
  const selected = value.slice(start, end);
  ta.value = value.slice(0, start) + before + selected + after + value.slice(end);
  ta.selectionStart = start + before.length;
  ta.selectionEnd = start + before.length + selected.length;
}

// Applique un préfixe à toutes les lignes touchées par la sélection (la
// sélection est d'abord étendue aux lignes entières : préfixer une demi-ligne
// ne veut rien dire en markdown).
function prefixLines(ta, prefix) {
  const { selectionStart: start, selectionEnd: end, value } = ta;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  let index = 0;
  const updated = value
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((line) => (typeof prefix === "function" ? prefix(++index) : prefix) + line)
    .join("\n");
  ta.value = value.slice(0, lineStart) + updated + value.slice(lineEnd);
  ta.selectionStart = lineStart;
  ta.selectionEnd = lineStart + updated.length;
}

// Insère un bloc sur ses propres lignes, en garantissant la ligne vide qui le
// sépare de ce qui précède — sans elle, markdown le collerait au paragraphe.
function insertBlock(ta, text) {
  const { selectionStart: start, selectionEnd: end, value } = ta;
  const before = value.slice(0, start);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const block = lead + text;
  ta.value = before + block + value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + block.length;
}

// Groupées par nature (titres, style du texte, blocs) et séparées à l'écran :
// une rangée de quatorze symboles se lit mal, trois familles courtes se
// balaient du regard. Les libellés disent ce qu'ils font plutôt que de citer la
// syntaxe qu'ils produisent — « ``` » n'a jamais rien appris à personne.
const MD_TOOLS = [
  { group: "titre", label: "H1", title: "Titre de niveau 1", run: (ta) => prefixLines(ta, "# ") },
  { group: "titre", label: "H2", title: "Titre de niveau 2", run: (ta) => prefixLines(ta, "## ") },
  { group: "titre", label: "H3", title: "Titre de niveau 3", run: (ta) => prefixLines(ta, "### ") },

  { group: "style", label: "B", title: "Gras", className: "md-tool-bold", run: (ta) => wrapSelection(ta, "**") },
  { group: "style", label: "I", title: "Italique", className: "md-tool-italic", run: (ta) => wrapSelection(ta, "*") },
  { group: "style", label: "S", title: "Barré", className: "md-tool-strike", run: (ta) => wrapSelection(ta, "~~") },
  { group: "style", label: "code", title: "Code dans le texte", className: "md-tool-code", run: (ta) => wrapSelection(ta, "`") },
  { group: "style", label: "Lien", title: "Lien", run: (ta) => wrapSelection(ta, "[", "](https://)") },

  { group: "bloc", label: "Liste", title: "Liste à puces", run: (ta) => prefixLines(ta, "- ") },
  { group: "bloc", label: "Numéros", title: "Liste numérotée", run: (ta) => prefixLines(ta, (n) => `${n}. `) },
  { group: "bloc", label: "Citation", title: "Citation", run: (ta) => prefixLines(ta, "> ") },
  { group: "bloc", label: "Bloc code", title: "Bloc de code", run: (ta) => insertBlock(ta, "```\n\n```") },
  {
    group: "bloc",
    label: "Tableau",
    title: "Tableau",
    run: (ta) => insertBlock(ta, "| Colonne | Colonne |\n| --- | --- |\n|  |  |"),
  },
  { group: "bloc", label: "Filet", title: "Filet horizontal", run: (ta) => insertBlock(ta, "---\n") },
];

/**
 * Applique un outil au bloc où se trouve le curseur (ou à la zone de saisie
 * brute, pour un fichier sans rendu). Si le curseur n'est nulle part, on prend
 * le dernier bloc : un bouton de mise en forme qui ne ferait rien serait
 * incompréhensible.
 *
 * Les fonctions d'outils manipulent `value`/`selectionStart`/`selectionEnd`.
 * Une zone de saisie expose ces propriétés nativement ; pour un bloc éditable
 * on lui présente un objet qui les imite, et on reporte le résultat. Les outils
 * n'ont ainsi pas à connaître les deux modes d'édition.
 */


/* ---- La fabrique ----------------------------------------------------------
   `doc` est le seul lien avec l'extérieur :
     getContent()  -> le texte courant, source de vérité tenue par l'appelant ;
     setContent(t) -> le texte a changé (l'appelant enregistre, marque sale…) ;
     isActive()    -> l'éditeur est-il encore à l'écran ? Sert au re-découpage
                      différé, qui ne doit pas s'exécuter sur un éditeur parti.

   `spellcheck` est laissé à l'appelant : un fichier de code n'en veut pas, une
   note en français si. */

function createLiveMarkdownEditor({ host, toolbar, doc, spellcheck = false }) {
  let blocks = [];
  let normalizeTimer = null;
  /** Bloc en cours de composition (touche morte, IME) — voir buildLiveBlock. */
  let composingBlock = null;
  let destroyed = false;
  /* Redécorer le bloc à chaque frappe efface la pile d'annulation native du
     navigateur : il faut donc la nôtre. Volontairement minimale — des
     instantanés du document espacés dans le temps, pas un journal
     d'opérations. Propre à l'instance, donc libérée avec elle : la version
     précédente gardait une Map globale par onglet, jamais purgée. */
  const undo = { entries: [], lastAt: 0 };

  function render() {
    // Les portées peintes désignent des nœuds qui vont disparaître.
    clearSpanning();
    host.innerHTML = "";
    const source = doc.getContent();
    const parsed = window.splitMarkdownBlocks(source);
    // Document vide : un bloc d'amorce, sinon il n'y aurait nulle part où écrire.
    blocks = parsed.length > 0 ? parsed : [{ start: 0, end: 0, text: "", kind: "paragraph", level: 0 }];

    /* Un tableau n'est pas une zone de saisie : ses cellules le sont, lui non.
       En tête ou en fin de document, il devient donc un cul-de-sac — plus rien
       où poser le curseur, ni au-dessus, ni en dessous, et aucun moyen d'écrire
       autour. Le markdown ne sachant pas représenter un paragraphe vide, on
       pose ici une ligne d'appoint qui n'existe pas encore dans la source :
       elle n'y sera écrite qu'à la première frappe (voir commitBlockText). */
    if (blocks[0].kind === "table") {
      blocks.unshift({ start: 0, end: 0, text: "", kind: "paragraph", level: 0, synthetic: "leading" });
    }
    if (blocks[blocks.length - 1].kind === "table") {
      blocks.push({
        start: source.length,
        end: source.length,
        text: "",
        kind: "paragraph",
        level: 0,
        synthetic: "trailing",
      });
    }
    blocks.forEach((block, index) => host.appendChild(buildLiveBlock(block, index)));
  }

  function buildLiveBlock(block, index) {
    const el_ = document.createElement("div");
    el_.className = "live-block";
    el_.dataset.index = String(index);
    // La nature du bloc porte sa typographie (taille d'un titre, chasse fixe
    // d'un bloc de code). Elle ne change jamais en cours d'édition : c'est ce qui
    // garantit qu'aucune ligne ne bouge quand le curseur entre ou sort.
    el_.dataset.kind = block.kind || "paragraph";
    el_.dataset.level = String(block.level || 0);

    if (el_.dataset.kind === "table" && window.parseMarkdownTable) {
      const table = window.parseMarkdownTable(block.text);
      if (table) {
        buildTableBlock(el_, table);
        return el_;
      }
      // Source annoncée comme un tableau mais illisible : plutôt que de ne
      // rien afficher, on la rend éditable comme du texte — c'est le seul
      // moyen de la réparer.
      el_.dataset.kind = "paragraph";
    }

    el_.setAttribute("contenteditable", "plaintext-only");
    el_.setAttribute("role", "textbox");
    el_.setAttribute("aria-multiline", "true");
    el_.spellcheck = spellcheck;
    decorateBlock(el_, block.text);

    el_.addEventListener("input", () => handleBlockInput(el_));
    el_.addEventListener("keydown", (event) => handleBlockKeydown(event, el_));
    el_.addEventListener("blur", () => scheduleNormalize());
    el_.addEventListener("paste", (event) => handleBlockPaste(event, el_));
    // Saisie par composition (touches mortes, IME) : redécorer au milieu d'une
    // composition la briserait, le navigateur perdant le nœud qu'il était en
    // train d'éditer. On enregistre quand même la frappe, on ne fait que
    // repousser l'habillage à la fin de la composition.
    el_.addEventListener("compositionstart", () => {
      composingBlock = el_;
    });
    el_.addEventListener("compositionend", () => {
      composingBlock = null;
      handleBlockInput(el_);
    });
    return el_;
  }

  /* ---- Tableaux ---------------------------------------------------------
     Seul bloc à échapper à la règle « une seule représentation, la source » :
     un tableau aligné en barres verticales est illisible dès qu'il a trois
     colonnes, et le lire n'est pas le sujet — on vient pour le remplir.

     Il est donc rendu comme un vrai tableau, dont chaque cellule est une zone
     éditable. La source reste la source de vérité : chaque frappe rassemble
     les cellules et réécrit la tranche markdown du bloc (voir commitTable),
     exactement comme un paragraphe réécrit la sienne. Rien n'est stocké
     ailleurs, et le tableau reste un tableau markdown à tout instant. */

  function buildTableBlock(blockEl, table) {
    blockEl.innerHTML = "";
    blockEl.removeAttribute("contenteditable");
    blockEl.dataset.kind = "table";

    const wrap = document.createElement("div");
    wrap.className = "live-table-wrap";
    const tableEl = document.createElement("table");
    tableEl.className = "md-table live-table";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    table.header.forEach((text, col) => headRow.appendChild(buildCell(blockEl, "th", text, table.align[col])));
    head.appendChild(headRow);

    const body = document.createElement("tbody");
    for (const row of table.rows) {
      const rowEl = document.createElement("tr");
      row.forEach((text, col) => rowEl.appendChild(buildCell(blockEl, "td", text, table.align[col])));
      body.appendChild(rowEl);
    }

    tableEl.append(head, body);
    wrap.appendChild(tableEl);
    blockEl.append(wrap, buildTableControls(blockEl));
  }

  function buildCell(blockEl, tag, text, align) {
    const cell = document.createElement(tag);
    cell.className = "live-cell";
    if (align) {
      cell.dataset.align = align;
      // Mêmes classes que le rendu en lecture seule : un tableau doit s'aligner
      // pareil qu'on soit en train de l'écrire ou de le relire.
      cell.classList.add(align === "center" ? "md-cell-center" : align === "right" ? "md-cell-right" : "md-cell-left");
    }
    cell.setAttribute("contenteditable", "plaintext-only");
    cell.spellcheck = spellcheck;
    // Le contenu d'une cellule est du markdown en ligne : il s'habille comme
    // le reste du document (gras, code, liens), et `textContent` reste la
    // source.
    cell.innerHTML = text ? window.decorateMarkdownInline(text) : "";

    cell.addEventListener("input", () => handleCellInput(blockEl, cell));
    cell.addEventListener("compositionstart", () => {
      composingBlock = cell;
    });
    cell.addEventListener("compositionend", () => {
      composingBlock = null;
      handleCellInput(blockEl, cell);
    });
    cell.addEventListener("keydown", (event) => handleCellKeydown(event, blockEl, cell));
    cell.addEventListener("blur", () => scheduleNormalize());
    cell.addEventListener("paste", (event) => {
      const text_ = event.clipboardData?.getData("text/plain");
      if (text_ == null) return;
      event.preventDefault();
      // Une cellule tient sur une ligne : un collage multiligne y serait
      // recassé à la relecture.
      document.execCommand("insertText", false, text_.replace(/\r?\n/g, " "));
    });
    return cell;
  }

  /** Même mécanique qu'un bloc : on enregistre, puis on rhabille la cellule
   *  sans bouger le curseur — c'est ce qui fait apparaître le gras dès que sa
   *  seconde étoile est tapée, dans une cellule comme ailleurs. */
  function handleCellInput(blockEl, cell) {
    const caret = caretRangeIn(cell);
    const text = cell.textContent;
    commitTable(blockEl);
    if (composingBlock === cell) return;
    cell.innerHTML = text ? window.decorateMarkdownInline(text) : "";
    if (caret) setCaretIn(cell, Math.min(caret.start, cell.textContent.length), Math.min(caret.end, cell.textContent.length));
    updateRevealedNodes();
  }

  /** Relit le tableau depuis ses cellules — la source de vérité à l'écran. */
  function readTable(blockEl) {
    const rows = [...blockEl.querySelectorAll("tr")];
    const header = [...(rows[0]?.children ?? [])].map((cell) => cell.textContent);
    const align = [...(rows[0]?.children ?? [])].map((cell) => cell.dataset.align || null);
    return { header, align, rows: rows.slice(1).map((row) => [...row.children].map((cell) => cell.textContent)) };
  }

  function commitTable(blockEl) {
    const index = Number(blockEl.dataset.index);
    pushUndoAt(blocks[index]?.start ?? 0);
    commitBlockText(index, window.serializeMarkdownTable(readTable(blockEl)));
  }

  /** Réécrit la structure (ligne/colonne ajoutée ou retirée) puis rend la main
   *  au même endroit : ces boutons servent en pleine saisie, perdre le curseur
   *  à chaque clic les rendrait inutilisables. */
  function rewriteTable(blockEl, table, row, col) {
    const index = Number(blockEl.dataset.index);
    pushUndoAt(blocks[index]?.start ?? 0);
    commitBlockText(index, window.serializeMarkdownTable(table));
    buildTableBlock(blockEl, table);
    focusCell(blockEl, row, col);
  }

  function cellPosition(blockEl, cell) {
    const rows = [...blockEl.querySelectorAll("tr")];
    const row = rows.findIndex((r) => r.contains(cell));
    return { row, col: row === -1 ? -1 : [...rows[row].children].indexOf(cell) };
  }

  function focusCell(blockEl, row, col) {
    const rows = [...blockEl.querySelectorAll("tr")];
    const target = rows[Math.max(0, Math.min(row, rows.length - 1))];
    const cell = target?.children[Math.max(0, Math.min(col, target.children.length - 1))];
    if (!cell) return false;
    cell.focus();
    setCaretIn(cell, cell.textContent.length);
    updateRevealedNodes();
    return true;
  }

  const emptyRow = (width) => Array.from({ length: width }, () => "");

  function buildTableControls(blockEl) {
    const bar = document.createElement("div");
    bar.className = "live-table-controls";
    // Contenteditable=false : sans ça, les boutons feraient partie du texte
    // éditable du bloc et se retrouveraient dans la source.
    bar.setAttribute("contenteditable", "false");

    const act = (label, title, run) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "live-table-btn";
      button.textContent = label;
      button.title = title;
      // Sans ça, le bouton prendrait le focus et on perdrait la cellule
      // courante — celle sur laquelle l'action doit justement porter.
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => run());
      bar.appendChild(button);
    };

    const current = () => {
      const cell = blockEl.contains(document.activeElement) ? document.activeElement.closest(".live-cell") : null;
      const position = cell ? cellPosition(blockEl, cell) : { row: -1, col: -1 };
      return { table: readTable(blockEl), ...position };
    };

    act("+ ligne", "Ajouter une ligne sous la ligne courante", () => {
      const { table, row, col } = current();
      const at = row <= 0 ? table.rows.length : row; // depuis l'en-tête, la ligne va à la fin
      table.rows.splice(at, 0, emptyRow(table.header.length));
      rewriteTable(blockEl, table, at + 1, Math.max(col, 0));
    });
    act("+ colonne", "Ajouter une colonne après la colonne courante", () => {
      const { table, row, col } = current();
      const at = col < 0 ? table.header.length : col + 1;
      table.header.splice(at, 0, "");
      table.align.splice(at, 0, null);
      for (const line of table.rows) line.splice(at, 0, "");
      rewriteTable(blockEl, table, Math.max(row, 0), at);
    });
    act("− ligne", "Retirer la ligne courante", () => {
      const { table, row, col } = current();
      // L'en-tête ne se retire pas : un tableau markdown sans en-tête n'existe
      // pas, il redeviendrait du texte.
      if (row <= 0 || table.rows.length === 0) return;
      table.rows.splice(row - 1, 1);
      rewriteTable(blockEl, table, Math.min(row, table.rows.length), Math.max(col, 0));
    });
    act("− colonne", "Retirer la colonne courante", () => {
      const { table, row, col } = current();
      if (col < 0 || table.header.length <= 1) return;
      table.header.splice(col, 1);
      table.align.splice(col, 1);
      for (const line of table.rows) line.splice(col, 1);
      rewriteTable(blockEl, table, Math.max(row, 0), Math.max(0, col - 1));
    });
    // En dernier, après les retraits partiels : un tableau n'étant pas
    // lui-même une zone éditable, aucune touche ne pouvait l'effacer depuis
    // l'intérieur — sans ce bouton, pas moyen de s'en débarrasser.
    act("Supprimer", "Supprimer ce tableau", () => {
      removeBlock(Number(blockEl.dataset.index));
    });

    return bar;
  }

  function handleCellKeydown(event, blockEl, cell) {
    const index = Number(blockEl.dataset.index);
    const rows = [...blockEl.querySelectorAll("tr")];
    const { row, col } = cellPosition(blockEl, cell);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undoLastChange();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cell.blur();
      return;
    }

    // Tabulation : la cellule suivante, et une ligne de plus quand on sort par
    // le bas. C'est le geste par lequel on remplit un tableau.
    if (event.key === "Tab") {
      event.preventDefault();
      const step = event.shiftKey ? -1 : 1;
      const width = rows[0].children.length;
      const flat = row * width + col + step;
      if (flat < 0) return;
      if (flat >= rows.length * width) {
        const table = readTable(blockEl);
        table.rows.push(emptyRow(table.header.length));
        rewriteTable(blockEl, table, table.rows.length, 0);
        return;
      }
      focusCell(blockEl, Math.floor(flat / width), flat % width);
      return;
    }

    // Entrée descend d'une ligne dans la même colonne, et crée la ligne si on
    // est déjà en bas. Elle n'insère jamais de saut de ligne : une cellule
    // markdown tient sur une ligne.
    if (event.key === "Enter") {
      event.preventDefault();
      if (row < rows.length - 1) {
        focusCell(blockEl, row + 1, col);
        return;
      }
      const table = readTable(blockEl);
      table.rows.push(emptyRow(table.header.length));
      rewriteTable(blockEl, table, table.rows.length, col);
      return;
    }

    // Aux bords du tableau, les flèches sortent vers les blocs voisins : sans
    // ça, un tableau en tête ou en fin de document serait un cul-de-sac.
    const caret = caretRangeIn(cell);
    if (!caret || caret.start !== caret.end) return;
    if (event.key === "ArrowUp" && row === 0 && index > 0) {
      event.preventDefault();
      focusBlock(index - 1, "end");
    } else if (event.key === "ArrowDown" && row === rows.length - 1 && index < blocks.length - 1) {
      event.preventDefault();
      focusBlock(index + 1, "start");
    } else if (event.key === "ArrowLeft" && caret.start === 0 && (row > 0 || col > 0)) {
      event.preventDefault();
      const width = rows[0].children.length;
      const flat = row * width + col - 1;
      focusCell(blockEl, Math.floor(flat / width), flat % width);
    } else if (event.key === "ArrowRight" && caret.start === cell.textContent.length) {
      const width = rows[0].children.length;
      const flat = row * width + col + 1;
      if (flat >= rows.length * width) return;
      event.preventDefault();
      focusCell(blockEl, Math.floor(flat / width), flat % width);
    }
  }

  function handleBlockInput(blockEl) {
    const index = Number(blockEl.dataset.index);
    const caret = caretRangeIn(blockEl);
    const text = blockEl.textContent;

    // L'instantané précède le report : ce qu'on veut pouvoir retrouver, c'est
    // l'état d'où l'on vient, pas celui qu'on est en train d'écrire.
    pushUndoSnapshot(index, caret ? caret.start : text.length);
    commitBlockText(index, text);

    // Le texte est enregistré, mais l'habillage attend la fin de la composition.
    if (composingBlock === blockEl) return;

    // Redécoré à chaque frappe : c'est ce qui fait apparaître le gras dès que sa
    // deuxième étoile est tapée. Le curseur est reposé à la même position dans
    // le texte, la décoration n'étant qu'un habillage.
    decorateBlock(blockEl, text);
    if (caret) setCaretIn(blockEl, caret.start, caret.end);
    updateRevealedNodes();
  }

  /**
   * Insère du texte à la position du curseur, en passant par la source plutôt
   * que par le DOM.
   *
   * On n'utilise pas `document.execCommand("insertText")` : dans un
   * contenteditable, il n'insère pas les fins de ligne (contrairement à une zone
   * de saisie) tout en émettant quand même un événement `input`. Une touche
   * Entrée déclenchait donc un enregistrement sans rien écrire.
   *
   * Ici, le texte du bloc et la position du curseur suffisent à calculer le
   * résultat : c'est le même chemin que la barre d'outils, et il ne dépend
   * d'aucun comportement d'édition du navigateur.
   */
  function replaceInBlock(blockEl, from, to, inserted, caretAfter) {
    const index = Number(blockEl.dataset.index);
    const text = blockEl.textContent;
    const next = text.slice(0, from) + inserted + text.slice(to);

    pushUndoSnapshot(index, from);
    commitBlockText(index, next);
    decorateBlock(blockEl, next);
    setCaretIn(blockEl, caretAfter ?? from + inserted.length);
    updateRevealedNodes();
  }

  function insertIntoBlock(blockEl, inserted) {
    const text = blockEl.textContent;
    const caret = caretRangeIn(blockEl) ?? { start: text.length, end: text.length };
    replaceInBlock(blockEl, caret.start, caret.end, inserted);
  }

  /** Étendue de la ligne qui contient un décalage donné. */
  function handleListEnter(blockEl) {
    if (!window.matchListLine) return false;
    const text = blockEl.textContent;
    const caret = caretRangeIn(blockEl);
    if (!caret || caret.start !== caret.end) return false;

    const line = lineRangeAt(text, caret.start);
    const item = window.matchListLine(text.slice(line.start, line.end));
    if (!item) return false;

    if (!item.content.trim()) {
      replaceInBlock(blockEl, line.start, line.end, "", line.start);
      return true;
    }

    const ordered = /\d/.test(item.marker);
    const nextMarker = ordered ? `${parseInt(item.marker, 10) + 1}${item.marker.slice(-1)}` : item.marker;
    insertIntoBlock(blockEl, `\n${item.indent}${nextMarker}${item.space}`);
    return true;
  }

  /** Tab / Maj+Tab : décale l'item d'un niveau, sans toucher au reste de la ligne. */
  function handleListTab(blockEl, outdent) {
    if (!window.matchListLine) return false;
    const text = blockEl.textContent;
    const caret = caretRangeIn(blockEl);
    if (!caret) return false;

    const line = lineRangeAt(text, caret.start);
    const item = window.matchListLine(text.slice(line.start, line.end));
    if (!item) return false;

    if (outdent) {
      const removed = /^ {1,2}|^\t/.exec(item.indent);
      if (!removed) return true; // déjà au premier niveau : la touche reste sans effet
      replaceInBlock(blockEl, line.start, line.start + removed[0].length, "", caret.start - removed[0].length);
    } else {
      replaceInBlock(blockEl, line.start, line.start, "  ", caret.start + 2);
    }
    return true;
  }

  // Collage : on n'accepte que du texte. `plaintext-only` le fait déjà là où il
  // est reconnu ; ce filet couvre les navigateurs qui l'ignorent, pour lesquels
  // l'attribut retombe sur un contenteditable ordinaire — donc capable d'avaler
  // du HTML.
  function handleBlockPaste(event, blockEl) {
    const text = event.clipboardData?.getData("text/plain");
    if (text == null) return;
    event.preventDefault();

    /* Collé dans le DOCUMENT, pas dans le bloc. Un markdown apporte ses
       propres blocs — titres, listes, tableaux, lignes vides. Inséré dans le
       bloc courant, il y restait brut : les lignes vides comme du texte, les
       dièses comme des dièses, puisque rien ne re-découpait la source. Passer
       par elle la fait re-analyser, et le collage prend la forme qu'il
       annonce. */
    const selection = absoluteSelection();
    if (selection && !selection.collapsed) {
      replaceDocumentRange(selection.from, selection.to, text);
      return;
    }
    const at = absoluteCaret();
    if (at == null) {
      insertIntoBlock(blockEl, text);
      return;
    }
    replaceDocumentRange(at, at, text);
  }

  /**
   * Re-découpe le document une fois qu'on n'écrit plus dedans : un bloc peut
   * cesser d'en être un (une ligne vide le scinde, l'effacer le supprime).
   * Différé, et abandonné si le curseur est déjà reparti dans un autre bloc —
   * sinon passer d'un bloc au suivant détruirait celui qu'on vient d'atteindre.
   */
  function scheduleNormalize() {
    clearTimeout(normalizeTimer);
    normalizeTimer = setTimeout(() => {
      if (host.contains(document.activeElement)) return;
      if (destroyed || !doc.isActive()) return;
      render();
    }, 0);
  }

  /**
   * Reporte le texte d'un bloc dans le document. Seule la tranche du bloc est
   * remplacée ; les blocs suivants voient leurs décalages glisser d'autant, ce
   * qui évite de re-découper le fichier à chaque touche.
   */
  function commitBlockText(index, text) {
    const block = blocks[index];
    if (!block) return;

    /* Ligne d'appoint posée autour d'un tableau (voir render) : elle n'a pas
       encore d'existence dans la source. La première frappe l'y écrit, avec le
       saut de ligne double qui la détache du tableau — sans lui, le texte se
       collerait au tableau et le corromprait. Vidée à nouveau, elle redevient
       ce qu'elle était : rien. */
    if (block.synthetic) {
      const current = doc.getContent();
      if (!text) return;
      const avant = block.synthetic === "leading";
      const separateur = "\n\n";
      doc.setContent(avant ? text + separateur + current : current + separateur + text);
      const decalage = text.length + separateur.length;
      block.start = avant ? 0 : current.length + separateur.length;
      block.end = block.start + text.length;
      block.text = text;
      delete block.synthetic;
      // Les blocs qui suivent se décalent d'autant quand l'ajout est en tête.
      if (avant) {
        for (let i = index + 1; i < blocks.length; i++) {
          blocks[i].start += decalage;
          blocks[i].end += decalage;
        }
      }
      return;
    }

    // Les bornes d'origine sont relevées AVANT d'être bougées : c'est sur elles
    // que se découpe le document, pas sur les nouvelles.
    const from = block.start;
    const to = block.end;
    const delta = text.length - (to - from);
    const current = doc.getContent();

    block.text = text;
    block.end = from + text.length;
    for (let i = index + 1; i < blocks.length; i++) {
      blocks[i].start += delta;
      blocks[i].end += delta;
    }
    doc.setContent(current.slice(0, from) + text + current.slice(to));
  }

  /* ---- Révélation de la syntaxe ----
     Les marqueurs masqués reparaissent pour le seul fragment où se trouve le
     curseur : le mot en gras qu'on retouche, le titre dont on change le niveau.
     C'est le geste d'Obsidian, et la raison pour laquelle l'édition peut rester
     invisible le reste du temps. */

  function updateRevealedNodes() {
      for (const node of host.querySelectorAll(".on")) node.classList.remove("on");

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    let node = selection.getRangeAt(0).startContainer;
    if (!host.contains(node)) return;

    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const fragment = node?.closest?.(".md-i");
    if (fragment) fragment.classList.add("on");
    // La ligne de liste porteuse du curseur montre son marqueur source à la
    // place de sa puce — l'un et l'autre occupant la même gouttière.
    const item = node?.closest?.(".md-li");
    if (item) item.classList.add("on");
    const block = node?.closest?.(".live-block");
    if (block) block.classList.add("on");
  }

  function pushUndoSnapshot(index, caret) {
    const block = blocks[index];
    pushUndoAt(block ? block.start + caret : 0);
  }

  /** Le repère est absolu dans le document, jamais un couple bloc/décalage :
   *  annuler re-découpe le texte, et les index de blocs d'avant ne désignent
   *  plus rien après coup. */
  function pushUndoAt(offset) {
    const now = Date.now();
    // Un instantané par salve de frappe : annuler doit défaire un mot ou une
    // phrase, pas une lettre.
    if (now - undo.lastAt < UNDO_INTERVAL_MS) return;
    undo.lastAt = now;
    undo.entries.push({ content: doc.getContent(), offset });
    if (undo.entries.length > UNDO_DEPTH) undo.entries.shift();
  }

  function undoLastChange() {
    const entry = undo.entries.pop();
    if (!entry) return false;
    undo.lastAt = 0;
    doc.setContent(entry.content);
    render();
    restoreCaret(entry.offset);
    return true;
  }

  /* ---- Clavier ---- */

  function focusBlock(index, position) {
    const blockEl = host.querySelector(`.live-block[data-index="${index}"]`);
    if (!blockEl) return false;
    if (blockEl.dataset.kind === "table") {
      const rows = blockEl.querySelectorAll("tr");
      return focusCell(blockEl, position === "start" ? 0 : rows.length - 1, 0);
    }
    blockEl.focus();
    setCaretIn(blockEl, position === "start" ? 0 : blockEl.textContent.length);
    updateRevealedNodes();
    return true;
  }

  function handleBlockKeydown(event, blockEl) {
    const index = Number(blockEl.dataset.index);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undoLastChange();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      blockEl.blur();
      return;
    }
    // Tout sélectionner porte sur la note entière, pas sur le paragraphe où se
    // trouve le curseur : sans ça, copier son texte demandait de le faire bloc
    // par bloc.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectWholeDocument();
      return;
    }

    // Une sélection qui enjambe plusieurs blocs : le navigateur la laisserait
    // à moitié éditée (chaque bloc lui est une zone séparée). On l'applique
    // nous-mêmes sur le document.
    const spanning = absoluteSelection();
    if (spanning && !spanning.collapsed && !spanning.sameBlock) {
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        replaceDocumentRange(spanning.from, spanning.to, "");
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        replaceDocumentRange(spanning.from, spanning.to, "\n");
        return;
      }
      // Une touche de caractère remplace la sélection, comme partout ailleurs.
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        replaceDocumentRange(spanning.from, spanning.to, event.key);
        return;
      }
      // Tout le reste (flèches, Échap, raccourcis) sort de la sélection : la
      // laisser peinte ferait croire qu'elle porte encore.
      if (!event.ctrlKey && !event.metaKey) clearSpanning();
    }
    // Entrée insère un vrai caractère de fin de ligne, écrit dans la source.
    // Laissée au navigateur, elle produirait selon les cas un <br> — invisible
    // dans `textContent`, donc un saut de ligne perdu à l'enregistrement. Le
    // bloc étant en `white-space: pre-wrap`, le « \n » suffit à l'affichage.
    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      // Dans une liste, Entrée poursuit la liste ; ailleurs elle insère
      // simplement le saut de ligne.
      if (!event.shiftKey && handleListEnter(blockEl)) return;
      insertIntoBlock(blockEl, "\n");
      return;
    }
    // Tab n'a d'usage que dans une liste. Ailleurs on le laisse au navigateur,
    // qui passe au bloc suivant — un caractère de tabulation n'aurait rien à
    // faire au milieu d'un paragraphe markdown.
    if (event.key === "Tab" && handleListTab(blockEl, event.shiftKey)) {
      event.preventDefault();
      return;
    }

    // Aux bords du bloc, les flèches passent au bloc voisin : sans cela, chaque
    // bloc étant une zone éditable distincte, le curseur y resterait prisonnier.
    const caret = caretRangeIn(blockEl);
    if (!caret || caret.start !== caret.end) return;

    // Retour arrière en tout début de bloc : les deux blocs n'en font plus
    // qu'un, séparateur compris. C'est le geste attendu de tout éditeur, et
    // sans lui on ne pouvait tout simplement pas recoller deux paragraphes.
    if (event.key === "Backspace" && caret.start === 0 && index > 0) {
      event.preventDefault();
      // Fusionner du texte dans un tableau n'aurait aucun sens : au contact
      // d'un tableau, ces touches le suppriment. C'est réversible (Ctrl+Z), et
      // c'est le seul geste clavier qui permette de s'en débarrasser.
      if (blocks[index - 1].kind === "table") removeBlock(index - 1);
      else replaceDocumentRange(blocks[index - 1].end, blocks[index].start, "");
      return;
    }
    // Suppr en toute fin de bloc : la même chose, vue de l'autre côté.
    if (
      event.key === "Delete" &&
      caret.start === blockEl.textContent.length &&
      index < blocks.length - 1
    ) {
      event.preventDefault();
      if (blocks[index + 1].kind === "table") removeBlock(index + 1);
      else replaceDocumentRange(blocks[index].end, blocks[index + 1].start, "");
      return;
    }

    if (event.key === "ArrowUp" && caret.start === 0 && index > 0) {
      event.preventDefault();
      focusBlock(index - 1, "end");
    } else if (
      event.key === "ArrowDown" &&
      caret.start === blockEl.textContent.length &&
      index < blocks.length - 1
    ) {
      event.preventDefault();
      focusBlock(index + 1, "start");
    }
  }

  function runMarkdownTool(tool) {
    // Aucun repli vers la zone de saisie brute ici : la barre n'existe que là
    // où cette instance est montée. L'ancienne version, globale, visait en dur
    // les éléments de l'onglet Fichiers — depuis le bloc-notes elle écrivait
    // donc dans un champ invisible, quand elle ne plantait pas.
    // Dans une cellule de tableau, l'outil s'applique à la cellule seule.
    const cell = host.contains(document.activeElement) ? document.activeElement.closest(".live-cell") : null;
    if (cell) {
      // Un titre, une liste ou un tableau n'ont pas de place dans une cellule :
      // les y insérer casserait la ligne en deux à la relecture.
      if (tool.group === "bloc") return;
      const caret = caretRangeIn(cell) ?? { start: cell.textContent.length, end: cell.textContent.length };
      const shim = { value: cell.textContent, selectionStart: caret.start, selectionEnd: caret.end };
      tool.run(shim);
      cell.innerHTML = shim.value ? window.decorateMarkdownInline(shim.value) : "";
      commitTable(cell.closest(".live-block"));
      cell.focus();
      setCaretIn(cell, shim.selectionStart, shim.selectionEnd);
      updateRevealedNodes();
      return;
    }

    let blockEl = host.contains(document.activeElement)
      ? document.activeElement.closest(".live-block")
      : null;
    if (!blockEl) {
      focusBlock(blocks.length - 1, "end");
      blockEl = host.querySelector(`.live-block[data-index="${blocks.length - 1}"]`);
      if (!blockEl) return;
    }

    const caret = caretRangeIn(blockEl) ?? { start: blockEl.textContent.length, end: blockEl.textContent.length };
    const shim = { value: blockEl.textContent, selectionStart: caret.start, selectionEnd: caret.end };
    tool.run(shim);

    const index = Number(blockEl.dataset.index);
    commitBlockText(index, shim.value);

    // Un outil de bloc change la NATURE de ce qui est écrit (un tableau, un
    // bloc de code, un filet) : il faut re-découper pour que le résultat
    // s'affiche tout de suite sous sa vraie forme, plutôt que d'attendre que
    // l'utilisateur clique ailleurs.
    if (tool.group === "bloc") {
      const offset = (blocks[index]?.start ?? 0) + shim.selectionStart;
      render();
      restoreCaret(offset);
      return;
    }

    decorateBlock(blockEl, shim.value);
    blockEl.focus();
    setCaretIn(blockEl, shim.selectionStart, shim.selectionEnd);
    updateRevealedNodes();
  }

  /* ---- Branchements de l'instance ---- */

  // Les marqueurs masqués reparaissent pour le seul fragment où se trouve le
  // curseur. Le déplacement à la souris ou aux flèches ne passe par aucune de
  // nos fonctions : seul « selectionchange » le voit.
  const onSelectionChange = () => {
    if (destroyed || !host.isConnected || host.classList.contains("hidden")) return;
    updateRevealedNodes();
  };
  document.addEventListener("selectionchange", onSelectionChange);

  /* Copier une sélection qui enjambe plusieurs blocs : le navigateur rend une
     chaîne vide (`selection.toString()` ignore une sélection à cheval sur
     plusieurs zones éditables), si bien que Ctrl+A puis Ctrl+C ne copiait
     rien. On écrit donc la tranche nous-mêmes — et depuis la SOURCE, ce qui
     rend le markdown avec ses séparateurs, pas le texte aplati du DOM. */
  const onCopyOrCut = (event) => {
    const selection = absoluteSelection();
    if (!selection || selection.collapsed || selection.sameBlock) return; // le navigateur s'en sort
    event.preventDefault();
    event.clipboardData?.setData("text/plain", doc.getContent().slice(selection.from, selection.to));
    if (event.type === "cut") replaceDocumentRange(selection.from, selection.to, "");
  };
  host.addEventListener("copy", onCopyOrCut);
  host.addEventListener("cut", onCopyOrCut);

  // Cliquer sous le dernier bloc reprend l'écriture à la fin du document.
  const onHostMouseDown = (event) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    focusBlock(blocks.length - 1, "end");
  };
  host.addEventListener("mousedown", onHostMouseDown);

  /* ---- Sélection à la souris par-dessus plusieurs blocs ----
     Chaque bloc est une zone éditable distincte, et le navigateur borne à
     celle-ci la sélection qu'on étend à la souris : impossible d'en tirer une
     qui enjambe deux paragraphes, alors que tout le reste du composant
     (copier, couper, taper ou effacer par-dessus) sait déjà les traiter.

     Reposer la sélection native à cheval ne marche pas : la machinerie
     d'édition du navigateur la ramène aussitôt dans le bloc de départ. On ne
     lui dispute donc pas le terrain — on garde la sélection chez nous, en
     positions absolues, et on la PEINT avec l'API Highlight, dont les portées
     ne sont jamais des sélections et n'ont donc aucun bloc à respecter. La
     sélection native, elle, est réduite à un curseur dans le bloc d'ancrage :
     c'est lui qui continue de recevoir les frappes. */

  /** Sélection multi-blocs en cours, en positions absolues. Null = aucune. */
  let spanning = null;
  let dragAnchor = null;

  /* Nom fixe, imposé par `::highlight()` qui ne prend pas de nom calculé. Un
     seul éditeur est visible à la fois (page Agent, bloc-notes, onglet
     fichier) ; la portée est effacée au démontage de l'instance. */
  const highlightKey = "allkin-md-selection";
  const canPaint = typeof Highlight === "function" && typeof CSS !== "undefined" && Boolean(CSS.highlights);

  /** Le point du DOM sous le pointeur, quel que soit le navigateur. */
  function caretFromPoint(x, y) {
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      return range ? { node: range.startContainer, offset: range.startOffset } : null;
    }
    const position = document.caretPositionFromPoint?.(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }

  /** Repeint la sélection multi-blocs, portion de bloc par portion de bloc. */
  function paintSpanning() {
    if (!canPaint) return;
    if (!spanning || spanning.from >= spanning.to) {
      CSS.highlights.delete(highlightKey);
      return;
    }
    const ranges = [];
    blocks.forEach((block, index) => {
      // Le bloc d'ancrage garde le surlignage du navigateur : le repeindre
      // par-dessus donnerait deux teintes superposées.
      if (index === spanning.anchorIndex) return;
      const from = Math.max(spanning.from, block.start);
      const to = Math.min(spanning.to, block.end);
      if (from >= to) return;
      const blockEl = host.querySelector(`.live-block[data-index="${index}"]`);
      if (!blockEl || blockEl.dataset.kind === "table") return; // un tableau se prend en entier
      const range = rangeIn(blockEl, from - block.start, to - block.start);
      if (range) ranges.push(range);
    });
    if (ranges.length === 0) {
      CSS.highlights.delete(highlightKey);
      return;
    }
    CSS.highlights.set(highlightKey, new Highlight(...ranges));
  }

  /** Oublie la sélection multi-blocs. Tout geste qui ne porte pas dessus l'annule. */
  function clearSpanning() {
    if (!spanning) return;
    spanning = null;
    if (canPaint) CSS.highlights.delete(highlightKey);
  }

  const onDragStart = (event) => {
    clearSpanning();
    if (event.button !== 0) return;
    const point = caretFromPoint(event.clientX, event.clientY);
    if (!point || !host.contains(point.node)) {
      dragAnchor = null;
      return;
    }
    const offset = absoluteOffset(point.node, point.offset, "start");
    dragAnchor = offset == null ? null : { point, offset };
  };

  const onDragMove = (event) => {
    // Navigateur sans l'API Highlight : on ne suit rien. Une sélection qu'on ne
    // peut pas montrer serait pire que pas de sélection du tout — l'utilisateur
    // croirait n'avoir rien pris, et Ctrl+C emporterait tout un pan du texte.
    if (!canPaint) return;
    // event.buttons vaut 0 si le bouton a été relâché hors de la fenêtre.
    if (!dragAnchor || event.buttons !== 1) return;
    const point = caretFromPoint(event.clientX, event.clientY);
    if (!point || !host.contains(point.node)) return;
    if (nodeBlock(point.node) === nodeBlock(dragAnchor.point.node)) {
      // Toujours dans le bloc de départ : le navigateur s'en sort seul, et sa
      // sélection reste la bonne.
      clearSpanning();
      return;
    }
    const offset = absoluteOffset(point.node, point.offset, "end");
    if (offset == null) return;

    /* On laisse au navigateur SA sélection dans le bloc d'ancrage, et on ne
       peint que les autres. Deux raisons : pas de double surlignage là où il
       affiche déjà le sien, et surtout une sélection native non vide — sans
       elle, Ctrl+C n'émet aucun événement `copy` et la copie ne part jamais. */
    const anchorEl = nodeBlock(dragAnchor.point.node);
    spanning = {
      from: Math.min(dragAnchor.offset, offset),
      to: Math.max(dragAnchor.offset, offset),
      anchorIndex: anchorEl ? Number(anchorEl.dataset.index) : null,
    };
    paintSpanning();
  };

  const onDragEnd = () => {
    dragAnchor = null;
  };

  host.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);

  if (toolbar) buildToolbar(toolbar, runMarkdownTool);

  /* ---- Édition au niveau du document -----------------------------------
     Chaque bloc est une zone éditable distincte : le navigateur ne sait donc
     ni fusionner deux blocs, ni éditer une sélection qui les enjambe. Ces
     gestes-là (retour arrière en début de paragraphe, Suppr en fin, tout
     sélectionner puis taper) sont repris ici, en positions absolues dans le
     texte — la seule échelle où le document existe vraiment. */

  function nodeBlock(node) {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return element?.closest?.(".live-block") ?? null;
  }

  /** Position d'un point du DOM dans le document entier. */
  function absoluteOffset(container, offset, side) {
    // La sélection peut porter sur l'hôte lui-même (Ctrl+A) : elle vaut alors
    // le document entier.
    if (container === host) {
      const block = side === "start" ? blocks[0] : blocks[blocks.length - 1];
      return block ? (side === "start" ? block.start : block.end) : null;
    }
    const blockEl = nodeBlock(container);
    const block = blockEl ? blocks[Number(blockEl.dataset.index)] : null;
    if (!block) return null;
    // Un tableau ne se coupe pas en son milieu : une sélection qui le touche
    // le prend en entier. Le découper à la position d'une cellule écrirait
    // n'importe où dans la source.
    if (blockEl.dataset.kind === "table") return side === "start" ? block.start : block.end;
    const before = document.createRange();
    before.selectNodeContents(blockEl);
    before.setEnd(container, offset);
    return block.start + before.toString().length;
  }

  /** La sélection courante, en positions absolues. Null si elle est ailleurs. */
  function absoluteSelection() {
    // La sélection multi-blocs est la nôtre (voir plus haut) : la sélection
    // native n'en garde qu'un curseur, elle ne dirait rien d'utile ici.
    if (spanning && spanning.from < spanning.to) {
      return { from: spanning.from, to: spanning.to, collapsed: false, sameBlock: false };
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (range.startContainer !== host && !host.contains(range.startContainer)) return null;
    const from = absoluteOffset(range.startContainer, range.startOffset, "start");
    const to = absoluteOffset(range.endContainer, range.endOffset, "end");
    if (from == null || to == null) return null;
    const startBlock = nodeBlock(range.startContainer);
    return {
      from: Math.min(from, to),
      to: Math.max(from, to),
      collapsed: from === to,
      // « Dans un seul bloc » : le navigateur sait s'en charger tout seul.
      sameBlock: startBlock !== null && startBlock === nodeBlock(range.endContainer),
    };
  }

  /** Remplace une tranche du document, re-découpe, et repose le curseur. */
  function replaceDocumentRange(from, to, inserted) {
    const content = doc.getContent();
    pushUndoAt(from);
    doc.setContent(content.slice(0, from) + inserted + content.slice(to));
    render();
    restoreCaret(from + inserted.length);
  }

  /** Retire un bloc entier du document, avec la ligne vide qui l'en sépare —
   *  sinon il resterait un trou à l'endroit de ce qu'on vient de supprimer. */
  function removeBlock(index) {
    const block = blocks[index];
    if (!block) return;
    const content = doc.getContent();
    let from = block.start;
    let to = block.end;
    const after = /^\n+/.exec(content.slice(to));
    if (after) {
      to += after[0].length;
    } else {
      const before = /\n+$/.exec(content.slice(0, from));
      if (before) from -= before[0].length;
    }
    replaceDocumentRange(from, to, "");
  }

  function selectWholeDocument() {
    // Portée native sur l'hôte : le navigateur l'accepte quand on la lui pose
    // d'un bloc (contrairement à celle qu'on étend à la souris), et c'est ce
    // qui fait partir la copie.
    clearSpanning();
    const range = document.createRange();
    range.selectNodeContents(host);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /* ---- Reprise après un changement venu d'ailleurs ----
     Re-découper le document déplace tous les blocs : repérer le curseur par
     son bloc ne suffit pas. On le note en position absolue dans le document,
     et on le repose dans le bloc qui contient cette position — quel que soit
     le nouveau découpage. Sans ça, une note synchronisée pendant qu'on la lit
     renverrait le curseur au début. */

  function absoluteCaret() {
    const blockEl = host.contains(document.activeElement)
      ? document.activeElement.closest(".live-block")
      : null;
    if (!blockEl) return null;
    const block = blocks[Number(blockEl.dataset.index)];
    if (!block) return null;
    // Dans un tableau, la position dans une cellule ne correspond à rien dans
    // la source (les barres et les espaces d'alignement n'existent qu'à
    // l'écrit) : on repose le curseur au début du bloc, donc dans sa première
    // cellule. Approximatif, mais jamais faux.
    if (blockEl.dataset.kind === "table") return block.start;
    const caret = caretRangeIn(blockEl);
    return caret ? block.start + caret.start : null;
  }

  function restoreCaret(offset) {
    if (offset == null || blocks.length === 0) return;
    const found = blocks.findIndex((block) => offset <= block.end);
    const index = found === -1 ? blocks.length - 1 : found;
    const block = blocks[index];
    const blockEl = host.querySelector(`.live-block[data-index="${index}"]`);
    if (!block || !blockEl) return;
    if (blockEl.dataset.kind === "table") {
      focusCell(blockEl, 0, 0);
      return;
    }
    blockEl.focus();
    setCaretIn(blockEl, Math.max(0, Math.min(offset - block.start, blockEl.textContent.length)));
    updateRevealedNodes();
  }

  function reload() {
    const offset = absoluteCaret();
    render();
    restoreCaret(offset);
  }

  return {
    render,
    /** Reprend la main sur le texte après un changement venu d'ailleurs
     *  (rechargement, synchronisation), sans perdre le curseur. */
    reload,
    focus: (position = "end") => focusBlock(position === "start" ? 0 : blocks.length - 1, position),
    /** Vrai si le curseur est dans cet éditeur — l'appelant s'en sert pour ne
     *  pas écraser une frappe en cours avec une mise à jour distante. */
    isFocused: () => host.contains(document.activeElement),
    destroy() {
      destroyed = true;
      clearTimeout(normalizeTimer);
      document.removeEventListener("selectionchange", onSelectionChange);
      host.removeEventListener("mousedown", onHostMouseDown);
      host.removeEventListener("mousedown", onDragStart);
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup", onDragEnd);
      clearSpanning();
      host.removeEventListener("copy", onCopyOrCut);
      host.removeEventListener("cut", onCopyOrCut);
      host.innerHTML = "";
      undo.entries.length = 0;
    },
  };
}

/** Peuple une barre d'outils pour une instance donnée. */
function buildToolbar(container, run) {
  container.innerHTML = "";
  let previousGroup = null;
  for (const tool of MD_TOOLS) {
    if (previousGroup && tool.group !== previousGroup) {
      const separator = document.createElement("span");
      separator.className = "md-toolbar-sep";
      container.appendChild(separator);
    }
    previousGroup = tool.group;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `md-tool${tool.className ? ` ${tool.className}` : ""}`;
    btn.textContent = tool.label;
    btn.title = tool.title;
    // Sans cela, appuyer sur un bouton retirerait le focus du bloc — qui se
    // refermerait avant même que le clic ne soit traité.
    btn.addEventListener("mousedown", (event) => event.preventDefault());
    btn.addEventListener("click", () => run(tool));
    container.appendChild(btn);
  }
}


window.Allkin.provide("markdown-editor", { create: createLiveMarkdownEditor });

})();
