import type { Metadata } from 'next'
import { diffDays } from '@/lib/data/dates'
import { buildContext } from '@/lib/metrics/context'
import { activeTenders, RENEWAL_STATUS_LABEL, renewalRate, tenderWinRate, upcomingRenewals } from '@/lib/metrics/contracts'
import { RULES } from '@/lib/metrics/exceptions-shared'
import { METRICS } from '@/lib/metrics/dictionary'
import { lookup } from '@/lib/metrics/lookup'
import { formatCZK, formatDate, formatDateShort, formatNumber, formatPercent } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Pill, Section, Stat } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillButton, DrillLink } from '@/components/drill/drill-trigger'
import { MetricLabel } from '@/components/dashboard/info-tip'

export const metadata: Metadata = { title: 'Smlouvy a zakázky' }

const HORIZON_DAYS = 90

const STATUS_TONE = { 'bez-obnovy': 'negative', 'v-jednani': 'warning', obnoveno: 'positive', ztraceno: 'muted' } as const
const TENDER_TONE = { příprava: 'warning', podáno: 'muted', vyhráno: 'positive', prohráno: 'negative' } as const

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const { ds } = ctx
  const lk = lookup(ds)
  const renewals = upcomingRenewals(ds, HORIZON_DAYS)
  const rr = renewalRate(ds)
  const tenders = activeTenders(ds)
  const twr = tenderWinRate(ds)
  const atRisk = renewals.reduce((s, r) => s + r.atRisk, 0)

  return (
    <>
      <PageHeader ctx={ctx} title="Smlouvy a zakázky" description="Obnovy ročních smluv a veřejné zakázky · stav k dnešku" hidePeriod />

      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DrillButton req={{ metric: 'renewals', filters: { days: HORIZON_DAYS } }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat label={`Obnovy do ${HORIZON_DAYS} dní`} value={formatCZK(atRisk)} sub={`v ohrožení · ${renewals.length} smluv`} />
        </DrillButton>
        <DrillButton req={{ metric: 'renewal_rate' }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label={<MetricLabel id="renewal_rate" />}
            value={rr.rate === null ? '—' : formatPercent(rr.rate, 0)}
            sub={`${rr.renewed} z ${rr.ended} smluv za 12 měsíců`}
          />
        </DrillButton>
        <DrillButton req={{ metric: 'tenders' }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label="Aktivní zakázky"
            value={formatNumber(tenders.length)}
            sub={`za ${formatCZK(tenders.reduce((s, t) => s + t.value, 0))}`}
          />
        </DrillButton>
        <DrillButton req={{ metric: 'tenders', filters: { status: 'vyhráno' } }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label={<MetricLabel id="tender_win_rate" />}
            value={twr.rate === null ? '—' : formatPercent(twr.rate, 0)}
            sub={`${twr.won} vyhraných, ${twr.lost} prohraných za 12 měsíců`}
          />
        </DrillButton>
      </div>

      <Section
        title={`Obnovy v příštích ${HORIZON_DAYS} dnech`}
        description={`${METRICS.renewal_rate.label} za 12 měsíců: ${rr.rate === null ? '—' : formatPercent(rr.rate, 0)} · Kč v ohrožení = roční hodnota, kterou zatím nemáme jistou`}
      >
        {renewals.length === 0 ? (
          <EmptyState title="Žádné smlouvy nekončí" />
        ) : (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_7rem_8rem] gap-4 border-b pb-2 text-xs text-muted-foreground md:grid">
              <span>Instituce</span>
              <span className="flex justify-between">
                <span>dnes</span>
                <span>{HORIZON_DAYS / 3} dní</span>
                <span>{(HORIZON_DAYS / 3) * 2} dní</span>
                <span>{HORIZON_DAYS} dní</span>
              </span>
              <span>Obnova</span>
              <span className="text-right">V ohrožení</span>
            </div>
            {renewals.map((r) => (
              <DrillButton
                key={r.contract.id}
                req={{ metric: 'record', filters: { type: 'contract', id: r.contract.id } }}
                className="group grid grid-cols-1 gap-2 rounded-none border-b border-border/60 py-2.5 text-[13px] last:border-0 hover:bg-muted/30 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_7rem_8rem] md:items-center md:gap-4"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium group-hover:underline">{lk.institution.get(r.contract.institutionId)?.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {lk.rep.get(r.contract.ownerId)?.name} · roční {formatCZK(r.contract.annualValue)}
                  </span>
                </span>
                <span className="relative h-6">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  <span
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: 0,
                      width: `${(r.daysLeft / HORIZON_DAYS) * 100}%`,
                      background:
                        r.status === 'obnoveno' ? 'var(--positive)' : r.daysLeft <= RULES.renewalDays && r.status === 'bez-obnovy' ? 'var(--negative)' : 'var(--chart-compare)',
                      opacity: 0.55,
                    }}
                  />
                  <span
                    className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full bg-card px-1.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-border"
                    style={{ left: `${Math.min(92, Math.max(8, (r.daysLeft / HORIZON_DAYS) * 100))}%` }}
                  >
                    {formatDateShort(r.contract.endAt)} · {r.daysLeft} d
                  </span>
                </span>
                <span>
                  <Pill tone={STATUS_TONE[r.status]}>
                    {RENEWAL_STATUS_LABEL[r.status]}
                    {r.renewalDeal && r.status === 'v-jednani' ? ` · ${r.renewalDeal.stage}` : ''}
                  </Pill>
                </span>
                <span className={`tabular text-right font-medium ${r.atRisk > 0 && r.status === 'bez-obnovy' ? 'text-negative' : ''}`}>
                  {formatCZK(r.atRisk)}
                </span>
              </DrillButton>
            ))}
          </div>
        )}
      </Section>

      <Section className="mt-3" title="Veřejné zakázky" description="Aktivní zakázky podle termínu podání">
        {tenders.length === 0 ? (
          <EmptyState title="Žádné aktivní zakázky" />
        ) : (
          <DataTable minWidth={760}>
            <thead>
              <tr>
                <Th>Zakázka</Th>
                <Th>Zadavatel</Th>
                <Th align="right">Termín podání</Th>
                <Th>Stav</Th>
                <Th>Vlastník</Th>
                <Th align="right">Hodnota</Th>
              </tr>
            </thead>
            <tbody>
              {tenders.map((t) => {
                const left = diffDays(ds.today, t.submissionDeadline)
                const urgent = t.status === 'příprava' && left < RULES.tenderDays
                return (
                  <tr key={t.id} className="group hover:bg-muted/40">
                    <Td>
                      <DrillLink req={{ metric: 'record', filters: { type: 'tender', id: t.id } }} className="font-medium">
                        {t.id}
                      </DrillLink>
                      <span className="block max-w-[260px] truncate text-xs text-muted-foreground">{t.title}</span>
                    </Td>
                    <Td className="max-w-[260px] truncate">{lk.institution.get(t.institutionId)?.name}</Td>
                    <Td align="right" heat={urgent ? 'bad' : null}>
                      {formatDate(t.submissionDeadline)}
                      <span className="block text-[11px] text-muted-foreground">
                        {left >= 0 ? `za ${left} dní` : `před ${-left} dny`}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={TENDER_TONE[t.status]}>{t.status}</Pill>
                    </Td>
                    <Td className="whitespace-nowrap">{lk.rep.get(t.ownerId)?.name}</Td>
                    <Td align="right" className="font-medium">
                      {formatCZK(t.value)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        )}
      </Section>
    </>
  )
}
