import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h, ref, reactive } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useBalances } from '../src/composables/useBalances.js'
import { useExpenseSuggestions } from '../src/composables/useExpenseSuggestions.js'
import { parseBankinterRows } from '../src/domain/bankinter.js'
import { useDataSearch } from '../src/composables/useDataSearch.js'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const { useGastoteca } = await server.ssrLoadModule('/src/composables/useGastoteca.js')
const { provideGastoteca } = await server.ssrLoadModule('/src/composables/gastotecaContext.js')
const { createGastotecaState } = await server.ssrLoadModule('/src/state/createGastotecaState.js')
const { useDataEditor } = await server.ssrLoadModule('/src/composables/useDataEditor.js')
const { useTags } = await server.ssrLoadModule('/src/composables/useTags.js')
const { useBudgets } = await server.ssrLoadModule('/src/composables/useBudgets.js')
const { useDebts } = await server.ssrLoadModule('/src/composables/useDebts.js')
const { useRecurring } = await server.ssrLoadModule('/src/composables/useRecurring.js')
const { useBackups } = await server.ssrLoadModule('/src/composables/useBackups.js')
const { useSummaries } = await server.ssrLoadModule('/src/composables/useSummaries.js')

const alice = { uid: 'alice', name: 'Alicia', email: 'alice@example.test' }
const bob = { uid: 'bob', name: 'Roberto', email: 'bob@example.test' }
const expense = {
  id: 1, transaction_type: 'expense', name: 'Cena de prueba', amount: 30,
  category: 'food', place: 'Restaurante', city: 'Madrid', occurred_at: '2026-09-20 12:00:00',
  paid_by_type: 'person', paid_by_uid: 'alice', applies_to_all: true,
  participant_uids: ['alice', 'bob'], participants: [{ uid: 'alice', share_amount: 15 }, { uid: 'bob', share_amount: 15 }], tags: [],
}

function populate(app) {
  app.user.value = { ...alice, displayName: alice.name }
  app.group.value = {
    name: 'Grupo de prueba', owner_uid: 'alice', members: [alice, bob], invite_code: 'TEST1234',
    establishments: [{ name: 'Restaurante', icon: 'mdi:store' }], custom_categories: [],
    tags: [{ id: 1, name: 'Viaje', usage_count: 1, last_used_at: '2026-09-20 12:00:00' }], budgets: [{ category: 'food', monthly_limit: 200, current_total: 30 }],
    recurring: [{ id: 1, name: 'Alquiler', amount: 500, category: 'home', next_at: '2026-10-01 12:00:00', frequency: 'monthly', active: true }],
    debts: [{ id: 1, concept: 'Préstamo para el viaje', status: 'pending', source_uid: 'alice', target_uid: 'bob', source_name: 'Alicia', target_name: 'Roberto', amount: 75 }],
  }
  app.catalogDraft.categories = [{ key: 'food', label: 'Alimentación', icon: 'mdi:food-apple-outline' }]
  app.catalogDraft.establishments = [{ name: 'Restaurante', icon: 'mdi:store' }]
  app.expenses.value = [{ ...expense }]
  app.stats.value = { total: 30, count: 1, average: 30, by_category: [{ category: 'food', total: 30 }], by_member: [{ uid: 'alice', total: 30 }], monthly: [{ month: '2026-09', total: 30 }] }
}

async function renderComponent(file, routeName, setup = () => {}) {
  const component = (await server.ssrLoadModule(file)).default
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: routeName, component }, { path: '/:pathMatch(.*)*', component }] })
  await router.push('/')
  await router.isReady()
  const warnings = []
  const root = createSSRApp({ setup() {
    const app = useGastoteca()
    provideGastoteca(app)
    populate(app)
    setup(app)
    return () => h(component)
  } })
  root.use(router)
  root.config.warnHandler = message => warnings.push(message)
  const html = await renderToString(root)
  assert.deepEqual(warnings, [], `${file}: unexpected Vue warnings`)
  return html
}

test('balances offset reciprocal debts, ignore income and reflect settlements', () => {
  const expenses = ref([{ ...expense }, { ...expense, id: 2, paid_by_uid: 'bob', participants: [{ uid: 'alice', share_amount: 5 }] }, { ...expense, transaction_type: 'income', amount: 1000 }])
  const settlements = ref([])
  const balances = useBalances({ expenses, settlements, user: ref(alice) })
  assert.equal(balances.netBalance.value, 10)
  settlements.value.push({ payer_uid: 'bob', payee_uid: 'alice', amount: 4 })
  assert.equal(balances.netBalance.value, 6)
  assert.equal(balances.balanceBreakdown.value.owedToYou[0].counterpartyUid, 'bob')
  settlements.value.push({ payer_uid: 'bob', payee_uid: 'alice', amount: 6 })
  assert.equal(balances.netBalance.value, 0)
  assert.deepEqual(balances.pairBalances.value, [])
})

test('suggestions combine spelling variants and exclude the edited movement and other types', () => {
  const draft = reactive({ id: 3, transaction_type: 'expense', name: 'Cena' })
  const expenses = ref([{ ...expense, name: 'Cena' }, { ...expense, id: 2, name: ' cena ' }, { ...expense, id: 3, name: 'Excluir' }, { ...expense, id: 4, name: 'Nómina', transaction_type: 'income' }])
  const suggestions = useExpenseSuggestions({ draft, expenses })
  assert.equal(suggestions.frequentNames.value[0].count, 2)
  assert.equal(suggestions.frequentNames.value.some(item => item.name === 'Excluir' || item.name === 'Nómina'), false)
  assert.equal(suggestions.frequentCities.value[0].value, 'Madrid')
})

