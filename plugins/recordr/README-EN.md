# Recordr

Listens to the microphone of the device Allkin is open on, writes what is said as it is spoken and
separates the speakers: one block per turn, one colour per voice. Recognition is done by an
**audio service** connected to Allkin — today [Soniox](https://soniox.com), an online service
billed by use.

## Getting started

1. **Services › Add › Soniox**: paste the API key created on
   [console.soniox.com](https://console.soniox.com). It is the same step as for an image service:
   the key is kept by Allkin, not by the plugin.
2. On the plugin's page, grant the **Network** right, pick that service in **Audio service** and
   the **spoken language** (given, it improves recognition).
3. Tick **Allow it to start as a service**, then save.
4. **Open the page**, press **Start listening** and allow the microphone when the browser asks.

## The microphone needs HTTPS

A browser only hands the microphone to a page served over **HTTPS** (or on `localhost`). Allkin
opened through `http://192.168.x.x:9191` will not get it: go through its HTTPS address
(`tailscale serve`, Caddy…). The page says so when that is the case.

## What the page does

- **Start listening / Pause / Stop** — the text arrives word by word. Grey words are not final yet:
  the service may correct them for a second or two. The chip next to the buttons tells where the
  listening stands, with its duration and the microphone's level. **Pause** keeps the connection
  (and the numbering of the voices); after ten minutes of pause it is let go, and resuming opens a
  new one.
- **Listening goes on in the background** — you can switch to another Allkin tab, another browser
  tab or another window: capturing and sending do not depend on the page being shown. The browser
  asks for confirmation before closing or reloading the tab while listening.
- **Automatic reconnection** — if the connection to the audio service drops, the page restores it
  by itself (for five minutes at most) and keeps up to twenty seconds of audio in the meantime. A
  “Listening resumed” line marks the place: the service then renumbers the voices, which get new
  numbers.
- **Speakers** — the service tells the voices apart; it does not know who is speaking. A click on
  “Speaker 1”, in the text or in the panel on the right, gives the real name everywhere. The panel
  shows each one's speaking time and share of the total.
- **Title**, **Copy**, **Download (.md)** — the transcript exports as Markdown, with the names and
  the time of each turn.
- **History** — every session is saved on Allkin's machine as it goes
  (`plugin-data/recordr/data/transcripts/`). It can be found by its title, opened again, renamed,
  deleted.

Pressing **Start listening** while a transcript is on screen starts a new one.

## Where the audio goes, where the key stays

The key of the audio service never leaves Allkin. For each session, the page asks Allkin for a
**temporary key** (two minutes, the time to open the connection); the audio then goes from the
browser straight to the service, without passing through Allkin's machine. The plugin itself sees
no key: its service only serves the page and keeps the transcripts.

## Limits

- **Closing the plugin's tab in Allkin, or reloading the page, ends the listening.** What was
  transcribed is already saved.
- **One microphone for several people**: when people talk over each other or sit far from the
  microphone, attribution goes wrong. A table microphone in the middle helps a lot.
- **On a phone**, the screen must stay on and the browser in front: the page asks the system not to
  lock the screen, but it may refuse in battery saver mode, and a phone cuts the microphone of a
  browser sent to the background. On return, the page resumes listening by itself when the system
  allows it.
- **Soniox bills the duration of the connection**, pauses included (hence letting go after ten
  minutes), and a connection lasts five hours at most; beyond that, the page opens a new one.
- **Privacy**: the audio goes to the audio service, from the browser. Recording people requires
  their consent.

## Settings

| Setting | Role |
|---|---|
| Local port | The service's port on `127.0.0.1`; only to change if it is already taken. |
| Audio service | The connected service that transcribes (added in **Services**). Required. |
| Spoken language | French, English, Spanish, German, or automatic. |
| Model | Empty = the service's default real-time model; otherwise its exact name. |

## Right requested

**Network** — the service listens on a local port, to serve its page in Allkin.
