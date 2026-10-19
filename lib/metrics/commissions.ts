import { addDays, endOfMonth, maxDate, minDate } from '../data/dates'
import type { Dataset, ISODate, SalesRole } from '../data/types'
import { lookup } from './lookup'
import { monthsOf, type Period } from './period'
import { planFor, revenueWon, sum } from './sales'
import { monthAttainment } from './team'

/** KPI coefficient from monthly plan attainment: < 80 % → 0,8 · 80–100 % → 1,0 · 100–120 % → 1,15 · > 120 % → 1,3 */
export function coefficientFor(attainment: number | null): number {
  if (attainment === null) return 1
  if (attainment < 0.8) return 0.8
  if (attainment <= 1.0) return 1.0
  if (attainment <= 1.2) return 1.15
  return 1.3
}

export function baseRate(ds: Dataset, repId: string): number {
  const rep = lookup(ds).rep.get(repId)
  return ds.commissionProfiles.find((p) => p.id === rep?.commissionProfileId)?.baseRate ?? 0
}

export type CommissionLineKind = 'paid' | 'unpaid' | 'uninvoiced'

export interface CommissionLine {
  id: string
  repId: string
  kind: CommissionLineKind
  dealId: string
  invoiceId: string | null
  institutionId: string
  /** Paid date, issue date or win date depending on kind. */
  date: ISODate
  amount: number
  rate: number
  coefficient: number
  commission: number
}

export interface RepCommission {
  repId: string
  name: string
  role: SalesRole
  rate: number
  paidRevenue: number
  attainment: number | null
  coefficient: number
  payable: number
  pending: number
  accrued: number
  lines: CommissionLine[]
}

export interface CommissionSummary {
  reps: RepCommission[]
  payable: number
  pending: number
  accrued: number
  paidRevenue: number
}

/** Pending commission considers wins from this many days back (older deals are fully settled). */
const PENDING_LOOKBACK_DAYS = 400

/**
 * Commission for a period.
 * - Payable: invoices paid in the period × base rate × coefficient of the month of payment.
 * - Pending: what is won but not yet paid at the end of the period (unpaid invoices and
 *   the not-yet-invoiced remainder of won deals) × base rate × current coefficient.
 */
export function repCommission(ds: Dataset, p: Period, repId: string): RepCommission {
  const lk = lookup(ds)
  const rep = lk.rep.get(repId)!
  const rate = baseRate(ds, repId)
  const lines: CommissionLine[] = []
  const asOf = p.asOf
  const months = monthsOf({ start: p.start, end: asOf })
  let lastCoef = 1

  const repInvoices = ds.invoices.filter((i) => i.ownerId === repId)
  for (const ym of months) {
    const coef = coefficientFor(monthAttainment(ds, ym, { ownerId: repId }))
    lastCoef = coef
    const start = maxDate(`${ym}-01`, p.start)
    const end = minDate(endOfMonth(`${ym}-01`), asOf)
    for (const inv of repInvoices) {
      if (!inv.paidAt || inv.paidAt < start || inv.paidAt > end) continue
      lines.push({
        id: `paid-${inv.id}`,
        repId,
        kind: 'paid',
        dealId: inv.dealId,
        invoiceId: inv.id,
        institutionId: inv.institutionId,
        date: inv.paidAt,
        amount: inv.amount,
        rate,
        coefficient: coef,
        commission: inv.amount * rate * coef,
      })
    }
  }

  for (const inv of repInvoices) {
    if (inv.issuedAt > asOf || (inv.paidAt !== null && inv.paidAt <= asOf)) continue
    lines.push({
      id: `unpaid-${inv.id}`,
      repId,
      kind: 'unpaid',
      dealId: inv.dealId,
      invoiceId: inv.id,
      institutionId: inv.institutionId,
      date: inv.issuedAt,
      amount: inv.amount,
      rate,
      coefficient: lastCoef,
      commission: inv.amount * rate * lastCoef,
    })
  }

  const lookbackStart = addDays(asOf, -PENDING_LOOKBACK_DAYS)
  for (const d of ds.deals) {
    if (d.ownerId !== repId || d.stage !== 'Vyhráno' || !d.closedAt) continue
    if (d.closedAt > asOf || d.closedAt < lookbackStart) continue
    const invoicedSoFar = sum(
      (lk.invoicesByDeal.get(d.id) ?? []).filter((i) => i.issuedAt <= asOf),
      (i) => i.amount,
    )
    const remainder = d.value - invoicedSoFar
    if (remainder <= 0) continue
    lines.push({
      id: `uninvoiced-${d.id}`,
      repId,
      kind: 'uninvoiced',
      dealId: d.id,
      invoiceId: null,
      institutionId: d.institutionId,
      date: d.closedAt,
      amount: remainder,
      rate,
      coefficient: lastCoef,
      commission: remainder * rate * lastCoef,
    })
  }

  const paid = lines.filter((l) => l.kind === 'paid')
  const payable = sum(paid, (l) => l.commission)
  const pending = sum(lines.filter((l) => l.kind !== 'paid'), (l) => l.commission)
  const paidRevenue = sum(paid, (l) => l.amount)
  const attainment =
    months.length === 1 ? monthAttainment(ds, months[0], { ownerId: repId }) : periodPace(ds, p, repId)
  return {
    repId,
    name: rep.name,
    role: rep.role,
    rate,
    paidRevenue,
    attainment,
    coefficient: paidRevenue ? payable / (paidRevenue * rate) : lastCoef,
    payable,
    pending,
    accrued: payable + pending,
    lines,
  }
}

function periodPace(ds: Dataset, p: Period, repId: string): number | null {
  const r = { start: p.start, end: p.asOf }
  const plan = planFor(ds, r, { ownerId: repId })
  return plan ? revenueWon(ds, r, { ownerId: repId }) / plan : null
}

export function commissionSummary(ds: Dataset, p: Period): CommissionSummary {
  const reps = ds.salespeople.map((s) => repCommission(ds, p, s.id))
  return {
    reps,
    payable: sum(reps, (r) => r.payable),
    pending: sum(reps, (r) => r.pending),
    accrued: sum(reps, (r) => r.accrued),
    paidRevenue: sum(reps, (r) => r.paidRevenue),
  }
}