test('application state and editable drafts are isolated between instances', () => {
  const first = createGastotecaState()
  const second = createGastotecaState()
  first.draft.tags.push('Solo aquí')
  first.expenses.value.push(expense)
  assert.deepEqual(second.draft.tags, [])
  assert.deepEqual(second.expenses.value, [])
  first.backupDraft.frequency = 'daily'
  first.backupStatus.last_sent_at = '2026-10-02T08:00:00Z'
  assert.equal(second.backupDraft.frequency, 'disabled')
  assert.equal(second.backupStatus.last_sent_at, null)
  first.summaryDraft.weekly.enabled = true
  assert.equal(second.summaryDraft.weekly.enabled, false)
  first.debtDraft.concept = 'Solo aquí'
  assert.equal(second.debtDraft.concept, '')
})

function debtActions() {
  const state = createGastotecaState()
  populate(state)
  const actions = useDebts({ ...state, memberOptions: ref([alice, bob]), currentMember: ref(alice), freshToken: async () => 'debt-token', flash: () => {} })
  return { ...state, ...actions }
}

test('debt defaults distinguish creditor from debtor and totals count only pending amounts', () => {
  const app = debtActions()
  app.startDebt()
  assert.equal(app.debtDraft.source_uid, 'bob')
  assert.equal(app.debtDraft.target_uid, 'alice')
  const debt = app.debts.value[0]
  app.group.value.debts.push({ ...debt, id: 2, amount: 0.1 }, { ...debt, id: 3, amount: 0.2 }, { ...debt, id: 4, status: 'paid', amount: 100 }, { ...debt, id: 5, status: 'cancelled', amount: 200 })
  assert.equal(app.pendingDebtTotal.value, 75.3)
  app.startDebt(debt)
  assert.equal(app.debtDraft.source_uid, 'alice')
  assert.equal(app.debtDraft.target_uid, 'bob')
  assert.equal(app.debtDraft.amount, '75.00')
})

test('debt validation rejects missing concepts, invalid amounts, statuses and people before requesting the API', async t => {
  const app = debtActions()
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('Invalid debt must not be sent'))
  const valid = { id: '', concept: 'Préstamo', status: 'pending', source_uid: 'alice', target_uid: 'bob', amount: '12.50' }
  for (const invalid of [{ concept: ' ' }, { amount: '0' }, { amount: '0.001' }, { amount: 'Infinity' }, { amount: '100000000' }, { status: 'unknown' }, { source_uid: 'other-group' }, { target_uid: 'alice' }]) {
    Object.assign(app.debtDraft, valid, invalid)
    assert.equal(await app.saveDebt(), false)
    assert.ok(app.error.value)
    assert.equal(app.saving.value, false)
  }
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('debt editor persists all fields, changes status and closes only after successful save', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/save_debt$/)
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    const body = JSON.parse(options.body)
    assert.deepEqual(body, { id: 1, concept: 'Préstamo pagado', status: 'paid', source_uid: 'alice', target_uid: 'bob', amount: 75 })
    return { ok: true, json: async () => ({ data: { group: { members: [alice, bob], debts: [body] } } }) }
  })
  const editor = await mountDataEditor(state => {
    const actions = useDebts(state)
    return { reset: actions.startDebt, save: actions.saveDebt }
  }, { id: 1, concept: 'Préstamo', status: 'pending', source_uid: 'alice', target_uid: 'bob', amount: 75 })
  editor.debtDraft.concept = '  Préstamo pagado  '
  editor.debtDraft.status = 'paid'
  await editor.submitEditor()
  assert.equal(fetchMock.mock.callCount(), 1)
  assert.equal(editor.group.value.debts[0].status, 'paid')
  assert.equal(editor.editorOpen.value, false)
  assert.equal(editor.debtDraft.concept, '')
})

test('debt failures preserve the editor draft and deletion updates the group only after success', async t => {
  const app = debtActions()
  app.startDebt(app.debts.value[0])
  const before = app.group.value
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500, json: async () => ({ message: 'No se pudo guardar la deuda.' }) }))
  assert.equal(await app.saveDebt(), false)
  assert.equal(app.debtDraft.concept, 'Préstamo para el viaje')
  assert.equal(app.group.value, before)
  assert.equal(await app.deleteDebt(app.debts.value[0]), false)
  assert.equal(app.debts.value.length, 1)
  assert.equal(app.saving.value, false)
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/delete_debt$/)
    assert.deepEqual(JSON.parse(options.body), { id: 1 })
    return { ok: true, json: async () => ({ data: { group: { members: [alice, bob], debts: [] } } }) }
  })
  assert.equal(await app.deleteDebt(app.debts.value[0]), true)
  assert.deepEqual(app.debts.value, [])
})

test('debts page displays concept, state, both people and amount, with status filtering and single-member guidance', async () => {
  const html = await renderComponent('/src/views/DebtsView.vue', 'debts')
  for (const text of ['Préstamo para el viaje', 'Pendiente', 'A quien pagar', 'Quien debe', 'Alicia', 'Roberto', '75,00', 'Todos los estados']) assert.ok(html.includes(text), text)
  const empty = await renderComponent('/src/views/DebtsView.vue', 'debts', app => { app.group.value = { members: [alice] } })
  assert.match(empty, /al menos dos personas/)
  assert.match(empty, /disabled[^>]*>[\s\S]*?Nueva deuda/)
})

