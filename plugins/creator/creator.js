"use strict";
/* ============================================================================
   Creator — the plugin workshop.
   ----------------------------------------------------------------------------
   One global tab: the workbench of a project (a plugin or a service) written
   in the Creator agent's workspace, which Allkin reads as a local repository.

     · the state of the project and the actions that test it: check against
       the standard, install into this Allkin, drive its service;
     · directives: buttons that send the agent a message about the project;
     · three panes — Check (the issues), Files, Debug (the service's log and
       the errors of the page).

   The conversation itself is Allkin's own, shown on the right of the page:
   the workbench only sends messages to it (Allkin.core.sendToAgent).

   Server side, everything is in the core: /api/repos (the repository),
   /api/repos/:id/projects (list, skeleton, check), /api/plugins (install,
   service). See PLUGIN-STANDARD.md and SERVICE-STANDARD.md for what is checked.
   ========================================================================== */
(() => {
const Allkin = window.Allkin;
const core = Allkin.core;
const { api, el } = core;
const t = Allkin.t;
const tn = Allkin.tn;

const KIND = "creator";
const PLUGIN_ID = "creator";
const AGENT_ID = "plugin-creator";
const STORE_KEY = "allkin.creator.project";
const REFRESH_MS = 4000;
/** A file changed less than this ago is shown as fresh: the agent just wrote it. */
const FRESH_MS = 90_000;

const ICON =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 00-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 005.2-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z"/></svg>';

const st = {
  active: false,
  /** The repository of the plugin (its agent's workspace), or null: not ready. */
  repo: null,
  projects: [],
  /** { kind, id } of the project shown. */
  current: null,
  /** { project, issues, files, path } of the project shown. */
  detail: null,
  /** The installed copy of the plugin shown (GET /api/plugins/:id), or null. */
  installed: null,
  pane: "check",
  timer: null,
  /** What was last drawn, to redraw only on a change. */
  drawn: "",
  splitOpened: false,
};

/* ---- Errors of the page -----------------------------------------------------
   Kept from the moment this script loads: an interface plugin being written
   fails in the browser, where its author would otherwise have to open the
   developer tools. The source address names the plugin at fault. */
const pageErrors = [];
function notePageError(message, source, line) {
  const plugin = /\/api\/plugins\/([a-z0-9-]+)\/ui\//.exec(source || "")?.[1] ?? null;
  pageErrors.push({ at: Date.now(), message: String(message || "").slice(0, 600), source: source || "", line: line || 0, plugin });
  if (pageErrors.length > 200) pageErrors.shift();
  if (st.active) renderDebug();
}
window.addEventListener("error", (e) => notePageError(e.message, e.filename, e.lineno));
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  const stack = typeof reason?.stack === "string" ? reason.stack : "";
  notePageError(reason?.message ?? String(reason), /https?:\/\/\S+?\/api\/plugins\/[a-z0-9-]+\/ui\/[^\s:)]+/.exec(stack)?.[0] ?? "", 0);
});

const remember = (value) => {
  try {
    if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* Private window: the choice is simply not kept. */
  }
};
const remembered = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch {
    return null;
  }
};

const node = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};
const pill = (text, tone) => node("span", `cr-pill${tone ? ` cr-pill--${tone}` : ""}`, text);
const projectUrl = (p) => `/api/repos/${encodeURIComponent(st.repo.id)}/projects/${p.kind}/${encodeURIComponent(p.id)}`;
const sameProject = (a, b) => Boolean(a && b && a.kind === b.kind && a.id === b.id);
const tone = (p) => (p.errors > 0 ? "bad" : p.warnings > 0 ? "warn" : "");

/* ---- Loading ---------------------------------------------------------------- */

