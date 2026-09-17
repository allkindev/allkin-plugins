// Service du plugin Bonjour : un serveur HTTP sans dépendance.
//
// Allkin lui transmet tout par l'environnement et relaie sa page sous
// /plugins/bonjour/web/ : les liens sont donc écrits en RELATIF.
import { createServer } from "node:http";

const settings = JSON.parse(process.env.ALLKIN_PLUGIN_SETTINGS ?? "{}");
const port = Number(process.env.PORT ?? settings.port ?? 9301);
const startedAt = new Date();

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const server = createServer((req, res) => {
  if (req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, startedAt, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bonjour</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem; color: #1f2328; background: #fafaf9; }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; background: #161618; } }
  code { font-size: .9em; }
</style>
<h1>${escape(settings.greeting ?? "Bonjour")}</h1>
<p>Service démarré le ${startedAt.toLocaleString("fr-FR")}.</p>
<ul>
  <li>Données : <code>${escape(process.env.ALLKIN_PLUGIN_DATA)}</code></li>
  <li>Préfixe dans Allkin : <code>${escape(req.headers["x-forwarded-prefix"] ?? "—")}</code></li>
  <li>Jeton : ${process.env.PLUGIN_TOKEN ? "renseigné" : "vide"}</li>
</ul>
<p><a href="api/status">api/status</a> (lien relatif : il reste sous le préfixe)</p>`);
});

server.listen(port, "127.0.0.1", () => console.log(`écoute sur 127.0.0.1:${port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
