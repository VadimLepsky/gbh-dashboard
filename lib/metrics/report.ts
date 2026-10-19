import { addDays, startOfMonth, startOfWeek } from '../data/dates'
import type { Dataset } from '../data/types'
import { exceptions, type ExceptionItem } from './exceptions'
import { collected, invoiced, overdue } from './money'
import { monthPeriod } from './period'
import { forecast, planFor, revenueWon, wonDeals } from './sales'
import { activitiesDone, activityTarget } from './team'

export interface WeeklyReport {
  weekStart: string
  weekEnd: string
  won: number
  wonCount: number
  wonPrev: number
  newDeals: number
  invoiced: number
  collected: number
  collectedPrev: number
  activities: number
  activityTarget: number
  monthWon: number
  monthPlan: number
  monthForecast: number
  overdue: number
  topExceptions: ExceptionItem[]
  best: { name: string; pace: number } | null
  worst: { name: string; pace: number } | null
}

/** Report for the last completed week (Monday–Sunday). */
export function weeklyReport(ds: Dataset, full: Dataset = ds): WeeklyReport {
  const weekStart = addDays(startOfWeek(ds.today), -7)
  const weekEnd = addDays(weekStart, 6)
  const prev = { start: addDays(weekStart, -7), end: addDays(weekStart, -1) }
  const week = { start: weekStart, end: weekEnd }
  const month = monthPeriod(ds.today.slice(0, 7), ds.today)
  const fc = forecast(ds, month)
  const mtd = { start: startOfMonth(ds.today), end: ds.today }

  const paces = ds.salespeople
    .map((p) => {
      const plan = planFor(ds, mtd, { ownerId: p.id })
      return { name: p.name, pace: plan ? revenueWon(ds, mtd, { ownerId: p.id }) / plan : 0 }
    })
    .sort((a, b) => b.pace - a.pace)

  const won = wonDeals(ds, week)
  return {
    weekStart,
    weekEnd,
    won: won.reduce((s, d) => s + d.value, 0),
    wonCount: won.length,
    wonPrev: revenueWon(ds, prev),
    newDeals: ds.deals.filter((d) => d.createdAt >= weekStart && d.createdAt <= weekEnd).length,
    invoiced: invoiced(ds, week),
    collected: collected(ds, week),
    collectedPrev: collected(ds, prev),
    activities: activitiesDone(ds, week).length,
    activityTarget: activityTarget(ds, week),
    monthWon: fc.won,
    monthPlan: fc.plan,
    monthForecast: fc.total,
    overdue: overdue(ds, ds.today),
    topExceptions: exceptions(ds, full).slice(0, 5),
    best: paces.length > 1 ? paces[0] : null,
    worst: paces.length > 1 ? paces[paces.length - 1] : null,
  }
}
