"use strict";
/* ============================================================================
   Plugin « Éditeur de texte » — l'onglet fichier d'Allkin.
   ----------------------------------------------------------------------------
   Déclare la nature d'onglet « file » (un fichier du data/ d'un agent) et les
   capacités :

     Allkin.capability("text-editor").openFile(agentId, path, name)
     Allkin.capability("text-editor").canOpen(name)
     Allkin.capability("code-highlight").highlight(text, language) -> HTML
     Allkin.capability("code-highlight").languageForFilename(name)

   Le markdown passe par le plugin « Éditeur markdown » quand il est là. Tout
   le reste du texte s'ouvre dans l'ÉDITEUR DE CODE : numéros de ligne,
   coloration highlight.js (hljs.js, 80 langages, bundle construit depuis
   node_modules — voir scripts/hljs-entry.mjs), langage détecté par le nom du
   fichier ou son contenu, et corrigeable à la main ; recherche/remplacement,
   aller à la ligne, commentaires, indentation, retour à la ligne, taille de
   police, enregistrement au fil de la frappe.
   ========================================================================== */
(() => {
const {
  activeTab,
  applyScroll,
  copyToClipboard,
  dataFileUrl,
  el,
  openTab,
  persistTabs,
  renderTabBar,
  returnToActiveTab,
  state,
} = window.Allkin.core;
const core = window.Allkin.core;
const hljs = window.AllkinHljs ?? null;
const bulle = (message, kind = "ok") => core.toast?.(message, kind);

/* ---- Langages -------------------------------------------------------------
   Les noms sont ceux de highlight.js ; les libellés, ceux qu'on lit dans le
   sélecteur. Un langage du bundle sans libellé ici prend celui de hljs. */
const LANG_LABELS = {
  javascript: "JavaScript", typescript: "TypeScript", json: "JSON", css: "CSS", scss: "SCSS", less: "Less",
  xml: "HTML / XML", markdown: "Markdown", yaml: "YAML", bash: "Shell (bash)", shell: "Session shell",
  python: "Python", php: "PHP", "php-template": "PHP (gabarit)", ini: "INI / TOML", sql: "SQL", pgsql: "PostgreSQL",
  c: "C", cpp: "C++", csharp: "C#", java: "Java", kotlin: "Kotlin", swift: "Swift", go: "Go", rust: "Rust",
  ruby: "Ruby", perl: "Perl", lua: "Lua", dart: "Dart", scala: "Scala", haskell: "Haskell", elixir: "Elixir",
  erlang: "Erlang", r: "R", julia: "Julia", matlab: "MATLAB", powershell: "PowerShell", dockerfile: "Dockerfile",
  nginx: "Nginx", apache: "Apache", makefile: "Makefile", cmake: "CMake", diff: "Diff / patch", http: "HTTP",
  protobuf: "Protocol Buffers", latex: "LaTeX", vim: "Vim script", plaintext: "Texte brut", properties: "Properties",
  objectivec: "Objective-C", groovy: "Groovy", gradle: "Gradle", awk: "AWK", vbscript: "VBScript", x86asm: "Assembleur x86",
  arduino: "Arduino", django: "Django", handlebars: "Handlebars", twig: "Twig", coffeescript: "CoffeeScript",
  clojure: "Clojure", lisp: "Lisp", scheme: "Scheme", ocaml: "OCaml", fsharp: "F#", elm: "Elm", crystal: "Crystal",
  nim: "Nim", d: "D", fortran: "Fortran", basic: "BASIC", vbnet: "VB.NET", delphi: "Delphi / Pascal", prolog: "Prolog",
  haxe: "Haxe", tcl: "Tcl", smalltalk: "Smalltalk", dns: "Zone DNS", ldif: "LDIF", accesslog: "Journal d'accès",
};

/* Noms de fichiers sans extension parlante. */
const NAME_LANGUAGE = {
  dockerfile: "dockerfile", containerfile: "dockerfile", makefile: "makefile", gnumakefile: "makefile",
  "cmakelists.txt": "cmake", ".env": "bash", ".bashrc": "bash", ".zshrc": "bash", ".profile": "bash",
  ".bash_profile": "bash", "nginx.conf": "nginx", ".htaccess": "apache", ".gitignore": "plaintext",
  ".gitconfig": "ini", ".editorconfig": "ini", ".npmrc": "ini", "gemfile": "ruby", "rakefile": "ruby",
  "vagrantfile": "ruby", "jenkinsfile": "groovy", "caddyfile": "plaintext", "readme": "markdown", "license": "plaintext",
};

/** Le nom canonique d'un langage ou d'un alias (« rs » → « rust »), ou null. */
function canonicalLanguage(alias) {
  if (!hljs || !alias) return null;
  const def = hljs.getLanguage(String(alias).toLowerCase());
  if (!def) return null;
  return hljs.listLanguages().find((id) => hljs.getLanguage(id) === def) ?? null;
}

function langLabel(id) {
  return LANG_LABELS[id] ?? hljs?.getLanguage(id)?.name ?? id;
}

let languagesCache = null;
function allLanguages() {
  if (!hljs) return [];
  languagesCache ??= hljs
    .listLanguages()
    .filter((id) => id !== "plaintext")
    .map((id) => ({ id, label: langLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return languagesCache;
}

/** Langage déduit du NOM du fichier, ou null. */
function languageForFilename(filename) {
  const name = String(filename ?? "").split("/").pop().toLowerCase();
  if (NAME_LANGUAGE[name]) return NAME_LANGUAGE[name];
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (!ext) return null;
  return canonicalLanguage(ext);
}

/** Langage deviné au CONTENU, quand le nom ne dit rien. Prudent : en dessous
 *  d'une certaine confiance, mieux vaut du texte brut qu'une coloration fausse. */
const SHEBANG = [
  [/python/, "python"], [/\b(?:bash|sh|zsh|ksh|dash)\b/, "bash"], [/\bnode\b|\bdeno\b|\bbun\b/, "javascript"],
  [/\bruby\b/, "ruby"], [/\bperl\b/, "perl"], [/\bphp\b/, "php"], [/\blua\b/, "lua"], [/\bpwsh|powershell\b/, "powershell"],
  [/\bRscript\b/, "r"], [/\bjulia\b/, "julia"], [/\bawk\b/, "awk"], [/\btclsh|wish\b/, "tcl"], [/\belixir\b/, "elixir"],
];

function guessLanguage(text) {
  if (!hljs || !text.trim()) return null;
  // Un shebang dit tout : « #!/usr/bin/env python3 » vaut une extension.
  const first = text.slice(0, 200).split("\n")[0];
  if (first.startsWith("#!")) {
    for (const [re, lang] of SHEBANG) if (re.test(first)) return lang;
  }
  if (/^<\?xml\b|^<!doctype html\b|^<html\b/i.test(text.trimStart())) return "xml";
  if (/^\s*[{[]/.test(text) && /[}\]]\s*$/.test(text)) {
    try {
      JSON.parse(text);
      return "json";
    } catch {
      // pas du JSON
    }
  }
  try {
    const r = hljs.highlightAuto(text.slice(0, 20_000));
    return r.language && r.relevance >= 6 ? r.language : null;
  } catch {
    return null;
  }
}

function highlightCode(text, language) {
  if (!hljs || !language || language === "plaintext") return escapeHtml(text);
  try {
    return hljs.highlight(text, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(text);
  }
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* Le préfixe de commentaire de ligne, ou le couple de bloc, par langage. */
const LINE_COMMENT = {
  "//": ["javascript", "typescript", "c", "cpp", "csharp", "java", "kotlin", "swift", "go", "rust", "dart", "scala", "php", "groovy", "gradle", "d", "haxe", "objectivec", "arduino", "protobuf"],
  "#": ["python", "bash", "shell", "yaml", "ruby", "perl", "r", "julia", "makefile", "dockerfile", "nginx", "ini", "properties", "powershell", "elixir", "crystal", "nim", "awk", "tcl", "cmake", "coffeescript", "apache", "plaintext"],
  "--": ["sql", "pgsql", "lua", "haskell", "elm"],
  "%": ["latex", "erlang", "matlab", "prolog"],
  ";": ["lisp", "scheme", "clojure", "x86asm"],
  '"': ["vim"],
  "'": ["vbscript", "vbnet", "basic"],
};
const BLOCK_COMMENT = { css: ["/* ", " */"], scss: ["/* ", " */"], less: ["/* ", " */"], xml: ["<!-- ", " -->"], markdown: ["<!-- ", " -->"], handlebars: ["<!-- ", " -->"], twig: ["{# ", " #}"], django: ["{# ", " #}"], ocaml: ["(* ", " *)"], fsharp: ["(* ", " *)"], delphi: ["{ ", " }"], smalltalk: ['" ', ' "'] };

function commentSyntax(language) {
  for (const [prefix, langs] of Object.entries(LINE_COMMENT)) if (langs.includes(language)) return { line: prefix };
  if (BLOCK_COMMENT[language]) return { block: BLOCK_COMMENT[language] };
  return null;
}

/* ---- Réglages retenus sur l'appareil ---------------------------------------
   Le langage choisi à la main et le retour à la ligne, par fichier ; la
   taille de police, pour tous. */
const PREFS_KEY = "allkin.textEditor.v1";
function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}
function writePrefs(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // stockage indisponible : les réglages valent pour cette visite
  }
}
const fileKey = (tab) => `${tab.agentId}/${tab.path}`;
function filePref(tab) {
  return readPrefs().files?.[fileKey(tab)] ?? {};
}
function setFilePref(tab, patch) {
  const p = readPrefs();
  p.files ??= {};
  p.files[fileKey(tab)] = { ...p.files[fileKey(tab)], ...patch };
  // Bornée : au-delà, les plus anciennes entrées tombent.
  const keys = Object.keys(p.files);
  if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete p.files[k];
  writePrefs(p);
}
function fontSizePref() {
  const v = Number(readPrefs().fontSize);
  return Number.isFinite(v) && v >= 10 && v <= 24 ? v : 14;
}

/* ---- Nature d'un fichier ---------------------------------------------------
   Ce qui s'ouvre autrement que comme du code : le markdown (éditeur vivant),
   les images et les PDF (visionneuse). Le reste est du texte, coloré si l'on
   sait, brut sinon — une extension inconnue n'empêche plus d'ouvrir. Seuls
   les binaires connus restent fermés. */
const FILE_EXT = {
  markdown: ["md", "markdown", "mdown", "mkd"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"],
  pdf: ["pdf"],
};
const BINARY_EXT = new Set([
  "zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "exe", "dll", "so", "dylib", "bin", "iso", "img", "dmg",
  "mp3", "wav", "ogg", "flac", "m4a", "mp4", "mov", "webm", "mkv", "avi", "doc", "docx", "xls", "xlsx", "ppt",
  "pptx", "odt", "ods", "odp", "ttf", "otf", "woff", "woff2", "eot", "sqlite", "db", "pyc", "class", "jar", "wasm",
  "heic", "psd", "ai",
]);

function fileKind(filename) {
  const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
  for (const [kind, exts] of Object.entries(FILE_EXT)) if (exts.includes(ext)) return kind;
  return BINARY_EXT.has(ext) ? "other" : "text";
}

function isEditableKind(kind) {
  return kind === "markdown" || kind === "text";
}

function openFileTab(agentId, path, name) {
  openTab(agentId, "file", { path, name });
}

/* ---- Affichage d'un onglet ----------------------------------------------- */

async function renderFileView(tab) {
  const kind = fileKind(tab.name);
  el("file-error").classList.add("hidden");
  el("file-mode-btn").classList.toggle("hidden", kind !== "markdown");
  el("file-copy-btn").classList.toggle("hidden", !isEditableKind(kind));
  if (!tab.mode) tab.mode = kind === "markdown" ? "preview" : "edit";

  if (!isEditableKind(kind)) {
    renderFileMedia(tab, kind);
    return;
  }

  if (!tab.loaded) {
    el("file-editor-wrap").classList.add("hidden");
    el("file-preview").classList.remove("hidden");
    el("file-preview").textContent = "Chargement…";
    try {
      const res = await fetch(dataFileUrl(tab.agentId, tab.path, false));
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const content = await res.text();
      tab.content = content;
      tab.loaded = true;
      // L'onglet a pu changer pendant le chargement.
      if (activeTab() !== tab) return;
    } catch (err) {
      showFileError(`Impossible de charger le fichier : ${err.message}`);
      el("file-preview").textContent = "";
      return;
    }
  }
  applyFileMode(tab);
}

function renderFileMedia(tab, kind) {
  const mediaEl = el("file-media");
  mediaEl.innerHTML = "";
  mediaEl.classList.remove("hidden");
  for (const id of ["file-preview", "file-editor-wrap", "md-toolbar", "file-path-wrap", "file-fullscreen-btn", "code-toolbar", "code-find", "code-status"]) {
    el(id).classList.add("hidden");
  }
  el("file-view").classList.remove("is-code");
  el("file-save-state").textContent = "";

  const fileUrl = dataFileUrl(tab.agentId, tab.path, false);
  if (kind === "image") {
    const img = document.createElement("img");
    img.src = fileUrl;
    img.alt = tab.name;
    img.className = "file-media-image";
    mediaEl.appendChild(img);
  } else if (kind === "pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = fileUrl;
    iframe.className = "file-media-frame";
    mediaEl.appendChild(iframe);
  } else {
    const note = document.createElement("p");
    note.className = "dim";
    note.textContent = "Aperçu non disponible pour ce type de fichier — utilise le téléchargement.";
    mediaEl.appendChild(note);
  }
}

function applyFileMode(tab) {
  const editing = tab.mode === "edit";
  const kind = fileKind(tab.name);
  const live = editing && kind === "markdown" && Boolean(window.Allkin.capability("markdown-editor"));
  const code = editing && !live;

  el("file-media").classList.add("hidden");
  el("md-toolbar").classList.toggle("hidden", !live);
  el("file-live").classList.toggle("hidden", !live);
  el("file-editor-wrap").classList.toggle("hidden", !code);
  el("file-preview").classList.toggle("hidden", editing);
  el("file-mode-btn").textContent = editing ? "Aperçu" : "Éditer";
  el("code-toolbar").classList.toggle("hidden", !code);
  el("code-status").classList.toggle("hidden", !code);
  el("file-view").classList.toggle("is-code", code);
  if (!code) closeFind();

  el("file-path-wrap").classList.toggle("hidden", editing);
  if (!editing) {
    el("file-path-text").textContent = tab.path;
    el("file-path-text").title = tab.path;
  }
  el("file-fullscreen-btn").classList.toggle("hidden", !editing);
  if (!editing) setFileFullscreen(false);

  if (live) mountFileLiveEditor(tab);
  else unmountFileLiveEditor();

  if (live) {
    // mountFileLiveEditor a déjà peint le document
  } else if (code) {
    mountCodeEditor(tab);
  } else {
    el("file-preview").innerHTML = window.renderMarkdown ? window.renderMarkdown(tab.content, { agentFiles: tab.agentId }) : "";
  }
  renderFileSaveState(tab);
  applyScroll();
}

/* ---- L'éditeur vivant (markdown) ----------------------------------------- */

let fileLiveEditor = null;
let fileLiveEditorTabId = null;

const RASTER = /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i;

function safeUploadName(name) {
  const dot = name.lastIndexOf(".");
  const clean = (part) => part.normalize("NFC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^[-.]+|[-.]+$/g, "");
  const base = clean(dot > 0 ? name.slice(0, dot) : name) || "fichier";
  const ext = dot > 0 ? clean(name.slice(dot + 1)).toLowerCase() : "";
  return ext ? `${base}.${ext}` : base;
}

async function freeUploadName(agentId, folder, name) {
  let taken;
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/data?path=${encodeURIComponent(folder)}`);
    if (!res.ok) return name;
    taken = new Set(((await res.json()).entries ?? []).map((entry) => entry.name));
  } catch {
    return name;
  }
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (taken.has(`${base}-${n}${ext}`)) n++;
  return `${base}-${n}${ext}`;
}

function liveEditorFiles(tab) {
  const folder = tab.path.includes("/") ? tab.path.slice(0, tab.path.lastIndexOf("/")) : "";
  return {
    async upload(file) {
      const target = [folder, /^image\//.test(file.type) ? "images" : "fichiers"].filter(Boolean).join("/");
      const name = await freeUploadName(tab.agentId, target, safeUploadName(file.name));
      const form = new FormData();
      form.append("path", `${target}/${name}`);
      form.append("file", file, name);
      const res = await fetch(`/api/agents/${encodeURIComponent(tab.agentId)}/data/upload`, { method: "POST", body: form });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.path) throw new Error(payload.error || `erreur ${res.status}`);
      return { src: payload.path, name: file.name };
    },
    resolve(src, usage) {
      let path = String(src ?? "").trim();
      try {
        path = decodeURIComponent(path);
      } catch {
        // adresse mal encodée : prise telle quelle
      }
      path = path.replace(/^\.\//, "").replace(/^data\//, "");
      if (!path || path.startsWith("/") || path.split("/").some((part) => part === ".." || part === "." || part === "")) return null;
      const inline = usage === "image" || RASTER.test(path) || /\.pdf$/i.test(path);
      return dataFileUrl(tab.agentId, path, !inline);
    },
  };
}

function mountFileLiveEditor(tab) {
  if (fileLiveEditor && fileLiveEditorTabId === tab.id) {
    fileLiveEditor.render();
    return;
  }
  unmountFileLiveEditor();
  fileLiveEditor = window.Allkin.capability("markdown-editor").create({
    host: el("file-live"),
    toolbar: el("md-toolbar"),
    spellcheck: false,
    files: liveEditorFiles(tab),
    doc: {
      getContent: () => tab.content,
      setContent: (next) => {
        tab.content = next;
        markFileDirty(tab);
      },
      isActive: () => activeTab() === tab && tab.mode === "edit",
    },
  });
  fileLiveEditorTabId = tab.id;
  fileLiveEditor.render();
}

function unmountFileLiveEditor() {
  fileLiveEditor?.destroy();
  fileLiveEditor = null;
  fileLiveEditorTabId = null;
}

/* ---- L'éditeur de code --------------------------------------------------- */

const ta = () => el("file-editor");
const wrapEl = () => el("file-editor-wrap");

/** Le langage effectif d'un onglet : choisi à la main, sinon déduit du nom,
 *  sinon deviné au contenu, sinon texte brut. */
function effectiveLanguage(tab) {
  if (tab.language) return tab.language;
  if (tab.detectedLanguage === undefined) {
    tab.detectedLanguage = languageForFilename(tab.name) ?? guessLanguage(tab.content ?? "");
  }
  return tab.detectedLanguage ?? "plaintext";
}

/** Indentation du fichier : tabulation, ou n espaces (2 par défaut). */
function detectIndent(text) {
  let tabs = 0;
  const spaces = new Map();
  for (const line of text.split("\n").slice(0, 400)) {
    const m = /^( +|\t+)\S/.exec(line);
    if (!m) continue;
    if (m[1][0] === "\t") tabs++;
    else spaces.set(m[1].length, (spaces.get(m[1].length) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [n, c] of spaces) if (n <= 8 && c > bestCount) [best, bestCount] = [n, c];
  if (tabs > bestCount) return "\t";
  // Deux espaces gagnent souvent par accident (une ligne indentée de 4 en
  // compte aussi une de 2) : on garde la plus petite unité observée ≥ 2.
  const units = [...spaces.keys()].filter((n) => n >= 2 && n <= 8).sort((a, b) => a - b);
  return " ".repeat(units[0] ?? best ?? 2);
}

function mountCodeEditor(tab) {
  const textarea = ta();
  if (textarea.value !== tab.content) textarea.value = tab.content;
  const pref = filePref(tab);
  if (tab.language === undefined) tab.language = pref.language ?? null;
  const language = effectiveLanguage(tab);
  const kind = fileKind(tab.name);
  // Texte brut et markdown sans éditeur vivant : le retour à la ligne est
  // naturel ; le code, lui, garde ses lignes entières.
  if (tab.wrap === undefined) tab.wrap = pref.wrap ?? (language === "plaintext" || kind === "markdown");
  tab.indentUnit ??= detectIndent(tab.content ?? "");
  wrapEl().style.setProperty("--code-size", `${fontSizePref()}px`);
  wrapEl().classList.toggle("is-wrapping", Boolean(tab.wrap));
  wrapEl().classList.toggle("no-gutter", Boolean(tab.wrap));
  el("code-wrap-btn").classList.toggle("active", Boolean(tab.wrap));
  el("code-wrap-btn").setAttribute("aria-pressed", String(Boolean(tab.wrap)));
  renderLanguageSelect(tab);
  renderCodeLayer(tab);
  renderGutter(tab);
  renderStatus(tab);
}

function renderLanguageSelect(tab) {
  const select = el("code-lang");
  const detected = tab.detectedLanguage ?? "plaintext";
  select.replaceChildren();
  const auto = new Option(`Auto — ${langLabel(detected)}`, "");
  select.add(auto);
  select.add(new Option("Texte brut", "plaintext"));
  for (const { id, label } of allLanguages()) select.add(new Option(label, id));
  select.value = tab.language ?? "";
  select.title = tab.language ? `Langage choisi à la main : ${langLabel(tab.language)}` : `Langage détecté : ${langLabel(detected)}`;
}

let layerTimer = null;
const HIGHLIGHT_MAX_BYTES = 400_000;

/** Repeint le calque coloré. Différé d'un souffle pendant la frappe : un gros
 *  fichier recoloré à chaque touche ferait bégayer la saisie. */
function renderCodeLayer(tab, { immediate = true } = {}) {
  clearTimeout(layerTimer);
  const paint = () => {
    const language = effectiveLanguage(tab);
    const text = ta().value;
    const colored = language !== "plaintext" && text.length <= HIGHLIGHT_MAX_BYTES;
    wrapEl().classList.toggle("has-highlight", colored);
    // Un « \n » de plus : une dernière ligne vide dans la zone de saisie doit
    // exister aussi dans le calque, sinon le fond s'arrête une ligne trop tôt.
    el("file-editor-highlight").innerHTML = colored ? highlightCode(text, language) + "\n" : "";
    syncScroll();
  };
  if (immediate) paint();
  else layerTimer = setTimeout(paint, 60);
}

function renderGutter(tab) {
  const gutter = el("file-editor-gutter");
  if (tab.wrap) {
    gutter.textContent = "";
    return;
  }
  const n = countLines(ta().value);
  if (gutter.dataset.lines === String(n)) return;
  gutter.dataset.lines = String(n);
  let s = "";
  for (let i = 1; i <= n; i++) s += i + "\n";
  gutter.textContent = s;
  syncScroll();
}

function countLines(text) {
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function syncScroll() {
  const textarea = ta();
  el("file-editor-highlight").scrollTop = textarea.scrollTop;
  el("file-editor-highlight").scrollLeft = textarea.scrollLeft;
  el("file-editor-gutter").scrollTop = textarea.scrollTop;
}
ta().addEventListener("scroll", syncScroll);

function renderStatus(tab) {
  const textarea = ta();
  const pos = textarea.selectionStart;
  const before = textarea.value.slice(0, pos);
  const line = countLines(before);
  const col = pos - before.lastIndexOf("\n");
  const sel = textarea.selectionEnd - textarea.selectionStart;
  el("code-status-pos").textContent = `Ln ${line}, Col ${col}${sel ? ` (${sel} sél.)` : ""}`;
  const total = countLines(textarea.value);
  el("code-status-lines").textContent = `${total} ligne${total > 1 ? "s" : ""}`;
  el("code-status-indent").textContent = tab.indentUnit === "\t" ? "Tabulations" : `Espaces : ${tab.indentUnit?.length ?? 2}`;
  el("code-status-lang").textContent = langLabel(effectiveLanguage(tab));
}

function currentFileTab() {
  const tab = activeTab();
  return tab && tab.kind === "file" && !el("file-editor-wrap").classList.contains("hidden") ? tab : null;
}

el("code-lang").addEventListener("change", () => {
  const tab = currentFileTab();
  if (!tab) return;
  tab.language = el("code-lang").value || null;
  setFilePref(tab, { language: tab.language });
  // Un langage choisi à la main change le sens du retour à la ligne par défaut
  // seulement si l'utilisateur ne l'a pas réglé lui-même.
  renderLanguageSelect(tab);
  renderCodeLayer(tab);
  renderStatus(tab);
  bulle(tab.language ? `Coloration : ${langLabel(tab.language)}.` : `Coloration automatique : ${langLabel(effectiveLanguage(tab))}.`);
});

el("code-wrap-btn").addEventListener("click", () => {
  const tab = currentFileTab();
  if (!tab) return;
  tab.wrap = !tab.wrap;
  setFilePref(tab, { wrap: tab.wrap });
  wrapEl().classList.toggle("is-wrapping", tab.wrap);
  wrapEl().classList.toggle("no-gutter", tab.wrap);
  el("code-wrap-btn").classList.toggle("active", tab.wrap);
  el("code-wrap-btn").setAttribute("aria-pressed", String(tab.wrap));
  el("file-editor-gutter").dataset.lines = "";
  renderGutter(tab);
  syncScroll();
});

for (const [id, delta] of [["code-font-minus-btn", -1], ["code-font-plus-btn", 1]]) {
  el(id).addEventListener("click", () => {
    const next = Math.min(24, Math.max(10, fontSizePref() + delta));
    writePrefs({ ...readPrefs(), fontSize: next });
    wrapEl().style.setProperty("--code-size", `${next}px`);
    syncScroll();
  });
}

/* ---- Édition : insertion qui respecte l'annulation native ---------------- */

/** Remplace [start, end[ par `text`, en gardant Ctrl+Z fonctionnel quand le
 *  navigateur le permet (execCommand), sinon directement. */
function replaceRange(start, end, text, selectStart = null, selectEnd = null) {
  const textarea = ta();
  textarea.focus();
  textarea.setSelectionRange(start, end);
  let done = false;
  try {
    done = document.execCommand("insertText", false, text);
  } catch {
    done = false;
  }
  if (!done || textarea.value.slice(start, start + text.length) !== text) {
    textarea.setRangeText(text, start, end, "end");
  }
  if (selectStart !== null) textarea.setSelectionRange(selectStart, selectEnd ?? selectStart);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Les bornes des lignes entières couvertes par la sélection. */
function selectedLines() {
  const textarea = ta();
  const value = textarea.value;
  const start = value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
  let end = value.indexOf("\n", Math.max(textarea.selectionEnd - (textarea.selectionEnd > textarea.selectionStart && value[textarea.selectionEnd - 1] === "\n" ? 1 : 0), textarea.selectionStart));
  if (end === -1) end = value.length;
  return { start, end, text: value.slice(start, end) };
}

function indentSelection(tab, outdent) {
  const unit = tab.indentUnit ?? "  ";
  const textarea = ta();
  const { start, end, text } = selectedLines();
  const single = textarea.selectionStart === textarea.selectionEnd;
  if (single && !outdent) {
    // Tab sans sélection : insère l'unité (jusqu'à la colonne suivante pour des espaces).
    const col = textarea.selectionStart - start;
    const ins = unit === "\t" ? "\t" : " ".repeat(unit.length - (col % unit.length));
    replaceRange(textarea.selectionStart, textarea.selectionStart, ins);
    return;
  }
  const lines = text.split("\n");
  const next = lines
    .map((l) => {
      if (outdent) {
        if (l.startsWith(unit)) return l.slice(unit.length);
        if (l.startsWith("\t")) return l.slice(1);
        return l.replace(/^ {1,4}/, "");
      }
      return l.length || lines.length === 1 ? unit + l : l;
    })
    .join("\n");
  replaceRange(start, end, next, start, start + next.length);
}

function toggleComment(tab) {
  const syntax = commentSyntax(effectiveLanguage(tab));
  if (!syntax) {
    bulle("Ce langage n'a pas de commentaire connu.", "ko");
    return;
  }
  const { start, end, text } = selectedLines();
  if (syntax.block) {
    const [open, close] = syntax.block;
    const trimmed = text.trim();
    if (trimmed.startsWith(open.trim()) && trimmed.endsWith(close.trim())) {
      const inner = text.replace(open.trim(), "").replace(new RegExp(close.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$"), "").replace(/^\s/, "");
      replaceRange(start, end, inner, start, start + inner.length);
    } else {
      const next = open + text + close;
      replaceRange(start, end, next, start, start + next.length);
    }
    return;
  }
  const prefix = syntax.line;
  const lines = text.split("\n");
  const meaningful = lines.filter((l) => l.trim());
  const allCommented = meaningful.length > 0 && meaningful.every((l) => l.trimStart().startsWith(prefix));
  const indent = Math.min(...meaningful.map((l) => l.length - l.trimStart().length), 0) || 0;
  const next = lines
    .map((l) => {
      if (!l.trim()) return l;
      if (allCommented) return l.replace(new RegExp(`^(\\s*)${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ?`), "$1");
      return l.slice(0, indent) + prefix + " " + l.slice(indent);
    })
    .join("\n");
  replaceRange(start, end, next, start, start + next.length);
}

function newlineWithIndent(tab) {
  const textarea = ta();
  const value = textarea.value;
  const pos = textarea.selectionStart;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const line = value.slice(lineStart, pos);
  const lead = /^[ \t]*/.exec(line)[0];
  const unit = tab.indentUnit ?? "  ";
  // Ouvrir un bloc indente d'un cran ; « : » en Python aussi.
  const opens = /[{[(]\s*$/.test(line) || (effectiveLanguage(tab) === "python" && /:\s*$/.test(line));
  let ins = "\n" + lead + (opens ? unit : "");
  // Entre « { » et « } » : la fermante descend d'une ligne, alignée.
  const after = value.slice(textarea.selectionEnd);
  if (/^[{[(]\s*$/.test(line.trimStart().slice(-1)) === false && opens && /^[\]})]/.test(after)) ins += "\n" + lead;
  const caret = pos + 1 + lead.length + (opens ? unit.length : 0);
  replaceRange(pos, textarea.selectionEnd, ins, caret, caret);
}

ta().addEventListener("keydown", (e) => {
  const tab = currentFileTab();
  if (!tab) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === "Tab") {
    e.preventDefault();
    indentSelection(tab, e.shiftKey);
  } else if (e.key === "Enter" && !mod && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    newlineWithIndent(tab);
  } else if (mod && e.key === "/") {
    e.preventDefault();
    toggleComment(tab);
  } else if (mod && !e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    tab.dirty ? saveFileTab(tab).then(() => bulle("Enregistré.")) : bulle("Déjà enregistré.");
  } else if (mod && e.key.toLowerCase() === "f") {
    e.preventDefault();
    openFind();
  } else if (mod && e.key.toLowerCase() === "h") {
    e.preventDefault();
    openFind({ replace: true });
  } else if (mod && e.key.toLowerCase() === "g") {
    e.preventDefault();
    void gotoLine(tab);
  } else if (mod && e.key.toLowerCase() === "d" && !e.shiftKey) {
    e.preventDefault();
    const { start, end, text } = selectedLines();
    replaceRange(end, end, "\n" + text, end + 1, end + 1 + text.length);
  }
});

for (const evt of ["keyup", "click", "select"]) {
  ta().addEventListener(evt, () => {
    const tab = currentFileTab();
    if (tab) renderStatus(tab);
  });
}

async function gotoLine(tab) {
  const total = countLines(ta().value);
  const raw = core.prompt
    ? await core.prompt({ title: "Aller à la ligne", okLabel: "Aller", input: { placeholder: `1 à ${total}`, maxLength: 8 } })
    : window.prompt(`Ligne (1 à ${total}) :`);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return;
  goToLineNumber(Math.min(n, total));
}

function goToLineNumber(n) {
  const textarea = ta();
  const value = textarea.value;
  let pos = 0;
  for (let i = 1; i < n; i++) {
    const nl = value.indexOf("\n", pos);
    if (nl === -1) break;
    pos = nl + 1;
  }
  // Le curseur en tête de ligne, sans la sélectionner : on vient y écrire.
  selectAndReveal(pos, pos, n);
}

/** Sélectionne [start, end[ et fait défiler pour le montrer (au tiers). */
function selectAndReveal(start, end, lineHint = null) {
  const textarea = ta();
  textarea.focus();
  textarea.setSelectionRange(start, end);
  const line = lineHint ?? countLines(textarea.value.slice(0, start));
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
  textarea.scrollTop = Math.max(0, (line - 1) * lineHeight - textarea.clientHeight / 3);
  syncScroll();
  const tab = currentFileTab();
  if (tab) renderStatus(tab);
}

/* ---- Rechercher / remplacer ---------------------------------------------- */

const find = { open: false, caseSensitive: false, matches: [], index: -1 };

function openFind({ replace = false } = {}) {
  find.open = true;
  el("code-find").classList.remove("hidden");
  el("code-find-btn").classList.add("active");
  const textarea = ta();
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  if (selected && !selected.includes("\n")) el("code-find-input").value = selected;
  runFind({ jump: false });
  (replace ? el("code-replace-input") : el("code-find-input")).focus();
  el("code-find-input").select();
}

function closeFind() {
  if (!find.open) return;
  find.open = false;
  el("code-find").classList.add("hidden");
  el("code-find-btn").classList.remove("active");
  find.matches = [];
  find.index = -1;
}

function runFind({ jump = true, backwards = false } = {}) {
  const query = el("code-find-input").value;
  const count = el("code-find-count");
  find.matches = [];
  if (!query) {
    count.textContent = "";
    count.classList.remove("is-none");
    return;
  }
  const textarea = ta();
  const hay = find.caseSensitive ? textarea.value : textarea.value.toLowerCase();
  const needle = find.caseSensitive ? query : query.toLowerCase();
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1 && find.matches.length < 5000) {
    find.matches.push(i);
    i += needle.length;
  }
  if (find.matches.length === 0) {
    count.textContent = "0";
    count.classList.add("is-none");
    find.index = -1;
    return;
  }
  count.classList.remove("is-none");
  if (jump) {
    const from = backwards ? textarea.selectionStart - 1 : textarea.selectionEnd;
    let idx = backwards
      ? find.matches.map((m, k) => [m, k]).filter(([m]) => m < from).pop()?.[1]
      : find.matches.findIndex((m) => m >= from);
    if (idx === undefined || idx === -1) idx = backwards ? find.matches.length - 1 : 0;
    find.index = idx;
    selectAndReveal(find.matches[idx], find.matches[idx] + query.length);
  } else {
    const cur = find.matches.indexOf(textarea.selectionStart);
    find.index = cur;
  }
  count.textContent = find.index >= 0 ? `${find.index + 1}/${find.matches.length}` : `${find.matches.length}`;
}

function replaceOne() {
  const query = el("code-find-input").value;
  if (!query) return;
  const textarea = ta();
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  const same = find.caseSensitive ? selected === query : selected.toLowerCase() === query.toLowerCase();
  if (same) replaceRange(textarea.selectionStart, textarea.selectionEnd, el("code-replace-input").value);
  runFind();
}

function replaceAll() {
  const query = el("code-find-input").value;
  if (!query) return;
  const textarea = ta();
  const replacement = el("code-replace-input").value;
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), find.caseSensitive ? "g" : "gi");
  const before = textarea.value;
  const n = (before.match(re) ?? []).length;
  if (!n) {
    bulle("Aucune occurrence.", "ko");
    return;
  }
  replaceRange(0, before.length, before.replace(re, () => replacement), 0, 0);
  runFind({ jump: false });
  bulle(`${n} occurrence${n > 1 ? "s" : ""} remplacée${n > 1 ? "s" : ""}.`);
}

el("code-find-btn").addEventListener("click", () => (find.open ? closeFind() : openFind()));
el("code-find-close").addEventListener("click", () => {
  closeFind();
  ta().focus();
});
el("code-find-input").addEventListener("input", () => runFind({ jump: true }));
el("code-find-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runFind({ jump: true, backwards: e.shiftKey });
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeFind();
    ta().focus();
  }
});
el("code-replace-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    replaceOne();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeFind();
    ta().focus();
  }
});
el("code-find-next").addEventListener("click", () => runFind({ jump: true }));
el("code-find-prev").addEventListener("click", () => runFind({ jump: true, backwards: true }));
el("code-find-case").addEventListener("click", () => {
  find.caseSensitive = !find.caseSensitive;
  el("code-find-case").classList.toggle("active", find.caseSensitive);
  el("code-find-case").setAttribute("aria-pressed", String(find.caseSensitive));
  runFind({ jump: true });
});
el("code-replace-one").addEventListener("click", replaceOne);
el("code-replace-all").addEventListener("click", replaceAll);
el("code-goto-btn").addEventListener("click", () => {
  const tab = currentFileTab();
  if (tab) void gotoLine(tab);
});
el("code-comment-btn").addEventListener("click", () => {
  const tab = currentFileTab();
  if (tab) toggleComment(tab);
});

/* ---- Boutons de l'en-tête et du flottant --------------------------------- */

function showFileError(message) {
  const errorEl = el("file-error");
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

el("file-mode-btn").addEventListener("click", () => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  tab.mode = tab.mode === "edit" ? "preview" : "edit";
  applyFileMode(tab);
  persistTabs();
  if (tab.mode !== "edit") return;
  if (el("file-live").classList.contains("hidden")) ta().focus();
  else fileLiveEditor?.focus("start");
});

el("file-download-btn").addEventListener("click", () => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  window.open(dataFileUrl(tab.agentId, tab.path, true), "_blank");
});

el("file-copy-btn").addEventListener("click", async (event) => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  const ok = await copyToClipboard(event.currentTarget, tab.content ?? "");
  if (!ok) bulle("Copie impossible : le presse-papiers est refusé par le navigateur.", "ko");
});

el("file-path-copy-btn").addEventListener("click", async (event) => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  const ok = await copyToClipboard(event.currentTarget, tab.path ?? "");
  if (!ok) bulle("Copie impossible : le presse-papiers est refusé par le navigateur.", "ko");
});

// ---- Plein écran ----
const ICON_FULLSCREEN_ENTER =
  '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m11-5v3a2 2 0 01-2 2h-3"/></svg>';
const ICON_FULLSCREEN_EXIT =
  '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v3a2 2 0 01-2 2H4m16 0h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3m6-5h3a2 2 0 012 2v3"/></svg>';

function setFileFullscreen(on) {
  const fileView = el("file-view");
  if (fileView.classList.contains("is-fullscreen") === on) return;
  fileView.classList.toggle("is-fullscreen", on);
  const button = el("file-fullscreen-btn");
  button.innerHTML = on ? ICON_FULLSCREEN_EXIT : ICON_FULLSCREEN_ENTER;
  button.title = on ? "Quitter le plein écran" : "Plein écran";
  button.setAttribute("aria-label", button.title);
}

el("file-fullscreen-btn").addEventListener("click", () => {
  setFileFullscreen(!el("file-view").classList.contains("is-fullscreen"));
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (find.open && (document.activeElement === ta() || el("code-find").contains(document.activeElement))) {
    closeFind();
    ta().focus();
    return;
  }
  if (el("file-view").classList.contains("is-fullscreen")) setFileFullscreen(false);
  else if (state.view === "settings" || state.view === "config") returnToActiveTab();
});

/* ---- Enregistrement au fil de la frappe ---------------------------------- */

const FILE_SAVE_DELAY_MS = 700;

function renderFileSaveState(tab) {
  const stateEl = el("file-save-state");
  stateEl.className = "file-save-state";
  if (tab.saveState === "saving") {
    stateEl.textContent = "Enregistrement…";
  } else if (tab.saveState === "dirty") {
    stateEl.textContent = "Modifications en attente";
    stateEl.classList.add("dirty");
  } else if (tab.saveState === "error") {
    stateEl.textContent = "Échec de l'enregistrement";
    stateEl.classList.add("failed");
  } else if (tab.savedAt) {
    stateEl.textContent = `Enregistré à ${tab.savedAt}`;
    stateEl.classList.add("saved");
  } else {
    stateEl.textContent = "";
  }
}

function markFileDirty(tab) {
  tab.dirty = true;
  tab.saveState = "dirty";
  if (activeTab() === tab) renderFileSaveState(tab);
  renderTabBar();
  clearTimeout(tab.saveTimer);
  tab.saveTimer = setTimeout(() => saveFileTab(tab), FILE_SAVE_DELAY_MS);
}

function noteEditorChange(tab) {
  tab.content = ta().value;
  renderCodeLayer(tab, { immediate: tab.content.length < 20_000 });
  renderGutter(tab);
  renderStatus(tab);
  if (find.open) runFind({ jump: false });
  markFileDirty(tab);
}

async function saveFileTab(tab, options = {}) {
  clearTimeout(tab.saveTimer);
  tab.saveTimer = null;
  if (!tab.dirty) return;
  const content = tab.content;
  tab.saveState = "saving";
  if (activeTab() === tab) renderFileSaveState(tab);
  try {
    const res = await fetch(dataFileUrl(tab.agentId, tab.path, false), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      keepalive: options.keepalive === true,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erreur ${res.status}`);
    }
    if (tab.content === content) {
      tab.dirty = false;
      tab.saveState = "saved";
      tab.savedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  } catch (err) {
    tab.saveState = "error";
    if (activeTab() === tab) bulle(`Enregistrement impossible : ${err.message}`, "ko");
  }
  if (activeTab() === tab) renderFileSaveState(tab);
  renderTabBar();
}

function flushFileSave(tab, options) {
  if (tab.saveTimer) saveFileTab(tab, options);
}

window.addEventListener("beforeunload", () => {
  persistTabs();
  for (const tab of state.tabs) {
    if (tab.kind === "file" && tab.dirty) saveFileTab(tab, { keepalive: true });
  }
});

ta().addEventListener("input", () => {
  const tab = currentFileTab();
  if (tab) noteEditorChange(tab);
});

/* ---- Déclarations ------------------------------------------------------- */

window.Allkin.registerTabKind("file", {
  panels: ["file-view"],
  icon: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></svg>',
  label: (tab) => tab.name,
  meta: "Fichier",
  tooltip: (tab) => tab.path,
  byPath: true,
  maxPerAgent: 6,
  scroller: () =>
    el("file-editor-wrap").classList.contains("hidden")
      ? [el("file-live"), el("file-preview")].find((n) => !n.classList.contains("hidden"))
      : ta(),
  scrollKeySuffix: (tab) => tab.mode ?? "preview",
  activate: (tab) => renderFileView(tab),
  leave: (tab) => {
    flushFileSave(tab);
    setFileFullscreen(false);
    closeFind();
  },
  beforeClose: (tab) => flushFileSave(tab),
});

window.Allkin.provide("text-editor", {
  openFile: openFileTab,
  canOpen: (name) => fileKind(name) !== "other",
});

/* La coloration, pour les autres plugins (l'explorateur montre un script
   avant de l'exécuter). Même contrat que window.highlightCode du cœur, avec
   bien plus de langages. */
window.Allkin.provide("code-highlight", {
  highlight: highlightCode,
  languageForFilename,
  languages: () => allLanguages().map((l) => l.id),
  label: langLabel,
});

})();
