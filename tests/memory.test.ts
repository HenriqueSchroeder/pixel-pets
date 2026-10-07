import { describe, expect, test } from 'claude-code/testing'

import { asVisit, daysBetween, isAnniversary, welcome } from '../hooks/memory'

// Local times, so days count the same on any machine.
const at = (day: number, hour = 14) => new Date(2026, 0, day, hour, 0).getTime()

describe('memory', () => {
  test('days are counted by the calendar, not by 24 hours', () => {
    expect(daysBetween(at(1, 23), at(2, 1))).toBe(1)
    expect(daysBetween(at(1, 1), at(1, 23))).toBe(0)
  })

  test('anniversaries fall on a week, a month, 100 days and every year', () => {
    expect([7, 30, 100, 365, 730].every(isAnniversary)).toBe(true)
    expect([0, 1, 8, 364].some(isAnniversary)).toBe(false)
  })

  test('a session opens with one welcome: anniversary, then missing you, then good morning', () => {
    expect(welcome({ metAt: at(1), lastSeenAt: at(3) }, at(8), 9)).toEqual({ kind: 'anniversary', days: 7 })
    expect(welcome({ metAt: at(1), lastSeenAt: at(3) }, at(5), 9)).toEqual({ kind: 'missedYou' })
    expect(welcome({ metAt: at(1), lastSeenAt: at(4) }, at(5), 9)).toEqual({ kind: 'goodMorning' })
    expect(welcome({ metAt: at(1), lastSeenAt: at(4) }, at(5), 15)).toBeUndefined()
    expect(welcome(undefined, at(5), 9)).toEqual({ kind: 'goodMorning' })
  })

  test('seen already today, the welcome is spent', () => {
    expect(welcome({ metAt: at(1), lastSeenAt: at(8, 7) }, at(8, 9), 9)).toBeUndefined()
  })

  test('only a well-formed visit is remembered', () => {
    expect(asVisit({ metAt: 1, lastSeenAt: 2 })).toEqual({ metAt: 1, lastSeenAt: 2 })
    expect(asVisit('Wed Oct 07 2026')).toBeUndefined()
    expect(asVisit({ metAt: '1', lastSeenAt: 2 })).toBeUndefined()
  })
})
