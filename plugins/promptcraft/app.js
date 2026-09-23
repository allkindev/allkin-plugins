"use strict";
/* ============================================================================
   PromptCraft — l'interface : l'onglet, ses trois volets, le banc d'essai,
   le téléchargement .allkin et le déploiement.
   ----------------------------------------------------------------------------
   Ne dépend que de window.Allkin (et des bibliothèques globales d'Allkin :
   renderMarkdown), plus des routes HTTP publiques du cœur :

     POST   /api/agents                      créer le banc d'essai
     PUT    /api/agents/:id/claude-md        y poser le prompt à éprouver
     PATCH  /api/agents/:id                  y poser le modèle
     POST   /api/agents/:id/sessions         ouvrir une conversation neuve
     DELETE /api/agents/:id/sessions/:sid    ranger la précédente (historique)
     WS     /ws?agentId=…&sessionId=…        converser
     POST   /api/agents/import               déployer (l'archive .allkin)
     POST   /api/prompt/generate             affiner le prompt avec le modèle

   Le projet vit dans le localStorage de ce navigateur, enregistré à chaque
   frappe. Le .allkin, qui l'embarque, sert à le transporter ailleurs.
   ========================================================================== */
(() => {
const Allkin = window.Allkin;
const { api, el, escapeHtml, openTab, activeTab, copyToClipboard, state: core } = Allkin.core;
const { TRAIT_GROUPS, SKILL_GROUPS, SKILL_LEVELS, SECTIONS, ARCHETYPES, defaultProject } = window.PromptCraftSchema;
const Compiler = window.PromptCraftCompiler;
const { createZip, readZip } = window.PromptCraftZip;

const KIND = "promptcraft";
const STORE_PROJECT = "promptcraft.project";
const STORE_UI = "promptcraft.ui";
const STORE_BENCH = "promptcraft.bench";
const BENCH_NAME = "PromptCraft essai";

const ICON =
  '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';

/* ---- Stockage ---------------------------------------------------------------
   Le localStorage peut être plein, désactivé ou illisible : rien de tout cela
   ne doit empêcher l'atelier de s'ouvrir. */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota plein ou stockage refusé : l'atelier continue, sans mémoire.
  }
}

/** Un projet lu d'ailleurs (stockage, fichier) est complété par les défauts :
 *  un réglage ajouté dans une version ultérieure ne doit pas manquer. */
function normalize(raw) {
  const base = defaultProject();
  if (!raw || typeof raw !== "object") return base;
  const project = { ...base, ...raw };
  project.traits = { ...base.traits, ...(raw.traits ?? {}) };
  project.skills = { ...base.skills, ...(raw.skills ?? {}) };
  project.examples = Array.isArray(raw.examples) ? raw.examples.filter((e) => e && typeof e === "object") : [];
  project.starters = Array.isArray(raw.starters) ? raw.starters.filter((s) => typeof s === "string") : [];
  return project;
}

let project = normalize(load(STORE_PROJECT, null));
const ui = { pane: "settings", section: "identity", promptMode: "source", ...load(STORE_UI, {}) };
let saveTimer = null;

function saveProject() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store(STORE_PROJECT, project), 250);
}
function saveUi() {
  store(STORE_UI, { pane: ui.pane, section: ui.section, promptMode: ui.promptMode });
}

/* ---- Prompt courant ---------------------------------------------------------
   Généré depuis les réglages, sauf s'il a été retouché à la main (ou affiné
   par le modèle) : il ne suit alors plus les réglages, et l'interface le dit. */
function compiledPrompt() {
  return Compiler.compile(project);
}
function currentPrompt() {
  return typeof project.manualPrompt === "string" ? project.manualPrompt : compiledPrompt();
}

/** Empreinte courte d'un texte : sert à savoir si le prompt éprouvé est
 *  toujours celui qu'on regarde. */
