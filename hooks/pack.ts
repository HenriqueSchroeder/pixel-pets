import type { Frame, MiniMood, Mood, PackFile, Situation, Traits } from '../types'
import { USUAL } from './drives'
import { hexColor, rowsOf, widthOf } from './render'
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

// Moods of a turn at work.
export const WORK: ReadonlySet<Mood> = new Set(['thinking', 'typing', 'running', 'writing', 'reading', 'searching', 'supervising'])

export const MINI_MOODS: readonly MiniMood[] = ['working', 'happy', 'sad', 'startled']

export const DEFAULT_PET = 'cat'

const LIMITS = {
  main: { columns: 48, pixelRows: 32 },
  mini: { columns: 12, pixelRows: 12 },
  framesPerMood: 16,
  variantsPerMood: 4,
  transitions: 32,
  actions: 16,
  activities: 8,
  activitySeconds: { min: 5, max: 300 },
  everySeconds: { min: 1, max: 600 },
  linesPerSituation: 8,
  lineLength: 40,
  paletteSize: 16,
  fps: { min: 1, max: 12 },
}

// A longer scene: `frames` (its start) once, `loop` for `seconds`, `end` once.
export type Activity = { loop: Frame[]; seconds: [number, number]; end: Frame[]; label: Record<string, string> }

export type Action = { name: string; frames: Frame[]; moods: Mood[]; every: [number, number]; startles?: number; activity?: Activity }

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
  // false: the pet never flips, facing you whichever way it goes.
  mirrors: boolean
  // Only a pack that draws `walking` leaves its spot by walking; one that draws
  // `teleport` and no `walking` gets about by vanishing and appearing.
  walks: boolean
  // The moods it draws itself, rather than borrows.
  drawn: ReadonlySet<Mood>
  teleport: { vanish: Frame[]; appear: Frame[] } | null
  speech: Record<string, Partial<Record<Situation, string[]>>>
  personality: Traits
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type Limit = { columns: number; pixelRows: number }
type CheckFrames = (frames: unknown, where: string, limit: Limit) => Frame[]

const isRows = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(row => typeof row === 'string')

// What a terminal does not draw one cell wide: wide (CJK, Hangul, fullwidth, emoji),
// zero-width and control characters.
const NOT_ONE_CELL =
  /[\p{Cc}\p{Cf}\p{M}\p{Emoji_Presentation}\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\u{20000}-\u{3fffd}]/u

// An ascii frame is its art, or its art and a mask of palette letters ('.' the ink).
const toGlyphs = (frame: unknown, where: string, colors: Colors): Frame => {
  const given = Array.isArray(frame) ? { art: frame } : isRecord(frame) ? frame : {}
  if (!isRows(given.art)) throw new Error(`${where}: a frame is a list of strings, or { art, color }`)
  const art = given.art
  const wide = NOT_ONE_CELL.exec(art.join(''))
  if (wide !== null) throw new Error(`${where}: ${JSON.stringify(wide[0])} does not draw one cell wide`)
  const { color } = given
  if (color === undefined) return { art, color: art.map(row => '.'.repeat(widthOf(row))) }
  if (!isRows(color) || color.length !== art.length || color.some((row, r) => widthOf(row) !== widthOf(art[r]))) {
    throw new Error(`${where}.color: same rows and widths as art`)
  }
  const stray = [...color.join('')].find(letter => colors[letter] === undefined)
  if (stray !== undefined) throw new Error(`${where}.color: "${stray}" is not in the palette, use "." for ink`)
  return { art, color }
}

