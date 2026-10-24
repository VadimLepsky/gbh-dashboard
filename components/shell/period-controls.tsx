'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarRange } from 'lucide-react'
import { withState } from '@/lib/query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'

export interface PeriodControlsProps {
  periodKey: string
  periodLabel: string
  presets: { key: string; label: string; hint: string }[]
  cmp: string
  compareOptions: { key: string; label: string }[]
  from: string
  to: string
  minDate: string
  today: string
  hideCompare?: boolean
}

export function PeriodControls(props: PeriodControlsProps) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [customOpen, setCustomOpen] = useState(false)
  const [from, setFrom] = useState(props.from)
  const [to, setTo] = useState(props.to)

  const navigate = (overrides: Record<string, string | null>) =>
    startTransition(() => router.push(withState(pathname, params, overrides), { scroll: false }))

  const isPreset = props.presets.some((p) => p.key === props.periodKey)
  const periodItems = [
    ...props.presets.map((p) => ({ value: p.key, label: p.label })),
    ...(isPreset || props.periodKey === 'custom' ? [] : [{ value: props.periodKey, label: props.periodLabel }]),
    { value: 'custom', label: props.periodKey === 'custom' ? props.periodLabel : t('shell.custom') },
  ]

  return (
    <div className={cn('flex flex-wrap items-center gap-2 transition-opacity', pending && 'opacity-60')}>
      <Select
        value={props.periodKey}
        items={periodItems}
        onValueChange={(v) => {
          if (v === 'custom') {
            setCustomOpen(true)
            return
          }
          navigate({ period: String(v), from: null, to: null })
        }}
      >
        <SelectTrigger className="h-9 min-w-40 bg-card" aria-label={t('shell.period')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {props.presets.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              <span className="flex w-full items-center justify-between gap-4">
                {p.label}
                <span className="text-xs text-muted-foreground">{p.hint}</span>
              </span>
            </SelectItem>
          ))}
          {!isPreset && props.periodKey !== 'custom' && (
            <SelectItem value={props.periodKey}>{props.periodLabel}</SelectItem>
          )}
          <SelectSeparator />
          <SelectItem value="custom">{props.periodKey === 'custom' ? props.periodLabel : t('shell.custom')}</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="icon" className="size-9 bg-card" aria-label={t('shell.customPeriod')}>
              <CalendarRange className="size-4" />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-72 gap-3 p-3">
          <div className="text-sm font-medium">{t('shell.customPeriod')}</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('shell.from')}
              <Input type="date" value={from} min={props.minDate} max={props.today} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('shell.to')}
              <Input type="date" value={to} min={props.minDate} max={props.today} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <Button
            size="sm"
            disabled={!from || !to}
            onClick={() => {
              setCustomOpen(false)
              navigate({ period: 'custom', from, to })
            }}
          >
            {t('shell.apply')}
          </Button>
        </PopoverContent>
      </Popover>

      {!props.hideCompare && (
        <Select
          value={props.cmp}
          items={props.compareOptions.map((o) => ({ value: o.key, label: o.label }))}
          onValueChange={(v) => navigate({ cmp: v === 'prev' ? null : String(v) })}
        >
          <SelectTrigger className="h-9 min-w-44 bg-card" aria-label={t('shell.compare')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {props.compareOptions.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
