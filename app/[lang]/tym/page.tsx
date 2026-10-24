import type { Metadata } from 'next'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { repView, teamView } from '@/lib/metrics/views/team'
import { RepDetailBody } from '@/components/dashboard/rep-detail'
import { STUCK_FACTOR } from '@/lib/metrics/sales'
import { PageHeader } from '@/components/shell/page-header'
import { ProgressBar, Section, Stat } from '@/components/dashboard/primitives'
import { MetricLabel } from '@/components/dashboard/info-tip'
import { TeamTable } from '@/components/dashboard/team-table'
import { DrillLink } from '@/components/drill/drill-trigger'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.team')
}

export default async function TeamPage(props: PageProps) {
  const { ctx, t, term, f } = await pageContext(props)
  const { formatCZK, formatNumber, formatPercent } = f
  const v = teamView(ctx)
  const s = v.summary
  // A single-rep scope (obchodník) gets their own detail right here instead of an empty page.
  const single = v.rows.length === 1 ? repView(ctx, v.rows[0].rep.id) : null

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.team')} description={t('pages.team.description')} hideCompare />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile>
          <Stat
            label={<MetricLabel id="attainment" label={t('pages.team.pace')} />}
            value={s.pace === null ? '—' : formatPercent(s.pace, 0)}
            sub={<DrillLink req={{ metric: 'revenue_won' }}>{formatCZK(s.won)}</DrillLink>}
          />
        </Tile>
        <Tile>
          <Stat
            label={<MetricLabel id="activities_done" />}
            value={formatPercent(s.activityTarget ? s.activities / s.activityTarget : 0, 0)}
            sub={
              <DrillLink req={{ metric: 'activities_done' }}>
                {t('pages.team.ofTarget', { done: formatNumber(s.activities), target: formatNumber(s.activityTarget) })}
              </DrillLink>
            }
          />
        </Tile>
        <Tile>
          <Stat
            label={<MetricLabel id="overdue_followups" />}
            value={<DrillLink req={{ metric: 'overdue_followups' }}>{formatNumber(s.overdueFollowups)}</DrillLink>}
            sub={t('pages.team.asOfToday')}
          />
        </Tile>
        <Tile>
          <Stat
            label={<MetricLabel id="no_next_step" />}
            value={<DrillLink req={{ metric: 'no_next_step' }}>{formatNumber(s.noNextStep)}</DrillLink>}
            sub={t('pages.team.openDeals')}
          />
        </Tile>
        <Tile className="col-span-2 lg:col-span-1">
          <Stat
            label={<MetricLabel id="stuck_deals" />}
            value={<DrillLink req={{ metric: 'stuck_deals' }}>{formatNumber(s.stuck)}</DrillLink>}
            sub={t('pages.team.longer', { factor: STUCK_FACTOR })}
          />
        </Tile>
      </div>

      <Section
        title={t('pages.team.reps')}
        description={t('pages.team.repsDesc', { period: ctx.period.label })}
      >
        <TeamTable rows={v.rows} today={ctx.ds.today} isCurrent={ctx.period.isCurrent} />
        <p className="mt-3 text-xs text-muted-foreground">
          {t('pages.team.note', { months: Math.max(0, (v.rows[0]?.trend.length ?? 1) - 1) })}
        </p>
      </Section>

      {single && <RepDetailBody ctx={ctx} v={single} />}

      {v.teams.length > 1 && (
        <Section className="mt-3" title={t('pages.team.teams', { a: term('team', 'cechy'), b: term('team', 'morava') })} description={ctx.period.label}>
          <div className="grid gap-6 md:grid-cols-2">
            {v.teams.map((team) => (
              <div key={team.teamId} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold">
                    {term('team', team.teamId)} <span className="font-normal text-muted-foreground">· {f.formatCount(team.members, 'reps')}</span>
                  </div>
                  <DrillLink req={{ metric: 'revenue_won', filters: { teamId: team.teamId } }} className="text-sm font-semibold">
                    {t('pages.team.ofPlan', { pct: formatPercent(team.attainment ?? 0, 0) })}
                  </DrillLink>
                </div>
                <ProgressBar value={team.won} target={team.plan} />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                  <Pair label={t('pages.team.sold')}>
                    <DrillLink req={{ metric: 'revenue_won', filters: { teamId: team.teamId } }}>{formatCZK(team.won)}</DrillLink>
                  </Pair>
                  <Pair label={t('pages.team.plan')}>{formatCZK(team.plan)}</Pair>
                  <Pair label={t('pages.team.forecast')}>
                    <DrillLink req={{ metric: 'weighted_forecast', filters: { teamId: team.teamId } }}>{formatCZK(team.forecast)}</DrillLink>
                  </Pair>
                  <Pair label={t('pages.team.pipeline')}>
                    <DrillLink req={{ metric: 'pipeline', filters: { teamId: team.teamId } }}>{formatCZK(team.pipeline)}</DrillLink>
                  </Pair>
                  <Pair label={t('pages.team.winRate')}>
                    <DrillLink req={{ metric: 'win_rate', filters: { teamId: team.teamId } }}>
                      {team.winRate === null ? '—' : formatPercent(team.winRate, 0)}
                    </DrillLink>
                  </Pair>
                  <Pair label={t('pages.team.activities')}>
                    <DrillLink req={{ metric: 'activities_done', filters: { teamId: team.teamId } }}>
                      {formatPercent(team.activityRatio ?? 0, 0)}
                    </DrillLink>
                  </Pair>
                  <Pair label={t('pages.team.overdueFu')}>{formatNumber(team.overdueFollowups)}</Pair>
                  <Pair label={t('pages.team.noStepStuck')}>
                    {formatNumber(team.noNextStep)} / {formatNumber(team.stuck)}
                  </Pair>
                </dl>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] ${className ?? ''}`}>{children}</div>
}

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-right font-medium">{children}</dd>
    </div>
  )
}
