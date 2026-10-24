'use client'

import { useI18n } from '@/components/i18n-provider'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{t('shell.errorTitle')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('shell.errorText')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
      >
        {t('shell.retry')}
      </button>
    </div>
  )
}
