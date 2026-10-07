import { describe, expect, test } from 'claude-code/testing'

import { step } from '../hooks/motion'
import type { Motion, Random } from '../hooks/motion'
import { parsePack } from '../hooks/pack'
import type { Mood } from '../types'

// One-row frames named by their only row, so a frame reads as a word.
const f = (name: string) => [name]

const pack = parsePack({
  name: 'test',
  palette: { a: '#000000' },
  fps: 1,
  main: {
    moods: { sleeping: [f('zzz'), f('zZz')], thinking: [f('hmm')] },
    variants: { thinking: [[f('ooh')]] },
    transitions: { '*>sleeping': [f('yaw'), f('nod')], 'sleeping>*': [f('str')] },
    actions: { blink: { frames: [f('_._')], moods: ['thinking'], every: [3, 3] } },
  },
  mini: { tint: 'a', moods: { working: [f('a')] } },
})

const always = (value: number): Random => () => value

// Draws `mood` from `from` to `to` ticks and returns the frames' names.
const play = (mood: Mood, from: number, to: number, random: Random, motion?: Motion) => {
  const seen: string[] = []
  let current = motion
  for (let tick = from; tick <= to; tick++) {
    const moved = step(pack, current, mood, tick, random)
    current = moved.motion
    seen.push(moved.frame[0] ?? '')
  }
  return { seen, motion: current }
}

describe('step', () => {
  test('a loop starts from its first frame when its mood starts', () => {
    expect(play('sleeping', 7, 10, always(0)).seen).toEqual(['zzz', 'zZz', 'zzz', 'zZz'])
  })

  test('a transition plays once before the new loop', () => {
    const awake = play('thinking', 0, 0, always(0)).motion
    expect(play('sleeping', 1, 4, always(0), awake).seen).toEqual(['yaw', 'nod', 'zzz', 'zZz'])
  })

  test('the exact or "from>*" transition wins over "*>to"', () => {
    const asleep = play('sleeping', 0, 0, always(0)).motion
    expect(play('thinking', 1, 2, always(0), asleep).seen).toEqual(['str', 'hmm'])
  })

  test('a variant is picked at random when the mood starts', () => {
    expect(play('thinking', 0, 1, always(0)).seen).toEqual(['hmm', 'hmm'])
    expect(play('thinking', 0, 1, always(0.9)).seen).toEqual(['ooh', 'ooh'])
  })

  test('an action plays every `every` seconds after it last ended, only in its moods', () => {
    expect(play('thinking', 0, 8, always(0)).seen).toEqual(['hmm', 'hmm', 'hmm', '_._', 'hmm', 'hmm', 'hmm', '_._', 'hmm'])
    expect(play('sleeping', 0, 7, always(0)).seen).not.toContain('_._')
  })

  test('drawing twice on one tick gives the same frame', () => {
    const first = step(pack, undefined, 'sleeping', 5, always(0))
    const again = step(pack, first.motion, 'sleeping', 5, always(0))
    expect(again.frame).toEqual(first.frame)
  })
})
