import type { Situation } from '../types'
import type { Random } from './motion'

export const SITUATIONS: readonly Situation[] = ['longThink', 'manyReads', 'manyAgents', 'lateNight', 'bored', 'dreaming']

// What the pet said lately: speech stays rare, at most once a turn for each
// situation and never twice within a few minutes.
export type Speaker = { spokeAt: number | null; saidThisTurn: readonly Situation[] }

export const quiet: Speaker = { spokeAt: null, saidThisTurn: [] }

const COOLDOWN_MS = 3 * 60_000
// Thinking with no tool this long is a long think.
export const LONG_THINK_MS = 30_000
export const MANY_READS = 20
export const MANY_AGENTS = 3

export const maySpeak = (speaker: Speaker, situation: Situation, now: number) =>
  (speaker.spokeAt === null || now - speaker.spokeAt >= COOLDOWN_MS) && !speaker.saidThisTurn.includes(situation)

export const spoke = (speaker: Speaker, situation: Situation, now: number): Speaker => ({
  spokeAt: now,
  saidThisTurn: [...speaker.saidThisTurn, situation],
})

// The pack's own line for this language, picked at random, or the locale's.
export const lineFor = (
  lines: Record<string, Partial<Record<Situation, string[]>>>,
  code: string,
  situation: Situation,
  fallback: string,
  random: Random,
) => {
  const own = lines[code]?.[situation] ?? []
  return own[Math.floor(random() * own.length)] ?? fallback
}
