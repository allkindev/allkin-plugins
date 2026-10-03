// Worker of the Recordr page: owns the connection to the audio service.
//
// It receives the audio straight from the audio thread (a port handed over by
// the page, see worklet.js), asks Allkin for a listening session with the audio
// service chosen in the plugin's settings — an address and a short-lived key —
// opens that socket, and sends the page words, not bytes. It
// lives in a worker for one reason: a page in the background has its timers
// slowed down, a worker does not, and nothing here may wait on the page —
// neither the audio, nor the keepalive, nor a reconnection.
//
//   page → worker   { type: "start", port, sampleRate, language, model } | "pause" | "resume" | "stop"
//   worker → page   { type: "state", state, generation }   connecting, live, paused, reconnecting, stopped
//                   { type: "tokens", final, interim }
//                   { type: "error", code, … }             always followed by "stopped"

const KEEPALIVE_MS = 5000;
/** Audio kept while the socket is down: beyond it the oldest is dropped. */
const BUFFER_SECONDS = 20;
/** A reconnection is retried this long before giving up. */
const RETRY_FOR_MS = 5 * 60 * 1000;
/** The provider bills the open connection, paused or not: a long pause lets it go. */
const PAUSE_HOLD_MS = 10 * 60 * 1000;
/** Refused for good: asking again would change nothing. */
const FATAL_SESSION = new Set(["no_service", "refused", "unsupported", "outside"]);
/** The socket protocols this worker speaks. One per audio provider. */
const PROTOCOLS = new Set(["soniox"]);

// The page lives under /plugins/<id>/web/: the identifier in that path is the
// one Allkin knows the plugin by. Absent when the page is opened on the
// service's own port, outside Allkin — nobody to ask a session from, then.
const pluginId = (self.location.pathname.match(/\/plugins\/([^/]+)\/web\//) ?? [])[1];
const FATAL_STREAM = new Set([400, 401, 402, 403]);

let audioPort = null;
let sampleRate = 16000;
let wanted = { language: "auto", model: "" };
let socket = null;
let open = false;
let running = false;
let stopping = false;
let paused = false;
let pausedAt = 0;
/** Provider sessions opened so far: each one numbers the voices afresh. */
let generation = 0;
/** Where the current session starts on the transcript's clock. */
let offsetMs = 0;
let capturedBytes = 0;
let waiting = [];
let waitingBytes = 0;
let lastAudioAt = 0;
let failingSince = 0;
let attempt = 0;
let retryTimer = null;
let finishTimer = null;

const post = (message) => self.postMessage(message);
const bytesPerMs = () => (sampleRate * 2) / 1000;
const isWord = (token) => typeof token.text === "string" && token.text !== "" && !/^<[^>]*>$/.test(token.text);

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "start") {
    audioPort = message.port;
    sampleRate = message.sampleRate;
    wanted = { language: message.language || "auto", model: message.model || "" };
    running = true;
    audioPort.onmessage = (audio) => onAudio(audio.data);
    void connect();
  } else if (message.type === "pause" && running && !paused) {
    paused = true;
    pausedAt = Date.now();
    waiting = [];
    waitingBytes = 0;
    post({ type: "state", state: "paused", generation });
  } else if (message.type === "resume" && running && paused) {
    paused = false;
    if (socket) post({ type: "state", state: open ? "live" : "reconnecting", generation });
    else void connect();
  } else if (message.type === "stop") {
    stop();
  }
};

function onAudio(chunk) {
  if (!running || stopping || paused) return;
  lastAudioAt = Date.now();
  capturedBytes += chunk.byteLength;
  if (open) {
    socket.send(chunk);
    return;
  }
  waiting.push(chunk);
  waitingBytes += chunk.byteLength;
  while (waitingBytes > sampleRate * 2 * BUFFER_SECONDS) waitingBytes -= waiting.shift().byteLength;
}

