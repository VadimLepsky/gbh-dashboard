# SPEC — GBH Defence Sales Dashboard

## 1. Goal

A portfolio demo for a RevOps / sales-ops audience (Upwork, CV). It should not look like "yet another template". It should show a system that answers a sales director's questions:

1. Will we hit the plan this month and this quarter?
2. Who on the team is working and who is slipping, and on what exactly?
3. Where is the money leaking out of the funnel?
4. How much have we actually earned: sold → invoiced → paid?
5. What needs attention today, who owns it, and by when?

**Business context:** GBH Defence sells security trainings to state institutions in CZ. The real stack at the client was Pipedrive (CRM) + iDoklad (invoicing) + bank API. The real chain: deal → contract → e-signature → invoice → payment → deal status. The dashboard shows this whole chain.

**Visual direction:** light, airy, in the style of the Square reference. Left sidebar navigation, large numbers, minimal charts with a pale comparison line. Colors come from `globals.css` (primary `#991e43`, accent `#f78764`, chart-3 `#136f63`). Dark theme via the existing toggle.

---

## 2. Data: generator instead of a database

No DB. `lib/data/generate.ts` creates the full dataset deterministically:

- seeded PRNG (e.g. `mulberry32`, fixed seed);
- history: **18 months back from today** (`new Date()`, rounded to the day). The demo is always fresh, and data is identical within a day;
- result is memoized per server process/request; computation must stay under ~200 ms.

### 2.1 Entities (`lib/data/types.ts`)

| Entity | Fields (minimum) |
|---|---|
| `Team` | id, name: `Čechy` / `Morava` |
| `Salesperson` | id, name, initials, role (`Senior` / `Obchodník` / `Junior`), teamId, monthlyQuota (Kč), monthlyActivityTarget, commissionProfileId, startDate |
| `Institution` | id, name (fictional), type, kraj, size (`S/M/L`) |
| `Product` | id, name, unitCostShare (cost share → margin), recurring: boolean |
| `LeadSource` | `Cold call`, `Webinář`, `Doporučení`, `Veřejná zakázka`, `Web / inbound`, `Veletrh` |
| `Deal` | id, institutionId, ownerId, productId, sourceId, value, stage, stageHistory[{stage, enteredAt}], createdAt, expectedCloseAt, nextStepAt \| null, lostReason \| null, closedAt \| null |
| `Activity` | id, dealId \| null, ownerId, type (`hovor`, `e-mail`, `schůzka`, `follow-up`), dueAt, doneAt \| null |
| `Contract` | id, dealId, sentForSignatureAt, signedAt \| null, startAt, endAt, annualValue, renewalDealId \| null |
| `Invoice` | id, contractId, number, issuedAt, dueAt, amount, paidAt \| null |
| `BankPayment` | id, amount, receivedAt, variableSymbol, matchedInvoiceId \| null |
| `Tender` (veřejná zakázka) | id, institutionId, ownerId, value, submissionDeadline, status (`příprava`, `podáno`, `vyhráno`, `prohráno`), dealId \| null |
| `CommissionProfile` | id, baseRate, coefficient bands (see 2.4) |

**Institution types:** Ministerstvo, Krajský úřad, Městský úřad, Nemocnice, Škola, Složka IZS, Státní podnik.
**Names:** generated as type + fictional place name ("Městský úřad Dolní Bělá", "Nemocnice Horní Lhota"). No real names.

**Products:** Kybernetická bezpečnost pro zaměstnance · Krizové řízení a evakuace · Ochrana objektů a osob · Útok aktivního útočníka · Bezpečnostní management pro vedoucí · Roční rámcová smlouva (recurring, is renewed).

**Team:** 8 people in 2 teams. Reuse names from the old demo: Jakub Novák (Senior), Anna Svobodová, Petr Horák, Lucie Marešová (Junior), Tomáš Dvořák (Junior), plus 3 new ones.

### 2.2 Stages and probabilities

`Kontakt 10 %` → `Kvalifikace 25 %` → `Nabídka 50 %` → `Vyjednávání 75 %` → `Smlouva k podpisu 90 %` → `Vyhráno` / `Prohráno`

After `Vyhráno` comes the delivery chain: `Smlouva podepsána` → `Fakturováno` → `Uhrazeno`.

### 2.3 Simulation rules (realism)

- ~1 100 cold calls per month across the team → ~6 % meetings → realistic stage conversions (you can calibrate on the old demo: 1 147 → 68 → 31 → 12).
- Deal size depends on institution type: school 40–90k, municipal office 60–150k, regional office / hospital 120–400k, ministry 300k–1.2M Kč.
- **State budget seasonality:** January–February dip, purchasing peak in October–December.
- **Payments:** state institutions pay on average 5–20 days late; ~10 % of invoices go 30+ days overdue.
- Sales cycle: 20–60 days, tenders 60–120.
- 1–3 bank payments per month have no matched invoice (wrong variable symbol).
- Performance spread: one rep at 120–130 % of plan, one steadily declining over the last 3 months (the "drop visible per person" story).

**Story hooks** (always generated relative to today, so the exceptions list is never empty):

