# GBH Defence — Sales Dashboard (portfolio demo)

Demo dashboard for the sales department of GBH Defence (security trainings for state institutions, CZ).
All data is simulated. The full spec is in `SPEC.md`: read it before any change to data, metrics or layout.

## Rules

- **No number is hardcoded in components.** Every number comes from `lib/metrics/*`, which computes it from the generated dataset (`lib/data/*`). If a widget needs a number that doesn't exist yet, add a function to metrics instead of a constant in JSX.
- **Totals must reconcile.** Sum across salespeople = team total = company total. Commissions on the team page = commissions on the overview page. Covered by tests in `lib/metrics/__tests__`. After every change to data or metrics, run `npm test`.
- **Colors only through tokens** from `app/globals.css` (`bg-primary`, `text-muted-foreground`, `var(--chart-1)` …). No hex values or Tailwind palette colors (`green-500` etc.) in components.
- **Delta color follows meaning, not direction.** Each metric has `goodDirection: 'up' | 'down'` in the metric dictionary. Overdue invoices going up = red.
- **Delta icon:** `ArrowUpRight` / `ArrowDownRight` from lucide, small. No filled triangles.
- **Formatting `cs-CZ`:** `1 087 400 Kč`, `14,5 %`, `19. 10. 2026`. Helpers live in `lib/format.ts`; don't call `toLocaleString` directly in components.
- **UI language is Czech.** Institution names are fictional, never real offices, ministries or hospitals.
- **Demo label** must stay visible (see SPEC → "Demo label").
- Commits: short messages in English, **no Co-Authored-By lines or other attribution**.
- Work in phases from SPEC.md. At the end of each phase: `npm run build` + `npm test` must pass, then commit.
