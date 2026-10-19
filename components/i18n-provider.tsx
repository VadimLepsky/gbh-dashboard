'use client'

import { useSearchParams } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { localePath, type Locale } from '@/lib/i18n/config'
import { createI18n, type I18n, type MessageTree } from '@/lib/i18n/core'
import { withState } from '@/lib/query'

const I18nContext = createContext<I18n | null>(null)

/** Gives client components the same translator and formatter as the server, for the URL's language. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: MessageTree; children: React.ReactNode }) {
  const value = useMemo(() => createI18n(locale, messages), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}

/** Builds an in-app URL: keeps the language prefix and the period / comparison / role params. */
export function useHref() {
  const { locale } = useI18n()
  const params = useSearchParams()
  return useCallback(
    (path: string, overrides: Record<string, string | null> = {}) => withState(localePath(locale, path), params, overrides),
    [locale, params],
  )
}