test('backup settings send the schedule and apply persisted dates', async t => {
  const state = createGastotecaState()
  const notices = []
  const backups = useBackups({ ...state, freshToken: async () => 'backup-token', flash: value => notices.push(value) })
  Object.assign(state.backupDraft, { frequency: 'monthly', time: '20:30', weekday: 5, monthday: 31 })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/save_backup_settings$/)
    assert.equal(options.headers.Authorization, 'Bearer backup-token')
    assert.deepEqual(JSON.parse(options.body), { frequency: 'monthly', time: '20:30', weekday: 5, monthday: 31 })
    return { ok: true, json: async () => ({ data: { ...state.backupDraft, next_run_at: '2026-10-31T19:30:00Z', last_sent_at: null } }) }
  })
  await backups.saveBackupSettings()
  assert.equal(state.backupStatus.next_run_at, '2026-10-31T19:30:00Z')
  assert.equal(state.backupSaving.value, false)
  assert.equal(notices.length, 1)
  backups.applyBackupSettings()
  assert.equal(state.backupDraft.frequency, 'disabled')
  assert.equal(state.backupStatus.next_run_at, null)
})

test('manual backup prevents duplicate sends and preserves an unsaved schedule', async t => {
  const state = createGastotecaState()
  const notices = []
  const backups = useBackups({ ...state, freshToken: async () => 'token', flash: value => notices.push(value) })
  state.backupDraft.frequency = 'weekly'
  state.backupStatus.next_run_at = '2026-10-05T07:00:00Z'
  let finishRequest
  const response = new Promise(resolve => { finishRequest = resolve })
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/send_backup$/)
    assert.deepEqual(JSON.parse(options.body), {})
    return response
  })
  const sending = backups.sendBackupNow()
  assert.equal(state.backupSending.value, true)
  await backups.sendBackupNow()
  await backups.saveBackupSettings()
  finishRequest({ ok: true, json: async () => ({ data: { last_sent_at: '2026-10-02T08:00:00Z', movement_count: 150, settlement_count: 2 } }) })
  await sending
  assert.equal(fetchMock.mock.callCount(), 1)
  assert.equal(state.backupSending.value, false)
  assert.equal(state.backupStatus.last_sent_at, '2026-10-02T08:00:00Z')
  assert.equal(state.backupDraft.frequency, 'weekly')
  assert.equal(state.backupStatus.next_run_at, '2026-10-05T07:00:00Z')
  assert.match(notices[0], /150 movimientos y 2 liquidaciones/)
})

test('backup failure retains the draft and does not claim a successful delivery', async t => {
  const state = createGastotecaState()
  const backups = useBackups({ ...state, freshToken: async () => 'token', flash: () => assert.fail('No success notice expected') })
  state.backupDraft.frequency = 'daily'
  state.backupStatus.last_sent_at = '2026-10-01T07:00:00Z'
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 502, json: async () => ({ message: 'Telegram desconectado.' }) }))
  await backups.saveBackupSettings()
  await backups.sendBackupNow()
  assert.equal(state.error.value, 'Telegram desconectado.')
  assert.equal(state.backupSaving.value, false)
  assert.equal(state.backupSending.value, false)
  assert.equal(state.backupDraft.frequency, 'daily')
  assert.equal(state.backupStatus.last_sent_at, '2026-10-01T07:00:00Z')
})

test('settings exposes manual backups, schedule fields and saved delivery dates', async () => {
  const connected = app => {
    app.telegramConfigured.value = true
    app.telegramConnected.value = true
    app.backupDraft.frequency = 'monthly'
    app.backupStatus.next_run_at = '2026-10-31T08:00:00Z'
  }
  const html = await renderComponent('/src/views/SettingsView.vue', 'settings', connected)
  assert.match(html, /Enviar copia ahora/)
  assert.match(html, /for="backup-time"/)
  assert.match(html, /for="backup-monthday"/)
  assert.match(html, /último día del mes/)
  assert.match(html, /datetime="2026-10-31T08:00:00Z"/)
  const disconnected = await renderComponent('/src/views/SettingsView.vue', 'settings')
  assert.match(disconnected, /disabled[^>]*>[\s\S]*?Enviar copia ahora/)
})

test('summary settings save multiple schedules and restore saved dates', async t => {
  const state = createGastotecaState()
  const summaries = useSummaries({ ...state, freshToken: async () => 'summary-token', flash: () => {} })
  Object.assign(state.summaryDraft.weekly, { enabled: true, time: '10:30', weekday: 2 })
  Object.assign(state.summaryDraft.monthly, { enabled: true, monthday: 31 })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/save_summary_settings$/)
    assert.equal(options.headers.Authorization, 'Bearer summary-token')
    const { schedules } = JSON.parse(options.body)
    assert.equal(schedules.weekly.enabled, true)
    assert.equal(schedules.monthly.enabled, true)
    assert.equal(schedules.daily.enabled, false)
    return { ok: true, json: async () => ({ data: { schedules: { ...schedules,
      weekly: { ...schedules.weekly, next_run_at: '2026-10-06T08:30:00Z' },
      monthly: { ...schedules.monthly, next_run_at: '2026-10-31T08:00:00Z' },
    } } }) }
  })
  await summaries.saveSummarySettings()
  assert.equal(state.summaryStatus.weekly.next_run_at, '2026-10-06T08:30:00Z')
  assert.equal(state.summaryStatus.monthly.next_run_at, '2026-10-31T08:00:00Z')
  assert.equal(state.summarySaving.value, false)
  summaries.applySummarySettings()
  assert.equal(state.summaryDraft.weekly.enabled, false)
  assert.equal(state.summaryStatus.weekly.next_run_at, null)
})

