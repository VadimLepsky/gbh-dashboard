'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { Brand, DemoBadge, NavLinks } from './sidebar'
import { RoleSwitcher } from './role-switcher'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-sidebar/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <Brand />
      <div className="flex items-center gap-1">
        <DemoBadge compact />
        <ThemeToggle />
        <Button variant="ghost" size="icon-sm" aria-label="Otevřít menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="gap-0 p-0 data-[side=left]:w-[280px]">
          <SheetTitle className="sr-only">Navigace</SheetTitle>
          <div className="px-5 pt-5 pb-4">
            <Brand />
            <DemoBadge className="mt-3" />
          </div>
          <div className="flex-1 overflow-y-auto px-2.5 py-2">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t px-4 py-4">
            <RoleSwitcher />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
