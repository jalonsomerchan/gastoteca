import { computed } from 'vue'

export function useBalances({ expenses, settlements, user }) {
  const pairBalances = computed(() => {
    const balances = new Map()
    const incomeCredits = new Map()
    const keyFor = (debtor, creditor) => `${debtor}::${creditor}`
    expenses.value.forEach((expense) => {
      if (expense.confirmation_pending) return
      const transactionType = expense.transaction_type || 'expense'
      if (transactionType !== 'expense' && transactionType !== 'income') return
      if (transactionType === 'expense' && (expense.paid_by_type !== 'person' || !expense.paid_by_uid)) return
      const incomeEnteredBy = transactionType === 'income'
        ? (expense.paid_by_type === 'person' && expense.paid_by_uid ? expense.paid_by_uid : expense.created_by)
        : ''
      if (transactionType === 'income' && !incomeEnteredBy) return
      const participants = (expense.participants || []).filter((participant) => transactionType !== 'income' || participant.uid !== incomeEnteredBy)
      const incomeSharesTotal = transactionType === 'income'
        ? participants.reduce((total, participant) => total + Number(participant.share_amount || 0), 0)
        : 0
      const incomeShareScale = transactionType === 'income' && incomeSharesTotal > 0
        ? Number(expense.amount || 0) / incomeSharesTotal
        : 1
      participants.forEach((participant) => {
        const firstUid = transactionType === 'income' ? incomeEnteredBy : participant.uid
        const secondUid = transactionType === 'income' ? participant.uid : expense.paid_by_uid
        if (firstUid === secondUid) return
        const key = keyFor(firstUid, secondUid)
        const sign = transactionType === 'income' ? -1 : 1
        const shareAmount = Number(participant.share_amount || 0) * (transactionType === 'income' ? incomeShareScale : 1)
        if (transactionType === 'income') {
          incomeCredits.set(key, (incomeCredits.get(key) || 0) + shareAmount)
        } else {
          balances.set(key, (balances.get(key) || 0) + sign * shareAmount)
        }
      })
    })
    settlements.value.forEach((settlement) => {
      const key = keyFor(settlement.payer_uid, settlement.payee_uid)
      balances.set(key, (balances.get(key) || 0) - Number(settlement.amount || 0))
    })
    const entries = [...balances.entries()].filter(([, amount]) => Math.abs(amount) > 0.004)
    const handled = new Set()
    entries.forEach(([key, amount]) => {
      if (handled.has(key)) return
      const [debtor, creditor] = key.split('::')
      const reverseKey = keyFor(creditor, debtor)
      const reverseAmount = balances.get(reverseKey) || 0
      const net = amount - reverseAmount
      balances.set(key, Math.max(0, net))
      balances.set(reverseKey, Math.max(0, -net))
      handled.add(key)
      handled.add(reverseKey)
    })
    incomeCredits.forEach((amount, key) => {
      balances.set(key, Math.max(0, (balances.get(key) || 0) - amount))
    })
    return [...balances.entries()].filter(([, amount]) => amount > 0.004).map(([key, amount]) => {
      const [debtorUid, creditorUid] = key.split('::')
      return { id: key, debtorUid, creditorUid, amount: Math.round(amount * 100) / 100 }
    })
  })

  const balanceSummary = computed(() => pairBalances.value.reduce((balance, pair) => {
    if (pair.creditorUid === user.value?.uid) balance.owedToYou += pair.amount
    if (pair.debtorUid === user.value?.uid) balance.youOwe += pair.amount
    return balance
  }, { owedToYou: 0, youOwe: 0 }))

  const netBalance = computed(() => Math.round((balanceSummary.value.owedToYou - balanceSummary.value.youOwe) * 100) / 100)

  const netBalanceTitle = computed(() => netBalance.value > 0
    ? 'Te deben en total'
    : netBalance.value < 0
      ? 'Debes en total'
      : 'Balance equilibrado')

  const balanceBreakdown = computed(() => {
    const currentUid = user.value?.uid
    const breakdown = { owedToYou: [], youOwe: [] }
    if (!currentUid) return breakdown

    pairBalances.value.forEach((pair) => {
      if (pair.creditorUid === currentUid) breakdown.owedToYou.push({ id: pair.id, counterpartyUid: pair.debtorUid, amount: pair.amount, payerUid: pair.debtorUid, payeeUid: pair.creditorUid })
      if (pair.debtorUid === currentUid) breakdown.youOwe.push({ id: pair.id, counterpartyUid: pair.creditorUid, amount: pair.amount, payerUid: pair.debtorUid, payeeUid: pair.creditorUid })
    })
    return breakdown
  })

  return { pairBalances, balanceSummary, netBalance, netBalanceTitle, balanceBreakdown }
}
