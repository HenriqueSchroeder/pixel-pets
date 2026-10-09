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
  | 'celebrating'
  | 'sad'

// `startled`: the jump the agents give while an action of the main pet that
// `startles` them plays.
export type MiniMood = 'working' | 'happy' | 'sad' | 'startled'

// When the pet says something of its own, now and then.
export type Situation = 'longThink' | 'manyReads' | 'manyAgents' | 'lateNight' | 'bored' | 'dreaming'

// A sprite frame: rows of palette letters, '.' see-through.
export type Frame = string[]

// How a pet is made, each in [0, 1] with 0.5 the usual: how slowly it tires, how
// soon it gets bored, how much it misses the person.
export type Traits = { energetic: number; curious: number; affectionate: number }

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
    // From its frame `startles` on, the agents' mini pets play `startled` from its first frame.
    actions?: Record<string, { frames: Frame[]; moods: Mood[]; every: [number, number]; startles?: number }>
    // Longer scenes played now and then while in one of `moods`, every `every` seconds:
    // `start` once, `loop` for `seconds` [min, max], `end` once. `label` is what Claude's
    // line says meanwhile, by language code.
    activities?: Record<
      string,
      {
        start?: Frame[]
        loop: Frame[]
        end?: Frame[]
        seconds: [number, number]
        moods: Mood[]
        every: [number, number]
        label?: Record<string, string>
      }
    >
    // A pet that does not walk can teleport instead: `vanish` plays where it was,
    // `appear` where it lands.
    teleport?: { vanish: Frame[]; appear: Frame[] }
  }
  // false: no mini pets, the agents show only as the pet's own `supervising`
  mini: false | { tint?: string; moods: Partial<Record<MiniMood, Frame[]>> }
  // How it is made; a trait left out is the usual 0.5.
  personality?: Partial<Traits>
  // The pet's own lines, by language code ("en", "pt-BR"); a language or situation
  // left out says the locale's line.
  speech?: Record<string, Partial<Record<Situation, string[]>>>
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
  | 'projectPet'
  | 'projectPetDefault'
  | 'projectPetFailed'
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
  | 'phew'
  | 'missedYou'
  | 'aWeekTogether'
  | 'aMonthTogether'
  | 'daysTogether'
  | 'aYearTogether'
  | 'yearsTogether'
  | 'justMet'
  | 'togetherADay'
  | 'togetherDays'
  | Situation

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
