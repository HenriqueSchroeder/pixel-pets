// Offline experiments S1–S7 for the learners in learn/, against a synthetic user.
// Run: npx tsx scripts/simulate-learning.ts [S1 S2 ...]

import { choose, mean, reward, type Bandit } from '../learn/bandit'
import { credit, type Shown } from '../learn/credit'
import { pickFor } from '../hooks/learning'
import { learn, predict, type Weights } from '../learn/logistic'
import { seeded, type Random } from '../learn/random'
import { bumps, coder, encode, novelty, pick, recall, remember, see, type Familiar, type Memory } from '../learn/recall'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const ACTIONS = ['juggle', 'roast', 'nap', 'grumpy']

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN
const fix = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x))
const table = (rows: Record<string, string | number>[]) => {
  const cols = Object.keys(rows[0] ?? {})
  const cell = (v: string | number | undefined) => String(v ?? '')
  const width = cols.map(c => Math.max(c.length, ...rows.map(r => cell(r[c]).length)))
  console.log(cols.map((c, i) => c.padEnd(width[i] ?? 0)).join('  '))
  for (const r of rows) console.log(cols.map((c, i) => cell(r[c]).padEnd(width[i] ?? 0)).join('  '))
}
const at = <T>(xs: T[], i: number) => xs[i] as T

// --- S1: does discounted TS learn, and relearn after a habit change?

const s1 = () => {
  const before: Record<string, number> = { juggle: 0.7, roast: 0.4, nap: 0.3, grumpy: 0.1 }
  const after: Record<string, number> = { juggle: 0.1, roast: 0.4, nap: 0.3, grumpy: 0.7 }
  const perDay = 10
  const days = 40
  const swap = 20 * perDay
  const policies: [string, number | undefined][] = [
    ['random', undefined],
    ['TS no forgetting', Infinity],
    ['TS half-life 3d', 3 * DAY],
    ['TS half-life 7d', 7 * DAY],
    ['TS half-life 14d', 14 * DAY],
  ]
  const rows = policies.map(([name, halfLife]) => {
    const regrets: number[] = []
    const recoveries: number[] = []
    const firstHits: number[] = []
    for (let seed = 0; seed < 100; seed++) {
      const random = seeded(seed)
      let bandit: Bandit = {}
      let regret = 0
      const picks: string[] = []
      for (let i = 0; i < perDay * days; i++) {
        const now = (i / perDay) * DAY
        const truth = i < swap ? before : after
        const action =
          halfLife === undefined ? at(ACTIONS, Math.floor(random() * 4)) : choose(bandit, ACTIONS, now, halfLife, random)
        const p = truth[action] ?? 0
        regret += 0.7 - p
        picks.push(action)
        if (halfLife !== undefined) bandit = reward(bandit, action, random() < p ? 1 : 0, now, halfLife)
      }
      regrets.push(regret)
      // Events from the start (or the swap) until 15 of the last 20 picks are the best action.
      const settle = (from: number, best: string) => {
        for (let i = from + 20; i <= picks.length; i++)
          if (picks.slice(i - 20, i).filter(a => a === best).length >= 15) return i - from
        return Infinity
      }
      firstHits.push(settle(0, 'juggle'))
      recoveries.push(settle(swap, 'grumpy'))
    }
    return {
      policy: name,
      'regret (400 ev)': fix(avg(regrets), 1),
      'learns in (median ev)': fix(median(firstHits), 0),
      'relearns in (median ev)': fix(median(recoveries), 0),
      'relearns ≤100 ev': `${recoveries.filter(r => r <= 100).length}%`,
    }
  })
  console.log('\nS1 — 4 actions, pet rates 0.7/0.4/0.3/0.1, best and worst swap at day 20; 10 events/day, 100 runs')
  table(rows)
}

// --- the synthetic user for S2–S4: what the pet sees when it decides

type Moment = { hour: number; rate: number; idle: number }

const moment = (random: Random): Moment => {
  const evening = random() < 0.3
  const hour = evening ? 18 + random() * 6 : 8 + random() * 10
  // Tool calls per minute and idle minutes pull against each other.
  const busy = random()
  return { hour, rate: busy * 10, idle: (1 - busy) * 40 * random() + random() * 20 }
}

