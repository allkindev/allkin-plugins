# allkin-plugins

Les **plugins** d'[Allkin](https://github.com/allkindev/allkin).

Depuis Allkin, l'icône **Plugins** en bas de la barre latérale lit ce dépôt et affiche les plugins
disponibles ; on installe ceux qu'on veut utiliser. Un plugin installé ne fait rien tout seul : ses
droits s'accordent un par un sur sa page, et son service ne démarre que si on l'autorise.

Pour en écrire un : **[Créer un plugin](CREER-UN-PLUGIN.md)** — exemple complet, test en local,
publication et pièges connus.

---

## Structure d'un plugin

```
plugins/<id>/
├── plugin.json    obligatoire — nom, version, droits, réglages, service, page web
├── README.md      obligatoire — la page Documentation, lisible avant installation
├── icon.svg       facultatif  — la vignette (icon.png / icon.webp acceptés)
└── …              le code du plugin
```

Le nom du dossier est l'identifiant du plugin : il ne change jamais.

## `plugin.json`

```jsonc
{
  "name": "Mon plugin",
  "version": "1.0.0",                  // à changer à chaque modification (voir git_commit_plugins.sh)
  "description": "Une phrase.",
  "author": "Moi",
  "homepage": "https://…",             // facultatif
  "permissions": [                     // ce que l'utilisateur devra accorder
    { "id": "network", "reason": "Pourquoi le plugin en a besoin" }
  ],
  "settings": [                        // la page Configuration
    { "key": "port", "label": "Port", "type": "number", "default": 9301, "required": true, "help": "…" }
  ],
  "service": { "command": "node", "args": ["server.js"], "env": {} },   // facultatif
  "web": { "portSetting": "port", "path": "/" }                          // facultatif
}
```

- **permissions** — `network`, `filesystem`, `exec`, `root`, `agents`, `interface`, `agent`, ou
  un identifiant propre au plugin (affiché à risque élevé). Le service ne démarre pas tant que chacun n'est pas accordé ;
  un droit ajouté dans une nouvelle version n'est jamais accordé d'office.
- **settings** — types `text`, `textarea`, `number`, `boolean`, `secret`, `select` (avec
  `options`). Un `secret` n'est jamais renvoyé au navigateur.
- **service** — lancé sans shell, dans le dossier du plugin. `node` désigne le Node d'Allkin ;
  une commande en `./` est un fichier du plugin (le rendre exécutable dans le dépôt).
- **web** — suppose un service. `port` fixe ou `portSetting` (un réglage `number`). La page
  s'ouvre dans un onglet d'Allkin, relayée sous `/plugins/<id>/web/`.
  `keepPrefix: true` transmet le chemin complet au lieu de retirer le préfixe : pour les
  applications qui savent servir sous un chemin de base (`--base`, `BASE_URL`…) et écrivent
  leurs liens en absolu. Elles reçoivent ce chemin dans `ALLKIN_PLUGIN_BASE_PATH`.

## Plugins d'interface

Un plugin peut apporter une partie de l'interface d'Allkin elle-même — c'est le cas de
`file-explorer`, `text-editor` et `markdown-editor`, livrés avec Allkin. Il déclare une section `ui`
et le droit `interface` :

```jsonc
{
  "permissions": [{ "id": "interface", "reason": "…" }],
  "ui": {
    "apiVersion": 1,                  // version de window.Allkin visée
    "provides": ["file-explorer"],    // capacités fournies (affichage)
    "html": ["view.html"],            // fragments posés dans la page
    "styles": ["explorer.css"],
    "scripts": ["explorer.js"]        // exécutés dans l'ordre, après le HTML et les styles
  }
}
```

