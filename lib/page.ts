import type { Metadata } from 'next'
import { getI18n, localeFrom, localePath } from './i18n'
import { buildContext } from './metrics/context'
import { withState } from './query'

export type SearchParams = Record<string, string | string[] | undefined>

export interface PageProps<P extends Record<string, string> = Record<string, never>> {
  params: Promise<{ lang: string } & P>
  searchParams: Promise<SearchParams>
}

/** Metric context for the URL's language and state params, plus a link builder that keeps both. */
export async function pageContext<P extends Record<string, string>>({ params, searchParams }: PageProps<P>) {
  const [route, sp] = await Promise.all([params, searchParams])
  const locale = localeFrom(route.lang)
  const ctx = buildContext(sp, undefined, locale)
  const href = (path: string, overrides: Record<string, string | null> = {}) => withState(localePath(locale, path), sp, overrides)
  return { ctx, route, sp, href, i18n: ctx.i18n, ...ctx.i18n }
}

/** `<title>` from a dictionary key, in the URL's language. */
export async function pageMetadata(params: Promise<{ lang: string }>, key: string): Promise<Metadata> {
  const { lang } = await params
  return { title: getI18n(localeFrom(lang)).t(key) }
}
