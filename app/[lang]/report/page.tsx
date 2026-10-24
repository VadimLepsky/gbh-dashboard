import type { Metadata } from 'next'
import { CalendarClock, Mail, Send } from 'lucide-react'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { weeklyReport } from '@/lib/metrics/report'
import { exceptionLabel } from '@/lib/metrics/exceptions-shared'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/dashboard/primitives'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.report')
}

const SCHEDULE = { time: '8:00', to: 'reditel@gbh-demo.cz' }

export default async function ReportPage(props: PageProps) {
  const { ctx, i18n, t, tn, f } = await pageContext(props)
  const { formatCZK, formatDate, formatDateShort, formatNumber, formatPercent, formatSignedPercent } = f
  const r = weeklyReport(ctx.ds, ctx.full, i18n)
  const range = `${formatDateShort(r.weekStart)}–${formatDate(r.weekEnd)}`
  const change = (a: number, b: number) => (b ? (a - b) / b : null)
  const owners = Object.fromEntries(ctx.ds.salespeople.map((s) => [s.id, s.name]))
  const wonChange = change(r.won, r.wonPrev)
  const colChange = change(r.collected, r.collectedPrev)

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.report')} description={t('pages.report.description')} hidePeriod />

      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CalendarClock className="size-4" />
          </span>
          <span>
            <span className="block font-medium">
              {t('pages.report.scheduled', { day: t('pages.report.day'), time: SCHEDULE.time, to: SCHEDULE.to })}
            </span>
            <span className="block text-xs text-muted-foreground">{t('pages.report.scheduleNote')}</span>
          </span>
        </div>
        <Button variant="outline" disabled className="h-9">
          <Send className="size-4" /> {t('pages.report.sendTest')}
        </Button>
      </div>

      <div className="mx-auto max-w-[760px] overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.08]">
        <div className="flex flex-col gap-1 border-b bg-surface px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="size-3.5" />
            <span>
              <span className="text-foreground">{t('pages.report.from')}</span> GBH Dashboard &lt;report@gbh-demo.cz&gt;
            </span>
          </div>
          <div>
            <span className="text-foreground">{t('pages.report.to')}</span> {SCHEDULE.to}
          </div>
          <div className="text-[13px] font-medium text-foreground">{t('pages.report.subject', { range })}</div>
        </div>

        <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-6 py-7 text-[14px] leading-relaxed">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-primary uppercase">{t('pages.report.brand')}</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{t('pages.report.week', { range })}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('pages.report.intro')}
            </p>
          </div>

          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <tr>
                <Cell
                  label={t('pages.report.wonWeek')}
                  value={formatCZK(r.won)}
                  sub={[tn('drill.count.deals', r.wonCount), wonChange !== null ? t('pages.report.vsPrevWeek', { change: formatSignedPercent(wonChange) }) : null]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <Cell
                  label={t('pages.report.collected')}
                  value={formatCZK(r.collected)}
                  sub={colChange !== null ? t('pages.report.vsPrevWeek', { change: formatSignedPercent(colChange) }) : ''}
                />
              </tr>
              <tr>
                <Cell label={t('pages.report.invoiced')} value={formatCZK(r.invoiced)} sub={t('pages.report.overdueTotal', { value: formatCZK(r.overdue) })} />
                <Cell
                  label={t('pages.report.activities')}
                  value={`${formatNumber(r.activities)} / ${formatNumber(r.activityTarget)}`}
                  sub={t('pages.report.activitiesSub', {
                    pct: formatPercent(r.activityTarget ? r.activities / r.activityTarget : 0, 0),
                    deals: tn('pages.report.newDeals', r.newDeals),
                  })}
                />
              </tr>
            </tbody>
          </table>

          <div className="rounded-lg bg-surface p-4 ring-1 ring-foreground/[0.05]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{t('pages.report.monthPlan')}</span>
              <span className="tabular font-semibold">{formatPercent(r.monthPlan ? r.monthWon / r.monthPlan : 0, 0)}</span>
            </div>
            <ProgressBar className="mt-2 h-2" value={r.monthWon} extra={Math.max(0, r.monthForecast - r.monthWon)} target={r.monthPlan} />
            <p className="mt-2 text-xs text-muted-foreground">
              {t('pages.report.monthNote', { won: formatCZK(r.monthWon), plan: formatCZK(r.monthPlan), forecast: formatCZK(r.monthForecast) })}
            </p>
          </div>

          <div>
            <div className="mb-2 font-medium">{t('pages.report.top5')}</div>
            <ol className="flex flex-col divide-y divide-border/70 rounded-lg ring-1 ring-border">
              {r.topExceptions.map((e, i) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {i + 1}. {e.object}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {exceptionLabel(i18n, e.type)} · {e.action} · {e.ownerId ? owners[e.ownerId] : t('ui.accounting')}
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-medium">{formatCZK(e.amount)}</span>
                </li>
              ))}
            </ol>
          </div>

          {r.best && r.worst && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-positive-soft p-3">
                <div className="text-xs text-positive">{t('pages.report.best')}</div>
                <div className="mt-0.5 font-semibold">{r.best.name}</div>
                <div className="text-xs text-muted-foreground">{t('pages.report.ofProrated', { pct: formatPercent(r.best.pace, 0) })}</div>
              </div>
              <div className="rounded-lg bg-negative-soft p-3">
                <div className="text-xs text-negative">{t('pages.report.worst')}</div>
                <div className="mt-0.5 font-semibold">{r.worst.name}</div>
                <div className="text-xs text-muted-foreground">{t('pages.report.ofProrated', { pct: formatPercent(r.worst.pace, 0) })}</div>
              </div>
            </div>
          )}

          <div className="border-t pt-4 text-xs text-muted-foreground">
            {t('pages.report.footer')}
          </div>
        </div>
      </div>
    </>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <td className="w-1/2 border border-border p-3 align-top">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-lg font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </td>
  )
}
