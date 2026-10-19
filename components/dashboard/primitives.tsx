import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatDecimal, formatNumber, formatSignedPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/** White card with a heading, Square-style. */
export function Section({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
  id,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <section id={id} className={cn('flex min-w-0 flex-col rounded-xl bg-card ring-1 ring-foreground/[0.07]', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('min-w-0 flex-1 px-5 pt-3 pb-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export type DeltaKind = 'relative' | 'points' | 'absolute'

export function formatDelta(delta: number, kind: DeltaKind, unit?: string): string {
  if (kind === 'relative') return formatSignedPercent(delta)
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  if (kind === 'points') return `${sign}${formatDecimal(Math.abs(delta) * 100)} p. b.`
  const abs = Math.abs(delta)
  return `${sign}${Number.isInteger(abs) ? formatNumber(abs) : formatDecimal(abs)}${unit ? ` ${unit}` : ''}`
}

/** Delta with ArrowUpRight/ArrowDownRight; colour follows meaning (good/bad), not direction. */
export function Delta({
  delta,
  kind = 'relative',
  good,
  label,
  unit,
  className,
}: {
  delta: number | null
  kind?: DeltaKind
  good: boolean | null
  label?: string
  unit?: string
  className?: string
}) {
  if (delta === null || !Number.isFinite(delta)) {
    return label ? <span className={cn('text-xs text-muted-foreground', className)}>{label}: bez srovnání</span> : null
  }
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  const tone = good === null ? 'text-muted-foreground' : good ? 'text-positive' : 'text-negative'
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <span className={cn('inline-flex items-center gap-0.5 font-medium', tone)}>
        {Math.abs(delta) > 1e-9 && <Icon className="size-3.5" aria-hidden />}
        <span className="tabular">{formatDelta(delta, kind, unit)}</span>
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  )
}

export function ProgressBar({
  value,
  target,
  extra = 0,
  className,
  tone = 'primary',
  marker,
}: {
  value: number
  target: number
  /** Second, lighter segment stacked after value (e.g. weighted pipeline). */
  extra?: number
  className?: string
  tone?: 'primary' | 'positive' | 'negative' | 'warning' | 'muted'
  /** Position (same units as value) of a thin marker, e.g. pace line. */
  marker?: number
}) {
  const max = Math.max(target, value + extra, 1)
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  const fill = {
    primary: 'bg-primary',
    positive: 'bg-positive',
    negative: 'bg-negative',
    warning: 'bg-warning',
    muted: 'bg-muted-foreground/50',
  }[tone]
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('absolute inset-y-0 left-0 rounded-full', fill)} style={{ width: pct(value) }} />
      {extra > 0 && (
        <div
          className="absolute inset-y-0 rounded-r-full bg-primary/30"
          style={{ left: `calc(${pct(value)} + 2px)`, width: `max(0px, calc(${pct(extra)} - 2px))` }}
        />
      )}
      {target < max && (
        <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: pct(target) }} aria-hidden />
      )}
      {marker !== undefined && (
        <div className="absolute inset-y-[-2px] w-px bg-foreground/50" style={{ left: pct(marker) }} aria-hidden />
      )}
    </div>
  )
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground/80',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function Pill({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode
  tone?: 'muted' | 'positive' | 'negative' | 'warning' | 'primary'
  className?: string
}) {
  const styles = {
    muted: 'bg-muted text-muted-foreground',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
    warning: 'bg-warning-soft text-warning',
    primary: 'bg-primary-soft text-primary',
  }[tone]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', styles, className)}>
      {children}
    </span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{children}</div>}
    </div>
  )
}

/** Small label + value pair used inside cards. */
export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-lg font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
