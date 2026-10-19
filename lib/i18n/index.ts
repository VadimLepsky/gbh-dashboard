import cs from '@/messages/cs.json'
import en from '@/messages/en.json'
import { DEFAULT_LOCALE, isLocale, type Locale } from './config'
import { createI18n, type I18n, type MessageTree } from './core'

export const MESSAGES: Record<Locale, MessageTree> = { cs: cs as MessageTree, en: en as MessageTree }

const instances = new Map<Locale, I18n>()

/** Translator + formatter for a language (server side and lib code). Stateless, cached per language. */
export function getI18n(locale: Locale = DEFAULT_LOCALE): I18n {
  let i18n = instances.get(locale)
  if (!i18n) {
    i18n = createI18n(locale, MESSAGES[locale])
    instances.set(locale, i18n)
  }
  return i18n
}

export function localeFrom(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export type { I18n, TermGroup } from './core'
export { DEFAULT_LOCALE, LOCALES, isLocale, localePath, stripLocale, type Locale } from './config'
