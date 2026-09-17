"use strict";
/* ============================================================================
   Plugin « Explorateur de fichiers ».
   ----------------------------------------------------------------------------
   Deux natures d'onglet :
     · « files »    — le dossier data/ d'un agent : navigation, dépôt de
                      fichiers et de dossiers, sélection, copier/couper/coller,
                      archives, exécution de scripts, corbeille ;
     · « explorer » — ~/.allkin en lecture seule.

   Les routes serveur (/api/agents/:id/data/*, /api/allkin/fs) restent dans le
   cœur : les agents s'en servent aussi. Ouvrir un fichier passe par le plugin
   « Éditeur de texte » quand il est là ; sinon le fichier est téléchargé.
   ========================================================================== */
(() => {
const {
  activeTab,
  api,
  applyScroll,
  bindLongPress,
  closeChatMenu,
  closeTabContextMenu,
  dataFileUrl,
  el,
  estUnDepotDeFichiers,
  estUnScript,
  estUneArchive,
  fichiersDeposes,
  findTab,
  formatDateTime,
  formatRelativeTime,
  formatSize,
  formaterOctets,
  isInTrash,
  joinDataPath,
  openTab,
  persistTabs,
  safeAreaInsets,
  sortedEntries,
  state,
  typeDeFichier,
} = window.Allkin.core;
const ICON_FILE = window.Allkin.core.icons.file;
const ICON_FOLDER = window.Allkin.core.icons.folder;

/** Ouvre un fichier : dans l'éditeur de texte s'il est installé, en
 *  téléchargement sinon. */
function openFileTab(agentId, path, name) {
  const editor = window.Allkin.capability("text-editor");
  if (editor) editor.openFile(agentId, path, name);
  else window.open(dataFileUrl(agentId, path, true), "_blank");
}

// ---- Onglet Fichiers : l'espace data/ de l'agent ----
// Table triable ; clic sur un dossier -> navigation, clic sur un fichier ->
// ouverture dans son propre onglet, bouton dédié -> téléchargement.
// Le dossier courant est mémorisé sur l'onglet : y revenir rouvre le même.

const dataViewState = {
  agent: null,
  path: "",
  entries: [],
  sortKey: null,
  sortDir: 1,
  // Mode sélection (cases à cocher) : survit à la navigation entre dossiers
  // dans le même onglet Fichiers. La sélection elle-même, non — elle reste
  // bornée au dossier affiché, sinon des cases cochées « invisibles » dans un
  // autre dossier deviendraient déroutantes.
  selectMode: false,
  selected: new Set(),
};

// Nom du dossier corbeille — celui du serveur (agent-data.ts) : supprimer y
// déplace, et n'efface pour de bon qu'une fois dedans. Le libellé des
// confirmations en dépend, il ne doit pas mentir sur ce qui va se passer.
const TRASH_DIR_NAME = "Trash";

function openFilesTabView(tab) {
  const agent = state.agents.find((a) => a.id === tab.agentId);
  if (!agent) return;
  dataViewState.agent = agent;
  loadDataPath(tab.path ?? "");
}

function renderDataBreadcrumb() {
  const breadcrumbEl = el("data-breadcrumb");
  breadcrumbEl.innerHTML = "";
  const segments = dataViewState.path ? dataViewState.path.split("/") : [];

  const root = document.createElement("button");
  root.type = "button";
  root.className = "data-crumb";
  root.textContent = dataViewState.agent.name;
  root.addEventListener("click", () => loadDataPath(""));
  breadcrumbEl.appendChild(root);

  let acc = "";
  for (const segment of segments) {
    acc = acc ? `${acc}/${segment}` : segment;
    const sep = document.createElement("span");
    sep.className = "data-crumb-sep";
    sep.textContent = "/";
    breadcrumbEl.appendChild(sep);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "data-crumb";
    btn.textContent = segment;
    const target = acc;
    btn.addEventListener("click", () => loadDataPath(target));
    breadcrumbEl.appendChild(btn);
  }
}

// Contrôles de tri : en-têtes de colonnes sur grand écran, boutons de la
// barre de tri sur mobile. Même attribut data-sort-key des deux côtés, donc
// un seul sélecteur et une seule implémentation.
for (const control of document.querySelectorAll("#data-view [data-sort-key]")) {
  control.addEventListener("click", () => {
    const key = control.dataset.sortKey;
    if (dataViewState.sortKey === key) {
      dataViewState.sortDir *= -1;
    } else {
      dataViewState.sortKey = key;
      dataViewState.sortDir = 1;
    }
    renderDataTable();
  });
}

function updateSortIndicators() {
  for (const control of document.querySelectorAll("#data-view [data-sort-key]")) {
    control.classList.remove("sorted-asc", "sorted-desc");
    if (control.dataset.sortKey === dataViewState.sortKey) {
      control.classList.add(dataViewState.sortDir > 0 ? "sorted-asc" : "sorted-desc");
    }
  }
}

function renderDataTable() {
  updateSortIndicators();
  el("data-table").classList.toggle("select-mode", dataViewState.selectMode);
  const bodyEl = el("data-table-body");
  bodyEl.innerHTML = "";
  const agent = dataViewState.agent;
  const entries = sortedEntries(dataViewState);

  if (entries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "data-table-empty";
    cell.textContent = "Dossier vide.";
    row.appendChild(cell);
    bodyEl.appendChild(row);
    return;
  }

  const template = el("data-row-template");
  for (const entry of entries) {
    const node = template.content.cloneNode(true);
    const row = node.querySelector(".data-row");
    row.querySelector(".data-row-icon").innerHTML = entry.type === "dir" ? ICON_FOLDER : ICON_FILE;
    row.querySelector(".data-row-name-text").textContent = entry.name;
    row.querySelector(".data-row-size").textContent = entry.type === "dir" ? "—" : formatSize(entry.size);
    const createdCell = row.querySelector(".data-row-created");
    const modifiedCell = row.querySelector(".data-row-modified");
    createdCell.textContent = formatDateTime(entry.createdAt);
    createdCell.title = new Date(entry.createdAt).toLocaleString();
    modifiedCell.textContent = formatDateTime(entry.modifiedAt);
    modifiedCell.title = new Date(entry.modifiedAt).toLocaleString();

    const entryPath = joinDataPath(dataViewState.path, entry.name);

    const checkbox = row.querySelector(".data-row-checkbox");
    checkbox.checked = dataViewState.selected.has(entryPath);
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) dataViewState.selected.add(entryPath);
      else dataViewState.selected.delete(entryPath);
      updateDataMenuActionsState();
    });

    // En mode sélection, un clic sur la ligne coche/décoche plutôt que de
    // naviguer/ouvrir — la case elle-même gère déjà son propre clic ci-dessus.
    const toggleCheckboxInstead = (e) => {
      if (!dataViewState.selectMode || e.target.closest(".data-row-select")) return true;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
      return false;
    };

    const downloadBtn = row.querySelector(".data-row-download");
    if (entry.type === "dir") {
      downloadBtn.classList.add("hidden");
      row.addEventListener("click", (e) => {
        if (e.target.closest(".data-row-actions")) return;
        if (!toggleCheckboxInstead(e)) return;
        loadDataPath(entryPath);
      });
    } else {
      downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(dataFileUrl(agent.id, entryPath, true), "_blank");
      });
      row.addEventListener("click", (e) => {
        if (e.target.closest(".data-row-actions")) return;
        if (!toggleCheckboxInstead(e)) return;
        openFileTab(agent.id, entryPath, entry.name);
      });
    }

    // Le clic droit est traité par délégation sur `document` (voir plus bas) :
    // la ligne n'a qu'à dire QUI elle est. L'appui long, lui, reste posé ici —
    // le tactile n'a pas de clic droit.
    row.dataset.path = entryPath;
    bindLongPress(row, (touch) => openDataContextMenu(entry, entryPath, touch.clientX, touch.clientY));

    row.querySelector(".data-row-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      const message = isInTrash(entryPath)
        ? `Effacer définitivement « ${entry.name} » ? Cet élément est déjà dans la corbeille : il ne sera plus récupérable.`
        : `Mettre « ${entry.name} » à la corbeille (${TRASH_DIR_NAME}/) ?`;
      if (!confirm(message)) return;
      try {
        await api(`/api/agents/${agent.id}/data/file?path=${encodeURIComponent(entryPath)}`, { method: "DELETE" });
        loadDataPath(dataViewState.path);
      } catch (err) {
        el("data-error").textContent = err.message;
        el("data-error").classList.remove("hidden");
      }
    });

    bodyEl.appendChild(node);
  }
}

