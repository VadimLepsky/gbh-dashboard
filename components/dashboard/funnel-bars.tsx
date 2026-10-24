'use client'

import type { FunnelRow } from '@/lib/metrics/conversion'
import type { DrillFilterValue } from '@/lib/metrics/drill-types'
import { DrillButton } from '@/components/drill/drill-trigger'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'

/** Open pipeline per stage + conversion and time spent, in one compact table-like funnel. */
export function FunnelBars({
  rows,
  filters = {},
  windowLabel,
  compact = false,
}: {
  rows: FunnelRow[]
  filters?: Record<string, DrillFilterValue>
  windowLabel?: string
  compact?: boolean
}) {
  const { t, term, f } = useI18n()
  const { formatCZK, formatDays, formatNumber, formatPercent } = f
  const max = Math.max(...rows.map((r) => r.openValue), 1)
  const avgRate = (() => {
    const left = rows.reduce((s, r) => s + r.left, 0)
    return left ? rows.reduce((s, r) => s + r.advanced, 0) / left : null
  })()
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'grid items-center gap-x-3 border-b pb-2 text-xs text-muted-foreground',
          compact ? 'grid-cols-[7.5rem_1fr_5.5rem]' : 'grid-cols-[8.5rem_1fr_6rem_6.5rem_6rem]',
        )}
      >
        <span>{t('ui.funnel.stage')}</span>
        <span>{t('ui.funnel.open')}</span>
        <span className="text-right">{t('ui.funnel.rate')}</span>
        {!compact && <span className="text-right">{t('ui.funnel.avgDays')}</span>}
        {!compact && <span className="text-right">{t('ui.funnel.lost')}</span>}
      </div>
      {rows.map((r) => {
        const stage = term('stage', r.stage)
        const weak = r.rate !== null && avgRate !== null && r.left >= 5 && r.rate < avgRate - 0.12
        return (
          <div
            key={r.stage}
            className={cn(
              'grid items-center gap-x-3 border-b border-border/60 py-2.5 text-[13px] last:border-0',
              compact ? 'grid-cols-[7.5rem_1fr_5.5rem]' : 'grid-cols-[8.5rem_1fr_6rem_6.5rem_6rem]',
            )}
          >
            <span className="font-medium">{stage}</span>
            <DrillButton
              req={{ metric: 'pipeline', filters: { ...filters, stage: r.stage }, title: t('drill.text.pipelineStage', { stage }) }}
              className="group flex min-w-0 items-center gap-2.5"
            >
              <span className="h-5 min-w-1 rounded-[4px] bg-chart-1/85 transition-colors group-hover:bg-chart-1" style={{ width: `${Math.max(2, (r.openValue / max) * 100) * 0.6}%` }} />
              <span className="tabular truncate text-xs">
                <span className="font-medium text-foreground">{formatNumber(r.openCount)}</span>
                <span className="text-muted-foreground"> · {formatCZK(r.openValue)}</span>
              </span>
            </DrillButton>
            <DrillButton
              req={{ metric: 'stage_cohort', filters: { ...filters, stage: r.stage } }}
              className={cn('tabular text-right hover:underline', weak && 'font-medium text-negative')}
              title={windowLabel ? t('ui.funnel.rateFor', { window: windowLabel }) : undefined}
            >
              {r.rate === null ? '—' : formatPercent(r.rate, 0)}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">({r.left})</span>
            </DrillButton>
            {!compact && <span className="tabular text-right text-muted-foreground">{formatDays(r.avgDays)}</span>}
            {!compact && (
              <DrillButton
                req={{ metric: 'stage_cohort', filters: { ...filters, stage: r.stage } }}
                className="tabular text-right text-muted-foreground hover:underline"
              >
                {formatNumber(r.lost)}
              </DrillButton>
            )}
          </div>
        )
      })}
    </div>
  )
}