const framesChecker =
  (ascii: boolean, colors: Colors): CheckFrames =>
  (frames, where, limit) => {
    if (!Array.isArray(frames) || frames.length === 0) throw new Error(`${where}: needs at least one frame`)
    if (frames.length > LIMITS.framesPerMood) throw new Error(`${where}: at most ${LIMITS.framesPerMood} frames`)
    return frames.map((raw, i) => {
      const at = `${where}[${i}]`
      if (!ascii && !isRows(raw)) throw new Error(`${at}: a frame is a list of strings`)
      const frame = ascii ? toGlyphs(raw, at, colors) : (raw as string[])
      const rows = rowsOf(frame)
      const width = widthOf(rows[0])
      if (width === 0 || rows.some(row => widthOf(row) !== width)) throw new Error(`${at}: every row needs the same length`)
      // An ascii row is a whole cell, two pixel rows: the same room on the terminal.
      const height = ascii ? limit.pixelRows / 2 : limit.pixelRows
      if (width > limit.columns || rows.length > height) {
        throw new Error(`${at}: at most ${limit.columns}x${height} ${ascii ? 'cells' : 'pixels'}`)
      }
      return frame
    })
  }

const sameSize = (frames: Frame[], where: string) => {
  const [first] = frames
  const size = (frame: Frame | undefined) => {
    const rows = frame === undefined ? [] : rowsOf(frame)
    return `${widthOf(rows[0])}x${rows.length}`
  }
  if (frames.some(f => size(f) !== size(first))) {
    throw new Error(`${where}: every frame needs the same size`)
  }
}

const isMood = (value: unknown): value is Mood => typeof value === 'string' && MOODS.includes(value as Mood)

