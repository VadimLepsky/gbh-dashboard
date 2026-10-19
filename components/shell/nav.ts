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

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: '/', label: 'Přehled', icon: House },
      { href: '/vyjimky', label: 'Vyžaduje pozornost', icon: CircleAlert },
    ],
  },
  {
    label: 'Obchod',
    items: [
      { href: '/pipeline', label: 'Pipeline a prognóza', icon: Funnel },
      { href: '/tym', label: 'Disciplína týmu', icon: Users },
      { href: '/konverze', label: 'Konverze a úniky', icon: Droplets },
      { href: '/smlouvy', label: 'Smlouvy a zakázky', icon: FileSignature },
    ],
  },
  {
    label: 'Peníze',
    items: [
      { href: '/penize', label: 'Peníze', icon: Wallet },
      { href: '/provize', label: 'Provize', icon: HandCoins },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/report', label: 'Týdenní report', icon: Mail },
      { href: '/slovnik', label: 'Slovník metrik', icon: BookOpen },
    ],
  },
]

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
