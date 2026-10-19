'use client'

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatAxisCZK, formatCZK, formatMonth, formatMonthShort, formatPercent } from '@/lib/format'
import type { DrillFilterValue } from '@/lib/metrics/drill-types'
import type { SalesPoint } from '@/lib/metrics/series'
import { useDrill } from '@/components/drill/drill-provider'
import { AXIS_TICK, Legend, TooltipCard, niceTicks } from './chart-kit'

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
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.ym, d.ym.endsWith('-01')) }))
  const ticks = niceTicks(Math.max(...data.map((d) => Math.max(d.won + d.expected, d.plan, showLastYear ? d.lastYear : 0)), 1))
  const open = (ym: string) =>
    openDrill({ metric: 'revenue_won', filters: { ...filters, month: ym }, title: `Prodáno · ${formatMonth(ym)}` })

  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: 'Prodáno', color: 'var(--chart-1)' },
          ...(data.some((d) => d.expected > 0) ? [{ label: 'Vážená pipeline do konce měsíce', color: 'color-mix(in oklab, var(--chart-1) 28%, transparent)' }] : []),
          { label: 'Plán', color: 'var(--foreground)', dashed: true },
          ...(showLastYear ? [{ label: 'Loni', color: 'var(--chart-compare)', line: true }] : []),
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
                      { label: 'Prodáno', value: formatCZK(p.won), color: 'var(--chart-1)' },
                      ...(p.expected ? [{ label: 'Vážená pipeline', value: formatCZK(p.expected), color: 'color-mix(in oklab, var(--chart-1) 28%, transparent)' }] : []),
                      { label: 'Plán', value: formatCZK(p.plan), color: 'var(--foreground)', dashed: true },
                      ...(showLastYear ? [{ label: 'Loni', value: formatCZK(p.lastYear), color: 'var(--chart-compare)', line: true }] : []),
                    ]}
                    footer={`Plnění ${formatPercent(p.plan ? p.won / p.plan : 0, 0)} · klikněte pro dealy`}
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
