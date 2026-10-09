import { describe, expect, test } from 'claude-code/testing'

import { parsePack } from '../hooks/pack'

const tiny = () => ({
  name: 'tiny',
  palette: { o: '#000000', b: '#ff0000' },
  main: { moods: { sleeping: [['oo', 'bb']] } },
  mini: { moods: { working: [['ob', 'bo']] } },
})

describe('parsePack', () => {
  test('accepts a minimal pack and fills every mood from sleeping', () => {
    const pack = parsePack(tiny())
    expect(pack.moods.typing).toEqual([['oo', 'bb']])
    expect(pack.colors.b).toBe(0xff0000)
    expect(pack.fps).toBe(4)
    expect(pack.tint).toBe('b')
  })

  test('a missing mood borrows from its nearest drawn parent', () => {
    const raw = { ...tiny(), main: { moods: { sleeping: [['oo']], typing: [['bb']], reading: [['ob']] } } }
    const pack = parsePack(raw)
    expect(pack.moods.running).toEqual([['bb']])
    expect(pack.moods.writing).toEqual([['bb']])
    expect(pack.moods.searching).toEqual([['ob']])
    expect(pack.moods.compacting).toEqual([['oo']])
  })

  test('only a pack that draws walking walks', () => {
    expect(parsePack(tiny()).walks).toBe(false)
    expect(parsePack({ ...tiny(), main: { moods: { sleeping: [['oo']], walking: [['bb']] } } }).walks).toBe(true)
  })

  test('mini happy, sad and startled fall back to working', () => {
    expect(parsePack(tiny()).mini?.happy).toEqual([['ob', 'bo']])
    expect(parsePack(tiny()).mini?.startled).toEqual([['ob', 'bo']])
  })

  test('an action may startle the agents from one of its frames on', () => {
    const withAction = (action: unknown) => ({
      ...tiny(),
      main: { ...tiny().main, actions: { whip: { frames: [['oo', 'bb'], ['bb', 'oo']], moods: ['supervising'], every: [2, 4], ...(action as object) } } },
    })
    expect(parsePack(withAction({ startles: 1 })).actions[0]?.startles).toBe(1)
    expect(parsePack(withAction({})).actions[0]?.startles).toBeUndefined()
    expect(() => parsePack(withAction({ startles: 2 }))).toThrow(/startles: one of its frames, 0 to 1/)
    expect(() => parsePack(withAction({ startles: 0.5 }))).toThrow(/startles/)
    expect(() => parsePack(withAction({ startles: '1' }))).toThrow(/startles/)
  })

  test('mini: false draws no mini pets; leaving mini out is still a mistake', () => {
    expect(parsePack({ ...tiny(), mini: false }).mini).toBeNull()
    expect(() => parsePack({ ...tiny(), mini: undefined })).toThrow(/mini: false/)
    expect(() => parsePack({ ...tiny(), mini: true })).toThrow(/mini.moods/)
  })

  test('variants, transitions and actions are optional and checked', () => {
    const moods = { sleeping: [['oo']], thinking: [['bb']] }
    const ok = parsePack({
      ...tiny(),
      main: {
        moods,
        variants: { thinking: [[['ob']]] },
        transitions: { '*>sleeping': [['bo']] },
        actions: { blink: { frames: [['oo']], moods: ['thinking'], every: [2, 6] } },
      },
    })
    expect(ok.variants.thinking).toEqual([[['ob']]])
    expect(ok.variants.typing).toEqual([[['ob']]])
    expect(ok.actions[0]?.every).toEqual([2, 6])

    const bad = (main: object) => () => parsePack({ ...tiny(), main: { moods, ...main } })
    expect(bad({ transitions: { 'sleeping>dancing': [['oo']] } })).toThrow(/from>to/)
    expect(bad({ transitions: { '*>*': [['oo']] } })).toThrow(/from>to/)
    expect(bad({ variants: { dancing: [[['oo']]] } })).toThrow(/unknown mood dancing/)
    expect(bad({ variants: { typing: [[['oo']]] } })).toThrow(/draw main.moods.typing first/)
    expect(bad({ actions: { __proto__x: { frames: [['oo']], moods: ['thinking'], every: [2, 6] } } })).toThrow(/name with letters/)
    expect(bad({ actions: { blink: { frames: [['oo']], moods: ['thinking'], every: [6, 2] } } })).toThrow(/every/)
    expect(bad({ actions: { blink: { frames: [['ooo']], moods: ['thinking'], every: [2, 6] } } })).toThrow(/same size/)
  })

  test('an activity is read as an action that loops for a while, with its words', () => {
    const raw = {
      ...tiny(),
      main: {
        moods: { sleeping: [['oo', 'bb']] },
        activities: {
          yarn: {
            start: [['bo', 'bo']],
            loop: [['ob', 'ob'], ['bb', 'bb']],
            seconds: [10, 20],
            moods: ['idle'],
            every: [60, 120],
            label: { en: 'playing with yarn', 'pt-BR': 'brincando com o novelo' },
          },
          knead: { loop: [['oo', 'oo']], seconds: [5, 5], moods: ['idle'], every: [30, 30] },
        },
      },
    }
    const [yarn, knead] = parsePack(raw).actions
    expect(yarn).toEqual({
      name: 'yarn',
      frames: [['bo', 'bo']],
      moods: ['idle'],
      every: [60, 120],
      activity: {
        loop: [['ob', 'ob'], ['bb', 'bb']],
        seconds: [10, 20],
        end: [],
        label: { en: 'playing with yarn', 'pt-BR': 'brincando com o novelo' },
      },
    })
    expect(knead?.frames).toEqual([])
    expect(knead?.activity?.label).toEqual({})
  })

  test('activities are checked', () => {
    const loop = [['oo', 'bb']]
    const withActivities = (activities: unknown, actions?: unknown) => ({
      ...tiny(),
      main: { moods: { sleeping: [['oo', 'bb']] }, activities, ...(actions === undefined ? {} : { actions }) },
    })
    const ok = { loop, seconds: [5, 10], moods: ['idle'], every: [30, 60] }
    expect(() => parsePack(withActivities({ play: ok }))).not.toThrow()
    expect(() => parsePack(withActivities([]))).toThrow(/main.activities: an object/)
    expect(() => parsePack(withActivities({ play: { ...ok, loop: undefined } }))).toThrow(/activities.play.loop: needs at least one frame/)
    expect(() => parsePack(withActivities({ play: { ...ok, seconds: [4, 10] } }))).toThrow(/activities.play.seconds: \[min, max\] seconds, 5 to 300/)
    expect(() => parsePack(withActivities({ play: { ...ok, seconds: [20, 10] } }))).toThrow(/activities.play.seconds/)
    expect(() => parsePack(withActivities({ play: { ...ok, every: [0, 10] } }))).toThrow(/activities.play.every/)
    expect(() => parsePack(withActivities({ play: { ...ok, moods: ['dancing'] } }))).toThrow(/activities.play.moods/)
    // Only where it idles: walking would cut it at once, work would hide its words, sleep would fight it.
    for (const mood of ['idle', 'proud', 'sleepy', 'tired', 'worried', 'grumpy']) {
      expect(() => parsePack(withActivities({ play: { ...ok, moods: [mood] } }))).not.toThrow()
    }
    for (const mood of ['walking', 'reading', 'supervising', 'sleeping', 'deepSleep', 'happy']) {
      expect(() => parsePack(withActivities({ play: { ...ok, moods: ['idle', mood] } }))).toThrow(
        new RegExp(`activities.play.moods: "${mood}" is not a mood it idles in \\(idle, proud, sleepy, tired, worried, or grumpy\\)`),
      )
    }
    expect(() => parsePack(withActivities({ play: { ...ok, end: [['ooo', 'bbb']] } }))).toThrow(/every frame needs the same size/)
    expect(() => parsePack(withActivities({ play: { ...ok, label: { english: 'hi' } } }))).toThrow(/activities.play.label: "english" is not a language code/)
    expect(() => parsePack(withActivities({ play: { ...ok, label: { en: 'x'.repeat(41) } } }))).toThrow(/activities.play.label.en: one line, up to 40 characters/)
    expect(() => parsePack(withActivities({ blink: ok }, { blink: { frames: loop, moods: ['idle'], every: [2, 6] } }))).toThrow(/activities.blink: an action has this name already/)
    const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`a${i}`, ok]))
    expect(() => parsePack(withActivities(nine))).toThrow(/main.activities: at most 8/)
  })

  test('needs a sleeping mood', () => {
    const raw = { ...tiny(), main: { moods: { typing: [['oo']] } } }
    expect(() => parsePack(raw)).toThrow(/sleeping: required/)
  })

  test('refuses a mood the core does not know', () => {
    const raw = { ...tiny(), main: { moods: { sleeping: [['oo']], dancing: [['oo']] } } }
    expect(() => parsePack(raw)).toThrow(/unknown mood dancing/)
  })

  test('refuses colors that are not #rrggbb', () => {
    const raw = { ...tiny(), palette: { o: 'red' } }
    expect(() => parsePack(raw)).toThrow(/palette.o/)
  })

  test('refuses "." as a palette letter', () => {
    const raw = { ...tiny(), palette: { '.': '#000000' } }
    expect(() => parsePack(raw)).toThrow(/other than "."/)
  })

  test('refuses ragged rows', () => {
    const raw = { ...tiny(), main: { moods: { sleeping: [['ooo', 'b']] } } }
    expect(() => parsePack(raw)).toThrow(/same length/)
  })

  test('refuses frames of different sizes', () => {
    const raw = { ...tiny(), main: { moods: { sleeping: [['oo']], happy: [['ooo']] } } }
    expect(() => parsePack(raw)).toThrow(/same size/)
  })

  test('refuses a sprite over the size limit', () => {
    const wide = { ...tiny(), main: { moods: { sleeping: [['o'.repeat(49)]] } } }
    expect(() => parsePack(wide)).toThrow(/at most 48x32/)
    const tall = { ...tiny(), main: { moods: { sleeping: [Array.from({ length: 33 }, () => 'o')] } } }
    expect(() => parsePack(tall)).toThrow(/at most 48x32/)
    const biggest = Array.from({ length: 32 }, () => 'o'.repeat(48))
    expect(parsePack({ ...tiny(), main: { moods: { sleeping: [biggest] } } }).moods.sleeping[0]).toEqual(biggest)
  })

  test('refuses a tint outside the palette', () => {
    const raw = { ...tiny(), mini: { tint: 'z', moods: { working: [['ob']] } } }
    expect(() => parsePack(raw)).toThrow(/mini.tint/)
  })

  test('takes its own lines by language and situation, and checks them', () => {
    const lines = { en: { longThink: ['mrrp…'] }, 'pt-BR': { manyReads: ['quanta coisa!'] } }
    expect(parsePack({ ...tiny(), speech: lines }).speech).toEqual(lines)
    expect(parsePack(tiny()).speech).toEqual({})
    const refused = (speech: unknown) => () => parsePack({ ...tiny(), speech })
    expect(refused({ en: { sing: ['la'] } })).toThrow(/unknown situation/)
    expect(refused({ english: { longThink: ['hm'] } })).toThrow(/language code/)
    expect(refused({ en: { longThink: ['x'.repeat(41)] } })).toThrow(/up to 40/)
    expect(refused({ en: { longThink: ['two\nlines'] } })).toThrow(/one line each/)
    expect(refused({ en: { longThink: Array(9).fill('hm') } })).toThrow(/1 to 8 lines/)
  })

  test('takes teleport frames, checked like any other', () => {
    expect(parsePack(tiny()).teleport).toBeNull()
    const blink = { vanish: [['.b', '..']], appear: [['b.', '..'], ['bb', 'oo']] }
    expect(parsePack({ ...tiny(), main: { ...tiny().main, teleport: blink } }).teleport).toEqual(blink)
    const refused = (teleport: unknown) => () => parsePack({ ...tiny(), main: { ...tiny().main, teleport } })
    expect(refused({ vanish: [['.b', '..']] })).toThrow(/teleport.appear/)
    expect(refused({ vanish: [['.bb', '...']], appear: [['bb', 'oo']] })).toThrow(/same size/)
    expect(refused([['bb', 'oo']])).toThrow(/vanish and appear/)
  })

  test('takes its personality, the usual 0.5 for a trait left out, and checks it', () => {
    expect(parsePack(tiny()).personality).toEqual({ energetic: 0.5, curious: 0.5, affectionate: 0.5 })
    expect(parsePack({ ...tiny(), personality: { curious: 0.9, affectionate: 0 } }).personality).toEqual({
      energetic: 0.5,
      curious: 0.9,
      affectionate: 0,
    })
    const refused = (personality: unknown) => () => parsePack({ ...tiny(), personality })
    expect(refused({ grumpy: 1 })).toThrow(/unknown trait/)
    expect(refused({ toString: 1 })).toThrow(/unknown trait/)
    expect(refused({ curious: 2 })).toThrow(/from 0 to 1/)
    expect(refused({ curious: '0.5' })).toThrow(/from 0 to 1/)
    expect(refused([0.5])).toThrow(/personality/)
  })
})

