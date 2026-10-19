import type { Metadata } from 'next'
import { Check, X } from 'lucide-react'
import { buildContext } from '@/lib/metrics/context'
import { METRIC_LIST } from '@/lib/metrics/dictionary'
import { reconcile } from '@/lib/metrics/reconcile'
import { formatCZK, formatDate, formatNumber } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { Pill, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillLink } from '@/components/drill/drill-trigger'

export const metadata: Metadata = { title: 'Slovník metrik' }

const UNIT_LABEL: Record<string, string> = {
  czk: 'Kč',
  percent: '%',
  days: 'dny',
  int: 'počet',
  ratio: 'násobek',
}

export default async function DictionaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const rc = reconcile(ctx.ds)
  const allOk = rc.rows.every((r) => r.ok)

  return (
    <>
      <PageHeader ctx={ctx} title="Slovník metrik" description="Jedna definice pro každé číslo v dashboardu" hidePeriod />

      <Section
        title="Kontrola dat"
        description={`Součty ze zdrojových systémů vedle součtů, které počítá dashboard, za celou historii od ${formatDate(ctx.ds.historyStart)}`}
        action={<Pill tone={allOk ? 'positive' : 'negative'}>{allOk ? 'Vše sedí' : 'Nesoulad'}</Pill>}
      >
        <DataTable minWidth={720}>
          <thead>
            <tr>
              <Th>Zdroj</Th>
              <Th>Záznamy</Th>
              <Th align="right">Počet</Th>
              <Th align="right">Součet ve zdroji</Th>
              <Th align="right">Součet v dashboardu</Th>
              <Th align="center">Stav</Th>
            </tr>
          </thead>
          <tbody>
            {rc.rows.map((r) => (
              <tr key={`${r.source}-${r.label}`}>
                <Td>
                  <span className="font-medium">{r.source}</span>
                  <span className="block text-xs text-muted-foreground">{r.system}</span>
                </Td>
                <Td>{r.label}</Td>
                <Td align="right">{formatNumber(r.sourceCount)}</Td>
                <Td align="right">{formatCZK(r.sourceValue)}</Td>
                <Td align="right">{formatCZK(r.dashboardValue)}</Td>
                <Td align="center">
                  {r.ok ? (
                    <Check className="mx-auto size-4 text-positive" aria-label="sedí" />
                  ) : (
                    <X className="mx-auto size-4 text-negative" aria-label="nesedí" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-warning-soft p-3">
            <div className="text-xs text-warning">Nespárované platby</div>
            <div className="mt-0.5 text-lg font-semibold">
              <DrillLink req={{ metric: 'unmatched_payments' }}>{formatNumber(rc.unmatchedCount)}</DrillLink>
            </div>
            <div className="text-xs text-muted-foreground">
              za {formatCZK(rc.unmatchedValue)} z celkem {formatNumber(rc.totalPayments)} plateb
            </div>
          </div>
          <div className="rounded-lg bg-surface p-3 ring-1 ring-foreground/[0.05]">
            <div className="text-xs text-muted-foreground">Otevřené dealy</div>
            <div className="mt-0.5 text-lg font-semibold">
              <DrillLink req={{ metric: 'pipeline' }}>{formatNumber(rc.openDeals)}</DrillLink>
            </div>
            <div className="text-xs text-muted-foreground">nevstupují do prodeje, jen do pipeline</div>
          </div>
          <div className="rounded-lg bg-surface p-3 ring-1 ring-foreground/[0.05]">
            <div className="text-xs text-muted-foreground">Prohrané dealy</div>
            <div className="mt-0.5 text-lg font-semibold">{formatNumber(rc.lostDeals)}</div>
            <div className="text-xs text-muted-foreground">základ pro win rate a analýzu úniků</div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Spárované platby z banky se musí rovnat uhrazeným fakturám. Platba s chybným variabilním symbolem zůstane
          nespárovaná, dokud ji účtárna nepřiřadí ručně, a proto je vedená zvlášť.
        </p>
      </Section>

      <Section className="mt-3" title="Definice" description="Stejné definice jsou v nápovědě u každého čísla (ikonka ?)">
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <Th>Metrika</Th>
              <Th>Definice</Th>
              <Th>Vzorec</Th>
              <Th>Jednotka</Th>
              <Th>Dobře je</Th>
            </tr>
          </thead>
          <tbody>
            {METRIC_LIST.map((m) => (
              <tr key={m.id} className="align-top">
                <Td className="font-medium whitespace-nowrap">
                  {m.label}
                  <span className="block font-mono text-[10.5px] font-normal text-muted-foreground">{m.id}</span>
                </Td>
                <Td className="min-w-64">{m.definition}</Td>
                <Td className="min-w-64 font-mono text-[11.5px] text-muted-foreground">{m.formula}</Td>
                <Td className="whitespace-nowrap">{UNIT_LABEL[m.unit] ?? m.unitLabel}</Td>
                <Td className="whitespace-nowrap">{m.goodDirection === 'up' ? '↑ víc' : '↓ míň'}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Section>
    </>
  )
}
