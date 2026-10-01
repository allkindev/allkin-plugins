// Telegram bridge — the background service of the plugin.
//
// One loop polls Telegram (getUpdates, long polling: no public address, no
// webhook to set up). Every allowed chat is bound to an Allkin agent through
// the Unix socket of Allkin, with the same protocol as the CLI: one socket
// connection per chat, attached to a session that lasts across restarts
// (chats.json in the plugin's data folder). What the agent answers goes back
// to the chat; what it asks (a command to approve) comes as buttons.
//
// Settings arrive from Allkin in the environment (see plugin-services.ts);
// ALLKIN_SOCKET and ALLKIN_DIR only exist with the "agents" right.
import { connect } from "node:net";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const settings = JSON.parse(process.env.ALLKIN_PLUGIN_SETTINGS ?? "{}");
const dataDir = process.env.ALLKIN_PLUGIN_DATA ?? join(process.cwd(), "data");
const socketPath = process.env.ALLKIN_SOCKET;
const allkinDir = process.env.ALLKIN_DIR;
const token = String(settings.botToken ?? "").trim();
const apiBase = String(settings.apiBase ?? "https://api.telegram.org").replace(/\/+$/, "");
const allowed = new Set(
  String(settings.allowedUsers ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean),
);
const defaultAgent = String(settings.defaultAgent ?? "").trim();
const approvalsFromChat = settings.approvals !== false;
const language = ["en", "fr", "es", "de"].includes(settings.language) ? settings.language : "en";

if (!token) fail("The bot token is empty: set it in the plugin's settings.");
if (!socketPath) fail("ALLKIN_SOCKET is missing: the plugin needs the \"agents\" right to reach the agents.");
if (allowed.size === 0) fail("No allowed Telegram user: set at least one user id in the settings.");
mkdirSync(dataDir, { recursive: true });

function fail(message) {
  console.error(message);
  process.exit(1);
}

