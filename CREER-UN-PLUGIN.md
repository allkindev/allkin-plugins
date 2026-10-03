# Créer un plugin Allkin

Guide pas à pas. Le format complet du manifeste et l'API des plugins d'interface sont décrits dans
le [README](README.md) ; ce document dit **comment s'y prendre**, et ce qu'on a appris en chemin.

Les **règles** elles-mêmes — ce qu'un plugin doit et devrait respecter — sont dans le
[standard](https://github.com/allkindev/allkin-plugins-experimental/blob/main/plugins/creator/standard/PLUGIN-STANDARD.md) ; celles d'un service dans
[SERVICE-STANDARD.md](https://github.com/allkindev/allkin-plugins-experimental/blob/main/plugins/creator/standard/SERVICE-STANDARD.md). Le plugin **Creator** les
vérifie (bouton *Vérifier* de son établi) et son agent écrit un plugin conforme en conversation :
c'est la voie la plus courte.

Trois sortes de plugins, combinables :

| Sorte | Manifeste | Exemple dans ce dépôt |
|-------|-----------|------------------------|
| **Service** — un programme qui tourne en continu | `service` | `wetty` |
| **Page web** — le service sert une page, affichée dans un onglet d'Allkin | `service` + `web` | `wetty` |
| **Interface** — des morceaux de l'interface d'Allkin elle-même | `ui` | `file-explorer`, `text-editor`, `markdown-editor`, `promptr` |
| **Agent** — un agent dédié, auquel le plugin confie ses tâches | `agent` | `promptr` |

---

## 1. Exemple complet : un service avec sa page web

Le plus petit plugin utile : un serveur HTTP sans dépendance, qui affiche ses réglages dans un
onglet d'Allkin. Il a longtemps été publié ici sous le nom `bonjour`.

```
plugins/bonjour/
├── plugin.json
├── validation.json
├── README.md
├── icon.svg
├── package.json
└── server.js
```

`validation.json` dit si le propriétaire d'Allkin a vérifié le plugin : `{ "status": "pending" }`
au départ — tout le monde peut l'installer, sans garantie de fonctionnement, et l'interface
l'affiche « En cours de validation » — puis `{ "status": "validated", "date": "2026-10-01",
"by": "Tony" }` une fois vérifié. Fichier absent = en attente. Seul le propriétaire le passe à
`validated`.

### `plugin.json`

```json
{
  "name": "Bonjour",
  "version": "1.0.0",
  "description": "Plugin d'exemple : un petit serveur web qui affiche ses réglages dans un onglet d'Allkin.",
  "author": "Allkin",
  "permissions": [
    { "id": "network", "reason": "Écoute sur un port local pour servir sa page dans Allkin." }
  ],
  "settings": [
    {
      "key": "port",
      "label": "Port local",
      "type": "number",
      "default": 9301,
      "required": true,
      "help": "Port sur lequel le service écoute (127.0.0.1 uniquement). Allkin relaie la page."
    },
    {
      "key": "greeting",
      "label": "Message d'accueil",
      "type": "text",
      "default": "Bonjour depuis un plugin Allkin !",
      "help": "Affiché en haut de la page du plugin."
    },
    {
      "key": "token",
      "label": "Jeton d'exemple",
      "type": "secret",
      "help": "Un secret n'est jamais renvoyé au navigateur : la page dit seulement s'il est renseigné."
    }
  ],
  "service": {
    "command": "node",
    "args": ["server.js"]
  },
  "web": {
    "portSetting": "port",
    "path": "/"
  }
}
```

- Le **droit `network`** est déclaré avec une raison : c'est elle que l'utilisateur lit avant de
  cocher.
- Le **port** est un réglage (`portSetting`) plutôt qu'une valeur fixe : deux plugins ne doivent
  pas se battre pour le même.
- Un réglage **`secret`** n'est jamais renvoyé au navigateur.

### `server.js`

```js
// Service du plugin Bonjour : un serveur HTTP sans dépendance.
//
// Allkin lui transmet tout par l'environnement et relaie sa page sous
// /plugins/bonjour/web/ : les liens sont donc écrits en RELATIF.
import { createServer } from "node:http";

const settings = JSON.parse(process.env.ALLKIN_PLUGIN_SETTINGS ?? "{}");
const port = Number(process.env.PORT ?? settings.port ?? 9301);
const startedAt = new Date();

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const server = createServer((req, res) => {
  if (req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, startedAt, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bonjour</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem; color: #1f2328; background: #fafaf9; }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; background: #161618; } }
  code { font-size: .9em; }
</style>
<h1>${escape(settings.greeting ?? "Bonjour")}</h1>
<p>Service démarré le ${startedAt.toLocaleString("fr-FR")}.</p>
<ul>
  <li>Données : <code>${escape(process.env.ALLKIN_PLUGIN_DATA)}</code></li>
  <li>Préfixe dans Allkin : <code>${escape(req.headers["x-forwarded-prefix"] ?? "—")}</code></li>
  <li>Jeton : ${process.env.PLUGIN_TOKEN ? "renseigné" : "vide"}</li>
</ul>
<p><a href="api/status">api/status</a> (lien relatif : il reste sous le préfixe)</p>`);
});

server.listen(port, "127.0.0.1", () => console.log(`écoute sur 127.0.0.1:${port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
```

### `package.json`

```json
{ "type": "module", "private": true }
```

Nécessaire pour que `import` fonctionne dans un `.js`.

### `icon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z"/></svg>
```

Un tracé sans fond, 24×24 : Allkin le pose sur une pastille teintée.

### `README.md`

C'est la page **Documentation** du plugin, lisible avant installation. Y dire à quoi il sert,
comment le mettre en route, ce que fait chaque réglage et pourquoi chaque droit est demandé. Voir
les README de `wetty` et `file-explorer` pour le ton.

---

## 2. Tester en local, sans publier

Le plus simple : ajouter le dossier du dépôt comme **dépôt local** (page Plugins → bouton
**Dépôts** → le chemin du dossier). Allkin le lit en direct : pas de `catalogue.json` à
régénérer, pas de serveur à lancer, « Installer » copie le dossier tel quel. La méthode ci-dessous
reste utile pour tester le catalogue lui-même, tel qu'il sera publié.

1. Servir ce dépôt sur la machine :

   ```bash
   cd allkin-plugins-experimental
   node scripts/catalogue.mjs                          # régénère catalogue.json
   python3 -m http.server 8765 --bind 127.0.0.1
   ```

2. Pointer une instance Allkin **de test** vers ce catalogue, dans son `~/.allkin/config.json` :

   ```json
   { "pluginsRepoUrl": "http://127.0.0.1:8765" }
   ```

   Une instance isolée évite de toucher à la vraie : `HOME=/tmp/allkin-test npx tsx src/cli.ts serve`
   depuis le dépôt Allkin, avec un `config.json` qui fixe `webPort` (ex. 9292). Garder ce chemin
   **court** : le socket Unix d'Allkin (`~/.allkin/allkin.sock`) ne supporte pas plus de 107
   caractères.

3. Page Plugins → ↻ → installer, accorder les droits, autoriser le service, ouvrir la page.
   Le **journal du service** est sur la page du plugin ; il est aussi dans
   `~/.allkin/plugin-data/<id>/service.log`.

Après chaque modification : régénérer `catalogue.json`, puis « Mettre à jour » dans Allkin (ou
réinstaller). Sans régénération, Allkin refuse l'installation : l'empreinte d'un fichier ne
correspond plus.

---

## 3. Publier

Un nouveau plugin se publie dans le dépôt **expérimental**
([allkin-plugins-experimental](https://github.com/allkindev/allkin-plugins-experimental)), avec
`validation.json` à `{ "status": "pending" }`. Il y reste tant que le propriétaire d'Allkin ne l'a
pas validé ; il passe alors dans le dépôt stable, où `validation.json` dit `validated`. Chaque
dépôt a son `catalogue.json`, et son `scripts/catalogue.mjs` refuse un plugin qui n'est pas à sa
place.

```bash
node scripts/catalogue.mjs --check   # doit dire « à jour »
git add -A && git commit && git push
```

Côté propriétaire, deux scripts font tout :

```bash
~/git_validate_plugin.sh mon-plugin  # expérimental → stable, validation.json mis à « validated »
~/git_commit_plugins.sh              # versions N+1, catalogues, commit et push des deux dépôts
```

- **Incrémenter `version`** dans `plugin.json` à chaque changement : c'est ce qui fait apparaître
  « Mettre à jour » chez ceux qui l'ont installé. **Règle stricte** : la version a toujours la forme
  `1.0.N` et seul `N` augmente, de 1, à chaque modification (`1.0.7` → `1.0.8`). Jamais `1.1.0`,
  jamais `1.0008` (Allkin le lirait comme `1.8`). Un plugin aussi livré avec Allkin porte le même
  numéro des deux côtés pour le même contenu.
- GitHub met jusqu'à **5 minutes** à servir la nouvelle version des fichiers bruts, et Allkin garde
  le catalogue **une heure** en cache : le bouton ↻ de la page Plugins force la relecture.
- Les deux dépôts doivent rester **publics** : Allkin lit les fichiers sans authentification.

---

## 4. Pièges connus

### Page web

- **Liens relatifs.** La page est servie sous `/plugins/<id>/web/`. Un lien `/api/status` sort du
  préfixe ; `api/status` y reste.
- **Application qui gère déjà un chemin de base** (`--base`, `BASE_URL`…) : mettre
  `"keepPrefix": true` dans `web`, et lui passer `ALLKIN_PLUGIN_BASE_PATH` sans la barre finale.
  Sans cela, Allkin retire le préfixe et ajoute une barre finale ; WeTTY, qui redirige dans l'autre
  sens, tournait en boucle.
- **Écouter sur `127.0.0.1`** : Allkin relaie la page (HTTP et WebSocket), le port n'a pas à être
  exposé. Pas d'authentification à écrire : seule une session Allkin atteint la page.
- **En-têtes de sécurité** : Allkin retire `X-Frame-Options` (la page vit dans un onglet) et, quand
  il est joint en HTTP simple, la directive CSP `upgrade-insecure-requests` (elle faisait basculer
  la page en HTTPS). Le reste de la politique du plugin est conservé.

### Service

Un service qui a le droit `agents` reçoit aussi `ALLKIN_SOCKET` (la socket Unix d'Allkin, même
protocole que la ligne de commande : `list_agents`, `attach`, `message`, `approval_response`,
`form_response`) et `ALLKIN_DIR`. C'est ainsi qu'un plugin fait parler un agent depuis un autre
canal — voir `plugins/telegram-bridge/bridge.mjs`, le modèle à copier.

- **Pas de shell.** `command` et `args` partent tels quels. `node` désigne le Node d'Allkin (le
  PATH d'une unité systemd ne contient pas forcément celui de nvm) ; `./script` est cherché dans le
  dossier du plugin.
- **Écrire seulement dans `ALLKIN_PLUGIN_DATA`.** Le dossier du plugin est remplacé à chaque mise à
  jour.
- **Dépendances npm.** Allkin copie les fichiers, il ne lance pas `npm install`. Un plugin qui en a
  besoin les installe **au démarrage**, dans `ALLKIN_PLUGIN_DATA` (voir `wetty/start.mjs`). C'est la
  seule voie pour un module natif comme `node-pty`, compilé pour la machine. Le premier démarrage est
  alors plus long : le dire dans le README.
- **Arrêt propre.** Allkin envoie `SIGTERM` au groupe de processus, puis `SIGKILL` après 5 s.
- **Plantages.** Relancé avec une attente qui double ; abandon après 5 échecs en moins de 30 s
  chacun. Une exception non rattrapée tue le service : WeTTY 3.2.1 tombait à la première ouverture
  de terminal parce qu'il ne savait pas lire `env --version` sous **uutils coreutils** (Ubuntu
  25.10+). Tester sur la vraie machine, pas seulement sur un poste de développement.
- **Réglages = redémarrage.** Ils arrivent par l'environnement : les modifier redémarre le service.

### Interface

- **Envelopper chaque script** dans `(() => { … })();` : tous les scripts de la page partagent la
  même portée globale, un nom déclaré au premier niveau entrerait en collision.
- **Ne dépendre que de `window.Allkin`** (et des bibliothèques globales d'Allkin : `renderMarkdown`,
  `highlightCode`, `createCodeLayer`…). Chercher une fonction d'`app.js` par son nom marcherait
  aujourd'hui et casserait à la prochaine version.
- **Résoudre une capacité au moment de s'en servir** (`Allkin.capability("text-editor")` dans le
  gestionnaire de clic), pas au chargement : l'ordre de chargement des plugins n'est pas garanti.
  Prévoir son absence — c'est une fonction qui disparaît, pas une erreur.
- **CSS** : une règle de plugin passe après `style.css`. Préfixer ses classes (`.data-`, `.file-`…)
  plutôt que de redéfinir celles du cœur.
- **Tester avec et sans chaque plugin dont on dépend**, puis recharger la page : les onglets
  restaurés d'une nature disparue doivent être écartés sans erreur.
- Changer `ui.apiVersion` n'est à faire que si Allkin a changé la version de son API.
- **Une app** (une entrée du menu Allkin) se déclare avec `Allkin.registerApp` : ne pas s'insérer
  soi-même dans la page, dont les éléments changent d'une version à l'autre.

### Agent

- **Écrire le rôle pour un programme, pas pour un humain.** L'agent reçoit des tâches de
  l'interface du plugin : son `agent.md` dit, tâche par tâche, quoi rendre et entre quelles balises.
  Côté interface, une réponse sans la balise attendue est une erreur à afficher — c'est souvent le
  fournisseur IA qui a échoué (clé invalide, quota) et rendu son message comme du texte.
- **Donner le format dans la tâche** quand l'interface le connaît mieux que le rôle : Promptr
  génère la description d'un plan depuis `blocks.js` et l'envoie avec chaque analyse, pour que
  l'interface et l'agent parlent toujours du même format.
- **Prévoir l'attente** : une tâche prend de quelques secondes à plusieurs minutes. Montrer qu'on
  travaille, et ne rien bloquer d'autre.
