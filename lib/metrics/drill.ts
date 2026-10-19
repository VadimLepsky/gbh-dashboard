import { addDays, diffDays, endOfMonth, minDate } from '../data/dates'
import { paymentCandidates } from '../data/match'
import type { Activity, BankPayment, Contract, Dataset, Deal, Invoice, Tender } from '../data/types'
import { formatCZK, formatDate, formatDays, formatPercent } from '../format'
import { commissionSummary, repCommission, type CommissionLine } from './commissions'
import type { MetricContext } from './context'
import { renewalRate, renewalStatus, RENEWAL_STATUS_LABEL, upcomingRenewals } from './contracts'
import { closedSpans, conversionWindow } from './conversion'
import { METRICS, type MetricId } from './dictionary'
import type { DrillColumn, DrillRequest, DrillResult, DrillRow } from './drill-types'
import { dealName, institutionName, lookup, repName } from './lookup'
import {
  agingBucket,
  AGING_BUCKETS,
  daysOverdue,
  deliveryChain,
  issuedInvoices,
  overdueInvoices,
  paidInvoices,
  receivableInvoices,
  unmatchedPayments,
  unsignedContracts,
} from './money'
import { inRange, type DateRange } from './period'
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
  if (month) return { start: `${month}-01`, end: minDate(endOfMonth(`${month}-01`), ctx.ds.today), label: month }
  if (f?.range === 'cmp') return { start: ctx.compare.start, end: ctx.compare.asOf, label: ctx.compare.label }
  return { start: ctx.period.start, end: ctx.period.asOf, label: ctx.period.label }
}

// ── Row builders ───────────────────────────────────────────────────────────

const C = {
  deal: { key: 'deal', label: 'Deal', format: 'text' } as DrillColumn,
  owner: { key: 'owner', label: 'Obchodník', format: 'text', secondary: true } as DrillColumn,
  value: { key: 'value', label: 'Hodnota', format: 'czk', align: 'right' } as DrillColumn,
}

