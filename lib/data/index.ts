import { generateDataset } from './generate'
import { paymentCandidates } from './match'
import { pragueToday } from './dates'
import type { Dataset } from './types'

export type ViewAs = 'reditel' | 'morava' | 'novak'

export const VIEW_AS_OPTIONS: { id: ViewAs; label: string; short: string }[] = [
  { id: 'reditel', label: 'Ředitel obchodu', short: 'Celá firma' },
  { id: 'morava', label: 'Vedoucí týmu Morava', short: 'Tým Morava' },
  { id: 'novak', label: 'Jakub Novák (obchodník)', short: 'Jen moje data' },
]

export function parseViewAs(value: string | undefined | null): ViewAs {
  return value === 'morava' || value === 'novak' ? value : 'reditel'
}

let cache: { day: string; full: Dataset; scoped: Map<ViewAs, Dataset> } | null = null

/** Full dataset for today (Prague time), memoized per server process and day. */
export function getDataset(today: string = pragueToday()): Dataset {
  if (!cache || cache.day !== today) {
    cache = { day: today, full: generateDataset(today), scoped: new Map() }
  }
  return cache.full
}

/** Dataset filtered to what the selected role may see. Metrics never see other data. */
export function getScopedDataset(as: ViewAs, today: string = pragueToday()): Dataset {
  const full = getDataset(today)
  const hit = cache!.scoped.get(as)
  if (hit) return hit
  const scoped = scopeDataset(full, as)
  cache!.scoped.set(as, scoped)
  return scoped
}

export function scopeDataset(full: Dataset, as: ViewAs): Dataset {
  if (as === 'reditel') return full
  const people = full.salespeople.filter((s) =>
    as === 'morava' ? s.teamId === 'morava' : s.id === 'jnovak',
  )
  const ids = new Set(people.map((p) => p.id))
  const invoiceOwner = new Map(full.invoices.map((i) => [i.id, i.ownerId]))
  return {
    ...full,
    teams: full.teams.filter((t) => people.some((p) => p.teamId === t.id)),
    salespeople: people,
    deals: full.deals.filter((d) => ids.has(d.ownerId)),
    activities: full.activities.filter((a) => ids.has(a.ownerId)),
    contracts: full.contracts.filter((c) => ids.has(c.ownerId)),
    invoices: full.invoices.filter((i) => ids.has(i.ownerId)),
    tenders: full.tenders.filter((t) => ids.has(t.ownerId)),
    payments: full.payments.filter((p) => {
      if (p.matchedInvoiceId) return ids.has(invoiceOwner.get(p.matchedInvoiceId) ?? '')
      const candidate = paymentCandidates(full, p)[0]
      return candidate ? ids.has(candidate.ownerId) : false
    }),
  }
}

export type { Dataset } from './types'
