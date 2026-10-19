import { addMonthsToKey, endOfMonth, minDate } from '../data/dates'
import type { Dataset } from '../data/types'
import { commissionSummary } from './commissions'
import { collected, dso, overdue } from './money'
import { monthPeriod, type Period } from './period'
import { forecast, planFor, revenueWon } from './sales'

export interface MonthPoint {
  ym: string
  /** Month range capped at today. */
  start: string
  end: string
}

export function lastMonths(endYm: string, n: number, today: string): MonthPoint[] {
  const out: MonthPoint[] = []
  for (let i = n - 1; i >= 0; i--) {
    const ym = addMonthsToKey(endYm, -i)
    out.push({ ym, start: `${ym}-01`, end: minDate(endOfMonth(`${ym}-01`), today) })
  }
  return out
}

/** The last month a chart should show for the selected period. */
export function chartEndMonth(p: Period, today: string): string {
  const end = p.end.slice(0, 7)
  const cur = today.slice(0, 7)
  return end < cur ? end : cur
}

export interface SalesPoint {
  ym: string
  won: number
  plan: number
  lastYear: number
  /** Weighted pipeline still expected this month (running month only). */
  expected: number
  current: boolean
}

export function salesVsPlan(ds: Dataset, endYm: string, n = 12, f?: { ownerId?: string; teamId?: string }): SalesPoint[] {
  return lastMonths(endYm, n, ds.today).map((m) => {
    const full = { start: m.start, end: endOfMonth(m.start) }
    const ly = addMonthsToKey(m.ym, -12)
    const current = m.ym === ds.today.slice(0, 7)
    const fc = current ? forecast(ds, monthPeriod(m.ym, ds.today), f) : null
    return {
      ym: m.ym,
      won: revenueWon(ds, m, f),
      plan: planFor(ds, full, f),
      lastYear: revenueWon(ds, { start: `${ly}-01`, end: endOfMonth(`${ly}-01`) }, f),
      expected: fc ? fc.weighted : 0,
      current,
    }
  })
}

export function monthlySeries(
  ds: Dataset,
  endYm: string,
  n: number,
  pick: (range: { start: string; end: string }) => number,
): { ym: string; value: number }[] {
  return lastMonths(endYm, n, ds.today).map((m) => ({ ym: m.ym, value: pick(m) }))
}

export const collectedSeries = (ds: Dataset, endYm: string, n = 6) => monthlySeries(ds, endYm, n, (r) => collected(ds, r))
export const wonSeries = (ds: Dataset, endYm: string, n = 6) => monthlySeries(ds, endYm, n, (r) => revenueWon(ds, r))
export const overdueSeries = (ds: Dataset, endYm: string, n = 6) => monthlySeries(ds, endYm, n, (r) => overdue(ds, r.end))
export const commissionSeries = (ds: Dataset, endYm: string, n = 6) =>
  monthlySeries(ds, endYm, n, (r) => commissionSummary(ds, monthPeriod(r.start.slice(0, 7), ds.today)).payable)

export function dsoTrend(ds: Dataset, endYm: string, n = 12) {
  return lastMonths(endYm, n, ds.today).map((m) => ({ ym: m.ym, value: dso(ds, m) }))
}
