import type { Dataset } from '../data/types'
import { collected, invoiced, unmatchedPayments } from './money'
import { revenueWon, sum } from './sales'

export interface ReconcileRow {
  source: string
  system: string
  label: string
  sourceCount: number
  sourceValue: number
  dashboardValue: number
  ok: boolean
}

/**
 * Raw totals per source system next to the same totals computed through the metric layer
 * over the whole history. Any difference means a metric filters or double-counts records.
 */
export function reconcile(ds: Dataset) {
  const all = { start: ds.historyStart, end: ds.today }
  const won = ds.deals.filter((d) => d.stage === 'Vyhráno')
  const paid = ds.invoices.filter((i) => i.paidAt)
  const matched = ds.payments.filter((p) => p.matchedInvoiceId)
  const unmatched = unmatchedPayments(ds)

  const rows: ReconcileRow[] = [
    {
      source: 'Pipedrive',
      system: 'CRM',
      label: 'Vyhrané dealy',
      sourceCount: won.length,
      sourceValue: sum(won, (d) => d.value),
      dashboardValue: revenueWon(ds, all),
      ok: false,
    },
    {
      source: 'iDoklad',
      system: 'Fakturace',
      label: 'Vystavené faktury',
      sourceCount: ds.invoices.length,
      sourceValue: sum(ds.invoices, (i) => i.amount),
      dashboardValue: invoiced(ds, all),
      ok: false,
    },
    {
      source: 'iDoklad',
      system: 'Fakturace',
      label: 'Uhrazené faktury',
      sourceCount: paid.length,
      sourceValue: sum(paid, (i) => i.amount),
      dashboardValue: collected(ds, all),
      ok: false,
    },
    {
      source: 'Banka',
      system: 'Bankovní API',
      label: 'Spárované platby',
      sourceCount: matched.length,
      sourceValue: sum(matched, (p) => p.amount),
      dashboardValue: collected(ds, all),
      ok: false,
    },
  ]
  for (const r of rows) r.ok = Math.abs(r.sourceValue - r.dashboardValue) < 0.5

  return {
    rows,
    unmatchedCount: unmatched.length,
    unmatchedValue: sum(unmatched, (p) => p.amount),
    totalPayments: ds.payments.length,
    openDeals: ds.deals.filter((d) => d.closedAt === null).length,
    lostDeals: ds.deals.filter((d) => d.stage === 'Prohráno').length,
  }
}
