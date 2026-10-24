import type { MetricContext } from '@/lib/metrics/context'
import { compareOptions, periodPresets } from '@/lib/metrics/period'
import { PeriodControls } from './period-controls'

interface Props {
  ctx: MetricContext
  title: string
  description?: string
  hideCompare?: boolean
  hidePeriod?: boolean
  children?: React.ReactNode
}

export function PageHeader({ ctx, title, description, hideCompare, hidePeriod, children }: Props) {
  const { t, f } = ctx.i18n
  return (
    <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          {ctx.as !== 'reditel' && (
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {t(`viewAs.${ctx.as}.label`)}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {description ? <>{description} · </> : null}
          {t('shell.updated', { date: f.formatDateShort(ctx.ds.today), time: f.formatTime(new Date()) })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {!hidePeriod && (
          <PeriodControls
            periodKey={ctx.period.key}
            periodLabel={ctx.period.label}
            presets={periodPresets(ctx.ds.today, ctx.i18n)}
            cmp={ctx.cmpMode}
            compareOptions={compareOptions(ctx.i18n)}
            from={ctx.period.kind === 'custom' ? ctx.period.start : `${ctx.ds.today.slice(0, 7)}-01`}
            to={ctx.period.kind === 'custom' ? ctx.period.end : ctx.ds.today}
            minDate={ctx.ds.historyStart}
            today={ctx.ds.today}
            hideCompare={hideCompare}
          />
        )}
      </div>
    </header>
  )
}
