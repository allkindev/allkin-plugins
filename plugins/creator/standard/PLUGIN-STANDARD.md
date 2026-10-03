# Allkin plugin standard

The rules every Allkin plugin follows. "Must" is checked by Allkin or by the
workshop's check (an **error**); "should" is asked by the standard (a
**warning**). A plugin with no error installs; a plugin with no error and no
warning is conformant.

## 1. What a plugin is

A plugin is one folder. Its name is the plugin's **identifier**: lowercase
letters, digits and hyphens, 64 characters at most, never renamed.

```
plugins/<id>/
├── plugin.json        must   the manifest
├── README.md          must   documentation, in French
├── README-EN.md       should documentation, in English
├── README-ES.md       should documentation, in Spanish
├── README-DE.md       should documentation, in German
├── validation.json    should { "status": "pending" }
├── icon.svg           should the tile (icon.png / icon.webp / icon.jpg accepted)
└── …                  the plugin's own files
```

Bounds: 500 files, 20 MB per file, 100 MB in all. File and folder names use
only `A-Z a-z 0-9 . _ -` and never start with a dot or a hyphen. `node_modules`
and `.git` are never part of a plugin.

A plugin is made of **parts**, each optional, freely combined:

| Part | Manifest field | What it is |
|------|----------------|------------|
| Service | `service` | a program Allkin keeps running |
| Web page | `web` (needs `service`) | a page served by the service, shown in an Allkin tab |
| Interface | `ui` | pieces of Allkin's own page: tabs, apps, menus |
| Agent | `agent` | a dedicated agent the plugin hands tasks to |

Installing starts nothing: a plugin arrives with no right granted. The user
grants each right on the plugin's page; the service, the interface and the
agent only exist once **every** declared right is granted.

## 2. The manifest: `plugin.json`

```jsonc
{
  "name": "Mon plugin",                // must — shown everywhere, in French
  "version": "1.0.0",                  // must — see §3
  "description": "Une phrase.",        // must — one or two sentences, in French
  "author": "Moi",                     // should
  "homepage": "https://…",             // optional
  "permissions": [ … ],                // §4
  "settings": [ … ],                   // §5
  "service": { … },                    // §6
  "web": { … },                        // §7
  "ui": { … },                         // §8
  "agent": { … },                      // §9
  "locales": { "en": {…}, "es": {…}, "de": {…} }   // should — §10
}
```

Unknown fields are ignored. A field of the wrong type refuses the manifest.

## 3. Version: `1.0.N`, nothing else

- The version always has the form `1.0.N`: `1` and `0` fixed, `N` an integer
  without leading zero. A new plugin starts at `1.0.0`.
- **Every change** to any file of the plugin raises `N` by exactly 1, in the
  same change. One bump per batch of changes, never zero, never two.
- Forbidden: `1.1.0`, `2.0.0`, `1.0.08`, `1.0008`, going backwards, skipping.

Allkin compares versions number by number and offers an update only when the
number grows: files changed under the same number are never delivered.

## 4. Rights: `permissions`

```json
"permissions": [{ "id": "network", "reason": "Écoute sur un port local pour servir sa page." }]
```

Declare exactly what the plugin uses, each with a `reason` — the sentence the
user reads before granting it. Say what the plugin does with the right, not
what the right is.

| id | Grants | Needed for |
|----|--------|-----------|
| `network` | network access | a service that listens or calls out; an agent that reads the web |
| `filesystem` | files outside the plugin's own data | a service that reads or writes elsewhere |
| `exec` | running other programs | a service that spawns commands |
| `root` | administrator privileges | almost never — say why at length |
| `agents` | talking to the user's agents | a service using `ALLKIN_SOCKET` |
| `interface` | adding to Allkin's page | **any** `ui` section |
| `agent` | a dedicated agent | **any** `agent` section |
| `repository` | its agent's folder as a source of plugins and services | `repository: true` |

Any other id is accepted and shown as high risk. A right added in a later
version is never granted automatically.

## 5. Settings: `settings`

Each entry becomes a field of the plugin's Configuration page.

```json
{ "key": "port", "label": "Port local", "type": "number", "default": 9301, "required": true, "help": "…" }
```

- `key`: letters, digits and underscores; unique. `label`: must. `help` and
  `placeholder`: optional.
- `type`: `text`, `textarea`, `number`, `boolean`, `secret`, `select` (with
  `options: [{ "value", "label" }]`), `service` (with `capability`: one of the
  user's connected services able to do that — the plugin receives its
  identifier, never its key).
- A `secret` is never sent back to the browser.
- A `required` setting left empty keeps the service stopped.

