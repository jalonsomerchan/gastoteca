import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOfflineClient } from '../src/lib/offlineClient.js'
import { movementFromDraft, projectOffline, resolveReferences } from '../src/domain/offline.js'
import { offlineIcons, offlineIconResponse } from '../src/domain/offlineIcons.js'
import { builtInCategories } from '../src/domain/catalogs.js'

const group = { id: 1, owner_uid: 'alice', members: [{ uid: 'alice', name: 'Alicia' }, { uid: 'bob', name: 'Roberto' }], tags: [], budgets: [], recurring: [], debts: [], establishments: [], category_labels: {}, category_icons: {}, category_keys: {}, custom_categories: [] }
const draft = { name: 'Cena', amount: 30.01, transaction_type: 'expense', category: 'food', occurred_at: '2026-10-04 12:00:00', paid_by_type: 'person', paid_by_uid: 'alice', applies_to_all: true, share_mode: 'equal', payment_method: 'card', tags: [] }
const expense = movementFromDraft(draft, group, 'alice', 1)
delete expense.offline_pending
expense.updated_at = '2026-10-04 12:00:00'

function memoryStorage(initial) {
  let value = initial && structuredClone(initial)
  return { read: async () => structuredClone(value), update: async change => { const next = change(structuredClone(value)); value = structuredClone(next); return structuredClone(next) } }
}
function failure(status, message = 'Servidor no disponible', code = '') { return Object.assign(new Error(message), { status, code }) }
function fixture({ online = true, transport, storage } = {}) {
  const state = { online, statuses: [] }
  storage ||= memoryStorage()
  const client = createOfflineClient({ uid: 'alice', storage, isOnline: () => state.online, transport: transport || (async path => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense], settlements: [], stats: { total: 30.01 }, offline_sync_version: 1 }
    throw failure(0)
  }), getToken: async () => 'fresh-token', onChange: status => state.statuses.push(status) })
  return { client, state, storage }
}
async function prepare(fixture) { await fixture.client.request('gastoteca/bootstrap', 'token') }
const post = (client, action, body) => client.request(`gastoteca/${action}`, 'token', { method: 'POST', body: JSON.stringify(body) })

test('cached data survive reopening and every main data route can be read offline', async () => {
  const f = fixture()
  await prepare(f)
  f.client.stop()
  const reopened = fixture({ storage: f.storage, online: false, transport: () => assert.fail('No network while offline') })
  for (const path of ['group', 'expenses', 'expense_feed', 'statistics', 'quick_expense_templates', 'notifications']) {
    assert.ok(await reopened.client.request(`gastoteca/${path}`, 'expired-token'))
  }
  assert.equal((await reopened.client.refresh()).expenses[0].name, 'Cena')
})

test('failed requests and HTTP 503 use the last snapshot but authentication and validation failures do not', async () => {
  for (const status of [0, 503, 408, 429]) {
    let failing = false
    const f = fixture({ transport: async () => { if (failing) throw failure(status); return { group, expenses: [expense], offline_sync_version: 1 } } })
    await prepare(f)
    failing = true
    assert.equal((await f.client.request('gastoteca/group', 'token')).group.id, 1)
    assert.equal(f.state.statuses.at(-1).serverUnavailable, true)
  }
  for (const status of [401, 403, 400]) {
    let failing = false
    const f = fixture({ transport: async () => { if (failing) throw failure(status); return { group, expenses: [expense], offline_sync_version: 1 } } })
    await prepare(f)
    failing = true
    await assert.rejects(f.client.request('gastoteca/group', 'token'), reason => reason.status === status)
  }
})

test('offline changes are durable and update movements, shares and totals immediately', async () => {
  const f = fixture()
  await prepare(f)
  f.state.online = false
  const result = await post(f.client, 'save_expense', { ...draft, name: 'Compra sin conexión' })
  assert.equal(result.offline_pending, true)
  assert.equal(result.expenses.length, 2)
  assert.equal(result.stats.total, 60.02)
  assert.equal(result.expenses[0].participants.reduce((sum, item) => sum + Math.round(item.share_amount * 100), 0), 3001)
  const document = await f.storage.read()
  assert.equal(document.queue.length, 1)
  assert.equal(document.snapshot.expenses.length, 1)
  f.client.stop()
  const reopened = fixture({ storage: f.storage, online: false })
  assert.equal((await reopened.client.refresh()).expenses.length, 2)
})

