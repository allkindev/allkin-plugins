# Markdown editor

Allkin's Markdown editor. You write **in the formatted document**: a heading is a heading, a table
is a table, and no tag (`**`, `#`, `|`…) shows on screen. The file itself stays ordinary
Markdown.

## Where it is used

- **Missions** — the text of each card.
- **Role of an agent** — the “Role” section of its page, and the writing of the role in the agent
  creation assistant.
- **`.md` files** — with the *Text editor* plugin, which uses it for Markdown files.

## The toolbar

| Group | What you find there |
| --- | --- |
| History | Undo, redo |
| Block style | Text, Heading 1, Heading 2, Heading 3 — the button always says where you are |
| Text | Bold, italic, strikethrough, code, link |
| Lists | Bullets, numbers, checkboxes |
| Blocks | Quote, code block, table, divider |
| Media | Image, attached file |
| Raw Markdown | The text as it is written in the file |

Buttons light up according to where the cursor is. Hovering a button gives its name and its
shortcut.

## Writing faster

- **`/`** at the start of a line opens the menu of blocks: type a few letters, then <kbd>Enter</kbd>.
- If you know Markdown you can keep typing it — `# `, `- `, `1. `, `[] `, `> `, `**bold**`,
  `` `code` ``, `[text](address)`… are converted on the fly. `---` then <kbd>Enter</kbd> puts a
  divider, ` ``` ` then <kbd>Enter</kbd> opens a code block.
- Pasting Markdown, or a passage copied from a web page, keeps its formatting.

| Shortcut | Effect |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>E</kbd> | Bold, italic, code |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> | Strikethrough |
| <kbd>Ctrl</kbd>+<kbd>K</kbd> | Link |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>3</kbd>, <kbd>0</kbd> | Heading 1 to 3, text |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Undo, redo |
| <kbd>Tab</kbd>, <kbd>Shift</kbd>+<kbd>Tab</kbd> | Indent or outdent a list item; next or previous cell |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Open a line under the current block |

(<kbd>⌘</kbd> instead of <kbd>Ctrl</kbd> on a Mac.)

## Tables

The Table button opens a grid: you choose the size by hovering it. In the table,
<kbd>Tab</kbd> goes to the next cell and adds a row at the end; <kbd>Enter</kbd> goes down
one row and, **on the last one, leaves the table** to keep writing below. The **⋯** button of the
current cell inserts or removes rows and columns, aligns the column, deletes the
table.

## Links, images, files

- **Link** — select some text then <kbd>Ctrl</kbd>+<kbd>K</kbd>, or paste an address over the
  selection. The cursor in a link brings up its address, with what it takes to open it, change it
  or remove it.
- **Image** — through the Image button, by **dragging it into the text** (a mark shows where it
  will land) or by pasting it. A click on the image lets you write its description or delete it.
- **File** — the paperclip, or a drag and drop: the file is stored and a link to it is put in the
  text.

In a **`.md` file**, images and files are stored next to the document (`images/`,
`fichiers/`). Elsewhere — mission, role of an agent — an image is added by its web address, and a
file dropped on a mission is attached to it as before.

A **remote image** found in a text stays hidden until you have asked to see it: showing it means
sending a request to its server, and a text written by an agent could use that to get a piece of
information out. The servers you accept are remembered.

## The file stays yours

Only the blocks you change are rewritten: fixing a word does not reformat the rest of the
document. The **Raw Markdown** button shows the exact text of the file, and lets you fix it by
hand.

## Without this plugin

These editors are gone: no missions, no “Role” section (the `CLAUDE.md` of an agent stays in
place and keeps being used, it simply cannot be changed from the interface any more), and
`.md` files open as raw text. The display of the agents' messages does not depend on this
plugin.

## For other plugins

```js
const editor = Allkin.capability("markdown-editor").create({
  host,        // the element that receives the document
  toolbar,     // the one that receives the toolbar (optional)
  spellcheck,  // the browser's spell checker
  doc: { getContent: () => text, setContent: (next) => { text = next; } },
  files: {     // optional: where to store images and files
    upload: async (file) => ({ src: "images/photo.png", name: file.name }),
    resolve: (src, usage) => "/address/to/read/from/" + src,   // usage: "image" or "open"
  },
});
editor.render();   // then reload(), focus("start" | "end"), isFocused(), destroy()
```

## Right requested

- **Allkin's interface** — the plugin runs in Allkin's page, with your session.
