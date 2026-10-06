import { describe, expect, test } from 'claude-code/testing'

import { LOCALES, pickLocale, say } from '../hooks/i18n'

const en = LOCALES[0]

describe('locales', () => {
  for (const locale of LOCALES) {
    test(`${locale.code} gives every string, keeping {detail} where English has it`, () => {
      for (const [key, english] of Object.entries(en?.strings ?? {})) {
        const text = locale.strings[key as keyof typeof locale.strings]
        expect(typeof text).toBe('string')
        expect(text.includes('{detail}')).toBe(english.includes('{detail}'))
      }
    })
  }
})

describe('pickLocale', () => {
  test('an explicit choice wins', () => {
    expect(pickLocale('pt-BR', 'english', 'en_US.UTF-8').code).toBe('pt-BR')
  })

  test("auto follows Claude Code's language setting, spelled freely", () => {
    expect(pickLocale('auto', 'Português', undefined).code).toBe('pt-BR')
    expect(pickLocale('auto', 'portuguese', undefined).code).toBe('pt-BR')
  })

  test('auto falls back to $LANG', () => {
    expect(pickLocale('auto', undefined, 'pt_BR.UTF-8').code).toBe('pt-BR')
  })

  test('anything unknown ends in English', () => {
    expect(pickLocale('auto', 'klingon', 'C').code).toBe('en')
  })
})

test('say fills in the detail', () => {
  const pt = pickLocale('pt-BR', undefined, undefined)
  expect(say(pt, 'running', 'npm test')).toBe('rodando npm test')
})
