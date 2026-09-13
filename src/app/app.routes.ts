/* eslint-disable require-yield -- route noop handlers intentionally return synchronously. */
import { loadCraftComponent } from '@craft-ts/component';
import {
  assertExhaustiveRouteExceptions,
  craftExceptionHandler,
  craftRoute,
  craftRoutes,
  type CanRun,
  type ComponentDepsOf,
  type RouteCheckedDI,
} from '@craft-ts/core';

export const { appRoutes } = craftRoutes('app', [
  { path: '', pathMatch: 'full', redirectTo: '/presenter/presentation-angular-route-resources' },
  craftRoute('feature', {
    ...loadCraftComponent(({ withRetry }) =>
      withRetry(import('./features/dashboard/dashboard-page')).then(
        (module: typeof import('./features/dashboard/dashboard-page')) => module.default,
      ),
    ),
  }, { HttpError: craftExceptionHandler(function* ({ noop }) { return noop(); }) }),
  craftRoute('editor/:presentationId', {
    ...loadCraftComponent(({ withRetry }) =>
      withRetry(import('./features/editor/editor-page')).then(
        (module: typeof import('./features/editor/editor-page')) => module.default,
      ),
    ),
  }, { HttpError: craftExceptionHandler(function* ({ noop }) { return noop(); }) }),
  craftRoute('present/:presentationId', {
    ...loadCraftComponent(({ withRetry }) =>
      withRetry(import('./features/presentation/presentation-stage')).then(
        (module: typeof import('./features/presentation/presentation-stage')) => module.PresentationPage,
      ),
    ),
  }, { HttpError: craftExceptionHandler(function* ({ noop }) { return noop(); }) }),
  craftRoute('presenter/:presentationId', {
    ...loadCraftComponent(({ withRetry }) =>
      withRetry(import('./features/presentation/presentation-stage')).then(
        (module: typeof import('./features/presentation/presentation-stage')) => module.PresenterPage,
      ),
    ),
  }, { HttpError: craftExceptionHandler(function* ({ noop }) { return noop(); }) }),
]);

assertExhaustiveRouteExceptions(appRoutes);

type _CheckDashboardPageDI = RouteCheckedDI<
  ComponentDepsOf<(typeof import('./features/dashboard/dashboard-page'))['default']>,
  never,
  never,
  'component: dashboard-page'
>;
type _CanRunDashboardPage = CanRun<_CheckDashboardPageDI>;

type _CheckEditorPageDI = RouteCheckedDI<
  ComponentDepsOf<(typeof import('./features/editor/editor-page'))['default']>,
  never,
  never,
  'component: editor-page',
  'presentationId'
>;
type _CanRunEditorPage = CanRun<_CheckEditorPageDI>;

type _CheckPresentationPageDI = RouteCheckedDI<
  ComponentDepsOf<(typeof import('./features/presentation/presentation-stage'))['PresentationPage']>,
  never,
  never,
  'component: presentation-page',
  'presentationId'
>;
type _CanRunPresentationPage = CanRun<_CheckPresentationPageDI>;

type _CheckPresenterPageDI = RouteCheckedDI<
  ComponentDepsOf<(typeof import('./features/presentation/presentation-stage'))['PresenterPage']>,
  never,
  never,
  'component: presenter-page',
  'presentationId'
>;
type _CanRunPresenterPage = CanRun<_CheckPresenterPageDI>;

declare module '@craft-ts/core' {
  interface CraftRouterRoutesRegistry {
    App: typeof appRoutes.META_PATHS;
  }
}
