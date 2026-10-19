/** ISO calendar date, `YYYY-MM-DD`. Lexicographic order = chronological order. */
export type ISODate = string

export type TeamId = 'cechy' | 'morava'

export interface Team {
  id: TeamId
  name: string
}

export type SalesRole = 'Senior' | 'Obchodník' | 'Junior'

export interface Salesperson {
  id: string
  name: string
  initials: string
  role: SalesRole
  teamId: TeamId
  monthlyQuota: number
  monthlyActivityTarget: number
  commissionProfileId: string
  startDate: ISODate
}

export type InstitutionType =
  | 'Ministerstvo'
  | 'Krajský úřad'
  | 'Městský úřad'
  | 'Nemocnice'
  | 'Škola'
  | 'Složka IZS'
  | 'Státní podnik'

export type KrajId =
  | 'PHA'
  | 'STC'
  | 'JHC'
  | 'PLK'
  | 'KVK'
  | 'ULK'
  | 'LBK'
  | 'HKK'
  | 'PAK'
  | 'VYS'
  | 'JHM'
  | 'OLK'
  | 'ZLK'
  | 'MSK'

export interface Kraj {
  id: KrajId
  name: string
  short: string
  teamId: TeamId
  /** Position in the simplified tile map. */
  col: number
  row: number
}

export interface Institution {
  id: string
  name: string
  type: InstitutionType
  kraj: KrajId
  size: 'S' | 'M' | 'L'
}

export interface Product {
  id: string
  name: string
  shortName: string
  /** Share of the price that is direct cost (trainers, travel, materials). */
  unitCostShare: number
  recurring: boolean
}

export type LeadSourceId = 'cold_call' | 'webinar' | 'referral' | 'tender' | 'inbound' | 'fair'

export interface LeadSource {
  id: LeadSourceId
  name: string
}

export const OPEN_STAGES = [
  'Kontakt',
  'Kvalifikace',
  'Nabídka',
  'Vyjednávání',
  'Smlouva k podpisu',
] as const

export type OpenStage = (typeof OPEN_STAGES)[number]
export type Stage = OpenStage | 'Vyhráno' | 'Prohráno'

export const LOST_REASONS = [
  'Cena',
  'Rozpočet zmrazen',
  'Vybrán konkurent',
  'Bez odezvy',
  'Zrušená zakázka',
] as const

export type LostReason = (typeof LOST_REASONS)[number]

export interface StageEntry {
  stage: Stage
  enteredAt: ISODate
}

export interface Deal {
  id: string
  institutionId: string
  ownerId: string
  productId: string
  sourceId: LeadSourceId
  value: number
  stage: Stage
  stageHistory: StageEntry[]
  createdAt: ISODate
  expectedCloseAt: ISODate
  nextStepAt: ISODate | null
  nextStep: string | null
  lostReason: LostReason | null
  /** Stage the deal was in when it was lost. */
  lostAtStage: OpenStage | null
  closedAt: ISODate | null
  isRenewal: boolean
  renewalOfContractId: string | null
}

export type ActivityType = 'hovor' | 'e-mail' | 'schůzka' | 'follow-up'

export interface Activity {
  id: string
  dealId: string | null
  ownerId: string
  type: ActivityType
  dueAt: ISODate
  doneAt: ISODate | null
}

export interface Contract {
  id: string
  dealId: string
  ownerId: string
  institutionId: string
  productId: string
  recurring: boolean
  sentForSignatureAt: ISODate
  signedAt: ISODate | null
  startAt: ISODate
  endAt: ISODate
  annualValue: number
  renewalDealId: string | null
}

export interface Invoice {
  id: string
  contractId: string
  dealId: string
  ownerId: string
  institutionId: string
  number: string
  variableSymbol: string
  issuedAt: ISODate
  dueAt: ISODate
  amount: number
  paidAt: ISODate | null
}

export interface BankPayment {
  id: string
  amount: number
  receivedAt: ISODate
  variableSymbol: string
  counterparty: string
  matchedInvoiceId: string | null
  /** `auto` = matched by variable symbol, `manual` = paired by accounting later. */
  matchMethod: 'auto' | 'manual' | null
}

export type TenderStatus = 'příprava' | 'podáno' | 'vyhráno' | 'prohráno'

export interface Tender {
  id: string
  title: string
  institutionId: string
  ownerId: string
  value: number
  submissionDeadline: ISODate
  status: TenderStatus
  dealId: string | null
}

export interface CommissionBand {
  /** Plan attainment range as ratios; `max: null` = open-ended. */
  min: number
  max: number | null
  coefficient: number
  label: string
}

export interface CommissionProfile {
  id: string
  role: SalesRole
  baseRate: number
  bands: CommissionBand[]
}

export interface Dataset {
  today: ISODate
  historyStart: ISODate
  teams: Team[]
  kraje: Kraj[]
  salespeople: Salesperson[]
  institutions: Institution[]
  products: Product[]
  sources: LeadSource[]
  commissionProfiles: CommissionProfile[]
  deals: Deal[]
  activities: Activity[]
  contracts: Contract[]
  invoices: Invoice[]
  payments: BankPayment[]
  tenders: Tender[]
}
