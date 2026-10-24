import { addDays, diffDays, endOfMonth, minDate } from '../data/dates'
import { paymentCandidates } from '../data/match'
import type { Activity, BankPayment, Contract, Dataset, Deal, Invoice, Tender } from '../data/types'
import type { I18n } from '../i18n'
import { commissionSummary, repCommission, type CommissionLine } from './commissions'
import type { MetricContext } from './context'
import { renewalRate, renewalStatus, upcomingRenewals } from './contracts'
import { closedSpans, conversionWindow } from './conversion'
import { metricText, type MetricId } from './dictionary'
import type { DrillColumn, DrillRequest, DrillResult, DrillRow } from './drill-types'
import { dealName, institutionName, lookup, repName } from './lookup'
import {
  agingBucket,
  daysOverdue,
  deliveryChain,
  issuedInvoices,
  overdueInvoices,
  paidInvoices,
  receivableInvoices,
  unmatchedPayments,
  unsignedContracts,
} from './money'
import { inRange, TRAILING_MONTHS, type DateRange } from './period'
import {
  closingInPeriod,
  cycleDays,
  daysInStage,
  dealsWithoutNextStep,
  lostDeals,
  median,
  openDeals,
  stageProbability,
  stuckDeals,
  sum,
  weightedValue,
  wonDeals,
  type DealFilter,
} from './sales'
import { activitiesDone, overdueFollowups } from './team'

const ROW_LIMIT = 400

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

function dealFilter(f: DrillRequest['filters']): DealFilter {
  return {
    ownerId: str(f?.ownerId),
    teamId: str(f?.teamId),
    sourceId: str(f?.sourceId),
    productId: str(f?.productId),
    kraj: str(f?.kraj),
    institutionType: str(f?.institutionType),
  }
}

/** Range for the request: a specific month, the comparison period, or the selected period. */
function rangeOf(ctx: MetricContext, f: DrillRequest['filters']): DateRange & { label: string } {
  const month = str(f?.month)
  if (month) return { start: `${month}-01`, end: minDate(endOfMonth(`${month}-01`), ctx.ds.today), label: ctx.i18n.f.formatMonth(month) }
  if (f?.range === 'cmp') return { start: ctx.compare.start, end: ctx.compare.asOf, label: ctx.compare.label }
  if (f?.range === 'window') return conversionWindow(ctx.period, ctx.i18n)
  return { start: ctx.period.start, end: ctx.period.asOf, label: ctx.period.label }
}

// ── Row builders ───────────────────────────────────────────────────────────

type Cells = Record<string, string | number | null>

/** Column with its header from `drill.col.<labelKey>`. */
function col(i18n: I18n, key: string, format: DrillColumn['format'], opts: Partial<DrillColumn> & { label?: string } = {}): DrillColumn {
  const { label, ...rest } = opts
  return { key, label: i18n.t(`drill.col.${label ?? key}`), format, ...rest }
}

function baseColumns(i18n: I18n) {
  return {
    deal: col(i18n, 'deal', 'text'),
    owner: col(i18n, 'owner', 'text', { secondary: true }),
    value: col(i18n, 'value', 'czk', { align: 'right' }),
  }
}

function dealRow(ds: Dataset, i18n: I18n, d: Deal, extra: Cells = {}): DrillRow {
  return {
    id: d.id,
    ref: { metric: 'record', filters: { type: 'deal', id: d.id } },
    cells: {
      deal: dealName(ds, d, i18n),
      owner: repName(ds, d.ownerId),
      stage: i18n.term('stage', d.stage),
      value: d.value,
      ...extra,
    },
  }
}

function invoiceRow(ds: Dataset, inv: Invoice): DrillRow {
  const late = inv.paidAt ? diffDays(inv.dueAt, inv.paidAt) : diffDays(inv.dueAt, ds.today)
  return {
    id: inv.id,
    ref: { metric: 'record', filters: { type: 'invoice', id: inv.id } },
    cells: {
      number: inv.number,
      institution: institutionName(ds, inv.institutionId),
      owner: repName(ds, inv.ownerId),
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      paidAt: inv.paidAt,
      late: late > 0 ? late : null,
      amount: inv.amount,
    },
    tone: !inv.paidAt && inv.dueAt < ds.today ? 'negative' : undefined,
  }
}

function invoiceColumns(i18n: I18n): DrillColumn[] {
  return [
    col(i18n, 'number', 'text', { label: 'invoice' }),
    col(i18n, 'institution', 'text'),
    col(i18n, 'issuedAt', 'date', { secondary: true }),
    col(i18n, 'dueAt', 'date'),
    col(i18n, 'paidAt', 'date'),
    col(i18n, 'late', 'days', { align: 'right', secondary: true }),
    col(i18n, 'amount', 'czk', { align: 'right' }),
  ]
}

