import { describe, expect, test } from 'claude-code/testing'

import { choose, mean, reward, type Bandit } from '../learn/bandit'
import { credit } from '../learn/credit'
import { learn, predict, type Weights } from '../learn/logistic'
import { beta, seeded } from '../learn/random'
import { bumps, coder, encode, novelty, pick, recall, remember, see, type Familiar, type Memory } from '../learn/recall'

const DAY = 24 * 60 * 60_000
const roundTrip = <T>(x: T): T => JSON.parse(JSON.stringify(x))

describe('random', () => {
  test('a seed replays the same numbers, all in [0, 1)', () => {
    const a = seeded(42)
    const b = seeded(42)
    for (let i = 0; i < 1000; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x >= 0 && x < 1).toBe(true)
    }
  })

  test('beta draws average a / (a + b)', () => {
    const random = seeded(1)
    for (const [a, b] of [[1, 1], [0.5, 3], [8, 2]] as const) {
      let sum = 0
      for (let i = 0; i < 4000; i++) sum += beta(a, b, random)
      expect(Math.abs(sum / 4000 - a / (a + b))).toBeLessThan(0.02)
    }
  })
})

describe('bandit', () => {
  test('learns which action earns pets', () => {
    const random = seeded(3)
    let bandit: Bandit = {}
    for (let i = 0; i < 300; i++) {
      const action = choose(bandit, ['juggle', 'grumpy'], i, DAY, random)
      bandit = reward(bandit, action, random() < (action === 'juggle' ? 0.7 : 0.1) ? 1 : 0, i, DAY)
    }
    expect(mean(bandit, 'juggle', 300, DAY)).toBeGreaterThan(mean(bandit, 'grumpy', 300, DAY))
    expect(bandit.juggle!.wins + bandit.juggle!.losses).toBeGreaterThan(bandit.grumpy!.wins + bandit.grumpy!.losses)
  })

  test('evidence fades toward an even guess, never past it', () => {
    const bandit = reward(reward({}, 'nap', 1, 0, DAY), 'nap', 1, 0, DAY)
    const means = [0, 1, 3, 10, 50].map(days => mean(bandit, 'nap', days * DAY, DAY))
    for (let i = 1; i < means.length; i++) expect(means[i]!).toBeLessThan(means[i - 1]!)
    expect(means.at(-1)! >= 0.5).toBe(true)
  })

  test('survives the store: same means and the same choices after a JSON round trip', () => {
    let bandit: Bandit = {}
    const random = seeded(9)
    for (let i = 0; i < 50; i++) bandit = reward(bandit, ['a', 'b', 'c'][i % 3]!, random(), i * 1000, DAY)
    const copy = roundTrip(bandit)
    const [x, y] = [seeded(5), seeded(5)]
    for (let i = 0; i < 20; i++) expect(choose(copy, ['a', 'b', 'c'], 1e5, DAY, x)).toBe(choose(bandit, ['a', 'b', 'c'], 1e5, DAY, y))
    expect(mean(copy, 'a', 1e5, DAY)).toBe(mean(bandit, 'a', 1e5, DAY))
    expect(JSON.stringify(bandit).length).toBeLessThan(400)
  })
})

describe('logistic', () => {
  test('stays a probability and learns a plain rule', () => {
    const random = seeded(4)
    let weights: Weights = {}
    for (let i = 0; i < 2000; i++) {
      const busy = random()
      weights = learn(weights, { busy }, random() < (busy > 0.5 ? 0.9 : 0.1) ? 1 : 0, 0.2)
    }
    expect(predict(weights, { busy: 0.9 })).toBeGreaterThan(0.7)
    expect(predict(weights, { busy: 0.1 })).toBeLessThan(0.3)
    expect(predict(weights, { busy: 1e6 }) <= 1 && predict(weights, { busy: -1e6 }) >= 0).toBe(true)
    expect(predict(roundTrip(weights), { busy: 0.9 })).toBe(predict(weights, { busy: 0.9 }))
  })
})

describe('recall', () => {
  const c = coder(14, 400, 20, 3, seeded(7))
  const moment = (hour: number, rate: number) => [...bumps(hour, 0, 24, 8, true), ...bumps(rate, 0, 10, 6)]
  const overlap = (a: number[], b: number[]) => a.filter(x => b.includes(x)).length

  test('codes are fixed-size, distinct cells, and the same moment always codes the same', () => {
    const code = encode(c, moment(14, 3))
    expect(code.length).toBe(20)
    expect(new Set(code).size).toBe(20)
    expect(encode(c, moment(14, 3))).toEqual(code)
  })

  test('similar moments share more cells than unrelated ones', () => {
    const code = encode(c, moment(14, 3))
    expect(overlap(code, encode(c, moment(14.3, 3.2)))).toBeGreaterThan(overlap(code, encode(c, moment(2, 9))))
  })

  test('hours wrap around midnight', () => {
    expect(bumps(23.9, 0, 24, 8, true)[0]!).toBeGreaterThan(0.9)
  })

  test('recalls what followed similar moments, not unrelated ones', () => {
    const memory: Memory = {}
    for (let i = 0; i < 20; i++) remember(memory, 'nap', encode(c, moment(14, 1)), 1)
    const near = recall(memory, 'nap', encode(c, moment(14.5, 1.2)))
    const far = recall(memory, 'nap', encode(c, moment(2, 9)))
    expect(near).toBeGreaterThan(0.8)
    expect(far).toBeLessThan(near)
    expect(far >= 0 && near <= 1).toBe(true)
    const copy = roundTrip(memory)
    expect(recall(copy, 'nap', encode(c, moment(14.5, 1.2)))).toBe(near)
    expect(pick(copy, ['nap'], encode(c, moment(14, 1)), seeded(1))).toBe('nap')
  })

  test('novelty drops once seen and comes back as familiarity fades', () => {
    const familiar: Familiar = {}
    const code = encode(c, moment(3, 9))
    expect(novelty(familiar, code, 0, DAY)).toBe(1)
    see(familiar, code, 0, DAY)
    const later = [0, 0.5, 1, 3, 10].map(days => novelty(roundTrip(familiar), code, days * DAY, DAY))
    for (let i = 1; i < later.length; i++) expect(later[i]!).toBeGreaterThan(later[i - 1]!)
    expect(later[0]).toBe(0.5)
    expect(later.at(-1)!).toBeLessThan(1.0001)
  })
})

describe('credit', () => {
  test('shares a reward among recent actions, more to the nearer, none to the future or the stale', () => {
    const shares = credit(
      [
        { action: 'roast', at: 0 },
        { action: 'nap', at: 50_000 },
        { action: 'juggle', at: 80_000 },
        { action: 'grumpy', at: 200_000 },
      ],
      100_000,
      15_000,
      60_000,
    )
    expect(Object.keys(shares).sort()).toEqual(['juggle', 'nap'])
    expect(shares.juggle!).toBeGreaterThan(shares.nap!)
    expect(Math.abs(shares.juggle! + shares.nap! - 1)).toBeLessThan(1e-9)
    expect(credit([], 0, 15_000, 60_000)).toEqual({})
  })
})
