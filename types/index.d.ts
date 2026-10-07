export type Mood =
  | 'sleeping'
  | 'deepSleep'
  | 'idle'
  | 'sleepy'
  | 'tired'
  | 'walking'
  | 'watching'
  | 'waking'
  | 'thinking'
  | 'typing'
  | 'running'
  | 'writing'
  | 'reading'
  | 'searching'
  | 'supervising'
  | 'compacting'
  | 'sweating'
  | 'worried'
  | 'grumpy'
  | 'proud'
  | 'happy'
  | 'sad'

export type MiniMood = 'working' | 'happy' | 'sad'

// A sprite frame: rows of palette letters, '.' see-through.
export type Frame = string[]

// A pet pack as read from JSON, before validation.
export type PackFile = {
  name: string
  author?: string
  description?: string
  palette: Record<string, string>
  fps?: number
  main: {
    moods: Partial<Record<Mood, Frame[]>>
    // Extra loops for a mood; one is picked at random each time the mood starts.
    variants?: Partial<Record<Mood, Frame[][]>>
    // Played once on a mood change, keyed "from>to"; either side may be "*".
    transitions?: Record<string, Frame[]>
    // Played once at random while in one of `moods`, every `every` seconds [min, max].
    actions?: Record<string, { frames: Frame[]; moods: Mood[]; every: [number, number] }>
  }
  mini: { tint?: string; moods: Partial<Record<MiniMood, Frame[]>> }
}

// Every string a locale must give (see locales/en.ts).
export type Text =
  | 'sleeping'
  | 'thinking'
  | 'running'
  | 'writing'
  | 'reading'
  | 'searching'
  | 'using'
  | 'waitingForAgents'
  | 'done'
  | 'wentWrong'
  | 'failed'
  | 'commandDescription'
  | 'hidden'
  | 'shown'
  | 'invalidName'
  | 'notFound'
  | 'fallback'
  | 'wakingUp'
  | 'deepSleep'
  | 'thanks'
  | 'denied'
  | 'compacting'
  | 'idle'
  | 'strolling'
  | 'watching'
  | 'sleepy'
  | 'tired'
  | 'worried'
  | 'grumpy'
  | 'proud'
  | 'goodMorning'

// What a pet says, kept as a locale key so a language change redraws it right.
export type Label = { text: Text; detail: string }

// How the session has gone so far: worry from failures, pride from turns that
// went well. Both fade a point every few minutes with nothing new.
export type Feelings = { worry: number; pride: number; at: number }

// What the pet is doing now, set by tools and turns.
export type Activity = { mood: Mood; label: Label }

// A short-lived mood (done, failed, waking up) shown over the activity until `until`.
export type Reaction = { mood: Mood; label: Label; until: number }

// A subagent's pet; `leaving` holds its last reaction before it goes.
export type AgentPet = {
  id: string
  toolUseId: string
  type: string
  label: Label
  color: number
  leaving?: { mood: MiniMood; until: number }
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-pets': {
      activity: Activity
      reaction: Reaction | null
      // Compacting: shown over everything else.
      override: Activity | null
      turnStartedAt: number | null
      lastActiveAt: number | null
      // When the person last edited the prompt.
      typingAt: number | null
      agents: AgentPet[]
      isHidden: boolean
      // How the session has gone; fades with time.
      feelings: Feelings
      // The end of its last long break, or the session's start: long after it, it tires.
      restedAt: number | null
    }
  }
}
