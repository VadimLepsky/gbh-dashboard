import { describe, expect, it } from 'vitest'
import { generateDataset } from '../../data/generate'
import { getDataset, scopeDataset } from '../../data'
import { diffDays } from '../../data/dates'
import { commissionSummary, repCommission } from '../commissions'
import { buildContext } from '../context'
import { resolveDrill } from '../drill'
import type { DrillRequest } from '../drill-types'
import { collected, invoiced, overdue, receivables } from '../money'
import { monthPeriod, quarterPeriod, yearPeriod, type Period } from '../period'
import { reconcile } from '../reconcile'
import { forecast, openDeals, planFor, revenueWon, sum } from '../sales'
import { activitiesDone, activityTarget } from '../team'

const TODAY = '2026-10-19'
const ds = getDataset(TODAY)

const periods: Period[] = [
  monthPeriod('2026-10', TODAY),
  monthPeriod('2026-09', TODAY),
  quarterPeriod(2026, 3, TODAY),
  yearPeriod(2026, TODAY),
]

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.01)

describe('generator', () => {
  it('is deterministic within a day', () => {
    const a = generateDataset(TODAY)
    const b = generateDataset(TODAY)
    expect(a.deals.length).toBe(b.deals.length)
    expect(sum(a.deals, (d) => d.value)).toBe(sum(b.deals, (d) => d.value))
    expect(sum(a.invoices, (i) => i.amount)).toBe(sum(b.invoices, (i) => i.amount))
    expect(a.activities.length).toBe(b.activities.length)
  })

  it('generates fast enough for a request', () => {
    generateDataset('2026-05-02')
    const t = performance.now()
    generateDataset('2026-05-03')
    expect(performance.now() - t).toBeLessThan(400)
  })

  it('keeps realistic volumes', () => {
    const sep = { start: '2026-09-01', end: '2026-09-30' }
    const calls = activitiesDone(ds, sep).filter((a) => a.type === 'hovor' && !a.dealId).length
    expect(calls).toBeGreaterThan(850)
    expect(calls).toBeLessThan(1400)
    expect(openDeals(ds).length).toBeGreaterThan(50)
  })

  it('has consistent dates', () => {
    for (const i of ds.invoices) {
      expect(i.dueAt > i.issuedAt).toBe(true)
      if (i.paidAt) expect(i.paidAt >= i.issuedAt).toBe(true)
      expect(i.issuedAt <= TODAY).toBe(true)
    }
    for (const d of ds.deals) {
      expect(d.createdAt <= TODAY).toBe(true)
      for (let k = 1; k < d.stageHistory.length; k++)
        expect(d.stageHistory[k].enteredAt >= d.stageHistory[k - 1].enteredAt).toBe(true)
      if (d.closedAt) expect(d.closedAt).toBe(d.stageHistory[d.stageHistory.length - 1].enteredAt)
    }
  })
})

describe('totals reconcile', () => {
  it.each(periods.map((p) => [p.label, p] as const))('sum across reps = company total (%s)', (_l, p) => {
    const reps = ds.salespeople
    close(sum(reps, (r) => revenueWon(ds, p, { ownerId: r.id })), revenueWon(ds, p))
    close(sum(reps, (r) => planFor(ds, p, { ownerId: r.id })), planFor(ds, p))
    close(sum(reps, (r) => activitiesDone(ds, p, { ownerId: r.id }).length), activitiesDone(ds, p).length)
    close(sum(reps, (r) => activityTarget(ds, p, { ownerId: r.id })), activityTarget(ds, p))
    close(sum(ds.teams, (t) => revenueWon(ds, p, { teamId: t.id })), revenueWon(ds, p))
    close(sum(ds.teams, (t) => forecast(ds, p, { teamId: t.id }).total), forecast(ds, p).total)
  })

  it.each(periods.map((p) => [p.label, p] as const))('commissions: reps = company, payable + pending = accrued (%s)', (_l, p) => {
    const s = commissionSummary(ds, p)
    close(s.payable + s.pending, s.accrued)
    for (const r of s.reps) close(r.payable + r.pending, r.accrued)
    close(sum(s.reps, (r) => r.payable), s.payable)
    // Same numbers whether computed for one rep or for the whole company
    for (const r of s.reps) close(repCommission(ds, p, r.repId).payable, r.payable)
    // Team view (scoped dataset) = the team's reps in the company view
    const morava = commissionSummary(scopeDataset(ds, 'morava'), p)
    const moravaIds = new Set(ds.salespeople.filter((x) => x.teamId === 'morava').map((x) => x.id))
    close(morava.payable, sum(s.reps.filter((r) => moravaIds.has(r.repId)), (r) => r.payable))
    close(morava.pending, sum(s.reps.filter((r) => moravaIds.has(r.repId)), (r) => r.pending))
  })

  it('role scope = filter on the full dataset', () => {
    const p = periods[3]
    const morava = scopeDataset(ds, 'morava')
    close(revenueWon(morava, p), revenueWon(ds, p, { teamId: 'morava' }))
    const novak = scopeDataset(ds, 'novak')
    close(revenueWon(novak, p), revenueWon(ds, p, { ownerId: 'jnovak' }))
    expect(novak.salespeople.map((s) => s.id)).toEqual(['jnovak'])
  })

  it('invoices never exceed the contract, invoiced ≥ collected', () => {
    const all = { start: ds.historyStart, end: TODAY }
    expect(invoiced(ds, all)).toBeGreaterThanOrEqual(collected(ds, all))
    const byDeal = new Map<string, number>()
    for (const i of ds.invoices) byDeal.set(i.dealId, (byDeal.get(i.dealId) ?? 0) + i.amount)
    for (const d of ds.deals) if (byDeal.has(d.id)) expect(byDeal.get(d.id)!).toBeLessThanOrEqual(d.value)
    for (const p of periods) expect(receivables(ds, p.asOf)).toBeGreaterThanOrEqual(overdue(ds, p.asOf))
  })

  it('source systems reconcile with dashboard totals', () => {
    const r = reconcile(ds)
    for (const row of r.rows) expect(row.ok, row.id).toBe(true)
    expect(r.unmatchedCount).toBeGreaterThanOrEqual(2)
  })
})

