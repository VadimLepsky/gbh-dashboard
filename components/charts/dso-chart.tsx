'use client'

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDrill } from '@/components/drill/drill-provider'
import { AXIS_TICK, Legend, TooltipCard } from './chart-kit'
import { useI18n } from '@/components/i18n-provider'

export function DsoChart({ data, term, height = 200 }: { data: { ym: string; value: number | null }[]; term: number; height?: number }) {
  const { openDrill } = useDrill()
  const { t, f } = useI18n()
  const { formatDays, formatMonth, formatMonthShort } = f
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.ym, d.ym.endsWith('-01')) }))
  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: t('ui.chart.dsoLegend'), color: 'var(--chart-1)', line: true },
          { label: t('ui.chart.termLegend'), color: 'var(--foreground)', dashed: true },
        ]}
      />
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            onClick={(state) => {
              const idx = Number(state?.activeTooltipIndex ?? -1)
              if (idx >= 0 && rows[idx]) openDrill({ metric: 'dso', filters: { month: rows[idx].ym }, title: t('ui.chart.dsoTitle', { month: formatMonth(rows[idx].ym) }) })
            }}
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={32} domain={[0, (max: number) => Math.ceil((max + 5) / 10) * 10]} />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={formatMonth(String(payload[0].payload.ym))}
                    rows={[
                      { label: 'DSO', value: formatDays(payload[0].value as number | null), color: 'var(--chart-1)', line: true },
                      { label: t('ui.chart.term'), value: formatDays(term), color: 'var(--foreground)', dashed: true },
                    ]}
                    footer={t('ui.chart.dsoFooter')}
                  />
                ) : null
              }
            />
            <ReferenceLine y={term} stroke="var(--foreground)" strokeOpacity={0.55} strokeDasharray="4 4" />
            <Line
              isAnimationActive={false}
              dataKey="value"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 1.5 }}
              activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2, cursor: 'pointer' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