const smooth = (x: number) => 1 / (1 + Math.exp(-x))
const bump = (hour: number, centre: number, width: number) => {
  const d = Math.min(Math.abs(hour - centre), 24 - Math.abs(hour - centre))
  return Math.exp(-((d / width) ** 2))
}

// Each action is liked in a combination of conditions, not along one axis.
const liking = (m: Moment): Record<string, number> => ({
  juggle: 0.15 + 0.6 * smooth((m.rate - 6) * 1.5) * bump(m.hour, 11, 4),
  roast: 0.15 + 0.6 * bump(m.hour, 21, 2.5) * smooth((m.idle - 20) / 4),
  nap: 0.15 + 0.6 * bump(m.hour, 14, 2) * smooth((3 - m.rate) * 1.5),
  grumpy: 0.1,
})

const inputsOf = (m: Moment) => [...bumps(m.hour, 0, 24, 8, true), ...bumps(m.rate, 0, 10, 6), ...bumps(m.idle, 0, 60, 6)]
const daypart = (m: Moment) => ['night', 'morning', 'afternoon', 'evening'][Math.floor(m.hour / 6)] ?? 'night'
const situation = (m: Moment) => `${daypart(m)}:${m.rate > 5 ? 'busy' : 'calm'}:${m.idle > 20 ? 'idle' : 'here'}`
const featuresOf = (m: Moment, action: string) => ({
  [`${action}:sin`]: Math.sin((m.hour / 24) * 2 * Math.PI),
  [`${action}:cos`]: Math.cos((m.hour / 24) * 2 * Math.PI),
  [`${action}:rate`]: m.rate / 10,
  [`${action}:idle`]: m.idle / 60,
  [`${action}:bias`]: 1,
})

type Policy = {
  choose(m: Moment, now: number): string
  estimate(m: Moment, action: string, now: number): number
  learn(m: Moment, action: string, value: number, now: number): void
}

const recallPolicy =
  (size: number, active: number) =>
  (random: Random): Policy => {
    const c = coder(20, size, active, 3, seeded(7))
    const memory: Memory = {}
    return {
      choose: m => pick(memory, ACTIONS, encode(c, inputsOf(m)), random),
      estimate: (m, a) => recall(memory, a, encode(c, inputsOf(m))),
      learn: (m, a, v) => remember(memory, a, encode(c, inputsOf(m)), v),
    }
  }

const policies: Record<string, (random: Random) => Policy> = {
  random: random => ({
    choose: () => at(ACTIONS, Math.floor(random() * 4)),
    estimate: () => 0.5,
    learn: () => {},
  }),
  'TS, one context': random => {
    let bandit: Bandit = {}
    return {
      choose: (_m, now) => choose(bandit, ACTIONS, now, Infinity, random),
      estimate: (_m, a, now) => mean(bandit, a, now, Infinity),
      learn: (_m, a, v, now) => void (bandit = reward(bandit, a, v, now, Infinity)),
    }
  },
  'TS per daypart (4)': random => {
    let bandit: Bandit = {}
    const key = (m: Moment, a: string) => `${daypart(m)}:${a}`
    return {
      choose: (m, now) => choose(bandit, ACTIONS.map(a => key(m, a)), now, Infinity, random).split(':')[1] ?? '',
      estimate: (m, a, now) => mean(bandit, key(m, a), now, Infinity),
      learn: (m, a, v, now) => void (bandit = reward(bandit, key(m, a), v, now, Infinity)),
    }
  },
  'TS per situation (16)': random => {
    let bandit: Bandit = {}
    const key = (m: Moment, a: string) => `${situation(m)}:${a}`
    return {
      choose: (m, now) => choose(bandit, ACTIONS.map(a => key(m, a)), now, Infinity, random).split(':').at(-1) ?? '',
      estimate: (m, a, now) => mean(bandit, key(m, a), now, Infinity),
      learn: (m, a, v, now) => void (bandit = reward(bandit, key(m, a), v, now, Infinity)),
    }
  },
  'LogReg, ε 0.1': random => {
    let weights: Weights = {}
    return {
      choose: m => {
        if (random() < 0.1) return at(ACTIONS, Math.floor(random() * 4))
        return ACTIONS.reduce((best, a) =>
          predict(weights, featuresOf(m, a)) > predict(weights, featuresOf(m, best)) ? a : best,
        )
      },
      estimate: (m, a) => predict(weights, featuresOf(m, a)),
      learn: (m, a, v) => void (weights = learn(weights, featuresOf(m, a), v, 0.1)),
    }
  },
  'Recall 1000, 5% on': recallPolicy(1000, 50),
  'Recall 1000, 20% on': recallPolicy(1000, 200),
  'Recall 250, 10% on': recallPolicy(250, 25),
  oracle: () => ({
    choose: m => Object.entries(liking(m)).reduce((a, b) => (b[1] > a[1] ? b : a))[0],
    estimate: (m, a) => liking(m)[a] ?? 0,
    learn: () => {},
  }),
}

