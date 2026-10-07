// Draws every mood of a pack in your terminal, frames side by side:
//   npx tsx scripts/preview-pet.ts cat
//   npx tsx scripts/preview-pet.ts ~/.claude/pets/mine.json
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { step } from '../hooks/motion'
import type { Motion } from '../hooks/motion'
import { MINI_MOODS, MOODS, PARENT, parsePack } from '../hooks/pack'
import { mirror } from '../hooks/render'
import { gather, walkStep } from '../hooks/walk'
import type { Plan, Side, Walk } from '../hooks/walk'
import type { Frame, Mood } from '../types'

const args = process.argv.slice(2)
const arg = args.find(one => !one.startsWith('--')) ?? 'cat'
const path = existsSync(arg) ? arg : join(import.meta.dirname, '..', 'pets', `${arg}.json`)
const pack = parsePack(JSON.parse(readFileSync(path, 'utf8')))

// The pack as the plugin sees it, every mood filled in: what render-gif.py draws from.
if (args.includes('--json')) {
  console.log(JSON.stringify(pack))
  process.exit(0)
}

// Reads a JSON list of ticks, each `{ mood, plan, room, agents, width }` (the
// agents by id, each `width` columns), and prints the main pet's frame, column
// and the agents on each side for each, as the plugin would play, walk and
// gather them. Seeded, so a GIF renders the same twice.
if (args.includes('--play')) {
  let seed = 4
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  type Tick = { mood: Mood; plan: Plan; room: number; agents: string[]; width: number }
  const ticks = JSON.parse(readFileSync(0, 'utf8')) as Tick[]
  let motion: Motion | undefined
  let walk: Walk | undefined
  let sides = new Map<string, Side>()
  const played = ticks.map(({ mood, plan, room, agents, width }, tick) => {
    const walked = walkStep(walk, pack.walks ? plan : 'stay', tick, room, pack.fps, random)
    const placed = gather(walked.walk.x, room, agents.length, width, 0, agents.map(id => sides.get(id)))
    walk = placed.x === walked.walk.x ? walked.walk : { ...walked.walk, x: placed.x, target: placed.x }
    const sideOf = (index: number): Side => (placed.right.includes(index) ? 1 : -1)
    sides = new Map(agents.map((id, i) => [id, sideOf(i)]))
    const moved = step(pack, motion, walked.moving ? 'walking' : mood, tick, random)
    motion = moved.motion
    const facing = agents.length === 0 ? walk.facing : sideOf(0)
    const frame = facing === 1 ? moved.frame : mirror(moved.frame)
    return { frame, x: walk.x, left: placed.left, right: placed.right, moving: walked.moving }
  })
  console.log(JSON.stringify(played))
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
for (const [mood, loops] of Object.entries(pack.variants)) {
  // Variants follow the borrowing, so only show them on the mood that drew them.
  if (loops.length > 0 && pack.moods[mood as Mood] !== pack.moods[PARENT[mood as Mood] ?? 'sleeping']) {
    loops.forEach((loop, i) => row(`${mood} variant ${i + 1}`, loop, pack.colors))
  }
}
for (const [key, frames] of Object.entries(pack.transitions)) row(`transition ${key}`, frames, pack.colors)
for (const action of pack.actions) row(`action ${action.name} (${action.moods.join(', ')}, every ${action.every.join('-')}s)`, action.frames, pack.colors)
for (const mood of MINI_MOODS) row(`mini ${mood} (tint "${pack.tint}")`, pack.mini[mood], { ...pack.colors, [pack.tint]: 0x7cc4f2 })
