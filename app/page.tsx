import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { buildContext } from '@/lib/metrics/context'
import { overviewView } from '@/lib/metrics/views/overview'
import { formatCZK, formatCZKCompact, formatPercent, formatRatio } from '@/lib/format'
import { periodTitle } from '@/lib/metrics/period'
import { withState } from '@/lib/query'
import { PageHeader } from '@/components/shell/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ProgressBar, Section } from '@/components/dashboard/primitives'
import { MetricLabel } from '@/components/dashboard/info-tip'
import { ExceptionList } from '@/components/dashboard/exception-list'
import { DrillButton, DrillLink } from '@/components/drill/drill-trigger'
import { SalesPlanChart } from '@/components/charts/sales-plan-chart'

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const ctx = buildContext(params)
  const v = overviewView(ctx)
  const fc = v.forecast
  const closed = !ctx.period.isCurrent && ctx.period.end < ctx.ds.today

  return (
    <>
      <PageHeader ctx={ctx} title="Přehled" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5">
        {v.kpis.map((k, i) => (
          <KpiCard
            key={k.id}
            kpi={k}
            title={i === 0 ? 'Prodáno vs. plán' : i === 1 ? 'Prognóza na konec období' : undefined}
            className={i < 2 ? 'lg:col-span-3 2xl:col-span-1' : i === 4 ? 'sm:col-span-2 lg:col-span-2 2xl:col-span-1' : 'lg:col-span-2 2xl:col-span-1'}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          title="Prodáno vs. plán"
          description="Posledních 12 měsíců. Kliknutím na sloupec zobrazíte dealy daného měsíce."
        >
          <SalesPlanChart data={v.sales} />
        </Section>

        <Section
          title={ctx.period.kind === 'month' ? `Prognóza · ${periodTitle(ctx.period)}` : `Prognóza · ${ctx.period.label}`}
          description={closed ? 'Období je uzavřené, prognóza = skutečnost.' : 'Vyhrané dealy + otevřené dealy vážené pravděpodobností fáze.'}
        >
          <div className="flex items-baseline justify-between gap-3">
            <DrillLink req={{ metric: 'weighted_forecast' }} className="text-[28px] font-semibold tracking-tight">
              {formatCZK(fc.total)}
            </DrillLink>
            <span className="text-sm text-muted-foreground">{formatPercent(fc.plan ? fc.total / fc.plan : 0, 0)} plánu</span>
          </div>
          <ProgressBar className="mt-3 h-2" value={fc.won} extra={fc.weighted} target={fc.plan} />
          <dl className="mt-4 flex flex-col divide-y divide-border/70 text-[13px]">
            <Row label={<MetricLabel id="revenue_won" label="Už vyhráno" />}>
              <DrillLink req={{ metric: 'revenue_won' }}>{formatCZK(fc.won)}</DrillLink>
            </Row>
            <Row label="Vážená pipeline">
              <DrillLink req={{ metric: 'weighted_forecast' }}>{formatCZK(fc.weighted)}</DrillLink>
            </Row>
            <Row label={<MetricLabel id="plan" />}>
              <span className="tabular">{formatCZK(fc.plan)}</span>
            </Row>
            <Row label={fc.gap > 0 ? 'Chybí do plánu' : 'Nad plánem'}>
              <span className={fc.gap > 0 ? 'tabular font-medium text-negative' : 'tabular font-medium text-positive'}>
                {formatCZK(Math.abs(fc.gap))}
              </span>
            </Row>
            <Row label={<MetricLabel id="coverage" />}>
              <span className="tabular">
                {fc.coverage === null ? 'plán splněn' : formatRatio(fc.coverage)}
                {fc.coverage !== null && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({formatCZKCompact(fc.pipelineClosing)} v pipeline)
                  </span>
                )}
              </span>
            </Row>
          </dl>
          {fc.coverage !== null && !closed && (
            <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {fc.coverage >= 3
                ? 'Krytí nad 3× – plán je realistický, pokud se uzavřou dealy ve vyjednávání.'
                : fc.coverage >= 1.5
                  ? 'Krytí mezi 1,5× a 3× – bez dalších dealů bude plán těsný.'
                  : 'Krytí pod 1,5× – na splnění plánu nestačí ani celá pipeline.'}
            </p>
          )}
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          title="Vyžaduje pozornost"
          description={`${v.exceptionCount} položek za ${formatCZKCompact(v.exceptionTotal)} · seřazeno podle Kč × naléhavosti`}
          action={
            <Link
              href={withState('/vyjimky', params)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
            >
              Celý seznam <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          <ExceptionList items={v.exceptions} owners={v.owners} today={ctx.ds.today} />
        </Section>

        <Section title="Od prodeje k penězům" description={`Toky v období ${ctx.period.label}`}>
          <div className="flex flex-col gap-2">
            {v.chain.map((step, i) => {
              const prev = i > 0 ? v.chain[i - 1].value : null
              return (
                <div key={step.id}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-4 text-[11px] text-muted-foreground">
                      <ArrowRight className="size-3 rotate-90" />
                      {prev ? `${formatPercent(step.value / prev, 0)} předchozího kroku` : '—'}
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
            Fakturace i úhrady se zpožďují za prodejem: školení se fakturuje po podpisu a dodání, státní instituce
            platí v průměru 1–3 týdny po splatnosti.
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
