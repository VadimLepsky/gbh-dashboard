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
import { formatDate, formatDateShort, formatMonth, formatMonthName } from '../format'

/** Look-back for rates that need a full year of history (renewals, tenders, manual matches). */
export const TRAILING_MONTHS = 12

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

export function monthPeriod(ym: string, today: ISODate): Period {
  return build('month', ym, `${ym}-01`, endOfMonth(`${ym}-01`), formatMonth(ym), today)
}

export function quarterPeriod(year: number, q: number, today: ISODate): Period {
  const startYm = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}`
  const endYm = addMonthsToKey(startYm, 2)
  return build('quarter', `${year}-Q${q}`, `${startYm}-01`, endOfMonth(`${endYm}-01`), `Q${q} ${year}`, today)
}

export function yearPeriod(year: number, today: ISODate): Period {
  return build('year', String(year), `${year}-01-01`, `${year}-12-31`, `Rok ${year}`, today)
}

export function parsePeriod(q: PeriodQuery, today: ISODate): Period {
  const raw = q.period ?? ''
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= today.slice(0, 7)) return monthPeriod(raw, today)
  const qm = /^(\d{4})-Q([1-4])$/.exec(raw)
  if (qm) return quarterPeriod(Number(qm[1]), Number(qm[2]), today)
  if (/^\d{4}$/.test(raw) && raw <= today.slice(0, 4)) return yearPeriod(Number(raw), today)
  if (raw === 'custom' && q.from && q.to && ISO_RE.test(q.from) && ISO_RE.test(q.to)) {
    const from = q.from <= q.to ? q.from : q.to
    const to = minDate(q.from <= q.to ? q.to : q.from, today)
    return build('custom', 'custom', from, to, `${formatDate(from)} – ${formatDate(to)}`, today)
  }
  return monthPeriod(today.slice(0, 7), today)
}

export function parseCompare(value: string | undefined): CompareMode {
  return value === 'plan' || value === 'yoy' ? value : 'prev'
}

/**
 * Comparison range. A running period is compared like-for-like:
 * 1.–19. 10. against 1.–19. 9. (or 1.–19. 10. last year), never against a full month.
 */
export function comparisonPeriod(p: Period, mode: CompareMode, today: ISODate): Period {
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
          ? `rok ${start.slice(0, 4)}`
          : `${formatDate(start)} – ${formatDate(end)}`
  return build(p.kind, `cmp-${start}`, start, end, label, today)
}

export function compareLabel(mode: CompareMode, cmp: Period): string {
  if (mode === 'plan') return 'vs. plán'
  return `vs. ${cmp.label}`
}

/** Month keys touched by the range. */
export function monthsOf(r: DateRange): string[] {
  return monthRange(r.start.slice(0, 7), r.end.slice(0, 7))
}

export function inRange(date: ISODate | null | undefined, r: DateRange): boolean {
  return !!date && date >= r.start && date <= r.end
}

export function periodTitle(p: Period): string {
  if (p.kind === 'month') return formatMonthName(p.key)
  return p.label
}

export interface PeriodPreset {
  key: string
  label: string
  hint: string
}

export function periodPresets(today: ISODate): PeriodPreset[] {
  const ym = today.slice(0, 7)
  const prev = addMonthsToKey(ym, -1)
  const year = Number(today.slice(0, 4))
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1
  return [
    { key: ym, label: 'Tento měsíc', hint: formatMonth(ym) },
    { key: prev, label: 'Minulý měsíc', hint: formatMonth(prev) },
    { key: `${year}-Q${q}`, label: 'Kvartál', hint: `Q${q} ${year}` },
    { key: String(year), label: 'Rok', hint: String(year) },
  ]
}

export const COMPARE_OPTIONS: { key: CompareMode; label: string }[] = [
  { key: 'prev', label: 'vs. předchozí období' },
  { key: 'plan', label: 'vs. plán' },
  { key: 'yoy', label: 'vs. loni' },
]
