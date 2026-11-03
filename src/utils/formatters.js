export const normalizeName = (value) => value.trim().toLocaleLowerCase('es-ES')

const currencyFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
export const money = (value) => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? currencyFormat.format(Math.abs(amount) < 0.005 ? 0 : amount) : '—'
}

export const dateLabel = (value) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value.replace(' ', 'T')))

export const notificationDateLabel = (value) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value.replace(' ', 'T')))

export const monthLabel = (value) => new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(`${value}-01T12:00:00`))

export const expenseLocation = (expense) => [expense.place || 'Sin establecimiento', expense.city].filter(Boolean).join(' · ')
