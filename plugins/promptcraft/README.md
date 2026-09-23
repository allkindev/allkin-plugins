# PromptCraft

L'atelier de fabrication d'agents sur mesure. On règle l'agent comme on règle une console :
personnalité, compétences, méthode de travail, format, périmètre. Le prompt s'écrit en direct et
reçoit une note. On l'éprouve en conversation, puis on le télécharge ou on le déploie.

On l'ouvre depuis l'**accueil** (bouton *PromptCraft*) ou depuis le panneau **Applications** de la
barre latérale.

## Les trois volets

### Paramètres

Dix sections, avec un sommaire à gauche.

| Section | Ce qu'on y règle |
|---|---|
| 🪪 Identité | Nom, description, rôle, mission, public et son niveau. Douze archétypes pour démarrer. |
| 🎭 Personnalité | 14 curseurs à 5 crans : les cinq grands traits (ouverture, rigueur, énergie, coopération, stabilité), la relation (chaleur, registre, humour, enthousiasme, franchise, directivité) et la façon de travailler (pédagogie, curiosité, audace). |
| 🧠 Compétences | 29 compétences en 5 familles, chacune de *Non* à *Référence*. |
| 📚 Savoir & contexte | Domaines, contexte propre à ta situation, glossaire, sources de référence. |
| 🧭 Méthode | Raisonnement, questions de clarification, autonomie, conduite face à l'incertitude, relecture, citations, proactivité, critère de fin de tâche. |
| 🧾 Format | Langue, tutoiement, longueur, structure, émojis, markdown, réponse d'abord, gabarit. |
| 🛡️ Périmètre | Sujets couverts et exclus, conduite hors-sujet, lignes rouges, relais humain, données personnelles, résistance aux injections. |
| 💬 Exemples | Un à cinq échanges modèles. |
| 👋 Accueil | Message d'accueil et amorces de conversation. |
| 🚀 Déploiement | Modèle, effort, réflexion étendue et droits de l'agent dans Allkin. |

Survoler un curseur montre la phrase exacte qu'il écrit dans le prompt. Un double-clic le remet au
neutre.

### Prompt

Le `CLAUDE.md` généré. On peut le voir en source ou en aperçu, le copier ou le retoucher à la main.
Retouché, il ne suit plus les réglages, et un bouton le remet en phase. Le champ *Affiner avec l'IA*
demande au modèle une retouche ciblée. On relit le résultat, et on peut l'annuler.

À côté, la **jauge de qualité** : une note sur 100 et une liste de critères vérifiables. Un clic sur
un point à revoir mène au réglage concerné.

### Conversation test

On converse avec l'agent tel qu'il tournera, dans Allkin, avec les règles d'Allkin. Des questions
prêtes à l'emploi l'éprouvent :

- tes amorces et ton premier exemple ;
- les pièges classiques : hors-sujet, demande ambiguë, chiffre exigé sans nuance, pression sur une
  ligne rouge, injection (« ignore tes instructions »), désaccord.

*Nouvelle conversation* relit le prompt actuel. Un bandeau prévient quand le prompt a changé depuis
le début de l'échange.

## Ce que PromptCraft applique

Les règles d'écriture viennent des guides de prompting publiés par Anthropic, OpenAI et Google, et
de travaux de recherche sur les personas :

- **Des sections claires.** Titres markdown, et le contexte et les exemples entre balises. L'agent
  distingue ainsi les données des consignes.
- **Le pourquoi de chaque consigne.** Le modèle généralise à partir de la raison, pas de l'ordre.
- **Des consignes positives.** On dit ce qu'il faut faire plutôt que ce qu'il faut éviter.
- **Pas de majuscules d'insistance.** Les modèles actuels sur-réagissent quand on crie.
- **Un curseur neutre n'écrit rien.** Chaque ligne inutile affaiblit les autres.
- **De la méthode, pas de superlatifs.** « Tu es le meilleur expert » ne rend pas un modèle plus
  exact. Chaque compétence apporte donc une façon de travailler.
- **Des exemples.** C'est la consigne la plus suivie : un à cinq échanges variés, au même format.
- **Les points que les prompts oublient souvent.** Incertitude, autonomie, critère de fin,
  périmètre, lignes rouges avec leur raison, injections.
- **Un prompt court.** Au-delà de 200 lignes, le respect des consignes baisse.

La jauge vérifie aussi que les **réglages ne se contredisent pas**, par exemple « réponses
télégraphiques » avec « pédagogue patient ». Elle vérifie aussi que les compétences ont leurs
**outils** : *Recherche documentaire* sans le droit web n'est qu'une promesse.

Sources : [Claude — bonnes pratiques de prompting](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices),
[Anthropic — context engineering pour les agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents),
[Anthropic — réduire les hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations),
[OpenAI — guide de prompting GPT-5](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide),
[Google — stratégies de prompting](https://ai.google.dev/gemini-api/docs/prompting-strategies),
[Microsoft Copilot Studio — instructions](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-instructions),
[Personas d'expert et exactitude (arXiv 2512.05858)](https://arxiv.org/abs/2512.05858).

## Télécharger ou déployer

- **.allkin** télécharge l'agent. C'est une archive zip au format d'un agent exporté par Allkin :
  `agent.json` et `CLAUDE.md`, plus `promptcraft.json` (les réglages) et `LISEZMOI.txt`. Sur
  n'importe quelle instance, *Accueil → Importer* la lit telle quelle.
- **Déployer** crée l'agent dans cette instance, par ce même import. Les droits demandés sont
  affichés avant la création. Aucun agent existant n'est remplacé.
- **Ouvrir** rouvre un `.allkin` produit par PromptCraft, ou un projet `.json`, avec tous ses
  réglages. Les exports d'agent d'Allkin sont compressés : PromptCraft ne les lit pas, ils
  s'importent depuis l'accueil.

Le projet en cours est enregistré au fil de la frappe dans ce navigateur.

## Le banc d'essai

La conversation test tourne sur un vrai agent Allkin, **PromptCraft essai**. Il est créé au
premier test et réutilisé ensuite. Il n'a **aucun droit** : ni machine, ni web, ni planification, ni
délégation. Il éprouve le prompt, pas les outils. Chaque test réécrit son `CLAUDE.md`, et ses
anciennes conversations partent dans son historique. La corbeille, dans le volet test, le supprime ;
il est recréé au test suivant.

Chaque échange consomme des jetons comme n'importe quelle conversation. Le coût s'affiche après
chaque réponse.

## Droit demandé

- **Interface d'Allkin** — le plugin s'exécute dans la page d'Allkin, avec ta session. Il appelle
  seulement les routes de l'interface : créer l'agent d'essai et y converser, affiner un prompt,
  importer l'agent final quand tu cliques sur *Déployer*.
