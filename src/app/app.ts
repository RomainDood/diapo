import {
  a,
  CraftRouterOutlet,
  craftComponent,
  div,
  main,
  nav,

} from '@craft-ts/component';
import { CraftRouterLink } from '@craft-ts/core';
import { i18n } from '../i18n';
import { appTheme } from './ui/ui.style';

export const App = craftComponent(
  'App',
  {},
  () => ({}),
  () =>
    div({ class: appTheme.root }, [
      nav([
        a('dashboard', { 'aria-label': i18n.t('ui.nav.dashboard') }, i18n.t('ui.nav.dashboard')).pipe(CraftRouterLink({ to: 'feature' })),

      ]),
      main(CraftRouterOutlet()),
    ]),
);
