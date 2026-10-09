import { describe, expect, test } from 'claude-code/testing'

import { encode, facingFrame, mirror, sizeOf } from '../hooks/render'

const NONE = 0x01000000

// The engine's runtime has TC39 base64; TypeScript's es2023 lib does not type it.
const words = (cells: string) => [
  ...new Uint32Array((Uint8Array as unknown as { fromBase64(text: string): Uint8Array }).fromBase64(cells).buffer),
]

describe('glyph frames', () => {
  test('each glyph is a cell in its mask color, a space see-through', () => {
    const cells = encode({ art: ['a b'], color: ['.x.'] }, { '.': 0x111111, x: 0x222222 })
    expect(words(cells)).toEqual([97, 0x111111, NONE, 0x20, NONE, NONE, 98, 0x111111, NONE])
    expect(words(encode({ art: ['ab'], color: ['x.'] }, { '.': 0x111111, x: 0x222222 }))).toEqual([97, 0x222222, NONE, 98, 0x111111, NONE])
  })

  test('a glyph outside the basic plane is one cell', () => {
    expect(words(encode({ art: ['𝄞'], color: ['.'] }, { '.': 1 }))).toEqual([0x1d11e, 1, NONE])
  })

  test('a glyph frame takes a cell a row, a pixel frame half', () => {
    expect(sizeOf(['ab', 'ab', 'ab'])).toEqual({ columns: 2, rows: 2 })
    expect(sizeOf({ art: ['ab', 'ab', 'ab'], color: ['..', '..', '..'] })).toEqual({ columns: 2, rows: 3 })
    expect(sizeOf({ art: ['𝄞a'], color: ['..'] })).toEqual({ columns: 2, rows: 1 })
  })

  test('mirroring swaps glyphs that point one way, and only flips the mask', () => {
    expect(mirror({ art: ['(o>/'], color: ['ab..'] })).toEqual({ art: ['\\<o)'], color: ['..ba'] })
    expect(mirror({ art: ['╭─╮▶'], color: ['....'] })).toEqual({ art: ['◀╭─╮'], color: ['....'] })
  })
})

describe('pixel frames', () => {
  test('a letter outside the basic plane is one see-through cell, as the frame is measured', () => {
    expect(words(encode(['𝄞a'], { a: 1 }))).toEqual([0x20, NONE, NONE, 0x2580, 1, NONE])
  })
})

describe('facingFrame', () => {
  test('facing right is the frame as drawn; left mirrors it unless the pack does not', () => {
    const frame = ['ab.']
    expect(facingFrame(frame, 1, true)).toBe(frame)
    expect(facingFrame(frame, -1, true)).toEqual(['.ba'])
    expect(facingFrame(frame, -1, false)).toBe(frame)
    const glyphs = { art: ['(o>'], color: ['...'] }
    expect(facingFrame(glyphs, -1, false)).toBe(glyphs)
  })
})
