// Page of the Recordr plugin.
//
// Three threads share the work, so that listening never depends on this page
// being in front:
//   · worklet.js (audio thread) turns the microphone into 16-bit PCM;
//   · stream.js (worker) sends it to the audio service chosen in the plugin's
//     settings, keeps the connection alive, reconnects, and hands back words;
//   · this file draws them, one block per turn, and saves the transcript.
// A browser slows down the timers of a page in the background; the two others
// are not slowed, and nothing they do waits on this one.
// Links are relative: the page lives under /plugins/<id>/web/.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---- Language, theme and result bubble: those of the Allkin page around ----

  /** Reads something from the Allkin page, same origin; undefined outside it. */
  function fromHost(read) {
    try {
      return window.parent !== window ? read(window.parent) : undefined;
    } catch {
      return undefined;
    }
  }

  const LOCALES = window.RECORDR_LOCALES;
  const language = (() => {
    const wanted = fromHost((host) => host.I18n?.language) || String(navigator.language || "en").slice(0, 2).toLowerCase();
    return LOCALES[wanted] ? wanted : "en";
  })();
  const locale = fromHost((host) => host.I18n?.locale) || navigator.language || "en";
  const theme = fromHost((host) => host.document.documentElement.dataset.theme);
  if (theme) document.documentElement.dataset.theme = theme;
  document.documentElement.lang = language;

  function t(key, vars = {}) {
    const text = LOCALES[language][key] ?? LOCALES.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
  }
  const tn = (key, count) => t(`${key}.${count === 1 ? "one" : "other"}`, { count: count.toLocaleString(locale) });

  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) node.placeholder = t(node.dataset.i18nPlaceholder);
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  for (const node of document.querySelectorAll("[data-i18n-title]")) node.title = t(node.dataset.i18nTitle);
  document.title = t("app.title");

  /** The result of an action: Allkin's own bubble when the page is in Allkin. */
  let toastTimer = null;
  function toast(message, ok = true) {
    const hostToast = fromHost((host) => host.Allkin?.core?.toast);
    if (typeof hostToast === "function") {
      hostToast(message, ok ? "ok" : "ko");
      return;
    }
    const node = $("toast");
    node.textContent = message;
    node.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("visible"), 2500);
  }

  // ---- State ----

  const emptyTranscript = () => ({ id: null, title: "", startedAt: null, durationMs: 0, language: "", speakers: {}, segments: [] });

  const state = {
    transcript: emptyTranscript(),
    /** Words the provider has not settled on yet: replaced at every message. */
    interim: [],
    /** idle → starting → live ⇄ paused / reconnecting → finishing → idle */
    phase: "idle",
    /** Everything a listening holds: microphone, audio graph, worker, timers. */
    session: null,
    /** The view sticks to the last words until the reader scrolls back. */
    following: true,
    /** The listening was cut and resumed: the next turn starts after a divider. */
    breakNext: false,
    dirty: false,
    saving: false,
  };

  const LISTENING = new Set(["starting", "live", "paused", "reconnecting"]);

  async function api(method, path, body) {
    let response;
    try {
      response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw { code: "server" };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw { code: data.code || "server", status: data.status ?? response.status };
    return data;
  }

  // ---- Speakers ----

  /** The voices in order of first appearance: it gives each its number and
   *  its colour, whatever label the provider uses. */
  let order = [];

  function noteSpeaker(key) {
    if (!order.includes(key)) order.push(key);
  }

  function speakerNumber(key) {
    const index = order.indexOf(key);
    return index === -1 ? order.length + 1 : index + 1;
  }

  /** "Speaker 2" until the user gives the real name. */
  const speakerName = (key) => state.transcript.speakers[key] || t("speaker.default", { n: speakerNumber(key) });
  const speakerColor = (key) => `var(--speaker-${((speakerNumber(key) - 1) % 8) + 1})`;

  /** Initials of a given name, the number otherwise. */
  function speakerBadge(key) {
    const name = state.transcript.speakers[key];
    if (!name) return String(speakerNumber(key));
    const words = name.split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : name[0]).toUpperCase();
  }

  const lastSpeaker = () => state.transcript.segments[state.transcript.segments.length - 1]?.speaker ?? "1";

  function speakerButton(key) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lt-speaker";
    button.title = t("speaker.rename");
    button.textContent = speakerName(key);
    button.addEventListener("click", () => renameSpeaker(key, button));
    return button;
  }

  function avatar(key) {
    const badge = document.createElement("span");
    badge.className = "lt-avatar";
    badge.textContent = speakerBadge(key);
    return badge;
  }

  function renameSpeaker(key, button) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "lt-speaker-input";
    input.maxLength = 60;
    input.value = state.transcript.speakers[key] ?? "";
    input.placeholder = t("speaker.default", { n: speakerNumber(key) });
    input.setAttribute("aria-label", t("speaker.rename"));
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      if (keep) {
        const name = input.value.trim();
        if (name) state.transcript.speakers[key] = name;
        else delete state.transcript.speakers[key];
        markDirty();
      }
      // Taken out first: the panel is not redrawn under a field being typed in.
      input.remove();
      renderAll();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      else if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    button.replaceWith(input);
    input.focus();
    input.select();
  }

  // ---- Formatting ----

  function clock(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const pad = (n) => String(n).padStart(2, "0");
    const hours = Math.floor(total / 3600);
    const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
    return hours ? `${hours}:${rest}` : rest;
  }

  const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

  // ---- Transcript: one block per turn ----

  const transcriptEl = $("transcript");
  /** The blocks of the settled segments, in the same order as the segments. */
  let blocks = [];

  function buildTurn(speaker, startMs) {
    const turn = document.createElement("article");
    turn.className = "lt-turn";
    turn.style.setProperty("--speaker", speakerColor(speaker));

    const head = document.createElement("header");
    head.className = "lt-turn-head";
    const time = document.createElement("time");
    time.className = "lt-time";
    time.textContent = clock(startMs);
    head.append(speakerButton(speaker), time);

    const text = document.createElement("p");
    text.className = "lt-text";
    const body = document.createElement("div");
    body.className = "lt-turn-body";
    body.append(head, text);
    turn.append(avatar(speaker), body);
    return turn;
  }

  function setTurnText(turn, settled, pending = "") {
    const text = turn.querySelector(".lt-text");
    text.textContent = settled.trimStart();
    if (pending) {
      const tail = document.createElement("span");
      tail.className = "lt-interim";
      tail.textContent = settled ? pending : pending.trimStart();
      text.appendChild(tail);
    }
  }

  /** Words not settled yet, grouped by speaker like the settled ones. */
  function interimTurns() {
    const turns = [];
    for (const token of state.interim) {
      const last = turns[turns.length - 1];
      const speaker = token.speaker ?? last?.speaker ?? lastSpeaker();
      if (last && last.speaker === speaker) last.text += token.text;
      else turns.push({ speaker, startMs: token.startMs, text: token.text });
    }
    return turns;
  }

  const nearBottom = () => transcriptEl.scrollHeight - transcriptEl.scrollTop - transcriptEl.clientHeight < 80;

  function scrollToLatest() {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  /**
   * Brings the transcript in line with the state. `from` is the first settled
   * segment whose text may have changed: everything before it is left alone,
   * so that a long transcript is not rebuilt at every word.
   */
  function renderTranscript(from = 0) {
    const { segments } = state.transcript;

    for (const node of transcriptEl.querySelectorAll(".pending")) node.remove();
    if (from === 0) {
      transcriptEl.replaceChildren();
      blocks = [];
    }
    for (let i = blocks.length; i < segments.length; i++) {
      if (segments[i].gap) {
        const gap = document.createElement("div");
        gap.className = "lt-gap";
        gap.textContent = t("gap.label");
        transcriptEl.appendChild(gap);
      }
      blocks.push(buildTurn(segments[i].speaker, segments[i].startMs));
      transcriptEl.appendChild(blocks[i]);
    }

    const turns = interimTurns();
    const last = segments.length - 1;
    // The first pending turn continues the last block when the speaker is the
    // same and no cut stands between them.
    const continued = turns.length && last >= 0 && !state.breakNext && turns[0].speaker === segments[last].speaker ? turns.shift() : null;
    for (let i = Math.max(0, Math.min(from, last)); i <= last; i++) {
      setTurnText(blocks[i], segments[i].text, i === last && continued ? continued.text : "");
    }
    for (const turn of turns) {
      const block = buildTurn(turn.speaker, turn.startMs);
      block.classList.add("pending");
      setTurnText(block, "", turn.text);
      transcriptEl.appendChild(block);
    }

    $("empty").classList.toggle("hidden", segments.length > 0 || state.interim.length > 0);
    if (state.following) scrollToLatest();
    refreshLatestButton();
    refreshButtons();
  }

  transcriptEl.addEventListener("scroll", () => {
    state.following = nearBottom();
    refreshLatestButton();
  });

  // The frame comes back from being hidden (another Allkin tab), or the window
  // is resized: the last words must be on screen again.
  new ResizeObserver(() => {
    if (state.following) scrollToLatest();
  }).observe(transcriptEl);

  function refreshLatestButton() {
    $("latest").classList.toggle("hidden", state.following || state.transcript.segments.length === 0);
  }

  $("latest").addEventListener("click", () => {
    state.following = true;
    scrollToLatest();
    refreshLatestButton();
  });

  // ---- Side panel: who spoke, and for how long ----

  let statsDirty = false;

  function renderSpeakers() {
    const list = $("speakers");
    // Not while a name is being typed there: the field would vanish under the cursor.
    if (list.contains(document.activeElement) && document.activeElement.classList.contains("lt-speaker-input")) return;

    const totals = new Map(order.map((key) => [key, { spokenMs: 0, words: 0 }]));
    for (const segment of state.transcript.segments) {
      const total = totals.get(segment.speaker);
      if (!total) continue;
      total.spokenMs += segment.spokenMs ?? 0;
      total.words += countWords(segment.text);
    }
    // A transcript saved before speaking times were kept: words stand in.
    const timed = [...totals.values()].some((total) => total.spokenMs > 0);
    const weight = (total) => (timed ? total.spokenMs : total.words);
    const sum = [...totals.values()].reduce((all, total) => all + weight(total), 0);

    list.replaceChildren();
    for (const key of order) {
      const total = totals.get(key);
      const percent = sum ? Math.round((weight(total) / sum) * 100) : 0;
      const card = document.createElement("li");
      card.className = "lt-speaker-card";
      card.style.setProperty("--speaker", speakerColor(key));
      const share = document.createElement("span");
      share.className = "lt-speaker-time";
      share.textContent = timed ? t("speakers.share", { time: clock(total.spokenMs), percent }) : `${percent} %`;
      const bar = document.createElement("span");
      bar.className = "lt-speaker-bar";
      const fill = document.createElement("i");
      fill.style.width = `${percent}%`;
      bar.appendChild(fill);
      card.append(avatar(key), speakerButton(key), share, bar);
      list.appendChild(card);
    }
    $("speakers-empty").classList.toggle("hidden", order.length > 0);
  }

  function renderMeta() {
    const transcript = state.transcript;
    const parts = [];
    if (transcript.startedAt) parts.push(new Date(transcript.startedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }));
    if (transcript.durationMs > 0) parts.push(clock(transcript.durationMs));
    if (order.length) parts.push(tn("meta.speakers", order.length));
    const words = transcript.segments.reduce((all, segment) => all + countWords(segment.text), 0);
    if (words) parts.push(tn("meta.words", words));
    $("meta").textContent = parts.join(" · ");
  }

  function renderAll() {
    renderTranscript(0);
    renderSpeakers();
    renderMeta();
    statsDirty = false;
  }

  // ---- What the worker sends back ----

  function onTokens(final, interim) {
    const { segments } = state.transcript;
    let changedFrom = segments.length;
    for (const token of final) {
      const speaker = token.speaker ?? lastSpeaker();
      noteSpeaker(speaker);
      const spoken = Math.max(0, token.endMs - token.startMs);
      const last = segments[segments.length - 1];
      if (last && last.speaker === speaker && !state.breakNext) {
        last.text += token.text;
        last.endMs = Math.max(last.endMs ?? 0, token.endMs);
        last.spokenMs = (last.spokenMs ?? 0) + spoken;
        changedFrom = Math.min(changedFrom, segments.length - 1);
      } else {
        segments.push({ speaker, startMs: token.startMs, endMs: token.endMs, spokenMs: spoken, text: token.text, ...(state.breakNext ? { gap: true } : {}) });
        state.breakNext = false;
      }
    }
    state.interim = interim;
    if (final.length) {
      statsDirty = true;
      markDirty();
    }
    // from > 0 keeps the blocks already drawn; 0 would rebuild them all.
    renderTranscript(Math.max(1, changedFrom));
  }

  function onWorkerMessage(session, message) {
    if (state.session !== session) return;
    if (message.type === "tokens") {
      onTokens(message.final, message.interim);
    } else if (message.type === "error") {
      notify(message.code, { status: message.status ?? "", message: message.message ?? "" });
    } else if (message.type === "state") {
      if (message.state === "stopped") {
        void finish(session);
        return;
      }
      // Still finishing: the worker's late news must not bring the buttons back.
      if (state.phase === "finishing") return;
      if (message.state === "live") {
        // A session after the first numbers the voices afresh: what follows is
        // set apart from what came before.
        if (message.generation > session.generation && message.generation > 1 && state.transcript.segments.length) state.breakNext = true;
        session.generation = message.generation;
        if (message.language) state.transcript.language = message.language;
      }
      setPhase({ connecting: "starting", live: "live", paused: "paused", reconnecting: "reconnecting" }[message.state] ?? state.phase);
    }
  }

  // ---- Listening ----

  const recordBtn = $("record");
  const pauseBtn = $("pause");
  const chip = $("chip");

  function setButton(button, icon, label) {
    button.querySelector("use").setAttribute("href", `#i-${icon}`);
    button.querySelector("span").textContent = label;
  }

  function setPhase(phase) {
    state.phase = phase;
    const listening = LISTENING.has(phase);
    const active = listening && phase !== "starting";

    setButton(
      recordBtn,
      active ? "stop" : "mic",
      t({ idle: "record.start", starting: "record.starting", finishing: "record.finishing" }[phase] ?? "record.stop")
    );
    recordBtn.classList.toggle("live", active);
    recordBtn.disabled = phase === "starting" || phase === "finishing";

    pauseBtn.classList.toggle("hidden", !active);
    setButton(pauseBtn, phase === "paused" ? "play" : "pause", t(phase === "paused" ? "pause.resume" : "pause.pause"));
    pauseBtn.disabled = phase === "reconnecting";

    refreshChip();
    refreshButtons();
    renderHistory();
  }

  /** The state of the listening in a few words, with the time it has run. */
  function refreshChip() {
    const session = state.session;
    const phase = state.phase;
    chip.classList.toggle("hidden", phase === "idle");
    if (phase === "idle") return;
    const time = clock(session?.activeMs ?? 0);
    const interrupted = phase === "live" && session && (session.track?.muted || session.context.state !== "running");
    const key = phase === "starting" ? "status.connecting" : phase === "finishing" ? "status.finishing" : interrupted ? "status.muted" : `status.${phase}`;
    $("chip-text").textContent = t(key, { time });
    chip.classList.toggle("waiting", phase !== "live" || Boolean(interrupted));
    chip.classList.toggle("still", phase === "paused" || phase === "finishing");
    $("meter").classList.toggle("hidden", phase === "starting" || phase === "finishing");
  }

  function notify(code, vars) {
    const notice = $("notice");
    // A code this page has no sentence for is the service's own failure.
    notice.textContent = t(LOCALES.en[`error.${code}`] ? `error.${code}` : "error.server", vars);
    notice.classList.remove("hidden");
  }

  function clearNotice() {
    $("notice").classList.add("hidden");
  }

  /** The class of a refused microphone, never its message. */
  function microphoneError(error) {
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "mic_denied";
    if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") return "mic_missing";
    return "mic_failed";
  }

  async function start() {
    if (state.phase !== "idle") return;
    clearNotice();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      notify("insecure");
      return;
    }
    setPhase("starting");

    // Created inside the click, before any await: iOS leaves an audio context
    // born later suspended. It runs at the device's own rate — Firefox refuses
    // to plug a microphone into a context of another rate — and the worklet
    // brings the samples down.
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const session = { context, stream: null, track: null, worker: null, analyser: null, wakeLock: null, ticker: null, frame: 0, activeMs: 0, lastTick: 0, generation: 0, finishTimer: null };
    state.session = session;

    try {
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      await context.audioWorklet.addModule("worklet.js");
      await context.resume();
    } catch (error) {
      release(session);
      state.session = null;
      setPhase("idle");
      notify(microphoneError(error));
      return;
    }

    // A transcript already on screen is left as it is: listening starts a new one.
    if (state.transcript.segments.length) {
      await save();
      openTranscript(emptyTranscript());
    }
    state.transcript.startedAt = new Date().toISOString();
    state.following = true;
    state.breakNext = false;
    renderAll();

    // 16 kHz is plenty for speech: 48 kHz is divided by 3, 44.1 kHz by 2. A
    // rate that does not divide evenly is sent as it is.
    const wanted = Math.max(1, Math.floor(context.sampleRate / 16000));
    const factor = Number.isInteger(context.sampleRate / wanted) ? wanted : 1;
    const sampleRate = context.sampleRate / factor;

    const source = context.createMediaStreamSource(session.stream);
    const capture = new AudioWorkletNode(context, "recordr-capture", {
      processorOptions: { factor, chunkSize: Math.round(sampleRate / 10) },
    });
    // A node nobody listens to may not be pulled: it goes to the output through
    // a silent gain.
    const silence = context.createGain();
    silence.gain.value = 0;
    source.connect(capture).connect(silence).connect(context.destination);
    session.analyser = context.createAnalyser();
    session.analyser.fftSize = 512;
    source.connect(session.analyser);

    // The audio goes from the audio thread to the worker over its own channel:
    // this page is not on the way, and may be slowed down without harm.
    const channel = new MessageChannel();
    session.worker = new Worker("stream.js");
    session.worker.onmessage = (event) => onWorkerMessage(session, event.data);
    session.worker.onerror = () => {
      notify("server");
      void finish(session);
    };
    // The language and the model set on the plugin's page: the service knows
    // them, Allkin is told when the session is asked for.
    const asked = await api("GET", "api/status").catch(() => ({}));
    session.worker.postMessage({ type: "start", port: channel.port2, sampleRate, language: asked.language, model: asked.model }, [channel.port2]);
    capture.port.postMessage({ port: channel.port1 }, [channel.port1]);

    session.track = session.stream.getAudioTracks()[0];
    // Unplugged, or the permission taken back: nothing more will come.
    session.track.addEventListener("ended", () => {
      if (state.session !== session || !LISTENING.has(state.phase)) return;
      notify("mic_lost");
      stop();
    });
    session.track.addEventListener("mute", refreshChip);
    session.track.addEventListener("unmute", refreshChip);
    // A phone call, another app taking the audio: the system suspends the
    // context and gives it back later. It is asked to resume as soon as it may.
    context.addEventListener("statechange", () => {
      if (state.session !== session) return;
      if (context.state !== "running" && LISTENING.has(state.phase)) void context.resume().catch(() => {});
      refreshChip();
    });

    session.lastTick = Date.now();
    session.ticker = setInterval(() => tick(session), 500);
    session.frame = requestAnimationFrame(() => drawMeter(session));
    void keepAwake(session);
  }

  /** Twice a second: the clock, and the figures that follow the words. */
  function tick(session) {
    const now = Date.now();
    // Counted from the wall clock, not from the number of ticks: a page in the
    // background ticks once a second at best.
    if (state.phase === "live" || state.phase === "reconnecting") session.activeMs += now - session.lastTick;
    session.lastTick = now;
    state.transcript.durationMs = Math.round(session.activeMs);
    refreshChip();
    if (statsDirty) {
      statsDirty = false;
      renderSpeakers();
    }
    renderMeta();
  }

  const METER_SHAPE = [0.55, 0.8, 1, 0.8, 0.55];

  function drawMeter(session) {
    if (state.session !== session) return;
    const bars = $("meter").children;
    let level = 0;
    if (state.phase === "live" && session.analyser) {
      const samples = new Uint8Array(session.analyser.fftSize);
      session.analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
    }
    for (let i = 0; i < bars.length; i++) bars[i].style.transform = `scaleY(${Math.max(0.15, Math.min(1, level * METER_SHAPE[i] * 1.5))})`;
    session.frame = requestAnimationFrame(() => drawMeter(session));
  }

  /** A phone that locks its screen cuts the microphone. */
  async function keepAwake(session) {
    try {
      session.wakeLock = await navigator.wakeLock?.request("screen");
    } catch {
      // refused (battery saver, old browser): listening goes on, the screen may lock
    }
  }

  // Back in front: the system let go of the wake lock, and may have suspended
  // the audio.
  document.addEventListener("visibilitychange", () => {
    const session = state.session;
    if (document.visibilityState !== "visible" || !session || !LISTENING.has(state.phase)) return;
    void keepAwake(session);
    if (session.context.state !== "running") void session.context.resume().catch(() => {});
    if (state.following) scrollToLatest();
  });

  /** Lets go of the microphone and of everything that keeps the device busy. */
  function release(session) {
    clearInterval(session.ticker);
    clearTimeout(session.finishTimer);
    cancelAnimationFrame(session.frame);
    for (const track of session.stream?.getTracks() ?? []) track.stop();
    void session.context.close().catch(() => {});
    void session.wakeLock?.release().catch(() => {});
  }

  function togglePause() {
    const session = state.session;
    if (!session) return;
    if (state.phase === "live") session.worker.postMessage({ type: "pause" });
    else if (state.phase === "paused") session.worker.postMessage({ type: "resume" });
  }

  /** Asks the worker to end: it settles the last words, then says "stopped". */
  function stop() {
    const session = state.session;
    if (!session || !LISTENING.has(state.phase)) return;
    tick(session);
    setPhase("finishing");
    for (const track of session.stream?.getTracks() ?? []) track.stop();
    session.worker.postMessage({ type: "stop" });
    // The worker waits 8 s for the provider; a worker that says nothing at all
    // is not waited for.
    session.finishTimer = setTimeout(() => void finish(session), 12000);
  }

  async function finish(session) {
    if (state.session !== session) return;
    state.session = null;
    release(session);
    session.worker?.terminate();
    state.transcript.durationMs = Math.round(session.activeMs);
    state.interim = [];
    state.breakNext = false;
    setPhase("idle");
    renderAll();
    if (state.transcript.segments.length) state.dirty = true;
    await save();
  }

  recordBtn.addEventListener("click", () => (LISTENING.has(state.phase) ? stop() : void start()));
  pauseBtn.addEventListener("click", togglePause);

  // Closing or reloading the browser tab would end the listening: the browser
  // asks first.
  window.addEventListener("beforeunload", (event) => {
    if (!state.session) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // ---- Saving ----

  let saveTimer = null;

  function markDirty() {
    state.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void save(), 3000);
  }

  async function save() {
    clearTimeout(saveTimer);
    const transcript = state.transcript;
    if (!state.dirty || state.saving) return;
    // Nothing said yet: no empty file is left behind.
    if (!transcript.id && transcript.segments.length === 0) return;
    state.saving = true;
    state.dirty = false;
    const saved = $("saved");
    try {
      if (transcript.id) await api("PUT", `api/transcripts/${transcript.id}`, transcript);
      else transcript.id = (await api("POST", "api/transcripts", transcript)).id;
      saved.textContent = t("saved.done", { time: new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) });
      saved.classList.remove("failed");
      void loadHistory();
    } catch {
      state.dirty = true;
      saved.textContent = t("saved.failed");
      saved.classList.add("failed");
    } finally {
      state.saving = false;
    }
    // Words that arrived while the request was on its way.
    if (state.dirty && state.transcript === transcript) markDirty();
  }

  // The tab is closing or going to the background: what is not saved yet goes
  // out with a request the browser finishes on its own.
  window.addEventListener("pagehide", () => {
    const transcript = state.transcript;
    if (!state.dirty || !transcript.id) return;
    void fetch(`api/transcripts/${transcript.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transcript),
      keepalive: true,
    });
  });

  $("title").addEventListener("input", (event) => {
    state.transcript.title = event.target.value;
    markDirty();
  });

  // ---- Copy, download, new ----

  function refreshButtons() {
    const hasText = state.transcript.segments.length > 0;
    $("copy").disabled = !hasText;
    $("download").disabled = !hasText;
    $("new").disabled = state.phase !== "idle" || !hasText;
  }

  const turnsOf = (transcript) => transcript.segments.map((segment) => ({ ...segment, name: speakerName(segment.speaker), text: segment.text.trim() }));

  function asMarkdown() {
    const transcript = state.transcript;
    const date = new Date(transcript.startedAt ?? Date.now()).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" });
    const lines = [`# ${transcript.title.trim() || t("title.placeholder")}`, "", `_${t("export.meta", { date, duration: clock(transcript.durationMs) })}_`, ""];
    for (const turn of turnsOf(transcript)) {
      if (turn.gap) lines.push("---", "", `_${t("gap.label")}_`, "");
      lines.push(`**${turn.name}** · ${clock(turn.startMs)}`, "", turn.text, "");
    }
    return lines.join("\n");
  }

  $("copy").addEventListener("click", async () => {
    const text = turnsOf(state.transcript)
      .map((turn) => `${turn.name}: ${turn.text}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard refused (frame without the permission, old browser): the
      // selection-based way still works.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast(t("action.copied"));
  });

  $("download").addEventListener("click", () => {
    const transcript = state.transcript;
    const slug = (transcript.title || "")
      .normalize("NFD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([asMarkdown()], { type: "text/markdown;charset=utf-8" }));
    link.download = `${slug || "transcript"}-${transcript.id ?? "draft"}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  $("new").addEventListener("click", async () => {
    if (state.phase !== "idle") return;
    await save();
    openTranscript(emptyTranscript());
  });

  // ---- History ----

  let history = [];

  function openTranscript(transcript) {
    state.transcript = transcript;
    state.interim = [];
    state.dirty = false;
    state.following = true;
    state.breakNext = false;
    order = [];
    for (const segment of transcript.segments) noteSpeaker(segment.speaker);
    $("title").value = transcript.title ?? "";
    $("saved").textContent = "";
    renderAll();
    renderHistory();
  }

  async function loadHistory() {
    try {
      history = (await api("GET", "api/transcripts")).transcripts;
    } catch {
      return;
    }
    renderHistory();
  }

  function renderHistory() {
    const list = $("history");
    const query = $("history-search").value.trim().toLowerCase();
    const shown = history.filter((entry) => !query || (entry.title || t("title.placeholder")).toLowerCase().includes(query));
    const busy = state.phase !== "idle";

    list.replaceChildren();
    const empty = $("history-empty");
    empty.classList.toggle("hidden", shown.length > 0);
    empty.textContent = t(history.length ? "history.noMatch" : "history.empty");

    for (const entry of shown) {
      const item = document.createElement("li");
      item.classList.toggle("current", entry.id === state.transcript.id);

      const open = document.createElement("button");
      open.type = "button";
      open.className = "lt-history-open";
      open.disabled = busy;
      const name = document.createElement("span");
      name.className = "lt-history-name";
      name.textContent = entry.title || t("title.placeholder");
      const meta = document.createElement("span");
      meta.className = "lt-history-meta";
      meta.textContent = [
        new Date(entry.startedAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }),
        clock(entry.durationMs),
        tn("meta.speakers", entry.speakers),
      ].join(" · ");
      open.append(name, meta);
      open.addEventListener("click", async () => {
        if (state.phase !== "idle") return;
        await save();
        try {
          const transcript = await api("GET", `api/transcripts/${entry.id}`);
          openTranscript({ ...emptyTranscript(), ...transcript });
          $("app").classList.remove("history-open");
        } catch (error) {
          notify(error.code, { status: error.status ?? "" });
        }
      });

      // Two clicks to delete: the first one asks, and forgets after a moment.
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "lt-history-delete";
      remove.title = t("history.delete");
      remove.setAttribute("aria-label", t("history.delete"));
      remove.disabled = busy;
      const bin = () => (remove.innerHTML = '<svg><use href="#i-trash"/></svg>');
      bin();
      remove.addEventListener("click", async () => {
        if (!remove.classList.contains("confirm")) {
          remove.classList.add("confirm");
          remove.textContent = t("history.confirm");
          setTimeout(() => {
            remove.classList.remove("confirm");
            bin();
          }, 4000);
          return;
        }
        try {
          await api("DELETE", `api/transcripts/${entry.id}`);
        } catch (error) {
          notify(error.code, { status: error.status ?? "" });
          return;
        }
        toast(t("history.deleted"));
        if (entry.id === state.transcript.id) openTranscript(emptyTranscript());
        void loadHistory();
      });

      item.append(open, remove);
      list.appendChild(item);
    }
  }

  $("history-search").addEventListener("input", renderHistory);

  // ---- Panels, on a narrow screen ----

  $("history-toggle").addEventListener("click", () => {
    $("app").classList.remove("speakers-open");
    $("app").classList.toggle("history-open");
  });
  $("speakers-toggle").addEventListener("click", () => {
    $("app").classList.remove("history-open");
    $("app").classList.toggle("speakers-open");
  });
  for (const button of document.querySelectorAll("[data-close]")) {
    button.addEventListener("click", () => $("app").classList.remove(`${button.dataset.close}-open`));
  }

  // ---- Start-up ----

  setPhase("idle");
  renderAll();
  void loadHistory();
  api("GET", "api/status")
    .then(() => {
      if (!window.isSecureContext) notify("insecure");
    })
    .catch(() => notify("server"));
})();
