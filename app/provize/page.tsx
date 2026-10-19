import type { Metadata } from 'next'
import { buildContext } from '@/lib/metrics/context'
import { commissionSummary, coefficientFor } from '@/lib/metrics/commissions'
import { compareLabel } from '@/lib/metrics/period'
import { makeKpi } from '@/lib/metrics/kpi'
import { formatCoef, formatCZK, formatPercent } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { Pill, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillLink } from '@/components/drill/drill-trigger'
import { MetricLabel } from '@/components/dashboard/info-tip'

export const metadata: Metadata = { title: 'Provize' }

const coef = formatCoef

export default async function CommissionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const { ds, period, compare } = ctx
  const s = commissionSummary(ds, period)
  const c = commissionSummary(ds, compare)
  const label = compareLabel('prev', compare)
  const kpis = [
    makeKpi('commission_payable', s.payable, c.payable, label, { metric: 'commission_payable' }, {
      note: `z uhrazených tržeb ${formatCZK(s.paidRevenue)}`,
    }),
    makeKpi('commission_pending', s.pending, c.pending, label, { metric: 'commission_pending' }, {
      note: 'vyplatí se po úhradě faktur',
    }),
    makeKpi('collected', s.paidRevenue, c.paidRevenue, label, { metric: 'collected' }, {
      note: 'základ pro provize v období',
    }),
  ]
  const bands = ds.commissionProfiles[0].bands
  const multiMonth = period.kind !== 'month'

  return (
    <>
      <PageHeader ctx={ctx} title="Provize" description="Provize vzniká úhradou faktury" />
      <KpiGrid kpis={kpis} titles={{ 2: 'Uhrazené tržby' }} />

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-4">
        <Section
          className="xl:col-span-3"
          title="Provize podle obchodníků"
          description={`${period.label} · kliknutím na jméno zobrazíte, z jakých faktur provize je a co ještě čeká na úhradu`}
        >
          <DataTable minWidth={760}>
            <thead>
              <tr>
                <Th>Obchodník</Th>
                <Th align="right">Uhrazená tržba</Th>
                <Th align="right">Sazba</Th>
                <Th align="right">{period.isCurrent ? 'Plnění (průběžně)' : 'Plnění plánu'}</Th>
                <Th align="right">{multiMonth ? 'Ø koeficient' : 'Koeficient'}</Th>
                <Th align="right">
                  <MetricLabel id="commission_payable" label="K výplatě" />
                </Th>
                <Th align="right">
                  <MetricLabel id="commission_pending" label="Čeká" />
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
                      <span className="block text-xs text-muted-foreground">{r.role}</span>
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
                <Td>Celkem</Td>
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

        <Section title="Pravidlo" description="Stejné pro celý tým">
          <p className="rounded-lg bg-primary-soft px-3 py-2.5 text-[13px] font-medium text-primary">
            Provize vzniká úhradou faktury.
          </p>
          <div className="mt-4 text-xs font-medium text-muted-foreground">Základní sazba z uhrazené tržby</div>
          <dl className="mt-1.5 flex flex-col gap-1 text-[13px]">
            {ds.commissionProfiles.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-border/60 pb-1">
                <dt>{p.role}</dt>
                <dd className="tabular font-medium">{formatPercent(p.baseRate, 0)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 text-xs font-medium text-muted-foreground">Koeficient KPI podle plnění plánu v měsíci</div>
          <dl className="mt-1.5 flex flex-col gap-1 text-[13px]">
            {bands.map((b) => (
              <div key={b.label} className="flex justify-between border-b border-border/60 pb-1">
                <dt>{b.label}</dt>
                <dd className="tabular font-medium">× {coef(b.coefficient)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            K výplatě = uhrazená tržba × sazba × koeficient měsíce úhrady. Čeká = vyhrané, ale dosud nezaplacené částky
            (nevyfakturované i neuhrazené) × sazba × aktuální koeficient. Běžící měsíc se hodnotí poměrně k dnešku.
          </p>
        </Section>
      </div>
    </>
  )
}