/* ---------- Dépôt d'un dossier depuis l'explorateur du système ----------

   OUI, C'EST POSSIBLE, ET SANS RIEN INSTALLER. Le navigateur ne rend pas un
   dossier : il rend des « entrées » qu'on parcourt soi-même
   (`webkitGetAsEntry`, disponible dans Chrome, Safari, Firefox et Edge). On
   descend l'arborescence, on en tire une liste plate de fichiers portant chacun
   son chemin d'origine, et le serveur la reconstruit (voir saveDataUpload).

   Deux limites à connaître, et à dire plutôt qu'à cacher :
     · le glisser-déposer ne donne accès qu'à ce qui est déposé, jamais au reste
       du disque — c'est le navigateur qui le garantit, pas nous ;
     · les liens symboliques et les permissions ne survivent pas. Ce qui arrive,
       ce sont des fichiers et des dossiers, rien d'autre.

   Le parcours est fait AVANT le premier envoi. C'est ce qui permet d'annoncer
   « 0 / 243 » dès la première seconde au lieu d'un compteur qui monte sans
   qu'on sache jusqu'où — et de renoncer avant d'avoir écrit quoi que ce soit si
   le dossier se révèle absurde. */

/**
 * Envoie les fichiers un par un, en montrant où l'on en est.
 *
 * Un par un, et en série : un dossier peut contenir des centaines de fichiers,
 * les envoyer ensemble obligerait à tout tenir en mémoire et ferait échouer le
 * lot entier pour un seul fichier fautif. Ici chacun réussit ou échoue seul,
 * la progression est exacte, et une interruption laisse ce qui est déjà passé.
 */
