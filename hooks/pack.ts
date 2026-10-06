import type { Frame, MiniMood, Mood, PackFile } from '../types'
import { hexColor } from './render'
import type { Colors } from './render'

// Each mood a pack leaves out borrows from its parent, so an old or small pack
// still shows something close. `sleeping` is the root every pack must draw.
export const PARENT: Record<Mood, Mood | null> = {
  sleeping: null,
  deepSleep: 'sleeping',
  thinking: 'sleeping',
  waking: 'thinking',
  typing: 'thinking',
  running: 'typing',
  writing: 'typing',
  reading: 'thinking',
  searching: 'reading',
  waiting: 'thinking',
  compacting: 'thinking',
  sweating: 'thinking',
  happy: 'sleeping',
  sad: 'sleeping',
}

export const MOODS = Object.keys(PARENT) as Mood[]

export const MINI_MOODS: readonly MiniMood[] = ['working', 'happy', 'sad']

export const DEFAULT_PET = 'cat'

const LIMITS = {
  main: { columns: 24, pixelRows: 24 },
  mini: { columns: 12, pixelRows: 12 },
  framesPerMood: 8,
  paletteSize: 16,
  fps: { min: 1, max: 12 },
}

export type Pack = {
  name: string
  colors: Colors
  fps: number
  moods: Record<Mood, Frame[]>
  mini: Record<MiniMood, Frame[]>
  tint: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const checkFrames = (frames: unknown, where: string, limit: { columns: number; pixelRows: number }): Frame[] => {
  if (!Array.isArray(frames) || frames.length === 0) throw new Error(`${where}: needs at least one frame`)
  if (frames.length > LIMITS.framesPerMood) throw new Error(`${where}: at most ${LIMITS.framesPerMood} frames`)
  return frames.map((frame, i) => {
    if (!Array.isArray(frame) || frame.length === 0 || !frame.every(row => typeof row === 'string')) {
      throw new Error(`${where}[${i}]: a frame is a list of strings`)
    }
    const rows = frame as string[]
    const width = rows[0]?.length ?? 0
    if (width === 0 || rows.some(row => row.length !== width)) throw new Error(`${where}[${i}]: every row needs the same length`)
    if (width > limit.columns || rows.length > limit.pixelRows) {
      throw new Error(`${where}[${i}]: at most ${limit.columns}x${limit.pixelRows} pixels`)
    }
    return rows
  })
}

const sameSize = (frames: Frame[], where: string) => {
  const [first] = frames
  if (frames.some(f => f.length !== first?.length || f[0]?.length !== first?.[0]?.length)) {
    throw new Error(`${where}: every frame needs the same size`)
  }
}

// Packs come from anyone, so everything is checked before it reaches the renderer.
export const parsePack = (raw: unknown): Pack => {
  if (!isRecord(raw)) throw new Error('a pack is a JSON object')
  const file = raw as Partial<PackFile>

  if (typeof file.name !== 'string' || file.name === '') throw new Error('name: required')

  if (!isRecord(file.palette)) throw new Error('palette: required')
  const entries = Object.entries(file.palette)
  if (entries.length > LIMITS.paletteSize) throw new Error(`palette: at most ${LIMITS.paletteSize} colors`)
  const colors: Colors = {}
  for (const [letter, hex] of entries) {
    if (letter.length !== 1 || letter === '.') throw new Error(`palette: "${letter}" must be one character other than "."`)
    if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`palette.${letter}: use #rrggbb`)
    colors[letter] = hexColor(hex)
  }

  const fps = file.fps ?? 4
  if (typeof fps !== 'number' || fps < LIMITS.fps.min || fps > LIMITS.fps.max) {
    throw new Error(`fps: between ${LIMITS.fps.min} and ${LIMITS.fps.max}`)
  }

  if (!isRecord(file.main) || !isRecord(file.main.moods)) throw new Error('main.moods: required')
  const given = file.main.moods as Record<string, unknown>
  if (given.sleeping === undefined) throw new Error('main.moods.sleeping: required, other moods fall back to it')
  const unknown = Object.keys(given).filter(key => !MOODS.includes(key as Mood))
  if (unknown.length > 0) throw new Error(`main.moods: unknown mood ${unknown.join(', ')}`)

  const drawn = new Map<Mood, Frame[]>()
  for (const mood of MOODS) {
    if (given[mood] !== undefined) drawn.set(mood, checkFrames(given[mood], `main.moods.${mood}`, LIMITS.main))
  }
  const moods = {} as Record<Mood, Frame[]>
  for (const mood of MOODS) {
    let source: Mood | null = mood
    while (source !== null && !drawn.has(source)) source = PARENT[source]
    moods[mood] = drawn.get(source ?? 'sleeping') ?? []
  }
  sameSize([...drawn.values()].flat(), 'main')

  if (!isRecord(file.mini) || !isRecord(file.mini.moods)) throw new Error('mini.moods: required')
  const miniGiven = file.mini.moods as Record<string, unknown>
  if (miniGiven.working === undefined) throw new Error('mini.moods.working: required, happy and sad fall back to it')
  const miniUnknown = Object.keys(miniGiven).filter(key => !MINI_MOODS.includes(key as MiniMood))
  if (miniUnknown.length > 0) throw new Error(`mini.moods: unknown mood ${miniUnknown.join(', ')}`)
  const working = checkFrames(miniGiven.working, 'mini.moods.working', LIMITS.mini)
  const mini = { working } as Record<MiniMood, Frame[]>
  for (const mood of MINI_MOODS) {
    mini[mood] = miniGiven[mood] === undefined ? working : checkFrames(miniGiven[mood], `mini.moods.${mood}`, LIMITS.mini)
  }
  sameSize(MINI_MOODS.flatMap(mood => mini[mood]), 'mini')
  const tint = file.mini.tint ?? 'b'
  if (typeof tint !== 'string' || colors[tint] === undefined) throw new Error('mini.tint: must be a palette letter')

  return { name: file.name, colors, fps, moods, mini, tint }
}

const SAFE_NAME = /^[a-z0-9][a-z0-9_-]{0,40}$/

// Where a pet named `name` may live, the person's own pets folder first.
// Undefined for a name that could step outside those folders.
export const packPaths = (name: string, home: string | undefined, root: string) =>
  SAFE_NAME.test(name)
    ? [...(home ? [`${home}/.claude/pets/${name}.json`] : []), `${root}/pets/${name}.json`]
    : undefined