test('manual summary sends the selected period once without altering schedule drafts', async t => {
  const state = createGastotecaState()
  const summaries = useSummaries({ ...state, freshToken: async () => 'token', flash: () => {} })
  state.summaryPeriod.value = 'monthly'
  state.summaryDraft.monthly.enabled = true
  state.summaryStatus.monthly.next_run_at = '2026-10-31T08:00:00Z'
  let finishRequest
  const response = new Promise(resolve => { finishRequest = resolve })
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/send_summary$/)
    assert.deepEqual(JSON.parse(options.body), { period: 'monthly' })
    return response
  })
  const sending = summaries.sendSummaryNow()
  assert.equal(state.summarySending.value, 'monthly')
  await summaries.sendSummaryNow()
  await summaries.saveSummarySettings()
  state.summaryPeriod.value = 'weekly'
  finishRequest({ ok: true, json: async () => ({ data: { period: 'monthly', last_sent_at: '2026-10-02T08:00:00Z' } }) })
  await sending
  assert.equal(fetchMock.mock.callCount(), 1)
  assert.equal(state.summarySending.value, '')
  assert.equal(state.summaryStatus.monthly.last_sent_at, '2026-10-02T08:00:00Z')
  assert.equal(state.summaryStatus.weekly.last_sent_at, null)
  assert.equal(state.summaryStatus.monthly.next_run_at, '2026-10-31T08:00:00Z')
  assert.equal(state.summaryDraft.monthly.enabled, true)
})

test('summary failures retain drafts and previous delivery dates', async t => {
  const state = createGastotecaState()
  const summaries = useSummaries({ ...state, freshToken: async () => 'token', flash: () => assert.fail('Unexpected success') })
  state.summaryDraft.weekly.enabled = true
  state.summaryStatus.weekly.last_sent_at = '2026-09-28T07:00:00Z'
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 502, json: async () => ({ message: 'No se pudo enviar el resumen.' }) }))
  await summaries.saveSummarySettings()
  await summaries.sendSummaryNow()
  assert.equal(state.error.value, 'No se pudo enviar el resumen.')
  assert.equal(state.summarySaving.value, false)
  assert.equal(state.summarySending.value, '')
  assert.equal(state.summaryDraft.weekly.enabled, true)
  assert.equal(state.summaryStatus.weekly.last_sent_at, '2026-09-28T07:00:00Z')
})

test('settings render simultaneous weekly and monthly summaries with labelled schedules', async () => {
  const html = await renderComponent('/src/views/SettingsView.vue', 'settings', app => {
    app.telegramConnected.value = true
    app.summaryDraft.weekly.enabled = true
    app.summaryDraft.monthly.enabled = true
    app.summaryStatus.weekly.next_run_at = '2026-10-05T07:00:00Z'
  })
  assert.match(html, /Resúmenes de gastos/)
  assert.match(html, /Enviar resumen ahora/)
  assert.match(html, /for="summary-weekly-weekday"/)
  assert.match(html, /for="summary-monthly-monthday"/)
  assert.match(html, /datetime="2026-10-05T07:00:00Z"/)
  assert.match(html, /semana anterior, de lunes a domingo/)
  assert.match(html, /mes anterior completo/)
})

const views = { expenses: 'Expenses', debts: 'Debts', 'quick-expenses': 'QuickExpenses', 'bulk-edit': 'BulkEdit', import: 'Import', balance: 'Balance', stats: 'Statistics', budgets: 'Budgets', recurring: 'Recurring', tags: 'Tags', establishments: 'Catalog', categories: 'Catalog', group: 'Group', settings: 'Settings' }
for (const [route, view] of Object.entries(views)) {
  test(`renders ${route} with populated state`, async () => {
    const html = await renderComponent(`/src/views/${view}View.vue`, route)
    assert.match(html, /<section/)
  })
  test(`renders ${route} with an empty group`, async () => {
    await renderComponent(`/src/views/${view}View.vue`, route, app => {
      app.expenses.value = []
      app.group.value = { members: [alice], owner_uid: 'alice' }
    })
  })
}

test('data management pages expose a labelled search and keep forms inside closed editors', async () => {
  for (const [route, view, id] of [
    ['establishments', 'Catalog', 'catalog-search'], ['categories', 'Catalog', 'catalog-search'],
    ['tags', 'Tags', 'tag-search'], ['budgets', 'Budgets', 'budget-search'],
    ['debts', 'Debts', 'debt-search'],
    ['recurring', 'Recurring', 'recurring-search'], ['quick-expenses', 'QuickExpenses', 'quick-template-search'],
  ]) {
    const html = await renderComponent(`/src/views/${view}View.vue`, route)
    assert.ok(html.includes(`for="${id}"`), route)
    assert.match(html, /type="search"/)
    assert.doesNotMatch(html, /<form/)
    assert.doesNotMatch(html, /Guardar cambios de iconos/)
  }
})

test('management search ignores accents and case, combines terms and follows changes', () => {
  const items = ref([{ name: 'Cafetería Central', city: 'Madrid' }, { name: 'Farmacia', city: 'Granada' }])
  const { search, filteredItems } = useDataSearch(items, item => `${item.name} ${item.city}`)
  search.value = '  MADRID cafeTERIA '
  assert.deepEqual(filteredItems.value.map(item => item.name), ['Cafetería Central'])
  search.value = 'inexistente'
  assert.deepEqual(filteredItems.value, [])
  items.value.push({ name: 'Inexistente', city: 'Madrid' })
  assert.equal(filteredItems.value.length, 1)
  search.value = '  '
  assert.equal(filteredItems.value.length, 3)
})