test('creates then edits and deletes use the server identifier in order after reconnecting', async () => {
  const requests = []
  let serverExpenses = [expense]
  const f = fixture({ transport: async (path, token, options) => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: serverExpenses, offline_sync_version: 1 }
    const request = JSON.parse(options.body)
    requests.push(request)
    assert.equal(token, 'fresh-token')
    if (request.action === 'save_expense') {
      const id = request.body.id || 42
      serverExpenses = [movementFromDraft(request.body, group, 'alice', id), ...serverExpenses.filter(item => item.id !== id)]
      return { entity_id: id, data: { group, expenses: serverExpenses } }
    }
    serverExpenses = serverExpenses.filter(item => item.id !== request.body.id)
    return { entity_id: request.body.id, data: { group, expenses: serverExpenses } }
  } })
  await prepare(f)
  f.state.online = false
  const created = await post(f.client, 'save_expense', draft)
  const localId = created.expenses[0].id
  await post(f.client, 'save_expense', { ...draft, id: localId, name: 'Cena editada' })
  await post(f.client, 'delete_expense', { id: localId })
  f.state.online = true
  await f.client.retry()
  assert.deepEqual(requests.map(request => request.action), ['save_expense', 'save_expense', 'delete_expense'])
  assert.equal(requests[1].body.id, 42)
  assert.equal(requests[2].body.id, 42)
  assert.equal((await f.storage.read()).queue.length, 0)
  assert.equal((await f.client.refresh()).expenses.length, 1)
})

test('a lost server response keeps the same operation id when the app reopens', async () => {
  const ids = []
  let committed = false
  const transport = async (path, token, options) => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense], offline_sync_version: 1 }
    ids.push(JSON.parse(options.body).operation_id)
    if (!committed) { committed = true; throw failure(0) }
    return { entity_id: 44, data: {}, replayed: true }
  }
  const f = fixture({ transport })
  await prepare(f)
  const result = await post(f.client, 'save_expense', draft)
  assert.equal(result.offline_pending, true)
  assert.equal((await f.storage.read()).queue.length, 1)
  f.client.stop()
  const reopened = fixture({ storage: f.storage, transport })
  await reopened.client.retry()
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  assert.equal((await f.storage.read()).queue.length, 0)
})

test('a replayed receipt keeps the acknowledged expense visible even if the next read fails', async () => {
  const f = fixture()
  await prepare(f)
  f.state.online = false
  await post(f.client, 'save_expense', { ...draft, name: 'Respuesta perdida' })
  f.client.stop()
  const reopened = fixture({ storage: f.storage, transport: async path => {
    if (path === 'gastoteca/sync_operation') return { entity_id: 44, data: {}, replayed: true }
    throw failure(503)
  } })
  await reopened.client.retry()
  const snapshot = await reopened.client.refresh()
  assert.equal((await f.storage.read()).queue.length, 0)
  assert.equal(snapshot.expenses.find(item => item.id === 44)?.name, 'Respuesta perdida')
  assert.equal(snapshot.expenses.find(item => item.id === 44)?.offline_pending, undefined)
  assert.equal(snapshot.stats.total, 60.02)
})

test('a replayed creation stays visible and dependent edits use its real id even when another change conflicts', async () => {
  const requests = []
  const f = fixture()
  await prepare(f)
  f.state.online = false
  const created = await post(f.client, 'save_expense', { ...draft, name: 'Original' })
  await post(f.client, 'save_expense', { ...draft, id: created.expenses[0].id, name: 'Editado pendiente' })
  f.client.stop()
  const reopened = fixture({ storage: f.storage, transport: async (path, token, options) => {
    assert.equal(path, 'gastoteca/sync_operation')
    requests.push(JSON.parse(options.body))
    if (requests.length === 1) return { entity_id: 44, data: {}, replayed: true }
    throw failure(409, 'Revisar edición', 'OFFLINE_CONFLICT')
  } })
  await reopened.client.retry()
  const document = await f.storage.read()
  assert.equal(document.queue.length, 1)
  assert.equal(requests[1].body.id, 44)
  assert.equal(document.snapshot.expenses.find(item => item.id === 44)?.name, 'Original')
  const snapshot = await reopened.client.refresh()
  assert.equal(snapshot.expenses.find(item => item.id === 44)?.name, 'Editado pendiente')
  assert.equal(snapshot.expenses.filter(item => item.name.includes('pendiente')).length, 1)
})

