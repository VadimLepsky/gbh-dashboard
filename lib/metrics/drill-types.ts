/** Serializable drill-down contracts shared by server (resolver) and client (sheet). */

export type DrillFilterValue = string | number | null | undefined

export interface DrillRequest {
  metric: string
  filters?: Record<string, DrillFilterValue>
  /** Optional heading override (e.g. "Prodáno · září 2026"). */
  title?: string
}

export type CellFormat = 'text' | 'czk' | 'date' | 'int' | 'percent' | 'days' | 'badge'

export interface DrillColumn {
  key: string
  label: string
  format: CellFormat
  align?: 'right'
  /** Hide on narrow screens. */
  secondary?: boolean
}

export interface DrillRow {
  id: string
  ref?: DrillRequest
  cells: Record<string, string | number | null>
  tone?: 'negative' | 'warning' | 'positive'
}

export interface DrillDetail {
  fields: { label: string; value: string; tone?: 'negative' | 'warning' | 'positive' }[]
  timeline?: { date: string; label: string; tone?: 'positive' | 'negative' | 'neutral' }[]
}

export interface DrillResult {
  title: string
  subtitle?: string
  definition?: string
  total: { label: string; value: number | null; format: CellFormat }
  count: number
  countLabel: string
  columns: DrillColumn[]
  rows: DrillRow[]
  /** Rows were capped for transfer; total and count still cover all records. */
  truncated: boolean
  /** Column whose values add up to `total.value`. */
  sumKey?: string
  detail?: DrillDetail
  note?: string
}
