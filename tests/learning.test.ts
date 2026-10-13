import { describe, expect, test } from 'claude-code/testing'

import { annoyed, armOf, asBandit, asFamiliar, CREDIT_MS, daypartOf, logLine, momentCode, petted, pickFor, settle } from '../hooks/learning'
import type { Shown } from '../hooks/learning'
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

  test('the learned pick favours what earned pets, and says how often it would', () => {
    let bandit = {}
    for (let i = 0; i < 20; i++) {
      bandit = settle(bandit, petted([shown('juggle', i)], i), i + CREDIT_MS + 1).bandit
      bandit = settle(bandit, [shown('roast', i)], i + CREDIT_MS + 1).bandit
    }
    expect(mean(bandit, 'afternoon:cat:juggle', 100, 1e12)).toBeGreaterThan(0.9)
    const pick = pickFor(bandit, ['juggle', 'roast'], 'afternoon', 'cat', 100, seeded(1))
    expect(pick.activity).toBe('juggle')
    expect(pick.propensity).toBeGreaterThan(0.9)
    // Another daypart has learned nothing yet: a coin toss.
    const fresh = pickFor(bandit, ['juggle', 'roast'], 'night', 'cat', 100, seeded(1))
    // Nor has another pet, at the same time of day.
    const other = pickFor(bandit, ['juggle', 'roast'], 'afternoon', 'dragon', 100, seeded(1))
    expect(other.propensity > 0.3 && other.propensity < 0.7).toBe(true)
    expect(fresh.propensity > 0.3 && fresh.propensity < 0.7).toBe(true)
    // Even the unlikely pick logs a chance above 0, so it can be weighed back later.
    for (let seed = 0; seed < 50; seed++) {
      const any = pickFor(bandit, ['juggle', 'roast'], 'afternoon', 'cat', 100, seeded(seed))
      expect(any.propensity > 0 && any.propensity <= 1).toBe(true)
    }
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
    const kept = asFamiliar(JSON.parse(JSON.stringify(familiar)))
    const now = 31 * 60_000
    expect(novelty(kept, momentCode(15, 6, 9), now, 2 * 86_400_000)).toBeLessThan(novelty(kept, momentCode(3, 120, 30), now, 2 * 86_400_000))
    expect(asFamiliar({ 1: { level: 2, at: 0 }, 2: { level: 0.5, at: 'x' }, 3: { level: 0.5, at: 1 } })).toEqual({ 3: { level: 0.5, at: 1 } })
  })
})
