import { addDays, diffDays } from '../data/dates'
import { paymentCandidates } from '../data/match'
import type { BankPayment, Contract, Dataset, Deal, ISODate, Invoice } from '../data/types'
import { lookup } from './lookup'
import { inRange, type DateRange } from './period'
import { dealCost, median, sum, wonDeals } from './sales'

export interface InvoiceFilter {
  ownerId?: string
  teamId?: string
  institutionId?: string
  productId?: string
}

export function matchInvoice(ds: Dataset, inv: Invoice, f?: InvoiceFilter): boolean {
  if (!f) return true
  if (f.ownerId && inv.ownerId !== f.ownerId) return false
  if (f.institutionId && inv.institutionId !== f.institutionId) return false
  const lk = lookup(ds)
  if (f.teamId && lk.rep.get(inv.ownerId)?.teamId !== f.teamId) return false
  if (f.productId && lk.deal.get(inv.dealId)?.productId !== f.productId) return false
  return true
}

export function issuedInvoices(ds: Dataset, r: DateRange, f?: InvoiceFilter): Invoice[] {
  return ds.invoices.filter((i) => inRange(i.issuedAt, r) && matchInvoice(ds, i, f))
}

export function paidInvoices(ds: Dataset, r: DateRange, f?: InvoiceFilter): Invoice[] {
  return ds.invoices.filter((i) => inRange(i.paidAt, r) && matchInvoice(ds, i, f))
}

export const invoiced = (ds: Dataset, r: DateRange, f?: InvoiceFilter) => sum(issuedInvoices(ds, r, f), (i) => i.amount)
export const collected = (ds: Dataset, r: DateRange, f?: InvoiceFilter) => sum(paidInvoices(ds, r, f), (i) => i.amount)

export function isUnpaidAt(inv: Invoice, asOf: ISODate): boolean {
  return inv.issuedAt <= asOf && (inv.paidAt === null || inv.paidAt > asOf)
}

export function receivableInvoices(ds: Dataset, asOf: ISODate, f?: InvoiceFilter): Invoice[] {
  return ds.invoices.filter((i) => isUnpaidAt(i, asOf) && matchInvoice(ds, i, f))
}

export function overdueInvoices(ds: Dataset, asOf: ISODate, f?: InvoiceFilter): Invoice[] {
  return receivableInvoices(ds, asOf, f).filter((i) => i.dueAt < asOf)
}

export const receivables = (ds: Dataset, asOf: ISODate, f?: InvoiceFilter) => sum(receivableInvoices(ds, asOf, f), (i) => i.amount)
export const overdue = (ds: Dataset, asOf: ISODate, f?: InvoiceFilter) => sum(overdueInvoices(ds, asOf, f), (i) => i.amount)

export function daysOverdue(inv: Invoice, asOf: ISODate): number {
  return Math.max(0, diffDays(inv.dueAt, asOf))
}

export function dso(ds: Dataset, r: DateRange, f?: InvoiceFilter): number | null {
  const paid = paidInvoices(ds, r, f)
  if (!paid.length) return null
  return sum(paid, (i) => diffDays(i.issuedAt, i.paidAt!)) / paid.length
}

// ── Aging ───────────────────────────────────────────────────────────────────

export const AGING_BUCKETS = [
  { id: 'current', label: 'Ve splatnosti', min: -Infinity, max: 0 },
  { id: '1-30', label: '1–30 dní', min: 1, max: 30 },
  { id: '31-60', label: '31–60 dní', min: 31, max: 60 },
  { id: '60+', label: '60+ dní', min: 61, max: Infinity },
] as const

export type AgingBucketId = (typeof AGING_BUCKETS)[number]['id']

export function agingBucket(inv: Invoice, asOf: ISODate): AgingBucketId {
  const late = diffDays(inv.dueAt, asOf)
  return AGING_BUCKETS.find((b) => late >= b.min && late <= b.max)!.id
}

export interface AgingRow {
  institutionId: string
  name: string
  ownerId: string
  buckets: Record<AgingBucketId, number>
  total: number
}

export function aging(ds: Dataset, asOf: ISODate) {
  const open = receivableInvoices(ds, asOf)
  const totals: Record<AgingBucketId, number> = { current: 0, '1-30': 0, '31-60': 0, '60+': 0 }
  const rows = new Map<string, AgingRow>()
  const lk = lookup(ds)
  for (const inv of open) {
    const b = agingBucket(inv, asOf)
    totals[b] += inv.amount
    let row = rows.get(inv.institutionId)
    if (!row) {
      row = {
        institutionId: inv.institutionId,
        name: lk.institution.get(inv.institutionId)?.name ?? '?',
        ownerId: inv.ownerId,
        buckets: { current: 0, '1-30': 0, '31-60': 0, '60+': 0 },
        total: 0,
      }
      rows.set(inv.institutionId, row)
    }
    row.buckets[b] += inv.amount
    row.total += inv.amount
  }
  const lateness = (r: AgingRow) => r.buckets['60+'] * 4 + r.buckets['31-60'] * 3 + r.buckets['1-30'] * 2 + r.buckets.current
  return {
    totals,
    total: sum(open, (i) => i.amount),
    rows: [...rows.values()].sort((a, b) => lateness(b) - lateness(a)),
  }
}

