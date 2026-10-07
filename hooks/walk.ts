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
}

// wander: stroll to a random spot now and then. stay: hold still.
export type Plan = 'wander' | 'stay'

const COLUMNS_PER_TICK = 1
const REST_SECONDS: [number, number] = [3, 10]

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0))

// Moves the pet one tick along `plan`; `moving` is true when it took a step.
export const walkStep = (
  walk: Walk | undefined,
  plan: Plan,
  tick: number,
  maxX: number,
  fps: number,
  random: Random,
): { walk: Walk; moving: boolean } => {
  if (walk === undefined) return { walk: { x: 0, target: 0, facing: 1, restUntil: tick, tick, moving: false }, moving: false }
  const x = clamp(walk.x, maxX)
  // A second draw on this tick only keeps it inside a stage that shrank since.
  if (walk.tick === tick) return { walk: { ...walk, x }, moving: walk.moving }

  const rest = () => tick + Math.round((REST_SECONDS[0] + (REST_SECONDS[1] - REST_SECONDS[0]) * random()) * fps)
  let { target, facing, restUntil } = walk
  target = clamp(target, maxX)

  if (plan === 'stay') target = x
  else if (x === target && tick >= restUntil) {
    target = Math.round(random() * maxX)
    if (target === x) restUntil = rest()
  }

  if (x === target) return { walk: { x, target, facing, restUntil, tick, moving: false }, moving: false }

  const direction = target > x ? 1 : -1
  const next = x + direction * Math.min(COLUMNS_PER_TICK, Math.abs(target - x))
  if (next === target && plan === 'wander') restUntil = rest()
  return { walk: { x: next, target, facing: direction, restUntil, tick, moving: true }, moving: true }
}

export type Side = 1 | -1

// Where the subagents' pets stand around the main one, by their index: each
// side's list runs from nearest to farthest. `more` is the side of the "+N".
export type Gathering = { x: number; left: number[]; right: number[]; more: Side }

// Gathers `count` agents, `width` columns each, plus `extra` columns for a "+N",
// in the free room on both sides of the pet: each on the side it stood on before
// (`sides[i]`) while it fits there, else on the side with more room left. When
// they do not fit around where the pet stands, it steps the least it must.
export const gather = (
  x: number,
  room: number,
  count: number,
  width: number,
  extra: number,
  sides: readonly (Side | undefined)[] = [],
): Gathering => {
  const around = (at: number): Gathering | undefined => {
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
  for (let step = 0; step <= Math.max(room, 0); step++) {
    for (const at of [x - step, x + step]) {
      const found = at >= 0 && at <= room ? around(at) : undefined
      if (found !== undefined) return found
    }
  }
  return { x, left: [], right: [], more: 1 }
}
