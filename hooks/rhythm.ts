// When the person usually turns up, so the pet can wake a little before and wait
// for them. Arrivals count by half hour, weekdays apart from weekends, and an old
// habit fades. Kept in `$.store`.
export type Rhythm = Record<string, { count: number; at: number }>

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const HALF_LIFE_MS = 14 * DAY_MS
// A prompt after this long without the person is them arriving.
export const AWAY_MS = 30 * MINUTE_MS
// How long before a usual half hour it starts to wait.
const LEAD_MS = 15 * MINUTE_MS
// A half hour is a habit once it holds this many recent arrivals, and this share
// of the busiest half hour of its kind of day.
const HABIT = 2
const SHARE = 0.4

const kindOf = (date: Date) => (date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : 'weekday')

// "weekday:18" is 9:00 to 9:30 on a weekday, in local time.
const slotOf = (time: number) => {
  const date = new Date(time)
  return `${kindOf(date)}:${date.getHours() * 2 + (date.getMinutes() >= 30 ? 1 : 0)}`
}

const countAt = (rhythm: Rhythm, slot: string, now: number) => {
  const kept = rhythm[slot]
  return kept === undefined ? 0 : kept.count * 0.5 ** (Math.max(0, now - kept.at) / HALF_LIFE_MS)
}

export const arrived = (rhythm: Rhythm, now: number): Rhythm => {
  const slot = slotOf(now)
  return { ...rhythm, [slot]: { count: countAt(rhythm, slot, now) + 1, at: now } }
}

// Whether the person usually turns up within the next quarter of an hour.
export const expects = (rhythm: Rhythm, now: number) => {
  const slot = slotOf(now + LEAD_MS)
  const kind = slot.split(':')[0]
  const counts = Object.keys(rhythm)
    .filter(key => key.startsWith(`${kind}:`))
    .map(key => countAt(rhythm, key, now))
  const count = countAt(rhythm, slot, now)
  return count >= HABIT && count >= SHARE * Math.max(...counts)
}

// The store holds what anyone could have written: only well-formed counts come back.
export const asRhythm = (value: unknown): Rhythm => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const rhythm: Rhythm = {}
  for (const [slot, kept] of Object.entries(value)) {
    const { count, at } = (kept ?? {}) as { count?: unknown; at?: unknown }
    if (/^week(day|end):\d{1,2}$/.test(slot) && typeof count === 'number' && count >= 0 && typeof at === 'number' && Number.isFinite(at))
      rhythm[slot] = { count, at }
  }
  return rhythm
}
