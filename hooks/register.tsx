import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { Activity, AgentPet, Feelings, Frame, Label, MiniMood, Mood, Reaction, Situation, Traits } from '../types'
import { alertness, drift, engaged, misses, paceOf, rested, seen, stirred, stirs, USUAL } from './drives'
import type { Drives, State } from './drives'
import { calm, cheer, feel, idleMood, isNight, nightOf } from './feelings'
import { pickLocale, say } from './i18n'
import type { Locale, Text } from './i18n'
import { asVisit, daysBetween, welcome } from './memory'
import type { Visit } from './memory'
import { step } from './motion'
import type { Motion } from './motion'
import { DEFAULT_PET, packPaths, parsePack } from './pack'
import type { Pack } from './pack'
import { encode, mirror, sizeOf } from './render'
import { LONG_THINK_MS, MANY_AGENTS, MANY_READS, lineFor, maySpeak, quiet, spoke } from './speech'
import type { Speaker } from './speech'
import { clamp, faceFor, gather, onTheWay, sideIn, walkStep } from './walk'
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
const feelings = atom({ plugin: 'pixel-pets', key: 'feelings' } as const, calm as Feelings)
const restedAt = atom({ plugin: 'pixel-pets', key: 'restedAt' } as const, null as number | null)

const REACTION_MS = 2000
const WAKING_MS = 1200
const LEAVING_MS = 1500
const LONG_TURN_MS = 2 * 60_000
const DEEP_SLEEP_MS = 10 * 60_000
// A break this long rests it, as far as getting tired goes.
const BREAK_MS = 60 * 60_000
const GREETING_MS = 2500
// A turn this long that goes well earns a bigger, longer celebration.
const LONG_WIN_MS = 5 * 60_000
const CELEBRATION_MS = 4000
// How long a line it says stays on Claude's line.
const SPEECH_MS = 4000
// How long the pet keeps watching the prompt after the last key.
const TYPING_MS = 2000
// How long it stays up when boredom gets it out of a nap.
const STIR_MS = 45_000
// How long into a nap it may talk in its sleep, in minutes.
const DREAM_MINUTES: [number, number] = [10, 20]
const AGENT_SLOT = 20
// Room kept for the " +N" that stands for agents with no slot.
const OVERFLOW_COLUMNS = 4
const MAX_AGENTS = 6
// While only its own frame moves, the clock repaints that frame and redraws the
// band in full only this often, in seconds, for what changes with time alone
// (a reaction running out, dozing off): once a second awake, every 5 asleep.
const REDRAW_AWAKE_S = 1
const REDRAW_ASLEEP_S = 5

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

const hourOf = (now: number) => new Date(now).getHours()
const anniversary = (days: number): Label =>
  days === 7
    ? label('aWeekTogether')
    : days === 30
      ? label('aMonthTogether')
      : days === 365
        ? label('aYearTogether')
        : days % 365 === 0
          ? label('yearsTogether', String(days / 365))
          : label('daysTogether', String(days))

// Notes that the person is here now, and when they first met. Returns the visit
// before this one. With no store it remembers nothing, and holds nothing up.
async function remember($: EngineInterface, now: number) {
  try {
    const visit = asVisit(await $.store.get('visit'))
    await $.store.set('visit', { metAt: visit?.metAt ?? now, lastSeenAt: now })
    return visit
  } catch {
    return undefined
  }
}

// How the day's first sight of the person goes: an anniversary, missing them, or
// good morning. Checked when a session opens and on each prompt, so a session left
// open overnight still greets the morning. `before` is the visit before this one.
async function greet($: EngineInterface, now: number, before: Visit | undefined) {
  const hello = welcome(before, now, hourOf(now))
  if (hello === undefined) return
  const until = now + GREETING_MS
  const shown: Reaction =
    hello.kind === 'anniversary'
      ? { mood: 'celebrating', label: anniversary(hello.days), until: now + CELEBRATION_MS }
      : hello.kind === 'missedYou'
        ? { mood: 'happy', label: label('missedYou'), until }
        : { mood: 'waking', label: label('goodMorning'), until }
  await update($, reaction, () => shown)
}

