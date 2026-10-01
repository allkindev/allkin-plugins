# File explorer

Browse and manage the files of the agents from Allkin.

## “Files” tab of an agent

The folder button on the row of an agent opens its `data/` space:

- navigation by folders (a “Parent folder” row to go up); sort by name, size or date (column
  headers; on a phone, a “Sort” button);
- **everything is done from the header of the page**, with icon buttons: search (the name filter
  only takes a row when you open it), upload files, new folder, new file, selection — Allkin's ⋮
  menu has nothing to offer here;
- **one icon per type**: folder, image, PDF, archive, script, code, data, text… the bin and the
  `Upload` folder have their own;
- a newly created file opens right away;
- **upload** of files and of whole folders by drag and drop, with progress — or through the
  system picker (“Upload” button of the header), the only way on a phone;
- **context menu** (right click, long press, or the ⋯ button of each row): open, download,
  select, copy, cut, paste, rename, archive, extract, new file, new folder, upload, delete;
- **multiple selection**: “Selection” button of the header, or “Select” on an item. A bar then
  appears with All / Download / Move / Delete / Done — at the bottom of the screen on a phone;
- **bin**: “Empty the bin” in the context menu, when you are inside it;
- every confirmation and input goes through Allkin's windows, and every action answers with a
  bubble;
- zip/tar **archives**, and download of a folder as a zip;
- **running `.sh` scripts**, after reading their content, with the output live;
- **bin**: what is deleted goes to `Trash/`, which can be emptied separately.

A click on a file opens it in the *Text editor* plugin if it is installed, and downloads it
otherwise.

## Explorer of `~/.allkin`

From the home page, a **read-only** walk through Allkin's installation folder: agents, sessions,
backups. Secrets cannot be read there.

## Without this plugin

No more Files tab nor explorer: the folder button of the agents and the “Explorer” button of the
home page disappear. The agents themselves keep access to their files according to their rights.

## Permission requested

- **Allkin interface** — the plugin runs in Allkin's page, with your session.
