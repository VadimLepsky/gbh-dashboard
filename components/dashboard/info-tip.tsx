'use client'

import { CircleHelp } from 'lucide-react'
import { METRICS, type MetricId } from '@/lib/metrics/dictionary'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Metric label with its dictionary definition in a tooltip. */
export function MetricLabel({ id, label, className }: { id: MetricId; label?: string; className?: string }) {
  const def = METRICS[id]
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {label ?? def.label}
      <InfoTip text={def.definition} formula={def.formula} />
    </span>
  )
}

export function InfoTip({ text, formula }: { text: string; formula?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={0}
            aria-label="Definice"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex cursor-help text-muted-foreground/60 hover:text-muted-foreground"
          />
        }
      >
        <CircleHelp className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72 flex-col items-start gap-1 py-2 text-left leading-relaxed">
        <span>{text}</span>
        {formula && <span className="font-mono text-[10.5px] opacity-70">{formula}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
