import type {
  Activity,
  Contract,
  Dataset,
  Deal,
  Institution,
  Invoice,
  Kraj,
  LeadSource,
  Product,
  Salesperson,
  Tender,
} from '../data/types'
import { getI18n, type I18n } from '../i18n'

export interface Lookup {
  deal: Map<string, Deal>
  institution: Map<string, Institution>
  rep: Map<string, Salesperson>
  product: Map<string, Product>
  source: Map<string, LeadSource>
  kraj: Map<string, Kraj>
  contract: Map<string, Contract>
  contractsByDeal: Map<string, Contract[]>
  invoice: Map<string, Invoice>
  invoicesByDeal: Map<string, Invoice[]>
  invoicesByContract: Map<string, Invoice[]>
  tenderByDeal: Map<string, Tender>
  activitiesByDeal: Map<string, Activity[]>
}

const cache = new WeakMap<Dataset, Lookup>()

function group<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (k === null) continue
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

export function lookup(ds: Dataset): Lookup {
  const hit = cache.get(ds)
  if (hit) return hit
  const lk: Lookup = {
    deal: new Map(ds.deals.map((d) => [d.id, d])),
    institution: new Map(ds.institutions.map((i) => [i.id, i])),
    rep: new Map(ds.salespeople.map((s) => [s.id, s])),
    product: new Map(ds.products.map((p) => [p.id, p])),
    source: new Map(ds.sources.map((s) => [s.id, s])),
    kraj: new Map(ds.kraje.map((k) => [k.id, k])),
    contract: new Map(ds.contracts.map((c) => [c.id, c])),
    contractsByDeal: group(ds.contracts, (c) => c.dealId),
    invoice: new Map(ds.invoices.map((i) => [i.id, i])),
    invoicesByDeal: group(ds.invoices, (i) => i.dealId),
    invoicesByContract: group(ds.invoices, (i) => i.contractId),
    tenderByDeal: new Map(ds.tenders.filter((t) => t.dealId).map((t) => [t.dealId!, t])),
    activitiesByDeal: group(ds.activities, (a) => a.dealId),
  }
  cache.set(ds, lk)
  return lk
}

/** Institution (proper name, kept as is) · product short name in the given language. */
export function dealName(ds: Dataset, deal: Deal, i18n: I18n = getI18n()): string {
  const lk = lookup(ds)
  return `${lk.institution.get(deal.institutionId)?.name ?? '?'} · ${i18n.term('productShort', deal.productId)}`
}

export function repName(ds: Dataset, id: string | null | undefined): string {
  if (!id) return '—'
  return lookup(ds).rep.get(id)?.name ?? '—'
}

export function institutionName(ds: Dataset, id: string): string {
  return lookup(ds).institution.get(id)?.name ?? '?'
}
