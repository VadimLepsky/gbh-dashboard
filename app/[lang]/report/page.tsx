import type { Metadata } from 'next'
import { CalendarClock, Mail, Send } from 'lucide-react'
import { buildContext } from '@/lib/metrics/context'
import { weeklyReport } from '@/lib/metrics/report'
import { EXCEPTION_LABEL } from '@/lib/metrics/exceptions-shared'
import { formatCZK, formatDate, formatDateShort, formatNumber, formatPercent, formatSignedPercent } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/dashboard/primitives'

export const metadata: Metadata = { title: 'Týdenní report' }

const SCHEDULE = { day: 'každé pondělí', time: '8:00', to: 'reditel@gbh-demo.cz' }

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const r = weeklyReport(ctx.ds, ctx.full)
  const range = `${formatDateShort(r.weekStart)}–${formatDate(r.weekEnd)}`
  const change = (a: number, b: number) => (b ? (a - b) / b : null)
  const owners = Object.fromEntries(ctx.ds.salespeople.map((s) => [s.id, s.name]))
  const wonChange = change(r.won, r.wonPrev)
  const colChange = change(r.collected, r.collectedPrev)

  return (
    <>
      <PageHeader ctx={ctx} title="Týdenní report" description="Automatický e-mail pro vedení" hidePeriod />

      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CalendarClock className="size-4" />
          </span>
          <span>
            <span className="block font-medium">
              Plánováno: {SCHEDULE.day} {SCHEDULE.time} → {SCHEDULE.to}
            </span>
            <span className="block text-xs text-muted-foreground">Report se skládá ze stejných metrik jako dashboard, za uplynulý týden.</span>
          </span>
        </div>
        <Button variant="outline" disabled className="h-9">
          <Send className="size-4" /> Odeslat testovací e-mail (v demu vypnuto)
        </Button>
      </div>

      <div className="mx-auto max-w-[760px] overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.08]">
        <div className="flex flex-col gap-1 border-b bg-surface px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="size-3.5" />
            <span>
              <span className="text-foreground">Od:</span> GBH Dashboard &lt;report@gbh-demo.cz&gt;
            </span>
          </div>
          <div>
            <span className="text-foreground">Komu:</span> {SCHEDULE.to}
          </div>
          <div className="text-[13px] font-medium text-foreground">Týdenní report obchodu · {range}</div>
        </div>

        <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-6 py-7 text-[14px] leading-relaxed">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-primary uppercase">GBH Defence · Obchod</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Týden {range}</h2>
            <p className="mt-2 text-muted-foreground">
              Dobrý den, posíláme přehled minulého týdne. Čísla jsou ze stejného zdroje jako dashboard (Pipedrive, iDoklad, banka).
            </p>
          </div>

          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <tr>
                <Cell label="Prodáno za týden" value={formatCZK(r.won)} sub={`${r.wonCount} dealů${wonChange !== null ? ` · ${formatSignedPercent(wonChange)} vs. předchozí týden` : ''}`} />
                <Cell label="Uhrazeno" value={formatCZK(r.collected)} sub={colChange !== null ? `${formatSignedPercent(colChange)} vs. předchozí týden` : ''} />
              </tr>
              <tr>
                <Cell label="Fakturováno" value={formatCZK(r.invoiced)} sub={`po splatnosti celkem ${formatCZK(r.overdue)}`} />
                <Cell
                  label="Aktivity týmu"
                  value={`${formatNumber(r.activities)} / ${formatNumber(r.activityTarget)}`}
                  sub={`${formatPercent(r.activityTarget ? r.activities / r.activityTarget : 0, 0)} cíle · ${r.newDeals} nových dealů`}
                />
              </tr>
            </tbody>
          </table>

          <div className="rounded-lg bg-surface p-4 ring-1 ring-foreground/[0.05]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">Plnění plánu za měsíc</span>
              <span className="tabular font-semibold">{formatPercent(r.monthPlan ? r.monthWon / r.monthPlan : 0, 0)}</span>
            </div>
            <ProgressBar className="mt-2 h-2" value={r.monthWon} extra={Math.max(0, r.monthForecast - r.monthWon)} target={r.monthPlan} />
            <p className="mt-2 text-xs text-muted-foreground">
              Prodáno {formatCZK(r.monthWon)} z plánu {formatCZK(r.monthPlan)} · vážená prognóza na konec měsíce {formatCZK(r.monthForecast)}
            </p>
          </div>

          <div>
            <div className="mb-2 font-medium">Top 5 věcí k řešení</div>
            <ol className="flex flex-col divide-y divide-border/70 rounded-lg ring-1 ring-border">
              {r.topExceptions.map((e, i) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {i + 1}. {e.object}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {EXCEPTION_LABEL[e.type]} · {e.action} · {e.ownerId ? owners[e.ownerId] : 'účtárna'}
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
                <div className="text-xs text-positive">Nejlepší tempo v měsíci</div>
                <div className="mt-0.5 font-semibold">{r.best.name}</div>
                <div className="text-xs text-muted-foreground">{formatPercent(r.best.pace, 0)} poměrného plánu</div>
              </div>
              <div className="rounded-lg bg-negative-soft p-3">
                <div className="text-xs text-negative">Potřebuje podporu</div>
                <div className="mt-0.5 font-semibold">{r.worst.name}</div>
                <div className="text-xs text-muted-foreground">{formatPercent(r.worst.pace, 0)} poměrného plánu</div>
              </div>
            </div>
          )}

          <div className="border-t pt-4 text-xs text-muted-foreground">
            Detail všech čísel najdete v dashboardu, kde se dá z každého čísla prokliknout na konkrétní dealy a faktury. Tento
            e-mail je ukázka, data jsou simulovaná.
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
