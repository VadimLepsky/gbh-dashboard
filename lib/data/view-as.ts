export type ViewAs = 'reditel' | 'morava' | 'novak'

/** Roles of the "view as" switcher; labels live in the dictionaries under `viewAs.<id>`. */
export const VIEW_AS_OPTIONS: { id: ViewAs }[] = [{ id: 'reditel' }, { id: 'morava' }, { id: 'novak' }]

export function parseViewAs(value: string | undefined | null): ViewAs {
  return value === 'morava' || value === 'novak' ? value : 'reditel'
}
