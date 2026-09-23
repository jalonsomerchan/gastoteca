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
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value ?? '').trim().replace(/\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') && raw.includes('.')
    ? (raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, ''))
    : raw.replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

function parseDate(value) {
  const raw = String(value ?? '').trim()
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T12:00`
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
    const valueDate = valueDateColumn >= 0 ? parseDate(row[valueDateColumn]) : occurredAt
    if (!description || amount === null || amount === 0 || !occurredAt) return
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
      currency: String(row[currencyColumn] ?? 'EUR').trim() || 'EUR',
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