const s2 = () => {
  const windows: [number, number][] = [[0, 100], [100, 250], [250, 500], [500, 1000]]
  const runs = 30
  const rows = Object.entries(policies).map(([name, make]) => {
    const rewardIn = windows.map(() => [] as number[])
    const error = windows.map(() => [] as number[])
    for (let seed = 0; seed < runs; seed++) {
      const world = seeded(1000 + seed)
      const policy = make(seeded(seed))
      for (let i = 0; i < 1000; i++) {
        const now = (i / 10) * DAY
        const m = moment(world)
        const action = policy.choose(m, now)
        const p = liking(m)[action] ?? 0
        const y = world() < p ? 1 : 0
        const w = windows.findIndex(([a, b]) => i >= a && i < b)
        at(rewardIn, w).push(p)
        at(error, w).push(avg(ACTIONS.map(a => Math.abs(policy.estimate(m, a, now) - (liking(m)[a] ?? 0)))))
        policy.learn(m, action, y, now)
      }
    }
    const row: Record<string, string> = { policy: name }
    windows.forEach(([a, b], i) => (row[`pets/ev ${a}-${b}`] = fix(avg(at(rewardIn, i)), 3)))
    row['estimate error 250-500'] = fix(avg(at(error, 2)), 3)
    row['estimate error 500-1000'] = fix(avg(at(error, 3)), 3)
    return row
  })
  console.log('\nS2 — liking depends on hour × tool-call rate × idle; expected pets per event (higher is better)')
  console.log('     and mean |estimate − true liking| over the 4 actions (lower is better); 30 runs')
  table(rows)
}

// --- S3: how pre-processing and shape change the sparse codes

