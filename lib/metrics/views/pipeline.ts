import { addDays } from '../../data/dates'
import type { Dataset, Deal } from '../../data/types'
import { formatCZKCompact, formatNumber } from '../../format'
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
  stage: string
  value: number
  prob: number
  expected: string
  nextStep: string | null
  nextStepAt: string | null
  inStage: number
  typical: number
}

export function dealListRow(ds: Dataset, d: Deal): DealListRow {
  return {
    id: d.id,
    name: dealName(ds, d),
    owner: lookup(ds).rep.get(d.ownerId)?.name ?? '—',
    stage: d.stage,
    value: d.value,
    prob: stageProbability(d.stage),
    expected: d.expectedCloseAt,
    nextStep: d.nextStep,
    nextStepAt: d.nextStepAt,
    inStage: daysInStage(d, ds.today),
    typical: Math.round(medianForDeal(ds, d)),
  }
}

export const CLOSING_SOON_DAYS = 14

export function pipelineView(ctx: MetricContext) {
  const { ds, period, compare } = ctx
  const open = openDeals(ds)
  const fc = forecast(ds, period)
  const soon = closingInPeriod(ds, { start: ds.today, end: addDays(ds.today, CLOSING_SOON_DAYS) }).sort((a, b) =>
    a.expectedCloseAt < b.expectedCloseAt ? -1 : 1,
  )
  const stuck = stuckDeals(ds).sort((a, b) => b.value - a.value)
  const pipeline = sum(open, (d) => d.value)
  const window = conversionWindow(period)

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
      makeKpi('pipeline', pipeline, pipelineValue(ds, compare.asOf), compareLabel('prev', compare), { metric: 'pipeline' }, {
        note: `${formatNumber(open.length)} otevřených dealů · vážená ${formatCZKCompact(sum(open, weightedValue))}`,
      }),
      makeKpi('weighted_forecast', fc.total, fc.plan, 'vs. plán', { metric: 'weighted_forecast' }, {
        progress: {
          value: fc.won,
          extra: fc.weighted,
          target: fc.plan,
          label: fc.gap > 0 ? `Do plánu chybí ${formatCZKCompact(fc.gap)}` : `Nad plánem o ${formatCZKCompact(-fc.gap)}`,
        },
      }),
      makeKpi('coverage', fc.coverage, null, fc.coverage === null ? 'plán už je splněný' : `pipeline ${formatCZKCompact(fc.pipelineClosing)} na zbývajících ${formatCZKCompact(fc.plan - fc.won)}`, {
        metric: 'pipeline',
      }),
    ],
    soonValue: sum(soon, (d) => d.value),
    stuckValue: sum(stuck, (d) => d.value),
    funnel: funnel(ds, period),
    window,
    byTeam: ds.teams.length > 1 ? ds.teams.map((t) => bar(t.id, t.name, { teamId: t.id }, { teamId: t.id })) : [],
    byRep: ds.salespeople
      .map((r) => bar(r.id, r.name, { ownerId: r.id }, { ownerId: r.id }))
      .sort((a, b) => b.total / (b.plan || 1) - a.total / (a.plan || 1)),
    kraje,
    soon: soon.map((d) => dealListRow(ds, d)),
    stuck: stuck.map((d) => dealListRow(ds, d)),
  }
}
