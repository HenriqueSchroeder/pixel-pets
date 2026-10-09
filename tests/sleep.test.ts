import { describe, expect, test } from 'claude-code/testing'

import { DEEP_SLEEP_MS, isDeep } from '../hooks/sleep'

const MINUTE = 60_000
const SECOND = 1000
const SEEDS = [0, 1, 42, 1_768_496_400_000, 1_768_500_000_123]

// The phases of one idle stretch from DEEP_SLEEP_MS on, sampled every second
// up to `until`, as [deep, minutes] runs; the last run is cut off by `until`.
const runs = (idleSince: number, until: number) => {
  const found: [boolean, number][] = []
  for (let at = DEEP_SLEEP_MS + SECOND; at <= until; at += SECOND) {
    const deep = isDeep(idleSince, at)
    const last = found[found.length - 1]
    if (last !== undefined && last[0] === deep) last[1] += SECOND / MINUTE
    else found.push([deep, SECOND / MINUTE])
  }
  return found
}

describe('isDeep', () => {
  test('the first ten minutes are a light sleep', () => {
    for (const seed of SEEDS) {
      expect(isDeep(seed, 0)).toBe(false)
      expect(isDeep(seed, DEEP_SLEEP_MS)).toBe(false)
    }
  })

  test('it sinks into a deep sleep right after, for eight minutes at least', () => {
    for (const seed of SEEDS) {
      expect(isDeep(seed, DEEP_SLEEP_MS + 1)).toBe(true)
      expect(isDeep(seed, DEEP_SLEEP_MS + 8 * MINUTE)).toBe(true)
    }
  })

  test('deep spells last 8 to 15 minutes and light ones 3 to 6, turn about', () => {
    for (const seed of SEEDS) {
      const found = runs(seed, 3 * 60 * MINUTE).slice(0, -1)
      expect(found.length).toBeGreaterThan(4)
      found.forEach(([deep, minutes], index) => {
        expect(deep).toBe(index % 2 === 0)
        const [min, max] = deep ? [8, 15] : [3, 6]
        expect(minutes).toBeGreaterThanOrEqual(min - 1 / 60)
        expect(minutes).toBeLessThanOrEqual(max + 1 / 60)
      })
    }
  })

  test('the same stretch always sleeps the same way; another one differently', () => {
    const one = runs(SEEDS[3] ?? 0, 2 * 60 * MINUTE)
    expect(runs(SEEDS[3] ?? 0, 2 * 60 * MINUTE)).toEqual(one)
    expect(runs(SEEDS[4] ?? 0, 2 * 60 * MINUTE)).not.toEqual(one)
  })

  test('hours in, its sleep still turns light now and then', () => {
    for (const seed of SEEDS) {
      let light = false
      for (let at = 5 * 60 * MINUTE; at <= 6 * 60 * MINUTE && !light; at += 30 * SECOND) light = !isDeep(seed, at)
      expect(light).toBe(true)
    }
  })
})