const s3 = () => {
  const sample = Array.from({ length: 2000 }, ((r: Random) => () => moment(r))(seeded(5)))
  const raw = (m: Moment) => [Math.sin((m.hour / 24) * 2 * Math.PI), Math.cos((m.hour / 24) * 2 * Math.PI), m.rate / 10, m.idle / 60]
  const centred = (f: (m: Moment) => number[]) => {
    const all = sample.map(f)
    const n = at(all, 0).length
    const mu = Array.from({ length: n }, (_, j) => avg(all.map(v => at(v, j))))
    const sd = Array.from({ length: n }, (_, j) => Math.sqrt(avg(all.map(v => (at(v, j) - at(mu, j)) ** 2))) || 1)
    return (m: Moment) => f(m).map((v, j) => (v - at(mu, j)) / at(sd, j))
  }
  const variants: [string, (m: Moment) => number[]][] = [
    ['raw', raw],
    ['raw, centred', centred(raw)],
    ['bumps', inputsOf],
    ['bumps, centred', centred(inputsOf)],
  ]
  const near = (m: Moment, r: Random): Moment => ({
    hour: (m.hour + (r() - 0.5) + 24) % 24,
    rate: Math.min(10, Math.max(0, m.rate + (r() - 0.5))),
    idle: Math.max(0, m.idle + (r() - 0.5) * 6),
  })
  const overlap = (a: number[], b: number[]) => a.filter(x => b.includes(x)).length / a.length
  const rows = []
  for (const [name, f] of variants)
    for (const size of [250, 1000])
      for (const perCell of [2, 4]) {
        const gaps: number[] = []
        const sims: number[] = []
        const diffs: number[] = []
        const distinct: number[] = []
        for (let s = 0; s < 5; s++) {
          const c = coder(f(at(sample, 0)).length, size, size / 20, perCell, seeded(100 + s))
          const r = seeded(200 + s)
          const sim: number[] = []
          const diff: number[] = []
          const codes = new Set<string>()
          for (let i = 0; i < 200; i++) {
            const m = at(sample, i)
            const code = encode(c, f(m))
            codes.add(code.join())
            sim.push(overlap(code, encode(c, f(near(m, r)))))
            diff.push(overlap(code, encode(c, f(at(sample, 1000 + i)))))
          }
          sims.push(avg(sim))
          diffs.push(avg(diff))
          gaps.push(avg(sim) - avg(diff))
          distinct.push(codes.size / 200)
        }
        const sd = Math.sqrt(avg(gaps.map(g => (g - avg(gaps)) ** 2)))
        rows.push({
          input: name,
          cells: size,
          'inputs/cell': perCell,
          'overlap similar': fix(avg(sims)),
          'overlap different': fix(avg(diffs)),
          gap: fix(avg(gaps)),
          'gap sd (5 seeds)': fix(sd, 3),
          'distinct codes': `${Math.round(avg(distinct) * 100)}%`,
        })
      }
  console.log('\nS3 — code overlap for similar moments (±30 min, ±0.5 calls/min, ±3 min idle) vs unrelated ones; 5% of cells active')
  table(rows)
}

// --- S4: does novelty single out the unusual moment, and recover?

const s4 = () => {
  const c = coder(20, 1000, 50, 3, seeded(7))
  const halfLife = 2 * DAY
  const rare = (r: Random): Moment => ({ hour: 2 + r() * 3, rate: 8 + r() * 2, idle: r() * 2 })
  const routine: number[] = []
  const unusual: number[] = []
  for (let seed = 0; seed < 10; seed++) {
    const r = seeded(seed)
    const familiar: Familiar = {}
    for (let i = 0; i < 300; i++) {
      const now = (i / 10) * DAY
      const odd = i % 50 === 25
      const code = encode(c, inputsOf(odd ? rare(r) : moment(r)))
      if (i >= 100) (odd ? unusual : routine).push(novelty(familiar, code, now, halfLife))
      see(familiar, code, now, halfLife)
    }
  }
  // AUC: chance an unusual moment scores above a routine one.
  let wins = 0
  for (const u of unusual) for (const n of routine) wins += u > n ? 1 : u === n ? 0.5 : 0
  console.log('\nS4 — novelty over 30 days, 10 moments/day, one unusual moment (2–5 am, busy, never idle) every 5 days; familiarity half-life 2 days')
  table([
    { moments: 'routine', count: routine.length, 'mean novelty': fix(avg(routine)), median: fix(median(routine)) },
    { moments: 'unusual', count: unusual.length, 'mean novelty': fix(avg(unusual)), median: fix(median(unusual)) },
  ])
  console.log(`AUC unusual > routine: ${fix(wins / (unusual.length * routine.length), 3)}`)
  const familiar: Familiar = {}
  const code = encode(c, inputsOf({ hour: 3, rate: 9, idle: 1 }))
  see(familiar, code, 0, halfLife)
  table(
    [0, HOUR, DAY, 2 * DAY, 4 * DAY, 7 * DAY].map(t => ({
      'after seeing it once': t === 0 ? 'right away' : t < DAY ? '1 hour' : `${t / DAY} days`,
      novelty: fix(novelty(familiar, code, t, halfLife)),
    })),
  )
}

// --- S5 (timing and size; the invariants live in tests/learn.test.ts)

