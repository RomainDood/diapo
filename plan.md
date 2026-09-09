# Application de préparation et de présentation orale

## 1. Vision

Créer une application qui aide à préparer, structurer, mettre en forme et présenter des présentations orales.

L’application sépare clairement :

- ce que l’orateur veut savoir ;
- ce que le public doit voir ;
- ce qui doit apparaître à chaque moment du discours.

Elle transforme un plan, des notes et des ressources en une présentation visuelle claire, animée et cohérente avec le discours.

## 2. Objectifs

- Construire rapidement une présentation à partir d’un plan simple.
- Préparer le contenu oral et les notes associées.
- Afficher un support visuel lisible et élégant.
- Organiser automatiquement les apparitions et les animations.
- Utiliser du texte, du code, des images, des liens et des schémas.
- Faciliter la répétition et la présentation en direct.

## 3. Utilisateurs cibles

- Développeurs et ingénieurs.
- Chercheurs et enseignants.
- Formateurs.
- Conférenciers.
- Équipes produit ou projet.
- Toute personne qui doit expliquer un sujet à l’oral avec un support visuel.

## 4. Modèle de contenu

Une présentation est organisée selon cette hiérarchie :

```text
Présentation
└── Sections ou chapitres
    └── Séquences
        ├── Éléments visibles
        ├── Notes de l’orateur
        ├── Ressources
        └── Animations
```

### Présentation

Une présentation contient :

- un titre ;
- un sujet ;
- un objectif ;
- un public cible ;
- une durée estimée ;
- un style visuel ;
- une liste de sections.

### Section

Une section correspond à une partie importante du raisonnement.

Elle peut contenir :

- une intention : expliquer, convaincre, démontrer, comparer ou raconter ;
- un message principal ;
- plusieurs séquences ;
- une transition vers la section suivante.

### Séquence

Une séquence correspond à un moment précis du discours.

Elle contient :

- un titre ou une idée principale ;
- les éléments affichés au public ;
- les notes de l’orateur ;
- les étapes d’animation ;
- une durée prévue ;
- une indication de transition.

## 5. Création à partir d’un plan

L’utilisateur peut commencer par écrire un plan sous forme de texte structuré.

Exemple :

```md
# Comprendre les architectures distribuées

## Le problème
- Pourquoi une application devient difficile à maintenir
- Exemple concret

## La solution
- Découpage en services
- Communication entre composants
- Schéma explicatif

## Les compromis
- Complexité
- Coût
- Observabilité
```

À partir de ce plan, l’application propose :

- une structure en sections ;
- des séquences ;
- une hiérarchie des informations ;
- des mises en page adaptées ;
- des animations possibles ;
- des emplacements pour les notes ;
- des suggestions d’illustrations.

L’utilisateur peut accepter, modifier, déplacer ou supprimer chaque proposition.

## 6. Espace de préparation

L’espace de préparation doit permettre de :

- rédiger le plan ;
- écrire le contenu de chaque séquence ;
- prendre des notes libres ;
- conserver plusieurs idées alternatives ;
- préparer l’introduction et la conclusion ;
- écrire les transitions orales ;
- ajouter des exemples et des anecdotes ;
- insérer des morceaux de code ;
- ajouter des images ;
- ajouter des liens et des sources ;
- indiquer les points importants ;
- définir le temps prévu pour chaque partie.

Cet espace peut être dense et détaillé. Il est destiné à l’auteur et à l’orateur, pas au public.

## 7. Espace de présentation

L’espace de présentation affiche uniquement le contenu destiné au public.

Il doit proposer :

- un affichage plein écran ;
- une mise en page claire ;
- peu de texte visible ;
- une forte hiérarchie visuelle ;
- des apparitions progressives ;
- des transitions sobres ;
- des effets de mise en évidence ;
- un déroulé contrôlé par l’orateur.

Les notes, sources et détails privés ne doivent pas apparaître au public, sauf décision explicite de l’utilisateur.

## 8. Types de contenu visibles

### Texte

- Titre.
- Sous-titre.
- Paragraphe court.
- Liste.
- Citation.
- Définition.
- Question destinée au public.
- Phrase ou mot mis en évidence.
- Chiffre clé.
- Résumé.

### Code

Les blocs de code doivent permettre :

- une coloration syntaxique ;
- un affichage lisible ;
- la sélection des lignes importantes ;
- le masquage de lignes secondaires ;
- l’apparition progressive ;
- l’ajout de commentaires explicatifs ;
- l’affichage d’une version simplifiée ou complète.

Le code sert de support visuel et pédagogique. Il n’a pas besoin d’être exécuté.

### Images et médias

L’utilisateur peut :

- ajouter une image ;
- la recadrer ;
- ajouter une légende ;
- l’annoter ;
- l’utiliser comme arrière-plan ;
- la juxtaposer avec du texte ;
- lui associer une source ou un lien.

### Liens et références

Chaque élément peut être associé à :

- un lien externe ;
- une source ;
- une référence bibliographique ;
- une note privée ;
- une ressource à consulter plus tard.

### Schémas

L’application doit pouvoir représenter simplement :

