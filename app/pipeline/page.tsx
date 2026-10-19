import type { Metadata } from 'next'
import { buildContext } from '@/lib/metrics/context'
import { CLOSING_SOON_DAYS, pipelineView } from '@/lib/metrics/views/pipeline'
import { STUCK_FACTOR } from '@/lib/metrics/sales'
import { formatCZK, formatNumber } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Section } from '@/components/dashboard/primitives'
import { FunnelBars } from '@/components/dashboard/funnel-bars'
import { ForecastBars } from '@/components/dashboard/forecast-bars'
import { KrajMap } from '@/components/dashboard/kraj-map'
import { DealList } from '@/components/dashboard/deal-list'
import { DrillButton } from '@/components/drill/drill-trigger'
import { InfoTip } from '@/components/dashboard/info-tip'
import { METRICS } from '@/lib/metrics/dictionary'

export const metadata: Metadata = { title: 'Pipeline a prognóza' }

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const v = pipelineView(ctx)

  return (
    <>
      <PageHeader ctx={ctx} title="Pipeline a prognóza" description="Splníme plán?" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {v.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
        <DrillButton
          req={{ metric: 'closing_soon', filters: { days: CLOSING_SOON_DAYS } }}
          className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-shadow hover:shadow-sm hover:ring-foreground/15"
        >
          <span className="text-[13px] text-muted-foreground">Uzavírání do {CLOSING_SOON_DAYS} dní</span>
          <span className="tabular mt-1 text-[26px] leading-tight font-semibold tracking-tight">{formatCZK(v.soonValue)}</span>
          <span className="mt-1 text-xs text-muted-foreground">{formatNumber(v.soon.length)} dealů s očekávaným uzavřením</span>
        </DrillButton>
        <DrillButton
          req={{ metric: 'stuck_deals' }}
          className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-shadow hover:shadow-sm hover:ring-foreground/15"
        >
          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
            {METRICS.stuck_deals.label} <InfoTip text={METRICS.stuck_deals.definition} />
          </span>
          <span className="tabular mt-1 text-[26px] leading-tight font-semibold tracking-tight">{formatNumber(v.stuck.length)}</span>
          <span className="mt-1 text-xs text-muted-foreground">za {formatCZK(v.stuckValue)}</span>
        </DrillButton>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section
          className="xl:col-span-3"
          title="Trychtýř podle fází"
          description={`Otevřené dealy dnes. Konverze a doba ve fázi za ${v.window.label}. Červeně = výrazně pod průměrem.`}
        >
          <FunnelBars rows={v.funnel} windowLabel={v.window.label} />
        </Section>
        <Section className="xl:col-span-2" title="Prognóza podle krajů" description="Vyhráno + vážená pipeline v období">
          <KrajMap tiles={v.kraje} />
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Vážená prognóza vs. plán · obchodníci" description={`${ctx.period.label} · seřazeno podle plnění`}>
          <ForecastBars rows={v.byRep} />
        </Section>
        <div className="flex flex-col gap-3">
          {v.byTeam.length > 0 && (
            <Section title="Prognóza podle týmů" description={ctx.period.label}>
              <ForecastBars rows={v.byTeam} legend={false} />
            </Section>
          )}
          <Section className="flex-1" title={`Uzavírání v příštích ${CLOSING_SOON_DAYS} dnech`} description="Co musí dopadnout, aby prognóza platila">
            <DealList rows={v.soon} mode="closing" today={ctx.ds.today} empty={`Žádné dealy s uzavřením do ${CLOSING_SOON_DAYS} dní`} limit={6} />
          </Section>
        </div>
      </div>

      <Section className="mt-3" title="Zaseknuté dealy" description={`Ve fázi déle než ${STUCK_FACTOR}× obvyklá doba, seřazeno podle hodnoty`}>
        <DealList rows={v.stuck} mode="stuck" today={ctx.ds.today} empty="Žádné zaseknuté dealy" limit={12} />
      </Section>
    </>
  )
}
