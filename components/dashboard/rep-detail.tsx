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
  const window = conversionWindow(ctx.period)
  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Měsíční plnění" description={`Prodáno vs. osobní plán, ${v.sales.length} měsíců. Klikněte na sloupec pro dealy.`}>
          <SalesPlanChart data={v.sales} filters={f} height={240} />
        </Section>
        <Section className="xl:col-span-2" title="Aktivity po týdnech" description={`Hovory, e-maily, schůzky a follow-upy za posledních ${v.weekly.length} týdnů`}>
          <WeeklyChart data={v.weekly} target={v.weeklyTarget} height={232} />
        </Section>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Pipeline obchodníka" description={`Otevřené dealy dnes, konverze za ${window.label}`}>
          <FunnelBars rows={v.funnel} filters={f} windowLabel={window.label} />
        </Section>
        <Section className="xl:col-span-2" title="Výjimky obchodníka" description={`${v.exceptions.length} položek k řešení`}>
          {v.exceptions.length ? (
            <ExceptionList items={v.exceptions.slice(0, 8)} owners={{ [v.rep.id]: v.rep.name }} today={ctx.ds.today} />
          ) : (
            <EmptyState title="Žádné výjimky">Obchodník má pipeline v pořádku.</EmptyState>
          )}
        </Section>
      </div>
    </>
  )
}