async function mountDataEditor(actions, item) {
  const state = createGastotecaState()
  populate(state)
  const { useGroupCatalogs } = await server.ssrLoadModule('/src/composables/useGroupCatalogs.js')
  const catalogs = useGroupCatalogs(state)
  const dependencies = { ...state, ...catalogs, freshToken: async () => 'test-token', flash: () => {}, loadNotifications: async () => {} }
  let editor
  const probe = { setup() {
    editor = useDataEditor(actions(dependencies))
    editor.openEditor(item)
    return () => h('div')
  } }
  await renderToString(createSSRApp({ setup() {
    provideGastoteca(state)
    return () => h(probe)
  } }))
  return { ...state, ...editor }
}

test('data editor cancellation discards changes and busy saves prevent closing or opening again', async () => {
  const original = { id: 1, name: 'Viaje' }
  const editor = await mountDataEditor(state => ({
    reset: tag => Object.assign(state.tagDraft, { id: tag?.id || '', name: tag?.name || '' }),
    save: async () => false,
  }), original)
  editor.tagDraft.name = 'Cambio sin guardar'
  assert.equal(original.name, 'Viaje')
  editor.saving.value = true
  editor.closeEditor()
  editor.openEditor({ id: 2, name: 'Otra etiqueta' })
  assert.equal(editor.editorOpen.value, true)
  assert.equal(editor.tagDraft.name, 'Cambio sin guardar')
  editor.saving.value = false
  editor.closeEditor()
  assert.equal(editor.editorOpen.value, false)
  assert.equal(editor.dataEditorOpen.value, false)
  assert.deepEqual(editor.tagDraft, { id: '', name: '' })
})

test('tag editor retains a failed draft and closes only after a successful API save', async t => {
  let fail = true
  let payload
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    if (fail) return { ok: false, status: 422, json: async () => ({ message: 'La etiqueta ya existe.' }) }
    return { ok: true, json: async () => ({ data: { group: { tags: [{ ...payload }] } } }) }
  })
  const editor = await mountDataEditor(state => ({
    reset: tag => Object.assign(state.tagDraft, { id: tag?.id || '', name: tag?.name || '' }),
    save: useTags(state).saveTag,
  }), { id: 1, name: 'Viaje' })
  editor.tagDraft.name = 'Vacaciones'
  await editor.submitEditor()
  assert.equal(editor.editorOpen.value, true)
  assert.equal(editor.error.value, 'La etiqueta ya existe.')
  assert.equal(editor.tagDraft.name, 'Vacaciones')
  fail = false
  await editor.submitEditor()
  assert.deepEqual(payload, { id: 1, name: 'Vacaciones' })
  assert.equal(editor.group.value.tags[0].name, 'Vacaciones')
  assert.equal(editor.editorOpen.value, false)
  assert.equal(editor.dataEditorOpen.value, false)
})

test('budget editor keeps validation failures open and closes after saving the category limit', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => ({
    ok: true, json: async () => ({ data: { group: { budgets: [JSON.parse(options.body)] } } }),
  }))
  const editor = await mountDataEditor(state => ({
    reset: budget => Object.assign(state.budgetDraft, { category: budget?.category || 'food', monthly_limit: budget?.monthly_limit || '' }),
    save: useBudgets(state).saveBudget,
  }), { category: 'food', monthly_limit: '-1' })
  await editor.submitEditor()
  assert.equal(fetchMock.mock.callCount(), 0)
  assert.equal(editor.editorOpen.value, true)
  assert.match(editor.error.value, /mayor que cero/)
  editor.budgetDraft.monthly_limit = '250.00'
  await editor.submitEditor()
  assert.equal(editor.group.value.budgets[0].monthly_limit, '250.00')
  assert.equal(editor.editorOpen.value, false)
})

test('recurring editor validates before saving and preserves the split in the API request', async t => {
  let payload
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { group: { recurring: [{ id: 1, payload }] } } }) }
  })
  const editor = await mountDataEditor(state => {
    const actions = useRecurring(state)
    return { reset: actions.startRecurringRule, save: actions.saveRecurring }
  }, { id: 1, payload: { name: 'Alquiler', amount: 500, category: 'home', paid_by_uid: 'alice', applies_to_all: true, share_mode: 'amount', participant_shares: { alice: 200, bob: 300 } } })
  editor.recurringDraft.amount = '0'
  await editor.submitEditor()
  assert.equal(fetchMock.mock.callCount(), 0)
  assert.equal(editor.editorOpen.value, true)
  editor.recurringDraft.amount = '500'
  await editor.submitEditor()
  assert.equal(payload.id, 1)
  assert.deepEqual(payload.participant_shares, { alice: 200, bob: 300 })
  assert.equal(editor.editorOpen.value, false)
})

test('expense editor clones participants and validates a missing transaction type', async () => {
  const html = await renderComponent('/src/components/dialogs/ExpenseDialog.vue', 'expenses', app => {
    app.openExpense(expense)
    app.draft.participant_uids.push('extra')
    assert.equal(expense.participant_uids.includes('extra'), false)
    app.draft.transaction_type = ''
    app.saveExpense()
    assert.match(app.error.value, /Selecciona si es un gasto/)
    app.draft.transaction_type = 'expense'
  })
  assert.match(html, /Editar movimiento/)
  assert.match(html, /Cena de prueba/)
})

test('quick expense validates the amount before contacting the API', async () => {
  await renderComponent('/src/components/dialogs/ExpenseDialog.vue', 'expenses', app => {
    app.openExpense()
    app.quickExpenseMode.value = true
    app.quickAmount.value = '-1'
    app.saveQuickExpense()
    assert.match(app.error.value, /importe mayor que cero/)
  })
})

