'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { withState } from '@/lib/query'
import { ThemeToggle } from '@/components/theme-toggle'
import { NAV_GROUPS, isActive } from './nav'
import { RoleSwitcher } from './role-switcher'

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-wide text-primary-foreground">
        GBH
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold">GBH Defence</div>
        <div className="truncate text-xs text-muted-foreground">Obchodní oddělení</div>
      </div>
    </div>
  )
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      Demo · simulovaná data
    </span>
  )
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <nav className="flex flex-col gap-5" aria-label="Hlavní navigace">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.label && (
            <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={withState(item.href, params)}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13.5px] transition-colors',
                  active
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )}
              >
                <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-sidebar-border/60 bg-sidebar lg:flex">
      <div className="px-5 pt-5 pb-4">
        <Brand />
        <DemoBadge className="mt-3" />
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        <NavLinks />
      </div>
      <div className="border-t border-sidebar-border/60 px-4 py-4">
        <RoleSwitcher />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Pipedrive · iDoklad · banka</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
