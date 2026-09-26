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
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const KNOWN_PERMISSIONS = new Set(["network", "filesystem", "exec", "root", "agents", "interface", "agent"]);
const IGNORED = new Set(["node_modules", ".git", ".DS_Store"]);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const errors = [];
const warnings = [];
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
  if (!VERSION_PATTERN.test(String(m.version ?? ""))) fail(id, "version doit être un semver (ex. 1.0.0).");
  if (typeof m.description !== "string" || !m.description.trim()) fail(id, "description est obligatoire.");
  if (m.web && !m.service) fail(id, "web suppose un service.");
  if (m.service && (typeof m.service.command !== "string" || !m.service.command)) fail(id, "service.command est obligatoire.");
  if (m.agent) {
    if (typeof m.agent.name !== "string" || !m.agent.name.trim()) fail(id, "agent.name est obligatoire.");
    if (typeof m.agent.prompt !== "string" || !m.agent.prompt.endsWith(".md")) fail(id, "agent.prompt doit désigner un fichier .md du plugin.");
    else if (!existsSync(join(dir, m.agent.prompt))) fail(id, `agent.prompt : ${m.agent.prompt} est absent.`);
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
    files,
  };
}

const plugins = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR)
      .filter((name) => statSync(join(PLUGINS_DIR, name)).isDirectory())
      .sort()
      .map(readPlugin)
      .filter(Boolean)
  : [];

for (const w of warnings) console.warn(`attention  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`erreur     ${e}`);
  process.exit(1);
}

const content = JSON.stringify({ schemaVersion: 1, plugins }, null, 2) + "\n";
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