// Variants hang off a mood the pack draws: one on a borrowed mood would never show.
const parseVariants = (checkFrames: CheckFrames, raw: unknown, drawn: Map<Mood, Frame[]>) => {
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

const parseTransitions = (checkFrames: CheckFrames, raw: unknown) => {
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

const LANGUAGE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/

// Plain one-line text, short enough for the band.
const isLine = (line: unknown): line is string =>
  typeof line === 'string' && line.trim() !== '' && line.length <= LIMITS.lineLength && !/[\u0000-\u001f\u007f]/.test(line)

const checkMoods = (moods: unknown, where: string): Mood[] => {
  if (!Array.isArray(moods) || moods.length === 0 || !moods.every(isMood)) throw new Error(`${where}.moods: a list of moods`)
  return moods
}

const checkRange = (range: unknown, where: string, { min, max }: { min: number; max: number }): [number, number] => {
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !range.every(n => typeof n === 'number' && n >= min && n <= max) ||
    range[0] > range[1]
  ) {
    throw new Error(`${where}: [min, max] seconds, ${min} to ${max}`)
  }
  return [range[0], range[1]]
}

const parseActions = (checkFrames: CheckFrames, raw: unknown): Action[] => {
  if (raw === undefined) return []
  if (!isRecord(raw)) throw new Error('main.actions: an object of name to action')
  const entries = Object.entries(raw)
  if (entries.length > LIMITS.actions) throw new Error(`main.actions: at most ${LIMITS.actions}`)
  return entries.map(([name, action]) => {
    const where = `main.actions.${name}`
    if (!ACTION_NAME.test(name)) throw new Error(`${where}: name with letters, digits, - or _ (up to 32)`)
    if (!isRecord(action)) throw new Error(`${where}: needs frames, moods and every`)
    const moods = checkMoods(action.moods, where)
    const every = checkRange(action.every, `${where}.every`, LIMITS.everySeconds)
    const frames = checkFrames(action.frames, `${where}.frames`, LIMITS.main)
    const { startles } = action
    if (startles === undefined) return { name, frames, moods, every }
    if (typeof startles !== 'number' || !Number.isInteger(startles) || startles < 0 || startles >= frames.length) {
      throw new Error(`${where}.startles: one of its frames, 0 to ${frames.length - 1}`)
    }
    return { name, frames, moods, every, startles }
  })
}

// Where an activity can play: idle, or what stands in for it, and at work, where it
// is something the pet drifts off to now and then. Walking would cut it at once, and
// sleep would fight it.
const PASTIMES: ReadonlySet<Mood> = new Set(['idle', 'proud', 'sleepy', 'tired', 'worried', 'grumpy', ...WORK])

const parseActivities = (checkFrames: CheckFrames, raw: unknown, taken: ReadonlySet<string>): Action[] => {
  if (raw === undefined) return []
  if (!isRecord(raw)) throw new Error('main.activities: an object of name to activity')
  const entries = Object.entries(raw)
  if (entries.length > LIMITS.activities) throw new Error(`main.activities: at most ${LIMITS.activities}`)
  return entries.map(([name, activity]) => {
    const where = `main.activities.${name}`
    if (!ACTION_NAME.test(name)) throw new Error(`${where}: name with letters, digits, - or _ (up to 32)`)
    // Actions and activities keep their timers side by side, by name.
    if (taken.has(name)) throw new Error(`${where}: an action has this name already`)
    if (!isRecord(activity)) throw new Error(`${where}: needs loop, seconds, moods and every`)
    const optional = (frames: unknown, part: string) => (frames === undefined ? [] : checkFrames(frames, `${where}.${part}`, LIMITS.main))
    const label: Record<string, string> = {}
    if (activity.label !== undefined) {
      if (!isRecord(activity.label)) throw new Error(`${where}.label: an object of language to words`)
      for (const [code, words] of Object.entries(activity.label)) {
        if (!LANGUAGE.test(code)) throw new Error(`${where}.label: "${code}" is not a language code like "en" or "pt-BR"`)
        if (!isLine(words)) throw new Error(`${where}.label.${code}: one line, up to ${LIMITS.lineLength} characters`)
        label[code] = words
      }
    }
    const moods = checkMoods(activity.moods, where)
    const restless = moods.find(mood => !PASTIMES.has(mood))
    if (restless !== undefined) throw new Error(`${where}.moods: "${restless}" is not a mood it can pass the time in (${new Intl.ListFormat('en', { type: 'disjunction' }).format([...PASTIMES])})`)
    return {
      name,
      frames: optional(activity.start, 'start'),
      moods,
      every: checkRange(activity.every, `${where}.every`, LIMITS.everySeconds),
      activity: {
        loop: checkFrames(activity.loop, `${where}.loop`, LIMITS.main),
        seconds: checkRange(activity.seconds, `${where}.seconds`, LIMITS.activitySeconds),
        end: optional(activity.end, 'end'),
        label,
      },
    }
  })
}

const parseTeleport = (checkFrames: CheckFrames, raw: unknown) => {
  if (raw === undefined) return null
  if (!isRecord(raw)) throw new Error('main.teleport: an object with vanish and appear frames')
  return {
    vanish: checkFrames(raw.vanish, 'main.teleport.vanish', LIMITS.main),
    appear: checkFrames(raw.appear, 'main.teleport.appear', LIMITS.main),
  }
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
      if (!Array.isArray(list) || list.length === 0 || list.length > most || !list.every(isLine)) {
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

  const style = file.style ?? 'pixel'
  if (style !== 'pixel' && style !== 'ascii') throw new Error('style: "pixel" or "ascii"')
  const ascii = style === 'ascii'

  if (!isRecord(file.palette) && !(ascii && file.palette === undefined)) throw new Error('palette: required')
  const entries = Object.entries(file.palette ?? {})
  if (entries.length > LIMITS.paletteSize) throw new Error(`palette: at most ${LIMITS.paletteSize} colors`)
  const colors: Colors = {}
  for (const [letter, hex] of entries) {
    if (letter.length !== 1 || letter === '.') throw new Error(`palette: "${letter}" must be one character other than "."`)
    if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`palette.${letter}: use #rrggbb`)
    colors[letter] = hexColor(hex)
  }
  // The ink takes '.', which a pixel pack keeps see-through.
  if (ascii) {
    if (typeof file.ink !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(file.ink)) throw new Error('ink: required for an ascii pack, use #rrggbb')
    colors['.'] = hexColor(file.ink)
  } else if (file.ink !== undefined) {
    throw new Error('ink: only for an ascii pack')
  }
  const mirrors = file.mirror ?? true
  if (typeof mirrors !== 'boolean') throw new Error('mirror: true or false')
  const checkFrames = framesChecker(ascii, colors)

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
  const extra = parseVariants(checkFrames, file.main.variants, drawn)
  const moods = {} as Record<Mood, Frame[]>
  const variants = {} as Record<Mood, Frame[][]>
  for (const mood of MOODS) {
    let source: Mood | null = mood
    while (source !== null && !drawn.has(source)) source = PARENT[source]
    moods[mood] = drawn.get(source ?? 'sleeping') ?? []
    variants[mood] = extra.get(source ?? 'sleeping') ?? []
  }
  const transitions = parseTransitions(checkFrames, file.main.transitions)
  const own = parseActions(checkFrames, file.main.actions)
  const actions = [...own, ...parseActivities(checkFrames, file.main.activities, new Set(own.map(one => one.name)))]
  const teleport = parseTeleport(checkFrames, file.main.teleport)
  sameSize(
    [
      ...drawn.values(),
      ...[...extra.values()].flat(),
      ...Object.values(transitions),
      ...actions.flatMap(a => [a.frames, a.activity?.loop ?? [], a.activity?.end ?? []]),
      ...(teleport === null ? [] : [teleport.vanish, teleport.appear]),
    ].flat(),
    'main',
  )

  const { mini, tint } = file.mini === false ? { mini: null, tint: 'b' } : parseMini(checkFrames, file.mini, colors, ascii)

  const speech = parseSpeech(file.speech)
  const personality = parsePersonality(file.personality)

  return {
    name: file.name,
    colors,
    fps,
    moods,
    variants,
    transitions,
    actions,
    mini,
    tint,
    mirrors,
    walks: drawn.has('walking'),
    drawn: new Set(drawn.keys()),
    teleport,
    speech,
    personality,
  }
}

const parseMini = (checkFrames: CheckFrames, raw: unknown, colors: Colors, ascii: boolean) => {
  if (!isRecord(raw) || !isRecord(raw.moods)) throw new Error('mini.moods: required, or mini: false for no mini pets')
  const miniGiven = raw.moods as Record<string, unknown>
  if (miniGiven.working === undefined) throw new Error('mini.moods.working: required, happy, sad and startled fall back to it')
  const miniUnknown = Object.keys(miniGiven).filter(key => !MINI_MOODS.includes(key as MiniMood))
  if (miniUnknown.length > 0) throw new Error(`mini.moods: unknown mood ${miniUnknown.join(', ')}`)
  const working = checkFrames(miniGiven.working, 'mini.moods.working', LIMITS.mini)
  const mini = { working } as Record<MiniMood, Frame[]>
  for (const mood of MINI_MOODS) {
    mini[mood] = miniGiven[mood] === undefined ? working : checkFrames(miniGiven[mood], `mini.moods.${mood}`, LIMITS.mini)
  }
  sameSize(MINI_MOODS.flatMap(mood => mini[mood]), 'mini')
  // An ascii mini pet drawn all in ink is tinted whole.
  const tint = raw.tint ?? (ascii ? '.' : 'b')
  if (typeof tint !== 'string' || colors[tint] === undefined) throw new Error(`mini.tint: must be a palette letter${ascii ? ', or "." for the ink' : ''}`)
  return { mini, tint }
}

const SAFE_NAME = /^[a-z0-9][a-z0-9_-]{0,40}$/

// Where a pet named `name` may live, the person's own pets folder first.
// Undefined for a name that could step outside those folders.
export const packPaths = (name: string, home: string | undefined, root: string) =>
  SAFE_NAME.test(name)
    ? [...(home ? [`${home}/.claude/pets/${name}.json`] : []), `${root}/pets/${name}.json`]
    : undefined
