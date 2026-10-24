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
  const { ds, full, period, compare, cmpMode, i18n } = ctx
  const { t, f } = i18n
  const { formatCZKCompact, formatPercent } = f
  const endYm = chartEndMonth(period, ds.today)
  const prevLabel = compareLabel('prev', compare, i18n)
  const cmpLabel = compareLabel(cmpMode, compare, i18n)

  const won = revenueWon(ds, period)
  const plan = planFor(ds, period)
  const fc = forecast(ds, period)
  const comm = commissionSummary(ds, period)
  const commCmp = commissionSummary(ds, compare)
  const spark = (s: { ym: string; value: number }[]) => s.map((p) => ({ label: f.formatMonthShort(p.ym), value: p.value }))

  const kpis = [
    makeKpi(i18n, 'revenue_won', won, cmpMode === 'plan' ? plan : revenueWon(ds, compare), cmpLabel, { metric: 'revenue_won' }, {
      progress: { value: won, target: plan, label: t('views.ofPlan', { pct: formatPercent(plan ? won / plan : 0, 0), plan: formatCZKCompact(plan) }) },
    }),
    makeKpi(i18n, 'weighted_forecast', fc.total, fc.plan, t('compare.vsPlan'), { metric: 'weighted_forecast' }, {
      progress: {
        value: fc.won,
        extra: fc.weighted,
        target: fc.plan,
        label: fc.gap > 0 ? t('views.gapToPlan', { value: formatCZKCompact(fc.gap) }) : t('views.abovePlan', { value: formatCZKCompact(-fc.gap) }),
      },
    }),
    makeKpi(i18n, 'collected', collected(ds, period), collected(ds, compare), prevLabel, { metric: 'collected' }, {
      spark: spark(collectedSeries(ds, endYm, 6)),
      sparkLabel: t('views.lastMonths', { months: 6 }),
    }),
    makeKpi(i18n, 'overdue', overdue(ds, period.asOf), overdue(ds, compare.asOf), prevLabel, { metric: 'overdue' }, {
      spark: spark(overdueSeries(ds, endYm, 6)),
      sparkLabel: t('views.monthEnd'),
    }),
    makeKpi(i18n, 'commission_payable', comm.payable, commCmp.payable, prevLabel, { metric: 'commission_payable' }, {
      spark: spark(commissionSeries(ds, endYm, 6)),
      sparkLabel: t('views.pendingMore', { value: formatCZKCompact(comm.pending) }),
    }),
  ]

  const inv = invoiced(ds, period)
  const col = collected(ds, period)
  const allExceptions = exceptions(ds, full, i18n)

  return {
    kpis,
    sales: salesVsPlan(ds, endYm, 12),
    forecast: fc,
    chain: [
      { id: 'revenue_won', label: t('metrics.revenue_won.label'), value: won },
      { id: 'invoiced', label: t('metrics.invoiced.label'), value: inv },
      { id: 'collected', label: t('metrics.collected.label'), value: col },
    ] as const,
    exceptions: allExceptions.slice(0, 5),
    exceptionCount: allExceptions.length,
    exceptionTotal: allExceptions.reduce((s, e) => s + e.amount, 0),
    lateness: medianLateness(ds, { start: addMonths(ds.today, -TRAILING_MONTHS), end: ds.today }),
    owners: Object.fromEntries(ds.salespeople.map((s) => [s.id, s.name])),
  }
}
