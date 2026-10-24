'use client'

import { DrillButton } from '@/components/drill/drill-trigger'
import { useI18n } from '@/components/i18n-provider'

interface KrajTile {
  id: string
  name: string
  short: string
  col: number
  row: number
  total: number
  won: number
  weighted: number
  openCount: number
}

/** Simplified tile map of the 14 regions; colour intensity = forecast value (single-hue sequential). */
export function KrajMap({ tiles }: { tiles: KrajTile[] }) {
  const { t: tr, tn, f } = useI18n()
  const max = Math.max(...tiles.map((t) => t.total), 1)
  const cols = Math.max(...tiles.map((t) => t.col)) + 1
  const rows = Math.max(...tiles.map((t) => t.row)) + 1
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {tiles.map((t) => {
          const share = t.total / max
          const strong = share > 0.55
          return (
            <DrillButton
              key={t.id}
              req={{ metric: 'weighted_forecast', filters: { kraj: t.id }, title: tr('ui.forecast.title', { label: t.name }) }}
              className="flex aspect-[4/3] min-w-0 flex-col justify-between rounded-lg p-2 ring-1 ring-foreground/[0.06] transition-transform hover:-translate-y-px hover:ring-foreground/20"
              style={{
                gridColumn: t.col + 1,
                gridRow: t.row + 1,
                background: `color-mix(in oklab, var(--chart-1) ${Math.round(8 + share * 80)}%, var(--card))`,
                color: strong ? 'var(--primary-foreground)' : 'var(--foreground)',
              }}
              title={tr('ui.map.tooltip', { name: t.name, total: f.formatCZKCompact(t.total), open: tn('drill.count.openDeals', t.openCount) })}
            >
              <span className="text-[11px] font-semibold">{t.short}</span>
              <span className="tabular truncate text-[11px] leading-tight opacity-90">{f.formatCZKCompact(t.total)}</span>
            </DrillButton>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{tr('ui.map.less')}</span>
        <span
          className="h-2 w-24 rounded-full"
          style={{ background: 'linear-gradient(90deg, color-mix(in oklab, var(--chart-1) 8%, var(--card)), var(--chart-1))' }}
        />
        <span>{tr('ui.map.more')}</span>
        <span className="ml-auto">{tn('drill.count.openDeals', tiles.reduce((s, t) => s + t.openCount, 0))}</span>
      </div>
    </div>
  )
}
