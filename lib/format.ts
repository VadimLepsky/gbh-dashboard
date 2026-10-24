import type { ISODate } from './data/types'
import type { Locale } from './i18n/config'

/** Locale-specific bits of formatting that live in the dictionaries (`messages/<lang>.json` → `format`, `units`). */
export interface FormatMessages {
  months: string[]
  monthsShort: string[]
  pointsUnit: string
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

export type ValueFormat = 'czk' | 'czk_compact' | 'percent' | 'int' | 'days' | 'date' | 'ratio' | 'text'

const INTL_LOCALE: Record<Locale, string> = { cs: 'cs-CZ', en: 'en-GB' }

/**
 * All number, money and date formatting. One instance per language:
 * cs → `1 087 400 Kč`, `14,5 %`, `19. 10. 2026`; en → `CZK 1,087,400`, `14.5%`, `19 Oct 2026`.
 * Get it through the i18n helpers (`getI18n(locale).f` on the server, `useI18n().f` in client components).
 */
export function createFormatter(locale: Locale, msg: FormatMessages, units: Record<string, PluralForms>) {
  const tag = INTL_LOCALE[locale]
  const en = locale === 'en'
  const integer = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 })
  const oneDecimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const percent1 = new Intl.NumberFormat(tag, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const percent0 = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 })
  const coefFmt = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  const millions = (v: number) => new Intl.NumberFormat(tag, { maximumFractionDigits: Math.abs(v) >= 10_000_000 ? 1 : 2 }).format(v / 1_000_000)
  const time = new Intl.DateTimeFormat(tag, { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false })
  const rules = new Intl.PluralRules(tag)
  const decimalZero = en ? /\.0$/ : /,0$/

  const pluralWord = (n: number, unit: string) => {
    const forms = units[unit]
    if (!forms) return unit
    return forms[rules.select(Math.abs(n))] ?? forms.other
  }

  const parts = (iso: ISODate) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) })

  const f = {
    locale,

    /** cs `1 087 400 Kč` · en `CZK 1,087,400` */
    formatCZK(value: number): string {
      if (en) return `${value < 0 ? '−' : ''}CZK ${integer.format(Math.round(Math.abs(value)))}`
      return `${integer.format(Math.round(value))} Kč`
    },

    /** cs `1,09 mil. Kč`, `540 tis. Kč` · en `CZK 1.09M`, `CZK 540K` — for tight spaces. */
    formatCZKCompact(value: number): string {
      const abs = Math.abs(value)
      if (en) {
        const sign = value < 0 ? '−' : ''
        if (abs >= 1_000_000) return `${sign}CZK ${millions(abs)}M`
        if (abs >= 10_000) return `${sign}CZK ${integer.format(Math.round(abs / 1000))}K`
        return f.formatCZK(value)
      }
      if (abs >= 1_000_000) return `${millions(value)} mil. Kč`
      if (abs >= 10_000) return `${integer.format(Math.round(value / 1000))} tis. Kč`
      return f.formatCZK(value)
    },

    /** Axis ticks without currency: cs `1,5 mil.`, `400 tis.` · en `1.5M`, `400K` */
    formatAxisCZK(value: number): string {
      const abs = Math.abs(value)
      if (abs >= 1_000_000) {
        const n = oneDecimal.format(value / 1_000_000).replace(decimalZero, '')
        return en ? `${n}M` : `${n} mil.`
      }
      if (abs >= 1000) {
        const n = integer.format(Math.round(value / 1000))
        return en ? `${n}K` : `${n} tis.`
      }
      return integer.format(value)
    },

    formatNumber(value: number): string {
      return integer.format(Math.round(value))
    },

    formatDecimal(value: number): string {
      return oneDecimal.format(value)
    },

    /** Ratio → cs `14,5 %` · en `14.5%` */
    formatPercent(ratio: number, digits: 0 | 1 = 1): string {
      if (!Number.isFinite(ratio)) return '—'
      return (digits === 0 ? percent0 : percent1).format(ratio)
    },

    /** Signed percent change: `+12,4 %` / `−3,1 %` */
    formatSignedPercent(ratio: number): string {
      if (!Number.isFinite(ratio)) return '—'
      const s = percent1.format(Math.abs(ratio))
      return `${ratio > 0 ? '+' : ratio < 0 ? '−' : ''}${s}`
    },

    /** Delta text for KPI cards: relative %, percentage points or absolute (days). */
    formatDelta(delta: number, kind: 'relative' | 'points' | 'absolute', unit?: string): string {
      if (kind === 'relative') return f.formatSignedPercent(delta)
      const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
      if (kind === 'points') return `${sign}${oneDecimal.format(Math.abs(delta) * 100)} ${msg.pointsUnit}`
      const abs = Math.abs(delta)
      const n = Number.isInteger(abs) ? integer.format(abs) : oneDecimal.format(abs)
      return `${sign}${n}${unit ? ` ${pluralWord(abs, unit)}` : ''}`
    },

    /** cs `19. 10. 2026` · en `19 Oct 2026` */
    formatDate(iso: ISODate | null | undefined): string {
      if (!iso) return '—'
      const { y, m, d } = parts(iso)
      return en ? `${d} ${msg.monthsShort[m - 1]} ${y}` : `${d}. ${m}. ${y}`
    },

    /** cs `19. 10.` · en `19 Oct` */
    formatDateShort(iso: ISODate | null | undefined): string {
      if (!iso) return '—'
      const { m, d } = parts(iso)
      return en ? `${d} ${msg.monthsShort[m - 1]}` : `${d}. ${m}.`
    },

    /** cs `říjen 2026` · en `October 2026` */
    formatMonth(ym: string): string {
      return `${msg.months[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
    },

    formatMonthName(ym: string): string {
      return msg.months[Number(ym.slice(5, 7)) - 1]
    },

    /** cs `říj` / `říj 25` · en `Oct` / `Oct 25` */
    formatMonthShort(ym: string, withYear = false): string {
      const s = msg.monthsShort[Number(ym.slice(5, 7)) - 1]
      return withYear ? `${s} ${ym.slice(2, 4)}` : s
    },

    /** Plural word for a unit from the dictionary (`units.days` …). */
    pluralWord,

    /** cs `12 dní` · en `12 days` */
    formatDays(n: number | null): string {
      if (n === null || !Number.isFinite(n)) return '—'
      const r = Math.round(n)
      return `${integer.format(r)} ${pluralWord(r, 'days')}`
    },

    /** `3 dealy` · `3 deals` — unit forms come from the dictionary. */
    formatCount(n: number, unit: string): string {
      return `${integer.format(n)} ${pluralWord(n, unit)}`
    },

    /** `21:04` in Prague. */
    formatTime(date: Date): string {
      return time.format(date)
    },

    formatRatio(value: number): string {
      if (!Number.isFinite(value)) return '—'
      return `${oneDecimal.format(value)}×`
    },

    /** KPI coefficient: cs `1,15` · en `1.15` */
    formatCoef(value: number): string {
      return coefFmt.format(value)
    },

    formatValue(value: number | string | null | undefined, format: ValueFormat): string {
      if (value === null || value === undefined || value === '') return '—'
      if (typeof value === 'string') return format === 'date' ? f.formatDate(value) : value
      switch (format) {
        case 'czk':
          return f.formatCZK(value)
        case 'czk_compact':
          return f.formatCZKCompact(value)
        case 'percent':
          return f.formatPercent(value)
        case 'int':
          return f.formatNumber(value)
        case 'days':
          return f.formatDays(value)
        case 'ratio':
          return f.formatRatio(value)
        default:
          return String(value)
      }
    },
  }
  return f
}

export type Formatter = ReturnType<typeof createFormatter>
