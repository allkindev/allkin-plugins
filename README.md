# allkin-plugins

Les **plugins** d'[Allkin](https://github.com/ctrlmakeit/allkin).

Depuis Allkin, l'icône **Plugins** en bas de la barre latérale lit ce dépôt et affiche les plugins
disponibles ; on installe ceux qu'on veut utiliser. Un plugin installé ne fait rien tout seul : ses
droits s'accordent un par un sur sa page, et son service ne démarre que si on l'autorise.

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
  "version": "1.0.0",                  // semver, à incrémenter à chaque modification
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

- **permissions** — `network`, `filesystem`, `exec`, `root`, `agents`, ou un identifiant propre
  au plugin (affiché à risque élevé). Le service ne démarre pas tant que chacun n'est pas accordé ;
  un droit ajouté dans une nouvelle version n'est jamais accordé d'office.
- **settings** — types `text`, `textarea`, `number`, `boolean`, `secret`, `select` (avec
  `options`). Un `secret` n'est jamais renvoyé au navigateur.
- **service** — lancé sans shell, dans le dossier du plugin. `node` désigne le Node d'Allkin ;
  une commande en `./` est un fichier du plugin (le rendre exécutable dans le dépôt).
- **web** — suppose un service. `port` fixe ou `portSetting` (un réglage `number`). La page
  s'ouvre dans un onglet d'Allkin, relayée sous `/plugins/<id>/web/`.

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
`npm install`. Un plugin qui en a besoin embarque ses dépendances déjà construites.
