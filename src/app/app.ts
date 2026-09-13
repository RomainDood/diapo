import {
  CraftRouterOutlet,
  craftComponent,
  div,
  main,
} from '@craft-ts/component';
import { appTheme } from './ui/ui.style';

export const App = craftComponent(
  'App',
  {},
  () => ({}),
  () =>
    div({ class: appTheme.root }, [
      main(CraftRouterOutlet()),
    ]),
);
