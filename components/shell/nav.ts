import {
  BookOpen,
  CircleAlert,
  Droplets,
  FileSignature,
  Funnel,
  HandCoins,
  House,
  Mail,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/** Labels: `nav.items.<id>` and `nav.groups.<group>` in the dictionaries. */
export interface NavItem {
  id: string
  href: string
  icon: LucideIcon
}

export const NAV_GROUPS: { id: string | null; items: NavItem[] }[] = [
  {
    id: null,
    items: [
      { id: 'overview', href: '/', icon: House },
      { id: 'exceptions', href: '/vyjimky', icon: CircleAlert },
    ],
  },
  {
    id: 'sales',
    items: [
      { id: 'pipeline', href: '/pipeline', icon: Funnel },
      { id: 'team', href: '/tym', icon: Users },
      { id: 'conversion', href: '/konverze', icon: Droplets },
      { id: 'contracts', href: '/smlouvy', icon: FileSignature },
    ],
  },
  {
    id: 'money',
    items: [
      { id: 'money', href: '/penize', icon: Wallet },
      { id: 'commissions', href: '/provize', icon: HandCoins },
    ],
  },
  {
    id: 'reporting',
    items: [
      { id: 'report', href: '/report', icon: Mail },
      { id: 'dictionary', href: '/slovnik', icon: BookOpen },
    ],
  },
]

/** `pathname` without the language prefix. */
export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
