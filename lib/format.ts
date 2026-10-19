import type { ISODate } from './data/types'

const integer = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const percent1 = new Intl.NumberFormat('cs-CZ', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const percent0 = new Intl.NumberFormat('cs-CZ', { style: 'percent', maximumFractionDigits: 0 })

const MONTHS = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
]
const MONTHS_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']

/** `1 087 400 Kč` */
export function formatCZK(value: number): string {
  return `${integer.format(Math.round(value))} Kč`
}

/** `1,09 mil. Kč`, `540 tis. Kč`, `9 800 Kč` — for axes and tight spaces. */
export function formatCZKCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const fmt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: abs >= 10_000_000 ? 1 : 2 })
    return `${fmt.format(value / 1_000_000)} mil. Kč`
  }
  if (abs >= 10_000) return `${integer.format(Math.round(value / 1000))} tis. Kč`
  return formatCZK(value)
}

/** Axis ticks without currency: `1,5 mil.`, `400 tis.` */
export function formatAxisCZK(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${oneDecimal.format(value / 1_000_000).replace(/,0$/, '')} mil.`
  if (abs >= 1000) return `${integer.format(Math.round(value / 1000))} tis.`
  return integer.format(value)
}

export function formatNumber(value: number): string {
  return integer.format(Math.round(value))
}

export function formatDecimal(value: number): string {
  return oneDecimal.format(value)
}

/** Ratio → `14,5 %` */
export function formatPercent(ratio: number, digits: 0 | 1 = 1): string {
  if (!Number.isFinite(ratio)) return '—'
  return (digits === 0 ? percent0 : percent1).format(ratio)
}

/** Signed percent change: `+12,4 %` / `−3,1 %` */
export function formatSignedPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—'
  const s = percent1.format(Math.abs(ratio))
  return `${ratio > 0 ? '+' : ratio < 0 ? '−' : ''}${s}`
}

export function formatSignedCZK(value: number): string {
  const s = formatCZKCompact(Math.abs(value))
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${s}`
}

export function formatSignedNumber(value: number, unit = ''): string {
  const s = `${formatDecimalSmart(Math.abs(value))}${unit}`
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${s}`
}

function formatDecimalSmart(v: number): string {
  return Number.isInteger(v) ? integer.format(v) : oneDecimal.format(v)
}

function parts(iso: ISODate) {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) }
}

/** `19. 10. 2026` */
export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—'
  const { y, m, d } = parts(iso)
  return `${d}. ${m}. ${y}`
}

/** `19. 10.` */
export function formatDateShort(iso: ISODate | null | undefined): string {
  if (!iso) return '—'
  const { m, d } = parts(iso)
  return `${d}. ${m}.`
}

/** `říjen 2026` */
export function formatMonth(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
}

export function formatMonthName(ym: string): string {
  return MONTHS[Number(ym.slice(5, 7)) - 1]
}

/** `říj` or `říj 25` */
export function formatMonthShort(ym: string, withYear = false): string {
  const s = MONTHS_SHORT[Number(ym.slice(5, 7)) - 1]
  return withYear ? `${s} ${ym.slice(2, 4)}` : s
}

/** Czech plural: plural(5, ['den', 'dny', 'dní']) → `dní` */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n)
  if (abs === 1) return forms[0]
  if (abs >= 2 && abs <= 4) return forms[1]
  return forms[2]
}

/** `12 dní` */
export function formatDays(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  const r = Math.round(n)
  return `${formatNumber(r)} ${plural(r, ['den', 'dny', 'dní'])}`
}

/** `3 dealy`, `1 faktura` … */
export function formatCount(n: number, forms: [string, string, string]): string {
  return `${formatNumber(n)} ${plural(n, forms)}`
}

/** `21:04` in Prague. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${oneDecimal.format(value)}×`
}

export type ValueFormat = 'czk' | 'czk_compact' | 'percent' | 'int' | 'days' | 'date' | 'ratio' | 'text'

export function formatValue(value: number | string | null | undefined, format: ValueFormat): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return format === 'date' ? formatDate(value) : value
  switch (format) {
    case 'czk':
      return formatCZK(value)
    case 'czk_compact':
      return formatCZKCompact(value)
    case 'percent':
      return formatPercent(value)
    case 'int':
      return formatNumber(value)
    case 'days':
      return formatDays(value)
    case 'ratio':
      return formatRatio(value)
    default:
      return String(value)
  }
}
