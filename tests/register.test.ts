import type { Args, On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/someone'

const pack = (name: string) =>
  JSON.stringify({
    name,
    palette: { o: '#000000', b: '#ff8800' },
    main: { moods: { sleeping: [['oo', 'bb']], typing: [['bb', 'oo']] } },
    mini: { moods: { working: [['ob', 'bo']] } },
  })

// Stands in for the disk: paths ending in a key answer its text, the rest are
// missing. Returns the paths read, in order.
// Local times, so the time of day reads the same on any machine.
const at = (hour: number, day = 15) => new Date(2026, 0, day, hour, 0).getTime()

const setup = (
  on: On,
  entries: Record<string, string> = { '/pets/cat.json': pack('cat') },
  settings: Record<string, unknown> = {},
  now = at(14),
  stored: Record<string, unknown> = {},
) => {
  const reads: string[] = []
  const clock = mock.clock(on, { now })
  mock.store(on, stored)
  mock.env(on, { HOME, LANG: 'en_US.UTF-8' })
  on('settings.read', () => ({ value: settings }))
  on('fs.read', (_$, e) => {
    reads.push(e.path)
    const hit = Object.entries(entries).find(([suffix]) => e.path.endsWith(suffix))
    return hit === undefined ? { deny: `ENOENT: ${e.path}` } : { value: hit[1] }
  })
  return { reads, clock }
}

const band = (isWorking: boolean) =>
  ({
    plugin: 'pixel-pets',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }) as const

const runPet = { command: 'pet', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const spawn = {
  tool_use_id: 'toolu_1',
  prompt: 'look around',
  description: 'look around',
  subagentType: 'Explore',
  provider: { plugin: 'core', tier: 'builtin' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
} as const

const finished = { answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as const

test('sleeps while no turn runs', async ($, on) => {
  setup(on)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'main' })).toBeDefined()
  expect(await ui.find({ text: /sleeping/ })).toBeDefined()
})

test('shows what the main loop is running', async ($, on) => {
  setup(on)
  on('tool.call', () => ({ result: 'ok' }))
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /running npm test/ })).toBeDefined()
})

test('turns sad when a tool fails', async ($, on) => {
  setup(on)
  on('tool.call', () => ({ result: 'boom', isError: true }))
  await $.tool.call({ tool: 'Bash', command: 'false' })

  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /failed/ })).toBeDefined()
})

test('gives each subagent its own pet until its run ends', async ($, on) => {
  const { clock } = setup(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', () => ({ text: '' }))

  await $.agent.spawn(spawn)
  // The engine stamps agentId on a subagent's calls; the test stands in for it.
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts', agentId: 'a1' } as never)

  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'mini-a1' })).toBeDefined()
  expect(await ui.find({ text: 'Explore' })).toBeDefined()
  expect(await ui.find({ text: /reading auth\.ts/ })).toBeDefined()

  await $.turn.complete({ ...finished, agentId: 'a1' })
  const leaving = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await leaving.find({ text: 'done!' })).toBeDefined()

  await clock.advance(2000)
  const after = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await after.find({ text: 'Explore' })).toBeUndefined()
})

test('/pet hides and brings back the band', async ($, on) => {
  setup(on)
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine band' }))
  await $.command.run(runPet)
  const hidden = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await hidden.find({ type: 'Raster', key: 'main' })).toBeUndefined()

  await $.command.run(runPet)
  const shown = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await shown.find({ type: 'Raster', key: 'main' })).toBeDefined()
})

test('falls back to a line of text off the terminal', async ($, on) => {
  setup(on)
  const ui = await $.ui.mount({ ...band(false), surface: 'desktop' })
  expect(await ui.find({ text: /Claude: sleeping/ })).toBeDefined()
})

test('falls back to a line of text on a terminal narrower than the pet', async ($, on) => {
  setup(on)
  // The test pet is 2 columns wide.
  const narrow = { ...band(false), props: { ...band(false).props, bodyColumns: 1 } }
  const ui = await $.ui.mount({ ...narrow, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'main' })).toBeUndefined()
  expect(await ui.find({ text: /Claude: sleeping/ })).toBeDefined()
})

// Two shipped pets, `cat` (the settings' pet) and `dog`, in a project at /repo.
const inProject = (on: On, stored: Record<string, unknown> = {}) => {
  // What the plugin keeps of the projects' pets, as last written; seen before the store takes it.
  const kept: { projectPets?: unknown } = {}
  on('store.set', { key: 'projectPets' }, (_$, e, next) => {
    kept.projectPets = e.value
    return next(e)
  })
  const found = setup(on, { '/pets/cat.json': pack('cat'), '/pets/dog.json': pack('dog') }, {}, at(14), stored)
  on('session.root', () => ({ value: '/repo' }))
  return { ...found, kept }
}
const loaded = (reads: string[], name: string) => reads.some(path => path.endsWith(`/pets/${name}.json`))

