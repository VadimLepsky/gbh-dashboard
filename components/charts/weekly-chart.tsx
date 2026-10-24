'use client'

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_TICK, Legend, TooltipCard } from './chart-kit'
import { useI18n } from '@/components/i18n-provider'

/** Activities per week with the weekly target as a dashed line. */
export function WeeklyChart({ data, target, height = 180 }: { data: { label: string; value: number }[]; target: number; height?: number }) {
  const { t, f } = useI18n()
  const { formatDateShort, formatNumber } = f
  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: t('ui.chart.weeklyDone'), color: 'var(--chart-1)' },
          { label: t('ui.chart.weeklyTarget'), color: 'var(--foreground)', dashed: true },
        ]}
      />
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickFormatter={(v) => formatDateShort(String(v))} tickLine={false} axisLine={false} tick={AXIS_TICK} interval={1} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={36} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={t('ui.chart.weekOf', { date: formatDateShort(String(payload[0].payload.label)) })}
                    rows={[
                      { label: t('ui.chart.activities'), value: formatNumber(Number(payload[0].value)), color: 'var(--chart-1)' },
                      { label: t('ui.chart.target'), value: formatNumber(target), color: 'var(--foreground)', dashed: true },
                    ]}
                  />
                ) : null
              }
            />
            <ReferenceLine y={target} stroke="var(--foreground)" strokeOpacity={0.55} strokeDasharray="4 4" />
            <Bar isAnimationActive={false} dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
