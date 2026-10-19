'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Eye } from 'lucide-react'
import { VIEW_AS_OPTIONS, parseViewAs } from '@/lib/data/view-as'
import { withState } from '@/lib/query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function RoleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const value = parseViewAs(params.get('as'))
  const current = VIEW_AS_OPTIONS.find((o) => o.id === value)!

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Eye className="size-3" /> Zobrazit jako
      </label>
      <Select
        value={value}
        items={VIEW_AS_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
        onValueChange={(v) => {
          const next = parseViewAs(String(v))
          // A rep detail of someone outside the new scope makes no sense — go back to the team list.
          const path = pathname.startsWith('/tym/') && next !== 'reditel' ? '/tym' : pathname
          startTransition(() => router.push(withState(path, params, { as: next === 'reditel' ? null : next })))
        }}
      >
        <SelectTrigger className="h-9 w-full bg-background" aria-busy={pending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIEW_AS_OPTIONS.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span className="flex flex-col">
                <span>{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.short}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {current.short}: data se filtrují před výpočtem metrik.
      </p>
    </div>
  )
}
