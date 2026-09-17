// Lanceur du plugin WeTTY.
//
// WeTTY dépend de node-pty, un module natif compilé pour la machine : il ne peut
// pas être livré tout fait dans le dépôt. Au premier démarrage (et à chaque
// changement de WETTY_VERSION), le lanceur l'installe donc avec npm dans le
// dossier de données du plugin — conservé d'une mise à jour à l'autre — puis
// lance WeTTY avec les réglages reçus d'Allkin.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const WETTY_VERSION = "3.2.1";

const settings = JSON.parse(process.env.ALLKIN_PLUGIN_SETTINGS ?? "{}");
const dataDir = process.env.ALLKIN_PLUGIN_DATA ?? join(process.cwd(), "data");
const runtimeDir = join(dataDir, "runtime");
const wettyMain = join(runtimeDir, "node_modules", "wetty", "build", "main.js");

// npm et les scripts de compilation cherchent « node » dans le PATH : celui du
// service systemd ne contient pas forcément le Node qui fait tourner Allkin.
const env = { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? "/usr/bin:/bin"}` };

function installedVersion() {
  try {
    return JSON.parse(readFileSync(join(runtimeDir, "node_modules", "wetty", "package.json"), "utf-8")).version;
  } catch {
    return null;
  }
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: runtimeDir, env, stdio: "inherit" });
    child.on("error", (error) => {
      console.error(`impossible de lancer ${command} : ${error.message}`);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

if (installedVersion() !== WETTY_VERSION) {
  console.log(`Installation de WeTTY ${WETTY_VERSION} dans ${runtimeDir} (une minute au plus)…`);
  mkdirSync(runtimeDir, { recursive: true });
  if (!existsSync(join(runtimeDir, "package.json"))) {
    writeFileSync(join(runtimeDir, "package.json"), '{ "private": true }\n');
  }
  const code = await run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", `wetty@${WETTY_VERSION}`]);
  if (code !== 0 || installedVersion() !== WETTY_VERSION) {
    console.error("L'installation de WeTTY a échoué (voir ci-dessus).");
    process.exit(1);
  }
}

// Correctif de WeTTY 3.2.1 : il lit la version de /usr/bin/env en cherchant
// « (GNU coreutils) » dans sa sortie. Sur les systèmes passés à uutils coreutils
// (Ubuntu 25.10 et suivants), la sortie est « env (uutils coreutils) 0.8.0 » :
// l'analyse lève une exception non rattrapée et le service tombe à la première
// ouverture de terminal. La version ne sert qu'à savoir si `env -S` existe ;
// hors GNU, on répond 0 (pas de -S), ce qui fonctionne partout.
function patchEnvVersion() {
  const file = join(runtimeDir, "node_modules", "wetty", "build", "server", "spawn", "env.js");
  const broken = "resolve(parseInt(stdout.split(/\\r?\\n/)[0].split(' (GNU coreutils) ')[1].split('.')[0], 10));";
  const fixed = "{ const m = /\\(GNU coreutils\\) (\\d+)\\./.exec(stdout); resolve(m ? parseInt(m[1], 10) : 0); } // correctif Allkin";
  try {
    const source = readFileSync(file, "utf-8");
    if (source.includes(broken)) {
      writeFileSync(file, source.replace(broken, fixed));
      console.log("Correctif appliqué : détection de la version de env (uutils coreutils).");
    }
  } catch (error) {
    console.error(`Correctif non appliqué : ${error.message}`);
  }
}
patchEnvVersion();

// Allkin relaie la page sous ce préfixe ; WeTTY sait servir sous un chemin de
// base (web.keepPrefix dans plugin.json).
const base = (process.env.ALLKIN_PLUGIN_BASE_PATH ?? "/wetty/").replace(/\/+$/, "");
const args = [
  wettyMain,
  "--host", "127.0.0.1",
  "--port", String(process.env.PORT ?? settings.port ?? 9310),
  "--base", base,
  "--allow-iframe",
  "--ssh-host", String(settings.sshHost ?? "localhost"),
  "--ssh-port", String(settings.sshPort ?? 22),
  "--ssh-auth", String(settings.sshAuth ?? "password"),
  "--title", String(settings.title ?? "Terminal"),
  "--log-level", "warn",
];
if (settings.sshUser) args.push("--ssh-user", String(settings.sshUser));
if (settings.sshKey) args.push("--ssh-key", String(settings.sshKey));

console.log(`Démarrage de WeTTY sur 127.0.0.1:${args[4]}, base ${base}`);
const wetty = spawn(process.execPath, args, { cwd: runtimeDir, env, stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => wetty.kill(signal));
wetty.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
