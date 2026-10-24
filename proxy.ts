import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_LOCALE } from '@/lib/i18n/config'

/**
 * Language is chosen only by URL:
 * - `/en`, `/en/…` → English (served by `app/[lang]` with lang = en)
 * - `/cs/…`        → redirect to the unprefixed URL (one canonical URL for Czech)
 * - anything else  → Czech, rewritten internally to `/cs/…`; the address bar does not change
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/en' || pathname.startsWith('/en/')) return NextResponse.next()
  if (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/'
    url.search = search
    return NextResponse.redirect(url, 308)
  }
  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Skip Next internals and static files (anything with an extension, e.g. /icon.svg).
  matcher: ['/((?!_next/|_vercel/|.*\\..*).*)'],
}
