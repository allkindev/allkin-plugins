"use strict";
/* ============================================================================
   Éditeur markdown — l'interface : icônes, barre d'outils, bulles et menus.
   ----------------------------------------------------------------------------
   Rien ici ne touche au document : la barre annonce une commande
   (`run("strong")`), l'éditeur l'exécute, puis lui rend l'état du curseur
   (`update(state)`) pour qu'elle allume les bons boutons.

   Bulles et menus sont posés dans <body>, en position fixe : la barre défile
   horizontalement (overflow) et l'éditeur vit parfois dans une modale, tout ce
   qui s'ouvrirait à l'intérieur serait rogné.
   ========================================================================== */
(() => {

const MDE = (window.AllkinMde = window.AllkinMde || {});

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const MOD = IS_MAC ? "⌘" : Allkin.t("plugin.markdown-editor.key.ctrl");
const ALT = Allkin.t("plugin.markdown-editor.key.alt");
const keys = (...parts) => parts.join(IS_MAC ? "" : "+");

/* Tracés 24×24, trait de 2, sans fond : ils prennent la couleur du texte. */
const ICONS = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  strong: '<path d="M7 5h6a3.5 3.5 0 010 7H7z"/><path d="M7 12h7a3.5 3.5 0 010 7H7z"/>',
  em: '<path d="M19 4h-9M14 20H5M15 4L9 20"/>',
  del: '<path d="M16 5H9.5a3 3 0 00-2.6 4.5"/><path d="M14 12a4 4 0 010 7.5H6.5"/><path d="M4 12h16"/>',
  code: '<path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>',
  link: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  unlink: '<path d="M18.8 13.2l1.7-1.7a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M5.2 10.8l-1.7 1.7a5 5 0 007.07 7.07l1.71-1.71"/><path d="M3 3l18 18"/>',
  ul: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  ol: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 10V5L3 6"/><path d="M3 14.5c.5-.7 2.5-.8 2.5.6 0 1.2-2.5 1.9-2.5 3.4H5.5"/>',
  task: '<path d="M3 6.5l1.5 1.5L8 4.5"/><path d="M3 16.5l1.5 1.5L8 14.5"/><path d="M12 6.5h9M12 16.5h9"/>',
  quote: '<path d="M4 5v14"/><path d="M9 7h11M9 12h11M9 17h7"/>',
  pre: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M10 9.5L7.5 12l2.5 2.5M14 9.5l2.5 2.5-2.5 2.5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  hr: '<path d="M4 12h16"/><path d="M8 6h8M8 18h8" opacity=".35"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-4.3-4.3a2 2 0 00-2.8 0L7 19"/>',
  file: '<path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.4 3.4 0 014.8 4.8l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9"/>',
  source: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 15V9l3 3 3-3v6"/><path d="M16 9v6m0 0l-2-2m2 2l2-2"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12"/><path d="M9 7V4h6v3"/>',
  open: '<path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  text: '<path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  upload: '<path d="M12 16V4m0 0L8 8m4-4l4 4"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
  rowAdd: '<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M12 15.5v5M9.5 18h5"/>',
  colAdd: '<rect x="4" y="3" width="8" height="18" rx="2"/><path d="M15.5 12h5M18 9.5v5"/>',
  rowDel: '<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M9.5 18h5"/>',
  colDel: '<rect x="4" y="3" width="8" height="18" rx="2"/><path d="M15.5 12h5"/>',
  rowAddAbove: '<rect x="3" y="12" width="18" height="8" rx="2"/><path d="M12 3.5v5M9.5 6h5"/>',
  colAddLeft: '<rect x="12" y="3" width="8" height="18" rx="2"/><path d="M3.5 12h5M6 9.5v5"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  alignLeft: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  alignCenter: '<path d="M4 6h16M7 12h10M5.5 18h13"/>',
  alignRight: '<path d="M4 6h16M10 12h10M7 18h13"/>',
};

function icon(name) {
  // Une constante de ce fichier, jamais du texte reçu : innerHTML est sans risque.
  return `<svg class="mde-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

/** Un bouton de l'éditeur. Le clic ne doit jamais prendre le focus : c'est le
 *  texte sélectionné qui reçoit la commande, il ne faut pas le perdre. */
function button({ icon: name, label, tip, shortcut, className, text }) {
  const btn = make("button", `mde-btn${className ? ` ${className}` : ""}`);
  btn.type = "button";
  if (name) btn.innerHTML = icon(name);
  if (text) btn.appendChild(make("span", "mde-btn-text", text));
  btn.setAttribute("aria-label", label ?? tip ?? text ?? "");
  if (tip ?? label) btn.dataset.tip = tip ?? label;
  if (shortcut) btn.dataset.keys = shortcut;
  btn.addEventListener("mousedown", (event) => event.preventDefault());
  return btn;
}

/* ---- Infobulle ----------------------------------------------------------- */

let tipEl = null;
let tipTimer = null;

function hideTip() {
  clearTimeout(tipTimer);
  tipEl?.remove();
  tipEl = null;
}

function showTip(target) {
  hideTip();
  if (!target.isConnected || !target.dataset.tip) return;
  tipEl = make("div", "mde-tip");
  tipEl.appendChild(make("span", null, target.dataset.tip));
  if (target.dataset.keys) tipEl.appendChild(make("kbd", null, target.dataset.keys));
  document.body.appendChild(tipEl);
  place(tipEl, target.getBoundingClientRect(), "center", 8);
}

function bindTips(container) {
  const over = (event) => {
    const target = event.target.closest?.("[data-tip]");
    if (!target || !container.contains(target) || event.pointerType === "touch") return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(target), 450);
  };
  container.addEventListener("pointerover", over);
  container.addEventListener("pointerout", hideTip);
  container.addEventListener("pointerdown", hideTip);
  return () => {
    container.removeEventListener("pointerover", over);
    container.removeEventListener("pointerout", hideTip);
    container.removeEventListener("pointerdown", hideTip);
    hideTip();
  };
}

/* ---- Bulles -------------------------------------------------------------- */

function place(el, rect, align = "start", gap = 6) {
  const margin = 8;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let left = align === "end" ? rect.right - width : align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.left;
  let top = rect.bottom + gap;
  if (top + height > window.innerHeight - margin && rect.top - gap - height >= margin) top = rect.top - gap - height;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

const openPopovers = new Set();

/**
 * Ouvre une bulle ancrée à un élément ou à un rectangle.
 *   anchor   élément, DOMRect, ou fonction qui rend l'un des deux ;
 *   build    (el, close) => void : remplit la bulle ;
 *   owner    élément dont un clic ne ferme pas la bulle (le bouton qui l'ouvre).
 */
function popover({ anchor, build, className, align = "start", owner, onClose }) {
  const el = make("div", `mde-pop${className ? ` ${className}` : ""}`);
  let closed = false;

  const rectOf = () => {
    const target = typeof anchor === "function" ? anchor() : anchor;
    if (!target) return null;
    if (target instanceof Element) return target.isConnected ? target.getBoundingClientRect() : null;
    return target;
  };
  const reposition = () => {
    const rect = rectOf();
    if (!rect) return close();
    place(el, rect, align);
  };

  function close() {
    if (closed) return;
    closed = true;
    openPopovers.delete(handle);
    document.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    el.remove();
    onClose?.();
  }
  const onPointerDown = (event) => {
    if (el.contains(event.target) || owner?.contains(event.target)) return;
    close();
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    // Arrêtée ici : sinon la modale qui héberge l'éditeur se fermerait avec.
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  const handle = { el, close, reposition, contains: (node) => el.contains(node) };
  build(el, close);
  document.body.appendChild(el);
  reposition();
  if (closed) return handle;
  openPopovers.add(handle);
  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  return handle;
}

const closeAllPopovers = () => [...openPopovers].forEach((pop) => pop.close());
const focusInPopover = () => [...openPopovers].some((pop) => pop.contains(document.activeElement));

/* ---- Menu ---------------------------------------------------------------- */

const fold = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Une liste d'entrées à choisir. `keyboard: false` la laisse sans focus — le
 * menu « / » est piloté par l'éditeur, le curseur reste dans le texte.
 * Entrée : { id, label, hint?, icon?, sample?, active?, words? }.
 */
function menu({ anchor, items, onPick, owner, align, className, onClose, title }) {
  let shown = items;
  let index = Math.max(0, items.findIndex((item) => item.active));
  let listEl;

  const paint = () => {
    listEl.replaceChildren();
    if (!shown.length) {
      listEl.appendChild(make("div", "mde-menu-empty", Allkin.t("plugin.markdown-editor.menu.empty")));
      return;
    }
    shown.forEach((item, i) => {
      if (i > 0 && item.group !== shown[i - 1].group) listEl.appendChild(make("div", "mde-menu-rule"));
      const row = make("button", `mde-menu-item${i === index ? " is-current" : ""}${item.active ? " is-active" : ""}${item.danger ? " is-danger" : ""}`);
      row.type = "button";
      row.setAttribute("role", "option");
      const glyph = make("span", "mde-menu-glyph");
      if (item.icon) glyph.innerHTML = icon(item.icon);
      else glyph.textContent = item.sample ?? "";
      const text = make("span", "mde-menu-text");
      text.appendChild(make("span", "mde-menu-label", item.label));
      if (item.hint) text.appendChild(make("span", "mde-menu-hint", item.hint));
      row.append(glyph, text);
      if (item.keys) row.appendChild(make("kbd", "mde-menu-keys", item.keys));
      row.addEventListener("mousedown", (event) => event.preventDefault());
      row.addEventListener("mousemove", () => {
        if (index === i) return;
        index = i;
        paint();
      });
      row.addEventListener("click", () => pick(i));
      listEl.appendChild(row);
    });
    listEl.querySelector(".is-current")?.scrollIntoView({ block: "nearest" });
  };

  const pick = (i = index) => {
    const item = shown[i];
    if (!item) return false;
    pop.close();
    onPick(item);
    return true;
  };

  const pop = popover({
    anchor,
    owner,
    align,
    onClose,
    className: `mde-menu${className ? ` ${className}` : ""}`,
    build: (el) => {
      if (title) el.appendChild(make("div", "mde-menu-title", title));
      listEl = el.appendChild(make("div", "mde-menu-list"));
      listEl.setAttribute("role", "listbox");
      paint();
    },
  });

  return {
    close: pop.close,
    reposition: pop.reposition,
    pick,
    get empty() {
      return shown.length === 0;
    },
    move(delta) {
      if (!shown.length) return;
      index = (index + delta + shown.length) % shown.length;
      paint();
    },
    filter(query) {
      const q = fold(query);
      shown = q ? items.filter((item) => fold(`${item.label} ${item.words ?? ""}`).includes(q)) : items;
      index = 0;
      paint();
      pop.reposition();
    },
  };
}

/* ---- Barre d'outils ------------------------------------------------------ */

const BLOCK_LABELS = {
  p: Allkin.t("plugin.markdown-editor.block.text"),
  h1: Allkin.t("plugin.markdown-editor.block.heading", { level: 1 }),
  h2: Allkin.t("plugin.markdown-editor.block.heading", { level: 2 }),
  h3: Allkin.t("plugin.markdown-editor.block.heading", { level: 3 }),
  h4: Allkin.t("plugin.markdown-editor.block.heading", { level: 4 }),
  h5: Allkin.t("plugin.markdown-editor.block.heading", { level: 5 }),
  h6: Allkin.t("plugin.markdown-editor.block.heading", { level: 6 }),
  ul: Allkin.t("plugin.markdown-editor.block.list"),
  ol: Allkin.t("plugin.markdown-editor.block.ol"),
  task: Allkin.t("plugin.markdown-editor.block.task"),
  quote: Allkin.t("plugin.markdown-editor.block.quote"),
  pre: Allkin.t("plugin.markdown-editor.block.pre"),
  table: Allkin.t("plugin.markdown-editor.block.table"),
};

const BLOCK_CHOICES = [
  { id: "p", label: Allkin.t("plugin.markdown-editor.block.text"), sample: "T", hint: Allkin.t("plugin.markdown-editor.hint.text"), keys: keys(MOD, ALT, "0") },
  { id: "h1", label: Allkin.t("plugin.markdown-editor.block.heading", { level: 1 }), sample: "H1", hint: Allkin.t("plugin.markdown-editor.hint.h1"), keys: keys(MOD, ALT, "1") },
  { id: "h2", label: Allkin.t("plugin.markdown-editor.block.heading", { level: 2 }), sample: "H2", hint: Allkin.t("plugin.markdown-editor.hint.h2"), keys: keys(MOD, ALT, "2") },
  { id: "h3", label: Allkin.t("plugin.markdown-editor.block.heading", { level: 3 }), sample: "H3", hint: Allkin.t("plugin.markdown-editor.hint.h3"), keys: keys(MOD, ALT, "3") },
];

/** Les blocs du menu « / » — et, pour moitié, ceux de la barre. */
const INSERT_CHOICES = [
  { id: "p", label: Allkin.t("plugin.markdown-editor.block.text"), icon: "text", hint: Allkin.t("plugin.markdown-editor.hint.text"), words: Allkin.t("plugin.markdown-editor.words.text") },
  { id: "h1", label: Allkin.t("plugin.markdown-editor.block.heading", { level: 1 }), sample: "H1", hint: Allkin.t("plugin.markdown-editor.hint.h1"), words: Allkin.t("plugin.markdown-editor.words.heading") },
  { id: "h2", label: Allkin.t("plugin.markdown-editor.block.heading", { level: 2 }), sample: "H2", hint: Allkin.t("plugin.markdown-editor.hint.h2"), words: Allkin.t("plugin.markdown-editor.words.heading") },
  { id: "h3", label: Allkin.t("plugin.markdown-editor.block.heading", { level: 3 }), sample: "H3", hint: Allkin.t("plugin.markdown-editor.hint.h3"), words: Allkin.t("plugin.markdown-editor.words.heading") },
  { id: "ul", label: Allkin.t("plugin.markdown-editor.block.ul"), icon: "ul", hint: Allkin.t("plugin.markdown-editor.hint.ul"), words: Allkin.t("plugin.markdown-editor.words.ul") },
  { id: "ol", label: Allkin.t("plugin.markdown-editor.block.ol"), icon: "ol", hint: Allkin.t("plugin.markdown-editor.hint.ol"), words: Allkin.t("plugin.markdown-editor.words.ol") },
  { id: "task", label: Allkin.t("plugin.markdown-editor.block.task"), icon: "task", hint: Allkin.t("plugin.markdown-editor.hint.task"), words: Allkin.t("plugin.markdown-editor.words.task") },
  { id: "quote", label: Allkin.t("plugin.markdown-editor.block.quote"), icon: "quote", hint: Allkin.t("plugin.markdown-editor.hint.quote"), words: Allkin.t("plugin.markdown-editor.words.quote") },
  { id: "pre", label: Allkin.t("plugin.markdown-editor.block.pre"), icon: "pre", hint: Allkin.t("plugin.markdown-editor.hint.pre"), words: Allkin.t("plugin.markdown-editor.words.pre") },
  { id: "table", label: Allkin.t("plugin.markdown-editor.block.table"), icon: "table", hint: Allkin.t("plugin.markdown-editor.hint.table"), words: Allkin.t("plugin.markdown-editor.words.table") },
  { id: "hr", label: Allkin.t("plugin.markdown-editor.block.hr"), icon: "hr", hint: Allkin.t("plugin.markdown-editor.hint.hr"), words: Allkin.t("plugin.markdown-editor.words.hr") },
  { id: "image", label: Allkin.t("plugin.markdown-editor.block.image"), icon: "image", hint: Allkin.t("plugin.markdown-editor.hint.image"), words: Allkin.t("plugin.markdown-editor.words.image") },
  { id: "file", label: Allkin.t("plugin.markdown-editor.block.file"), icon: "file", hint: Allkin.t("plugin.markdown-editor.hint.file"), words: Allkin.t("plugin.markdown-editor.words.file") },
  { id: "link", label: Allkin.t("plugin.markdown-editor.block.link"), icon: "link", hint: Allkin.t("plugin.markdown-editor.hint.link"), words: Allkin.t("plugin.markdown-editor.words.link") },
];

/* Quand la barre manque de place, ses outils se replient dans le menu « ⋯ »,
   des moins courants aux plus courants. Ce qui reste visible en dernier : le
   style du bloc, gras, italique, lien — et le markdown brut, toujours. */
const COLLAPSE_ORDER = [["blocks", "media"], ["lists"], ["history"], ["marks-more"]];

const MORE_ITEMS = [
  { id: "undo", group: "history", label: Allkin.t("plugin.markdown-editor.toolbar.undo"), icon: "undo" },
  { id: "redo", group: "history", label: Allkin.t("plugin.markdown-editor.toolbar.redo"), icon: "redo" },
  { id: "del", group: "marks-more", label: Allkin.t("plugin.markdown-editor.toolbar.del"), icon: "del" },
  { id: "code", group: "marks-more", label: Allkin.t("plugin.markdown-editor.toolbar.code"), icon: "code" },
  { id: "ul", group: "lists", label: Allkin.t("plugin.markdown-editor.block.ul"), icon: "ul" },
  { id: "ol", group: "lists", label: Allkin.t("plugin.markdown-editor.block.ol"), icon: "ol" },
  { id: "task", group: "lists", label: Allkin.t("plugin.markdown-editor.block.task"), icon: "task" },
  { id: "quote", group: "blocks", label: Allkin.t("plugin.markdown-editor.block.quote"), icon: "quote" },
  { id: "pre", group: "blocks", label: Allkin.t("plugin.markdown-editor.block.pre"), icon: "pre" },
  { id: "table", group: "blocks", label: Allkin.t("plugin.markdown-editor.block.table"), icon: "table" },
  { id: "hr", group: "blocks", label: Allkin.t("plugin.markdown-editor.block.hr"), icon: "hr" },
  { id: "image", group: "media", label: Allkin.t("plugin.markdown-editor.block.image"), icon: "image" },
  { id: "file", group: "media", label: Allkin.t("plugin.markdown-editor.toolbar.attachFile"), icon: "file" },
];

/**
 * Peuple la barre d'outils.
 *   run(id, arg)   exécute une commande ;
 *   withFiles      l'éditeur sait-il recevoir des fichiers (bouton trombone).
 * Rend { update(state), anchorFor(id), destroy() }.
 */
function buildToolbar(container, { run, withFiles }) {
  container.replaceChildren();
  container.classList.add("mde-toolbar");
  container.setAttribute("role", "toolbar");
  container.setAttribute("aria-label", Allkin.t("plugin.markdown-editor.toolbar.label"));
  const buttons = new Map();
  let blockMenu = null;
  let tableMenu = null;
  let moreMenu = null;
  let collapsed = new Set();
  let lastState = {};
  let group = "";

  const put = (el) => {
    if (group) el.dataset.group = group;
    container.appendChild(el);
    return el;
  };
  /** Ouvre un groupe : le filet qui le précède se replie avec lui. */
  const open = (name) => {
    group = name;
    put(make("span", "mde-sep"));
  };
  const add = (id, options) => {
    const btn = button(options);
    btn.dataset.cmd = id;
    btn.addEventListener("click", () => run(id));
    buttons.set(id, btn);
    return put(btn);
  };
  const shift = IS_MAC ? "⇧" : Allkin.t("plugin.markdown-editor.key.shift");

  group = "history";
  add("undo", { icon: "undo", tip: Allkin.t("plugin.markdown-editor.toolbar.undo"), shortcut: keys(MOD, "Z") });
  add("redo", { icon: "redo", tip: Allkin.t("plugin.markdown-editor.toolbar.redo"), shortcut: keys(MOD, shift, "Z") });

  // Le style du bloc : un seul bouton qui dit où l'on est, plutôt que trois
  // « H1 H2 H3 » dont aucun ne dit qu'on est dans du texte courant.
  open("history");
  group = "";
  const block = put(button({ className: "mde-select", tip: Allkin.t("plugin.markdown-editor.toolbar.blockStyle"), text: Allkin.t("plugin.markdown-editor.block.text") }));
  block.insertAdjacentHTML("beforeend", icon("chevron"));
  block.setAttribute("aria-haspopup", "listbox");
  const blockLabel = block.querySelector(".mde-btn-text");
  block.addEventListener("click", () => {
    if (blockMenu) return blockMenu.close();
    const current = block.dataset.block;
    blockMenu = menu({
      anchor: block,
      owner: block,
      className: "mde-menu-blocks",
      items: BLOCK_CHOICES.map((item) => ({ ...item, active: item.id === current })),
      onPick: (item) => run("block", item.id),
      onClose: () => {
        blockMenu = null;
        block.classList.remove("is-open");
      },
    });
    block.classList.add("is-open");
  });
  buttons.set("block", block);

  put(make("span", "mde-sep"));
  add("strong", { icon: "strong", tip: Allkin.t("plugin.markdown-editor.toolbar.strong"), shortcut: keys(MOD, "B") });
  add("em", { icon: "em", tip: Allkin.t("plugin.markdown-editor.toolbar.em"), shortcut: keys(MOD, "I") });
  group = "marks-more";
  add("del", { icon: "del", tip: Allkin.t("plugin.markdown-editor.toolbar.del"), shortcut: keys(MOD, shift, "X") });
  add("code", { icon: "code", tip: Allkin.t("plugin.markdown-editor.toolbar.code"), shortcut: keys(MOD, "E") });
  group = "";
  add("link", { icon: "link", tip: Allkin.t("plugin.markdown-editor.block.link"), shortcut: keys(MOD, "K") });

  open("lists");
  add("ul", { icon: "ul", tip: Allkin.t("plugin.markdown-editor.block.ul") });
  add("ol", { icon: "ol", tip: Allkin.t("plugin.markdown-editor.block.ol") });
  add("task", { icon: "task", tip: Allkin.t("plugin.markdown-editor.block.task") });

  open("blocks");
  add("quote", { icon: "quote", tip: Allkin.t("plugin.markdown-editor.block.quote") });
  add("pre", { icon: "pre", tip: Allkin.t("plugin.markdown-editor.block.pre") });
  const table = put(button({ icon: "table", tip: Allkin.t("plugin.markdown-editor.block.table") }));
  table.dataset.cmd = "table";
  table.setAttribute("aria-haspopup", "dialog");
  table.addEventListener("click", () => {
    if (tableMenu) return tableMenu.close();
    tableMenu = tablePicker({
      anchor: table,
      onPick: (rows, cols) => run("table", { rows, cols }),
      onClose: () => {
        tableMenu = null;
        table.classList.remove("is-open");
      },
    });
    table.classList.add("is-open");
  });
  buttons.set("table", table);
  add("hr", { icon: "hr", tip: Allkin.t("plugin.markdown-editor.block.hr") });

  open("media");
  add("image", { icon: "image", tip: Allkin.t("plugin.markdown-editor.block.image") });
  if (withFiles) add("file", { icon: "file", tip: Allkin.t("plugin.markdown-editor.toolbar.attachFile") });

  group = "";
  put(make("span", "mde-sep")).dataset.group = "more";
  const more = put(button({ icon: "more", tip: Allkin.t("plugin.markdown-editor.toolbar.more") }));
  more.dataset.group = "more";
  more.setAttribute("aria-haspopup", "menu");
  more.addEventListener("click", () => {
    if (moreMenu) return moreMenu.close();
    moreMenu = menu({
      anchor: more,
      owner: more,
      align: "end",
      className: "mde-menu-compact",
      items: MORE_ITEMS.filter((item) => collapsed.has(item.group) && buttons.has(item.id) && !buttons.get(item.id).disabled).map((item) => ({
        ...item,
        active: Boolean(lastState.marks?.has(item.id)) || lastState.block === item.id,
      })),
      onPick: (item) => run(item.id),
      onClose: () => {
        moreMenu = null;
        more.classList.remove("is-open");
      },
    });
    more.classList.add("is-open");
  });

  put(make("span", "mde-spacer"));
  add("source", { icon: "source", tip: Allkin.t("plugin.markdown-editor.toolbar.source"), className: "mde-btn-source" });

  function collapse(level) {
    collapsed = new Set(COLLAPSE_ORDER.slice(0, level).flat());
    for (const el of container.children) {
      if (el.dataset.group === "more") el.hidden = level === 0;
      else if (el.dataset.group) el.hidden = collapsed.has(el.dataset.group);
    }
    // Dernier recours, sur un téléphone : on resserre ce qui reste.
    container.classList.toggle("is-tight", level > COLLAPSE_ORDER.length);
  }
  function fit() {
    if (!container.clientWidth) return;
    let level = 0;
    collapse(level);
    while (level <= COLLAPSE_ORDER.length && container.scrollWidth > container.clientWidth + 1) collapse(++level);
  }
  let fitQueued = false;
  const resize = new ResizeObserver(() => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      if (container.isConnected) fit();
    });
  });
  resize.observe(container);
  fit();

  const unbindTips = bindTips(container);

  // En mode brut, la mise en forme n'a plus de prise : seul le bouton qui en
  // fait sortir reste actif.
  return {
    /** Le bouton d'une commande — ou « ⋯ » s'il est replié dedans. */
    anchorFor: (id) => {
      const btn = buttons.get(id);
      return btn && !btn.hidden ? btn : more.hidden ? container : more;
    },
    update(state) {
      lastState = state;
      for (const [id, btn] of buttons) {
        const on =
          (state.marks?.has(id) ?? false) ||
          (id === "link" && state.link) ||
          (id === "source" && state.source) ||
          (id === state.block && id !== "block");
        btn.classList.toggle("is-on", Boolean(on));
        btn.setAttribute("aria-pressed", String(Boolean(on)));
        let disabled = state.source && id !== "source";
        if (id === "undo") disabled ||= !state.canUndo;
        if (id === "redo") disabled ||= !state.canRedo;
        if (state.inCode && ["strong", "em", "del", "code", "link", "image", "table"].includes(id)) disabled = true;
        btn.disabled = Boolean(disabled);
      }
      more.disabled = Boolean(state.source);
      const kind = state.block ?? "p";
      block.dataset.block = kind;
      blockLabel.textContent = BLOCK_LABELS[kind] ?? Allkin.t("plugin.markdown-editor.block.text");
    },
    destroy() {
      resize.disconnect();
      blockMenu?.close();
      tableMenu?.close();
      moreMenu?.close();
      unbindTips();
      container.classList.remove("mde-toolbar", "is-tight");
      container.removeAttribute("role");
      container.removeAttribute("aria-label");
      container.replaceChildren();
    },
  };
}

/** La grille où l'on choisit la taille du tableau en la survolant. */
function tablePicker({ anchor, onPick, onClose }) {
  const SIZE = 6;
  // One whole sentence per case: the number of rows picks the key, the number
  // of columns picks the plural form.
  const sizeText = (rows, cols) =>
    rows === 1
      ? Allkin.tn("plugin.markdown-editor.table.sizeOneRow", cols, { rows })
      : Allkin.tn("plugin.markdown-editor.table.sizeRows", cols, { rows });
  const cellText = (rows, cols) =>
    rows === 1
      ? Allkin.tn("plugin.markdown-editor.table.cellOneRow", cols, { rows })
      : Allkin.tn("plugin.markdown-editor.table.cellRows", cols, { rows });
  return popover({
    anchor,
    owner: anchor,
    onClose,
    className: "mde-grid-pop",
    build: (el, close) => {
      const label = make("div", "mde-grid-label", Allkin.t("plugin.markdown-editor.block.table"));
      const grid = make("div", "mde-grid");
      const cells = [];
      const light = (rows, cols) => {
        cells.forEach((cell) => cell.classList.toggle("is-lit", cell.row <= rows && cell.col <= cols));
        label.textContent = rows ? sizeText(rows, cols) : Allkin.t("plugin.markdown-editor.block.table");
      };
      for (let row = 1; row <= SIZE; row++) {
        for (let col = 1; col <= SIZE; col++) {
          const cell = make("button", "mde-grid-cell");
          cell.type = "button";
          cell.row = row;
          cell.col = col;
          cell.setAttribute("aria-label", cellText(row, col));
          cell.addEventListener("mousedown", (event) => event.preventDefault());
          cell.addEventListener("pointerenter", () => light(row, col));
          cell.addEventListener("focus", () => light(row, col));
          cell.addEventListener("click", () => {
            close();
            onPick(row, col);
          });
          cells.push(cell);
          grid.appendChild(cell);
        }
      }
      grid.addEventListener("pointerleave", () => light(0, 0));
      el.append(grid, label);
    },
  });
}

/* ---- Formulaires de bulle ------------------------------------------------ */

function field(labelText, { value = "", placeholder = "", type = "text" } = {}) {
  const wrap = make("label", "mde-field");
  wrap.appendChild(make("span", "mde-field-label", labelText));
  const input = wrap.appendChild(make("input", "mde-input"));
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  return { wrap, input };
}

function action(label, { primary = false, icon: name, danger = false } = {}) {
  const btn = make("button", `mde-action${primary ? " is-primary" : ""}${danger ? " is-danger" : ""}`);
  btn.type = "button";
  if (name) btn.innerHTML = icon(name);
  btn.appendChild(make("span", null, label));
  return btn;
}

/** Soumet un formulaire de bulle à Entrée, depuis n'importe lequel de ses champs. */
function submitOnEnter(el, submit) {
  el.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.target.tagName !== "INPUT") return;
    event.preventDefault();
    submit();
  });
}

Object.assign(MDE, {
  IS_MAC,
  icon,
  make,
  button,
  popover,
  menu,
  buildToolbar,
  bindTips,
  field,
  action,
  submitOnEnter,
  closeAllPopovers,
  focusInPopover,
  fold,
  INSERT_CHOICES,
});

})();
