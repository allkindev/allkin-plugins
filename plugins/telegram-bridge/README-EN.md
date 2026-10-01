# Telegram bridge

Talk to your agents from Telegram. A bot listens continuously (long polling: nothing to open on
your router, no public address), relays every message to the agent of your choice and sends its
answer back in the chat. When the agent wants to run a command, it comes with two buttons:
**Approve** or **Refuse**.

## Getting started

1. In Telegram, write to **@BotFather**: `/newbot`, a name, a username. It gives you the bot's
   **token**.
2. Paste the token in the plugin's settings, then write your **Telegram id** in "Allowed users"
   (if you do not know it: write to the bot, it answers with your id when it is not in the list;
   or ask **@userinfobot**).
3. Pick the **default agent** (its id, the one in the URL of its page).
4. Grant the three rights, tick **Allow starting as a service**, save.

Write to the bot: `/start` explains the commands, everything else goes to the agent.

## In the chat

| Command       | Effect                                                       |
|---------------|--------------------------------------------------------------|
| `/agents`     | the list of agents, with the command to switch to each       |
| `/agent <id>` | this chat now talks to that agent (new conversation)         |
| `/new`        | starts a fresh conversation with the same agent              |
| `/who`        | the agent and the conversation of this chat                  |

Each Telegram chat keeps its conversation: it survives restarts of the plugin and of Allkin, and
shows in the agent's history in the interface. A photo or a file sent to the bot is dropped into
the agent's **Upload** folder, and the agent is told.

## Good to know

- **Only the listed ids** can talk to the bot; others get a refusal with their id, so you can add
  it.
- The **forms** an agent may ask for cannot be filled from Telegram: they are cancelled with a
  word of explanation.
- Approving commands from Telegram can be switched off in the settings: commands are then refused
  outright.
- The plugin only talks to `api.telegram.org`, unless you point it at a Bot API server of yours.

## Rights

| Right      | Why                                                                    |
|------------|------------------------------------------------------------------------|
| Network    | poll Telegram and send answers back, download files                    |
| Agents     | open a conversation with an agent through Allkin's socket              |
| Files      | drop received files into the agent's Upload folder                     |