async function load({ quiet = false } = {}) {
  try {
    const { repos } = await api("/api/repos");
    st.repo = (repos ?? []).find((r) => r.plugin === PLUGIN_ID) ?? null;
    if (!st.repo) {
      st.projects = [];
      st.current = st.detail = st.installed = null;
      return render();
    }
    st.projects = (await api(`/api/repos/${encodeURIComponent(st.repo.id)}/projects`)).projects ?? [];
    if (!st.projects.some((p) => sameProject(p, st.current))) {
      const kept = remembered();
      st.current = st.projects.find((p) => sameProject(p, kept)) ?? st.projects[0] ?? null;
      st.current = st.current && { kind: st.current.kind, id: st.current.id };
    }
    await loadDetail();
  } catch (err) {
    if (!quiet) core.toast(err.message, "ko");
  }
  render();
}

async function loadDetail() {
  st.detail = null;
  st.installed = null;
  if (!st.current) return;
  st.detail = await api(projectUrl(st.current));
  if (st.current.kind === "plugin" && st.detail.project?.installedVersion) {
    st.installed = await api(`/api/plugins/${encodeURIComponent(st.current.id)}`)
      .then((d) => d.plugin ?? null)
      .catch(() => null);
  }
}

function select(project) {
  st.current = project && { kind: project.kind, id: project.id };
  remember(st.current);
  st.drawn = "";
  void load();
}

/* ---- Messages to the agent ---------------------------------------------------- */

function showConversation() {
  core.openSplit?.(AGENT_ID, "chat");
}

/** Sends the agent a message about the project shown. The first line names
 *  the project and the kind of message — see agent.md, which reads it. */
async function tell(tag, body) {
  if (!st.current || !st.detail) return;
  const head = `[Creator · project ${st.detail.path}]` + (tag ? `\n[Creator · ${tag}]` : "");
  try {
    await core.sendToAgent(AGENT_ID, `${head}\n${body}`);
    showConversation();
    core.toast(t("plugin.creator.sent"));
  } catch (err) {
    core.toast(err.message, "ko");
  }
}

const issueLines = () =>
  (st.detail?.issues ?? []).map((i) => `- ${i.level.toUpperCase()}${i.file ? ` (${i.file})` : ""}: ${i.detail}`).join("\n");

function debugText() {
  const lines = [];
  const log = (st.installed?.log ?? "").trim();
  if (log) lines.push("Service log (last lines):", ...log.split("\n").slice(-80));
  const errors = currentErrors();
  if (errors.length) {
    lines.push("", "Errors of the page:");
    for (const e of errors.slice(-30)) lines.push(`- ${e.message}${e.source ? ` (${e.source.replace(/^https?:\/\/[^/]+/, "")}${e.line ? `:${e.line}` : ""})` : ""}`);
  }
  return lines.join("\n");
}

const DIRECTIVES = [
  { key: "fix", show: () => (st.detail?.issues ?? []).length > 0, run: () => tell("check", `${issueLines()}\n\n${t("plugin.creator.directive.fix.text")}`) },
  { key: "translate", run: () => tell("", t("plugin.creator.directive.translate.text")) },
  { key: "document", run: () => tell("", t("plugin.creator.directive.document.text")) },
  { key: "review", run: () => tell("", t("plugin.creator.directive.review.text")) },
  { key: "explain", run: () => tell("", t("plugin.creator.directive.explain.text")) },
];

/* ---- Actions ------------------------------------------------------------------ */

async function withBusy(button, work) {
  button.classList.add("is-busy");
  try {
    await work();
  } catch (err) {
    core.toast(err.message, "ko");
  } finally {
    button.classList.remove("is-busy");
  }
}

async function install() {
  const id = st.current.id;
  const result = await api(`/api/plugins/${encodeURIComponent(id)}/install`, { method: "POST", body: JSON.stringify({ repo: st.repo.id }) });
  core.toast(t("plugin.creator.installed", { version: result.version }));
  await load({ quiet: true });
  const pending = st.installed?.pendingPermissions ?? 0;
  if (pending > 0) core.toast(tn("plugin.creator.rightsPending", pending));
  else if (st.detail?.project?.parts.ui) core.toast(t("plugin.creator.reloadNeeded"));
}