Chaque fragment HTML contient des `<template data-slot="…">`, posés à l'emplacement nommé :
`views` (le panneau principal), `chat-menu` (le menu ⋮ de l'en-tête), `body` (fenêtres, modèles).

Les scripts s'adressent à `window.Allkin` :

| Appel | Rôle |
|-------|------|
| `registerTabKind(kind, def)` | Déclare une nature d'onglet : `panels`, `icon`, `label(tab)`, `meta`, `tooltip(tab)`, `byPath`, `maxPerAgent`, `scroller()`, `scrollKeySuffix(tab)`, `activate(tab)`, `leave(tab)`, `beforeClose(tab)`, `menu: { title, onShow }` |
| `provide(name, impl)` / `capability(name)` | Fournit / utilise une capacité (`markdown-editor`, `text-editor`, `file-explorer`) |
| `hasTabKind(kind)` | Une nature d'onglet est-elle disponible |
| `registerApp({ key, name, meta, icon, open })` | Ajoute une entrée à la liste Plugins du menu Allkin |
| `core` | Le cœur : `state`, `el`, `api`, `openTab`, `activeTab`, `persistTabs`, `applyScroll`, `copyToClipboard`, `formatSize`, `dataFileUrl`, `agentName`, `toast(message, "ok" \| "ko")`, `runPluginAgent(id, prompt)`… |

Un script s'enveloppe dans une fonction (`(() => { … })();`) : tous les scripts de la page partagent
la même portée globale. Activer ou retirer un plugin d'interface demande de recharger la page.

## Un plugin, un agent

Un plugin peut disposer de **son propre agent** : Allkin le crée, le tient à jour et le retire
avec le plugin. Il déclare une section `agent` et le droit `agent` :

```jsonc
{
  "permissions": [{ "id": "agent", "reason": "…" }],
  "agent": {
    "name": "Promptr",                // son nom, dans la liste des agents
    "description": "…",              // facultatif, 100 caractères au plus
    "prompt": "agent.md",            // son rôle (CLAUDE.md), un fichier .md du plugin
    "model": "…", "effort": "…", "thinking": "…"   // facultatifs
  }
}
```

- L'agent naît dès que **tous les droits** du plugin sont accordés. Son identifiant est
  `plugin-<id>` ; il porte un badge « Plugin » dans la liste des agents.
- **Aucun droit** : ni commandes, ni fichiers hors de son dossier, ni web, ni autres agents. Personne
  ne peut lui en donner, et les autres agents ne peuvent pas le solliciter.
- Son **rôle appartient au plugin** : `prompt` est rétabli à chaque mise à jour, et ne se modifie pas
  depuis Allkin. Son modèle et sa description restent réglables sur sa page Agent.
- Il ne se supprime pas à la main : il part avec le plugin, à la désinstallation.

L'interface du plugin lui confie une tâche et reçoit le texte complet de sa réponse :

```js
const text = await Allkin.core.runPluginAgent("mon-plugin", "TÂCHE : …");
```

(ou `POST /api/plugins/<id>/agent/run` avec `{ "prompt": "…" }` → `{ "text": "…" }`). Chaque tâche
tourne dans une session jetable, invisible et sans notification ; personne n'y valide de commande
ni ne remplit de formulaire, les deux sont refusés d'office. L'attente peut durer plusieurs
minutes (5 au plus). Le rôle de l'agent doit donc dire exactement quoi rendre, et sous quelle forme
— des balises (`<prompt>…</prompt>`) se relisent bien mieux qu'un texte libre. Voir `promptr`.

## Ce que reçoit le service

| Variable                  | Contenu                                            |
|---------------------------|----------------------------------------------------|
| `ALLKIN_PLUGIN_ID`        | L'identifiant                                      |
| `ALLKIN_PLUGIN_DIR`       | Le dossier du plugin (remplacé à chaque mise à jour) |
| `ALLKIN_PLUGIN_DATA`      | Le dossier où écrire ses données (conservé)        |
| `ALLKIN_PLUGIN_SETTINGS`  | Tous les réglages, en JSON                         |
| `PLUGIN_<CLÉ>`            | Chaque réglage (`PLUGIN_PORT`…)                    |
| `PORT`                    | Le port à écouter (plugins web)                    |
| `ALLKIN_PLUGIN_BASE_PATH` | Le préfixe de la page dans Allkin                  |

Modifier un réglage redémarre le service. Sa sortie est visible dans le journal, sur la page du
plugin. **N'écrire que dans `ALLKIN_PLUGIN_DATA`** : le dossier du plugin est remplacé à chaque
mise à jour.

## Écrire la page web

- Écouter sur `127.0.0.1` : Allkin relaie la page, personne n'a besoin de joindre le port.
- Écrire les liens **en relatif** (`api/status`, pas `/api/status`) : la page vit sous un préfixe.
- Pas d'authentification à prévoir : seule une session Allkin ouverte accède à la page.

## Publier

```bash
node scripts/catalogue.mjs          # vérifie les plugins et régénère catalogue.json
node scripts/catalogue.mjs --check  # vérifie seulement (pour la CI)
```

Le catalogue contient la taille et l'empreinte de chaque fichier : Allkin refuse d'installer un
plugin dont un fichier ne correspond pas. **Relancer le script après chaque modification**, et
committer `catalogue.json` avec le reste.

Plugins sans dépendances de préférence : Allkin copie les fichiers tels quels, il ne lance pas de
`npm install`. Un plugin qui en a besoin les installe lui-même au démarrage, dans
`ALLKIN_PLUGIN_DATA` (voir `plugins/wetty/start.mjs`) — c'est la seule voie pour un module natif,
compilé pour la machine.
