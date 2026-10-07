import type { Frame, Mood } from '../types'
import type { Pack } from './pack'

// What the main pet is playing. Kept between draws so a loop runs from its own
// start and a one-off finishes before the loop picks up again.
export type Motion = {
  mood: Mood
  loop: Frame[]
  // The tick the loop's first frame plays on.
  since: number
  // A transition or an action, played once from `start`.
  once?: { frames: Frame[]; start: number }
  // The tick from which each action may play again.
  next: Record<string, number>
}

// A number in [0, 1): Math.random in the plugin, a fixed sequence in tests.
export type Random = () => number

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
    since: tick + (transition?.length ?? 0),
    once: transition === undefined ? undefined : { frames: transition, start: tick },
    next,
  }
}

// The frame to draw on `tick`. Safe to call more than once per tick: the same
// tick gives the same frame.
export const step = (pack: Pack, previous: Motion | undefined, mood: Mood, tick: number, random: Random) => {
  let motion = previous?.mood === mood ? previous : start(pack, previous, mood, tick, random)

  if (motion.once !== undefined) {
    const frame = motion.once.frames[tick - motion.once.start]
    if (frame !== undefined) return { motion, frame }
    motion = { ...motion, once: undefined }
  }

  const due = pack.actions.find(action => (motion.next[action.name] ?? Infinity) <= tick)
  if (due !== undefined) {
    const again = tick + due.frames.length + someTime(due.every, pack.fps, random)
    motion = { ...motion, once: { frames: due.frames, start: tick }, next: { ...motion.next, [due.name]: again } }
    return { motion, frame: due.frames[0] ?? [] }
  }

  const at = (((tick - motion.since) % motion.loop.length) + motion.loop.length) % motion.loop.length
  return { motion, frame: motion.loop[at] ?? [] }
}