/* ---- Texts shown in the chat, in the language chosen in the settings ---- */
const TEXTS = {
  en: {
    notAllowed: "This bot is private. Your Telegram id is {id}: ask the owner of Allkin to add it to the allowed users.",
    help: "I relay this chat to an Allkin agent.\n\n/agents — the agents you can talk to\n/agent <id> — switch to one\n/new — start a fresh conversation\n/who — which agent and conversation this chat uses\n\nAnything else is sent to the agent. A photo or a file is dropped into its Upload folder.",
    agents: "Agents:\n{list}\n\nCurrent: {current}",
    switched: "This chat now talks to {name}. A new conversation starts.",
    unknownAgent: "No agent named {id}. /agents lists them.",
    newSession: "New conversation with {name}.",
    who: "Agent: {name} ({id})\nConversation: {session}",
    noAgent: "No agent is set for this chat: use /agent <id>, or set a default agent in the plugin's settings.",
    unreachable: "Allkin does not answer right now: try again in a moment.",
    error: "⚠️ {message}",
    proposal: "The agent wants to run a command ({risk}):\n\n{command}\n\n{explanation}",
    approve: "✅ Approve",
    refuse: "❌ Refuse",
    approved: "Approved.",
    refused: "Refused.",
    autoRefused: "The agent proposed a command, refused automatically (approvals from Telegram are off):\n{command}",
    formUnsupported: "The agent asked for a form, which cannot be filled from Telegram: cancelled. Answer in Allkin's interface, or rephrase.",
    fileSaved: "File received: {name}",
    fileFailed: "Could not fetch the file from Telegram: {message}",
    fileNote: "[File dropped in Upload/{name}]",
  },
  fr: {
    notAllowed: "Ce bot est privé. Ton identifiant Telegram est {id} : demande au propriétaire d'Allkin de l'ajouter aux utilisateurs autorisés.",
    help: "Je relaie cette conversation à un agent Allkin.\n\n/agents — les agents à qui tu peux parler\n/agent <id> — passer à l'un d'eux\n/new — repartir sur une conversation vierge\n/who — l'agent et la conversation de ce chat\n\nTout le reste part à l'agent. Une photo ou un fichier est déposé dans son dossier Upload.",
    agents: "Agents :\n{list}\n\nActuel : {current}",
    switched: "Ce chat parle maintenant à {name}. Une nouvelle conversation commence.",
    unknownAgent: "Aucun agent nommé {id}. /agents les liste.",
    newSession: "Nouvelle conversation avec {name}.",
    who: "Agent : {name} ({id})\nConversation : {session}",
    noAgent: "Aucun agent n'est réglé pour ce chat : utilise /agent <id>, ou règle un agent par défaut dans les réglages du plugin.",
    unreachable: "Allkin ne répond pas pour le moment : réessaie dans un instant.",
    error: "⚠️ {message}",
    proposal: "L'agent veut lancer une commande ({risk}) :\n\n{command}\n\n{explanation}",
    approve: "✅ Autoriser",
    refuse: "❌ Refuser",
    approved: "Autorisée.",
    refused: "Refusée.",
    autoRefused: "L'agent a proposé une commande, refusée automatiquement (les validations depuis Telegram sont désactivées) :\n{command}",
    formUnsupported: "L'agent a demandé un formulaire, impossible à remplir depuis Telegram : annulé. Réponds dans l'interface d'Allkin, ou reformule.",
    fileSaved: "Fichier reçu : {name}",
    fileFailed: "Impossible de récupérer le fichier depuis Telegram : {message}",
    fileNote: "[Fichier déposé dans Upload/{name}]",
  },
  es: {
    notAllowed: "Este bot es privado. Tu identificador de Telegram es {id}: pide al propietario de Allkin que lo añada a los usuarios autorizados.",
    help: "Reenvío este chat a un agente de Allkin.\n\n/agents — los agentes con los que puedes hablar\n/agent <id> — cambiar a uno\n/new — empezar una conversación nueva\n/who — el agente y la conversación de este chat\n\nTodo lo demás va al agente. Una foto o un archivo se deposita en su carpeta Upload.",
    agents: "Agentes:\n{list}\n\nActual: {current}",
    switched: "Este chat habla ahora con {name}. Empieza una conversación nueva.",
    unknownAgent: "No hay ningún agente llamado {id}. /agents los lista.",
    newSession: "Nueva conversación con {name}.",
    who: "Agente: {name} ({id})\nConversación: {session}",
    noAgent: "No hay agente configurado para este chat: usa /agent <id>, o fija un agente por defecto en los ajustes del plugin.",
    unreachable: "Allkin no responde ahora mismo: inténtalo de nuevo en un momento.",
    error: "⚠️ {message}",
    proposal: "El agente quiere ejecutar un comando ({risk}):\n\n{command}\n\n{explanation}",
    approve: "✅ Autorizar",
    refuse: "❌ Rechazar",
    approved: "Autorizado.",
    refused: "Rechazado.",
    autoRefused: "El agente propuso un comando, rechazado automáticamente (las validaciones desde Telegram están desactivadas):\n{command}",
    formUnsupported: "El agente pidió un formulario, que no se puede rellenar desde Telegram: cancelado. Responde en la interfaz de Allkin, o reformula.",
    fileSaved: "Archivo recibido: {name}",
    fileFailed: "No se pudo obtener el archivo de Telegram: {message}",
    fileNote: "[Archivo depositado en Upload/{name}]",
  },
  de: {
    notAllowed: "Dieser Bot ist privat. Deine Telegram-Id ist {id}: Bitte den Besitzer von Allkin, sie zu den erlaubten Nutzern hinzuzufügen.",
    help: "Ich leite diesen Chat an einen Allkin-Agenten weiter.\n\n/agents — die Agenten, mit denen du sprechen kannst\n/agent <id> — zu einem wechseln\n/new — eine neue Unterhaltung beginnen\n/who — Agent und Unterhaltung dieses Chats\n\nAlles andere geht an den Agenten. Ein Foto oder eine Datei landet in seinem Upload-Ordner.",
    agents: "Agenten:\n{list}\n\nAktuell: {current}",
    switched: "Dieser Chat spricht jetzt mit {name}. Eine neue Unterhaltung beginnt.",
    unknownAgent: "Kein Agent namens {id}. /agents listet sie auf.",
    newSession: "Neue Unterhaltung mit {name}.",
    who: "Agent: {name} ({id})\nUnterhaltung: {session}",
    noAgent: "Für diesen Chat ist kein Agent eingestellt: nutze /agent <id>, oder lege in den Plugin-Einstellungen einen Standard-Agenten fest.",
    unreachable: "Allkin antwortet gerade nicht: versuche es gleich noch einmal.",
    error: "⚠️ {message}",
    proposal: "Der Agent will einen Befehl ausführen ({risk}):\n\n{command}\n\n{explanation}",
    approve: "✅ Erlauben",
    refuse: "❌ Ablehnen",
    approved: "Erlaubt.",
    refused: "Abgelehnt.",
    autoRefused: "Der Agent hat einen Befehl vorgeschlagen, automatisch abgelehnt (Freigaben aus Telegram sind aus):\n{command}",
    formUnsupported: "Der Agent hat ein Formular angefordert, das sich aus Telegram nicht ausfüllen lässt: abgebrochen. Antworte in der Allkin-Oberfläche oder formuliere um.",
    fileSaved: "Datei erhalten: {name}",
    fileFailed: "Die Datei konnte nicht von Telegram geholt werden: {message}",
    fileNote: "[Datei in Upload/{name} abgelegt]",
  },
};
const t = (key, vars = {}) => (TEXTS[language][key] ?? TEXTS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/* ---- Telegram ----------------------------------------------------------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

async function tg(method, params = {}, { timeoutMs = 30_000 } = {}) {
  const res = await fetch(`${apiBase}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`${method}: ${data.description ?? `HTTP ${res.status}`}`);
  return data.result;
}

/** Telegram caps a message at 4096 characters: longer answers go in slices. */
async function send(chatId, text, extra = {}) {
  const chunks = [];
  let rest = String(text ?? "");
  if (!rest.trim()) return;
  while (rest.length > 4000) {
    let cut = rest.lastIndexOf("\n", 4000);
    if (cut < 1000) cut = 4000;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  chunks.push(rest);
  for (const [i, chunk] of chunks.entries()) {
    try {
      await tg("sendMessage", { chat_id: chatId, text: chunk, ...(i === chunks.length - 1 ? extra : {}) });
    } catch (error) {
      log(`sendMessage failed: ${error.message}`);
    }
  }
}

/* ---- Chats and their sessions ------------------------------------------- */
const chatsPath = join(dataDir, "chats.json");
let chats = {};
try {
  chats = JSON.parse(readFileSync(chatsPath, "utf-8"));
} catch {
  chats = {};
}
const saveChats = () => writeFileSync(chatsPath, JSON.stringify(chats, null, 2) + "\n", { mode: 0o600 });

/** One live link per chat: a socket attached to the chat's agent and session. */
const links = new Map();
/** Command proposals waiting for a button, by requestId. */
const pending = new Map();
/** The typing indicator, renewed while the agent works. */
const typing = new Map();

function startTyping(chatId) {
  stopTyping(chatId);
  const tick = () => tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  tick();
  typing.set(chatId, setInterval(tick, 4500));
}
function stopTyping(chatId) {
  const timer = typing.get(chatId);
  if (timer) clearInterval(timer);
  typing.delete(chatId);
}

function connectLink(chatId, agentId, sessionId) {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    const link = { socket, agentId, sessionId: null, ready: false };
    let buffer = "";
    let settled = false;
    socket.on("connect", () => {
      socket.write(JSON.stringify({ type: "attach", agentId, ...(sessionId ? { sessionId } : {}) }) + "\n");
    });
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
            link.name = msg.name;
            link.ready = true;
            resolve(link);
          } else {
            socket.destroy();
            reject(new Error(msg.message ?? msg.type));
          }
          continue;
        }
        void onAgentEvent(chatId, link, msg);
      }
    });
    socket.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      } else log(`socket of chat ${chatId}: ${error.message}`);
    });
    socket.on("close", () => {
      if (links.get(chatId) === link) links.delete(chatId);
      stopTyping(chatId);
    });
  });
}

