import { addDays } from '../../data/dates'
import type { Dataset, Deal } from '../../data/types'
import { getI18n, type I18n } from '../../i18n'
import type { MetricContext } from '../context'
import { conversionWindow, funnel } from '../conversion'
import { makeKpi } from '../kpi'
import { dealName, lookup } from '../lookup'
import { compareLabel } from '../period'
import {
  closingInPeriod,
  daysInStage,
  forecast,
  medianForDeal,
  openDeals,
  pipelineValue,
  stageProbability,
  stuckDeals,
  sum,
  weightedValue,
} from '../sales'

export interface DealListRow {
  id: string
  name: string
  owner: string
  /** Stored stage (for logic) and its display text. */
  stage: string
  stageLabel: string
  value: number
  prob: number
  expected: string
  nextStep: string | null
  nextStepAt: string | null
  inStage: number
  typical: number
}

export function dealListRow(ds: Dataset, d: Deal, i18n: I18n = getI18n()): DealListRow {
  return {
    id: d.id,
    name: dealName(ds, d, i18n),
    owner: lookup(ds).rep.get(d.ownerId)?.name ?? '—',
    stage: d.stage,
    stageLabel: i18n.term('stage', d.stage),
    value: d.value,
    prob: stageProbability(d.stage),
    expected: d.expectedCloseAt,
    nextStep: d.nextStep ? i18n.term('nextStep', d.nextStep) : null,
    nextStepAt: d.nextStepAt,
    inStage: daysInStage(d, ds.today),
    typical: Math.round(medianForDeal(ds, d)),
  }
}

export const CLOSING_SOON_DAYS = 14

export function pipelineView(ctx: MetricContext) {
  const { ds, period, compare, i18n } = ctx
  const { t, tn } = i18n
  const { formatCZKCompact } = i18n.f
  const open = openDeals(ds)
  const fc = forecast(ds, period)
  const soon = closingInPeriod(ds, { start: ds.today, end: addDays(ds.today, CLOSING_SOON_DAYS) }).sort((a, b) =>
    a.expectedCloseAt < b.expectedCloseAt ? -1 : 1,
  )
  const stuck = stuckDeals(ds).sort((a, b) => b.value - a.value)
  const pipeline = sum(open, (d) => d.value)
  const window = conversionWindow(period, i18n)

  const bar = (key: string, label: string, f: Parameters<typeof forecast>[2], filter: Record<string, string>) => {
    const x = forecast(ds, period, f)
    return { key, label, won: x.won, weighted: x.weighted, total: x.total, plan: x.plan, filter }
  }

  const kraje = ds.kraje.map((k) => {
    const x = forecast(ds, period, { kraj: k.id })
    const openHere = open.filter((d) => lookup(ds).institution.get(d.institutionId)?.kraj === k.id)
    return { ...k, total: x.total, won: x.won, weighted: x.weighted, openCount: openHere.length }
  })

  return {
    kpis: [
      makeKpi(i18n, 'pipeline', pipeline, pipelineValue(ds, compare.asOf), compareLabel('prev', compare, i18n), { metric: 'pipeline' }, {
        note: `${tn('drill.count.openDeals', open.length)} · ${t('views.weighted', { value: formatCZKCompact(sum(open, weightedValue)) })}`,
      }),
      makeKpi(i18n, 'weighted_forecast', fc.total, fc.plan, t('compare.vsPlan'), { metric: 'weighted_forecast' }, {
        progress: {
          value: fc.won,
          extra: fc.weighted,
          target: fc.plan,
          label: fc.gap > 0 ? t('views.gapToPlan', { value: formatCZKCompact(fc.gap) }) : t('views.abovePlan', { value: formatCZKCompact(-fc.gap) }),
        },
      }),
      makeKpi(i18n, 'coverage', fc.coverage, null, fc.coverage === null ? t('views.planMet') : t('views.coverageNote', { pipeline: formatCZKCompact(fc.pipelineClosing), rest: formatCZKCompact(fc.plan - fc.won) }), {
        metric: 'pipeline',
      }),
    ],
    soonValue: sum(soon, (d) => d.value),
    stuckValue: sum(stuck, (d) => d.value),
    funnel: funnel(ds, period, undefined, i18n),
    window,
    byTeam: ds.teams.length > 1 ? ds.teams.map((t) => bar(t.id, i18n.term('team', t.id), { teamId: t.id }, { teamId: t.id })) : [],
    byRep: ds.salespeople
      .map((r) => bar(r.id, r.name, { ownerId: r.id }, { ownerId: r.id }))
      .sort((a, b) => b.total / (b.plan || 1) - a.total / (a.plan || 1)),
    kraje,
    soon: soon.map((d) => dealListRow(ds, d, i18n)),
    stuck: stuck.map((d) => dealListRow(ds, d, i18n)),
  }
}
