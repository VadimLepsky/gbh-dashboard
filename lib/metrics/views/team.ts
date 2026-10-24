import type { MetricContext } from '../context'
import { exceptions } from '../exceptions'
import { funnel } from '../conversion'
import { makeKpi } from '../kpi'
import { compareLabel } from '../period'
import { forecast, openDeals, planFor, revenueWon, sum, weightedValue, winRate } from '../sales'
import { salesVsPlan, chartEndMonth } from '../series'
import { activitiesDone, activityTarget, overdueFollowups, repRow, teamComparison, teamTable, weeklyActivities } from '../team'
import { dealsWithoutNextStep, stuckDeals } from '../sales'

export type Heat = 'bad' | 'warn' | 'good' | null

export function teamView(ctx: MetricContext) {
  const { ds, period } = ctx
  const rows = teamTable(ds, period).map((r) => ({
    ...r,
    heat: {
      pace: (r.pace === null ? null : r.pace < 0.7 ? 'bad' : r.pace < 0.9 ? 'warn' : r.pace >= 1.15 ? 'good' : null) as Heat,
      activity: (r.activityRatio === null ? null : r.activityRatio < 0.6 ? 'bad' : r.activityRatio < 0.85 ? 'warn' : null) as Heat,
      overdue: (r.overdueFollowups >= 5 ? 'bad' : r.overdueFollowups >= 2 ? 'warn' : null) as Heat,
      noNext: (r.noNextStep >= 5 ? 'bad' : r.noNextStep >= 3 ? 'warn' : null) as Heat,
      stuck: (r.stuck >= 3 ? 'bad' : r.stuck >= 2 ? 'warn' : null) as Heat,
    },
  }))
  const elapsed = { start: period.start, end: period.asOf }
  const won = revenueWon(ds, period)
  const plan = planFor(ds, period)
  const prorated = planFor(ds, elapsed)
  const acts = activitiesDone(ds, elapsed).length
  const target = activityTarget(ds, elapsed)
  return {
    rows,
    teams: teamComparison(ds, period),
    summary: {
      won,
      plan,
      pace: prorated ? won / prorated : null,
      activities: acts,
      activityTarget: target,
      overdueFollowups: overdueFollowups(ds).length,
      noNextStep: dealsWithoutNextStep(ds).length,
      stuck: stuckDeals(ds).length,
    },
  }
}

export function repView(ctx: MetricContext, repId: string) {
  const { ds, full, period, compare, cmpMode, i18n } = ctx
  const { t, tn } = i18n
  const { formatCZKCompact, formatPercent, formatNumber } = i18n.f
  const rep = ds.salespeople.find((s) => s.id === repId)
  if (!rep) return null
  const f = { ownerId: rep.id }
  const row = repRow(ds, period, rep)
  const fc = forecast(ds, period, f)
  const open = openDeals(ds, f)
  const endYm = chartEndMonth(period, ds.today)
  const cmpLabel = compareLabel(cmpMode, compare, i18n)
  const prevLabel = compareLabel('prev', compare, i18n)
  const elapsedCmp = { start: compare.start, end: compare.asOf }
  const weekly = weeklyActivities(ds, rep.id, 13)

  return {
    rep,
    row,
    kpis: [
      makeKpi(i18n, 'revenue_won', row.won, cmpMode === 'plan' ? row.plan : revenueWon(ds, compare, f), cmpLabel, { metric: 'revenue_won', filters: f }, {
        progress: { value: row.won, target: row.plan, label: t('views.ofPlan', { pct: formatPercent(row.attainment ?? 0, 0), plan: formatCZKCompact(row.plan) }) },
      }),
      makeKpi(i18n, 'weighted_forecast', fc.total, fc.plan, t('compare.vsPlan'), { metric: 'weighted_forecast', filters: f }, {
        progress: { value: fc.won, extra: fc.weighted, target: fc.plan, label: t('views.weightedPipeline', { value: formatCZKCompact(fc.weighted) }) },
      }),
      makeKpi(i18n, 'pipeline', sum(open, (d) => d.value), null, `${tn('drill.count.openDeals', open.length)} · ${t('views.weighted', { value: formatCZKCompact(sum(open, weightedValue)) })}`, { metric: 'pipeline', filters: f }),
      makeKpi(i18n, 'win_rate', winRate(ds, period, f), winRate(ds, compare, f), prevLabel, { metric: 'win_rate', filters: f }),
      makeKpi(
        i18n,
        'activities_done',
        row.activityRatio,
        (() => {
          const target = activityTarget(ds, elapsedCmp, f)
          return target ? activitiesDone(ds, elapsedCmp, f).length / target : null
        })(),
        prevLabel,
        { metric: 'activities_done', filters: f },
        { note: t('views.activitiesOf', { done: formatNumber(row.activities), target: formatNumber(row.activityTarget) }) },
      ),
    ],
    sales: salesVsPlan(ds, endYm, 12, f),
    weekly: weekly.map((w) => ({ label: w.week, value: w.count })),
    weeklyTarget: (rep.monthlyActivityTarget * 7) / 30.4,
    funnel: funnel(ds, period, f, i18n),
    exceptions: exceptions(ds, full, i18n).filter((e) => e.ownerId === rep.id),
  }
}
