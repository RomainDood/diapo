import { createI18nRuntime } from '@craft-ts/i18n';
import { enUS } from './locales/en-US';
import { frFR } from './locales/fr-FR';

export const locales = [enUS, frFR] as const;

export const i18n = createI18nRuntime<typeof locales>({
  locales,
  defaultLocale: 'en-US',
  strict: true,
});

export function setLocale(locale: typeof i18n.locale extends () => infer Id ? Id : never): void {
  i18n.setLocale(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = /^ar|he|fa|ur/.test(locale) ? 'rtl' : 'ltr';
  }
}

const requestedLocale = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('locale') : null;
if (requestedLocale && ['en-US', 'fr-FR'].includes(requestedLocale)) {
  setLocale(requestedLocale as Parameters<typeof setLocale>[0]);
}
