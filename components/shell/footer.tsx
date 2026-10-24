'use client'

import { useI18n } from '@/components/i18n-provider'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="border-t border-border/60 px-4 py-5 sm:px-6 lg:px-8">
      <p className="mx-auto max-w-[1440px] text-xs leading-relaxed text-muted-foreground">
        {t('shell.footer')}{' '}
        <a href="https://interflow.cz" target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
          Interflow (interflow.cz)
        </a>
        .
      </p>
    </footer>
  )
}