test('settlement dialog selects debtor, creditor and amount', async () => {
  const html = await renderComponent('/src/components/dialogs/SettlementDialog.vue', 'balance', app => {
    app.openSettlement({ counterpartyUid: 'bob', amount: 15 }, true)
    assert.equal(app.settlementDraft.payer_uid, 'bob')
    assert.equal(app.settlementDraft.payee_uid, 'alice')
    assert.equal(app.settlementDraft.amount, '15.00')
  })
  assert.match(html, /role="dialog"/)
})

test('shared confirmations preserve each deletion target', async () => {
  const html = await renderComponent('/src/components/dialogs/DeleteDialogs.vue', 'expenses', app => {
    app.deleteTarget.value = expense
    app.tagDeleteTarget.value = { id: 1, name: 'Viaje' }
    app.recurringDeleteTarget.value = { id: 1, name: 'Alquiler' }
  })
  for (const id of ['expense-delete-title', 'tag-delete-title', 'recurring-delete-title']) assert.ok(html.includes(`aria-labelledby="${id}"`))
})

test('icon picker renders collections and search state', async () => {
  const html = await renderComponent('/src/components/dialogs/IconPickerDialog.vue', 'categories', app => {
    app.iconPickerOpen.value = true
  })
  assert.match(html, /role="dialog"/)
})

test('header renders member, navigation and notifications', async () => {
  const html = await renderComponent('/src/components/layout/AppHeader.vue', 'expenses', app => {
    app.menuOpen.value = true
    app.notificationsOpen.value = true
    app.notifications.value = [{ id: 1, title: 'Movimiento nuevo', body: 'Cena', created_at: '2026-09-20 12:00:00' }]
  })
  assert.match(html, /Movimiento nuevo/)
  assert.match(html, /Alicia/)
})

const { useExpenses } = await server.ssrLoadModule('/src/composables/useExpenses.js')
const { useGroupCatalogs } = await server.ssrLoadModule('/src/composables/useGroupCatalogs.js')

function expenseEditor() {
  const state = createGastotecaState()
  populate(state)
  const catalog = useGroupCatalogs(state)
  const actions = useExpenses({ ...state, ...catalog, freshToken: async () => 'test-token', flash: () => {} })
  return { ...state, ...actions }
}

function quickTemplate(overrides = {}) {
  return {
    id: 'coffee', title: 'Café', name: 'Café', amount: '2.50',
    fields: ['name', 'amount', 'paid_by_type'], paid_by_type: 'person', paid_by_uid: 'alice',
    visibility: 'private', created_by: 'alice', can_edit: true,
    ...overrides,
  }
}

test('quick template editor defaults to private and offers sharing with the group', async () => {
  const html = await renderComponent('/src/components/dialogs/ExpenseDialog.vue', 'quick-expenses', app => {
    app.openQuickTemplateEditor(null, true)
    assert.equal(app.quickTemplateDraft.visibility, 'private')
  })
  assert.match(html, /for="quick-template-visibility"/)
  assert.match(html, /value="private" selected>Solo para mí/)
  assert.match(html, /value="group">Todo el grupo/)
})

test('saving a shared quick template counts only the creator templates and retains those of others', async t => {
  const shared = Array.from({ length: 12 }, (_, index) => quickTemplate({ id: `shared-${index}`, created_by: 'bob', visibility: 'group', can_edit: false }))
  let payload
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { templates: [...payload.templates, ...shared] } }) }
  })
  const editor = expenseEditor()
  editor.quickExpenseTemplates.value = shared
  editor.openQuickTemplateEditor(null, true)
  Object.assign(editor.quickTemplateDraft, { title: 'Mi café', name: 'Café', amount: '2.50', visibility: 'group' })
  await editor.saveQuickExpenseTemplate()
  assert.equal(payload.templates.length, 1)
  assert.equal(payload.templates[0].visibility, 'group')
  assert.equal(payload.templates[0].created_by, 'alice')
  assert.equal(editor.ownedQuickExpenseTemplates.value.length, 1)
  assert.equal(editor.quickExpenseTemplates.value.length, 13)
  assert.equal(editor.modalOpen.value, false)
})

test('editing an own shared template can make it private and preserves its inactive state', async t => {
  let payload
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { templates: payload.templates } }) }
  })
  const editor = expenseEditor()
  const template = quickTemplate({ visibility: 'group', active: false })
  editor.quickExpenseTemplates.value = [template]
  editor.openQuickTemplateEditor(template, true)
  assert.equal(editor.quickTemplateDraft.visibility, 'group')
  editor.quickTemplateDraft.visibility = 'private'
  await editor.saveQuickExpenseTemplate()
  assert.equal(payload.templates[0].visibility, 'private')
  assert.equal(payload.templates[0].active, false)
})

test('quick template saves cleared establishment and city without losing the other fields', async t => {
  let payload
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { templates: payload.templates } }) }
  })
  const editor = expenseEditor()
  const template = quickTemplate({ place: 'Restaurante', city: 'Madrid', fields: ['name', 'amount', 'paid_by_type', 'place', 'city'] })
  editor.quickExpenseTemplates.value = [template]
  editor.openQuickTemplateEditor(template, true)
  editor.quickTemplateDraft.place = null
  editor.quickTemplateDraft.city = null
  editor.quickTemplateDraft.details = null
  editor.quickTemplateDraft.tags_text = null
  await editor.saveQuickExpenseTemplate()
  const saved = payload.templates[0]
  assert.equal(saved.place, '')
  assert.equal(saved.city, '')
  assert.equal(saved.details, '')
  assert.deepEqual(saved.tags, [])
  assert.equal(saved.name, 'Café')
  assert.equal(saved.amount, '2.50')
  assert.deepEqual(saved.fields, template.fields)
  assert.equal(editor.error.value, '')
  assert.equal(editor.modalOpen.value, false)
})

