# Les ressources suivent les routes

**Audience :** Développeurs Angular et équipes plateforme
**Objectif :** Montrer comment une route peut déclarer, charger et transmettre les données dont sa vue a besoin.

## Part 1 — Le changement de modèle

*Intention :* Expliquer

### Sequence 1 — La route ne décrit plus seulement une URL

Elle décrit aussi les données nécessaires à la vue. La navigation et le chargement deviennent un même récit.

**Duration :** 2 min
**Transition :** Fondu

#### Notes

> Commencer par le problème : la vue sait souvent trop de choses sur la façon de charger ses données.
>
> Démo locale : http://localhost:4200/

## Part 2 — Une ressource bloquante

*Intention :* Démontrer

### Sequence 1 — La navigation attend la donnée

Quand la donnée est indispensable, la route peut attendre avant d’activer la vue.

**Duration :** 3 min
**Transition :** Glissement

#### Notes

> Ouvrir la démo : http://localhost:4200/blocking/1

#### Code

```typescript
{
  path: 'blocking/:id',
  component: BlockingDemo,
  resources: (ctx) => ({
    item: resource({
      params: () => ctx.params()['id'],
      loader: ({ params, abortSignal }) =>
        loadItem(params, abortSignal),
    }),
  }),
}
```

### Sequence 2 — La ressource arrive comme input

Le composant reçoit directement la donnée prête à afficher. Il ne connaît ni la route ni le loader.

**Duration :** 2 min
**Transition :** Fondu

#### Notes

> Le bouton Code des notes ouvre l’espace de code et permet Ctrl/Cmd + P.

#### Code

```typescript
export class BlockingDemo {
  readonly item = input.required<DemoItem>();
}
```

## Part 3 — Rendre le chargement visible

*Intention :* Démontrer

### Sequence 1 — La vue peut s’afficher avant la réponse

Avec une ressource non bloquante, loading, value et error deviennent des états explicites de l’interface.

**Duration :** 3 min
**Transition :** Zoom

#### Notes

> Ouvrir http://localhost:4200/non-blocking puis choisir « Simuler une erreur ».

#### Code

```typescript
resources: (ctx) => ({
  report: nonBlocking(
    resource({
      params: () => ctx.queryParams()['filter'] ?? 'all',
      loader: ({ params, abortSignal }) =>
        loadReport(params, abortSignal),
    }),
  ),
}),
```

### Sequence 2 — Rafraîchir sans renaviguer

Un reload ciblé relance la ressource utile sans refaire matcher la route ni reconstruire toute la page.

**Duration :** 2 min
**Transition :** Fondu

#### Notes

> Cliquer sur le bouton de la démo : http://localhost:4200/reload

#### Code

```typescript
const resources = route.resources;
const metrics = resources?.['metrics'];
metrics?.reload();
```

## Part 4 — Composer les chargements

*Intention :* Comparer

### Sequence 1 — Le temps du plus lent, pas la somme

Deux ressources d’une même route démarrent ensemble : le temps d’attente suit le maximum des deux.

**Duration :** 3 min
**Transition :** Glissement

#### Notes

> Ouvrir http://localhost:4200/parallel et comparer les deux temps.

#### Code

```typescript
resources: () => ({
  summary: resource({ loader: loadSummary }),
  activity: resource({ loader: loadActivity }),
}),
```

### Sequence 2 — Une absence devient une navigation

Une ressource peut aussi rediriger quand l’élément demandé n’existe pas.

**Duration :** 2 min
**Transition :** Coupure

#### Notes

> Tester http://localhost:4200/blocking/404.

#### Code

```typescript
if (!item) {
  throw new RedirectCommand(
    router.parseUrl('/not-found'),
  );
}
```

## Part 5 — La règle à retenir

*Intention :* Conclusion

### Sequence 1 — Une route devient une frontière de données

Déclarer les données au même endroit que la navigation rend le chargement composable, observable et démontrable.

**Duration :** 2 min
**Transition :** Fondu

#### Notes

> Terminer avec la formule : « la route décrit ce qu’il faut pour pouvoir entrer dans la vue ».
>
> Échap revient à la présentation. Ctrl/Cmd + P ouvre rapidement un fichier.
