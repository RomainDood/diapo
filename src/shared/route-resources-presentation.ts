import {
  PRESENTATION_DECORATION_DEFAULT_COLOR,
  PRESENTATION_THEME_GRADIENTS,
  type PresentationStoreInput,
} from './presentation';

const localDemo = (path: string): string => `http://localhost:4200${path}`;

export const ROUTE_RESOURCES_PRESENTATION: PresentationStoreInput = {
  layout: 'vertical',
  demoWorkspaceId: 'angular-route-resources',
  backgroundType: 'theme',
  backgroundTheme: 'ocean',
  backgroundUrl: '',
  backgroundGradientStart: PRESENTATION_THEME_GRADIENTS.ocean.start,
  backgroundGradientMiddle: PRESENTATION_THEME_GRADIENTS.ocean.middle,
  backgroundGradientEnd: PRESENTATION_THEME_GRADIENTS.ocean.end,
  backgroundGradientAngle: PRESENTATION_THEME_GRADIENTS.ocean.angle,
  backgroundDecoration: 'grid',
  backgroundDecorationColor: PRESENTATION_DECORATION_DEFAULT_COLOR,
  title: 'Les ressources suivent les routes',
  audience: 'Développeurs Angular et équipes plateforme',
  objective: 'Montrer comment une route peut déclarer, charger et transmettre les données dont sa vue a besoin.',
  coverImageUrl: '',
  coverImageAlt: '',
  sections: [
    {
      id: 'route-resources-promise',
      title: 'Le changement de modèle',
      intention: 'Expliquer',
      sequences: [
        {
          id: 'route-resources-hook',
          title: 'La route ne décrit plus seulement une URL',
          message: 'Elle décrit aussi les données nécessaires à la vue. La navigation et le chargement deviennent un même récit.',
          notes: `Commencer par le problème : la vue sait souvent trop de choses sur la façon de charger ses données.\n\nLa démo complète est disponible ici : ${localDemo('/')}`,
          durationMinutes: 2,
          transition: 'Fondu',
          code: '',
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
    {
      id: 'route-resources-blocking',
      title: 'Une ressource bloquante',
      intention: 'Démontrer',
      sequences: [
        {
          id: 'route-resources-blocking-route',
          title: 'La navigation attend la donnée',
          message: 'Quand la donnée est indispensable, la route peut attendre avant d’activer la vue.',
          notes: `Ouvrir la démo et cliquer sur Produit 2 pour changer le paramètre de route.\n\nDémo : ${localDemo('/blocking/1')}`,
          durationMinutes: 3,
          transition: 'Glissement',
          code: `{
  path: 'blocking/:id',
  component: BlockingDemo,
  resources: (ctx) => ({
    item: resource({
      params: () => ctx.params()['id'],
      loader: ({ params, abortSignal }) =>
        loadItem(params, abortSignal),
    }),
  }),
}`,
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
        {
          id: 'route-resources-input',
          title: 'La ressource arrive comme input',
          message: 'Le composant reçoit directement la donnée prête à afficher. Il ne connaît ni la route ni le loader.',
          notes: `Insister sur la séparation : la route orchestre, le composant présente.\n\nLe code source est accessible avec le bouton Code des notes.`,
          durationMinutes: 2,
          transition: 'Fondu',
          code: `export class BlockingDemo {
  readonly item = input.required<DemoItem>();
}`,
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
    {
      id: 'route-resources-reactivity',
      title: 'Rendre le chargement visible',
      intention: 'Démontrer',
      sequences: [
        {
          id: 'route-resources-non-blocking',
          title: 'La vue peut s’afficher avant la réponse',
          message: 'Avec une ressource non bloquante, loading, value et error deviennent des états explicites de l’interface.',
          notes: `Ouvrir la démo non bloquante, puis choisir « Simuler une erreur ».\n\nDémo : ${localDemo('/non-blocking')}`,
          durationMinutes: 3,
          transition: 'Zoom',
          code: `resources: (ctx) => ({
  report: nonBlocking(
    resource({
      params: () => ctx.queryParams()['filter'] ?? 'all',
      loader: ({ params, abortSignal }) =>
        loadReport(params, abortSignal),
    }),
  ),
}),`,
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
        {
          id: 'route-resources-reload',
          title: 'Rafraîchir sans renaviguer',
          message: 'Un reload ciblé relance la ressource utile sans refaire matcher la route ni reconstruire toute la page.',
          notes: `Cliquer plusieurs fois sur le bouton de la démo et observer le numéro de requête.\n\nDémo : ${localDemo('/reload')}`,
          durationMinutes: 2,
          transition: 'Fondu',
          code: `const resources = route.resources;
const metrics = resources?.['metrics'];
metrics?.reload();`,
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
    {
      id: 'route-resources-concurrency',
      title: 'Composer les chargements',
      intention: 'Comparer',
      sequences: [
        {
          id: 'route-resources-parallel',
          title: 'Le temps du plus lent, pas la somme',
          message: 'Deux ressources d’une même route démarrent ensemble : le temps d’attente suit le maximum des deux.',
          notes: `Ouvrir la démo parallèle. Le résumé finit vers 700 ms, l’activité vers 1400 ms, mais elles partent ensemble.\n\nDémo : ${localDemo('/parallel')}`,
          durationMinutes: 3,
          transition: 'Glissement',
          code: `resources: () => ({
  summary: resource({ loader: loadSummary }),
  activity: resource({ loader: loadActivity }),
}),`,
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
        {
          id: 'route-resources-redirect',
          title: 'Une absence devient une navigation',
          message: 'Une ressource peut aussi rediriger quand l’élément demandé n’existe pas.',
          notes: `Tester Produit absent dans la démo bloquante.\n\nDémo : ${localDemo('/blocking/404')}`,
          durationMinutes: 2,
          transition: 'Coupure',
          code: `if (!item) {
  throw new RedirectCommand(
    router.parseUrl('/not-found'),
  );
}`,
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
    {
      id: 'route-resources-takeaway',
      title: 'La règle à retenir',
      intention: 'Conclusion',
      sequences: [
        {
          id: 'route-resources-takeaway-slide',
          title: 'Une route devient une frontière de données',
          message: 'Déclarer les données au même endroit que la navigation rend le chargement composable, observable et démontrable.',
          notes: `Terminer avec la formule : « la route décrit ce qu’il faut pour pouvoir entrer dans la vue ».\n\nRevenir à l’overview avec Échap, ou ouvrir le code avec Ctrl/Cmd + P.`,
          durationMinutes: 2,
          transition: 'Fondu',
          code: '',
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
  ],
};
