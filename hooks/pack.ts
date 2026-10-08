import type { Frame, MiniMood, Mood, PackFile, Situation, Traits } from '../types'
import { USUAL } from './drives'
import { hexColor } from './render'
import { SITUATIONS } from './speech'
import type { Colors } from './render'

// Each mood a pack leaves out borrows from its parent, so an old or small pack
// still shows something close. `sleeping` is the root every pack must draw.
export const PARENT: Record<Mood, Mood | null> = {
  sleeping: null,
  deepSleep: 'sleeping',
  idle: 'thinking',
  sleepy: 'idle',
  tired: 'sleepy',
  walking: 'idle',
  watching: 'reading',
  thinking: 'sleeping',
  waking: 'thinking',
  typing: 'thinking',
  running: 'typing',
  writing: 'typing',
  reading: 'thinking',
  searching: 'reading',
  supervising: 'thinking',
  compacting: 'thinking',
  sweating: 'thinking',
  worried: 'sweating',
  grumpy: 'sad',
  proud: 'happy',
  happy: 'sleeping',
  celebrating: 'happy',
  sad: 'sleeping',
}

export const MOODS = Object.keys(PARENT) as Mood[]

export const MINI_MOODS: readonly MiniMood[] = ['working', 'happy', 'sad']

export const DEFAULT_PET = 'cat'

const LIMITS = {
  main: { columns: 48, pixelRows: 32 },
  mini: { columns: 12, pixelRows: 12 },
  framesPerMood: 16,
  variantsPerMood: 4,
  transitions: 32,
  actions: 16,
  everySeconds: { min: 1, max: 600 },
  linesPerSituation: 8,
  lineLength: 40,
  paletteSize: 16,
  fps: { min: 1, max: 12 },
}

export type Action = { name: string; frames: Frame[]; moods: Mood[]; every: [number, number] }

