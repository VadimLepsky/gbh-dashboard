import type { ISODate } from '../data/types'
import type { I18n } from '../i18n/core'
import type { DrillRequest } from './drill-types'

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

/** Label of an exception type in the given language. */
export function exceptionLabel(i18n: Pick<I18n, 't'>, type: ExceptionType): string {
  return i18n.t(`exceptions.types.${type}`)
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

/** Thresholds of the exception rules — the only place they are defined. */
export const RULES = {
  overdueInvoiceDays: 14,
  stuckFactor: 2,
  followupsMin: 2,
  unsignedDays: 7,
  renewalDays: 60,
  tenderDays: 7,
  lowActivityRatio: 0.6,
  lowActivityWindowDays: 28,
  unmatchedLookbackDays: 45,
} as const

/** When an item appears in the list — one sentence per rule, thresholds filled from RULES. */
export function ruleTexts(i18n: Pick<I18n, 't' | 'f'>): Record<ExceptionType, string> {
  const types: ExceptionType[] = [
    'overdue_invoice',
    'stuck_deal',
    'no_next_step',
    'overdue_followups',
    'unsigned_contract',
    'renewal_risk',
    'tender_deadline',
    'low_activity',
    'unmatched_payment',
  ]
  const vars: Record<ExceptionType, Record<string, string | number>> = {
    overdue_invoice: { days: RULES.overdueInvoiceDays },
    stuck_deal: { factor: RULES.stuckFactor },
    no_next_step: {},
    overdue_followups: { min: RULES.followupsMin },
    unsigned_contract: { days: RULES.unsignedDays },
    renewal_risk: { days: RULES.renewalDays },
    tender_deadline: { days: RULES.tenderDays },
    low_activity: { pct: i18n.f.formatPercent(RULES.lowActivityRatio, 0), weeks: RULES.lowActivityWindowDays / 7 },
    unmatched_payment: {},
  }
  return Object.fromEntries(types.map((t) => [t, i18n.t(`exceptions.rules.${t}`, vars[t])])) as Record<ExceptionType, string>
}
