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