async function serviceAction(action) {
  await api(`/api/plugins/${encodeURIComponent(st.current.id)}/service/${action}`, { method: "POST" });
  st.pane = "debug";
  await load({ quiet: true });
}

function actionButton(label, onClick, { main = false, disabled = false, title = "" } = {}) {
  const button = node("button", `cr-btn${main ? " cr-btn-main" : ""}`, label);
  button.type = "button";
  button.disabled = disabled;
  if (title) button.title = title;
  button.addEventListener("click", () => void withBusy(button, onClick));
  return button;
}

/* ---- Rendering ------------------------------------------------------------------ */

function render() {
  const signature = JSON.stringify([st.repo?.id, st.projects, st.current, st.detail, st.installed?.status, st.installed?.log, st.installed?.pendingPermissions, st.pane, pageErrors.length]);
  if (signature === st.drawn) return;
  st.drawn = signature;

  el("cr-notready").classList.toggle("hidden", Boolean(st.repo));
  el("cr-empty").classList.toggle("hidden", !st.repo || Boolean(st.current));
  el("cr-project").classList.toggle("hidden", !st.repo || !st.current || !st.detail);
  el("cr-new-btn").disabled = !st.repo;
  el("cr-picker-btn").disabled = !st.repo;
  el("cr-chat-btn").disabled = !st.repo;

  const shown = st.projects.find((p) => sameProject(p, st.current));
  el("cr-picker-label").textContent = shown ? shown.name : t("plugin.creator.picker.none");
  renderPicker();
  if (!st.repo || !st.current || !st.detail) return;
  renderStatus();
  renderActions();
  renderDirectives();
  renderPanes();
}

function renderPicker() {
  const menu = el("cr-picker-menu");
  menu.replaceChildren();
  if (st.projects.length === 0) {
    menu.appendChild(node("div", "cr-picker-empty", t("plugin.creator.picker.empty")));
    return;
  }
  for (const kind of ["plugin", "service"]) {
    const list = st.projects.filter((p) => p.kind === kind);
    if (!list.length) continue;
    menu.appendChild(node("div", "cr-picker-heading", t(`plugin.creator.kind.${kind}s`)));
    for (const p of list) {
      const item = node("button", "cr-picker-item");
      item.type = "button";
      item.setAttribute("role", "option");
      item.classList.toggle("is-current", sameProject(p, st.current));
      const dot = node("span", `cr-dot${tone(p) ? ` cr-dot--${tone(p)}` : ""}`);
      item.append(dot, node("span", "cr-picker-item-name", p.name), node("span", "cr-picker-item-id", p.id));
      item.addEventListener("click", () => {
        closePicker();
        select(p);
      });
      menu.appendChild(item);
    }
  }
}

function closePicker() {
  el("cr-picker-menu").classList.add("hidden");
  el("cr-picker-btn").setAttribute("aria-expanded", "false");
}

function renderStatus() {
  const p = st.detail.project;
  const box = el("cr-status");
  box.replaceChildren();
  box.append(node("span", "cr-status-name", p.name), pill(t(`plugin.creator.kind.${p.kind}`), "info"), node("span", "cr-mono", st.detail.path));
  if (p.version) box.appendChild(pill(`v${p.version}`));
  if (p.kind === "plugin") {
    if (!p.installedVersion) box.appendChild(pill(t("plugin.creator.state.notInstalled")));
    else if (p.installedVersion === p.version) box.appendChild(pill(t("plugin.creator.state.installed"), "ok"));
    else box.appendChild(pill(t("plugin.creator.state.installedOther", { version: p.installedVersion }), "warn"));
    const state = st.installed?.status?.state;
    if (p.parts.service && state) box.appendChild(pill(t("plugin.creator.service.state", { state }), state === "running" ? "ok" : state === "failed" ? "bad" : ""));
  }
  if (p.errors > 0) box.appendChild(pill(tn("plugin.creator.errors", p.errors), "bad"));
  if (p.warnings > 0) box.appendChild(pill(tn("plugin.creator.warnings", p.warnings), "warn"));
  if (p.errors === 0 && p.warnings === 0) box.appendChild(pill(t("plugin.creator.conformant"), "ok"));
}