const face = () => ({
  name: 'face',
  style: 'ascii',
  ink: '#e8e8e8',
  palette: { p: '#ff8fa3' },
  main: { moods: { sleeping: [['(-.-)']] } },
  mini: { moods: { working: [['(o)']] } },
})

describe('ascii packs', () => {
  test('a frame of text is drawn in ink, the mini pet tinted whole', () => {
    const pack = parsePack(face())
    expect(pack.moods.sleeping).toEqual([{ art: ['(-.-)'], color: ['.....'] }])
    expect(pack.colors['.']).toBe(0xe8e8e8)
    expect(pack.tint).toBe('.')
    expect(pack.mirrors).toBe(true)
    expect(() => parsePack({ ...face(), mini: { tint: 'q', moods: face().mini.moods } })).toThrow(/mini.tint: .*"\." for the ink/)
  })

  test('a color mask paints its cells from the palette', () => {
    const masked = (color: string[]) => parsePack({ ...face(), main: { moods: { sleeping: [{ art: ['(-.-)'], color }] } } })
    expect(masked(['.p.p.']).moods.sleeping).toEqual([{ art: ['(-.-)'], color: ['.p.p.'] }])
    expect(() => masked(['.q...'])).toThrow(/color: "q" is not in the palette/)
    expect(() => masked(['..'])).toThrow(/same rows and widths/)
    expect(() => masked(['.....', '.....'])).toThrow(/same rows and widths/)
  })

  test('ink is for ascii packs, which may leave the palette out', () => {
    expect(() => parsePack({ ...face(), ink: undefined })).toThrow(/ink: required/)
    expect(() => parsePack({ ...face(), ink: 'white' })).toThrow(/ink: required/)
    expect(() => parsePack({ ...tiny(), ink: '#ffffff' })).toThrow(/ink: only for an ascii pack/)
    expect(parsePack({ ...face(), palette: undefined }).colors).toEqual({ '.': 0xe8e8e8 })
    expect(() => parsePack({ ...tiny(), palette: undefined })).toThrow(/palette: required/)
    expect(parsePack(tiny()).colors['.']).toBeUndefined()
  })

  test('an activity is drawn in text like any other frame', () => {
    const activities = { play: { start: [['(o.o)']], loop: [['(o.O)'], { art: ['(O.o)'], color: ['.p.p.'] }], seconds: [5, 5], moods: ['idle'], every: [30, 30] } }
    const pack = parsePack({ ...face(), main: { moods: { sleeping: [['(-.-)']] }, activities } })
    const play = pack.actions.find(one => one.name === 'play')
    expect(play?.frames).toEqual([{ art: ['(o.o)'], color: ['.....'] }])
    expect(play?.activity?.loop).toEqual([{ art: ['(o.O)'], color: ['.....'] }, { art: ['(O.o)'], color: ['.p.p.'] }])
    expect(() => parsePack({ ...face(), main: { moods: { sleeping: [['(-.-)']] }, activities: { play: { ...activities.play, loop: [['oo']] } } } })).toThrow(
      /same size/,
    )
  })

  test('every frame follows the style', () => {
    expect(() => parsePack({ ...tiny(), main: { moods: { sleeping: [{ art: ['oo'] }] } } })).toThrow(/a frame is a list of strings/)
    expect(() => parsePack({ ...face(), main: { moods: { sleeping: [{ color: ['.'] }] } } })).toThrow(/a list of strings, or \{ art, color \}/)
    expect(() => parsePack({ ...face(), style: 'vector' })).toThrow(/style: "pixel" or "ascii"/)
  })

  test('only characters a terminal draws one cell wide', () => {
    const drawn = (row: string) => parsePack({ ...face(), main: { moods: { sleeping: [[row]] } } })
    for (const wide of ['🐱', '✌️', '中', 'ｗ', 'é', 'a\tb']) expect(() => drawn(wide)).toThrow(/one cell wide/)
    expect(drawn('♥•°ᴗ𝄞').moods.sleeping[0]).toEqual({ art: ['♥•°ᴗ𝄞'], color: ['.....'] })
  })

  test('sizes count cells: 48x16 for the pet, 12x6 for its minis', () => {
    const tall = (rows: number) => ({ ...face(), main: { moods: { sleeping: [Array(rows).fill('o')] } } })
    expect(parsePack(tall(16)).moods.sleeping[0]).toBeDefined()
    expect(() => parsePack(tall(17))).toThrow(/at most 48x16 cells/)
    expect(() => parsePack({ ...face(), mini: { moods: { working: [Array(7).fill('o')] } } })).toThrow(/at most 12x6 cells/)
    expect(parsePack({ ...tiny(), main: { moods: { sleeping: [Array(32).fill('oo')] } } }).moods.sleeping[0]).toHaveLength(32)
    expect(() => parsePack({ ...face(), main: { moods: { sleeping: [['(-.-)'], ['(-.-)z']] } } })).toThrow(/same size/)
  })

  test('mirror: false keeps any pack from flipping', () => {
    expect(parsePack({ ...tiny(), mirror: false }).mirrors).toBe(false)
    expect(parsePack({ ...face(), mirror: false }).mirrors).toBe(false)
    expect(parsePack(tiny()).mirrors).toBe(true)
    expect(() => parsePack({ ...tiny(), mirror: 'no' })).toThrow(/mirror: true or false/)
  })
})
