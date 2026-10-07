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
    expect(pack.moods.waiting).toEqual([['oo']])
  })

  test('only a pack that draws walking walks', () => {
    expect(parsePack(tiny()).walks).toBe(false)
    expect(parsePack({ ...tiny(), main: { moods: { sleeping: [['oo']], walking: [['bb']] } } }).walks).toBe(true)
  })

  test('mini happy and sad fall back to working', () => {
    expect(parsePack(tiny()).mini.happy).toEqual([['ob', 'bo']])
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
    const raw = { ...tiny(), main: { moods: { sleeping: [['o'.repeat(25)]] } } }
    expect(() => parsePack(raw)).toThrow(/at most 24x24/)
  })

  test('refuses a tint outside the palette', () => {
    const raw = { ...tiny(), mini: { tint: 'z', moods: { working: [['ob']] } } }
    expect(() => parsePack(raw)).toThrow(/mini.tint/)
  })
})