function renderActions() {
  const p = st.detail.project;
  const box = el("cr-actions");
  box.replaceChildren();
  box.appendChild(
    actionButton(t("plugin.creator.action.check"), async () => {
      st.pane = "check";
      st.drawn = "";
      await load();
      core.toast(p.errors || p.warnings ? t("plugin.creator.checked.issues") : t("plugin.creator.checked.ok"), p.errors ? "ko" : "ok");
    }),
  );
  if (p.kind === "service") {
    // A service needs no install: valid, it is already in the catalogue.
    box.appendChild(actionButton(t("plugin.creator.action.services"), () => core.openServicesView?.(), { main: p.errors === 0, disabled: p.errors > 0 }));
    return;
  }
  const installed = Boolean(p.installedVersion);
  box.appendChild(
    actionButton(installed ? t("plugin.creator.action.update") : t("plugin.creator.action.install"), install, {
      main: true,
      disabled: p.errors > 0,
      title: p.errors > 0 ? t("plugin.creator.action.install.blocked") : "",
    }),
  );
  if (!installed) return;
  box.appendChild(actionButton(t("plugin.creator.action.page"), () => core.openPluginPage?.(p.id)));
  if (p.parts.service) {
    box.appendChild(node("span", "cr-actions-sep"));
    const state = st.installed?.status?.state;
    const running = state === "running" || state === "restarting";
    if (running) {
      box.appendChild(actionButton(t("plugin.creator.action.restart"), () => serviceAction("restart")));
      box.appendChild(actionButton(t("plugin.creator.action.stop"), () => serviceAction("stop")));
    } else box.appendChild(actionButton(t("plugin.creator.action.start"), () => serviceAction("start")));
  }
  if (p.parts.ui) {
    box.appendChild(node("span", "cr-actions-sep"));
    box.appendChild(actionButton(t("plugin.creator.action.reload"), () => window.location.reload(), { title: t("plugin.creator.action.reload.title") }));
  }
}

function renderDirectives() {
  const box = el("cr-directives");
  box.replaceChildren();
  for (const d of DIRECTIVES) {
    if (d.show && !d.show()) continue;
    const chip = node("button", "cr-chip", t(`plugin.creator.directive.${d.key}`));
    chip.type = "button";
    chip.addEventListener("click", () => void withBusy(chip, d.run));
    box.appendChild(chip);
  }
}

function currentErrors() {
  // Those of the plugin shown; an error whose source is unknown may be its too.
  return pageErrors.filter((e) => e.plugin === st.current?.id || (!e.plugin && !e.source));
}

function renderPanes() {
  for (const tab of document.querySelectorAll("#cr-view .cr-tab")) {
    const active = tab.dataset.crPane === st.pane;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const pane of ["check", "files", "debug"]) el(`cr-pane-${pane}`).classList.toggle("hidden", pane !== st.pane);

  const p = st.detail.project;
  const count = el("cr-check-count");
  count.classList.toggle("hidden", p.errors + p.warnings === 0);
  count.classList.toggle("cr-tab-count--warn", p.errors === 0);
  count.textContent = String(p.errors || p.warnings);
  el("cr-files-count").classList.toggle("hidden", st.detail.files.length === 0);
  el("cr-files-count").textContent = String(st.detail.files.length);

  renderCheck();
  renderFiles();
  renderDebug();
}

function renderCheck() {
  const box = el("cr-pane-check");
  box.replaceChildren();
  const issues = st.detail.issues;
  if (issues.length === 0) {
    box.appendChild(node("div", "cr-check-ok", t("plugin.creator.check.ok")));
    return;
  }
  const head = node("div", "cr-check-head", t("plugin.creator.check.intro"));
  box.appendChild(head);
  const list = node("ul", "cr-issues");
  // Errors first: they are what blocks the install.
  for (const i of [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1))) {
    const item = node("li", "cr-issue");
    const text = node("div", "cr-issue-text", i.message);
    if (i.file) text.appendChild(node("span", "cr-issue-file cr-mono", i.file));
    item.append(node("span", `cr-dot cr-dot--${i.level === "error" ? "bad" : "warn"}`), text);
    list.appendChild(item);
  }
  box.appendChild(list);
}

