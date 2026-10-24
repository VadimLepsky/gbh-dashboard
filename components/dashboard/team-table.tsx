'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { diffDays } from '@/lib/data/dates'
import type { RepRow } from '@/lib/metrics/team'
import type { Heat } from '@/lib/metrics/views/team'
import { DrillButton } from '@/components/drill/drill-trigger'
import { MiniBars } from '@/components/charts/sparkline'
import { Avatar, ProgressBar } from './primitives'
import { DataTable, Td, Th } from './table'
import { MetricLabel } from './info-tip'
import { useHref, useI18n } from '@/components/i18n-provider'

type Row = RepRow & {
  heat: { pace: Heat; activity: Heat; overdue: Heat; noNext: Heat; stuck: Heat }
}

export function TeamTable({ rows, today, isCurrent }: { rows: Row[]; today: string; isCurrent: boolean }) {
  const { t, term, f: fmt } = useI18n()
  const { formatCZK, formatDateShort, formatMonthShort, formatNumber, formatPercent } = fmt
  const href = useHref()
  const router = useRouter()
  return (
    <DataTable minWidth={900}>
      <thead>
        <tr>
          <Th>{t('ui.team.rep')}</Th>
          <Th>
            <MetricLabel id="attainment" />
          </Th>
          <Th align="right">
            <MetricLabel id="activities_done" label={t('ui.team.activities')} />
          </Th>
          <Th align="right">
            <MetricLabel id="overdue_followups" label={t('ui.team.overdueFu')} />
          </Th>
          <Th align="right">
            <MetricLabel id="no_next_step" label={t('ui.team.noStep')} />
          </Th>
          <Th align="right">
            <MetricLabel id="stuck_deals" label={t('ui.team.stuck')} />
          </Th>
          <Th align="right">{t('ui.team.lastActivity')}</Th>
          <Th>{t('ui.team.trend', { months: Math.max(0, (rows[0]?.trend.length ?? 1) - 1) })}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const f = { ownerId: r.rep.id }
          const lastAgo = r.lastActivity ? diffDays(r.lastActivity, today) : null
          return (
            <tr
              key={r.rep.id}
              onClick={() => router.push(href(`/tym/${r.rep.id}`))}
              className="group cursor-pointer transition-colors hover:bg-muted/40"
            >
              <Td>
                <span className="flex items-center gap-2.5">
                  <Avatar initials={r.rep.initials} />
                  <span className="min-w-0">
                    <span className="block font-medium whitespace-nowrap group-hover:underline">{r.rep.name}</span>
                    <span className="block text-xs whitespace-nowrap text-muted-foreground">
                      {term('role', r.rep.role)} · {term('team', r.rep.teamId)}
                    </span>
                  </span>
                </span>
              </Td>
              <Td heat={r.heat.pace} className="w-48 min-w-40">
                <DrillButton req={{ metric: 'revenue_won', filters: f }} className="flex w-full flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="tabular font-medium">{formatPercent(r.attainment ?? 0, 0)}</span>
                    <span className="tabular text-xs text-muted-foreground">
                      {formatCZK(r.won)}
                    </span>
                  </span>
                  <ProgressBar
                    value={r.won}
                    target={r.plan}
                    tone={r.heat.pace === 'bad' ? 'negative' : r.heat.pace === 'good' ? 'positive' : 'primary'}
                    marker={isCurrent && r.pace ? r.plan * (r.attainment! / r.pace) : undefined}
                  />
                </DrillButton>
              </Td>
              <Td align="right" heat={r.heat.activity}>
                <DrillButton req={{ metric: 'activities_done', filters: f }} className="tabular hover:underline">
                  {formatNumber(r.activities)}
                  <span className="text-muted-foreground"> / {formatNumber(r.activityTarget)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{formatPercent(r.activityRatio ?? 0, 0)}</span>
                </DrillButton>
              </Td>
              <Td align="right" heat={r.heat.overdue}>
                <DrillButton req={{ metric: 'overdue_followups', filters: f }} className="tabular hover:underline">
                  {formatNumber(r.overdueFollowups)}
                </DrillButton>
              </Td>
              <Td align="right" heat={r.heat.noNext}>
                <DrillButton req={{ metric: 'no_next_step', filters: f }} className="tabular hover:underline">
                  {formatNumber(r.noNextStep)}
                </DrillButton>
              </Td>
              <Td align="right" heat={r.heat.stuck}>
                <DrillButton req={{ metric: 'stuck_deals', filters: f }} className="tabular hover:underline">
                  {formatNumber(r.stuck)}
                </DrillButton>
              </Td>
              <Td align="right" className="text-muted-foreground">
                {r.lastActivity ? (lastAgo === 0 ? t('ui.team.today') : formatDateShort(r.lastActivity)) : '—'}
              </Td>
              <Td>
                <MiniBars values={r.trend.map((p) => ({ label: formatMonthShort(p.ym), value: p.value }))} />
              </Td>
              <Td className="w-6 text-muted-foreground">
                <ChevronRight className="size-4 opacity-40 group-hover:opacity-100" />
              </Td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