// When the person came back from their last break, across every session: an hour
// with no prompt in any of them rests the pet. `before` is the visit before this one.
async function restedSince($: EngineInterface, now: number, before: Visit | undefined) {
  try {
    const kept = await $.store.get('restedAt')
    if (typeof kept === 'number' && before !== undefined && now - before.lastSeenAt < BREAK_MS) return kept
    await $.store.set('restedAt', now)
  } catch {
    // No store: rested as of now, as a session that remembers nothing.
  }
  return now
}

// Whether no session has said the late-night line yet tonight.
async function quietTonight($: EngineInterface, now: number) {
  try {
    return (await $.store.get('lateNight')) !== nightOf(now)
  } catch {
    return true
  }
}

async function saidTonight($: EngineInterface, now: number) {
  try {
    await $.store.set('lateNight', nightOf(now))
  } catch {
    // No store: this session alone keeps it.
  }
}

// The person is at the prompt: the day's welcome, and their rest, from the visit before.
async function atThePrompt($: EngineInterface, now: number) {
  const before = await remember($, now)
  await greet($, now, before)
  const since = await restedSince($, now, before)
  await update($, restedAt, () => since)
}

// "Together for 12 days", for /pet; nothing when it has no memory of the person.
async function together($: EngineInterface, locale: Locale) {
  try {
    const visit = asVisit(await $.store.get('visit'))
    if (visit === undefined) return ''
    const days = daysBetween(visit.metAt, await $.clock.now())
    const said = days === 0 ? say(locale, 'justMet') : days === 1 ? say(locale, 'togetherADay') : say(locale, 'togetherDays', String(days))
    return ` ${said.charAt(0).toUpperCase()}${said.slice(1)}.`
  } catch {
    return ''
  }
}

// Clears the override only if it is still the one this hook set.
async function release($: EngineInterface, mood: Mood) {
  await update($, override, current => (current?.mood === mood ? null : current))
}