function openFile(path) {
  const editor = Allkin.capability("text-editor");
  const full = `${st.detail.path}/${path}`;
  if (editor?.openFile) editor.openFile(AGENT_ID, full, path.split("/").pop());
  else core.toast(t("plugin.creator.files.noEditor"), "ko");
}

function renderFiles() {
  const box = el("cr-pane-files");
  box.replaceChildren();
  if (st.detail.files.length === 0) {
    box.appendChild(node("p", "cr-quiet", t("plugin.creator.files.none")));
    return;
  }
  const table = node("table", "cr-files");
  const now = Date.now();
  for (const f of st.detail.files) {
    const tr = node("tr", now - Date.parse(f.modifiedAt) < FRESH_MS ? "cr-files-fresh" : "");
    tr.tabIndex = 0;
    tr.append(node("td", "cr-files-path", f.path), node("td", "cr-files-meta", core.formatSize(f.size)), node("td", "cr-files-meta", core.formatRelativeTime(f.modifiedAt)));
    tr.addEventListener("click", () => openFile(f.path));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openFile(f.path);
    });
    table.appendChild(tr);
  }
  box.appendChild(table);
}

function renderDebug() {
  if (!st.detail || !el("cr-debug-state")) return;
  const p = st.detail.project;
  const errors = currentErrors();
  const count = el("cr-debug-count");
  count.classList.toggle("hidden", errors.length === 0);
  count.textContent = String(errors.length);

  let state;
  if (p.kind === "service") state = t("plugin.creator.debug.serviceKind");
  else if (!p.installedVersion) state = t("plugin.creator.debug.notInstalled");
  else if (!p.parts.service) state = t("plugin.creator.debug.noService");
  else {
    const s = st.installed?.status ?? {};
    state = t("plugin.creator.service.state", { state: s.state ?? "?" }) + (s.lastError ? ` — ${s.lastError}` : "");
  }
  el("cr-debug-state").textContent = state;

  const log = el("cr-log");
  const text = (st.installed?.log ?? "").trimEnd();
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
  log.textContent = text || t("plugin.creator.debug.log.none");
  if (atBottom) log.scrollTop = log.scrollHeight;

  const list = el("cr-errors");
  list.replaceChildren();
  if (errors.length === 0) list.appendChild(node("p", "cr-quiet", t("plugin.creator.debug.errors.none")));
  for (const e of errors.slice(-50).reverse()) {
    const row = node("div", "cr-error", e.message);
    if (e.source) row.appendChild(node("span", "cr-error-where", `${e.source.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "")}${e.line ? `:${e.line}` : ""}`));
    list.appendChild(row);
  }
  const nothing = !text && errors.length === 0;
  el("cr-log-send").disabled = nothing;
  el("cr-log-copy").disabled = nothing;
}

/* ---- New project -------------------------------------------------------------- */

const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