describe('drill-down sum = KPI', () => {
  const ctx = buildContext({ period: '2026-10' }, TODAY)
  const p = ctx.period
  const cases: [string, DrillRequest, number][] = [
    ['revenue_won', { metric: 'revenue_won' }, revenueWon(ds, p)],
    ['revenue_won month', { metric: 'revenue_won', filters: { month: '2026-03' } }, revenueWon(ds, monthPeriod('2026-03', TODAY))],
    ['invoiced', { metric: 'invoiced' }, invoiced(ds, p)],
    ['collected', { metric: 'collected' }, collected(ds, p)],
    ['overdue', { metric: 'overdue' }, overdue(ds, p.asOf)],
    ['receivables', { metric: 'receivables' }, receivables(ds, p.asOf)],
    ['pipeline', { metric: 'pipeline' }, sum(openDeals(ds), (d) => d.value)],
    ['weighted_forecast', { metric: 'weighted_forecast' }, forecast(ds, p).total],
    ['commission_payable', { metric: 'commission_payable' }, commissionSummary(ds, p).payable],
    ['commission_pending', { metric: 'commission_pending' }, commissionSummary(ds, p).pending],
    ['revenue_won rep', { metric: 'revenue_won', filters: { ownerId: 'phorak' } }, revenueWon(ds, p, { ownerId: 'phorak' })],
  ]
  it.each(cases)('%s', (_name, req, expected) => {
    const res = resolveDrill(ctx, req)
    close(res.total.value ?? 0, expected)
    expect(res.truncated).toBe(false)
    if (res.sumKey) close(sum(res.rows, (r) => Number(r.cells[res.sumKey!] ?? 0)), expected)
  })

  it('year view drill-down also adds up', () => {
    const y = buildContext({ period: '2026' }, TODAY)
    const res = resolveDrill(y, { metric: 'revenue_won' })
    close(sum(res.rows, (r) => Number(r.cells.value)), revenueWon(ds, y.period))
  })
})

describe('story hooks', () => {
  const days = ['2026-10-19', '2026-01-05', '2026-07-31', '2027-03-15']
  it.each(days)('all present on %s', (today) => {
    const ctx = buildContext({}, today)
    const d = ctx.ds
    const ex = resolveExceptions(ctx)

    // 1. Big deal stuck in Vyjednávání 40+ days without next step
    expect(
      d.deals.some(
        (x) => !x.closedAt && x.value >= 900_000 && x.stage === 'Vyjednávání' && x.nextStepAt === null &&
          diffDays(x.stageHistory[x.stageHistory.length - 1].enteredAt, today) >= 40,
      ),
    ).toBe(true)
    // 2. Invoice ~120k, 21 days overdue
    expect(d.invoices.some((i) => !i.paidAt && Math.abs(i.amount - 120_000) <= 8_000 && diffDays(i.dueAt, today) === 21)).toBe(true)
    // 3. Annual contract 400k+ expiring in 45 days with no renewal
    expect(d.contracts.some((c) => c.recurring && c.annualValue >= 400_000 && diffDays(today, c.endAt) === 45 && !c.renewalDealId)).toBe(true)
    // 4. Contract sent 9 days ago, unsigned
    expect(d.contracts.some((c) => !c.signedAt && diffDays(c.sentForSignatureAt, today) === 9)).toBe(true)
    // 5. Tender with deadline in 5 days in preparation
    expect(d.tenders.some((t) => t.status === 'příprava' && diffDays(today, t.submissionDeadline) === 5)).toBe(true)
    // 6. Junior with 6+ overdue follow-ups
    const juniors = d.salespeople.filter((s) => s.role === 'Junior')
    expect(juniors.some((j) => d.activities.filter((a) => a.ownerId === j.id && !a.doneAt && a.dueAt < today).length >= 6)).toBe(true)
    // 7. Two unmatched bank payments
    expect(d.payments.filter((p) => !p.matchedInvoiceId).length).toBeGreaterThanOrEqual(2)

    const types = new Set(ex.map((e) => e.type))
    for (const t of ['stuck_deal', 'overdue_invoice', 'renewal_risk', 'unsigned_contract', 'tender_deadline', 'overdue_followups', 'unmatched_payment', 'low_activity'])
      expect(types.has(t as never), t).toBe(true)
  })
})

import { exceptions } from '../exceptions'
function resolveExceptions(ctx: ReturnType<typeof buildContext>) {
  return exceptions(ctx.ds, ctx.full)
}
