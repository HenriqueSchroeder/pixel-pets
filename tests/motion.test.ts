import { describe, expect, test } from 'claude-code/testing'

import { activityIn, step } from '../hooks/motion'
import type { Urge } from '../hooks/drives'
import type { Motion, Random } from '../hooks/motion'
import { parsePack } from '../hooks/pack'
import type { Pack } from '../hooks/pack'
import { rowsOf } from '../hooks/render'
import type { Mood } from '../types'

// One-row frames named by their only row, so a frame reads as a word.
const f = (name: string) => [name]

const pack = parsePack({
  name: 'test',
  palette: { a: '#000000' },
  fps: 1,
  main: {
    moods: { sleeping: [f('zzz'), f('zZz')], thinking: [f('hmm')], reading: [f('red')], idle: [f('idl')] },
    variants: { thinking: [[f('ooh')]] },
    transitions: { '*>sleeping': [f('yaw'), f('nod')], 'sleeping>*': [f('str')] },
    actions: {
      blink: { frames: [f('_._')], moods: ['thinking'], every: [3, 3] },
      nod: { frames: [f('nd1'), f('nd2'), f('nd3'), f('nd4')], moods: ['idle'], every: [2, 2] },
      whip: { frames: [f('up1'), f('up2'), f('crk'), f('rec')], moods: ['supervising'], every: [2, 2], startles: 2 },
    },
  },
  mini: { tint: 'a', moods: { working: [f('a')] } },
})

// The same pet at 4 fps, so a second is four ticks.
const quick: Pack = { ...pack, fps: 4 }

const always = (value: number): Random => () => value

// A pet with one activity and nothing else to do, at 1 fps: `play` is due 3 ticks into idle.
   const playful = parsePack({
     name: 'playful',
     palette: { a: '#000000' },
     fps: 1,
     main: {
       moods: { sleeping: [f('zzz')], thinking: [f('hmm')], idle: [f('idl')] },
       activities: {
         play: { start: [f('st1')], loop: [f('lp1'), f('lp2')], end: [f('en1')], seconds: [5, 5], moods: ['idle'], every: [3, 3] },
       },
     },
     mini: { tint: 'a', moods: { working: [f('a')] } },
   })
   
// Draws `mood` from `from` to `to` ticks and returns the frames' names.
const play = (mood: Mood, from: number, to: number, random: Random, motion?: Motion, on = pack) => {
  const seen: string[] = []
  let current = motion
  for (let tick = from; tick <= to; tick++) {
    const moved = step(on, current, mood, tick, random)
    current = moved.motion
    seen.push(rowsOf(moved.frame)[0] ?? '')
  }
  return { seen, motion: current }
}

describe('step', () => {
  test("another pack's motion starts over, rather than play that pack's frames", () => {
    const other = parsePack({ name: 'other', palette: { a: '#000000' }, fps: 1, main: { moods: { sleeping: [f('oth')] } }, mini: false })
    const asleep = play('sleeping', 0, 0, always(0)).motion
    expect(play('sleeping', 1, 1, always(0), asleep, other).seen).toEqual(['oth'])
  })

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

  test('a work mood shows for a second before the next work mood takes over', () => {
    const thinking = play('thinking', 0, 0, always(0), undefined, quick).motion
    expect(play('reading', 1, 5, always(0), thinking, quick).seen).toEqual(['hmm', 'hmm', 'hmm', 'red', 'red'])
  })

  test('a flick back to the same work mood changes nothing', () => {
    const thinking = play('thinking', 0, 0, always(0), undefined, quick).motion
    const flicked = play('reading', 1, 1, always(0), thinking, quick).motion
    expect(flicked?.mood).toBe('thinking')
    expect(play('thinking', 2, 2, always(0), flicked, quick).motion?.began).toBe(0)
  })

  test('leaving work for anything else does not wait', () => {
    const thinking = play('thinking', 0, 0, always(0), undefined, quick).motion
    expect(play('sleeping', 1, 1, always(0), thinking, quick).seen).toEqual(['yaw'])
  })

  test('an action about to end finishes before the next mood', () => {
    const nodding = play('idle', 0, 3, always(0)).motion
    expect(play('sleeping', 4, 7, always(0), nodding).seen).toEqual(['nd3', 'nd4', 'yaw', 'nod'])
  })

  test('an action far from its end is cut', () => {
    const nodding = play('idle', 0, 2, always(0)).motion
    expect(play('sleeping', 3, 4, always(0), nodding).seen).toEqual(['yaw', 'nod'])
  })

  test('an action that startles the agents does so from its frame on, until it ends, counting the ticks since', () => {
    const seen: string[] = []
    let motion: Motion | undefined
    for (let tick = 0; tick <= 6; tick++) {
      const moved = step(pack, motion, 'supervising', tick, always(0))
      motion = moved.motion
      seen.push(`${rowsOf(moved.frame)[0]}${moved.startled ?? ''}`)
    }
    expect(seen).toEqual(['hmm', 'hmm', 'up1', 'up2', 'crk0', 'rec1', 'hmm'])
  })

  test('a stroll does not put off an idle action: it plays as soon as the pet stops', () => {
    const resting = play('idle', 0, 0, always(0)).motion
    const strolling = play('walking', 1, 3, always(0), resting)
    // Due on tick 2, mid-stroll: it waits for the pet to stop, then plays.
    expect(strolling.seen).toEqual(['idl', 'idl', 'idl'])
    expect(play('idle', 4, 5, always(0), strolling.motion).seen).toEqual(['nd1', 'nd2'])
  })

  test('anything else than a stroll starts the timers over', () => {
    const resting = play('idle', 0, 0, always(0)).motion
    const musing = play('thinking', 1, 1, always(0), resting).motion
    // Back to idle on tick 2, its nod is two ticks off again.
    expect(play('idle', 2, 4, always(0), musing).seen).toEqual(['idl', 'idl', 'nd1'])
  })
})