test("/pet <name> picks this project's pet and keeps it", async ($, on) => {
  const { reads, kept } = inProject(on)
  expect(await $.command.run({ ...runPet, args: 'dog' })).toEqual({ text: "This project's pet: dog." })
  expect(loaded(reads, 'dog')).toBe(true)
  expect(kept.projectPets).toEqual({ '/repo': 'dog' })
})

test("a session opens with its project's pet", async ($, on) => {
  const { reads } = inProject(on, { projectPets: { '/repo': 'dog', '/other': 'cat' } })
  await opens($, on)
  expect(loaded(reads, 'dog')).toBe(true)
  expect(loaded(reads, 'cat')).toBe(false)
})

test("the project's pet wins even when the band was drawn before the session started", async ($, on) => {
  const { reads } = inProject(on, { projectPets: { '/repo': 'dog' } })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(loaded(reads, 'cat')).toBe(true)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(loaded(reads, 'dog')).toBe(true)
})

test('/pet with a pet that does not load changes nothing', async ($, on) => {
  const { kept } = inProject(on)
  expect(await $.command.run({ ...runPet, args: 'nope' })).toEqual({ text: `Couldn't change the pet: pet "nope" not found.` })
  expect(kept.projectPets).toBeUndefined()
})

test("/pet default goes back to the settings' pet", async ($, on) => {
  const { kept } = inProject(on, { projectPets: { '/repo': 'dog', '/other': 'dog' } })
  expect(await $.command.run({ ...runPet, args: 'default' })).toEqual({ text: "This project is back to your settings' pet: cat." })
  expect(kept.projectPets).toEqual({ '/other': 'dog' })
})

test("/pet default lets go of the project's pet even when the settings' one is broken", { options: { pet: 'custom', customPet: 'gone' } }, async ($, on) => {
  const { kept } = inProject(on, { projectPets: { '/repo': 'dog' } })
  expect(await $.command.run({ ...runPet, args: 'default' })).toEqual({ text: "This project is back to your settings' pet: gone." })
  expect(kept.projectPets).toEqual({})
})

test("the person's own pets folder wins over the shipped pack", async ($, on) => {
  const { reads } = setup(on, { [`${HOME}/.claude/pets/cat.json`]: pack('my-cat'), '/pets/cat.json': pack('cat') })

  await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(reads).toEqual([`${HOME}/.claude/pets/cat.json`])
})

test('a broken pack falls back to the shipped cat and says why', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  setup(on, { [`${HOME}/.claude/pets/cat.json`]: '{"name":"cat"}', '/pets/cat.json': pack('cat') })

  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'main' })).toBeDefined()
  expect(toasts.join()).toMatch(/palette: required/)
})

test('speaks the language chosen in the config', { options: { language: 'pt-BR' } }, async ($, on) => {
  setup(on)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /dormindo/ })).toBeDefined()
})

test("auto follows Claude Code's language setting", async ($, on) => {
  setup(on, undefined, { language: 'Português' })
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /dormindo/ })).toBeDefined()
})

test('loads the pet picked in the config', { options: { pet: 'owl' } }, async ($, on) => {
  const { reads } = setup(on, { '/pets/owl.json': pack('owl'), '/pets/cat.json': pack('cat') })
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(reads.at(-1)).toMatch(/\/pets\/owl\.json$/)
})

test('custom loads the person\'s own pack', { options: { pet: 'custom', customPet: 'my-pet' } }, async ($, on) => {
  const { reads } = setup(on, { '/pets/my-pet.json': pack('my-pet'), '/pets/cat.json': pack('cat') })
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(reads.at(-1)).toMatch(/\/pets\/my-pet\.json$/)
})

test('refuses a pet name that walks out of the pets folder', { options: { pet: 'custom', customPet: '../../.ssh/id_rsa' } }, async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }))
  const { reads } = setup(on)
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(reads.every(path => path.endsWith('/pets/cat.json'))).toBe(true)
  expect(toasts.join()).toMatch(/not a valid pet name/)
})

