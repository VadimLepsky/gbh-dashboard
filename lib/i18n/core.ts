import { createFormatter, type FormatMessages, type Formatter, type PluralForms } from '../format'
import type { Locale } from './config'

type Node = string | string[] | { [key: string]: Node }
export type MessageTree = { [key: string]: Node }
export type Vars = Record<string, string | number>

/** Groups of domain values and demo-data free text translated by their stored (Czech) value. */
export type TermGroup =
  | 'stage'
  | 'lostReason'
  | 'source'
  | 'product'
  | 'productShort'
  | 'role'
  | 'team'
  | 'institutionType'
  | 'activity'
  | 'tenderStatus'
  | 'renewalStatus'
  | 'nextStep'
  | 'tenderTitle'

export interface I18n {
  locale: Locale
  /** Message by dot path, `{name}` placeholders filled from `vars`. */
  t: (key: string, vars?: Vars) => string
  /** Plural message: picks one / few / many / other for `n`; `{count}` is the formatted number. */
  tn: (key: string, n: number, vars?: Vars) => string
  /** Domain value or demo-data text in this language; proper names and unknown values pass through. */
  term: (group: TermGroup, value: string) => string
  /** True when the key exists (for optional texts). */
  has: (key: string) => boolean
  f: Formatter
}

export function createI18n(locale: Locale, messages: MessageTree): I18n {
  const lookup = (key: string): Node | undefined => {
    let node: Node | undefined = messages
    for (const part of key.split('.')) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined
      node = (node as Record<string, Node>)[part]
    }
    return node
  }
  const fill = (text: string, vars?: Vars) =>
    text.replace(/\{(\w+)\}/g, (m, k: string) => (vars && k in vars ? String(vars[k]) : m))
  const missing = (key: string) => {
    if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing ${locale}:${key}`)
    return key
  }

  const f = createFormatter(
    locale,
    lookup('format') as unknown as FormatMessages,
    (lookup('units') ?? {}) as unknown as Record<string, PluralForms>,
  )
  const rules = new Intl.PluralRules(locale === 'cs' ? 'cs-CZ' : 'en-GB')

  return {
    locale,
    f,
    t(key, vars) {
      const v = lookup(key)
      return typeof v === 'string' ? fill(v, vars) : missing(key)
    },
    tn(key, n, vars) {
      const v = lookup(key) as PluralForms | undefined
      if (!v || typeof v !== 'object') return missing(key)
      const text = v[rules.select(Math.abs(n))] ?? v.other
      return fill(text, { count: f.formatNumber(n), ...vars })
    },
    term(group, value) {
      const v = lookup(`terms.${group}`) as Record<string, Node> | undefined
      const hit = v && typeof v === 'object' ? v[value] : undefined
      return typeof hit === 'string' ? hit : value
    },
    has(key) {
      return lookup(key) !== undefined
    },
  }
}
