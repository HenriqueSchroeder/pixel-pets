import { describe, expect, test } from 'claude-code/testing'

import { arrived, asRhythm, expects } from '../hooks/rhythm'
import type { Rhythm } from '../hooks/rhythm'

// Local times. 2026-03-02 is a Monday.
const on = (day: number, hour: number, minute = 0) => new Date(2026, 2, day, hour, minute).getTime()

// Arrives at 9:10 every weekday of two weeks.
const habit = () => {
  let rhythm: Rhythm = {}
  for (const day of [2, 3, 4, 5, 6, 9, 10, 11, 12, 13]) rhythm = arrived(rhythm, on(day, 9, 10))
  return rhythm
}

describe('rhythm', () => {
  test('a habit is waited for from a quarter of an hour before its half hour, through it', () => {
    const rhythm = habit()
    expect(expects(rhythm, on(16, 8, 40))).toBe(false)
    expect(expects(rhythm, on(16, 8, 50))).toBe(true)
    expect(expects(rhythm, on(16, 9, 10))).toBe(true)
    expect(expects(rhythm, on(16, 9, 20))).toBe(false)
  })

  test('a weekday habit is not waited for on a weekend', () => {
    expect(expects(habit(), on(14, 8, 50))).toBe(false)
  })

  test('one arrival is no habit, and an old habit fades away', () => {
    expect(expects(arrived({}, on(2, 9, 10)), on(3, 8, 50))).toBe(false)
    expect(expects(habit(), on(13 + 60, 8, 50))).toBe(false)
  })

  test('a rare half hour beside a busy one is no habit', () => {
    // Twice at 16:10 against ten times at 9:10.
    const rhythm = arrived(arrived(habit(), on(12, 16, 10)), on(13, 16, 10))
    expect(expects(rhythm, on(16, 15, 50))).toBe(false)
    expect(expects(rhythm, on(16, 8, 50))).toBe(true)
  })

  test('survives the store, and only well-formed counts come back', () => {
    const rhythm = habit()
    expect(expects(asRhythm(JSON.parse(JSON.stringify(rhythm))), on(16, 8, 50))).toBe(true)
    expect(asRhythm({ 'weekday:18': { count: 2, at: 0 }, 'monday:18': { count: 2, at: 0 }, 'weekend:3': { count: -1, at: 0 }, 'weekday:4': null })).toEqual({
      'weekday:18': { count: 2, at: 0 },
    })
    expect(asRhythm([])).toEqual({})
  })
})
