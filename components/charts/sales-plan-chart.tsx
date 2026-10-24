'use client'

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DrillFilterValue } from '@/lib/metrics/drill-types'
import type { SalesPoint } from '@/lib/metrics/series'
import { useDrill } from '@/components/drill/drill-provider'
import { AXIS_TICK, Legend, TooltipCard, niceTicks } from './chart-kit'
import { useI18n } from '@/components/i18n-provider'

export function SalesPlanChart({
  data,
  filters = {},
  height = 260,
  showLastYear = true,
}: {
  data: SalesPoint[]
  filters?: Record<string, DrillFilterValue>
  height?: number
  showLastYear?: boolean
}) {
  const { openDrill } = useDrill()
  const { t, f } = useI18n()
  const { formatAxisCZK, formatCZK, formatMonth, formatMonthShort, formatPercent } = f
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.ym, d.ym.endsWith('-01')) }))
  const ticks = niceTicks(Math.max(...data.map((d) => Math.max(d.won + d.expected, d.plan, showLastYear ? d.lastYear : 0)), 1))
  const open = (ym: string) =>
    openDrill({ metric: 'revenue_won', filters: { ...filters, month: ym }, title: t('ui.chart.wonTitle', { month: formatMonth(ym) }) })

  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: t('ui.chart.won'), color: 'var(--chart-1)' },
          ...(data.some((d) => d.expected > 0) ? [{ label: t('ui.chart.weightedToMonthEnd'), color: 'color-mix(in oklab, var(--chart-1) 28%, transparent)' }] : []),
          { label: t('ui.chart.plan'), color: 'var(--foreground)', dashed: true },
          ...(showLastYear ? [{ label: t('ui.chart.lastYear'), color: 'var(--chart-compare)', line: true }] : []),
        ]}
      />
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={formatAxisCZK} width={58} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as SalesPoint
                return (
                  <TooltipCard
                    title={formatMonth(p.ym)}
                    rows={[
                      { label: t('ui.chart.won'), value: formatCZK(p.won), color: 'var(--chart-1)' },
                      ...(p.expected ? [{ label: t('ui.chart.weighted'), value: formatCZK(p.expected), color: 'color-mix(in oklab, var(--chart-1) 28%, transparent)' }] : []),
                      { label: t('ui.chart.plan'), value: formatCZK(p.plan), color: 'var(--foreground)', dashed: true },
                      ...(showLastYear ? [{ label: t('ui.chart.lastYear'), value: formatCZK(p.lastYear), color: 'var(--chart-compare)', line: true }] : []),
                    ]}
                    footer={t('ui.chart.salesFooter', { pct: formatPercent(p.plan ? p.won / p.plan : 0, 0) })}
                  />
                )
              }}
            />
            <Bar isAnimationActive={false}
              dataKey="won"
              stackId="s"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={34}
              cursor="pointer"
              onClick={(d) => open((d as unknown as { payload: SalesPoint }).payload.ym)}
            />
            <Bar isAnimationActive={false}
              dataKey="expected"
              stackId="s"
              fill="color-mix(in oklab, var(--chart-1) 28%, transparent)"
              stroke="var(--card)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              maxBarSize={34}
              cursor="pointer"
              onClick={(d) => open((d as unknown as { payload: SalesPoint }).payload.ym)}
            />
            {showLastYear && (
              <Line isAnimationActive={false} dataKey="lastYear" type="monotone" stroke="var(--chart-compare)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }} />
            )}
            <Line isAnimationActive={false} dataKey="plan" type="linear" stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
