import { cn } from '@/lib/utils'

/** Tiny trend line: thin stroke, last point marked. Server-renderable SVG. */
export function Sparkline({
  values,
  className,
  tone = 'primary',
  height = 32,
}: {
  values: number[]
  className?: string
  tone?: 'primary' | 'negative' | 'positive' | 'muted'
  height?: number
}) {
  if (values.length < 2) return null
  const w = 120
  const h = height
  const pad = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [
    pad + (i * (w - pad * 2)) / (values.length - 1),
    h - pad - ((v - min) / span) * (h - pad * 2),
  ])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`
  const color = {
    primary: 'var(--chart-1)',
    negative: 'var(--negative)',
    positive: 'var(--positive)',
    muted: 'var(--muted-foreground)',
  }[tone]
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-8 w-full overflow-visible', className)} aria-hidden>
      <path d={area} fill={color} opacity={0.07} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={2.6} fill={color} stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A few bars (e.g. monthly attainment) with a 100 % guide. */
export function MiniBars({
  values,
  guide = 1,
  className,
}: {
  values: { label: string; value: number | null }[]
  guide?: number
  className?: string
}) {
  const max = Math.max(guide * 1.3, ...values.map((v) => v.value ?? 0))
  return (
    <div className={cn('relative flex h-7 items-end gap-[3px]', className)}>
      <div className="absolute inset-x-0 border-t border-dashed border-foreground/25" style={{ bottom: `${(guide / max) * 100}%` }} aria-hidden />
      {values.map((v) => {
        const val = v.value ?? 0
        const tone = v.value === null ? 'bg-muted' : val >= guide ? 'bg-positive/80' : val >= guide * 0.8 ? 'bg-chart-1/70' : 'bg-negative/75'
        return (
          <div
            key={v.label}
            title={`${v.label}: ${v.value === null ? '—' : Math.round(val * 100) + ' %'}`}
            className={cn('w-2.5 rounded-t-[3px]', tone)}
            style={{ height: `${Math.max(6, (val / max) * 100)}%` }}
          />
        )
      })}
    </div>
  )
}
