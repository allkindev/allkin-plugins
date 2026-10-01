"use strict";
/* ============================================================================
   Éditeur markdown — le modèle : markdown ⇄ DOM.
   ----------------------------------------------------------------------------
   L'éditeur n'affiche jamais la source : il affiche un vrai document (titres,
   listes, tableaux, images) qu'on édite tel quel. Ce fichier fait les deux
   traductions :

     parseDocument(source)  -> les blocs du document, en éléments DOM ;
     blockToMarkdown(el)    -> le markdown d'un bloc.

   SÉCURITÉ. Le texte peut venir d'un agent, donc d'un LLM qui a pu lire
   n'importe quoi. Rien de ce fichier ne passe par innerHTML : chaque élément
   est créé par createElement, chaque texte posé par un nœud texte. Une adresse
   n'est jamais écrite dans `href` (un lien n'est qu'un `data-href`, ouvert sur
   demande par l'éditeur), et une image ne reçoit de `src` que par
   `ctx.paintImage`, qui décide de ce qui a le droit de s'afficher.

   FIDÉLITÉ. Chaque bloc de premier niveau garde sa source d'origine : tant
   qu'on n'y touche pas, c'est elle qui est réécrite, au caractère près (voir
   editor.js). Ouvrir un fichier et corriger un mot ne le reformate pas.
   ========================================================================== */
