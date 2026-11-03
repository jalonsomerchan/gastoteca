import { equalUnits, toCents } from './money.js'

export function equalShareCents(amount, count, index) {
  return equalUnits(toCents(amount) || 0, count, index)
}

export function isPositiveAmount(value) {
  const cents = toCents(value)
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 9999999900
}

export function splitValidation(values, target, percent = false) {
  if (values.some(value => !Number.isSafeInteger(toCents(value)) || toCents(value) < 0)) {
    return 'Cada parte debe ser un número igual o mayor que cero, con un máximo de dos decimales.'
  }
  const total = values.reduce((sum, value) => sum + toCents(value), 0)
  if (total !== toCents(target)) {
    return percent ? 'Los porcentajes deben sumar exactamente 100 %.' : 'Las cantidades del reparto deben sumar el importe total.'
  }
  return ''
}
