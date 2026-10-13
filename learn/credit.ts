// A reward lands seconds after what earned it. Share it among what the pet did
// lately, more to the nearer ones, instead of betting on the last.
export type Shown = { action: string; at: number }

export const credit = (shown: Shown[], now: number, halfLife: number, horizon: number) => {
  const shares: Record<string, number> = {}
  let total = 0
  for (const { action, at } of shown) {
    const ago = now - at
    if (ago < 0 || ago > horizon) continue
    const weight = 0.5 ** (ago / halfLife)
    shares[action] = (shares[action] ?? 0) + weight
    total += weight
  }
  return Object.fromEntries(Object.entries(shares).map(([action, weight]) => [action, weight / total]))
}
