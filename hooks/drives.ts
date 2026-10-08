import type { Traits } from '../types'
import type { Pace } from './walk'

// What the pet wants, apart from what Claude is doing: each in [0, 1], drifting
// with time by what it was up to. Session only, like the feelings.
export type Drives = { energy: number; boredom: number; longing: number; at: number }

// What it was up to since `at`: what the band last showed.
export type State = 'asleep' | 'awake' | 'working'

const HOUR_MS = 60 * 60_000

// Change per hour. Sleep fills energy in two hours; boredom fills in a quarter of
// an hour with nothing to do; longing fills in an hour without the person, even
// while Claude works, since it is about them.
const RATES: Record<State, Omit<Drives, 'at'>> = {
  asleep: { energy: 0.5, boredom: 4, longing: 1 },
  awake: { energy: -0.1, boredom: 4, longing: 1 },
  working: { energy: -0.25, boredom: 0, longing: 1 },
}

// Bored enough, and not too tired, to get up on its own.
const STIR_BOREDOM = 1 / 3
const STIR_ENERGY = 0.4
// Below this it starts to flag.
const LOW_ENERGY = 0.5
// Missing the person this much, it greets their first key.
const MISSING = 0.5

export const USUAL: Traits = { energetic: 0.5, curious: 0.5, affectionate: 0.5 }

export const rested = (now: number): Drives => ({ energy: 1, boredom: 0, longing: 0, at: now })

const unit = (value: number) => Math.min(1, Math.max(0, value))

// The drives at `now`, after spending the time since `at` in `state`, as a pet
// made with `traits`: an energetic one tires slower, a curious one gets bored
// sooner, an affectionate one misses the person sooner. The usual traits change nothing.
export const drift = (drives: Drives, now: number, state: State, traits: Traits = USUAL): Drives => {
  const hours = (now - drives.at) / HOUR_MS
  if (hours <= 0) return drives
  const rate = RATES[state]
  const tiring = rate.energy < 0 ? 1.5 - traits.energetic : 1
  return {
    energy: unit(drives.energy + rate.energy * tiring * hours),
    boredom: unit(drives.boredom + rate.boredom * traits.curious * 2 * hours),
    longing: unit(drives.longing + rate.longing * traits.affectionate * 2 * hours),
    at: now,
  }
}

// A turn started: something to watch at last.
export const engaged = (drives: Drives): Drives => ({ ...drives, boredom: 0 })

// Up from a nap on its own: that cured its boredom.
export const stirred = (drives: Drives): Drives => ({ ...drives, boredom: 0 })

// The person typed or sent a prompt.
export const seen = (drives: Drives): Drives => ({ ...drives, boredom: 0, longing: 0 })

// How much of its usual awake time it lasts: all of it until energy runs low.
export const alertness = (drives: Drives) => (drives.energy >= LOW_ENERGY ? 1 : Math.max(0.25, drives.energy * 2))

// How it strolls: a tired pet rests longer between strolls, up to twice as long,
// and one that misses the person keeps near the prompt.
export const paceOf = (drives: Drives): Pace => ({
  rest: drives.energy >= LOW_ENERGY ? 1 : 2 - drives.energy * 2,
  lean: drives.longing,
})

// Whether it has missed the person enough to greet them.
export const misses = (drives: Drives) => drives.longing >= MISSING

// Whether a dozing pet gets up on its own.
export const stirs = (drives: Drives) => drives.boredom >= STIR_BOREDOM && drives.energy >= STIR_ENERGY
