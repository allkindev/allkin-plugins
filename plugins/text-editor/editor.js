"use strict";
/* ============================================================================
   Plugin « Éditeur de texte » — l'onglet fichier d'Allkin.
   ----------------------------------------------------------------------------
   Déclare la nature d'onglet « file » (un fichier du data/ d'un agent) et la
   capacité « text-editor » :

     Allkin.capability("text-editor").openFile(agentId, path, name)
     Allkin.capability("text-editor").canOpen(name)

   dont se sert l'explorateur de fichiers. Les fichiers .md passent par le
   plugin « Éditeur markdown » quand il est là, en saisie brute sinon.
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

// ---- Onglet fichier : lecture et édition ----
// Un fichier de data/ ouvert plein écran dans son onglet. Le markdown s'affiche
// formaté par défaut, avec un bouton qui bascule en édition et découvre la
// barre des balises ; les autres fichiers texte s'ouvrent directement dans
// l'éditeur brut ; images et PDF en simple visionneuse. Rien à valider : le
// contenu est enregistré au fil de la frappe.

/* Ce qui s'ouvre autrement que comme du texte. L'ordre compte : un .svg est
   d'abord une image, même si le coloriseur saurait l'habiller. */
const FILE_EXT = {
  markdown: ["md", "markdown", "mdown", "mkd"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"],
  pdf: ["pdf"],
  /* Textes que le coloriseur ne connaît pas — et qu'il n'a aucune raison de
     connaître : il n'y a rien à colorier dans un .log. Tout le RESTE du texte
     est déduit de highlight.js (voir fileKind). */
  text: ["txt", "csv", "tsv", "log", "text", "me", "readme"],
};

/**
 * De quelle nature est ce fichier — ce qui décide s'il s'ouvre, et comment.
 *
 * Le texte se reconnaît à DEUX sources : la courte liste ci-dessus, et tout ce
 * que le coloriseur sait habiller. Il y avait avant une seconde liste
 * d'extensions ici, tenue à la main ; elle avait dérivé de celle de
 * highlight.js — vingt-deux extensions étaient colorées mais refusées à
 * l'ouverture, dont `.php`, `.sql`, `.toml` et `.env`. Un fichier PHP
 * répondait « aperçu non disponible » alors que tout était prêt pour l'afficher.
 *
 * Déduire plutôt que redire : ajouter un langage au coloriseur rend désormais
 * ses fichiers ouvrables, sans que personne ait à y penser.
 */
function fileKind(filename) {
  const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
  for (const [kind, exts] of Object.entries(FILE_EXT)) {
    if (exts.includes(ext)) return kind;
  }
  return window.languageForFilename?.(filename) ? "text" : "other";
}

function isEditableKind(kind) {
  return kind === "markdown" || kind === "text";
}

function openFileTab(agentId, path, name) {
  openTab(agentId, "file", { path, name });
}

async function renderFileView(tab) {
  const kind = fileKind(tab.name);
  el("file-error").classList.add("hidden");
  el("file-mode-btn").classList.toggle("hidden", kind !== "markdown");
  // Copier n'a de sens que pour un contenu texte : une image se télécharge.
  el("file-copy-btn").classList.toggle("hidden", !isEditableKind(kind));
  // Le markdown s'ouvre formaté ; un fichier texte n'a pas de rendu, autant
  // l'ouvrir directement dans l'éditeur.
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
      // L'onglet a pu changer pendant le chargement : ne rien écrire dans une
      // vue qui affiche désormais un autre fichier.
      if (activeTab() !== tab) {
        tab.content = content;
        tab.loaded = true;
        return;
      }
      tab.content = content;
      tab.loaded = true;
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
  el("file-preview").classList.add("hidden");
  el("file-editor-wrap").classList.add("hidden");
  el("md-toolbar").classList.add("hidden");
  el("file-path-wrap").classList.add("hidden");
  el("file-fullscreen-btn").classList.add("hidden");
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
  // Le markdown s'édite dans le rendu lui-même (éditeur vivant) ; les autres
  // textes n'ont pas de rendu à préserver et gardent la zone de saisie brute.
  // Sans le plugin d'éditeur markdown, un .md s'édite comme n'importe quel texte.
  const live = editing && kind === "markdown" && Boolean(window.Allkin.capability("markdown-editor"));
  // La saisie brute ne colore que les langages que highlight.js reconnaît :
  // un fichier .txt ou .log garde son apparence pleine, sans calque transparent.
  const highlightable = editing && !live && codeLayer.supported(tab.name);

  el("file-media").classList.add("hidden");
  el("md-toolbar").classList.toggle("hidden", !live);
  el("file-live").classList.toggle("hidden", !live);
  el("file-editor-wrap").classList.toggle("hidden", !editing || live);
  el("file-editor-wrap").classList.toggle("has-highlight", highlightable);
  el("file-preview").classList.toggle("hidden", editing);
  el("file-mode-btn").textContent = editing ? "Aperçu" : "Éditer";

  // Le chemin complet n'a d'intérêt qu'en aperçu ; le plein écran, qu'en
  // édition. Quitter l'édition referme un plein écran resté ouvert — sans
  // quoi le bouton qui permettrait d'en sortir aurait disparu avec lui.
  el("file-path-wrap").classList.toggle("hidden", editing);
  if (!editing) {
    el("file-path-text").textContent = tab.path;
    el("file-path-text").title = tab.path;
  }
  el("file-fullscreen-btn").classList.toggle("hidden", !editing);
  if (!editing) setFileFullscreen(false);

  if (live) {
    mountFileLiveEditor(tab);
  } else {
    unmountFileLiveEditor();
  }

  if (live) {
    // rien de plus : mountFileLiveEditor a déjà peint le document
  } else if (editing) {
    el("file-editor").value = tab.content;
    if (highlightable) renderEditorHighlight(tab);
  } else {
    el("file-preview").innerHTML = window.renderMarkdown ? window.renderMarkdown(tab.content) : "";
  }
  renderFileSaveState(tab);
  applyScroll();
}

/* ---- L'éditeur vivant, branché sur l'onglet fichier ----
   Une seule instance à la fois : un seul fichier est affiché. Elle est
   détruite dès qu'on quitte l'édition markdown, ce qui libère sa pile
   d'annulation et son écouteur de sélection. */

let fileLiveEditor = null;
let fileLiveEditorTabId = null;

function mountFileLiveEditor(tab) {
  // Même onglet, éditeur déjà en place : on repeint seulement, sinon changer
  // de mode ferait perdre l'historique d'annulation en cours.
  if (fileLiveEditor && fileLiveEditorTabId === tab.id) {
    fileLiveEditor.render();
    return;
  }
  unmountFileLiveEditor();
  fileLiveEditor = window.Allkin.capability("markdown-editor").create({
    host: el("file-live"),
    toolbar: el("md-toolbar"),
    // Un fichier peut être du code ou une liste de commandes : le correcteur
    // orthographique y soulignerait tout.
    spellcheck: false,
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

/* Le calque de coloration de l'onglet fichier. Une seule instance : un seul
   fichier est affiché à la fois. Sa mécanique — coloration, défilement
   solidaire, détection du langage — vit dans highlight.js ; ici on ne fait que
   lui dire quoi montrer. */
const codeLayer = window.createCodeLayer({
  textarea: el("file-editor"),
  layer: el("file-editor-highlight"),
});

/** Reconstruit le calque à partir du contenu courant. Appelée au premier rendu
 *  de l'éditeur et à chaque frappe (noteEditorChange). */
function renderEditorHighlight(tab) {
  codeLayer.update(tab.content, tab.name);
}

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
  // Passer en édition doit poser le curseur quelque part : au début du
  // document, comme n'importe quel traitement de texte.
  if (tab.mode !== "edit") return;
  if (el("file-live").classList.contains("hidden")) el("file-editor").focus();
  else fileLiveEditor?.focus("start");
});

el("file-download-btn").addEventListener("click", () => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  window.open(dataFileUrl(tab.agentId, tab.path, true), "_blank");
});



/**
 * Copie le contenu du fichier tel qu'il est enregistré (`tab.content`), et non
 * ce qui est à l'écran : l'éditeur y ajoute des balises de mise en forme, et le
 * mode aperçu ne montre pas la syntaxe. On copie donc bien du markdown.
 */
el("file-copy-btn").addEventListener("click", async (event) => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  const ok = await copyToClipboard(event.currentTarget, tab.content ?? "");
  if (!ok) showFileError("Copie impossible : le presse-papiers est refusé par le navigateur.");
});