export const register: Register = (on, options) => {
  // The picker names a shipped pet, or `custom` for the person's own pack named in `customPet`.
  const picked = options.pet === 'custom' ? options.customPet : options.pet
  const petName = typeof picked === 'string' && picked !== '' ? picked : DEFAULT_PET
  const language = typeof options.language === 'string' ? options.language : 'auto'
  const awakeMs = (typeof options.awakeMinutes === 'number' && options.awakeMinutes >= 0 ? options.awakeMinutes : 1) * 60_000
  let frame = 0
  // What the main pet is playing and where it stands, between draws; a reload starts them fresh.
  let motion: Motion | undefined
  let walk: Walk | undefined
  // The side each agent's pet stands on, kept so none hops over when another leaves.
  let sides = new Map<string, Side>()
  // A full redraw costs Claude Code far more than repainting the pet, and every
  // open session pays it. While the band shows nothing but the pet's own frame
  // moving, `still` holds what the clock needs to repaint that frame alone; while
  // the pet is hidden the clock redraws nothing, as showing it again redraws.
  let still: { requestId: string; mood: Mood; facing: Side; cells: string } | null = null
  let isOff = false
  // The tool call running for each agent and tool, so a permission prompt (which
  // names only those) finds the call it is for; and the calls that asked.
  // ponytail: two same-named calls of one agent at once share a key; the later wins.
  const openCalls = new Map<string, string>()
  const asked = new Set<string>()
  // Only a session with a person at the prompt counts as seeing them: a `claude -p`
  // run must not spend the day's welcome.
  let isInteractive = false
  // What it said lately and what it is saying now; a reload starts them fresh.
  let speaker: Speaker = quiet
  let saying: { text: string; until: number } | null = null
  // Since when the main loop has run no tool (null while one runs), and its tools and reads this turn.
  let thinkingSince: number | null = null
  let toolsThisTurn = 0
  let readsThisTurn = 0
  // An agent finished since the pet last cheered: the turn that reports it is worth a cheer.
  let agentsDone = false
  let saidLateNight = false
  // What it wants, from the first draw on, and what the band showed last, which is
  // what it has been up to since; plus until when it is up on its own.
  let drives: Drives | undefined
  // How the pet is made, from its pack once the band has drawn it.
  let traits: Traits = USUAL
  let lastState: State = 'awake'
  let stirredUntil = 0
  // A pet that teleports, from where and since which tick, while it vanishes and appears.
  let blink: { from: number; start: number } | undefined
  // When it last woke up glad at the person's first key after a long while away,
  // and whether that was since it went idle at `idleSince`.
  let gladAt: number | null = null
  // When it talks in its sleep next; null while awake.
  let dreamAt: number | null = null
  const wokeForThem = (idleSince: number | null) => gladAt !== null && idleSince !== null && gladAt >= idleSince
  // Brings the drives up to `now` before `change` touches them.
  const touch = (now: number, change: (settled: Drives) => Drives) => {
    if (drives !== undefined) drives = change(drift(drives, now, lastState, traits))
  }

  // Says the line for `situation`, unless it spoke too lately or already did this turn.
  const speak = (situation: Situation, now: number, pack: Pack, locale: Locale) => {
    if (!maySpeak(speaker, situation, now)) return false
    speaker = spoke(speaker, situation, now)
    saying = { text: lineFor(pack.speech, locale.code, situation, say(locale, situation), Math.random), until: now + SPEECH_MS }
    return true
  }

  on('session.start', async ($, e, next) => {
    const locale = await localeOf($, language)
    await $.command.register({ name: 'pet', description: say(locale, 'commandDescription') })
    const pack = await packOf($, petName, locale)
    const now = await $.clock.now()
    await update($, lastActiveAt, () => now)
    $.clock.every(Math.round(1000 / pack.fps), () => {
      frame += 1
      if (isOff) return
      const scene = still
      const isAsleep = scene?.mood === 'sleeping' || scene?.mood === 'deepSleep'
      const every = pack.fps * (isAsleep ? REDRAW_ASLEEP_S : REDRAW_AWAKE_S)
      if (scene === null || frame % every === 0) {
        $.ui.invalidate('ui.render')
        return
      }
      const moved = step(pack, motion, scene.mood, frame, Math.random)
      motion = moved.motion
      const cells = encode(scene.facing === 1 ? moved.frame : mirror(moved.frame), pack.colors)
      if (cells === scene.cells) return
      still = { ...scene, cells }
      // Refused when the band is no longer drawn as it was: redraw it in full.
      void $.ui.blit({ requestId: scene.requestId, key: 'main', cells }).then(done => {
        if (done.deny !== undefined) $.ui.invalidate('ui.render')
      })
    })
    isInteractive = e.isInteractive
    if (isInteractive) await atThePrompt($, now)
    else await update($, restedAt, at => at ?? now)
    return next(e)
  })

  on('command.run', { command: 'pet' }, async $ => {
    const locale = await localeOf($, language)
    const hidden = await update($, isHidden, value => !value)
    return { text: `${say(locale, hidden ? 'hidden' : 'shown')}${await together($, locale)}` }
  })

  // The pet looks at the prompt while the person types in it, glad at the first key
  // after a long while away, unless a turn or something else is showing.
  on('prompt.edit', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, typingAt, () => now)
    let missed = false
    touch(now, settled => {
      missed = misses(settled)
      return seen(settled)
    })
    if (missed && (await read($, turnStartedAt)) === null) {
      gladAt = now
      const glad: Reaction = { mood: 'happy', label: label('missedYou'), until: now + REACTION_MS }
      await update($, reaction, live => (live !== null && live.until > now ? live : glad))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Only a pet in deep sleep is startled awake; a dozing one just starts thinking,
  // one keeping an eye on background agents was awake all along, and one glad to
  // see the person woke up already.
  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    const idleSince = await read($, lastActiveAt)
    const busySince = await read($, turnStartedAt)
    const isSupervising = stillHere(await read($, agents), now).some(one => one.leaving === undefined)
    const isFastAsleep = idleSince !== null && now - idleSince > DEEP_SLEEP_MS && !wokeForThem(idleSince)
    if (busySince === null && !isSupervising && isFastAsleep) {
      await update($, reaction, (): Reaction => ({ mood: 'waking', label: label('wakingUp'), until: now + WAKING_MS }))
    }
    touch(now, seen)
    if (isInteractive) await atThePrompt($, now)
    // Once a night across every session: the first to see the person late says it.
    if (!saidLateNight && isNight(hourOf(now))) {
      if (await quietTonight($, now)) {
        const locale = await localeOf($, language)
        saidLateNight = speak('lateNight', now, await packOf($, petName, locale), locale)
        if (saidLateNight) await saidTonight($, now)
      } else saidLateNight = true
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, activity, (): Activity => ({ mood: 'thinking', label: label('thinking') }))
    await update($, turnStartedAt, () => now)
    speaker = { ...speaker, saidThisTurn: [] }
    touch(now, engaged)
    thinkingSince = now
    toolsThisTurn = 0
    readsThisTurn = 0
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
      agentsDone = true
      return next(e)
    }

    if (!e.isAborted) await update($, feelings, felt => feel(felt, isBad ? 'turnFailed' : 'turnOk', now))
    const startedAt = await read($, turnStartedAt)
    const tookLong = startedAt !== null && now - startedAt >= LONG_WIN_MS
    const agentsLeft = stillHere(await read($, agents), now).filter(one => one.leaving === undefined).length
    const cheered = cheer({ tookLong, tools: toolsThisTurn, agentsDone, agentsLeft }, Math.random)
    if (agentsLeft === 0) agentsDone = false
    const until = now + REACTION_MS
    // An interrupted turn earns no reaction, and one still showing (a thanks, a
    // "fine, I won't" after a denied permission, a failure) is left to finish.
    // A failure always shows; a turn that went well only sometimes cheers.
    const live = await read($, reaction)
    if (!e.isAborted && (live === null || live.until <= now) && (isBad || cheered !== null)) {
      await update($, reaction, (): Reaction =>
        isBad
          ? { mood: 'sad', label: label('wentWrong'), until }
          : cheered === 'celebrating'
            ? { mood: 'celebrating', label: label('phew'), until: now + CELEBRATION_MS }
            : { mood: 'happy', label: label('done'), until },
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
      const working = stillHere(await read($, agents), now).filter(one => one.leaving === undefined)
      if (working.length >= MANY_AGENTS) {
        const locale = await localeOf($, language)
        speak('manyAgents', now, await packOf($, petName, locale), locale)
      }
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

    if (agentId === undefined) {
      thinkingSince = null
      toolsThisTurn += 1
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
    const at = await $.clock.now()
    const until = at + REACTION_MS
    if (agentId === undefined) {
      thinkingSince = at
      if (e.tool === 'Read' && (readsThisTurn += 1) === MANY_READS) {
        const locale = await localeOf($, language)
        speak('manyReads', at, await packOf($, petName, locale), locale)
      }
    }
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
      await update($, feelings, felt => feel(felt, 'toolFailed', at))
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
    still = null
    isOff = await read($, isHidden)
    if (e.props.hasSurvey || isOff) {
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
    // ponytail: the drives move only when the band is drawn, so a band hidden by /pet
    // counts all that time as what it last showed; give them a clock of their own if that skews them.
    traits = pack.personality
    drives = drives === undefined ? rested(now) : drift(drives, now, lastState, traits)

    let shown: Activity
    let extra = ''
    if (busy !== null) {
      shown = busy
    } else if (flash !== null && flash.until > now) {
      shown = flash
    } else if (e.props.isWorking) {
      const elapsed = startedAt === null ? 0 : now - startedAt
      const isLong = elapsed > LONG_TURN_MS && PATIENT.includes(doing.mood)
      if (thinkingSince !== null && now - thinkingSince >= LONG_THINK_MS) speak('longThink', now, pack, locale)
      // A turn that only thinks while agents still run is waiting on them.
      const current: Activity =
        doing.mood === 'thinking' && list.some(one => one.leaving === undefined)
          ? { mood: 'supervising', label: label('waitingForAgents') }
          : doing
      shown = isLong ? { ...current, mood: 'sweating' } : current
      if (isLong) extra = ` · ${Math.floor(elapsed / 60_000)}m`
    } else {
      // It dozes off sooner at night, and when it runs low on energy. Unknown idle time
      // (nothing has run yet) counts as a plain nap.
      const hour = hourOf(now)
      const awakeFor = (isNight(hour) ? awakeMs / 2 : awakeMs) * alertness(drives)
      const idleFor = idleSince === null ? awakeFor + 1 : now - idleSince
      const isTyping = typedAt !== null && now - typedAt < TYPING_MS
      // Fast asleep it does not look up, unless it woke up glad to see them since.
      if (isTyping && (idleFor <= DEEP_SLEEP_MS || wokeForThem(idleSince))) shown = { mood: 'watching', label: label('watching') }
      // Background agents still at work: it keeps an eye on them rather than dozing off.
      else if (list.some(one => one.leaving === undefined)) shown = { mood: 'supervising', label: label('waitingForAgents') }
      // Once glad to see them it only dozes, so the prompt it sends does not startle it.
      else if (idleSince !== null && idleFor > DEEP_SLEEP_MS && !wokeForThem(idleSince)) shown = { mood: 'deepSleep', label: label('deepSleep') }
      else if (idleFor > awakeFor && now >= stirredUntil && !stirs(drives)) shown = asleep
      else {
        // Bored in a nap, it gets up for a while on its own.
        if (idleFor > awakeFor && now >= stirredUntil) {
          stirredUntil = now + STIR_MS
          drives = stirred(drives)
          speak('bored', now, pack, locale)
        }
        const felt = idleMood(await read($, feelings), now, await read($, restedAt), hour)
        shown = felt === undefined ? { mood: 'idle', label: label('idle') } : { mood: felt, label: label(felt) }
      }
    }

    lastState = shown.mood === 'sleeping' || shown.mood === 'deepSleep' ? 'asleep' : e.props.isWorking ? 'working' : 'awake'
    // Asleep, it talks in its sleep now and then, as rarely as it speaks at all.
    const dreamGap = () => (DREAM_MINUTES[0] + (DREAM_MINUTES[1] - DREAM_MINUTES[0]) * Math.random()) * 60_000
    if (lastState !== 'asleep') dreamAt = null
    else if (dreamAt === null) dreamAt = now + dreamGap()
    else if (now >= dreamAt) {
      speak('dreaming', now, pack, locale)
      dreamAt = now + dreamGap()
    }

    const miniSize = sizeOf(pack.mini?.working[0] ?? [])
    const slot = Math.max(miniSize.columns, AGENT_SLOT)
    const petColumns = pack.moods.sleeping[0]?.[0]?.length ?? 0
    // As many agents as fit beside the pet; the rest are a "+N" that needs room too.
    // A pack with no mini pets shows its agents only by its own mood.
    const room = e.props.bodyColumns - petColumns - 2
    const fits = (count: number) => count * (slot + 1) + (count < list.length ? OVERFLOW_COLUMNS : 0) <= room
    let shownAgents = pack.mini === null ? 0 : Math.min(list.length, MAX_AGENTS)
    while (shownAgents > 0 && !fits(shownAgents)) shownAgents -= 1
    const visible = list.slice(0, shownAgents)
    const hidden = pack.mini === null ? 0 : list.length - visible.length
    const agentWords = (one: AgentPet) =>
      one.leaving === undefined ? words(one.label) : say(locale, one.leaving.mood === 'sad' ? 'wentWrong' : 'done')

    // Every frame is one size, so the sleeping one tells whether the stage fits, tall and wide.
    // A line of text has no stage, and must not move the pet on the one that has.
    const mainSize = sizeOf(pack.moods.sleeping[0] ?? [])
    if (e.surface !== 'terminal' || e.props.maxRows < mainSize.rows + 1 || e.props.bodyColumns < mainSize.columns) {
      const { Text } = $.ui.resolve(e)
      const others = list.map(one => ` · ${one.type}: ${agentWords(one)}`).join('')
      return <Text dimColor>🐾 Claude: {words(shown.label)}{extra}{others}</Text>
    }

    // It only strolls alone; with agents around they gather on both sides, and when
    // they do not fit where it stands it hurries off to make room.
    // A proud pet struts about too; a sleepy, tired, worried or grumpy one stays put.
    const isRestless = shown.mood === 'idle' || shown.mood === 'proud'
    const width = slot + 1
    const extraColumns = hidden > 0 ? OVERFLOW_COLUMNS : 0
    const wanted = visible.map(one => sides.get(one.id))
    const placed = gather(clamp(walk?.x ?? 0, room), room, visible.length, width, extraColumns, wanted)
    const wants: Plan = visible.length > 0 ? { go: placed.x } : list.length === 0 && isRestless ? 'wander' : 'stay'
    // A pet that draws no walking but a teleport gets about by vanishing and
    // appearing, and goes nowhere else meanwhile.
    const teleport = pack.walks ? null : pack.teleport
    const moves = pack.walks || teleport !== null
    const pace = teleport === null ? paceOf(drives) : { ...paceOf(drives), stride: Infinity }
    const from = clamp(walk?.x ?? 0, room)
    const walked = walkStep(walk, moves && blink === undefined ? wants : 'stay', frame, room, pack.fps, Math.random, pace)
    // A pet that does neither is set down where they fit.
    walk = moves || placed.x === walked.walk.x ? walked.walk : { ...walked.walk, x: placed.x, target: placed.x }
    if (teleport !== null && walked.moving && blink === undefined) blink = { from, start: frame }
    // Where it shows: where it vanishes from until it is gone, then where it lands.
    let standX = walk.x
    let blinkFrame: Frame | undefined
    if (teleport !== null && blink !== undefined) {
      const at = frame - blink.start
      if (at < teleport.vanish.length) {
        blinkFrame = teleport.vanish[at]
        standX = clamp(blink.from, room)
      } else if (at < teleport.vanish.length + teleport.appear.length) blinkFrame = teleport.appear[at - teleport.vanish.length]
      else blink = undefined
    }
    // The agents that do not fit around it yet, and the "+N", join once it gets there.
    const drawn = onTheWay(standX, placed, room, visible.length, width, wanted)
    const drawnCount = drawn.left.length + drawn.right.length
    const showsMore = standX === placed.x && hidden > 0
    const sideOf = (index: number) => sideIn(drawn, index)
    // One not drawn yet keeps the side it had, so it does not hop over once it shows.
    sides = new Map(
      visible.flatMap((one, i): [string, Side][] => {
        const side = i < drawnCount ? sideOf(i) : sides.get(one.id)
        return side === undefined ? [] : [[one.id, side]]
      }),
    )
    const isOnTheMove = walked.moving || blinkFrame !== undefined
    const isStrolling = isOnTheMove && wants === 'wander'
    const mood: Mood = pack.walks && walked.moving ? 'walking' : shown.mood
    const labelShown = isStrolling ? label('strolling') : shown.label
    // A line it says takes Claude's line for a moment, unless a reaction or a mood that
    // must show is on it.
    const isQuoting = saying !== null && saying.until > now && busy === null && !(flash !== null && flash.until > now)
    const said = isQuoting ? `“${saying?.text}”` : words(labelShown)

    const moved = step(pack, motion, mood, frame, Math.random)
    motion = moved.motion
    // It faces the way it walks, else the agent finishing as it says goodbye, else the first.
    const finishing = visible.slice(0, drawnCount).findLastIndex(one => one.leaving !== undefined)
    const facing = faceFor(isOnTheMove, walk.facing, drawn, Math.max(finishing, 0))
    const shape = blinkFrame ?? moved.frame
    const body = facing === 1 ? shape : mirror(shape)
    const cells = encode(body, pack.colors)
    // Nothing but the pet's own frame will move until something is written or
    // time passes: no turn, agents, stroll or blink, reaction or line it says.
    const isStill =
      !e.props.isWorking &&
      list.length === 0 &&
      !isOnTheMove &&
      blink === undefined &&
      (!moves || wants === 'stay') &&
      busy === null &&
      !(flash !== null && flash.until > now) &&
      !isQuoting
    still = isStill ? { requestId: e.requestId, mood, facing, cells } : null

    const { Box, Raster, Text } = $.ui.resolve(e)
    const agentPet = (index: number, side: Side) => {
      const one = visible[index]
      if (one === undefined) return null
      const miniFrames = pack.mini?.[one.leaving?.mood ?? 'working'] ?? []
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
    const leftColumns = drawn.left.length * width + (showsMore && drawn.more === -1 ? extraColumns : 0)

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>Claude</Text> <Text dimColor>· {said}{extra}</Text>
        </Text>
        <Box flexDirection="row" marginLeft={standX - leftColumns}>
          {showsMore && drawn.more === -1 && (
            <Box width={OVERFLOW_COLUMNS}>
              <Text dimColor>+{hidden}</Text>
            </Box>
          )}
          {[...drawn.left].reverse().map(i => agentPet(i, -1))}
          <Raster key="main" {...mainSize} cells={cells} />
          {drawn.right.map(i => agentPet(i, 1))}
          {showsMore && drawn.more === 1 && <Text dimColor> +{hidden}</Text>}
        </Box>
      </Box>
    )
  })
}
