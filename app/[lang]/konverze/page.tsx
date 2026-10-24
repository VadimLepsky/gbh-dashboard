import type { Metadata } from 'next'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { conversionBySource, conversionWindow, cycleBy, leaks, lostByReason, stageConversions } from '@/lib/metrics/conversion'
import { lookup } from '@/lib/metrics/lookup'
import { OPEN_STAGES } from '@/lib/data/types'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Section } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillButton } from '@/components/drill/drill-trigger'
import { Legend } from '@/components/charts/chart-kit'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.conversion')
}

/** Fewer closed stages than this → shown, but greyed out as too little data. */
const MIN_SAMPLE = 5

export default async function ConversionPage(props: PageProps) {
  const { ctx, i18n, t, tn, term, f } = await pageContext(props)
  const { formatCZK, formatCZKCompact, formatDays, formatPercent } = f
  const { ds, period } = ctx
  const window = conversionWindow(period, i18n)
  const matrix = conversionBySource(ds, window, i18n)
  const avg = stageConversions(ds, window)
  const reasons = lostByReason(ds, window)
  const bySource = cycleBy(ds, window, 'source', i18n)
  const byType = cycleBy(ds, window, 'institutionType', i18n)
  const top = leaks(ds, window, 5, i18n)
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
      <PageHeader ctx={ctx} title={t('nav.items.conversion')} description={t('pages.conversion.description')} hideCompare />
      {window.widened && (
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          {t('pages.conversion.widened', { window: window.label })}
        </p>
      )}

      <Section
        title={t('pages.conversion.matrix')}
        description={t('pages.conversion.matrixDesc')}
      >
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <Th>{t('pages.conversion.source')}</Th>
              {OPEN_STAGES.map((s) => (
                <Th key={s} align="right">
                  {t(`pages.conversion.stageShort.${s}`)}
                </Th>
              ))}
              <Th align="right">{t('pages.conversion.winRate')}</Th>
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
              <Td className="font-medium">{t('pages.conversion.average')}</Td>
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

      <Section className="mt-3" title={t('pages.conversion.leaks')} description={t('pages.conversion.leaksDesc')}>
        {top.length === 0 ? (
          <EmptyState title={t('pages.conversion.noLeaks')}>{t('pages.conversion.noLeaksText')}</EmptyState>
        ) : (
          <ol className={top.length === 5 ? 'grid gap-2 md:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5' : 'grid gap-2 md:grid-cols-2 xl:grid-cols-3'}>
            {top.map((l, i) => (
              <li key={l.id} className={top.length === 5 ? (i < 2 ? 'lg:col-span-3 2xl:col-span-1' : i === 4 ? 'md:col-span-2 lg:col-span-2 2xl:col-span-1' : 'lg:col-span-2 2xl:col-span-1') : undefined}>
                <DrillButton
                  req={{
                    metric: 'stage_cohort',
                    filters: { stage: l.stage, ...(l.dimension === 'source' ? { sourceId: l.key } : { ownerId: l.key }) },
                    title: t('pages.conversion.leakTitle', { stage: term('stage', l.stage), label: l.label }),
                  }}
                  className="flex h-full w-full flex-col gap-2 rounded-lg bg-surface p-3.5 ring-1 ring-foreground/[0.05] transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {i + 1}. {term('stage', l.stage)} × {t(l.dimension === 'source' ? 'pages.conversion.dimSource' : 'pages.conversion.dimOwner')}
                    </span>
                    <span className="tabular text-sm font-semibold text-negative">−{formatCZKCompact(l.amount)}</span>
                  </span>
                  <span className="text-[13.5px] font-medium">{l.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('pages.conversion.leakStats', { rate: formatPercent(l.rate, 0), avg: formatPercent(l.avgRate, 0), deals: f.formatCount(l.left, 'deals') })}
                    {l.topReason ? t('pages.conversion.leakReason', { reason: term('lostReason', l.topReason) }) : ''}
                  </span>
                  <span className="mt-auto border-t border-border/60 pt-2 text-xs leading-relaxed">
                    <span className="font-medium">{t('pages.conversion.recommendation')}</span> {l.action}
                    <span className="block text-muted-foreground">{t('pages.conversion.owner', { name: l.ownerId ? lk.rep.get(l.ownerId)?.name ?? '—' : '—' })}</span>
                  </span>
                </DrillButton>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section title={t('pages.conversion.lostByReason')} description={t('pages.conversion.lostValue', { value: formatCZK(totalLost) })}>
          <Bars
            rows={reasons.map((r) => ({
              key: r.reason,
              label: term('lostReason', r.reason),
              value: r.value,
              text: formatCZKCompact(r.value),
              sub: tn('drill.count.deals', r.count),
              req: { metric: 'lost', filters: { reason: r.reason, range: 'window' } },
            }))}
            color="var(--chart-2)"
            empty={t('pages.conversion.noData')}
          />
        </Section>
        <Section title={t('pages.conversion.cycleSource')} description={t('pages.conversion.cycleDesc')}>
          <Bars
            rows={bySource.map((g) => ({
              key: g.key,
              label: g.label,
              value: g.median ?? 0,
              text: formatDays(g.median),
              sub: tn('pages.conversion.wins', g.count),
              req: { metric: 'cycle', filters: { sourceId: g.key } },
            }))}
            color="var(--chart-7)"
            empty={t('pages.conversion.noData')}
          />
        </Section>
        <Section title={t('pages.conversion.cycleType')} description={t('pages.conversion.cycleDesc')}>
          <Bars
            rows={byType.map((g) => ({
              key: g.key,
              label: g.label,
              value: g.median ?? 0,
              text: formatDays(g.median),
              sub: tn('pages.conversion.wins', g.count),
              req: { metric: 'cycle', filters: { institutionType: g.key } },
            }))}
            color="var(--chart-7)"
            empty={t('pages.conversion.noData')}
          />
          <Legend className="mt-3" items={[{ label: t('pages.conversion.medianDays'), color: 'var(--chart-7)' }]} />
        </Section>
      </div>
    </>
  )
}

function Bars({
  rows,
  color,
  empty,
}: {
  rows: { key: string; label: string; value: number; text: string; sub: string; req: { metric: string; filters: Record<string, string> } }[]
  color: string
  empty: string
}) {
  if (!rows.length) return <EmptyState title={empty} />
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
