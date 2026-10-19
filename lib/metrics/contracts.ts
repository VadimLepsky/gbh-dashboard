import { addDays, diffDays } from '../data/dates'
import type { Contract, Dataset, Deal, Tender } from '../data/types'
import { lookup } from './lookup'
import { stageProbability } from './sales'

export type RenewalStatus = 'bez-obnovy' | 'v-jednani' | 'obnoveno' | 'ztraceno'

export const RENEWAL_STATUS_LABEL: Record<RenewalStatus, string> = {
  'bez-obnovy': 'Bez obnovy',
  'v-jednani': 'V jednání',
  obnoveno: 'Obnoveno',
  ztraceno: 'Ztraceno',
}

export interface RenewalRow {
  contract: Contract
  daysLeft: number
  status: RenewalStatus
  renewalDeal: Deal | null
  atRisk: number
}

export function renewalStatus(ds: Dataset, c: Contract): { status: RenewalStatus; deal: Deal | null } {
  const deal = c.renewalDealId ? lookup(ds).deal.get(c.renewalDealId) ?? null : null
  if (!deal) return { status: 'bez-obnovy', deal: null }
  if (deal.stage === 'Vyhráno') return { status: 'obnoveno', deal }
  if (deal.stage === 'Prohráno') return { status: 'ztraceno', deal }
  return { status: 'v-jednani', deal }
}

/** Recurring contracts ending in the next `days` days. Kč at risk = value not yet secured. */
export function upcomingRenewals(ds: Dataset, days = 90): RenewalRow[] {
  const limit = addDays(ds.today, days)
  return ds.contracts
    .filter((c) => c.recurring && c.endAt >= ds.today && c.endAt <= limit)
    .map((c) => {
      const { status, deal } = renewalStatus(ds, c)
      const atRisk =
        status === 'obnoveno' ? 0
        : status === 'v-jednani' && deal ? c.annualValue * (1 - stageProbability(deal.stage))
        : c.annualValue
      return { contract: c, daysLeft: diffDays(ds.today, c.endAt), status, renewalDeal: deal, atRisk }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

/** Share of recurring contracts that ended in the last 12 months and were renewed. */
export function renewalRate(ds: Dataset): { rate: number | null; renewed: number; ended: number; contracts: Contract[] } {
  const from = addDays(ds.today, -365)
  const ended = ds.contracts.filter((c) => c.recurring && c.endAt >= from && c.endAt < ds.today)
  const renewed = ended.filter((c) => renewalStatus(ds, c).status === 'obnoveno')
  return { rate: ended.length ? renewed.length / ended.length : null, renewed: renewed.length, ended: ended.length, contracts: ended }
}

export const TENDER_ORDER: Record<Tender['status'], number> = { příprava: 0, podáno: 1, vyhráno: 2, prohráno: 3 }

export function activeTenders(ds: Dataset): Tender[] {
  return ds.tenders
    .filter((t) => t.status === 'příprava' || t.status === 'podáno')
    .sort((a, b) => (a.submissionDeadline < b.submissionDeadline ? -1 : 1))
}

/** Decided tenders (won or lost) whose deal closed in the last 12 months. */
export function tenderWinRate(ds: Dataset): { rate: number | null; won: number; lost: number } {
  const from = addDays(ds.today, -365)
  const lk = lookup(ds)
  const decided = ds.tenders.filter((t) => {
    if (t.status !== 'vyhráno' && t.status !== 'prohráno') return false
    const closed = t.dealId ? lk.deal.get(t.dealId)?.closedAt : null
    return !!closed && closed >= from
  })
  const won = decided.filter((t) => t.status === 'vyhráno').length
  return { rate: decided.length ? won / decided.length : null, won, lost: decided.length - won }
}
