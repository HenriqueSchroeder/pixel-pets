import type { Frame, Mood } from '../types'
import type { Pack } from './pack'

// What the main pet is playing. Kept between draws so a loop runs from its own
// start and a one-off finishes before the loop picks up again.
export type Motion = {
  mood: Mood
  loop: Frame[]
  // The tick the mood started on, before its transition.
  began: number
  // The tick the loop's first frame plays on.
  since: number
  // A transition or an action, played once from `start`.
  once?: { frames: Frame[]; start: number; isAction: boolean }
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

const ticks = (seconds: number, fps: number) => Math.max(1, Math.round(seconds * fps))

const someTime = ([min, max]: [number, number], fps: number, random: Random) => ticks(min + (max - min) * random(), fps)

export const transitionFor = (pack: Pack, from: Mood, to: Mood) =>
  pack.transitions[`${from}>${to}`] ?? pack.transitions[`${from}>*`] ?? pack.transitions[`*>${to}`]

const start = (pack: Pack, previous: Motion | undefined, mood: Mood, tick: number, random: Random): Motion => {
  const loops = [pack.moods[mood], ...pack.variants[mood]]
  const loop = loops[Math.floor(random() * loops.length)] ?? pack.moods[mood]
  const transition = previous === undefined ? undefined : transitionFor(pack, previous.mood, mood)
  const next: Record<string, number> = {}
  for (const action of pack.actions) {
    if (action.moods.includes(mood)) next[action.name] = tick + someTime(action.every, pack.fps, random)
  }
  return {
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

// The frame to draw on `tick`. Safe to call more than once per tick: the same
// tick gives the same frame.
export const step = (pack: Pack, previous: Motion | undefined, mood: Mood, tick: number, random: Random) => {
  let motion =
    previous !== undefined && (previous.mood === mood || holds(pack, previous, mood, tick))
      ? previous
      : start(pack, previous, mood, tick, random)

  if (motion.once !== undefined) {
    const frame = motion.once.frames[tick - motion.once.start]
    if (frame !== undefined) return { motion, frame }
    motion = { ...motion, once: undefined }
  }

  // A mood on its way out starts no new action.
  const isLeaving = motion.mood !== mood
  const due = isLeaving ? undefined : pack.actions.find(action => (motion.next[action.name] ?? Infinity) <= tick)
  if (due !== undefined) {
    const again = tick + due.frames.length + someTime(due.every, pack.fps, random)
    motion = { ...motion, once: { frames: due.frames, start: tick, isAction: true }, next: { ...motion.next, [due.name]: again } }
    return { motion, frame: due.frames[0] ?? [] }
  }

  const at = (((tick - motion.since) % motion.loop.length) + motion.loop.length) % motion.loop.length
  return { motion, frame: motion.loop[at] ?? [] }
}
