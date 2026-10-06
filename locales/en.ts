import type { Text } from '../types'

export type Locale = { code: string; names: string[]; strings: Record<Text, string> }

// The reference locale: every other locale must give each of these strings.
// `{detail}` is filled in at run time and must be kept as written.
export const en: Locale = {
  code: 'en',
  // How Claude Code's `language` setting or $LANG may spell this locale.
  names: ['en', 'english'],
  strings: {
    sleeping: 'sleeping',
    thinking: 'thinking',
    running: 'running {detail}',
    writing: 'writing {detail}',
    reading: 'reading {detail}',
    searching: 'searching ({detail})',
    using: 'using {detail}',
    waitingForAgents: 'waiting for agents',
    done: 'done!',
    wentWrong: 'something went wrong',
    failed: 'failed: {detail}',
    wakingUp: 'waking up',
    deepSleep: 'fast asleep',
    waitingForYou: 'waiting for you: {detail}',
    compacting: 'tidying up its memory',
    commandDescription: 'Show or hide the pets above the prompt',
    hidden: 'Pets hidden.',
    shown: 'Pets are back.',
    invalidName: '"{detail}" is not a valid pet name',
    notFound: 'pet "{detail}" not found',
    fallback: 'pixel-pets: {detail}. Using the default pet.',
  },
}