function activityRows(ds: Dataset, i18n: I18n, acts: Activity[]): DrillRow[] {
  const lk = lookup(ds)
  return acts.map((a) => {
    const deal = a.dealId ? lk.deal.get(a.dealId) : undefined
    return {
      id: a.id,
      ref: deal ? { metric: 'record', filters: { type: 'deal', id: deal.id } } : undefined,
      cells: {
        type: i18n.term('activity', a.type),
        subject: deal ? dealName(ds, deal, i18n) : a.type === 'hovor' ? i18n.t('drill.text.coldCall') : '—',
        owner: repName(ds, a.ownerId),
        dueAt: a.dueAt,
        doneAt: a.doneAt,
        late: !a.doneAt && a.dueAt < ds.today ? diffDays(a.dueAt, ds.today) : null,
      },
      tone: !a.doneAt && a.dueAt < ds.today ? 'negative' : undefined,
    }
  })
}

function activityColumns(i18n: I18n): DrillColumn[] {
  return [
    col(i18n, 'type', 'badge'),
    col(i18n, 'subject', 'text', { label: 'deal' }),
    col(i18n, 'owner', 'text', { secondary: true }),
    col(i18n, 'dueAt', 'date', { label: 'due' }),
    col(i18n, 'doneAt', 'date', { label: 'done' }),
    col(i18n, 'late', 'days', { align: 'right' }),
  ]
}

function commissionRows(ds: Dataset, i18n: I18n, lines: CommissionLine[]): DrillRow[] {
  const lk = lookup(ds)
  const { formatPercent, formatCoef } = i18n.f
  return lines.map((l) => ({
    id: l.id,
    ref: l.invoiceId
      ? { metric: 'record', filters: { type: 'invoice', id: l.invoiceId } }
      : { metric: 'record', filters: { type: 'deal', id: l.dealId } },
    cells: {
      status: i18n.t(`drill.text.lineKind.${l.kind}`),
      doc: l.invoiceId ? lk.invoice.get(l.invoiceId)?.number ?? '' : l.dealId,
      institution: institutionName(ds, l.institutionId),
      owner: repName(ds, l.repId),
      date: l.date,
      amount: l.amount,
      rateCoef: `${formatPercent(l.rate, 0)} × ${formatCoef(l.coefficient)}`,
      commission: l.commission,
    },
    tone: l.kind === 'paid' ? 'positive' : undefined,
  }))
}

function commissionColumns(i18n: I18n): DrillColumn[] {
  return [
    col(i18n, 'status', 'badge'),
    col(i18n, 'doc', 'text'),
    col(i18n, 'institution', 'text', { secondary: true }),
    col(i18n, 'date', 'date', { secondary: true }),
    col(i18n, 'amount', 'czk', { align: 'right', label: 'base' }),
    col(i18n, 'rateCoef', 'text', { align: 'right', secondary: true }),
    col(i18n, 'commission', 'czk', { align: 'right' }),
  ]
}

function contractRow(ds: Dataset, c: Contract, extra: Cells = {}): DrillRow {
  return {
    id: c.id,
    ref: { metric: 'record', filters: { type: 'contract', id: c.id } },
    cells: {
      id: c.id,
      institution: institutionName(ds, c.institutionId),
      owner: repName(ds, c.ownerId),
      sent: c.sentForSignatureAt,
      signed: c.signedAt,
      end: c.endAt,
      value: c.annualValue,
      ...extra,
    },
  }
}

const TENDER_STATUS_TONE: Record<Tender['status'], DrillRow['tone']> = {
  příprava: 'warning',
  podáno: undefined,
  vyhráno: 'positive',
  prohráno: 'negative',
}

function tenderRow(ds: Dataset, i18n: I18n, t: Tender): DrillRow {
  return {
    id: t.id,
    ref: { metric: 'record', filters: { type: 'tender', id: t.id } },
    cells: {
      id: t.id,
      institution: institutionName(ds, t.institutionId),
      owner: repName(ds, t.ownerId),
      deadline: t.submissionDeadline,
      status: i18n.term('tenderStatus', t.status),
      value: t.value,
    },
    tone: TENDER_STATUS_TONE[t.status],
  }
}

function paymentRow(full: Dataset, i18n: I18n, p: BankPayment): DrillRow {
  const cand = p.matchedInvoiceId ? null : paymentCandidates(full, p)[0]
  return {
    id: p.id,
    ref: { metric: 'record', filters: { type: 'payment', id: p.id } },
    cells: {
      receivedAt: p.receivedAt,
      counterparty: p.counterparty,
      vs: p.variableSymbol,
      candidate: cand
        ? i18n.t('drill.text.amountMatch', { invoice: cand.number })
        : p.matchedInvoiceId
          ? lookup(full).invoice.get(p.matchedInvoiceId)?.number ?? ''
          : '—',
      amount: p.amount,
    },
  }
}

function paymentColumns(i18n: I18n): DrillColumn[] {
  return [
    col(i18n, 'receivedAt', 'date'),
    col(i18n, 'counterparty', 'text', { label: 'payer' }),
    col(i18n, 'vs', 'text', { secondary: true }),
    col(i18n, 'candidate', 'text'),
    col(i18n, 'amount', 'czk', { align: 'right' }),
  ]
}