test('names the action for each kind of tool', async ($, on) => {
  setup(on)
  on('tool.call', () => ({ result: 'ok' }))
  const label = async () => {
    const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await $.tool.call({ tool: 'Edit', file_path: '/repo/a.ts', old_string: 'a', new_string: 'b' })
  expect(await label()).toMatch(/writing a\.ts/)
  await $.tool.call({ tool: 'Read', file_path: '/repo/b.ts' })
  expect(await label()).toMatch(/reading b\.ts/)
  await $.tool.call({ tool: 'WebSearch', query: 'pets', mode: 'standard' })
  expect(await label()).toMatch(/searching \(WebSearch\)/)
})

test('a prompt startles the pet only out of a deep sleep', async ($, on) => {
  const { clock } = setup(on)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  const prompt = { text: 'hi', wait: false, origin: { kind: 'composer' } } as const
  const startled = async () => {
    const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
    return (await ui.find({ text: /waking up/ })) !== undefined
  }

  await $.turn.complete(finished)
  await clock.advance(60_000)
  await $.prompt.submit(prompt)
  expect(await startled()).toBe(false)

  await clock.advance(11 * 60_000)
  await $.prompt.submit(prompt)
  expect(await startled()).toBe(true)

  await clock.advance(1500)
  expect(await startled()).toBe(false)
})

test('sweats when a turn runs long, and says for how long', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.turn.start({ text: 'hi', turnId: 't1' })

  await clock.advance(3 * 60_000)
  // So long a think also earns a "hmm…", which has the line for a few seconds.
  const musing = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await musing.find({ text: /“hmm…” · 3m/ })).toBeDefined()
  await clock.advance(5000)
  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /thinking · 3m/ })).toBeDefined()
})

test('falls fast asleep after a long idle time', async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)

  await clock.advance(11 * 60_000)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /fast asleep/ })).toBeDefined()
})

// A tool call whose permission dialog the person answers with `ok` or a no.
const askedCall = ($: Parameters<TestBody>[0], on: On, ok: boolean) => {
  // No hook decides, so the dialog opens.
  on('classic.PermissionRequest', () => ({}))
  on('tool.call', async (_$, e) => {
    await $.classic.PermissionRequest({ tool_name: String(e.tool), tool_input: {} })
    return ok
      ? { result: 'ok' }
      : { result: "Error: The user doesn't want to proceed with this tool use.", isError: true }
  })
}

test('thanks you for a yes to a permission prompt', async ($, on) => {
  setup(on)
  askedCall($, on, true)
  await $.tool.call({ tool: 'Bash', command: 'touch x' } as never)

  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /thanks!/ })).toBeDefined()
})

test('takes a no calmly, and the turn ending does not cheer over it', async ($, on) => {
  setup(on)
  askedCall($, on, false)
  on('turn.complete', () => ({ text: '' }))
  await $.tool.call({ tool: 'Bash', command: 'touch x' } as never)
  // As the engine ends it after a no: a plain answer, not aborted.
  await $.turn.complete(finished)

  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /okay, I won't/ })).toBeDefined()
  expect(await ui.find({ text: /failed|done!/ })).toBeUndefined()
})

test('an interrupted turn does not cheer', async ($, on) => {
  setup(on)
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete({ ...finished, isAborted: true })

  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /done!/ })).toBeUndefined()
})

test('a turn that only thinks while agents run is waiting on them', async ($, on) => {
  setup(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.agent.spawn({ ...spawn, background: true })
  await $.turn.start({ text: '', turnId: 't2' })

  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: '· waiting for agents' })).toBeDefined()
})

test('shows it is compacting, even between turns', async ($, on) => {
  const { clock } = setup(on)
  let finish = () => {}
  on('session.compact', () => new Promise(resolve => (finish = () => resolve({ skip: 'test' }))))

  const pending = $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  // Let the plugin's hook reach its own `next` before drawing.
  await clock.advance(1)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /tidying up its memory/ })).toBeDefined()

  finish()
  await pending
  const after = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await after.find({ text: /sleeping/ })).toBeDefined()
})

test('stays awake, hanging around, for a while after a turn, then naps', async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await clock.advance(3000)
  expect(await label()).toBe('· hanging around')

  await clock.advance(2 * 60_000)
  expect(await label()).toBe('· sleeping')
})

