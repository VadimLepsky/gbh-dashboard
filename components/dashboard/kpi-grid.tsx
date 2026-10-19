import type { Kpi } from '@/lib/metrics/kpi'
import { cn } from '@/lib/utils'
import { KpiCard } from './kpi-card'

/** KPI row without holes: 5 cards → 2 wide + 3 narrow on laptops, one row on wide screens. */
export function KpiGrid({ kpis, titles = {}, className }: { kpis: Kpi[]; titles?: Record<number, string>; className?: string }) {
  const n = kpis.length
  const span = (i: number) => {
    if (n === 5) return i < 2 ? 'lg:col-span-3 2xl:col-span-1' : i === 4 ? 'sm:col-span-2 lg:col-span-2 2xl:col-span-1' : 'lg:col-span-2 2xl:col-span-1'
    if (n === 3) return i === 2 ? 'sm:col-span-2 lg:col-span-1' : undefined
    return undefined
  }
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2',
        n === 5 && 'lg:grid-cols-6 2xl:grid-cols-5',
        n === 4 && 'xl:grid-cols-4',
        n === 3 && 'lg:grid-cols-3',
        className,
      )}
    >
      {kpis.map((k, i) => (
        <KpiCard key={`${k.id}-${i}`} kpi={k} title={titles[i]} className={span(i)} />
      ))}
    </div>
  )
}