test('server conflicts retain the failed operation and every subsequent change', async () => {
  const f = fixture({ transport: async path => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense], offline_sync_version: 1 }
    throw failure(409, 'El movimiento ha cambiado.', 'OFFLINE_CONFLICT')
  } })
  await prepare(f)
  f.state.online = false
  await post(f.client, 'save_expense', { ...draft, id: 1, name: 'Edición' })
  await post(f.client, 'save_debt', { concept: 'Préstamo', amount: 10, status: 'pending', source_uid: 'alice', target_uid: 'bob' })
  f.state.online = true
  await f.client.retry()
  const document = await f.storage.read()
  assert.equal(document.queue.length, 2)
  assert.equal(document.queue[0].expectedUpdatedAt, expense.updated_at)
  assert.equal(document.queue[0].errorCode, 'OFFLINE_CONFLICT')
  assert.equal(f.state.statuses.at(-1).pending, 2)
  assert.equal((await f.client.exportPending()).queue.length, 2)
})

test('new invalid operations preserve the existing failure behavior and are not reported as saved', async () => {
  const f = fixture({ transport: async path => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense], offline_sync_version: 1 }
    throw failure(400, 'Importe inválido.')
  } })
  await prepare(f)
  await assert.rejects(post(f.client, 'save_expense', draft), /Importe inválido/)
  assert.equal((await f.storage.read()).queue.length, 0)
  assert.equal((await f.client.refresh()).expenses.length, 1)
})

test('a full device never claims an offline change has been saved', async () => {
  const f = fixture()
  await prepare(f)
  f.state.online = false
  f.storage.update = async () => { throw new Error('Quota exceeded') }
  await assert.rejects(post(f.client, 'save_expense', draft), /No se pueden guardar/)
  assert.equal((await f.storage.read()).queue.length, 0)
})

test('online-only actions are rejected offline and group changes wait for pending data', async () => {
  const f = fixture()
  await prepare(f)
  f.state.online = false
  for (const action of ['invite_email', 'join_group', 'leave_group', 'send_backup', 'send_summary']) await assert.rejects(post(f.client, action, {}), /necesita/)
  await post(f.client, 'save_expense', draft)
  f.state.online = true
  await assert.rejects(post(f.client, 'join_group', {}), /Sincroniza/)
})

test('old backends keep online saves and do not replay an ambiguous failed mutation', async () => {
  const calls = []
  const f = fixture({ transport: async path => {
    calls.push(path)
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense] }
    throw failure(503)
  } })
  await prepare(f)
  await assert.rejects(post(f.client, 'save_expense', draft), reason => reason.status === 503)
  assert.deepEqual(calls, ['gastoteca/bootstrap', 'gastoteca/save_expense'])
  assert.equal((await f.storage.read()).queue.length, 0)
})

test('account separation and session changes never apply old network results', async () => {
  const a = fixture()
  await prepare(a)
  const b = fixture({ online: false })
  await assert.rejects(b.client.request('gastoteca/group', 'token'), /todavía no están disponibles/)
  let resolveRequest
  const f = fixture({ transport: () => new Promise(resolve => { resolveRequest = resolve }) })
  const request = f.client.request('gastoteca/bootstrap', 'token')
  await new Promise(resolve => setImmediate(resolve))
  f.client.stop()
  resolveRequest({ group, expenses: [expense], offline_sync_version: 1 })
  await assert.rejects(request, /sesión ha cambiado/)
  assert.equal(await f.storage.read(), undefined)
})

test('local catalogs, budgets, debts, recurring rules and settings remain usable before syncing', async () => {
  const f = fixture()
  await prepare(f)
  f.state.online = false
  await post(f.client, 'save_debt', { concept: 'Viaje', amount: 20, status: 'pending', source_uid: 'alice', target_uid: 'bob' })
  await post(f.client, 'save_budget', { category: 'food', monthly_limit: 100 })
  await post(f.client, 'save_recurring', { ...draft, frequency: 'monthly', next_at: '2026-11-04 12:00:00' })
  const category = await post(f.client, 'save_catalog_item', { type: 'category', name: 'Mascotas', icon: 'mdi:paw' })
  assert.match(category.group.category_keys.Mascotas, /^local-/)
  await post(f.client, 'save_backup_settings', { frequency: 'weekly', time: '10:00', weekday: 1, monthday: 1 })
  const data = await f.client.refresh()
  assert.equal(data.group.debts[0].source_name, 'Alicia')
  assert.equal(data.group.budgets[0].monthly_limit, 100)
  assert.equal(data.group.recurring[0].active, true)
  assert.equal(data.backup_settings.frequency, 'weekly')
})

