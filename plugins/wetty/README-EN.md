# WeTTY

A terminal in the browser: [WeTTY](https://github.com/butlerx/wetty) opens an SSH session and
shows it in an Allkin tab. Handy from a phone or from a computer without an SSH client.

## Getting started

1. Grant the three rights (see below why).
2. Check the settings: by default, the terminal connects over SSH to the machine Allkin runs on
   (`localhost:22`) and asks for the user name, then the password.
3. Tick **Allow it to start as a service**, then save.
4. **Open the page**.

On the **first start**, WeTTY is downloaded from npm and its native module `node-pty` is compiled
for the machine: allow ten seconds to a minute. The service log shows the progress; until it is
done, the page answers “The plugin does not answer” — reload it afterwards. The following starts
are immediate.

## Why SSH, even to the local machine

WeTTY only opens a local shell directly when it runs as root, which is not the case of Allkin. It
therefore goes through the SSH server, which has an advantage: **opening the terminal asks for the
system credentials**, on top of the Allkin session. The SSH server must be installed and accept
the chosen authentication (`sudo apt install openssh-server` on Debian/Ubuntu).

## Settings

| Setting         | Role                                                                   |
|-----------------|------------------------------------------------------------------------|
| Local port      | Port WeTTY listens on, on `127.0.0.1` (default 9310)                   |
| SSH server      | The machine on which to open the terminal (default `localhost`)        |
| SSH port        | Default 22                                                             |
| SSH user        | Empty: asked every time the terminal opens                             |
| Authentication  | Password, or key then password                                         |
| SSH private key | Path of a key. Without a passphrase, nothing is asked any more: only the Allkin session protects the terminal then |
| Title           | The title of the terminal window                                       |

## Rights requested

- **Network** — downloading WeTTY from npm, listening on the local port, SSH connection.
- **System commands** — npm at installation, then ssh; and the terminal executes what you type.
- **Files outside its folder** — a terminal sees everything the logged-in account sees.

## Details

- WeTTY is installed in the plugin's data folder (`runtime/`), kept across updates of the plugin.
  Deleting this folder forces a reinstallation at the next start.
- The page is served under `/plugins/wetty/web` (option `--base`) and relayed by Allkin, WebSocket
  included: it is never exposed directly on the network.
