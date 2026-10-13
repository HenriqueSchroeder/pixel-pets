import { choose, reward, type Bandit, type Tally } from '../learn/bandit'
import { credit } from '../learn/credit'
import { seeded, type Random } from '../learn/random'
import { bumps, coder, encode, type Familiar } from '../learn/recall'
import { daysBetween } from './memory'

// The experiment of learning which activities the person likes: each day the pet
// either picks its activities by what earned pets (`learned`) or as it always did
// (`hand`), and every activity shown is logged with the pets it got.

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
// Draws behind a logged propensity.
const DRAWS = 200
// Days are counted from here, in local time, so blocks of two line up anywhere.
const EPOCH = new Date(2026, 0, 1).getTime()

export const daypartOf = (hour: number): Daypart =>
  hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

// What the bandit learns per daypart and pet.
const scopeOf = (daypart: Daypart, pet: string) => `${daypart}:${pet}:`
const keyOf = (one: Shown) => scopeOf(one.daypart, one.pet) + one.activity

// FNV-1a: a fixed, well-spread hash, unlike anything keyed on Math.random.
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

// Days go in pairs, one of each arm in a random order fixed by `seed`, so every
// session on a day agrees and the arms stay even week to week.
export const armOf = (seed: number, now: number): Arm => {
  const day = daysBetween(EPOCH, now)
  const block = Math.floor(day / 2)
  const learnedFirst = hash(`${seed}:${block}`) % 2 === 0
  return (day - block * 2 === 0) === learnedFirst ? 'learned' : 'hand'
}

// The learned pick among `activities`, and how often it would have been this one.
export const pickFor = (bandit: Bandit, activities: string[], daypart: Daypart, pet: string, now: number, random: Random) => {
  const scope = scopeOf(daypart, pet)
  const keys = activities.map(name => scope + name)
  const drawn = (key: string) => key.slice(scope.length)
  const picked = drawn(choose(bandit, keys, now, HALF_LIFE_MS, random))
  // The pick counts as a draw too, so a rare pick logs a small chance, never 0.
  let same = 1
  for (let i = 0; i < DRAWS; i++) if (drawn(choose(bandit, keys, now, HALF_LIFE_MS, random)) === picked) same++
  return { activity: picked, propensity: same / (DRAWS + 1) }
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

// How unusual a prompt's moment is, logged only for now: its hour, how long the
// person was away and how many tools the last turn ran. A moment seen fades back
// to news in a few days.
export const FAMILIAR_HALF_LIFE_MS = 2 * DAY_MS
// Fixed by its seed, never stored: every session codes a moment the same.
const MOMENTS = coder(20, 1000, 50, 3, seeded(7))

export const momentCode = (hour: number, awayMinutes: number, tools: number) =>
  encode(MOMENTS, [
    ...bumps(hour, 0, 24, 8, true),
    ...bumps(Math.min(awayMinutes, 120), 0, 120, 6),
    ...bumps(Math.min(tools, 30), 0, 30, 6),
  ])

export const asFamiliar = (value: unknown): Familiar => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const familiar: Familiar = {}
  for (const [cell, kept] of Object.entries(value)) {
    const { level, at } = (kept ?? {}) as { level?: unknown; at?: unknown }
    if (typeof level === 'number' && level >= 0 && level <= 1 && typeof at === 'number' && Number.isFinite(at))
      familiar[Number(cell)] = { level, at }
  }
  return familiar
}