async function deposerFichiers(agentId, destination, fichiers, dossiersVides = []) {
  const node = el("upload-progress-template").content.cloneNode(true);
  document.body.appendChild(node);
  const modal = document.body.querySelector(".upload-modal-backdrop");
  const total = fichiers.reduce((n, f) => n + f.fichier.size, 0);
  modal.querySelector("#upload-modal-target").textContent =
    `${fichiers.length} fichier${fichiers.length > 1 ? "s" : ""} · ${formaterOctets(total)}` +
    (dossiersVides.length ? ` · ${dossiersVides.length} dossier${dossiersVides.length > 1 ? "s" : ""} vide${dossiersVides.length > 1 ? "s" : ""}` : "") +
    ` → ${destination ? `data/${destination}` : "data/"}`;

  const barre = modal.querySelector("#upload-progress-fill");
  const compte = modal.querySelector("#upload-progress-count");
  const courant = modal.querySelector("#upload-modal-current");
  const zoneErreurs = modal.querySelector("#upload-errors");

  let envoyes = 0;
  let octets = 0;
  const erreurs = [];

  for (const { chemin, fichier } of fichiers) {
    courant.textContent = chemin;
    compte.textContent = `${envoyes} / ${fichiers.length}`;
    barre.style.width = `${total ? Math.round((octets / total) * 100) : 0}%`;
    try {
      const corps = new FormData();
      corps.append("path", destination ? `${destination}/${chemin}` : chemin);
      corps.append("file", fichier, fichier.name);
      const rep = await fetch(`/api/agents/${agentId}/data/upload`, { method: "POST", body: corps });
      if (!rep.ok) {
        const detail = await rep.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${rep.status}`);
      }
    } catch (err) {
      erreurs.push(`${chemin} — ${err.message}`);
    }
    envoyes += 1;
    octets += fichier.size;
  }

  /* Les dossiers vides en dernier : les créer d'abord serait du travail perdu
     si le dépôt échoue, et ils ne conditionnent rien — l'écriture d'un fichier
     crée déjà ses parents. */
  for (const dossier of dossiersVides) {
    courant.textContent = `${dossier}/`;
    try {
      const rep = await fetch(`/api/agents/${agentId}/data/upload-dir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: destination ? `${destination}/${dossier}` : dossier }),
      });
      if (!rep.ok) {
        const detail = await rep.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${rep.status}`);
      }
    } catch (err) {
      erreurs.push(`${dossier}/ — ${err.message}`);
    }
  }

  barre.style.width = "100%";
  compte.textContent = `${envoyes} / ${fichiers.length}`;
  // Le titre suit : « Dépôt en cours » sur une fenêtre finie ferait attendre
  // quelque chose qui n'arrivera pas.
  modal.querySelector("#upload-modal-title").textContent = erreurs.length ? "Dépôt incomplet" : "Dépôt terminé";
  courant.textContent = erreurs.length
    ? `${fichiers.length - erreurs.length} déposé${fichiers.length - erreurs.length > 1 ? "s" : ""}, ${erreurs.length} en échec.`
    : "Terminé.";
  if (erreurs.length) {
    modal.querySelector(".update-progress")?.classList.add("is-error");
    zoneErreurs.classList.remove("hidden");
    zoneErreurs.replaceChildren(
      ...erreurs.map((e) => {
        const p = document.createElement("p");
        p.textContent = e;
        return p;
      })
    );
  }
  modal.querySelector("#upload-modal-actions").classList.remove("hidden");
  modal.querySelector(".modal-cancel").addEventListener("click", () => modal.remove());
  // Rien n'a été écrit hors de data/ : on recharge simplement le dossier ouvert.
  await loadDataPath(dataViewState.path);
}

/* ---- Le geste lui-même ----
   `dragenter`/`dragleave` se déclenchent aussi en passant d'un élément à
   l'autre À L'INTÉRIEUR de la vue : un simple booléen ferait clignoter le
   voile. On compte donc les entrées et les sorties. */
let profondeurGlisser = 0;

(() => {
  const vue = el("data-view");
  if (!vue) return;

  vue.addEventListener("dragenter", (e) => {
    if (!estUnDepotDeFichiers(e)) return;
    e.preventDefault();
    profondeurGlisser += 1;
    vue.classList.add("is-dropping");
    el("data-drop-veil-text").textContent = dataViewState.path
      ? `Déposer dans ${dataViewState.path}`
      : "Déposer dans data/";
  });
  vue.addEventListener("dragover", (e) => {
    if (!estUnDepotDeFichiers(e)) return;
    // Sans ce preventDefault, le navigateur ouvre le fichier à la place.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  vue.addEventListener("dragleave", () => {
    profondeurGlisser = Math.max(0, profondeurGlisser - 1);
    if (profondeurGlisser === 0) vue.classList.remove("is-dropping");
  });
  vue.addEventListener("drop", async (e) => {
    if (!estUnDepotDeFichiers(e)) return;
    e.preventDefault();
    profondeurGlisser = 0;
    vue.classList.remove("is-dropping");
    const agent = dataViewState.agent;
    if (!agent) return;

    // Le DataTransfer ne survit pas au premier `await` : on relève ce qu'il
    // contient tout de suite, avant tout parcours asynchrone.
    let depot;
    try {
      depot = await fichiersDeposes(e.dataTransfer);
    } catch (err) {
      el("data-error").textContent = `Lecture du dossier impossible : ${err.message}`;
      el("data-error").classList.remove("hidden");
      return;
    }
    if (depot.fichiers.length === 0 && depot.dossiers.length === 0) {
      el("data-error").textContent = "Rien à déposer.";
      el("data-error").classList.remove("hidden");
      return;
    }
    await deposerFichiers(agent.id, dataViewState.path, depot.fichiers, depot.dossiers);
  });
})();

/* ---------- Menu contextuel de l'explorateur ----------

   Les gestes d'un explorateur de bureau, parce que c'est ce qu'on essaie
   d'abord. Le menu ne crée aucune capacité nouvelle : tout ce qu'il propose
   existait déjà dans le menu ⋮ ou sur la ligne. Il les met là où la main les
   cherche.

   LE VOLUME, PUISQUE LA QUESTION SE POSE. Trois opérations peuvent porter sur
   des gigaoctets, et chacune a son traitement :

     · TÉLÉCHARGER — le serveur streame déjà l'archive ; c'est le navigateur
       qui la chargeait en mémoire. Un formulaire POST lui rend la main : il
       écrit sur le disque au fil de l'eau, avec sa propre progression, sans
       limite de taille (voir telechargerZip).

     · COPIER — `cpSync` figeait la boucle d'événements, donc le serveur entier
       et tous les agents avec lui. La copie est passée en asynchrone.

     · DÉPLACER, SUPPRIMER — un renommage, y compris vers la corbeille. Le coût
       ne dépend pas de la taille : rien à faire.

   Reste une limite assumée : une copie très longue n'affiche pas de
   progression. Le serveur ne sait pas dire où elle en est sans instrumenter
   `cp`, et l'opération ne bloque plus rien pendant ce temps. */

const dataClipboard = { mode: null, paths: [] };
let dataContextTarget = null;

function closeDataContextMenu() {
  el("data-context-menu")?.classList.add("hidden");
  dataContextTarget = null;
}

/** Ce sur quoi le menu agit : la sélection si l'élément visé en fait partie,
 *  l'élément seul sinon. C'est le comportement d'un explorateur — un clic droit
 *  hors sélection travaille sur ce qu'on vient de viser, pas sur ce qui restait
 *  coché ailleurs. */
function ciblesDuMenu() {
  if (!dataContextTarget) return [];
  const { chemin } = dataContextTarget;
  if (chemin === null) return [];
  return dataViewState.selected.has(chemin) ? [...dataViewState.selected] : [chemin];
}

/* Types de fichiers nommés en clair. Volontairement court : les extensions
   qu'on croise vraiment dans data/. Tout le reste retombe sur l'extension en
   capitales — « MD » vaut mieux qu'un « Fichier » qui n'apprend rien, et
   mentir sur un type qu'on ne connaît pas serait pire. */

/**
 * Remplit l'en-tête du menu : de quoi parle-t-on.
 *
 * Un fichier dit tout de lui-même — son type vient de son nom, sa taille est
 * déjà dans la liste. Un DOSSIER, non : sa taille et son contenu demandent un
 * parcours côté serveur. On affiche donc « Calcul… » puis on complète, plutôt
 * que de retarder l'ouverture du menu — un menu contextuel doit paraître
 * instantanément, c'est sa raison d'être.
 *
 * Le jeton `demande` protège du chevauchement : deux clics droits rapprochés
 * lanceraient deux parcours, et le plus lent écraserait le plus récent.
 */
let demandeStat = 0;

function renderDataContextHead(entry, chemin) {
  const tete = el("data-ctx-head");
  const sep = el("data-ctx-head-sep");
  const visible = Boolean(entry && chemin);
  tete.classList.toggle("hidden", !visible);
  sep.classList.toggle("hidden", !visible);
  if (!visible) return;

  const dossier = entry.type === "dir";
  el("data-ctx-head-icon").innerHTML = dossier ? ICON_FOLDER : ICON_FILE;
  el("data-ctx-head-name").textContent = entry.name;
  el("data-ctx-head-name").title = entry.name;
  const meta = el("data-ctx-head-meta");

  if (!dossier) {
    meta.textContent = `${typeDeFichier(entry.name)} · ${formatSize(entry.size)}`;
    return;
  }

  meta.textContent = "Calcul…";
  const jeton = ++demandeStat;
  void api(`/api/agents/${dataViewState.agent.id}/data/stat?path=${encodeURIComponent(chemin)}`)
    .then((s) => {
      if (jeton !== demandeStat) return;
      const elements = s.files + s.dirs;
      const nombre = `${s.partiel ? "plus de " : ""}${elements} élément${elements > 1 ? "s" : ""}`;
      meta.textContent = `${nombre} · ${formatSize(s.bytes)}${s.partiel ? " au moins" : ""}`;
    })
    .catch(() => {
      if (jeton === demandeStat) meta.textContent = "Dossier";
    });
}

function openDataContextMenu(entry, chemin, x, y) {
  window.getSelection?.()?.removeAllRanges?.();
  closeTabContextMenu?.();
  dataContextTarget = { entry, chemin };
  renderDataContextHead(entry, chemin);
  const menu = el("data-context-menu");
  const cibles = ciblesDuMenu();
  const plusieurs = cibles.length > 1;
  const surUnElement = chemin !== null;
  const dansCorbeille = surUnElement && isInTrash(chemin);

  // Un clic dans le vide ne vise rien : seules restent les créations et le
  // collage. Les griser plutôt que les cacher garde le menu stable d'un clic à
  // l'autre — un menu dont les entrées se déplacent se manipule mal.
  el("data-ctx-open").disabled = !surUnElement || plusieurs;
  el("data-ctx-download").disabled = !surUnElement;
  el("data-ctx-copy").disabled = !surUnElement;
  el("data-ctx-cut").disabled = !surUnElement || dansCorbeille;
  el("data-ctx-rename").disabled = !surUnElement || plusieurs;
  el("data-ctx-delete").disabled = !surUnElement;
  el("data-ctx-paste").disabled = dataClipboard.paths.length === 0;
  el("data-ctx-archive").disabled = !surUnElement;
  el("data-ctx-archive-label").textContent = plusieurs ? `Archiver (${cibles.length})` : "Archiver";
  /* « Désarchiver » n'apparaît que sur une archive, et sur une seule : cachée
     plutôt que grisée, parce qu'elle n'a de sens nulle part ailleurs — un menu
     ne doit pas exhiber en permanence ce qui ne servira presque jamais. */
  el("data-ctx-extract").classList.toggle(
    "hidden",
    plusieurs || !surUnElement || entry?.type === "dir" || !estUneArchive(entry?.name ?? "")
  );

  /* « Exécuter » suit la même règle : sur un script, un seul, et pas dans la
     corbeille — lancer ce qu'on vient de jeter n'est jamais ce qu'on voulait. */
  el("data-ctx-run").classList.toggle(
    "hidden",
    plusieurs || !surUnElement || dansCorbeille || entry?.type === "dir" || !estUnScript(entry?.name ?? "")
  );

  el("data-ctx-download-label").textContent = plusieurs ? `Télécharger (${cibles.length})` : "Télécharger";
  el("data-ctx-delete-label").textContent = dansCorbeille
    ? "Effacer définitivement"
    : plusieurs
      ? `Mettre à la corbeille (${cibles.length})`
      : "Mettre à la corbeille";
  el("data-ctx-paste-label").textContent = dataClipboard.paths.length
    ? `Coller (${dataClipboard.paths.length})`
    : "Coller";

  // Même placement que le menu d'un onglet : hors écran d'abord pour connaître
  // sa taille, puis recalé dans les bords sûrs.
  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.classList.remove("hidden");
  const rect = menu.getBoundingClientRect();
  const safe = safeAreaInsets();
  const left = Math.min(x, window.innerWidth - rect.width - 8 - safe.right);
  const top = Math.min(y, window.innerHeight - rect.height - 8 - safe.bottom);
  menu.style.left = `${Math.max(8 + safe.left, left)}px`;
  menu.style.top = `${Math.max(8 + safe.top, top)}px`;
}

/* FERMETURE SUR `pointerdown`, ET NON SUR `click`. Deux raisons, mesurées.

   L'ordre des événements d'un clic droit est
   `pointerdown → mousedown → contextmenu → mouseup`, sans aucun `click` sous
   Chromium. Mais Safari sur macOS, lui, émet bien un `click` après un
   ctrl+clic : la fermeture arrivait alors APRÈS l'ouverture, le menu
   apparaissait et disparaissait aussitôt, et il fallait recommencer. C'est le
   « parfois il faut cliquer deux fois ». Sur `pointerdown`, l'ordre est
   toujours « on ferme, puis on ouvre » — quel que soit le navigateur et le
   geste (deux doigts, ctrl+clic, souris).

   Et c'est plus vif : le menu se ferme au moment où l'on appuie, pas quand on
   relâche. */
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#data-context-menu")) closeDataContextMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDataContextMenu();
});

/* UN SEUL ÉCOUTEUR, SUR `document`. Il était posé sur #data-view, en pariant
   que toute la surface de l'explorateur lui appartient. Le pari est fragile :
   il suffit d'une zone que je n'avais pas prévue — un en-tête, une marge, un
   élément ajouté plus tard — pour que le navigateur affiche SON menu à la
   place. Ici, plus aucun pixel n'est oublié.

   Deux exceptions, volontaires : les champs de saisie gardent le menu natif —
   on y a besoin de « Coller » — et les autres menus de l'application gardent
   le leur. */
document.addEventListener("contextmenu", (e) => {
  if (state.view !== "files") return;
  if (e.target.closest("input, textarea, [contenteditable='true']")) return;
  if (e.target.closest("#data-context-menu, #tab-context-menu, .chat-menu, .modal")) return;

  e.preventDefault();
  const ligne = e.target.closest(".data-row");
  // La ligne porte son chemin : plus besoin d'un écouteur par ligne, qui se
  // reposait à chaque rendu du tableau.
  if (ligne?.dataset.path) {
    const entry = dataViewState.entries.find((x) => joinDataPath(dataViewState.path, x.name) === ligne.dataset.path);
    openDataContextMenu(entry ?? null, ligne.dataset.path, e.clientX, e.clientY);
  } else {
    openDataContextMenu(null, null, e.clientX, e.clientY);
  }
});

el("data-ctx-open").addEventListener("click", () => {
  const cible = dataContextTarget;
  closeDataContextMenu();
  if (!cible?.entry) return;
  if (cible.entry.type === "dir") loadDataPath(cible.chemin);
  else openFileTab(dataViewState.agent.id, cible.chemin, cible.entry.name);
});

el("data-ctx-download").addEventListener("click", () => {
  const cibles = ciblesDuMenu();
  const entry = dataContextTarget?.entry;
  closeDataContextMenu();
  if (cibles.length === 0) return;
  // Un fichier seul part par son URL : le navigateur le streame, et on évite
  // de zipper ce qui n'a pas besoin de l'être.
  if (cibles.length === 1 && entry?.type !== "dir") {
    window.open(dataFileUrl(dataViewState.agent.id, cibles[0], true), "_blank");
    return;
  }
  telechargerZip(dataViewState.agent.id, cibles);
});

for (const [id, mode] of [["data-ctx-copy", "copy"], ["data-ctx-cut", "move"]]) {
  el(id).addEventListener("click", () => {
    const cibles = ciblesDuMenu();
    closeDataContextMenu();
    if (cibles.length === 0) return;
    dataClipboard.mode = mode;
    dataClipboard.paths = cibles;
    appendDataNote(
      `${cibles.length} élément${cibles.length > 1 ? "s" : ""} ${mode === "copy" ? "copié" : "coupé"}${cibles.length > 1 ? "s" : ""}. Colle-les où tu veux.`
    );
  });
}

el("data-ctx-paste").addEventListener("click", async () => {
  closeDataContextMenu();
  const agent = dataViewState.agent;
  if (!agent || dataClipboard.paths.length === 0) return;
  const destination = dataViewState.path;
  const erreurs = [];
  for (const source of dataClipboard.paths) {
    const nom = source.split("/").pop();
    const cible = destination ? `${destination}/${nom}` : nom;
    if (cible === source) {
      erreurs.push(`${nom} — déjà ici`);
      continue;
    }
    // Coller un dossier dans lui-même produirait une descente infinie : le
    // système de fichiers ne s'en protège pas, nous si.
    if (destination === source || destination.startsWith(`${source}/`)) {
      erreurs.push(`${nom} — on ne colle pas un dossier dans lui-même`);
      continue;
    }
    try {
      await api(`/api/agents/${agent.id}/data/${dataClipboard.mode}`, {
        method: "POST",
        body: JSON.stringify({ from: source, to: cible }),
      });
    } catch (err) {
      erreurs.push(`${nom} — ${err.message}`);
    }
  }
  // Un « couper » ne se colle qu'une fois : les sources n'existent plus.
  if (dataClipboard.mode === "move") dataClipboard.paths = [];
  if (erreurs.length) {
    el("data-error").textContent = erreurs.join(" · ");
    el("data-error").classList.remove("hidden");
  }
  await loadDataPath(dataViewState.path);
});

el("data-ctx-rename").addEventListener("click", async () => {
  const cible = dataContextTarget;
  closeDataContextMenu();
  if (!cible?.entry) return;
  const nom = prompt("Nouveau nom :", cible.entry.name);
  if (!nom || nom === cible.entry.name) return;
  const parent = cible.chemin.includes("/") ? cible.chemin.slice(0, cible.chemin.lastIndexOf("/")) : "";
  try {
    await api(`/api/agents/${dataViewState.agent.id}/data/move`, {
      method: "POST",
      body: JSON.stringify({ from: cible.chemin, to: parent ? `${parent}/${nom}` : nom }),
    });
    await loadDataPath(dataViewState.path);
  } catch (err) {
    el("data-error").textContent = err.message;
    el("data-error").classList.remove("hidden");
  }
});

el("data-ctx-archive").addEventListener("click", async () => {
  const cibles = ciblesDuMenu();
  closeDataContextMenu();
  if (cibles.length === 0) return;

  const node = el("archive-format-template").content.cloneNode(true);
  document.body.appendChild(node);
  const modal = document.body.querySelector(".modal-backdrop:last-of-type");
  const fermer = () => modal.remove();
  modal.querySelector(".modal-cancel").addEventListener("click", fermer);
  modal.addEventListener("mousedown", (e) => {
    if (e.target === modal) fermer();
  });
  modal.querySelector("#archive-modal-target").textContent =
    cibles.length === 1 ? cibles[0] : `${cibles.length} éléments`;

  // La liste vient du serveur : lui seul sait ce qu'il peut produire.
  let formats = [{ value: "zip", label: "ZIP", description: "" }];
  try {
    formats = (await api("/api/archive-formats")).formats ?? formats;
  } catch {
    // Liste minimale : mieux vaut proposer le zip que rien du tout.
  }
  /* Construit à la main plutôt qu'en réutilisant `.option-row` : cette rangée-là
     est faite pour un libellé à gauche et une commande à droite, et un bouton
     radio n'a ni la largeur ni le poids d'un champ. Le résultat s'empilait. */
  const liste = modal.querySelector("#archive-format-list");
  liste.replaceChildren();
  for (const [i, f] of formats.entries()) {
    const rangee = document.createElement("label");
    rangee.className = "archive-format";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "archiveFormat";
    radio.value = f.value;
    radio.checked = i === 0;
    const texte = document.createElement("span");
    texte.className = "archive-format-text";
    const nom = document.createElement("span");
    nom.className = "archive-format-name";
    nom.textContent = f.label;
    const note = document.createElement("span");
    note.className = "archive-format-note";
    note.textContent = f.description ?? "";
    texte.append(nom, note);
    rangee.append(radio, texte);
    liste.appendChild(rangee);
  }

  modal.querySelector("#archive-modal-go").addEventListener("click", async (e) => {
    const bouton = e.currentTarget;
    const format = modal.querySelector('input[name="archiveFormat"]:checked')?.value ?? "zip";
    bouton.disabled = true;
    bouton.textContent = "Création…";
    try {
      const { path } = await api(`/api/agents/${dataViewState.agent.id}/data/archive`, {
        method: "POST",
        body: JSON.stringify({ paths: cibles, destination: dataViewState.path, format }),
      });
      fermer();
      await loadDataPath(dataViewState.path);
      appendDataNote(`Archive créée : ${path}`);
    } catch (err) {
      const zone = modal.querySelector("#archive-modal-error");
      zone.textContent = err.message;
      zone.classList.remove("hidden");
      bouton.disabled = false;
      bouton.textContent = "Créer l'archive";
    }
  });
});

el("data-ctx-extract").addEventListener("click", async () => {
  const cible = dataContextTarget;
  closeDataContextMenu();
  if (!cible?.chemin) return;
  appendDataNote(`Extraction de ${cible.entry?.name ?? cible.chemin}…`);
  try {
    const r = await api(`/api/agents/${dataViewState.agent.id}/data/extract`, {
      method: "POST",
      body: JSON.stringify({ path: cible.chemin }),
    });
    await loadDataPath(dataViewState.path);
    appendDataNote(`${r.files} fichier${r.files > 1 ? "s" : ""} extrait${r.files > 1 ? "s" : ""} dans ${r.path}/`);
  } catch (err) {
    el("data-error").textContent = err.message;
    el("data-error").classList.remove("hidden");
  }
});

/* ---- Exécuter un script ---------------------------------------------------

   QUI EXÉCUTE : l'utilisateur, avec les droits du serveur Allkin. Ce n'est pas
   une action d'agent et ça ne dépend d'aucun droit d'agent — l'explorateur est
   un gestionnaire de fichiers, et un gestionnaire de fichiers lance ce qu'on
   lui demande de lancer.

   CE QUI TIENT LIEU DE GARDE-FOU : le contenu, montré avant. Répondre oui à
   « rapport.sh » ne veut rien dire ; répondre oui à ce qu'on vient de lire, si.

   POURQUOI PAS LE DOUBLE-CLIC : partout ailleurs il veut dire « ouvrir », et
   on double-clique pour REGARDER. En faire le geste d'exécution met un
   lancement à un clic mal visé. Il ouvre donc le script dans l'éditeur, comme
   pour n'importe quel fichier, et l'exécution reste un geste délibéré. */

el("data-ctx-run").addEventListener("click", () => {
  const cible = dataContextTarget;
  closeDataContextMenu();
  if (!cible?.chemin || !cible.entry) return;
  void ouvrirExecutionScript(dataViewState.agent.id, cible.chemin, cible.entry.name);
});

async function ouvrirExecutionScript(agentId, chemin, nom) {
  const node = el("script-run-template").content.cloneNode(true);
  document.body.appendChild(node);
  const modal = document.body.querySelector(".script-run-backdrop");
  const q = (id) => modal.querySelector(`#${id}`);

  q("script-run-name").textContent = nom;
  q("script-run-meta").textContent = `data/${chemin}`;
  const dossier = chemin.includes("/") ? `data/${chemin.slice(0, chemin.lastIndexOf("/"))}` : "data/";
  q("script-run-warn").textContent =
    `S'exécutera dans ${dossier}, avec les droits du serveur Allkin. Fermer cette fenêtre arrête le script.`;

  /** L'exécution en cours, s'il y en a une. Sert à l'arrêt comme au ménage. */
  let controleur = null;
  let runId = null;
  let termine = false;

  const fermer = () => {
    // Couper le flux suffit : le serveur tue le processus quand la connexion
    // tombe (voir la route /data/run). L'appel explicite est la ceinture — le
    // navigateur peut mettre du temps à propager l'abandon.
    if (!termine && runId) {
      void fetch(`/api/agents/${agentId}/data/run/${runId}/stop`, { method: "POST" }).catch(() => {});
    }
    controleur?.abort();
    modal.remove();
    document.removeEventListener("keydown", surEchap);
  };
  const surEchap = (e) => { if (e.key === "Escape") fermer(); };
  document.addEventListener("keydown", surEchap);
  q("script-run-cancel").addEventListener("click", fermer);
  modal.addEventListener("mousedown", (e) => { if (e.target === modal) fermer(); });

  /* ---- Temps 1 : montrer le script ---- */
  const source = q("script-run-source");
  const bouton = q("script-run-go");
  bouton.disabled = true;
  source.textContent = "Lecture…";
  try {
    const rep = await fetch(dataFileUrl(agentId, chemin));
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    const texte = await rep.text();
    /* Coloré par le même moteur que l'éditeur : un script se lit mieux ainsi,
       et c'est sur cette lecture que repose la décision. La langue se déduit du
       NOM — highlight.js est indexé sur « sh », pas sur « bash », et lui passer
       l'extension brute rendrait du texte nu sans que rien ne le signale. */
    const langue = window.languageForFilename?.(nom);
    source.innerHTML = langue && window.highlightCode ? window.highlightCode(texte, langue) : "";
    if (!source.innerHTML) source.textContent = texte;
    bouton.disabled = false;
  } catch (err) {
    source.textContent = `Impossible de lire ce fichier : ${err.message}`;
    return;
  }

  /* ---- Temps 2 : lancer et suivre ---- */
  bouton.addEventListener("click", async () => {
    q("script-run-confirm").classList.add("hidden");
    q("script-run-live").classList.remove("hidden");
    bouton.classList.add("hidden");
    q("script-run-stop").classList.remove("hidden");
    q("script-run-cancel").textContent = "Fermer";
    q("script-run-state").textContent = "en cours";
    q("script-run-state").className = "script-run-state running";

    const console_ = q("script-run-console");
    const debut = Date.now();
    controleur = new AbortController();

    /* Le DOM est borné, comme la sortie l'est côté serveur : un script qui
       écrit des dizaines de milliers de lignes ferait ramer l'onglet bien
       avant d'atteindre le plafond d'octets. On garde la fin, qui est ce
       qu'on regarde. */
    const MAX_MORCEAUX = 2000;
    const ajouter = (flux, texte) => {
      const colle = console_.scrollTop + console_.clientHeight >= console_.scrollHeight - 30;
      const span = document.createElement("span");
      if (flux === "err") span.className = "script-run-err";
      span.textContent = texte;
      console_.appendChild(span);
      while (console_.childNodes.length > MAX_MORCEAUX) console_.removeChild(console_.firstChild);
      // Ne suit que si on était déjà en bas : sinon relire plus haut pendant
      // que ça défile serait impossible.
      if (colle) console_.scrollTop = console_.scrollHeight;
    };

    const finir = (libelle, classe) => {
      termine = true;
      q("script-run-state").textContent = libelle;
      q("script-run-state").className = `script-run-state ${classe}`;
      q("script-run-stop").classList.add("hidden");
      q("script-run-cancel").textContent = "Fermer";
    };

    try {
      const rep = await fetch(`/api/agents/${agentId}/data/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: chemin }),
        signal: controleur.signal,
      });
      if (!rep.ok) {
        const detail = await rep.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${rep.status}`);
      }

      /* NDJSON : une ligne par événement. Un morceau reçu peut couper une
         ligne en deux, d'où le tampon — sans lui, un JSON.parse échouerait au
         hasard du découpage réseau. */
      const lecteur = rep.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const lignes = tampon.split("\n");
        tampon = lignes.pop();
        for (const ligne of lignes) {
          if (!ligne) continue;
          let evt;
          try { evt = JSON.parse(ligne); } catch { continue; }
          if (evt.type === "start") {
            runId = evt.runId;
            // Ce qui tourne réellement, une fois le shebang lu côté serveur.
            q("script-run-meta").textContent = `${evt.argv.join(" ")} · dans ${evt.cwd} · ${evt.utilisateur}`;
            q("script-run-meta").title = q("script-run-meta").textContent;
          } else if (evt.type === "out" || evt.type === "err") {
            ajouter(evt.type, evt.texte);
          } else if (evt.type === "end") {
            const secondes = ((evt.dureeMs ?? Date.now() - debut) / 1000).toFixed(1);
            if (evt.cause === "arret") finir(`arrêté · ${secondes} s`, "stopped");
            else if (evt.exitCode === 0) finir(`terminé · ${secondes} s`, "ok");
            else finir(`code ${evt.exitCode ?? "?"} · ${secondes} s`, "fail");
          }
        }
      }
      // Flux coupé sans « end » : le dire plutôt que de laisser « en cours »
      // éternellement, ce qui ferait croire à un script encore vivant.
      if (!termine) finir("interrompu", "fail");
    } catch (err) {
      if (err.name !== "AbortError") {
        ajouter("err", `\n[Allkin] ${err.message}`);
        finir("échec", "fail");
      }
    }
  });

  q("script-run-stop").addEventListener("click", async () => {
    q("script-run-stop").disabled = true;
    q("script-run-stop").textContent = "Arrêt…";
    if (runId) await fetch(`/api/agents/${agentId}/data/run/${runId}/stop`, { method: "POST" }).catch(() => {});
  });
}