test('after hours of work it runs low on energy and dozes off sooner', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  const label = async (isWorking = false) => {
    const ui = await $.ui.mount({ ...band(isWorking), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await $.turn.start({ text: 'hi', turnId: 't1' })
  await label(true)
  await clock.advance(3 * 60 * 60_000)
  await label(true)
  await $.turn.complete(finished)

  // Half its usual minute awake.
  await clock.advance(20_000)
  expect(await label()).toBe('· hanging around')
  await clock.advance(20_000)
  expect(await label()).toBe('· sleeping')
})

test('bored in a nap, it gets up on its own for a while, but not out of a deep sleep', async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await clock.advance(3000)
  expect(await label()).toBe('· hanging around')
  await clock.advance(2 * 60_000)
  expect(await label()).toBe('· sleeping')
  await clock.advance(4 * 60_000)
  // Up on its own, it says so for a moment.
  expect(await label()).toBe('· “nothing to do…”')
  await clock.advance(30_000)
  expect(await label()).toBe('· hanging around')
  await clock.advance(30_000)
  expect(await label()).toBe('· sleeping')
  await clock.advance(4 * 60_000)
  expect(await label()).toBe('· fast asleep')
})

test('a pet made with no curiosity never gets up from a nap out of boredom', async ($, on) => {
  const incurious = { ...JSON.parse(pack('cat')), personality: { curious: 0 } }
  const { clock } = setup(on, { '/pets/cat.json': JSON.stringify(incurious) })
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await clock.advance(3000)
  await label()
  await clock.advance(2 * 60_000)
  await label()
  await clock.advance(4 * 60_000)
  expect(await label()).toBe('· sleeping')
})

test('asleep, it talks in its sleep now and then', async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  // Bored, it is up around minute 5; back asleep by minute 7, it dreams 10 to 20 minutes later.
  const seen = new Set<string | undefined>()
  for (let minute = 0; minute <= 30; minute++) {
    await clock.advance(60_000)
    seen.add(await label())
  }
  expect(seen).toContain('· “zzz… mmh…”')
})

test('a prompt from the person keeps boredom away', async ($, on) => {
  const { clock } = setup(on)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await label()
  await clock.advance(5 * 60_000)
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete(finished)
  await clock.advance(2 * 60_000)
  expect(await label()).toBe('· sleeping')
})

test('after a long while away, the first key it sees is greeted; a short while is not', async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('prompt.edit', (_$, e) => ({ text: e.text + e.inputText, cursor: e.cursor + e.inputText.length }))
  await $.turn.complete(finished)
  // The kit raises prompt.edit, though its types leave the call out.
  const raise = ($.prompt as unknown as { edit: (e: Args<'prompt.edit'>) => Promise<unknown> }).edit
  const key = () => raise({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'h' })
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await label()
  await clock.advance(40 * 60_000)
  await key()
  expect(await label()).toBe('· missed you!')
  await clock.advance(3000)
  // Glad to see them, it does not sink back into a deep sleep while they stop to think.
  expect(await label()).not.toBe('· fast asleep')
  await key()
  expect(await label()).toBe('· watching you type')

  await clock.advance(5 * 60_000)
  await key()
  expect(await label()).toBe('· watching you type')

  // Glad to see them, it was up already: a prompt does not startle it.
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  expect(await label()).not.toBe('· waking up')
})

test('a key during a long turn is not greeted: the band keeps showing the work', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('prompt.edit', (_$, e) => ({ text: e.text + e.inputText, cursor: e.cursor + e.inputText.length }))
  // The kit raises prompt.edit, though its types leave the call out.
  const raise = ($.prompt as unknown as { edit: (e: Args<'prompt.edit'>) => Promise<unknown> }).edit
  const label = async () => {
    const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await $.turn.start({ text: 'hi', turnId: 't1' })
  await label()
  await clock.advance(40 * 60_000)
  await raise({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'h' })
  expect(await label()).not.toBe('· missed you!')
})

test('how long it stays awake comes from the config', { options: { awakeMinutes: 0 } }, async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)

  await clock.advance(3000)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: '· sleeping' })).toBeDefined()
})

test("with labelLine off the band is the stage alone, without Claude's line", { options: { labelLine: false } }, async ($, on) => {
  setup(on)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /^· / })).toBeUndefined()
  expect(await ui.findAll({ type: 'Raster' })).toHaveLength(1)
})

test("agents' pets stand to the right with their labels in full", async ($, on) => {
  setup(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('tool.call', () => ({ result: 'ok' }))
  await $.agent.spawn(spawn)
  await $.tool.call({ tool: 'Grep', pattern: 'pet', agentId: 'a1' } as never)

  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: 'searching (Grep)' })).toBeDefined()
})

test('a pack with no mini pets shows none for its agents, and no "+N"', async ($, on) => {
  const noMini = JSON.stringify({ ...JSON.parse(pack('cat')), mini: false })
  setup(on, { '/pets/cat.json': noMini })
  let spawned = 0
  on('agent.spawn', () => ({ model: 'haiku', agentId: `a${(spawned += 1)}` }))
  for (let i = 0; i < 2; i++) await $.agent.spawn({ ...spawn, tool_use_id: `toolu_${i}` })

  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.findAll({ type: 'Raster' })).toHaveLength(1)
  expect(await ui.find({ text: /^\+/ })).toBeUndefined()
  expect(await ui.find({ text: '· waiting for agents' })).toBeDefined()
})

