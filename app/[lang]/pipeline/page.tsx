import type { Metadata } from 'next'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { CLOSING_SOON_DAYS, pipelineView } from '@/lib/metrics/views/pipeline'
import { STUCK_FACTOR } from '@/lib/metrics/sales'
import { PageHeader } from '@/components/shell/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { Section } from '@/components/dashboard/primitives'
import { FunnelBars } from '@/components/dashboard/funnel-bars'
import { ForecastBars } from '@/components/dashboard/forecast-bars'
import { KrajMap } from '@/components/dashboard/kraj-map'
import { DealList } from '@/components/dashboard/deal-list'
import { DrillButton } from '@/components/drill/drill-trigger'
import { InfoTip } from '@/components/dashboard/info-tip'
import { metricText } from '@/lib/metrics/dictionary'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.pipeline')
}

export default async function PipelinePage(props: PageProps) {
  const { ctx, t, f, i18n } = await pageContext(props)
  const { formatCZK, formatNumber } = f
  const stuckText = metricText(i18n, 'stuck_deals')
  const v = pipelineView(ctx)

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.pipeline')} description={t('pages.pipeline.description')} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {v.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
        <DrillButton
          req={{ metric: 'closing_soon', filters: { days: CLOSING_SOON_DAYS } }}
          className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-shadow hover:shadow-sm hover:ring-foreground/15"
        >
          <span className="text-[13px] text-muted-foreground">{t('pages.pipeline.closingIn', { days: f.formatDays(CLOSING_SOON_DAYS) })}</span>
          <span className="tabular mt-1 text-[26px] leading-tight font-semibold tracking-tight">{formatCZK(v.soonValue)}</span>
          <span className="mt-1 text-xs text-muted-foreground">{t('pages.pipeline.closingNote', { count: f.formatCount(v.soon.length, 'deals') })}</span>
        </DrillButton>
        <DrillButton
          req={{ metric: 'stuck_deals' }}
          className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-shadow hover:shadow-sm hover:ring-foreground/15"
        >
          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
            {stuckText.label} <InfoTip text={stuckText.definition} formula={stuckText.formula} />
          </span>
          <span className="tabular mt-1 text-[26px] leading-tight font-semibold tracking-tight">{formatNumber(v.stuck.length)}</span>
          <span className="mt-1 text-xs text-muted-foreground">{t('pages.pipeline.worth', { value: formatCZK(v.stuckValue) })}</span>
        </DrillButton>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section
          className="xl:col-span-3"
          title={t('pages.pipeline.funnel')}
          description={t('pages.pipeline.funnelDesc', { window: v.window.label })}
        >
          <FunnelBars rows={v.funnel} windowLabel={v.window.label} />
        </Section>
        <Section className="xl:col-span-2" title={t('pages.pipeline.byKraj')} description={t('pages.pipeline.byKrajDesc')}>
          <KrajMap tiles={v.kraje} />
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title={t('pages.pipeline.byRep')} description={t('pages.pipeline.byRepDesc', { period: ctx.period.label })}>
          <ForecastBars rows={v.byRep} />
        </Section>
        <div className="flex flex-col gap-3">
          {v.byTeam.length > 0 && (
            <Section title={t('pages.pipeline.byTeam')} description={ctx.period.label}>
              <ForecastBars rows={v.byTeam} legend={false} />
            </Section>
          )}
          <Section className="flex-1" title={t('pages.pipeline.soon', { days: CLOSING_SOON_DAYS })} description={t('pages.pipeline.soonDesc')}>
            <DealList rows={v.soon} mode="closing" today={ctx.ds.today} empty={t('pages.pipeline.soonEmpty', { days: f.formatDays(CLOSING_SOON_DAYS) })} limit={6} />
          </Section>
        </div>
      </div>

      <Section className="mt-3" title={t('pages.pipeline.stuck')} description={t('pages.pipeline.stuckDesc', { factor: STUCK_FACTOR })}>
        <DealList rows={v.stuck} mode="stuck" today={ctx.ds.today} empty={t('pages.pipeline.stuckEmpty')} limit={12} />
      </Section>
    </>
  )
}
