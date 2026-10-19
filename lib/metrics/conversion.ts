import { addDays, diffDays } from '../data/dates'
import { INSTITUTION_TYPES, STAGE_PROBABILITY } from '../data/reference'
import { LOST_REASONS, OPEN_STAGES, type Dataset, type Deal, type LostReason, type OpenStage } from '../data/types'
import { formatDate } from '../format'
import { lookup } from './lookup'
import { inRange, type DateRange, type Period } from './period'
import { cycleDays, lostDeals, matchDeal, median, openDeals, stageSpans, sum, wonDeals, type DealFilter, type StageSpan } from './sales'

/**
 * Conversion needs enough closed stages to be meaningful. Short periods use a trailing
 * 90-day window ending on the period's last day; the UI says so.
 */
export function conversionWindow(p: Period): DateRange & { label: string; widened: boolean } {
  if (diffDays(p.start, p.asOf) >= 89) return { start: p.start, end: p.asOf, label: p.label, widened: false }
  const start = addDays(p.asOf, -89)
  return { start, end: p.asOf, label: `posledních 90 dní (${formatDate(start)} – ${formatDate(p.asOf)})`, widened: true }
}

/** Stage spans that ended (advanced, won or lost) inside the window. */
export function closedSpans(ds: Dataset, r: DateRange, f?: DealFilter): StageSpan[] {
  const out: StageSpan[] = []
  for (const d of ds.deals) {
    if (!matchDeal(ds, d, f)) continue
    for (const s of stageSpans(d)) if (s.leftAt && inRange(s.leftAt, r)) out.push(s)
  }
  return out
}

export interface StageConversion {
  stage: OpenStage
  left: number
  advanced: number
  lost: number
  rate: number | null
  avgDays: number | null
  lostValue: number
}

export function stageConversions(ds: Dataset, r: DateRange, f?: DealFilter): StageConversion[] {
  const spans = closedSpans(ds, r, f)
  return OPEN_STAGES.map((stage) => {
    const list = spans.filter((s) => s.stage === stage)
    const advanced = list.filter((s) => s.outcome === 'advanced' || s.outcome === 'won')
    const lost = list.filter((s) => s.outcome === 'lost')
    return {
      stage,
      left: list.length,
      advanced: advanced.length,
      lost: lost.length,
      rate: list.length ? advanced.length / list.length : null,
      avgDays: list.length ? sum(list, (s) => diffDays(s.enteredAt, s.leftAt!)) / list.length : null,
      lostValue: sum(lost, (s) => s.deal.value),
    }
  })
}

export interface FunnelRow extends StageConversion {
  openCount: number
  openValue: number
}

export function funnel(ds: Dataset, p: Period, f?: DealFilter): FunnelRow[] {
  const open = openDeals(ds, f)
  return stageConversions(ds, conversionWindow(p), f).map((c) => {
    const inStage = open.filter((d) => d.stage === c.stage)
    return { ...c, openCount: inStage.length, openValue: sum(inStage, (d) => d.value) }
  })
}

export interface ConversionMatrixRow {
  key: string
  label: string
  cells: StageConversion[]
  winRate: number | null
  closed: number
}

export function conversionBySource(ds: Dataset, r: DateRange): ConversionMatrixRow[] {
  return ds.sources.map((s) => {
    const f = { sourceId: s.id }
    const won = wonDeals(ds, r, f).length
    const lost = lostDeals(ds, r, f).length
    return {
      key: s.id,
      label: s.name,
      cells: stageConversions(ds, r, f),
      winRate: won + lost ? won / (won + lost) : null,
      closed: won + lost,
    }
  })
}

export interface LostReasonRow {
  reason: LostReason
  count: number
  value: number
}

export function lostByReason(ds: Dataset, r: DateRange): LostReasonRow[] {
  const lost = lostDeals(ds, r)
  return LOST_REASONS.map((reason) => {
    const list = lost.filter((d) => d.lostReason === reason)
    return { reason, count: list.length, value: sum(list, (d) => d.value) }
  }).sort((a, b) => b.value - a.value)
}

export function cycleBy(ds: Dataset, r: DateRange, by: 'source' | 'institutionType') {
  const won = wonDeals(ds, r)
  const lk = lookup(ds)
  const groups =
    by === 'source'
      ? ds.sources.map((s) => ({ key: s.id, label: s.name, deals: won.filter((d) => d.sourceId === s.id) }))
      : INSTITUTION_TYPES.map((t) => ({
          key: t,
          label: t,
          deals: won.filter((d) => lk.institution.get(d.institutionId)?.type === t),
        }))
  return groups
    .map((g) => ({ key: g.key, label: g.label, count: g.deals.length, median: median(g.deals.map(cycleDays)) }))
    .filter((g) => g.count > 0)
}

// ── Leaks: where we lose the most money against the average ──────────────

export interface Leak {
  id: string
  dimension: 'source' | 'owner'
  stage: OpenStage
  key: string
  label: string
  left: number
  rate: number
  avgRate: number
  /** Expected revenue lost against the average conversion of the stage. */
  amount: number
  ownerId: string | null
  topReason: LostReason | null
  action: string
}

