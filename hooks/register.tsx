import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { Activity, AgentPet, Label, MiniMood, Mood, Reaction } from '../types'
import { pickLocale, say } from './i18n'
import type { Locale, Text } from './i18n'
import { step } from './motion'
import type { Motion } from './motion'
import { DEFAULT_PET, packPaths, parsePack } from './pack'
import type { Pack } from './pack'
import { encode, mirror, sizeOf } from './render'
import { gather, walkStep } from './walk'
import type { Plan, Side, Walk } from './walk'

const asleep: Activity = { mood: 'sleeping', label: { text: 'sleeping', detail: '' } }

const activity = atom({ plugin: 'pixel-pets', key: 'activity' } as const, asleep)
const reaction = atom({ plugin: 'pixel-pets', key: 'reaction' } as const, null as Reaction | null)
const override = atom({ plugin: 'pixel-pets', key: 'override' } as const, null as Activity | null)
const turnStartedAt = atom({ plugin: 'pixel-pets', key: 'turnStartedAt' } as const, null as number | null)
const lastActiveAt = atom({ plugin: 'pixel-pets', key: 'lastActiveAt' } as const, null as number | null)
const typingAt = atom({ plugin: 'pixel-pets', key: 'typingAt' } as const, null as number | null)
const agents = atom({ plugin: 'pixel-pets', key: 'agents' } as const, [] as AgentPet[])
const isHidden = atom({ plugin: 'pixel-pets', key: 'isHidden' } as const, false)

const REACTION_MS = 2000
const WAKING_MS = 1200
const LEAVING_MS = 1500
const LONG_TURN_MS = 2 * 60_000
const DEEP_SLEEP_MS = 10 * 60_000
// How long the pet keeps watching the prompt after the last key.
const TYPING_MS = 2000
const AGENT_SLOT = 20
// Room kept for the " +N" that stands for agents with no slot.
const OVERFLOW_COLUMNS = 4
const MAX_AGENTS = 6

// One body color per subagent, picked in spawn order.
const AGENT_COLORS = [0x7cc4f2, 0x9bd57a, 0xc69af2, 0xf2d16b, 0xf28fb0, 0x6fd8c8]

const SEARCHERS = new Set(['Grep', 'Glob', 'WebFetch', 'WebSearch', 'LSP'])

// Waiting on something slow: these turn into sweating when a turn runs long.
const PATIENT: readonly Mood[] = ['thinking', 'running', 'supervising']

const short = (text: string, max = 32) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const basename = (path: string) => path.split('/').pop() ?? path
const label = (text: Text, detail = ''): Label => ({ text, detail })
const stillHere = (list: AgentPet[], now: number) => list.filter(pet => pet.leaving === undefined || pet.leaving.until > now)

const describe = (e: ToolCallInput): Activity => {
  switch (e.tool) {
    case 'Bash':
      return { mood: 'running', label: label('running', short(e.command)) }
    case 'Edit':
    case 'Write':
      return { mood: 'writing', label: label('writing', basename(e.file_path)) }
    case 'Read':
      return { mood: 'reading', label: label('reading', basename(e.file_path)) }
    case 'Agent':
      return { mood: 'supervising', label: label('waitingForAgents') }
  }
  const tool = String(e.tool)
  return SEARCHERS.has(tool)
    ? { mood: 'searching', label: label('searching', tool) }
    : { mood: 'typing', label: label('using', short(tool, 24)) }
}

const callKey = (agentId: string | undefined, tool: string) => `${agentId ?? 'main'}:${tool}`

// The engine's words for a call the person said no to: there is no flag for it.
const isDenial = (ran: { isError?: boolean; result?: unknown }) =>
  ran.isError === true && typeof ran.result === 'string' && ran.result.includes("doesn't want to proceed")

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error))

// The language and the pack are read once per module load: a settings change
// reloads the module, and with it these.
let choosing: Promise<Locale> | undefined
let loading: Promise<Pack> | undefined

function localeOf($: EngineInterface, choice: string) {
  choosing ??= (async () => {
    const settings = await $.settings.read()
    return pickLocale(choice, settings.language, await $.env.get('LANG'))
  })()
  return choosing
}

