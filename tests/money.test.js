import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ref } from 'vue'
import { allocateUnits, equalUnits, sumMoney, toCents } from '../src/domain/money.js'
import { equalShareCents, isPositiveAmount, splitValidation } from '../src/domain/validation.js'
import { localStatistics, movementFromDraft, projectOffline } from '../src/domain/offline.js'
import { useBalances } from '../src/composables/useBalances.js'
import { madridDateTime, recentMonthRange } from '../src/domain/dates.js'
import { isBankinterMovementImported, parseBankinterRows } from '../src/domain/bankinter.js'
import { money } from '../src/utils/formatters.js'

const group = { members: ['d', 'c', 'b', 'a'].map(uid => ({ uid })) }
const draft = { amount: '0.02', transaction_type: 'expense', applies_to_all: true, paid_by_type: 'person', paid_by_uid: 'a', share_mode: 'equal', occurred_at: madridDateTime() }

test('money accepts exact cents and rejects silent rounding or coercion', () => {
  for (const [value, expected] of [['0.29', 29], ['1.13', 113], ['99999999.00', 9999999900], ['-0.29', -29], [0.57, 57]]) assert.equal(toCents(value), expected)
  for (const value of [true, [], null, '', '1e2', Infinity, NaN, '0.001', '1.005', '1.999', '10000000000000000']) assert.ok(Number.isNaN(toCents(value)), String(value))
  for (const value of ['0.001', '1.005', '99.999', true]) assert.equal(isPositiveAmount(value), false)
  assert.ok(splitValidation(['0.005', '0.005'], '0.01'))
  assert.ok(splitValidation(['50.001', '49.999'], 100, true))
  assert.equal(sumMoney(Array.from({ length: 10000 }, () => '0.29')), 2900)
  assert.equal(money(-0.001), money(0))
  assert.equal(money(NaN), '—')
  assert.ok(Number.isNaN(sumMoney(['90071992547409.91', '0.01'])))
})

test('equal splits conserve every cent with nonnegative shares differing by at most one cent', () => {
  assert.deepEqual(Array.from({ length: 4 }, (_, index) => equalShareCents('0.02', 4, index)), [0, 0, 1, 1])
  for (let count = 1; count <= 60; count++) {
    for (const total of [1, 2, 3, 10, 29, 100, 1000, 9999999900]) {
      const shares = Array.from({ length: count }, (_, index) => equalUnits(total, count, index))
      assert.equal(shares.reduce((sum, value) => sum + value, 0), total)
      assert.ok(Math.min(...shares) >= 0)
      assert.ok(Math.max(...shares) - Math.min(...shares) <= 1)
      assert.deepEqual(allocateUnits(total, shares.map(() => 1)), shares)
    }
  }
})

test('weighted splits conserve cents, obey quotas and never charge a zero percent participant', () => {
  assert.throws(() => allocateUnits(1, [0, 0]), /parte mayor/)
  assert.deepEqual(allocateUnits(2, [2500, 2500, 2500, 2500]), [0, 0, 1, 1])
  assert.deepEqual(allocateUnits(1, [5000, 5000, 0]), [0, 1, 0])
  let seed = 729
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max }
  for (let i = 0; i < 10000; i++) {
    const total = random(9999999900)
    const weights = Array.from({ length: 2 + random(12) }, () => random(9999999900))
    weights.push(0)
    const shares = allocateUnits(total, weights)
    const denominator = weights.reduce((sum, value) => sum + BigInt(value), 0n)
    assert.equal(shares.reduce((sum, value) => sum + value, 0), total)
    shares.forEach((value, index) => {
      const numerator = BigInt(total) * BigInt(weights[index])
      const lower = Number(numerator / denominator)
      assert.ok(value === lower || value === lower + 1)
      if (weights[index] === 0) assert.equal(value, 0)
    })
  }
})