describe('activities', () => {
  test('an activity plays its start, its loop for its seconds in whole loops, then its end', () => {
    // 5 seconds at 1 fps round up to 3 loops of 2 frames.
    const { seen } = play('idle', 0, 11, always(0), undefined, playful)
    expect(seen).toEqual(['idl', 'idl', 'idl', 'st1', 'lp1', 'lp2', 'lp1', 'lp2', 'lp1', 'lp2', 'en1', 'idl'])
  })

  test('while it plays, it is the activity the pet is in; not before, not after', () => {
    const before = play('idle', 0, 2, always(0), undefined, playful).motion
    expect(activityIn(before, 2)).toBeUndefined()
    const during = play('idle', 3, 5, always(0), before, playful).motion
    expect(activityIn(during, 5)).toBe('play')
    const after = play('idle', 6, 11, always(0), during, playful).motion
    expect(activityIn(after, 11)).toBeUndefined()
  })

  test('anything else coming up cuts it short, its end unplayed', () => {
    const playing = play('idle', 0, 5, always(0), undefined, playful).motion
    expect(play('thinking', 6, 6, always(0), playing, playful).seen).toEqual(['hmm'])
  })

  test('up from a nap it soon starts an activity, even by way of a stroll', () => {
    const napping = play('sleeping', 0, 9, always(0), undefined, playful).motion
    expect(play('idle', 10, 10, always(0), napping, playful).seen).toEqual(['st1'])
    const strolling = play('walking', 10, 11, always(0), napping, playful)
    expect(strolling.seen).toEqual(['idl', 'idl'])
    expect(play('idle', 12, 12, always(0), strolling.motion, playful).seen).toEqual(['st1'])
  })

  test('awake from anything else, it waits its usual time', () => {
    const musing = play('thinking', 0, 0, always(0), undefined, playful).motion
    expect(play('idle', 1, 3, always(0), musing, playful).seen).toEqual(['idl', 'idl', 'idl'])
  })
})

describe('one thing at a time', () => {
  // Two idle actions at 1 fps: `paw` due 2 ticks in, `ear` 3.
  const busy = parsePack({
    name: 'busy',
    palette: { a: '#000000' },
    fps: 1,
    main: {
      moods: { sleeping: [f('zzz')], idle: [f('idl')] },
      actions: {
        paw: { frames: [f('pw1'), f('pw2')], moods: ['idle'], every: [2, 2] },
        ear: { frames: [f('ear')], moods: ['idle'], every: [3, 3] },
      },
      activities: { play: { loop: [f('lp1')], seconds: [5, 5], moods: ['idle'], every: [30, 30] } },
    },
    mini: { tint: 'a', moods: { working: [f('a')] } },
  })

  test('what comes due while something plays waits its own time again, rather than following straight on', () => {
    // `ear` falls due as `paw` plays: it starts over from paw's end, so paw comes round first.
    const { seen } = play('idle', 0, 7, always(0), undefined, busy)
    expect(seen).toEqual(['idl', 'idl', 'pw1', 'pw2', 'idl', 'idl', 'pw1', 'pw2'])
  })

  test('an activity due with an action at once goes first, as after a long stroll', () => {
    const resting = play('idle', 0, 0, always(0), undefined, busy).motion
    // Back from a stroll on tick 10, everything long overdue by the timers it kept.
    const back = resting === undefined ? resting : { ...resting, next: { paw: 5, ear: 5, play: 5 } }
    expect(play('idle', 10, 11, always(0), back, busy).seen).toEqual(['lp1', 'lp1'])
  })
})

