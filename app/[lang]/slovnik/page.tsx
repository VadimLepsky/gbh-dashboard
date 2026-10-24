import type { Metadata } from 'next'
import { Check, X } from 'lucide-react'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { METRIC_LIST, metricText } from '@/lib/metrics/dictionary'
import { reconcile } from '@/lib/metrics/reconcile'
import { PageHeader } from '@/components/shell/page-header'
import { Pill, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillLink } from '@/components/drill/drill-trigger'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.dictionary')
}

export default async function DictionaryPage(props: PageProps) {
  const { ctx, i18n, t, f } = await pageContext(props)
  const { formatCZK, formatDate, formatNumber } = f
  const rc = reconcile(ctx.ds)
  const allOk = rc.rows.every((r) => r.ok)

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.dictionary')} description={t('pages.dictionary.description')} hidePeriod />

      <Section
        title={t('pages.dictionary.check')}
        description={t('pages.dictionary.checkDesc', { date: formatDate(ctx.ds.historyStart) })}
        action={<Pill tone={allOk ? 'positive' : 'negative'}>{t(allOk ? 'pages.dictionary.allOk' : 'pages.dictionary.mismatch')}</Pill>}
      >
        <DataTable minWidth={720}>
          <thead>
            <tr>
              <Th>{t('pages.dictionary.source')}</Th>
              <Th>{t('pages.dictionary.records')}</Th>
              <Th align="right">{t('pages.dictionary.count')}</Th>
              <Th align="right">{t('pages.dictionary.sourceSum')}</Th>
              <Th align="right">{t('pages.dictionary.dashboardSum')}</Th>
              <Th align="center">{t('pages.dictionary.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {rc.rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <span className="font-medium">{t(`reconcile.${r.id}.source`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`reconcile.${r.id}.system`)}</span>
                </Td>
                <Td>{t(`reconcile.${r.id}.label`)}</Td>
                <Td align="right">{formatNumber(r.sourceCount)}</Td>
                <Td align="right">{formatCZK(r.sourceValue)}</Td>
                <Td align="right">{formatCZK(r.dashboardValue)}</Td>
                <Td align="center">
                  {r.ok ? (
                    <Check className="mx-auto size-4 text-positive" aria-label={t('pages.dictionary.ok')} />
                  ) : (
                    <X className="mx-auto size-4 text-negative" aria-label={t('pages.dictionary.notOk')} />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-warning-soft p-3">
            <div className="text-xs text-warning">{t('pages.dictionary.unmatched')}</div>
            <div className="mt-0.5 text-lg font-semibold">
              <DrillLink req={{ metric: 'unmatched_payments' }}>{formatNumber(rc.unmatchedCount)}</DrillLink>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('pages.dictionary.unmatchedSub', { value: formatCZK(rc.unmatchedValue), total: f.formatCount(rc.totalPayments, 'payments') })}
            </div>
          </div>
          <div className="rounded-lg bg-surface p-3 ring-1 ring-foreground/[0.05]">
            <div className="text-xs text-muted-foreground">{t('pages.dictionary.openDeals')}</div>
            <div className="mt-0.5 text-lg font-semibold">
              <DrillLink req={{ metric: 'pipeline' }}>{formatNumber(rc.openDeals)}</DrillLink>
            </div>
            <div className="text-xs text-muted-foreground">{t('pages.dictionary.openDealsSub')}</div>
          </div>
          <div className="rounded-lg bg-surface p-3 ring-1 ring-foreground/[0.05]">
            <div className="text-xs text-muted-foreground">{t('pages.dictionary.lostDeals')}</div>
            <div className="mt-0.5 text-lg font-semibold">{formatNumber(rc.lostDeals)}</div>
            <div className="text-xs text-muted-foreground">{t('pages.dictionary.lostDealsSub')}</div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t('pages.dictionary.note')}
        </p>
      </Section>

      <Section className="mt-3" title={t('pages.dictionary.definitions')} description={t('pages.dictionary.definitionsDesc')}>
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <Th>{t('pages.dictionary.metric')}</Th>
              <Th>{t('pages.dictionary.definition')}</Th>
              <Th>{t('pages.dictionary.formula')}</Th>
              <Th>{t('pages.dictionary.unit')}</Th>
              <Th>{t('pages.dictionary.good')}</Th>
            </tr>
          </thead>
          <tbody>
            {METRIC_LIST.map((m) => ({ ...m, ...metricText(i18n, m.id) })).map((m) => (
              <tr key={m.id} className="align-top">
                <Td className="font-medium whitespace-nowrap">
                  {m.label}
                  <span className="block font-mono text-[10.5px] font-normal text-muted-foreground">{m.id}</span>
                </Td>
                <Td className="min-w-64">{m.definition}</Td>
                <Td className="min-w-64 font-mono text-[11.5px] text-muted-foreground">{m.formula}</Td>
                <Td className="whitespace-nowrap">{t(`pages.dictionary.units.${m.unit}`)}</Td>
                <Td className="whitespace-nowrap">{t(m.goodDirection === 'up' ? 'pages.dictionary.up' : 'pages.dictionary.down')}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Section>
    </>
  )
}
