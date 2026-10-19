# GBH Defence — Sales Dashboard (demo)

A RevOps dashboard for the sales department of GBH Defence, a company selling security trainings to Czech state
institutions. It answers the questions a sales director asks every week:

1. Will we hit the plan this month and this quarter?
2. Who on the team is working and who is slipping, and on what exactly?
3. Where is the money leaking out of the funnel?
4. How much have we actually earned: sold → invoiced → paid?
5. What needs attention today, who owns it, and by when?

**All data is simulated.** Institutions are fictional. The UI is in Czech.

## What's inside

| Page | Route |
|---|---|
| Přehled — KPIs, sold vs. plan, month forecast, top exceptions, sold → invoiced → paid | `/` |
| Vyžaduje pozornost — daily exception list, sorted by Kč × urgency | `/vyjimky` |
| Disciplína týmu — per-rep table with heat cells, rep detail, Čechy vs. Morava | `/tym`, `/tym/[id]` |
| Pipeline a prognóza — funnel, weighted forecast by rep/team/region, closing soon, stuck deals | `/pipeline` |
| Peníze — delivery chain, receivables aging, margin by product, unmatched bank payments, DSO | `/penize` |
| Provize — commission per rep (rate × KPI coefficient), payable vs. pending | `/provize` |
| Konverze a úniky — stage conversion by lead source, loss reasons, cycle length, top 5 leaks | `/konverze` |
| Smlouvy a zakázky — renewals in the next 90 days, renewal rate, public tenders | `/smlouvy` |
| Týdenní report — preview of the Monday e-mail to management | `/report` |
| Slovník metrik — metric dictionary and a source-vs-dashboard reconciliation | `/slovnik` |

Every number is clickable and opens the records behind it (deals, invoices, activities, payments). The sum in the
drill-down always equals the number on the card. Period, comparison and role live in the URL
(`?period=2026-Q4&cmp=yoy&as=morava`) and persist across pages; the role switcher filters the dataset *before* metrics
are computed.

## How it works

- `lib/data/generate.ts` — deterministic generator (seeded PRNG): ~2 years of deals simulated through the funnel,
  contracts, e-signatures, invoices, late payments, bank payments with wrong variable symbols, tenders, renewals,
  cold calls and follow-ups. History is relative to today, so the demo is always fresh; story hooks (a stuck
  900k+ deal, an invoice 21 days overdue, a renewal at risk, …) are always present. Generation takes ~100 ms and is
  memoized per day.
- `lib/metrics/*` — the only place numbers are computed. `dictionary.ts` holds one definition per metric, shown in
  tooltips and on `/slovnik`.
- `lib/metrics/__tests__` — reconciliation tests: reps sum to the team and company, commissions payable + pending =
  accrued, invoiced ≥ collected, drill-down sum = KPI, all story hooks present on several dates.

## Stack

Next.js 16 (App Router, server components, server actions) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui on
Base UI · Recharts · Vitest. Deployed on Vercel.

## Scripts

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # reconciliation tests
npm run build
```

---

Author: Vadim Lepsky · [Interflow](https://interflow.cz)
