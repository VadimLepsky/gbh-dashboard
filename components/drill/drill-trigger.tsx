'use client'

import type { ComponentProps } from 'react'
import type { DrillRequest } from '@/lib/metrics/drill-types'
import { cn } from '@/lib/utils'
import { useDrill } from './drill-provider'

/** Anything clickable that opens the records behind a number. */
export function DrillButton({
  req,
  className,
  children,
  ...props
}: { req: DrillRequest } & Omit<ComponentProps<'button'>, 'onClick'>) {
  const { openDrill } = useDrill()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openDrill(req)
      }}
      className={cn(
        'cursor-pointer rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** Inline number link: dotted underline, opens drill-down. */
export function DrillLink({ req, className, children }: { req: DrillRequest; className?: string; children: React.ReactNode }) {
  return (
    <DrillButton
      req={req}
      className={cn(
        'tabular underline decoration-foreground/25 decoration-dotted underline-offset-4 hover:decoration-foreground/70',
        className,
      )}
    >
      {children}
    </DrillButton>
  )
}