el("file-path-copy-btn").addEventListener("click", async (event) => {
  const tab = activeTab();
  if (!tab || tab.kind !== "file") return;
  const ok = await copyToClipboard(event.currentTarget, tab.path ?? "");
  if (!ok) showFileError("Copie impossible : le presse-papiers est refusé par le navigateur.");
});

// ---- Plein écran ----
// Recouvre toute la fenêtre (sidebar comprise) : un simple ajout de classe, la
// mise en page de l'en-tête et du corps ne change pas. Quitter l'édition, ou
// la touche Échap, referme — inutile de trouver le bouton pour sortir.
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
  if (el("file-view").classList.contains("is-fullscreen")) setFileFullscreen(false);
  // Les deux pages pleine page se referment sur Échap : elles n'ont pas
  // d'onglet où l'on reviendrait autrement qu'en visant la croix.
  else if (state.view === "settings" || state.view === "config") returnToActiveTab();
});

// ---- Enregistrement au fil de la frappe ----
// Le délai évite une requête par touche sans jamais laisser une modification
// en suspens : tout ce qui reste en attente est écrit avant de quitter
// l'onglet, de le fermer ou de fermer la page.

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

/** Marque l'onglet modifié et relance le compte à rebours d'enregistrement.
 *  `tab.content` est supposé déjà à jour — l'éditeur vivant l'écrit bloc par
 *  bloc, la zone de saisie brute passe par noteEditorChange ci-dessous. */
