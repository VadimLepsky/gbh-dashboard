import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { pageContext, type PageProps } from '@/lib/page'
import { getI18n, localeFrom } from '@/lib/i18n'
import { repView } from '@/lib/metrics/views/team'
import { getDataset } from '@/lib/data'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { EmptyState } from '@/components/dashboard/primitives'
import { RepDetailBody } from '@/components/dashboard/rep-detail'

type Props = PageProps<{ id: string }>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, lang } = await params
  const rep = getDataset().salespeople.find((s) => s.id === id)
  return { title: rep ? rep.name : getI18n(localeFrom(lang)).t('pages.rep.fallbackTitle') }
}

export default async function RepPage(props: Props) {
  const { ctx, route, href, t, term, f } = await pageContext(props)
  const v = repView(ctx, route.id)

  const back = (
    <Link href={href('/tym')} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-3.5" /> {t('pages.rep.back')}
    </Link>
  )

  if (!v) {
    return (
      <>
        <div className="mb-3">{back}</div>
        <EmptyState title={t('pages.rep.noAccess')}>{t('pages.rep.noAccessText')}</EmptyState>
      </>
    )
  }

  return (
    <>
      <div className="mb-3">{back}</div>
      <PageHeader ctx={ctx} title={v.rep.name} description={t('pages.rep.description', { role: term('role', v.rep.role), team: term('team', v.rep.teamId), date: f.formatDate(v.rep.startDate) })} />

      <KpiGrid kpis={v.kpis} titles={{ 0: t('pages.rep.kpiWon'), 1: t('pages.rep.kpiForecast'), 4: t('pages.rep.kpiActivities') }} />

      <RepDetailBody ctx={ctx} v={v} />
    </>
  )
}
