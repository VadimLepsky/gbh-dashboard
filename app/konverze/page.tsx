import type { Metadata } from 'next'
import { buildContext } from '@/lib/metrics/context'
import { conversionBySource, conversionWindow, cycleBy, leaks, lostByReason, stageConversions } from '@/lib/metrics/conversion'
import { lookup } from '@/lib/metrics/lookup'
import { OPEN_STAGES } from '@/lib/data/types'
import { formatCZK, formatCZKCompact, formatDays, formatNumber, formatPercent } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillButton } from '@/components/drill/drill-trigger'
import { Legend } from '@/components/charts/chart-kit'

export const metadata: Metadata = { title: 'Konverze a úniky' }

/** Fewer closed stages than this → shown, but greyed out as too little data. */
const MIN_SAMPLE = 5

const STAGE_SHORT: Record<string, string> = {
  Kontakt: 'Kontakt → Kval.',
  Kvalifikace: 'Kval. → Nabídka',
  Nabídka: 'Nabídka → Vyjedn.',
  Vyjednávání: 'Vyjedn. → Smlouva',
  'Smlouva k podpisu': 'Smlouva → Vyhráno',
}

export default async function ConversionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const { ds, period } = ctx
  const window = conversionWindow(period)
  const matrix = conversionBySource(ds, window)
  const avg = stageConversions(ds, window)
  const reasons = lostByReason(ds, window)
  const bySource = cycleBy(ds, window, 'source')
  const byType = cycleBy(ds, window, 'institutionType')
  const top = leaks(ds, window, 5)
  const lk = lookup(ds)
  const totalLost = reasons.reduce((s, r) => s + r.value, 0)
  const won = matrix.reduce((s, r) => s + (r.winRate ?? 0) * r.closed, 0)
  const closed = matrix.reduce((s, r) => s + r.closed, 0)

  const tint = (rate: number | null, base: number | null, n: number) => {
    if (rate === null || base === null || n < MIN_SAMPLE) return undefined
    const diff = rate - base
    const strength = Math.min(1, Math.abs(diff) / 0.25)
    if (Math.abs(diff) < 0.03) return undefined
    return `color-mix(in oklab, var(${diff > 0 ? '--positive' : '--negative'}) ${Math.round(8 + strength * 26)}%, var(--card))`
  }

  return (
    <>
      <PageHeader ctx={ctx} title="Konverze a úniky" description="Kde nám utíkají peníze" hideCompare />
      {window.widened && (
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          Konverze potřebují dost uzavřených fází, proto tato stránka počítá za {window.label}.
        </p>
      )}

      <Section
        title="Konverze mezi fázemi podle zdroje leadu"
        description="Barva = rozdíl proti průměru dané fáze (zeleně lépe, červeně hůř). V závorce počet dealů, které fázi opustily."
      >
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <Th>Zdroj</Th>
              {OPEN_STAGES.map((s) => (
                <Th key={s} align="right">
                  {STAGE_SHORT[s]}
                </Th>
              ))}
              <Th align="right">Win rate</Th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.key}>
                <Td className="font-medium whitespace-nowrap">{row.label}</Td>
                {row.cells.map((c, i) => (
                  <Td key={c.stage} align="right" className="p-0">
                    <DrillButton
                      req={{ metric: 'stage_cohort', filters: { stage: c.stage, sourceId: row.key } }}
                      className="block w-full rounded-none px-3 py-2.5 text-right hover:outline hover:outline-1 hover:outline-foreground/20"
                      style={{ background: tint(c.rate, avg[i].rate, c.left) }}
                    >
                      <span className={c.left < MIN_SAMPLE ? 'text-muted-foreground/60' : 'font-medium'}>
                        {c.rate === null ? '—' : formatPercent(c.rate, 0)}
                      </span>
                      <span className="ml-1 text-[11px] text-muted-foreground">({c.left})</span>
                    </DrillButton>
                  </Td>
                ))}
                <Td align="right">
                  <DrillButton req={{ metric: 'win_rate', filters: { sourceId: row.key, range: 'window' } }} className="font-semibold hover:underline">
                    {row.winRate === null ? '—' : formatPercent(row.winRate, 0)}
                  </DrillButton>
                  <span className="ml-1 text-[11px] text-muted-foreground">({row.closed})</span>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface">
              <Td className="font-medium">Průměr</Td>
              {avg.map((c) => (
                <Td key={c.stage} align="right" className="font-medium">
                  {c.rate === null ? '—' : formatPercent(c.rate, 0)}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">({c.left})</span>
                </Td>
              ))}
              <Td align="right" className="font-semibold">
                {closed ? formatPercent(won / closed, 0) : '—'}
              </Td>
            </tr>
          </tfoot>
        </DataTable>
      </Section>

      <Section className="mt-3" title="Top 5 úniků v Kč" description="Očekávaná ztracená tržba proti průměrné konverzi fáze (dealy, které měly postoupit, × pravděpodobnost další fáze) · doporučený krok podle pravidel">
        {top.length === 0 ? (
          <EmptyState title="Žádné výrazné úniky">V okně je málo uzavřených fází nebo jsou všechny kolem průměru.</EmptyState>
        ) : (
          <ol className={top.length === 5 ? 'grid gap-2 md:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5' : 'grid gap-2 md:grid-cols-2 xl:grid-cols-3'}>
            {top.map((l, i) => (
              <li key={l.id} className={top.length === 5 ? (i < 2 ? 'lg:col-span-3 2xl:col-span-1' : i === 4 ? 'md:col-span-2 lg:col-span-2 2xl:col-span-1' : 'lg:col-span-2 2xl:col-span-1') : undefined}>
                <DrillButton
                  req={{
                    metric: 'stage_cohort',
                    filters: { stage: l.stage, ...(l.dimension === 'source' ? { sourceId: l.key } : { ownerId: l.key }) },
                    title: `Únik · ${l.stage} × ${l.label}`,
                  }}
                  className="flex h-full w-full flex-col gap-2 rounded-lg bg-surface p-3.5 ring-1 ring-foreground/[0.05] transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {i + 1}. {l.stage} × {l.dimension === 'source' ? 'zdroj' : 'obchodník'}
                    </span>
                    <span className="tabular text-sm font-semibold text-negative">−{formatCZKCompact(l.amount)}</span>
                  </span>
                  <span className="text-[13.5px] font-medium">{l.label}</span>
                  <span className="text-xs text-muted-foreground">
                    Konverze {formatPercent(l.rate, 0)} vs. průměr {formatPercent(l.avgRate, 0)} · {l.left} dealů
                    {l.topReason ? ` · nejčastěji „${l.topReason}“` : ''}
                  </span>
                  <span className="mt-auto border-t border-border/60 pt-2 text-xs leading-relaxed">
                    <span className="font-medium">Doporučení:</span> {l.action}
                    <span className="block text-muted-foreground">Vlastník: {l.ownerId ? lk.rep.get(l.ownerId)?.name : '—'}</span>
                  </span>
                </DrillButton>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section title="Prohrané dealy podle důvodu" description={`Ztracená hodnota ${formatCZK(totalLost)}`}>
          <Bars
            rows={reasons.map((r) => ({
              key: r.reason,
              label: r.reason,
              value: r.value,
              text: formatCZKCompact(r.value),
              sub: `${formatNumber(r.count)} dealů`,
              req: { metric: 'lost', filters: { reason: r.reason, range: 'window' } },
            }))}
            color="var(--chart-2)"
          />
        </Section>
        <Section title="Délka cyklu podle zdroje" description="Medián dní od založení po výhru">
          <Bars
            rows={bySource.map((g) => ({
              key: g.key,
              label: g.label,
              value: g.median ?? 0,
              text: formatDays(g.median),
              sub: `${g.count} výher`,
              req: { metric: 'cycle', filters: { sourceId: g.key } },
            }))}
            color="var(--chart-7)"
          />
        </Section>
        <Section title="Délka cyklu podle typu instituce" description="Medián dní od založení po výhru">
          <Bars
            rows={byType.map((g) => ({
              key: g.key,
              label: g.label,
              value: g.median ?? 0,
              text: formatDays(g.median),
              sub: `${g.count} výher`,
              req: { metric: 'cycle', filters: { institutionType: g.key } },
            }))}
            color="var(--chart-7)"
          />
          <Legend className="mt-3" items={[{ label: 'Medián dní', color: 'var(--chart-7)' }]} />
        </Section>
      </div>
    </>
  )
}

function Bars({
  rows,
  color,
}: {
  rows: { key: string; label: string; value: number; text: string; sub: string; req: { metric: string; filters: Record<string, string> } }[]
  color: string
}) {
  if (!rows.length) return <EmptyState title="Bez dat v okně" />
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <DrillButton key={r.key} req={r.req} className="group grid grid-cols-[8.5rem_1fr_5rem] items-center gap-3 text-[13px]">
          <span className="truncate group-hover:underline">{r.label}</span>
          <span className="h-4 rounded-[4px] bg-muted/60">
            <span className="block h-full rounded-[4px]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="tabular text-right">
            <span className="font-medium">{r.text}</span>
            <span className="block text-[11px] text-muted-foreground">{r.sub}</span>
          </span>
        </DrillButton>
      ))}
    </div>
  )
}
