import { describe, expect, test } from 'claude-code/testing'

import { lineFor, maySpeak, quiet, spoke } from '../hooks/speech'

const MINUTE = 60_000

describe('speech', () => {
  test('it speaks once a turn for each situation, and never twice within three minutes', () => {
    const after = spoke(quiet, 'manyReads', 0)
    expect(maySpeak(quiet, 'manyReads', 0)).toBe(true)
    expect(maySpeak(after, 'longThink', 2 * MINUTE)).toBe(false)
    expect(maySpeak(after, 'longThink', 3 * MINUTE)).toBe(true)
    expect(maySpeak(after, 'manyReads', 3 * MINUTE)).toBe(false)
    expect(maySpeak({ ...after, saidThisTurn: [] }, 'manyReads', 3 * MINUTE)).toBe(true)
  })

  test("the pack's own line for the language wins; otherwise the locale's", () => {
    const lines = { en: { longThink: ['mrrp…', 'hmmmrr'] } }
    expect(lineFor(lines, 'en', 'longThink', 'hmm…', () => 0.9)).toBe('hmmmrr')
    expect(lineFor(lines, 'pt-BR', 'longThink', 'hmm…', () => 0)).toBe('hmm…')
    expect(lineFor(lines, 'en', 'manyReads', 'so many files!', () => 0)).toBe('so many files!')
  })
})
