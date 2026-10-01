# Text editor

Opens a file of an agent's folder in its own tab.

## Code editor

Every text file opens in the code editor — **80 highlighted languages** (JavaScript,
TypeScript, Python, PHP, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, SQL, YAML, JSON,
HTML/XML, CSS/SCSS, shell, PowerShell, Dockerfile, Makefile, Nginx, LaTeX…), by highlight.js.

- **Language**: detected from the name of the file (extension, `Dockerfile`, `Makefile`, `.env`…)
  or, failing that, guessed from the content. The selector in the header lets you **choose it by
  hand**; the choice is remembered for this file on this device. “Plain text” turns highlighting
  off.
- **Line numbers**, word wrap (button; on by default for plain text), adjustable font size,
  full screen.
- **Find and replace** (Ctrl+F, Ctrl+H): next/previous match, match case, replace one or all;
  **go to line** (Ctrl+G).
- **Writing code**: Tab / Shift+Tab indent the selection (detected unit: tab or spaces), Enter
  keeps the indentation and opens a block after `{`, `[`, `(` or `:`, Ctrl+/ comments or
  uncomments (syntax of the language), Ctrl+D duplicates the line, Ctrl+S saves right away.
  Undo (Ctrl+Z) remains the browser's.
- **Status bar**: line and column, number of lines, indentation, language.
- **Saved as you type** — no “Save” button.

## Markdown, images, PDF

- **Markdown** opens formatted; “Edit” switches to the Markdown editor if the *Markdown editor*
  plugin is installed, to the code editor otherwise. The images and files added to it are stored
  next to the document, in `images/` and `fichiers/`.
- **Images and PDF**: a plain viewer.
- Copy the content or the path, download the file.

Up to six files open per agent: beyond that, the oldest one is closed (after saving).

## For other plugins

The `code-highlight` capability: `highlight(text, language)`, `languageForFilename(name)`,
`languages()`. The explorer uses it to show a script before running it.

`hljs.js` is built from `node_modules/highlight.js` of the allkin repository by
`scripts/hljs-entry.mjs` (the command is at the top of the file).

## Without this plugin

No file tab any more: clicking a file in the explorer downloads it.

## Right requested

- **Allkin interface** — the plugin runs inside the Allkin page, with your session.
