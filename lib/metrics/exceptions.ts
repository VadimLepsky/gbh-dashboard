import { addDays, diffDays, startOfMonth } from '../data/dates'
import { paymentCandidates } from '../data/match'
import type { Dataset, Deal, ISODate, OpenStage } from '../data/types'
import { formatCount, formatDate, formatPercent } from '../format'
import type { DrillRequest } from './drill-types'
import { dealName, institutionName, lookup } from './lookup'
import { overdueInvoices, daysOverdue, unmatchedPayments } from './money'
import { upcomingRenewals } from './contracts'
import { daysInStage, hasNoNextStep, isStuck, medianForDeal, openDeals, revenueWon, weightedValue } from './sales'
import { overdueFollowups, rollingActivityRatio } from './team'

export type ExceptionType =
  | 'overdue_invoice'
  | 'stuck_deal'
  | 'no_next_step'
  | 'overdue_followups'
  | 'unsigned_contract'
  | 'renewal_risk'
  | 'tender_deadline'
  | 'low_activity'
  | 'unmatched_payment'

export const EXCEPTION_LABEL: Record<ExceptionType, string> = {
  overdue_invoice: 'Faktura po splatnosti',
  stuck_deal: 'Zaseknutý deal',
  no_next_step: 'Bez dalšího kroku',
  overdue_followups: 'Zpožděné follow-upy',
  unsigned_contract: 'Nepodepsaná smlouva',
  renewal_risk: 'Obnova bez dealu',
  tender_deadline: 'Termín zakázky',
  low_activity: 'Nízká aktivita',
  unmatched_payment: 'Nespárovaná platba',
}

export interface ExceptionItem {
  id: string
  type: ExceptionType
  object: string
  detail: string
  ref: DrillRequest
  amount: number
  ownerId: string | null
  action: string
  deadline: ISODate
  score: number
  tags: string[]
}

const STUCK_ACTION: Record<OpenStage, string> = {
  Kontakt: 'Ověřit zájem, nebo deal uzavřít jako prohraný',
  Kvalifikace: 'Domluvit schůzku s rozhodovatelem',
  Nabídka: 'Zavolat k nabídce, zjistit námitky',
  Vyjednávání: 'Eskalovat: schůzka vedoucího s klientem',
  'Smlouva k podpisu': 'Urgovat podpis u statutára',
}

/** Kč × urgency: anything due today or overdue counts double. */
function urgency(today: ISODate, deadline: ISODate): number {
  const d = diffDays(today, deadline)
  if (d <= 0) return 2
  if (d <= 3) return 1.6
  if (d <= 7) return 1.3
  return 1
}

