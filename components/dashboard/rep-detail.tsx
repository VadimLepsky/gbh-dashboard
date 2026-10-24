import { conversionWindow } from '@/lib/metrics/conversion'
import type { MetricContext } from '@/lib/metrics/context'
import type { repView } from '@/lib/metrics/views/team'
import { SalesPlanChart } from '@/components/charts/sales-plan-chart'
import { WeeklyChart } from '@/components/charts/weekly-chart'
import { ExceptionList } from './exception-list'
import { FunnelBars } from './funnel-bars'
import { EmptyState, Section } from './primitives'

/** Charts, funnel and exceptions of one rep (used on the rep page and in the single-rep team view). */
export function RepDetailBody({ ctx, v }: { ctx: MetricContext; v: NonNullable<ReturnType<typeof repView>> }) {
  const f = { ownerId: v.rep.id }
  const { t } = ctx.i18n
  const window = conversionWindow(ctx.period, ctx.i18n)
  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title={t('ui.repDetail.monthly')} description={t('ui.repDetail.monthlyDesc', { months: v.sales.length })}>
          <SalesPlanChart data={v.sales} filters={f} height={240} />
        </Section>
        <Section className="xl:col-span-2" title={t('ui.repDetail.weekly')} description={t('ui.repDetail.weeklyDesc', { weeks: v.weekly.length })}>
          <WeeklyChart data={v.weekly} target={v.weeklyTarget} height={232} />
        </Section>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title={t('ui.repDetail.pipeline')} description={t('ui.repDetail.pipelineDesc', { window: window.label })}>
          <FunnelBars rows={v.funnel} filters={f} windowLabel={window.label} />
        </Section>
        <Section className="xl:col-span-2" title={t('ui.repDetail.exceptions')} description={t('ui.repDetail.exceptionsDesc', { count: v.exceptions.length })}>
          {v.exceptions.length ? (
            <ExceptionList items={v.exceptions.slice(0, 8)} owners={{ [v.rep.id]: v.rep.name }} today={ctx.ds.today} />
          ) : (
            <EmptyState title={t('ui.repDetail.noExceptions')}>{t('ui.repDetail.noExceptionsText')}</EmptyState>
          )}
        </Section>
      </div>
    </>
  )
}
