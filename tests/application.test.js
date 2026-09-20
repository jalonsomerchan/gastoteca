import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h, ref, reactive } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useBalances } from '../src/composables/useBalances.js'
import { useExpenseSuggestions } from '../src/composables/useExpenseSuggestions.js'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const { useGastoteca } = await server.ssrLoadModule('/src/composables/useGastoteca.js')
const { provideGastoteca } = await server.ssrLoadModule('/src/composables/gastotecaContext.js')
const { createGastotecaState } = await server.ssrLoadModule('/src/state/createGastotecaState.js')

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
  }
  app.catalogDraft.categories = [{ key: 'food', label: 'Alimentación', icon: 'mdi:food-apple-outline' }]
  app.catalogDraft.establishments = [{ name: 'Restaurante', icon: 'mdi:store' }]
  app.expenses.value = [{ ...expense }]
  app.stats.value = { total: 30, count: 1, average: 30, by_category: [{ category: 'food', total: 30 }], by_member: [{ uid: 'alice', total: 30 }], monthly: [{ month: '2026-09', total: 30 }] }
}

async function renderComponent(file, routeName, setup = () => {}) {
  const component = (await server.ssrLoadModule(file)).default
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: routeName, component }] })
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
})

const views = { expenses: 'Expenses', balance: 'Balance', stats: 'Statistics', budgets: 'Budgets', recurring: 'Recurring', tags: 'Tags', establishments: 'Catalog', categories: 'Catalog', group: 'Group', settings: 'Settings' }
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

test('saving an edited expense preserves API payload, refreshes data and closes the editor', async t => {
  let request
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, ...options }
    return { ok: true, json: async () => ({ data: { expenses: [{ ...expense, amount: 40 }], stats: { total: 40 }, settlements: [] } }) }
  })
  const editor = expenseEditor()
  editor.openExpense(expense)
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
