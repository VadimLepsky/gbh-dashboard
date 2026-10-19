export const LOCALES = ['cs', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Served at the existing URLs without a prefix. */
export const DEFAULT_LOCALE: Locale = 'cs'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** `/tym` → `/en/tym` for English, unchanged for the default language. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

/** Splits an optional locale prefix off a pathname. */
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const m = /^\/(cs|en)(?=\/|$)/.exec(pathname)
  if (!m) return { locale: null, path: pathname || '/' }
  return { locale: m[1] as Locale, path: pathname.slice(m[0].length) || '/' }
}
