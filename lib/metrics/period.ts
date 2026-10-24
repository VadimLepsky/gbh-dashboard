import {
  addDays,
  addMonths,
  addMonthsToKey,
  diffDays,
  endOfMonth,
  minDate,
  monthRange,
} from '../data/dates'
import type { ISODate } from '../data/types'
import { getI18n, type I18n } from '../i18n'
import { TRAILING_MONTHS } from './constants'

export { TRAILING_MONTHS }

export interface DateRange {
  start: ISODate
  /** Inclusive. */
  end: ISODate
}

export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom'
export type CompareMode = 'prev' | 'plan' | 'yoy'

export interface Period extends DateRange {
  key: string
  kind: PeriodKind
  label: string
  /** Last day with data: min(end, today). Snapshot metrics are taken on this day. */
  asOf: ISODate
  /** The period contains today, i.e. it is still running. */
  isCurrent: boolean
}

export interface PeriodQuery {
  period?: string
  from?: string
  to?: string
  cmp?: string
  as?: string
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function build(kind: PeriodKind, key: string, start: ISODate, end: ISODate, label: string, today: ISODate): Period {
  return { kind, key, start, end, label, asOf: minDate(end, today), isCurrent: start <= today && today <= end }
}

export function monthPeriod(ym: string, today: ISODate, i18n: I18n = getI18n()): Period {
  return build('month', ym, `${ym}-01`, endOfMonth(`${ym}-01`), i18n.f.formatMonth(ym), today)
}

export function quarterPeriod(year: number, q: number, today: ISODate): Period {
  const startYm = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}`
  const endYm = addMonthsToKey(startYm, 2)
  return build('quarter', `${year}-Q${q}`, `${startYm}-01`, endOfMonth(`${endYm}-01`), `Q${q} ${year}`, today)
}

export function yearPeriod(year: number, today: ISODate, i18n: I18n = getI18n()): Period {
  return build('year', String(year), `${year}-01-01`, `${year}-12-31`, i18n.t('period.year', { year }), today)
}

export function parsePeriod(q: PeriodQuery, today: ISODate, i18n: I18n = getI18n()): Period {
  const raw = q.period ?? ''
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= today.slice(0, 7)) return monthPeriod(raw, today, i18n)
  const qm = /^(\d{4})-Q([1-4])$/.exec(raw)
  if (qm) return quarterPeriod(Number(qm[1]), Number(qm[2]), today)
  if (/^\d{4}$/.test(raw) && raw <= today.slice(0, 4)) return yearPeriod(Number(raw), today, i18n)
  if (raw === 'custom' && q.from && q.to && ISO_RE.test(q.from) && ISO_RE.test(q.to)) {
    const from = q.from <= q.to ? q.from : q.to
    const to = minDate(q.from <= q.to ? q.to : q.from, today)
    return build('custom', 'custom', from, to, `${i18n.f.formatDate(from)} – ${i18n.f.formatDate(to)}`, today)
  }
  return monthPeriod(today.slice(0, 7), today, i18n)
}

export function parseCompare(value: string | undefined): CompareMode {
  return value === 'plan' || value === 'yoy' ? value : 'prev'
}

/**
 * Comparison range. A running period is compared like-for-like:
 * 1.–19. 10. against 1.–19. 9. (or 1.–19. 10. last year), never against a full month.
 */
export function comparisonPeriod(p: Period, mode: CompareMode, today: ISODate, i18n: I18n = getI18n()): Period {
  const { formatDate, formatDateShort, formatMonth } = i18n.f
  let start: ISODate
  let end: ISODate
  if (mode === 'yoy') {
    start = addMonths(p.start, -12)
    end = addMonths(p.end, -12)
  } else if (p.kind === 'month') {
    start = addMonths(p.start, -1)
    end = endOfMonth(start)
  } else if (p.kind === 'quarter') {
    start = addMonths(p.start, -3)
    end = endOfMonth(addMonths(start, 2))
  } else if (p.kind === 'year') {
    start = addMonths(p.start, -12)
    end = addMonths(p.end, -12)
  } else {
    const len = diffDays(p.start, p.end)
    end = addDays(p.start, -1)
    start = addDays(end, -len)
  }
  let truncated = false
  if (p.isCurrent && p.kind !== 'custom') {
    const elapsed = diffDays(p.start, today)
    const cut = addDays(start, elapsed)
    if (cut < end) {
      end = cut
      truncated = true
    }
  }
  const label = truncated
    ? `${formatDateShort(start)}–${formatDateShort(end)}`
    : p.kind === 'month'
      ? formatMonth(start.slice(0, 7))
      : p.kind === 'quarter'
        ? `Q${Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1} ${start.slice(0, 4)}`
        : p.kind === 'year'
          ? i18n.t('period.yearLower', { year: start.slice(0, 4) })
          : `${formatDate(start)} – ${formatDate(end)}`
  return build(p.kind, `cmp-${start}`, start, end, label, today)
}

export function compareLabel(mode: CompareMode, cmp: Period, i18n: I18n = getI18n()): string {
  if (mode === 'plan') return i18n.t('compare.vsPlan')
  return i18n.t('compare.vs', { label: cmp.label })
}

/** Month keys touched by the range. */
export function monthsOf(r: DateRange): string[] {
  return monthRange(r.start.slice(0, 7), r.end.slice(0, 7))
}

export function inRange(date: ISODate | null | undefined, r: DateRange): boolean {
  return !!date && date >= r.start && date <= r.end
}

export function periodTitle(p: Period, i18n: I18n = getI18n()): string {
  if (p.kind === 'month') return i18n.f.formatMonthName(p.key)
  return p.label
}

export interface PeriodPreset {
  key: string
  label: string
  hint: string
}

export function periodPresets(today: ISODate, i18n: I18n = getI18n()): PeriodPreset[] {
  const { formatMonth } = i18n.f
  const ym = today.slice(0, 7)
  const prev = addMonthsToKey(ym, -1)
  const year = Number(today.slice(0, 4))
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1
  return [
    { key: ym, label: i18n.t('period.presets.thisMonth'), hint: formatMonth(ym) },
    { key: prev, label: i18n.t('period.presets.lastMonth'), hint: formatMonth(prev) },
    { key: `${year}-Q${q}`, label: i18n.t('period.presets.quarter'), hint: `Q${q} ${year}` },
    { key: String(year), label: i18n.t('period.presets.year'), hint: String(year) },
  ]
}

export function compareOptions(i18n: I18n = getI18n()): { key: CompareMode; label: string }[] {
  return (['prev', 'plan', 'yoy'] as const).map((key) => ({ key, label: i18n.t(`compare.options.${key}`) }))
}
