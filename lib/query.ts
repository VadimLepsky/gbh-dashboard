/** URL params that carry the dashboard state across pages. */
export const STATE_PARAMS = ['period', 'from', 'to', 'cmp', 'as'] as const

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined
  const v = params[key]
  return Array.isArray(v) ? v[0] : v
}

/** `path` with the current period / comparison / role params preserved. */
export function withState(path: string, params: ParamSource, overrides: Record<string, string | null> = {}): string {
  const out = new URLSearchParams()
  for (const key of STATE_PARAMS) {
    const v = key in overrides ? overrides[key] : read(params, key)
    if (v) out.set(key, v)
  }
  for (const [k, v] of Object.entries(overrides)) {
    if ((STATE_PARAMS as readonly string[]).includes(k)) continue
    if (v) out.set(k, v)
  }
  const qs = out.toString()
  return qs ? `${path}?${qs}` : path
}