/** The link of a chat, opened on demand; the session is remembered so a
 *  restart of the plugin (or of Allkin) picks the conversation up again. */
async function linkFor(chatId) {
  const live = links.get(chatId);
  if (live?.ready && !live.socket.destroyed) return live;
  const chat = chats[chatId] ?? {};
  const agentId = chat.agentId || defaultAgent;
  if (!agentId) return null;
  let link;
  try {
    link = await connectLink(chatId, agentId, chat.sessionId);
  } catch (error) {
    // A session gone (archived, removed): start a fresh one once.
    if (chat.sessionId) {
      log(`session ${chat.sessionId} of chat ${chatId} unusable (${error.message}); opening a new one`);
      link = await connectLink(chatId, agentId, undefined);
    } else throw error;
  }
  chats[chatId] = { agentId, sessionId: link.sessionId };
  saveChats();
  links.set(chatId, link);
  return link;
}

function sendToLink(link, payload) {
  link.socket.write(JSON.stringify({ ...payload, agentId: link.agentId, sessionId: link.sessionId }) + "\n");
}

async function onAgentEvent(chatId, link, msg) {
  switch (msg.type) {
    case "assistant_text":
      await send(chatId, msg.text);
      break;
    case "turn_done":
      stopTyping(chatId);
      break;
    case "error":
      stopTyping(chatId);
      await send(chatId, t("error", { message: msg.message }));
      break;
    case "command_proposal": {
      if (!approvalsFromChat) {
        sendToLink(link, { type: "approval_response", requestId: msg.requestId, approved: false });
        await send(chatId, t("autoRefused", { command: msg.command }));
        break;
      }
      pending.set(msg.requestId, { chatId, link });
      await send(chatId, t("proposal", { risk: msg.riskLevel, command: msg.command, explanation: msg.explanation ?? "" }), {
        reply_markup: {
          inline_keyboard: [[
            { text: t("approve"), callback_data: `ap:${msg.requestId}:1` },
            { text: t("refuse"), callback_data: `ap:${msg.requestId}:0` },
          ]],
        },
      });
      break;
    }
    case "form_request":
      sendToLink(link, { type: "form_response", requestId: msg.requestId, values: null });
      await send(chatId, t("formUnsupported"));
      break;
    case "closed":
      stopTyping(chatId);
      link.socket.destroy();
      break;
    default:
      break;
  }
}

