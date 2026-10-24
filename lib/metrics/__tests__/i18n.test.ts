import { describe, expect, it } from 'vitest'
import cs from '../../../messages/cs.json'
import en from '../../../messages/en.json'
import { getDataset } from '../../data'
import { LOCALES } from '../../i18n'
import { buildContext } from '../context'
import { resolveDrill } from '../drill'
import type { DrillRequest } from '../drill-types'
import { exceptions, ruleTexts } from '../exceptions'
import { revenueWon } from '../sales'
import { moneyView } from '../views/money'
import { overviewView } from '../views/overview'
import { pipelineView } from '../views/pipeline'
import { repView, teamView } from '../views/team'

const TODAY = '2026-10-19'

/** Keys of a dictionary; plural forms count as one key. */
function keys(tree: object, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    if (Array.isArray(v) || typeof v !== 'object') return [prefix + k]
    if ('other' in v) return [prefix + k]
    return keys(v, `${prefix}${k}.`)
  })
}

/** All strings in a value; a missing translation comes back as its dotted key. */
function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(strings)
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings)
  return []
}
const RAW_KEY = /^(metrics|drill|exceptions|views|terms|leaks|aging|chain|pages|ui|shell|nav|period|compare)\.[\w.-]+$/

describe('dictionaries', () => {
  it('cs and en have the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(cs).sort())
  })
})

describe.each(LOCALES)('no missing texts (%s)', (locale) => {
  const ctx = buildContext({ period: '2026-10' }, TODAY, locale)
  const rep = ctx.ds.salespeople[0].id
  const deal = ctx.ds.deals.find((d) => d.stage === 'Vyhráno')!
  const requests: DrillRequest[] = [
    ...[
      'revenue_won', 'lost', 'win_rate', 'pipeline', 'weighted_forecast', 'closing_soon', 'no_next_step', 'stuck_deals',
      'overdue_followups', 'activities_done', 'invoiced', 'collected', 'receivables', 'overdue', 'dso', 'commission_payable',
      'commission_pending', 'chain', 'unsigned_contracts', 'renewals', 'renewal_rate', 'tenders', 'unmatched_payments', 'cycle',
    ].map((metric) => ({ metric })),
    { metric: 'lost', filters: { reason: 'Cena' } },
    { metric: 'pipeline', filters: { stage: 'Nabídka' } },
    { metric: 'receivables', filters: { bucket: '60+' } },
    { metric: 'commission_payable', filters: { ownerId: rep, all: 1 } },
    { metric: 'chain', filters: { step: 'paid' } },
    { metric: 'tenders', filters: { status: 'vyhráno' } },
    { metric: 'stage_cohort', filters: { stage: 'Nabídka', sourceId: 'webinar' } },
    { metric: 'activities_done', filters: { ownerId: rep, window: 'rolling28' } },
    { metric: 'record', filters: { type: 'deal', id: deal.id } },
    { metric: 'record', filters: { type: 'payment', id: ctx.ds.payments.find((p) => !p.matchedInvoiceId)!.id } },
    { metric: 'record', filters: { type: 'tender', id: ctx.ds.tenders.find((t) => t.dealId)!.id } },
    { metric: 'record', filters: { type: 'invoice', id: 'missing' } },
  ]

  it.each(requests.map((r) => [JSON.stringify(r), r] as const))('drill %s', (_name, req) => {
    const res = resolveDrill(ctx, req)
    expect(strings(res).filter((s) => RAW_KEY.test(s))).toEqual([])
  })

  it('views, exceptions and rules', () => {
    const out = [
      overviewView(ctx),
      pipelineView(ctx),
      moneyView(ctx),
      teamView(ctx),
      repView(ctx, rep),
      exceptions(ctx.ds, ctx.full, ctx.i18n),
      ruleTexts(ctx.i18n),
    ]
    expect(strings(out).filter((s) => RAW_KEY.test(s))).toEqual([])
  })

  it('language does not change the numbers', () => {
    const other = buildContext({ period: '2026-10' }, TODAY, locale === 'cs' ? 'en' : 'cs')
    expect(resolveDrill(ctx, { metric: 'revenue_won' }).total.value).toBe(revenueWon(getDataset(TODAY), other.period))
  })
})

describe('english formatting', () => {
  const { f } = buildContext({}, TODAY, 'en').i18n
  // Spaces inside one value are non-breaking, so normalise them for readable expectations.
  const plain = (s: string) => s.replace(/\u00a0/g, ' ')
  it('uses en conventions', () => {
    expect(plain(f.formatCZK(1_087_400))).toBe('CZK 1,087,400')
    expect(f.formatPercent(0.145)).toBe('14.5%')
    expect(plain(f.formatDate('2026-10-19'))).toBe('19 Oct 2026')
    expect(plain(f.formatDays(1))).toBe('1 day')
    expect(plain(f.formatDays(12))).toBe('12 days')
  })
})
