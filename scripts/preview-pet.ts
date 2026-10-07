// Draws every mood of a pack in your terminal, frames side by side:
//   npx tsx scripts/preview-pet.ts cat
//   npx tsx scripts/preview-pet.ts ~/.claude/pets/mine.json
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { MINI_MOODS, MOODS, PARENT, parsePack } from '../hooks/pack'
import type { Frame } from '../types'

const args = process.argv.slice(2)
const arg = args.find(one => !one.startsWith('--')) ?? 'cat'
const path = existsSync(arg) ? arg : join(import.meta.dirname, '..', 'pets', `${arg}.json`)
const pack = parsePack(JSON.parse(readFileSync(path, 'utf8')))

// The pack as the plugin sees it, every mood filled in: what render-gif.py draws from.
if (args.includes('--json')) {
  console.log(JSON.stringify(pack))
  process.exit(0)
}

const rgb = (color: number) => `${(color >> 16) & 255};${(color >> 8) & 255};${color & 255}`

// The same trick as the plugin: '▀' paints the top pixel, its background the bottom one.
const lines = (frame: Frame, colors: Record<string, number>) => {
  const out: string[] = []
  for (let r = 0; r < frame.length; r += 2) {
    let line = ''
    for (let c = 0; c < (frame[r]?.length ?? 0); c++) {
      const up = colors[frame[r]?.[c] ?? '.']
      const down = colors[frame[r + 1]?.[c] ?? '.']
      if (up === undefined && down === undefined) line += ' '
      else if (up === undefined) line += `\x1b[38;2;${rgb(down ?? 0)}m▄\x1b[0m`
      else line += `\x1b[38;2;${rgb(up)}m${down === undefined ? '' : `\x1b[48;2;${rgb(down)}m`}▀\x1b[0m`
    }
    out.push(line)
  }
  return out
}

const row = (title: string, frames: Frame[], colors: Record<string, number>) => {
  console.log(`\x1b[1m${title}\x1b[0m \x1b[2m(${frames.length} frame${frames.length === 1 ? '' : 's'})\x1b[0m`)
  const drawn = frames.map(frame => lines(frame, colors))
  for (let i = 0; i < (drawn[0]?.length ?? 0); i++) console.log(`  ${drawn.map(d => d[i]).join('   ')}`)
  console.log()
}

console.log(`\n${pack.name} · ${pack.fps} fps\n`)
for (const mood of MOODS) {
  const parent = PARENT[mood]
  const borrowed = parent !== null && pack.moods[mood] === pack.moods[parent] ? ` → borrows from ${parent}` : ''
  row(`${mood}${borrowed}`, pack.moods[mood], pack.colors)
}
for (const mood of MINI_MOODS) row(`mini ${mood} (tint "${pack.tint}")`, pack.mini[mood], { ...pack.colors, [pack.tint]: 0x7cc4f2 })
