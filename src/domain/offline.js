import { equalShareCents } from './validation.js'

export const offlineActions = new Set([
  'save_expense', 'delete_expense', 'confirm_expense', 'save_settlement',
  'save_debt', 'delete_debt', 'save_budget', 'delete_budget', 'save_recurring',
  'toggle_recurring', 'delete_recurring', 'save_tag', 'delete_tag',
  'save_catalog_item', 'save_catalog_icons', 'update_group_settings',
  'save_quick_expense_templates', 'save_telegram_settings', 'save_notification_settings',
  'save_backup_settings', 'save_summary_settings', 'mark_notification_read', 'mark_all_notifications_read',
])

const clone = value => structuredClone(value)
const cents = value => Math.round(Number(value) * 100)
const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(new Date())
const dateTime = value => String(value || new Date().toISOString()).replace('T', ' ').slice(0, 19)
const replaceItem = (items, id, value) => [value, ...items.filter(item => item.id !== id)]

export function resolveReferences(value, mappings) {
  if (Array.isArray(value)) return value.map(item => resolveReferences(item, mappings))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [mappings[key] ?? key, resolveReferences(item, mappings)]))
  return Object.hasOwn(mappings, value) ? mappings[value] : value
}

export function movementFromDraft(body, group, uid, id, previous = {}) {
  const uids = body.applies_to_all ? group.members.map(member => member.uid) : [...new Set(body.participant_uids || [])]
  const total = cents(body.amount)
  let used = 0
  const participants = uids.map((memberUid, index) => {
    let share = body.share_mode === 'amount' ? cents(body.participant_shares?.[memberUid] || 0)
      : body.share_mode === 'percent' ? Math.round(total * Number(body.participant_shares?.[memberUid] || 0) / 100)
        : equalShareCents(body.amount, uids.length, index)
    if (body.share_mode === 'percent' && index === uids.length - 1) share = total - used
    used += share
    return { uid: memberUid, share_amount: share / 100 }
  })
  return {
    ...previous, ...body, id, amount: total / 100, occurred_at: dateTime(body.occurred_at),
    paid_by_uid: body.paid_by_type === 'all' ? null : body.paid_by_uid,
    participant_uids: uids, participants, tags: body.tags || [],
    created_by: previous.created_by || uid, confirmation_pending: previous.confirmation_pending || false,
    updated_at: dateTime(), offline_pending: true,
  }
}

export function localStatistics(expenses) {
  const items = expenses.filter(item => item.transaction_type === 'expense' && !item.confirmation_pending)
  const sum = values => values.reduce((total, item) => total + cents(item.amount), 0) / 100
  function breakdown(field, getKey, values = items) {
    const groups = new Map()
    values.forEach(item => {
      const key = getKey(item)
      const row = groups.get(key) || { [field]: key, total: 0, count: 0 }
      row.total += cents(item.amount)
      row.count++
      groups.set(key, row)
    })
    return [...groups.values()].map(row => ({ ...row, total: row.total / 100 })).sort((a, b) => b.total - a.total || String(a[field]).localeCompare(String(b[field])))
  }
  const month = currentMonth()
  const start = new Date(`${month}-01T12:00:00Z`)
  start.setUTCMonth(start.getUTCMonth() - 11)
  const total = sum(items)
  return {
    total, count: items.length, average: items.length ? total / items.length : 0,
    current_month_total: sum(items.filter(item => item.occurred_at.slice(0, 7) === month)),
    by_category: breakdown('category', item => item.category),
    by_member: breakdown('uid', item => item.paid_by_type === 'all' ? '' : item.paid_by_uid),
    by_participant: breakdown('uid', item => item.uid, items.flatMap(item => (item.participants || []).map(participant => ({ uid: participant.uid, amount: participant.share_amount })))),
    by_title: breakdown('title', item => item.name),
    by_establishment: breakdown('establishment', item => item.place || 'Sin establecimiento'),
    by_payment_method: breakdown('payment_method', item => item.payment_method),
    monthly: breakdown('month', item => item.occurred_at.slice(0, 7), items.filter(item => item.occurred_at.slice(0, 10) >= start.toISOString().slice(0, 10))).sort((a, b) => a.month.localeCompare(b.month)),
  }
}

