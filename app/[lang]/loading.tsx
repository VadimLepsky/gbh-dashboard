'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/components/i18n-provider'

export default function Loading() {
  const { t } = useI18n()
  return (
    <div aria-busy="true" aria-label={t('shell.loading')} className="flex flex-col gap-3">
      <div className="mb-3 flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] ${i < 2 ? 'lg:col-span-3 2xl:col-span-1' : 'lg:col-span-2 2xl:col-span-1'}`}
          >
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/[0.07] xl:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-60 w-full" />
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/[0.07]">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-8 w-44" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
