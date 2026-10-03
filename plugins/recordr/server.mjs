// Service of the Recordr plugin: an HTTP server without dependency.
//
// It does two things: serve the page (web/) and keep the transcripts. It never
// sees a key: the page asks Allkin itself for a listening session with the
// audio service chosen in the plugin's settings
// (POST /api/plugins/<id>/speech/session), and the audio then goes from the
// browser straight to that service.
//
// Allkin passes everything through the environment and relays the page under
// /plugins/<id>/web/: the page writes its own links as RELATIVE.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const settings = JSON.parse(process.env.ALLKIN_PLUGIN_SETTINGS ?? "{}");
const port = Number(process.env.PORT ?? settings.port ?? 9330);
const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, "web");
const dataDir = process.env.ALLKIN_PLUGIN_DATA ?? join(here, ".data");
const transcriptsDir = join(dataDir, "transcripts");

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/locales.js": ["locales.js", "text/javascript; charset=utf-8"],
  "/worklet.js": ["worklet.js", "text/javascript; charset=utf-8"],
  "/stream.js": ["stream.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

const ID_PATTERN = /^\d{8}-\d{6}-[0-9a-f]{4}$/;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_SEGMENTS = 20000;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : {});
      } catch {
        reject(Object.assign(new Error("invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.round(value) : 0);

/** Only what a transcript is made of is kept: the page is not trusted to
 *  write anything else into the data folder. */
function cleanTranscript(raw) {
  const speakers = {};
  for (const [key, name] of Object.entries(raw?.speakers && typeof raw.speakers === "object" ? raw.speakers : {})) {
    if (key.length <= 8 && typeof name === "string" && name.trim()) speakers[key] = name.trim().slice(0, 60);
  }
  const segments = (Array.isArray(raw?.segments) ? raw.segments : []).slice(0, MAX_SEGMENTS).map((segment) => ({
    speaker: text(segment?.speaker, 8),
    startMs: count(segment?.startMs),
    endMs: count(segment?.endMs),
    spokenMs: count(segment?.spokenMs),
    text: text(segment?.text, 20000),
    // The listening was cut and resumed just before this turn.
    ...(segment?.gap === true ? { gap: true } : {}),
  }));
  return {
    title: text(raw?.title, 200).trim(),
    startedAt: Number.isNaN(Date.parse(raw?.startedAt)) ? new Date().toISOString() : new Date(raw.startedAt).toISOString(),
    durationMs: count(raw?.durationMs),
    language: text(raw?.language, 8),
    speakers,
    segments,
  };
}

function transcriptPath(id) {
  return join(transcriptsDir, `${id}.json`);
}

function writeTranscript(id, transcript) {
  mkdirSync(transcriptsDir, { recursive: true, mode: 0o700 });
  // Temporary file then rename: the page saves while it records, and a save cut
  // short must not leave half a transcript behind.
  const tmp = transcriptPath(id) + ".tmp";
  writeFileSync(tmp, JSON.stringify({ id, ...transcript }, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, transcriptPath(id));
}

function readTranscript(id) {
  try {
    return JSON.parse(readFileSync(transcriptPath(id), "utf-8"));
  } catch {
    return null;
  }
}

function listTranscripts() {
  let names;
  try {
    names = readdirSync(transcriptsDir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const id = name.endsWith(".json") ? name.slice(0, -5) : "";
    if (!ID_PATTERN.test(id)) continue;
    const transcript = readTranscript(id);
    if (!transcript) continue;
    out.push({
      id,
      title: transcript.title ?? "",
      startedAt: transcript.startedAt,
      durationMs: transcript.durationMs ?? 0,
      speakers: new Set((transcript.segments ?? []).map((segment) => segment.speaker)).size,
    });
  }
  return out.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

function newId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${day}-${time}-${randomBytes(2).toString("hex")}`;
}

async function handle(req, res) {
  const { pathname } = new URL(req.url ?? "/", "http://plugin");

  if (req.method === "GET" && STATIC[pathname]) {
    const [file, type] = STATIC[pathname];
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(readFileSync(join(webDir, file)));
    return;
  }

  if (pathname === "/api/status" && req.method === "GET") {
    // What the page passes on to Allkin when it asks for a listening session.
    return send(res, 200, { language: String(settings.language ?? "auto"), model: String(settings.model ?? "").trim() });
  }

  if (pathname === "/api/transcripts") {
    if (req.method === "GET") return send(res, 200, { transcripts: listTranscripts() });
    if (req.method === "POST") {
      const id = newId();
      writeTranscript(id, cleanTranscript(await readBody(req)));
      return send(res, 201, { id });
    }
  }

  const match = /^\/api\/transcripts\/([^/]+)$/.exec(pathname);
  if (match) {
    const id = match[1];
    if (!ID_PATTERN.test(id)) return send(res, 400, { code: "bad_id" });
    if (req.method === "GET") {
      const transcript = readTranscript(id);
      return transcript ? send(res, 200, transcript) : send(res, 404, { code: "not_found" });
    }
    if (req.method === "PUT") {
      writeTranscript(id, cleanTranscript(await readBody(req)));
      return send(res, 200, { id });
    }
    if (req.method === "DELETE") {
      try {
        unlinkSync(transcriptPath(id));
      } catch {
        // already gone: the result is the one asked for
      }
      return send(res, 200, { id });
    }
  }

  send(res, 404, { code: "not_found" });
}

const server = createServer((req, res) => {
  // An exception that escapes would kill the service, and with it a recording
  // in progress: every request ends in an answer.
  handle(req, res).catch((error) => {
    console.error(`[http] ${req.method} ${req.url}: ${error instanceof Error ? error.message : String(error)}`);
    if (!res.headersSent) send(res, error?.status ?? 500, { code: "server" });
    else res.end();
  });
});

server.listen(port, "127.0.0.1", () => console.log(`listening on 127.0.0.1:${port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