test('quick template null required names show validation errors and keep the editor open', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected API request') })
  const editor = expenseEditor()
  editor.openQuickTemplateEditor(quickTemplate(), true)
  editor.quickTemplateDraft.title = null
  await editor.saveQuickExpenseTemplate()
  assert.match(editor.error.value, /Pon un nombre/)
  editor.quickTemplateDraft.title = 'Café'
  editor.quickTemplateDraft.name = null
  await editor.saveQuickExpenseTemplate()
  assert.match(editor.error.value, /Añade el nombre del gasto/)
  assert.equal(editor.quickTemplateEditorOpen.value, true)
  assert.equal(editor.modalOpen.value, true)
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('deleting an own template does not delete another creator template with the same id', async t => {
  let payload
  const shared = quickTemplate({ created_by: 'bob', visibility: 'group', can_edit: false })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { templates: [shared] } }) }
  })
  const editor = expenseEditor()
  const own = quickTemplate()
  editor.quickExpenseTemplates.value = [own, shared]
  assert.equal(await editor.deleteQuickExpenseTemplate(own), true)
  assert.deepEqual(payload.templates, [])
  assert.deepEqual(editor.quickExpenseTemplates.value, [shared])
})

test('another member shared templates cannot be edited or deleted', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected API request') })
  const editor = expenseEditor()
  const shared = quickTemplate({ created_by: 'bob', visibility: 'group', can_edit: false })
  editor.quickExpenseTemplates.value = [shared]
  editor.openQuickTemplateEditor(shared, true)
  assert.equal(editor.quickTemplateEditorOpen.value, false)
  assert.equal(await editor.deleteQuickExpenseTemplate(shared), false)
  assert.equal(fetchMock.mock.callCount(), 0)
  assert.match(editor.error.value, /Solo quien creó/)
})

test('batch saves send only owned templates while retaining other shared templates', async t => {
  let payload
  const shared = quickTemplate({ created_by: 'bob', visibility: 'group', can_edit: false })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { templates: [...payload.templates, shared] } }) }
  })
  const editor = expenseEditor()
  editor.quickExpenseTemplates.value = [shared, quickTemplate({ id: 'mine' })]
  await editor.saveQuickExpenseTemplates(editor.quickExpenseTemplates.value)
  assert.deepEqual(payload.templates.map(template => template.id), ['mine'])
  assert.equal(editor.quickExpenseTemplates.value.length, 2)
})

test('another member can use a shared template to create an expense', async t => {
  let payload
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { expenses: [], stats: { total: 0 } } }) }
  })
  const editor = expenseEditor()
  await editor.applyQuickExpenseTemplate(quickTemplate({ created_by: 'bob', can_edit: false, visibility: 'group' }))
  assert.equal(payload.name, 'Café')
  assert.equal(payload.amount, '2.50')
  assert.equal(payload.transaction_type, 'expense')
  assert.equal(payload.visibility, undefined)
  assert.equal(editor.modalOpen.value, false)
})

test('quick template manager shows visibility and only offers management for owned templates', async () => {
  const html = await renderComponent('/src/views/QuickExpensesView.vue', 'quick-expenses', app => {
    app.quickExpenseTemplates.value = [quickTemplate(), quickTemplate({ title: 'Compra compartida', created_by: 'bob', visibility: 'group', can_edit: false })]
  })
  assert.match(html, /Solo para mí/)
  assert.match(html, /Todo el grupo/)
  assert.match(html, /Creado por Roberto/)
  assert.equal((html.match(/> Editar<\/button>/g) || []).length, 1)
  assert.doesNotMatch(html, /aria-label="Eliminar Compra compartida"/)
  assert.match(html, /1\/12 propias/)
})

test('changing groups clears the previous group quick templates', async () => {
  await renderComponent('/src/views/QuickExpensesView.vue', 'quick-expenses', app => {
    app.group.value.id = 1
    app.quickExpenseTemplates.value = [quickTemplate({ created_by: 'bob', visibility: 'group', can_edit: false })]
    app.group.value = { ...app.group.value, name: 'Renamed' }
    assert.equal(app.quickExpenseTemplates.value.length, 1)
    app.group.value = { ...app.group.value, id: 2 }
    assert.deepEqual(app.quickExpenseTemplates.value, [])
  })
})

test('saving an edited expense preserves API payload, refreshes data and closes the editor', async t => {
  let request
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, ...options }
    return { ok: true, json: async () => ({ data: { expenses: [{ ...expense, amount: 40 }], stats: { total: 40 }, settlements: [] } }) }
  })
  const editor = expenseEditor()
  editor.openExpense(expense)
  editor.setShareMode('amount')
  editor.draft.amount = '40.00'
  editor.draft.participant_shares = { alice: '25.00', bob: '15.00' }
  await editor.saveExpense()
  assert.ok(request.url.endsWith('/gastoteca/save_expense'))
  assert.equal(request.headers.Authorization, 'Bearer test-token')
  const payload = JSON.parse(request.body)
  assert.equal(payload.id, 1)
  assert.deepEqual(payload.participant_shares, { alice: 25, bob: 15 })
  assert.equal(editor.expenses.value[0].amount, 40)
  assert.equal(editor.modalOpen.value, false)
  assert.equal(editor.saving.value, false)
})

