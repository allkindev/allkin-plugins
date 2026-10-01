# Promptr

Allkin's prompt workshop. An agent is **drawn** here: its role, its
personality, its skills, its method… each in a block, set in a window. Promptr
writes its prompt (the agent's CLAUDE.md) — or does the reverse: it opens an
existing prompt and sorts it into blocks.

## Two ways to start

- **Open an existing prompt.** Paste a prompt, choose a file
  (`.md`, `.txt`, a `.allkin` produced by Promptr, a `.json` plan) or an agent
  already installed: Promptr reads its role and draws it as a plan. The original
  agent is not changed.
- **Start from a blank plan.** Name the agent, then add your blocks one by one.

## The plan

A plan is a column of blocks, in the order the prompt will follow them:

| Block | What it sets |
|---|---|
| Role and mission | who the agent is, what it does, for whom |
| Personality | tone, formality, concision, humour, assurance |
| Skills | what it can do, at which level |
| Knowledge | fields, context, vocabulary |
| Method | steps, clarifying questions, uncertainty, end criterion |
| Format of the answers | language, informal or formal address, length, layout |
| Scope and limits | what it does, what it does not do, its red lines |
| Examples | typical exchanges |
| Welcome | its first message, questions to get started |
| Free block | a section of your choice (several allowed) |

A click on a block opens its settings window. The “+” between two blocks
inserts one at that place; the handle on the left of a card moves it (or the
arrows, on the right). In a block's window, **Complete with AI** fills it in
consistently with the rest of the plan — read it again before saving.

## AI both ways

Promptr has **its own agent**, “Promptr”, created by Allkin at installation
(see below). It does the work:

- **Plan → prompt**: *Generate the prompt* hands it the plan; it writes the
  CLAUDE.md from it, following good writing practice (instructions stated
  positively with their reason, no capitals for emphasis, tagged examples,
  nothing made up).
- **Prompt → plan**: opening a prompt, or *Redo the plan from this prompt*,
  hands it the text; it returns the plan that describes the same agent. What
  fits in no block becomes a free block: nothing is lost.

The **Prompt** pane always tells where things stand: *up to date with the
plan*, *edited by hand* (the source can be edited), or *the plan has changed
since* — an orange dot also shows it on the tab.

## Try, download, deploy

- **Try** opens a conversation with a test agent, “Promptr essai”, which
  receives the prompt as it is. It has **no rights at all**: you test the
  personality and the instructions, not the tools. Trick questions are
  suggested (off topic, ambiguity, injection, pressure on a red line).
- **.allkin** downloads the agent: `agent.json`, `CLAUDE.md`, and `promptr.json`
  (the plan, to open it again in Promptr).
- **Deploy** creates the agent in Allkin. By default it has no rights: tick
  only what it needs.

## Requested rights

- **Allkin interface** — the Promptr app is added to the Allkin page, and acts
  with your session: it creates the test agent and, when you ask for it, the
  final agent.
- **Dedicated agent** — Allkin creates the agent “Promptr”, with no rights on
  the machine nor on the other agents. Its role is supplied by the plugin
  (`agent.md`) and restored at every update; its model stays adjustable on its
  Agent page. It disappears with the plugin. Every generation or analysis
  uses your AI provider.

The current plan is kept in this browser.
