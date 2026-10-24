import type { ValueFormat } from '../format'
import type { I18n } from '../i18n/core'
import { METRICS, metricText, type MetricId } from './dictionary'
import type { DrillRequest } from './drill-types'

export interface Kpi {
  id: MetricId
  label: string
  definition: string
  value: number | null
  format: ValueFormat
  compare: number | null
  compareLabel: string
  /** Relative change for amounts/counts, absolute change for percentages. */
  delta: number | null
  deltaKind: 'relative' | 'points' | 'absolute'
  /** true = change in the good direction, false = bad, null = no change / unknown. */
  good: boolean | null
  progress?: { value: number; target: number; label: string; extra?: number }
  spark?: { label: string; value: number }[]
  sparkLabel?: string
  drill: DrillRequest
  note?: string
}

export function makeKpi(
  i18n: I18n,
  id: MetricId,
  value: number | null,
  compare: number | null,
  compareLabel: string,
  drill: DrillRequest,
  extra: Partial<Kpi> = {},
): Kpi {
  const def = METRICS[id]
  const text = metricText(i18n, id)
  const deltaKind: Kpi['deltaKind'] = def.unit === 'percent' ? 'points' : def.unit === 'days' ? 'absolute' : 'relative'
  let delta: number | null = null
  if (value !== null && compare !== null) {
    if (deltaKind === 'relative') delta = compare === 0 ? (value === 0 ? 0 : null) : (value - compare) / Math.abs(compare)
    else delta = value - compare
  }
  const good = delta === null || Math.abs(delta) < 1e-9 ? null : (delta > 0) === (def.goodDirection === 'up')
  return {
    id,
    label: text.label,
    definition: text.definition,
    value,
    format: def.unit,
    compare,
    compareLabel,
    delta,
    deltaKind,
    good,
    drill,
    ...extra,
  }
}
