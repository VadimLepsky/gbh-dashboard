'use client'

import { useMemo, useState } from 'react'
import { formatCZK, formatCZKCompact, formatNumber } from '@/lib/format'
import { EXCEPTION_LABEL, type ExceptionItem, type ExceptionType } from '@/lib/metrics/exceptions-shared'
import { cn } from '@/lib/utils'
import { DrillButton } from '@/components/drill/drill-trigger'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EXCEPTION_ICON, deadlineLabel } from './exception-list'
import { EmptyState, Pill } from './primitives'
import { DataTable, Td, Th } from './table'

export function ExceptionsTable({
  items,
  owners,
  today,
}: {
  items: ExceptionItem[]
  owners: Record<string, string>
  today: string
}) {
  const [owner, setOwner] = useState('all')
  const [type, setType] = useState<ExceptionType | 'all'>('all')

  const types = useMemo(() => {
    const map = new Map<ExceptionType, { count: number; amount: number }>()
    for (const it of items) {
      const cur = map.get(it.type) ?? { count: 0, amount: 0 }
      map.set(it.type, { count: cur.count + 1, amount: cur.amount + it.amount })
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount)
  }, [items])

  const filtered = items.filter(
    (it) => (owner === 'all' || (owner === 'none' ? !it.ownerId : it.ownerId === owner)) && (type === 'all' || it.type === type),
  )
  const ownerItems = [
    { value: 'all', label: 'Všichni vlastníci' },
    ...Object.entries(owners).map(([id, name]) => ({ value: id, label: name })),
    ...(items.some((i) => !i.ownerId) ? [{ value: 'none', label: 'Bez vlastníka (účtárna)' }] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setType('all')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors',
            type === 'all' ? 'bg-foreground text-background ring-foreground' : 'bg-card ring-border hover:bg-muted',
          )}
        >
          Vše · {formatNumber(items.length)}
        </button>
        {types.map(([t, s]) => {
          const Icon = EXCEPTION_ICON[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(type === t ? 'all' : t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors',
                type === t ? 'bg-foreground text-background ring-foreground' : 'bg-card ring-border hover:bg-muted',
              )}
            >
              <Icon className="size-3" />
              {EXCEPTION_LABEL[t]} · {s.count}
              <span className={cn('font-normal', type === t ? 'text-background/70' : 'text-muted-foreground')}>
                {formatCZKCompact(s.amount)}
              </span>
            </button>
          )
        })}
        <div className="ml-auto">
          <Select value={owner} items={ownerItems} onValueChange={(v) => setOwner(String(v))}>
            <SelectTrigger className="h-8 min-w-48 bg-card" aria-label="Vlastník">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {ownerItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nic k řešení">Pro zvolený filtr nejsou žádné výjimky.</EmptyState>
      ) : (
        <DataTable minWidth={880}>
          <thead>
            <tr>
              <Th>Typ</Th>
              <Th>Objekt</Th>
              <Th align="right">Kč v ohrožení</Th>
              <Th>Vlastník</Th>
              <Th>Další krok</Th>
              <Th align="right">Termín</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const Icon = EXCEPTION_ICON[it.type]
              const dl = deadlineLabel(today, it.deadline)
              return (
                <tr key={it.id} className="group hover:bg-muted/40">
                  <Td className="w-44">
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex size-6 items-center justify-center rounded-md bg-muted">
                        <Icon className="size-3.5" />
                      </span>
                      {EXCEPTION_LABEL[it.type]}
                    </span>
                  </Td>
                  <Td>
                    <DrillButton req={it.ref} className="block max-w-[380px]">
                      <span className="block truncate font-medium group-hover:underline">{it.object}</span>
                      <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>
                    </DrillButton>
                    {it.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {it.tags.map((t) => (
                          <Pill key={t} tone="warning" className="px-1.5 py-0 text-[10px]">
                            {t}
                          </Pill>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td align="right" className="font-medium">
                    {formatCZK(it.amount)}
                  </Td>
                  <Td className="whitespace-nowrap">{it.ownerId ? owners[it.ownerId] : 'účtárna'}</Td>
                  <Td className="max-w-[280px] text-muted-foreground">{it.action}</Td>
                  <Td align="right">
                    <Pill tone={dl.tone}>{dl.text}</Pill>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}
