// Home Assistant bridge — the background service of the plugin.
//
// It stays connected to Home Assistant's websocket, subscribed to the events,
// and holds a list of rules written in the settings: "when this entity
// reaches that state, tell this agent this". A matching event wakes the
// agent through the Unix socket of Allkin (same protocol as the CLI); what
// the agent answers goes back to Home Assistant as a notification, so the
// loop closes where it started. One conversation per agent is kept across
// restarts (sessions.json): an agent woken ten times keeps its context.
//
// Settings arrive from Allkin in the environment (see plugin-services.ts);
// ALLKIN_SOCKET only exists with the "agents" right.
import { connect } from "node:net";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const settings = JSON.parse(process.env.ALLKIN_PLUGIN_SETTINGS ?? "{}");
const dataDir = process.env.ALLKIN_PLUGIN_DATA ?? join(process.cwd(), "data");
const socketPath = process.env.ALLKIN_SOCKET;
const haUrl = String(settings.haUrl ?? "").trim().replace(/\/+$/, "");
const token = String(settings.token ?? "").trim();
const replyTarget = String(settings.notify ?? "").trim();
const cooldownMs = Math.max(0, Number(settings.cooldown ?? 60) || 0) * 1000;
const language = ["en", "fr", "es", "de"].includes(settings.language) ? settings.language : "en";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!haUrl) fail("The Home Assistant address is empty: set it in the plugin's settings.");
if (!token) fail("The long-lived access token is empty: set it in the plugin's settings.");
if (!socketPath) fail("ALLKIN_SOCKET is missing: the plugin needs the \"agents\" right to reach the agents.");
mkdirSync(dataDir, { recursive: true });

const log = (...args) => console.log(new Date().toISOString(), ...args);

