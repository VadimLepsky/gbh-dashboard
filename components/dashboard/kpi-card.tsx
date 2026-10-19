'use client'

import { formatValue } from '@/lib/format'
import type { Kpi } from '@/lib/metrics/kpi'
import { cn } from '@/lib/utils'
import { DrillButton } from '@/components/drill/drill-trigger'
import { Sparkline } from '@/components/charts/sparkline'
import { InfoTip } from './info-tip'
import { Delta, ProgressBar } from './primitives'

export function KpiCard({ kpi, className, title }: { kpi: Kpi; className?: string; title?: string }) {
  return (
    <DrillButton
      req={kpi.drill}
      className={cn(
        'group flex min-w-0 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-shadow hover:ring-foreground/15 hover:shadow-sm',
        className,
      )}
      aria-label={`${title ?? kpi.label}: zobrazit záznamy`}
    >
      <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
        {title ?? kpi.label}
        <InfoTip text={kpi.definition} />
      </span>
      <span className="tabular mt-1 truncate text-[26px] leading-tight font-semibold tracking-tight">
        {formatValue(kpi.value, kpi.format)}
      </span>
      <Delta
        className="mt-1"
        delta={kpi.delta}
        kind={kpi.deltaKind}
        good={kpi.good}
        label={kpi.compareLabel}
        unit={kpi.format === 'days' ? 'dní' : undefined}
      />
      <span className="mt-auto block pt-3">
        {kpi.progress ? (
          <span className="flex flex-col gap-1.5">
            <ProgressBar value={kpi.progress.value} target={kpi.progress.target} extra={kpi.progress.extra} />
            <span className="text-[11px] text-muted-foreground">{kpi.progress.label}</span>
          </span>
        ) : kpi.spark ? (
          <span className="flex flex-col gap-1">
            <Sparkline values={kpi.spark.map((s) => s.value)} />
            {kpi.sparkLabel && <span className="text-[11px] text-muted-foreground">{kpi.sparkLabel}</span>}
          </span>
        ) : null}
      </span>
      {kpi.note && <span className="mt-1 text-[11px] text-muted-foreground">{kpi.note}</span>}
    </DrillButton>
  )
}
