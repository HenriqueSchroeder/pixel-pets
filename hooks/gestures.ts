// What the person does to the pet with the pointer: a click pets it, one over a
// sleeping pet wakes it, too many in a row annoy it, and a pointer resting on it
// a moment gets a look back. Session only.
export type Touch = { clicks: readonly number[]; grumpyUntil: number; hoverSince: number | null }

export const untouched: Touch = { clicks: [], grumpyUntil: 0, hoverSince: null }

// How it takes a click: awake it is petted, dozing it wakes glad, fast asleep it is
// woken rudely; annoyed by many, it ignores the rest for a while.
export type Poke = 'pet' | 'wake' | 'rouse' | 'annoy' | 'ignore'
export type Sleep = 'awake' | 'dozing' | 'deep'

// This many clicks within the window annoy it, for ANNOY_MS.
const ANNOY_CLICKS = 4
const ANNOY_WINDOW_MS = 3000
export const ANNOY_MS = 3000
// How long the pointer rests on it before it looks back.
const GAZE_MS = 500

export const press = (touch: Touch, now: number, sleep: Sleep): { touch: Touch; poke: Poke } => {
  if (now < touch.grumpyUntil) return { touch, poke: 'ignore' }
  const clicks = [...touch.clicks.filter(at => now - at < ANNOY_WINDOW_MS), now]
  if (clicks.length >= ANNOY_CLICKS) return { touch: { ...touch, clicks: [], grumpyUntil: now + ANNOY_MS }, poke: 'annoy' }
  return { touch: { ...touch, clicks }, poke: sleep === 'deep' ? 'rouse' : sleep === 'dozing' ? 'wake' : 'pet' }
}

// The pointer is over it: from the first move, as an `enter` does not always come.
export const hover = (touch: Touch, now: number): Touch => (touch.hoverSince === null ? { ...touch, hoverSince: now } : touch)

export const leave = (touch: Touch): Touch => ({ ...touch, hoverSince: null })

export const gazes = (touch: Touch, now: number) => touch.hoverSince !== null && now - touch.hoverSince >= GAZE_MS
