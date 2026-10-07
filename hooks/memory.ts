import { isMorning } from './feelings'

// What the pet remembers of the person across sessions, kept in `$.store`.
export type Visit = { metAt: number; lastSeenAt: number }

// How a session opens, at most one: the first that applies wins.
export type Welcome = { kind: 'anniversary'; days: number } | { kind: 'missedYou' } | { kind: 'goodMorning' }

const DAY_MS = 24 * 60 * 60_000
const MILESTONES = [7, 30, 100]
const MISSED_DAYS = 2

const midnight = (time: number) => new Date(time).setHours(0, 0, 0, 0)

// Calendar days from `from` to `to`, in local time.
export const daysBetween = (from: number, to: number) => Math.round((midnight(to) - midnight(from)) / DAY_MS)

export const isAnniversary = (days: number) => MILESTONES.includes(days) || (days > 0 && days % 365 === 0)

export const welcome = (visit: Visit | undefined, now: number, hour: number): Welcome | undefined => {
  if (visit !== undefined) {
    const away = daysBetween(visit.lastSeenAt, now)
    // Seen already today: the day's welcome is spent.
    if (away === 0) return undefined
    const age = daysBetween(visit.metAt, now)
    if (isAnniversary(age)) return { kind: 'anniversary', days: age }
    if (away >= MISSED_DAYS) return { kind: 'missedYou' }
  }
  return isMorning(hour) ? { kind: 'goodMorning' } : undefined
}

// The store holds what anyone could have written: only a well-formed visit counts.
export const asVisit = (value: unknown): Visit | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const { metAt, lastSeenAt } = value as Record<string, unknown>
  return typeof metAt === 'number' && typeof lastSeenAt === 'number' ? { metAt, lastSeenAt } : undefined
}
