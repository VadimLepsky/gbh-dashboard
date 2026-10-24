'use client'

import { DrillButton } from '@/components/drill/drill-trigger'
import { Legend } from '@/components/charts/chart-kit'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'

export interface ForecastBar {
  key: string
  label: string
  won: number
  weighted: number
  total: number
  plan: number
  filter: Record<string, string>
}

/** Bullet bars: won (solid) + weighted pipeline (light) against the plan tick. */
export function ForecastBars({ rows, legend = true }: { rows: ForecastBar[]; legend?: boolean }) {
  const { t, f } = useI18n()
  const { formatCZK, formatCZKCompact, formatPercent } = f
  // Each row is scaled to its own plan, so the plan tick lines up; the axis tops out at 2× plan.
  const scale = Math.min(2, Math.max(1.25, ...rows.map((r) => (r.plan ? r.total / r.plan : 0))) * 1.05)
  return (
    <div className="flex flex-col gap-3">
      {legend && (
        <Legend
          items={[
            { label: t('ui.forecast.won'), color: 'var(--chart-1)' },
            { label: t('ui.forecast.weighted'), color: 'color-mix(in oklab, var(--chart-1) 28%, transparent)' },
            { label: t('ui.forecast.plan'), color: 'var(--foreground)', line: true },
          ]}
        />
      )}
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const ratio = r.plan ? r.total / r.plan : 0
          const pct = (v: number) => `${Math.min(100, (r.plan ? v / r.plan / scale : 0) * 100)}%`
          const overflow = ratio > scale
          return (
            <DrillButton
              key={r.key}
              req={{ metric: 'weighted_forecast', filters: r.filter, title: t('ui.forecast.title', { label: r.label }) }}
              className="group grid grid-cols-[9rem_1fr_5.5rem] items-center gap-3 text-[13px] sm:grid-cols-[10rem_1fr_7.5rem]"
              title={t('ui.forecast.tooltip', { won: formatCZK(r.won), weighted: formatCZK(r.weighted), plan: formatCZK(r.plan) })}
            >
              <span className="truncate group-hover:underline">{r.label}</span>
              <span className="relative h-4 overflow-hidden rounded-[4px] bg-muted/70">
                <span className="absolute inset-y-0 left-0 rounded-l-[4px] bg-chart-1" style={{ width: pct(r.won) }} />
                <span
                  className="absolute inset-y-0 rounded-r-[4px] bg-chart-1/30"
                  style={{ left: `calc(${pct(r.won)} + 2px)`, width: `max(0px, calc(${pct(r.weighted)} - 2px))` }}
                />
                <span className="absolute -inset-y-1 w-0.5 rounded bg-foreground/70" style={{ left: pct(r.plan) }} />
                {overflow && (
                  <span className="absolute inset-y-0 right-1 flex items-center text-[10px] font-semibold text-primary-foreground">»</span>
                )}
              </span>
              <span className="tabular text-right">
                <span className={cn('font-medium', ratio >= 1 ? 'text-positive' : ratio < 0.8 ? 'text-negative' : '')}>
                  {formatPercent(ratio, 0)}
                </span>
                <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">{formatCZKCompact(r.total)}</span>
              </span>
            </DrillButton>
          )
        })}
      </div>
    </div>
  )
}
