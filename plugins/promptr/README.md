# Promptr

L'atelier de prompts d'Allkin. Un agent s'y **dessine** : son rôle, sa
personnalité, ses compétences, sa méthode… chacun dans un bloc, réglé dans une
fenêtre. Promptr en écrit le prompt (le CLAUDE.md de l'agent) — ou fait
l'inverse : il ouvre un prompt existant et le range en blocs.

## Deux façons de commencer

- **Ouvrir un prompt existant.** Collez un prompt, choisissez un fichier
  (`.md`, `.txt`, un `.allkin` produit par Promptr, un plan `.json`) ou un agent
  déjà installé : Promptr lit son rôle et le dessine en plan. L'agent d'origine
  n'est pas modifié.
- **Partir d'un plan vierge.** Nommez l'agent, puis ajoutez vos blocs un à un.

## Le plan

Un plan est une colonne de blocs, dans l'ordre où le prompt les reprendra :

| Bloc | Ce qu'il règle |
|---|---|
| Rôle et mission | qui est l'agent, ce qu'il fait, pour qui |
| Personnalité | ton, formalité, concision, humour, assurance |
| Compétences | ce qu'il sait faire, à quel niveau |
| Connaissances | domaines, contexte, vocabulaire |
| Méthode | étapes, questions de clarification, incertitude, critère de fin |
| Format des réponses | langue, tutoiement ou vouvoiement, longueur, mise en forme |
| Périmètre et limites | ce qu'il fait, ce qu'il ne fait pas, ses lignes rouges |
| Exemples | des échanges types |
| Accueil | son premier message, des questions pour démarrer |
| Bloc libre | une section de votre choix (plusieurs possibles) |

Un clic sur un bloc ouvre sa fenêtre de réglage. Le « + » entre deux blocs en
insère un à cet endroit ; la poignée à gauche d'une carte la déplace (ou les
flèches, à droite). Dans la fenêtre d'un bloc, **Compléter avec l'IA** le remplit
en cohérence avec le reste du plan — relisez avant d'enregistrer.

## L'IA dans les deux sens

Promptr a **son propre agent**, « Promptr », créé par Allkin à l'installation
(voir plus bas). C'est lui qui fait le travail :

- **Plan → prompt** : *Générer le prompt* lui confie le plan ; il en écrit le
  CLAUDE.md, en suivant les bonnes pratiques d'écriture (consignes à
  l'affirmatif avec leur raison, pas de majuscules d'insistance, exemples
  balisés, rien d'inventé).
- **Prompt → plan** : ouvrir un prompt, ou *Refaire le plan depuis ce prompt*,
  lui confie le texte ; il rend le plan qui décrit le même agent. Ce qui n'entre
  dans aucun bloc devient un bloc libre : rien ne se perd.

Le volet **Prompt** dit toujours où l'on en est : *à jour avec le plan*,
*retouché à la main* (on peut éditer la source), ou *le plan a changé depuis* —
une pastille orange le signale aussi sur l'onglet.

## Essayer, télécharger, déployer

- **Essayer** ouvre une conversation avec un agent de test, « Promptr essai »,
  qui reçoit le prompt tel quel. Il n'a **aucun droit** : on éprouve la
  personnalité et les consignes, pas les outils. Des questions pièges sont
  proposées (hors sujet, ambiguïté, injection, pression sur une ligne rouge).
- **.allkin** télécharge l'agent : `agent.json`, `CLAUDE.md`, et `promptr.json`
  (le plan, pour le rouvrir dans Promptr).
- **Déployer** crée l'agent dans Allkin. Par défaut il n'a aucun droit : on coche
  seulement ce dont il a besoin.

## Droits demandés

- **Interface d'Allkin** — l'app Promptr s'ajoute à la page d'Allkin, et agit
  avec votre session : elle crée l'agent d'essai et, quand vous le demandez,
  l'agent final.
- **Agent dédié** — Allkin crée l'agent « Promptr », sans aucun droit sur la
  machine ni sur les autres agents. Son rôle est fourni par le plugin
  (`agent.md`) et rétabli à chaque mise à jour ; son modèle reste réglable sur
  sa page Agent. Il disparaît avec le plugin. Chaque génération ou analyse
  consomme votre fournisseur IA.

Le plan en cours est gardé dans ce navigateur.