test('on a narrow terminal it shows the agents that fit and counts the rest', async ($, on) => {
  setup(on)
  let spawned = 0
  on('agent.spawn', () => ({ model: 'haiku', agentId: `a${(spawned += 1)}` }))
  for (let i = 0; i < 3; i++) await $.agent.spawn({ ...spawn, tool_use_id: `toolu_${i}` })

  const narrow = { ...band(true), props: { ...band(true).props, bodyColumns: 30 } }
  const ui = await $.ui.mount({ ...narrow, surface: 'terminal' })
  // 30 columns leave room beside the 2-column test pet for one slot and the " +N".
  expect(await ui.findAll({ type: 'Raster' })).toHaveLength(2)
  expect(await ui.find({ key: 'mini-a1' })).toBeDefined()
  expect(await ui.find({ text: '+2' })).toBeDefined()
})

// Labels seen over 30 idle seconds, with the frame clock running.
const idleLabels = async ($: Parameters<TestBody>[0], on: On, petFile: string) => {
  const { clock } = setup(on, { '/pets/cat.json': petFile })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.complete(finished)
  await clock.advance(3000)
  const seen = new Set<string | undefined>()
  for (let second = 0; second < 30; second++) {
    await clock.advance(1000)
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    seen.add((await ui.find({ text: /^· / }))?.text)
  }
  return seen
}

test('a pet that draws walking strolls while idle', async ($, on) => {
  const walker = JSON.parse(pack('cat'))
  walker.main.moods.walking = [['bo', 'ob']]
  expect(await idleLabels($, on, JSON.stringify(walker))).toContain('· strolling around')
})

test('a pet that draws a teleport and no walking gets about by vanishing and appearing', async ($, on) => {
  const blinker = JSON.parse(pack('cat'))
  blinker.main.teleport = { vanish: [['o.', '..']], appear: [['..', 'b.']] }
  expect(await idleLabels($, on, JSON.stringify(blinker))).toContain('· strolling around')
})

test('a teleport draws its vanish and appear frames', async ($, on) => {
  const blinker = JSON.parse(pack('cat'))
  // Unlike the pet, which looks the same either way it faces.
  blinker.main.teleport = { vanish: [['o.', '..']], appear: [['..', 'b.']] }
  const { clock } = setup(on, { '/pets/cat.json': JSON.stringify(blinker) })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.complete(finished)
  await clock.advance(3000)
  const drawings = new Set<unknown>()
  // A second apart is enough: the draw it lands on shows the first vanish frame.
  for (let second = 0; second < 30; second++) {
    await clock.advance(1000)
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    drawings.add((await ui.find({ type: 'Raster', key: 'main' }))?.props.cells)
  }
  // The pet itself, then the teleport's own frames.
  expect(drawings.size).toBeGreaterThan(1)
})

test('an action that startles them makes the agents jump, from the jump\'s first frame each time', async ($, on) => {
  const whipper = JSON.parse(pack('cat'))
  // Three frames every second and three more: each whip starts at another point of a three-frame clock.
  whipper.main.actions = { whip: { frames: [['oo', 'bb'], ['bb', 'oo'], ['ob', 'bo']], moods: ['supervising'], every: [1, 1], startles: 0 } }
  whipper.mini.moods.working = [['bb', 'bb']]
  whipper.mini.moods.startled = [['oo', 'oo'], ['ob', 'ob'], ['bo', 'bo']]
  const { clock } = setup(on, { '/pets/cat.json': JSON.stringify(whipper) })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ ...spawn, background: true })
  const seen: unknown[] = []
  for (let tick = 0; tick < 30; tick++) {
    await clock.advance(250)
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    seen.push(JSON.stringify((await ui.find({ type: 'Raster', key: 'mini-a1' }))?.props.cells))
  }
  // At work, then the same three-frame jump each time the whip plays.
  const working = seen[0]
  const jumps = seen
    .map(cells => (cells === working ? '|' : cells))
    .join(' ')
    .split('|')
    .map(run => run.trim())
    .filter(run => run !== '')
  expect(jumps.length).toBeGreaterThan(2)
  expect(new Set(jumps).size).toBe(1)
  expect(new Set(jumps[0]?.split(' ')).size).toBe(3)
})

test('a pet that draws no walking stays put', async ($, on) => {
  expect([...(await idleLabels($, on, pack('cat')))]).toEqual(['· hanging around'])
})

