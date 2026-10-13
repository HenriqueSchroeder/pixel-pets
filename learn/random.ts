// Seeded, so a run can be replayed. The plugin can pass Math.random instead.
export type Random = () => number

// mulberry32: 32 bits of state, good enough for exploration and simulations.
export const seeded = (seed: number): Random => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const normal = (random: Random) => {
  const u = 1 - random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

// Marsaglia and Tsang; a shape below 1 borrows from shape + 1.
const gamma = (shape: number, random: Random): number => {
  if (shape < 1) return gamma(shape + 1, random) * random() ** (1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    const x = normal(random)
    const v = (1 + c * x) ** 3
    if (v <= 0) continue
    if (Math.log(1 - random()) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v
  }
}

export const beta = (a: number, b: number, random: Random) => {
  const x = gamma(a, random)
  return x / (x + gamma(b, random))
}