function fingerprint(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
function benchSignature() {
  return fingerprint(`${currentPrompt()}|${project.model}|${project.effort}|${project.thinking}`);
}

function slugify(text) {
  return (
    String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "agent"
  );
}

/* ============================================================================
   Volet 1 — Paramètres
   ========================================================================== */

function buildForm() {
  const form = el("pc-form");
  const nav = el("pc-nav");
  form.innerHTML = "";
  nav.innerHTML = "";

  for (const section of SECTIONS) {
    const navBtn = document.createElement("button");
    navBtn.type = "button";
    navBtn.className = "pc-nav-item";
    navBtn.dataset.pcSection = section.id;
    navBtn.innerHTML = `<span class="pc-nav-emoji">${section.emoji}</span><span>${escapeHtml(section.title)}</span><span class="pc-nav-count" data-pc-count="${section.id}"></span>`;
    navBtn.addEventListener("click", () => goToSection(section.id));
    nav.appendChild(navBtn);

    const box = document.createElement("section");
    box.className = "pc-section";
    box.id = `pc-sec-${section.id}`;
    box.innerHTML = `<div class="pc-section-head"><h3>${section.emoji} ${escapeHtml(section.title)}</h3></div><p class="pc-section-intro">${escapeHtml(section.intro)}</p>`;
    const fields = document.createElement("div");
    fields.className = "pc-fields";
    for (const field of section.fields) {
      const node = renderField(field);
      if (node) fields.appendChild(node);
    }
    box.appendChild(fields);
    form.appendChild(box);
  }
  highlightNav(ui.section);
  refreshDerived();
}

/** Une modification d'un réglage : enregistrée, puis tout ce qui en dépend. */
function setValue(key, value) {
  project[key] = value;
  saveProject();
  refreshDerived();
}

function fieldShell(field, { wide = field.wide } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `pc-field${wide ? " is-wide" : ""}`;
  if (field.label) {
    const label = document.createElement("div");
    label.className = "pc-label";
    label.textContent = field.label;
    wrap.appendChild(label);
  }
  return wrap;
}
function help(text) {
  const p = document.createElement("div");
  p.className = "pc-help";
  p.textContent = text;
  return p;
}

function renderField(field) {
  switch (field.type) {
    case "text":
    case "textarea":
      return renderText(field);
    case "select":
      return renderSelect(field);
    case "seg":
      return renderSeg(field);
    case "toggle":
      return renderToggle(field);
    case "traits":
      return renderTraits();
    case "skills":
      return renderSkills();
    case "examples":
      return renderExamples(field);
    case "list":
      return renderList(field);
    case "archetypes":
      return renderArchetypePicker(field);
    case "model":
      return renderModel(field);
    default:
      return null;
  }
}

function renderText(field) {
  const wrap = fieldShell(field);
  const input = document.createElement(field.type === "textarea" ? "textarea" : "input");
  if (field.type === "text") input.type = "text";
  if (field.rows) input.rows = field.rows;
  input.placeholder = field.placeholder ?? "";
  input.value = project[field.key] ?? "";
  input.id = `pc-f-${field.key}`;
  const label = wrap.querySelector(".pc-label");
  let counter = null;
  if (field.max) {
    counter = document.createElement("span");
    counter.className = "pc-label-count";
    label.appendChild(counter);
  }
  const paint = () => {
    if (!counter) return;
    const n = input.value.trim().length;
    counter.textContent = `${n}/${field.max}`;
    input.classList.toggle("is-over", n > field.max);
  };
  input.addEventListener("input", () => {
    paint();
    setValue(field.key, input.value);
  });
  paint();
  wrap.appendChild(input);
  if (field.help) wrap.appendChild(help(field.help));
  return wrap;
}

function renderSelect(field) {
  const wrap = fieldShell(field);
  const select = document.createElement("select");
  for (const option of field.options) {
    const o = document.createElement("option");
    o.value = option.v;
    o.textContent = option.l;
    select.appendChild(o);
  }
  select.value = project[field.key];
  select.addEventListener("change", () => setValue(field.key, select.value));
  wrap.appendChild(select);
  if (field.help) wrap.appendChild(help(field.help));
  return wrap;
}

function segControl(options, current, onPick) {
  const group = document.createElement("div");
  group.className = "pc-seg";
  group.setAttribute("role", "group");
  for (const option of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pc-seg-btn";
    btn.textContent = option.l;
    if (option.s) btn.title = option.s;
    btn.classList.toggle("is-on", option.v === current);
    btn.setAttribute("aria-pressed", String(option.v === current));
    btn.addEventListener("click", () => {
      for (const other of group.children) {
        other.classList.toggle("is-on", other === btn);
        other.setAttribute("aria-pressed", String(other === btn));
      }
      onPick(option.v);
    });
    group.appendChild(btn);
  }
  return group;
}

function renderSeg(field) {
  const wrap = fieldShell(field);
  wrap.appendChild(segControl(field.options, project[field.key], (v) => setValue(field.key, v)));
  if (field.help) wrap.appendChild(help(field.help));
  return wrap;
}

function renderToggle(field) {
  const label = document.createElement("label");
  label.className = `pc-toggle${field.risky ? " is-risky" : ""}`;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(project[field.key]);
  input.addEventListener("change", () => setValue(field.key, input.checked));
  const sw = document.createElement("span");
  sw.className = "pc-toggle-switch";
  const text = document.createElement("span");
  text.className = "pc-toggle-text";
  text.textContent = field.label;
  if (field.help) text.appendChild(help(field.help));
  label.append(input, sw, text);
  if (field.s) label.title = `Écrit dans le prompt : « ${field.s} »`;
  const wrap = document.createElement("div");
  wrap.className = "pc-field";
  wrap.appendChild(label);
  return wrap;
}

/* ---- Curseurs de personnalité ---- */
const TRAIT_WORDS = { "-2": "très", "-1": "plutôt", 1: "plutôt", 2: "très" };

function traitReading(trait, value) {
  if (!value) return "neutre";
  return `${TRAIT_WORDS[value]} ${trait.poles[value < 0 ? 0 : 1].toLowerCase()}`;
}

function renderTraits() {
  const wrap = document.createElement("div");
  wrap.className = "pc-field is-wide";
  for (const group of TRAIT_GROUPS) {
    const block = document.createElement("div");
    block.className = "pc-skill-group";
    block.innerHTML = `<h4 class="pc-skill-group-title">${escapeHtml(group.title)}</h4>`;
    const grid = document.createElement("div");
    grid.className = "pc-sliders";
    for (const trait of group.traits) {
      const row = document.createElement("div");
      row.className = "pc-slider";
      const value = project.traits[trait.key] ?? 0;
      row.innerHTML = `
        <span class="pc-slider-name">${escapeHtml(trait.name)}</span>
        <span class="pc-slider-value"></span>
        <input type="range" min="-2" max="2" step="1" aria-label="${escapeHtml(trait.name)}" />
        <span class="pc-slider-poles"><span>${escapeHtml(trait.poles[0])}</span><span>${escapeHtml(trait.poles[1])}</span></span>`;
      const input = row.querySelector("input");
      const reading = row.querySelector(".pc-slider-value");
      input.value = String(value);
      const paint = () => {
        const v = Number(input.value);
        reading.textContent = traitReading(trait, v);
        row.classList.toggle("is-set", v !== 0);
        // L'infobulle montre la phrase exacte : on règle un comportement, pas
        // un chiffre.
        row.title = v ? `Écrit dans le prompt : « ${trait.levels[String(v)]} »` : "Neutre : rien n'est écrit, l'agent garde son comportement naturel.";
      };
      input.addEventListener("input", () => {
        project.traits[trait.key] = Number(input.value);
        paint();
        saveProject();
        refreshDerived();
      });
      // Double-clic : retour au neutre, le geste des tables de mixage.
      input.addEventListener("dblclick", () => {
        input.value = "0";
        input.dispatchEvent(new Event("input"));
      });
      paint();
      grid.appendChild(row);
    }
    block.appendChild(grid);
    wrap.appendChild(block);
  }
  wrap.appendChild(help("Double-clic sur un curseur pour le remettre au neutre. Survole-le pour lire la phrase qu'il écrit."));
  return wrap;
}

/* ---- Compétences ---- */
function renderSkills() {
  const wrap = document.createElement("div");
  wrap.className = "pc-field is-wide";
  const levels = SKILL_LEVELS.map((l, i) => ({ v: i, l }));
  for (const group of SKILL_GROUPS) {
    const block = document.createElement("div");
    block.className = "pc-skill-group";
    block.innerHTML = `<h4 class="pc-skill-group-title">${escapeHtml(group.title)}</h4>`;
    const grid = document.createElement("div");
    grid.className = "pc-skills";
    for (const skill of group.skills) {
      const card = document.createElement("div");
      card.className = "pc-skill";
      const lvl = project.skills[skill.key] ?? 0;
      card.classList.toggle("is-on", lvl > 0);
      const needs = skill.needs === "web" ? " 🌐" : skill.needs === "system" ? " 🖥️" : "";
      card.innerHTML = `<span class="pc-skill-name">${escapeHtml(skill.name)}${needs}</span><span class="pc-skill-desc">${escapeHtml(skill.desc)}</span>`;
      if (skill.needs) card.title = skill.needs === "web" ? "Demande le droit « Chercher sur le web »" : "Demande un droit système";
      card.appendChild(
        segControl(levels, lvl, (v) => {
          project.skills[skill.key] = v;
          card.classList.toggle("is-on", v > 0);
          saveProject();
          refreshDerived();
        })
      );
      grid.appendChild(card);
    }
    block.appendChild(grid);
    wrap.appendChild(block);
  }
  return wrap;
}

/* ---- Exemples (question / réponse idéale) ---- */
function renderExamples(field) {
  const wrap = document.createElement("div");
  wrap.className = "pc-field is-wide";
  const list = document.createElement("div");
  list.className = "pc-list";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary pc-list-add";
  add.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Ajouter un exemple';

  const paint = () => {
    list.innerHTML = "";
    project.examples.forEach((example, index) => {
      const item = document.createElement("div");
      item.className = "pc-list-item";
      item.innerHTML = `
        <div class="pc-list-item-fields">
          <div class="pc-label">Exemple ${index + 1} — l'utilisateur écrit</div>
          <textarea rows="2" data-part="user" placeholder="ex. Je dois facturer la TVA ?"></textarea>
          <div class="pc-label">La réponse idéale</div>
          <textarea rows="4" data-part="assistant" placeholder="La réponse exacte que tu voudrais lire, dans le ton et la forme voulus."></textarea>
        </div>
        <button type="button" class="ghost pc-icon-btn" title="Retirer cet exemple">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>`;
      for (const area of item.querySelectorAll("textarea")) {
        area.value = example[area.dataset.part] ?? "";
        area.addEventListener("input", () => {
          example[area.dataset.part] = area.value;
          saveProject();
          refreshDerived();
        });
      }
      item.querySelector("button").addEventListener("click", () => {
        project.examples.splice(index, 1);
        saveProject();
        paint();
        refreshDerived();
      });
      list.appendChild(item);
    });
    add.classList.toggle("hidden", project.examples.length >= field.max);
  };
  add.addEventListener("click", () => {
    project.examples.push({ user: "", assistant: "" });
    saveProject();
    paint();
    refreshDerived();
    list.lastElementChild?.querySelector("textarea")?.focus();
  });
  paint();
  wrap.append(list, add);
  return wrap;
}

/* ---- Liste simple (amorces) ---- */
function renderList(field) {
  const wrap = fieldShell(field, { wide: true });
  const list = document.createElement("div");
  list.className = "pc-list";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary pc-list-add";
  add.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Ajouter';
  const values = project[field.key];
  const paint = () => {
    list.innerHTML = "";
    values.forEach((value, index) => {
      const row = document.createElement("div");
      row.className = "pc-list-item";
      row.innerHTML = `<input type="text" /><button type="button" class="ghost pc-icon-btn" title="Retirer"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
      const input = row.querySelector("input");
      input.value = value;
      input.placeholder = field.placeholder ?? "";
      input.addEventListener("input", () => {
        values[index] = input.value;
        saveProject();
        refreshDerived();
      });
      row.querySelector("button").addEventListener("click", () => {
        values.splice(index, 1);
        saveProject();
        paint();
        refreshDerived();
      });
      list.appendChild(row);
    });
    add.classList.toggle("hidden", values.length >= field.max);
  };
  add.addEventListener("click", () => {
    values.push("");
    paint();
    list.lastElementChild?.querySelector("input")?.focus();
  });
  paint();
  wrap.append(list, add);
  return wrap;
}

/* ---- Archétypes ---- */
const BLANK = { id: "", emoji: "📄", name: "Page blanche", desc: "Tout au neutre : à toi de tout régler." };

function archetypeButtons(list, onPick) {
  const grid = document.createElement("div");
  grid.className = "pc-archetypes";
  for (const a of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pc-archetype";
    btn.innerHTML = `<span class="pc-archetype-emoji">${a.emoji}</span><span class="pc-archetype-name">${escapeHtml(a.name)}</span><span class="pc-archetype-desc">${escapeHtml(a.desc)}</span>`;
    btn.addEventListener("click", () => onPick(a));
    grid.appendChild(btn);
  }
  return grid;
}

function renderArchetypePicker(field) {
  const wrap = fieldShell(field, { wide: true });
  wrap.appendChild(archetypeButtons(ARCHETYPES, (a) => applyArchetype(a, { fresh: false })));
  if (field.help) wrap.appendChild(help(field.help));
  return wrap;
}

/**
 * Applique un archétype. `fresh` : sur un projet neuf, il apporte aussi un
 * rôle et une mission de départ ; sur un projet en cours, il ne règle que la
 * personnalité, les compétences et la méthode — ce que l'utilisateur a écrit
 * lui appartient.
 */
function applyArchetype(archetype, { fresh }) {
  const base = defaultProject();
  if (fresh) {
    project = base;
    Object.assign(project, archetype.seed);
  } else {
    project.traits = { ...base.traits };
    project.skills = { ...base.skills };
    for (const [key, value] of Object.entries(archetype.seed)) {
      if (!String(project[key] ?? "").trim() || key === "audienceLevel") project[key] = value;
    }
  }
  Object.assign(project.traits, archetype.traits);
  Object.assign(project.skills, archetype.skills);
  Object.assign(project, archetype.set);
  project.archetype = archetype.id;
  project.manualPrompt = null;
  saveProject();
  buildForm();
  flash(`Archétype « ${archetype.name} » appliqué.`);
}

/* ---- Modèle ----
   La liste vient d'Allkin (/api/models) : celle du CLI, ou un champ libre
   quand le moteur est tiers et qu'Allkin n'en connaît pas le catalogue. */
let modelCatalog = null;

function renderModel(field) {
  const wrap = fieldShell(field);
  const slot = document.createElement("div");
  wrap.appendChild(slot);
  wrap.appendChild(help("Laisser « défaut » : l'agent suit le modèle réglé dans les paramètres d'Allkin."));
  const paint = () => {
    slot.innerHTML = "";
    if (modelCatalog?.freeform) {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Identifiant du modèle (vide = défaut)";
      input.value = project.model;
      input.addEventListener("input", () => setValue("model", input.value.trim()));
      slot.appendChild(input);
      return;
    }
    const select = document.createElement("select");
    const choices = [{ value: "", label: "Défaut d'Allkin", description: modelCatalog?.defaultDescription ?? "" }, ...(modelCatalog?.models ?? [])];
    if (project.model && !choices.some((c) => c.value === project.model)) choices.push({ value: project.model, label: project.model });
    for (const c of choices) {
      const o = document.createElement("option");
      o.value = c.value;
      o.textContent = c.description ? `${c.label} — ${c.description}` : c.label;
      select.appendChild(o);
    }
    select.value = project.model;
    select.addEventListener("change", () => setValue("model", select.value));
    slot.appendChild(select);
  };
  paint();
  if (!modelCatalog) {
    api("/api/models")
      .then((catalog) => {
        modelCatalog = catalog;
        paint();
      })
      .catch(() => {
        modelCatalog = { models: [] };
      });
  }
  return wrap;
}

/* ---- Navigation dans les sections ---- */
function goToSection(id) {
  ui.section = id;
  saveUi();
  highlightNav(id);
  el(`pc-sec-${id}`)?.scrollIntoView({ block: "start" });
}

function highlightNav(id) {
  for (const btn of el("pc-nav").children) btn.classList.toggle("is-on", btn.dataset.pcSection === id);
}

/** La section la plus haute encore visible devient la section courante. */
function followScroll() {
  const form = el("pc-form");
  const top = form.getBoundingClientRect().top;
  let current = SECTIONS[0].id;
  for (const section of SECTIONS) {
    const box = el(`pc-sec-${section.id}`);
    if (box && box.getBoundingClientRect().top - top <= 40) current = section.id;
  }
  if (current !== ui.section) {
    ui.section = current;
    highlightNav(current);
    saveUi();
  }
}

/* ============================================================================
   Ce qui dépend des réglages : compteurs, score, prompt
   ========================================================================== */

let refreshQueued = false;

function refreshDerived() {
  // Une frappe = un calcul, pas trois : on regroupe dans l'image suivante.
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    const prompt = currentPrompt();
    const result = Compiler.quality(project, prompt, { tested: bench.testedSignature === benchSignature() });
    paintScoreChip(result.score);
    paintNavCounts();
    el("pc-subtitle").textContent = project.name.trim() ? `${project.name.trim()} — atelier d'agents sur mesure` : "Atelier d'agents sur mesure";
    if (ui.pane === "prompt") paintPromptPane(prompt, result);
    if (ui.pane === "test") paintTestPane();
  });
}

function paintScoreChip(score) {
  const chip = el("pc-score-chip");
  chip.textContent = String(score);
  chip.dataset.level = score >= 80 ? "good" : score >= 55 ? "mid" : "low";
}

function paintNavCounts() {
  const counts = {
    personality: Object.values(project.traits).filter((v) => v !== 0).length,
    skills: Object.values(project.skills).filter((v) => v > 0).length,
    examples: project.examples.length,
    welcome: project.starters.filter((s) => s.trim()).length,
  };
  for (const node of el("pc-nav").querySelectorAll("[data-pc-count]")) {
    const n = counts[node.dataset.pcCount];
    node.textContent = n ? String(n) : "";
  }
}

/* ============================================================================
   Volet 2 — Prompt
   ========================================================================== */

let refineUndo = null;

function paintPromptPane(prompt, result) {
  const source = el("pc-prompt-source");
  const manual = typeof project.manualPrompt === "string";
  // Ne jamais réécrire sous les doigts : pendant la frappe, c'est la zone qui
  // fait foi, pas le calcul.
  if (document.activeElement !== source && source.value !== prompt) source.value = prompt;
  el("pc-prompt-manual").classList.toggle("hidden", !manual);
  el("pc-prompt-reset").classList.toggle("hidden", !manual);

  const lineCount = prompt.split("\n").length;
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  el("pc-prompt-stats").textContent = `${lineCount} lignes · ${wordCount} mots · ≈ ${Compiler.estimateTokens(prompt).toLocaleString("fr-FR")} jetons`;

  const preview = ui.promptMode === "preview";
  source.classList.toggle("hidden", preview);
  el("pc-prompt-preview").classList.toggle("hidden", !preview);
  if (preview) el("pc-prompt-preview").innerHTML = window.renderMarkdown ? window.renderMarkdown(prompt) : escapeHtml(prompt);
  for (const btn of document.querySelectorAll("[data-pc-prompt-mode]")) btn.classList.toggle("is-on", btn.dataset.pcPromptMode === ui.promptMode);

  paintQuality(result, manual);
}

function paintQuality(result, manual) {
  const box = el("pc-quality");
  box.innerHTML = "";
  const { score, checks } = result;
  const color = score >= 80 ? "var(--risk-low)" : score >= 55 ? "var(--risk-mid)" : "var(--risk-high)";
  const circumference = 2 * Math.PI * 30;
  const verdict = score >= 90 ? "Excellent" : score >= 80 ? "Très bon" : score >= 65 ? "Correct" : score >= 45 ? "À renforcer" : "Incomplet";
  const todo = checks.filter((c) => c.status !== "ok").length;
  const gauge = document.createElement("div");
  gauge.className = "pc-gauge";
  gauge.innerHTML = `
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <circle class="pc-gauge-track" cx="36" cy="36" r="30" fill="none" stroke-width="7"/>
      <circle class="pc-gauge-fill" cx="36" cy="36" r="30" fill="none" stroke-width="7" stroke-linecap="round"
        stroke="${color}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - score / 100)}"
        transform="rotate(-90 36 36)"/>
      <text class="pc-gauge-num" x="36" y="43" text-anchor="middle">${score}</text>
    </svg>
    <div class="pc-gauge-text"><strong>${verdict}</strong><span>${todo ? `${todo} point${todo > 1 ? "s" : ""} à améliorer` : "Tous les critères sont remplis."}${manual ? " — retouché à la main : seuls les critères du texte suivent tes modifications." : ""}</span></div>`;
  box.appendChild(gauge);

  // Les points à revoir d'abord : c'est pour eux qu'on ouvre ce panneau.
  const order = { ko: 0, warn: 1, ok: 2 };
  const groups = new Map();
  for (const check of [...checks].sort((a, b) => order[a.status] - order[b.status])) {
    if (!groups.has(check.group)) groups.set(check.group, []);
    groups.get(check.group).push(check);
  }
  for (const [name, list] of groups) {
    const group = document.createElement("div");
    group.className = "pc-q-group";
    group.innerHTML = `<p class="pc-q-group-title">${escapeHtml(name)}</p>`;
    for (const check of list) {
      const actionable = check.status !== "ok" && check.section !== "prompt";
      const item = document.createElement(actionable ? "button" : "div");
      if (actionable) item.type = "button";
      item.className = `pc-q-item is-${check.status}`;
      const mark = check.status === "ok" ? "✓" : check.status === "warn" ? "!" : "✗";
      item.innerHTML = `<span class="pc-q-mark">${mark}</span><span>${escapeHtml(check.label)}${check.hint ? `<small>${escapeHtml(check.hint)}</small>` : ""}</span>`;
      if (actionable) {
        item.title = check.section === "test" ? "Ouvrir la conversation test" : "Aller au réglage";
        item.addEventListener("click", () => {
          if (check.section === "test") return showPane("test");
          showPane("settings");
          goToSection(check.section);
        });
      }
      group.appendChild(item);
    }
    box.appendChild(group);
  }
}

function onPromptInput() {
  const value = el("pc-prompt-source").value;
  // Revenir exactement au texte généré, c'est ne plus l'avoir retouché.
  project.manualPrompt = value === compiledPrompt() ? null : value;
  saveProject();
  refreshDerived();
}

async function refinePrompt(event) {
  event.preventDefault();
  const input = el("pc-refine-input");
  const request = input.value.trim();
  const errorEl = el("pc-refine-error");
  errorEl.classList.add("hidden");
  if (!request) {
    input.focus();
    return;
  }
  const btn = el("pc-refine-btn");
  btn.disabled = true;
  btn.textContent = "Réécriture…";
  const before = currentPrompt();
  try {
    const { content } = await api("/api/prompt/generate", {
      method: "POST",
      body: JSON.stringify({
        name: project.name,
        description: project.description.slice(0, 100),
        instructions: `${request}\n\nRespecte le style du texte actuel : sections en titres markdown, consignes à l'affirmatif accompagnées de leur raison, aucune majuscule d'insistance, exemples balisés.`,
        current: before,
      }),
    });
    if (!content?.trim()) throw new Error("Le modèle n'a rien renvoyé.");
    refineUndo = before;
    project.manualPrompt = content.trim() + "\n";
    input.value = "";
    saveProject();
    el("pc-prompt-source").value = project.manualPrompt;
    refreshDerived();
    flash("Prompt affiné — relis-le.", { undo: undoRefine });
  } catch (err) {
    errorEl.textContent = `Affinage impossible : ${err.message}`;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Affiner";
  }
}

function undoRefine() {
  if (refineUndo === null) return;
  project.manualPrompt = refineUndo === compiledPrompt() ? null : refineUndo;
  refineUndo = null;
  saveProject();
  el("pc-prompt-source").value = currentPrompt();
  refreshDerived();
}

/* ============================================================================
   Volet 3 — Conversation test
   ----------------------------------------------------------------------------
   Le banc d'essai est un vrai agent Allkin, créé à la première utilisation et
   réutilisé ensuite. Il n'a AUCUN droit : un droit non accordé est un outil non
   monté, et un agent d'essai n'a aucune raison d'agir sur la machine. Ce qu'on
   éprouve ici, c'est le prompt — dans les conditions exactes où il tournera,
   règles d'Allkin comprises.
   ========================================================================== */

const bench = {
  agentId: null,
  sessionId: null,
  ws: null,
  busy: false,
  turns: 0,
  signature: null, // prompt et réglages en vigueur dans la conversation ouverte
  testedSignature: null, // dernier prompt qui a tenu au moins un échange
  firstTurn: false,
  ...load(STORE_BENCH, {}),
};
bench.ws = null;
bench.busy = false;
bench.sessionId = null; // une conversation ne survit pas au rechargement de la page

function saveBench() {
  store(STORE_BENCH, { agentId: bench.agentId, testedSignature: bench.testedSignature });
}

async function ensureBenchAgent() {
  const { agents } = await api("/api/agents");
  core.agents = agents;
  // Retrouvé par son id, ou par son nom (autre navigateur, stockage vidé).
  const found = agents.find((a) => a.id === bench.agentId) ?? agents.find((a) => a.name === BENCH_NAME);
  if (found) {
    bench.agentId = found.id;
    saveBench();
    return found.id;
  }
  const { agent } = await api("/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: BENCH_NAME,
      description: "Banc d'essai de PromptCraft : agent sans aucun droit, réécrit à chaque test.",
      canAdminSystem: false,
      canReadSystem: false,
      canBrowseWeb: false,
      canTalkToAgents: false,
      canSchedule: false,
      canSelfPrompt: false,
      claudeMd: currentPrompt(),
    }),
  });
  bench.agentId = agent.id;
  saveBench();
  core.agents = (await api("/api/agents")).agents;
  return agent.id;
}