// A pet at work, at 1 fps so a tick is a second: it drifts off 20 ticks into one work mood.
const worker = (main: Record<string, unknown> = {}) =>
  parsePack({
    name: 'worker',
    palette: { a: '#000000' },
    fps: 1,
    main: {
      moods: { sleeping: [f('zzz')], running: [f('run')], reading: [f('red')], idle: [f('idl')], watching: [f('wa1'), f('wa2')] },
      actions: {
        // Plays at work too, so it is no change of scene.
        blink: { frames: [f('_._')], moods: ['running', 'idle'], every: [600, 600] },
        yawn: { frames: [f('yw1'), f('yw2')], moods: ['tired'], every: [600, 600] },
      },
      activities: {
        groom: { start: [f('gr0')], loop: [f('gr1')], end: [f('gr9')], seconds: [60, 60], moods: ['idle'], every: [600, 600] },
      },
      ...main,
    },
    mini: false,
  })

const atWork = (on: Pack, mood: Mood, from: number, to: number, urge?: Urge, motion?: Motion) => {
  const seen: string[] = []
  let current = motion
  for (let tick = from; tick <= to; tick++) {
    const moved = step(on, current, mood, tick, always(0), urge)
    current = moved.motion
    seen.push(rowsOf(moved.frame)[0] ?? '')
  }
  return { seen, motion: current }
}

describe('drifting off at work', () => {
  test('nothing for its first 20 seconds in one work mood, nor ever without an urge', () => {
    expect(atWork(worker(), 'running', 0, 19, 'bored').seen.every(name => name === 'run')).toBe(true)
    expect(atWork(worker(), 'running', 0, 60).seen.every(name => name === 'run')).toBe(true)
  })

  test('bored, it plays an idle activity for 8 seconds at most, start and end included, then goes back to work for a while', () => {
    const { seen } = atWork(worker(), 'running', 0, 43, 'bored')
    expect(seen.slice(20, 29)).toEqual(['gr0', ...Array(6).fill('gr1'), 'gr9', 'run'])
    // The next is 15 seconds from the end, the usual curiosity changing nothing.
    expect(seen.slice(28, 43).every(name => name === 'run')).toBe(true)
    expect(seen[43]).toBe('gr0')
  })

  test('tired, it does what it does when tired', () => {
    expect(atWork(worker(), 'running', 0, 22, 'tired').seen.slice(20)).toEqual(['yw1', 'yw2', 'run'])
  })

  test('missing the person, it looks for them a couple of seconds', () => {
    expect(atWork(worker(), 'running', 0, 22, 'longing').seen.slice(20)).toEqual(['wa1', 'wa2', 'run'])
  })

  test('with nothing tired to do, or no look of its own for the person, it finds something to do', () => {
    expect(atWork(worker({ actions: {} }), 'running', 0, 20, 'tired').seen[20]).toBe('gr0')
    const borrowsWatching = worker({ moods: { sleeping: [f('zzz')], running: [f('run')], reading: [f('red')], idle: [f('idl')] } })
    expect(atWork(borrowsWatching, 'running', 0, 20, 'longing').seen[20]).toBe('gr0')
  })

  test('what plays at work anyway, a blink, is no distraction', () => {
    const onlyBlinks = worker({ activities: {}, actions: { blink: { frames: [f('_._')], moods: ['running', 'idle'], every: [600, 600] } } })
    expect(atWork(onlyBlinks, 'running', 0, 60, 'bored').seen.every(name => name === 'run')).toBe(true)
  })

  test("what its pack draws for that work mood goes first, and only once it has settled", () => {
    const own = worker({
      activities: {
        groom: { start: [f('gr0')], loop: [f('gr1')], end: [f('gr9')], seconds: [60, 60], moods: ['idle'], every: [600, 600] },
        tail: { loop: [f('tl1')], seconds: [5, 5], moods: ['running'], every: [1, 1] },
      },
    })
    const { seen } = atWork(own, 'running', 0, 25, 'tired')
    expect(seen.slice(0, 20).every(name => name === 'run')).toBe(true)
    expect(seen.slice(20, 26)).toEqual([...Array(5).fill('tl1'), 'run'])
  })

  test('another work mood starts the wait over', () => {
    const running = atWork(worker(), 'running', 0, 15, 'bored').motion
    const { seen } = atWork(worker(), 'reading', 16, 36, 'bored', running)
    expect(seen.slice(0, 20).every(name => name === 'red')).toBe(true)
    expect(seen[20]).toBe('gr0')
  })

  test('out of work it never drifts off: idle keeps its own timers', () => {
    expect(atWork(worker(), 'idle', 0, 60, 'bored').seen.slice(0, 60).includes('gr0')).toBe(false)
  })
})