## 6. Service: `service`

```json
"service": { "command": "node", "args": ["server.js"], "env": {} }
```

- Started **without a shell**, in the plugin's folder. `node` is Allkin's own
  Node; a command starting with `./` is a file of the plugin (executable bit
  set). Arguments are passed as they are.
- A `.js` file using `import` needs a `package.json` holding
  `{ "type": "module", "private": true }` (or use the `.mjs` extension).
- Environment received:

  | Variable | Content |
  |----------|---------|
  | `ALLKIN_PLUGIN_ID` | the identifier |
  | `ALLKIN_PLUGIN_DIR` | the plugin's folder — read-only by convention |
  | `ALLKIN_PLUGIN_DATA` | the only folder to write in; survives updates |
  | `ALLKIN_PLUGIN_SETTINGS` | every setting, as JSON |
  | `PLUGIN_<KEY>` | each setting, upper-cased key |
  | `PORT`, `ALLKIN_PLUGIN_BASE_PATH` | when the plugin has a `web` part |
  | `ALLKIN_SOCKET`, `ALLKIN_DIR` | with the `agents` right |

- **Write only in `ALLKIN_PLUGIN_DATA`**: the plugin's folder is replaced on
  every update.
- Allkin copies files, it never runs `npm install`: a plugin with npm
  dependencies installs them itself at first start, into `ALLKIN_PLUGIN_DATA`.
  Prefer no dependency at all.
- Stop cleanly on `SIGTERM` (then `SIGKILL` after 5 s). A crash is restarted
  with a growing delay; five quick failures stop the retries.
- Changing a setting restarts the service: settings arrive by the environment.
- What the service prints is its log, shown on the plugin's page. Log what
  helps to diagnose, never a secret.

## 7. Web page: `web`

```json
"web": { "portSetting": "port", "path": "/" }
```

- Needs a `service`. The port is `port` (fixed) or `portSetting` (the key of a
  `number` setting) — prefer the setting: two plugins must not fight for a port.
- Listen on `127.0.0.1` only. Allkin relays the page (HTTP and WebSocket) under
  `/plugins/<id>/web/`; only a signed-in user reaches it, so the plugin writes
  no authentication.
- **Relative links only** (`api/status`, never `/api/status`): an absolute
  link leaves the prefix. An application that handles a base path itself sets
  `"keepPrefix": true` and reads `ALLKIN_PLUGIN_BASE_PATH`.
- Support light and dark (`prefers-color-scheme`).

## 8. Interface: `ui`

```json
"ui": {
  "apiVersion": 1,
  "provides": ["my-capability"],
  "html": ["view.html"],
  "styles": ["my.css"],
  "scripts": ["locales.js", "app.js"]
}
```

- Needs the `interface` right. `apiVersion` is `1`.
- **HTML** fragments hold `<template data-slot="…">` elements, placed in the
  slot named: `views` (the main panel), `chat-menu` (the ⋮ menu), `body`
  (dialogs, templates). A view starts hidden: `<div class="xx-view hidden" id="xx-view">`.
- **Scripts** run in order, after the HTML and the styles. Each is wrapped in
  `(() => { … })();`: all scripts of the page share one global scope.
- Use **only `window.Allkin`** and the global libraries Allkin documents. Never
  call a function of Allkin's own code by its name: it will break.

  | Call | Use |
  |------|-----|
  | `Allkin.registerTabKind(kind, def)` | a kind of tab: `panels`, `icon`, `label(tab)`, `tooltip(tab)`, `activate(tab)`, `leave(tab)`, `beforeClose(tab)`, `byPath`, `scroller()` |
  | `Allkin.registerApp({ key, name, meta, icon, open })` | an entry in the Plugins list of the Allkin menu |
  | `Allkin.provide(name, impl)` / `Allkin.capability(name)` | offer / use a capability (`text-editor`, `markdown-editor`, `file-explorer`…) |
  | `Allkin.t(key, vars)` / `Allkin.tn(key, count)` / `Allkin.i18n` | translation (§10) |
  | `Allkin.core.api(path, options)` | Allkin's HTTP API, with the user's session |
  | `Allkin.core.openTab(agentId, kind, { path, name })` | open a tab |
  | `Allkin.core.toast(message, "ok" \| "ko")` | the result of an action — always through this |
  | `Allkin.core.confirm(options)` / `Allkin.core.prompt(options)` | the application's own dialogs, never the browser's |
  | `Allkin.core.runPluginAgent(id, prompt)` | hand a task to the plugin's agent (§9) |
  | `Allkin.core.sendToAgent(agentId, text)` / `Allkin.core.openSplit(agentId, "chat")` | direct an agent's conversation / show it on the right |
  | `Allkin.core.state`, `el`, `escapeHtml`, `copyToClipboard`, `formatSize`, `formatDateTime`… | the rest of the core |