async function connect() {
  if (!running || stopping || socket) return;
  post({ type: "state", state: generation === 0 ? "connecting" : "reconnecting", generation });

  if (!pluginId) return fail({ code: "outside" });
  let session;
  try {
    const response = await fetch(`/api/plugins/${pluginId}/speech/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wanted),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Allkin answers with a code; anything else (a session that expired, a
      // server restarting) is Allkin itself not answering.
      const error = { code: data.code || "allkin", status: data.status ?? response.status };
      return FATAL_SESSION.has(error.code) ? fail(error) : retry(error);
    }
    session = data;
  } catch {
    return retry({ code: "allkin" });
  }
  if (!PROTOCOLS.has(session.protocol)) return fail({ code: "unsupported" });
  if (!running || stopping || socket) return;

  const ws = new WebSocket(session.wsUrl);
  ws.binaryType = "arraybuffer";
  socket = ws;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        api_key: session.apiKey,
        model: session.model,
        audio_format: "pcm_s16le",
        sample_rate: sampleRate,
        num_channels: 1,
        enable_speaker_diarization: true,
        ...(session.language && session.language !== "auto" ? { language_hints: [session.language] } : {}),
      })
    );
    open = true;
    generation++;
    attempt = 0;
    failingSince = 0;
    // The provider counts from the first sample it receives: what was captured
    // before, minus what is about to be sent, is where this session starts.
    offsetMs = (capturedBytes - waitingBytes) / bytesPerMs();
    for (const chunk of waiting) ws.send(chunk);
    waiting = [];
    waitingBytes = 0;
    post({ type: "state", state: paused ? "paused" : "live", generation, language: session.language });
  };

  ws.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.error_code) {
      // Told apart by the code, never by the sentence. The provider closes the
      // socket after an error: a passing one is handled there, by reconnecting.
      if (FATAL_STREAM.has(Number(message.error_code))) {
        fail({ code: Number(message.error_code) === 402 ? "quota" : "stream", message: message.error_message || String(message.error_code) });
      } else {
        ws.close();
      }
      return;
    }
    // After a reconnection the voices are numbered again from 1: they get a
    // prefix, so that a new "1" is never taken for the earlier one.
    const prefix = generation > 1 ? `${generation}-` : "";
    const word = (token) => ({
      text: token.text,
      speaker: token.speaker === undefined || token.speaker === null ? null : prefix + token.speaker,
      startMs: Math.round(offsetMs + (token.start_ms ?? 0)),
      endMs: Math.round(offsetMs + (token.end_ms ?? token.start_ms ?? 0)),
    });
    const final = [];
    const interim = [];
    for (const token of message.tokens ?? []) {
      if (isWord(token)) (token.is_final ? final : interim).push(word(token));
    }
    post({ type: "tokens", final, interim });
    if (message.finished) ws.close();
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    const wasOpen = open;
    socket = null;
    open = false;
    if (stopping) return finished();
    if (!running) return;
    // Let go on purpose during a long pause: resume() opens a new one.
    if (paused && pausedAt === 0) return;
    post({ type: "tokens", final: [], interim: [] });
    // Never opened: the first connection failing is told at once, the user is
    // looking at the button.
    if (!wasOpen && generation === 0) return fail({ code: "connection" });
    retry({ code: "connection" });
  };
}

/** Tries again, a little later each time; gives up after RETRY_FOR_MS. */
function retry(error) {
  if (!running || stopping) return;
  if (generation === 0) return fail(error);
  failingSince ||= Date.now();
  if (Date.now() - failingSince > RETRY_FOR_MS) return fail(error);
  post({ type: "state", state: "reconnecting", generation });
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void connect(), Math.min(15000, 1000 * 2 ** attempt++));
}

function fail(error) {
  if (!running) return;
  post({ type: "error", ...error });
  running = false;
  stopping = false;
  clearTimeout(retryTimer);
  const ws = socket;
  socket = null;
  open = false;
  if (ws && ws.readyState <= 1) ws.close();
  finished();
}

function stop() {
  if (!running) return finished();
  stopping = true;
  clearTimeout(retryTimer);
  if (open) {
    // An empty frame says the audio is over: the provider settles the last
    // words, answers `finished` and the socket closes. Not waited for long.
    socket.send("");
    finishTimer = setTimeout(() => socket && socket.close(), 8000);
  } else {
    const ws = socket;
    socket = null;
    if (ws && ws.readyState <= 1) ws.close();
    finished();
  }
}

function finished() {
  clearTimeout(finishTimer);
  running = false;
  stopping = false;
  if (audioPort) audioPort.close();
  audioPort = null;
  post({ type: "state", state: "stopped", generation });
}

// Silence on the line for more than 20 s and the provider hangs up. A pause, a
// muted microphone or a tab the system has put to sleep must not cost the
// session, and with it the numbering of the voices.
setInterval(() => {
  if (!running || !open) return;
  if (paused && pausedAt && Date.now() - pausedAt > PAUSE_HOLD_MS) {
    pausedAt = 0;
    socket.close();
    return;
  }
  if (paused || Date.now() - lastAudioAt > KEEPALIVE_MS) socket.send('{"type":"keepalive"}');
}, KEEPALIVE_MS);
