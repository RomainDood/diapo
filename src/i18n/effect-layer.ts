import { provideI18nRuntime } from '@craft-ts/i18n-effect';
import { i18n } from './runtime';

export const i18nLayer = provideI18nRuntime(i18n);
