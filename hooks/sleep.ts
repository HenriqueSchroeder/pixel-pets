import type { Random } from './motion'

const MINUTE = 60_000

// The first this long of an idle stretch is a light sleep at most.
export const DEEP_SLEEP_MS = 10 * MINUTE
// Dozed off, it naps lightly at least this long before a deep spell has it.
export const FIRST_NAP_MS = 3 * MINUTE
// After it, deep and light spells take turns, deep first, each this many minutes.
const DEEP_MINUTES: [number, number] = [8, 15]
const LIGHT_MINUTES: [number, number] = [3, 6]

// mulberry32: the same seed draws the same numbers, so a stretch needs no state kept.
const seeded = (seed: number): Random => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Whether it is in a deep sleep `idleFor` ms into the idle stretch that began at `idleSince`.
// ponytail: walks the spells from the start on every call, about 80 for a day idle;
// keep the last spell seen if that ever shows up.
export const isDeep = (idleSince: number, idleFor: number) => {
  if (idleFor <= DEEP_SLEEP_MS) return false
  const random = seeded(idleSince)
  let end = DEEP_SLEEP_MS
  for (let deep = true; ; deep = !deep) {
    const [min, max] = deep ? DEEP_MINUTES : LIGHT_MINUTES
    end += (min + (max - min) * random()) * MINUTE
    if (idleFor <= end) return deep
  }
}
