import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buildContext } from '@/lib/metrics/context'
import { repView } from '@/lib/metrics/views/team'
import { getDataset } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { withState } from '@/lib/query'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { EmptyState } from '@/components/dashboard/primitives'
import { RepDetailBody } from '@/components/dashboard/rep-detail'

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

  return (
    <>
      <div className="mb-3">{back}</div>
      <PageHeader ctx={ctx} title={v.rep.name} description={`${v.rep.role} · tým ${v.rep.teamId === 'cechy' ? 'Čechy' : 'Morava'} · od ${formatDate(v.rep.startDate)}`} />

      <KpiGrid kpis={v.kpis} titles={{ 0: 'Prodáno vs. plán', 1: 'Prognóza na konec období', 4: 'Aktivity vůči cíli' }} />

      <RepDetailBody ctx={ctx} v={v} />
    </>
  )
}
