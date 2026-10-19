import { daysInMonth, diffDays, maxDate, minDate, toDay } from '../data/dates'
import { STAGE_PROBABILITY } from '../data/reference'
import type { Dataset, Deal, ISODate, Stage } from '../data/types'
import { lookup } from './lookup'
import { inRange, monthsOf, type DateRange, type Period } from './period'

export interface DealFilter {
  ownerId?: string
  teamId?: string
  sourceId?: string
  productId?: string
  kraj?: string
  institutionType?: string
}

export function matchDeal(ds: Dataset, d: Deal, f?: DealFilter): boolean {
  if (!f) return true
  if (f.ownerId && d.ownerId !== f.ownerId) return false
  if (f.sourceId && d.sourceId !== f.sourceId) return false
  if (f.productId && d.productId !== f.productId) return false
  const lk = lookup(ds)
  if (f.teamId && lk.rep.get(d.ownerId)?.teamId !== f.teamId) return false
  if (f.kraj || f.institutionType) {
    const inst = lk.institution.get(d.institutionId)
    if (f.kraj && inst?.kraj !== f.kraj) return false
    if (f.institutionType && inst?.type !== f.institutionType) return false
  }
  return true
}

export const sum = <T>(items: T[], pick: (t: T) => number) => items.reduce((acc, t) => acc + pick(t), 0)

export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function isOpen(d: Deal): boolean {
  return d.closedAt === null
}

export function stageProbability(stage: Stage): number {
  return STAGE_PROBABILITY[stage]
}

// ── Won / lost ──────────────────────────────────────────────────────────────

export function wonDeals(ds: Dataset, r: DateRange, f?: DealFilter): Deal[] {
  return ds.deals.filter((d) => d.stage === 'Vyhráno' && inRange(d.closedAt, r) && matchDeal(ds, d, f))
}

export function lostDeals(ds: Dataset, r: DateRange, f?: DealFilter): Deal[] {
  return ds.deals.filter((d) => d.stage === 'Prohráno' && inRange(d.closedAt, r) && matchDeal(ds, d, f))
}

export function revenueWon(ds: Dataset, r: DateRange, f?: DealFilter): number {
  return sum(wonDeals(ds, r, f), (d) => d.value)
}

export function winRate(ds: Dataset, r: DateRange, f?: DealFilter): number | null {
  const w = wonDeals(ds, r, f).length
  const l = lostDeals(ds, r, f).length
  return w + l ? w / (w + l) : null
}

export function cycleDays(deal: Deal): number {
  return diffDays(deal.createdAt, deal.closedAt!)
}

export function medianCycle(ds: Dataset, r: DateRange, f?: DealFilter): number | null {
  return median(wonDeals(ds, r, f).map(cycleDays))
}

export function avgDeal(ds: Dataset, r: DateRange, f?: DealFilter): number | null {
  const won = wonDeals(ds, r, f)
  return won.length ? sum(won, (d) => d.value) / won.length : null
}

export function dealCost(ds: Dataset, d: Deal): number {
  return d.value * (lookup(ds).product.get(d.productId)?.unitCostShare ?? 0)
}

export function grossMargin(ds: Dataset, r: DateRange, f?: DealFilter): number | null {
  const won = wonDeals(ds, r, f)
  const revenue = sum(won, (d) => d.value)
  if (!revenue) return null
  return (revenue - sum(won, (d) => dealCost(ds, d))) / revenue
}

// ── Plan ────────────────────────────────────────────────────────────────────

/** Σ monthly quota × share of each month covered by the range (only months after the rep started). */
export function planFor(ds: Dataset, r: DateRange, f?: { ownerId?: string; teamId?: string }): number {
  let total = 0
  const people = ds.salespeople.filter(
    (p) => (!f?.ownerId || p.id === f.ownerId) && (!f?.teamId || p.teamId === f.teamId),
  )
  for (const ym of monthsOf(r)) {
    const first = `${ym}-01`
    const dim = daysInMonth(ym)
    const last = `${ym}-${String(dim).padStart(2, '0')}`
    const covered = diffDays(maxDate(first, r.start), minDate(last, r.end)) + 1
    if (covered <= 0) continue
    for (const p of people) {
      if (p.startDate.slice(0, 7) > ym) continue
      total += (p.monthlyQuota * covered) / dim
    }
  }
  return total
}

export function attainment(ds: Dataset, r: DateRange, f?: DealFilter): number | null {
  const plan = planFor(ds, r, f)
  return plan ? revenueWon(ds, r, f) / plan : null
}

/** Plan prorated to the elapsed part of a running period (used for coefficients and heat). */
export function proratedPlan(ds: Dataset, p: Period, f?: { ownerId?: string; teamId?: string }): number {
  return planFor(ds, { start: p.start, end: p.asOf }, f)
}

// ── Pipeline ────────────────────────────────────────────────────────────────