function openNewDialog(kind = "plugin") {
  if (!st.repo || document.querySelector(".cr-new")) return;
  const root = el("cr-new-template").content.cloneNode(true).querySelector(".modal-backdrop");
  Allkin.i18n.apply(root);
  document.body.appendChild(root);
  const form = root.querySelector("form");
  const name = root.querySelector(".cr-new-name");
  const id = root.querySelector(".cr-new-id");
  const brief = root.querySelector(".cr-new-brief");
  let chosen = kind;
  let idTouched = false;

  const paint = () => {
    for (const b of root.querySelectorAll(".cr-seg-btn")) b.classList.toggle("is-active", b.dataset.crKind === chosen);
    root.querySelector(".cr-new-hint").textContent = t(`plugin.creator.new.hint.${chosen}`);
  };
  const close = () => {
    root.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  for (const b of root.querySelectorAll(".cr-seg-btn")) {
    b.addEventListener("click", () => {
      chosen = b.dataset.crKind;
      paint();
    });
  }
  name.addEventListener("input", () => {
    if (!idTouched) id.value = slug(name.value);
  });
  id.addEventListener("input", () => {
    idTouched = true;
  });
  root.querySelector(".modal-cancel").addEventListener("click", close);
  root.addEventListener("click", (e) => {
    if (e.target === root) close();
  });
  document.addEventListener("keydown", onKey);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const { project } = await api(`/api/repos/${encodeURIComponent(st.repo.id)}/projects`, {
        method: "POST",
        body: JSON.stringify({ kind: chosen, id: id.value.trim(), name: name.value.trim(), description: brief.value.trim().split("\n")[0] }),
      });
      close();
      st.current = { kind: project.kind, id: project.id };
      remember(st.current);
      st.drawn = "";
      await load();
      core.toast(t("plugin.creator.created", { name: project.name }));
      // The agent starts from the skeleton and the brief.
      const what = t(`plugin.creator.new.tell.${project.kind}`, { name: project.name });
      await tell("", brief.value.trim() ? `${what}\n\n${brief.value.trim()}` : what);
    } catch (err) {
      core.toast(err.message, "ko");
      submit.disabled = false;
    }
  });
  paint();
  requestAnimationFrame(() => name.focus());
}

/* ---- Wiring --------------------------------------------------------------------- */

function wire() {
  if (wire.done) return;
  wire.done = true;
  el("cr-picker-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = el("cr-picker-menu");
    const open = menu.classList.toggle("hidden") === false;
    el("cr-picker-btn").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.(".cr-picker")) closePicker();
  });
  el("cr-new-btn").addEventListener("click", () => openNewDialog("plugin"));
  for (const b of document.querySelectorAll("#cr-view [data-cr-new]")) b.addEventListener("click", () => openNewDialog(b.dataset.crNew));
  el("cr-chat-btn").addEventListener("click", showConversation);
  el("cr-rights-btn").addEventListener("click", () => core.openPluginPage?.(PLUGIN_ID));
  for (const tab of document.querySelectorAll("#cr-view .cr-tab")) {
    tab.addEventListener("click", () => {
      st.pane = tab.dataset.crPane;
      st.drawn = "";
      render();
    });
  }
  el("cr-log-send").addEventListener("click", () => void tell("log", `${debugText()}\n\n${t("plugin.creator.directive.log.text")}`));
  el("cr-log-copy").addEventListener("click", () => void core.copyToClipboard(el("cr-log-copy"), debugText()));
}

function activate() {
  wire();
  st.active = true;
  st.drawn = "";
  void load().then(() => {
    // The conversation comes with the workbench, once: the user may fold it.
    if (st.repo && !st.splitOpened) {
      st.splitOpened = true;
      showConversation();
    }
  });
  clearInterval(st.timer);
  // The agent writes while the user watches: the workbench follows.
  st.timer = setInterval(() => {
    if (st.active && document.visibilityState === "visible" && !document.querySelector(".cr-new")) void load({ quiet: true });
  }, REFRESH_MS);
}

function leave() {
  st.active = false;
  clearInterval(st.timer);
  st.timer = null;
  closePicker();
}

const open = () => core.openTab(null, KIND);

Allkin.registerTabKind(KIND, {
  panels: ["cr-view"],
  icon: ICON,
  label: () => "Creator",
  meta: t("plugin.creator.app.meta"),
  tooltip: () => t("plugin.creator.app.tooltip"),
  activate,
  leave,
});

Allkin.provide("creator", { open });

if (typeof Allkin.registerApp === "function") {
  Allkin.registerApp({
    key: "creator",
    name: "Creator",
    meta: t("plugin.creator.app.meta"),
    icon: ICON.replace('stroke="currentColor"', 'stroke="#f59e0b"'),
    open,
  });
}
})();