el("data-ctx-new-file").addEventListener("click", () => {
  closeDataContextMenu();
  el("file-new-btn").click();
});
el("data-ctx-new-dir").addEventListener("click", () => {
  closeDataContextMenu();
  el("folder-new-btn").click();
});

el("data-ctx-delete").addEventListener("click", async () => {
  const cibles = ciblesDuMenu();
  closeDataContextMenu();
  if (cibles.length === 0) return;
  const definitif = cibles.every((c) => isInTrash(c));
  const message = definitif
    ? `Effacer définitivement ${cibles.length} élément${cibles.length > 1 ? "s" : ""} ? Ils sont déjà dans la corbeille : ce sera irréversible.`
    : `Mettre ${cibles.length} élément${cibles.length > 1 ? "s" : ""} à la corbeille (${TRASH_DIR_NAME}/) ?`;
  if (!confirm(message)) return;
  try {
    await api(`/api/agents/${dataViewState.agent.id}/data/delete-many`, {
      method: "POST",
      body: JSON.stringify({ paths: cibles }),
    });
    await loadDataPath(dataViewState.path);
  } catch (err) {
    el("data-error").textContent = err.message;
    el("data-error").classList.remove("hidden");
  }
});

/** Message passager sous l'en-tête de l'explorateur. Le champ d'erreur sert
 *  aussi de champ d'information : une seule place à regarder. */