export function stageAt(d: Deal, asOf: ISODate): Stage | null {
  let stage: Stage | null = null
  for (const h of d.stageHistory) {
    if (h.enteredAt <= asOf) stage = h.stage
    else break
  }
  return stage
}

/** Open deals as of a date, reconstructed from the stage history. */
export function openDealsAt(ds: Dataset, asOf: ISODate, f?: DealFilter): Deal[] {
  return ds.deals.filter(
    (d) => d.createdAt <= asOf && (d.closedAt === null || d.closedAt > asOf) && matchDeal(ds, d, f),
  )
}

export function openDeals(ds: Dataset, f?: DealFilter): Deal[] {
  return ds.deals.filter((d) => d.closedAt === null && matchDeal(ds, d, f))
}

export function pipelineValue(ds: Dataset, asOf: ISODate, f?: DealFilter): number {
  return sum(openDealsAt(ds, asOf, f), (d) => d.value)
}

/** Open deals (today) expected to close inside the period. */
export function closingInPeriod(ds: Dataset, p: DateRange, f?: DealFilter): Deal[] {
  return openDeals(ds, f).filter((d) => inRange(d.expectedCloseAt, p))
}

export function weightedValue(d: Deal): number {
  return d.value * stageProbability(d.stage)
}

export interface Forecast {
  won: number
  weighted: number
  total: number
  plan: number
  gap: number
  pipelineClosing: number
  coverage: number | null
}

export function forecast(ds: Dataset, p: Period, f?: DealFilter): Forecast {
  const won = revenueWon(ds, p, f)
  const plan = planFor(ds, p, f)
  const closing = p.end >= ds.today ? closingInPeriod(ds, p, f) : []
  const weighted = sum(closing, weightedValue)
  const pipelineClosing = sum(closing, (d) => d.value)
  const remaining = plan - won
  return {
    won,
    weighted,
    total: won + weighted,
    plan,
    gap: plan - (won + weighted),
    pipelineClosing,
    coverage: remaining > 0 ? pipelineClosing / remaining : null,
  }
}

// ── Stage durations ────────────────────────────────────────────────────────

export interface StageSpan {
  deal: Deal
  stage: Stage
  enteredAt: ISODate
  leftAt: ISODate | null
  /** What happened when the deal left the stage. */
  outcome: 'advanced' | 'lost' | 'won' | 'open'
}

export function stageSpans(d: Deal): StageSpan[] {
  const spans: StageSpan[] = []
  for (let i = 0; i < d.stageHistory.length; i++) {
    const h = d.stageHistory[i]
    if (h.stage === 'Vyhráno' || h.stage === 'Prohráno') break
    const next = d.stageHistory[i + 1]
    spans.push({
      deal: d,
      stage: h.stage,
      enteredAt: h.enteredAt,
      leftAt: next?.enteredAt ?? null,
      outcome: !next ? 'open' : next.stage === 'Prohráno' ? 'lost' : next.stage === 'Vyhráno' ? 'won' : 'advanced',
    })
  }
  return spans
}

const medianCache = new WeakMap<Dataset, Map<string, number>>()

/** Median days in each stage, computed from deals that already left it. Tenders separately. */
export function stageMedians(ds: Dataset): Map<string, number> {
  const hit = medianCache.get(ds)
  if (hit) return hit
  const buckets = new Map<string, number[]>()
  for (const d of ds.deals) {
    const track = d.sourceId === 'tender' ? 'tender' : 'std'
    for (const s of stageSpans(d)) {
      if (!s.leftAt) continue
      const key = `${s.stage}|${track}`
      const list = buckets.get(key) ?? []
      list.push(diffDays(s.enteredAt, s.leftAt))
      buckets.set(key, list)
    }
  }
  const out = new Map<string, number>()
  for (const [k, v] of buckets) out.set(k, Math.max(1, median(v) ?? 1))
  medianCache.set(ds, out)
  return out
}

export function medianForDeal(ds: Dataset, d: Deal): number {
  return stageMedians(ds).get(`${d.stage}|${d.sourceId === 'tender' ? 'tender' : 'std'}`) ?? 10
}

export function daysInStage(d: Deal, today: ISODate): number {
  const last = d.stageHistory[d.stageHistory.length - 1]
  return toDay(today) - toDay(last.enteredAt)
}

/** A deal is stuck after this many typical stage durations. */
export const STUCK_FACTOR = 2

export function isStuck(ds: Dataset, d: Deal): boolean {
  return isOpen(d) && daysInStage(d, ds.today) > STUCK_FACTOR * medianForDeal(ds, d)
}

export function stuckDeals(ds: Dataset, f?: DealFilter): Deal[] {
  return openDeals(ds, f).filter((d) => isStuck(ds, d))
}

export function hasNoNextStep(d: Deal, today: ISODate): boolean {
  return isOpen(d) && (d.nextStepAt === null || d.nextStepAt < today)
}

export function dealsWithoutNextStep(ds: Dataset, f?: DealFilter): Deal[] {
  return openDeals(ds, f).filter((d) => hasNoNextStep(d, ds.today))
}
