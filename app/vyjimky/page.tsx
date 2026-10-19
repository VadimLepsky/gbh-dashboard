import type { Metadata } from 'next'
import { buildContext } from '@/lib/metrics/context'
import { exceptions, RULE_TEXT } from '@/lib/metrics/exceptions'
import { formatCZK, formatNumber } from '@/lib/format'
import { PageHeader } from '@/components/shell/page-header'
import { Section, Stat } from '@/components/dashboard/primitives'
import { ExceptionsTable } from '@/components/dashboard/exceptions-table'

export const metadata: Metadata = { title: 'Vyžaduje pozornost' }

export default async function ExceptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = buildContext(await searchParams)
  const items = exceptions(ctx.ds, ctx.full)
  const owners = Object.fromEntries(ctx.ds.salespeople.map((s) => [s.id, s.name]))
  const urgent = items.filter((i) => i.deadline <= ctx.ds.today)
  const total = items.reduce((s, i) => s + i.amount, 0)
  const byOwner = new Map<string, number>()
  for (const i of items) if (i.ownerId) byOwner.set(i.ownerId, (byOwner.get(i.ownerId) ?? 0) + i.amount)
  const top = [...byOwner.entries()].sort((a, b) => b[1] - a[1])[0]

  return (
    <>
      <PageHeader
        ctx={ctx}
        title="Vyžaduje pozornost"
        description="Denní seznam výjimek, ne grafy"
        hidePeriod
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat label="Otevřené výjimky" value={formatNumber(items.length)} sub="stav k dnešku" />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat label="Kč v ohrožení" value={formatCZK(total)} sub="součet za všechny položky" />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat label="Řešit dnes" value={formatNumber(urgent.length)} sub={formatCZK(urgent.reduce((s, i) => s + i.amount, 0))} />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
          <Stat
            label="Nejvíc v ohrožení"
            value={top ? owners[top[0]] : '—'}
            sub={top ? formatCZK(top[1]) : undefined}
          />
        </div>
      </div>
      <Section
        title="Seznam k řešení"
        description="Seřazeno podle Kč v ohrožení × naléhavosti termínu. Kliknutím na objekt otevřete detail."
      >
        <ExceptionsTable items={items} owners={owners} today={ctx.ds.today} />
      </Section>
      <Section className="mt-3" title="Pravidla" description="Kdy se položka objeví v seznamu">
        <ul className="grid list-disc gap-x-8 gap-y-1.5 pl-4 text-[13px] text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
          {Object.values(RULE_TEXT).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Section>
    </>
  )
}
