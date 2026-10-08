import type { Random } from './motion'

// Where the main pet stands on the stage, in columns from its left edge, and
// where it is heading. Kept between draws like Motion.
export type Walk = {
  x: number
  target: number
  facing: 1 | -1
  // While wandering, the tick before which it stays put after arriving.
  restUntil: number
  // The tick this walk was last stepped on: a second draw on it changes nothing.
  tick: number
  // Whether it took a step on that tick, so a second draw shows it walking too.
  moving: boolean
  // Where a stroll it broke halfway goes on to, after a short look around.
  onward?: number
}

// wander: stroll to a random spot now and then. stay: hold still. go: hurry to a spot.
export type Plan = 'wander' | 'stay' | { go: number }

const COLUMNS_PER_TICK = 1
const HURRY_COLUMNS_PER_TICK = 2
const REST_SECONDS: [number, number] = [3, 10]
// A stroll this long breaks halfway now and then, for a look around this long.
const BREAK_FROM_COLUMNS = 12
const BREAK_CHANCE = 0.3
const LOOK_SECONDS: [number, number] = [1, 2]

// How it strolls: `rest` stretches the pauses, `lean` (0 to 1) draws its spots
// toward the left, where the prompt starts, and `stride` sets the columns a tick
// in place of the usual walk: Infinity lands it there at once, as a teleport.
export type Pace = { rest: number; lean: number; stride?: number }

const EVEN: Pace = { rest: 1, lean: 0 }

export const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0))

// Moves the pet one tick along `plan`; `moving` is true when it took a step.
export const walkStep = (
  walk: Walk | undefined,
  plan: Plan,
  tick: number,
  maxX: number,
  fps: number,
  random: Random,
  pace: Pace = EVEN,
): { walk: Walk; moving: boolean } => {
  if (walk === undefined) return { walk: { x: 0, target: 0, facing: 1, restUntil: tick, tick, moving: false }, moving: false }
  const x = clamp(walk.x, maxX)
  // A second draw on this tick only keeps it inside a stage that shrank since.
  if (walk.tick === tick) return { walk: { ...walk, x }, moving: walk.moving }

  const pause = ([min, max]: [number, number], scale: number) => tick + Math.round((min + (max - min) * random()) * scale * fps)
  let { target, facing, restUntil, onward } = walk
  target = clamp(target, maxX)

  if (plan !== 'wander') onward = undefined
  if (plan === 'stay') target = x
  else if (typeof plan === 'object') target = clamp(plan.go, maxX)
  else if (x === target && tick >= restUntil) {
    if (onward !== undefined) {
      target = clamp(onward, maxX)
      onward = undefined
    } else {
      target = Math.round(random() ** (1 + 2 * pace.lean) * maxX)
      const breaks = pace.stride === undefined && Math.abs(target - x) >= BREAK_FROM_COLUMNS
      if (breaks && random() < BREAK_CHANCE) {
        onward = target
        target = Math.round((x + target) / 2)
      }
    }
    if (target === x) restUntil = pause(REST_SECONDS, pace.rest)
  }

  if (x === target) return { walk: { x, target, facing, restUntil, tick, moving: false, onward }, moving: false }

  const direction = target > x ? 1 : -1
  const speed = pace.stride ?? (typeof plan === 'object' ? HURRY_COLUMNS_PER_TICK : COLUMNS_PER_TICK)
  const next = x + direction * Math.min(speed, Math.abs(target - x))
  if (next === target && plan === 'wander') restUntil = onward === undefined ? pause(REST_SECONDS, pace.rest) : pause(LOOK_SECONDS, 1)
  return { walk: { x: next, target, facing: direction, restUntil, tick, moving: true, onward }, moving: true }
}

export type Side = 1 | -1

// Where the subagents' pets stand around the main one, by their index: each
// side's list runs from nearest to farthest. `more` is the side of the "+N".
export type Gathering = { x: number; left: number[]; right: number[]; more: Side }

// Gathers `count` agents, `width` columns each, plus `extra` columns for a "+N",
// in the free room on both sides of a pet standing at `at`: each on the side it
// stood on before (`sides[i]`) while it fits there, else on the side with more
// room left. undefined when they do not all fit there.
export const layoutAt = (
  at: number,
  room: number,
  count: number,
  width: number,
  extra: number,
  sides: readonly (Side | undefined)[] = [],
): Gathering | undefined => {
  const free = { [-1]: at, [1]: room - at }
  const take = (need: number, wanted?: Side): Side | undefined => {
    const first: Side = wanted ?? (free[1] >= free[-1] ? 1 : -1)
    const side = ([first, -first] as Side[]).find(one => free[one] >= need)
    if (side !== undefined) free[side] -= need
    return side
  }
  const out: Gathering = { x: at, left: [], right: [], more: 1 }
  for (let i = 0; i < count; i++) {
    const side = take(width, sides[i])
    if (side === undefined) return undefined
    ;(side === 1 ? out.right : out.left).push(i)
  }
  if (extra > 0) {
    const side = take(extra)
    if (side === undefined) return undefined
    out.more = side
  }
  return out
}

