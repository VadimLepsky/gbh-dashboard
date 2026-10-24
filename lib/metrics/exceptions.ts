import { addDays, diffDays, startOfMonth } from '../data/dates'
import { paymentCandidates } from '../data/match'
import type { Dataset, Deal, ISODate, OpenStage } from '../data/types'
import { getI18n, type I18n } from '../i18n'
import { dealName, institutionName, lookup } from './lookup'
import { overdueInvoices, daysOverdue, unmatchedPayments } from './money'
import { upcomingRenewals } from './contracts'
import { daysInStage, hasNoNextStep, isStuck, medianForDeal, openDeals, revenueWon, weightedValue } from './sales'
import { overdueFollowups, rollingActivityRatio } from './team'

export { exceptionLabel, RULES, ruleTexts, type ExceptionItem, type ExceptionType } from './exceptions-shared'
import { RULES, type ExceptionItem } from './exceptions-shared'

/** Kč × urgency: anything due today or overdue counts double. */
function urgency(today: ISODate, deadline: ISODate): number {
  const d = diffDays(today, deadline)
  if (d <= 0) return 2
  if (d <= 3) return 1.6
  if (d <= 7) return 1.3
  return 1
}

export function exceptions(ds: Dataset, full: Dataset = ds, i18n: I18n = getI18n()): ExceptionItem[] {
  const { t, f } = i18n
  const { formatDate, formatDays } = f
  const today = ds.today
  const lk = lookup(ds)
  const items: ExceptionItem[] = []
  const push = (it: Omit<ExceptionItem, 'score'>) =>
    items.push({ ...it, score: Math.max(it.amount, 10_000) * urgency(today, it.deadline) })

  // Invoices more than 14 days overdue
  for (const inv of overdueInvoices(ds, today)) {
    const late = daysOverdue(inv, today)
    if (late <= RULES.overdueInvoiceDays) continue
    push({
      id: `inv-${inv.id}`,
      type: 'overdue_invoice',
      object: `${inv.number} · ${institutionName(ds, inv.institutionId)}`,
      detail: t('exceptions.detail.overdueInvoice', { late: formatDays(late), due: formatDate(inv.dueAt) }),
      ref: { metric: 'record', filters: { type: 'invoice', id: inv.id } },
      amount: inv.amount,
      ownerId: inv.ownerId,
      action: t(late > 45 ? 'exceptions.action.invoiceCollect' : 'exceptions.action.invoiceRemind'),
      deadline: addDays(today, late > 30 ? 0 : 2),
      tags: late > 30 ? [t('exceptions.tags.over30')] : [],
    })
  }

  // Stuck deals and deals without a next step (one row per deal)
  for (const d of openDeals(ds)) {
    const stuck = isStuck(ds, d)
    const noNext = hasNoNextStep(d, today)
    if (!stuck && !noNext) continue
    const inStage = daysInStage(d, today)
    const tags: string[] = []
    if (stuck && noNext) tags.push(t(d.nextStepAt ? 'exceptions.tags.stepPast' : 'exceptions.tags.noStep'))
    if (d.expectedCloseAt < today) tags.push(t('exceptions.tags.closePassed'))
    const stage = i18n.term('stage', d.stage)
    push({
      id: `deal-${d.id}`,
      type: stuck ? 'stuck_deal' : 'no_next_step',
      object: dealName(ds, d, i18n),
      detail: stuck
        ? t('exceptions.detail.stuck', { days: formatDays(inStage), stage, typical: Math.round(medianForDeal(ds, d)) })
        : d.nextStepAt
          ? t('exceptions.detail.nextStepWas', { date: formatDate(d.nextStepAt), stage })
          : t('exceptions.detail.noStep', { stage }),
      ref: { metric: 'record', filters: { type: 'deal', id: d.id } },
      amount: weightedValue(d),
      ownerId: d.ownerId,
      action: t(stuck ? `exceptions.action.stuck.${d.stage as OpenStage}` : 'exceptions.action.planStep'),
      deadline: addDays(today, stuck ? 2 : 1),
      tags,
    })
  }

  // Overdue follow-ups, grouped per rep
  const byOwner = new Map<string, ReturnType<typeof overdueFollowups>>()
  for (const a of overdueFollowups(ds)) byOwner.set(a.ownerId, [...(byOwner.get(a.ownerId) ?? []), a])
  for (const [ownerId, acts] of byOwner) {
    if (acts.length < RULES.followupsMin) continue
    const deals = new Set(acts.map((a) => a.dealId).filter(Boolean) as string[])
    const amount = [...deals].reduce((s, id) => s + weightedValue(lk.deal.get(id)!), 0)
    const oldest = acts.reduce((m, a) => (a.dueAt < m ? a.dueAt : m), acts[0].dueAt)
    push({
      id: `fu-${ownerId}`,
      type: 'overdue_followups',
      object: `${lk.rep.get(ownerId)?.name} · ${f.formatCount(acts.length, 'followups')}`,
      detail: t('exceptions.detail.followups', { date: formatDate(oldest), deals: f.formatCount(deals.size, 'dealsGen') }),
      ref: { metric: 'overdue_followups', filters: { ownerId } },
      amount,
      ownerId,
      action: t('exceptions.action.followups'),
      deadline: today,
      tags: acts.length >= 6 ? [t('exceptions.tags.followups6')] : [],
    })
  }

  // Contracts unsigned for more than 7 days
  for (const c of ds.contracts) {
    if (c.signedAt) continue
    const waiting = diffDays(c.sentForSignatureAt, today)
    if (waiting <= RULES.unsignedDays) continue
    push({
      id: `sm-${c.id}`,
      type: 'unsigned_contract',
      object: `${c.id} · ${institutionName(ds, c.institutionId)}`,
      detail: t('exceptions.detail.unsigned', { date: formatDate(c.sentForSignatureAt), days: formatDays(waiting) }),
      ref: { metric: 'record', filters: { type: 'deal', id: c.dealId } },
      amount: c.annualValue,
      ownerId: c.ownerId,
      action: t('exceptions.action.unsigned'),
      deadline: addDays(today, 1),
      tags: [],
    })
  }

  // Annual contracts ending within 60 days without a renewal deal
  for (const r of upcomingRenewals(ds, RULES.renewalDays)) {
    if (r.status !== 'bez-obnovy') continue
    push({
      id: `ren-${r.contract.id}`,
      type: 'renewal_risk',
      object: t('exceptions.detail.renewalObject', { institution: institutionName(ds, r.contract.institutionId) }),
      detail: t('exceptions.detail.renewal', { date: formatDate(r.contract.endAt), days: formatDays(r.daysLeft) }),
      ref: { metric: 'record', filters: { type: 'contract', id: r.contract.id } },
      amount: r.contract.annualValue,
      ownerId: r.contract.ownerId,
      action: t('exceptions.action.renewal'),
      deadline: addDays(r.contract.endAt, -30) < today ? today : addDays(r.contract.endAt, -30),
      tags: r.daysLeft <= 30 ? [t('exceptions.tags.within30')] : [],
    })
  }

  // Tender deadlines within 7 days still in preparation
  for (const tender of ds.tenders) {
    if (tender.status !== 'příprava') continue
    const left = diffDays(today, tender.submissionDeadline)
    if (left < 0 || left >= RULES.tenderDays) continue
    push({
      id: `vz-${tender.id}`,
      type: 'tender_deadline',
      object: `${tender.id} · ${institutionName(ds, tender.institutionId)}`,
      detail: t('exceptions.detail.tender', { date: formatDate(tender.submissionDeadline), days: formatDays(left) }),
      ref: { metric: 'record', filters: { type: 'tender', id: tender.id } },
      amount: tender.value,
      ownerId: tender.ownerId,
      action: t('exceptions.action.tender'),
      deadline: addDays(tender.submissionDeadline, -1) < today ? today : addDays(tender.submissionDeadline, -1),
      tags: [],
    })
  }

  // Reps below 60 % of activity target (rolling 4 weeks)
  for (const rep of ds.salespeople) {
    const { done, target, ratio } = rollingActivityRatio(ds, rep.id)
    if (ratio >= RULES.lowActivityRatio) continue
    const monthStart = startOfMonth(today)
    const gap = Math.max(0, rep.monthlyQuota - revenueWon(ds, { start: monthStart, end: today }, { ownerId: rep.id }))
    push({
      id: `act-${rep.id}`,
      type: 'low_activity',
      object: rep.name,
      detail: t('exceptions.detail.lowActivity', {
        done: f.formatNumber(done),
        target: f.formatNumber(target),
        weeks: RULES.lowActivityWindowDays / 7,
        pct: f.formatPercent(ratio, 0),
      }),
      ref: { metric: 'activities_done', filters: { ownerId: rep.id, window: 'rolling28' } },
      amount: gap,
      ownerId: rep.id,
      action: t('exceptions.action.lowActivity'),
      deadline: addDays(today, 1),
      tags: [],
    })
  }

  // Bank payments without an invoice
  for (const p of unmatchedPayments(ds)) {
    if (diffDays(p.receivedAt, today) > RULES.unmatchedLookbackDays) continue
    const candidate = paymentCandidates(full, p)[0]
    push({
      id: `bp-${p.id}`,
      type: 'unmatched_payment',
      object: t('exceptions.detail.paymentObject', { date: formatDate(p.receivedAt), vs: p.variableSymbol }),
      detail: candidate
        ? t('exceptions.detail.paymentCandidate', { invoice: candidate.number, institution: institutionName(full, candidate.institutionId) })
        : t('exceptions.detail.paymentNoCandidate', { payer: p.counterparty }),
      ref: { metric: 'record', filters: { type: 'payment', id: p.id } },
      amount: p.amount,
      ownerId: candidate?.ownerId ?? null,
      action: candidate ? t('exceptions.action.paymentMatch', { invoice: candidate.number }) : t('exceptions.action.paymentTrace'),
      deadline: addDays(today, 2),
      tags: [],
    })
  }

  return items.sort((a, b) => b.score - a.score)
}

export function isDealException(d: Deal, ds: Dataset): boolean {
  return isStuck(ds, d) || hasNoNextStep(d, ds.today)
}
