import { toCents } from './money.js'
import { normalizeName } from '../utils/formatters.js'

const headerAliases = {
  date: ['fecha contable', 'fecha'],
  valueDate: ['fecha valor'],
  description: ['descripción', 'descripcion', 'concepto'],
  amount: ['importe', 'cantidad'],
  balance: ['saldo'],
  currency: ['divisa', 'moneda'],
}

function stableText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-ES')
}

function stableMovementKey(values) {
  const source = values.map((value) => stableText(value)).join('|')
  let hash = 2166136261
  for (const character of source) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `bankinter:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-ES')
}

function columnIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)))
}

function parseAmount(value) {
  if (typeof value === 'number') return Number.isSafeInteger(toCents(value)) ? toCents(value) / 100 : null
  const raw = String(value ?? '').trim().replace(/\s/g, '')
  if (!raw) return null
  let normalized = raw
  if (raw.includes(',')) {
    if (raw.includes('.') && raw.lastIndexOf('.') > raw.lastIndexOf(',')) {
      if (!/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw)) return null
      normalized = raw.replace(/,/g, '')
    } else {
      if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw)) return null
      normalized = raw.replace(/\./g, '').replace(',', '.')
    }
  }
  const cents = toCents(normalized)
  return Number.isSafeInteger(cents) ? cents / 100 : null
}

function parseDate(value) {
  const raw = String(value ?? '').trim()
  if (/^\d{5,7}$/.test(raw)) {
    const serial = Number(raw)
    if (serial < 61 || serial > 2958465) return ''
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10) + 'T12:00'
  }
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2})?)?$/)
  if (!match && !iso) return ''
  const [, day, month, year] = match || [null, iso[3], iso[2], iso[1]]
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return ''
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00`
}

export function isBankinterMovementImported(expenses, movement) {
  return expenses.some(expense => {
    const details = String(expense.details || '')
    const key = details.match(/bankinter:[0-9a-f]{8}\b/i)?.[0]
    if (key && key !== movement.import_key) return false
    if (key) return true
    const matchesAmountAndDate = expense.transaction_type === movement.transaction_type &&
      toCents(expense.amount) === toCents(movement.amount) &&
      String(expense.occurred_at || '').slice(0, 10) === movement.occurred_at.slice(0, 10)
    return normalizeName(details).startsWith('importado desde bankinter') &&
      normalizeName(expense.name || '') === normalizeName(movement.name) && matchesAmountAndDate
  })
}

export function parseBankinterRows(rows) {
  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader)
    return normalized.includes('fecha contable') && normalized.includes('descripcion') && normalized.includes('importe')
  })
  if (headerRowIndex < 0) throw new Error('No se encontró la tabla de movimientos de Bankinter.')

  const headers = rows[headerRowIndex] || []
  const dateColumn = columnIndex(headers, headerAliases.date)
  const valueDateColumn = columnIndex(headers, headerAliases.valueDate)
  const descriptionColumn = columnIndex(headers, headerAliases.description)
  const amountColumn = columnIndex(headers, headerAliases.amount)
  const balanceColumn = columnIndex(headers, headerAliases.balance)
  const currencyColumn = columnIndex(headers, headerAliases.currency)
  const movements = []

  rows.slice(headerRowIndex + 1).forEach((row, index) => {
    const amount = parseAmount(row[amountColumn])
    const description = String(row[descriptionColumn] ?? '').trim()
    const occurredAt = parseDate(row[dateColumn])
    const valueDate = valueDateColumn >= 0 && String(row[valueDateColumn] ?? '').trim() ? parseDate(row[valueDateColumn]) : occurredAt
    if (!description || !String(row[dateColumn] ?? '').trim()) return
    const currency = String(row[currencyColumn] ?? 'EUR').trim().toUpperCase() || 'EUR'
    if (currency !== 'EUR') throw new Error(`La fila ${headerRowIndex + index + 2} está en ${currency}. Convierte el importe a euros antes de importarla.`)
    if (amount === null || Math.abs(amount) > 99999999 || !occurredAt || !valueDate) throw new Error(`Revisa la fecha y el importe de la fila ${headerRowIndex + index + 2}; los importes deben tener como máximo dos decimales.`)
    if (amount === 0) return
    movements.push({
      id: `bankinter-${headerRowIndex + index + 2}`,
      sourceRow: headerRowIndex + index + 2,
      description,
      name: description,
      amount: Math.abs(amount),
      transaction_type: amount > 0 ? 'income' : 'expense',
      occurred_at: occurredAt,
      value_date: valueDate,
      balance: parseAmount(row[balanceColumn]),
      currency,
      selected: true,
      category: 'other',
      place: '',
      import_key: stableMovementKey([
        occurredAt.slice(0, 10),
        valueDate.slice(0, 10),
        description,
        Math.abs(amount).toFixed(2),
        parseAmount(row[balanceColumn]) === null ? '' : parseAmount(row[balanceColumn]).toFixed(2),
        String(row[currencyColumn] ?? 'EUR').trim() || 'EUR',
      ]),
    })
  })
  if (!movements.length) throw new Error('El fichero no contiene movimientos importables.')
  return movements
}