function closeBenchSocket() {
  if (bench.ws) {
    const ws = bench.ws;
    bench.ws = null;
    ws.close();
  }
}

/** Ouvre une conversation neuve avec le prompt et les réglages actuels. */
async function startBenchSession() {
  setBenchStatus("busy", "Préparation du banc d'essai…");
  closeBenchSocket();
  const agentId = await ensureBenchAgent();

  // La conversation précédente part dans l'historique de l'agent d'essai :
  // rien ne s'efface, mais elle ne se mêle plus à la nouvelle.
  if (bench.sessionId) {
    await api(`/api/agents/${agentId}/sessions/${bench.sessionId}`, { method: "DELETE" }).catch(() => {});
  }

  await api(`/api/agents/${agentId}/claude-md`, { method: "PUT", body: JSON.stringify({ content: currentPrompt() }) });
  await api(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify({ model: project.model || "" }) });
  const { sessionId } = await api(`/api/agents/${agentId}/sessions`, { method: "POST", body: "{}" });

  bench.sessionId = sessionId;
  bench.signature = benchSignature();
  bench.turns = 0;
  bench.firstTurn = true;
  await openBenchSocket(agentId, sessionId);
  sendReasoning();
  setBenchStatus("live", "Conversation ouverte");
}

function openBenchSocket(agentId, sessionId) {
  return new Promise((resolve, reject) => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/ws?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`);
    bench.ws = ws;
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("connexion au banc d'essai impossible")), { once: true });
    ws.addEventListener("message", (event) => onBenchMessage(ws, event));
    ws.addEventListener("close", (event) => {
      if (bench.ws !== ws) return; // remplacée volontairement
      bench.ws = null;
      bench.sessionId = null;
      setBusy(false);
      setBenchStatus("idle", event.code === 4001 ? "Session Allkin terminée" : "Connexion fermée");
    });
  });
}

/* Le raisonnement ne se règle que par le socket (set_reasoning) ; un agent
   endormi ignore ce message, d'où un second envoi juste après le premier
   message, qui l'a réveillé. Il est aussi enregistré sur l'agent : la
   conversation suivante le retrouve. */
function sendReasoning() {
  if (bench.ws?.readyState !== WebSocket.OPEN) return;
  bench.ws.send(JSON.stringify({ type: "set_reasoning", effort: project.effort || "", thinking: project.thinking || "", model: project.model || "" }));
}

function onBenchMessage(ws, event) {
  if (bench.ws !== ws) return;
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }
  // Le socket voit toutes les sessions de l'agent : seule la nôtre compte.
  if (msg.sessionId && msg.sessionId !== bench.sessionId) return;

  if (msg.type === "assistant_text") {
    appendBenchMessage("agent", msg.text);
  } else if (msg.type === "activity") {
    if (msg.label) setBenchStatus("busy", msg.label);
  } else if (msg.type === "form_request") {
    // L'outil de formulaire est monté pour tout agent ; le banc d'essai ne
    // l'affiche pas — on l'annule, et on le dit.
    appendBenchNote("L'agent a voulu t'ouvrir un formulaire (non affiché dans le banc d'essai) : il a été annulé.");
    ws.send(JSON.stringify({ type: "form_response", requestId: msg.requestId, sessionId: bench.sessionId, values: null }));
  } else if (msg.type === "command_proposal") {
    appendBenchNote("L'agent a proposé une commande : refusée, le banc d'essai n'a aucun droit.");
    ws.send(JSON.stringify({ type: "approval_response", requestId: msg.requestId, sessionId: bench.sessionId, approved: false }));
  } else if (msg.type === "turn_done") {
    bench.turns += 1;
    if (bench.signature === benchSignature()) {
      bench.testedSignature = bench.signature;
      saveBench();
    }
    setBusy(false);
    setBenchStatus("live", "Conversation ouverte");
    if (msg.usage) appendUsage(msg.usage);
    markBenchRead();
    refreshDerived();
  } else if (msg.type === "error") {
    setBusy(false);
    appendBenchMessage("error", msg.message || "Erreur inconnue.");
    setBenchStatus("live", "Conversation ouverte");
  } else if (msg.type === "closed") {
    setBusy(false);
    bench.sessionId = null;
    setBenchStatus("idle", "Conversation refermée ailleurs");
  }
}

/* La pastille « non lu » de l'agent d'essai n'a pas de sens : on vient de
   lire sa réponse ici. */
function markBenchRead() {
  if (!bench.agentId) return;
  api(`/api/agents/${bench.agentId}/read`, { method: "POST", body: JSON.stringify({ timestamp: new Date().toISOString() }) }).catch(() => {});
}

async function sendBenchMessage(text) {
  text = text.trim();
  if (!text || bench.busy) return;
  const log = el("pc-test-log");
  log.querySelector(".pc-empty-test")?.remove();
  setBusy(true);
  try {
    // Une conversation dont le prompt a changé avant tout échange est
    // simplement remplacée : elle n'a encore rien à perdre.
    if (!bench.sessionId || !bench.ws || (bench.turns === 0 && bench.signature !== benchSignature())) {
      if (bench.sessionId) appendBenchNote("Nouvelle conversation, avec le prompt actuel.");
      await startBenchSession();
    }
    appendBenchMessage("user", text);
    setBenchStatus("busy", "L'agent réfléchit…");
    bench.ws.send(JSON.stringify({ type: "message", text }));
    if (bench.firstTurn) {
      bench.firstTurn = false;
      sendReasoning();
    }
  } catch (err) {
    setBusy(false);
    appendBenchMessage("error", `Impossible d'envoyer : ${err.message}`);
    setBenchStatus("idle", "Banc d'essai indisponible");
  }
}

