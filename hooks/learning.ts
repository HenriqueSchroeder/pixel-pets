import type { Traits } from '../types'
import { mean, reward, type Bandit, type Tally } from '../learn/bandit'
import { credit } from '../learn/credit'
import { seeded, type Random } from '../learn/random'
import { bumps, coder, encode, type Familiar } from '../learn/recall'
import { daysBetween } from './memory'

// A pet that feels alive: it lives by what it learned of the person and by whims
// of its own, and what it learns of their taste only tips its choices: it never
// settles on one. In the experiment it does so only on its `learned` days, as it
// always did on the `hand` ones, and every activity shown is logged with the pets it got.

export type Arm = 'learned' | 'hand'
export type Daypart = 'night' | 'morning' | 'afternoon' | 'evening'

// An activity shown, waiting the minute a pet may take to land.
export type Shown = {
  at: number
  arm: Arm
  daypart: Daypart
  // The pet that showed it: a taste for one pet's nap says nothing of another's.
  pet: string
  activity: string
  // The chance the learned pick had of naming it; null when picked by hand.
  propensity: number | null
  petted: number
  annoyed: boolean
}

const DAY_MS = 24 * 60 * 60_000
// Old enough evidence counts half: a changed taste wins back within days.
export const HALF_LIFE_MS = 7 * DAY_MS
// How long after an activity began a pet still counts for it.
export const CREDIT_MS = 60_000
// How a pick on a learning day weighs what the person likes, its own whims and
// its weariness of what it just did; and how loosely it follows the sum.
const TASTE = 1
const WHIM = 0.8
const WEARINESS = 0.9
const TEMPERATURE = 0.8
// The most the person's taste tips a pick, either way.
const MOST_TASTE = 1
// Whims drift from one to the next over this many days.
const WHIM_DAYS = 3
// Days are counted from here, in local time, so blocks of two line up anywhere.
const EPOCH = new Date(2026, 0, 1).getTime()

export const daypartOf = (hour: number): Daypart =>
  hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

// What the bandit learns per daypart and pet.
const scopeOf = (daypart: Daypart, pet: string) => `${daypart}:${pet}:`
const keyOf = (one: Shown) => scopeOf(one.daypart, one.pet) + one.activity

// FNV-1a, then MurmurHash3's finalizer: FNV alone barely moves the high bits, nor
// the low one, when only a string's last digit changes, as from one day to the next.
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

// A number in [-1, 1] fixed by `text`.
const unit = (text: string) => (hash(text) / 2 ** 32) * 2 - 1

// Days go in pairs, one of each arm in a random order fixed by `seed`, so every
// session on a day agrees and the arms stay even week to week.
export const armOf = (seed: number, now: number): Arm => {
  const day = daysBetween(EPOCH, now)
  const block = Math.floor(day / 2)
  const learnedFirst = hash(`${seed}:${block}`) % 2 === 0
  return (day - block * 2 === 0) === learnedFirst ? 'learned' : 'hand'
}

// How much the pet feels like `activity` these days, in [-1, 1], whatever the
// person likes: a smooth drift between values fixed every few days by `seed`, so
// it takes to something for a while, then to something else.
export const whimOf = (seed: number, pet: string, activity: string, now: number) => {
  const x = (now - EPOCH) / DAY_MS / WHIM_DAYS
  const k = Math.floor(x)
  const t = x - k
  const s = t * t * (3 - 2 * t)
  return unit(`${seed}:${pet}:${activity}:${k}`) * (1 - s) + unit(`${seed}:${pet}:${activity}:${k + 1}`) * s
}

export type Pick = {
  bandit: Bandit
  seed: number
  pet: string
  daypart: Daypart
  activities: string[]
  // What it did lately, the latest first.
  lately: string[]
}

// The pick among `activities` on a learning day, and the chance it had. Each one
// scores by how much more than the others the person pets it for at this time
// of day, by the pet's whim of the moment, and down for each time it did it
// lately, the latest counting most; the pick is drawn by those scores.
export const pickFor = (pick: Pick, now: number, random: Random) => {
  const { bandit, seed, pet, daypart, activities, lately } = pick
  const means = activities.map(name => mean(bandit, scopeOf(daypart, pet) + name, now, HALF_LIFE_MS))
  const usual = means.reduce((a, b) => a + b, 0) / Math.max(1, means.length)
  const scores = activities.map((name, i) => {
    const taste = Math.max(-MOST_TASTE, Math.min(MOST_TASTE, Math.log((means[i] ?? usual) / usual)))
    const weary = lately.reduce((sum, one, ago) => sum + (one === name ? 0.5 ** ago : 0), 0)
    return TASTE * taste + WHIM * whimOf(seed, pet, name, now) - WEARINESS * weary
  })
  const top = Math.max(...scores)
  const weights = scores.map(score => Math.exp((score - top) / TEMPERATURE))
  const total = weights.reduce((a, b) => a + b, 0)
  let left = random() * total
  let index = weights.length - 1
  for (let i = 0; i < weights.length; i++) {
    left -= weights[i] ?? 0
    if (left < 0) {
      index = i
      break
    }
  }
  return { activity: activities[index] ?? '', propensity: (weights[index] ?? 0) / total }
}

