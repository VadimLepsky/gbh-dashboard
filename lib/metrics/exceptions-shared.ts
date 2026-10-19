import type { ISODate } from '../data/types'
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

export const RULE_TEXT: Record<ExceptionType, string> = {
  overdue_invoice: `Faktura více než ${RULES.overdueInvoiceDays} dní po splatnosti`,
  stuck_deal: `Zaseknutý deal: ve fázi déle než ${RULES.stuckFactor}× medián`,
  no_next_step: 'Otevřený deal bez dalšího kroku nebo s krokem v minulosti',
  overdue_followups: `Obchodník s ${RULES.followupsMin} a více zpožděnými follow-upy`,
  unsigned_contract: `Smlouva nepodepsaná déle než ${RULES.unsignedDays} dní`,
  renewal_risk: `Roční smlouva končí do ${RULES.renewalDays} dní a obnova není založená`,
  tender_deadline: `Veřejná zakázka s termínem do ${RULES.tenderDays} dní ve stavu příprava`,
  low_activity: `Obchodník pod ${Math.round(RULES.lowActivityRatio * 100)} % cíle aktivit za ${RULES.lowActivityWindowDays / 7} týdny`,
  unmatched_payment: 'Platba na účtu bez spárované faktury',
}