function appendDataNote(texte) {
  const zone = el("data-error");
  zone.textContent = texte;
  zone.classList.remove("hidden");
  setTimeout(() => {
    if (zone.textContent === texte) zone.classList.add("hidden");
  }, 4000);
}

async function loadDataPath(path) {
  const agent = dataViewState.agent;
  if (!agent) return;
  el("data-error").classList.add("hidden");
  try {
    const { entries } = await api(`/api/agents/${agent.id}/data?path=${encodeURIComponent(path)}`);
    dataViewState.path = path;
    dataViewState.entries = entries;
    // Bornée au dossier affiché — voir le commentaire sur dataViewState.selected.
    dataViewState.selected.clear();
    // Mémorisé sur l'onglet : revenir aux fichiers rouvre le dossier quitté.
    const tab = findTab(agent.id, "files");
    if (tab) {
      tab.path = path;
      persistTabs();
    }
    renderDataBreadcrumb();
    renderDataTable();
    updateDataMenuActionsState();
    applyScroll();
  } catch (err) {
    el("data-error").textContent = err.message;
    el("data-error").classList.remove("hidden");
  }
}

// ---- Menu ⋮ de l'explorateur : sélection et actions en masse ----

// Recalcule l'état (activé/désactivé) des trois actions groupées, à chaque
// changement de sélection et à chaque ouverture du menu sur cette vue.
function updateDataMenuActionsState() {
  const hasSelection = dataViewState.selected.size > 0;
  el("data-delete-selected-btn").disabled = !hasSelection;
  el("data-move-selected-btn").disabled = !hasSelection;
  el("data-download-selected-btn").disabled = !hasSelection;
  // « Vider la corbeille » n'a de sens que dans la corbeille : ailleurs, le
  // bouton disparaît plutôt que de rester grisé sans qu'on sache pourquoi.
  el("data-empty-trash-btn").classList.toggle("hidden", !isInTrash(dataViewState.path));
}