function result(
  base: Omit<DrillResult, 'rows' | 'truncated' | 'count'> & { rows: DrillRow[]; count?: number },
): DrillResult {
  return {
    ...base,
    count: base.count ?? base.rows.length,
    rows: base.rows.slice(0, ROW_LIMIT),
    truncated: base.rows.length > ROW_LIMIT,
  }
}

function metricHeader(i18n: I18n, id: MetricId) {
  const text = metricText(i18n, id)
  return { title: text.label, definition: text.definition }
}

// ── Resolver ───────────────────────────────────────────────────────────────

export function resolveDrill(ctx: MetricContext, req: DrillRequest): DrillResult {
  const { ds, full, i18n } = ctx
  const { t, tn, term } = i18n
  const { formatCZK, formatDate } = i18n.f
  const f = req.filters ?? {}
  const r = rangeOf(ctx, f)
  const df = dealFilter(f)
  const lk = lookup(ds)
  const C = baseColumns(i18n)
  const label = (id: MetricId) => t(`metrics.${id}.label`)
  const subtitle = r.label === ctx.period.label ? ctx.period.label : r.label

  const out = ((): DrillResult => {
    switch (req.metric) {
      case 'revenue_won':
      case 'product': {
        const deals = wonDeals(ds, r, df).sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader(i18n, 'revenue_won'),
          subtitle,
          total: { label: label('revenue_won'), value: sum(deals, (d) => d.value), format: 'czk' },
          countText: tn('drill.count.deals', deals.length),
          sumKey: 'value',
          columns: [C.deal, C.owner, col(i18n, 'closedAt', 'date'), C.value],
          rows: deals.map((d) => dealRow(ds, i18n, d, { closedAt: d.closedAt })),
        })
      }
      case 'lost': {
        const reason = str(f.reason)
        const deals = lostDeals(ds, r, df)
          .filter((d) => !reason || d.lostReason === reason)
          .sort((a, b) => b.value - a.value)
        return result({
          title: reason ? t('drill.text.lostTitle', { reason: term('lostReason', reason) }) : t('drill.text.lostAll'),
          subtitle,
          total: { label: t('drill.text.lostTotal'), value: sum(deals, (d) => d.value), format: 'czk' },
          countText: tn('drill.count.deals', deals.length),
          sumKey: 'value',
          columns: [C.deal, C.owner, col(i18n, 'lostAt', 'text', { secondary: true }), col(i18n, 'reason', 'badge'), C.value],
          rows: deals.map((d) =>
            dealRow(ds, i18n, d, {
              lostAt: d.lostAtStage ? term('stage', d.lostAtStage) : null,
              reason: d.lostReason ? term('lostReason', d.lostReason) : null,
            }),
          ),
        })
      }
      case 'win_rate': {
        const won = wonDeals(ds, r, df)
        const lost = lostDeals(ds, r, df)
        const deals = [...won, ...lost].sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader(i18n, 'win_rate'),
          subtitle,
          total: { label: label('win_rate'), value: deals.length ? won.length / deals.length : null, format: 'percent' },
          countText: tn('drill.count.closed', deals.length, { won: won.length }),
          columns: [C.deal, C.owner, col(i18n, 'stage', 'badge', { label: 'outcome' }), C.value],
          rows: deals.map((d) => ({ ...dealRow(ds, i18n, d), tone: d.stage === 'Vyhráno' ? 'positive' : 'negative' })),
        })
      }
      case 'pipeline': {
        const stage = str(f.stage)
        const deals = openDeals(ds, df)
          .filter((d) => !stage || d.stage === stage)
          .sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader(i18n, 'pipeline'),
          title: stage ? t('drill.text.pipelineStage', { stage: term('stage', stage) }) : label('pipeline'),
          subtitle: t('drill.text.openToday'),
          total: { label: label('pipeline'), value: sum(deals, (d) => d.value), format: 'czk' },
          countText: tn('drill.count.openDeals', deals.length),
          sumKey: 'value',
          columns: [C.deal, C.owner, col(i18n, 'stage', 'badge', { secondary: true }), col(i18n, 'expected', 'date'), C.value],
          rows: deals.map((d) => dealRow(ds, i18n, d, { expected: d.expectedCloseAt })),
        })
      }
      case 'weighted_forecast': {
        const won = wonDeals(ds, ctx.period, df)
        const closing = ctx.period.end >= ds.today ? closingInPeriod(ds, ctx.period, df) : []
        const rows = [
          ...won.map((d) => dealRow(ds, i18n, d, { prob: 1, weighted: d.value })),
          ...closing
            .sort((a, b) => weightedValue(b) - weightedValue(a))
            .map((d) => dealRow(ds, i18n, d, { prob: stageProbability(d.stage), weighted: weightedValue(d) })),
        ]
        return result({
          ...metricHeader(i18n, 'weighted_forecast'),
          subtitle: ctx.period.label,
          total: {
            label: label('weighted_forecast'),
            value: sum(won, (d) => d.value) + sum(closing, weightedValue),
            format: 'czk',
          },
          countText: tn('drill.count.weighted', rows.length, { won: won.length, open: closing.length }),
          sumKey: 'weighted',
          columns: [
            C.deal,
            col(i18n, 'stage', 'badge'),
            col(i18n, 'value', 'czk', { align: 'right', secondary: true }),
            col(i18n, 'prob', 'percent', { align: 'right', secondary: true }),
            col(i18n, 'weighted', 'czk', { align: 'right' }),
          ],
          rows,
        })
      }
      case 'closing_soon': {
        const days = Number(f.days ?? 14)
        const deals = closingInPeriod(ds, { start: ds.today, end: addDays(ds.today, days) }, df).sort(
          (a, b) => (a.expectedCloseAt < b.expectedCloseAt ? -1 : 1),
        )
        return result({
          title: t('drill.text.closingSoon', { days }),
          total: { label: t('drill.col.value'), value: sum(deals, (d) => d.value), format: 'czk' },
          countText: tn('drill.count.deals', deals.length),
          sumKey: 'value',
          columns: [C.deal, C.owner, col(i18n, 'stage', 'badge'), col(i18n, 'expected', 'date', { label: 'closeDate' }), C.value],
          rows: deals.map((d) => dealRow(ds, i18n, d, { expected: d.expectedCloseAt })),
        })
      }
      case 'no_next_step':
      case 'stuck_deals': {
        const stuck = req.metric === 'stuck_deals'
        const deals = (stuck ? stuckDeals(ds, df) : dealsWithoutNextStep(ds, df)).sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader(i18n, req.metric as MetricId),
          subtitle: t('drill.text.asOfToday'),
          total: { label: t('drill.text.count'), value: deals.length, format: 'int' },
          countText: tn('drill.count.dealsWorth', deals.length, { value: formatCZK(sum(deals, (d) => d.value)) }),
          columns: [
            C.deal,
            C.owner,
            col(i18n, 'stage', 'badge', { secondary: true }),
            stuck ? col(i18n, 'inStage', 'days', { align: 'right' }) : col(i18n, 'next', 'date', { label: 'nextStep' }),
            C.value,
          ],
          rows: deals.map((d) => dealRow(ds, i18n, d, { inStage: daysInStage(d, ds.today), next: d.nextStepAt })),
        })
      }
      case 'overdue_followups': {
        const acts = overdueFollowups(ds, { ownerId: str(f.ownerId) }).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
        return result({
          ...metricHeader(i18n, 'overdue_followups'),
          subtitle: t('drill.text.asOfToday'),
          total: { label: t('drill.text.count'), value: acts.length, format: 'int' },
          countText: tn('drill.count.activities', acts.length),
          columns: activityColumns(i18n),
          rows: activityRows(ds, i18n, acts),
        })
      }
      case 'activities_done': {
        const window = f.window === 'rolling28' ? { start: addDays(ds.today, -27), end: ds.today } : r
        const acts = activitiesDone(ds, window, { ownerId: str(f.ownerId), teamId: str(f.teamId) }).sort((a, b) =>
          a.doneAt! < b.doneAt! ? 1 : -1,
        )
        const byType = (type: Activity['type']) => acts.filter((a) => a.type === type).length
        return result({
          ...metricHeader(i18n, 'activities_done'),
          subtitle: f.window === 'rolling28' ? t('drill.text.lastWeeks', { weeks: 4 }) : subtitle,
          total: { label: label('activities_done'), value: acts.length, format: 'int' },
          countText: tn('drill.count.activities', acts.length),
          note: t('drill.text.activitiesNote', {
            calls: byType('hovor'),
            emails: byType('e-mail'),
            meetings: byType('schůzka'),
            followups: byType('follow-up'),
          }),
          columns: activityColumns(i18n).filter((c) => c.key !== 'late' && c.key !== 'dueAt'),
          rows: activityRows(ds, i18n, acts),
        })
      }
      case 'invoiced':
      case 'collected': {
        const paid = req.metric === 'collected'
        const invs = (paid ? paidInvoices : issuedInvoices)(ds, r, {
          ownerId: str(f.ownerId),
          productId: str(f.productId),
          teamId: str(f.teamId),
        }).sort((a, b) => b.amount - a.amount)
        return result({
          ...metricHeader(i18n, req.metric as MetricId),
          subtitle,
          total: { label: label(req.metric as MetricId), value: sum(invs, (i) => i.amount), format: 'czk' },
          countText: tn('drill.count.invoices', invs.length),
          sumKey: 'amount',
          columns: invoiceColumns(i18n),
          rows: invs.map((i) => invoiceRow(ds, i)),
        })
      }
      case 'receivables':
      case 'overdue': {
        const asOf = f.range === 'cmp' ? ctx.compare.asOf : str(f.asOf) ?? ctx.period.asOf
        const bucket = str(f.bucket)
        const institutionId = str(f.institutionId)
        const invs = (req.metric === 'overdue' ? overdueInvoices : receivableInvoices)(ds, asOf, { institutionId, ownerId: str(f.ownerId) })
          .filter((i) => !bucket || agingBucket(i, asOf) === bucket)
          .sort((a, b) => daysOverdue(b, asOf) - daysOverdue(a, asOf))
        const scope = bucket ? t(`aging.${bucket}`) : institutionId ? institutionName(ds, institutionId) : null
        return result({
          ...metricHeader(i18n, req.metric as MetricId),
          title: scope ? t('drill.text.receivablesOf', { label: scope }) : label(req.metric as MetricId),
          subtitle: t('drill.text.asOf', { date: formatDate(asOf) }),
          total: { label: t('drill.text.total'), value: sum(invs, (i) => i.amount), format: 'czk' },
          countText: tn('drill.count.invoices', invs.length),
          sumKey: 'amount',
          columns: invoiceColumns(i18n),
          rows: invs.map((i) => invoiceRow(ds, i)),
        })
      }
      case 'dso': {
        const invs = paidInvoices(ds, r).sort((a, b) => diffDays(b.issuedAt, b.paidAt!) - diffDays(a.issuedAt, a.paidAt!))
        const avg = invs.length ? sum(invs, (i) => diffDays(i.issuedAt, i.paidAt!)) / invs.length : null
        return result({
          ...metricHeader(i18n, 'dso'),
          subtitle,
          total: { label: label('dso'), value: avg, format: 'days' },
          countText: tn('drill.count.paidInvoices', invs.length),
          columns: [...invoiceColumns(i18n).filter((c) => c.key !== 'late'), col(i18n, 'days', 'days', { align: 'right', label: 'daysToPay' })],
          rows: invs.map((i) => {
            const row = invoiceRow(ds, i)
            row.cells.days = diffDays(i.issuedAt, i.paidAt!)
            return row
          }),
        })
      }
      case 'commission_payable':
      case 'commission_pending': {
        const ownerId = str(f.ownerId)
        const reps = ownerId ? [repCommission(ds, ctx.period, ownerId)] : commissionSummary(ds, ctx.period).reps
        const payable = req.metric === 'commission_payable'
        const all = f.all === 1 || f.all === '1'
        const lines = reps
          .flatMap((x) => x.lines)
          .filter((l) => all || (payable ? l.kind === 'paid' : l.kind !== 'paid'))
          .sort((a, b) => b.commission - a.commission)
        const cols = commissionColumns(i18n)
        return result({
          ...metricHeader(i18n, payable ? 'commission_payable' : 'commission_pending'),
          title: all && ownerId ? t('drill.text.commissionRep', { name: repName(ds, ownerId) }) : label(req.metric as MetricId),
          subtitle: ctx.period.label,
          total: {
            label: all ? t('drill.text.commissionAll') : label(req.metric as MetricId),
            value: sum(lines, (l) => l.commission),
            format: 'czk',
          },
          countText: tn('drill.count.items', lines.length),
          sumKey: 'commission',
          note: t('drill.text.commissionNote'),
          columns: ownerId ? cols : [...cols.slice(0, 2), col(i18n, 'owner', 'text'), ...cols.slice(2)],
          rows: commissionRows(ds, i18n, lines),
        })
      }
      case 'chain': {
        const step = str(f.step) ?? 'won'
        const chain = deliveryChain(ds, r)
        const won = wonDeals(ds, r)
        const s = chain.steps.find((x) => x.id === step)!
        const stepLabel = t(`chain.${s.id}`)
        const title = t('drill.text.chain', { step: stepLabel })
        const chainSubtitle = t('drill.text.chainSubtitle', { period: ctx.period.label })
        if (step === 'invoiced' || step === 'paid') {
          const invs = won.flatMap((d) => lk.invoicesByDeal.get(d.id) ?? []).filter((i) => step === 'invoiced' || i.paidAt)
          return result({
            title,
            subtitle: chainSubtitle,
            total: { label: stepLabel, value: sum(invs, (i) => i.amount), format: 'czk' },
            countText: tn('drill.count.invoices', invs.length),
            sumKey: 'amount',
            columns: invoiceColumns(i18n),
            rows: invs.sort((a, b) => b.amount - a.amount).map((i) => invoiceRow(ds, i)),
          })
        }
        const deals = step === 'signed' ? won.filter((d) => lk.contractsByDeal.get(d.id)?.[0]?.signedAt) : won
        return result({
          title,
          subtitle: chainSubtitle,
          total: { label: stepLabel, value: sum(deals, (d) => d.value), format: 'czk' },
          countText: tn('drill.count.deals', deals.length),
          sumKey: 'value',
          columns: [C.deal, C.owner, col(i18n, 'signed', 'date'), C.value],
          rows: deals
            .sort((a, b) => b.value - a.value)
            .map((d) => dealRow(ds, i18n, d, { signed: lk.contractsByDeal.get(d.id)?.[0]?.signedAt ?? null })),
        })
      }
      case 'unsigned_contracts': {
        const days = Number(f.days ?? 7)
        const list = unsignedContracts(ds, days)
        return result({
          title: t('drill.text.unsignedTitle'),
          subtitle: t('drill.text.unsignedSubtitle', { days }),
          total: { label: t('drill.col.value'), value: sum(list, (c) => c.annualValue), format: 'czk' },
          countText: tn('drill.count.contracts', list.length),
          sumKey: 'value',
          columns: [
            col(i18n, 'id', 'text', { label: 'contract' }),
            col(i18n, 'institution', 'text'),
            col(i18n, 'sent', 'date'),
            col(i18n, 'waiting', 'days', { align: 'right' }),
            C.value,
          ],
          rows: list.map((c) => contractRow(ds, c, { waiting: diffDays(c.sentForSignatureAt, ds.today) })),
        })
      }
      case 'renewals': {
        const status = str(f.status)
        const days = Number(f.days ?? 90)
        const rows = upcomingRenewals(ds, days).filter((x) => !status || x.status === status)
        return result({
          title: t('drill.text.renewalsTitle', { days }),
          total: { label: t('drill.text.atRisk'), value: sum(rows, (x) => x.atRisk), format: 'czk' },
          countText: tn('drill.count.contracts', rows.length),
          sumKey: 'atRisk',
          columns: [
            col(i18n, 'institution', 'text'),
            col(i18n, 'end', 'date'),
            col(i18n, 'status', 'badge', { label: 'renewal' }),
            col(i18n, 'value', 'czk', { align: 'right', secondary: true, label: 'annualValue' }),
            col(i18n, 'atRisk', 'czk', { align: 'right' }),
          ],
          rows: rows.map((x) => contractRow(ds, x.contract, { status: term('renewalStatus', x.status), atRisk: x.atRisk })),
        })
      }
      case 'renewal_rate': {
        const rr = renewalRate(ds)
        return result({
          ...metricHeader(i18n, 'renewal_rate'),
          subtitle: t('drill.text.renewalRateSubtitle', { months: TRAILING_MONTHS }),
          total: { label: label('renewal_rate'), value: rr.rate, format: 'percent' },
          countText: tn('drill.count.renewed', rr.contracts.length, { renewed: rr.renewed }),
          columns: [col(i18n, 'institution', 'text'), col(i18n, 'end', 'date'), col(i18n, 'status', 'badge', { label: 'renewal' }), C.value],
          rows: rr.contracts.map((c) => {
            const st = renewalStatus(ds, c).status
            return { ...contractRow(ds, c, { status: term('renewalStatus', st) }), tone: st === 'obnoveno' ? 'positive' : 'negative' }
          }),
        })
      }
      case 'tenders': {
        const status = str(f.status)
        const list = ds.tenders
          .filter((x) => (!status ? x.status === 'příprava' || x.status === 'podáno' : x.status === status))
          .filter(
            (x) =>
              !status ||
              status === 'příprava' ||
              status === 'podáno' ||
              inRange(lk.deal.get(x.dealId ?? '')?.closedAt, { start: addDays(ds.today, -365), end: ds.today }),
          )
          .sort((a, b) => (a.submissionDeadline < b.submissionDeadline ? -1 : 1))
        return result({
          title: status ? t('drill.text.tendersStatus', { status: term('tenderStatus', status) }) : t('drill.text.tendersActive'),
          total: { label: t('drill.col.value'), value: sum(list, (x) => x.value), format: 'czk' },
          countText: tn('drill.count.tenders', list.length),
          sumKey: 'value',
          columns: [
            col(i18n, 'id', 'text', { label: 'tender' }),
            col(i18n, 'institution', 'text', { label: 'authority' }),
            col(i18n, 'deadline', 'date', { label: 'submission' }),
            col(i18n, 'status', 'badge'),
            C.value,
          ],
          rows: list.map((x) => tenderRow(ds, i18n, x)),
        })
      }
      case 'unmatched_payments': {
        const list = unmatchedPayments(ds)
        return result({
          ...metricHeader(i18n, 'unmatched_payments'),
          total: { label: t('drill.col.amount'), value: sum(list, (p) => p.amount), format: 'czk' },
          countText: tn('drill.count.payments', list.length),
          sumKey: 'amount',
          columns: paymentColumns(i18n),
          rows: list.map((p) => paymentRow(full, i18n, p)),
        })
      }
      case 'stage_cohort': {
        const stage = str(f.stage)!
        const window = conversionWindow(ctx.period, i18n)
        const spans = closedSpans(ds, window, df).filter((s) => s.stage === stage)
        const advanced = spans.filter((s) => s.outcome !== 'lost')
        const sourceId = str(f.sourceId)
        return result({
          title: t('drill.text.cohortTitle', { stage: term('stage', stage) }),
          subtitle: [sourceId ? term('source', sourceId) : null, window.label].filter(Boolean).join(' · '),
          total: { label: t('drill.text.conversion'), value: spans.length ? advanced.length / spans.length : null, format: 'percent' },
          countText: tn('drill.count.cohort', spans.length, { advanced: advanced.length }),
          columns: [
            C.deal,
            C.owner,
            col(i18n, 'outcome', 'badge'),
            col(i18n, 'days', 'days', { align: 'right', secondary: true, label: 'inStage' }),
            C.value,
          ],
          rows: spans
            .sort((a, b) => b.deal.value - a.deal.value)
            .map((s) => ({
              ...dealRow(ds, i18n, s.deal, {
                outcome: s.outcome === 'lost' ? lostLabel(i18n, s.deal) : t('drill.text.advanced'),
                days: diffDays(s.enteredAt, s.leftAt!),
              }),
              tone: s.outcome === 'lost' ? 'negative' : undefined,
            })),
        })
      }
      case 'cycle': {
        const window = conversionWindow(ctx.period, i18n)
        const deals = wonDeals(ds, window, df).sort((a, b) => cycleDays(b) - cycleDays(a))
        const sourceId = str(f.sourceId)
        const instType = str(f.institutionType)
        return result({
          ...metricHeader(i18n, 'cycle_days'),
          subtitle: [sourceId ? term('source', sourceId) : instType ? term('institutionType', instType) : null, window.label]
            .filter(Boolean)
            .join(' · '),
          total: { label: t('drill.text.median'), value: median(deals.map(cycleDays)), format: 'days' },
          countText: tn('drill.count.wonDeals', deals.length),
          columns: [
            C.deal,
            C.owner,
            col(i18n, 'created', 'date', { secondary: true }),
            col(i18n, 'cycle', 'days', { align: 'right' }),
            C.value,
          ],
          rows: deals.map((d) => dealRow(ds, i18n, d, { created: d.createdAt, cycle: cycleDays(d) })),
        })
      }
      case 'record':
        return recordDetail(ctx, str(f.type) ?? 'deal', str(f.id) ?? '')
      default:
        return result({
          title: t('drill.text.unknown'),
          total: { label: '', value: null, format: 'int' },
          countText: '',
          columns: [],
          rows: [],
        })
    }
  })()

  return req.title ? { ...out, title: req.title } : out
}