1. Big deal (900k+) stuck in `Vyjednávání` 40+ days without a next step.
2. Invoice ~120k, 21 days overdue.
3. Annual contract worth 400k+ expires in 45 days, no renewal deal open.
4. Contract sent for signature 9 days ago, still unsigned.
5. Tender with deadline in 5 days, status `příprava`.
6. One junior rep with 6+ overdue follow-ups.
7. Two unmatched bank payments.

### 2.4 Commissions

- Base rate: Junior 4 %, Obchodník 5 %, Senior 6 % of **paid** revenue.
- KPI coefficient based on plan attainment for the month: `< 80 % → 0,8` · `80–100 % → 1,0` · `100–120 % → 1,15` · `> 120 % → 1,3`.
- A commission becomes **payable** only once the invoice is paid. The rest is **pending** (accrued but not yet payable).

---

## 3. Metric dictionary (`lib/metrics/dictionary.ts`)

Single source of definitions. Every metric has: `id`, `label`, `definition` (one sentence in Czech), `formula`, `unit`, `goodDirection`. The UI shows the definition in a tooltip on every KPI and on the `Slovník metrik` page.

| id | Label | Formula |
|---|---|---|
| `revenue_won` | Prodáno | Σ value of deals with closedAt in the period and stage Vyhráno |
| `invoiced` | Fakturováno | Σ invoices issued in the period |
| `collected` | Uhrazeno | Σ invoices paid in the period |
| `receivables` | Pohledávky | Σ unpaid invoices as of period end |
| `overdue` | Po splatnosti | Σ unpaid invoices past dueAt |
| `dso` | DSO | average days issuedAt → paidAt for invoices paid in the period |
| `pipeline` | Pipeline | Σ value of open deals |
| `weighted_forecast` | Vážená prognóza | Σ value × stage probability for open deals with expectedCloseAt in the period + already won in the period |
| `plan` | Plán | Σ monthlyQuota (for the scope) |
| `attainment` | Plnění plánu | revenue_won / plan |
| `coverage` | Krytí pipeline | pipeline (closing in period) / (plan − revenue_won) |
| `win_rate` | Win rate | won / (won + lost), closed in the period |
| `cycle_days` | Délka cyklu | median days createdAt → closedAt for won deals |
| `avg_deal` | Průměrný deal | revenue_won / count of won |
| `gross_margin` | Hrubá marže | (revenue − cost by product) / revenue |
| `activities_done` | Splněné aktivity | count doneAt in the period / target |
| `overdue_followups` | Zpožděné follow-upy | activities with dueAt < today and doneAt = null |
| `no_next_step` | Bez dalšího kroku | open deals with nextStepAt = null or in the past |
| `stuck_deals` | Zaseknuté dealy | open deals whose days in the current stage > 2 × median for that stage |
| `commission_payable` / `commission_pending` | Provize k výplatě / čekající | see 2.4 |

---

## 4. Layout and shared elements

- **Left sidebar** (like Square): GBH Defence logo + "Obchodní oddělení", navigation (section 5), at the bottom a role switcher and the demo label.
- **Page header:** title · "Aktualizováno 19. 10. 21:04 · Pipedrive · iDoklad · banka" · period selector (`Tento měsíc`, `Minulý měsíc`, `Kvartál`, `Rok`, `Vlastní`) · comparison selector (`vs. předchozí období`, `vs. plán`, `vs. loni`).
- **Period and comparison live in URL params** (`?period=2026-10&cmp=prev`) and persist across pages.
- **Role switcher "Zobrazit jako":** `Ředitel obchodu` (everything) · `Vedoucí týmu Morava` (Morava team only) · `Jakub Novák (obchodník)` (own data only). Filters the dataset before metrics are computed. Demonstrates access rights.
- **Drill-down:** every KPI and every chart column is clickable and opens a `Sheet` with the list of deals / invoices / activities behind the number. The sum in the list = the number on the card.
- **KPI card:** label + tooltip definition, large number, delta vs. comparison (`ArrowUpRight`/`ArrowDownRight`, color by goodDirection), 6-month sparkline or plan progress bar. No empty space between icon and number.
- **Charts:** current period solid, comparison period as a pale `muted-foreground` line (like Square). Plan as a dashed line.

### Demo label

- In the sidebar under the logo: badge `Demo · simulovaná data`.
- In the footer: "Ukázková verze dashboardu postaveného pro obchodní oddělení GBH Defence. Všechna data jsou generovaná, instituce jsou smyšlené. Autor: Vadim Lepsky · Interflow (interflow.cz)."
- The badge should be visible but not dominant (muted).

---

## 5. Pages

### 5.1 Přehled (`/`)
- KPI row (5): Prodáno vs. plán · Vážená prognóza na konec měsíce · Uhrazeno · Po splatnosti · Provize k výplatě.
- Chart "Prodáno vs. plán" by month (12 months): bars sold, dashed plan, pale line last year.
- "Prognóza měsíce" card: won + weighted pipeline vs. plan, gap in Kč, coverage.
- Block "Vyžaduje pozornost" — top 5 from the exceptions list (5.7), with a link to the full list.
- Mini chain "Prodáno → Fakturováno → Uhrazeno" for the period, with values.

