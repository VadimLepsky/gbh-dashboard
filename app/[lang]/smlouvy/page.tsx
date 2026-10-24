import type { Metadata } from 'next'
import { diffDays } from '@/lib/data/dates'
import { pageContext, pageMetadata, type PageProps } from '@/lib/page'
import { activeTenders, renewalRate, tenderWinRate, upcomingRenewals } from '@/lib/metrics/contracts'
import { RULES } from '@/lib/metrics/exceptions-shared'
import { lookup } from '@/lib/metrics/lookup'
import { TRAILING_MONTHS } from '@/lib/metrics/period'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Pill, Section, Stat } from '@/components/dashboard/primitives'
import { DataTable, Td, Th } from '@/components/dashboard/table'
import { DrillButton, DrillLink } from '@/components/drill/drill-trigger'
import { MetricLabel } from '@/components/dashboard/info-tip'

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return pageMetadata(params, 'nav.items.contracts')
}

const HORIZON_DAYS = 90

const STATUS_TONE = { 'bez-obnovy': 'negative', 'v-jednani': 'warning', obnoveno: 'positive', ztraceno: 'muted' } as const
const TENDER_TONE = { příprava: 'warning', podáno: 'muted', vyhráno: 'positive', prohráno: 'negative' } as const

export default async function ContractsPage(props: PageProps) {
  const { ctx, t, tn, term, f } = await pageContext(props)
  const { formatCZK, formatDate, formatDateShort, formatDays, formatNumber, formatPercent } = f
  const { ds } = ctx
  const lk = lookup(ds)
  const renewals = upcomingRenewals(ds, HORIZON_DAYS)
  const rr = renewalRate(ds)
  const tenders = activeTenders(ds)
  const twr = tenderWinRate(ds)
  const atRisk = renewals.reduce((s, r) => s + r.atRisk, 0)

  return (
    <>
      <PageHeader ctx={ctx} title={t('nav.items.contracts')} description={t('pages.contracts.description')} hidePeriod />

      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DrillButton req={{ metric: 'renewals', filters: { days: HORIZON_DAYS } }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label={t('pages.contracts.renewalsWithin', { days: formatDays(HORIZON_DAYS) })}
            value={formatCZK(atRisk)}
            sub={t('pages.contracts.atRiskOf', { contracts: tn('drill.count.contracts', renewals.length) })}
          />
        </DrillButton>
        <DrillButton req={{ metric: 'renewal_rate' }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label={<MetricLabel id="renewal_rate" />}
            value={rr.rate === null ? '—' : formatPercent(rr.rate, 0)}
            sub={t('pages.contracts.renewedOf', { renewed: rr.renewed, ended: rr.ended, months: TRAILING_MONTHS })}
          />
        </DrillButton>
        <DrillButton req={{ metric: 'tenders' }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label={t('pages.contracts.activeTenders')}
            value={formatNumber(tenders.length)}
            sub={t('pages.contracts.worth', { value: formatCZK(tenders.reduce((s, x) => s + x.value, 0)) })}
          />
        </DrillButton>
        <DrillButton req={{ metric: 'tenders', filters: { status: 'vyhráno' } }} className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07] hover:ring-foreground/15">
          <Stat
            label={<MetricLabel id="tender_win_rate" />}
            value={twr.rate === null ? '—' : formatPercent(twr.rate, 0)}
            sub={t('pages.contracts.tenderStats', { won: twr.won, lost: twr.lost, months: TRAILING_MONTHS })}
          />
        </DrillButton>
      </div>

      <Section
        title={t('pages.contracts.renewals', { days: HORIZON_DAYS })}
        description={t('pages.contracts.renewalsDesc', {
          label: t('metrics.renewal_rate.label'),
          months: TRAILING_MONTHS,
          rate: rr.rate === null ? '—' : formatPercent(rr.rate, 0),
        })}
      >
        {renewals.length === 0 ? (
          <EmptyState title={t('pages.contracts.noRenewals')} />
        ) : (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_7rem_8rem] gap-4 border-b pb-2 text-xs text-muted-foreground md:grid">
              <span>{t('pages.contracts.institution')}</span>
              <span className="flex justify-between">
                <span>{t('pages.contracts.today')}</span>
                <span>{formatDays(HORIZON_DAYS / 3)}</span>
                <span>{formatDays((HORIZON_DAYS / 3) * 2)}</span>
                <span>{formatDays(HORIZON_DAYS)}</span>
              </span>
              <span>{t('pages.contracts.renewal')}</span>
              <span className="text-right">{t('pages.contracts.atRisk')}</span>
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
                    {t('pages.contracts.annual', { owner: lk.rep.get(r.contract.ownerId)?.name ?? '—', value: formatCZK(r.contract.annualValue) })}
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
                    {formatDateShort(r.contract.endAt)} · {t('pages.contracts.daysShort', { days: r.daysLeft })}
                  </span>
                </span>
                <span>
                  <Pill tone={STATUS_TONE[r.status]}>
                    {term('renewalStatus', r.status)}
                    {r.renewalDeal && r.status === 'v-jednani' ? ` · ${term('stage', r.renewalDeal.stage)}` : ''}
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

      <Section className="mt-3" title={t('pages.contracts.tenders')} description={t('pages.contracts.tendersDesc')}>
        {tenders.length === 0 ? (
          <EmptyState title={t('pages.contracts.noTenders')} />
        ) : (
          <DataTable minWidth={760}>
            <thead>
              <tr>
                <Th>{t('pages.contracts.tender')}</Th>
                <Th>{t('pages.contracts.authority')}</Th>
                <Th align="right">{t('pages.contracts.deadline')}</Th>
                <Th>{t('pages.contracts.status')}</Th>
                <Th>{t('pages.contracts.owner')}</Th>
                <Th align="right">{t('pages.contracts.value')}</Th>
              </tr>
            </thead>
            <tbody>
              {tenders.map((tender) => {
                const left = diffDays(ds.today, tender.submissionDeadline)
                const urgent = tender.status === 'příprava' && left < RULES.tenderDays
                return (
                  <tr key={tender.id} className="group hover:bg-muted/40">
                    <Td>
                      <DrillLink req={{ metric: 'record', filters: { type: 'tender', id: tender.id } }} className="font-medium">
                        {tender.id}
                      </DrillLink>
                      <span className="block max-w-[260px] truncate text-xs text-muted-foreground">{term('tenderTitle', tender.title)}</span>
                    </Td>
                    <Td className="max-w-[260px] truncate">{lk.institution.get(tender.institutionId)?.name}</Td>
                    <Td align="right" heat={urgent ? 'bad' : null}>
                      {formatDate(tender.submissionDeadline)}
                      <span className="block text-[11px] text-muted-foreground">
                        {left >= 0 ? t('pages.contracts.inDays', { days: formatDays(left) }) : tn('pages.contracts.daysAgo', -left)}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={TENDER_TONE[tender.status]}>{term('tenderStatus', tender.status)}</Pill>
                    </Td>
                    <Td className="whitespace-nowrap">{lk.rep.get(tender.ownerId)?.name}</Td>
                    <Td align="right" className="font-medium">
                      {formatCZK(tender.value)}
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