test('offline percentages, equal splits and every statistics dimension reconcile to the movement total', () => {
  const equal = movementFromDraft(draft, group, 'a', 1)
  assert.deepEqual(equal.participants, [{ uid: 'a', share_amount: 0 }, { uid: 'b', share_amount: 0 }, { uid: 'c', share_amount: 0.01 }, { uid: 'd', share_amount: 0.01 }])
  const percent = movementFromDraft({ ...draft, share_mode: 'percent', participant_shares: { a: 50, b: 50, c: 0, d: 0 }, amount: '0.01' }, group, 'a', 2)
  assert.equal(sumMoney(percent.participants.map(item => item.share_amount)), 0.01)
  assert.equal(percent.participants[3].share_amount, 0)
  const items = [equal, percent, { ...equal, id: 3, transaction_type: 'income', amount: 500 }, { ...equal, id: 4, confirmation_pending: true, amount: 500 }]
  const stats = localStatistics(items, { allExpenses: items })
  assert.equal(stats.total, 0.03)
  assert.equal(stats.current_month_total, 0.03)
  for (const dimension of ['by_category', 'by_member', 'by_participant', 'by_title', 'by_establishment', 'by_payment_method', 'monthly']) {
    assert.equal(sumMoney(stats[dimension].map(row => row.total)), stats.total, dimension)
  }
  assert.equal(stats.count, 2)
})

test('offline budget creation immediately includes confirmed expenses already in the current month', () => {
  const snapshot = projectOffline({ snapshot: { group, expenses: [{ ...movementFromDraft(draft, group, 'a', 1), category: 'food' }] }, queue: [{ action: 'save_budget', localId: 1, body: { category: 'food', monthly_limit: 10 } }] }, 'a')
  assert.equal(snapshot.group.budgets[0].current_total, 0.02)
})

test('offline incomes use the same recipient and participant rules as the server', () => {
  const income = movementFromDraft({ ...draft, transaction_type: 'income', paid_by_type: 'all', paid_by_uid: '' }, group, 'a', 1)
  assert.equal(income.paid_by_type, 'person')
  assert.equal(income.paid_by_uid, 'a')
  assert.deepEqual(income.participant_uids, ['a', 'b', 'c', 'd'])
  assert.equal(sumMoney(income.participants.map(participant => participant.share_amount)), 0.02)
})

test('income includes the recipient share without redistributing it to other people in the balance', () => {
  const income = movementFromDraft({ ...draft, transaction_type: 'income', paid_by_uid: 'a', amount: '10.00' }, group, 'a', 1)
  assert.deepEqual(income.participants.map(participant => participant.share_amount), [2.5, 2.5, 2.5, 2.5])
  const expenses = ref([
    ...['b', 'c', 'd'].map(paid_by_uid => ({ transaction_type: 'expense', paid_by_type: 'person', paid_by_uid, amount: 10, participants: [{ uid: 'a', share_amount: 10 }] })),
    income,
  ])
  const balance = useBalances({ expenses, settlements: ref([]), user: ref({ uid: 'a' }) })
  assert.equal(balance.balanceSummary.value.youOwe, 22.5)
  const personal = movementFromDraft({ ...draft, transaction_type: 'income', applies_to_all: false, participant_uids: ['a'], amount: '10.00' }, group, 'a', 2)
  assert.deepEqual(personal.participants, [{ uid: 'a', share_amount: 10 }])
  expenses.value = [personal]
  assert.deepEqual(balance.pairBalances.value, [])
})

test('nonfinancial edits retain stored allocations when percentages cannot reproduce the original cents', () => {
  const previous = { ...draft, share_mode: 'percent', amount: 999999.99, participants: [{ uid: 'a', share_amount: 333333.33 }, { uid: 'b', share_amount: 333333.33 }, { uid: 'c', share_amount: 333333.33 }] }
  const body = { ...previous, applies_to_all: false, participant_uids: ['c', 'a', 'b'], participant_shares: { a: 33.33, b: 33.33, c: 33.34 }, preserve_participant_shares: true }
  const result = movementFromDraft(body, group, 'a', 1, previous)
  assert.deepEqual(result.participants, previous.participants)
  assert.notDeepEqual(movementFromDraft({ ...body, amount: 10 }, group, 'a', 1, previous).participants, previous.participants)
})

