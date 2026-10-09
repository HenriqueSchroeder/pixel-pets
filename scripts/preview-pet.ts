// Draws every mood of a pack in your terminal, frames side by side:
//   npx tsx scripts/preview-pet.ts cat
//   npx tsx scripts/preview-pet.ts ~/.claude/pets/mine.json
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { step } from '../hooks/motion'
import type { Motion } from '../hooks/motion'
import { MINI_MOODS, MOODS, PARENT, parsePack } from '../hooks/pack'
import { facingFrame, isGlyphs } from '../hooks/render'
import { EMPTY_STAGE, faceFor, holdFacing, moveOnStage } from '../hooks/walk'
import type { Held, Plan, Stage } from '../hooks/walk'
import type { Frame, Mood } from '../types'

const args = process.argv.slice(2)
const arg = args.find(one => !one.startsWith('--')) ?? 'cat'
const path = existsSync(arg) ? arg : join(import.meta.dirname, '..', 'pets', `${arg}.json`)
const pack = parsePack(JSON.parse(readFileSync(path, 'utf8')))

// Reads a JSON list of ticks, each `{ mood, plan, room, agents, width, leaving }`
// (the agents by id, each `width` columns; `leaving`, the ids saying goodbye) and
// prints the main pet's frame, column and the agents on each side for each, as
// the plugin would play, walk or teleport and gather them, through the same
// moveOnStage. `plan` is what it does alone; with agents it makes room for them.
// Seeded, so a GIF renders the same twice.
const play = () => {
  let seed = 14
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  type Tick = { mood: Mood; plan: Plan; room: number; agents: string[]; width: number; leaving?: string[] }
  const ticks = JSON.parse(readFileSync(0, 'utf8')) as Tick[]
  const teleport = pack.walks ? null : pack.teleport
  let motion: Motion | undefined
  let stage: Stage = EMPTY_STAGE
  let heldFacing: Held
  return ticks.map(({ mood, plan, room, agents, width, leaving = [] }, tick) => {
    const onStage = moveOnStage(stage, {
      tick,
      room,
      fps: pack.fps,
      random,
      pace: { rest: 1, lean: 0 },
      walks: pack.walks,
      teleport: teleport === null ? null : { vanish: teleport.vanish.length, appear: teleport.appear.length },
      agents,
      width,
      extra: 0,
      wants: placed => (agents.length > 0 ? { go: placed.x } : plan),
    })
    stage = onStage.stage
    const { drawn, drawnCount, blinking } = onStage
    const moved = step(pack, motion, pack.walks && onStage.moving ? 'walking' : mood, tick, random)
    motion = moved.motion
    const blinkFrame = teleport === null || blinking === undefined ? undefined : teleport[blinking.phase][blinking.at]
    const isOnTheMove = onStage.moving || blinkFrame !== undefined
    const finishing = agents.slice(0, drawnCount).findLastIndex(id => leaving.includes(id))
    const facesNow = faceFor(isOnTheMove, stage.walk?.facing ?? 1, drawn, Math.max(finishing, 0))
    const once = moved.motion.once
    const held = holdFacing(heldFacing, once?.isAction ? once : undefined, facesNow, isOnTheMove)
    heldFacing = held.held
    const facing = held.side
    const shape = blinkFrame ?? moved.frame
    const frame = facingFrame(shape, facing, pack.mirrors)
    const at = { frame, x: onStage.standX, left: drawn.left, right: drawn.right, moving: isOnTheMove }
    return { ...at, facing, startled: moved.startled }
  })
}

const rgb = (color: number) => `${(color >> 16) & 255};${(color >> 8) & 255};${color & 255}`

// The same trick as the plugin: '▀' paints the top pixel, its background the bottom one.
// An ascii frame is its glyphs, each in its mask's color.
const lines = (frame: Frame, colors: Record<string, number>) => {
  if (isGlyphs(frame)) {
    return frame.art.map((row, r) => {
      const mask = [...(frame.color[r] ?? '')]
      return [...row].map((glyph, c) => (glyph === ' ' ? ' ' : `\x1b[38;2;${rgb(colors[mask[c] ?? '.'] ?? 0)}m${glyph}\x1b[0m`)).join('')
    })
  }
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

const preview = () => {
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
  if (pack.mini !== null) for (const mood of MINI_MOODS) row(`mini ${mood} (tint "${pack.tint}")`, pack.mini[mood], { ...pack.colors, [pack.tint]: 0x7cc4f2 })
}

// --json prints the pack as the plugin sees it, every mood filled in: what the
// render scripts draw from. No process.exit after printing: stdout to a pipe is
// asynchronous, and exiting straight away cut a big pack off at 64 KB.
if (args.includes('--json')) console.log(JSON.stringify(pack))
else if (args.includes('--play')) console.log(JSON.stringify(play()))
else preview()
