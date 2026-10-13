import { describe, expect, test } from 'claude-code/testing'

import {
  annoyed,
  armOf,
  asBandit,
  asFamiliarity,
  CREDIT_MS,
  daypartOf,
  logLine,
  momentCode,
  petted,
  pickFor,
  settle,
  tempered,
  temperOf,
  whimOf,
} from '../hooks/learning'
import type { Pick, Shown } from '../hooks/learning'
import { mean } from '../learn/bandit'
import { seeded } from '../learn/random'
import { novelty, see } from '../learn/recall'

const day = (d: number, hour = 14) => new Date(2026, 2, d, hour, 0).getTime()
const shown = (activity: string, at: number): Shown => ({
  at,
  arm: 'learned',
  daypart: 'afternoon',
  pet: 'cat',
  activity,
  propensity: 0.5,
  petted: 0,
  annoyed: false,
})

describe('learning', () => {
  test('dayparts split the day in four', () => {
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(daypartOf)).toEqual([
      'night', 'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening',
    ])
  })

  test('each pair of days has one of each arm, the same all day long', () => {
    for (const seed of [1, 2, 3]) {
      for (let d = 2; d <= 28; d += 2) {
        const pair = [armOf(seed, day(d)), armOf(seed, day(d + 1))].sort()
        expect(pair).toEqual(['hand', 'learned'])
      }
      expect(armOf(seed, day(10, 0))).toBe(armOf(seed, day(10, 23)))
    }
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seed => armOf(seed, day(10))))
    expect(orders.size).toBe(2)
    // Which day of a pair learns is a coin toss, not the pair's number's parity.
    const firsts = Array.from({ length: 40 }, (_, pair) => armOf(1, day(2 + pair * 2)) === 'learned')
    const runs = firsts.filter((one, i) => i > 0 && one !== firsts[i - 1]).length
    expect(runs > 8 && runs < 32).toBe(true)
  })

  test('a pet is shared evenly by what began in the minute before, and only that', () => {
    const list = [shown('roast', 0), shown('juggle', 30_000), shown('juggle', 50_000), shown('nap', 120_000)]
    const after = petted(list, 70_000)
    expect(after.map(one => one.petted)).toEqual([0, 0.5, 0.5, 0])
    expect(annoyed(list, 70_000).map(one => one.annoyed)).toEqual([false, true, true, false])
  })

  test('past its minute, an activity counts once: a pet as 1, nothing as 0', () => {
    const list = petted([shown('juggle', 0), shown('roast', 0), shown('nap', 100_000)], 10_000)
    const { bandit, done, waiting } = settle({}, list, CREDIT_MS + 1)
    expect(done.map(one => one.activity)).toEqual(['juggle', 'roast'])
    expect(waiting.map(one => one.activity)).toEqual(['nap'])
    expect(bandit['afternoon:cat:juggle']).toEqual({ wins: 0.5, losses: 0.5, at: 0 })
    expect(settle(bandit, waiting, CREDIT_MS + 1).bandit).toEqual(bandit)
  })

  // How often each of `activities` is picked over many draws, and the chances logged.
  const draws = (pick: Pick, now = 100) => {
    const random = seeded(3)
    const times: Record<string, number> = {}
    const chances: Record<string, number> = {}
    for (let i = 0; i < 4000; i++) {
      const { activity, propensity } = pickFor(pick, now, random)
      times[activity] = (times[activity] ?? 0) + 1 / 4000
      chances[activity] = propensity
    }
    return { times, chances }
  }
  const learnedJuggle = () => {
    let bandit = {}
    for (let i = 0; i < 20; i++) {
      bandit = settle(bandit, petted([shown('juggle', i)], i), i + CREDIT_MS + 1).bandit
      bandit = settle(bandit, [shown('roast', i)], i + CREDIT_MS + 1).bandit
    }
    return bandit
  }
  const base: Pick = { bandit: {}, seed: 1, pet: 'cat', daypart: 'afternoon', activities: ['juggle', 'roast'], lately: [] }

  test('what earned pets is picked more often, never always, and the chance logged is the real one', () => {
    const bandit = learnedJuggle()
    expect(mean(bandit, 'afternoon:cat:juggle', 100, 1e12)).toBeGreaterThan(0.9)
    const { times, chances } = draws({ ...base, bandit })
    expect(times.juggle!).toBeGreaterThan(0.6)
    // Never settled: what it is not petted for still comes up now and then.
    expect(times.roast!).toBeGreaterThan(0.08)
    expect(Math.abs(times.juggle! - chances.juggle!)).toBeLessThan(0.03)
    expect(Math.abs(chances.juggle! + chances.roast! - 1)).toBeLessThan(1e-9)
  })

  test('what it learned is for this time of day and this pet alone', () => {
    const bandit = learnedJuggle()
    const here = draws({ ...base, bandit }).times.juggle!
    expect(draws({ ...base, bandit, daypart: 'night' }).times.juggle!).toBeLessThan(here - 0.2)
    expect(draws({ ...base, bandit, pet: 'dragon' }).times.juggle!).toBeLessThan(here - 0.2)
  })

  test('it wearies of what it just did, the latest the most', () => {
    const fresh = draws(base).times.juggle!
    const once = draws({ ...base, lately: ['juggle'] }).times.juggle!
    const twice = draws({ ...base, lately: ['juggle', 'juggle'] }).times.juggle!
    const long = draws({ ...base, lately: ['roast', 'roast', 'roast', 'juggle'] }).times.juggle!
    expect(once).toBeLessThan(fresh - 0.15)
    expect(twice).toBeLessThan(once)
    expect(long).toBeGreaterThan(once)
  })

  test('its whims drift smoothly, and over the weeks it takes to different things', () => {
    const hour = 3_600_000
    const at = (days: number) => new Date(2026, 2, 1).getTime() + days * 24 * hour
    const whims = Array.from({ length: 60 }, (_, day) => whimOf(1, 'cat', 'juggle', at(day)))
    for (const one of whims) expect(Math.abs(one) <= 1).toBe(true)
    // From one value to the next over three days, at most half again as steep as a straight line.
    for (let day = 1; day < 60; day++) expect(Math.abs(whims[day]! - whims[day - 1]!)).toBeLessThan(1.01)
    expect(Math.max(...whims) - Math.min(...whims)).toBeGreaterThan(0.8)
    expect(Math.abs(whimOf(1, 'cat', 'juggle', at(10)) - whimOf(1, 'cat', 'juggle', at(10) + hour))).toBeLessThan(0.05)
    expect(whimOf(1, 'cat', 'juggle', at(10))).not.toBe(whimOf(1, 'cat', 'roast', at(10)))
  })

  test('a temper lasts the day, most days are usual, and it only nudges traits within [0, 1]', () => {
    const day = (d: number, hour: number) => new Date(2026, 2, d, hour).getTime()
    expect(temperOf(4, day(5, 1))).toBe(temperOf(4, day(5, 23)))
    const tempers = Array.from({ length: 120 }, (_, d) => temperOf(4, day(1 + d, 12)))
    expect(new Set(tempers).size).toBe(5)
    expect(tempers.filter(one => one === 'usual').length).toBeGreaterThan(25)
    const traits = { energetic: 0.9, curious: 0.5, affectionate: 0.1 }
    expect(tempered(traits, 'usual')).toEqual(traits)
    expect(tempered(traits, 'playful').energetic).toBe(1)
    expect(Math.abs(tempered(traits, 'lazy').energetic - 0.65)).toBeLessThan(1e-9)
    expect(tempered(traits, 'clingy').affectionate).toBe(0.35)
    expect(tempered(traits, 'curious').curious).toBe(0.75)
  })

  test('a log line keeps what was shown and its reward, nothing more', () => {
    const line = JSON.parse(logLine({ ...shown('juggle', 5), petted: 1.5 }))
    expect(line).toEqual({ kind: 'shown', ...shown('juggle', 5), petted: 1.5, reward: 1 })
  })

  test('only well-formed tallies come back from the store', () => {
    expect(asBandit(null)).toEqual({})
    expect(asBandit([1])).toEqual({})
    expect(
      asBandit({ ok: { wins: 1, losses: 2, at: 3 }, bad: { wins: -1, losses: 0, at: 0 }, odd: { wins: 'x' }, nan: { wins: NaN, losses: 0, at: 0 }, none: null }),
    ).toEqual({ ok: { wins: 1, losses: 2, at: 3 } })
  })

  test('a moment like the usual one is less news than an odd one, and survives the store', () => {
    const familiar = {}
    for (let i = 0; i < 30; i++) see(familiar, momentCode(14 + (i % 3), 5, 10), i * 60_000, 2 * 86_400_000)
    const kept = asFamiliarity(JSON.parse(JSON.stringify({ seen: 30, cells: familiar })))
    expect(kept.seen).toBe(30)
    const now = 31 * 60_000
    expect(novelty(kept.cells, momentCode(15, 6, 9), now, 2 * 86_400_000)).toBeLessThan(novelty(kept.cells, momentCode(3, 120, 30), now, 2 * 86_400_000))
    expect(asFamiliarity({ seen: -1, cells: { 1: { level: 2, at: 0 }, 2: { level: 0.5, at: 'x' }, 3: { level: 0.5, at: 1 } } })).toEqual({
      seen: 0,
      cells: { 3: { level: 0.5, at: 1 } },
    })
    expect(asFamiliarity(null)).toEqual({ seen: 0, cells: {} })
  })
})
