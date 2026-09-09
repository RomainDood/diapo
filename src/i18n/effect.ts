import { translateEffect as translateEffectRaw } from '@craft-ts/i18n-effect';
import type { StaticTranslationKey, TranslationParams } from '@craft-ts/i18n';
import { locales } from './runtime';

type AppLocales = typeof locales;

export const translateEffect = <Key extends StaticTranslationKey<AppLocales[number]>>(
  key: Key,
  ...params: keyof TranslationParams<AppLocales[number], Key & string> extends never
    ? [params?: TranslationParams<AppLocales[number], Key & string>]
    : [params: TranslationParams<AppLocales[number], Key & string>]
) => translateEffectRaw<AppLocales, Key>(key, ...params);