async function restartBench() {
  if (bench.busy) return;
  el("pc-test-log").innerHTML = "";
  try {
    await startBenchSession();
    appendBenchNote(`Nouvelle conversation — prompt de ${currentPrompt().split("\n").length} lignes.`);
  } catch (err) {
    appendBenchMessage("error", `Impossible d'ouvrir la conversation : ${err.message}`);
    setBenchStatus("idle", "Banc d'essai indisponible");
  }
  paintTestPane();
}

async function removeBench() {
  if (!bench.agentId) {
    flash("Aucun agent d'essai à supprimer.");
    return;
  }
  if (!confirm(`Supprimer l'agent « ${BENCH_NAME} » ? Il part dans la corbeille d'Allkin ; il sera recréé au prochain test.`)) return;
  closeBenchSocket();
  try {
    await api(`/api/agents/${bench.agentId}`, { method: "DELETE" });
  } catch (err) {
    flash(`Suppression impossible : ${err.message}`);
    return;
  }
  bench.agentId = null;
  bench.sessionId = null;
  bench.testedSignature = null;
  saveBench();
  core.agents = (await api("/api/agents").catch(() => ({ agents: core.agents }))).agents;
  el("pc-test-log").innerHTML = "";
  setBenchStatus("idle", "Banc d'essai supprimé");
  paintTestPane();
}

