import { addDays, addMonthsToKey, daysInMonth, diffDays, endOfMonth, maxDate, minDate, startOfWeek } from '../data/dates'
import type { Activity, Dataset, ISODate, Salesperson, TeamId } from '../data/types'
import { inRange, monthsOf, type DateRange, type Period } from './period'
import {
  dealsWithoutNextStep,
  forecast,
  openDeals,
  planFor,
  revenueWon,
  stuckDeals,
  sum,
  weightedValue,
  winRate,
} from './sales'

export function activitiesDone(ds: Dataset, r: DateRange, f?: { ownerId?: string; teamId?: string }): Activity[] {
  const owners = f?.teamId ? new Set(ds.salespeople.filter((p) => p.teamId === f.teamId).map((p) => p.id)) : null
  return ds.activities.filter(
    (a) =>
      inRange(a.doneAt, r) &&
      (!f?.ownerId || a.ownerId === f.ownerId) &&
      (!owners || owners.has(a.ownerId)),
  )
}

/** Activity target for the range: monthly target × share of each month covered. */
export function activityTarget(ds: Dataset, r: DateRange, f?: { ownerId?: string; teamId?: string }): number {
  let total = 0
  const people = ds.salespeople.filter(
    (p) => (!f?.ownerId || p.id === f.ownerId) && (!f?.teamId || p.teamId === f.teamId),
  )
  for (const ym of monthsOf(r)) {
    const dim = daysInMonth(ym)
    const covered = diffDays(maxDate(`${ym}-01`, r.start), minDate(endOfMonth(`${ym}-01`), r.end)) + 1
    if (covered <= 0) continue
    for (const p of people) if (p.startDate.slice(0, 7) <= ym) total += (p.monthlyActivityTarget * covered) / dim
  }
  return total
}

export function overdueFollowups(ds: Dataset, f?: { ownerId?: string }): Activity[] {
  return ds.activities.filter(
    (a) => a.doneAt === null && a.dueAt < ds.today && (!f?.ownerId || a.ownerId === f.ownerId),
  )
}

export function lastActivity(ds: Dataset, ownerId: string): ISODate | null {
  let last: ISODate | null = null
  for (const a of ds.activities) if (a.ownerId === ownerId && a.doneAt && (!last || a.doneAt > last)) last = a.doneAt
  return last
}

/** Rolling 4 weeks of activities vs target — the basis of the low-activity alert. */
export function rollingActivityRatio(ds: Dataset, ownerId: string): { done: number; target: number; ratio: number } {
  const r = { start: addDays(ds.today, -27), end: ds.today }
  const done = activitiesDone(ds, r, { ownerId }).length
  const target = activityTarget(ds, r, { ownerId })
  return { done, target, ratio: target ? done / target : 1 }
}

/** Attainment of one calendar month; a running month is measured against the plan prorated to today. */
export function monthAttainment(ds: Dataset, ym: string, f: { ownerId?: string; teamId?: string }): number | null {
  const r = { start: `${ym}-01`, end: minDate(endOfMonth(`${ym}-01`), ds.today) }
  const plan = planFor(ds, r, f)
  return plan ? revenueWon(ds, r, f) / plan : null
}

export interface RepRow {
  rep: Salesperson
  won: number
  plan: number
  attainment: number | null
  /** Attainment against the plan prorated to today (for heat and coefficients). */
  pace: number | null
  activities: number
  activityTarget: number
  activityRatio: number | null
  overdueFollowups: number
  noNextStep: number
  stuck: number
  lastActivity: ISODate | null
  trend: { ym: string; value: number | null }[]
  pipeline: number
  weighted: number
}

export function repRow(ds: Dataset, p: Period, rep: Salesperson): RepRow {
  const f = { ownerId: rep.id }
  const won = revenueWon(ds, p, f)
  const plan = planFor(ds, p, f)
  const prorated = planFor(ds, { start: p.start, end: p.asOf }, f)
  const elapsed = { start: p.start, end: p.asOf }
  const acts = activitiesDone(ds, elapsed, f).length
  const target = activityTarget(ds, elapsed, f)
  const open = openDeals(ds, f)
  const currentYm = ds.today.slice(0, 7)
  return {
    rep,
    won,
    plan,
    attainment: plan ? won / plan : null,
    pace: prorated ? won / prorated : null,
    activities: acts,
    activityTarget: target,
    activityRatio: target ? acts / target : null,
    overdueFollowups: overdueFollowups(ds, f).length,
    noNextStep: dealsWithoutNextStep(ds, f).length,
    stuck: stuckDeals(ds, f).length,
    lastActivity: lastActivity(ds, rep.id),
    trend: [-3, -2, -1, 0].map((k) => {
      const ym = addMonthsToKey(currentYm, k)
      return { ym, value: monthAttainment(ds, ym, f) }
    }),
    pipeline: sum(open, (d) => d.value),
    weighted: sum(open, weightedValue),
  }
}

export function teamTable(ds: Dataset, p: Period): RepRow[] {
  return ds.salespeople.map((rep) => repRow(ds, p, rep))
}

export interface TeamSummary {
  teamId: TeamId
  name: string
  members: number
  won: number
  plan: number
  attainment: number | null
  forecast: number
  pipeline: number
  winRate: number | null
  activityRatio: number | null
  overdueFollowups: number
  noNextStep: number
  stuck: number
}

export function teamComparison(ds: Dataset, p: Period): TeamSummary[] {
  return ds.teams.map((t) => {
    const f = { teamId: t.id }
    const members = ds.salespeople.filter((s) => s.teamId === t.id)
    const ids = new Set(members.map((m) => m.id))
    const won = revenueWon(ds, p, f)
    const plan = planFor(ds, p, f)
    const elapsed = { start: p.start, end: p.asOf }
    const target = activityTarget(ds, elapsed, f)
    const fc = forecast(ds, p, f)
    return {
      teamId: t.id,
      name: t.name,
      members: members.length,
      won,
      plan,
      attainment: plan ? won / plan : null,
      forecast: fc.total,
      pipeline: sum(openDeals(ds, f), (d) => d.value),
      winRate: winRate(ds, p, f),
      activityRatio: target ? activitiesDone(ds, elapsed, f).length / target : null,
      overdueFollowups: ds.activities.filter((a) => ids.has(a.ownerId) && !a.doneAt && a.dueAt < ds.today).length,
      noNextStep: dealsWithoutNextStep(ds, f).length,
      stuck: stuckDeals(ds, f).length,
    }
  })
}

/** Activities done per week for the last `weeks` weeks (oldest first). */
export function weeklyActivities(ds: Dataset, ownerId: string, weeks = 13): { week: ISODate; count: number }[] {
  const thisWeek = startOfWeek(ds.today)
  const out: { week: ISODate; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i)
    const end = addDays(start, 6)
    out.push({ week: start, count: activitiesDone(ds, { start, end }, { ownerId }).length })
  }
  return out
}