(() => {

const MDE = (window.AllkinMde = window.AllkinMde || {});

/** Espace sans chasse : sert d'appui au curseur (voir editor.js), jamais écrit. */
const ZWSP = "\u200B";

const RE_LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RE_FENCE_OPEN = /^(\s*)(`{3,}|~{3,})[ \t]*([^`\n]*)$/;
const RE_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RE_HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const RE_QUOTE = /^ {0,3}>/;
const RE_QUOTE_STRIP = /^ {0,3}> ?/;
const RE_TABLE_RULE = /^[\s|:-]+$/;
const RE_TASK = /^\[([ xX])\](?:[ \t]+|(?=\n)|$)/;
const RE_WORD = /[\p{L}\p{N}]/u;
const RE_ESCAPABLE = /[!-\/:-@\[-`{-~]/;

const indentWidth = (blank) => blank.replace(/\t/g, "    ").length;
const isOrderedMarker = (marker) => /\d/.test(marker);

function isTableStart(lines, i) {
  const rule = lines[i + 1];
  return lines[i].includes("|") && rule !== undefined && rule.includes("-") && RE_TABLE_RULE.test(rule);
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return (
    RE_FENCE_OPEN.test(line) ||
    RE_LIST.test(line) ||
    /^ {0,3}#{1,6}(\s|$)/.test(line) ||
    RE_QUOTE.test(line) ||
    RE_HR.test(line) ||
    isTableStart(lines, i)
  );
}

/* ---- Passe « inline » ---------------------------------------------------- */

function countRun(text, i, char) {
  let n = 0;
  while (text[i + n] === char) n++;
  return n;
}

/** Fin d'un extrait de code ouvert par `run` accents graves, ou -1. */
function findCodeClose(text, from, run) {
  for (let j = from; j < text.length; j++) {
    if (text[j] !== "`") continue;
    const n = countRun(text, j, "`");
    if (n === run) return j;
    j += n - 1;
  }
  return -1;
}

/** Saute un extrait de code rencontré en cherchant autre chose. */
function skipCode(text, j) {
  const run = countRun(text, j, "`");
  const close = findCodeClose(text, j + run, run);
  return close === -1 ? j + run - 1 : close + run - 1;
}

/** `[libellé](adresse "titre")` à partir du crochet ouvrant, ou null. */
function matchLink(text, start) {
  let depth = 0;
  let j = start;
  for (; j < text.length; j++) {
    const ch = text[j];
    if (ch === "\\") j++;
    else if (ch === "`") j = skipCode(text, j);
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) break;
  }
  if (j >= text.length || text[j + 1] !== "(") return null;
  const label = text.slice(start + 1, j);

  let k = j + 2;
  while (text[k] === " ") k++;
  let url;
  if (text[k] === "<") {
    const end = text.indexOf(">", k);
    if (end === -1 || text.slice(k, end).includes("\n")) return null;
    url = text.slice(k + 1, end);
    k = end + 1;
  } else {
    const from = k;
    let paren = 0;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (ch === "\\" && k + 1 < text.length) k++;
      else if (/\s/.test(ch)) break;
      else if (ch === "(") paren++;
      else if (ch === ")") {
        if (paren === 0) break;
        paren--;
      }
    }
    url = text.slice(from, k).replace(/\\([!-\/:-@\[-`{-~])/g, "$1");
  }

  let title = "";
  const titled = /^[ \t]+(?:"([^"\n]*)"|'([^'\n]*)')[ \t]*/.exec(text.slice(k));
  if (titled) {
    title = titled[1] ?? titled[2] ?? "";
    k += titled[0].length;
  } else {
    while (text[k] === " ") k++;
  }
  if (text[k] !== ")") return null;
  return { label, url, title, end: k + 1 };
}

/**
 * Fermeture d'une emphase ouverte par `size` fois `char`, ou -1.
 *
 * Les emphases ouvertes en chemin sont suivies (`nested`) : dans
 * « *un **mot** encore* », les étoiles doubles s'ouvrent et se ferment entre
 * elles, et seule la dernière étoile ferme l'italique.
 */
function findCloser(text, from, char, size) {
  const nested = [];
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "`") {
      j = skipCode(text, j);
      continue;
    }
    if (ch !== char) continue;
    const run = countRun(text, j, char);
    const before = text[j - 1] ?? "";
    const after = text[j + run] ?? "";
    const closes = j > from && !/\s/.test(before) && (char !== "_" || !after || !RE_WORD.test(after));
    const opens = Boolean(after) && !/\s/.test(after) && (char !== "_" || !before || !RE_WORD.test(before));
    const inner = nested[nested.length - 1];

    if (closes && inner !== undefined) {
      if (run === inner) nested.pop();
      else if (run > inner && nested.length === 1 && run - inner === size) return j + inner;
      else if (opens) nested.push(run);
    } else if (closes && run >= size) {
      // Une suite plus longue ferme d'abord ce qu'elle contient : on en prend la fin.
      return j + run - size;
    } else if (opens) {
      nested.push(run);
    }
    j += run - 1;
  }
  return -1;
}

function matchEmphasis(text, i) {
  const char = text[i];
  const run = countRun(text, i, char);
  const before = text[i - 1] ?? "";
  const after = text[i + run] ?? "";
  if (!after || /\s/.test(after)) return null;
  if (char === "_" && before && RE_WORD.test(before)) return null;
  if (run > 3) return null;

  let sizes;
  if (char === "~") {
    if (run !== 2) return null;
    sizes = [2];
  } else if (run === 3) {
    sizes = [3, 1, 2];
  } else {
    sizes = [run];
  }

  for (const size of sizes) {
    const close = findCloser(text, i + size, char, size);
    if (close === -1) continue;
    const inner = text.slice(i + size, close);
    if (!inner.trim()) continue;
    const kind = char === "~" ? "del" : size === 3 ? "strong-em" : size === 2 ? "strong" : "em";
    return { kind, inner, end: close + size };
  }
  return null;
}

function makeLink(url, title) {
  const a = document.createElement("a");
  // Jamais de `href` : dans une zone éditable, un vrai lien s'ouvrirait au clic
  // molette, et une adresse `javascript:` n'a rien à faire dans la page.
  a.dataset.href = url;
  if (title) a.dataset.title = title;
  return a;
}

function makeImage(alt, src, title, ctx) {
  const img = document.createElement("img");
  img.className = "mde-img";
  img.alt = alt;
  img.dataset.src = src;
  if (title) img.dataset.title = title;
  img.draggable = false;
  ctx?.paintImage?.(img);
  return img;
}

function parseInline(text, parent, ctx, inLink = false) {
  let buffer = "";
  const flush = () => {
    if (buffer) parent.appendChild(document.createTextNode(buffer));
    buffer = "";
  };
  const put = (node) => {
    flush();
    parent.appendChild(node);
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length && RE_ESCAPABLE.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "\n") {
      put(document.createElement("br"));
      i++;
      continue;
    }

    if (ch === "`") {
      const run = countRun(text, i, "`");
      const close = findCodeClose(text, i + run, run);
      if (close !== -1) {
        let body = text.slice(i + run, close).replace(/\n/g, " ");
        if (body.length > 1 && body.startsWith(" ") && body.endsWith(" ") && body.trim()) body = body.slice(1, -1);
        const code = document.createElement("code");
        code.textContent = body;
        put(code);
        i = close + run;
      } else {
        buffer += text.slice(i, i + run);
        i += run;
      }
      continue;
    }

    if (ch === "!" && text[i + 1] === "[") {
      const image = matchLink(text, i + 1);
      if (image && image.url) {
        put(makeImage(image.label, image.url, image.title, ctx));
        i = image.end;
        continue;
      }
    }

    if (ch === "[" && !inLink) {
      const link = matchLink(text, i);
      if (link) {
        const a = makeLink(link.url, link.title);
        parseInline(link.label, a, ctx, true);
        if (!a.firstChild) a.textContent = link.url;
        put(a);
        i = link.end;
        continue;
      }
    }

    if (ch === "<" && !inLink) {
      const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(text.slice(i, i + 2048));
      if (auto) {
        const a = makeLink(auto[1]);
        a.dataset.auto = "angle";
        a.textContent = auto[1];
        put(a);
        i += auto[0].length;
        continue;
      }
    }

    if ((ch === "h" || ch === "H") && !inLink && (i === 0 || /[\s(]/.test(text[i - 1]))) {
      const bare = /^https?:\/\/[^\s<>()]+/i.exec(text.slice(i, i + 2048));
      if (bare) {
        const url = bare[0].replace(/[.,;:!?'"»*_~]+$/, "");
        if (/^https?:\/\/./i.test(url)) {
          const a = makeLink(url);
          a.dataset.auto = "bare";
          a.textContent = url;
          put(a);
          i += url.length;
          continue;
        }
      }
    }

    if (ch === "*" || ch === "_" || ch === "~") {
      const emphasis = matchEmphasis(text, i);
      if (emphasis) {
        let outer;
        let inner;
        if (emphasis.kind === "strong-em") {
          outer = document.createElement("em");
          inner = outer.appendChild(document.createElement("strong"));
        } else {
          outer = inner = document.createElement(emphasis.kind);
        }
        parseInline(emphasis.inner, inner, ctx, inLink);
        put(outer);
        i = emphasis.end;
        continue;
      }
    }

    buffer += ch;
    i++;
  }
  flush();
}

/* ---- Passe « blocs » ----------------------------------------------------- */

function textblock(tag, text, ctx) {
  const el = document.createElement(tag);
  parseInline(text, el, ctx);
  if (!el.firstChild) el.appendChild(document.createElement("br"));
  return el;
}

function makePre(code, lang) {
  const pre = document.createElement("pre");
  if (lang) pre.dataset.lang = lang;
  const inner = pre.appendChild(document.createElement("code"));
  // Le saut final est une sentinelle : sans lui, une dernière ligne vide ne
  // s'affiche pas et le curseur ne peut pas s'y poser. Il n'est jamais écrit.
  inner.textContent = code + "\n";
  return pre;
}

function splitRow(line) {
  const inner = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
  const cells = [];
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && inner[i + 1] === "|") {
      current += "|";
      i++;
    } else if (inner[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += inner[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function alignOf(cell) {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "";
}

function makeCell(tag, text, align, ctx) {
  const cell = textblock(tag, text, ctx);
  if (align) cell.dataset.align = align;
  return cell;
}

/** Un tableau, dans le cadre qui le laisse défiler s'il est trop large. */
function makeTable(header, align, rows, ctx) {
  const width = Math.max(header.length, ...rows.map((row) => row.length), 1);
  const wrap = document.createElement("div");
  wrap.className = "mde-table-wrap";
  const table = wrap.appendChild(document.createElement("table"));
  const headRow = table.appendChild(document.createElement("thead")).appendChild(document.createElement("tr"));
  for (let col = 0; col < width; col++) headRow.appendChild(makeCell("th", header[col] ?? "", align[col], ctx));
  const body = table.appendChild(document.createElement("tbody"));
  for (const row of rows) {
    const tr = body.appendChild(document.createElement("tr"));
    for (let col = 0; col < width; col++) tr.appendChild(makeCell("td", row[col] ?? "", align[col], ctx));
  }
  return wrap;
}

function makeList(marker) {
  const ordered = isOrderedMarker(marker);
  const list = document.createElement(ordered ? "ol" : "ul");
  if (ordered) {
    const start = parseInt(marker, 10);
    if (start !== 1 && Number.isFinite(start)) list.setAttribute("start", String(start));
  }
  return list;
}

function buildList(chunk, ctx) {
  const first = chunk[0].match(RE_LIST);
  const root = makeList(first[2]);
  const stack = [{ indent: indentWidth(first[1]), list: root, item: null }];
  const items = [];

  for (const line of chunk) {
    if (!line.trim()) continue;
    const match = line.match(RE_LIST);
    if (match) {
      const indent = indentWidth(match[1]);
      while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
      let top = stack[stack.length - 1];
      if (indent >= top.indent + 2 && top.item) {
        const sub = makeList(match[2]);
        top.item.el.appendChild(sub);
        top = { indent, list: sub, item: null };
        stack.push(top);
      }
      const item = { el: document.createElement("li"), lines: [match[3]] };
      top.list.appendChild(item.el);
      top.item = item;
      items.push(item);
      continue;
    }
    // Ligne de continuation : elle revient à l'item le plus profond dont elle
    // dépasse le retrait.
    const indent = indentWidth(line.match(/^\s*/)[0]);
    let owner = null;
    for (let s = stack.length - 1; s >= 0 && !owner; s--) {
      if (stack[s].item && (indent > stack[s].indent || s === 0)) owner = stack[s].item;
    }
    owner?.lines.push(line.trim());
  }

  for (const item of items) {
    let text = item.lines.join("\n");
    const task = RE_TASK.exec(text);
    if (task) {
      item.el.className = "mde-task";
      item.el.dataset.checked = task[1] === " " ? "false" : "true";
      text = text.slice(task[0].length);
    }
    const inline = document.createDocumentFragment();
    parseInline(text, inline, ctx);
    if (!inline.firstChild) inline.appendChild(document.createElement("br"));
    item.el.insertBefore(inline, item.el.firstChild);
  }
  return root;
}

/** Rend la liste qui commence à la ligne `i`, et l'index de la ligne suivante. */
function readList(lines, i, ctx) {
  const first = lines[i].match(RE_LIST);
  const base = indentWidth(first[1]);
  const ordered = isOrderedMarker(first[2]);
  const chunk = [];
  let j = i;

  while (j < lines.length) {
    const line = lines[j];
    if (!line.trim()) {
      let next = j + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (next >= lines.length) break;
      const item = lines[next].match(RE_LIST);
      const indent = indentWidth(lines[next].match(/^\s*/)[0]);
      const follows = item
        ? indent > base || (indent === base && isOrderedMarker(item[2]) === ordered)
        : indent > base;
      if (!follows) break;
      while (j < next) chunk.push(lines[j++]);
      continue;
    }
    const item = line.match(RE_LIST);
    const indent = indentWidth(line.match(/^\s*/)[0]);
    if (item) {
      if (indent < base) break;
      // Une liste numérotée qui suit des puces est une autre liste.
      if (indent === base && isOrderedMarker(item[2]) !== ordered) break;
    } else if (indent <= base) {
      break;
    }
    chunk.push(line);
    j++;
  }
  return { el: buildList(chunk, ctx), next: j };
}

/**
 * Découpe des lignes en blocs. Rend [{ el, from, to }], `from`/`to` étant les
 * lignes couvertes — c'est ce qui permet de garder la source de chaque bloc.
 */
function parseBlocks(lines, ctx) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const from = i;

    const fence = line.match(RE_FENCE_OPEN);
    if (fence) {
      const [, indent, mark, info] = fence;
      const close = new RegExp(`^\\s*${mark[0]}{${mark.length},}\\s*$`);
      const strip = new RegExp(`^\\s{0,${indent.length}}`);
      const body = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++].replace(strip, ""));
      if (i < lines.length) i++;
      blocks.push({ el: makePre(body.join("\n"), info.trim()), from, to: i });
      continue;
    }

    const heading = line.match(RE_HEADING);
    if (heading) {
      blocks.push({ el: textblock(`h${heading[1].length}`, heading[2] ?? "", ctx), from, to: ++i });
      continue;
    }

    if (RE_HR.test(line)) {
      blocks.push({ el: document.createElement("hr"), from, to: ++i });
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) inner.push(lines[i++].replace(RE_QUOTE_STRIP, ""));
      const quote = document.createElement("blockquote");
      for (const block of parseBlocks(inner, ctx)) quote.appendChild(block.el);
      if (!quote.firstChild) quote.appendChild(textblock("p", "", ctx));
      blocks.push({ el: quote, from, to: i });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push({ el: makeTable(header, align, rows, ctx), from, to: i });
      continue;
    }

    if (RE_LIST.test(line)) {
      const list = readList(lines, i, ctx);
      i = list.next;
      blocks.push({ el: list.el, from, to: i });
      continue;
    }

    const text = [];
    while (i < lines.length && lines[i].trim() && (i === from || !isBlockStart(lines, i))) text.push(lines[i++].trim());
    blocks.push({ el: textblock("p", text.join("\n"), ctx), from, to: i });
  }
  return blocks;
}

/**
 * Le document entier. Rend { blocks: [{ el, src, gap }], tail } :
 *   src   la source du bloc, telle qu'écrite ;
 *   gap   ce qui le sépare du bloc précédent (ou du début du texte) ;
 *   tail  ce qui suit le dernier bloc.
 * Recoller gap + src de chaque bloc, puis tail, redonne la source à l'identique.
 */
function parseDocument(source, ctx) {
  const text = String(source ?? "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const lineStart = [];
  let offset = 0;
  for (const line of lines) {
    lineStart.push(offset);
    offset += line.length + 1;
  }
  const endOf = (index) => lineStart[index] + lines[index].length;

  const parsed = [];
  let first = 0;

  // En-tête YAML (« front matter ») : gardé tel quel, affiché comme un bloc à
  // part. Le lire comme du markdown en ferait deux filets et un paragraphe.
  if (lines[0] === "---") {
    let end = 1;
    while (end < lines.length && lines[end] !== "---" && lines[end] !== "...") end++;
    if (end < lines.length && end > 1) {
      const pre = makePre(lines.slice(1, end).join("\n"), "");
      pre.classList.add("mde-frontmatter");
      // The label the stylesheet shows in the corner of the block.
      pre.dataset.label = Allkin.t("plugin.markdown-editor.frontmatter");
      parsed.push({ el: pre, from: 0, to: end + 1 });
      first = end + 1;
    }
  }
  for (const block of parseBlocks(lines.slice(first), ctx)) {
    parsed.push({ el: block.el, from: block.from + first, to: block.to + first });
  }

  const blocks = [];
  let cursor = 0;
  for (const block of parsed) {
    const start = lineStart[block.from];
    const end = endOf(block.to - 1);
    blocks.push({ el: block.el, src: text.slice(start, end), gap: text.slice(cursor, start) });
    cursor = end;
  }
  return { blocks, tail: text.slice(cursor), source: text };
}

/* ---- Écriture : DOM -> markdown ------------------------------------------ */

const isList = (node) => node?.nodeType === 1 && (node.tagName === "UL" || node.tagName === "OL");
const MARKS = { STRONG: "**", B: "**", EM: "*", I: "*", DEL: "~~", S: "~~", STRIKE: "~~" };

/** Pose les marqueurs autour du texte, blancs de bord rejetés à l'extérieur :
 *  « **mot ** » n'est pas du gras, « **mot** » suivi d'une espace l'est. */
function wrapMark(marker, inner) {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  if (!match[2]) return inner;
  return match[1] + marker + match[2] + marker + match[3];
}

function codeSpan(text) {
  if (!text) return "";
  const runs = text.match(/`+/g) ?? [];
  let size = 1;
  while (runs.some((run) => run.length === size)) size++;
  const pad = /^`|`$/.test(text) || (/^ .* $/.test(text) && text.trim()) ? " " : "";
  return "`".repeat(size) + pad + text + pad + "`".repeat(size);
}

function destination(url) {
  let out = String(url ?? "").trim().replace(/\s/g, "%20").replace(/[<>]/g, (c) => encodeURIComponent(c));
  let depth = 0;
  let balanced = true;
  for (const ch of out) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) balanced = false;
  }
  if (!balanced || depth !== 0) out = out.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return out;
}

const titleOf = (el) => (el.dataset.title ? ` "${el.dataset.title.replace(/"/g, "'")}"` : "");

/**
 * Un texte ne s'échappe que s'il le faut : celui qui se relirait autrement
 * qu'en texte. « 2 * 3 » ou « mon_fichier » restent donc tels quels dans la
 * source, là où un échappement systématique la couvrirait de contre-obliques.
 */
function escapeText(text, besideMark, force) {
  if (!/[\\`*_~\[\]<]/.test(text)) return text;
  let risky = force || (besideMark && /[*_~`]/.test(text));
  if (!risky) {
    const probe = document.createElement("span");
    parseInline(text, probe, null);
    risky =
      probe.textContent !== text ||
      [...probe.childNodes].some((node) => node.nodeType === 1 && node.tagName !== "BR" && node.dataset.auto !== "bare");
  }
  if (!risky) return text;
  return text.replace(/([\\`*_~\[\]])/g, "\\$1").replace(/<(?=https?:|mailto:)/gi, "\\<");
}

function inlineToMarkdown(parent, force = false) {
  let out = "";
  const nodes = [...parent.childNodes];
  nodes.forEach((node, index) => {
    if (node.nodeType === 3) {
      const text = node.data.replaceAll(ZWSP, "");
      const neighbour = (n) => n?.nodeType === 1 && (MARKS[n.tagName] || n.tagName === "CODE");
      out += escapeText(text, neighbour(nodes[index - 1]) || neighbour(nodes[index + 1]), force);
      return;
    }
    if (node.nodeType !== 1 || node.dataset.mdeSkip !== undefined) return;
    const tag = node.tagName;
    if (tag === "BR") out += "\n";
    else if (MARKS[tag]) out += wrapMark(MARKS[tag], inlineToMarkdown(node, force));
    else if (tag === "CODE") out += codeSpan(node.textContent.replaceAll(ZWSP, ""));
    else if (tag === "A") out += linkToMarkdown(node, force);
    else if (tag === "IMG") out += imageToMarkdown(node);
    else if (isList(node)) return;
    else out += inlineToMarkdown(node, force);
  });
  return out;
}

/**
 * La forme d'un texte : ses caractères, et la mise en forme que porte chacun.
 * Blancs et sauts de ligne sont ignorés — seul compte ce qui est gras, lien,
 * code… Sert à vérifier qu'un texte écrit se relit comme il a été écrit.
 */
function shapeOf(parent, marks = [], out = []) {
  const push = (text) => {
    const key = [...new Set(marks)].sort().join("+");
    const last = out[out.length - 1];
    if (last && last[0] === key) last[1] += text;
    else out.push([key, text]);
  };
  for (const node of parent.childNodes) {
    if (node.nodeType === 3) {
      const text = node.data.replaceAll(ZWSP, "").replace(/\s+/g, "");
      if (text) push(text);
      continue;
    }
    if (node.nodeType !== 1 || node.dataset.mdeSkip !== undefined || isList(node) || node.tagName === "BR") continue;
    const tag = node.tagName;
    if (tag === "IMG") {
      if (node.dataset.src) push(`\u0001${node.dataset.src}\u0001`);
      continue;
    }
    let mark = "";
    if (MARKS[tag]) mark = MARKS[tag];
    else if (tag === "CODE") mark = "`";
    else if (tag === "A" && !(node.dataset.auto === "bare" && node.textContent.replaceAll(ZWSP, "") === node.dataset.href)) mark = `a:${node.dataset.href}`;
    shapeOf(node, mark ? [...marks, mark] : marks, out);
  }
  return out;
}

function linkToMarkdown(a, force) {
  const href = a.dataset.href ?? "";
  const label = inlineToMarkdown(a, force);
  if (!label.trim()) return "";
  if (a.dataset.auto && a.textContent.replaceAll(ZWSP, "") === href) return a.dataset.auto === "angle" ? `<${href}>` : href;
  return wrapOutside(label, (core) => `[${core}](${destination(href)}${titleOf(a)})`);
}

function wrapOutside(text, build) {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  return match[1] + build(match[2]) + match[3];
}

function imageToMarkdown(img) {
  const src = img.dataset.src;
  if (!src) return "";
  const alt = (img.getAttribute("alt") ?? "").replace(/[\[\]]/g, "").replace(/\n/g, " ");
  return `![${alt}](${destination(src)}${titleOf(img)})`;
}

/** Le texte d'un bloc, sans le <br> d'appui qui ferme un bloc vide ou une
 *  dernière ligne. */
function textOf(block) {
  let last = block.lastChild;
  while (last && (isList(last) || (last.nodeType === 3 && !last.data.replaceAll(ZWSP, "")))) last = last.previousSibling;
  const write = (force) => {
    const text = inlineToMarkdown(block, force);
    return last?.nodeName === "BR" ? text.replace(/\n$/, "") : text;
  };
  const text = write(false);
  if (!/[\\`*_~\[\]<]/.test(text)) return text;
  /* Chaque nœud texte a été jugé seul ; or une étoile en début de paragraphe
     peut trouver sa paire trois lignes plus bas. On relit donc le résultat :
     s'il ne redonne pas la même mise en forme, tout est échappé. */
  const probe = document.createElement("span");
  parseInline(text, probe, null);
  return JSON.stringify(shapeOf(probe)) === JSON.stringify(shapeOf(block)) ? text : write(true);
}

/** Protège un début de ligne qui se relirait comme un bloc (titre, liste…). */
function escapeLineStart(line) {
  if (RE_HR.test(line)) return "\\" + line;
  return line
    .replace(/^(\s*)(#{1,6})(?=\s|$)/, "$1\\$2")
    .replace(/^(\s*)([-+*])(?=\s)/, "$1\\$2")
    .replace(/^(\s*)(\d+)([.)])(?=\s)/, "$1$2\\$3")
    .replace(/^(\s*)>/, "$1\\>")
    .replace(/^(\s*)(`{3,}|~{3,})/, "$1\\$2");
}

function listToMarkdown(list) {
  const ordered = list.tagName === "OL";
  const start = parseInt(list.getAttribute("start"), 10);
  let number = ordered && Number.isFinite(start) ? start : 1;
  const lines = [];
  for (const li of list.children) {
    if (li.tagName !== "LI") continue;
    const marker = ordered ? `${number++}. ` : "- ";
    const pad = " ".repeat(marker.length);
    let text = textOf(li);
    if (li.classList.contains("mde-task")) text = (li.dataset.checked === "true" ? "[x] " : "[ ] ") + text;
    else if (RE_TASK.test(text)) text = "\\" + text;
    const [head, ...rest] = text.split("\n");
    lines.push((marker + head).trimEnd() || marker.trim());
    for (const line of rest) if (line.trim()) lines.push(pad + line.trim());
    for (const child of li.children) {
      if (isList(child)) for (const line of listToMarkdown(child).split("\n")) lines.push(pad + line);
    }
  }
  return lines.join("\n");
}

function tableToMarkdown(table) {
  const rows = [...table.rows];
  if (!rows.length) return null;
  const cell = (el) => textOf(el).replace(/\n/g, " ").replace(/\|/g, "\\|").trim();
  const line = (cells) => `| ${cells.join(" | ")} |`;
  const width = Math.max(...rows.map((row) => row.cells.length), 1);
  const cellsOf = (row) => Array.from({ length: width }, (_, col) => (row.cells[col] ? cell(row.cells[col]) : ""));
  const rule = Array.from({ length: width }, (_, col) => {
    const align = rows[0].cells[col]?.dataset.align;
    return align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---";
  });
  return [line(cellsOf(rows[0])), line(rule), ...rows.slice(1).map((row) => line(cellsOf(row)))].join("\n");
}

function preToMarkdown(pre) {
  const code = pre.textContent.replaceAll(ZWSP, "").replace(/\n$/, "");
  if (pre.classList.contains("mde-frontmatter")) return `---\n${code}\n---`;
  let fence = "```";
  while (code.includes(fence)) fence += "`";
  return `${fence}${pre.dataset.lang ?? ""}\n${code}${code ? "\n" : ""}${fence}`;
}

/** Le markdown d'un bloc, ou null s'il n'a rien à écrire (paragraphe vide). */
function blockToMarkdown(el) {
  if (el.nodeType !== 1 || el.dataset.mdeSkip !== undefined) return null;
  const tag = el.tagName;

  if (/^H[1-6]$/.test(tag)) {
    const text = textOf(el).replace(/\s*\n\s*/g, " ").trim();
    return text ? `${"#".repeat(Number(tag[1]))} ${text}` : null;
  }
  if (isList(el)) return listToMarkdown(el) || null;
  if (tag === "HR") return "---";
  if (tag === "PRE") return preToMarkdown(el);
  if (tag === "TABLE") return tableToMarkdown(el);
  if (el.classList.contains("mde-table-wrap")) {
    const table = el.querySelector("table");
    return table ? tableToMarkdown(table) : null;
  }
  if (tag === "BLOCKQUOTE") {
    const inner = blocksToMarkdown([...el.children]);
    if (!inner) return null;
    return inner
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }

  const text = textOf(el);
  if (!text.trim()) return null;
  return text
    .split("\n")
    .map((line) => escapeLineStart(line.trim()))
    .join("\n");
}

function blocksToMarkdown(elements) {
  return elements
    .map(blockToMarkdown)
    .filter((text) => text !== null)
    .join("\n\n");
}

/** Le texte ressemble-t-il à du markdown écrit à la main ? Sert au collage,
 *  pour choisir entre le texte et sa version HTML. */
function looksLikeMarkdown(text) {
  return (
    /^ {0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```|~~~)/m.test(text) ||
    /\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|^\s*\|.*\|\s*$/m.test(text)
  );
}

Object.assign(MDE, {
  ZWSP,
  isList,
  parseDocument,
  parseInline,
  blockToMarkdown,
  blocksToMarkdown,
  inlineToMarkdown,
  makePre,
  makeTable,
  makeImage,
  makeLink,
  looksLikeMarkdown,
});

})();
