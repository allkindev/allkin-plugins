#!/usr/bin/env node
/**
 * Vérifie les plugins et régénère `catalogue.json` — le fichier unique
 * qu'Allkin télécharge pour afficher la liste des plugins disponibles.
 *
 *   node scripts/catalogue.mjs           réécrit catalogue.json
 *   node scripts/catalogue.mjs --check   vérifie sans écrire (code 1 si écart)
 *
 * Le dépôt est lu par Allkin en fichiers bruts, qui ne savent pas lister un
 * dossier : le catalogue énumère donc les fichiers de chaque plugin, avec leur
 * taille et leur empreinte SHA-256. Allkin refuse d'installer un plugin dont un
 * seul fichier ne correspond pas — d'où l'importance de relancer ce script
 * après CHAQUE modification.
 *
 * Aucune dépendance.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PLUGINS_DIR = join(ROOT, "plugins");
const CATALOGUE_PATH = join(ROOT, "catalogue.json");

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
/* Directive stricte : toujours 1.0.N, N entier sans zéro devant, augmenté de
   1 à chaque modification du plugin (voir CREER-UN-PLUGIN.md). Allkin compare
   les versions nombre par nombre : « 1.0008 » y vaudrait 1.8. */
const VERSION_PATTERN = /^1\.0\.(?:0|[1-9]\d*)$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const KNOWN_PERMISSIONS = new Set(["network", "filesystem", "exec", "root", "agents", "interface", "agent", "repository"]);
const IGNORED = new Set(["node_modules", ".git", ".DS_Store"]);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/* Which of the two repositories this is (channel.json at the root):
     stable        only what the owner of Allkin has validated;
     experimental  only what is still pending.
   A plugin moves from the second to the first when it is validated — see
   git_validate_plugin.sh. The script refuses a plugin sitting in the wrong one:
   the repository a plugin is in IS its status, the two must never disagree. */
const CHANNEL = (() => {
  try {
    const channel = JSON.parse(readFileSync(join(ROOT, "channel.json"), "utf-8")).channel;
    return channel === "stable" || channel === "experimental" ? channel : null;
  } catch {
    return null;
  }
})();

const errors = [];
const warnings = [];

/** A folder in the wrong repository for its validation status. */
function checkChannel(where, validation) {
  if (CHANNEL === "stable" && validation.status !== "validated") {
    errors.push(`${where} : non validé — sa place est dans le dépôt expérimental.`);
  } else if (CHANNEL === "experimental" && validation.status === "validated") {
    errors.push(`${where} : validé — sa place est dans le dépôt stable (git_validate_plugin.sh).`);
  }
}
const fail = (id, message) => errors.push(`plugins/${id} : ${message}`);

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (IGNORED.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listFiles(path, base));
    else if (st.isFile()) out.push({ path: relative(base, path).split(sep).join("/"), st });
  }
  return out;
}

/** The owner's check of the plugin (validation.json): absent or unreadable = pending. */
function readValidation(dir) {
  try {
    const raw = JSON.parse(readFileSync(join(dir, "validation.json"), "utf-8"));
    if (raw?.status !== "validated") return { status: "pending" };
    return { status: "validated", ...(typeof raw.date === "string" ? { date: raw.date } : {}), ...(typeof raw.by === "string" ? { by: raw.by } : {}) };
  } catch {
    return { status: "pending" };
  }
}

function readPlugin(id) {
  const dir = join(PLUGINS_DIR, id);
  if (!ID_PATTERN.test(id)) return fail(id, "nom de dossier : minuscules, chiffres et tirets.");
  if (!existsSync(join(dir, "plugin.json"))) return fail(id, "plugin.json est absent.");
  if (!existsSync(join(dir, "README.md"))) return fail(id, "README.md est absent — la documentation est obligatoire.");

  let m;
  try {
    m = JSON.parse(readFileSync(join(dir, "plugin.json"), "utf-8"));
  } catch (err) {
    return fail(id, `plugin.json n'est pas un JSON valide (${err.message}).`);
  }
  if (typeof m.name !== "string" || !m.name.trim()) fail(id, "name est obligatoire.");
  if (!VERSION_PATTERN.test(String(m.version ?? ""))) fail(id, "version attendue : 1.0.N (1.0.0, 1.0.1, 1.0.12…).");
  if (typeof m.description !== "string" || !m.description.trim()) fail(id, "description est obligatoire.");
  if (m.web && !m.service) fail(id, "web suppose un service.");
  if (m.service && (typeof m.service.command !== "string" || !m.service.command)) fail(id, "service.command est obligatoire.");
  if (m.agent) {
    if (typeof m.agent.name !== "string" || !m.agent.name.trim()) fail(id, "agent.name est obligatoire.");
    // One Markdown file, or several joined in order (role + reference documents).
    const prompts = Array.isArray(m.agent.prompt) ? m.agent.prompt : [m.agent.prompt];
    if (!prompts.length || !prompts.every((f) => typeof f === "string" && f.endsWith(".md"))) fail(id, "agent.prompt doit désigner un ou plusieurs fichiers .md du plugin.");
    else for (const f of prompts) if (!existsSync(join(dir, f))) fail(id, `agent.prompt : ${f} est absent.`);
    const declared = (Array.isArray(m.permissions) ? m.permissions : []).some((p) => (typeof p === "string" ? p : p?.id) === "agent");
    if (!declared) fail(id, "un plugin qui déclare « agent » doit demander le droit « agent ».");
  }

  const permissions = (Array.isArray(m.permissions) ? m.permissions : []).map((p) => (typeof p === "string" ? { id: p } : p));
  for (const p of permissions) {
    if (!p || typeof p.id !== "string") fail(id, "chaque droit doit avoir un id.");
    else if (!KNOWN_PERMISSIONS.has(p.id)) warnings.push(`plugins/${id} : droit « ${p.id} » inconnu d'Allkin (affiché à risque élevé).`);
    else if (!p.reason) warnings.push(`plugins/${id} : droit « ${p.id} » sans « reason ».`);
  }

  const files = listFiles(dir).map(({ path, st }) => {
    if (!path.split("/").every((s) => SEGMENT_PATTERN.test(s))) fail(id, `nom de fichier refusé par Allkin : ${path}`);
    if (st.size > MAX_FILE_BYTES) fail(id, `${path} dépasse 20 Mo.`);
    return {
      path,
      size: st.size,
      sha256: createHash("sha256").update(readFileSync(join(dir, path))).digest("hex"),
      ...(st.mode & 0o100 ? { executable: true } : {}),
    };
  });
  if (files.length > MAX_FILES) fail(id, `plus de ${MAX_FILES} fichiers.`);
  const icon = ["icon.svg", "icon.png", "icon.webp", "icon.jpg"].find((f) => files.some((x) => x.path === f));

  return {
    id,
    name: m.name,
    version: m.version,
    description: m.description,
    ...(m.author ? { author: m.author } : {}),
    ...(m.homepage ? { homepage: m.homepage } : {}),
    permissions,
    service: Boolean(m.service),
    web: Boolean(m.web),
    ui: Boolean(m.ui),
    ...(m.agent ? { agent: { name: m.agent.name } } : {}),
    ...(icon ? { icon } : {}),
    // validation.json of the folder: "validated" with its date, or pending.
    validation: (checkChannel(`plugins/${id}`, readValidation(dir)), readValidation(dir)),
    // Translations of the texts above (name, description, permission reasons):
    // the gallery shows them before the plugin is installed.
    ...(m.locales && typeof m.locales === "object" ? { locales: catalogueLocales(m.locales) } : {}),
    files,
  };
}

