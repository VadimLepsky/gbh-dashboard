import type { ValueFormat } from '../format'
import type { I18n } from '../i18n/core'
import { STUCK_FACTOR, TRAILING_MONTHS } from './constants'

export type MetricId =
  | 'revenue_won'
  | 'invoiced'
  | 'collected'
  | 'receivables'
  | 'overdue'
  | 'dso'
  | 'pipeline'
  | 'weighted_forecast'
  | 'plan'
  | 'attainment'
  | 'coverage'
  | 'win_rate'
  | 'cycle_days'
  | 'avg_deal'
  | 'gross_margin'
  | 'activities_done'
  | 'overdue_followups'
  | 'no_next_step'
  | 'stuck_deals'
  | 'commission_payable'
  | 'commission_pending'
  | 'renewal_rate'
  | 'tender_win_rate'
  | 'unmatched_payments'

/**
 * Single source of metric definitions. Texts (label, definition, formula) live in the
 * dictionaries under `metrics.<id>`; this file holds what does not depend on language.
 */
export interface MetricDefinition {
  id: MetricId
  unit: ValueFormat
  goodDirection: 'up' | 'down'
}

const def = (id: MetricId, unit: ValueFormat, goodDirection: 'up' | 'down'): MetricDefinition => ({ id, unit, goodDirection })

export const METRICS: Record<MetricId, MetricDefinition> = {
  revenue_won: def('revenue_won', 'czk', 'up'),
  invoiced: def('invoiced', 'czk', 'up'),
  collected: def('collected', 'czk', 'up'),
  receivables: def('receivables', 'czk', 'down'),
  overdue: def('overdue', 'czk', 'down'),
  dso: def('dso', 'days', 'down'),
  pipeline: def('pipeline', 'czk', 'up'),
  weighted_forecast: def('weighted_forecast', 'czk', 'up'),
  plan: def('plan', 'czk', 'up'),
  attainment: def('attainment', 'percent', 'up'),
  coverage: def('coverage', 'ratio', 'up'),
  win_rate: def('win_rate', 'percent', 'up'),
  cycle_days: def('cycle_days', 'days', 'down'),
  avg_deal: def('avg_deal', 'czk', 'up'),
  gross_margin: def('gross_margin', 'percent', 'up'),
  activities_done: def('activities_done', 'percent', 'up'),
  overdue_followups: def('overdue_followups', 'int', 'down'),
  no_next_step: def('no_next_step', 'int', 'down'),
  stuck_deals: def('stuck_deals', 'int', 'down'),
  commission_payable: def('commission_payable', 'czk', 'up'),
  commission_pending: def('commission_pending', 'czk', 'up'),
  renewal_rate: def('renewal_rate', 'percent', 'up'),
  tender_win_rate: def('tender_win_rate', 'percent', 'up'),
  unmatched_payments: def('unmatched_payments', 'int', 'down'),
}

export const METRIC_LIST: MetricDefinition[] = Object.values(METRICS)

/** Values used inside definitions — the same constants the metrics use. */
export const METRIC_TEXT_VARS = { factor: STUCK_FACTOR, months: TRAILING_MONTHS }

export function metricText(i18n: Pick<I18n, 't'>, id: MetricId) {
  return {
    label: i18n.t(`metrics.${id}.label`),
    definition: i18n.t(`metrics.${id}.definition`, METRIC_TEXT_VARS),
    formula: i18n.t(`metrics.${id}.formula`, METRIC_TEXT_VARS),
  }
}
