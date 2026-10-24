'use client'

import Link from 'next/link'
import { useHref, useI18n } from '@/components/i18n-provider'

export default function NotFound() {
  const { t } = useI18n()
  const href = useHref()
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <div className="text-sm text-muted-foreground">404</div>
      <h1 className="text-xl font-semibold tracking-tight">{t('shell.notFoundTitle')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('shell.notFoundText')}</p>
      <Link href={href('/')} className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
        {t('shell.backHome')}
      </Link>
    </div>
  )
}