// The first pack found wins; a broken or missing one falls back to the shipped
// default, and the toast says why.
async function readPack($: EngineInterface, name: string, locale: Locale): Promise<Pack> {
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  const paths = packPaths(name, home, $.plugin.root)
  let problem = say(locale, paths === undefined ? 'invalidName' : 'notFound', name)

  for (const path of paths ?? []) {
    let text: string
    try {
      text = await $.fs.read(path)
    } catch {
      continue
    }
    try {
      return parsePack(JSON.parse(text))
    } catch (error) {
      problem = `${path}: ${reason(error)}`
      break
    }
  }

  const fallback = parsePack(JSON.parse(await $.fs.read(`${$.plugin.root}/pets/${DEFAULT_PET}.json`)))
  $.ui.toast(say(locale, 'fallback', problem))
  return fallback
}

function packOf($: EngineInterface, name: string, locale: Locale) {
  loading ??= readPack($, name, locale)
  return loading
}

// Clears the override only if it is still the one this hook set.
async function release($: EngineInterface, mood: Mood) {
  await update($, override, current => (current?.mood === mood ? null : current))
}

export const register: Register = (on, options) => {
  const petName = typeof options.pet === 'string' && options.pet !== '' ? options.pet : DEFAULT_PET
  const language = typeof options.language === 'string' ? options.language : 'auto'
  const awakeMs = (typeof options.awakeMinutes === 'number' && options.awakeMinutes >= 0 ? options.awakeMinutes : 1) * 60_000
  let frame = 0
  // What the main pet is playing and where it stands, between draws; a reload starts them fresh.
  let motion: Motion | undefined
  let walk: Walk | undefined
  // The side each agent's pet stands on, kept so none hops over when another leaves.
  let sides = new Map<string, Side>()
  // The tool call running for each agent and tool, so a permission prompt (which
  // names only those) finds the call it is for; and the calls that asked.
  // ponytail: two same-named calls of one agent at once share a key; the later wins.
  const openCalls = new Map<string, string>()
  const asked = new Set<string>()

  on('session.start', async ($, e, next) => {
    const locale = await localeOf($, language)
    await $.command.register({ name: 'pet', description: say(locale, 'commandDescription') })
    const pack = await packOf($, petName, locale)
    const now = await $.clock.now()
    await update($, lastActiveAt, () => now)
    $.clock.every(Math.round(1000 / pack.fps), () => {
      frame += 1
      $.ui.invalidate('ui.render')
    })
    return next(e)
  })

  on('command.run', { command: 'pet' }, async $ => {
    const locale = await localeOf($, language)
    const hidden = await update($, isHidden, value => !value)
    return { text: say(locale, hidden ? 'hidden' : 'shown') }
  })

  // The pet looks at the prompt while the person types in it.
  on('prompt.edit', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, typingAt, () => now)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Only a pet in deep sleep is startled awake; a dozing one just starts thinking,
  // and one keeping an eye on background agents was awake all along.
  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    const idleSince = await read($, lastActiveAt)
    const busySince = await read($, turnStartedAt)
    const isSupervising = stillHere(await read($, agents), now).some(one => one.leaving === undefined)
    if (busySince === null && !isSupervising && idleSince !== null && now - idleSince > DEEP_SLEEP_MS) {
      await update($, reaction, (): Reaction => ({ mood: 'waking', label: label('wakingUp'), until: now + WAKING_MS }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, activity, (): Activity => ({ mood: 'thinking', label: label('thinking') }))
    await update($, turnStartedAt, () => now)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    const isBad = e.reason === 'error' || e.reason === 'refusal'

    if (e.agentId !== undefined) {
      const id = e.agentId
      const leaving = { mood: (isBad || e.isAborted ? 'sad' : 'happy') as MiniMood, until: now + LEAVING_MS }
      await update($, agents, list => stillHere(list, now).map(pet => (pet.id === id ? { ...pet, leaving } : pet)))
      await update($, lastActiveAt, () => now)
      return next(e)
    }

    const until = now + REACTION_MS
    // An interrupted turn earns no reaction, and one still showing (a thanks, a
    // "fine, I won't" after a denied permission, a failure) is left to finish.
    const live = await read($, reaction)
    if (!e.isAborted && (live === null || live.until <= now)) {
      await update($, reaction, (): Reaction =>
        isBad ? { mood: 'sad', label: label('wentWrong'), until } : { mood: 'happy', label: label('done'), until },
      )
    }
    await update($, override, () => null)
    await update($, turnStartedAt, () => null)
    await update($, lastActiveAt, () => now)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const id = 'agentId' in started ? started.agentId : undefined
    if (id !== undefined) {
      const now = await $.clock.now()
      await update($, agents, list => {
        const color = AGENT_COLORS[list.length % AGENT_COLORS.length] ?? 0xffffff
        const pet: AgentPet = { id, toolUseId: e.tool_use_id, type: e.subagentType, label: label('thinking'), color }
        return [...stillHere(list, now), pet]
      })
    }
    return started
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const now = describe(e)
    const agentId = e.agentId

    if (agentId === undefined) {
      await update($, activity, () => now)
    } else {
      await update($, agents, list => list.map(pet => (pet.id === agentId ? { ...pet, label: now.label } : pet)))
    }

    const key = callKey(agentId, String(e.tool))
    openCalls.set(key, e.tool_use_id)
    let ran: Awaited<ReturnType<typeof next>>
    let wasAsked = false
    try {
      ran = await next(e)
    } finally {
      if (openCalls.get(key) === e.tool_use_id) openCalls.delete(key)
      wasAsked = asked.delete(e.tool_use_id)
    }

    // A background agent's tool call returns at once; its pet leaves on its own
    // turn.complete. Only a spawn that failed is dropped here.
    if (e.tool === 'Agent' && ran.isError === true) {
      await update($, agents, list => list.filter(pet => pet.toolUseId !== e.tool_use_id))
    }
    const until = (await $.clock.now()) + REACTION_MS
    if (wasAsked) {
      // The person answered a permission prompt: thanks for a yes, fine for a no.
      const thanked: Reaction = isDenial(ran)
        ? { mood: 'sad', label: label('denied'), until }
        : { mood: 'happy', label: label('thanks'), until }
      await update($, reaction, () => thanked)
    } else if (agentId === undefined && ran.isError === true) {
      // "failed: npm test", or the tool's name when the action has no detail.
      const failed = label('failed', short(now.label.detail || String(e.tool), 24))
      await update($, reaction, (): Reaction => ({ mood: 'sad', label: failed, until }))
    }
    return ran
  }).catch(($, e, next) => next(e))

  // The band is hidden while a permission dialog is open (and `$.ui.notice` does
  // not show under the terminal's), so the pet only marks the call that asked;
  // tool.call reacts once the person has answered.
  on('classic.PermissionRequest', async ($, e, next) => {
    const id = openCalls.get(callKey(e.agent_id, e.tool_name))
    if (id !== undefined) asked.add(id)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    await update($, override, (): Activity => ({ mood: 'compacting', label: label('compacting') }))
    try {
      return await next(e)
    } finally {
      await release($, 'compacting')
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const locale = await localeOf($, language)
    const pack = await packOf($, petName, locale)
    const now = await $.clock.now()
    const busy = await read($, override)
    const flash = await read($, reaction)
    const doing = await read($, activity)
    const startedAt = await read($, turnStartedAt)
    const idleSince = await read($, lastActiveAt)
    const typedAt = await read($, typingAt)
    const list = stillHere(await read($, agents), now)
    const words = (one: Label) => say(locale, one.text, one.detail)

    let shown: Activity
    let extra = ''
    if (busy !== null) {
      shown = busy
    } else if (flash !== null && flash.until > now) {
      shown = flash
    } else if (e.props.isWorking) {
      const elapsed = startedAt === null ? 0 : now - startedAt
      const isLong = elapsed > LONG_TURN_MS && PATIENT.includes(doing.mood)
      // A turn that only thinks while agents still run is waiting on them.
      const current: Activity =
        doing.mood === 'thinking' && list.some(one => one.leaving === undefined)
          ? { mood: 'supervising', label: label('waitingForAgents') }
          : doing
      shown = isLong ? { ...current, mood: 'sweating' } : current
      if (isLong) extra = ` · ${Math.floor(elapsed / 60_000)}m`
    } else {
      // Unknown idle time (nothing has run yet) counts as a plain nap.
      const idleFor = idleSince === null ? awakeMs + 1 : now - idleSince
      const isTyping = typedAt !== null && now - typedAt < TYPING_MS
      if (isTyping && idleFor <= DEEP_SLEEP_MS) shown = { mood: 'watching', label: label('watching') }
      // Background agents still at work: it keeps an eye on them rather than dozing off.
      else if (list.some(one => one.leaving === undefined)) shown = { mood: 'supervising', label: label('waitingForAgents') }
      else if (idleSince !== null && idleFor > DEEP_SLEEP_MS) shown = { mood: 'deepSleep', label: label('deepSleep') }
      else if (idleFor > awakeMs) shown = asleep
      else shown = { mood: 'idle', label: label('idle') }
    }

    const miniSize = sizeOf(pack.mini.working[0] ?? [])
    const slot = Math.max(miniSize.columns, AGENT_SLOT)
    const petColumns = pack.moods.sleeping[0]?.[0]?.length ?? 0
    // As many agents as fit beside the pet; the rest are a "+N" that needs room too.
    const room = e.props.bodyColumns - petColumns - 2
    const fits = (count: number) => count * (slot + 1) + (count < list.length ? OVERFLOW_COLUMNS : 0) <= room
    let shownAgents = Math.min(list.length, MAX_AGENTS)
    while (shownAgents > 0 && !fits(shownAgents)) shownAgents -= 1
    const visible = list.slice(0, shownAgents)
    const hidden = list.length - visible.length
    const agentWords = (one: AgentPet) =>
      one.leaving === undefined ? words(one.label) : say(locale, one.leaving.mood === 'sad' ? 'wentWrong' : 'done')

    // Every frame is one size, so the sleeping one tells whether the stage fits.
    // A line of text has no stage, and must not move the pet on the one that has.
    const mainSize = sizeOf(pack.moods.sleeping[0] ?? [])
    if (e.surface !== 'terminal' || e.props.maxRows < mainSize.rows + 1) {
      const { Text } = $.ui.resolve(e)
      const others = list.map(one => ` · ${one.type}: ${agentWords(one)}`).join('')
      return <Text dimColor>🐾 Claude: {words(shown.label)}{extra}{others}</Text>
    }

    // It only strolls alone; with agents around it stays and they gather on both sides.
    const wants: Plan = list.length === 0 && shown.mood === 'idle' ? 'wander' : 'stay'
    const walked = walkStep(walk, pack.walks ? wants : 'stay', frame, room, pack.fps, Math.random)
    const width = slot + 1
    const extraColumns = hidden > 0 ? OVERFLOW_COLUMNS : 0
    const placed = gather(walked.walk.x, room, visible.length, width, extraColumns, visible.map(one => sides.get(one.id)))
    walk = placed.x === walked.walk.x ? walked.walk : { ...walked.walk, x: placed.x, target: placed.x }
    const sideOf = (index: number): Side => (placed.right.includes(index) ? 1 : -1)
    sides = new Map(visible.map((one, i) => [one.id, sideOf(i)]))
    const isStrolling = walked.moving && shown.mood === 'idle'
    const mood: Mood = walked.moving ? 'walking' : shown.mood
    const labelShown = isStrolling ? label('strolling') : shown.label

    const moved = step(pack, motion, mood, frame, Math.random)
    motion = moved.motion
    // It faces the first agent while there are any.
    const facing = visible.length === 0 ? walk.facing : sideOf(0)
    const body = facing === 1 ? moved.frame : mirror(moved.frame)

    const { Box, Raster, Text } = $.ui.resolve(e)
    const agentPet = (index: number, side: Side) => {
      const one = visible[index]
      if (one === undefined) return null
      const miniFrames = pack.mini[one.leaving?.mood ?? 'working']
      const mini = miniFrames[frame % miniFrames.length] ?? []
      return (
        // On the left the slot hugs the pet too: its pet and words lean right.
        <Box
          key={one.id}
          flexDirection="column"
          width={slot}
          alignItems={side === 1 ? 'flex-start' : 'flex-end'}
          marginLeft={side === 1 ? 1 : 0}
          marginRight={side === 1 ? 0 : 1}
        >
          <Raster key={`mini-${one.id}`} {...miniSize} cells={encode(mini, { ...pack.colors, [pack.tint]: one.color })} />
          <Text bold>{short(one.type, slot)}</Text>
          <Text dimColor>{short(agentWords(one), slot)}</Text>
        </Box>
      )
    }
    const leftColumns = placed.left.length * width + (placed.more === -1 ? extraColumns : 0)

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>Claude</Text> <Text dimColor>· {words(labelShown)}{extra}</Text>
        </Text>
        <Box flexDirection="row" marginLeft={walk.x - leftColumns}>
          {hidden > 0 && placed.more === -1 && (
            <Box width={OVERFLOW_COLUMNS}>
              <Text dimColor>+{hidden}</Text>
            </Box>
          )}
          {[...placed.left].reverse().map(i => agentPet(i, -1))}
          <Raster key="main" {...mainSize} cells={encode(body, pack.colors)} />
          {placed.right.map(i => agentPet(i, 1))}
          {hidden > 0 && placed.more === 1 && <Text dimColor> +{hidden}</Text>}
        </Box>
      </Box>
    )
  })
}
