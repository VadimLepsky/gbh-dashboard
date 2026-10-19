import { getDataset, getScopedDataset, parseViewAs, type ViewAs } from '../data'
import { pragueToday } from '../data/dates'
import type { Dataset } from '../data/types'
import {
  comparisonPeriod,
  parseCompare,
  parsePeriod,
  type CompareMode,
  type Period,
  type PeriodQuery,
} from './period'

export interface MetricContext {
  /** Dataset filtered by role. All metrics use this. */
  ds: Dataset
  /** Unfiltered dataset — only for data-quality checks and payment matching. */
  full: Dataset
  as: ViewAs
  period: Period
  cmpMode: CompareMode
  compare: Period
  query: PeriodQuery
}

type RawParams = Record<string, string | string[] | undefined>

export function toQuery(params: RawParams | PeriodQuery): PeriodQuery {
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined)
  const p = params as RawParams
  return { period: one(p.period), from: one(p.from), to: one(p.to), cmp: one(p.cmp), as: one(p.as) }
}

export function buildContext(params: RawParams | PeriodQuery, today: string = pragueToday()): MetricContext {
  const query = toQuery(params)
  const as = parseViewAs(query.as)
  const full = getDataset(today)
  const ds = getScopedDataset(as, today)
  const period = parsePeriod(query, today)
  const cmpMode = parseCompare(query.cmp)
  const compare = comparisonPeriod(period, cmpMode === 'plan' ? 'prev' : cmpMode, today)
  return { ds, full, as, period, cmpMode, compare, query }
}