test('failed saves retain the editable draft and surface the API error', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 422, json: async () => ({ message: 'El reparto no coincide.' }) }))
  const editor = expenseEditor()
  editor.openExpense(expense)
  editor.draft.name = 'Cena corregida'
  await editor.saveExpense()
  assert.equal(editor.error.value, 'El reparto no coincide.')
  assert.equal(editor.draft.name, 'Cena corregida')
  assert.equal(editor.modalOpen.value, true)
  assert.equal(editor.saving.value, false)
})

test('deleting a movement updates shared data and clears the confirmation', async t => {
  let payload
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body)
    return { ok: true, json: async () => ({ data: { expenses: [], stats: { total: 0 }, settlements: [] } }) }
  })
  const editor = expenseEditor()
  editor.deleteTarget.value = expense
  await editor.removeExpense()
  assert.deepEqual(payload, { id: 1 })
  assert.deepEqual(editor.expenses.value, [])
  assert.equal(editor.deleteTarget.value, null)
  assert.equal(editor.saving.value, false)
})

test('split mode conversions preserve the distribution and total', () => {
  const editor = expenseEditor()
  editor.openExpense(expense)
  editor.setShareMode('percent')
  assert.deepEqual(editor.draft.participant_shares, { alice: '50.00', bob: '50.00' })
  editor.draft.participant_shares = { alice: '25.00', bob: '75.00' }
  editor.setShareMode('amount')
  assert.deepEqual(editor.draft.participant_shares, { alice: '7.50', bob: '22.50' })
})

test('expense filters are labelled and empty results keep their main heading', async () => {
  const html = await renderComponent('/src/views/ExpensesView.vue', 'expenses', app => {
    app.filtersOpen.value = true
    app.expenses.value = []
  })
  assert.match(html, /<h1>Movimientos<\/h1>/)
  for (const id of ['expense-search', 'expense-category', 'expense-from', 'expense-to']) assert.ok(html.includes(`for="${id}"`))
  assert.match(html, /Añadir el primer movimiento/)
})

test('device expenses stay visible outside filters and pagination without duplicate cards', async () => {
  for (const filtered of [false, true]) {
    const html = await renderComponent('/src/views/ExpensesView.vue', 'expenses', app => {
      app.expenses.value = [
        ...Array.from({ length: 25 }, (_, index) => ({ ...expense, id: index + 1, name: `Confirmado ${index}` })),
        { ...expense, id: 'local-pending', name: 'Compra en el dispositivo', offline_pending: true },
      ]
      if (filtered) Object.assign(app.filters, { search: 'Sin coincidencias', category: 'home', from: '2026-10-01' })
    })
    assert.match(html, /Pendientes de sincronizar/)
    assert.match(html, /Guardado en este dispositivo/)
    assert.equal((html.match(/aria-label="Editar movimiento: Compra en el dispositivo"/g) || []).length, 1)
    assert.match(html, filtered ? /No hay resultados/ : /Mostrar más movimientos/)
  }
})

test('a list with only pending expenses does not say that the first expense is missing', async () => {
  const html = await renderComponent('/src/views/ExpensesView.vue', 'expenses', app => {
    app.expenses.value = [{ ...expense, id: 'local-pending', offline_pending: true }]
  })
  assert.match(html, /Pendientes de sincronizar/)
  assert.doesNotMatch(html, /No hay resultados|Tu primer gasto empieza aquí/)
})

test('expense comboboxes use unique ids and distinguish field labels', async () => {
  const html = await renderComponent('/src/components/dialogs/ExpenseDialog.vue', 'expenses', app => app.openExpense(expense))
  for (const field of ['category', 'place', 'city']) {
    assert.ok(html.includes(`expense-${field}-select-multiselect-options`))
    assert.ok(html.includes(`expense-${field}-label`))
  }
  assert.match(html, /aria-label="Nombre del gasto"/)
  assert.match(html, /name="draft-share_mode"/)
})

test('invalid custom shares prevent the API request', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected API request') })
  const editor = expenseEditor()
  editor.openExpense(expense)
  editor.setShareMode('amount')
  editor.draft.participant_shares = { alice: 2, bob: 2 }
  await editor.saveExpense()
  assert.match(editor.error.value, /sumar el importe total/)
  assert.equal(fetchMock.mock.callCount(), 0)
  assert.equal(editor.modalOpen.value, true)
})

test('monthly statistics expose a semantic table', async () => {
  const html = await renderComponent('/src/views/StatisticsView.vue', 'stats')
  assert.match(html, /<caption>Evolución del gasto mensual<\/caption>/)
  assert.match(html, /scope="row"/)
})

test('Bankinter importer maps movement rows and keeps income direction', () => {
  const movements = parseBankinterRows([
    ['Título'],
    ['Fecha contable', 'Descripción', 'Importe', 'Saldo', 'Divisa'],
    ['22/09/2026', 'CAFÉ', '-16.40', '2206.06', 'EUR'],
    ['02/09/2026', 'TRANSFERENCIA', '600', '2451.70', 'EUR'],
  ])
  assert.equal(movements.length, 2)
  assert.equal(movements[0].description, 'CAFÉ')
  assert.equal(movements[0].name, 'CAFÉ')
  assert.equal(movements[0].value_date, '2026-09-22T12:00')
  assert.match(movements[0].import_key, /^bankinter:[0-9a-f]{8}$/)
  assert.equal(movements[0].balance, 2206.06)
  assert.equal(movements[1].transaction_type, 'income')
})