- Resolve a capability **when using it** (in the click handler), not at load:
  load order is not guaranteed. Its absence is a missing function, not an error.
- **CSS**: prefix every class with the plugin's own short prefix (`.xx-…`);
  never restyle a class of the core. Use Allkin's variables (`--bg`,
  `--bg-raised`, `--border`, `--text`, `--text-dim`, `--accent`, `--sp-1…4`)
  so the plugin follows the theme. Font sizes come from the scale
  (`--text-2xs` … `--text-3xl`), weights are 400, 500, 600 or 700.
- Never build HTML from data with string concatenation: `textContent`, or
  `Allkin.core.escapeHtml`.
- Activating or removing an interface plugin needs a reload of the page.

## 9. Agent: `agent`

```json
"agent": { "name": "Promptr", "description": "…", "prompt": "agent.md" }
```

- Needs the `agent` right. The agent's id is `plugin-<id>`; it is created when
  every right is granted, and removed with the plugin.
- `prompt` is one Markdown file, or a list of them joined in order. It is the
  agent's whole role, restored on every update: nobody edits it from Allkin.
- The agent has **no right** on the machine: no command, no file outside its
  own folder, no other agent. Two options widen it, each visible to the user:
  `"web": true` (reads the web; needs `network`) and `"workspace": true` (its
  folder is `plugin-data/<id>/workspace`, kept when the plugin is removed).
- `model`, `effort`, `thinking` are optional starting values.
- Write the role **for a program**: the agent receives tasks from the plugin's
  interface. Say, task by task, what to return and between which tags
  (`<result>…</result>`). The interface treats an answer without the expected
  tag as an error to show.
- A task takes seconds to minutes (5 at most): the interface shows it is
  working and blocks nothing else.

## 10. Languages

No text shown to the user is hard-coded in one language. Four languages:
French, English, Spanish, German.

- **Manifest**: written in French; `locales.en`, `locales.es`, `locales.de`
  carry `name`, `description`, `permissions: { "<id>": "reason" }` and
  `settings: { "<key>": { "label", "help", "placeholder", "options" } }`.
- **Documentation**: `README.md` in French, plus `README-EN.md`,
  `README-ES.md`, `README-DE.md`.
- **Interface**: a script named `locales.js`, first in `scripts`, registers the
  four dictionaries; every key starts with `plugin.<id>.`:

  ```js
  (() => {
    Allkin.i18n.register("en", { "plugin.notes.title": "Notes" });
    Allkin.i18n.register("fr", { "plugin.notes.title": "Notes" });
    Allkin.i18n.register("es", { "plugin.notes.title": "Notas" });
    Allkin.i18n.register("de", { "plugin.notes.title": "Notizen" });
  })();
  ```

  Markup carries `data-i18n="plugin.notes.title"` (also `data-i18n-title`,
  `-placeholder`, `-aria-label`); scripts call `Allkin.t()` / `Allkin.tn()`.
  English is the fallback.
- **A service or a web page** picks its language from a setting of its own.
- Code, comments and log lines are in English. Code never tests the wording of
  a message — a status, a code or an error class.

## 11. Documentation: the README

The README is the plugin's Documentation page, readable before installing. It
says, in this order: what the plugin is for; how to start using it; what each
setting does; why each right is asked; what to do when it does not work.

## 12. Validation: `validation.json`

`{ "status": "pending" }` — always, for a new plugin. Only the owner of Allkin
turns it into `{ "status": "validated", "date": "…", "by": "…" }` after checking
it. An author never writes `validated`.

## 13. Conformance checklist

1. The folder name is a valid identifier.
2. `plugin.json` parses, with `name`, `version` (`1.0.N`) and `description`.
3. Every right used is declared with a `reason`; `ui` → `interface`,
   `agent` → `agent`.
4. Every file named in the manifest exists.
5. `README.md` and its three translations exist and are real documentation.
6. `validation.json` says `pending`; an icon is present.
7. `locales` holds `en`, `es`, `de`; an interface has `locales.js` with keys
   under `plugin.<id>.`.
8. Interface scripts are wrapped and use only `window.Allkin`.
9. The service writes only in `ALLKIN_PLUGIN_DATA`, listens on `127.0.0.1`,
   stops on `SIGTERM`.
10. The version was raised by 1 for this batch of changes.