const TEXTS = {
  en: {
    title: "Allkin — {agent}",
    autoRefused: "The agent wanted to run a command, refused automatically (no one can approve it from Home Assistant): {command}",
    error: "The agent failed: {message}",
  },
  fr: {
    title: "Allkin — {agent}",
    autoRefused: "L'agent voulait lancer une commande, refusée automatiquement (personne ne peut la valider depuis Home Assistant) : {command}",
    error: "L'agent a échoué : {message}",
  },
  es: {
    title: "Allkin — {agent}",
    autoRefused: "El agente quería ejecutar un comando, rechazado automáticamente (nadie puede autorizarlo desde Home Assistant): {command}",
    error: "El agente falló: {message}",
  },
  de: {
    title: "Allkin — {agent}",
    autoRefused: "Der Agent wollte einen Befehl ausführen, automatisch abgelehnt (niemand kann ihn aus Home Assistant freigeben): {command}",
    error: "Der Agent ist gescheitert: {message}",
  },
};
const t = (key, vars = {}) => (TEXTS[language][key] ?? TEXTS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/* ---- Rules ----------------------------------------------------------------
   One per line in the settings:

     binary_sensor.front_door => on -> administrateur : The front door just opened.
     sensor.outdoor_temperature -> meteo : Outdoor temperature is now {state} °C.
     event:zha_event -> admin : Zigbee event: {data}

   "entity [=> state]" matches a state change (a "*" wildcard is allowed in
   the entity id; without "=> state", any change); "event:<type>" matches any
   event of that type. The message may use {entity}, {name}, {state}, {old},
   {attrs} (JSON of the attributes) and {data} (JSON of the event data). */
const RULE = /^\s*(event:\S+|[a-z_0-9]+\.[\w*]+)\s*(?:=>\s*([^\s-][^->]*?))?\s*->\s*([\w-]+)\s*:\s*(.+?)\s*$/i;
const rules = String(settings.rules ?? "")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const m = line.match(RULE);
    if (!m) {
      log(`rule ignored (unreadable): ${line}`);
      return null;
    }
    const [, target, state, agentId, message] = m;
    return {
      line,
      eventType: target.startsWith("event:") ? target.slice(6) : null,
      entity: target.startsWith("event:") ? null : new RegExp(`^${target.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i"),
      state: state?.trim() || null,
      agentId,
      message,
      lastAt: 0,
    };
  })
  .filter(Boolean);
if (rules.length === 0) fail("No readable rule: write at least one in the settings (see the help).");
log(`${rules.length} rule(s) loaded`);

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}

/* ---- Allkin: one link per agent ----------------------------------------- */
const sessionsPath = join(dataDir, "sessions.json");
let sessions = {};
try {
  sessions = JSON.parse(readFileSync(sessionsPath, "utf-8"));
} catch {
  sessions = {};
}
const saveSessions = () => writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2) + "\n", { mode: 0o600 });
const links = new Map();

function connectLink(agentId, sessionId) {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    const link = { socket, agentId, sessionId: null, name: agentId, ready: false, queue: [] };
    let buffer = "";
    let settled = false;
    socket.on("connect", () => socket.write(JSON.stringify({ type: "attach", agentId, ...(sessionId ? { sessionId } : {}) }) + "\n"));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      let i;
      while ((i = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 1);
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (!settled) {
          settled = true;
          if (msg.type === "attached") {
            link.sessionId = msg.sessionId;
            link.name = msg.name ?? agentId;
            link.ready = true;
            resolve(link);
          } else {
            socket.destroy();
            reject(new Error(msg.message ?? msg.type));
          }
          continue;
        }
        void onAgentEvent(link, msg);
      }
    });
    socket.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      } else log(`socket of ${agentId}: ${error.message}`);
    });
    socket.on("close", () => {
      if (links.get(agentId) === link) links.delete(agentId);
    });
  });
}

async function linkFor(agentId) {
  const live = links.get(agentId);
  if (live?.ready && !live.socket.destroyed) return live;
  let link;
  try {
    link = await connectLink(agentId, sessions[agentId]);
  } catch (error) {
    if (sessions[agentId]) {
      log(`session of ${agentId} unusable (${error.message}); opening a new one`);
      link = await connectLink(agentId, undefined);
    } else throw error;
  }
  sessions[agentId] = link.sessionId;
  saveSessions();
  links.set(agentId, link);
  return link;
}

const sendToLink = (link, payload) => link.socket.write(JSON.stringify({ ...payload, agentId: link.agentId, sessionId: link.sessionId }) + "\n");

/** The agent's words of one turn, gathered and sent to Home Assistant when
 *  the turn ends: one notification per wake-up, not one per paragraph. */
async function onAgentEvent(link, msg) {
  switch (msg.type) {
    case "assistant_text":
      link.queue.push(msg.text);
      break;
    case "turn_done": {
      const text = link.queue.splice(0).join("\n\n").trim();
      if (text) await notifyHa(link.name, text);
      break;
    }
    case "error":
      link.queue.splice(0);
      await notifyHa(link.name, t("error", { message: msg.message }));
      break;
    case "command_proposal":
      sendToLink(link, { type: "approval_response", requestId: msg.requestId, approved: false });
      link.queue.push(t("autoRefused", { command: msg.command }));
      break;
    case "form_request":
      sendToLink(link, { type: "form_response", requestId: msg.requestId, values: null });
      break;
    case "closed":
      link.socket.destroy();
      break;
    default:
      break;
  }
}

/* ---- Home Assistant websocket ------------------------------------------- */
let ws = null;
let nextId = 1;
const waiting = new Map();

function haSend(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("not connected"));
  const id = nextId++;
  ws.send(JSON.stringify({ id, ...payload }));
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    setTimeout(() => {
      if (waiting.delete(id)) reject(new Error(`no answer to ${payload.type}`));
    }, 15_000);
  });
}

/** The agent's answer, back in Home Assistant: a persistent notification, or
 *  the notify service named in the settings (notify.mobile_app_…). */
async function notifyHa(agentName, text) {
  const title = t("title", { agent: agentName });
  try {
    if (replyTarget && replyTarget !== "persistent_notification") {
      const service = replyTarget.replace(/^notify\./, "");
      await haSend({ type: "call_service", domain: "notify", service, service_data: { title, message: text } });
    } else {
      await haSend({
        type: "call_service",
        domain: "persistent_notification",
        service: "create",
        service_data: { title, message: text, notification_id: `allkin_${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}` },
      });
    }
  } catch (error) {
    log(`cannot notify Home Assistant: ${error.message}`);
  }
}

async function onHaEvent(event) {
  const type = event.event_type;
  const data = event.data ?? {};
  const now = Date.now();
  for (const rule of rules) {
    let vars = null;
    if (rule.eventType) {
      if (type !== rule.eventType) continue;
      vars = { event: type, data: JSON.stringify(data) };
    } else {
      if (type !== "state_changed") continue;
      const entity = data.entity_id ?? "";
      if (!rule.entity.test(entity)) continue;
      const newState = data.new_state?.state ?? "";
      const oldState = data.old_state?.state ?? "";
      if (rule.state && newState !== rule.state) continue;
      if (!rule.state && newState === oldState) continue;
      vars = {
        entity,
        name: data.new_state?.attributes?.friendly_name ?? entity,
        state: newState,
        old: oldState,
        attrs: JSON.stringify(data.new_state?.attributes ?? {}),
        data: JSON.stringify(data),
      };
    }
    if (now - rule.lastAt < cooldownMs) {
      log(`rule "${rule.line.slice(0, 50)}" matched but in cooldown`);
      continue;
    }
    rule.lastAt = now;
    const message = fill(rule.message, vars);
    log(`→ ${rule.agentId}: ${message.slice(0, 120)}`);
    try {
      const link = await linkFor(rule.agentId);
      sendToLink(link, { type: "message", text: message });
    } catch (error) {
      log(`cannot reach agent ${rule.agentId}: ${error.message}`);
    }
  }
}

function connectHa() {
  const url = haUrl.replace(/^http/, "ws") + "/api/websocket";
  log(`connecting to ${url}`);
  ws = new WebSocket(url);
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === "auth_required") {
      ws.send(JSON.stringify({ type: "auth", access_token: token }));
    } else if (msg.type === "auth_ok") {
      log(`connected to Home Assistant ${msg.ha_version ?? ""}`);
      // Every event: the rules sort them out; "state_changed" is most of them.
      ws.send(JSON.stringify({ id: nextId++, type: "subscribe_events" }));
    } else if (msg.type === "auth_invalid") {
      log(`Home Assistant refused the token: ${msg.message ?? ""}`);
      ws.close();
    } else if (msg.type === "event") {
      void onHaEvent(msg.event ?? {});
    } else if (msg.type === "result" && waiting.has(msg.id)) {
      const w = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.success) w.resolve(msg.result);
      else w.reject(new Error(msg.error?.message ?? "refused"));
    }
  });
  ws.addEventListener("close", () => {
    log("Home Assistant connection closed; reconnecting in 10 s");
    for (const w of waiting.values()) w.reject(new Error("connection closed"));
    waiting.clear();
    setTimeout(connectHa, 10_000);
  });
  ws.addEventListener("error", (ev) => log(`websocket error: ${ev.message ?? "unknown"}`));
}

process.on("SIGTERM", () => {
  for (const link of links.values()) link.socket.destroy();
  ws?.close();
  process.exit(0);
});

connectHa();
