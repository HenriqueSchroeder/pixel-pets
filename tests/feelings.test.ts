import { describe, expect, test } from 'claude-code/testing'

import { calm, cheer, feel, idleMood, isMorning, isNight, settle } from '../hooks/feelings'
import type { Feelings } from '../types'

const MINUTE = 60_000
const NOON = 12

describe('feelings', () => {
  test('failures worry it, a turn that goes well brings pride and eases worry', () => {
    let felt = feel(calm, 'toolFailed', 0)
    felt = feel(felt, 'turnFailed', 0)
    expect(felt).toEqual({ worry: 3, pride: 0, at: 0 })
    expect(feel(felt, 'turnOk', 0)).toEqual({ worry: 2, pride: 1, at: 0 })
  })

  test('a failed turn ends a streak of pride; a failed tool does not', () => {
    const proud: Feelings = { worry: 0, pride: 4, at: 0 }
    expect(feel(proud, 'toolFailed', 0).pride).toBe(4)
    expect(feel(proud, 'turnFailed', 0).pride).toBe(0)
  })

  test('each feeling fades a point every five minutes', () => {
    const felt: Feelings = { worry: 3, pride: 1, at: 0 }
    expect(settle(felt, 4 * MINUTE)).toBe(felt)
    expect(settle(felt, 10 * MINUTE)).toEqual({ worry: 1, pride: 0, at: 10 * MINUTE })
  })

  test('the strongest feeling stands in for idle', () => {
    expect(idleMood({ worry: 6, pride: 0, at: 0 }, 0, 0, NOON)).toBe('grumpy')
    expect(idleMood({ worry: 3, pride: 5, at: 0 }, 0, 0, NOON)).toBe('worried')
    expect(idleMood(calm, 3 * 60 * MINUTE, 0, NOON)).toBe('tired')
    expect(idleMood({ worry: 0, pride: 3, at: 0 }, 0, 0, NOON)).toBe('proud')
    expect(idleMood({ worry: 1, pride: 3, at: 0 }, 0, 0, NOON)).toBeUndefined()
    expect(idleMood(calm, 0, 0, 23)).toBe('sleepy')
    expect(idleMood(calm, 0, null, NOON)).toBeUndefined()
  })

  test('a turn cheers only once the agents are done, and plain work only now and then', () => {
    const work = { tookLong: false, tools: 3, agentsDone: false, agentsLeft: 0 }
    const lucky = () => 0
    const unlucky = () => 0.99
    expect(cheer(work, lucky)).toBe('happy')
    expect(cheer(work, unlucky)).toBeNull()
    expect(cheer({ ...work, tools: 0 }, lucky)).toBeNull()
    expect(cheer({ ...work, tookLong: true }, unlucky)).toBe('celebrating')
    expect(cheer({ ...work, tools: 0, agentsDone: true }, unlucky)).toBe('happy')
    expect(cheer({ ...work, tookLong: true, agentsDone: true, agentsLeft: 1 }, lucky)).toBeNull()
  })

  test('night runs from 22h to 6h, morning from 5h to 11h', () => {
    expect([21, 22, 3, 5, 6].map(isNight)).toEqual([false, true, true, true, false])
    expect([4, 5, 10, 11].map(isMorning)).toEqual([false, true, true, false])
  })
})
