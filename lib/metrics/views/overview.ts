import { formatCZKCompact, formatMonthShort, formatPercent } from '../../format'
import { commissionSummary } from '../commissions'
import type { MetricContext } from '../context'
import { exceptions } from '../exceptions'
import { makeKpi } from '../kpi'
import { collected, invoiced, medianLateness, overdue } from '../money'
import { compareLabel, TRAILING_MONTHS } from '../period'
import { addMonths } from '../../data/dates'
import { forecast, planFor, revenueWon } from '../sales'
import { chartEndMonth, collectedSeries, commissionSeries, overdueSeries, salesVsPlan } from '../series'

export function overviewView(ctx: MetricContext) {
  const { ds, full, period, compare, cmpMode } = ctx
  const endYm = chartEndMonth(period, ds.today)
  const prevLabel = compareLabel('prev', compare)
  const cmpLabel = compareLabel(cmpMode, compare)

  const won = revenueWon(ds, period)
  const plan = planFor(ds, period)
  const fc = forecast(ds, period)
  const comm = commissionSummary(ds, period)
  const commCmp = commissionSummary(ds, compare)
  const spark = (s: { ym: string; value: number }[]) => s.map((p) => ({ label: formatMonthShort(p.ym), value: p.value }))

  const kpis = [
    makeKpi('revenue_won', won, cmpMode === 'plan' ? plan : revenueWon(ds, compare), cmpLabel, { metric: 'revenue_won' }, {
      progress: { value: won, target: plan, label: `${formatPercent(plan ? won / plan : 0, 0)} z plánu ${formatCZKCompact(plan)}` },
    }),
    makeKpi('weighted_forecast', fc.total, fc.plan, 'vs. plán', { metric: 'weighted_forecast' }, {
      progress: {
        value: fc.won,
        extra: fc.weighted,
        target: fc.plan,
        label: fc.gap > 0 ? `Do plánu chybí ${formatCZKCompact(fc.gap)}` : `Nad plánem o ${formatCZKCompact(-fc.gap)}`,
      },
    }),
    makeKpi('collected', collected(ds, period), collected(ds, compare), prevLabel, { metric: 'collected' }, {
      spark: spark(collectedSeries(ds, endYm, 6)),
      sparkLabel: 'posledních 6 měsíců',
    }),
    makeKpi('overdue', overdue(ds, period.asOf), overdue(ds, compare.asOf), prevLabel, { metric: 'overdue' }, {
      spark: spark(overdueSeries(ds, endYm, 6)),
      sparkLabel: 'stav vždy ke konci měsíce',
    }),
    makeKpi('commission_payable', comm.payable, commCmp.payable, prevLabel, { metric: 'commission_payable' }, {
      spark: spark(commissionSeries(ds, endYm, 6)),
      sparkLabel: `čeká dalších ${formatCZKCompact(comm.pending)}`,
    }),
  ]

  const inv = invoiced(ds, period)
  const col = collected(ds, period)
  const allExceptions = exceptions(ds, full)

  return {
    kpis,
    sales: salesVsPlan(ds, endYm, 12),
    forecast: fc,
    chain: [
      { id: 'revenue_won', label: 'Prodáno', value: won },
      { id: 'invoiced', label: 'Fakturováno', value: inv },
      { id: 'collected', label: 'Uhrazeno', value: col },
    ] as const,
    exceptions: allExceptions.slice(0, 5),
    exceptionCount: allExceptions.length,
    exceptionTotal: allExceptions.reduce((s, e) => s + e.amount, 0),
    lateness: medianLateness(ds, { start: addMonths(ds.today, -TRAILING_MONTHS), end: ds.today }),
    owners: Object.fromEntries(ds.salespeople.map((s) => [s.id, s.name])),
  }
}