// A pet asleep, breathing in two frames, with the frame clock running; returns
// the repaints the clock sends between full redraws.
const asleepWithClock = async ($: Parameters<TestBody>[0], on: On, moods: Record<string, string[][]> = {}, napFor = 5 * 60_000) => {
  const breathing = JSON.stringify({ ...JSON.parse(pack('cat')), main: { moods: { sleeping: [['oo', 'bb'], ['bb', 'oo']], ...moods } } })
  const { clock } = setup(on, { '/pets/cat.json': breathing })
  const blits: string[] = []
  const engineDraws = { count: 0 }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  // The engine's own band, drawn while the pet is hidden.
  on('ui.render', ($, e) => {
    engineDraws.count += 1
    return $.ui.resolve(e).Text({ children: 'engine band' })
  })
  on('ui.blit', (_$, e) => {
    if ('cells' in e) blits.push(e.key)
    return { value: {} }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(napFor)
  return { clock, blits, engineDraws }
}

test('asleep, only its frame is repainted between full redraws', async ($, on) => {
  const { clock, blits } = await asleepWithClock($, on)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: '· sleeping' })).toBeDefined()

  await clock.advance(2000)
  expect(blits.length).toBeGreaterThan(0)
  expect(new Set(blits)).toEqual(new Set(['main']))
})

test('with agents around, the band is redrawn in full, not just the pet', async ($, on) => {
  const { clock, blits } = await asleepWithClock($, on)
  await $.agent.spawn({ ...spawn, background: true })
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: '· waiting for agents' })).toBeDefined()

  await clock.advance(2000)
  expect(blits).toEqual([])
})

test('a second session.start does not start a second frame clock', async ($, on) => {
  const { clock, blits } = await asleepWithClock($, on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  // Two frames that take turns, four frames a second: at most one repaint a frame.
  await clock.advance(2000)
  expect(blits.length).toBeLessThanOrEqual(8)
})

test('awake, a pet that may stroll off is redrawn in full, not just repainted', async ($, on) => {
  const moods = { idle: [['oo', 'bb'], ['bb', 'oo']], walking: [['bo', 'ob']] }
  const { clock, blits } = await asleepWithClock($, on, moods, 1000)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /hanging around|strolling around/ })).toBeDefined()

  await clock.advance(10_000)
  expect(blits).toEqual([])
})

test('hidden, nothing is repainted or redrawn', async ($, on) => {
  const { clock, blits, engineDraws } = await asleepWithClock($, on)
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  await $.command.run(runPet)
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  const drawn = engineDraws.count

  await clock.advance(2000)
  expect(blits).toEqual([])
  expect(engineDraws.count).toBe(drawn)
})

test('keeps an eye on background agents after the turn ends, then hangs around', async ($, on) => {
  const { clock } = setup(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }))
  await $.agent.spawn({ ...spawn, background: true })
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await clock.advance(5 * 60_000)
  expect(await label()).toBe('· waiting for agents')

  await $.turn.complete({ ...finished, agentId: 'a1' })
  await clock.advance(3000)
  expect(await label()).toBe('· hanging around')
})

test('cheers when the last background agent is done, not at each one', async ($, on) => {
  setup(on)
  let spawned = 0
  on('agent.spawn', () => ({ model: 'haiku', agentId: `a${(spawned += 1)}` }))
  on('turn.complete', () => ({ text: '' }))
  await $.agent.spawn({ ...spawn, background: true, tool_use_id: 'toolu_1' })
  await $.agent.spawn({ ...spawn, background: true, tool_use_id: 'toolu_2' })
  await $.turn.complete(finished)
  const main = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  // Each agent that ends opens a main turn that reports it.
  await $.turn.complete({ ...finished, agentId: 'a1' })
  await $.turn.complete(finished)
  expect(await main()).toBe('· waiting for agents')

  await $.turn.complete({ ...finished, agentId: 'a2' })
  await $.turn.complete(finished)
  expect(await main()).toBe('· done!')
})

test('a turn that only talks earns no cheer', async ($, on) => {
  setup(on)
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: '· done!' })).toBeUndefined()
})

test('a pet keeping an eye on background agents is not startled by a prompt', async ($, on) => {
  const { clock } = setup(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  await $.agent.spawn({ ...spawn, background: true })
  await $.turn.complete(finished)

  await clock.advance(11 * 60_000)
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /waking up/ })).toBeUndefined()
})

const failedTool = { result: 'boom', isError: true } as const

test('failures add up to a worried pet, then a grumpy one', async ($, on) => {
  const { clock } = setup(on)
  on('tool.call', () => failedTool)
  on('turn.complete', () => ({ text: '' }))
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.turn.complete({ ...finished, reason: 'error' } as never)
  await clock.advance(3000)
  expect(await label()).toBe('· a bit worried')

  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.turn.complete({ ...finished, reason: 'error' } as never)
  await clock.advance(3000)
  expect(await label()).toBe('· grumpy')
})

