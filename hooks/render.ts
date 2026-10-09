import type { Frame, Glyphs } from '../types'

const NONE = 0x01000000
const HALF_TOP = 0x2580
const HALF_BOTTOM = 0x2584

export type Colors = Record<string, number>

export const hexColor = (hex: string) => Number.parseInt(hex.slice(1), 16)

export const isGlyphs = (frame: Frame): frame is Glyphs => !Array.isArray(frame)

export const rowsOf = (frame: Frame) => (isGlyphs(frame) ? frame.art : frame)

// In cells: a glyph outside the basic plane is one, not two UTF-16 units.
export const widthOf = (row: string | undefined) => [...(row ?? '')].length

export const sizeOf = (frame: Frame) => {
  const rows = rowsOf(frame)
  return { columns: widthOf(rows[0]), rows: isGlyphs(frame) ? rows.length : Math.ceil(rows.length / 2) }
}

// Two pixel rows share one terminal cell: '▀' takes the top as foreground
// and the bottom as background. Letters missing from the palette are see-through.
const pixelWords = (frame: string[], colors: Colors) => {
  const words: number[] = []
  for (let r = 0; r < frame.length; r += 2) {
    // By code point, as `widthOf` measures the frame.
    const top = [...(frame[r] ?? '')]
    const bottom = [...(frame[r + 1] ?? '')]
    for (let c = 0; c < top.length; c++) {
      const up = colors[top[c] ?? '.']
      const down = colors[bottom[c] ?? '.']
      if (up === undefined && down === undefined) words.push(0x20, NONE, NONE)
      else if (up === undefined) words.push(HALF_BOTTOM, down ?? NONE, NONE)
      else words.push(HALF_TOP, up, down ?? NONE)
    }
  }
  return words
}

// One glyph a cell, in its mask's color; '.' in the mask is the pack's ink.
const glyphWords = ({ art, color }: Glyphs, colors: Colors) =>
  art.flatMap((row, r) => {
    const mask = [...(color[r] ?? '')]
    return [...row].flatMap((glyph, c) =>
      glyph === ' ' ? [0x20, NONE, NONE] : [glyph.codePointAt(0) ?? 0x20, colors[mask[c] ?? '.'] ?? NONE, NONE],
    )
  })

export const encode = (frame: Frame, colors: Colors) => {
  const words = isGlyphs(frame) ? glyphWords(frame, colors) : pixelWords(frame, colors)
  // The engine's runtime has TC39 base64; TypeScript's es2023 lib does not type it.
  const bytes = new Uint8Array(Uint32Array.from(words).buffer) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}

// Glyphs that point one way swap for their twin when the art is flipped.
const SWAP: Record<string, string> = {}
for (const pair of ['/\\', '()', '<>', '[]', '{}', 'db', 'pq', '‹›', '«»', '╱╲', '┌┐', '└┘', '├┤', '╭╮', '╰╯', '▌▐', '◀▶', '◄►', '⊂⊃']) {
  const [a = '', b = ''] = [...pair]
  SWAP[a] = b
  SWAP[b] = a
}

const flip = (row: string) => [...row].reverse().join('')

// The same frame facing the other way. Packs draw their pet facing right.
export const mirror = (frame: Frame): Frame =>
  isGlyphs(frame)
    ? { art: frame.art.map(row => [...row].reverse().map(glyph => SWAP[glyph] ?? glyph).join('')), color: frame.color.map(flip) }
    : frame.map(flip)

// The frame as drawn facing `side`; a pack that does not mirror faces you either way.
export const facingFrame = (frame: Frame, side: 1 | -1, mirrors: boolean) => (side === 1 || !mirrors ? frame : mirror(frame))
