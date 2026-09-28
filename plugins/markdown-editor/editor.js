"use strict";
/* ============================================================================
   Plugin « Éditeur markdown » — l'éditeur d'Allkin.
   ----------------------------------------------------------------------------
   Fournit la capacité « markdown-editor » :

     Allkin.capability("markdown-editor").create({ host, toolbar, doc, spellcheck, files })

   qui rend une instance autonome : { render, reload, focus, isFocused, destroy }.

   `doc` est le seul lien avec le texte :
     getContent()  -> le markdown courant, tenu par l'appelant ;
     setContent(t) -> le texte a changé (l'appelant enregistre, marque sale…).

   `files`, facultatif, dit où vont les fichiers qu'on ajoute au document :
     upload(file)         -> Promise<{ src, name }> : range le fichier, rend le
                             chemin à écrire dans le markdown ;
     resolve(src, usage)  -> l'adresse d'un chemin local, ou null. `usage` vaut
                             "image" (affichage) ou "open" (lien qu'on ouvre).
   Sans lui, une image ne s'ajoute que par son adresse web, et un fichier déposé
   est laissé à la page qui héberge l'éditeur.

   LE PRINCIPE
   -----------
   On n'édite pas la source : on édite le document. Un titre est un titre, un
   tableau un tableau, et aucune balise markdown n'apparaît jamais. Le markdown
   n'existe qu'aux deux bouts — lu à l'ouverture, réécrit à chaque changement
   (model.js) — et le bouton « Markdown brut » le montre à qui veut le voir.

   Tout le document est UNE zone éditable. Le navigateur y fait ce qu'il fait
   bien (frappe, sélection, correcteur, flèches) ; tout ce qui touche à la
   structure — Entrée, effacer entre deux blocs, coller, mettre en forme — est
   repris ici, parce que c'est là qu'il laisse un DOM imprévisible.
   ========================================================================== */
(() => {

const MDE = window.AllkinMde;
const { ZWSP, isList, make, icon } = MDE;

const TEXTBLOCKS = "p,h1,h2,h3,h4,h5,h6,li,td,th,pre";
const MARK_TAGS = { strong: "STRONG", em: "EM", del: "DEL", code: "CODE" };
const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "BLOCKQUOTE", "PRE", "HR", "DIV", "TABLE"]);
const IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/i;
const HOSTS_KEY = "allkin.markdown-editor.image-hosts";
const UNDO_DEPTH = 100;
const PLACEHOLDER = "Écris ici… ou tape « / » pour insérer un bloc";

const indexOf = (node) => Array.prototype.indexOf.call(node.parentNode.childNodes, node);
const isHeading = (el) => /^H[1-6]$/.test(el?.tagName ?? "");
const isCell = (el) => el?.tagName === "TD" || el?.tagName === "TH";
const isTableWrap = (el) => el?.nodeType === 1 && el.classList.contains("mde-table-wrap");
const isAtom = (el) => el?.nodeType === 1 && (el.tagName === "HR" || el.tagName === "PRE" || isTableWrap(el));
const bare = (text) => text.replaceAll(ZWSP, "");

function emptyParagraph() {
  const p = document.createElement("p");
  p.appendChild(document.createElement("br"));
  return p;
}

function toast(message, kind = "ko") {
  window.Allkin?.core?.toast?.(message, kind);
}

/* ---- Images distantes ----
   Une image est une requête sortante, déclenchée à l'affichage : dans un
   fichier écrit par un agent, `![](https://ailleurs/p.png?fuite=…)` suffirait à
   faire sortir une information. Le cœur les interdit dans les messages ; ici,
   une image distante reste masquée tant qu'on ne l'a pas demandée. Les hôtes
   acceptés sont retenus : ce sont toujours des choix de l'utilisateur. */

function allowedHosts() {
  try {
    const list = JSON.parse(localStorage.getItem(HOSTS_KEY) ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((h) => typeof h === "string") : []);
  } catch {
    return new Set();
  }
}