test('turns that go well make it proud', async ($, on) => {
  const { clock } = setup(on)
  on('turn.complete', () => ({ text: '' }))
  for (let i = 0; i < 3; i++) await $.turn.complete(finished)

  await clock.advance(3000)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /^· (proud of us|strolling around)$/ })).toBeDefined()
})

test('at night it is sleepy, and dozes off in half the time', async ($, on) => {
  const { clock } = setup(on, undefined, undefined, at(23))
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(finished)
  const label = async () => {
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /^· / }))?.text
  }

  await clock.advance(3000)
  expect(await label()).toBe('· sleepy')
  await clock.advance(40_000)
  expect(await label()).toBe('· sleeping')
})

test('says good morning on the first session of the day only', async ($, on) => {
  const { clock } = setup(on, undefined, undefined, at(8))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const greeted = async () => {
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
    return (await ui.find({ text: /good morning!/ })) !== undefined
  }

  expect(await greeted()).toBe(true)
  await clock.advance(5000)
  expect(await greeted()).toBe(false)
})

// What the other sessions left in the store: the person last seen a minute ago,
// back from their last break `hoursAgo`.
const workedFor = (hoursAgo: number, lastSeenAgo = 60_000) => ({
  visit: { metAt: at(14) - 5 * 24 * 60 * 60_000, lastSeenAt: at(14) - lastSeenAgo },
  restedAt: at(14) - hoursAgo * 60 * 60_000,
})

test('a session opened after hours of work in others is tired too', async ($, on) => {
  setup(on, undefined, undefined, at(14), workedFor(4))
  expect(await opens($, on)).toBe('· tired')
})

test('an hour with no prompt in any session rests it', async ($, on) => {
  setup(on, undefined, undefined, at(14), workedFor(4, 61 * 60_000))
  expect(await opens($, on)).toBe('· hanging around')
})

test('a prompt after an hour away rests a session left open', async ($, on) => {
  const { clock } = setup(on, undefined, undefined, at(14), workedFor(4))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  expect(await opens($, on)).toBe('· tired')
  // In steps: the frame clock runs, and one advance takes 10,000 waits at most.
  for (let i = 0; i < 4; i++) await clock.advance(16 * 60_000)
  await $.prompt.submit({ text: 'back', wait: false, origin: { kind: 'composer' } })
  // Startled awake, then the turn it asked for ends: awake, and showing how it feels.
  await clock.advance(2000)
  await $.turn.complete({ ...finished, isAborted: true })
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: '· hanging around' })).toBeDefined()
})

// A session opened at `now` by a person at the prompt, or by a `claude -p` run.
const opens = async ($: Parameters<TestBody>[0], on: On, isInteractive = true) => {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive })
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  return (await ui.find({ text: /^· / }))?.text
}

test('is glad to see you after days away', async ($, on) => {
  setup(on, undefined, undefined, at(14), { visit: { metAt: at(14, 1), lastSeenAt: at(14, 10) } })
  expect(await opens($, on)).toBe('· missed you!')
})

test('celebrates an anniversary over missing you', async ($, on) => {
  setup(on, undefined, undefined, at(14), { visit: { metAt: at(14, 8), lastSeenAt: at(14, 10) } })
  expect(await opens($, on)).toBe('· a week together!')
})

test('a claude -p run does not use up the morning greeting', async ($, on) => {
  const { clock } = setup(on, undefined, undefined, at(8))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  await clock.advance(5000)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: /good morning!/ })).toBeDefined()
})

test('/pet says how long you have been together', async ($, on) => {
  setup(on, undefined, undefined, at(14), { visit: { metAt: at(14, 3), lastSeenAt: at(14, 14) } })
  const ran = await $.command.run(runPet)
  expect(JSON.stringify(ran)).toContain('Pets hidden. Together for 12 days.')
})

test('a long turn that goes well earns a bigger celebration', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  await $.turn.start({ text: 'big job', turnId: 't1' })
  await clock.advance(6 * 60_000)
  await $.turn.complete(finished)

  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await ui.find({ text: '· phew, done!' })).toBeDefined()
  await clock.advance(3000)
  const still = await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(await still.find({ text: '· phew, done!' })).toBeDefined()
})

