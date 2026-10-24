import type { Metadata } from 'next'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { exceptions, ruleTexts } from '@/lib/metrics/exceptions'
import { PageHeader } from '@/components/shell/page-header'
import { Section, Stat } from '@/components/dashboard/primitives'
import { ExceptionsTable } from '@/components/dashboard/exceptions-table'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.exceptions')
}

export default async function ExceptionsPage(props: PageProps) {
  const { ctx, i18n, t, f } = await pageContext(props)
  const { formatCZK, formatNumber } = f
  const items = exceptions(ctx.ds, ctx.full, i18n)
  const owners = Object.fromEntries(ctx.ds.salespeople.map((s) => [s.id, s.name]))
  const urgent = items.filter((i) => i.deadline <= ctx.ds.today)
  const total = items.reduce((s, i) => s + i.amount, 0)
  const byOwner = new Map<string, number>()
  for (const i of items) if (i.ownerId) byOwner.set(i.ownerId, (byOwner.get(i.ownerId) ?? 0) + i.amount)
  const top = [...byOwner.entries()].sort((a, b) => b[1] - a[1])[0]

  return (
    <>
      <PageHeader
        ctx={ctx}
        title={t('nav.items.exceptions')}
        description={t('pages.exceptions.description')}
        hidePeriod
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat label={t('pages.exceptions.open')} value={formatNumber(items.length)} sub={t('pages.exceptions.asOfToday')} />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat label={t('pages.exceptions.atRisk')} value={formatCZK(total)} sub={t('pages.exceptions.sumAll')} />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat label={t('pages.exceptions.today')} value={formatNumber(urgent.length)} sub={formatCZK(urgent.reduce((s, i) => s + i.amount, 0))} />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat
            label={t('pages.exceptions.topOwner')}
            value={top ? owners[top[0]] : '—'}
            sub={top ? formatCZK(top[1]) : undefined}
          />
        </div>
      </div>
      <Section
        title={t('pages.exceptions.list')}
        description={t('pages.exceptions.listDesc')}
      >
        <ExceptionsTable items={items} owners={owners} today={ctx.ds.today} />
      </Section>
      <Section className="mt-3" title={t('pages.exceptions.rules')} description={t('pages.exceptions.rulesDesc')}>
        <ul className="grid list-disc gap-x-8 gap-y-1.5 pl-4 text-[13px] text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
          {Object.values(ruleTexts(i18n)).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </Section>
    </>
  )
}