// ── Delivery chain: Vyhráno → Smlouva podepsána → Fakturováno → Uhrazeno ──

export interface ChainStep {
  id: 'won' | 'signed' | 'invoiced' | 'paid'
  label: string
  count: number
  value: number
}

export interface ChainResult {
  steps: ChainStep[]
  waitingSignature: Contract[]
  signedNotInvoiced: Contract[]
  overdueInChain: Invoice[]
}

/** Follows the deals won in the period down the chain, as of today. */
export function deliveryChain(ds: Dataset, r: DateRange): ChainResult {
  const lk = lookup(ds)
  const won = wonDeals(ds, r)
  const contracts = won.flatMap((d) => lk.contractsByDeal.get(d.id)?.slice(0, 1) ?? [])
  const signed = contracts.filter((c) => c.signedAt)
  const invoices = won.flatMap((d) => lk.invoicesByDeal.get(d.id) ?? [])
  const paid = invoices.filter((i) => i.paidAt)
  const invoicedDeals = new Set(invoices.map((i) => i.dealId))
  const paidDeals = new Set(paid.map((i) => i.dealId))
  const today = ds.today
  return {
    steps: [
      { id: 'won', label: 'Vyhráno', count: won.length, value: sum(won, (d) => d.value) },
      { id: 'signed', label: 'Smlouva podepsána', count: signed.length, value: sum(signed, (c) => lk.deal.get(c.dealId)!.value) },
      { id: 'invoiced', label: 'Fakturováno', count: invoicedDeals.size, value: sum(invoices, (i) => i.amount) },
      { id: 'paid', label: 'Uhrazeno', count: paidDeals.size, value: sum(paid, (i) => i.amount) },
    ],
    waitingSignature: contracts.filter((c) => !c.signedAt && diffDays(c.sentForSignatureAt, today) > 7),
    signedNotInvoiced: signed.filter(
      (c) => !(lk.invoicesByContract.get(c.id)?.length) && diffDays(c.signedAt!, today) > 14,
    ),
    overdueInChain: invoices.filter((i) => !i.paidAt && i.dueAt < today),
  }
}

/** Contracts sent for signature more than `days` ago and still unsigned (whole dataset, as of today). */
export function unsignedContracts(ds: Dataset, days = 7): Contract[] {
  return ds.contracts.filter((c) => !c.signedAt && diffDays(c.sentForSignatureAt, ds.today) > days)
}

// ── Products ────────────────────────────────────────────────────────────────

export function productBreakdown(ds: Dataset, r: DateRange) {
  const won = wonDeals(ds, r)
  return ds.products
    .map((p) => {
      const deals = won.filter((d) => d.productId === p.id)
      const revenue = sum(deals, (d) => d.value)
      const cost = sum(deals, (d) => dealCost(ds, d))
      return {
        productId: p.id,
        name: p.name,
        shortName: p.shortName,
        count: deals.length,
        revenue,
        margin: revenue ? (revenue - cost) / revenue : null,
        marginValue: revenue - cost,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

// ── Bank payments ───────────────────────────────────────────────────────────

export function unmatchedPayments(ds: Dataset, r?: DateRange): BankPayment[] {
  return ds.payments.filter((p) => p.matchedInvoiceId === null && (!r || inRange(p.receivedAt, r)))
}

export interface UnmatchedRow {
  payment: BankPayment
  candidate: Invoice | null
  alternatives: number
}

export function unmatchedWithCandidates(ds: Dataset, full: Dataset = ds): UnmatchedRow[] {
  return unmatchedPayments(ds).map((payment) => {
    const candidates = paymentCandidates(full, payment)
    return { payment, candidate: candidates[0] ?? null, alternatives: Math.max(0, candidates.length - 1) }
  })
}

export function manualMatches(ds: Dataset, r: DateRange): BankPayment[] {
  return ds.payments.filter((p) => p.matchMethod === 'manual' && inRange(p.receivedAt, r))
}

export function dueSoon(ds: Dataset, days = 7): Invoice[] {
  const limit = addDays(ds.today, days)
  return ds.invoices.filter((i) => !i.paidAt && i.dueAt >= ds.today && i.dueAt <= limit)
}

export function medianLateness(ds: Dataset, r: DateRange): number | null {
  return median(paidInvoices(ds, r).map((i) => diffDays(i.dueAt, i.paidAt!)))
}

export function dealOfInvoice(ds: Dataset, inv: Invoice): Deal | undefined {
  return lookup(ds).deal.get(inv.dealId)
}
