'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Eye } from 'lucide-react'
import { VIEW_AS_OPTIONS, parseViewAs } from '@/lib/data/view-as'
import { localePath, stripLocale } from '@/lib/i18n/config'
import { withState } from '@/lib/query'
import { useI18n } from '@/components/i18n-provider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function RoleSwitcher() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const value = parseViewAs(params.get('as'))

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Eye className="size-3" /> {t('shell.viewAs')}
      </label>
      <Select
        value={value}
        items={VIEW_AS_OPTIONS.map((o) => ({ value: o.id, label: t(`viewAs.${o.id}.label`) }))}
        onValueChange={(v) => {
          const next = parseViewAs(String(v))
          // A rep detail of someone outside the new scope makes no sense — go back to the team list.
          const path = stripLocale(pathname).path
          const target = localePath(locale, path.startsWith('/tym/') && next !== 'reditel' ? '/tym' : path)
          startTransition(() => router.push(withState(target, params, { as: next === 'reditel' ? null : next })))
        }}
      >
        <SelectTrigger className="h-9 w-full bg-background" aria-busy={pending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIEW_AS_OPTIONS.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span className="flex flex-col">
                <span>{t(`viewAs.${o.id}.label`)}</span>
                <span className="text-xs text-muted-foreground">{t(`viewAs.${o.id}.short`)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t('shell.viewAsNote', { scope: t(`viewAs.${value}.short`) })}
      </p>
    </div>
  )
}
