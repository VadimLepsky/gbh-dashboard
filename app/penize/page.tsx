import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { buildContext } from '@/lib/metrics/context'
import { moneyView, PAYMENT_TERM_DAYS } from '@/lib/metrics/views/money'
import { INVOICE_AFTER_SIGN_DAYS } from '@/lib/metrics/money'
import { RULES } from '@/lib/metrics/exceptions-shared'
import { formatCount, formatCZK, formatCZKCompact, formatDate, formatDateShort, formatPercent } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { EmptyState, Pill, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillButton, DrillLink } from '@/components/drill/drill-trigger'
import { DsoChart } from '@/components/charts/dso-chart'
import { Legend } from '@/components/charts/chart-kit'

export const metadata: Metadata = { title: 'Peníze' }

const BUCKET_COLOR: Record<string, string> = {
  current: 'var(--chart-compare)',
  '1-30': 'color-mix(in oklab, var(--warning) 55%, var(--card))',
  '31-60': 'var(--warning)',
  '60+': 'var(--negative)',
}

export default async function MoneyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const v = moneyView(ctx)
  const steps = v.chain.steps
  const agTotal = v.aging.total || 1

  return (
    <>
      <PageHeader ctx={ctx} title="Peníze" description="Prodáno → fakturováno → uhrazeno" />

      <KpiGrid kpis={v.kpis} />

      <Section
        className="mt-3"
        title="Řetězec od výhry k penězům"
        description={`Dealy vyhrané v období ${ctx.period.label} a kde jsou dnes`}
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.id} className="relative">
              <DrillButton
                req={{ metric: 'chain', filters: { step: s.id } }}
                className="flex h-full w-full flex-col rounded-lg bg-surface px-4 py-3 ring-1 ring-foreground/[0.05] transition-colors hover:bg-muted/60"
              >
                <span className="text-xs text-muted-foreground">
                  {i + 1}. {s.label}
                </span>
                <span className="tabular mt-1 text-lg font-semibold tracking-tight">{formatCZK(s.value)}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {formatCount(s.count, ['deal', 'dealy', 'dealů'])}
                  {i > 0 && steps[0].value > 0 && <> · {formatPercent(s.value / steps[0].value, 0)} hodnoty</>}
                </span>
              </DrillButton>
              {i < steps.length - 1 && (
                <ArrowRight className="absolute top-1/2 -right-2.5 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground lg:block" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {v.chain.waitingSignature.length > 0 && (
            <DrillButton req={{ metric: 'unsigned_contracts' }}>
              <Pill tone="warning">
                {formatCount(v.chain.waitingSignature.length, ['smlouva čeká', 'smlouvy čekají', 'smluv čeká'])} na podpis déle než {RULES.unsignedDays} dní
              </Pill>
            </DrillButton>
          )}
          {v.chain.signedNotInvoiced.length > 0 && (
            <Pill tone="warning">
              {formatCount(v.chain.signedNotInvoiced.length, ['podepsaná smlouva', 'podepsané smlouvy', 'podepsaných smluv'])} bez faktury déle než {INVOICE_AFTER_SIGN_DAYS} dní
            </Pill>
          )}
          {v.chain.overdueInChain.length > 0 && (
            <DrillButton req={{ metric: 'overdue' }}>
              <Pill tone="negative">
                {formatCount(v.chain.overdueInChain.length, ['faktura', 'faktury', 'faktur'])} z těchto dealů po splatnosti
              </Pill>
            </DrillButton>
          )}
          {v.chain.waitingSignature.length + v.chain.signedNotInvoiced.length + v.chain.overdueInChain.length === 0 && (
            <Pill tone="positive">Nic se nezaseklo</Pill>
          )}
        </div>
      </Section>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Stáří pohledávek" description={`Neuhrazené faktury k ${formatDate(v.aging.asOf)} podle dní po splatnosti`}>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
            {v.aging.buckets.map((b) =>
              b.value > 0 ? (
                <DrillButton
                  key={b.id}
                  req={{ metric: 'receivables', filters: { bucket: b.id } }}
                  className="h-full rounded-none"
                  style={{ width: `${(b.value / agTotal) * 100}%`, background: BUCKET_COLOR[b.id] }}
                  title={`${b.label}: ${formatCZK(b.value)}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {v.aging.buckets.map((b) => (
              <DrillButton key={b.id} req={{ metric: 'receivables', filters: { bucket: b.id } }} className="flex flex-col rounded-md p-1 hover:bg-muted/50">
                <Legend items={[{ label: b.label, color: BUCKET_COLOR[b.id] }]} />
                <span className="tabular mt-1 text-[15px] font-semibold">{formatCZK(b.value)}</span>
              </DrillButton>
            ))}
          </div>
          <DataTable className="mt-4" minWidth={620}>
            <thead>
              <tr>
                <Th>Instituce</Th>
                {v.aging.buckets.map((b) => (
                  <Th key={b.id} align="right">
                    {b.label}
                  </Th>
                ))}
                <Th align="right">Celkem</Th>
              </tr>
            </thead>
            <tbody>
              {v.aging.rows.slice(0, 8).map((r) => (
                <tr key={r.institutionId} className="hover:bg-muted/40">
                  <Td className="max-w-[240px] truncate">
                    <DrillLink req={{ metric: 'receivables', filters: { institutionId: r.institutionId } }}>{r.name}</DrillLink>
                  </Td>
                  {v.aging.buckets.map((b) => (
                    <Td key={b.id} align="right" heat={b.id === '60+' && r.buckets[b.id] ? 'bad' : b.id === '31-60' && r.buckets[b.id] ? 'warn' : null} className={r.buckets[b.id] ? '' : 'text-muted-foreground/50'}>
                      {r.buckets[b.id] ? formatCZKCompact(r.buckets[b.id]) : '—'}
                    </Td>
                  ))}
                  <Td align="right" className="font-medium">
                    {formatCZK(r.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {v.aging.rows.length > 8 && (
            <p className="mt-2 text-xs text-muted-foreground">
              + {v.aging.rows.length - 8} dalších institucí · <DrillLink req={{ metric: 'receivables' }}>všechny pohledávky</DrillLink>
            </p>
          )}
        </Section>

        <Section className="xl:col-span-2" title="DSO po měsících" description="Průměrná doba od vystavení po úhradu faktury">
          <DsoChart data={v.dso} term={PAYMENT_TERM_DAYS} height={250} />
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Tržby a hrubá marže podle produktu" description={`Vyhrané dealy v období ${ctx.period.label}`}>
          {v.products.every((p) => p.revenue === 0) ? (
            <EmptyState title="V období nejsou vyhrané dealy" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {(() => {
                const max = Math.max(...v.products.map((p) => p.revenue), 1)
                return v.products.map((p) => (
                  <DrillButton
                    key={p.productId}
                    req={{ metric: 'product', filters: { productId: p.productId }, title: `Prodáno · ${p.name}` }}
                    className="group grid grid-cols-[minmax(0,10rem)_1fr_5.5rem] items-center gap-3 text-[13px]"
                  >
                    <span className="truncate group-hover:underline" title={p.name}>
                      {p.shortName}
                    </span>
                    <span className="relative h-5 rounded-[4px] bg-muted/60">
                      <span className="absolute inset-y-0 left-0 rounded-[4px] bg-chart-1" style={{ width: `${(p.revenue / max) * 100}%` }} />
                      <span
                        className="absolute inset-y-0 left-0 rounded-[4px] bg-chart-3/80"
                        style={{ width: `${(p.marginValue / max) * 100}%`, height: '40%', top: '30%' }}
                      />
                    </span>
                    <span className="tabular text-right">
                      <span className="font-medium">{formatCZKCompact(p.revenue)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        marže {p.margin === null ? '—' : formatPercent(p.margin, 0)}
                      </span>
                    </span>
                  </DrillButton>
                ))
              })()}
              <Legend
                className="mt-1"
                items={[
                  { label: 'Tržba', color: 'var(--chart-1)' },
                  { label: 'Hrubá marže v Kč', color: 'var(--chart-3)' },
                ]}
              />
            </div>
          )}
        </Section>

        <Section
          title="Nespárované platby"
          description={`Platby bez faktury a nejpravděpodobnější kandidát podle částky · ručně spárováno za 12 měsíců: ${v.manualLastYear}`}
        >
          {v.unmatched.length === 0 ? (
            <EmptyState title="Všechny platby jsou spárované" />
          ) : (
            <div className="flex flex-col gap-2">
              {v.unmatched.map((u) => (
                <DrillButton
                  key={u.id}
                  req={{ metric: 'record', filters: { type: 'payment', id: u.id } }}
                  className="flex flex-col gap-2 rounded-lg bg-surface p-3 ring-1 ring-foreground/[0.05] hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">
                      {formatCZK(u.amount)} · {formatDateShort(u.receivedAt)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.counterparty} · VS {u.vs}
                    </span>
                  </span>
                  <span className="text-xs sm:text-right">
                    {u.candidate ? (
                      <>
                        <span className="block font-medium">→ {u.candidate.number}</span>
                        <span className="block text-muted-foreground">
                          VS {u.candidate.vs} · shoda částky{u.alternatives ? ` (+${u.alternatives} další)` : ''}
                        </span>
                      </>
                    ) : (
                      <Pill tone="warning">bez kandidáta</Pill>
                    )}
                  </span>
                </DrillButton>
              ))}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Faktura kandidáta se v systému tváří jako nezaplacená, a proto může strašit v pohledávkách po splatnosti.
                Po ručním spárování zmizí z upomínek.
              </p>
            </div>
          )}
        </Section>
      </div>
    </>
  )
}