test('a session left open past midnight welcomes the first prompt of the new day', async ($, on) => {
  const almostMidnight = new Date(2026, 0, 14, 23, 59, 30).getTime()
  // Met six days ago and seen already today: nothing to say until the day turns.
  const { clock } = setup(on, undefined, undefined, almostMidnight, { visit: { metAt: at(14, 8), lastSeenAt: at(20, 14) } })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  expect(await opens($, on)).not.toMatch(/together|missed|morning/)

  await clock.advance(60_000)
  await $.prompt.submit({ text: 'still here', wait: false, origin: { kind: 'composer' } })
  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /a week together!/ })).toBeDefined()
})

const readFile = (file: string) => ({ tool: 'Read', file_path: file }) as never

// Draws the band and returns Claude's line.
const line = async ($: Parameters<TestBody>[0], isWorking = true) => {
  const ui = await $.ui.mount({ ...band(isWorking), surface: 'terminal' })
  return (await ui.find({ text: /^· / }))?.text
}

test('twenty reads in a turn earn a remark, in the pack\'s own words when it has them', async ($, on) => {
  const own = JSON.stringify({ ...JSON.parse(pack('cat')), speech: { en: { manyReads: ['mrrp, so many!'] } } })
  setup(on, { '/pets/cat.json': own })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok' }))
  await $.turn.start({ text: 'look around', turnId: 't1' })

  for (let i = 1; i < 20; i++) await $.tool.call(readFile(`f${i}.ts`))
  expect(await line($)).toBe('· reading f19.ts')
  await $.tool.call(readFile('f20.ts'))
  expect(await line($)).toBe('· “mrrp, so many!”')
})

test('a full team of agents earns a remark, but not right after another', async ($, on) => {
  const { clock } = setup(on)
  let spawned = 0
  on('agent.spawn', () => ({ model: 'haiku', agentId: `a${(spawned += 1)}` }))
  for (let i = 0; i < 3; i++) await $.agent.spawn({ ...spawn, tool_use_id: `toolu_${i}` })
  expect(await line($)).toBe('· “full team today!”')

  // A fourth agent a minute later: still too soon to speak again.
  await clock.advance(60_000)
  await $.agent.spawn({ ...spawn, tool_use_id: 'toolu_9' })
  expect(await line($)).not.toMatch(/“/)
})

test('late at night it says so, once a night across sessions', async ($, on) => {
  const { clock } = setup(on, undefined, undefined, at(23))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  const prompt = { text: 'one more thing', wait: false, origin: { kind: 'composer' } } as const

  await $.prompt.submit(prompt)
  expect(await line($)).toBe("· “it's getting late…”")
  await clock.advance(10 * 60_000)
  await $.turn.start({ text: 'one more thing', turnId: 't2' })
  await $.prompt.submit(prompt)
  expect(await line($)).not.toMatch(/late/)
})

test('a session open for days says it again the next night', async ($, on) => {
  const { clock } = setup(on, undefined, undefined, at(23))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  const prompt = { text: 'one more thing', wait: false, origin: { kind: 'composer' } } as const

  await $.prompt.submit(prompt)
  expect(await line($)).toBe("· “it's getting late…”")
  await clock.advance(24 * 60 * 60_000)
  await $.turn.start({ text: 'one more thing', turnId: 't2' })
  await $.prompt.submit(prompt)
  expect(await line($)).toBe("· “it's getting late…”")
})

test('late at night it stays quiet if another session said so tonight', async ($, on) => {
  // Said at 23h; this session sees the person at 1h, the same night.
  setup(on, undefined, undefined, at(1, 16), { lateNight: new Date(at(23)).toDateString() })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'one more thing', wait: false, origin: { kind: 'composer' } })
  expect(await line($)).not.toMatch(/late/)
})

test('the same remark can come again in a later turn', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok' }))
  const readTwenty = async (turnId: string) => {
    await $.turn.start({ text: 'look around', turnId })
    for (let i = 1; i <= 20; i++) await $.tool.call(readFile(`f${i}.ts`))
    return line($)
  }

  expect(await readTwenty('t1')).toBe('· “so many files!”')
  await clock.advance(4 * 60_000)
  expect(await readTwenty('t2')).toBe('· “so many files!”')
})

test('a long think after a tool still earns a "hmm…"', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok' }))
  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)

  await clock.advance(20_000)
  expect(await line($)).toBe('· running npm test')
  await clock.advance(11_000)
  expect(await line($)).toBe('· “hmm…”')
})

test('a slow tool is no long think', async ($, on) => {
  const { clock } = setup(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', async () => {
    await clock.sleep(60_000)
    return { result: 'ok' }
  })
  await $.turn.start({ text: 'build it', turnId: 't1' })
  const running = $.tool.call({ tool: 'Bash', command: 'npm run build' } as never)

  await clock.advance(40_000)
  expect(await line($)).toBe('· running npm run build')
  await clock.advance(20_000)
  await running
})
