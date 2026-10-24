import type { Metadata } from 'next'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { commissionSummary, coefficientFor } from '@/lib/metrics/commissions'
import { compareLabel } from '@/lib/metrics/period'
import { makeKpi } from '@/lib/metrics/kpi'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { Pill, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillLink } from '@/components/drill/drill-trigger'
import { MetricLabel } from '@/components/dashboard/info-tip'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.commissions')
}

export default async function CommissionPage(props: PageProps) {
  const { ctx, i18n, t, term, f } = await pageContext(props)
  const { formatCoef: coef, formatCZK, formatNumber, formatPercent } = f
  const { ds, period, compare } = ctx
  const s = commissionSummary(ds, period)
  const c = commissionSummary(ds, compare)
  const label = compareLabel('prev', compare, i18n)
  const kpis = [
    makeKpi(i18n, 'commission_payable', s.payable, c.payable, label, { metric: 'commission_payable' }, {
      note: t('pages.commissions.fromPaid', { value: formatCZK(s.paidRevenue) }),
    }),
    makeKpi(i18n, 'commission_pending', s.pending, c.pending, label, { metric: 'commission_pending' }, {
      note: t('pages.commissions.paidLater'),
    }),
    makeKpi(i18n, 'collected', s.paidRevenue, c.paidRevenue, label, { metric: 'collected' }, {
      note: t('pages.commissions.base'),
    }),
  ]
  const bands = ds.commissionProfiles[0].bands
  const multiMonth = period.kind !== 'month'
  const bandLabel = (b: (typeof bands)[number]) =>
    b.max === null ? `> ${formatPercent(b.min, 0)}` : b.min === 0 ? `< ${formatPercent(b.max, 0)}` : `${formatNumber(b.min * 100)}–${formatPercent(b.max, 0)}`

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.commissions')} description={t('pages.commissions.description')} />
      <KpiGrid kpis={kpis} titles={{ 2: t('pages.commissions.kpiPaid') }} />

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-4">
        <Section
          className="xl:col-span-3"
          title={t('pages.commissions.byRep')}
          description={t('pages.commissions.byRepDesc', { period: period.label })}
        >
          <DataTable minWidth={760}>
            <thead>
              <tr>
                <Th>{t('pages.commissions.rep')}</Th>
                <Th align="right">{t('pages.commissions.paidRevenue')}</Th>
                <Th align="right">{t('pages.commissions.rate')}</Th>
                <Th align="right">{t(period.isCurrent ? 'pages.commissions.attainmentRunning' : 'pages.commissions.attainment')}</Th>
                <Th align="right">{t(multiMonth ? 'pages.commissions.avgCoef' : 'pages.commissions.coef')}</Th>
                <Th align="right">
                  <MetricLabel id="commission_payable" label={t('pages.commissions.payable')} />
                </Th>
                <Th align="right">
                  <MetricLabel id="commission_pending" label={t('pages.commissions.pending')} />
                </Th>
              </tr>
            </thead>
            <tbody>
              {s.reps.map((r) => {
                const band = coefficientFor(r.attainment)
                return (
                  <tr key={r.repId} className="hover:bg-muted/40">
                    <Td>
                      <DrillLink req={{ metric: 'commission_payable', filters: { ownerId: r.repId, all: 1 } }} className="font-medium">
                        {r.name}
                      </DrillLink>
                      <span className="block text-xs text-muted-foreground">{term('role', r.role)}</span>
                    </Td>
                    <Td align="right">
                      <DrillLink req={{ metric: 'collected', filters: { ownerId: r.repId } }}>{formatCZK(r.paidRevenue)}</DrillLink>
                    </Td>
                    <Td align="right">{formatPercent(r.rate, 0)}</Td>
                    <Td align="right">{r.attainment === null ? '—' : formatPercent(r.attainment, 0)}</Td>
                    <Td align="right">
                      <Pill tone={band > 1 ? 'positive' : band < 1 ? 'negative' : 'muted'}>× {coef(multiMonth ? r.coefficient : band)}</Pill>
                    </Td>
                    <Td align="right" className="font-semibold">
                      <DrillLink req={{ metric: 'commission_payable', filters: { ownerId: r.repId } }}>{formatCZK(r.payable)}</DrillLink>
                    </Td>
                    <Td align="right" className="text-muted-foreground">
                      <DrillLink req={{ metric: 'commission_pending', filters: { ownerId: r.repId } }}>{formatCZK(r.pending)}</DrillLink>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface font-medium">
                <Td>{t('pages.commissions.total')}</Td>
                <Td align="right">{formatCZK(s.paidRevenue)}</Td>
                <Td />
                <Td />
                <Td />
                <Td align="right" className="font-semibold">
                  {formatCZK(s.payable)}
                </Td>
                <Td align="right">{formatCZK(s.pending)}</Td>
              </tr>
            </tfoot>
          </DataTable>
        </Section>

        <Section title={t('pages.commissions.rule')} description={t('pages.commissions.ruleDesc')}>
          <p className="rounded-lg bg-primary-soft px-3 py-2.5 text-[13px] font-medium text-primary">
            {t('pages.commissions.ruleText')}
          </p>
          <div className="mt-4 text-xs font-medium text-muted-foreground">{t('pages.commissions.baseRate')}</div>
          <dl className="mt-1.5 flex flex-col gap-1 text-[13px]">
            {ds.commissionProfiles.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-border/60 pb-1">
                <dt>{term('role', p.role)}</dt>
                <dd className="tabular font-medium">{formatPercent(p.baseRate, 0)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 text-xs font-medium text-muted-foreground">{t('pages.commissions.coefTitle')}</div>
          <dl className="mt-1.5 flex flex-col gap-1 text-[13px]">
            {bands.map((b) => (
              <div key={b.label} className="flex justify-between border-b border-border/60 pb-1">
                <dt>{bandLabel(b)}</dt>
                <dd className="tabular font-medium">× {coef(b.coefficient)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {t('pages.commissions.explain')}
          </p>
        </Section>
      </div>
    </>
  )
}