function markFileDirty(tab) {
  tab.dirty = true;
  tab.saveState = "dirty";
  if (activeTab() === tab) renderFileSaveState(tab);
  renderTabBar();
  clearTimeout(tab.saveTimer);
  tab.saveTimer = setTimeout(() => saveFileTab(tab), FILE_SAVE_DELAY_MS);
}

function noteEditorChange(tab) {
  tab.content = el("file-editor").value;
  if (el("file-editor-wrap").classList.contains("has-highlight")) renderEditorHighlight(tab);
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
      // Une sauvegarde déclenchée par la fermeture de la page doit survivre à
      // celle-ci : sans keepalive, le navigateur l'annule.
      keepalive: options.keepalive === true,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erreur ${res.status}`);
    }
    // Rien de plus n'a été tapé pendant la requête : l'onglet est à jour.
    if (tab.content === content) {
      tab.dirty = false;
      tab.saveState = "saved";
      tab.savedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  } catch (err) {
    tab.saveState = "error";
    if (activeTab() === tab) showFileError(`Enregistrement impossible : ${err.message}`);
  }
  if (activeTab() === tab) renderFileSaveState(tab);
  renderTabBar();
}

// Écrit tout de suite ce qui attendait la fin du délai.
function flushFileSave(tab, options) {
  if (tab.saveTimer) saveFileTab(tab, options);
}

window.addEventListener("beforeunload", () => {
  persistTabs();
  for (const tab of state.tabs) {
    if (tab.kind === "file" && tab.dirty) saveFileTab(tab, { keepalive: true });
  }
});

el("file-editor").addEventListener("input", () => {
  const tab = activeTab();
  if (tab && tab.kind === "file") noteEditorChange(tab);
});


window.Allkin.registerTabKind("file", {
  panels: ["file-view"],
  icon: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></svg>',
  label: (tab) => tab.name,
  meta: "Fichier",
  tooltip: (tab) => tab.path,
  // Plusieurs fichiers ouverts à la fois, distingués par leur chemin ; au-delà
  // de six par agent, les onglets deviennent illisibles.
  byPath: true,
  maxPerAgent: 6,
  // Trois zones possibles (aperçu, éditeur vivant, saisie brute) : c'est celle
  // qui est visible qui défile — et l'aperçu et l'édition ne défilent pas au
  // même endroit, d'où deux positions distinctes.
  scroller: () =>
    el("file-editor-wrap").classList.contains("hidden")
      ? [el("file-live"), el("file-preview")].find((n) => !n.classList.contains("hidden"))
      : el("file-editor"),
  scrollKeySuffix: (tab) => tab.mode ?? "preview",
  activate: (tab) => renderFileView(tab),
  // Un onglet fichier quitté enregistre ce qui restait en attente, et sort du
  // plein écran : sinon il resterait actif sur un onglet qui n'a plus de bouton
  // pour en sortir.
  leave: (tab) => {
    flushFileSave(tab);
    setFileFullscreen(false);
  },
  beforeClose: (tab) => flushFileSave(tab),
});

window.Allkin.provide("text-editor", {
  openFile: openFileTab,
  canOpen: (name) => fileKind(name) !== "other",
});

})();