function setBusy(busy) {
  bench.busy = busy;
  el("pc-test-send").classList.toggle("hidden", busy);
  el("pc-test-stop").classList.toggle("hidden", !busy);
  el("pc-test-restart").disabled = busy;
  const log = el("pc-test-log");
  log.querySelector(".pc-thinking")?.remove();
  if (busy) {
    const dots = document.createElement("div");
    dots.className = "pc-thinking";
    dots.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(dots);
    log.scrollTop = log.scrollHeight;
  }
}

function setBenchStatus(kind, text) {
  el("pc-test-dot").className = `pc-dot${kind === "live" ? " is-live" : kind === "busy" ? " is-busy" : ""}`;
  el("pc-test-status-text").textContent = text;
}

function appendBenchMessage(role, text) {
  const log = el("pc-test-log");
  const thinking = log.querySelector(".pc-thinking");
  const msg = document.createElement("div");
  msg.className = `pc-msg is-${role === "error" ? "note is-error" : role}`;
  if (role === "agent") {
    msg.innerHTML = `<div class="pc-msg-who">${escapeHtml(project.name.trim() || "Agent")}</div><div class="pc-msg-body md-body"></div>`;
    msg.querySelector(".pc-msg-body").innerHTML = window.renderMarkdown ? window.renderMarkdown(text) : escapeHtml(text);
  } else {
    msg.textContent = text;
  }
  log.insertBefore(msg, thinking);
  log.scrollTop = log.scrollHeight;
}