/* ---- Agents (for /agents and /agent) ------------------------------------ */
function listAgents() {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let buffer = "";
    socket.on("connect", () => socket.write(JSON.stringify({ type: "list_agents" }) + "\n"));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      const i = buffer.indexOf("\n");
      if (i === -1) return;
      try {
        const msg = JSON.parse(buffer.slice(0, i));
        resolve(msg.type === "agents" ? msg.agents ?? [] : []);
      } catch {
        resolve([]);
      }
      socket.destroy();
    });
    socket.on("error", reject);
  });
}

/* ---- Files from the chat --------------------------------------------------
   Dropped in the agent's Upload folder, like the upload webhook does: the
   agent reads them from there, the message names the file. */
function uploadDirOf(agentId) {
  return join(allkinDir, "agents", agentId, "data", "Upload");
}

async function fetchTelegramFile(fileId, proposedName, agentId) {
  const info = await tg("getFile", { file_id: fileId });
  const res = await fetch(`${apiBase}/file/bot${token}/${info.file_path}`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const dir = uploadDirOf(agentId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let name = (proposedName || info.file_path?.split("/").pop() || "file").replace(/[/\\]/g, "_").replace(/^\.+/, "").slice(0, 120) || "file";
  if (existsSync(join(dir, name))) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    name = `${base}-${Date.now().toString(36)}${ext}`;
  }
  writeFileSync(join(dir, name), bytes, { mode: 0o600 });
  return name;
}

/* ---- Handling what arrives from Telegram --------------------------------- */
async function onMessage(message) {
  const chatId = message.chat.id;
  const from = message.from ?? {};
  if (!allowed.has(String(from.id))) {
    log(`refused user ${from.id} (${from.username ?? "?"})`);
    await send(chatId, t("notAllowed", { id: from.id }));
    return;
  }
  // A photo or a file carries its words in "caption", with an empty "text".
  const text = (message.text || message.caption || "").trim();

  if (/^\/(start|help)\b/.test(text)) return send(chatId, t("help"));
  if (/^\/agents\b/.test(text)) {
    let agents;
    try {
      agents = await listAgents();
    } catch {
      return send(chatId, t("unreachable"));
    }
    const current = chats[chatId]?.agentId || defaultAgent || "—";
    return send(chatId, t("agents", { list: agents.map((a) => `• ${a.name} — /agent ${a.id}`).join("\n") || "—", current }));
  }
  if (/^\/agent\b/.test(text)) {
    const wanted = text.replace(/^\/agent\s*/, "").trim();
    let agents;
    try {
      agents = await listAgents();
    } catch {
      return send(chatId, t("unreachable"));
    }
    const agent = agents.find((a) => a.id === wanted || a.name.toLowerCase() === wanted.toLowerCase());
    if (!agent) return send(chatId, t("unknownAgent", { id: wanted }));
    links.get(chatId)?.socket.destroy();
    chats[chatId] = { agentId: agent.id };
    saveChats();
    return send(chatId, t("switched", { name: agent.name }));
  }
  if (/^\/new\b/.test(text)) {
    links.get(chatId)?.socket.destroy();
    const agentId = chats[chatId]?.agentId || defaultAgent;
    chats[chatId] = { agentId };
    saveChats();
    const link = await linkFor(chatId).catch(() => null);
    return send(chatId, link ? t("newSession", { name: link.name }) : t("noAgent"));
  }
  if (/^\/who\b/.test(text)) {
    const chat = chats[chatId] ?? {};
    const link = await linkFor(chatId).catch(() => null);
    return send(chatId, link ? t("who", { name: link.name, id: link.agentId, session: link.sessionId }) : t("noAgent"));
  }

  let link;
  try {
    link = await linkFor(chatId);
  } catch (error) {
    log(`cannot link chat ${chatId}: ${error.message}`);
    return send(chatId, t("unreachable"));
  }
  if (!link) return send(chatId, t("noAgent"));

  // Attachments first: the agent is told where they landed.
  const notes = [];
  const files = [];
  if (message.document) files.push({ id: message.document.file_id, name: message.document.file_name });
  if (message.photo?.length) files.push({ id: message.photo[message.photo.length - 1].file_id, name: `photo-${message.message_id}.jpg` });
  if (message.voice) files.push({ id: message.voice.file_id, name: `voice-${message.message_id}.ogg` });
  if (message.audio) files.push({ id: message.audio.file_id, name: message.audio.file_name ?? `audio-${message.message_id}.mp3` });
  if (message.video) files.push({ id: message.video.file_id, name: message.video.file_name ?? `video-${message.message_id}.mp4` });
  for (const file of files) {
    try {
      const name = await fetchTelegramFile(file.id, file.name, link.agentId);
      notes.push(t("fileNote", { name }));
      await send(chatId, t("fileSaved", { name }));
    } catch (error) {
      await send(chatId, t("fileFailed", { message: error.message }));
    }
  }
  const outgoing = [text, ...notes].filter(Boolean).join("\n");
  if (!outgoing) return;
  startTyping(chatId);
  sendToLink(link, { type: "message", text: outgoing });
}

async function onCallback(query) {
  const [kind, requestId, value] = String(query.data ?? "").split(":");
  if (kind !== "ap" || !pending.has(requestId)) {
    await tg("answerCallbackQuery", { callback_query_id: query.id }).catch(() => {});
    return;
  }
  if (!allowed.has(String(query.from?.id))) {
    await tg("answerCallbackQuery", { callback_query_id: query.id, text: t("notAllowed", { id: query.from?.id }) }).catch(() => {});
    return;
  }
  const { chatId, link } = pending.get(requestId);
  pending.delete(requestId);
  const approved = value === "1";
  sendToLink(link, { type: "approval_response", requestId, approved });
  await tg("answerCallbackQuery", { callback_query_id: query.id, text: approved ? t("approved") : t("refused") }).catch(() => {});
  if (query.message) {
    await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  }
  if (approved) startTyping(chatId);
}

/* ---- The polling loop ---------------------------------------------------- */
const offsetPath = join(dataDir, "offset.json");
let offset = 0;
try {
  offset = Number(JSON.parse(readFileSync(offsetPath, "utf-8")).offset) || 0;
} catch {
  offset = 0;
}

async function main() {
  const me = await tg("getMe");
  log(`bridge up as @${me.username}; ${allowed.size} allowed user(s); default agent: ${defaultAgent || "(none)"}`);
  // Webhooks and polling exclude each other: make sure none is set.
  await tg("deleteWebhook", { drop_pending_updates: false }).catch(() => {});
  for (;;) {
    let updates;
    try {
      updates = await tg("getUpdates", { offset, timeout: 50, allowed_updates: ["message", "callback_query"] }, { timeoutMs: 65_000 });
    } catch (error) {
      log(`getUpdates failed: ${error.message}; retrying in 5 s`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    for (const update of updates) {
      offset = update.update_id + 1;
      try {
        if (update.message) await onMessage(update.message);
        else if (update.callback_query) await onCallback(update.callback_query);
      } catch (error) {
        log(`update ${update.update_id} failed: ${error.message}`);
      }
    }
    if (updates.length) writeFileSync(offsetPath, JSON.stringify({ offset }) + "\n");
  }
}

process.on("SIGTERM", () => {
  for (const link of links.values()) link.socket.destroy();
  process.exit(0);
});

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
