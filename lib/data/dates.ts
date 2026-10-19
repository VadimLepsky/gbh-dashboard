import type { ISODate } from './types'

const MS_PER_DAY = 86_400_000

/** Days since 1970-01-01 (UTC). */
export function toDay(iso: ISODate): number {
  return Math.round(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) /
      MS_PER_DAY,
  )
}

export function fromDay(day: number): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromDay(toDay(iso) + n)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDay(b) - toDay(a)
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7)
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`
}

export function daysInMonth(ym: string): number {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function endOfMonth(iso: ISODate): ISODate {
  const ym = iso.slice(0, 7)
  return `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7)) - 1 + n
  const d = Number(iso.slice(8, 10))
  const ty = y + Math.floor(m / 12)
  const tm = ((m % 12) + 12) % 12
  const ym = `${ty}-${String(tm + 1).padStart(2, '0')}`
  return `${ym}-${String(Math.min(d, daysInMonth(ym))).padStart(2, '0')}`
}

export function addMonthsToKey(ym: string, n: number): string {
  return addMonths(`${ym}-01`, n).slice(0, 7)
}

/** Month keys from `fromYm` to `toYm` inclusive. */
export function monthRange(fromYm: string, toYm: string): string[] {
  const out: string[] = []
  let cur = fromYm
  while (cur <= toYm) {
    out.push(cur)
    cur = addMonthsToKey(cur, 1)
  }
  return out
}

/** 0 = Monday … 6 = Sunday */
export function weekday(iso: ISODate): number {
  return (((toDay(iso) + 3) % 7) + 7) % 7
}

export function weekdayOfDay(day: number): number {
  return (((day + 3) % 7) + 7) % 7
}

export function isWorkingDay(iso: ISODate): boolean {
  return weekday(iso) < 5
}

export function workingDaysBetween(from: ISODate, to: ISODate): number {
  let count = 0
  for (let d = toDay(from); d <= toDay(to); d++) if (weekdayOfDay(d) < 5) count++
  return count
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso))
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b
}

/** Today's calendar date in Prague, independent of the server time zone. */
export function pragueToday(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