function dealRow(ds: Dataset, d: Deal, extra: Record<string, string | number | null> = {}): DrillRow {
  return {
    id: d.id,
    ref: { metric: 'record', filters: { type: 'deal', id: d.id } },
    cells: { deal: dealName(ds, d), owner: repName(ds, d.ownerId), stage: d.stage, value: d.value, ...extra },
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

const INVOICE_COLUMNS: DrillColumn[] = [
  { key: 'number', label: 'Faktura', format: 'text' },
  { key: 'institution', label: 'Instituce', format: 'text' },
  { key: 'issuedAt', label: 'Vystaveno', format: 'date', secondary: true },
  { key: 'dueAt', label: 'Splatnost', format: 'date' },
  { key: 'paidAt', label: 'Uhrazeno', format: 'date' },
  { key: 'late', label: 'Zpoždění', format: 'days', align: 'right', secondary: true },
  { key: 'amount', label: 'Částka', format: 'czk', align: 'right' },
]

const ACTIVITY_TYPE_LABEL: Record<Activity['type'], string> = {
  hovor: 'Hovor',
  'e-mail': 'E-mail',
  schůzka: 'Schůzka',
  'follow-up': 'Follow-up',
}

function activityRows(ds: Dataset, acts: Activity[]): DrillRow[] {
  const lk = lookup(ds)
  return acts.map((a) => {
    const deal = a.dealId ? lk.deal.get(a.dealId) : undefined
    return {
      id: a.id,
      ref: deal ? { metric: 'record', filters: { type: 'deal', id: deal.id } } : undefined,
      cells: {
        type: ACTIVITY_TYPE_LABEL[a.type],
        subject: deal ? dealName(ds, deal) : a.type === 'hovor' ? 'Cold call (nový kontakt)' : '—',
        owner: repName(ds, a.ownerId),
        dueAt: a.dueAt,
        doneAt: a.doneAt,
        late: !a.doneAt && a.dueAt < ds.today ? diffDays(a.dueAt, ds.today) : null,
      },
      tone: !a.doneAt && a.dueAt < ds.today ? 'negative' : undefined,
    }
  })
}

const ACTIVITY_COLUMNS: DrillColumn[] = [
  { key: 'type', label: 'Typ', format: 'badge' },
  { key: 'subject', label: 'Deal', format: 'text' },
  { key: 'owner', label: 'Obchodník', format: 'text', secondary: true },
  { key: 'dueAt', label: 'Termín', format: 'date' },
  { key: 'doneAt', label: 'Splněno', format: 'date' },
  { key: 'late', label: 'Zpoždění', format: 'days', align: 'right' },
]

const LINE_KIND: Record<CommissionLine['kind'], string> = {
  paid: 'K výplatě',
  unpaid: 'Čeká na úhradu',
  uninvoiced: 'Čeká na fakturaci',
}

function commissionRows(ds: Dataset, lines: CommissionLine[]): DrillRow[] {
  const lk = lookup(ds)
  return lines.map((l) => ({
    id: l.id,
    ref: l.invoiceId
      ? { metric: 'record', filters: { type: 'invoice', id: l.invoiceId } }
      : { metric: 'record', filters: { type: 'deal', id: l.dealId } },
    cells: {
      status: LINE_KIND[l.kind],
      doc: l.invoiceId ? lk.invoice.get(l.invoiceId)?.number ?? '' : l.dealId,
      institution: institutionName(ds, l.institutionId),
      owner: repName(ds, l.repId),
      date: l.date,
      amount: l.amount,
      rateCoef: `${formatPercent(l.rate, 0)} × ${String(l.coefficient).replace('.', ',')}`,
      commission: l.commission,
    },
    tone: l.kind === 'paid' ? 'positive' : undefined,
  }))
}

const COMMISSION_COLUMNS: DrillColumn[] = [
  { key: 'status', label: 'Stav', format: 'badge' },
  { key: 'doc', label: 'Faktura / deal', format: 'text' },
  { key: 'institution', label: 'Instituce', format: 'text', secondary: true },
  { key: 'date', label: 'Datum', format: 'date', secondary: true },
  { key: 'amount', label: 'Základ', format: 'czk', align: 'right' },
  { key: 'rateCoef', label: 'Sazba × koef.', format: 'text', align: 'right', secondary: true },
  { key: 'commission', label: 'Provize', format: 'czk', align: 'right' },
]

function contractRow(ds: Dataset, c: Contract, extra: Record<string, string | number | null> = {}): DrillRow {
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

function tenderRow(ds: Dataset, t: Tender): DrillRow {
  return {
    id: t.id,
    ref: { metric: 'record', filters: { type: 'tender', id: t.id } },
    cells: {
      id: t.id,
      institution: institutionName(ds, t.institutionId),
      owner: repName(ds, t.ownerId),
      deadline: t.submissionDeadline,
      status: t.status,
      value: t.value,
    },
    tone: TENDER_STATUS_TONE[t.status],
  }
}

function paymentRow(ds: Dataset, full: Dataset, p: BankPayment): DrillRow {
  const cand = p.matchedInvoiceId ? null : paymentCandidates(full, p)[0]
  return {
    id: p.id,
    ref: { metric: 'record', filters: { type: 'payment', id: p.id } },
    cells: {
      receivedAt: p.receivedAt,
      counterparty: p.counterparty,
      vs: p.variableSymbol,
      candidate: cand ? `${cand.number} (shoda částky)` : p.matchedInvoiceId ? lookup(full).invoice.get(p.matchedInvoiceId)?.number ?? '' : '—',
      amount: p.amount,
    },
  }
}

const PAYMENT_COLUMNS: DrillColumn[] = [
  { key: 'receivedAt', label: 'Přijato', format: 'date' },
  { key: 'counterparty', label: 'Plátce', format: 'text' },
  { key: 'vs', label: 'VS', format: 'text', secondary: true },
  { key: 'candidate', label: 'Kandidát', format: 'text' },
  { key: 'amount', label: 'Částka', format: 'czk', align: 'right' },
]

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

function metricHeader(id: MetricId) {
  return { title: METRICS[id].label, definition: METRICS[id].definition }
}

// ── Resolver ───────────────────────────────────────────────────────────────

export function resolveDrill(ctx: MetricContext, req: DrillRequest): DrillResult {
  const { ds, full } = ctx
  const f = req.filters ?? {}
  const r = rangeOf(ctx, f)
  const df = dealFilter(f)
  const lk = lookup(ds)
  const subtitle = r.label === ctx.period.label ? ctx.period.label : r.label

  const out = ((): DrillResult => {
    switch (req.metric) {
      case 'revenue_won':
      case 'product': {
        const deals = wonDeals(ds, r, df).sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader('revenue_won'),
          subtitle,
          total: { label: 'Prodáno', value: sum(deals, (d) => d.value), format: 'czk' },
          countLabel: 'dealů',
          sumKey: 'value',
          columns: [C.deal, C.owner, { key: 'closedAt', label: 'Uzavřeno', format: 'date' }, C.value],
          rows: deals.map((d) => dealRow(ds, d, { closedAt: d.closedAt })),
        })
      }
      case 'lost': {
        const reason = str(f.reason)
        const deals = lostDeals(ds, r, df)
          .filter((d) => !reason || d.lostReason === reason)
          .sort((a, b) => b.value - a.value)
        return result({
          title: reason ? `Prohráno · ${reason}` : 'Prohrané dealy',
          subtitle,
          total: { label: 'Ztracená hodnota', value: sum(deals, (d) => d.value), format: 'czk' },
          countLabel: 'dealů',
          sumKey: 'value',
          columns: [
            C.deal,
            C.owner,
            { key: 'lostAt', label: 'Ve fázi', format: 'text', secondary: true },
            { key: 'reason', label: 'Důvod', format: 'badge' },
            C.value,
          ],
          rows: deals.map((d) => dealRow(ds, d, { lostAt: d.lostAtStage, reason: d.lostReason })),
        })
      }
      case 'win_rate': {
        const won = wonDeals(ds, r, df)
        const lost = lostDeals(ds, r, df)
        const deals = [...won, ...lost].sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader('win_rate'),
          subtitle,
          total: { label: 'Win rate', value: deals.length ? won.length / deals.length : null, format: 'percent' },
          countLabel: `uzavřených (${won.length} vyhráno)`,
          columns: [C.deal, C.owner, { key: 'stage', label: 'Výsledek', format: 'badge' }, C.value],
          rows: deals.map((d) => ({ ...dealRow(ds, d), tone: d.stage === 'Vyhráno' ? 'positive' : 'negative' })),
        })
      }
      case 'pipeline': {
        const stage = str(f.stage)
        const deals = openDeals(ds, df)
          .filter((d) => !stage || d.stage === stage)
          .sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader('pipeline'),
          title: stage ? `Pipeline · ${stage}` : 'Pipeline',
          subtitle: 'otevřené dealy k dnešku',
          total: { label: 'Pipeline', value: sum(deals, (d) => d.value), format: 'czk' },
          countLabel: 'otevřených dealů',
          sumKey: 'value',
          columns: [
            C.deal,
            C.owner,
            { key: 'stage', label: 'Fáze', format: 'badge', secondary: true },
            { key: 'expected', label: 'Očekávané uzavření', format: 'date' },
            C.value,
          ],
          rows: deals.map((d) => dealRow(ds, d, { expected: d.expectedCloseAt })),
        })
      }
      case 'weighted_forecast': {
        const won = wonDeals(ds, ctx.period, df)
        const closing = ctx.period.end >= ds.today ? closingInPeriod(ds, ctx.period, df) : []
        const rows = [
          ...won.map((d) => dealRow(ds, d, { stage: 'Vyhráno', prob: 1, weighted: d.value })),
          ...closing
            .sort((a, b) => weightedValue(b) - weightedValue(a))
            .map((d) => dealRow(ds, d, { prob: stageProbability(d.stage), weighted: weightedValue(d) })),
        ]
        return result({
          ...metricHeader('weighted_forecast'),
          subtitle: ctx.period.label,
          total: {
            label: 'Vážená prognóza',
            value: sum(won, (d) => d.value) + sum(closing, weightedValue),
            format: 'czk',
          },
          countLabel: `dealů (${won.length} vyhraných, ${closing.length} otevřených)`,
          sumKey: 'weighted',
          columns: [
            C.deal,
            { key: 'stage', label: 'Fáze', format: 'badge' },
            { key: 'value', label: 'Hodnota', format: 'czk', align: 'right', secondary: true },
            { key: 'prob', label: 'Pravd.', format: 'percent', align: 'right', secondary: true },
            { key: 'weighted', label: 'Vážená hodnota', format: 'czk', align: 'right' },
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
          title: `Uzavírání v příštích ${days} dnech`,
          total: { label: 'Hodnota', value: sum(deals, (d) => d.value), format: 'czk' },
          countLabel: 'dealů',
          sumKey: 'value',
          columns: [C.deal, C.owner, { key: 'stage', label: 'Fáze', format: 'badge' }, { key: 'expected', label: 'Uzavření', format: 'date' }, C.value],
          rows: deals.map((d) => dealRow(ds, d, { expected: d.expectedCloseAt })),
        })
      }
      case 'no_next_step':
      case 'stuck_deals': {
        const stuck = req.metric === 'stuck_deals'
        const deals = (stuck ? stuckDeals(ds, df) : dealsWithoutNextStep(ds, df)).sort((a, b) => b.value - a.value)
        return result({
          ...metricHeader(req.metric as MetricId),
          subtitle: 'stav k dnešku',
          total: { label: 'Počet', value: deals.length, format: 'int' },
          countLabel: `dealů za ${formatCZK(sum(deals, (d) => d.value))}`,
          columns: [
            C.deal,
            C.owner,
            { key: 'stage', label: 'Fáze', format: 'badge', secondary: true },
            stuck
              ? { key: 'inStage', label: 'Dní ve fázi', format: 'days', align: 'right' }
              : { key: 'next', label: 'Další krok', format: 'date' },
            C.value,
          ],
          rows: deals.map((d) => dealRow(ds, d, { inStage: daysInStage(d, ds.today), next: d.nextStepAt })),
        })
      }
      case 'overdue_followups': {
        const acts = overdueFollowups(ds, { ownerId: str(f.ownerId) }).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
        return result({
          ...metricHeader('overdue_followups'),
          subtitle: 'stav k dnešku',
          total: { label: 'Počet', value: acts.length, format: 'int' },
          countLabel: 'aktivit',
          columns: ACTIVITY_COLUMNS,
          rows: activityRows(ds, acts),
        })
      }
      case 'activities_done': {
        const window = f.window === 'rolling28' ? { start: addDays(ds.today, -27), end: ds.today } : r
        const acts = activitiesDone(ds, window, { ownerId: str(f.ownerId), teamId: str(f.teamId) }).sort((a, b) =>
          a.doneAt! < b.doneAt! ? 1 : -1,
        )
        const byType = (t: Activity['type']) => acts.filter((a) => a.type === t).length
        return result({
          ...metricHeader('activities_done'),
          subtitle: f.window === 'rolling28' ? 'poslední 4 týdny' : subtitle,
          total: { label: 'Splněné aktivity', value: acts.length, format: 'int' },
          countLabel: 'aktivit',
          note: `Hovory ${byType('hovor')} · e-maily ${byType('e-mail')} · schůzky ${byType('schůzka')} · follow-upy ${byType('follow-up')}`,
          columns: ACTIVITY_COLUMNS.filter((c) => c.key !== 'late' && c.key !== 'dueAt'),
          rows: activityRows(ds, acts),
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
          ...metricHeader(req.metric as MetricId),
          subtitle,
          total: { label: METRICS[req.metric as MetricId].label, value: sum(invs, (i) => i.amount), format: 'czk' },
          countLabel: 'faktur',
          sumKey: 'amount',
          columns: INVOICE_COLUMNS,
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
        const bucketLabel = AGING_BUCKETS.find((b) => b.id === bucket)?.label
        return result({
          ...metricHeader(req.metric as MetricId),
          title: bucketLabel ? `Pohledávky · ${bucketLabel}` : institutionId ? `Pohledávky · ${institutionName(ds, institutionId)}` : METRICS[req.metric as MetricId].label,
          subtitle: `stav k ${formatDate(asOf)}`,
          total: { label: 'Celkem', value: sum(invs, (i) => i.amount), format: 'czk' },
          countLabel: 'faktur',
          sumKey: 'amount',
          columns: INVOICE_COLUMNS,
          rows: invs.map((i) => invoiceRow(ds, i)),
        })
      }
      case 'dso': {
        const invs = paidInvoices(ds, r).sort((a, b) => diffDays(b.issuedAt, b.paidAt!) - diffDays(a.issuedAt, a.paidAt!))
        const avg = invs.length ? sum(invs, (i) => diffDays(i.issuedAt, i.paidAt!)) / invs.length : null
        return result({
          ...metricHeader('dso'),
          subtitle,
          total: { label: 'DSO', value: avg, format: 'days' },
          countLabel: 'uhrazených faktur',
          columns: [
            ...INVOICE_COLUMNS.filter((c) => c.key !== 'late'),
            { key: 'days', label: 'Dní k úhradě', format: 'days', align: 'right' },
          ],
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
        return result({
          ...metricHeader(payable ? 'commission_payable' : 'commission_pending'),
          title: all && ownerId ? `Provize · ${repName(ds, ownerId)}` : METRICS[req.metric as MetricId].label,
          subtitle: ctx.period.label,
          total: { label: all ? 'Provize celkem (k výplatě + čeká)' : METRICS[req.metric as MetricId].label, value: sum(lines, (l) => l.commission), format: 'czk' },
          countLabel: 'položek',
          sumKey: 'commission',
          note: 'Provize vzniká úhradou faktury. Koeficient KPI podle plnění plánu v měsíci úhrady.',
          columns: ownerId ? COMMISSION_COLUMNS : [...COMMISSION_COLUMNS.slice(0, 2), { key: 'owner', label: 'Obchodník', format: 'text' }, ...COMMISSION_COLUMNS.slice(2)],
          rows: commissionRows(ds, lines),
        })
      }
      case 'chain': {
        const step = str(f.step) ?? 'won'
        const chain = deliveryChain(ds, r)
        const won = wonDeals(ds, r)
        const s = chain.steps.find((x) => x.id === step)!
        if (step === 'invoiced' || step === 'paid') {
          const invs = won.flatMap((d) => lk.invoicesByDeal.get(d.id) ?? []).filter((i) => step === 'invoiced' || i.paidAt)
          return result({
            title: `Řetězec · ${s.label}`,
            subtitle: `dealy vyhrané v období ${ctx.period.label}`,
            total: { label: s.label, value: sum(invs, (i) => i.amount), format: 'czk' },
            countLabel: 'faktur',
            sumKey: 'amount',
            columns: INVOICE_COLUMNS,
            rows: invs.sort((a, b) => b.amount - a.amount).map((i) => invoiceRow(ds, i)),
          })
        }
        const deals =
          step === 'signed'
            ? won.filter((d) => lk.contractsByDeal.get(d.id)?.[0]?.signedAt)
            : won
        return result({
          title: `Řetězec · ${s.label}`,
          subtitle: `dealy vyhrané v období ${ctx.period.label}`,
          total: { label: s.label, value: sum(deals, (d) => d.value), format: 'czk' },
          countLabel: 'dealů',
          sumKey: 'value',
          columns: [C.deal, C.owner, { key: 'signed', label: 'Podepsáno', format: 'date' }, C.value],
          rows: deals
            .sort((a, b) => b.value - a.value)
            .map((d) => dealRow(ds, d, { signed: lk.contractsByDeal.get(d.id)?.[0]?.signedAt ?? null })),
        })
      }
      case 'unsigned_contracts': {
        const list = unsignedContracts(ds, Number(f.days ?? 7))
        return result({
          title: 'Smlouvy čekající na podpis',
          subtitle: `déle než ${Number(f.days ?? 7)} dní`,
          total: { label: 'Hodnota', value: sum(list, (c) => c.annualValue), format: 'czk' },
          countLabel: 'smluv',
          sumKey: 'value',
          columns: [
            { key: 'id', label: 'Smlouva', format: 'text' },
            { key: 'institution', label: 'Instituce', format: 'text' },
            { key: 'sent', label: 'Odesláno', format: 'date' },
            { key: 'waiting', label: 'Čeká', format: 'days', align: 'right' },
            C.value,
          ],
          rows: list.map((c) => contractRow(ds, c, { waiting: diffDays(c.sentForSignatureAt, ds.today) })),
        })
      }
      case 'renewals': {
        const status = str(f.status)
        const rows = upcomingRenewals(ds, Number(f.days ?? 90)).filter((x) => !status || x.status === status)
        return result({
          title: 'Obnovy v příštích 90 dnech',
          total: { label: 'Kč v ohrožení', value: sum(rows, (x) => x.atRisk), format: 'czk' },
          countLabel: 'smluv',
          sumKey: 'atRisk',
          columns: [
            { key: 'institution', label: 'Instituce', format: 'text' },
            { key: 'end', label: 'Konec', format: 'date' },
            { key: 'status', label: 'Obnova', format: 'badge' },
            { key: 'value', label: 'Roční hodnota', format: 'czk', align: 'right', secondary: true },
            { key: 'atRisk', label: 'V ohrožení', format: 'czk', align: 'right' },
          ],
          rows: rows.map((x) => contractRow(ds, x.contract, { status: RENEWAL_STATUS_LABEL[x.status], atRisk: x.atRisk })),
        })
      }
      case 'renewal_rate': {
        const rr = renewalRate(ds)
        return result({
          ...metricHeader('renewal_rate'),
          subtitle: 'smlouvy s koncem v posledních 12 měsících',
          total: { label: 'Míra obnovy', value: rr.rate, format: 'percent' },
          countLabel: `smluv (${rr.renewed} obnoveno)`,
          columns: [
            { key: 'institution', label: 'Instituce', format: 'text' },
            { key: 'end', label: 'Konec', format: 'date' },
            { key: 'status', label: 'Obnova', format: 'badge' },
            C.value,
          ],
          rows: rr.contracts.map((c) => ({
            ...contractRow(ds, c, { status: RENEWAL_STATUS_LABEL[renewalStatus(ds, c).status] }),
            tone: renewalStatus(ds, c).status === 'obnoveno' ? 'positive' : 'negative',
          })),
        })
      }
      case 'tenders': {
        const status = str(f.status)
        const list = ds.tenders
          .filter((t) => (!status ? t.status === 'příprava' || t.status === 'podáno' : t.status === status))
          .filter((t) => !status || status === 'příprava' || status === 'podáno' || inRange(lk.deal.get(t.dealId ?? '')?.closedAt, { start: addDays(ds.today, -365), end: ds.today }))
          .sort((a, b) => (a.submissionDeadline < b.submissionDeadline ? -1 : 1))
        return result({
          title: status ? `Veřejné zakázky · ${status}` : 'Aktivní veřejné zakázky',
          total: { label: 'Hodnota', value: sum(list, (t) => t.value), format: 'czk' },
          countLabel: 'zakázek',
          sumKey: 'value',
          columns: [
            { key: 'id', label: 'Zakázka', format: 'text' },
            { key: 'institution', label: 'Zadavatel', format: 'text' },
            { key: 'deadline', label: 'Podání', format: 'date' },
            { key: 'status', label: 'Stav', format: 'badge' },
            C.value,
          ],
          rows: list.map((t) => tenderRow(ds, t)),
        })
      }
      case 'unmatched_payments': {
        const list = unmatchedPayments(ds)
        return result({
          ...metricHeader('unmatched_payments'),
          total: { label: 'Částka', value: sum(list, (p) => p.amount), format: 'czk' },
          countLabel: 'plateb',
          sumKey: 'amount',
          columns: PAYMENT_COLUMNS,
          rows: list.map((p) => paymentRow(ds, full, p)),
        })
      }
      case 'stage_cohort': {
        const stage = str(f.stage)!
        const window = conversionWindow(ctx.period)
        const spans = closedSpans(ds, window, df).filter((s) => s.stage === stage)
        const advanced = spans.filter((s) => s.outcome !== 'lost')
        return result({
          title: `${stage} → další fáze`,
          subtitle: [str(f.sourceId) ? lk.source.get(str(f.sourceId)!)?.name : null, window.label].filter(Boolean).join(' · '),
          total: { label: 'Konverze', value: spans.length ? advanced.length / spans.length : null, format: 'percent' },
          countLabel: `dealů opustilo fázi (${advanced.length} postoupilo)`,
          columns: [
            C.deal,
            C.owner,
            { key: 'outcome', label: 'Výsledek', format: 'badge' },
            { key: 'days', label: 'Dní ve fázi', format: 'days', align: 'right', secondary: true },
            C.value,
          ],
          rows: spans
            .sort((a, b) => b.deal.value - a.deal.value)
            .map((s) => ({
              ...dealRow(ds, s.deal, {
                outcome: s.outcome === 'lost' ? `Prohráno${s.deal.lostReason ? ` · ${s.deal.lostReason}` : ''}` : 'Postoupil',
                days: diffDays(s.enteredAt, s.leftAt!),
              }),
              tone: s.outcome === 'lost' ? 'negative' : undefined,
            })),
        })
      }
      case 'cycle': {
        const deals = wonDeals(ds, conversionWindow(ctx.period), df).sort((a, b) => cycleDays(b) - cycleDays(a))
        return result({
          ...metricHeader('cycle_days'),
          subtitle: [str(f.sourceId) ? lk.source.get(str(f.sourceId)!)?.name : str(f.institutionType), conversionWindow(ctx.period).label].filter(Boolean).join(' · '),
          total: { label: 'Medián', value: median(deals.map(cycleDays)), format: 'days' },
          countLabel: 'vyhraných dealů',
          columns: [C.deal, C.owner, { key: 'created', label: 'Založeno', format: 'date', secondary: true }, { key: 'cycle', label: 'Cyklus', format: 'days', align: 'right' }, C.value],
          rows: deals.map((d) => dealRow(ds, d, { created: d.createdAt, cycle: cycleDays(d) })),
        })
      }
      case 'record':
        return recordDetail(ctx, str(f.type) ?? 'deal', str(f.id) ?? '')
      default:
        return result({
          title: 'Neznámý přehled',
          total: { label: '', value: null, format: 'int' },
          countLabel: '',
          columns: [],
          rows: [],
        })
    }
  })()

  return req.title ? { ...out, title: req.title } : out
}

// ── Single record ──────────────────────────────────────────────────────────

function recordDetail(ctx: MetricContext, type: string, id: string): DrillResult {
  const { ds, full } = ctx
  const lk = lookup(full)
  const empty = (title: string): DrillResult => ({
    title,
    total: { label: '', value: null, format: 'int' },
    count: 0,
    countLabel: '',
    columns: [],
    rows: [],
    truncated: false,
  })

  if (type === 'invoice') {
    const inv = lk.invoice.get(id)
    if (!inv) return empty('Faktura nenalezena')
    return recordDetail(ctx, 'deal', inv.dealId)
  }
  if (type === 'contract') {
    const c = lk.contract.get(id)
    if (!c) return empty('Smlouva nenalezena')
    return recordDetail(ctx, 'deal', c.dealId)
  }
  if (type === 'tender') {
    const t = full.tenders.find((x) => x.id === id)
    if (!t) return empty('Zakázka nenalezena')
    if (t.dealId) {
      const res = recordDetail(ctx, 'deal', t.dealId)
      res.detail!.fields.unshift(
        { label: 'Veřejná zakázka', value: `${t.id} · ${t.title}` },
        { label: 'Termín podání', value: formatDate(t.submissionDeadline), tone: t.status === 'příprava' ? 'warning' : undefined },
        { label: 'Stav zakázky', value: t.status },
      )
      return res
    }
  }
  if (type === 'payment') {
    const p = full.payments.find((x) => x.id === id)
    if (!p) return empty('Platba nenalezena')
    const cands = paymentCandidates(full, p)
    return {
      title: `Platba ${formatCZK(p.amount)}`,
      subtitle: `přijata ${formatDate(p.receivedAt)}`,
      total: { label: 'Částka', value: p.amount, format: 'czk' },
      count: cands.length,
      countLabel: 'kandidátů podle částky',
      columns: INVOICE_COLUMNS,
      rows: cands.map((i) => invoiceRow(full, i)),
      truncated: false,
      detail: {
        fields: [
          { label: 'Plátce', value: p.counterparty },
          { label: 'Variabilní symbol', value: p.variableSymbol, tone: p.matchedInvoiceId ? undefined : 'negative' },
          { label: 'Stav', value: p.matchedInvoiceId ? (p.matchMethod === 'manual' ? 'Spárováno ručně' : 'Spárováno automaticky') : 'Nespárováno' },
          {
            label: 'Nejpravděpodobnější faktura',
            value: cands[0] ? `${cands[0].number} · ${institutionName(full, cands[0].institutionId)}` : 'žádná se stejnou částkou',
          },
        ],
      },
      note: cands[0] ? 'VS se liší o přehozené číslice; částka sedí přesně. Doporučení: spárovat ručně a zrušit upomínku.' : undefined,
    }
  }

  const deal = lk.deal.get(id)
  if (!deal) return empty('Záznam nenalezen')
  if (!ds.salespeople.some((s) => s.id === deal.ownerId)) return empty('Záznam je mimo váš přístup')
  const inst = lk.institution.get(deal.institutionId)!
  const contracts = lk.contractsByDeal.get(deal.id) ?? []
  const invoices = lk.invoicesByDeal.get(deal.id) ?? []
  const tender = lk.tenderByDeal.get(deal.id)
  const acts = (lk.activitiesByDeal.get(deal.id) ?? []).slice().sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1))
  const timeline: NonNullable<DrillResult['detail']>['timeline'] = []
  for (const h of deal.stageHistory)
    timeline.push({
      date: h.enteredAt,
      label: h.stage === 'Prohráno' ? `Prohráno${deal.lostReason ? ` · ${deal.lostReason}` : ''}` : h.stage,
      tone: h.stage === 'Vyhráno' ? 'positive' : h.stage === 'Prohráno' ? 'negative' : 'neutral',
    })
  for (const c of contracts) {
    timeline.push({ date: c.sentForSignatureAt, label: `Smlouva ${c.id} odeslána k podpisu`, tone: 'neutral' })
    if (c.signedAt) timeline.push({ date: c.signedAt, label: `Smlouva ${c.id} podepsána`, tone: 'positive' })
  }
  for (const i of invoices) {
    timeline.push({ date: i.issuedAt, label: `Faktura ${i.number} vystavena (${formatCZK(i.amount)})`, tone: 'neutral' })
    if (i.paidAt) timeline.push({ date: i.paidAt, label: `Faktura ${i.number} uhrazena`, tone: 'positive' })
  }
  timeline.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const open = deal.closedAt === null
  const fields: NonNullable<DrillResult['detail']>['fields'] = [
    { label: 'Instituce', value: `${inst.name} (${inst.type}, ${lk.kraj.get(inst.kraj)?.name})` },
    { label: 'Produkt', value: lk.product.get(deal.productId)!.name },
    { label: 'Obchodník', value: repName(full, deal.ownerId) },
    { label: 'Zdroj', value: lk.source.get(deal.sourceId)!.name + (deal.isRenewal ? ' · obnova smlouvy' : '') },
    { label: 'Fáze', value: deal.stage + (open ? ` · ${daysInStage(deal, ds.today)} dní ve fázi` : '') },
    { label: 'Založeno', value: formatDate(deal.createdAt) },
  ]
  if (open) {
    fields.push(
      { label: 'Očekávané uzavření', value: formatDate(deal.expectedCloseAt), tone: deal.expectedCloseAt < ds.today ? 'warning' : undefined },
      {
        label: 'Další krok',
        value: deal.nextStepAt ? `${deal.nextStep ?? ''} · ${formatDate(deal.nextStepAt)}` : 'nenaplánován',
        tone: !deal.nextStepAt || deal.nextStepAt < ds.today ? 'negative' : undefined,
      },
      { label: 'Pravděpodobnost', value: formatPercent(stageProbability(deal.stage), 0) },
    )
  } else {
    fields.push({ label: 'Uzavřeno', value: `${formatDate(deal.closedAt)} · cyklus ${formatDays(cycleDays(deal))}` })
  }
  if (tender) fields.push({ label: 'Veřejná zakázka', value: `${tender.id} · podání ${formatDate(tender.submissionDeadline)} · ${tender.status}` })
  const unpaid = invoices.filter((i) => !i.paidAt)
  if (unpaid.length)
    fields.push({
      label: 'Neuhrazeno',
      value: formatCZK(sum(unpaid, (i) => i.amount)),
      tone: unpaid.some((i) => i.dueAt < ds.today) ? 'negative' : undefined,
    })

  return {
    title: dealName(full, deal),
    subtitle: `${deal.id} · ${formatCZK(deal.value)}`,
    total: { label: 'Hodnota dealu', value: deal.value, format: 'czk' },
    count: acts.length,
    countLabel: 'aktivit',
    columns: ACTIVITY_COLUMNS.filter((c) => c.key !== 'subject' && c.key !== 'owner'),
    rows: activityRows(full, acts).slice(0, 60),
    truncated: acts.length > 60,
    detail: { fields, timeline },
  }
}