export function projectOffline(document, uid) {
  const snapshot = clone(document.snapshot || {})
  const group = snapshot.group
  if (!group) return snapshot
  snapshot.expenses ||= []
  snapshot.settlements ||= []
  for (const operation of document.queue || []) {
    const body = resolveReferences(operation.body, document.mappings || {})
    const id = body.id || operation.localId
    const action = operation.action
    if (action === 'save_expense') {
      const previous = snapshot.expenses.find(item => item.id === id)
      snapshot.expenses = replaceItem(snapshot.expenses, id, movementFromDraft(body, group, uid, id, previous))
      for (const tag of body.tags || []) if (!(group.tags || []).some(item => item.name === tag)) (group.tags ||= []).push({ id: `tag-${operation.id}-${tag}`, name: tag, usage_count: 0 })
      if (body.place && !(group.establishments || []).some(item => item.name === body.place)) (group.establishments ||= []).push({ name: body.place, icon: 'mdi:store-outline' })
    } else if (action === 'delete_expense') snapshot.expenses = snapshot.expenses.filter(item => item.id !== id)
    else if (action === 'confirm_expense') {
      const item = snapshot.expenses.find(item => item.id === id)
      if (item) Object.assign(item, { confirmation_pending: false, offline_pending: true })
    } else if (action === 'save_settlement') snapshot.settlements.unshift({ ...body, id, amount: Number(body.amount), paid_at: operation.createdAt, created_by: uid, offline_pending: true })
    else if (action === 'save_debt') {
      const previous = (group.debts || []).find(item => item.id === id)
      const name = (memberUid, side) => group.members.find(member => member.uid === memberUid)?.name || previous?.[`${side}_name`] || memberUid
      group.debts = replaceItem(group.debts || [], id, { ...previous, ...body, id, source_name: name(body.source_uid, 'source'), target_name: name(body.target_uid, 'target'), offline_pending: true })
    } else if (action === 'delete_debt') group.debts = (group.debts || []).filter(item => item.id !== id)
    else if (action === 'save_budget') group.budgets = [{ ...body, monthly_limit: Number(body.monthly_limit), label: group.category_labels?.[body.category] || body.category, current_total: 0 }, ...(group.budgets || []).filter(item => item.category !== body.category)]
    else if (action === 'delete_budget') group.budgets = (group.budgets || []).filter(item => item.category !== body.category)
    else if (action === 'save_recurring') {
      const previous = (group.recurring || []).find(item => item.id === id)
      group.recurring = replaceItem(group.recurring || [], id, { ...previous, ...body, id, active: previous?.active ?? true, payload: body, next_at: dateTime(body.next_at), offline_pending: true })
    } else if (action === 'toggle_recurring') {
      const item = (group.recurring || []).find(item => item.id === id)
      if (item) item.active = body.active
    } else if (action === 'delete_recurring') group.recurring = (group.recurring || []).filter(item => item.id !== id)
    else if (action === 'save_tag' || action === 'delete_tag') {
      const previous = (group.tags || []).find(item => item.id === id)
      group.tags = action === 'delete_tag' ? (group.tags || []).filter(item => item.id !== id)
        : replaceItem(group.tags || [], id, { ...previous, ...body, id, usage_count: previous?.usage_count || 0 })
      if (previous) {
        const rename = tags => (tags || []).flatMap(tag => tag === previous.name ? action === 'delete_tag' ? [] : [body.name] : [tag])
        snapshot.expenses.forEach(item => { item.tags = rename(item.tags) })
        ;(group.recurring || []).forEach(item => { item.payload.tags = rename(item.payload.tags) })
      }
    } else if (action === 'save_catalog_item') {
      if (body.type === 'establishment') {
        group.establishments = [{ name: body.name, icon: body.icon }, ...(group.establishments || []).filter(item => item.name !== body.id)]
        if (body.id) {
          snapshot.expenses.forEach(item => { if (item.place === body.id) item.place = body.name })
          ;(group.recurring || []).forEach(item => { if (item.payload.place === body.id) item.payload.place = body.name })
        }
      } else {
        const key = body.id || operation.localId
        const previous = group.category_labels?.[key]
        ;(group.category_labels ||= {})[key] = body.name
        ;(group.category_icons ||= {})[key] = body.icon
        if (previous) delete (group.category_keys ||= {})[previous]
        ;(group.category_keys ||= {})[body.name] = key
        group.custom_categories = [...new Set([...(group.custom_categories || []).filter(name => name !== previous), body.name])]
      }
    } else if (action === 'save_catalog_icons') {
      (body.categories || []).forEach(item => { (group.category_icons ||= {})[item.key] = item.icon })
      ;(body.establishments || []).forEach(item => { const place = (group.establishments || []).find(place => place.name === item.name); if (place) place.icon = item.icon })
    } else if (action === 'update_group_settings') Object.assign(group, body)
    else if (action === 'save_quick_expense_templates') snapshot.templates = [...body.templates.map(template => ({ ...template, created_by: uid, can_edit: true })), ...(snapshot.templates || []).filter(template => template.created_by !== uid && template.can_edit === false)]
    else if (action === 'save_telegram_settings' || action === 'save_notification_settings') snapshot[action === 'save_telegram_settings' ? 'telegram_settings' : 'notification_settings'] = { ...snapshot[action === 'save_telegram_settings' ? 'telegram_settings' : 'notification_settings'], ...body }
    else if (action === 'save_backup_settings') snapshot.backup_settings = { ...snapshot.backup_settings, ...body, next_run_at: null }
    else if (action === 'save_summary_settings') snapshot.summary_settings = { ...snapshot.summary_settings, schedules: Object.fromEntries(Object.entries(body.schedules).map(([period, settings]) => [period, { ...snapshot.summary_settings?.schedules?.[period], ...settings, next_run_at: null }])) }
    else if (action === 'mark_notification_read' || action === 'mark_all_notifications_read') {
      (snapshot.notifications || []).forEach(item => { if (action === 'mark_all_notifications_read' || item.id === id) item.read_at = operation.createdAt })
      snapshot.unread_count = (snapshot.notifications || []).filter(item => !item.read_at).length
    }
  }
  if (document.queue?.some(operation => /expense|settlement/.test(operation.action) && operation.action !== 'save_quick_expense_templates')) {
    snapshot.stats = localStatistics(snapshot.expenses)
    ;(group.budgets || []).forEach(item => { item.current_total = snapshot.expenses.filter(expense => !expense.confirmation_pending && expense.transaction_type === 'expense' && expense.category === item.category && expense.occurred_at.slice(0, 7) === currentMonth()).reduce((total, expense) => total + cents(expense.amount), 0) / 100 })
  }
  return snapshot
}
