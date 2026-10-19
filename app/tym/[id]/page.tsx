import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buildContext } from '@/lib/metrics/context'
import { repView } from '@/lib/metrics/views/team'
import { conversionWindow } from '@/lib/metrics/conversion'
import { getDataset } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { withState } from '@/lib/query'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { EmptyState, Section } from '@/components/dashboard/primitives'
import { ExceptionList } from '@/components/dashboard/exception-list'
import { FunnelBars } from '@/components/dashboard/funnel-bars'
import { SalesPlanChart } from '@/components/charts/sales-plan-chart'
import { WeeklyChart } from '@/components/charts/weekly-chart'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const rep = getDataset().salespeople.find((s) => s.id === id)
  return { title: rep ? rep.name : 'Obchodník' }
}

export default async function RepPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const ctx = buildContext(sp)
  const v = repView(ctx, id)

  const back = (
    <Link href={withState('/tym', sp)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-3.5" /> Disciplína týmu
    </Link>
  )

  if (!v) {
    return (
      <>
        <div className="mb-3">{back}</div>
        <EmptyState title="Obchodník je mimo váš přístup">
          V roli, kterou máte zvolenou, vidíte jen data svého týmu nebo svá vlastní.
        </EmptyState>
      </>
    )
  }

  const f = { ownerId: v.rep.id }
  return (
    <>
      <div className="mb-3">{back}</div>
      <PageHeader ctx={ctx} title={v.rep.name} description={`${v.rep.role} · tým ${v.rep.teamId === 'cechy' ? 'Čechy' : 'Morava'} · od ${formatDate(v.rep.startDate)}`} />

      <KpiGrid kpis={v.kpis} titles={{ 0: 'Prodáno vs. plán', 1: 'Prognóza na konec období', 4: 'Aktivity vůči cíli' }} />

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Měsíční plnění" description="Prodáno vs. osobní plán, 12 měsíců. Klikněte na sloupec pro dealy.">
          <SalesPlanChart data={v.sales} filters={f} height={240} />
        </Section>
        <Section className="xl:col-span-2" title="Aktivity po týdnech" description="Hovory, e-maily, schůzky a follow-upy za posledních 13 týdnů">
          <WeeklyChart data={v.weekly} target={v.weeklyTarget} height={232} />
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Pipeline obchodníka" description={`Otevřené dealy dnes, konverze za ${conversionWindow(ctx.period).label}`}>
          <FunnelBars rows={v.funnel} filters={f} windowLabel={conversionWindow(ctx.period).label} />
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
