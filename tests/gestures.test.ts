import { describe, expect, test } from 'claude-code/testing'

import { ANNOY_MS, gazes, hover, leave, press, untouched } from '../hooks/gestures'
import type { Touch } from '../hooks/gestures'

const clicks = (times: number[], sleep: 'awake' | 'dozing' | 'deep' = 'awake') => {
  let touch: Touch = untouched
  return times.map(now => {
    const pressed = press(touch, now, sleep)
    touch = pressed.touch
    return pressed.poke
  })
}

describe('press', () => {
  test('a click pets it awake, wakes it dozing and rouses it fast asleep', () => {
    expect(clicks([0])).toEqual(['pet'])
    expect(clicks([0], 'dozing')).toEqual(['wake'])
    expect(clicks([0], 'deep')).toEqual(['rouse'])
  })

  test('the fourth click within three seconds annoys it, and it ignores clicks for a while', () => {
    expect(clicks([0, 500, 1000, 1500, 2000, 1500 + ANNOY_MS])).toEqual(['pet', 'pet', 'pet', 'annoy', 'ignore', 'pet'])
  })

  test('as many clicks spread out never annoy it', () => {
    expect(clicks([0, 1500, 3000, 4500, 6000])).toEqual(['pet', 'pet', 'pet', 'pet', 'pet'])
  })
})

describe('gazes', () => {
  test('it looks back once the pointer has rested on it half a second, until it leaves', () => {
    const over = hover(untouched, 1000)
    expect(gazes(over, 1400)).toBe(false)
    expect(gazes(hover(over, 1400), 1500)).toBe(true)
    expect(gazes(leave(over), 2000)).toBe(false)
  })
})