// The temper it wakes up in on a learning day, fixed for the day by `seed`: most
// days its usual self, else a little more playful, lazy, clingy or curious.
export type Temper = 'usual' | 'playful' | 'lazy' | 'clingy' | 'curious'
const TEMPERS: readonly Temper[] = ['usual', 'usual', 'playful', 'lazy', 'clingy', 'curious']
// How far a temper moves the trait it touches.
const NUDGE = 0.25

export const temperOf = (seed: number, now: number): Temper =>
  TEMPERS[hash(`${seed}:temper:${daysBetween(EPOCH, now)}`) % TEMPERS.length] ?? 'usual'

const nudged = (value: number, by: number) => Math.min(1, Math.max(0, value + by))

// The pet's traits for the day: an energetic one tires slower, a curious one gets
// bored sooner, an affectionate one misses the person sooner.
export const tempered = (traits: Traits, temper: Temper): Traits => {
  switch (temper) {
    case 'usual':
      return traits
    case 'playful':
      return { ...traits, energetic: nudged(traits.energetic, NUDGE) }
    case 'lazy':
      return { ...traits, energetic: nudged(traits.energetic, -NUDGE) }
    case 'clingy':
      return { ...traits, affectionate: nudged(traits.affectionate, NUDGE) }
    case 'curious':
      return { ...traits, curious: nudged(traits.curious, NUDGE) }
  }
}

// A pet shares itself evenly among the activities begun in the minute before it.
export const petted = (shown: Shown[], now: number): Shown[] => {
  const shares = credit(shown.map((one, i) => ({ action: String(i), at: one.at })), now, Infinity, CREDIT_MS)
  return shown.map((one, i) => ({ ...one, petted: one.petted + (shares[String(i)] ?? 0) }))
}

export const annoyed = (shown: Shown[], now: number): Shown[] =>
  shown.map(one => (now >= one.at && now - one.at <= CREDIT_MS ? { ...one, annoyed: true } : one))

// What is past its minute counts for the bandit, a pet as 1 and nothing or an
// annoyance as 0, whichever arm picked it; the rest keeps waiting.
export const settle = (bandit: Bandit, shown: Shown[], now: number) => {
  const done = shown.filter(one => now - one.at > CREDIT_MS)
  let next = bandit
  for (const one of done) next = reward(next, keyOf(one), Math.min(1, one.petted), one.at, HALF_LIFE_MS)
  return { bandit: next, done, waiting: shown.filter(one => now - one.at <= CREDIT_MS) }
}

// One line of the log: what was shown and how it went, never what the person wrote.
export const logLine = (one: Shown) =>
  JSON.stringify({ kind: 'shown', ...one, reward: Math.min(1, one.petted) })

// The store holds what anyone could have written: only well-formed tallies count.
export const asBandit = (value: unknown): Bandit => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const bandit: Bandit = {}
  const count = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
  for (const [key, tally] of Object.entries(value)) {
    const { wins, losses, at } = (tally ?? {}) as Partial<Record<keyof Tally, unknown>>
    if (count(wins) && count(losses) && count(at)) bandit[key] = { wins, losses, at }
  }
  return bandit
}

// How unusual a prompt's moment is: its hour, how long the person was away and how
// many tools the last turn ran. A moment seen fades back to news in a few days.
export const FAMILIAR_HALF_LIFE_MS = 2 * DAY_MS
// Fixed by its seed, never stored: every session codes a moment the same.
const MOMENTS = coder(20, 1000, 50, 3, seeded(7))
// It finds a moment odd from this novelty on, once it knows this many of the
// person's moments, and not again for an hour.
export const ODD = 0.75
export const KNOWS = 50
export const ODD_GAP_MS = 60 * 60_000

export const momentCode = (hour: number, awayMinutes: number, tools: number) =>
  encode(MOMENTS, [
    ...bumps(hour, 0, 24, 8, true),
    ...bumps(Math.min(awayMinutes, 120), 0, 120, 6),
    ...bumps(Math.min(tools, 30), 0, 30, 6),
  ])

// The moments it has seen, and how familiar each cell is.
export type Familiarity = { seen: number; cells: Familiar }

export const asFamiliarity = (value: unknown): Familiarity => {
  const { seen, cells } = (typeof value === 'object' && value !== null ? value : {}) as { seen?: unknown; cells?: unknown }
  const familiar: Familiar = {}
  if (typeof cells === 'object' && cells !== null && !Array.isArray(cells)) {
    for (const [cell, kept] of Object.entries(cells)) {
      const { level, at } = (kept ?? {}) as { level?: unknown; at?: unknown }
      if (typeof level === 'number' && level >= 0 && level <= 1 && typeof at === 'number' && Number.isFinite(at))
        familiar[Number(cell)] = { level, at }
    }
  }
  return { seen: typeof seen === 'number' && seen >= 0 ? seen : 0, cells: familiar }
}
