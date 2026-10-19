export type ViewAs = 'reditel' | 'morava' | 'novak'

export const VIEW_AS_OPTIONS: { id: ViewAs; label: string; short: string }[] = [
  { id: 'reditel', label: 'Ředitel obchodu', short: 'Celá firma' },
  { id: 'morava', label: 'Vedoucí týmu Morava', short: 'Tým Morava' },
  { id: 'novak', label: 'Jakub Novák (obchodník)', short: 'Jen vlastní data' },
]

export function parseViewAs(value: string | undefined | null): ViewAs {
  return value === 'morava' || value === 'novak' ? value : 'reditel'
}
