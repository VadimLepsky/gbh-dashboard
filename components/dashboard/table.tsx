import { cn } from '@/lib/utils'

/** Plain, dense tables: thin row rules, muted header, numbers right-aligned and tabular. */
export function DataTable({ className, children, minWidth }: { className?: string; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className={cn('-mx-5 overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13px]" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  )
}

export function Th({
  children,
  className,
  align,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'right' | 'center'
}) {
  return (
    <th
      className={cn(
        'border-b px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  align,
  heat,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'right' | 'center'
  /** Light tint for cells that need attention. */
  heat?: 'bad' | 'warn' | 'good' | null
}) {
  return (
    <td
      className={cn(
        'border-b border-border/60 px-3 py-2.5 align-middle first:pl-5 last:pr-5',
        align === 'right' && 'tabular text-right whitespace-nowrap',
        align === 'center' && 'text-center',
        heat === 'bad' && 'bg-negative-soft/70',
        heat === 'warn' && 'bg-warning-soft/70',
        heat === 'good' && 'bg-positive-soft/50',
        className,
      )}
    >
      {children}
    </td>
  )
}