/** `Prohráno · Cena` / `Lost · Price` */
function lostLabel(i18n: I18n, deal: Deal): string {
  const lost = i18n.term('stage', 'Prohráno')
  return deal.lostReason ? `${lost} · ${i18n.term('lostReason', deal.lostReason)}` : lost
}

// ── Single record ──────────────────────────────────────────────────────────

function recordDetail(ctx: MetricContext, type: string, id: string): DrillResult {
  const { ds, full, i18n } = ctx
  const { t, tn, term } = i18n
  const { formatCZK, formatDate, formatDays, formatPercent } = i18n.f
  const lk = lookup(full)
  const empty = (title: string): DrillResult => ({
    title,
    total: { label: '', value: null, format: 'int' },
    count: 0,
    countText: '',
    columns: [],
    rows: [],
    truncated: false,
  })

  if (type === 'invoice') {
    const inv = lk.invoice.get(id)
    if (!inv) return empty(t('drill.record.invoiceNotFound'))
    return recordDetail(ctx, 'deal', inv.dealId)
  }
  if (type === 'contract') {
    const c = lk.contract.get(id)
    if (!c) return empty(t('drill.record.contractNotFound'))
    return recordDetail(ctx, 'deal', c.dealId)
  }
  if (type === 'tender') {
    const tender = full.tenders.find((x) => x.id === id)
    if (!tender) return empty(t('drill.record.tenderNotFound'))
    if (tender.dealId) {
      const res = recordDetail(ctx, 'deal', tender.dealId)
      res.detail?.fields.unshift(
        { label: t('drill.record.tender'), value: `${tender.id} · ${term('tenderTitle', tender.title)}` },
        {
          label: t('drill.record.submissionDeadline'),
          value: formatDate(tender.submissionDeadline),
          tone: tender.status === 'příprava' ? 'warning' : undefined,
        },
        { label: t('drill.record.tenderStatus'), value: term('tenderStatus', tender.status) },
      )
      return res
    }
  }
  if (type === 'payment') {
    const p = full.payments.find((x) => x.id === id)
    if (!p) return empty(t('drill.record.paymentNotFound'))
    const cands = paymentCandidates(full, p)
    return {
      title: t('drill.record.paymentTitle', { amount: formatCZK(p.amount) }),
      subtitle: t('drill.record.received', { date: formatDate(p.receivedAt) }),
      total: { label: t('drill.record.amount'), value: p.amount, format: 'czk' },
      count: cands.length,
      countText: tn('drill.count.candidates', cands.length),
      columns: invoiceColumns(i18n),
      rows: cands.map((i) => invoiceRow(full, i)),
      truncated: false,
      detail: {
        fields: [
          { label: t('drill.record.payer'), value: p.counterparty },
          { label: t('drill.record.vs'), value: p.variableSymbol, tone: p.matchedInvoiceId ? undefined : 'negative' },
          {
            label: t('drill.record.status'),
            value: t(
              p.matchedInvoiceId
                ? p.matchMethod === 'manual'
                  ? 'drill.record.matchedManual'
                  : 'drill.record.matchedAuto'
                : 'drill.record.unmatched',
            ),
          },
          {
            label: t('drill.record.likelyInvoice'),
            value: cands[0] ? `${cands[0].number} · ${institutionName(full, cands[0].institutionId)}` : t('drill.record.noCandidate'),
          },
        ],
      },
      note: cands[0] ? t('drill.record.paymentNote') : undefined,
    }
  }

  const deal = lk.deal.get(id)
  if (!deal) return empty(t('drill.record.notFound'))
  if (!ds.salespeople.some((s) => s.id === deal.ownerId)) return empty(t('drill.record.noAccess'))
  const inst = lk.institution.get(deal.institutionId)!
  const contracts = lk.contractsByDeal.get(deal.id) ?? []
  const invoices = lk.invoicesByDeal.get(deal.id) ?? []
  const tender = lk.tenderByDeal.get(deal.id)
  const acts = (lk.activitiesByDeal.get(deal.id) ?? []).slice().sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1))
  const timeline: NonNullable<DrillResult['detail']>['timeline'] = []
  for (const h of deal.stageHistory)
    timeline.push({
      date: h.enteredAt,
      label: h.stage === 'Prohráno' ? lostLabel(i18n, deal) : term('stage', h.stage),
      tone: h.stage === 'Vyhráno' ? 'positive' : h.stage === 'Prohráno' ? 'negative' : 'neutral',
    })
  for (const c of contracts) {
    timeline.push({ date: c.sentForSignatureAt, label: t('drill.record.contractSent', { id: c.id }), tone: 'neutral' })
    if (c.signedAt) timeline.push({ date: c.signedAt, label: t('drill.record.contractSigned', { id: c.id }), tone: 'positive' })
  }
  for (const i of invoices) {
    timeline.push({
      date: i.issuedAt,
      label: t('drill.record.invoiceIssued', { number: i.number, amount: formatCZK(i.amount) }),
      tone: 'neutral',
    })
    if (i.paidAt) timeline.push({ date: i.paidAt, label: t('drill.record.invoicePaid', { number: i.number }), tone: 'positive' })
  }
  timeline.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const open = deal.closedAt === null
  const fields: NonNullable<DrillResult['detail']>['fields'] = [
    {
      label: t('drill.record.institution'),
      value: `${inst.name} (${term('institutionType', inst.type)}, ${lk.kraj.get(inst.kraj)?.name})`,
    },
    { label: t('drill.record.product'), value: term('product', deal.productId) },
    { label: t('drill.record.rep'), value: repName(full, deal.ownerId) },
    {
      label: t('drill.record.source'),
      value: term('source', deal.sourceId) + (deal.isRenewal ? t('drill.record.renewalSuffix') : ''),
    },
    {
      label: t('drill.record.stage'),
      value:
        term('stage', deal.stage) + (open ? ` · ${t('drill.record.daysInStage', { days: formatDays(daysInStage(deal, ds.today)) })}` : ''),
    },
    { label: t('drill.record.created'), value: formatDate(deal.createdAt) },
  ]
  if (open) {
    fields.push(
      {
        label: t('drill.record.expectedClose'),
        value: formatDate(deal.expectedCloseAt),
        tone: deal.expectedCloseAt < ds.today ? 'warning' : undefined,
      },
      {
        label: t('drill.record.nextStep'),
        value: deal.nextStepAt
          ? `${deal.nextStep ? term('nextStep', deal.nextStep) : ''} · ${formatDate(deal.nextStepAt)}`
          : t('drill.record.notScheduled'),
        tone: !deal.nextStepAt || deal.nextStepAt < ds.today ? 'negative' : undefined,
      },
      { label: t('drill.record.probability'), value: formatPercent(stageProbability(deal.stage), 0) },
    )
  } else {
    fields.push({
      label: t('drill.record.closed'),
      value: t('drill.record.closedValue', { date: formatDate(deal.closedAt), cycle: formatDays(cycleDays(deal)) }),
    })
  }
  if (tender)
    fields.push({
      label: t('drill.record.tender'),
      value: t('drill.record.tenderValue', {
        id: tender.id,
        date: formatDate(tender.submissionDeadline),
        status: term('tenderStatus', tender.status),
      }),
    })
  const unpaid = invoices.filter((i) => !i.paidAt)
  if (unpaid.length)
    fields.push({
      label: t('drill.record.unpaid'),
      value: formatCZK(sum(unpaid, (i) => i.amount)),
      tone: unpaid.some((i) => i.dueAt < ds.today) ? 'negative' : undefined,
    })

  return {
    title: dealName(full, deal, i18n),
    subtitle: `${deal.id} · ${formatCZK(deal.value)}`,
    total: { label: t('drill.record.dealValue'), value: deal.value, format: 'czk' },
    count: acts.length,
    countText: tn('drill.count.activities', acts.length),
    columns: activityColumns(i18n).filter((c) => c.key !== 'subject' && c.key !== 'owner'),
    rows: activityRows(full, i18n, acts).slice(0, 60),
    truncated: acts.length > 60,
    detail: { fields, timeline },
  }
}
