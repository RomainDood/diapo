import { bootstrapCraft } from '@craft-ts/component';
import { appConfig } from './app/app.config';
import { startCraftTypecheckIndicator } from './dev-typecheck-indicator';
import './styles.css';
import 'virtual:craft-style.css';

startCraftTypecheckIndicator();
bootstrapCraft({ config: appConfig });
