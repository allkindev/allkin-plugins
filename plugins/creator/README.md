# Creator

L'atelier de plugins d'Allkin. Tu décris ce que tu veux ; l'agent **Creator** écrit le plugin ou
le service ; l'**établi** le contrôle, l'installe dans ton Allkin et t'aide à le mettre au point.

## À quoi ça sert

- **Créer un plugin** : un programme qui tourne en continu, une page, un morceau de l'interface
  d'Allkin, un agent dédié — ou plusieurs à la fois.
- **Créer un service** : apprendre à Allkin comment joindre une API externe, pour que tes agents
  l'appellent avec ta clé.

Tout ce que Creator écrit respecte le **standard Allkin**, livré avec le plugin
(`standard/PLUGIN-STANDARD.md` et `standard/SERVICE-STANDARD.md`) et vérifié par le bouton
**Vérifier**.

## Mise en route

1. Installe Creator, puis accorde ses quatre droits sur sa page. L'agent Creator et ton dépôt
   local sont créés à ce moment-là.
2. Recharge la page, puis ouvre **Creator** depuis le menu Allkin (liste Plugins).
3. Clique **Nouveau**, choisis *Plugin* ou *Service*, donne un nom et décris le besoin.
4. La conversation avec l'agent s'ouvre à droite. Réponds à ses questions ; il écrit les fichiers.

## L'établi

**En haut** : le projet affiché (liste déroulante), **Nouveau**, et **Conversation** pour
rouvrir la discussion avec l'agent.

**L'état du projet** : sa version, s'il est installé dans ton Allkin, l'état de son service, et
le verdict du contrôle (conforme, erreurs, avertissements).

**Les actions** :

| Bouton | Effet |
|--------|-------|
| Vérifier | Contrôle le projet contre le standard |
| Installer / Réinstaller | Copie le plugin de ton dépôt dans Allkin. Bloqué tant qu'il reste une erreur |
| Page du plugin | Ouvre sa page Allkin : droits à accorder, réglages, journal |
| Démarrer / Redémarrer / Arrêter | Pilote le service du plugin |
| Recharger la page | Charge l'interface d'un plugin d'interface fraîchement installé |
| Ouvrir les Services | Pour un service : il est déjà dans le catalogue, il reste à le connecter |

**Demander à l'agent** : des boutons qui envoient une consigne sur le projet affiché — corriger
les problèmes du contrôle, compléter les traductions, écrire la documentation, relire le code,
expliquer le projet.

**Les trois volets** :

- **Contrôle** — la liste des écarts au standard. Rouge : Allkin refuserait le plugin, ou il
  casserait à l'usage. Orange : le standard le demande.
- **Fichiers** — les fichiers du projet ; un clic ouvre le fichier dans l'éditeur. Ceux que
  l'agent vient d'écrire sont mis en avant.
- **Debug** — le journal du service et les erreurs relevées dans la page depuis son chargement.
  **Envoyer à l'agent** lui transmet le tout pour qu'il trouve la cause.

## Où sont tes fichiers

Dans le dossier de travail de l'agent : `~/.allkin/plugin-data/creator/workspace/`, avec un
dossier `plugins/` et un dossier `services/`. Ce dossier est un **dépôt local** : il apparaît
dans la fenêtre *Dépôts* des pages Plugins et Services, et tes créations y sont listées avec
l'étiquette « Creator ».

Ce dossier **n'est pas supprimé** quand tu désinstalles Creator. Pour publier une création,
copie son dossier dans ton dépôt de plugins.

## Les droits demandés

| Droit | Pourquoi |
|-------|----------|
| Interface | Ajouter l'établi à la page d'Allkin ; avec ta session, créer les projets, installer tes plugins et piloter leur service |
| Agent dédié | L'agent Creator, qui écrit les fichiers. Il n'a aucun accès à la machine en dehors de son dossier de travail |
| Dépôt | Faire du dossier de travail une source de plugins et de services pour cet Allkin |
| Réseau | Laisser l'agent lire la documentation en ligne des API |

## Si ça ne marche pas

- **« Son agent n'existe pas encore »** : un droit n'est pas accordé. Ouvre la page du plugin.
- **Installer est grisé** : le contrôle a trouvé une erreur. Clique *Corriger les problèmes*.
- **Réinstaller n'apporte rien** : la version n'a pas changé. Le contrôle le signale ; demande à
  l'agent de l'augmenter.
- **L'interface du plugin n'apparaît pas** : accorde ses droits sur sa page, puis recharge.
- **L'agent ne répond pas** : vérifie ton fournisseur IA dans les Paramètres d'Allkin.
