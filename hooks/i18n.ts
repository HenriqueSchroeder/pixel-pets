import type { Text } from '../types'
import { en } from '../locales/en'
import type { Locale } from '../locales/en'
import { ptBR } from '../locales/pt-BR'

export type { Locale, Text }

export const LOCALES: readonly Locale[] = [en, ptBR]

const byName = (wanted: string | undefined) => {
  if (!wanted) return undefined
  // "pt_BR.UTF-8" → "pt-br"
  const name = wanted.trim().toLowerCase().split('.')[0]?.replace('_', '-') ?? ''
  return (
    LOCALES.find(locale => locale.names.includes(name)) ??
    LOCALES.find(locale => locale.names.includes(name.split('-')[0] ?? ''))
  )
}

// `auto` follows Claude Code's own `language` setting, then $LANG, then English.
export const pickLocale = (choice: string, setting: unknown, lang: string | undefined): Locale =>
  (choice !== 'auto' ? byName(choice) : undefined) ??
  byName(typeof setting === 'string' ? setting : undefined) ??
  byName(lang) ??
  en

export const say = (locale: Locale, text: Text, detail = '') => locale.strings[text].replace('{detail}', detail)
