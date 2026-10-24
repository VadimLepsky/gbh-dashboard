import { addMonths } from '../../data/dates'
import { PAYMENT_TERM_DAYS } from '../../data/reference'
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
import { compareLabel, TRAILING_MONTHS } from '../period'
import { chartEndMonth, collectedSeries, dsoTrend, overdueSeries } from '../series'

export { PAYMENT_TERM_DAYS }

export function moneyView(ctx: MetricContext) {
  const { ds, full, period, compare, i18n } = ctx
  const { t, f } = i18n
  const label = compareLabel('prev', compare, i18n)
  const endYm = chartEndMonth(period, ds.today)
  const spark = (s: { ym: string; value: number }[]) => s.map((p) => ({ label: f.formatMonthShort(p.ym), value: p.value }))
  const chain = deliveryChain(ds, period)
  const ag = aging(ds, period.asOf)
  const unmatched = unmatchedWithCandidates(ds, full)

  return {
    kpis: [
      makeKpi(i18n, 'invoiced', invoiced(ds, period), invoiced(ds, compare), label, { metric: 'invoiced' }),
      makeKpi(i18n, 'collected', collected(ds, period), collected(ds, compare), label, { metric: 'collected' }, {
        spark: spark(collectedSeries(ds, endYm, 6)),
      }),
      makeKpi(i18n, 'receivables', receivables(ds, period.asOf), receivables(ds, compare.asOf), label, { metric: 'receivables' }),
      makeKpi(i18n, 'overdue', overdue(ds, period.asOf), overdue(ds, compare.asOf), label, { metric: 'overdue' }, {
        spark: spark(overdueSeries(ds, endYm, 6)),
      }),
      makeKpi(i18n, 'dso', dso(ds, period), dso(ds, compare), label, { metric: 'dso' }, {
        note: t('views.paymentTerm', { days: f.formatDays(PAYMENT_TERM_DAYS) }),
      }),
    ],
    chain,
    aging: {
      ...ag,
      buckets: AGING_BUCKETS.map((b) => ({ id: b.id, label: t(`aging.${b.id}`), value: ag.totals[b.id] })),
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
    manualLastYear: manualMatches(ds, { start: addMonths(ds.today, -TRAILING_MONTHS), end: ds.today }).length,
    dso: dsoTrend(ds, endYm, 12),
    trailingMonths: TRAILING_MONTHS,
  }
}