const s5 = () => {
  const time = (label: string, n: number, f: (i: number) => void) => {
    const start = performance.now()
    for (let i = 0; i < n; i++) f(i)
    return { learner: label, 'µs per update+predict': fix(((performance.now() - start) * 1000) / n, 1) }
  }
  const random = seeded(1)
  let bandit: Bandit = {}
  let weights: Weights = {}
  const c = coder(20, 1000, 50, 3, seeded(7))
  const memory: Memory = {}
  const ms = Array.from({ length: 1000 }, () => moment(random))
  const rows = [
    time('TS, 16 situations × 4', 20000, i => {
      const m = at(ms, i % 1000)
      const key = choose(bandit, ACTIONS.map(a => `${situation(m)}:${a}`), i * HOUR, 14 * DAY, random)
      bandit = reward(bandit, key, random() < 0.5 ? 1 : 0, i * HOUR, 14 * DAY)
    }),
    time('LogReg, 4 actions × 5 features', 20000, i => {
      const m = at(ms, i % 1000)
      for (const a of ACTIONS) predict(weights, featuresOf(m, a))
      weights = learn(weights, featuresOf(m, 'nap'), random() < 0.5 ? 1 : 0)
    }),
    time('Recall, 1000 cells', 2000, i => {
      const code = encode(c, inputsOf(at(ms, i % 1000)))
      remember(memory, pick(memory, ACTIONS, code, random), code, random() < 0.5 ? 1 : 0)
    }),
  ]
  console.log('\nS5 — cost per event, and stored size after the run')
  table(rows)
  const bytes = (x: unknown) => `${(JSON.stringify(x).length / 1024).toFixed(1)} KB`
  table([
    { state: 'TS, 64 keys', JSON: bytes(bandit) },
    { state: 'LogReg weights', JSON: bytes(weights) },
    { state: 'Recall memory (sparse)', JSON: bytes(memory) },
  ])
}

// --- S6: credit for a pet that arrives up to a minute late

const s6 = () => {
  const petRate: Record<string, number> = { juggle: 0.6, roast: 0.3, nap: 0.2, grumpy: 0.05 }
  const strategies: [string, (shown: Shown[], now: number) => Record<string, number>][] = [
    ['last within 10 s', (shown, now) => lastWithin(shown, now, 10_000)],
    ['last within 60 s', (shown, now) => lastWithin(shown, now, 60_000)],
    ['even over 60 s', (shown, now) => credit(shown, now, Infinity, 60_000)],
    ['trace, half-life 15 s', (shown, now) => credit(shown, now, 15_000, 60_000)],
    ['trace, half-life 30 s', (shown, now) => credit(shown, now, 30_000, 60_000)],
  ]
  const rows = []
  for (const gap of [30, 90, 240])
    for (const [name, assign] of strategies) {
      const right: number[] = []
      const wrong: number[] = []
      let ranked = 0
      for (let seed = 0; seed < 20; seed++) {
        const r = seeded(seed)
        const shown: Shown[] = []
        const pets: { at: number; cause?: string }[] = []
        // A day of work: the pet does something every `gap` seconds on average.
        for (let t = 0; t < 24 * HOUR; t += -Math.log(1 - r()) * gap * 1000) {
          const action = at(ACTIONS, Math.floor(r() * 4))
          shown.push({ action, at: t })
          if (r() < (petRate[action] ?? 0)) pets.push({ at: t + r() * 60_000, cause: action })
        }
        // Pets for no reason, about one in ten minutes.
        for (let t = 0; t < 24 * HOUR; t += -Math.log(1 - r()) * 600_000) pets.push({ at: t })
        const credited: Record<string, number> = {}
        for (const pet of pets) {
          const shares = assign(shown, pet.at)
          for (const [action, share] of Object.entries(shares)) credited[action] = (credited[action] ?? 0) + share
          if (pet.cause === undefined) wrong.push(Object.values(shares).reduce((a, b) => a + b, 0))
          else right.push(shares[pet.cause] ?? 0)
        }
        const times: Record<string, number> = {}
        for (const { action } of shown) times[action] = (times[action] ?? 0) + 1
        const order = ACTIONS.map(a => [a, (credited[a] ?? 0) / (times[a] ?? 1)] as const).sort((a, b) => b[1] - a[1])
        if (order.map(([a]) => a).join() === 'juggle,roast,nap,grumpy') ranked++
      }
      rows.push({
        'pet does something every': `${gap} s`,
        strategy: name,
        'share to the true cause': fix(avg(right)),
        'credit from stray pets': fix(avg(wrong)),
        'ranking right (20 runs)': `${ranked}/20`,
      })
    }
  console.log('\nS6 — pets land 0–60 s after what earned them, plus a stray pet every ~10 min; pet rates 0.6/0.3/0.2/0.05')
  table(rows)
}