test('legacy income scaling distributes cents once and leaves the same residual debts after partial payments', () => {
  const expenses = ref([
    { transaction_type: 'expense', paid_by_type: 'person', paid_by_uid: 'b', amount: 1, participants: [{ uid: 'a', share_amount: 1 }] },
    { transaction_type: 'expense', paid_by_type: 'person', paid_by_uid: 'c', amount: 1, participants: [{ uid: 'a', share_amount: 1 }] },
    { transaction_type: 'income', paid_by_type: 'person', paid_by_uid: 'a', amount: 0.01, participants: [{ uid: 'b', share_amount: 1 }, { uid: 'c', share_amount: 1 }] },
  ])
  const settlements = ref([{ payer_uid: 'a', payee_uid: 'b', amount: 0.29 }, { payer_uid: 'a', payee_uid: 'b', amount: 0.57 }])
  const balance = useBalances({ expenses, settlements, user: ref({ uid: 'a' }) })
  assert.equal(balance.balanceSummary.value.youOwe, 1.13)
  assert.equal(balance.netBalance.value, -1.13)
  settlements.value.push({ payer_uid: 'a', payee_uid: 'b', amount: 0.14 }, { payer_uid: 'a', payee_uid: 'c', amount: 0.99 })
  assert.deepEqual(balance.pairBalances.value, [])
})

test('recorded transfers remain credited after an income cancels the original expense debt', () => {
  const expenses = ref([
    { transaction_type: 'expense', paid_by_type: 'person', paid_by_uid: 'b', amount: 0.29, participants: [{ uid: 'a', share_amount: 0.29 }] },
    { transaction_type: 'income', paid_by_type: 'person', paid_by_uid: 'a', amount: 0.29, participants: [{ uid: 'b', share_amount: 0.29 }] },
  ])
  const settlements = ref([{ payer_uid: 'a', payee_uid: 'b', amount: 0.01 }])
  const balance = useBalances({ expenses, settlements, user: ref({ uid: 'a' }) })
  assert.equal(balance.netBalance.value, 0.01)
  assert.equal(balance.pairBalances.value[0].debtorUid, 'b')
  expenses.value.shift()
  assert.equal(balance.netBalance.value, 0.01)
})

test('calendar calculations use Madrid and clamp the previous month across month-end and leap years', () => {
  assert.equal(madridDateTime(new Date('2026-10-31T23:30:00Z')), '2026-11-01 00:30:00')
  assert.equal(recentMonthRange(new Date('2026-03-31T10:00:00Z')).from, '2026-02-28 12:00:00')
  assert.equal(recentMonthRange(new Date('2028-03-31T10:00:00Z')).from, '2028-02-29 12:00:00')
  assert.equal(recentMonthRange(new Date('2026-01-31T11:00:00Z')).from, '2025-12-31 12:00:00')
})

test('bank imports reject fractional cents, foreign currencies and impossible calendar dates explicitly', () => {
  const headers = ['Fecha contable', 'Descripción', 'Importe', 'Divisa']
  for (const row of [['03/11/2026', 'Compra', '1.005', 'EUR'], ['03/11/2026', 'Compra', '1.2.3,45', 'EUR'], ['03/11/2026', 'Compra', 10, 'USD'], ['31/02/2026', 'Compra', 10, 'EUR'], ['2026-02-31', 'Compra', 10, 'EUR']]) assert.throws(() => parseBankinterRows([headers, row]), /fila 2/)
  assert.equal(parseBankinterRows([headers, ['03/11/2026', 'Compra', '-1.234,56', 'EUR']])[0].amount, 1234.56)
  assert.equal(parseBankinterRows([headers, ['46329', 'Compra', '-0,29', 'EUR']])[0].occurred_at, '2026-11-03T12:00')
})

test('two purchases with the same name, date and price are not confused when their bank identifiers differ', () => {
  const rows = parseBankinterRows([
    ['Fecha contable', 'Descripción', 'Importe', 'Saldo', 'Divisa'],
    ['03/11/2026', 'Café', '-0,29', '10,00', 'EUR'],
    ['03/11/2026', 'Café', '-0,29', '9,71', 'EUR'],
  ])
  const imported = [{ ...rows[0], details: `Importado desde Bankinter · ${rows[0].import_key}` }]
  assert.equal(isBankinterMovementImported(imported, rows[0]), true)
  assert.equal(isBankinterMovementImported(imported, rows[1]), false)
})
