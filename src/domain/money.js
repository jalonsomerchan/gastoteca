// Money enters the calculation layer as integer cents. Never round user input:
// a fraction of a cent must be corrected by the user before it can be saved.
export function toCents(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return NaN
  const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return NaN
  const units = Number(match[2]) * 100 + Number((match[3] || '').padEnd(2, '0'))
  return Number.isSafeInteger(units) ? (match[1] ? -units : units) : NaN
}

export function sumMoney(values) {
  let total = 0
  for (const value of values) {
    total += toCents(value)
    if (!Number.isSafeInteger(total)) return NaN
  }
  return total / 100
}

// Largest remainders conserve the total, keep every share nonnegative and
// never give rounding residue to a participant with zero weight.
export function allocateUnits(total, weights) {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some(weight => !Number.isSafeInteger(weight) || weight < 0)) {
    throw new RangeError('El reparto necesita cantidades enteras no negativas.')
  }
  if (!weights.length) return []
  const denominator = weights.reduce((sum, weight) => sum + BigInt(weight), 0n)
  if (denominator === 0n) {
    if (total !== 0) throw new RangeError('El reparto necesita al menos una parte mayor que cero.')
    return weights.map(() => 0)
  }
  const rows = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight)
    return { index, units: Number(numerator / denominator), remainder: numerator % denominator }
  })
  const remaining = total - rows.reduce((sum, row) => sum + row.units, 0)
  rows.slice().sort((a, b) => a.remainder === b.remainder ? b.index - a.index : a.remainder > b.remainder ? -1 : 1)
    .slice(0, remaining).forEach(row => row.units++)
  return rows.map(row => row.units)
}

export function equalUnits(total, count, index) {
  if (count <= 0) return total
  return Math.floor(total / count) + (index >= count - total % count ? 1 : 0)
}
