import type { Frame, Mood } from '../types'
import type { Action, Pack } from './pack'

// What the main pet is playing. Kept between draws so a loop runs from its own
// start and a one-off finishes before the loop picks up again.
export type Motion = {
  // The pack its frames are from: another pet's motion starts over.
  pack: Pack
  mood: Mood
  loop: Frame[]
  // The tick the mood started on, before its transition.
  began: number
  // The tick the loop's first frame plays on.
  since: number
  // A transition or an action, played once from `start`; an action that startles
  // the agents does so from its frame `startles` on. `activity` names the activity it is.
  once?: { frames: Frame[]; start: number; isAction: boolean; startles?: number; activity?: string }
  // The tick from which each action may play again.
  next: Record<string, number>
}

// A number in [0, 1): Math.random in the plugin, a fixed sequence in tests.
export type Random = () => number

// Moods of a turn at work: a burst of tools would flick between them every call.
const WORK: ReadonlySet<Mood> = new Set(['thinking', 'typing', 'running', 'writing', 'reading', 'searching', 'supervising'])
// How long a work mood shows before another work mood may take over.
const DWELL_SECONDS = 1
// An action this close to its end finishes before the mood changes.
const FOLLOW_THROUGH_TICKS = 2
// Moods of a pet strolling about: going between them is one stretch, so their
// actions keep their timers rather than start over at every stop.
const ROAMING: ReadonlySet<Mood> = new Set(['idle', 'proud', 'walking'])
const ASLEEP: ReadonlySet<Mood> = new Set(['sleeping', 'deepSleep'])

const ticks = (seconds: number, fps: number) => Math.max(1, Math.round(seconds * fps))

const someTime = ([min, max]: [number, number], fps: number, random: Random) => ticks(min + (max - min) * random(), fps)

// What one play of `action` shows: for an activity, its start, its loop for its
// seconds drawn at random rounded up to whole loops, and its end.
export const playOf = (action: Action, fps: number, random: Random): Frame[] => {
  if (action.activity === undefined) return action.frames
  const { loop, seconds, end } = action.activity
  const loops = Math.ceil(someTime(seconds, fps, random) / loop.length)
  return [...action.frames, ...Array.from({ length: loops }, () => loop).flat(), ...end]
}

// The activity the pet is in the middle of on `tick`, if any.
export const activityIn = (motion: Motion | undefined, tick: number) => {
  const once = motion?.once
  return once !== undefined && tick < once.start + once.frames.length ? once.activity : undefined
}

export const transitionFor = (pack: Pack, from: Mood, to: Mood) =>
  pack.transitions[`${from}>${to}`] ?? pack.transitions[`${from}>*`] ?? pack.transitions[`*>${to}`]

const start = (pack: Pack, previous: Motion | undefined, mood: Mood, tick: number, random: Random): Motion => {
  const loops = [pack.moods[mood], ...pack.variants[mood]]
  const loop = loops[Math.floor(random() * loops.length)] ?? pack.moods[mood]
  const transition = previous === undefined ? undefined : transitionFor(pack, previous.mood, mood)
  const roams = previous !== undefined && ROAMING.has(previous.mood) && ROAMING.has(mood)
  const next: Record<string, number> = roams ? { ...previous.next } : {}
  for (const action of pack.actions) {
    if (action.moods.includes(mood) && next[action.name] === undefined) next[action.name] = tick + someTime(action.every, pack.fps, random)
  }
  // Up from a nap, it soon goes off to do something: one activity of the stroll is due
  // as soon as it is up, and waits through a walk for it to stop.
  if (previous !== undefined && ASLEEP.has(previous.mood) && ROAMING.has(mood)) {
    const ready = pack.actions.filter(one => one.activity !== undefined && one.moods.some(m => ROAMING.has(m)))
    const picked = ready.length === 0 ? undefined : ready[Math.floor(random() * ready.length)]
    if (picked !== undefined) next[picked.name] = tick + (transition?.length ?? 0)
  }
  return {
    pack,
    mood,
    loop,
    began: tick,
    since: tick + (transition?.length ?? 0),
    once: transition === undefined ? undefined : { frames: transition, start: tick, isAction: false },
    next,
  }
}

// Whether it keeps playing `motion` on `tick` though the mood is now `mood`: a work
// mood shows a moment before the next one, and an action about to end finishes.
// Anything else, a reaction or sleep, takes over at once.
const holds = (pack: Pack, motion: Motion, mood: Mood, tick: number) => {
  if (WORK.has(motion.mood) && WORK.has(mood) && tick - motion.began < ticks(DWELL_SECONDS, pack.fps)) return true
  const left = motion.once === undefined ? 0 : motion.once.start + motion.once.frames.length - tick
  return motion.once?.isAction === true && left > 0 && left <= FOLLOW_THROUGH_TICKS
}

// The frame to draw on `tick`, and how many ticks ago it began to startle the
// agents, if it does. Safe to call more than once per tick: the same tick gives
// the same frame.
export const step = (pack: Pack, given: Motion | undefined, mood: Mood, tick: number, random: Random) => {
  const previous = given?.pack === pack ? given : undefined
  let motion =
    previous !== undefined && (previous.mood === mood || holds(pack, previous, mood, tick))
      ? previous
      : start(pack, previous, mood, tick, random)

  if (motion.once !== undefined) {
    const at = tick - motion.once.start
    const frame = motion.once.frames[at]
    const { startles } = motion.once
    const startled = startles !== undefined && at >= startles ? at - startles : undefined
    if (frame !== undefined) return { motion, frame, startled }
    motion = { ...motion, once: undefined }
  }

  // A mood on its way out starts no new action.
  const isLeaving = motion.mood !== mood
  // Kept timers may belong to another mood of the stroll: only its own actions play.
  const mine = pack.actions.filter(action => action.moods.includes(motion.mood))
  const isDue = (action: Action) => (motion.next[action.name] ?? Infinity) <= tick
  // An activity due goes first: a blink due with it would otherwise put it off.
  const due = isLeaving ? undefined : (mine.find(one => one.activity !== undefined && isDue(one)) ?? mine.find(isDue))
  if (due !== undefined) {
    const frames = playOf(due, pack.fps, random)
    const ends = tick + frames.length
    // One thing at a time: what falls due meanwhile waits its own time again from the
    // end, rather than all of it playing back to back after.
    const next = { ...motion.next, [due.name]: ends + someTime(due.every, pack.fps, random) }
    for (const other of mine) {
      if (other !== due && (next[other.name] ?? Infinity) <= ends) next[other.name] = ends + someTime(other.every, pack.fps, random)
    }
    const once = {
      frames,
      start: tick,
      isAction: true,
      startles: due.startles,
      ...(due.activity === undefined ? {} : { activity: due.name }),
    }
    motion = { ...motion, once, next }
    return { motion, frame: frames[0] ?? [], startled: due.startles === 0 ? 0 : undefined }
  }

  const at = (((tick - motion.since) % motion.loop.length) + motion.loop.length) % motion.loop.length
  return { motion, frame: motion.loop[at] ?? [], startled: undefined }
}
