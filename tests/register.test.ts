import type { On } from 'claude-code'
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
const setup = (
  on: On,
  entries: Record<string, string> = { '/pets/cat.json': pack('cat') },
  settings: Record<string, unknown> = {},
) => {
  const reads: string[] = []
  const clock = mock.clock(on)
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

test('loads the pet named in the config', { options: { pet: 'dragon' } }, async ($, on) => {
  const { reads } = setup(on, { '/pets/dragon.json': pack('dragon'), '/pets/cat.json': pack('cat') })
  await $.ui.mount({ ...band(false), surface: 'terminal' })
  expect(reads.at(-1)).toMatch(/\/pets\/dragon\.json$/)
})

test('refuses a pet name that walks out of the pets folder', { options: { pet: '../../.ssh/id_rsa' } }, async ($, on) => {
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

test('says it is waiting for you while a permission prompt is open', async ($, on) => {
  const { clock } = setup(on)
  let answer = () => {}
  on('classic.PermissionRequest', () => new Promise(resolve => (answer = () => resolve({}))))

  const pending = $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  // Let the plugin's hook reach its own `next` before drawing.
  await clock.advance(1)
  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /waiting for you: Bash/ })).toBeDefined()

  answer()
  await pending
  const after = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await after.find({ text: /waiting for you/ })).toBeUndefined()
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