function appendBenchNote(text) {
  const log = el("pc-test-log");
  log.querySelector(".pc-empty-test")?.remove();
  const note = document.createElement("div");
  note.className = "pc-msg is-note";
  note.textContent = text;
  log.insertBefore(note, log.querySelector(".pc-thinking"));
  log.scrollTop = log.scrollHeight;
}

function appendUsage(usage) {
  const tokens = Object.values(usage.models ?? {}).reduce((sum, c) => sum + (c.in || 0) + (c.out || 0) + (c.cacheRead || 0) + (c.cacheCreate || 0), 0);
  const parts = [];
  if (typeof usage.costUSD === "number") parts.push(`${usage.costUSD.toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 4 })}`);
  if (tokens) parts.push(`${tokens.toLocaleString("fr-FR")} jetons`);
  if (usage.durationMs) parts.push(`${Math.round(usage.durationMs / 100) / 10} s`);
  const models = Object.keys(usage.models ?? {});
  if (models.length) parts.push(models.join(", "));
  if (parts.length) appendBenchNote(parts.join(" · "));
}

function paintTestPane() {
  const log = el("pc-test-log");
  if (!log.children.length) {
    log.innerHTML = `<div class="pc-empty-test"><strong>Mets ton agent à l'épreuve</strong>Écris-lui, ou pioche une question ci-dessous : tes amorces, et des pièges classiques — hors-sujet, ambiguïté, injection, pression sur une ligne rouge.</div>`;
  }
  el("pc-test-stale").classList.toggle("hidden", !(bench.sessionId && bench.turns > 0 && bench.signature !== benchSignature()));

  const probes = el("pc-test-probes");
  probes.innerHTML = "";
  for (const probe of Compiler.probes(project)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pc-probe";
    btn.innerHTML = `<span class="pc-probe-kind">${escapeHtml(probe.kind)}</span> ${escapeHtml(probe.text)}`;
    btn.title = probe.hint ? `${probe.text}\n\n${probe.hint}` : probe.text;
    btn.addEventListener("click", () => sendBenchMessage(probe.text));
    probes.appendChild(btn);
  }
}