export type Pack = {
  name: string
  colors: Colors
  fps: number
  // The loop each mood plays, borrowed from a parent when the pack leaves it out.
  moods: Record<Mood, Frame[]>
  // More loops for a mood, following the same borrowing as `moods`.
  variants: Record<Mood, Frame[][]>
  transitions: Record<string, Frame[]>
  actions: Action[]
  // null when the pack draws no mini pets: its agents show only as its own `supervising`.
  mini: Record<MiniMood, Frame[]> | null
  tint: string
  // Only a pack that draws `walking` leaves its spot: the rest stay put.
  walks: boolean
  speech: Record<string, Partial<Record<Situation, string[]>>>
  personality: Traits
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

const isMood = (value: unknown): value is Mood => typeof value === 'string' && MOODS.includes(value as Mood)

// Variants hang off a mood the pack draws: one on a borrowed mood would never show.
const parseVariants = (raw: unknown, drawn: Map<Mood, Frame[]>) => {
  const out = new Map<Mood, Frame[][]>()
  if (raw === undefined) return out
  if (!isRecord(raw)) throw new Error('main.variants: an object of mood to loops')
  for (const [mood, loops] of Object.entries(raw)) {
    if (!isMood(mood)) throw new Error(`main.variants: unknown mood ${mood}`)
    if (!drawn.has(mood)) throw new Error(`main.variants.${mood}: draw main.moods.${mood} first`)
    if (!Array.isArray(loops) || loops.length === 0 || loops.length > LIMITS.variantsPerMood) {
      throw new Error(`main.variants.${mood}: 1 to ${LIMITS.variantsPerMood} loops`)
    }
    out.set(mood, loops.map((loop, i) => checkFrames(loop, `main.variants.${mood}[${i}]`, LIMITS.main)))
  }
  return out
}

const TRANSITION = /^(\*|[a-zA-Z]+)>(\*|[a-zA-Z]+)$/

const parseTransitions = (raw: unknown) => {
  const out: Record<string, Frame[]> = {}
  if (raw === undefined) return out
  if (!isRecord(raw)) throw new Error('main.transitions: an object of "from>to" to frames')
  const entries = Object.entries(raw)
  if (entries.length > LIMITS.transitions) throw new Error(`main.transitions: at most ${LIMITS.transitions}`)
  for (const [key, frames] of entries) {
    const [, from, to] = TRANSITION.exec(key) ?? []
    const known = (side: string | undefined) => side === '*' || isMood(side)
    if (!known(from) || !known(to) || key === '*>*') {
      throw new Error(`main.transitions: "${key}" must be "from>to" with moods or one "*"`)
    }
    out[key] = checkFrames(frames, `main.transitions.${key}`, LIMITS.main)
  }
  return out
}

const ACTION_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/

const parseActions = (raw: unknown): Action[] => {
  if (raw === undefined) return []
  if (!isRecord(raw)) throw new Error('main.actions: an object of name to action')
  const entries = Object.entries(raw)
  if (entries.length > LIMITS.actions) throw new Error(`main.actions: at most ${LIMITS.actions}`)
  return entries.map(([name, action]) => {
    const where = `main.actions.${name}`
    if (!ACTION_NAME.test(name)) throw new Error(`${where}: name with letters, digits, - or _ (up to 32)`)
    if (!isRecord(action)) throw new Error(`${where}: needs frames, moods and every`)
    const { moods, every } = action
    if (!Array.isArray(moods) || moods.length === 0 || !moods.every(isMood)) throw new Error(`${where}.moods: a list of moods`)
    const { min, max } = LIMITS.everySeconds
    if (
      !Array.isArray(every) ||
      every.length !== 2 ||
      !every.every(n => typeof n === 'number' && n >= min && n <= max) ||
      every[0] > every[1]
    ) {
      throw new Error(`${where}.every: [min, max] seconds, ${min} to ${max}`)
    }
    return { name, frames: checkFrames(action.frames, `${where}.frames`, LIMITS.main), moods, every: [every[0], every[1]] }
  })
}

// Each trait a number from 0 to 1; one left out is the usual.
const parsePersonality = (raw: unknown): Traits => {
  if (raw === undefined) return USUAL
  if (!isRecord(raw)) throw new Error('personality: an object of trait to a number from 0 to 1')
  const traits = { ...USUAL }
  for (const [trait, value] of Object.entries(raw)) {
    if (!Object.hasOwn(USUAL, trait)) throw new Error(`personality.${trait}: unknown trait, use ${Object.keys(USUAL).join(', ')}`)
    if (typeof value !== 'number' || !(value >= 0 && value <= 1)) throw new Error(`personality.${trait}: a number from 0 to 1`)
    traits[trait as keyof Traits] = value
  }
  return traits
}

const LANGUAGE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/

// Lines are shown as they are: plain one-line text, short enough for the band.
const parseSpeech = (raw: unknown) => {
  const out: Record<string, Partial<Record<Situation, string[]>>> = {}
  if (raw === undefined) return out
  if (!isRecord(raw)) throw new Error('speech: an object of language to situations')
  for (const [code, situations] of Object.entries(raw)) {
    if (!LANGUAGE.test(code)) throw new Error(`speech: "${code}" is not a language code like "en" or "pt-BR"`)
    if (!isRecord(situations)) throw new Error(`speech.${code}: an object of situation to lines`)
    const lines: Partial<Record<Situation, string[]>> = {}
    for (const [situation, list] of Object.entries(situations)) {
      const where = `speech.${code}.${situation}`
      if (!SITUATIONS.includes(situation as Situation)) throw new Error(`${where}: unknown situation, use ${SITUATIONS.join(', ')}`)
      const { linesPerSituation: most, lineLength: longest } = LIMITS
      if (
        !Array.isArray(list) ||
        list.length === 0 ||
        list.length > most ||
        !list.every(line => typeof line === 'string' && line.trim() !== '' && line.length <= longest && !/[\u0000-\u001f\u007f]/.test(line))
      ) {
        throw new Error(`${where}: 1 to ${most} lines of one line each, up to ${longest} characters`)
      }
      lines[situation as Situation] = list
    }
    out[code] = lines
  }
  return out
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
  const extra = parseVariants(file.main.variants, drawn)
  const moods = {} as Record<Mood, Frame[]>
  const variants = {} as Record<Mood, Frame[][]>
  for (const mood of MOODS) {
    let source: Mood | null = mood
    while (source !== null && !drawn.has(source)) source = PARENT[source]
    moods[mood] = drawn.get(source ?? 'sleeping') ?? []
    variants[mood] = extra.get(source ?? 'sleeping') ?? []
  }
  const transitions = parseTransitions(file.main.transitions)
  const actions = parseActions(file.main.actions)
  sameSize(
    [...drawn.values(), ...[...extra.values()].flat(), ...Object.values(transitions), ...actions.map(a => a.frames)].flat(),
    'main',
  )

  const { mini, tint } = file.mini === false ? { mini: null, tint: 'b' } : parseMini(file.mini, colors)

  const speech = parseSpeech(file.speech)
  const personality = parsePersonality(file.personality)

  return { name: file.name, colors, fps, moods, variants, transitions, actions, mini, tint, walks: drawn.has('walking'), speech, personality }
}

const parseMini = (raw: unknown, colors: Colors) => {
  if (!isRecord(raw) || !isRecord(raw.moods)) throw new Error('mini.moods: required, or mini: false for no mini pets')
  const miniGiven = raw.moods as Record<string, unknown>
  if (miniGiven.working === undefined) throw new Error('mini.moods.working: required, happy and sad fall back to it')
  const miniUnknown = Object.keys(miniGiven).filter(key => !MINI_MOODS.includes(key as MiniMood))
  if (miniUnknown.length > 0) throw new Error(`mini.moods: unknown mood ${miniUnknown.join(', ')}`)
  const working = checkFrames(miniGiven.working, 'mini.moods.working', LIMITS.mini)
  const mini = { working } as Record<MiniMood, Frame[]>
  for (const mood of MINI_MOODS) {
    mini[mood] = miniGiven[mood] === undefined ? working : checkFrames(miniGiven[mood], `mini.moods.${mood}`, LIMITS.mini)
  }
  sameSize(MINI_MOODS.flatMap(mood => mini[mood]), 'mini')
  const tint = raw.tint ?? 'b'
  if (typeof tint !== 'string' || colors[tint] === undefined) throw new Error('mini.tint: must be a palette letter')
  return { mini, tint }
}

const SAFE_NAME = /^[a-z0-9][a-z0-9_-]{0,40}$/

// Where a pet named `name` may live, the person's own pets folder first.
// Undefined for a name that could step outside those folders.
export const packPaths = (name: string, home: string | undefined, root: string) =>
  SAFE_NAME.test(name)
    ? [...(home ? [`${home}/.claude/pets/${name}.json`] : []), `${root}/pets/${name}.json`]
    : undefined
