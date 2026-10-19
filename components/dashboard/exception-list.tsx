'use client'

import { BellRing, CalendarClock, FileClock, Gauge, Hourglass, Landmark, ListTodo, Receipt, Signature } from 'lucide-react'
import { diffDays } from '@/lib/data/dates'
import { formatCZK, formatDateShort } from '@/lib/format'
import { EXCEPTION_LABEL, type ExceptionItem, type ExceptionType } from '@/lib/metrics/exceptions-shared'
import { cn } from '@/lib/utils'
import { DrillButton } from '@/components/drill/drill-trigger'
import { Pill } from './primitives'

export const EXCEPTION_ICON: Record<ExceptionType, typeof BellRing> = {
  overdue_invoice: Receipt,
  stuck_deal: Hourglass,
  no_next_step: ListTodo,
  overdue_followups: BellRing,
  unsigned_contract: Signature,
  renewal_risk: FileClock,
  tender_deadline: Landmark,
  low_activity: Gauge,
  unmatched_payment: CalendarClock,
}

export function deadlineLabel(today: string, deadline: string): { text: string; tone: 'negative' | 'warning' | 'muted' } {
  const d = diffDays(today, deadline)
  if (d <= 0) return { text: 'dnes', tone: 'negative' }
  if (d === 1) return { text: 'zítra', tone: 'warning' }
  if (d <= 7) return { text: `do ${formatDateShort(deadline)}`, tone: 'warning' }
  return { text: formatDateShort(deadline), tone: 'muted' }
}

/** Compact list for the overview. */
export function ExceptionList({
  items,
  owners,
  today,
}: {
  items: ExceptionItem[]
  owners: Record<string, string>
  today: string
}) {
  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((it) => {
        const Icon = EXCEPTION_ICON[it.type]
        const dl = deadlineLabel(today, it.deadline)
        return (
          <li key={it.id}>
            <DrillButton
              req={it.ref}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-[13.5px] font-medium">{it.object}</span>
                  <span className="text-[11px] text-muted-foreground">{EXCEPTION_LABEL[it.type]}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {it.action} · {it.ownerId ? owners[it.ownerId] : 'účtárna'}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular text-[13px] font-medium">{formatCZK(it.amount)}</span>
                <Pill tone={dl.tone} className={cn('px-1.5 py-0')}>
                  {dl.text}
                </Pill>
              </span>
            </DrillButton>
          </li>
        )
      })}
    </ul>
  )
}
