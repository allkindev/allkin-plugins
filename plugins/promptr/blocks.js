"use strict";
/* ============================================================================
   Promptr — les blocs d'un plan.
   ----------------------------------------------------------------------------
   Un plan décrit un agent en blocs : rôle, personnalité, compétences… Chaque
   nature de bloc déclare ici ses champs, une fois pour toutes. Tout le reste
   en découle :
     · la fenêtre de réglage d'un bloc est construite depuis ses champs ;
     · le résumé affiché sur la carte du plan aussi ;
     · la description du format que reçoit l'agent de Promptr, quand il doit
       convertir un prompt en plan, est générée depuis ces mêmes champs —
       l'interface et l'agent parlent donc toujours du même plan ;
     · un plan venu d'ailleurs (fichier, réponse de l'agent) est ramené à ces
       champs par normalizePlan : ce qui n'y entre pas est écarté.

   Kinds de champ :
     text      une ligne            textarea  un paragraphe
     list      une liste de lignes  pairs     une liste de paires (deux champs)
     select    un choix             scale     un curseur de -2 à +2
   ========================================================================== */
(() => {

const BLOCK_TYPES = {
  role: {
    label: "Rôle et mission",
    hint: "Qui est l'agent, ce qu'il fait, et pour qui.",
    color: "#8b5cf6",
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"/>',
    fields: [
      { key: "role", label: "Rôle", kind: "text", placeholder: "Conseiller culinaire, juriste d'entreprise…" },
      { key: "mission", label: "Mission", kind: "textarea", placeholder: "Ce que l'agent doit accomplir, et pourquoi." },
      { key: "audience", label: "Pour qui", kind: "text", placeholder: "Débutants, équipe technique, clients…" },
    ],
  },
  personality: {
    label: "Personnalité",
    hint: "Le ton et le caractère de l'agent.",
    color: "#ec4899",
    icon: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>',
    fields: [
      {
        key: "tone",
        label: "Ton",
        kind: "select",
        options: ["", "chaleureux", "neutre et posé", "direct", "enjoué", "pédagogue", "solennel"],
      },
      { key: "formality", label: "Formalité", kind: "scale", ends: ["Familier", "Soutenu"] },
      { key: "concision", label: "Concision", kind: "scale", ends: ["Développé", "Concis"] },
      { key: "humor", label: "Humour", kind: "scale", ends: ["Sérieux", "Plein d'humour"] },
      { key: "assertiveness", label: "Assurance", kind: "scale", ends: ["Prudent", "Affirmé"] },
      { key: "notes", label: "Autres traits", kind: "textarea", placeholder: "Curieux, patient, franc sur les limites…" },
    ],
  },
  skills: {
    label: "Compétences",
    hint: "Ce que l'agent sait faire, et à quel niveau.",
    color: "#f59e0b",
    icon: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    fields: [
      {
        key: "level",
        label: "Niveau",
        kind: "select",
        options: ["", "généraliste", "confirmé", "expert", "référence du domaine"],
      },
      { key: "items", label: "Compétences", kind: "list", placeholder: "Une compétence par ligne" },
    ],
  },
  knowledge: {
    label: "Connaissances",
    hint: "Les domaines, le contexte et le vocabulaire qu'il doit connaître.",
    color: "#0ea5e9",
    icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
    fields: [
      { key: "domains", label: "Domaines", kind: "list", placeholder: "Un domaine par ligne" },
      { key: "context", label: "Contexte", kind: "textarea", placeholder: "Ce qu'il doit savoir de la situation, de l'entreprise, du projet…" },
      { key: "glossary", label: "Vocabulaire", kind: "pairs", pair: ["Terme", "Définition"] },
    ],
  },
  method: {
    label: "Méthode",
    hint: "Comment il travaille, étape par étape.",
    color: "#10b981",
    icon: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    fields: [
      { key: "steps", label: "Étapes", kind: "list", placeholder: "Une étape par ligne, dans l'ordre" },
      {
        key: "clarify",
        label: "Questions de clarification",
        kind: "select",
        options: ["", "jamais, il fait au mieux", "seulement si la demande est ambiguë", "toujours avant de commencer"],
      },
      { key: "uncertainty", label: "Face à l'incertitude", kind: "text", placeholder: "Le dire franchement, proposer des pistes…" },
      { key: "done", label: "Travail terminé quand…", kind: "text", placeholder: "Le critère qui dit que la réponse est complète" },
    ],
  },
  format: {
    label: "Format des réponses",
    hint: "La forme de ses réponses : langue, longueur, mise en page.",
    color: "#6366f1",
    icon: '<path d="M4 6h16M4 12h10M4 18h14"/>',
    fields: [
      { key: "language", label: "Langue", kind: "text", placeholder: "français" },
      { key: "address", label: "Adresse", kind: "select", options: ["", "tutoiement", "vouvoiement"] },
      { key: "length", label: "Longueur", kind: "select", options: ["", "brève", "moyenne", "détaillée", "adaptée à la question"] },
      {
        key: "structure",
        label: "Mise en forme",
        kind: "select",
        options: ["", "texte suivi", "listes à puces", "titres et sections", "tableaux si utile"],
      },
      { key: "notes", label: "Autres consignes", kind: "textarea", placeholder: "Commencer par la réponse, finir par une piste d'action…" },
    ],
  },
  scope: {
    label: "Périmètre et limites",
    hint: "Ce qu'il fait, ce qu'il ne fait pas, ses lignes rouges.",
    color: "#ef4444",
    icon: '<path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6z"/>',
    fields: [
      { key: "inScope", label: "Dans son périmètre", kind: "list", placeholder: "Un sujet par ligne" },
      { key: "outOfScope", label: "Hors périmètre", kind: "list", placeholder: "Un sujet par ligne" },
      { key: "redLines", label: "Lignes rouges", kind: "list", placeholder: "Ce qu'il refuse, quoi qu'on lui demande" },
      { key: "offTopic", label: "Face à une demande hors sujet", kind: "text", placeholder: "La décliner poliment et réorienter…" },
    ],
  },
  examples: {
    label: "Exemples",
    hint: "Des échanges types, qui montrent la réponse attendue.",
    color: "#14b8a6",
    icon: '<path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z"/>',
    fields: [{ key: "items", label: "Échanges", kind: "pairs", pair: ["Question", "Réponse attendue"], long: true }],
  },
  greeting: {
    label: "Accueil",
    hint: "Son premier message, et des idées de questions à lui poser.",
    color: "#84cc16",
    icon: '<path d="M7 11V7a2 2 0 114 0v4"/><path d="M11 10V5a2 2 0 114 0v6"/><path d="M15 10a2 2 0 114 0v3a8 8 0 01-8 8h-1a6 6 0 01-5-2.7L3 15a2 2 0 013-2.6l1 1.1"/>',
    fields: [
      { key: "message", label: "Message d'accueil", kind: "textarea", placeholder: "Bonjour ! Je peux t'aider à…" },
      { key: "starters", label: "Questions pour démarrer", kind: "list", placeholder: "Une question par ligne" },
    ],
  },
  custom: {
    label: "Bloc libre",
    hint: "Une section de votre choix, écrite librement.",
    color: "#64748b",
    icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    multiple: true,
    fields: [
      { key: "title", label: "Titre", kind: "text", placeholder: "Règles de sécurité, outils, ton de marque…" },
      { key: "content", label: "Contenu", kind: "textarea", placeholder: "Le texte de la section." },
    ],
  },
};

const BLOCK_ORDER = ["role", "personality", "skills", "knowledge", "method", "format", "scope", "examples", "greeting", "custom"];

let seq = 0;
function newId() {
  seq += 1;
  return `b${Date.now().toString(36)}${seq.toString(36)}`;
}

/* ---- Valeurs ------------------------------------------------------------- */

function cleanText(value, max = 4000) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
}

function cleanField(field, value) {
  switch (field.kind) {
    case "list":
      return (Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [])
        .map((v) => cleanText(v, 400))
        .filter(Boolean)
        .slice(0, 40);
    case "pairs":
      return (Array.isArray(value) ? value : [])
        .filter((p) => p && typeof p === "object")
        .map((p) => {
          const a = cleanText(p.a ?? p[0] ?? p.term ?? p.user ?? p.question ?? "", 2000);
          const b = cleanText(p.b ?? p[1] ?? p.definition ?? p.assistant ?? p.answer ?? "", 4000);
          return { a, b };
        })
        .filter((p) => p.a || p.b)
        .slice(0, 20);
    case "select": {
      const v = cleanText(value, 200);
      if (field.options.includes(v)) return v;
      // L'agent peut répondre avec une valeur approchante : on retient la
      // première option qui la contient, sinon rien.
      const lower = v.toLowerCase();
      return (lower && field.options.find((o) => o && (o.includes(lower) || lower.includes(o)))) || "";
    }
    case "scale": {
      const n = Math.round(Number(value));
      return Number.isFinite(n) ? Math.max(-2, Math.min(2, n)) : 0;
    }
    default:
      return cleanText(value, field.kind === "textarea" ? 6000 : 300);
  }
}

function emptyData(type) {
  const data = {};
  for (const field of BLOCK_TYPES[type].fields) data[field.key] = cleanField(field, undefined);
  return data;
}

function createBlock(type, data = {}) {
  const def = BLOCK_TYPES[type] ? type : "custom";
  const block = { id: newId(), type: def, data: emptyData(def) };
  for (const field of BLOCK_TYPES[def].fields) {
    if (data[field.key] !== undefined) block.data[field.key] = cleanField(field, data[field.key]);
  }
  return block;
}

function isBlockEmpty(block) {
  return BLOCK_TYPES[block.type].fields.every((f) => {
    const v = block.data[f.key];
    return Array.isArray(v) ? v.length === 0 : f.kind === "scale" ? v === 0 : !v;
  });
}

/* ---- Plan ---------------------------------------------------------------- */

function emptyPlan() {
  return {
    format: "promptr",
    version: 1,
    name: "",
    description: "",
    blocks: [],
    deploy: { model: "", effort: "", thinking: "" },
    prompt: null, // dernier prompt généré (ou retouché), texte Markdown
    promptFrom: null, // empreinte du plan qui l'a produit
    promptEdited: false, // retouché à la main depuis la génération
    updatedAt: null,
  };
}

/**
 * Ramène n'importe quel objet (fichier, stockage, réponse de l'agent) à un plan
 * valide : champs connus seulement, types corrigés, blocs inconnus convertis en
 * bloc libre. Une nature unique (tout sauf « custom ») n'apparaît qu'une fois :
 * les doublons sont fusionnés en blocs libres, rien n'est perdu.
 */
function normalizePlan(raw) {
  const plan = emptyPlan();
  if (!raw || typeof raw !== "object") return plan;
  plan.name = cleanText(raw.name, 60);
  plan.description = cleanText(raw.description, 100);
  if (raw.deploy && typeof raw.deploy === "object") {
    plan.deploy.model = cleanText(raw.deploy.model, 80);
    plan.deploy.effort = cleanText(raw.deploy.effort, 20);
    plan.deploy.thinking = cleanText(raw.deploy.thinking, 20);
  }
  if (typeof raw.prompt === "string") plan.prompt = raw.prompt;
  if (typeof raw.promptFrom === "string") plan.promptFrom = raw.promptFrom;
  plan.promptEdited = raw.promptEdited === true;
  plan.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : null;

  const seen = new Set();
  for (const b of Array.isArray(raw.blocks) ? raw.blocks : []) {
    if (!b || typeof b !== "object") continue;
    let type = typeof b.type === "string" && BLOCK_TYPES[b.type] ? b.type : "custom";
    let data = b.data && typeof b.data === "object" ? b.data : b;
    if (type === "custom" && !BLOCK_TYPES[b.type] && typeof b.type === "string") {
      // Nature inconnue : on la garde comme bloc libre, titre compris.
      const title = data.title ?? b.type.replace(/[-_]+/g, " ");
      data = { title: title.charAt(0).toUpperCase() + title.slice(1), content: data.content ?? JSON.stringify(data) };
    }
    if (type !== "custom" && seen.has(type)) {
      data = { title: BLOCK_TYPES[type].label, content: describeBlockData(type, data) };
      type = "custom";
    }
    seen.add(type);
    const block = createBlock(type, data);
    if (typeof b.id === "string" && /^[\w-]{1,40}$/.test(b.id)) block.id = b.id;
    plan.blocks.push(block);
  }
  return plan;
}

/* ---- Lecture humaine ------------------------------------------------------ */

function scaleWord(field, v) {
  if (!v) return "";
  const [low, high] = field.ends;
  const strong = Math.abs(v) === 2 ? "très " : "";
  return `${field.label} : ${strong}${(v < 0 ? low : high).toLowerCase()}`;
}

/** Le résumé d'un bloc, sur sa carte : quelques fragments, dans l'ordre. */
function blockSummary(block) {
  const def = BLOCK_TYPES[block.type];
  const parts = [];
  for (const field of def.fields) {
    // Le titre d'un bloc libre est déjà celui de sa carte.
    if (block.type === "custom" && field.key === "title") continue;
    const v = block.data[field.key];
    if (field.kind === "list" && v.length) parts.push(v.slice(0, 4).join(" · ") + (v.length > 4 ? ` · +${v.length - 4}` : ""));
    else if (field.kind === "pairs" && v.length) parts.push(`${v.length} ${field.pair[0].toLowerCase()}${v.length > 1 ? "s" : ""}`);
    else if (field.kind === "scale" && v) parts.push(scaleWord(field, v));
    else if (typeof v === "string" && v) parts.push(v);
  }
  return parts.join(" — ");
}

/** Le contenu d'un bloc en texte, pour le convertir en bloc libre. */
function describeBlockData(type, data) {
  const block = createBlock(type, data);
  const lines = [];
  for (const field of BLOCK_TYPES[type].fields) {
    const v = block.data[field.key];
    if (field.kind === "list" && v.length) lines.push(`${field.label} :\n${v.map((x) => `- ${x}`).join("\n")}`);
    else if (field.kind === "pairs" && v.length) lines.push(`${field.label} :\n${v.map((p) => `- ${p.a} → ${p.b}`).join("\n")}`);
    else if (field.kind === "scale" && v) lines.push(scaleWord(field, v));
    else if (typeof v === "string" && v) lines.push(`${field.label} : ${v}`);
  }
  return lines.join("\n");
}

/* ---- Pour l'agent --------------------------------------------------------- */

/**
 * Le format d'un plan, décrit pour l'agent de Promptr : il le reçoit dans la
 * tâche « analyser », pour rendre un plan que normalizePlan saura lire.
 */
function planFormatForAgent() {
  const lines = [
    "Un plan est un objet JSON :",
    '{ "name": texte (60 car. max), "description": texte (100 car. max), "blocks": [ { "type": …, "data": { … } } ] }',
    "",
    "Natures de bloc, chacune au plus une fois sauf « custom », dans l'ordre qui sert le mieux l'agent :",
  ];
  for (const type of BLOCK_ORDER) {
    const def = BLOCK_TYPES[type];
    const fields = def.fields.map((f) => {
      if (f.kind === "list") return `"${f.key}": [textes]  (${f.label})`;
      if (f.kind === "pairs") return `"${f.key}": [{ "a": ${f.pair[0].toLowerCase()}, "b": ${f.pair[1].toLowerCase()} }]`;
      if (f.kind === "scale") return `"${f.key}": entier de -2 (${f.ends[0].toLowerCase()}) à 2 (${f.ends[1].toLowerCase()}), 0 = neutre`;
      if (f.kind === "select") return `"${f.key}": une valeur parmi ${f.options.filter(Boolean).map((o) => `"${o}"`).join(", ")} ou ""`;
      return `"${f.key}": texte  (${f.label})`;
    });
    lines.push(`- "${type}" — ${def.label}${def.multiple ? " (plusieurs possibles)" : ""} : { ${fields.join(", ")} }`);
  }
  return lines.join("\n");
}

/** Le plan tel qu'on le confie à l'agent pour qu'il écrive le prompt : les
 *  blocs vides n'ont rien à lui dire. */
function planForAgent(plan) {
  return {
    name: plan.name,
    description: plan.description,
    blocks: plan.blocks
      .filter((b) => !isBlockEmpty(b))
      .map((b) => ({ type: b.type, label: BLOCK_TYPES[b.type].label, data: b.data })),
  };
}

/** Empreinte courte : le prompt généré correspond-il encore au plan ? */
function planFingerprint(plan) {
  const text = JSON.stringify(planForAgent(plan));
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

window.PromptrBlocks = Object.freeze({
  BLOCK_TYPES,
  BLOCK_ORDER,
  createBlock,
  emptyPlan,
  normalizePlan,
  blockSummary,
  isBlockEmpty,
  planFormatForAgent,
  planForAgent,
  planFingerprint,
  cleanField,
});
})();
