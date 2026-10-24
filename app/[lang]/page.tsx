import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { overviewView } from '@/lib/metrics/views/overview'
import { periodTitle } from '@/lib/metrics/period'
import { pageContext, type PageProps } from '@/lib/page'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { ProgressBar, Section } from '@/components/dashboard/primitives'
import { MetricLabel } from '@/components/dashboard/info-tip'
import { ExceptionList } from '@/components/dashboard/exception-list'
import { DrillButton, DrillLink } from '@/components/drill/drill-trigger'
import { SalesPlanChart } from '@/components/charts/sales-plan-chart'

export default async function OverviewPage(props: PageProps) {
  const { ctx, href, t, f } = await pageContext(props)
  const { formatCZK, formatCZKCompact, formatDays, formatPercent, formatRatio } = f
  const v = overviewView(ctx)
  const fc = v.forecast
  const closed = !ctx.period.isCurrent && ctx.period.end < ctx.ds.today

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.overview')} />

      <KpiGrid kpis={v.kpis} titles={{ 0: t('pages.overview.kpiWon'), 1: t('pages.overview.kpiForecast') }} />

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          title={t('pages.overview.salesTitle')}
          description={t('pages.overview.salesDesc', { months: v.sales.length })}
        >
          <SalesPlanChart data={v.sales} />
        </Section>

        <Section
          title={t('pages.overview.forecastTitle', { period: ctx.period.kind === 'month' ? periodTitle(ctx.period, ctx.i18n) : ctx.period.label })}
          description={t(closed ? 'pages.overview.forecastClosed' : 'pages.overview.forecastOpen')}
        >
          <div className="flex items-baseline justify-between gap-3">
            <DrillLink req={{ metric: 'weighted_forecast' }} className="text-[28px] font-semibold tracking-tight">
              {formatCZK(fc.total)}
            </DrillLink>
            <span className="text-sm text-muted-foreground">{t('pages.overview.ofPlan', { pct: formatPercent(fc.plan ? fc.total / fc.plan : 0, 0) })}</span>
          </div>
          <ProgressBar className="mt-3 h-2" value={fc.won} extra={fc.weighted} target={fc.plan} />
          <dl className="mt-4 flex flex-col divide-y divide-border/70 text-[13px]">
            <Row label={<MetricLabel id="revenue_won" label={t('pages.overview.alreadyWon')} />}>
              <DrillLink req={{ metric: 'revenue_won' }}>{formatCZK(fc.won)}</DrillLink>
            </Row>
            <Row label={t('pages.overview.weighted')}>
              <DrillLink req={{ metric: 'weighted_forecast' }}>{formatCZK(fc.weighted)}</DrillLink>
            </Row>
            <Row label={<MetricLabel id="plan" />}>
              <span className="tabular">{formatCZK(fc.plan)}</span>
            </Row>
            <Row label={t(fc.gap > 0 ? 'pages.overview.gap' : 'pages.overview.above')}>
              <span className={fc.gap > 0 ? 'tabular font-medium text-negative' : 'tabular font-medium text-positive'}>
                {formatCZK(Math.abs(fc.gap))}
              </span>
            </Row>
            <Row label={<MetricLabel id="coverage" />}>
              <span className="tabular">
                {fc.coverage === null ? t('pages.overview.planMet') : formatRatio(fc.coverage)}
                {fc.coverage !== null && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {t('pages.overview.inPipeline', { value: formatCZKCompact(fc.pipelineClosing) })}
                  </span>
                )}
              </span>
            </Row>
          </dl>
          {fc.coverage !== null && !closed && (
            <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {t(fc.coverage >= 3 ? 'pages.overview.coverageHigh' : fc.coverage >= 1.5 ? 'pages.overview.coverageMid' : 'pages.overview.coverageLow')}
            </p>
          )}
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          title={t('pages.overview.attention')}
          description={t('pages.overview.attentionDesc', { count: f.formatCount(v.exceptionCount, 'items'), value: formatCZKCompact(v.exceptionTotal) })}
          action={
            <Link
              href={href('/vyjimky')}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
            >
              {t('pages.overview.fullList')} <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          <ExceptionList items={v.exceptions} owners={v.owners} today={ctx.ds.today} />
        </Section>

        <Section title={t('pages.overview.chainTitle')} description={t('pages.overview.chainDesc', { period: ctx.period.label })}>
          <div className="flex flex-col gap-2">
            {v.chain.map((step, i) => {
              const prev = i > 0 ? v.chain[i - 1].value : null
              return (
                <div key={step.id}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-4 text-[11px] text-muted-foreground">
                      <ArrowRight className="size-3 rotate-90" />
                      {prev ? t('pages.overview.ofPrev', { pct: formatPercent(step.value / prev, 0) }) : '—'}
                    </div>
                  )}
                  <DrillButton
                    req={{ metric: step.id }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 ring-1 ring-foreground/[0.05] transition-colors hover:bg-muted/60"
                  >
                    <MetricLabel id={step.id} label={step.label} className="text-[13px] text-muted-foreground" />
                    <span className="tabular text-lg font-semibold tracking-tight">{formatCZK(step.value)}</span>
                  </DrillButton>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t('pages.overview.lagNote', { days: formatDays(v.lateness) })}
          </p>
        </Section>
      </div>
    </>
  )
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
