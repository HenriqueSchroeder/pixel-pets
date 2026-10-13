import { beta, type Random } from './random'

// Thompson sampling that forgets by time, so a changed habit wins back in days.
// Keys are free-form: prefix them with a context bucket (`evening:juggle`) to
// learn one preference per bucket.
export type Tally = { wins: number; losses: number; at: number }
export type Bandit = Record<string, Tally>

const fade = (tally: Tally | undefined, now: number, halfLife: number): Tally => {
  if (tally === undefined) return { wins: 0, losses: 0, at: now }
  const kept = 0.5 ** (Math.max(0, now - tally.at) / halfLife)
  // An older event folds in without moving the clock back.
  return { wins: tally.wins * kept, losses: tally.losses * kept, at: Math.max(now, tally.at) }
}

export const choose = (bandit: Bandit, keys: string[], now: number, halfLife: number, random: Random) => {
  let best = keys[0] ?? ''
  let top = -1
  for (const key of keys) {
    const { wins, losses } = fade(bandit[key], now, halfLife)
    const draw = beta(wins + 1, losses + 1, random)
    if (draw > top) [best, top] = [key, draw]
  }
  return best
}

// `value` in [0, 1]: a pet is 1, an annoyed poke 0, anything between is partial.
export const reward = (bandit: Bandit, key: string, value: number, now: number, halfLife: number): Bandit => {
  const { wins, losses } = fade(bandit[key], now, halfLife)
  return { ...bandit, [key]: { wins: wins + value, losses: losses + 1 - value, at: now } }
}

export const mean = (bandit: Bandit, key: string, now: number, halfLife: number) => {
  const { wins, losses } = fade(bandit[key], now, halfLife)
  return (wins + 1) / (wins + losses + 2)
}