export function exceptions(ds: Dataset, full: Dataset = ds): ExceptionItem[] {
  const today = ds.today
  const lk = lookup(ds)
  const items: ExceptionItem[] = []
  const push = (it: Omit<ExceptionItem, 'score'>) =>
    items.push({ ...it, score: Math.max(it.amount, 10_000) * urgency(today, it.deadline) })

  // Invoices more than 14 days overdue
  for (const inv of overdueInvoices(ds, today)) {
    const late = daysOverdue(inv, today)
    if (late <= 14) continue
    push({
      id: `inv-${inv.id}`,
      type: 'overdue_invoice',
      object: `${inv.number} · ${institutionName(ds, inv.institutionId)}`,
      detail: `${late} dní po splatnosti (splatná ${formatDate(inv.dueAt)})`,
      ref: { metric: 'record', filters: { type: 'invoice', id: inv.id } },
      amount: inv.amount,
      ownerId: inv.ownerId,
      action: late > 45 ? 'Předat k vymáhání, informovat vedení klienta' : 'Upomínka a telefonát na účtárnu klienta',
      deadline: addDays(today, late > 30 ? 0 : 2),
      tags: late > 30 ? ['30+ dní'] : [],
    })
  }

  // Stuck deals and deals without a next step (one row per deal)
  for (const d of openDeals(ds)) {
    const stuck = isStuck(ds, d)
    const noNext = hasNoNextStep(d, today)
    if (!stuck && !noNext) continue
    const inStage = daysInStage(d, today)
    const tags: string[] = []
    if (stuck && noNext) tags.push(d.nextStepAt ? 'krok v minulosti' : 'bez dalšího kroku')
    if (d.expectedCloseAt < today) tags.push('prošlé datum uzavření')
    push({
      id: `deal-${d.id}`,
      type: stuck ? 'stuck_deal' : 'no_next_step',
      object: dealName(ds, d),
      detail: stuck
        ? `${inStage} dní ve fázi ${d.stage} (obvykle ${Math.round(medianForDeal(ds, d))})`
        : d.nextStepAt
          ? `Další krok měl být ${formatDate(d.nextStepAt)} · ${d.stage}`
          : `Bez naplánovaného kroku · ${d.stage}`,
      ref: { metric: 'record', filters: { type: 'deal', id: d.id } },
      amount: weightedValue(d),
      ownerId: d.ownerId,
      action: stuck ? STUCK_ACTION[d.stage as OpenStage] : 'Naplánovat další krok s klientem',
      deadline: addDays(today, stuck ? 2 : 1),
      tags,
    })
  }

  // Overdue follow-ups, grouped per rep
  const byOwner = new Map<string, ReturnType<typeof overdueFollowups>>()
  for (const a of overdueFollowups(ds)) byOwner.set(a.ownerId, [...(byOwner.get(a.ownerId) ?? []), a])
  for (const [ownerId, acts] of byOwner) {
    if (acts.length < 2) continue
    const deals = new Set(acts.map((a) => a.dealId).filter(Boolean) as string[])
    const amount = [...deals].reduce((s, id) => s + weightedValue(lk.deal.get(id)!), 0)
    const oldest = acts.reduce((m, a) => (a.dueAt < m ? a.dueAt : m), acts[0].dueAt)
    push({
      id: `fu-${ownerId}`,
      type: 'overdue_followups',
      object: `${lk.rep.get(ownerId)?.name} · ${formatCount(acts.length, ['follow-up', 'follow-upy', 'follow-upů'])}`,
      detail: `Nejstarší z ${formatDate(oldest)}, týká se ${formatCount(deals.size, ['dealu', 'dealů', 'dealů'])}`,
      ref: { metric: 'overdue_followups', filters: { ownerId } },
      amount,
      ownerId,
      action: 'Dokončit zpožděné follow-upy dnes, zbytek přeplánovat',
      deadline: today,
      tags: acts.length >= 6 ? ['6+ zpožděných'] : [],
    })
  }

  // Contracts unsigned for more than 7 days
  for (const c of ds.contracts) {
    if (c.signedAt) continue
    const waiting = diffDays(c.sentForSignatureAt, today)
    if (waiting <= 7) continue
    push({
      id: `sm-${c.id}`,
      type: 'unsigned_contract',
      object: `${c.id} · ${institutionName(ds, c.institutionId)}`,
      detail: `Odesláno k podpisu ${formatDate(c.sentForSignatureAt)} (${waiting} dní)`,
      ref: { metric: 'record', filters: { type: 'deal', id: c.dealId } },
      amount: c.annualValue,
      ownerId: c.ownerId,
      action: 'Urgovat podpis, ověřit podpisové právo',
      deadline: addDays(today, 1),
      tags: [],
    })
  }

  // Annual contracts ending within 60 days without a renewal deal
  for (const r of upcomingRenewals(ds, 60)) {
    if (r.status !== 'bez-obnovy') continue
    push({
      id: `ren-${r.contract.id}`,
      type: 'renewal_risk',
      object: `${institutionName(ds, r.contract.institutionId)} · rámcová smlouva`,
      detail: `Končí ${formatDate(r.contract.endAt)} (za ${r.daysLeft} dní), obnova není založená`,
      ref: { metric: 'record', filters: { type: 'contract', id: r.contract.id } },
      amount: r.contract.annualValue,
      ownerId: r.contract.ownerId,
      action: 'Založit deal na obnovu a domluvit schůzku',
      deadline: addDays(r.contract.endAt, -30) < today ? today : addDays(r.contract.endAt, -30),
      tags: r.daysLeft <= 30 ? ['do 30 dní'] : [],
    })
  }

  // Tender deadlines within 7 days still in preparation
  for (const t of ds.tenders) {
    if (t.status !== 'příprava') continue
    const left = diffDays(today, t.submissionDeadline)
    if (left < 0 || left >= 7) continue
    push({
      id: `vz-${t.id}`,
      type: 'tender_deadline',
      object: `${t.id} · ${institutionName(ds, t.institutionId)}`,
      detail: `Podání do ${formatDate(t.submissionDeadline)} (za ${left} dní), stav příprava`,
      ref: { metric: 'record', filters: { type: 'tender', id: t.id } },
      amount: t.value,
      ownerId: t.ownerId,
      action: 'Dokončit nabídku a nechat ji zkontrolovat',
      deadline: addDays(t.submissionDeadline, -1) < today ? today : addDays(t.submissionDeadline, -1),
      tags: [],
    })
  }

  // Reps below 60 % of activity target (rolling 4 weeks)
  for (const rep of ds.salespeople) {
    const { done, target, ratio } = rollingActivityRatio(ds, rep.id)
    if (ratio >= 0.6) continue
    const monthStart = startOfMonth(today)
    const gap = Math.max(0, rep.monthlyQuota - revenueWon(ds, { start: monthStart, end: today }, { ownerId: rep.id }))
    push({
      id: `act-${rep.id}`,
      type: 'low_activity',
      object: rep.name,
      detail: `${done} z ${Math.round(target)} aktivit za 4 týdny (${formatPercent(ratio, 0)} cíle)`,
      ref: { metric: 'activities_done', filters: { ownerId: rep.id, window: 'rolling28' } },
      amount: gap,
      ownerId: rep.id,
      action: '1:1 s vedoucím týmu, týdenní plán aktivit',
      deadline: addDays(today, 1),
      tags: [],
    })
  }

  // Bank payments without an invoice
  for (const p of unmatchedPayments(ds)) {
    if (diffDays(p.receivedAt, today) > 45) continue
    const candidate = paymentCandidates(full, p)[0]
    push({
      id: `bp-${p.id}`,
      type: 'unmatched_payment',
      object: `Platba ${formatDate(p.receivedAt)} · VS ${p.variableSymbol}`,
      detail: candidate
        ? `Pravděpodobně ${candidate.number} (${institutionName(full, candidate.institutionId)}), shoda částky`
        : `Plátce: ${p.counterparty}, žádná faktura se stejnou částkou`,
      ref: { metric: 'record', filters: { type: 'payment', id: p.id } },
      amount: p.amount,
      ownerId: candidate?.ownerId ?? null,
      action: candidate ? `Spárovat s ${candidate.number} a zrušit upomínku` : 'Dohledat plátce, případně vrátit platbu',
      deadline: addDays(today, 2),
      tags: [],
    })
  }

  return items.sort((a, b) => b.score - a.score)
}

export function isDealException(d: Deal, ds: Dataset): boolean {
  return isStuck(ds, d) || hasNoNextStep(d, ds.today)
}