function allowHost(host) {
  const hosts = allowedHosts();
  hosts.add(host);
  try {
    localStorage.setItem(HOSTS_KEY, JSON.stringify([...hosts].slice(-200)));
  } catch {
    // stockage indisponible : l'accord vaudra pour cette image seulement
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function placeholderImage(title, detail) {
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const clip = (text) => (text.length > 44 ? `${text.slice(0, 43)}…` : text);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="380" height="76" viewBox="0 0 380 76">' +
    '<rect x="1" y="1" width="378" height="74" rx="9" fill="#8a949122" stroke="#8a949188" stroke-dasharray="5 4"/>' +
    '<g fill="none" stroke="#8a9491" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(20 26)">' +
    '<rect x="0" y="1" width="26" height="22" rx="3"/><circle cx="8" cy="8.5" r="2.2"/><path d="M26 17l-6-6a2.5 2.5 0 00-3.5 0L6 23"/></g>' +
    `<text x="62" y="34" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#8a9491">${esc(title)}</text>` +
    `<text x="62" y="53" font-family="system-ui,sans-serif" font-size="12" fill="#8a9491">${esc(clip(detail))}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Une adresse saisie à la main : « exemple.fr » devient « https://exemple.fr ». */
function normalizeUrl(input) {
  const url = String(input ?? "").trim();
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^[/#.?]/.test(url)) return url;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) return `mailto:${url}`;
  if (/^[^\s/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(url)) return `https://${url}`;
  return url;
}

/* ---- Import de HTML (collage depuis une page web, un traitement de texte) ----
   Le HTML reçu n'est jamais posé dans la page : il est lu dans un document
   inerte (DOMParser — aucun script ne tourne, aucune image ne se charge), puis
   RECONSTRUIT élément par élément, dans le seul vocabulaire de l'éditeur. */

const HTML_SKIP = new Set(["SCRIPT", "STYLE", "META", "LINK", "HEAD", "TITLE", "NOSCRIPT", "TEMPLATE", "SVG", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "IFRAME", "OBJECT", "VIDEO", "AUDIO", "CANVAS"]);
const HTML_BLOCKS = "p,div,section,article,main,header,footer,aside,nav,figure,figcaption,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,table,hr,dl,details";
const HTML_MARKS = { STRONG: "strong", B: "strong", EM: "em", I: "em", DEL: "del", S: "del", STRIKE: "del" };

function importInline(source, target) {
  for (const node of source.childNodes) importNode(node, target);
}

/* Les nœuds lus ne sont JAMAIS déplacés ni clonés vers la page : une image
   adoptée par le document se chargerait aussitôt, et son `onerror` s'exécuterait
   avec. On ne fait que les lire, et l'on crée les nôtres. */
function importNode(node, target) {
  if (node.nodeType === 3) {
    const text = node.data.replace(/\s+/g, " ");
    if (text) target.appendChild(document.createTextNode(text));
    return;
  }
  if (node.nodeType !== 1 || HTML_SKIP.has(node.tagName.toUpperCase())) return;
  const tag = node.tagName.toUpperCase();

  if (tag === "BR") {
    target.appendChild(document.createElement("br"));
    return;
  }
  if (tag === "IMG") {
    const src = node.getAttribute("src") ?? "";
    if (/^https?:\/\//i.test(src)) target.appendChild(MDE.makeImage(node.getAttribute("alt") ?? "", src, "", null));
    return;
  }
  if (tag === "CODE" || tag === "KBD" || tag === "SAMP") {
    const code = document.createElement("code");
    code.textContent = node.textContent;
    if (code.textContent) target.appendChild(code);
    return;
  }
  if (tag === "A" && node.getAttribute("href")) {
    const a = MDE.makeLink(node.getAttribute("href"));
    importInline(node, a);
    if (a.textContent.trim() || a.querySelector("img")) target.appendChild(a);
    return;
  }

  // Un bloc rencontré en plein texte (un <p> dans un <li>) : on en garde le
  // contenu, séparé de ce qui précède par un saut de ligne.
  if (node.matches(HTML_BLOCKS) && target.lastChild && target.lastChild.nodeName !== "BR") {
    target.appendChild(document.createElement("br"));
  }
  const weight = node.style?.fontWeight ?? "";
  const bold = HTML_MARKS[tag] === "strong" ? weight !== "normal" && weight !== "400" : weight === "bold" || Number(weight) >= 600;
  const italic = HTML_MARKS[tag] === "em" || node.style?.fontStyle === "italic";
  const struck = HTML_MARKS[tag] === "del" || /line-through/.test(node.style?.textDecoration ?? "");
  let into = target;
  for (const [on, mark] of [[bold, "strong"], [italic, "em"], [struck, "del"]]) {
    if (on && !into.closest?.(mark)) into = into.appendChild(document.createElement(mark));
  }
  importInline(node, into);
  // Une mise en forme restée vide (un <b> autour d'une image écartée) s'en va.
  while (into !== target && !into.firstChild) {
    const parent = into.parentNode;
    into.remove();
    into = parent;
  }
}

function trimInline(block) {
  const first = block.firstChild;
  if (first?.nodeType === 3) first.data = first.data.replace(/^\s+/, "");
  const last = block.lastChild;
  if (last?.nodeType === 3) last.data = last.data.replace(/\s+$/, "");
  while (block.lastChild?.nodeName === "BR") block.lastChild.remove();
  return block;
}

const hasContent = (block) => Boolean(block.textContent.trim() || block.querySelector("img"));

function importList(source) {
  const list = document.createElement(source.tagName.toUpperCase() === "OL" ? "ol" : "ul");
  for (const item of source.children) {
    if (item.tagName.toUpperCase() !== "LI") continue;
    const li = list.appendChild(document.createElement("li"));
    const box = item.querySelector(":scope > input[type=checkbox], :scope > * > input[type=checkbox]");
    if (box) {
      li.className = "mde-task";
      li.dataset.checked = String(box.checked || box.hasAttribute("checked"));
    }
    const inline = document.createElement("span");
    const nested = [];
    for (const child of [...item.childNodes]) {
      if (child.nodeType === 1 && /^(UL|OL)$/i.test(child.tagName)) nested.push(importList(child));
      else {
        if (child.nodeType === 1 && child.matches(HTML_BLOCKS) && inline.lastChild) inline.appendChild(document.createElement("br"));
        importNode(child, inline);
      }
    }
    trimInline(inline);
    li.append(...inline.childNodes);
    if (!li.firstChild) li.appendChild(document.createElement("br"));
    li.append(...nested);
  }
  return list;
}

function importTable(source) {
  const rows = [...source.querySelectorAll("tr")].filter((row) => row.closest("table") === source);
  if (!rows.length) return null;
  const width = Math.max(...rows.map((row) => row.children.length), 1);
  const blank = () => Array.from({ length: width }, () => "");
  const wrap = MDE.makeTable(blank(), [], rows.slice(1).map(blank), null);
  [...wrap.querySelector("table").rows].forEach((row, r) => {
    [...row.cells].forEach((cell, c) => {
      const from = rows[r].children[c];
      if (!from) return;
      cell.replaceChildren();
      importInline(from, cell);
      trimInline(cell);
      for (const br of cell.querySelectorAll("br")) br.replaceWith(" ");
      if (!cell.firstChild) cell.appendChild(document.createElement("br"));
    });
  });
  return wrap;
}

function importBlocks(container) {
  const out = [];
  let paragraph = null;
  const close = () => {
    if (paragraph && hasContent(trimInline(paragraph))) out.push(paragraph);
    paragraph = null;
  };

  for (const node of container.childNodes) {
    if (node.nodeType === 3) {
      if (!node.data.trim() && !paragraph) continue;
      paragraph ??= document.createElement("p");
      paragraph.appendChild(document.createTextNode(node.data.replace(/\s+/g, " ")));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toUpperCase();
    if (HTML_SKIP.has(tag)) continue;

    if (/^H[1-6]$/.test(tag) || tag === "P") {
      close();
      const block = document.createElement(tag.toLowerCase());
      importInline(node, block);
      if (hasContent(trimInline(block))) out.push(block);
    } else if (tag === "UL" || tag === "OL") {
      close();
      const list = importList(node);
      if (list.firstChild) out.push(list);
    } else if (tag === "BLOCKQUOTE") {
      close();
      const quote = document.createElement("blockquote");
      quote.append(...importBlocks(node));
      if (quote.firstChild) out.push(quote);
    } else if (tag === "PRE") {
      close();
      const lang = /(?:language|lang)-([\w+#.-]+)/.exec(node.querySelector("code")?.className ?? node.className ?? "");
      out.push(MDE.makePre(node.textContent.replace(/\n$/, ""), lang ? lang[1] : ""));
    } else if (tag === "TABLE") {
      close();
      const table = importTable(node);
      if (table) out.push(table);
    } else if (tag === "HR") {
      close();
      out.push(document.createElement("hr"));
    } else if (node.matches(HTML_BLOCKS) || node.querySelector(HTML_BLOCKS)) {
      close();
      out.push(...importBlocks(node));
    } else {
      paragraph ??= document.createElement("p");
      importNode(node, paragraph);
    }
  }
  close();
  return out;
}

function htmlToMarkdown(html) {
  const parsed = new DOMParser().parseFromString(String(html), "text/html");
  return MDE.blocksToMarkdown(importBlocks(parsed.body));
}

/** Le HTML porte-t-il une mise en forme qui vaille d'être gardée ? */
function isRichHtml(html) {
  return /<(strong|b|em|i|h[1-6]|ul|ol|li|table|pre|blockquote|a|img|del|s|code)[\s>]/i.test(html);
}

/* ==========================================================================
   La fabrique
   ========================================================================== */

function createEditor({ host, toolbar = null, doc, spellcheck = false, files = null }) {
  let destroyed = false;
  let composing = false;
  /** Dernier markdown dont on sait qu'il correspond à l'écran. */
  let lastMd = null;
  let tail = "";
  let startedEmpty = true;
  /** Bloc de premier niveau -> { src, gap, seq, dirty } : sa source d'origine. */
  let meta = new WeakMap();
  const touched = new Set();
  const uploads = new Set();
  const history = { undo: [], redo: [], kind: null, at: 0, since: 0 };

  let sourceMode = false;
  let sourceField = null;
  let slash = null;
  let linkBubble = null;
  let imageBubble = null;
  let selectedNode = null;
  let refreshQueued = false;

  host.classList.add("mde-host");
  const root = make("div", "mde-doc");
  root.setAttribute("contenteditable", "true");
  root.setAttribute("role", "textbox");
  root.setAttribute("aria-multiline", "true");
  root.setAttribute("aria-label", "Texte");
  root.dataset.placeholder = PLACEHOLDER;
  root.spellcheck = spellcheck;
  /* Calque posé par-dessus le document : il porte la barre du tableau et le
     repère de dépôt. Hors de la zone éditable, donc jamais dans le texte. */
  const layer = make("div", "mde-layer");
  layer.setAttribute("aria-hidden", "true");
  const dropMark = layer.appendChild(make("div", "mde-drop-mark"));
  dropMark.hidden = true;
  host.replaceChildren(root, layer);

  const ctx = { paintImage };

  /* ---- Images ------------------------------------------------------------ */

  function displayUrl(src) {
    if (/^https?:\/\//i.test(src)) return allowedHosts().has(hostOf(src)) ? { url: src } : { blocked: true };
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(src)) return { url: src };
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return { missing: true };
    const url = files?.resolve?.(src, "image") ?? null;
    return url ? { url } : { missing: true };
  }

  function paintImage(img) {
    const src = img.dataset.src ?? "";
    const shown = displayUrl(src);
    img.classList.toggle("is-blocked", Boolean(shown.blocked));
    img.classList.toggle("is-missing", Boolean(shown.missing));
    if (shown.url) img.src = shown.url;
    else if (shown.blocked) img.src = placeholderImage("Image externe masquée", `${hostOf(src)} — clique pour l'afficher`);
    else img.src = placeholderImage("Image introuvable", src);
  }

  /* ---- Suivi des modifications -------------------------------------------
     Un bloc touché perd le droit d'être réécrit depuis sa source d'origine.
     L'observateur le sait pour nous, quelle que soit la main qui a modifié le
     DOM : la nôtre, celle du navigateur, celle du correcteur. */

  function flushMutations(records = observer.takeRecords()) {
    for (const record of records) {
      if (record.target === root) {
        // Un bloc neuf, posé dans le document : il reste à le mettre d'aplomb.
        for (const node of record.addedNodes) if (node.nodeType === 1) touched.add(node);
        continue;
      }
      let el = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      while (el && el.parentElement !== root) el = el.parentElement;
      if (!el) continue;
      touched.add(el);
      const info = meta.get(el);
      if (info) info.dirty = true;
    }
  }
  const observer = new MutationObserver((records) => flushMutations(records));
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-checked", "data-lang", "data-align", "data-href", "data-src", "data-title", "data-auto", "alt", "start"],
  });

  /* ---- Lecture et écriture ------------------------------------------------ */

  function paint(source) {
    const parsed = MDE.parseDocument(source, ctx);
    root.replaceChildren(...parsed.blocks.map((block) => block.el));
    meta = new WeakMap();
    parsed.blocks.forEach((block, seq) => meta.set(block.el, { src: block.src, gap: block.gap, seq, dirty: false }));
    tail = parsed.blocks.length ? parsed.tail : "";
    startedEmpty = parsed.blocks.length === 0;
    observer.takeRecords();
    touched.clear();
    tidy(true);
    flushMutations();
    touched.clear();
    lastMd = source;
  }

  function serialize() {
    flushMutations();
    let out = "";
    let previous;
    for (const el of root.children) {
      const info = meta.get(el) ?? null;
      const pristine = Boolean(info && !info.dirty);
      const text = pristine ? info.src : MDE.blockToMarkdown(el);
      if (text === null) continue;
      let gap = "\n\n";
      if (previous === undefined) {
        gap = pristine && info.seq === 0 ? info.gap : "";
      } else if (info && previous && info.seq === previous.seq + 1) {
        // L'écart d'origine est gardé entre deux blocs restés voisins. Un bloc
        // qui change de nature est un nouvel élément, sans source : « # Titre »
        // collé à son paragraphe ne le reste pas une fois devenu du texte. Seul
        // un tableau exige sa ligne vide — il avalerait la ligne qui le suit.
        if ((pristine && !previous.dirty) || /\n[ \t]*\n/.test(info.gap) || !isTableWrap(el.previousElementSibling)) gap = info.gap;
      }
      out += gap + text;
      previous = info;
    }
    if (!out) return "";
    return out + (tail || (startedEmpty ? "\n" : ""));
  }

  /** Après toute modification : remet le DOM d'aplomb, puis rend le texte. */
  function commit() {
    if (destroyed || sourceMode) return;
    flushMutations();
    tidy(false);
    flushMutations();
    touched.clear();
    const md = serialize();
    if (md !== lastMd) {
      lastMd = md;
      doc.setContent(md);
    }
    refresh();
  }

  /* ---- Sélection ---------------------------------------------------------- */

  function currentRange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return root.contains(range.startContainer) && root.contains(range.endContainer) ? range : null;
  }

  function setCaret(node, offset) {
    window.getSelection().setBaseAndExtent(node, offset, node, offset);
  }

  function textblockOf(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const block = el?.closest?.(TEXTBLOCKS);
    return block && root.contains(block) && block !== root ? block : null;
  }

  /** Le bloc qui porte `node` au niveau où l'on range les blocs : directement
   *  dans le document, ou dans une citation. */
  function blockOf(node) {
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    while (el && el !== root && el.parentElement !== root && el.parentElement?.tagName !== "BLOCKQUOTE") el = el.parentElement;
    return el && el !== root ? el : null;
  }

  function topBlockOf(node) {
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    while (el && el.parentElement !== root) el = el.parentElement;
    return el ?? null;
  }

  const codeOf = (pre) => pre.querySelector("code") ?? pre;
  const nestedList = (li) => [...li.children].find(isList) ?? null;

  function lastText(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let last = null;
    while (walker.nextNode()) last = walker.currentNode;
    return last;
  }

  /** Le point qui suit le dernier contenu « en ligne » d'un bloc : avant ses
   *  sous-listes, avant le <br> d'appui. */
  function inlineEnd(block) {
    if (block.tagName === "PRE") {
      const text = lastText(codeOf(block));
      if (!text) return { node: codeOf(block), offset: 0 };
      return { node: text, offset: text.data.endsWith("\n") ? text.length - 1 : text.length };
    }
    let last = block.lastChild;
    while (last && (isList(last) || (last.nodeType === 3 && !last.data))) last = last.previousSibling;
    if (!last) return { node: block, offset: 0 };
    if (last.nodeName === "BR") return { node: block, offset: indexOf(last) };
    if (last.nodeType === 3) return { node: last, offset: last.length };
    const text = last.tagName === "IMG" || last.isContentEditable === false ? null : lastText(last);
    return text ? { node: text, offset: text.length } : { node: block, offset: indexOf(last) + 1 };
  }

  function caretToStart(block) {
    if (block.tagName === "PRE") {
      const code = codeOf(block);
      return setCaret(code.firstChild ?? code, 0);
    }
    if (isList(block) || block.tagName === "BLOCKQUOTE" || isTableWrap(block)) {
      const first = block.querySelector(TEXTBLOCKS);
      if (first) return caretToStart(first);
    }
    setCaret(block, 0);
  }

  function caretToEnd(block) {
    if (isList(block) || block.tagName === "BLOCKQUOTE" || isTableWrap(block)) {
      const all = block.querySelectorAll(TEXTBLOCKS);
      if (all.length) return caretToEnd(all[all.length - 1]);
    }
    const end = inlineEnd(block);
    setCaret(end.node, end.offset);
  }

  function selectNode(node) {
    const index = indexOf(node);
    window.getSelection().setBaseAndExtent(node.parentNode, index, node.parentNode, index + 1);
  }

  /** L'élément que la sélection désigne à lui seul (image, filet), ou null. */
  function nodeSelection(range = currentRange()) {
    if (!range || range.collapsed || range.startContainer !== range.endContainer) return null;
    if (range.startContainer.nodeType !== 1 || range.endOffset !== range.startOffset + 1) return null;
    const node = range.startContainer.childNodes[range.startOffset];
    return node?.nodeType === 1 && (node.tagName === "HR" || node.tagName === "IMG" || isTableWrap(node)) ? node : null;
  }

  function isBlank(fragment, allowBreak = false) {
    return !bare(fragment.textContent) && !fragment.querySelector(allowBreak ? "img" : "img,br");
  }

  function atStart(block, range) {
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(range.startContainer, range.startOffset);
    return isBlank(before.cloneContents());
  }

  function atEnd(block, range) {
    const end = inlineEnd(block);
    const after = document.createRange();
    after.setStart(range.endContainer, range.endOffset);
    if (after.comparePoint(end.node, end.offset) <= 0) return true;
    after.setEnd(end.node, end.offset);
    return isBlank(after.cloneContents());
  }

  function isEmptyBlock(block) {
    if (block.tagName === "PRE") return !bare(block.textContent).replace(/\n$/, "");
    const end = inlineEnd(block);
    const all = document.createRange();
    all.setStart(block, 0);
    all.setEnd(end.node, end.offset);
    return isBlank(all.cloneContents(), true);
  }

  function textBefore(block, range) {
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(range.startContainer, range.startOffset);
    return bare(before.toString());
  }

  function caretRect() {
    const range = currentRange();
    if (!range) return null;
    const rects = range.getClientRects();
    if (rects.length) return rects[0];
    const el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const at = el.childNodes?.[range.startOffset];
    return (at?.nodeType === 1 ? at : el).getBoundingClientRect();
  }

  /* Déplacer un nœud, c'est le retirer puis le reposer : la sélection qui s'y
     trouvait est perdue au passage. On la note donc avant, et on la repose sur
     les mêmes nœuds après — ou sur l'élément qui a remplacé celui d'avant. */
  const replaced = new WeakMap();

  function saveSelection() {
    const selection = window.getSelection();
    if (!currentRange()) return null;
    return { an: selection.anchorNode, ao: selection.anchorOffset, fn: selection.focusNode, fo: selection.focusOffset };
  }

  function restoreSelection(saved) {
    if (!saved) return;
    const resolve = (node, offset) => {
      let target = node;
      while (replaced.has(target)) target = replaced.get(target);
      if (!target.isConnected || !root.contains(target)) return null;
      const max = target.nodeType === 3 ? target.length : target.childNodes.length;
      return { node: target, offset: Math.min(offset, max) };
    };
    const a = resolve(saved.an, saved.ao);
    const f = resolve(saved.fn, saved.fo);
    if (a && f) window.getSelection().setBaseAndExtent(a.node, a.offset, f.node, f.offset);
    else if (a || f) setCaret((a ?? f).node, (a ?? f).offset);
  }

  function keepingSelection(fn) {
    const saved = saveSelection();
    const result = fn();
    restoreSelection(saved);
    return result;
  }

  function renameBlock(el, tag) {
    const next = document.createElement(tag);
    while (el.firstChild) next.appendChild(el.firstChild);
    el.replaceWith(next);
    replaced.set(el, next);
    return next;
  }

  function unwrap(el) {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  }

  /* ---- Remise d'aplomb ----------------------------------------------------
     Après chaque modification, le DOM est ramené au vocabulaire de l'éditeur :
     c'est ce qui garantit que ce qu'on voit s'écrit en markdown, et se relira
     pareil. `full` repasse tout le document (ouverture, collage) ; sinon seuls
     les blocs touchés depuis la dernière fois sont revus. */

  function holdsCaret(node) {
    const selection = window.getSelection();
    return selection.rangeCount > 0 && (selection.anchorNode === node || selection.focusNode === node);
  }

  function adoptStrays(container) {
    let again = false;
    let run = null;
    for (const node of [...container.childNodes]) {
      if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName)) {
        run = null;
        if (node.tagName === "TABLE") {
          const wrap = make("div", "mde-table-wrap");
          node.replaceWith(wrap);
          wrap.appendChild(node);
        } else if (node.tagName === "DIV" && !isTableWrap(node)) {
          if (node.querySelector("p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,hr,table,div")) {
            unwrap(node);
            again = true;
          } else {
            renameBlock(node, "p");
          }
        }
        continue;
      }
      if (node.nodeType === 8 || (node.nodeType === 1 && node.tagName === "LI" && !node.firstChild)) {
        node.remove();
        continue;
      }
      if (node.nodeType === 1 && node.tagName === "LI") {
        const list = document.createElement("ul");
        node.replaceWith(list);
        list.appendChild(node);
        run = null;
        continue;
      }
      if (node.nodeType === 3 && !run && !bare(node.data).trim()) {
        if (!holdsCaret(node)) node.remove();
        continue;
      }
      if (!run) {
        run = document.createElement("p");
        node.before(run);
      }
      run.appendChild(node);
    }
    return again;
  }

  function tidyStructure() {
    for (let pass = 0; pass < 6 && adoptStrays(root); pass++);
    for (const quote of root.querySelectorAll("blockquote")) {
      for (let pass = 0; pass < 6 && adoptStrays(quote); pass++);
    }
    for (const list of [...root.querySelectorAll("ul,ol")].reverse()) {
      for (const child of [...list.childNodes]) {
        if (child.nodeType === 1 && child.tagName === "LI") continue;
        // Une liste posée directement dans une liste appartient à l'item d'avant.
        if (isList(child) && child.previousElementSibling?.tagName === "LI") child.previousElementSibling.appendChild(child);
        else child.remove();
      }
      if (!list.firstElementChild) list.remove();
    }
    for (const quote of [...root.querySelectorAll("blockquote")].reverse()) if (!quote.firstElementChild) quote.remove();

    // Deux listes de même nature qui se touchent n'en font qu'une : écrites
    // l'une sous l'autre, le markdown les relirait ainsi de toute façon.
    for (const list of root.querySelectorAll("ul,ol")) {
      let next = list.nextElementSibling;
      while (list.isConnected && isList(next) && next.tagName === list.tagName) {
        for (const el of [list, next]) {
          const info = meta.get(el);
          if (info) info.dirty = true;
        }
        list.append(...next.children);
        next.remove();
        next = list.nextElementSibling;
      }
    }

    for (const wrap of root.querySelectorAll(".mde-table-wrap")) tidyTable(wrap);

    if (!root.firstElementChild) root.appendChild(emptyParagraph());
    // Après un tableau, un bloc de code ou un filet en fin de document, il
    // faut un endroit où continuer d'écrire. Un paragraphe vide ne s'écrit pas
    // dans le markdown : il ne coûte rien.
    if (isAtom(root.lastElementChild)) root.appendChild(emptyParagraph());
  }

  function tidyTable(wrap) {
    const table = wrap.querySelector("table");
    const rows = table ? [...table.rows].filter((row) => row.cells.length) : [];
    if (!rows.length) {
      wrap.remove();
      return;
    }
    for (const row of table.rows) if (!row.cells.length) row.remove();
    const width = Math.max(...rows.map((row) => row.cells.length));
    rows.forEach((row, index) => {
      while (row.cells.length < width) {
        const cell = document.createElement(index === 0 ? "th" : "td");
        const align = rows[0].cells[row.cells.length]?.dataset.align;
        if (align) cell.dataset.align = align;
        cell.appendChild(document.createElement("br"));
        row.appendChild(cell);
      }
    });
    for (const node of [...wrap.childNodes]) if (node !== table) node.remove();
  }

  function tidyPre(pre) {
    let code = pre.querySelector(":scope > code");
    if (!code) {
      code = document.createElement("code");
      while (pre.firstChild) code.appendChild(pre.firstChild);
      pre.appendChild(code);
    }
    for (const node of [...pre.childNodes]) {
      if (node === code) continue;
      if (node.nodeType === 3 || node.nodeType === 1) code.appendChild(node.nodeName === "BR" ? document.createTextNode("\n") : node);
    }
    for (const br of code.querySelectorAll("br")) br.replaceWith("\n");
    for (const el of [...code.querySelectorAll("*")].reverse()) {
      if (/^(DIV|P)$/.test(el.tagName) && el.previousSibling) el.before("\n");
      unwrap(el);
    }
    code.normalize();
    if (!code.textContent.endsWith("\n")) code.appendChild(document.createTextNode("\n"));
    code.normalize();
  }

  function tidyInline(scope) {
    const all = (selector) => [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];

    for (const el of all("b,i,s,strike")) {
      if (el.closest("pre")) continue;
      renameBlock(el, HTML_MARKS[el.tagName]);
    }
    for (const el of all("span,font,u,small,big,mark,sub,sup,ins")) {
      if (el.dataset.mdeSkip === undefined) unwrap(el);
    }
    for (const el of all("[style]")) el.removeAttribute("style");
    for (const el of all("strong strong,em em,del del,a a,code code")) unwrap(el);
    for (const code of all("code")) {
      if (code.parentElement?.tagName === "PRE") continue;
      for (const el of [...code.querySelectorAll("*")]) el.tagName === "BR" ? el.remove() : unwrap(el);
    }

    // Espaces d'appui : retirés dès que le curseur n'en a plus besoin.
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) if (walker.currentNode.data.includes(ZWSP)) texts.push(walker.currentNode);
    for (const node of texts) {
      if (node.data === ZWSP && holdsCaret(node)) continue;
      const selection = window.getSelection();
      const fix = (container, offset) => (container === node ? bare(node.data.slice(0, offset)).length : offset);
      const held = holdsCaret(node)
        ? [selection.anchorNode, fix(selection.anchorNode, selection.anchorOffset), selection.focusNode, fix(selection.focusNode, selection.focusOffset)]
        : null;
      node.data = bare(node.data);
      if (held) selection.setBaseAndExtent(...held);
    }

    for (const el of all("strong,em,del,a,code")) {
      if (el.parentElement?.tagName === "PRE" || !el.isConnected) continue;
      if (!bare(el.textContent) && !el.querySelector("img") && !(el.textContent && el.contains(window.getSelection().anchorNode))) {
        el.remove();
        continue;
      }
      let next = el.nextSibling;
      while (next?.nodeType === 1 && next.tagName === el.tagName && (el.tagName !== "A" || next.dataset.href === el.dataset.href)) {
        while (next.firstChild) el.appendChild(next.firstChild);
        next.remove();
        next = el.nextSibling;
      }
    }

    // Une adresse nue qu'on retouche emmène son lien avec elle.
    for (const a of all("a[data-auto]")) {
      const text = bare(a.textContent);
      if (/^(https?:\/\/|mailto:)\S+$/i.test(text)) a.dataset.href = text;
      else delete a.dataset.auto;
    }
    for (const img of all("img.is-uploading")) if (!uploads.has(img)) img.remove();

    for (const block of all(TEXTBLOCKS)) {
      if (block.tagName === "PRE") {
        tidyPre(block);
        continue;
      }
      if (block.tagName === "LI" && block.classList.contains("mde-task") && !block.dataset.checked) block.dataset.checked = "false";
      let last = block.lastChild;
      while (last && (isList(last) || (last.nodeType === 3 && !last.data && !holdsCaret(last)))) last = last.previousSibling;
      const filled = last && !(last.nodeType === 3 && !bare(last.data) && !last.previousSibling);
      if (!filled) {
        const br = document.createElement("br");
        const sub = block.tagName === "LI" ? nestedList(block) : null;
        if (sub) block.insertBefore(br, sub);
        else block.appendChild(br);
      }
    }
  }

  function tidy(full) {
    const saved = saveSelection();
    const before = observer.takeRecords();
    flushMutations(before);
    tidyStructure();
    const scopes = full ? [root] : [...touched].filter((el) => el.isConnected && el.parentElement === root);
    for (const scope of scopes) tidyInline(scope);
    const records = observer.takeRecords();
    flushMutations(records);
    if (records.length) restoreSelection(saved);
    fixCaret();
  }

  /** Un curseur posé « entre deux blocs » n'écrit nulle part : on le ramène
   *  dans le bloc le plus proche. */
  function fixCaret() {
    const range = currentRange();
    if (!range || !range.collapsed || range.startContainer !== root) return;
    const at = root.childNodes[range.startOffset];
    const before = root.childNodes[range.startOffset - 1];
    if (at?.nodeType === 1 && at.tagName !== "HR") caretToStart(at);
    else if (before?.nodeType === 1 && before.tagName !== "HR") caretToEnd(before);
    else if (at?.nextElementSibling) caretToStart(at.nextElementSibling);
  }

  /* ---- Annuler / rétablir -------------------------------------------------
     Des instantanés du document, pris avant chaque geste : la pile native du
     navigateur ne survit pas à nos propres modifications du DOM. Chaque bloc y
     garde sa source d'origine — annuler ne reformate rien. */

  function pathOf(node) {
    const path = [];
    for (let at = node; at !== root; at = at.parentNode) {
      if (!at?.parentNode) return null;
      path.unshift(indexOf(at));
    }
    return path;
  }

  function nodeAt(path) {
    let node = root;
    for (const index of path ?? []) node = node?.childNodes[index];
    return path ? node ?? null : null;
  }

  function snapshot() {
    flushMutations();
    const selection = window.getSelection();
    const nodes = [...root.childNodes];
    return {
      nodes: nodes.map((node) => node.cloneNode(true)),
      metas: nodes.map((node) => (meta.has(node) ? { ...meta.get(node) } : null)),
      selection: currentRange()
        ? { a: pathOf(selection.anchorNode), ao: selection.anchorOffset, f: pathOf(selection.focusNode), fo: selection.focusOffset }
        : null,
    };
  }

  function restore(shot) {
    closeBubbles();
    root.replaceChildren(...shot.nodes.map((node) => node.cloneNode(true)));
    [...root.childNodes].forEach((node, index) => {
      if (shot.metas[index]) meta.set(node, { ...shot.metas[index] });
    });
    observer.takeRecords();
    touched.clear();
    root.focus({ preventScroll: true });
    const a = nodeAt(shot.selection?.a);
    const f = nodeAt(shot.selection?.f);
    const clamp = (node, offset) => Math.min(offset, node.nodeType === 3 ? node.length : node.childNodes.length);
    if (a && f) window.getSelection().setBaseAndExtent(a, clamp(a, shot.selection.ao), f, clamp(f, shot.selection.fo));
    else focusEdge("end");
    history.kind = null;
    commit();
    revealCaret();
  }

  /** À appeler AVANT de modifier. Les frappes qui se suivent partagent un même
   *  instantané : annuler défait un bout de phrase, pas une lettre. */
  function record(kind) {
    const now = Date.now();
    const burst = kind === "type" || kind === "delete";
    const merged = burst && history.kind === kind && now - history.at < 1000 && now - history.since < 6000;
    history.at = now;
    if (merged) return;
    history.kind = kind;
    history.since = now;
    history.undo.push(snapshot());
    if (history.undo.length > UNDO_DEPTH) history.undo.shift();
    history.redo.length = 0;
  }

  function undo() {
    if (!history.undo.length) return;
    history.redo.push(snapshot());
    restore(history.undo.pop());
  }

  function redo() {
    if (!history.redo.length) return;
    history.undo.push(snapshot());
    restore(history.redo.pop());
  }

  /** Un geste complet : instantané, modification, remise d'aplomb. */
  function edit(fn) {
    record("command");
    const result = fn();
    commit();
    revealCaret();
    return result;
  }

  function revealCaret() {
    const rect = caretRect();
    if (!rect || (!rect.width && !rect.height && !rect.top)) return;
    const margin = 48;
    if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
      const range = currentRange();
      const el = range?.startContainer.nodeType === 1 ? range.startContainer : range?.startContainer.parentElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }

  /* ---- Entrée ------------------------------------------------------------- */

  function splitBlock(block, range, tag) {
    const tailRange = document.createRange();
    tailRange.setStart(range.startContainer, range.startOffset);
    const sub = block.tagName === "LI" ? nestedList(block) : null;
    if (sub) tailRange.setEndBefore(sub);
    else tailRange.setEnd(block, block.childNodes.length);
    const next = document.createElement(tag);
    next.appendChild(tailRange.extractContents());
    if (sub) next.appendChild(sub);
    block.after(next);
    return next;
  }

  function enterInParagraph(block, range) {
    const text = bare(block.textContent).trim();
    if (block.tagName === "P") {
      const fence = /^(?:```|~~~)\s*([\w+#.-]*)$/.exec(text);
      if (fence) {
        const pre = MDE.makePre("", fence[1]);
        block.replaceWith(pre);
        return caretToStart(pre);
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) {
        const rule = document.createElement("hr");
        const p = emptyParagraph();
        block.replaceWith(rule);
        rule.after(p);
        return caretToStart(p);
      }
      // Entrée sur une ligne vide sort de la citation.
      if (block.parentElement.tagName === "BLOCKQUOTE" && isEmptyBlock(block)) {
        liftFromQuote(block);
        return caretToStart(block);
      }
    }
    if (isHeading(block) && atStart(block, range) && !atEnd(block, range)) {
      block.before(emptyParagraph());
      return;
    }
    const next = splitBlock(block, range, "p");
    caretToStart(next);
  }

  function enterInList(li, range) {
    if (isEmptyBlock(li) && !nestedList(li)) {
      if (li.parentElement.parentElement?.tagName === "LI") outdent(li);
      else caretToStart(liftItem(li));
      return;
    }
    const next = splitBlock(li, range, "li");
    if (li.classList.contains("mde-task")) {
      next.className = "mde-task";
      next.dataset.checked = "false";
    }
    caretToStart(next);
  }

  function enterInCell(cell) {
    const table = cell.closest("table");
    const rows = [...table.rows];
    const row = rows.indexOf(cell.parentElement);
    const col = [...cell.parentElement.cells].indexOf(cell);
    if (row < rows.length - 1) return caretToEnd(rows[row + 1].cells[Math.min(col, rows[row + 1].cells.length - 1)]);
    // Dernière ligne : Entrée sort du tableau, et ouvre une ligne s'il n'y en
    // a pas — c'est ce qui manquait pour écrire après un tableau.
    leaveBlock(table.closest(".mde-table-wrap"));
  }

  function insertCodeText(text) {
    const range = currentRange();
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    setCaret(node, node.length);
    node.parentNode.normalize();
  }

  function enterInCode(pre, range) {
    const before = textBefore(pre, range);
    if (atEnd(pre, range) && /\n\n$/.test(before)) {
      // Deux lignes vides en fin de bloc : on en sort.
      const text = lastText(codeOf(pre));
      text.data = text.data.replace(/\n+$/, "\n");
      return leaveBlock(pre);
    }
    const indent = /(?:^|\n)([ \t]*)[^\n]*$/.exec(before)?.[1] ?? "";
    insertCodeText(`\n${indent}`);
  }

  /** Ouvre un paragraphe après le bloc, et y pose le curseur. */
  function leaveBlock(block) {
    const next = block.nextElementSibling;
    if (next?.tagName === "P" && isEmptyBlock(next)) return caretToStart(next);
    const p = emptyParagraph();
    block.after(p);
    caretToStart(p);
  }

  function insertParagraph() {
    const picked = nodeSelection();
    if (picked) return leaveBlock(picked.tagName === "IMG" ? blockOf(picked) : picked);
    let range = currentRange();
    if (!range) return;
    if (!range.collapsed) {
      deleteSelection(range);
      range = currentRange();
    }
    const block = textblockOf(range.startContainer);
    if (!block) {
      const p = emptyParagraph();
      root.insertBefore(p, root.childNodes[range.startOffset] ?? null);
      return caretToStart(p);
    }
    if (block.tagName === "PRE") enterInCode(block, range);
    else if (isCell(block)) enterInCell(block);
    else if (block.tagName === "LI") enterInList(block, range);
    else enterInParagraph(block, range);
  }

  function insertLineBreak() {
    let range = currentRange();
    if (!range) return;
    const block = textblockOf(range.startContainer);
    if (!block || isCell(block) || isHeading(block)) return;
    if (block.tagName === "PRE") return insertCodeText("\n");
    if (!range.collapsed) {
      deleteSelection(range);
      range = currentRange();
    }
    const br = document.createElement("br");
    range.insertNode(br);
    // Un saut en toute fin de bloc ne se voit pas sans rien derrière lui.
    const end = inlineEnd(block);
    if (end.node === block && block.childNodes[end.offset] === br) br.after(document.createElement("br"));
    setCaret(br.parentNode, indexOf(br) + 1);
  }

  /* ---- Effacer ------------------------------------------------------------ */

  function joinBlocks(target, source) {
    const end = inlineEnd(target);
    if (end.node === target && target.childNodes[end.offset]?.nodeName === "BR") target.childNodes[end.offset].remove();
    const before = target.tagName === "LI" ? nestedList(target) : null;
    for (const node of [...source.childNodes]) {
      if (!isList(node)) target.insertBefore(node, before);
    }
    const items = [...source.children].filter(isList).flatMap((list) => [...list.children]);
    if (source.tagName === "LI" && items.length) source.replaceWith(...items);
    else source.remove();
  }

  /** Fusionne `block` dans ce qui le précède, curseur à la jointure. */
  function mergeBackward(block, previous) {
    if (previous.tagName === "HR") return previous.remove();
    if (isAtom(previous)) {
      if (isEmptyBlock(block) && block.nextElementSibling) block.remove();
      return caretToEnd(previous);
    }
    const blocks = previous.matches(TEXTBLOCKS) ? [previous] : previous.querySelectorAll(TEXTBLOCKS);
    const target = blocks[blocks.length - 1];
    if (!target || target.tagName === "PRE" || isCell(target)) return target && caretToEnd(target);
    const marker = document.createTextNode("");
    const end = inlineEnd(target);
    if (end.node.nodeType === 3) end.node.after(marker);
    else end.node.insertBefore(marker, end.node.childNodes[end.offset] ?? null);
    joinBlocks(target, block);
    setCaret(marker.parentNode, indexOf(marker));
    marker.remove();
  }

  function backspaceAtStart(block) {
    if (isHeading(block)) return keepingSelection(() => renameBlock(block, "p"));
    if (isCell(block)) return;
    if (block.tagName === "PRE") {
      if (isEmptyBlock(block)) {
        const p = emptyParagraph();
        block.replaceWith(p);
        caretToStart(p);
      }
      return;
    }
    if (block.tagName === "LI") {
      if (block.parentElement.parentElement?.tagName === "LI") keepingSelection(() => outdent(block));
      else caretToStart(liftItem(block));
      return;
    }
    const previous = block.previousElementSibling;
    if (block.parentElement.tagName === "BLOCKQUOTE" && !previous) {
      keepingSelection(() => liftFromQuote(block));
      return;
    }
    if (previous) mergeBackward(block, previous);
  }

  function nextBlockAfter(block) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (el) => (el.matches(`${TEXTBLOCKS},hr,table`) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    walker.currentNode = block;
    return walker.nextNode();
  }

  function deleteAtEnd(block) {
    if (isCell(block) || block.tagName === "PRE") return;
    const next = nextBlockAfter(block);
    if (!next) return;
    if (next.tagName === "HR") return next.remove();
    if (next.tagName === "TABLE" || next.tagName === "PRE" || isCell(next)) return;
    keepingSelection(() => {
      const owner = next.tagName === "LI" ? next.parentElement : null;
      joinBlocks(block, next);
      if (owner && !owner.firstElementChild) owner.remove();
    });
  }

  function clearCells(range, from, to) {
    const cells = [...from.closest("table").querySelectorAll("th,td")];
    const first = cells.indexOf(from);
    const last = cells.indexOf(to);
    const head = document.createRange();
    head.setStart(range.startContainer, range.startOffset);
    head.setEnd(from, from.childNodes.length);
    const foot = document.createRange();
    foot.setStart(to, 0);
    foot.setEnd(range.endContainer, range.endOffset);
    const caret = { node: range.startContainer, offset: range.startOffset };
    foot.deleteContents();
    head.deleteContents();
    for (const cell of cells.slice(first + 1, last)) cell.replaceChildren(document.createElement("br"));
    setCaret(caret.node, Math.min(caret.offset, caret.node.nodeType === 3 ? caret.node.length : caret.node.childNodes.length));
  }

  /** Efface une sélection qui enjambe plusieurs blocs, et recolle les deux bouts. */
  function deleteSelection(range) {
    const fromCell = textblockOf(range.startContainer)?.closest("td,th") ?? null;
    const toCell = textblockOf(range.endContainer)?.closest("td,th") ?? null;
    if (fromCell && toCell && fromCell !== toCell && fromCell.closest("table") === toCell.closest("table")) {
      return clearCells(range, fromCell, toCell);
    }
    // Un tableau ne se coupe pas en son milieu : une sélection qui y entre ou
    // en sort s'arrête à son bord.
    if (fromCell && fromCell !== toCell) range.setStartAfter(fromCell.closest(".mde-table-wrap") ?? fromCell.closest("table"));
    if (toCell && fromCell !== toCell) range.setEndBefore(toCell.closest(".mde-table-wrap") ?? toCell.closest("table"));
    if (range.collapsed) return;

    const from = textblockOf(range.startContainer);
    const to = textblockOf(range.endContainer);
    const { startContainer, startOffset } = range;
    const marker = document.createTextNode("");
    range.deleteContents();
    // Après l'effacement, la portée se replie ENTRE les deux blocs : le point
    // où reprendre l'écriture est celui d'où partait la sélection.
    const point = document.createRange();
    point.setStart(startContainer, Math.min(startOffset, startContainer.nodeType === 3 ? startContainer.length : startContainer.childNodes.length));
    point.insertNode(marker);
    const joinable = (block) => block?.isConnected && block.tagName !== "PRE" && !isCell(block);
    if (from !== to && joinable(from) && joinable(to)) {
      const owner = to.tagName === "LI" ? to.parentElement : null;
      joinBlocks(from, to);
      if (owner && !owner.firstElementChild) owner.remove();
    }
    setCaret(marker.parentNode, indexOf(marker));
    marker.remove();
    // Tout a été effacé : on repart d'une feuille blanche, pas d'un titre vide.
    const only = root.children.length === 1 ? root.firstElementChild : null;
    if (only && isHeading(only) && isEmptyBlock(only)) caretToStart(renameBlock(only, "p"));
  }

  /** Rend vrai si l'effacement a été pris en charge ici. */
  function handleDelete(inputType) {
    const range = currentRange();
    if (!range) return false;
    if (!range.collapsed) {
      const from = textblockOf(range.startContainer);
      if (from && from === textblockOf(range.endContainer) && !nodeSelection(range)) return false;
      deleteSelection(range);
      return true;
    }
    const block = textblockOf(range.startContainer);
    if (!block) return false;
    if (/Backward/.test(inputType) && atStart(block, range)) {
      backspaceAtStart(block);
      return true;
    }
    if (/Forward/.test(inputType) && atEnd(block, range)) {
      deleteAtEnd(block);
      return true;
    }
    return false;
  }

  /* ---- Listes et citations ------------------------------------------------ */

  /** Sort un item de sa liste : il devient un paragraphe, la liste est coupée
   *  en deux autour de lui. */
  function liftItem(li) {
    const list = li.parentElement;
    const p = document.createElement("p");
    const nested = [...li.children].filter(isList);
    for (const node of [...li.childNodes]) if (!isList(node)) p.appendChild(node);
    const following = [];
    for (let next = li.nextElementSibling; next; next = next.nextElementSibling) following.push(next);

    list.after(p);
    let anchor = p;
    for (const sub of nested) {
      anchor.after(sub);
      anchor = sub;
    }
    if (following.length) {
      const rest = document.createElement(list.tagName);
      rest.append(...following);
      anchor.after(rest);
    }
    li.remove();
    if (!list.firstElementChild) list.remove();
    if (!p.firstChild) p.appendChild(document.createElement("br"));
    replaced.set(li, p);
    return p;
  }

  function outdent(li) {
    const sub = li.parentElement;
    const parent = sub.parentElement;
    if (parent?.tagName !== "LI") return;
    const following = [];
    for (let next = li.nextElementSibling; next; next = next.nextElementSibling) following.push(next);
    if (following.length) {
      let own = nestedList(li);
      if (!own) own = li.appendChild(document.createElement(sub.tagName));
      own.append(...following);
    }
    parent.after(li);
    if (!sub.firstElementChild) sub.remove();
  }

  function indent(li) {
    const previous = li.previousElementSibling;
    if (previous?.tagName !== "LI") return;
    let sub = [...previous.children].filter(isList).pop();
    if (!sub) sub = previous.appendChild(document.createElement(li.parentElement.tagName));
    sub.appendChild(li);
  }

  function liftFromQuote(block) {
    const quote = block.parentElement;
    const following = [];
    for (let next = block.nextElementSibling; next; next = next.nextElementSibling) following.push(next);
    quote.after(block);
    if (following.length) {
      const rest = document.createElement("blockquote");
      rest.append(...following);
      block.after(rest);
    }
    if (!quote.firstElementChild) quote.remove();
  }

  /** Les blocs de texte que touche la sélection. */
  function selectedBlocks() {
    const range = currentRange();
    if (!range) return [];
    if (range.collapsed) {
      const block = textblockOf(range.startContainer);
      return block ? [block] : [];
    }
    return [...root.querySelectorAll(TEXTBLOCKS)].filter((block) => {
      const end = inlineEnd(block);
      const inline = document.createRange();
      inline.setStart(block, 0);
      inline.setEnd(end.node, end.offset);
      return range.compareBoundaryPoints(Range.START_TO_END, inline) > 0 && range.compareBoundaryPoints(Range.END_TO_START, inline) < 0;
    });
  }

  function plainText(block) {
    let out = "";
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out += bare(child.data);
        else if (child.nodeName === "BR") out += "\n";
        else if (child.nodeType === 1) {
          if (child.matches(TEXTBLOCKS) && out && !out.endsWith("\n")) out += "\n";
          walk(child);
        }
      }
    };
    walk(block);
    return out.replace(/\n$/, "");
  }

  function setBlock(tag) {
    keepingSelection(() => {
      for (const block of selectedBlocks()) {
        if (!block.isConnected || isCell(block)) continue;
        if (block.tagName === "PRE") {
          const p = document.createElement("p");
          plainText(block).split("\n").forEach((line, index) => {
            if (index) p.appendChild(document.createElement("br"));
            if (line) p.appendChild(document.createTextNode(line));
          });
          block.replaceWith(p);
          replaced.set(block, p);
          if (tag !== "p") renameBlock(p, tag);
          continue;
        }
        const target = block.tagName === "LI" ? liftItem(block) : block;
        if (target.tagName.toLowerCase() !== tag) renameBlock(target, tag);
      }
    });
  }

  function retagList(list, tag) {
    if (list.tagName === tag) return list;
    const next = document.createElement(tag);
    next.append(...list.childNodes);
    list.replaceWith(next);
    return next;
  }

  function setTask(li, on) {
    li.classList.toggle("mde-task", on);
    if (on) li.dataset.checked ??= "false";
    else delete li.dataset.checked;
    if (!li.className) li.removeAttribute("class");
  }

  function toggleList(kind) {
    const blocks = selectedBlocks().filter((block) => !isCell(block) && block.tagName !== "PRE");
    if (!blocks.length) return;
    const tag = kind === "ol" ? "OL" : "UL";
    const matches = (block) =>
      block.tagName === "LI" &&
      block.parentElement.tagName === tag &&
      (kind === "ol" || block.classList.contains("mde-task") === (kind === "task"));

    keepingSelection(() => {
      if (blocks.every(matches)) {
        for (const li of blocks) if (li.isConnected) liftItem(li);
        return;
      }
      for (const block of blocks) {
        if (!block.isConnected) continue;
        if (block.tagName === "LI") {
          setTask(block, kind === "task");
          retagList(block.parentElement, tag);
          continue;
        }
        const list = document.createElement(tag);
        const li = list.appendChild(document.createElement("li"));
        block.replaceWith(list);
        while (block.firstChild) li.appendChild(block.firstChild);
        if (kind === "task") setTask(li, true);
        replaced.set(block, li);
      }
      tidyStructure();
    });
  }

  function toggleQuote() {
    const blocks = [...new Set(selectedBlocks().map(blockOf).filter(Boolean))];
    if (!blocks.length) return;
    keepingSelection(() => {
      if (blocks.every((block) => block.parentElement.tagName === "BLOCKQUOTE")) {
        for (const block of blocks) if (block.isConnected) liftFromQuote(block);
        return;
      }
      const outside = blocks.filter((block) => block.parentElement === root);
      if (!outside.length) return;
      const quote = document.createElement("blockquote");
      outside[0].before(quote);
      quote.append(...outside);
    });
  }

  function toggleCode() {
    const range = currentRange();
    const current = range && textblockOf(range.startContainer);
    if (!current || isCell(current)) return;
    if (current.tagName === "PRE") return setBlock("p");
    const blocks = [...new Set(selectedBlocks().map(blockOf).filter(Boolean))].filter((block) => !isAtom(block));
    if (!blocks.length) return;
    const pre = MDE.makePre(blocks.map(plainText).join("\n"), "");
    blocks[0].before(pre);
    for (const block of blocks) block.remove();
    caretToEnd(pre);
  }

  /* ---- Mise en forme du texte --------------------------------------------- */

  /** Les nœuds texte entièrement pris dans la sélection, bords découpés. */
  function textsInRange(range) {
    let { startContainer: sc, startOffset: so, endContainer: ec, endOffset: eo } = range;
    if (ec.nodeType === 3 && eo < ec.length) ec.splitText(eo);
    if (sc.nodeType === 3 && so > 0) {
      const rest = sc.splitText(so);
      if (ec === sc) {
        ec = rest;
        eo -= so;
      }
      sc = rest;
      so = 0;
    }
    const span = document.createRange();
    span.setStart(sc, so);
    span.setEnd(ec, eo);
    const scope = span.commonAncestorContainer.nodeType === 3 ? span.commonAncestorContainer.parentNode : span.commonAncestorContainer;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.data || node.parentElement.closest("pre") || node.parentElement.closest("[contenteditable=false]")) continue;
      const own = document.createRange();
      own.selectNodeContents(node);
      if (span.compareBoundaryPoints(Range.START_TO_START, own) <= 0 && span.compareBoundaryPoints(Range.END_TO_END, own) >= 0) nodes.push(node);
    }
    return nodes;
  }

  const markOf = (node, tag) => {
    const el = node.parentElement?.closest(tag.toLowerCase());
    return el && root.contains(el) ? el : null;
  };

  /** Retire `mark` autour de `node` seulement, en le coupant en trois s'il le faut. */
  function liftOutOfMark(node, mark) {
    const head = document.createRange();
    head.setStart(mark, 0);
    head.setEndBefore(node);
    const before = head.extractContents();
    if (!isBlank(before)) {
      const clone = mark.cloneNode(false);
      clone.appendChild(before);
      mark.before(clone);
    }
    const foot = document.createRange();
    foot.setStartAfter(node);
    foot.setEnd(mark, mark.childNodes.length);
    const after = foot.extractContents();
    if (!isBlank(after)) {
      const clone = mark.cloneNode(false);
      clone.appendChild(after);
      mark.after(clone);
    }
    unwrap(mark);
  }

  function toggleMark(name) {
    const tag = MARK_TAGS[name];
    const range = currentRange();
    if (!range || textblockOf(range.startContainer)?.tagName === "PRE") return;
    if (range.collapsed) return toggleMarkAtCaret(tag, range);

    const nodes = textsInRange(range);
    if (!nodes.length) return;
    if (nodes.every((node) => markOf(node, tag))) {
      for (const node of nodes) {
        const mark = markOf(node, tag);
        if (mark) liftOutOfMark(node, mark);
      }
    } else {
      for (const node of nodes) {
        if (markOf(node, tag)) continue;
        const mark = document.createElement(tag);
        node.replaceWith(mark);
        mark.appendChild(node);
      }
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    window.getSelection().setBaseAndExtent(first, 0, last, last.length);
  }

  /* Sans sélection, la mise en forme vaut pour ce qu'on va taper. Le curseur
     est posé dans un élément qui ne contient encore qu'une espace sans chasse :
     la frappe suivante y entre d'elle-même, et s'il n'y en a pas, l'élément
     vide est retiré dès que le curseur s'en va. */
  function toggleMarkAtCaret(tag, range) {
    const mark = markOf(range.startContainer, tag) ?? (range.startContainer.nodeType === 1 ? range.startContainer.closest(tag.toLowerCase()) : null);
    const prop = document.createTextNode(ZWSP);
    if (!mark) {
      const el = document.createElement(tag);
      el.appendChild(prop);
      range.insertNode(el);
      return setCaret(prop, 1);
    }
    const foot = document.createRange();
    foot.setStart(range.startContainer, range.startOffset);
    foot.setEnd(mark, mark.childNodes.length);
    const after = foot.extractContents();
    mark.after(prop);
    if (!isBlank(after)) {
      const clone = mark.cloneNode(false);
      clone.appendChild(after);
      prop.after(clone);
    }
    if (!bare(mark.textContent) && !mark.querySelector("img")) mark.remove();
    setCaret(prop, 1);
  }

  /** Flèche droite au bout d'un passage mis en forme, en fin de ligne : sans
   *  appui, le curseur ne peut pas en sortir. */
  function escapeMark(range) {
    const node = range.startContainer;
    if (node.nodeType !== 3 || range.startOffset !== node.length) return false;
    const mark = node.parentElement.closest("strong,em,del,code,a");
    const block = textblockOf(node);
    if (!mark || !block || block.tagName === "PRE" || !root.contains(mark)) return false;
    const rest = document.createRange();
    rest.setStartAfter(mark);
    const end = inlineEnd(block);
    rest.setEnd(end.node, end.offset);
    if (rest.collapsed ? false : !isBlank(rest.cloneContents())) return false;
    let outer = mark;
    while (outer.parentElement !== block && outer.parentElement.matches("strong,em,del,code,a")) outer = outer.parentElement;
    const prop = document.createTextNode(ZWSP);
    outer.after(prop);
    setCaret(prop, 1);
    return true;
  }

  /* ---- Raccourcis de frappe -----------------------------------------------
     Qui connaît le markdown peut continuer à le taper : « # », « - », « 1. »,
     « > », « **gras** »… sont convertis à la volée, et ne restent donc jamais
     à l'écran. */

  function blockRule(block, range) {
    if (block.tagName !== "P" && block.tagName !== "LI") return false;
    const before = textBefore(block, range);
    let apply = null;
    let match;
    if ((match = /^\[([ xX]?)\][  ]$/.exec(before))) {
      const checked = /x/i.test(match[1]);
      apply = () => {
        if (block.tagName === "P") toggleList("task");
        const li = textblockOf(currentRange().startContainer);
        if (li?.tagName === "LI") {
          setTask(li, true);
          li.dataset.checked = String(checked);
          retagList(li.parentElement, "UL");
        }
      };
    } else if (block.tagName !== "P") {
      return false;
    } else if ((match = /^(#{1,6})[  ]$/.exec(before))) {
      const level = match[1].length;
      apply = () => setBlock(`h${level}`);
    } else if (/^[-*+][  ]$/.test(before)) {
      apply = () => toggleList("ul");
    } else if ((match = /^(\d{1,9})[.)][  ]$/.exec(before))) {
      const start = Number(match[1]);
      apply = () => {
        toggleList("ol");
        const list = textblockOf(currentRange().startContainer)?.parentElement;
        if (list?.tagName === "OL" && start !== 1 && list.children.length === 1) list.setAttribute("start", String(start));
      };
    } else if (/^>[  ]$/.test(before)) {
      if (block.parentElement.tagName === "BLOCKQUOTE") return false;
      apply = toggleQuote;
    }
    if (!apply) return false;

    // Annuler doit rendre ce qui a été tapé, pas seulement défaire la conversion.
    history.kind = null;
    record("command");
    const prefix = document.createRange();
    prefix.selectNodeContents(block);
    prefix.setEnd(range.startContainer, range.startOffset);
    prefix.deleteContents();
    if (!block.firstChild || isEmptyBlock(block)) {
      block.replaceChildren(document.createElement("br"));
      setCaret(block, 0);
    }
    apply();
    return true;
  }

  const INLINE_RULES = [
    { re: /(?:^|[^*])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, tag: "STRONG" },
    { re: /(?:^|[^_\p{L}\p{N}])(__([^_\s](?:[^_]*[^_\s])?)__)$/u, tag: "STRONG" },
    { re: /(?:^|[^*])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, tag: "EM" },
    { re: /(?:^|[^_\p{L}\p{N}])(_([^_\s](?:[^_]*[^_\s])?)_)$/u, tag: "EM" },
    { re: /(~~([^~\s](?:[^~]*[^~\s])?)~~)$/, tag: "DEL" },
    { re: /(`([^`]+)`)$/, tag: "CODE" },
  ];

  function inlineRule(range) {
    const node = range.startContainer;
    if (node.nodeType !== 3 || node.parentElement.closest("code,pre")) return false;
    const before = node.data.slice(0, range.startOffset);

    let el = null;
    let whole = "";
    const link = /(!?)\[([^\]\n]+)\]\(([^()\s]+)\)$/.exec(before);
    if (link) {
      whole = link[0];
      if (link[1]) el = MDE.makeImage(link[2], link[3], "", ctx);
      else {
        el = MDE.makeLink(normalizeUrl(link[3]));
        el.textContent = link[2];
      }
    } else {
      for (const rule of INLINE_RULES) {
        const match = rule.re.exec(before);
        if (!match) continue;
        whole = match[1];
        el = document.createElement(rule.tag);
        el.textContent = match[2];
        break;
      }
    }
    if (!el) return false;

    history.kind = null;
    record("command");
    const target = node.splitText(before.length - whole.length);
    target.splitText(whole.length);
    target.replaceWith(el);
    const prop = document.createTextNode(ZWSP);
    el.after(prop);
    setCaret(prop, 1);
    return true;
  }

  /* ---- Insertion de blocs ------------------------------------------------- */

  /** Pose un bloc à l'endroit du curseur : à la place d'un paragraphe vide,
   *  sinon juste après le bloc courant. */
  function placeBlock(el) {
    const range = currentRange();
    const block = range && textblockOf(range.startContainer);
    const anchor = (block && (isCell(block) ? topBlockOf(block) : blockOf(block))) ?? root.lastElementChild;
    if (block?.tagName === "P" && isEmptyBlock(block)) block.replaceWith(el);
    else if (anchor) anchor.after(el);
    else root.appendChild(el);
    if (!el.nextElementSibling) el.after(emptyParagraph());
    return el;
  }

  function insertRule() {
    const rule = placeBlock(document.createElement("hr"));
    caretToStart(rule.nextElementSibling);
  }

  function insertTable(rows, cols) {
    const blank = () => Array.from({ length: cols }, () => "");
    const wrap = placeBlock(MDE.makeTable(blank(), [], Array.from({ length: Math.max(rows - 1, 1) }, blank), ctx));
    caretToStart(wrap.querySelector("th"));
  }

  /** Pose des nœuds dans le texte, au curseur. */
  function insertInline(nodes) {
    let range = currentRange();
    if (!range) {
      focusEdge("end");
      range = currentRange();
    }
    if (!range.collapsed) {
      const from = textblockOf(range.startContainer);
      if (from && from === textblockOf(range.endContainer)) range.deleteContents();
      else deleteSelection(range);
      range = currentRange();
    }
    const block = textblockOf(range.startContainer);
    if (!block) return;
    if (isEmptyBlock(block) && block.tagName !== "LI") block.replaceChildren();
    else if (isEmptyBlock(block)) for (const node of [...block.childNodes]) if (node.nodeName === "BR") node.remove();
    const at = currentRange() ?? range;
    const fragment = document.createDocumentFragment();
    fragment.append(...nodes);
    const last = fragment.lastChild;
    if (block.firstChild || block.tagName === "LI") at.insertNode(fragment);
    else block.appendChild(fragment);
    if (last) setCaret(last.parentNode, indexOf(last) + 1);
  }

  /** Une image dans son propre paragraphe — sauf dans un tableau ou une liste,
   *  où elle reste dans le texte. */
  function placeImage(img) {
    const range = currentRange();
    const block = range && textblockOf(range.startContainer);
    if (block && (isCell(block) || block.tagName === "LI")) return insertInline([img]);
    let p = block;
    if (block?.tagName === "P" && isEmptyBlock(block)) {
      block.replaceChildren(img);
    } else {
      p = document.createElement("p");
      p.appendChild(img);
      const anchor = (block && blockOf(block)) ?? root.lastElementChild;
      if (anchor) anchor.after(p);
      else root.appendChild(p);
    }
    // On reprend l'écriture sous l'image — dans une ligne neuve si ce qui suit
    // n'est pas du texte : le curseur n'a rien à faire dans le tableau d'après.
    const next = p.nextElementSibling;
    if (!next || !(next.tagName === "P" || isHeading(next))) p.after(emptyParagraph());
    caretToStart(p.nextElementSibling);
  }

  function insertMarkdown(md) {
    const parsed = MDE.parseDocument(md, ctx).blocks.map((block) => block.el);
    if (!parsed.length) return;
    let range = currentRange();
    if (!range) {
      focusEdge("end");
      range = currentRange();
    }
    const block = range && textblockOf(range.startContainer);

    if (block?.tagName === "PRE") return insertCodeText(md);
    if (block && isCell(block)) {
      const holder = document.createElement("span");
      MDE.parseInline(md.replace(/\s*\n\s*/g, " ").trim(), holder, ctx);
      return insertInline([...holder.childNodes]);
    }
    // Un simple bout de texte se glisse dans la phrase en cours.
    if (parsed.length === 1 && parsed[0].tagName === "P") {
      const nodes = [...parsed[0].childNodes];
      while (nodes[nodes.length - 1]?.nodeName === "BR") nodes.pop();
      return insertInline(nodes);
    }

    if (!range.collapsed) {
      deleteSelection(range);
      range = currentRange();
    }
    const current = textblockOf(range.startContainer);
    const holder = current ? blockOf(current) : null;
    let anchor = holder;
    if (current && current === holder && !isAtom(current)) {
      // Le paragraphe est coupé au curseur : le collage prend place entre ses
      // deux moitiés, et celles qui restent vides disparaissent.
      const rest = atEnd(current, range) ? null : splitBlock(current, range, "p");
      if (isEmptyBlock(current)) {
        anchor = document.createComment("");
        current.replaceWith(anchor);
      }
      if (rest && isEmptyBlock(rest)) rest.remove();
    }
    const fragment = document.createDocumentFragment();
    fragment.append(...parsed);
    const last = parsed[parsed.length - 1];
    if (anchor) {
      anchor.after(fragment);
      if (anchor.nodeType === 8) anchor.remove();
    } else {
      root.appendChild(fragment);
    }
    tidyStructure();
    if (isAtom(last)) caretToStart(last.nextElementSibling ?? last);
    else caretToEnd(last);
  }

  /* ---- Tableaux ----------------------------------------------------------- */

  function cellContext() {
    const range = currentRange();
    const cell = range && textblockOf(range.startContainer);
    if (!cell || !isCell(cell)) return null;
    const table = cell.closest("table");
    const rows = [...table.rows];
    const row = rows.indexOf(cell.parentElement);
    const col = [...cell.parentElement.cells].indexOf(cell);
    return { cell, table, rows, row, col, wrap: table.closest(".mde-table-wrap") };
  }

  function blankCell(tag, align) {
    const cell = document.createElement(tag);
    if (align) cell.dataset.align = align;
    cell.appendChild(document.createElement("br"));
    return cell;
  }

  const TABLE_ACTIONS = {
    rowAdd({ table, rows, row, col }) {
      const body = table.tBodies[0] ?? table.appendChild(document.createElement("tbody"));
      const tr = document.createElement("tr");
      for (const head of rows[0].cells) tr.appendChild(blankCell("td", head.dataset.align));
      if (row <= 0) body.insertBefore(tr, body.firstChild);
      else rows[row].after(tr);
      caretToStart(tr.cells[col] ?? tr.cells[0]);
    },
    rowAddAbove(context) {
      // Rien ne passe au-dessus de l'en-tête : la ligne va juste en dessous.
      if (context.row <= 0) return TABLE_ACTIONS.rowAdd(context);
      const tr = document.createElement("tr");
      for (const head of context.rows[0].cells) tr.appendChild(blankCell("td", head.dataset.align));
      context.rows[context.row].before(tr);
      caretToStart(tr.cells[context.col] ?? tr.cells[0]);
    },
    colAdd({ rows, row, col }) {
      rows.forEach((tr, index) => tr.cells[col].after(blankCell(index === 0 ? "th" : "td")));
      caretToStart(rows[row].cells[col + 1]);
    },
    colAddLeft({ rows, row, col }) {
      rows.forEach((tr, index) => tr.cells[col].before(blankCell(index === 0 ? "th" : "td")));
      caretToStart(rows[row].cells[col]);
    },
    rowDel({ rows, row, col, wrap }) {
      // L'en-tête ne se retire pas : sans lui, ce n'est plus un tableau markdown.
      if (row === 0) return toast("La ligne d'en-tête ne se retire pas : supprime le tableau entier.", "ko");
      rows[row].remove();
      const next = rows[row + 1] ?? rows[row - 1];
      if (next?.isConnected) caretToEnd(next.cells[col] ?? next.cells[0]);
      else leaveBlock(wrap);
    },
    colDel({ rows, row, col, wrap }) {
      if (rows[0].cells.length <= 1) return removeTable(wrap);
      for (const tr of rows) tr.cells[col]?.remove();
      caretToEnd(rows[row].cells[Math.min(col, rows[row].cells.length - 1)]);
    },
    alignLeft: (context) => alignColumn(context, "left"),
    alignCenter: (context) => alignColumn(context, "center"),
    alignRight: (context) => alignColumn(context, "right"),
    remove: ({ wrap }) => removeTable(wrap),
  };

  function alignColumn({ rows, col }, align) {
    const same = rows[0].cells[col]?.dataset.align === align;
    for (const tr of rows) {
      const cell = tr.cells[col];
      if (!cell) continue;
      if (same) delete cell.dataset.align;
      else cell.dataset.align = align;
    }
  }

  function removeTable(wrap) {
    const next = wrap.nextElementSibling ?? wrap.previousElementSibling;
    wrap.remove();
    if (next?.isConnected) caretToStart(next);
  }

  function moveCell(step) {
    const context = cellContext();
    if (!context) return;
    const cells = [...context.table.querySelectorAll("th,td")];
    const index = cells.indexOf(context.cell) + step;
    if (index < 0) return;
    if (index >= cells.length) return edit(() => TABLE_ACTIONS.rowAdd({ ...context, col: 0 }));
    const target = cells[index];
    const all = document.createRange();
    const end = inlineEnd(target);
    all.setStart(target, 0);
    all.setEnd(end.node, end.offset);
    window.getSelection().setBaseAndExtent(all.startContainer, all.startOffset, all.endContainer, all.endOffset);
  }

  /* Le bouton « ⋯ » de la cellule où l'on écrit ouvre le menu du tableau. Il
     tient dans la marge, à hauteur de la ligne courante — ou dans le coin de la
     cellule quand la marge est trop étroite. Rien ne bouge quand il apparaît,
     et il ne masque pas la ligne de texte qui précède le tableau. */
  const TABLE_MENU = [
    { id: "rowAddAbove", group: "add", label: "Insérer une ligne au-dessus", icon: "rowAddAbove" },
    { id: "rowAdd", group: "add", label: "Insérer une ligne en dessous", icon: "rowAdd" },
    { id: "colAddLeft", group: "add", label: "Insérer une colonne à gauche", icon: "colAddLeft" },
    { id: "colAdd", group: "add", label: "Insérer une colonne à droite", icon: "colAdd" },
    { id: "alignLeft", group: "align", label: "Aligner la colonne à gauche", icon: "alignLeft" },
    { id: "alignCenter", group: "align", label: "Centrer la colonne", icon: "alignCenter" },
    { id: "alignRight", group: "align", label: "Aligner la colonne à droite", icon: "alignRight" },
    { id: "rowDel", group: "remove", label: "Supprimer la ligne", icon: "rowDel" },
    { id: "colDel", group: "remove", label: "Supprimer la colonne", icon: "colDel" },
    { id: "remove", group: "remove", label: "Supprimer le tableau", icon: "trash", danger: true },
  ];

  const cellButton = layer.appendChild(MDE.button({ icon: "more", tip: "Lignes et colonnes", className: "mde-cell-btn" }));
  cellButton.hidden = true;
  let tableMenu = null;
  let currentCell = null;

  cellButton.addEventListener("click", () => {
    if (tableMenu) return tableMenu.close();
    const context = cellContext();
    if (!context) return;
    const align = context.rows[0].cells[context.col]?.dataset.align ?? "";
    const aligned = align ? `align${align[0].toUpperCase()}${align.slice(1)}` : "";
    const inHeader = context.row === 0;
    tableMenu = MDE.menu({
      anchor: cellButton,
      owner: cellButton,
      align: "end",
      className: "mde-menu-compact",
      items: TABLE_MENU.filter((item) => !(inHeader && (item.id === "rowAddAbove" || item.id === "rowDel"))).map((item) => ({
        ...item,
        active: item.id === aligned,
      })),
      onPick: (item) => {
        const now = cellContext();
        if (now) edit(() => TABLE_ACTIONS[item.id](now));
      },
      onClose: () => {
        tableMenu = null;
        cellButton.classList.remove("is-open");
      },
    });
    cellButton.classList.add("is-open");
  });
  const unbindCellTips = MDE.bindTips(layer);

  function placeCellButton(context) {
    const cell = context?.cell ?? null;
    if (cell !== currentCell) {
      for (const el of root.querySelectorAll(".is-current")) el.classList.remove("is-current");
      cell?.classList.add("is-current");
      currentCell = cell;
      tableMenu?.close();
    }
    cellButton.hidden = !context;
    if (!context) return;
    const frame = host.getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    const view = context.wrap.getBoundingClientRect();
    const toHost = (x, y) => [x - frame.left - host.clientLeft + host.scrollLeft, y - frame.top - host.clientTop + host.scrollTop];
    const size = cellButton.offsetWidth;
    const room = frame.left + host.clientLeft + host.clientWidth - view.right;
    const [left, top] =
      room >= size + 4
        ? toHost(view.right + 3, box.top + Math.min(box.height, 40) / 2 - size / 2)
        : toHost(Math.min(box.right, view.right) - size - 3, box.top + 3);
    cellButton.style.left = `${Math.round(left)}px`;
    cellButton.style.top = `${Math.round(top)}px`;
  }

  /* ---- Liens -------------------------------------------------------------- */

  const linkAt = (node) => {
    const el = (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.("a[data-href]");
    return el && root.contains(el) ? el : null;
  };

  function openTarget(href) {
    if (/^(https?:\/\/|mailto:)/i.test(href)) return void window.open(href, "_blank", "noopener,noreferrer");
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return toast("Ce type d'adresse ne s'ouvre pas d'ici.", "ko");
    const url = files?.resolve?.(href, "open");
    if (url) window.open(url, "_blank", "noopener");
    else toast("Ce lien désigne un fichier local : il ne s'ouvre pas d'ici.", "ko");
  }

  function applyLink(href, text, existing) {
    if (existing?.isConnected) {
      existing.dataset.href = href;
      delete existing.dataset.auto;
      if (text && text !== existing.textContent) existing.textContent = text;
      return caretToEnd(existing);
    }
    const range = currentRange();
    if (!range) return;
    if (range.collapsed) {
      const a = MDE.makeLink(href);
      a.textContent = text || href;
      const prop = document.createTextNode(ZWSP);
      insertInline([a, prop]);
      return setCaret(prop, 1);
    }
    const nodes = textsInRange(range);
    for (const node of nodes) {
      const inside = linkAt(node);
      if (inside) {
        inside.dataset.href = href;
        delete inside.dataset.auto;
        continue;
      }
      const a = MDE.makeLink(href);
      node.replaceWith(a);
      a.appendChild(node);
    }
    const last = nodes[nodes.length - 1];
    if (last) setCaret(last, last.length);
  }

  function removeLink(a) {
    if (!a.isConnected) return;
    keepingSelection(() => unwrap(a));
  }

  function openLinkForm(existing = null) {
    closeBubbles();
    if (!currentRange()) focusEdge("end");
    const range = currentRange();
    const link = existing ?? linkAt(range.startContainer);
    const saved = saveSelection();
    const selected = range.toString().trim();
    const needsText = !link && range.collapsed;
    const anchor = link ?? caretRect() ?? bar?.anchorFor("link");

    MDE.popover({
      anchor,
      className: "mde-form",
      build: (el, close) => {
        const url = MDE.field("Adresse", {
          value: link?.dataset.href ?? (/^(https?:\/\/|www\.)\S+$/i.test(selected) ? selected : ""),
          placeholder: "https://…",
        });
        const label = needsText || link ? MDE.field("Texte", { value: link ? link.textContent : "", placeholder: "Texte du lien" }) : null;
        const submit = () => {
          const href = normalizeUrl(url.input.value);
          if (!href) return url.input.focus();
          close();
          restoreSelection(saved);
          edit(() => applyLink(href, label?.input.value.trim() ?? "", link));
        };
        const actions = make("div", "mde-form-actions");
        if (link) {
          const remove = MDE.action("Retirer", { icon: "unlink" });
          remove.addEventListener("click", () => {
            close();
            restoreSelection(saved);
            edit(() => removeLink(link));
          });
          actions.appendChild(remove);
        }
        const apply = MDE.action(link ? "Enregistrer" : "Ajouter le lien", { primary: true });
        apply.addEventListener("click", submit);
        actions.appendChild(apply);
        el.append(url.wrap);
        if (label) el.append(label.wrap);
        el.append(actions);
        MDE.submitOnEnter(el, submit);
        requestAnimationFrame(() => url.input.focus());
      },
      onClose: () => {
        if (!destroyed && !host.contains(document.activeElement) && !MDE.focusInPopover()) restoreSelection(saved);
      },
    });
  }

  /** La petite bulle qui accompagne le curseur dans un lien : on y lit
   *  l'adresse, on l'ouvre, on la change. Elle ne prend jamais le focus. */
  function showLinkBubble(a) {
    if (linkBubble?.target === a) return linkBubble.pop.reposition();
    linkBubble?.pop.close();
    const pop = MDE.popover({
      anchor: a,
      className: "mde-bubble",
      owner: root,
      build: (el) => {
        const address = make("span", "mde-bubble-text", a.dataset.href || "(adresse vide)");
        address.title = a.dataset.href ?? "";
        const open = MDE.button({ icon: "open", tip: "Ouvrir le lien" });
        open.addEventListener("click", () => openTarget(a.dataset.href ?? ""));
        const change = MDE.button({ icon: "link", tip: "Modifier le lien" });
        change.addEventListener("click", () => openLinkForm(a));
        const remove = MDE.button({ icon: "unlink", tip: "Retirer le lien" });
        remove.addEventListener("click", () => edit(() => removeLink(a)));
        el.append(address, open, change, remove);
      },
      onClose: () => {
        if (linkBubble?.pop === pop) linkBubble = null;
      },
    });
    linkBubble = { target: a, pop };
  }

  /* ---- Images et fichiers ------------------------------------------------- */

  function showImageBubble(img) {
    if (imageBubble?.target === img) return imageBubble.pop.reposition();
    imageBubble?.pop.close();
    const pop = MDE.popover({
      anchor: img,
      className: "mde-bubble mde-bubble-image",
      owner: root,
      build: (el) => {
        if (img.classList.contains("is-blocked")) {
          const show = MDE.action(`Afficher (${hostOf(img.dataset.src)})`, { icon: "eye", primary: true });
          show.addEventListener("mousedown", (event) => event.preventDefault());
          show.addEventListener("click", () => {
            allowHost(hostOf(img.dataset.src));
            for (const other of root.querySelectorAll("img.is-blocked")) paintImage(other);
            closeBubbles();
          });
          el.appendChild(show);
        }
        const alt = make("input", "mde-input mde-bubble-input");
        alt.type = "text";
        alt.placeholder = "Description de l'image";
        alt.value = img.getAttribute("alt") ?? "";
        alt.setAttribute("aria-label", "Description de l'image");
        let recorded = false;
        alt.addEventListener("input", () => {
          if (!recorded) record("command");
          recorded = true;
          img.alt = alt.value;
          flushMutations();
          const md = serialize();
          if (md !== lastMd) {
            lastMd = md;
            doc.setContent(md);
          }
        });
        alt.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          closeBubbles();
          selectNode(img);
        });
        const remove = MDE.button({ icon: "trash", tip: "Supprimer l'image", className: "is-danger" });
        remove.addEventListener("click", () => {
          closeBubbles();
          edit(() => {
            const block = textblockOf(img);
            setCaret(img.parentNode, indexOf(img));
            img.remove();
            if (block?.tagName === "P" && isEmptyBlock(block) && block.nextElementSibling) {
              const next = block.nextElementSibling;
              block.remove();
              caretToStart(next);
            }
          });
        });
        el.append(alt, remove);
      },
      onClose: () => {
        if (imageBubble?.pop === pop) imageBubble = null;
      },
    });
    imageBubble = { target: img, pop };
  }

  function closeBubbles() {
    linkBubble?.pop.close();
    imageBubble?.pop.close();
    closeSlash();
  }

  const titleOfFile = (name) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

  /** Envoie des fichiers et les pose dans le document : l'image s'affiche tout
   *  de suite, son adresse définitive arrive quand l'envoi a réussi. */
  function insertFiles(list, place) {
    const chosen = [...(list ?? [])];
    if (!chosen.length) return;
    if (!files?.upload) {
      toast("Ici, une image s'ajoute par son adresse : bouton Image de la barre d'outils.", "ko");
      return;
    }
    record("command");
    if (place) place();
    else if (!currentRange()) focusEdge("end");

    for (const file of chosen) {
      const image = IMAGE_TYPES.test(file.type);
      let holder;
      let preview = null;
      if (image) {
        holder = make("img", "mde-img is-uploading");
        holder.alt = titleOfFile(file.name);
        holder.draggable = false;
        preview = URL.createObjectURL(file);
        holder.src = preview;
        uploads.add(holder);
        placeImage(holder);
      } else {
        holder = make("span", "mde-upload", `Envoi de ${file.name}…`);
        holder.dataset.mdeSkip = "";
        holder.setAttribute("contenteditable", "false");
        const at = currentRange();
        const block = at && textblockOf(at.startContainer);
        const glued = block && /\S$/.test(textBefore(block, at));
        insertInline([...(glued ? [document.createTextNode(" ")] : []), holder, document.createTextNode(" ")]);
      }

      Promise.resolve()
        .then(() => files.upload(file))
        .then((result) => {
          if (!result?.src) throw new Error("aucun chemin rendu");
          uploads.delete(holder);
          if (destroyed || !holder.isConnected) return;
          if (image) {
            holder.dataset.src = result.src;
            holder.classList.remove("is-uploading");
            const shown = displayUrl(result.src);
            if (shown.url) {
              // L'aperçu local reste affiché jusqu'à ce que la vraie image soit
              // chargée : pas de clignotement entre les deux.
              const real = new Image();
              real.onload = real.onerror = () => {
                if (holder.isConnected) holder.src = shown.url;
                URL.revokeObjectURL(preview);
              };
              real.src = shown.url;
            }
          } else {
            const a = MDE.makeLink(result.src);
            a.textContent = result.name ?? file.name;
            holder.replaceWith(a);
          }
          commit();
        })
        .catch((error) => {
          uploads.delete(holder);
          if (preview) URL.revokeObjectURL(preview);
          holder.remove();
          toast(`« ${file.name} » n'a pas pu être ajouté : ${error?.message ?? error}`, "ko");
          if (!destroyed) commit();
        });
    }
    commit();
  }

  function pickFiles(accept) {
    const saved = saveSelection();
    const input = make("input");
    input.type = "file";
    input.multiple = true;
    if (accept) input.accept = accept;
    input.addEventListener("change", () => {
      root.focus({ preventScroll: true });
      restoreSelection(saved);
      insertFiles(input.files);
    });
    input.click();
  }

  function openImageForm() {
    closeBubbles();
    if (!currentRange()) focusEdge("end");
    const saved = saveSelection();
    MDE.popover({
      anchor: bar?.anchorFor("image") ?? caretRect(),
      owner: bar?.anchorFor("image"),
      className: "mde-form",
      build: (el, close) => {
        if (files?.upload) {
          const pick = MDE.action("Choisir une image…", { icon: "upload", primary: true });
          pick.classList.add("is-wide");
          pick.addEventListener("click", () => {
            close();
            restoreSelection(saved);
            pickFiles("image/*");
          });
          el.append(pick, make("div", "mde-form-note", "ou glisse-la directement dans le texte"), make("div", "mde-form-rule", "ou par son adresse"));
        }
        const url = MDE.field("Adresse de l'image", { placeholder: "https://…/image.png" });
        const alt = MDE.field("Description", { placeholder: "Ce que montre l'image" });
        const submit = () => {
          const src = normalizeUrl(url.input.value);
          if (!src) return url.input.focus();
          // Une adresse qu'on saisit soi-même est une image qu'on veut voir.
          if (/^https?:\/\//i.test(src)) allowHost(hostOf(src));
          close();
          restoreSelection(saved);
          edit(() => placeImage(MDE.makeImage(alt.input.value.trim(), src, "", ctx)));
        };
        const actions = make("div", "mde-form-actions");
        const apply = MDE.action("Insérer", { primary: !files?.upload });
        apply.addEventListener("click", submit);
        actions.appendChild(apply);
        el.append(url.wrap, alt.wrap, actions);
        MDE.submitOnEnter(el, submit);
        if (!files?.upload) requestAnimationFrame(() => url.input.focus());
      },
    });
  }

  /* ---- Menu « / » --------------------------------------------------------- */

  function slashQuery() {
    const range = currentRange();
    if (!range?.collapsed) return null;
    const block = textblockOf(range.startContainer);
    if (!block || block.tagName !== "P" || !atEnd(block, range)) return null;
    const match = /^\/([\p{L}\p{N}][\p{L}\p{N} ]{0,23})?$/u.exec(textBefore(block, range));
    return match ? { block, query: match[1] ?? "" } : null;
  }

  function closeSlash() {
    slash?.menu.close();
    slash = null;
  }

  function updateSlash() {
    const found = slashQuery();
    if (!found) return closeSlash();
    if (!slash) {
      const items = MDE.INSERT_CHOICES.filter((item) => item.id !== "file" || files?.upload);
      const menu = MDE.menu({
        anchor: () => caretRect(),
        owner: root,
        items,
        title: "Insérer",
        className: "mde-menu-slash",
        onPick: (item) => {
          const at = slashQuery();
          slash = null;
          if (at) {
            record("command");
            at.block.replaceChildren(document.createElement("br"));
            setCaret(at.block, 0);
          }
          run(item.id === "p" ? "block" : item.id, item.id === "p" ? "p" : undefined);
        },
        onClose: () => {
          if (slash?.menu === menu) slash = null;
        },
      });
      slash = { menu };
    }
    slash.menu.filter(found.query);
    // Plus rien ne correspond et l'on continue d'écrire : ce n'était pas une commande.
    if (slash.menu.empty && found.query.length > 6) closeSlash();
  }

  /* ---- Commandes ---------------------------------------------------------- */

  function run(id, arg) {
    if (destroyed) return;
    if (id === "source") return toggleSource();
    if (sourceMode) return;
    if (id === "undo") return undo();
    if (id === "redo") return redo();
    closeBubbles();
    if (!currentRange()) focusEdge("end");

    if (MARK_TAGS[id]) return edit(() => toggleMark(id));
    if (id === "block") return edit(() => setBlock(arg ?? "p"));
    if (/^h[1-6]$/.test(id)) return edit(() => setBlock(id));
    if (id === "ul" || id === "ol" || id === "task") return edit(() => toggleList(id));
    if (id === "quote") return edit(toggleQuote);
    if (id === "pre") return edit(toggleCode);
    if (id === "hr") return edit(insertRule);
    if (id === "table") return edit(() => insertTable(arg?.rows ?? 3, arg?.cols ?? 3));
    if (id === "link") return openLinkForm();
    if (id === "image") return openImageForm();
    if (id === "file") return pickFiles("");
  }

  /* ---- État de la barre ---------------------------------------------------- */

  function readState() {
    const state = {
      marks: new Set(),
      block: "p",
      link: false,
      inCode: false,
      source: sourceMode,
      canUndo: history.undo.length > 0,
      canRedo: history.redo.length > 0,
    };
    const range = sourceMode ? null : currentRange();
    const block = range && textblockOf(range.startContainer);
    if (!block) return state;
    const el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    for (const [name, tag] of Object.entries(MARK_TAGS)) {
      const mark = el.closest(tag.toLowerCase());
      if (mark && block.contains(mark) && mark.parentElement?.tagName !== "PRE") state.marks.add(name);
    }
    state.link = Boolean(linkAt(el));
    state.inCode = block.tagName === "PRE";
    if (block.tagName === "PRE") state.block = "pre";
    else if (isCell(block)) state.block = "table";
    else if (block.tagName === "LI") state.block = block.classList.contains("mde-task") ? "task" : block.parentElement.tagName.toLowerCase();
    else state.block = block.tagName.toLowerCase();
    if (block.closest("blockquote")) state.quote = true;
    return state;
  }

  function refresh() {
    if (destroyed) return;
    const state = readState();
    if (state.quote) state.marks.add("quote");
    bar?.update(state);

    const only = root.children.length === 1 ? root.firstElementChild : null;
    root.classList.toggle("is-empty", Boolean(only && only.tagName === "P" && isEmptyBlock(only)));

    const picked = sourceMode ? null : nodeSelection();
    if (picked !== selectedNode) {
      for (const el of root.querySelectorAll(".is-selected")) el.classList.remove("is-selected");
      selectedNode = picked;
      selectedNode?.classList.add("is-selected");
    }

    const range = sourceMode ? null : currentRange();
    const focused = document.activeElement === root;
    placeCellButton(range && focused ? cellContext() : null);

    const link = range?.collapsed && focused ? linkAt(range.startContainer) : null;
    if (link) showLinkBubble(link);
    else if (linkBubble && !MDE.focusInPopover()) linkBubble.pop.close();

    if (picked?.tagName === "IMG" && !picked.classList.contains("is-uploading")) showImageBubble(picked);
    else if (imageBubble && !imageBubble.pop.contains(document.activeElement)) imageBubble.pop.close();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  /* ---- Événements --------------------------------------------------------- */

  function onBeforeInput(event) {
    if (composing || event.isComposing) return;
    const type = event.inputType;

    if (type === "historyUndo" || type === "historyRedo") {
      event.preventDefault();
      return type === "historyUndo" ? undo() : redo();
    }
    if (type === "insertParagraph" || type === "insertLineBreak") {
      event.preventDefault();
      if (slash) return;
      return edit(type === "insertParagraph" ? insertParagraph : insertLineBreak);
    }
    if (type.startsWith("delete")) {
      record("delete");
      if (handleDelete(type)) {
        event.preventDefault();
        history.kind = null;
        commit();
        updateSlash();
      }
      return;
    }
    if (type === "insertText" || type === "insertReplacementText") {
      record("type");
      const range = currentRange();
      if (!range || range.collapsed) return;
      const picked = nodeSelection(range);
      const from = textblockOf(range.startContainer);
      if (!picked && from && from === textblockOf(range.endContainer)) return;
      // La sélection enjambe plusieurs blocs : on l'efface nous-mêmes, puis on
      // pose le texte là où elle commençait.
      event.preventDefault();
      deleteSelection(range);
      const text = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
      if (text) insertInline([document.createTextNode(text)]);
      commit();
      return;
    }
    if (type === "insertCompositionText" || type === "insertFromComposition") return;
    // Collage et dépôt passent par leurs propres événements ; le reste (mise
    // en forme native, listes natives) laisserait un DOM hors vocabulaire.
    event.preventDefault();
  }

  function onInput(event) {
    if (composing || event.isComposing) return;
    const range = currentRange();
    if (event.inputType === "insertText" && range?.collapsed && event.data) {
      const block = textblockOf(range.startContainer);
      if (block && block.tagName !== "PRE") {
        if (event.data === " " || event.data === " ") blockRule(block, range);
        else inlineRule(range);
      }
    }
    commit();
    updateSlash();
  }

  function onKeyDown(event) {
    if (event.isComposing || sourceMode) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;

    if (slash) {
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        return slash.menu.move(key === "ArrowDown" ? 1 : -1);
      }
      if (key === "Enter" || key === "Tab") {
        event.preventDefault();
        if (!slash.menu.pick()) closeSlash();
        return;
      }
    }

    if (mod && event.altKey && /^Digit[0-6]$/.test(event.code)) {
      event.preventDefault();
      const level = Number(event.code.slice(5));
      return run("block", level ? `h${level}` : "p");
    }
    if (mod && !event.altKey) {
      const letter = key.toLowerCase();
      const command =
        letter === "z" ? (event.shiftKey ? "redo" : "undo")
        : letter === "y" ? "redo"
        : letter === "b" ? "strong"
        : letter === "i" ? "em"
        : letter === "e" ? "code"
        : letter === "k" ? "link"
        : event.shiftKey && (letter === "x" || letter === "s") ? "del"
        : event.shiftKey && event.code === "Digit7" ? "ol"
        : event.shiftKey && event.code === "Digit8" ? "ul"
        : event.shiftKey && event.code === "Digit9" ? "task"
        : null;
      if (command) {
        event.preventDefault();
        return run(command);
      }
      if (letter === "u") return event.preventDefault();
      if (key === "Enter") {
        event.preventDefault();
        const range = currentRange();
        const block = range && topBlockOf(range.startContainer);
        if (block) edit(() => leaveBlock(block));
        return;
      }
    }

    if (key === "Tab" && !mod && !event.altKey) {
      const range = currentRange();
      const block = range && textblockOf(range.startContainer);
      if (!block) return;
      if (block.tagName === "LI") {
        event.preventDefault();
        return edit(() => keepingSelection(() => (event.shiftKey ? outdent(block) : indent(block))));
      }
      if (isCell(block)) {
        event.preventDefault();
        return moveCell(event.shiftKey ? -1 : 1);
      }
      if (block.tagName === "PRE") {
        event.preventDefault();
        return edit(() => {
          if (!event.shiftKey) return insertCodeText("  ");
          const before = textBefore(block, currentRange());
          const lineStart = before.lastIndexOf("\n") + 1;
          const spaces = /^ {1,2}/.exec(before.slice(lineStart));
          if (!spaces) return;
          const text = lastText(codeOf(block));
          const caret = currentRange().startOffset;
          text.deleteData(lineStart, spaces[0].length);
          setCaret(text, Math.max(lineStart, caret - spaces[0].length));
        });
      }
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      return root.blur();
    }
    if (/^(Arrow|Home|End|Page)/.test(key)) history.kind = null;

    const range = currentRange();
    if (!range?.collapsed) return;
    if (key === "ArrowRight" && !mod && !event.shiftKey && escapeMark(range)) return event.preventDefault();

    // Un tableau ou un bloc de code en tête de document : la flèche haut ouvre
    // une ligne au-dessus, sans quoi rien ne s'écrirait avant lui.
    if (key === "ArrowUp" && !event.shiftKey) {
      const top = topBlockOf(range.startContainer);
      if (top !== root.firstElementChild || !isAtom(top)) return;
      const block = textblockOf(range.startContainer);
      const firstLine = isCell(block) ? block.parentElement === top.querySelector("tr") : !textBefore(block, range).includes("\n");
      if (!firstLine) return;
      event.preventDefault();
      edit(() => {
        const p = emptyParagraph();
        top.before(p);
        caretToStart(p);
      });
    }
  }

  function selectionMarkdown(range) {
    const common = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const block = textblockOf(common);
    if (block?.tagName === "PRE") return bare(range.toString());
    let holder = document.createElement("div");
    holder.appendChild(range.cloneContents());
    for (let el = common; el && el !== root && el !== block; el = el.parentElement) {
      const shell = el.cloneNode(false);
      shell.append(...holder.childNodes);
      holder.appendChild(shell);
    }
    if (block && (common !== block || !nestedList(block) || !holder.querySelector("ul,ol"))) return MDE.inlineToMarkdown(holder);
    if (block) {
      const shell = block.cloneNode(false);
      shell.append(...holder.childNodes);
      holder.appendChild(shell);
      for (let el = block.parentElement; el && el !== root; el = el.parentElement) {
        const outer = el.cloneNode(false);
        outer.append(...holder.childNodes);
        holder.appendChild(outer);
      }
    }
    return MDE.blocksToMarkdown([...holder.children]);
  }

  function onCopy(event) {
    const range = currentRange();
    if (!range || range.collapsed || !event.clipboardData) return;
    event.preventDefault();
    const html = document.createElement("div");
    html.appendChild(range.cloneContents());
    for (const a of html.querySelectorAll("a[data-href]")) {
      if (/^(https?:\/\/|mailto:)/i.test(a.dataset.href)) a.setAttribute("href", a.dataset.href);
    }
    for (const img of html.querySelectorAll("img")) {
      if (/^https?:\/\//i.test(img.dataset.src ?? "")) img.setAttribute("src", img.dataset.src);
    }
    event.clipboardData.setData("text/plain", selectionMarkdown(range));
    event.clipboardData.setData("text/html", html.innerHTML);
    if (event.type !== "cut") return;
    edit(() => {
      const from = textblockOf(range.startContainer);
      if (from && from === textblockOf(range.endContainer) && !nodeSelection(range)) range.deleteContents();
      else deleteSelection(range);
    });
  }

  function onPaste(event) {
    const data = event.clipboardData;
    if (!data) return;
    event.preventDefault();
    const text = data.getData("text/plain");
    const html = data.getData("text/html");
    if (data.files?.length && !text.trim()) return insertFiles(data.files);

    const range = currentRange();
    const block = range && textblockOf(range.startContainer);
    let md = text;
    if (block?.tagName !== "PRE" && html && isRichHtml(html) && !MDE.looksLikeMarkdown(text)) {
      md = htmlToMarkdown(html) || text;
    }
    if (!md) return;
    // Une adresse collée sur du texte sélectionné en fait un lien.
    if (range && !range.collapsed && /^https?:\/\/\S+$/i.test(md.trim()) && block?.tagName !== "PRE" && block === textblockOf(range.endContainer)) {
      return edit(() => applyLink(md.trim(), "", null));
    }
    edit(() => insertMarkdown(md.replace(/\r\n?/g, "\n")));
  }

  /* ---- Glisser-déposer ---------------------------------------------------- */

  const carriesFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes("Files");

  /** Le bloc visé par le pointeur, et de quel côté on lâcherait. */
  function dropTarget(event) {
    const blocks = [...root.children];
    if (!blocks.length) return null;
    let target = blocks[blocks.length - 1];
    let before = false;
    for (const block of blocks) {
      const box = block.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        target = block;
        before = true;
        break;
      }
    }
    return { target, before };
  }

  function showDropMark(event) {
    const at = dropTarget(event);
    if (!at) return;
    const frame = host.getBoundingClientRect();
    const box = at.target.getBoundingClientRect();
    const sheet = root.getBoundingClientRect();
    const y = (at.before ? box.top : box.bottom) - frame.top + host.scrollTop - host.clientTop;
    dropMark.hidden = false;
    dropMark.style.top = `${Math.round(y + (at.before ? -4 : 4))}px`;
    dropMark.style.left = `${Math.round(sheet.left - frame.left + host.scrollLeft - host.clientLeft)}px`;
    dropMark.style.width = `${Math.round(sheet.width)}px`;
    host.classList.add("is-dropping");
  }

  function hideDropMark() {
    dropMark.hidden = true;
    host.classList.remove("is-dropping");
  }

  function onDragOver(event) {
    if (sourceMode) return;
    if (carriesFiles(event)) {
      // Sans `files`, le dépôt revient à la page qui héberge l'éditeur (une
      // mission y joint ses fichiers) : on ne s'en mêle pas.
      if (!files?.upload) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      showDropMark(event);
    }
  }

  function onDragLeave(event) {
    if (!host.contains(event.relatedTarget)) hideDropMark();
  }

  function onDrop(event) {
    if (sourceMode) return;
    hideDropMark();
    if (carriesFiles(event)) {
      // Quoi qu'il arrive, le navigateur ne doit pas ouvrir le fichier à la
      // place de la page.
      event.preventDefault();
      if (!files?.upload) return;
      event.stopPropagation();
      const at = dropTarget(event);
      root.focus({ preventScroll: true });
      insertFiles(event.dataTransfer.files, () => {
        if (!at?.target.isConnected) return focusEdge("end");
        const p = emptyParagraph();
        if (at.before) at.target.before(p);
        else at.target.after(p);
        caretToStart(p);
      });
      return;
    }
    const text = event.dataTransfer?.getData("text/plain");
    event.preventDefault();
    if (!text) return;
    const point = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const position = point ?? document.caretPositionFromPoint?.(event.clientX, event.clientY);
    root.focus({ preventScroll: true });
    if (position) {
      const node = position.startContainer ?? position.offsetNode;
      const offset = position.startOffset ?? position.offset;
      if (root.contains(node)) setCaret(node, offset);
    }
    edit(() => insertMarkdown(text));
  }

  function onMouseDown(event) {
    history.kind = null;
    const target = event.target;
    // La case d'une tâche vit dans la marge de sa ligne.
    const task = target.nodeType === 1 && target.tagName === "LI" && target.classList.contains("mde-task") ? target : null;
    if (task) {
      const box = task.getBoundingClientRect();
      const gutter = parseFloat(getComputedStyle(task).paddingLeft) || 24;
      const lineHeight = parseFloat(getComputedStyle(task).lineHeight) || 24;
      if (event.clientX - box.left <= gutter && event.clientY - box.top <= lineHeight + 4) {
        event.preventDefault();
        edit(() => {
          task.dataset.checked = String(task.dataset.checked !== "true");
        });
        return;
      }
    }
    if (target.nodeType === 1 && (target.tagName === "IMG" || target.tagName === "HR") && root.contains(target)) {
      event.preventDefault();
      root.focus({ preventScroll: true });
      selectNode(target);
    }
  }

  // Cliquer dans le vide de la feuille reprend l'écriture en fin de document.
  function onHostMouseDown(event) {
    if (event.target !== host && event.target !== layer) return;
    event.preventDefault();
    if (sourceMode) return sourceField?.focus();
    focusEdge("end");
  }

  function onImageError(event) {
    const img = event.target;
    if (img?.tagName !== "IMG" || !img.classList.contains("mde-img")) return;
    if (img.classList.contains("is-missing") || img.classList.contains("is-blocked") || img.classList.contains("is-uploading")) return;
    img.classList.add("is-missing");
    img.src = placeholderImage("Image introuvable", img.dataset.src ?? "");
  }

  function onSelectionChange() {
    if (destroyed || sourceMode || !host.isConnected) return;
    queueRefresh();
    if (slash && !slashQuery()) closeSlash();
  }

  const onCompositionStart = () => {
    composing = true;
    record("type");
  };
  const onCompositionEnd = () => {
    composing = false;
    commit();
  };
  const onDragStart = (event) => event.preventDefault();
  const onBlur = () => queueRefresh();

  root.addEventListener("beforeinput", onBeforeInput);
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("copy", onCopy);
  root.addEventListener("cut", onCopy);
  root.addEventListener("paste", onPaste);
  root.addEventListener("mousedown", onMouseDown);
  root.addEventListener("dragstart", onDragStart);
  root.addEventListener("compositionstart", onCompositionStart);
  root.addEventListener("compositionend", onCompositionEnd);
  root.addEventListener("error", onImageError, true);
  root.addEventListener("scroll", queueRefresh, true);
  root.addEventListener("focus", onBlur);
  root.addEventListener("blur", onBlur);
  host.addEventListener("mousedown", onHostMouseDown);
  host.addEventListener("dragover", onDragOver);
  host.addEventListener("dragleave", onDragLeave);
  host.addEventListener("drop", onDrop);
  document.addEventListener("selectionchange", onSelectionChange);

  const bar = toolbar ? MDE.buildToolbar(toolbar, { run, withFiles: Boolean(files?.upload) }) : null;

  /* ---- Markdown brut ------------------------------------------------------
     Le même texte, tel qu'il est écrit dans le fichier : pour voir ou corriger
     ce que la mise en forme ne montre pas. Rien n'est converti en y entrant. */

  function renderSource(source) {
    if (sourceField.value === source) return;
    const { selectionStart, selectionEnd } = sourceField;
    sourceField.value = source;
    sourceField.setSelectionRange(Math.min(selectionStart, source.length), Math.min(selectionEnd, source.length));
  }

  function toggleSource() {
    closeBubbles();
    MDE.closeAllPopovers();
    if (!sourceMode) {
      sourceMode = true;
      sourceField = make("textarea", "mde-source");
      sourceField.spellcheck = spellcheck;
      sourceField.setAttribute("aria-label", "Markdown brut");
      sourceField.value = String(doc.getContent() ?? "");
      sourceField.addEventListener("input", () => {
        lastMd = null;
        doc.setContent(sourceField.value);
      });
      root.hidden = true;
      layer.hidden = true;
      host.classList.add("is-source");
      host.appendChild(sourceField);
      sourceField.focus();
      sourceField.setSelectionRange(0, 0);
    } else {
      sourceMode = false;
      sourceField.remove();
      sourceField = null;
      root.hidden = false;
      layer.hidden = false;
      host.classList.remove("is-source");
      const source = String(doc.getContent() ?? "");
      if (source !== lastMd) {
        paint(source);
        history.undo.length = 0;
        history.redo.length = 0;
      }
      focusEdge("start");
    }
    refresh();
  }

  /* ---- Ce que voit l'appelant --------------------------------------------- */

  function focusEdge(position) {
    root.focus({ preventScroll: true });
    const blocks = root.querySelectorAll(TEXTBLOCKS);
    if (!blocks.length) return;
    if (position === "start") caretToStart(blocks[0]);
    else caretToEnd(blocks[blocks.length - 1]);
    refresh();
  }

  function render() {
    if (destroyed) return;
    const source = String(doc.getContent() ?? "");
    if (sourceMode) return renderSource(source);
    // Le texte est déjà celui qu'on affiche : ne rien repeindre garde le
    // curseur, les lignes vides en cours de frappe et la pile d'annulation.
    if (lastMd !== null && source === lastMd) return refresh();
    closeBubbles();
    paint(source);
    history.undo.length = 0;
    history.redo.length = 0;
    history.kind = null;
    refresh();
  }

  /** Reprend un texte changé ailleurs, curseur gardé au plus près. */
  function reload() {
    if (destroyed) return;
    const source = String(doc.getContent() ?? "");
    if (sourceMode) return renderSource(source);
    if (lastMd !== null && source === lastMd) return;
    const range = currentRange();
    const focused = document.activeElement === root && range;
    const index = focused ? [...root.children].indexOf(topBlockOf(range.startContainer)) : -1;
    const offset = focused && index >= 0 ? textBefore(root.children[index], range).length : 0;
    render();
    if (index < 0) return;
    const block = root.children[Math.min(index, root.children.length - 1)];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let left = offset;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (left <= node.length) return setCaret(node, left);
      left -= node.length;
    }
    caretToEnd(block);
  }

  return {
    render,
    reload,
    focus: (position = "end") => {
      if (destroyed) return;
      if (!sourceMode) return focusEdge(position);
      sourceField.focus();
      const at = position === "start" ? 0 : sourceField.value.length;
      sourceField.setSelectionRange(at, at);
    },
    /** Vrai si l'on écrit ici — dans le texte ou dans l'une de ses bulles.
     *  L'appelant s'en sert pour ne pas écraser une frappe en cours. */
    isFocused: () => !destroyed && (host.contains(document.activeElement) || MDE.focusInPopover()),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      closeBubbles();
      MDE.closeAllPopovers();
      unbindCellTips();
      bar?.destroy();
      document.removeEventListener("selectionchange", onSelectionChange);
      host.removeEventListener("mousedown", onHostMouseDown);
      host.removeEventListener("dragover", onDragOver);
      host.removeEventListener("dragleave", onDragLeave);
      host.removeEventListener("drop", onDrop);
      host.classList.remove("mde-host", "is-source", "is-dropping");
      host.replaceChildren();
      history.undo.length = 0;
      history.redo.length = 0;
      uploads.clear();
    },
  };
}

window.Allkin.provide("markdown-editor", { create: createEditor });

})();
