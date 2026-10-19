/** Small deterministic PRNG (mulberry32) plus sampling helpers. */
export interface Rng {
  next(): number
  int(min: number, max: number): number
  range(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  weighted<T>(items: readonly T[], weights: readonly number[]): T
  normal(mean?: number, sd?: number): number
  logNormal(median: number, sigma: number): number
  poisson(lambda: number): number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  let spare: number | null = null
  const normal = (mean = 0, sd = 1) => {
    if (spare !== null) {
      const v = spare
      spare = null
      return mean + sd * v
    }
    let u = 0
    let v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    const mag = Math.sqrt(-2 * Math.log(u))
    spare = mag * Math.sin(2 * Math.PI * v)
    return mean + sd * mag * Math.cos(2 * Math.PI * v)
  }

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items, weights) => {
      let total = 0
      for (const w of weights) total += w
      let r = next() * total
      for (let i = 0; i < items.length; i++) {
        r -= weights[i]
        if (r <= 0) return items[i]
      }
      return items[items.length - 1]
    },
    normal,
    logNormal: (median, sigma) => median * Math.exp(normal(0, sigma)),
    poisson: (lambda) => {
      const l = Math.exp(-lambda)
      let k = 0
      let p = 1
      do {
        k++
        p *= next()
      } while (p > l)
      return k - 1
    },
  }
}
