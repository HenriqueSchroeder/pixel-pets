import { beta, type Random } from './random'

// Similar moments get overlapping sparse codes: each cell sums a few random
// inputs and only the strongest `active` cells fire. What followed a moment is
// then stored on its cells, so a new moment recalls what followed the ones it
// overlaps, and learning one moment barely disturbs the unrelated ones.
export type Coder = { cells: number[][]; active: number }

export const coder = (inputs: number, size: number, active: number, perCell: number, random: Random): Coder => ({
  cells: Array.from({ length: size }, () => Array.from({ length: perCell }, () => Math.floor(random() * inputs))),
  active,
})

export const encode = (coder: Coder, x: number[]) =>
  coder.cells
    .map((inputs, cell) => ({ cell, drive: inputs.reduce((sum, i) => sum + (x[i] ?? 0), 0) }))
    .sort((a, b) => b.drive - a.drive || a.cell - b.cell)
    .slice(0, coder.active)
    .map(({ cell }) => cell)

// A value in [min, max] as `n` overlapping bumps, so nearby values share inputs.
// `circular` wraps the ends, for hours of the day.
export const bumps = (value: number, min: number, max: number, n: number, circular = false) => {
  const span = max - min
  const width = span / (circular ? n : n - 1)
  return Array.from({ length: n }, (_, i) => {
    let d = Math.abs(value - (min + i * width))
    if (circular) d = Math.min(d, span - d)
    return Math.exp(-((d / width) ** 2))
  })
}

// Reward summed and moments seen, per action and cell.
// ponytail: no forgetting yet; add per-cell timestamps if Recall earns its place.
export type Memory = Record<string, { sum: Record<number, number>; seen: Record<number, number> }>

const tally = (memory: Memory, action: string, code: number[]) => {
  const slot = memory[action]
  let sum = 0
  let seen = 0
  for (const cell of code) {
    sum += slot?.sum[cell] ?? 0
    seen += slot?.seen[cell] ?? 0
  }
  return { wins: sum / code.length, trials: seen / code.length }
}

export const recall = (memory: Memory, action: string, code: number[]) => {
  const { wins, trials } = tally(memory, action, code)
  return (wins + 1) / (trials + 2)
}

export const pick = (memory: Memory, actions: string[], code: number[], random: Random) => {
  let best = actions[0] ?? ''
  let top = -1
  for (const action of actions) {
    const { wins, trials } = tally(memory, action, code)
    const draw = beta(wins + 1, trials - wins + 1, random)
    if (draw > top) [best, top] = [action, draw]
  }
  return best
}

// Mutates: the memory can hold thousands of cells, copying it per event costs more than it buys.
export const remember = (memory: Memory, action: string, code: number[], value: number) => {
  const slot = (memory[action] ??= { sum: {}, seen: {} })
  for (const cell of code) {
    slot.sum[cell] = (slot.sum[cell] ?? 0) + value
    slot.seen[cell] = (slot.seen[cell] ?? 0) + 1
  }
}

// How unfamiliar a moment is, 0 to 1. Seeing it makes its cells familiar, and
// familiarity fades with `halfLife`, so a rare moment is news again later.
export type Familiar = Record<number, { level: number; at: number }>

const level = (familiar: Familiar, cell: number, now: number, halfLife: number) => {
  const f = familiar[cell]
  return f === undefined ? 0 : f.level * 0.5 ** (Math.max(0, now - f.at) / halfLife)
}

export const novelty = (familiar: Familiar, code: number[], now: number, halfLife: number) =>
  code.reduce((sum, cell) => sum + 1 - level(familiar, cell, now, halfLife), 0) / code.length

export const see = (familiar: Familiar, code: number[], now: number, halfLife: number, gain = 0.5) => {
  for (const cell of code) {
    const was = level(familiar, cell, now, halfLife)
    familiar[cell] = { level: was + gain * (1 - was), at: now }
  }
}
