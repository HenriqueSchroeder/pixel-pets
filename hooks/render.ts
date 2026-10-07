import type { Frame } from '../types'

const NONE = 0x01000000
const HALF_TOP = 0x2580
const HALF_BOTTOM = 0x2584

export type Colors = Record<string, number>

export const hexColor = (hex: string) => Number.parseInt(hex.slice(1), 16)

export const sizeOf = (frame: Frame) => ({ columns: frame[0]?.length ?? 0, rows: Math.ceil(frame.length / 2) })

// Two pixel rows share one terminal cell: '▀' takes the top as foreground
// and the bottom as background. Letters missing from the palette are see-through.
export const encode = (frame: Frame, colors: Colors) => {
  const words: number[] = []
  for (let r = 0; r < frame.length; r += 2) {
    const top = frame[r] ?? ''
    const bottom = frame[r + 1] ?? ''
    for (let c = 0; c < top.length; c++) {
      const up = colors[top[c] ?? '.']
      const down = colors[bottom[c] ?? '.']
      if (up === undefined && down === undefined) words.push(0x20, NONE, NONE)
      else if (up === undefined) words.push(HALF_BOTTOM, down ?? NONE, NONE)
      else words.push(HALF_TOP, up, down ?? NONE)
    }
  }
  // The engine's runtime has TC39 base64; TypeScript's es2023 lib does not type it.
  const bytes = new Uint8Array(Uint32Array.from(words).buffer) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}

// The same frame facing the other way. Packs draw their pet facing right.
export const mirror = (frame: Frame): Frame => frame.map(row => [...row].reverse().join(''))
