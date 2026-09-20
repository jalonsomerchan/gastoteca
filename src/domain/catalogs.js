export const builtInCategories = [
  { id: 'food', label: 'Alimentación', icon: 'mdi:food-apple-outline', color: '#d36b47' },
  { id: 'home', label: 'Hogar', icon: 'mdi:home-outline', color: '#527a68' },
  { id: 'transport', label: 'Transporte', icon: 'mdi:car-outline', color: '#4b7193' },
  { id: 'leisure', label: 'Ocio', icon: 'mdi:ticket-outline', color: '#8d6597' },
  { id: 'health', label: 'Salud', icon: 'mdi:medical-bag', color: '#c25d69' },
  { id: 'shopping', label: 'Compras', icon: 'mdi:shopping-outline', color: '#bd7d3b' },
  { id: 'bills', label: 'Facturas', icon: 'mdi:lightning-bolt-outline', color: '#86743e' },
  { id: 'travel', label: 'Viajes', icon: 'mdi:airplane', color: '#3f8890' },
  { id: 'other', label: 'Otros', icon: 'mdi:shape-outline', color: '#757a78' },
]

export const notificationOptions = [
  { value: 'expense_created', label: 'Nuevos gastos e ingresos', description: 'Cuando alguien añade un movimiento al grupo.' },
  { value: 'expense_updated', label: 'Movimientos editados', description: 'Cuando se modifica un gasto o ingreso.' },
  { value: 'expense_deleted', label: 'Movimientos eliminados', description: 'Cuando alguien elimina un movimiento.' },
  { value: 'settlement', label: 'Pagos entre miembros', description: 'Cuando se registra un pago para saldar una deuda.' },
  { value: 'member_joined', label: 'Nuevos miembros', description: 'Cuando una persona se une a tu grupo.' },
]

export const paymentMethods = [
  { value: 'card', label: 'Tarjeta' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia bancaria' },
  { value: 'bizum', label: 'Bizum' },
  { value: 'other', label: 'Otro' },
]

export const paymentMethodLabel = (value) => paymentMethods.find((method) => method.value === value)?.label || 'Sin especificar'

export const customCategoryColor = (label) => {
  const palette = ['#5f7296', '#987052', '#6f7e4c', '#8b6387', '#477e78', '#9b625a']
  const hash = [...label].reduce((total, character) => total + character.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

export const defaultSuggestions = {
  expense: [
    { name: 'Desayuno', category: 'food', place: '' },
    { name: 'Compra', category: 'shopping', place: '' },
    { name: 'Comida', category: 'food', place: '' },
    { name: 'Gasolina', category: 'transport', place: '' },
    { name: 'Cena', category: 'food', place: '' },
    { name: 'Supermercado', category: 'food', place: '' },
  ],
  income: [
    { name: 'Nómina', category: 'other', place: '' },
    { name: 'Bizum recibido', category: 'other', place: '' },
    { name: 'Reembolso', category: 'other', place: '' },
    { name: 'Venta', category: 'shopping', place: '' },
  ],
}

export const historyFieldLabels = {
  transaction_type: 'Tipo',
  name: 'Nombre',
  details: 'Detalles',
  category: 'Categoría',
  place: 'Establecimiento',
  city: 'Ciudad',
  occurred_at: 'Fecha del movimiento',
  amount: 'Importe',
  payment_method: 'Método de pago',
  paid_by_type: 'Quién pagó/recibió',
  paid_by_uid: 'Pagador o receptor',
  applies_to_all: 'Se aplica a todo el grupo',
  participant_uids: 'Participantes',
  participants: 'Reparto',
  tags: 'Etiquetas',
  is_quick: 'Gasto rápido',
}
