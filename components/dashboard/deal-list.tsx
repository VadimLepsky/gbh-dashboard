'use client'

import type { DealListRow } from '@/lib/metrics/views/pipeline'
import { DrillButton } from '@/components/drill/drill-trigger'
import { cn } from '@/lib/utils'
import { EmptyState, Pill } from './primitives'
import { DataTable, Td, Th } from './table'
import { useI18n } from '@/components/i18n-provider'

export function DealList({
  rows,
  mode,
  today,
  empty,
  limit = 10,
}: {
  rows: DealListRow[]
  mode: 'closing' | 'stuck'
  today: string
  empty: string
  limit?: number
}) {
  const { t, f } = useI18n()
  const { formatCZK, formatDateShort, formatDays, formatPercent } = f
  if (!rows.length) return <EmptyState title={empty} />
  return (
    <>
      <DataTable minWidth={560}>
        <thead>
          <tr>
            <Th>{t('ui.dealList.deal')}</Th>
            <Th>{t('ui.dealList.stage')}</Th>
            <Th align="right">{t('ui.dealList.value')}</Th>
            <Th align="right">{t(mode === 'closing' ? 'ui.dealList.close' : 'ui.dealList.inStage')}</Th>
            <Th>{t('ui.dealList.nextStep')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => {
            const late = !r.nextStepAt || r.nextStepAt < today
            return (
              <tr key={r.id} className="group hover:bg-muted/40">
                <Td>
                  <DrillButton req={{ metric: 'record', filters: { type: 'deal', id: r.id } }} className="block max-w-[260px]">
                    <span className="block truncate font-medium group-hover:underline">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.owner}</span>
                  </DrillButton>
                </Td>
                <Td className="whitespace-nowrap">
                  {r.stageLabel}
                  <span className="ml-1 text-xs text-muted-foreground">{formatPercent(r.prob, 0)}</span>
                </Td>
                <Td align="right" className="font-medium">
                  {formatCZK(r.value)}
                </Td>
                {mode === 'closing' ? (
                  <Td align="right">{formatDateShort(r.expected)}</Td>
                ) : (
                  <Td align="right">
                    <span className="font-medium text-negative">{formatDays(r.inStage)}</span>
                    <span className="block text-[11px] text-muted-foreground">{t('ui.dealList.usually', { days: r.typical })}</span>
                  </Td>
                )}
                <Td className="max-w-[200px]">
                  {r.nextStepAt ? (
                    <span className={cn('block truncate text-xs', late ? 'text-negative' : 'text-muted-foreground')}>
                      {r.nextStep} · {formatDateShort(r.nextStepAt)}
                    </span>
                  ) : (
                    <Pill tone="negative">{t('ui.dealList.noStep')}</Pill>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </DataTable>
      {rows.length > limit && (
        <p className="mt-2 text-xs text-muted-foreground">{t('ui.dealList.more', { count: rows.length - limit })}</p>
      )}
    </>
  )
}