### 5.2 Pipeline a prognóza (`/pipeline`)
- Funnel by stage: count, value, conversion to the next stage, average days in stage.
- Weighted forecast vs. plan: by team, by rep, by kraj (simple grid/map of 14 regions, color = value).
- "Uzavírání v příštích 14 dnech": deal, owner, value, probability, next step.
- "Zaseknuté dealy": table sorted by value.

### 5.3 Disciplína týmu (`/tym`)
- Main table, one row per rep: plan attainment (progress bar), activities done / target, overdue follow-ups, deals without next step, stuck deals, last activity, 3-month trend (sparkline). Cells with problems are tinted lightly (heat).
- Click on a row → rep detail: their funnel, their exceptions, monthly trend. The declining rep's drop should be visible here.
- Team comparison Čechy vs. Morava.

### 5.4 Konverze a úniky (`/konverze`)
- Stage-to-stage conversion by lead source (heatmap table).
- Win/loss by reason (`Cena`, `Rozpočet zmrazen`, `Vybrán konkurent`, `Bez odezvy`, `Zrušená zakázka`).
- Cycle length by source and by institution type.
- **"Top 5 úniků v Kč"**: where we lose the most money compared to the average (stage × source, or stage × rep). Each item: amount, owner, recommended action (rule-based template, no LLM).

### 5.5 Peníze (`/penize`)
- Chain `Vyhráno → Smlouva podepsána → Fakturováno → Uhrazeno`: count and value at each step + where it's stuck ("3 smlouvy čekají na podpis déle než 7 dní").
- Receivables aging: `0–30`, `31–60`, `60+` days, by institution.
- Revenue and gross margin by product.
- "Nespárované platby": bank payments without an invoice, with the most likely candidate invoice (by amount).
- DSO trend by month.

### 5.6 Provize (`/provize`)
- Per rep: paid revenue, base rate, plan attainment → coefficient, payable, pending.
- Click → breakdown: which invoices it came from, which are still waiting for payment.
- Note on the rule: "Provize vzniká úhradou faktury."

### 5.7 Vyžaduje pozornost (`/vyjimky`)
Daily exceptions list, **not charts**. Table: type · object (link to drill-down) · Kč at risk · owner · next action · deadline. Filter by owner and type. Sort by Kč × urgency.
Rules: overdue invoice > 14 days · deal without next step · stuck deal · overdue follow-up · contract unsigned > 7 days · renewal within 60 days without open deal · tender deadline < 7 days in `příprava` · rep below 60 % of activity target · unmatched payment.

### 5.8 Smlouvy a zakázky (`/smlouvy`)
- Renewals within 90 days: timeline, value, renewal status, Kč at risk. Renewal rate over the last 12 months.
- Veřejné zakázky: list with submission deadlines, status, owner; tender win rate.

### 5.9 Týdenní report (`/report`)
- Preview of the weekly email to management (render as an email layout inside a frame): key numbers for the week, plan attainment, top 5 exceptions, best and worst rep.
- Above it: "Plánováno: každé pondělí 8:00 → reditel@gbh-demo.cz" and a disabled button "Odeslat testovací e-mail (v demu vypnuto)".

### 5.10 Slovník metrik (`/slovnik`)
Table from `dictionary.ts`: name, definition, formula, unit. Plus a "Kontrola dat" block: totals per source (deals, invoices, payments) next to dashboard totals, with ✓ status, and separately the number of unmatched payments.

---

## 6. Phases for Claude Code

**Phase 0 — cleanup.** Audit the repo, list components. Replace `app/globals.css` with the new one. Remove hardcoded colors (hex, `green-*`, `emerald-*` …) → tokens. Remove generic content (Škoda, Alza, "Enterprise licence", "Stav účtu", "Struktura nákladů"). Set light theme as default.

**Phase 1 — data and metrics.** `lib/data/types.ts`, `generate.ts` (PRNG, simulation, story hooks), `lib/metrics/*`, `dictionary.ts`, `lib/format.ts`. Reconciliation tests (Vitest): sum across reps = total; payable + pending = accrued commissions; invoiced ≥ collected; drill-down sum = KPI; every story hook is present. No UI in this phase.

**Phase 2 — layout.** Sidebar, header, URL filters, role switcher, demo label, KPI card component, drill-down Sheet.

**Phase 3 — pages** in order: Přehled → Vyžaduje pozornost → Disciplína týmu → Pipeline → Peníze → Provize → Konverze → Smlouvy → Report → Slovník.

**Phase 4 — polish.** Empty states, responsiveness (works at 1280 and on a laptop; mobile at minimum readable), dark theme check, skeletons, consistent number formatting, empty space check on every page.

**Deploy:** to the same Vercel project as the current demo, so the link in the CV (`sales-dashboard-three-ashen.vercel.app`) doesn't change.

## 7. Done when

- Not a single number in JSX is a constant.
- `npm test` is green, totals reconcile everywhere.
- On every page you can click from a number down to concrete records.
- The exceptions list is meaningful on any day.
- No card has a large empty area.
- The demo label is visible on every page.