el("data-empty-trash-btn").addEventListener("click", async () => {
  closeChatMenu();
  if (!confirm("Vider la corbeille ?\n\nTout ce qu'elle contient sera effacé définitivement.")) return;
  try {
    await api(`/api/agents/${dataViewState.agent.id}/data/trash/empty`, { method: "POST" });
    await loadDataPath(dataViewState.path);
  } catch (err) {
    el("data-error").textContent = err.message;
    el("data-error").classList.remove("hidden");
  }
});

el("data-select-checkbox").addEventListener("change", (e) => {
  dataViewState.selectMode = e.target.checked;
  if (!dataViewState.selectMode) dataViewState.selected.clear();
  renderDataTable();
  updateDataMenuActionsState();
});

el("file-new-btn").addEventListener("click", () => {
  closeChatMenu();
  openDataNameDialog({
    title: "Nouveau fichier",
    label: "Nom du fichier",
    placeholder: "notes.md",
    submitLabel: "Créer",
    onSubmit: async (name) => {
      const fileName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.md`;
      const path = joinDataPath(dataViewState.path, fileName);
      await api(`/api/agents/${dataViewState.agent.id}/data/file?path=${encodeURIComponent(path)}`, {
        method: "PUT",
        body: JSON.stringify({ content: "" }),
      });
      await loadDataPath(dataViewState.path);
    },
  });
});

el("folder-new-btn").addEventListener("click", () => {
  closeChatMenu();
  openDataNameDialog({
    title: "Nouveau dossier",
    label: "Nom du dossier",
    placeholder: "notes",
    submitLabel: "Créer",
    onSubmit: async (name) => {
      const path = joinDataPath(dataViewState.path, name);
      await api(`/api/agents/${dataViewState.agent.id}/data/mkdir`, {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      await loadDataPath(dataViewState.path);
    },
  });
});

/**
 * Boîte de dialogue générique à un champ texte — nom de fichier ou de
 * dossier. `onSubmit(name)` peut lever une erreur (message affiché dans la
 * modale) ; sinon la modale se referme.
 */
function openDataNameDialog({ title, label, placeholder, submitLabel, onSubmit }) {
  const template = el("data-name-dialog-template");
  const node = template.content.cloneNode(true);
  document.body.appendChild(node);
  const modalEl = document.body.querySelector(".modal-backdrop");
  const form = modalEl.querySelector("form");
  const input = modalEl.querySelector("#data-name-dialog-input");
  const errorEl = modalEl.querySelector("#data-name-dialog-error");

  modalEl.querySelector("#data-name-dialog-title").textContent = title;
  modalEl.querySelector("#data-name-dialog-label").textContent = label;
  input.placeholder = placeholder;
  modalEl.querySelector("#data-name-dialog-submit").textContent = submitLabel;
  modalEl.querySelector(".modal-cancel").addEventListener("click", () => modalEl.remove());
  setTimeout(() => input.focus(), 0);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    errorEl.classList.add("hidden");
    if (!name) return;
    try {
      await onSubmit(name);
      modalEl.remove();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });
}

el("data-delete-selected-btn").addEventListener("click", async () => {
  closeChatMenu();
  const paths = [...dataViewState.selected];
  if (paths.length === 0) return;
  const count = `${paths.length} élément${paths.length > 1 ? "s" : ""}`;
  const message = isInTrash(dataViewState.path)
    ? `Effacer définitivement ${count} ? Ces éléments sont déjà dans la corbeille : ils ne seront plus récupérables.`
    : `Mettre ${count} à la corbeille (${TRASH_DIR_NAME}/) ?`;
  if (!confirm(message)) return;
  try {
    const { errors } = await api(`/api/agents/${dataViewState.agent.id}/data/delete-many`, {
      method: "POST",
      body: JSON.stringify({ paths }),
    });
    await loadDataPath(dataViewState.path);
    const failed = Object.keys(errors ?? {});
    if (failed.length > 0) {
      el("data-error").textContent = `Non supprimé(s) : ${failed.join(", ")}.`;
      el("data-error").classList.remove("hidden");
    }
  } catch (err) {
    el("data-error").textContent = err.message;
    el("data-error").classList.remove("hidden");
  }
});

el("data-download-selected-btn").addEventListener("click", async () => {
  closeChatMenu();
  const agent = dataViewState.agent;
  const paths = [...dataViewState.selected];
  if (paths.length === 0) return;
  if (paths.length === 1) {
    window.open(dataFileUrl(agent.id, paths[0], true), "_blank");
    return;
  }
  telechargerZip(agent.id, paths);
});

/**
 * Télécharge plusieurs éléments en une archive.
 *
 * Par un FORMULAIRE, et non par fetch : `await res.blob()` chargeait l'archive
 * entière dans la mémoire de l'onglet avant de l'enregistrer. Sur un dossier de
 * quelques gigaoctets, l'onglet mourait — et le serveur, lui, streamait
 * pourtant déjà correctement (voir la route /data/zip, qui pipe l'archive dans
 * la réponse). Tout le gâchis était côté navigateur.
 *
 * Un formulaire POST rend la main au navigateur : il écrit le flux sur le
 * disque au fur et à mesure, affiche sa propre progression, et ne garde rien en
 * mémoire. Aucune limite de taille, et rien à écrire pour l'obtenir.
 */
function telechargerZip(agentId, paths) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `/api/agents/${encodeURIComponent(agentId)}/data/zip`;
  // Le navigateur ne poste pas de JSON : la route accepte donc aussi
  // l'encodage de formulaire, un champ `paths` par élément.
  form.enctype = "application/x-www-form-urlencoded";
  form.style.display = "none";
  for (const p of paths) {
    const champ = document.createElement("input");
    champ.type = "hidden";
    champ.name = "paths";
    champ.value = p;
    form.appendChild(champ);
  }

  /* Cible : une iframe cachée, et non « _blank ».

     Avec _blank, un dépôt qui échoue ouvre un onglet blanc portant le JSON
     d'erreur — l'utilisateur voit surgir puis disparaître une fenêtre sans
     savoir ce qui s'est passé. Dans une iframe, la réponse d'erreur reste
     invisible, et le téléchargement, lui, se déclenche pareil : c'est
     l'en-tête Content-Disposition qui le décide, pas la cible.

     L'iframe et le formulaire sont retirés APRÈS un tour de boucle. Les
     retirer dans la foulée du submit() interrompt l'envoi dans certains
     navigateurs — la requête n'a pas encore quitté le document. */
  const cadre = document.createElement("iframe");
  cadre.name = `dl-${Date.now().toString(36)}`;
  cadre.style.display = "none";
  document.body.appendChild(cadre);
  form.target = cadre.name;

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => {
    form.remove();
    // L'iframe survit plus longtemps : elle porte le flux jusqu'au bout.
    setTimeout(() => cadre.remove(), 60_000);
  }, 0);
}

el("data-move-selected-btn").addEventListener("click", () => {
  closeChatMenu();
  if (dataViewState.selected.size > 0) openDataMoveDialog();
});

/**
 * Sélecteur de dossier de destination pour Copier/Déplacer — navigation
 * indépendante de l'explorateur principal (son propre `pickerPath`), mais
 * réutilise la même route de listing, filtrée sur les dossiers.
 */
function openDataMoveDialog() {
  const agent = dataViewState.agent;
  const sourcePaths = [...dataViewState.selected];
  let pickerPath = dataViewState.path;

  const template = el("data-move-dialog-template");
  const node = template.content.cloneNode(true);
  document.body.appendChild(node);
  const modalEl = document.body.querySelector(".modal-backdrop");
  const breadcrumbEl = modalEl.querySelector("#data-move-breadcrumb");
  const listEl = modalEl.querySelector("#data-move-list");
  const errorEl = modalEl.querySelector("#data-move-error");
  modalEl.querySelector("#data-move-source-label").textContent =
    sourcePaths.length === 1 ? `Déplacer/copier « ${sourcePaths[0]} »` : `Déplacer/copier ${sourcePaths.length} éléments`;
  modalEl.querySelector(".modal-cancel").addEventListener("click", () => modalEl.remove());

  async function renderPicker() {
    errorEl.classList.add("hidden");
    breadcrumbEl.innerHTML = "";
    const segments = pickerPath ? pickerPath.split("/") : [];
    const rootBtn = document.createElement("button");
    rootBtn.type = "button";
    rootBtn.className = "data-crumb";
    rootBtn.textContent = agent.name;
    rootBtn.addEventListener("click", () => {
      pickerPath = "";
      renderPicker();
    });
    breadcrumbEl.appendChild(rootBtn);
    let acc = "";
    for (const segment of segments) {
      acc = joinDataPath(acc, segment);
      const target = acc;
      const sep = document.createElement("span");
      sep.className = "data-crumb-sep";
      sep.textContent = "/";
      breadcrumbEl.appendChild(sep);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "data-crumb";
      btn.textContent = segment;
      btn.addEventListener("click", () => {
        pickerPath = target;
        renderPicker();
      });
      breadcrumbEl.appendChild(btn);
    }

    listEl.innerHTML = "";
    try {
      const { entries } = await api(`/api/agents/${agent.id}/data?path=${encodeURIComponent(pickerPath)}`);
      const dirs = entries.filter((e) => e.type === "dir");
      if (dirs.length === 0) {
        const empty = document.createElement("p");
        empty.className = "dim";
        empty.textContent = "Aucun sous-dossier ici.";
        listEl.appendChild(empty);
      }
      for (const dir of dirs) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "data-move-dir-row";
        row.innerHTML = `${ICON_FOLDER}<span>${dir.name}</span>`;
        row.addEventListener("click", () => {
          pickerPath = joinDataPath(pickerPath, dir.name);
          renderPicker();
        });
        listEl.appendChild(row);
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  }

  async function runOnSelection(apiPath) {
    errorEl.classList.add("hidden");
    try {
      await Promise.all(
        sourcePaths.map((from) =>
          api(`/api/agents/${agent.id}/data/${apiPath}`, {
            method: "POST",
            body: JSON.stringify({ from, to: joinDataPath(pickerPath, from.split("/").pop()) }),
          })
        )
      );
      modalEl.remove();
      dataViewState.selected.clear();
      await loadDataPath(dataViewState.path);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  }

  modalEl.querySelector("#data-move-copy-btn").addEventListener("click", () => runOnSelection("copy"));
  modalEl.querySelector("#data-move-move-btn").addEventListener("click", () => runOnSelection("move"));

  renderPicker();
}


/* ---- Explorateur de ~/.allkin ---------------------------------------------
   Une fenêtre sur le dossier d'installation, en lecture seule : on regarde ce
   qu'Allkin a écrit sur le disque (agents, sessions, sauvegardes, données),
   on ne le modifie pas d'ici. Les fichiers d'un agent se modifient dans son
   onglet Fichiers, la configuration dans Paramètres — c'est là que se trouvent
   les garde-fous. Voir server/allkin-fs.ts côté serveur.

   Le chemin courant vit sur l'onglet (tab.path) et non dans une variable
   globale : il est ainsi conservé au rechargement de la page, comme celui de
   l'explorateur d'un agent. */

function openExplorerView() {
  openTab(null, "explorer");
}

function explorerTab() {
  const tab = activeTab();
  return tab?.kind === "explorer" ? tab : null;
}

async function loadExplorerPath(path) {
  const tab = explorerTab();
  if (tab) tab.path = path;
  const errorEl = el("explorer-error");
  errorEl.classList.add("hidden");
  renderExplorerBreadcrumb(path);
  try {
    const { entries } = await api(`/api/allkin/fs?path=${encodeURIComponent(path)}`);
    renderExplorerEntries(path, entries);
    persistTabs();
    applyScroll();
  } catch (err) {
    el("explorer-body").innerHTML = "";
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  }
}

function renderExplorerBreadcrumb(path) {
  const bar = el("explorer-breadcrumb");
  bar.innerHTML = "";
  const crumb = (label, target) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "data-crumb";
    btn.textContent = label;
    btn.addEventListener("click", () => loadExplorerPath(target));
    bar.appendChild(btn);
  };
  crumb("~/.allkin", "");
  let acc = "";
  for (const segment of path ? path.split("/") : []) {
    acc = acc ? `${acc}/${segment}` : segment;
    const sep = document.createElement("span");
    sep.className = "data-crumb-sep";
    sep.textContent = "/";
    bar.appendChild(sep);
    crumb(segment, acc);
  }
}

function renderExplorerEntries(path, entries) {
  const body = el("explorer-body");
  body.innerHTML = "";

  // Remonter d'un cran : une ligne plutôt qu'un bouton à part, pour que le
  // geste soit au même endroit que les dossiers eux-mêmes.
  if (path) {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    body.appendChild(explorerRow({ name: "..", type: "dir" }, () => loadExplorerPath(parent)));
  }

  if (entries.length === 0 && !path) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "data-table-empty dim";
    cell.textContent = "Dossier vide.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  for (const entry of entries) {
    const target = path ? `${path}/${entry.name}` : entry.name;
    body.appendChild(
      explorerRow(entry, () => {
        if (entry.type === "dir") loadExplorerPath(target);
        // Un fichier s'ouvre dans un onglet du navigateur : l'aperçu est celui
        // du navigateur lui-même (texte, image, PDF), et il n'y a rien à
        // enregistrer puisque tout est en lecture seule ici.
        else window.open(`/api/allkin/fs/file?path=${encodeURIComponent(target)}`, "_blank", "noopener");
      }),
    );
  }
}

const EXPLORER_ICONS = {
  dir: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
  file: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></svg>',
};

function explorerRow(entry, onOpen) {
  const row = document.createElement("tr");
  row.className = "data-row explorer-row";

  const nameCell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "explorer-name";
  const icon = document.createElement("span");
  icon.className = "explorer-icon";
  icon.innerHTML = EXPLORER_ICONS[entry.type];
  const label = document.createElement("span");
  label.className = "explorer-label";
  label.textContent = entry.name;
  button.append(icon, label);
  button.addEventListener("click", onOpen);
  nameCell.appendChild(button);

  const sizeCell = document.createElement("td");
  sizeCell.className = "explorer-col-size";
  sizeCell.textContent = entry.type === "dir" ? "—" : formatSize(entry.size);

  const dateCell = document.createElement("td");
  dateCell.className = "explorer-col-date";
  if (entry.modifiedAt) {
    dateCell.textContent = formatRelativeTime(entry.modifiedAt);
    dateCell.title = new Date(entry.modifiedAt).toLocaleString();
  }

  row.append(nameCell, sizeCell, dateCell);
  return row;
}


window.Allkin.registerTabKind("files", {
  panels: ["data-view"],
  icon: ICON_FOLDER,
  // L'onglet porte le nom de l'agent : avoir les fichiers de plusieurs agents
  // ouverts reste lisible, l'icône dit la nature de l'onglet.
  label: (tab) => window.Allkin.core.agentName(tab.agentId),
  meta: "Fichiers",
  tooltip: (tab, label) => `Fichiers — ${label}`,
  scroller: () => document.querySelector("#data-view .data-table-wrap"),
  activate: (tab) => openFilesTabView(tab),
  menu: { title: "Options des fichiers", onShow: updateDataMenuActionsState },
});

window.Allkin.registerTabKind("explorer", {
  panels: ["explorer-view"],
  icon: '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
  label: () => "Explorateur",
  scroller: () => document.querySelector("#explorer-view .explorer-table-wrap"),
  activate: (tab) => loadExplorerPath(tab.path ?? ""),
});

window.Allkin.provide("file-explorer", {
  openAgentFiles: (agentId) => openTab(agentId, "files"),
  openAllkinExplorer: () => openTab(null, "explorer"),
});

})();
