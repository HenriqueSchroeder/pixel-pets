import { describe, expect, test } from 'claude-code/testing'

import type { Random } from '../hooks/motion'
import { mirror } from '../hooks/render'
import { EMPTY_STAGE, faceFor, gather, holdFacing, layoutAt, moveOnStage, onTheWay, walkStep } from '../hooks/walk'
import type { Stage } from '../hooks/walk'
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

describe('a long stroll', () => {
  // Calls to random in turn: a far spot, a break, then a short look around.
  const inTurn = (...values: number[]): Random => {
    let i = 0
    return () => values[i++ % values.length] ?? 0
  }

  test('breaks halfway now and then for a short look around, then goes on', () => {
    const { xs } = trail('wander', 1, 24, 40, inTurn(0.9, 0.1, 0.5), { x: 0, target: 0, facing: 1, restUntil: 0, tick: 0, moving: false })
    // 36 is the spot, 18 the break: there it looks around for 2 ticks, then walks on.
    expect(xs.slice(16, 21)).toEqual([17, 18, 18, 19, 20])
  })

  test('a pet that teleports lands there at once, and never breaks', () => {
    const blink = { rest: 1, lean: 0, stride: Infinity }
    const start: Walk = { x: 0, target: 0, facing: 1, restUntil: 0, tick: 0, moving: false }
    const landed = walkStep(start, 'wander', 1, 40, 1, inTurn(0.9, 0.1, 0.5), blink).walk
    expect(landed).toMatchObject({ x: 36, target: 36, facing: 1 })
    expect(landed.onward).toBeUndefined()
    expect(walkStep(start, { go: 20 }, 1, 40, 1, inTurn(0), blink).walk.x).toBe(20)
  })

  test('a short stroll never breaks', () => {
    const { xs } = trail('wander', 1, 6, 10, inTurn(0.5, 0), { x: 0, target: 0, facing: 1, restUntil: 0, tick: 0, moving: false })
    expect(xs).toEqual([1, 2, 3, 4, 5, 5])
  })
})

describe('pace', () => {
  const resting: Walk = { x: 0, target: 0, facing: 1, restUntil: 0, tick: 0, moving: false }

  test('leaning draws its spots toward the left', () => {
    expect(walkStep(resting, 'wander', 1, 10, 1, always(0.5)).walk.target).toBe(5)
    expect(walkStep(resting, 'wander', 1, 10, 1, always(0.5), { rest: 1, lean: 1 }).walk.target).toBe(1)
  })

  test('a slower pace rests longer once it gets there', () => {
    const near: Walk = { ...resting, target: 1 }
    // 3 to 10 seconds at half: 6.5 s, rounded to 7, from tick 1.
    expect(walkStep(near, 'wander', 1, 10, 1, always(0.5)).walk.restUntil).toBe(8)
    expect(walkStep(near, 'wander', 1, 10, 1, always(0.5), { rest: 2, lean: 0 }).walk.restUntil).toBe(14)
  })
})

describe('going somewhere', () => {
  test('it hurries two columns a tick to the spot and stays there', () => {
    const start: Walk = { x: 0, target: 0, facing: 1, restUntil: 0, tick: 0, moving: false }
    expect(trail({ go: 7 }, 1, 5, 10, always(0), start).xs).toEqual([2, 4, 6, 7, 7])
  })

  test('a spot past the stage stops at its edge', () => {
    const start: Walk = { x: 0, target: 0, facing: 1, restUntil: 0, tick: 0, moving: false }
    expect(trail({ go: 50 }, 1, 3, 4, always(0), start).xs).toEqual([2, 4, 4])
  })
})

describe('layoutAt', () => {
  test('lays them out where the pet stands, or not at all', () => {
    expect(layoutAt(15, 30, 1, 20, 0)).toBeUndefined()
    expect(layoutAt(10, 30, 1, 20, 0)).toEqual({ x: 10, left: [], right: [0], more: 1 })
  })
})

describe('onTheWay', () => {
  // Beside a pet at 25 on a 30-column stage two 10-column agents fit on its left; a third needs it at 20.
  const placed = gather(25, 30, 3, 10, 0)

  test('on its way, only the agents that already fit around it show', () => {
    expect(placed.x).toBe(20)
    expect(onTheWay(25, placed, 30, 3, 10)).toEqual({ x: 25, left: [0, 1], right: [], more: 1 })
  })

  test('when only the "+N" sent it off, all of them stay on the way', () => {
    // Two 21-column agents fill the left of a pet at 43 on a 46-column stage: the "+N" needs it at 42.
    const tight = gather(43, 46, 2, 21, 4, [-1, -1])
    expect(tight.x).toBe(42)
    expect(onTheWay(43, tight, 46, 2, 21, [-1, -1])).toEqual({ x: 43, left: [0, 1], right: [], more: 1 })
  })

  test('none show while none fit yet', () => {
    expect(onTheWay(15, gather(15, 30, 1, 20, 0), 30, 1, 20)).toEqual({ x: 15, left: [], right: [], more: 1 })
  })

  test('all show once it gets there', () => {
    expect(onTheWay(placed.x, placed, 30, 3, 10)).toBe(placed)
  })
})

describe('holdFacing', () => {
  test('through an action it keeps the way it faced as the action began', () => {
    const began = holdFacing(undefined, { start: 10 }, 1)
    expect(began.side).toBe(1)
    // An agent comes on its left mid-action: it does not turn.
    expect(holdFacing(began.held, { start: 10 }, -1).side).toBe(1)
  })

  test('a new action faces anew, and with none it faces as it would', () => {
    const began = holdFacing(undefined, { start: 10 }, 1)
    expect(holdFacing(began.held, { start: 20 }, -1).side).toBe(-1)
    expect(holdFacing(began.held, undefined, -1)).toEqual({ held: undefined, side: -1 })
  })
})

describe('faceFor', () => {
  const around = { x: 20, left: [1], right: [0, 2], more: 1 as const }

  test('it faces the way it walks', () => {
    expect(faceFor(true, -1, around, 0)).toBe(-1)
  })

  test('standing, it faces the agent it looks at', () => {
    expect(faceFor(false, -1, around, 0)).toBe(1)
    expect(faceFor(false, 1, around, 1)).toBe(-1)
  })

  test('with no agent drawn, it keeps its way', () => {
    expect(faceFor(false, -1, { x: 0, left: [], right: [], more: 1 }, 0)).toBe(-1)
  })
})

describe('moveOnStage', () => {
  test('a teleport vanishes where it stood, appears where it landed, then is done', () => {
    let stage: Stage = EMPTY_STAGE
    const seen: string[] = []
    for (let tick = 0; tick <= 4; tick++) {
      const moved = moveOnStage(stage, {
        tick,
        room: 40,
        fps: 1,
        random: always(0.9),
        pace: { rest: 1, lean: 0 },
        walks: false,
        teleport: { vanish: 2, appear: 1 },
        agents: [],
        width: 10,
        extra: 0,
        wants: () => 'wander',
      })
      stage = moved.stage
      seen.push(`${moved.blinking?.phase ?? '-'}@${moved.standX}`)
    }
    // It lands on 36 at tick 1, but shows where it was until it has vanished.
    expect(seen).toEqual(['-@0', 'vanish@0', 'vanish@0', 'appear@36', '-@36'])
  })
})

test('mirror flips a frame left to right', () => {
  expect(mirror(['ab.', '.cd'])).toEqual(['.ba', 'dc.'])
})
