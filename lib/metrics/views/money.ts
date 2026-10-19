import { addDays } from '../../data/dates'
import { PAYMENT_TERM_DAYS } from '../../data/reference'
import { formatMonthShort } from '../../format'
import type { MetricContext } from '../context'
import { makeKpi } from '../kpi'
import { institutionName } from '../lookup'
import {
  aging,
  AGING_BUCKETS,
  collected,
  deliveryChain,
  dso,
  invoiced,
  manualMatches,
  overdue,
  productBreakdown,
  receivables,
  unmatchedWithCandidates,
} from '../money'
import { compareLabel } from '../period'
import { chartEndMonth, collectedSeries, dsoTrend, overdueSeries } from '../series'

export { PAYMENT_TERM_DAYS }

export function moneyView(ctx: MetricContext) {
  const { ds, full, period, compare } = ctx
  const label = compareLabel('prev', compare)
  const endYm = chartEndMonth(period, ds.today)
  const spark = (s: { ym: string; value: number }[]) => s.map((p) => ({ label: formatMonthShort(p.ym), value: p.value }))
  const chain = deliveryChain(ds, period)
  const ag = aging(ds, period.asOf)
  const unmatched = unmatchedWithCandidates(ds, full)

  return {
    kpis: [
      makeKpi('invoiced', invoiced(ds, period), invoiced(ds, compare), label, { metric: 'invoiced' }),
      makeKpi('collected', collected(ds, period), collected(ds, compare), label, { metric: 'collected' }, {
        spark: spark(collectedSeries(ds, endYm, 6)),
      }),
      makeKpi('receivables', receivables(ds, period.asOf), receivables(ds, compare.asOf), label, { metric: 'receivables' }),
      makeKpi('overdue', overdue(ds, period.asOf), overdue(ds, compare.asOf), label, { metric: 'overdue' }, {
        spark: spark(overdueSeries(ds, endYm, 6)),
      }),
      makeKpi('dso', dso(ds, period), dso(ds, compare), label, { metric: 'dso' }, {
        note: `splatnost faktur ${PAYMENT_TERM_DAYS} dní`,
      }),
    ],
    chain,
    aging: {
      ...ag,
      buckets: AGING_BUCKETS.map((b) => ({ id: b.id, label: b.label, value: ag.totals[b.id] })),
      asOf: period.asOf,
    },
    products: productBreakdown(ds, period),
    unmatched: unmatched.map((u) => ({
      id: u.payment.id,
      receivedAt: u.payment.receivedAt,
      amount: u.payment.amount,
      vs: u.payment.variableSymbol,
      counterparty: u.payment.counterparty,
      candidate: u.candidate
        ? {
            id: u.candidate.id,
            number: u.candidate.number,
            vs: u.candidate.variableSymbol,
            institution: institutionName(full, u.candidate.institutionId),
            dueAt: u.candidate.dueAt,
          }
        : null,
      alternatives: u.alternatives,
    })),
    manualLastYear: manualMatches(ds, { start: addDays(ds.today, -365), end: ds.today }).length,
    dso: dsoTrend(ds, endYm, 12),
  }
}
