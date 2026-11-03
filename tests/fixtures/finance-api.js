import { localStatistics, movementFromDraft } from '../../src/domain/offline.js'
import { madridDateTime } from '../../src/domain/dates.js'

const group = {
  id: 987654, name: 'Revisión de céntimos · datos ficticios', owner_uid: 'alice', invite_code: 'QAONLY',
  members: ['alice', 'bob', 'charlie', 'diana'].map((uid, index) => ({ uid, name: ['Alicia', 'Roberto', 'Carlos', 'Diana'][index], email: `${uid}@example.test` })),
  default_city: 'Madrid', default_payment_method: 'card', category_labels: {}, category_icons: {}, category_keys: {}, custom_categories: [], establishments: [], tags: [], recurring: [], debts: [], budgets: [],
}
const draft = { transaction_type: 'expense', name: 'Compra', amount: '0.02', category: 'food', occurred_at: madridDateTime(), paid_by_type: 'person', paid_by_uid: 'alice', applies_to_all: true, share_mode: 'equal', payment_method: 'card', tags: [] }
let expenses = [movementFromDraft({ ...draft, name: 'Dos céntimos entre cuatro' }, group, 'alice', 1), movementFromDraft({ ...draft, name: 'Compra de 29 céntimos', amount: '0.29', place: 'Mercado' }, group, 'alice', 2)]
expenses.forEach(item => { delete item.offline_pending })
let nextId = 3
const receipts = new Map()
const snapshot = () => ({ group, expenses, settlements: [], stats: localStatistics(expenses), user_uid: 'alice', offline_sync_version: 1 })

export async function mockRequest(path, token, options = {}) {
  const [action, query = ''] = path.replace(/^.*\//, '').split('?')
  const body = options.body ? JSON.parse(options.body) : {}
  if (action === 'sync_operation') {
    if (receipts.has(body.operation_id)) return structuredClone(receipts.get(body.operation_id))
    if (body.action !== 'save_expense') throw new Error('La revisión solo admite movimientos ficticios.')
    const id = body.body.id || nextId++
    expenses = [movementFromDraft(body.body, group, 'alice', id, expenses.find(item => item.id === id)), ...expenses.filter(item => item.id !== id)]
    expenses.forEach(item => { delete item.offline_pending })
    const result = { data: snapshot(), entity_id: id, replayed: false }
    receipts.set(body.operation_id, structuredClone(result))
    return result
  }
  if (['bootstrap', 'expenses', 'expense_feed', 'group'].includes(action)) return structuredClone(snapshot())
  if (action === 'statistics') {
    const params = new URLSearchParams(query)
    return { stats: localStatistics(expenses, { from: params.get('from'), to: params.get('to') }) }
  }
  if (action === 'notifications') return { notifications: [], unread_count: 0 }
  if (action === 'quick_expense_templates') return { templates: [] }
  if (action === 'expense_history') return { history: [] }
  if (action === 'backup_settings') return { frequency: 'disabled', time: '09:00', weekday: 1, monthday: 1 }
  if (action === 'summary_settings') return { schedules: {} }
  if (action === 'telegram_status') return { telegram: { connected: false } }
  return { notification_types: [], telegram_configured: false }
}