/* ============================================================================
   Télécharger, ouvrir, déployer
   ========================================================================== */

function buildArchive() {
  const prompt = currentPrompt();
  const { score } = Compiler.quality(project, prompt);
  return createZip([
    { name: "agent.json", content: JSON.stringify(Compiler.agentJson(project), null, 2) + "\n" },
    { name: "CLAUDE.md", content: prompt },
    { name: "promptcraft.json", content: JSON.stringify(project, null, 2) + "\n" },
    { name: "LISEZMOI.txt", content: Compiler.readme(project, score) },
  ]);
}

/** Bloque ce qu'Allkin refuserait de toute façon, avec le bon message. */
function blockingProblem() {
  if (!project.name.trim()) return { text: "Donne d'abord un nom à l'agent.", field: "name" };
  if (project.description.trim().length > 100) return { text: "La description dépasse 100 caractères : Allkin la refuserait.", field: "description" };
  return null;
}

function showProblem(problem) {
  showPane("settings");
  goToSection("identity");
  flash(problem.text);
  setTimeout(() => el(`pc-f-${problem.field}`)?.focus(), 250);
}

function downloadArchive() {
  const problem = blockingProblem();
  if (problem) return showProblem(problem);
  const url = URL.createObjectURL(buildArchive());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(project.name)}.allkin`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  flash(`${a.download} téléchargé.`);
}

const RIGHT_LABELS = SECTIONS.find((s) => s.id === "deploy").fields.filter((f) => f.right);

function openDeployDialog() {
  const problem = blockingProblem();
  if (problem) return showProblem(problem);
  const node = el("pc-deploy-template").content.firstElementChild.cloneNode(true);
  const modelLabel = project.model ? project.model : "modèle par défaut";
  const reasoning = [project.effort && `effort ${project.effort}`, project.thinking && `réflexion ${project.thinking}`].filter(Boolean).join(", ");
  node.querySelector("#pc-deploy-summary").textContent = `« ${project.name.trim()} » sera créé comme un nouvel agent (${modelLabel}${reasoning ? `, ${reasoning}` : ""}), sans remplacer aucun agent existant. Droits accordés :`;
  const list = node.querySelector("#pc-deploy-rights");
  const granted = RIGHT_LABELS.filter((f) => project[f.key]);
  if (!granted.length) {
    const li = document.createElement("li");
    li.textContent = "aucun — l'agent converse, sans outil sur la machine ni sur le web.";
    list.appendChild(li);
  }
  for (const f of granted) {
    const li = document.createElement("li");
    li.textContent = `${f.label} — ${f.help}`;
    if (f.risky) li.className = "is-risky";
    list.appendChild(li);
  }
  const close = () => node.remove();
  node.addEventListener("click", (e) => {
    if (e.target === node) close();
  });
  node.querySelector(".modal-cancel").addEventListener("click", close);
  node.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  const go = node.querySelector("#pc-deploy-go");
  go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = "Création…";
    const errorEl = node.querySelector("#pc-deploy-error");
    errorEl.classList.add("hidden");
    try {
      const agent = await deploy();
      close();
      flash(`Agent « ${agent.name} » créé.`);
      openTab(agent.id, "chat");
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
      go.disabled = false;
      go.textContent = "Créer l'agent";
    }
  });
  document.body.appendChild(node);
  go.focus();
}

/* Le déploiement passe par l'import d'Allkin, avec l'archive même qu'on
   télécharge : un seul format, un seul chemin, et ce qui est déployé est
   exactement ce qui aurait été téléchargé. */
async function deploy() {
  const form = new FormData();
  form.append("file", buildArchive(), `${slugify(project.name)}.allkin`);
  const res = await fetch("/api/agents/import", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Échec du déploiement (erreur ${res.status}).`);
  // La liste des agents du cœur doit le connaître avant qu'on ouvre son
  // onglet : activer un onglet redessine la barre latérale depuis elle.
  core.agents = (await api("/api/agents")).agents;
  return data.agent;
}

async function openFile(file) {
  try {
    let loaded;
    if (/\.json$/i.test(file.name)) {
      loaded = JSON.parse(await file.text());
    } else {
      const entries = readZip(await file.arrayBuffer());
      if ([...entries.values()].includes(null)) {
        throw new Error("cette archive est compressée ; PromptCraft ne rouvre que ses propres .allkin (un agent exporté s'importe depuis l'accueil).");
      }
      if (entries.has("promptcraft.json")) {
        loaded = JSON.parse(entries.get("promptcraft.json"));
      } else if (entries.has("agent.json")) {
        // Un agent qui n'a pas été fait ici : on reprend son identité et son
        // prompt tel quel, à retoucher à la main.
        const meta = JSON.parse(entries.get("agent.json"));
        loaded = { name: meta.name ?? "", description: meta.description ?? "", model: meta.model ?? "", manualPrompt: entries.get("CLAUDE.md") ?? null };
      } else {
        throw new Error("ni promptcraft.json, ni agent.json dans cette archive.");
      }
    }
    if (loaded?.format && loaded.format !== "promptcraft") throw new Error("ce fichier n'est pas un projet PromptCraft.");
    project = normalize(loaded);
    saveProject();
    buildForm();
    flash(`« ${project.name || file.name} » ouvert.`);
  } catch (err) {
    flash(`Ouverture impossible : ${err.message}`);
  }
}

function openNewDialog() {
  const node = el("pc-new-template").content.firstElementChild.cloneNode(true);
  const close = () => node.remove();
  const grid = archetypeButtons([BLANK, ...ARCHETYPES], (a) => {
    close();
    if (a === BLANK) {
      project = defaultProject();
      saveProject();
      buildForm();
      flash("Nouveau projet.");
    } else {
      applyArchetype(a, { fresh: true });
    }
    showPane("settings");
    goToSection("identity");
  });
  node.querySelector("#pc-archetypes").replaceWith(grid);
  node.addEventListener("click", (e) => {
    if (e.target === node) close();
  });
  node.querySelector(".modal-cancel").addEventListener("click", close);
  node.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  document.body.appendChild(node);
  grid.firstElementChild.focus();
}

