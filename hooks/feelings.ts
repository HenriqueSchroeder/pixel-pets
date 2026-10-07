import type { Feelings, Mood } from '../types'

export type Feeling = 'toolFailed' | 'turnFailed' | 'turnOk'

const FADE_MS = 5 * 60_000
const WORRIED = 3
const GRUMPY = 6
const PROUD = 3
// Hours of work since its last long break that make it tired.
const TIRED_MS = 3 * 60 * 60_000

export const calm: Feelings = { worry: 0, pride: 0, at: 0 }

// The feelings as they stand at `now`, the points faded since `at` taken off.
export const settle = (feelings: Feelings, now: number): Feelings => {
  const faded = Math.max(0, Math.floor((now - feelings.at) / FADE_MS))
  if (faded === 0) return feelings
  return {
    worry: Math.max(0, feelings.worry - faded),
    pride: Math.max(0, feelings.pride - faded),
    at: feelings.at + faded * FADE_MS,
  }
}

export const feel = (feelings: Feelings, what: Feeling, now: number): Feelings => {
  const { worry, pride } = settle(feelings, now)
  switch (what) {
    case 'toolFailed':
      return { worry: worry + 1, pride, at: now }
    // Pride is for a streak: a turn that fails ends it.
    case 'turnFailed':
      return { worry: worry + 2, pride: 0, at: now }
    case 'turnOk':
      return { worry: Math.max(0, worry - 1), pride: pride + 1, at: now }
  }
}

// A turn of work that went well cheers it only now and then, or it would cheer at every step.
const CHEER_CHANCE = 0.6

type Turn = { tookLong: boolean; tools: number; agentsDone: boolean; agentsLeft: number }

// How a turn that went well ends. It waits for the last agent before cheering;
// a long turn is celebrated, the last agent done is cheered, other work only now
// and then, and a turn that only talked earns nothing.
export const cheer = (turn: Turn, random: () => number): 'celebrating' | 'happy' | null => {
  if (turn.agentsLeft > 0) return null
  if (turn.tookLong) return 'celebrating'
  if (turn.agentsDone) return 'happy'
  if (turn.tools === 0) return null
  return random() < CHEER_CHANCE ? 'happy' : null
}

export const isNight = (hour: number) => hour >= 22 || hour < 6
export const isMorning = (hour: number) => hour >= 5 && hour < 11
// The night `now` falls in, named by its evening's date: 2 a.m. belongs to the night before.
export const nightOf = (now: number) => new Date(now - 6 * 60 * 60_000).toDateString()

// The moods that stand in for plain `idle`; each is also the key of its words.
export type Felt = Extract<Mood, 'grumpy' | 'worried' | 'tired' | 'proud' | 'sleepy'>

// What it shows instead of plain `idle`, if anything: the strongest feeling wins.
export const idleMood = (feelings: Feelings, now: number, restedAt: number | null, hour: number): Felt | undefined => {
  const { worry, pride } = settle(feelings, now)
  if (worry >= GRUMPY) return 'grumpy'
  if (worry >= WORRIED) return 'worried'
  if (restedAt !== null && now - restedAt >= TIRED_MS) return 'tired'
  if (pride >= PROUD && worry === 0) return 'proud'
  if (isNight(hour)) return 'sleepy'
  return undefined
}