// Gathers them as `layoutAt` does, where the pet stands; when they do not fit
// there, at the nearest spot where they do.
export const gather = (
  x: number,
  room: number,
  count: number,
  width: number,
  extra: number,
  sides: readonly (Side | undefined)[] = [],
): Gathering => {
  for (let step = 0; step <= Math.max(room, 0); step++) {
    for (const at of [x - step, x + step]) {
      const found = at >= 0 && at <= room ? layoutAt(at, room, count, width, extra, sides) : undefined
      if (found !== undefined) return found
    }
  }
  return { x, left: [], right: [], more: 1 }
}

// The side agent `index` stands on.
export const sideIn = (drawn: Gathering, index: number): Side => (drawn.right.includes(index) ? 1 : -1)

// Which way it faces: the way it walks, else toward the drawn agent `at`.
export const faceFor = (moving: boolean, facing: Side, drawn: Gathering, at: number): Side =>
  moving || drawn.left.length + drawn.right.length === 0 ? facing : sideIn(drawn, at)

// Who shows while the pet is on its way to `placed`: all of them once it stands
// there, else as many as already fit around `x`, with no room kept for a "+N".
export const onTheWay = (
  x: number,
  placed: Gathering,
  room: number,
  count: number,
  width: number,
  sides: readonly (Side | undefined)[] = [],
): Gathering => {
  if (x === placed.x) return placed
  // All of them may fit already when only the "+N" sent it off.
  for (let shown = count; shown > 0; shown--) {
    const found = layoutAt(x, room, shown, width, 0, sides)
    if (found !== undefined) return found
  }
  return { x, left: [], right: [], more: 1 }
}

// What the band keeps between draws about the main pet's spot: where it stands,
// the teleport it is in the middle of, and the side each agent stood on.
export type Stage = { walk?: Walk; blink?: { from: number; start: number }; sides: ReadonlyMap<string, Side> }

export const EMPTY_STAGE: Stage = { sides: new Map() }

type Scene = {
  tick: number
  room: number
  fps: number
  random: Random
  pace: Pace
  walks: boolean
  // The frames of its teleport, as counts; null for a pet that walks or draws none.
  teleport: { vanish: number; appear: number } | null
  // The agents to stand around it, by id, `width` columns each, plus `extra` for a "+N".
  agents: readonly string[]
  width: number
  extra: number
  // What it wants this tick, given where the agents would gather.
  wants: (placed: Gathering) => Plan
}

// Moves the main pet one tick and lays its agents out around it, as the band
// draws them: it walks, or teleports, or is set down where they fit, and the
// agents that do not fit yet join once it gets there. One teleport plays out
// before it goes anywhere else; `blinking` is how far into it this tick is.
export const moveOnStage = (stage: Stage, scene: Scene) => {
  const { tick, room, teleport, agents } = scene
  const sides = agents.map(id => stage.sides.get(id))
  const from = clamp(stage.walk?.x ?? 0, room)
  const placed = gather(from, room, agents.length, scene.width, scene.extra, sides)
  const wants = scene.wants(placed)
  const moves = scene.walks || teleport !== null
  const pace = teleport === null ? scene.pace : { ...scene.pace, stride: Infinity }
  const walked = walkStep(stage.walk, moves && stage.blink === undefined ? wants : 'stay', tick, room, scene.fps, scene.random, pace)
  // A pet that does neither is set down where they fit.
  const walk = moves || placed.x === walked.walk.x ? walked.walk : { ...walked.walk, x: placed.x, target: placed.x }

  let blink = stage.blink ?? (teleport !== null && walked.moving ? { from, start: tick } : undefined)
  // Where it shows: where it vanishes from until it is gone, then where it lands.
  let standX = walk.x
  let blinking: { phase: 'vanish' | 'appear'; at: number } | undefined
  if (teleport !== null && blink !== undefined) {
    const at = tick - blink.start
    if (at < teleport.vanish) {
      blinking = { phase: 'vanish', at }
      standX = clamp(blink.from, room)
    } else if (at < teleport.vanish + teleport.appear) blinking = { phase: 'appear', at: at - teleport.vanish }
    else blink = undefined
  }

  const drawn = onTheWay(standX, placed, room, agents.length, scene.width, sides)
  const drawnCount = drawn.left.length + drawn.right.length
  // One not drawn yet keeps the side it had, so it does not hop over once it shows.
  const kept = new Map(
    agents.flatMap((id, i): [string, Side][] => {
      const side = i < drawnCount ? sideIn(drawn, i) : stage.sides.get(id)
      return side === undefined ? [] : [[id, side]]
    }),
  )
  return { stage: { walk, blink, sides: kept }, wants, placed, drawn, drawnCount, standX, moving: walked.moving, blinking }
}
