// Online logistic regression over named features. A constant rate weighs recent
// events more, so it keeps adapting instead of freezing like AdaGrad does.
export type Features = Record<string, number>
export type Weights = Record<string, number>

export const predict = (weights: Weights, x: Features) => {
  let z = weights.bias ?? 0
  for (const [key, value] of Object.entries(x)) z += (weights[key] ?? 0) * value
  return 1 / (1 + Math.exp(-z))
}

export const learn = (weights: Weights, x: Features, y: number, rate = 0.05): Weights => {
  const error = y - predict(weights, x)
  const next: Weights = { ...weights, bias: (weights.bias ?? 0) + rate * error }
  for (const [key, value] of Object.entries(x)) next[key] = (weights[key] ?? 0) + rate * error * value
  return next
}