const ACTION: Record<OpenStage, Partial<Record<LostReason | 'default', string>>> = {
  Kontakt: {
    'Bez odezvy': 'Zpřísnit kvalifikaci leadů a zavést sekvenci 3 kontaktů do 10 dní.',
    default: 'Projít zdroj leadů s marketingem, upravit cílení a skript prvního hovoru.',
  },
  Kvalifikace: {
    'Rozpočet zmrazen': 'Ověřovat rozpočet a termín čerpání už při prvním hovoru (BANT).',
    default: 'Doplnit kvalifikační checklist: rozhodovatel, rozpočet, termín.',
  },
  Nabídka: {
    Cena: 'Nabízet dvě cenové varianty a referenční cenu podobného úřadu.',
    'Vybrán konkurent': 'Ke každé nabídce přidat srovnání s konkurencí a reference z regionu.',
    default: 'Revize šablony nabídky s vedoucím týmu, follow-up do 3 dní po odeslání.',
  },
  Vyjednávání: {
    Cena: 'Koučink vyjednávání; slevu schvaluje vedoucí týmu, raději rozsah než cenu.',
    'Vybrán konkurent': 'Společná účast vedoucího na 2 jednáních, posílit argumentaci referencemi.',
    default: 'Pravidelný pipeline review dealů ve vyjednávání každý týden.',
  },
  'Smlouva k podpisu': {
    'Rozpočet zmrazen': 'Podepisovat do konce čtvrtletí, hlídat rozpočtová opatření klienta.',
    default: 'Zkrátit cestu podpisu: elektronický podpis a předem odsouhlasené VOP.',
  },
}

const NEXT_STAGE_PROBABILITY: Record<OpenStage, number> = {
  Kontakt: STAGE_PROBABILITY.Kvalifikace,
  Kvalifikace: STAGE_PROBABILITY.Nabídka,
  Nabídka: STAGE_PROBABILITY.Vyjednávání,
  Vyjednávání: STAGE_PROBABILITY['Smlouva k podpisu'],
  'Smlouva k podpisu': STAGE_PROBABILITY.Vyhráno,
}

export function leaks(ds: Dataset, r: DateRange, limit = 5): Leak[] {
  const spans = closedSpans(ds, r)
  const lk = lookup(ds)
  const out: Leak[] = []
  for (const stage of OPEN_STAGES) {
    const all = spans.filter((s) => s.stage === stage)
    if (all.length < 8) continue
    const avgRate = all.filter((s) => s.outcome !== 'lost').length / all.length
    const dims: { dimension: Leak['dimension']; key: (s: StageSpan) => string; label: (k: string) => string }[] = [
      { dimension: 'source', key: (s) => s.deal.sourceId, label: (k) => lk.source.get(k)?.name ?? k },
      { dimension: 'owner', key: (s) => s.deal.ownerId, label: (k) => lk.rep.get(k)?.name ?? k },
    ]
    for (const dim of dims) {
      const groups = new Map<string, StageSpan[]>()
      for (const s of all) {
        const k = dim.key(s)
        groups.set(k, [...(groups.get(k) ?? []), s])
      }
      for (const [key, list] of groups) {
        if (list.length < 4) continue
        const advanced = list.filter((s) => s.outcome !== 'lost').length
        const rate = advanced / list.length
        if (rate >= avgRate) continue
        const avgValue = sum(list, (s) => s.deal.value) / list.length
        // Deals that would have advanced at the average rate, valued at the win probability of the next stage.
        const amount = (avgRate - rate) * list.length * avgValue * NEXT_STAGE_PROBABILITY[stage]
        const lost = list.filter((s) => s.outcome === 'lost').map((s) => s.deal)
        const topReason = mostCommon(lost.map((d) => d.lostReason).filter(Boolean) as LostReason[])
        const ownerId = dim.dimension === 'owner' ? key : mostValuableOwner(lost)
        out.push({
          id: `${stage}|${dim.dimension}|${key}`,
          dimension: dim.dimension,
          stage,
          key,
          label: dim.label(key),
          left: list.length,
          rate,
          avgRate,
          amount,
          ownerId,
          topReason,
          action: ACTION[stage][topReason ?? 'default'] ?? ACTION[stage].default!,
        })
      }
    }
  }
  // Keep the list varied: at most two leaks from the same stage.
  const perStage = new Map<string, number>()
  return out
    .sort((a, b) => b.amount - a.amount)
    .filter((l) => {
      const n = perStage.get(l.stage) ?? 0
      perStage.set(l.stage, n + 1)
      return n < 2
    })
    .slice(0, limit)
}

function mostCommon<T>(items: T[]): T | null {
  const counts = new Map<T, number>()
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1)
  let best: T | null = null
  let n = 0
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v]
  return best
}

function mostValuableOwner(deals: Deal[]): string | null {
  const totals = new Map<string, number>()
  for (const d of deals) totals.set(d.ownerId, (totals.get(d.ownerId) ?? 0) + d.value)
  let best: string | null = null
  let v = -1
  for (const [k, t] of totals) if (t > v) [best, v] = [k, t]
  return best
}
