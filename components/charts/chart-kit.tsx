'use client'

import { cn } from '@/lib/utils'

/** Shared look for recharts tooltips: card surface, text tokens, colored key marks. */
export function TooltipCard({
  title,
  rows,
  footer,
}: {
  title: string
  rows: { label: string; value: string; color?: string; dashed?: boolean; line?: boolean }[]
  footer?: string
}) {
  return (
    <div className="min-w-44 rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <div className="mb-1.5 font-medium">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && <KeyMark color={r.color} dashed={r.dashed} line={r.line} />}
              {r.label}
            </span>
            <span className="tabular font-medium">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1.5 border-t pt-1.5 text-[11px] text-muted-foreground">{footer}</div>}
    </div>
  )
}

export function KeyMark({ color, dashed, line }: { color: string; dashed?: boolean; line?: boolean }) {
  if (line || dashed)
    return (
      <svg width="14" height="6" aria-hidden className="shrink-0">
        <line x1="0" y1="3" x2="14" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3 2' : undefined} />
      </svg>
    )
  return <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />
}

export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean; line?: boolean }[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground', className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <KeyMark color={i.color} dashed={i.dashed} line={i.line} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 }

/** Round axis: 0 … max in 4–5 even steps (1, 2, 2.5 or 5 × 10ⁿ). */
export function niceTicks(max: number, target = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const raw = max / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}
