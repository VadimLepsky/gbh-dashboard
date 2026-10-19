import type { Metadata } from 'next'
import { buildContext } from '@/lib/metrics/context'
import { repView, teamView } from '@/lib/metrics/views/team'
import { RepDetailBody } from '@/components/dashboard/rep-detail'
import { STUCK_FACTOR } from '@/lib/metrics/sales'
import { formatCZK, formatNumber, formatPercent } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { ProgressBar, Section, Stat } from '@/components/dashboard/primitives'
import { MetricLabel } from '@/components/dashboard/info-tip'
import { TeamTable } from '@/components/dashboard/team-table'
import { DrillLink } from '@/components/drill/drill-trigger'

export const metadata: Metadata = { title: 'Disciplína týmu' }

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const v = teamView(ctx)
  const s = v.summary
  // A single-rep scope (obchodník) gets their own detail right here instead of an empty page.
  const single = v.rows.length === 1 ? repView(ctx, v.rows[0].rep.id) : null

  return (
    <>
      <PageHeader ctx={ctx} title="Disciplína týmu" description="Kdo pracuje a kdo zaostává" hideCompare />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile>
          <Stat
            label={<MetricLabel id="attainment" label="Plnění plánu (tempo)" />}
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
                {formatNumber(s.activities)} z {formatNumber(s.activityTarget)}
              </DrillLink>
            }
          />
        </Tile>
        <Tile>
          <Stat
            label={<MetricLabel id="overdue_followups" />}
            value={<DrillLink req={{ metric: 'overdue_followups' }}>{formatNumber(s.overdueFollowups)}</DrillLink>}
            sub="stav k dnešku"
          />
        </Tile>
        <Tile>
          <Stat
            label={<MetricLabel id="no_next_step" />}
            value={<DrillLink req={{ metric: 'no_next_step' }}>{formatNumber(s.noNextStep)}</DrillLink>}
            sub="otevřených dealů"
          />
        </Tile>
        <Tile className="col-span-2 lg:col-span-1">
          <Stat
            label={<MetricLabel id="stuck_deals" />}
            value={<DrillLink req={{ metric: 'stuck_deals' }}>{formatNumber(s.stuck)}</DrillLink>}
            sub={`déle než ${STUCK_FACTOR}× obvyklá doba`}
          />
        </Tile>
      </div>

      <Section
        title="Obchodníci"
        description={`${ctx.period.label} · podbarvené buňky vyžadují pozornost · kliknutím na řádek otevřete detail obchodníka, na číslo jeho záznamy`}
      >
        <TeamTable rows={v.rows} today={ctx.ds.today} isCurrent={ctx.period.isCurrent} />
        <p className="mt-3 text-xs text-muted-foreground">
          Plnění = prodáno / plán za celé období; svislá čárka v pruhu ukazuje, kde by obchodník měl být k dnešku. Trend =
          plnění za poslední {Math.max(0, (v.rows[0]?.trend.length ?? 1) - 1)} měsíce a průběžně tento měsíc.
        </p>
      </Section>

      {single && <RepDetailBody ctx={ctx} v={single} />}

      {v.teams.length > 1 && (
        <Section className="mt-3" title="Čechy vs. Morava" description={ctx.period.label}>
          <div className="grid gap-6 md:grid-cols-2">
            {v.teams.map((t) => (
              <div key={t.teamId} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold">
                    {t.name} <span className="font-normal text-muted-foreground">· {t.members} obchodníci</span>
                  </div>
                  <DrillLink req={{ metric: 'revenue_won', filters: { teamId: t.teamId } }} className="text-sm font-semibold">
                    {formatPercent(t.attainment ?? 0, 0)} plánu
                  </DrillLink>
                </div>
                <ProgressBar value={t.won} target={t.plan} />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                  <Pair label="Prodáno">
                    <DrillLink req={{ metric: 'revenue_won', filters: { teamId: t.teamId } }}>{formatCZK(t.won)}</DrillLink>
                  </Pair>
                  <Pair label="Plán">{formatCZK(t.plan)}</Pair>
                  <Pair label="Vážená prognóza">
                    <DrillLink req={{ metric: 'weighted_forecast', filters: { teamId: t.teamId } }}>{formatCZK(t.forecast)}</DrillLink>
                  </Pair>
                  <Pair label="Pipeline">
                    <DrillLink req={{ metric: 'pipeline', filters: { teamId: t.teamId } }}>{formatCZK(t.pipeline)}</DrillLink>
                  </Pair>
                  <Pair label="Win rate">
                    <DrillLink req={{ metric: 'win_rate', filters: { teamId: t.teamId } }}>
                      {t.winRate === null ? '—' : formatPercent(t.winRate, 0)}
                    </DrillLink>
                  </Pair>
                  <Pair label="Aktivity vůči cíli">
                    <DrillLink req={{ metric: 'activities_done', filters: { teamId: t.teamId } }}>
                      {formatPercent(t.activityRatio ?? 0, 0)}
                    </DrillLink>
                  </Pair>
                  <Pair label="Zpožděné follow-upy">{formatNumber(t.overdueFollowups)}</Pair>
                  <Pair label="Bez kroku / zaseknuté">
                    {formatNumber(t.noNextStep)} / {formatNumber(t.stuck)}
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
