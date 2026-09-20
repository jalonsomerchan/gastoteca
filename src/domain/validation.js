export function isPositiveAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 && amount <= 99999999
}

export function splitValidation(values, target, percent = false) {
  if (values.some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    return 'Cada parte debe ser un número igual o mayor que cero.'
  }
  const total = values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0)
  if (total !== Math.round(Number(target) * 100)) {
    return percent ? 'Los porcentajes deben sumar exactamente 100 %.' : 'Las cantidades del reparto deben sumar el importe total.'
  }
  return ''
}