/** Only what the catalogue shows: name, description, permission reasons. */
function catalogueLocales(locales) {
  const out = {};
  for (const [language, l] of Object.entries(locales)) {
    if (!/^[a-z]{2}$/.test(language) || !l || typeof l !== "object") continue;
    out[language] = {
      ...(typeof l.name === "string" ? { name: l.name } : {}),
      ...(typeof l.description === "string" ? { description: l.description } : {}),
      ...(l.permissions && typeof l.permissions === "object" ? { permissions: l.permissions } : {}),
    };
  }
  return out;
}

const plugins = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR)
      .filter((name) => statSync(join(PLUGINS_DIR, name)).isDirectory())
      .sort()
      .map(readPlugin)
      .filter(Boolean)
  : [];

/* Services (see SERVICE-STANDARD.md): a folder services/<id>/ holding a
   declarative service.json and its README files. Allkin reads the definition
   from the catalogue itself — it is data, there is nothing to download — and
   fetches a README only when its help is opened. */
const SERVICES_DIR = join(ROOT, "services");
const SERVICE_READMES = ["README.md", "README-FR.md", "README-ES.md", "README-DE.md"];

function readService(id) {
  const dir = join(SERVICES_DIR, id);
  const failService = (message) => errors.push(`services/${id} : ${message}`);
  if (!ID_PATTERN.test(id)) return failService("nom de dossier : minuscules, chiffres et tirets.");
  if (!existsSync(join(dir, "service.json"))) return failService("service.json est absent.");
  if (!existsSync(join(dir, "README.md"))) return failService("README.md est absent — l'aide est obligatoire.");
  let definition;
  try {
    definition = JSON.parse(readFileSync(join(dir, "service.json"), "utf-8"));
  } catch (err) {
    return failService(`service.json n'est pas un JSON valide (${err.message}).`);
  }
  for (const field of ["label", "authType", "category"]) {
    if (typeof definition[field] !== "string" || !definition[field]) failService(`${field} est obligatoire.`);
  }
  if (!definition.apiBaseUrl && !definition.needsBaseUrl && !definition.baseUrlTemplate) {
    failService("apiBaseUrl, needsBaseUrl ou baseUrlTemplate est obligatoire.");
  }
  checkChannel(`services/${id}`, readValidation(dir));
  return {
    id,
    definition,
    validation: readValidation(dir),
    readmes: SERVICE_READMES.filter((name) => existsSync(join(dir, name))),
  };
}

const services = existsSync(SERVICES_DIR)
  ? readdirSync(SERVICES_DIR)
      .filter((name) => statSync(join(SERVICES_DIR, name)).isDirectory())
      .sort()
      .map(readService)
      .filter(Boolean)
  : [];

for (const w of warnings) console.warn(`attention  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`erreur     ${e}`);
  process.exit(1);
}

// `services` only when the repository holds some: a catalogue without them
// stays byte for byte what it was.
if (!CHANNEL) {
  console.error('erreur     channel.json absent ou illisible : { "channel": "stable" } ou { "channel": "experimental" }.');
  process.exit(1);
}
const content = JSON.stringify({ schemaVersion: 1, channel: CHANNEL, plugins, ...(services.length ? { services } : {}) }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const current = existsSync(CATALOGUE_PATH) ? readFileSync(CATALOGUE_PATH, "utf-8") : "";
  if (current !== content) {
    console.error("catalogue.json n'est pas à jour : lance node scripts/catalogue.mjs");
    process.exit(1);
  }
  console.log(`catalogue.json à jour (${plugins.length} plugin${plugins.length > 1 ? "s" : ""}).`);
} else {
  writeFileSync(CATALOGUE_PATH, content);
  console.log(`catalogue.json écrit (${plugins.length} plugin${plugins.length > 1 ? "s" : ""}).`);
}
