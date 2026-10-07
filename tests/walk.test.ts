import { describe, expect, test } from 'claude-code/testing'

import type { Random } from '../hooks/motion'
import { mirror } from '../hooks/render'
import { gather, walkStep } from '../hooks/walk'
import type { Plan, Walk } from '../hooks/walk'

const always = (value: number): Random => () => value

// Steps from `from` to `to` ticks and returns where the pet stood on each.
const trail = (plan: Plan, from: number, to: number, maxX: number, random: Random, start?: Walk) => {
  const xs: number[] = []
  let walk = start
  for (let tick = from; tick <= to; tick++) {
    walk = walkStep(walk, plan, tick, maxX, 1, random).walk
    xs.push(walk.x)
  }
  return { xs, walk }
}

describe('walkStep', () => {
  test('wandering walks one column a tick to a random spot, then rests', () => {
    const { xs, walk } = trail('wander', 0, 6, 10, always(0.4))
    expect(xs).toEqual([0, 1, 2, 3, 4, 4, 4])
    expect(walk?.facing).toBe(1)
  })

  test('it turns around to walk left', () => {
    const start: Walk = { x: 8, target: 8, facing: 1, restUntil: 0, tick: 0, moving: false }
    const { xs, walk } = trail('wander', 1, 3, 10, always(0.2), start)
    expect(xs).toEqual([7, 6, 5])
    expect(walk?.facing).toBe(-1)
  })

  test('it stays put when told', () => {
    const start: Walk = { x: 5, target: 9, facing: 1, restUntil: 0, tick: 0, moving: false }
    expect(trail('stay', 1, 3, 10, always(0), start).xs).toEqual([5, 5, 5])
  })

  test('a narrower stage pulls it back inside', () => {
    const start: Walk = { x: 20, target: 20, facing: 1, restUntil: 99, tick: 0, moving: false }
    expect(trail('stay', 1, 1, 6, always(0), start).xs).toEqual([6])
  })

  test('a stage that shrinks within a tick pulls it back on the second draw', () => {
    const steppedOnThisTick: Walk = { x: 40, target: 40, facing: 1, restUntil: 0, tick: 1, moving: false }
    expect(walkStep(steppedOnThisTick, 'stay', 1, 10, 1, always(0)).walk.x).toBe(10)
  })

  test('stepping twice on one tick moves once, and both draws show it walking', () => {
    const first = walkStep({ x: 0, target: 5, facing: 1, restUntil: 0, tick: 0, moving: false }, 'wander', 1, 10, 1, always(0))
    const again = walkStep(first.walk, 'wander', 1, 10, 1, always(0))
    expect(again.walk.x).toBe(1)
    expect(again.moving).toBe(true)
  })
})

describe('gather', () => {
  // 10-column agents on a 50-column stage.
  test('in the middle they take turns on both sides, nearest first', () => {
    expect(gather(25, 50, 4, 10, 0)).toEqual({ x: 25, left: [1, 3], right: [0, 2], more: 1 })
  })

  test('near a corner they fill the open side', () => {
    expect(gather(5, 50, 3, 10, 0)).toEqual({ x: 5, left: [], right: [0, 1, 2], more: 1 })
    expect(gather(48, 50, 3, 10, 0)).toEqual({ x: 48, left: [0, 1, 2], right: [], more: 1 })
  })

  test('the "+N" goes where room is left', () => {
    expect(gather(5, 50, 4, 10, 4).more).toBe(1)
    expect(gather(46, 50, 4, 10, 4).more).toBe(-1)
  })

  test('each keeps the side it stood on while it fits there', () => {
    expect(gather(25, 50, 2, 10, 0, [-1, -1])).toEqual({ x: 25, left: [0, 1], right: [], more: 1 })
  })

  test('when they do not fit around it, it steps the least it must', () => {
    // 15 columns free on each side hold no 20-column agent; 5 steps left free 20 on its right.
    expect(gather(15, 30, 1, 20, 0)).toEqual({ x: 10, left: [], right: [0], more: 1 })
  })

  test('alone it stays where it is', () => {
    expect(gather(7, -3, 0, 10, 0)).toEqual({ x: 7, left: [], right: [], more: 1 })
  })
})

test('mirror flips a frame left to right', () => {
  expect(mirror(['ab.', '.cd'])).toEqual(['.ba', 'dc.'])
})
