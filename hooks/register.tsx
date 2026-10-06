import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { Activity, AgentPet, Label, MiniMood, Mood, Reaction } from '../types'
import { pickLocale, say } from './i18n'
import type { Locale, Text } from './i18n'
import { DEFAULT_PET, packPaths, parsePack } from './pack'
import type { Pack } from './pack'
import { encode, sizeOf } from './render'

const asleep: Activity = { mood: 'sleeping', label: { text: 'sleeping', detail: '' } }

const activity = atom({ plugin: 'pixel-pets', key: 'activity' } as const, asleep)
const reaction = atom({ plugin: 'pixel-pets', key: 'reaction' } as const, null as Reaction | null)
const override = atom({ plugin: 'pixel-pets', key: 'override' } as const, null as Activity | null)
const turnStartedAt = atom({ plugin: 'pixel-pets', key: 'turnStartedAt' } as const, null as number | null)
const lastActiveAt = atom({ plugin: 'pixel-pets', key: 'lastActiveAt' } as const, null as number | null)
const agents = atom({ plugin: 'pixel-pets', key: 'agents' } as const, [] as AgentPet[])
const isHidden = atom({ plugin: 'pixel-pets', key: 'isHidden' } as const, false)

const REACTION_MS = 2000
const WAKING_MS = 1200
const LEAVING_MS = 1500
const LONG_TURN_MS = 2 * 60_000
const DEEP_SLEEP_MS = 10 * 60_000
const MAX_AGENTS = 6

// One body color per subagent, picked in spawn order.
const AGENT_COLORS = [0x7cc4f2, 0x9bd57a, 0xc69af2, 0xf2d16b, 0xf28fb0, 0x6fd8c8]

const SEARCHERS = new Set(['Grep', 'Glob', 'WebFetch', 'WebSearch', 'LSP'])

// Waiting on something slow: these turn into sweating when a turn runs long.
const PATIENT: readonly Mood[] = ['thinking', 'running']

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
      return { mood: 'thinking', label: label('waitingForAgents') }
  }
  const tool = String(e.tool)
  return SEARCHERS.has(tool)
    ? { mood: 'searching', label: label('searching', tool) }
    : { mood: 'typing', label: label('using', short(tool, 24)) }
}

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
  let frame = 0

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

  // Only a pet in deep sleep is startled awake; a dozing one just starts thinking.
  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    const idleSince = await read($, lastActiveAt)
    const busySince = await read($, turnStartedAt)
    if (busySince === null && idleSince !== null && now - idleSince > DEEP_SLEEP_MS) {
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
      return next(e)
    }

    const until = now + REACTION_MS
    await update($, reaction, (): Reaction =>
      isBad ? { mood: 'sad', label: label('wentWrong'), until } : { mood: 'happy', label: label('done'), until },
    )
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

    const ran = await next(e)

    if (agentId === undefined) await release($, 'waiting')
    // A background agent's tool call returns at once; its pet leaves on its own
    // turn.complete. Only a spawn that failed is dropped here.
    if (e.tool === 'Agent' && ran.isError === true) {
      await update($, agents, list => list.filter(pet => pet.toolUseId !== e.tool_use_id))
    }
    if (agentId === undefined && ran.isError === true) {
      const until = (await $.clock.now()) + REACTION_MS
      // "failed: npm test", or the tool's name when the action has no detail.
      const failed = label('failed', short(now.label.detail || String(e.tool), 24))
      await update($, reaction, (): Reaction => ({ mood: 'sad', label: failed, until }))
    }
    return ran
  }).catch(($, e, next) => next(e))

  // Claude is stuck until the person answers a permission prompt.
  on('classic.PermissionRequest', async ($, e, next) => {
    await update($, override, (): Activity => ({ mood: 'waiting', label: label('waitingForYou', short(e.tool_name, 24)) }))
    const answered = await next(e)
    await release($, 'waiting')
    return answered
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
      shown = isLong ? { ...doing, mood: 'sweating' } : doing
      if (isLong) extra = ` · ${Math.floor(elapsed / 60_000)}m`
    } else {
      const isDeep = idleSince !== null && now - idleSince > DEEP_SLEEP_MS
      shown = isDeep ? { mood: 'deepSleep', label: label('deepSleep') } : asleep
    }

    const frames = pack.moods[shown.mood]
    const body = frames[frame % frames.length] ?? []
    const mainSize = sizeOf(body)
    const agentWords = (one: AgentPet) =>
      one.leaving === undefined ? words(one.label) : say(locale, one.leaving.mood === 'sad' ? 'wentWrong' : 'done')

    if (e.surface !== 'terminal' || e.props.maxRows < mainSize.rows) {
      const { Text } = $.ui.resolve(e)
      const others = list.map(one => ` · ${one.type}: ${agentWords(one)}`).join('')
      return <Text dimColor>🐾 Claude: {words(shown.label)}{extra}{others}</Text>
    }

    const { Box, Raster, Text } = $.ui.resolve(e)
    const visible = list.slice(0, MAX_AGENTS)
    const miniSize = sizeOf(pack.mini.working[0] ?? [])

    return (
      <Box flexDirection="row" gap={2}>
        <Raster key="main" {...mainSize} cells={encode(body, pack.colors)} />
        <Box flexDirection="column">
          <Text>
            <Text bold>Claude</Text> <Text dimColor>· {words(shown.label)}{extra}</Text>
          </Text>
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {visible.map(one => {
              const miniFrames = pack.mini[one.leaving?.mood ?? 'working']
              const mini = miniFrames[frame % miniFrames.length] ?? []
              return (
                <Box key={one.id} flexDirection="row" gap={1}>
                  <Raster key={`mini-${one.id}`} {...miniSize} cells={encode(mini, { ...pack.colors, [pack.tint]: one.color })} />
                  <Box flexDirection="column">
                    <Text bold>{short(one.type, 16)}</Text>
                    <Text dimColor>{short(agentWords(one), 22)}</Text>
                  </Box>
                </Box>
              )
            })}
            {list.length > visible.length && <Text dimColor>+{list.length - visible.length}</Text>}
          </Box>
        </Box>
      </Box>
    )
  })
}