test('percent and explicit shares preserve cents and pending recurring movements stay out of statistics', () => {
  const percent = movementFromDraft({ ...draft, amount: 10.01, share_mode: 'percent', participant_shares: { alice: 33.33, bob: 66.67 } }, group, 'alice', 2)
  assert.deepEqual(percent.participants.map(item => item.share_amount), [3.34, 6.67])
  const amounts = movementFromDraft({ ...draft, share_mode: 'amount', participant_shares: { alice: 1.01, bob: 29 } }, group, 'alice', 3)
  assert.deepEqual(amounts.participants.map(item => item.share_amount), [1.01, 29])
  const document = { snapshot: { group, expenses: [{ ...expense, confirmation_pending: true }] }, queue: [{ id: 'test', action: 'save_expense', body: { ...draft, transaction_type: 'income' }, localId: 'local-test' }], mappings: {} }
  assert.equal(projectOffline(document, 'alice').stats.total, 0)
  assert.deepEqual(resolveReferences({ id: 'local-test', participant_shares: { alice: 2 } }, { 'local-test': 42 }), { id: 42, participant_shares: { alice: 2 } })
})

test('late reads cannot overwrite changes made while the request was in flight', async () => {
  let resolveRead
  const f = fixture({ transport: async path => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense], offline_sync_version: 1 }
    return new Promise(resolve => { resolveRead = resolve })
  } })
  await prepare(f)
  const loading = f.client.request('gastoteca/expenses', 'token')
  await new Promise(resolve => setImmediate(resolve))
  f.state.online = false
  await post(f.client, 'save_expense', draft)
  resolveRead({ expenses: [expense] })
  const loaded = await loading
  assert.equal(loaded.expenses.length, 2)
})

test('failed late reads return the latest pending changes, not the snapshot at request start', async () => {
  let rejectRead
  const f = fixture({ transport: async path => {
    if (path === 'gastoteca/bootstrap') return { group, expenses: [expense], offline_sync_version: 1 }
    return new Promise((resolve, reject) => { rejectRead = reject })
  } })
  await prepare(f)
  const loading = f.client.request('gastoteca/expenses', 'token')
  await new Promise(resolve => setImmediate(resolve))
  f.state.online = false
  await post(f.client, 'save_expense', { ...draft, name: 'Guardado mientras cargaba' })
  rejectRead(failure(503))
  assert.equal((await loading).expenses[0].name, 'Guardado mientras cargaba')
  assert.equal(f.state.statuses.at(-1).snapshot.expenses.length, 2)
})

test('a late retry bootstrap cannot erase an expense acknowledged while the read was in flight', async () => {
  let resolveBootstrap
  let prepared = false
  const f = fixture({ transport: async path => {
    if (path === 'gastoteca/bootstrap') {
      if (!prepared) { prepared = true; return { group, expenses: [expense], offline_sync_version: 1 } }
      return new Promise(resolve => { resolveBootstrap = resolve })
    }
    return { entity_id: 44, data: { group, expenses: [movementFromDraft({ ...draft, name: 'Nuevo confirmado' }, group, 'alice', 44), expense] } }
  } })
  await prepare(f)
  const retry = f.client.retry()
  await new Promise(resolve => setImmediate(resolve))
  await post(f.client, 'save_expense', { ...draft, name: 'Nuevo confirmado' })
  resolveBootstrap({ group, expenses: [expense] })
  await retry
  assert.equal((await f.client.refresh()).expenses.find(item => item.id === 44)?.name, 'Nuevo confirmado')
})

test('all standard category icons and a searchable picker remain available without a CDN', () => {
  for (const category of builtInCategories) assert.ok(offlineIcons[category.icon]?.body)
  const collection = offlineIconResponse('collection?prefix=mdi')
  assert.ok(collection.uncategorized.includes('food-apple-outline'))
  assert.deepEqual(offlineIconResponse('search?query=coffee').icons, ['mdi:coffee-outline'])
  assert.ok(offlineIconResponse('collections').mdi.total >= builtInCategories.length)
})
