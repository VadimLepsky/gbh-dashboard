import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { I18nProvider } from '@/components/i18n-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/shell/sidebar'
import { MobileNav } from '@/components/shell/mobile-nav'
import { Footer } from '@/components/shell/footer'
import { DrillProvider } from '@/components/drill/drill-provider'
import { getI18n, isLocale, MESSAGES } from '@/lib/i18n'
import '../globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'latin-ext'] })

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { lang } = await params
  const { t } = getI18n(isLocale(lang) ? lang : undefined)
  return {
    title: { default: t('meta.title'), template: '%s · GBH Defence' },
    description: t('meta.description'),
    icons: {
      icon: [
        { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
        { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: '/apple-icon.png',
    },
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#161114' },
  ],
}

export default async function RootLayout({ children, params }: Props) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <I18nProvider locale={lang} messages={MESSAGES[lang]}>
            <TooltipProvider delay={150}>
              <Suspense>
                <DrillProvider>
                  <div className="flex min-h-dvh">
                    <Sidebar />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <MobileNav />
                      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-7">
                        {children}
                      </main>
                      <Footer />
                    </div>
                  </div>
                </DrillProvider>
              </Suspense>
            </TooltipProvider>
          </I18nProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