/* ---- Message éphémère ---- */
let flashTimer = null;
function flash(text, { undo } = {}) {
  let box = document.getElementById("pc-flash");
  if (!box) {
    box = document.createElement("div");
    box.id = "pc-flash";
    box.className = "pc-flash";
    box.setAttribute("role", "status");
    document.body.appendChild(box);
  }
  box.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = text;
  box.appendChild(span);
  if (undo) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.textContent = "Annuler";
    btn.addEventListener("click", () => {
      undo();
      box.classList.remove("is-on");
    });
    box.appendChild(btn);
  }
  box.classList.add("is-on");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => box.classList.remove("is-on"), undo ? 8000 : 3200);
}

/* ============================================================================
   L'onglet
   ========================================================================== */

function showPane(pane) {
  ui.pane = pane;
  saveUi();
  for (const btn of document.querySelectorAll("[data-pc-tab]")) btn.setAttribute("aria-selected", String(btn.dataset.pcTab === pane));
  for (const name of ["settings", "prompt", "test"]) el(`pc-pane-${name}`).classList.toggle("hidden", name !== pane);
  refreshDerived();
  if (pane === "test") setTimeout(() => el("pc-test-input").focus(), 0);
}

let built = false;

function activate() {
  if (!built) {
    built = true;
    buildForm();
    wire();
    setBenchStatus("idle", "Banc d'essai prêt");
  }
  showPane(ui.pane);
  if (ui.pane === "settings") requestAnimationFrame(() => el(`pc-sec-${ui.section}`)?.scrollIntoView({ block: "start" }));
}

function wire() {
  for (const btn of document.querySelectorAll("[data-pc-tab]")) btn.addEventListener("click", () => showPane(btn.dataset.pcTab));
  el("pc-form").addEventListener("scroll", () => requestAnimationFrame(followScroll), { passive: true });

  el("pc-new-btn").addEventListener("click", openNewDialog);
  el("pc-open-btn").addEventListener("click", () => el("pc-open-input").click());
  el("pc-open-input").addEventListener("change", () => {
    const [file] = el("pc-open-input").files || [];
    el("pc-open-input").value = "";
    if (file) openFile(file);
  });
  el("pc-download-btn").addEventListener("click", downloadArchive);
  el("pc-deploy-btn").addEventListener("click", openDeployDialog);

  el("pc-prompt-source").addEventListener("input", onPromptInput);
  el("pc-prompt-reset").addEventListener("click", () => {
    const previous = project.manualPrompt;
    project.manualPrompt = null;
    saveProject();
    el("pc-prompt-source").value = compiledPrompt();
    refreshDerived();
    flash("Le prompt suit de nouveau les réglages.", {
      undo: () => {
        project.manualPrompt = previous;
        saveProject();
        el("pc-prompt-source").value = currentPrompt();
        refreshDerived();
      },
    });
  });
  el("pc-prompt-copy").addEventListener("click", async (e) => {
    const ok = await copyToClipboard(e.currentTarget, currentPrompt());
    if (!ok) flash("Copie refusée par le navigateur.");
  });
  for (const btn of document.querySelectorAll("[data-pc-prompt-mode]")) {
    btn.addEventListener("click", () => {
      ui.promptMode = btn.dataset.pcPromptMode;
      saveUi();
      refreshDerived();
    });
  }
  el("pc-refine").addEventListener("submit", refinePrompt);

  el("pc-test-compose").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el("pc-test-input");
    const text = input.value;
    if (!text.trim() || bench.busy) return;
    input.value = "";
    sendBenchMessage(text);
  });
  el("pc-test-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      el("pc-test-compose").requestSubmit();
    }
  });
  el("pc-test-stop").addEventListener("click", () => {
    bench.ws?.send(JSON.stringify({ type: "interrupt", sessionId: bench.sessionId }));
  });
  el("pc-test-restart").addEventListener("click", restartBench);
  el("pc-test-remove").addEventListener("click", removeBench);
}

function openPromptCraft() {
  openTab(null, KIND);
}

Allkin.registerTabKind(KIND, {
  panels: ["pc-view"],
  icon: ICON,
  label: () => "PromptCraft",
  meta: "Atelier d'agents",
  tooltip: () => "PromptCraft — atelier d'agents sur mesure",
  // Pas de `scroller` : la position se retient par section (ui.section), ce
  // qui survit aussi au rechargement de la page.
  activate,
});

Allkin.provide("promptcraft", { open: openPromptCraft });

/* ---- Points d'entrée ---------------------------------------------------------
   L'API des plugins d'interface ne sait pas (encore) déclarer une « app » : on
   s'insère donc dans deux endroits de la page, en ne supposant que leur
   existence — s'ils disparaissent, PromptCraft reste joignable par ses onglets
   restaurés et par Allkin.capability("promptcraft").open(). */

function entryIcon() {
  return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
}

// En-tête de l'accueil, à côté d'« Ajouter un agent ».
function addHomeButton() {
  const actions = document.querySelector(".home-head-actions");
  if (!actions || actions.querySelector("[data-pc-entry]")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secondary home-head-btn";
  btn.dataset.pcEntry = "home";
  btn.title = "PromptCraft — fabriquer un agent sur mesure";
  btn.setAttribute("aria-label", "PromptCraft");
  btn.innerHTML = `${entryIcon()}<span class="home-head-btn-label">PromptCraft</span>`;
  btn.addEventListener("click", openPromptCraft);
  actions.insertBefore(btn, actions.children[1] ?? null);
}

// Panneau « Applications » de la barre latérale : il est redessiné à chaque
// ouverture, on y repose donc notre entrée à chaque fois.
function watchSidebarApps() {
  const list = document.getElementById("sidebar-app-list");
  const template = document.getElementById("sidebar-app-item-template");
  if (!list || !template) return;
  const ensure = () => {
    if (!list.children.length || list.querySelector("[data-pc-entry]")) return;
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.pcEntry = "sidebar";
    node.querySelector(".sidebar-app-icon").innerHTML = entryIcon();
    node.querySelector(".sidebar-app-name").textContent = "PromptCraft";
    node.querySelector(".sidebar-app-meta").textContent = "Atelier d'agents sur mesure";
    node.querySelector(".sidebar-app-main").addEventListener("click", openPromptCraft);
    list.insertBefore(node, list.firstElementChild);
  };
  new MutationObserver(ensure).observe(list, { childList: true });
  ensure();
}

addHomeButton();
watchSidebarApps();
})();