const lastWithin = (shown: Shown[], now: number, window: number): Record<string, number> => {
  let last: Shown | undefined
  for (const s of shown) if (s.at <= now && now - s.at <= window) last = s
  return last === undefined ? {} : { [last.action]: 1 }
}

// --- S7: does the lively pick learn the person's taste and still surprise?

const s7 = () => {
  const petRate: Record<string, number> = { juggle: 0.7, roast: 0.4, nap: 0.3, grumpy: 0.1 }
  const perDay = 10
  const days = 60
  // Shannon entropy of a list's spread, in bits: 2 is all four alike, 0 one only.
  const entropy = (picks: string[]) => {
    const counts = ACTIONS.map(a => picks.filter(p => p === a).length / picks.length).filter(p => p > 0)
    return -counts.reduce((sum, p) => sum + p * Math.log2(p), 0)
  }
  const policies: [string, (bandit: Bandit, lately: string[], now: number, random: Random) => string][] = [
    ['random (as by hand)', (_b, _l, _n, random) => at(ACTIONS, Math.floor(random() * 4))],
    ['TS, most pets', (bandit, _l, now, random) => choose(bandit, ACTIONS.map(a => `afternoon:cat:${a}`), now, 7 * DAY, random).split(':')[2] ?? ''],
    ['lively pick', (bandit, lately, now, random) =>
      pickFor({ bandit, seed: 1, pet: 'cat', daypart: 'afternoon', activities: ACTIONS, lately }, now, random).activity],
  ]
  const rows = policies.map(([name, pick]) => {
    const pets: number[] = []
    const spread: number[] = []
    const repeats: number[] = []
    const streaks: number[] = []
    for (let seed = 0; seed < 30; seed++) {
      const random = seeded(seed)
      let bandit: Bandit = {}
      let lately: string[] = []
      const picks: string[] = []
      for (let i = 0; i < perDay * days; i++) {
        const now = (i / perDay) * DAY
        const action = pick(bandit, lately, now, random)
        const p = petRate[action] ?? 0
        if (i >= perDay * 30) pets.push(p)
        picks.push(action)
        lately = [action, ...lately].slice(0, 5)
        bandit = reward(bandit, `afternoon:cat:${action}`, random() < p ? 1 : 0, now, 7 * DAY)
      }
      const late = picks.slice(perDay * 30)
      for (let week = 0; week < late.length; week += 7 * perDay) spread.push(entropy(late.slice(week, week + 7 * perDay)))
      repeats.push(late.filter((one, i) => i > 0 && one === late[i - 1]).length / (late.length - 1))
      let longest = 1
      let run = 1
      for (let i = 1; i < late.length; i++) {
        run = late[i] === late[i - 1] ? run + 1 : 1
        longest = Math.max(longest, run)
      }
      streaks.push(longest)
    }
    return {
      policy: name,
      'pets/event, days 30-60': fix(avg(pets), 3),
      'variety a week (bits, max 2)': fix(avg(spread)),
      'same as the one before': `${Math.round(avg(repeats) * 100)}%`,
      'longest run (median)': fix(median(streaks), 0),
    }
  })
  console.log('\nS7 — pet rates 0.7/0.4/0.3/0.1, 10 activities a day for 60 days, the last 30 measured; 30 runs')
  table(rows)
}

const experiments: Record<string, () => void> = { S1: s1, S2: s2, S3: s3, S4: s4, S5: s5, S6: s6, S7: s7 }
const picked = process.argv.slice(2)
for (const [name, run] of Object.entries(experiments)) if (picked.length === 0 || picked.includes(name)) run()
