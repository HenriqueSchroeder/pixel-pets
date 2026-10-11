import { describe, expect, test } from 'claude-code/testing'

import { alertness, drift, engaged, misses, paceOf, rested, seen, stirred, stirs, urgeOf } from '../hooks/drives'
import type { Drives } from '../hooks/drives'
import type { Traits } from '../types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe('drives', () => {
  test('sleep fills energy, work drains it faster than staying up, always within [0, 1]', () => {
    expect(drift({ ...rested(0), energy: 0.25 }, HOUR, 'asleep').energy).toBe(0.75)
    expect(drift(rested(0), 2 * HOUR, 'working').energy).toBe(0.5)
    expect(drift(rested(0), 5 * HOUR, 'awake').energy).toBe(0.5)
    expect(drift(rested(0), 10 * HOUR, 'asleep').energy).toBe(1)
    expect(drift(rested(0), 10 * HOUR, 'working').energy).toBe(0)
  })

  test('boredom builds with nothing to do, never while Claude works', () => {
    expect(drift(rested(0), 15 * MINUTE, 'awake').boredom).toBe(1)
    expect(drift(rested(0), 15 * MINUTE, 'asleep').boredom).toBe(1)
    expect(drift(rested(0), 15 * MINUTE, 'working').boredom).toBe(0)
  })

  test('longing builds while the person is away, even as Claude works', () => {
    expect(drift(rested(0), 30 * MINUTE, 'working').longing).toBe(0.5)
  })

  test('how it is made sets how fast it tires, gets bored and misses the person', () => {
    const lively: Traits = { energetic: 1, curious: 1, affectionate: 0 }
    const after = drift(rested(0), HOUR, 'working', lively)
    expect(after.energy).toBe(0.875)
    expect(drift(rested(0), 6 * MINUTE, 'awake', lively).boredom).toBe(0.8)
    expect(after.longing).toBe(0)
    // Sleep fills energy the same for every pet.
    expect(drift({ ...rested(0), energy: 0 }, HOUR, 'asleep', lively).energy).toBe(0.5)
  })

  test('the usual traits change nothing', () => {
    const usual: Traits = { energetic: 0.5, curious: 0.5, affectionate: 0.5 }
    expect(drift(rested(0), HOUR, 'awake', usual)).toEqual(drift(rested(0), HOUR, 'awake'))
  })

  test('no time passed, nothing changes', () => {
    const now = rested(5)
    expect(drift(now, 5, 'awake')).toBe(now)
  })

  test('a turn ends boredom; the person ends boredom and longing', () => {
    const wanting: Drives = { energy: 0.5, boredom: 0.8, longing: 0.9, at: 0 }
    expect(engaged(wanting)).toEqual({ energy: 0.5, boredom: 0, longing: 0.9, at: 0 })
    expect(seen(wanting)).toEqual({ energy: 0.5, boredom: 0, longing: 0, at: 0 })
    expect(stirred(wanting)).toEqual({ energy: 0.5, boredom: 0, longing: 0.9, at: 0 })
  })

  test('it stays up its usual time until energy runs low', () => {
    expect(alertness({ ...rested(0), energy: 0.5 })).toBe(1)
    expect(alertness({ ...rested(0), energy: 0.25 })).toBe(0.5)
    expect(alertness({ ...rested(0), energy: 0 })).toBe(0.25)
  })

  test('a tired pet rests longer between strolls; one that misses the person keeps near the prompt', () => {
    expect(paceOf(rested(0))).toEqual({ rest: 1, lean: 0 })
    expect(paceOf({ ...rested(0), energy: 0.25, longing: 0.75 })).toEqual({ rest: 1.5, lean: 0.75 })
    expect(paceOf({ ...rested(0), energy: 0 }).rest).toBe(2)
  })

  test('half an hour away, it has missed the person', () => {
    expect(misses(drift(rested(0), 20 * MINUTE, 'awake'))).toBe(false)
    expect(misses(drift(rested(0), 30 * MINUTE, 'awake'))).toBe(true)
  })

  test('bored enough and not too tired, it gets up on its own', () => {
    expect(stirs({ ...rested(0), boredom: 0.4 })).toBe(true)
    expect(stirs({ ...rested(0), boredom: 0.4, energy: 0.3 })).toBe(false)
    expect(stirs({ ...rested(0), boredom: 0.2 })).toBe(false)
  })

  test('at work, a tired pet flags before it misses the person, else it finds something to do', () => {
    expect(urgeOf({ ...rested(0), energy: 0.3, longing: 0.9 })).toBe('tired')
    expect(urgeOf({ ...rested(0), longing: 0.6 })).toBe('longing')
    expect(urgeOf({ ...rested(0), energy: 0.5, longing: 0.2, boredom: 1 })).toBe('bored')
  })
})
