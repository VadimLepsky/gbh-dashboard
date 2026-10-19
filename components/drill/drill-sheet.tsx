'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber, formatValue, type ValueFormat } from '@/lib/format'
import type { CellFormat, DrillRequest, DrillResult, DrillRow } from '@/lib/metrics/drill-types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: { req: DrillRequest; result: DrillResult | null; error: boolean } | null
  canGoBack: boolean
  onBack: () => void
  onRowOpen: (req: DrillRequest) => void
}

function fmt(value: string | number | null, format: CellFormat): string {
  if (format === 'badge' || format === 'text') return value === null || value === '' ? '—' : String(value)
  return formatValue(value, format as ValueFormat)
}

const TONE_TEXT = { negative: 'text-negative', warning: 'text-warning', positive: 'text-positive' } as const

export function DrillSheet({ open, onOpenChange, state, canGoBack, onBack, onRowOpen }: Props) {
  const result = state?.result ?? null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:xl:max-w-3xl">
        <div className="flex items-start gap-2 border-b px-5 pt-5 pb-4 pr-12">
          {canGoBack && (
            <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Zpět" className="-ml-2 shrink-0">
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold">
              {result?.title ?? state?.req.title ?? 'Načítám…'}
            </SheetTitle>
            <SheetDescription className="mt-0.5 text-xs">
              {result?.subtitle ?? ' '}
            </SheetDescription>
            {result?.definition && <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{result.definition}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result && !state?.error && <LoadingState />}
          {state?.error && (
            <p className="p-5 text-sm text-muted-foreground">Data se nepodařilo načíst. Zkuste to prosím znovu.</p>
          )}
          {result && <DrillBody result={result} onRowOpen={onRowOpen} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  )
}

function DrillBody({ result, onRowOpen }: { result: DrillResult; onRowOpen: (req: DrillRequest) => void }) {
  const sum =
    result.sumKey && !result.truncated
      ? result.rows.reduce((acc, r) => acc + Number(r.cells[result.sumKey!] ?? 0), 0)
      : result.total.value
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <div className="text-xs text-muted-foreground">{result.total.label}</div>
          <div className="tabular text-2xl font-semibold tracking-tight">
            {fmt(result.total.value, result.total.format)}
          </div>
        </div>
        {result.countLabel && (
          <div className="text-xs text-muted-foreground">
            {formatNumber(result.count)} {result.countLabel}
          </div>
        )}
      </div>

      {result.detail && (
        <div className="grid gap-4 border-t px-5 py-4 md:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {result.detail.fields.map((f) => (
              <div key={f.label} className="contents">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className={cn('min-w-0', f.tone && TONE_TEXT[f.tone])}>{f.value}</dd>
              </div>
            ))}
          </dl>
          {result.detail.timeline && result.detail.timeline.length > 0 && (
            <ol className="relative flex flex-col gap-2 border-l border-border pl-4 text-[13px]">
              {result.detail.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span
                    className={cn(
                      'absolute top-1.5 -left-[21px] size-2 rounded-full ring-2 ring-popover',
                      t.tone === 'positive' ? 'bg-positive' : t.tone === 'negative' ? 'bg-negative' : 'bg-muted-foreground/50',
                    )}
                  />
                  <span className="tabular text-muted-foreground">{fmt(t.date, 'date')}</span>
                  <span className="ml-2">{t.label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {result.note && <p className="border-t bg-surface px-5 py-2.5 text-xs text-muted-foreground">{result.note}</p>}

      {result.columns.length > 0 && result.rows.length > 0 && (
        <div className="border-t">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-popover">
              <tr className="border-b text-left text-xs text-muted-foreground">
                {result.columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      'px-3 py-2 font-medium first:pl-5 last:pr-5',
                      c.align === 'right' && 'text-right',
                      c.secondary && 'hidden md:table-cell',
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <Row key={row.id} row={row} result={result} onOpen={onRowOpen} />
              ))}
            </tbody>
            {result.sumKey && (
              <tfoot>
                <tr className="border-t bg-surface font-medium">
                  {result.columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-3 py-2.5 first:pl-5 last:pr-5',
                        c.align === 'right' && 'text-right',
                        c.secondary && 'hidden md:table-cell',
                      )}
                    >
                      {i === 0 ? 'Součet' : c.key === result.sumKey ? <span className="tabular">{fmt(sum, c.format)}</span> : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
          {result.truncated && (
            <p className="px-5 py-3 text-xs text-muted-foreground">
              Zobrazeno {formatNumber(result.rows.length)} z {formatNumber(result.count)} záznamů. Součet a počet zahrnují
              všechny.
            </p>
          )}
        </div>
      )}
      {result.columns.length > 0 && result.rows.length === 0 && (
        <p className="border-t px-5 py-6 text-sm text-muted-foreground">Žádné záznamy pro zvolené období.</p>
      )}
    </div>
  )
}

function Row({ row, result, onOpen }: { row: DrillRow; result: DrillResult; onOpen: (req: DrillRequest) => void }) {
  const clickable = !!row.ref && row.ref.metric === 'record'
  return (
    <tr
      onClick={clickable ? () => onOpen(row.ref!) : undefined}
      className={cn(
        'group border-b border-border/60 last:border-0',
        clickable && 'cursor-pointer hover:bg-muted/50',
        row.tone === 'negative' && 'bg-negative-soft/40',
      )}
    >
      {result.columns.map((c, i) => {
        const value = row.cells[c.key] ?? null
        return (
          <td
            key={c.key}
            className={cn(
              'px-3 py-2 align-top first:pl-5 last:pr-5',
              c.align === 'right' && 'tabular text-right whitespace-nowrap',
              c.format === 'date' && 'tabular whitespace-nowrap text-muted-foreground',
              c.secondary && 'hidden md:table-cell',
            )}
          >
            {c.format === 'badge' && value !== null ? (
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                  row.tone === 'positive'
                    ? 'bg-positive-soft text-positive'
                    : row.tone === 'negative'
                      ? 'bg-negative-soft text-negative'
                      : row.tone === 'warning'
                        ? 'bg-warning-soft text-warning'
                        : 'bg-muted text-muted-foreground',
                )}
              >
                {String(value)}
              </span>
            ) : (
              <span className={cn(i === 0 && 'font-medium', i === 0 && clickable && 'group-hover:underline')}>
                {fmt(value, c.format)}
              </span>
            )}
            {i === 0 && clickable && (
              <ChevronRight className="ml-1 inline size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            )}
          </td>
        )
      })}
    </tr>
  )
}