- des étapes ;
- des flux ;
- des relations ;
- une architecture ;
- une comparaison ;
- une chronologie ;
- une hiérarchie.

## 9. Mise en forme automatique

À partir du contenu, l’application peut proposer :

- une composition visuelle ;
- une répartition du contenu sur plusieurs écrans ;
- une taille de texte adaptée ;
- une palette cohérente ;
- un style de présentation ;
- une hiérarchie entre les informations ;
- une animation adaptée au discours.

L’automatisation doit respecter le sens du contenu et ne pas se limiter à ajouter des effets décoratifs.

L’utilisateur doit pouvoir :

- modifier une proposition ;
- demander une autre variante ;
- verrouiller certains choix ;
- appliquer un style à toute la présentation ;
- revenir à une version précédente.

## 10. Orchestration et animations

Chaque séquence peut être organisée en plusieurs étapes :

1. Afficher le contexte.
2. Faire apparaître l’idée principale.
3. Mettre en évidence un détail.
4. Afficher un exemple ou une preuve.
5. Conclure et passer à la suite.

Les animations peuvent servir à :

- introduire une idée ;
- révéler progressivement une explication ;
- attirer l’attention sur un élément ;
- comparer deux informations ;
- faire évoluer un schéma ;
- zoomer sur un détail ;
- montrer une cause puis une conséquence ;
- conserver un élément pendant qu’un autre change.

Les animations doivent soutenir le discours et rester sobres.

## 11. Notes de l’orateur

Chaque séquence dispose d’un espace privé pouvant contenir :

- le texte à dire ;
- des formulations alternatives ;
- des exemples ;
- des anecdotes ;
- des questions à poser ;
- des rappels ;
- les transitions ;
- les sources ;
- le niveau d’importance ;
- le temps prévu ;
- les points à éviter.

## 12. Préparation et répétition

L’application doit aider l’utilisateur à :

- rédiger une introduction ;
- définir le message principal ;
- préparer une conclusion ;
- associer une intention à chaque séquence ;
- prévoir des questions au public ;
- répéter une section ;
- estimer la durée totale ;
- repérer les parties trop longues ;
- repérer les écrans trop denses.

## 13. Modes d’utilisation

### Mode édition

Pour écrire, organiser et modifier le contenu.

### Mode aperçu

Pour visualiser le rendu final sans lancer la présentation.

### Mode répétition

Avec :

- les notes ;
- le minutage ;
- la séquence suivante ;
- les indications d’animation ;
- les rappels personnels.

### Mode présentation

Pour afficher uniquement le contenu destiné au public.

### Mode présentation avec notes

Pour consulter les notes de l’orateur dans une vue séparée.

## 14. Contrôle de la qualité du contenu

L’application doit signaler lorsqu’un écran ou une section :

- contient trop de texte ;
- mélange plusieurs idées ;
- contient un code difficile à lire ;
- est trop longue ;
- manque d’une information importante ;
- utilise une animation excessive ;
- manque de rythme ;
- possède une transition faible.

Elle peut alors proposer de :

- diviser une séquence ;
- déplacer un détail dans les notes ;
- remplacer un paragraphe par un schéma ;
- résumer un contenu ;
- mettre une phrase en évidence ;
- déplacer une explication à la séquence suivante.

## 15. Principes éditoriaux

La présentation doit privilégier :

- une idée principale par séquence ;
- une progression logique ;
- peu de texte visible ;
- des exemples concrets ;
- une alternance entre explication et illustration ;
- des animations au service du discours ;
- une cohérence graphique ;
- une séparation nette entre contenu public et contenu privé.

## 16. Première version fonctionnelle

La première version doit couvrir :

- la création d’une présentation à partir d’un plan ;
- l’organisation en sections et séquences ;
- les notes de l’orateur ;
- les blocs de texte ;
- les blocs de code stylisés ;
- les images et les liens ;
- plusieurs mises en page ;
- les apparitions progressives ;
- le mode aperçu ;
- le mode présentation ;
- le minutage ;
- la génération automatique d’une première composition.

## 17. Fonctionnalités ultérieures

- Génération de schémas à partir du contenu.
- Aide à la rédaction du discours.
- Analyse du rythme et de la durée.
- Répétition enregistrée.
- Collaboration entre plusieurs auteurs.
- Import de présentations existantes.
- Export vers d’autres outils.
- Adaptation à plusieurs formats d’écran.
- Bibliothèque de styles et de modèles.

## 18. Questions à trancher

- Jusqu’où l’automatisation doit-elle aller ?
- L’utilisateur doit-il pouvoir tout modifier manuellement ?
- Les animations doivent-elles être générées à partir des notes, du plan ou des éléments visuels ?
- L’application doit-elle privilégier les présentations techniques ou rester généraliste ?
- Quel niveau de liberté graphique est souhaité ?
- Les images doivent-elles être recherchées depuis l’application ?
- Les sources doivent-elles être visibles dans la présentation finale ?
- L’outil doit-il produire un support linéaire ou permettre une navigation non linéaire ?
- Le public peut-il interagir avec la présentation ?

